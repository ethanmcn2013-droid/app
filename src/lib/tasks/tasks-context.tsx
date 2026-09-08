"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  LANE_ORDER,
  SEED_TASKS,
  type LaneId,
  type Priority,
  type RecurrenceSpec,
  type Task,
  type UserId,
} from "@/lib/data";
import {
  tasksReducer,
  type TasksAction,
  type TasksState,
} from "./tasks-reducer";
import {
  addTaskAction,
  duplicateTaskAction,
  getTasksAction,
  moveTaskAction,
  removeTaskAction,
  reorderTaskAction,
  setTaskArchivedAction,
  setTaskMilestoneAction,
  toggleCompleteAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { moveTaskToColumnAction } from "@/server/actions/board";
import { isDemoMode } from "@/lib/access-mode";
import { setParentAction } from "@/server/actions/set-parent";
import { useRealtimeSync } from "./use-realtime-sync";
import { beginTaskSync } from "./delight-events";
import { maybeFireFirstCompletion } from "@/components/app/done-dopamine/first-completion-moment";

/** Gap-numbered float position so inserts never need to renumber the
 *  whole lane. Conventions:
 *    - empty lane               → 1000
 *    - top of lane              → first.position - 1000
 *    - bottom of lane           → last.position + 1000
 *    - between A (above) and B  → (A.position + B.position) / 2
 *
 *  Tasks that lack a position (legacy seed rows) get backfilled with
 *  their array index times 1000 for the purposes of this calculation
 * , the server is the source of truth and will normalise on its
 *  next hydrate. */
function computeDropPosition(
  tasks: Task[],
  movingId: string,
  toLane: LaneId,
  toIndex: number,
): number {
  const STEP = 1000;
  const siblings = tasks
    .filter((t) => t.lane === toLane && t.id !== movingId)
    .map((t, i) => {
      const p = (t as Task & { position?: number | null }).position;
      return typeof p === "number" ? p : (i + 1) * STEP;
    });

  if (siblings.length === 0) return STEP;
  const clamped = Math.max(0, Math.min(toIndex, siblings.length));
  if (clamped === 0) return siblings[0] - STEP;
  if (clamped >= siblings.length) return siblings[siblings.length - 1] + STEP;
  return (siblings[clamped - 1] + siblings[clamped]) / 2;
}

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
  /**
   * Move a task to any board column, system lane or custom column.
   * For system lanes, equivalent to moveTask but goes through the
   * column-aware server action that also clears boardColumnKey.
   * For custom columns, sets boardColumnKey without changing lane
   * (lane remains canonical for list/timeline/calendar/export views).
   */
  moveTaskToColumn: (id: string, columnKey: string) => void;
  /** Place a task into a lane at a target index. Cross-lane and
   *  same-lane drops both flow through here. The dispatcher computes
   *  a gap-numbered float `position` from the current siblings before
   *  calling the server. */
  reorderTask: (id: string, toLane: LaneId, toIndex: number) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  /** Toggle the structural milestone flag. Optimistic like updateTask, but
   *  synced through its dedicated server action — updateTaskAction strips
   *  isMilestone from patches, so routing it through updateTask would show
   *  the change and then silently revert it on reconcile. */
  setMilestone: (id: string, isMilestone: boolean) => void;
  addTask: (input: {
    title: string;
    description?: string;
    lane?: LaneId;
    priority?: Priority;
    assignees?: UserId[];
    estimate?: number;
    due?: string;
    dueAt?: Date;
    tags?: string[];
    recurrence?: RecurrenceSpec;
  }) => Task;
  removeTask: (id: string) => void;
  /** Archive a task (sets archived_at; leaves every active view, restorable
   *  from /app/archived). Optimistically removes it from board state. */
  archiveTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  /** Duplicate a task (and its subtasks) within the workspace. Non-optimistic
   *  — the copy's ids are server-minted, and duplication is not a
   *  rollback-safe operation, so we wait for the authoritative result. */
  duplicateTask: (id: string) => void;
  /** Reparent a task. When parentId is non-null the task is optimistically
   *  removed from the board (it leaves the flat lane view) and the server
   *  persists the new parent_task_id. When parentId is null the task is
   *  promoted back to top-level (no optimistic removal). */
  setParent: (id: string, parentId: string | null) => void;
};

const TasksStateContext = createContext<TasksState | null>(null);
const TasksDispatchContext = createContext<TasksDispatchers | null>(null);

function commitTasksState(
  _currentState: TasksState,
  nextState: TasksState,
): TasksState {
  return nextState;
}

export function TasksProvider({
  projectId,
  actorId,
  children,
  initialTasks,
  initialPreviousLane,
}: {
  projectId: string;
  actorId: UserId;
  children: ReactNode;
  initialTasks?: Task[];
  initialPreviousLane?: Record<string, LaneId>;
}) {
  const [state, commitState] = useReducer(commitTasksState, {
    tasks: (initialTasks ?? SEED_TASKS).map((t) => ({ ...t })),
    previousLane: initialPreviousLane ?? {},
  });

  // Track latest state so dispatchers can capture pre-mutation
  // snapshots for revert without becoming stale closures or being
  // recreated on every state change. Reduce each action exactly once, then
  // commit that same state object to both the synchronous ref and React.
  // This keeps timestamped optimistic updates identical in both places.
  const stateRef = useRef(state);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const dispatch = useCallback(
    (action: TasksAction) => {
      const nextState = tasksReducer(stateRef.current, action);
      stateRef.current = nextState;
      commitState(nextState);
    },
    [commitState],
  );

  // Realtime cross-tab sync: subscribe to SSE peer-mutation events
  // and replace local state with the server's authoritative result.
  // The provider's own optimistic + reconcile path already handles
  // this tab's mutations; this hook only reacts to peer events.
  useRealtimeSync({
    projectId,
    actorId,
    onChange: (fresh) => dispatch({ type: "hydrate", tasks: fresh }),
  });

  // When the server-rendered layout passes a fresh `initialTasks`
  // (after revalidatePath fires for things like comment counts),
  // hydrate the client store. The reference identity of the array
  // is the change signal, same array reference means no work.
  const lastInitialRef = useRef(initialTasks);
  useEffect(() => {
    if (!initialTasks) return;
    if (initialTasks === lastInitialRef.current) return;
    lastInitialRef.current = initialTasks;
    dispatch({ type: "hydrate", tasks: initialTasks });
  }, [dispatch, initialTasks]);

  /** Run an optimistic action: dispatch locally for snappy UI, then
   *  reconcile with the server's authoritative result. Revert on
   *  failure. */
  const withServerSync = useCallback(
    (optimistic: () => void, server: () => Promise<Task[]>) => {
      // Demo/review posture: the server actions are stateless no-ops that
      // return the seed, so reconciling would visibly revert every edit
      // ~1s after it was made — a board that appears to reject its user.
      // The optimistic state IS the session's truth (in-memory only; the
      // demo safety invariant means no real DB is reachable either way).
      if (isDemoMode()) {
        optimistic();
        return;
      }
      const prior = stateRef.current.tasks;
      optimistic();
      const finishSync = beginTaskSync();
      startTransition(async () => {
        try {
          const fresh = await server();
          dispatch({ type: "hydrate", tasks: fresh });
          finishSync();
        } catch (err) {
          console.warn("tasks: server action failed; reverting", err);
          dispatch({ type: "hydrate", tasks: prior });
          finishSync(err);
        }
      });
    },
    [dispatch],
  );

  // Reconciliation belongs to this provider's displayed Project. The runtime
  // keys the provider by verified actor/Project so old optimistic state and
  // pending mutation callbacks cannot hydrate a replacement context.
  const dispatchers = useMemo<TasksDispatchers>(
    () => ({
      moveTask: (id, toLane) =>
        withServerSync(
          () => dispatch({ type: "move", id, toLane }),
          () => moveTaskAction(id, toLane),
        ),
      moveTaskToColumn: (id, columnKey) => {
        const isSystemLane = (LANE_ORDER as string[]).includes(columnKey);
        const prior = stateRef.current.tasks;
        // Optimistic: update local state immediately.
        dispatch({ type: "moveToColumn", id, columnKey, isSystemLane });
        if (isDemoMode()) return;
        // Server sync: fire and reconcile via getTasksAction after completion.
        startTransition(async () => {
          try {
            await moveTaskToColumnAction(id, columnKey);
            if (!mounted.current) return;
            const fresh = await getTasksAction(projectId);
            if (!mounted.current) return;
            // Only accept the server's copy when it actually carries the move.
            // The unconditional hydrate meant any surface whose read does not
            // reflect the write — a deterministic demo board, a replica that
            // has not caught up — silently reverted the operator's drag a beat
            // after it landed, and only for custom columns, because the system
            // lanes reconcile through withServerSync and never re-read here.
            const landed = fresh.find((task) => task.id === id);
            const effective = landed ? landed.boardColumnKey || landed.lane : null;
            if (effective === columnKey) dispatch({ type: "hydrate", tasks: fresh });
          } catch (err) {
            if (!mounted.current) return;
            console.warn("tasks: moveTaskToColumn failed; reverting", err);
            dispatch({ type: "hydrate", tasks: prior });
          }
        });
      },
      reorderTask: (id, toLane, toIndex) => {
        const position = computeDropPosition(
          stateRef.current.tasks,
          id,
          toLane,
          toIndex,
        );
        withServerSync(
          () =>
            dispatch({
              type: "place",
              id,
              toLane,
              toIndex,
              position,
            }),
          () => reorderTaskAction(id, toLane, position),
        );
      },
      updateTask: (id, patch) =>
        withServerSync(
          () => dispatch({ type: "update", id, patch }),
          () => updateTaskAction(id, patch),
        ),
      setMilestone: (id, isMilestone) =>
        withServerSync(
          () => dispatch({ type: "update", id, patch: { isMilestone } }),
          () => setTaskMilestoneAction(id, isMilestone),
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
          dueAt: input.dueAt,
          tags: input.tags,
          recurrence: input.recurrence,
          externalContactName: null,
          externalContactEmail: null,
          cents: null,
          parentTaskId: null,
          updatedAt: new Date(),
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
      archiveTask: (id) =>
        // Archived tasks leave every active view, so optimistically drop the
        // row from board state exactly like a delete; the server sets
        // archived_at instead of deleting, so it can be restored later.
        withServerSync(
          () => dispatch({ type: "remove", id }),
          () => setTaskArchivedAction(id, true),
        ),
      toggleComplete: (id) => {
        const task = stateRef.current.tasks.find((item) => item.id === id);
        if (task?.lane !== "done") maybeFireFirstCompletion();
        withServerSync(
          () => dispatch({ type: "toggleComplete", id }),
          () => toggleCompleteAction(id),
        );
      },
      duplicateTask: (id) => {
        const finishSync = beginTaskSync();
        startTransition(async () => {
          try {
            const fresh = await duplicateTaskAction(id);
            dispatch({ type: "hydrate", tasks: fresh });
            finishSync();
          } catch (err) {
            console.warn("tasks: duplicateTask failed", err);
            finishSync(err);
          }
        });
      },
      setParent: (id, parentId) => {
        const prior = stateRef.current.tasks;
        const finishSync = beginTaskSync();
        // Optimistically remove from board when reparenting (task becomes a subtask
        // and leaves the flat lane view). Promoting to top-level (null) has no
        // optimistic visual since the task re-enters at an unknown position.
        if (parentId !== null) dispatch({ type: "remove", id });
        startTransition(async () => {
          try {
            const result = await setParentAction(id, parentId);
            if (result.ok) {
              dispatch({ type: "hydrate", tasks: result.tasks });
              finishSync();
            } else {
              console.warn("tasks: setParent failed;", result.error);
              dispatch({ type: "hydrate", tasks: prior });
              finishSync(new Error(result.error));
            }
          } catch (err) {
            console.warn("tasks: setParent threw; reverting", err);
            dispatch({ type: "hydrate", tasks: prior });
            finishSync(err);
          }
        });
      },
    }),

    [dispatch, withServerSync, projectId],
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
