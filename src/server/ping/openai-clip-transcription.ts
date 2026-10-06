import "server-only";
import { PING_PCM_MAX_SAMPLES, PING_PCM_RATE } from "@/lib/ping/pcm";
import { codePoints, dataRecord, exactKeys, freeze, jsonArray, transcriptText } from "@/lib/ping/input-validation";

export const PING_CLIP_ENDPOINT = "https://eu.api.openai.com/v1/audio/transcriptions";
const MODELS = ["gpt-transcribe", "gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"];
const RESPONSE_BYTES = 65_536;
export type PingClipUsage = Readonly<{ type: "duration"; seconds: number }> |
  Readonly<{ type: "tokens"; input_tokens: number; output_tokens: number; total_tokens: number;
    input_token_details?: Readonly<{ audio_tokens?: number; text_tokens?: number }> }>;
export type PingClipTranscription = Readonly<{ text: string; usage: PingClipUsage | null }>;
export type PingOpenAiClipOptions = Readonly<{ model: string; apiKey: string;
  fetch: (input: string, init: RequestInit) => Promise<Response>; deadlineMs?: number }>;

/** Copy native completed PCM only. No caller iteration, instance methods or species-sensitive slice. */
export function encodePingCompletedPcmWav(pcm: unknown): Uint8Array<ArrayBuffer> | null {
  try {
    if (!pcm || Object.getPrototypeOf(pcm) !== Uint8Array.prototype) return null;
    const native = Object.getPrototypeOf(Uint8Array.prototype);
    if (Object.getOwnPropertyDescriptor(native, Symbol.toStringTag)!.get!.call(pcm) !== "Uint8Array") return null;
    const buffer: unknown = Object.getOwnPropertyDescriptor(native, "buffer")!.get!.call(pcm);
    if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return null;
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(buffer);
    const length = Object.getOwnPropertyDescriptor(native, "length")!.get!.call(pcm) as number;
    if (length < 2 || length % 2 || length > PING_PCM_MAX_SAMPLES * 2) return null;
    const bytes = new Uint8Array(44 + length), header = new DataView(bytes.buffer);
    Uint8Array.prototype.set.call(bytes, [82, 73, 70, 70], 0); // RIFF
    header.setUint32(4, length + 36, true);
    Uint8Array.prototype.set.call(bytes, [87, 65, 86, 69, 102, 109, 116, 32], 8); // WAVEfmt
    header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
    header.setUint32(24, PING_PCM_RATE, true); header.setUint32(28, PING_PCM_RATE * 2, true);
    header.setUint16(32, 2, true); header.setUint16(34, 16, true);
    Uint8Array.prototype.set.call(bytes, [100, 97, 116, 97], 36); // data
    header.setUint32(40, length, true);
    Uint8Array.prototype.set.call(bytes, pcm as Uint8Array, 44);
    return bytes;
  } catch { return null; }
}
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function usage(value: unknown): PingClipUsage | null {
  if (!dataRecord(value)) return null;
  if (value.type === "duration") return exactKeys(value, ["type", "seconds"]) && typeof value.seconds === "number" &&
    Number.isFinite(value.seconds) && value.seconds >= 0 ? freeze({ type: "duration", seconds: value.seconds }) : null;
  if (value.type !== "tokens" || !exactKeys(value, ["type", "input_tokens", "output_tokens", "total_tokens"], ["input_token_details"]) ||
    !count(value.input_tokens) || !count(value.output_tokens) || !count(value.total_tokens) ||
    value.input_tokens + value.output_tokens !== value.total_tokens) return null;
  let details: { audio_tokens?: number; text_tokens?: number } | undefined;
  if (Object.hasOwn(value, "input_token_details")) {
    const input = value.input_token_details;
    if (!dataRecord(input) || !exactKeys(input, [], ["audio_tokens", "text_tokens"]) ||
      (Object.hasOwn(input, "audio_tokens") && !count(input.audio_tokens)) ||
      (Object.hasOwn(input, "text_tokens") && !count(input.text_tokens))) return null;
    details = { ...(Object.hasOwn(input, "audio_tokens") ? { audio_tokens: input.audio_tokens as number } : {}),
      ...(Object.hasOwn(input, "text_tokens") ? { text_tokens: input.text_tokens as number } : {}) };
  }
  return freeze({ type: "tokens", input_tokens: value.input_tokens, output_tokens: value.output_tokens, total_tokens: value.total_tokens,
    ...(details !== undefined ? { input_token_details: details } : {}) });
}
function decoded(value: unknown): PingClipTranscription | null {
  if (!dataRecord(value) || !exactKeys(value, ["text"], ["usage", "languages", "logprobs"]) ||
    !transcriptText(value.text, false) || codePoints(value.text) > 4000 ||
    (Object.hasOwn(value, "logprobs") && !jsonArray(value.logprobs, 0))) return null;
  if (Object.hasOwn(value, "languages") && (!jsonArray(value.languages, 16) || !value.languages.every((language) =>
    dataRecord(language) && exactKeys(language, ["code"]) && typeof language.code === "string" && /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(language.code)))) return null;
  const actual = Object.hasOwn(value, "usage") ? usage(value.usage) : null;
  if (Object.hasOwn(value, "usage") && !actual) return null;
  return freeze({ text: value.text, usage: actual });
}

/** Disconnected completed-byte candidate. Authentication, Finish, capture and account eligibility remain caller-owned. */
export function createPingOpenAiClipTranscriber(options: PingOpenAiClipOptions) {
  if (!dataRecord(options) || !exactKeys(options, ["model", "apiKey", "fetch"], ["deadlineMs"]) ||
    typeof options.model !== "string" || !MODELS.includes(options.model) || typeof options.apiKey !== "string" ||
    !/^[\x21-\x7e]{1,512}$/.test(options.apiKey) || typeof options.fetch !== "function" ||
    (options.deadlineMs !== undefined && (!Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)))
    throw new Error("ping_clip_configuration");
  const { model, apiKey, fetch: fetchClip } = options;
  const deadlineMs = options.deadlineMs ?? 10_000;
  let physicalBusy = false;
  return async (pcm: unknown, signal: AbortSignal): Promise<PingClipTranscription> => {
    if (signal.aborted) throw new Error("ping_clip_cancelled");
    if (physicalBusy) throw new Error("ping_clip_busy");
    const bytes = encodePingCompletedPcmWav(pcm);
    if (!bytes) throw new Error("ping_clip_invalid_pcm");
    physicalBusy = true;
    const deadlineAt = performance.now() + deadlineMs, controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null, cancellation: Promise<void> | null = null;
    let stopped: "cancelled" | "deadline" | null = null;
    let resolvePublic!: (value: PingClipTranscription) => void, rejectPublic!: (reason: Error) => void;
    const result = new Promise<PingClipTranscription>((resolve, reject) => { resolvePublic = resolve; rejectPublic = reject; });
    const cancelReader = () => { if (reader && !cancellation) cancellation = reader.cancel().then(() => undefined, () => undefined); };
    const stop = (reason: "cancelled" | "deadline") => {
      if (stopped) return;
      stopped = reason; rejectPublic(new Error(`ping_clip_${reason}`)); controller.abort(); cancelReader();
    };
    const abort = () => stop("cancelled");
    const expired = () => { if (!stopped && performance.now() >= deadlineAt) stop("deadline"); return stopped !== null; };
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => stop("deadline"), deadlineMs);
    if (signal.aborted) abort();
    void (async () => {
      try {
        if (expired()) return;
        const form = new FormData();
        form.set("file", new Blob([bytes], { type: "audio/wav" }), "ping.wav");
        form.set("model", model); form.set("response_format", "json"); form.set("stream", "false");
        if (expired()) return;
        const response = await fetchClip(PING_CLIP_ENDPOINT, { method: "POST", redirect: "error", cache: "no-store", credentials: "omit",
          headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal, body: form });
        if (response.body) reader = response.body.getReader();
        if (expired()) { cancelReader(); return; }
        if (response.status !== 200 || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !reader)
          throw Error("invalid_response");
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > RESPONSE_BYTES)) throw Error("invalid_response");
        const chunks: Uint8Array[] = []; let size = 0;
        while (!stopped) {
          const next = await reader.read();
          if (expired()) return;
          if (next.done) break;
          size += next.value.byteLength;
          if (size > RESPONSE_BYTES || chunks.length >= 4096) throw Error("invalid_response");
          chunks.push(next.value);
        }
        if (expired()) return;
        const body = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        const value = decoded(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
        if (!value) throw Error("invalid_response");
        if (!expired()) resolvePublic(value);
      } catch {
        if (!stopped) rejectPublic(new Error("ping_clip_invalid_response"));
        cancelReader();
      } finally {
        if (cancellation) await cancellation;
        reader?.releaseLock(); clearTimeout(timer); signal.removeEventListener("abort", abort); physicalBusy = false;
      }
    })();
    return result;
  };
}
