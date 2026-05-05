import "server-only";
import {
  asc,
  desc,
  eq,
  getTableColumns,
  like,
  sql,
} from "drizzle-orm";
import { db } from "./index";
import { tasks, comments, activities } from "./schema";
import type {
  Activity,
  ActivityKind,
  ActivityPayload,
  Comment,
  Task,
  UserId,
} from "@/lib/data";

type TaskRow = typeof tasks.$inferSelect & { commentCount: number };

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    lane: row.lane,
    priority: row.priority,
    assignees: row.assignees,
    due: row.due ?? undefined,
    estimate: row.estimate ?? undefined,
    tags: row.tags ?? undefined,
    // 0 → undefined keeps existing truthy `task.comments` checks
    // (which hide the chip on zero) working unchanged.
    comments: row.commentCount > 0 ? row.commentCount : undefined,
    idleDays: row.idleDays ?? undefined,
    blockedBy: row.blockedBy ?? undefined,
    startDay: row.startDay ?? undefined,
    durationDays: row.durationDays ?? undefined,
    updatedAt: row.updatedAt,
  };
}

const taskColumnsWithCount = {
  ...getTableColumns(tasks),
  commentCount:
    sql<number>`(SELECT COUNT(*) FROM ${comments} WHERE ${comments.taskId} = ${tasks.id})`.as(
      "comment_count",
    ),
};

export async function getTasks(): Promise<Task[]> {
  const rows = await db.select(taskColumnsWithCount).from(tasks);
  return rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const [row] = await db
    .select(taskColumnsWithCount)
    .from(tasks)
    .where(eq(tasks.id, id));
  return row ? rowToTask(row) : null;
}

/**
 * Tasks where the given user is in the JSON `assignees` array.
 * Pattern uses surrounding double-quotes (`%"david"%`) so we match
 * exact tokens, not substrings — safe given current UserIds.
 */
export async function getTasksForUser(
  userId: UserId,
): Promise<Task[]> {
  const rows = await db
    .select(taskColumnsWithCount)
    .from(tasks)
    .where(like(tasks.assignees, `%"${userId}"%`));
  return rows.map(rowToTask);
}

type CommentRow = typeof comments.$inferSelect;

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId as UserId,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export async function getCommentsForTask(
  taskId: string,
): Promise<Comment[]> {
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt));
  return rows.map(rowToComment);
}

type ActivityRow = typeof activities.$inferSelect;

function rowToActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    kind: row.kind as ActivityKind,
    payload: row.payload as ActivityPayload,
    createdAt: row.createdAt,
  };
}

export async function getActivitiesForTask(
  taskId: string,
): Promise<Activity[]> {
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.taskId, taskId))
    .orderBy(desc(activities.createdAt))
    .limit(50);
  return rows.map(rowToActivity);
}
