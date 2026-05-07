import type { LaneId, Task } from "@/lib/data";

export type TasksState = {
  tasks: Task[];
  /** Map of taskId → lane the task was in before its most recent
   *  toggle to "done". Lets `toggleComplete` un-check back to source. */
  previousLane: Record<string, LaneId>;
};

export type TasksAction =
  | { type: "move"; id: string; toLane: LaneId }
  | { type: "reorder"; id: string; toIndex: number }
  | {
      type: "place";
      id: string;
      toLane: LaneId;
      toIndex: number;
      position: number;
    }
  | { type: "update"; id: string; patch: Partial<Omit<Task, "id">> }
  | { type: "add"; task: Task }
  | { type: "remove"; id: string }
  | { type: "toggleComplete"; id: string }
  | { type: "hydrate"; tasks: Task[] };

export function initialTasksState(seed: Task[]): TasksState {
  return {
    tasks: seed.map((t) => ({ ...t })),
    previousLane: {},
  };
}

export function tasksReducer(
  state: TasksState,
  action: TasksAction,
): TasksState {
  switch (action.type) {
    case "move": {
      const idx = state.tasks.findIndex((t) => t.id === action.id);
      if (idx < 0) return state;
      const t = state.tasks[idx];
      if (t.lane === action.toLane) return state; // identity-equal no-op
      const tasks = state.tasks.slice();
      tasks[idx] = {
        ...t,
        lane: action.toLane,
        idleDays: undefined,
        updatedAt: new Date(),
      };
      // Any direct move clears a stale previousLane entry — the user
      // is taking explicit control, so the toggle source is invalidated.
      const previousLane = { ...state.previousLane };
      delete previousLane[action.id];
      return { tasks, previousLane };
    }

    case "reorder": {
      const fromIdx = state.tasks.findIndex((t) => t.id === action.id);
      if (fromIdx < 0) return state;
      const lane = state.tasks[fromIdx].lane;
      const sameLane = state.tasks.filter((t) => t.lane === lane);
      const localIdx = sameLane.findIndex((t) => t.id === action.id);
      const targetLocalIdx = Math.max(
        0,
        Math.min(action.toIndex, sameLane.length - 1),
      );
      if (localIdx === targetLocalIdx) return state;

      // Rebuild keeping non-lane tasks in their original positions
      // and replacing each lane-slot with the reordered sequence.
      const reordered = sameLane.slice();
      const [picked] = reordered.splice(localIdx, 1);
      reordered.splice(targetLocalIdx, 0, picked);

      const tasks: Task[] = [];
      let reorderedCursor = 0;
      for (const t of state.tasks) {
        if (t.lane === lane) {
          tasks.push(reordered[reorderedCursor++]);
        } else {
          tasks.push(t);
        }
      }
      return { ...state, tasks };
    }

    case "place": {
      // Cross-lane-aware placement: removes the task from wherever it
      // currently sits and inserts it at `toIndex` within `toLane`,
      // stamping the new lane + float position. This is the optimistic
      // counterpart to `reorderTaskAction` — the array order matches
      // what a fresh server hydrate (sorted by position) would produce.
      const fromIdx = state.tasks.findIndex((t) => t.id === action.id);
      if (fromIdx < 0) return state;
      const current = state.tasks[fromIdx];

      // Build the moved task with its new lane + position. Clearing
      // idleDays mirrors `move` — manual placement counts as activity.
      const moved: Task & { position?: number } = {
        ...current,
        lane: action.toLane,
        idleDays: undefined,
        updatedAt: new Date(),
        // position lives on the Task type once the backend lands; the
        // optional cast keeps this safe in the interim.
        position: action.position,
      } as Task & { position?: number };

      // Drop self out, then walk the remaining list and splice the
      // moved task into the toIndex-th slot of `toLane`.
      const without = state.tasks.filter((t) => t.id !== action.id);
      const laneSlots: number[] = [];
      without.forEach((t, i) => {
        if (t.lane === action.toLane) laneSlots.push(i);
      });
      const clamped = Math.max(
        0,
        Math.min(action.toIndex, laneSlots.length),
      );
      const insertAt =
        clamped < laneSlots.length
          ? laneSlots[clamped]
          : laneSlots.length > 0
            ? laneSlots[laneSlots.length - 1] + 1
            : without.length;
      const tasks = without.slice();
      tasks.splice(insertAt, 0, moved);

      // Manual placement is explicit user intent — invalidate any
      // toggleComplete restore-target memorized for this id.
      const previousLane = { ...state.previousLane };
      delete previousLane[action.id];
      return { tasks, previousLane };
    }

    case "update": {
      const idx = state.tasks.findIndex((t) => t.id === action.id);
      if (idx < 0) return state;
      const tasks = state.tasks.slice();
      tasks[idx] = {
        ...tasks[idx],
        ...action.patch,
        id: tasks[idx].id,
        updatedAt: new Date(),
      };
      return { ...state, tasks };
    }

    case "add": {
      // Refuse duplicate ids (defensive — id generator ensures uniqueness)
      if (state.tasks.some((t) => t.id === action.task.id)) return state;
      return { ...state, tasks: [...state.tasks, action.task] };
    }

    case "remove": {
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      const previousLane = { ...state.previousLane };
      delete previousLane[action.id];
      return {
        tasks: state.tasks.filter((t) => t.id !== action.id),
        previousLane,
      };
    }

    case "toggleComplete": {
      const idx = state.tasks.findIndex((t) => t.id === action.id);
      if (idx < 0) return state;
      const t = state.tasks[idx];
      const tasks = state.tasks.slice();

      if (t.lane === "done") {
        // Un-complete: restore previous lane (default todo).
        const restoreTo = state.previousLane[action.id] ?? "todo";
        tasks[idx] = { ...t, lane: restoreTo, updatedAt: new Date() };
        const previousLane = { ...state.previousLane };
        delete previousLane[action.id];
        return { tasks, previousLane };
      }

      // Mark done: remember where it came from so un-check returns it.
      tasks[idx] = {
        ...t,
        lane: "done",
        idleDays: undefined,
        updatedAt: new Date(),
      };
      return {
        tasks,
        previousLane: { ...state.previousLane, [action.id]: t.lane },
      };
    }

    case "hydrate": {
      // Server-truth replacement after a mutation round-trips. We
      // preserve the previousLane map (it's purely client UX state
      // for un-toggle-restores; server doesn't track it yet).
      return {
        tasks: action.tasks.map((t) => ({ ...t })),
        previousLane: state.previousLane,
      };
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
