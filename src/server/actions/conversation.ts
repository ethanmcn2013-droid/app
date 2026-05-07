"use server";

import {
  getTaskConversation,
  type ConversationItem,
} from "@/server/db/queries";

/** Server-action wrapper used by the panel's client-driven fetch. */
export async function getTaskConversationAction(
  taskId: string,
): Promise<ConversationItem[]> {
  return getTaskConversation(taskId);
}
