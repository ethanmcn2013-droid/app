import "server-only";

import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import { activities, meta, tasks, users, workspaceMembers } from "@/server/db/schema";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { getUserPreferences } from "@/server/db/preferences";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { resolveBoardColumns, effectiveColumnKey, isTaskDone, type BoardColumn } from "@/lib/board-columns";
import type { ColumnColorKey } from "@/lib/board-colors";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import { userDisplayName } from "@/lib/user-display-name";
import type { ProjectId } from "@/lib/projects/project-ref";
import {
  ANALYTICS_RANGES,
  computeProjectAnalytics,
  type AnalyticsColumn,
  type AnalyticsPerson,
  type AnalyticsRangeKey,
  type AnalyticsTask,
  type ColumnTone,
  type ProjectAnalytics,
} from "@/lib/projects/project-analytics";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { demoAnalyticsSource } from "./project-analytics-demo";
import { parseProjectStatus, projectColumnsMetaKey, projectStatusMetaKey, projectTargetDateMetaKey } from "@/lib/projects/project-hub";
import { NO_STANDING, type ProjectStanding } from "@/lib/projects/project-analytics-questions";

/**
 * Analytics: how work moves through one Project, read-only.
 *
 * The caller passes a Project already proved openable by the route boundary
 * (`resolveProjectForRoute`); every row read here is filtered to that same
 * Project id, so nothing from another Project can reach a figure. Only
 * top-level tasks count, matching what the board shows (subtasks live inside
 * their parent). Done is resolved through the Project's own column config, the
 * same predicate the board, exports and digests use.
 *
 * The read is bounded: open work is always read, closed work only as far back
 * as the selected range and the equal period before it (the comparison).
 * Past `MAX_TASK_ROWS` the newest rows win and the page says the history is
 * partial rather than presenting a prefix as the whole.
 */

const DAY_MS = 86_400_000;
const MAX_TASK_ROWS = 5_000;

const TONE_BY_COLOR: Readonly<Record<ColumnColorKey, ColumnTone>> = {
  neutral: "neutral",
  amber: "progress",
  emerald: "done",
  teal: "done",
  rose: "alert",
  pink: "review",
  violet: "review",
  sky: "accent",
  indigo: "accent",
};

function toAnalyticsColumns(columns: readonly BoardColumn[]): AnalyticsColumn[] {
  return columns.map((column) => ({
    key: column.key,
    name: column.name,
    isDone: column.isDone,
    // A done column always reads as finished, whatever colour it wears.
    tone: column.isDone ? "done" : TONE_BY_COLOR[column.color] ?? "neutral",
  }));
}

function validTimeZone(value: string | null | undefined): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return value;
  } catch {
    return "UTC";
  }
}

async function readerTimeZone(): Promise<string> {
  try {
    const userId = await getCurrentUser();
    return validTimeZone((await getUserPreferences(userId)).timeZone);
  } catch {
    return "UTC";
  }
}

function epoch(value: Date | null | undefined): number | null {
  if (!value) return null;
  const ms = value.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function weeksFor(range: AnalyticsRangeKey): number {
  return ANALYTICS_RANGES.find((entry) => entry.key === range)?.weeks ?? 12;
}

export async function loadProjectAnalytics(workspaceId: ProjectId, range: AnalyticsRangeKey): Promise<ProjectAnalytics> {
  if (isDemoMode()) return demoProjectAnalytics(range);

  const now = Date.now();
  // Two periods of history, plus two days of slack for time zones either side.
  const historyStart = new Date(now - (weeksFor(range) * 14 + 2) * DAY_MS);

  const [rows, columnRead, memberRows, timeZone, dueChanges] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        lane: tasks.lane,
        boardColumnKey: tasks.boardColumnKey,
        priority: tasks.priority,
        assignees: tasks.assignees,
        dueAt: tasks.dueAt,
        createdAt: tasks.createdAt,
        completedAt: tasks.completedAt,
        archivedAt: tasks.archivedAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspaceId),
          isNull(tasks.parentTaskId),
          or(isNull(tasks.archivedAt), gte(tasks.completedAt, historyStart), gte(tasks.createdAt, historyStart)),
        ),
      )
      .orderBy(desc(tasks.createdAt))
      .limit(MAX_TASK_ROWS + 1),
    // A failed config read is disclosed on the page, not silently defaulted.
    readWorkspaceColumnConfig(workspaceId).then(
      (config) => ({ config, unreadable: false }),
      (): { config: ColumnConfig | null; unreadable: boolean } => ({ config: null, unreadable: true }),
    ),
    db
      .select({ id: workspaceMembers.userId, name: users.name, handle: users.handle, email: users.email })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
    readerTimeZone(),
    readDueChangesWith(db, [workspaceId], new Date(now - weeksFor(range) * 7 * DAY_MS)),
  ]);

  const truncated = rows.length > MAX_TASK_ROWS;
  const columnConfig = columnRead.config;
  const analyticsTasks: AnalyticsTask[] = rows.slice(0, MAX_TASK_ROWS).map((row) => {
    const done = isTaskDone(row, columnConfig);
    return {
      id: row.id,
      title: row.title,
      columnKey: effectiveColumnKey(row),
      done,
      archived: row.archivedAt != null,
      priority: row.priority,
      assigneeIds: asStringArray(row.assignees),
      createdAt: epoch(row.createdAt),
      // A completion moment on a task that is no longer done is stale.
      completedAt: done ? epoch(row.completedAt) : null,
      dueAt: epoch(row.dueAt),
    };
  });

  // Names only for current members; anyone else still assigned reads as a
  // former member rather than surfacing a profile this Project cannot see.
  const people: AnalyticsPerson[] = memberRows.map((row) => ({
    id: row.id,
    name: userDisplayName({ name: row.name ?? null, handle: row.handle ?? null, email: row.email ?? null }) ?? "Member",
  }));

  return computeProjectAnalytics({
    tasks: analyticsTasks,
    columns: toAnalyticsColumns(resolveBoardColumns(columnConfig)),
    people,
    now,
    timeZone,
    range,
    truncated,
    columnsUnreadable: columnRead.unreadable,
    dueChanges,
  });
}

type Database = typeof db;

/** At most this many recorded changes are read; past it the page still says what it counted. */
const MAX_CHANGE_ROWS = 5_000;

/** The same bound the Projects page reads stats for. */
const PORTFOLIO_PROJECT_LIMIT = 200;

/**
 * Recorded changes to a due date since `since`, one task id per change, for
 * the given Projects only. The activity record is written beside each edit
 * and is best-effort, so this is a count of what was recorded. Null when the
 * read fails: the question that needs it is then left out, never guessed.
 */
export async function readDueChangesWith(database: Database, projectIds: readonly string[], since: Date): Promise<string[] | null> {
  if (projectIds.length === 0) return [];
  try {
    const rows = await database
      .select({ taskId: activities.taskId, payload: activities.payload })
      .from(activities)
      .where(and(inArray(activities.workspaceId, [...projectIds]), eq(activities.kind, "update"), gte(activities.createdAt, since)))
      .orderBy(desc(activities.createdAt))
      .limit(MAX_CHANGE_ROWS);
    return rows
      .filter((row) => row.payload && typeof row.payload === "object" && (row.payload as { field?: unknown }).field === "due")
      .map((row) => row.taskId);
  } catch {
    return null;
  }
}

export type PortfolioProject = Readonly<{ id: string; name: string }>;

/**
 * The same calculation's input, over several Projects at once. Every select
 * is filtered to the ids given, which the caller takes from the membership
 * catalog. Done is resolved through each Project's own columns. A person is
 * named only on tasks of a Project they are a current member of; anyone else
 * assigned reads as a former member. Read-only.
 */
export async function readPortfolioInputWith(
  database: Database,
  projects: readonly PortfolioProject[],
  context: Readonly<{ now: number; range: AnalyticsRangeKey; timeZone: string }>,
): Promise<Parameters<typeof computeProjectAnalytics>[0]> {
  const ids = projects.map((project) => project.id);
  const { now, range, timeZone } = context;
  const columns = toAnalyticsColumns(resolveBoardColumns(null));
  if (ids.length === 0) return { tasks: [], columns, people: [], now, timeZone, range, dueChanges: [] };
  const historyStart = new Date(now - (weeksFor(range) * 14 + 2) * DAY_MS);

  const [rows, configRead, memberRows, dueChanges] = await Promise.all([
    database
      .select({
        id: tasks.id,
        workspaceId: tasks.workspaceId,
        title: tasks.title,
        lane: tasks.lane,
        boardColumnKey: tasks.boardColumnKey,
        priority: tasks.priority,
        assignees: tasks.assignees,
        dueAt: tasks.dueAt,
        createdAt: tasks.createdAt,
        completedAt: tasks.completedAt,
        archivedAt: tasks.archivedAt,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.workspaceId, ids),
          isNull(tasks.parentTaskId),
          or(isNull(tasks.archivedAt), gte(tasks.completedAt, historyStart), gte(tasks.createdAt, historyStart)),
        ),
      )
      .orderBy(desc(tasks.createdAt))
      .limit(MAX_TASK_ROWS + 1),
    database
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, ids.map((id) => projectColumnsMetaKey(id))))
      .then(
        (found) => ({ found, unreadable: false }),
        () => ({ found: [] as Array<{ key: string; value: string }>, unreadable: true }),
      ),
    database
      .select({ workspaceId: workspaceMembers.workspaceId, id: workspaceMembers.userId, name: users.name, handle: users.handle, email: users.email })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(inArray(workspaceMembers.workspaceId, ids)),
    readDueChangesWith(database, ids, new Date(now - weeksFor(range) * 7 * DAY_MS)),
  ]);

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const rawConfig = new Map(configRead.found.map((row) => [row.key, row.value]));
  const configs = new Map<string, ColumnConfig | null>();
  for (const id of ids) {
    const raw = rawConfig.get(projectColumnsMetaKey(id));
    configs.set(id, raw ? parseColumnConfig(raw) : null);
  }
  const membership = new Set(memberRows.map((row) => `${row.workspaceId}:${row.id}`));
  const people = new Map<string, AnalyticsPerson>();
  for (const row of memberRows) {
    if (people.has(row.id)) continue;
    people.set(row.id, {
      id: row.id,
      name: userDisplayName({ name: row.name ?? null, handle: row.handle ?? null, email: row.email ?? null }) ?? "Member",
    });
  }

  const truncated = rows.length > MAX_TASK_ROWS;
  const analyticsTasks: AnalyticsTask[] = [];
  for (const row of rows.slice(0, MAX_TASK_ROWS)) {
    // Never report a Project the caller did not ask about.
    if (!row.workspaceId || !projectNames.has(row.workspaceId)) continue;
    const done = isTaskDone(row, configs.get(row.workspaceId) ?? null);
    analyticsTasks.push({
      id: row.id,
      title: row.title,
      columnKey: effectiveColumnKey(row),
      done,
      archived: row.archivedAt != null,
      priority: row.priority,
      // Someone assigned who is not a member of this task's own Project is
      // kept as a count but given an id no name is filed under.
      assigneeIds: asStringArray(row.assignees).map((id) => (membership.has(`${row.workspaceId}:${id}`) ? id : `former:${id}`)),
      createdAt: epoch(row.createdAt),
      completedAt: done ? epoch(row.completedAt) : null,
      dueAt: epoch(row.dueAt),
      project: projectNames.get(row.workspaceId)!,
    });
  }

  return {
    tasks: analyticsTasks,
    columns,
    people: [...people.values()],
    now,
    timeZone,
    range,
    truncated,
    columnsUnreadable: configRead.unreadable,
    dueChanges,
  };
}

/**
 * Analytics across every active Project the reader can open. The Project
 * list is exactly what `loadProjectCatalogAction` returns for the
 * re-authenticated caller; it takes no ids from a request and is not a Server
 * Function. Null when Projects are not listed or the catalog could not be
 * read, which leaves the page on its one Project.
 */
export async function loadPortfolioAnalytics(
  range: AnalyticsRangeKey,
): Promise<Readonly<{ analytics: ProjectAnalytics; projects: readonly PortfolioProject[] }> | null> {
  const result = await loadProjectCatalogAction();
  if (!result.ok) return null;
  const active = result.catalog.rows.filter((row) => !row.archived && row.selectable);
  const projects = active.map((row) => ({ id: row.id as string, name: row.name })).slice(0, PORTFOLIO_PROJECT_LIMIT);
  // Review has one Project and no database: its Analytics are that Project's.
  if (isDemoMode()) return { analytics: demoProjectAnalytics(range), projects };
  const input = await readPortfolioInputWith(db, projects, { now: Date.now(), range, timeZone: await readerTimeZone() });
  return { analytics: computeProjectAnalytics(input), projects };
}

function demoProjectAnalytics(range: AnalyticsRangeKey): ProjectAnalytics {
  const source = demoAnalyticsSource();
  return computeProjectAnalytics({
    ...source,
    columns: toAnalyticsColumns(resolveBoardColumns(null)),
    people: [{ id: REVIEW_SUITE_FIXTURE.user.id, name: REVIEW_SUITE_FIXTURE.user.name }],
    range,
    // Review keeps no activity record, and says so by leaving the question out.
    dueChanges: null,
  });
}

/**
 * What the owner set on the Project: its status and target date, the two
 * values "Are we on track?" quotes. One read-only select of this Project's
 * own two keys (the keys the overview writes). A failed read is an answer
 * without them, never an error.
 */
export async function loadProjectStanding(workspaceId: ProjectId): Promise<ProjectStanding> {
  // Review shows what its overview shows.
  if (isDemoMode()) return { status: "on-track", targetDate: REVIEW_SUITE_FIXTURE.primaryDate.date };
  try {
    const statusKey = projectStatusMetaKey(workspaceId);
    const targetKey = projectTargetDateMetaKey(workspaceId);
    const rows = await db
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, [statusKey, targetKey]));
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const target = byKey.get(targetKey)?.trim().slice(0, 10) ?? "";
    return {
      status: parseProjectStatus(byKey.get(statusKey)),
      targetDate: /^\d{4}-\d{2}-\d{2}$/.test(target) ? target : null,
    };
  } catch {
    return NO_STANDING;
  }
}

/**
 * The active Projects the reader can open, for the scope menu: the membership
 * catalog's own rows, nothing more. Null when Projects are not listed or the
 * catalog could not be read.
 */
export async function loadAnalyticsProjects(): Promise<PortfolioProject[] | null> {
  const result = await loadProjectCatalogAction();
  if (!result.ok) return null;
  return result.catalog.rows
    .filter((row) => !row.archived && row.selectable)
    .map((row) => ({ id: row.id as string, name: row.name }))
    .slice(0, PORTFOLIO_PROJECT_LIMIT);
}
