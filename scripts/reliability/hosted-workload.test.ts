import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boundedResponseText, committedEffectMatchesScope, dryRunHostedWorkload, finalizeHostedRepetition, HostedMessageVisibility, hostedFlushDiagnostic, hostedMeasurementAttribution, hostedMeasurementAttributionFromWindows, parseHostedServerTiming, reconcileHostedEffects, runHostedArrivalSchedule, runHostedWorkload, sessionCleanupAccepted, validateHostedEnvelope, validateHostedHtml, writeHostedUnverifiedFlushDiagnostic } from "./hosted-workload";
import { hostedTargetHash, type HostedFixture } from "./hosted-seed";
import { buildMixedWorkloadSchedule, WORKLOAD } from "./contracts/workload-schedule.mjs";

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

test("actual arrival loop reanchors all 3 windows after slow drain and 3s/15s flushes", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const lastFirstSlotId = schedule.events.filter((event) => event.repetition === 1).at(-1)?.logicalOperationId;
  let now = 0;
  let releaseDrain: (() => void) | undefined;
  let drainScheduled = false;
  const offered: Array<{ id: string; repetition: number; phase: string; at: number }> = [];
  const result = await runHostedArrivalSchedule({ events: schedule.events, startedAt: 0, now: () => now,
    sleep: async (ms) => {
      now += ms;
      if (now >= duration && releaseDrain && !drainScheduled) {
        drainScheduled = true;
        setImmediate(() => { now += 4_000; releaseDrain?.(); });
      }
    },
    perform: async (slot) => {
      offered.push({ id: slot.logicalOperationId, repetition: slot.repetition, phase: slot.phase, at: now });
      if (slot.logicalOperationId === lastFirstSlotId) await new Promise<void>((resolve) => { releaseDrain = resolve; });
    },
    flush: async (repetition) => { now += repetition === 1 ? 3_000 : 15_000; return { ok: true, findings: [] }; },
    isFatal: () => false });
  assert.equal(result.droppedIterations, 0);
  assert.equal(offered.length, schedule.events.length);
  assert.deepEqual(offered.map((event) => event.id), schedule.events.map((event) => event.logicalOperationId));
  for (const repetition of [1, 2, 3]) {
    const expected = schedule.events.filter((event) => event.repetition === repetition);
    const actual = offered.filter((event) => event.repetition === repetition);
    assert.deepEqual(actual.map((event) => event.phase), expected.map((event) => event.phase));
    assert.ok(actual.every((event, index) => event.at === result.windows[repetition - 1].startedAtMs +
      expected[index].atMs - (repetition - 1) * duration));
    assert.equal(result.windows[repetition - 1].activeEndedAtMs - result.windows[repetition - 1].startedAtMs, duration);
  }
  assert.equal(result.windows[1].startedAtMs, duration + 7_000);
  assert.equal(result.windows[2].startedAtMs, 2 * duration + 22_000);
  assert.equal(result.windows[0].boundary!.drainFinishedAtMs - result.windows[0].boundary!.drainStartedAtMs, 4_000);
  const attribution = hostedMeasurementAttributionFromWindows(now, result.windows,
    { finalDrainMs: result.finalDrainMs, finalReconciliationMs: 0, sessionCleanupMs: 0 });
  assert.deepEqual(attribution.reachedWindowMs, { warmup: 900_000, measured: 3_600_000, total: 4_500_000 });
  assert.equal(attribution.boundaryPausedMs, 22_000);
  assert.equal(attribution.overrunMs, 0);
  assert.deepEqual(attribution.scheduledActiveSessionHours, { warmup: 2, measured: 8 });
});

test("arrival deadlines recheck an early waking timer and do not burst after a >60s flush", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const events = schedule.events.filter((slot) => slot.repetition <= 2 && slot.atMs % 60_000 < 2_000);
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  let now = 0; let earlyWakes = 0;
  const offered: Array<{ repetition: number; localAt: number; actualAt: number }> = [];
  const result = await runHostedArrivalSchedule({ events, startedAt: 0, now: () => now,
    sleep: async (ms) => { if (earlyWakes++ < 3) now += Math.max(1, Math.floor(ms / 2)); else now += ms; },
    perform: async (slot) => { offered.push({ repetition: slot.repetition,
      localAt: slot.atMs - (slot.repetition - 1) * duration, actualAt: now }); },
    flush: async () => { now += 65_000; return { ok: true, findings: [] }; }, isFatal: () => false });
  assert.equal(result.droppedIterations, 0);
  assert.equal(offered.length, events.length);
  assert.equal(result.windows[1].startedAtMs, duration + 65_000);
  assert.ok(offered.every((slot) => slot.actualAt >= result.windows[slot.repetition - 1].startedAtMs + slot.localAt));
  assert.equal(result.windows[0].boundary?.nextAnchorAtMs, duration + 65_000);
});

test("the final window remains a full 25 minutes while a long final drain stays outside active hours", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const finalSlot = schedule.events.filter((slot) => slot.repetition === 1).at(-1)!;
  let now = 0;
  let releaseDrain: (() => void) | undefined;
  let scheduled = false;
  const result = await runHostedArrivalSchedule({ events: [finalSlot], startedAt: 0, now: () => now,
    sleep: async (ms) => {
      now += ms;
      if (now >= duration && releaseDrain && !scheduled) {
        scheduled = true;
        setImmediate(() => { now += 8_000; releaseDrain?.(); });
      }
    },
    perform: async () => new Promise<void>((resolve) => { releaseDrain = resolve; }),
    flush: async () => { throw new Error("no_boundary_expected"); }, isFatal: () => false });
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].activeEndedAtMs, duration);
  assert.equal(result.finalDrainMs, 8_000);
  const attribution = hostedMeasurementAttributionFromWindows(now, result.windows,
    { finalDrainMs: result.finalDrainMs, finalReconciliationMs: 0, sessionCleanupMs: 0 });
  assert.deepEqual(attribution.reachedWindowMs, { warmup: 300_000, measured: 1_200_000, total: duration });
  assert.equal(attribution.finalDrainMs, 8_000);
  assert.equal(attribution.overrunMs, 0);
});

test("aborted windows count only reached phases, and final drain/reconciliation/cleanup remain separate", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  for (const abortAt of [120_000, WORKLOAD.warmupMs + 120_000]) {
    let now = 0; let fatal = false;
    const result = await runHostedArrivalSchedule({ events: schedule.events, startedAt: 0, now: () => now,
      sleep: async (ms) => { now += ms; },
      perform: async (slot) => { if (slot.repetition === 2 && slot.atMs - duration >= abortAt) fatal = true; },
      flush: async () => { now += 3_000; return { ok: true, findings: [] }; }, isFatal: () => fatal });
    assert.equal(result.windows.length, 2);
    assert.equal(result.boundaryFailure, null);
    const attribution = hostedMeasurementAttributionFromWindows(now + 9_000, result.windows,
      { finalDrainMs: 2_000, finalReconciliationMs: 3_000, sessionCleanupMs: 4_000 });
    assert.equal(attribution.reachedWindowMs.warmup, WORKLOAD.warmupMs + Math.min(abortAt, WORKLOAD.warmupMs));
    assert.equal(attribution.reachedWindowMs.measured, WORKLOAD.measuredMs + Math.max(0, abortAt - WORKLOAD.warmupMs));
    assert.equal(attribution.boundaryPausedMs, 3_000);
    assert.equal(attribution.finalDrainMs, 2_000);
    assert.equal(attribution.finalReconciliationMs, 3_000);
    assert.equal(attribution.sessionCleanupMs, 4_000);
  }
});

test("failed or thrown boundary flush never anchors the next repetition", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const events = schedule.events.filter((slot) => slot.repetition <= 2 && slot.atMs % 60_000 < 2_000);
  for (const throws of [false, true]) {
    let now = 0; let flushes = 0; let secondOffered = 0;
    const run = runHostedArrivalSchedule({ events, startedAt: 0, now: () => now,
      sleep: async (ms) => { now += ms; }, perform: async (slot) => { if (slot.repetition === 2) secondOffered++; },
      flush: async () => { flushes++; if (throws) throw new Error("synthetic_flush_failure");
        return { ok: false, findings: [{ code: "SCHEDULE_MISMATCH", detail: "synthetic" }] }; }, isFatal: () => false });
    const result = await run;
    assert.equal(result.windows.length, 1);
    assert.deepEqual(result.boundaryFailure?.reconciliation.findings.map((finding) => finding.code),
      [throws ? "BOUNDARY_FLUSH_FAILED" : "SCHEDULE_MISMATCH"]);
    assert.equal(result.boundaryFailure?.kind, throws ? "flush_threw" : "reconciliation_failed");
    assert.equal(result.windows[0].boundary?.nextAnchorAtMs, undefined);
    if (throws) {
      assert.equal(result.windows[0].boundary?.flushFailedAtMs, duration);
      const directory = await mkdtemp(join(tmpdir(), "hosted-boundary-unverified-"));
      try {
        const diagnostic = { repetition: 1, complete: false, verification: "unverified", failureCode: "BOUNDARY_FLUSH_FAILED",
          windowTiming: result.windows[0], observations: [{ logicalOperationId: "1:owned-synthetic-operation", acknowledged: true }] };
        await writeHostedUnverifiedFlushDiagnostic(directory, 1, "boundary", diagnostic);
        const first = await readFile(join(directory, "run-1-boundary-failure.json"), "utf8");
        assert.deepEqual(JSON.parse(first), diagnostic);
        await assert.rejects(writeHostedUnverifiedFlushDiagnostic(directory, 1, "boundary", { rawError: "must-not-overwrite" }), /EEXIST/);
        assert.equal(await readFile(join(directory, "run-1-boundary-failure.json"), "utf8"), first);
        await writeHostedUnverifiedFlushDiagnostic(directory, 3, "final", diagnostic);
        assert.deepEqual(JSON.parse(await readFile(join(directory, "run-3-final-failure.json"), "utf8")), diagnostic);
      } finally { await rm(directory, { recursive: true, force: true }); }
    }
    assert.equal(flushes, 1);
    assert.equal(secondOffered, 0);
  }
});

test("a fatal result during an otherwise successful flush retains run receipt and no next anchor", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const events = schedule.events.filter((slot) => slot.repetition <= 2 && slot.atMs % 60_000 < 2_000);
  let now = 0; let fatal = false; let flushes = 0; let secondOffered = 0;
  const result = await runHostedArrivalSchedule({ events, startedAt: 0, now: () => now,
    sleep: async (ms) => { now += ms; }, perform: async (slot) => { if (slot.repetition === 2) secondOffered++; },
    flush: async () => { flushes++; now += 3_000; fatal = true; return { ok: true, findings: [] }; }, isFatal: () => fatal });
  assert.equal(flushes, 1);
  assert.equal(secondOffered, 0);
  assert.equal(result.repetition, 1);
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].boundary?.nextAnchorAtMs, undefined);
  assert.equal(result.boundaryFailure?.kind, "fatal_after_flush");
  assert.deepEqual(result.boundaryFailure?.reconciliation.findings.map((finding) => finding.code), ["FATAL_WORKLOAD_ABORT"]);
  const finalized = await finalizeHostedRepetition({ repetition: result.repetition, fatal,
    droppedIterations: result.droppedIterations, boundaryFailure: result.boundaryFailure,
    flush: async () => { flushes++; throw new Error("duplicate_flush"); } });
  assert.equal(flushes, 1);
  assert.deepEqual(finalized.failure?.codes, ["FATAL_WORKLOAD_ABORT", "REPETITIONS_INCOMPLETE"]);
});

test("fatal result arriving during boundary drain does not start or flush the next window", async () => {
  const schedule = buildMixedWorkloadSchedule();
  const duration = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const lastFirstSlot = schedule.events.filter((slot) => slot.repetition === 1).at(-1)!;
  const firstSecondSlot = schedule.events.find((slot) => slot.repetition === 2)!;
  let now = 0; let fatal = false; let release: (() => void) | undefined; let scheduled = false;
  let flushes = 0; let secondOffered = 0;
  const result = await runHostedArrivalSchedule({ events: [lastFirstSlot, firstSecondSlot], startedAt: 0,
    now: () => now, sleep: async (ms) => {
      now += ms;
      if (now >= duration && release && !scheduled) {
        scheduled = true;
        setImmediate(() => { now += 4_000; fatal = true; release?.(); });
      }
    },
    perform: async (slot) => {
      if (slot.repetition === 2) secondOffered++;
      if (slot.logicalOperationId === lastFirstSlot.logicalOperationId)
        await new Promise<void>((resolve) => { release = resolve; });
    },
    flush: async () => { flushes++; return { ok: true, findings: [] }; }, isFatal: () => fatal });
  assert.equal(flushes, 0);
  assert.equal(secondOffered, 0);
  assert.equal(result.repetition, 1);
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].activeEndedAtMs, duration);
  assert.equal(result.windows[0].boundary?.drainFinishedAtMs, duration + 4_000);
  assert.equal(result.windows[0].boundary?.flushStartedAtMs, undefined);
  const finalizedAt = now;
  const finalized = await finalizeHostedRepetition({ repetition: result.repetition, fatal,
    droppedIterations: result.droppedIterations, boundaryFailure: result.boundaryFailure,
    flush: async (repetition, complete) => {
      assert.equal(repetition, 1); assert.equal(complete, false);
      now += 3_000; // One final reconciliation after the aborted boundary drain.
      return { ok: false, findings: [{ code: "FATAL_WORKLOAD_ABORT", detail: "synthetic" }] };
    } });
  assert.equal(finalized.failure?.codes.includes("FATAL_WORKLOAD_ABORT"), true);
  const attribution = hostedMeasurementAttributionFromWindows(now, result.windows,
    { finalDrainMs: result.finalDrainMs, finalReconciliationMs: now - finalizedAt, sessionCleanupMs: 0 });
  assert.equal(attribution.boundaryPausedMs, 4_000);
  assert.equal(attribution.finalReconciliationMs, 3_000);
  assert.equal(attribution.observedElapsedMs, duration + 7_000);
  assert.equal(attribution.overrunMs, 0);
});

test("flush diagnostics contain only fixed phase and cause categories", () => {
  assert.deepEqual(hostedFlushDiagnostic({ code: "ETIMEDOUT", message: "private-url" }, "receipt_reconciliation"),
    { phase: "receipt_reconciliation", causeCategory: "timeout" });
  assert.deepEqual(hostedFlushDiagnostic({ code: "ECONNRESET", message: "secret-token" }, "receipt_reconciliation"),
    { phase: "receipt_reconciliation", causeCategory: "transport" });
  assert.deepEqual(hostedFlushDiagnostic({ code: "ENOSPC", path: "private-file" }, "receipt_persistence"),
    { phase: "receipt_persistence", causeCategory: "filesystem" });
  assert.deepEqual(hostedFlushDiagnostic(new TypeError("private-content"), "metric_computation"),
    { phase: "metric_computation", causeCategory: "contract" });
  assert.deepEqual(hostedFlushDiagnostic(new Error("opaque private error")),
    { phase: "unclassified", causeCategory: "unclassified" });
  assert.doesNotMatch(JSON.stringify(hostedFlushDiagnostic({ code: "ETIMEDOUT", message: "secret-token" })), /secret|token/);
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

test("actual visibility tracker joins committed history that beats sender effect readback", async () => {
  const tracker = new HostedMessageVisibility();
  const scope = { projectId: "owned-project", conversationId: "owned-room" };
  const row = { id: "committed-message", workspace_id: scope.projectId, conversation_id: scope.conversationId,
    client_request_id: "owned-request", author_id: "writer-id" };
  tracker.beginSend("owned-request", { actorHash: "writer", actorId: "writer-id", began: 10, repetition: 1, measured: true });
  let releaseReadback: (() => void) | undefined;
  const readback = new Promise<void>((resolve) => { releaseReadback = resolve; });
  const sender = (async () => { await readback; tracker.confirmSend("owned-request", row.id, 30, scope); })();
  let lookupCalls = 0;
  const first = await tracker.observeHistory([row.id], "observer", 20, scope, async (ids) => {
    lookupCalls++; assert.deepEqual(ids, [row.id]); return [row];
  });
  assert.deepEqual(first, { actualProjectIds: [scope.projectId], scopeAuthorized: true, unauthorizedContent: false });
  assert.equal(tracker.pendingVisibility.size, 0);
  // A second observer sees a known ID before sender readback. Keep the first sighting.
  await tracker.observeHistory([row.id], "other-observer", 25, scope, async () => { throw new Error("duplicate_lookup"); });
  await tracker.observeHistory([row.id], "writer", 26, scope, async () => { throw new Error("duplicate_lookup"); });
  releaseReadback?.();
  await sender;
  assert.equal(lookupCalls, 1);
  assert.equal(tracker.pendingVisibility.size, 0);
  assert.deepEqual(tracker.visibilitySamples, [{ repetition: 1, initiationMs: 10, postAckMs: 0, priorToAck: true }]);
});

test("history lookup completing after sender readback consumes pending at original body time", async () => {
  const tracker = new HostedMessageVisibility();
  const scope = { projectId: "owned-project", conversationId: "owned-room" };
  const row = { id: "message", workspace_id: scope.projectId, conversation_id: scope.conversationId,
    client_request_id: "request", author_id: "writer-id" };
  tracker.beginSend("request", { actorHash: "writer", actorId: "writer-id", began: 10, repetition: 2, measured: true });
  let releaseLookup: ((rows: typeof row[]) => void) | undefined;
  const lookup = new Promise<typeof row[]>((resolve) => { releaseLookup = resolve; });
  const observer = tracker.observeHistory([row.id], "observer", 18, scope, () => lookup);
  tracker.confirmSend("request", row.id, 20, scope);
  assert.equal(tracker.pendingVisibility.size, 1);
  releaseLookup?.([row]);
  assert.equal((await observer).scopeAuthorized, true);
  assert.equal(tracker.pendingVisibility.size, 0);
  assert.deepEqual(tracker.visibilitySamples, [{ repetition: 2, initiationMs: 8, postAckMs: 0, priorToAck: true }]);
});

test("earlier validated body revises a later finalized visibility sample after delayed lookup", async () => {
  const tracker = new HostedMessageVisibility();
  const scope = { projectId: "owned-project", conversationId: "owned-room" };
  const row = { id: "message", workspace_id: scope.projectId, conversation_id: scope.conversationId,
    client_request_id: "request", author_id: "writer-id" };
  tracker.beginSend("request", { actorHash: "writer", actorId: "writer-id", began: 10, repetition: 2, measured: true });
  let releaseLookup: ((rows: typeof row[]) => void) | undefined;
  const lookup = new Promise<typeof row[]>((resolve) => { releaseLookup = resolve; });
  const earlier = tracker.observeHistory([row.id], "observer", 18, scope, () => lookup);
  tracker.confirmSend("request", row.id, 20, scope);
  await tracker.observeHistory([row.id], "other-observer", 25, scope, async () => { throw new Error("duplicate_lookup"); });
  assert.deepEqual(tracker.visibilitySamples, [{ repetition: 2, initiationMs: 15, postAckMs: 5, priorToAck: false }]);
  releaseLookup?.([row]);
  assert.equal((await earlier).scopeAuthorized, true);
  assert.equal(tracker.pendingVisibility.size, 0);
  assert.deepEqual(tracker.visibilitySamples, [{ repetition: 2, initiationMs: 8, postAckMs: 0, priorToAck: true }]);
});

test("same actor and pre-initiation sightings never satisfy different-actor visibility", async () => {
  const tracker = new HostedMessageVisibility();
  const scope = { projectId: "owned-project", conversationId: "owned-room" };
  const row = { id: "message", workspace_id: scope.projectId, conversation_id: scope.conversationId,
    client_request_id: "request", author_id: "writer-id" };
  tracker.beginSend("request", { actorHash: "writer", actorId: "writer-id", began: 10, repetition: 1, measured: true });
  await tracker.observeHistory([row.id], "writer", 15, scope, async () => [row]);
  await tracker.observeHistory([row.id], "observer", 5, scope, async () => { throw new Error("duplicate_lookup"); });
  tracker.confirmSend("request", row.id, 20, scope);
  assert.equal(tracker.visibilitySamples.length, 0);
  assert.equal(tracker.pendingVisibility.size, 1);
  await tracker.observeHistory([row.id], "observer", 25, scope, async () => { throw new Error("duplicate_lookup"); });
  assert.deepEqual(tracker.visibilitySamples, [{ repetition: 1, initiationMs: 15, postAckMs: 5, priorToAck: false }]);
});

test("foreign history IDs fail scope; missing or failed DB lookup is unverified, not fabricated cross-scope", async () => {
  const scope = { projectId: "owned-project", conversationId: "owned-room" };
  const foreign = new HostedMessageVisibility();
  const result = await foreign.observeHistory(["foreign"], "observer", 10, scope, async () => [{ id: "foreign",
    workspace_id: "foreign-project", conversation_id: "foreign-room", client_request_id: "foreign-request", author_id: "foreign-writer" }]);
  assert.deepEqual(result, { actualProjectIds: ["foreign-project"], scopeAuthorized: false, unauthorizedContent: true });
  assert.equal(foreign.visibilitySamples.length, 0);
  const missing = new HostedMessageVisibility();
  await assert.rejects(missing.observeHistory(["missing"], "observer", 10, scope, async () => []), /hosted_history_scope_unverified/);
  await assert.rejects(missing.observeHistory(["unknown"], "observer", 10, scope,
    async () => { throw new Error("private_database_error"); }), /hosted_history_scope_unverified/);
  assert.equal(missing.authorizedMessages.size, 0);
  assert.equal(missing.visibilitySamples.length, 0);
});

test("committed send readback requires the actual conversation as well as Project", () => {
  const scope = { projectId: "owned-project", conversationId: "owned-room" };
  assert.equal(committedEffectMatchesScope("send", [{ workspace_id: scope.projectId,
    conversation_id: scope.conversationId }], scope), true);
  assert.equal(committedEffectMatchesScope("send", [{ workspace_id: scope.projectId,
    conversation_id: "other-room" }], scope), false);
  assert.equal(committedEffectMatchesScope("send", [{ workspace_id: "other-project",
    conversation_id: scope.conversationId }], scope), false);
  assert.equal(committedEffectMatchesScope("send", [], scope), false);
  assert.equal(committedEffectMatchesScope("promote-task", [{ workspace_id: scope.projectId }], scope), true);
});

test("failed repetition boundary keeps its first receipt and exact finding through finalization", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "hosted-boundary-proof-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receiptPath = join(directory, "run-1.json");
  const boundary = { ok: false, findings: [{ code: "MESSAGE_VISIBILITY_MISSING", detail: "synthetic missing observer" }] };
  await writeFile(receiptPath, JSON.stringify({ repetition: 1, complete: true, reconciliation: boundary }), { flag: "wx" });
  let secondFlushes = 0;
  const result = await finalizeHostedRepetition({ repetition: 1, fatal: true, droppedIterations: 0,
    boundaryFailure: { repetition: 1, reconciliation: boundary },
    flush: async () => {
      secondFlushes++;
      await writeFile(receiptPath, JSON.stringify({ repetition: 1, complete: false, reconciliation: { ok: true, findings: [] } }));
      return { ok: true, findings: [] };
    } });
  assert.equal(secondFlushes, 0);
  assert.deepEqual(JSON.parse(await readFile(receiptPath, "utf8")), { repetition: 1, complete: true, reconciliation: boundary });
  assert.deepEqual(result.failure, { repetition: 1, codes: ["MESSAGE_VISIBILITY_MISSING", "REPETITIONS_INCOMPLETE"] });
});

test("last repetition flushes once and reports final findings or dropped demand", async () => {
  let flushes = 0;
  const complete = await finalizeHostedRepetition({ repetition: 3, fatal: false, droppedIterations: 0,
    boundaryFailure: null, flush: async (repetition, final) => {
      flushes++;
      assert.equal(repetition, 3);
      assert.equal(final, true);
      return { ok: true, findings: [] };
    } });
  assert.equal(flushes, 1);
  assert.equal(complete.failure, null);
  const dropped = await finalizeHostedRepetition({ repetition: 3, fatal: false, droppedIterations: 2,
    boundaryFailure: null, flush: async () => ({ ok: false, findings: [{ code: "SCHEDULE_MISMATCH", detail: "synthetic" }] }) });
  assert.deepEqual(dropped.failure, { repetition: 3, codes: ["SCHEDULE_MISMATCH", "DROPPED_ITERATIONS"] });
});
