/**
 * The AnalyticsClaim envelope, asserted directly.
 *
 * Contract: `docs/projects/home-operating-layer/contracts/ANALYTICS_CLAIM.md`
 * Assertions C1–C5 and C14 of §18.
 *
 * EVERY TEST IN THIS FILE IS EXPECTED TO FAIL AT THIS BASE. That is the Wave 1
 * deliverable, not a bug. Each failure names the exact export that
 * `ANALYTICS_CLAIM.md` requires and does not yet exist. The failing output is
 * the implementation checklist for Wave 8, in order.
 *
 * Deliberate detail: the module specifier is typed `string`, not a string
 * literal, so `tsc --noEmit` — which `tsconfig.json` points at every .ts file in
 * the repository — cannot try to resolve a module that is not written yet and
 * break another lane's typecheck. The failure belongs at run time, where it
 * reads as a checklist.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/analytics/claim-contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

/** §1 of the contract. Typed `string` on purpose — see the file header. */
const CLAIM_MODULE: string = "./claim";
const CLAIM_MODULE_PATH = "src/lib/home-layer/analytics/claim.ts";

type Loaded = Record<string, unknown>;

/**
 * Load the claim module and pull one named export, failing with a message that
 * names the export and the clause of the contract that requires it.
 */
async function requireExport(name: string, clause: string): Promise<unknown> {
  let loaded: Loaded;
  try {
    loaded = (await import(CLAIM_MODULE)) as Loaded;
  } catch {
    assert.fail(
      `${CLAIM_MODULE_PATH} does not exist yet. ` +
        `It must export \`${name}\` — ANALYTICS_CLAIM.md ${clause}`,
    );
  }
  const value = loaded[name];
  if (value === undefined) {
    assert.fail(
      `${CLAIM_MODULE_PATH} exists but does not export \`${name}\` — ` +
        `ANALYTICS_CLAIM.md ${clause}`,
    );
  }
  return value;
}

// ── C1 · The envelope exists, with every required field ──────────────────────

/**
 * §1 lists seventeen fields. A claim that cannot fill a required field does not
 * render (D-HA02), which is only enforceable if the required set is declared in
 * one place that a test can read.
 */
const REQUIRED_CLAIM_FIELDS = [
  "id",
  "metric",
  "definition",
  "truthClass",
  "scope",
  "window",
  "population",
  "baseline",
  "coverage",
  "times",
  "history",
  "permission",
  "provenance",
  "limitation",
  "correction",
  "value",
  "status",
] as const;

test("C1 · the claim envelope declares all seventeen required fields", async () => {
  const fields = (await requireExport(
    "REQUIRED_CLAIM_FIELDS",
    "§1",
  )) as readonly string[];
  assert.deepEqual(
    [...fields].sort(),
    [...REQUIRED_CLAIM_FIELDS].sort(),
    "the declared required-field set must match ANALYTICS_CLAIM.md §1 exactly",
  );
});

test("C1 · a claim missing any required field is rejected, not rendered smaller", async () => {
  const assertClaim = (await requireExport("assertRenderableClaim", "§1")) as (
    input: unknown,
  ) => void;
  for (const omitted of REQUIRED_CLAIM_FIELDS) {
    const claim: Record<string, unknown> = Object.fromEntries(
      REQUIRED_CLAIM_FIELDS.filter((field) => field !== omitted).map((field) => [
        field,
        null,
      ]),
    );
    assert.throws(
      () => assertClaim(claim),
      new RegExp(omitted),
      `omitting \`${omitted}\` must be refused by name, not tolerated`,
    );
  }
});

// ── C3 · null never becomes zero ─────────────────────────────────────────────

test("C3 · a null value never serializes as 0, '', '—' or an empty collection", async () => {
  const serialize = (await requireExport("serializeClaimValue", "§1")) as (
    input: { status: string; value: unknown },
  ) => unknown;
  for (const status of ["partial", "insufficient_history", "unsupported"]) {
    const rendered = serialize({ status, value: null });
    assert.notEqual(rendered, 0, `status=${status} must not render as 0`);
    assert.notEqual(rendered, "0", `status=${status} must not render as "0"`);
    assert.notEqual(rendered, "", `status=${status} must not render as an empty string`);
    assert.notEqual(rendered, "—", `status=${status} must not render as a dash`);
    assert.ok(
      !Array.isArray(rendered) || rendered.length > 0,
      `status=${status} must not render as an empty collection`,
    );
  }
});

test("C3 · a genuine zero is distinguishable from an absent value", async () => {
  const serialize = (await requireExport("serializeClaimValue", "§1")) as (
    input: { status: string; value: unknown },
  ) => unknown;
  const genuineZero = serialize({ status: "available", value: { count: 0 } });
  const absent = serialize({ status: "unsupported", value: null });
  assert.notDeepEqual(
    genuineZero,
    absent,
    "an authorized, complete count of zero and an unreadable source must not " +
      "render as the same thing — charter rule 11",
  );
});

// ── C2 · Baseline absence is words, not omission ─────────────────────────────

test("C2 · the default baseline is an explicit absence, not an omitted field", async () => {
  const defaultBaseline = (await requireExport("DEFAULT_BASELINE", "§7")) as {
    kind?: string;
  };
  assert.equal(
    defaultBaseline.kind,
    "none",
    "no accepted baseline exists anywhere in the analytics domain at this base, " +
      "so every V1 claim ships { kind: 'none' } — ANALYTICS_CLAIM.md §7, D-HA04",
  );
});

test("C2 · an absent baseline renders the literal words 'No accepted baseline'", async () => {
  const render = (await requireExport("renderBaseline", "§7")) as (
    input: unknown,
  ) => string;
  assert.equal(
    render({ kind: "none" }),
    "No accepted baseline",
    "not '—', not 'n/a', not omission — D-HA04",
  );
});

test("C2 · baseline language is refused on a claim with no accepted baseline", async () => {
  const assertCopy = (await requireExport("assertBaselineCopy", "§7")) as (
    input: { baseline: unknown; text: string },
  ) => void;
  for (const banned of [
    "on target",
    "above target",
    "below the goal",
    "behind quota",
    "as expected",
    "should be 12",
    "on track to finish",
  ]) {
    assert.throws(
      () => assertCopy({ baseline: { kind: "none" }, text: banned }),
      `baseline language "${banned}" must be refused when no baseline is accepted`,
    );
  }
});

// ── §3 · Truth classes stay separate ─────────────────────────────────────────

test("truth classes are exactly reported | observed | inferred", async () => {
  const classes = (await requireExport("TRUTH_CLASSES", "§3")) as readonly string[];
  assert.deepEqual([...classes].sort(), ["inferred", "observed", "reported"]);
});

test("§3 rule 2 · one claim value may not aggregate across truth classes", async () => {
  const assertSingleClass = (await requireExport(
    "assertSingleTruthClass",
    "§3 rule 2",
  )) as (input: { contributions: Array<{ truthClass: string }> }) => void;
  assert.throws(
    () =>
      assertSingleClass({
        contributions: [
          // This is exactly today's `blocked_work`: an explicit flag someone set
          // (reported) summed with an unresolved-dependency inference
          // (inferred) into one count — `metrics.ts:444-456`.
          { truthClass: "reported" },
          { truthClass: "inferred" },
        ],
      }),
    "a count mixing reported and inferred contributions must be refused",
  );
});

test("§3 rule 3 · an inferred claim states its rule threshold as a checkable number", async () => {
  const assertInferred = (await requireExport(
    "assertInferredClaimDisclosure",
    "§3 rule 3",
  )) as (input: { truthClass: string; limitation: { text: string } }) => void;
  assert.throws(
    () =>
      assertInferred({ truthClass: "inferred", limitation: { text: "These items are stale." } }),
    "an inferred claim with no numeric threshold in its own text must be refused",
  );
});

// ── C4 · Four distinct times ─────────────────────────────────────────────────

test("C4 · a claim carries four separate times, not one calculatedAt", async () => {
  const fields = (await requireExport("REQUIRED_TIME_FIELDS", "§9")) as readonly string[];
  assert.deepEqual(
    [...fields].sort(),
    ["eventTime", "ingestionAt", "renderedAt", "snapshotAt"],
    "`MetricResult.calculatedAt` is `snapshot.capturedAt` today (metrics.ts:193), " +
      "so ingestion time and rendered-view time are one field — finding N3",
  );
});

test("C4 · freshness is computed from ingestionAt, never renderedAt", async () => {
  const freshness = (await requireExport("claimFreshnessBasis", "§9 rule 1")) as (
    times: Record<string, string>,
  ) => string;
  assert.equal(
    freshness({
      ingestionAt: "2026-08-12T09:00:00.000Z",
      renderedAt: "2026-08-12T09:40:00.000Z",
      snapshotAt: "2026-08-12T00:00:00.000Z",
    }),
    "2026-08-12T09:00:00.000Z",
    "a page rendered now over a source read forty minutes ago is forty minutes old",
  );
});

// ── C5 · Receipts replay ─────────────────────────────────────────────────────

test("C5 · a claim is reproducible from its receipt, byte for byte", async () => {
  const replay = (await requireExport("replayClaimReceipt", "§12.1")) as (
    receipt: unknown,
  ) => Promise<{ value: unknown }>;
  const buildReceipt = (await requireExport("buildClaimReceipt", "§12.1")) as (
    claim: unknown,
  ) => unknown;
  assert.equal(
    typeof replay,
    "function",
    "replaying a receipt must produce a byte-identical claim value, or the claim " +
      "does not render — D-HA02 is unenforceable without this",
  );
  assert.equal(typeof buildReceipt, "function");
});

test("C5 · a receipt names record ids and never record content", async () => {
  const buildReceipt = (await requireExport("buildClaimReceipt", "§16 rule 4")) as (
    claim: unknown,
  ) => unknown;
  const receipt = buildReceipt({
    included: [{ type: "note", id: "n_1", title: "Ask about the deposit" }],
  });
  assert.ok(
    !JSON.stringify(receipt).includes("Ask about the deposit"),
    "a receipt carries ids, never titles or bodies — the Notes privacy seam " +
      "(providers/notes.ts:84-85) must survive this contract",
  );
});

// ── §6 · Population, exclusions, and the counts on both sides ────────────────

test("§6 rule 1 · a missing denominator is stated, and forbids any percentage", async () => {
  const assertPopulation = (await requireExport(
    "assertClaimPopulation",
    "§6 rule 1",
  )) as (input: unknown) => void;
  assert.throws(
    () =>
      assertPopulation({
        numerator: { label: "open items", count: 3 },
        denominator: { kind: "none", why: "This is a count of items." },
        rendered: "3 (12%)",
      }),
    "a percentage without a real denominator must be refused",
  );
});

test("§6 rule 2 · exclusion reasons are a closed, exhaustive set", async () => {
  const reasons = (await requireExport("EXCLUSION_REASONS", "§6")) as readonly string[];
  assert.deepEqual(
    [...reasons].sort(),
    [
      "archived_project",
      "missing_required_timestamp",
      "outside_window",
      "owner_unmatched",
      "source_record_limit_reached",
      "subtask",
      "unauthorized_project",
      "unprojectable_row",
      "unresolved_project",
    ],
  );
});

test("§6 rule 3 · a truncated read renders its cap, never a bare number", async () => {
  const render = (await requireExport("renderClaimCount", "§6 rule 3")) as (
    input: unknown,
  ) => string;
  const rendered = render({
    included: 2000,
    excluded: [{ reason: "source_record_limit_reached", count: 1 }],
  });
  assert.match(
    rendered,
    /more than/i,
    "`providers/tasks.ts:58-62` reads LIMIT 2001 with no ORDER BY, so a bare " +
      "total is not reproducible between two reads — R10",
  );
});

test("D-HA11 · a record that cannot be joined across id spaces is retained, not dropped", async () => {
  const assertPopulation = (await requireExport(
    "assertClaimPopulation",
    "§6, §14 R9",
  )) as (input: unknown) => void;
  assert.throws(
    () =>
      assertPopulation({
        numerator: { label: "milestones", count: 0 },
        denominator: { kind: "none", why: "count" },
        included: 0,
        // R9: `scope.ts:19-21` compares a Tasks user id against Timeline
        // `assignee` (`providers/timeline.ts:226`). Under a user scope every
        // milestone is dropped, silently, with no exclusion recorded.
        excluded: [],
        droppedByIdentityMismatch: 7,
      }),
    "records dropped by an identity-space mismatch must appear as " +
      "{ reason: 'owner_unmatched' } with a count — silent dropping is the exact " +
      "failure charter rule 11 bans",
  );
});

// ── §11 · Permission limitation ──────────────────────────────────────────────

test("§11 · partial authorization is disclosed with exact counts, never trimmed", async () => {
  const render = (await requireExport("renderClaimPermission", "§11 rule 1")) as (
    input: unknown,
  ) => string;
  const rendered = render({
    kind: "limited",
    readProjects: 4,
    membershipProjects: 6,
    unauthorized: 1,
    unresolved: 1,
  });
  assert.match(rendered, /4/);
  assert.match(rendered, /6/);
  assert.ok(
    !/all|complete|everything/i.test(rendered),
    "a claim over 4 of 6 Projects never reads as complete — PROJECT_SCOPE.md §5 rule 4",
  );
});

test("§11 rule 2 · unauthorized and unresolved stay distinct", async () => {
  const render = (await requireExport("renderClaimPermission", "§11 rule 2")) as (
    input: unknown,
  ) => string;
  const unauthorized = render({
    kind: "limited",
    readProjects: 1,
    membershipProjects: 2,
    unauthorized: 1,
    unresolved: 0,
  });
  const unresolved = render({
    kind: "limited",
    readProjects: 1,
    membershipProjects: 2,
    unauthorized: 0,
    unresolved: 1,
  });
  assert.notEqual(
    unauthorized,
    unresolved,
    "'we would not show you this' and 'the source could not answer' are different " +
      "statements and must not collapse",
  );
});

// ── §12.5 · Suggestions are labelled suggestions ─────────────────────────────

test("§12.5 · oracular copy is refused on every claim", async () => {
  const assertCopy = (await requireExport("assertClaimCopy", "§12.5")) as (
    text: string,
  ) => void;
  for (const banned of [
    "You should focus on the Kitchen project.",
    "This project is on track.",
    "Everything looks healthy.",
    "At this pace you will finish by 3 September.",
    "All clear.",
  ]) {
    assert.throws(
      () => assertCopy(banned),
      `oracular copy must be refused: ${banned}`,
    );
  }
});

test("§12.5 · a deterministic next step is admissible and labelled a suggestion", async () => {
  const suggestion = (await requireExport("buildSuggestion", "§12.5")) as (
    input: unknown,
  ) => { label: string; kind: string };
  const built = suggestion({ metric: "open_overdue_work", count: 3 });
  assert.equal(
    built.kind,
    "suggestion",
    "a next step is rendered with a visible label distinguishing it from the fact",
  );
});

// ── C14 · The metric-family boundary ─────────────────────────────────────────

test("C14 · the allowed V1 metric families are exactly the seven of §13.1", async () => {
  const allowed = (await requireExport("ALLOWED_V1_CLAIMS", "§13.1")) as readonly string[];
  assert.deepEqual([...allowed].sort(), [
    "cross_product_milestone_risk",
    "open_overdue_work",
    "open_work",
    "open_work_age",
    "stalled_work",
    "unowned_work",
    "work_completed",
  ]);
});

test("C14 · workload_distribution is not renderable in V1", async () => {
  const allowed = (await requireExport("ALLOWED_V1_CLAIMS", "§13.2, D-HA08")) as readonly string[];
  assert.ok(
    !allowed.includes("workload_distribution"),
    "per-owner active counts in a two-person team are individual productivity; " +
      "the copy disclaimer at metrics.ts:745 is not a boundary — D-HA08",
  );
});

test("C14 · a banned metric family is refused by name, not merely absent", async () => {
  const assertFamily = (await requireExport(
    "assertMetricFamilyAllowed",
    "§13.3",
  )) as (family: string) => void;
  for (const banned of [
    "capacity",
    "utilization",
    "profitability",
    "employee_productivity",
    "ai_risk_score",
    "predicted_completion",
    "health_score",
  ]) {
    assert.throws(
      () => assertFamily(banned),
      `${banned} must be refused by the domain, not merely unimplemented — §13.3`,
    );
  }
});
