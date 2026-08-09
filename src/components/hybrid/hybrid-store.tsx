"use client";

// Production-backed implementation of the design-lab store contract. It exposes
// the exact same `LabStore` shape (via the same LabStoreContext) that the
// verbatim hybrid views consume through useLabStore(), but derives task state
// from the production TasksProvider and routes every mutation through the
// production dispatchers (optimistic + server-persisted + SSE-reconciled).
//
// UI-only concerns the server never sees (selection, focus, inspection,
// preview, inline-edit target, drag) live in a small local reducer here.

import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { LANE_ORDER, type LaneId } from "@/lib/data";
import type { Task } from "@/lib/data";
import { useTasksDispatch, useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useColumnConfig } from "@/lib/domain-context";
import { columnByKey, isTaskDone, resolveBoardColumns } from "@/lib/board-columns";
import {
  fieldsPatch,
  labToPriority,
  scheduleToPatch,
  taskToLab,
  taskToSchedule,
} from "./adapter";
import { moveSchedule, resizeScheduleEnd } from "./dates";
import { LabStoreContext, type LabStore, type UpdateFields } from "./store";
import type {
  CalendarDate,
  LabDragOperation,
  LabTask,
  TaskPriority,
  TaskSchedule,
  TaskStatus,
} from "./types";

type UiState = {
  selectedIds: string[];
  selectionAnchorId: string | null;
  activeId: string | null;
  inspectedId: string | null;
  recentlyPlacedId: string | null;
  recentlyUpdatedId: string | null;
  recentlyCompletedId: string | null;
  previewId: string | null;
  editing: { taskId: string; field: string } | null;
  drag: LabDragOperation;
  savedViewKeys: string[];
  announcement: string;
};

type UiAction =
  | { type: "SET_ACTIVE"; id: string | null }
  | { type: "SET_INSPECTED"; id: string | null }
  | { type: "SET_PLACED"; id: string | null }
  | { type: "SET_UPDATED"; id: string | null }
  | { type: "SET_COMPLETED"; id: string | null }
  | { type: "SET_PREVIEW"; id: string | null }
  | { type: "SET_EDITING"; editing: UiState["editing"] }
  | { type: "SET_DRAG"; drag: LabDragOperation }
  | { type: "TOGGLE_SELECTED"; id: string; orderedIds?: string[]; range?: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "SAVE_VIEW"; key: string }
  | { type: "ANNOUNCE"; message: string };

const INITIAL_UI: UiState = {
  selectedIds: [],
  selectionAnchorId: null,
  activeId: null,
  inspectedId: null,
  recentlyPlacedId: null,
  recentlyUpdatedId: null,
  recentlyCompletedId: null,
  previewId: null,
  editing: null,
  drag: null,
  savedViewKeys: [],
  announcement: "Ready",
};

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "SET_ACTIVE":
      return { ...state, activeId: action.id };
    case "SET_INSPECTED":
      return { ...state, inspectedId: action.id };
    case "SET_PLACED":
      return { ...state, recentlyPlacedId: action.id };
    case "SET_UPDATED":
      return { ...state, recentlyUpdatedId: action.id };
    case "SET_COMPLETED":
      return { ...state, recentlyCompletedId: action.id };
    case "SET_PREVIEW":
      return { ...state, previewId: action.id };
    case "SET_EDITING":
      return { ...state, editing: action.editing };
    case "SET_DRAG":
      return { ...state, drag: action.drag };
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [], selectionAnchorId: null, announcement: "Selection cleared" };
    case "TOGGLE_SELECTED": {
      const selected = new Set(state.selectedIds);
      if (action.range && state.selectionAnchorId && action.orderedIds) {
        const start = action.orderedIds.indexOf(state.selectionAnchorId);
        const end = action.orderedIds.indexOf(action.id);
        if (start >= 0 && end >= 0) {
          const [from, to] = start < end ? [start, end] : [end, start];
          action.orderedIds.slice(from, to + 1).forEach((id) => selected.add(id));
        }
      } else if (selected.has(action.id)) {
        selected.delete(action.id);
      } else {
        selected.add(action.id);
      }
      const selectedIds = [...selected];
      return {
        ...state,
        selectedIds,
        selectionAnchorId: action.range ? state.selectionAnchorId : action.id,
        announcement: `${selectedIds.length} task${selectedIds.length === 1 ? "" : "s"} selected`,
      };
    }
    case "SAVE_VIEW":
      return state.savedViewKeys.includes(action.key)
        ? { ...state, announcement: "This view is already saved" }
        : { ...state, savedViewKeys: [...state.savedViewKeys, action.key], announcement: "View saved" };
    case "ANNOUNCE":
      return { ...state, announcement: action.message };
  }
}

export function HybridStoreProvider({
  children,
  readOnly = false,
  onInspectedChange,
}: {
  children: ReactNode;
  readOnly?: boolean;
  onInspectedChange?: (id: string | null) => void;
}) {
  const { tasks: prodTasks } = useTasksState();
  const prod = useTasksDispatch();
  const taskPanel = useTaskPanel();
  const calendar = useCalendarFrame();
  const columnConfig = useColumnConfig();
  const [ui, dispatch] = useReducer(uiReducer, INITIAL_UI);
  const knownTaskIds = useRef(new Set(prodTasks.map((task) => task.id)));
  const knownUpdatedAt = useRef(new Map(prodTasks.map((task) => [task.id, task.updatedAt.getTime()])));
  const knownCompleted = useRef(
    new Map(prodTasks.map((task) => [task.id, isTaskDone(task, columnConfig)])),
  );
  const updateReceiptTimer = useRef<number | undefined>(undefined);
  const completionReceiptTimer = useRef<number | undefined>(undefined);
  const pendingDuplicate = useRef(false);

  const labTasks = useMemo<LabTask[]>(
    () => prodTasks.map((task, index) => taskToLab(task, index, calendar, columnConfig)),
    [calendar, columnConfig, prodTasks],
  );

  const prodById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of prodTasks) map.set(task.id, task);
    return map;
  }, [prodTasks]);

  useEffect(() => {
    const nextIds = new Set(prodTasks.map((task) => task.id));
    const changed = prodTasks.find((task) => {
      const prior = knownUpdatedAt.current.get(task.id);
      return prior !== undefined && prior !== task.updatedAt.getTime();
    });
    const completed = prodTasks.find(
      (task) =>
        knownCompleted.current.get(task.id) === false &&
        isTaskDone(task, columnConfig),
    );
    if (pendingDuplicate.current) {
      const added = prodTasks.find((task) => !knownTaskIds.current.has(task.id));
      if (added) {
        pendingDuplicate.current = false;
        dispatch({ type: "SET_PLACED", id: added.id });
      }
    }
    if (changed) {
      dispatch({ type: "SET_UPDATED", id: changed.id });
      if (updateReceiptTimer.current !== undefined) window.clearTimeout(updateReceiptTimer.current);
      updateReceiptTimer.current = window.setTimeout(() => {
        dispatch({ type: "SET_UPDATED", id: null });
      }, 360);
    }
    if (completed) {
      dispatch({ type: "SET_COMPLETED", id: completed.id });
      if (completionReceiptTimer.current !== undefined) {
        window.clearTimeout(completionReceiptTimer.current);
      }
      completionReceiptTimer.current = window.setTimeout(() => {
        dispatch({ type: "SET_COMPLETED", id: null });
      }, 200);
    }
    knownTaskIds.current = nextIds;
    knownUpdatedAt.current = new Map(prodTasks.map((task) => [task.id, task.updatedAt.getTime()]));
    knownCompleted.current = new Map(
      prodTasks.map((task) => [task.id, isTaskDone(task, columnConfig)]),
    );
    return () => {
      if (updateReceiptTimer.current !== undefined) window.clearTimeout(updateReceiptTimer.current);
      if (completionReceiptTimer.current !== undefined) {
        window.clearTimeout(completionReceiptTimer.current);
      }
    };
  }, [columnConfig, prodTasks]);

  const openTask = useCallback(
    (id: string | null) => {
      // Defer entirely to production's detail panel (opened via the ?task=
      // param). We intentionally do NOT mirror the id into local store state:
      // that would rebuild the derived store value and re-render every view in
      // the same tick as the pushState, aborting the in-flight RSC request.
      if (id) taskPanel.openTask(id);
      else taskPanel.closeTask();
      onInspectedChange?.(id);
    },
    [onInspectedChange, taskPanel],
  );

  const applySchedule = useCallback(
    (id: string, schedule: TaskSchedule) => {
      if (readOnly) return;
      prod.updateTask(id, scheduleToPatch(schedule, calendar));
      const current = prodById.get(id);
      const wantMilestone = schedule.kind === "milestone";
      if (current && Boolean(current.isMilestone) !== wantMilestone) {
        // Structural flag is stripped by updateTaskAction; the dedicated
        // dispatcher applies it optimistically and persists it separately,
        // so the board's diamond flips the moment it is clicked.
        prod.setMilestone(id, wantMilestone);
      }
    },
    [calendar, prod, prodById, readOnly],
  );

  const value = useMemo<LabStore>(() => {
    const byId = (id: string) => labTasks.find((task) => task.id === id);
    const isDone = (id: string) => {
      const task = prodById.get(id);
      return task ? isTaskDone(task, columnConfig) : false;
    };

    // A status IS a column key. The four permanent lanes move canonically
    // (with positional reorder); any other key is a custom-column claim,
    // persisted through the column-aware dispatcher — the raw-text lane
    // write that used to serve the Waiting column is gone.
    const moveStatus = (id: string, status: TaskStatus, index?: number) => {
      if (readOnly) return;
      if ((LANE_ORDER as string[]).includes(status)) {
        const lane = status as LaneId;
        if (typeof index === "number") prod.reorderTask(id, lane, index);
        else prod.moveTask(id, lane);
        return;
      }
      prod.moveTaskToColumn(id, status);
    };

    return {
      // ---- state ----
      tasks: labTasks,
      initialTasks: labTasks,
      selectedIds: ui.selectedIds,
      selectionAnchorId: ui.selectionAnchorId,
      activeId: ui.activeId,
      inspectedId: taskPanel.taskId,
      recentlyPlacedId: ui.recentlyPlacedId,
      recentlyUpdatedId: ui.recentlyUpdatedId,
      recentlyCompletedId: ui.recentlyCompletedId,
      previewId: ui.previewId,
      editing: ui.editing,
      drag: ui.drag,
      readOnly,
      savedViewKeys: ui.savedViewKeys,
      announcement: ui.announcement,
      undo: null,

      // ---- derived ----
      taskById: byId,
      tasksByStatus: (status) =>
        labTasks.filter((task) => task.status === status).sort((a, b) => a.order - b.order),

      // ---- UI-only ----
      setActive: (id) => dispatch({ type: "SET_ACTIVE", id }),
      openTask,
      setPreview: (id) => dispatch({ type: "SET_PREVIEW", id }),
      setEditing: (taskId, field) => dispatch({ type: "SET_EDITING", editing: { taskId, field } }),
      clearEditing: () => dispatch({ type: "SET_EDITING", editing: null }),
      setDrag: (drag) => dispatch({ type: "SET_DRAG", drag }),
      toggleSelected: (id, orderedIds, range) => dispatch({ type: "TOGGLE_SELECTED", id, orderedIds, range }),
      clearSelection: () => dispatch({ type: "CLEAR_SELECTION" }),
      saveView: (key) => dispatch({ type: "SAVE_VIEW", key }),
      undoLast: () => dispatch({ type: "ANNOUNCE", message: "Undo is not available on live data" }),
      reset: () => dispatch({ type: "ANNOUNCE", message: "Live workspace" }),

      // ---- mutations → production dispatchers ----
      updateTask: (id, fields: UpdateFields) => {
        if (readOnly) return;
        // Column membership and completion are workflow moves, not field
        // patches — route them through their dispatchers so claims and
        // completion always persist correctly.
        const { status, completed, ...rest } = fields;
        if (status !== undefined) moveStatus(id, status);
        if (completed !== undefined && isDone(id) !== completed) {
          prod.toggleComplete(id);
        }
        const patch = fieldsPatch(rest, calendar);
        if (patch) prod.updateTask(id, patch);
      },
      updateTitle: (id, title) => !readOnly && prod.updateTask(id, { title }),
      updatePriority: (id, priority: TaskPriority) =>
        !readOnly && prod.updateTask(id, { priority: labToPriority(priority) }),
      updateAssignees: (id, assigneeIds) => !readOnly && prod.updateTask(id, { assignees: assigneeIds }),
      scheduleTask: (id, schedule) => applySchedule(id, schedule),
      scheduleOn: (id, date: CalendarDate) => applySchedule(id, { kind: "due", dueOn: date }),
      unscheduleTask: (id) => applySchedule(id, { kind: "unscheduled" }),
      moveStatus,
      moveScheduleByDays: (id, days) => {
        const task = prodById.get(id);
        if (!task) return;
        const schedule = taskToSchedule(task, calendar);
        if (schedule.kind === "unscheduled") return;
        applySchedule(id, moveSchedule(schedule, days));
      },
      resizeScheduleByDays: (id, days) => {
        const task = prodById.get(id);
        if (!task) return;
        const schedule = taskToSchedule(task, calendar);
        if (schedule.kind !== "range") return;
        applySchedule(id, resizeScheduleEnd(schedule, days));
      },
      bulkStatus: (status) => {
        if (readOnly) return;
        ui.selectedIds.forEach((id) => moveStatus(id, status));
      },
      bulkComplete: (completed = true) => {
        if (readOnly) return;
        ui.selectedIds.forEach((id) => {
          if (isDone(id) !== completed) prod.toggleComplete(id);
        });
      },
      bulkDelete: () => {
        if (readOnly) return;
        ui.selectedIds.forEach((id) => prod.removeTask(id));
        dispatch({ type: "CLEAR_SELECTION" });
      },
      toggleComplete: (id) => !readOnly && prod.toggleComplete(id),
      addTask: (status, schedule?: TaskSchedule, title?: string) => {
        if (readOnly) return;
        const trimmed = title?.trim();
        // A status IS a column key (T·121) — but only a key this workspace
        // actually has. A caller holding a stale key (the lab's retired
        // "queued") must land at the top of the board, never claim a
        // phantom column no surface can render: that orphaned the task.
        const columns = resolveBoardColumns(columnConfig);
        const key = columnByKey(columns, status)?.key ?? columns[0]?.key ?? "todo";
        const isLaneKey = (LANE_ORDER as string[]).includes(key);
        const lane = isLaneKey ? (key as LaneId) : "doing";
        const patch = schedule ? scheduleToPatch(schedule, calendar) : {};
        const created = prod.addTask({
          title: trimmed || "Untitled task",
          lane,
          priority: "p2",
          ...(patch.dueAt ? { dueAt: patch.dueAt, due: patch.due } : {}),
        });
        // A custom-column add claims the new task for that column; its
        // lane stays canonical ("doing").
        if (!isLaneKey) prod.moveTaskToColumn(created.id, key);
        if (schedule && (patch.startDay != null || patch.durationDays != null)) {
          prod.updateTask(created.id, { startDay: patch.startDay, durationDays: patch.durationDays });
        }
        dispatch({ type: "SET_PLACED", id: created.id });
        // Titled adds come from the board's inline composer: the author is
        // mid-flow adding several tasks, so the panel must not steal focus.
        // Untitled adds still open the panel to be named.
        if (!trimmed) openTask(created.id);
      },
      deleteTask: (id) => !readOnly && prod.removeTask(id),
      duplicateTask: (id) => {
        if (readOnly) return;
        pendingDuplicate.current = true;
        prod.duplicateTask(id);
      },
      archiveTask: (id: string) => { if (!readOnly) prod.archiveTask(id); },
      makeSubtaskOf: (id: string, parentId: string | null) => { if (!readOnly) prod.setParent(id, parentId); },
    };
  }, [applySchedule, calendar, columnConfig, labTasks, openTask, prod, prodById, readOnly, taskPanel.taskId, ui]);

  return <LabStoreContext.Provider value={value}>{children}</LabStoreContext.Provider>;
}
