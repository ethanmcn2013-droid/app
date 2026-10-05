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
 *
 * The Console view adds one batch, run alongside those two and also a fixed
 * number of reads whatever the size of the list: owners, members, column
 * settings, late tasks, big-date tasks and the last fortnight's finished
 * tasks (`project-console-facts.ts`). All are plain selects over the same
 * authorized ids; nothing writes.
 */

import { and, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { meta, tasks } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { isDemoMode } from "@/lib/access-mode";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import type { ConsoleHubFacts } from "@/lib/projects/project-console";
import { demoConsoleFacts, readConsoleFactsWith, validTimeZone } from "@/server/projects/project-console-facts";
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

/** The Console's extra reads, for the signed-in reader, in their time zone. */
async function readConsoleFacts(projectIds: readonly string[]): Promise<ConsoleHubFacts> {
  const viewerId = await getCurrentUser();
  return readConsoleFactsWith(db, {
    projectIds,
    viewerId,
    // The time zone only shapes the answers, so it is read alongside the
    // rest rather than ahead of it.
    timeZone: getUserPreferences(viewerId).then(
      (preferences) => validTimeZone(preferences.timeZone),
      () => "UTC",
    ),
    now: Date.now(),
  });
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
  let consoleFacts: ConsoleHubFacts | null = null;

  // Review never touches a database; its one Project is the open one.
  if (isDemoMode()) {
    try {
      consoleFacts = demoConsoleFacts(openProjectId);
    } catch {
      consoleFacts = null;
    }
  } else {
    const allIds = rows.map((row) => row.id as string).slice(0, STATS_LIMIT);
    const ids = allIds.filter((id) => id !== openProjectId);
    // The two reads run together; either may fail without taking the other,
    // or the overview below, with it.
    const [statsRead, factsRead] = await Promise.allSettled([readProjectCardStats(ids), readConsoleFacts(allIds)]);
    if (statsRead.status === "fulfilled") stats = statsRead.value;
    else statsUnavailable = ids.length > 0;
    if (factsRead.status === "fulfilled") consoleFacts = factsRead.value;
  }

  return {
    kind: "ready",
    cards: rows.map((row) => ({ row, stats: stats.get(row.id) ?? null })),
    archived,
    truncated: result.catalog.truncated,
    statsUnavailable,
    console: consoleFacts,
  };
}
