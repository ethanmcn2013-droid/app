import "server-only";

import { eq } from "drizzle-orm";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import type { TasksDb } from "../../tasks-db/signal-tasks-db-client";
import { meta } from "../../tasks-db/signal-tasks-db-schema";

export interface WorkspaceColumnConfig {
  /** Null means the workspace has stored no config: the default board applies. */
  config: ColumnConfig | null;
  /** True when the config could not be read at all, which is not the same thing. */
  unreadable: boolean;
}

/**
 * The workspace's board ColumnConfig, resolved the way every other surface
 * resolves it.
 *
 * `isTaskDone(row, null)` is not a neutral default — it hard-codes
 * `doneKeys = ["done"]`. A workspace that renamed Done, or declared another
 * column done-meaning, was therefore read one way by the board, digest,
 * export and print, and another way by analytics, with completion, overdue,
 * pace, stalled and follow-up completion all inheriting the divergence, and
 * nothing disclosing it.
 *
 * `unreadable` exists because "no stored config" and "could not read the
 * config" are different facts that would otherwise collapse into the same
 * null. The first is ordinary; the second must reach coverage.
 */
export async function readWorkspaceColumnConfig(
  db: TasksDb,
  workspaceId: string,
): Promise<WorkspaceColumnConfig> {
  try {
    const [row] = await db
      .select({ value: meta.value })
      .from(meta)
      .where(eq(meta.key, `board:${workspaceId}:columns`))
      .limit(1);
    return { config: row ? parseColumnConfig(row.value) : null, unreadable: false };
  } catch (error) {
    console.warn("[signal-analytics] board column config unavailable", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { config: null, unreadable: true };
  }
}
