/**
 * The Home context seam, specified as executable assertions.
 *
 * Contract: docs/projects/home-operating-layer/contracts/HOME_CONTEXT.md
 * Assertions H1 … H17 of that document's §12 table.
 *
 * ── This file is red on purpose ────────────────────────────────────────────
 *
 * Wave 1 is a contract wave: documents and failing tests only. None of the
 * modules under `src/lib/home-layer/context/` exists yet, so every test here
 * fails at its first line with a message naming the module and the contract
 * section that requires it. That is the deliverable. A green run at this base
 * would mean the loader is lying.
 *
 * ── What each test is actually for ─────────────────────────────────────────
 *
 * The assertions are written to be correct against the landed seam, not to be
 * placeholders. Each one states one refusal or one ordering property, and each
 * one names the live defect in this repository that makes the property
 * necessary rather than tidy. When the seam lands, these run unchanged.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/context/authorize-home-context.contract.test.ts
 *
 * Not wired into `pnpm test`: `package.json` is foreign-owned and contended by
 * three open PRs (COLLISION_REGISTER.md:44-46, HOME_CONTEXT.md D-H21).
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import {
  call,
  contextRequest,
  exported,
  fn,
  loadContextModule,
  stubResolvers,
  throws,
} from "./testing/contract-loader";

/** HOME_CONTEXT.md §1.2. The order is the contract, not an implementation detail. */
const SEALED_STEPS = [
  "access-posture",
  "authenticate",
  "resolve-internal-user",
  "resolve-memberships",
  "resolve-capabilities",
  "validate-grouping",
  "intersect",
  "resolve-active-project",
  "seal",
] as const;

/** HOME_CONTEXT.md §3. Seven, not five, and none interchangeable (D-H16). */
const SEALED_AXES = [
  "auth-tenant-boundary",
  "active-project",
  "home-read-scope",
  "planning-period",
  "analytics-time-window",
  "product-local-filters",
  "viewer-capabilities",
] as const;

// ── H1 · one server-only seam ───────────────────────────────────────────────

test("H1 · authorizeHomeContext exists and is the only entrance", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H1 — the one server-only seam every Home read and write enters through",
  );
  assert.equal(typeof exported(mod, "authorizeHomeContext"), "function");
});

// ── H2 · the nine steps, in order ───────────────────────────────────────────

test("H2 · the nine pipeline steps are in the sealed order", async () => {
  const policy = await loadContextModule(
    "policy",
    "H2 — the nine pipeline steps are in the sealed order",
  );
  assert.deepEqual(
    exported(policy, "HOME_AUTHORIZATION_STEPS"),
    [...SEALED_STEPS],
    "the order is the contract: each step consumes only what earlier steps produced",
  );
});

test("H2b · the pipeline asks for facts in that order at runtime", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H2b — the runtime call order matches the sealed order",
  );
  const { calls, resolvers } = stubResolvers();
  await call(mod, "authorizeHomeContext", contextRequest(), resolvers);
  assert.deepEqual(
    calls,
    SEALED_STEPS.slice(0, -1),
    "seal is not a resolver; every other step must have been asked, once, in order",
  );
});

// ── H3 · nothing derives before the receipt is sealed ───────────────────────

test("H3 · no provider may count, aggregate, rank, group, narrate, cache or paginate before seal", async () => {
  const receipt = await loadContextModule(
    "receipt",
    "H3 — the barrier: providers refuse anything that is not a sealed receipt",
  );
  const assertReceipt = fn(receipt, "assertReceipt");

  // A provider handed anything else refuses. It does not fall back to an
  // ambient lookup, and — the failure this exists to prevent — it does not
  // return an empty result. An unauthorized provider returning [] renders
  // "nothing needs your attention" when the truth is "we could not tell".
  for (const notAReceipt of [undefined, null, {}, "u_real", ["ws_a"], 0]) {
    const error = throws(() => assertReceipt(notAReceipt));
    assert.match(error.message, /receipt/i);
  }
});

// ── H4 · unauthenticated refuses, it does not return empty ──────────────────

test("H4 · an unauthenticated request refuses and never returns an empty result", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H4 — no session is a refusal, never an empty success",
  );
  const { resolvers } = stubResolvers({ session: () => null });
  const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);

  assert.equal(result.ok, false);
  assert.equal((result.refusal as Record<string, unknown>).kind, "unavailable");
  assert.equal(
    (result.refusal as Record<string, unknown>).serverReason,
    "unauthenticated",
  );
  assert.equal(result.receipt, undefined, "a refusal carries no receipt");
});

// ── H5 · demo and review are a different universe (D-H19) ───────────────────

test("H5 · a demo or review request yields a synthetic receipt no production path accepts", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H5 — posture travels in the receipt so a provider is never uncertain which universe it reads",
  );
  const receiptMod = await loadContextModule("receipt", "H5");

  for (const posture of ["demo", "review"]) {
    const { resolvers } = stubResolvers({ accessPosture: () => posture });
    const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);
    assert.equal(result.ok, true);

    const receipt = result.receipt as Record<string, unknown>;
    assert.equal(receipt.posture, posture);

    // src/lib/access-mode.ts:23-27 — demo/review never unlock the real DB.
    // The receipt carries that fact rather than each provider re-deriving it.
    const error = throws(() => fn(receiptMod, "assertProductionReceipt")(receipt));
    assert.match(error.message, /posture/i);
  }
});

// ── H6 · a provisional identity may read and may not write (D-H14) ──────────

test("H6 · a provisional identity may read, may not mutate, and may not claim completeness", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H6 — src/server/auth.ts:111-120 returns the raw Clerk id when the webhook has not landed",
  );
  const receiptMod = await loadContextModule("receipt", "H6");

  const { resolvers } = stubResolvers({
    internalUser: () => ({ id: "user_clerk_raw", provisional: true }),
  });
  const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);
  const receipt = result.receipt as Record<string, unknown>;

  assert.equal((receipt.actor as Record<string, unknown>).provisional, true);
  assert.notEqual(
    receipt.coverage,
    "complete",
    "two addressable identities cannot yield a complete answer",
  );

  const error = throws(() => fn(receiptMod, "assertMutationAllowed")(receipt));
  assert.match(error.message, /provisional/i);
});

// ── H7 · coverage is reported, never inferred ───────────────────────────────

test("H7 · an empty Project set and an unavailable Project set are different receipts", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H7 — 'you are a member of no Projects' and 'we could not ask' are different sentences",
  );

  const emptyButKnown = stubResolvers({
    memberships: () => ({ projects: [], unresolvedCount: 0, coverage: "complete" }),
  });
  const unknown = stubResolvers({
    memberships: () => ({ projects: [], unresolvedCount: 0, coverage: "unavailable" }),
  });

  const a = await call(mod, "authorizeHomeContext", contextRequest(), emptyButKnown.resolvers);
  const b = await call(mod, "authorizeHomeContext", contextRequest(), unknown.resolvers);

  assert.equal((a.receipt as Record<string, unknown>).coverage, "complete");
  assert.equal((b.receipt as Record<string, unknown>).coverage, "unavailable");
  assert.notDeepEqual(
    a.receipt,
    b.receipt,
    "charter rule 11: unavailable may never render as empty",
  );
});

test("H7b · a partial intersection discloses its count and is never silently trimmed", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H7b — PROJECT_SCOPE.md §5 rule 4: partial authorization is disclosed, never trimmed",
  );
  const { resolvers } = stubResolvers({
    memberships: () => ({
      projects: [
        { id: "ws_a", name: "Alpha", slug: "alpha", archivedAt: null, planningPeriodId: null, role: "member" },
      ],
      unresolvedCount: 2,
      coverage: "partial",
    }),
  });
  const result = await call(
    mod,
    "authorizeHomeContext",
    contextRequest({ briefingScope: "all-projects" }),
    resolvers,
  );
  const receipt = result.receipt as Record<string, unknown>;

  assert.equal(receipt.coverage, "partial");
  assert.equal(receipt.unresolvedCount, 2);
  assert.deepEqual(receipt.authorizedProjects, ["ws_a"]);
});

// ── H8 · grouping: canonicalise the unparseable, refuse the unauthorized ────

test("H8 · an unparseable grouping canonicalises with a replace-redirect", async () => {
  const policy = await loadContextModule(
    "policy",
    "H8 — D-H15: the URL is corrected so label and content agree again",
  );
  const outcome = fn(policy, "validateRequestedGrouping")("not-a-scope", {
    ownedPlanningPeriodIds: ["pp_1"],
  }) as Record<string, unknown>;

  assert.equal(outcome.kind, "canonicalise");
  assert.deepEqual(outcome.to, { kind: "current-project" });
  assert.equal(outcome.history, "replace");
});

test("H8b · an unauthorized grouping refuses and never downgrades", async () => {
  const policy = await loadContextModule(
    "policy",
    "H8b — D-H15: a downgrade renders narrower truth under a wider label, and confirms the period exists",
  );
  const outcome = fn(policy, "validateRequestedGrouping")(
    "planning-period:pp_not_mine",
    { ownedPlanningPeriodIds: ["pp_1"] },
  ) as Record<string, unknown>;

  assert.equal(outcome.kind, "refused");
  assert.equal(outcome.serverReason, "grouping-unauthorized");
  assert.notDeepEqual(
    outcome.to,
    { kind: "current-project" },
    "this is the src/modules/notes/server/tasks-personalization.ts:192-209 defect, one level up",
  );
});

// ── H9 · Active Project resolves independently ─────────────────────────────

test("H9 · Active Project is not derived from the grouping or the intersection", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H9 — a truthful aggregate alongside a refusing header is correct; a substituted header is not",
  );
  const { resolvers } = stubResolvers({
    activeProject: () => ({ kind: "unavailable" }),
  });
  const result = await call(
    mod,
    "authorizeHomeContext",
    contextRequest({ workspaceId: "ws_not_mine", briefingScope: "all-projects" }),
    resolvers,
  );
  const receipt = result.receipt as Record<string, unknown>;

  assert.deepEqual(receipt.activeProject, { kind: "unavailable" });
  assert.equal(
    (receipt.authorizedProjects as unknown[]).length,
    3,
    "the aggregate still reads; only the pointer refuses",
  );
});

// ── H10 · the legacy fallback never reaches a receipt (D-H03) ───────────────

test("H10 · a Project the actor has proved no membership of is refused, not sealed", async () => {
  const policy = await loadContextModule(
    "policy",
    "H10 — src/server/auth.ts:179 still returns LEGACY_WORKSPACE_ID at this base",
  );
  const rejected = exported(policy, "REJECTED_PROJECT_IDS") as string[];
  assert.ok(
    rejected.includes("ws-legacy"),
    "the literal value of LEGACY_WORKSPACE_ID (src/server/db/seed.ts:20)",
  );

  const mod = await loadContextModule("authorize-home-context", "H10");
  const { resolvers } = stubResolvers({
    memberships: () => ({
      projects: [
        { id: "ws-legacy", name: "Legacy workspace", slug: "legacy", archivedAt: null, planningPeriodId: null, role: "member" },
      ],
      unresolvedCount: 0,
      coverage: "complete",
    }),
  });
  const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);

  assert.equal(result.ok, false, "Home refuses at the seam rather than trusting the upstream fix");
});

// ── H11 · the receipt is branded ────────────────────────────────────────────

test("H11 · a structurally identical object is not a receipt", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H11 — the brand is a unique symbol; a copy is a compile error and a runtime refusal",
  );
  const receiptMod = await loadContextModule("receipt", "H11");

  const { resolvers } = stubResolvers();
  const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);
  const real = result.receipt as Record<string, unknown>;

  assert.equal(fn(receiptMod, "isHomeAuthorizationReceipt")(real), true);

  const forged = { ...real };
  assert.equal(
    fn(receiptMod, "isHomeAuthorizationReceipt")(forged),
    false,
    "a spread copy drops the brand",
  );
  throws(() => fn(receiptMod, "assertReceipt")(forged));
});

// ── H12 · providers refuse the raw facts ────────────────────────────────────

test("H12 · a provider refuses a raw user id, workspace id, role string or browser list", async () => {
  const receiptMod = await loadContextModule(
    "receipt",
    "H12 — HOME_CONTEXT.md §2.3: what a provider must never accept instead of a receipt",
  );
  const assertReceipt = fn(receiptMod, "assertReceipt");

  const rejected: unknown[] = [
    "user_2abc",                                   // a raw Clerk id
    { userId: "u_real" },                          // an identity, not an authorization
    { workspaceId: "ws_a" },                       // a client-supplied Project id
    { role: "owner" },                             // roles are not capabilities here
    { allowedProjects: ["ws_a", "ws_b"] },         // "these are my projects" is a claim
    { tasks_active_ws: "ws_a" },                   // the cookie: five writers, four attribute sets
    { briefingScope: "all-projects" },             // an unvalidated grouping
  ];
  for (const input of rejected) {
    throws(() => assertReceipt(input));
  }

  // The list is documented in code, so a new rejected shape is added in one place.
  const documented = exported(receiptMod, "RECEIPT_REJECTED_INPUTS") as string[];
  for (const key of ["clerk-id", "internal-user-id", "client-workspace-id", "client-role", "browser-allowed-list", "active-workspace-cookie", "raw-briefing-scope"]) {
    assert.ok(documented.includes(key), `${key} must be in RECEIPT_REJECTED_INPUTS`);
  }
});

// ── H13 · out of set throws; it does not filter (D-H17) ─────────────────────

test("H13 · a Project outside the receipt throws; it is never quietly filtered out", async () => {
  const mod = await loadContextModule("authorize-home-context", "H13");
  const receiptMod = await loadContextModule(
    "receipt",
    "H13 — D-H17: filtering converts an authorization bug into an invisible truth bug",
  );

  const { resolvers } = stubResolvers();
  const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);
  const receipt = result.receipt as Record<string, unknown>;

  const assertProjectAuthorized = fn(receiptMod, "assertProjectAuthorized");
  assert.equal(assertProjectAuthorized(receipt, "ws_a"), undefined, "an in-set Project passes");

  const error = throws(() => assertProjectAuthorized(receipt, "ws_someone_else"));
  assert.equal(
    error.name,
    "ProjectNotAuthorizedError",
    "a named error, so a provider cannot swallow it as a generic failure",
  );
});

// ── H14 · the receipt does not serialize and does not cross a request ───────

test("H14 · the receipt cannot be sent to a client and cannot outlive its request", async () => {
  const mod = await loadContextModule("authorize-home-context", "H14");
  const receiptMod = await loadContextModule(
    "receipt",
    "H14 — HOME_CONTEXT.md §2.4 and §4.4",
  );

  const { resolvers } = stubResolvers();
  const result = await call(mod, "authorizeHomeContext", contextRequest(), resolvers);
  const receipt = result.receipt as Record<string, unknown>;

  assert.equal(
    "toJSON" in receipt,
    false,
    "no toJSON: the receipt has no serialized form to leak",
  );

  // The client projection carries labels, counts and states — and never the ids
  // of Projects that did not resolve.
  const view = fn(receiptMod, "toHomeContextView")(receipt) as Record<string, unknown>;
  assert.ok("coverage" in view && "unresolvedCount" in view);
  assert.equal("capabilitiesByProject" in view, false);
  assert.equal("actor" in view, false);

  // A receipt minted in another request is refused even though it is genuine.
  const stale = { ...receipt, requestId: "req_previous" };
  throws(() => fn(receiptMod, "assertReceipt")(stale, { requestId: "req_current" }));
});

// ── H15 · an aggregate never reaches a mutation ─────────────────────────────

test("H15 · no mutation may derive its destination from Read Scope or the authorized set", async () => {
  const mod = await loadContextModule("authorize-home-context", "H15");
  const receiptMod = await loadContextModule(
    "receipt",
    "H15 — HOME_CONTEXT.md §6; every Tasks mutation is cookie-bound and no-ops silently",
  );

  const { resolvers } = stubResolvers();
  const result = await call(
    mod,
    "authorizeHomeContext",
    contextRequest({ briefingScope: "all-projects" }),
    resolvers,
  );
  const receipt = result.receipt as Record<string, unknown>;

  const assertMutationAllowed = fn(receiptMod, "assertMutationAllowed");

  // Without an explicit target, there is no mutation. The aggregate is not one.
  const error = throws(() => assertMutationAllowed(receipt, { derivedFrom: "read-scope" }));
  assert.match(error.message, /explicit|ProjectId/i);

  // With an explicit target inside the authorized set, the seam still does not
  // authorize the write: the object's own stored Project does (PROJECT_SCOPE §9).
  const withTarget = assertMutationAllowed(receipt, {
    projectId: "ws_a",
    reauthorizedAgainstObject: true,
  });
  assert.equal(withTarget, undefined);
  throws(() =>
    assertMutationAllowed(receipt, { projectId: "ws_a", reauthorizedAgainstObject: false }),
  );
});

// ── H16 · an explicit unavailable Project never substitutes ─────────────────

test("H16 · an explicit unauthorized Project resolves to unavailable, never to a substitute", async () => {
  const mod = await loadContextModule(
    "authorize-home-context",
    "H16 — three live substitutions exist today; none may reach Home",
  );
  const { resolvers } = stubResolvers({
    activeProject: () => ({ kind: "unavailable" }),
  });
  const result = await call(
    mod,
    "authorizeHomeContext",
    contextRequest({ workspaceId: "ws_not_mine" }),
    resolvers,
  );
  const receipt = result.receipt as Record<string, unknown>;
  const active = receipt.activeProject as Record<string, unknown>;

  assert.equal(active.kind, "unavailable");
  assert.equal(active.project, undefined, "no substitute is attached");
  assert.notEqual(active.kind, "empty", "an unavailable Project is not an empty Project");
});

// ── H17 · one neutral client state, reason server-side only ────────────────

test("H17 · missing, forbidden, deleted and revoked collapse to one indistinguishable state", async () => {
  const policy = await loadContextModule(
    "policy",
    "H17 — PROJECT_SCOPE.md §8.1: distinguishing them is an existence leak",
  );
  const neutral = fn(policy, "neutralClientState");

  const states = ["project-missing", "project-forbidden", "project-deleted", "revoked"].map(
    (reason) => neutral(reason),
  );

  for (const state of states) {
    assert.deepEqual(state, states[0], "all four render identically");
  }
  const serialized = JSON.stringify(states[0]);
  for (const leak of ["missing", "forbidden", "deleted", "revoked", "reason"]) {
    assert.equal(
      serialized.includes(leak),
      false,
      `the client payload must not contain "${leak}"`,
    );
  }
});

// ── The seven axes ──────────────────────────────────────────────────────────

test("H2c · seven context axes are sealed, and none is dropped to reach five", async () => {
  const policy = await loadContextModule(
    "policy",
    "D-H16 — every pair has a distinct live defect attached to conflating it",
  );
  assert.deepEqual(exported(policy, "HOME_CONTEXT_AXES"), [...SEALED_AXES]);
});
