import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-lifecycle";
import { serializeProvisioning } from "@/server/db/serialized-provisioning";
import { isTransient } from "@/server/db/retry";

type ProvisioningDb = LibSQLDatabase<typeof schema>;

/**
 * Idempotent fallback user provisioning. Normally the Clerk `user.created`
 * webhook hydrates `users` + `workspaces` + `workspace_members` for every
 * sign-up. When the webhook hasn't fired yet (race against the post-sign-up
 * redirect) or isn't configured (missing CLERK_WEBHOOK_SIGNING_SECRET on
 * the deployed environment), routes that need a real workspace can call
 * this helper to provision a minimal record from just the Clerk id.
 *
 * The webhook's `user.created` handler does INSERT OR IGNORE / ON CONFLICT
 * DO UPDATE, so when it eventually fires it harmlessly updates the row
 * with full email / name / handle that we don't have here.
 *
 * B6 (Phase 3.6): when `email` is supplied and the row already exists with
 * a NULL email column, this call backfills it. This closes the pre-migration
 * NULL-email recurrence risk for users provisioned before the email column
 * existed, without touching rows that already have email set.
 *
 * Safe to call repeatedly, every write is conditional on absence or NULL.
 */
export async function ensureUserProvisioned(
  clerkUserId: string,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): Promise<void> {
  await ensureUserProvisionedWith(
    db,
    clerkUserId,
    email,
    firstName,
    lastName,
  );
}


/** Resolve a verified Clerk profile without opening a writer transaction for a complete account.
 * This proof is fresh on every request; it is not authorization and is never cached.
 * Mutations still prove membership and deletion fences inside their writer transaction.
 */
export async function resolveProvisionedUserId(
  clerkUserId: string, email?: string | null, firstName?: string | null, lastName?: string | null,
): Promise<string | null> {
  return resolveProvisionedUserIdWith(db, clerkUserId, email, firstName, lastName);
}

/** Injectable fresh-read seam; incomplete accounts retain the original serialized writer. */
export async function resolveProvisionedUserIdWith(
  database: ProvisioningDb, clerkUserId: string, email?: string | null,
  firstName?: string | null, lastName?: string | null,
): Promise<string | null> {
  if (!clerkUserId || !clerkUserId.startsWith("user_")) return null;
  const tail = clerkUserId.replace(/^user_/, "").slice(0, 12).toLowerCase();
  const workspaceId = `ws-${tail}`;
  const planningPeriodId = `planning-${workspaceId}`;
  const f = firstName?.trim();
  const l = lastName?.trim();
  const name = f && l ? `${f} ${l}` : f ?? l ?? null;
  const [complete] = await database.select({
    deletionStarted: sql<number>`EXISTS (
      SELECT 1 FROM ${schema.meta}
      WHERE ${schema.meta.key} = ${accountDeletionTombstoneKey(clerkUserId)}
    )`,
    userId: schema.users.id,
    name: schema.users.name,
    email: schema.users.email,
    periodOwnerId: schema.planningPeriods.ownerUserId,
    workspaceOwnerId: schema.workspaces.ownerUserId,
    workspacePlanningPeriodId: schema.workspaces.planningPeriodId,
    workspaceContextType: schema.workspaces.contextType,
    workspaceUpdatedAt: schema.workspaces.updatedAt,
    memberUserId: schema.workspaceMembers.userId,
    memberRole: schema.workspaceMembers.role,
  }).from(sql`(SELECT 1) AS provision_anchor`)
    .leftJoin(schema.users, eq(schema.users.clerkId, clerkUserId))
    .leftJoin(schema.planningPeriods, eq(schema.planningPeriods.id, planningPeriodId))
    .leftJoin(schema.workspaces, eq(schema.workspaces.id, workspaceId))
    .leftJoin(schema.workspaceMembers, and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, schema.users.id),
    ))
    .limit(1);
  if (!complete) throw new Error("Provisioning pre-write read returned no anchor row.");
  // Match the existing auth resolution on a tombstone: never provision, retain
  // any mapped ID for downstream transactional deletion guards to refuse.
  if (complete.deletionStarted === 1) return complete.userId;
  if (complete.userId !== null &&
      (!name || complete.name !== null) && (!email || complete.email !== null) &&
      complete.periodOwnerId === complete.userId &&
      complete.workspaceOwnerId === complete.userId &&
      complete.workspacePlanningPeriodId !== null &&
      complete.workspaceContextType === "project" &&
      complete.workspaceUpdatedAt !== null &&
      complete.memberUserId === complete.userId && complete.memberRole === "owner") return complete.userId;

  await ensureUserProvisionedWith(database, clerkUserId, email, firstName, lastName);
  const [persisted] = await database.select({ id: schema.users.id }).from(schema.users)
    .where(eq(schema.users.clerkId, clerkUserId));
  return persisted?.id ?? null;
}

/** Injectable form used to prove deletion/provisioning race safety. */
export async function ensureUserProvisionedWith(
  database: ProvisioningDb,
  clerkUserId: string,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): Promise<boolean> {
  if (!clerkUserId || !clerkUserId.startsWith("user_")) return false;

  const tail = clerkUserId.replace(/^user_/, "").slice(0, 12).toLowerCase();
  const shortTail = tail.slice(0, 8);
  const handle = shortTail || clerkUserId.slice(0, 8).toLowerCase();
  const color = deriveColor(clerkUserId);
  const workspaceId = `ws-${tail}`;
  const planningPeriodId = `planning-${workspaceId}`;
  const slug = `personal-${shortTail}`;

  // C2: derive name + initials from Clerk firstName/lastName when available
  // so the activity log shows the real name, not "Someone".
  const f = firstName?.trim();
  const l = lastName?.trim();
  const name = f && l ? `${f} ${l}` : f ?? l ?? null;
  const initialsFromName = f && l ? `${f[0]}${l[0]}`.toUpperCase()
    : f ? f.slice(0, 2).toUpperCase()
    : l ? l.slice(0, 2).toUpperCase()
    : null;
  const initials = initialsFromName ?? (handle.slice(0, 2).toUpperCase() || "??");

  return serializeProvisioning(database, clerkUserId, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let mutationStarted = false;
      let preWriteReadFailed = false;
      let preWriteReadError: unknown;
      try {
        return await database.transaction(async (tx) => {
          try {
            // This read and every provisioning write share one immediate transaction.
            // If deletion commits first, no row is recreated. If provisioning commits
            // first, deletion observes and erases that row after installing its fence.
            // The one-row anchor preserves the deletion fence even when no user
            // exists. The tombstone and warm completeness are read under the same
            // write lock; deletion wins before any completion or fallback decision.
            // A different persisted user id is valid; dependent rows bind to it.
            const [complete] = await tx.select({
              deletionStarted: sql<number>`EXISTS (
                SELECT 1 FROM ${schema.meta}
                WHERE ${schema.meta.key} = ${accountDeletionTombstoneKey(clerkUserId)}
              )`,
              userId: schema.users.id,
              name: schema.users.name,
              email: schema.users.email,
              periodOwnerId: schema.planningPeriods.ownerUserId,
              workspaceOwnerId: schema.workspaces.ownerUserId,
              workspacePlanningPeriodId: schema.workspaces.planningPeriodId,
              workspaceContextType: schema.workspaces.contextType,
              workspaceUpdatedAt: schema.workspaces.updatedAt,
              memberUserId: schema.workspaceMembers.userId,
              memberRole: schema.workspaceMembers.role,
            }).from(sql`(SELECT 1) AS provision_anchor`)
              .leftJoin(schema.users, eq(schema.users.clerkId, clerkUserId))
              .leftJoin(schema.planningPeriods, eq(schema.planningPeriods.id, planningPeriodId))
              .leftJoin(schema.workspaces, eq(schema.workspaces.id, workspaceId))
              .leftJoin(schema.workspaceMembers, and(
                eq(schema.workspaceMembers.workspaceId, workspaceId),
                eq(schema.workspaceMembers.userId, schema.users.id),
              ))
              .limit(1);
            if (!complete) throw new Error("Provisioning pre-write read returned no anchor row.");
            if (complete.deletionStarted === 1) return false;
            if (complete.userId !== null &&
                (!name || complete.name !== null) &&
                (!email || complete.email !== null) &&
                complete.periodOwnerId === complete.userId &&
                complete.workspaceOwnerId === complete.userId &&
                complete.workspacePlanningPeriodId !== null &&
                complete.workspaceContextType === "project" &&
                complete.workspaceUpdatedAt !== null &&
                complete.memberUserId === complete.userId &&
                complete.memberRole === "owner") return true;
          } catch (error) {
            preWriteReadFailed = true;
            preWriteReadError = error;
            throw error;
          }

          // From this point onward, even a synchronously rejected or ignored first
          // write must never cause the transaction callback to be replayed.
          mutationStarted = true;
          await tx.run(sql`
            INSERT OR IGNORE INTO users (id, clerk_id, handle, color, initials)
            VALUES (${clerkUserId}, ${clerkUserId}, ${handle}, ${color}, ${initials})
          `);
          // A pre-existing row can have a stable internal id that differs from its
          // Clerk id. INSERT OR IGNORE above then leaves that row in place; every
          // dependent FK must use the persisted id, not the proposed insert id.
          const [persistedUser] = await tx.select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.clerkId, clerkUserId))
            .limit(1);
          if (!persistedUser) throw new Error("Clerk identity could not be provisioned.");
          const userId = persistedUser.id;

          // C2: backfill name when the row exists but name is NULL.
          // INSERT OR IGNORE leaves name NULL on existing rows; this UPDATE
          // sets it only once (WHERE name IS NULL) so the webhook's more
          // authoritative value is never overwritten.
          if (name) {
            await tx.run(sql`
              UPDATE users SET name = ${name}, initials = ${initials}
              WHERE id = ${userId} AND clerk_id = ${clerkUserId}
                AND name IS NULL
            `);
          }

          // B6: backfill email when the row exists but email is NULL.
          // Only runs when email was passed and is non-empty.
          // Uses WHERE email IS NULL so it never overwrites a real value.
          if (email) {
            await tx.run(sql`
              UPDATE users SET email = ${email}
              WHERE id = ${userId} AND clerk_id = ${clerkUserId}
                AND email IS NULL
            `);
          }

          await tx.run(sql`
            INSERT OR IGNORE INTO planning_periods (
              id, owner_user_id, name, context_type, start_date, end_date,
              timezone, position, revision
            )
            VALUES (
              ${planningPeriodId}, ${userId}, 'Active work', 'general',
              date('now'), date('now', '+1 year', '-1 day'), 'UTC', 1000, 1
            )
          `);

          await tx.run(sql`
            INSERT OR IGNORE INTO workspaces (
              id, slug, name, owner_user_id, active_domain,
              planning_period_id, context_type, position, updated_at
            )
            VALUES (
              ${workspaceId}, ${slug}, 'Personal', ${userId}, NULL,
              ${planningPeriodId}, 'project', 1000, unixepoch()
            )
          `);
          await tx.run(sql`
            UPDATE workspaces
            SET planning_period_id = COALESCE(planning_period_id, ${planningPeriodId}),
                context_type = COALESCE(context_type, 'project'),
                updated_at = COALESCE(updated_at, unixepoch())
            WHERE id = ${workspaceId}
          `);
          await tx.run(sql`
            INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
            VALUES (${workspaceId}, ${userId}, 'owner')
          `);
          return true;
        }, { behavior: "immediate" });
      } catch (error) {
        // Drizzle rejects with the same callback error only after rollback
        // succeeds. A commit or rollback failure cannot pass this identity
        // check and must propagate without retrying the transaction.
        if (!preWriteReadFailed || mutationStarted || error !== preWriteReadError ||
            !isTransient(error) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
      }
    }
    throw new Error("Provisioning read retry exhausted.");
  });
}

// Matches the webhook handler's PALETTE + hash for visual stability.
const PALETTE = [
  "#4f46e5",
  "#7c3aed",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#84cc16",
  "#f43f5e",
];

function deriveColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
