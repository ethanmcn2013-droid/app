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
  scopeAuthorized: boolean; actualProjectIds: string[]; unauthorizedContent: boolean; effectIds: string[]; bytes: number; finishedAtMs: number; errorCode?: string };
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
    limitations: ["API task.mutate is message-to-task outcome creation; ordinary task update/complete requires separate browser proof", "HTML route latency includes server render, excludes browser paint/hydration", "fixed arrival-rate schedule; existing client poller closed-loop behavior requires separate browser probe"] };
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
      catch { throw new Error("hosted_history_scope_unverified"); }
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

export function committedEffectMatchesScope(action: string, rows: ReadonlyArray<Record<string, unknown>>, scope: MessageScope) {
  return (action === "send" || action === "promote-task") && rows.length === 1 && rows[0].workspace_id === scope.projectId &&
    (action !== "send" || rows[0].conversation_id === scope.conversationId);
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
    const polling = new Set<string>();
    const inFlight = new Set<Promise<void>>();
    const origin = input.observed.origin;
    let appRequests = 0; let droppedIterations = 0; let fatal = false;
    let start = 0;
    const cursors = new Map<string, number>();
    const visibility = new HostedMessageVisibility();
    const { pendingVisibility, visibilitySamples } = visibility;
    let verificationQueries = 0;
    let mutationSourceIndex = 0;
    let negativeScopeProof = false;
    let summary: { completed: boolean; appRequests: number; actualAppTransportRequests: number; droppedIterations: number; outputDirectory: string; identityTraffic: unknown; sessionCleanup?: SessionCleanupReceipt;
      measurementAttribution: ReturnType<typeof hostedMeasurementAttribution> } | undefined;
    const flush = async (repetition: number, complete: boolean) => {
      const current = observations.filter((observation) => observation.logicalOperationId.startsWith(`${repetition}:`));
      verificationQueries += await reconcileHostedEffects(client, current, requests);
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
      const receipt = { repetition, complete, acceptancePendingSessionCleanup: true, evidenceScope: input.manifest.executionMode, runtime: input.manifest.runtime,
        appRequests, actualAppTransportRequests: (manager.getMetrics() as { app?: { requests?: number } }).app?.requests ?? 0,
        droppedIterations, verificationQueries, negativeScopeProof, observations: current, reconciliation, allWritesCorrectness: correctness,
        messageVisibility: { samples: visible.length, p95InitiationMs: visibilityP95, missing: waiting, timings: visible },
        identityTraffic: manager.getMetrics(), limitations: dryRun.limitations, runtimeIdentity: input.manifest.environment.identity };
      await writeFile(join(input.outputDirectory, `run-${repetition}.json`), JSON.stringify(receipt, null, 2));
      return reconciliation;
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
        if (request.action === "promote-task" && request.body && "messageId" in request.body) request.body.messageId = room.unusedSourceMessageIds[mutationSourceIndex++];
        if (request.action === "history") {
          const pollUrl = new URL(request.url);
          pollUrl.searchParams.set("afterChangeSeq", String(cursors.get(slot.sessionId) ?? 0));
          request.url = pollUrl.href;
        }
        const actor = input.fixture.actors[Number(slot.sessionId.split("-")[1]) % 2];
        const expectedOutcome = request.body ? "write" as const : "read" as const;
        expectedOperations.push({ id: slot.logicalOperationId, journey: slot.journey, expectedOutcome, projectId: room.projectId });
        if (request.body) requests.set(slot.logicalOperationId, { actorId: actor.actorId, requestId: request.clientRequestId, conversationId: room.conversationId, projectId: room.projectId, task: request.action === "promote-task" });
        const began = performance.now(); let observation: Observation;
        if (request.action === "send") visibility.beginSend(request.clientRequestId,
          { actorHash: actor.actorHash, actorId: actor.actorId, began, repetition: slot.repetition, measured: slot.phase === "measured" });
        try {
          if (appRequests >= WORKLOAD.totalRequestCap) { fatal = true; throw new Error("aggregate_request_cap_exceeded"); }
          appRequests++;
          const response = await manager.fetchAuthenticated(handles.get(slot.sessionId), request.url, { method: request.body ? "POST" : "GET", redirect: "manual",
            headers: { origin, ...(request.body ? { "content-type": "application/json" } : { accept: "text/html" }) }, body: request.body ? JSON.stringify(request.body) : undefined });
          const body = await boundedResponseText(response);
          const bodyReceivedAt = performance.now();
          const httpLatencyMs = performance.now() - began;
          let envelope: unknown;
          if (request.action !== "html") { try { envelope = JSON.parse(body.text); } catch { /* failed validation recorded below */ } }
          const valid = request.action === "html" ? response.headers.get("content-type")?.includes("text/html") === true && validateHostedHtml(slot.journey, body.text, room.projectName) : validateHostedEnvelope(request.action, envelope);
          const success = response.status === 200 && valid && (request.action === "html" || (envelope as Envelope).ok === true);
          const value = object(envelope) && object(envelope.value) ? envelope.value : {};
          let scopeAuthorized = false;
          let actualProjectIds: string[] = [];
          let unauthorizedContent = false;
          if (success && request.action === "history") {
            const ids = (value.messages as Array<{ id: string }>).map((message) => message.id);
            const history = await visibility.observeHistory(ids, actor.actorHash, bodyReceivedAt,
              { projectId: room.projectId, conversationId: room.conversationId }, async (unknown) => {
                verificationQueries++;
                const rows = await client.execute({ sql: `SELECT id,workspace_id,conversation_id,client_request_id,author_id FROM conversation_messages WHERE id IN (${unknown.map(() => "?").join(",")})`, args: unknown });
                return rows.rows.map((row) => ({ id: row.id, workspace_id: row.workspace_id,
                  conversation_id: row.conversation_id, client_request_id: row.client_request_id, author_id: row.author_id }));
              });
            ({ actualProjectIds, scopeAuthorized, unauthorizedContent } = history);
          } else if (success && request.action === "html") {
            // HTML includes the explicitly requested synthetic Project marker; source row proof is provided by writer/reader checks.
            scopeAuthorized = true; actualProjectIds = [room.projectId];
          } else if (success && request.body) {
            const committed = request.action === "send" ? await client.execute({ sql: "SELECT id,workspace_id,conversation_id FROM conversation_messages WHERE id=? AND client_request_id=? AND author_id=?",
              args: [String(value.messageId), request.clientRequestId, actor.actorId] }) : await client.execute({ sql: "SELECT t.id,t.workspace_id FROM tasks t JOIN work_operation_receipts r ON r.task_id=t.id WHERE t.id=? AND r.client_request_id=? AND r.actor_id=?",
              args: [String(value.taskId), request.clientRequestId, actor.actorId] });
            verificationQueries++;
            actualProjectIds = committed.rows.map((row) => String(row.workspace_id));
            scopeAuthorized = committedEffectMatchesScope(request.action, committed.rows,
              { projectId: room.projectId, conversationId: room.conversationId });
            unauthorizedContent = !scopeAuthorized;
            if (scopeAuthorized && request.action === "send") visibility.confirmSend(request.clientRequestId, String(value.messageId), bodyReceivedAt,
              { projectId: room.projectId, conversationId: room.conversationId });
          }
          if (success && request.action === "history") {
            cursors.set(slot.sessionId, Number(value.throughChangeSeq));
          }
          observation = { logicalOperationId: slot.logicalOperationId, attemptId: `${slot.logicalOperationId}:attempt:1`, attemptNumber: 1,
            serverTiming: parseHostedServerTiming(response.headers.get("server-timing")),
            journey: slot.journey, phase: slot.phase, latencyMs: httpLatencyMs, response: { statusCode: response.status, valid, success, errorEnvelope: object(envelope) && envelope.ok === false },
            acknowledged: expectedOutcome === "write" && success, scopeAuthorized, actualProjectIds, unauthorizedContent,
            effectIds: success && request.body ? [String(request.action === "send" ? value.messageId : value.taskId)] : [], bytes: body.bytes,
            finishedAtMs: performance.now() - start,
            ...(object(envelope) && typeof envelope.code === "string" && ERROR_CODES.has(envelope.code) ? { errorCode: envelope.code } : {}) };
          if (!valid || unauthorizedContent || [401, 403].includes(response.status)) fatal = true;
        } catch (error) {
          const scopeUnverified = error instanceof Error && error.message === "hosted_history_scope_unverified";
          if (scopeUnverified) fatal = true;
          observation = { logicalOperationId: slot.logicalOperationId, attemptId: `${slot.logicalOperationId}:attempt:1`, attemptNumber: 1, journey: slot.journey, phase: slot.phase,
            latencyMs: performance.now() - began, response: { statusCode: 503, valid: true, success: false, errorEnvelope: true }, acknowledged: false,
            scopeAuthorized: false, actualProjectIds: [], unauthorizedContent: false, effectIds: [], bytes: 0, finishedAtMs: performance.now() - start,
            errorCode: scopeUnverified ? "history_scope_unverified" : "transport_failure" };
        }
        if (request.action === "send") visibility.cancelSend(request.clientRequestId);
        observations.push(observation);
        const recent = observations.filter((item) => item.finishedAtMs >= observation.finishedAtMs - 60_000);
        if (observation.finishedAtMs >= 60_000 && recent.length > 0 && recent.filter((item) => !item.response.success).length / recent.length > .05) fatal = true;
      }
      let repetition = 1;
      for (const slot of dryRun.schedule.events) {
        if (fatal) break;
        if (slot.repetition !== repetition) { await Promise.all(inFlight); const result = await flush(repetition, true); if (!result.ok) { fatal = true; break; } repetition = slot.repetition; }
        const delay = start + slot.atMs - performance.now();
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 60_000)));
        if ((slot.journey === "chat.poll" && polling.has(slot.sessionId)) || inFlight.size >= 16) { droppedIterations++; continue; }
        if (slot.journey === "chat.poll") polling.add(slot.sessionId);
        const work = perform(slot).finally(() => { if (slot.journey === "chat.poll") polling.delete(slot.sessionId); inFlight.delete(work); });
        inFlight.add(work);
      }
      await Promise.all(inFlight);
      const measurementAttribution = hostedMeasurementAttribution(performance.now() - start);
      const final = await flush(repetition, !fatal && repetition === 3);
      summary = { completed: !fatal && repetition === 3 && final.ok && droppedIterations === 0, appRequests,
        actualAppTransportRequests: (manager.getMetrics() as { app?: { requests?: number } }).app?.requests ?? 0,
        droppedIterations, outputDirectory: input.outputDirectory, identityTraffic: manager.getMetrics(), measurementAttribution };
    } finally {
      try {
        const cleanup = await manager.cleanup();
        await writeFile(join(input.outputDirectory, "session-cleanup.json"), JSON.stringify(cleanup, null, 2));
        if (summary) {
          summary.sessionCleanup = cleanup;
          summary.completed &&= sessionCleanupAccepted(cleanup);
          summary.identityTraffic = manager.getMetrics();
          summary.actualAppTransportRequests = (summary.identityTraffic as { app?: { requests?: number } }).app?.requests ?? 0;
          await writeFile(join(input.outputDirectory, "summary.json"), JSON.stringify({ ...summary, evidenceScope: input.manifest.executionMode, runtime: input.manifest.runtime }, null, 2));
        }
      } finally { client.close(); }
    }
    return summary!;
  } });
}
