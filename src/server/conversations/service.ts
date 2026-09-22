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
import { conversationWriteFencesClear } from "./write-fences";

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

export type DirectMessagePairState = "pending" | "active" | "declined" | "blocked" | "left" | "membership_lost" | "rejoin_pending";
export type DirectMessageScope = Readonly<{
  conversationId: string;
  projectId: ProjectId;
  kind: "dm";
  audienceEpoch: number;
  lifecycle: "active" | "archived";
  pairState: DirectMessagePairState;
  other: Readonly<{ id: string; name: string }>;
  requesterId: string;
  blockOwnerId: string | null;
  ownConfirmed: boolean;
  canWrite: boolean;
  canRead: boolean;
}>;
export type DirectMessageTransition = "accept" | "decline" | "block" | "unblock" | "leave" | "reopen";
export type DirectMessageReceipt = Readonly<{ scope: DirectMessageScope; clientRequestId: string; committedAt: number }>;

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

function directMessageId(projectId: ProjectId, lowUserId: string, highUserId: string): string {
  return `dm_${hashTuple(["project-dm-v1", projectId, lowUserId, highUserId]).slice(0, 32)}`;
}

function dmScopeFromRow(row: Record<string, unknown>): DirectMessageScope {
  const state = text(row.pair_state) as DirectMessagePairState;
  const lifecycle = row.workspace_archived_at == null && row.lifecycle === "active" ? "active" : "archived";
  const currentMember = Boolean(row.current_member);
  const participant = Boolean(row.participant_status);
  const canRead = currentMember && participant && integer(row.retains_history) === 1 && !["pending", "declined"].includes(state);
  return {
    conversationId: text(row.id), projectId: text(row.workspace_id) as ProjectId, kind: "dm",
    audienceEpoch: integer(row.audience_epoch), lifecycle, pairState: state,
    other: { id: text(row.other_pair_id), name: row.other_name == null ? "Former member" : text(row.other_name) }, requesterId: text(row.dm_requester_id),
    blockOwnerId: row.dm_blocked_by_user_id == null ? null : text(row.dm_blocked_by_user_id),
    ownConfirmed: integer(row.reopen_confirmed) === 1,
    canWrite: lifecycle === "active" && state === "active" && currentMember && participant && integer(row.active_pair_count) === 2,
    canRead,
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
    ...(row.reply_count == null ? {} : { replyCount: integer(row.reply_count) }),
    ...(row.reply_count_change_seq == null ? {} : { replyCountChangeSeq: integer(row.reply_count_change_seq) }),
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
): Promise<ConversationResult<{ row: Record<string, unknown>; scope: ProjectConversationScope | DirectMessageScope }>> {
  const result = await executor.execute({
    sql: `SELECT c.*, w.archived_at AS workspace_archived_at, w.name AS workspace_name,
        wm.user_id AS current_member, p.status AS participant_status, p.consented, p.retains_history, p.reopen_confirmed,
        CASE WHEN c.dm_low_user_id=? THEN c.dm_high_user_id ELSE c.dm_low_user_id END AS other_pair_id,
        other.id AS other_id, COALESCE(NULLIF(other.name,''),NULLIF(other.handle,''),other.initials) AS other_name,
        (SELECT COUNT(*) FROM conversation_participants bp
          JOIN workspace_members bwm ON bwm.workspace_id=c.workspace_id AND bwm.user_id=bp.user_id
          JOIN users bu ON bu.id=bp.user_id WHERE bp.conversation_id=c.id AND bp.status='active' AND bp.consented=1 AND bp.retains_history=1) AS active_pair_count
      FROM conversations c
      JOIN workspaces w ON w.id = c.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = ?
      JOIN users u ON u.id = wm.user_id
      LEFT JOIN conversation_participants p ON p.conversation_id=c.id AND p.user_id=?
      LEFT JOIN users other ON other.id=CASE WHEN c.dm_low_user_id=? THEN c.dm_high_user_id ELSE c.dm_low_user_id END
      WHERE c.id = ? AND c.workspace_id = ? AND (c.kind='project' OR (c.kind='dm' AND ? IN(c.dm_low_user_id,c.dm_high_user_id)))`,
    args: [input.actorId, input.actorId, input.actorId, input.actorId, input.conversationId, input.projectId, input.actorId],
  });
  const row = result.rows[0];
  if (!row) return failure("unavailable");
  if (row.kind === "dm" && !row.participant_status) return failure("unavailable");
  return { ok: true, value: { row, scope: row.kind === "dm" ? dmScopeFromRow(row) : scopeFromRow(row) } };
}

function writeGate(
  scope: ProjectConversationScope | DirectMessageScope,
  expectedAudienceEpoch: number,
): ConversationResult<true> {
  if (scope.lifecycle === "archived") return failure("archived");
  if (!Number.isSafeInteger(expectedAudienceEpoch) || expectedAudienceEpoch !== scope.audienceEpoch) {
    return failure("audience_changed");
  }
  if (scope.kind === "dm" && !scope.canWrite) return failure(scope.pairState === "pending" || scope.pairState === "declined" ? "consent_required" : "read_only");
  return { ok: true, value: true };
}

async function validateMentionMembers(
  executor: ConversationSqlExecutor,
  projectId: ProjectId,
  mentions: readonly string[],
  conversationId?: string,
): Promise<boolean> {
  if (mentions.length === 0) return true;
  const placeholders = mentions.map(() => "?").join(", ");
  const result = await executor.execute({
    sql: `SELECT wm.user_id FROM workspace_members wm JOIN users u ON u.id = wm.user_id
      ${conversationId ? "JOIN conversations c ON c.id = ? AND c.workspace_id=wm.workspace_id" : ""}
      WHERE wm.workspace_id = ? AND wm.user_id IN (${placeholders})
      ${conversationId ? "AND (c.kind='project' OR wm.user_id IN(c.dm_low_user_id,c.dm_high_user_id))" : ""}`,
    args: [...(conversationId ? [conversationId] : []), projectId, ...mentions],
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
      if (!await conversationWriteFencesClear(executor, input.actorId, input.projectId)) return failure("unavailable");
      const id = projectConversationId(input.projectId);
      const now = Date.now();
      await executor.execute({
        sql: `INSERT OR IGNORE INTO conversations
          (id, workspace_id, kind, lifecycle, audience_epoch, next_create_seq, next_change_seq, created_by, created_at)
          VALUES (?, ?, 'project', 'active', 1, 1, 1, ?, ?)`,
        args: [id, input.projectId, input.actorId, now],
      });
      const authorized = await authorizeConversation(executor, { ...input, conversationId: id });
      return authorized.ok && authorized.value.scope.kind === "project"
        ? { ok: true, value: authorized.value.scope }
        : failure("unavailable");
    });
  }

  async function getDirectMessage(input: ActorConversation): Promise<ConversationResult<DirectMessageScope>> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId) || !validIdentity(input.conversationId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeConversation(executor, input);
      if (!authorized.ok || authorized.value.scope.kind !== "dm") return failure("unavailable");
      return { ok: true, value: authorized.value.scope };
    });
  }

  async function listDirectMessages(input: ActorProject): Promise<ConversationResult<readonly DirectMessageScope[]>> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const member = await executor.execute({ sql: `SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id
        JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.workspace_id=? AND wm.user_id=?`, args: [input.projectId, input.actorId] });
      if (!member.rows[0]) return failure("unavailable");
      const ids = await executor.execute({ sql: `SELECT id FROM conversations WHERE workspace_id=? AND kind='dm'
        AND ? IN(dm_low_user_id,dm_high_user_id) ORDER BY created_at DESC,id`, args: [input.projectId, input.actorId] });
      const scopes: DirectMessageScope[] = [];
      for (const row of ids.rows) {
        const authorized = await authorizeConversation(executor, { ...input, conversationId: text(row.id) });
        if (authorized.ok && authorized.value.scope.kind === "dm") scopes.push(authorized.value.scope);
      }
      return { ok: true, value: scopes };
    });
  }

  async function listDirectMessageAudience(input: ActorConversation): Promise<ConversationResult<ProjectConversationAudience>> {
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId) || !validIdentity(input.conversationId)) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeConversation(executor, input);
      if (!authorized.ok || authorized.value.scope.kind !== "dm") return failure("unavailable");
      const members = await executor.execute({ sql: `SELECT u.id,COALESCE(NULLIF(u.name,''),NULLIF(u.handle,''),u.initials) AS name
        FROM users u JOIN conversations c ON c.id=? WHERE u.id IN(c.dm_low_user_id,c.dm_high_user_id) ORDER BY lower(name),u.id`, args: [input.conversationId] });
      return { ok: true, value: { audienceEpoch: authorized.value.scope.audienceEpoch,
        members: members.rows.map((row) => ({ id: text(row.id), name: text(row.name) })) } };
    });
  }

  async function requestDirectMessage(args: Readonly<{ actorId: string; projectId: ProjectId; recipientId: string; clientRequestId: string }>): Promise<ConversationResult<DirectMessageReceipt>> {
    if (!validIdentity(args.actorId) || !isProjectId(args.projectId) || !validIdentity(args.recipientId) || args.recipientId === args.actorId || !validRequestId(args.clientRequestId)) return failure("invalid_input");
    const [low, high] = [args.actorId, args.recipientId].sort();
    const payloadHash = hashTuple(["dm-state-v1", "request", args.actorId, args.projectId, args.recipientId]);
    return inTransaction("write", async (executor) => {
      const prior = await executor.execute({ sql: `SELECT conversation_id,payload_hash,committed_at FROM conversation_dm_receipts WHERE actor_id=? AND client_request_id=?`, args: [args.actorId, args.clientRequestId] });
      if (prior.rows[0]) {
        if (prior.rows[0].payload_hash !== payloadHash) return failure("request_conflict");
        const replay = await authorizeConversation(executor, { actorId: args.actorId, projectId: args.projectId, conversationId: text(prior.rows[0].conversation_id) });
        if (!replay.ok || replay.value.scope.kind !== "dm") return failure("unavailable");
        return { ok: true, value: { scope: replay.value.scope, clientRequestId: args.clientRequestId, committedAt: integer(prior.rows[0].committed_at) } };
      }
      const eligible = await executor.execute({ sql: `SELECT w.archived_at,(SELECT COUNT(*) FROM workspace_members wm JOIN users u ON u.id=wm.user_id
        WHERE wm.workspace_id=w.id AND wm.user_id IN(?,?)) AS member_count FROM workspaces w WHERE w.id=?`, args: [low, high, args.projectId] });
      if (!eligible.rows[0] || integer(eligible.rows[0].member_count) !== 2) return failure("unavailable");
      if (eligible.rows[0].archived_at != null) return failure("archived");
      if (!await conversationWriteFencesClear(executor, args.actorId, args.projectId)) return failure("unavailable");
      const existing = await executor.execute({ sql: `SELECT id FROM conversations WHERE workspace_id=? AND kind='dm' AND dm_low_user_id=? AND dm_high_user_id=?`, args: [args.projectId, low, high] });
      if (existing.rows[0]) return failure("read_only");
      const id = directMessageId(args.projectId, low, high); const committedAt = Date.now();
      await executor.execute({ sql: `INSERT INTO conversations(id,workspace_id,kind,lifecycle,audience_epoch,next_create_seq,next_change_seq,
        dm_low_user_id,dm_high_user_id,pair_state,created_by,created_at,dm_requester_id)
        VALUES(?,?,'dm','active',1,1,1,?,?,'pending',?,?,?)`, args: [id,args.projectId,low,high,args.actorId,committedAt,args.actorId] });
      await executor.execute({ sql: `INSERT INTO conversation_participants(conversation_id,user_id,status,consented,retains_history,reopen_confirmed)
        VALUES(?,?,'active',1,0,0),(?,?,'active',0,0,0)`, args: [id,args.actorId,id,args.recipientId] });
      await executor.execute({ sql: `INSERT INTO conversation_dm_receipts(actor_id,client_request_id,operation,payload_hash,conversation_id,resulting_state,committed_at)
        VALUES(?,?,'request',?,?,'pending',?)`, args: [args.actorId,args.clientRequestId,payloadHash,id,committedAt] });
      const authorized = await authorizeConversation(executor, { actorId: args.actorId, projectId: args.projectId, conversationId: id });
      if (!authorized.ok || authorized.value.scope.kind !== "dm") return failure("unavailable");
      return { ok: true, value: { scope: authorized.value.scope, clientRequestId: args.clientRequestId, committedAt } };
    });
  }

  async function transitionDirectMessage(args: Readonly<ActorConversation & { clientRequestId: string; expectedAudienceEpoch: number; operation: DirectMessageTransition }>): Promise<ConversationResult<DirectMessageReceipt>> {
    if (!validIdentity(args.actorId) || !isProjectId(args.projectId) || !validIdentity(args.conversationId) || !validRequestId(args.clientRequestId) ||
      !Number.isSafeInteger(args.expectedAudienceEpoch) || args.expectedAudienceEpoch < 1 || !["accept","decline","block","unblock","leave","reopen"].includes(args.operation)) return failure("invalid_input");
    const payloadHash = hashTuple(["dm-state-v1", args.operation, args.actorId, args.projectId, args.conversationId]);
    return inTransaction("write", async (executor) => {
      const prior = await executor.execute({ sql: `SELECT payload_hash,committed_at FROM conversation_dm_receipts WHERE actor_id=? AND client_request_id=?`, args: [args.actorId,args.clientRequestId] });
      const authorized = await authorizeConversation(executor,args);
      if (!authorized.ok || authorized.value.scope.kind !== "dm") return failure("unavailable");
      if (prior.rows[0]) return prior.rows[0].payload_hash === payloadHash
        ? { ok:true,value:{scope:authorized.value.scope,clientRequestId:args.clientRequestId,committedAt:integer(prior.rows[0].committed_at)} }
        : failure("request_conflict");
      const scope=authorized.value.scope; const row=authorized.value.row;
      if(scope.lifecycle === "archived" && args.operation !== "block" && args.operation !== "leave") return failure("archived");
      if(scope.audienceEpoch !== args.expectedAudienceEpoch) return failure("audience_changed");
      if (!await conversationWriteFencesClear(executor, args.actorId, args.projectId)) return failure("unavailable");
      let resulting: DirectMessagePairState=scope.pairState;
      if(args.operation === "accept" || args.operation === "decline") {
        if(scope.pairState!=="pending" || scope.requesterId===args.actorId) return failure("read_only");
        resulting=args.operation === "accept" ? "active" : "declined";
        if(resulting === "active") await executor.execute({sql:`UPDATE conversation_participants SET status='active',consented=1,retains_history=1 WHERE conversation_id=?`,args:[args.conversationId]});
        else await executor.execute({sql:`UPDATE conversation_participants SET consented=0,retains_history=0,reopen_confirmed=0 WHERE conversation_id=?`,args:[args.conversationId]});
        await executor.execute({sql:"UPDATE conversations SET pair_state=? WHERE id=?",args:[resulting,args.conversationId]});
      } else if(args.operation === "block") {
        if(scope.pairState==="blocked" || scope.pairState==="left" || scope.pairState==="membership_lost" || scope.pairState==="rejoin_pending") return failure("read_only");
        resulting="blocked";
        await executor.execute({sql:"UPDATE conversations SET pair_state='blocked',dm_blocked_by_user_id=?,dm_state_before_block=? WHERE id=?",args:[args.actorId,scope.pairState,args.conversationId]});
      } else if(args.operation === "unblock") {
        if(scope.pairState!=="blocked" || scope.blockOwnerId!==args.actorId) return failure("read_only");
        const pair=await executor.execute({sql:`SELECT COUNT(*) AS members,SUM(CASE WHEN p.status='removed' THEN 1 ELSE 0 END) AS removed,
          SUM(CASE WHEN p.status='rejoin_pending' OR p.status='membership_lost' THEN 1 ELSE 0 END) AS churned,
          SUM(CASE WHEN p.status='active' AND p.consented=1 AND p.retains_history=1 THEN 1 ELSE 0 END) AS active
          FROM conversation_participants p JOIN conversations c ON c.id=p.conversation_id
          LEFT JOIN workspace_members wm ON wm.workspace_id=c.workspace_id AND wm.user_id=p.user_id
          WHERE p.conversation_id=? AND wm.user_id IS NOT NULL`,args:[args.conversationId]});
        const p=pair.rows[0]; resulting=integer(p?.members)!==2?"membership_lost":integer(p?.removed)>0?"left":integer(p?.churned)>0?"rejoin_pending":integer(p?.active)===2?"active":text(row.dm_state_before_block) as DirectMessagePairState;
        await executor.execute({sql:"UPDATE conversations SET pair_state=?,dm_blocked_by_user_id=NULL,dm_state_before_block=NULL WHERE id=?",args:[resulting,args.conversationId]});
      } else if(args.operation === "leave") {
        await executor.execute({sql:`UPDATE conversation_participants SET status='removed',consented=0,retains_history=0,reopen_confirmed=0 WHERE conversation_id=? AND user_id=?`,args:[args.conversationId,args.actorId]});
        if(scope.pairState!=="blocked") { resulting="left"; await executor.execute({sql:"UPDATE conversations SET pair_state='left' WHERE id=?",args:[args.conversationId]}); }
      } else {
        if(scope.pairState!=="rejoin_pending" || !["rejoin_pending","active"].includes(text(row.participant_status))) return failure("read_only");
        await executor.execute({sql:`UPDATE conversation_participants SET status='active',consented=1,retains_history=1,reopen_confirmed=1 WHERE conversation_id=? AND user_id=?`,args:[args.conversationId,args.actorId]});
        const both=await executor.execute({sql:`SELECT COUNT(*) AS count FROM conversation_participants p JOIN conversations c ON c.id=p.conversation_id
          JOIN workspace_members wm ON wm.workspace_id=c.workspace_id AND wm.user_id=p.user_id JOIN users u ON u.id=p.user_id
          WHERE p.conversation_id=? AND p.status='active' AND p.consented=1 AND p.retains_history=1 AND p.reopen_confirmed=1`,args:[args.conversationId]});
        if(integer(both.rows[0]?.count)===2){resulting="active";await executor.execute({sql:"UPDATE conversations SET pair_state='active' WHERE id=?",args:[args.conversationId]});}
      }
      const committedAt=Date.now();
      await executor.execute({sql:`INSERT INTO conversation_dm_receipts(actor_id,client_request_id,operation,payload_hash,conversation_id,resulting_state,committed_at)
        VALUES(?,?,?,?,?,?,?)`,args:[args.actorId,args.clientRequestId,args.operation,payloadHash,args.conversationId,resulting,committedAt]});
      const updated=await authorizeConversation(executor,args); if(!updated.ok || updated.value.scope.kind!=="dm") return failure("unavailable");
      return {ok:true,value:{scope:updated.value.scope,clientRequestId:args.clientRequestId,committedAt}};
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
      if (authorized.value.scope.kind === "dm" && !authorized.value.scope.canRead &&
          !["pending", "declined"].includes(authorized.value.scope.pairState)) return failure("unavailable");
      const prior = await findReceipt(executor, { actorId, ...input });
      if (prior) {
        return prior.operation === "send" && prior.payload_hash === payloadHash
          ? { ok: true, value: sendReceipt(prior) }
          : failure("request_conflict");
      }
      const gate = writeGate(authorized.value.scope, input.expectedAudienceEpoch);
      if (!gate.ok) return gate;
      if (!await conversationWriteFencesClear(executor, actorId, input.projectId)) return failure("unavailable");
      if (!await validateMentionMembers(executor, input.projectId, mentions, input.conversationId)) return failure("invalid_input");
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
      const recipients = authorized.value.scope.kind === "dm"
        ? [authorized.value.scope.other.id]
        : mentions.filter((id) => id !== actorId);
      for (const recipientId of [...new Set(recipients)]) {
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
      if (authorized.value.scope.kind === "dm" && !authorized.value.scope.canRead) return failure(
        ["pending", "declined"].includes(authorized.value.scope.pairState) ? "consent_required" : "unavailable",
      );
      const prior = await findReceipt(executor, input);
      if (!prior || prior.operation !== "send") return { ok: true, value: { state: "absent" } };
      return { ok: true, value: { state: "committed", receipt: sendReceipt(prior) } };
    });
  }

  async function getMessagePage(input: ActorConversation & { beforeCreateSeq?: number; limit?: number; rootId?: string | null }): Promise<ConversationResult<MessagePage>> {
    const limit = input.limit ?? CONVERSATION_LIMITS.pageDefault;
    if (!validIdentity(input.actorId) || !isProjectId(input.projectId) || !validIdentity(input.conversationId) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > CONVERSATION_LIMITS.pageMaximum ||
      (input.beforeCreateSeq !== undefined && (!validSequence(input.beforeCreateSeq) || input.beforeCreateSeq < 1)) ||
      (input.rootId !== undefined && input.rootId !== null && !validIdentity(input.rootId))) return failure("invalid_input");
    return inTransaction("read", async (executor) => {
      const authorized = await authorizeConversation(executor, input);
      if (!authorized.ok) return authorized;
      if (authorized.value.scope.kind === "dm" && !authorized.value.scope.canRead) return failure(
        ["pending", "declined"].includes(authorized.value.scope.pairState) ? "consent_required" : "unavailable",
      );
      const sequence = await executor.execute({ sql: "SELECT next_change_seq - 1 AS cursor FROM conversations WHERE id = ?", args: [input.conversationId] });
      const result = await executor.execute({
        sql: `SELECT m.id,m.author_id,m.root_id,m.create_seq,m.revision,m.body,m.created_at,m.edited_at,m.deleted_at,
          CASE WHEN m.root_id IS NULL THEN (SELECT COUNT(*) FROM conversation_messages reply WHERE reply.conversation_id=m.conversation_id AND reply.root_id=m.id) ELSE 0 END AS reply_count,
          CASE WHEN m.root_id IS NULL THEN (SELECT next_change_seq-1 FROM conversations snapshot WHERE snapshot.id=m.conversation_id) END AS reply_count_change_seq
          FROM conversation_messages m WHERE m.conversation_id = ?
          AND (${input.rootId ? "(m.id=? OR m.root_id=?)" : "m.root_id IS NULL"}) AND (? IS NULL OR m.create_seq < ?)
          ORDER BY create_seq DESC LIMIT ?`,
        args: [input.conversationId, ...(input.rootId ? [input.rootId,input.rootId] : []), input.beforeCreateSeq ?? null, input.beforeCreateSeq ?? null, limit + 1],
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
      if (authorized.value.scope.kind === "dm" && !authorized.value.scope.canRead) return failure(
        ["pending", "declined"].includes(authorized.value.scope.pairState) ? "consent_required" : "unavailable",
      );
      const maximum = await executor.execute({ sql: "SELECT next_change_seq - 1 AS cursor FROM conversations WHERE id = ?", args: [input.conversationId] });
      if (input.afterChangeSeq > integer(maximum.rows[0].cursor)) return failure("resync_required");
      const changes = await executor.execute({
        sql: `SELECT ch.change_seq,ch.message_id,m.root_id FROM conversation_changes ch
          LEFT JOIN conversation_messages m ON m.id=ch.message_id AND m.conversation_id=ch.conversation_id
          WHERE ch.conversation_id = ? AND ch.change_seq > ? ORDER BY ch.change_seq LIMIT ?`,
        args: [input.conversationId, input.afterChangeSeq, limit + 1],
      });
      const page = changes.rows.slice(0, limit);
      const ids = [...new Set(page.flatMap((row) => [row.message_id,row.root_id]).filter((id): id is string => typeof id === "string"))];
      let messages: ConversationDelta["messages"] = [];
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(", ");
        const source = await executor.execute({
          sql: `SELECT m.id,m.author_id,m.root_id,m.create_seq,m.revision,m.body,
              m.created_at,m.edited_at,m.deleted_at,
              CASE WHEN m.root_id IS NULL THEN (SELECT COUNT(*) FROM conversation_messages reply WHERE reply.conversation_id=m.conversation_id AND reply.root_id=m.id) ELSE 0 END AS reply_count,
              CASE WHEN m.root_id IS NULL THEN (SELECT next_change_seq-1 FROM conversations snapshot WHERE snapshot.id=m.conversation_id) END AS reply_count_change_seq
            FROM conversation_messages m WHERE m.conversation_id = ? AND m.id IN (${placeholders})
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
      if (authorized.value.scope.kind === "dm" && !authorized.value.scope.canRead) return failure(
        ["pending", "declined"].includes(authorized.value.scope.pairState) ? "consent_required" : "unavailable",
      );
      const prior = await findReceipt(executor, args);
      if (prior) {
        return prior.operation === operation && prior.payload_hash === payloadHash
          ? { ok: true, value: mutationReceipt(prior) }
          : failure("request_conflict");
      }
      const gate = writeGate(authorized.value.scope, args.expectedAudienceEpoch);
      if (!gate.ok) return gate;
      if (!await conversationWriteFencesClear(executor, args.actorId, args.projectId)) return failure("unavailable");
      if (!await validateMentionMembers(executor, args.projectId, mentions, args.conversationId)) return failure("invalid_input");
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
    getDirectMessage,
    listDirectMessages,
    listDirectMessageAudience,
    requestDirectMessage,
    transitionDirectMessage,
    sendMessage,
    getReceipt,
    getHistory,
    getMessagePage,
    editMessage,
    tombstoneMessage,
  } as const;
}
