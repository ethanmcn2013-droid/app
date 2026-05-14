import "server-only";
import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  SEED_COMMENT_BODIES,
  SEED_TASKS,
  USERS,
  type UserId,
} from "@/lib/data";
import {
  comments,
  tasks,
  users,
} from "./schema";

type DbType = LibSQLDatabase<typeof import("./schema")>;

/** Stable id for the dev legacy workspace — the bucket existing seed
 *  data lands in so dev's workflow doesn't break on the schema cutover. */
export const LEGACY_WORKSPACE_ID = "ws-legacy";
const LEGACY_OWNER_USER_ID = "david";

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * Idempotent seed. Runs in a libSQL transaction so partial failure
 * leaves the DB empty for a retry on next boot.
 *
 * Phase A note: the legacy workspace + members get inserted alongside
 * the user rows so every existing per-tenant row can carry a non-null
 * workspaceId. Real Clerk-minted users get their own workspace via
 * the `user.created` webhook.
 */
export async function seedIfEmpty(db: DbType): Promise<void> {
  const existingTasks = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks);
  const existingComments = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments);

  const tasksEmpty = (existingTasks[0]?.count ?? 0) === 0;
  const commentsEmpty = (existingComments[0]?.count ?? 0) === 0;

  if (!tasksEmpty && !commentsEmpty) return;

  const userIds: UserId[] = Object.keys(USERS) as UserId[];
  const now = Math.floor(Date.now() / 1000);

  await db.transaction(async (tx) => {
    if (tasksEmpty) {
      // Users first — workspaces.ownerUserId FK and workspace_members.userId
      // FK both reference users.id, so this has to land before either.
      for (const u of Object.values(USERS)) {
        await tx.insert(users).values(u).onConflictDoNothing();
      }

      // Legacy workspace, owned by `david`. Idempotent INSERT so a
      // re-seed against an already-seeded DB doesn't double up.
      await tx.run(sql`
        INSERT OR IGNORE INTO workspaces (id, slug, name, owner_user_id, active_domain)
        VALUES (${LEGACY_WORKSPACE_ID}, 'legacy', 'Legacy workspace', ${LEGACY_OWNER_USER_ID}, NULL)
      `);

      // All seeded users are members of the legacy workspace, with
      // david as owner so the role distinction is exercised in dev.
      for (const u of userIds) {
        await tx.run(sql`
          INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
          VALUES (${LEGACY_WORKSPACE_ID}, ${u}, ${u === LEGACY_OWNER_USER_ID ? "owner" : "member"})
        `);
      }

      // Tasks land in the legacy workspace.
      for (const t of SEED_TASKS) {
        await tx
          .insert(tasks)
          .values({ ...t, workspaceId: LEGACY_WORKSPACE_ID });
      }
    }

    if (commentsEmpty) {
      for (const t of SEED_TASKS) {
        const baseHash = strHash(t.id);
        for (let offset = 0; offset < 3; offset++) {
          const seed = baseHash + offset * 31;
          const userId = pick(userIds, seed);
          const body = pick(SEED_COMMENT_BODIES, seed * 7 + offset);
          // Stagger so the order reads as a real conversation
          const createdAt = new Date((now - (3 - offset) * 3600) * 1000);
          await tx.insert(comments).values({
            id: `c-${t.id}-${offset}`,
            workspaceId: LEGACY_WORKSPACE_ID,
            taskId: t.id,
            userId,
            body,
            createdAt,
          });
        }
      }
    }
  });
}

// Allow `tsx src/server/db/seed.ts` for explicit re-seed.
if (require.main === module) {
  import("./index").then(async ({ db }) => {
    await seedIfEmpty(db as unknown as DbType);
    console.log("seed: done");
  });
}
