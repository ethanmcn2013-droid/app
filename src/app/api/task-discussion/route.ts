import { resolveConversationControls } from "@/lib/conversations/flags";
import { createTaskDiscussionHttp } from "@/server/conversations/task-discussion-http";
import {
  authenticateConversationActor,
  getTaskDiscussionService,
} from "@/server/conversations/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createTaskDiscussionHttp({
  authenticate: authenticateConversationActor,
  controls: () => resolveConversationControls(process.env),
  service: getTaskDiscussionService,
});

export const GET = handle;
export const POST = handle;
