import assert from "node:assert/strict";
import test from "node:test";
import { createPingGeminiSyntheticNativeInterpreter, PING_GEMINI_NATIVE_ENDPOINT } from "./gemini-synthetic-native-audio";
import { PING_RESPONSES_SCHEMA } from "./openai-interpreter";
const pcm = () => new Uint8Array([0, 128, 255, 127, 1, 0, 255, 255]);
const context = { selectedTaskCount: 1, referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
  systemColumnKeys: ["todo", "doing", "review", "done"] };
const plan = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected",
  effects: { selfAssignment: "add", statusColumnKey: "doing" } } };
const options = (fetch: (input: string, init: RequestInit) => Promise<Response>, deadlineMs = 1_000) => ({
  apiKey: "synthetic-key", developmentOnly: true as const, fetch, deadlineMs });
const candidate = (parts: unknown[] = [{ text: JSON.stringify({ proposal: plan }) }]) =>
  ({ finishReason: "STOP", content: { role: "model", parts } });
const response = (value: unknown = { candidates: [candidate()] }) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test("one native completed WAV request uses public context and fixed structured schema without transcription or tools", async () => {
  let calls = 0;
  const interpret = createPingGeminiSyntheticNativeInterpreter(options(async (url, init) => {
    calls++; assert.equal(url, PING_GEMINI_NATIVE_ENDPOINT); assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit"); assert.equal(init.cache, "no-store");
    const body = JSON.parse(init.body as string);
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 1024,
      responseFormat: { text: { mimeType: "application/json", schema: PING_RESPONSES_SCHEMA } } });
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), context);
    assert.match(body.systemInstruction.parts[0].text, /corrections and every clause/);
    const wav = Buffer.from(body.contents[0].parts[1].inlineData.data, "base64");
    assert.equal(wav.readUInt32LE(24), 24000); assert.deepEqual([...wav.subarray(44)], [...pcm()]);
    assert.equal(body.tools, undefined);
    return response({ candidates: [candidate()], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3,
      thoughtsTokenCount: 2, totalTokenCount: 15, cachedContentTokenCount: 0, trafficType: "ON_DEMAND" } });
  }));
  assert.deepEqual(await interpret(pcm(), context, new AbortController().signal), { proposal: plan,
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15,
      prompt_tokens_details: { cached_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 2 } } });
  assert.equal(calls, 1);
});

test("exact public admission denies arbitrary PCM/context before network and production/environment changes", async () => {
  let calls = 0;
  const interpret = createPingGeminiSyntheticNativeInterpreter(options(async () => { calls++; return response(); }));
  await assert.rejects(interpret(new Uint8Array([1,2,3,4]), context, new AbortController().signal), /not_allowlisted/);
  await assert.rejects(interpret(pcm(), { ...context, selectedTaskCount: 2 }, new AbortController().signal), /invalid_input/);
  assert.equal(calls, 0);
  const saved = process.env.VERCEL;
  try { process.env.VERCEL = "";
    await assert.rejects(interpret(pcm(), context, new AbortController().signal), /configuration/);
    assert.throws(() => createPingGeminiSyntheticNativeInterpreter(options(async () => response())), /configuration/); }
  finally { if (saved === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved; }
});

test("refusal and clarification remain whole outcomes; incomplete, malformed and thought/tool parts fail", async () => {
  for (const outcome of ["refusal", "clarification"]) {
    const p = { version: "ping.proposal.v1", outcome, reason: "incomplete" };
    const interpret = createPingGeminiSyntheticNativeInterpreter(options(async () => response({ candidates: [candidate([{ text: JSON.stringify({ proposal: p }) }])] })));
    assert.deepEqual(await interpret(pcm(), context, new AbortController().signal), { proposal: p, usage: null });
  }
  for (const parts of [[{ text: "{" }], [{ text: JSON.stringify({ proposal: plan }), thought: true }],
    [{ functionCall: { name: "submit_ping_proposal", args: plan } }],
    [{ text: JSON.stringify({ proposal: { ...plan, operation: { kind: "edit_selected", effects: {} } } }) }]]) {
    const interpret = createPingGeminiSyntheticNativeInterpreter(options(async () => response({ candidates: [candidate(parts)] })));
    await assert.rejects(interpret(pcm(), context, new AbortController().signal), /invalid_response/);
  }
});

test("missing or inconsistent scalar usage stays unknown without changing valid proposal", async () => {
  for (const usageMetadata of [undefined, { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 99 }]) {
    const interpret = createPingGeminiSyntheticNativeInterpreter(options(async () => response({ candidates: [candidate()], usageMetadata })));
    assert.deepEqual(await interpret(pcm(), context, new AbortController().signal), { proposal: plan, usage: null });
  }
});

test("pre-cancel does not dispatch; active cancellation settles publicly but preserves physical busy until body cancellation ends", async () => {
  let calls = 0, bodyCancelled = 0;
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  const transcribe = createPingGeminiSyntheticNativeInterpreter(options(async () => { calls++; return response(); }));
  await assert.rejects(transcribe(pcm(), context, alreadyAborted.signal), { message: "ping_gemini_native_cancelled" });
  assert.equal(calls, 0);

  const pending = deferred<Response>();
  const active = createPingGeminiSyntheticNativeInterpreter(options(async () => { calls++; return pending.promise; }));
  const controller = new AbortController();
  const result = active(pcm(), context, controller.signal);
  await settle(); controller.abort();
  await assert.rejects(result, { message: "ping_gemini_native_cancelled" });
  await assert.rejects(active(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_busy" });
  pending.resolve(new Response(new ReadableStream({ cancel() { bodyCancelled++; } }), { headers: { "content-type": "application/json" } }));
  await settle();
  assert.equal(bodyCancelled, 1); assert.equal(calls, 1);
});

test("secret echo and oversized response body produce fixed failures without exposing body content", async () => {
  const key = "synthetic-key";
  const echo = createPingGeminiSyntheticNativeInterpreter({ ...options(async () => response({
    candidates: [candidate([{ text: `echo ${key}` }])],
  })), apiKey: key });
  await assert.rejects(echo(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_invalid_response" });

  let cancelled = 0;
  const tooLarge = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(65_537));
  }, cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } });
  const bounded = createPingGeminiSyntheticNativeInterpreter(options(async () => tooLarge));
  await assert.rejects(bounded(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_invalid_response" });
  assert.equal(cancelled, 1);
});

test("only completed STOP candidates pass; deadline prevents a second call until the first physically settles", async () => {
  const incomplete = createPingGeminiSyntheticNativeInterpreter(options(async () => response({
    candidates: [{ ...candidate(), finishReason: "MAX_TOKENS" }],
  })));
  await assert.rejects(incomplete(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_invalid_response" });

  let calls = 0;
  const pending = deferred<Response>();
  const transcribe = createPingGeminiSyntheticNativeInterpreter(options(async () => { calls++; return pending.promise; }, 10));
  await assert.rejects(transcribe(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_deadline" });
  await assert.rejects(transcribe(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_busy" });
  pending.resolve(response());
  await settle();
  assert.equal(calls, 1);
});

test("deadline during a pending response-body read holds busy until reader cancellation physically settles", async () => {
  const bodyStarted = deferred<void>();
  const cancelGate = deferred<void>();
  let calls = 0, cancellations = 0;
  const transcribe = createPingGeminiSyntheticNativeInterpreter(options(async () => {
    calls++;
    if (calls > 1) return response();
    return new Response(new ReadableStream({
      start() { bodyStarted.resolve(); },
      cancel() { cancellations++; return cancelGate.promise; },
    }), { headers: { "content-type": "application/json" } });
  }, 20));

  const first = transcribe(pcm(), context, new AbortController().signal);
  await bodyStarted.promise;
  await assert.rejects(first, { message: "ping_gemini_native_deadline" });
  assert.equal(cancellations, 1);
  await assert.rejects(transcribe(pcm(), context, new AbortController().signal), { message: "ping_gemini_native_busy" });
  cancelGate.resolve();
  await settle();
  assert.deepEqual(await transcribe(pcm(), context, new AbortController().signal), {
    proposal: plan, usage: null,
  });
  assert.equal(calls, 2);
});

 test("rejected body cancellation cannot release physical admission", async () => {
  const started = deferred<void>();
  const interpret = createPingGeminiSyntheticNativeInterpreter(options(async () => new Response(new ReadableStream({
    start() { started.resolve(); }, cancel() { return Promise.reject(new Error("private failure")); }
  }), { headers: { "content-type": "application/json" } }), 20));
  const pending = interpret(pcm(), context, new AbortController().signal);
  await started.promise; await assert.rejects(pending, /deadline/); await settle();
  await assert.rejects(interpret(pcm(), context, new AbortController().signal), /busy/);
});
