/**
 * Tests for the Today / This-evening daypart split (My Week).
 *
 * Run: npx tsx --test src/lib/tasks/dayparts.test.ts
 *
 * The boundary contract is load-bearing: only a task due *today* at
 * 17:00 or later belongs to the evening. Un-timed quick-adds resolve
 * to midday and must stay in Today; carried items from earlier days
 * must stay in Today regardless of their original clock — the evening
 * section renders only what the day's own data can honestly place.
 */
import test from "node:test";
import assert from "node:assert/strict";

import type { Task } from "@/lib/data";
import { splitTodayDayparts } from "./selectors";

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
