import { resolveConversationControls } from "@/lib/conversations/flags";
import { authenticateConversationActor, getPersonalChatAttachmentService } from "@/server/conversations/runtime";
import { createPersonalChatAttachmentDownload } from "@/server/conversations/personal-chat-attachment-http";
import { personalAttachmentStorage } from "@/server/conversations/personal-chat-attachment-storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createPersonalChatAttachmentDownload({
  authenticate: authenticateConversationActor,
  controls: () => resolveConversationControls(process.env),
  service: getPersonalChatAttachmentService,
  async open(row) {
    return personalAttachmentStorage.open!(row);
  },
});
