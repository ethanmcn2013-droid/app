import type { LaneId, Priority, Recurrence, UserId } from "@/lib/data";
import { isTaskDone } from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";

export type TaskDuplicationChoices = Readonly<{
  copyReusableTasks: boolean;
  copyTimelineStructure: boolean;
}>;

export type DuplicableTask = Readonly<{
  id: string;
  title: string;
  description: string | null;
  lane: LaneId;
  priority: Priority;
  assignees: UserId[];
  due: string | null;
  dueAt: Date | null;
  estimate: number | null;
  tags: string[] | null;
  recurrence: Recurrence | null;
  startDay: number | null;
  durationDays: number | null;
  position: number | null;
  parentTaskId: string | null;
  boardColumnKey: string | null;
  isMilestone: boolean;
}>;

export type DuplicatedTaskValues = Omit<DuplicableTask, "id"> & Readonly<{
  id: string;
  sourceId: string;
}>;

/**
 * Strict duplication allowlist. The input type has no public token,
 * invitation, history, attachment, contact, money, or Notes provenance field.
 */
export function planDuplicatedTasks(
  sourceTasks: readonly DuplicableTask[],
  choices: TaskDuplicationChoices,
  copiedMemberIds: ReadonlySet<string>,
  createId: () => string,
  /** Threaded from the caller's readWorkspaceColumnConfig (T·122); defaults
   *  to null (["done"]) for callers that haven't wired it. */
  columnConfig: ColumnConfig | null = null,
): readonly DuplicatedTaskValues[] {
  const copyable = sourceTasks.filter((task) =>
    task.isMilestone
      ? choices.copyTimelineStructure
      : choices.copyReusableTasks,
  );
  const ids = new Map(copyable.map((task) => [task.id, createId()]));
  return copyable.map((task) => ({
    sourceId: task.id,
    id: ids.get(task.id)!,
    title: task.title,
    description: task.description,
    lane: isTaskDone(task, columnConfig) ? "todo" : task.lane,
    priority: task.priority,
    assignees: task.assignees.filter((assignee) => copiedMemberIds.has(assignee)),
    due: task.due,
    dueAt: task.dueAt,
    estimate: task.estimate,
    tags: task.tags,
    recurrence: task.recurrence,
    startDay: task.startDay,
    durationDays: task.durationDays,
    position: task.position,
    parentTaskId: task.parentTaskId
      ? ids.get(task.parentTaskId) ?? null
      : null,
    boardColumnKey: task.boardColumnKey,
    isMilestone: choices.copyTimelineStructure && task.isMilestone,
  }));
}
