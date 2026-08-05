// Planning selectors — the ONE definition of "work that still needs a
// date". The drawer list, the band badge, the tab count and the empty
// state all read this selector, so they can never disagree; and finished
// work is never presented as something to schedule.

import { addDays } from "./dates";
import type { CalendarDate, LabTask } from "./types";

/**
 * Tasks that genuinely await scheduling: in the current scope, not
 * completed, and explicitly without a date. Completed-but-dateless work
 * is history, not a planning obligation.
 */
export function activeUnscheduledTasks(tasks: LabTask[]): LabTask[] {
  return tasks.filter((task) => !task.completed && task.schedule.kind === "unscheduled");
}

/** Monday-start weekday index for a calendar date (Mon 0 … Sun 6).
 *  Derived from the date string alone — never the wall clock. */
export function weekdayIndex(date: CalendarDate): number {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (jsDay + 6) % 7;
}

/** The last day of the current Monday-start week ("this week" = by Sunday). */
export function endOfWeek(today: CalendarDate): CalendarDate {
  return addDays(today, 6 - weekdayIndex(today));
}

/**
 * When every card on the board would wear the identical avatar set, the
 * avatar differentiates nothing — it is noise, and the board hides it.
 * Returns true only for 2+ tasks that all share the same non-empty
 * assignee set; a mixed or empty board keeps avatars meaningful.
 */
export function uniformAssignees(tasks: readonly LabTask[]): boolean {
  if (tasks.length < 2) return false;
  const signature = (task: LabTask) => [...task.assigneeIds].sort().join("|");
  const first = signature(tasks[0]);
  if (first === "") return false;
  return tasks.every((task) => signature(task) === first);
}
