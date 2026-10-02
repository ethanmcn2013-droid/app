import type { RecurrenceSpec } from "@/lib/data";
import { storedDeadline } from "./stored-deadline";

/** Preserve a proven picker day when an existing writer advances its date. */
export function isDateOnlyDue(due: string | null, dueAt: Date | null): boolean {
  return storedDeadline(due, dueAt)?.kind === "date-only";
}

export function advanceRecurringDueAt(from: Date, recurrence: RecurrenceSpec, dateOnly: boolean, now = Date.now()): Date {
  const d = new Date(from);
  const getDay = () => dateOnly ? d.getUTCDay() : d.getDay();
  const getDate = () => dateOnly ? d.getUTCDate() : d.getDate();
  const getMonth = () => dateOnly ? d.getUTCMonth() : d.getMonth();
  const setDate = (day: number) => dateOnly ? d.setUTCDate(day) : d.setDate(day);
  const setMonth = (month: number) => dateOnly ? d.setUTCMonth(month) : d.setMonth(month);
  const walkToWeekday = (weekday: number) => {
    for (let i = 0; i < 7 && getDay() !== weekday; i++) setDate(getDate() + 1);
  };

  if (recurrence.kind === "weekly") {
    setDate(getDate() + 7);
    walkToWeekday(recurrence.weekday);
  } else if (recurrence.kind === "monthly-day") {
    setMonth(getMonth() + 1);
    setDate(recurrence.day);
  } else if (recurrence.kind === "monthly-first-weekday") {
    setMonth(getMonth() + 1);
    setDate(1);
    walkToWeekday(recurrence.weekday);
  }

  for (let guard = 0; d.getTime() < now && guard < 600; guard++) {
    if (recurrence.kind === "weekly") setDate(getDate() + 7);
    else if (recurrence.kind === "monthly-day") {
      setMonth(getMonth() + 1);
      setDate(recurrence.day);
    } else if (recurrence.kind === "monthly-first-weekday") {
      setMonth(getMonth() + 1);
      setDate(1);
      walkToWeekday(recurrence.weekday);
    }
  }
  return d;
}

export function offsetStoredDueAt(from: Date, offsetDays: number, dateOnly: boolean): Date {
  const d = new Date(from);
  if (dateOnly) d.setUTCDate(d.getUTCDate() + offsetDays);
  else d.setDate(d.getDate() + offsetDays);
  return d;
}

export function dateOnlyDueLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}
