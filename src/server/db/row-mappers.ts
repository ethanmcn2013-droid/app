import "server-only";
import type { tasks } from "./schema";
import type { Task, UserId } from "@/lib/data";

type TaskRow = typeof tasks.$inferSelect & {
  commentCount: number;
  subtaskCount?: number;
  subtaskDoneCount?: number;
};

/**
 * Drizzle row → client `Task` shape. Coerces NULL → undefined since
 * the client type uses optional, not nullable.
 */
export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    seq: row.seq ?? undefined,
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
    subtaskCount: row.subtaskCount ? row.subtaskCount : undefined,
    subtaskDone: row.subtaskDoneCount ? row.subtaskDoneCount : undefined,
    idleDays: row.idleDays ?? undefined,
    blockedBy: row.blockedBy ?? undefined,
    recurrence: row.recurrence ?? undefined,
    startDay: row.startDay ?? undefined,
    durationDays: row.durationDays ?? undefined,
    externalContactName: row.externalContactName ?? null,
    externalContactEmail: row.externalContactEmail ?? null,
    cents: row.cents ?? null,
    parentTaskId: row.parentTaskId ?? null,
    // RW-3b: milestone flag, coerce DB integer boolean to JS boolean.
    // Undefined (not false) for untouched rows so the flag reads as
    // falsy without adding noise to the client type.
    isMilestone: row.isMilestone || undefined,
    // T·69 step 5: custom board column key. Null when column hasn't been
    // applied (migration 0007 not yet run), board-app.tsx falls back to
    // the canonical `lane` column in that case.
    boardColumnKey: row.boardColumnKey ?? null,
    // Cross-product provenance. Set on tasks created via the Notes →
    // Tasks extract endpoint; drives the "↩ From Notes" chip in the
    // detail-panel header. Null on every task authored inside Tasks.
    sourceNoteId: row.sourceNoteId ?? null,
    // Archive timestamp. Null when active or when the column predates
    // migration 0016 (libSQL returns undefined for an absent column).
    archivedAt: row.archivedAt ?? null,
    updatedAt: row.updatedAt,
  };
}
