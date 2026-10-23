import { resolveConversationControls } from "@/lib/conversations/flags";
import { createConversationAttachmentDownload } from "@/server/conversations/attachment-http";
import { personalAttachmentStorage } from "@/server/conversations/personal-chat-attachment-storage";
import { authenticateConversationActor, getConversationAttachmentService } from "@/server/conversations/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createConversationAttachmentDownload({ authenticate: authenticateConversationActor, controls: () => resolveConversationControls(process.env), service: getConversationAttachmentService, open: row => personalAttachmentStorage.open!(row) });
