import "server-only";
import { dataRecord, exactKeys, freeze, jsonArray } from "@/lib/ping/input-validation";
import { parsePingVoiceInterpretation, PING_RESPONSES_SCHEMA, type PingResponsesUsageObservation } from "./openai-interpreter";
import type { PingVoiceModelInput } from "@/lib/ping/voice-session";
import type { PingProposal } from "@/lib/ping/proposal";
import { PING_SYNTHETIC_INTERPRETATION_INSTRUCTIONS, projectPingSyntheticModelInput, isPingPublicSyntheticContext } from "./synthetic-interpretation-contract";
import { allowsPingSyntheticInterpretation, type PingSyntheticCorpusAdmission } from "./synthetic-corpus-admission";

export const PING_CLAUDE_MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const PING_CLAUDE_HAIKU_MODEL = "claude-haiku-5-5";
const BODY_BYTES = 65_536;
const MAX_OUTPUT_TOKENS = 1_024;
const PUBLIC_TRANSCRIPT = "Assign this task to me and move it to in progress.";



export type PingClaudeHaikuInterpreterOptions = Readonly<{
  apiKey: string;
  developmentOnly: true;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  deadlineMs?: number;
  corpusAdmission?: PingSyntheticCorpusAdmission;
  onUsage?: (observation: PingResponsesUsageObservation) => unknown;
  onDiagnostic?: (observation: Readonly<{ stage: "fetch" | "http" | "body" | "json" | "proposal" | "complete"; httpStatus: number | null }>) => unknown;
}>;

function claudeCompatibleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(claudeCompatibleSchema);
  if (!dataRecord(value)) return value;
  const unsupported = new Set(["minimum", "maximum", "minLength", "maxLength"]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !unsupported.has(key))
    .map(([key, child]) => [key, claudeCompatibleSchema(child)]));
}

function factoredClaudeSchema(): unknown {
  const original = claudeCompatibleSchema(PING_RESPONSES_SCHEMA) as {
    properties: { proposal: { anyOf: readonly { properties: { operation?: { properties: { effects: unknown } } } }[] } };
  };
  const date = { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] };
  const edit = original.properties.proposal.anyOf[0].properties.operation!.properties.effects;
  const create = original.properties.proposal.anyOf[1].properties.operation!.properties.effects;
  const dateKey = JSON.stringify(date), editKey = JSON.stringify(edit), createKey = JSON.stringify(create);
  const replace = (value: unknown, effects: boolean): unknown => {
    if (Array.isArray(value)) return value.map(child => replace(child, effects));
    if (!dataRecord(value)) return value;
    const key = JSON.stringify(value);
    if (key === dateKey) return { $ref: "#/$defs/date" };
    if (effects && key === editKey) return { $ref: "#/$defs/editEffects" };
    if (effects && key === createKey) return { $ref: "#/$defs/createEffects" };
    return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, replace(child, effects)]));
  };
  return { ...(replace(original, true) as Record<string, unknown>),
    $defs: { date, editEffects: replace(edit, false), createEffects: replace(create, false) } };
}
export const PING_CLAUDE_HAIKU_SCHEMA = freeze(factoredClaudeSchema());


type ParsedUsage = Readonly<{ state: PingResponsesUsageObservation["state"]; usage: PingResponsesUsageObservation["usage"] }>;
const natural = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function usage(value: unknown): ParsedUsage {
  if (value === undefined || value === null) return { state: "absent", usage: null };
  if (!dataRecord(value) || !natural(value.input_tokens) || !natural(value.output_tokens)) return { state: "invalid", usage: null };
  const hasCreate = Object.hasOwn(value, "cache_creation_input_tokens") && value.cache_creation_input_tokens !== null;
  const hasRead = Object.hasOwn(value, "cache_read_input_tokens") && value.cache_read_input_tokens !== null;
  if (!hasCreate || !hasRead) return { state: "unavailable", usage: null };
  if (!natural(value.cache_creation_input_tokens) || !natural(value.cache_read_input_tokens)) return { state: "invalid", usage: null };
  const inputTokens = value.input_tokens + value.cache_creation_input_tokens + value.cache_read_input_tokens;
  const totalTokens = inputTokens + value.output_tokens;
  if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(totalTokens)) return { state: "invalid", usage: null };
  return { state: "observed", usage: freeze({ input_tokens: inputTokens, output_tokens: value.output_tokens, total_tokens: totalTokens,
    input_tokens_details: { cached_tokens: value.cache_read_input_tokens, cache_write_tokens: value.cache_creation_input_tokens } }) };
}

function resultProposal(value: unknown, selectedTaskCount: number): PingProposal | null {
  if (!dataRecord(value) || value.type !== "message" || value.role !== "assistant" || value.stop_reason !== "end_turn" ||
    !jsonArray(value.content, 1) || value.content.length !== 1) return null;
  const block = value.content[0];
  if (!dataRecord(block) || !exactKeys(block, ["type", "text"]) || block.type !== "text" ||
    typeof block.text !== "string" || Buffer.byteLength(block.text, "utf8") > BODY_BYTES) return null;
  const wrapper: unknown = JSON.parse(block.text);
  return dataRecord(wrapper) && exactKeys(wrapper, ["proposal"])
    ? parsePingVoiceInterpretation(wrapper.proposal, selectedTaskCount)
    : null;
}

/** Disconnected fixed-public-input candidate. The caller owns capture, authentication, Finish, and route admission. */
export function createPingClaudeHaikuInterpreter(options: PingClaudeHaikuInterpreterOptions) {
  if ((process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") || process.env.VERCEL !== undefined ||
    !dataRecord(options) || !exactKeys(options, ["apiKey", "developmentOnly", "fetch"], ["deadlineMs", "onUsage", "onDiagnostic", "corpusAdmission"]) ||
    options.developmentOnly !== true || typeof options.apiKey !== "string" || !/^[\x21-\x7e]{1,512}$/.test(options.apiKey) ||
    typeof options.fetch !== "function" ||
    (options.deadlineMs !== undefined && (!Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)) ||
    (options.onUsage !== undefined && typeof options.onUsage !== "function") ||
    (options.onDiagnostic !== undefined && typeof options.onDiagnostic !== "function"))
    throw new Error("ping_claude_interpretation_configuration");

  const { apiKey, fetch: fetchMessages, onUsage, onDiagnostic } = options;
  const deadlineMs = options.deadlineMs ?? 10_000;
  let physicalBusy = false;
  return async (input: unknown, signal: AbortSignal): Promise<PingProposal> => {
    if ((process.env.NODE_ENV!=="development" && process.env.NODE_ENV!=="test") || process.env.VERCEL!==undefined)
      throw Error("ping_claude_interpretation_configuration");
    let captured: PingVoiceModelInput | null;
    try { captured = projectPingSyntheticModelInput(input); } catch { captured = null; }
    if (!captured || (!(captured.transcript===PUBLIC_TRANSCRIPT && isPingPublicSyntheticContext(captured)) &&
      !allowsPingSyntheticInterpretation(options.corpusAdmission,captured))) throw new Error("ping_claude_interpretation_invalid_input");
    if (!(signal instanceof AbortSignal)) throw new Error("ping_claude_interpretation_invalid_input");
    if (signal.aborted) throw new Error("ping_claude_interpretation_cancelled");
    if (physicalBusy) throw new Error("ping_claude_interpretation_busy");
    physicalBusy = true;

    const deadlineAt = performance.now() + deadlineMs;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancellation: Promise<void> | null = null;
    let stopped: "cancelled" | "deadline" | null = null;
    let entered = false, published = false;
    let diagnosticStage: "fetch" | "http" | "body" | "json" | "proposal" | "complete" = "fetch";
    let httpStatus: number | null = null;
    let observed: PingResponsesUsageObservation = freeze({ version: "ping.responses-usage.v1", provenance: "interpretation", state: "unavailable", usage: null });
    let rejectPublic!: (reason: Error) => void;
    let resolvePublic!: (value: PingProposal) => void;
    const result = new Promise<PingProposal>((resolve, reject) => { resolvePublic = resolve; rejectPublic = reject; });
    const publish = (outcome: PingProposal | Error) => {
      if (published) return;
      published = true;
      if (outcome instanceof Error) rejectPublic(outcome); else resolvePublic(outcome);
      if (entered && onUsage) {
        try { void Promise.resolve(onUsage(observed)).catch(() => undefined); } catch { /* Diagnostics cannot authorize or retry work. */ }
      }
      if (entered && onDiagnostic) {
        try { void Promise.resolve(onDiagnostic(freeze({ stage: diagnosticStage, httpStatus }))).catch(() => undefined); } catch { /* Diagnostic only. */ }
      }
    };
    const cancelReader = () => {
      if (reader && !cancellation) cancellation = reader.cancel().then(() => undefined, () => undefined);
    };
    const stop = (reason: "cancelled" | "deadline") => {
      if (stopped) return;
      stopped = reason;
      publish(new Error(`ping_claude_interpretation_${reason}`));
      controller.abort();
      cancelReader();
    };
    const abort = () => stop("cancelled");
    const expired = () => { if (!stopped && performance.now() >= deadlineAt) stop("deadline"); return stopped !== null; };
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => stop("deadline"), deadlineMs);
    if (signal.aborted) abort();

    void (async () => {
      try {
        if (stopped) return;
        const request: RequestInit = { method: "POST", redirect: "error", cache: "no-store", credentials: "omit",
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          signal: controller.signal,
          body: JSON.stringify({ model: PING_CLAUDE_HAIKU_MODEL, max_tokens: MAX_OUTPUT_TOKENS, stream: false,
            thinking: { type: "disabled" }, system: PING_SYNTHETIC_INTERPRETATION_INSTRUCTIONS,
            messages: [{ role: "user", content: JSON.stringify(captured) }],
            output_config: { format: { type: "json_schema", schema: PING_CLAUDE_HAIKU_SCHEMA } } }) };
        if (expired()) return;
        entered = true;
        const response = await fetchMessages(PING_CLAUDE_MESSAGES_ENDPOINT, request);
        diagnosticStage = "http";
        httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
        if (response.body) reader = response.body.getReader();
        if (expired()) { cancelReader(); return; }
        if (response.status !== 200 || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !reader)
          throw new Error("invalid_response");
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > BODY_BYTES)) throw new Error("invalid_response");
        const chunks: Uint8Array[] = [];
        diagnosticStage = "body";
        let bytes = 0;
        while (!stopped) {
          const next = await reader.read();
          if (expired()) return;
          if (next.done) break;
          bytes += next.value.byteLength;
          if (bytes > BODY_BYTES || chunks.length >= 4096) throw new Error("invalid_response");
          chunks.push(next.value);
        }
        if (stopped) return;
        const body = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        diagnosticStage = "json";
        const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
        if (expired()) return;
        if (dataRecord(parsed)) {
          const actual = usage(parsed.usage);
          observed = freeze({ version: "ping.responses-usage.v1", provenance: "interpretation", state: actual.state, usage: actual.usage });
        }
        diagnosticStage = "proposal";
        const proposal = resultProposal(parsed, captured.selectedTaskCount);
        if (!proposal || (JSON.stringify(parsed).includes(apiKey))) throw new Error("invalid_response");
        if (!expired()) { diagnosticStage = "complete"; publish(proposal); }
      } catch {
        if (!expired()) publish(new Error("ping_claude_interpretation_invalid_response"));
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
