export type CompletionSnapshot = { projectId: string; tasks: readonly { id: string; done: boolean }[] };

/** Loading a completed project, changing projects, deleting its last open
 * task, or changing the column configuration is not a completion event. */
export function justCompletedProject(before: CompletionSnapshot | null, after: CompletionSnapshot): boolean {
  if (!before || before.projectId !== after.projectId || after.tasks.length === 0 || before.tasks.length !== after.tasks.length) return false;
  const previous = new Map(before.tasks.map((task) => [task.id, task.done]));
  return before.tasks.some((task) => !task.done) && after.tasks.every((task) => task.done && previous.has(task.id));
}
