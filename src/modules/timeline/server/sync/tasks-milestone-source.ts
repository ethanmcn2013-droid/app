/**
 * tasks-milestone-source.ts, read-only milestone pull from the Tasks DB.
 *
 * Structural copy of analytics/src/lib/briefing/tasks-db-source.ts.
 * The immutable suite subject (`clerk_id`) is the only cross-product key.
 * Email is display data and never authorizes a Tasks read. ARCH_SPEC §1.2.
 *
 * Read-only by design, TASKS_AUTH_TOKEN must be a Turso read-only token.
 * Data flow: Roadmap ← Tasks. Never the other way.
 *
 * Null-return when env unset: callers handle the missing-config case gracefully.
 * Lazy client + isAuthError reset: expired tokens self-heal on next sync run.
 *
 * Generation (status → lane, ARCH_SPEC §1.4, D4, D8):
 *   todo    → status:"next"      (display: "Next")
 *   doing   → status:"in-flight" (display: "In flight")
 *   review  → status:"in-flight" (display: "In flight")
 *   done    → status:"shipped"   (display: "Shipped")
 *   no date → Later (presentational; status:"next" + view-layer grouping, D7)
 *
 * Node id: deterministic `ms-{tasksWorkspaceId}-{tasksTaskId}` (ARCH_SPEC §1.4).
 */

import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import type { SyncedMilestone } from "@/modules/timeline/server/db/timeline-queries";
import type { Status } from "@/modules/timeline/server/db/timeline-schema";
import { assertTasksMilestoneQuery } from "./tasks-read-contract";

// ── Auth-error heuristic (mirrors analytics tasks-db-source) ─────────────────

export function isAuthError(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes("401") ||
    s.includes("403") ||
    s.includes("unauthorized") ||
    s.includes("forbidden") ||
    s.includes("token") ||
    s.includes("auth")
  );
}

// ── Status mapper (Tasks lane → Roadmap Status) ───────────────────────────────

export function canonicaliseStatus(tasksLane: string): Status {
  switch (tasksLane) {
    case "todo":
      return "next";
    case "doing":
    case "review":
      return "in-flight";
    case "done":
      return "shipped";
    default:
      return "next";
  }
}

// ── Tagged source result ──────────────────────────────────────────────────────

/**
 * What one read of the Tasks milestone source actually proved.
 *
 * ── WHY THIS IS NOT AN ARRAY ───────────────────────────────────────────────
 * It used to be `SyncedMilestone[]`, and every failure — a dropped connection,
 * an expired read token, a subject with no Tasks user row — was converted to
 * `[]` before it left this file. The caller then handed that `[]` to
 * `writeRoadmapNodes`, whose documented contract for an empty incoming set is
 * to delete EVERY synchronized node in the project. So a network blip deleted
 * a couple's timeline, and the code that did it looked like a successful sync
 * of an empty Project.
 *
 * An authorized empty result and a failed read are different facts and now have
 * different shapes. Only `complete` is allowed to be destructive, and only when
 * it can prove it saw everything (plan §6.5, ADR 0001 §6).
 */
export type MilestoneSnapshot =
  /** Every row the Project has, and a digest over them. Destructive
   *  reconciliation is permitted only for this, and only when
   *  `items.length === totalCount`. */
  | Readonly<{
      kind: "complete";
      items: SyncedMilestone[];
      totalCount: number;
      digest: string;
    }>
  /** The read was authorized and succeeded but did not see everything — the
   *  row cap truncated it. What came back is real; what did not come back is
   *  not proof of absence. */
  | Readonly<{ kind: "partial"; items: SyncedMilestone[]; totalCount: number }>
  /** Nothing was proved. Never a licence to delete anything. */
  | Readonly<{ kind: "unauthorized" | "unavailable" | "error"; code: string }>;

/**
 * The row cap, and the reason it is 201 rather than 200.
 *
 * ARCH_SPEC §1.2 caps the read at 200 rows to defend the engine against a huge
 * Project. That cap was invisible to the caller: 200 rows came back looking
 * exactly like "this Project has 200 milestones", and every milestone past the
 * cap was then deleted as stale. Asking for 201 makes the cap observable, and
 * `COUNT(*) OVER ()` — evaluated before LIMIT — reports the true total, so a
 * truncated read can say so instead of pretending to be complete.
 */
export const MILESTONE_PAGE_LIMIT = 200;
const MILESTONE_FETCH_LIMIT = MILESTONE_PAGE_LIMIT + 1;

/**
 * A stable digest over sorted source identity and the fields that matter.
 *
 * Sorted by id so row order from the database cannot change the digest, and
 * field-delimited so `("a|b", "c")` and `("a", "b|c")` cannot collide. The
 * record separator is written as an escape rather than as a literal control
 * character, so it stays visible to a reader and to `git diff`.
 *
 * The encoding is injective only if the escape character is itself escaped, and
 * escaped FIRST. Escaping the delimiter alone made the literal titles
 * `a\|b` and `a|b` encode identically, so one could be edited into the other
 * without the digest moving — a change-detector that reports "nothing changed"
 * is worse than no change-detector at all.
 */
const DIGEST_RECORD_SEPARATOR = "\u0000";

/** Escape the escape first, then the delimiter. Order is the correctness. */
function escapeDigestField(field: string): string {
  return field.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

export function digestMilestones(items: readonly SyncedMilestone[]): string {
  const hash = createHash("sha256");
  for (const item of [...items].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    hash.update(
      [
        item.id,
        item.title,
        item.status,
        item.targetDate ?? "",
        String(item.sortOrder),
      ]
        .map(escapeDigestField)
        .join("|"),
    );
    hash.update(DIGEST_RECORD_SEPARATOR);
  }
  return hash.digest("hex");
}

// ── Source factory ────────────────────────────────────────────────────────────

export interface MilestoneSyncSource {
  getMilestonesForClerkId(
    clerkId: string,
    canonicalWorkspaceId: string,
  ): Promise<MilestoneSnapshot>;
}

/**
 * Returns null when TASKS_DATABASE_URL or TASKS_AUTH_TOKEN env vars are absent.
 * The action layer surfaces a user-friendly "not configured" message in that case.
 */
export function makeMilestoneSyncSource(): MilestoneSyncSource | null {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken) return null;

  // Lazily created and reset on auth-class failures so a rotated or
  // expired read-only token self-heals on the next sync run.
  let client: Client | null = null;
  function getClient(): Client {
    if (!client) client = createClient({ url: url!, authToken: authToken! });
    return client;
  }
  function dropClientIfAuth(err: unknown) {
    if (isAuthError(err)) client = null;
  }

  return {
    async getMilestonesForClerkId(
      clerkId: string,
      canonicalWorkspaceId: string,
    ): Promise<MilestoneSnapshot> {
      assertTasksMilestoneQuery({
        subject: clerkId,
        workspaceId: canonicalWorkspaceId,
      });
      // Step 1, immutable suite subject → Tasks user id.
      let tasksUserId: string | null = null;
      try {
        const userRow = await getClient().execute({
          sql: "SELECT id FROM users WHERE clerk_id = ? LIMIT 1",
          args: [clerkId],
        });
        const id = userRow.rows[0]?.id;
        tasksUserId = id != null ? String(id) : null;
      } catch (err) {
        dropClientIfAuth(err);
        console.error("[tasks-milestone-source] user lookup failed:", String(err));
        return isAuthError(err)
          ? { kind: "unauthorized", code: "user_lookup_unauthorized" }
          : { kind: "error", code: "user_lookup_failed" };
      }
      if (!tasksUserId) {
        // The subject has no Tasks user row, so nothing about this Project's
        // milestones was read, let alone proved empty. This used to return `[]`
        // and was described as "a calm empty state"; downstream, an empty array
        // means "delete every synchronized node". It is unavailability.
        return { kind: "unavailable", code: "subject_not_linked" };
      }

      // Step 1b, membership as its own statement, before any row is read.
      //
      // ── WHY THIS IS SEPARATE FROM THE ROW QUERY ────────────────────────
      // Row-level authorization also lives in the milestone query's `EXISTS`
      // subquery below, and for a while that was the ONLY place it lived. A
      // caller with no `workspace_members` row therefore matched no rows and
      // got ZERO ROWS, not an error — which classified as a complete,
      // authorized, empty Project, which is the one state permitted to delete
      // every synchronized node. Deleting the Tasks Project, or removing a
      // collaborator, silently emptied their Timeline and reported success.
      //
      // Plan §6.5 says "a freshly AUTHORIZED, successful zero". An absent
      // membership row is the difference between "you may not read this" and
      // "there is nothing here", and a filter cannot tell those apart — only a
      // separate proof can. The `EXISTS` clause stays as the row-level scope;
      // this is the authorization.
      try {
        const membership = await getClient().execute({
          sql: `
            SELECT 1 AS authorized
            FROM workspace_members
            WHERE workspace_id = ? AND user_id = ?
            LIMIT 1
          `,
          args: [canonicalWorkspaceId, tasksUserId],
        });
        if (membership.rows.length === 0) {
          return { kind: "unauthorized", code: "membership_absent" };
        }
      } catch (err) {
        dropClientIfAuth(err);
        console.error("[tasks-milestone-source] membership check failed:", String(err));
        return isAuthError(err)
          ? { kind: "unauthorized", code: "membership_check_unauthorized" }
          : { kind: "error", code: "membership_check_failed" };
      }

      // Step 2, fetch milestones (is_milestone=1, top-level, workspace-scoped)
      // Reads: flag, lane, due_at, title, workspace_id, workspace.name
      // ARCH_SPEC §1.2 caps this read at 200 rows to defend the engine against
      // a huge Project. We ask for 201 and carry COUNT(*) OVER () — a window
      // function, so it is evaluated over the whole result set BEFORE LIMIT —
      // to make the cap observable. Truncation is then reported as `partial`
      // rather than silently presented as the Project's full contents, which
      // is what deleted every milestone past row 200.
      let rows: Awaited<ReturnType<Client["execute"]>>["rows"];
      try {
        const result = await getClient().execute({
          sql: `
            SELECT
              t.id           AS task_id,
              t.title        AS title,
              t.lane         AS lane,
              t.due_at       AS due_at,
              w.id           AS workspace_id,
              w.name         AS workspace_name,
              COUNT(*) OVER () AS total_count,
              ROW_NUMBER() OVER (ORDER BY w.id, t.due_at NULLS LAST, t.id) - 1 AS sort_order
            FROM tasks t
            INNER JOIN workspaces w ON w.id = t.workspace_id
            WHERE t.is_milestone = 1
              AND t.parent_task_id IS NULL
              AND t.workspace_id = ?
              AND EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = t.workspace_id AND wm.user_id = ?
              )
            ORDER BY t.due_at, t.id
            LIMIT ${MILESTONE_FETCH_LIMIT}
          `,
          args: [canonicalWorkspaceId, tasksUserId],
        });
        rows = result.rows;
      } catch (err) {
        dropClientIfAuth(err);
        console.error("[tasks-milestone-source] milestones query failed:", String(err));
        return isAuthError(err)
          ? { kind: "unauthorized", code: "milestone_query_unauthorized" }
          : { kind: "error", code: "milestone_query_failed" };
      }

      const items = rows.map((row, i) => {
        const tasksWorkspaceId = String(row.workspace_id);
        const tasksTaskId = String(row.task_id);
        const dueAt = row.due_at != null ? Number(row.due_at) : null;
        const targetDate = dueAt
          ? new Date(dueAt).toISOString().slice(0, 10)
          : null;

        return {
          id: `ms-${tasksWorkspaceId}-${tasksTaskId}`,
          // projectSlug resolved by the caller from sourceTasksWorkspaceId mapping
          projectSlug: "", // filled in by writeRoadmapNodes caller
          workspaceSlug: "", // filled in by caller
          title: String(row.title),
          status: canonicaliseStatus(String(row.lane)),
          targetDate,
          sortOrder: Number(row.sort_order ?? i),
        };
      });

      // `COUNT(*) OVER ()` is absent only when there are no rows at all, and a
      // genuine zero is a complete zero: the read was authorized, it succeeded,
      // and this Project has no milestones. That is the one and only state
      // permitted to remove every synchronized node.
      const totalCount = Number(rows[0]?.total_count ?? 0);

      if (items.length < totalCount) {
        // The cap truncated the read. What is missing is not proof of absence,
        // so this snapshot may add and update but must never delete.
        return { kind: "partial", items, totalCount };
      }

      return {
        kind: "complete",
        items,
        totalCount,
        digest: digestMilestones(items),
      };
    },
  };
}
