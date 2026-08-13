/**
 * Plan §6.3's classification table, row by row, plus the ways it must refuse.
 *
 * Every `needs_review` case here is a case where a wrong guess would bind a
 * couple's Timeline to somebody else's Project permanently.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClaimantIndex,
  classifyTimelineWorkspace,
  IncompleteTasksExportError,
  NEEDS_REVIEW_REASONS,
  summarizeClassifications,
} from "./timeline-binding-classification.mjs";

const OWNER = "user_couple";

function tasksProjects(entries) {
  return new Map(
    entries.map(([id, overrides]) => [
      id,
      { exists: true, archivedAt: null, ownerClerkSubject: OWNER, ...overrides },
    ]),
  );
}

function contextFor(workspaces, options = {}) {
  return {
    tasksExportComplete: true,
    tasksProjects: options.tasksProjects ?? tasksProjects([["ws_a", {}], ["ws_b", {}], ["ws_c", {}]]),
    claimantsByTasksId: options.claimantsByTasksId ?? buildClaimantIndex(workspaces),
    existingBindings: options.existingBindings ?? new Map(),
  };
}

const workspace = (overrides) => ({
  slug: "glenmara-house",
  suiteWorkspaceId: null,
  ownerUserId: OWNER,
  children: [],
  ...overrides,
});

test("parent=A and exactly one child=A auto-binds as legacy_exact", () => {
  const ws = workspace({
    suiteWorkspaceId: "ws_a",
    children: [{ slug: "plan", sourceTasksWorkspaceId: "ws_a" }],
  });
  const result = classifyTimelineWorkspace(ws, contextFor([ws]));
  assert.equal(result.kind, "auto_bind");
  assert.equal(result.rule, "parent-and-one-matching-child");
  assert.equal(result.tasksWorkspaceId, "ws_a");
  assert.equal(result.primaryTimelineSlug, "plan");
  assert.equal(result.provenance, "legacy_exact");
  assert.deepEqual(result.mirrors, { parent: false, child: false });
});

test("parent=A with one unbound child auto-binds and mirrors the child", () => {
  const ws = workspace({
    suiteWorkspaceId: "ws_a",
    children: [{ slug: "plan", sourceTasksWorkspaceId: null }],
  });
  const result = classifyTimelineWorkspace(ws, contextFor([ws]));
  assert.equal(result.kind, "auto_bind");
  assert.equal(result.rule, "parent-and-one-unbound-child");
  assert.deepEqual(result.mirrors, { parent: false, child: true });
});

test("parent=A with one unbound child refuses when anything else claims A", () => {
  const ws = workspace({
    suiteWorkspaceId: "ws_a",
    children: [{ slug: "plan", sourceTasksWorkspaceId: null }],
  });
  const rival = workspace({
    slug: "rival",
    children: [{ slug: "plan", sourceTasksWorkspaceId: "ws_a" }],
  });
  const result = classifyTimelineWorkspace(ws, contextFor([ws, rival]));
  assert.equal(result.kind, "needs_review");
  assert.equal(result.reason, NEEDS_REVIEW_REASONS.MULTIPLE_TIMELINE_CANDIDATES);
});

test("an unbound parent with one owned child auto-binds only on a proved owner", () => {
  const ws = workspace({
    suiteWorkspaceId: null,
    children: [{ slug: "plan", sourceTasksWorkspaceId: "ws_a" }],
  });
  const proved = classifyTimelineWorkspace(ws, contextFor([ws]));
  assert.equal(proved.kind, "auto_bind");
  assert.equal(proved.rule, "unbound-parent-one-owned-child");
  assert.deepEqual(proved.mirrors, { parent: true, child: false });

  // Somebody else owns the Tasks Project: the local Timeline owner is
  // provenance, never authority (plan §6.6).
  const someoneElse = classifyTimelineWorkspace(ws, contextFor([ws], {
    tasksProjects: tasksProjects([["ws_a", { ownerClerkSubject: "user_other" }]]),
  }));
  assert.equal(someoneElse.kind, "needs_review");
  assert.equal(someoneElse.reason, NEEDS_REVIEW_REASONS.OWNER_IDENTITY_UNPROVED);

  // A Tasks owner row with no Clerk subject is missing identity, not
  // permission (DECISIONS D-019).
  const noSubject = classifyTimelineWorkspace(ws, contextFor([ws], {
    tasksProjects: tasksProjects([["ws_a", { ownerClerkSubject: null }]]),
  }));
  assert.equal(noSubject.reason, NEEDS_REVIEW_REASONS.OWNER_IDENTITY_UNPROVED);
});

test("parent=A and child=B is needs_review with no write", () => {
  const ws = workspace({
    suiteWorkspaceId: "ws_a",
    children: [{ slug: "plan", sourceTasksWorkspaceId: "ws_b" }],
  });
  const result = classifyTimelineWorkspace(ws, contextFor([ws]));
  assert.equal(result.kind, "needs_review");
  assert.equal(result.reason, NEEDS_REVIEW_REASONS.PARENT_CHILD_CONFLICT);
});

test("mixed and duplicated child sources are preserved, never merged", () => {
  const mixed = workspace({
    children: [
      { slug: "plan", sourceTasksWorkspaceId: "ws_a" },
      { slug: "second", sourceTasksWorkspaceId: "ws_b" },
    ],
  });
  assert.equal(
    classifyTimelineWorkspace(mixed, contextFor([mixed])).reason,
    NEEDS_REVIEW_REASONS.MIXED_CHILD_SOURCES,
  );

  const duplicated = workspace({
    suiteWorkspaceId: "ws_a",
    children: [
      { slug: "plan", sourceTasksWorkspaceId: "ws_a" },
      { slug: "second", sourceTasksWorkspaceId: "ws_a" },
    ],
  });
  assert.equal(
    classifyTimelineWorkspace(duplicated, contextFor([duplicated])).reason,
    NEEDS_REVIEW_REASONS.DUPLICATE_CHILD_SOURCES,
  );
});

test("several unbound children under a bound parent will not have a primary guessed", () => {
  // The venue fixture's shape: multiple couples' manual Timelines under one
  // workspace. "The first one" is exactly the inference this wave removes.
  const ws = workspace({
    suiteWorkspaceId: "ws_a",
    children: [
      { slug: "plan", sourceTasksWorkspaceId: null },
      { slug: "second-couple", sourceTasksWorkspaceId: null },
    ],
  });
  const result = classifyTimelineWorkspace(ws, contextFor([ws]));
  assert.equal(result.kind, "needs_review");
  assert.equal(result.reason, NEEDS_REVIEW_REASONS.AMBIGUOUS_PRIMARY);
});

test("fully unlinked is never inferred from names, order or dates", () => {
  const ws = workspace({ children: [{ slug: "plan", sourceTasksWorkspaceId: null }] });
  const result = classifyTimelineWorkspace(ws, contextFor([ws]));
  assert.equal(result.kind, "unlinked");
});

test("a missing Tasks Project is orphaned, and only with a complete export", () => {
  const ws = workspace({
    suiteWorkspaceId: "ws_gone",
    children: [{ slug: "plan", sourceTasksWorkspaceId: "ws_gone" }],
  });
  const result = classifyTimelineWorkspace(ws, contextFor([ws], {
    tasksProjects: new Map(),
  }));
  assert.equal(result.kind, "orphaned");
  assert.equal(result.tasksWorkspaceId, "ws_gone");
  assert.equal(result.primaryTimelineSlug, "plan");

  assert.throws(
    () => classifyTimelineWorkspace(ws, { ...contextFor([ws]), tasksExportComplete: false }),
    IncompleteTasksExportError,
  );
});

test("an existing binding elsewhere is never overwritten", () => {
  const ws = workspace({
    suiteWorkspaceId: "ws_a",
    children: [{ slug: "plan", sourceTasksWorkspaceId: "ws_a" }],
  });
  const claimed = classifyTimelineWorkspace(ws, contextFor([ws], {
    existingBindings: new Map([["ws_a", { timelineWorkspaceSlug: "somebody-else", state: "active" }]]),
  }));
  assert.equal(claimed.reason, NEEDS_REVIEW_REASONS.CLAIMED_ELSEWHERE);

  const mine = classifyTimelineWorkspace(ws, contextFor([ws], {
    existingBindings: new Map([["ws_a", { timelineWorkspaceSlug: "glenmara-house", state: "active" }]]),
  }));
  assert.equal(mine.kind, "already_bound");
});

test("a bound parent with no child at all cannot invent one", () => {
  const ws = workspace({ suiteWorkspaceId: "ws_a", children: [] });
  assert.equal(
    classifyTimelineWorkspace(ws, contextFor([ws])).reason,
    NEEDS_REVIEW_REASONS.NO_CHILD_TIMELINE,
  );
});

test("the summary counts every outcome without naming anything", () => {
  const summary = summarizeClassifications([
    { kind: "auto_bind", rule: "parent-and-one-matching-child" },
    { kind: "auto_bind", rule: "parent-and-one-matching-child" },
    { kind: "auto_bind", rule: "unbound-parent-one-owned-child" },
    { kind: "already_bound" },
    { kind: "orphaned" },
    { kind: "unlinked" },
    { kind: "needs_review", reason: NEEDS_REVIEW_REASONS.PARENT_CHILD_CONFLICT },
    { kind: "needs_review", reason: NEEDS_REVIEW_REASONS.PARENT_CHILD_CONFLICT },
  ]);
  assert.deepEqual(summary, {
    total: 8,
    autoBind: 3,
    alreadyBound: 1,
    orphaned: 1,
    unlinked: 1,
    needsReview: 2,
    needsReviewByReason: { "parent-child-conflict": 2 },
    autoBindByRule: {
      "parent-and-one-matching-child": 2,
      "unbound-parent-one-owned-child": 1,
    },
  });
  assert.ok(
    !JSON.stringify(summary).includes("glenmara"),
    "a summary is counts; names belong in the access-controlled manifest",
  );
});
