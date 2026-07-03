import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * Canonical tenant boundary for Signal Tasks.
 *
 * Tasks has NO row-level security, it runs on libSQL/SQLite over Turso,
 * which has no RLS. The ONLY thing stopping workspace A from reading
 * workspace B is a `WHERE workspace_id = ?` predicate on the query. A
 * single forgotten or mis-bound filter is a silent cross-tenant leak with
 * no database safety net beneath it.
 *
 * `byWorkspace` is the one sanctioned way to build a workspace-scoped
 * filter. Routing every workspace-scoped collection read through it gives:
 *   - a single, greppable, reviewed choke point for the tenant boundary;
 *   - a RUNTIME guard that an undefined/empty active workspace can never
 *     degrade into an unscoped query, `WHERE workspace_id = ''` (or, worse,
 *     a binding that silently matches the wrong rows). We throw instead.
 *
 * Reads are additionally guarded statically by
 * `src/server/tenant-scope.test.mjs`, which fails CI if a workspace-scoped
 * table is read without a tenant scope.
 *
 * Usage:
 *   .where(byWorkspace(tasks.workspaceId, workspaceId))
 *   .where(byWorkspace(tasks.workspaceId, workspaceId, isNull(tasks.parentTaskId)))
 */
export function byWorkspace(
  workspaceColumn: SQLiteColumn,
  workspaceId: string,
  ...extra: Array<SQL | undefined>
): SQL {
  if (!workspaceId) {
    throw new Error(
      "byWorkspace() called with an empty workspace id, refusing to build " +
        "an unscoped tenant query. The caller must resolve a validated " +
        "workspace via getActiveWorkspace() first.",
    );
  }
  // `and(...)` is only `undefined` when given zero clauses; we always pass
  // at least the workspace equality, so the non-null assertion is sound.
  return and(eq(workspaceColumn, workspaceId), ...extra)!;
}
