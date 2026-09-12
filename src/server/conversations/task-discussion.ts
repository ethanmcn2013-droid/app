import "server-only";

import { createHash } from "node:crypto";
import type { ConversationResult } from "@/lib/conversations/contracts";
import { validRequestId, validSequence } from "@/lib/conversations/contracts";
import type {
  EditTaskCommentInput,
  SendTaskCommentInput,
  TaskCommentMutationReceipt,
  TaskCommentPage,
  TaskCommentReceipt,
  TaskCommentReceiptLookup,
  TaskCommentRecord,
  TaskDiscussionDelta,
  TaskDiscussionSnapshot,
  TombstoneTaskCommentInput,
} from "@/lib/conversations/task-discussion-contracts";
import {
  normalizeTaskCommentBody,
  TASK_DISCUSSION_LIMITS,
  validTaskCommentBody,
} from "@/lib/conversations/task-discussion-contracts";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";

type FailureCode = Exclude<ConversationResult<never>, { ok: true }>["code"];
type ActorTask = Readonly<{ actorId: string; taskId: string }>;
type TaskScope = Readonly<{
  taskId: string;
  projectId: string;
  projectName: string;
  audienceEpoch: number;
  lifecycle: "active" | "archived";
  nextCreateSeq: number;
  nextChangeSeq: number;
}>;

const failure = <C extends FailureCode>(code: C) => ({ ok: false, code } as const);
const integer = (value: unknown) => typeof value === "bigint" ? Number(value) : Number(value);
const text = (value: unknown) => String(value);
const hashTuple = (parts: readonly unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const stableId = (prefix: string, parts: readonly unknown[]) =>
  `${prefix}_${hashTuple(parts).slice(0, 32)}`;

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

function normalizedMentions(value: readonly string[]): string[] | null {
  if (!Array.isArray(value) || value.length > TASK_DISCUSSION_LIMITS.mentionsMaximum ||
      value.some((id) => !validIdentity(id))) return null;
  return [...new Set(value)].sort();
}

function taskCommentFromRow(row: Record<string, unknown>): TaskCommentRecord {
  return {
    id: text(row.id),
    taskId: text(row.task_id),
    authorId: text(row.user_id),
    authorName: text(row.author_name),
    rootCommentId: row.root_id == null ? null : text(row.root_id),
    createSeq: integer(row.create_seq),
    revision: integer(row.revision),
    body: row.deleted_at == null ? text(row.body) : null,
    createdAt: integer(row.created_at) * 1_000,
    editedAt: row.edited_at == null ? null : integer(row.edited_at),
    deletedAt: row.deleted_at == null ? null : integer(row.deleted_at),
    mentionUserIds: typeof row.mention_user_ids === "string"
      ? JSON.parse(row.mention_user_ids) as string[]
      : [],
  };
}

function taskScopeFromRow(row: Record<string, unknown>): TaskScope {
  return {
    taskId: text(row.task_id),
    projectId: text(row.workspace_id),
    projectName: text(row.workspace_name),
    audienceEpoch: integer(row.audience_epoch),
    lifecycle: row.task_archived_at == null && row.workspace_archived_at == null ? "active" : "archived",
    nextCreateSeq: integer(row.next_create_seq),
    nextChangeSeq: integer(row.next_change_seq),
  };
}

async function authorizeTask(
  executor: ConversationSqlExecutor,
  input: ActorTask,
): Promise<ConversationResult<TaskScope>> {
  const result = await executor.execute({
    sql: `SELECT t.id AS task_id, t.workspace_id, t.archived_at AS task_archived_at,
        w.name AS workspace_name, w.archived_at AS workspace_archived_at,
        s.audience_epoch, s.next_create_seq, s.next_change_seq
      FROM tasks t
      JOIN workspaces w ON w.id = t.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      JOIN users actor ON actor.id = wm.user_id
      JOIN task_discussion_state s ON s.task_id = t.id AND s.workspace_id = t.workspace_id
      WHERE t.id = ?`,
    args: [input.actorId, input.taskId],
  });
  return result.rows[0]
    ? { ok: true, value: taskScopeFromRow(result.rows[0]) }
    : failure("unavailable");
}

function writeGate(scope: TaskScope, expectedAudienceEpoch: number): ConversationResult<true> {
  if (scope.lifecycle === "archived") return failure("archived");
  if (!Number.isSafeInteger(expectedAudienceEpoch) || expectedAudienceEpoch !== scope.audienceEpoch) {
    return failure("audience_changed");
  }
  return { ok: true, value: true };
}

async function validateMentionMembers(
  executor: ConversationSqlExecutor,
  projectId: string,
  mentions: readonly string[],
): Promise<boolean> {
  if (mentions.length === 0) return true;
  const result = await executor.execute({
    sql: `SELECT wm.user_id FROM workspace_members wm JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ? AND wm.user_id IN (${mentions.map(() => "?").join(", ")})`,
    args: [projectId, ...mentions],
  });
  return result.rows.length === mentions.length;
}

async function findReceipt(
  executor: ConversationSqlExecutor,
  input: ActorTask & { clientRequestId: string },
): Promise<Record<string, unknown> | null> {
  const result = await executor.execute({
    sql: `SELECT operation, payload_hash, comment_id, client_request_id, create_seq,
        change_seq, revision, committed_at_ms
      FROM task_comment_receipts
      WHERE task_id = ? AND actor_id = ? AND client_request_id = ?`,
    args: [input.taskId, input.actorId, input.clientRequestId],
  });
  return result.rows[0] ?? null;
}

function mutationReceipt(row: Record<string, unknown>): TaskCommentMutationReceipt {
  return {
    commentId: text(row.comment_id),
    clientRequestId: text(row.client_request_id),
    changeSeq: integer(row.change_seq),
    revision: integer(row.revision),
    committedAt: integer(row.committed_at_ms),
  };
}

function sendReceipt(row: Record<string, unknown>): TaskCommentReceipt {
  return { ...mutationReceipt(row), createSeq: integer(row.create_seq) };
}

function isTransientDatabaseError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  return /SQLITE_BUSY|DATABASE_BUSY|database is locked|conversation_database_unavailable/i.test(
    `${candidate?.code ?? ""} ${candidate?.message ?? ""}`,
  );
}

export function createTaskDiscussionService(adapter: ConversationDatabaseAdapter) {
  async function inTransaction<T>(
    mode: "read" | "write",
    operation: (executor: ConversationSqlExecutor) => Promise<ConversationResult<T>>,
  ): Promise<ConversationResult<T>> {
    if (!adapter.available) return failure("temporarily_unavailable");
    try {
      return await adapter.transaction(mode, operation);
    } catch (error) {
      if (isTransientDatabaseError(error)) return failure("temporarily_unavailable");
      throw error;
    }
  }

  async function openTaskDiscussion(
    input: ActorTask & { limit?: number },
  ): Promise<ConversationResult<TaskDiscussionSnapshot>> {
    const limit = input.limit ?? TASK_DISCUSSION_LIMITS.pageDefault;
    if (!validIdentity(input.actorId) || !validIdentity(input.taskId) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > TASK_DISCUSSION_LIMITS.pageMaximum) {
      return failure("invalid_input");
    }
    return inTransaction("write", async (executor) => {
      await executor.execute({
        sql: `INSERT OR IGNORE INTO task_discussion_state
          (task_id, workspace_id, audience_epoch, next_create_seq, next_change_seq)
          SELECT t.id, t.workspace_id, 1, 1, 1 FROM tasks t
          JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
          JOIN users u ON u.id = wm.user_id
          WHERE t.id = ? AND t.workspace_id IS NOT NULL`,
        args: [input.actorId, input.taskId],
      });
      const authorized = await authorizeTask(executor, input);
      if (!authorized.ok) return authorized;
      const members = await executor.execute({
        sql: `SELECT u.id, COALESCE(u.name, u.handle, substr(u.email, 1, instr(u.email, '@') - 1), 'Someone') AS name
          FROM workspace_members wm JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = ? ORDER BY lower(name), u.id`,
        args: [authorized.value.projectId],
      });
      const rows = await executor.execute({
        sql: `SELECT c.id,c.task_id,c.user_id,c.root_id,c.create_seq,c.revision,c.body,
            c.created_at,c.edited_at,c.deleted_at,
            COALESCE(u.name,u.handle,substr(u.email,1,instr(u.email,'@')-1),'Someone') AS author_name,
            COALESCE((SELECT json_group_array(a.recipient_id) FROM task_comment_attention a
              WHERE a.task_id=c.task_id AND a.comment_id=c.id AND (a.reason_bits & 1)=1),'[]') AS mention_user_ids
          FROM comments c JOIN users u ON u.id=c.user_id
          WHERE c.task_id=? AND c.workspace_id=? AND c.revision IS NOT NULL AND c.create_seq IS NOT NULL
          ORDER BY c.create_seq DESC LIMIT ?`,
        args: [input.taskId, authorized.value.projectId, limit + 1],
      });
      const comments = rows.rows.slice(0, limit).reverse().map(taskCommentFromRow);
      return { ok: true, value: {
        taskId: input.taskId,
        projectId: authorized.value.projectId,
        projectName: authorized.value.projectName,
        lifecycle: authorized.value.lifecycle,
        audienceEpoch: authorized.value.audienceEpoch,
        throughChangeSeq: authorized.value.nextChangeSeq - 1,
        members: members.rows.map((row) => ({ id: text(row.id), name: text(row.name) })),
        comments,
        hasOlder: rows.rows.length > limit,
        beforeCreateSeq: comments[0]?.createSeq ?? null,
      } };
    });
  }

  async function listProjectDiscussions(input: { actorId: string; projectId: string }): Promise<
    ConversationResult<readonly { taskId: string; title: string }[]>
  > {
    if (!validIdentity(input.actorId) || !validIdentity(input.projectId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await executor.execute({
        sql: `SELECT w.id FROM workspaces w
          JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=?
          JOIN users u ON u.id=wm.user_id
          WHERE w.id=? AND w.archived_at IS NULL`,
        args: [input.actorId, input.projectId],
      });
      if (!authorized.rows[0]) return failure("unavailable");
      const rows = await executor.execute({
        sql: `SELECT t.id AS task_id,t.title FROM tasks t
          JOIN task_discussion_state s ON s.task_id=t.id AND s.workspace_id=t.workspace_id
          WHERE t.workspace_id=? AND EXISTS (
            SELECT 1 FROM comments c WHERE c.task_id=t.id AND c.workspace_id=t.workspace_id
              AND c.revision IS NOT NULL AND c.create_seq IS NOT NULL
          ) ORDER BY lower(t.title),t.id LIMIT 100`,
        args: [input.projectId],
      });
      return { ok: true, value: rows.rows.map((row) => ({ taskId: text(row.task_id), title: text(row.title) })) };
    });
  }

  async function sendComment(args: {
    actorId: string;
    input: SendTaskCommentInput;
  }): Promise<ConversationResult<TaskCommentReceipt>> {
    const { actorId, input } = args;
    const body = typeof input?.body === "string" ? normalizeTaskCommentBody(input.body) : "";
    const mentions = normalizedMentions(input?.mentionUserIds ?? []);
    if (!validIdentity(actorId) || !input || !validIdentity(input.taskId) ||
        !validRequestId(input.clientRequestId) || !validTaskCommentBody(body) || mentions === null ||
        (input.rootCommentId !== null && !validIdentity(input.rootCommentId))) return failure("invalid_input");
    const payloadHash = hashTuple(["send", actorId, input.taskId, body, input.rootCommentId, mentions]);
    return inTransaction("write", async (executor) => {
      const authorized = await authorizeTask(executor, { actorId, taskId: input.taskId });
      if (!authorized.ok) return authorized;
      const prior = await findReceipt(executor, { actorId, taskId: input.taskId, clientRequestId: input.clientRequestId });
      if (prior) return prior.operation === "send" && prior.payload_hash === payloadHash
        ? { ok: true, value: sendReceipt(prior) }
        : failure("request_conflict");
      const gate = writeGate(authorized.value, input.expectedAudienceEpoch);
      if (!gate.ok) return gate;
      if (!await validateMentionMembers(executor, authorized.value.projectId, mentions)) return failure("invalid_input");
      let rootAuthorId: string | null = null;
      if (input.rootCommentId !== null) {
        const root = await executor.execute({
          sql: `SELECT user_id FROM comments WHERE id=? AND task_id=? AND workspace_id=?
            AND root_id IS NULL AND deleted_at IS NULL AND revision IS NOT NULL`,
          args: [input.rootCommentId, input.taskId, authorized.value.projectId],
        });
        if (!root.rows[0]) return failure("invalid_input");
        rootAuthorId = text(root.rows[0].user_id);
      }
      const createSeq = authorized.value.nextCreateSeq;
      const changeSeq = authorized.value.nextChangeSeq;
      const committedAt = Date.now();
      const createdAt = Math.floor(committedAt / 1_000);
      const commentId = stableId("comment", [input.taskId, actorId, input.clientRequestId]);
      await executor.execute({
        sql: `UPDATE task_discussion_state SET next_create_seq=next_create_seq+1,
          next_change_seq=next_change_seq+1 WHERE task_id=?`, args: [input.taskId],
      });
      await executor.execute({
        sql: `INSERT INTO comments
          (id,workspace_id,task_id,user_id,body,created_at,client_request_id,request_hash,
           revision,edited_at,deleted_at,root_id,create_seq)
          VALUES (?,?,?,?,?,?,?, ?,1,NULL,NULL,?,?)`,
        args: [commentId, authorized.value.projectId, input.taskId, actorId, body, createdAt,
          input.clientRequestId, payloadHash, input.rootCommentId, createSeq],
      });
      await executor.execute({
        sql: `INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at)
          VALUES (?,?,?,?, 'commentAdd', ?, ?)`,
        args: [stableId("activity", ["task-comment", commentId]), authorized.value.projectId,
          input.taskId, actorId, JSON.stringify({ kind: "commentAdd", commentId }), createdAt],
      });
      await executor.execute({
        sql: `INSERT INTO task_comment_changes
          (task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
          VALUES (?,?,'create',?,1,?,?)`,
        args: [input.taskId, changeSeq, commentId, authorized.value.audienceEpoch, committedAt],
      });
      const reasons = new Map<string, number>();
      for (const recipientId of mentions) if (recipientId !== actorId) reasons.set(recipientId, 1);
      if (rootAuthorId && rootAuthorId !== actorId) reasons.set(rootAuthorId, (reasons.get(rootAuthorId) ?? 0) | 2);
      for (const [recipientId, reasonBits] of reasons) {
        const eventId = stableId("task_comment_event", [input.taskId, commentId, recipientId]);
        await executor.execute({
          sql: `INSERT INTO task_comment_attention
            (id,event_id,task_id,workspace_id,recipient_id,comment_id,source_revision,root_id,create_seq,reason_bits)
            VALUES (?,?,?,?,?,?,1,?,?,?)`,
          args: [stableId("task_comment_attention", [eventId]), eventId, input.taskId,
            authorized.value.projectId, recipientId, commentId, input.rootCommentId, createSeq, reasonBits],
        });
        await executor.execute({
          sql: `INSERT INTO task_comment_outbox
            (id,event_id,task_id,workspace_id,recipient_id,comment_id,source_revision,audience_epoch,state,created_at_ms)
            VALUES (?,?,?,?,?,?,1,?,'pending',?)`,
          args: [stableId("task_comment_outbox", [eventId]), eventId, input.taskId,
            authorized.value.projectId, recipientId, commentId, authorized.value.audienceEpoch, committedAt],
        });
      }
      await executor.execute({
        sql: `INSERT INTO task_comment_receipts
          (task_id,actor_id,client_request_id,operation,payload_hash,comment_id,create_seq,change_seq,revision,committed_at_ms)
          VALUES (?,?,?,'send',?,?,?,?,1,?)`,
        args: [input.taskId, actorId, input.clientRequestId, payloadHash, commentId, createSeq, changeSeq, committedAt],
      });
      await executor.execute({ sql: "UPDATE tasks SET updated_at=? WHERE id=?", args: [createdAt, input.taskId] });
      return { ok: true, value: { commentId, clientRequestId: input.clientRequestId,
        createSeq, changeSeq, revision: 1, committedAt } };
    });
  }

  async function getReceipt(
    input: ActorTask & { clientRequestId: string },
  ): Promise<TaskCommentReceiptLookup> {
    if (!validIdentity(input.actorId) || !validIdentity(input.taskId) || !validRequestId(input.clientRequestId)) {
      return failure("invalid_input");
    }
    return inTransaction<
      { state: "committed"; receipt: TaskCommentReceipt } | { state: "absent" }
    >("read", async (executor) => {
      const authorized = await authorizeTask(executor, input);
      if (!authorized.ok) return authorized;
      const prior = await findReceipt(executor, input);
      return prior
        ? { ok: true, value: { state: "committed" as const, receipt: sendReceipt(prior) } }
        : { ok: true, value: { state: "absent" as const } };
    });
  }

  async function getCommentPage(
    input: ActorTask & { beforeCreateSeq?: number; limit?: number },
  ): Promise<ConversationResult<TaskCommentPage>> {
    const limit = input.limit ?? TASK_DISCUSSION_LIMITS.pageDefault;
    if (!validIdentity(input.actorId) || !validIdentity(input.taskId) || !Number.isSafeInteger(limit) ||
        limit < 1 || limit > TASK_DISCUSSION_LIMITS.pageMaximum ||
        (input.beforeCreateSeq !== undefined && (!validSequence(input.beforeCreateSeq) || input.beforeCreateSeq < 1))) {
      return failure("invalid_input");
    }
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeTask(executor, input);
      if (!authorized.ok) return authorized;
      const rows = await executor.execute({
        sql: `SELECT c.id,c.task_id,c.user_id,c.root_id,c.create_seq,c.revision,c.body,c.created_at,c.edited_at,c.deleted_at,
            COALESCE(u.name,u.handle,substr(u.email,1,instr(u.email,'@')-1),'Someone') AS author_name,
            COALESCE((SELECT json_group_array(a.recipient_id) FROM task_comment_attention a
              WHERE a.task_id=c.task_id AND a.comment_id=c.id AND (a.reason_bits & 1)=1),'[]') AS mention_user_ids
          FROM comments c JOIN users u ON u.id=c.user_id
          WHERE c.task_id=? AND c.workspace_id=? AND c.revision IS NOT NULL AND c.create_seq IS NOT NULL
            AND (? IS NULL OR c.create_seq < ?)
          ORDER BY c.create_seq DESC LIMIT ?`,
        args: [input.taskId, authorized.value.projectId, input.beforeCreateSeq ?? null,
          input.beforeCreateSeq ?? null, limit + 1],
      });
      const comments = rows.rows.slice(0, limit).reverse().map(taskCommentFromRow);
      return { ok: true, value: { audienceEpoch: authorized.value.audienceEpoch,
        throughChangeSeq: authorized.value.nextChangeSeq - 1, comments, hasOlder: rows.rows.length > limit,
        beforeCreateSeq: comments[0]?.createSeq ?? null } };
    });
  }

  async function getHistory(
    input: ActorTask & { afterChangeSeq: number; limit?: number },
  ): Promise<ConversationResult<TaskDiscussionDelta>> {
    const limit = input.limit ?? TASK_DISCUSSION_LIMITS.pageDefault;
    if (!validIdentity(input.actorId) || !validIdentity(input.taskId) || !validSequence(input.afterChangeSeq) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > TASK_DISCUSSION_LIMITS.pageMaximum) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeTask(executor, input);
      if (!authorized.ok) return authorized;
      if (input.afterChangeSeq > authorized.value.nextChangeSeq - 1) return failure("resync_required");
      const changes = await executor.execute({
        sql: `SELECT change_seq,comment_id FROM task_comment_changes
          WHERE task_id=? AND change_seq>? ORDER BY change_seq LIMIT ?`,
        args: [input.taskId, input.afterChangeSeq, limit + 1],
      });
      const page = changes.rows.slice(0, limit);
      const ids = [...new Set(page.map((row) => row.comment_id).filter((id): id is string => typeof id === "string"))];
      let comments: readonly TaskCommentRecord[] = [];
      if (ids.length) {
        const rows = await executor.execute({
          sql: `SELECT c.id,c.task_id,c.user_id,c.root_id,c.create_seq,c.revision,c.body,c.created_at,c.edited_at,c.deleted_at,
              COALESCE(u.name,u.handle,substr(u.email,1,instr(u.email,'@')-1),'Someone') AS author_name,
              COALESCE((SELECT json_group_array(a.recipient_id) FROM task_comment_attention a
                WHERE a.task_id=c.task_id AND a.comment_id=c.id AND (a.reason_bits & 1)=1),'[]') AS mention_user_ids
            FROM comments c JOIN users u ON u.id=c.user_id
            WHERE c.task_id=? AND c.workspace_id=? AND c.id IN (${ids.map(() => "?").join(",")})
            ORDER BY c.create_seq`,
          args: [input.taskId, authorized.value.projectId, ...ids],
        });
        comments = rows.rows.map(taskCommentFromRow);
      }
      return { ok: true, value: { audienceEpoch: authorized.value.audienceEpoch,
        throughChangeSeq: page.length ? integer(page[page.length - 1].change_seq) : input.afterChangeSeq,
        hasMore: changes.rows.length > limit, comments } };
    });
  }

  async function editComment(
    args: { actorId: string } & EditTaskCommentInput,
  ): Promise<ConversationResult<TaskCommentMutationReceipt>> {
    const body = typeof args.body === "string" ? normalizeTaskCommentBody(args.body) : "";
    const mentions = normalizedMentions(args.mentionUserIds ?? []);
    if (!validIdentity(args.actorId) || !validIdentity(args.taskId) || !validIdentity(args.commentId) ||
        !validRequestId(args.clientRequestId) || !validSequence(args.expectedRevision) || args.expectedRevision < 1 ||
        !validTaskCommentBody(body) || mentions === null) return failure("invalid_input");
    return mutateComment("edit", args, hashTuple(["edit", args.actorId, args.taskId, args.commentId, body, mentions]), body, mentions);
  }

  async function tombstoneComment(
    args: { actorId: string } & TombstoneTaskCommentInput,
  ): Promise<ConversationResult<TaskCommentMutationReceipt>> {
    if (!validIdentity(args.actorId) || !validIdentity(args.taskId) || !validIdentity(args.commentId) ||
        !validRequestId(args.clientRequestId) || !validSequence(args.expectedRevision) || args.expectedRevision < 1) {
      return failure("invalid_input");
    }
    return mutateComment("delete", args,
      hashTuple(["delete", args.actorId, args.taskId, args.commentId]), null, []);
  }

  async function mutateComment(
    operation: "edit" | "delete",
    args: { actorId: string } & TombstoneTaskCommentInput,
    payloadHash: string,
    body: string | null,
    mentions: readonly string[],
  ): Promise<ConversationResult<TaskCommentMutationReceipt>> {
    return inTransaction("write", async (executor) => {
      const authorized = await authorizeTask(executor, args);
      if (!authorized.ok) return authorized;
      const prior = await findReceipt(executor, args);
      if (prior) return prior.operation === operation && prior.payload_hash === payloadHash
        ? { ok: true, value: mutationReceipt(prior) }
        : failure("request_conflict");
      const gate = writeGate(authorized.value, args.expectedAudienceEpoch);
      if (!gate.ok) return gate;
      if (!await validateMentionMembers(executor, authorized.value.projectId, mentions)) return failure("invalid_input");
      const source = await executor.execute({
        sql: `SELECT user_id,root_id,create_seq,revision,deleted_at FROM comments
          WHERE id=? AND task_id=? AND workspace_id=? AND revision IS NOT NULL`,
        args: [args.commentId, args.taskId, authorized.value.projectId],
      });
      const row = source.rows[0];
      if (!row || row.user_id !== args.actorId) return failure("unavailable");
      if (row.deleted_at != null || integer(row.revision) !== args.expectedRevision) return failure("revision_conflict");
      const revision = args.expectedRevision + 1;
      const changeSeq = authorized.value.nextChangeSeq;
      const committedAt = Date.now();
      await executor.execute({ sql: "UPDATE task_discussion_state SET next_change_seq=next_change_seq+1 WHERE task_id=?", args: [args.taskId] });
      await executor.execute(operation === "edit" ? {
        sql: "UPDATE comments SET body=?,revision=?,edited_at=? WHERE id=?",
        args: [body, revision, committedAt, args.commentId],
      } : {
        sql: "UPDATE comments SET body=NULL,revision=?,deleted_at=? WHERE id=?",
        args: [revision, committedAt, args.commentId],
      });
      await executor.execute({
        sql: `INSERT INTO task_comment_changes
          (task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
          VALUES (?,?,?,?,?,?,?)`,
        args: [args.taskId, changeSeq, operation, args.commentId, revision,
          authorized.value.audienceEpoch, committedAt],
      });
      if (operation === "delete") {
        await executor.execute({ sql: "DELETE FROM task_comment_attention WHERE task_id=? AND comment_id=?", args: [args.taskId, args.commentId] });
        await executor.execute({
          sql: `UPDATE task_comment_outbox SET state='dropped',lease_until=NULL,lease_token=NULL
            WHERE task_id=? AND comment_id=? AND state IN ('pending','leased')`, args: [args.taskId, args.commentId],
        });
      } else {
        let rootAuthorId: string | null = null;
        if (row.root_id != null) {
          const root = await executor.execute({ sql: "SELECT user_id FROM comments WHERE id=? AND task_id=?", args: [row.root_id as string, args.taskId] });
          rootAuthorId = root.rows[0] ? text(root.rows[0].user_id) : null;
        }
        const reasons = new Map<string, number>();
        for (const recipientId of mentions) if (recipientId !== args.actorId) reasons.set(recipientId, 1);
        if (rootAuthorId && rootAuthorId !== args.actorId) reasons.set(rootAuthorId, (reasons.get(rootAuthorId) ?? 0) | 2);
        const recipients = [...reasons.keys()];
        await executor.execute({
          sql: `UPDATE task_comment_outbox SET state='dropped',lease_until=NULL,lease_token=NULL
            WHERE task_id=? AND comment_id=? AND state IN ('pending','leased')
            ${recipients.length ? `AND recipient_id NOT IN (${recipients.map(() => "?").join(",")})` : ""}`,
          args: [args.taskId, args.commentId, ...recipients],
        });
        await executor.execute({
          sql: `DELETE FROM task_comment_attention WHERE task_id=? AND comment_id=?
            ${recipients.length ? `AND recipient_id NOT IN (${recipients.map(() => "?").join(",")})` : ""}`,
          args: [args.taskId, args.commentId, ...recipients],
        });
        for (const [recipientId, reasonBits] of reasons) {
          const eventId = stableId("task_comment_event", [args.taskId, args.commentId, recipientId]);
          await executor.execute({
            sql: `INSERT INTO task_comment_attention
              (id,event_id,task_id,workspace_id,recipient_id,comment_id,source_revision,root_id,create_seq,reason_bits)
              VALUES (?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(task_id,recipient_id,comment_id) DO UPDATE SET
                source_revision=excluded.source_revision,reason_bits=excluded.reason_bits`,
            args: [stableId("task_comment_attention", [eventId]), eventId, args.taskId,
              authorized.value.projectId, recipientId, args.commentId, revision,
              row.root_id as string | null, integer(row.create_seq), reasonBits],
          });
          await executor.execute({
            sql: `INSERT INTO task_comment_outbox
              (id,event_id,task_id,workspace_id,recipient_id,comment_id,source_revision,audience_epoch,state,created_at_ms)
              VALUES (?,?,?,?,?,?,?,?, 'pending',?)
              ON CONFLICT(task_id,recipient_id,comment_id) DO UPDATE SET
                source_revision=excluded.source_revision,audience_epoch=excluded.audience_epoch,
                state=CASE WHEN task_comment_outbox.state='dropped' THEN 'pending' ELSE task_comment_outbox.state END`,
            args: [stableId("task_comment_outbox", [eventId]), eventId, args.taskId,
              authorized.value.projectId, recipientId, args.commentId, revision,
              authorized.value.audienceEpoch, committedAt],
          });
        }
      }
      // Old comment actions copied body snippets into these payloads. Canonical activity is ID-only.
      const activityPayload = JSON.stringify({ kind: operation === "delete" ? "commentRemove" : "commentAdd", commentId: args.commentId });
      await executor.execute({
        sql: `UPDATE activities SET payload=? WHERE task_id=? AND kind IN ('commentAdd','commentRemove')
          AND json_valid(payload) AND json_extract(payload,'$.commentId')=?`,
        args: [activityPayload, args.taskId, args.commentId],
      });
      await executor.execute({
        sql: `UPDATE notifications SET payload=json_object('commentId',?) WHERE task_id=?
          AND json_valid(payload) AND json_extract(payload,'$.commentId')=?`,
        args: [args.commentId, args.taskId, args.commentId],
      });
      await executor.execute({
        sql: `INSERT INTO task_comment_receipts
          (task_id,actor_id,client_request_id,operation,payload_hash,comment_id,create_seq,change_seq,revision,committed_at_ms)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [args.taskId, args.actorId, args.clientRequestId, operation, payloadHash,
          args.commentId, integer(row.create_seq), changeSeq, revision, committedAt],
      });
      return { ok: true, value: { commentId: args.commentId, clientRequestId: args.clientRequestId,
        changeSeq, revision, committedAt } };
    });
  }

  async function observeRange(input: ActorTask & {
    rootCommentId: string | null;
    fromCreateSeq: number;
    throughCreateSeq: number;
  }): Promise<ConversationResult<{ observedAt: number }>> {
    if (!validIdentity(input.actorId) || !validIdentity(input.taskId) ||
        (input.rootCommentId !== null && !validIdentity(input.rootCommentId)) ||
        !validSequence(input.fromCreateSeq) || input.fromCreateSeq < 1 ||
        !validSequence(input.throughCreateSeq) || input.throughCreateSeq < input.fromCreateSeq) return failure("invalid_input");
    return inTransaction("write", async (executor) => {
      const authorized = await authorizeTask(executor, input);
      if (!authorized.ok) return authorized;
      const observedAt = Date.now();
      await executor.execute({
        sql: `UPDATE task_comment_attention SET seen_at_ms=? WHERE task_id=? AND recipient_id=?
          AND root_id IS ? AND create_seq BETWEEN ? AND ?`,
        args: [observedAt, input.taskId, input.actorId, input.rootCommentId,
          input.fromCreateSeq, input.throughCreateSeq],
      });
      return { ok: true, value: { observedAt } };
    });
  }

  return { openTaskDiscussion, listProjectDiscussions, sendComment, getReceipt, getCommentPage, getHistory,
    editComment, tombstoneComment, observeRange };
}
