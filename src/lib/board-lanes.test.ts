import { test } from "node:test";
import assert from "node:assert/strict";
import { LANES, LANE_ORDER } from "@/lib/data";

test("standard columns render in the required order", () => {
  // Internal lane ids are STABLE; the required left-to-right order holds
  // by position, so no task migrates.
  assert.deepEqual(LANE_ORDER, ["todo", "doing", "review", "done"]);
});

test("standard columns default to the shipped board vocabulary (T·120)", () => {
  // These are the names the app has rendered since 2026-07-20. Share,
  // print, embed and export label from LANES, so this alignment is what
  // keeps a guest's copy agreeing with the operator's screen. Workspace
  // configs override per project.
  assert.equal(LANES.todo.name, "Queued");
  assert.equal(LANES.doing.name, "In progress");
  assert.equal(LANES.review.name, "Review");
  assert.equal(LANES.done.name, "Done");
});
