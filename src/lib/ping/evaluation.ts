import { bindPingProposal, type PingCapture, type PingProposal } from "./proposal";
import { canonicalIdentity, dataRecord, exactKeys, freeze, jsonArray } from "./input-validation";
import { validPingId } from "./command";

export type PingWholePlanLabel = Readonly<{ id: string; source: "independent_fixture" | "independent_human";
  expected: PingProposal }>;
export type PingEvaluationObservation = Readonly<{ interpretationCalls: number; executorCalls: number;
  receiptReadsLifetime: number; receiptReadWindows: readonly Readonly<{ token: string; reads: number }>[]; observedCommittedEffects: number | null;
  knowledge: "not_dispatched" | "unresolved" | "committed";
  timingSource: "synthetic" | "measured"; stages: readonly Readonly<{ name: PingStage; atMs: number }>[] }>;
export const PING_STAGES = ["capture_ready", "speech_end", "finish", "flush_complete", "finals_ready",
  "interpretation_start", "interpretation_end", "dispatch", "receipt_confirmed", "visible_readback"] as const;
export type PingStage = (typeof PING_STAGES)[number];
export type PingWholePlanEvaluation = Readonly<{ ok: true; wholePlanMatch: boolean; expectedOutcome: string;
  actualOutcome: "plan" | "refusal" | "clarification" | "invalid";
  observation: PingEvaluationObservation; captureToVisibleMs: number | null; speechEndToVisibleMs: number | null; finishToVisibleMs: number | null;
  metricMeaning: "synthetic_timeline_only" | "measured_observation_only" }> | Readonly<{ ok: false; reason: "invalid_evaluation" }>;

function outcome(proposal: unknown, capture: PingCapture): { kind: "plan" | "refusal" | "clarification" | "invalid"; canonical: unknown } {
  const bound = bindPingProposal(proposal, capture, { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
  if (bound.ok) return { kind: "plan", canonical: bound.proposal };
  if (bound.reason === "refusal" || bound.reason === "clarification") return { kind: bound.reason, canonical: proposal };
  return { kind: "invalid", canonical: null };
}
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Exact WHOLE proposal comparison against independently supplied labels. No NLP inference, calls or benchmark claims. */
export function evaluatePingWholePlan(label: unknown, actual: unknown, capture: PingCapture, observed: unknown): PingWholePlanEvaluation {
  try {
    if (!dataRecord(label) || !exactKeys(label, ["id", "source", "expected"]) || typeof label.id !== "string" ||
      label.id.length < 1 || label.id.length > 128 || !["independent_fixture", "independent_human"].includes(label.source as string) ||
      !dataRecord(observed) || !exactKeys(observed, ["interpretationCalls", "executorCalls", "receiptReadsLifetime", "receiptReadWindows", "observedCommittedEffects", "knowledge", "timingSource", "stages"]) ||
      !count(observed.interpretationCalls) || !count(observed.executorCalls) || !count(observed.receiptReadsLifetime) ||
      !jsonArray(observed.receiptReadWindows, 8) ||
      (observed.observedCommittedEffects !== null && !count(observed.observedCommittedEffects)) ||
      !["not_dispatched", "unresolved", "committed"].includes(observed.knowledge as string) ||
      !["synthetic", "measured"].includes(observed.timingSource as string) || !jsonArray(observed.stages, PING_STAGES.length)) {
      return { ok: false, reason: "invalid_evaluation" };
    }
    if (observed.interpretationCalls > 1 || observed.executorCalls > 1 || observed.receiptReadsLifetime > 24 ||
      (observed.knowledge === "not_dispatched" && (observed.executorCalls !== 0 || observed.observedCommittedEffects !== 0)) ||
      (observed.knowledge !== "not_dispatched" && observed.executorCalls !== 1) ||
      (observed.knowledge === "unresolved" && observed.observedCommittedEffects !== null) ||
      (observed.knowledge === "committed" && observed.observedCommittedEffects === null)) return { ok: false, reason: "invalid_evaluation" };
    const receiptReadWindows: { token: string; reads: number }[] = [];
    for (const window of observed.receiptReadWindows) {
      if (!dataRecord(window) || !exactKeys(window, ["token", "reads"]) || !validPingId(window.token) || !count(window.reads) ||
        window.reads > 3 || receiptReadWindows.some((previous) => previous.token === window.token)) return { ok: false, reason: "invalid_evaluation" };
      receiptReadWindows.push({ token: window.token, reads: window.reads });
    }
    if (receiptReadWindows.reduce((sum, window) => sum + window.reads, 0) !== observed.receiptReadsLifetime ||
      (observed.executorCalls === 0 && observed.receiptReadsLifetime !== 0)) return { ok: false, reason: "invalid_evaluation" };
    const stages: { name: PingStage; atMs: number }[] = [];
    let previousIndex = -1; let previousTime = -1;
    for (const stage of observed.stages) {
      if (!dataRecord(stage) || !exactKeys(stage, ["name", "atMs"]) || !count(stage.atMs)) return { ok: false, reason: "invalid_evaluation" };
      const index = PING_STAGES.indexOf(stage.name as PingStage);
      if (index <= previousIndex || stage.atMs < previousTime) return { ok: false, reason: "invalid_evaluation" };
      stages.push({ name: stage.name as PingStage, atMs: stage.atMs }); previousIndex = index; previousTime = stage.atMs;
    }
    const expected = outcome(label.expected, capture);
    if (expected.kind === "invalid") return { ok: false, reason: "invalid_evaluation" };
    const interpreted = outcome(actual, capture);
    const observation = { ...observed, stages, receiptReadWindows } as unknown as PingEvaluationObservation;
    const start = stages.find((stage) => stage.name === "capture_ready");
    const end = stages.find((stage) => stage.name === "visible_readback");
    const speechEnd = stages.find((stage) => stage.name === "speech_end");
    const finish = stages.find((stage) => stage.name === "finish");
    if ((stages.some((stage) => stage.name === "dispatch") && observed.executorCalls !== 1) ||
      (stages.some((stage) => stage.name === "receipt_confirmed" || stage.name === "visible_readback") && observed.knowledge !== "committed")) {
      return { ok: false, reason: "invalid_evaluation" };
    }
    return freeze({ ok: true, wholePlanMatch: interpreted.kind === expected.kind && canonicalIdentity(interpreted.canonical) === canonicalIdentity(expected.canonical),
      expectedOutcome: expected.kind, actualOutcome: interpreted.kind, observation,
      captureToVisibleMs: start && end ? end.atMs - start.atMs : null,
      speechEndToVisibleMs: speechEnd && end ? end.atMs - speechEnd.atMs : null,
      finishToVisibleMs: finish && end ? end.atMs - finish.atMs : null,
      metricMeaning: observed.timingSource === "synthetic" ? "synthetic_timeline_only" : "measured_observation_only" });
  } catch { return { ok: false, reason: "invalid_evaluation" }; }
}
