import { test } from "node:test";
import assert from "node:assert/strict";
import { LANES, LANE_ORDER } from "@/lib/data";

test("standard columns render in the required order", () => {
  // Internal lane ids are STABLE; the required left-to-right order holds
  // by position, so no task migrates.
  assert.deepEqual(LANE_ORDER, ["todo", "doing", "review", "done"]);
});

test("standard columns display the required title-case labels", () => {
  assert.equal(LANES.todo.name, "Blocked");
  assert.equal(LANES.doing.name, "In Progress");
  assert.equal(LANES.review.name, "Reviewing");
  assert.equal(LANES.done.name, "Done");
});
