// Adapter between the production Task model (src/lib/data) and the ported
// design-lab LabTask model (./types). This is the single seam that lets the
// verbatim hybrid views render real production data. It is intentionally the
// ONLY place that knows both shapes.
//
// Status vocabulary (founder decision, 2026-07-19): the hybrid runs a 5-status
// model. Production lane ids stay the canonical 4 (todo/doing/review/done);
// the 5th status `waiting` is persisted as raw `lane` text via updateTaskAction
// (the lane column is unconstrained and the action allowlist is by column name,
// not value) so no schema/type migration is needed.

import type { LaneId, Priority, Task } from "@/lib/data";
import { addDays, asCalendarDate, differenceInDays } from "./dates";
import { LAB_TODAY } from "./dates";
import type {
  CalendarDate,
  LabLabel,
  LabPerson,
  LabTask,
  TaskPriority,
  TaskSchedule,
  TaskStatus,
} from "./types";

// The lab anchors its calendar/timeline windows on LAB_TODAY. Production
// timeline positions are relative day offsets (startDay 0-13); we anchor them
// to LAB_TODAY so real work lands inside the window the founder approved.
const ANCHOR: CalendarDate = LAB_TODAY;

export const LANE_TO_STATUS: Record<string, TaskStatus> = {
  todo: "queued",
  doing: "active",
  review: "review",
  waiting: "waiting",
  done: "done",
};

export const STATUS_TO_LANE: Record<TaskStatus, LaneId> = {
  queued: "todo",
  active: "doing",
  review: "review",
  // `waiting` has no canonical production lane; persisted as raw text.
  waiting: "waiting" as LaneId,
  done: "done",
};

const PRIORITY_TO_LAB: Record<Priority, TaskPriority> = {
  p0: "urgent",
  p1: "high",
  p2: "normal",
  p3: "low",
};

const LAB_TO_PRIORITY: Record<TaskPriority, Priority> = {
  urgent: "p0",
  high: "p1",
  normal: "p2",
  low: "p3",
};

export function laneToStatus(lane: string): TaskStatus {
  return LANE_TO_STATUS[lane] ?? "queued";
}

export function statusToLane(status: TaskStatus): LaneId {
  return STATUS_TO_LANE[status] ?? "todo";
}

export function priorityToLab(priority: Priority): TaskPriority {
  return PRIORITY_TO_LAB[priority] ?? "normal";
}

export function labToPriority(priority: TaskPriority): Priority {
  return LAB_TO_PRIORITY[priority] ?? "p2";
}

function toCalendarDate(value: Date | string | null | undefined): CalendarDate | null {
  if (!value) return null;
  const iso = typeof value === "string" ? value : value.toISOString();
  const day = iso.slice(0, 10);
  try {
    return asCalendarDate(day);
  } catch {
    return null;
  }
}

// Production date fields → lab schedule union.
export function taskToSchedule(task: Task): TaskSchedule {
  const dueDate = toCalendarDate(task.dueAt ?? null);
  if (task.isMilestone && dueDate) {
    return { kind: "milestone", on: dueDate };
  }
  if (typeof task.startDay === "number") {
    const startOn = addDays(ANCHOR, task.startDay);
    const span = Math.max(1, task.durationDays ?? 1);
    const dueOn = addDays(startOn, span - 1);
    return { kind: "range", startOn, dueOn };
  }
  if (dueDate) {
    return { kind: "due", dueOn: dueDate };
  }
  return { kind: "unscheduled" };
}

// Lab schedule union → production patch (persisted through updateTaskAction).
// isMilestone is a structural column stripped by updateTaskAction, so milestone
// scheduling persists its date via dueAt and the flag is handled separately by
// the store bridge through setTaskMilestoneAction when needed.
export function scheduleToPatch(schedule: TaskSchedule): Partial<Task> {
  switch (schedule.kind) {
    case "unscheduled":
      return { startDay: null as unknown as undefined, durationDays: null as unknown as undefined, dueAt: null as unknown as undefined };
    case "due":
      return {
        startDay: null as unknown as undefined,
        durationDays: null as unknown as undefined,
        dueAt: new Date(`${schedule.dueOn}T09:00:00.000Z`),
        due: schedule.dueOn,
      };
    case "milestone":
      return {
        startDay: null as unknown as undefined,
        durationDays: null as unknown as undefined,
        dueAt: new Date(`${schedule.on}T09:00:00.000Z`),
        due: schedule.on,
      };
    case "range": {
      const startDay = differenceInDays(ANCHOR, schedule.startOn);
      const durationDays = Math.max(1, differenceInDays(schedule.startOn, schedule.dueOn) + 1);
      return {
        startDay,
        durationDays,
        dueAt: new Date(`${schedule.dueOn}T09:00:00.000Z`),
        due: schedule.dueOn,
      };
    }
  }
}

// ---- People + label runtime registries -------------------------------------
// The verbatim views resolve avatars/labels via personById/labelById imported
// from ./fixtures. Those helpers consult these registries, which the mount
// populates from real workspace data. Fallbacks keep the lab route working.

export function userToPerson(userId: string, meta?: { name?: string; initials?: string; color?: string; role?: string }): LabPerson {
  const name = meta?.name ?? userId;
  const initials = meta?.initials ?? name.slice(0, 2).toUpperCase();
  return {
    id: userId,
    name,
    initials,
    role: meta?.role ?? "",
    color: meta?.color ?? "var(--accent-hover)",
  };
}

const LABEL_TONES = ["neutral", "accent", "success", "warning", "danger"] as const;
type LabelTone = (typeof LABEL_TONES)[number];

const COLOR_TO_TONE: Record<string, LabelTone> = {
  neutral: "neutral",
  sky: "accent",
  indigo: "accent",
  violet: "accent",
  emerald: "success",
  teal: "success",
  amber: "warning",
  rose: "danger",
  pink: "danger",
};

export function tagToLabel(name: string, color?: string): LabLabel {
  return { id: name, name, tone: color ? COLOR_TO_TONE[color] ?? "neutral" : "neutral" };
}

// ---- Task mapping -----------------------------------------------------------

export function taskToLab(task: Task, order: number): LabTask {
  const subtaskCount = task.subtaskCount ?? 0;
  const subtaskDone = task.subtaskDone ?? 0;
  // The list/board render subtask ratios from the subtasks array length; we
  // synthesize lightweight placeholders so the ratio reads correctly without a
  // second round-trip. Titles are only shown when a row is expanded, which the
  // production top-level fetch does not hydrate.
  const subtasks = Array.from({ length: subtaskCount }, (_, i) => ({
    id: `${task.id}:sub:${i}`,
    title: "",
    completed: i < subtaskDone,
  }));
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: laneToStatus(task.lane),
    priority: priorityToLab(task.priority),
    assigneeIds: task.assignees ?? [],
    schedule: taskToSchedule(task),
    estimate: typeof task.estimate === "number" ? `${task.estimate}h` : undefined,
    labelIds: task.tags ?? [],
    subtasks,
    attachments: [],
    comments: Array.from({ length: task.comments ?? 0 }, (_, i) => ({
      id: `${task.id}:c:${i}`,
      authorId: "",
      body: "",
      createdAt: "",
    })),
    blockedByIds: task.blockedBy ?? [],
    blockerIds: [],
    completed: task.lane === "done",
    workspaceId: task.workspaceId ?? "workspace",
    order,
  };
}

// General lab UpdateFields patch → production Task patch. Returns null when
// nothing maps to a persistable column.
export function fieldsPatch(fields: Partial<LabTask>): Partial<Task> | null {
  const patch: Partial<Task> = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.status !== undefined) patch.lane = statusToLane(fields.status);
  if (fields.priority !== undefined) patch.priority = labToPriority(fields.priority);
  if (fields.assigneeIds !== undefined) patch.assignees = fields.assigneeIds;
  if (fields.labelIds !== undefined) patch.tags = fields.labelIds;
  if (fields.blockedByIds !== undefined) patch.blockedBy = fields.blockedByIds;
  if (fields.schedule !== undefined) Object.assign(patch, scheduleToPatch(fields.schedule));
  if (fields.completed !== undefined) patch.lane = fields.completed ? "done" : "doing";
  return Object.keys(patch).length > 0 ? patch : null;
}

export function estimateToHours(estimate: string | undefined): number | undefined {
  if (!estimate) return undefined;
  const match = estimate.match(/([\d.]+)/);
  return match ? Number(match[1]) : undefined;
}
