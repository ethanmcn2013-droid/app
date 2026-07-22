/**
 * Tests for the anchor + countdown primitive.
 * Run: npx tsx --test src/lib/roadmap/anchor.test.ts
 *
 * Two contracts are load-bearing:
 *   1. The anchor is the DESTINATION (furthest-out launch beat, else
 *      furthest-out dated milestone), not the next waypoint. Getting this
 *      wrong makes a wedding plan count down to the menu tasting.
 *   2. The countdown is calendar-day exact and register-correct: mono
 *      "T-47" for operators, plain "47 days from now" for recipients.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  anchorMilestone,
  countdown,
  countdownToken,
  countdownPhrase,
  type AnchorCandidate,
} from "./anchor";

const NOW = Date.UTC(2026, 5, 6, 12, 0, 0); // 2026-06-06T12:00:00Z

const m = (over: Partial<AnchorCandidate> = {}): AnchorCandidate => ({
  status: "next",
  targetDate: "2026-06-20",
  isLaunch: false,
  ...over,
});

// ── anchorMilestone ──────────────────────────────────────────────────────────

test("picks the furthest-out dated milestone when no launch beat is flagged", () => {
  const anchor = anchorMilestone([
    m({ targetDate: "2026-06-14" }),
    m({ targetDate: "2026-08-01" }),
    m({ targetDate: "2026-07-02" }),
  ]);
  assert.equal(anchor?.targetDate, "2026-08-01");
});

test("prefers a launch beat even when a later non-launch milestone trails it", () => {
  // Aug 1 is the launch; the Sep cleanup milestone is later but is not the
  // destination. The launch anchors.
  const anchor = anchorMilestone([
    m({ targetDate: "2026-08-01", isLaunch: true }),
    m({ targetDate: "2026-09-15", isLaunch: false }),
  ]);
  assert.equal(anchor?.targetDate, "2026-08-01");
});

test("among multiple launch beats, the furthest out anchors", () => {
  const anchor = anchorMilestone([
    m({ targetDate: "2026-07-01", isLaunch: true }),
    m({ targetDate: "2026-09-01", isLaunch: true }),
  ]);
  assert.equal(anchor?.targetDate, "2026-09-01");
});

test("ignores shipped and refused milestones", () => {
  const anchor = anchorMilestone([
    m({ targetDate: "2026-09-01", status: "shipped" }),
    m({ targetDate: "2026-08-15", status: "refused" }),
    m({ targetDate: "2026-07-10", status: "next" }),
  ]);
  assert.equal(anchor?.targetDate, "2026-07-10");
});

test("ignores undated milestones", () => {
  const anchor = anchorMilestone([
    m({ targetDate: null }),
    m({ targetDate: "2026-07-10" }),
  ]);
  assert.equal(anchor?.targetDate, "2026-07-10");
});

test("returns null when nothing is dated and open", () => {
  assert.equal(anchorMilestone([m({ targetDate: null })]), null);
  assert.equal(anchorMilestone([m({ status: "shipped" })]), null);
  assert.equal(anchorMilestone([]), null);
});

// ── countdown ────────────────────────────────────────────────────────────────

test("future date counts down in whole days", () => {
  assert.deepEqual(countdown("2026-06-20", NOW), { kind: "future", days: 14 });
});

test("the day itself is 'today', not T-0", () => {
  assert.deepEqual(countdown("2026-06-06", NOW), { kind: "today" });
});

test("a passed date reports elapsed days, positive magnitude", () => {
  assert.deepEqual(countdown("2026-06-01", NOW), { kind: "past", days: 5 });
});

test("countdown ticks on the UTC day boundary, not the wall-clock hour", () => {
  // 23:59 the evening before is still T-1, not T-0.
  const eve = Date.UTC(2026, 5, 19, 23, 59, 0);
  assert.deepEqual(countdown("2026-06-20", eve), { kind: "future", days: 1 });
});

// ── registers ────────────────────────────────────────────────────────────────

test("operator token grammar matches the milestone-card chip", () => {
  assert.equal(countdownToken({ kind: "future", days: 47 }), "T-47");
  assert.equal(countdownToken({ kind: "today" }), "Today");
  assert.equal(countdownToken({ kind: "past", days: 3 }), "−3d");
});

test("recipient phrase is plain English and singular-aware", () => {
  assert.equal(countdownPhrase({ kind: "future", days: 47 }), "47 days from now");
  assert.equal(countdownPhrase({ kind: "future", days: 1 }), "1 day from now");
  assert.equal(countdownPhrase({ kind: "today" }), "today");
  assert.equal(countdownPhrase({ kind: "past", days: 1 }), "1 day ago");
  assert.equal(countdownPhrase({ kind: "past", days: 3 }), "3 days ago");
});
