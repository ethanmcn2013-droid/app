import { authenticateConversationActor, getMessageAttentionService } from "@/server/conversations/runtime";
import { createMessageAttentionHttp } from "@/server/conversations/attention-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const http = createMessageAttentionHttp({
  authenticate: authenticateConversationActor,
  service: getMessageAttentionService,
});

export const GET = http.GET;
export const POST = http.POST;
