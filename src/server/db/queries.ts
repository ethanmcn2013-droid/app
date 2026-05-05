import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { tasks, comments } from "./schema";
import type { Comment, Task, UserId } from "@/lib/data";

type Row = typeof tasks.$inferSelect;

function rowToTask(row: Row): Task {
  return {
    id: row.id,
    title: row.title,
    lane: row.lane,
    priority: row.priority,
    assignees: row.assignees,
    due: row.due ?? undefined,
    estimate: row.estimate ?? undefined,
    tags: row.tags ?? undefined,
    comments: row.comments ?? undefined,
    idleDays: row.idleDays ?? undefined,
    blockedBy: row.blockedBy ?? undefined,
    startDay: row.startDay ?? undefined,
    durationDays: row.durationDays ?? undefined,
  };
}

export async function getTasks(): Promise<Task[]> {
  const rows = await db.select().from(tasks);
  return rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
  return row ? rowToTask(row) : null;
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
