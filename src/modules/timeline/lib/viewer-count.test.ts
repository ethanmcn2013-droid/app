import assert from "node:assert/strict";
import test from "node:test";
import {
  VIEWER_COUNT_FLOOR,
  presentViewerCount,
  viewerCountSummary,
} from "@/modules/timeline/lib/viewer-count";

const AUGUST = new Date("2026-08-03T21:14:00.000Z");

test("every count below the floor is withheld, and they are indistinguishable", () => {
  const results = [0, 1, 2, 3, 4].map((count) =>
    presentViewerCount({ count, lastViewedAt: AUGUST }),
  );
  for (const result of results) {
    assert.equal(result.state, "withheld");
    assert.equal(result.reason, "below_floor");
  }
  // A count of one must produce byte-identical output to a count of zero.
  // Any difference is the de-anonymisation this module exists to remove.
  const [zero, ...rest] = results.map((result) => JSON.stringify(result));
  for (const other of rest) assert.equal(other, zero);
});

test("the withheld note never states the bound", () => {
  const result = presentViewerCount({ count: 1, lastViewedAt: AUGUST });
  assert.equal(result.state, "withheld");
  if (result.state !== "withheld") return;
  assert.doesNotMatch(
    result.note,
    /fewer than|less than|under \d|at least|\d/i,
    "the withheld copy discloses the floor",
  );
});

test("a withheld presentation carries no timestamp of any kind", () => {
  const result = presentViewerCount({ count: 1, lastViewedAt: AUGUST });
  const serialised = JSON.stringify(result);
  assert.doesNotMatch(serialised, /2026|Aug|august/i);
  assert.equal("lastViewedLabel" in result, false);
  assert.equal("count" in result, false);
});

test("at the floor the count is shown and the time is coarsened to a month", () => {
  const result = presentViewerCount({
    count: VIEWER_COUNT_FLOOR,
    lastViewedAt: AUGUST,
  });
  assert.equal(result.state, "shown");
  if (result.state !== "shown") return;
  assert.equal(result.countLabel, String(VIEWER_COUNT_FLOOR));
  assert.equal(result.lastViewedLabel, "August 2026");
  // The defect at artifact-studio.tsx:59-67 was a day-precision date. A month
  // cannot pin one visit.
  assert.doesNotMatch(result.lastViewedLabel ?? "", /\b3\b|21:|:14/);
});

test("the caller never receives a raw integer it could reformat", () => {
  const result = presentViewerCount({ count: 4_212, lastViewedAt: AUGUST });
  assert.equal(result.state, "shown");
  if (result.state !== "shown") return;
  assert.equal(result.countLabel, "4,212");
  for (const value of Object.values(result)) {
    assert.notEqual(typeof value, "number");
  }
});

test("a shown count with no recorded view has no last-viewed label", () => {
  const result = presentViewerCount({
    count: VIEWER_COUNT_FLOOR + 1,
    lastViewedAt: null,
  });
  assert.equal(result.state, "shown");
  if (result.state !== "shown") return;
  assert.equal(result.lastViewedLabel, null);
});

test("the floor is a property of the value, so a caller cannot lower it below one", () => {
  assert.throws(
    () => presentViewerCount({ count: 1, lastViewedAt: null, floor: 0 }),
    TypeError,
  );
  assert.throws(
    () => presentViewerCount({ count: 1, lastViewedAt: null, floor: 1.5 }),
    TypeError,
  );
});

test("a malformed count fails loudly rather than rendering", () => {
  assert.throws(() => presentViewerCount({ count: -1, lastViewedAt: null }), TypeError);
  assert.throws(() => presentViewerCount({ count: 1.5, lastViewedAt: null }), TypeError);
  assert.throws(
    () => presentViewerCount({ count: Number.NaN, lastViewedAt: null }),
    TypeError,
  );
});

test("the list summary is silent below the floor and never says why", () => {
  assert.equal(viewerCountSummary({ count: VIEWER_COUNT_FLOOR - 1 }), null);
  assert.equal(viewerCountSummary({ count: 0 }), null);
  assert.equal(viewerCountSummary({ count: VIEWER_COUNT_FLOOR }), "5 views");
});

test("the floor is not D-011's venue-cohort threshold of 3", () => {
  assert.equal(presentViewerCount({ count: 3, lastViewedAt: null }).state, "withheld");
  assert.equal(presentViewerCount({ count: 4, lastViewedAt: null }).state, "withheld");
});
