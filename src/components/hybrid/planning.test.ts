import assert from "node:assert/strict";
import test from "node:test";
import { activeUnscheduledTasks, endOfWeek, uniformAssignees, weekdayIndex } from "./planning";
import { LAB_TASKS } from "./fixtures-dataset";
import type { LabTask } from "./types";

function make(overrides: Partial<LabTask>): LabTask {
  return { ...LAB_TASKS[0], id: `t-${Math.abs(JSON.stringify(overrides).length)}-${overrides.completed}`, ...overrides } as LabTask;
}

test("active unscheduled work excludes finished and dated tasks", () => {
  const open = make({ completed: false, schedule: { kind: "unscheduled" } });
  const doneNoDate = make({ completed: true, schedule: { kind: "unscheduled" }, completedAt: "2026-07-10T10:00:00+01:00" });
  const dated = make({ completed: false, schedule: { kind: "due", dueOn: "2026-07-20" } });
  const doneDated = make({ completed: true, schedule: { kind: "due", dueOn: "2026-07-01" } });

  const result = activeUnscheduledTasks([open, doneNoDate, dated, doneDated]);
  assert.deepEqual(result, [open]);
});

test("active unscheduled work preserves the incoming order", () => {
  const a = { ...make({ completed: false, schedule: { kind: "unscheduled" } }), id: "a" };
  const b = { ...make({ completed: false, schedule: { kind: "unscheduled" } }), id: "b" };
  const between = make({ completed: false, schedule: { kind: "milestone", on: "2026-08-01" } });
  assert.deepEqual(activeUnscheduledTasks([a, between, b]).map((t) => t.id), ["a", "b"]);
});

test("completing a task removes it from the selector's result", () => {
  const task = make({ completed: false, schedule: { kind: "unscheduled" } });
  assert.equal(activeUnscheduledTasks([task]).length, 1);
  assert.equal(activeUnscheduledTasks([{ ...task, completed: true }]).length, 0);
  // …and reopening brings it back.
  assert.equal(activeUnscheduledTasks([{ ...task, completed: false }]).length, 1);
});

test("avatars hide only when they differentiate nothing", () => {
  const orla = make({ completed: false, schedule: { kind: "unscheduled" }, assigneeIds: ["orla"] });
  const finn = { ...orla, id: "finn-task", assigneeIds: ["finn"] };
  const nobody = { ...orla, id: "bare-task", assigneeIds: [] };
  // Every card identical → the badge is noise, hide it.
  assert.equal(uniformAssignees([orla, { ...orla, id: "second" }]), true);
  // Mixed owners → the avatar means something, keep it.
  assert.equal(uniformAssignees([orla, finn]), false);
  // Unassigned boards and single cards keep whatever they have.
  assert.equal(uniformAssignees([nobody, { ...nobody, id: "n2" }]), false);
  assert.equal(uniformAssignees([orla]), false);
});

test("week arithmetic is Monday-start and deterministic", () => {
  // 2026-07-16 is a Thursday.
  assert.equal(weekdayIndex("2026-07-16"), 3);
  assert.equal(endOfWeek("2026-07-16"), "2026-07-19"); // that Sunday
  // A Sunday's "this week" is the same day.
  assert.equal(weekdayIndex("2026-07-19"), 6);
  assert.equal(endOfWeek("2026-07-19"), "2026-07-19");
  // A Monday reaches six days ahead.
  assert.equal(weekdayIndex("2026-07-20"), 0);
  assert.equal(endOfWeek("2026-07-20"), "2026-07-26");
});
