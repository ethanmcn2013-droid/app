/**
 * History, comparability, the single trend, and the snapshot writer contract.
 *
 * Contract: `docs/projects/home-operating-layer/contracts/ANALYTICS_CLAIM.md`
 * §10 (history and trends), §15 (the writer). Assertion C6 of §18.
 *
 * EVERY TEST IN THIS FILE IS EXPECTED TO FAIL AT THIS BASE. `captureWorkspaceSnapshots`
 * has zero callers repo-wide (`src/modules/signal/server/analytics/snapshots.ts:244`;
 * R7, re-verified at `RECONCILIATION.md:152`), so analytics history is a read
 * path over an empty table. Nothing here can pass until the writer runs and the
 * history module of §10 exists.
 *
 * The module specifier is typed `string` on purpose so `tsc --noEmit` cannot try
 * to resolve a module that is not written yet. See `claim-contract.test.ts`.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/analytics/history-contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

const HISTORY_MODULE: string = "./history";
const HISTORY_MODULE_PATH = "src/lib/home-layer/analytics/history.ts";

type Loaded = Record<string, unknown>;

async function requireExport(name: string, clause: string): Promise<unknown> {
  let loaded: Loaded;
  try {
    loaded = (await import(HISTORY_MODULE)) as Loaded;
  } catch {
    assert.fail(
      `${HISTORY_MODULE_PATH} does not exist yet. ` +
        `It must export \`${name}\` — ANALYTICS_CLAIM.md ${clause}`,
    );
  }
  const value = loaded[name];
  if (value === undefined) {
    assert.fail(
      `${HISTORY_MODULE_PATH} exists but does not export \`${name}\` — ` +
        `ANALYTICS_CLAIM.md ${clause}`,
    );
  }
  return value;
}

/** One captured daily reading, in the shape §15.3 requires of a persisted row. */
function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    projectId: "ws_1",
    metricKey: "open_work",
    metricVersion: "signal-analytics-metrics@1.0.0",
    snapshotAt: "2026-08-01T00:00:00.000Z",
    numericValue: 12,
    coverageStatus: "complete",
    origin: "capture",
    ...overrides,
  };
}

/** `count` consecutive daily readings starting 2026-08-01. */
function dailyRun(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, index) =>
    snapshot({
      snapshotAt: new Date(Date.UTC(2026, 7, 1 + index)).toISOString(),
      ...overrides,
    }),
  );
}

// ── C6 · The minimum is fourteen, and below it there is no chart ─────────────

test("C6 · the minimum comparable-snapshot count is 14, not 2", async () => {
  const minimum = (await requireExport("MINIMUM_COMPARABLE_SNAPSHOTS", "§10.4, D-HA06")) as number;
  assert.equal(
    minimum,
    14,
    "today's bar is two points — `snapshots.ts:197` and `trend-series.ts:96`. " +
      "Two points is a line between two dots.",
  );
});

test("C6 · below the minimum the result is insufficient_history AND no chart", async () => {
  const resolve = (await requireExport("resolveTrend", "§10.1")) as (
    input: unknown,
  ) => { status: string; points: unknown[] | null; chart: boolean };
  const resolved = resolve({ snapshots: dailyRun(6) });
  assert.equal(resolved.status, "insufficient_history");
  assert.equal(
    resolved.chart,
    false,
    "not an empty chart, not a flat line, not a single point, not a greyed axis",
  );
});

test("C6 · the insufficient-history message states have, need and earliest date", async () => {
  const render = (await requireExport("renderInsufficientHistory", "§10.4")) as (
    input: unknown,
  ) => string;
  const message = render({ have: 6, need: 14, earliest: "2026-08-14T00:00:00.000Z" });
  assert.match(message, /Not enough history/i);
  assert.match(message, /6/);
  assert.match(message, /14/);
  assert.match(message, /August/i, "the earliest date it can show a trend is named");
});

test("C6 · at or above the minimum a chart is permitted", async () => {
  const resolve = (await requireExport("resolveTrend", "§10.4")) as (
    input: unknown,
  ) => { status: string; chart: boolean };
  assert.equal(resolve({ snapshots: dailyRun(14) }).chart, true);
});

// ── §10.2 · The snapshot ledger is the only trend source ─────────────────────

test("D-HA05 · a trend may not be built from events inside the current response", async () => {
  const resolve = (await requireExport("resolveTrend", "§10.2, D-HA05")) as (
    input: unknown,
  ) => { status: string; chart: boolean };
  const resolved = resolve({
    snapshots: [],
    // What `trend-series.ts:24-86` does today: re-derive buckets from live
    // events, capped by MAX_TASKS = 2_000 (`providers/tasks.ts:27`). A cap that
    // bites the oldest rows renders as a decline that never happened — N6.
    events: Array.from({ length: 400 }, (_, index) => ({ at: index })),
  });
  assert.equal(
    resolved.chart,
    false,
    "event-derived buckets are retired as a trend source; the snapshot ledger is " +
      "the only admissible one",
  );
});

// ── §10.3 · Comparability ────────────────────────────────────────────────────

test("§10.3 · a major metric-version change ends the comparable run", async () => {
  const run = (await requireExport("maximalComparableRun", "§10.3")) as (
    snapshots: unknown[],
  ) => unknown[];
  const mixed = [
    ...dailyRun(10, { metricVersion: "signal-analytics-metrics@1.0.0" }),
    ...dailyRun(10, { metricVersion: "signal-analytics-metrics@2.0.0" }).map((row, index) => ({
      ...row,
      snapshotAt: new Date(Date.UTC(2026, 7, 11 + index)).toISOString(),
    })),
  ];
  assert.equal(
    run(mixed).length,
    10,
    "`readMetricSnapshotHistory` does not filter on metric_version today " +
      "(snapshots.ts:161-178), so a bump mid-window draws two definitions as one " +
      "line — finding N1",
  );
});

test("§10.3 · a gap longer than one day ends the run; it is never bridged", async () => {
  const run = (await requireExport("maximalComparableRun", "§10.3")) as (
    snapshots: unknown[],
  ) => unknown[];
  const withGap = [
    ...dailyRun(5),
    snapshot({ snapshotAt: "2026-08-12T00:00:00.000Z" }),
    snapshot({ snapshotAt: "2026-08-13T00:00:00.000Z" }),
  ];
  const resolved = run(withGap);
  assert.ok(
    resolved.length <= 5,
    "the chart stops at the gap and says why — it never interpolates across it",
  );
});

test("§10.3 · a partial-coverage capture is not comparable to a complete one", async () => {
  const run = (await requireExport("maximalComparableRun", "§10.3")) as (
    snapshots: unknown[],
  ) => unknown[];
  const mixed = [
    ...dailyRun(8),
    ...dailyRun(3, { coverageStatus: "partial" }).map((row, index) => ({
      ...row,
      snapshotAt: new Date(Date.UTC(2026, 7, 9 + index)).toISOString(),
    })),
  ];
  assert.equal(run(mixed).length, 8);
});

test("§15.7 · captured and backfilled points never render as one undifferentiated series", async () => {
  const run = (await requireExport("maximalComparableRun", "§15.7, D-HA09")) as (
    snapshots: unknown[],
  ) => Array<{ origin?: string }>;
  const mixed = [
    ...dailyRun(7, { origin: "backfill" }),
    ...dailyRun(7).map((row, index) => ({
      ...row,
      snapshotAt: new Date(Date.UTC(2026, 7, 8 + index)).toISOString(),
    })),
  ];
  const origins = new Set(run(mixed).map((point) => point.origin));
  assert.ok(
    origins.size <= 1,
    "a chart never presents a backfilled point and a captured point as " +
      "interchangeable — the distinction stays visible",
  );
});

// ── §10.5 · Exactly one trend ────────────────────────────────────────────────

test("D-HA07 · V1 declares exactly one trend, and it is open_work", async () => {
  const trends = (await requireExport("V1_TREND_METRICS", "§10.5, D-HA07")) as readonly string[];
  assert.deepEqual(
    [...trends],
    ["open_work"],
    "a daily snapshot of a stock is exactly comparable day to day; a daily " +
      "snapshot of a 28-day flow (`snapshots.ts:291-295`) shares 27 of 28 days " +
      "with its neighbour",
  );
});

// ── §15 · The writer ─────────────────────────────────────────────────────────

test("§15.3 · snapshot_at is the UTC day boundary, not the run instant", async () => {
  const stamp = (await requireExport("canonicalSnapshotAt", "§15.3, finding N2")) as (
    now: Date,
  ) => string;
  assert.equal(
    stamp(new Date("2026-08-12T17:43:09.412Z")),
    "2026-08-12T00:00:00.000Z",
    "the upsert does not update snapshot_at (`snapshots.ts:344-353`), so after a " +
      "same-day re-run the row carries the first run's timestamp and the last " +
      "run's value — finding N2",
  );
});

test("§15.5 · retries are bounded at three per workspace-day, then the day is abandoned", async () => {
  const decide = (await requireExport("nextRunDisposition", "§15.5")) as (
    input: unknown,
  ) => string;
  assert.equal(decide({ attempts: 2, status: "failed" }), "retry");
  assert.equal(
    decide({ attempts: 3, status: "failed" }),
    "abandoned",
    "an abandoned day is a gap in the series and is never filled later from a " +
      "fresh read — that would be a backfill, governed by §15.7",
  );
});

test("§15.5 · a worker re-checks its lease immediately before writing metric rows", async () => {
  const guard = (await requireExport("assertLeaseHeldBeforeWrite", "§15.5")) as (
    input: unknown,
  ) => void;
  assert.throws(
    () => guard({ runId: "run_1", leaseHolder: "run_2" }),
    "without the re-check, a run that overran its 10-minute lease " +
      "(SNAPSHOT_RUN_STALE_MS, snapshot-utils.ts:5) and the run that reclaimed it " +
      "can both write",
  );
});

test("D-HA09 · a stock metric may never be backfilled on the current schema", async () => {
  const permitted = (await requireExport("backfillPermitted", "§15.7, D-HA09")) as (
    metricKey: string,
  ) => boolean;
  for (const stock of [
    "open_work",
    "open_overdue_work",
    "unowned_work",
    "open_work_age",
    "stalled_work",
    "cross_product_milestone_risk",
  ]) {
    assert.equal(
      permitted(stock),
      false,
      `${stock} is a stock. The mirror stores only current lane, assignees and ` +
        "due, with no revision history, so reconstructing it means asserting " +
        "today's state under yesterday's date.",
    );
  }
  assert.equal(
    permitted("work_completed"),
    true,
    "a flow derived from retained, timestamped transition events is reconstructible",
  );
});

test("§15.8 · pausing the writer does not delete history or restate the reason", async () => {
  const state = (await requireExport("pausedWriterSurfaceState", "§15.8, D-HA12")) as (
    input: unknown,
  ) => { status: string; message: string };
  const paused = state({ jobsEnabled: false, lastCaptureAt: "2026-08-11T00:00:00.000Z" });
  assert.match(
    paused.message,
    /paused/i,
    "a paused capture says it is paused and gives its last capture date",
  );
  assert.notEqual(
    paused.status,
    "unavailable",
    "pausing must not silently convert 'not enough history' into 'no data'",
  );
});

test("§15.8 · a per-provider kill switch makes dependent claims unsupported, never zero", async () => {
  const state = (await requireExport("providerKillSwitchClaimStatus", "§15.8")) as (
    input: unknown,
  ) => { status: string; value: unknown };
  const killed = state({ provider: "timeline", metric: "cross_product_milestone_risk" });
  assert.equal(killed.status, "unsupported");
  assert.equal(killed.value, null, "never 0, never 'all clear'");
});

// ── §11 / N5 · All-projects history ──────────────────────────────────────────

test("N5 · an all-projects trend needs a comparable run for every Project in the read set", async () => {
  const resolve = (await requireExport("resolveTrend", "§14 N5")) as (
    input: unknown,
  ) => { status: string; chart: boolean };
  const resolved = resolve({
    readScope: { kind: "all-projects" },
    projects: ["ws_1", "ws_2", "ws_3"],
    // Snapshot eligibility is `analytics_users.linked_workspace_id IS NOT NULL`
    // (`snapshots.ts:57-66`) — one workspace per user. A member of three
    // Projects gets history for one.
    snapshotsByProject: { ws_1: dailyRun(30) },
  });
  assert.equal(resolved.status, "insufficient_history");
  assert.equal(resolved.chart, false);
});
