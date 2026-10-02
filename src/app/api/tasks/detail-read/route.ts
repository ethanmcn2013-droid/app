import { getSubtasksAction } from "@/server/actions/tasks";
import { listTaskResourcesAction } from "@/server/actions/resources";
import { loadTaskConversationAction } from "@/server/actions/task-conversation";
import { createTaskDetailReadHttp } from "@/server/tasks/detail-read-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createTaskDetailReadHttp({
  subtasks: getSubtasksAction,
  resources: listTaskResourcesAction,
  conversation: loadTaskConversationAction,
});
