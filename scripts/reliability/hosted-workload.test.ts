import assert from "node:assert/strict";
import test from "node:test";
import { boundedResponseText, dryRunHostedWorkload, runHostedWorkload, sessionCleanupAccepted, validateHostedEnvelope, validateHostedHtml } from "./hosted-workload";
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

test("workload acceptance requires all created sessions to be revoked", () => {
  const complete = { ok: true, attempted: 10, revoked: 10, unresolved: 0, errors: [] };
  assert.equal(sessionCleanupAccepted(complete), true);
  assert.equal(sessionCleanupAccepted({ ...complete, ok: false }), false);
  assert.equal(sessionCleanupAccepted({ ...complete, revoked: 9, unresolved: 1 }), false);
  assert.equal(sessionCleanupAccepted({ ...complete, errors: [{ code: "CLERK_REVOKE_FAILED", actorHash: "sha256:" + "0".repeat(64) }] }), false);
});
