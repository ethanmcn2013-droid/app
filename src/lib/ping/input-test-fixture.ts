import assert from "node:assert/strict";
import { createPingInput, stepPingInput, type PingInputEffect, type PingInputState } from "./input-protocol";

export function syntheticCapture() {
  return { generationId: "synthetic-generation", connectionEpoch: "synthetic-epoch", contextKey: "synthetic-context",
    sessionId: "synthetic-session", actorId: "synthetic-actor", inputItemId: "synthetic-whole-input",
    commandId: "00000000-0000-4000-8000-000000000001", projectId: "synthetic-project",
    selectedTaskIds: ["synthetic-task"], referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
    expectedColumnConfig: null, snapshots: { "synthetic-task": { assignees: ["synthetic-other"], due: null,
      dueAtSeconds: null, startDay: 20000, durationDays: 2, lane: "todo", boardColumnKey: null, completedAtSeconds: null } } };
}
export const syntheticPlan = () => ({ version: "ping.proposal.v1", outcome: "plan", operation: {
  kind: "edit_selected", effects: { selfAssignment: "add", dueDate: "2026-10-07", statusColumnKey: "doing" } } });
export function syntheticInput() {
  const captured = syntheticCapture();
  const initialized = createPingInput(captured, 0); assert.ok(initialized.ok);
  let state: PingInputState = initialized.state; let now = 0;
  const effects: PingInputEffect[] = [];
  const send = (type: string, fields: Record<string, unknown> = {}, at?: number) => {
    now = at ?? now + 1;
    const result = stepPingInput(state, { generationId: captured.generationId, connectionEpoch: captured.connectionEpoch, type,
      ...(type === "receipt" ? { source: "executor", commandKey: state.dispatched?.commandKey } : {}), ...fields }, now);
    state = result.state; effects.push(...result.effects); return result;
  };
  const audio = (bytes = 2) => send("accept_audio", { frameOrdinal: state.frames.length + 1, decodedBytes: bytes, format: "pcm_s16le_mono_24000" });
  const encode = () => send("encoded_audio", { throughFrame: state.frames.length,
    decodedBytes: state.frames.slice(state.encodedThrough).reduce((sum, size) => sum + size, 0) });
  const final = (itemId: string, text: string) => send("final", { itemId, contentIndex: 0, text });
  const ready = () => {
    audio(); encode(); send("finish"); send("seal_tail", { throughFrame: state.watermark });
    send("ack", { itemId: "synthetic-item", previousItemId: null }); final("synthetic-item", "Assign me, due tomorrow, doing");
    send("interpretation", { requestId: captured.commandId, proposal: syntheticPlan() }); assert.equal(state.phase, "ready");
  };
  const dispatch = () => { ready(); send("dispatch", { currentContextKey: captured.contextKey }); };
  return { captured, send, audio, encode, final, ready, dispatch, effects, get state() { return state; } };
}
