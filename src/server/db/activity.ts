import "server-only";

import { eq } from "drizzle-orm";
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
 * Activity is observability, not transactional — failures here are
 * caught and logged so the parent action's user-facing mutation
 * still completes successfully.
 */
export async function recordActivity(
  taskId: string,
  payload: ActivityPayload,
  opts?: { userId?: UserId },
): Promise<void> {
  try {
    // Inherit workspace from the parent task. If the task has been
    // deleted in a race, fall through silently — activity logging
    // is observability, not transactional.
    const [parent] = await db
      .select({ workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    if (!parent) return;
    await db.insert(activities).values({
      id: newActivityId(),
      workspaceId: parent.workspaceId,
      taskId,
      userId: opts?.userId ?? (await getCurrentUser()),
      kind: payload.kind,
      payload,
      createdAt: new Date(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("activity: record failed", err);
  }
}
