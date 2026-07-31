export const LAB_OPTIONS = ["a", "b", "c", "hybrid"] as const;
export const LAB_VIEWS = ["board", "list", "timeline", "calendar"] as const;
export const LAB_DATASETS = ["sparse", "normal", "dense", "edge"] as const;
export const LAB_DENSITIES = ["compact", "comfortable"] as const;
export const LAB_MODES = ["default", "empty", "loading", "error", "readonly"] as const;
export const TASK_PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type LabOption = (typeof LAB_OPTIONS)[number];
export type LabView = (typeof LAB_VIEWS)[number];
export type LabDataset = (typeof LAB_DATASETS)[number];
export type LabDensity = (typeof LAB_DENSITIES)[number];
export type LabMode = (typeof LAB_MODES)[number];
/**
 * T·120: a task's status IS its board column key — one of the four
 * permanent lanes (todo/doing/review/done) or a custom column key such as
 * the default "waiting". The five-value const this replaced is gone; the
 * column set now comes from the workspace config via useBoardColumns().
 */
export type TaskStatus = string;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type CalendarDate = `${number}-${number}-${number}`;

export type TaskSchedule =
  | { kind: "unscheduled" }
  | { kind: "due"; dueOn: CalendarDate }
  | { kind: "range"; startOn: CalendarDate; dueOn: CalendarDate }
  | { kind: "milestone"; on: CalendarDate };

export type LabPerson = {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
};

export type LabLabel = {
  id: string;
  name: string;
  tone: "neutral" | "accent" | "success" | "warning" | "danger";
};

export type LabSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type LabAttachment = {
  id: string;
  name: string;
  kind: string;
  size: string;
  state?: "ready" | "error";
};

export type LabComment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type LabTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  schedule: TaskSchedule;
  estimate?: string;
  labelIds: string[];
  subtasks: LabSubtask[];
  attachments: LabAttachment[];
  comments: LabComment[];
  blockedByIds: string[];
  blockerIds: string[];
  completed: boolean;
  completedAt?: string;
  workspaceId: string;
  order: number;
};

export type LabRouteState = {
  option: LabOption;
  view: LabView;
  dataset: LabDataset;
  density: LabDensity;
  mode: LabMode;
  task: string | null;
};

export type LabDragOperation =
  | {
      kind: "board";
      taskId: string;
      fromStatus: TaskStatus;
      overStatus: TaskStatus | null;
      overIndex: number | null;
    }
  | {
      kind: "schedule";
      taskId: string;
      source: "timeline-tray" | "timeline" | "calendar";
      targetDate: CalendarDate | null;
    }
  | null;

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const OPTION_LABELS: Record<LabOption, string> = {
  a: "Quiet Command",
  b: "Editorial Project Room",
  c: "Signal Spatial",
  hybrid: "Recommended hybrid",
};

export const VIEW_LABELS: Record<LabView, string> = {
  board: "Board",
  list: "List",
  timeline: "Schedule",
  calendar: "Calendar",
};

export const DATASET_LABELS: Record<LabDataset, string> = {
  sparse: "Sparse",
  normal: "Normal",
  dense: "Dense",
  edge: "Edge cases",
};

export const MODE_LABELS: Record<LabMode, string> = {
  default: "Default",
  empty: "Empty",
  loading: "Loading",
  error: "Error",
  readonly: "Read-only",
};
