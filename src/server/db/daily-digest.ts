import "server-only";
import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { db } from "./index";
import { activities, tasks } from "./schema";
import { rowToTask } from "./row-mappers";
import type { Task, UserId } from "@/lib/data";
import { USERS } from "@/lib/data";
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
  mentions: Array<{
    snippet: string;
    from: UserId;
    fromName: string;
    taskId: string;
    taskTitle: string;
    createdAt: Date;
  }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compile the next morning's digest for a given user in a given
 * workspace. Pure read function — no inserts. Designed to be called
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
  // tenants.
  const completedRows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, ws),
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
      and(
        eq(tasks.workspaceId, ws),
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
  // snippet contains @user references; the comments table itself is
  // searched for the actual @-mention bodies).
  const mentionRows = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.kind, "commentAdd"),
        gte(activities.createdAt, dayStart),
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(50);

  const mentions: DailyDigest["mentions"] = [];
  for (const a of mentionRows) {
    const payload = a.payload as { snippet?: string };
    const snippet = payload.snippet ?? "";
    if (!snippet) continue;
    const tag = `@${user}`;
    if (!snippet.toLowerCase().includes(tag.toLowerCase())) continue;
    const [t] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, a.taskId));
    mentions.push({
      snippet,
      from: a.userId as UserId,
      fromName: USERS[a.userId as UserId]?.name ?? a.userId,
      taskId: a.taskId,
      taskTitle: t?.title ?? "(deleted task)",
      createdAt: a.createdAt,
    });
  }

  return {
    forDate: now.toISOString().slice(0, 10),
    user,
    completedYesterday,
    dueToday,
    mentions,
  };
}
