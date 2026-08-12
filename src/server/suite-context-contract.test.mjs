import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const switcher = readFileSync(new URL("../components/app/suite-switcher-pills.tsx", import.meta.url), "utf8");
const suiteContext = readFileSync(new URL("../lib/suite-context.ts", import.meta.url), "utf8");
const incoming = readFileSync(new URL("../app/api/suite-context/route.ts", import.meta.url), "utf8");
const timelineAuth = readFileSync(
  new URL("../modules/timeline/server/auth.ts", import.meta.url),
  "utf8",
);

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

test("review Timeline accepts the canonical Tasks context only inside the demo boundary", () => {
  // The invariant is unchanged: the review-fixture branch is self-contained and
  // sits INSIDE the demo boundary, and real production resolution happens only
  // after it, so a fixture id can never be resolved through the production
  // path and no real workspace can be reached through the fixture one.
  //
  // WP1 changed only what production resolution is anchored to. It used to be
  // `getWorkspaceForSuiteIdForUser`, the local Timeline lookup, which
  // `resolveTimelineContext` no longer calls directly — resolution now runs
  // through `resolveCanonicalTimeline` (ADR 0001 §6, DECISIONS.md D-002). The
  // anchor moves to `getCurrentTasksWorkspaceContext`, which is the Tasks
  // membership read and therefore a truer name for "production authorization"
  // than the local lookup ever was. Renegotiated explicitly per D-007, not
  // deleted to make a build green.
  const demoBoundary = timelineAuth.indexOf("if (isDemoMode())");
  const fixtureAuthorization = timelineAuth.indexOf(
    "isReviewSuiteWorkspaceId(requestedWorkspaceId)",
  );
  const productionMembership = timelineAuth.indexOf(
    "getCurrentTasksWorkspaceContext(",
    fixtureAuthorization,
  );

  assert.ok(demoBoundary >= 0);
  assert.ok(fixtureAuthorization > demoBoundary);
  assert.ok(productionMembership > fixtureAuthorization);
  assert.match(
    timelineAuth,
    /workspaceId:\s*REVIEW_SUITE_FIXTURE\.workspace\.id/,
  );
  assert.match(
    timelineAuth,
    /planningPeriodId !==\s*REVIEW_SUITE_FIXTURE\.workspace\.planningPeriodId/,
  );
});
