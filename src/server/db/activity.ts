import "server-only";

import { and, eq } from "drizzle-orm";
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
  opts: { workspaceId: string; userId?: UserId },
): Promise<void> {
  try {
    // The caller's already-authorized workspace is part of the write
    // contract. Never infer it from taskId: a caller who knows a foreign
    // task id must not be able to create an activity row in that tenant.
    if (!opts.workspaceId) return;
    const [parent] = await db
      .select({ workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.workspaceId, opts.workspaceId),
        ),
      );
    if (!parent) return;
    await db.insert(activities).values({
      id: newActivityId(),
      workspaceId: opts.workspaceId,
      taskId,
      userId: opts?.userId ?? (await getCurrentUser()),
      kind: payload.kind,
      payload,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn("activity: record failed", err);
  }
}
