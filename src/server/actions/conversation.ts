"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import {
  getTaskConversation,
  type ConversationItem,
} from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";

/**
 * Server-action wrapper used by the panel's client-driven fetch.
 * Workspace guard: verify the task belongs to the caller's active
 * workspace before returning conversation data. A caller who knows a
 * foreign task id gets an empty array, not a cross-tenant history leak.
 */
export async function getTaskConversationAction(
  taskId: string,
): Promise<ConversationItem[]> {
  const ws = await getActiveWorkspace();
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  if (!row) return [];
  return getTaskConversation(taskId);
}
