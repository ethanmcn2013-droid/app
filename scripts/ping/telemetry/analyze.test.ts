import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTelemetry, compareTelemetry, distribution, LOG_PREFIX, validateCohort, type Cohort } from "./analyze";
import type { PingTelemetryEvent } from "../../../src/lib/ping/telemetry";
const cohort: Cohort = { version: "ping.telemetry.cohort.v1", kind: "synthetic", workload: "ten-selected", environment: "isolated-libsql", configuration: "default", temperature: "warm", windowSeconds: 60, warmupExcluded: 5 };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = (patch: Partial<PingTelemetryEvent> = {}): PingTelemetryEvent => ({ version: "ping.telemetry.v1", source: "server", trust: "server_observed", clock: "server_monotonic", attemptId: id(1), requestId: id(2), spanId: id(3), parentSpanId: null, stage: "request", outcome: "completed", durationMs: 1.25, sequence: 0, droppedCount: 0, deployment: "test", release: "a".repeat(40), inputMode: "typed", ...patch });
const line = (e: unknown) => LOG_PREFIX + JSON.stringify(e);
test("strict wire rejects injected content/scalars; never echoes private input or IDs in report", () => {
  const secret = "SYNTHETIC_PRIVATE_SENTINEL";
  const rows = [line(event()), line({ ...event(), transcript: secret }), line({ ...event(), inputMode: ["typed"] }), `${LOG_PREFIX}{bad ${secret}`, `[other] ${secret}`];
  const report = analyzeTelemetry(rows, cohort);
  assert.equal(report.counts.uniqueEvents, 1); assert.equal(report.counts.invalidLines, 3); assert.equal(report.counts.unrelatedLines, 1);
  assert.ok(!JSON.stringify(report).includes(secret)); assert.ok(!JSON.stringify(report).includes(id(1)));
});
test("dedupes identical events; counts conflicts and retains unfinished/null rather than zero", () => {
  const start = event({ outcome: "started", durationMs: null });
  const report = analyzeTelemetry([line(start), line(start), line(event({ durationMs: 99 })), line(event({ spanId: id(4), sequence: 2, outcome: "unknown", durationMs: null }))], cohort);
  assert.equal(report.counts.duplicates, 1); assert.equal(report.counts.conflicts, 1); assert.equal(report.counts.unfinishedSpans, 1); assert.equal(report.counts.observedSequenceGaps, 1);
  assert.equal(report.rows.find(r => r.outcome === "unknown")?.timing.medianMs, null);
  assert.ok(report.signals.includes("unknown-outcome-observed"));
});
test("quantiles use truthful minimum n and exact nearest-rank definition", () => {
  assert.equal(distribution([]).medianMs, null); assert.equal(distribution([1, 2]).medianMs, 1.5); assert.equal(distribution([1, 2]).p95Ms, null);
  assert.equal(distribution(Array.from({ length: 20 }, (_, i) => i + 1)).p95Ms, 19);
});
test("build/source/clock/mode separation prevents cross-process duration arithmetic", () => {
  const report = analyzeTelemetry([line(event()), line(event({ source: "client", trust: "client_reported", clock: "client_monotonic", durationMs: 200, inputMode: "local-speech" }))], cohort);
  assert.equal(report.rows.length, 2); assert.equal(report.counts.sourceCohortAttempts, 2);
  assert.deepEqual(report.rows.map(r => r.timing.medianMs).sort((a, b) => a! - b!), [1.25, 200]);
});
test("comparison refuses mismatched cohorts, integrity loss, and mixed release joins", () => {
  const a = analyzeTelemetry([line(event())], cohort);
  const b = analyzeTelemetry([line(event({ release: "b".repeat(40), durationMs: 0.1 }))], cohort);
  assert.equal(compareTelemetry(a, b).comparisons[0].status, "insufficient-samples");
  assert.equal(compareTelemetry(a, analyzeTelemetry([line(event())], { ...cohort, environment: "other" })).compatible, false);
  assert.equal(compareTelemetry(a, analyzeTelemetry([line(event({ droppedCount: 1 }))], cohort)).compatible, false);
  const mixed = analyzeTelemetry([line(event()), line(event({ requestId: id(5), release: "b".repeat(40) }))], cohort);
  assert.equal(compareTelemetry(a, mixed).compatible, false);
});
test("explicit unfinished observations remain censored and empty cohorts cannot compare", () => {
  const report = analyzeTelemetry([line(event({ outcome: "started", durationMs: null })), line(event({ sequence: 1, outcome: "unfinished", durationMs: 10 }))], cohort);
  assert.equal(report.counts.unfinishedSpans, 1); assert.equal(report.counts.explicitUnfinishedObservations, 1);
  assert.equal(report.rows.find(r => r.outcome === "unfinished")?.timing.n, 0);
  assert.equal(report.rows.find(r => r.outcome === "unfinished")?.timing.medianMs, null);
  assert.equal(report.rows.find(r => r.outcome === "unfinished")?.censored, 1);
  const empty = analyzeTelemetry([], cohort); assert.equal(compareTelemetry(empty, empty).compatible, false);
  assert.equal(compareTelemetry(report, report).compatible, false);
  const other = analyzeTelemetry([line(event({ stage: "prepare" }))], cohort);
  assert.equal(compareTelemetry(analyzeTelemetry([line(event())], cohort), other).compatible, false);
});
test("comparison retains baseline non-timing denominators and missing groups", () => {
  const baseline = analyzeTelemetry([line(event()), line(event({ spanId: id(5), sequence: 1, stage: "execute", outcome: "failed", durationMs: null }))], cohort);
  const candidate = analyzeTelemetry([line(event({ release: "b".repeat(40) }))], cohort);
  const report = compareTelemetry(baseline, candidate);
  assert.equal(report.compatible, true);
  if ("baselineCounts" in report) {
    assert.equal(report.baselineCounts?.missingTerminalDurations, 1);
    assert.equal(report.missingCandidateGroups?.[0].outcome, "failed");
    assert.equal(report.missingCandidateGroups?.[0].missingDuration, 1);
  } else assert.fail("baseline denominator missing");
});
test("input and manifest are bounded and closed; no arbitrary labels", () => {
  assert.equal(validateCohort({ ...cohort, actor: "no" }), null); assert.equal(validateCohort({ ...cohort, workload: "https://private" }), null);
  assert.equal(validateCohort({ ...cohort, kind: ["synthetic"] }), null);
  assert.throws(() => analyzeTelemetry(Array(20001).fill(""), cohort), /20000/);
  const report = analyzeTelemetry([LOG_PREFIX + "x".repeat(8193)], cohort); assert.equal(report.counts.oversizedLines, 1);
});
