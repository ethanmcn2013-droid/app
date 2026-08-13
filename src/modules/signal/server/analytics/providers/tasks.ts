import "server-only";

import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import type {
  AnalyticsDate,
  AnalyticsEvent,
  AnalyticsEventKind,
  AnalyticsQuery,
  LabelId,
  LabelRecord,
  PersonRef,
  ProviderResult,
  TaskRecord,
  TasksProvider,
  TasksProviderResult,
} from "../../../lib/analytics/contracts";
import { asLabelId } from "../../../lib/analytics/contracts";
import { APP_ORIGIN } from "@/lib/product-urls";
import {
  effectiveColumnKey,
  isTaskDone,
  WAITING_COLUMN_KEY,
} from "@/lib/board-columns";
import { getTasksDb } from "../../tasks-db/signal-tasks-db-client";
import {
  activities,
  tasks,
  users,
} from "../../tasks-db/signal-tasks-db-schema";
import { readWorkspaceColumnConfig } from "./column-config";
import { providerCoverage } from "./coverage";
import { queriedHistoryWindow } from "./history-window";

const MAX_TASKS = 2_000;
const MAX_ACTIVITIES = 5_000;
const MAX_NAVIGATION_LABELS = 500;
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
        navigation: { labels: [], owners: [], statuses: [] },
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

    // R10 · `LIMIT 2001` with no ORDER BY leaves both the sequence AND the
    // truncated set to the storage engine, so two reads of the same
    // workspace could report different totals and the truncation issue
    // could not say which rows it dropped. `id` is the primary key, so it
    // is a total order and needs no extra index.
    const [taskRows, columnConfig] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(eq(tasks.workspaceId, query.scope.workspaceId))
        .orderBy(asc(tasks.id))
        .limit(MAX_TASKS + 1),
      readWorkspaceColumnConfig(db, query.scope.workspaceId),
    ]);
    signal?.throwIfAborted();

    const isTruncated = taskRows.length > MAX_TASKS;
    const boundedRows = taskRows.slice(0, MAX_TASKS);
    // Labels narrow the read; they never authorize it. The Project boundary is
    // the `workspaceId` predicate above, proved by the policy before we get here.
    const labelFilter = new Set<string>(query.filters?.labelIds ?? []);
    const scopedRows = boundedRows.filter((row) => {
      const labels = stringArray(row.tags).map(labelIdFromTag);
      const assignees = stringArray(row.assignees);
      if (labelFilter.size > 0 && !labels.some((label) => labelFilter.has(label))) return false;
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
    // R3 · resolve Done through the workspace's own ColumnConfig, so a
    // renamed Done column reads identically here and on the board. Passing
    // null pinned analytics to doneKeys = ["done"] regardless.
    const terminalTaskIds = new Set(
      boundedRows
        .filter((row) => isTaskDone(row, columnConfig.config))
        .map((row) => row.id),
    );
    const labelIdsByTask = new Map(
      scopedRows.map((row) => [row.id, stringArray(row.tags).map(labelIdFromTag)]),
    );
    const events = boundedActivities.flatMap((row) =>
      mapActivity(row, labelIdsByTask.get(row.taskId) ?? [], query.scope.workspaceId),
    );
    const taskRecords = scopedRows.map((row): TaskRecord => {
      const assigneeIds = stringArray(row.assignees);
      const dependencies = stringArray(row.blockedBy);
      // R2 · `lane === "blocked"` was never a lane, and migration 0024
      // rewrote every `lane='waiting'` row to `lane='doing'` +
      // `board_column_key='waiting'`, so this test could not match a live
      // row and explicit blocking counted zero. `effectiveColumnKey` is the
      // board's own resolution and answers identically for pre- and
      // post-0024 rows.
      const explicitBlocking = effectiveColumnKey(row) === WAITING_COLUMN_KEY;
      const taskActivities = rawByTask.get(row.id) ?? [];
      const meaningful = taskActivities.filter((entry) => isMeaningfulActivity(entry.kind, entry.payload));
      // T·122: tasks.completedAt is the durable completion moment; the
      // activity-log reconstruction remains only as the fallback for rows
      // completed before the column existed. The
      // completion_timestamp_missing gauge now measures exactly that
      // residue, and burns down as old tasks are touched.
      const completion = terminalTaskIds.has(row.id)
        ? row.completedAt ??
          ([...taskActivities]
            .reverse()
            .find((entry) => isTerminalActivity(entry.kind, entry.payload))?.createdAt ?? null)
        : null;
      return {
        id: row.id,
        workspaceId: query.scope.workspaceId,
        labelIds: stringArray(row.tags).map(labelIdFromTag),
        title: row.title,
        status: effectiveColumnKey(row),
        terminal: terminalTaskIds.has(row.id),
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
        deepLink: `${APP_ORIGIN}/app/tasks?task=${encodeURIComponent(row.id)}`,
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
    const workspaceLabelIds = Array.from(new Set(
      boundedRows.flatMap((row) => stringArray(row.tags).map(labelIdFromTag)),
    ));
    if (workspaceLabelIds.length > MAX_NAVIGATION_LABELS) {
      issues.push("tasks_navigation_label_limit_reached");
    }
    const workspaceStatuses = Array.from(
      new Set(boundedRows.map((row) => effectiveColumnKey(row))),
    ).sort();
    if (workspaceStatuses.length > MAX_NAVIGATION_STATUSES) {
      issues.push("tasks_navigation_status_limit_reached");
    }
    if (taskRecords.some((task) => task.terminal && !task.completedAt)) {
      issues.push("completion_timestamp_missing_for_terminal_tasks");
    }
    if (columnConfig.unreadable) {
      // Disclosed, not absorbed: the default doneKeys were applied because
      // the workspace's config could not be read, which is a coverage gap
      // and not a fact about the workspace.
      issues.push("board_column_config_unreadable");
    }
    return {
      tasks: taskRecords,
      events,
      navigation: {
        labels: workspaceLabelIds
          .slice(0, MAX_NAVIGATION_LABELS)
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

export class TasksLabelsProvider {
  constructor(private readonly tasksProvider: TasksProvider = new TasksAnalyticsProvider()) {}

  async read(query: AnalyticsQuery, signal?: AbortSignal): Promise<ProviderResult<LabelRecord>> {
    const result = await this.tasksProvider.read(query, signal);
    const records = labelsFromTasks(result.tasks, query);
    return {
      records,
      coverage: providerCoverage({
        provider: "labels",
        status: result.coverage.status,
        capabilities: ["label_read"],
        count: records.length,
        calculatedAt: result.coverage.calculatedAt,
        historyStartAt: result.coverage.historyStartAt,
        historyEndAt: result.coverage.historyEndAt,
        issues: result.coverage.issues,
      }),
    };
  }
}

export function labelsFromTasks(
  taskRecords: TaskRecord[],
  query: AnalyticsQuery,
): LabelRecord[] {
    const buckets = new Map<LabelId, TaskRecord[]>();
    for (const task of taskRecords) {
      for (const labelId of task.labelIds) {
        const bucket = buckets.get(labelId);
        if (bucket) bucket.push(task);
        else buckets.set(labelId, [task]);
      }
    }
    return Array.from(buckets, ([id, labelTasks]): LabelRecord => {
      const sorted = [...labelTasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const updated = [...labelTasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return {
        id,
        workspaceId: query.scope.workspaceId,
        name: titleCase(id),
        ownerIds: Array.from(new Set(labelTasks.flatMap((task) => task.ownerIds))),
        state: "unknown",
        deepLink: `${APP_ORIGIN}/app/tasks`,
        createdAt: sorted[0]?.createdAt ?? new Date().toISOString(),
        updatedAt: updated[0]?.updatedAt ?? new Date().toISOString(),
      };
    });
}

function mapActivity(
  row: typeof activities.$inferSelect,
  labelIds: LabelId[],
  workspaceId: TaskRecord["workspaceId"],
): AnalyticsEvent[] {
  const payload = objectValue(row.payload);
  const mapped = activityKind(row.kind, payload);
  return [{
    id: row.id,
    workspaceId,
    labelIds,
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

/**
 * Stable Label (Workstream) identity derived from a Tasks tag.
 *
 * This is NOT a Project id. A Project is a Tasks `workspaces.id` (ADR 0001 §1);
 * a tag is a classification of work inside one. Renamed from `projectIdFromTag`
 * so the distinction survives a reader who only sees the call site.
 */
export function labelIdFromTag(tag: string): LabelId {
  const slug = tag
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return asLabelId(slug || "untagged");
}
