// Plain serialisable DTO for passing a Task across the server/client
// boundary — Dates become ISO strings. No "use client" directive: the
// server page calls taskToPlain, the client view calls plainToTask.

import type { Task } from "@/lib/data";

export type TaskPlain = Omit<Task, "updatedAt" | "dueAt"> & {
  updatedAt: string;
  dueAt: string | null;
};

export function taskToPlain(task: Task): TaskPlain {
  return {
    ...task,
    updatedAt: task.updatedAt.toISOString(),
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
  };
}

export function plainToTask(plain: TaskPlain): Task {
  return {
    ...plain,
    updatedAt: new Date(plain.updatedAt),
    dueAt: plain.dueAt ? new Date(plain.dueAt) : undefined,
  };
}
