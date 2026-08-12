"use server";

import "server-only";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { scopeForTask } from "@/server/actions/project-authz";
import { emitTasksChanged } from "@/server/events";
import { isDemoMode } from "@/lib/access-mode";

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
  if (isDemoMode()) return { ok: true };
  // The bar being dragged belongs to a task, and that task's Project decides
  // — ADR 0001 §9, object operation. Under the old cookie scoping this action
  // was the clearest instance of the silent-refusal class in the inventory: it
  // returns `{ ok: true }` unconditionally, so a drag against a Project other
  // than the cookie's reported success and moved nothing.
  const me = await getCurrentUser();
  const scope = await scopeForTask(taskId, me);
  if (!scope.ok) return { ok: true }; // neutral: refused and unknown look alike
  const ws = scope.ws;

  // Re-read under the proved Project so a row that moved between the proof
  // and the write is refused rather than dragged.
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

  // The update carries the proved Project too. It previously matched on the
  // primary key alone and leaned entirely on the pre-read above, so any future
  // edit that dropped or reordered that read would have turned this into an
  // unscoped write.
  await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { ok: true };
}
