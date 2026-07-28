"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { addDays, formatSchedule, moveSchedule, resizeScheduleEnd } from "./dates";
import type {
  CalendarDate,
  LabDragOperation,
  LabTask,
  TaskPriority,
  TaskSchedule,
  TaskStatus,
} from "./types";
import { STATUS_LABELS } from "./types";

type StoreState = {
  tasks: LabTask[];
  initialTasks: LabTask[];
  selectedIds: string[];
  selectionAnchorId: string | null;
  activeId: string | null;
  inspectedId: string | null;
  previewId: string | null;
  editing: { taskId: string; field: string } | null;
  drag: LabDragOperation;
  readOnly: boolean;
  savedViewKeys: string[];
  announcement: string;
  undo: { label: string; tasks: LabTask[] } | null;
};

type UpdateFields = Partial<Pick<LabTask,
  "title" | "description" | "status" | "priority" | "assigneeIds" | "schedule" | "completed" | "completedAt" |
  "labelIds" | "subtasks" | "attachments" | "comments" | "blockedByIds" | "blockerIds"
>>;

type Action =
  | { type: "SET_ACTIVE"; id: string | null }
  | { type: "SET_INSPECTED"; id: string | null }
  | { type: "SET_PREVIEW"; id: string | null }
  | { type: "SET_EDITING"; editing: StoreState["editing"] }
  | { type: "SET_DRAG"; drag: LabDragOperation }
  | { type: "TOGGLE_SELECTED"; id: string; orderedIds?: string[]; range?: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "UPDATE_TASK"; id: string; fields: UpdateFields; label: string }
  | { type: "MOVE_STATUS"; id: string; status: TaskStatus; index?: number }
  | { type: "MOVE_SCHEDULE"; id: string; days: number }
  | { type: "RESIZE_SCHEDULE"; id: string; days: number }
  | { type: "BULK_STATUS"; status: TaskStatus }
  | { type: "BULK_COMPLETE"; completed: boolean; nowIso: string }
  | { type: "BULK_DELETE" }
  | { type: "ADD_TASK"; status: TaskStatus; schedule?: TaskSchedule; title?: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "DUPLICATE_TASK"; id: string }
  | { type: "SAVE_VIEW"; key: string }
  | { type: "UNDO" }
  | { type: "RESET" };

function snapshot(state: StoreState, label: string): Pick<StoreState, "undo"> {
  return { undo: { label, tasks: structuredClone(state.tasks) } };
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_ACTIVE":
      return { ...state, activeId: action.id };
    case "SET_INSPECTED":
      return { ...state, inspectedId: action.id };
    case "SET_PREVIEW":
      return { ...state, previewId: action.id };
    case "SET_EDITING":
      return { ...state, editing: action.editing };
    case "SET_DRAG":
      return { ...state, drag: action.drag };
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [], selectionAnchorId: null, announcement: "Selection cleared" };
    case "TOGGLE_SELECTED": { // selection remains independent from focus and inspection
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
    case "UPDATE_TASK": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task) return state;
      return {
        ...state,
        ...snapshot(state, action.label),
        tasks: state.tasks.map((item) => item.id === action.id ? { ...item, ...action.fields } : item),
        announcement: `${task.title}: ${action.label}`,
      };
    }
    case "MOVE_STATUS": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const moving = state.tasks.find((task) => task.id === action.id);
      if (!moving) return state;
      const statusTasks = state.tasks.filter((task) => task.status === action.status && task.id !== action.id);
      const index = Math.max(0, Math.min(action.index ?? statusTasks.length, statusTasks.length));
      statusTasks.splice(index, 0, { ...moving, status: action.status, completed: action.status === "done" });
      const ranks = new Map(statusTasks.map((task, rank) => [task.id, rank]));
      return {
        ...state,
        ...snapshot(state, `Move to ${STATUS_LABELS[action.status]}`),
        tasks: state.tasks.map((task) => task.id === action.id
          ? { ...task, status: action.status, completed: action.status === "done", order: index }
          : task.status === action.status
            ? { ...task, order: ranks.get(task.id) ?? task.order }
            : task),
        activeId: action.id,
        announcement: `${moving.title} moved to ${STATUS_LABELS[action.status]}, position ${index + 1}`,
      };
    }
    case "MOVE_SCHEDULE": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task || task.schedule.kind === "unscheduled") return state;
      const schedule = moveSchedule(task.schedule, action.days);
      return {
        ...state,
        ...snapshot(state, "Move schedule"),
        tasks: state.tasks.map((item) => item.id === action.id ? { ...item, schedule } : item),
        announcement: `${task.title} moved to ${formatSchedule(schedule)}`,
      };
    }
    case "RESIZE_SCHEDULE": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task || task.schedule.kind !== "range") return state;
      const schedule = resizeScheduleEnd(task.schedule, action.days);
      return {
        ...state,
        ...snapshot(state, "Resize date range"),
        tasks: state.tasks.map((item) => item.id === action.id ? { ...item, schedule } : item),
        announcement: `${task.title} resized to ${formatSchedule(schedule)}`,
      };
    }
    case "BULK_STATUS": {
      if (state.readOnly || state.selectedIds.length === 0) return state;
      const selected = new Set(state.selectedIds);
      return {
        ...state,
        ...snapshot(state, `Bulk move to ${STATUS_LABELS[action.status]}`),
        tasks: state.tasks.map((task) => selected.has(task.id)
          ? { ...task, status: action.status, completed: action.status === "done" }
          : task),
        announcement: `${selected.size} tasks moved to ${STATUS_LABELS[action.status]}`,
      };
    }
    case "BULK_COMPLETE": {
      if (state.readOnly || state.selectedIds.length === 0) return state;
      const selected = new Set(state.selectedIds);
      return {
        ...state,
        ...snapshot(state, action.completed ? "Complete selected" : "Reopen selected"),
        tasks: state.tasks.map((task) => selected.has(task.id) ? {
          ...task,
          completed: action.completed,
          status: action.completed ? "done" : task.status === "done" ? "active" : task.status,
          completedAt: action.completed ? action.nowIso : undefined,
        } : task),
        announcement: `${selected.size} tasks ${action.completed ? "completed" : "reopened"}`,
      };
    }
    case "BULK_DELETE": {
      if (state.readOnly || state.selectedIds.length === 0) return state;
      const selected = new Set(state.selectedIds);
      return {
        ...state,
        ...snapshot(state, "Delete selected tasks"),
        tasks: state.tasks.filter((task) => !selected.has(task.id)),
        selectedIds: [],
        selectionAnchorId: null,
        inspectedId: state.inspectedId && selected.has(state.inspectedId) ? null : state.inspectedId,
        announcement: `${selected.size} tasks deleted from this session`,
      };
    }
    case "ADD_TASK": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const count = state.tasks.filter((task) => task.id.startsWith("session-")).length + 1;
      const id = `session-${count}`;
      const titled = Boolean(action.title?.trim());
      const task: LabTask = {
        id,
        title: action.title?.trim() || "Untitled task",
        description: "Session-only design-lab task.",
        status: action.status,
        priority: "normal",
        assigneeIds: [],
        schedule: action.schedule ?? { kind: "unscheduled" },
        estimate: "1h",
        labelIds: [],
        subtasks: [],
        attachments: [],
        comments: [],
        blockedByIds: [],
        blockerIds: [],
        completed: false,
        workspaceId: "workspace-launch-2026",
        order: state.tasks.length,
      };
      return {
        ...state,
        ...snapshot(state, "Add task"),
        tasks: [...state.tasks, task],
        // A titled add comes from the inline composer: the author is mid-flow
        // on the board and the panel must not steal the keyboard. Untitled
        // adds (list/calendar affordances) still open for naming.
        inspectedId: titled ? state.inspectedId : id,
        activeId: id,
        announcement: `${task.title} added to ${STATUS_LABELS[action.status]}`,
      };
    }
    case "DELETE_TASK": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task) return state;
      return {
        ...state,
        ...snapshot(state, "Delete task"),
        tasks: state.tasks.filter((item) => item.id !== action.id),
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
        inspectedId: state.inspectedId === action.id ? null : state.inspectedId,
        announcement: `${task.title} deleted from this session`,
      };
    }
    case "DUPLICATE_TASK": {
      if (state.readOnly) return { ...state, announcement: "Read-only prototype: changes are disabled" };
      const task = state.tasks.find((item) => item.id === action.id);
      if (!task) return state;
      const id = `${task.id}-copy-${state.tasks.length + 1}`;
      return {
        ...state,
        ...snapshot(state, "Duplicate task"),
        tasks: [...state.tasks, { ...structuredClone(task), id, title: `${task.title} (copy)`, order: state.tasks.length }],
        inspectedId: id,
        announcement: `${task.title} duplicated in this session`,
      };
    }
    case "SAVE_VIEW": {
      if (state.savedViewKeys.includes(action.key)) {
        return { ...state, announcement: "This local view is already saved" };
      }
      return {
        ...state,
        savedViewKeys: [...state.savedViewKeys, action.key],
        announcement: "View saved for this mounted session",
      };
    }
    case "UNDO":
      if (!state.undo) return state;
      return {
        ...state,
        tasks: state.undo.tasks,
        announcement: `${state.undo.label} undone`,
        undo: null,
      };
    case "RESET":
      return {
        ...state,
        tasks: structuredClone(state.initialTasks),
        selectedIds: [],
        selectionAnchorId: null,
        activeId: null,
        inspectedId: null,
        previewId: null,
        editing: null,
        drag: null,
        undo: null,
        announcement: "Design-lab fixture reset",
      };
  }
}

export type LabStore = StoreState & {
  taskById: (id: string) => LabTask | undefined;
  tasksByStatus: (status: TaskStatus) => LabTask[];
  setActive: (id: string | null) => void;
  openTask: (id: string | null) => void;
  setPreview: (id: string | null) => void;
  setEditing: (taskId: string, field: string) => void;
  clearEditing: () => void;
  setDrag: (drag: LabDragOperation) => void;
  toggleSelected: (id: string, orderedIds?: string[], range?: boolean) => void;
  clearSelection: () => void;
  updateTask: (id: string, fields: UpdateFields, label: string) => void;
  updateTitle: (id: string, title: string) => void;
  updatePriority: (id: string, priority: TaskPriority) => void;
  updateAssignees: (id: string, assigneeIds: string[]) => void;
  scheduleTask: (id: string, schedule: TaskSchedule) => void;
  scheduleOn: (id: string, date: CalendarDate) => void;
  unscheduleTask: (id: string) => void;
  moveStatus: (id: string, status: TaskStatus, index?: number) => void;
  moveScheduleByDays: (id: string, days: number) => void;
  resizeScheduleByDays: (id: string, days: number) => void;
  bulkStatus: (status: TaskStatus) => void;
  bulkComplete: (completed?: boolean) => void;
  bulkDelete: () => void;
  toggleComplete: (id: string) => void;
  addTask: (status: TaskStatus, schedule?: TaskSchedule, title?: string) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  saveView: (key: string) => void;
  undoLast: () => void;
  reset: () => void;
};

export const LabStoreContext = createContext<LabStore | null>(null);
export type { UpdateFields };

export function LabStoreProvider({
  children,
  initialTasks,
  initialInspectedId,
  readOnly,
  onInspectedChange,
}: {
  children: ReactNode;
  initialTasks: LabTask[];
  initialInspectedId: string | null;
  readOnly: boolean;
  onInspectedChange: (id: string | null) => void;
}) {
  const calendar = useCalendarFrame();
  const [state, dispatch] = useReducer(reducer, {
    tasks: structuredClone(initialTasks),
    initialTasks: structuredClone(initialTasks),
    selectedIds: [],
    selectionAnchorId: null,
    activeId: null,
    inspectedId: initialTasks.some((task) => task.id === initialInspectedId) ? initialInspectedId : null,
    previewId: null,
    editing: null,
    drag: null,
    readOnly,
    savedViewKeys: [],
    announcement: "Design lab ready",
    undo: null,
  });

  const openTask = useCallback((id: string | null) => {
    dispatch({ type: "SET_INSPECTED", id });
    onInspectedChange(id);
  }, [onInspectedChange]);

  const setPreview = useCallback((id: string | null) => {
    dispatch({ type: "SET_PREVIEW", id });
  }, []);

  const value = useMemo<LabStore>(() => ({
    ...state,
    taskById: (id) => state.tasks.find((task) => task.id === id),
    tasksByStatus: (status) => state.tasks.filter((task) => task.status === status).sort((a, b) => a.order - b.order),
    setActive: (id) => dispatch({ type: "SET_ACTIVE", id }),
    openTask,
    setPreview,
    setEditing: (taskId, field) => dispatch({ type: "SET_EDITING", editing: { taskId, field } }),
    clearEditing: () => dispatch({ type: "SET_EDITING", editing: null }),
    setDrag: (drag) => dispatch({ type: "SET_DRAG", drag }),
    toggleSelected: (id, orderedIds, range) => dispatch({ type: "TOGGLE_SELECTED", id, orderedIds, range }),
    clearSelection: () => dispatch({ type: "CLEAR_SELECTION" }),
    updateTask: (id, fields, label) => dispatch({ type: "UPDATE_TASK", id, fields, label }),
    updateTitle: (id, title) => dispatch({ type: "UPDATE_TASK", id, fields: { title }, label: "Title updated" }),
    updatePriority: (id, priority) => dispatch({ type: "UPDATE_TASK", id, fields: { priority }, label: `Priority set to ${priority}` }),
    updateAssignees: (id, assigneeIds) => dispatch({ type: "UPDATE_TASK", id, fields: { assigneeIds }, label: "Assignees updated" }),
    scheduleTask: (id, schedule) => dispatch({ type: "UPDATE_TASK", id, fields: { schedule }, label: `Scheduled ${formatSchedule(schedule)}` }),
    scheduleOn: (id, date) => dispatch({ type: "UPDATE_TASK", id, fields: { schedule: { kind: "due", dueOn: date } }, label: `Scheduled for ${date}` }),
    unscheduleTask: (id) => dispatch({ type: "UPDATE_TASK", id, fields: { schedule: { kind: "unscheduled" } }, label: "Unscheduled" }),
    moveStatus: (id, status, index) => dispatch({ type: "MOVE_STATUS", id, status, index }),
    moveScheduleByDays: (id, days) => dispatch({ type: "MOVE_SCHEDULE", id, days }),
    resizeScheduleByDays: (id, days) => dispatch({ type: "RESIZE_SCHEDULE", id, days }),
    bulkStatus: (status) => dispatch({ type: "BULK_STATUS", status }),
    bulkComplete: (completed = true) => dispatch({
      type: "BULK_COMPLETE",
      completed,
      nowIso: calendar.nowIso,
    }),
    bulkDelete: () => dispatch({ type: "BULK_DELETE" }),
    toggleComplete: (id) => {
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return;
      dispatch({
        type: "UPDATE_TASK",
        id,
        fields: {
          completed: !task.completed,
          status: !task.completed ? "done" : "active",
          completedAt: !task.completed ? calendar.nowIso : undefined,
        },
        label: !task.completed ? "Completed" : "Reopened",
      });
    },
    addTask: (status, schedule, title) => dispatch({ type: "ADD_TASK", status, schedule, title }),
    deleteTask: (id) => dispatch({ type: "DELETE_TASK", id }),
    duplicateTask: (id) => dispatch({ type: "DUPLICATE_TASK", id }),
    saveView: (key) => dispatch({ type: "SAVE_VIEW", key }),
    undoLast: () => dispatch({ type: "UNDO" }),
    reset: () => dispatch({ type: "RESET" }),
  }), [calendar.nowIso, openTask, setPreview, state]);

  return <LabStoreContext.Provider value={value}>{children}</LabStoreContext.Provider>;
}

export function useLabStore(): LabStore {
  const store = useContext(LabStoreContext);
  if (!store) throw new Error("useLabStore must be used inside LabStoreProvider");
  return store;
}

export function scheduleFromDrop(date: CalendarDate): TaskSchedule {
  return { kind: "range", startOn: date, dueOn: addDays(date, 0) };
}
