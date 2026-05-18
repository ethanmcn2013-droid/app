import "server-only";
import type { tasks } from "./schema";
import type { Task, UserId } from "@/lib/data";

type TaskRow = typeof tasks.$inferSelect & { commentCount: number };

/**
 * Drizzle row → client `Task` shape. Coerces NULL → undefined since
 * the client type uses optional, not nullable.
 */
export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    lane: row.lane,
    priority: row.priority,
    assignees: row.assignees as UserId[],
    due: row.due ?? undefined,
    dueAt: row.dueAt ?? undefined,
    estimate: row.estimate ?? undefined,
    tags: row.tags ?? undefined,
    comments: row.commentCount > 0 ? row.commentCount : undefined,
    idleDays: row.idleDays ?? undefined,
    blockedBy: row.blockedBy ?? undefined,
    recurrence: row.recurrence ?? undefined,
    startDay: row.startDay ?? undefined,
    durationDays: row.durationDays ?? undefined,
    externalContactName: row.externalContactName ?? null,
    externalContactEmail: row.externalContactEmail ?? null,
    cents: row.cents ?? null,
    parentTaskId: row.parentTaskId ?? null,
    // RW-3b: milestone flag — coerce DB integer boolean to JS boolean.
    // Undefined (not false) for untouched rows so the flag reads as
    // falsy without adding noise to the client type.
    isMilestone: row.isMilestone || undefined,
    updatedAt: row.updatedAt,
  };
}
