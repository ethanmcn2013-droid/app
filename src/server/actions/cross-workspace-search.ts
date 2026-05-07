"use server";

import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { tasks, workspaceMembers, workspaces } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import type { LaneId } from "@/lib/data";

/**
 * Flat row shape for the ⌘K cross-workspace search popover. One entry
 * per matching task, already joined to its workspace's display name +
 * slug so the client can render the chip + navigate without an extra
 * round-trip.
 */
export type CrossWorkspaceSearchItem = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  taskId: string;
  title: string;
  lane: LaneId;
  due: string | null;
};

/** Cap on rows returned to the client per query — mirrors the local
 *  command-palette's slice. */
const RESULT_LIMIT = 30;

/** Minimum query length before we hit the database. Two chars is the
 *  same threshold the typeahead search in most pro tools settle on —
 *  one character matches half the corpus and is uniformly noise. */
const MIN_QUERY_LENGTH = 2;

/**
 * Search task titles across every workspace the current user is a
 * member of. Empty / sub-threshold queries short-circuit to `[]` so
 * the client can wire the action straight to the input value without
 * a debounce-time guard of its own.
 *
 * Ranking is exact-prefix-first then alphabetical — same idiom as
 * the workspace-local palette, just stretched across tenants.
 */
export async function searchAcrossWorkspacesAction(
  query: string,
): Promise<CrossWorkspaceSearchItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const me = await getCurrentUser();

  // Resolve memberships + workspace metadata in one query so the join
  // back onto tasks below already has names + slugs in scope.
  const memberships = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      workspaceSlug: workspaces.slug,
      workspaceName: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, me));

  if (memberships.length === 0) return [];

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const workspaceMeta = new Map(
    memberships.map((m) => [
      m.workspaceId,
      { slug: m.workspaceSlug, name: m.workspaceName },
    ]),
  );

  // SQLite's LIKE is case-insensitive for ASCII by default — no
  // separate ILIKE needed. Wrap the query in `%…%` for substring
  // match. Every lane is included — search is for finding things,
  // not for prioritization, so the done lane stays in scope.
  const escaped = escapeLike(trimmed);

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      workspaceId: tasks.workspaceId,
      lane: tasks.lane,
      due: tasks.due,
    })
    .from(tasks)
    .where(
      and(
        inArray(
          // Cast through `sql` so the nullable workspaceId column
          // still type-checks against the non-null id list — same
          // dance the cycle-22 cross-workspace action does.
          sql`${tasks.workspaceId}`,
          workspaceIds,
        ),
        like(tasks.title, `%${escaped}%`),
      ),
    )
    .limit(RESULT_LIMIT * 4); // overfetch slightly so the in-JS sort + cap below has room.

  const queryLower = trimmed.toLowerCase();

  type Scored = CrossWorkspaceSearchItem & { sortKey: [number, string] };
  const out: Scored[] = [];

  for (const r of rows) {
    if (!r.workspaceId) continue;
    const meta = workspaceMeta.get(r.workspaceId);
    if (!meta) continue;
    const titleLower = r.title.toLowerCase();
    // Tier 0 = exact prefix match (best). Tier 1 = anywhere.
    const tier = titleLower.startsWith(queryLower) ? 0 : 1;
    out.push({
      workspaceId: r.workspaceId,
      workspaceSlug: meta.slug,
      workspaceName: meta.name,
      taskId: r.id,
      title: r.title,
      lane: r.lane,
      due: r.due ?? null,
      sortKey: [tier, titleLower],
    });
  }

  out.sort((a, b) => {
    if (a.sortKey[0] !== b.sortKey[0]) return a.sortKey[0] - b.sortKey[0];
    return a.sortKey[1].localeCompare(b.sortKey[1]);
  });

  return out
    .slice(0, RESULT_LIMIT)
    .map(({ sortKey: _sortKey, ...rest }) => rest);
}

/**
 * Escape SQL LIKE wildcards in user input so a literal `%` or `_` in
 * the query matches itself rather than acting as a wildcard. Drizzle
 * doesn't auto-escape — that's the caller's job.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}
