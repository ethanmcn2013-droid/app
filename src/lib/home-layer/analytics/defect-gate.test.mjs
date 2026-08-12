/**
 * The release gate for `ANALYTICS_CLAIM.md` §14 — R1–R10 and the six new
 * findings N1–N6 — asserted against the real source of the analytics domain.
 *
 * Contract: `docs/projects/home-operating-layer/contracts/ANALYTICS_CLAIM.md`
 * §14, §17.3, §18.
 *
 * MOST TESTS IN THIS FILE ARE EXPECTED TO FAIL AT THIS BASE, and each failure
 * message names the defect it gates. That is the Wave 1 deliverable. Two
 * standing guards (marked GUARD) pass today and exist to stop a regression;
 * they are not evidence that anything was fixed.
 *
 * This file only READS the analytics domain. It writes nothing and imports
 * nothing from it, so it cannot collide with a lane editing those files.
 *
 * Run:
 *   node --test src/lib/home-layer/analytics/defect-gate.test.mjs
 */

import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const LIB_ANALYTICS = "src/modules/signal/lib/analytics";
const SERVER_ANALYTICS = "src/modules/signal/server/analytics";

function read(repoRelativePath) {
  return readFileSync(join(REPO_ROOT, repoRelativePath), "utf8");
}

function exists(repoRelativePath) {
  try {
    statSync(join(REPO_ROOT, repoRelativePath));
    return true;
  } catch {
    return false;
  }
}

/** Every .ts/.tsx/.mts/.mjs file under the given repo-relative roots. */
function sourceFiles(roots = ["src", "scripts"]) {
  const found = [];
  const walk = (absolute) => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const next = join(absolute, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry.name)) found.push(next);
    }
  };
  for (const root of roots) {
    const absolute = join(REPO_ROOT, root);
    if (exists(root)) walk(absolute);
  }
  return found;
}

/**
 * Test files quote the identifiers they gate. This file's own header names
 * `captureWorkspaceSnapshots`; so does a sibling Wave 1 contract test in
 * `src/lib/home-layer/context/`. A search that counted prose would report the
 * contract as its own evidence, which is exactly the failure this gate exists
 * to catch elsewhere. Only production source counts.
 */
const TEST_PATH = /(^|\/)(__tests__|testing)\/|\.test\.[cm]?[jt]sx?$/;

function isProductionSource(repoRelativePath) {
  return !TEST_PATH.test(repoRelativePath);
}

/**
 * Production files containing `needle`, as repo-relative paths.
 * Test files never count — see TEST_PATH.
 */
function filesContaining(needle, exclude = []) {
  const excluded = new Set(exclude);
  return sourceFiles()
    .filter((absolute) => readFileSync(absolute, "utf8").includes(needle))
    .map((absolute) => relative(REPO_ROOT, absolute).split("\\").join("/"))
    .filter((path) => !excluded.has(path) && isProductionSource(path));
}

/** The body of a named top-level function, up to the next top-level `export`. */
function functionBody(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `could not find \`${declaration}\` — citation is stale`);
  const rest = source.slice(start + declaration.length);
  const next = rest.indexOf("\nexport ");
  return next === -1 ? rest : rest.slice(0, next);
}

// ── R1 · Project identity ────────────────────────────────────────────────────

test("R1 · AnalyticsScope carries a canonical ProjectId, not a nested workspace/project pair", () => {
  const source = read(`${LIB_ANALYTICS}/contracts.ts`);
  const scope = functionBody(source, "export interface AnalyticsScope");
  assert.ok(
    !scope.includes("workspaceId"),
    "`contracts.ts:11-18` models `project` as a scope nested inside `workspace`. " +
      "Under Project = Tasks workspaces.id (ADR 0001 §1, PROJECT_SCOPE.md §1) that " +
      "nesting is impossible, not merely mislabelled — R1, ANALYTICS_CLAIM.md §4.1",
  );
});

test("R1 · a task tag is never an authorization input", () => {
  const source = read(`${SERVER_ANALYTICS}/policy.ts`);
  assert.ok(
    !source.includes("projectIdFromTag"),
    "`policy.ts:220` gates project-scope authorization on a slugified task tag. " +
      "Two tags that slugify identically merge silently and renaming a tag destroys " +
      "its history — PROJECT_SCOPE.md §2.3, ANALYTICS_CLAIM.md §4.2",
  );
});

// ── R2 · Blocked work is dead against live data ──────────────────────────────

test("R2 · the blocked predicate does not test a lane that was retired", () => {
  const source = read(`${SERVER_ANALYTICS}/providers/tasks.ts`);
  assert.ok(
    !/lane === "blocked"/.test(source),
    '`providers/tasks.ts:128` reads `row.lane === "blocked" || row.lane === "waiting"`. ' +
      '"blocked" was never a lane, and `drizzle/0024_retire_waiting_lane.sql:57-60` ' +
      "rewrote every lane='waiting' to lane='doing' + board_column_key='waiting'. " +
      "The mirror schema has no board_column_key column, so explicitCount is always 0 — R2",
  );
});

// ── R3 · The done predicate ──────────────────────────────────────────────────

test("R3 · no analytics provider resolves Done with a null board config", () => {
  for (const path of [
    `${SERVER_ANALYTICS}/providers/tasks.ts`,
    `${SERVER_ANALYTICS}/providers/notes.ts`,
  ]) {
    assert.ok(
      !/isTaskDone\([^)]*,\s*null\)/.test(read(path)),
      `${path} calls isTaskDone(row, null), which resolves doneKeys = ["done"] ` +
        "(`src/lib/board-columns.ts:183-186`). A Project that renamed Done is read one " +
        "way by the board, digest, export and print and another way by analytics — R3",
    );
  }
});

// ── R4 · Fixtures declare capabilities production cannot have ────────────────

test("R4 · fixture capabilities are a subset of what a provider can declare in production", () => {
  const fixtures = read(`${LIB_ANALYTICS}/fixtures.ts`);
  assert.ok(
    !fixtures.includes('"decision_read"'),
    "fixtures declare `decision_read` (`fixtures.ts:58`) but the Notes provider " +
      'declares only ["follow_up_read","cross_product_links"] (`providers/notes.ts:173`). ' +
      "Every green analytics test runs over capabilities production does not have — R4",
  );
});

// ── R5 · Cross-product links ─────────────────────────────────────────────────

test("R5 · linked decisions are read, or the milestone-risk claim names the missing leg", () => {
  const hardcoded = [
    `${SERVER_ANALYTICS}/providers/tasks.ts`,
    `${SERVER_ANALYTICS}/providers/timeline.ts`,
  ].filter((path) => read(path).includes("linkedDecisionIds: []"));
  assert.deepEqual(
    hardcoded,
    [],
    "`providers/tasks.ts:162` and `providers/timeline.ts:225` hardcode " +
      "linkedDecisionIds to empty, so cross_product_milestone_risk is one-legged: " +
      "it sees overdue and blocked linked tasks, never linked decisions. It must " +
      'never render as "no risk" — R5, ANALYTICS_CLAIM.md §13.1 D1',
  );
});

// ── R6 · Dead /app/trends links reach a real user surface ────────────────────

test("R6 · no /app/trends link is built anywhere in src", () => {
  const offenders = filesContaining("/app/trends");
  assert.deepEqual(
    offenders,
    [],
    "`rules.ts:154` builds /app/trends and it is used at seven call sites. There is " +
      "no such route. The ledger boundary strips it; the evidence drawer does not — R6",
  );
});

test("R6 · evidence actions pass the same allowlist as the ledger", () => {
  const source = read(`${SERVER_ANALYTICS}/service.ts`);
  assert.ok(
    !/\n\s*actions: observation\.actions,/.test(source),
    "`service.ts:549` returns actions unfiltered into evidence-drawer.tsx → " +
      "action-link.tsx, which has no allowlist. A reader opening evidence sees a " +
      '"See trend" button that 404s — R6, ANALYTICS_CLAIM.md §12.2',
  );
});

// ── R7 · No snapshot writer is ever called ───────────────────────────────────

test("R7 · captureWorkspaceSnapshots has at least one caller", () => {
  // A call, not a mention: a comment naming the writer is not a caller.
  const callers = filesContaining("captureWorkspaceSnapshots(", [
    `${SERVER_ANALYTICS}/snapshots.ts`,
  ]);
  assert.notDeepEqual(
    callers,
    [],
    "`snapshots.ts:244` defines the writer and nothing calls it, repo-wide. " +
      "`vercel.json` declares exactly one cron and it is the digest. Analytics " +
      "history is a read path over an empty table — R7, ANALYTICS_CLAIM.md §15",
  );
});

test("R7 · the snapshot job has its own default-off gate, separate from the briefing-engine flag", () => {
  const found = filesContaining("SIGNAL_ANALYTICS_JOBS_ENABLED");
  assert.notDeepEqual(
    found,
    [],
    "SIGNAL_ANALYTICS_V1_ENABLED is a briefing-engine switch, not a job gate " +
      "(`signal-brief-page.tsx:38`, `policy.ts:44`). The writer needs its own " +
      "fail-closed gate — RECONCILIATION.md row 9, ANALYTICS_CLAIM.md §15.1",
  );
});

// ── R8 · Notes aggregates are viewer-scoped without disclosure ───────────────

test("R8 · the Notes provider discloses that its aggregates are viewer-scoped", () => {
  const source = read(`${SERVER_ANALYTICS}/providers/notes.ts`);
  assert.ok(
    source.includes("notes_viewer_scoped"),
    "the query binds `WHERE user_id = ?` (`providers/notes.ts:86`), so two members " +
      "of the same Project get different follow-up counts from the same query. None " +
      "of the three declared issue codes (`:178-189`) names this — R8",
  );
});

// ── R9 · Owner identity collision ────────────────────────────────────────────

test("R9 · a record dropped by an identity-space mismatch is disclosed, not silently removed", () => {
  const found = filesContaining("owner_unmatched");
  assert.notDeepEqual(
    found,
    [],
    "`scope.ts:19-21` compares scope.id (a Tasks user id, normalized at " +
      "`policy.ts:100`) against MilestoneRecord.ownerIds, which comes from " +
      "Timeline's `assignee` column (`providers/timeline.ts:226`). Under a user " +
      "scope every milestone and Timeline dependency is silently dropped — R9, D-HA11",
  );
});

// ── R10 · Unordered 2,000-row read ───────────────────────────────────────────

test("R10 · the bounded task read is deterministically ordered", () => {
  const source = read(`${SERVER_ANALYTICS}/providers/tasks.ts`);
  const start = source.indexOf(".from(tasks)");
  const end = source.indexOf(".limit(MAX_TASKS + 1)");
  assert.ok(start !== -1 && end !== -1 && end > start, "citation is stale");
  assert.ok(
    source.slice(start, end).includes("orderBy"),
    "`providers/tasks.ts:58-62` reads LIMIT 2001 with no ORDER BY. Truncation is " +
      "flagged but WHICH rows is undefined, so repeated reads can return different " +
      "totals — R10. The only orderBy in this file is on the activities read (`:88`).",
  );
});

// ── N1 · The history read does not filter on metric version ──────────────────

test("N1 · the snapshot history read filters on metric_version", () => {
  const source = read(`${SERVER_ANALYTICS}/snapshots.ts`);
  const body = functionBody(source, "export async function readMetricSnapshotHistory");
  assert.ok(
    body.includes("metricVersion"),
    "`snapshots.ts:161-178` selects on workspace, scope, metric_key and a time " +
      "range, with no version predicate. A major bump mid-window silently draws two " +
      "different definitions as one line — finding N1, ANALYTICS_CLAIM.md §10.3",
  );
});

// ── N2 · The upsert does not restamp snapshot_at ─────────────────────────────

test("N2 · a same-day re-capture updates snapshot_at along with the value", () => {
  const source = read(`${SERVER_ANALYTICS}/snapshots.ts`);
  const start = source.indexOf(".onConflictDoUpdate(");
  assert.notEqual(start, -1, "citation is stale");
  const block = source.slice(start, start + 600);
  assert.ok(
    /snapshot_at|snapshotAt/.test(block),
    "the `set:` block covers numericValue, aggregateValue, coverage, metricVersion " +
      "and updatedAt (`snapshots.ts:344-353`) but not snapshotAt, so after a " +
      "same-day re-run the row carries the first run's timestamp and the last run's " +
      "value — finding N2. §15.3 fixes this by stamping the UTC day boundary.",
  );
});

// ── C6 · The two-point trend bar ─────────────────────────────────────────────

test("C6 · the history readiness bar is not two points", () => {
  const source = read(`${SERVER_ANALYTICS}/snapshots.ts`);
  assert.ok(
    !source.includes("points.length >= 2"),
    "`snapshots.ts:197` calls two points ready, and `trend-series.ts:96` agrees. " +
      "Two points is a line between two dots — D-HA06 raises the bar to 14 " +
      "comparable daily snapshots",
  );
});

// ── D-HA08 · workload_distribution is not persisted ──────────────────────────

test("C16 · workload_distribution is absent from SNAPSHOT_METRICS", () => {
  const source = read(`${SERVER_ANALYTICS}/snapshots.ts`);
  const start = source.indexOf("const SNAPSHOT_METRICS");
  const block = source.slice(start, source.indexOf("];", start));
  assert.ok(
    !block.includes("workload_distribution"),
    "`snapshots.ts:46` persists a per-owner aggregate for a surface that does not " +
      "render. In a two-person team a per-person active count is individual " +
      "productivity, which §13.3 forbids — D-HA08",
  );
});

// ── §17.3 · The dead shell is retired ────────────────────────────────────────

test("C13 · the SignalAppShell subtree is deleted", () => {
  const shell = "src/modules/signal/components/signal/signal-app-shell.tsx";
  assert.equal(
    exists(shell),
    false,
    "the whole subtree is dead — zero importers for the shell, overview-view and " +
      "trends-view, plus ten descendants. Retire it before Wave 3 or a lab agent " +
      "will build the new Analytics on top of it — REPOSITORY_TRUTH.md:165-173, " +
      "ANALYTICS_CLAIM.md §17.3",
  );
});

test("C13 · nothing imports the dead shell while it still exists", () => {
  const importers = filesContaining("signal-app-shell", [
    "src/modules/signal/components/signal/signal-app-shell.tsx",
  ]);
  assert.deepEqual(
    importers,
    [],
    "the Wave 3 freeze: nothing new imports these files from now on, so the Wave 9 " +
      "deletion diff stays readable on its own — ANALYTICS_CLAIM.md §17.3",
  );
});

// ── GUARD · The retirement must not take the live briefing with it ──────────

/**
 * Seven files sit in the same directory as the dead shell and are reached from
 * `/app/home/briefing`, which ships today. A "dead shell sweep" that deletes by
 * directory removes a live surface. §17.3 resolves the set by import graph, and
 * this guard holds that line. It passes at this base; it exists so it keeps
 * passing through the Wave 9 deletion.
 */
test("GUARD §17.3 · the live signal components survive the SignalAppShell retirement", () => {
  const live = {
    "evidence-drawer.tsx": "src/modules/signal/app/signal-brief-page.tsx",
    "format.ts": "src/modules/signal/app/signal-brief-page.tsx",
    "links.ts": "src/modules/signal/app/signal-page-data.ts",
    "signal-types.ts": "src/modules/signal/app/signal-page-data.ts",
    "action-link.tsx": "src/modules/signal/components/signal/evidence-drawer.tsx",
    "source-record-list.tsx": "src/modules/signal/components/signal/evidence-drawer.tsx",
    "signal.css": "src/app/app/home/briefing/layout.tsx",
  };
  for (const [file, importer] of Object.entries(live)) {
    assert.ok(
      exists(`src/modules/signal/components/signal/${file}`),
      `${file} is imported by ${importer} on the shipped /app/home/briefing path. ` +
        "It is not part of the dead subtree — ANALYTICS_CLAIM.md §17.3",
    );
    assert.ok(
      exists(importer),
      `${importer} is the live importer that makes ${file} live; if it moved, ` +
        "§17.3's import-graph table is stale and must be re-walked before any deletion",
    );
  }
});

// ── GUARD · The metric-family boundary (passes today; do not delete) ─────────

test("GUARD §13.3 · no banned metric family appears in the analytics domain", () => {
  const banned = /\b(capacity|utilizat|utilisat|profitab|burndown|velocity|forecast|predicted)/i;
  const offenders = [];
  for (const directory of [LIB_ANALYTICS, SERVER_ANALYTICS]) {
    for (const absolute of sourceFiles([directory])) {
      if (banned.test(readFileSync(absolute, "utf8"))) {
        offenders.push(relative(REPO_ROOT, absolute).split("\\").join("/"));
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "capacity, utilization, profitability, employee productivity, speculative AI " +
      "risk and predicted completion are prohibited without a new founder-approved " +
      "ADR — ANALYTICS_CLAIM.md §13.3. This guard passes at this base; it exists so " +
      "that stays true.",
  );
});

// ── GUARD · The Notes privacy seam (passes today; do not delete) ─────────────

test("GUARD §16 · the Notes analytics read never names a raw body column", () => {
  const source = read(`${SERVER_ANALYTICS}/providers/notes.ts`);
  // Only the SQL template literals are checked, never prose: the file's own
  // comment at `:27` says the SELECT "does not name the private `body` column",
  // and a naive scan of the whole file would fail on that sentence.
  // `\bbody\b` cannot match inside `extract_body`: `_` is a word character, so
  // there is no boundary before that `b`.
  const statements = [...source.matchAll(/sql:\s*`([\s\S]*?)`/g)].map((match) => match[1]);
  assert.notEqual(statements.length, 0, "no SQL literal found — citation is stale");
  assert.ok(
    statements.every((statement) => !/\bbody\b/.test(statement)),
    "the query names its columns and never names `body` (`providers/notes.ts:84-85`), " +
      'with exposure fixed to "approved_extract" (`contracts.ts:122`). Audit B calls ' +
      "this the best-defended seam in the estate. This contract does not weaken it " +
      "in any direction — ANALYTICS_CLAIM.md §16.",
  );
});
