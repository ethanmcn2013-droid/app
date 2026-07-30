import assert from "node:assert/strict";
import test from "node:test";

import { LANE_ORDER, type PublicTask } from "./data";
import { publicLane, publicLaneOrder } from "./public-board-lanes";

/**
 * Guest-facing surfaces must not silently drop work.
 *
 * The share link, print sheet and public embed all iterated the four
 * canonical lanes. The board runs a five-status model whose fifth status
 * (`waiting`) has no canonical lane and is persisted as raw text, so a task
 * parked in Waiting rendered nowhere on a link a client had been sent, with
 * nothing to signal the omission. These tests pin the fix.
 */

function task(id: string, lane: string): PublicTask {
  return { id, title: id, lane: lane as PublicTask["lane"], priority: "p2" };
}

test("canonical lanes keep their fixed order", () => {
  const order = publicLaneOrder([task("a", "todo"), task("b", "done")]);
  assert.deepEqual(order.slice(0, LANE_ORDER.length), [...LANE_ORDER]);
});

test("a non-canonical lane is rendered, not dropped", () => {
  const order = publicLaneOrder([task("a", "todo"), task("b", "waiting")]);
  assert.ok(
    order.includes("waiting"),
    "a task in Waiting must appear on guest surfaces",
  );
});

test("non-canonical lanes come after the canonical four", () => {
  const order = publicLaneOrder([task("a", "waiting"), task("b", "todo")]);
  assert.equal(order.indexOf("waiting"), LANE_ORDER.length);
});

test("extra lanes are stable in order and deduplicated", () => {
  const order = publicLaneOrder([
    task("a", "waiting"),
    task("b", "on_hold"),
    task("c", "waiting"),
  ]);
  assert.deepEqual(order.slice(LANE_ORDER.length), ["on_hold", "waiting"]);
});

test("no extra columns when every task is canonical", () => {
  const order = publicLaneOrder([task("a", "todo"), task("b", "review")]);
  assert.equal(order.length, LANE_ORDER.length);
});

test("an unknown lane gets a readable name and neutral tone", () => {
  const lane = publicLane("waiting");
  assert.equal(lane.name, "Waiting");
  // Neutral is the no-tint treatment custom columns already get; it must not
  // borrow a canonical lane's semantic colour.
  assert.match(lane.bg, /lane-neutral/);
});

test("underscores and hyphens humanise", () => {
  assert.equal(publicLane("on_hold").name, "On hold");
  assert.equal(publicLane("needs-review").name, "Needs review");
});

test("a canonical lane keeps its own name and tone", () => {
  const lane = publicLane("done");
  assert.equal(lane.id, "done");
  assert.match(lane.bg, /lane-done/);
});
