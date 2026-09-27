import test from "node:test";
import assert from "node:assert/strict";
import { reconcileRun } from "./result-reconciliation.mjs";

const manifest = { measuredDurationSeconds: 60, acceptanceTargets: { "task.mutate": 800, "chat.send": 800 } };
const expectedOperations = [
  { id: "task-1", journey: "task.mutate", expectedOutcome: "write", projectId: "project-a" },
  { id: "chat-1", journey: "chat.send", expectedOutcome: "write", projectId: "project-a" },
];
const observations = [
  { logicalOperationId: "task-1", attemptId: "task-1/1", attemptNumber: 1, journey: "task.mutate", phase: "measured", latencyMs: 120, response: { statusCode: 200, valid: true, success: true }, acknowledged: true, scopeAuthorized: true, actualProjectIds: ["project-a"], unauthorizedContent: false, effectIds: ["effect-task-1"] },
  { logicalOperationId: "chat-1", attemptId: "chat-1/1", attemptNumber: 1, journey: "chat.send", phase: "measured", latencyMs: 200, response: { statusCode: 200, valid: true, success: true }, acknowledged: true, scopeAuthorized: true, actualProjectIds: ["project-a"], unauthorizedContent: false, effectIds: ["effect-chat-1"] },
];

test("reconciles healthy writes with latency, throughput and sample counts", () => {
  const result = reconcileRun({ manifest, observations, expectedOperations });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.equal(result.counts.acknowledgedOperations, 2);
  assert.equal(result.offeredRequests, 2);
  assert.equal(result.achievedRequests, 2);
  assert.equal(result.sampleCounts["task.mutate"], 1);
  assert.equal(result.byJourney["chat.send"].p95Ms, 200);
});

test("fails a dropped scheduled slot even when expected operations cover only started work", () => {
  const result = reconcileRun({ manifest, observations, expectedOperations, scheduledRequestCount: 3 });
  assert.equal(result.ok, false);
  assert.equal(result.offeredRequests, 3);
  assert.equal(result.startedAttempts, 2);
  assert.equal(result.achievedRequests, 2);
  assert.equal(result.counts.unmaterializedScheduledRequests, 1);
  assert.ok(result.findings.some((finding) => finding.code === "SCHEDULE_MISMATCH"));
});

test("keeps scheduled logical operations separate from multiple retry attempts", () => {
  const retried = [
    { ...observations[0], attemptId: "task-1/1", attemptNumber: 1 },
    { ...observations[0], attemptId: "task-1/2", attemptNumber: 2 },
  ];
  const result = reconcileRun({ manifest, observations: retried, expectedOperations: [expectedOperations[0]], scheduledRequestCount: 1 });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.equal(result.offeredRequests, 1);
  assert.equal(result.startedAttempts, 2);
  assert.equal(result.counts.expectedLogicalOperations, 1);
  assert.equal(result.counts.acknowledgedOperations, 1);
  assert.equal(result.counts.unmaterializedScheduledRequests, 0);
  assert.ok(!result.findings.some((finding) => finding.code === "SCHEDULE_MISMATCH"));
});

test("detects a lost acknowledged write and duplicate effect despite a successful HTTP result", () => {
  const corrupted = structuredClone(observations);
  corrupted[0].effectIds = [];
  corrupted[1].effectIds = ["effect-chat-1", "effect-chat-duplicate"];
  const result = reconcileRun({ manifest, observations: corrupted, expectedOperations });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.code === "ACKNOWLEDGED_WRITE_LOST"));
  assert.ok(result.findings.some((finding) => finding.code === "DUPLICATE_LOGICAL_EFFECT"));
});

test("detects forbidden scope, malformed responses and a latency breach", () => {
  const corrupted = structuredClone(observations);
  corrupted[0].actualProjectIds = ["project-b"];
  corrupted[1].response = { statusCode: 200, valid: true, success: true, errorEnvelope: true };
  corrupted[1].latencyMs = 900;
  const result = reconcileRun({ manifest, observations: corrupted, expectedOperations });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.code === "FORBIDDEN_SCOPE_EFFECT"));
  assert.ok(result.findings.some((finding) => finding.code === "MALFORMED_RESPONSE"));
  assert.ok(result.findings.some((finding) => finding.code === "LATENCY_BREACH"));
});

test("accepts an expected 403 denial only when it returns no content or effect", () => {
  const expected = [{ id: "deny-1", journey: "chat.send", expectedOutcome: "denied", projectId: "project-a" }];
  const denial = [{ logicalOperationId: "deny-1", attemptId: "deny-1/1", attemptNumber: 1, journey: "chat.send", phase: "measured", latencyMs: 80, response: { statusCode: 403, valid: true, success: false }, acknowledged: false, scopeAuthorized: false, actualProjectIds: [], unauthorizedContent: false, effectIds: [] }];
  assert.equal(reconcileRun({ manifest, observations: denial, expectedOperations: expected }).ok, true);
  denial[0].effectIds = ["forbidden-effect"];
  const result = reconcileRun({ manifest, observations: denial, expectedOperations: expected });
  assert.ok(result.findings.some((finding) => finding.code === "UNEXPECTED_AUTHORIZATION_EFFECT"));
});

test("enforces latency limits for explicitly named service-level journeys", () => {
  const customManifest = { ...manifest, executionMode: "local-service", acceptanceTargets: { message_ack: 500 } };
  const expected = [{ id: "message-1", journey: "message_ack", expectedOutcome: "write", projectId: "project-a" }];
  const sample = [{ ...observations[1], logicalOperationId: "message-1", attemptId: "message-1/1", journey: "message_ack", latencyMs: 700 }];
  const result = reconcileRun({ manifest: customManifest, observations: sample, expectedOperations: expected });
  assert.equal(result.evidenceScope, "local-service");
  assert.ok(result.findings.some((finding) => finding.code === "LATENCY_BREACH"));
});
