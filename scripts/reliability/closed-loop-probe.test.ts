import assert from "node:assert/strict";
import test from "node:test";
import { CLOSED_LOOP_PHASES, CLOSED_LOOP_REQUEST_CAP, classifyClosedLoopPollError, evaluateClosedLoopPhaseEvidence, parseHistoryResponse, requireSourceMessage, validateClosedLoopInputs, verifyHistoryScope } from "./closed-loop-probe";
import { hostedTargetHash, type HostedFixture } from "./hosted-seed";

function fixture() {
  const namespace = "reliability-closed-loop-test-1234";
  const actors = [0, 1].map((index) => ({ actorId: `actor_${index}`, clerkId: `user_fixture${index}`, actorHash: `sha256:${String(index).repeat(64)}` }));
  const data: HostedFixture = { fixtureNamespace: namespace, actors, counts: { projects: 10, tasks: 1_000, messages: 10_000, resources: 500 },
    rooms: Array.from({ length: 10 }, (_, index) => ({ projectId: `${namespace}_project_${index}`, projectName: `Synthetic project ${index}`,
      conversationId: `conversation_${index}`, audienceEpoch: 1, sourceMessageId: `message_${index}`, unusedSourceMessageIds: [] })),
    deniedProjectForObserver: `${namespace}_project_9` };
  const tasksUrl = "libsql://isolated.example";
  const manifest = { runId: "closed-loop-test-1234", fixtureNamespace: namespace, environment: { kind: "hosted-test", identity: "isolated-test" },
    expectedTargetHashes: { tasks: hostedTargetHash(tasksUrl) }, allowedOrigins: ["https://isolated.example.test"],
    testActors: actors.map((actor) => ({ actorHash: actor.actorHash })) };
  return { data, fixture: data, tasksUrl, manifest, observed: { origin: "https://isolated.example.test" } };
}

test("closed-loop input guard requires explicit authorization and exact nonproduction target identities", () => {
  const valid = fixture();
  assert.deepEqual(validateClosedLoopInputs({ ...valid, executionAuthorized: true }), { appOrigin: "https://isolated.example.test" });
  assert.throws(() => validateClosedLoopInputs({ ...valid, executionAuthorized: false }), /closed_loop_execution_not_authorized/);
  assert.throws(() => validateClosedLoopInputs({ ...valid, executionAuthorized: true, tasksUrl: "libsql://other.example" }), /closed_loop_tasks_target_mismatch/);
  assert.throws(() => validateClosedLoopInputs({ ...valid, executionAuthorized: true, observed: { origin: "https://unlisted.example" } }), /closed_loop_app_origin_not_allowlisted/);
  assert.throws(() => validateClosedLoopInputs({ ...valid, executionAuthorized: true,
    fixture: { ...valid.fixture, rooms: valid.fixture.rooms.map((room, index) => index === 2 ? { ...room, projectId: "production" } : room) } }), /closed_loop_fixture_scope_invalid/);
  assert.throws(() => validateClosedLoopInputs({ ...valid, executionAuthorized: true,
    fixture: { ...valid.fixture, actors: valid.fixture.actors.map((actor, index) => index === 0 ? { ...actor, actorHash: `sha256:${"f".repeat(64)}` } : actor) } }), /closed_loop_fixture_actor_unattested/);
  const local = { ...valid, tasksUrl: "file:///C:/test/tasks.db", manifest: { ...valid.manifest,
    environment: { kind: "authenticated-local-test", identity: "loopback-test" }, expectedTargetHashes: { tasks: hostedTargetHash("file:///C:/test/tasks.db") },
    allowedOrigins: ["http://localhost:4397"] }, observed: { origin: "http://localhost:4397" } };
  assert.deepEqual(validateClosedLoopInputs({ ...local, executionAuthorized: true }), { appOrigin: "http://localhost:4397" });
  const hostedFile = { ...valid, tasksUrl: "file:///C:/test/tasks.db", manifest: { ...valid.manifest,
    expectedTargetHashes: { tasks: hostedTargetHash("file:///C:/test/tasks.db") } } };
  assert.throws(() => validateClosedLoopInputs({ ...hostedFile, executionAuthorized: true }), /closed_loop_tasks_target_mismatch/);
});

test("closed-loop phases preserve the requested bounded scheduler schedule", () => {
  assert.deepEqual(CLOSED_LOOP_PHASES.map(({ name, durationMs, active, inactive, hidden }) => ({ name, durationMs, active: active.length, inactive: inactive.length, hidden: hidden.length })), [
    { name: "chat-only", durationMs: 30_000, active: 4, inactive: 0, hidden: 0 },
    { name: "browsing-only", durationMs: 30_000, active: 0, inactive: 4, hidden: 0 },
    { name: "hidden-only", durationMs: 10_000, active: 0, inactive: 0, hidden: 2 },
    { name: "mixed", durationMs: 60_000, active: 4, inactive: 4, hidden: 2 },
  ]);
  assert.equal(CLOSED_LOOP_REQUEST_CAP, 1_000);
  assert.equal(CLOSED_LOOP_PHASES.reduce((sum, phase) => sum + phase.durationMs, 0), 130_000);
});

test("history parser refuses malformed, contradictory, and duplicate message evidence", () => {
  assert.deepEqual(parseHistoryResponse(JSON.stringify({ ok: true, value: { throughChangeSeq: 3, messages: [{ id: "message-a" }] } })),
    { throughChangeSeq: 3, messages: [{ id: "message-a" }] });
  assert.throws(() => parseHistoryResponse("not-json"), /closed_loop_malformed_json/);
  assert.throws(() => parseHistoryResponse(JSON.stringify({ ok: false, code: "unauthenticated" })), /closed_loop_malformed_history_envelope/);
  assert.throws(() => parseHistoryResponse(JSON.stringify({ ok: true, value: { throughChangeSeq: 0, messages: [{ id: "same" }, { id: "same" }] } })), /closed_loop_duplicate_history_message/);
  assert.throws(() => parseHistoryResponse(JSON.stringify({ ok: true, value: { throughChangeSeq: "0", messages: [] } })), /closed_loop_malformed_history_envelope/);
});

test("phase-end abort cannot mask delayed scope validation failure", () => {
  const delayedScopeError = Object.assign(new Error("scope mismatch"), { code: "closed_loop_history_scope_mismatch" });
  assert.equal(classifyClosedLoopPollError(delayedScopeError, { signalAborted: true, responseBodyComplete: true }), "failure");
  assert.equal(classifyClosedLoopPollError(Object.assign(new Error("abort"), { code: "APPLICATION_REQUEST_ABORTED" }),
    { signalAborted: true, responseBodyComplete: false }), "cancelled");
  const evidence = evaluateClosedLoopPhaseEvidence({ visibleSessions: [0], hiddenSessions: [], achievedBySession: [0], hiddenRequests: 0, failures: 1 });
  assert.equal(evidence.ok, false);
  assert.ok(evidence.findings.includes("phase_poll_failure"));
});

test("a phase with cancelled or empty poll results cannot pass without each visible session's seeded message", () => {
  const emptyHistory = parseHistoryResponse(JSON.stringify({ ok: true, value: { throughChangeSeq: 0, messages: [] } }));
  assert.throws(() => requireSourceMessage(emptyHistory, "seeded-first-message"), /closed_loop_source_message_missing/);
  const allCancelled = evaluateClosedLoopPhaseEvidence({ visibleSessions: [0, 1], hiddenSessions: [2], achievedBySession: [0, 0, 0], hiddenRequests: 0, failures: 0 });
  assert.equal(allCancelled.ok, false);
  assert.equal(allCancelled.findings.length, 2);
  const oneSuccessfulParticipant = evaluateClosedLoopPhaseEvidence({ visibleSessions: [0, 1], hiddenSessions: [2], achievedBySession: [1, 0, 0], hiddenRequests: 0, failures: 0 });
  assert.equal(oneSuccessfulParticipant.ok, false);
  assert.ok(requireSourceMessage(parseHistoryResponse(JSON.stringify({ ok: true, value: { throughChangeSeq: 1, messages: [{ id: "seeded-first-message" }] } })), "seeded-first-message"));
});

test("history scope readback rejects missing or cross-project persisted IDs", async () => {
  const value = parseHistoryResponse(JSON.stringify({ ok: true, value: { throughChangeSeq: 1, messages: [{ id: "m1" }, { id: "m2" }] } }));
  const matchingClient = { execute: async ({ sql, args }: { sql: string; args: string[] }) => {
    assert.match(sql, /SELECT id,workspace_id,conversation_id FROM conversation_messages WHERE id IN/);
    assert.deepEqual(args, ["m1", "m2"]);
    return { rows: args.map((id) => ({ id, workspace_id: "project-a", conversation_id: "conversation-a" })) };
  } };
  assert.equal(await verifyHistoryScope(matchingClient as never, value, "project-a", "conversation-a"), 2);
  const crossedClient = { execute: async () => ({ rows: [{ id: "m1", workspace_id: "project-a", conversation_id: "conversation-a" },
    { id: "m2", workspace_id: "project-b", conversation_id: "conversation-a" }] }) };
  await assert.rejects(() => verifyHistoryScope(crossedClient as never, value, "project-a", "conversation-a"), /closed_loop_history_scope_mismatch/);
  const missingClient = { execute: async () => ({ rows: [{ id: "m1", workspace_id: "project-a", conversation_id: "conversation-a" }] }) };
  await assert.rejects(() => verifyHistoryScope(missingClient as never, value, "project-a", "conversation-a"), /closed_loop_history_id_missing_from_database/);
});
