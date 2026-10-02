import "server-only";

import { encodeTasksResponse } from "@/lib/tasks/task-wire";
import type { Task } from "@/lib/data";

const VERSION = 1;
const MAX_BODY_BYTES = 1_048_576;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

const CREATE_FIELDS = new Set([
  "id", "title", "description", "lane", "priority", "assignees", "estimate", "due", "dueAt", "tags",
  "recurrence", "externalContactName", "externalContactEmail", "cents", "parentTaskId",
]);
const PATCH_FIELDS = new Set([
  "title", "description", "lane", "priority", "assignees", "due", "dueAt", "estimate", "tags", "idleDays",
  "blockedBy", "recurrence", "startDay", "durationDays", "position", "externalContactName",
  "externalContactEmail", "cents",
]);

type CreateInput = {
  id?: string;
  title: string;
  description?: string;
  lane?: Task["lane"];
  priority?: Task["priority"];
  assignees?: string[];
  estimate?: number;
  due?: string;
  dueAt?: Date;
  tags?: string[];
  recurrence?: Task["recurrence"];
  externalContactName?: string | null;
  externalContactEmail?: string | null;
  cents?: number | null;
  parentTaskId?: string | null;
  projectId?: string;
};

type EditPatch = Omit<Partial<Omit<Task, "id">>, "description" | "due" | "dueAt" | "estimate" | "tags" | "idleDays" | "blockedBy" | "recurrence" | "startDay" | "durationDays" | "position"> & {
  description?: string | null;
  due?: string | null;
  dueAt?: Date | null;
  estimate?: number | null;
  tags?: string[] | null;
  idleDays?: number | null;
  blockedBy?: string[] | null;
  recurrence?: NonNullable<Task["recurrence"]> | null;
  startDay?: number | null;
  durationDays?: number | null;
  position?: number | null;
};
type Actions = Readonly<{
  read: (projectId: string) => Promise<Task[]>;
  create: (input: CreateInput, expectedProjectId?: string) => Promise<Task[]>;
  edit: (id: string, patch: EditPatch, expectedProjectId?: string) => Promise<Task[]>;
  toggleComplete: (id: string, expectedProjectId?: string) => Promise<Task[]>;
}>;

type RequestShape =
  | { operation: "snapshot"; projectId: string }
  | { operation: "create"; projectId: string; input: CreateInput }
  | { operation: "edit"; projectId: string; id: string; patch: EditPatch }
  | { operation: "toggleComplete"; projectId: string; id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isLane(value: unknown): value is Task["lane"] {
  return value === "todo" || value === "doing" || value === "review" || value === "done";
}

function isPriority(value: unknown): value is Task["priority"] {
  return value === "p0" || value === "p1" || value === "p2" || value === "p3";
}

function isRecurrence(value: unknown): value is NonNullable<Task["recurrence"]> {
  if (!isRecord(value)) return false;
  if (value.kind === "weekly" || value.kind === "monthly-first-weekday") {
    return Number.isInteger(value.weekday) && Number(value.weekday) >= 0 && Number(value.weekday) <= 6;
  }
  return value.kind === "monthly-day" && isFiniteNumber(value.day);
}

function reviveIsoDate(value: unknown): Date | null {
  if (!isString(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? date : null;
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function validateCreateInput(value: unknown): CreateInput | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !CREATE_FIELDS.has(key))) return null;
  if (!isString(value.title)) return null;
  if (Object.hasOwn(value, "id") && !isString(value.id)) return null;
  if (Object.hasOwn(value, "description") && !isString(value.description)) return null;
  if (Object.hasOwn(value, "lane") && !isLane(value.lane)) return null;
  if (Object.hasOwn(value, "priority") && !isPriority(value.priority)) return null;
  if (Object.hasOwn(value, "assignees") && !isStringArray(value.assignees)) return null;
  if (Object.hasOwn(value, "estimate") && !isFiniteNumber(value.estimate)) return null;
  if (Object.hasOwn(value, "due") && !isString(value.due)) return null;
  if (Object.hasOwn(value, "dueAt") && !reviveIsoDate(value.dueAt)) return null;
  if (Object.hasOwn(value, "tags") && !isStringArray(value.tags)) return null;
  if (Object.hasOwn(value, "recurrence") && !isRecurrence(value.recurrence)) return null;
  if (Object.hasOwn(value, "externalContactName") && !(value.externalContactName === null || isString(value.externalContactName))) return null;
  if (Object.hasOwn(value, "externalContactEmail") && !(value.externalContactEmail === null || isString(value.externalContactEmail))) return null;
  if (Object.hasOwn(value, "cents") && !(value.cents === null || isFiniteNumber(value.cents))) return null;
  if (Object.hasOwn(value, "parentTaskId") && !(value.parentTaskId === null || isString(value.parentTaskId))) return null;

  const input: CreateInput = { title: value.title };
  for (const [key, item] of Object.entries(value)) {
    if (key === "title") continue;
    if (key === "dueAt") {
      input.dueAt = reviveIsoDate(item)!;
    } else {
      Object.defineProperty(input, key, { value: item, enumerable: true, configurable: true, writable: true });
    }
  }
  return input;
}

function decodePatch(patchKeysValue: unknown, patchValue: unknown): EditPatch | null {
  if (!Array.isArray(patchKeysValue) || !isRecord(patchValue)) return null;
  const keys = patchKeysValue;
  if (!keys.every((key): key is string => isString(key) && PATCH_FIELDS.has(key))) return null;
  if (new Set(keys).size !== keys.length) return null;
  const keysSet = new Set(keys);
  if (Object.keys(patchValue).some((key) => !keysSet.has(key))) return null;

  const patch: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (!Object.hasOwn(patchValue, key)) {
      Object.defineProperty(patch, key, { value: undefined, enumerable: true, configurable: true, writable: true });
      continue;
    }
    const value = patchValue[key];
    let decoded = value;
    if (key === "title") {
      if (!isString(value)) return null;
    } else if (key === "description" || key === "due") {
      if (!(value === null || isString(value))) return null;
    } else if (key === "lane") {
      if (!isLane(value)) return null;
    } else if (key === "priority") {
      if (!isPriority(value)) return null;
    } else if (key === "assignees") {
      if (!isStringArray(value)) return null;
    } else if (key === "tags" || key === "blockedBy") {
      if (!(value === null || isStringArray(value))) return null;
    } else if (key === "dueAt") {
      if (value === null) {
        Object.defineProperty(patch, key, { value, enumerable: true, configurable: true, writable: true });
        continue;
      }
      const date = reviveIsoDate(value);
      if (!date) return null;
      decoded = date;
    } else if (key === "recurrence") {
      if (!(value === null || isRecurrence(value))) return null;
    } else if (key === "externalContactName" || key === "externalContactEmail") {
      if (!(value === null || isString(value))) return null;
    } else if (key === "cents") {
      if (!(value === null || isFiniteNumber(value))) return null;
    } else if (key === "estimate" || key === "idleDays" || key === "startDay" || key === "durationDays" || key === "position") {
      if (!(value === null || isFiniteNumber(value))) return null;
    } else if (!isFiniteNumber(value)) {
      return null;
    }
    Object.defineProperty(patch, key, { value: decoded, enumerable: true, configurable: true, writable: true });
  }
  return patch as EditPatch;
}

function decodeRequest(value: unknown): RequestShape | null {
  if (!isRecord(value) || value.version !== VERSION || !isNonEmptyString(value.projectId) || !isString(value.operation)) return null;
  if (value.operation === "snapshot") {
    return hasExactKeys(value, ["version", "operation", "projectId"])
      ? { operation: "snapshot", projectId: value.projectId }
      : null;
  }
  if (value.operation === "create") {
    if (!hasExactKeys(value, ["version", "operation", "projectId", "input"])) return null;
    const input = validateCreateInput(value.input);
    return input ? { operation: "create", projectId: value.projectId, input } : null;
  }
  if (value.operation === "edit") {
    if (!hasExactKeys(value, ["version", "operation", "projectId", "id", "patchKeys", "patch"]) || !isNonEmptyString(value.id)) return null;
    const patch = decodePatch(value.patchKeys, value.patch);
    return patch ? { operation: "edit", projectId: value.projectId, id: value.id, patch } : null;
  }
  if (value.operation === "toggleComplete") {
    return hasExactKeys(value, ["version", "operation", "projectId", "id"]) && isNonEmptyString(value.id)
      ? { operation: "toggleComplete", projectId: value.projectId, id: value.id }
      : null;
  }
  return null;
}

function response(tasks: Task[], projectId: string, status: "snapshot" | "applied"): Response {
  return Response.json({ ...encodeTasksResponse(tasks), status, scopeProjectId: projectId }, { headers: PRIVATE_HEADERS });
}

function errorResponse(status: number, code: "request_rejected" | "mutation_refused" | "outcome_unknown" | "snapshot_unavailable"): Response {
  return Response.json({ version: VERSION, error: code }, { status, headers: PRIVATE_HEADERS });
}

/** Parse a strict JSON request and dispatch only to the existing guarded actions. */
export function createTaskMutationHttp(actions: Actions, isKnownRefusal: (error: unknown) => boolean) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.search || url.hash) return errorResponse(405, "request_rejected");
    if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") !== "same-origin") {
      return errorResponse(403, "request_rejected");
    }
    if (request.headers.get("content-type")?.toLowerCase() !== "application/json") {
      return errorResponse(415, "request_rejected");
    }
    const declared = request.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
      return errorResponse(413, "request_rejected");
    }

    let input: RequestShape | null;
    try {
      const text = await readBoundedBody(request);
      if (text === null) return errorResponse(413, "request_rejected");
      input = decodeRequest(JSON.parse(text) as unknown);
    } catch {
      return errorResponse(400, "request_rejected");
    }
    if (!input) return errorResponse(400, "request_rejected");

    if (input.operation === "snapshot") {
      try {
        return response(await actions.read(input.projectId), input.projectId, "snapshot");
      } catch {
        return errorResponse(500, "snapshot_unavailable");
      }
    }

    try {
      let tasks: Task[];
      if (input.operation === "create") {
        tasks = await actions.create({ ...input.input, projectId: input.projectId }, input.projectId);
      } else if (input.operation === "edit") {
        tasks = await actions.edit(input.id, input.patch, input.projectId);
      } else {
        tasks = await actions.toggleComplete(input.id, input.projectId);
      }
      return response(tasks, input.projectId, "applied");
    } catch (error) {
      if (isKnownRefusal(error)) return errorResponse(409, "mutation_refused");
      return errorResponse(500, "outcome_unknown");
    }
  };
}
