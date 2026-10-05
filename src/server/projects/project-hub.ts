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
 * tasks. All are plain selects over the same authorized ids; nothing writes.
 */

import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { meta, tasks, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { isDemoMode } from "@/lib/access-mode";
import { isTaskDone } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { userDisplayName } from "@/lib/user-display-name";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import { demoTasks } from "@/server/demo/tasks-demo";
import { demoAnalyticsSource } from "@/server/projects/project-analytics-demo";
import {
  CONSOLE_DAYS,
  dayOrdinalIn,
  doneByDay,
  initialsOf,
  ordinalToIsoDate,
  type ConsoleFacts,
  type ConsoleHubFacts,
} from "@/lib/projects/project-console";
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

// ── Console facts ───────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
/** Each task read is bounded; past it the oldest rows win and the rest go without. */
const TASK_ROW_LIMIT = 2_000;

function validTimeZone(value: string | null | undefined): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return value;
  } catch {
    return "UTC";
  }
}

async function readConsoleFacts(projectIds: readonly string[]): Promise<ConsoleHubFacts> {
  const viewerId = await getCurrentUser();
  const timeZone = validTimeZone(
    await getUserPreferences(viewerId).then(
      (preferences) => preferences.timeZone,
      () => null,
    ),
  );
  const now = Date.now();
  const dayOf = dayOrdinalIn(timeZone);
  const today = ordinalToIsoDate(dayOf(now));
  if (projectIds.length === 0) return { today, byProject: {} };

  const ids = [...projectIds];
  const topLevelOpen = and(inArray(tasks.workspaceId, ids), isNull(tasks.parentTaskId), isNull(tasks.archivedAt));
  const taskColumns = {
    id: tasks.id,
    title: tasks.title,
    workspaceId: tasks.workspaceId,
    lane: tasks.lane,
    boardColumnKey: tasks.boardColumnKey,
    assignees: tasks.assignees,
    dueAt: tasks.dueAt,
  };

  const [columnRows, ownerRows, memberRows, lateRows, bigDateRows, finishedRows] = await Promise.all([
    db
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, ids.map((id) => projectColumnsMetaKey(id)))),
    db
      .select({ id: workspaces.id, name: users.name, handle: users.handle, email: users.email })
      .from(workspaces)
      .leftJoin(users, eq(users.id, workspaces.ownerUserId))
      .where(inArray(workspaces.id, ids)),
    // Names only for current members, as Analytics does: anyone else still
    // assigned to a task is never named here.
    db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        name: users.name,
        handle: users.handle,
        email: users.email,
      })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(inArray(workspaceMembers.workspaceId, ids)),
    // Same instant comparison as the late count beside it.
    db
      .select(taskColumns)
      .from(tasks)
      .where(and(topLevelOpen, lt(tasks.dueAt, new Date(now))))
      .orderBy(asc(tasks.dueAt), asc(tasks.id))
      .limit(TASK_ROW_LIMIT),
    db
      .select(taskColumns)
      .from(tasks)
      .where(and(topLevelOpen, eq(tasks.isMilestone, true), isNotNull(tasks.dueAt)))
      .orderBy(asc(tasks.dueAt), asc(tasks.id))
      .limit(TASK_ROW_LIMIT),
    // Finished work counts whether or not it was archived afterwards.
    db
      .select({
        workspaceId: tasks.workspaceId,
        lane: tasks.lane,
        boardColumnKey: tasks.boardColumnKey,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.workspaceId, ids),
          isNull(tasks.parentTaskId),
          gte(tasks.completedAt, new Date(now - (CONSOLE_DAYS + 1) * DAY_MS)),
        ),
      )
      .limit(TASK_ROW_LIMIT * 5),
  ]);

  const configs = new Map<string, ColumnConfig | null>();
  const rawConfig = new Map(columnRows.map((row) => [row.key, row.value]));
  for (const id of ids) {
    const raw = rawConfig.get(projectColumnsMetaKey(id));
    configs.set(id, raw ? parseColumnConfig(raw) : null);
  }
  const isOpen = (row: { workspaceId: string | null; lane: string; boardColumnKey: string | null }) =>
    row.workspaceId !== null && !isTaskDone(row, configs.get(row.workspaceId) ?? null);

  const display = (row: { name: string | null; handle: string | null; email: string | null }) =>
    userDisplayName({ name: row.name ?? null, handle: row.handle ?? null, email: row.email ?? null });
  const leads = new Map<string, ConsoleFacts["lead"]>();
  for (const row of ownerRows) {
    const name = display(row);
    leads.set(row.id, name ? { name, initials: initialsOf(name) } : null);
  }
  const memberNames = new Map<string, string>();
  for (const row of memberRows) {
    const name = display(row);
    if (name) memberNames.set(`${row.workspaceId}:${row.userId}`, name);
  }

  const oldestLate = new Map<string, ConsoleFacts["oldestLate"]>();
  const nudges = new Map<string, ConsoleFacts["nudge"]>();
  for (const row of lateRows) {
    if (!isOpen(row) || !row.dueAt) continue;
    const projectId = row.workspaceId!;
    if (!oldestLate.has(projectId)) {
      oldestLate.set(projectId, { id: row.id, title: row.title, dueDate: ordinalToIsoDate(dayOf(row.dueAt.getTime())) });
    }
    if (!nudges.has(projectId)) {
      // A reminder goes to someone else; nobody nudges themselves.
      const assignees = Array.isArray(row.assignees) ? row.assignees : [];
      const other = assignees.find((id) => id !== viewerId && memberNames.has(`${projectId}:${id}`));
      if (other) nudges.set(projectId, { taskId: row.id, title: row.title, who: memberNames.get(`${projectId}:${other}`)! });
    }
  }

  const nextDates = new Map<string, ConsoleFacts["nextDate"]>();
  for (const row of bigDateRows) {
    if (!isOpen(row) || !row.dueAt || nextDates.has(row.workspaceId!)) continue;
    nextDates.set(row.workspaceId!, { title: row.title, date: ordinalToIsoDate(dayOf(row.dueAt.getTime())) });
  }

  const finished = new Map<string, number[]>();
  for (const row of finishedRows) {
    // A finish moment on a task that is no longer done is stale.
    if (!row.workspaceId || !row.completedAt || isOpen(row)) continue;
    const list = finished.get(row.workspaceId) ?? [];
    list.push(row.completedAt.getTime());
    finished.set(row.workspaceId, list);
  }

  const byProject: Record<string, ConsoleFacts> = {};
  for (const id of ids) {
    byProject[id] = {
      lead: leads.get(id) ?? null,
      nextDate: nextDates.get(id) ?? null,
      oldestLate: oldestLate.get(id) ?? null,
      nudge: nudges.get(id) ?? null,
      doneByDay: doneByDay(finished.get(id) ?? [], now, timeZone),
    };
  }
  return { today, byProject };
}

/**
 * Review and demo mode have no database. The one Project reads the same
 * sources its other pages read, on the pinned review clock: the board's tasks
 * for late work and the next big date, and the Analytics source for finished
 * work, so this page and Analytics give the same week.
 */
function demoConsoleFacts(projectId: string): ConsoleHubFacts {
  const today = REVIEW_SUITE_FIXTURE.reviewToday;
  const reviewNow = Date.parse(`${today}T00:00:00.000Z`);
  const source = demoAnalyticsSource();
  const dayOf = dayOrdinalIn(source.timeZone);
  const open = demoTasks()
    .filter((task) => !task.archivedAt && !isTaskDone(task, null) && task.dueAt)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime() || a.id.localeCompare(b.id));
  const late = open.find((task) => task.dueAt!.getTime() < reviewNow);
  const bigDate = open.find((task) => task.isMilestone);
  const name: string = REVIEW_SUITE_FIXTURE.user.name;
  return {
    today,
    byProject: {
      [projectId]: {
        lead: { name, initials: initialsOf(name) },
        nextDate: bigDate ? { title: bigDate.title, date: ordinalToIsoDate(dayOf(bigDate.dueAt!.getTime())) } : null,
        oldestLate: late ? { id: late.id, title: late.title, dueDate: ordinalToIsoDate(dayOf(late.dueAt!.getTime())) } : null,
        // Review never sends anything.
        nudge: null,
        doneByDay: doneByDay(
          source.tasks.filter((task) => task.done && task.completedAt != null).map((task) => task.completedAt!),
          source.now,
          source.timeZone,
        ),
      },
    },
  };
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
