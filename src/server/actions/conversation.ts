"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import {
  getTaskConversation,
  type ConversationItem,
} from "@/server/db/queries";
import { getCurrentUser } from "@/server/auth";
import { scopeForTask } from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Server-action wrapper used by the panel's client-driven fetch.
 * Workspace guard: verify the task belongs to the caller's active
 * workspace before returning conversation data. A caller who knows a
 * foreign task id gets an empty array, not a cross-tenant history leak.
 */
export async function getTaskConversationAction(
  taskId: string,
): Promise<ConversationItem[]> {
  if (isDemoMode()) return [];
  // The task's own Project is proved openable, rather than compared against
  // the cookie — so a conversation the caller may genuinely read stops coming
  // back as an empty array whenever the two disagree.
  const me = await getCurrentUser();
  const scope = await scopeForTask(taskId, me, "open");
  if (!scope.ok) return [];
  const ws = scope.ws;
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));
  if (!row) return [];
  return getTaskConversation(taskId);
}
