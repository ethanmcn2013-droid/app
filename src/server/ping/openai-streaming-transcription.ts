import "server-only";
import type { PingVoiceTransport } from "@/lib/ping/voice-session";
import { validPingId } from "@/lib/ping/command";
import { canonicalIdentity, codePoints, dataRecord, exactKeys, freeze, jsonArray, transcriptText } from "@/lib/ping/input-validation";
import type { PingClipUsage } from "./openai-clip-transcription";

export const PING_STREAMING_ENDPOINT = "wss://eu.api.openai.com/v1/realtime?intent=transcription";
export type PingStreamingSocket = Readonly<{
  send: (text: string) => void; queuedBytes: () => number;
  subscribe: (message: (raw: unknown) => void, disconnected: () => void) => () => void;
  close: () => void;
  /** Must fulfill only after actual physical closure. A rejection cannot release admission. */
  closed: Promise<void>;
}>;
export type PingStreamingUsage = Readonly<{ provenance: "transcription"; usage: PingClipUsage | null }>;
export type PingStreamingReady = Readonly<{ transport: PingVoiceTransport; getUsage: () => readonly PingStreamingUsage[] }>;
export type PingStreamingOptions = Readonly<{ model: string; apiKey: string;
  connect: (url: string, options: Readonly<{ headers: Readonly<{ Authorization: string }>; signal: AbortSignal }>) => Promise<PingStreamingSocket>;
  handshakeMs?: number }>;
const models = ["gpt-live-transcribe", "gpt-transcribe", "gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1", "gpt-realtime-whisper"];
const empty = (v: unknown) => v === null || jsonArray(v, 0);
const absentEmpty = (r: Record<string, unknown>, k: string) => !Object.hasOwn(r, k) || r[k] === null || r[k] === "";
const natural = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function usage(v: unknown): PingClipUsage | null {
  if (!dataRecord(v)) return null;
  if (v.type === "duration") return exactKeys(v, ["type", "seconds"]) && typeof v.seconds === "number" && Number.isFinite(v.seconds) && v.seconds >= 0
    ? freeze({ type: "duration", seconds: v.seconds }) : null;
  if (v.type !== "tokens" || !exactKeys(v, ["type", "input_tokens", "output_tokens", "total_tokens"], ["input_token_details"]) ||
    !natural(v.input_tokens) || !natural(v.output_tokens) || !natural(v.total_tokens) || v.input_tokens + v.output_tokens !== v.total_tokens) return null;
  const d = v.input_token_details;
  if (d !== undefined && d !== null && (!dataRecord(d) || !exactKeys(d, [], ["audio_tokens", "text_tokens"]) ||
    (Object.hasOwn(d, "audio_tokens") && !natural(d.audio_tokens)) || (Object.hasOwn(d, "text_tokens") && !natural(d.text_tokens)))) return null;
  return freeze({ type: "tokens", input_tokens: v.input_tokens, output_tokens: v.output_tokens, total_tokens: v.total_tokens,
    ...(dataRecord(d) ? { input_token_details: { ...(Object.hasOwn(d, "audio_tokens") ? { audio_tokens: d.audio_tokens as number } : {}),
      ...(Object.hasOwn(d, "text_tokens") ? { text_tokens: d.text_tokens as number } : {}) } } : {}) });
}
function session(v: unknown, model: string, effective: boolean): string | null {
  if (!dataRecord(v) || !exactKeys(v, ["id", "object", "type"], ["audio", "expires_at", "include"]) || !validPingId(v.id) ||
    v.object !== "realtime.transcription_session" || v.type !== "transcription" ||
    (Object.hasOwn(v, "expires_at") && v.expires_at !== null && !natural(v.expires_at)) ||
    (Object.hasOwn(v, "include") && !empty(v.include))) return null;
  if (v.audio === undefined || v.audio === null) return effective ? null : v.id;
  if (!dataRecord(v.audio) || !exactKeys(v.audio, [], ["input"])) return null;
  const i = v.audio.input;
  if (i === undefined || i === null) return effective ? null : v.id;
  if (!dataRecord(i) || !exactKeys(i, [], ["format", "noise_reduction", "transcription", "turn_detection"])) return null;
  if (i.format != null && (!dataRecord(i.format) || !exactKeys(i.format, ["type", "rate"]) || i.format.type !== "audio/pcm" || i.format.rate !== 24000)) return null;
  if (i.noise_reduction != null && (!dataRecord(i.noise_reduction) || !exactKeys(i.noise_reduction, ["type"]) || !["near_field", "far_field"].includes(i.noise_reduction.type as string))) return null;
  if (i.turn_detection != null && (!dataRecord(i.turn_detection) || !exactKeys(i.turn_detection, ["type"], ["threshold", "prefix_padding_ms", "silence_duration_ms"]) ||
    i.turn_detection.type !== "server_vad" || Object.entries(i.turn_detection).some(([k, n]) => k !== "type" && (typeof n !== "number" || !Number.isFinite(n) || n < 0)))) return null;
  const t = i.transcription;
  if (t != null && (!dataRecord(t) || !exactKeys(t, [], ["model", "prompt", "language", "languages", "keywords", "delay"]) ||
    (t.model != null && (typeof t.model !== "string" || !models.includes(t.model))) || !absentEmpty(t, "prompt") || !absentEmpty(t, "language") ||
    (["languages", "keywords"].some((k) => Object.hasOwn(t, k) && !empty(t[k]))) ||
    (t.delay != null && !["minimal", "low", "medium", "high", "xhigh"].includes(t.delay as string)))) return null;
  if (effective && (!dataRecord(i.format) || i.format.type !== "audio/pcm" || i.format.rate !== 24000 ||
    !Object.hasOwn(i, "noise_reduction") || i.noise_reduction !== null || !Object.hasOwn(i, "turn_detection") || i.turn_detection !== null ||
    !dataRecord(t) || t.model !== model)) return null;
  return v.id;
}

/** Disconnected async ready-only opener. The supplied physical socket contract remains unverified. */
export function createPingOpenAiStreamingTranscription(options: PingStreamingOptions) {
  if (!dataRecord(options) || !exactKeys(options, ["model", "apiKey", "connect"], ["handshakeMs"]) || !models.includes(options.model as string) ||
    typeof options.apiKey !== "string" || !/^[\x21-\x7e]{1,512}$/.test(options.apiKey) || typeof options.connect !== "function" ||
    (options.handshakeMs !== undefined && (!natural(options.handshakeMs) || options.handshakeMs < 1 || options.handshakeMs > 5000))) throw new Error("ping_stream_configuration");
  const { model, apiKey, connect } = options, handshake = options.handshakeMs ?? 5000;
  let busy = false;
  return (signal: AbortSignal): Promise<PingStreamingReady> => {
    if (signal.aborted) return Promise.reject(new Error("ping_stream_cancelled"));
    if (busy) return Promise.reject(new Error("ping_stream_busy"));
    busy = true;
    const controller = new AbortController(), started = performance.now();
    let phase: "connecting" | "created" | "updated" | "cleared" | "ready" | "closed" = "connecting";
    let socket: PingStreamingSocket | null = null, detach: (() => void) | null = null, closeAsked = false;
    let connectSettled = false, physicallyClosed = false, published = false, subscribed = false;
    let sessionId: string | null = null, conversationSeen = false, events = 0, bytes = 0, committed = false;
    let listener: ((raw: unknown) => void) | null = null, disconnected: (() => void) | null = null, appSending = false;
    const items = new Map<string, { previous?: string | null; final?: string; transcript?: string | null; usage?: string }>();
    const observations: PingStreamingUsage[] = [];
    let ack: { item: string; previous: string | null } | null = null;
    let resolve!: (v: PingStreamingReady) => void, reject!: (e: Error) => void;
    const result = new Promise<PingStreamingReady>((r, j) => { resolve = r; reject = j; });
    const release = () => { if (phase === "closed" && connectSettled && physicallyClosed) busy = false; };
    const cleanup = () => {
      const d = detach; detach = null; try { d?.(); } catch { /* Closure remains governed by the physical promise. */ }
      if (socket && !closeAsked) { closeAsked = true; try { socket.close(); } catch { /* Unknown closure holds admission. */ } }
    };
    const stop = (reason: "cancelled" | "deadline" | "invalid" | "disconnected" | "closed") => {
      if (phase === "closed") return;
      phase = "closed"; clearTimeout(timer); signal.removeEventListener("abort", aborted);
      const notify = disconnected; listener = null; disconnected = null; items.clear();
      if (!published) reject(new Error(`ping_stream_${reason}`));
      controller.abort(); cleanup(); try { notify?.(); } catch { /* Fixed close state already latched. */ } release();
    };
    const aborted = () => stop("cancelled");
    const valid = () => {
      if (phase === "closed") return false;
      if (signal.aborted) { stop("cancelled"); return false; }
      if (performance.now() - started >= (published ? handshake + 65_000 : handshake)) { stop("deadline"); return false; }
      return true;
    };
    let timer = setTimeout(() => stop("deadline"), handshake);
    signal.addEventListener("abort", aborted, { once: true });
    const physicalSend = (text: string, commit = false): boolean => {
      if (!valid() || !socket) return false;
      try {
        const queued = socket.queuedBytes();
        if (!valid()) return false;
        if (!natural(queued) || queued > 65_536) { stop("invalid"); return false; }
        if (commit) committed = true;
        socket.send(text); return valid();
      } catch { stop("disconnected"); return false; }
    };
    const forward = (value: unknown) => { try { listener?.(JSON.stringify(value)); } catch { stop("invalid"); } };
    const item = (id: string) => {
      if (!items.has(id)) { if (items.size >= 8) return null; items.set(id, {}); }
      return items.get(id)!;
    };
    const message = (raw: unknown) => {
      if (!valid()) return;
      try {
        if (typeof raw !== "string" || raw.length > 65_536 || new TextEncoder().encode(raw).length > 65_536 || ++events > 512) { stop("invalid"); return; }
        const v: unknown = JSON.parse(raw);
        if (!dataRecord(v) || typeof v.type !== "string" || !validPingId(v.event_id)) { stop("invalid"); return; }
        if (v.type === "session.created" || v.type === "session.updated") {
          const initial = v.type === "session.created";
          if (!exactKeys(v, ["type", "event_id", "session"]) || phase !== (initial ? "created" : "updated")) { stop("invalid"); return; }
          const id = session(v.session, model, !initial);
          if (!id || (!initial && id !== sessionId)) { stop("invalid"); return; }
          if (initial) {
            sessionId = id; phase = "updated";
            physicalSend(JSON.stringify({ type: "session.update", session: { type: "transcription", audio: { input: {
              format: { type: "audio/pcm", rate: 24000 }, transcription: { model }, noise_reduction: null, turn_detection: null } }, include: [] } }));
          } else { phase = "cleared"; physicalSend('{"type":"input_audio_buffer.clear"}'); }
          return;
        }
        if (v.type === "conversation.created") {
          if (phase === "created" || phase === "connecting" || conversationSeen || !exactKeys(v, ["type", "event_id", "conversation"]) ||
            !dataRecord(v.conversation) || !exactKeys(v.conversation, ["id", "object"]) || !validPingId(v.conversation.id) || v.conversation.object !== "realtime.conversation") { stop("invalid"); return; }
          conversationSeen = true; return;
        }
        if (v.type === "input_audio_buffer.cleared") {
          if (phase !== "cleared" || !exactKeys(v, ["type", "event_id"])) { stop("invalid"); return; }
          phase = "ready"; if (!valid()) return;
          clearTimeout(timer); timer = setTimeout(() => stop("deadline"), Math.max(1, started + handshake + 65_000 - performance.now()));
          published = true; resolve(freeze({ transport, getUsage: () => freeze(observations.map((o) => ({ ...o }))) })); return;
        }
        if (phase !== "ready" || !committed) { stop("invalid"); return; }
        if (v.type === "input_audio_buffer.committed") {
          if (!exactKeys(v, ["type", "event_id", "item_id"], ["previous_item_id"]) || !validPingId(v.item_id) ||
            (Object.hasOwn(v, "previous_item_id") && v.previous_item_id !== null && !validPingId(v.previous_item_id))) { stop("invalid"); return; }
          const previous = (v.previous_item_id ?? null) as string | null;
          if (previous !== null || (ack && (ack.item !== v.item_id || ack.previous !== previous)) ||
            [...items].some(([id, i]) => id !== v.item_id || (Object.hasOwn(i, "previous") && i.previous !== previous))) { stop("invalid"); return; }
          ack = { item: v.item_id, previous }; if (!item(v.item_id)) { stop("invalid"); return; }
          forward({ type: v.type, event_id: v.event_id, item_id: v.item_id, ...(Object.hasOwn(v, "previous_item_id") ? { previous_item_id: v.previous_item_id } : {}) }); return;
        }
        if (["conversation.item.created", "conversation.item.added", "conversation.item.done"].includes(v.type)) {
          const i = v.item;
          if (!exactKeys(v, ["type", "event_id", "item"], ["previous_item_id"]) || !dataRecord(i) || !exactKeys(i, ["id", "type", "role", "content"], ["object", "status"]) ||
            !validPingId(i.id) || i.type !== "message" || i.role !== "user" || (i.object !== undefined && i.object !== "realtime.item") ||
            (i.status !== undefined && !["in_progress", "completed", "incomplete"].includes(i.status as string)) || !jsonArray(i.content, 1) ||
            (Object.hasOwn(v, "previous_item_id") && v.previous_item_id !== null && !validPingId(v.previous_item_id))) { stop("invalid"); return; }
          const entry = item(i.id), c = i.content[0];
          if (!entry || (ack && i.id !== ack.item) || (c !== undefined && (!dataRecord(c) || !exactKeys(c, ["type"], ["transcript"]) || c.type !== "input_audio" ||
            (c.transcript != null && (!transcriptText(c.transcript, true) || codePoints(c.transcript) > 4000))))) { stop("invalid"); return; }
          if (Object.hasOwn(v, "previous_item_id")) {
            if ((Object.hasOwn(entry, "previous") && entry.previous !== v.previous_item_id) || (ack && ack.previous !== v.previous_item_id)) { stop("invalid"); return; }
            entry.previous = v.previous_item_id as string | null;
          }
          if (dataRecord(c) && typeof c.transcript === "string") {
            if ((entry.transcript != null && entry.transcript !== c.transcript) || (entry.final !== undefined && entry.final !== c.transcript)) { stop("invalid"); return; }
            entry.transcript = c.transcript;
          }
          return;
        }
        const final = v.type === "conversation.item.input_audio_transcription.completed", preview = v.type === "conversation.item.input_audio_transcription.delta";
        if (!final && !preview) { stop("invalid"); return; }
        if (!exactKeys(v, ["type", "event_id", "item_id", ...(final ? ["content_index", "transcript"] : [])],
          final ? ["usage", "languages", "logprobs"] : ["content_index", "delta", "logprobs", "obfuscation"]) || !validPingId(v.item_id) ||
          (Object.hasOwn(v, "content_index") && v.content_index !== 0) || (Object.hasOwn(v, "logprobs") && !empty(v.logprobs)) ||
          (Object.hasOwn(v, "obfuscation") && (typeof v.obfuscation !== "string" || v.obfuscation.length > 256)) ||
          (Object.hasOwn(v, "languages") && v.languages !== null && (!jsonArray(v.languages, 16) || !v.languages.every((l) => dataRecord(l) && exactKeys(l, ["code"]) && typeof l.code === "string" && /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(l.code)))) ||
          (ack && ack.item !== v.item_id)) { stop("invalid"); return; }
        const entry = item(v.item_id), text = final ? v.transcript : v.delta;
        if (!entry || (Object.hasOwn(v, final ? "transcript" : "delta") && (!transcriptText(text, !final) || codePoints(text as string) > 4000))) { stop("invalid"); return; }
        if (!final) { if (v.content_index === 0 && typeof text === "string") forward({ type: v.type, event_id: v.event_id, item_id: v.item_id, content_index: 0, delta: text }); return; }
        const u = Object.hasOwn(v, "usage") ? usage(v.usage) : null;
        if ((Object.hasOwn(v, "usage") && !u) || (entry.final !== undefined && (entry.final !== text || entry.usage !== canonicalIdentity(u))) ||
          (entry.transcript != null && entry.transcript !== text)) { stop("invalid"); return; }
        if (entry.final === undefined) { entry.final = text as string; entry.usage = canonicalIdentity(u); observations.push(freeze({ provenance: "transcription", usage: u })); }
        forward({ type: v.type, event_id: v.event_id, item_id: v.item_id, content_index: 0, transcript: text });
      } catch { stop("invalid"); }
    };
    const transport: PingVoiceTransport = Object.freeze({
      send: (text: string) => {
        if (!valid() || phase !== "ready" || appSending) { stop("invalid"); throw new Error("ping_stream_closed"); }
        appSending = true;
        try {
          if (typeof text !== "string" || text.length > 14_000) throw new Error();
          const v: unknown = JSON.parse(text);
          if (!dataRecord(v)) throw new Error();
          let committing = false;
          if (v.type === "input_audio_buffer.append" && !committed && exactKeys(v, ["type", "audio"]) && typeof v.audio === "string" &&
            /^[A-Za-z0-9+/]+={0,2}$/.test(v.audio) && v.audio.length % 4 === 0) {
            const binary = atob(v.audio), n = binary.length;
            if (!n || n % 2 || n > 9600 || btoa(binary) !== v.audio || bytes + n > 1_440_000) throw new Error();
            bytes += n;
          } else if (v.type === "input_audio_buffer.commit" && exactKeys(v, ["type"]) && !committed && bytes > 0) committing = true;
          else throw new Error();
          if (!physicalSend(text, committing)) throw new Error();
        } catch { stop("invalid"); throw new Error("ping_stream_closed"); }
        finally { appSending = false; }
      },
      queuedBytes: () => { if (!valid() || !socket) return 65_537; try { const n = socket.queuedBytes(); return valid() && natural(n) ? n : 65_537; } catch { stop("disconnected"); return 65_537; } },
      subscribe: (fn: (raw: unknown) => void, lost: () => void) => {
        if (!valid() || phase !== "ready" || subscribed) throw new Error("ping_stream_closed");
        subscribed = true; listener = fn; disconnected = lost;
        return () => { listener = null; disconnected = null; };
      }, close: () => stop("closed") });
    void (async () => {
      try {
        if (!valid()) { connectSettled = true; physicallyClosed = true; release(); return; }
        const s = await connect(PING_STREAMING_ENDPOINT, { headers: Object.freeze({ Authorization: `Bearer ${apiKey}` }), signal: controller.signal });
        socket = s; connectSettled = true;
        // Closure fulfillment is the sole physical release witness; a rejection intentionally retains admission.
        void s.closed.then(() => { physicallyClosed = true; stop("disconnected"); release(); }, () => { stop("disconnected"); });
        if (!valid()) { cleanup(); return; }
        phase = "created";
        const d = s.subscribe(message, () => stop("disconnected"));
        if (!valid()) { try { d(); } catch { /* Keep physical ownership. */ } } else detach = d;
      } catch { connectSettled = true; if (!socket) physicallyClosed = true; stop("disconnected"); release(); }
    })();
    return result;
  };
}
