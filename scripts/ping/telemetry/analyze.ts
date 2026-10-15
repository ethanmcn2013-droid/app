import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePingTelemetryEvent, type PingTelemetryEvent } from "../../../src/lib/ping/telemetry";

export const LOG_PREFIX = "[ping.telemetry] ";
export type Cohort = Readonly<{
  version: "ping.telemetry.cohort.v1";
  kind: "synthetic" | "local-measured" | "preview-measured" | "production-measured";
  workload: string; environment: string; configuration: string;
  temperature: "cold" | "warm" | "mixed" | "unknown";
  windowSeconds: number; warmupExcluded: number;
}>;
export function validateCohort(value: unknown): Cohort | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const c = value as Record<string, unknown>;
  const keys = ["version", "kind", "workload", "environment", "configuration", "temperature", "windowSeconds", "warmupExcluded"];
  if (Object.keys(c).length !== keys.length || keys.some(k => !Object.hasOwn(c, k)) || c.version !== "ping.telemetry.cohort.v1" ||
      !["synthetic", "local-measured", "preview-measured", "production-measured"].includes(c.kind as string) ||
      !["cold", "warm", "mixed", "unknown"].includes(c.temperature as string) ||
      ![c.workload, c.environment, c.configuration].every(v => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v)) ||
      !Number.isInteger(c.windowSeconds) || Number(c.windowSeconds) < 1 || Number(c.windowSeconds) > 86400 ||
      !Number.isInteger(c.warmupExcluded) || Number(c.warmupExcluded) < 0 || Number(c.warmupExcluded) > 100000) return null;
  return Object.freeze({ version: c.version, kind: c.kind, workload: c.workload, environment: c.environment,
    configuration: c.configuration, temperature: c.temperature, windowSeconds: c.windowSeconds,
    warmupExcluded: c.warmupExcluded }) as Cohort;
}
export function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return { n, medianMs: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null,
    minMs: n ? sorted[0] : null, maxMs: n ? sorted[n - 1] : null,
    p95Status: n >= 20 ? "descriptive-only" : "insufficient-samples" };
}
type Row = {
  source: PingTelemetryEvent["source"]; trust: PingTelemetryEvent["trust"]; clock: PingTelemetryEvent["clock"];
  deployment: PingTelemetryEvent["deployment"]; release: string | null; inputMode: PingTelemetryEvent["inputMode"];
  stage: PingTelemetryEvent["stage"]; outcome: PingTelemetryEvent["outcome"]; events: number; missingDuration: number; censored: number;
  timing: ReturnType<typeof distribution>;
};
const dimension = (e: PingTelemetryEvent) => JSON.stringify([e.source, e.trust, e.clock, e.deployment, e.release, e.inputMode]);
/** Offline only. Never echoes rejected input or exported identity/correlation fields. */
export function analyzeTelemetry(lines: Iterable<string>, cohort: Cohort) {
  if (!validateCohort(cohort)) throw new Error("Invalid telemetry cohort");
  let totalLines = 0, unrelatedLines = 0, invalidLines = 0, duplicates = 0, conflicts = 0, oversizedLines = 0;
  const records = new Map<string, { encoded: string; event: PingTelemetryEvent }>();
  for (const line of lines) {
    if (++totalLines > 20000) throw new Error("Telemetry input exceeds 20000 lines");
    if (!line.trim()) continue;
    if (!line.startsWith(LOG_PREFIX)) { unrelatedLines++; continue; }
    if (Buffer.byteLength(line) > 8192) { oversizedLines++; invalidLines++; continue; }
    let event: PingTelemetryEvent | null = null;
    try { event = validatePingTelemetryEvent(JSON.parse(line.slice(LOG_PREFIX.length))); } catch { /* reject without echo */ }
    if (!event) { invalidLines++; continue; }
    const identity = JSON.stringify([event.source, event.attemptId, event.requestId, event.sequence]);
    const encoded = JSON.stringify(event), previous = records.get(identity);
    if (previous) { if (previous.encoded === encoded) duplicates++; else conflicts++; continue; }
    records.set(identity, { encoded, event });
  }
  const groups = new Map<string, { row: Omit<Row, "timing">; values: number[] }>();
  const recorders = new Map<string, { sequences: Set<number>; dropped: number }>();
  const spans = new Map<string, { started: number; terminal: number; unfinished: number }>();
  const attempts = new Set<string>();
  let overflowEvents = 0, reportedOverflowCount = 0, missingTerminalDurations = 0;
  for (const { event: e } of records.values()) {
    const d = dimension(e), recorderKey = JSON.stringify([d, e.attemptId, e.requestId]);
    attempts.add(JSON.stringify([d, e.attemptId]));
    const recorder = recorders.get(recorderKey) ?? { sequences: new Set<number>(), dropped: 0 };
    recorder.sequences.add(e.sequence); recorder.dropped = Math.max(recorder.dropped, e.droppedCount); recorders.set(recorderKey, recorder);
    if (e.outcome === "overflow") { overflowEvents++; reportedOverflowCount += e.droppedCount; }
    const key = JSON.stringify([d, e.stage, e.outcome]);
    let group = groups.get(key);
    if (!group) { group = { row: { source: e.source, trust: e.trust, clock: e.clock, deployment: e.deployment, release: e.release,
      inputMode: e.inputMode, stage: e.stage, outcome: e.outcome, events: 0, missingDuration: 0, censored: 0 }, values: [] }; groups.set(key, group); }
    group.row.events++;
    if (e.outcome === "unfinished") group.row.censored++;
    if (e.outcome !== "started") {
      if (e.durationMs === null) { group.row.missingDuration++; missingTerminalDurations++; }
      else if (e.outcome !== "unfinished") group.values.push(e.durationMs);
    }
    const spanKey = JSON.stringify([d, e.attemptId, e.requestId, e.spanId, e.stage]);
    const span = spans.get(spanKey) ?? { started: 0, terminal: 0, unfinished: 0 };
    if (e.outcome === "started") span.started++;
    else if (e.outcome === "unfinished") span.unfinished++;
    else span.terminal++;
    spans.set(spanKey, span);
  }
  let observedSequenceGaps = 0, recorderReportedDropSum = 0;
  for (const r of recorders.values()) {
    observedSequenceGaps += Math.max(...r.sequences) + 1 - r.sequences.size;
    recorderReportedDropSum += r.dropped;
  }
  const rows: Row[] = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => ({ ...g.row, timing: distribution(g.values) }));
  const unfinishedSpans = [...spans.values()].filter(s => s.unfinished > 0 || s.started > 0 && s.terminal === 0).length;
  return {
    version: "ping.telemetry.analysis.v1" as const, cohort,
    method: "Per-stage terminal local-monotonic durations; median averaged middle; nearest-rank p95 only n>=20; no cross-clock subtraction; no physical-paint inference",
    counts: { totalLines, unrelatedLines, invalidLines, oversizedLines, uniqueEvents: records.size, duplicates, conflicts,
      sourceCohortAttempts: attempts.size, recorders: recorders.size, startedSpans: [...spans.values()].filter(s => s.started > 0).length,
      unfinishedSpans, explicitUnfinishedObservations: [...spans.values()].reduce((n, s) => n + s.unfinished, 0),
      missingTerminalSpans: [...spans.values()].filter(s => s.started > 0 && !s.terminal && !s.unfinished).length,
      unpairedTerminalObservations: [...spans.values()].filter(s => !s.started && s.terminal).length,
      missingTerminalDurations, observedSequenceGaps, recorderReportedDropSum, overflowEvents, reportedOverflowCount },
    coverage: "Attempt counts stay separate by source/build/environment/mode and cannot be added into a product success denominator. Facts may have no paired start. Gaps and drops overlap; never sum them into exact loss. Whole-attempt delivery loss is unobservable without an independent denominator.",
    signals: [
      ...(invalidLines || conflicts ? ["invalid-or-conflicting-input"] : []),
      ...(overflowEvents || recorderReportedDropSum || observedSequenceGaps ? ["telemetry-coverage-degraded"] : []),
      ...(unfinishedSpans ? ["unfinished-observations"] : []),
      ...(rows.some(r => r.outcome === "unknown") ? ["unknown-outcome-observed"] : []),
      ...(!records.size ? ["no-valid-observations"] : []),
    ],
    signalsStatus: "Offline diagnostic candidates only; no alert configured or delivered by this command",
    rows,
  };
}
export type TelemetryAnalysis = ReturnType<typeof analyzeTelemetry>;
/** Compare freshly analyzed cohorts; release may change, measurement circumstances may not. */
export function compareTelemetry(baseline: TelemetryAnalysis, candidate: TelemetryAnalysis) {
  const fields = ["kind", "workload", "environment", "configuration", "temperature", "windowSeconds", "warmupExcluded"] as const;
  const incompatible = fields.filter(k => baseline.cohort[k] !== candidate.cohort[k]);
  if (incompatible.length) return { compatible: false, reason: "cohort-mismatch", fields: incompatible, comparisons: [] };
  if ([baseline, candidate].some(r => !r.counts.uniqueEvents || !r.rows.some(row => row.timing.n))) {
    return { compatible: false, reason: "no-valid-timed-observations", fields: [], comparisons: [] };
  }
  if (baseline.cohort.temperature === "unknown" || [baseline, candidate].some(r => r.counts.conflicts || r.counts.invalidLines || r.signals.includes("telemetry-coverage-degraded"))) {
    return { compatible: false, reason: "unknown-temperature-or-incomplete-integrity", fields: [], comparisons: [] };
  }
  const key = (r: Row) => JSON.stringify([r.source, r.trust, r.clock, r.deployment, r.inputMode, r.stage, r.outcome]);
  const baseGroups = new Map<string, Row[]>();
  for (const row of baseline.rows) { const k = key(row); baseGroups.set(k, [...(baseGroups.get(k) ?? []), row]); }
  const candidateKeys = new Set<string>();
  const comparisons = candidate.rows.map(row => {
    const k = key(row); candidateKeys.add(k);
    const found = baseGroups.get(k) ?? [];
    const candidateCount = candidate.rows.filter(r => key(r) === k).length;
    const previous = found.length === 1 && candidateCount === 1 ? found[0] : null;
    return { source: row.source, deployment: row.deployment, inputMode: row.inputMode, stage: row.stage, outcome: row.outcome,
      baselineRelease: previous?.release ?? null, candidateRelease: row.release,
      baselineN: previous?.timing.n ?? 0, candidateN: row.timing.n,
      baselineEvents: previous?.events ?? null, candidateEvents: row.events,
      baselineMissingDuration: previous?.missingDuration ?? null, candidateMissingDuration: row.missingDuration,
      baselineCensored: previous?.censored ?? null, candidateCensored: row.censored,
      medianDeltaMs: previous?.timing.medianMs !== null && previous?.timing.medianMs !== undefined && row.timing.medianMs !== null ? row.timing.medianMs - previous.timing.medianMs : null,
      p95DeltaMs: previous?.timing.p95Ms !== null && previous?.timing.p95Ms !== undefined && row.timing.p95Ms !== null ? row.timing.p95Ms - previous.timing.p95Ms : null,
      status: !previous ? "missing-or-mixed-baseline" : row.timing.n < 20 || previous.timing.n < 20 ? "insufficient-samples" : "descriptive-comparison-only" };
  });
  if (!comparisons.some(row => row.status !== "missing-or-mixed-baseline" && row.baselineN > 0 && row.candidateN > 0)) {
    return { compatible: false, reason: "no-comparable-timed-groups", fields: [], comparisons: [] };
  }
  return { compatible: true, reason: "same-cohort-definitions", fields: [], comparisons,
    missingCandidateGroups: [...baseGroups.entries()].filter(([k]) => !candidateKeys.has(k)).flatMap(([, rows]) => rows),
    baselineCounts: baseline.counts, candidateCounts: candidate.counts,
    baselineCoverage: baseline.coverage, candidateCoverage: candidate.coverage,
    baselineSignals: baseline.signals, candidateSignals: candidate.signals,
    safety: "No automatic latency win or rollout decision. Inspect changed failure/unknown/cancelled counts and unfinished coverage with independent attempted-work denominators before adoption." };
}
function boundedRead(path: string) {
  if (statSync(path).size > 16 * 1024 * 1024) throw new Error("Telemetry input exceeds 16MiB");
  return readFileSync(path, "utf8");
}
function fromFiles(input: string, manifest: string) {
  const cohort = validateCohort(JSON.parse(boundedRead(manifest)));
  if (!cohort) throw new Error("Invalid telemetry cohort");
  return analyzeTelemetry(boundedRead(input).split(/\r?\n/), cohort);
}
export function main(args: string[]) {
  if (args.length !== 3 && args.length !== 5) throw new Error("Usage: analyze.ts INPUT.log COHORT.json OUTPUT.json [BASELINE.log BASELINE-COHORT.json]");
  const analysis = fromFiles(args[0], args[1]);
  const baseline = args.length === 5 ? fromFiles(args[3], args[4]) : null;
  const output = baseline ? { analysis, baselineAnalysis: baseline, comparison: compareTelemetry(baseline, analysis) } : analysis;
  writeFileSync(args[2], `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
  return { events: analysis.counts.uniqueEvents, invalid: analysis.counts.invalidLines, signals: analysis.signals };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)))); }
  catch { console.error("Telemetry analysis failed. Check argument count, input bounds/schema, and use a fresh output path. Input content was not echoed."); process.exitCode = 1; }
}
