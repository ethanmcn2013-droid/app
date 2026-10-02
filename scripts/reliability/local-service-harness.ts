import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { assertProjectId } from "../../src/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter, type ConversationDatabaseAdapter } from "../../src/server/conversations/database";
import { createConversationService } from "../../src/server/conversations/service";
import { createConversationTaskOutcomeService, type PromoteMessageToTaskInput } from "../../src/server/conversations/work-links";

export const LOCAL_PROFILES = {
  smoke: { projects: 2, tasks: 10, messages: 30, resources: 5 },
  small: { projects: 2, tasks: 100, messages: 1_000, resources: 50 },
  representative: { projects: 10, tasks: 1_000, messages: 10_000, resources: 500 },
} as const;
export const ACTORS = { writer: "synthetic-reliability-alice", observer: "synthetic-reliability-bob", outsider: "synthetic-reliability-outsider" } as const;
export type Checkpoint = { projectId: string; conversationId: string; messageRequestId: string; taskRequestId: string; messageId: string; taskId: string; audienceEpoch: number };
export const hashIdentity = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** Allocates an empty directory only. No client or generated records before guard acceptance. */
export async function allocateLocalServiceTarget(root = resolve("work/reliability")) {
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "local-service-"));
  return { directory, databaseUrl: `file:${join(directory, "tasks.db").replaceAll("\\", "/")}` };
}

export function assertLocalServiceUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "file:" || parsed.hostname || parsed.search || parsed.hash) throw new Error("invalid_local_url");
    const path = fileURLToPath(parsed);
    if (!isAbsolute(path) || basename(path) !== "tasks.db") throw new Error("invalid_local_path");
  } catch { throw new Error("local_service_target_refused"); }
}

export async function initializeLocalServiceSchema(client: Client) {
  await client.execute("PRAGMA foreign_keys = OFF");
  const files = (await readdir(resolve("drizzle"))).filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort();
  for (const file of files) await client.executeMultiple(await readFile(resolve("drizzle", file), "utf8"));
  return files;
}

/** Seeds real chat sends and message-to-task outcomes; resources are metadata fixtures only. */
export async function seedLocalServiceFixture(client: Client, profile: keyof typeof LOCAL_PROFILES) {
  const counts = LOCAL_PROFILES[profile];
  const adapter = createLocalConversationDatabaseAdapter({ client });
  const service = createConversationService(adapter);
  const tasks = createConversationTaskOutcomeService(adapter, { captureConfig: { enabled: false, now: 0 } });
  for (const [index, id] of Object.values(ACTORS).entries()) await client.execute({
    sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES (?,?,?,'#444444','S')",
    args: [id, `clerk_${id}`, `Synthetic ${index}`],
  });
  const rooms = [];
  for (let index = 0; index < counts.projects; index++) {
    const projectId = assertProjectId(`reliability_project_${index}`);
    await client.execute({ sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type) VALUES (?,?,?,?,'project')", args: [projectId, projectId, `Synthetic project ${index}`, ACTORS.writer] });
    for (const actor of [ACTORS.writer, ACTORS.observer]) await client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES (?,?,'member')", args: [projectId, actor] });
    const room = await service.ensureProjectConversation({ actorId: ACTORS.writer, projectId });
    assert.ok(room.ok, "seed_room_failed");
    rooms.push(room.value);
  }
  let checkpoint: Checkpoint | undefined;
  const taskIds = [];
  for (let index = 0; index < counts.messages; index++) {
    // Half the messages belong to the first project; the rest distribute deterministically.
    const room = rooms[index % 2 === 0 ? 0 : Math.floor(index / 2) % rooms.length];
    const messageRequestId = `reliability_seed_message_${index}`;
    const sent = await service.sendMessage({ actorId: ACTORS.writer, input: {
      projectId: room.projectId, conversationId: room.conversationId, expectedAudienceEpoch: room.audienceEpoch,
      clientRequestId: messageRequestId, body: `Synthetic message ${index}`, rootId: null, mentionUserIds: [],
    } });
    assert.ok(sent.ok, "seed_send_failed");
    if (index < counts.tasks) {
      const taskRequestId = `reliability_seed_task_${index}`;
      const task = await tasks.promoteMessageToTask({ actorId: ACTORS.writer, input: {
        clientRequestId: taskRequestId, sourceProjectId: room.projectId, destinationProjectId: room.projectId,
        conversationId: room.conversationId, messageId: sent.value.messageId, expectedRevision: 1,
        expectedAudienceEpoch: room.audienceEpoch, title: `Synthetic task ${index}`, ownerUserId: ACTORS.observer,
        dueDate: "2026-10-25" as PromoteMessageToTaskInput["dueDate"],
      } });
      assert.ok(task.ok, "seed_task_failed");
      taskIds.push({ id: task.value.taskId, projectId: room.projectId });
      checkpoint ??= { projectId: room.projectId, conversationId: room.conversationId, audienceEpoch: room.audienceEpoch,
        messageRequestId, taskRequestId, messageId: sent.value.messageId, taskId: task.value.taskId };
    }
  }
  for (let index = 0; index < counts.resources; index++) {
    const task = taskIds[index % taskIds.length];
    await client.execute({ sql: "INSERT INTO resources(id,workspace_id,task_id,kind,provider,title,added_at,access_state) VALUES (?,?,?,'link','url',?,?,'ok')", args: [`reliability_resource_${index}`, task.projectId, task.id, `Synthetic resource ${index}`, 1_790_467_200] });
  }
  assert.ok(checkpoint);
  return { checkpoint, rooms, counts, adapter, service, tasks };
}

/** Fresh-process persisted reads; excludes auth/session/HTTP, providers and native file bytes. */
export async function verifyPersistedWorkflow(databaseUrl: string, checkpoint: Checkpoint) {
  assertLocalServiceUrl(databaseUrl);
  const client = createClient({ url: databaseUrl });
  try {
    const adapter = createLocalConversationDatabaseAdapter({ client });
    const service = createConversationService(adapter);
    const tasks = createConversationTaskOutcomeService(adapter, { captureConfig: { enabled: false, now: 0 } });
    const receipt = await service.getReceipt({ actorId: ACTORS.writer, projectId: assertProjectId(checkpoint.projectId), conversationId: checkpoint.conversationId, clientRequestId: checkpoint.messageRequestId });
    assert.ok(receipt.ok && receipt.value.state === "committed", "persisted_message_receipt_missing");
    assert.equal(receipt.value.receipt.messageId, checkpoint.messageId);
    const history = await service.getMessagePage({ actorId: ACTORS.observer, projectId: assertProjectId(checkpoint.projectId), conversationId: checkpoint.conversationId, beforeCreateSeq: 2 });
    assert.ok(history.ok && history.value.messages.some((message) => message.id === checkpoint.messageId), "persisted_observer_message_missing");
    const task = await tasks.getTaskReceipt({ actorId: ACTORS.writer, clientRequestId: checkpoint.taskRequestId });
    assert.ok(task.ok && task.value.state === "committed" && task.value.taskAvailable, "persisted_task_missing");
    assert.equal(task.value.receipt.taskId, checkpoint.taskId);
    const row = await client.execute({ sql: "SELECT t.id,w.task_id FROM tasks t JOIN work_links w ON w.task_id=t.id WHERE t.id=? AND t.workspace_id=?", args: [checkpoint.taskId, checkpoint.projectId] });
    assert.equal(row.rows.length, 1, "persisted_task_relationship_missing");
    return { messageReceipt: true, observerHistory: true, taskReceipt: true, taskRelationship: true };
  } finally { client.close(); }
}

export function instrumentLocalAdapter(client: Client) {
  const counters = { queries: 0, queryDurationMs: 0, transactions: 0 };
  let fault: "none" | "outage" | "rollback" | "lost-response" = "none";
  const measured = { execute: async (statement: Parameters<Client["execute"]>[0]) => {
    const started = performance.now();
    try { return await client.execute(statement); } finally { counters.queries++; counters.queryDurationMs += performance.now() - started; }
  } };
  const inner = createLocalConversationDatabaseAdapter({ client: measured });
  const adapter: ConversationDatabaseAdapter = {
    available: true, boundary: inner.boundary,
    async transaction(mode, operation) {
      counters.transactions++;
      if (fault === "outage") throw new Error("conversation_database_unavailable:injected");
      const selected = fault;
      const result = await inner.transaction(mode, async (executor) => {
        const value = await operation(executor);
        if (selected === "rollback" && mode === "write") throw new Error("conversation_database_unavailable:rollback");
        return value;
      });
      if (selected === "lost-response" && mode === "write") throw new Error("injected_response_lost_after_commit");
      return result;
    },
  };
  return { adapter, counters, inject: (next: typeof fault) => { fault = next; } };
}

/** Bounded burst probe, not the timed mixed browser workload or a hosted acceptance run. */
export async function probeLocalServices(client: Client, checkpoint: Checkpoint, rounds = 50, requestCap = 1_000) {
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 100 || !Number.isSafeInteger(requestCap) || rounds * 16 > requestCap) throw new Error("local_probe_cap_refused");
  const instrumented = instrumentLocalAdapter(client);
  const service = createConversationService(instrumented.adapter);
  const tasks = createConversationTaskOutcomeService(instrumented.adapter, { captureConfig: { enabled: false, now: 0 } });
  const projectId = assertProjectId(checkpoint.projectId);
  const observations: Array<{ logicalOperationId: string; attemptId: string; attemptNumber: number; journey: string; phase: string; latencyMs: number; response: { statusCode: number; valid: boolean; success: boolean }; acknowledged: boolean; scopeAuthorized: boolean; unauthorizedContent: boolean; actualProjectIds: string[]; effectIds: string[] }> = [];
  const expectedOperations: Array<{ id: string; journey: string; expectedOutcome: string; projectId: string }> = [];
  const durations: Record<string, number[]> = {};
  let attempts = 0;
  async function measured<T extends { ok: boolean }>(id: string, journey: string, write: boolean, operation: () => Promise<T>, effect: (value: T) => string[] = () => []) {
    if (++attempts > requestCap) throw new Error("local_probe_request_cap_exceeded");
    const started = performance.now();
    const result = await operation();
    const latencyMs = performance.now() - started;
    assert.ok(result.ok, `${journey}_unexpected_failure`);
    (durations[journey] ??= []).push(latencyMs);
    observations.push({ logicalOperationId: id, attemptId: `${id}_attempt_1`, attemptNumber: 1, journey, phase: "measured", latencyMs,
      response: { statusCode: 200, valid: true, success: result.ok }, acknowledged: write && result.ok,
      scopeAuthorized: true, unauthorizedContent: false, actualProjectIds: [projectId], effectIds: effect(result) });
    expectedOperations.push({ id, journey, expectedOutcome: write ? "write" : "read", projectId });
    return result;
  }
  const started = performance.now();
  for (let round = 0; round < rounds; round++) {
    await Promise.all(Array.from({ length: 8 }, async (_, session) => {
      const id = `reliability_probe_${round}_${session}`;
      if (session < 4) {
        const sent = await measured(`${id}_send`, "message_ack", true, () => service.sendMessage({ actorId: ACTORS.writer, input: {
          projectId, conversationId: checkpoint.conversationId, expectedAudienceEpoch: checkpoint.audienceEpoch,
          clientRequestId: `${id}_send`, body: "Synthetic measured update", rootId: null, mentionUserIds: [],
        } }), (result) => result.ok ? [result.value.messageId] : []);
        assert.ok(sent.ok);
        const visible = await measured(`${id}_visible`, "message_visible", false, () => service.getMessagePage({ actorId: ACTORS.observer, projectId, conversationId: checkpoint.conversationId }));
        assert.ok(visible.ok && visible.value.messages.some((message) => message.id === sent.value.messageId), "observer_did_not_see_acknowledged_message");
        const persisted = await client.execute({ sql: "SELECT COUNT(*) AS n FROM conversation_messages WHERE id=? AND workspace_id=?", args: [sent.value.messageId, projectId] });
        assert.equal(Number(persisted.rows[0].n), 1, "acknowledged_message_not_persisted_once");
      } else {
        await measured(`${id}_history`, "conversation_history", false, () => service.getMessagePage({ actorId: ACTORS.observer, projectId, conversationId: checkpoint.conversationId }));
        const promoted = await measured(`${id}_task`, "task_ack", true, () => tasks.promoteMessageToTask({ actorId: ACTORS.writer, input: {
          clientRequestId: `${id}_task`, sourceProjectId: projectId, destinationProjectId: projectId,
          conversationId: checkpoint.conversationId, messageId: checkpoint.messageId, expectedRevision: 1,
          expectedAudienceEpoch: checkpoint.audienceEpoch, title: "Synthetic measured task", ownerUserId: ACTORS.observer,
          dueDate: "2026-10-25" as PromoteMessageToTaskInput["dueDate"],
        } }), (result) => result.ok ? [result.value.taskId] : []);
        assert.ok(promoted.ok);
        const persisted = await client.execute({ sql: "SELECT COUNT(*) AS n FROM tasks WHERE id=? AND workspace_id=?", args: [promoted.value.taskId, projectId] });
        assert.equal(Number(persisted.rows[0].n), 1, "acknowledged_task_not_persisted_once");
      }
    }));
  }
  const elapsedMs = performance.now() - started;
  const latency = Object.fromEntries(Object.entries(durations).map(([journey, values]) => {
    const sorted = [...values].sort((left, right) => left - right);
    return [journey, { samples: values.length, p50: sorted[Math.ceil(sorted.length * .5) - 1], p95: sorted[Math.ceil(sorted.length * .95) - 1], maximum: sorted.at(-1) }];
  }));
  return { observations, expectedOperations, latency, counters: instrumented.counters, attempts, elapsedMs,
    configuredSessions: 10, activeSessions: 8, hiddenSessions: 2, mode: "local-service-burst-probe", authenticatedRouteProof: false };
}

export async function exerciseLocalServiceFaults(client: Client, checkpoint: Checkpoint, interruptionMs = 0) {
  if (![0, 30_000].includes(interruptionMs)) throw new Error("unsupported_interruption_duration");
  const instrumented = instrumentLocalAdapter(client);
  const service = createConversationService(instrumented.adapter);
  const tasks = createConversationTaskOutcomeService(instrumented.adapter, { captureConfig: { enabled: false, now: 0 } });
  const projectId = assertProjectId(checkpoint.projectId);
  const faultNamespace = `fault_${randomUUID()}_`;
  const send = (request: string) => ({ actorId: ACTORS.writer, input: { projectId, conversationId: checkpoint.conversationId,
    expectedAudienceEpoch: checkpoint.audienceEpoch, clientRequestId: faultNamespace + request, body: "Synthetic fault update", rootId: null, mentionUserIds: [] } });
  const promote = (request: string) => ({ actorId: ACTORS.writer, input: { clientRequestId: faultNamespace + request, sourceProjectId: projectId,
    destinationProjectId: projectId, conversationId: checkpoint.conversationId, messageId: checkpoint.messageId,
    expectedRevision: 1, expectedAudienceEpoch: checkpoint.audienceEpoch, title: "Synthetic fault task", ownerUserId: ACTORS.observer,
    dueDate: "2026-10-25" as PromoteMessageToTaskInput["dueDate"] } });
  for (const kind of ["message", "task"] as const) {
    const request = `reliability_fault_${kind}_lost`;
    const operation = () => kind === "message" ? service.sendMessage(send(request)) : tasks.promoteMessageToTask(promote(request));
    instrumented.inject("lost-response");
    await assert.rejects(operation, /injected_response_lost_after_commit/);
    instrumented.inject("none");
    const repeated = await Promise.all([operation(), operation()]);
    assert.ok(repeated[0].ok && repeated[1].ok);
    assert.deepEqual(repeated[0], repeated[1], "replay_changed_committed_result");
    const table = kind === "message" ? "conversation_receipts" : "work_operation_receipts";
    const persisted = await client.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE client_request_id=?`, args: [faultNamespace + request] });
    assert.equal(Number(persisted.rows[0].n), 1);
    const atomicTables = kind === "message" ? ["conversation_messages", "conversation_changes", "conversation_receipts", "conversation_attention", "conversation_outbox"] : ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"];
    const countsBefore = await Promise.all(atomicTables.map(async (name) => Number((await client.execute(`SELECT COUNT(*) AS n FROM ${name}`)).rows[0].n)));
    instrumented.inject("rollback");
    const rolled = kind === "message" ? await service.sendMessage(send(`${request}_rollback`)) : await tasks.promoteMessageToTask(promote(`${request}_rollback`));
    assert.deepEqual(rolled, { ok: false, code: "temporarily_unavailable" });
    instrumented.inject("none");
    const countsAfter = await Promise.all(atomicTables.map(async (name) => Number((await client.execute(`SELECT COUNT(*) AS n FROM ${name}`)).rows[0].n)));
    assert.deepEqual(countsAfter, countsBefore, "rollback_left_transaction_effects");
    const absent = await client.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE client_request_id=?`, args: [faultNamespace + `${request}_rollback`] });
    assert.equal(Number(absent.rows[0].n), 0);
  }
  instrumented.inject("outage");
  const interruptionStarted = performance.now();
  assert.deepEqual(await service.sendMessage(send("reliability_fault_outage")), { ok: false, code: "temporarily_unavailable" });
  assert.deepEqual(await tasks.promoteMessageToTask(promote("reliability_fault_outage_task")), { ok: false, code: "temporarily_unavailable" });
  if (interruptionMs) await new Promise((resolve) => setTimeout(resolve, interruptionMs));
  const actualInterruptionDurationMs = performance.now() - interruptionStarted;
  instrumented.inject("none");
  const recoveryStarted = performance.now();
  const recoveredMessage = await service.sendMessage(send("reliability_fault_recovered"));
  assert.ok(recoveredMessage.ok);
  const recoveredTask = await tasks.promoteMessageToTask(promote("reliability_fault_recovered_task"));
  assert.ok(recoveredTask.ok);
  const observer = await service.getMessagePage({ actorId: ACTORS.observer, projectId, conversationId: checkpoint.conversationId });
  assert.ok(observer.ok && observer.value.messages.some((message) => message.id === recoveredMessage.value.messageId));
  const taskRow = await client.execute({ sql: "SELECT id FROM tasks WHERE id=? AND workspace_id=?", args: [recoveredTask.value.taskId, projectId] });
  assert.equal(taskRow.rows.length, 1);
  const dependencyRecoveryMs = performance.now() - recoveryStarted;
  assert.ok(dependencyRecoveryMs < 60_000, "dependency_recovery_exceeded_60_seconds");
  const edits = await Promise.all([0, 1].map((index) => service.editMessage({ actorId: ACTORS.writer,
    projectId, conversationId: checkpoint.conversationId, messageId: recoveredMessage.value.messageId,
    clientRequestId: `${faultNamespace}edit_${index}`, expectedRevision: 1, expectedAudienceEpoch: checkpoint.audienceEpoch,
    body: `Synthetic edit ${index}`, mentionUserIds: [],
  })));
  assert.equal(edits.filter((edit) => edit.ok).length, 1, "concurrent_edits_did_not_have_one_winner");
  assert.equal(edits.filter((edit) => !edit.ok && edit.code === "revision_conflict").length, 1, "concurrent_edit_conflict_not_reported");
  const denied = await service.getMessagePage({ actorId: ACTORS.outsider, projectId, conversationId: checkpoint.conversationId });
  assert.deepEqual(denied, { ok: false, code: "unavailable" });
  await client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?", args: [projectId, ACTORS.observer] });
  assert.deepEqual(await service.getMessagePage({ actorId: ACTORS.observer, projectId, conversationId: checkpoint.conversationId }), { ok: false, code: "unavailable" });
  await client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES (?,?,'member')", args: [projectId, ACTORS.observer] });
  return { lostResponseReplay: true, duplicateReplay: true, rollback: true, concurrentEditRevisionConflict: true, dependencyRecoveryMs,
    interruptionDurationMs: actualInterruptionDurationMs, foreignScopeDenied: true, membershipRevocationDenied: true, thirtySecondInterruptionProof: interruptionMs === 30_000 };
}
