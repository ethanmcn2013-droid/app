import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const queries = readFileSync(new URL("./planning/queries.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions/planning.ts", import.meta.url), "utf8");
const securityBoundary = readFileSync(new URL("./planning/security-boundary.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../drizzle/0013_planning_periods.sql", import.meta.url), "utf8");
const onboarding = readFileSync(new URL("../components/welcome/contextual-onboarding.tsx", import.meta.url), "utf8");

function actionSource(start, end) {
  const from = actions.indexOf(start);
  const to = actions.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing action marker: ${start}`);
  assert.ok(to > from, `missing action end marker: ${end}`);
  return actions.slice(from, to);
}

test("every Your Work workspace originates from a current membership", () => {
  assert.match(queries, /\.from\(workspaceMembers\)/);
  assert.match(queries, /eq\(workspaceMembers\.userId, actorUserId\)/);
  assert.match(queries, /periodOwnerUserId === actorUserId/);
});

test("lifecycle mutations re-authorize owner at the data boundary", () => {
  assert.match(actions, /requirePlanningPeriodOwner/);
  assert.match(actions, /requireWorkspaceOwner/);
  assert.match(actions, /publishedAt: null/);
  assert.match(actions, /sponsorship/);
  assert.doesNotMatch(actions, /copy.*shareLinks/i);
  assert.doesNotMatch(actions, /copy.*pendingInvites/i);
});

test("bulk workspace name collisions only include current memberships", () => {
  const bulk = actionSource(
    "export async function bulkCreateWorkspacesAction",
    "export async function moveWorkspaceAction",
  );
  assert.match(bulk, /listCurrentMemberWorkspaceNamesInPeriod\(/);
  const helperStart = securityBoundary.indexOf(
    "export async function listCurrentMemberWorkspaceNamesInPeriod",
  );
  const helper = securityBoundary.slice(helperStart);
  assert.ok(helperStart >= 0);
  assert.match(helper, /\.from\(workspaceMembers\)/);
  assert.match(helper, /eq\(workspaceMembers\.userId, actorUserId\)/);
  assert.match(helper, /eq\(workspaces\.planningPeriodId, planningPeriodId\)/);
});

test("workspace mutation sinks bind current owner membership and check affected rows", () => {
  for (const [start, end] of [
    [
      "export async function moveWorkspaceAction",
      "export async function reorderWorkspaceAction",
    ],
    [
      "export async function reorderWorkspaceAction",
      "export async function archiveWorkspaceAction",
    ],
    ["async function setWorkspaceArchived", "async function insertWorkspaces"],
  ]) {
    const source = actionSource(start, end);
    assert.match(
      source,
      /workspaceOwnerMembershipCondition\(actorUserId, workspace\.id|workspaceOwnerMembershipCondition\(actorUserId, workspaceId/,
    );
    assert.match(source, /\.returning\(\{ id: workspaces\.id \}\)/);
    assert.match(source, /if \(!updated\[0\]\) throw new Error\("Workspace not found\."\)/);
  }
});

test("duplication reads re-authorize inside their transaction", () => {
  for (const [start, end] of [
    [
      "export async function getWorkspaceDuplicationReviewAction",
      "export async function duplicateWorkspaceAction",
    ],
    [
      "export async function duplicateWorkspaceAction",
      "export async function getPlanningPeriodDuplicationReviewAction",
    ],
    [
      "export async function duplicatePlanningPeriodAction",
      "export async function savePlanningOnboardingDraftAction",
    ],
  ]) {
    const source = actionSource(start, end);
    const transaction = source.indexOf("db.transaction");
    const recheck = source.indexOf("requireWorkspaceOwnerInTransaction", transaction);
    assert.ok(transaction >= 0, `${start} must use a transaction`);
    assert.ok(recheck > transaction, `${start} must re-authorize inside its transaction`);
  }
});

test("scenario K: teacher onboarding and planning catalog never require pupil data", () => {
  assert.match(onboarding, /does not need pupil names, emails, identifiers, or accounts/i);
  assert.doesNotMatch(migration, /pupil_(name|email|id)/i);
  assert.doesNotMatch(actions, /pupil(Name|Email|Id)/);
});
