import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "@/lib/data";
import {
  createCalendarFrame,
  PINNED_REVIEW_CALENDAR_FRAME,
} from "@/lib/calendar-frame";
import {
  scheduleToPatch,
  taskToSchedule,
} from "@/components/hybrid/adapter";

function task(fields: Partial<Task>): Task {
  return {
    id: "task-calendar-test",
    title: "Calendar truth",
    lane: "todo",
    priority: "p2",
    assignees: [],
    parentTaskId: null,
    externalContactName: null,
    externalContactEmail: null,
    cents: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...fields,
  };
}

test("calendar frame derives today in the server-selected timezone", () => {
  const frame = createCalendarFrame({
    now: new Date("2026-01-02T01:30:00.000Z"),
    timeZone: "America/New_York",
  });
  assert.equal(frame.today, "2026-01-01");
  assert.equal(frame.source, "server");
});

test("review frame is deliberately pinned and finite", () => {
  assert.equal(PINNED_REVIEW_CALENDAR_FRAME.source, "review");
  assert.equal(PINNED_REVIEW_CALENDAR_FRAME.today, "2026-07-16");
  // A week past the wedding day (2026-10-03). 2026-09-12 is the retired
  // wedding date and must not reappear; a period that closed three weeks
  // before the day it plans was the tell.
  assert.equal(
    PINNED_REVIEW_CALENDAR_FRAME.planningPeriod?.endDate,
    "2026-10-10",
  );
});

test("due date plus duration preserves a range without a floating anchor", () => {
  assert.deepEqual(
    taskToSchedule(task({
      dueAt: new Date("2026-08-14T09:00:00.000Z"),
      durationDays: 4,
    })),
    {
      kind: "range",
      startOn: "2026-08-11",
      dueOn: "2026-08-14",
    },
  );
});

test("ambiguous legacy offsets stay unscheduled without a real period", () => {
  assert.deepEqual(
    taskToSchedule(task({ startDay: 3, durationDays: 2 })),
    { kind: "unscheduled" },
  );
});

test("legacy offsets use an explicit planning-period start when available", () => {
  assert.deepEqual(
    taskToSchedule(
      task({ startDay: 3, durationDays: 2 }),
      PINNED_REVIEW_CALENDAR_FRAME,
    ),
    {
      kind: "range",
      startOn: "2026-07-09",
      dueOn: "2026-07-10",
    },
  );
});

test("range writes remain stable without a planning-period anchor", () => {
  const patch = scheduleToPatch({
    kind: "range",
    startOn: "2026-08-11",
    dueOn: "2026-08-14",
  });
  assert.equal(patch.startDay, null);
  assert.equal(patch.durationDays, 4);
  assert.equal(patch.due, "2026-08-14");
  assert.equal(patch.dueAt?.toISOString(), "2026-08-14T09:00:00.000Z");
});

test("range writes retain the legacy offset when a real period exists", () => {
  const patch = scheduleToPatch(
    {
      kind: "range",
      startOn: "2026-07-09",
      dueOn: "2026-07-10",
    },
    PINNED_REVIEW_CALENDAR_FRAME,
  );
  assert.equal(patch.startDay, 3);
  assert.equal(patch.durationDays, 2);
});
