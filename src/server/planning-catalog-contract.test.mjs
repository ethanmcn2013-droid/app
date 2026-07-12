import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/internal/workspaces/route.ts", import.meta.url),
  "utf8",
);

test("v2 catalog requires the signed workspace-list assertion and contract version", () => {
  assert.match(route, /signal-tasks\.workspace-list/);
  assert.match(route, /contractVersion/);
  assert.match(route, /claims\.sub/);
  assert.match(route, /claims\.exp <= now/);
  assert.match(route, /seenJtis/);
});

test("v2 catalog is membership-first and returns period groups without archived data", () => {
  assert.match(route, /from\(workspaceMembers\)/);
  assert.match(route, /eq\(workspaceMembers\.userId, user\.id\)/);
  assert.match(route, /isNull\(workspaces\.archivedAt\)/);
  assert.match(route, /isNull\(planningPeriods\.archivedAt\)/);
  assert.match(route, /periods:/);
  assert.match(route, /workspaces:/);
  assert.match(route, /private, no-store/);
});

test("v2 catalog never uses email or period ownership as membership authority", () => {
  assert.doesNotMatch(route, /where\(eq\(users\.email/);
  assert.match(route, /workspaceMembers/);
  assert.match(route, /planningPeriodOwnerId/);
});
