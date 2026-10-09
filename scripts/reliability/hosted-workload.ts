import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { runWithTargetGuard } from "./contracts/target-manifest.mjs";
import { buildMixedWorkloadSchedule, WORKLOAD } from "./contracts/workload-schedule.mjs";
import { reconcileRun } from "./contracts/result-reconciliation.mjs";
import { hostedTargetHash, type HostedFixture, type HostedManifest, type HostedObserved } from "./hosted-seed";

export type SessionCleanupReceipt = { ok: boolean; attempted: number; revoked: number; unresolved: number; errors: Array<{ code: string; actorHash: string }> };
export type HostedSessions = { createSession(actorHash: string): Promise<unknown>;
  fetchAuthenticated(handle: unknown, url: string, init?: RequestInit): Promise<Response>;
  cleanup(): Promise<SessionCleanupReceipt>; getMetrics(): unknown };
type HostedInput = { manifest: HostedManifest; observed: HostedObserved; fixture: HostedFixture; tasksUrl: string; tasksToken: string;
  executionAuthorized: boolean; createSessions: () => Promise<HostedSessions> | HostedSessions; outputDirectory: string };
type Slot = ReturnType<typeof buildMixedWorkloadSchedule>["events"][number];
type Observation = { logicalOperationId: string; attemptId: string; attemptNumber: number; journey: string; phase: string; latencyMs: number;
  serverTiming?: ReturnType<typeof parseHostedServerTiming>;
  response: { statusCode: number; valid: boolean; success: boolean; errorEnvelope: boolean }; acknowledged: boolean;
  scopeAuthorized: boolean; actualProjectIds: string[]; unauthorizedContent: boolean; effectIds: string[]; bytes: number; finishedAtMs: number; errorCode?: string;
  httpResponseObserved?: boolean; failureStage?: HostedAttemptStage; causeCategory?: HostedAttemptCauseCategory; causeCode?: HostedLibsqlCauseCode };
type Expected = { id: string; journey: string; expectedOutcome: "write" | "read"; projectId: string };
type Envelope = { ok: boolean; value?: Record<string, unknown>; code?: string };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const ERROR_CODES = new Set(["unavailable", "unauthenticated", "temporarily_unavailable", "audience_changed", "read_only", "invalid_input", "revision_conflict", "request_conflict", "rate_limited", "archived"]);

/** Deliberately accepts a bounded subset; descriptions and unknown metric names never enter evidence. */
export function parseHostedServerTiming(header: string | null): {
  status: "absent" | "parsed" | "rejected"; durationsMs: Partial<Record<"analytics" | "total", number>>;
} {
  if (header === null) return { status: "absent", durationsMs: {} };
  const rejected = { status: "rejected" as const, durationsMs: {} };
  if (!header.trim() || header.length > 2_048 || /[\r\n]/.test(header)) return rejected;
  const metrics = header.split(",");
  if (metrics.length > 32) return rejected;
  const durationsMs: Partial<Record<"analytics" | "total", number>> = {};
  for (const metric of metrics) {
    const match = /^\s*([A-Za-z][A-Za-z0-9_-]{0,63})\s*;\s*dur=([0-9]{1,12}(?:\.[0-9]{1,6})?)\s*(?:;\s*desc="[^"\\,\r\n]{0,128}"\s*)?$/.exec(metric);
    if (!match) return rejected;
    const name = match[1];
    if (name !== "analytics" && name !== "total") continue;
    if (durationsMs[name] !== undefined) return rejected;
    durationsMs[name] = Number(match[2]);
  }
  return { status: "parsed", durationsMs };
}

export function hostedMeasurementAttribution(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("hosted_measurement_elapsed_invalid");
  const repetitionMs = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const plannedMs = WORKLOAD.repetitions * repetitionMs;
  let warmupMs = 0; let measuredMs = 0;
  for (let repetition = 0; repetition < WORKLOAD.repetitions; repetition++) {
    const reached = Math.max(0, Math.min(repetitionMs, elapsedMs - repetition * repetitionMs));
    warmupMs += Math.min(WORKLOAD.warmupMs, reached);
    measuredMs += Math.max(0, reached - WORKLOAD.warmupMs);
  }
  const activeSessions = WORKLOAD.sessions.chat + WORKLOAD.sessions.browsing;
  return {
    controlledIdentities: 2, configuredSessions: activeSessions + WORKLOAD.sessions.hidden, scheduledActiveSessions: activeSessions,
    plannedWindowMs: { warmup: WORKLOAD.repetitions * WORKLOAD.warmupMs, measured: WORKLOAD.repetitions * WORKLOAD.measuredMs, total: plannedMs },
    observedElapsedMs: elapsedMs, reachedWindowMs: { warmup: warmupMs, measured: measuredMs, total: warmupMs + measuredMs },
    overrunMs: Math.max(0, elapsedMs - plannedMs),
    scheduledActiveSessionHours: { warmup: activeSessions * warmupMs / 3_600_000, measured: activeSessions * measuredMs / 3_600_000 },
    denominatorScope: "Scheduled windows intersected with elapsed monotonic runtime; setup, cleanup and overrun excluded. Session-hours are not distinct-user hours; interrupted runs use only reached windows.",
    metricScope: {
      latencyMs: "Client elapsed HTTP time including response body; not server execution duration",
      serverTiming: "Optional allowlisted Server-Timing durations: analytics = calculation, total = route; partial coverage, neither is asserted to be DB time or billed execution",
      bytes: "Observed response-body bytes, not total wire transfer or request bytes",
      verificationQueries: "Harness reconciliation queries only; not application DB operation count",
      applicationDbOperations: "unavailable", applicationDbDurationMs: "unavailable", billedExecutionDurationMs: "unavailable",
    },
  };
}

export type HostedWindowTiming = {
  repetition: number; startedAtMs: number; plannedEndAtMs: number; activeEndedAtMs: number;
  boundary?: { drainStartedAtMs: number; drainFinishedAtMs: number; flushStartedAtMs?: number;
    reconciliationFinishedAtMs?: number; flushReturnedAtMs?: number; flushFailedAtMs?: number; nextAnchorAtMs?: number };
};

/** Wall time and offered-load time are separate: reconciliation never earns active-session hours. */
export function hostedMeasurementAttributionFromWindows(wallElapsedMs: number, windows: HostedWindowTiming[],
  finalization: { finalDrainMs: number; finalReconciliationMs: number; sessionCleanupMs: number }) {
  if (!Number.isFinite(wallElapsedMs) || wallElapsedMs < 0) throw new Error("hosted_measurement_elapsed_invalid");
  let warmupMs = 0; let measuredMs = 0; let boundaryPausedMs = 0;
  for (const window of windows) {
    const reached = Math.max(0, Math.min(WORKLOAD.warmupMs + WORKLOAD.measuredMs, window.activeEndedAtMs - window.startedAtMs));
    warmupMs += Math.min(WORKLOAD.warmupMs, reached);
    measuredMs += Math.max(0, reached - WORKLOAD.warmupMs);
    if (window.boundary) boundaryPausedMs += Math.max(0,
      (window.boundary.nextAnchorAtMs ?? window.boundary.flushReturnedAtMs ?? window.boundary.flushFailedAtMs ?? window.boundary.reconciliationFinishedAtMs ??
        window.boundary.flushStartedAtMs ?? window.boundary.drainFinishedAtMs) - window.activeEndedAtMs);
  }
  const base = hostedMeasurementAttribution(0);
  const activeSessions = WORKLOAD.sessions.chat + WORKLOAD.sessions.browsing;
  const reachedTotalMs = warmupMs + measuredMs;
  const { finalDrainMs, finalReconciliationMs, sessionCleanupMs } = finalization;
  for (const duration of [finalDrainMs, finalReconciliationMs, sessionCleanupMs])
    if (!Number.isFinite(duration) || duration < 0) throw new Error("hosted_measurement_elapsed_invalid");
  return { ...base, observedElapsedMs: wallElapsedMs,
    reachedWindowMs: { warmup: warmupMs, measured: measuredMs, total: reachedTotalMs },
    boundaryPausedMs, finalDrainMs, finalReconciliationMs, sessionCleanupMs,
    overrunMs: Math.max(0, wallElapsedMs - reachedTotalMs - boundaryPausedMs - finalDrainMs - finalReconciliationMs - sessionCleanupMs),
    scheduledActiveSessionHours: { warmup: activeSessions * warmupMs / 3_600_000, measured: activeSessions * measuredMs / 3_600_000 },
    denominatorScope: "Actual repetition-local scheduled windows reached before abort, excluding boundary drain/reconciliation, final drain/reconciliation and session cleanup; session-hours are not distinct-user hours." };
}

export function sessionCleanupAccepted(receipt: SessionCleanupReceipt) {
  return receipt.ok === true && receipt.unresolved === 0 && receipt.errors.length === 0 &&
    Number.isSafeInteger(receipt.attempted) && receipt.attempted === 10 && receipt.revoked === 10;
}

export function dryRunHostedWorkload(manifest: HostedManifest, fixture: HostedFixture) {
  const schedule = buildMixedWorkloadSchedule();
  if (!fixture || fixture.fixtureNamespace !== manifest.fixtureNamespace || fixture.actors.length !== 2 || fixture.rooms.length !== 10) throw new Error("hosted_fixture_manifest_mismatch");
  if (Object.entries(fixture.counts).some(([key, count]) => count !== ({ projects: 10, tasks: 1_000, messages: 10_000, resources: 500 } as Record<string, number>)[key])) throw new Error("hosted_fixture_counts_mismatch");
  for (const room of fixture.rooms) {
    if (!room.projectId.startsWith(`${fixture.fixtureNamespace}_project_`) || !room.sourceMessageId || !room.conversationId || room.audienceEpoch < 1) throw new Error("hosted_fixture_scope_invalid");
  }
  if (!Array.isArray(fixture.rooms[0].unusedSourceMessageIds) || fixture.rooms[0].unusedSourceMessageIds.length < schedule.events.filter((event) => event.journey === "task.mutate").length) throw new Error("hosted_unused_source_pool_insufficient");
  const manifestActorHashes = new Set((manifest.testActors ?? []).map((actor: { actorHash: string }) => actor.actorHash));
  if (!fixture.actors.every((actor) => manifestActorHashes.has(actor.actorHash))) throw new Error("hosted_fixture_actor_unattested");
  return { schedule, executionMode: `${manifest.environment.kind}-arrival-schedule`, noNetworkRequests: true,
    limitations: ["API task.mutate is message-to-task outcome creation; ordinary task update/complete requires separate browser proof", "HTML route latency includes server render, excludes browser paint/hydration", "chat.poll uses verified incremental cursors with bounded nominal-request overlap; existing client poller closed-loop behavior requires separate probe"] };
}

export async function boundedResponseText(response: Response, maximumBytes = 4_000_000) {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytes: 0 };
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximumBytes) { await reader.cancel(); throw new Error("hosted_response_size_cap_exceeded"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return { text: new TextDecoder().decode(joined), bytes };
}

export function validateHostedHtml(journey: string, text: string, projectName: string) {
  const markers: Record<string, string[]> = {
    "home.read": ["Home · Signal Studio", 'id="my-tasks"'], "files.read": ["Files · Signal Studio", ">Files</h1>"],
    "analytics.read": ["Analytics · Signal Studio", 'id="an-status"'], "conversation.list": ["Chat · Signal Studio", 'id="app-main-content"'],
  };
  const unavailable = /Chat is unavailable|No project open|Project unavailable|NEXT_HTTP_ERROR_FALLBACK|NEXT_REDIRECT|Application error:|"digest":"[0-9]+"/.test(text);
  return !unavailable && Boolean(markers[journey]?.every((marker) => text.includes(marker))) && text.includes(projectName);
}

export function validateHostedEnvelope(action: string, raw: unknown): raw is Envelope {
  if (!object(raw) || typeof raw.ok !== "boolean") return false;
  if (!raw.ok) return typeof raw.code === "string" && ERROR_CODES.has(raw.code);
  if (!object(raw.value)) return false;
  if (action === "send") return typeof raw.value.messageId === "string" && Number.isSafeInteger(raw.value.createSeq) && Number.isSafeInteger(raw.value.changeSeq);
  if (action === "promote-task") return typeof raw.value.taskId === "string" && typeof raw.value.workLinkId === "string";
  if (action === "history" || action === "messages") return Array.isArray(raw.value.messages) && raw.value.messages.every((message) => object(message) && typeof message.id === "string") && Number.isSafeInteger(raw.value.throughChangeSeq);
  return false;
}

type MessageScope = { projectId: string; conversationId: string };
type MessageScopeRow = { id: unknown; workspace_id: unknown; conversation_id: unknown; client_request_id: unknown; author_id: unknown };
class HostedHistoryLookupUnverified extends Error {
  constructor(readonly safeCauseCategory: HostedAttemptCauseCategory, readonly safeCauseCode?: HostedLibsqlCauseCode) {
    super("hosted_history_scope_unverified");
  }
}
type VisibilitySample = { repetition: number; initiationMs: number; postAckMs: number; priorToAck: boolean };
type InFlightSend = { actorHash: string; actorId: string; began: number; repetition: number; measured: boolean };
type PendingSend = InFlightSend & { acknowledgedAt: number };

/** Joins a history sighting to its send even when history wins the post-ack DB readback race. */
export class HostedMessageVisibility {
  readonly authorizedMessages = new Map<string, MessageScope>();
  readonly pendingVisibility = new Map<string, PendingSend>();
  readonly visibilitySamples: VisibilitySample[] = [];
  private readonly inFlightSends = new Map<string, InFlightSend>();
  private readonly earlySightings = new Map<string, { requestId: string; byActor: Map<string, number> }>();
  private readonly discoveredSendRequests = new Map<string, { requestId: string; authorId: string }>();
  private readonly finalizedVisibility = new Map<string, { pending: PendingSend; seenAt: number; sampleIndex: number | null }>();

  constructor(rows: Iterable<Record<string, unknown>> = []) {
    this.loadAuthorized(rows);
  }

  loadAuthorized(rows: Iterable<Record<string, unknown>>) {
    for (const row of rows) this.authorizedMessages.set(String(row.id),
      { projectId: String(row.workspace_id), conversationId: String(row.conversation_id) });
  }

  beginSend(requestId: string, send: InFlightSend) {
    if (this.inFlightSends.has(requestId) || this.inFlightSends.size >= 16) throw new Error("hosted_duplicate_or_excess_in_flight_send");
    this.inFlightSends.set(requestId, send);
  }

  cancelSend(requestId: string) {
    this.inFlightSends.delete(requestId);
    for (const [id, sighting] of this.earlySightings) if (sighting.requestId === requestId) this.earlySightings.delete(id);
    for (const [id, send] of this.discoveredSendRequests) if (send.requestId === requestId) this.discoveredSendRequests.delete(id);
  }

  private recordVisibility(messageId: string, pending: PendingSend, seenAt: number) {
    const finalized = this.finalizedVisibility.get(messageId);
    if (finalized && seenAt >= finalized.seenAt) return;
    const sample: VisibilitySample = { repetition: pending.repetition,
      initiationMs: Math.max(0, seenAt - pending.began), postAckMs: Math.max(0, seenAt - pending.acknowledgedAt),
      priorToAck: seenAt < pending.acknowledgedAt };
    if (finalized) {
      finalized.seenAt = seenAt;
      if (finalized.sampleIndex !== null) this.visibilitySamples[finalized.sampleIndex] = sample;
      return;
    }
    if (this.finalizedVisibility.size >= 512) throw new Error("hosted_visibility_capacity_exceeded");
    const sampleIndex = pending.measured ? this.visibilitySamples.length : null;
    if (sampleIndex !== null) this.visibilitySamples.push(sample);
    this.finalizedVisibility.set(messageId, { pending, seenAt, sampleIndex });
  }

  confirmSend(requestId: string, messageId: string, acknowledgedAt: number, scope: MessageScope) {
    const send = this.inFlightSends.get(requestId);
    if (!send || !Number.isFinite(acknowledgedAt)) throw new Error("hosted_send_visibility_untracked");
    this.authorizedMessages.set(messageId, scope);
    const pending = { ...send, acknowledgedAt };
    const sighting = this.earlySightings.get(messageId);
    const observed = sighting?.requestId === requestId
      ? [...sighting.byActor].filter(([actorHash, at]) => actorHash !== send.actorHash && at >= send.began).map(([, at]) => at)
      : [];
    if (observed.length) this.recordVisibility(messageId, pending, Math.min(...observed));
    else this.pendingVisibility.set(messageId, pending);
    this.earlySightings.delete(messageId);
    this.discoveredSendRequests.delete(messageId);
    this.inFlightSends.delete(requestId);
  }

  /** Unknown IDs are looked up before classification; missing/error means unverified, never foreign. */
  async observeHistory(ids: string[], actorHash: string, receivedAt: number, scope: MessageScope,
    lookup: (ids: string[]) => Promise<MessageScopeRow[]>) {
    if (ids.length > 100 || !Number.isFinite(receivedAt)) throw new Error("hosted_history_scope_unverified");
    const unknown = [...new Set(ids)].filter((id) => !this.authorizedMessages.has(id));
    const discovered = new Map<string, MessageScopeRow>();
    if (unknown.length) {
      let rows: MessageScopeRow[];
      try { rows = await lookup(unknown); }
      catch (error) {
        const diagnostic = hostedAttemptDiagnostic(error, "history_lookup_sql");
        throw new HostedHistoryLookupUnverified(diagnostic.causeCategory, diagnostic.causeCode);
      }
      if (!Array.isArray(rows)) throw new Error("hosted_history_scope_unverified");
      for (const row of rows) {
        if (typeof row.id !== "string" || !unknown.includes(row.id) || discovered.has(row.id) ||
            typeof row.workspace_id !== "string" || typeof row.conversation_id !== "string" ||
            typeof row.client_request_id !== "string" || typeof row.author_id !== "string")
          throw new Error("hosted_history_scope_unverified");
        discovered.set(row.id, row);
      }
      if (discovered.size !== unknown.length) throw new Error("hosted_history_scope_unverified");
      for (const row of discovered.values()) {
        this.authorizedMessages.set(row.id as string,
          { projectId: row.workspace_id as string, conversationId: row.conversation_id as string });
        if (this.inFlightSends.has(row.client_request_id as string)) this.discoveredSendRequests.set(row.id as string,
          { requestId: row.client_request_id as string, authorId: row.author_id as string });
      }
    }
    const known = ids.map((id) => this.authorizedMessages.get(id));
    const actualProjectIds = [...new Set(known.map((row) => row!.projectId))];
    const scopeAuthorized = known.every((row) => row?.projectId === scope.projectId && row.conversationId === scope.conversationId);
    if (scopeAuthorized) for (const id of ids) {
      const pending = this.pendingVisibility.get(id);
      if (pending && pending.actorHash !== actorHash && receivedAt >= pending.began) {
        this.recordVisibility(id, pending, receivedAt);
        this.pendingVisibility.delete(id);
        continue;
      }
      const finalized = this.finalizedVisibility.get(id);
      if (finalized && finalized.pending.actorHash !== actorHash && receivedAt >= finalized.pending.began) {
        this.recordVisibility(id, finalized.pending, receivedAt);
        continue;
      }
      const source = this.discoveredSendRequests.get(id);
      const requestId = source?.requestId;
      const send = requestId ? this.inFlightSends.get(requestId) : undefined;
      if (requestId && send && send.actorHash !== actorHash && send.actorId === source?.authorId && receivedAt >= send.began) {
        let sighting = this.earlySightings.get(id);
        if (!sighting) { sighting = { requestId, byActor: new Map() }; this.earlySightings.set(id, sighting); }
        const prior = sighting.byActor.get(actorHash);
        if (prior === undefined || receivedAt < prior) sighting.byActor.set(actorHash, receivedAt);
      }
    }
    return { actualProjectIds, scopeAuthorized, unauthorizedContent: !scopeAuthorized };
  }
}

/** Every page is verified even when a later request has already published a newer cursor. */
export async function observeHostedPollHistory(input: {
  visibility: HostedMessageVisibility; ids: string[]; actorHash: string; receivedAt: number; scope: MessageScope;
  lookup: (ids: string[]) => Promise<MessageScopeRow[]>; cursors: Map<string, number>; sessionId: string;
  requestedCursor: number; throughChangeSeq: number;
}) {
  if (!Number.isSafeInteger(input.throughChangeSeq) || input.throughChangeSeq < input.requestedCursor)
    throw new Error("hosted_history_scope_unverified");
  const history = await input.visibility.observeHistory(input.ids, input.actorHash, input.receivedAt, input.scope, input.lookup);
  if (history.scopeAuthorized)
    input.cursors.set(input.sessionId, Math.max(input.cursors.get(input.sessionId) ?? 0, input.throughChangeSeq));
  return history;
}

export function committedEffectMatchesScope(action: string, rows: ReadonlyArray<Record<string, unknown>>, scope: MessageScope) {
  return (action === "send" || action === "promote-task") && rows.length === 1 && rows[0].workspace_id === scope.projectId &&
    (action !== "send" || rows[0].conversation_id === scope.conversationId);
}

export function classifyCommittedScope(action: string, rows: ReadonlyArray<Record<string, unknown>>, scope: MessageScope) {
  return { actualProjectIds: rows.map((row) => String(row.workspace_id)),
    scopeAuthorized: committedEffectMatchesScope(action, rows, scope),
    unauthorizedContent: rows.some((row) => row.workspace_id !== scope.projectId ||
      (action === "send" && row.conversation_id !== scope.conversationId)) };
}

export type HostedPromotionProofInput = {
  actorId: string; clientRequestId: string; projectId: string; conversationId: string; messageId: string;
  expectedRevision: number; expectedAudienceEpoch: number; destinationProjectId: string;
  title: string; ownerUserId: string; dueDate: string;
};
export function hostedPromotionIdentity(input: HostedPromotionProofInput) {
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const taskId = `t-${hash(["conversation_task", input.actorId, input.clientRequestId]).slice(0, 24)}`;
  const workLinkId = `work-${hash([taskId, input.messageId, input.expectedRevision]).slice(0, 24)}`;
  return { taskId, workLinkId, eventId: `event-${hash(["conversation_task", taskId]).slice(0, 24)}`,
    payloadHash: hash(["conversation_task_v1", input.actorId, input.clientRequestId, input.projectId,
      input.conversationId, input.messageId, input.expectedRevision, input.expectedAudienceEpoch,
      input.destinationProjectId, input.title.replace(/\r\n?/g, "\n"), input.ownerUserId, input.dueDate]) };
}
/** One atomic read batch includes deterministic orphan effects; joins cannot hide partial or mismatched writes. */
export async function readHostedPromotionScope(client: Pick<Client, "batch">, input: HostedPromotionProofInput, allowAbsent: boolean) {
  const identity = hostedPromotionIdentity(input);
  const receiptPredicate = "actor_id=? AND client_request_id=? AND operation='conversation_task'";
  const results = await client.batch([
    { sql: `SELECT * FROM work_operation_receipts WHERE (${receiptPredicate}) OR task_id=? OR work_link_id=? LIMIT 3`,
      args: [input.actorId, input.clientRequestId, identity.taskId, identity.workLinkId] },
    { sql: `SELECT id,workspace_id,title,assignees,due FROM tasks WHERE id=? OR id IN (SELECT task_id FROM work_operation_receipts WHERE ${receiptPredicate}) LIMIT 3`,
      args: [identity.taskId, input.actorId, input.clientRequestId] },
    { sql: `SELECT * FROM work_links WHERE id=? OR task_id=? OR id IN (SELECT work_link_id FROM work_operation_receipts WHERE ${receiptPredicate}) LIMIT 3`,
      args: [identity.workLinkId, identity.taskId, input.actorId, input.clientRequestId] },
    { sql: "SELECT id,event_id,version,type,actor_user_id,workspace_id,object_ref,trace_id FROM suite_outbox WHERE id=? OR trace_id=? OR json_extract(object_ref, '$.taskId')=? LIMIT 3",
      args: [identity.eventId, input.clientRequestId, identity.taskId] },
  ], "read");
  if (!Array.isArray(results) || results.length !== 4 || results.some(result => !result || !Array.isArray(result.rows))) throw new Error("hosted_write_effect_unverified");
  const [receipts, tasks, links, outbox] = results.map(result => result.rows);
  const actualProjectIds = [...new Set([
    ...receipts.flatMap(row => [String(row.source_project_id), String(row.destination_project_id)]),
    ...tasks.map(row => String(row.workspace_id)),
    ...links.flatMap(row => [String(row.source_project_id), String(row.destination_project_id)]),
    ...outbox.map(row => String(row.workspace_id)),
  ])];
  const effectIds = tasks.map(row => String(row.id));
  if (results.every(result => result.rows.length === 0)) return {
    scopeAuthorized: allowAbsent, actualProjectIds, unauthorizedContent: false, effectIds,
  };
  const foreign = actualProjectIds.some(id => id !== input.projectId && id !== input.destinationProjectId);
  if (results.some(result => result.rows.length !== 1)) return {
    scopeAuthorized: false, actualProjectIds, unauthorizedContent: foreign, effectIds,
  };
  const [receipt, task, link, event] = [receipts[0], tasks[0], links[0], outbox[0]];
  const matches = receipt.actor_id === input.actorId && receipt.client_request_id === input.clientRequestId &&
    receipt.operation === "conversation_task" && receipt.payload_hash === identity.payloadHash &&
    receipt.source_project_id === input.projectId && receipt.source_conversation_id === input.conversationId &&
    receipt.destination_project_id === input.destinationProjectId && receipt.task_id === identity.taskId && receipt.work_link_id === identity.workLinkId &&
    task.id === identity.taskId && task.workspace_id === input.destinationProjectId && task.title === input.title &&
    task.assignees === JSON.stringify([input.ownerUserId]) && task.due === input.dueDate &&
    link.id === identity.workLinkId && link.task_id === identity.taskId && link.source_project_id === input.projectId &&
    link.source_conversation_id === input.conversationId && link.source_message_id === input.messageId &&
    Number(link.source_revision) === input.expectedRevision && Number(link.source_audience_epoch) === input.expectedAudienceEpoch &&
    link.destination_project_id === input.destinationProjectId && link.created_by === input.actorId &&
    event.id === identity.eventId && event.event_id === identity.eventId && Number(event.version) === 1 &&
    event.type === "task.created" && event.actor_user_id === input.actorId && event.workspace_id === input.destinationProjectId &&
    event.trace_id === input.clientRequestId && event.object_ref === JSON.stringify({ taskId: identity.taskId, workLinkId: identity.workLinkId });
  return { scopeAuthorized: matches, actualProjectIds, unauthorizedContent: !matches, effectIds };
}

function requestForSlot(slot: Slot, room: HostedFixture["rooms"][number], fixture: HostedFixture, origin: string) {
  const clientRequestId = `${fixture.fixtureNamespace.slice(0, 60)}_${slot.repetition}_${slot.sessionId}_${slot.journey.replaceAll(".", "_")}_${slot.atMs}`;
  const query = new URLSearchParams({ projectId: room.projectId, conversationId: room.conversationId });
  const common = { projectId: room.projectId, conversationId: room.conversationId, clientRequestId, expectedAudienceEpoch: room.audienceEpoch };
  if (slot.journey === "chat.send") return { action: "send", clientRequestId, url: `${origin}/api/conversations`, body: { ...common, action: "send", body: "Synthetic measured update", rootId: null, mentionUserIds: [] } };
  if (slot.journey === "task.mutate") return { action: "promote-task", clientRequestId, url: `${origin}/api/conversations`, body: { ...common, action: "promote-task", messageId: room.sourceMessageId,
    expectedRevision: 1, destinationProjectId: room.projectId, title: "Synthetic measured task", ownerUserId: fixture.actors[1].actorId, dueDate: "2026-10-25" } };
  if (slot.journey === "chat.poll") { query.set("action", "history"); query.set("afterChangeSeq", "0"); return { action: "history", clientRequestId, url: `${origin}/api/conversations?${query}`, body: null }; }
  const paths: Record<string, string> = { "conversation.list": `/app/messages?projectId=${encodeURIComponent(room.projectId)}`,
    "home.read": `/app/home?workspaceId=${encodeURIComponent(room.projectId)}`, "files.read": `/app/files?workspaceId=${encodeURIComponent(room.projectId)}`,
    "analytics.read": `/app/analytics?workspaceId=${encodeURIComponent(room.projectId)}` };
  return { action: "html", clientRequestId, url: origin + paths[slot.journey], body: null };
}

/** Resolve each acknowledged logical write through the exact committed source and request receipt. */
export async function reconcileHostedEffects(client: Client, observations: Observation[], requests: Map<string, { actorId: string; requestId: string; conversationId: string; projectId: string; task: boolean }>) {
  let verificationQueries = 0;
  for (const [id, request] of requests) {
    const attempts = observations.filter((observation) => observation.logicalOperationId === id);
    if (!attempts.some((observation) => observation.acknowledged)) continue;
    verificationQueries++;
    const result = request.task ? await client.execute({ sql: `SELECT t.id,t.workspace_id FROM work_operation_receipts r JOIN tasks t ON t.id=r.task_id JOIN work_links l ON l.id=r.work_link_id AND l.task_id=t.id
      WHERE r.actor_id=? AND r.client_request_id=? AND r.source_conversation_id=?`, args: [request.actorId, request.requestId, request.conversationId] }) :
      await client.execute({ sql: `SELECT m.id,m.workspace_id FROM conversation_receipts r JOIN conversation_messages m ON m.id=r.message_id AND m.conversation_id=r.conversation_id
        WHERE r.actor_id=? AND r.client_request_id=? AND r.conversation_id=? AND r.operation='send'`, args: [request.actorId, request.requestId, request.conversationId] });
    const effectIds = result.rows.map((row) => String(row.id));
    const actualProjectIds = result.rows.map((row) => String(row.workspace_id));
    for (const attempt of attempts) { attempt.effectIds = effectIds; attempt.actualProjectIds = actualProjectIds; }
  }
  return verificationQueries;
}

type HostedReconciliation = { ok: boolean; findings: Array<{ code: string; detail: string }> };
type HostedFlushPhase = "receipt_reconciliation" | "metric_computation" | "receipt_persistence" | "unclassified";
type HostedCauseCategory = "transport" | "timeout" | "filesystem" | "contract" | "unclassified";
type HostedAttemptStage = "app_request" | "response_body" | "response_validation" |
  "history_lookup_sql" | "history_scope_validation" | "write_effect_sql";
type HostedAttemptCauseCategory = "transport" | "timeout" | "verification" | "response" | "unclassified";
const LIBSQL_CAUSE_CODES = ["HRANA_PROTO_ERROR", "HRANA_CLOSED_ERROR", "HRANA_WEBSOCKET_ERROR", "SERVER_ERROR",
  "PROTOCOL_VERSION_ERROR", "INTERNAL_ERROR", "TRANSACTION_CLOSED", "SQLITE_BUSY", "DATABASE_BUSY", "UNKNOWN"] as const;
type HostedLibsqlCauseCode = typeof LIBSQL_CAUSE_CODES[number];
type HostedFlushDiagnostic = { phase: HostedFlushPhase; causeCategory: HostedCauseCategory };
class HostedFlushFailure extends Error {
  constructor(readonly diagnostic: HostedFlushDiagnostic) { super("hosted_flush_failed"); }
}

/** Use only fixed categories; raw provider errors, messages and URLs never enter receipts. */
export function hostedFlushDiagnostic(error: unknown, phase: HostedFlushPhase = "unclassified"): HostedFlushDiagnostic {
  if (error instanceof HostedFlushFailure) return error.diagnostic;
  const code = object(error) && typeof error.code === "string" ? error.code : "";
  const name = object(error) && typeof error.name === "string" ? error.name : "";
  let causeCategory: HostedCauseCategory = "unclassified";
  if (["ETIMEDOUT", "ESOCKETTIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "TIMEOUT"].includes(code) || name === "TimeoutError") causeCategory = "timeout";
  else if (["ECONNRESET", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "EPIPE", "UND_ERR_SOCKET"].includes(code)) causeCategory = "transport";
  else if (["EEXIST", "ENOSPC", "EACCES", "EPERM", "ENOENT", "EROFS"].includes(code)) causeCategory = "filesystem";
  else if (phase === "metric_computation" && error instanceof Error) causeCategory = "contract";
  return { phase, causeCategory };
}

/** Fixed metadata only; never persist raw provider/SQL errors, URLs or response bodies. */
export function hostedAttemptDiagnostic(error: unknown, stage: HostedAttemptStage):
  { failureStage: HostedAttemptStage; causeCategory: HostedAttemptCauseCategory; causeCode?: HostedLibsqlCauseCode } {
  if (error instanceof HostedHistoryLookupUnverified)
    return { failureStage: stage, causeCategory: error.safeCauseCategory, ...(error.safeCauseCode ? { causeCode: error.safeCauseCode } : {}) };
  let causeCategory: HostedAttemptCauseCategory = "unclassified";
  let causeCode: HostedLibsqlCauseCode | undefined;
  const seen = new Set<unknown>();
  let current = error;
  // Inspect only the wrapper plus two causes; never serialize provider strings, SQL, URLs or stacks.
  for (let depth = 0; depth < 3 && object(current) && !seen.has(current); depth++) {
    seen.add(current);
    const code = typeof current.code === "string" ? current.code : "";
    const name = typeof current.name === "string" ? current.name : "";
    causeCode ??= LIBSQL_CAUSE_CODES.find(allowed => allowed === code);
    if (["ETIMEDOUT", "ESOCKETTIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "TIMEOUT", "APPLICATION_REQUEST_TIMEOUT"].includes(code) || name === "TimeoutError") causeCategory = "timeout";
    else if (causeCategory === "unclassified" && ["ECONNRESET", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "EPIPE", "UND_ERR_SOCKET", "APPLICATION_REQUEST_FAILED"].includes(code)) causeCategory = "transport";
    else if (causeCategory === "unclassified" && code === "APPLICATION_RESPONSE_BODY_FAILED") causeCategory = "response";
    current = current.cause;
  }
  if (causeCategory === "unclassified" && ["history_lookup_sql", "history_scope_validation", "write_effect_sql"].includes(stage)) causeCategory = "verification";
  else if (causeCategory === "unclassified" && ["response_body", "response_validation"].includes(stage)) causeCategory = "response";
  return { failureStage: stage, causeCategory, ...(causeCode ? { causeCode } : {}) };
}

export function hostedFailureResponse(observedStatus: number | undefined, observedValid: boolean,
  observedAppSuccess = false): Observation["response"] {
  return { statusCode: observedStatus ?? 503, valid: observedStatus === undefined || observedValid,
    success: observedStatus === 200 && observedValid && observedAppSuccess,
    errorEnvelope: observedStatus === undefined };
}
/** Route acknowledgement and local verification are separate facts. */
export function hostedUnverifiedAttemptEvidence(expectedOutcome: "write" | "read",
  observedStatus: number | undefined, observedValid: boolean, observedAppSuccess: boolean) {
  const response = hostedFailureResponse(observedStatus, observedValid, observedAppSuccess);
  return { response, acknowledged: expectedOutcome === "write" && response.success };
}
type HostedBoundaryFailure = { repetition: number; reconciliation: HostedReconciliation;
  kind?: "reconciliation_failed" | "fatal_after_flush" | "flush_threw"; diagnostic?: HostedFlushDiagnostic };

export async function writeHostedUnverifiedFlushDiagnostic(outputDirectory: string, repetition: number,
  stage: "boundary" | "final", diagnostic: Record<string, unknown>) {
  await writeFile(join(outputDirectory, `run-${repetition}-${stage}-failure.json`), JSON.stringify(diagnostic, null, 2), { flag: "wx" });
}

/** A failed boundary already has its immutable run-N receipt. Never flush it again. */
export async function finalizeHostedRepetition(input: {
  repetition: number; fatal: boolean; droppedIterations: number;
  boundaryFailure: HostedBoundaryFailure | null;
  flush: (repetition: number, complete: boolean) => Promise<HostedReconciliation>;
}) {
  if (input.boundaryFailure && (input.boundaryFailure.repetition !== input.repetition || input.boundaryFailure.reconciliation.ok))
    throw new Error("hosted_boundary_failure_invalid");
  const reconciliation = input.boundaryFailure?.reconciliation ??
    await input.flush(input.repetition, !input.fatal && input.repetition === WORKLOAD.repetitions);
  const codes = [...new Set(reconciliation.findings.map((finding) => finding.code))];
  if (!reconciliation.ok && codes.length === 0) codes.push("RECONCILIATION_FAILED");
  if (input.fatal && codes.length === 0) codes.push("FATAL_WORKLOAD_ABORT");
  if (input.repetition !== WORKLOAD.repetitions) codes.push("REPETITIONS_INCOMPLETE");
  if (input.droppedIterations > 0) codes.push("DROPPED_ITERATIONS");
  return { reconciliation, failure: codes.length ? { repetition: input.repetition, codes: [...new Set(codes)] } : null };
}

/** The same arrival loop used by the hosted run, with an injected monotonic clock for bounded offline tests. */
export async function runHostedArrivalSchedule(input: {
  events: readonly Slot[]; startedAt: number; now: () => number; sleep: (ms: number) => Promise<void>;
  perform: (slot: Slot) => Promise<void>; flush: (repetition: number, timing: HostedWindowTiming, droppedIterations: number) => Promise<HostedReconciliation>;
  isFatal: () => boolean;
}) {
  if (input.events.length === 0) throw new Error("hosted_schedule_empty");
  const durationMs = WORKLOAD.warmupMs + WORKLOAD.measuredMs;
  const inFlight = new Set<Promise<void>>();
  const windows: HostedWindowTiming[] = [];
  const elapsed = () => input.now() - input.startedAt;
  const waitUntil = async (target: number) => {
    while (input.now() < target) await input.sleep(Math.min(target - input.now(), 60_000));
  };
  let repetition = input.events[0].repetition;
  let anchor = input.startedAt;
  let windowClosed = false;
  let droppedIterations = 0;
  let boundaryFailure: HostedBoundaryFailure | null = null;
  const firstStartedAtMs = 0;
  let timing: HostedWindowTiming = { repetition, startedAtMs: firstStartedAtMs,
    plannedEndAtMs: firstStartedAtMs + durationMs, activeEndedAtMs: firstStartedAtMs };
  windows.push(timing);
  for (const slot of input.events) {
    if (input.isFatal()) break;
    if (slot.repetition !== repetition) {
      // The last admitted slot precedes the 25-minute end. Wait for the whole declared window.
      await waitUntil(anchor + durationMs);
      if (input.isFatal()) break;
      timing.activeEndedAtMs = elapsed();
      windowClosed = true;
      const boundary: NonNullable<HostedWindowTiming["boundary"]> = {
        drainStartedAtMs: elapsed(), drainFinishedAtMs: elapsed(),
      };
      timing.boundary = boundary;
      await Promise.all(inFlight);
      boundary.drainFinishedAtMs = elapsed();
      if (input.isFatal()) break;
      boundary.flushStartedAtMs = elapsed();
      let result: HostedReconciliation;
      try { result = await input.flush(repetition, timing, droppedIterations); }
      catch (error) {
        boundary.flushFailedAtMs = elapsed();
        boundaryFailure = { repetition, kind: "flush_threw", reconciliation: { ok: false,
          findings: [{ code: "BOUNDARY_FLUSH_FAILED", detail: "Boundary reconciliation or receipt persistence failed; effects remain unverified" }] },
          diagnostic: hostedFlushDiagnostic(error) };
        break;
      }
      boundary.flushReturnedAtMs = elapsed();
      if (!result.ok) { boundaryFailure = { repetition, kind: "reconciliation_failed", reconciliation: result }; break; }
      if (input.isFatal()) {
        boundaryFailure = { repetition, kind: "fatal_after_flush", reconciliation: { ok: false,
          findings: [{ code: "FATAL_WORKLOAD_ABORT", detail: "Fatal request result arrived while the boundary flushed" }] } };
        break;
      }
      repetition = slot.repetition;
      anchor = input.now();
      const startedAtMs = anchor - input.startedAt;
      boundary.nextAnchorAtMs = startedAtMs;
      timing = { repetition, startedAtMs, plannedEndAtMs: startedAtMs + durationMs, activeEndedAtMs: startedAtMs };
      windows.push(timing);
      windowClosed = false;
    }
    const localAtMs = slot.atMs - (slot.repetition - 1) * durationMs;
    await waitUntil(anchor + localAtMs);
    if (input.isFatal()) break;
    if (inFlight.size >= 16) { droppedIterations++; continue; }
    const work = input.perform(slot).finally(() => { inFlight.delete(work); });
    inFlight.add(work);
  }
  if (!boundaryFailure && !windowClosed) {
    if (!input.isFatal()) await waitUntil(anchor + durationMs);
    timing.activeEndedAtMs = elapsed();
  }
  const finalDrainStartedAtMs = elapsed();
  await Promise.all(inFlight);
  const finalDrainFinishedAtMs = elapsed();
  return { repetition, boundaryFailure, droppedIterations, windows,
    finalDrainMs: finalDrainFinishedAtMs - finalDrainStartedAtMs,
    finalDrainStartedAtMs, finalDrainFinishedAtMs };
}

/** Execution is dormant until root supplies an attested runtime and explicit authorization. */
export async function runHostedWorkload(input: HostedInput) {
  const dryRun = dryRunHostedWorkload(input.manifest, input.fixture);
  if (!input.executionAuthorized) return dryRun;
  const local = input.manifest.environment.kind === "authenticated-local-test";
  if ((!local && input.manifest.environment.kind !== "hosted-test") || hostedTargetHash(input.tasksUrl) !== input.manifest.expectedTargetHashes.tasks || (local ? !/^file:/i.test(input.tasksUrl) : !/^libsql:\/\//i.test(input.tasksUrl) || !input.tasksToken)) throw new Error("hosted_workload_binding_refused");
  return runWithTargetGuard({ manifest: input.manifest, observed: input.observed, write: async () => {
    await mkdir(input.outputDirectory, { recursive: true });
    const manager = await input.createSessions();
    const client = createClient({ url: input.tasksUrl, ...(local ? {} : { authToken: input.tasksToken }) });
    const observations: Observation[] = [];
    const expectedOperations: Expected[] = [];
    const requests = new Map<string, { actorId: string; requestId: string; conversationId: string; projectId: string; task: boolean }>();
    const handles = new Map<string, unknown>();
    const origin = input.observed.origin;
    let appRequests = 0; let droppedIterations = 0; let fatal = false;
    let start = 0;
    const cursors = new Map<string, number>();
    const visibility = new HostedMessageVisibility();
    const { pendingVisibility, visibilitySamples } = visibility;
    let verificationQueries = 0;
    let mutationSourceIndex = 0;
    let negativeScopeProof = false;
    let summary: { completed: boolean; failure: { repetition: number; codes: string[] } | null; appRequests: number; actualAppTransportRequests: number; droppedIterations: number; outputDirectory: string; identityTraffic: unknown; sessionCleanup?: SessionCleanupReceipt;
      windowTimings: HostedWindowTiming[]; boundaryDiagnosticPersisted?: boolean; finalDiagnosticPersisted?: boolean;
      flushFailureDiagnostic?: HostedFlushDiagnostic;
      measurementAttribution: ReturnType<typeof hostedMeasurementAttributionFromWindows> } | undefined;
    let windowTimings: HostedWindowTiming[] = [];
    let finalDrainMs = 0;
    let finalReconciliationMs = 0;
    const flush = async (repetition: number, complete: boolean, timing?: HostedWindowTiming) => {
      let phase: HostedFlushPhase = "receipt_reconciliation";
      try {
      const current = observations.filter((observation) => observation.logicalOperationId.startsWith(`${repetition}:`));
      verificationQueries += await reconcileHostedEffects(client, current, requests);
      phase = "metric_computation";
      const expected = expectedOperations.filter((operation) => operation.id.startsWith(`${repetition}:`));
      const correctness = reconcileRun({ manifest: { ...input.manifest, measuredDurationSeconds: (WORKLOAD.warmupMs + WORKLOAD.measuredMs) / 1_000 }, observations: current, expectedOperations: expected,
        scheduledRequestCount: dryRun.schedule.events.filter((event) => event.repetition === repetition).length, requestCap: WORKLOAD.totalRequestCap });
      const measured = current.filter((observation) => observation.phase === "measured");
      const measuredIds = new Set(measured.map((observation) => observation.logicalOperationId));
      const reconciliation = reconcileRun({ manifest: { ...input.manifest, measuredDurationSeconds: WORKLOAD.measuredMs / 1_000 }, observations: measured,
        expectedOperations: expected.filter((operation) => measuredIds.has(operation.id)), scheduledRequestCount: dryRun.schedule.events.filter((event) => event.repetition === repetition && event.phase === "measured").length,
        requestCap: WORKLOAD.totalRequestCap });
      if (!correctness.ok) reconciliation.findings.push(...correctness.findings);
      const visible = visibilitySamples.filter((sample) => sample.repetition === repetition);
      const waiting = [...pendingVisibility.values()].filter((pending) => pending.repetition === repetition && pending.measured).length;
      if (complete && waiting) reconciliation.findings.push({ code: "MESSAGE_VISIBILITY_MISSING", detail: `${waiting} measured sends have no different-actor observer proof` });
      const sortedVisibility = visible.map((sample) => sample.initiationMs).sort((left, right) => left - right);
      const visibilityP95 = sortedVisibility.length ? sortedVisibility[Math.ceil(sortedVisibility.length * .95) - 1] : null;
      if (visibilityP95 !== null && visibilityP95 > 1_500) reconciliation.findings.push({ code: "MESSAGE_VISIBILITY_LATENCY_BREACH", detail: `observed p95 ${visibilityP95}ms exceeds 1500ms` });
      reconciliation.ok = reconciliation.findings.length === 0;
      const windowTiming = timing ?? windowTimings.find((window) => window.repetition === repetition);
      if (windowTiming?.boundary?.flushStartedAtMs !== undefined) windowTiming.boundary.reconciliationFinishedAtMs = performance.now() - start;
      const receipt = { repetition, complete, acceptancePendingSessionCleanup: true, evidenceScope: input.manifest.executionMode, runtime: input.manifest.runtime,
        appRequests, actualAppTransportRequests: (manager.getMetrics() as { app?: { requests?: number } }).app?.requests ?? 0,
        droppedIterations, verificationQueries, negativeScopeProof, observations: current, reconciliation, allWritesCorrectness: correctness,
        messageVisibility: { samples: visible.length, p95InitiationMs: visibilityP95, missing: waiting, timings: visible },
        windowTiming, identityTraffic: manager.getMetrics(), limitations: dryRun.limitations, runtimeIdentity: input.manifest.environment.identity };
      phase = "receipt_persistence";
      await writeFile(join(input.outputDirectory, `run-${repetition}.json`), JSON.stringify(receipt, null, 2), { flag: "wx" });
      return reconciliation;
      } catch (error) { throw new HostedFlushFailure(hostedFlushDiagnostic(error, phase)); }
    };
    try {
      const projectIds = input.fixture.rooms.map((room) => room.projectId);
      const sourceMessages = await client.execute({ sql: `SELECT id,workspace_id,conversation_id FROM conversation_messages WHERE workspace_id IN (${projectIds.map(() => "?").join(",")})`, args: projectIds });
      verificationQueries++;
      visibility.loadAuthorized(sourceMessages.rows);
      for (const type of ["chat", "browsing", "hidden"]) for (let index = 1; index <= (type === "hidden" ? 2 : 4); index++) {
        handles.set(`${type}-${index}`, await manager.createSession(input.fixture.actors[index % 2].actorHash));
      }
      const deniedRoom = input.fixture.rooms.find((room) => room.projectId === input.fixture.deniedProjectForObserver);
      if (!deniedRoom) throw new Error("negative_scope_fixture_missing");
      appRequests++;
      const deniedUrl = new URL(`${origin}/api/conversations`);
      for (const [key, value] of Object.entries({ action: "history", projectId: deniedRoom.projectId, conversationId: deniedRoom.conversationId, afterChangeSeq: "0" })) deniedUrl.searchParams.set(key, value);
      const deniedResponse = await manager.fetchAuthenticated(handles.get("chat-1"), deniedUrl.href, { redirect: "manual" });
      const deniedBody = await boundedResponseText(deniedResponse);
      const deniedEnvelope: unknown = JSON.parse(deniedBody.text);
      if (deniedResponse.status !== 404 || !object(deniedEnvelope) || deniedEnvelope.ok !== false || deniedEnvelope.code !== "unavailable" || "value" in deniedEnvelope) throw new Error("negative_scope_disclosure_or_effect");
      negativeScopeProof = true;
      start = performance.now();
      async function perform(slot: Slot) {
        const room = input.fixture.rooms[0];
        const request = requestForSlot(slot, room, input.fixture, origin);
        let requestedCursor = 0;
        if (request.action === "promote-task" && request.body && "messageId" in request.body) request.body.messageId = room.unusedSourceMessageIds[mutationSourceIndex++];
        if (request.action === "history") {
          const pollUrl = new URL(request.url);
          requestedCursor = cursors.get(slot.sessionId) ?? 0;
          pollUrl.searchParams.set("afterChangeSeq", String(requestedCursor));
          request.url = pollUrl.href;
        }
        const actor = input.fixture.actors[Number(slot.sessionId.split("-")[1]) % 2];
        const expectedOutcome = request.body ? "write" as const : "read" as const;
        expectedOperations.push({ id: slot.logicalOperationId, journey: slot.journey, expectedOutcome, projectId: room.projectId });
        if (request.body) requests.set(slot.logicalOperationId, { actorId: actor.actorId, requestId: request.clientRequestId, conversationId: room.conversationId, projectId: room.projectId, task: request.action === "promote-task" });
        const began = performance.now(); let observation: Observation;
        let failureStage: HostedAttemptStage = "app_request";
        let observedHttpStatus: number | undefined;
        let observedResponseValid = false;
        let observedAppSuccess = false;
        let observedHttpLatencyMs: number | undefined;
        let observedBytes = 0;
        if (request.action === "send") visibility.beginSend(request.clientRequestId,
          { actorHash: actor.actorHash, actorId: actor.actorId, began, repetition: slot.repetition, measured: slot.phase === "measured" });
        try {
          if (appRequests >= WORKLOAD.totalRequestCap) { fatal = true; throw new Error("aggregate_request_cap_exceeded"); }
          appRequests++;
          const response = await manager.fetchAuthenticated(handles.get(slot.sessionId), request.url, { method: request.body ? "POST" : "GET", redirect: "manual",
            headers: { origin, ...(request.body ? { "content-type": "application/json" } : { accept: "text/html" }) }, body: request.body ? JSON.stringify(request.body) : undefined });
          observedHttpStatus = response.status;
          failureStage = "response_body";
          const body = await boundedResponseText(response);
          observedBytes = body.bytes;
          const bodyReceivedAt = performance.now();
          const httpLatencyMs = performance.now() - began;
          observedHttpLatencyMs = httpLatencyMs;
          let envelope: unknown;
          if (request.action !== "html") { try { envelope = JSON.parse(body.text); } catch { /* failed validation recorded below */ } }
          failureStage = "response_validation";
          const valid = request.action === "html" ? response.headers.get("content-type")?.includes("text/html") === true && validateHostedHtml(slot.journey, body.text, room.projectName) : validateHostedEnvelope(request.action, envelope);
          observedResponseValid = valid;
          const success = response.status === 200 && valid && (request.action === "html" || (envelope as Envelope).ok === true);
          observedAppSuccess = success;
          const value = object(envelope) && object(envelope.value) ? envelope.value : {};
          let scopeAuthorized = false;
          let actualProjectIds: string[] = [];
          let unauthorizedContent = false;
          let verifiedEffectIds: string[] | undefined;
          if (request.action === "promote-task" && request.body && (success || (valid && response.status === 503 && object(envelope) && envelope.code === "temporarily_unavailable"))) {
            failureStage = "write_effect_sql";
            const proof = await readHostedPromotionScope(client, { ...request.body, actorId: actor.actorId } as HostedPromotionProofInput, !success);
            verificationQueries += 4;
            ({ actualProjectIds, scopeAuthorized, unauthorizedContent } = proof);
            verifiedEffectIds = proof.effectIds;
            if (success && (String(value.taskId) !== hostedPromotionIdentity({ ...request.body, actorId: actor.actorId } as HostedPromotionProofInput).taskId ||
                String(value.workLinkId) !== hostedPromotionIdentity({ ...request.body, actorId: actor.actorId } as HostedPromotionProofInput).workLinkId)) {
              scopeAuthorized = false; unauthorizedContent = true;
            }
          } else if (success && request.action === "history") {
            failureStage = "history_scope_validation";
            const ids = (value.messages as Array<{ id: string }>).map((message) => message.id);
            const history = await observeHostedPollHistory({ visibility, ids, actorHash: actor.actorHash, receivedAt: bodyReceivedAt,
              scope: { projectId: room.projectId, conversationId: room.conversationId }, cursors, sessionId: slot.sessionId,
              requestedCursor, throughChangeSeq: Number(value.throughChangeSeq), lookup: async (unknown) => {
                failureStage = "history_lookup_sql";
                verificationQueries++;
                const rows = await client.execute({ sql: `SELECT id,workspace_id,conversation_id,client_request_id,author_id FROM conversation_messages WHERE id IN (${unknown.map(() => "?").join(",")})`, args: unknown });
                failureStage = "history_scope_validation";
                return rows.rows.map((row) => ({ id: row.id, workspace_id: row.workspace_id,
                  conversation_id: row.conversation_id, client_request_id: row.client_request_id, author_id: row.author_id }));
              } });
            ({ actualProjectIds, scopeAuthorized, unauthorizedContent } = history);
          } else if (success && request.action === "html") {
            // HTML includes the explicitly requested synthetic Project marker; source row proof is provided by writer/reader checks.
            scopeAuthorized = true; actualProjectIds = [room.projectId];
          } else if (success && request.body) {
            failureStage = "write_effect_sql";
            const committed = request.action === "send" ? await client.execute({ sql: "SELECT id,workspace_id,conversation_id FROM conversation_messages WHERE id=? AND client_request_id=? AND author_id=?",
              args: [String(value.messageId), request.clientRequestId, actor.actorId] }) : await client.execute({ sql: "SELECT t.id,t.workspace_id FROM tasks t JOIN work_operation_receipts r ON r.task_id=t.id WHERE t.id=? AND r.client_request_id=? AND r.actor_id=?",
              args: [String(value.taskId), request.clientRequestId, actor.actorId] });
            verificationQueries++;
            ({ actualProjectIds, scopeAuthorized, unauthorizedContent } = classifyCommittedScope(request.action,
              committed.rows, { projectId: room.projectId, conversationId: room.conversationId }));
            if (!scopeAuthorized && !unauthorizedContent) throw new Error("hosted_write_effect_unverified");
            if (scopeAuthorized && request.action === "send") visibility.confirmSend(request.clientRequestId, String(value.messageId), bodyReceivedAt,
              { projectId: room.projectId, conversationId: room.conversationId });
          }
          observation = { logicalOperationId: slot.logicalOperationId, attemptId: `${slot.logicalOperationId}:attempt:1`, attemptNumber: 1,
            serverTiming: parseHostedServerTiming(response.headers.get("server-timing")),
            journey: slot.journey, phase: slot.phase, latencyMs: httpLatencyMs, response: { statusCode: response.status, valid, success, errorEnvelope: object(envelope) && envelope.ok === false },
            acknowledged: expectedOutcome === "write" && success, scopeAuthorized, actualProjectIds, unauthorizedContent,
            effectIds: verifiedEffectIds ?? (success && request.body ? [String(request.action === "send" ? value.messageId : value.taskId)] : []), bytes: body.bytes,
            finishedAtMs: performance.now() - start,
            ...(object(envelope) && typeof envelope.code === "string" && ERROR_CODES.has(envelope.code) ? { errorCode: envelope.code } : {}) };
          if (!valid || unauthorizedContent || [401, 403].includes(response.status)) fatal = true;
        } catch (error) {
          const scopeUnverified = error instanceof Error && error.message === "hosted_history_scope_unverified";
          if (scopeUnverified || request.body) fatal = true;
          const diagnostic = hostedAttemptDiagnostic(error, failureStage);
          observation = { logicalOperationId: slot.logicalOperationId, attemptId: `${slot.logicalOperationId}:attempt:1`, attemptNumber: 1, journey: slot.journey, phase: slot.phase,
            latencyMs: observedHttpLatencyMs ?? performance.now() - began,
            ...hostedUnverifiedAttemptEvidence(expectedOutcome, observedHttpStatus, observedResponseValid, observedAppSuccess),
            scopeAuthorized: false, actualProjectIds: [], unauthorizedContent: false, effectIds: [], bytes: observedBytes, finishedAtMs: performance.now() - start,
            httpResponseObserved: observedHttpStatus !== undefined, ...diagnostic,
            errorCode: scopeUnverified ? "history_scope_unverified" :
              failureStage === "response_body" ? "response_unavailable" :
                observedHttpStatus !== undefined ? "verification_unavailable" : "transport_failure" };
        }
        if (request.action === "send") visibility.cancelSend(request.clientRequestId);
        observations.push(observation);
        const recent = observations.filter((item) => item.finishedAtMs >= observation.finishedAtMs - 60_000);
        if (observation.finishedAtMs >= 60_000 && recent.length > 0 && recent.filter((item) => !item.response.success).length / recent.length > .05) fatal = true;
      }
      const scheduled = await runHostedArrivalSchedule({ events: dryRun.schedule.events, startedAt: start,
        now: () => performance.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        perform, flush: (repetition, timing, dropped) => { droppedIterations = dropped; return flush(repetition, true, timing); },
        isFatal: () => fatal });
      droppedIterations = scheduled.droppedIterations;
      windowTimings = scheduled.windows;
      finalDrainMs = scheduled.finalDrainMs;
      let boundaryDiagnosticPersisted: boolean | undefined;
      if (scheduled.boundaryFailure?.kind === "flush_threw") {
        const failedRepetition = scheduled.boundaryFailure.repetition;
        const diagnostic = { repetition: failedRepetition, complete: false, verification: "unverified",
          failureCode: "BOUNDARY_FLUSH_FAILED", ...scheduled.boundaryFailure.diagnostic,
          appRequests, droppedIterations, verificationQueries,
          actualAppTransportRequests: (manager.getMetrics() as { app?: { requests?: number } }).app?.requests ?? 0,
          windowTiming: windowTimings.find((window) => window.repetition === failedRepetition),
          observations: observations.filter((observation) => observation.logicalOperationId.startsWith(`${failedRepetition}:`)) };
        try {
          await writeHostedUnverifiedFlushDiagnostic(input.outputDirectory, failedRepetition, "boundary", diagnostic);
          boundaryDiagnosticPersisted = true;
        } catch {
          boundaryDiagnosticPersisted = false;
          scheduled.boundaryFailure.reconciliation.findings.push({ code: "BOUNDARY_DIAGNOSTIC_WRITE_FAILED",
            detail: "Could not persist the separate unverified boundary diagnostic" });
        }
      }
      const reconciliationStartedAt = performance.now();
      let final: Awaited<ReturnType<typeof finalizeHostedRepetition>>;
      let finalDiagnosticPersisted: boolean | undefined;
      let flushFailureDiagnostic = scheduled.boundaryFailure?.diagnostic;
      try {
        final = await finalizeHostedRepetition({ repetition: scheduled.repetition, fatal, droppedIterations,
          boundaryFailure: scheduled.boundaryFailure, flush });
      } catch (error) {
        flushFailureDiagnostic = hostedFlushDiagnostic(error);
        const diagnostic = { repetition: scheduled.repetition, complete: false, verification: "unverified",
          failureCode: "FINAL_FLUSH_FAILED", ...flushFailureDiagnostic, appRequests, droppedIterations, verificationQueries,
          actualAppTransportRequests: (manager.getMetrics() as { app?: { requests?: number } }).app?.requests ?? 0,
          windowTiming: windowTimings.find((window) => window.repetition === scheduled.repetition),
          observations: observations.filter((observation) => observation.logicalOperationId.startsWith(`${scheduled.repetition}:`)) };
        try {
          await writeHostedUnverifiedFlushDiagnostic(input.outputDirectory, scheduled.repetition, "final", diagnostic);
          finalDiagnosticPersisted = true;
        } catch { finalDiagnosticPersisted = false; }
        const findings = [{ code: "FINAL_FLUSH_FAILED", detail: "Final reconciliation or receipt persistence failed; effects remain unverified" },
          ...(finalDiagnosticPersisted ? [] : [{ code: "FINAL_DIAGNOSTIC_WRITE_FAILED", detail: "Could not persist the separate unverified final diagnostic" }]),
          ...(fatal ? [{ code: "FATAL_WORKLOAD_ABORT", detail: "A fatal request result preceded final reconciliation" }] : [])];
        final = await finalizeHostedRepetition({ repetition: scheduled.repetition, fatal, droppedIterations,
          boundaryFailure: { repetition: scheduled.repetition, reconciliation: { ok: false, findings } },
          flush: async () => { throw new Error("hosted_duplicate_final_flush_blocked"); } });
      }
      finalReconciliationMs = performance.now() - reconciliationStartedAt;
      summary = { completed: final.failure === null, failure: final.failure, appRequests,
        actualAppTransportRequests: (manager.getMetrics() as { app?: { requests?: number } }).app?.requests ?? 0,
        droppedIterations, outputDirectory: input.outputDirectory, identityTraffic: manager.getMetrics(), windowTimings,
        boundaryDiagnosticPersisted, finalDiagnosticPersisted, flushFailureDiagnostic,
        measurementAttribution: hostedMeasurementAttributionFromWindows(performance.now() - start, windowTimings,
          { finalDrainMs, finalReconciliationMs, sessionCleanupMs: 0 }) };
    } finally {
      try {
        const cleanupStartedAt = performance.now();
        const cleanup = await manager.cleanup();
        const sessionCleanupMs = performance.now() - cleanupStartedAt;
        await writeFile(join(input.outputDirectory, "session-cleanup.json"), JSON.stringify(cleanup, null, 2));
        if (summary) {
          summary.sessionCleanup = cleanup;
          summary.completed &&= sessionCleanupAccepted(cleanup);
          summary.identityTraffic = manager.getMetrics();
          summary.actualAppTransportRequests = (summary.identityTraffic as { app?: { requests?: number } }).app?.requests ?? 0;
          summary.measurementAttribution = hostedMeasurementAttributionFromWindows(performance.now() - start, windowTimings,
            { finalDrainMs, finalReconciliationMs, sessionCleanupMs });
          await writeFile(join(input.outputDirectory, "summary.json"), JSON.stringify({ ...summary, evidenceScope: input.manifest.executionMode, runtime: input.manifest.runtime }, null, 2));
        }
      } finally { client.close(); }
    }
    return summary!;
  } });
}
