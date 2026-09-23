import { createConversationHttp } from "../../../server/conversations/http";
import { authenticateConversationActor, getConversationService, getConversationTaskOutcomeService } from "../../../server/conversations/runtime";
import { resolveConversationControls } from "../../../lib/conversations/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createConversationHttp({
  authenticate: authenticateConversationActor,
  controls: () => resolveConversationControls(process.env),
  service: getConversationService,
  taskOutcomes: getConversationTaskOutcomeService,
});
export const GET = handle;
export const POST = handle;
