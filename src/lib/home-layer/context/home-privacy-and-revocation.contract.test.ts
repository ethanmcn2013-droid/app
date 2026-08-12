/**
 * Cache posture, revocation, telemetry and the Notes sentinel invariant.
 *
 * Contracts:
 *   docs/projects/home-operating-layer/contracts/HOME_CONTEXT.md §5
 *   docs/projects/home-operating-layer/contracts/SECURITY_AND_PRIVACY.md §1, §3, §5
 * Assertions H18 … H21 and H25 … H27 of HOME_CONTEXT.md §12.
 *
 * ── Red on purpose ─────────────────────────────────────────────────────────
 *
 * The modules under test do not exist in a contract wave. Every test fails at
 * its first line with a message naming the module and the contract section.
 *
 * ── The one thing here that is not a stub ──────────────────────────────────
 *
 * `FORBIDDEN_FIELDS` is imported from the real, shipped instrumentation schema
 * (`src/lib/account/instrumentation/event-schema.ts:63-91`). Home's reject list
 * must be a **superset** of it, so that assertion is written against live code
 * and will keep working when that list grows. The estate already got this right
 * once; Home does not get to be looser than the part of the estate that did.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/context/home-privacy-and-revocation.contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { FORBIDDEN_FIELDS } from "@/lib/account/instrumentation/event-schema";
import { exported, fn, loadContextModule, throws } from "./testing/contract-loader";

/** HOME_CONTEXT.md §5.3, flattened. A missing field is a leak, not a trade-off. */
const PARTITION_KEY_FIELDS = [
  "actorId",
  "identityProvisional",
  "accessPosture",
  "authorizedProjectSetDigest",
  "archivedIncluded",
  "capabilityDigest",
  "membershipRevision",
  "entitlementRevision",
  "readScopeKind",
  "readScopeValue",
  "activeProjectId",
  "activeProjectStateKind",
  "analyticsWindow",
  "productFilterDigest",
  "doneDefinitionDigest",
  "providerSourceRevisions",
  "metricVersion",
  "schemaVersion",
  "flagSetDigest",
  "locale",
  "timezone",
] as const;

/** SECURITY_AND_PRIVACY.md §3. Six carriers, six mechanisms, one answer. */
const REVOCATION_CARRIERS = [
  "warm-cache",
  "stopped-invalidation-worker",
  "open-page",
  "browser-back",
  "rsc-prefetch",
  "replayed-action-id",
] as const;

function partitionInput(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    actorId: "u_real",
    identityProvisional: false,
    accessPosture: "production",
    authorizedProjectSetDigest: "digest-abc",
    archivedIncluded: false,
    capabilityDigest: "cap-abc",
    membershipRevision: "rev-1",
    entitlementRevision: "ent-1",
    readScopeKind: "all-projects",
    readScopeValue: null,
    activeProjectId: "ws_a",
    activeProjectStateKind: "ready",
    analyticsWindow: "2026-05-20/2026-08-12/week/Europe~Dublin/2026-08-12T09:00:00Z",
    productFilterDigest: "filter-none",
    doneDefinitionDigest: "done-abc",
    providerSourceRevisions: "tasks:7,notes:3,timeline:1",
    metricVersion: "m1",
    schemaVersion: "s1",
    flagSetDigest: "flags-abc",
    locale: "en-IE",
    timezone: "Europe/Dublin",
  };
  return { ...base, ...overrides };
}

// ── H18 · cache posture ─────────────────────────────────────────────────────

test("H18 · the Home cache posture is private, no-store, asserted rather than inherited", async () => {
  const mod = await loadContextModule(
    "cache-partition",
    "H18 — audit B marked the current /app reliance on force-dynamic defaults as an unverified INFERENCE",
  );
  assert.equal(exported(mod, "HOME_CACHE_POSTURE"), "private, no-store");
});

// ── H19 · the partition key that WOULD be required ─────────────────────────

test("H19 · the partition key names every field the contract requires", async () => {
  const mod = await loadContextModule(
    "cache-partition",
    "H19 — D-H20: a key negotiated at proposal time is a key with fields missing",
  );
  assert.deepEqual(
    exported(mod, "HOME_CACHE_PARTITION_KEY_FIELDS"),
    [...PARTITION_KEY_FIELDS],
  );
});

test("H19b · a partition key with any field missing is refused, not defaulted", async () => {
  const mod = await loadContextModule("cache-partition", "H19b");
  const homeCachePartitionKey = fn(mod, "homeCachePartitionKey");

  for (const field of PARTITION_KEY_FIELDS) {
    const input = partitionInput();
    delete input[field];
    const error = throws(() => homeCachePartitionKey(input));
    assert.match(
      error.message,
      new RegExp(field),
      `omitting ${field} must name ${field} in the refusal`,
    );
  }
});

test("H19c · the done-definition digest actually participates in the key", async () => {
  // Any member can redefine Done (src/server/actions/board.ts:282-301), so a key
  // that lists the digest but does not mix it in would serve one Project's
  // definition under another's number.
  const mod = await loadContextModule("cache-partition", "H19c");
  const homeCachePartitionKey = fn(mod, "homeCachePartitionKey");

  const before = homeCachePartitionKey(partitionInput());
  const after = homeCachePartitionKey(partitionInput({ doneDefinitionDigest: "done-xyz" }));
  assert.notEqual(before, after);
});

// ── H20 · revocation across all six carriers ───────────────────────────────

test("H20 · a moved membership revision denies on every carrier", async () => {
  const policy = await loadContextModule(
    "policy",
    "H20 — SECURITY_AND_PRIVACY.md §3: the next request denies, not the next deploy",
  );
  const evaluateRevocation = fn(policy, "evaluateRevocation");

  for (const carrier of REVOCATION_CARRIERS) {
    const outcome = evaluateRevocation({
      carrier,
      membershipRevisionAtMint: "rev-1",
      membershipRevisionNow: "rev-2",
      livenessCheckedThisRequest: true,
      actionIdConsumed: false,
    }) as Record<string, unknown>;

    assert.equal(outcome.allowed, false, `${carrier} must deny after revocation`);
    assert.equal(outcome.serverReason, "revoked");
  }
});

test("H20b · a cache hit is never an authorization, even with an unchanged revision", async () => {
  const policy = await loadContextModule(
    "policy",
    "H20b — HOME_CONTEXT.md §5.3: the key proves the inputs are the same, not that authorization is current",
  );
  const evaluateRevocation = fn(policy, "evaluateRevocation");

  for (const carrier of REVOCATION_CARRIERS) {
    const outcome = evaluateRevocation({
      carrier,
      membershipRevisionAtMint: "rev-1",
      membershipRevisionNow: "rev-1",
      livenessCheckedThisRequest: false,
      actionIdConsumed: false,
    }) as Record<string, unknown>;

    assert.equal(
      outcome.allowed,
      false,
      `${carrier} must deny when no liveness check ran this request`,
    );
  }
});

test("H20c · correctness does not depend on a worker running", async () => {
  // captureWorkspaceSnapshots has zero callers repo-wide and vercel.json declares
  // exactly one cron. Home assumes no invalidation worker exists, because none does.
  const policy = await loadContextModule("policy", "H20c");
  const outcome = fn(policy, "evaluateRevocation")({
    carrier: "stopped-invalidation-worker",
    membershipRevisionAtMint: "rev-1",
    membershipRevisionNow: "rev-2",
    livenessCheckedThisRequest: true,
    invalidationWorkerRan: false,
    actionIdConsumed: false,
  }) as Record<string, unknown>;
  assert.equal(outcome.allowed, false);
});

test("H20d · a replayed action id is refused even when authorization is otherwise current", async () => {
  const policy = await loadContextModule("policy", "H20d");
  const outcome = fn(policy, "evaluateRevocation")({
    carrier: "replayed-action-id",
    membershipRevisionAtMint: "rev-1",
    membershipRevisionNow: "rev-1",
    livenessCheckedThisRequest: true,
    actionIdConsumed: true,
  }) as Record<string, unknown>;
  assert.equal(outcome.allowed, false);
  assert.equal(outcome.serverReason, "replayed");
});

// ── H21 · telemetry ─────────────────────────────────────────────────────────

test("H21 · Home's reject list is a superset of the estate's existing floor", async () => {
  const mod = await loadContextModule(
    "telemetry",
    "H21 — event-schema.ts:63-91 already rejects these; Home may not be looser",
  );
  const homeRejects = new Set(exported(mod, "HOME_TELEMETRY_REJECTED_FIELDS") as string[]);

  for (const field of FORBIDDEN_FIELDS) {
    assert.ok(homeRejects.has(field), `${field} must remain rejected in Home telemetry`);
  }
  for (const added of ["extractbody", "sourcenoteextractbody", "notebody", "query", "receipt", "serverreason", "prompt", "completion"]) {
    assert.ok(homeRejects.has(added), `${added} is a Home-specific rejection`);
  }
});

test("H21b · only allowlisted events with allowlisted properties are emitted", async () => {
  const mod = await loadContextModule("telemetry", "H21b");
  const validate = fn(mod, "validateHomeTelemetryEvent");

  const good = validate({
    event: "home_mode_viewed",
    properties: { mode: "today", scopeKind: "all-projects", coverage: "partial", posture: "production" },
  }) as Record<string, unknown>;
  assert.equal(good.ok, true);

  const unknownEvent = validate({ event: "home_something_new", properties: {} }) as Record<string, unknown>;
  assert.equal(unknownEvent.ok, false);

  const extraProp = validate({
    event: "home_mode_viewed",
    properties: { mode: "today", projectName: "Alpha" },
  }) as Record<string, unknown>;
  assert.equal(extraProp.ok, false);
});

test("H21c · a forbidden field is rejected at any depth, and the event is dropped whole", async () => {
  const mod = await loadContextModule(
    "telemetry",
    "H21c — event-schema.ts:58-62: a silent strip leaks the first time someone forgets the list exists",
  );
  const result = fn(mod, "validateHomeTelemetryEvent")({
    event: "home_coverage_disclosed",
    properties: { mode: "today", detail: { nested: { body: "anything at all" } } },
  }) as Record<string, unknown>;

  assert.equal(result.ok, false);
  assert.match(String(result.reason), /body/);
  assert.equal(result.event, undefined, "rejected, not stripped-and-forwarded");
});

test("H21d · a sentinel in a value fails the event even under an innocent key", async () => {
  const mod = await loadContextModule(
    "telemetry",
    "H21d — the key list cannot catch a body that arrives under an allowed name",
  );
  const result = fn(mod, "validateHomeTelemetryEvent")({
    event: "home_mode_viewed",
    properties: { mode: "SS-NOTE-BODY-0123456789abcdef0123456789abcdef" },
  }) as Record<string, unknown>;
  assert.equal(result.ok, false);
});

test("H21e · counts are bucketed, never exact (D-H25)", async () => {
  const mod = await loadContextModule("telemetry", "H21e");
  const validate = fn(mod, "validateHomeTelemetryEvent");

  const bucketed = validate({
    event: "home_ranking_served",
    properties: { mode: "today", itemCountBucket: "6-20", rankingVersion: "r1", deterministic: true },
  }) as Record<string, unknown>;
  assert.equal(bucketed.ok, true);

  const exact = validate({
    event: "home_ranking_served",
    properties: { mode: "today", itemCount: 7, rankingVersion: "r1", deterministic: true },
  }) as Record<string, unknown>;
  assert.equal(exact.ok, false, "an exact count in a rare configuration is a fingerprint");
});

test("H21f · a refusal event carries a class, never the server reason code", async () => {
  const mod = await loadContextModule("telemetry", "H21f");
  const validate = fn(mod, "validateHomeTelemetryEvent");

  assert.equal(
    (validate({
      event: "home_refusal_shown",
      properties: { mode: "today", refusalClass: "unavailable", coverage: "unavailable" },
    }) as Record<string, unknown>).ok,
    true,
  );

  for (const leaked of ["project-forbidden", "project-deleted", "project-missing", "revoked"]) {
    const result = validate({
      event: "home_refusal_shown",
      properties: { mode: "today", refusalClass: leaked, coverage: "unavailable" },
    }) as Record<string, unknown>;
    assert.equal(result.ok, false, `${leaked} is a server reason code, not a class`);
  }
});

// ── H25 … H27 · the Notes sentinel invariant ───────────────────────────────

test("H25 · two sentinels, matched on their prefix so truncation cannot hide a leak", async () => {
  const mod = await loadContextModule(
    "sentinel",
    "H25 — SECURITY_AND_PRIVACY.md §1.2",
  );
  assert.equal(exported(mod, "NOTE_BODY_SENTINEL_PREFIX"), "SS-NOTE-BODY-");
  assert.equal(exported(mod, "NOTE_EXTRACT_SENTINEL_PREFIX"), "SS-NOTE-EXTRACT-");

  const scan = fn(mod, "scanArtifactForSentinels");

  // A summariser that clipped the body to forty characters still trips it.
  const truncated = "Ranked because: SS-NOTE-BODY-0123456789ab";
  const hit = scan({
    artifact: "home-rsc-payload",
    text: truncated,
    populationBodySentinels: 12,
  }) as Record<string, unknown>;
  assert.equal(hit.clean, false);
  assert.equal(hit.kind, "note-body");
});

test("H26 · an empty population fails; it never reports clean (D-H28)", async () => {
  const mod = await loadContextModule(
    "sentinel",
    "H26 — a privacy check that passed because it looked at nothing is recorded as evidence",
  );
  const error = throws(() =>
    fn(mod, "scanArtifactForSentinels")({
      artifact: "home-rsc-payload",
      text: "nothing private here",
      populationBodySentinels: 0,
    }),
  );
  assert.match(error.message, /population|refus/i);
});

test("H27 · the extract sentinel is permitted only on a labelled approved-extract surface", async () => {
  const mod = await loadContextModule(
    "sentinel",
    "H27 — Home surfaces exactly one Note-derived text, and it is labelled (PROJECT_SCOPE.md §2.4)",
  );
  const scan = fn(mod, "scanArtifactForSentinels");
  const text = "Approved wording: “SS-NOTE-EXTRACT-0123456789abcdef0123456789abcdef”";

  const permitted = scan({
    artifact: "home-rsc-payload",
    text,
    populationBodySentinels: 12,
    approvedExtractLabelled: true,
  }) as Record<string, unknown>;
  assert.equal(permitted.clean, true);

  for (const artifact of ["telemetry-payload", "server-log", "ai-prompt", "ai-completion", "og-image-alt", "digest-email", "analytics-snapshot"]) {
    const result = scan({
      artifact,
      text,
      populationBodySentinels: 12,
      approvedExtractLabelled: true,
    }) as Record<string, unknown>;
    assert.equal(result.clean, false, `${artifact} may not carry an extract`);
  }
});
