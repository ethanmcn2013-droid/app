import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { safeFilename } from "@/lib/attachment-claim";
import { validateUpload } from "@/lib/upload-validation";
import { PERSONAL_CHAT_ATTACHMENT_LIMITS as LIMIT, validPersonalChatRequestId, type PersonalChatAttachment, type PersonalChatMessage } from "@/lib/conversations/personal-chat-contracts";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";
import { personalAttachmentStorage, PersonalAttachmentWriteError, type PersonalAttachmentStorage } from "./personal-chat-attachment-storage";
export { personalAttachmentStorage, type PersonalAttachmentStorage } from "./personal-chat-attachment-storage";

export type PersonalAttachmentFailure = "invalid_input" | "unavailable" | "request_conflict" | "rate_limited" | "upload_too_large" | "unsupported_file" | "quota_exceeded" | "upload_in_progress" | "storage_unavailable";
export type PersonalAttachmentResult<T> = { ok: true; value: T } | { ok: false; code: PersonalAttachmentFailure };
export type PersonalAttachmentRow = Record<string, unknown>;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "text/markdown"]);
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const success = <T>(value: T): PersonalAttachmentResult<T> => ({ ok: true, value });
const failure = (code: PersonalAttachmentFailure): PersonalAttachmentResult<never> => ({ ok: false, code });
export const personalAttachmentDescriptor = (row: PersonalAttachmentRow): PersonalChatAttachment => ({
  id: String(row.id), filename: String(row.filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes),
  href: `/api/personal-chat/attachments/${encodeURIComponent(String(row.id))}`,
});

export async function personalChatErasureClear(executor: ConversationSqlExecutor, ownerId: string): Promise<boolean> {
  const identity = await executor.execute({ sql: "SELECT clerk_id FROM users WHERE id=?", args: [ownerId] });
  const clerkId = identity.rows[0]?.clerk_id;
  if (typeof clerkId !== "string" || !clerkId) return false;
  return (await executor.execute({ sql: "SELECT 1 FROM meta WHERE key=? LIMIT 1", args: [accountDeletionTombstoneKey(clerkId)] })).rows.length === 0;
}

export async function personalAttachmentSchema(executor: ConversationSqlExecutor): Promise<boolean> {
  try {
    await executor.execute("SELECT id,owner_id,message_id,position,client_request_id,request_hash,filename,mime_type,size_bytes,backend,store_identity,storage_key,stored_path,state,writer_settled,custody_until,expires_at,created_at FROM personal_chat_attachments LIMIT 0");
    return true;
  } catch { return false; }
}

/** Reads and binds run on the SAME transaction as their parent message. */
export async function personalMessageFiles(executor: ConversationSqlExecutor, ownerId: string, messages: readonly PersonalChatMessage[]): Promise<PersonalChatMessage[]> {
  if (!messages.length) return [...messages];
  const rows = await executor.execute({
    sql: `SELECT id,message_id,filename,mime_type,size_bytes FROM personal_chat_attachments WHERE owner_id=? AND state='bound' AND message_id IN (${messages.map(() => "?").join(",")}) ORDER BY position,id`,
    args: [ownerId, ...messages.map(message => message.id)],
  });
  return messages.map(message => {
    const attachments = rows.rows.filter(row => row.message_id === message.id).map(personalAttachmentDescriptor);
    return attachments.length ? { ...message, attachments } : message;
  });
}

export async function bindPersonalMessageFiles(executor: ConversationSqlExecutor, input: { ownerId: string; messageId: string; attachmentIds: readonly string[]; now: number }) {
  for (const [position, id] of input.attachmentIds.entries()) {
    const updated = await executor.execute({
      sql: "UPDATE personal_chat_attachments SET state='bound',message_id=?,position=? WHERE id=? AND owner_id=? AND state='ready' AND writer_settled=1 AND expires_at>? RETURNING id",
      args: [input.messageId, position, id, input.ownerId, input.now],
    });
    if (!updated.rows.length) throw new Error("personal_chat_attachment_unavailable");
  }
}

/** No Task, Project, membership or guest identity exists in this boundary. */
export function createPersonalChatAttachmentService(adapter: ConversationDatabaseAdapter, options: {
  enabled: boolean; storage?: PersonalAttachmentStorage; now?: () => number;
}) {
  const storage = options.storage ?? personalAttachmentStorage;
  const now = options.now ?? Date.now;
  const run = <T>(mode: "read" | "write", action: (executor: ConversationSqlExecutor) => Promise<T>) => {
    if (!adapter.available) throw new Error("attachment_unavailable");
    return adapter.transaction(mode, action);
  };
  async function available() {
    if (!options.enabled || !storage.backend()) return false;
    try { return await run("read", personalAttachmentSchema); } catch { return false; }
  }
  async function repair(ownerId: string, erase = false): Promise<{ pending: number }> {
    const rows = await run("write", async executor => {
      if (!await personalAttachmentSchema(executor)) return [];
      const time = now();
      await executor.execute({ sql: `UPDATE personal_chat_attachments SET state='cleanup' WHERE owner_id=? AND state IN (${erase ? "'uploading','ready','bound'" : "'uploading','ready'"}) ${erase ? "" : "AND expires_at<=?"}`, args: erase ? [ownerId] : [ownerId, time] });
      return (await executor.execute({ sql: "SELECT * FROM personal_chat_attachments WHERE owner_id=? AND state='cleanup' ORDER BY created_at LIMIT 100", args: [ownerId] })).rows;
    });
    let pending = 0;
    for (const row of rows) {
      // Time cannot prove that a suspended or remote writer has terminated.
      if (Number(row.writer_settled) !== 1) { pending++; continue; }
      try {
        await storage.remove(String(row.backend), String(row.storage_key), String(row.store_identity));
        await run("write", async executor => {
          await executor.execute({ sql: "UPDATE personal_chat_attachments SET state='deleted',stored_path=NULL WHERE id=? AND owner_id=? AND state='cleanup'", args: [String(row.id), ownerId] });
        });
      } catch { pending++; }
    }
    if (erase) {
      // Rows retain byte custody until every exact delete is confirmed.
      const remaining = await run("read", async executor => Number((await executor.execute({ sql: "SELECT COUNT(*) AS n FROM personal_chat_attachments WHERE owner_id=? AND state!='deleted'", args: [ownerId] })).rows[0]?.n ?? 0));
      return { pending: Math.max(pending, remaining) };
    }
    return { pending };
  }
  return {
    available, repair,
    async upload(input: { ownerId: string; clientRequestId: string; filename: string; mimeType: string; bytes: Uint8Array }): Promise<PersonalAttachmentResult<{ attachment: PersonalChatAttachment }>> {
      if (!validPersonalChatRequestId(input.clientRequestId) || !input.filename || input.filename.length > 512 || !input.bytes.length) return failure("invalid_input");
      if (input.bytes.length > LIMIT.fileBytes) return failure("upload_too_large");
      const mimeType = input.mimeType.split(";")[0].trim().toLowerCase();
      if (!TYPES.has(mimeType) || !validateUpload(mimeType, input.bytes.subarray(0, 16), input.bytes.length).ok) return failure("unsupported_file");
      if (!await available()) return failure("unavailable");
      await repair(input.ownerId);
      const filename = safeFilename(input.filename).slice(0, 180);
      const requestHash = digest(JSON.stringify([filename, mimeType, input.bytes.length, digest(input.bytes)]));
      let claim: PersonalAttachmentRow;
      try {
        const reserved = await run("write", async executor => {
          if (!await personalChatErasureClear(executor, input.ownerId)) return failure("unavailable");
          const previous = (await executor.execute({ sql: "SELECT * FROM personal_chat_attachments WHERE owner_id=? AND client_request_id=?", args: [input.ownerId, input.clientRequestId] })).rows[0];
          if (previous) {
            if (previous.request_hash !== requestHash) return failure("request_conflict");
            if (previous.state === "ready" || previous.state === "bound") return success({ row: previous, replay: true });
            return failure(previous.state === "uploading" ? "upload_in_progress" : "unavailable");
          }
          const time = now();
          const footprint = (await executor.execute({ sql: "SELECT COALESCE(SUM(CASE WHEN state!='deleted' THEN size_bytes ELSE 0 END),0) AS bytes,COALESCE(SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END),0) AS recent FROM personal_chat_attachments WHERE owner_id=?", args: [time - 60_000, input.ownerId] })).rows[0];
          if (Number(footprint?.recent ?? 0) >= LIMIT.uploadsPerMinute) return failure("rate_limited");
          if (Number(footprint?.bytes ?? 0) + input.bytes.length > LIMIT.ownerBytes) return failure("quota_exceeded");
          const backend = storage.backend();
          const identity = backend && storage.identity(backend);
          if (!backend || !identity) return failure("storage_unavailable");
          const id = `pca_${randomUUID().replaceAll("-", "")}`;
          const key = `personal-chat/${digest(input.ownerId)}/${id}-${filename}`;
          const row = { id, owner_id: input.ownerId, filename, mime_type: mimeType, size_bytes: input.bytes.length, backend, store_identity: identity, storage_key: key, custody_until: time + LIMIT.writerMilliseconds };
          await executor.execute({ sql: "INSERT INTO personal_chat_attachments(id,owner_id,client_request_id,request_hash,filename,mime_type,size_bytes,backend,store_identity,storage_key,state,writer_settled,custody_until,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'uploading',0,?,?,?)", args: [id, input.ownerId, input.clientRequestId, requestHash, filename, mimeType, input.bytes.length, backend, identity, key, row.custody_until, time + LIMIT.draftMilliseconds, time] });
          // Keep recent cancelled receipts for rate limits and request-key replay.
          await executor.execute({ sql: "DELETE FROM personal_chat_attachments WHERE owner_id=? AND state='deleted' AND created_at<?", args: [input.ownerId, time - LIMIT.draftMilliseconds] });
          return success({ row, replay: false });
        });
        if (!reserved.ok) return reserved;
        claim = reserved.value.row;
        if (reserved.value.replay) return success({ attachment: personalAttachmentDescriptor(claim) });
      } catch { return failure("unavailable"); }
      try {
        const deadline = Number(claim.custody_until);
        const admit = async () => run("read", async executor => {
          const row = (await executor.execute({ sql: "SELECT state,writer_settled,custody_until,backend,store_identity FROM personal_chat_attachments WHERE id=? AND owner_id=?", args: [String(claim.id), input.ownerId] })).rows[0];
          return !!row && row.state === "uploading" && Number(row.writer_settled) === 0 && Number(row.custody_until) === deadline && now() < deadline &&
            row.backend === claim.backend && row.store_identity === claim.store_identity && storage.identity(String(row.backend)) === row.store_identity && await personalChatErasureClear(executor, input.ownerId);
        });
        if (!await admit()) throw new PersonalAttachmentWriteError(true);
        const path = await storage.put(String(claim.storage_key), input.bytes, mimeType, claim.backend as "disk" | "blob", String(claim.store_identity), {
          deadline, signal: AbortSignal.timeout(Math.max(0, deadline - now())), admit,
        });
        const finalized = await run("write", async executor => {
          await executor.execute({ sql: "UPDATE personal_chat_attachments SET writer_settled=1 WHERE id=? AND owner_id=?", args: [String(claim.id), input.ownerId] });
          if (!await personalChatErasureClear(executor, input.ownerId)) return false;
          const result = await executor.execute({ sql: "UPDATE personal_chat_attachments SET state='ready',stored_path=? WHERE id=? AND owner_id=? AND state='uploading' RETURNING id", args: [path, String(claim.id), input.ownerId] });
          return !!result.rows.length;
        });
        if (finalized) return success({ attachment: personalAttachmentDescriptor(claim) });
      } catch (error) {
        if (error instanceof PersonalAttachmentWriteError && error.settled) {
          await run("write", async executor => { await executor.execute({ sql: "UPDATE personal_chat_attachments SET writer_settled=1 WHERE id=? AND owner_id=?", args: [String(claim.id), input.ownerId] }); }).catch(() => undefined);
        }
        // A rejected remote PUT has uncertain completion. Keep custody until
        // affirmative terminal proof or separately reviewed reconciliation.
      }
      await run("write", async executor => { await executor.execute({ sql: "UPDATE personal_chat_attachments SET state='cleanup' WHERE id=? AND owner_id=? AND state IN ('uploading','ready')", args: [String(claim.id), input.ownerId] }); }).catch(() => undefined);
      await repair(input.ownerId).catch(() => undefined);
      return failure("storage_unavailable");
    },
    async cancel(input: { ownerId: string; id: string }): Promise<PersonalAttachmentResult<{ cancelled: true }>> {
      if (!await available()) return failure("unavailable");
      try {
        const cancelled = await run("write", async executor => {
          if (!await personalChatErasureClear(executor, input.ownerId)) return false;
          return (await executor.execute({ sql: "UPDATE personal_chat_attachments SET state=CASE WHEN state='deleted' THEN 'deleted' ELSE 'cleanup' END WHERE id=? AND owner_id=? AND message_id IS NULL RETURNING id", args: [input.id, input.ownerId] })).rows.length > 0;
        });
        if (!cancelled) return failure("unavailable");
        await repair(input.ownerId);
        return success({ cancelled: true });
      } catch { return failure("unavailable"); }
    },
    async read(input: { ownerId: string; id: string }): Promise<PersonalAttachmentResult<{ row: PersonalAttachmentRow }>> {
      try {
        return await run("read", async executor => {
          if (!await personalAttachmentSchema(executor) || !await personalChatErasureClear(executor, input.ownerId)) return failure("unavailable");
          const row = (await executor.execute({ sql: "SELECT a.* FROM personal_chat_attachments a JOIN personal_chat_messages m ON m.id=a.message_id AND m.owner_id=a.owner_id WHERE a.id=? AND a.owner_id=? AND a.state='bound'", args: [input.id, input.ownerId] })).rows[0];
          return row && storage.identity(String(row.backend)) === row.store_identity ? success({ row }) : failure("unavailable");
        });
      } catch { return failure("unavailable"); }
    },
  };
}

export type PersonalChatAttachmentService = ReturnType<typeof createPersonalChatAttachmentService>;
