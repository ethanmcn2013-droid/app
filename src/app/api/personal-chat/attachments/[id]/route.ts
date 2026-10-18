import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { resolveConversationControls } from "@/lib/conversations/flags";
import { authenticateConversationActor, getPersonalChatAttachmentService } from "@/server/conversations/runtime";
import { createPersonalChatAttachmentDownload } from "@/server/conversations/personal-chat-attachment-http";
import { resolveStoredPath, openBlobStream } from "@/server/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createPersonalChatAttachmentDownload({
  authenticate: authenticateConversationActor,
  controls: () => resolveConversationControls(process.env),
  service: getPersonalChatAttachmentService,
  async open(row) {
    const target = await resolveStoredPath(String(row.stored_path));
    if (target.kind === "missing") return null;
    if (target.kind === "blob") return (await openBlobStream(target.url))?.stream ?? null;
    return Readable.toWeb(createReadStream(target.absPath)) as ReadableStream<Uint8Array>;
  },
});
