import "server-only";

import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import type { ConversationSqlExecutor } from "./database";

/** Identities selected by resource authorization on this same open transaction. */
export type ConversationWriteFenceIdentity = Readonly<{
  actor_id: unknown;
  actor_clerk_id: unknown;
  owner_id: unknown;
  owner_clerk_id: unknown;
}>;

/** Repeated Project IDs share the same proof within the caller's write transaction. */
export async function conversationProjectWriteFencesClear(
  executor: ConversationSqlExecutor,
  actorUserId: string,
  projectIds: readonly string[],
  authorizedIdentities?: ReadonlyMap<string, ConversationWriteFenceIdentity>,
): Promise<boolean> {
  for (const projectId of new Set(projectIds)) {
    if (!await conversationWriteFencesClear(executor, actorUserId, projectId, authorizedIdentities?.get(projectId))) return false;
  }
  return true;
}

/**
 * Read January's Project and account deletion tombstones through the exact
 * transaction that will perform the conversation write. Call after resource
 * authorization and before the first mutation; absence fails closed.
 */
export async function conversationWriteFencesClear(
  executor: ConversationSqlExecutor,
  actorUserId: string,
  projectId: string,
  authorizedIdentity?: ConversationWriteFenceIdentity,
): Promise<boolean> {
  const identity = authorizedIdentity ?? (await executor.execute({
    sql: `SELECT actor.id AS actor_id, actor.clerk_id AS actor_clerk_id,
        owner.id AS owner_id, owner.clerk_id AS owner_clerk_id
      FROM workspaces project
      JOIN users owner ON owner.id = project.owner_user_id
      JOIN users actor ON actor.id = ?
      WHERE project.id = ?`,
    args: [actorUserId, projectId],
  })).rows[0];
  if (!identity || identity.actor_id !== actorUserId || !identity.owner_id) return false;
  const actorKey = accountDeletionTombstoneKey(String(identity.actor_clerk_id ?? identity.actor_id));
  const ownerKey = accountDeletionTombstoneKey(String(identity.owner_clerk_id ?? identity.owner_id));
  const blocked = await executor.execute({
    sql: `SELECT 1 AS blocked FROM project_drive_operations
        WHERE workspace_id = ? AND operation_kind = 'project_delete'
          AND status IN ('pending', 'running', 'retry_wait', 'manual_attention')
      UNION ALL
      SELECT 1 AS blocked FROM meta WHERE key IN (?, ?)
      LIMIT 1`,
    args: [projectId, actorKey, ownerKey],
  });
  return blocked.rows.length === 0;
}
