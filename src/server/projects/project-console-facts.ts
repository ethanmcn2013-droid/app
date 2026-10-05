import "server-only";

/**
 * What the Projects console shows beyond the card stats: each Project's lead,
 * next big date, oldest late task (and who could be reminded about it) and
 * the last fortnight's finished work, day by day.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * Membership is not decided here. `loadProjectHub` passes only ids from the
 * catalog the re-authenticated caller may open; every select below is
 * filtered to those ids. People are named only when they are the Project's
 * owner or a current member of that same Project.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 *
 * Six selects, run together, whatever the number of Projects. Each task read
 * is bounded. Read-only: nothing here inserts, updates or deletes.
 */

import { and, asc, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import type { db } from "@/server/db";
import { meta, tasks, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { isTaskDone } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { userDisplayName } from "@/lib/user-display-name";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { projectColumnsMetaKey } from "@/lib/projects/project-hub";
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

type Database = typeof db;

const DAY_MS = 86_400_000;
/** Each task read is bounded; past it the oldest rows win and the rest go without. */
const TASK_ROW_LIMIT = 2_000;

export function validTimeZone(value: string | null | undefined): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return value;
  } catch {
    return "UTC";
  }
}

export type ConsoleFactsInput = Readonly<{
  /** Already authorized by the caller; nothing here decides membership. */
  projectIds: readonly string[];
  viewerId: string;
  timeZone: string | Promise<string>;
  /** Epoch milliseconds. */
  now: number;
}>;

export async function readConsoleFactsWith(database: Database, input: ConsoleFactsInput): Promise<ConsoleHubFacts> {
  const { projectIds, viewerId, now } = input;
  if (projectIds.length === 0) {
    return { today: ordinalToIsoDate(dayOrdinalIn(await input.timeZone)(now)), byProject: {} };
  }

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

  const [timeZone, columnRows, ownerRows, memberRows, lateRows, bigDateRows, finishedRows] = await Promise.all([
    input.timeZone,
    database
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(inArray(meta.key, ids.map((id) => projectColumnsMetaKey(id)))),
    database
      .select({ id: workspaces.id, name: users.name, handle: users.handle, email: users.email })
      .from(workspaces)
      .leftJoin(users, eq(users.id, workspaces.ownerUserId))
      .where(inArray(workspaces.id, ids)),
    // Names only for current members, as Analytics does: anyone else still
    // assigned to a task is never named here.
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
    // Same instant comparison as the late count beside it.
    database
      .select(taskColumns)
      .from(tasks)
      .where(and(topLevelOpen, lt(tasks.dueAt, new Date(now))))
      .orderBy(asc(tasks.dueAt), asc(tasks.id))
      .limit(TASK_ROW_LIMIT),
    database
      .select(taskColumns)
      .from(tasks)
      .where(and(topLevelOpen, eq(tasks.isMilestone, true), isNotNull(tasks.dueAt)))
      .orderBy(asc(tasks.dueAt), asc(tasks.id))
      .limit(TASK_ROW_LIMIT),
    // Finished work counts whether or not it was archived afterwards.
    database
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

  const dayOf = dayOrdinalIn(timeZone);
  const today = ordinalToIsoDate(dayOf(now));

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
export function demoConsoleFacts(projectId: string): ConsoleHubFacts {
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
