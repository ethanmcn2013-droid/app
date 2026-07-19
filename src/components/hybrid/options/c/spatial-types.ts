import type { LabTask } from "../../types";

export type SpatialFilter =
  | "all"
  | "mine"
  | "unscheduled"
  | "blocked"
  | "overdue"
  | `status:${LabTask["status"]}`;

export type SpatialSort = "manual" | "due" | "priority" | "title";
export type SpatialGroup = "status" | "priority";

export type ListFieldKey =
  | "status"
  | "assignees"
  | "schedule"
  | "priority"
  | "progress"
  | "signals";

export type ListField = {
  key: ListFieldKey;
  label: string;
  visible: boolean;
  width: number;
};

export const INITIAL_LIST_FIELDS: ListField[] = [
  { key: "status", label: "Status", visible: true, width: 132 },
  { key: "assignees", label: "Assignees", visible: true, width: 144 },
  { key: "schedule", label: "Schedule", visible: true, width: 148 },
  { key: "priority", label: "Priority", visible: true, width: 104 },
  { key: "progress", label: "Subtasks", visible: true, width: 102 },
  { key: "signals", label: "Signals", visible: false, width: 112 },
];

export type CalendarDisplay = "month" | "week" | "agenda";
export type TimelineZoom = "fortnight" | "month" | "six-weeks";

export type ScheduleDragMode = "move" | "resize-start" | "resize-end";
