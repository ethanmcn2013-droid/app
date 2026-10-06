import assert from "node:assert/strict";
import test from "node:test";
import { PING_OPENAI_NATIVE_AUDIO_ENDPOINT, createPingOpenAiNativeAudio } from "./openai-native-audio";

const MODEL = "gpt-audio-1.5";
const KEY = "synthetic-test-key";
const context = () => ({ selectedTaskCount: 2, referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
  systemColumnKeys: ["todo", "doing", "review", "done"] });
const pcm = () => new Uint8Array([0x00, 0x80, 0xff, 0x7f]);
const selectedPlan = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected",
  effects: { selfAssignment: "add", dueDate: "2026-10-08", statusColumnKey: "doing" } } };
const createPlan = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count: 3,
  title: "Research and review", effects: { selfAssignment: "add", statusColumnKey: "todo" } } };
function response(args: unknown, fields: Record<string, unknown> = {}, init: ResponseInit = {}) {
  const value = { id: "chatcmpl-synthetic", object: "chat.completion", created: 1_791_278_400, model: MODEL,
    choices: [{ index: 0, message: { role: "assistant", tool_calls: [{ id: "call_synthetic", type: "function",
      function: { name: "submit_ping_proposal", arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }], ...fields };
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, ...init });
}
const answer = (proposal: unknown, usage?: unknown) => response({ proposal }, usage === undefined ? {} : { usage });
function options(fetch: (input: string, init: RequestInit) => Promise<Response>, deadlineMs = 1000) {
  return { model: MODEL, apiKey: KEY, fetch, deadlineMs } as const;
}
function signal() { return new AbortController().signal; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = () => pause(0);

test("one native request projects only owned WAV and four context fields into the fixed function request", async () => {
  const audio = pcm(), captured = context(); let calls = 0;
  const interpret = createPingOpenAiNativeAudio(options(async (url, init) => {
    calls++;
    assert.equal(url, PING_OPENAI_NATIVE_AUDIO_ENDPOINT);
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit"); assert.deepEqual(init.headers, { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` });
    const request = JSON.parse(init.body as string);
    assert.equal(request.model, MODEL); assert.equal(request.stream, false); assert.equal(request.store, false);
    assert.deepEqual(request.modalities, ["text"]); assert.equal(request.max_completion_tokens, 2048);
    assert.deepEqual(request.tool_choice, { type: "function", function: { name: "submit_ping_proposal" } });
    assert.equal(request.parallel_tool_calls, false); assert.equal(request.tools.length, 1);
    assert.equal(request.tools[0].function.name, "submit_ping_proposal"); assert.equal(request.tools[0].function.strict, false);
    assert.deepEqual(Object.keys(request.tools[0].function.parameters), ["type", "properties", "required", "additionalProperties"]);
    assert.equal(request.response_format, undefined); assert.equal(request.instructions, undefined);
    assert.equal(request.messages.length, 2); assert.equal(request.messages[0].role, "system");
    assert.match(request.messages[0].content, /Respect corrections and every clause/);
    const message = request.messages[1]; assert.equal(message.role, "user");
    const [contextPart, audioPart] = message.content;
    assert.equal(contextPart.type, "text");
    assert.deepEqual(JSON.parse(contextPart.text), { selectedTaskCount: 2, referenceInstant: "2026-10-06T09:00:00.000Z",
      timeZone: "Europe/Dublin", systemColumnKeys: ["todo", "doing", "review", "done"] });
    assert.deepEqual(Object.keys(JSON.parse(contextPart.text)).sort(), ["referenceInstant", "selectedTaskCount", "systemColumnKeys", "timeZone"]);
    assert.equal(audioPart.type, "input_audio"); assert.equal(audioPart.input_audio.format, "wav");
    const wav = Buffer.from(audioPart.input_audio.data, "base64");
    assert.equal(wav.length, 48); assert.equal(wav.toString("ascii", 0, 4), "RIFF"); assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt32LE(24), 24000); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt16LE(34), 16);
    assert.deepEqual([...wav.subarray(44)], [0, 128, 255, 127]);
    audio.fill(0); captured.selectedTaskCount = 0;
    return answer(selectedPlan, { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 });
  }));
  const result = await interpret(audio, captured, signal());
  assert.equal(calls, 1); assert.deepEqual(result.proposal, selectedPlan);
  assert.deepEqual(result.usage, { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 });
  assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.proposal), true);
});

test("complete local proposals remain inert and actual scalar usage preserves optional zeros or unknown null", async () => {
  const cases: Array<{ selected: number; proposal: unknown; usage?: unknown }> = [
    { selected: 2, proposal: selectedPlan, usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25,
      prompt_tokens_details: { audio_tokens: 0, cached_tokens: 2 },
      completion_tokens_details: { audio_tokens: 7, reasoning_tokens: 0, accepted_prediction_tokens: 0, rejected_prediction_tokens: 0 } } },
    { selected: 0, proposal: createPlan },
    { selected: 2, proposal: { version: "ping.proposal.v1", outcome: "refusal", reason: "unsupported" }, usage: null },
    { selected: 2, proposal: { version: "ping.proposal.v1", outcome: "clarification", reason: "ambiguous" } },
  ];
  for (const item of cases) {
    const interpret = createPingOpenAiNativeAudio(options(async () => answer(item.proposal, item.usage)));
    const result = await interpret(pcm(), { ...context(), selectedTaskCount: item.selected }, signal());
    assert.deepEqual(result.proposal, item.proposal);
    assert.deepEqual(result.usage, item.usage && Object.keys(item.usage as object).length ? item.usage : null);
    assert.equal(Object.isFrozen(result), true);
  }
  const malformedUsage = [
    { prompt_tokens: -1, completion_tokens: 2, total_tokens: 1 },
    { prompt_tokens: 1, completion_tokens: 2, total_tokens: 4 },
    { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cost: 0 },
    { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, prompt_tokens_details: { audio_tokens: -1 } },
    { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, completion_tokens_details: { vendor_tokens: 1 } },
  ];
  for (const usage of malformedUsage) await assert.rejects(createPingOpenAiNativeAudio(options(async () => answer(selectedPlan, usage)))(pcm(), context(), signal()),
    { message: "ping_native_audio_invalid_response" });
});

test("whole response, alternatives, tools, argument grammar and bounded body failures refuse without a prefix", async () => {
  const base = { id: "chatcmpl-synthetic", object: "chat.completion", created: 1_791_278_400, model: MODEL,
    choices: [{ index: 0, message: { role: "assistant", tool_calls: [{ id: "call_synthetic", type: "function",
      function: { name: "submit_ping_proposal", arguments: JSON.stringify({ proposal: selectedPlan }) } }] }, finish_reason: "tool_calls" }] };
  const invalid: unknown[] = [
    { ...base, extra: true }, { ...base, choices: [] }, { ...base, choices: [...base.choices, ...base.choices] },
    { ...base, choices: [{ ...base.choices[0], finish_reason: "stop" }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message, content: "spoken alternative" } }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message, refusal: "refused" } }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message, function_call: { name: "legacy" } } }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message,
      tool_calls: [...base.choices[0].message.tool_calls, ...base.choices[0].message.tool_calls] } }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message,
      tool_calls: [{ ...base.choices[0].message.tool_calls[0], injected: true }] } }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message,
      tool_calls: [{ ...base.choices[0].message.tool_calls[0], function: { name: "other", arguments: "{}" } }] } }] },
    { ...base, choices: [{ ...base.choices[0], message: { ...base.choices[0].message,
      tool_calls: [{ ...base.choices[0].message.tool_calls[0], function: { name: "submit_ping_proposal", arguments: "{\"proposal\":{\"actorId\":\"x\"}}" } }] } }] },
  ];
  for (const value of invalid) {
    await assert.rejects(createPingOpenAiNativeAudio(options(async () => new Response(JSON.stringify(value),
      { headers: { "content-type": "application/json" } })))(pcm(), context(), signal()), { message: "ping_native_audio_invalid_response" });
  }
  const tooLarge = new Response(new Uint8Array(65_537), { headers: { "content-type": "application/json" } });
  const invalidUtf8 = new Response(new Uint8Array([0xc3]), { headers: { "content-type": "application/json" } });
  for (const bad of [tooLarge, invalidUtf8, new Response("{}", { status: 429 }),
    new Response("{}", { headers: { "content-type": "text/html" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": "999999" } })]) {
    await assert.rejects(createPingOpenAiNativeAudio(options(async () => bad))(pcm(), context(), signal()), { message: "ping_native_audio_invalid_response" });
  }
});

test("invalid or hostile context and PCM never fetch; reentrant calls cannot overlap", async () => {
  let calls = 0;
  const contextBad = [
    { ...context(), actorId: "synthetic" }, { ...context(), selectedTaskCount: 11 }, { ...context(), timeZone: "UTC" },
    { ...context(), referenceInstant: "2026-10-06" }, { ...context(), systemColumnKeys: ["todo", "doing", "review", "custom"] },
    Object.defineProperty(context(), "selectedTaskCount", { enumerable: true, get() { throw new Error("must not run"); } }),
    new Proxy(context(), { getPrototypeOf() { throw new Error("hostile"); } }),
  ];
  const malformedPcm: unknown[] = [new Uint8Array(0), new Uint8Array(3), new Uint8Array(1_440_002),
    new (class extends Uint8Array {})([1, 2])];
  const neverFetch = async () => { calls++; return answer(selectedPlan); };
  const interpret = createPingOpenAiNativeAudio(options(neverFetch));
  for (const invalid of contextBad) await assert.rejects(interpret(pcm(), invalid, signal()), { message: "ping_native_audio_invalid_input" });
  for (const invalid of malformedPcm) await assert.rejects(interpret(invalid, context(), signal()), { message: "ping_native_audio_invalid_input" });
  assert.equal(calls, 0);

  let nested: Promise<unknown> = Promise.resolve();
  const reentrant = createPingOpenAiNativeAudio(options(async () => {
    nested = reentrant(pcm(), context(), signal());
    return answer(selectedPlan);
  }));
  assert.deepEqual((await reentrant(pcm(), context(), signal())).proposal, selectedPlan);
  await assert.rejects(nested, { message: "ping_native_audio_busy" });
});

test("pre-abort, deadline and late physical settlement keep the single-flight reservation honest", async () => {
  let calls = 0; const alreadyAborted = new AbortController(); alreadyAborted.abort();
  const immediate = createPingOpenAiNativeAudio(options(async () => { calls++; return answer(selectedPlan); }));
  await assert.rejects(immediate(pcm(), context(), alreadyAborted.signal), { message: "ping_native_audio_cancelled" }); assert.equal(calls, 0);

  const pending = deferred<Response>(); let cancelled = 0;
  const deadline = createPingOpenAiNativeAudio(options(async () => { calls++; return pending.promise; }, 40));
  await assert.rejects(deadline(pcm(), context(), signal()), { message: "ping_native_audio_deadline" });
  await assert.rejects(deadline(pcm(), context(), signal()), { message: "ping_native_audio_busy" }); assert.equal(calls, 1);
  pending.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }));
  for (let i = 0; i < 20 && cancelled === 0; i++) await settle();
  assert.equal(cancelled, 1);
  const retry = createPingOpenAiNativeAudio(options(async () => { calls++; return answer(selectedPlan); }));
  assert.deepEqual((await retry(pcm(), context(), signal())).proposal, selectedPlan); assert.equal(calls, 2);
});
