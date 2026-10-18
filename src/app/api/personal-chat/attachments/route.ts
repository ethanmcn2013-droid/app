import { createPersonalChatAttachmentHttp } from "@/server/conversations/personal-chat-attachment-http";
import { authenticateConversationActor, getPersonalChatAttachmentService } from "@/server/conversations/runtime";
import { resolveConversationControls } from "@/lib/conversations/flags";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const handle = createPersonalChatAttachmentHttp({ authenticate: authenticateConversationActor, controls: () => resolveConversationControls(process.env), service: getPersonalChatAttachmentService });
export const POST = handle;
export const DELETE = handle;
