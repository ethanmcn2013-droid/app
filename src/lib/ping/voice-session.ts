import { createPingInput, PING_INPUT_POLICY, stepPingInput, type PingInputEffect, type PingInputState } from "./input-protocol";
import type { PingProposal } from "./proposal";
import { dataRecord, exactKeys } from "./input-validation";
import { encodePingPcm, PING_PCM_BLOCK_SAMPLES, PING_PCM_MAX_SAMPLES, PING_PCM_RATE } from "./pcm";
import { decodePingTranscriptionMessage, encodePingAudioCommit, encodePingPcmAppend } from "./realtime-transcription";

export type PingVoiceFrame = Readonly<{
  type: "frame"; generationId: string; connectionEpoch: string;
  ordinal: number; sampleRate: 24000; channels: 1;
  sampleCount: number; samples: ArrayBuffer;
}>;
export type PingVoiceCut = Readonly<{
  type: "cut"; generationId: string; connectionEpoch: string;
  throughFrame: number; totalSamples: number;
}>;
export type PingWorkletCommand = Readonly<{
  type: "cut"; generationId: string; connectionEpoch: string;
}>;
export type PingVoiceModelInput = Extract<PingInputEffect, { kind: "interpret_once" }>["modelInput"];
export type PingVoiceTransport = Readonly<{
  send: (text: string) => void;
  subscribe: (listener: (raw: unknown) => void, disconnected: () => void) => () => void;
  queuedBytes: () => number;
  close: () => void;
}>;
export type PingVoiceSnapshot = Readonly<{
  phase: "unavailable" | "capturing" | "finishing" | "awaiting_finals" | "interpreting" | "ready" | "closed";
  reason: string | null;
  throughFrame: number; totalSamples: number; encodedBytes: number;
  counters: Readonly<{
    appendCalls: number; appendAccepted: number; appendedBytes: number;
    commitCalls: number; commitAccepted: number; interpretationCalls: number;
    interpretationDescriptors: number;
  }>;
}>;
export type PingVoiceSession = Readonly<{
  acceptFrame: (value: unknown) => void;
  requestFinish: () => boolean;
  acceptCut: (value: unknown) => void;
  cancel: (reason?: "cancelled" | "context_changed" | "capture_failed") => void;
  tick: () => void;
  dispose: () => void;
  getSnapshot: () => PingVoiceSnapshot;
  getCaptureTag: () => Readonly<{ generationId: string; connectionEpoch: string }> | null;
  getProposal: () => PingProposal | null;
}>;
export type PingVoiceOptions = Readonly<{
  capture: unknown;
  transport: PingVoiceTransport | null;
  now: () => number;
  isContextCurrent: () => boolean;
  interpret: (input: PingVoiceModelInput, signal: AbortSignal) => Promise<unknown>;
  onSnapshot?: (snapshot: PingVoiceSnapshot) => void;
}>;

/** Offline injected runner. Captures/seals here are not session authentication. No executor seam. */
export function createPingVoiceSession(options: PingVoiceOptions): PingVoiceSession {
  let input: PingInputState | null = null;
  let phase: PingVoiceSnapshot["phase"] = "unavailable";
  let reason: string | null = "unavailable";
  let tag: Readonly<{ generationId: string; connectionEpoch: string }> | null = null;
  let lastAt = 0;
  let finishedAt: number | null = null;
  let cut: Readonly<{ throughFrame: number; totalSamples: number }> | null = null;
  let frames = 0, samples = 0, encodedBytes = 0;
  let stopped = false, running = false, released = false;
  let unsubscribe: (() => void) | null = null;
  const abort = new AbortController();
  const queue: (() => void)[] = [];
  const counters = { appendCalls: 0, appendAccepted: 0, appendedBytes: 0,
    commitCalls: 0, commitAccepted: 0, interpretationCalls: 0, interpretationDescriptors: 0 };
  const snapshot = (): PingVoiceSnapshot => Object.freeze({ phase, reason, throughFrame: frames, totalSamples: samples,
    encodedBytes, counters: Object.freeze({ ...counters }) });
  const notify = () => { try { options.onSnapshot?.(snapshot()); } catch { /* An observer cannot authorize or retry work. */ } };
  const release = () => {
    if (released) return;
    released = true;
    const detach = unsubscribe; unsubscribe = null;
    try { detach?.(); } catch { /* Best effort teardown; never retry a provider action. */ }
    try { options.transport?.close(); } catch { /* No content in diagnostics. */ }
  };
  const stop = (code: string, unavailable = false) => {
    if (stopped) return;
    stopped = true; phase = unavailable ? "unavailable" : "closed"; reason = code;
    queue.length = 0;
    if (input && tag) input = stepPingInput(input, { ...tag, type: "cancel" }, lastAt).state;
    input = null; cut = null; tag = null;
    abort.abort(); release(); notify();
  };
  const guard = (): boolean => {
    if (stopped || !input) return false;
    try {
      const now = options.now();
      if (!Number.isSafeInteger(now) || now < lastAt || now < 0) { stop("invalid_clock"); return false; }
      lastAt = now;
      if (options.isContextCurrent() !== true) { stop("context_changed"); return false; }
      // Check existing policy without emitting a tick for every audio/effect operation.
      const pending = input.segments.find((segment) => segment.sentAt !== null && segment.itemId === null);
      if (input.phase === "capturing" && now - input.startedAt >= PING_INPUT_POLICY.captureMs) { stop("capture_deadline"); return false; }
      if (finishedAt !== null && ["finishing", "awaiting_finals"].includes(phase) && now - finishedAt >= PING_INPUT_POLICY.finishMs) { stop("finish_deadline"); return false; }
      if (pending && now - pending.sentAt! >= PING_INPUT_POLICY.ackMs) { stop("ack_deadline"); return false; }
      if (input.phase === "interpreting" && input.interpretedAt !== null && now - input.interpretedAt >= PING_INPUT_POLICY.interpretationMs) { stop("interpretation_deadline"); return false; }
      return true;
    } catch { stop("invalid_runtime"); return false; }
  };
  const enqueue = (job: () => void) => {
    if (stopped) return;
    if (queue.length >= 32) { stop("callback_cap"); return; }
    queue.push(job);
    if (running) return;
    running = true;
    try {
      while (queue.length && !stopped) {
        const next = queue.shift()!;
        if (!guard()) break;
        try { next(); } catch { stop("runner_failed"); }
        notify();
      }
    } finally { running = false; }
  };
  const send = (text: string, kind: "append" | "commit", bytes = 0) => {
    if (!guard() || released || !options.transport) return false;
    try {
      const queued = options.transport.queuedBytes();
      if (!Number.isSafeInteger(queued) || queued < 0 || queued + text.length > 1_920_000) { stop("transport_backpressure"); return false; }
      if (released || !guard()) return false; // queuedBytes may synchronously disconnect/cancel.
      if (kind === "append") counters.appendCalls++; else counters.commitCalls++;
      options.transport.send(text);
      if (kind === "append") { counters.appendAccepted++; counters.appendedBytes += bytes; } else counters.commitAccepted++;
      return !stopped;
    } catch { stop("send_failed"); return false; }
  };
  const step = (fields: Record<string, unknown>) => {
    if (!input || !tag || !guard()) return;
    const result = stepPingInput(input, { ...tag, ...fields }, lastAt);
    input = result.state;
    counters.interpretationDescriptors = input.counters.interpretationDescriptors;
    if (input.phase === "closed") { stop(input.reason ?? "invalid_input"); return; }
    phase = input.phase === "capturing" ? (finishedAt === null ? "capturing" : "finishing") :
      input.phase === "sealing" ? "finishing" : input.phase === "awaiting_finals" ? "awaiting_finals" :
      input.phase === "interpreting" ? "interpreting" : input.phase === "ready" ? "ready" : "closed";
    reason = null;
    for (const effect of result.effects) {
      if (!guard()) return;
      if (effect.kind === "flush_tail") {
        if (!cut || cut.throughFrame !== effect.throughFrame || encodedBytes !== samples * 2 || counters.appendedBytes !== encodedBytes) { stop("unflushed_tail"); return; }
        step({ type: "seal_tail", throughFrame: cut.throughFrame });
      } else if (effect.kind === "send_commit") {
        if (counters.commitCalls !== 0) { stop("duplicate_commit"); return; }
        send(encodePingAudioCommit(), "commit");
      } else if (effect.kind === "interpret_once") {
        if (counters.interpretationCalls !== 0) { stop("duplicate_interpretation"); return; }
        counters.interpretationCalls++;
        let response: Promise<unknown>;
        try { response = options.interpret(effect.modelInput, abort.signal); }
        catch { stop("interpretation_failed"); return; }
        Promise.resolve(response).then((proposal) => enqueue(() => {
          step({ type: "interpretation", requestId: effect.requestId, proposal });
          if (phase === "ready") release();
        }), () => { if (!stopped) enqueue(() => stop("interpretation_failed")); });
      } else { stop("unexpected_effect"); return; }
    }
  };
  const receive = (raw: unknown) => {
    if (stopped || released) return;
    // Bound before retaining a callback, including synchronous reentrant test transports.
    if (typeof raw !== "string" || raw.length > 65536) { stop("invalid_message"); return; }
    enqueue(() => {
      const event = decodePingTranscriptionMessage(raw);
      if (event.kind === "failure") stop(event.reason);
      else if (event.kind === "ack") step({ type: "ack", itemId: event.itemId, previousItemId: event.previousItemId });
      else if (event.kind === "final") step({ type: "final", itemId: event.itemId, contentIndex: event.contentIndex, text: event.text });
    });
  };
  try {
    const now = options.now();
    const initialized = createPingInput(options.capture, now);
    if (!initialized.ok) stop(initialized.reason, true);
    else if (!options.transport) stop("unavailable", true);
    else {
      input = initialized.state; lastAt = now;
      tag = Object.freeze({ generationId: input.capture.generationId, connectionEpoch: input.capture.connectionEpoch });
      phase = "capturing"; reason = null;
      if (guard()) {
        const detach = options.transport.subscribe(receive, () => { if (!released) stop("disconnected"); });
        if (typeof detach !== "function") stop("invalid_runtime");
        else if (released) { try { detach(); } catch { /* Already closed. */ } }
        else unsubscribe = detach;
      }
    }
  } catch { stop("invalid_runtime", true); }
  const session: PingVoiceSession = {
    acceptFrame: (value) => enqueue(() => {
      if (!dataRecord(value) || !exactKeys(value, ["type", "generationId", "connectionEpoch", "ordinal", "sampleRate", "channels", "sampleCount", "samples"]) ||
        value.type !== "frame" || value.generationId !== tag?.generationId || value.connectionEpoch !== tag?.connectionEpoch || cut ||
        value.ordinal !== frames + 1 || value.sampleRate !== PING_PCM_RATE || value.channels !== 1 ||
        !Number.isSafeInteger(value.sampleCount) || (value.sampleCount as number) < 1 || (value.sampleCount as number) > PING_PCM_BLOCK_SAMPLES ||
        samples + (value.sampleCount as number) > PING_PCM_MAX_SAMPLES || !value.samples || Object.getPrototypeOf(value.samples) !== ArrayBuffer.prototype ||
        Reflect.ownKeys(value.samples).length !== 0) { stop("invalid_frame"); return; }
      const length = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(value.samples) as number;
      if (length !== (value.sampleCount as number) * 4) { stop("invalid_frame"); return; }
      const encoded = encodePingPcm(new Float32Array((value.samples as ArrayBuffer).slice(0)));
      if (!encoded.ok) { stop("invalid_samples"); return; }
      frames++; samples += encoded.samples;
      step({ type: "accept_audio", frameOrdinal: frames, decodedBytes: encoded.bytes.length, format: "pcm_s16le_mono_24000" });
      if (stopped) return;
      step({ type: "encoded_audio", throughFrame: frames, decodedBytes: encoded.bytes.length });
      if (stopped) return;
      encodedBytes += encoded.bytes.length;
      const append = encodePingPcmAppend(encoded.bytes);
      if (!append.ok) stop("invalid_pcm"); else send(append.text, "append", append.decodedBytes);
    }),
    requestFinish: () => {
      if (!guard() || finishedAt !== null || phase !== "capturing") return false;
      finishedAt = lastAt; phase = "finishing"; enqueue(() => {}); return !stopped;
    },
    acceptCut: (value) => enqueue(() => {
      if (!dataRecord(value) || !exactKeys(value, ["type", "generationId", "connectionEpoch", "throughFrame", "totalSamples"]) ||
        value.type !== "cut" || value.generationId !== tag?.generationId || value.connectionEpoch !== tag?.connectionEpoch ||
        finishedAt === null || value.throughFrame !== frames || value.totalSamples !== samples || !frames || !samples) { stop("invalid_cut"); return; }
      if (cut) return;
      cut = Object.freeze({ throughFrame: frames, totalSamples: samples });
      step({ type: "finish" });
    }),
    cancel: (code = "cancelled") => stop(["cancelled", "context_changed", "capture_failed"].includes(code) ? code : "cancelled"),
    tick: () => enqueue(() => step({ type: "tick" })),
    dispose: () => stop("disposed"),
    getSnapshot: snapshot,
    getCaptureTag: () => stopped ? null : tag,
    getProposal: () => !stopped && input?.phase === "ready" && input.binding ? input.binding.proposal : null,
  };
  notify();
  return Object.freeze(session);
}
