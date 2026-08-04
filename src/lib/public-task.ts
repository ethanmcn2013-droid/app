import type { PublicTask, Task } from "./data";

/**
 * Explicit allowlist for every unauthenticated task response. Keep this
 * field-by-field so adding a private column to Task cannot silently publish
 * it through `/p`, `/embed`, or `/share`.
 *
 * `now` is optional: callers that pass the serving instant get a derived
 * `overdue` flag (never the timestamp itself), so a shared board can keep
 * the "this is late" signal the internal board shows. Callers that omit it
 * keep the historical shape exactly.
 */
export function toPublicTask(task: Task, now?: Date): PublicTask {
  const out: PublicTask = {
    id: task.id,
    title: task.title,
    lane: task.lane,
    priority: task.priority,
  };
  if (task.due != null) out.due = task.due;
  // The column claim is public by design: without it a guest surface
  // cannot group by the operator's custom columns (T·121).
  if (task.boardColumnKey) out.boardColumnKey = task.boardColumnKey;
  if (task.tags && task.tags.length > 0) out.tags = [...task.tags];
  if (
    now &&
    task.dueAt &&
    task.lane !== "done" &&
    task.dueAt.getTime() < now.getTime()
  ) {
    out.overdue = true;
  }
  return out;
}
