import assert from "node:assert/strict";
import test from "node:test";
import { createPingInput, PING_INPUT_POLICY, stepPingInput } from "./input-protocol";
import { syntheticCapture, syntheticInput, syntheticPlan } from "./input-test-fixture";

test("Finish waits for accepted tail encoding, seal, delayed ACK and full final; no prefix descriptor", () => {
  const f = syntheticInput(); f.audio(); f.encode(); f.send("reserve_commit", { token: "first" });
  f.send("ack", { itemId: "item-1", previousItemId: null }); f.final("item-1", "Assign me");
  f.audio(4); f.send("finish");
  assert.equal(f.state.phase, "sealing"); assert.equal(f.state.counters.interpretationDescriptors, 0);
  f.encode(); f.send("seal_tail", { throughFrame: 2 });
  f.final("item-2", "actually remove me and clear the due date");
  assert.equal(f.state.counters.interpretationDescriptors, 0);
  f.send("ack", { itemId: "item-2", previousItemId: "item-1" });
  const interpretation = f.effects.find((effect) => effect.kind === "interpret_once"); assert.ok(interpretation);
  assert.equal(interpretation.transcript, "Assign me\nactually remove me and clear the due date");
  assert.deepEqual(Object.keys(interpretation.modelInput).sort(), ["referenceInstant", "selectedTaskCount", "systemColumnKeys", "timeZone", "transcript", "version"]);
  assert.equal(interpretation.modelInput.selectedTaskCount, 1);
  assert.deepEqual(interpretation.manifest.map((item) => [item.ordinal, item.itemId]), [[0, "item-1"], [1, "item-2"]]);
  assert.equal(f.effects.filter((effect) => effect.kind === "send_commit").length, 2);
  f.send("finish"); f.final("item-2", "actually remove me and clear the due date");
  assert.equal(f.effects.filter((effect) => effect.kind === "interpret_once").length, 1);
  assert.equal(f.state.counters.dispatchDescriptors, 0);
});

test("sole pending commit serializes queued reservations; reversed finals assemble local order", () => {
  const f = syntheticInput(); f.audio(); f.encode(); f.send("reserve_commit", { token: "first" });
  f.audio(); f.encode(); f.send("reserve_commit", { token: "second" });
  assert.equal(f.effects.filter((effect) => effect.kind === "send_commit").length, 1);
  f.send("finish"); f.send("seal_tail", { throughFrame: 2 });
  f.send("ack", { itemId: "item-1", previousItemId: null });
  assert.equal(f.effects.filter((effect) => effect.kind === "send_commit").length, 2);
  f.final("item-2", "then do B"); f.send("ack", { itemId: "item-2", previousItemId: "item-1" });
  assert.equal(f.state.counters.interpretationDescriptors, 0);
  f.final("item-1", "do A");
  assert.equal(f.effects.find((effect) => effect.kind === "interpret_once")?.transcript, "do A\nthen do B");
});

test("empty input and an unflushed accepted tail cannot interpret", () => {
  const empty = syntheticInput(); empty.send("finish"); assert.equal(empty.state.phase, "closed");
  assert.deepEqual(empty.effects, []);
  const unflushed = syntheticInput(); unflushed.audio(); unflushed.send("finish");
  unflushed.send("seal_tail", { throughFrame: 1 });
  assert.equal(unflushed.state.reason, "unflushed_tail"); assert.equal(unflushed.state.counters.interpretationDescriptors, 0);
});

test("empty tail adds no phantom commit; exact audio duplicate counts once", () => {
  const f = syntheticInput(); f.audio(4); f.send("accept_audio", { frameOrdinal: 1, decodedBytes: 4, format: "pcm_s16le_mono_24000" });
  assert.equal(f.state.acceptedBytes, 4); f.encode(); f.send("reserve_commit", { token: "only" });
  f.send("finish"); f.send("seal_tail", { throughFrame: 1 });
  assert.equal(f.state.segments.length, 1); assert.equal(f.effects.filter((effect) => effect.kind === "send_commit").length, 1);
  f.send("encoded_audio", { throughFrame: 1, decodedBytes: 4 });
  assert.equal(f.state.phase, "awaiting_finals"); assert.equal(f.state.acceptedBytes, 4);
});

test("PCM byte/sample cap accepts exact 30 seconds; odd, over, missing or changed frame rejects", () => {
  const maximum = syntheticInput(); maximum.audio(1_440_000); assert.equal(maximum.state.phase, "capturing");
  maximum.audio(2); assert.equal(maximum.state.reason, "audio_cap_or_order");
  for (const fields of [{ frameOrdinal: 1, decodedBytes: 3 }, { frameOrdinal: 1, decodedBytes: 1_440_002 },
    { frameOrdinal: 2, decodedBytes: 2 }, { frameOrdinal: 1, decodedBytes: "2" }]) {
    const f = syntheticInput(); f.send("accept_audio", { format: "pcm_s16le_mono_24000", ...fields });
    assert.equal(f.state.phase, "closed"); assert.equal(f.state.acceptedBytes, 0);
  }
  const duplicate = syntheticInput(); duplicate.audio(2);
  duplicate.send("accept_audio", { frameOrdinal: 1, decodedBytes: 4, format: "pcm_s16le_mono_24000" });
  assert.equal(duplicate.state.phase, "closed");
});

test("eighth item accepted, ninth rejected without interpreting a prefix", () => {
  for (const count of [8, 9]) {
    const f = syntheticInput();
    for (let index = 0; index < count; index++) { f.audio(); f.encode(); f.send("reserve_commit", { token: `segment-${index}` }); }
    assert.equal(f.state.segments.length, 8); assert.equal(f.state.phase, count === 8 ? "capturing" : "closed");
    assert.equal(f.state.counters.interpretationDescriptors, 0);
  }
});

test("code point cap includes delimiters and pending final only once; no silent truncation", () => {
  const f = syntheticInput(); f.audio(); f.encode(); f.send("finish"); f.send("seal_tail", { throughFrame: 1 });
  f.final("item-1", "😀".repeat(4000)); assert.equal(f.state.phase, "awaiting_finals");
  f.send("ack", { itemId: "item-1", previousItemId: null }); assert.equal(f.state.counters.interpretationDescriptors, 1);
  const over = syntheticInput(); over.audio(); over.encode(); over.send("reserve_commit", { token: "one" });
  over.send("ack", { itemId: "item-1", previousItemId: null }); over.final("item-1", "a".repeat(4000));
  over.audio(); over.encode(); over.send("reserve_commit", { token: "two" });
  over.final("item-2", "b"); assert.equal(over.state.reason, "transcript_cap");
  assert.equal(over.state.counters.interpretationDescriptors, 0); assert.equal(over.state.pendingText, null);
});

test("unknown/second unbound ID, wrong predecessor/content/epoch and conflicting ACK fail closed", () => {
  const unknown = syntheticInput(); unknown.final("unknown", "text"); assert.equal(unknown.state.reason, "unbound_input");
  for (const alteration of ["wrong_id", "second_id", "wrong_predecessor", "content", "epoch", "ack_conflict"]) {
    const f = syntheticInput(); f.audio(); f.encode(); f.send("reserve_commit", { token: "one" });
    if (alteration === "wrong_id") { f.final("before-ack", "text"); f.send("ack", { itemId: "other", previousItemId: null }); }
    if (alteration === "second_id") { f.final("first", "text"); f.final("second", "text"); }
    if (alteration === "wrong_predecessor") f.send("ack", { itemId: "first", previousItemId: "unexpected" });
    if (alteration === "content") f.send("final", { itemId: "first", contentIndex: 1, text: "text" });
    if (alteration === "epoch") f.send("ack", { connectionEpoch: "other", itemId: "first", previousItemId: null });
    if (alteration === "ack_conflict") { f.send("ack", { itemId: "first", previousItemId: null }); f.send("ack", { itemId: "first", previousItemId: "other" }); }
    assert.equal(f.state.phase, "closed", alteration); assert.equal(f.state.counters.interpretationDescriptors, 0);
  }
});

test("exact duplicate ACK is inert even with another commit pending; reused ID cannot bind it", () => {
  const f = syntheticInput(); f.audio(); f.encode(); f.send("reserve_commit", { token: "one" });
  f.audio(); f.encode(); f.send("reserve_commit", { token: "two" });
  f.send("ack", { itemId: "first", previousItemId: null });
  f.send("ack", { itemId: "first", previousItemId: null });
  assert.equal(f.state.segments[1].itemId, null);
  assert.equal(f.effects.filter((effect) => effect.kind === "send_commit").length, 2);
});

test("conflicting final before/during/after interpretation has distinct descriptor counts and certainty", () => {
  const before = syntheticInput(); before.audio(); before.encode(); before.send("reserve_commit", { token: "one" });
  before.send("ack", { itemId: "first", previousItemId: null }); before.final("first", "A"); before.final("first", "B");
  assert.equal(before.state.counters.interpretationDescriptors, 0); assert.equal(before.state.phase, "closed");
  const during = syntheticInput(); during.ready(); during.final("synthetic-item", "conflict");
  during.send("interpretation", { requestId: during.captured.commandId, proposal: syntheticPlan() });
  assert.equal(during.state.counters.interpretationDescriptors, 1); assert.equal(during.state.counters.dispatchDescriptors, 0);
  const after = syntheticInput(); after.dispatch(); after.final("synthetic-item", "conflict");
  assert.equal(after.state.anomaly, true); assert.equal(after.state.counters.dispatchDescriptors, 1);
  assert.equal(after.state.phase, "dispatched");
});

test("cancel/context loss before dispatch closes; queued model result cannot revive or mint a command", () => {
  for (const type of ["cancel", "disconnect", "context_changed"]) {
    const f = syntheticInput(); f.ready(); f.send(type);
    f.send("interpretation", { requestId: f.captured.commandId, proposal: syntheticPlan() });
    f.send("dispatch", { currentContextKey: f.captured.contextKey });
    assert.equal(f.state.phase, "closed"); assert.equal(f.state.counters.dispatchDescriptors, 0);
    assert.equal(f.state.segments.every((segment) => segment.final === null && segment.preview === ""), true);
  }
  const stale = syntheticInput(); stale.ready(); stale.send("dispatch", { currentContextKey: "new-selection" });
  assert.equal(stale.state.reason, "stale_context_or_not_ready"); assert.equal(stale.state.counters.dispatchDescriptors, 0);
});

test("dispatch latch is one; complete bound aggregate identity and captured readset are literal", () => {
  const f = syntheticInput(); f.dispatch(); f.send("dispatch", { currentContextKey: "changed-after-first" }); f.send("finish");
  const dispatches = f.effects.filter((effect) => effect.kind === "proposed_dispatch"); assert.equal(dispatches.length, 1);
  const dispatch = dispatches[0]; assert.equal(dispatch.context.input.itemId, "synthetic-whole-input");
  assert.equal(dispatch.context.input.state, "complete"); assert.equal(dispatch.context.actorId, "synthetic-actor");
  assert.deepEqual(JSON.parse(JSON.stringify(dispatch.command.operation)), { kind: "edit_selected", taskIds: ["synthetic-task"], effects: {
    selfAssignment: "add", dueDate: "2026-10-07", statusColumnKey: "doing" }, expected: {
    "synthetic-task": { assignees: ["synthetic-other"], due: null, dueAtSeconds: null, startDay: 20000,
      durationDays: 2, lane: "todo", boardColumnKey: null, completedAtSeconds: null } } });
  assert.equal(f.state.binding, null); assert.equal(f.state.segments.every((segment) => segment.final === null), true);
});

test("post-dispatch cancellation/absence/revocation remains unresolved; original identity only, bounded read descriptors", () => {
  const f = syntheticInput(); f.dispatch(); f.send("cancel", {}, 100);
  for (const [at, result] of [[200, "absent"], [600, "unavailable"], [2100, "absent"], [10000, "absent"]] as const) {
    f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, result }, at);
    assert.equal(f.state.phase, "outcome_unknown");
  }
  assert.equal(f.state.counters.dispatchDescriptors, 1); assert.equal(f.state.counters.receiptReadDescriptors, 3);
  assert.equal(f.effects.filter((effect) => effect.kind === "read_receipt").every((effect) => effect.commandId === f.captured.commandId), true);
  f.send("receipt", { commandId: f.captured.commandId.toUpperCase(), projectId: f.captured.projectId, result: "committed" }, 20000);
  assert.equal(f.state.phase, "committed"); f.send("cancel", {}, 20001); assert.equal(f.state.phase, "committed");
  assert.equal(f.state.counters.dispatchDescriptors, 1);
});

test("wrong original receipt identity never confirms; response wait deadline does not assert zero", () => {
  const f = syntheticInput(); f.dispatch(); f.send("tick", {}, 6000); assert.equal(f.state.phase, "outcome_unknown");
  f.send("receipt", { commandId: "00000000-0000-4000-8000-000000000002", projectId: f.captured.projectId, result: "committed" }, 6001);
  assert.equal(f.state.phase, "outcome_unknown"); assert.equal(f.state.reason, "receipt_identity");
});

test("dispatch retains exact immutable operation/context key while wiping transcript; changed key cannot confirm", () => {
  const f = syntheticInput(); f.dispatch(); const retained = f.state.dispatched; assert.ok(retained);
  assert.equal(retained.command.operation.kind, "edit_selected"); assert.ok(Object.isFrozen(retained.command.operation));
  assert.equal(f.state.segments.every((segment) => segment.final === null && segment.preview === ""), true);
  f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, commandKey: `${retained.commandKey}changed`, result: "committed" });
  assert.equal(f.state.phase, "outcome_unknown"); assert.equal(f.state.reason, "receipt_identity");
  f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, commandKey: retained.commandKey, result: "committed" });
  assert.equal(f.state.phase, "committed"); assert.equal(f.state.dispatched, retained);
});

test("explicit manual reconciliation dedupes bounded actions/windows and preserves original command through late results", () => {
  const f = syntheticInput(); f.dispatch(); f.send("cancel", {}, 100);
  const automatic = f.state.recoveryToken!; const key = f.state.dispatched!.commandKey;
  f.send("manual_reconcile", { actionToken: "manual-one" }, 200);
  assert.equal(f.state.reason, "recovery_window_active"); assert.equal(f.state.counters.receiptReadDescriptors, 1);
  f.send("manual_reconcile", { actionToken: "manual-one" }, 10100);
  assert.equal(f.state.recoveryToken, "manual-one"); assert.equal(f.state.recoveryReads, 1);
  assert.equal(f.state.counters.receiptReadDescriptors, 2);
  f.send("manual_reconcile", { actionToken: "manual-one" }, 10101);
  assert.equal(f.state.reason, "duplicate_recovery_action"); assert.equal(f.state.counters.receiptReadDescriptors, 2);
  f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, commandKey: key,
    result: "committed", source: "lookup", windowToken: automatic, readOrdinal: 1 }, 10102);
  assert.equal(f.state.phase, "outcome_unknown"); assert.deepEqual(f.state.recoveryResults, []);
  f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, result: "absent",
    source: "lookup", windowToken: "manual-one", readOrdinal: 1 }, 10103);
  f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, result: "absent",
    source: "lookup", windowToken: "manual-one", readOrdinal: 1 }, 10104);
  assert.deepEqual(f.state.recoveryResults, [1]);
  f.send("tick", {}, 10600); assert.equal(f.state.recoveryReads, 2);
  f.send("receipt", { commandId: f.captured.commandId, projectId: f.captured.projectId, result: "committed",
    source: "lookup", windowToken: "manual-one", readOrdinal: 2 }, 10601);
  assert.equal(f.state.phase, "committed"); assert.equal(f.state.counters.dispatchDescriptors, 1);
  assert.equal(f.effects.filter((effect) => effect.kind === "read_receipt").every((effect) => effect.commandId === f.captured.commandId && effect.commandKey === key), true);
});

test("manual recovery storage saturates without freeing unresolved lane or resetting UUID", () => {
  const f = syntheticInput(); f.dispatch(); f.send("cancel", {}, 100);
  for (let index = 1; index <= 8; index++) f.send("manual_reconcile", { actionToken: `manual-${index}` }, 100 + index * 10000);
  assert.equal(f.state.reason, "recovery_window_cap"); assert.equal(f.state.recoveryActions.length, 8);
  assert.equal(f.state.phase, "outcome_unknown"); assert.equal(f.state.counters.dispatchDescriptors, 1);
  f.send("dispatch", { currentContextKey: f.captured.contextKey }, 80101);
  assert.equal(f.state.counters.dispatchDescriptors, 1);
});

test("deadline checks precede late completion even without timer, duplicates never reset deadline", () => {
  const ack = syntheticInput(); ack.audio(); ack.encode(); ack.send("reserve_commit", { token: "one" }, 10);
  ack.send("ack", { itemId: "late", previousItemId: null }, 5010); assert.equal(ack.state.reason, "ack_deadline");
  const finish = syntheticInput(); finish.audio(); finish.encode(); finish.send("finish", {}, 10);
  finish.send("finish", {}, 9999); finish.send("seal_tail", { throughFrame: 1 }, 10010);
  assert.equal(finish.state.reason, "finish_deadline"); assert.equal(finish.state.finishAt, 10);
  const interpret = syntheticInput(); interpret.ready(); const started = interpret.state.interpretedAt!;
  interpret.send("dispatch", { currentContextKey: interpret.captured.contextKey }, started + 10000);
  assert.equal(interpret.state.reason, "interpretation_deadline"); assert.equal(interpret.state.counters.dispatchDescriptors, 0);
});

test("strict malformed events, clocks and event cap reject; retired generation cannot alter current state", () => {
  const f = syntheticInput(); const before = f.state;
  const initialized = createPingInput(syntheticCapture(), 0, [{ generationId: "retired", connectionEpoch: "retired" }]); assert.ok(initialized.ok);
  const retired = stepPingInput(initialized.state, { generationId: "retired", connectionEpoch: "retired", type: "tick" }, 1);
  assert.equal(retired.state, initialized.state); assert.deepEqual(retired.effects, []);
  const staleRetiredClock = stepPingInput(initialized.state, { generationId: "retired", connectionEpoch: "retired", type: "tick" }, -1);
  assert.equal(staleRetiredClock.state, initialized.state);
  const unexplained = stepPingInput(before, { generationId: "unexplained", connectionEpoch: f.captured.connectionEpoch, type: "tick" }, 1);
  assert.equal(unexplained.state.reason, "correlation_error"); assert.equal(unexplained.state.counters.interpretationDescriptors, 0);
  assert.equal(createPingInput(syntheticCapture(), 0, new Array(0xffffffff)).ok, false);
  const malformed = stepPingInput(before, { generationId: f.captured.generationId, connectionEpoch: f.captured.connectionEpoch, type: "tick", actorId: "model" }, 1);
  assert.equal(malformed.state.reason, "invalid_event"); assert.equal(before.phase, "capturing"); assert.ok(Object.isFrozen(before.capture.snapshots));
  const clock = syntheticInput(); clock.send("tick", {}, -1); assert.equal(clock.state.reason, "invalid_clock");
  const budget = syntheticInput(); for (let index = 0; index < 512; index++) budget.send("tick", {}, 0);
  assert.equal(budget.state.phase, "capturing"); budget.send("tick", {}, 0); assert.equal(budget.state.reason, "event_cap");
  assert.equal(PING_INPUT_POLICY.decodedBytes / 2 / 24000, 30);
  assert.equal(createPingInput(syntheticCapture(), Number.NaN).ok, false);
});

test("unexplained second generation cannot drop a clause and execute known prefix; dispatched intent remains unresolved", () => {
  const f = syntheticInput(); f.audio(); f.encode(); f.send("reserve_commit", { token: "first" });
  f.send("ack", { itemId: "first", previousItemId: null }); f.final("first", "Assign me");
  f.send("final", { generationId: "unexplained-second", itemId: "second", contentIndex: 0, text: "and delete it" });
  f.send("finish"); assert.equal(f.state.phase, "closed"); assert.equal(f.state.counters.interpretationDescriptors, 0);
  assert.equal(f.state.counters.dispatchDescriptors, 0);
  const dispatched = syntheticInput(); dispatched.dispatch(); const original = dispatched.state.dispatched;
  dispatched.send("final", { generationId: "unexplained-second", itemId: "second", contentIndex: 0, text: "unknown" });
  assert.equal(dispatched.state.phase, "outcome_unknown"); assert.equal(dispatched.state.dispatched, original);
  assert.equal(dispatched.state.counters.dispatchDescriptors, 1);
});

test("identical normalized interpretation completion and seal are inert through ready; conflicting duplicate cannot dispatch", () => {
  const f = syntheticInput(); f.ready(); const original = f.state.binding;
  f.send("seal_tail", { throughFrame: 1 });
  f.send("interpretation", { requestId: f.captured.commandId.toUpperCase(), proposal: syntheticPlan() });
  assert.equal(f.state.phase, "ready"); assert.equal(f.state.binding, original);
  assert.equal(f.state.counters.interpretationDescriptors, 1); assert.equal(f.state.counters.dispatchDescriptors, 0);
  f.send("interpretation", { requestId: f.captured.commandId, proposal: { ...syntheticPlan(), operation: {
    kind: "edit_selected", effects: { ...syntheticPlan().operation.effects, dueDate: null } } } });
  assert.equal(f.state.phase, "closed"); assert.equal(f.state.reason, "conflicting_interpretation");
  f.send("dispatch", { currentContextKey: f.captured.contextKey });
  assert.equal(f.effects.filter((effect) => effect.kind === "interpret_once").length, 1);
  assert.equal(f.effects.filter((effect) => effect.kind === "proposed_dispatch").length, 0);
});

test("identical seal after interpretation starts is inert; changed sealed watermark closes without a prefix", () => {
  const f = syntheticInput(); f.audio(); f.encode(); f.send("finish"); f.send("seal_tail", { throughFrame: 1 });
  f.send("ack", { itemId: "first", previousItemId: null }); f.final("first", "Assign me");
  assert.equal(f.state.phase, "interpreting"); f.send("seal_tail", { throughFrame: 1 });
  assert.equal(f.state.phase, "interpreting"); assert.equal(f.state.counters.interpretationDescriptors, 1);
  f.send("seal_tail", { throughFrame: 2 }); assert.equal(f.state.phase, "closed");
  f.send("interpretation", { requestId: f.captured.commandId, proposal: syntheticPlan() });
  assert.equal(f.state.counters.dispatchDescriptors, 0);
});
