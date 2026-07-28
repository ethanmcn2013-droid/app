import type { CalendarDate, LabTask, TaskSchedule } from "./types";

const DEFAULT_LOCALE = "en-GB";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDate(value: CalendarDate): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function asCalendarDate(value: string): CalendarDate {
  if (!DATE_PATTERN.test(value) || Number.isNaN(toUtcDate(value as CalendarDate).getTime())) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return value as CalendarDate;
}

export function addDays(value: CalendarDate, amount: number): CalendarDate {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10) as CalendarDate;
}

export function differenceInDays(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.localeCompare(b);
}

export function eachDate(from: CalendarDate, to: CalendarDate): CalendarDate[] {
  const count = Math.max(0, differenceInDays(from, to));
  return Array.from({ length: count + 1 }, (_, index) => addDays(from, index));
}

export function startOfWeek(value: CalendarDate): CalendarDate {
  const date = toUtcDate(value);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(value, -mondayOffset);
}

export function startOfMonthGrid(value: CalendarDate): CalendarDate {
  const monthStart = `${value.slice(0, 7)}-01` as CalendarDate;
  return startOfWeek(monthStart);
}

export function formatDate(
  value: CalendarDate,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    ...options,
  }).format(toUtcDate(value));
}

export function formatDateLong(value: CalendarDate): string {
  return formatDate(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatSchedule(schedule: TaskSchedule): string {
  switch (schedule.kind) {
    case "unscheduled":
      return "Unscheduled";
    case "due":
      return `Due ${formatDate(schedule.dueOn)}`;
    case "milestone":
      return `Milestone · ${formatDate(schedule.on)}`;
    case "range":
      return `${formatDate(schedule.startOn)}–${formatDate(schedule.dueOn)}`;
  }
}

/**
 * Board-facing schedule label, resolved against today.
 *
 * `formatSchedule` above gives the absolute date and stays the label for
 * tooltips, live-region announcements and the Schedule view, where the exact
 * date is the point. On a card the absolute date makes the reader do the
 * arithmetic: a board that reads "Due 28 Jul" on the 28th of July is not
 * telling you the thing is due today. Relative wins inside a week either
 * side of today; beyond that the date carries more than a large day count.
 */
export function formatScheduleRelative(schedule: TaskSchedule, today: CalendarDate): string {
  const end = scheduleEnd(schedule);
  if (schedule.kind === "unscheduled" || end === null) return "Unscheduled";

  const days = differenceInDays(today, end);
  let relative: string | null = null;
  if (days === 0) relative = "today";
  else if (days === 1) relative = "tomorrow";
  else if (days === -1) relative = "yesterday";
  else if (days > 1 && days <= 7) relative = `in ${days} days`;
  else if (days < -1 && days >= -7) relative = `${Math.abs(days)} days ago`;

  switch (schedule.kind) {
    case "due":
      return relative ? `Due ${relative}` : `Due ${formatDate(schedule.dueOn)}`;
    case "milestone":
      return relative ? `Milestone · ${relative}` : `Milestone · ${formatDate(schedule.on)}`;
    case "range":
      // An overdue or long range keeps both ends: "ends yesterday" loses the
      // fact that the work had a start date that has also passed.
      return relative && days >= 0 ? `Ends ${relative}` : formatSchedule(schedule);
  }
}

/**
 * Due today and not yet done. Distinct from overdue: today is a nudge, not
 * an alarm, and the board colours the two differently.
 */
export function isTaskDueToday(task: LabTask, today: CalendarDate): boolean {
  if (task.completed) return false;
  const end = scheduleEnd(task.schedule);
  return end !== null && compareDates(end, today) === 0;
}

export function scheduleStart(schedule: TaskSchedule): CalendarDate | null {
  switch (schedule.kind) {
    case "unscheduled":
      return null;
    case "due":
      return schedule.dueOn;
    case "milestone":
      return schedule.on;
    case "range":
      return schedule.startOn;
  }
}

export function scheduleEnd(schedule: TaskSchedule): CalendarDate | null {
  switch (schedule.kind) {
    case "unscheduled":
      return null;
    case "due":
      return schedule.dueOn;
    case "milestone":
      return schedule.on;
    case "range":
      return schedule.dueOn;
  }
}

export function scheduleIncludes(schedule: TaskSchedule, value: CalendarDate): boolean {
  const start = scheduleStart(schedule);
  const end = scheduleEnd(schedule);
  return start !== null && end !== null && compareDates(start, value) <= 0 && compareDates(end, value) >= 0;
}

export function moveSchedule(schedule: TaskSchedule, days: number): TaskSchedule {
  switch (schedule.kind) {
    case "unscheduled":
      return schedule;
    case "due":
      return { kind: "due", dueOn: addDays(schedule.dueOn, days) };
    case "milestone":
      return { kind: "milestone", on: addDays(schedule.on, days) };
    case "range":
      return {
        kind: "range",
        startOn: addDays(schedule.startOn, days),
        dueOn: addDays(schedule.dueOn, days),
      };
  }
}

export function resizeScheduleEnd(schedule: TaskSchedule, days: number): TaskSchedule {
  if (schedule.kind !== "range") return schedule;
  const proposed = addDays(schedule.dueOn, days);
  return {
    ...schedule,
    dueOn: compareDates(proposed, schedule.startOn) < 0 ? schedule.startOn : proposed,
  };
}

export function isTaskOverdue(task: LabTask, today: CalendarDate): boolean {
  if (task.completed) return false;
  const end = scheduleEnd(task.schedule);
  return end !== null && compareDates(end, today) < 0;
}

export function monthTitle(value: CalendarDate): string {
  return formatDate(value, { month: "long", year: "numeric" });
}
