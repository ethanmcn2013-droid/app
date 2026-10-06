import {
  PING_TYPED_ENDPOINT,
  PING_TYPED_VERSION,
  type PingTypedRequest,
  type PingTypedResponse,
  type PingTypedTask,
} from "./typed-contract";
import type { Task } from "@/lib/data";

const ERROR_CODES = new Set([
  "unauthenticated", "unavailable", "invalid_input", "unsupported", "ambiguous",
  "incomplete", "stale_capture", "request_conflict", "busy", "temporarily_unavailable",
]);

export type PingTypedSendResult =
  | Readonly<{ kind: "response"; response: PingTypedResponse }>
  | Readonly<{ kind: "unknown" }>;

export type PingTypedIntentMarker = Readonly<{
  version: "ping.typed.intent.v1";
  generationId: string;
  commandId: string;
  projectId: string;
  token: string;
  phase: "prepared" | "invoking";
}>;

const MARKER_PREFIX = "signal:ping-typed:intent:v1";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validPlanProposal(value: unknown): boolean {
  if (!record(value) || !exactKeys(value, ["version", "outcome", "operation"]) ||
    value.version !== "ping.proposal.v1" || value.outcome !== "plan" || !record(value.operation)) return false;
  const operation = value.operation;
  const expectedKeys = operation.kind === "edit_selected"
    ? ["kind", "effects"]
    : operation.kind === "create_placeholders"
      ? Object.hasOwn(operation, "title") ? ["kind", "count", "effects", "title"] : ["kind", "count", "effects"]
      : null;
  if (!expectedKeys || !exactKeys(operation, expectedKeys) || !record(operation.effects) ||
    Object.keys(operation.effects).some((key) => !["selfAssignment", "dueDate", "statusColumnKey"].includes(key))) return false;
  const effects = operation.effects;
  if (Object.hasOwn(effects, "selfAssignment") && !["add", "remove"].includes(String(effects.selfAssignment))) return false;
  if (Object.hasOwn(effects, "dueDate") && effects.dueDate !== null && typeof effects.dueDate !== "string") return false;
  if (Object.hasOwn(effects, "statusColumnKey") && !["todo", "doing", "review", "done"].includes(String(effects.statusColumnKey))) return false;
  if (operation.kind === "create_placeholders" && (!Number.isInteger(operation.count) ||
    Number(operation.count) < 1 || Number(operation.count) > 10 ||
    (Object.hasOwn(operation, "title") && typeof operation.title !== "string"))) return false;
  return true;
}

function validReceipt(value: unknown, commandId: string, projectId: string): boolean {
  if (!record(value) || !exactKeys(value, [
    "version", "commandId", "projectId", "committedAtSeconds", "outcome", "affectedCount", "changedCount", "effects",
  ])) return false;
  if (value.version !== "ping.receipt.v1" || value.commandId !== commandId || value.projectId !== projectId ||
    !Number.isSafeInteger(value.committedAtSeconds) || Number(value.committedAtSeconds) < 0 || Number(value.committedAtSeconds) > 8_640_000_000_000 ||
    (value.outcome !== "completed" && value.outcome !== "no_changes") ||
    !Number.isSafeInteger(value.affectedCount) || !Number.isSafeInteger(value.changedCount) ||
    Number(value.affectedCount) < 0 || Number(value.affectedCount) > 10 || Number(value.changedCount) < 0 ||
    Number(value.changedCount) > Number(value.affectedCount) || !Array.isArray(value.effects) ||
    value.effects.length !== value.affectedCount || value.outcome === "no_changes" && value.changedCount !== 0 ||
    value.outcome === "completed" && value.changedCount === 0) return false;
  const taskIds = new Set<string>();
  let changedRows = 0;
  for (const effect of value.effects) {
    if (!record(effect) || !Object.hasOwn(effect, "taskId") || !Object.hasOwn(effect, "changedFields") ||
      Object.keys(effect).some((key) => !["taskId", "changedFields", "seq"].includes(key))) return false;
    if (typeof effect.taskId !== "string" || !effect.taskId || taskIds.has(effect.taskId) ||
      !Array.isArray(effect.changedFields) ||
      !effect.changedFields.every((field) => ["created", "assignees", "due", "dueAt", "startDay", "durationDays", "lane", "boardColumnKey", "completedAt"].includes(String(field))) ||
      new Set(effect.changedFields).size !== effect.changedFields.length ||
      effect.seq !== undefined && (!Number.isSafeInteger(effect.seq) || Number(effect.seq) < 1) ||
      effect.changedFields.includes("created") && effect.seq === undefined) return false;
    if (effect.changedFields.length > 0) changedRows += 1;
    taskIds.add(effect.taskId);
  }
  return changedRows === value.changedCount;
}

/** Decode only the frozen response variants; an unrecognized body stays uncertain. */
export function decodePingTypedResponse(value: unknown): PingTypedResponse | null {
  if (!record(value)) return null;
  if (value.ok === false) {
    return exactKeys(value, ["ok", "code"]) && typeof value.code === "string" && ERROR_CODES.has(value.code)
      ? value as PingTypedResponse
      : null;
  }
  if (value.ok !== true || typeof value.generationId !== "string" || typeof value.commandId !== "string" ||
    typeof value.projectId !== "string" || typeof value.action !== "string") return null;

  if (value.action === "prepare") {
    if (!exactKeys(value, ["ok", "action", "generationId", "commandId", "projectId", "token", "expiresAt", "proposal"]) ||
      typeof value.token !== "string" || value.token.length === 0 || !Number.isFinite(value.expiresAt) || !validPlanProposal(value.proposal)) return null;
    return value as PingTypedResponse;
  }
  if (value.action === "refresh") {
    if (!exactKeys(value, ["ok", "action", "generationId", "commandId", "projectId", "receipt", "projection", "tasks"]) ||
      (value.projection !== "matches" && value.projection !== "diverged") || !Array.isArray(value.tasks) ||
      !validReceipt(value.receipt, value.commandId, value.projectId)) return null;
    return value as PingTypedResponse;
  }
  if (value.action === "execute" || value.action === "receipt" || value.action === "cancel") {
    if (value.knowledge === "committed") {
      if (!exactKeys(value, ["ok", "action", "generationId", "commandId", "projectId", "knowledge", "receipt"]) ||
        !validReceipt(value.receipt, value.commandId, value.projectId)) return null;
      return value as PingTypedResponse;
    }
    if (value.knowledge === "unresolved") {
      if (!exactKeys(value, ["ok", "action", "generationId", "commandId", "projectId", "knowledge", "detail"]) ||
        !["pending", "absent", "failed"].includes(String(value.detail))) return null;
      return value as PingTypedResponse;
    }
    if (value.action === "cancel" && value.knowledge === "not_invoked" &&
      exactKeys(value, ["ok", "action", "generationId", "commandId", "projectId", "knowledge"])) return value as PingTypedResponse;
  }
  return null;
}

/** Check that a decoded response still belongs to the request that received it. */
export function pingTypedResponseMatches(response: PingTypedResponse, request: PingTypedRequest, projectId: string): boolean {
  if (!response.ok) return false;
  return response.generationId === request.generationId && response.projectId === projectId && response.action === request.action;
}

function asDate(value: unknown, nullable = false): Date | null | undefined {
  if (value === undefined) return undefined;
  if (nullable && value === null) return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? parsed : undefined;
}

/** Decode API date strings before authoritative TasksProvider hydration. */
export function restorePingTypedTasks(value: readonly PingTypedTask[], projectId: string): Task[] | null {
  if (!Array.isArray(value)) return null;
  const tasks: Task[] = [];
  for (const raw of value as readonly unknown[]) {
    if (!record(raw) || typeof raw.id !== "string" || raw.workspaceId !== projectId || typeof raw.title !== "string" ||
      !["todo", "doing", "review", "done"].includes(String(raw.lane)) ||
      !["p0", "p1", "p2", "p3"].includes(String(raw.priority)) || !Array.isArray(raw.assignees) ||
      !raw.assignees.every((id) => typeof id === "string") || raw.parentTaskId !== null && typeof raw.parentTaskId !== "string") return null;
    const updatedAt = asDate(raw.updatedAt);
    const dueAt = asDate(raw.dueAt);
    const archivedAt = asDate(raw.archivedAt, true);
    const completedAt = asDate(raw.completedAt, true);
    if (!updatedAt || raw.dueAt !== undefined && !dueAt || raw.archivedAt !== undefined && archivedAt === undefined ||
      raw.completedAt !== undefined && completedAt === undefined) return null;
    tasks.push({ ...raw, updatedAt, ...(dueAt ? { dueAt } : {}), ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}) } as Task);
  }
  return tasks;
}

/** Same-origin, non-cached POST. Network, status, or schema uncertainty never becomes "no changes." */
export async function sendPingTyped(
  request: PingTypedRequest,
  fetcher: typeof fetch = fetch,
): Promise<PingTypedSendResult> {
  try {
    const response = await fetcher(PING_TYPED_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
    });
    const decoded = decodePingTypedResponse(await response.json());
    return decoded ? { kind: "response", response: decoded } : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

export function pingIntentStorageKey(actorId: string, projectId: string): string {
  return `${MARKER_PREFIX}:${encodeURIComponent(actorId)}:${encodeURIComponent(projectId)}`;
}

function validMarker(value: unknown, actorProjectId: string): value is PingTypedIntentMarker {
  return record(value) && exactKeys(value, ["version", "generationId", "commandId", "projectId", "token", "phase"]) &&
    value.version === "ping.typed.intent.v1" && typeof value.generationId === "string" &&
    typeof value.commandId === "string" && value.projectId === actorProjectId && typeof value.token === "string" &&
    value.token.length > 0 && (value.phase === "prepared" || value.phase === "invoking");
}

/** Stores only the opaque original handle and scope; never the typed text or operation payload. */
export function writePingIntentMarker(
  storage: Pick<Storage, "setItem">,
  actorId: string,
  marker: PingTypedIntentMarker,
): boolean {
  try {
    storage.setItem(pingIntentStorageKey(actorId, marker.projectId), JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}

export function readPingIntentMarker(
  storage: Pick<Storage, "getItem">,
  actorId: string,
  projectId: string,
): PingTypedIntentMarker | null {
  try {
    const raw = storage.getItem(pingIntentStorageKey(actorId, projectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validMarker(parsed, projectId) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPingIntentMarker(
  storage: Pick<Storage, "removeItem">,
  actorId: string,
  projectId: string,
): void {
  try { storage.removeItem(pingIntentStorageKey(actorId, projectId)); } catch { /* storage may be unavailable */ }
}

export function updatePingIntentPhase(
  storage: Pick<Storage, "setItem">,
  actorId: string,
  marker: PingTypedIntentMarker,
  phase: PingTypedIntentMarker["phase"],
): boolean {
  return writePingIntentMarker(storage, actorId, { ...marker, phase });
}

export const PING_TYPED_WIRE = Object.freeze({ version: PING_TYPED_VERSION, endpoint: PING_TYPED_ENDPOINT });
