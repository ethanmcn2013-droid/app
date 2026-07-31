// Adapter between the production Task model (src/lib/data) and the ported
// design-lab LabTask model (./types). This is the single seam that lets the
// verbatim hybrid views render real production data. It is intentionally the
// ONLY place that knows both shapes.
//
// T·121: a LabTask's status IS its board column key, resolved by
// effectiveColumnKey — a claim (boardColumnKey) wins, else the lane, so a
// legacy row whose lane still holds raw "waiting" text resolves to the same
// column the migrated shape does. The old 5-status mapping (and the raw-text
// lane write it required) is gone: column moves persist ONLY through the
// column-aware dispatchers, never through a lane patch.

import type { Priority, Task } from "@/lib/data";
import type { CalendarFrame } from "@/lib/calendar-frame";
import { effectiveColumnKey, isTaskDone } from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";
import { addDays, asCalendarDate, differenceInDays } from "./dates";
import type {
  CalendarDate,
  LabLabel,
  LabPerson,
  LabTask,
  TaskPriority,
  TaskSchedule,
} from "./types";

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
export function taskToSchedule(
  task: Task,
  calendar?: CalendarFrame,
): TaskSchedule {
  const dueDate = toCalendarDate(task.dueAt ?? null);
  if (task.isMilestone && dueDate) {
    return { kind: "milestone", on: dueDate };
  }
  if (dueDate && typeof task.durationDays === "number" && task.durationDays > 1) {
    const span = Math.max(1, task.durationDays);
    return {
      kind: "range",
      startOn: addDays(dueDate, -(span - 1)),
      dueOn: dueDate,
    };
  }
  const periodStart = calendar?.planningPeriod?.startDate ?? null;
  if (periodStart && typeof task.startDay === "number") {
    const startOn = addDays(periodStart as CalendarDate, task.startDay);
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
export function scheduleToPatch(
  schedule: TaskSchedule,
  calendar?: CalendarFrame,
): Partial<Task> {
  const periodStart = calendar?.planningPeriod?.startDate ?? null;
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
      const durationDays = Math.max(1, differenceInDays(schedule.startOn, schedule.dueOn) + 1);
      return {
        startDay: periodStart
          ? differenceInDays(periodStart as CalendarDate, schedule.startOn)
          : null as unknown as undefined,
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

type LabelTone = "neutral" | "accent" | "success" | "warning" | "danger";

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

export function taskToLab(
  task: Task,
  order: number,
  calendar?: CalendarFrame,
  columnConfig: ColumnConfig | null = null,
): LabTask {
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
    status: effectiveColumnKey(task),
    priority: priorityToLab(task.priority),
    assigneeIds: task.assignees ?? [],
    schedule: taskToSchedule(task, calendar),
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
    completed: isTaskDone(task, columnConfig),
    completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
    cents: task.cents ?? null,
    workspaceId: task.workspaceId ?? "workspace",
    order,
  };
}

// General lab UpdateFields patch → production Task patch. Returns null when
// nothing maps to a persistable column. Column membership (`status`) and
// completion are deliberately NOT here: both are workflow moves that must
// persist through the column-aware dispatchers (moveStatus / toggleComplete)
// so a claim is never faked through a lane patch — the hybrid store splits
// them off before calling this.
export function fieldsPatch(
  fields: Partial<LabTask>,
  calendar?: CalendarFrame,
): Partial<Task> | null {
  const patch: Partial<Task> = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.priority !== undefined) patch.priority = labToPriority(fields.priority);
  if (fields.assigneeIds !== undefined) patch.assignees = fields.assigneeIds;
  if (fields.labelIds !== undefined) patch.tags = fields.labelIds;
  if (fields.blockedByIds !== undefined) patch.blockedBy = fields.blockedByIds;
  if (fields.schedule !== undefined) {
    Object.assign(patch, scheduleToPatch(fields.schedule, calendar));
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function estimateToHours(estimate: string | undefined): number | undefined {
  if (!estimate) return undefined;
  const match = estimate.match(/([\d.]+)/);
  return match ? Number(match[1]) : undefined;
}
