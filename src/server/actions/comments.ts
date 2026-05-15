"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { comments, tasks } from "@/server/db/schema";
import { getCommentsForTask } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { notify } from "@/server/db/notifications";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
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

/** Confirm the calling user is a member of the workspace that owns
 *  this task. Returns the workspace id when allowed, null when the
 *  task doesn't exist OR lives in a workspace the caller isn't in.
 *  Both comment read and write paths route through here — comments
 *  inherit the task's workspace boundary; callers outside that
 *  boundary must not see or write the thread. */
async function resolveCallerTaskWorkspace(
  taskId: string,
): Promise<string | null> {
  const ws = await getActiveWorkspace();
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  return parent?.workspaceId ?? null;
}

export async function getCommentsForTaskAction(
  taskId: string,
): Promise<Comment[]> {
  // Cross-tenant read guard: only return the thread if the caller's
  // active workspace owns the parent task. Strangers asking for a
  // foreign task id get an empty list, indistinguishable from a task
  // that has no comments yet.
  const ws = await resolveCallerTaskWorkspace(taskId);
  if (!ws) return [];
  return getCommentsForTask(taskId);
}

export async function addCommentAction(
  taskId: string,
  body: string,
): Promise<Comment[]> {
  const trimmed = body.trim();
  if (!trimmed) return [];

  const me = await getCurrentUser();
  // Workspace-membership guard: the parent task must belong to the
  // caller's active workspace. Without this, any authed user who
  // knows a foreign task id could insert comments into other
  // tenants' threads.
  const workspaceId = await resolveCallerTaskWorkspace(taskId);
  if (!workspaceId) return [];

  const commentId = newCommentId();
  await db.insert(comments).values({
    id: commentId,
    workspaceId,
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
  // Scope the delete to (active workspace, author === caller). The
  // workspace join via the parent task closes the cross-tenant hole
  // (you can't delete comments on tasks outside your workspace); the
  // userId match keeps members from deleting each other's comments.
  const [me, ws] = await Promise.all([getCurrentUser(), getActiveWorkspace()]);

  const [row] = await db
    .select({ taskId: comments.taskId })
    .from(comments)
    .innerJoin(tasks, eq(tasks.id, comments.taskId))
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.userId, me),
        eq(tasks.workspaceId, ws),
      ),
    );
  if (!row) return [];

  await db
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, me)));
  await touchTask(row.taskId);
  await recordActivity(row.taskId, {
    kind: "commentRemove",
    commentId,
  });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "comments" });
  return getCommentsForTask(row.taskId);
}
