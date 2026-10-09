import "server-only";
import { createPingInput, stepPingInput, PING_INPUT_POLICY, type PingInputEffect, type PingInputState } from "@/lib/ping/input-protocol";
import { normalizePingCapture } from "@/lib/ping/proposal";
import { dataRecord, exactKeys, freeze, jsonArray } from "@/lib/ping/input-validation";
import { PING_PCM_BLOCK_SAMPLES, PING_PCM_MAX_SAMPLES } from "@/lib/ping/pcm";
import { decodePingTranscriptionMessage, encodePingAudioCommit, encodePingPcmAppend } from "@/lib/ping/realtime-transcription";
import type { PingClipTranscription, PingClipUsage } from "./openai-clip-transcription";
import type { PingStreamingReady } from "./openai-streaming-transcription";

export type PingStreamingPairedOptions = Readonly<{ capture: unknown;
  open: (signal: AbortSignal) => Promise<PingStreamingReady>; deadlineMs?: number }>;
const natural = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function copiedPcm(value: unknown): Uint8Array<ArrayBuffer> | null {
  try {
    if (!value || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
    const native = Object.getPrototypeOf(Uint8Array.prototype);
    if (Object.getOwnPropertyDescriptor(native, Symbol.toStringTag)!.get!.call(value) !== "Uint8Array") return null;
    const buffer = Object.getOwnPropertyDescriptor(native, "buffer")!.get!.call(value);
    if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return null;
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(buffer);
    const length = Object.getOwnPropertyDescriptor(native, "length")!.get!.call(value) as number;
    if (!length || length % 2 || length > PING_PCM_MAX_SAMPLES * 2) return null;
    const bytes = new Uint8Array(length); Uint8Array.prototype.set.call(bytes, value as Uint8Array); return bytes;
  } catch { return null; }
}
function copiedUsage(value: unknown): PingClipUsage | null | false {
  if (value === null) return null;
  if (!dataRecord(value)) return false;
  if (value.type === "duration") return exactKeys(value, ["type", "seconds"]) && typeof value.seconds === "number" &&
    Number.isFinite(value.seconds) && value.seconds >= 0 ? freeze({ type: "duration", seconds: value.seconds }) : false;
  if (value.type !== "tokens" || !exactKeys(value, ["type", "input_tokens", "output_tokens", "total_tokens"], ["input_token_details"]) ||
    !natural(value.input_tokens) || !natural(value.output_tokens) || !natural(value.total_tokens) ||
    value.input_tokens + value.output_tokens !== value.total_tokens) return false;
  const detail = value.input_token_details;
  if (Object.hasOwn(value, "input_token_details") && (!dataRecord(detail) || !exactKeys(detail, [], ["audio_tokens", "text_tokens"]) ||
    (Object.hasOwn(detail, "audio_tokens") && !natural(detail.audio_tokens)) ||
    (Object.hasOwn(detail, "text_tokens") && !natural(detail.text_tokens)))) return false;
  return freeze({ type: "tokens", input_tokens: value.input_tokens, output_tokens: value.output_tokens, total_tokens: value.total_tokens,
    ...(dataRecord(detail) ? { input_token_details: { ...(Object.hasOwn(detail, "audio_tokens") ? { audio_tokens: detail.audio_tokens as number } : {}),
      ...(Object.hasOwn(detail, "text_tokens") ? { text_tokens: detail.text_tokens as number } : {}) } } : {}) });
}

/** Disconnected completed-clip replay. Caller must supply this same original capture to its paired trial.
 * Consumes the existing complete-final descriptor as text; it invokes no interpreter/dispatch.
 * Open/closed are trusted explicit port contracts, not observed provider settlement or authentication. */
export function createPingStreamingPairedTranscriber(options: PingStreamingPairedOptions) {
  if (!dataRecord(options) || !exactKeys(options, ["capture", "open"], ["deadlineMs"]) || typeof options.open !== "function" ||
    (options.deadlineMs !== undefined && (!natural(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)))
    throw Error("ping_stream_pair_configuration");
  const capture = normalizePingCapture(options.capture);
  if (!capture) throw Error("ping_stream_pair_configuration");
  const { open } = options, budget = options.deadlineMs ?? 10_000;
  let busy = false;
  return async (value: unknown, signal: AbortSignal): Promise<PingClipTranscription> => {
    if (!(signal instanceof AbortSignal)) throw Error("ping_stream_pair_input");
    if (signal.aborted) throw Error("ping_stream_pair_cancelled");
    if (busy) throw Error("ping_stream_pair_busy");
    const started = performance.now(), deadline = started + budget, bytes = copiedPcm(value);
    if (!bytes) throw Error("ping_stream_pair_input");
    if (signal.aborted) throw Error("ping_stream_pair_cancelled");
    if (performance.now() >= deadline) throw Error("ping_stream_pair_deadline");
    if (busy) throw Error("ping_stream_pair_busy");
    busy = true;
    const controller = new AbortController();
    const created = createPingInput(capture, 0);
    if (!created.ok) { busy = false; throw Error("ping_stream_pair_input"); }
    let state: PingInputState | null = created.state, ready: PingStreamingReady | null = null;
    let terminal: "complete" | "cancelled" | "deadline" | "failed" | null = null;
    let text: string | null = null, usage: PingClipUsage | null = null, detached: (() => void) | null = null;
    let closeAsked = false, physicallyClosed = false, invoked = false, commitSent = false;
    let wireEvents = 0, draining = false, frame = 0;
    type Work = { event: Record<string, unknown> } | { effect: PingInputEffect };
    const queue: Work[] = [];
    let tickTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveTerminal!: () => void;
    const done = new Promise<void>(resolve => { resolveTerminal = resolve; });
    const elapsed = () => Math.floor(performance.now() - started);
    const cleanup = () => {
      const detach = detached; detached = null; try { detach?.(); } catch { /* No physical release inferred. */ }
      if (ready && !closeAsked) { closeAsked = true; try { ready.transport.close(); } catch { /* Witness still required. */ } }
    };
    const stop = (reason: Exclude<typeof terminal, null>) => {
      if (terminal !== null && !(terminal === "complete" && (reason === "cancelled" || reason === "deadline"))) return;
      terminal = reason; if (reason !== "complete") text = null;
      state = null; queue.length = 0; clearTimeout(tickTimer);
      resolveTerminal(); cleanup(); controller.abort();
    };
    const abort = () => stop("cancelled");
    const guard = () => {
      if (terminal !== null) return false;
      if (signal.aborted) { stop("cancelled"); return false; }
      if (performance.now() >= deadline) { stop("deadline"); return false; }
      return true;
    };
    const timer = setTimeout(() => stop("deadline"), Math.max(0, deadline - performance.now()));
    signal.addEventListener("abort", abort, { once: true });
    const send = (encoded: string, committing = false) => {
      if (!guard() || !ready) return false;
      try {
        const backlog = ready.transport.queuedBytes();
        if (!guard()) return false;
        if (!natural(backlog) || backlog > 65_536 || (committing && commitSent)) { stop("failed"); return false; }
        if (committing) commitSent = true;
        ready.transport.send(encoded); return guard();
      } catch { stop("failed"); return false; }
    };
    const armTick = () => {
      clearTimeout(tickTimer);
      if (!state || terminal !== null) return;
      const pending = state.segments.find(segment => segment.sentAt !== null && segment.itemId === null);
      const due = Math.min(deadline - started,
        state.phase === "capturing" ? PING_INPUT_POLICY.captureMs : Infinity,
        pending ? pending.sentAt! + PING_INPUT_POLICY.ackMs : Infinity,
        state.finishAt !== null ? state.finishAt + PING_INPUT_POLICY.finishMs : Infinity);
      tickTimer = setTimeout(() => enqueue({ event: { type: "tick" } }), Math.max(1, due - elapsed()));
    };
    const apply = (event: Record<string, unknown>) => {
      if (!guard() || !state) return;
      const step = stepPingInput(state, { ...event, generationId: capture.generationId, connectionEpoch: capture.connectionEpoch }, elapsed());
      state = step.state; // Publish complete intent before any effect can synchronously receive a real ACK/final.
      if (state.phase === "closed") { stop("failed"); return; }
      for (const effect of step.effects) queue.push({ effect });
      armTick();
    };
    const effect = (action: PingInputEffect) => {
      if (!guard()) return;
      if (action.kind === "flush_tail") { queue.push({ event: { type: "seal_tail", throughFrame: action.throughFrame } }); return; }
      if (action.kind === "send_commit") {
        if (action.ordinal !== 0 || action.throughFrame !== frame || action.decodedBytes !== bytes.length) { stop("failed"); return; }
        send(encodePingAudioCommit(), true); return;
      }
      if (action.kind !== "interpret_once" || !ready || !commitSent || state?.counters.interpretationDescriptors !== 1) { stop("failed"); return; }
      try {
        const observations: unknown = ready.getUsage();
        if (!jsonArray(observations, 1)) { stop("failed"); return; }
        let copied: PingClipUsage | null = null;
        if (observations.length === 1) {
          const observation = observations[0];
          if (!dataRecord(observation) || !exactKeys(observation, ["provenance", "usage"]) || observation.provenance !== "transcription") {
            stop("failed"); return;
          }
          const checked = copiedUsage(observation.usage);
          if (checked === false) { stop("failed"); return; } copied = checked;
        }
        if (!guard()) return;
        text = action.transcript; usage = copied; stop("complete");
      } catch { stop("failed"); }
    };
    function enqueue(work: Work) {
      if (terminal !== null) return;
      if (queue.length >= PING_INPUT_POLICY.events) { stop("failed"); return; }
      queue.push(work);
      if (draining) return;
      draining = true;
      try { while (queue.length && guard()) { const next = queue.shift()!; if ("event" in next) apply(next.event); else effect(next.effect); } }
      finally { draining = false; }
    }
    const message = (raw: unknown) => {
      if (!guard()) return;
      if (++wireEvents > PING_INPUT_POLICY.events) { stop("failed"); return; }
      const decoded = decodePingTranscriptionMessage(raw);
      if (decoded.kind === "failure") stop("failed");
      else if (decoded.kind === "ack") enqueue({ event: { type: "ack", itemId: decoded.itemId, previousItemId: decoded.previousItemId } });
      else if (decoded.kind === "final") enqueue({ event: { type: "final", itemId: decoded.itemId, contentIndex: 0, text: decoded.text } });
    };
    try {
      if (!guard()) throw Error("stopped");
      invoked = true; const opened: unknown = await open(controller.signal);
      const transport: unknown = dataRecord(opened) ? opened.transport : null;
      if (!dataRecord(opened) || !exactKeys(opened, ["transport", "getUsage", "closed"]) || typeof opened.getUsage !== "function" ||
        !(opened.closed instanceof Promise) || !dataRecord(transport) || !exactKeys(transport, ["send", "queuedBytes", "subscribe", "close"]) ||
        ["send", "queuedBytes", "subscribe", "close"].some(key => typeof transport[key] !== "function")) throw Error("port");
      ready = opened as PingStreamingReady;
      void ready.closed.then(() => { physicallyClosed = true; if (terminal === null) stop("failed"); }, () => stop("failed"));
      if (guard()) {
        const detach = ready.transport.subscribe(message, () => stop("failed"));
        if (typeof detach !== "function") throw Error("subscription");
        if (terminal !== null) { try { detach(); } catch { /* Physical witness still required. */ } } else detached = detach;
      }
      if (!guard()) cleanup();
      for (let offset = 0; offset < bytes.length && guard(); offset += PING_PCM_BLOCK_SAMPLES * 2) {
        const length = Math.min(PING_PCM_BLOCK_SAMPLES * 2, bytes.length - offset), block = new Uint8Array(length);
        // Intrinsic copying does not consult instance methods or typed-array species.
        Uint8Array.prototype.set.call(block, new Uint8Array(bytes.buffer, offset, length));
        frame++; enqueue({ event: { type: "accept_audio", frameOrdinal: frame, decodedBytes: length, format: "pcm_s16le_mono_24000" } });
        const encoded = encodePingPcmAppend(block);
        if (!encoded.ok || !send(encoded.text)) { if (terminal === null) stop("failed"); break; }
        enqueue({ event: { type: "encoded_audio", throughFrame: frame, decodedBytes: length } });
      }
      if (guard()) enqueue({ event: { type: "finish" } });
      await done; cleanup(); await ready.closed;
      physicallyClosed = true;
      if (signal.aborted) stop("cancelled"); else if (performance.now() >= deadline) stop("deadline");
      if (terminal !== "complete" || text === null) throw Error("stopped");
      return freeze({ text, usage });
    } catch {
      if (terminal === null) stop("failed");
      cleanup();
      if (ready) { try { await ready.closed; physicallyClosed = true; } catch { /* Rejected witness retains admission. */ } }
      throw Error(terminal === "cancelled" ? "ping_stream_pair_cancelled" : terminal === "deadline" ? "ping_stream_pair_deadline" : "ping_stream_pair_failed");
    } finally {
      clearTimeout(timer); clearTimeout(tickTimer); signal.removeEventListener("abort", abort);
      state = null; queue.length = 0; text = null;
      if (!invoked || physicallyClosed) busy = false;
    }
  };
}
