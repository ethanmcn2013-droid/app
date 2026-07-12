import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const switcher = readFileSync(new URL("../components/app/suite-switcher-pills.tsx", import.meta.url), "utf8");
const incoming = readFileSync(new URL("../app/api/suite-context/route.ts", import.meta.url), "utf8");

test("scenario E: suite links carry only v2 planning and workspace context hints", () => {
  assert.match(switcher, /withSuiteContext\(p\.appUrl, suiteContext\)/);
  assert.match(switcher, /planningPeriodId/);
  assert.match(switcher, /workspaceId/);
  for (const forbidden of ["noteId", "taskId", "shareToken", "publicLink", "attachmentId"]) {
    assert.equal(switcher.includes(forbidden), false);
  }
});

test("incoming workspace hint is membership and period validated before cookie write", () => {
  const membershipCheck = incoming.indexOf("eq(workspaceMembers.userId, actorUserId)");
  const periodCheck = incoming.indexOf("eq(workspaces.planningPeriodId, planningPeriodId)");
  const cookieWrite = incoming.indexOf("response.cookies.set");
  assert.ok(membershipCheck >= 0);
  assert.ok(periodCheck >= 0);
  assert.ok(cookieWrite > membershipCheck);
  assert.ok(cookieWrite > periodCheck);
  assert.match(incoming, /Cache-Control.*no-store/);
});
