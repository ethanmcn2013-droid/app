import type { Task } from "@/lib/data";
import type { ResourceRow } from "@/server/actions/resources";
import type { ConversationResult } from "@/lib/conversations/contracts";
import type { TaskConversationSurface } from "@/server/conversations/task-history-loader";

type Section = "subtasks" | "resources" | "conversation";

async function readSection<T>(section: Section, taskId: string): Promise<T> {
  const response = await fetch("/api/tasks/detail-read", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, taskId }),
  });
  if (!response.ok) throw new Error("Task detail is unavailable.");
  const body = await response.json() as { value?: T };
  if (!Object.hasOwn(body, "value")) throw new Error("Task detail is unavailable.");
  return body.value as T;
}

const TASK_DATES = ["dueAt", "updatedAt", "archivedAt", "completedAt"] as const;

/** JSON preserves null/absence but requires explicit revival of Task dates. */
export function reviveTaskDates(row: Task): Task {
  const task = { ...row };
  for (const field of TASK_DATES) {
    if (!Object.hasOwn(task, field)) continue;
    const value = task[field];
    if (value === null || value === undefined) continue;
    if (typeof value !== "string") throw new Error("Invalid task date.");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid task date.");
    // Date fields have distinct optional/null unions in Task; the parsed
    // object has been checked field by field before restoring the type.
    Object.assign(task, { [field]: date });
  }
  return task;
}

export async function readSubtasks(taskId: string): Promise<Task[]> {
  const rows = await readSection<Task[]>("subtasks", taskId);
  if (!Array.isArray(rows)) throw new Error("Task detail is unavailable.");
  return rows.map(reviveTaskDates);
}

export function readTaskResources(taskId: string): Promise<ResourceRow[]> {
  return readSection<ResourceRow[]>("resources", taskId);
}

export function readTaskConversation(taskId: string): Promise<ConversationResult<TaskConversationSurface>> {
  return readSection<ConversationResult<TaskConversationSurface>>("conversation", taskId);
}
