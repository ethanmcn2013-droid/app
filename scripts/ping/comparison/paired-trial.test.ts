import assert from "node:assert/strict";
import test from "node:test";
import { syntheticCapture, syntheticPlan } from "@/lib/ping/input-test-fixture";
import { createPingOpenAiClipTranscriber } from "@/server/ping/openai-clip-transcription";
import { createPingOpenAiInterpreter } from "@/server/ping/openai-interpreter";
import { createPingOpenAiNativeAudio, type PingNativeAudioResult } from "@/server/ping/openai-native-audio";
import { createPingPairedInertTrialRunner, type PingPairedRoute, type PingPrivateRouteReport } from "./paired-trial";

// Public literal synthetic labels only. No reserved labels, transcripts or outcome feedback.
const pcm = () => new Uint8Array([0, 0, 255, 127, 0, 128, 255, 255]);
const nativeResult = (): PingNativeAudioResult => ({ proposal: { version: "ping.proposal.v1", outcome: "plan",
  operation: { kind: "edit_selected", effects: { selfAssignment: "add", dueDate: "2026-10-07", statusColumnKey: "doing" } } }, usage: null });
const label = (expected: unknown = syntheticPlan()) => ({ id: "public-compound", source: "independent_fixture", expected });
const route = (id: string, actual: unknown = syntheticPlan()): Extract<PingPairedRoute, { transcribe: unknown }> => ({ id,
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

test("one remaining budget covers both stages; reentrant cancel/fault/late interpretation cannot continue", async (t) => {
  const run = createPingPairedInertTrialRunner(); let second = 0;
  const skip = { ...route("skip"), transcribe: async () => { second++; throw Error("unused"); } };
  const held = deferred<unknown>(), entered = deferred<void>();
  let now = 0;
  const clock = t.mock.method(performance, "now", () => now);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const pending = run({ ...options([{ ...route("budget"), transcribe: async () => {
      await new Promise(resolve => setTimeout(resolve, 20)); return { text: "Complete", usage: null };
    }, interpret: async () => { entered.resolve(); return held.promise; } }, skip]), deadlineMs: 35 });
    now = 20; t.mock.timers.tick(20); await entered.promise;
    now = 35; t.mock.timers.tick(15);
    const result = await pending; assert.equal(result.routes[0].status, "deadline");
    assert.equal(result.routes[0].interpretationCalls, 1); assert.equal(result.routes[0].evaluation, null);
    assert.deepEqual(result.routes[0].observation.stages, [{ name: "finals_ready", atMs: 20 }, { name: "interpretation_start", atMs: 20 }]);
    await assert.rejects(run(options()), /ping_trial_busy/); held.resolve(syntheticPlan()); await settle();
    assert.equal(second, 0); assert.equal(result.routes[0].evaluation, null);
  } finally {
    held.resolve(syntheticPlan()); await settle();
    t.mock.timers.reset(); clock.mock.restore();
  }
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

test("public clip+Responses versus actual native constructor uses the same WAV/context without a native text stage", async () => {
  let clips = 0, textCalls = 0, audioCalls = 0;
  const expectedBytes = [0, 0, 255, 127, 0, 128, 255, 255];
  const clip: PingPairedRoute = { id: "clip",
    transcribe: createPingOpenAiClipTranscriber({ model: "gpt-4o-mini-transcribe", apiKey: "synthetic-key", fetch: async (_url, init) => {
      clips++; const file = (init.body as FormData).get("file") as Blob;
      assert.deepEqual([...new Uint8Array(await file.arrayBuffer()).subarray(44)], expectedBytes);
      return new Response(JSON.stringify({ text: "Assign these to me, due 2026-10-07, move to doing." }),
        { headers: { "content-type": "application/json" } });
    } }),
    interpret: createPingOpenAiInterpreter({ model: "synthetic-model", apiKey: "synthetic-key", fetch: async (_url, init) => {
      textCalls++; const input = JSON.parse(JSON.parse(init.body as string).input[0].content[0].text);
      assert.equal(input.selectedTaskCount, 1); assert.equal(input.transcript, "Assign these to me, due 2026-10-07, move to doing.");
      return new Response(JSON.stringify({ status: "completed", error: null, incomplete_details: null,
        output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", annotations: [], logprobs: [],
          text: JSON.stringify({ proposal: syntheticPlan() }) }] }] }), { headers: { "content-type": "application/json" } });
    } }) };
  const native: PingPairedRoute = { id: "native", kind: "native_audio",
    interpretAudio: createPingOpenAiNativeAudio({ model: "gpt-audio-1.5", apiKey: "synthetic-key", fetch: async (_url, init) => {
      audioCalls++; const request = JSON.parse(init.body as string);
      const parts = request.messages[1].content;
      assert.deepEqual(JSON.parse(parts[0].text), { selectedTaskCount: 1, referenceInstant: "2026-10-06T09:00:00.000Z",
        timeZone: "Europe/Dublin", systemColumnKeys: ["todo", "doing", "review", "done"] });
      const wav = Buffer.from(parts[1].input_audio.data, "base64");
      assert.deepEqual([...wav.subarray(44)], expectedBytes); assert.equal(wav.readUInt32LE(24), 24000);
      return new Response(JSON.stringify({ id: "synthetic", object: "chat.completion", created: 1, model: "gpt-audio-1.5",
        choices: [{ index: 0, message: { role: "assistant", tool_calls: [{ id: "synthetic_call", type: "function",
          function: { name: "submit_ping_proposal", arguments: JSON.stringify({ proposal: syntheticPlan() }) } }] }, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5, prompt_tokens_details: null,
          completion_tokens_details: { audio_tokens: null, reasoning_tokens: 0 } } }), { headers: { "content-type": "application/json" } });
    } }) };
  const report = await createPingPairedInertTrialRunner()(options([clip, native]));
  assert.deepEqual([clips, textCalls, audioCalls], [1, 1, 1]);
  for (const result of report.routes) { assert.equal(result.status, "completed"); exactInert(result);
    assert.ok(result.evaluation?.ok); assert.equal(result.evaluation.wholePlanMatch, true); }
  assert.equal("nativeAudioUsage" in report.routes[0], false);
  assert.deepEqual(report.routes[0].observation.stages.map(s => s.name), ["finals_ready", "interpretation_start", "interpretation_end"]);
  assert.equal(report.routes[1].transcribeCalls, 0); assert.equal(report.routes[1].transcriptionUsage, null);
  assert.deepEqual(report.routes[1].observation.stages.map(s => s.name), ["interpretation_start", "interpretation_end"]);
  assert.deepEqual(report.routes[1].nativeAudioUsage, { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5,
    prompt_tokens_details: null, completion_tokens_details: { audio_tokens: null, reasoning_tokens: 0 } });
});

test("native refusal/clarification and copied nullable usage remain whole; malformed or missing results fail closed", async () => {
  const run = createPingPairedInertTrialRunner();
  const make = (value: unknown): PingPairedRoute => ({ id: "native", kind: "native_audio", interpretAudio: async () => value as PingNativeAudioResult });
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_tokens_details: { audio_tokens: null as number | null },
    completion_tokens_details: null };
  for (const outcome of ["refusal", "clarification"] as const) {
    const proposal = { version: "ping.proposal.v1", outcome, reason: "unsupported" };
    const report = await run({ ...options([make({ proposal, usage }), route("clip", proposal)]), label: label(proposal) });
    assert.equal(report.routes[0].status, "completed"); assert.equal(report.routes[0].transcribeCalls, 0); exactInert(report.routes[0]);
    assert.ok(report.routes[0].evaluation?.ok); assert.equal(report.routes[0].evaluation.wholePlanMatch, true);
    assert.deepEqual(report.routes[0].nativeAudioUsage, usage); assert.ok(Object.isFrozen(report.routes[0].nativeAudioUsage?.prompt_tokens_details));
  }
  const report = await run(options([make({ proposal: syntheticPlan(), usage }), route("clip")]));
  usage.prompt_tokens_details.audio_tokens = 1;
  assert.deepEqual(report.routes[0].nativeAudioUsage?.prompt_tokens_details, { audio_tokens: null });
  const unknown = await run(options([make({ proposal: syntheticPlan(), usage: null }), route("clip")]));
  assert.equal(unknown.routes[0].status, "completed"); assert.equal(unknown.routes[0].nativeAudioUsage, null);
  for (const value of [{ proposal: syntheticPlan() }, { proposal: syntheticPlan(), usage: undefined },
    { proposal: syntheticPlan(), usage: null, extra: true }, { proposal: { ...syntheticPlan(), actorId: "authority" }, usage: null },
    { proposal: syntheticPlan(), usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 3 } },
    { proposal: syntheticPlan(), usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, price: 0 } }]) {
    const invalid = await run(options([make(value), route("skip")]));
    assert.equal(invalid.routes[0].status, "failed"); exactInert(invalid.routes[0]);
    assert.equal(invalid.routes[0].evaluation, null); assert.equal(invalid.routes[1].status, "not_started");
  }
});

test("native route owns separate bytes/frozen minimal context and closed route fields", async () => {
  let second = 0; const original = pcm();
  const first: PingPairedRoute = { id: "native", kind: "native_audio", interpretAudio: async (bytes, context) => {
    assert.deepEqual([...bytes], [...original]); bytes.fill(90);
    assert.deepEqual(Object.keys(context).sort(), ["referenceInstant", "selectedTaskCount", "systemColumnKeys", "timeZone"]);
    assert.ok(Object.isFrozen(context)); assert.ok(Object.isFrozen(context.systemColumnKeys));
    return nativeResult();
  } };
  const next: PingPairedRoute = { id: "other", kind: "native_audio", interpretAudio: async bytes => {
    second++; assert.deepEqual([...bytes], [...original]); return nativeResult();
  } };
  const run = createPingPairedInertTrialRunner(), input = { ...options([first, next]), pcm: original };
  const report = await run(input); assert.equal(second, 1); assert.deepEqual([...original], [0, 0, 255, 127, 0, 128, 255, 255]);
  for (const result of report.routes) { assert.equal(result.status, "completed"); assert.equal(result.transcribeCalls, 0); exactInert(result); }
  for (const bad of [{ ...first, interpret: async () => syntheticPlan() }, { ...first, kind: "unknown" },
    { ...first, capture: syntheticCapture() }, { id: "bad", kind: "native_audio" }]) {
    await assert.rejects(run({ ...options(), routes: [bad, next] } as never), /ping_trial_invalid_input/);
  }
  assert.equal(second, 1);
});

test("native original budget holds the actual callback through cancel/deadline, with immutable late results", async t => {
  for (const reason of ["cancelled", "deadline"] as const) {
    const held = deferred<PingNativeAudioResult>(), entered = deferred<void>(), controller = new AbortController();
    let now = 0, calls = 0, nextCalls = 0;
    const clock = t.mock.method(performance, "now", () => now); t.mock.timers.enable({ apis: ["setTimeout"] });
    const first: PingPairedRoute = { id: "held", kind: "native_audio", interpretAudio: async () => { calls++; entered.resolve(); return held.promise; } };
    const next: PingPairedRoute = { id: "skip", kind: "native_audio", interpretAudio: async () => {
      nextCalls++; return nativeResult();
    } };
    const run = createPingPairedInertTrialRunner();
    try {
      const pending = run({ ...options([first, next]), signal: controller.signal, deadlineMs: 35 }); await entered.promise;
      if (reason === "cancelled") controller.abort(); else { now = 35; t.mock.timers.tick(35); }
      const report = await pending; assert.equal(report.routes[0].status, reason); assert.equal(calls, 1); exactInert(report.routes[0]);
      assert.deepEqual(report.routes[0].observation.stages, [{ name: "interpretation_start", atMs: 0 }]);
      assert.equal(report.routes[0].nativeAudioUsage, null); assert.equal(report.routes[0].evaluation, null);
      await assert.rejects(run(options()), /ping_trial_busy/); held.resolve(nativeResult()); await settle();
      assert.equal(nextCalls, 0); assert.equal(report.routes[0].evaluation, null); assert.equal(report.routes[0].observation.stages.length, 1);
      assert.equal((await run(options())).routes[0].status, "completed");
    } finally { held.resolve(nativeResult()); await settle(); t.mock.timers.reset(); clock.mock.restore(); }
  }
});
