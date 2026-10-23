import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { safeFilename } from "@/lib/attachment-claim";
import { validateUpload } from "@/lib/upload-validation";
import { CONVERSATION_ATTACHMENT_LIMITS as LIMIT, type ConversationAttachment } from "@/lib/conversations/attachment-contracts";
import { type MessageRecord, validRequestId } from "@/lib/conversations/contracts";
import { isProjectId, type ProjectId } from "@/lib/projects/project-ref";
import { authorizeConversationAttachment } from "./service";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";
import { personalAttachmentStorage, PersonalAttachmentWriteError, type PersonalAttachmentStorage } from "./personal-chat-attachment-storage";
export { personalAttachmentStorage, type PersonalAttachmentStorage } from "./personal-chat-attachment-storage";

export type ConversationAttachmentFailure = "invalid_input" | "unavailable" | "request_conflict" | "rate_limited" | "upload_too_large" | "unsupported_file" | "quota_exceeded" | "upload_in_progress" | "storage_unavailable";
export type ConversationAttachmentResult<T> = { ok: true; value: T } | { ok: false; code: ConversationAttachmentFailure };
export type ConversationAttachmentRow = Record<string, unknown>;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "text/markdown"]);
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const success = <T>(value: T): ConversationAttachmentResult<T> => ({ ok: true, value });
const failure = (code: ConversationAttachmentFailure): ConversationAttachmentResult<never> => ({ ok: false, code });
export const conversationAttachmentDescriptor = (row: ConversationAttachmentRow): ConversationAttachment => ({
  id: String(row.id), filename: String(row.filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes),
  href: `/api/conversations/attachments/${encodeURIComponent(String(row.id))}`,
});

export async function personalChatErasureClear(executor: ConversationSqlExecutor, ownerId: string): Promise<boolean> {
  const identity = await executor.execute({ sql: "SELECT clerk_id FROM users WHERE id=?", args: [ownerId] });
  const clerkId = identity.rows[0]?.clerk_id;
  if (typeof clerkId !== "string" || !clerkId) return false;
  return (await executor.execute({ sql: "SELECT 1 FROM meta WHERE key=? LIMIT 1", args: [accountDeletionTombstoneKey(clerkId)] })).rows.length === 0;
}

export async function conversationAttachmentSchema(executor: ConversationSqlExecutor): Promise<boolean> {
  try {
    await executor.execute("SELECT workspace_id,conversation_id,root_id,audience_epoch,id,owner_id,message_id,position,client_request_id,request_hash,filename,mime_type,size_bytes,backend,store_identity,storage_key,stored_path,state,writer_settled,custody_until,expires_at,created_at FROM conversation_chat_attachments LIMIT 0");
    return true;
  } catch { return false; }
}

export type ConversationAttachmentScope = { ownerId: string; projectId: ProjectId; conversationId: string; rootId: string | null; expectedAudienceEpoch: number };

export function createConversationAttachmentService(adapter: ConversationDatabaseAdapter, options: {
  enabled: boolean; directMessagesEnabled?: boolean; storage?: PersonalAttachmentStorage; now?: () => number;
}) {
  const storage = options.storage ?? personalAttachmentStorage;
  const now = options.now ?? Date.now;
  const authorize = (executor: ConversationSqlExecutor, input: ConversationAttachmentScope, mode: "read" | "write" = "write") => authorizeConversationAttachment(executor, { ...input, actorId: input.ownerId }, options.directMessagesEnabled ?? false, mode);
  const run = <T>(mode: "read" | "write", action: (executor: ConversationSqlExecutor) => Promise<T>) => {
    if (!adapter.available) throw new Error("attachment_unavailable");
    return adapter.transaction(mode, action);
  };
  async function available() {
    if (!options.enabled || !storage.backend()) return false;
    try { return await run("read", conversationAttachmentSchema); } catch { return false; }
  }
  async function repair(ownerId: string, erase = false): Promise<{ pending: number }> {
    const rows = await run("write", async executor => {
      if (!await conversationAttachmentSchema(executor)) return [];
      const time = now();
      await executor.execute({ sql: `UPDATE conversation_chat_attachments SET state='cleanup' WHERE owner_id=? AND state IN (${erase ? "'uploading','ready','bound'" : "'uploading','ready'"}) ${erase ? "" : "AND expires_at<=?"}`, args: erase ? [ownerId] : [ownerId, time] });
      return (await executor.execute({ sql: "SELECT * FROM conversation_chat_attachments WHERE owner_id=? AND state='cleanup' ORDER BY created_at LIMIT 100", args: [ownerId] })).rows;
    });
    let pending = 0;
    for (const row of rows) {
      // Time cannot prove that a suspended or remote writer has terminated.
      if (Number(row.writer_settled) !== 1) { pending++; continue; }
      try {
        await storage.remove(String(row.backend), String(row.storage_key), String(row.store_identity));
        await run("write", async executor => {
          await executor.execute({ sql: "UPDATE conversation_chat_attachments SET state='deleted',stored_path=NULL WHERE id=? AND owner_id=? AND state='cleanup'", args: [String(row.id), ownerId] });
        });
      } catch { pending++; }
    }
    if (erase) {
      // Rows retain byte custody until every exact delete is confirmed.
      const remaining = await run("read", async executor => Number((await executor.execute({ sql: "SELECT COUNT(*) AS n FROM conversation_chat_attachments WHERE owner_id=? AND state!='deleted'", args: [ownerId] })).rows[0]?.n ?? 0));
      return { pending: Math.max(pending, remaining) };
    }
    return { pending };
  }
  return {
    available, repair,
    async availability(input: ConversationAttachmentScope) {
      if (!await available()) return failure("unavailable");
      try { return await run("read", async executor => (await authorize(executor, input)).ok ? success({ available: true as const }) : failure("unavailable")); } catch { return failure("unavailable"); }
    },
    async upload(input: ConversationAttachmentScope & { clientRequestId: string; filename: string; mimeType: string; bytes: Uint8Array }): Promise<ConversationAttachmentResult<{ attachment: ConversationAttachment }>> {
      if (!isProjectId(input.projectId) || !/^[A-Za-z0-9_-]{1,128}$/.test(input.conversationId) || (input.rootId !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(input.rootId)) || !Number.isSafeInteger(input.expectedAudienceEpoch) || !validRequestId(input.clientRequestId) || !input.filename || input.filename.length > 512 || !input.bytes.length) return failure("invalid_input");
      if (input.bytes.length > LIMIT.fileBytes) return failure("upload_too_large");
      const mimeType = input.mimeType.split(";")[0].trim().toLowerCase();
      if (!TYPES.has(mimeType) || !validateUpload(mimeType, input.bytes.subarray(0, 16), input.bytes.length).ok) return failure("unsupported_file");
      if (!await available()) return failure("unavailable");
      await repair(input.ownerId);
      const filename = safeFilename(input.filename).slice(0, 180);
      const requestHash = digest(JSON.stringify([input.projectId,input.conversationId,input.rootId,input.expectedAudienceEpoch,filename,mimeType,input.bytes.length,digest(input.bytes)]));
      let claim: ConversationAttachmentRow;
      try {
        const reserved = await run("write", async executor => {
          if (!(await authorize(executor, input)).ok || !await personalChatErasureClear(executor, input.ownerId)) return failure("unavailable");
          const previous = (await executor.execute({ sql: "SELECT * FROM conversation_chat_attachments WHERE owner_id=? AND client_request_id=?", args: [input.ownerId, input.clientRequestId] })).rows[0];
          if (previous) {
            if (previous.request_hash !== requestHash) return failure("request_conflict");
            if (previous.state === "ready" || previous.state === "bound") return success({ row: previous, replay: true });
            return failure(previous.state === "uploading" ? "upload_in_progress" : "unavailable");
          }
          const time = now();
          const footprint = (await executor.execute({ sql: "SELECT COALESCE(SUM(CASE WHEN state!='deleted' THEN size_bytes ELSE 0 END),0) AS bytes,COALESCE(SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END),0) AS recent FROM conversation_chat_attachments WHERE owner_id=?", args: [time - 60_000, input.ownerId] })).rows[0];
          if (Number(footprint?.recent ?? 0) >= LIMIT.uploadsPerMinute) return failure("rate_limited");
          if (Number(footprint?.bytes ?? 0) + input.bytes.length > LIMIT.ownerBytes) return failure("quota_exceeded");
          const backend = storage.backend();
          const identity = backend && storage.identity(backend);
          if (!backend || !identity) return failure("storage_unavailable");
          const id = `ca_${randomUUID().replaceAll("-", "")}`;
          const key = `conversation-chat/${digest(input.conversationId)}/${id}-${filename}`;
          const row = { id, owner_id: input.ownerId, filename, mime_type: mimeType, size_bytes: input.bytes.length, backend, store_identity: identity, storage_key: key, custody_until: time + LIMIT.writerMilliseconds };
          await executor.execute({ sql: "INSERT INTO conversation_chat_attachments(workspace_id,conversation_id,root_id,audience_epoch,id,owner_id,client_request_id,request_hash,filename,mime_type,size_bytes,backend,store_identity,storage_key,state,writer_settled,custody_until,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'uploading',0,?,?,?)", args: [input.projectId,input.conversationId,input.rootId,input.expectedAudienceEpoch,id, input.ownerId, input.clientRequestId, requestHash, filename, mimeType, input.bytes.length, backend, identity, key, row.custody_until, time + LIMIT.draftMilliseconds, time] });
          // Keep recent cancelled receipts for rate limits and request-key replay.
          await executor.execute({ sql: "DELETE FROM conversation_chat_attachments WHERE owner_id=? AND state='deleted' AND created_at<?", args: [input.ownerId, time - LIMIT.draftMilliseconds] });
          return success({ row, replay: false });
        });
        if (!reserved.ok) return reserved;
        claim = reserved.value.row;
        if (reserved.value.replay) return success({ attachment: conversationAttachmentDescriptor(claim) });
      } catch { return failure("unavailable"); }
      try {
        const deadline = Number(claim.custody_until);
        const admit = async () => run("read", async executor => {
          const row = (await executor.execute({ sql: "SELECT state,writer_settled,custody_until,backend,store_identity FROM conversation_chat_attachments WHERE id=? AND owner_id=?", args: [String(claim.id), input.ownerId] })).rows[0];
          return (await authorize(executor, input)).ok && !!row && row.state === "uploading" && Number(row.writer_settled) === 0 && Number(row.custody_until) === deadline && now() < deadline &&
            row.backend === claim.backend && row.store_identity === claim.store_identity && storage.identity(String(row.backend)) === row.store_identity && await personalChatErasureClear(executor, input.ownerId);
        });
        if (!await admit()) throw new PersonalAttachmentWriteError(true);
        const path = await storage.put(String(claim.storage_key), input.bytes, mimeType, claim.backend as "disk" | "blob", String(claim.store_identity), {
          deadline, signal: AbortSignal.timeout(Math.max(0, deadline - now())), admit,
        });
        const finalized = await run("write", async executor => {
          await executor.execute({ sql: "UPDATE conversation_chat_attachments SET writer_settled=1 WHERE id=? AND owner_id=?", args: [String(claim.id), input.ownerId] });
          if (!(await authorize(executor, input)).ok || !await personalChatErasureClear(executor, input.ownerId)) return false;
          const result = await executor.execute({ sql: "UPDATE conversation_chat_attachments SET state='ready',stored_path=? WHERE id=? AND owner_id=? AND state='uploading' RETURNING id", args: [path, String(claim.id), input.ownerId] });
          return !!result.rows.length;
        });
        if (finalized) return success({ attachment: conversationAttachmentDescriptor(claim) });
      } catch (error) {
        if (error instanceof PersonalAttachmentWriteError && error.settled) {
          await run("write", async executor => { await executor.execute({ sql: "UPDATE conversation_chat_attachments SET writer_settled=1 WHERE id=? AND owner_id=?", args: [String(claim.id), input.ownerId] }); }).catch(() => undefined);
        }
        // A rejected remote PUT has uncertain completion. Keep custody until
        // affirmative terminal proof or separately reviewed reconciliation.
      }
      await run("write", async executor => { await executor.execute({ sql: "UPDATE conversation_chat_attachments SET state='cleanup' WHERE id=? AND owner_id=? AND state IN ('uploading','ready')", args: [String(claim.id), input.ownerId] }); }).catch(() => undefined);
      await repair(input.ownerId).catch(() => undefined);
      return failure("storage_unavailable");
    },
    async cancel(input: { ownerId: string; id: string }): Promise<ConversationAttachmentResult<{ cancelled: true }>> {
      if (!await available()) return failure("unavailable");
      try {
        const cancelled = await run("write", async executor => {
          const claim = (await executor.execute({ sql: "SELECT * FROM conversation_chat_attachments WHERE id=? AND owner_id=?", args: [input.id,input.ownerId] })).rows[0];
          if (!claim || !(await authorize(executor, { ownerId: input.ownerId, projectId: String(claim.workspace_id) as ProjectId, conversationId: String(claim.conversation_id), rootId: claim.root_id == null ? null : String(claim.root_id), expectedAudienceEpoch: Number(claim.audience_epoch) }, "read")).ok || !await personalChatErasureClear(executor, input.ownerId)) return false;
          return (await executor.execute({ sql: "UPDATE conversation_chat_attachments SET state=CASE WHEN state='deleted' THEN 'deleted' ELSE 'cleanup' END WHERE id=? AND owner_id=? AND message_id IS NULL RETURNING id", args: [input.id, input.ownerId] })).rows.length > 0;
        });
        if (!cancelled) return failure("unavailable");
        await repair(input.ownerId);
        return success({ cancelled: true });
      } catch { return failure("unavailable"); }
    },
    async read(input: { ownerId: string; id: string }): Promise<ConversationAttachmentResult<{ row: ConversationAttachmentRow }>> {
      try {
        return await run("read", async executor => {
          if (!await conversationAttachmentSchema(executor) || !await personalChatErasureClear(executor, input.ownerId)) return failure("unavailable");
          const row = (await executor.execute({ sql: "SELECT a.* FROM conversation_chat_attachments a JOIN conversation_messages m ON m.id=a.message_id AND m.conversation_id=a.conversation_id AND m.workspace_id=a.workspace_id WHERE a.id=? AND a.state='bound' AND m.deleted_at IS NULL", args: [input.id] })).rows[0];
          if (!row || !await personalChatErasureClear(executor, String(row.owner_id)) || !(await authorize(executor, { ownerId: input.ownerId, projectId: String(row.workspace_id) as ProjectId, conversationId: String(row.conversation_id), rootId: row.root_id == null ? null : String(row.root_id), expectedAudienceEpoch: Number(row.audience_epoch) }, "read")).ok) return failure("unavailable");
          return row && storage.identity(String(row.backend)) === row.store_identity ? success({ row }) : failure("unavailable");
        });
      } catch { return failure("unavailable"); }
    },
  };
}

export type ConversationAttachmentService = ReturnType<typeof createConversationAttachmentService>;

export async function conversationMessagesWithFiles(executor: ConversationSqlExecutor, conversationId: string, messages: readonly MessageRecord[]): Promise<MessageRecord[]> {
  const live = messages.filter(message => message.deletedAt === null);
  if (!live.length || !await conversationAttachmentSchema(executor)) return [...messages];
  const rows = await executor.execute({ sql: `SELECT a.* FROM conversation_chat_attachments a JOIN conversation_messages m ON m.id=a.message_id AND m.conversation_id=a.conversation_id AND m.workspace_id=a.workspace_id WHERE a.conversation_id=? AND a.message_id IN (${live.map(() => "?").join(",")}) AND a.state='bound' AND m.deleted_at IS NULL ORDER BY a.position,a.id`, args: [conversationId,...live.map(message => message.id)] });
  const files = new Map<string, ConversationAttachment[]>();
  for (const row of rows.rows) {
    const id = String(row.message_id);
    files.set(id, [...(files.get(id) ?? []), conversationAttachmentDescriptor(row)]);
  }
  return messages.map(message => files.has(message.id) ? { ...message, attachments: files.get(message.id)! } : message);
}
export async function conversationMessageAttachments(executor: ConversationSqlExecutor, conversationId: string, messageId: string): Promise<ConversationAttachment[]> {
  if (!await conversationAttachmentSchema(executor)) return [];
  const result = await executor.execute({ sql: "SELECT a.* FROM conversation_chat_attachments a JOIN conversation_messages m ON m.id=a.message_id AND m.conversation_id=a.conversation_id AND m.workspace_id=a.workspace_id WHERE a.conversation_id=? AND a.message_id=? AND a.state='bound' AND m.deleted_at IS NULL ORDER BY a.position,a.id", args: [conversationId,messageId] });
  return result.rows.map(conversationAttachmentDescriptor);
}
export class ConversationAttachmentBindingError extends Error {}
export async function validateConversationMessageFiles(executor: ConversationSqlExecutor, input: ConversationAttachmentScope & { attachmentIds: readonly string[]; now: number }): Promise<boolean> {
  if (!await conversationAttachmentSchema(executor)) return false;
  for (const id of input.attachmentIds) {
    const result = await executor.execute({ sql: "SELECT id FROM conversation_chat_attachments WHERE id=? AND owner_id=? AND workspace_id=? AND conversation_id=? AND root_id IS ? AND audience_epoch=? AND state='ready' AND message_id IS NULL AND writer_settled=1 AND expires_at>?", args: [id,input.ownerId,input.projectId,input.conversationId,input.rootId,input.expectedAudienceEpoch,input.now] });
    if (result.rows.length !== 1) return false;
  }
  return true;
}
export async function bindConversationMessageFiles(executor: ConversationSqlExecutor, input: ConversationAttachmentScope & { attachmentIds: readonly string[]; messageId: string; now: number }) {
  for (const [position,id] of input.attachmentIds.entries()) {
    const result = await executor.execute({ sql: "UPDATE conversation_chat_attachments SET state='bound',message_id=?,position=? WHERE id=? AND owner_id=? AND workspace_id=? AND conversation_id=? AND root_id IS ? AND audience_epoch=? AND state='ready' AND message_id IS NULL AND writer_settled=1 AND expires_at>? RETURNING id", args: [input.messageId,position,id,input.ownerId,input.projectId,input.conversationId,input.rootId,input.expectedAudienceEpoch,input.now] });
    if (result.rows.length !== 1) throw new ConversationAttachmentBindingError("conversation_attachment_unavailable");
  }
}
