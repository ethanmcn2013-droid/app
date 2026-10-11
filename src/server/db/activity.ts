import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { activities, tasks } from "./schema";
import { getCurrentUser } from "@/server/auth";
import { type ActivityPayload, type UserId } from "@/lib/data";

function newActivityId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `a-${raw.replace(/-/g, "").slice(0, 8)}`;
}

/**
 * Record an activity row as a side-effect of a server action.
 *
 * Activity is observability, not transactional, failures here are
 * caught and logged so the parent action's user-facing mutation
 * still completes successfully.
 */
export async function recordActivity(
  taskId: string,
  payload: ActivityPayload,
  opts: { workspaceId: string; userId?: UserId; executor?: Pick<typeof db, "run" | "select" | "insert"> },
): Promise<void> {
  try {
    const executor = opts.executor ?? db;
    // The caller's already-authorized workspace is part of the write
    // contract. Never infer it from taskId: a caller who knows a foreign
    // task id must not be able to create an activity row in that tenant.
    if (!opts.workspaceId) return;
    if (opts.userId != null) {
      // The actor is already resolved by the action. Keep the parent scope
      // guard in the same statement as the write, so a moved or removed task
      // cannot acquire an activity row between a separate read and insert.
      await executor.run(sql`INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload, created_at)
        SELECT ${newActivityId()}, ${opts.workspaceId}, ${tasks.id}, ${opts.userId},
          ${payload.kind}, ${JSON.stringify(payload)}, ${Math.floor(Date.now() / 1000)}
        FROM ${tasks}
        WHERE ${and(eq(tasks.id, taskId), eq(tasks.workspaceId, opts.workspaceId))}`);
      return;
    }
    const [parent] = await executor
      .select({ workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.workspaceId, opts.workspaceId),
        ),
      );
    if (!parent) return;
    await executor.insert(activities).values({
      id: newActivityId(),
      workspaceId: opts.workspaceId,
      taskId,
      userId: opts?.userId ?? (await getCurrentUser()),
      kind: payload.kind,
      payload,
      createdAt: new Date(),
    });
  } catch {
    // A failed Drizzle statement can include bound private Task values in its
    // error. Activity is best-effort, so log only the fixed failure category.
    console.warn("activity: record failed");
  }
}
