import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { ConversationPoller, type PollScope } from "../../src/lib/conversations/polling";
import { runWithTargetGuard } from "./contracts/target-manifest.mjs";
import { hostedTargetHash, type HostedFixture, type HostedManifest, type HostedObserved } from "./hosted-seed";
import type { HostedSessions, SessionCleanupReceipt } from "./hosted-workload";

export const CLOSED_LOOP_PHASES = Object.freeze([
  { name: "chat-only", durationMs: 30_000, active: [0, 1, 2, 3], inactive: [], hidden: [] },
  { name: "browsing-only", durationMs: 30_000, active: [], inactive: [4, 5, 6, 7], hidden: [] },
  { name: "hidden-only", durationMs: 10_000, active: [], inactive: [], hidden: [8, 9] },
  { name: "mixed", durationMs: 60_000, active: [0, 1, 2, 3], inactive: [4, 5, 6, 7], hidden: [8, 9] },
] as const);
export const CLOSED_LOOP_REQUEST_CAP = 1_000;
const MAX_HISTORY_BYTES = 4_000_000;
// The authenticated-session manager's app request timeout is 60s; leave margin for its bounded body shutdown.
const MAX_DRAIN_MS = 70_000;

type PhaseName = typeof CLOSED_LOOP_PHASES[number]["name"];
type SessionHandle = unknown;
export type ClosedLoopInput = {
  manifest: HostedManifest;
  observed: HostedObserved;
  fixture: HostedFixture;
  tasksUrl: string;
  tasksToken: string;
  executionAuthorized: boolean;
  createSessions: () => HostedSessions | Promise<HostedSessions>;
  outputDirectory: string;
};
type SessionCounters = { started: number; completed: number; achieved: number; verifiedMessages: number; bytes: number; inFlight: number; maxInFlight: number };
type PhaseCounters = { name: PhaseName; durationMs: number; activeSessions: number; inactiveSessions: number; hiddenSessions: number;
  visibleIndexes: number[]; hiddenIndexes: number[]; achievedBySession: number[]; started: number; completed: number; cancelled: number;
  achieved: number; verifiedMessages: number; bytes: number; failures: number; latenciesMs: number[] };
type HistoryValue = { messages: Array<{ id: string }>; throughChangeSeq: number };

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const safeCode = (error: unknown) => {
  const candidate = isObject(error) && typeof error.code === "string" ? error.code : "closed_loop_probe_failed";
  return /^[a-z0-9_-]{1,80}$/i.test(candidate) ? candidate : "closed_loop_probe_failed";
};

/** Validate all local configuration before acquiring sessions or opening the target database. */
export function validateClosedLoopInputs(input: Pick<ClosedLoopInput, "manifest" | "observed" | "fixture" | "tasksUrl" | "executionAuthorized">) {
  if (input.executionAuthorized !== true) throw new Error("closed_loop_execution_not_authorized");
  if (!input.fixture || input.fixture.fixtureNamespace !== input.manifest.fixtureNamespace || input.fixture.rooms.length !== 10 || input.fixture.actors.length !== 2) {
    throw new Error("closed_loop_fixture_manifest_mismatch");
  }
  if (input.fixture.counts.projects !== 10 || input.fixture.counts.tasks !== 1_000 || input.fixture.counts.messages !== 10_000 || input.fixture.counts.resources !== 500 ||
      input.fixture.deniedProjectForObserver !== input.fixture.rooms[9]?.projectId) throw new Error("closed_loop_fixture_counts_or_denial_mismatch");
  const manifestActorHashes = new Set(input.manifest.testActors.map((actor) => actor.actorHash));
  if (!input.fixture.actors.every((actor) => manifestActorHashes.has(actor.actorHash))) throw new Error("closed_loop_fixture_actor_unattested");
  if (!/^reliability-[a-z0-9-]{8,64}$/i.test(input.fixture.fixtureNamespace)) throw new Error("closed_loop_fixture_namespace_invalid");
  if (!input.fixture.rooms.every((room, index) => room.projectId === `${input.fixture.fixtureNamespace}_project_${index}` &&
      typeof room.conversationId === "string" && room.conversationId.length > 0 && typeof room.sourceMessageId === "string" && room.sourceMessageId.length > 0)) {
    throw new Error("closed_loop_fixture_scope_invalid");
  }
  let tasksUrl: URL;
  try { tasksUrl = new URL(input.tasksUrl); } catch { throw new Error("closed_loop_tasks_target_invalid"); }
  const localFileTarget = input.manifest.environment.kind === "authenticated-local-test" && tasksUrl.protocol === "file:";
  if ((!localFileTarget && !["libsql:", "http:", "https:"].includes(tasksUrl.protocol)) ||
      (input.manifest.environment.kind === "hosted-test" && tasksUrl.protocol === "file:") ||
      input.manifest.expectedTargetHashes.tasks !== hostedTargetHash(input.tasksUrl)) {
    throw new Error("closed_loop_tasks_target_mismatch");
  }
  const allowedOrigins = input.manifest.allowedOrigins;
  if (typeof input.observed.origin !== "string" || !Array.isArray(allowedOrigins) || !allowedOrigins.includes(input.observed.origin)) throw new Error("closed_loop_app_origin_not_allowlisted");
  const appOrigin = new URL(input.observed.origin);
  if (!new Set(["authenticated-local-test", "hosted-test"]).has(input.manifest.environment.kind) ||
      (input.manifest.environment.kind === "authenticated-local-test" && (appOrigin.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(appOrigin.hostname))) ||
      (input.manifest.environment.kind === "hosted-test" && appOrigin.protocol !== "https:")) {
    throw new Error("closed_loop_nonproduction_origin_required");
  }
  return { appOrigin: appOrigin.origin };
}

/** Parse only successful, strictly-shaped history envelopes. */
export function parseHistoryResponse(rawText: string): HistoryValue {
  let raw: unknown;
  try { raw = JSON.parse(rawText); } catch { throw new Error("closed_loop_malformed_json"); }
  if (!isObject(raw) || raw.ok !== true || !isObject(raw.value) || !Array.isArray(raw.value.messages) ||
      !Number.isSafeInteger(raw.value.throughChangeSeq) || (raw.value.throughChangeSeq as number) < 0) {
    throw new Error("closed_loop_malformed_history_envelope");
  }
  const ids: string[] = [];
  for (const message of raw.value.messages) {
    if (!isObject(message) || typeof message.id !== "string" || message.id.length < 1 || message.id.length > 256 || /[\u0000-\u001f]/.test(message.id)) {
      throw new Error("closed_loop_malformed_history_message");
    }
    ids.push(message.id);
  }
  if (new Set(ids).size !== ids.length) throw new Error("closed_loop_duplicate_history_message");
  return { messages: ids.map((id) => ({ id })), throughChangeSeq: raw.value.throughChangeSeq as number };
}

export function requireSourceMessage(value: HistoryValue, sourceMessageId: string) {
  if (!value.messages.some((message) => message.id === sourceMessageId)) throw new Error("closed_loop_source_message_missing");
  return value;
}

/** Only a manager-reported caller abort before full body consumption is an expected phase cancellation. */
export function classifyClosedLoopPollError(error: unknown, { signalAborted, responseBodyComplete }: { signalAborted: boolean; responseBodyComplete: boolean }) {
  return signalAborted && !responseBodyComplete && isObject(error) && error.code === "APPLICATION_REQUEST_ABORTED" ? "cancelled" : "failure";
}

/** Every visible session needs useful persisted evidence; hidden sessions must remain silent. */
export function evaluateClosedLoopPhaseEvidence({ visibleSessions, hiddenSessions, achievedBySession, hiddenRequests, failures }: {
  visibleSessions: number[]; hiddenSessions: number[]; achievedBySession: number[]; hiddenRequests: number; failures: number;
}) {
  const findings: string[] = [];
  if (failures > 0) findings.push("phase_poll_failure");
  for (const index of visibleSessions) if ((achievedBySession[index] ?? 0) < 1) findings.push(`visible_session_without_verified_response:${index}`);
  if (hiddenSessions.length > 0 && hiddenRequests > 0) findings.push("hidden_session_poll_activity");
  return { ok: findings.length === 0, findings };
}

/** Explicitly read back every returned ID and compare its persisted project/conversation scope. */
export async function verifyHistoryScope(client: Pick<Client, "execute">, value: HistoryValue, projectId: string, conversationId: string) {
  let verified = 0;
  const ids = value.messages.map((message) => message.id);
  for (let offset = 0; offset < ids.length; offset += 80) {
    const batch = ids.slice(offset, offset + 80);
    const placeholders = batch.map(() => "?").join(",");
    const result = await client.execute({
      sql: `SELECT id,workspace_id,conversation_id FROM conversation_messages WHERE id IN (${placeholders})`,
      args: batch,
    });
    if (result.rows.length !== batch.length) throw new Error("closed_loop_history_id_missing_from_database");
    const rows = new Map(result.rows.map((row) => [String(row.id), row]));
    for (const id of batch) {
      const row = rows.get(id);
      if (!row || row.workspace_id !== projectId || row.conversation_id !== conversationId) throw new Error("closed_loop_history_scope_mismatch");
      verified++;
    }
  }
  return verified;
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}

function summarizePhase(phase: PhaseCounters) {
  return { ...phase, latenciesMs: undefined, latency: { sampleCount: phase.latenciesMs.length, p50Ms: percentile(phase.latenciesMs, 0.5),
    p95Ms: percentile(phase.latenciesMs, 0.95), maxMs: phase.latenciesMs.length ? Math.max(...phase.latenciesMs) : null } };
}

async function readBounded(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytes: 0 };
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_HISTORY_BYTES) { await reader.cancel(); throw new Error("closed_loop_response_size_cap"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let position = 0;
  for (const chunk of chunks) { buffer.set(chunk, position); position += chunk.length; }
  return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), bytes };
}

async function waitForDrain(counters: SessionCounters[]) {
  const started = Date.now();
  while (counters.some((counter) => counter.inFlight > 0)) {
    if (Date.now() - started > MAX_DRAIN_MS) throw new Error("closed_loop_requests_did_not_drain");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Runs the existing client scheduler in Node using controlled visibility/focus inputs and real authenticated HTTP.
 * This is not browser DOM, paint, or visibility-wiring evidence. A local run is not hosted acceptance evidence.
 */
export async function runClosedLoopProbe(input: ClosedLoopInput) {
  const { appOrigin } = validateClosedLoopInputs(input);
  let sessions: HostedSessions | undefined;
  let db: Client | undefined;
  let result: Record<string, unknown> | undefined;
  let runError: string | undefined;
  let guardAccepted = false;
  let stopAndDrain = async () => {};
  let drainTimedOut = false;
  let residualInFlightAtDeadline = 0;
  let databaseCloseDeferredUntilPollsComplete = false;
  let residualCountAtReceipt = () => 0;
  let cleanup: SessionCleanupReceipt = { ok: true, attempted: 0, revoked: 0, unresolved: 0, errors: [] };
  try {
    result = await runWithTargetGuard({ manifest: input.manifest, observed: input.observed, write: async () => {
      guardAccepted = true;
      sessions = await input.createSessions();
      const handles: SessionHandle[] = [];
      for (let index = 0; index < 10; index++) {
        // Project 9 intentionally denies actor 1; bind that room to actor 0 for authorized polling.
        const actorIndex = index === 9 ? 0 : index % 2;
        handles.push(await sessions.createSession(input.fixture.actors[actorIndex].actorHash));
      }
      db = createClient({ url: input.tasksUrl, ...(input.manifest.environment.kind === "hosted-test" ? { authToken: input.tasksToken } : {}) });
      const counters = Array.from({ length: 10 }, () => ({ started: 0, completed: 0, achieved: 0, verifiedMessages: 0, bytes: 0, inFlight: 0, maxInFlight: 0 } satisfies SessionCounters));
      residualCountAtReceipt = () => counters.reduce((sum, counter) => sum + counter.inFlight, 0);
      const phases: PhaseCounters[] = [];
      let totalStarted = 0;
      let authenticatedFetchInvocations = 0;
      let fatalCode: string | undefined;
      const pendingPollSettlements = new Set<Promise<void>>();
      let resolveFatal!: () => void;
      const fatalSignal = new Promise<void>((resolve) => { resolveFatal = resolve; });
      let activePhase: PhaseCounters | undefined;
      const pollers: ConversationPoller<HistoryValue>[] = [];
      const scopes: PollScope[] = input.fixture.rooms.map((room, index) => ({ actorId: input.fixture.actors[index === 9 ? 0 : index % 2].actorId,
        projectId: room.projectId, conversationId: room.conversationId }));
      const stopAll = () => { for (const poller of pollers) poller.stop(); };
      stopAndDrain = async () => {
        if (drainTimedOut) return;
        stopAll();
        try { await waitForDrain(counters); }
        catch {
          drainTimedOut = true;
          const pending = [...pendingPollSettlements];
          residualInFlightAtDeadline = Math.max(residualInFlightAtDeadline, pending.length);
          runError ??= "closed_loop_requests_did_not_drain";
          fatalCode ??= "closed_loop_requests_did_not_drain";
          if (pending.length > 0 && db) {
            databaseCloseDeferredUntilPollsComplete = true;
            const clientToClose = db;
            void Promise.all(pending).then(() => { try { clientToClose.close(); } catch { /* receipt already fails closed */ } });
          }
          return;
        }
      };

      for (let index = 0; index < 10; index++) {
        pollers.push(new ConversationPoller<HistoryValue>({
          poll: async (scope, signal) => {
            if (!activePhase || fatalCode) throw new Error("closed_loop_phase_not_active");
            if (totalStarted >= CLOSED_LOOP_REQUEST_CAP) throw new Error("closed_loop_request_cap_exceeded");
            const counter = counters[index];
            const phase = activePhase;
            totalStarted++; phase.started++; counter.started++; counter.inFlight++;
            counter.maxInFlight = Math.max(counter.maxInFlight, counter.inFlight);
            let settlePoll!: () => void;
            const pollSettled = new Promise<void>((resolve) => { settlePoll = resolve; });
            pendingPollSettlements.add(pollSettled);
            const startedAt = performance.now();
            let responseBodyComplete = false;
            try {
              const room = input.fixture.rooms[index];
              const url = new URL("/api/conversations", appOrigin);
              url.searchParams.set("action", "history"); url.searchParams.set("projectId", scope.projectId);
              url.searchParams.set("conversationId", scope.conversationId); url.searchParams.set("afterChangeSeq", "0"); url.searchParams.set("limit", "100");
              authenticatedFetchInvocations++;
              const response = await sessions!.fetchAuthenticated(handles[index], url.toString(), { method: "GET", signal, headers: { accept: "application/json" } });
              const body = await readBounded(response);
              responseBodyComplete = true;
              const latencyMs = performance.now() - startedAt;
              counter.completed++; counter.bytes += body.bytes; phase.completed++; phase.bytes += body.bytes; phase.latenciesMs.push(latencyMs);
              if (response.status !== 200) throw new Error("closed_loop_history_http_failure");
              const value = parseHistoryResponse(body.text);
              requireSourceMessage(value, room.sourceMessageId);
              const verified = await verifyHistoryScope(db!, value, room.projectId, room.conversationId);
              counter.achieved++; phase.achieved++; phase.achievedBySession[index]++;
              counter.verifiedMessages += verified; phase.verifiedMessages += verified;
              return value;
            } catch (error) {
              if (classifyClosedLoopPollError(error, { signalAborted: signal.aborted, responseBodyComplete }) === "cancelled") phase.cancelled++;
              else {
                phase.failures++;
                fatalCode ??= safeCode(error);
                stopAll();
                resolveFatal();
              }
              throw error;
            } finally { counter.inFlight--; pendingPollSettlements.delete(pollSettled); settlePoll(); }
          },
          apply: () => {},
          onFailure: () => { fatalCode ??= "closed_loop_poller_failure"; stopAll(); resolveFatal(); },
        }));
      }

      for (const phaseDefinition of CLOSED_LOOP_PHASES) {
        if (fatalCode) break;
        const phase: PhaseCounters = { name: phaseDefinition.name, durationMs: phaseDefinition.durationMs,
          activeSessions: phaseDefinition.active.length, inactiveSessions: phaseDefinition.inactive.length, hiddenSessions: phaseDefinition.hidden.length,
          visibleIndexes: [...phaseDefinition.active, ...phaseDefinition.inactive], hiddenIndexes: [...phaseDefinition.hidden], achievedBySession: Array(10).fill(0),
          started: 0, completed: 0, cancelled: 0, achieved: 0, verifiedMessages: 0, bytes: 0, failures: 0, latenciesMs: [] };
        phases.push(phase); activePhase = phase;
        const active = new Set<number>(phaseDefinition.active);
        const inactive = new Set<number>(phaseDefinition.inactive);
        const hidden = new Set<number>(phaseDefinition.hidden);
        const hiddenBaseline = new Map(phaseDefinition.hidden.map((index) => [index, counters[index].started]));
        for (let index = 0; index < 10; index++) {
          if (active.has(index)) pollers[index].configure(scopes[index], true, true);
          else if (inactive.has(index)) pollers[index].configure(scopes[index], true, false);
          else pollers[index].configure(hidden.has(index) ? scopes[index] : null, false, false);
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([new Promise<void>((resolve) => { timer = setTimeout(resolve, phase.durationMs); }), fatalSignal]);
        if (timer) clearTimeout(timer);
        await stopAndDrain();
        const hiddenRequests = phaseDefinition.hidden.reduce((sum, index) => sum + counters[index].started - hiddenBaseline.get(index)!, 0);
        const phaseEvidence = evaluateClosedLoopPhaseEvidence({ visibleSessions: phase.visibleIndexes, hiddenSessions: phase.hiddenIndexes,
          achievedBySession: phase.achievedBySession, hiddenRequests, failures: phase.failures });
        if (!phaseEvidence.ok) fatalCode ??= "closed_loop_phase_acceptance_failed";
        // No timer is left running between phases; hidden seats had no configured poll scope.
        if (phaseDefinition.hidden.some((index) => counters[index].started !== hiddenBaseline.get(index))) fatalCode ??= "closed_loop_hidden_session_polled";
      }
      await stopAndDrain();
      activePhase = undefined;
      const totalCompleted = counters.reduce((sum, counter) => sum + counter.completed, 0);
      const totalAchieved = counters.reduce((sum, counter) => sum + counter.achieved, 0);
      const totalVerifiedMessages = counters.reduce((sum, counter) => sum + counter.verifiedMessages, 0);
      const totalBytes = counters.reduce((sum, counter) => sum + counter.bytes, 0);
      const managerMetrics = sessions!.getMetrics() as { app?: { requests?: number; responses?: number; failures?: number }; identityProvider?: Record<string, number> };
      const appTransportRequests = managerMetrics.app?.requests ?? 0;
      return { phases: phases.map(summarizePhase), actualOfferedRequests: appTransportRequests, completedRequests: totalCompleted,
        achievedRequests: totalAchieved, verifiedMessages: totalVerifiedMessages, responseBytes: totalBytes,
        schedulerAttempts: totalStarted, authenticatedFetchInvocations,
        appTransportRequests: managerMetrics.app?.requests ?? 0, appTransportResponses: managerMetrics.app?.responses ?? 0,
        identityProviderTraffic: managerMetrics.identityProvider ?? {}, drainTimedOut, residualInFlightAtDeadline,
        sessionConcurrency: counters.map((counter, index) => ({ sessionIndex: index,
        started: counter.started, completed: counter.completed, achieved: counter.achieved, verifiedMessages: counter.verifiedMessages,
        bytes: counter.bytes, maxInFlight: counter.maxInFlight })),
        probeFailureCode: fatalCode ?? null,
        databaseCloseDeferredUntilPollsComplete,
        executionScope: input.manifest.executionMode ?? input.manifest.environment.kind,
        limitations: ["Existing ConversationPoller exercised in Node with controlled visibility/focus inputs and real HTTP.",
          "Does not prove browser DOM, paint, hydration, tab visibility wiring, or frontend behavior.",
          ...(input.manifest.environment.kind === "hosted-test" ? [] : ["Local authenticated results are not hosted acceptance evidence."])] };
    } });
  } catch (error) { runError = safeCode(error); }
  finally {
    try { await stopAndDrain(); } catch { runError ??= "closed_loop_requests_did_not_drain"; }
    try { if (db && !databaseCloseDeferredUntilPollsComplete) db.close(); } catch { runError ??= "closed_loop_database_close_failed"; }
    if (sessions) {
      try { cleanup = await sessions.cleanup(); }
      catch { cleanup = { ok: false, attempted: 0, revoked: 0, unresolved: 10, errors: [{ code: "cleanup_report_unavailable", actorHash: "" }] }; }
    }
  }
  const cleanupOk = cleanup.ok === true && cleanup.unresolved === 0 && cleanup.errors.length === 0 && cleanup.attempted === cleanup.revoked;
  const probeFailureCode = result && typeof result.probeFailureCode === "string" ? result.probeFailureCode : undefined;
  const receipt = { schemaVersion: 1, runId: input.manifest.runId, evidenceScope: input.manifest.executionMode ?? input.manifest.environment.kind,
    ok: !runError && !probeFailureCode && cleanupOk && result !== undefined, failureCode: runError ?? probeFailureCode ?? null, cleanup: { ok: cleanupOk,
      attempted: cleanup.attempted, revoked: cleanup.revoked, unresolved: cleanup.unresolved }, ...(result ?? {}),
    drainTimedOut, residualInFlightAtDeadline, residualInFlightAtReceipt: residualCountAtReceipt(), databaseCloseDeferredUntilPollsComplete };
  if (guardAccepted) {
    await mkdir(input.outputDirectory, { recursive: true });
    await writeFile(join(input.outputDirectory, `closed-loop-${input.manifest.runId}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  }
  return receipt;
}
