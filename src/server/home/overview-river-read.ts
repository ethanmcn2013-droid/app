import "server-only";

/**
 * Overview's read (5 October 2026): the dated, undated and recently finished
 * tasks of the Projects in view, for the week view.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * The briefing route has already authorized its scope and passes those
 * Project ids here. This module does not take that on trust: it keeps only
 * the ids that are also in the re-authenticated caller's own Project list
 * (`loadProjectCatalogAction`, the list the chooser reads), or, where that
 * list is switched off, the ids `resolveProjectForRoute` proves one by one.
 * An id that fails either check is dropped without a trace. Every select is
 * filtered to the ids that remain, and people are named only when they are
 * current members of the task's own Project.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 *
 * Three plain selects whatever the number of Projects: settings (status,
 * target date, columns), members, and one bounded task read. Read-only:
 * nothing here inserts, updates or deletes.
 */

import { and, asc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/server/db";
import { meta, tasks, users, workspaceMembers } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { isDemoMode } from "@/lib/access-mode";
import { effectiveColumnKey, resolveBoardColumns } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { userDisplayName } from "@/lib/user-display-name";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import { getProjectOverviewData } from "@/server/actions/project-overview";
import { demoTasks } from "@/server/demo/tasks-demo";
import { validTimeZone } from "@/server/projects/project-console-facts";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import {
  parseProjectStatus,
  projectColumnsMetaKey,
  projectStatusMetaKey,
  projectTargetDateMetaKey,
} from "@/lib/projects/project-hub";
import type { ProjectRole } from "@/lib/projects/project-ref";
import { BRIEFING_APP_PATH } from "@/lib/product-urls";
import type { HomeColumn } from "@/lib/home/home-board";
import { buildRiver, type River, type RiverProjectFact, type RiverTaskFact } from "@/lib/home/overview-river";

type Database = typeof db;

const DAY_MS = 86_400_000;
/** Projects one Overview may span (a planning period); past it the first ones win. */
const PROJECT_LIMIT = 50;
/** The task read is bounded; past it the nearest dates win. */
export const RIVER_TASK_LIMIT = 3_000;
/** Finished work is drawn this far back. */
const DONE_WINDOW_DAYS = 190;

export type RiverProjectRef = Readonly<{ id: string; name: string; role: ProjectRole }>;

/** A Project the reader can switch the Overview to. */
export type OverviewScope = Readonly<{ id: string; name: string; href: string; current: boolean }>;

export type OverviewRead = Readonly<{ river: River; scopes: readonly OverviewScope[] }>;

function overviewHref(projectId: string): string {
  return `${BRIEFING_APP_PATH}?${new URLSearchParams({ contextVersion: "2", workspaceId: projectId }).toString()}`;
}

function columnsOf(config: ColumnConfig | null): HomeColumn[] {
  return resolveBoardColumns(config).map(({ key, name, isDone, isSystem, color }) => ({ key, name, isDone, isSystem, color }));
}

/** The three selects. `projects` are already authorized by the caller. */
export async function readRiverFactsWith(
  database: Database,
  input: Readonly<{ projects: readonly RiverProjectRef[]; now: number }>,
): Promise<{ projects: RiverProjectFact[]; tasks: RiverTaskFact[]; truncated: boolean }> {
  const ids = input.projects.map((project) => project.id);
  if (ids.length === 0) return { projects: [], tasks: [], truncated: false };

  const [metaRows, memberRows, taskRows] = await Promise.all([
    database
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, ids.flatMap((id) => [projectStatusMetaKey(id), projectTargetDateMetaKey(id), projectColumnsMetaKey(id)]))),
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
    // Same population as the board: top-level and unarchived.
    database
      .select({
        id: tasks.id,
        title: tasks.title,
        workspaceId: tasks.workspaceId,
        lane: tasks.lane,
        boardColumnKey: tasks.boardColumnKey,
        assignees: tasks.assignees,
        tags: tasks.tags,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        isMilestone: tasks.isMilestone,
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
      .limit(RIVER_TASK_LIMIT + 1),
  ]);

  const metaByKey = new Map(metaRows.map((row) => [row.key, row.value]));
  const members = new Map<string, Record<string, string>>();
  for (const row of memberRows) {
    const name = userDisplayName({ name: row.name ?? null, handle: row.handle ?? null, email: row.email ?? null });
    if (!name) continue;
    const list = members.get(row.workspaceId) ?? {};
    list[row.userId] = name;
    members.set(row.workspaceId, list);
  }

  const projects: RiverProjectFact[] = input.projects.map((project) => {
    const raw = metaByKey.get(projectColumnsMetaKey(project.id));
    return {
      id: project.id,
      name: project.name,
      role: project.role,
      status: parseProjectStatus(metaByKey.get(projectStatusMetaKey(project.id))),
      targetDate: metaByKey.get(projectTargetDateMetaKey(project.id))?.trim() || null,
      columns: columnsOf(raw ? parseColumnConfig(raw) : null),
      members: members.get(project.id) ?? {},
    };
  });

  const facts: RiverTaskFact[] = [];
  for (const row of taskRows.slice(0, RIVER_TASK_LIMIT)) {
    if (!row.workspaceId) continue;
    facts.push({
      id: row.id,
      projectId: row.workspaceId,
      title: row.title,
      columnKey: effectiveColumnKey(row),
      dueAt: row.dueAt ? row.dueAt.getTime() : null,
      completedAt: row.completedAt ? row.completedAt.getTime() : null,
      assignees: Array.isArray(row.assignees) ? row.assignees : [],
      labels: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "") : [],
      bigDate: row.isMilestone === true,
      recurring: row.recurrence != null,
    });
  }
  return { projects, tasks: facts, truncated: taskRows.length > RIVER_TASK_LIMIT };
}

/**
 * The ids the caller may read, with the names and roles their own list
 * gives, and the other Projects that list lets them switch to.
 */
async function authorize(projectIds: readonly string[]): Promise<{ projects: RiverProjectRef[]; others: RiverProjectRef[] }> {
  const wanted = [...new Set(projectIds)].slice(0, PROJECT_LIMIT);
  const result = await loadProjectCatalogAction();
  if (result.ok) {
    const rows = new Map(result.catalog.rows.map((row) => [row.id as string, row]));
    const projects = wanted.flatMap((id) => {
      const row = rows.get(id);
      return row ? [{ id, name: row.name, role: row.role }] : [];
    });
    const others = result.catalog.rows
      .filter((row) => !row.archived && row.selectable)
      .map((row) => ({ id: row.id as string, name: row.name, role: row.role }));
    return { projects, others };
  }
  if (result.reason !== "disabled") return { projects: [], others: [] };
  // The Project list is switched off: prove each id the route's own way.
  const proved: RiverProjectRef[] = [];
  for (const id of wanted.slice(0, 8)) {
    const decision = await resolveProjectForRoute(id);
    if ((decision.kind === "ready" || decision.kind === "archived") && decision.workspaceId === id) {
      proved.push({ id, name: decision.project.name, role: decision.project.role });
    }
  }
  return { projects: proved, others: [] };
}

/** Review and demo mode have no database: the one Project, on the review clock. */
async function demoRiver(projects: readonly RiverProjectRef[]): Promise<River | null> {
  const project = projects[0];
  if (!project) return null;
  const overview = await getProjectOverviewData();
  const viewerId: string = REVIEW_SUITE_FIXTURE.user.id;
  return buildRiver({
    now: Date.parse(`${REVIEW_SUITE_FIXTURE.reviewToday}T09:00:00.000Z`),
    timeZone: "UTC",
    viewerId,
    projects: [
      {
        ...project,
        status: overview.declaredStatus,
        targetDate: overview.targetDate,
        columns: columnsOf(null),
        members: { [viewerId]: REVIEW_SUITE_FIXTURE.user.name },
      },
    ],
    tasks: demoTasks()
      .filter((task) => !task.archivedAt && !task.parentTaskId)
      .map((task) => ({
        id: task.id,
        projectId: project.id,
        title: task.title,
        columnKey: effectiveColumnKey(task),
        dueAt: task.dueAt ? task.dueAt.getTime() : null,
        completedAt: null,
        assignees: task.assignees,
        labels: task.tags ?? [],
        bigDate: task.isMilestone === true,
        recurring: task.recurrence != null,
      })),
    truncated: false,
    // Review never saves anything.
    canAct: false,
  });
}

/**
 * Null when there is nothing the caller may read, or the read failed; the
 * page then keeps its plain summary and says nothing it cannot back.
 */
export async function loadOverviewRiver(projectIds: readonly string[]): Promise<OverviewRead | null> {
  try {
    const { projects, others } = await authorize(projectIds);
    if (projects.length === 0) return null;
    const current = projects.length === 1 ? projects[0]!.id : null;
    const scopes: OverviewScope[] = others.map((project) => ({ id: project.id, name: project.name, href: overviewHref(project.id), current: project.id === current }));
    if (isDemoMode()) {
      const river = await demoRiver(projects);
      return river ? { river, scopes } : null;
    }

    const viewerId = await getCurrentUser();
    const now = Date.now();
    const [facts, timeZone] = await Promise.all([
      readRiverFactsWith(db, { projects, now }),
      getUserPreferences(viewerId).then(
        (preferences) => validTimeZone(preferences.timeZone),
        () => "UTC",
      ),
    ]);
    return { river: buildRiver({ now, timeZone, viewerId, ...facts, canAct: true }), scopes };
  } catch (error) {
    // Redirects and other framework signals are not failures of this read.
    unstable_rethrow(error);
    return null;
  }
}
