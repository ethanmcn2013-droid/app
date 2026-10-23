import "server-only";
import { setProjectArchivedInTransaction, ProjectArchiveRefusal } from "@/server/projects/archive-project-core";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { AssistantActionRefusal, assertAssistantActor, authorizeAssistantProject, type AssistantActionTransaction } from "./context";
import { assistantConversationAdapter } from "./conversation-transaction";
import { createConversationService } from "@/server/conversations/service";
import { createTaskDiscussionService } from "@/server/conversations/task-discussion";
import { parseProjectId } from "@/lib/projects/project-ref";
import { tasks,comments } from "@/server/db/schema";
import type { AssistantReversal, AssistantTaskSnapshot, AssistantUndoResult } from "@/lib/ping/assistant/release2";

/** Undo runs within the original step's fenced transaction. Conflicts throw so no partial reversal commits. */
export class AssistantUndoConflict extends Error {
  constructor(readonly code: "stale" | "unavailable" | "unsupported") { super(`assistant_undo_${code}`); }
}

const snapshotColumns = {
  id: tasks.id, workspaceId: tasks.workspaceId, seq: tasks.seq, title: tasks.title, description: tasks.description,
  lane: tasks.lane, priority: tasks.priority, assignees: tasks.assignees, due: tasks.due, dueAt: tasks.dueAt,
  estimate: tasks.estimate, tags: tasks.tags, idleDays: tasks.idleDays, blockedBy: tasks.blockedBy,
  recurrence: tasks.recurrence, startDay: tasks.startDay, durationDays: tasks.durationDays, position: tasks.position,
  parentTaskId: tasks.parentTaskId, externalContactName: tasks.externalContactName, externalContactEmail: tasks.externalContactEmail,
  cents: tasks.cents, sourceNoteId: tasks.sourceNoteId, sourceNoteExtractBody: tasks.sourceNoteExtractBody,
  sourceNoteExtractSha256: tasks.sourceNoteExtractSha256, boardColumnKey: tasks.boardColumnKey,
  completedAt: tasks.completedAt, isMilestone: tasks.isMilestone, archivedAt: tasks.archivedAt,
  createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
} as const;
type SnapshotKey = keyof typeof snapshotColumns;
const mutableKeys = new Set<SnapshotKey>([
  "title", "description", "lane", "priority", "assignees", "due", "dueAt", "estimate", "tags", "idleDays",
  "blockedBy", "recurrence", "startDay", "durationDays", "position", "parentTaskId", "externalContactName",
  "externalContactEmail", "cents", "sourceNoteId", "sourceNoteExtractBody", "sourceNoteExtractSha256",
  "boardColumnKey", "completedAt", "isMilestone", "archivedAt",
]);
const dateKeys = new Set<SnapshotKey>(["dueAt", "completedAt", "archivedAt", "createdAt", "updatedAt"]);

function dateValue(value: unknown): Date | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new AssistantUndoConflict("unsupported");
  return new Date(value);
}
function dbValue(key: SnapshotKey, value: unknown): unknown {
  return dateKeys.has(key) ? dateValue(value) : value;
}
function snapshot(value: AssistantTaskSnapshot, projectId: string): { id: string; workspaceId: string; values: Partial<Record<SnapshotKey, unknown>> } {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.id !== "string" ||
      value.workspaceId !== projectId || !Object.hasOwn(value, "updatedAt")) throw new AssistantUndoConflict("unsupported");
  const values: Partial<Record<SnapshotKey, unknown>> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!Object.hasOwn(snapshotColumns, key)) throw new AssistantUndoConflict("unsupported");
    values[key as SnapshotKey] = item;
  }
  if (!values.id || values.workspaceId !== projectId || values.updatedAt === undefined ||
      Object.keys(snapshotColumns).some(key => !Object.hasOwn(values, key)) || !Object.keys(values).some(key => mutableKeys.has(key as SnapshotKey))) {
    throw new AssistantUndoConflict("unsupported");
  }
  return { id: value.id, workspaceId: projectId, values };
}
function compareConditions(value: Partial<Record<SnapshotKey, unknown>>) {
  return Object.entries(value).map(([rawKey, item]) => {
    const key = rawKey as SnapshotKey, column = snapshotColumns[key];
    if (item === null) return isNull(column);
    return eq(column as never, dbValue(key, item) as never);
  });
}

async function undoTasks(tx: AssistantActionTransaction, actorId: string, reversal: Extract<AssistantReversal, {kind:"tasks"}>): Promise<number> {
  if (!reversal.projectId || !Array.isArray(reversal.rows) || !reversal.rows.length || reversal.rows.length > 500 ||
      new Set(reversal.rows.map(row => row.id)).size !== reversal.rows.length) throw new AssistantUndoConflict("unsupported");
  await authorizeAssistantProject(tx, actorId, reversal.projectId, "createOrEditTasks");
  const now = new Date();
  const plans = reversal.rows.map(raw => {
    const after = snapshot(raw.after, reversal.projectId);
    if (after.id !== raw.id) throw new AssistantUndoConflict("unsupported");
    const before = raw.before === null ? null : snapshot(raw.before, reversal.projectId);
    if (before && before.id !== raw.id) throw new AssistantUndoConflict("unsupported");
    const guards = compareConditions(after.values);
    const restore: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
    if (before) {
      for (const [key, value] of Object.entries(before.values)) {
        if (mutableKeys.has(key as SnapshotKey)) (restore as Record<string, unknown>)[key] = dbValue(key as SnapshotKey, value);
      }
    } else {
      // A created row is preserved for audit/history and removed from active views by the normal archive field.
      restore.archivedAt = now;
    }
    return { id: raw.id, before, after, restore, where: and(eq(tasks.id, raw.id), eq(tasks.workspaceId, reversal.projectId), ...guards)! };
  });
  const createdIds = plans.filter(plan => plan.before === null).map(plan => plan.id);
  // Check all newly attached work before any row changes. This protects checklist children and comments
  // without opening a select round trip for each parent.
  for (let offset = 0; offset < createdIds.length; offset += 100) {
    const ids = createdIds.slice(offset, offset + 100);
    if (!ids.length) continue;
    const [child, comment] = await Promise.all([
      tx.select({id:tasks.id}).from(tasks).where(and(eq(tasks.workspaceId,reversal.projectId), inArray(tasks.parentTaskId,ids), isNull(tasks.archivedAt))).limit(1),
      tx.select({id:comments.id}).from(comments).where(and(inArray(comments.taskId,ids),isNull(comments.deletedAt))).limit(1),
    ]);
    if (child.length || comment.length) throw new AssistantUndoConflict("stale");
  }
  const groups = new Map<string, typeof plans>();
  for (const plan of plans) {
    const key = JSON.stringify(plan.restore);
    const group = groups.get(key);
    if (group) group.push(plan); else groups.set(key, [plan]);
  }
  for (const group of groups.values()) {
    // A full mutable snapshot contributes ~35 bind values per row. Ten rows stay far below SQLite's 999 limit.
    for (let offset = 0; offset < group.length; offset += 10) {
      const chunk = group.slice(offset, offset + 10);
      const changed = await tx.update(tasks).set(chunk[0].restore)
        .where(and(eq(tasks.workspaceId, reversal.projectId), or(...chunk.map(plan => plan.where))))
        .returning({id:tasks.id});
      if (changed.length !== chunk.length) throw new AssistantUndoConflict("stale");
    }
  }
  return reversal.rows.length;
}

function undoReceiptId(actorId: string, itemId: string): string {
  return `ping-undo-${createHash("sha256").update(`${actorId}\0${itemId}`).digest("hex").slice(0, 40)}`;
}
async function undoMessages(tx: AssistantActionTransaction, actorId: string, reversal: Extract<AssistantReversal, {kind:"messages"}>,directMessagesEnabled=false): Promise<number> {
  if (!reversal.projectId || !Array.isArray(reversal.items) || !reversal.items.length || reversal.items.length > 100 ||
      reversal.items.some(item => !Number.isSafeInteger(item.revision) || item.revision < 1 || !Number.isSafeInteger(item.audienceEpoch) || item.audienceEpoch < 1)) {
    throw new AssistantUndoConflict("unsupported");
  }
  await authorizeAssistantProject(tx, actorId, reversal.projectId, "createOrEditTasks");
  const serviceDb = assistantConversationAdapter(tx), projectId = parseProjectId(reversal.projectId);
  if (!projectId) throw new AssistantUndoConflict("unavailable");
  const conversation = createConversationService(serviceDb, { directMessagesEnabled });
  const discussion = createTaskDiscussionService(serviceDb);
  for (const item of reversal.items) {
    const clientRequestId = undoReceiptId(actorId, item.itemId);
    const result = item.kind === "conversation"
      ? await conversation.tombstoneMessage({ actorId, projectId, conversationId: item.scopeId, messageId: item.itemId,
          clientRequestId, expectedRevision: item.revision, expectedAudienceEpoch: item.audienceEpoch })
      : await discussion.tombstoneComment({ actorId, taskId: item.scopeId, commentId: item.itemId,
          clientRequestId, expectedRevision: item.revision, expectedAudienceEpoch: item.audienceEpoch });
    if (!result.ok) throw new AssistantUndoConflict(result.code === "revision_conflict" ? "stale" : "unavailable");
  }
  return reversal.items.length;
}

export async function executeAssistantUndo(tx: AssistantActionTransaction, actorId: string, reversal: AssistantReversal,options:{directMessagesEnabled?:boolean}={}): Promise<AssistantUndoResult> {
  try {
    await assertAssistantActor(tx, actorId);
    if(reversal.kind==='project_archive'){
      await authorizeAssistantProject(tx,actorId,reversal.projectId,'manageProject');
      if(!Number.isSafeInteger(reversal.afterRevision)||reversal.afterRevision<1)throw new AssistantUndoConflict('unsupported');
      const before=reversal.beforeArchivedAt===null?null:dateValue(reversal.beforeArchivedAt);
      const after=reversal.afterArchivedAt===null?null:dateValue(reversal.afterArchivedAt);
      await setProjectArchivedInTransaction(tx,{actorUserId:actorId,projectId:reversal.projectId,archived:before!==null,
        expectedRevision:reversal.afterRevision,expectedArchivedAt:after,restoreArchivedAt:before});
      return {status:'reverted',summary:'Undid the Project archive or restore.',affectedCount:1};
    }
    const affectedCount = reversal.kind === "tasks" ? await undoTasks(tx, actorId, reversal) : await undoMessages(tx, actorId, reversal,options.directMessagesEnabled);
    return { status: "reverted", summary: reversal.kind === "tasks" ? `Undid ${affectedCount} task change${affectedCount === 1 ? "" : "s"}.` : `Took back ${affectedCount} message${affectedCount === 1 ? "" : "s"}.`, affectedCount };
  } catch (error) {
    // Throwing is required so the caller's transaction rolls back any earlier reversal in this batch.
    if (error instanceof ProjectArchiveRefusal) throw new AssistantUndoConflict(error.code);
    if (error instanceof AssistantUndoConflict) throw error;
    if (error instanceof AssistantActionRefusal) throw new AssistantUndoConflict(error.code === "stale" ? "stale" : "unavailable");
    throw error;
  }
}
