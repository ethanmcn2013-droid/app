import type { PublicTask, Task } from "./data";

/**
 * Explicit allowlist for every unauthenticated task response. Keep this
 * field-by-field so adding a private column to Task cannot silently publish
 * it through `/p`, `/embed`, or `/share`.
 */
export function toPublicTask(task: Task): PublicTask {
  const out: PublicTask = {
    id: task.id,
    title: task.title,
    lane: task.lane,
    priority: task.priority,
  };
  if (task.due != null) out.due = task.due;
  if (task.tags && task.tags.length > 0) out.tags = [...task.tags];
  return out;
}
