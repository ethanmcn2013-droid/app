import assert from "node:assert/strict";
import test from "node:test";
import { createPingInput, stepPingInput, type PingInputEffect, type PingInputState } from "./input-protocol";
import { evaluatePingWholePlan } from "./evaluation";
import { normalizePingCapture } from "./proposal";

// Independent literal oracle. This file deliberately does not import the owning test fixture.
const CAPTURE = {
  generationId: "independent-generation-51",
  connectionEpoch: "independent-connection-51",
  contextKey: "cedar-selection-rev-4",
  sessionId: "session-trusted-ada",
  actorId: "actor-ada",
  inputItemId: "aggregate-input-51",
  commandId: "00000000-0000-4000-8000-000000000051",
  projectId: "project-cedar",
  selectedTaskIds: ["task-cedar-a", "task-cedar-b"],
  snapshots: {
    "task-cedar-a": {
      assignees: ["collaborator-lee"], due: null, dueAtSeconds: null, startDay: 15, durationDays: 2,
      lane: "todo", boardColumnKey: null, completedAtSeconds: null,
    },
    "task-cedar-b": {
      assignees: ["actor-ada", "collaborator-lee"], due: "2026-10-18", dueAtSeconds: 1792314000,
      startDay: 18, durationDays: 3, lane: "doing", boardColumnKey: null, completedAtSeconds: null,
    },
  },
  referenceInstant: "2026-10-06T09:00:00.000Z",
  timeZone: "Europe/Dublin",
  expectedColumnConfig: "{\"doneKeys\":[\"done\"]}",
} as const;

const COMPOUND_PLAN = {
  version: "ping.proposal.v1",
  outcome: "plan",
  operation: {
    kind: "edit_selected",
    effects: { selfAssignment: "add", dueDate: "2026-10-20", statusColumnKey: "doing" },
  },
} as const;

const REFUSAL = { version: "ping.proposal.v1", outcome: "refusal", reason: "unsupported" } as const;

function machine(retired: readonly { generationId: string; connectionEpoch: string }[] = []) {
  const initialized = createPingInput(CAPTURE, 0, retired);
  if (!initialized.ok) throw new Error(`literal capture rejected: ${initialized.reason}`);
  let state = initialized.state;
  let now = 0;
  const effects: PingInputEffect[] = [];
  const send = (type: string, fields: Record<string, unknown> = {}, at = now + 1) => {
    now = at;
    const transition = stepPingInput(state, {
      generationId: CAPTURE.generationId,
      connectionEpoch: CAPTURE.connectionEpoch,
      type,
      ...fields,
    }, now);
    state = transition.state;
    effects.push(...transition.effects);
    return transition.effects;
  };
  return {
    send,
    effects,
    get state(): PingInputState { return state; },
  };
}

function sealOneFinal(input: ReturnType<typeof machine>, text = "Set both dates to 20 October.") {
  input.send("accept_audio", { frameOrdinal: 1, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
  input.send("encoded_audio", { throughFrame: 1, decodedBytes: 2 });
  input.send("reserve_commit", { token: "independent-commit-1" });
  input.send("ack", { itemId: "provider-item-a", previousItemId: null });
  input.send("final", { itemId: "provider-item-a", contentIndex: 0, text });
  input.send("finish");
  input.send("seal_tail", { throughFrame: 1 });
  return input.effects.find((effect) => effect.kind === "interpret_once");
}

function readyMachine() {
  const input = machine();
  const descriptor = sealOneFinal(input);
  assert.ok(descriptor);
  input.send("interpretation", { requestId: CAPTURE.commandId, proposal: COMPOUND_PLAN });
  assert.equal(input.state.phase, "ready");
  return input;
}

test("Finish includes the accepted tail and waits for every final and acknowledgement", () => {
  const input = machine();
  input.send("accept_audio", { frameOrdinal: 1, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
  input.send("encoded_audio", { throughFrame: 1, decodedBytes: 2 });
  input.send("reserve_commit", { token: "segment-1" });
  input.send("ack", { itemId: "provider-item-a", previousItemId: null });
  input.send("final", { itemId: "provider-item-a", contentIndex: 0, text: "Update the first selected task" });
  input.send("accept_audio", { frameOrdinal: 2, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
  input.send("finish");
  assert.equal(input.state.phase, "sealing");
  assert.equal(input.state.counters.interpretationDescriptors, 0);
  assert.deepEqual(input.effects.at(-1), { kind: "flush_tail", generationId: CAPTURE.generationId, throughFrame: 2 });

  input.send("encoded_audio", { throughFrame: 2, decodedBytes: 2 });
  input.send("seal_tail", { throughFrame: 2 });
  assert.equal(input.state.segments.length, 2);
  assert.equal(input.state.segments[1].itemId, null);
  assert.equal(input.state.counters.interpretationDescriptors, 0);
  input.send("final", { itemId: "provider-item-b", contentIndex: 0, text: "and then update the second" });
  assert.equal(input.state.counters.interpretationDescriptors, 0);
  input.send("ack", { itemId: "provider-item-b", previousItemId: "provider-item-a" });
  const interpret = input.effects.find((effect) => effect.kind === "interpret_once");
  assert.ok(interpret);
  assert.equal(interpret.transcript, "Update the first selected task\nand then update the second");
  assert.deepEqual(interpret.manifest.map((segment) => [segment.ordinal, segment.itemId]), [
    [0, "provider-item-a"], [1, "provider-item-b"],
  ]);
  assert.equal(input.state.counters.interpretationDescriptors, 1);

  const missingTail = machine();
  missingTail.send("accept_audio", { frameOrdinal: 1, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
  missingTail.send("encoded_audio", { throughFrame: 1, decodedBytes: 2 });
  missingTail.send("reserve_commit", { token: "segment-only" });
  missingTail.send("ack", { itemId: "provider-item-only", previousItemId: null });
  missingTail.send("final", { itemId: "provider-item-only", contentIndex: 0, text: "complete prefix" });
  missingTail.send("accept_audio", { frameOrdinal: 2, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
  missingTail.send("finish");
  missingTail.send("seal_tail", { throughFrame: 2 });
  assert.equal(missingTail.state.reason, "unflushed_tail");
  assert.equal(missingTail.state.counters.interpretationDescriptors, 0);
});

test("only the exact retired generation and epoch pair is inert", () => {
  const retired = [{ generationId: "retired-generation", connectionEpoch: "retired-epoch" }];
  const input = machine(retired);
  const before = input.state;
  const lateExact = stepPingInput(before, { generationId: "retired-generation", connectionEpoch: "retired-epoch", type: "tick" }, -1);
  assert.equal(lateExact.state, before);
  assert.deepEqual(lateExact.effects, []);

  const mismatchedEpoch = stepPingInput(before, {
    generationId: "retired-generation", connectionEpoch: CAPTURE.connectionEpoch, type: "tick",
  }, 1);
  assert.equal(mismatchedEpoch.state.phase, "closed");
  assert.equal(mismatchedEpoch.state.reason, "correlation_error");
  assert.equal(mismatchedEpoch.state.counters.interpretationDescriptors, 0);
});

test("interpreter projection contains instruction context but no actor, session, Project or task identity", () => {
  const input = machine();
  const descriptor = sealOneFinal(input, "Move the selected tasks to Doing and set 20 October.");
  assert.ok(descriptor);
  assert.deepEqual(Object.keys(descriptor.modelInput).sort(), [
    "referenceInstant", "selectedTaskCount", "systemColumnKeys", "timeZone", "transcript", "version",
  ]);
  assert.deepEqual(descriptor.modelInput, {
    version: "ping.interpretation.v1",
    transcript: "Move the selected tasks to Doing and set 20 October.",
    selectedTaskCount: 2,
    referenceInstant: "2026-10-06T09:00:00.000Z",
    timeZone: "Europe/Dublin",
    systemColumnKeys: ["todo", "doing", "review", "done"],
  });
  const projected = JSON.stringify(descriptor.modelInput);
  for (const privateValue of [CAPTURE.actorId, CAPTURE.sessionId, CAPTURE.projectId, CAPTURE.inputItemId,
    CAPTURE.selectedTaskIds[0], CAPTURE.selectedTaskIds[1], CAPTURE.contextKey, CAPTURE.commandId]) {
    assert.equal(projected.includes(privateValue), false, `unexpected identity in model projection: ${privateValue}`);
  }
});

test("same-schema supported prefix does not match a literal full compound or refusal label", () => {
  const capture = normalizePingCapture(CAPTURE);
  assert.ok(capture);
  const expectedCompound = {
    version: "ping.proposal.v1", outcome: "plan",
    operation: { kind: "edit_selected", effects: { selfAssignment: "add", dueDate: "2026-10-20", statusColumnKey: "doing" } },
  } as const;
  const prefix = {
    version: "ping.proposal.v1", outcome: "plan",
    operation: { kind: "edit_selected", effects: { selfAssignment: "add" } },
  } as const;
  const notDispatched = {
    interpretationCalls: 0, executorCalls: 0, receiptReadsLifetime: 0, receiptReadWindows: [],
    observedCommittedEffects: 0, knowledge: "not_dispatched", timingSource: "synthetic", stages: [],
  } as const;
  const compound = evaluatePingWholePlan({ id: "literal-three-effect-case", source: "independent_fixture", expected: expectedCompound },
    prefix, capture, notDispatched);
  assert.ok(compound.ok);
  assert.equal(compound.expectedOutcome, "plan");
  assert.equal(compound.actualOutcome, "plan");
  assert.equal(compound.wholePlanMatch, false);

  const refusal = evaluatePingWholePlan({ id: "literal-mixed-destructive-case", source: "independent_fixture", expected: REFUSAL },
    prefix, capture, notDispatched);
  assert.ok(refusal.ok);
  assert.equal(refusal.expectedOutcome, "refusal");
  assert.equal(refusal.wholePlanMatch, false);
});

test("identical normalized interpretation duplicate is inert and conflicting duplicate cannot dispatch", () => {
  const same = readyMachine();
  const binding = same.state.binding;
  same.send("interpretation", { requestId: CAPTURE.commandId.toUpperCase(), proposal: COMPOUND_PLAN });
  assert.equal(same.state.phase, "ready");
  assert.equal(same.state.binding, binding);
  assert.equal(same.state.counters.interpretationDescriptors, 1);
  assert.equal(same.state.counters.dispatchDescriptors, 0);

  const conflict = readyMachine();
  const changedPlan = {
    version: "ping.proposal.v1", outcome: "plan",
    operation: { kind: "edit_selected", effects: { selfAssignment: "add", dueDate: null, statusColumnKey: "doing" } },
  } as const;
  conflict.send("interpretation", { requestId: CAPTURE.commandId, proposal: changedPlan });
  assert.equal(conflict.state.phase, "closed");
  assert.equal(conflict.state.reason, "conflicting_interpretation");
  conflict.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  assert.equal(conflict.state.counters.dispatchDescriptors, 0);
  assert.equal(conflict.effects.filter((effect) => effect.kind === "proposed_dispatch").length, 0);
});

test("pre-dispatch cancellation closes without a descriptor; post-dispatch cancellation retains exact payload and key", () => {
  const beforeDispatch = readyMachine();
  beforeDispatch.send("cancel");
  beforeDispatch.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  assert.equal(beforeDispatch.state.phase, "closed");
  assert.equal(beforeDispatch.state.counters.dispatchDescriptors, 0);
  assert.equal(beforeDispatch.effects.filter((effect) => effect.kind === "proposed_dispatch").length, 0);

  const afterDispatch = readyMachine();
  afterDispatch.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  const sent = afterDispatch.effects.find((effect) => effect.kind === "proposed_dispatch");
  assert.ok(sent && sent.kind === "proposed_dispatch");
  const literalCommand = {
    version: "ping.command.v1",
    commandId: CAPTURE.commandId,
    projectId: CAPTURE.projectId,
    referenceInstant: CAPTURE.referenceInstant,
    timeZone: "Europe/Dublin",
    expectedColumnConfig: "{\"doneKeys\":[\"done\"]}",
    operation: {
      kind: "edit_selected",
      taskIds: ["task-cedar-a", "task-cedar-b"],
      effects: { selfAssignment: "add", dueDate: "2026-10-20", statusColumnKey: "doing" },
      expected: {
        "task-cedar-a": { assignees: ["collaborator-lee"], due: null, dueAtSeconds: null, startDay: 15, durationDays: 2,
          lane: "todo", boardColumnKey: null, completedAtSeconds: null },
        "task-cedar-b": { assignees: ["actor-ada", "collaborator-lee"], due: "2026-10-18", dueAtSeconds: 1792314000,
          startDay: 18, durationDays: 3, lane: "doing", boardColumnKey: null, completedAtSeconds: null },
      },
    },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(sent.command)), literalCommand);
  assert.deepEqual(JSON.parse(JSON.stringify(sent.context)), {
    actorId: "actor-ada",
    captured: {
      commandId: CAPTURE.commandId, projectId: CAPTURE.projectId,
      selectedTaskIds: ["task-cedar-a", "task-cedar-b"], referenceInstant: CAPTURE.referenceInstant,
      timeZone: "Europe/Dublin", expectedColumnConfig: "{\"doneKeys\":[\"done\"]}",
      inputItemId: CAPTURE.inputItemId,
      expected: {
        "task-cedar-a": { assignees: ["collaborator-lee"], due: null, dueAtSeconds: null, startDay: 15, durationDays: 2,
          lane: "todo", boardColumnKey: null, completedAtSeconds: null },
        "task-cedar-b": { assignees: ["actor-ada", "collaborator-lee"], due: "2026-10-18", dueAtSeconds: 1792314000,
          startDay: 18, durationDays: 3, lane: "doing", boardColumnKey: null, completedAtSeconds: null },
      },
    },
    input: { itemId: CAPTURE.inputItemId, state: "complete" },
  });
  afterDispatch.send("cancel");
  assert.equal(afterDispatch.state.phase, "outcome_unknown");
  assert.equal(afterDispatch.state.counters.dispatchDescriptors, 1);
  assert.deepEqual(afterDispatch.state.dispatched?.command, sent.command);
  assert.equal(afterDispatch.state.dispatched?.commandKey, sent.commandKey);
  assert.equal(Object.isFrozen(afterDispatch.state.dispatched?.command.operation), true);
  const read = afterDispatch.effects.find((effect) => effect.kind === "read_receipt");
  assert.ok(read && read.kind === "read_receipt");
  assert.equal(read.commandId, CAPTURE.commandId);
  assert.equal(read.commandKey, sent.commandKey);
});

test("wrong-key receipt cannot confirm or redispatch the command", () => {
  const input = readyMachine();
  input.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  const retained = input.state.dispatched;
  assert.ok(retained);
  input.send("receipt", {
    commandId: CAPTURE.commandId, projectId: CAPTURE.projectId, commandKey: `${retained.commandKey}-changed`,
    result: "committed", source: "executor",
  });
  assert.notEqual(input.state.phase, "committed");
  assert.equal(input.state.reason, "receipt_identity");
  input.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  assert.equal(input.state.counters.dispatchDescriptors, 1);
  assert.equal(input.effects.filter((effect) => effect.kind === "proposed_dispatch").length, 1);
});

test("retired lookup windows and absent results cannot confirm or redispatch", () => {
  const input = readyMachine();
  input.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  input.send("cancel");
  const firstRead = input.effects.find((effect) => effect.kind === "read_receipt");
  assert.ok(firstRead && firstRead.kind === "read_receipt");
  input.send("manual_reconcile", { actionToken: "manual-window-2" }, 10_010);
  const secondRead = input.effects.filter((effect) => effect.kind === "read_receipt").at(-1);
  assert.ok(secondRead && secondRead.kind === "read_receipt");
  assert.equal(secondRead.windowToken, "manual-window-2");
  assert.notEqual(secondRead.windowToken, firstRead.windowToken);

  input.send("receipt", {
    commandId: CAPTURE.commandId, projectId: CAPTURE.projectId, commandKey: secondRead.commandKey,
    result: "committed", source: "lookup", windowToken: firstRead.windowToken, readOrdinal: firstRead.readOrdinal,
  });
  assert.equal(input.state.phase, "outcome_unknown");
  input.send("receipt", {
    commandId: CAPTURE.commandId, projectId: CAPTURE.projectId, commandKey: secondRead.commandKey,
    result: "absent", source: "lookup", windowToken: secondRead.windowToken, readOrdinal: secondRead.readOrdinal,
  });
  assert.equal(input.state.phase, "outcome_unknown");
  input.send("dispatch", { currentContextKey: CAPTURE.contextKey });
  assert.equal(input.state.counters.dispatchDescriptors, 1);
  assert.equal(input.effects.filter((effect) => effect.kind === "proposed_dispatch").length, 1);
});

test("synthetic speech-end timing includes Finish delay while Finish diagnostic isolates it", () => {
  const capture = normalizePingCapture(CAPTURE);
  assert.ok(capture);
  const expected = { ...COMPOUND_PLAN };
  const observation = {
    interpretationCalls: 1, executorCalls: 1, receiptReadsLifetime: 0, receiptReadWindows: [],
    observedCommittedEffects: 2, knowledge: "committed", timingSource: "synthetic",
    stages: [
      { name: "capture_ready", atMs: 0 },
      { name: "speech_end", atMs: 500 },
      { name: "finish", atMs: 1700 },
      { name: "dispatch", atMs: 1800 },
      { name: "receipt_confirmed", atMs: 1900 },
      { name: "visible_readback", atMs: 2200 },
    ],
  } as const;
  const measured = evaluatePingWholePlan({ id: "literal-timing-case", source: "independent_fixture", expected },
    COMPOUND_PLAN, capture, observation);
  assert.ok(measured.ok);
  assert.equal(measured.metricMeaning, "synthetic_timeline_only");
  assert.equal(measured.speechEndToVisibleMs, 1700);
  assert.equal(measured.finishToVisibleMs, 500);
  assert.equal(measured.captureToVisibleMs, 2200);

  const unknown = evaluatePingWholePlan({ id: "literal-unknown-outcome-case", source: "independent_fixture", expected },
    COMPOUND_PLAN, capture, {
      interpretationCalls: 1, executorCalls: 1, receiptReadsLifetime: 1,
      receiptReadWindows: [{ token: "manual-window", reads: 1 }], observedCommittedEffects: null,
      knowledge: "unresolved", timingSource: "synthetic",
      stages: [{ name: "capture_ready", atMs: 0 }, { name: "speech_end", atMs: 500 }, { name: "finish", atMs: 1700 }, { name: "dispatch", atMs: 1800 }],
    });
  assert.ok(unknown.ok);
  assert.equal(unknown.observation.observedCommittedEffects, null);
  assert.equal(unknown.captureToVisibleMs, null);
  assert.equal(unknown.finishToVisibleMs, null);
});
