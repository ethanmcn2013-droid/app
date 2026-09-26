import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  addMonths,
  clusterMarks,
  dayToX,
  diffDays,
  fitPxPerDay,
  initialScrollLeft,
  formatDayMonthYear,
  formatShortDay,
  formatWeekdayDate,
  isIsoDay,
  parseZoom,
  pxPerDay,
  relativeDayPhrase,
  startOfWeek,
  ticks,
  timeRange,
  weekendSpans,
  xToDay,
} from "./project-portfolio-scale";

const TODAY = "2026-07-16";

test("day arithmetic is whole UTC days", () => {
  assert.equal(diffDays("2026-07-16", "2026-08-01"), 16);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(startOfWeek("2026-07-16"), "2026-07-13"); // a Thursday → Monday
  assert.equal(isIsoDay("2026-02-30"), false);
  assert.equal(isIsoDay("2026-10-03"), true);
});

test("zoom scales are fixed and parse strictly", () => {
  assert.equal(pxPerDay("weeks"), 20);
  assert.equal(pxPerDay("months"), 5);
  assert.equal(pxPerDay("quarters"), 1.6);
  assert.equal(parseZoom("months"), "months");
  assert.equal(parseZoom("years"), null);
});

test("a range always includes today and snaps to the zoom's boundary", () => {
  const range = timeRange(["2026-09-01", "2026-10-03"], TODAY, "months");
  assert.equal(range.start, "2026-06-01"); // today minus a month, snapped
  assert.equal(range.end, "2026-11-30");
  assert.ok(range.start <= TODAY && TODAY <= range.end);
  assert.equal(range.clippedAfter, null);
  assert.equal(range.clippedBefore, false);

  const quarters = timeRange(["2026-10-03"], TODAY, "quarters");
  assert.equal(quarters.start, "2026-04-01");
  assert.equal(quarters.end, "2027-03-31");

  const weeks = timeRange([], TODAY, "weeks");
  assert.equal(weeks.start, "2026-06-29"); // two weeks earlier, a Monday
  assert.equal(new Date(`${weeks.end}T00:00:00Z`).getUTCDay(), 0); // ends on a Sunday
});

test("ignores unparseable dates rather than drawing them", () => {
  const range = timeRange(["not a date", null, undefined, "2026-02-30"], TODAY, "months");
  assert.equal(range.start, "2026-06-01");
  assert.equal(range.end, "2026-08-31");
});

test("a range is clamped to 36 months, keeps today, and reports what it left out", () => {
  const range = timeRange(["2020-01-01", "2031-06-01"], TODAY, "months");
  assert.equal(range.start, "2025-07-01"); // a year before today at most
  assert.ok(range.start <= TODAY && TODAY <= range.end);
  assert.equal(range.end, addDays(addMonths(range.start, 36), -1));
  assert.equal(range.clippedBefore, true);
  assert.equal(range.clippedAfter, "2031-06-01");
});

test("day ↔ x round-trips and snaps to a whole day inside the range", () => {
  const range = timeRange(["2026-10-03"], TODAY, "months");
  const ppd = pxPerDay("months");
  const x = dayToX("2026-08-01", range, ppd);
  assert.equal(x, diffDays(range.start, "2026-08-01") * 5);
  assert.equal(xToDay(x, range, ppd), "2026-08-01");
  assert.equal(xToDay(x + 2.4, range, ppd), "2026-08-01"); // under half a day
  assert.equal(xToDay(x + 2.6, range, ppd), "2026-08-02");
  assert.equal(xToDay(-400, range, ppd), range.start);
  assert.equal(xToDay(1e9, range, ppd), range.end);
  assert.equal(fitPxPerDay({ days: 100 }, 800), 8);
});

test("ticks label months, weeks and quarters in the app's own month names", () => {
  const range = { start: "2026-08-01", end: "2026-10-31" };
  const months = ticks(range, "months");
  assert.deepEqual(months.map((t) => t.label), ["Aug", "Sep", "Oct"]);
  assert.equal(months[0].year, 2026);
  assert.equal(months[1].year, null);

  const quarters = ticks({ start: "2026-07-01", end: "2027-06-30" }, "quarters");
  assert.deepEqual(quarters.map((t) => t.label), ["Jul–Sep", "Oct–Dec", "Jan–Mar", "Apr–Jun"]);
  assert.deepEqual(quarters.map((t) => t.year), [2026, null, 2027, null]);

  const weeks = ticks({ start: "2026-07-27", end: "2026-08-16" }, "weeks");
  assert.deepEqual(
    weeks.map((t) => `${t.kind}:${t.label}`),
    ["minor:27", "major:Aug", "minor:3", "minor:10"],
  );
});

test("weekends are shaded Saturday to Sunday", () => {
  const spans = weekendSpans({ start: "2026-07-12", end: "2026-07-25" });
  // 12 Jul 2026 is a Sunday, so it stands alone; then 18–19 and 25.
  assert.deepEqual(spans, [
    { start: "2026-07-12", days: 1 },
    { start: "2026-07-18", days: 2 },
    { start: "2026-07-25", days: 1 },
  ]);
});

test("the dense wedding cluster merges deterministically", () => {
  // Mara & Finn in August, at Months zoom: 1, 8, 22 and 29 Aug, 5 Sep.
  const range = { start: "2026-06-01" };
  const ppd = pxPerDay("months");
  const titles = ["Menu tasting", "Invitations", "Fitting", "Music", "Guest numbers"];
  const days = ["2026-08-01", "2026-08-08", "2026-08-22", "2026-08-29", "2026-09-05"];
  const marks = days.map((day, i) => ({ x: dayToX(day, range, ppd), item: titles[i] }));

  const groups = clusterMarks(marks, 40);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].kind, "cluster");
  assert.deepEqual(groups[0].kind === "cluster" ? groups[0].items : [], ["Menu tasting", "Invitations"]);
  assert.equal(groups[1].kind, "cluster");
  assert.deepEqual(groups[1].kind === "cluster" ? groups[1].items : [], ["Fitting", "Music", "Guest numbers"]);

  // Shuffled input, same answer.
  const shuffled = [marks[3], marks[0], marks[4], marks[1], marks[2]];
  assert.deepEqual(clusterMarks(shuffled, 40), groups);

  // At Weeks zoom there is room for every one of them.
  const wide = days.map((day, i) => ({ x: dayToX(day, range, pxPerDay("weeks")), item: titles[i] }));
  assert.ok(clusterMarks(wide, 40).every((group) => group.kind === "single"));
});

test("date phrases read the same everywhere", () => {
  assert.equal(formatShortDay("2026-09-05", TODAY), "5 Sep");
  assert.equal(formatShortDay("2027-01-02", TODAY), "2 Jan 2027");
  assert.equal(formatDayMonthYear("2026-10-03"), "3 Oct 2026");
  assert.equal(formatWeekdayDate("2026-10-03"), "Sat 3 Oct 2026");
  assert.equal(relativeDayPhrase("2026-08-01", TODAY), "in 16 days");
  assert.equal(relativeDayPhrase("2026-07-17", TODAY), "tomorrow");
  assert.equal(relativeDayPhrase("2026-07-13", TODAY), "3 days ago");
});

test("initialScrollLeft puts today at the given share of the width, clamped to the range", () => {
  const range = { start: "2026-06-01", days: 183 }; // 1 Jun to 30 Nov 2026
  // Today is day 45; its centre at 5px/day is 227.5px; 30% of 800 is 240.
  assert.equal(initialScrollLeft(range, 5, "2026-07-16", 800, 0.3), 0);
  // Wider scale: 20px/day, centre at 910; 910 - 240 = 670.
  assert.equal(initialScrollLeft(range, 20, "2026-07-16", 800, 0.3), 670);
  // Never past the end: the range is 3660px wide, the most it can scroll is 2860.
  assert.equal(initialScrollLeft(range, 20, "2026-11-29", 800, 0.3), 2860);
  // The phone's rule: 24px from the left edge is an align of 24/width.
  assert.equal(initialScrollLeft(range, 20, "2026-07-16", 360, 24 / 360), 886);
  // Nothing measured yet, or nonsense in, means no scroll.
  assert.equal(initialScrollLeft(range, 20, "2026-07-16", 0), 0);
  assert.equal(initialScrollLeft(range, 20, "not a day", 800), 0);
});

test("strip fill is a share of the whole bar, even when the bar starts before the window", async () => {
  const { stripExtent } = await import("./project-portfolio-scale");
  // A 200-day project, 40% done, that began 150 days before the window.
  const w = { start: "2026-09-11", end: "2027-03-25", days: 196 };
  const extent = stripExtent({ from: "2026-04-14", to: "2026-10-31", percent: 40 }, w);
  // 40% of 200 days is day 80 from 14 Apr: 3 Jul, before the window opens.
  assert.equal(extent.doneTo, null);
  assert.equal(extent.clippedStart, true);
  assert.equal(extent.barFrom, 0);

  // 90% done: the fill ends on 11 Oct (day 180), inside the window, well short of the bar's end.
  const late = stripExtent({ from: "2026-04-14", to: "2026-10-31", percent: 90 }, w);
  const expected = (diffDays(w.start, "2026-10-11") / (w.days - 1)) * 100;
  assert.ok(late.doneTo !== null && Math.abs(late.doneTo - expected) < 1, `done ends at ${late.doneTo}`);
  assert.ok(late.doneTo! < late.barTo);
});

test("strip extent inside the window keeps rounded ends", async () => {
  const { stripExtent } = await import("./project-portfolio-scale");
  const w = { start: "2026-09-11", end: "2027-03-25", days: 196 };
  const extent = stripExtent({ from: "2026-10-01", to: "2026-12-01", percent: 50 }, w);
  assert.equal(extent.clippedStart, false);
  assert.equal(extent.clippedEnd, false);
  assert.ok(extent.doneTo! > extent.barFrom && extent.doneTo! < extent.barTo);
});
