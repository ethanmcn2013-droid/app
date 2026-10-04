import "server-only";

import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { ConversationResult } from "@/lib/conversations/contracts";
import { validRequestId } from "@/lib/conversations/contracts";
import { isCalendarDate, type CalendarDate } from "@/lib/planning/dates";
import { isProjectId, type ProjectId } from "@/lib/projects/project-ref";
import { createTaskInTransaction, prepareCanonicalTaskCreate, type CanonicalTaskCreate, type TaskCreateOperations } from "@/server/tasks/create-task-core";
import * as schema from "@/server/db/schema";
import { captureTaskCreated, type CaptureConfig } from "@/server/sponsored-use/capture";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";
import { executeConversationBatch, type ConversationSqlStatement } from "./database";
import { conversationProjectWriteFencesClear, type ConversationWriteFenceIdentity } from "./write-fences";

export type PromoteMessageToTaskInput = Readonly<{
  clientRequestId: string;
  sourceProjectId: ProjectId;
  conversationId: string;
  messageId: string;
  expectedRevision: number;
  expectedAudienceEpoch: number;
  destinationProjectId: ProjectId;
  title: string;
  ownerUserId: string;
  dueDate: CalendarDate;
}>;

export type TaskOutcomeReceipt = Readonly<{
  taskId: string;
  workLinkId: string;
  clientRequestId: string;
  committedAt: number;
}>;

export type TaskReceiptLookup = Readonly<
  | { state: "absent" }
  | { state: "committed"; receipt: TaskOutcomeReceipt; taskAvailable: boolean }
>;

export type TaskOutcomeLink = Readonly<{
  taskId: string;
  sourceProjectId: ProjectId;
  conversationId: string;
  messageId: string;
  sourceRevision: number;
  sourceAudienceEpoch: number;
  destinationProjectId: ProjectId;
  createdBy: string;
  createdAt: number;
}>;

export type TaskDestination = Readonly<{
  projectId: ProjectId;
  name: string;
  members: readonly Readonly<{ id: string; name: string }>[];
}>;

type Seam = "task" | "activity" | "link" | "outbox" | "receipt";
const fail = (code: Exclude<ConversationResult<never>, { ok: true }>["code"]) => ({ ok: false, code } as const);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const asNumber = (value: unknown) => Number(value);

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

function normalizedInput(input: PromoteMessageToTaskInput) {
  const title = input.title.replace(/\r\n?/g, "\n");
  if (!validRequestId(input.clientRequestId) || !isProjectId(input.sourceProjectId) ||
      !isProjectId(input.destinationProjectId) || !validIdentity(input.conversationId) ||
      !validIdentity(input.messageId) || !validIdentity(input.ownerUserId) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 ||
      !Number.isSafeInteger(input.expectedAudienceEpoch) || input.expectedAudienceEpoch < 1 ||
      !title.trim() || title.includes("\u0000") || Array.from(title).length > 1_000 ||
      !isCalendarDate(input.dueDate)) return null;
  return { ...input, title };
}

async function sourceAndDestination(
  executor: ConversationSqlExecutor,
  actorId: string,
  input: PromoteMessageToTaskInput,
  directMessagesEnabled: boolean,
): Promise<ReadonlyMap<string, ConversationWriteFenceIdentity> | "unavailable" | "archived" | "audience_changed" | "revision_conflict"> {
  // Both proofs belong to this open write transaction. A missing destination
  // stays a nullable result so source errors retain their existing precedence.
  const source = await executor.execute({
    sql: `SELECT c.audience_epoch, c.lifecycle, c.kind, sw.archived_at, m.revision, m.deleted_at,
        actor.id AS actor_id, actor.clerk_id AS actor_clerk_id,
        source_owner.id AS source_owner_id, source_owner.clerk_id AS source_owner_clerk_id,
        destination.destination_project_id, destination.destination_archived_at, destination.destination_owner_user_id,
        destination.project_owner_id AS destination_project_owner_id, destination.project_owner_clerk_id AS destination_project_owner_clerk_id
      FROM conversations c
      JOIN workspaces sw ON sw.id = c.workspace_id
      JOIN workspace_members sm ON sm.workspace_id = c.workspace_id AND sm.user_id = ?
      JOIN users actor ON actor.id = sm.user_id
      LEFT JOIN users source_owner ON source_owner.id = sw.owner_user_id
      LEFT JOIN conversation_participants participant ON participant.conversation_id=c.id AND participant.user_id=actor.id
      JOIN conversation_messages m ON m.id = ? AND m.conversation_id = c.id AND m.workspace_id = c.workspace_id
      LEFT JOIN (
        SELECT dw.id AS destination_project_id, dw.archived_at AS destination_archived_at,
          owner_user.id AS destination_owner_user_id,
          project_owner.id AS project_owner_id, project_owner.clerk_id AS project_owner_clerk_id
        FROM workspaces dw
        JOIN workspace_members actor_member ON actor_member.workspace_id = dw.id AND actor_member.user_id = ?
        JOIN users destination_actor ON destination_actor.id = actor_member.user_id
        LEFT JOIN users project_owner ON project_owner.id = dw.owner_user_id
        LEFT JOIN workspace_members owner ON owner.workspace_id = dw.id AND owner.user_id = ?
        LEFT JOIN users owner_user ON owner_user.id = owner.user_id
        WHERE dw.id = ?
      ) destination ON 1 = 1
      WHERE c.id = ? AND c.workspace_id = ? AND (c.kind='project' OR
        (?=1 AND c.kind='dm' AND actor.id IN(c.dm_low_user_id,c.dm_high_user_id) AND participant.retains_history=1
          AND participant.status='active' AND c.pair_state NOT IN('pending','declined')))`,
    args: [actorId, input.messageId, actorId, input.ownerUserId, input.destinationProjectId,
      input.conversationId, input.sourceProjectId, directMessagesEnabled ? 1 : 0],
  });
  const row = source.rows[0];
  if (!row) return "unavailable";
  if (row.archived_at != null || row.lifecycle !== "active") return "archived";
  if (asNumber(row.audience_epoch) !== input.expectedAudienceEpoch) return "audience_changed";
  if (asNumber(row.revision) !== input.expectedRevision || row.deleted_at != null) return "revision_conflict";

  if (!row.destination_project_id || !row.destination_owner_user_id) return "unavailable";
  if (row.destination_archived_at != null) return "archived";
  return new Map([
    [input.sourceProjectId, { actor_id: row.actor_id, actor_clerk_id: row.actor_clerk_id,
      owner_id: row.source_owner_id, owner_clerk_id: row.source_owner_clerk_id }],
    [input.destinationProjectId, { actor_id: row.actor_id, actor_clerk_id: row.actor_clerk_id,
      owner_id: row.destination_project_owner_id, owner_clerk_id: row.destination_project_owner_clerk_id }],
  ]);
}

function taskInsertStatement(task: CanonicalTaskCreate, position?: number): ConversationSqlStatement {
  const inlinePosition = position === undefined;
  return {
    sql: `INSERT INTO tasks
      (id, workspace_id, seq, title, description, lane, priority, assignees, due, due_at, estimate, tags,
       recurrence, position, parent_task_id, external_contact_name, external_contact_email, cents,
       completed_at, is_milestone, created_at, updated_at)
      VALUES (?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM tasks WHERE workspace_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ${inlinePosition ? "(SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE workspace_id = ? AND lane = ?)" : "?"}, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING seq, position`,
    args: [task.id, task.workspaceId, task.workspaceId, task.title, task.description, task.lane, task.priority,
      JSON.stringify(task.assignees), task.due, task.dueAtSeconds, task.estimate,
      task.tags == null ? null : JSON.stringify(task.tags), task.recurrence == null ? null : JSON.stringify(task.recurrence),
      ...(inlinePosition ? [task.workspaceId, task.lane] : [position!]),
      task.parentTaskId, task.externalContactName, task.externalContactEmail, task.cents,
      task.completedAtSeconds, task.isMilestone ? 1 : 0, task.createdAtSeconds, task.createdAtSeconds],
  };
}

function taskActivityStatement(task: CanonicalTaskCreate, actorId: string): ConversationSqlStatement {
  return {
    sql: `INSERT INTO activities(id, workspace_id, task_id, user_id, kind, payload, created_at)
      VALUES (?, ?, ?, ?, 'taskAdd', ?, ?)`,
    args: [`a-${hash([task.id, "taskAdd"]).slice(0, 16)}`, task.workspaceId, task.id, actorId,
      JSON.stringify({ kind: "taskAdd", lane: task.lane }), task.createdAtSeconds],
  };
}

function rawTaskOperations(
  executor: ConversationSqlExecutor,
  actorId: string,
  afterWrite?: (seam: Seam) => void | Promise<void>,
): TaskCreateOperations {
  return {
    ...(executor.batch && !afterWrite ? {
      async insertTaskAndActivity(task: CanonicalTaskCreate) {
        const results = await executeConversationBatch(executor, [taskInsertStatement(task), taskActivityStatement(task, actorId)]);
        const row = results[0].rows[0];
        if (results[0].rows.length !== 1 || !row || !Number.isSafeInteger(asNumber(row.seq)) || asNumber(row.seq) < 1 ||
            !Number.isFinite(asNumber(row.position)) || results[1].rowsAffected !== 1) throw new Error("conversation_task_allocation_invalid");
        return { seq: asNumber(row.seq), position: asNumber(row.position) };
      },
    } : {}),
    async nextPosition(task) {
      const result = await executor.execute({
        sql: "SELECT COALESCE(MAX(position), 0) + 1 AS position FROM tasks WHERE workspace_id = ? AND lane = ?",
        args: [task.workspaceId, task.lane],
      });
      return asNumber(result.rows[0]?.position ?? 1);
    },
    async insertTask(task) {
      const inserted = await executor.execute(taskInsertStatement(task, task.position));
      await afterWrite?.("task");
      return { seq: asNumber(inserted.rows[0]?.seq) };
    },
    async insertActivity(task) {
      await executor.execute(taskActivityStatement(task, actorId));
      await afterWrite?.("activity");
    },
  };
}

async function findStoredReceipt(
  executor: ConversationSqlExecutor,
  actorId: string,
  clientRequestId: string,
): Promise<Record<string, unknown> | null> {
  const result = await executor.execute({
    sql: `SELECT payload_hash, source_project_id, source_conversation_id, destination_project_id, task_id, work_link_id, committed_at
      FROM work_operation_receipts
      WHERE actor_id = ? AND client_request_id = ? AND operation = 'conversation_task'`,
    args: [actorId, clientRequestId],
  });
  return result.rows[0] ?? null;
}

async function actorCanRecoverReceipt(
  executor: ConversationSqlExecutor,
  actorId: string,
  receipt: Record<string, unknown>,
  directMessagesEnabled: boolean,
): Promise<boolean> {
  const sourceConversationId = receipt.source_conversation_id == null
    ? null
    : String(receipt.source_conversation_id);
  const result = await executor.execute({
    sql: `SELECT actor.id FROM users actor
      JOIN workspaces source_project ON source_project.id = ?
      JOIN workspaces destination_project ON destination_project.id = ?
      JOIN workspace_members source_member ON source_member.user_id = actor.id AND source_member.workspace_id = ?
      JOIN workspace_members destination_member ON destination_member.user_id = actor.id AND destination_member.workspace_id = ?
      LEFT JOIN conversations source_conversation ON source_conversation.id=? AND source_conversation.workspace_id=source_project.id
      LEFT JOIN conversation_participants participant ON participant.conversation_id=source_conversation.id AND participant.user_id=actor.id
      WHERE actor.id = ? AND (? IS NULL OR source_conversation.kind='project' OR (?=1 AND source_conversation.kind='dm'
        AND actor.id IN(source_conversation.dm_low_user_id,source_conversation.dm_high_user_id)
        AND participant.status='active' AND participant.retains_history=1 AND source_conversation.pair_state NOT IN('pending','declined')))`,
    args: [String(receipt.source_project_id), String(receipt.destination_project_id), String(receipt.source_project_id),
      String(receipt.destination_project_id), sourceConversationId, actorId, sourceConversationId, directMessagesEnabled ? 1 : 0],
  });
  return Boolean(result.rows[0]);
}

function receiptValue(row: Record<string, unknown>, clientRequestId: string): TaskOutcomeReceipt {
  return { taskId: String(row.task_id), workLinkId: String(row.work_link_id), clientRequestId,
    committedAt: asNumber(row.committed_at) };
}

async function taskIsAvailable(executor: ConversationSqlExecutor, receipt: Record<string, unknown>): Promise<boolean> {
  const result = await executor.execute({
    sql: "SELECT 1 AS available FROM tasks WHERE id = ? AND workspace_id = ?",
    args: [String(receipt.task_id), String(receipt.destination_project_id)],
  });
  return Boolean(result.rows[0]);
}

export function createConversationTaskOutcomeService(
  adapter: ConversationDatabaseAdapter,
  options: Readonly<{ afterWrite?: (seam: Seam) => void | Promise<void>; captureConfig?: CaptureConfig; directMessagesEnabled?: boolean }> = {},
) {
  const directMessagesEnabled = options.directMessagesEnabled ?? false;
  async function promoteMessageToTask(args: Readonly<{ actorId: string; input: PromoteMessageToTaskInput }>): Promise<ConversationResult<TaskOutcomeReceipt>> {
    const input = normalizedInput(args.input);
    if (!validIdentity(args.actorId) || !input) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    const payloadHash = hash(["conversation_task_v1", args.actorId, input.clientRequestId, input.sourceProjectId,
      input.conversationId, input.messageId, input.expectedRevision, input.expectedAudienceEpoch,
      input.destinationProjectId, input.title, input.ownerUserId, input.dueDate]);
    try {
      return await adapter.transaction("write", async (executor) => {
        const existing = await findStoredReceipt(executor, args.actorId, input.clientRequestId);
        if (existing) {
          if (!await actorCanRecoverReceipt(executor, args.actorId, existing, directMessagesEnabled)) return fail("unavailable");
          if (existing.payload_hash !== payloadHash) return fail("request_conflict");
          return { ok: true, value: receiptValue(existing, input.clientRequestId) };
        }
        const access = await sourceAndDestination(executor, args.actorId, input, directMessagesEnabled);
        if (typeof access === "string") return fail(access);
        if (!await conversationProjectWriteFencesClear(executor, args.actorId,
          [input.sourceProjectId, input.destinationProjectId], access)) return fail("unavailable");
        const taskId = `t-${hash(["conversation_task", args.actorId, input.clientRequestId]).slice(0, 24)}`;
        const workLinkId = `work-${hash([taskId, input.messageId, input.expectedRevision]).slice(0, 24)}`;
        const committedAt = Date.now();
        const [year, month, day] = input.dueDate.split("-").map(Number);
        const task = prepareCanonicalTaskCreate({ id: taskId, workspaceId: input.destinationProjectId,
          title: input.title, lane: "todo", priority: "p2", assignees: [input.ownerUserId], due: input.dueDate,
          dueAt: new Date(Date.UTC(year, month - 1, day, 12)), tags: [], isMilestone: false,
          createdAt: new Date(committedAt) });
        await createTaskInTransaction(rawTaskOperations(executor, args.actorId, options.afterWrite), task);
        // Drizzle uses the same transaction executor; this never opens its own
        // connection. January's canonical venue-claim capture stays atomic
        // with the Task and cannot emit a duplicate on receipt replay.
        const captureDb = drizzle(executor as unknown as Client, { schema });
        await captureTaskCreated(captureDb, { actorUserId: args.actorId, projectId: input.destinationProjectId }, options.captureConfig);
        const writes: ConversationSqlStatement[] = [{
          sql: `INSERT INTO work_links(id, source_project_id, source_conversation_id, source_message_id,
            source_revision, source_audience_epoch, destination_project_id, task_id, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [workLinkId, input.sourceProjectId, input.conversationId, input.messageId, input.expectedRevision,
            input.expectedAudienceEpoch, input.destinationProjectId, taskId, args.actorId, committedAt],
        }];
        const eventId = `event-${hash(["conversation_task", taskId]).slice(0, 24)}`;
        writes.push({
          sql: `INSERT INTO suite_outbox(id, event_id, version, type, actor_user_id, workspace_id,
            object_ref, payload, trace_id, occurred_at, delivered_at, attempts, last_error)
            VALUES (?, ?, 1, 'task.created', ?, ?, ?, ?, ?, ?, NULL, 0, NULL)`,
          args: [eventId, eventId, args.actorId, input.destinationProjectId,
            JSON.stringify({ taskId, workLinkId }), JSON.stringify({ source: "conversation_message" }),
            input.clientRequestId, committedAt],
        });
        writes.push({
          sql: `INSERT INTO work_operation_receipts(actor_id, client_request_id, operation, payload_hash,
            source_project_id, source_conversation_id, destination_project_id, task_id, work_link_id, committed_at)
            VALUES (?, ?, 'conversation_task', ?, ?, ?, ?, ?, ?, ?)`,
          args: [args.actorId, input.clientRequestId, payloadHash, input.sourceProjectId,
            input.conversationId, input.destinationProjectId, taskId, workLinkId, committedAt],
        });
        if (options.afterWrite) {
          // Preserve per-statement fault seams; the batch path has separate
          // persisted statement-error coverage, not deferred hook callbacks.
          const seams = ["link", "outbox", "receipt"] as const;
          for (const [index, statement] of writes.entries()) {
            await executor.execute(statement);
            await options.afterWrite(seams[index]);
          }
        } else {
          await executeConversationBatch(executor, writes);
        }
        return { ok: true, value: { taskId, workLinkId, clientRequestId: input.clientRequestId, committedAt } };
      });
    } catch (error) {
      if (/SQLITE_BUSY|database is locked|conversation_database_unavailable/i.test(String(error))) return fail("temporarily_unavailable");
      throw error;
    }
  }

  async function getTaskReceipt(args: Readonly<{ actorId: string; clientRequestId: string }>): Promise<ConversationResult<TaskReceiptLookup>> {
    if (!validIdentity(args.actorId) || !validRequestId(args.clientRequestId)) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return adapter.transaction("read", async (executor) => {
      const receipt = await findStoredReceipt(executor, args.actorId, args.clientRequestId);
      if (!receipt) return { ok: true, value: { state: "absent" } };
      if (!await actorCanRecoverReceipt(executor, args.actorId, receipt, directMessagesEnabled)) return fail("unavailable");
      return { ok: true, value: { state: "committed", receipt: receiptValue(receipt, args.clientRequestId),
        taskAvailable: await taskIsAvailable(executor, receipt) } };
    });
  }

  async function getTaskOutcome(args: Readonly<{ actorId: string; taskId: string }>): Promise<ConversationResult<TaskOutcomeLink | null>> {
    if (!validIdentity(args.actorId) || !validIdentity(args.taskId)) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return adapter.transaction("read", async (executor) => {
      const result = await executor.execute({
        sql: `SELECT l.* FROM work_links l
          JOIN users actor ON actor.id = ?
          JOIN workspaces source_project ON source_project.id = l.source_project_id
          JOIN workspaces destination_project ON destination_project.id = l.destination_project_id
          JOIN workspace_members source_member ON source_member.workspace_id = l.source_project_id AND source_member.user_id = actor.id
          JOIN workspace_members destination_member ON destination_member.workspace_id = l.destination_project_id AND destination_member.user_id = actor.id
          JOIN conversations source_conversation ON source_conversation.id = l.source_conversation_id
            AND source_conversation.workspace_id = l.source_project_id
          LEFT JOIN conversation_participants participant ON participant.conversation_id=source_conversation.id AND participant.user_id=actor.id
          JOIN conversation_messages source_message ON source_message.id = l.source_message_id
            AND source_message.conversation_id = l.source_conversation_id
            AND source_message.workspace_id = l.source_project_id AND source_message.deleted_at IS NULL
          JOIN tasks destination_task ON destination_task.id = l.task_id
            AND destination_task.workspace_id = l.destination_project_id
          WHERE l.task_id = ? AND (source_conversation.kind='project' OR (?=1 AND source_conversation.kind='dm'
            AND actor.id IN(source_conversation.dm_low_user_id,source_conversation.dm_high_user_id)
            AND participant.status='active' AND participant.retains_history=1
            AND source_conversation.pair_state NOT IN('pending','declined')))`, args: [args.actorId, args.taskId, directMessagesEnabled ? 1 : 0],
      });
      const row = result.rows[0];
      if (!row) return { ok: true, value: null };
      return { ok: true, value: { taskId: String(row.task_id), sourceProjectId: String(row.source_project_id) as ProjectId,
        conversationId: String(row.source_conversation_id), messageId: String(row.source_message_id),
        sourceRevision: asNumber(row.source_revision), sourceAudienceEpoch: asNumber(row.source_audience_epoch),
        destinationProjectId: String(row.destination_project_id) as ProjectId, createdBy: String(row.created_by),
        createdAt: asNumber(row.created_at) } };
    });
  }

  async function getTaskDestination(args: Readonly<{ actorId: string; projectId: ProjectId }>): Promise<ConversationResult<TaskDestination>> {
    if (!validIdentity(args.actorId) || !isProjectId(args.projectId)) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return adapter.transaction("read", async (executor) => {
      const project = await executor.execute({
        sql: `SELECT w.name, w.archived_at FROM workspaces w
          JOIN workspace_members actor_member ON actor_member.workspace_id = w.id AND actor_member.user_id = ?
          JOIN users actor ON actor.id = actor_member.user_id WHERE w.id = ?`,
        args: [args.actorId, args.projectId],
      });
      const row = project.rows[0];
      if (!row) return fail("unavailable");
      if (row.archived_at != null) return fail("archived");
      const members = await executor.execute({
        sql: `SELECT u.id, COALESCE(NULLIF(u.name, ''), NULLIF(u.handle, ''), u.initials) AS name
          FROM workspace_members wm JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = ? ORDER BY name COLLATE NOCASE, u.id`, args: [args.projectId],
      });
      return { ok: true, value: { projectId: args.projectId, name: String(row.name),
        members: members.rows.map((member) => ({ id: String(member.id), name: String(member.name) })) } };
    });
  }

  return { promoteMessageToTask, getTaskReceipt, getTaskOutcome, getTaskDestination };
}
