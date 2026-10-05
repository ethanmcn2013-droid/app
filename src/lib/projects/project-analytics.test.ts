import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeProjectAnalytics,
  formatDayRange,
  formatDays,
  median,
  niceTicks,
  parseAnalyticsRange,
  type AnalyticsColumn,
  type AnalyticsInput,
  type AnalyticsTask,
} from "@/lib/projects/project-analytics";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Thursday 16 July 2026, 09:00 in Dublin (BST, UTC+1). */
const NOW = Date.parse("2026-07-16T08:00:00.000Z");
const DAY = 86_400_000;
const TZ = "Europe/Dublin";

const COLUMNS: AnalyticsColumn[] = [
  { key: "todo", name: "To do", isDone: false, tone: "neutral" },
  { key: "doing", name: "In progress", isDone: false, tone: "progress" },
  { key: "waiting", name: "Waiting", isDone: false, tone: "neutral" },
  { key: "done", name: "Shipped", isDone: true, tone: "done" },
];

let seq = 0;
function task(over: Partial<AnalyticsTask> = {}): AnalyticsTask {
  seq += 1;
  return {
    id: over.id ?? `t-${seq}`,
    title: over.title ?? `Task ${seq}`,
    columnKey: over.columnKey ?? (over.done ? "done" : "todo"),
    done: over.done ?? false,
    archived: over.archived ?? false,
    priority: over.priority ?? "p2",
    assigneeIds: over.assigneeIds ?? ["u-orla"],
    createdAt: over.createdAt === undefined ? NOW - 30 * DAY : over.createdAt,
    completedAt: over.completedAt ?? null,
    dueAt: over.dueAt ?? null,
  };
}

function finished(daysAgo: number, over: Partial<AnalyticsTask> = {}): AnalyticsTask {
  return task({ done: true, completedAt: NOW - daysAgo * DAY, ...over });
}

function run(tasks: AnalyticsTask[], over: Partial<AnalyticsInput> = {}) {
  return computeProjectAnalytics({
    tasks,
    columns: COLUMNS,
    people: [
      { id: "u-orla", name: "Orla" },
      { id: "u-dan", name: "Dan" },
    ],
    now: NOW,
    timeZone: TZ,
    range: "4w",
    ...over,
  });
}

// ── Ranges and formatting ───────────────────────────────────────────────────

test("an unknown range falls back to 12 weeks", () => {
  assert.equal(parseAnalyticsRange("4w"), "4w");
  assert.equal(parseAnalyticsRange("26w"), "26w");
  assert.equal(parseAnalyticsRange("52w"), "12w");
  assert.equal(parseAnalyticsRange(undefined), "12w");
});

test("weeks are whole rolling windows that end today", () => {
  const result = run([]);
  assert.equal(result.today, "2026-07-16");
  assert.equal(result.weeks.length, 4);
  assert.deepEqual(result.weeks.at(-1), { start: "2026-07-10", end: "2026-07-16", finished: 0, added: 0 });
  assert.deepEqual(result.weeks[0], { start: "2026-06-19", end: "2026-06-25", finished: 0, added: 0 });
  assert.equal(result.range.start, "2026-06-19");
  assert.equal(result.range.end, "2026-07-16");
  assert.equal(run([], { range: "26w" }).weeks.length, 26);
});

test("formatting helpers read plainly", () => {
  assert.equal(formatDays(0.4), "Under a day");
  assert.equal(formatDays(1), "1 day");
  assert.equal(formatDays(2.54), "2.5 days");
  assert.equal(formatDays(12.6), "13 days");
  assert.equal(formatDayRange("2026-07-10", "2026-07-16"), "10–16 Jul");
  assert.equal(formatDayRange("2026-06-29", "2026-07-05"), "29 Jun – 5 Jul");
  assert.deepEqual(niceTicks(0), [0, 1]);
  assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(18), [0, 5, 10, 15, 20]);
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

// ── Finished, added, open ───────────────────────────────────────────────────

test("finished counts done tasks by their completion day, archived ones included", () => {
  const result = run([
    finished(0),
    finished(6),
    finished(7),
    finished(20, { archived: true }),
    finished(28), // day 28 back is the previous period
    finished(40),
    task({ completedAt: NOW - DAY }), // reopened: not done, so not finished
    task({ done: true, columnKey: "done", completedAt: null }), // no recorded moment
  ]);
  assert.deepEqual(result.weeks.map((week) => week.finished), [0, 1, 1, 2]);
  assert.equal(result.finished.count, 4);
  assert.equal(result.finished.previous, 2);
  assert.equal(result.weeklyAverage, 1);
  assert.equal(result.coverage.finishedWithoutDate, 1);
});

test("a completion is bucketed by the reader's calendar day, not UTC", () => {
  // 23:30 UTC on 9 July is 00:30 on 10 July in Dublin: inside the latest week.
  const lateNight = finished(0, { completedAt: Date.parse("2026-07-09T23:30:00.000Z") });
  assert.equal(run([lateNight]).weeks.at(-1)!.finished, 1);
  assert.equal(run([lateNight], { timeZone: "UTC" }).weeks.at(-1)!.finished, 0);
});

test("added counts creations in each period, including later archived work", () => {
  const result = run([
    task({ createdAt: NOW - 2 * DAY }),
    task({ createdAt: NOW - 3 * DAY, archived: true }),
    task({ createdAt: NOW - 30 * DAY }),
    task({ createdAt: null }),
  ]);
  assert.equal(result.added.count, 2);
  assert.equal(result.added.previous, 1);
  assert.equal(result.weeks.at(-1)!.added, 2);
});

test("open work excludes done and archived tasks and counts the unassigned", () => {
  const result = run([
    task(),
    task({ assigneeIds: [] }),
    task({ archived: true }),
    finished(1),
  ]);
  assert.deepEqual(result.open, { count: 2, unassigned: 1 });
});

// ── Dates: overdue, on time, due soon ───────────────────────────────────────

test("a task is late only once its due day has passed", () => {
  const result = run([
    task({ title: "Due today", dueAt: Date.parse("2026-07-16T09:00:00.000Z") }),
    task({ title: "Two days late", id: "late-2", dueAt: Date.parse("2026-07-14T09:00:00.000Z") }),
    task({ title: "One day late", dueAt: Date.parse("2026-07-15T09:00:00.000Z") }),
    // 23:30 UTC on 15 July is already 16 July in Dublin, so it is due today.
    task({ title: "Due today by the clock", dueAt: Date.parse("2026-07-15T23:30:00.000Z") }),
    task({ title: "Archived and late", archived: true, dueAt: Date.parse("2026-07-01T09:00:00.000Z") }),
  ]);
  assert.equal(result.overdue.count, 2);
  assert.equal(result.overdue.oldestDays, 2);
  assert.deepEqual(result.overdue.oldest, { id: "late-2", title: "Two days late" });
  assert.equal(result.upcoming.overdue, 2);
  assert.equal(result.upcoming.days[0]!.count, 2);
  assert.equal(result.upcoming.days[0]!.isToday, true);
});

test("on time means finished on or before the due day", () => {
  const due = Date.parse("2026-07-10T09:00:00.000Z");
  const result = run([
    finished(0, { completedAt: Date.parse("2026-07-10T21:00:00.000Z"), dueAt: due }), // same local day
    finished(0, { completedAt: Date.parse("2026-07-11T08:00:00.000Z"), dueAt: due }), // a day late
    finished(0, { completedAt: Date.parse("2026-07-08T08:00:00.000Z"), dueAt: due }), // early
    finished(2), // undated: not in the denominator
    finished(30, { dueAt: NOW - 31 * DAY }), // previous period, late
  ]);
  assert.equal(result.onTime.dated, 3);
  assert.equal(result.onTime.onTime, 2);
  assert.equal(result.onTime.rate, 2 / 3);
  assert.equal(result.onTime.previousRate, 0);
});

test("the next fourteen days start today and skip undated work", () => {
  const result = run([
    task({ dueAt: NOW + 1 * DAY }),
    task({ dueAt: NOW + 1 * DAY }),
    task({ dueAt: NOW + 13 * DAY }),
    task({ dueAt: NOW + 14 * DAY }),
    task(),
  ]);
  assert.equal(result.upcoming.days.length, 14);
  assert.equal(result.upcoming.days[0]!.date, "2026-07-16");
  assert.equal(result.upcoming.days[0]!.weekday, 4);
  assert.equal(result.upcoming.days[1]!.count, 2);
  assert.equal(result.upcoming.days[13]!.count, 1);
  assert.equal(result.upcoming.total, 3);
});

// ── Time to finish ──────────────────────────────────────────────────────────

test("time to finish is the median from creation to completion", () => {
  const result = run([
    finished(1, { createdAt: NOW - 1.5 * DAY }), // half a day
    finished(1, { createdAt: NOW - 3 * DAY }), // two days
    finished(1, { createdAt: NOW - 11 * DAY }), // ten days
    finished(1, { createdAt: null }), // unknown start: left out
    finished(35, { createdAt: NOW - 36 * DAY }), // previous period
  ]);
  assert.equal(result.timeToFinish.sample, 3);
  assert.equal(result.timeToFinish.medianDays, 2);
  assert.equal(result.timeToFinish.previousMedianDays, 1);
  assert.deepEqual(
    result.durations.map((bucket) => [bucket.key, bucket.count, bucket.holdsMedian]),
    [["day", 1, false], ["3d", 1, true], ["week", 0, false], ["2w", 1, false], ["4w", 0, false], ["more", 0, false]],
  );
});

// ── Columns, people, priority ───────────────────────────────────────────────

test("status follows the board's columns and names, keeping orphaned keys visible", () => {
  const result = run([
    task(),
    task({ columnKey: "doing" }),
    task({ columnKey: "doing" }),
    task({ columnKey: "on_hold" }),
    task({ columnKey: "doing", archived: true }),
    finished(1),
  ]);
  assert.deepEqual(
    result.status.map((row) => [row.name, row.count]),
    [["To do", 1], ["In progress", 2], ["Waiting", 0], ["Shipped", 1], ["On hold", 1]],
  );
  assert.equal(result.status[1]!.share, 2 / 5);
  assert.equal(result.status[3]!.isDone, true);
});

test("workload counts each assignee, with former members and the unassigned last", () => {
  const result = run([
    task({ assigneeIds: ["u-orla", "u-dan"], dueAt: NOW - 2 * DAY }),
    task({ assigneeIds: ["u-orla"], dueAt: NOW + 2 * DAY }),
    task({ assigneeIds: ["u-orla"], dueAt: NOW + 9 * DAY }),
    task({ assigneeIds: ["u-gone"] }),
    task({ assigneeIds: [] }),
    finished(3, { assigneeIds: ["u-dan"] }),
  ]);
  assert.deepEqual(
    result.people.map((person) => [person.name, person.open, person.overdue, person.dueSoon, person.finished]),
    [
      ["Orla", 3, 1, 1, 0],
      ["Dan", 1, 1, 0, 1],
      ["Former member", 1, 0, 0, 0],
      ["No one assigned", 1, 0, 0, 0],
    ],
  );
});

test("priority mix counts open work only", () => {
  const result = run([
    task({ priority: "p0", dueAt: NOW - 3 * DAY }),
    task({ priority: "p0" }),
    task({ priority: "p3" }),
    finished(1, { priority: "p0" }),
  ]);
  assert.deepEqual(
    result.priorities.map((row) => [row.label, row.open, row.overdue]),
    [["Urgent", 2, 1], ["High", 0, 0], ["Normal", 0, 0], ["Low", 1, 0]],
  );
});

// ── What changed ────────────────────────────────────────────────────────────

test("what changed compares the last seven days with the seven before", () => {
  const result = run(
    [
      finished(1, { createdAt: NOW - 20 * DAY }),
      finished(2, { createdAt: NOW - 20 * DAY }),
      finished(3, { createdAt: NOW - 20 * DAY }),
      finished(9, { createdAt: NOW - 20 * DAY }),
      task({ createdAt: NOW - DAY, id: "late", title: "Order the tonic", dueAt: NOW - 2 * DAY }),
      task({ createdAt: NOW - 20 * DAY, dueAt: NOW + 2 * DAY, assigneeIds: [] }),
      task({ createdAt: NOW - 20 * DAY, dueAt: NOW + 2 * DAY }),
      task({ createdAt: NOW - 20 * DAY, dueAt: NOW + 4 * DAY }),
    ],
    { range: "12w" },
  );
  assert.deepEqual(result.changes, [
    { tone: "good", text: "3 tasks finished in the last 7 days, 2 more than the week before." },
    { tone: "good", text: "Finishing outpaced new work: 1 added against 3 finished." },
    { tone: "bad", text: "1 task is past its date: ", task: { id: "late", title: "Order the tonic", after: ", 2 days late." } },
    { tone: "neutral", text: "3 tasks are due in the next 7 days, most on Saturday." },
    { tone: "bad", text: "1 open task has no one assigned." },
  ]);
});

test("a quiet project says so instead of inventing movement", () => {
  const result = run([task({ createdAt: NOW - 60 * DAY })]);
  assert.deepEqual(result.changes.map((line) => line.text), [
    "Nothing was finished in the last two weeks.",
    "Nothing is due in the next 7 days.",
  ]);
});

test("a project with no tasks has nothing to describe", () => {
  const result = run([]);
  assert.equal(result.hasTasks, false);
  assert.deepEqual(result.changes, []);
  assert.equal(result.timeToFinish.medianDays, null);
  assert.equal(result.onTime.rate, null);
  assert.deepEqual(result.people, []);
});
