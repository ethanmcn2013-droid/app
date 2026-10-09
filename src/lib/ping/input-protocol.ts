import { normalizePingCommandId, PING_SYSTEM_COLUMNS, validPingId } from "./command";
import { bindPingProposal, normalizePingCapture, type PingBinding, type PingCapture } from "./proposal";
import { canonicalIdentity, codePoints, dataRecord, exactKeys, freeze, jsonArray, transcriptText } from "./input-validation";

/** Approved delegated experiment guards. Durations are deadlines, never latency promises. */
export const PING_INPUT_POLICY = freeze({ version: "ping.input.v1", decodedBytes: 1_440_000, segments: 8,
  transcriptCodePoints: 4000, events: 512, captureMs: 45_000, ackMs: 5000, finishMs: 10_000,
  interpretationMs: 10_000, responseMs: 5000, recoveryMs: 10_000, receiptReads: 3, recoveryWindows: 8 } as const);
export type PingInputPhase = "capturing" | "sealing" | "awaiting_finals" | "interpreting" | "ready" |
  "dispatched" | "outcome_unknown" | "committed" | "closed";
type Segment = { token: string; ordinal: number; throughFrame: number; decodedBytes: number;
  sentAt: number | null; itemId: string | null; previousItemId: string | null; preview: string; final: string | null };
type PendingText = { itemId: string; preview: string; final: string | null };
export type PingInputCounters = Readonly<{ interpretationDescriptors: number; dispatchDescriptors: number; receiptReadDescriptors: number }>;
export type PingInputState = Readonly<{
  version: typeof PING_INPUT_POLICY.version; capture: PingCapture; phase: PingInputPhase; reason: string | null;
  retiredBindings: readonly Readonly<{ generationId: string; connectionEpoch: string }>[];
  startedAt: number; lastAt: number; eventCount: number; frames: readonly number[]; encodedThrough: number;
  encodingLedger: readonly Readonly<{ throughFrame: number; decodedBytes: number }>[];
  reservedThrough: number; acceptedBytes: number; segments: readonly Readonly<Segment>[];
  pendingText: Readonly<PendingText> | null; finishAt: number | null; watermark: number | null;
  interpretedAt: number | null; dispatchedAt: number | null; recoveryAt: number | null; lastReceiptAt: number | null;
  binding: Extract<PingBinding, { ok: true }> | null; counters: PingInputCounters; anomaly: boolean;
  dispatched: Readonly<{ command: Extract<PingBinding, { ok: true }>["command"];
    context: Extract<PingBinding, { ok: true }>["context"]; commandKey: string }> | null;
  recoveryToken: string | null; recoveryReads: number; recoveryResults: readonly number[]; recoveryActions: readonly string[];
}>;
export type PingInputEffect =
  | Readonly<{ kind: "send_commit"; generationId: string; connectionEpoch: string; token: string;
      ordinal: number; throughFrame: number; decodedBytes: number }>
  | Readonly<{ kind: "flush_tail"; generationId: string; throughFrame: number }>
  | Readonly<{ kind: "interpret_once"; requestId: string; generationId: string; inputItemId: string;
      transcript: string; capture: PingCapture; manifest: readonly Readonly<{ token: string; ordinal: number; itemId: string }>[];
      modelInput: Readonly<{ version: "ping.interpretation.v1"; transcript: string; selectedTaskCount: number;
        referenceInstant: string; timeZone: "Europe/Dublin"; systemColumnKeys: typeof PING_SYSTEM_COLUMNS }> }>
  | Readonly<{ kind: "proposed_dispatch"; generationId: string; command: Extract<PingBinding, { ok: true }>["command"];
      context: Extract<PingBinding, { ok: true }>["context"]; commandKey: string }>
  | Readonly<{ kind: "read_receipt"; generationId: string; actorId: string; commandId: string; commandKey: string; windowToken: string; readOrdinal: number }>;
export type PingInputEvent = Readonly<{ generationId: string; connectionEpoch: string }> & (
  | Readonly<{ type: "accept_audio"; frameOrdinal: number; decodedBytes: number; format: "pcm_s16le_mono_24000" }>
  | Readonly<{ type: "encoded_audio"; throughFrame: number; decodedBytes: number }>
  | Readonly<{ type: "reserve_commit"; token: string }>
  | Readonly<{ type: "finish" | "tick" | "cancel" | "disconnect" | "context_changed" | "reconcile" }>
  | Readonly<{ type: "seal_tail"; throughFrame: number }>
  | Readonly<{ type: "ack"; itemId: string; previousItemId: string | null }>
  | Readonly<{ type: "delta" | "final"; itemId: string; contentIndex: 0; text: string }>
  | Readonly<{ type: "interpretation"; requestId: string; proposal: unknown }>
  | Readonly<{ type: "dispatch"; currentContextKey: string }>
  | Readonly<{ type: "manual_reconcile"; actionToken: string }>
  | Readonly<{ type: "receipt"; commandId: string; projectId: string; commandKey: string; result: "committed" | "absent" | "unavailable" } & (
      Readonly<{ source: "executor" }> | Readonly<{ source: "lookup"; windowToken: string; readOrdinal: number }>)>
);
type MutableState = Omit<{ -readonly [K in keyof PingInputState]: PingInputState[K] }, "frames" | "segments" | "pendingText" | "counters" | "recoveryResults" | "recoveryActions"> & {
  frames: number[]; segments: Segment[]; pendingText: PendingText | null;
  counters: { interpretationDescriptors: number; dispatchDescriptors: number; receiptReadDescriptors: number };
  recoveryResults: number[]; recoveryActions: string[];
};
export type PingInputStep = Readonly<{ state: PingInputState; effects: readonly PingInputEffect[] }>;
const postDispatch = (state: PingInputState) => state.counters.dispatchDescriptors === 1;
const closed = (state: PingInputState) => state.phase === "closed";
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function parseEvent(value: unknown): PingInputEvent | null {
  if (!dataRecord(value) || !validPingId(value.generationId) || !validPingId(value.connectionEpoch) || typeof value.type !== "string") return null;
  const keys = ["type", "generationId", "connectionEpoch"];
  switch (value.type) {
    case "accept_audio": return exactKeys(value, [...keys, "frameOrdinal", "decodedBytes", "format"]) &&
      integer(value.frameOrdinal) && value.frameOrdinal > 0 && integer(value.decodedBytes) && value.decodedBytes > 0 &&
      value.decodedBytes % 2 === 0 && value.decodedBytes <= PING_INPUT_POLICY.decodedBytes &&
      value.format === "pcm_s16le_mono_24000" ? value as PingInputEvent : null;
    case "encoded_audio": return exactKeys(value, [...keys, "throughFrame", "decodedBytes"]) && integer(value.throughFrame) &&
      integer(value.decodedBytes) && value.decodedBytes <= PING_INPUT_POLICY.decodedBytes ? value as PingInputEvent : null;
    case "seal_tail": return exactKeys(value, [...keys, "throughFrame"]) && integer(value.throughFrame) ? value as PingInputEvent : null;
    case "reserve_commit": return exactKeys(value, [...keys, "token"]) && validPingId(value.token) ? value as PingInputEvent : null;
    case "ack": return exactKeys(value, [...keys, "itemId", "previousItemId"]) && validPingId(value.itemId) &&
      (value.previousItemId === null || validPingId(value.previousItemId)) ? value as PingInputEvent : null;
    case "delta": case "final": return exactKeys(value, [...keys, "itemId", "contentIndex", "text"]) &&
      validPingId(value.itemId) && value.contentIndex === 0 && transcriptText(value.text, value.type === "delta") ? value as PingInputEvent : null;
    case "interpretation": return exactKeys(value, [...keys, "requestId", "proposal"]) && normalizePingCommandId(value.requestId) !== null
      ? value as PingInputEvent : null;
    case "dispatch": return exactKeys(value, [...keys, "currentContextKey"]) && validPingId(value.currentContextKey) ? value as PingInputEvent : null;
    case "manual_reconcile": return exactKeys(value, [...keys, "actionToken"]) && validPingId(value.actionToken) ? value as PingInputEvent : null;
    case "receipt": return normalizePingCommandId(value.commandId) !== null && validPingId(value.projectId) &&
      typeof value.commandKey === "string" && value.commandKey.length > 0 && value.commandKey.length <= 400000 &&
      ["committed", "absent", "unavailable"].includes(value.result as string) &&
      ((value.source === "executor" && exactKeys(value, [...keys, "commandId", "projectId", "commandKey", "result", "source"])) ||
       (value.source === "lookup" && exactKeys(value, [...keys, "commandId", "projectId", "commandKey", "result", "source", "windowToken", "readOrdinal"]) &&
        validPingId(value.windowToken) && integer(value.readOrdinal) && value.readOrdinal >= 1 && value.readOrdinal <= PING_INPUT_POLICY.receiptReads))
      ? value as PingInputEvent : null;
    case "finish": case "tick": case "cancel": case "disconnect": case "context_changed": case "reconcile":
      return exactKeys(value, keys) ? value as PingInputEvent : null;
    default: return null;
  }
}
function clearContent(state: MutableState) {
  state.frames = [];
  state.encodingLedger = [];
  state.pendingText = null;
  state.segments = state.segments.map((segment) => ({ ...segment, preview: "", final: null }));
}
function invalidate(state: MutableState, reason: string) {
  state.reason = reason;
  if (postDispatch(state)) {
    state.anomaly = true;
    if (state.phase !== "committed") state.phase = "outcome_unknown";
  } else { state.phase = "closed"; state.binding = null; }
  clearContent(state);
}
function pending(state: MutableState) { return state.segments.find((segment) => segment.sentAt !== null && segment.itemId === null); }
function sendNext(state: MutableState, now: number, effects: PingInputEffect[]) {
  if (pending(state)) return;
  const next = state.segments.find((segment) => segment.sentAt === null);
  if (!next) return;
  next.sentAt = now;
  effects.push({ kind: "send_commit", generationId: state.capture.generationId, connectionEpoch: state.capture.connectionEpoch,
    token: next.token, ordinal: next.ordinal, throughFrame: next.throughFrame, decodedBytes: next.decodedBytes });
}
function reserve(state: MutableState, token: string, now: number, effects: PingInputEffect[]) {
  if (state.segments.length >= PING_INPUT_POLICY.segments || state.encodedThrough <= state.reservedThrough ||
    state.segments.some((segment) => segment.token === token)) { invalidate(state, "invalid_commit"); return; }
  const bytes = state.frames.slice(state.reservedThrough, state.encodedThrough).reduce((sum, size) => sum + size, 0);
  state.segments.push({ token, ordinal: state.segments.length, throughFrame: state.encodedThrough, decodedBytes: bytes,
    sentAt: null, itemId: null, previousItemId: null, preview: "", final: null });
  state.reservedThrough = state.encodedThrough;
  sendNext(state, now, effects);
}
function textSize(state: MutableState) {
  const texts = state.segments.map((segment) => segment.itemId === null && segment.sentAt !== null && state.pendingText
    ? state.pendingText.final ?? state.pendingText.preview : segment.final ?? segment.preview);
  return texts.reduce((sum, text) => sum + codePoints(text), 0) + Math.max(0, texts.length - 1);
}
function maybeInterpret(state: MutableState, now: number, effects: PingInputEffect[]) {
  if (state.phase !== "awaiting_finals" || !state.segments.length || state.pendingText ||
    state.segments.some((segment) => segment.itemId === null || segment.final === null)) return;
  state.phase = "interpreting";
  state.interpretedAt = now;
  state.counters.interpretationDescriptors = 1;
  const transcript = state.segments.map((segment) => segment.final!).join("\n");
  effects.push({ kind: "interpret_once", requestId: state.capture.commandId, generationId: state.capture.generationId,
    inputItemId: state.capture.inputItemId, transcript,
    capture: state.capture, manifest: state.segments.map((segment) => ({ token: segment.token, ordinal: segment.ordinal, itemId: segment.itemId! })),
    modelInput: { version: "ping.interpretation.v1", transcript, selectedTaskCount: state.capture.selectedTaskIds.length,
      referenceInstant: state.capture.referenceInstant, timeZone: state.capture.timeZone, systemColumnKeys: PING_SYSTEM_COLUMNS } });
}
function expired(state: MutableState, now: number): string | null {
  if (state.phase === "capturing" && now - state.startedAt >= PING_INPUT_POLICY.captureMs) return "capture_deadline";
  if ((state.phase === "sealing" || state.phase === "awaiting_finals") && state.finishAt !== null &&
    now - state.finishAt >= PING_INPUT_POLICY.finishMs) return "finish_deadline";
  const awaiting = pending(state);
  if (!postDispatch(state) && awaiting && now - awaiting.sentAt! >= PING_INPUT_POLICY.ackMs) return "ack_deadline";
  if ((state.phase === "interpreting" || state.phase === "ready") && state.interpretedAt !== null &&
    now - state.interpretedAt >= PING_INPUT_POLICY.interpretationMs) return "interpretation_deadline";
  return null;
}
function receiptRead(state: MutableState, now: number, effects: PingInputEffect[]) {
  if (!postDispatch(state) || state.phase === "committed") return;
  state.phase = "outcome_unknown";
  state.recoveryAt ??= now;
  if (state.recoveryToken === null) {
    state.recoveryToken = `automatic-${state.capture.commandId}`;
    state.recoveryActions.push(state.recoveryToken);
  }
  const offsets = [0, 500, 2000];
  const count = state.recoveryReads;
  if (count >= PING_INPUT_POLICY.receiptReads || now - state.recoveryAt >= PING_INPUT_POLICY.recoveryMs ||
    now - state.recoveryAt < offsets[count]) return;
  state.counters.receiptReadDescriptors += 1;
  state.recoveryReads += 1;
  state.lastReceiptAt = now;
  effects.push({ kind: "read_receipt", generationId: state.capture.generationId,
    actorId: state.capture.actorId, commandId: state.capture.commandId, commandKey: state.dispatched!.commandKey,
    windowToken: state.recoveryToken, readOrdinal: state.recoveryReads });
}

export function createPingInput(captured: unknown, startedAtMs: number, retired: unknown = []):
  Readonly<{ ok: true; state: PingInputState }> | Readonly<{ ok: false; reason: "invalid_capture" | "invalid_clock" }> {
  const capture = normalizePingCapture(captured);
  if (!capture) return { ok: false, reason: "invalid_capture" };
  if (!integer(startedAtMs)) return { ok: false, reason: "invalid_clock" };
  const retiredBindings: { generationId: string; connectionEpoch: string }[] = [];
  try {
    if (!jsonArray(retired, 8)) return { ok: false, reason: "invalid_capture" };
    for (const binding of retired) {
      if (!dataRecord(binding) || !exactKeys(binding, ["generationId", "connectionEpoch"]) ||
        !validPingId(binding.generationId) || !validPingId(binding.connectionEpoch) ||
        binding.generationId === capture.generationId || binding.connectionEpoch === capture.connectionEpoch ||
        retiredBindings.some((previous) => previous.generationId === binding.generationId || previous.connectionEpoch === binding.connectionEpoch)) {
        return { ok: false, reason: "invalid_capture" };
      }
      retiredBindings.push({ generationId: binding.generationId, connectionEpoch: binding.connectionEpoch });
    }
  } catch { return { ok: false, reason: "invalid_capture" }; }
  return freeze({ ok: true, state: { version: PING_INPUT_POLICY.version, capture, retiredBindings, phase: "capturing", reason: null,
    startedAt: startedAtMs, lastAt: startedAtMs, eventCount: 0, frames: [], encodedThrough: 0, reservedThrough: 0,
    acceptedBytes: 0, encodingLedger: [], segments: [], pendingText: null, finishAt: null, watermark: null, interpretedAt: null,
    dispatchedAt: null, recoveryAt: null, lastReceiptAt: null, binding: null, dispatched: null,
    counters: { interpretationDescriptors: 0, dispatchDescriptors: 0, receiptReadDescriptors: 0 }, anomaly: false,
    recoveryToken: null, recoveryReads: 0, recoveryResults: [], recoveryActions: [] } });
}

/** Accept only states created here. Copy/freeze every transition; callers must serialize and run descriptors separately. */
export function stepPingInput(previous: PingInputState, rawEvent: unknown, nowMs: number): PingInputStep {
  const state: MutableState = { ...previous, frames: [...previous.frames], segments: previous.segments.map((segment) => ({ ...segment })),
    pendingText: previous.pendingText ? { ...previous.pendingText } : null, counters: { ...previous.counters },
    recoveryResults: [...previous.recoveryResults], recoveryActions: [...previous.recoveryActions] };
  const effects: PingInputEffect[] = [];
  const result = () => freeze({ state, effects });
  try {
    // Retired generations are inert only when their envelope is well formed; they do not advance current clock/deadlines.
    const event = parseEvent(rawEvent);
    if (!event) { invalidate(state, "invalid_event"); return result(); }
    if (event.generationId !== state.capture.generationId) {
      if (state.retiredBindings.some((binding) => binding.generationId === event.generationId && binding.connectionEpoch === event.connectionEpoch)) {
        return freeze({ state: previous, effects: [] });
      }
      invalidate(state, "correlation_error"); return result();
    }
    if (!integer(nowMs) || nowMs < state.lastAt) { invalidate(state, "invalid_clock"); return result(); }
    state.lastAt = nowMs;
    if (event.connectionEpoch !== state.capture.connectionEpoch) { invalidate(state, "correlation_error"); return result(); }
    if (state.phase === "closed") return result();
    // A saturated input budget may not prevent later original-ID receipt confirmation.
    if (!postDispatch(state)) {
      state.eventCount += 1;
      if (state.eventCount > PING_INPUT_POLICY.events) { invalidate(state, "event_cap"); return result(); }
    }
    const deadline = expired(state, nowMs);
    if (deadline) { invalidate(state, deadline); return result(); }
    if (postDispatch(state) && state.phase !== "committed" && nowMs - state.dispatchedAt! >= PING_INPUT_POLICY.responseMs) {
      state.phase = "outcome_unknown";
    }
    switch (event.type) {
      case "accept_audio": {
        if (state.phase !== "capturing") { invalidate(state, "audio_after_finish"); break; }
        if (event.frameOrdinal <= state.frames.length && state.frames[event.frameOrdinal - 1] === event.decodedBytes) break;
        if (event.frameOrdinal !== state.frames.length + 1 || state.acceptedBytes + event.decodedBytes > PING_INPUT_POLICY.decodedBytes) {
          invalidate(state, "audio_cap_or_order"); break;
        }
        state.frames.push(event.decodedBytes); state.acceptedBytes += event.decodedBytes; break;
      }
      case "encoded_audio": {
        if (!postDispatch(state) && state.encodingLedger.some((entry) => entry.throughFrame === event.throughFrame && entry.decodedBytes === event.decodedBytes)) break;
        if (state.phase !== "capturing" && state.phase !== "sealing") { invalidate(state, "encoding_after_seal"); break; }
        if (event.throughFrame === state.encodedThrough && event.decodedBytes === 0) break;
        const expected = state.frames.slice(state.encodedThrough, event.throughFrame).reduce((sum, size) => sum + size, 0);
        if (event.throughFrame <= state.encodedThrough || event.throughFrame > state.frames.length || event.decodedBytes !== expected) {
          invalidate(state, "encoding_coverage"); break;
        }
        state.encodedThrough = event.throughFrame;
        state.encodingLedger = [...state.encodingLedger, { throughFrame: event.throughFrame, decodedBytes: event.decodedBytes }]; break;
      }
      case "reserve_commit":
        if (state.phase !== "capturing") invalidate(state, "commit_after_finish");
        else reserve(state, event.token, nowMs, effects);
        break;
      case "finish":
        if (state.finishAt !== null || postDispatch(state)) break;
        if (state.phase !== "capturing" || !state.frames.length) { invalidate(state, "empty_input"); break; }
        state.phase = "sealing"; state.finishAt = nowMs; state.watermark = state.frames.length;
        effects.push({ kind: "flush_tail", generationId: state.capture.generationId, throughFrame: state.watermark }); break;
      case "seal_tail":
        if (state.phase !== "sealing" && state.finishAt !== null && event.throughFrame === state.watermark && state.encodedThrough === state.watermark) break;
        if (state.phase !== "sealing" || event.throughFrame !== state.watermark || state.encodedThrough !== state.watermark) {
          invalidate(state, "unflushed_tail"); break;
        }
        if (state.encodedThrough > state.reservedThrough) reserve(state, `tail-${state.capture.commandId}`, nowMs, effects);
        if (closed(state)) break;
        state.phase = "awaiting_finals"; break;
      case "ack": {
        if (postDispatch(state)) { state.anomaly = true; break; }
        const existing = state.segments.find((segment) => segment.itemId === event.itemId);
        if (existing) {
          if (existing.previousItemId !== event.previousItemId) invalidate(state, "conflicting_ack");
          break;
        }
        const awaiting = pending(state);
        const predecessor = awaiting && awaiting.ordinal > 0 ? state.segments[awaiting.ordinal - 1].itemId : null;
        if (!awaiting || event.previousItemId !== predecessor || (state.pendingText && state.pendingText.itemId !== event.itemId)) {
          invalidate(state, "correlation_error"); break;
        }
        awaiting.itemId = event.itemId; awaiting.previousItemId = event.previousItemId;
        if (state.pendingText) {
          awaiting.preview = state.pendingText.preview; awaiting.final = state.pendingText.final; state.pendingText = null;
        }
        sendNext(state, nowMs, effects); break;
      }
      case "delta": case "final": {
        // After dispatch raw content was wiped. Late input cannot change the plan: conservatively record anomaly, keep original receipt truth.
        if (postDispatch(state)) { state.anomaly = true; break; }
        let target: Segment | PendingText | undefined = state.segments.find((segment) => segment.itemId === event.itemId);
        if (!target) {
          if (!pending(state) || (state.pendingText && state.pendingText.itemId !== event.itemId)) { invalidate(state, "unbound_input"); break; }
          state.pendingText ??= { itemId: event.itemId, preview: "", final: null };
          target = state.pendingText;
        }
        if (event.type === "final") {
          if (target.final !== null && target.final !== event.text) { invalidate(state, "conflicting_final"); break; }
          target.final = event.text; target.preview = "";
        } else if (target.final === null) target.preview += event.text;
        if (textSize(state) > PING_INPUT_POLICY.transcriptCodePoints) invalidate(state, "transcript_cap");
        break;
      }
      case "interpretation":
        if (postDispatch(state)) break;
        if (state.phase === "ready" && normalizePingCommandId(event.requestId) === state.capture.commandId && state.binding) {
          const repeated = bindPingProposal(event.proposal, state.capture, { generationId: state.capture.generationId,
            inputItemId: state.capture.inputItemId, state: "complete" });
          if (!repeated.ok || canonicalIdentity(repeated.command) !== canonicalIdentity(state.binding.command) ||
            canonicalIdentity(repeated.proposal) !== canonicalIdentity(state.binding.proposal)) invalidate(state, "conflicting_interpretation");
          break;
        }
        if (state.phase !== "interpreting" || normalizePingCommandId(event.requestId) !== state.capture.commandId) {
          invalidate(state, "unexpected_interpretation"); break;
        }
        {
          const binding = bindPingProposal(event.proposal, state.capture, { generationId: state.capture.generationId,
            inputItemId: state.capture.inputItemId, state: "complete" });
          if (!binding.ok) invalidate(state, binding.reason);
          else { state.binding = binding; state.phase = "ready"; }
        }
        break;
      case "dispatch":
        if (postDispatch(state)) break;
        if (state.phase !== "ready" || !state.binding || event.currentContextKey !== state.capture.contextKey) {
          invalidate(state, "stale_context_or_not_ready"); break;
        }
        state.phase = "dispatched"; state.dispatchedAt = nowMs; state.counters.dispatchDescriptors = 1;
        state.dispatched = { command: state.binding.command, context: state.binding.context,
          commandKey: canonicalIdentity({ command: state.binding.command, context: state.binding.context }) };
        effects.push({ kind: "proposed_dispatch", generationId: state.capture.generationId,
          ...state.dispatched });
        state.binding = null; clearContent(state); break;
      case "receipt":
        if (!postDispatch(state) || normalizePingCommandId(event.commandId) !== state.capture.commandId ||
          event.projectId !== state.capture.projectId || event.commandKey !== state.dispatched?.commandKey) {
          invalidate(state, "receipt_identity"); break;
        }
        if (event.source === "lookup") {
          if (event.windowToken !== state.recoveryToken) break; // Retired window result cannot populate or consume the new window.
          if (event.readOrdinal > state.recoveryReads) { invalidate(state, "unissued_receipt_read"); break; }
          if (state.recoveryResults.includes(event.readOrdinal)) break;
          state.recoveryResults.push(event.readOrdinal);
        }
        if (event.result === "committed") { state.phase = "committed"; state.reason = null; clearContent(state); }
        else if (state.phase !== "committed") { state.phase = "outcome_unknown"; receiptRead(state, nowMs, effects); }
        break;
      case "manual_reconcile":
        if (!postDispatch(state)) { invalidate(state, "reconcile_before_dispatch"); break; }
        if (state.phase === "committed") break;
        if (state.recoveryActions.includes(event.actionToken) || event.actionToken === state.recoveryToken) {
          state.reason = "duplicate_recovery_action"; break;
        }
        if (state.recoveryAt !== null && nowMs - state.recoveryAt < PING_INPUT_POLICY.recoveryMs) {
          state.reason = "recovery_window_active"; break;
        }
        if (state.recoveryActions.length >= PING_INPUT_POLICY.recoveryWindows) { state.reason = "recovery_window_cap"; break; }
        state.recoveryActions.push(event.actionToken); state.recoveryToken = event.actionToken;
        state.recoveryAt = nowMs; state.recoveryReads = 0; state.recoveryResults = [];
        state.reason = null; receiptRead(state, nowMs, effects); break;
      case "cancel": case "disconnect": case "context_changed":
        invalidate(state, event.type); if (postDispatch(state)) receiptRead(state, nowMs, effects); break;
      case "reconcile":
        if (!postDispatch(state)) invalidate(state, "reconcile_before_dispatch");
        else receiptRead(state, nowMs, effects);
        break;
      case "tick":
        if (state.phase === "outcome_unknown") receiptRead(state, nowMs, effects);
        break;
    }
    if (!closed(state) && !postDispatch(state)) maybeInterpret(state, nowMs, effects);
    return result();
  } catch { invalidate(state, "invalid_event"); return result(); }
}
