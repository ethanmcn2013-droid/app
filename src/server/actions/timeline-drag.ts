"use server";

import "server-only";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getActiveWorkspace } from "@/server/auth";
import { emitTasksChanged } from "@/server/events";

/**
 * Bounds for the timeline grid. The view renders a 14-day window today,
 * but we allow up to 30 to give the bar headroom for future grid widths
 * without re-deploying the action. `MIN_DURATION = 1` enforces that a
 * bar always covers at least one day cell.
 */
const MIN_START = 0;
const MAX_START = 30;
const MIN_DURATION = 1;
const MAX_DURATION = 30;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const int = Math.round(value);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

/**
 * Persist a timeline-bar drag. Accepts either or both of `startDay` and
 * `durationDays` so the whole-bar drag and the right-edge resize can
 * share a single endpoint without sending the field they didn't change.
 *
 * Inputs are clamped server-side ([0, 30] for start, [1, 30] for
 * duration) and rounded to integers, the grid is day-aligned, so any
 * mid-day position from a noisy mousemove gets snapped here as a final
 * guardrail behind the client's own snap.
 */
export async function setTaskTimelineAction(
  taskId: string,
  input: { startDay?: number; durationDays?: number },
): Promise<{ ok: true }> {
  const ws = await getActiveWorkspace();

  // Verify the task belongs to the active workspace before mutating.
  // A miss is silently a no-op so a stale client tab can't leak across
  // tenants by replaying an id from a previous session.
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  if (!row) return { ok: true };

  const patch: Record<string, unknown> = {};
  if (input.startDay !== undefined) {
    patch.startDay = clampInt(input.startDay, MIN_START, MAX_START);
  }
  if (input.durationDays !== undefined) {
    patch.durationDays = clampInt(
      input.durationDays,
      MIN_DURATION,
      MAX_DURATION,
    );
  }

  // Nothing to write, bail without touching `updatedAt` so a no-op
  // drag doesn't churn the activity feed or sort order.
  if (Object.keys(patch).length === 0) return { ok: true };

  patch.updatedAt = new Date();

  await db.update(tasks).set(patch).where(eq(tasks.id, taskId));

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { ok: true };
}
