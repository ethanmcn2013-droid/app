/**
 * Tests for the needs-attention derived signal.
 *
 * Run: npx tsx --test src/lib/roadmap/needs-attention.test.ts
 *
 * The selector is the contract that owner surfaces use to render the
 * Tier 3 attention pill. Idle/overdue boundaries, settled-state exclusion,
 * and the overdue-over-idle precedence rule are all load-bearing, getting
 * any of them wrong either silently swallows drift the owner needs to see
 * or floods them with false positives that make the signal noise.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  IDLE_DAYS_THRESHOLD,
  attentionReason,
  countNeedsAttention,
  needsAttention,
} from "./needs-attention";

const NOW = Date.UTC(2026, 5, 6, 12, 0, 0); // 2026-06-06T12:00:00Z
const DAY = 1000 * 60 * 60 * 24;

function task(over: Partial<{
  status: "in-flight" | "next" | "shipped" | "refused" | "waiting";
  targetDate: string | null;
  updatedAt: Date;
}>) {
  return {
    status: over.status ?? "in-flight",
    targetDate: over.targetDate ?? null,
    updatedAt: over.updatedAt ?? new Date(NOW),
  } as const;
}

test("idle, in-flight task untouched for 14+ days flags idle", () => {
  const t = task({
    status: "in-flight",
    updatedAt: new Date(NOW - IDLE_DAYS_THRESHOLD * DAY),
  });
  assert.equal(attentionReason(t, NOW), "idle");
  assert.equal(needsAttention(t, NOW), true);
});

test("idle, 13-day-old in-flight task is still calm", () => {
  const t = task({
    status: "in-flight",
    updatedAt: new Date(NOW - 13 * DAY),
  });
  assert.equal(attentionReason(t, NOW), null);
});

test("idle, waiting counts as active for idle (so a stale waiting task surfaces)", () => {
  const t = task({
    status: "waiting",
    updatedAt: new Date(NOW - 20 * DAY),
  });
  assert.equal(attentionReason(t, NOW), "idle");
});

test("idle, 'next' is not active state, so idle does not apply", () => {
  const t = task({
    status: "next",
    updatedAt: new Date(NOW - 90 * DAY),
  });
  assert.equal(attentionReason(t, NOW), null);
});

test("overdue, past targetDate with non-settled status flags overdue", () => {
  const t = task({ status: "in-flight", targetDate: "2026-06-01" });
  assert.equal(attentionReason(t, NOW), "overdue");
});

test("overdue, past targetDate with shipped status is settled (calm)", () => {
  const t = task({ status: "shipped", targetDate: "2026-06-01" });
  assert.equal(attentionReason(t, NOW), null);
});

test("overdue, past targetDate with refused status is settled (calm)", () => {
  const t = task({ status: "refused", targetDate: "2026-06-01" });
  assert.equal(attentionReason(t, NOW), null);
});

test("overdue, same-day targetDate is not overdue (calendar-day anchor)", () => {
  const t = task({ status: "in-flight", targetDate: "2026-06-06" });
  assert.equal(attentionReason(t, NOW), null);
});

test("overdue, future targetDate is calm", () => {
  const t = task({ status: "in-flight", targetDate: "2026-06-30" });
  assert.equal(attentionReason(t, NOW), null);
});

test("precedence, overdue wins over idle when both apply", () => {
  const t = task({
    status: "in-flight",
    targetDate: "2026-05-01",
    updatedAt: new Date(NOW - 30 * DAY),
  });
  assert.equal(attentionReason(t, NOW), "overdue");
});

test("malformed targetDate does not crash, returns null", () => {
  const t = task({ status: "in-flight", targetDate: "not-a-date" });
  assert.equal(attentionReason(t, NOW), null);
});

test("missing targetDate + recent updatedAt → null", () => {
  const t = task({ status: "in-flight", targetDate: null });
  assert.equal(attentionReason(t, NOW), null);
});

test("countNeedsAttention, counts mixed list correctly", () => {
  const tasks = [
    task({ status: "in-flight", updatedAt: new Date(NOW - 20 * DAY) }), // idle
    task({ status: "in-flight", targetDate: "2026-06-01" }), // overdue
    task({ status: "next" }), // calm
    task({ status: "shipped" }), // calm
    task({ status: "waiting", updatedAt: new Date(NOW - 30 * DAY) }), // idle
  ];
  assert.equal(countNeedsAttention(tasks, NOW), 3);
});

test("countNeedsAttention, empty list returns 0", () => {
  assert.equal(countNeedsAttention([], NOW), 0);
});
