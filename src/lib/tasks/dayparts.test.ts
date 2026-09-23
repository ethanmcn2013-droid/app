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
import { createCalendarFrame } from "@/lib/calendar-frame";
import { generateNudges } from "@/lib/nudges/generate-nudges";

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

const PROJECT_NOW = new Date("2026-07-16T00:30:00Z");
const TOKYO = createCalendarFrame({ now: PROJECT_NOW, timeZone: "Asia/Tokyo" });
const DAY_MS = 86_400_000;
function instantTask(id: string, fields: Partial<Task> = {}): Task {
  return {
    id, title: id, lane: "todo", priority: "p2", assignees: ["member"],
    updatedAt: PROJECT_NOW, ...fields,
  } as Task;
}
const ids = (rows: Task[]) => rows.map(row => row.id);

for (const host of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
  test(`explicit Tokyo frame agrees across host timezone ${host}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = host;
    try {
      const rows = [
        instantTask("project-today", { dueAt: new Date("2026-07-16T08:30:00Z") }),
        instantTask("project-tomorrow", { dueAt: new Date("2026-07-16T20:00:00Z") }),
      ];
      const before = JSON.stringify(rows);
      const buckets = bucketMyWeek(rows, "member", PROJECT_NOW, TOKYO);
      assert.deepEqual(ids(buckets.today), ["project-today"]);
      assert.deepEqual(ids(buckets.thisWeek), ["project-tomorrow"]);
      assert.deepEqual(ids(splitTodayDayparts(buckets.today, PROJECT_NOW, TOKYO).evening), ["project-today"]);
      assert.deepEqual(generateNudges(rows, "member", null, PROJECT_NOW, TOKYO), []);
      assert.equal(JSON.stringify(rows), before, "classification never changes stored instants");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
}

test("project evening begins at 17:00 and excludes carried, undated and next-day work", () => {
  const rows = [
    instantTask("1659", { dueAt: new Date("2026-07-16T07:59:00Z") }),
    instantTask("1700", { dueAt: new Date("2026-07-16T08:00:00Z") }),
    instantTask("2359", { dueAt: new Date("2026-07-16T14:59:59Z") }),
    instantTask("tomorrow", { dueAt: new Date("2026-07-16T15:00:00Z") }),
    instantTask("carried", { dueAt: new Date("2026-07-15T10:00:00Z") }),
    instantTask("noon", { dueAt: new Date("2026-07-16T03:00:00Z") }),
    instantTask("undated"),
  ];
  const parts = splitTodayDayparts(rows, PROJECT_NOW, TOKYO);
  assert.deepEqual(ids(parts.evening), ["1700", "2359"]);
  assert.deepEqual(ids(parts.day), ["1659", "tomorrow", "carried", "noon", "undated"]);
});

for (const [nowIso,early,evening] of [
  ["2026-03-08T06:00:00Z", "2026-03-08T20:59:00Z", "2026-03-08T21:00:00Z"],
  ["2026-11-01T05:00:00Z", "2026-11-01T21:59:00Z", "2026-11-01T22:00:00Z"],
]) test(`17:00 remains a project wall-clock boundary on DST day ${nowIso}`, () => {
  const now = new Date(nowIso), calendar = createCalendarFrame({ now, timeZone: "America/New_York" });
  const rows = [instantTask("early", { dueAt: new Date(early) }), instantTask("evening", { dueAt: new Date(evening) })];
  assert.deepEqual(ids(splitTodayDayparts(rows, now, calendar).evening), ["evening"]);
});

test("ThisWeek preserves the exclusive seventh-day cutoff across DST", () => {
  const now = new Date("2026-03-08T06:00:00Z");
  const calendar = createCalendarFrame({ now, timeZone: "America/New_York" });
  const rows = [
    instantTask("sixth-day", { dueAt: new Date("2026-03-14T23:59:59-04:00") }),
    instantTask("seventh-day", { dueAt: new Date("2026-03-15T00:00:00-04:00") }),
  ];
  const buckets = bucketMyWeek(rows, "member", now, calendar);
  assert.deepEqual(ids(buckets.thisWeek), ["sixth-day"]);
  assert.deepEqual(ids(buckets.later), ["seventh-day"]);
});

test("calendar classification preserves priority, assignment scope and bucket order", () => {
  const due = new Date("2026-07-16T08:30:00Z");
  const rows = [
    instantTask("p2", { dueAt: due }),
    instantTask("p0", { dueAt: due, priority: "p0" }),
    instantTask("earlier", { dueAt: new Date("2026-07-15T10:00:00Z"), lane: "doing", idleDays: 10 }),
    instantTask("idle", { lane: "doing", idleDays: 4 }),
    instantTask("older-idle", { lane: "doing", idleDays: 8 }),
    instantTask("review-old", { lane: "review", dueAt: due, updatedAt: new Date(PROJECT_NOW.getTime() - DAY_MS) }),
    instantTask("review-new", { lane: "review", dueAt: due }),
    instantTask("undated"),
    instantTask("other", { dueAt: due, assignees: ["other-member"] }),
    instantTask("unassigned", { dueAt: due, assignees: [] }),
  ];
  const buckets = bucketMyWeek(rows, "member", PROJECT_NOW, TOKYO);
  assert.deepEqual(ids(buckets.today), ["earlier", "p0", "p2"]);
  assert.deepEqual(ids(buckets.needsAttention), ["older-idle", "idle"]);
  assert.deepEqual(ids(buckets.waiting), ["review-new", "review-old"]);
  assert.deepEqual(ids(buckets.undated), ["undated"]);
  assert.equal(Object.values(buckets).flat().length, 8);
});

test("idle and recently-done cutoffs remain elapsed durations, not project-day counts", () => {
  const now = new Date("2026-03-09T05:00:00Z"), calendar = createCalendarFrame({ now, timeZone: "America/New_York" });
  const rows = [
    instantTask("not-four-days", { lane: "doing", updatedAt: new Date(now.getTime() - 4 * DAY_MS + 1) }),
    instantTask("four-days", { lane: "doing", updatedAt: new Date(now.getTime() - 4 * DAY_MS) }),
    instantTask("done-cutoff", { lane: "done", updatedAt: new Date(now.getTime() - 7 * DAY_MS) }),
    instantTask("done-before", { lane: "done", updatedAt: new Date(now.getTime() - 7 * DAY_MS - 1) }),
    instantTask("done-newer", { lane: "done", updatedAt: now }),
  ];
  const buckets = bucketMyWeek(rows, "member", now, calendar);
  assert.deepEqual(ids(buckets.needsAttention), ["four-days"]);
  assert.deepEqual(ids(buckets.undated), ["not-four-days"]);
  assert.deepEqual(ids(buckets.doneRecently), ["done-newer", "done-cutoff"]);
  assert.deepEqual(generateNudges(rows, "member", null, now, calendar).map(n => n.taskId), ["four-days"]);
});

test("a new frame changes classification; a different host now alone cannot change its day", () => {
  const rows = [instantTask("evening", { dueAt: new Date("2026-07-16T08:30:00Z") })];
  const later = new Date("2026-07-17T00:30:00Z");
  assert.deepEqual(ids(splitTodayDayparts(rows, later, TOKYO).evening), ["evening"]);
  const next = createCalendarFrame({ now: later, timeZone: "Asia/Tokyo" });
  assert.deepEqual(ids(splitTodayDayparts(rows, later, next).day), ["evening"]);
  assert.equal(generateNudges(rows, "member", null, later, next)[0]?.kind, "past-due");
});

test("project nudges do not call a task due today past due; omitted callers retain UTC behavior", () => {
  const rows = [instantTask("today", { dueAt: new Date("2026-07-15T20:00:00Z") })];
  assert.deepEqual(generateNudges(rows, "member", null, PROJECT_NOW, TOKYO), []);
  assert.equal(generateNudges(rows, "member", null, PROJECT_NOW)[0]?.kind, "past-due");
});

test("project nudges find yesterday even when due and now share a UTC date", () => {
  const now = new Date("2026-07-15T23:30:00Z"), calendar = createCalendarFrame({ now, timeZone: "Asia/Tokyo" });
  const rows = [instantTask("yesterday", { dueAt: new Date("2026-07-15T14:00:00Z") })];
  const nudges = generateNudges(rows, "member", null, now, calendar);
  assert.equal(nudges[0]?.id, "past-due-yesterday-near");
  assert.match(nudges[0]?.body ?? "", /1 day/);
  assert.deepEqual(generateNudges(rows, "member", null, now), []);
});

test("project overdue severity, deduplication and six-nudge cap are preserved", () => {
  const rows = Array.from({ length: 8 }, (_, i) => instantTask(`late-${i}`, {
    lane: "doing", idleDays: 10, dueAt: new Date("2026-07-11T20:00:00Z"),
  }));
  const nudges = generateNudges(rows, "member", null, PROJECT_NOW, TOKYO);
  assert.equal(nudges.length, 6);
  assert.equal(new Set(nudges.map(n => n.taskId)).size, 6);
  assert.ok(nudges.every(n => n.kind === "past-due" && n.severity === 90 && /4 days/.test(n.body)));
});

test("invalid legacy due instants remain non-classifying rather than throwing", () => {
  const rows = [instantTask("bad-date", { dueAt: new Date("invalid") })];
  assert.deepEqual(ids(bucketMyWeek(rows, "member", PROJECT_NOW, TOKYO).later), ["bad-date"]);
  assert.deepEqual(ids(splitTodayDayparts(rows, PROJECT_NOW, TOKYO).day), ["bad-date"]);
  assert.deepEqual(generateNudges(rows, "member", null, PROJECT_NOW, TOKYO), []);
});
