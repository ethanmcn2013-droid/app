"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
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
import { beginTaskSync, type TaskAckOperation } from "./delight-events";
import { maybeFireFirstCompletion } from "@/components/app/done-dopamine/first-completion-moment";
import { reconcileAuthoritativeTasks, type AuthoritativeTaskVersions } from "./authoritative-refresh";
import {
  createTask,
  editTask,
  toggleTaskComplete,
  TaskMutationRefusedError,
  TaskMutationRequestRejectedError,
  readTaskSnapshot,
} from "./task-transport";
import {
  ensureTaskSnapshotEpoch,
  invalidateTaskSnapshotEpoch,
  readTaskSnapshotEpoch,
  readTaskSnapshotFreshness,
  rotateTaskSnapshotEpoch,
  serverTaskSnapshotFreshness,
  subscribeTaskSnapshotEpoch,
} from "./task-snapshot-epoch";

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
const AuthoritativeTaskContext = createContext<AuthoritativeTaskVersions | null>(null);

function commitTasksState(
  _currentState: TasksState,
  nextState: TasksState,
): TasksState {
  return nextState;
}

type TaskIntent = {
  generation: number;
  status: "queued" | "sent" | "uncertain";
  abandoned?: boolean;
  targetId?: string;
  operation: TaskAckOperation;
  startedAt: number;
  makeAction: (state: TasksState) => TasksAction | null;
  send: (action: TasksAction | null) => Promise<unknown>;
  transport: "json" | "legacy";
  finish: ReturnType<typeof beginTaskSync>;
  verify?: (tasks: Task[]) => boolean;
};

export function TasksProvider({
  projectId,
  actorId,
  children,
  initialTasks,
  initialTasksEpoch = null,
  initialPreviousLane,
}: {
  projectId: string;
  actorId: UserId;
  children: ReactNode;
  initialTasks?: Task[];
  initialTasksEpoch?: string | null;
  initialPreviousLane?: Record<string, LaneId>;
}) {
  const router = useRouter();
  const browserFreshness = useSyncExternalStore(
    subscribeTaskSnapshotEpoch,
    readTaskSnapshotFreshness,
    () => serverTaskSnapshotFreshness(initialTasksEpoch),
  );
  const [state, commitState] = useReducer(commitTasksState, {
    tasks: (initialTasks ?? SEED_TASKS).map((t) => ({ ...t })),
    previousLane: initialPreviousLane ?? {},
  });
  const [authoritativeVersions, setAuthoritativeVersions] = useState<AuthoritativeTaskVersions>(
    () => new Map(),
  );
  const authoritativeVersionsRef = useRef(authoritativeVersions);
  const baseRef = useRef<TasksState>({
    tasks: (initialTasks ?? SEED_TASKS).map((task) => ({ ...task })),
    previousLane: initialPreviousLane ?? {},
  });
  const acceptedEpochRef = useRef<string | null>(initialTasksEpoch);
  const acceptedFreshnessRef = useRef(serverTaskSnapshotFreshness(initialTasksEpoch));
  const acceptedSnapshotSerialRef = useRef(0);
  const seedAcceptedRef = useRef(false);
  const quarantinedRef = useRef(false);
  const cookieUnavailableRef = useRef(false);
  const generationRef = useRef(0);
  const pendingRef = useRef<TaskIntent[]>([]);
  const activeIntentRef = useRef<TaskIntent | null>(null);
  const pumpingRef = useRef(false);
  const dirtyRef = useRef(false);
  const readingRef = useRef(false);
  const refreshNeededRef = useRef(false);
  const readStaleRetriesRef = useRef(0);
  const readRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pumpRef = useRef<() => void>(() => {});
  const readRef = useRef<() => void>(() => {});

  // Track latest state so dispatchers can capture pre-mutation
  // snapshots for revert without becoming stale closures or being
  // recreated on every state change. Reduce each action exactly once, then
  // commit that same state object to both the synchronous ref and React.
  // This keeps timestamped optimistic updates identical in both places.
  const stateRef = useRef(state);
  const mounted = useRef(false);
  useEffect(() => {
    const mountedGeneration = generationRef.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      generationRef.current = mountedGeneration + 1;
      const active = activeIntentRef.current;
      const sent = new Set(pendingRef.current.filter((intent) => intent.status !== "queued"));
      if (active && active.status !== "queued") sent.add(active);
      if (sent.size) invalidateTaskSnapshotEpoch();
      for (const intent of sent) intent.abandoned = true;
      for (const intent of pendingRef.current) intent.finish.cancel();
      if (active && !pendingRef.current.includes(active)) active.finish.cancel();
      pendingRef.current = [];
      if (readRetryTimerRef.current) clearTimeout(readRetryTimerRef.current);
    };
  }, []);
  const dispatch = useCallback(
    (action: TasksAction) => {
      const nextState = tasksReducer(stateRef.current, action);
      stateRef.current = nextState;
      commitState(nextState);
    },
    [commitState],
  );
  const rebuild = useCallback(() => {
    let next = baseRef.current;
    for (const intent of pendingRef.current) {
      const action = intent.makeAction(next);
      if (action) next = tasksReducer(next, action);
    }
    stateRef.current = next;
    commitState(next);
  }, []);

  const publishBase = useCallback((fresh: Task[], settledAction: TasksAction | null = null) => {
    const advanced = settledAction ? tasksReducer(baseRef.current, settledAction) : baseRef.current;
    baseRef.current = { tasks: fresh.map((task) => ({ ...task })), previousLane: advanced.previousLane };
    const versions = reconcileAuthoritativeTasks(authoritativeVersionsRef.current, fresh);
    authoritativeVersionsRef.current = versions;
    setAuthoritativeVersions(versions);
    acceptedSnapshotSerialRef.current++;
    rebuild();
  }, [rebuild]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    readStaleRetriesRef.current = 0;
    readRef.current();
  }, []);

  const readTasks = useCallback(() => {
    if (!mounted.current || readingRef.current || pumpingRef.current ||
        (pendingRef.current.length && !quarantinedRef.current) || !dirtyRef.current) return;
    dirtyRef.current = false;
    readingRef.current = true;
    const epoch = readTaskSnapshotEpoch();
    const freshness = readTaskSnapshotFreshness();
    const snapshotSerial = acceptedSnapshotSerialRef.current;
    const generation = generationRef.current;
    void getTasksAction(projectId).then((fresh) => {
      if (!mounted.current || generation !== generationRef.current) return;
      if (readTaskSnapshotEpoch() !== epoch || readTaskSnapshotFreshness() !== freshness ||
          acceptedSnapshotSerialRef.current !== snapshotSerial ||
          (pendingRef.current.length && !quarantinedRef.current)) {
        dirtyRef.current = true;
        readStaleRetriesRef.current++;
        return;
      }
      const uncertain = pendingRef.current[0];
      if (uncertain?.status === "uncertain") {
        if ((epoch === null && !(cookieUnavailableRef.current && uncertain.transport === "legacy")) ||
            (uncertain.verify && !uncertain.verify(fresh))) return;
        pendingRef.current.shift();
        refreshNeededRef.current = true;
      }
      acceptedEpochRef.current = epoch;
      acceptedFreshnessRef.current = freshness;
      readStaleRetriesRef.current = 0;
      quarantinedRef.current = false;
      seedAcceptedRef.current = true;
      publishBase(fresh);
      pumpRef.current();
    }).catch((error) => {
      console.warn("tasks: fresh read failed", error);
    }).finally(() => {
      readingRef.current = false;
      if (dirtyRef.current && readStaleRetriesRef.current <= 2 &&
          (!pendingRef.current.length || quarantinedRef.current)) {
        readRetryTimerRef.current = setTimeout(() => {
          readRetryTimerRef.current = null;
          readRef.current();
        }, 100);
      }
    });
  }, [projectId, publishBase]);
  useEffect(() => { readRef.current = readTasks; }, [readTasks]);

  // SSE is a dirty signal; only this Provider can accept a scope/epoch-fenced read.
  useRealtimeSync({ projectId, actorId, onDirty: markDirty });

  const lastInitialRef = useRef<Task[] | undefined>(undefined);
  useEffect(() => {
    if (!initialTasks) return;
    if (isDemoMode()) {
      seedAcceptedRef.current = true;
      return;
    }
    if (initialTasks === lastInitialRef.current && seedAcceptedRef.current) return;
    lastInitialRef.current = initialTasks;
    const current = readTaskSnapshotEpoch();
    if (current === null) {
      // Establish the marker during bootstrap, before the first gesture, then
      // read under it. A blocked cookie remains on the guarded legacy path.
      ensureTaskSnapshotEpoch();
      quarantinedRef.current = true;
      markDirty();
      return;
    }
    if (current !== initialTasksEpoch ||
        readTaskSnapshotFreshness() !== serverTaskSnapshotFreshness(initialTasksEpoch) ||
        pendingRef.current.length ||
        cookieUnavailableRef.current) {
      if (!seedAcceptedRef.current) quarantinedRef.current = true;
      markDirty();
      return;
    }
    acceptedEpochRef.current = current;
    acceptedFreshnessRef.current = readTaskSnapshotFreshness();
    seedAcceptedRef.current = true;
    quarantinedRef.current = false;
    publishBase(initialTasks);
    pumpRef.current();
  }, [initialTasks, initialTasksEpoch, markDirty, publishBase]);

  useEffect(() => {
    if (isDemoMode()) return;
    if (!mounted.current || !seedAcceptedRef.current) return;
    if (browserFreshness === acceptedFreshnessRef.current) return;
    quarantinedRef.current = true;
    authoritativeVersionsRef.current = new Map();
    setAuthoritativeVersions(authoritativeVersionsRef.current);
    markDirty();
  }, [browserFreshness, markDirty]);

  const pump = useCallback(() => {
    if (!mounted.current || pumpingRef.current || quarantinedRef.current || !seedAcceptedRef.current) return;
    const head = pendingRef.current[0];
    if (!head) {
      if (refreshNeededRef.current) {
        refreshNeededRef.current = false;
        router.refresh();
      }
      if (dirtyRef.current) readRef.current();
      return;
    }
    if (head.status !== "queued") return;
    pumpingRef.current = true;
    activeIntentRef.current = head;
    const expectedEpoch = readTaskSnapshotEpoch();
    const expectedFreshness = readTaskSnapshotFreshness();
    const sameScope = () => mounted.current && head.generation === generationRef.current;
    let headRemoved = false;
    const recover = async (error: unknown) => {
      head.status = "uncertain";
      const current = readTaskSnapshotEpoch();
      const legacyWithoutCookie = head.transport === "legacy" &&
        cookieUnavailableRef.current && expectedEpoch === null && current === null;
      const rotated = current === expectedEpoch
        ? legacyWithoutCookie ? null : rotateTaskSnapshotEpoch(expectedEpoch)
        : current;
      if (!rotated && !legacyWithoutCookie) {
        quarantinedRef.current = true;
        head.finish(error, true, true);
        return;
      }
      quarantinedRef.current = true;
      const recoveryFreshness = readTaskSnapshotFreshness();
      try {
        const fresh = legacyWithoutCookie
          ? await getTasksAction(projectId)
          : await readTaskSnapshot(projectId);
        if (!sameScope() || readTaskSnapshotEpoch() !== rotated ||
            readTaskSnapshotFreshness() !== recoveryFreshness ||
            (head.verify && !head.verify(fresh))) {
          quarantinedRef.current = true;
          return;
        }
        if (!headRemoved) pendingRef.current.shift();
        acceptedEpochRef.current = rotated;
        acceptedFreshnessRef.current = recoveryFreshness;
        quarantinedRef.current = false;
        publishBase(fresh);
        refreshNeededRef.current = true;
      } catch (readError) {
        quarantinedRef.current = true;
        console.warn("tasks: uncertain change needs a fresh read", readError);
      } finally {
        head.finish(error, true, true);
      }
    };
    void (async () => {
      try {
        if (head.targetId && !baseRef.current.tasks.some((task) => task.id === head.targetId)) {
          throw new TaskMutationRefusedError();
        }
        const action = head.makeAction(baseRef.current);
        if (expectedEpoch !== acceptedEpochRef.current ||
            expectedFreshness !== acceptedFreshnessRef.current) throw new Error("task_snapshot_epoch_changed");
        head.status = "sent";
        const result = await head.send(action);
        if (!sameScope()) return;
        // Bound JSON results already carry the exact displayed Project.
        // Retained Server Actions can return ambient neutral arrays, so their
        // result is deliberately discarded in favor of this scoped read.
        const fresh = head.transport === "json"
          ? result as Task[]
          : await getTasksAction(projectId);
        if (!sameScope()) return;
        if (readTaskSnapshotEpoch() !== expectedEpoch ||
            readTaskSnapshotFreshness() !== expectedFreshness ||
            (head.verify && !head.verify(fresh))) throw new Error("task_snapshot_not_current");
        pendingRef.current.shift();
        headRemoved = true;
        publishBase(fresh, action);
        if (head.transport === "legacy" && cookieUnavailableRef.current && expectedEpoch === null) {
          invalidateTaskSnapshotEpoch();
          acceptedEpochRef.current = null;
          acceptedFreshnessRef.current = readTaskSnapshotFreshness();
          refreshNeededRef.current = true;
          head.finish();
          return;
        }
        const rotated = rotateTaskSnapshotEpoch(expectedEpoch);
        if (!rotated) {
          await recover(new Error("task_snapshot_epoch_unavailable"));
          return;
        }
        acceptedEpochRef.current = rotated;
        acceptedFreshnessRef.current = readTaskSnapshotFreshness();
        refreshNeededRef.current = true;
        head.finish();
      } catch (error) {
        if (!sameScope()) return;
        if (error instanceof TaskMutationRefusedError ||
            error instanceof TaskMutationRequestRejectedError) {
          pendingRef.current.shift();
          rebuild();
          head.finish(error, true);
        } else {
          await recover(error);
        }
      } finally {
        pumpingRef.current = false;
        if (activeIntentRef.current === head) activeIntentRef.current = null;
        if (!sameScope() && head.abandoned) invalidateTaskSnapshotEpoch();
        if (sameScope() && !quarantinedRef.current) pumpRef.current();
      }
    })();
  }, [projectId, publishBase, rebuild, router]);
  useEffect(() => {
    pumpRef.current = pump;
    pumpRef.current();
  }, [pump]);

  const enqueue = useCallback((intent: Omit<TaskIntent, "generation" | "finish" | "status">) => {
    if (intent.targetId && !stateRef.current.tasks.some((task) => task.id === intent.targetId)) return;
    if (isDemoMode()) {
      const action = intent.makeAction(stateRef.current);
      if (action) dispatch(action);
      return;
    }
    const current = readTaskSnapshotEpoch() ?? ensureTaskSnapshotEpoch();
    if (current === null) cookieUnavailableRef.current = true;
    if (current !== acceptedEpochRef.current) {
      quarantinedRef.current = true;
      markDirty();
    }
    const queued: TaskIntent = {
      ...intent,
      generation: generationRef.current,
      status: "queued",
      finish: beginTaskSync(intent.operation, intent.startedAt),
    };
    pendingRef.current.push(queued);
    rebuild();
    pumpRef.current();
  }, [dispatch, markDirty, rebuild]);

  // Reconciliation belongs to this provider's displayed Project. The runtime
  // keys the provider by verified actor/Project so old optimistic state and
  // pending mutation callbacks cannot hydrate a replacement context.
  const dispatchers = useMemo<TasksDispatchers>(
    () => ({
      moveTask: (id, toLane) => {
        const at = new Date();
        enqueue({ targetId: id, operation: "other", startedAt: performance.now(), transport: "legacy",
          makeAction: () => ({ type: "move", id, toLane, at }),
          send: () => moveTaskAction(id, toLane) });
      },
      moveTaskToColumn: (id, columnKey) => {
        const isSystemLane = (LANE_ORDER as string[]).includes(columnKey);
        const at = new Date();
        enqueue({ targetId: id, operation: "other", startedAt: performance.now(), transport: "legacy",
          makeAction: () => ({ type: "moveToColumn", id, columnKey, isSystemLane, at }),
          send: () => moveTaskToColumnAction(id, columnKey),
          verify: (fresh) => {
            const landed = fresh.find((task) => task.id === id);
            return (landed ? landed.boardColumnKey || landed.lane : null) === columnKey;
          } });
      },
      reorderTask: (id, toLane, toIndex) => {
        const at = new Date();
        enqueue({ targetId: id, operation: "other", startedAt: performance.now(), transport: "legacy",
          makeAction: (current) => ({ type: "place", id, toLane, toIndex,
            position: computeDropPosition(current.tasks, id, toLane, toIndex), at }),
          send: (action) => {
            if (action?.type !== "place") throw new Error("task_reorder_action_missing");
            return reorderTaskAction(id, toLane, action.position);
          } });
      },
      updateTask: (id, patch) => {
        const at = new Date();
        const json = ensureTaskSnapshotEpoch() !== null;
        if (!json) cookieUnavailableRef.current = true;
        enqueue({ targetId: id, operation: "edit", startedAt: performance.now(), transport: json ? "json" : "legacy",
          makeAction: () => ({ type: "update", id, patch, at }),
          send: () => json ? editTask(id, patch, projectId) : updateTaskAction(id, patch) });
      },
      setMilestone: (id, isMilestone) => {
        const at = new Date();
        enqueue({ targetId: id, operation: "other", startedAt: performance.now(), transport: "legacy",
          makeAction: () => ({ type: "update", id, patch: { isMilestone }, at }),
          send: () => setTaskMilestoneAction(id, isMilestone) });
      },
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
        const json = ensureTaskSnapshotEpoch() !== null;
        if (!json) cookieUnavailableRef.current = true;
        enqueue({ operation: "create", startedAt: performance.now(), transport: json ? "json" : "legacy",
          makeAction: () => ({ type: "add", task }),
          send: () => json
            ? createTask({ ...input, id: task.id }, projectId)
            : addTaskAction({ ...input, id: task.id, projectId }) });
        return task;
      },
      removeTask: (id) => enqueue({ targetId: id, operation: "other", startedAt: performance.now(),
        transport: "legacy", makeAction: () => ({ type: "remove", id }),
        send: () => removeTaskAction(id) }),
      archiveTask: (id) => enqueue({ targetId: id, operation: "other", startedAt: performance.now(),
        transport: "legacy", makeAction: () => ({ type: "remove", id }),
        send: () => setTaskArchivedAction(id, true) }),
      toggleComplete: (id) => {
        const task = stateRef.current.tasks.find((item) => item.id === id);
        if (task && task.lane !== "done") maybeFireFirstCompletion();
        const at = new Date();
        const json = ensureTaskSnapshotEpoch() !== null;
        if (!json) cookieUnavailableRef.current = true;
        enqueue({ targetId: id, operation: "complete", startedAt: performance.now(), transport: json ? "json" : "legacy",
          makeAction: () => ({ type: "toggleComplete", id, at }),
          send: () => json ? toggleTaskComplete(id, projectId) : toggleCompleteAction(id) });
      },
      duplicateTask: (id) => enqueue({ targetId: id, operation: "other", startedAt: performance.now(),
        transport: "legacy", makeAction: () => null, send: () => duplicateTaskAction(id) }),
      setParent: (id, parentId) => {
        enqueue({ targetId: id, operation: "other", startedAt: performance.now(), transport: "legacy",
          makeAction: () => parentId === null ? null : { type: "remove", id },
          send: async () => {
            const result = await setParentAction(id, parentId);
            if (!result.ok) throw new TaskMutationRefusedError();
            return result.tasks;
          } });
      },
    }),
    [enqueue, projectId],
  );

  return (
    <AuthoritativeTaskContext.Provider value={authoritativeVersions}>
      <TasksStateContext.Provider value={state}>
        <TasksDispatchContext.Provider value={dispatchers}>
          {children}
        </TasksDispatchContext.Provider>
      </TasksStateContext.Provider>
    </AuthoritativeTaskContext.Provider>
  );
}

/** Changes only when the server's task snapshot changes, never optimistically. */
export function useAuthoritativeTaskRevision(taskId: string): number {
  const versions = useContext(AuthoritativeTaskContext);
  if (!versions) throw new Error("useAuthoritativeTaskRevision must be used within <TasksProvider>");
  return versions.get(taskId)?.revision ?? 0;
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
