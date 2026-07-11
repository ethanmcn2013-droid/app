import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  new URL("../app/api/notes-extract/route.ts", import.meta.url),
  "utf8",
);

test("Notes extract requires an explicit destination workspace", () => {
  assert.match(route, /workspaceId: string/);
  assert.match(route, /Missing required field: workspaceId/);
  assert.match(route, /assertion\.workspaceId !== requestedWorkspaceId/);
  assert.match(route, /eq\(workspaceMembers\.workspaceId, requestedWorkspaceId\)/);
});

test("Notes extract rejects a retry that targets a different workspace", () => {
  assert.match(route, /existing\.workspaceId !== requestedWorkspaceId/);
  assert.match(route, /already sent to another Tasks workspace/);
});
