import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePingWholePlan } from "./evaluation";
import { normalizePingCapture } from "./proposal";
import { syntheticCapture, syntheticPlan } from "./input-test-fixture";

const capture = normalizePingCapture(syntheticCapture())!;
const label = () => ({ id: "independent-compound", source: "independent_fixture", expected: syntheticPlan() });
const observation = () => ({ interpretationCalls: 1, executorCalls: 0, receiptReadsLifetime: 0, receiptReadWindows: [], observedCommittedEffects: 0,
  knowledge: "not_dispatched", timingSource: "synthetic", stages: [] });
test("whole-plan evaluation rejects missing or invented clauses even when remaining operation normalizes", () => {
  const exact = evaluatePingWholePlan(label(), syntheticPlan(), capture, observation()); assert.ok(exact.ok);
  assert.equal(exact.wholePlanMatch, true); assert.equal(exact.captureToVisibleMs, null); assert.equal(exact.metricMeaning, "synthetic_timeline_only");
  for (const effects of [{ selfAssignment: "add" }, { ...syntheticPlan().operation.effects, selfAssignment: "remove" },
    { ...syntheticPlan().operation.effects, dueDate: null }]) {
    const result = evaluatePingWholePlan(label(), { ...syntheticPlan(), operation: { kind: "edit_selected", effects } }, capture, observation());
    assert.ok(result.ok); assert.equal(result.wholePlanMatch, false);
  }
  const malformed = evaluatePingWholePlan(label(), { ...syntheticPlan(), actorId: "model" }, capture, observation());
  assert.ok(malformed.ok); assert.equal(malformed.actualOutcome, "invalid"); assert.equal(malformed.wholePlanMatch, false);
});

test("unsupported mixed label cannot accept a supported prefix; clarification and refusal are different", () => {
  const refusal = { version: "ping.proposal.v1", outcome: "refusal", reason: "unsupported" };
  const expected = { ...label(), expected: refusal };
  for (const actual of [syntheticPlan(), { ...refusal, outcome: "clarification" }]) {
    const result = evaluatePingWholePlan(expected, actual, capture, observation()); assert.ok(result.ok); assert.equal(result.wholePlanMatch, false);
  }
  const result = evaluatePingWholePlan(expected, refusal, capture, observation()); assert.ok(result.ok); assert.equal(result.wholePlanMatch, true);
});

test("unresolved client knowledge and independent private-store effects remain separate; absent is not zero", () => {
  const unresolved = { ...observation(), executorCalls: 1, receiptReadsLifetime: 3, receiptReadWindows: [{ token: "window-one", reads: 3 }], observedCommittedEffects: null, knowledge: "unresolved" };
  const result = evaluatePingWholePlan(label(), syntheticPlan(), capture, unresolved); assert.ok(result.ok);
  assert.equal(result.observation.observedCommittedEffects, null); assert.equal(result.observation.knowledge, "unresolved");
  const privateStore = evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...unresolved, observedCommittedEffects: 3 });
  assert.equal(privateStore.ok, false);
  assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...unresolved, knowledge: "not_dispatched" }).ok, false);
  assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...unresolved, knowledge: "committed" }).ok, false);
});

test("synthetic stage durations are never live latency; no visible readback means no end-to-end value", () => {
  const committed = { ...observation(), executorCalls: 1, observedCommittedEffects: 1, knowledge: "committed", stages: [
    { name: "capture_ready", atMs: 0 }, { name: "speech_end", atMs: 80 }, { name: "finish", atMs: 100 }, { name: "dispatch", atMs: 200 },
    { name: "receipt_confirmed", atMs: 300 }] };
  const partial = evaluatePingWholePlan(label(), syntheticPlan(), capture, committed); assert.ok(partial.ok); assert.equal(partial.captureToVisibleMs, null);
  const full = evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...committed, stages: [...committed.stages, { name: "visible_readback", atMs: 500 }] });
  assert.ok(full.ok); assert.equal(full.captureToVisibleMs, 500); assert.equal(full.speechEndToVisibleMs, 420);
  assert.equal(full.finishToVisibleMs, 400); assert.equal(full.metricMeaning, "synthetic_timeline_only");
  for (const stages of [[{ name: "finish", atMs: 10 }, { name: "capture_ready", atMs: 11 }],
    [{ name: "finish", atMs: 10 }, { name: "finish", atMs: 11 }], [{ name: "finish", atMs: Number.NaN }],
    [{ name: "finish", atMs: 10 }, { name: "dispatch", atMs: 9 }]]) {
    assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...committed, stages }).ok, false);
  }
});

test("invalid label, inconsistent counters, fabricated visible completion and unknown fields reject", () => {
  assert.equal(evaluatePingWholePlan({ ...label(), source: "model_generated" }, syntheticPlan(), capture, observation()).ok, false);
  assert.equal(evaluatePingWholePlan({ ...label(), expected: { ...syntheticPlan(), extra: true } }, syntheticPlan(), capture, observation()).ok, false);
  for (const change of [{ interpretationCalls: 2 }, { executorCalls: 2 }, { receiptReadsLifetime: 4 }, { executorCalls: -1 },
    { observedCommittedEffects: null }, { throughput: 100 }, { stages: [{ name: "visible_readback", atMs: 50 }] }]) {
    assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...observation(), ...change }).ok, false);
  }
});

test("manual receipt windows validate separate lifetime total and per-window budget; huge arrays reject before allocation", () => {
  const observed = { ...observation(), executorCalls: 1, knowledge: "unresolved", observedCommittedEffects: null,
    receiptReadsLifetime: 6, receiptReadWindows: [{ token: "automatic", reads: 3 }, { token: "manual", reads: 3 }] };
  assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, observed).ok, true);
  for (const receiptReadWindows of [[{ token: "only", reads: 6 }], [{ token: "same", reads: 3 }, { token: "same", reads: 3 }],
    [{ token: "one", reads: 1 }], new Array(0xffffffff)]) {
    assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...observed, receiptReadWindows }).ok, false);
  }
  assert.equal(evaluatePingWholePlan(label(), syntheticPlan(), capture, { ...observed, stages: new Array(0xffffffff) }).ok, false);
});
