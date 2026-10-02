import "server-only";

import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";

/** A resolved, no-effect refusal; transaction and post-write errors never become this. */
export class TaskMutationRefusedError extends Error {
  constructor() {
    super("Task mutation refused");
    this.name = "TaskMutationRefusedError";
  }
}

export function isTaskMutationRefused(error: unknown): boolean {
  return error instanceof TaskMutationRefusedError;
}

/** An optional restriction on the existing live proof, never a source of authority. */
export function taskMutationExpectedProject(value: unknown): ProjectId | undefined {
  if (value === undefined) return undefined;
  const project = typeof value === "string" ? parseProjectId(value) : null;
  if (!project) throw new TaskMutationRefusedError();
  return project;
}
