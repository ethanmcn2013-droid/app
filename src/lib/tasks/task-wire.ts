import type { Recurrence, Task } from "@/lib/data";

export const TASKS_WIRE_VERSION = 1 as const;

const DATE_FIELDS = ["dueAt", "archivedAt", "updatedAt", "completedAt"] as const;
type TaskDateField = (typeof DATE_FIELDS)[number];
type TaskPayload = Omit<Task, TaskDateField> & Record<string, unknown>;

type DateWireState =
  | { state: "absent" }
  | { state: "undefined" }
  | { state: "null" }
  | { state: "date"; value: string };

type TaskWireRow = {
  data: TaskPayload;
  dates: Record<TaskDateField, DateWireState>;
};

export type TasksWireEnvelope = {
  version: typeof TASKS_WIRE_VERSION;
  tasks: TaskWireRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors))
    : Object.values(value).every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecurrence(value: unknown): value is Recurrence {
  if (!isRecord(value)) return false;
  if (value.kind === "weekly" || value.kind === "monthly-first-weekday") {
    return Number.isInteger(value.weekday) && Number(value.weekday) >= 0 && Number(value.weekday) <= 6;
  }
  return value.kind === "monthly-day" && Number.isFinite(value.day);
}

function isTaskPayload(value: unknown): value is TaskPayload {
  if (!isRecord(value)) return false;
  if (DATE_FIELDS.some((field) => Object.hasOwn(value, field))) return false;

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !(value.lane === "todo" || value.lane === "doing" || value.lane === "review" || value.lane === "done") ||
    !(value.priority === "p0" || value.priority === "p1" || value.priority === "p2" || value.priority === "p3") ||
    !isStringArray(value.assignees) ||
    !(value.parentTaskId === null || typeof value.parentTaskId === "string") ||
    !isNullableString(value.externalContactName) ||
    !isNullableString(value.externalContactEmail) ||
    !(value.cents === null || Number.isFinite(value.cents))
  ) return false;

  const stringFields = ["description", "due"] as const;
  if (stringFields.some((field) => Object.hasOwn(value, field) && typeof value[field] !== "string")) return false;

  const numberFields = ["seq", "estimate", "comments", "subtaskCount", "subtaskDone", "idleDays", "startDay", "durationDays", "position"] as const;
  if (numberFields.some((field) => Object.hasOwn(value, field) && !(value[field] === null && field === "seq") && !Number.isFinite(value[field]))) return false;

  const stringArrayFields = ["tags", "blockedBy"] as const;
  if (stringArrayFields.some((field) => Object.hasOwn(value, field) && !isStringArray(value[field]))) return false;

  if (Object.hasOwn(value, "workspaceId") && !isNullableString(value.workspaceId)) return false;
  if (Object.hasOwn(value, "isMilestone") && typeof value.isMilestone !== "boolean") return false;
  if (Object.hasOwn(value, "boardColumnKey") && !isNullableString(value.boardColumnKey)) return false;
  if (Object.hasOwn(value, "sourceNoteId") && !isNullableString(value.sourceNoteId)) return false;
  if (Object.hasOwn(value, "sourceNoteExtractBody") && !isNullableString(value.sourceNoteExtractBody)) return false;
  if (Object.hasOwn(value, "recurrence") && !isRecurrence(value.recurrence)) return false;

  return Object.values(value).every((item) => item === undefined || isJsonValue(item));
}

function dateToWireState(task: Task, field: TaskDateField): DateWireState {
  if (!Object.hasOwn(task, field)) return { state: "absent" };
  const value = task[field];
  if (value === undefined) return { state: "undefined" };
  if (value === null) {
    if (field === "archivedAt" || field === "completedAt") return { state: "null" };
    throw new Error(`Invalid task date field: ${field}`);
  }
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`Invalid task date field: ${field}`);
  }
  return { state: "date", value: value.toISOString() };
}

function taskPayload(task: Task): TaskPayload {
  const data: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(task)) {
    if ((DATE_FIELDS as readonly string[]).includes(key) || value === undefined) continue;
    if (!isJsonValue(value)) throw new Error(`Invalid task metadata: ${key}`);
    data[key] = value;
  }
  if (!isTaskPayload(data)) throw new Error("Invalid task payload.");
  return data;
}

/** Encode the full authenticated Task shape without imposing a row-count cap. */
export function encodeTasksResponse(tasks: readonly Task[]): TasksWireEnvelope {
  return {
    version: TASKS_WIRE_VERSION,
    tasks: tasks.map((task) => {
      const dates: TaskWireRow["dates"] = {
        dueAt: dateToWireState(task, "dueAt"),
        archivedAt: dateToWireState(task, "archivedAt"),
        updatedAt: dateToWireState(task, "updatedAt"),
        completedAt: dateToWireState(task, "completedAt"),
      };
      if (dates.updatedAt.state !== "date") throw new Error("Invalid updatedAt task date.");
      return { data: taskPayload(task), dates };
    }),
  };
}

function readDateState(value: unknown): DateWireState {
  if (!isRecord(value) || typeof value.state !== "string") throw new Error("Invalid task date state.");
  if (value.state === "absent" || value.state === "undefined" || value.state === "null") {
    if (Object.keys(value).length !== 1) throw new Error("Invalid task date state.");
    return { state: value.state };
  }
  if (value.state !== "date" || Object.keys(value).length !== 2 || typeof value.value !== "string") {
    throw new Error("Invalid task date state.");
  }
  const date = new Date(value.value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.value) {
    throw new Error("Invalid task date.");
  }
  return { state: "date", value: value.value };
}

function readDateStates(value: unknown): Record<TaskDateField, DateWireState> {
  if (!isRecord(value) || Object.keys(value).length !== DATE_FIELDS.length) throw new Error("Invalid task date fields.");
  for (const field of DATE_FIELDS) {
    if (!Object.hasOwn(value, field)) throw new Error("Invalid task date fields.");
  }
  const dates: Record<TaskDateField, DateWireState> = {
    dueAt: readDateState(value.dueAt),
    archivedAt: readDateState(value.archivedAt),
    updatedAt: readDateState(value.updatedAt),
    completedAt: readDateState(value.completedAt),
  };
  if (dates.updatedAt.state !== "date") throw new Error("Invalid updatedAt task date.");
  if (dates.dueAt.state === "null") throw new Error("Invalid dueAt task date.");
  return dates;
}

function applyOptionalDate(task: Task, field: "dueAt", state: DateWireState): void;
function applyOptionalDate(task: Task, field: "archivedAt" | "completedAt", state: DateWireState): void;
function applyOptionalDate(task: Task, field: "dueAt" | "archivedAt" | "completedAt", state: DateWireState): void {
  if (state.state === "absent") return;
  if (state.state === "undefined") {
    task[field] = undefined;
    return;
  }
  if (state.state === "null") {
    if (field === "dueAt") throw new Error("Invalid dueAt task date.");
    task[field] = null;
    return;
  }
  task[field] = new Date(state.value);
}

/** Decode and validate an untrusted, versioned task response envelope. */
export function decodeTasksResponse(value: unknown): Task[] {
  if (!isRecord(value) || value.version !== TASKS_WIRE_VERSION || !Array.isArray(value.tasks)) {
    throw new Error("Invalid task response envelope.");
  }
  return value.tasks.map((row): Task => {
    if (!isRecord(row) || !isTaskPayload(row.data)) throw new Error("Invalid task response row.");
    const dates = readDateStates(row.dates);
    const updatedAt = dates.updatedAt;
    if (updatedAt.state !== "date") throw new Error("Invalid updatedAt task date.");
    const task: Task = { ...row.data, updatedAt: new Date(updatedAt.value) };
    applyOptionalDate(task, "dueAt", dates.dueAt);
    applyOptionalDate(task, "archivedAt", dates.archivedAt);
    applyOptionalDate(task, "completedAt", dates.completedAt);
    return task;
  });
}
