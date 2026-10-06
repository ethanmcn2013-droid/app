import "server-only";
import { evaluatePingWholePlan, type PingEvaluationObservation, type PingWholePlanEvaluation } from "@/lib/ping/evaluation";
import { bindPingProposal, normalizePingCapture, type PingCapture, type PingProposal } from "@/lib/ping/proposal";
import { codePoints, dataRecord, exactKeys, freeze, jsonArray, transcriptText } from "@/lib/ping/input-validation";
import { PING_PCM_MAX_SAMPLES } from "@/lib/ping/pcm";
import type { PingVoiceModelInput } from "@/lib/ping/voice-session";
import type { PingClipTranscription, PingClipUsage } from "@/server/ping/openai-clip-transcription";
import { parsePingNativeAudioUsage, type PingNativeAudioContext, type PingNativeAudioResult,
  type PingNativeAudioUsage } from "@/server/ping/openai-native-audio";
import { parsePingVoiceInterpretation } from "@/server/ping/openai-interpreter";

type PingClipPairedRoute = Readonly<{ id: string;
  transcribe: (pcm: Uint8Array<ArrayBuffer>, signal: AbortSignal) => Promise<PingClipTranscription>;
  interpret: (input: PingVoiceModelInput, signal: AbortSignal) => Promise<unknown> }>;
export type PingNativePairedRoute = Readonly<{ id: string; kind: "native_audio";
  interpretAudio: (pcm: Uint8Array<ArrayBuffer>, context: PingNativeAudioContext, signal: AbortSignal) => Promise<PingNativeAudioResult> }>;
export type PingPairedRoute = PingClipPairedRoute | PingNativePairedRoute;
export type PingPairedTrial = Readonly<{ pcm: unknown; capture: unknown; label: unknown;
  routes: readonly [PingPairedRoute, PingPairedRoute]; signal: AbortSignal; deadlineMs?: number }>;
export type PingPrivateRouteReport = Readonly<{ routeId: string;
  status: "not_started" | "completed" | "failed" | "cancelled" | "deadline";
  transcribeCalls: number; interpretationCalls: number;
  transcriptionUsage: PingClipUsage | null; interpretationUsage: null;
  nativeAudioUsage?: PingNativeAudioUsage | null;
  observation: PingEvaluationObservation; evaluation: PingWholePlanEvaluation | null }>;
/** PRIVATE: expected/actual outcomes and matches are label-derived, even without raw labels.
 * Reserved-case reports belong solely to the authorized label custodian, never authors/root.
 * Public synthetic fixtures may inspect their own literal results. No logging/automatic export. */
export type PingPrivatePairedReport = Readonly<{ routes: readonly PingPrivateRouteReport[] }>;

const emptyObservation = (): PingEvaluationObservation => ({ interpretationCalls: 0, executorCalls: 0,
  receiptReadsLifetime: 0, receiptReadWindows: [], observedCommittedEffects: 0, knowledge: "not_dispatched",
  timingSource: "measured", stages: [] });
const count = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
function copiedUsage(value: unknown): PingClipUsage | null {
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
    ...(details ? { input_token_details: details } : {}) });
}
function copyPcm(pcm: unknown): Uint8Array<ArrayBuffer> | null {
  try {
    if (!pcm || Object.getPrototypeOf(pcm) !== Uint8Array.prototype) return null;
    const native = Object.getPrototypeOf(Uint8Array.prototype);
    if (Object.getOwnPropertyDescriptor(native, Symbol.toStringTag)!.get!.call(pcm) !== "Uint8Array") return null;
    const buffer = Object.getOwnPropertyDescriptor(native, "buffer")!.get!.call(pcm);
    if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return null;
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(buffer);
    const length = Object.getOwnPropertyDescriptor(native, "length")!.get!.call(pcm) as number;
    if (!length || length % 2 || length > PING_PCM_MAX_SAMPLES * 2) return null;
    const copy = new Uint8Array(length); Uint8Array.prototype.set.call(copy, pcm as Uint8Array); return copy;
  } catch { return null; }
}
function copiedLabel(value: unknown, capture: PingCapture) {
  const check = evaluatePingWholePlan(value, undefined, capture, emptyObservation());
  if (!check.ok || !dataRecord(value)) return null;
  const bound = bindPingProposal(value.expected, capture,
    { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
  const expected: PingProposal = bound.ok ? bound.proposal : (() => {
    const refusal = value.expected as Extract<PingProposal, { outcome: "refusal" | "clarification" }>;
    return { version: "ping.proposal.v1", outcome: refusal.outcome, reason: refusal.reason };
  })();
  return freeze({ id: value.id as string, source: value.source as "independent_fixture" | "independent_human", expected });
}

/** Manually invoked inert comparison only. No default route, credentials, I/O, executor or receipt reader.
 * Zero executor/read fields describe this runner's absent seams, not arbitrary callback side effects.
 * Busy lasts through callback promise settlement; callbacks must own their transport reservations. */
export function createPingPairedInertTrialRunner() {
  let busy = false;
  return async (options: PingPairedTrial): Promise<PingPrivatePairedReport> => {
    if (busy) throw new Error("ping_trial_busy");
    if (!dataRecord(options) || !exactKeys(options, ["pcm", "capture", "label", "routes", "signal"], ["deadlineMs"]) ||
      !(options.signal instanceof AbortSignal) || !jsonArray(options.routes, 2) || options.routes.length !== 2 ||
      (options.deadlineMs !== undefined && (!Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)))
      throw new Error("ping_trial_invalid_input");
    const master = copyPcm(options.pcm), capture = normalizePingCapture(options.capture);
    const label = capture && copiedLabel(options.label, capture);
    const routes: PingPairedRoute[] = options.routes.map((route: unknown) => {
      if (!dataRecord(route) || typeof route.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(route.id))
        throw Error("ping_trial_invalid_input");
      if (Object.hasOwn(route, "kind")) {
        if (!exactKeys(route, ["id", "kind", "interpretAudio"]) || route.kind !== "native_audio" ||
          typeof route.interpretAudio !== "function") throw Error("ping_trial_invalid_input");
        return { id: route.id, kind: "native_audio", interpretAudio: route.interpretAudio as PingNativePairedRoute["interpretAudio"] };
      }
      if (!exactKeys(route, ["id", "transcribe", "interpret"]) ||
        typeof route.transcribe !== "function" || typeof route.interpret !== "function") throw Error("ping_trial_invalid_input");
      return { id: route.id, transcribe: route.transcribe as PingClipPairedRoute["transcribe"],
        interpret: route.interpret as PingClipPairedRoute["interpret"] };
    });
    if (!master || !capture || !label || routes[0].id === routes[1].id) throw new Error("ping_trial_invalid_input");
    const signal = options.signal, budget = options.deadlineMs ?? 10_000;
    const reports = routes.map(route => ({ routeId: route.id, status: "not_started" as PingPrivateRouteReport["status"],
      transcribeCalls: 0, interpretationCalls: 0, transcriptionUsage: null as PingClipUsage | null,
      ...("kind" in route ? { nativeAudioUsage: null as PingNativeAudioUsage | null } : {}),
      interpretationUsage: null, observation: emptyObservation(), evaluation: null as PingWholePlanEvaluation | null }));
    const snapshot = () => freeze({ routes: reports.map(report => ({ ...report,
      observation: { ...report.observation, stages: report.observation.stages.map(stage => ({ ...stage })) } })) });
    if (signal.aborted) return snapshot();
    // Unknown JSON-shaped proxies can reenter while their fields are validated/copied.
    if (busy) throw new Error("ping_trial_busy");
    busy = true;
    const started = performance.now();
    let current = 0, stopped = false, controller = new AbortController(), timer: ReturnType<typeof setTimeout> | undefined;
    let deadlineAt = 0, resolvePublic!: (value: PingPrivatePairedReport) => void;
    const result = new Promise<PingPrivatePairedReport>(resolve => { resolvePublic = resolve; });
    const stop = (status: "failed" | "cancelled" | "deadline") => {
      if (stopped) return;
      stopped = true; reports[current].status = status;
      // Publish immutable observations before an injected abort listener can reenter.
      resolvePublic(snapshot()); controller.abort();
    };
    const abort = () => stop("cancelled");
    const guard = () => { if (!stopped && performance.now() >= deadlineAt) stop("deadline"); return !stopped; };
    const stage = (name: "finals_ready" | "interpretation_start" | "interpretation_end") => {
      reports[current].observation = { ...reports[current].observation,
        stages: [...reports[current].observation.stages, { name, atMs: Math.floor(performance.now() - started) }] };
    };
    signal.addEventListener("abort", abort, { once: true });
    void (async () => {
      try {
        for (current = 0; current < routes.length; current++) {
          controller = new AbortController(); deadlineAt = performance.now() + budget;
          timer = setTimeout(() => stop("deadline"), budget);
          if (signal.aborted) abort();
          if (!guard()) return;
          const pcm = new Uint8Array(master.length); Uint8Array.prototype.set.call(pcm, master);
          if (!guard()) return;
          const route = routes[current];
          let actual: unknown;
          if ("kind" in route) {
            const context: PingNativeAudioContext = freeze({ selectedTaskCount: capture.selectedTaskIds.length,
              referenceInstant: capture.referenceInstant, timeZone: capture.timeZone,
              systemColumnKeys: ["todo", "doing", "review", "done"] });
            const atMs = Math.floor(performance.now() - started);
            if (!guard()) return;
            reports[current].interpretationCalls++;
            reports[current].observation = { ...reports[current].observation, interpretationCalls: 1,
              stages: [...reports[current].observation.stages, { name: "interpretation_start", atMs }] };
            const result: unknown = await route.interpretAudio(pcm, context, controller.signal);
            if (!guard()) return;
            if (!dataRecord(result) || !exactKeys(result, ["proposal", "usage"]) || result.usage === undefined)
              throw Error("invalid_output");
            const usage = parsePingNativeAudioUsage(result.usage);
            const proposal = parsePingVoiceInterpretation(result.proposal, capture.selectedTaskIds.length);
            if (usage === false || !proposal) throw Error("invalid_output");
            if (!guard()) return;
            reports[current].nativeAudioUsage = usage; actual = proposal;
          } else {
            reports[current].transcribeCalls++;
            const transcription: unknown = await route.transcribe(pcm, controller.signal);
            if (!guard()) return;
            if (!dataRecord(transcription) || !exactKeys(transcription, ["text", "usage"]) ||
              !transcriptText(transcription.text, false) || codePoints(transcription.text) > 4000) throw Error("invalid_output");
            const usage = transcription.usage === null ? null : copiedUsage(transcription.usage);
            if (transcription.usage !== null && !usage) throw Error("invalid_output");
            reports[current].transcriptionUsage = usage; stage("finals_ready");
            const input: PingVoiceModelInput = freeze({ version: "ping.interpretation.v1", transcript: transcription.text,
              selectedTaskCount: capture.selectedTaskIds.length, referenceInstant: capture.referenceInstant,
              timeZone: capture.timeZone, systemColumnKeys: ["todo", "doing", "review", "done"] });
            if (!guard()) return;
            reports[current].interpretationCalls++;
            reports[current].observation = { ...reports[current].observation, interpretationCalls: 1 };
            stage("interpretation_start");
            actual = await route.interpret(input, controller.signal);
          }
          if (!guard()) return;
          stage("interpretation_end");
          reports[current].evaluation = evaluatePingWholePlan(label, actual, capture, reports[current].observation);
          if (!guard()) return;
          reports[current].status = "completed";
          clearTimeout(timer); timer = undefined;
        }
        stopped = true; resolvePublic(snapshot());
      } catch { if (!stopped) stop("failed"); }
      finally { clearTimeout(timer); signal.removeEventListener("abort", abort); busy = false; }
    })();
    return result;
  };
}
