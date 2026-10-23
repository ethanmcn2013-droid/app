import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { conversationChatAttachments } from "@/server/db/schema";
import { personalAttachmentStorage, type PersonalAttachmentStorage } from "./personal-chat-attachment-storage";

/** Called only after the account's durable deletion fence is installed. */
export async function eraseConversationAttachmentsWith(database: LibSQLDatabase<typeof schema>, scope: { ownerId: string } | { projectId: string },
  storage: Pick<PersonalAttachmentStorage, "remove"> = personalAttachmentStorage) {
  const tables = await database.run(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_chat_attachments'`);
  if (!tables.rows.length) return;
  const selector = "ownerId" in scope ? eq(conversationChatAttachments.ownerId, scope.ownerId) : eq(conversationChatAttachments.workspaceId, scope.projectId);
  // Commit cleanup custody BEFORE bytes or identity rows can disappear.
  await database.update(conversationChatAttachments).set({ state: "cleanup" })
    .where(and(selector, ne(conversationChatAttachments.state, "deleted")));
  const rows = await database.select().from(conversationChatAttachments).where(selector);
  let pending = false;
  for (const row of rows) {
    if (row.state === "deleted") continue;
    if (row.writerSettled !== 1) { pending = true; continue; }
    try {
      await storage.remove(row.backend, row.storageKey, row.storeIdentity);
      await database.update(conversationChatAttachments).set({ state: "deleted", storedPath: null })
        .where(and(selector, eq(conversationChatAttachments.id, row.id), eq(conversationChatAttachments.state, "cleanup")));
    } catch { pending = true; }
  }
  if (pending) throw new Error("account erasure deferred: conversation file bytes retain exact in-flight or retry custody");
  await database.delete(conversationChatAttachments).where(and(selector, eq(conversationChatAttachments.state, "deleted")));
}
