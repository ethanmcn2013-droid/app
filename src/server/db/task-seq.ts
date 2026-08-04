import "server-only";
import { sql, type SQL } from "drizzle-orm";

/**
 * Next human-readable task number for a workspace, as a SQL fragment for
 * use inside an INSERT's values.
 *
 * Allocation is an atomic MAX+1 scalar subquery evaluated by SQLite inside
 * the same INSERT statement, so two concurrent inserts cannot read the same
 * MAX: SQLite/libsql serialises writes at the statement level. The unique
 * (workspace_id, seq) index added in drizzle/0021 is the backstop — if an
 * exotic race ever produced a duplicate, the second insert fails loudly
 * instead of silently double-numbering.
 *
 * The number is display + reference only (the "T-14" chip). `tasks.id`
 * remains the stable primary key in every link, action, and foreign key.
 * Writers that cannot supply a workspace id leave `seq` null and the UI
 * falls back to the hex id, so allocation is never load-bearing.
 */
export function nextTaskSeq(workspaceId: string): SQL<number> {
  return sql<number>`(SELECT COALESCE(MAX(seq), 0) + 1 FROM tasks WHERE workspace_id = ${workspaceId})`;
}
