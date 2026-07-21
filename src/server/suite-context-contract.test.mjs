import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const switcher = readFileSync(new URL("../components/app/suite-switcher-pills.tsx", import.meta.url), "utf8");
const suiteContext = readFileSync(new URL("../lib/suite-context.ts", import.meta.url), "utf8");
const incoming = readFileSync(new URL("../app/api/suite-context/route.ts", import.meta.url), "utf8");

test("scenario E: suite links carry only allowlisted context hints", () => {
  assert.match(switcher, /withSuiteContext\(p\.appUrl, suiteContext\)/);
  assert.match(suiteContext, /sourceProduct/);
  assert.match(suiteContext, /planningPeriodId/);
  assert.match(suiteContext, /workspaceId/);
  assert.match(suiteContext, /projectId/);
  for (const forbidden of ["noteId", "taskId", "shareToken", "publicLink", "attachmentId"]) {
    assert.equal(switcher.includes(forbidden), false);
  }
});

test("incoming workspace hint is membership and period validated before cookie write", () => {
  const membershipCheck = incoming.indexOf("eq(workspaceMembers.userId, actorUserId)");
  const periodCheck = incoming.indexOf("eq(workspaces.planningPeriodId, planningPeriodId)");
  const cookieWrite = incoming.indexOf("authorizedResponse.cookies.set");
  assert.ok(membershipCheck >= 0);
  assert.ok(periodCheck >= 0);
  assert.ok(cookieWrite > membershipCheck);
  assert.ok(cookieWrite > periodCheck);
  assert.match(incoming, /Cache-Control.*no-store/);
});

test("workspace-only suite hints are membership checked and project hints remain navigation-only", () => {
  assert.match(incoming, /planningPeriodId !== null/);
  assert.match(incoming, /membershipPredicate/);
  assert.match(incoming, /isSuiteContextId\(projectId\)/);
});
