import assert from "node:assert/strict";
import test from "node:test";
import { bindPingProposal } from "@/lib/ping/proposal";
import { syntheticCapture, syntheticPlan } from "@/lib/ping/input-test-fixture";
import { createPingOpenAiInterpreter, parsePingResponsesUsage, PING_RESPONSES_ENDPOINT, PING_RESPONSES_SCHEMA,
  type PingResponsesUsageObservation } from "./openai-interpreter";

const input = { version: "ping.interpretation.v1", transcript: "Assign these to me, due 2026-10-07, move to doing.",
  selectedTaskCount: 1, referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
  systemColumnKeys: ["todo", "doing", "review", "done"] };
const signal = () => new AbortController().signal;
const envelope = (proposal: unknown = syntheticPlan()) => ({ id: "synthetic-response", status: "completed", error: null, incomplete_details: null,
  output: [{ type: "message", role: "assistant", status: "completed", content: [
    { type: "output_text", annotations: [], logprobs: [], text: JSON.stringify({ proposal }) }] }] });
const response = (value: unknown = envelope()) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const options = (fetch: (input: string, init: RequestInit) => Promise<Response>, deadlineMs = 1000) => ({ model: "synthetic-model", apiKey: "synthetic-key", fetch, deadlineMs });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("actual request is fixed EU Responses, closed projection, no storage/background/tools, and valid plan binds trusted capture", async () => {
  let calls = 0;
  const interpret = createPingOpenAiInterpreter(options(async (url, init) => {
    calls++;
    assert.equal(url, PING_RESPONSES_ENDPOINT);
    assert.equal(url, "https://eu.api.openai.com/v1/responses");
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.equal(init.credentials, "omit");
    assert.deepEqual(init.headers, { "Content-Type": "application/json", Authorization: "Bearer synthetic-key" });
    const body = JSON.parse(init.body as string);
    assert.deepEqual(Object.keys(body).sort(), ["background", "input", "instructions", "max_output_tokens", "model", "store", "stream", "text"]);
    assert.equal(body.store, false); assert.equal(body.stream, false); assert.equal(body.background, false);
    assert.ok(body.instructions.includes("The reference instant does not authorize relative dates."));
    assert.equal(body.text.format.type, "json_schema"); assert.equal(body.text.format.strict, true);
    assert.deepEqual(body.text.format.schema, PING_RESPONSES_SCHEMA);
    assert.deepEqual(JSON.parse(body.input[0].content[0].text), input);
    return response();
  }));
  const proposal = await interpret(input, signal());
  assert.deepEqual(proposal, syntheticPlan()); assert.equal(calls, 1);
  const capture = syntheticCapture();
  const binding = bindPingProposal(proposal, capture, { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
  assert.equal(binding.ok, true);
  if (binding.ok) {
    assert.equal(binding.command.commandId, capture.commandId);
    assert.equal(binding.command.projectId, "synthetic-project");
    assert.deepEqual(JSON.parse(JSON.stringify(binding.command.operation)), { kind: "edit_selected", taskIds: ["synthetic-task"],
      effects: { selfAssignment: "add", dueDate: "2026-10-07", statusColumnKey: "doing" },
      expected: { "synthetic-task": { assignees: ["synthetic-other"], due: null, dueAtSeconds: null, startDay: 20000,
        durationDays: 2, lane: "todo", boardColumnKey: null, completedAtSeconds: null } } });
  }
});

test("every schema object is closed with all its properties required; omitted effects differ from explicit clearing", async () => {
  function inspect(value: unknown) {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.type === "object") { assert.equal(record.additionalProperties, false); assert.deepEqual(record.required, Object.keys(record.properties as object)); }
    for (const child of Object.values(record)) inspect(child);
  }
  inspect(PING_RESPONSES_SCHEMA);
  assert.equal(PING_RESPONSES_SCHEMA.type, "object");
  assert.equal(Object.hasOwn(PING_RESPONSES_SCHEMA, "anyOf"), false);
  for (const effects of [{ statusColumnKey: "doing" }, { dueDate: null }]) {
    const plan = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects } };
    const result = await createPingOpenAiInterpreter(options(async () => response(envelope(plan))))(input, signal());
    assert.deepEqual(result, plan); assert.equal(Object.isFrozen(result), true);
  }
  const create = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count: 10, effects: {} } };
  const result = await createPingOpenAiInterpreter(options(async () => response(envelope(create))))({ ...input, selectedTaskCount: 0 }, signal());
  assert.deepEqual(result, create); assert.equal(Object.hasOwn((result as typeof create).operation, "title"), false);
});

test("legitimate whole-input refusal/clarification is distinct from provider refusal", async () => {
  for (const outcome of ["refusal", "clarification"]) {
    const value = { version: "ping.proposal.v1", outcome, reason: "unsupported" };
    assert.deepEqual(await createPingOpenAiInterpreter(options(async () => response(envelope(value))))(input, signal()), value);
  }
  await assert.rejects(createPingOpenAiInterpreter(options(async () => response({ status: "completed", output: [
    { type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "synthetic" }] }] })))(input, signal()), /invalid_response$/);
});

test("malformed input and configuration fail before physical calls", async () => {
  let calls = 0;
  const interpret = createPingOpenAiInterpreter(options(async () => { calls++; return response(); }));
  const getter = Object.defineProperty({ ...input }, "transcript", { enumerable: true, get() { throw new Error("must not run"); } });
  const malformed = [{ ...input, actorId: "synthetic" }, { ...input, transcript: "x".repeat(4001) }, { ...input, selectedTaskCount: 11 },
    { ...input, timeZone: "UTC" }, { ...input, systemColumnKeys: ["doing", "todo", "review", "done"] }, getter,
    { ...input, referenceInstant: "2026-10-06" }];
  for (const value of malformed) await assert.rejects(interpret(value, signal()), /invalid_input$/);
  assert.equal(calls, 0);
  assert.throws(() => createPingOpenAiInterpreter({ ...options(async () => response()), apiKey: "bad\nheader" }), /configuration$/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(interpret(input, controller.signal), /cancelled$/); assert.equal(calls, 0);
});

test("incomplete, tool, reasoning, ambiguous, wrong-role and authority-bearing outputs reject wholesale", async () => {
  const base = envelope();
  const malformed: unknown[] = [{ ...base, status: "incomplete" }, { ...base, error: {} }, { ...base, incomplete_details: {} },
    { ...base, output_text: base.output[0].content[0].text }, { ...base, output: [...base.output, ...base.output] },
    { ...base, output: [{ type: "reasoning" }, ...base.output] }, { ...base, output: [{ type: "function_call" }] },
    { ...base, output: [{ ...base.output[0], role: "user" }] },
    { ...base, output: [{ ...base.output[0], content: [...base.output[0].content, ...base.output[0].content] }] },
    envelope({ ...syntheticPlan(), actorId: "synthetic" }), envelope({ ...syntheticPlan(), operation: { kind: "edit_selected", effects: {} } }),
    envelope({ ...syntheticPlan(), operation: { kind: "edit_selected", effects: { dueDate: "2026-02-30" } } }),
    envelope({ ...syntheticPlan(), operation: { kind: "edit_selected", effects: { statusColumnKey: "custom" } } }),
    envelope({ ...syntheticPlan(), operation: { kind: "edit_selected", taskIds: ["synthetic"], effects: { selfAssignment: "add" } } }),
    envelope({ ...syntheticPlan(), operation: { kind: "create_placeholders", count: 1, effects: {} } })];
  for (const value of malformed) await assert.rejects(createPingOpenAiInterpreter(options(async () => response(value)))(input, signal()), /invalid_response$/);
  for (const operation of [{ kind: "create_placeholders", count: 11, effects: {} },
    { kind: "create_placeholders", count: 1, effects: { selfAssignment: "remove" } },
    { kind: "create_placeholders", count: 1, title: " ", effects: {} }]) {
    await assert.rejects(createPingOpenAiInterpreter(options(async () => response(envelope({ version: "ping.proposal.v1", outcome: "plan", operation }))))({ ...input, selectedTaskCount: 0 }, signal()), /invalid_response$/);
  }
});

test("actual streamed byte cap and fatal UTF-8 reject; response errors remain fixed and content-free", async () => {
  let cancelled = 0;
  const oversized = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65_537)); }, cancel() { cancelled++; } }),
    { headers: { "content-type": "application/json" } });
  await assert.rejects(createPingOpenAiInterpreter(options(async () => oversized))(input, signal()), { message: "ping_interpretation_invalid_response" });
  assert.equal(cancelled, 1);
  for (const invalid of [new Response(new Uint8Array([0xc3]), { headers: { "content-type": "application/json" } }),
    new Response("{}", { status: 429 }), new Response("{}", { headers: { "content-type": "text/html" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": "999999" } })]) {
    await assert.rejects(createPingOpenAiInterpreter(options(async () => invalid))(input, signal()), /invalid_response$/);
  }
  await assert.rejects(createPingOpenAiInterpreter(options(async () => { throw new Error("synthetic secret provider detail"); }))(input, signal()),
    { message: "ping_interpretation_invalid_response" });
});

test("deadline wins ignored abort; original physical call stays busy and late body is cancelled before reuse", async () => {
  const pending = deferred<Response>(); let calls = 0; let cancelled = 0;
  const interpret = createPingOpenAiInterpreter(options(async () => { calls++; return calls === 1 ? pending.promise : response(); }, 10));
  await assert.rejects(interpret(input, signal()), /deadline$/);
  await assert.rejects(interpret(input, signal()), /busy$/); assert.equal(calls, 1);
  pending.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }));
  await settle(); assert.equal(cancelled, 1);
  assert.deepEqual(await interpret(input, signal()), syntheticPlan()); assert.equal(calls, 2);
});

test("caller cancellation during stalled body rejects now but holds physical reservation until cancellation settles", async () => {
  const cancelSettled = deferred<void>(); const began = deferred<void>(); let calls = 0; let cancellations = 0;
  const observations: PingResponsesUsageObservation[] = [];
  const interpret = createPingOpenAiInterpreter({ ...options(async () => {
    calls++;
    if (calls > 1) return response();
    return new Response(new ReadableStream({ start() { began.resolve(); }, cancel() { cancellations++; return cancelSettled.promise; } }),
      { headers: { "content-type": "application/json" } });
  }), onUsage: observation => observations.push(observation) });
  const controller = new AbortController(); const pending = interpret(input, controller.signal);
  await began.promise; await settle(); controller.abort();
  await assert.rejects(pending, /cancelled$/);
  await assert.rejects(interpret(input, signal()), /busy$/); assert.equal(calls, 1); assert.equal(cancellations, 1);
  assert.deepEqual(observations.map(value => [value.state, value.usage]), [["unavailable", null]]);
  cancelSettled.resolve(); await settle();
  assert.deepEqual(await interpret(input, signal()), syntheticPlan()); assert.equal(calls, 2);
  assert.deepEqual(observations.map(value => [value.state, value.usage]), [["unavailable", null], ["absent", null]]);
});

test("synchronous injected fetch cancellation cannot revive interpretation", async () => {
  const controller = new AbortController(); let cancelled = 0;
  const interpret = createPingOpenAiInterpreter(options(async () => {
    controller.abort();
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } });
  }));
  await assert.rejects(interpret(input, controller.signal), /cancelled$/); await settle(); assert.equal(cancelled, 1);
});

const actualUsage = () => ({ input_tokens: 10, output_tokens: 2, total_tokens: 12,
  input_tokens_details: { cached_tokens: 3, cache_write_tokens: 1 }, output_tokens_details: { reasoning_tokens: 1 } });
test("optional usage is closed copied metadata, including real zeros, absence and invalidity without operation authority", async () => {
  const zero = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const cases = [actualUsage(), zero, undefined, null, { ...zero, total_tokens: 1 }, { ...zero, input_tokens_details: null },
    { ...zero, input_tokens_details: { cached_tokens: null } }, { ...zero, output_tokens_details: { reasoning_tokens: -1 } },
    { ...zero, price: 0 }, { ...zero, input_tokens_details: { audio_tokens: 0 } }, { ...zero, input_tokens: Number.MAX_SAFE_INTEGER + 1 }];
  for (const usage of cases) {
    const observations: PingResponsesUsageObservation[] = [];
    const result = await createPingOpenAiInterpreter({ ...options(async () => response({ ...envelope(), usage })),
      onUsage: observation => observations.push(observation) })(input, signal());
    assert.deepEqual(result, syntheticPlan()); assert.equal(observations.length, 1);
    const observation = observations[0], parsed = parsePingResponsesUsage(usage);
    assert.deepEqual(Object.keys(observation).sort(), ["provenance", "state", "usage", "version"]);
    assert.equal(observation.state, parsed === false ? "invalid" : parsed === null ? "absent" : "observed");
    assert.deepEqual(observation.usage, parsed || null); assert.ok(Object.isFrozen(observation));
    if (observation.usage) { assert.ok(Object.isFrozen(observation.usage)); assert.notEqual(observation.usage, usage); }
  }
  const mutable = actualUsage(), copied = parsePingResponsesUsage(mutable);
  assert.ok(copied); mutable.input_tokens_details.cached_tokens = 9;
  assert.equal(copied.input_tokens_details?.cached_tokens, 3); assert.ok(Object.isFrozen(copied.input_tokens_details));
  const failed: PingResponsesUsageObservation[] = [];
  await assert.rejects(createPingOpenAiInterpreter({ ...options(async () => response({ ...envelope({ actorId: "not-authority" }), usage: actualUsage() })),
    onUsage: observation => failed.push(observation) })(input, signal()), /invalid_response$/);
  assert.equal(failed[0].state, "observed"); assert.deepEqual(failed[0].usage, actualUsage());
});

test("once diagnostic publication follows the original outcome and cannot throw, abort or reenter physical ownership", async () => {
  for (const promiseRejection of [false, true]) {
    let calls = 0, notifications = 0; const controller = new AbortController();
    let reentrant!: Promise<unknown>;
    const supplied = { ...options(async () => { calls++; return response({ ...envelope(), usage: actualUsage() }); }),
      onUsage: (observation: PingResponsesUsageObservation) => {
        notifications++; assert.equal(observation.state, "observed");
        reentrant = assert.rejects(interpret(input, signal()), /busy$/); controller.abort();
        if (promiseRejection) return Promise.reject(Error("synthetic diagnostic rejection"));
        throw Error("synthetic diagnostic throw");
      } };
    const interpret = createPingOpenAiInterpreter(supplied);
    supplied.onUsage = () => { throw Error("must not replace captured observer"); };
    assert.deepEqual(await interpret(input, controller.signal), syntheticPlan());
    await reentrant; await settle(); assert.equal(calls, 1); assert.equal(notifications, 1);
    await assert.rejects(interpret({ ...input, actorId: "invalid" }, signal()), /invalid_input$/);
    await assert.rejects(interpret(input, controller.signal), /cancelled$/); assert.equal(notifications, 1);
  }
});

test("cancelled or expired actual fetch publishes unavailable once and late usage cannot populate a new invocation", async t => {
  let now = 0; const clock = t.mock.method(performance, "now", () => now);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const reason of ["cancelled", "deadline"] as const) {
      now = 0; const held = deferred<Response>(), controller = new AbortController();
      let calls = 0, cancellations = 0; const observations: PingResponsesUsageObservation[] = [];
      const interpret = createPingOpenAiInterpreter({ ...options(async () => { calls++; return calls === 1 ? held.promise : response({ ...envelope(), usage: actualUsage() }); }, 1000),
        onUsage: observation => observations.push(observation) });
      const pending = interpret(input, controller.signal);
      if (reason === "cancelled") controller.abort(); else { now = 1000; t.mock.timers.tick(1000); }
      await assert.rejects(pending, new RegExp(`${reason}$`));
      assert.deepEqual(observations, [{ version: "ping.responses-usage.v1", provenance: "interpretation", state: "unavailable", usage: null }]);
      await assert.rejects(interpret(input, signal()), /busy$/); assert.equal(calls, 1);
      held.resolve(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify({ ...envelope(), usage: actualUsage() }))); },
        cancel() { cancellations++; } }), { headers: { "content-type": "application/json" } }));
      await settle(); assert.equal(cancellations, 1); assert.equal(observations.length, 1);
      assert.deepEqual(await interpret(input, signal()), syntheticPlan()); assert.equal(calls, 2);
      assert.equal(observations.length, 2); assert.equal(observations[1].state, "observed");
    }
  } finally { t.mock.timers.reset(); clock.mock.restore(); }
});
