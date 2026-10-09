import "server-only";
import { createHash } from "node:crypto";
import { dataRecord, exactKeys, freeze, transcriptText, codePoints } from "@/lib/ping/input-validation";
import { encodePingCompletedPcmWav, type PingClipTranscription, type PingClipUsage } from "./openai-clip-transcription";

export const PING_GEMINI_CLIP_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent";
const BODY_BYTES = 65_536;
const PARTS_MAX = 64;
const TRANSCRIPT_MAX = 4_000;
const APPROVED_PUBLIC_PCM_SHA256 = "1cca7d6955870af3621f0b7298f3d105de1cf1293c3f68c8eb43cec380b3ab77";
const TEST_PCM_SHA256 = "5a5f779a26ff0219a631e0884c473744a35e80cb37966978102641a3ddb007a7";

export type PingGeminiSyntheticClipOptions = Readonly<{
  apiKey: string;
  developmentOnly: true;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  deadlineMs?: number;
}>;

const natural = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function usage(value: unknown): PingClipUsage | null | false {
  if (value === undefined || value === null) return null;
  if (!dataRecord(value) ||
    !natural(value.promptTokenCount) || !natural(value.candidatesTokenCount) || !natural(value.totalTokenCount) ||
    value.promptTokenCount + value.candidatesTokenCount !== value.totalTokenCount) return false;

  let inputDetails: { audio_tokens?: number; text_tokens?: number } | undefined;
  if (Object.hasOwn(value, "promptTokensDetails")) {
    const details = value.promptTokensDetails;
    if (!Array.isArray(details) || details.length > 2) return false;
    inputDetails = {};
    for (const detail of details) {
      if (!dataRecord(detail) || !exactKeys(detail, ["modality", "tokenCount"]) || !natural(detail.tokenCount) ||
        (detail.modality !== "AUDIO" && detail.modality !== "TEXT")) return false;
      const key = detail.modality === "AUDIO" ? "audio_tokens" : "text_tokens";
      if (Object.hasOwn(inputDetails, key)) return false;
      inputDetails[key] = detail.tokenCount;
    }
    const modalityTotal = (inputDetails.audio_tokens ?? 0) + (inputDetails.text_tokens ?? 0);
    if (modalityTotal !== value.promptTokenCount) return false;
  }

  return freeze({ type: "tokens", input_tokens: value.promptTokenCount, output_tokens: value.candidatesTokenCount,
    total_tokens: value.totalTokenCount,
    ...(inputDetails ? { input_token_details: inputDetails } : {}) });
}

function transcript(value: unknown): string | null {
  if (!dataRecord(value) || !Array.isArray(value.candidates) || value.candidates.length !== 1) return null;
  const candidate = value.candidates[0];
  if (!dataRecord(candidate) || candidate.finishReason !== "STOP" || !dataRecord(candidate.content) || candidate.content.role !== "model" ||
    !Array.isArray(candidate.content.parts) || candidate.content.parts.length < 1 || candidate.content.parts.length > PARTS_MAX) return null;
  const parts = candidate.content.parts;
  const texts = parts.flatMap((part) => dataRecord(part) && typeof part.text === "string" ? [part.text] : []);
  let result = texts.join("").trim();
  if (!result) {
    const structured = parts.flatMap((part) => dataRecord(part) && dataRecord(part.audioTranscription) &&
      typeof part.audioTranscription.text === "string" ? [part.audioTranscription.text] : []);
    result = structured.join(" ").trim();
  }
  return transcriptText(result, false) && codePoints(result) <= TRANSCRIPT_MAX ? result : null;
}

/** Single approved synthetic PCM clip only. This is a disconnected development candidate, not a route. */
export function createPingGeminiSyntheticClipTranscriber(options: PingGeminiSyntheticClipOptions) {
  if ((process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") || process.env.VERCEL !== undefined || !dataRecord(options) ||
    !exactKeys(options, ["apiKey", "developmentOnly", "fetch"], ["deadlineMs"]) ||
    options.developmentOnly !== true || typeof options.apiKey !== "string" || !/^[\x21-\x7e]{1,512}$/.test(options.apiKey) ||
    typeof options.fetch !== "function" ||
    (options.deadlineMs !== undefined && (!Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)))
    throw new Error("ping_gemini_clip_configuration");

  const { apiKey, fetch: fetchGemini } = options;
  const deadlineMs = options.deadlineMs ?? 10_000;
  let physicalBusy = false;

  return async (pcm: unknown, signal: AbortSignal): Promise<PingClipTranscription> => {
    if (!(signal instanceof AbortSignal)) throw new Error("ping_gemini_clip_invalid_input");
    if (signal.aborted) throw new Error("ping_gemini_clip_cancelled");
    if (physicalBusy) throw new Error("ping_gemini_clip_busy");
    const wav = encodePingCompletedPcmWav(pcm);
    if (!wav) throw new Error("ping_gemini_clip_invalid_pcm");

    // The encoder returns an owned canonical WAV. Admit only an explicit, exact PCM digest before any network work.
    const actualPcmSha256 = createHash("sha256").update(wav.subarray(44)).digest("hex");
    const admitted = actualPcmSha256 === APPROVED_PUBLIC_PCM_SHA256 ||
      (process.env.NODE_ENV === "test" && actualPcmSha256 === TEST_PCM_SHA256);
    if (!admitted) throw new Error("ping_gemini_clip_not_allowlisted");
    if (signal.aborted) throw new Error("ping_gemini_clip_cancelled");
    physicalBusy = true;

    const deadlineAt = performance.now() + deadlineMs;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancellation: Promise<void> | null = null;
    let stopped: "cancelled" | "deadline" | null = null;
    let resolvePublic!: (value: PingClipTranscription) => void;
    let rejectPublic!: (reason: Error) => void;
    const result = new Promise<PingClipTranscription>((resolve, reject) => { resolvePublic = resolve; rejectPublic = reject; });
    const cancelReader = () => {
      if (reader && !cancellation) cancellation = reader.cancel().then(() => undefined, () => undefined);
    };
    const stop = (reason: "cancelled" | "deadline") => {
      if (stopped) return;
      stopped = reason;
      rejectPublic(new Error(`ping_gemini_clip_${reason}`));
      controller.abort();
      cancelReader();
    };
    const abort = () => stop("cancelled");
    const expired = () => {
      if (!stopped && performance.now() >= deadlineAt) stop("deadline");
      return stopped !== null;
    };
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => stop("deadline"), deadlineMs);
    if (signal.aborted) abort();

    void (async () => {
      try {
        if (expired()) return;
        const requestBody = {
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: Buffer.from(wav).toString("base64") } }] }],
          generationConfig: { audioTranscriptionConfig: { mode: "VERBATIM" } },
        };
        if (expired()) return;
        const response = await fetchGemini(PING_GEMINI_CLIP_ENDPOINT, {
          method: "POST", redirect: "error", cache: "no-store", credentials: "omit",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(requestBody), signal: controller.signal,
        });
        if (response.body) reader = response.body.getReader();
        if (expired()) { cancelReader(); return; }
        if (response.status !== 200 || response.redirected ||
          !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !reader) {
          throw new Error("invalid_response");
        }
        const contentLength = response.headers.get("content-length");
        if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > BODY_BYTES)) throw new Error("invalid_response");
        const chunks: Uint8Array[] = [];
        let byteLength = 0;
        while (!stopped) {
          const next = await reader.read();
          if (expired()) return;
          if (next.done) break;
          byteLength += next.value.byteLength;
          if (byteLength > BODY_BYTES || chunks.length >= 4096) throw new Error("invalid_response");
          chunks.push(next.value);
        }
        if (expired()) return;
        const body = new Uint8Array(byteLength);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
        if (expired()) return;
        const text = transcript(payload);
        if (!text || text.includes(apiKey)) throw new Error("invalid_response");
        const parsedUsage = dataRecord(payload) ? usage(payload.usageMetadata) : null;
        if (parsedUsage === false) throw new Error("invalid_response");
        if (!expired()) resolvePublic(freeze({ text, usage: parsedUsage }));
      } catch {
        if (!stopped) rejectPublic(new Error("ping_gemini_clip_invalid_response"));
        cancelReader();
      } finally {
        if (cancellation) await cancellation;
        reader?.releaseLock();
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        physicalBusy = false;
      }
    })();
    return result;
  };
}
