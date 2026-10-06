import assert from "node:assert/strict";
import test from "node:test";
import { createPingVoiceSession, type PingVoiceModelInput, type PingVoiceOptions, type PingVoiceTransport } from "./voice-session";

// Literal owning oracle. No helper imports from the input implementation/test fixture.
const capture = () => ({ generationId: "voice-gen", connectionEpoch: "voice-epoch", contextKey: "context",
  sessionId: "session", actorId: "actor", inputItemId: "whole-input", commandId: "00000000-0000-4000-8000-000000000051",
  projectId: "project", selectedTaskIds: ["task"], snapshots: { task: { assignees: ["other"], due: null,
    dueAtSeconds: null, startDay: 20000, durationDays: 2, lane: "todo", boardColumnKey: null, completedAtSeconds: null } },
  referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", expectedColumnConfig: null });
const plan = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } };
const ack = (previous: string | null = null) => JSON.stringify({ type: "input_audio_buffer.committed", item_id: "item-one", previous_item_id: previous });
const final = (text = "assign me", item = "item-one") => JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", item_id: item, content_index: 0, transcript: text });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture(extra: Partial<PingVoiceOptions> = {}) {
  let now = 0, current = true, closed = 0, detached = 0, backlog = 0;
  let listener: (raw: unknown) => void = () => {};
  let onSend: (text: string) => void = () => {};
  const sends: string[] = [], interpreted: PingVoiceModelInput[] = [];
  const transport: PingVoiceTransport = { send: (text) => { sends.push(text); onSend(text); },
    subscribe: (fn) => { listener = fn; return () => { detached++; }; }, queuedBytes: () => backlog, close: () => { closed++; } };
  const session = createPingVoiceSession({ capture: capture(), now: () => now, isContextCurrent: () => current,
    transport, interpret: async (input) => { interpreted.push(input); return plan; }, ...extra });
  return { session, sends, interpreted, emit: (raw: unknown) => listener(raw),
    at: (value: number) => { now = value; }, stale: () => { current = false; }, backlog: (value: number) => { backlog = value; },
    onSend: (fn: (text: string) => void) => { onSend = fn; }, get closed() { return closed; }, get detached() { return detached; },
    frame: (ordinal = 1, values = [-1, 0.5]) => session.acceptFrame({ type: "frame", generationId: "voice-gen", connectionEpoch: "voice-epoch",
      ordinal, sampleRate: 24000, channels: 1, sampleCount: values.length, samples: new Float32Array(values).buffer }),
    cut: (throughFrame = 1, totalSamples = 2) => session.acceptCut({ type: "cut", generationId: "voice-gen", connectionEpoch: "voice-epoch", throughFrame, totalSamples }) };
}

test("real PCM ledger drains late partial tail before one commit and final-before-ACK interpretation", async () => {
  const f = fixture(); f.frame();
  assert.deepEqual(f.session.getCaptureTag(), { generationId: "voice-gen", connectionEpoch: "voice-epoch" });
  assert.deepEqual(JSON.parse(f.sends[0]), { type: "input_audio_buffer.append", audio: "AID/Pw==" });
  assert.equal(f.session.requestFinish(), true); assert.equal(f.session.requestFinish(), false);
  f.frame(2, [1]); assert.equal(f.sends.length, 2); assert.equal(f.session.getSnapshot().counters.commitCalls, 0);
  f.cut(2, 3); f.cut(2, 3); assert.equal(f.sends.length, 3);
  assert.equal(f.sends[2], '{"type":"input_audio_buffer.commit"}');
  f.emit(final()); assert.equal(f.interpreted.length, 0); f.emit(ack()); f.emit(ack()); f.emit(final()); await flush();
  assert.deepEqual(f.interpreted, [{ version: "ping.interpretation.v1", transcript: "assign me", selectedTaskCount: 1,
    referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", systemColumnKeys: ["todo", "doing", "review", "done"] }]);
  assert.deepEqual(f.session.getProposal(), plan);
  assert.deepEqual(f.session.getSnapshot().counters, { appendCalls: 2, appendAccepted: 2, appendedBytes: 6,
    commitCalls: 1, commitAccepted: 1, interpretationCalls: 1, interpretationDescriptors: 1 });
  assert.equal(f.closed, 1); assert.equal(f.detached, 1);
  f.session.cancel(); f.session.dispose(); assert.equal(f.session.getProposal(), null); assert.equal(f.session.getCaptureTag(), null);
  assert.equal(f.closed, 1); assert.equal(f.detached, 1);
});

test("synchronous commit callback reentrancy sees the reserved pending item, not a second call", async () => {
  const f = fixture(); f.onSend((text) => { if (JSON.parse(text).type === "input_audio_buffer.commit") { f.emit(final()); f.emit(ack()); } });
  f.frame(); f.session.requestFinish(); f.cut(); await flush();
  assert.equal(f.session.getSnapshot().phase, "ready"); assert.equal(f.interpreted.length, 1);
  assert.equal(f.session.getSnapshot().counters.commitCalls, 1);
});

test("missing cut, ACK and complete final expire the original deadlines with zero interpretation", () => {
  const tail = fixture(); tail.frame(); tail.session.requestFinish(); tail.at(9999); assert.equal(tail.session.requestFinish(), false);
  tail.at(10000); tail.cut(); assert.equal(tail.session.getSnapshot().reason, "finish_deadline"); assert.equal(tail.sends.length, 1);
  const noAck = fixture(); noAck.frame(); noAck.session.requestFinish(); noAck.cut(); noAck.at(5000); noAck.session.tick();
  assert.equal(noAck.session.getSnapshot().reason, "ack_deadline");
  const noFinal = fixture(); noFinal.frame(); noFinal.session.requestFinish(); noFinal.cut(); noFinal.emit(ack()); noFinal.at(10000); noFinal.session.tick();
  assert.equal(noFinal.session.getSnapshot().reason, "finish_deadline");
  for (const f of [tail, noAck, noFinal]) assert.equal(f.interpreted.length, 0);
});

test("wrong fences, post-cut frames and conflicting/unrelated item finals do not interpret a prefix", () => {
  for (const defect of ["fence", "late-frame", "item", "final", "predecessor"] as const) {
    const f = fixture(); f.frame(); f.session.requestFinish();
    if (defect === "fence") f.cut(1, 3);
    else { f.cut();
      if (defect === "late-frame") f.frame(2);
      if (defect === "item") { f.emit(final("assign me", "wrong-item")); f.emit(ack()); }
      if (defect === "final") { f.emit(final()); f.emit(final("unassign me")); }
      if (defect === "predecessor") f.emit(ack("foreign-item"));
    }
    assert.equal(f.session.getSnapshot().phase, "closed", defect); assert.equal(f.interpreted.length, 0, defect);
  }
});

test("cancel/context change aborts a pending interpretation and ignores its late result", async () => {
  let complete!: (value: unknown) => void; let signal!: AbortSignal; let calls = 0;
  const f = fixture({ interpret: (_input, value) => { signal = value; calls++; return new Promise((resolve) => { complete = resolve; }); } });
  f.frame(); f.session.requestFinish(); f.cut(); f.emit(ack()); f.emit(final());
  assert.equal(calls, 1); f.session.cancel(); assert.equal(signal.aborted, true);
  complete(plan); await flush(); assert.equal(f.session.getSnapshot().phase, "closed"); assert.equal(f.session.getProposal(), null); assert.equal(calls, 1);
  const stale = fixture(); stale.frame(); stale.stale(); stale.session.requestFinish(); stale.emit(final());
  assert.equal(stale.session.getSnapshot().reason, "context_changed"); assert.equal(stale.sends.length, 1); assert.equal(stale.interpreted.length, 0);
});

test("unavailable, malformed frames and send failures retain truthful invocation counts", () => {
  const unavailable = fixture({ transport: null }); unavailable.frame();
  assert.equal(unavailable.session.getSnapshot().phase, "unavailable"); assert.equal(unavailable.session.getCaptureTag(), null); assert.equal(unavailable.sends.length, 0);
  const invalid = fixture(); let getters = 0;
  invalid.session.acceptFrame({ get type() { getters++; return "frame"; } });
  assert.equal(getters, 0); assert.equal(invalid.sends.length, 0);
  const failed = fixture(); failed.onSend(() => { throw Error("sensitive fixture detail"); }); failed.frame(); failed.frame();
  assert.equal(failed.sends.length, 1); assert.equal(failed.session.getSnapshot().reason, "send_failed");
  assert.equal(failed.session.getSnapshot().counters.appendCalls, 1); assert.equal(failed.session.getSnapshot().counters.appendAccepted, 0);
  assert.equal(JSON.stringify(failed.session.getSnapshot()).includes("sensitive"), false);
  const pressure = fixture(); pressure.backlog(1920000); pressure.frame();
  assert.equal(pressure.session.getSnapshot().reason, "transport_backpressure"); assert.equal(pressure.sends.length, 0);
});

test("thirty decoded seconds fit reducer event guards; the next decoded sample is refused", async () => {
  const f = fixture(); for (let i = 1; i <= 150; i++) f.frame(i, Array(4800).fill(0));
  assert.equal(f.session.getSnapshot().phase, "capturing"); assert.equal(f.session.getSnapshot().encodedBytes, 1440000);
  f.session.requestFinish(); f.cut(150, 720000); f.emit(ack()); f.emit(final()); await flush();
  assert.equal(f.session.getSnapshot().phase, "ready"); assert.equal(f.session.getSnapshot().counters.appendCalls, 150);
  const extra = fixture(); for (let i = 1; i <= 150; i++) extra.frame(i, Array(4800).fill(0));
  extra.frame(151, [0]); assert.equal(extra.session.getSnapshot().phase, "closed"); assert.equal(extra.interpreted.length, 0);
});

test("disconnect inside backpressure observation prevents a subsequent physical send", () => {
  let disconnect: () => void = () => {}; let sends = 0;
  const f = fixture({ transport: { subscribe: (_listener, closed) => { disconnect = closed; return () => {}; },
    queuedBytes: () => { disconnect(); return 0; }, send: () => { sends++; }, close: () => {} } });
  f.frame(); assert.equal(sends, 0);
  assert.equal(f.session.getSnapshot().reason, "disconnected"); assert.equal(f.session.getSnapshot().counters.appendCalls, 0);
});

test("interpretation expiry and invalid returned proposal never become ready", async () => {
  let complete!: (value: unknown) => void;
  const f = fixture({ interpret: () => new Promise((resolve) => { complete = resolve; }) });
  f.frame(); f.session.requestFinish(); f.cut(); f.emit(ack()); f.emit(final()); f.at(10000); complete(plan); await flush();
  assert.equal(f.session.getSnapshot().reason, "interpretation_deadline"); assert.equal(f.session.getProposal(), null);
  const invalid = fixture({ interpret: async () => ({ ...plan, actorId: "provider-authority" }) });
  invalid.frame(); invalid.session.requestFinish(); invalid.cut(); invalid.emit(ack()); invalid.emit(final()); await flush();
  assert.equal(invalid.session.getSnapshot().reason, "invalid_proposal"); assert.equal(invalid.session.getProposal(), null);
});
