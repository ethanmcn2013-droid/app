import assert from "node:assert/strict";
import test from "node:test";
import { syntheticCapture, syntheticPlan } from "@/lib/ping/input-test-fixture";
import { createPingOpenAiClipTranscriber } from "@/server/ping/openai-clip-transcription";
import { createPingOpenAiInterpreter } from "@/server/ping/openai-interpreter";
import { createPingPairedInertTrialRunner, type PingPairedRoute, type PingPrivateRouteReport } from "./paired-trial";

// Public literal synthetic labels only. No reserved labels, transcripts or outcome feedback.
const pcm = () => new Uint8Array([0, 0, 255, 127, 0, 128, 255, 255]);
const label = (expected: unknown = syntheticPlan()) => ({ id: "public-compound", source: "independent_fixture", expected });
const route = (id: string, actual: unknown = syntheticPlan()): PingPairedRoute => ({ id,
  transcribe: async () => ({ text: "Assign these to me, due 2026-10-07, move to doing.", usage: null }),
  interpret: async () => actual });
const options = (routes: [PingPairedRoute, PingPairedRoute] = [route("first"), route("second")]) =>
  ({ pcm: pcm(), capture: syntheticCapture(), label: label(), routes, signal: new AbortController().signal });
const deferred = <T>() => { let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
function exactInert(report: PingPrivateRouteReport, calls = 1) {
  assert.equal(report.observation.executorCalls, 0); assert.equal(report.observation.receiptReadsLifetime, 0);
  assert.deepEqual(report.observation.receiptReadWindows, []); assert.equal(report.observation.observedCommittedEffects, 0);
  assert.equal(report.observation.knowledge, "not_dispatched"); assert.equal(report.interpretationUsage, null);
  assert.equal(report.interpretationCalls, calls); assert.equal(report.observation.interpretationCalls, calls);
  if (report.evaluation?.ok) {
    assert.equal(report.evaluation.captureToVisibleMs, null); assert.equal(report.evaluation.speechEndToVisibleMs, null);
    assert.equal(report.evaluation.finishToVisibleMs, null); assert.equal(report.evaluation.metricMeaning, "measured_observation_only");
  }
}

test("two isolated byte copies and frozen oracle/context survive first-route and caller mutation", async () => {
  const input = options(), gate = deferred<unknown>(); let secondCalls = 0;
  input.routes[0] = { id: "first", transcribe: async bytes => {
    assert.deepEqual([...bytes], [0, 0, 255, 127, 0, 128, 255, 255]); bytes.fill(90);
    await gate.promise; return { text: "Whole compound input", usage: { type: "duration", seconds: 0 } };
  }, interpret: async model => {
    assert.deepEqual(Object.keys(model).sort(), ["referenceInstant", "selectedTaskCount", "systemColumnKeys", "timeZone", "transcript", "version"]);
    assert.equal(model.selectedTaskCount, 1); assert.equal(model.referenceInstant, "2026-10-06T09:00:00.000Z");
    assert.ok(Object.isFrozen(model)); assert.ok(Object.isFrozen(model.systemColumnKeys)); return syntheticPlan();
  } };
  input.routes[1] = { ...route("second"), transcribe: async bytes => {
    secondCalls++; assert.deepEqual([...bytes], [0, 0, 255, 127, 0, 128, 255, 255]);
    return { text: "Whole compound input", usage: null };
  } };
  const run = createPingPairedInertTrialRunner(), pending = run(input);
  input.pcm.fill(80); input.capture.selectedTaskIds.length = 0; input.capture.referenceInstant = "2030-01-01T00:00:00.000Z";
  (input.label.expected as ReturnType<typeof syntheticPlan>).operation.effects.selfAssignment = "remove";
  input.routes[1] = route("replacement", { malformed: true }); gate.resolve(null);
  const report = await pending;
  assert.equal(secondCalls, 1); assert.deepEqual(report.routes.map(r => r.routeId), ["first", "second"]);
  for (const result of report.routes) {
    assert.equal(result.status, "completed"); assert.equal(result.transcribeCalls, 1); exactInert(result);
    assert.ok(result.evaluation?.ok); assert.equal(result.evaluation.wholePlanMatch, true);
    assert.deepEqual(result.observation.stages.map(stage => stage.name), ["finals_ready", "interpretation_start", "interpretation_end"]);
    assert.ok(result.observation.stages.every(stage => Number.isSafeInteger(stage.atMs) && stage.atMs >= 0));
    assert.ok(Object.isFrozen(result));
  }
  assert.deepEqual(report.routes[0].transcriptionUsage, { type: "duration", seconds: 0 });
  assert.equal(report.routes[1].transcriptionUsage, null);
  assert.equal("label" in report, false); assert.equal("capture" in report, false);
});

test("whole-plan scorer preserves compound, refusal, clarification and literal/default title differences", async () => {
  const run = createPingPairedInertTrialRunner();
  for (const actual of [
    { ...syntheticPlan(), operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } },
    { ...syntheticPlan(), operation: { kind: "edit_selected", effects: { ...syntheticPlan().operation.effects, selfAssignment: "remove" } } },
    { ...syntheticPlan(), actorId: "invented" },
  ]) {
    const report = await run(options([route("exact"), route("different", actual)]));
    assert.ok(report.routes[0].evaluation?.ok); assert.equal(report.routes[0].evaluation.wholePlanMatch, true);
    assert.ok(report.routes[1].evaluation?.ok); assert.equal(report.routes[1].evaluation.wholePlanMatch, false);
  }
  const refusal = { version: "ping.proposal.v1", outcome: "refusal", reason: "unsupported" };
  const clarify = { ...refusal, outcome: "clarification" };
  const refused = await run({ ...options([route("refused", refusal), route("clarify", clarify)]), label: label(refusal) });
  assert.ok(refused.routes[0].evaluation?.ok); assert.equal(refused.routes[0].evaluation.wholePlanMatch, true);
  assert.ok(refused.routes[1].evaluation?.ok); assert.equal(refused.routes[1].evaluation.wholePlanMatch, false);
  const capture = { ...syntheticCapture(), selectedTaskIds: [], snapshots: {} };
  const expected = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count: 1, effects: {} } };
  const created = await run({ ...options([route("default", expected), route("literal", { ...expected,
    operation: { ...expected.operation, title: "Task" } })]), capture, label: label(expected) });
  assert.ok(created.routes[0].evaluation?.ok); assert.equal(created.routes[0].evaluation.wholePlanMatch, true);
  assert.ok(created.routes[1].evaluation?.ok); assert.equal(created.routes[1].evaluation.wholePlanMatch, false);
});

test("invalid PCM/input/label routes refuse before callbacks; native storage and caller methods are not trusted", async () => {
  let calls = 0; const first = { ...route("first"), transcribe: async () => { calls++; throw Error("unused"); } };
  const run = createPingPairedInertTrialRunner(), input = options([first, route("second")]);
  const spoof = new Float32Array(2); Object.setPrototypeOf(spoof, Uint8Array.prototype);
  const sharedSpoof = new SharedArrayBuffer(2); Object.setPrototypeOf(sharedSpoof, ArrayBuffer.prototype);
  const detached = new Uint8Array(2); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const value of [new Uint8Array(0), new Uint8Array(3), new Uint8Array(1_440_002), spoof,
    new Uint8Array(new SharedArrayBuffer(2)), new Uint8Array(sharedSpoof), detached]) {
    await assert.rejects(run({ ...input, pcm: value }), /ping_trial_invalid_input/);
  }
  for (const change of [{ routes: [first] }, { routes: [first, first] }, { deadlineMs: 10001 },
    { capture: { ...input.capture, timeZone: "UTC" } }, { label: { ...input.label, source: "model_generated" } }]) {
    await assert.rejects(run({ ...input, ...change } as Parameters<typeof run>[0]), /ping_trial_invalid_input/);
  }
  assert.equal(calls, 0);
  const bytes = pcm(); Object.defineProperty(bytes, "slice", { get() { throw Error("must not read"); } });
  Object.defineProperty(bytes, "length", { get() { throw Error("must not read"); } });
  const report = await run({ ...options(), pcm: bytes }); assert.equal(report.routes[0].status, "completed");
});

test("only actual finite scalar usage is copied; malformed transcript/usage stops before interpretation and second route", async () => {
  const run = createPingPairedInertTrialRunner();
  const usage = { type: "tokens" as const, input_tokens: 0, output_tokens: 0, total_tokens: 0,
    input_token_details: { audio_tokens: 0, text_tokens: 0 } };
  const report = await run(options([{ ...route("usage"), transcribe: async () => ({ text: "Complete", usage }) }, route("null")]));
  assert.deepEqual(report.routes[0].transcriptionUsage, usage); usage.input_token_details.audio_tokens = 1;
  assert.equal(report.routes[0].transcriptionUsage?.type, "tokens");
  if (report.routes[0].transcriptionUsage?.type === "tokens") assert.equal(report.routes[0].transcriptionUsage.input_token_details?.audio_tokens, 0);
  for (const output of [{ text: "", usage: null }, { text: "x".repeat(4001), usage: null },
    { text: "Complete", usage: { type: "duration", seconds: -1 } },
    { text: "Complete", usage: { type: "tokens", input_tokens: 1, output_tokens: 2, total_tokens: 4 } },
    { text: "Complete", usage: { type: "duration", seconds: 1, price: 1 } }, { text: "Complete", usage: null, extra: true }]) {
    const result = await run(options([{ ...route("bad"), transcribe: async () => output as never }, route("skip")]));
    assert.equal(result.routes[0].status, "failed"); assert.equal(result.routes[0].transcribeCalls, 1); exactInert(result.routes[0], 0);
    assert.equal(result.routes[0].evaluation, null); assert.equal(result.routes[1].status, "not_started");
    assert.equal(result.routes[1].transcribeCalls, 0);
  }
});

test("cancel/deadline publish immutable observations but hold callback latch through ignored abort settlement", async () => {
  for (const reason of ["cancelled", "deadline"] as const) {
    const gate = deferred<unknown>(), controller = new AbortController(); let interpretations = 0;
    const first = { ...route("held"), transcribe: async () => { await gate.promise; return { text: "Complete", usage: null }; },
      interpret: async () => { interpretations++; return syntheticPlan(); } };
    const run = createPingPairedInertTrialRunner();
    const pending = run({ ...options([first, route("skip")]), signal: controller.signal, deadlineMs: reason === "deadline" ? 10 : 1000 });
    if (reason === "cancelled") controller.abort();
    const result = await pending; assert.equal(result.routes[0].status, reason); exactInert(result.routes[0], 0);
    assert.equal(result.routes[1].transcribeCalls, 0);
    await assert.rejects(run(options()), /ping_trial_busy/); gate.resolve(null); await settle();
    assert.equal(interpretations, 0); assert.equal(result.routes[0].interpretationCalls, 0);
    assert.equal((await run(options())).routes[0].status, "completed");
  }
  const controller = new AbortController(); controller.abort();
  const pre = await createPingPairedInertTrialRunner()({ ...options(), signal: controller.signal });
  assert.deepEqual(pre.routes.map(r => [r.status, r.transcribeCalls]), [["not_started", 0], ["not_started", 0]]);
});

test("one remaining budget covers both stages; reentrant cancel/fault/late interpretation cannot continue", async () => {
  const run = createPingPairedInertTrialRunner(); let second = 0;
  const skip = { ...route("skip"), transcribe: async () => { second++; throw Error("unused"); } };
  const held = deferred<unknown>();
  const pending = run({ ...options([{ ...route("budget"), transcribe: async () => {
    await new Promise(resolve => setTimeout(resolve, 20)); return { text: "Complete", usage: null };
  }, interpret: async () => held.promise }, skip]), deadlineMs: 35 });
  const result = await pending; assert.equal(result.routes[0].status, "deadline");
  assert.equal(result.routes[0].interpretationCalls, 1); assert.equal(result.routes[0].evaluation, null);
  assert.deepEqual(result.routes[0].observation.stages.map(stage => stage.name), ["finals_ready", "interpretation_start"]);
  await assert.rejects(run(options()), /ping_trial_busy/); held.resolve(syntheticPlan()); await settle();
  assert.equal(second, 0); assert.equal(result.routes[0].evaluation, null);
  const controller = new AbortController();
  const cancelled = await run({ ...options([{ ...route("cancel"), transcribe: async () => {
    controller.abort(); return { text: "Complete", usage: null };
  } }, skip]), signal: controller.signal }); assert.equal(cancelled.routes[0].interpretationCalls, 0);
  const failed = await run(options([{ ...route("fault"), interpret: async () => { throw Error("sensitive provider text"); } }, skip]));
  assert.equal(failed.routes[0].status, "failed"); assert.equal(JSON.stringify(failed).includes("sensitive"), false);
  assert.equal(second, 0);
});

test("public synthetic actual clip+interpreter composition inspects both WAVs/projections and four physical fetch entries", async () => {
  let clips = 0, interpretations = 0;
  const make = (id: string): PingPairedRoute => ({ id,
    transcribe: createPingOpenAiClipTranscriber({ model: "gpt-4o-mini-transcribe", apiKey: "synthetic-key", fetch: async (_url, init) => {
      clips++; const file = (init.body as FormData).get("file") as Blob;
      const bytes = new Uint8Array(await file.arrayBuffer());
      assert.deepEqual([...bytes.subarray(44)], [0, 0, 255, 127, 0, 128, 255, 255]);
      assert.equal(new DataView(bytes.buffer).getUint32(24, true), 24000);
      return new Response(JSON.stringify({ text: "Assign these to me, due 2026-10-07, move to doing." }),
        { headers: { "content-type": "application/json" } });
    } }),
    interpret: createPingOpenAiInterpreter({ model: "synthetic-model", apiKey: "synthetic-key", fetch: async (_url, init) => {
      interpretations++; const input = JSON.parse(JSON.parse(init.body as string).input[0].content[0].text);
      assert.deepEqual(input, { version: "ping.interpretation.v1", transcript: "Assign these to me, due 2026-10-07, move to doing.",
        selectedTaskCount: 1, referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", systemColumnKeys: ["todo", "doing", "review", "done"] });
      return new Response(JSON.stringify({ status: "completed", error: null, incomplete_details: null,
        output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", annotations: [], logprobs: [],
          text: JSON.stringify({ proposal: syntheticPlan() }) }] }] }), { headers: { "content-type": "application/json" } });
    } }) });
  const result = await createPingPairedInertTrialRunner()(options([make("route_a"), make("route_b")]));
  assert.equal(clips, 2); assert.equal(interpretations, 2);
  for (const report of result.routes) { assert.equal(report.status, "completed"); exactInert(report);
    assert.ok(report.evaluation?.ok); assert.equal(report.evaluation.wholePlanMatch, true);
    assert.equal(report.transcriptionUsage, null); }
});

test("reentrant validation cannot reserve a second overlapping run", async () => {
  const run = createPingPairedInertTrialRunner(), gate = deferred<unknown>();
  const nested: { promise?: ReturnType<typeof run> } = {};
  let outerCalls = 0, nestedCalls = 0;
  const held = options([{ ...route("held"), transcribe: async () => {
    nestedCalls++; await gate.promise; return { text: "Complete", usage: null };
  } }, route("second")]);
  const outer = options([{ ...route("outer"), transcribe: async () => {
    outerCalls++; return { text: "Complete", usage: null };
  } }, route("other")]);
  const proxy = new Proxy(outer, { get(target, key, receiver) {
    if (key === "pcm" && !nested.promise) nested.promise = run(held);
    return Reflect.get(target, key, receiver);
  } });
  await assert.rejects(run(proxy), /ping_trial_busy/);
  assert.equal(nestedCalls, 1); assert.equal(outerCalls, 0);
  await assert.rejects(run(options()), /ping_trial_busy/);
  gate.resolve(null); assert.ok(nested.promise);
  const report = await nested.promise; assert.equal(report.routes[0].status, "completed");
  assert.equal((await run(options())).routes[0].status, "completed");
});

test("deadline expiring across byte-copy boundary prevents the physical callback entry", async t => {
  let clockReads = 0, calls = 0;
  t.mock.method(performance, "now", () => ++clockReads <= 3 ? 0 : 20);
  const input = options([{ ...route("expired"), transcribe: async () => {
    calls++; return { text: "Complete", usage: null };
  } }, route("skip")]);
  const result = await createPingPairedInertTrialRunner()({ ...input, deadlineMs: 10 });
  assert.equal(result.routes[0].status, "deadline"); assert.equal(calls, 0);
  assert.equal(result.routes[0].transcribeCalls, 0); assert.equal(result.routes[1].transcribeCalls, 0);
});
