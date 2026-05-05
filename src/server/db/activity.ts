import "server-only";

import { db } from "./index";
import { activities } from "./schema";
import {
  CURRENT_USER,
  type ActivityPayload,
  type UserId,
} from "@/lib/data";

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
    await db.insert(activities).values({
      id: newActivityId(),
      taskId,
      userId: opts?.userId ?? CURRENT_USER,
      kind: payload.kind,
      payload,
      createdAt: new Date(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("activity: record failed", err);
  }
}
