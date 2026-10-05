/**
 * The figures the Tasks header states, as a pure model: how much was
 * finished this week, how much is open, what is late, and which started
 * work has sat still.
 *
 * Nothing here is estimated. Every figure is counted from the project's own
 * tasks and the calendar frame, so the header, the cards and the list rows
 * can never disagree, and the server and the browser reach the same answer.
 *
 * Stuck uses the rule My tasks already applies to "needs attention": work
 * that has been started (it has left the first column and is not finished)
 * and has not changed for four days or more.
 */

import { calendarDateInTimeZone } from "@/lib/planning/dates";

/** Started work counts as stuck once it has gone this many days unchanged. */
export const STUCK_AFTER_DAYS = 4;

const DAY_MS = 86_400_000;

type Frame = Readonly<{ today: string; timeZone: string }>;

function toUTC(iso: string): number {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole days between a calendar date and the frame's today (0 when ahead). */
function daysSince(dateIso: string, today: string): number {
  return Math.max(0, Math.round((toUTC(today) - toUTC(dateIso)) / DAY_MS));
}

/**
 * Days a task has gone unchanged. `idleDays` wins when the record carries
 * it (the same precedence My tasks uses); otherwise the last change is read
 * as a calendar date in the project's time zone.
 */
export function unchangedDays(
  record: Readonly<{ updatedAt?: Date | null; idleDays?: number | null }>,
  frame: Frame,
): number {
  if (typeof record.idleDays === "number" && Number.isFinite(record.idleDays)) return Math.max(0, Math.floor(record.idleDays));
  const at = record.updatedAt;
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return 0;
  return daysSince(calendarDateInTimeZone(at, frame.timeZone), frame.today);
}

export type PulseTask = Readonly<{
  id: string;
  title: string;
  /** The column the task sits in. */
  status: string;
  done: boolean;
  /** ISO instant the task was finished, when it is. */
  completedAt?: string;
  /** The due date as a calendar date; null when the task has none. */
  dueOn: string | null;
  updatedAt?: Date | null;
  idleDays?: number | null;
}>;

export type StuckFact = Readonly<{ id: string; title: string; days: number; status: string }>;

export type TasksPulse = Readonly<{
  total: number;
  done: number;
  open: number;
  /** Finished in the seven days ending today, in the project's time zone. */
  doneThisWeek: number;
  late: number;
  dueToday: number;
  undated: number;
  /** Stuck work, longest unchanged first. */
  stuck: readonly StuckFact[];
}>;

/**
 * `firstColumn` is where work waits before it starts: a task still there is
 * queued, not stuck, however long it has waited.
 */
export function tasksPulse(tasks: readonly PulseTask[], firstColumn: string | undefined, frame: Frame): TasksPulse {
  let done = 0;
  let doneThisWeek = 0;
  let late = 0;
  let dueToday = 0;
  let undated = 0;
  const stuck: StuckFact[] = [];
  for (const task of tasks) {
    if (task.done) {
      done += 1;
      if (task.completedAt) {
        const finished = new Date(task.completedAt);
        if (!Number.isNaN(finished.getTime())) {
          const ago = Math.round((toUTC(frame.today) - toUTC(calendarDateInTimeZone(finished, frame.timeZone))) / DAY_MS);
          if (ago >= 0 && ago < 7) doneThisWeek += 1;
        }
      }
      continue;
    }
    if (task.dueOn === null) undated += 1;
    else if (task.dueOn < frame.today) late += 1;
    else if (task.dueOn === frame.today) dueToday += 1;
    if (task.status !== firstColumn) {
      const days = unchangedDays(task, frame);
      if (days >= STUCK_AFTER_DAYS) stuck.push({ id: task.id, title: task.title, days, status: task.status });
    }
  }
  stuck.sort((a, b) => b.days - a.days || a.title.localeCompare(b.title, "en-GB"));
  return { total: tasks.length, done, open: tasks.length - done, doneThisWeek, late, dueToday, undated, stuck };
}

/** "1 day", "7 days". Never "7d". */
export function dayWords(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** The share of the project that is finished, for the ring: 0 to 100. */
export function donePercent(pulse: Pick<TasksPulse, "total" | "done">): number {
  return pulse.total ? Math.round((pulse.done / pulse.total) * 100) : 0;
}
