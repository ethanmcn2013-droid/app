import "server-only";

import { inArray } from "drizzle-orm";
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
  return (await readWorkspaceColumnConfigs(db, [workspaceId])).get(workspaceId)!;
}

/** One bounded config read for the legacy source's workspace batch. */
export async function readWorkspaceColumnConfigs(
  db: TasksDb,
  workspaceIds: readonly string[],
): Promise<Map<string, WorkspaceColumnConfig>> {
  const ids = [...new Set(workspaceIds)];
  if (ids.length === 0) return new Map();
  const keys = ids.map(id => `board:${id}:columns`);
  try {
    const rows = await db
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, keys));
    const byKey = new Map(rows.map(row => [row.key, row.value]));
    return new Map(ids.map(id => {
      const raw = byKey.get(`board:${id}:columns`);
      if (raw === undefined) return [id, { config: null, unreadable: false }];
      const config = parseColumnConfig(raw);
      return [id, { config, unreadable: config === null }];
    }));
  } catch (error) {
    console.warn("[signal-analytics] board column config unavailable", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return new Map(ids.map(id => [id, { config: null, unreadable: true }]));
  }
}
