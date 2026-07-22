import "server-only";

import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import type {
  AnalyticsDate,
  AnalyticsEvent,
  AnalyticsEventKind,
  AnalyticsQuery,
  PersonRef,
  ProjectRecord,
  ProviderResult,
  TaskRecord,
  TasksProvider,
  TasksProviderResult,
} from "../../../lib/analytics/contracts";
import { TASKS_URL } from "@/lib/product-urls";
import { getTasksDb } from "../../tasks-db/signal-tasks-db-client";
import {
  activities,
  tasks,
  users,
} from "../../tasks-db/signal-tasks-db-schema";
import { providerCoverage } from "./coverage";
import { queriedHistoryWindow } from "./history-window";

const MAX_TASKS = 2_000;
const MAX_ACTIVITIES = 5_000;
const MAX_NAVIGATION_PROJECTS = 500;
const MAX_NAVIGATION_OWNERS = 500;
const MAX_NAVIGATION_STATUSES = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class TasksAnalyticsProvider implements TasksProvider {
  async read(query: AnalyticsQuery, signal?: AbortSignal): Promise<TasksProviderResult> {
    signal?.throwIfAborted();
    const db = getTasksDb();
    const calculatedAt = new Date().toISOString();
    if (!db) {
      return {
        tasks: [],
        events: [],
        navigation: { projects: [], owners: [], statuses: [] },
        coverage: providerCoverage({
          provider: "tasks",
          status: "unavailable",
          calculatedAt,
          issues: ["tasks_provider_not_configured"],
        }),
      };
    }

    const periodStart = new Date(query.period.start);
    const periodEnd = new Date(query.period.end);
    const duration = periodEnd.getTime() - periodStart.getTime();
    const historyStart = new Date(periodStart.getTime() - Math.max(duration * 3, 1));

    const taskRows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.workspaceId, query.scope.workspaceId))
      .limit(MAX_TASKS + 1);
    signal?.throwIfAborted();

    const isTruncated = taskRows.length > MAX_TASKS;
    const boundedRows = taskRows.slice(0, MAX_TASKS);
    const scopedRows = boundedRows.filter((row) => {
      const tags = stringArray(row.tags).map(projectIdFromTag);
      const assignees = stringArray(row.assignees);
      if (query.scope.type === "project" && !tags.includes(query.scope.id)) return false;
      if (query.scope.type === "user" && !assignees.includes(query.scope.id)) return false;
      return true;
    });
    const taskIds = scopedRows.map((row) => row.id);

    const activityRows = taskIds.length
      ? await db
          .select()
          .from(activities)
          .where(
            and(
              eq(activities.workspaceId, query.scope.workspaceId),
              inArray(activities.taskId, taskIds),
              gte(activities.createdAt, historyStart),
              lt(activities.createdAt, periodEnd),
            ),
          )
          .orderBy(asc(activities.createdAt))
          .limit(MAX_ACTIVITIES + 1)
      : [];
    signal?.throwIfAborted();

    const activityTruncated = activityRows.length > MAX_ACTIVITIES;
    const boundedActivities = activityRows.slice(0, MAX_ACTIVITIES);
    const workspaceOwnerIds = Array.from(new Set(boundedRows.flatMap((row) => stringArray(row.assignees))));
    const ownerIds = workspaceOwnerIds.slice(0, MAX_NAVIGATION_OWNERS);
    const ownerRows = ownerIds.length
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, ownerIds))
      : [];
    const people = new Map<string, PersonRef>(
      ownerRows.map((row) => [row.id, { id: row.id, displayName: row.name ?? null }]),
    );

    const rawByTask = new Map<string, typeof boundedActivities>();
    for (const row of boundedActivities) {
      const bucket = rawByTask.get(row.taskId);
      if (bucket) bucket.push(row);
      else rawByTask.set(row.taskId, [row]);
    }
    const terminalTaskIds = new Set(
      boundedRows.filter((row) => row.lane === "done").map((row) => row.id),
    );
    const projectIdsByTask = new Map(
      scopedRows.map((row) => [row.id, stringArray(row.tags).map(projectIdFromTag)]),
    );
    const events = boundedActivities.flatMap((row) =>
      mapActivity(row, projectIdsByTask.get(row.taskId) ?? []),
    );
    const taskRecords = scopedRows.map((row): TaskRecord => {
      const assigneeIds = stringArray(row.assignees);
      const dependencies = stringArray(row.blockedBy);
      const explicitBlocking = row.lane === "blocked" || row.lane === "waiting";
      const taskActivities = rawByTask.get(row.id) ?? [];
      const meaningful = taskActivities.filter((entry) => isMeaningfulActivity(entry.kind, entry.payload));
      const completion = terminalTaskIds.has(row.id)
        ? [...taskActivities]
            .reverse()
            .find((entry) => isTerminalActivity(entry.kind, entry.payload))?.createdAt ?? null
        : null;
      return {
        id: row.id,
        workspaceId: query.scope.workspaceId,
        projectIds: stringArray(row.tags).map(projectIdFromTag),
        title: row.title,
        status: row.lane,
        terminal: row.lane === "done",
        ownerIds: assigneeIds,
        owners: assigneeIds.map((id) => people.get(id) ?? { id, displayName: null }),
        due: analyticsDate(row.dueAt, row.due),
        createdAt: iso(row.createdAt),
        completedAt: completion ? iso(completion) : null,
        lastMeaningfulActivityAt: meaningful.length
          ? iso(meaningful[meaningful.length - 1]!.createdAt)
          : iso(row.createdAt),
        blocking: {
          explicit: explicitBlocking,
          dependencyIds: dependencies,
          unresolvedDependencyIds: dependencies.filter((id) => !terminalTaskIds.has(id)),
        },
        linkedDecisionIds: [],
        linkedMilestoneIds: [],
        workType: row.isMilestone ? "milestone" : null,
        deepLink: `${TASKS_URL}/app/board?task=${encodeURIComponent(row.id)}`,
        updatedAt: iso(row.updatedAt),
      };
    });

    const historyDates = boundedActivities.map((row) => iso(row.createdAt));
    const historyWindow = queriedHistoryWindow(
      historyStart,
      periodEnd,
      activityTruncated,
      historyDates.at(-1) ?? null,
    );
    const issues: string[] = [];
    if (isTruncated) issues.push("tasks_record_limit_reached");
    if (activityTruncated) issues.push("tasks_activity_limit_reached");
    if (workspaceOwnerIds.length > MAX_NAVIGATION_OWNERS) {
      issues.push("tasks_navigation_owner_limit_reached");
    }
    const workspaceProjectIds = Array.from(new Set(
      boundedRows.flatMap((row) => stringArray(row.tags).map(projectIdFromTag)),
    ));
    if (workspaceProjectIds.length > MAX_NAVIGATION_PROJECTS) {
      issues.push("tasks_navigation_project_limit_reached");
    }
    const workspaceStatuses = Array.from(new Set(boundedRows.map((row) => row.lane))).sort();
    if (workspaceStatuses.length > MAX_NAVIGATION_STATUSES) {
      issues.push("tasks_navigation_status_limit_reached");
    }
    if (taskRecords.some((task) => task.terminal && !task.completedAt)) {
      issues.push("completion_timestamp_missing_for_terminal_tasks");
    }
    return {
      tasks: taskRecords,
      events,
      navigation: {
        projects: workspaceProjectIds
          .slice(0, MAX_NAVIGATION_PROJECTS)
          .map((id) => ({ id, name: titleCase(id) })),
        owners: ownerIds.map((id) => people.get(id) ?? { id, displayName: null }),
        statuses: workspaceStatuses.slice(0, MAX_NAVIGATION_STATUSES),
      },
      coverage: providerCoverage({
        provider: "tasks",
        status: issues.length ? "partial" : "ready",
        capabilities: [
          "task_read",
          "task_completion_timestamps",
          "task_status_history",
          "task_meaningful_activity",
          "task_dependencies",
          "task_owners",
          "cross_product_links",
        ],
        count: taskRecords.length,
        calculatedAt,
        historyStartAt: historyWindow.historyStartAt,
        historyEndAt: historyWindow.historyEndAt,
        issues,
      }),
    };
  }
}

export class TasksProjectsProvider {
  constructor(private readonly tasksProvider: TasksProvider = new TasksAnalyticsProvider()) {}

  async read(query: AnalyticsQuery, signal?: AbortSignal): Promise<ProviderResult<ProjectRecord>> {
    const result = await this.tasksProvider.read(query, signal);
    const records = projectsFromTasks(result.tasks, query);
    return {
      records,
      coverage: providerCoverage({
        provider: "projects",
        status: result.coverage.status,
        capabilities: ["project_read"],
        count: records.length,
        calculatedAt: result.coverage.calculatedAt,
        historyStartAt: result.coverage.historyStartAt,
        historyEndAt: result.coverage.historyEndAt,
        issues: result.coverage.issues,
      }),
    };
  }
}

export function projectsFromTasks(
  taskRecords: TaskRecord[],
  query: AnalyticsQuery,
): ProjectRecord[] {
    const buckets = new Map<string, TaskRecord[]>();
    for (const task of taskRecords) {
      for (const projectId of task.projectIds) {
        const bucket = buckets.get(projectId);
        if (bucket) bucket.push(task);
        else buckets.set(projectId, [task]);
      }
    }
    return Array.from(buckets, ([id, projectTasks]): ProjectRecord => {
      const sorted = [...projectTasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const updated = [...projectTasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return {
        id,
        workspaceId: query.scope.workspaceId,
        name: titleCase(id),
        ownerIds: Array.from(new Set(projectTasks.flatMap((task) => task.ownerIds))),
        state: "unknown",
        deepLink: `${TASKS_URL}/app/board`,
        createdAt: sorted[0]?.createdAt ?? new Date().toISOString(),
        updatedAt: updated[0]?.updatedAt ?? new Date().toISOString(),
      };
    });
}

function mapActivity(
  row: typeof activities.$inferSelect,
  projectIds: string[],
): AnalyticsEvent[] {
  const payload = objectValue(row.payload);
  const mapped = activityKind(row.kind, payload);
  return [{
    id: row.id,
    workspaceId: row.workspaceId ?? "",
    projectIds,
    entityType: "task",
    entityId: row.taskId,
    kind: mapped.kind,
    at: iso(row.createdAt),
    meaningful: isMeaningfulActivity(row.kind, payload),
    terminalTransition: mapped.terminalTransition,
    fromValue: stringValue(payload.from),
    toValue: stringValue(payload.to),
  }];
}

function activityKind(
  kind: string,
  payload: Record<string, unknown>,
): { kind: AnalyticsEventKind; terminalTransition?: boolean } {
  if (kind === "taskAdd") return { kind: "created" };
  if (kind === "toggleComplete") {
    return payload.to === "done"
      ? { kind: "completed", terminalTransition: true }
      : { kind: "status_changed", terminalTransition: false };
  }
  if (kind === "move") {
    return { kind: payload.to === "done" ? "completed" : "status_changed", terminalTransition: payload.to === "done" };
  }
  if (kind === "commentAdd" || kind === "commentRemove") return { kind: "commented" };
  if (kind === "attach" || kind === "detach") return { kind: "updated" };
  if (kind === "update" && payload.field === "assignees") return { kind: "assigned" };
  if (kind === "update" && payload.field === "due") return { kind: "date_changed" };
  return { kind: "updated" };
}

function isTerminalActivity(kind: string, payload: unknown): boolean {
  const value = objectValue(payload);
  return (kind === "toggleComplete" && value.to === "done") || (kind === "move" && value.to === "done");
}

function isMeaningfulActivity(kind: string, payload: unknown): boolean {
  if (["move", "toggleComplete", "commentAdd", "attach", "detach", "taskAdd"].includes(kind)) return true;
  if (kind !== "update") return false;
  const field = objectValue(payload).field;
  return field === "title" || field === "description" || field === "due" || field === "assignees";
}

function analyticsDate(dueAt: Date | null, due: string | null): AnalyticsDate | null {
  if (dueAt) return { kind: "instant", value: iso(dueAt) };
  if (due && ISO_DATE.test(due) && validDateOnly(due)) return { kind: "date", value: due };
  return null;
}

function validDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function iso(value: Date | number): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Stable project identity derived from Tasks' canonical tag value. */
export function projectIdFromTag(tag: string): string {
  const slug = tag
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "untagged";
}
