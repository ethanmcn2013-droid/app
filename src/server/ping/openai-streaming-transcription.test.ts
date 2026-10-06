import assert from "node:assert/strict";
import test from "node:test";
import { createPingVoiceSession } from "@/lib/ping/voice-session";
import { syntheticCapture, syntheticPlan } from "@/lib/ping/input-test-fixture";
import { createPingOpenAiInterpreter } from "./openai-interpreter";
import { createPingOpenAiStreamingTranscription, type PingStreamingSocket } from "./openai-streaming-transcription";

const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const settle = () => new Promise<void>((r) => setImmediate(r));
const config = (effective = false) => ({ id: "session-synthetic", object: "realtime.transcription_session", type: "transcription",
  ...(effective ? { audio: { input: { format: { type: "audio/pcm", rate: 24000 }, transcription: { model: "gpt-live-transcribe",
    prompt: null, language: "", languages: null, keywords: [], delay: null }, noise_reduction: null, turn_detection: null } }, include: [] } : {}) });
const ack = () => ({ type: "input_audio_buffer.committed", event_id: "event-ack", item_id: "item-synthetic", previous_item_id: null });
const final = (usage?: unknown) => ({ type: "conversation.item.input_audio_transcription.completed", event_id: "event-final",
  item_id: "item-synthetic", content_index: 0, transcript: "Assign these to me, due 2026-10-07, move to doing.", ...(usage !== undefined ? { usage } : {}) });
const append = '{"type":"input_audio_buffer.append","audio":"AYABAP5/"}';
const commit = '{"type":"input_audio_buffer.commit"}';
function socket(heldClose = false) {
  let listener: (raw: unknown) => void = () => {}, lost = () => {}, closes = 0, detached = 0;
  let onSend: (text: string) => void = () => {}, onQueue = () => {}, onSubscribe = () => {}, backlog = 0;
  const closed = deferred<void>(), sends: string[] = [];
  const port: PingStreamingSocket = { closed: closed.promise, send: (text) => { sends.push(text); onSend(text); },
    subscribe: (fn, disconnected) => { listener = fn; lost = disconnected; onSubscribe(); return () => { detached++; }; },
    queuedBytes: () => { onQueue(); return backlog; }, close: () => { closes++; if (!heldClose) closed.resolve(); } };
  return { port, sends, emit: (v: unknown) => listener(typeof v === "string" ? v : JSON.stringify(v)), lost: () => lost(),
    release: () => closed.resolve(), onSend: (fn: (s: string) => void) => { onSend = fn; }, onQueue: (fn: () => void) => { onQueue = fn; },
    onSubscribe: (fn: () => void) => { onSubscribe = fn; },
    backlog: (n: number) => { backlog = n; }, get closes() { return closes; }, get detached() { return detached; } };
}
function factory(s = socket(), handshakeMs = 1000) {
  let calls = 0;
  const open = createPingOpenAiStreamingTranscription({ model: "gpt-live-transcribe", apiKey: "synthetic-key", handshakeMs,
    connect: async (url, options) => { calls++; assert.equal(url, "wss://eu.api.openai.com/v1/realtime?intent=transcription");
      assert.deepEqual(options.headers, { Authorization: "Bearer synthetic-key" }); return s.port; } });
  return { s, open, get calls() { return calls; } };
}
async function ready(f: ReturnType<typeof factory>) {
  const p = f.open(new AbortController().signal); await settle();
  f.s.emit({ type: "session.created", event_id: "event-created", session: config() });
  f.s.emit({ type: "session.updated", event_id: "event-updated", session: config(true) });
  f.s.emit({ type: "input_audio_buffer.cleared", event_id: "event-cleared" });
  return p;
}

test("fresh real lifecycle verifies effective policy and actual clear before ready; prior/invalid variants refuse", async () => {
  const f = factory(); let published = false;
  const p = f.open(new AbortController().signal).then((v) => { published = true; return v; }); await settle();
  assert.equal(f.s.sends.length, 0);
  f.s.emit({ type: "session.created", event_id: "created", session: config() }); await settle();
  assert.equal(published, false);
  assert.deepEqual(JSON.parse(f.s.sends[0]), { type: "session.update", session: { type: "transcription", audio: { input: {
    format: { type: "audio/pcm", rate: 24000 }, transcription: { model: "gpt-live-transcribe" }, noise_reduction: null, turn_detection: null } }, include: [] } });
  f.s.emit({ type: "conversation.created", event_id: "conversation", conversation: { id: "conv-synthetic", object: "realtime.conversation" } });
  f.s.emit({ type: "session.updated", event_id: "updated", session: config(true) }); await settle();
  assert.equal(published, false); assert.equal(f.s.sends[1], '{"type":"input_audio_buffer.clear"}');
  f.s.emit({ type: "input_audio_buffer.cleared", event_id: "cleared" }); const r = await p;
  assert.deepEqual(r.getUsage(), []); r.transport.close(); await settle(); assert.equal(f.s.closes, 1); assert.equal(f.s.detached, 1);
  for (const mode of ["identity", "model", "format", "vad", "noise", "include", "prior", "unknown"] as const) {
    const bad = factory(), pending = bad.open(new AbortController().signal); const rejection = assert.rejects(pending, /ping_stream_invalid/); await settle();
    bad.s.emit({ type: "session.created", event_id: "created", session: config() });
    const effective = config(true);
    if (mode === "identity") effective.id = "wrong-session";
    if (mode === "model") effective.audio!.input.transcription.model = "gpt-transcribe";
    if (mode === "format") Object.assign(effective.audio!.input.format, { rate: 16000 });
    if (mode === "vad") Object.assign(effective.audio!.input, { turn_detection: { type: "server_vad" } });
    if (mode === "noise") Object.assign(effective.audio!.input, { noise_reduction: { type: "near_field" } });
    if (mode === "include") Object.assign(effective, { include: ["item.input_audio_transcription.logprobs"] });
    if (mode === "prior") bad.s.emit(ack());
    else if (mode === "unknown") bad.s.emit({ type: "rate_limits.updated", event_id: "unknown" });
    else bad.s.emit({ type: "session.updated", event_id: "updated", session: effective });
    await rejection; await settle(); assert.equal(bad.s.closes, 1);
    assert.ok(bad.s.sends.every((s) => JSON.parse(s).type === "session.update"));
  }
  for (const premature of ["update", "clear"] as const) {
    const queued = factory(); let observations = 0, resolved = false;
    const pending = queued.open(new AbortController().signal).then((value) => { resolved = true; return value; });
    const rejection = assert.rejects(pending, /ping_stream_invalid/); await settle();
    queued.s.onQueue(() => {
      observations++;
      if (premature === "update" && observations === 1) queued.s.emit({ type: "session.updated", event_id: "premature-update", session: config(true) });
      if (premature === "clear" && observations === 2) queued.s.emit({ type: "input_audio_buffer.cleared", event_id: "premature-clear" });
    });
    queued.s.emit({ type: "session.created", event_id: "created", session: config() });
    if (premature === "clear") queued.s.emit({ type: "session.updated", event_id: "updated", session: config(true) });
    await rejection; await settle();
    assert.equal(resolved, false); assert.equal(queued.s.closes, 1);
    assert.deepEqual(queued.s.sends.map((text) => JSON.parse(text).type), premature === "update" ? [] : ["session.update"]);
  }
  // Acknowledgments synchronously emitted by the actual send are legitimate.
  const synchronous = factory(); synchronous.s.onSend((text) => {
    if (JSON.parse(text).type === "session.update") synchronous.s.emit({ type: "session.updated", event_id: "sync-update", session: config(true) });
    if (JSON.parse(text).type === "input_audio_buffer.clear") synchronous.s.emit({ type: "input_audio_buffer.cleared", event_id: "sync-clear" });
  });
  const actual = synchronous.open(new AbortController().signal); await settle();
  synchronous.s.emit({ type: "session.created", event_id: "created", session: config() });
  const resolved = await actual; assert.deepEqual(synchronous.s.sends.map((text) => JSON.parse(text).type), ["session.update", "input_audio_buffer.clear"]);
  resolved.transport.close(); await settle();
});

test("exact PCM and real final-before-ACK flow compose with the existing collector and disconnected interpreter once", async () => {
  const f = factory(), r = await ready(f), capture = syntheticCapture(); let calls = 0;
  const interpret = createPingOpenAiInterpreter({ model: "synthetic-model", apiKey: "synthetic-key", fetch: async (_url, init) => {
    calls++; const input = JSON.parse(JSON.parse(init.body as string).input[0].content[0].text);
    assert.deepEqual(input, { version: "ping.interpretation.v1", transcript: final().transcript, selectedTaskCount: 1,
      referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", systemColumnKeys: ["todo", "doing", "review", "done"] });
    return new Response(JSON.stringify({ id: "synthetic-response", status: "completed", error: null, incomplete_details: null,
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", annotations: [], logprobs: [],
        text: JSON.stringify({ proposal: syntheticPlan() }) }] }] }), { headers: { "content-type": "application/json" } }); } });
  const runner = createPingVoiceSession({ capture, now: () => 0, isContextCurrent: () => true, transport: r.transport, interpret });
  runner.acceptPcmFrame({ type: "pcm_frame", generationId: capture.generationId, connectionEpoch: capture.connectionEpoch,
    ordinal: 1, format: "pcm_s16le_mono_24000", bytes: new Uint8Array([1, 128, 1, 0, 254, 127]) });
  assert.equal(f.s.sends[2], append); assert.equal(calls, 0); assert.equal(runner.requestFinish(), true);
  runner.acceptCut({ type: "cut", generationId: capture.generationId, connectionEpoch: capture.connectionEpoch, throughFrame: 1, totalSamples: 3 });
  assert.equal(f.s.sends[3], commit);
  f.s.emit({ type: "conversation.item.created", event_id: "item-created", item: { id: "item-synthetic", type: "message", role: "user", content: [] } });
  f.s.emit({ type: "conversation.item.input_audio_transcription.delta", event_id: "preview", item_id: "item-synthetic", obfuscation: "inert" });
  f.s.emit(final({ type: "tokens", input_tokens: 0, output_tokens: 0, total_tokens: 0, input_token_details: { audio_tokens: 0 } }));
  assert.equal(calls, 0); f.s.emit(ack()); await settle(); await settle();
  assert.equal(calls, 1); assert.deepEqual(runner.getProposal(), syntheticPlan());
  assert.deepEqual(runner.getSnapshot().counters, { appendCalls: 1, appendAccepted: 1, appendedBytes: 6, commitCalls: 1,
    commitAccepted: 1, interpretationCalls: 1, interpretationDescriptors: 1 });
  assert.deepEqual(r.getUsage(), [{ provenance: "transcription", usage: { type: "tokens", input_tokens: 0, output_tokens: 0,
    total_tokens: 0, input_token_details: { audio_tokens: 0 } } }]);
  assert.equal(f.s.sends.length, 4); assert.equal(f.s.closes, 1); runner.dispose();
  // No executor or receipt reader exists in this composition; no application write/read is claimed.
});

test("usage is actual-or-null/private scalar only, duplicates dedupe, and changed identities/content refuse", async () => {
  for (const supplied of [undefined, { type: "duration", seconds: 0 }]) {
    const f = factory(), r = await ready(f); let forwards = 0;
    r.transport.subscribe(() => { forwards++; }, () => {}); r.transport.send(append); r.transport.send(commit);
    f.s.emit(ack()); f.s.emit(final(supplied)); f.s.emit(final(supplied));
    assert.equal(forwards, 3); assert.deepEqual(r.getUsage(), [{ provenance: "transcription", usage: supplied ?? null }]);
    assert.equal(Object.keys(r.getUsage()[0]).includes("itemId"), false); r.transport.close(); await settle();
  }
  for (const mode of ["usage", "text", "predecessor", "item", "truncation", "oversize", "event-cap"] as const) {
    const f = factory(), r = await ready(f); let lost = 0;
    r.transport.subscribe(() => {}, () => { lost++; }); r.transport.send(append); r.transport.send(commit);
    if (mode === "usage") f.s.emit(final(null));
    if (mode === "text") { f.s.emit(final()); f.s.emit({ ...final(), transcript: "changed" }); }
    if (mode === "predecessor") {
      f.s.emit({ type: "conversation.item.added", event_id: "added", previous_item_id: "prior-item",
        item: { id: "item-synthetic", type: "message", role: "user", content: [{ type: "input_audio", transcript: null }] } }); f.s.emit(ack());
    }
    if (mode === "item") { f.s.emit(ack()); f.s.emit({ ...final(), item_id: "wrong-item" }); }
    if (mode === "truncation") f.s.emit({ type: "conversation.item.truncated", event_id: "truncated", item_id: "item-synthetic" });
    if (mode === "oversize") f.s.emit(" ".repeat(65_537));
    if (mode === "event-cap") for (let i = 0; i < 513; i++) f.s.emit({ type: "conversation.item.input_audio_transcription.delta", event_id: "delta", item_id: "item-synthetic" });
    assert.equal(lost, 1); assert.equal(f.s.closes, 1); assert.throws(() => r.transport.send(commit), /ping_stream_closed/);
    await settle();
  }
  const bookkeeping = factory(), r = await ready(bookkeeping); r.transport.subscribe(() => {}, () => {}); r.transport.send(append); r.transport.send(commit);
  bookkeeping.s.emit({ type: "conversation.item.created", event_id: "created", item: { id: "item-synthetic", type: "message", role: "user", content: [] } });
  bookkeeping.s.emit(ack());
  bookkeeping.s.emit({ type: "conversation.item.done", event_id: "done", previous_item_id: null, item: { id: "item-synthetic", type: "message", role: "user", object: "realtime.item", status: "completed", content: [{ type: "input_audio", transcript: final().transcript }] } });
  bookkeeping.s.emit(final()); assert.equal(bookkeeping.s.closes, 0); r.transport.close(); await settle();
});

test("cancellation/deadline retain physical reservation, late events cannot revive, and reentrant queue loss prevents sends", async () => {
  for (const synchronous of [false, true]) {
    let attempts = 0;
    const rejected = createPingOpenAiStreamingTranscription({ model: "gpt-live-transcribe", apiKey: "synthetic-key", connect: () => {
      attempts++; if (synchronous) throw Error("sensitive connector failure"); return Promise.reject(Error("sensitive connector failure"));
    } });
    await assert.rejects(rejected(new AbortController().signal), (error: Error) => error.message === "ping_stream_disconnected");
    await assert.rejects(rejected(new AbortController().signal), /ping_stream_busy/); assert.equal(attempts, 1);
  }
  const subscribed = factory(socket(true)); subscribed.s.onSubscribe(() => subscribed.s.lost());
  await assert.rejects(subscribed.open(new AbortController().signal), /ping_stream_disconnected/);
  assert.equal(subscribed.s.detached, 1); assert.equal(subscribed.s.closes, 1); assert.equal(subscribed.s.sends.length, 0);
  await assert.rejects(subscribed.open(new AbortController().signal), /ping_stream_busy/); subscribed.s.release(); await settle();
  const late = socket(true), connected = deferred<PingStreamingSocket>(); let calls = 0;
  const open = createPingOpenAiStreamingTranscription({ model: "gpt-live-transcribe", apiKey: "synthetic-key", connect: () => { calls++; return connected.promise; } });
  const controller = new AbortController(), p = open(controller.signal), refusal = assert.rejects(p, /ping_stream_cancelled/);
  controller.abort(); await refusal; await assert.rejects(open(new AbortController().signal), /ping_stream_busy/);
  connected.resolve(late.port); await settle(); assert.equal(late.closes, 1); assert.equal(late.sends.length, 0);
  await assert.rejects(open(new AbortController().signal), /ping_stream_busy/); late.release(); await settle();
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(open(aborted.signal), /ping_stream_cancelled/); assert.equal(calls, 1);
  const timeout = factory(socket(true), 15), failure = assert.rejects(timeout.open(new AbortController().signal), /ping_stream_deadline/);
  await failure; assert.equal(timeout.s.closes, 1); await assert.rejects(timeout.open(new AbortController().signal), /ping_stream_busy/);
  timeout.s.emit({ type: "session.created", event_id: "late", session: config() }); assert.equal(timeout.s.sends.length, 0); timeout.s.release(); await settle();
  const f = factory(socket(true)), r = await ready(f); r.transport.subscribe(() => {}, () => {});
  f.s.onQueue(() => f.s.lost()); assert.throws(() => r.transport.send(append), /ping_stream_closed/);
  assert.equal(f.s.sends.length, 2); assert.equal(f.s.closes, 1); await assert.rejects(f.open(new AbortController().signal), /ping_stream_busy/);
  f.s.release(); await settle();
  const again = f.open(new AbortController().signal); const rejection = assert.rejects(again, /ping_stream_disconnected/); await rejection;
  assert.equal(f.calls, 2); // fulfilled closure permits a new supplied attempt, never an automatic retry.
});
