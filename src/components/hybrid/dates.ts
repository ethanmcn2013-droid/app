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
