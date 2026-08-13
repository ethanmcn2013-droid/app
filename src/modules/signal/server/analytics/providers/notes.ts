import "server-only";

import type {
  AnalyticsDate,
  AnalyticsQuery,
  NoteRecord,
  NotesProvider,
  ProviderResult,
} from "../../../lib/analytics/contracts";
import { isTerminalTaskTransition } from "../../../lib/analytics/task-events";
import { isTaskDone } from "@/lib/board-columns";
import { getTasksDb } from "../../tasks-db/signal-tasks-db-client";
import { activities, tasks } from "../../tasks-db/signal-tasks-db-schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getNotesClient } from "./optional-clients";
import { providerCoverage } from "./coverage";
import { labelIdFromTag } from "./tasks";

const MAX_LINKED_TASKS = 500;
const MAX_COMPLETION_EVENTS = 2_000;

/**
 * Approved-extract-only Notes adapter.
 *
 * Notes has no workspace column, so a Note enters Signal only through its
 * deliberate promoted_task_id edge to an already-authorized Tasks workspace.
 * The SELECT intentionally does not name the private `body` column.
 */
export class NotesAnalyticsProvider implements NotesProvider {
  constructor(private readonly clerkId: string) {}

  async read(query: AnalyticsQuery, signal?: AbortSignal): Promise<ProviderResult<NoteRecord>> {
    const calculatedAt = new Date().toISOString();
    const notesClient = getNotesClient();
    const tasksDb = getTasksDb();
    if (!notesClient || !tasksDb) {
      return {
        records: [],
        coverage: providerCoverage({
          provider: "notes",
          status: notesClient ? "partial" : "unavailable",
          calculatedAt,
          issues: [notesClient ? "tasks_link_provider_unavailable" : "notes_provider_not_configured"],
        }),
      };
    }

    const taskRows = await tasksDb
      .select({
        id: tasks.id,
        tags: tasks.tags,
        assignees: tasks.assignees,
        lane: tasks.lane,
        completedAt: tasks.completedAt,
        due: tasks.due,
        dueAt: tasks.dueAt,
      })
      .from(tasks)
      .where(eq(tasks.workspaceId, query.scope.workspaceId))
      .limit(MAX_LINKED_TASKS + 1);
    signal?.throwIfAborted();

    // Labels narrow; they never authorize. The Project boundary is the
    // `workspaceId` predicate above.
    const labelFilter = new Set<string>(query.filters?.labelIds ?? []);
    const scopedTasks = taskRows.slice(0, MAX_LINKED_TASKS).filter((task) => {
      const labels = stringArray(task.tags).map(labelIdFromTag);
      if (labelFilter.size > 0 && !labels.some((label) => labelFilter.has(label))) return false;
      if (query.scope.type === "user" && !stringArray(task.assignees).includes(query.scope.id)) return false;
      return true;
    });
    if (!scopedTasks.length) {
      return {
        records: [],
        coverage: providerCoverage({
          provider: "notes",
          status: "partial",
          capabilities: ["follow_up_read", "cross_product_links"],
          calculatedAt,
          issues: ["decisions_not_structured_in_notes", "unlinked_notes_excluded"],
        }),
      };
    }

    const placeholders = scopedTasks.map(() => "?").join(",");
    const result = await notesClient.execute({
      sql: `SELECT id, user_id, extract_body, promoted_task_id, created_at, updated_at
            FROM notes
            WHERE user_id = ?
              AND extract_body IS NOT NULL
              AND promoted_task_id IN (${placeholders})
            ORDER BY updated_at DESC
            LIMIT ?`,
      args: [this.clerkId, ...scopedTasks.map((task) => task.id), MAX_LINKED_TASKS],
    });
    signal?.throwIfAborted();

    const tasksById = new Map(scopedTasks.map((task) => [task.id, task]));
    const promotedTaskIds = new Set(
      result.rows
        .map((row) => textValue(row.promoted_task_id))
        .filter((id): id is string => Boolean(id)),
    );
    // This read-only mirror has no meta table / boardColumnKey column (see
    // tasks.ts provider), so null resolves to the default ["done"] doneKeys,
    // identical to the literal check it replaces.
    const completedTasks = scopedTasks.filter(
      (task) => isTaskDone(task, null) && promotedTaskIds.has(task.id),
    );
    const completedTaskIds = completedTasks.map((task) => task.id);
    // T·122: tasks.completedAt is the durable stamp; only rows completed
    // before the column existed still need the activity-log fallback.
    const stampedByTask = new Map<string, string>();
    for (const task of completedTasks) {
      if (task.completedAt) stampedByTask.set(task.id, task.completedAt.toISOString());
    }
    const unstampedTaskIds = completedTaskIds.filter((id) => !stampedByTask.has(id));
    const completionRows = unstampedTaskIds.length
      ? await tasksDb
          .select({
            taskId: activities.taskId,
            kind: activities.kind,
            payload: activities.payload,
            createdAt: activities.createdAt,
          })
          .from(activities)
          .where(
            and(
              eq(activities.workspaceId, query.scope.workspaceId),
              inArray(activities.taskId, unstampedTaskIds),
            ),
          )
          .orderBy(asc(activities.createdAt))
          .limit(MAX_COMPLETION_EVENTS + 1)
      : [];
    signal?.throwIfAborted();
    const completedAtByTask = new Map<string, string>(stampedByTask);
    for (const row of completionRows.slice(0, MAX_COMPLETION_EVENTS)) {
      if (isTerminalTaskTransition(row.kind, row.payload)) {
        completedAtByTask.set(row.taskId, row.createdAt.toISOString());
      }
    }
    const records = result.rows.flatMap((row): NoteRecord[] => {
      const id = textValue(row.id);
      const title = textValue(row.extract_body);
      const taskId = textValue(row.promoted_task_id);
      const task = taskId ? tasksById.get(taskId) : undefined;
      const createdAt = timestampMs(row.created_at);
      const updatedAt = timestampMs(row.updated_at);
      if (!id || !title || !taskId || !task || !createdAt || !updatedAt) return [];
      return [{
        id,
        workspaceId: query.scope.workspaceId,
        labelIds: stringArray(task.tags).map(labelIdFromTag),
        kind: "follow_up",
        title,
        state: isTaskDone(task, null) ? "completed" : "open",
        ownerIds: stringArray(task.assignees),
        due: taskDate(task.dueAt, task.due),
        createdAt,
        updatedAt,
        completedAt: completedAtByTask.get(taskId) ?? null,
        linkedTaskIds: [taskId],
        linkedMilestoneIds: [],
        // Notes intentionally has no reliable owner-only record deep link.
        deepLink: "",
        exposure: "approved_extract",
      }];
    });

    return {
      records,
      coverage: providerCoverage({
        provider: "notes",
        status: "partial",
        capabilities: ["follow_up_read", "cross_product_links"],
        count: records.length,
        calculatedAt,
        historyStartAt: records.map((record) => record.createdAt).sort()[0] ?? null,
        historyEndAt: records.map((record) => record.updatedAt).sort().at(-1) ?? null,
        issues: [
          "decisions_not_structured_in_notes",
          "unlinked_notes_excluded",
          "note_record_actions_unsupported",
          ...(completedTaskIds.some((id) => !completedAtByTask.has(id))
            ? ["follow_up_completion_timestamp_missing"]
            : []),
          ...(completionRows.length > MAX_COMPLETION_EVENTS
            ? ["follow_up_completion_event_limit_reached"]
            : []),
          ...(taskRows.length > MAX_LINKED_TASKS ? ["notes_task_link_limit_reached"] : []),
        ],
      }),
    };
  }
}

function taskDate(dueAt: Date | null, due: string | null): AnalyticsDate | null {
  if (dueAt) return { kind: "instant", value: dueAt.toISOString() };
  if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) return { kind: "date", value: due };
  return null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function timestampMs(value: unknown): string | null {
  const number = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(number)) return null;
  const date = new Date(number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
