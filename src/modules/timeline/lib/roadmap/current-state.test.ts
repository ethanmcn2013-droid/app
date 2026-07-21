/**
 * Tests for the current-state verdict, the public page's single-glance
 * read. Run: npx tsx --test src/lib/roadmap/current-state.test.ts
 *
 * The three-state contract is load-bearing: "On track" is a public
 * claim on the owner's behalf, so it must only render when nothing
 * dated is behind and nothing is waiting. "Aiming" must carry the
 * degradation without leaking counts. Null means say nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { currentState } from "./current-state";

const NOW = Date.UTC(2026, 5, 6, 12, 0, 0); // 2026-06-06T12:00:00Z

function task(over: Partial<{
  status: "in-flight" | "next" | "shipped" | "refused" | "waiting";
  targetDate: string | null;
  updatedAt: Date;
  kind: "cycle" | "milestone";
  isLaunch: boolean;
}> = {}) {
  return {
    status: "in-flight" as const,
    targetDate: null,
    updatedAt: new Date(NOW),
    kind: "cycle" as const,
    isLaunch: false,
    ...over,
  };
}

const milestone = (over: Partial<{ status: string; targetDate: string | null }> = {}) => ({
  status: "next",
  targetDate: "2026-06-14",
  ...over,
}) as { status: "next" | "shipped" | "refused"; targetDate: string | null };

test("on track, upcoming milestone, nothing late, nothing waiting", () => {
  const s = currentState(
    [task({ targetDate: "2026-06-10" }), task({ status: "shipped" })],
    [milestone()],
    NOW,
  );
  assert.deepEqual(s, { kind: "on-track", date: "2026-06-14" });
});

test("aiming, an item is past its date", () => {
  const s = currentState(
    [task({ targetDate: "2026-06-01" })],
    [milestone()],
    NOW,
  );
  assert.deepEqual(s, { kind: "aiming", date: "2026-06-14" });
});

test("aiming, an item is waiting", () => {
  const s = currentState([task({ status: "waiting" })], [milestone()], NOW);
  assert.deepEqual(s, { kind: "aiming", date: "2026-06-14" });
});

test("a late milestone row does not flip the verdict by itself", () => {
  // Milestone rows are the destination, not the work, only the
  // feeding items decide on-track vs aiming.
  const s = currentState(
    [task({ kind: "milestone", targetDate: "2026-06-01", status: "next" })],
    [milestone()],
    NOW,
  );
  assert.deepEqual(s, { kind: "on-track", date: "2026-06-14" });
});

test("skips shipped and undated milestones when picking the target", () => {
  const s = currentState(
    [task()],
    [
      milestone({ status: "shipped", targetDate: "2026-06-01" }),
      milestone({ targetDate: null }),
      milestone({ targetDate: "2026-07-02" }),
    ],
    NOW,
  );
  assert.deepEqual(s, { kind: "on-track", date: "2026-07-02" });
});

test("everything shipped, completion verdict without a milestone", () => {
  const s = currentState(
    [task({ status: "shipped" }), task({ status: "refused" })],
    [],
    NOW,
  );
  assert.deepEqual(s, { kind: "shipped" });
});

test("null, no dated milestone and open work (say nothing)", () => {
  assert.equal(currentState([task()], [], NOW), null);
});

test("null, empty workspace", () => {
  assert.equal(currentState([], [], NOW), null);
});
