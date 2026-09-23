import { test } from "node:test";
import assert from "node:assert/strict";
import { floorProjectName } from "@/lib/projects/floor-project-name";

test("real Project name wins over domain example until the owner sets a board title", () => {
  const project = { boardName: null, workspaceName: "Personal", domainExample: "Q3 Launch · Plays in motion" };
  assert.equal(floorProjectName(project), "Personal");
  assert.equal(floorProjectName({ ...project, boardName: "My work" }), "My work");
  assert.equal(floorProjectName({ ...project, boardName: "   " }), "Personal");
  assert.equal(floorProjectName({ ...project, workspaceName: null }), "Q3 Launch · Plays in motion", "demo/domain preview keeps its example");
});
