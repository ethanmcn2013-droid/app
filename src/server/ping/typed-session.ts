import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Task } from "@/lib/data";
import { normalizePingCommandId, pingProofDueAtSeconds, validPingId, type PingCommand } from "@/lib/ping/command";
import { dataRecord, exactKeys, jsonArray } from "@/lib/ping/input-validation";
import { bindPingProposal, normalizePingCapture, type PingCapture } from "@/lib/ping/proposal";
import { parsePingTypedCommand } from "@/lib/ping/typed-command";
import { PING_TYPED_VERSION, type PingTypedPrepare, type PingTypedReceipt, type PingTypedRequest,
  type PingTypedResponse, type PingTypedSnapshot, type PingTypedTask } from "@/lib/ping/typed-contract";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "@/server/conversations/database";
import { conversationWriteFencesClear } from "@/server/conversations/write-fences";
import { projectCapabilities, resolveProjectRole } from "@/server/projects/capabilities";
import { readCanonicalTasks } from "@/server/db/task-read";
import * as schema from "@/server/db/schema";
import { createPingCommandService, type PingExecutionContext } from "./command-service";

export type PingTypedActor = Readonly<{ actorId: string; sessionId: string }>;
type Original = Readonly<{ command: PingCommand; context: PingExecutionContext }>;
type FullCapture = Omit<PingCapture, "snapshots"> & { snapshots: Readonly<Record<string, PingTypedSnapshot>> };
type Lane = { token: string; actor: PingTypedActor; generationId: string; requestId: string; requestHash: string;
  capture: FullCapture; original: Original; proposal: Extract<ReturnType<typeof parsePingTypedCommand>, { outcome: "plan" }>;
  expiresAt: number; invoked: boolean; cancelled: boolean; executing: boolean; reading: boolean;
  receipt: PingTypedReceipt | null; reads: number; refreshes: number; lastReadAt: number };
const fail = (code: Extract<PingTypedResponse, { ok: false }>["code"]): PingTypedResponse => ({ ok: false, code });
const nullable = (value: unknown): number | null => value == null ? null : Number(value);
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function snapshot(row: Record<string, unknown>): PingTypedSnapshot {
  return { assignees: JSON.parse(String(row.assignees)), due: row.due == null ? null : String(row.due),
    dueAtSeconds: nullable(row.due_at), startDay: nullable(row.start_day), durationDays: nullable(row.duration_days),
    lane: row.lane as PingTypedSnapshot["lane"], boardColumnKey: row.board_column_key as null,
    completedAtSeconds: nullable(row.completed_at) };
}
function sameSnapshot(left: PingTypedSnapshot, right: PingTypedSnapshot) {
  return stable({ ...left, assignees: [...left.assignees].sort() }) ===
    stable({ ...right, assignees: [...right.assignees].sort() });
}
async function authorized(tx: ConversationSqlExecutor, actor: string, project: string, write: boolean) {
  const row = (await tx.execute({ sql: `SELECT m.role,w.owner_user_id,w.archived_at FROM workspace_members m
    JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.workspace_id=? LIMIT 1`, args: [actor, project] })).rows[0];
  if (!row || (row.role !== "owner" && row.role !== "member")) return false;
  const role = resolveProjectRole({ actorUserId: actor, membershipRole: row.role,
    workspaceOwnerUserId: row.owner_user_id == null ? null : String(row.owner_user_id) });
  const capabilities = projectCapabilities({ role, archived: row.archived_at != null, ownsPlanningPeriod: false });
  return (write ? capabilities.createOrEditTasks : capabilities.open) && conversationWriteFencesClear(tx, actor, project);
}
function wireTask(task: Task): PingTypedTask {
  return { ...task, dueAt: task.dueAt?.toISOString(), updatedAt: task.updatedAt.toISOString(),
    archivedAt: task.archivedAt?.toISOString() ?? null, completedAt: task.completedAt?.toISOString() ?? null };
}
function identity(lane: Lane) {
  return { generationId: lane.generationId, commandId: lane.original.command.commandId, projectId: lane.original.command.projectId };
}
function currentMatches(lane: Lane, rows: readonly Task[]): boolean {
  const command = lane.original.command, operation = command.operation;
  return lane.receipt!.effects.every((effect) => {
    const task = rows.find((row) => row.id === effect.taskId);
    if (!task || task.isMilestone || task.recurrence || task.parentTaskId || task.archivedAt || task.boardColumnKey != null) return false;
    const pre = lane.capture.snapshots[effect.taskId];
    const assignees = operation.kind === "create_placeholders" ? [] : [...pre.assignees];
    if (operation.effects.selfAssignment === "add" && !assignees.includes(lane.actor.actorId)) assignees.push(lane.actor.actorId);
    if (operation.effects.selfAssignment === "remove") {
      const index = assignees.indexOf(lane.actor.actorId); if (index >= 0) assignees.splice(index, 1);
    }
    const due = Object.hasOwn(operation.effects, "dueDate") ? operation.effects.dueDate ?? null : pre?.due ?? null;
    const dueAt = Object.hasOwn(operation.effects, "dueDate") ?
      pingProofDueAtSeconds(operation.effects.dueDate ?? null) : pre?.dueAtSeconds ?? null;
    const status = operation.effects.statusColumnKey ?? (operation.kind === "create_placeholders" ? "todo" : pre.lane);
    // Initial typed slice accepts default stored columns only, so done semantics are explicit.
    const completed = operation.kind === "create_placeholders" ? (status === "done" ? lane.receipt!.committedAtSeconds : null) :
      !operation.effects.statusColumnKey || (pre.lane === "done") === (status === "done") ? pre.completedAtSeconds :
        status === "done" ? lane.receipt!.committedAtSeconds : null;
    return stable([...task.assignees].sort()) === stable(assignees.sort()) && (task.due ?? null) === due &&
      (task.dueAt ? Math.floor(task.dueAt.getTime() / 1000) : null) === dueAt && task.lane === status &&
      (task.completedAt ? Math.floor(task.completedAt.getTime() / 1000) : null) === completed &&
      (task.startDay ?? null) === (pre?.startDay ?? null) && (task.durationDays ?? null) === (pre?.durationDays ?? null) &&
      (operation.kind !== "create_placeholders" || (task.title === operation.title && task.seq === effect.seq));
  });
}

/** Finite isolated-process custody. Injected actor in tests is not genuine authentication evidence. */
export function createPingTypedSession(adapter: ConversationDatabaseAdapter, options: {
  now?: () => number; uuid?: () => string; token?: () => string;
  service?: ReturnType<typeof createPingCommandService>;
} = {}) {
  const now = options.now ?? Date.now, uuid = options.uuid ?? randomUUID;
  const service = options.service ?? createPingCommandService(adapter);
  const lanes = new Map<string, Lane>(); const preparing = new Set<string>();
  const retired = new Set<string>();
  const key = (actor: PingTypedActor) => stable(actor);
  function prepared(lane: Lane): PingTypedResponse {
    return { ok: true, action: "prepare", ...identity(lane), token: lane.token, expiresAt: lane.expiresAt, proposal: lane.proposal };
  }
  async function reconcile(lane: Lane, action: "execute" | "receipt" | "cancel"): Promise<PingTypedResponse> {
    if (lane.executing || lane.reading) return { ok: true, action, ...identity(lane), knowledge: "unresolved", detail: "pending" };
    if (lane.reads >= 24 || now() - lane.lastReadAt < 500) return fail("busy");
    lane.reading = true; lane.reads++; lane.lastReadAt = now(); const started = now();
    try {
      const result = await service.getReceiptForCommand(lane.original);
      if (now() - started >= 10_000) return fail("temporarily_unavailable");
      if (!result.ok) return fail(result.reason === "request_conflict" ? "request_conflict" : "unavailable");
      if (result.state === "absent") return { ok: true, action, ...identity(lane), knowledge: "unresolved", detail: "absent" };
      lane.receipt = result.receipt;
      return { ok: true, action, ...identity(lane), knowledge: "committed", receipt: result.receipt };
    } catch { return fail("temporarily_unavailable"); } finally { lane.reading = false; }
  }
  return { async handle(actor: PingTypedActor, value: unknown): Promise<PingTypedResponse> {
    if (!validPingId(actor.actorId) || !validPingId(actor.sessionId) || !adapter.available ||
      adapter.boundary !== "local-serialized-connection") return fail("unavailable");
    if (!dataRecord(value) || value.version !== PING_TYPED_VERSION || !validPingId(value.generationId)) return fail("invalid_input");
    if (value.action === "prepare") {
      if (!exactKeys(value, ["version", "action", "generationId", "requestId", "projectId", "selectedTaskIds", "snapshots", "text"]) ||
        !normalizePingCommandId(value.requestId) || !validPingId(value.projectId) || !jsonArray(value.selectedTaskIds, 10) ||
        !value.selectedTaskIds.every(validPingId) || new Set(value.selectedTaskIds).size !== value.selectedTaskIds.length ||
        !dataRecord(value.snapshots) || typeof value.text !== "string") return fail("invalid_input");
      const request = { ...value, requestId: normalizePingCommandId(value.requestId)! } as unknown as PingTypedPrepare;
      const requestKey = `${key(actor)}:${request.requestId.toLowerCase()}`;
      if (retired.has(requestKey)) return fail("request_conflict");
      const proposal = parsePingTypedCommand(request.text);
      if (proposal.outcome !== "plan") return fail(proposal.reason);
      if (proposal.operation.kind === "create_placeholders" && request.selectedTaskIds.length !== 0) return fail("invalid_input");
      const tentative = normalizePingCapture({ generationId: request.generationId, connectionEpoch: "typed-local", contextKey: request.requestId,
        sessionId: actor.sessionId, actorId: actor.actorId, inputItemId: uuid(), commandId: uuid(), projectId: request.projectId,
        selectedTaskIds: request.selectedTaskIds, snapshots: request.snapshots,
        referenceInstant: new Date(now()).toISOString(), timeZone: "Europe/Dublin", expectedColumnConfig: null });
      if (!tentative) return fail("invalid_input");
      const requestHash = createHash("sha256").update(stable(request)).digest("hex");
      for (const lane of lanes.values()) {
        if (key(lane.actor) !== key(actor)) continue;
        if (lane.requestId === request.requestId) {
          if (lane.requestHash !== requestHash) return fail("request_conflict");
          if (!lane.invoked && (lane.cancelled || now() >= lane.expiresAt)) return fail("stale_capture");
          return prepared(lane);
        }
        if (lane.executing || lane.reading) return fail("busy");
        if (!lane.receipt && !lane.cancelled && (lane.invoked || now() < lane.expiresAt)) return fail("busy");
        if (lane.invoked && !lane.receipt) return fail("busy");
      }
      for (const [token, lane] of lanes) {
        // Retired identities cannot mint a different original, even for untouched expired/cancelled captures.
        if ((!lane.invoked && (lane.cancelled || now() >= lane.expiresAt)) ||
          (key(lane.actor) === key(actor) && lane.receipt && !lane.executing && !lane.reading)) {
          if (retired.size >= 512) return fail("busy");
          retired.add(`${key(lane.actor)}:${lane.requestId.toLowerCase()}`); lanes.delete(token);
        }
      }
      if (retired.has(requestKey)) return fail("request_conflict");
      if (lanes.size + preparing.size >= 32 || preparing.has(key(actor))) return fail("busy");
      preparing.add(key(actor));
      try {
        const capture = await adapter.transaction("read", async (tx) => {
          if (!await authorized(tx, actor.actorId, request.projectId, true)) return null;
          const raw = (await tx.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [`board:${request.projectId}:columns`] })).rows[0];
          // Typed baseline deliberately uses default system columns, not custom configuration.
          if (raw?.value != null) return null;
          const snapshots: Record<string, PingTypedSnapshot> = {};
          for (const id of tentative.selectedTaskIds) {
            const row = (await tx.execute({ sql: "SELECT * FROM tasks WHERE id=? AND workspace_id=?", args: [id, request.projectId] })).rows[0];
            if (!row || row.archived_at != null || row.parent_task_id != null || row.recurrence != null || Number(row.is_milestone) !== 0 ||
              row.board_column_key != null) return null;
            const actual = snapshot(row);
            if (!sameSnapshot(actual, tentative.snapshots[id] as PingTypedSnapshot)) return null;
            snapshots[id] = actual;
          }
          const normalized = normalizePingCapture({ ...tentative, snapshots });
          return normalized ? { ...normalized, snapshots } : null;
        });
        if (!capture) return fail("stale_capture");
        const bound = bindPingProposal(proposal, capture, { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
        if (!bound.ok) return fail("invalid_input");
        const token = options.token?.() ?? randomBytes(24).toString("base64url");
        if (lanes.has(token)) return fail("temporarily_unavailable");
        const lane: Lane = { token, actor: { ...actor }, requestId: request.requestId, requestHash, generationId: request.generationId,
          capture, original: { command: bound.command, context: bound.context }, proposal: bound.proposal as Lane["proposal"],
          expiresAt: now() + 10_000, invoked: false, cancelled: false, executing: false, reading: false,
          receipt: null, reads: 0, refreshes: 0, lastReadAt: -Infinity };
        lanes.set(token, lane); return prepared(lane);
      } catch { return fail("temporarily_unavailable"); } finally { preparing.delete(key(actor)); }
    }
    if (!exactKeys(value, ["version", "action", "generationId", "token"]) || typeof value.token !== "string" ||
      value.token.length > 128 || !["execute", "cancel", "receipt", "refresh"].includes(String(value.action))) return fail("invalid_input");
    const request = value as unknown as Exclude<PingTypedRequest, PingTypedPrepare>;
    const lane = lanes.get(request.token);
    if (!lane || key(lane.actor) !== key(actor)) return fail("unavailable");
    if (lane.generationId !== request.generationId) return fail("stale_capture");
    if (request.action === "cancel") {
      lane.cancelled = true;
      if (!lane.invoked) return { ok: true, action: "cancel", ...identity(lane), knowledge: "not_invoked" };
      return reconcile(lane, "cancel");
    }
    if (request.action === "execute") {
      if (lane.invoked) return reconcile(lane, "execute");
      if (lane.cancelled || now() >= lane.expiresAt) return fail("stale_capture");
      lane.invoked = true; lane.executing = true;
      try {
        const result = await service.execute(lane.original);
        if (!result.ok) return { ok: true, action: "execute", ...identity(lane), knowledge: "unresolved", detail: "failed" };
        lane.receipt = result.receipt;
        return { ok: true, action: "execute", ...identity(lane), knowledge: "committed", receipt: result.receipt };
      } catch { return { ok: true, action: "execute", ...identity(lane), knowledge: "unresolved", detail: "failed" }; }
      finally { lane.executing = false; }
    }
    if (!lane.invoked) return fail("invalid_input");
    if (request.action === "receipt") return reconcile(lane, "receipt");
    if (lane.cancelled || lane.executing || lane.reading || lane.refreshes >= 3) return fail("busy");
    lane.reading = true; lane.refreshes++; const started = now();
    try {
      const known = await service.getReceiptForCommand(lane.original);
      if (!known.ok || known.state !== "committed") return fail("unavailable");
      lane.receipt = known.receipt;
      const tasks = await adapter.transaction("read", async (tx) => {
        if (!await authorized(tx, actor.actorId, lane.original.command.projectId, false)) return null;
        const reader = drizzle(tx as unknown as Client, { schema });
        return readCanonicalTasks(reader, lane.original.command.projectId);
      });
      if (!tasks) return fail("unavailable");
      if (lane.cancelled || now() - started >= 10_000) return fail("temporarily_unavailable");
      return { ok: true, action: "refresh", ...identity(lane), receipt: known.receipt,
        projection: currentMatches(lane, tasks) ? "matches" : "diverged", tasks: tasks.map(wireTask) };
    } catch { return fail("temporarily_unavailable"); } finally { lane.reading = false; }
  } };
}
