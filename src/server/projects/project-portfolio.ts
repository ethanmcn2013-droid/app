import "server-only";

/**
 * The All projects read (v3 redesign, 24 Sep 2026): one row per Project the
 * caller can open, each with its status, target date, task progress, when
 * the work started and its dated milestones.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * Membership is not decided here. The Project list is exactly what
 * `loadProjectCatalogAction` returns for the re-authenticated caller (flag
 * gate, Review boundary and membership query included), and every id this
 * module reads facts for comes from that list. It takes no ids from a request
 * and is not a Server Function, so nothing can POST a foreign id at it; the
 * assembly step (`assemblePortfolioRows`) additionally drops any fact keyed by
 * an id the catalog did not name.
 *
 * ── Cost and failure ───────────────────────────────────────────────────────
 *
 * Four batched reads for the whole page, whatever its size, bounded to 200
 * Projects: meta (status, target date, purpose, column settings), grouped
 * task counts, first-task dates, and dated milestones. Each is guarded on its
 * own so one failure degrades one feature: no stats means neutral tracks, no
 * milestones means bars without diamonds. It never throws.
 *
 * The meta and count queries are the same two the Projects hub runs in
 * `readProjectCardStats` (`src/server/projects/project-hub.ts`), duplicated
 * here because that function is private to a file outside this stream.
 * [coordinator] Export it and delete this copy.
 *
 * Review never touches a database: the review Project and five labelled
 * samples come from `project-portfolio-review.ts`.
 */

import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { meta, tasks, workspaces } from "@/server/db/schema";
import { isDemoMode } from "@/lib/access-mode";
import { isDoneColumnKey } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import {
  projectColumnsMetaKey,
  projectPurposeMetaKey,
  projectStatusMetaKey,
  projectTargetDateMetaKey,
  summarizeProjectCards,
  type ProjectCardStats,
} from "@/lib/projects/project-hub";
import {
  assemblePortfolioRows,
  PORTFOLIO_ROW_LIMIT,
  type CatalogRowInput,
  type PortfolioMilestone,
  type ProjectPortfolio,
  type StartFacts,
} from "@/lib/projects/project-portfolio";
import { reviewPortfolioRows } from "@/server/projects/project-portfolio-review";

/** At most this many dated milestones are read for the whole page. */
const MILESTONE_READ_LIMIT = 4000;

function todayIso(): string {
  return isDemoMode() ? PINNED_REVIEW_CALENDAR_FRAME.today : new Date().toISOString().slice(0, 10);
}

function isoDay(value: Date | number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date =
    value instanceof Date ? value : typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

type MetaRow = { key: string; value: string | null };

async function readMeta(ids: readonly string[]): Promise<MetaRow[]> {
  const keys = ids.flatMap((id) => [
    projectStatusMetaKey(id),
    projectTargetDateMetaKey(id),
    projectPurposeMetaKey(id),
    projectColumnsMetaKey(id),
  ]);
  return db.select({ key: meta.key, value: meta.value }).from(meta).where(inArray(meta.key, keys));
}

/** Same population and predicate as the hub's card stats: top-level, unarchived. */
async function readStats(ids: readonly string[], metaRows: readonly MetaRow[]): Promise<Map<string, ProjectCardStats>> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const groups = await db
    .select({
      workspaceId: tasks.workspaceId,
      lane: tasks.lane,
      boardColumnKey: tasks.boardColumnKey,
      total: sql<number>`count(*)`,
      overdue: sql<number>`sum(case when ${tasks.dueAt} is not null and ${tasks.dueAt} < ${nowSeconds} then 1 else 0 end)`,
    })
    .from(tasks)
    .where(and(inArray(tasks.workspaceId, [...ids]), isNull(tasks.parentTaskId), isNull(tasks.archivedAt)))
    .groupBy(tasks.workspaceId, tasks.lane, tasks.boardColumnKey);
  return summarizeProjectCards(ids, metaRows, groups);
}

async function readStarts(ids: readonly string[]): Promise<Map<string, StartFacts>> {
  const [taskRows, projectRows] = await Promise.all([
    db
      .select({
        workspaceId: tasks.workspaceId,
        firstCreated: sql<number | null>`min(${tasks.createdAt})`,
        firstDue: sql<number | null>`min(${tasks.dueAt})`,
      })
      .from(tasks)
      .where(and(inArray(tasks.workspaceId, [...ids]), isNull(tasks.parentTaskId), isNull(tasks.archivedAt)))
      .groupBy(tasks.workspaceId),
    db
      .select({ id: workspaces.id, createdAt: workspaces.createdAt })
      .from(workspaces)
      .where(inArray(workspaces.id, [...ids])),
  ]);
  const out = new Map<string, StartFacts>();
  for (const id of ids) out.set(id, { firstTaskCreated: null, firstTaskDue: null, projectCreated: null });
  for (const row of projectRows) {
    const entry = out.get(row.id);
    if (entry) out.set(row.id, { ...entry, projectCreated: isoDay(row.createdAt) });
  }
  for (const row of taskRows) {
    if (!row.workspaceId) continue;
    const entry = out.get(row.workspaceId);
    if (!entry) continue; // Never report a Project the caller did not ask about.
    out.set(row.workspaceId, {
      ...entry,
      firstTaskCreated: isoDay(row.firstCreated === null ? null : Number(row.firstCreated)),
      firstTaskDue: isoDay(row.firstDue === null ? null : Number(row.firstDue)),
    });
  }
  return out;
}

async function readMilestones(
  ids: readonly string[],
  metaRows: readonly MetaRow[],
): Promise<Map<string, PortfolioMilestone[]>> {
  const rows = await db
    .select({
      id: tasks.id,
      workspaceId: tasks.workspaceId,
      title: tasks.title,
      dueAt: tasks.dueAt,
      lane: tasks.lane,
      boardColumnKey: tasks.boardColumnKey,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.workspaceId, [...ids]),
        eq(tasks.isMilestone, true),
        isNotNull(tasks.dueAt),
        isNull(tasks.parentTaskId),
        isNull(tasks.archivedAt),
      ),
    )
    .orderBy(asc(tasks.dueAt))
    .limit(MILESTONE_READ_LIMIT);

  const metaByKey = new Map(metaRows.map((row) => [row.key, row.value]));
  const configs = new Map<string, ColumnConfig | null>();
  const configFor = (id: string) => {
    if (!configs.has(id)) {
      const raw = metaByKey.get(projectColumnsMetaKey(id));
      configs.set(id, raw ? parseColumnConfig(raw) : null);
    }
    return configs.get(id) ?? null;
  };

  const out = new Map<string, PortfolioMilestone[]>();
  const allowed = new Set(ids);
  for (const row of rows) {
    if (!row.workspaceId || !allowed.has(row.workspaceId)) continue;
    const date = isoDay(row.dueAt);
    if (!date) continue;
    const list = out.get(row.workspaceId) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      date,
      done: isDoneColumnKey(row.boardColumnKey || row.lane, configFor(row.workspaceId)),
    });
    out.set(row.workspaceId, list);
  }
  return out;
}

/**
 * Null when All projects should not render at all (Active Project V3 is off),
 * so the Timeline index falls back to today's redirect. `unavailable` when
 * the catalog could not be read, which the page states. Never throws.
 */
export async function loadProjectPortfolio(): Promise<ProjectPortfolio | null> {
  const today = todayIso();
  const result = await loadProjectCatalogAction();
  if (!result.ok) return result.reason === "disabled" ? null : { kind: "unavailable", todayIso: today };

  const toInput = (row: (typeof result.catalog.rows)[number]): CatalogRowInput => ({
    id: row.id,
    name: row.name,
    monogram: row.monogram,
    role: row.role,
    selectable: row.selectable,
    blockedReason: row.blockedReason,
    archived: row.archived,
  });
  const active = result.catalog.rows.filter((row) => !row.archived).map(toInput);
  const archivedInputs = result.catalog.rows.filter((row) => row.archived).map(toInput);
  const archived = assemblePortfolioRows(archivedInputs, {
    stats: new Map(),
    starts: new Map(),
    milestones: new Map(),
    statsAvailable: false,
  });

  // Review never touches a database.
  if (isDemoMode()) {
    return {
      kind: "ready",
      rows: reviewPortfolioRows(),
      archived,
      truncated: false,
      statsUnavailable: false,
      milestonesUnavailable: false,
      sample: true,
      todayIso: today,
    };
  }

  // Ids come from the catalog and nowhere else.
  const ids = active.map((row) => row.id).slice(0, PORTFOLIO_ROW_LIMIT);
  const shown = active.slice(0, PORTFOLIO_ROW_LIMIT);

  let metaRows: MetaRow[] = [];
  let stats = new Map<string, ProjectCardStats>();
  let starts = new Map<string, StartFacts>();
  let milestones = new Map<string, PortfolioMilestone[]>();
  let statsUnavailable = false;
  let milestonesUnavailable = false;

  if (ids.length > 0) {
    try {
      metaRows = await readMeta(ids);
      stats = await readStats(ids, metaRows);
    } catch {
      statsUnavailable = true;
    }
    const [startResult, milestoneResult] = await Promise.allSettled([
      readStarts(ids),
      readMilestones(ids, metaRows),
    ]);
    if (startResult.status === "fulfilled") starts = startResult.value;
    if (milestoneResult.status === "fulfilled") milestones = milestoneResult.value;
    else milestonesUnavailable = true;
  }

  return {
    kind: "ready",
    rows: assemblePortfolioRows(shown, { stats, starts, milestones, statsAvailable: !statsUnavailable }),
    archived,
    truncated: result.catalog.truncated || active.length > PORTFOLIO_ROW_LIMIT,
    statsUnavailable,
    milestonesUnavailable,
    sample: false,
    todayIso: today,
  };
}
