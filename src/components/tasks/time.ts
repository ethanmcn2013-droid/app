/**
 * One time fact per task, resolved once, in one grammar.
 *
 * Moved unchanged in spirit from the retired Floor board: every surface
 * (card, row, calendar chip, header facts) reads the same answer, so the
 * header's "1 overdue" and the red chip on the card can never disagree.
 * The calendar frame is the only clock: SSR and hydration agree on today.
 */

import type { CalendarFrame } from "@/lib/calendar-frame";
import { calendarDateInTimeZone } from "@/lib/planning/dates";
import type { LabTask } from "@/components/hybrid/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type TimeKind = "none" | "done" | "milestone" | "overdue" | "today" | "tomorrow" | "soon" | "later";

export type TimeFact = Readonly<{
  kind: TimeKind;
  /** Short chip text: "Today", "Fri", "18 Jul", "14 Jul, 2 days late". */
  label: string;
  /** Full sentence for tooltips and accessible names. */
  said: string;
  /** Days from today to the due date (negative when late); null when undated. */
  delta: number | null;
}>;

const NONE: TimeFact = { kind: "none", label: "", said: "", delta: null };

function toUTC(iso: string): number {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** "18 Jul" */
export function shortDate(iso: string): string {
  const d = new Date(toUTC(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Today, Tomorrow, Yesterday, a weekday inside the week, else "18 Jul". */
export function dayLabel(iso: string, todayIso: string): string {
  const days = Math.round((toUTC(iso) - toUTC(todayIso)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return WEEKDAYS[new Date(toUTC(iso)).getUTCDay()];
  return shortDate(iso);
}

function lateBy(days: number): string {
  const n = Math.abs(days);
  return `${n} ${n === 1 ? "day" : "days"} late`;
}

export function timeOf(
  task: LabTask,
  columnIsDone: boolean,
  calendar: Pick<CalendarFrame, "today" | "timeZone">,
): TimeFact {
  const today = calendar.today;
  if (task.completed || columnIsDone) {
    if (!task.completedAt) return NONE;
    const completed = new Date(task.completedAt);
    if (Number.isNaN(completed.getTime())) return NONE;
    const iso = calendarDateInTimeZone(completed, calendar.timeZone);
    const label = dayLabel(iso, today);
    return { kind: "done", label: `Done ${label === "Today" || label === "Yesterday" ? label.toLowerCase() : label}`, said: `Completed ${label.toLowerCase() === "today" ? "today" : label}`, delta: null };
  }
  if (task.schedule.kind === "milestone") {
    const on = task.schedule.on;
    const delta = Math.round((toUTC(on) - toUTC(today)) / 86_400_000);
    return { kind: "milestone", label: dayLabel(on, today), said: `Milestone, ${dayLabel(on, today)}`, delta };
  }
  const due = task.schedule.kind === "due" || task.schedule.kind === "range" ? task.schedule.dueOn : null;
  if (!due) return NONE;
  const delta = Math.round((toUTC(due) - toUTC(today)) / 86_400_000);
  if (delta < 0) {
    return { kind: "overdue", label: `${shortDate(due)}, ${lateBy(delta)}`, said: `Overdue, was due ${shortDate(due)}, ${lateBy(delta)}`, delta };
  }
  if (delta === 0) return { kind: "today", label: "Today", said: "Due today", delta };
  if (delta === 1) return { kind: "tomorrow", label: "Tomorrow", said: "Due tomorrow", delta };
  if (delta < 7) return { kind: "soon", label: dayLabel(due, today), said: `Due ${dayLabel(due, today)} ${shortDate(due)}`, delta };
  return { kind: "later", label: shortDate(due), said: `Due ${shortDate(due)}`, delta };
}

/** "Thu 16 Jul" for the header and day panes. */
export function weekdayDate(iso: string): string {
  const d = new Date(toUTC(iso));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
