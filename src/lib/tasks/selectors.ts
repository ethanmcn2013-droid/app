import { LANE_ORDER, type LaneId, type Task } from "@/lib/data";
import type { TasksState } from "./tasks-reducer";

export function tasksByLane(
  state: TasksState,
  lane: LaneId,
): Task[] {
  return state.tasks.filter((t) => t.lane === lane);
}

export function groupByLane(state: TasksState): Record<LaneId, Task[]> {
  const groups: Record<LaneId, Task[]> = {
    todo: [],
    doing: [],
    review: [],
    done: [],
  };
  for (const t of state.tasks) groups[t.lane].push(t);
  return groups;
}

/** Tasks NOT in done. Convenience for sidebar inbox-style badges. */
export function openTaskCount(state: TasksState): number {
  return state.tasks.reduce(
    (n, t) => (t.lane === "done" ? n : n + 1),
    0,
  );
}

export function tasksSortedByStartDay(state: TasksState): Task[] {
  return [...state.tasks].sort(
    (a, b) => (a.startDay ?? 0) - (b.startDay ?? 0),
  );
}

export function laneOrder(): LaneId[] {
  return LANE_ORDER;
}
