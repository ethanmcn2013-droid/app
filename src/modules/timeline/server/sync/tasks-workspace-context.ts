import "server-only";

import { createClient } from "@libsql/client";
import { isAuthError } from "./tasks-milestone-source";

export type CurrentTasksWorkspaceContext = Readonly<{
  workspaceId: string;
  planningPeriodId: string | null;
}>;

/**
 * Reauthorizes an incoming suite context against current Tasks membership.
 * Query-string ids are routing hints only; this read is the authorization
 * source. Missing configuration/schema or any auth error fails closed.
 */
export async function getCurrentTasksWorkspaceContext(
  clerkId: string,
  workspaceId: string,
): Promise<CurrentTasksWorkspaceContext | null> {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken || !clerkId.trim() || !workspaceId.trim()) return null;

  const client = createClient({ url, authToken });
  try {
    const result = await client.execute({
      sql: `
        SELECT w.id AS workspace_id, w.planning_period_id AS planning_period_id
        FROM users u
        INNER JOIN workspace_members wm ON wm.user_id = u.id
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE u.clerk_id = ? AND w.id = ?
        LIMIT 1
      `,
      args: [clerkId, workspaceId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      workspaceId: String(row.workspace_id),
      planningPeriodId:
        row.planning_period_id == null ? null : String(row.planning_period_id),
    };
  } catch (error) {
    // Do not fall back to a first workspace when current membership cannot be
    // proved. Avoid logging ids; they are private suite routing metadata.
    if (!isAuthError(error)) {
      console.error("[tasks-workspace-context] current membership check failed");
    }
    return null;
  } finally {
    client.close();
  }
}
