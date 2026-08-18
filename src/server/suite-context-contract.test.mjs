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

/**
 * Renegotiated 2026-08-17 (D-028), not deleted to make a build green.
 *
 * This guard used to pin "membership and period are validated before the COOKIE
 * WRITE". There is no cookie write any more: a contextual link is navigation,
 * not selection, so the handler carries the Project in the URL and leaves the
 * bare-entry preference alone. The invariant that mattered was never about the
 * cookie specifically — it was that nothing authorized reaches the caller before
 * both checks have run. That is what it pins now, against the authorized
 * redirect, and it is strictly harder to satisfy than the old ordering because
 * the redirect is the ONLY thing this route can hand back.
 *
 * The second assertion is the new half: this route writes no cookie at all. A
 * bare ordering test would pass a file that quietly reintroduced the write
 * further down, which is exactly the regression D-028 forecloses.
 */
test("incoming workspace hint is membership and period validated before anything authorized is returned", () => {
  const membershipCheck = incoming.indexOf("eq(workspaceMembers.userId, actorUserId)");
  const periodCheck = incoming.indexOf("eq(workspaces.planningPeriodId, planningPeriodId)");
  const authorizedRedirect = incoming.indexOf("const authorizedTarget");
  assert.ok(membershipCheck >= 0);
  assert.ok(periodCheck >= 0);
  assert.ok(authorizedRedirect > membershipCheck);
  assert.ok(authorizedRedirect > periodCheck);
  assert.match(incoming, /Cache-Control.*no-store/);

  // D-028: navigation, not selection. The Project rides the URL.
  assert.doesNotMatch(
    incoming,
    /cookies\.set|ACTIVE_WORKSPACE_COOKIE_NAME/,
    "a contextual link must not rewrite the last-active Project preference",
  );
  assert.match(
    incoming,
    /authorizedTarget\.searchParams\.set\(PROJECT_URL_PARAM, workspaceId\)/,
    "the destination must resolve the Project explicitly, never ambiently",
  );
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
