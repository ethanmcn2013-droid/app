import "server-only";

import { createHash } from "node:crypto";
import type { ConversationResult } from "@/lib/conversations/contracts";
import { validRequestId } from "@/lib/conversations/contracts";
import { isCalendarDate, type CalendarDate } from "@/lib/planning/dates";
import { isProjectId, type ProjectId } from "@/lib/projects/project-ref";
import { createTaskInTransaction, prepareCanonicalTaskCreate, type TaskCreateOperations } from "@/server/tasks/create-task-core";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";

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
): Promise<"ok" | "unavailable" | "archived" | "audience_changed" | "revision_conflict"> {
  const source = await executor.execute({
    sql: `SELECT c.audience_epoch, c.lifecycle, sw.archived_at, m.revision, m.deleted_at
      FROM conversations c
      JOIN workspaces sw ON sw.id = c.workspace_id
      JOIN workspace_members sm ON sm.workspace_id = c.workspace_id AND sm.user_id = ?
      JOIN users actor ON actor.id = sm.user_id
      JOIN conversation_messages m ON m.id = ? AND m.conversation_id = c.id AND m.workspace_id = c.workspace_id
      WHERE c.id = ? AND c.workspace_id = ? AND c.kind = 'project'`,
    args: [actorId, input.messageId, input.conversationId, input.sourceProjectId],
  });
  const row = source.rows[0];
  if (!row) return "unavailable";
  if (row.archived_at != null || row.lifecycle !== "active") return "archived";
  if (asNumber(row.audience_epoch) !== input.expectedAudienceEpoch) return "audience_changed";
  if (asNumber(row.revision) !== input.expectedRevision || row.deleted_at != null) return "revision_conflict";

  const destination = await executor.execute({
    sql: `SELECT dw.archived_at, owner.user_id AS owner_id
      FROM workspaces dw
      JOIN workspace_members actor_member ON actor_member.workspace_id = dw.id AND actor_member.user_id = ?
      JOIN users actor ON actor.id = actor_member.user_id
      LEFT JOIN workspace_members owner ON owner.workspace_id = dw.id AND owner.user_id = ?
      LEFT JOIN users owner_user ON owner_user.id = owner.user_id
      WHERE dw.id = ?`,
    args: [actorId, input.ownerUserId, input.destinationProjectId],
  });
  const destinationRow = destination.rows[0];
  if (!destinationRow || !destinationRow.owner_id) return "unavailable";
  return destinationRow.archived_at == null ? "ok" : "archived";
}

function rawTaskOperations(
  executor: ConversationSqlExecutor,
  actorId: string,
  afterWrite?: (seam: Seam) => void | Promise<void>,
): TaskCreateOperations {
  return {
    async nextPosition(task) {
      const result = await executor.execute({
        sql: "SELECT COALESCE(MAX(position), 0) + 1 AS position FROM tasks WHERE workspace_id = ? AND lane = ?",
        args: [task.workspaceId, task.lane],
      });
      return asNumber(result.rows[0]?.position ?? 1);
    },
    async insertTask(task) {
      const inserted = await executor.execute({
        sql: `INSERT INTO tasks
          (id, workspace_id, seq, title, description, lane, priority, assignees, due, due_at, estimate, tags,
           recurrence, position, parent_task_id, external_contact_name, external_contact_email, cents,
           completed_at, is_milestone, created_at, updated_at)
          VALUES (?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM tasks WHERE workspace_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING seq`,
        args: [task.id, task.workspaceId, task.workspaceId, task.title, task.description, task.lane, task.priority,
          JSON.stringify(task.assignees), task.due, task.dueAtSeconds, task.estimate,
          task.tags == null ? null : JSON.stringify(task.tags), task.recurrence == null ? null : JSON.stringify(task.recurrence),
          task.position, task.parentTaskId, task.externalContactName, task.externalContactEmail, task.cents,
          task.completedAtSeconds, task.isMilestone ? 1 : 0, task.createdAtSeconds, task.createdAtSeconds],
      });
      await afterWrite?.("task");
      return { seq: asNumber(inserted.rows[0]?.seq) };
    },
    async insertActivity(task) {
      await executor.execute({
        sql: `INSERT INTO activities(id, workspace_id, task_id, user_id, kind, payload, created_at)
          VALUES (?, ?, ?, ?, 'taskAdd', ?, ?)`,
        args: [`a-${hash([task.id, "taskAdd"]).slice(0, 16)}`, task.workspaceId, task.id, actorId,
          JSON.stringify({ kind: "taskAdd", lane: task.lane }), task.createdAtSeconds],
      });
      await afterWrite?.("activity");
    },
  };
}

export function createConversationTaskOutcomeService(
  adapter: ConversationDatabaseAdapter,
  options: Readonly<{ afterWrite?: (seam: Seam) => void | Promise<void> }> = {},
) {
  async function promoteMessageToTask(args: Readonly<{ actorId: string; input: PromoteMessageToTaskInput }>): Promise<ConversationResult<TaskOutcomeReceipt>> {
    const input = normalizedInput(args.input);
    if (!validIdentity(args.actorId) || !input) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    const payloadHash = hash(["conversation_task_v1", args.actorId, input.clientRequestId, input.sourceProjectId,
      input.conversationId, input.messageId, input.expectedRevision, input.expectedAudienceEpoch,
      input.destinationProjectId, input.title, input.ownerUserId, input.dueDate]);
    try {
      return await adapter.transaction("write", async (executor) => {
        const access = await sourceAndDestination(executor, args.actorId, input);
        if (access !== "ok") return fail(access);
        const existing = await executor.execute({
          sql: `SELECT payload_hash, task_id, work_link_id, committed_at FROM work_operation_receipts
            WHERE actor_id = ? AND client_request_id = ? AND operation = 'conversation_task'`,
          args: [args.actorId, input.clientRequestId],
        });
        if (existing.rows[0]) {
          if (existing.rows[0].payload_hash !== payloadHash) return fail("request_conflict");
          return { ok: true, value: { taskId: String(existing.rows[0].task_id), workLinkId: String(existing.rows[0].work_link_id),
            clientRequestId: input.clientRequestId, committedAt: asNumber(existing.rows[0].committed_at) } };
        }
        const taskId = `t-${hash(["conversation_task", args.actorId, input.clientRequestId]).slice(0, 24)}`;
        const workLinkId = `work-${hash([taskId, input.messageId, input.expectedRevision]).slice(0, 24)}`;
        const committedAt = Date.now();
        const [year, month, day] = input.dueDate.split("-").map(Number);
        const task = prepareCanonicalTaskCreate({ id: taskId, workspaceId: input.destinationProjectId,
          title: input.title, lane: "todo", priority: "p2", assignees: [input.ownerUserId], due: input.dueDate,
          dueAt: new Date(Date.UTC(year, month - 1, day, 12)), tags: [], isMilestone: false,
          createdAt: new Date(committedAt) });
        await createTaskInTransaction(rawTaskOperations(executor, args.actorId, options.afterWrite), task);
        await executor.execute({
          sql: `INSERT INTO work_links(id, source_project_id, source_conversation_id, source_message_id,
            source_revision, source_audience_epoch, destination_project_id, task_id, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [workLinkId, input.sourceProjectId, input.conversationId, input.messageId, input.expectedRevision,
            input.expectedAudienceEpoch, input.destinationProjectId, taskId, args.actorId, committedAt],
        });
        await options.afterWrite?.("link");
        const eventId = `event-${hash(["conversation_task", taskId]).slice(0, 24)}`;
        await executor.execute({
          sql: `INSERT INTO suite_outbox(id, event_id, version, type, actor_user_id, workspace_id,
            object_ref, payload, trace_id, occurred_at, delivered_at, attempts, last_error)
            VALUES (?, ?, 1, 'task.created', ?, ?, ?, ?, ?, ?, NULL, 0, NULL)`,
          args: [eventId, eventId, args.actorId, input.destinationProjectId,
            JSON.stringify({ taskId, workLinkId }), JSON.stringify({ source: "conversation_message" }),
            input.clientRequestId, committedAt],
        });
        await options.afterWrite?.("outbox");
        await executor.execute({
          sql: `INSERT INTO work_operation_receipts(actor_id, client_request_id, operation, payload_hash,
            task_id, work_link_id, committed_at) VALUES (?, ?, 'conversation_task', ?, ?, ?, ?)`,
          args: [args.actorId, input.clientRequestId, payloadHash, taskId, workLinkId, committedAt],
        });
        await options.afterWrite?.("receipt");
        return { ok: true, value: { taskId, workLinkId, clientRequestId: input.clientRequestId, committedAt } };
      });
    } catch (error) {
      if (/SQLITE_BUSY|database is locked|conversation_database_unavailable/i.test(String(error))) return fail("temporarily_unavailable");
      throw error;
    }
  }

  async function getTaskOutcome(args: Readonly<{ actorId: string; taskId: string }>): Promise<ConversationResult<TaskOutcomeLink | null>> {
    if (!validIdentity(args.actorId) || !validIdentity(args.taskId)) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return adapter.transaction("read", async (executor) => {
      const result = await executor.execute({
        sql: `SELECT l.* FROM work_links l
          JOIN users actor ON actor.id = ?
          JOIN workspace_members source_member ON source_member.workspace_id = l.source_project_id AND source_member.user_id = actor.id
          JOIN workspace_members destination_member ON destination_member.workspace_id = l.destination_project_id AND destination_member.user_id = actor.id
          WHERE l.task_id = ?`, args: [args.actorId, args.taskId],
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

  return { promoteMessageToTask, getTaskOutcome, getTaskDestination };
}
