import "server-only";
import { desc, eq, getTableColumns, gte, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";
import { activities, tasks, users } from "./schema";
import { byWorkspace } from "./tenant";
import type { UserId } from "@/lib/data";
import { USERS } from "@/lib/data";

/**
 * The digest's mention lookup, extracted from `compileDailyDigest` so it
 * can be executed against a real two-tenant database by
 * `cross-tenant-digest-mentions.test.ts`.
 *
 * ── Why this module exists ──────────────────────────────────────────────
 *
 * Until 2026-08-12 this read selected from `activities` filtered only by
 * `kind = 'commentAdd'` and `created_at >= dayStart`. It had the caller's
 * workspace in hand and never used it, so:
 *
 *   1. a comment snippet and task title from ANOTHER workspace surfaced in
 *      a user's digest whenever that workspace's snippet contained
 *      `@<this user's id>`, and the digest is an outbound email path
 *      (`src/app/api/cron/digest/route.ts`), and
 *   2. `.limit(50)` bounded the whole table across every tenant BEFORE any
 *      per-user filtering, so a user's real mentions were silently dropped
 *      whenever other tenants were busier.
 *
 * The second is unconditional, which is why the limit now sits after both
 * the tenant predicate and the mention match rather than before them.
 *
 * `compileDailyDigest` is the only production caller. `database` is a
 * parameter rather than the module singleton purely so the test can bind a
 * seeded in-memory database — production always passes the singleton.
 */
export type DigestReader = Pick<LibSQLDatabase<typeof schema>, "select">;

export type DigestMention = {
  snippet: string;
  from: UserId;
  fromName: string;
  taskId: string;
  taskTitle: string;
  createdAt: Date;
};

/** Rows read per digest, applied AFTER tenant and mention filtering. */
export const MENTION_LIMIT = 50;

export async function collectMentions(
  database: DigestReader,
  opts: {
    workspaceId: string;
    userId: UserId;
    /** Lower bound on `createdAt`, normally 24h before now. */
    since: Date;
    limit?: number;
  },
): Promise<DigestMention[]> {
  const { workspaceId, userId, since, limit = MENTION_LIMIT } = opts;
  const tag = `@${userId}`;

  // The `@user` match is expressed in SQL as well as in the loop below so
  // that `.limit()` bounds rows that are actually this user's mentions in
  // this workspace. `_` is a LIKE wildcard and Clerk ids contain one, so
  // the pattern is a deliberate superset, never a narrower filter than the
  // exact `snippet` check that follows. The bind is parameterised.
  const rows = await database
    .select({
      ...getTableColumns(activities),
      authorName: users.name,
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(
      byWorkspace(
        activities.workspaceId,
        workspaceId,
        eq(activities.kind, "commentAdd"),
        gte(activities.createdAt, since),
        sql`${activities.payload} LIKE ${`%${tag}%`}`,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(limit);

  const mentions: DigestMention[] = [];
  for (const a of rows) {
    const payload = a.payload as { snippet?: string };
    const snippet = payload.snippet ?? "";
    if (!snippet) continue;
    if (!snippet.toLowerCase().includes(tag.toLowerCase())) continue;
    // Scoped for the same reason the read above is: an activity row names
    // a task id, and resolving a title by that id alone would read the
    // other tenant's task the moment the row itself is wrong.
    const [t] = await database
      .select({ title: tasks.title })
      .from(tasks)
      .where(
        byWorkspace(tasks.workspaceId, workspaceId, eq(tasks.id, a.taskId)),
      );
    mentions.push({
      snippet,
      from: a.userId as UserId,
      fromName: a.authorName ?? USERS[a.userId as UserId]?.name ?? a.userId,
      taskId: a.taskId,
      taskTitle: t?.title ?? "(deleted task)",
      createdAt: a.createdAt,
    });
  }
  return mentions;
}
