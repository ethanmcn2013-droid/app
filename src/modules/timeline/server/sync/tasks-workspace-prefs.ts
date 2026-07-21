import "server-only";
import { createClient, type Client } from "@libsql/client";
import { isAuthError } from "./tasks-milestone-source";

export type TasksWorkspacePrefs = {
  primaryUseCase: string | null;
  activeDomain: string | null;
};

/**
 * Read Tasks workspace segment for an immutable suite subject (read-only Turso token).
 * Returns the first owned workspace's onboarding fields.
 */
export async function getTasksWorkspacePrefsForClerkId(
  clerkId: string,
): Promise<TasksWorkspacePrefs | null> {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken) return null;
  // Capture narrowed (non-undefined) values so the closure below keeps the type.
  const dbUrl: string = url;
  const dbToken: string = authToken;

  let client: Client | null = null;
  function getClient(): Client {
    if (!client) client = createClient({ url: dbUrl, authToken: dbToken });
    return client;
  }

  try {
    const userRow = await getClient().execute({
      sql: "SELECT id FROM users WHERE clerk_id = ? LIMIT 1",
      args: [clerkId],
    });
    const userId = userRow.rows[0]?.id;
    if (userId == null) return null;

    const wsRow = await getClient().execute({
      sql: `
        SELECT primary_use_case, active_domain
        FROM workspaces
        WHERE owner_user_id = ?
        LIMIT 1
      `,
      args: [String(userId)],
    });
    const row = wsRow.rows[0];
    if (!row) return null;

    return {
      primaryUseCase:
        row.primary_use_case != null ? String(row.primary_use_case) : null,
      activeDomain:
        row.active_domain != null ? String(row.active_domain) : null,
    };
  } catch (err) {
    if (isAuthError(err)) client = null;
    console.error("[tasks-workspace-prefs] lookup failed:", String(err));
    return null;
  }
}
