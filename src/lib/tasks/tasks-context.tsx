"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  SEED_TASKS,
  type LaneId,
  type Priority,
  type Task,
  type UserId,
} from "@/lib/data";
import { tasksReducer, type TasksState } from "./tasks-reducer";

/** Module-scoped counter for new task ids. Seed ids are 100-499 so
 *  500+ avoids collision. Resets per page load (no persistence yet).
 *  Note: HMR re-runs this file → the counter resets to 500 while
 *  retained state still holds higher ids. The reducer's `add` action
 *  rejects duplicate ids, so the worst case during dev is a silent
 *  dropped add. Cycle 4 swaps to crypto.randomUUID() with persistence. */
let nextId = 500;
function generateId(): string {
  return `t-${nextId++}`;
}

export type TasksDispatchers = {
  moveTask: (id: string, toLane: LaneId) => void;
  reorderTask: (id: string, toIndex: number) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  addTask: (input: {
    title: string;
    lane?: LaneId;
    priority?: Priority;
    assignees?: UserId[];
    estimate?: number;
    due?: string;
    tags?: string[];
  }) => Task;
  removeTask: (id: string) => void;
  toggleComplete: (id: string) => void;
};

const TasksStateContext = createContext<TasksState | null>(null);
const TasksDispatchContext = createContext<TasksDispatchers | null>(null);

export function TasksProvider({
  children,
  initialTasks,
  initialPreviousLane,
}: {
  children: ReactNode;
  initialTasks?: Task[];
  initialPreviousLane?: Record<string, LaneId>;
}) {
  const [state, dispatch] = useReducer(tasksReducer, {
    tasks: (initialTasks ?? SEED_TASKS).map((t) => ({ ...t })),
    previousLane: initialPreviousLane ?? {},
  });

  // Stable dispatcher object — only changes when `dispatch` identity
  // changes, which is never. Wrapping in useMemo keeps Context value
  // identity stable so dispatch-only consumers don't re-render.
  const dispatchers = useMemo<TasksDispatchers>(
    () => ({
      moveTask: (id, toLane) => dispatch({ type: "move", id, toLane }),
      reorderTask: (id, toIndex) =>
        dispatch({ type: "reorder", id, toIndex }),
      updateTask: (id, patch) => dispatch({ type: "update", id, patch }),
      addTask: (input) => {
        const task: Task = {
          id: generateId(),
          title: input.title,
          lane: input.lane ?? "todo",
          priority: input.priority ?? "p2",
          assignees: input.assignees ?? [],
          estimate: input.estimate,
          due: input.due,
          tags: input.tags,
        };
        dispatch({ type: "add", task });
        return task;
      },
      removeTask: (id) => dispatch({ type: "remove", id }),
      toggleComplete: (id) => dispatch({ type: "toggleComplete", id }),
    }),
    [],
  );

  return (
    <TasksStateContext.Provider value={state}>
      <TasksDispatchContext.Provider value={dispatchers}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksStateContext.Provider>
  );
}

export function useTasksState(): TasksState {
  const ctx = useContext(TasksStateContext);
  if (!ctx) {
    throw new Error(
      "useTasksState must be used within <TasksProvider>",
    );
  }
  return ctx;
}

export function useTasksDispatch(): TasksDispatchers {
  const ctx = useContext(TasksDispatchContext);
  if (!ctx) {
    throw new Error(
      "useTasksDispatch must be used within <TasksProvider>",
    );
  }
  return ctx;
}

/** Convenience combiner for callers that need both. */
export function useTasks() {
  return {
    state: useTasksState(),
    ...useTasksDispatch(),
  };
}

// Test-only export — lets jest/playwright reset the id counter.
export function __resetIdCounterForTests(start = 500) {
  nextId = start;
}
