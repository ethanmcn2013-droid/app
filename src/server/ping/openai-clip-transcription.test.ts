import assert from "node:assert/strict";
import test from "node:test";
import { bindPingProposal } from "@/lib/ping/proposal";
import { evaluatePingWholePlan } from "@/lib/ping/evaluation";
import { createPingOpenAiInterpreter } from "./openai-interpreter";
import { createPingOpenAiClipTranscriber, PING_CLIP_ENDPOINT } from "./openai-clip-transcription";

const pcm = () => new Uint8Array([0, 128, 255, 127, 1, 0, 255, 255]);
const signal = () => new AbortController().signal;
const response = (value: unknown = { text: "Assign these to me." }) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const options = (fetch: (input: string, init: RequestInit) => Promise<Response>, deadlineMs = 1000) =>
  ({ model: "gpt-4o-mini-transcribe", apiKey: "synthetic-key", fetch, deadlineMs });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test("exact multipart WAV copies every literal PCM byte; maximum clip stays bounded and request carries no authority", async () => {
  let calls = 0;
  const original = pcm();
  const transcribe = createPingOpenAiClipTranscriber(options(async (url, init) => {
    calls++;
    assert.equal(url, PING_CLIP_ENDPOINT); assert.equal(url, "https://eu.api.openai.com/v1/audio/transcriptions");
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.equal(init.credentials, "omit");
    assert.deepEqual(init.headers, { Authorization: "Bearer synthetic-key" });
    assert.ok(init.body instanceof FormData);
    assert.deepEqual([...init.body.keys()].sort(), ["file", "model", "response_format", "stream"]);
    assert.equal(init.body.get("model"), "gpt-4o-mini-transcribe"); assert.equal(init.body.get("response_format"), "json"); assert.equal(init.body.get("stream"), "false");
    const file = init.body.get("file"); assert.ok(file instanceof File);
    assert.equal(file.name, "ping.wav"); assert.equal(file.type, "audio/wav"); assert.equal(file.size, 52);
    original.fill(42); // Caller mutation after invocation cannot change the copied upload.
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [82, 73, 70, 70, 44, 0, 0, 0,
      87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, 1, 0,
      192, 93, 0, 0, 128, 187, 0, 0, 2, 0, 16, 0, 100, 97, 116, 97, 8, 0, 0, 0,
      0, 128, 255, 127, 1, 0, 255, 255]);
    return response();
  }));
  assert.deepEqual(await transcribe(original, signal()), { text: "Assign these to me.", usage: null }); assert.equal(calls, 1);
  const maximum = new Uint8Array(1_440_000); maximum[0] = 128; maximum[maximum.length - 1] = 255;
  await createPingOpenAiClipTranscriber(options(async (_, init) => {
    const file = (init.body as FormData).get("file") as File; assert.equal(file.size, 1_440_044);
    const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer);
    assert.equal(view.getUint32(4, true), 1_440_036); assert.equal(view.getUint32(40, true), 1_440_000);
    assert.equal(bytes[44], 128); assert.equal(bytes.at(-1), 255); return response();
  }))(maximum, signal());
});

test("native brand/storage and PCM bounds fail before upload; hostile instance fields/species are not consulted", async () => {
  let calls = 0;
  const transcribe = createPingOpenAiClipTranscriber(options(async () => { calls++; return response(); }));
  const wrongBrand = new Float32Array(4); Object.setPrototypeOf(wrongBrand, Uint8Array.prototype);
  const shared = new Uint8Array(new SharedArrayBuffer(8));
  const spoofedShared = new SharedArrayBuffer(8); Object.setPrototypeOf(spoofedShared, ArrayBuffer.prototype);
  const detached = pcm(); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const value of [null, [], new Uint8Array(), new Uint8Array(3), new Uint8Array(1_440_002), wrongBrand,
    shared, new Uint8Array(spoofedShared), detached]) await assert.rejects(transcribe(value, signal()), /invalid_pcm$/);
  assert.equal(calls, 0);
  const hostile = pcm();
  for (const key of ["constructor", "buffer", "length", "slice", "set", Symbol.iterator]) Object.defineProperty(hostile, key, {
    get() { throw new Error("must not consult caller fields/species"); } });
  assert.deepEqual(await transcribe(hostile, signal()), { text: "Assign these to me.", usage: null }); assert.equal(calls, 1);
  assert.throws(() => createPingOpenAiClipTranscriber({ ...options(async () => response()), model: "gpt-4o-transcribe-diarize" }), /configuration$/);
  assert.throws(() => createPingOpenAiClipTranscriber({ ...options(async () => response()), apiKey: "bad\nheader" }), /configuration$/);
});

test("usage preserves documented actual tokens/duration and optional zeros; absent usage is unknown", async () => {
  const usages = [undefined, { type: "tokens", input_tokens: 14, output_tokens: 45, total_tokens: 59,
    input_token_details: { text_tokens: 0, audio_tokens: 14 } }, { type: "tokens", input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    { type: "tokens", input_tokens: 3, output_tokens: 1, total_tokens: 4, input_token_details: { audio_tokens: 0 } },
    { type: "duration", seconds: 4 }, { type: "duration", seconds: 0 }];
  for (const usage of usages) {
    const returned = await createPingOpenAiClipTranscriber(options(async () => response({ text: "Move to doing.",
      ...(usage !== undefined ? { usage } : {}), languages: [{ code: "en" }], logprobs: [] })))(pcm(), signal());
    assert.deepEqual(returned, { text: "Move to doing.", usage: usage ?? null }); assert.equal(Object.isFrozen(returned), true);
    if (returned.usage) assert.equal(Object.isFrozen(returned.usage), true);
  }
});

test("malformed text/usage, ambiguous output, byte/chunk/UTF-8 and HTTP faults reject completely with fixed errors", async () => {
  const malformed: unknown[] = [{ text: "" }, { text: "x".repeat(4001) }, { text: "\ud800" }, { text: "ok", actorId: "synthetic" },
    { text: "ok", segments: [] }, { text: "ok", error: {} }, { text: "ok", logprobs: [{ token: "private" }] },
    { text: "ok", languages: [{ code: "en", actorId: "synthetic" }] }, { text: "ok", usage: null },
    ...[{ type: "tokens", input_tokens: 1, output_tokens: 2, total_tokens: 4 },
      { type: "tokens", input_tokens: -1, output_tokens: 2, total_tokens: 1 },
      { type: "tokens", input_tokens: 1.5, output_tokens: 1, total_tokens: 2.5 },
      { type: "tokens", input_tokens: 1, output_tokens: 2, total_tokens: 3, input_token_details: { audio_tokens: -1 } },
      { type: "tokens", input_tokens: 1, output_tokens: 2, total_tokens: 3, cost: 0 },
      { type: "duration", seconds: -1 }, { type: "duration", seconds: "4" }, { type: "duration", seconds: 4, price: 0 }]
      .map(usage => ({ text: "ok", usage }))];
  for (const value of malformed) await assert.rejects(createPingOpenAiClipTranscriber(options(async () => response(value)))(pcm(), signal()), /invalid_response$/);
  let cancellations = 0;
  const overflowing = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65_537)); }, cancel() { cancellations++; } }),
    { headers: { "content-type": "application/json" } });
  await assert.rejects(createPingOpenAiClipTranscriber(options(async () => overflowing))(pcm(), signal()), /invalid_response$/);
  assert.equal(cancellations, 1);
  const manyChunks = new Response(new ReadableStream({ start(controller) {
    for (let index = 0; index < 4097; index++) controller.enqueue(new Uint8Array());
  }, cancel() { cancellations++; } }), { headers: { "content-type": "application/json" } });
  await assert.rejects(createPingOpenAiClipTranscriber(options(async () => manyChunks))(pcm(), signal()), /invalid_response$/);
  assert.equal(cancellations, 2);
  const redirected = response(); Object.defineProperty(redirected, "redirected", { value: true });
  for (const invalid of [redirected, new Response("{}", { status: 429 }), new Response("{}", { headers: { "content-type": "text/html" } }),
    new Response(new Uint8Array([0xc3]), { headers: { "content-type": "application/json" } }),
    new Response("{", { headers: { "content-type": "application/json" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": "999999" } })]) {
    await assert.rejects(createPingOpenAiClipTranscriber(options(async () => invalid))(pcm(), signal()), { message: "ping_clip_invalid_response" });
  }
  await assert.rejects(createPingOpenAiClipTranscriber(options(async () => { throw new Error("synthetic provider secret"); }))(pcm(), signal()),
    { message: "ping_clip_invalid_response" });
});

test("cancellation/deadline wins late fetch/body and retains physical single-flight through actual settlement", async () => {
  let calls = 0; const abort = new AbortController(); abort.abort();
  await assert.rejects(createPingOpenAiClipTranscriber(options(async () => { calls++; return response(); }))(pcm(), abort.signal), /cancelled$/); assert.equal(calls, 0);
  const pending = deferred<Response>(); let cancelled = 0;
  const transcribe = createPingOpenAiClipTranscriber(options(async () => { calls++; return calls === 1 ? pending.promise : response(); }, 20));
  await assert.rejects(transcribe(pcm(), signal()), /deadline$/);
  await assert.rejects(transcribe(pcm(), signal()), /busy$/); assert.equal(calls, 1);
  pending.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }));
  await settle(); assert.equal(cancelled, 1); assert.deepEqual(await transcribe(pcm(), signal()), { text: "Assign these to me.", usage: null });
  const cancelSettled = deferred<void>(), started = deferred<void>(), controller = new AbortController(); let bodyCalls = 0;
  const bodyTranscribe = createPingOpenAiClipTranscriber(options(async () => { bodyCalls++;
    return new Response(new ReadableStream({ start() { started.resolve(); }, cancel() { return cancelSettled.promise; } }), { headers: { "content-type": "application/json" } }); }));
  const bodyPending = bodyTranscribe(pcm(), controller.signal); await started.promise; await settle(); controller.abort();
  await assert.rejects(bodyPending, /cancelled$/); await assert.rejects(bodyTranscribe(pcm(), signal()), /busy$/); assert.equal(bodyCalls, 1);
  cancelSettled.resolve(); await settle();
  const reentrant = new AbortController(); let lateCancelled = 0;
  await assert.rejects(createPingOpenAiClipTranscriber(options(async () => { reentrant.abort();
    return new Response(new ReadableStream({ cancel() { lateCancelled++; } }), { headers: { "content-type": "application/json" } });
  }))(pcm(), reentrant.signal), /cancelled$/); await settle(); assert.equal(lateCancelled, 1);
  await assert.rejects(createPingOpenAiClipTranscriber(options(async () => {
    const until = performance.now() + 20; while (performance.now() < until) { /* Synchronous injected work consumes deadline. */ }
    return response();
  }, 5))(pcm(), signal()), /deadline$/);
});

test("inert composition uses one clip request and one interpreter request then binds an independently specified whole proposal", async () => {
  const expected = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } };
  const capture = { generationId: "public-generation", connectionEpoch: "public-epoch", contextKey: "public-context", sessionId: "public-session",
    actorId: "public-actor", inputItemId: "public-whole-input", commandId: "00000000-0000-4000-8000-000000000001", projectId: "public-project",
    selectedTaskIds: ["public-task"], referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin" as const, expectedColumnConfig: null,
    snapshots: { "public-task": { assignees: ["public-other"], due: null, dueAtSeconds: null, startDay: 20000, durationDays: 2,
      lane: "todo" as const, boardColumnKey: null, completedAtSeconds: null } } };
  let clipCalls = 0, interpreterCalls = 0;
  const transcribe = createPingOpenAiClipTranscriber(options(async () => { clipCalls++; return response(); }));
  const interpret = createPingOpenAiInterpreter({ model: "synthetic-model", apiKey: "synthetic-key", fetch: async (_, init) => {
    interpreterCalls++; const modelInput = JSON.parse(JSON.parse(init.body as string).input[0].content[0].text);
    assert.deepEqual(Object.keys(modelInput).sort(), ["referenceInstant", "selectedTaskCount", "systemColumnKeys", "timeZone", "transcript", "version"]);
    assert.equal(modelInput.transcript, "Assign these to me.");
    return response({ status: "completed", output: [{ type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", annotations: [], text: JSON.stringify({ proposal: expected }) }] }] });
  } });
  const compose = async (clip: typeof transcribe, controller: AbortController, cancelBetween = false) => {
    const final = await clip(pcm(), controller.signal);
    if (cancelBetween) controller.abort();
    return interpret({ version: "ping.interpretation.v1", transcript: final.text, selectedTaskCount: 1,
      referenceInstant: capture.referenceInstant, timeZone: capture.timeZone, systemColumnKeys: ["todo", "doing", "review", "done"] }, controller.signal);
  };
  const proposal = await compose(transcribe, new AbortController());
  assert.deepEqual(proposal, expected); assert.equal(clipCalls, 1); assert.equal(interpreterCalls, 1);
  const bound = bindPingProposal(proposal, capture, { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
  assert.equal(bound.ok, true);
  if (bound.ok) assert.deepEqual(JSON.parse(JSON.stringify(bound.command.operation)), { kind: "edit_selected", taskIds: ["public-task"],
    effects: { selfAssignment: "add" }, expected: { "public-task": { assignees: ["public-other"] } } });
  const evaluated = evaluatePingWholePlan({ id: "public-clip-example", source: "independent_fixture", expected }, proposal, capture,
    { interpretationCalls: 1, executorCalls: 0, receiptReadsLifetime: 0, receiptReadWindows: [], observedCommittedEffects: 0,
      knowledge: "not_dispatched", timingSource: "synthetic", stages: [] });
  assert.equal(evaluated.ok, true); if (evaluated.ok) { assert.equal(evaluated.wholePlanMatch, true); assert.equal(evaluated.finishToVisibleMs, null); }
  await assert.rejects(compose(transcribe, new AbortController(), true), /cancelled$/); assert.equal(interpreterCalls, 1);
  await assert.rejects(compose(createPingOpenAiClipTranscriber(options(async () => response({ text: "" }))), new AbortController()), /invalid_response$/);
  assert.equal(interpreterCalls, 1);
});
