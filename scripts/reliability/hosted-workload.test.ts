import assert from "node:assert/strict";
import test from "node:test";
import { boundedResponseText, dryRunHostedWorkload, hostedMeasurementAttribution, parseHostedServerTiming, reconcileHostedEffects, runHostedWorkload, sessionCleanupAccepted, validateHostedEnvelope, validateHostedHtml } from "./hosted-workload";
import { hostedTargetHash, type HostedFixture } from "./hosted-seed";

function fixture() {
  const namespace = "reliability-hosted-test-1234";
  const actors = [0, 1].map((index) => ({ actorId: `test_actor_${index}`, clerkId: `user_fixture${index}`, actorHash: `sha256:${String(index).repeat(64)}` }));
  const data: HostedFixture = { fixtureNamespace: namespace, actors, counts: { projects: 10, tasks: 1_000, messages: 10_000, resources: 500 },
    rooms: Array.from({ length: 10 }, (_, index) => ({ projectId: `${namespace}_project_${index}`, projectName: `Synthetic project ${index}`, conversationId: `conversation_${index}`, sourceMessageId: `message_${index}`, unusedSourceMessageIds: Array.from({ length: 400 }, (_, source) => `source_${index}_${source}`), audienceEpoch: 1 })), deniedProjectForObserver: `${namespace}_project_9` };
  const manifest = { fixtureNamespace: namespace, environment: { kind: "hosted-test", identity: "test-preview" }, expectedTargetHashes: { tasks: hostedTargetHash("libsql://isolated.example") }, testActors: actors.map((actor) => ({ actorHash: actor.actorHash })) };
  return { data, manifest };
}

test("hosted dry run emits bounded default repetitions without creating sessions or contacting a store", async () => {
  const { data, manifest } = fixture();
  let created = 0;
  const result = await runHostedWorkload({ manifest, observed: { origin: "https://isolated.example.test" }, fixture: data,
    tasksUrl: "", tasksToken: "", executionAuthorized: false, outputDirectory: "unused", createSessions: () => { created++; throw new Error("unexpected_session_creation"); } });
  assert.equal(created, 0);
  assert.equal("noNetworkRequests" in result && result.noNetworkRequests, true);
  const schedule = dryRunHostedWorkload(manifest, data).schedule;
  assert.equal(schedule.repetitions, 3);
  assert.equal(schedule.warmupMs, 300_000);
  assert.equal(schedule.measuredMs, 1_200_000);
  assert.ok(schedule.nominalRequests < 30_000);
  assert.ok(schedule.events.every((event) => !event.sessionId.startsWith("hidden")));
});

test("hosted execution rejects unattested manifest before session creation or fixture writes", async () => {
  const { data, manifest } = fixture();
  let reached = false;
  await assert.rejects(runHostedWorkload({ manifest, observed: { origin: "https://isolated.example.test" }, fixture: data,
    tasksUrl: "libsql://isolated.example", tasksToken: "synthetic-test-only", executionAuthorized: true, outputDirectory: "unused",
    createSessions: () => { reached = true; throw new Error("unreachable"); } }), /target guard rejected/);
  assert.equal(reached, false);
});

test("a 200 unavailable page or malformed API envelope never satisfies a journey", () => {
  assert.equal(validateHostedHtml("files.read", "Files · Signal Studio >Files</h1> Synthetic project 0 No project open", "Synthetic project 0"), false);
  assert.equal(validateHostedHtml("home.read", "Home · Signal Studio id=\"my-tasks\" Synthetic project 0", "Synthetic project 0"), true);
  assert.equal(validateHostedHtml("home.read", "Home · Signal Studio id=\"my-tasks\" Synthetic project 1", "Synthetic project 0"), false);
  assert.equal(validateHostedEnvelope("send", { ok: true, value: { messageId: "m1" } }), false);
  assert.equal(validateHostedEnvelope("send", { ok: false, code: "temporarily_unavailable" }), true);
  assert.equal(validateHostedEnvelope("send", { ok: false, code: "secret-sql-text" }), false);
});

test("response bodies are capped before parsing or evidence collection", async () => {
  await assert.rejects(boundedResponseText(new Response("a".repeat(20)), 10), /response_size_cap_exceeded/);
});

test("server timing keeps only named numeric durations, with no descriptions or arbitrary names", () => {
  assert.deepEqual(parseHostedServerTiming(null), { status: "absent", durationsMs: {} });
  const parsed = parseHostedServerTiming('analytics;dur=12.3;desc="private detail", total;dur=45, private_identifier;dur=99');
  assert.deepEqual(parsed, { status: "parsed", durationsMs: { analytics: 12.3, total: 45 } });
  assert.doesNotMatch(JSON.stringify(parsed), /private|detail|99/);
  assert.deepEqual(parseHostedServerTiming("total;dur=0"), { status: "parsed", durationsMs: { total: 0 } });
  assert.deepEqual(parseHostedServerTiming("unknown;dur=1"), { status: "parsed", durationsMs: {} });
});

test("malformed, ambiguous and oversized server timing metadata is rejected without echoing input", () => {
  for (const header of ["", "total", "total;dur=-1", "total;dur=NaN", "total;dur=Infinity", "total;dur=1e3",
    "total;dur=1ms", "total;dur=1;dur=2", "total;dur=1, total;dur=2", "total;dur=1\r\nprivate: detail",
    'total;dur=1;desc="unclosed', "total;dur=1," + "a".repeat(2_048), Array(33).fill("unknown;dur=1").join(",")]) {
    assert.deepEqual(parseHostedServerTiming(header), { status: "rejected", durationsMs: {} });
  }
});

test("measurement denominators separate planned, reached warmup and measured windows from overrun", () => {
  const complete = hostedMeasurementAttribution(75 * 60_000 + 123);
  assert.equal(complete.controlledIdentities, 2);
  assert.equal(complete.configuredSessions, 10);
  assert.equal(complete.scheduledActiveSessions, 8);
  assert.deepEqual(complete.plannedWindowMs, { warmup: 900_000, measured: 3_600_000, total: 4_500_000 });
  assert.deepEqual(complete.reachedWindowMs, complete.plannedWindowMs);
  assert.deepEqual(complete.scheduledActiveSessionHours, { warmup: 2, measured: 8 });
  assert.equal(complete.overrunMs, 123);
  // Stop two minutes into repetition two's warmup: never count its unrun measured phase.
  const partial = hostedMeasurementAttribution(27 * 60_000);
  assert.deepEqual(partial.reachedWindowMs, { warmup: 420_000, measured: 1_200_000, total: 1_620_000 });
  assert.equal(partial.metricScope.applicationDbOperations, "unavailable");
  assert.equal(partial.metricScope.applicationDbDurationMs, "unavailable");
  assert.equal(partial.metricScope.billedExecutionDurationMs, "unavailable");
  assert.deepEqual(hostedMeasurementAttribution(0).reachedWindowMs, { warmup: 0, measured: 0, total: 0 });
  for (const invalid of [-1, Infinity, NaN]) assert.throws(() => hostedMeasurementAttribution(invalid), /elapsed_invalid/);
});

test("workload acceptance requires all created sessions to be revoked", () => {
  const complete = { ok: true, attempted: 10, revoked: 10, unresolved: 0, errors: [] };
  assert.equal(sessionCleanupAccepted(complete), true);
  assert.equal(sessionCleanupAccepted({ ...complete, ok: false }), false);
  assert.equal(sessionCleanupAccepted({ ...complete, revoked: 9, unresolved: 1 }), false);
  assert.equal(sessionCleanupAccepted({ ...complete, attempted: 0, revoked: 0 }), false);
  assert.equal(sessionCleanupAccepted({ ...complete, errors: [{ code: "CLERK_REVOKE_FAILED", actorHash: "sha256:" + "0".repeat(64) }] }), false);
});

test("database reconciliation reports each real verification query, excluding unacknowledged operations", async () => {
  let calls = 0;
  const client = { execute: async () => { calls++; return { rows: [{ id: `effect-${calls}`, workspace_id: "synthetic-project" }] }; } };
  const observations = ["one", "two", "three"].map((id) => ({ logicalOperationId: id, acknowledged: id !== "three", effectIds: [], actualProjectIds: [] }));
  const requests = new Map(["one", "two", "three"].map((id) => [id, { actorId: "synthetic-actor", requestId: id,
    conversationId: "conversation", projectId: "synthetic-project", task: id === "two" }]));
  const counted = await reconcileHostedEffects(client as never, observations as never, requests);
  assert.equal(counted, 2);
  assert.equal(calls, 2);
  assert.deepEqual(observations[2].effectIds, []);
});
