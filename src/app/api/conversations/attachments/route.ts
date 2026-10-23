import { resolveConversationControls } from "@/lib/conversations/flags";
import { createConversationAttachmentHttp } from "@/server/conversations/attachment-http";
import { authenticateConversationActor, getConversationAttachmentService } from "@/server/conversations/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = createConversationAttachmentHttp({ authenticate: authenticateConversationActor, controls: () => resolveConversationControls(process.env), service: getConversationAttachmentService });
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
