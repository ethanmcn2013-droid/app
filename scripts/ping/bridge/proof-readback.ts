import "server-only";
import { and, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import type { Client } from "@libsql/client";
import { normalizePingCommand, validPingId } from "@/lib/ping/command";
import { dataRecord, exactKeys, jsonArray } from "@/lib/ping/input-validation";
import type { CalendarFrame } from "@/lib/calendar-frame";
import { taskToSchedule } from "@/components/hybrid/adapter";
import type { PingExecutionContext, PingReceipt } from "@/server/ping/command-service";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";
import { conversationWriteFencesClear } from "@/server/conversations/write-fences";
import { projectCapabilities, resolveProjectRole } from "@/server/projects/capabilities";
import * as schema from "@/server/db/schema";
import { rowToTask } from "@/server/db/row-mappers";
import { byWorkspace } from "@/server/db/tenant";

/** Exact bounded data receipt validation. This validates shape/intent, not session authenticity. */
export function proofReceiptMatches(value: unknown, original: { command: unknown; context: PingExecutionContext }): value is PingReceipt {
  try {
    const normalized = normalizePingCommand(original.command);
    if (!normalized.ok || !dataRecord(value) || !exactKeys(value, ["version", "commandId", "projectId", "committedAtSeconds",
      "outcome", "affectedCount", "changedCount", "effects"]) || value.version !== "ping.receipt.v1" ||
      value.commandId !== normalized.value.commandId || value.projectId !== normalized.value.projectId ||
      !Number.isSafeInteger(value.committedAtSeconds) || Number(value.committedAtSeconds) < 0 ||
      !jsonArray(value.effects, 10) || !Number.isSafeInteger(value.changedCount) ||
      Number(value.changedCount) < 0 || Number(value.changedCount) > value.effects.length || value.affectedCount !== value.effects.length ||
      value.outcome !== (value.changedCount === 0 ? "no_changes" : "completed")) return false;
    const operation = normalized.value.operation;
    if (value.effects.length !== (operation.kind === "edit_selected" ? operation.taskIds.length : operation.count)) return false;
    const allowedFields = operation.kind === "create_placeholders" ? ["created"] : [
      ...(operation.effects.selfAssignment ? ["assignees"] : []), ...(Object.hasOwn(operation.effects, "dueDate") ? ["due"] : []),
      ...(operation.effects.statusColumnKey ? ["lane"] : [])];
    const seen = new Set<string>(); let changed = 0;
    for (const effect of value.effects) {
      if (!dataRecord(effect) || !exactKeys(effect, ["taskId", "changedFields"], ["seq"]) || !validPingId(effect.taskId) ||
          seen.has(effect.taskId) || !jsonArray(effect.changedFields, 3) ||
          !effect.changedFields.every((field) => typeof field === "string" && allowedFields.includes(field)) ||
          new Set(effect.changedFields).size !== effect.changedFields.length) return false;
      if (operation.kind === "edit_selected" && (!operation.taskIds.includes(effect.taskId) || Object.hasOwn(effect, "seq"))) return false;
      if (operation.kind === "create_placeholders" && (effect.changedFields.length !== 1 || effect.changedFields[0] !== "created" ||
          !Number.isSafeInteger(effect.seq) || Number(effect.seq) < 1)) return false;
      seen.add(effect.taskId); if (effect.changedFields.length) changed++;
    }
    return changed === value.changedCount;
  } catch { return false; }
}

export type ProofReadback = Readonly<{ ok: true; rows: readonly Readonly<{
  task: ReturnType<typeof rowToTask>; schedule: ReturnType<typeof taskToSchedule> }>[] }> |
  Readonly<{ ok: false; reason: "invalid_receipt" | "denied" | "failed" }>;

/** Fixture-only reader: fresh authorization + typed rows in the SAME queued local read transaction. */
export function createProofReadback(adapter: ConversationDatabaseAdapter, frame: CalendarFrame) {
  const calendar = structuredClone(frame);
  return async (original: { command: unknown; context: PingExecutionContext }, receipt: unknown): Promise<ProofReadback> => {
    if (!proofReceiptMatches(receipt, original)) return { ok: false, reason: "invalid_receipt" };
    if (!adapter.available || adapter.boundary !== "local-serialized-connection") return { ok: false, reason: "failed" };
    try {
      return await adapter.transaction("read", async (tx): Promise<ProofReadback> => {
        const actor = original.context.actorId, project = receipt.projectId;
        const membership = (await tx.execute({ sql: `SELECT m.role, w.owner_user_id, w.archived_at
          FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id
          WHERE m.user_id=? AND m.workspace_id=? LIMIT 1`, args: [actor, project] })).rows[0];
        if (!membership || (membership.role !== "owner" && membership.role !== "member")) return { ok: false, reason: "denied" };
        const role = resolveProjectRole({ actorUserId: actor, membershipRole: membership.role,
          workspaceOwnerUserId: membership.owner_user_id == null ? null : String(membership.owner_user_id) });
        if (!projectCapabilities({ role, archived: membership.archived_at != null, ownsPlanningPeriod: false }).open ||
            !await conversationWriteFencesClear(tx, actor, project)) return { ok: false, reason: "denied" };
        // LibSQL supplies array-like driver rows. Owning literal tests prove numeric decoding here;
        // no Client transaction method is called and no second connection is opened.
        const reader = drizzle(tx as unknown as Client, { schema });
        const rows = await reader.select({ ...getTableColumns(schema.tasks),
          // Static qualified outer identifier: Drizzle strips interpolated column qualifiers
          // in single-table selection SQL, which otherwise correlates to the inner row's id.
          commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.task_id="tasks"."id")`.as("comment_count"),
          subtaskCount: sql<number>`(SELECT COUNT(*) FROM tasks child WHERE child.parent_task_id="tasks"."id" AND child.archived_at IS NULL)`.as("subtask_count"),
          subtaskDoneCount: sql<number>`(SELECT COUNT(*) FROM tasks child WHERE child.parent_task_id="tasks"."id" AND child.archived_at IS NULL AND child.lane='done')`.as("subtask_done_count"),
        }).from(schema.tasks).where(byWorkspace(schema.tasks.workspaceId, project,
          and(inArray(schema.tasks.id, receipt.effects.map((effect) => effect.taskId)),
            isNull(schema.tasks.parentTaskId), isNull(schema.tasks.archivedAt), eq(schema.tasks.workspaceId, project)))).limit(10);
        return { ok: true, rows: rows.map((row) => { const task = rowToTask(row); return { task, schedule: taskToSchedule(task, calendar) }; }) };
      });
    } catch { return { ok: false, reason: "failed" }; }
  };
}
