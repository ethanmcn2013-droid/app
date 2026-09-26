import assert from "node:assert/strict";
import test from "node:test";
import { floorViewHref } from "./floor-view-href";
import { assertProjectId } from "./project-ref";

const projectB = assertProjectId("ws-b-owned");

test("each Tasks view switch carries the exact Project and open task", () => {
  assert.equal(floorViewHref("board", projectB, "task 42"), "/app/tasks?task=task+42&workspaceId=ws-b-owned");
  assert.equal(floorViewHref("list", projectB, "task 42"), "/app/tasks/list?task=task+42&workspaceId=ws-b-owned");
  assert.equal(floorViewHref("calendar", projectB, "task 42"), "/app/tasks/calendar?task=task+42&workspaceId=ws-b-owned");
});

test("the link builder leaves a contextless demo path usable", () => {
  assert.equal(floorViewHref("list", null, null), "/app/tasks/list");
});
