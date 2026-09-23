import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const queries = readFileSync(new URL("./planning/queries.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions/planning.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./projects/service.ts", import.meta.url), "utf8");
const projectDeletion = readFileSync(
  new URL(
    "./connections/project-drive-project-deletion.ts",
    import.meta.url,
  ),
  "utf8",
);
const securityBoundary = readFileSync(new URL("./planning/security-boundary.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../drizzle/0013_planning_periods.sql", import.meta.url), "utf8");
const onboarding = readFileSync(new URL("../components/welcome/contextual-onboarding.tsx", import.meta.url), "utf8");

function sliceOf(source, start, end, label) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing ${label} marker: ${start}`);
  assert.ok(to > from, `missing ${label} end marker: ${end}`);
  return source.slice(from, to);
}

function actionSource(start, end) {
  return sliceOf(actions, start, end, "action");
}

function serviceSource(start, end) {
  return sliceOf(service, start, end, "service");
}

test("every Your Work workspace originates from a current membership", () => {
  assert.match(queries, /\.from\(workspaceMembers\)/);
  assert.match(queries, /eq\(workspaceMembers\.userId, actorUserId\)/);
  assert.match(queries, /periodOwnerUserId === actorUserId/);
});

test("lifecycle mutations re-authorize at the data boundary", () => {
  // Period-level actions keep the period-owner proof in the action file;
  // Project-level lifecycle proofs moved into the consolidated service (WP6),
  // which authorizes through the WP3 capability seam, never the catalog.
  assert.match(actions, /requirePlanningPeriodOwner/);
  assert.match(actions, /requireWorkspaceOwner/);
  assert.match(service, /proveProjectCapability/);
  assert.match(service, /requirePlanningPeriodOwner/);
  assert.match(service, /publishedAt: null/);
  assert.match(actions, /sponsorship/);
  for (const source of [actions, service]) {
    assert.doesNotMatch(source, /copy.*shareLinks/i);
    assert.doesNotMatch(source, /copy.*pendingInvites/i);
  }
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

test("every consolidated Project mutation proves a capability, then writes with a receipt", () => {
  // WP6: the workspace lifecycle writes moved from planning.ts into the one
  // service. The old sink-level `workspaceOwnerMembershipCondition` — the
  // authorization-as-row-filter shape D-018 bans — is retired from these
  // paths; what holds the line instead is the seam proof BEFORE the write and
  // the `.returning()` receipt that throws when the write matched nothing.
  for (const [name, end] of [
    ["renameProject", "export async function reorderProject"],
    ["reorderProject", "export async function setProjectArchived"],
    ["setProjectArchived", "export async function moveProjectToPeriod"],
    ["moveProjectToPeriod", "type WorkspaceRow"],
  ]) {
    const source = serviceSource(`export async function ${name}`, end);
    const proof = source.indexOf("provedProject(");
    const write = source.search(/\.update\(workspaces\)|\.delete\(workspaces\)/);
    assert.ok(proof >= 0, `${name} must prove its capability through the seam`);
    assert.ok(write > proof, `${name} must prove BEFORE it writes`);
    assert.match(source, /\.returning\(\{ id: workspaces\.id/);
    assert.match(source, /throw new Error\(RECEIPT_MISSING\)/);
  }
  // Delete keeps authorization in the consolidated service, then delegates
  // to the durable Project Drive lifecycle. Its workspace receipt sits in
  // that lifecycle's final immediate transaction.
  const deletion = service.slice(
    service.indexOf("export async function deleteProject"),
  );
  assert.match(deletion, /"deleteOrTransferOwnership"/);
  assert.match(deletion, /createProjectDriveProjectDeletionService\(\{/);
  assert.match(projectDeletion, /\.returning\(\{ id: workspaces\.id \}\)/);
  assert.match(projectDeletion, /behavior: "immediate"/);
  assert.match(projectDeletion, /if \(!deleted\[0\]\)/);
  // The retired idiom must not creep back into the service. The header prose
  // NAMES workspaceOwnerMembershipCondition (it documents the retirement), so
  // the pin is on the import: the module that exports the sink condition must
  // not be reachable from the service at all.
  assert.doesNotMatch(service, /planning\/security-boundary/);
  // And planning.ts must not regrow direct workspace-lifecycle writes: the
  // only remaining workspace INSERTs are the bulk/onboarding creators, and no
  // UPDATE or DELETE of the workspaces table may live in the action file.
  assert.doesNotMatch(actions, /\.update\(workspaces\)/);
  assert.doesNotMatch(actions, /\.delete\(workspaces\)/);
});

test("duplication reads re-authorize inside their transaction", () => {
  for (const [source, start, end, label] of [
    [
      actions,
      "export async function getWorkspaceDuplicationReviewAction",
      "export async function duplicateWorkspaceAction",
      "action",
    ],
    [
      actions,
      "export async function duplicatePlanningPeriodAction",
      "export async function savePlanningOnboardingDraftAction",
      "action",
    ],
  ]) {
    const body = sliceOf(source, start, end, label);
    const transaction = body.indexOf("db.transaction");
    const recheck = body.indexOf("requireWorkspaceOwnerInTransaction", transaction);
    assert.ok(transaction >= 0, `${start} must use a transaction`);
    assert.ok(recheck > transaction, `${start} must re-authorize inside its transaction`);
  }
  // The service's duplicate carries the same discipline through the seam: the
  // capability is re-proved on the transaction executor before the copy reads.
  const duplicate = serviceSource(
    "export async function duplicateProject",
    "export async function duplicateProjectIntoPeriodTx",
  );
  const transaction = duplicate.indexOf("db.transaction");
  const recheck = duplicate.indexOf("proveProjectCapability(", transaction);
  const copy = duplicate.indexOf("duplicateProjectIntoPeriodTx(", transaction);
  assert.ok(transaction >= 0, "duplicateProject must use a transaction");
  assert.ok(
    recheck > transaction,
    "duplicateProject must re-prove its capability inside the transaction",
  );
  assert.ok(
    copy > recheck,
    "the copy must happen after the in-transaction re-proof",
  );
});

test("scenario K: teacher onboarding and planning catalog never require pupil data", () => {
  assert.match(onboarding, /does not need pupil names, emails, identifiers, or accounts/i);
  assert.doesNotMatch(migration, /pupil_(name|email|id)/i);
  assert.doesNotMatch(actions, /pupil(Name|Email|Id)/);
});
