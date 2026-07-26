import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  differenceInDays,
  formatSchedule,
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
