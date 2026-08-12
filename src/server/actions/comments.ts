"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { comments, tasks } from "@/server/db/schema";
import { getCommentsForTask } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { notify } from "@/server/db/notifications";
import { emitTasksChanged } from "@/server/events";
import { getCurrentUser } from "@/server/auth";
import {
  scopeForTask,
  type ProjectCapabilityKey,
} from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";
import { USERS, type Comment, type UserId } from "@/lib/data";
import { DEMO_USER_ID } from "@/server/demo/tasks-demo";

function snippetOf(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 60).trimEnd() + "…";
}

/** Touch the parent task's updatedAt so comments count as engagement
 *  and the panel's "edited X ago" stamp reflects activity.
 *
 *  Takes the proved Project so the write carries it too. It previously
 *  matched on the primary key alone, which was safe only for as long as
 *  every caller happened to authorize first. */
async function touchTask(taskId: string, workspaceId: string) {
  await db
    .update(tasks)
    .set({ updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)));
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

/** Confirm the calling user may act on the Project that owns this task.
 *  Returns that Project's id when allowed, null when the task doesn't exist
 *  OR the caller holds no such capability in its Project. Both comment read
 *  and write paths route through here: comments inherit the task's Project
 *  boundary, and callers outside that boundary must not see or write the
 *  thread.
 *
 *  The name is unchanged and so is the contract. What changed is where the
 *  Project comes from. It used to be the ambient cookie, and the parent-task
 *  read then AND-ed the two together — so a comment on a task in any Project
 *  other than the cookie's returned null, and the write above it returned an
 *  empty array that the composer showed as "posted, then gone". The task's own
 *  Project decides now (ADR 0001 §9, object operation). */
async function resolveCallerTaskWorkspace(
  taskId: string,
  capability: ProjectCapabilityKey,
): Promise<string | null> {
  const me = await getCurrentUser();
  const scope = await scopeForTask(taskId, me, capability);
  return scope.ok ? scope.ws : null;
}

export async function getCommentsForTaskAction(
  taskId: string,
): Promise<Comment[]> {
  if (isDemoMode()) return [];
  // Cross-tenant read guard: only return the thread if the caller's
  // active workspace owns the parent task. Strangers asking for a
  // foreign task id get an empty list, indistinguishable from a task
  // that has no comments yet.
  const ws = await resolveCallerTaskWorkspace(taskId, "open");
  if (!ws) return [];
  return getCommentsForTask(taskId);
}

export async function addCommentAction(
  taskId: string,
  body: string,
): Promise<Comment[]> {
  const trimmed = body.trim();
  if (!trimmed) return [];

  // Demo/review is intentionally read-only. Echo the submitted copy back to
  // the optimistic composer so the review interaction completes without
  // authenticating, reading a tenant, or persisting anything.
  if (isDemoMode()) {
    return [
      {
        id: `demo-comment-${taskId}`,
        taskId,
        userId: DEMO_USER_ID,
        authorName: USERS[DEMO_USER_ID].name,
        body: trimmed,
        createdAt: new Date(),
      },
    ];
  }

  const me = await getCurrentUser();
  // Workspace-membership guard: the parent task must belong to the
  // caller's active workspace. Without this, any authed user who
  // knows a foreign task id could insert comments into other
  // tenants' threads.
  const workspaceId = await resolveCallerTaskWorkspace(
    taskId,
    "createOrEditTasks",
  );
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
  await touchTask(taskId, workspaceId);
  await recordActivity(taskId, {
    kind: "commentAdd",
    commentId,
    snippet: snippetOf(trimmed),
  }, { workspaceId });

  // Anti-notification policy: ONLY direct @mentions create instant
  // inbox items. Plain comments produce no notification, they live
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
  if (isDemoMode()) return [];
  // Scope the delete to (active workspace, author === caller). The
  // workspace join via the parent task closes the cross-tenant hole
  // (you can't delete comments on tasks outside your workspace); the
  // userId match keeps members from deleting each other's comments.
  const me = await getCurrentUser();

  // Authorship first, and by primary key. isolation-ok: no tenant predicate
  // here on purpose — this read only discovers which task the comment hangs
  // off, so that the task's own Project can be proved on the next line. The
  // author match is the caller's own id, so this cannot read a stranger's row.
  const [row] = await db
    .select({ taskId: comments.taskId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, me)));
  if (!row) return [];

  // Then the Project proof, against the parent task's stored Project rather
  // than the cookie's.
  const scope = await scopeForTask(row.taskId, me);
  if (!scope.ok) return [];
  const ws = scope.ws;

  await db
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, me)));
  await touchTask(row.taskId, ws);
  await recordActivity(row.taskId, {
    kind: "commentRemove",
    commentId,
  }, { workspaceId: ws });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "comments" });
  return getCommentsForTask(row.taskId);
}
