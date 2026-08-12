/**
 * Contract test — Today ranking.  FAILING BY DESIGN (Wave 1).
 *
 * Sealed contract: docs/projects/home-operating-layer/contracts/TODAY_RANKING.md
 * Assertion ids T1–T18 match §10 of that document one for one.
 *
 * This is a Wave 1 contract wave: documents and failing tests only. Every test
 * below fails at this base, and each fails for the reason named in its own
 * message — either the engine module does not exist yet, or a source file still
 * contains the exact construct the contract deletes. A test here that starts
 * passing without the corresponding code landing is a defect in the test.
 *
 * Two shapes of assertion, deliberately:
 *
 *   1. SOURCE assertions read repository text. They fail today with a legible
 *      message naming the file and the construct, and they keep failing until
 *      that construct is gone. They need no new module to be useful.
 *   2. ENGINE assertions exercise the ranking API the contract specifies. They
 *      fail today with ERR_MODULE_NOT_FOUND. They are written as real
 *      behavioural tests, not placeholders, so the module has an executable
 *      interface to be built against.
 *
 * On the dynamic specifier below: `await import(ENGINE_SPECIFIER)` uses a
 * variable, not a string literal, so `tsc --noEmit` does not try to resolve a
 * module that does not exist yet. A literal would turn the typecheck red for
 * every other lane sharing this branch, which is a worse failure than a red
 * test — the red test is the deliverable, a red typecheck is collateral.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/today/today-ranking-contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // src/lib/home-layer/today
const REPO = resolve(HERE, "../../../.."); // worktree root

/** Variable, not a literal — see the header note. */
const ENGINE_SPECIFIER = "./engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Engine = any;

async function loadEngine(): Promise<Engine> {
  return (await import(ENGINE_SPECIFIER)) as Engine;
}

function read(rel: string): string {
  const abs = resolve(REPO, rel);
  assert.ok(existsSync(abs), `expected ${rel} to exist at this base`);
  return readFileSync(abs, "utf8");
}

/** A construct the contract deletes. Present today ⇒ the assertion fails. */
function assertAbsent(rel: string, needle: string, why: string): void {
  const body = read(rel);
  assert.ok(
    !body.includes(needle),
    `${rel} still contains ${JSON.stringify(needle)}. ${why}`,
  );
}

// ────────────────────────────────────────────────────────────────────
// T1 · One versioned entry point
// ────────────────────────────────────────────────────────────────────

test("T1 · a single ranking entry point exists, versioned home-today-ranking@1.0.0", async () => {
  const engine = await loadEngine();
  assert.equal(
    engine.HOME_TODAY_RANKING_VERSION,
    "home-today-ranking@1.0.0",
    "TODAY_RANKING.md §4.1 fixes the version string; every ranked response and every evidence record carries it",
  );
  assert.equal(
    typeof engine.rankToday,
    "function",
    "TODAY_RANKING.md §1.1: exactly one entry point. A second buildX is a veto.",
  );
});

// ────────────────────────────────────────────────────────────────────
// T2 · Total order
// ────────────────────────────────────────────────────────────────────

test("T2 · the comparator is a total order — no two distinct SourceRefs compare equal", async () => {
  const engine = await loadEngine();
  const { compareCandidates, makeCandidate } = engine;

  // Same trigger, same severity, same id string — different products.
  // The incumbent tie-breaks on a bare task id (build.ts:306) and returns 0
  // here, at which point rendered order becomes database row order.
  const a = makeCandidate({
    ref: { product: "tasks", kind: "task", id: "shared-id", projectId: "p1" },
    trigger: "stuck-work",
    severity: 50,
  });
  const b = makeCandidate({
    ref: { product: "notes", kind: "note-extract", id: "shared-id", projectId: "p1" },
    trigger: "stuck-work",
    severity: 50,
  });

  assert.notEqual(
    compareCandidates(a, b),
    0,
    "two distinct SourceRefs compared equal; the final tie-break must be sourceKey (TODAY_RANKING.md §4.3, TR-2)",
  );
  assert.equal(
    Math.sign(compareCandidates(a, b)),
    -Math.sign(compareCandidates(b, a)),
    "the comparator must be antisymmetric",
  );
});

// ────────────────────────────────────────────────────────────────────
// T3 · Purity  ·  T4 · Pinned asOf
// ────────────────────────────────────────────────────────────────────

test("T3 · ranking is a pure function of (candidates, asOf, readState, coverage)", async () => {
  const engine = await loadEngine();
  const input = engine.fixtures.mixedDay();
  const first = engine.rankToday(input);
  const second = engine.rankToday(input);
  assert.deepEqual(
    second.sections.todaysSignal.map((r: { id: string }) => r.id),
    first.sections.todaysSignal.map((r: { id: string }) => r.id),
    "identical inputs must produce an identical order (TODAY_RANKING.md §4.3)",
  );
});

test("T4 · asOf is required and no clock is read inside the build", async () => {
  const engine = await loadEngine();
  const input = engine.fixtures.mixedDay();
  assert.throws(
    () => engine.rankToday({ ...input, asOf: undefined }),
    "asOf must be required, not defaulted to Date.now() (build.ts:50 defaults it today; ST2 removes the default)",
  );
  const pinned = engine.rankToday({ ...input, asOf: 1_760_000_000_000 });
  assert.equal(
    pinned.asOf,
    1_760_000_000_000,
    "the pinned instant must travel out with the result so every consumer shares one clock",
  );
});

// ────────────────────────────────────────────────────────────────────
// T5 · Cap and suppressed count  ·  T6 · The accounting identity
// ────────────────────────────────────────────────────────────────────

test("T5 · Today's signal caps at 3 and reports cappedOut", async () => {
  const engine = await loadEngine();
  const result = engine.rankToday(engine.fixtures.sixFlagged());
  assert.equal(
    result.sections.todaysSignal.length,
    3,
    "the cap is 3 across the whole section (build.ts:19)",
  );
  assert.ok(
    result.accounting.cappedOut > 0,
    "work that crossed a rule and lost its slot is held back, not clear — the count must be rendered, not merely computed (TODAY_RANKING.md §6)",
  );
});

test("T6 · read = shown + cappedOut + dismissed + cleared, exactly", async () => {
  const engine = await loadEngine();
  for (const name of ["mixedDay", "sixFlagged", "allDismissed", "quietDay"]) {
    const result = engine.rankToday(engine.fixtures[name]());
    const a = result.accounting;
    if (a === null) continue; // withheld is a legal outcome; a wrong sum is not
    assert.equal(
      a.read,
      a.shown + a.cappedOut + a.dismissed + a.cleared,
      `${name}: the four-term identity must balance. Today cleared = read - flagged (ledger-contract.ts:292-301), which counts a dismissed item as having crossed nothing (build.ts:62-67).`,
    );
  }
});

test("T6b · a dismissed item is never counted as cleared", async () => {
  const engine = await loadEngine();
  const result = engine.rankToday(engine.fixtures.allDismissed());
  assert.ok(
    result.accounting.dismissed > 0,
    "the fixture dismisses every flagged item",
  );
  assert.equal(
    result.accounting.cleared,
    0,
    "silence chosen by the reader is not absence of a problem (TR-3)",
  );
});

// ────────────────────────────────────────────────────────────────────
// T7 · Coming up and Needs review come from the engine  ·  T8 · caps
// ────────────────────────────────────────────────────────────────────

test("T7 · Coming up and Needs review are produced by the engine, not by a filter over raw signals", () => {
  assertAbsent(
    "src/app/app/home/home-data.ts",
    "COMING_UP_WINDOW_DAYS",
    "home-data.ts:137-171 filters and sorts raw signals independently of the engine. CONTENT_OWNERSHIP.md CO-5 deletes that block; the sections survive, the second ranker does not.",
  );
  assertAbsent(
    "src/app/app/home/home-data.ts",
    "REVIEW_CAP",
    "same block — the cap belongs to the engine's section registry, not to the Home view model.",
  );
});

test("T8 · Coming up caps at 4, Needs review at 3, and neither implies completeness", async () => {
  const engine = await loadEngine();
  const limits = engine.SECTION_LIMITS;
  assert.equal(limits.comingUp.cap, 4);
  assert.equal(limits.needsReview.cap, 3);
  for (const id of ["comingUp", "needsReview"]) {
    assert.equal(
      limits[id].impliesCompleteness,
      false,
      `${id} is a capped ranked view, never an inventory (TR-5). Completeness is a declared property, not a matter of copy tone.`,
    );
    assert.equal(
      limits[id].sourceRoute,
      "/app/home/my-work",
      `${id} must carry exactly one route onward to the surface that owns the inventory (CONTENT_OWNERSHIP.md §7 S2/S3)`,
    );
  }
});

// ────────────────────────────────────────────────────────────────────
// T9 · Quiet language prohibitions
// ────────────────────────────────────────────────────────────────────

test("T9 · quiet language is refused whenever any of Q1–Q9 holds", async () => {
  const engine = await loadEngine();

  const clean = engine.rankToday(engine.fixtures.quietDay());
  assert.equal(
    clean.quiet.allowed,
    true,
    "a genuinely clean read, complete coverage, nothing flagged, nothing dismissed, nothing capped — this is the only case that may say all clear",
  );

  const cases: Array<[string, string]> = [
    ["quietDayWithStaleProvider", "Q1"],
    ["quietDayWithNoReadCount", "Q2"],
    ["quietDayWithShippedItem", "Q3"],
    ["quietDayWithCappedItem", "Q4"],
    ["quietDayWithDismissedItem", "Q5"],
    ["quietDayWithUnresolvedProject", "Q6"],
    ["quietDayWithUnsupportedKind", "Q7"],
    ["quietDayWithNoHistory", "Q8"],
    ["quietDayWithNonDeterministicScope", "Q9"],
  ];

  for (const [fixture, condition] of cases) {
    const result = engine.rankToday(engine.fixtures[fixture]());
    assert.equal(
      result.quiet.allowed,
      false,
      `${condition} must prohibit all-clear language (${fixture})`,
    );
    assert.ok(
      result.quiet.blockedBy.includes(condition),
      `${condition} must be named in blockedBy so the surface can state WHY it is not claiming all clear, rather than falling silent`,
    );
  }
});

test("T9b · the current Home all-clear takes no coverage input at all", () => {
  const body = read("src/app/app/home/home-data.ts");
  assert.ok(
    !body.includes("signalRows.length === 0"),
    "home-data.ts:176-192 emits an all-clear whenever the row list is empty, with no coverage, no dismissed count and no capped count in scope. That is Charter rule 11's exact failure and TODAY_RANKING.md §9.2 replaces it.",
  );
});

// ────────────────────────────────────────────────────────────────────
// T10 · Coverage travels with the rows  ·  T11 · unsupported ≠ empty
// ────────────────────────────────────────────────────────────────────

test("T10 · every ranked result carries a ProviderCoverage-shaped coverage statement", async () => {
  const engine = await loadEngine();
  const result = engine.rankToday(engine.fixtures.mixedDay());
  assert.ok(result.coverage, "a result carrying rows and no coverage is invalid (F6)");
  assert.ok(
    ["complete", "partial", "stale", "unavailable"].includes(result.coverage.status),
    "status must come from the existing DataCoverage vocabulary (contracts.ts:247-251), not a second one",
  );
  assert.throws(
    () => engine.rankToday({ ...engine.fixtures.mixedDay(), coverage: undefined }),
    "coverage is a required input, so no caller can render rows without it",
  );
});

test("T11 · an eligible kind with no producer renders unsupported, never an empty section", async () => {
  const engine = await loadEngine();
  const result = engine.rankToday(engine.fixtures.mixedDay());
  assert.equal(
    result.coverage.providers.calendar?.status,
    "unsupported",
    "no calendar producer exists at this base; the gap must be named, not rendered as an empty calendar (TR-7)",
  );
});

test("T11b · the source no longer hardcodes an empty event list", () => {
  assertAbsent(
    "src/modules/signal/lib/data/source.ts",
    "events: []",
    "source.ts:271-273 hardcodes an empty array, which is indistinguishable from 'we cannot see events'. §2 replaces it with an unsupported coverage entry.",
  );
});

// ────────────────────────────────────────────────────────────────────
// T12 · Resolved provenance  ·  T13 · real priority
// ────────────────────────────────────────────────────────────────────

test("T12 · sourceLabel is resolved from the record; the literal \"Workspace\" never renders", () => {
  assertAbsent(
    "src/modules/signal/server/briefing/signal-build-for-user.ts",
    '?? "Workspace"',
    'signal-build-for-user.ts:331 templates provenance and falls back to the literal "Workspace". A Project whose name will not resolve is unavailable, not a placeholder — and PROJECT_SCOPE.md A10 bans the word from every user-facing Home string.',
  );
  assertAbsent(
    "src/modules/signal/server/briefing/signal-build-for-user.ts",
    "sourceLabel: `Tasks · ",
    "provenance must be resolved from the record the moment a second product feeds Home (audit A fixed input 4)",
  );
});

test("T13 · priority is read from the record, not hardcoded", () => {
  assertAbsent(
    "src/modules/signal/server/briefing/signal-build-for-user.ts",
    "priority: 2 as const",
    "signal-build-for-user.ts:320 pins every row to priority 2, which silently disables the P0 bonus in triggers.ts:76, :113 and :144. A ranking that ignores the one priority signal the user set is not one they will trust.",
  );
});

// ────────────────────────────────────────────────────────────────────
// T14 · The two promoted triggers
// ────────────────────────────────────────────────────────────────────

test("T14 · blocker-cleared and doing-empty exist as engine triggers", async () => {
  const engine = await loadEngine();
  const kinds: string[] = engine.TRIGGER_KINDS;
  for (const kind of [
    "due-soon",
    "crowded-week",
    "stuck-work",
    "blocked-too-long",
    "overload",
    "blocker-cleared",
    "doing-empty",
    "just-shipped",
  ]) {
    assert.ok(
      kinds.includes(kind),
      `${kind} must be a trigger of the one engine (TODAY_RANKING.md §4.2). blocker-cleared and doing-empty exist today only inside generate-nudges.ts:207-227 and :243-255.`,
    );
  }
  assert.ok(
    engine.TRIGGER_WEIGHTS["blocker-cleared"] < engine.TRIGGER_WEIGHTS["blocked-too-long"],
    "blocker-cleared is actionable good news and must never outrank something with a date",
  );
  assert.ok(
    engine.TRIGGER_WEIGHTS["doing-empty"] > engine.TRIGGER_WEIGHTS["just-shipped"],
    "doing-empty is a posture nudge; it outranks celebration only",
  );
});

// ────────────────────────────────────────────────────────────────────
// T15 · Exactly one attention ranker
// ────────────────────────────────────────────────────────────────────

test("T15 · exactly one module in src/ sorts work objects by an attention score", () => {
  // Observed today (verified at base 78021c5):
  //   src/modules/signal/lib/briefing/build.ts        the engine — canonical
  //   src/lib/nudges/generate-nudges.ts               a SECOND engine (DUP-4)
  //   src/components/app/my-week/nudges-rail.tsx:66   a THIRD, display-time sort
  //   src/modules/signal/lib/analytics/rules.ts:676   analytics observations
  //
  // rules.ts is carved out on purpose: it ranks analytics observations, a
  // different object class, under its own versioned rule set
  // (SIGNAL_RULE_VERSION, rules.ts:18). Two versioned rule sets in two domains
  // is fine. Four unversioned severity sorts over the same Tasks rows is not.
  const CARVE_OUT = new Set(["src/modules/signal/lib/analytics/rules.ts"]);
  const EXPECTED = ["src/modules/signal/lib/briefing/build.ts"];

  const observed = walkSource()
    .filter((rel) => !CARVE_OUT.has(rel))
    .filter((rel) => {
      const body = readFileSync(resolve(REPO, rel), "utf8");
      return body.includes("severity") && body.includes(".sort(");
    })
    .sort();

  assert.deepEqual(
    observed,
    EXPECTED,
    "CONTENT_OWNERSHIP.md I2: exactly one module may assign an attention rank. The extras each order the same Tasks rows on a different scale, so the same two rows can appear in opposite orders on two Home surfaces on the same day.",
  );
});

// ────────────────────────────────────────────────────────────────────
// T16 · One result object, one order, everywhere
// ────────────────────────────────────────────────────────────────────

test("T16 · Today and the Full briefing render one result object in one order", async () => {
  const engine = await loadEngine();
  const input = engine.fixtures.sixFlagged();
  const today = engine.rankToday(input);
  const briefing = engine.rankToday({ ...input, limit: "all" });

  assert.ok(
    briefing.sections.todaysSignal.length > today.sections.todaysSignal.length,
    "the Full briefing is the same pass with the cap lifted, not a second view model",
  );
  assert.deepEqual(
    briefing.sections.todaysSignal
      .slice(0, today.sections.todaysSignal.length)
      .map((r: { id: string }) => r.id),
    today.sections.todaysSignal.map((r: { id: string }) => r.id),
    "the capped view must be a prefix of the uncapped one — that is what makes Charter rule 9 checkable rather than aspirational",
  );
  assert.equal(briefing.version, today.version);
  assert.equal(briefing.asOf, today.asOf);
});

// ────────────────────────────────────────────────────────────────────
// T17 · No unreachable state is filtered on
// ────────────────────────────────────────────────────────────────────

test("T17 · every Lane value a Home section tests for is reachable from the source adapter", () => {
  // The chain today:
  //   Tasks lane "review"  →  Status "in-flight"   (data/source.ts:112-117)
  //   Status "in-flight"   →  Lane   "in-flight"   (signal-build-for-user.ts:313-318)
  // so signal.lane === "review" (home-data.ts:161) can never be true in
  // production, while mock-source.ts:75 does emit it — which is why every demo
  // capture shows the section populated and every real reader sees it empty.
  assertAbsent(
    "src/modules/signal/lib/data/source.ts",
    'review: "in-flight"',
    "the fixed LANE_TO_STATUS table makes the engine's review lane unreachable. §3 rule 1 derives lane from isTaskDone(task, config) with the real per-Project column config instead.",
  );

  const homeData = read("src/app/app/home/home-data.ts");
  const testsForReview = homeData.includes('lane === "review"');
  const sourceCanEmitReview = read(
    "src/modules/signal/server/briefing/signal-build-for-user.ts",
  ).includes('return "review"');
  assert.equal(
    testsForReview && !sourceCanEmitReview,
    false,
    "a Home section filters on a state the production mapper cannot produce (CONTENT_OWNERSHIP.md DUP-2)",
  );
});

// ────────────────────────────────────────────────────────────────────
// T18 · Ordering stability
// ────────────────────────────────────────────────────────────────────

test("T18 · refresh is explicit: no polling, no visibility, focus or hover reorder", async () => {
  const engine = await loadEngine();
  const policy = engine.STABILITY_POLICY;

  assert.equal(policy.freezeForViewLifetime, true, "ST1");
  assert.equal(policy.reorderTrigger, "explicit-user-refresh", "ST1/ST3");
  assert.equal(policy.pollIntervalMs, null, "ST1 — no polling");
  assert.equal(
    policy.conditionsOnFocusOrHover,
    false,
    "ST4 — a web app cannot detect a screen-reader virtual cursor, so any focus- or hover-conditioned pause silently excludes the readers most harmed by reordering",
  );
  assert.equal(policy.staleResultAnnouncement, "updates-available", "ST3");
  assert.equal(policy.rowIdentity, "sourceKey", "ST6 — focus is restored by identity, never by index");
  assert.equal(
    policy.reducedMotionDropsAnnouncement,
    false,
    "ST7 — reduced motion is a request about movement, not about less information",
  );
});

// ────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────

/** Repo-relative paths of every non-test TypeScript source file under src/. */
function walkSource(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const abs = resolve(dir, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test\.tsx?$/.test(entry)) continue;
      out.push(abs.slice(REPO.length + 1).split("\\").join("/"));
    }
  };
  walk(resolve(REPO, "src"));
  return out;
}
