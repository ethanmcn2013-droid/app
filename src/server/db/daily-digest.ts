import "server-only";
import { desc, eq, gte, like, lte } from "drizzle-orm";
import { db } from "./index";
import { tasks } from "./schema";
import { byWorkspace } from "./tenant";
import { collectMentions, type DigestMention } from "./digest-mentions";
import { rowToTask } from "./row-mappers";
import type { Task, UserId } from "@/lib/data";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";

export type DailyDigest = {
  /** ISO date the digest is for. */
  forDate: string;
  user: UserId;
  /** Tasks the user marked done in the previous 24h. */
  completedYesterday: Task[];
  /** Tasks where the user is an assignee with `dueAt` in the next 24h. */
  dueToday: Task[];
  /** Mentions targeting the user in the previous 24h. Body snippets. */
  mentions: DigestMention[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compile the next morning's digest for a given user in a given
 * workspace. Pure read function, no inserts. Designed to be called
 * from the manual "Send digest" CLI / cron endpoint without side-
 * effects so it stays safe to preview in the UI.
 *
 * Both args optional; defaults pull from the active session.
 */
export async function compileDailyDigest(
  userId?: UserId,
  workspaceId?: string,
): Promise<DailyDigest> {
  const user = userId ?? (await getCurrentUser());
  const ws = workspaceId ?? (await getActiveWorkspace());
  const now = new Date();
  const dayStart = new Date(now.getTime() - DAY_MS);
  const dayEnd = new Date(now.getTime() + DAY_MS);

  // Tasks completed (lane=done) and updated within the past 24h —
  // scoped to the active workspace so the digest doesn't bleed across
  // tenants. Through `byWorkspace` so an empty `ws` throws rather than
  // degrading into an unscoped read (see `db/tenant.ts`).
  const completedRows = await db
    .select()
    .from(tasks)
    .where(
      byWorkspace(
        tasks.workspaceId,
        ws,
        eq(tasks.lane, "done"),
        gte(tasks.updatedAt, dayStart),
      ),
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(20);
  const completedYesterday = completedRows.map((r) =>
    rowToTask({ ...r, commentCount: 0 }),
  );

  // Tasks the user is assigned to whose dueAt lands in the next 24h.
  const userToken = `%"${user}"%`;
  const dueRows = await db
    .select()
    .from(tasks)
    .where(
      byWorkspace(
        tasks.workspaceId,
        ws,
        like(tasks.assignees, userToken),
        gte(tasks.dueAt, now),
        lte(tasks.dueAt, dayEnd),
      ),
    )
    .orderBy(tasks.dueAt)
    .limit(20);
  const dueToday = dueRows.map((r) =>
    rowToTask({ ...r, commentCount: 0 }),
  );

  // Mentions in last 24h via the activities log (commentAdd payload's
  // snippet carries the @user reference). Tenant-scoped, and the row
  // limit is applied after that scope rather than across every tenant —
  // see `digest-mentions.ts` for what that read used to do.
  const mentions = await collectMentions(db, {
    workspaceId: ws,
    userId: user,
    since: dayStart,
  });

  return {
    forDate: now.toISOString().slice(0, 10),
    user,
    completedYesterday,
    dueToday,
    mentions,
  };
}
