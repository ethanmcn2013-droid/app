import type { Task } from "@/lib/data";
import type { PingVoiceSession, PingVoiceSnapshot } from "./voice-session";
import { encodePingPcm, PING_PCM_MAX_SAMPLES } from "./pcm";
import {
  PING_VOICE_AUDIO_ENDPOINT, PING_VOICE_ENDPOINT, PING_VOICE_MAX_FRAME_BYTES,
  PING_VOICE_MAX_FRAMES, PING_VOICE_VERSION, type PingVoiceBegin, type PingVoiceIdentity,
  type PingVoiceRequest, type PingVoiceResponse,
} from "./voice-contract";
import type { PingTypedSnapshot } from "./typed-contract";

const ERROR_CODES = new Set(["unauthenticated", "unavailable", "invalid_input", "unsupported", "ambiguous", "incomplete", "stale_capture", "request_conflict", "busy", "temporarily_unavailable"]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}

function validReceipt(value: unknown, commandId: string, projectId: string): boolean {
  if (!record(value) || !exact(value, ["version", "commandId", "projectId", "committedAtSeconds", "outcome", "affectedCount", "changedCount", "effects"]) ||
    value.version !== "ping.receipt.v1" || value.commandId !== commandId || value.projectId !== projectId ||
    !Number.isSafeInteger(value.committedAtSeconds) || Number(value.committedAtSeconds) < 0 ||
    (value.outcome !== "completed" && value.outcome !== "no_changes") || !Number.isSafeInteger(value.affectedCount) ||
    !Number.isSafeInteger(value.changedCount) || !Array.isArray(value.effects) || value.effects.length !== value.affectedCount ||
    Number(value.affectedCount) < 0 || Number(value.affectedCount) > 10 || Number(value.changedCount) < 0 || Number(value.changedCount) > Number(value.affectedCount)) return false;
  let changed = 0;
  const ids = new Set<string>();
  for (const effect of value.effects) {
    if (!record(effect) || !exact(effect, ["taskId", "changedFields"], ["seq"]) || typeof effect.taskId !== "string" ||
      !effect.taskId || ids.has(effect.taskId) || !Array.isArray(effect.changedFields) ||
      !effect.changedFields.every((field) => ["created", "assignees", "due", "dueAt", "startDay", "durationDays", "lane", "boardColumnKey", "completedAt"].includes(String(field))) ||
      new Set(effect.changedFields).size !== effect.changedFields.length ||
      effect.seq !== undefined && (!Number.isSafeInteger(effect.seq) || Number(effect.seq) < 1) ||
      effect.changedFields.includes("created") && effect.seq === undefined) return false;
    ids.add(effect.taskId);
    if (effect.changedFields.length) changed++;
  }
  return changed === value.changedCount && (value.outcome === "no_changes" ? value.changedCount === 0 : value.changedCount > 0);
}

/** Exact bounded decoder for the frozen voice control response. Unknown shapes stay unknown. */
export function decodePingVoiceResponse(value: unknown): PingVoiceResponse | null {
  if (!record(value)) return null;
  if (value.ok === false) return exact(value, ["ok", "code"]) && typeof value.code === "string" && ERROR_CODES.has(value.code)
    ? value as PingVoiceResponse : null;
  if (value.ok !== true || typeof value.action !== "string" || typeof value.generationId !== "string" ||
    typeof value.commandId !== "string" || typeof value.projectId !== "string") return null;
  if (value.action === "begin") return exact(value, ["ok", "action", "generationId", "commandId", "projectId", "token", "connectionEpoch", "captureExpiresAt"]) &&
    typeof value.token === "string" && value.token.length > 0 && typeof value.connectionEpoch === "string" && value.connectionEpoch.length > 0 &&
    Number.isFinite(value.captureExpiresAt) ? value as PingVoiceResponse : null;
  if (value.action === "audio") return exact(value, ["ok", "action", "generationId", "commandId", "projectId", "acceptedThrough", "totalSamples"]) &&
    Number.isSafeInteger(value.acceptedThrough) && Number(value.acceptedThrough) >= 1 && Number(value.acceptedThrough) <= PING_VOICE_MAX_FRAMES &&
    Number.isSafeInteger(value.totalSamples) && Number(value.totalSamples) > 0 && Number(value.totalSamples) <= PING_PCM_MAX_SAMPLES ? value as PingVoiceResponse : null;
  if (value.action !== "finish" && value.action !== "status" && value.action !== "cancel") return null;
  if (value.knowledge === "committed") return exact(value, ["ok", "action", "generationId", "commandId", "projectId", "knowledge", "receipt"]) &&
    validReceipt(value.receipt, value.commandId, value.projectId) ? value as PingVoiceResponse : null;
  if (value.knowledge === "unresolved") return exact(value, ["ok", "action", "generationId", "commandId", "projectId", "knowledge", "detail"]) &&
    ["pending", "absent", "failed"].includes(String(value.detail)) ? value as PingVoiceResponse : null;
  if (value.knowledge === "not_invoked") return exact(value, ["ok", "action", "generationId", "commandId", "projectId", "knowledge"], ["code"]) &&
    (value.code === undefined || typeof value.code === "string" && ERROR_CODES.has(value.code)) ? value as PingVoiceResponse : null;
  if ((value.action === "finish" || value.action === "status") && value.state === "pending" &&
    exact(value, ["ok", "action", "generationId", "commandId", "projectId", "state", "snapshot"]) && record(value.snapshot)) return value as PingVoiceResponse;
  return null;
}

export type PingVoiceSendResult = Readonly<{ kind: "response"; response: PingVoiceResponse }> | Readonly<{ kind: "unknown" }>;

/** Same-origin private control POST. No actor/session identity is serialized by the client. */
export async function sendPingVoice(request: PingVoiceRequest, fetcher: typeof fetch = fetch): Promise<PingVoiceSendResult> {
  try {
    const response = await fetcher(PING_VOICE_ENDPOINT, { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(request) });
    const decoded = decodePingVoiceResponse(await response.json());
    return decoded ? { kind: "response", response: decoded } : { kind: "unknown" };
  } catch { return { kind: "unknown" }; }
}

export function makePingVoiceBegin(projectId: string, selectedTaskIds: readonly string[], snapshots: Readonly<Record<string, PingTypedSnapshot>>, requestId: string): PingVoiceBegin {
  return Object.freeze({ version: PING_VOICE_VERSION, action: "begin", requestId, projectId,
    selectedTaskIds: Object.freeze([...selectedTaskIds]), snapshots: Object.freeze({ ...snapshots }) });
}

export function pingVoiceIdentityMatches(response: PingVoiceResponse, identity: PingVoiceIdentity): boolean {
  return response.ok && response.generationId === identity.generationId && response.commandId === identity.commandId && response.projectId === identity.projectId;
}

/** Canonical Start witnesses; only ordinary selected top-level tasks are admitted by the panel. */
export function pingVoiceTaskSnapshot(task: Task): PingTypedSnapshot {
  const seconds = (value: Date | null | undefined) => value instanceof Date ? Math.floor(value.getTime() / 1000) : null;
  return Object.freeze({ assignees: Object.freeze([...(task.assignees ?? [])]), due: task.due ?? null,
    dueAtSeconds: seconds(task.dueAt), startDay: task.startDay ?? null, durationDays: task.durationDays ?? null,
    lane: task.lane as PingTypedSnapshot["lane"], boardColumnKey: null, completedAtSeconds: seconds(task.completedAt) });
}

export type PingVoiceFacade = Readonly<{ session: PingVoiceSession; cancelServer: () => Promise<PingVoiceSendResult> }>;

/** Synchronous native-hook facade: encodes once, uploads exact ordered PCM, then latches one Finish. */
export function createPingVoiceFacade(options: Readonly<{
  identity: PingVoiceIdentity & Readonly<{ token: string; connectionEpoch: string }>;
  onFinish: (result: PingVoiceSendResult) => void;
  fetcher?: typeof fetch;
  onSnapshot?: (snapshot: PingVoiceSnapshot) => void;
}>): PingVoiceFacade {
  const fetcher = options.fetcher ?? fetch;
  let phase: PingVoiceSnapshot["phase"] = "capturing";
  let reason: string | null = null;
  let frames = 0, samples = 0, uploadedBytes = 0;
  let finishRequested = false, cutSeen = false, closed = false, pumping = false;
  const queue: { ordinal: number; bytes: Uint8Array; samples: number }[] = [];
  let chain = Promise.resolve();
  const counters = { appendCalls: 0, appendAccepted: 0, appendedBytes: 0, commitCalls: 0, commitAccepted: 0, interpretationCalls: 0, interpretationDescriptors: 0 };
  const snapshot = (): PingVoiceSnapshot => Object.freeze({ phase, reason, throughFrame: frames, totalSamples: samples, encodedBytes: uploadedBytes, counters: Object.freeze({ ...counters }) });
  const notify = () => { try { options.onSnapshot?.(snapshot()); } catch { /* UI callbacks cannot retry a command. */ } };
  const stop = (why: string) => { if (closed) return; closed = true; phase = "closed"; reason = why; queue.length = 0; notify(); };
  const upload = async (item: { ordinal: number; bytes: Uint8Array; samples: number }) => {
    const headers = { "content-type": "application/octet-stream", "x-ping-version": PING_VOICE_VERSION,
      "x-ping-generation": options.identity.generationId, "x-ping-token": options.identity.token, "x-ping-frame": String(item.ordinal) };
    counters.appendCalls++;
    let raw: Response;
    try { raw = await fetcher(PING_VOICE_AUDIO_ENDPOINT, { method: "POST", credentials: "same-origin", cache: "no-store", headers, body: item.bytes.slice().buffer as ArrayBuffer }); }
    catch { stop("audio_upload_unknown"); throw new Error("audio_upload_unknown"); }
    const decoded = decodePingVoiceResponse(await raw.json().catch(() => null));
    if (!decoded || !decoded.ok || decoded.action !== "audio" || !pingVoiceIdentityMatches(decoded, options.identity) ||
      decoded.acceptedThrough !== item.ordinal || decoded.totalSamples !== item.samples) { stop("audio_upload_unconfirmed"); throw new Error("audio_upload_unconfirmed"); }
    counters.appendAccepted++; counters.appendedBytes += item.bytes.length; uploadedBytes += item.bytes.length; notify();
  };
  const pump = async () => {
    if (pumping || closed) return;
    pumping = true;
    try {
      while (queue.length && !closed) await upload(queue.shift()!);
      if (finishRequested && cutSeen && !closed && queue.length === 0) {
        if (uploadedBytes !== samples * 2 || counters.appendAccepted !== frames) { stop("audio_coverage_mismatch"); return; }
        phase = "awaiting_finals"; notify();
        if (closed) return;
        const request = { version: PING_VOICE_VERSION, action: "finish", generationId: options.identity.generationId,
          token: options.identity.token, throughFrame: frames, totalSamples: samples } as const;
        counters.commitCalls++;
        const sent = await sendPingVoice(request, fetcher);
        if (sent.kind === "response" && sent.response.ok && sent.response.action === "finish" && pingVoiceIdentityMatches(sent.response, options.identity)) {
          counters.commitAccepted++;
        }
        phase = "closed"; closed = true; reason = sent.kind === "unknown" ? "finish_unknown" : null; notify();
        options.onFinish(sent);
      }
    } catch { if (!closed) stop("transport_failed"); }
    finally { pumping = false; }
  };
  const session: PingVoiceSession = Object.freeze({
    acceptFrame(value) {
      if (closed || cutSeen || !value || typeof value !== "object") { stop("invalid_frame"); return; }
      const frame = value as { type?: unknown; generationId?: unknown; connectionEpoch?: unknown; ordinal?: unknown; sampleRate?: unknown; channels?: unknown; sampleCount?: unknown; samples?: unknown };
      if (frame.type !== "frame" || frame.generationId !== options.identity.generationId || frame.connectionEpoch !== options.identity.connectionEpoch ||
        frame.ordinal !== frames + 1 || frame.sampleRate !== 24000 || frame.channels !== 1 || !Number.isSafeInteger(frame.sampleCount) ||
        Number(frame.sampleCount) < 1 || Number(frame.sampleCount) > 4800 || !(frame.samples instanceof ArrayBuffer) ||
        frame.samples.byteLength !== Number(frame.sampleCount) * 4 || frame.samples.byteLength > 19200 ||
        samples + Number(frame.sampleCount) > PING_PCM_MAX_SAMPLES || frames >= PING_VOICE_MAX_FRAMES || queue.length >= 8) { stop("invalid_frame"); return; }
      const encoded = encodePingPcm(new Float32Array(frame.samples.slice(0)));
      if (!encoded.ok || encoded.samples !== frame.sampleCount || encoded.bytes.length > PING_VOICE_MAX_FRAME_BYTES) { stop("invalid_frame"); return; }
      frames++; samples += encoded.samples; queue.push({ ordinal: frames, bytes: encoded.bytes, samples });
      phase = finishRequested ? "finishing" : "capturing"; notify();
      chain = chain.then(pump, pump);
    },
    requestFinish() {
      if (closed || finishRequested || phase !== "capturing") return false;
      finishRequested = true; phase = "finishing"; notify(); return true;
    },
    acceptCut(value) {
      if (closed || !finishRequested || cutSeen || !value || typeof value !== "object") { stop("invalid_cut"); return; }
      const cut = value as { type?: unknown; generationId?: unknown; connectionEpoch?: unknown; throughFrame?: unknown; totalSamples?: unknown };
      if (cut.type !== "cut" || cut.generationId !== options.identity.generationId || cut.connectionEpoch !== options.identity.connectionEpoch ||
        cut.throughFrame !== frames || cut.totalSamples !== samples || !frames || !samples) { stop("invalid_cut"); return; }
      cutSeen = true; chain = chain.then(pump, pump);
    },
    cancel(why = "cancelled") { if (closed) return; stop(why); },
    tick() { if (!closed) notify(); },
    dispose() { stop("disposed"); },
    getSnapshot: snapshot,
    getCaptureTag: () => closed ? null : Object.freeze({ generationId: options.identity.generationId, connectionEpoch: options.identity.connectionEpoch }),
    getProposal: () => null,
  });
  notify();
  const cancelServer = () => sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: options.identity.generationId, token: options.identity.token }, fetcher);
  return Object.freeze({ session, cancelServer });
}
