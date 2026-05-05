import { LANE_ORDER, type LaneId, type Task, type UserId } from "@/lib/data";
import type { TasksState } from "./tasks-reducer";

export function tasksByLane(
  state: TasksState,
  lane: LaneId,
): Task[] {
  return state.tasks.filter((t) => t.lane === lane);
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
