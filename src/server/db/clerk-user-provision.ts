import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { users } from "@/server/db/schema";
import { retryImmediateProvisioning } from "@/server/db/immediate-transaction-retry";
import * as schema from "@/server/db/schema";

type ProvisioningDb = LibSQLDatabase<typeof schema>;

type CreatedClerkUser = Readonly<{
  clerkId: string;
  email: string | null;
  handle: string;
  name: string | null;
  color: string;
  initials: string;
}>;

/** Persist a Clerk creation without replacing an existing internal user id. */
export async function provisionCreatedClerkUserWith(
  database: ProvisioningDb,
  user: CreatedClerkUser,
): Promise<string | null> {
  const tail = user.clerkId.replace(/^user_/, "").slice(0, 12).toLowerCase();
  const workspaceId = `ws-${tail}`;
  const planningPeriodId = `planning-${workspaceId}`;
  const slug = `personal-${tail.slice(0, 8)}`;

  return retryImmediateProvisioning(database, user.clerkId, () => database.transaction(async (tx) => {
    if (await hasAccountDeletionStartedWith(tx, user.clerkId)) return null;

    await tx.insert(users).values({
      id: user.clerkId,
      clerkId: user.clerkId,
      email: user.email,
      handle: user.handle,
      name: user.name,
      color: user.color,
      initials: user.initials,
    }).onConflictDoUpdate({
      target: users.clerkId,
      set: { email: user.email, handle: user.handle, name: user.name },
    });
    const [persistedUser] = await tx.select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.clerkId))
      .limit(1);
    if (!persistedUser) throw new Error("Clerk identity could not be provisioned.");
    const userId = persistedUser.id;

    await tx.run(sql`
      INSERT OR IGNORE INTO planning_periods (
        id, owner_user_id, name, context_type, start_date, end_date,
        timezone, position, revision
      ) VALUES (
        ${planningPeriodId}, ${userId}, 'Active work', 'general',
        date('now'), date('now', '+1 year', '-1 day'), 'UTC', 1000, 1
      )
    `);
    await tx.run(sql`
      INSERT OR IGNORE INTO workspaces (
        id, slug, name, owner_user_id, active_domain,
        planning_period_id, context_type, position, updated_at
      ) VALUES (
        ${workspaceId}, ${slug}, ${user.name ?? "Personal"}, ${userId}, NULL,
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
    return userId;
  }, { behavior: "immediate" }));
}
