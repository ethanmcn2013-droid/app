import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task } from "@/lib/data";
import type { CalendarFrame } from "@/lib/calendar-frame";
import { taskToSchedule } from "./adapter";
import { dueInstantForDay } from "@/lib/tasks/anchor-due";

const frame = (timeZone: string): CalendarFrame => ({
  nowIso: "2026-09-24T12:38:00.000Z",
  today: "2026-09-24",
  locale: "en-IE",
  timeZone,
  source: "server",
  planningPeriod: null,
});
const task = (dueAt: string): Task => ({ id: "t", title: "t", dueAt } as unknown as Task);

test("a day picked in Dublin as local midnight stays on that day on the board", () => {
  // 25 Sep 00:00 Irish Summer Time is 24 Sep 23:00 UTC.
  const schedule = taskToSchedule(task("2026-09-24T23:00:00.000Z"), frame("Europe/Dublin"));
  assert.deepEqual(schedule, { kind: "due", dueOn: "2026-09-25" });
});

test("a board-written 09:00 UTC due day reads as the same day in Dublin and New York", () => {
  for (const zone of ["Europe/Dublin", "America/New_York", "UTC"]) {
    const schedule = taskToSchedule(task("2026-09-25T09:00:00.000Z"), frame(zone));
    assert.deepEqual(schedule, { kind: "due", dueOn: "2026-09-25" }, zone);
  }
});

test("without a frame the reader keeps its UTC behaviour", () => {
  assert.deepEqual(taskToSchedule(task("2026-09-25T09:00:00.000Z")), { kind: "due", dueOn: "2026-09-25" });
});

test("the picker stores a chosen day as 09:00 UTC on that day", () => {
  const picked = new Date(2026, 8, 25); // local midnight, whatever the zone
  assert.equal(dueInstantForDay(picked)?.toISOString(), "2026-09-25T09:00:00.000Z");
});
