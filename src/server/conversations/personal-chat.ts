import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { normalizePersonalChatBody, type PersonalChatMessage, type PersonalChatPage, validPersonalChatRequestId, PERSONAL_CHAT_LIMITS } from "@/lib/conversations/personal-chat-contracts";
import { validPersonalChatSend } from "@/lib/conversations/personal-chat-contracts";
import { bindPersonalMessageFiles, personalAttachmentSchema, personalMessageFiles, type PersonalChatAttachmentService } from "./personal-chat-attachments";

export type PersonalChatFailure = "unavailable" | "request_conflict" | "invalid_input" | "rate_limited" | "export_too_large";
export type PersonalChatResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: PersonalChatFailure; retryAfterSeconds?: number }>;
type PersonalChatGuardLimits = Readonly<{
  sendsPerMinute: number;
  sendWindowMilliseconds: number;
  exportMessagesMaximum: number;
  exportBytesMaximum: number;
}>;
const ok = <T>(value: T): PersonalChatResult<T> => ({ ok: true, value });
const fail = (code: PersonalChatFailure, retryAfterSeconds?: number): PersonalChatResult<never> => ({ ok: false, code, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
const hash = (body: string) => createHash("sha256").update(body, "utf8").digest("hex");
const rowNumber = (value: unknown) => Number(value);
function mapMessage(row: Record<string, unknown>): PersonalChatMessage {
  return { id: String(row.id), body: String(row.body), createdAt: rowNumber(row.created_at),
    editedAt: row.edited_at === null ? null : rowNumber(row.edited_at) };
}

/** Private self-chat data is keyed directly to one authenticated user row. */
export function createPersonalChatService(adapter: ConversationDatabaseAdapter, limits: PersonalChatGuardLimits = PERSONAL_CHAT_LIMITS, attachments?: PersonalChatAttachmentService) {
  async function assertSchema(executor: ConversationSqlExecutor) {
    await executor.execute("SELECT id, owner_id, body, client_request_id, request_hash, created_at, edited_at FROM personal_chat_messages LIMIT 0");
  }
  async function erasureClear(executor: ConversationSqlExecutor, ownerId: string) {
    const identity = await executor.execute({ sql: "SELECT clerk_id FROM users WHERE id=?", args: [ownerId] });
    const clerkId = identity.rows[0]?.clerk_id;
    if (typeof clerkId !== "string" || !clerkId) return false;
    const tombstone = accountDeletionTombstoneKey(clerkId);
    const fenced = await executor.execute({ sql: "SELECT 1 AS blocked FROM meta WHERE key=? LIMIT 1", args: [tombstone] });
    return fenced.rows.length === 0;
  }
  async function run<T>(mode: "read" | "write", fn: (executor: ConversationSqlExecutor) => Promise<T>): Promise<T> {
    if (!adapter.available) throw new Error("personal_chat_unavailable");
    return adapter.transaction(mode, async executor => { await assertSchema(executor); return fn(executor); });
  }

  return {
    async attachmentsEnabled(): Promise<boolean> { return attachments ? attachments.available() : false; },
    async list(input: { ownerId: string; limit: number; before?: string }): Promise<PersonalChatResult<PersonalChatPage>> {
      if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > PERSONAL_CHAT_LIMITS.pageMaximum) return fail("invalid_input");
      if (attachments) await attachments.repair(input.ownerId).catch(() => undefined);
      try {
        return ok(await run("read", async executor => {
          if (!await erasureClear(executor, input.ownerId)) throw new Error("personal_chat_erasure_fence");
          let cursor: Record<string, unknown> | undefined;
          if (input.before) {
            const found = await executor.execute({ sql: "SELECT created_at,id FROM personal_chat_messages WHERE owner_id=? AND id=?", args: [input.ownerId, input.before] });
            cursor = found.rows[0];
            if (!cursor) throw new Error("personal_chat_cursor_invalid");
          }
          const result = await executor.execute({
            sql: `SELECT id,body,created_at,edited_at FROM personal_chat_messages WHERE owner_id=? ${cursor ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""} ORDER BY created_at DESC,id DESC LIMIT ?`,
            args: cursor ? [input.ownerId, cursor.created_at as number, cursor.created_at as number, cursor.id as string, input.limit + 1] : [input.ownerId, input.limit + 1],
          });
          const hasMore = result.rows.length > input.limit;
          let selected = result.rows.slice(0, input.limit).reverse().map(mapMessage);
          if (attachments && await personalAttachmentSchema(executor)) selected = await personalMessageFiles(executor, input.ownerId, selected);
          return { messages: selected, nextCursor: hasMore ? selected[0]?.id ?? null : null };
        }));
      } catch (error) { return fail(error instanceof Error && error.message === "personal_chat_cursor_invalid" ? "invalid_input" : "unavailable"); }
    },
    async getReceipt(input: { ownerId: string; clientRequestId: string }): Promise<PersonalChatResult<{ message: PersonalChatMessage | null }>> {
      if (!validPersonalChatRequestId(input.clientRequestId)) return fail("invalid_input");
      try {
        return ok(await run("read", async executor => {
          if (!await erasureClear(executor, input.ownerId)) throw new Error("personal_chat_erasure_fence");
          const result = await executor.execute({ sql: "SELECT id,body,created_at,edited_at FROM personal_chat_messages WHERE owner_id=? AND client_request_id=?", args: [input.ownerId, input.clientRequestId] });
          const message = result.rows[0] ? mapMessage(result.rows[0]) : null;
          return { message: message && attachments && await personalAttachmentSchema(executor)
            ? (await personalMessageFiles(executor, input.ownerId, [message]))[0] : message };
        }));
      } catch { return fail("unavailable"); }
    },
    async exportMarkdown(input: { ownerId: string }): Promise<PersonalChatResult<{ markdown: string }>> {
      try {
        const markdown = await run("read", async executor => {
          if (!await erasureClear(executor, input.ownerId)) throw new Error("personal_chat_erasure_fence");
          const footprint = await executor.execute({ sql: "SELECT COUNT(*) AS message_count, COALESCE(SUM(length(CAST(body AS BLOB))),0) AS body_bytes FROM personal_chat_messages WHERE owner_id=?", args: [input.ownerId] });
          const messageCount = Number(footprint.rows[0]?.message_count ?? 0);
          const bodyBytes = Number(footprint.rows[0]?.body_bytes ?? 0);
          if (messageCount > limits.exportMessagesMaximum || bodyBytes > limits.exportBytesMaximum) throw new Error("personal_chat_export_too_large");
          const result = await executor.execute({ sql: "SELECT id,body,created_at,edited_at FROM personal_chat_messages WHERE owner_id=? ORDER BY created_at,id LIMIT ?", args: [input.ownerId, limits.exportMessagesMaximum + 1] });
          if (result.rows.length > limits.exportMessagesMaximum) throw new Error("personal_chat_export_too_large");
          let messages = result.rows.map(mapMessage);
          if (attachments && await personalAttachmentSchema(executor)) messages = await personalMessageFiles(executor, input.ownerId, messages);
          const lines = ["# Personal chat", "", ...messages.flatMap(message => {
            return [`## ${new Date(message.createdAt).toISOString()} · You`, "",
              ...(message.editedAt === null ? [] : ["*Edited.*", ""]), message.body,
              ...(message.attachments ?? []).map(file => `Attachment: ${file.filename} (${file.mimeType}, ${file.sizeBytes} bytes) — ${file.href} (sign in as the owner to download)`), ""];
          })];
          return { markdown: lines.join("\n") };
        });
        if (new TextEncoder().encode(markdown.markdown).byteLength > limits.exportBytesMaximum) return fail("export_too_large");
        return ok(markdown);
      } catch (error) { return fail(error instanceof Error && error.message === "personal_chat_export_too_large" ? "export_too_large" : "unavailable"); }
    },
    async send(input: { ownerId: string; clientRequestId: string; body: string; attachmentIds?: readonly string[] }): Promise<PersonalChatResult<{ message: PersonalChatMessage }>> {
      const attachmentIds = input.attachmentIds ?? [];
      if (!validPersonalChatRequestId(input.clientRequestId) || !validPersonalChatSend(input.body, attachmentIds)) return fail("invalid_input");
      if (attachmentIds.length && (!attachments || !await attachments.available())) return fail("unavailable");
      const body = normalizePersonalChatBody(input.body);
      // Keep every historical text-only receipt hash byte-identical.
      const requestHash = hash(attachmentIds.length ? JSON.stringify(["personal-chat-files-v1", body, attachmentIds]) : body);
      try {
        return ok(await run("write", async executor => {
          if (!await erasureClear(executor, input.ownerId)) throw new Error("personal_chat_erasure_fence");
          const existing = await executor.execute({ sql: "SELECT id,body,created_at,edited_at,request_hash FROM personal_chat_messages WHERE owner_id=? AND client_request_id=?", args: [input.ownerId, input.clientRequestId] });
          if (existing.rows[0]) {
            if (existing.rows[0].request_hash !== requestHash) throw new Error("personal_chat_request_conflict");
            const message = mapMessage(existing.rows[0]);
            return { message: attachmentIds.length ? (await personalMessageFiles(executor, input.ownerId, [message]))[0] : message };
          }
          const now = Date.now();
          const recent = await executor.execute({ sql: "SELECT COUNT(*) AS send_count FROM personal_chat_messages WHERE owner_id=? AND created_at>=?", args: [input.ownerId, now - limits.sendWindowMilliseconds] });
          if (Number(recent.rows[0]?.send_count ?? 0) >= limits.sendsPerMinute) throw new Error("personal_chat_rate_limited");
          const message = { id: randomUUID(), body, createdAt: now, editedAt: null } satisfies PersonalChatMessage;
          await executor.execute({ sql: "INSERT INTO personal_chat_messages(id,owner_id,body,client_request_id,request_hash,created_at,edited_at) VALUES (?,?,?,?,?,?,NULL)", args: [message.id, input.ownerId, message.body, input.clientRequestId, requestHash, message.createdAt] });
          if (attachmentIds.length) {
            await bindPersonalMessageFiles(executor, { ownerId: input.ownerId, messageId: message.id, attachmentIds, now });
            return { message: (await personalMessageFiles(executor, input.ownerId, [message]))[0] };
          }
          return { message };
        }));
      } catch (error) {
        if (error instanceof Error && error.message === "personal_chat_request_conflict") return fail("request_conflict");
        if (error instanceof Error && error.message === "personal_chat_rate_limited") return fail("rate_limited", Math.ceil(limits.sendWindowMilliseconds / 1_000));
        return fail("unavailable");
      }
    },
  };
}
