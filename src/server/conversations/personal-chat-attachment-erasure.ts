import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { personalChatAttachments } from "@/server/db/schema";
import { personalAttachmentStorage, type PersonalAttachmentStorage } from "./personal-chat-attachments";

/** Called only after the account's durable deletion fence is installed. */
export async function erasePersonalChatAttachmentsWith(database: LibSQLDatabase<typeof schema>, ownerId: string,
  storage: Pick<PersonalAttachmentStorage, "remove"> = personalAttachmentStorage, now = Date.now()) {
  const tables = await database.run(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='personal_chat_attachments'`);
  if (!tables.rows.length) return;
  // Commit cleanup custody BEFORE bytes or identity rows can disappear.
  await database.update(personalChatAttachments).set({ state: "cleanup" })
    .where(and(eq(personalChatAttachments.ownerId, ownerId), ne(personalChatAttachments.state, "deleted")));
  const rows = await database.select().from(personalChatAttachments).where(eq(personalChatAttachments.ownerId, ownerId));
  let pending = false;
  for (const row of rows) {
    if (row.state === "deleted") continue;
    if (row.writerSettled !== 1 && row.custodyUntil > now) { pending = true; continue; }
    try {
      await storage.remove(row.backend, row.storageKey);
      await database.update(personalChatAttachments).set({ state: "deleted", storedPath: null })
        .where(and(eq(personalChatAttachments.ownerId, ownerId), eq(personalChatAttachments.id, row.id), eq(personalChatAttachments.state, "cleanup")));
    } catch { pending = true; }
  }
  if (pending) throw new Error("account erasure deferred: personal chat file bytes retain exact in-flight or retry custody");
  await database.delete(personalChatAttachments).where(and(eq(personalChatAttachments.ownerId, ownerId), eq(personalChatAttachments.state, "deleted")));
}
