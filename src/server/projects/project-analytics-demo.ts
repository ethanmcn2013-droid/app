import "server-only";

import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { effectiveColumnKey, isTaskDone } from "@/lib/board-columns";
import type { AnalyticsTask } from "@/lib/projects/project-analytics";
import { DEMO_USER_ID, demoTasks } from "@/server/demo/tasks-demo";

/**
 * Review and demo mode have no database, so Analytics reads the same demo
 * Project every other surface reads, on the pinned review clock.
 *
 * Two layers, kept apart on purpose:
 * 1. The live board: `demoTasks()`, exactly as Tasks shows it. Open work,
 *    columns, overdue and due dates come only from here, so Analytics agrees
 *    with the board and the sidebar count. A done task's finish moment is its
 *    last edit, re-anchored from the wall clock onto the pinned review "now".
 *    The seed has no creation times, so the ages below stand in for them.
 * 2. The season behind it: already-finished, archived work from earlier
 *    weeks. Archived tasks appear on no board, so this history cannot
 *    contradict another surface; it exists so the weekly charts have a
 *    believable past to draw. It never touches open work.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Days before the pinned review "now" that each live demo task was added. */
const LIVE_TASK_AGE_DAYS: Readonly<Record<string, number>> = {
  "demo-t-01": 3,
  "demo-task-menu-tasting": 24,
  "demo-t-03": 9,
  "demo-t-04": 5,
  "demo-t-05": 6,
  "demo-t-06": 8,
  "demo-t-07": 12,
  "demo-t-08": 18,
  "demo-t-09": 10,
  "demo-t-10": 21,
  demo_task_checkout: 6,
  demo_task_linen: 9,
  demo_task_registrar: 16,
};

/**
 * Tasks finished per week, most recent first, starting with the week before
 * this one (this week's finishes are the live board's). A venue's year: a
 * quiet winter, a spring that fills, and a July at full stretch.
 */
const FINISHED_PER_WEEK = [
  4, 6, 3, 5, 4, 5, 3, 4, 2, 3, 3,
  2, 3, 2, 1, 2, 3, 2, 1, 2, 2, 1, 2,
  2, 1, 1, 2, 1, 1, 2, 1, 0, 1, 2, 1, 1, 2, 1, 1, 0, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1,
];

/** Days from added to finished; cycles so the spread is fixed, not random. */
const DURATION_DAYS = [0.4, 2, 3.5, 1.2, 5, 2.5, 6, 4, 0.8, 3, 9, 1.5, 2.2, 4.5, 12, 2.8, 1, 3, 7, 1.8, 16, 2.4];

/** Due-date offset from the finish day: positive is early, negative late, null undated. */
const DUE_OFFSET_DAYS: ReadonlyArray<number | null> = [2, 0, null, 1, -1, 3, null, 0, 5, null, -2, 1, 0, null, 4];

function liveTasks(now: number): AnalyticsTask[] {
  const wallClock = Date.now();
  return demoTasks().map((task) => {
    const done = isTaskDone(task, null);
    const ageDays = LIVE_TASK_AGE_DAYS[task.id] ?? 7;
    return {
      id: task.id,
      title: task.title,
      columnKey: effectiveColumnKey(task),
      done,
      archived: Boolean(task.archivedAt),
      priority: task.priority,
      assigneeIds: task.assignees,
      createdAt: now - ageDays * DAY,
      completedAt: done ? now - Math.max(0, wallClock - task.updatedAt.getTime()) : null,
      dueAt: task.dueAt ? task.dueAt.getTime() : null,
    };
  });
}

function seasonHistory(now: number): AnalyticsTask[] {
  const history: AnalyticsTask[] = [];
  let index = 0;
  FINISHED_PER_WEEK.forEach((count, weekIndex) => {
    const weeksAgo = weekIndex + 1;
    for (let slot = 0; slot < count; slot += 1) {
      // Spread finishes across the week's days and the working hours.
      const dayInWeek = (slot * 3 + weekIndex) % 7;
      const completedAt = now - (weeksAgo * 7 + dayInWeek) * DAY + ((index * 5) % 8) * HOUR - 2 * HOUR;
      const duration = DURATION_DAYS[index % DURATION_DAYS.length]!;
      const dueOffset = DUE_OFFSET_DAYS[index % DUE_OFFSET_DAYS.length];
      history.push({
        id: `demo-history-${index + 1}`,
        title: "Earlier task",
        columnKey: "done",
        done: true,
        archived: true,
        priority: "p2",
        assigneeIds: [DEMO_USER_ID],
        createdAt: completedAt - duration * DAY,
        completedAt,
        dueAt: dueOffset == null ? null : completedAt + dueOffset * DAY,
      });
      index += 1;
    }
  });
  return history;
}

export function demoAnalyticsSource(): { tasks: AnalyticsTask[]; now: number; timeZone: string } {
  const now = Date.parse(PINNED_REVIEW_CALENDAR_FRAME.nowIso);
  return {
    tasks: [...liveTasks(now), ...seasonHistory(now)],
    now,
    timeZone: PINNED_REVIEW_CALENDAR_FRAME.timeZone,
  };
}
