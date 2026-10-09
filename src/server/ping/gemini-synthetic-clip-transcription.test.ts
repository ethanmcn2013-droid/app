import assert from "node:assert/strict";
import test from "node:test";
import { createPingGeminiSyntheticClipTranscriber, PING_GEMINI_CLIP_ENDPOINT } from "./gemini-synthetic-clip-transcription";

const pcm = () => new Uint8Array([0, 128, 255, 127, 1, 0, 255, 255]);
const options = (fetch: (input: string, init: RequestInit) => Promise<Response>, deadlineMs = 1_000) => ({
  apiKey: "synthetic-key", developmentOnly: true as const, fetch, deadlineMs,
});
const candidate = (parts: unknown[] = [{ text: "Assign the selected task to me." }]) =>
  ({ finishReason: "STOP", content: { role: "model", parts } });
const response = (value: unknown = { candidates: [candidate()] }) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test("exact allowlisted PCM is WAV-wrapped and sent once through the fixed verbatim GenerateContent request", async () => {
  let calls = 0;
  const input = pcm();
  const transcribe = createPingGeminiSyntheticClipTranscriber(options(async (url, init) => {
    calls++;
    assert.equal(url, PING_GEMINI_CLIP_ENDPOINT);
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store"); assert.equal(init.credentials, "omit");
    assert.deepEqual(init.headers, { "content-type": "application/json", "x-goog-api-key": "synthetic-key" });
    const body = JSON.parse(init.body as string);
    assert.equal(body.generationConfig.audioTranscriptionConfig.mode, "VERBATIM");
    assert.equal(body.contents[0].role, "user");
    assert.equal(body.contents[0].parts[0].inlineData.mimeType, "audio/wav");
    const wav = Buffer.from(body.contents[0].parts[0].inlineData.data, "base64");
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.deepEqual([...wav.subarray(44)], [...input]);
    return response({ candidates: [candidate()],
      usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 5, totalTokenCount: 19,
        promptTokensDetails: [{ modality: "AUDIO", tokenCount: 14 }],
        candidatesTokensDetails: [{ modality: "TEXT", tokenCount: 5 }], cachedContentTokenCount: 0, trafficType: "ON_DEMAND" } });
  }));
  assert.deepEqual(await transcribe(input, new AbortController().signal), {
    text: "Assign the selected task to me.", usage: { type: "tokens", input_tokens: 14, output_tokens: 5, total_tokens: 19,
      input_token_details: { audio_tokens: 14 } },
  });
  assert.equal(calls, 1);
});

test("unknown usage stays null and a non-allowlisted PCM digest is rejected before fetch", async () => {
  let calls = 0;
  const transcribe = createPingGeminiSyntheticClipTranscriber(options(async () => { calls++; return response(); }));
  assert.deepEqual(await transcribe(pcm(), new AbortController().signal), {
    text: "Assign the selected task to me.", usage: null,
  });
  const wrong = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  await assert.rejects(transcribe(wrong, new AbortController().signal), { message: "ping_gemini_clip_not_allowlisted" });
  assert.equal(calls, 1);
});

test("constructor requires explicit development-only admission", () => {
  assert.throws(() => createPingGeminiSyntheticClipTranscriber({
    ...options(async () => response()), developmentOnly: false,
  } as never), { message: "ping_gemini_clip_configuration" });
});

test("pre-cancel does not dispatch; active cancellation settles publicly but preserves physical busy until body cancellation ends", async () => {
  let calls = 0, bodyCancelled = 0;
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  const transcribe = createPingGeminiSyntheticClipTranscriber(options(async () => { calls++; return response(); }));
  await assert.rejects(transcribe(pcm(), alreadyAborted.signal), { message: "ping_gemini_clip_cancelled" });
  assert.equal(calls, 0);

  const pending = deferred<Response>();
  const active = createPingGeminiSyntheticClipTranscriber(options(async () => { calls++; return pending.promise; }));
  const controller = new AbortController();
  const result = active(pcm(), controller.signal);
  await settle(); controller.abort();
  await assert.rejects(result, { message: "ping_gemini_clip_cancelled" });
  await assert.rejects(active(pcm(), new AbortController().signal), { message: "ping_gemini_clip_busy" });
  pending.resolve(new Response(new ReadableStream({ cancel() { bodyCancelled++; } }), { headers: { "content-type": "application/json" } }));
  await settle();
  assert.equal(bodyCancelled, 1); assert.equal(calls, 1);
});

test("secret echo and oversized response body produce fixed failures without exposing body content", async () => {
  const key = "synthetic-key";
  const echo = createPingGeminiSyntheticClipTranscriber({ ...options(async () => response({
    candidates: [candidate([{ text: `echo ${key}` }])],
  })), apiKey: key });
  await assert.rejects(echo(pcm(), new AbortController().signal), { message: "ping_gemini_clip_invalid_response" });

  let cancelled = 0;
  const tooLarge = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(65_537));
  }, cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } });
  const bounded = createPingGeminiSyntheticClipTranscriber(options(async () => tooLarge));
  await assert.rejects(bounded(pcm(), new AbortController().signal), { message: "ping_gemini_clip_invalid_response" });
  assert.equal(cancelled, 1);
});

test("only completed STOP candidates pass; deadline prevents a second call until the first physically settles", async () => {
  const incomplete = createPingGeminiSyntheticClipTranscriber(options(async () => response({
    candidates: [{ ...candidate(), finishReason: "MAX_TOKENS" }],
  })));
  await assert.rejects(incomplete(pcm(), new AbortController().signal), { message: "ping_gemini_clip_invalid_response" });

  let calls = 0;
  const pending = deferred<Response>();
  const transcribe = createPingGeminiSyntheticClipTranscriber(options(async () => { calls++; return pending.promise; }, 10));
  await assert.rejects(transcribe(pcm(), new AbortController().signal), { message: "ping_gemini_clip_deadline" });
  await assert.rejects(transcribe(pcm(), new AbortController().signal), { message: "ping_gemini_clip_busy" });
  pending.resolve(response());
  await settle();
  assert.equal(calls, 1);
});

test("deadline during a pending response-body read holds busy until reader cancellation physically settles", async () => {
  const bodyStarted = deferred<void>();
  const cancelGate = deferred<void>();
  let calls = 0, cancellations = 0;
  const transcribe = createPingGeminiSyntheticClipTranscriber(options(async () => {
    calls++;
    if (calls > 1) return response();
    return new Response(new ReadableStream({
      start() { bodyStarted.resolve(); },
      cancel() { cancellations++; return cancelGate.promise; },
    }), { headers: { "content-type": "application/json" } });
  }, 20));

  const first = transcribe(pcm(), new AbortController().signal);
  await bodyStarted.promise;
  await assert.rejects(first, { message: "ping_gemini_clip_deadline" });
  assert.equal(cancellations, 1);
  await assert.rejects(transcribe(pcm(), new AbortController().signal), { message: "ping_gemini_clip_busy" });
  cancelGate.resolve();
  await settle();
  assert.deepEqual(await transcribe(pcm(), new AbortController().signal), {
    text: "Assign the selected task to me.", usage: null,
  });
  assert.equal(calls, 2);
});
