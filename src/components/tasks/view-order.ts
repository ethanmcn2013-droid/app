/**
 * The order each view shows its tasks in. The task sheet's up and down, a
 * Shift range and "Enter opens the first task" all walk this order, so they
 * follow what the person sees rather than the store's raw order.
 */

import { compareDates, scheduleStart } from "@/components/hybrid/dates";
import type { LabTask } from "@/components/hybrid/types";

/** Board: column by column, each column top to bottom as drawn. */
export function boardOrder(columnKeys: readonly string[], rowsFor: (key: string) => readonly LabTask[]): string[] {
  return columnKeys.flatMap((key) => rowsFor(key).map((task) => task.id));
}

/**
 * Calendar: dated work by day (earliest first, then the visible order within
 * a day), followed by the tasks that still need a date.
 */
export function calendarOrder(visible: readonly LabTask[]): string[] {
  const dated: { task: LabTask; at: number }[] = [];
  const undated: LabTask[] = [];
  visible.forEach((task, at) => {
    if (scheduleStart(task.schedule)) dated.push({ task, at });
    else undated.push(task);
  });
  dated.sort((a, b) => compareDates(scheduleStart(a.task.schedule)!, scheduleStart(b.task.schedule)!) || a.at - b.at);
  return [...dated.map((entry) => entry.task.id), ...undated.map((task) => task.id)];
}
