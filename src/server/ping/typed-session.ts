import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Task } from "@/lib/data";
import { normalizePingCommandId, pingProofDueAtSeconds, validPingId, type PingCommand } from "@/lib/ping/command";
import { dataRecord, exactKeys, jsonArray } from "@/lib/ping/input-validation";
import { bindPingProposal, normalizePingCapture, type PingCapture } from "@/lib/ping/proposal";
import { parsePingTypedCommand } from "@/lib/ping/typed-command";
import { PING_VOICE_VERSION, PING_VOICE_MAX_FRAMES, type PingVoiceResponse, type PingVoiceProviders } from "@/lib/ping/voice-contract";
import { createPingVoiceSession, type PingVoicePcmSession } from "@/lib/ping/voice-session";
import { encodePingPcmAppend } from "@/lib/ping/realtime-transcription";
import { PING_TYPED_VERSION, type PingTypedPrepare, type PingTypedReceipt, type PingTypedRequest,
  type PingTypedResponse, type PingTypedSnapshot, type PingTypedTask } from "@/lib/ping/typed-contract";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "@/server/conversations/database";
import { conversationWriteFencesClear } from "@/server/conversations/write-fences";
import { projectCapabilities, resolveProjectRole } from "@/server/projects/capabilities";
import { readCanonicalTasks } from "@/server/db/task-read";
import * as schema from "@/server/db/schema";
import { createPingCommandService, type PingExecutionContext } from "./command-service";

export type PingTypedActor = Readonly<{ actorId: string; sessionId: string }>;
type Original = Readonly<{ command: PingCommand; context: PingExecutionContext }>;
type FullCapture = Omit<PingCapture, "snapshots"> & { snapshots: Readonly<Record<string, PingTypedSnapshot>> };
type Lane = { token: string; actor: PingTypedActor; generationId: string; requestId: string; requestHash: string;
  capture: FullCapture; original: Original | null; proposal: Extract<ReturnType<typeof parsePingTypedCommand>, { outcome: "plan" }> | null;
  expiresAt: number; invoked: boolean; cancelled: boolean; executing: boolean; reading: boolean;
  receipt: PingTypedReceipt | null; reads: number; refreshes: number; lastReadAt: number; voice?: Voice };
type Voice = { runner: PingVoicePcmSession; frames: string[]; totalSamples: number; timer: ReturnType<typeof setInterval> | null;
  finish: { throughFrame: number; totalSamples: number } | null; finishedAt: number | null;
  waiting: (() => void) | null; finishing: Promise<PingVoiceResponse> | null; disposed: boolean; uploadAbort: AbortController | null };
const fail = (code: Extract<PingTypedResponse, { ok: false }>["code"]): PingTypedResponse => ({ ok: false, code });
const nullable = (value: unknown): number | null => value == null ? null : Number(value);
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function snapshot(row: Record<string, unknown>): PingTypedSnapshot {
  return { assignees: JSON.parse(String(row.assignees)), due: row.due == null ? null : String(row.due),
    dueAtSeconds: nullable(row.due_at), startDay: nullable(row.start_day), durationDays: nullable(row.duration_days),
    lane: row.lane as PingTypedSnapshot["lane"], boardColumnKey: row.board_column_key as null,
    completedAtSeconds: nullable(row.completed_at) };
}
function sameSnapshot(left: PingTypedSnapshot, right: PingTypedSnapshot) {
  return stable({ ...left, assignees: [...left.assignees].sort() }) ===
    stable({ ...right, assignees: [...right.assignees].sort() });
}
async function authorized(tx: ConversationSqlExecutor, actor: string, project: string, write: boolean) {
  const row = (await tx.execute({ sql: `SELECT m.role,w.owner_user_id,w.archived_at FROM workspace_members m
    JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.workspace_id=? LIMIT 1`, args: [actor, project] })).rows[0];
  if (!row || (row.role !== "owner" && row.role !== "member")) return false;
  const role = resolveProjectRole({ actorUserId: actor, membershipRole: row.role,
    workspaceOwnerUserId: row.owner_user_id == null ? null : String(row.owner_user_id) });
  const capabilities = projectCapabilities({ role, archived: row.archived_at != null, ownsPlanningPeriod: false });
  return (write ? capabilities.createOrEditTasks : capabilities.open) && conversationWriteFencesClear(tx, actor, project);
}
function wireTask(task: Task): PingTypedTask {
  return { ...task, dueAt: task.dueAt?.toISOString(), updatedAt: task.updatedAt.toISOString(),
    archivedAt: task.archivedAt?.toISOString() ?? null, completedAt: task.completedAt?.toISOString() ?? null };
}
function identity(lane: Lane) {
  return { generationId: lane.generationId, commandId: lane.capture.commandId, projectId: lane.capture.projectId };
}
function currentMatches(lane: Lane, rows: readonly Task[]): boolean {
  const command = lane.original!.command, operation = command.operation;
  return lane.receipt!.effects.every((effect) => {
    const task = rows.find((row) => row.id === effect.taskId);
    if (!task || task.isMilestone || task.recurrence || task.parentTaskId || task.archivedAt || task.boardColumnKey != null) return false;
    const pre = lane.capture.snapshots[effect.taskId];
    const assignees = operation.kind === "create_placeholders" ? [] : [...pre.assignees];
    if (operation.effects.selfAssignment === "add" && !assignees.includes(lane.actor.actorId)) assignees.push(lane.actor.actorId);
    if (operation.effects.selfAssignment === "remove") {
      const index = assignees.indexOf(lane.actor.actorId); if (index >= 0) assignees.splice(index, 1);
    }
    const due = Object.hasOwn(operation.effects, "dueDate") ? operation.effects.dueDate ?? null : pre?.due ?? null;
    const dueAt = Object.hasOwn(operation.effects, "dueDate") ?
      pingProofDueAtSeconds(operation.effects.dueDate ?? null) : pre?.dueAtSeconds ?? null;
    const status = operation.effects.statusColumnKey ?? (operation.kind === "create_placeholders" ? "todo" : pre.lane);
    // Initial typed slice accepts default stored columns only, so done semantics are explicit.
    const completed = operation.kind === "create_placeholders" ? (status === "done" ? lane.receipt!.committedAtSeconds : null) :
      !operation.effects.statusColumnKey || (pre.lane === "done") === (status === "done") ? pre.completedAtSeconds :
        status === "done" ? lane.receipt!.committedAtSeconds : null;
    return stable([...task.assignees].sort()) === stable(assignees.sort()) && (task.due ?? null) === due &&
      (task.dueAt ? Math.floor(task.dueAt.getTime() / 1000) : null) === dueAt && task.lane === status &&
      (task.completedAt ? Math.floor(task.completedAt.getTime() / 1000) : null) === completed &&
      (task.startDay ?? null) === (pre?.startDay ?? null) && (task.durationDays ?? null) === (pre?.durationDays ?? null) &&
      (operation.kind !== "create_placeholders" || (task.title === operation.title && task.seq === effect.seq));
  });
}

/** Finite isolated-process custody. Injected actor in tests is not genuine authentication evidence. */
export function createPingTypedSession(adapter: ConversationDatabaseAdapter, options: {
  now?: () => number; uuid?: () => string; token?: () => string;
  service?: ReturnType<typeof createPingCommandService>;
  voice?: PingVoiceProviders; monotonic?: () => number;
} = {}) {
  const now = options.now ?? Date.now, uuid = options.uuid ?? randomUUID;
  const monotonic = options.monotonic ?? (() => Math.floor(performance.now()));
  const service = options.service ?? createPingCommandService(adapter);
  const lanes = new Map<string, Lane>(); const preparing = new Set<string>();
  const retired = new Set<string>();
  const key = (actor: PingTypedActor) => stable(actor);
  function prepared(lane: Lane): PingTypedResponse {
    return { ok: true, action: "prepare", ...identity(lane), token: lane.token, expiresAt: lane.expiresAt, proposal: lane.proposal! };
  }
  async function reconcile(lane: Lane, action: "execute" | "receipt" | "cancel"): Promise<PingTypedResponse> {
    if (lane.executing || lane.reading) return { ok: true, action, ...identity(lane), knowledge: "unresolved", detail: "pending" };
    if (lane.reads >= 24 || now() - lane.lastReadAt < 500) return fail("busy");
    lane.reading = true; lane.reads++; lane.lastReadAt = now(); const started = now();
    try {
      const result = await service.getReceiptForCommand(lane.original!);
      if (now() - started >= 10_000) return fail("temporarily_unavailable");
      if (!result.ok) return fail(result.reason === "request_conflict" ? "request_conflict" : "unavailable");
      if (result.state === "absent") return { ok: true, action, ...identity(lane), knowledge: "unresolved", detail: "absent" };
      lane.receipt = result.receipt;
      return { ok: true, action, ...identity(lane), knowledge: "committed", receipt: result.receipt };
    } catch { return fail("temporarily_unavailable"); } finally { lane.reading = false; }
  }
  function closeVoice(lane: Lane) {
    const voice = lane.voice; if (!voice || voice.disposed) return;
    voice.disposed = true;
    voice.uploadAbort?.abort();
    if (voice.timer) clearInterval(voice.timer); voice.timer = null;
    voice.runner.dispose(); voice.waiting?.(); voice.waiting = null;
  }
  function cancelLane(lane: Lane) { lane.cancelled = true; closeVoice(lane); }
  function live(lane: Lane) { return lanes.get(lane.token) === lane && !lane.cancelled; }
  function voiceDeadline(lane: Lane) {
    return lane.voice?.finishedAt == null ? now() < lane.expiresAt : monotonic() - lane.voice.finishedAt < 10_000;
  }
  async function scope(lane: Lane) {
    return adapter.transaction("read", tx => authorized(tx, lane.actor.actorId, lane.capture.projectId, true));
  }
  async function voiceResult(lane: Lane, action: "finish" | "status" | "cancel"): Promise<PingVoiceResponse> {
    if (!lane.invoked) return { ok: true, action, ...identity(lane), knowledge: "not_invoked" };
    const result = await reconcile(lane, "receipt");
    return result.ok && result.action === "receipt" ? { ...result, action } : result as PingVoiceResponse;
  }
  async function finishVoice(lane: Lane, authenticate: () => Promise<PingTypedActor | null>): Promise<PingVoiceResponse> {
    const voice = lane.voice!;
    try {
      if (!voice.runner.requestFinish()) { cancelLane(lane); return voiceResult(lane, "finish"); }
      voice.runner.acceptCut({ type: "cut", generationId: lane.generationId, connectionEpoch: lane.capture.connectionEpoch,
        throughFrame: voice.frames.length, totalSamples: voice.totalSamples });
      while (live(lane) && voiceDeadline(lane) && !["ready", "closed", "unavailable"].includes(voice.runner.getSnapshot().phase)) {
        await new Promise<void>(resolve => { voice.waiting = resolve; }); voice.waiting = null;
      }
      if (!live(lane) || !voiceDeadline(lane)) { cancelLane(lane); return voiceResult(lane, "finish"); }
      const proposal = voice.runner.getProposal();
      if (!proposal || proposal.outcome !== "plan" || (proposal.operation.kind === "create_placeholders" && lane.capture.selectedTaskIds.length !== 0)) {
        cancelLane(lane); return voiceResult(lane, "finish");
      }
      const bound = bindPingProposal(proposal, lane.capture, { generationId: lane.generationId,
        inputItemId: lane.capture.inputItemId, state: "complete" });
      if (!bound.ok) { cancelLane(lane); return voiceResult(lane, "finish"); }
      lane.original = { command: bound.command, context: bound.context };
      // Copy the immutable bound original before erasing raw transcript/provider state.
      closeVoice(lane);
      // Retain the physical read guard until the actual auth/scope work settles, even if its delivery deadline expires.
      lane.reading = true;
      const checking = (async () => {
        const current = await authenticate();
        return !!current && key(current) === key(lane.actor) && live(lane) && voiceDeadline(lane) && await scope(lane);
      })().finally(() => { lane.reading = false; });
      let deadline: ReturnType<typeof setTimeout> | null = null;
      let allowed: boolean;
      try { allowed = await Promise.race([checking, new Promise<boolean>(resolve => {
        deadline = setTimeout(() => { cancelLane(lane); resolve(false); }, Math.max(0, 10_000 - (monotonic() - voice.finishedAt!)));
      })]); } finally { if (deadline) clearTimeout(deadline); }
      // Final synchronous latch: cancellation during either authentication await cannot revive a lane.
      if (!allowed || !live(lane) || lane.reading || !voiceDeadline(lane)) { cancelLane(lane); return voiceResult(lane, "finish"); }
      lane.invoked = true; lane.executing = true;
      try {
        const result = await service.execute(lane.original);
        if (!result.ok) return { ok: true, action: "finish", ...identity(lane), knowledge: "unresolved", detail: "failed" };
        lane.receipt = result.receipt;
        return { ok: true, action: "finish", ...identity(lane), knowledge: "committed", receipt: result.receipt };
      } catch { return { ok: true, action: "finish", ...identity(lane), knowledge: "unresolved", detail: "failed" }; }
      finally { lane.executing = false; }
    } catch { cancelLane(lane); return voiceResult(lane, "finish"); }
  }
  async function handleVoice(actor: PingTypedActor, value: unknown,
    authenticate: () => Promise<PingTypedActor | null>): Promise<PingVoiceResponse> {
    if (!validPingId(actor.actorId) || !validPingId(actor.sessionId) || !adapter.available ||
      adapter.boundary !== "local-serialized-connection" || !options.voice) return { ok: false, code: "unavailable" };
    if (!dataRecord(value) || value.version !== PING_VOICE_VERSION) return { ok: false, code: "invalid_input" };
    if (value.action === "begin") {
      if (!exactKeys(value, ["version", "action", "requestId", "projectId", "selectedTaskIds", "snapshots"]) ||
        !normalizePingCommandId(value.requestId) || !validPingId(value.projectId) || !jsonArray(value.selectedTaskIds, 10) ||
        !value.selectedTaskIds.every(validPingId) || new Set(value.selectedTaskIds).size !== value.selectedTaskIds.length ||
        !dataRecord(value.snapshots)) return { ok: false, code: "invalid_input" };
      const request = { ...value, requestId: normalizePingCommandId(value.requestId)! };
      const requestKey = `${key(actor)}:${request.requestId}`, hash = createHash("sha256").update(stable(request)).digest("hex");
      if (retired.has(requestKey)) return { ok: false, code: "request_conflict" };
      for (const lane of lanes.values()) {
        if (key(lane.actor) !== key(actor)) continue;
        if (lane.requestId === request.requestId) {
          if (lane.requestHash !== hash || !lane.voice) return { ok: false, code: "request_conflict" };
          if (!live(lane) || !voiceDeadline(lane)) return { ok: false, code: "stale_capture" };
          if (lane.reading || lane.executing) return { ok: false, code: "busy" };
          lane.reading = true;
          try { const current = await authenticate();
            if (!current || key(current) !== key(actor) || !await scope(lane) || !live(lane) || !voiceDeadline(lane))
              return { ok: false, code: "unavailable" }; }
          finally { lane.reading = false; }
          return { ok: true, action: "begin", ...identity(lane), token: lane.token,
            connectionEpoch: lane.capture.connectionEpoch, captureExpiresAt: lane.expiresAt };
        }
        if (lane.executing || lane.reading || lane.voice?.finishing || (lane.invoked && !lane.receipt) ||
          (!lane.cancelled && !lane.receipt && now() < lane.expiresAt)) return { ok: false, code: "busy" };
      }
      for (const [token, lane] of lanes) {
        if ((!lane.invoked && !lane.reading && !lane.voice?.finishing && (lane.cancelled || now() >= lane.expiresAt)) ||
          (key(lane.actor) === key(actor) && lane.receipt && !lane.executing && !lane.reading)) {
          if (retired.size >= 512) return { ok: false, code: "busy" };
          closeVoice(lane); retired.add(`${key(lane.actor)}:${lane.requestId}`); lanes.delete(token);
        }
      }
      if (retired.has(requestKey)) return { ok: false, code: "request_conflict" };
      if (lanes.size + preparing.size >= 32 || preparing.has(key(actor))) return { ok: false, code: "busy" };
      preparing.add(key(actor));
      try {
        const tentative = normalizePingCapture({ generationId: uuid(), connectionEpoch: uuid(), contextKey: request.requestId,
          sessionId: actor.sessionId, actorId: actor.actorId, inputItemId: uuid(), commandId: uuid(), projectId: value.projectId,
          selectedTaskIds: value.selectedTaskIds, snapshots: value.snapshots, referenceInstant: new Date(now()).toISOString(),
          timeZone: "Europe/Dublin", expectedColumnConfig: null });
        if (!tentative) return { ok: false, code: "invalid_input" };
        const capture = await adapter.transaction("read", async tx => {
          if (!await authorized(tx, actor.actorId, tentative.projectId, true)) return null;
          if ((await tx.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [`board:${tentative.projectId}:columns`] })).rows[0]?.value != null) return null;
          const snapshots: Record<string, PingTypedSnapshot> = {};
          for (const id of tentative.selectedTaskIds) {
            const row = (await tx.execute({ sql: "SELECT * FROM tasks WHERE id=? AND workspace_id=?", args: [id, tentative.projectId] })).rows[0];
            if (!row || row.archived_at != null || row.parent_task_id != null || row.recurrence != null || Number(row.is_milestone) !== 0 || row.board_column_key != null) return null;
            const actual = snapshot(row); if (!sameSnapshot(actual, tentative.snapshots[id] as PingTypedSnapshot)) return null;
            snapshots[id] = actual;
          }
          return { ...tentative, snapshots };
        });
        if (!capture) return { ok: false, code: "stale_capture" };
        const current = await authenticate();
        if (!current || key(current) !== key(actor) || now() - Date.parse(capture.referenceInstant) >= 45_000 ||
          !await adapter.transaction("read", tx => authorized(tx, actor.actorId, capture.projectId, true)))
          return { ok: false, code: "unavailable" };
        if (now() - Date.parse(capture.referenceInstant) >= 45_000) return { ok: false, code: "stale_capture" };
        const token = options.token?.() ?? randomBytes(24).toString("base64url");
        if (lanes.has(token)) return { ok: false, code: "temporarily_unavailable" };
        let lane: Lane | null = null;
        const runner = createPingVoiceSession({ capture, transport: options.voice.createTransport({
          generationId: capture.generationId, connectionEpoch: capture.connectionEpoch }), now: monotonic,
          isContextCurrent: () => lane === null ? now() - Date.parse(capture.referenceInstant) < 45_000 : live(lane), interpret: options.voice.interpret,
          onSnapshot: state => { if (!lane || lane.voice?.disposed) return;
            if (["closed", "unavailable"].includes(state.phase)) cancelLane(lane);
            lane.voice?.waiting?.(); } });
        if (runner.getSnapshot().phase !== "capturing") { runner.dispose(); return { ok: false, code: "unavailable" }; }
        lane = { token, actor: { ...actor }, requestId: request.requestId, requestHash: hash, generationId: capture.generationId,
          capture, original: null, proposal: null, expiresAt: Date.parse(capture.referenceInstant) + 45_000, invoked: false, cancelled: false, executing: false,
          reading: false, receipt: null, reads: 0, refreshes: 0, lastReadAt: -Infinity,
          voice: { runner, frames: [], totalSamples: 0, timer: null, finish: null, finishedAt: null, waiting: null, finishing: null, disposed: false, uploadAbort: null } };
        const installed = lane; lanes.set(token, installed);
        installed.voice!.timer = setInterval(() => { runner.tick();
          if (!voiceDeadline(installed)) cancelLane(installed); installed.voice?.waiting?.(); }, 1000);
        installed.voice!.timer.unref();
        return { ok: true, action: "begin", ...identity(installed), token, connectionEpoch: capture.connectionEpoch, captureExpiresAt: installed.expiresAt };
      } catch { return { ok: false, code: "temporarily_unavailable" }; } finally { preparing.delete(key(actor)); }
    }
    const isFinish = value.action === "finish";
    if (!exactKeys(value, isFinish ? ["version", "action", "generationId", "token", "throughFrame", "totalSamples"] :
      ["version", "action", "generationId", "token"]) || !validPingId(value.generationId) || typeof value.token !== "string" ||
      value.token.length > 128 || !["finish", "status", "cancel"].includes(String(value.action))) return { ok: false, code: "invalid_input" };
    const lane = lanes.get(value.token);
    if (!lane?.voice || key(lane.actor) !== key(actor)) return { ok: false, code: "unavailable" };
    if (lane.generationId !== value.generationId) return { ok: false, code: "stale_capture" };
    const action = value.action as "finish" | "status" | "cancel";
    if (action === "cancel") { cancelLane(lane); return voiceResult(lane, action); }
    if (action === "status") {
      if (lane.invoked || lane.cancelled) return voiceResult(lane, action);
      if (lane.reading) return { ok: false, code: "busy" };
      lane.reading = true;
      try { if (!await scope(lane) || !live(lane) || !voiceDeadline(lane)) {
        cancelLane(lane); return voiceResult(lane, action); }
        return { ok: true, action, ...identity(lane), state: "pending", snapshot: lane.voice.runner.getSnapshot() };
      } finally { lane.reading = false; }
    }
    if (!Number.isSafeInteger(value.throughFrame) || !Number.isSafeInteger(value.totalSamples))
      return { ok: false, code: "invalid_input" };
    if (lane.voice.finish) {
      if (value.throughFrame !== lane.voice.finish.throughFrame || value.totalSamples !== lane.voice.finish.totalSamples)
        return { ok: false, code: "request_conflict" };
      return lane.voice.finishing ?? voiceResult(lane, action);
    }
    if (value.throughFrame !== lane.voice.frames.length || value.totalSamples !== lane.voice.totalSamples || !lane.voice.totalSamples)
      return { ok: false, code: "invalid_input" };
    if (!live(lane) || !voiceDeadline(lane)) { cancelLane(lane); return voiceResult(lane, action); }
    if (lane.reading) return { ok: false, code: "busy" };
    lane.voice.finish = { throughFrame: value.throughFrame as number, totalSamples: value.totalSamples as number };
    lane.voice.finishedAt = monotonic();
    // Reserve the promise before any reentrant transport/provider callback can observe Finish.
    lane.voice.finishing = Promise.resolve().then(() => finishVoice(lane, authenticate));
    try { return await lane.voice.finishing; } finally { lane.voice.finishing = null; }
  }
  async function acceptVoiceAudio(actor: PingTypedActor, envelope: unknown, readBytes: (signal: AbortSignal) => Promise<unknown>,
    authenticate: () => Promise<PingTypedActor | null>): Promise<PingVoiceResponse> {
    if (!dataRecord(envelope) || !exactKeys(envelope, ["version", "generationId", "token", "ordinal"]) ||
      envelope.version !== PING_VOICE_VERSION || !validPingId(envelope.generationId) || typeof envelope.token !== "string" ||
      envelope.token.length > 128 || !Number.isSafeInteger(envelope.ordinal) || (envelope.ordinal as number) < 1 ||
      (envelope.ordinal as number) > PING_VOICE_MAX_FRAMES) return { ok: false, code: "invalid_input" };
    const lane = lanes.get(envelope.token), ordinal = envelope.ordinal as number;
    if (!lane?.voice || key(lane.actor) !== key(actor)) return { ok: false, code: "unavailable" };
    if (lane.generationId !== envelope.generationId || !live(lane) || lane.voice.finish || !voiceDeadline(lane)) return { ok: false, code: "stale_capture" };
    if (lane.reading) return { ok: false, code: "busy" };
    // Reservation covers body assembly AND reauthentication, not merely synchronous feeding.
    lane.reading = true;
    const uploadAbort = new AbortController(); lane.voice.uploadAbort = uploadAbort;
    try {
      const bytes = await readBytes(uploadAbort.signal);
      const current = await authenticate();
      if (!current || key(current) !== key(actor) || !live(lane) || lane.voice.finish || !voiceDeadline(lane) || !await scope(lane) ||
        !live(lane) || lane.voice.finish || !voiceDeadline(lane)) { cancelLane(lane); return { ok: false, code: "stale_capture" }; }
      const append = encodePingPcmAppend(bytes); if (!append.ok) return { ok: false, code: "invalid_input" };
      const copy = (bytes as Uint8Array).slice(), hash = createHash("sha256").update(copy).digest("hex");
      const prior = lane.voice.frames[ordinal - 1];
      if (prior && prior !== hash) return { ok: false, code: "request_conflict" };
      if (!prior) {
        if (ordinal !== lane.voice.frames.length + 1 || lane.voice.totalSamples + copy.length / 2 > 720_000)
          return { ok: false, code: "invalid_input" };
        lane.voice.runner.acceptPcmFrame({ type: "pcm_frame", generationId: lane.generationId,
          connectionEpoch: lane.capture.connectionEpoch, ordinal, format: "pcm_s16le_mono_24000", bytes: copy });
        if (!live(lane) || lane.voice.runner.getSnapshot().phase !== "capturing") return { ok: false, code: "unavailable" };
        lane.voice.frames.push(hash); lane.voice.totalSamples += copy.length / 2;
      }
      return { ok: true, action: "audio", ...identity(lane), acceptedThrough: lane.voice.frames.length, totalSamples: lane.voice.totalSamples };
    } catch { return { ok: false, code: "temporarily_unavailable" }; }
    finally { lane.reading = false; lane.voice.uploadAbort = null; }
  }
  return { handleVoice, acceptVoiceAudio, async handle(actor: PingTypedActor, value: unknown): Promise<PingTypedResponse> {
    if (!validPingId(actor.actorId) || !validPingId(actor.sessionId) || !adapter.available ||
      adapter.boundary !== "local-serialized-connection") return fail("unavailable");
    if (!dataRecord(value) || value.version !== PING_TYPED_VERSION || !validPingId(value.generationId)) return fail("invalid_input");
    if (value.action === "prepare") {
      if (!exactKeys(value, ["version", "action", "generationId", "requestId", "projectId", "selectedTaskIds", "snapshots", "text"]) ||
        !normalizePingCommandId(value.requestId) || !validPingId(value.projectId) || !jsonArray(value.selectedTaskIds, 10) ||
        !value.selectedTaskIds.every(validPingId) || new Set(value.selectedTaskIds).size !== value.selectedTaskIds.length ||
        !dataRecord(value.snapshots) || typeof value.text !== "string") return fail("invalid_input");
      const request = { ...value, requestId: normalizePingCommandId(value.requestId)! } as unknown as PingTypedPrepare;
      const requestKey = `${key(actor)}:${request.requestId.toLowerCase()}`;
      if (retired.has(requestKey)) return fail("request_conflict");
      const proposal = parsePingTypedCommand(request.text);
      if (proposal.outcome !== "plan") return fail(proposal.reason);
      if (proposal.operation.kind === "create_placeholders" && request.selectedTaskIds.length !== 0) return fail("invalid_input");
      const tentative = normalizePingCapture({ generationId: request.generationId, connectionEpoch: "typed-local", contextKey: request.requestId,
        sessionId: actor.sessionId, actorId: actor.actorId, inputItemId: uuid(), commandId: uuid(), projectId: request.projectId,
        selectedTaskIds: request.selectedTaskIds, snapshots: request.snapshots,
        referenceInstant: new Date(now()).toISOString(), timeZone: "Europe/Dublin", expectedColumnConfig: null });
      if (!tentative) return fail("invalid_input");
      const requestHash = createHash("sha256").update(stable(request)).digest("hex");
      for (const lane of lanes.values()) {
        if (key(lane.actor) !== key(actor)) continue;
        if (lane.requestId === request.requestId) {
          if (lane.requestHash !== requestHash) return fail("request_conflict");
          if (!lane.invoked && (lane.cancelled || now() >= lane.expiresAt)) return fail("stale_capture");
          return prepared(lane);
        }
        if (lane.executing || lane.reading || lane.voice?.finishing) return fail("busy");
        if (!lane.receipt && !lane.cancelled && (lane.invoked || now() < lane.expiresAt)) return fail("busy");
        if (lane.invoked && !lane.receipt) return fail("busy");
      }
      for (const [token, lane] of lanes) {
        // Retired identities cannot mint a different original, even for untouched expired/cancelled captures.
        if ((!lane.invoked && !lane.reading && !lane.voice?.finishing && (lane.cancelled || now() >= lane.expiresAt)) ||
          (key(lane.actor) === key(actor) && lane.receipt && !lane.executing && !lane.reading)) {
          if (retired.size >= 512) return fail("busy");
          closeVoice(lane); retired.add(`${key(lane.actor)}:${lane.requestId.toLowerCase()}`); lanes.delete(token);
        }
      }
      if (retired.has(requestKey)) return fail("request_conflict");
      if (lanes.size + preparing.size >= 32 || preparing.has(key(actor))) return fail("busy");
      preparing.add(key(actor));
      try {
        const capture = await adapter.transaction("read", async (tx) => {
          if (!await authorized(tx, actor.actorId, request.projectId, true)) return null;
          const raw = (await tx.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [`board:${request.projectId}:columns`] })).rows[0];
          // Typed baseline deliberately uses default system columns, not custom configuration.
          if (raw?.value != null) return null;
          const snapshots: Record<string, PingTypedSnapshot> = {};
          for (const id of tentative.selectedTaskIds) {
            const row = (await tx.execute({ sql: "SELECT * FROM tasks WHERE id=? AND workspace_id=?", args: [id, request.projectId] })).rows[0];
            if (!row || row.archived_at != null || row.parent_task_id != null || row.recurrence != null || Number(row.is_milestone) !== 0 ||
              row.board_column_key != null) return null;
            const actual = snapshot(row);
            if (!sameSnapshot(actual, tentative.snapshots[id] as PingTypedSnapshot)) return null;
            snapshots[id] = actual;
          }
          const normalized = normalizePingCapture({ ...tentative, snapshots });
          return normalized ? { ...normalized, snapshots } : null;
        });
        if (!capture) return fail("stale_capture");
        const bound = bindPingProposal(proposal, capture, { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
        if (!bound.ok) return fail("invalid_input");
        const token = options.token?.() ?? randomBytes(24).toString("base64url");
        if (lanes.has(token)) return fail("temporarily_unavailable");
        const lane: Lane = { token, actor: { ...actor }, requestId: request.requestId, requestHash, generationId: request.generationId,
          capture, original: { command: bound.command, context: bound.context }, proposal: bound.proposal as Lane["proposal"],
          expiresAt: now() + 10_000, invoked: false, cancelled: false, executing: false, reading: false,
          receipt: null, reads: 0, refreshes: 0, lastReadAt: -Infinity };
        lanes.set(token, lane); return prepared(lane);
      } catch { return fail("temporarily_unavailable"); } finally { preparing.delete(key(actor)); }
    }
    if (!exactKeys(value, ["version", "action", "generationId", "token"]) || typeof value.token !== "string" ||
      value.token.length > 128 || !["execute", "cancel", "receipt", "refresh"].includes(String(value.action))) return fail("invalid_input");
    const request = value as unknown as Exclude<PingTypedRequest, PingTypedPrepare>;
    const lane = lanes.get(request.token);
    if (!lane || key(lane.actor) !== key(actor)) return fail("unavailable");
    if (lane.generationId !== request.generationId) return fail("stale_capture");
    if (request.action === "cancel") {
      cancelLane(lane);
      if (!lane.invoked) return { ok: true, action: "cancel", ...identity(lane), knowledge: "not_invoked" };
      return reconcile(lane, "cancel");
    }
    // Voice Finish alone binds/invokes a pending voice lane; typed Execute cannot bypass it.
    if (!lane.original || (lane.voice && request.action === "execute" && !lane.invoked)) return fail("invalid_input");
    const original = lane.original;
    if (request.action === "execute") {
      if (lane.invoked) return reconcile(lane, "execute");
      if (lane.cancelled || now() >= lane.expiresAt) return fail("stale_capture");
      lane.invoked = true; lane.executing = true;
      try {
        const result = await service.execute(lane.original);
        if (!result.ok) return { ok: true, action: "execute", ...identity(lane), knowledge: "unresolved", detail: "failed" };
        lane.receipt = result.receipt;
        return { ok: true, action: "execute", ...identity(lane), knowledge: "committed", receipt: result.receipt };
      } catch { return { ok: true, action: "execute", ...identity(lane), knowledge: "unresolved", detail: "failed" }; }
      finally { lane.executing = false; }
    }
    if (!lane.invoked) return fail("invalid_input");
    if (request.action === "receipt") return reconcile(lane, "receipt");
    if (lane.cancelled || lane.executing || lane.reading || lane.refreshes >= 3) return fail("busy");
    lane.reading = true; lane.refreshes++; const started = now();
    try {
      const known = await service.getReceiptForCommand(lane.original);
      if (!known.ok || known.state !== "committed") return fail("unavailable");
      lane.receipt = known.receipt;
      const tasks = await adapter.transaction("read", async (tx) => {
        if (!await authorized(tx, actor.actorId, original.command.projectId, false)) return null;
        const reader = drizzle(tx as unknown as Client, { schema });
        return readCanonicalTasks(reader, original.command.projectId);
      });
      if (!tasks) return fail("unavailable");
      if (lane.cancelled || now() - started >= 10_000) return fail("temporarily_unavailable");
      return { ok: true, action: "refresh", ...identity(lane), receipt: known.receipt,
        projection: currentMatches(lane, tasks) ? "matches" : "diverged", tasks: tasks.map(wireTask) };
    } catch { return fail("temporarily_unavailable"); } finally { lane.reading = false; }
  } };
}
