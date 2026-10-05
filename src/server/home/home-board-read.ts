import "server-only";

/**
 * Home's read (5 October 2026): the facts behind "what needs you today",
 * across every Project the reader can open.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * Membership is not decided here. The Project list is exactly what
 * `loadProjectCatalogAction` returns for the re-authenticated caller, the
 * same list the chooser and the Projects page read (or, with that list
 * switched off, the one Project `resolveProjectForRoute` proves), and every
 * select below is filtered to those ids. It takes no ids from a request and is not a Server
 * Function. People are named only when they are current members of the same
 * Project as the task.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 *
 * Whatever the number of Projects: the Projects page's own two reads (card
 * stats, Console facts), plus four plain selects here (column settings,
 * members, the reader's name, and one bounded task read). Read-only: nothing
 * here inserts, updates or deletes.
 */

import { and, asc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/server/db";
import { meta, tasks, users, workspaceMembers } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { isDemoMode } from "@/lib/access-mode";
import { effectiveColumnKey, isTaskDone, resolveBoardColumns } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { userDisplayName } from "@/lib/user-display-name";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import { getProjectOverviewData } from "@/server/actions/project-overview";
import { demoTasks } from "@/server/demo/tasks-demo";
import { demoConsoleFacts, readConsoleFactsWith, validTimeZone } from "@/server/projects/project-console-facts";
import { readProjectCardStats } from "@/server/projects/project-hub";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import type { ProjectRole } from "@/lib/projects/project-ref";
import type { ConsoleHubFacts } from "@/lib/projects/project-console";
import { projectColumnsMetaKey, type ProjectCardStats } from "@/lib/projects/project-hub";
import {
  buildHomeBoard,
  type HomeBoard,
  type HomeColumn,
  type HomeProjectFact,
  type HomeTaskFact,
} from "@/lib/home/home-board";

type Database = typeof db;

const DAY_MS = 86_400_000;
/** Projects read for Home; past it the catalog's first ones win. */
const PROJECT_LIMIT = 200;
/** The task read is bounded; past it the nearest dates win. */
export const HOME_TASK_LIMIT = 3_000;
/** Finished work is kept this long, so today's ticks can be taken back. */
const DONE_WINDOW_DAYS = 2;

function columnsOf(config: ColumnConfig | null): HomeColumn[] {
  return resolveBoardColumns(config).map(({ key, name, isDone, isSystem, color }) => ({ key, name, isDone, isSystem, color }));
}

export type HomeTaskRead = Readonly<{
  columns: ReadonlyMap<string, readonly HomeColumn[]>;
  members: ReadonlyMap<string, Readonly<Record<string, string>>>;
  viewerName: string | null;
  tasks: readonly HomeTaskFact[];
  truncated: boolean;
}>;

/**
 * The four selects Home adds. `projectIds` are already authorized by the
 * caller; nothing here decides membership.
 */
export async function readHomeTasksWith(
  database: Database,
  input: Readonly<{ projectIds: readonly string[]; viewerId: string; now: number }>,
): Promise<HomeTaskRead> {
  const ids = [...input.projectIds];
  const [viewerRow] = await database
    .select({ name: users.name, handle: users.handle, email: users.email })
    .from(users)
    .where(eq(users.id, input.viewerId));
  const viewerName = viewerRow?.name?.trim() || null;
  if (ids.length === 0) {
    return { columns: new Map(), members: new Map(), viewerName, tasks: [], truncated: false };
  }

  const [columnRows, memberRows, taskRows] = await Promise.all([
    database
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, ids.map((id) => projectColumnsMetaKey(id)))),
    database
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
    // Same population as the board: top-level and unarchived. Unfinished
    // work, plus what was finished in the last two days.
    database
      .select({
        id: tasks.id,
        title: tasks.title,
        workspaceId: tasks.workspaceId,
        lane: tasks.lane,
        boardColumnKey: tasks.boardColumnKey,
        assignees: tasks.assignees,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        updatedAt: tasks.updatedAt,
        recurrence: tasks.recurrence,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.workspaceId, ids),
          isNull(tasks.parentTaskId),
          isNull(tasks.archivedAt),
          or(isNull(tasks.completedAt), gte(tasks.completedAt, new Date(input.now - DONE_WINDOW_DAYS * DAY_MS))),
        ),
      )
      .orderBy(asc(tasks.dueAt), asc(tasks.id))
      .limit(HOME_TASK_LIMIT + 1),
  ]);

  const rawConfig = new Map(columnRows.map((row) => [row.key, row.value]));
  const configs = new Map<string, ColumnConfig | null>();
  const columns = new Map<string, readonly HomeColumn[]>();
  for (const id of ids) {
    const raw = rawConfig.get(projectColumnsMetaKey(id));
    const config = raw ? parseColumnConfig(raw) : null;
    configs.set(id, config);
    columns.set(id, columnsOf(config));
  }

  const members = new Map<string, Record<string, string>>();
  for (const row of memberRows) {
    const name = userDisplayName({ name: row.name ?? null, handle: row.handle ?? null, email: row.email ?? null });
    if (!name) continue;
    const list = members.get(row.workspaceId) ?? {};
    list[row.userId] = name;
    members.set(row.workspaceId, list);
  }

  const facts: HomeTaskFact[] = [];
  for (const row of taskRows.slice(0, HOME_TASK_LIMIT)) {
    if (!row.workspaceId) continue;
    // A finish moment on a task that is open again is stale; the column decides.
    const done = isTaskDone(row, configs.get(row.workspaceId) ?? null);
    facts.push({
      id: row.id,
      projectId: row.workspaceId,
      title: row.title,
      columnKey: effectiveColumnKey(row),
      dueAt: row.dueAt ? row.dueAt.getTime() : null,
      completedAt: done && row.completedAt ? row.completedAt.getTime() : null,
      updatedAt: row.updatedAt.getTime(),
      assignees: Array.isArray(row.assignees) ? row.assignees : [],
      recurring: row.recurrence != null,
    });
  }
  return { columns, members, viewerName, tasks: facts, truncated: taskRows.length > HOME_TASK_LIMIT };
}

/** One Project the reader may open, as their own list (or the route's proof) names it. */
type HomeProjectRef = Readonly<{
  id: string;
  name: string;
  role: ProjectRole;
  selectable: boolean;
  blockedReason: string | null;
  activeRootTaskCount: number;
}>;

/**
 * The Projects Home may read. With the Project list switched on, it is that
 * list. With it switched off there is no list to read, so Home falls back to
 * the one Project the route's own resolver proves for this caller (the saved
 * one, else their first). Null when neither can be read.
 */
async function authorizedProjects(): Promise<HomeProjectRef[] | null> {
  const result = await loadProjectCatalogAction();
  if (result.ok) {
    return result.catalog.rows
      .filter((row) => !row.archived)
      .slice(0, PROJECT_LIMIT)
      .map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        selectable: row.selectable,
        blockedReason: row.blockedReason,
        activeRootTaskCount: row.activeRootTaskCount,
      }));
  }
  if (result.reason !== "disabled") return null;
  const decision = await resolveProjectForRoute();
  if (decision.kind === "empty") return [];
  if (decision.kind !== "ready") return null;
  const { project } = decision;
  return [{ id: project.id, name: project.name, role: project.role, selectable: true, blockedReason: null, activeRootTaskCount: 0 }];
}

function projectFact(
  row: HomeProjectRef,
  stats: ProjectCardStats | null,
  facts: ConsoleHubFacts | null,
  read: Pick<HomeTaskRead, "columns" | "members">,
): HomeProjectFact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    selectable: row.selectable,
    blockedReason: row.blockedReason,
    openCount: row.activeRootTaskCount,
    stats,
    facts: facts?.byProject[row.id] ?? null,
    columns: read.columns.get(row.id) ?? columnsOf(null),
    members: read.members.get(row.id) ?? {},
  };
}

/**
 * Review and demo mode have no database. The one Project reads the same
 * sources its other pages read, on the pinned review clock.
 */
async function demoHomeBoard(rows: readonly HomeProjectRef[]): Promise<HomeBoard> {
  const now = Date.parse(`${REVIEW_SUITE_FIXTURE.reviewToday}T09:00:00.000Z`);
  const row = rows[0];
  const overview = await getProjectOverviewData();
  const viewerId: string = REVIEW_SUITE_FIXTURE.user.id;
  const facts = row ? demoConsoleFacts(row.id) : null;
  const projects = row
    ? [
        projectFact(
          row,
          {
            status: overview.declaredStatus,
            targetDate: overview.targetDate,
            purpose: null,
            total: overview.taskStats.total,
            complete: overview.taskStats.complete,
            overdue: overview.taskStats.overdue,
          },
          facts,
          { columns: new Map(), members: new Map([[row.id, { [viewerId]: REVIEW_SUITE_FIXTURE.user.name }]]) },
        ),
      ]
    : [];
  const taskFacts: HomeTaskFact[] = row
    ? demoTasks()
        .filter((task) => !task.archivedAt && !task.parentTaskId)
        .map((task) => ({
          id: task.id,
          projectId: row.id,
          title: task.title,
          columnKey: effectiveColumnKey(task),
          dueAt: task.dueAt ? task.dueAt.getTime() : null,
          completedAt: null,
          updatedAt: task.updatedAt ? new Date(task.updatedAt).getTime() : now,
          assignees: task.assignees,
          recurring: task.recurrence != null,
        }))
    : [];
  return buildHomeBoard({
    now,
    timeZone: "UTC",
    viewerId,
    viewerName: REVIEW_SUITE_FIXTURE.user.name,
    projects,
    tasks: taskFacts,
    truncated: false,
    // Review never saves or sends anything.
    canAct: false,
  });
}

/**
 * Null when the Project list could not be read at all; the page then says so
 * and still offers the way into Tasks. Never throws for a partial failure:
 * a figure whose read failed is dropped by the model, not guessed.
 */
export async function loadHomeBoard(): Promise<HomeBoard | null> {
  const rows = await authorizedProjects();
  if (!rows) return null;

  if (isDemoMode()) {
    try {
      return await demoHomeBoard(rows);
    } catch (error) {
      unstable_rethrow(error);
      return null;
    }
  }

  const viewerId = await getCurrentUser();
  const now = Date.now();
  const ids = rows.map((row) => row.id);
  const timeZone = getUserPreferences(viewerId).then(
    (preferences) => validTimeZone(preferences.timeZone),
    () => "UTC",
  );
  const [statsRead, factsRead, tasksRead, zone] = await Promise.all([
    readProjectCardStats(ids).then((value) => value, () => null),
    readConsoleFactsWith(db, { projectIds: ids, viewerId, timeZone, now }).then((value) => value, () => null),
    readHomeTasksWith(db, { projectIds: ids, viewerId, now }).then((value) => value, () => null),
    timeZone,
  ]);
  // Without the task read there is no honest "what needs you" to draw.
  if (!tasksRead) return null;

  return buildHomeBoard({
    now,
    timeZone: zone,
    viewerId,
    viewerName: tasksRead.viewerName,
    projects: rows.map((row) => projectFact(row, statsRead?.get(row.id) ?? null, factsRead, tasksRead)),
    tasks: tasksRead.tasks,
    truncated: tasksRead.truncated,
    canAct: true,
  });
}
