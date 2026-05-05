"use client";

import {
  createContext,
  startTransition,
  useContext,
  useMemo,
  useReducer,
  useRef,
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
import {
  addTaskAction,
  moveTaskAction,
  removeTaskAction,
  toggleCompleteAction,
  updateTaskAction,
} from "@/server/actions/tasks";

function generateId(): string {
  // Persistence makes counter-collisions a real concern. Use a short
  // crypto-derived id; format `t-<8 hex>` keeps it readable and
  // matches the seed convention.
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `t-${raw.replace(/-/g, "").slice(0, 8)}`;
}

export type TasksDispatchers = {
  moveTask: (id: string, toLane: LaneId) => void;
  reorderTask: (id: string, toIndex: number) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  addTask: (input: {
    title: string;
    description?: string;
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

  // Track latest state so dispatchers can capture pre-mutation
  // snapshots for revert without becoming stale closures or being
  // recreated on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Run an optimistic action: dispatch locally for snappy UI, then
   *  reconcile with the server's authoritative result. Revert on
   *  failure. */
  function withServerSync(
    optimistic: () => void,
    server: () => Promise<Task[]>,
  ) {
    const prior = stateRef.current.tasks;
    optimistic();
    startTransition(async () => {
      try {
        const fresh = await server();
        dispatch({ type: "hydrate", tasks: fresh });
      } catch (err) {
        // Revert. Console-warn for dev visibility; toast UX arrives
        // when the toast primitive ships.
        // eslint-disable-next-line no-console
        console.warn("tasks: server action failed; reverting", err);
        dispatch({ type: "hydrate", tasks: prior });
      }
    });
  }

  // Stable dispatcher object. None of these read render-scoped
  // state, so the empty deps are correct.
  const dispatchers = useMemo<TasksDispatchers>(
    () => ({
      moveTask: (id, toLane) =>
        withServerSync(
          () => dispatch({ type: "move", id, toLane }),
          () => moveTaskAction(id, toLane),
        ),
      reorderTask: (id, toIndex) =>
        // No server action this cycle — local-only.
        dispatch({ type: "reorder", id, toIndex }),
      updateTask: (id, patch) =>
        withServerSync(
          () => dispatch({ type: "update", id, patch }),
          () => updateTaskAction(id, patch),
        ),
      addTask: (input) => {
        const task: Task = {
          id: generateId(),
          title: input.title,
          description: input.description,
          lane: input.lane ?? "todo",
          priority: input.priority ?? "p2",
          assignees: input.assignees ?? [],
          estimate: input.estimate,
          due: input.due,
          tags: input.tags,
        };
        withServerSync(
          () => dispatch({ type: "add", task }),
          () => addTaskAction({ ...input, id: task.id }),
        );
        return task;
      },
      removeTask: (id) =>
        withServerSync(
          () => dispatch({ type: "remove", id }),
          () => removeTaskAction(id),
        ),
      toggleComplete: (id) =>
        withServerSync(
          () => dispatch({ type: "toggleComplete", id }),
          () => toggleCompleteAction(id),
        ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
