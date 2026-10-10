import "server-only";
import { allowsPingSyntheticPcm, type PingSyntheticCorpusAdmission } from "./synthetic-corpus-admission";
import { createHash } from "node:crypto";
import { dataRecord, exactKeys, freeze, jsonArray } from "@/lib/ping/input-validation";
import { encodePingCompletedPcmWav } from "./openai-clip-transcription";
import { parsePingVoiceInterpretation, PING_RESPONSES_SCHEMA } from "./openai-interpreter";
import { PING_SYNTHETIC_INTERPRETATION_INSTRUCTIONS, projectPingSyntheticContext, isPingPublicSyntheticContext } from "./synthetic-interpretation-contract";
import type { PingNativeAudioResult, PingNativeAudioUsage } from "./openai-native-audio";

export const PING_GEMINI_NATIVE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";
const BODY_BYTES = 65_536;

const APPROVED_PUBLIC_PCM_SHA256 = "1cca7d6955870af3621f0b7298f3d105de1cf1293c3f68c8eb43cec380b3ab77";
const TEST_PCM_SHA256 = "5a5f779a26ff0219a631e0884c473744a35e80cb37966978102641a3ddb007a7";

export type PingGeminiSyntheticNativeOptions = Readonly<{
  apiKey: string;
  developmentOnly: true;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  corpusAdmission?: PingSyntheticCorpusAdmission;
  deadlineMs?: number;
}>;

const natural = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function usage(value: unknown): PingNativeAudioUsage | null {
  if (!dataRecord(value) || !natural(value.promptTokenCount) || !natural(value.candidatesTokenCount) ||
    !natural(value.totalTokenCount)) return null;
  const thoughts = value.thoughtsTokenCount ?? 0;
  if (!natural(thoughts)) return null;
  const output = value.candidatesTokenCount + thoughts;
  if (!natural(output) || !natural(value.promptTokenCount + output) || value.promptTokenCount + output !== value.totalTokenCount) return null;
  const cached = value.cachedContentTokenCount;
  if (cached !== undefined && (!natural(cached) || cached > value.promptTokenCount)) return null;
  return freeze({ prompt_tokens: value.promptTokenCount, completion_tokens: output, total_tokens: value.totalTokenCount,
    ...(cached !== undefined ? { prompt_tokens_details: { cached_tokens: cached } } : {}),
    ...(value.thoughtsTokenCount !== undefined ? { completion_tokens_details: { reasoning_tokens: thoughts } } : {}) });
}
function proposal(value: unknown, selectedTaskCount: number) {
  if (!dataRecord(value) || !jsonArray(value.candidates, 1) || value.candidates.length !== 1) return null;
  const c = value.candidates[0];
  if (!dataRecord(c) || c.finishReason !== "STOP" || !dataRecord(c.content) || c.content.role !== "model" ||
    !jsonArray(c.content.parts, 1) || c.content.parts.length !== 1) return null;
  const part = c.content.parts[0];
  if (!dataRecord(part) || !exactKeys(part, ["text"], ["thought", "thoughtSignature"]) ||
    typeof part.text !== "string" || (part.thought !== undefined && part.thought !== false) ||
    (part.thoughtSignature !== undefined && (typeof part.thoughtSignature !== "string" || part.thoughtSignature.length > 8192))) return null;
  const wrapper: unknown = JSON.parse(part.text);
  return dataRecord(wrapper) && exactKeys(wrapper, ["proposal"]) ? parsePingVoiceInterpretation(wrapper.proposal, selectedTaskCount) : null;
}


/** Disconnected synthetic completed-clip native candidate. No transcription intermediary or task execution.
 * Protocol reviewed 2026-10-10: ai.google.dev/gemini-api/docs/generate-content/{audio,structured-output};
 * ai.google.dev/gemini-api/docs/thinking; ai.google.dev/api/generate-content.
 * Thinking configuration is omitted (provider default); thoughts never become proposal text. */
export function createPingGeminiSyntheticNativeInterpreter(options: PingGeminiSyntheticNativeOptions) {
  if ((process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") || process.env.VERCEL !== undefined || !dataRecord(options) ||
    !exactKeys(options, ["apiKey", "developmentOnly", "fetch"], ["deadlineMs", "corpusAdmission"]) ||
    options.developmentOnly !== true || typeof options.apiKey !== "string" || !/^[\x21-\x7e]{1,512}$/.test(options.apiKey) ||
    typeof options.fetch !== "function" ||
    (options.deadlineMs !== undefined && (!Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)))
    throw new Error("ping_gemini_native_configuration");

  const { apiKey, fetch: fetchGemini } = options;
  const deadlineMs = options.deadlineMs ?? 10_000;
  let physicalBusy = false;

  return async (pcm: unknown, context: unknown, signal: AbortSignal): Promise<PingNativeAudioResult> => {
    if ((process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") || process.env.VERCEL !== undefined)
      throw new Error("ping_gemini_native_configuration");
    const actualContext=projectPingSyntheticContext(context);
    if (!actualContext || !(signal instanceof AbortSignal)) throw new Error("ping_gemini_native_invalid_input");
    if (signal.aborted) throw new Error("ping_gemini_native_cancelled");
    if (physicalBusy) throw new Error("ping_gemini_native_busy");
    const wav = encodePingCompletedPcmWav(pcm);
    if (!wav) throw new Error("ping_gemini_native_invalid_pcm");

    // The encoder returns an owned canonical WAV. Admit only an explicit, exact PCM digest before any network work.
    const actualPcmSha256 = createHash("sha256").update(wav.subarray(44)).digest("hex");
    const admitted = (isPingPublicSyntheticContext(actualContext) && (actualPcmSha256 === APPROVED_PUBLIC_PCM_SHA256 ||
      (process.env.NODE_ENV === "test" && actualPcmSha256 === TEST_PCM_SHA256))) ||
      allowsPingSyntheticPcm(options.corpusAdmission,wav.subarray(44),actualContext);
    if (!admitted) throw new Error("ping_gemini_native_not_allowlisted");
    if (signal.aborted) throw new Error("ping_gemini_native_cancelled");
    physicalBusy = true;

    const deadlineAt = performance.now() + deadlineMs;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancellation: Promise<void> | null = null;
    let cancellationFailed = false;
    let stopped: "cancelled" | "deadline" | null = null;
    let resolvePublic!: (value: PingNativeAudioResult) => void;
    let rejectPublic!: (reason: Error) => void;
    const result = new Promise<PingNativeAudioResult>((resolve, reject) => { resolvePublic = resolve; rejectPublic = reject; });
    const cancelReader = () => {
      if (reader && !cancellation) cancellation = reader.cancel().then(() => undefined, () => { cancellationFailed = true; });
    };
    const stop = (reason: "cancelled" | "deadline") => {
      if (stopped) return;
      stopped = reason;
      rejectPublic(new Error(`ping_gemini_native_${reason}`));
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
          systemInstruction: { parts: [{ text: PING_SYNTHETIC_INTERPRETATION_INSTRUCTIONS }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(actualContext) }, { inlineData: { mimeType: "audio/wav", data: Buffer.from(wav).toString("base64") } }] }],
          generationConfig: { maxOutputTokens: 1024, responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: PING_RESPONSES_SCHEMA } } },
        };
        if (expired()) return;
        const response = await fetchGemini(PING_GEMINI_NATIVE_ENDPOINT, {
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
        const parsedProposal = proposal(payload,actualContext.selectedTaskCount);
        if (!parsedProposal || JSON.stringify(payload).includes(apiKey)) throw new Error("invalid_response");
        const parsedUsage = dataRecord(payload) ? usage(payload.usageMetadata) : null;
        if (!expired()) resolvePublic(freeze({ proposal: parsedProposal, usage: parsedUsage }));
      } catch {
        if (!stopped) rejectPublic(new Error("ping_gemini_native_invalid_response"));
        cancelReader();
      } finally {
        if (cancellation) await cancellation;
        reader?.releaseLock();
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (!cancellationFailed) physicalBusy = false;
      }
    })();
    return result;
  };
}
