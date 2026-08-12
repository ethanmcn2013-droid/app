import "server-only";

import { createClient } from "@libsql/client";
import { isAuthError } from "./tasks-milestone-source";

export type CurrentTasksWorkspaceContext = Readonly<{
  workspaceId: string;
  planningPeriodId: string | null;
  /** The Tasks Project's own slug and name, so a Timeline provisioned for this
   *  exact Project can be named after it without a second lookup that could
   *  resolve a different Project. */
  slug: string;
  name: string;
  /** The caller's `workspace_members.role` in this exact Project.
   *
   *  NOT a statement about who owns the Project. `setMemberRoleAction`
   *  promotes members to `role: "owner"`, so several people can carry it.
   *  Use `ownerClerkId` for ownership; this is capability only. */
  role: string;
  /** The Clerk subject of the Project's real owner — `workspaces.owner_user_id`
   *  joined out to that user's immutable subject (plan §6.4 step 9).
   *
   *  Null when the Project has no owner row (the column is nullable from the
   *  legacy backfill). Missing identity must read as missing, so provisioning
   *  refuses rather than choosing the visitor. */
  ownerClerkId: string | null;
  /** Set when the Tasks Project is archived. Archived Projects accept no new
   *  association, so no Timeline is created, adopted or bound for one. */
  archivedAt: number | null;
}>;

/**
 * Reauthorizes an incoming suite context against current Tasks membership.
 * Query-string ids are routing hints only; this read is the authorization
 * source. Missing configuration/schema or any auth error fails closed.
 */
export type PrimaryTasksWorkspace = Readonly<{
  workspaceId: string;
  slug: string;
  name: string;
  activeDomain: string | null;
}>;

/**
 * The one Tasks workspace a Timeline should be provisioned against.
 *
 * Used only by the provisioning path (`ensureTimelineWorkspaceForUser`), which
 * needs a workspace to bind to before the user has ever chosen one. Every other
 * caller reauthorises an incoming id through
 * `getCurrentTasksWorkspaceContext`; this one has no incoming id to reauthorise.
 *
 * OWNERSHIP, NOT MEMBERSHIP. The filter is `wm.role = 'owner'`, so being
 * invited to somebody else's board never provisions a Timeline over their plan.
 * A sponsored couple always owns their own workspace: `ensureUserProvisioned`
 * inserts the owner row before redemption writes the entitlement
 * (src/server/db/ensure-user.ts).
 *
 * `wm.role = 'owner'` is not on its own enough, and WP1 added the second half.
 * `setMemberRoleAction` promotes members to `role: "owner"`, so a co-owner of
 * somebody else's Project carries it too — and a promoted co-owner with no
 * Project of their own would have had this resolve to the SHARED Project and
 * mint its Timeline under their identity, consuming the unique suite-id index
 * and locking the real owner out permanently. `w.owner_user_id = u.id` is the
 * ownership; the role filter stays as the capability check beside it.
 *
 * TIE-BREAK, STATED SO IT IS NOT AN ACCIDENT. A wedding workspace wins over
 * any other, then the oldest owned workspace wins. A couple has exactly one, so
 * the tie-break only ever matters for a general Tasks user with several, and
 * for them "the one I started with" is the least surprising answer.
 *
 * Fails closed: missing configuration, no row, or any error returns null and
 * provisioning is skipped rather than guessed at.
 */
export async function getPrimaryTasksWorkspaceForUser(
  clerkId: string,
): Promise<PrimaryTasksWorkspace | null> {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken || !clerkId.trim()) return null;

  const client = createClient({ url, authToken });
  try {
    const result = await client.execute({
      sql: `
        SELECT
          w.id            AS workspace_id,
          w.slug          AS slug,
          w.name          AS name,
          w.active_domain AS active_domain
        FROM users u
        INNER JOIN workspace_members wm ON wm.user_id = u.id
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE u.clerk_id = ?
          AND wm.role = 'owner'
          AND w.owner_user_id = u.id
          AND w.archived_at IS NULL
        ORDER BY
          CASE WHEN w.active_domain = 'wedding' THEN 0 ELSE 1 END,
          w.created_at ASC,
          w.id ASC
        LIMIT 1
      `,
      args: [clerkId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      workspaceId: String(row.workspace_id),
      slug: String(row.slug),
      name: String(row.name),
      activeDomain: row.active_domain == null ? null : String(row.active_domain),
    };
  } catch (error) {
    if (!isAuthError(error)) {
      console.error("[tasks-workspace-context] primary workspace lookup failed");
    }
    return null;
  } finally {
    client.close();
  }
}

/**
 * The actor's only owned Tasks Project, when they own exactly one.
 *
 * Returns null when they own none or more than one — deliberately, because the
 * single caller (`decideTimelineAdoption`) uses this as a UNIQUENESS PROOF and
 * nothing else. With one owned Project and one unclaimed Timeline there is
 * exactly one possible pairing; with two of either, binding them would be a
 * guess, and a wrong Timeline↔Project join is silent, durable and harder to
 * notice than the dead end it replaced.
 *
 * `LIMIT 2` on purpose: we need to know whether a second row exists, never
 * which one it is.
 *
 * ── ARCHIVED SIBLINGS COUNT ────────────────────────────────────────────────
 * This deliberately does NOT filter on `archived_at`, and that is the whole
 * proof. It used to, and the pairing argument quietly stopped holding: an owner
 * with an archived 2024 Project and an active 2026 one counted as "exactly
 * one", so their one unclaimed in-app Timeline — made for 2024 — was adopted
 * as the 2026 Project's Timeline. Permanently, because `connectSuiteWorkspace`
 * then refuses to rebind it.
 *
 * An archived Project is still a Project a Timeline could belong to. The
 * requested Project is already proved non-archived before this is consulted
 * (`resolveCanonicalTimeline`), so counting archived rows can only ever make
 * the proof stricter, never let a wrong pairing through.
 *
 * Fails closed. Missing configuration or any error returns null, which reads as
 * "not proved" and routes the owner to an explicit choice rather than a guess.
 */
export async function getSoleOwnedTasksWorkspaceIdForUser(
  clerkId: string,
): Promise<string | null> {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken || !clerkId.trim()) return null;

  const client = createClient({ url, authToken });
  try {
    const result = await client.execute({
      sql: `
        SELECT w.id AS workspace_id
        FROM users u
        INNER JOIN workspace_members wm ON wm.user_id = u.id
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE u.clerk_id = ?
          AND wm.role = 'owner'
        LIMIT 2
      `,
      args: [clerkId],
    });
    if (result.rows.length !== 1) return null;
    return String(result.rows[0]!.workspace_id);
  } catch (error) {
    if (!isAuthError(error)) {
      console.error("[tasks-workspace-context] sole-owned lookup failed");
    }
    return null;
  } finally {
    client.close();
  }
}

export async function getCurrentTasksWorkspaceContext(
  clerkId: string,
  workspaceId: string,
): Promise<CurrentTasksWorkspaceContext | null> {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken || !clerkId.trim() || !workspaceId.trim()) return null;

  const client = createClient({ url, authToken });
  try {
    const result = await client.execute({
      sql: `
        SELECT
          w.id                 AS workspace_id,
          w.planning_period_id AS planning_period_id,
          w.slug               AS slug,
          w.name               AS name,
          w.archived_at        AS archived_at,
          wm.role              AS role,
          ow.clerk_id          AS owner_clerk_id
        FROM users u
        INNER JOIN workspace_members wm ON wm.user_id = u.id
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        LEFT JOIN users ow ON ow.id = w.owner_user_id
        WHERE u.clerk_id = ? AND w.id = ?
        LIMIT 1
      `,
      args: [clerkId, workspaceId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      workspaceId: String(row.workspace_id),
      planningPeriodId:
        row.planning_period_id == null ? null : String(row.planning_period_id),
      slug: row.slug == null ? "" : String(row.slug),
      name: row.name == null ? "" : String(row.name),
      role: row.role == null ? "" : String(row.role),
      // LEFT JOIN: a Project with no owner row yields null, which the resolver
      // treats as "identity not proved" and refuses to provision against.
      ownerClerkId: row.owner_clerk_id == null ? null : String(row.owner_clerk_id),
      archivedAt: row.archived_at == null ? null : Number(row.archived_at),
    };
  } catch (error) {
    // Do not fall back to a first workspace when current membership cannot be
    // proved. Avoid logging ids; they are private suite routing metadata.
    if (!isAuthError(error)) {
      console.error("[tasks-workspace-context] current membership check failed");
    }
    return null;
  } finally {
    client.close();
  }
}
