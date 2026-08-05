import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  differenceInDays,
  formatSchedule,
  formatScheduleForTask,
  formatScheduleRelative,
  isTaskDueToday,
  isTaskOverdue,
  moveSchedule,
  resizeScheduleEnd,
  scheduleIncludes,
} from "./dates";
import { LAB_TASKS } from "./fixtures";
import type { CalendarDate, TaskSchedule } from "./types";

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
  assert.equal(formatScheduleRelative(due("2026-07-27"), today), "1 day overdue");
  assert.equal(formatScheduleRelative(due("2026-07-31"), today), "Due in 3 days");
  assert.equal(formatScheduleRelative(due("2026-07-25"), today), "3 days overdue");

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

test("the card sentence never calls finished work overdue", () => {
  const base = { ...LAB_TASKS[0], id: "test-card-sentence", completedAt: undefined };
  const doneLate = { ...base, completed: true, schedule: { kind: "due", dueOn: "2026-07-14" } as const };
  // Without a completion date the card states the fact in neutral grammar…
  assert.equal(formatScheduleForTask(doneLate, "2026-07-16"), "Was due 14 Jul");
  // …while the same schedule on an open task is an alarm.
  assert.equal(formatScheduleForTask({ ...doneLate, completed: false }, "2026-07-16"), "Overdue by 2 days");
  assert.equal(formatScheduleForTask({ ...doneLate, completed: false }, "2026-07-15"), "Overdue by 1 day");
  // Long-overdue work names the date instead of a day count.
  assert.equal(formatScheduleForTask({ ...doneLate, completed: false }, "2026-07-30"), "Overdue since 14 Jul");
  // A completed milestone keeps its date as a record, not a status.
  const milestone = { ...base, completed: true, schedule: { kind: "milestone", on: "2026-07-10" } as const };
  assert.equal(formatScheduleForTask(milestone, "2026-07-16"), "Milestone · 10 Jul");
});

test("a completion date makes the card sentence a receipt", () => {
  const base = { ...LAB_TASKS[0], id: "test-completed-receipt", completed: true };
  const due = { kind: "due", dueOn: "2026-07-14" } as const;
  // On time and early both name the day it finished.
  assert.equal(
    formatScheduleForTask({ ...base, schedule: due, completedAt: "2026-07-14T15:00:00+01:00" }, "2026-07-20"),
    "Completed 14 Jul",
  );
  assert.equal(
    formatScheduleForTask({ ...base, schedule: due, completedAt: "2026-07-12T09:00:00+01:00" }, "2026-07-20"),
    "Completed 12 Jul",
  );
  // Late says how late, in plain words.
  assert.equal(
    formatScheduleForTask({ ...base, schedule: due, completedAt: "2026-07-15T09:00:00+01:00" }, "2026-07-20"),
    "Completed 1 day late",
  );
  assert.equal(
    formatScheduleForTask({ ...base, schedule: due, completedAt: "2026-07-16T09:00:00+01:00" }, "2026-07-20"),
    "Completed 2 days late",
  );
  // Finished work that never had a date still gets its receipt.
  assert.equal(
    formatScheduleForTask({ ...base, schedule: { kind: "unscheduled" } as const, completedAt: "2026-07-16T09:00:00+01:00" }, "2026-07-20"),
    "Completed 16 Jul",
  );
  // And with no completion date at all, the quiet fallback holds.
  assert.equal(
    formatScheduleForTask({ ...base, schedule: { kind: "unscheduled" } as const, completedAt: undefined }, "2026-07-20"),
    "Done",
  );
});

test("open milestones read in explicit grammar", () => {
  const base = { ...LAB_TASKS[0], id: "test-milestone-grammar", completed: false };
  const on = (day: CalendarDate) => ({ ...base, schedule: { kind: "milestone", on: day } as const });
  assert.equal(formatScheduleForTask(on("2026-07-16"), "2026-07-16"), "Milestone due today");
  assert.equal(formatScheduleForTask(on("2026-07-17"), "2026-07-16"), "Milestone due tomorrow");
  assert.equal(formatScheduleForTask(on("2026-07-20"), "2026-07-16"), "Milestone due in 4 days");
  assert.equal(formatScheduleForTask(on("2026-07-15"), "2026-07-16"), "Milestone overdue by 1 day");
  assert.equal(formatScheduleForTask(on("2026-07-13"), "2026-07-16"), "Milestone overdue by 3 days");
  assert.equal(formatScheduleForTask(on("2026-08-01"), "2026-07-16"), "Milestone due 1 Aug");
});
