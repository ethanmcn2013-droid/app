/** Disposable P1 contract: system columns, top-level non-recurring tasks, Dublin date projection. */
export const PING_COMMAND_VERSION = "ping.command.v1" as const;
export const PING_PROOF_TIME_ZONE = "Europe/Dublin" as const;
export const PING_SYSTEM_COLUMNS = ["todo", "doing", "review", "done"] as const;
export type PingSystemColumn = (typeof PING_SYSTEM_COLUMNS)[number];

export type PingEffects = Readonly<{
  selfAssignment?: "add" | "remove";
  dueDate?: string | null;
  statusColumnKey?: PingSystemColumn;
}>;
export type PingTaskPrecondition = Readonly<{
  assignees?: readonly string[];
  due?: string | null;
  dueAtSeconds?: number | null;
  startDay?: number | null;
  durationDays?: number | null;
  lane?: PingSystemColumn;
  boardColumnKey?: null;
  completedAtSeconds?: number | null;
}>;
export type PingOperation =
  | Readonly<{ kind: "edit_selected"; taskIds: readonly string[]; effects: PingEffects;
      expected: Readonly<Record<string, PingTaskPrecondition>> }>
  | Readonly<{ kind: "create_placeholders"; count: number; title: string; effects: PingEffects }>;
export type PingCommand = Readonly<{
  version: typeof PING_COMMAND_VERSION;
  commandId: string;
  projectId: string;
  referenceInstant: string;
  timeZone: typeof PING_PROOF_TIME_ZONE;
  expectedColumnConfig: string | null;
  operation: PingOperation;
}>;
export type PingValidation =
  | Readonly<{ ok: true; value: PingCommand }>
  | Readonly<{ ok: false; reason: "invalid_command" }>;

export function normalizePingCommandId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function only(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}
export function validPingId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    value.trim() === value && !/[\u0000-\u0020\u007f]/.test(value) && !value.includes("://");
}
function nullableInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value));
}
function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
function column(value: unknown): value is PingSystemColumn {
  return PING_SYSTEM_COLUMNS.includes(value as PingSystemColumn);
}
export function validPingCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T09:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2100;
}
function effects(value: unknown, creating: boolean): PingEffects | null {
  if (!record(value) || !only(value, ["selfAssignment", "dueDate", "statusColumnKey"])) return null;
  const result: { selfAssignment?: "add" | "remove"; dueDate?: string | null; statusColumnKey?: PingSystemColumn } = {};
  if (Object.hasOwn(value, "selfAssignment")) {
    if (value.selfAssignment !== "add" && value.selfAssignment !== "remove") return null;
    if (creating && value.selfAssignment === "remove") return null;
    result.selfAssignment = value.selfAssignment;
  }
  if (Object.hasOwn(value, "dueDate")) {
    if (value.dueDate !== null && !validPingCalendarDate(value.dueDate)) return null;
    result.dueDate = value.dueDate as string | null;
  }
  if (Object.hasOwn(value, "statusColumnKey")) {
    if (!column(value.statusColumnKey)) return null;
    result.statusColumnKey = value.statusColumnKey;
  }
  return creating || Object.keys(result).length > 0 ? result : null;
}
function precondition(value: unknown, effect: PingEffects): PingTaskPrecondition | null {
  if (!record(value) || !only(value, ["assignees", "due", "dueAtSeconds", "startDay", "durationDays",
    "lane", "boardColumnKey", "completedAtSeconds"])) return null;
  const result: Record<string, unknown> = {};
  if (effect.selfAssignment) {
    if (!Array.isArray(value.assignees) || value.assignees.length > 100 ||
      !value.assignees.every(validPingId) || new Set(value.assignees).size !== value.assignees.length) return null;
    result.assignees = [...value.assignees].sort();
  } else if (Object.hasOwn(value, "assignees")) return null;
  if (Object.hasOwn(effect, "dueDate")) {
    if (!nullableString(value.due) || (typeof value.due === "string" && value.due.length > 256) ||
      !nullableInteger(value.dueAtSeconds) || !nullableInteger(value.startDay) ||
      !nullableInteger(value.durationDays)) return null;
    result.due = value.due;
    result.dueAtSeconds = value.dueAtSeconds;
    result.startDay = value.startDay;
    result.durationDays = value.durationDays;
  } else if (["due", "dueAtSeconds", "startDay", "durationDays"].some((key) => Object.hasOwn(value, key))) return null;
  if (effect.statusColumnKey) {
    if (!column(value.lane) || value.boardColumnKey !== null || !nullableInteger(value.completedAtSeconds)) return null;
    result.lane = value.lane;
    result.boardColumnKey = null;
    result.completedAtSeconds = value.completedAtSeconds;
  } else if (["lane", "boardColumnKey", "completedAtSeconds"].some((key) => Object.hasOwn(value, key))) return null;
  return result as PingTaskPrecondition;
}

/** Validates untrusted input. Actor and input-finality authority are intentionally absent. */
export function normalizePingCommand(input: unknown): PingValidation {
  const invalid = { ok: false, reason: "invalid_command" } as const;
  if (!record(input) || !only(input, ["version", "commandId", "projectId", "referenceInstant", "timeZone",
    "expectedColumnConfig", "operation"]) || input.version !== PING_COMMAND_VERSION ||
    normalizePingCommandId(input.commandId) === null ||
    !validPingId(input.projectId) || input.timeZone !== PING_PROOF_TIME_ZONE ||
    typeof input.referenceInstant !== "string" || !Number.isFinite(Date.parse(input.referenceInstant)) ||
    new Date(input.referenceInstant).toISOString() !== input.referenceInstant ||
    !nullableString(input.expectedColumnConfig) || (typeof input.expectedColumnConfig === "string" && input.expectedColumnConfig.length > 32768) ||
    !record(input.operation)) return invalid;
  const operation = input.operation;
  let normalized: PingOperation;
  if (operation.kind === "edit_selected") {
    if (!only(operation, ["kind", "taskIds", "effects", "expected"]) ||
      !Array.isArray(operation.taskIds) || operation.taskIds.length < 1 || operation.taskIds.length > 10 ||
      !operation.taskIds.every(validPingId) || new Set(operation.taskIds).size !== operation.taskIds.length ||
      !record(operation.expected) || Object.keys(operation.expected).length !== operation.taskIds.length) return invalid;
    const effect = effects(operation.effects, false);
    if (!effect) return invalid;
    const expected: Record<string, PingTaskPrecondition> = Object.create(null);
    const taskIds = [...operation.taskIds].sort();
    for (const taskId of taskIds) {
      if (!Object.hasOwn(operation.expected, taskId)) return invalid;
      const value = precondition(operation.expected[taskId], effect);
      if (!value) return invalid;
      expected[taskId] = value;
    }
    normalized = { kind: "edit_selected", taskIds, effects: effect, expected };
  } else if (operation.kind === "create_placeholders") {
    if (!only(operation, ["kind", "count", "title", "effects"]) ||
      typeof operation.count !== "number" || !Number.isInteger(operation.count) || operation.count < 1 || operation.count > 10) return invalid;
    const effect = effects(operation.effects, true);
    const title = Object.hasOwn(operation, "title") ? operation.title : "Untitled task";
    if (!effect || typeof title !== "string" || title.trim().length === 0 || title.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(title)) return invalid;
    // Literal text only. No template expansion or inferred task content.
    normalized = { kind: "create_placeholders", count: operation.count, title, effects: effect };
  } else return invalid;
  return { ok: true, value: { version: PING_COMMAND_VERSION, commandId: normalizePingCommandId(input.commandId)!,
    projectId: input.projectId, referenceInstant: input.referenceInstant, timeZone: PING_PROOF_TIME_ZONE,
    expectedColumnConfig: input.expectedColumnConfig, operation: normalized } };
}

/** Matches the existing Hybrid 09:00Z transport only for the declared Dublin proof. */
export function pingProofDueAtSeconds(date: string | null): number | null {
  if (date === null) return null;
  if (!validPingCalendarDate(date)) throw new Error("invalid_ping_date");
  return Date.parse(`${date}T09:00:00.000Z`) / 1000;
}
