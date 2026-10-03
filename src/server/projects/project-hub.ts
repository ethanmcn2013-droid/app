import "server-only";

/**
 * The Projects hub read (v3 redesign): one card per Project the caller can
 * open, each carrying the status, target date and task progress that
 * Project's own overview shows.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * Membership is not decided here. The Project list is exactly what
 * `loadProjectCatalogAction` returns for the re-authenticated caller (flag
 * gate, Review boundary and membership query included), and every id this
 * module reads stats for comes from that list. It takes no ids from a request
 * and is not a Server Function, so nothing can POST a foreign id at it.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 *
 * Two reads for the whole grid, whatever its size: the meta rows (status,
 * target date, purpose, column settings) and one grouped task count. The
 * Project already open on the page is skipped; its overview read is fresher
 * and the card uses that.
 */

import { and, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { meta, tasks } from "@/server/db/schema";
import { isDemoMode } from "@/lib/access-mode";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import {
  projectColumnsMetaKey,
  projectPurposeMetaKey,
  projectStatusMetaKey,
  projectTargetDateMetaKey,
  summarizeProjectCards,
  type ProjectCardStats,
  type ProjectHub,
} from "@/lib/projects/project-hub";

/** Stats are read for at most this many cards; the rest show their open count. */
const STATS_LIMIT = 200;

async function readProjectCardStats(
  projectIds: readonly string[],
): Promise<Map<string, ProjectCardStats>> {
  if (projectIds.length === 0) return new Map();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const metaKeys = projectIds.flatMap((id) => [
    projectStatusMetaKey(id),
    projectTargetDateMetaKey(id),
    projectPurposeMetaKey(id),
    projectColumnsMetaKey(id),
  ]);
  const [metaRows, groups] = await Promise.all([
    db.select({ key: meta.key, value: meta.value }).from(meta).where(inArray(meta.key, metaKeys)),
    // Same population as the overview's `getTasks`: top-level, unarchived.
    db
      .select({
        workspaceId: tasks.workspaceId,
        lane: tasks.lane,
        boardColumnKey: tasks.boardColumnKey,
        total: sql<number>`count(*)`,
        overdue: sql<number>`sum(case when ${tasks.dueAt} is not null and ${tasks.dueAt} < ${nowSeconds} then 1 else 0 end)`,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.workspaceId, [...projectIds]),
          isNull(tasks.parentTaskId),
          isNull(tasks.archivedAt),
        ),
      )
      .groupBy(tasks.workspaceId, tasks.lane, tasks.boardColumnKey),
  ]);
  return summarizeProjectCards(projectIds, metaRows, groups);
}

/**
 * Null when the index should not render at all (Active Project V3 is off);
 * `unavailable` when the catalog could not be read, which the page states.
 * Never throws: the overview below the index must render regardless.
 */
export async function loadProjectHub(openProjectId: string): Promise<ProjectHub | null> {
  const result = await loadProjectCatalogAction();
  if (!result.ok) return result.reason === "disabled" ? null : { kind: "unavailable" };

  const rows = result.catalog.rows.filter((row) => !row.archived);
  const archived = result.catalog.rows.filter((row) => row.archived);
  let stats = new Map<string, ProjectCardStats>();
  let statsUnavailable = false;

  // Review never touches a database; its one Project is the open one.
  if (!isDemoMode()) {
    const ids = rows
      .map((row) => row.id as string)
      .filter((id) => id !== openProjectId)
      .slice(0, STATS_LIMIT);
    try {
      stats = await readProjectCardStats(ids);
    } catch {
      statsUnavailable = ids.length > 0;
    }
  }

  return {
    kind: "ready",
    cards: rows.map((row) => ({ row, stats: stats.get(row.id) ?? null })),
    archived,
    truncated: result.catalog.truncated,
    statsUnavailable,
  };
}
