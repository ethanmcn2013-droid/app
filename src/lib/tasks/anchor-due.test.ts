import assert from "node:assert/strict";
import { test } from "node:test";

import {
  anchorNoun,
  describeAnchorFromToday,
  relateDueToAnchor,
  toCalendarDate,
} from "./anchor-due";

test("a due date before the anchor counts down in exact days", () => {
  const rel = relateDueToAnchor("2027-05-01", "2027-06-12", "Wedding");
  assert.equal(rel?.state, "before");
  assert.equal(rel?.days, 42);
  assert.equal(rel?.label, "42 days before the wedding");
});

test("a due date after the anchor counts up, never negative", () => {
  const rel = relateDueToAnchor("2027-06-15", "2027-06-12", "Wedding");
  assert.equal(rel?.state, "after");
  assert.equal(rel?.days, 3);
  assert.equal(rel?.label, "3 days after the wedding");
});

test("the anchor day itself is named, not counted as zero days", () => {
  const rel = relateDueToAnchor("2027-06-12", "2027-06-12", "Wedding");
  assert.deepEqual(rel, { state: "on", days: 0, label: "On the wedding" });
});

test("one day reads singular on both sides", () => {
  assert.equal(
    relateDueToAnchor("2027-06-11", "2027-06-12", "Wedding")?.label,
    "1 day before the wedding",
  );
  assert.equal(
    relateDueToAnchor("2027-06-13", "2027-06-12", "Wedding")?.label,
    "1 day after the wedding",
  );
});

test("no anchor and no due date both produce nothing, never a guess", () => {
  assert.equal(relateDueToAnchor("2027-06-11", null, "Wedding"), null);
  assert.equal(relateDueToAnchor(null, "2027-06-12", "Wedding"), null);
  assert.equal(relateDueToAnchor(undefined, undefined, "Wedding"), null);
});

test("a malformed date is refused rather than coerced", () => {
  assert.equal(relateDueToAnchor("2027-02-30", "2027-06-12", "Wedding"), null);
  assert.equal(relateDueToAnchor("12/06/2027", "2027-06-12", "Wedding"), null);
  assert.equal(relateDueToAnchor("2027-06-12", "not-a-date", "Wedding"), null);
});

test("the count is calendar days, so it survives a DST boundary", () => {
  // Ireland moves the clocks on 2027-03-28. 25 and 26 March are one day apart
  // in calendar terms whatever the clocks do.
  const rel = relateDueToAnchor("2027-03-25", "2027-03-29", "Wedding");
  assert.equal(rel?.days, 4);
});

test("a leap day is a real day in the count", () => {
  const rel = relateDueToAnchor("2028-02-28", "2028-03-01", "Wedding");
  assert.equal(rel?.days, 2);
});

test("the label noun comes from the workspace, never hard-coded to wedding", () => {
  assert.equal(anchorNoun("Wedding"), "the wedding");
  assert.equal(anchorNoun("Examinations"), "the examinations");
  assert.equal(anchorNoun("Opening night"), "the opening night");
  assert.equal(
    relateDueToAnchor("2027-05-01", "2027-06-12", "Examinations")?.label,
    "42 days before the examinations",
  );
});

test("a label that already carries an article is not doubled", () => {
  assert.equal(anchorNoun("The big day"), "the big day");
  assert.equal(anchorNoun("Our wedding"), "our wedding");
});

test("an unlabelled anchor still reads as English", () => {
  assert.equal(anchorNoun(null), "the day");
  assert.equal(anchorNoun("   "), "the day");
  assert.equal(
    relateDueToAnchor("2027-05-01", "2027-06-12", null)?.label,
    "42 days before the day",
  );
});

test("the anchor countdown from today reads in three tenses", () => {
  assert.equal(
    describeAnchorFromToday("2026-08-03", "2027-06-12", "Wedding"),
    "The wedding is in 313 days",
  );
  assert.equal(
    describeAnchorFromToday("2027-06-12", "2027-06-12", "Wedding"),
    "The wedding is today",
  );
  assert.equal(
    describeAnchorFromToday("2027-06-13", "2027-06-12", "Wedding"),
    "The wedding was 1 day ago",
  );
  assert.equal(describeAnchorFromToday("2026-08-03", null, "Wedding"), null);
});

test("a local Date becomes the calendar date the user sees, not a UTC shift", () => {
  // 23:30 local on 31 December is still 31 December on the picker.
  assert.equal(toCalendarDate(new Date(2026, 11, 31, 23, 30)), "2026-12-31");
  assert.equal(toCalendarDate(new Date(2026, 0, 1, 0, 5)), "2026-01-01");
  assert.equal(toCalendarDate(new Date(Number.NaN)), null);
});

test("no rendered line contains an em dash or an exclamation mark", () => {
  const lines = [
    relateDueToAnchor("2027-05-01", "2027-06-12", "Wedding")?.label,
    relateDueToAnchor("2027-06-12", "2027-06-12", "Wedding")?.label,
    relateDueToAnchor("2027-06-15", "2027-06-12", "Wedding")?.label,
    describeAnchorFromToday("2026-08-03", "2027-06-12", "Wedding"),
  ];
  for (const line of lines) {
    assert.ok(line, "expected a line");
    assert.ok(!line.includes("—"), `em dash in: ${line}`);
    assert.ok(!line.includes("!"), `exclamation mark in: ${line}`);
  }
});
