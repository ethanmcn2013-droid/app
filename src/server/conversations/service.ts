import "server-only";

import { createHash } from "node:crypto";
import type {
  ConversationDelta,
  ConversationResult,
  MessageReceipt,
  MessagePage,
  MessageRecord,
  ReceiptLookup,
  SendInput,
} from "@/lib/conversations/contracts";
import {
  CONVERSATION_LIMITS,
  normalizeMessageBody,
  validMessageBody,
  validRequestId,
  validSequence,
} from "@/lib/conversations/contracts";
import { isProjectId, type ProjectId } from "@/lib/projects/project-ref";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";

export type ProjectConversationScope = Readonly<{
  conversationId: string;
  projectId: ProjectId;
  kind: "project";
  projectName: string;
  audienceEpoch: number;
  lifecycle: "active" | "archived";
}>;

export type ProjectConversationAudience = Readonly<{
  audienceEpoch: number;
  members: readonly Readonly<{ id: string; name: string }>[];
}>;

export type MessageMutationReceipt = Readonly<{
  messageId: string;
  clientRequestId: string;
  changeSeq: number;
  revision: number;
  committedAt: number;
}>;

export type EditMessageInput = Readonly<{
  projectId: ProjectId;
  conversationId: string;
  messageId: string;
  clientRequestId: string;
  expectedRevision: number;
  expectedAudienceEpoch: number;
  body: string;
  mentionUserIds: readonly string[];
}>;

export type TombstoneMessageInput = Readonly<Omit<EditMessageInput, "body" | "mentionUserIds">>;

type ActorProject = Readonly<{ actorId: string; projectId: ProjectId }>;
type ActorConversation = ActorProject & Readonly<{ conversationId: string }>;

const failure = <C extends Exclude<ConversationResult<never>, { ok: true }>['code']>(code: C) =>
  ({ ok: false, code } as const);

function integer(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

function text(value: unknown): string {
  return String(value);
}

function hashTuple(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function projectConversationId(projectId: ProjectId): string {
  return `project_${hashTuple(["project-conversation-v1", projectId]).slice(0, 32)}`;
}

function messageId(actorId: string, conversationId: string, requestId: string): string {
  return `message_${hashTuple([conversationId, actorId, requestId]).slice(0, 32)}`;
}

function normalizedMentions(value: readonly string[]): string[] | null {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return null;
  }
  return [...new Set(value)].sort();
}

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

function scopeFromRow(row: Record<string, unknown>): ProjectConversationScope {
  return {
    conversationId: text(row.id),
    projectId: text(row.workspace_id) as ProjectId,
    kind: "project",
    projectName: text(row.workspace_name),
    audienceEpoch: integer(row.audience_epoch),
    lifecycle: row.workspace_archived_at == null && row.lifecycle === "active" ? "active" : "archived",
  };
}

function messageFromRow(row: Record<string, unknown>): MessageRecord {
  return {
    id: text(row.id), authorId: text(row.author_id),
    rootId: row.root_id == null ? null : text(row.root_id),
    createSeq: integer(row.create_seq), revision: integer(row.revision),
    body: row.deleted_at == null ? text(row.body) : null,
    createdAt: integer(row.created_at), editedAt: row.edited_at == null ? null : integer(row.edited_at),
    deletedAt: row.deleted_at == null ? null : integer(row.deleted_at),
  };
}

async function loadProjectScope(
  executor: ConversationSqlExecutor,
  input: ActorProject,
): Promise<{ row: Record<string, unknown> | null; member: boolean }> {
  const result = await executor.execute({
    sql: `SELECT c.id, c.workspace_id, c.kind, c.lifecycle, c.audience_epoch,
        w.archived_at AS workspace_archived_at, w.name AS workspace_name, u.id AS member_id
      FROM workspaces w
      LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      LEFT JOIN users u ON u.id = wm.user_id
      LEFT JOIN conversations c ON c.workspace_id = w.id AND c.kind = 'project'
      WHERE w.id = ?`,
    args: [input.actorId, input.projectId],
  });
  const row = result.rows[0] ?? null;
  return { row, member: Boolean(row?.member_id) };
}

async function authorizeConversation(
  executor: ConversationSqlExecutor,
  input: ActorConversation,
): Promise<ConversationResult<{ row: Record<string, unknown>; scope: ProjectConversationScope }>> {
  const result = await executor.execute({
    sql: `SELECT c.id, c.workspace_id, c.kind, c.lifecycle, c.audience_epoch,
        w.archived_at AS workspace_archived_at, w.name AS workspace_name
      FROM conversations c
      JOIN workspaces w ON w.id = c.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = ?
      JOIN users u ON u.id = wm.user_id
      WHERE c.id = ? AND c.workspace_id = ? AND c.kind = 'project'`,
    args: [input.actorId, input.conversationId, input.projectId],
  });
  const row = result.rows[0];
  if (!row) return failure("unavailable");
  return { ok: true, value: { row, scope: scopeFromRow(row) } };
}

function writeGate(
  scope: ProjectConversationScope,
  expectedAudienceEpoch: number,
): ConversationResult<true> {
  if (scope.lifecycle === "archived") return failure("archived");
  if (!Number.isSafeInteger(expectedAudienceEpoch) || expectedAudienceEpoch !== scope.audienceEpoch) {
    return failure("audience_changed");
  }
  return { ok: true, value: true };
}

async function validateMentionMembers(
  executor: ConversationSqlExecutor,
  projectId: ProjectId,
  mentions: readonly string[],
): Promise<boolean> {
  if (mentions.length === 0) return true;
  const placeholders = mentions.map(() => "?").join(", ");
  const result = await executor.execute({
    sql: `SELECT wm.user_id FROM workspace_members wm JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ? AND wm.user_id IN (${placeholders})`,
    args: [projectId, ...mentions],
  });
  return result.rows.length === mentions.length;
}

function mutationReceipt(row: Record<string, unknown>): MessageMutationReceipt {
  return {
    messageId: text(row.message_id),
    clientRequestId: text(row.client_request_id),
    changeSeq: integer(row.change_seq),
    revision: integer(row.revision),
    committedAt: integer(row.committed_at),
  };
}

function sendReceipt(row: Record<string, unknown>): MessageReceipt {
  return { ...mutationReceipt(row), createSeq: integer(row.create_seq) };
}

async function findReceipt(
  executor: ConversationSqlExecutor,
  input: ActorConversation & { clientRequestId: string },
): Promise<Record<string, unknown> | null> {
  const result = await executor.execute({
    sql: `SELECT operation, payload_hash, message_id, client_request_id,
        create_seq, change_seq, revision, committed_at
      FROM conversation_receipts
      WHERE conversation_id = ? AND actor_id = ? AND client_request_id = ?`,
    args: [input.conversationId, input.actorId, input.clientRequestId],
  });
  return result.rows[0] ?? null;
}

function isTransientDatabaseError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  return /SQLITE_BUSY|DATABASE_BUSY|database is locked|conversation_database_unavailable/i.test(
    `${candidate?.code ?? ""} ${candidate?.message ?? ""}`,
  );
}

export function createConversationService(adapter: ConversationDatabaseAdapter) {
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

  async function resolveActor(clerkId: string): Promise<string | null> {
    if (typeof clerkId !== "string" || clerkId.length < 3 || clerkId.length > 256) return null;
    const result = await inTransaction("read", async (executor) => {
      const user = await executor.execute({
        sql: "SELECT id FROM users WHERE clerk_id = ? LIMIT 1",
        args: [clerkId],
      });
      return { ok: true, value: user.rows[0] ? text(user.rows[0].id) : null };
    });
    return result.ok ? result.value : null;
  }

  async function getProjectConversation(input: ActorProject): Promise<ConversationResult<ProjectConversationScope | null>> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const loaded = await loadProjectScope(executor, input);
      if (!loaded.row || !loaded.member) return failure("unavailable");
      return { ok: true, value: loaded.row.id ? scopeFromRow(loaded.row) : null };
    });
  }

  /** Selection hints only; every selected resource is independently authorized. */
  async function listProjects(input: { actorId: string }): Promise<ConversationResult<readonly { id: ProjectId; name: string }[]>> {
    if (!validIdentity(input.actorId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const result = await executor.execute({
        sql: `SELECT w.id, w.name FROM workspaces w
          JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=?
          JOIN users u ON u.id=wm.user_id ORDER BY w.name, w.id LIMIT 2000`,
        args: [input.actorId],
      });
      return { ok: true, value: result.rows.map((row) => ({ id: text(row.id) as ProjectId, name: text(row.name) })) };
    });
  }

  async function ensureProjectConversation(input: ActorProject): Promise<ConversationResult<ProjectConversationScope>> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId)) return failure("invalid_input");
    return inTransaction("write", async (executor) => {
      const loaded = await loadProjectScope(executor, input);
      if (!loaded.row || !loaded.member) return failure("unavailable");
      if (loaded.row.id) return { ok: true, value: scopeFromRow(loaded.row) };
      if (loaded.row.workspace_archived_at != null) return failure("archived");
      const id = projectConversationId(input.projectId);
      const now = Date.now();
      await executor.execute({
        sql: `INSERT OR IGNORE INTO conversations
          (id, workspace_id, kind, lifecycle, audience_epoch, next_create_seq, next_change_seq, created_by, created_at)
          VALUES (?, ?, 'project', 'active', 1, 1, 1, ?, ?)`,
        args: [id, input.projectId, input.actorId, now],
      });
      const authorized = await authorizeConversation(executor, { ...input, conversationId: id });
      return authorized.ok ? { ok: true, value: authorized.value.scope } : authorized;
    });
  }

  async function listProjectAudience(input: ActorProject): Promise<ConversationResult<ProjectConversationAudience>> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const scope = await loadProjectScope(executor, input);
      if (!scope.row || !scope.member || !scope.row.id) return failure("unavailable");
      const members = await executor.execute({
        sql: `SELECT u.id, u.name FROM workspace_members wm
          JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = ? ORDER BY lower(u.name), u.id`,
        args: [input.projectId],
      });
      return {
        ok: true,
        value: {
          audienceEpoch: integer(scope.row.audience_epoch),
          members: members.rows.map((row) => ({ id: text(row.id), name: text(row.name) })),
        },
      };
    });
  }

  async function sendMessage(args: { actorId: string; input: SendInput }): Promise<ConversationResult<MessageReceipt>> {
    const { actorId, input } = args;
    const body = typeof input?.body === "string" ? normalizeMessageBody(input.body) : "";
    const mentions = normalizedMentions(input?.mentionUserIds ?? []);
    if (!validIdentity(actorId) || !input || !isProjectId(input.projectId) ||
        !validIdentity(input.conversationId) || !validRequestId(input.clientRequestId) ||
        !validMessageBody(body) || mentions === null ||
        (input.rootId !== null && !validIdentity(input.rootId))) return failure("invalid_input");
    const payloadHash = hashTuple(["send", actorId, input.conversationId, body, input.rootId, mentions]);

    return inTransaction("write", async (executor) => {
      const authorized = await authorizeConversation(executor, { actorId, ...input });
      if (!authorized.ok) return authorized;
      const prior = await findReceipt(executor, { actorId, ...input });
      if (prior) {
        return prior.operation === "send" && prior.payload_hash === payloadHash
          ? { ok: true, value: sendReceipt(prior) }
          : failure("request_conflict");
      }
      const gate = writeGate(authorized.value.scope, input.expectedAudienceEpoch);
      if (!gate.ok) return gate;
      if (!await validateMentionMembers(executor, input.projectId, mentions)) return failure("invalid_input");
      if (input.rootId !== null) {
        const root = await executor.execute({
          sql: `SELECT id FROM conversation_messages
            WHERE id = ? AND conversation_id = ? AND workspace_id = ? AND root_id IS NULL`,
          args: [input.rootId, input.conversationId, input.projectId],
        });
        if (root.rows.length !== 1) return failure("invalid_input");
      }
      const sequence = await executor.execute({
        sql: "SELECT next_create_seq, next_change_seq FROM conversations WHERE id = ?",
        args: [input.conversationId],
      });
      const createSeq = integer(sequence.rows[0]?.next_create_seq);
      const changeSeq = integer(sequence.rows[0]?.next_change_seq);
      const committedAt = Date.now();
      const id = messageId(actorId, input.conversationId, input.clientRequestId);
      await executor.execute({
        sql: `UPDATE conversations SET next_create_seq = next_create_seq + 1,
          next_change_seq = next_change_seq + 1 WHERE id = ?`,
        args: [input.conversationId],
      });
      await executor.execute({
        sql: `INSERT INTO conversation_messages
          (id, conversation_id, workspace_id, author_id, client_request_id, request_hash,
           root_id, create_seq, revision, body, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [id, input.conversationId, input.projectId, actorId, input.clientRequestId,
          payloadHash, input.rootId, createSeq, body, committedAt],
      });
      await executor.execute({
        sql: `INSERT INTO conversation_changes
          (conversation_id, change_seq, kind, message_id, revision, audience_epoch, happened_at)
          VALUES (?, ?, 'create', ?, 1, ?, ?)`,
        args: [input.conversationId, changeSeq, id, authorized.value.scope.audienceEpoch, committedAt],
      });
      // Membership grants history access; only explicit mentions direct attention.
      // The normalized set was validated against live members in this transaction.
      for (const recipientId of mentions.filter((id) => id !== actorId)) {
        const eventKey = hashTuple([input.conversationId, id, recipientId]).slice(0, 32);
        await executor.execute({
          sql: `INSERT INTO conversation_attention
            (id, conversation_id, workspace_id, recipient_id, message_id, root_id, create_seq)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [`attention_${eventKey}`, input.conversationId, input.projectId, recipientId, id, input.rootId, createSeq],
        });
        await executor.execute({
          sql: `INSERT INTO conversation_outbox
            (id, conversation_id, workspace_id, recipient_id, message_id, source_revision,
             audience_epoch, state, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, 'pending', ?)`,
          args: [`outbox_${eventKey}`, input.conversationId, input.projectId, recipientId, id,
            authorized.value.scope.audienceEpoch, committedAt],
        });
      }
      await executor.execute({
        sql: `INSERT INTO conversation_receipts
          (conversation_id, actor_id, client_request_id, operation, payload_hash,
           message_id, create_seq, change_seq, revision, committed_at)
          VALUES (?, ?, ?, 'send', ?, ?, ?, ?, 1, ?)`,
        args: [input.conversationId, actorId, input.clientRequestId, payloadHash, id, createSeq, changeSeq, committedAt],
      });
      return { ok: true, value: { messageId: id, clientRequestId: input.clientRequestId, createSeq, changeSeq, revision: 1, committedAt } };
    });
  }

  async function getReceipt(input: ActorConversation & { clientRequestId: string }): Promise<ReceiptLookup> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId) ||
        !validIdentity(input.conversationId) || !validRequestId(input.clientRequestId)) return failure("invalid_input");
    return inTransaction<{ state: "committed"; receipt: MessageReceipt } | { state: "absent" }>("read", async (executor) => {
      const authorized = await authorizeConversation(executor, input);
      if (!authorized.ok) return authorized;
      const prior = await findReceipt(executor, input);
      if (!prior || prior.operation !== "send") return { ok: true, value: { state: "absent" } };
      return { ok: true, value: { state: "committed", receipt: sendReceipt(prior) } };
    });
  }

  async function getMessagePage(input: ActorConversation & { beforeCreateSeq?: number; limit?: number }): Promise<ConversationResult<MessagePage>> {
    const limit = input.limit ?? CONVERSATION_LIMITS.pageDefault;
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId) || !validIdentity(input.conversationId) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > CONVERSATION_LIMITS.pageMaximum ||
      (input.beforeCreateSeq !== undefined && (!validSequence(input.beforeCreateSeq) || input.beforeCreateSeq < 1))) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeConversation(executor, input);
      if (!authorized.ok) return authorized;
      const sequence = await executor.execute({ sql: "SELECT next_change_seq - 1 AS cursor FROM conversations WHERE id = ?", args: [input.conversationId] });
      const result = await executor.execute({
        sql: `SELECT id,author_id,root_id,create_seq,revision,body,created_at,edited_at,deleted_at
          FROM conversation_messages WHERE conversation_id = ? AND (? IS NULL OR create_seq < ?)
          ORDER BY create_seq DESC LIMIT ?`,
        args: [input.conversationId, input.beforeCreateSeq ?? null, input.beforeCreateSeq ?? null, limit + 1],
      });
      const messages = result.rows.slice(0, limit).reverse().map(messageFromRow);
      return { ok: true, value: {
        audienceEpoch: authorized.value.scope.audienceEpoch, throughChangeSeq: integer(sequence.rows[0].cursor),
        messages, hasOlder: result.rows.length > limit, beforeCreateSeq: messages[0]?.createSeq ?? null,
      } };
    });
  }

  async function getHistory(input: ActorConversation & { afterChangeSeq: number; limit?: number }): Promise<ConversationResult<ConversationDelta>> {
    const limit = input.limit ?? CONVERSATION_LIMITS.pageDefault;
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId) ||
        !validIdentity(input.conversationId) || !validSequence(input.afterChangeSeq) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > CONVERSATION_LIMITS.pageMaximum) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeConversation(executor, input);
      if (!authorized.ok) return authorized;
      const maximum = await executor.execute({ sql: "SELECT next_change_seq - 1 AS cursor FROM conversations WHERE id = ?", args: [input.conversationId] });
      if (input.afterChangeSeq > integer(maximum.rows[0].cursor)) return failure("resync_required");
      const changes = await executor.execute({
        sql: `SELECT change_seq, message_id FROM conversation_changes
          WHERE conversation_id = ? AND change_seq > ? ORDER BY change_seq LIMIT ?`,
        args: [input.conversationId, input.afterChangeSeq, limit + 1],
      });
      const page = changes.rows.slice(0, limit);
      const ids = [...new Set(page.map((row) => row.message_id).filter((id): id is string => typeof id === "string"))];
      let messages: ConversationDelta["messages"] = [];
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(", ");
        const source = await executor.execute({
          sql: `SELECT id, author_id, root_id, create_seq, revision, body,
              created_at, edited_at, deleted_at
            FROM conversation_messages WHERE conversation_id = ? AND id IN (${placeholders})
            ORDER BY create_seq`,
          args: [input.conversationId, ...ids],
        });
        messages = source.rows.map(messageFromRow);
      }
      return {
        ok: true,
        value: {
          audienceEpoch: authorized.value.scope.audienceEpoch,
          throughChangeSeq: page.length ? integer(page[page.length - 1].change_seq) : input.afterChangeSeq,
          hasMore: changes.rows.length > limit,
          messages,
        },
      };
    });
  }

  async function editMessage(args: { actorId: string } & EditMessageInput): Promise<ConversationResult<MessageMutationReceipt>> {
    const body = typeof args.body === "string" ? normalizeMessageBody(args.body) : "";
    const mentions = normalizedMentions(args.mentionUserIds ?? []);
    if (!validIdentity(args.actorId) || !isProjectId(args.projectId) || !validIdentity(args.conversationId) ||
        !validIdentity(args.messageId) || !validRequestId(args.clientRequestId) ||
        !validSequence(args.expectedRevision) || args.expectedRevision < 1 ||
        !validMessageBody(body) || mentions === null) return failure("invalid_input");
    const payloadHash = hashTuple(["edit", args.actorId, args.conversationId, args.messageId, body, mentions]);
    return mutateMessage("edit", args, payloadHash, body, mentions);
  }

  async function tombstoneMessage(args: { actorId: string } & TombstoneMessageInput): Promise<ConversationResult<MessageMutationReceipt>> {
    if (!validIdentity(args.actorId) || !isProjectId(args.projectId) || !validIdentity(args.conversationId) ||
        !validIdentity(args.messageId) || !validRequestId(args.clientRequestId) ||
        !validSequence(args.expectedRevision) || args.expectedRevision < 1) return failure("invalid_input");
    return mutateMessage("delete", args, hashTuple(["delete", args.actorId, args.conversationId, args.messageId]), null, []);
  }

  async function mutateMessage(
    operation: "edit" | "delete",
    args: { actorId: string } & TombstoneMessageInput,
    payloadHash: string,
    body: string | null,
    mentions: readonly string[],
  ): Promise<ConversationResult<MessageMutationReceipt>> {
    return inTransaction("write", async (executor) => {
      const authorized = await authorizeConversation(executor, args);
      if (!authorized.ok) return authorized;
      const prior = await findReceipt(executor, args);
      if (prior) {
        return prior.operation === operation && prior.payload_hash === payloadHash
          ? { ok: true, value: mutationReceipt(prior) }
          : failure("request_conflict");
      }
      const gate = writeGate(authorized.value.scope, args.expectedAudienceEpoch);
      if (!gate.ok) return gate;
      if (!await validateMentionMembers(executor, args.projectId, mentions)) return failure("invalid_input");
      const source = await executor.execute({
        sql: `SELECT author_id, create_seq, revision, deleted_at FROM conversation_messages
          WHERE id = ? AND conversation_id = ? AND workspace_id = ?`,
        args: [args.messageId, args.conversationId, args.projectId],
      });
      const row = source.rows[0];
      if (!row || row.author_id !== args.actorId) return failure("unavailable");
      if (row.deleted_at != null && operation === "edit") return failure("revision_conflict");
      if (integer(row.revision) !== args.expectedRevision) return failure("revision_conflict");
      const sequence = await executor.execute({
        sql: "SELECT next_change_seq FROM conversations WHERE id = ?",
        args: [args.conversationId],
      });
      const changeSeq = integer(sequence.rows[0]?.next_change_seq);
      const revision = args.expectedRevision + 1;
      const committedAt = Date.now();
      await executor.execute({
        sql: "UPDATE conversations SET next_change_seq = next_change_seq + 1 WHERE id = ?",
        args: [args.conversationId],
      });
      if (operation === "edit") {
        await executor.execute({
          sql: `UPDATE conversation_messages SET body = ?, revision = ?, edited_at = ?
            WHERE id = ? AND revision = ?`,
          args: [body, revision, committedAt, args.messageId, args.expectedRevision],
        });
      } else {
        await executor.execute({
          sql: `UPDATE conversation_messages SET body = NULL, revision = ?, deleted_at = ?
            WHERE id = ? AND revision = ?`,
          args: [revision, committedAt, args.messageId, args.expectedRevision],
        });
      }
      await executor.execute({
        sql: `INSERT INTO conversation_changes
          (conversation_id, change_seq, kind, message_id, revision, audience_epoch, happened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [args.conversationId, changeSeq, operation, args.messageId, revision, authorized.value.scope.audienceEpoch, committedAt],
      });
      if (operation === "delete") {
        await executor.execute({ sql: "DELETE FROM conversation_attention WHERE message_id = ?", args: [args.messageId] });
        await executor.execute({ sql: "DELETE FROM conversation_outbox WHERE message_id = ? AND state IN ('pending', 'leased')", args: [args.messageId] });
      }
      await executor.execute({
        sql: `INSERT INTO conversation_receipts
          (conversation_id, actor_id, client_request_id, operation, payload_hash,
           message_id, create_seq, change_seq, revision, committed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [args.conversationId, args.actorId, args.clientRequestId, operation, payloadHash,
          args.messageId, integer(row.create_seq), changeSeq, revision, committedAt],
      });
      return { ok: true, value: { messageId: args.messageId, clientRequestId: args.clientRequestId, changeSeq, revision, committedAt } };
    });
  }

  return {
    resolveActor,
    listProjects,
    getProjectConversation,
    ensureProjectConversation,
    listProjectAudience,
    sendMessage,
    getReceipt,
    getHistory,
    getMessagePage,
    editMessage,
    tombstoneMessage,
  } as const;
}
