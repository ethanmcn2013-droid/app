import "server-only";

import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import { tasks, users, workspaceMembers } from "@/server/db/schema";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { getUserPreferences } from "@/server/db/preferences";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { resolveBoardColumns, effectiveColumnKey, isTaskDone, type BoardColumn } from "@/lib/board-columns";
import type { ColumnColorKey } from "@/lib/board-colors";
import type { ColumnConfig } from "@/lib/board-config";
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

  const [rows, columnRead, memberRows, timeZone] = await Promise.all([
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
  });
}

function demoProjectAnalytics(range: AnalyticsRangeKey): ProjectAnalytics {
  const source = demoAnalyticsSource();
  return computeProjectAnalytics({
    ...source,
    columns: toAnalyticsColumns(resolveBoardColumns(null)),
    people: [{ id: REVIEW_SUITE_FIXTURE.user.id, name: REVIEW_SUITE_FIXTURE.user.name }],
    range,
  });
}
