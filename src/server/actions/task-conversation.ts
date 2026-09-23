"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { resolveConversationControls } from "@/lib/conversations/flags";
import { openTaskDiscussionAction } from "@/server/actions/comments";
import { readExistingTaskHistory } from "@/server/conversations/task-history-compatibility";
import { createTaskConversationLoader } from "@/server/conversations/task-history-loader";

const load = createTaskConversationLoader({
  controls: () => resolveConversationControls(process.env),
  authenticateClerk: async () => (await auth()).userId,
  openDiscussion: openTaskDiscussionAction,
  readExistingHistory: (clerkId, taskId) =>
    readExistingTaskHistory(db, { clerkId, taskId }),
});

export async function loadTaskConversationAction(taskId: string) {
  return load(taskId);
}
