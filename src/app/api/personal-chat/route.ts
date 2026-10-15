import { createPersonalChatHttp } from "@/server/conversations/personal-chat-http";
import { authenticateConversationActor, getPersonalChatService } from "@/server/conversations/runtime";
import { resolveConversationControls } from "@/lib/conversations/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createPersonalChatHttp({
  authenticate: authenticateConversationActor,
  controls: () => resolveConversationControls(process.env),
  service: getPersonalChatService,
});

export const GET = handle;
export const POST = handle;
