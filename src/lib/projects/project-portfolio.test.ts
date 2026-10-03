import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectCardStats } from "./project-hub";
import {
  assemblePortfolioRows,
  barEndLabel,
  barGeometry,
  groupRows,
  milestoneTone,
  needsALook,
  needsALookAll,
  nextMilestone,
  filterRows,
  lateMilestones,
  parseGroupBy,
  parseSort,
  parseStatusFilter,
  portfolioViewFromSearch,
  statusFilterParam,
  portfolioRowHref,
  resolveStart,
  rowAccessibleLabel,
  rowMetaLine,
  sortRows,
  summaryCounts,
  type CatalogRowInput,
  type PortfolioRow,
} from "./project-portfolio";

const TODAY = "2026-07-16";

function row(overrides: Partial<PortfolioRow> & Pick<PortfolioRow, "id" | "name">): PortfolioRow {
  return {
    monogram: overrides.name.slice(0, 2).toUpperCase(),
    role: "primary-owner",
    selectable: true,
    blockedReason: null,
    archived: false,
    status: "on-track",
    statusTone: "success",
    purpose: null,
    start: "2026-03-01",
    startSource: "first-task",
    target: "2026-10-03",
    complete: 5,
    total: 13,
    overdue: 0,
    statsKnown: true,
    milestones: [],
    milestoneOverflow: 0,
    timelineName: null,
    href: `/app/timeline?workspaceId=${overrides.id}&open=project`,
    overviewHref: null,
    sample: false,
    ...overrides,
  };
}

const stats = (s: Partial<ProjectCardStats>): ProjectCardStats => ({
  status: null,
  targetDate: null,
  purpose: null,
  total: 0,
  complete: 0,
  overdue: 0,
  ...s,
});

test("only catalog Projects become rows, in catalog order, and never borrow facts", () => {
  const catalog: CatalogRowInput[] = [
    { id: "p-b", name: "Beta", monogram: "BE", role: "member", selectable: true, blockedReason: null, archived: false },
    { id: "p-a", name: "Alpha", monogram: "AL", role: "primary-owner", selectable: false, blockedReason: "Two projects share this name.", archived: false },
  ];
  const rows = assemblePortfolioRows(catalog, {
    stats: new Map([
      ["p-a", stats({ status: "at-risk", total: 4, complete: 1, targetDate: "2026-09-01" })],
      ["intruder", stats({ status: "complete", total: 99, complete: 99 })],
    ]),
    starts: new Map([["intruder", { firstTaskCreated: "2020-01-01", firstTaskDue: null, projectCreated: null }]]),
    milestones: new Map([["intruder", [{ id: "x", title: "Not yours", date: "2026-08-01", done: false }]]]),
    statsAvailable: true,
  });

  assert.deepEqual(rows.map((r) => r.id), ["p-b", "p-a"]);
  assert.ok(!rows.some((r) => r.id === "intruder"));
  assert.equal(rows[0].statsKnown, false, "no stats for p-b: not borrowed from anywhere");
  assert.equal(rows[0].total, 0);
  assert.equal(rows[0].milestones.length, 0);
  assert.equal(rows[1].status, "at-risk");
  assert.equal(rows[1].href, null, "a blocked row is not a link");
  assert.equal(rows[0].href, portfolioRowHref("p-b"));
  assert.equal(portfolioRowHref("p-b"), "/app/timeline?workspaceId=p-b&open=project");
});

test("milestones are capped per row and the rest counted", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({
    id: `m${i}`,
    title: `M${i}`,
    date: `2026-08-${String(i + 1).padStart(2, "0")}`,
    done: false,
  }));
  const [only] = assemblePortfolioRows(
    [{ id: "p", name: "P", monogram: "P", role: "owner", selectable: true, blockedReason: null, archived: false }],
    { stats: new Map([["p", stats({})]]), starts: new Map(), milestones: new Map([["p", many]]), statsAvailable: true },
  );
  assert.equal(only.milestones.length, 12);
  assert.equal(only.milestoneOverflow, 3);
});

test("start is the earliest task date, falling back to the Project's creation", () => {
  assert.deepEqual(resolveStart({ firstTaskCreated: "2026-03-12T10:00:00Z", firstTaskDue: "2026-03-01", projectCreated: "2026-01-01" }), {
    start: "2026-03-01",
    startSource: "first-task",
  });
  assert.deepEqual(resolveStart({ firstTaskCreated: null, firstTaskDue: null, projectCreated: "2026-01-01T09:00:00Z" }), {
    start: "2026-01-01",
    startSource: "created",
  });
  assert.deepEqual(resolveStart(undefined), { start: null, startSource: null });
});

test("groups run at risk, on track, no status, paused, complete; complete folds", () => {
  const rows = [
    row({ id: "1", name: "Done", status: "complete" }),
    row({ id: "2", name: "Calm", status: "on-track" }),
    row({ id: "3", name: "Hot", status: "at-risk" }),
    row({ id: "4", name: "Unset", status: null }),
    row({ id: "5", name: "Rest", status: "paused" }),
  ];
  const groups = groupRows(rows, "status");
  assert.deepEqual(groups.map((g) => g.key), ["at-risk", "on-track", "none", "paused", "complete"]);
  assert.equal(groups.find((g) => g.key === "complete")?.collapsedByDefault, true);
  assert.equal(groupRows(rows, "none").length, 1);
  assert.equal(groupRows([], "status").length, 0);
});

test("sorting keeps undated rows last, breaks ties by name, and keeps samples after real rows", () => {
  const rows = [
    row({ id: "a", name: "Zed", target: null }),
    row({ id: "b", name: "Bee", target: "2026-12-01" }),
    row({ id: "c", name: "Ada", target: "2026-12-01" }),
    row({ id: "d", name: "Sample first", target: "2026-08-01", sample: true }),
    row({ id: "e", name: "Early", target: "2026-09-01" }),
  ];
  assert.deepEqual(sortRows(rows, "target").map((r) => r.id), ["e", "c", "b", "a", "d"]);
  assert.deepEqual(sortRows(rows, "name").map((r) => r.name), ["Ada", "Bee", "Early", "Zed", "Sample first"]);
  const progress = sortRows(
    [row({ id: "x", name: "X", complete: 1, total: 10 }), row({ id: "y", name: "Y", complete: 9, total: 10 })],
    "progress",
  );
  assert.deepEqual(progress.map((r) => r.id), ["y", "x"]);
  assert.equal(parseSort("start"), "start");
  assert.equal(parseSort("chaos"), null);
  assert.equal(parseGroupBy("none"), "none");
});

test("bar geometry covers every case in the vocabulary", () => {
  const span = barGeometry(row({ id: "s", name: "S" }), TODAY);
  assert.equal(span.kind, "span");
  assert.equal(span.percent, 38);
  assert.equal(span.pastTarget, false);

  const open = barGeometry(row({ id: "o", name: "O", target: null }), TODAY);
  assert.equal(open.kind, "open-ended");
  assert.equal(open.to, "2026-08-13"); // today + 4 weeks

  const past = barGeometry(row({ id: "p", name: "P", target: "2026-07-13", status: "at-risk" }), TODAY);
  assert.equal(past.pastTarget, true);
  assert.equal(past.daysPast, 3);

  const finished = barGeometry(row({ id: "f", name: "F", target: "2026-06-30", status: "complete", complete: 9, total: 10 }), TODAY);
  assert.equal(finished.pastTarget, false, "a finished Project whose date passed is simply finished");
  assert.equal(finished.percent, 100);

  assert.equal(barGeometry(row({ id: "t", name: "T", start: null }), TODAY).kind, "target-only");
  assert.equal(barGeometry(row({ id: "n", name: "N", start: null, target: null }), TODAY).kind, "none");

  assert.deepEqual(barEndLabel(row({ id: "p", name: "P", target: "2026-07-13", status: "at-risk" }), TODAY), {
    text: "3 days past target",
    tone: "danger",
  });
  assert.equal(barEndLabel(row({ id: "o", name: "O", target: null }), TODAY).text, "No target date");
  assert.equal(barEndLabel(row({ id: "e", name: "E", total: 0, complete: 0, target: null }), TODAY).text, "No tasks yet");
  assert.equal(barEndLabel(row({ id: "s", name: "S", target: "2026-11-12" }), TODAY).text, "12 Nov · 38%");
  assert.equal(barEndLabel(row({ id: "z", name: "Z", status: "paused", target: null }), TODAY).text, "Paused");
  assert.equal(barEndLabel(row({ id: "c", name: "C", status: "complete", target: "2026-06-30" }), TODAY).text, "Done 30 Jun");
  assert.equal(barEndLabel(row({ id: "t", name: "T", start: null, target: "2026-11-12" }), TODAY).text, "Target 12 Nov");
  assert.equal(barEndLabel(row({ id: "n", name: "N", start: null, target: null }), TODAY).text, "No dates yet");
  // Stats unavailable: the status word, nothing invented.
  assert.deepEqual(barEndLabel(row({ id: "u", name: "U", statsKnown: false, status: "at-risk" }), TODAY), {
    text: "At risk",
    tone: "quiet",
  });
});

test("milestone tones: done, overdue, next, upcoming", () => {
  const r = row({
    id: "m",
    name: "M",
    milestones: [
      { id: "1", title: "Booked", date: "2026-04-18", done: true },
      { id: "2", title: "Mock exams marked", date: "2026-07-10", done: false },
      { id: "3", title: "Menu tasting", date: "2026-08-01", done: false },
      { id: "4", title: "Wedding day", date: "2026-10-03", done: false },
    ],
  });
  assert.equal(nextMilestone(r, TODAY)?.id, "3");
  assert.deepEqual(r.milestones.map((m) => milestoneTone(r, m, TODAY)), ["done", "overdue", "next", "upcoming"]);
});

test("needs a look names one Project, at risk first", () => {
  const calm = row({ id: "c", name: "Calm" });
  const late = row({ id: "l", name: "Late", overdue: 4 });
  const past = row({ id: "p", name: "Past", target: "2026-07-10" });
  const risky = row({ id: "r", name: "Kavanagh wedding", status: "at-risk", overdue: 2 });
  assert.equal(needsALook([calm], TODAY), null);
  assert.equal(needsALook([calm, late], TODAY)?.sentence, "Late has 4 late tasks.");
  assert.equal(needsALook([calm, late, past], TODAY)?.sentence, "Past is 6 days past its target date.");
  assert.equal(needsALook([calm, late, past, risky], TODAY)?.sentence, "Kavanagh wedding is at risk, with 2 late tasks.");
  assert.equal(needsALook([row({ id: "z", name: "Z", status: "complete", overdue: 9 })], TODAY), null);
});

test("needs a look lists every live Project that is at risk, past target or late, first one first", () => {
  const calm = row({ id: "c", name: "Calm" });
  const garden = row({ id: "g", name: "Community garden", target: "2026-07-07", overdue: 1 });
  const risky = row({ id: "r", name: "Kavanagh wedding", status: "at-risk", overdue: 2 });
  const paused = row({ id: "p", name: "Paused", status: "paused", overdue: 3 });
  const all = needsALookAll([calm, garden, risky, paused], TODAY);
  assert.deepEqual(all.map((r) => r.id), ["r", "g"]);
  assert.deepEqual(needsALookAll([calm], TODAY), []);
});

test("the meta line explains a late On track row, and puts Sample last", () => {
  const garden = row({ id: "g", name: "Community garden", complete: 22, total: 25, overdue: 1, target: "2026-07-07" });
  assert.equal(rowMetaLine(garden, TODAY), "On track · Past target · 88% · 1 late");
  const sample = row({ id: "s", name: "Sample", status: "at-risk", complete: 4, total: 10, overdue: 2, target: "2026-11-12", sample: true });
  assert.equal(rowMetaLine(sample, TODAY), "At risk · 40% · 2 late · Sample");
});

test("summary counts and the words a row speaks", () => {
  const rows = [
    row({ id: "1", name: "One", status: "at-risk" }),
    row({ id: "2", name: "Two" }),
    row({ id: "3", name: "Three", status: null }),
  ];
  const counts = summaryCounts(rows);
  assert.equal(counts.total, 3);
  assert.equal(counts.byStatus["at-risk"], 1);
  assert.equal(counts.byStatus["on-track"], 1);
  assert.equal(counts.byStatus.none, 1);

  const kav = row({
    id: "k",
    name: "Kavanagh wedding",
    status: "at-risk",
    complete: 4,
    total: 10,
    overdue: 2,
    target: "2026-11-12",
    milestones: [{ id: "f", title: "Final fitting", date: "2026-10-04", done: false }],
  });
  assert.equal(rowMetaLine(kav, TODAY), "At risk · 40% · 2 late");
  assert.equal(
    rowAccessibleLabel(kav, TODAY),
    "Kavanagh wedding, at risk, 40% done, target 12 November, 2 tasks late, next milestone Final fitting on 4 October",
  );
  assert.match(rowAccessibleLabel(row({ id: "u", name: "U", statsKnown: false }), TODAY), /could not be loaded/);
});

test("the status filter parses strictly, in chip order, and empty means all", () => {
  assert.deepEqual([...parseStatusFilter("at-risk,on-track")], ["on-track", "at-risk"]);
  assert.deepEqual([...parseStatusFilter(" Paused , bogus,paused,none")], ["paused", "none"]);
  assert.deepEqual([...parseStatusFilter(["complete", "at-risk"])], ["at-risk", "complete"]);
  assert.equal(parseStatusFilter(undefined).size, 0);
  assert.equal(parseStatusFilter("").size, 0);
  assert.equal(parseStatusFilter(42).size, 0);
  // The URL form drops the default (all, or none chosen).
  assert.equal(statusFilterParam(["at-risk", "on-track"]), "on-track,at-risk");
  assert.equal(statusFilterParam([]), null);
  assert.equal(statusFilterParam(["on-track", "at-risk", "paused", "complete", "none"]), null);
  assert.deepEqual(portfolioViewFromSearch({ status: "paused" }).status, ["paused"]);
  assert.deepEqual(portfolioViewFromSearch({}).status, []);
});

test("filterRows keeps order, matches status and name, and ignores case and accents", () => {
  const rows = [
    row({ id: "1", name: "Kavanagh wedding", status: "at-risk" }),
    row({ id: "2", name: "Café relaunch", status: "complete" }),
    row({ id: "3", name: "Kitchen renovation", status: null }),
    row({ id: "4", name: "The Orchard, events", status: "on-track" }),
  ];
  assert.deepEqual(filterRows(rows, new Set()).map((r) => r.id), ["1", "2", "3", "4"]);
  assert.deepEqual(filterRows(rows, new Set(["at-risk", "none"])).map((r) => r.id), ["1", "3"]);
  assert.deepEqual(filterRows(rows, new Set(), "KAV").map((r) => r.id), ["1"]);
  assert.deepEqual(filterRows(rows, new Set(), "cafe").map((r) => r.id), ["2"]);
  assert.deepEqual(filterRows(rows, new Set(["on-track"]), "kav").map((r) => r.id), []);
  assert.deepEqual(filterRows(rows, new Set(), "   ").length, 4);
});

test("lateMilestones lists open milestones whose day has passed, oldest first", () => {
  const r = row({
    id: "m",
    name: "M",
    milestones: [
      { id: "a", title: "Booked", date: "2026-04-18", done: true },
      { id: "b", title: "Mock exams marked", date: "2026-07-10", done: false },
      { id: "c", title: "Reading list", date: "2026-06-19", done: false },
      { id: "d", title: "Today", date: TODAY, done: false },
      { id: "e", title: "Later", date: "2026-08-01", done: false },
    ],
  });
  assert.deepEqual(lateMilestones(r, TODAY).map((m) => m.id), ["c", "b"]);
  assert.deepEqual(lateMilestones(row({ id: "x", name: "X" }), TODAY), []);
});
