import assert from "node:assert/strict";
import test from "node:test";
import { createPingClaudeHaikuInterpreter, PING_CLAUDE_HAIKU_MODEL, PING_CLAUDE_HAIKU_SCHEMA,
  PING_CLAUDE_MESSAGES_ENDPOINT } from "./claude-haiku-interpreter";
import type { PingResponsesUsageObservation } from "./openai-interpreter";

const input = { version: "ping.interpretation.v1", transcript: "Assign this task to me and move it to in progress.",
  selectedTaskCount: 1, referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
  systemColumnKeys: ["todo", "doing", "review", "done"] };
const proposal = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } };
const envelope = (value: unknown = proposal, usage: unknown = { input_tokens: 5, output_tokens: 8,
  cache_creation_input_tokens: 2, cache_read_input_tokens: 1 }) => ({ type: "message", role: "assistant", model: PING_CLAUDE_HAIKU_MODEL,
  content: [{ type: "text", text: JSON.stringify({ proposal: value }) }], stop_reason: "end_turn", stop_sequence: null,
  usage, id: "synthetic-message-id" });
const response = (value: unknown = envelope()) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const options = (fetch: (input: string, init: RequestInit) => Promise<Response>, deadlineMs = 1_000,
  onUsage?: (value: PingResponsesUsageObservation) => unknown) => ({ apiKey: "synthetic-key", developmentOnly: true as const, fetch, deadlineMs, onUsage });
const signal = () => new AbortController().signal;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test("fixed public request projects only the synthetic fixture and parses the shared validated proposal", async () => {
  let calls = 0;
  const observations: PingResponsesUsageObservation[] = [];
  const interpret = createPingClaudeHaikuInterpreter(options(async (url, init) => {
    calls++;
    assert.equal(url, PING_CLAUDE_MESSAGES_ENDPOINT); assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store"); assert.equal(init.credentials, "omit");
    assert.deepEqual(init.headers, { "content-type": "application/json", "x-api-key": "synthetic-key", "anthropic-version": "2023-06-01" });
    const body = JSON.parse(init.body as string);
    assert.deepEqual(Object.keys(body).sort(), ["max_tokens", "messages", "model", "output_config", "stream", "system", "thinking"]);
    assert.equal(body.model, "claude-haiku-5-5"); assert.equal(body.max_tokens, 1024); assert.equal(body.stream, false);
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.deepEqual(JSON.parse(body.messages[0].content), input);
    assert.equal(JSON.stringify(body).includes("task-id"), false);
    assert.deepEqual(body.output_config.format, { type: "json_schema", schema: PING_CLAUDE_HAIKU_SCHEMA });
    return response({ ...envelope(), usage: { input_tokens: 5, output_tokens: 8, cache_creation_input_tokens: 2,
      cache_read_input_tokens: 1, service_tier: "standard", future_metadata: { ignored: true } } });
  }, 1_000, value => observations.push(value)));

  assert.deepEqual(await interpret(input, signal()), proposal);
  assert.equal(calls, 1);
  assert.deepEqual(observations.map(({ state, usage }) => [state, usage]), [["observed", {
    input_tokens: 8, output_tokens: 8, total_tokens: 16,
    input_tokens_details: { cached_tokens: 1, cache_write_tokens: 2 },
  }]]);
  assert.ok(Object.isFrozen(observations[0]));
});

test("prompt admission accepts only the one approved public six-field input and rejects before fetch", async () => {
  let calls = 0;
  const interpret = createPingClaudeHaikuInterpreter(options(async () => { calls++; return response(); }));
  for (const invalid of [
    { ...input, transcript: "private task text" },
    { ...input, selectedTaskCount: 2 },
    { ...input, referenceInstant: "2026-10-06T10:00:00.000Z" },
    { ...input, taskIds: ["secret-id"] },
  ]) await assert.rejects(interpret(invalid, signal()), { message: "ping_claude_interpretation_invalid_input" });
  assert.equal(calls, 0);
  assert.throws(() => createPingClaudeHaikuInterpreter({ ...options(async () => response()), developmentOnly: false } as never),
    { message: "ping_claude_interpretation_configuration" });
});

test("schema request drops unsupported API bounds while local proposal parser still enforces them", async () => {
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { for (const entry of value) visit(entry); return; }
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      assert.equal(["minimum", "maximum", "minLength", "maxLength"].includes(key), false);
      visit((value as Record<string, unknown>)[key]);
    }
  };
  visit(PING_CLAUDE_HAIKU_SCHEMA);
  const invalid = { ...proposal, operation: { kind: "create_placeholders", count: 11, effects: { selfAssignment: "add" } } };
  await assert.rejects(createPingClaudeHaikuInterpreter(options(async () => response(invalid)))(input, signal()),
    { message: "ping_claude_interpretation_invalid_response" });
});

test("only end_turn and one text block are accepted; refusal, truncation, tool blocks and malformed JSON fail closed", async () => {
  const cases = [
    { ...envelope(), stop_reason: "max_tokens" },
    { ...envelope(), stop_reason: "refusal" },
    { ...envelope(), content: [{ type: "tool_use", id: "synthetic-tool", name: "tool", input: {} }] },
    { ...envelope(), content: [{ type: "text", text: "{}" }, { type: "text", text: "{}" }] },
    { ...envelope(), content: [{ type: "text", text: "{" }] },
  ];
  let calls = 0;
  for (const value of cases) {
    await assert.rejects(createPingClaudeHaikuInterpreter(options(async () => { calls++; return response(value); }))(input, signal()),
      { message: "ping_claude_interpretation_invalid_response" });
  }
  assert.equal(calls, cases.length);
});

test("usage stays unknown when cache billing counters are incomplete and invalid counters never reject valid interpretation", async () => {
  const results: PingResponsesUsageObservation[] = [];
  const interpret = createPingClaudeHaikuInterpreter(options(async () => response({ ...envelope(),
    usage: { input_tokens: 5, output_tokens: 8, cache_read_input_tokens: null, cache_creation_input_tokens: null, cache_future_field: 0 } }),
  1_000, value => results.push(value)));
  assert.deepEqual(await interpret(input, signal()), proposal);
  assert.deepEqual(results.map(value => [value.state, value.usage]), [["unavailable", null]]);

  const invalidResults: PingResponsesUsageObservation[] = [];
  const invalid = createPingClaudeHaikuInterpreter(options(async () => response({ ...envelope(),
    usage: { input_tokens: -1, output_tokens: 8, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }),
  1_000, value => invalidResults.push(value)));
  assert.deepEqual(await invalid(input, signal()), proposal);
  assert.deepEqual(invalidResults.map(value => [value.state, value.usage]), [["invalid", null]]);
});

test("secret echo and oversized responses return only fixed errors", async () => {
  const echo = createPingClaudeHaikuInterpreter(options(async () => response(envelope(proposal))));
  const result = envelope(proposal);
  result.content[0]!.text = JSON.stringify({ proposal, harmless: "synthetic-key" });
  await assert.rejects(createPingClaudeHaikuInterpreter(options(async () => response(result)))(input, signal()),
    { message: "ping_claude_interpretation_invalid_response" });
  assert.equal(typeof echo, "function");

  let cancelled = 0;
  const body = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65_537)); },
    cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } });
  await assert.rejects(createPingClaudeHaikuInterpreter(options(async () => body))(input, signal()),
    { message: "ping_claude_interpretation_invalid_response" });
  assert.equal(cancelled, 1);
});

test("cancel/deadline settle publicly but hold the physical busy latch through fetch and reader settlement", async () => {
  const pendingFetch = deferred<Response>(); let fetchCalls = 0, cancelledBody = 0;
  const interpret = createPingClaudeHaikuInterpreter(options(async () => { fetchCalls++; return pendingFetch.promise; }, 20));
  await assert.rejects(interpret(input, signal()), { message: "ping_claude_interpretation_deadline" });
  await assert.rejects(interpret(input, signal()), { message: "ping_claude_interpretation_busy" });
  pendingFetch.resolve(new Response(new ReadableStream({ cancel() { cancelledBody++; } }), { headers: { "content-type": "application/json" } }));
  await settle();
  assert.equal(fetchCalls, 1); assert.equal(cancelledBody, 1);

  const cancelGate = deferred<void>(), bodyStarted = deferred<void>(); let calls = 0;
  const bodyInterpret = createPingClaudeHaikuInterpreter(options(async () => {
    calls++;
    if (calls > 1) return response();
    return new Response(new ReadableStream({ start() { bodyStarted.resolve(); }, cancel() { return cancelGate.promise; } }),
      { headers: { "content-type": "application/json" } });
  }));
  const controller = new AbortController();
  const pending = bodyInterpret(input, controller.signal);
  await bodyStarted.promise; await settle(); controller.abort();
  await assert.rejects(pending, { message: "ping_claude_interpretation_cancelled" });
  await assert.rejects(bodyInterpret(input, signal()), { message: "ping_claude_interpretation_busy" });
  cancelGate.resolve(); await settle();
  assert.deepEqual(await bodyInterpret(input, signal()), proposal);
  assert.equal(calls, 2);
});

test("a forged corpus token cannot authorize unrelated interpretation text",async()=>{
 let calls=0;const interpret=createPingClaudeHaikuInterpreter({developmentOnly:true,apiKey:"public-fixture-key",corpusAdmission:{} as never,
 fetch:async()=>{calls++;throw Error("not dispatched");}});
 await assert.rejects(interpret({version:"ping.interpretation.v1",transcript:"Move the selected task to win progress.",selectedTaskCount:1,
 referenceInstant:"2026-10-06T09:00:00.000Z",timeZone:"Europe/Dublin",systemColumnKeys:["todo","doing","review","done"]},new AbortController().signal),/invalid_input/);
 assert.equal(calls,0);
});
