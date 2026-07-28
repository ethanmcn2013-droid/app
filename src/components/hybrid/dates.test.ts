import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  differenceInDays,
  formatSchedule,
  formatScheduleRelative,
  isTaskDueToday,
  isTaskOverdue,
  moveSchedule,
  resizeScheduleEnd,
  scheduleIncludes,
} from "./dates";
import { LAB_TASKS } from "./fixtures";
import type { TaskSchedule } from "./types";

test("calendar arithmetic is deterministic and date-only", () => {
  assert.equal(addDays("2026-07-16", 1), "2026-07-17");
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
  assert.equal(differenceInDays("2026-07-16", "2026-07-22"), 6);
});

test("schedule kinds remain explicit", () => {
  const unscheduled: TaskSchedule = { kind: "unscheduled" };
  const due: TaskSchedule = { kind: "due", dueOn: "2026-07-22" };
  const range: TaskSchedule = { kind: "range", startOn: "2026-07-20", dueOn: "2026-07-24" };
  const milestone: TaskSchedule = { kind: "milestone", on: "2026-07-31" };

  assert.equal(formatSchedule(unscheduled), "Unscheduled");
  assert.equal(scheduleIncludes(unscheduled, "2026-07-16"), false);
  assert.equal(scheduleIncludes(due, "2026-07-22"), true);
  assert.equal(scheduleIncludes(range, "2026-07-22"), true);
  assert.equal(scheduleIncludes(milestone, "2026-07-31"), true);
  assert.deepEqual(moveSchedule(unscheduled, 4), unscheduled);
  assert.deepEqual(moveSchedule(due, 2), { kind: "due", dueOn: "2026-07-24" });
});

test("range resize cannot create an inverted range", () => {
  const range: TaskSchedule = { kind: "range", startOn: "2026-07-20", dueOn: "2026-07-24" };
  assert.deepEqual(resizeScheduleEnd(range, -20), { kind: "range", startOn: "2026-07-20", dueOn: "2026-07-20" });
});

test("card labels read relative to today inside a week, absolute beyond it", () => {
  const today = "2026-07-28" as const;
  const due = (dueOn: string): TaskSchedule => ({ kind: "due", dueOn: dueOn as never });

  assert.equal(formatScheduleRelative(due("2026-07-28"), today), "Due today");
  assert.equal(formatScheduleRelative(due("2026-07-29"), today), "Due tomorrow");
  assert.equal(formatScheduleRelative(due("2026-07-27"), today), "Due yesterday");
  assert.equal(formatScheduleRelative(due("2026-07-31"), today), "Due in 3 days");
  assert.equal(formatScheduleRelative(due("2026-07-25"), today), "Due 3 days ago");

  // Past a week either way the exact date carries more than the day count.
  assert.equal(formatScheduleRelative(due("2026-08-14"), today), "Due 14 Aug");
  assert.equal(formatScheduleRelative(due("2026-07-01"), today), "Due 1 Jul");

  assert.equal(formatScheduleRelative({ kind: "unscheduled" }, today), "Unscheduled");
  assert.equal(
    formatScheduleRelative({ kind: "milestone", on: "2026-07-28" }, today),
    "Milestone · today",
  );
  // A range that has already ended keeps both of its dates.
  assert.equal(
    formatScheduleRelative({ kind: "range", startOn: "2026-07-20", dueOn: "2026-07-24" }, today),
    formatSchedule({ kind: "range", startOn: "2026-07-20", dueOn: "2026-07-24" }),
  );
});

test("due today is distinct from overdue and yields to completion", () => {
  const base = { ...LAB_TASKS[0], id: "test-due-today" };
  const dueToday = { ...base, completed: false, schedule: { kind: "due", dueOn: "2026-07-28" } as const };

  assert.equal(isTaskDueToday(dueToday, "2026-07-28"), true);
  assert.equal(isTaskOverdue(dueToday, "2026-07-28"), false);
  assert.equal(isTaskDueToday({ ...dueToday, completed: true }, "2026-07-28"), false);
  assert.equal(isTaskDueToday(dueToday, "2026-07-29"), false);
  assert.equal(isTaskOverdue(dueToday, "2026-07-29"), true);
});

test("completed historical work is not labelled overdue", () => {
  const task = {
    ...LAB_TASKS[0],
    id: "test-completed-overdue",
    completed: true,
    schedule: { kind: "due", dueOn: "2026-07-01" } as const,
  };
  assert.equal(isTaskOverdue(task, "2026-07-16"), false);
  assert.equal(isTaskOverdue({ ...task, completed: false }, "2026-07-16"), true);
});
