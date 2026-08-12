"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getCurrentUser } from "@/server/auth";
import { scopeForTask } from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";
import { demoTasks } from "@/server/demo/tasks-demo";
import type { Task } from "@/lib/data";

/**
 * Reparent a task within the active workspace.
 *
 * Guards:
 *   - Demo mode exits before any tenant or DB access.
 *   - The task being reparented must belong to the caller's active workspace.
 *   - When newParentId is set: the target parent must exist in the same
 *     workspace, be a top-level task (parent_task_id IS NULL), and not be
 *     the task itself. A missing or cross-workspace parent is a clean error
 *     return rather than a throw so the UI can show a toast without crashing.
 *   - The DB trigger (0010_parent_workspace_invariant.sql) also enforces the
 *     same invariant; trigger RAISE(ABORT) is translated into the same clean
 *     error shape so the caller never sees a raw libSQL exception.
 *
 * On success: updates parent_task_id, appends the child at the end of the
 * parent's subtask list (last-write-wins position), records a parentChanged
 * activity row, revalidates, and broadcasts SSE.
 */
export async function setParentAction(
  taskId: string,
  newParentId: string | null,
): Promise<{ ok: true; tasks: Task[] } | { ok: false; error: string }> {
  if (isDemoMode()) return { ok: true, tasks: demoTasks() };
  // ADR 0001 §9, object operation: the task being reparented already belongs
  // to a Project, and that Project decides. Everything below stays scoped to
  // the proved id, so the same-Project invariant this action exists to protect
  // — a child may only be reparented under a top-level task in its own
  // Project — is now checked against the child's real Project rather than
  // against whichever one the cookie happened to name.
  const me = await getCurrentUser();
  const scope = await scopeForTask(taskId, me);
  if (!scope.ok) {
    return { ok: false, error: "setParentAction: task not found in active workspace" };
  }
  const ws = scope.ws;

  // Re-read under the proved Project and capture the current parent.
  const [ownedTask] = await db
    .select({ id: tasks.id, parentTaskId: tasks.parentTaskId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  if (!ownedTask) {
    return { ok: false, error: "setParentAction: task not found in active workspace" };
  }

  // Cannot reparent a task to itself.
  if (newParentId === taskId) {
    return { ok: false, error: "setParentAction: a task cannot be its own parent" };
  }

  const previousParentId = ownedTask.parentTaskId ?? null;

  if (newParentId !== null) {
    // Re-read target parent inside the action to close the reparent-vs-delete
    // race: if the parent was deleted between the UI read and this write, we
    // return a clean error rather than inserting an orphan.
    const [targetParent] = await db
      .select({ id: tasks.id, workspaceId: tasks.workspaceId, parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, newParentId),
          eq(tasks.workspaceId, ws),
          isNull(tasks.parentTaskId),
        ),
      );

    if (!targetParent) {
      return {
        ok: false,
        error:
          "setParentAction: parent task not found, is not top-level, or belongs to a different workspace",
      };
    }

    // Compute the end-of-parent-subtask position so the reparented child
    // lands last in its new parent's list without renumbering siblings.
    const [posRow] = await db
      .select({ max: sql<number | null>`MAX(${tasks.position})` })
      .from(tasks)
      .where(and(eq(tasks.parentTaskId, newParentId), eq(tasks.workspaceId, ws)));
    const newPosition = (posRow?.max ?? 0) + 1.0;

    try {
      await db
        .update(tasks)
        .set({ parentTaskId: newParentId, position: newPosition })
        .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
    } catch (err) {
      // Translate DB trigger RAISE(ABORT, 'parent task must be a top-level
      // task in the same workspace') into the same clean error shape the
      // application layer uses (mirrors tasks.ts:406-410 pattern).
      const message =
        err instanceof Error ? err.message : "unknown database error";
      if (message.includes("parent task must be a top-level task")) {
        return {
          ok: false,
          error: "setParentAction: parent task is not in the active workspace",
        };
      }
      throw err;
    }
  } else {
    // Clearing the parent: promote the task to top-level.
    await db
      .update(tasks)
      .set({ parentTaskId: null })
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  }

  await recordActivity(
    taskId,
    { kind: "parentChanged", from: previousParentId, to: newParentId },
    { workspaceId: ws },
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { ok: true, tasks: await getTasks(ws) };
}
