/**
 * Tests for the Today / This-evening daypart split (My Week).
 *
 * Run: npx tsx --test src/lib/tasks/dayparts.test.ts
 *
 * The boundary contract is load-bearing: only a task due *today* at
 * 17:00 or later belongs to the evening. Un-timed quick-adds resolve
 * to midday and must stay in Today; carried items from earlier days
 * must stay in Today regardless of their original clock, the evening
 * section renders only what the day's own data can honestly place.
 */
import test from "node:test";
import assert from "node:assert/strict";

import type { Task } from "@/lib/data";
import { bucketMyWeek, splitTodayDayparts } from "./selectors";

test("My work retains every open assignment exactly once, including later and undated work", () => {
  const now = new Date(2026, 8, 5, 12);
  const task = (id: string, dueAt?: Date, lane: Task["lane"] = "todo", assignees = ["member"]) => ({
    id, title: id, lane, assignees, dueAt, priority: "p2", updatedAt: now,
  }) as Task;
  const rows = [
    task("today", now),
    task("soon", new Date(2026, 8, 6)),
    task("later", new Date(2026, 8, 20)),
    task("undated"),
    task("moving-without-date", undefined, "doing"),
    task("waiting", undefined, "review"),
    task("someone-else", now, "todo", ["owner"]),
    task("unassigned", now, "todo", []),
  ];
  const result = bucketMyWeek(rows, "member", now);
  assert.deepEqual(result.today.map(t => t.id), ["today"]);
  assert.deepEqual(result.thisWeek.map(t => t.id), ["soon"]);
  assert.deepEqual(result.later.map(t => t.id), ["later"]);
  assert.deepEqual(result.undated.map(t => t.id), ["undated", "moving-without-date"]);
  assert.deepEqual(result.waiting.map(t => t.id), ["waiting"]);
  const displayed = Object.values(result).flat().map(t => t.id);
  assert.equal(displayed.length, 6);
  assert.equal(new Set(displayed).size, 6);
  assert.ok(!displayed.includes("someone-else") && !displayed.includes("unassigned"));
});

test("an empty personal view does not imply an empty project", () => {
  const tasks = [{ id: "owner-task", assignees: ["owner"], lane: "todo", updatedAt: new Date() }] as Task[];
  assert.equal(Object.values(bucketMyWeek(tasks, "member")).flat().length, 0);
  assert.equal(tasks.length, 1);
});

// Fixed local reference day at 09:00.
const NOW = new Date(2026, 5, 6, 9, 0, 0);

function at(hour: number, dayOffset = 0): Task {
  const d = new Date(2026, 5, 6 + dayOffset, hour, 0, 0);
  return { dueAt: d } as Task;
}

test("evening starts at 17:00 today", () => {
  const five = at(17);
  const fourFiftyNine = { dueAt: new Date(2026, 5, 6, 16, 59) } as Task;
  const { day, evening } = splitTodayDayparts([five, fourFiftyNine], NOW);
  assert.deepEqual(evening, [five]);
  assert.deepEqual(day, [fourFiftyNine]);
});

test("un-timed quick-adds (midday resolution) stay in Today", () => {
  const noon = at(12);
  const { day, evening } = splitTodayDayparts([noon], NOW);
  assert.deepEqual(day, [noon]);
  assert.equal(evening.length, 0);
});

test("carried items from earlier days stay in Today, whatever their clock", () => {
  const lastNight = at(19, -1);
  const { day, evening } = splitTodayDayparts([lastNight], NOW);
  assert.deepEqual(day, [lastNight]);
  assert.equal(evening.length, 0);
});

test("tasks without a due time stay in Today", () => {
  const undated = { dueAt: undefined } as Task;
  const { day, evening } = splitTodayDayparts([undated], NOW);
  assert.deepEqual(day, [undated]);
  assert.equal(evening.length, 0);
});

test("order within each daypart is preserved", () => {
  const a = at(18);
  const b = at(9);
  const c = at(21);
  const { day, evening } = splitTodayDayparts([a, b, c], NOW);
  assert.deepEqual(evening, [a, c]);
  assert.deepEqual(day, [b]);
});
