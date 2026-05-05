"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { comments, tasks } from "@/server/db/schema";
import { getCommentsForTask } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { CURRENT_USER, type Comment } from "@/lib/data";

function snippetOf(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 60).trimEnd() + "…";
}

/** Touch the parent task's updatedAt so comments count as engagement
 *  and the panel's "edited X ago" stamp reflects activity. */
async function touchTask(taskId: string) {
  await db
    .update(tasks)
    .set({ updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

function newCommentId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `c-${raw.replace(/-/g, "").slice(0, 10)}`;
}

export async function getCommentsForTaskAction(
  taskId: string,
): Promise<Comment[]> {
  return getCommentsForTask(taskId);
}

export async function addCommentAction(
  taskId: string,
  body: string,
): Promise<Comment[]> {
  const trimmed = body.trim();
  if (!trimmed) return getCommentsForTask(taskId);

  const commentId = newCommentId();
  await db.insert(comments).values({
    id: commentId,
    taskId,
    userId: CURRENT_USER,
    body: trimmed,
    createdAt: new Date(),
  });
  await touchTask(taskId);
  await recordActivity(taskId, {
    kind: "commentAdd",
    commentId,
    snippet: snippetOf(trimmed),
  });
  // Refresh badge counts in layout (e.g. comment counts on cards).
  revalidatePath("/app", "layout");
  return getCommentsForTask(taskId);
}

export async function removeCommentAction(
  commentId: string,
): Promise<Comment[]> {
  // Look up taskId before delete so we can return the updated thread.
  const [row] = await db
    .select({ taskId: comments.taskId })
    .from(comments)
    .where(eq(comments.id, commentId));
  if (!row) return [];

  await db.delete(comments).where(eq(comments.id, commentId));
  await touchTask(row.taskId);
  await recordActivity(row.taskId, {
    kind: "commentRemove",
    commentId,
  });
  revalidatePath("/app", "layout");
  return getCommentsForTask(row.taskId);
}
