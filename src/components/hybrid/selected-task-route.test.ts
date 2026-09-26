import assert from "node:assert/strict";
import test from "node:test";
import { floorViewHref } from "@/lib/projects/floor-view-href";
import { assertProjectId } from "@/lib/projects/project-ref";
import { withInspectedTask } from "./selected-task-route";
import type { LabRouteState, LabView } from "./types";

const base: LabRouteState = {
  option: "hybrid", view: "board", dataset: "normal", density: "comfortable",
  mode: "default", task: null,
};
const b = assertProjectId("ws-b-owned");

test("an open production task stays selected across every Tasks view in B", () => {
  const open = withInspectedTask(base, "task-owned-by-b");
  for (const view of ["board", "list", "calendar"] as LabView[]) {
    const href = new URL(floorViewHref(view, b, open.task), "https://example.invalid");
    assert.equal(href.searchParams.get("workspaceId"), b);
    assert.equal(href.searchParams.get("task"), "task-owned-by-b");
  }
  assert.equal(base.task, null, "projection must not mutate the base route");
});

test("closing the production panel clears the task but keeps B scope", () => {
  const closed = withInspectedTask(withInspectedTask(base, "task-owned-by-b"), null);
  const href = new URL(floorViewHref("list", b, closed.task), "https://example.invalid");
  assert.equal(href.searchParams.get("workspaceId"), b);
  assert.equal(href.searchParams.has("task"), false);
});
