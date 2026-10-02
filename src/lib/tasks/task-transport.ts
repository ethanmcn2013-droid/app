import type { Task } from "@/lib/data";
import { decodeTasksResponse } from "./task-wire";

const ENDPOINT = "/api/tasks/mutate";
const VERSION = 1;

export type TaskCreateInput = {
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
};

export type TaskEditPatch = Omit<Partial<Omit<Task, "id">>, "description" | "due" | "dueAt" | "estimate" | "tags" | "idleDays" | "blockedBy" | "recurrence" | "startDay" | "durationDays" | "position"> & {
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

export class TaskMutationRefusedError extends Error {
  constructor() {
    super("Task change was refused.");
    this.name = "TaskMutationRefusedError";
  }
}

export class TaskMutationRequestRejectedError extends Error {
  constructor() {
    super("Task request was rejected.");
    this.name = "TaskMutationRequestRejectedError";
  }
}

/** The server may have committed; callers must not replay this operation. */
export class TaskMutationOutcomeUnknownError extends Error {
  constructor() {
    super("Task change outcome is unknown. Refresh task data before continuing.");
    this.name = "TaskMutationOutcomeUnknownError";
  }
}

export class TaskSnapshotUnavailableError extends Error {
  constructor() {
    super("Tasks are unavailable.");
    this.name = "TaskSnapshotUnavailableError";
  }
}

function validProjectId(projectId: string): void {
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new TaskMutationRequestRejectedError();
  }
}

function dateForWire(value: Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TaskMutationRequestRejectedError();
  }
  return value.toISOString();
}

function requestBody(operation: string, projectId: string, extra: object): string {
  return JSON.stringify({ version: VERSION, operation, projectId, ...extra });
}

async function post(body: string, expectedStatus: "snapshot" | "applied"): Promise<Response> {
  try {
    return await fetch(ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    if (expectedStatus === "snapshot") throw new TaskSnapshotUnavailableError();
    throw new TaskMutationOutcomeUnknownError();
  }
}

function rejectedBeforeDispatch(status: number): boolean {
  return status === 400 || status === 403 || status === 405 || status === 413 || status === 415;
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

async function readErrorCode(response: Response): Promise<string | null> {
  if (!isJsonResponse(response)) return null;
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || record.version !== VERSION || typeof record.error !== "string") return null;
    return record.error;
  } catch {
    return null;
  }
}

async function readResponse(response: Response, expectedStatus: "snapshot" | "applied", expectedProjectId: string): Promise<Task[]> {
  if (!response.ok) {
    if (expectedStatus === "snapshot") throw new TaskSnapshotUnavailableError();
    const errorCode = await readErrorCode(response);
    if (response.status === 409 && errorCode === "mutation_refused") throw new TaskMutationRefusedError();
    if (rejectedBeforeDispatch(response.status) && errorCode === "request_rejected") {
      throw new TaskMutationRequestRejectedError();
    }
    throw new TaskMutationOutcomeUnknownError();
  }

  try {
    if (!isJsonResponse(response)) throw new Error();
    const envelope: unknown = await response.json();
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error();
    const record = envelope as Record<string, unknown>;
    if (record.status !== expectedStatus || record.scopeProjectId !== expectedProjectId) throw new Error();
    return decodeTasksResponse(record);
  } catch {
    if (expectedStatus === "snapshot") throw new TaskSnapshotUnavailableError();
    throw new TaskMutationOutcomeUnknownError();
  }
}

export async function readTaskSnapshot(projectId: string): Promise<Task[]> {
  validProjectId(projectId);
  const response = await post(requestBody("snapshot", projectId, {}), "snapshot");
  return readResponse(response, "snapshot", projectId);
}

export async function createTask(input: TaskCreateInput, projectId: string): Promise<Task[]> {
  validProjectId(projectId);
  const bodyInput = { ...input, ...(input.dueAt === undefined ? {} : { dueAt: dateForWire(input.dueAt) }) };
  const response = await post(requestBody("create", projectId, { input: bodyInput }), "applied");
  return readResponse(response, "applied", projectId);
}

export async function editTask(id: string, patch: TaskEditPatch, projectId: string): Promise<Task[]> {
  validProjectId(projectId);
  if (typeof id !== "string" || id.length === 0) throw new TaskMutationRequestRejectedError();
  const patchKeys = Object.keys(patch);
  const wirePatch: Record<string, unknown> = Object.create(null);
  for (const key of patchKeys) {
    const value = patch[key as keyof TaskEditPatch];
    if (value === undefined) continue;
    if (key === "dueAt") {
      wirePatch[key] = value === null ? null : dateForWire(value as Date | undefined);
    } else {
      wirePatch[key] = value;
    }
  }
  const response = await post(requestBody("edit", projectId, { id, patchKeys, patch: wirePatch }), "applied");
  return readResponse(response, "applied", projectId);
}

export async function toggleTaskComplete(id: string, projectId: string): Promise<Task[]> {
  validProjectId(projectId);
  if (typeof id !== "string" || id.length === 0) throw new TaskMutationRequestRejectedError();
  const response = await post(requestBody("toggleComplete", projectId, { id }), "applied");
  return readResponse(response, "applied", projectId);
}
