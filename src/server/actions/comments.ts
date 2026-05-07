"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { comments, tasks } from "@/server/db/schema";
import { getCommentsForTask } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { notify } from "@/server/db/notifications";
import { emitTasksChanged } from "@/server/events";
import { getCurrentUser } from "@/server/auth";
import { USERS, type Comment, type UserId } from "@/lib/data";

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

const VALID_USER_IDS = new Set<UserId>(Object.keys(USERS) as UserId[]);

/** Parse @<userId> tokens out of a comment body. Case-insensitive on
 *  the user id but only matches against the canonical UserId set so
 *  random "@stuff" doesn't fire spurious notifications. */
function extractMentions(body: string): UserId[] {
  const found = new Set<UserId>();
  for (const match of body.matchAll(/@([a-z]+)/gi)) {
    const candidate = match[1].toLowerCase() as UserId;
    if (VALID_USER_IDS.has(candidate)) found.add(candidate);
  }
  return Array.from(found);
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

  const me = await getCurrentUser();
  // Inherit workspace from the parent task — comments don't carry an
  // independent boundary; they're scoped to whichever workspace owns
  // the task.
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent) return getCommentsForTask(taskId);

  const commentId = newCommentId();
  await db.insert(comments).values({
    id: commentId,
    workspaceId: parent.workspaceId,
    taskId,
    userId: me,
    body: trimmed,
    createdAt: new Date(),
  });
  await touchTask(taskId);
  await recordActivity(taskId, {
    kind: "commentAdd",
    commentId,
    snippet: snippetOf(trimmed),
  });

  // Anti-notification policy: ONLY direct @mentions create instant
  // inbox items. Plain comments produce no notification — they live
  // in the conversation feed and surface in the daily digest only if
  // the recipient was tagged.
  const mentions = extractMentions(trimmed);
  if (mentions.length > 0) {
    const [taskRow] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    const taskTitle = taskRow?.title ?? "(deleted task)";
    await Promise.all(
      mentions.map((u) =>
        notify(u, {
          kind: "mention",
          commentId,
          taskId,
          snippet: snippetOf(trimmed),
          from: me,
          taskTitle,
        }),
      ),
    );
  }

  // Refresh badge counts in layout (e.g. comment counts on cards).
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "comments" });
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
  emitTasksChanged({ kind: "comments" });
  return getCommentsForTask(row.taskId);
}
