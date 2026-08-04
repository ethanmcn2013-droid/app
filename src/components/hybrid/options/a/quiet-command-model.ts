import { addDays, compareDates, scheduleEnd, scheduleStart, startOfMonthGrid } from "../../dates";
import type { CalendarDate, LabTask, TaskPriority, TaskStatus } from "../../types";

export type QuietSort = "manual" | "due" | "priority" | "title";
export type QuietFilter = "all" | "open" | TaskStatus;
export type QuietGroup = "status" | "priority" | "none";

export type ListColumnId =
  | "title"
  | "status"
  | "assignees"
  | "schedule"
  | "priority"
  | "estimate"
  | "progress"
  | "activity";

export type ListColumn = {
  id: ListColumnId;
  label: string;
  visible: boolean;
  width: number;
  minWidth: number;
};

export const INITIAL_LIST_COLUMNS: ListColumn[] = [
  { id: "title", label: "Task", visible: true, width: 360, minWidth: 260 },
  { id: "status", label: "Status", visible: true, width: 132, minWidth: 112 },
  { id: "assignees", label: "Owner", visible: true, width: 180, minWidth: 112 },
  { id: "schedule", label: "Dates", visible: true, width: 154, minWidth: 126 },
  { id: "priority", label: "Priority", visible: true, width: 104, minWidth: 88 },
  { id: "estimate", label: "Estimate", visible: true, width: 88, minWidth: 76 },
  { id: "progress", label: "Subtasks", visible: false, width: 110, minWidth: 92 },
  { id: "activity", label: "Activity", visible: false, width: 118, minWidth: 96 },
];

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function scheduleKey(task: LabTask): string {
  return scheduleEnd(task.schedule) ?? "9999-12-31";
}

export function projectTasks(
  tasks: LabTask[],
  query: string,
  filter: QuietFilter,
  sort: QuietSort,
): LabTask[] {
  const normalized = query.trim().toLocaleLowerCase("en-GB");
  const projected = tasks.filter((task) => {
    const matchesQuery = !normalized
      || task.title.toLocaleLowerCase("en-GB").includes(normalized)
      || task.description.toLocaleLowerCase("en-GB").includes(normalized);
    const matchesFilter = filter === "all"
      || (filter === "open" ? !task.completed : task.status === filter);
    return matchesQuery && matchesFilter;
  });

  return [...projected].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "en-GB");
    if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order;
    if (sort === "due") return scheduleKey(a).localeCompare(scheduleKey(b)) || a.order - b.order;
    return a.order - b.order;
  });
}

export function reorderItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moving] = next.splice(from, 1);
  if (moving === undefined) return items;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moving);
  return next;
}

/**
 * Scope for the focus helpers below.
 *
 * These were written against the design lab, which wraps the views in
 * `[data-option="a"]`. Production mounts the same views through
 * HybridWorkspace, which has no such wrapper, so every one of these
 * selectors silently matched nothing: arrow-key movement between cards
 * looked implemented and did nothing in the shipped app. Fall back to the
 * document when the lab wrapper is absent.
 */
function focusScope(): ParentNode {
  // Production mounts the views inside the active work surface; the brief's
  // milestone rows (which also stamp data-task-id) live OUTSIDE it, so
  // scoping here keeps arrow-key movement on the cards. The lab wrapper and
  // the document remain as fallbacks.
  return (
    document.querySelector("[data-work-surface='true']") ??
    document.querySelector("[data-option='a']") ??
    document
  );
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}

export function focusTask(taskId: string): void {
  window.requestAnimationFrame(() => {
    const matches = [
      ...focusScope().querySelectorAll<HTMLElement>(`[data-task-id="${cssEscape(taskId)}"]`),
    ];
    // The workspace brief stamps `data-task-id` on its milestone rows too, so
    // prefer a node that can actually take focus (cards and list rows carry
    // tabindex; a plain <li> reports -1).
    const target = matches.find((element) => element.tabIndex >= 0) ?? matches[0];
    target?.focus();
  });
}

export function focusCalendarDate(date: CalendarDate): void {
  window.requestAnimationFrame(() => {
    focusScope()
      .querySelector<HTMLElement>(`[data-date-button="${cssEscape(date)}"]`)
      ?.focus();
  });
}

export function shiftMonth(value: CalendarDate, amount: number): CalendarDate {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10) as CalendarDate;
}

export function monthGrid(value: CalendarDate): CalendarDate[] {
  const start = startOfMonthGrid(value);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function dateSpan(task: LabTask): { start: CalendarDate; end: CalendarDate } | null {
  const start = scheduleStart(task.schedule);
  const end = scheduleEnd(task.schedule);
  return start && end ? { start, end } : null;
}

export function rangeSegment(task: LabTask, date: CalendarDate): "single" | "start" | "middle" | "end" {
  if (task.schedule.kind !== "range" || task.schedule.startOn === task.schedule.dueOn) return "single";
  if (compareDates(date, task.schedule.startOn) === 0) return "start";
  if (compareDates(date, task.schedule.dueOn) === 0) return "end";
  return "middle";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
