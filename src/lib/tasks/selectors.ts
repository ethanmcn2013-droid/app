import { LANE_ORDER, type LaneId, type Task, type UserId } from "@/lib/data";
import type { TasksState } from "./tasks-reducer";

export function tasksByLane(
  state: TasksState,
  lane: LaneId,
): Task[] {
  return state.tasks.filter((t) => t.lane === lane);
}

/**
 * Return tasks for a board column identified by `columnKey`.
 *
 * System column (todo/doing/review/done):
 *   Tasks whose `lane === columnKey` AND whose `boardColumnKey` is null/empty.
 *   Rationale: a task with a non-null `boardColumnKey` is "claimed" by its
 *   custom column — it should not double-appear in the system lane column on
 *   the board even though `lane` still carries its canonical semantic value.
 *
 * Custom column (key starts with "col-"):
 *   Tasks whose `boardColumnKey === columnKey`.
 *   The task's `lane` is ignored for board rendering; it stays canonical for
 *   List/Timeline/Calendar/export/print/SSE (those views never read boardColumnKey).
 *
 * This is the single place that encodes the COALESCE(boardColumnKey, lane)
 * logic for the board — board-app.tsx delegates entirely to this function.
 */
export function tasksByColumn(
  state: TasksState,
  columnKey: string,
): Task[] {
  const isSystemLane = (LANE_ORDER as string[]).includes(columnKey);
  if (isSystemLane) {
    // System lane: include only tasks that are NOT assigned to a custom column.
    return state.tasks.filter(
      (t) => t.lane === (columnKey as LaneId) && !t.boardColumnKey,
    );
  }
  // Custom column: tasks explicitly assigned here via boardColumnKey.
  return state.tasks.filter((t) => t.boardColumnKey === columnKey);
}

export function groupTasksByLane(tasks: Task[]): Record<LaneId, Task[]> {
  const groups: Record<LaneId, Task[]> = {
    todo: [],
    doing: [],
    review: [],
    done: [],
  };
  for (const t of tasks) groups[t.lane].push(t);
  return groups;
}

export function groupByLane(state: TasksState): Record<LaneId, Task[]> {
  return groupTasksByLane(state.tasks);
}

/** Tasks NOT in done. Convenience for sidebar inbox-style badges.
 *  Pass `{ user }` to scope to tasks where the given user is an
 *  assignee (used by the "My tasks" badge). */
export function openTaskCount(
  state: TasksState,
  opts?: { user?: UserId },
): number {
  const user = opts?.user;
  return state.tasks.reduce((n, t) => {
    if (t.lane === "done") return n;
    if (user && !t.assignees.includes(user)) return n;
    return n + 1;
  }, 0);
}

export function tasksSortedByStartDay(state: TasksState): Task[] {
  return [...state.tasks].sort(
    (a, b) => (a.startDay ?? 0) - (b.startDay ?? 0),
  );
}

export function laneOrder(): LaneId[] {
  return LANE_ORDER;
}
