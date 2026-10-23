import type { AssistantSource, AssistantSourceScope, AssistantCitation, AssistantVisibleCitation, AssistantPlanEdit, AssistantMemoryTurn, AssistantReversal, AssistantUndoResult } from './release2';
/** Shared text-first intent and result contract. Models never provide authority or internal IDs. */
export const ASSISTANT_VERSION = "ping.assistant.v1" as const;
export const ASSISTANT_LIMITS = Object.freeze({ actions: 20, tasksPerCreate: 100, taskEffects: 500, text: 16000, recipients: 20 });

export type AssistantScope = Readonly<{ kind: "account" }> | Readonly<{ kind: "project"; projectId: string }>;
export type AssistantRequest = Readonly<{
  requestId: string; text: string; scope: AssistantScope; mode: "execute" | "draft"; selectedTaskIds?: readonly string[];
  source?: AssistantSourceScope; replyToRunId?: string;
}>;
export type AssistantProjectRef = Readonly<{ kind: "current" }> | Readonly<{ kind: "name"; name: string }> |
  Readonly<{ kind: "created"; stepId: string }>;
export type AssistantMemberRef = Readonly<{ kind: "self" }> | Readonly<{ kind: "name"; name: string }>;
export type AssistantStatus = "todo" | "doing" | "review" | "done";
/** Absolute calendar day, today/tomorrow, or a named next weekday. Resolved against a server reference day. */
export type AssistantDate = string | null;
export type AssistantTaskSelector = Readonly<{ kind: "selected" }> |
  Readonly<{ kind: "titles"; titles: readonly string[] }> |
  Readonly<{ kind: "created"; stepId: string; limit?: number }> |
  Readonly<{ kind: "previous"; limit?: number }> |
  Readonly<{ kind: "all"; status?: AssistantStatus; limit?: number }>;
export type AssistantTaskFields = Readonly<{
  title?: string; description?: string; assignees?: readonly AssistantMemberRef[]; dueDate?: AssistantDate;
  status?: AssistantStatus; milestone?: boolean; dueTime?: string | null;
}>;
export type AssistantTaskDraft = AssistantTaskFields & Readonly<{ title: string }>;
export type AssistantTaskTemplate = Omit<AssistantTaskFields, "title"> & Readonly<{
  count: number; titlePrefix: string; distribution?: "all" | "round_robin"; milestoneCount?: number;
}>;
type Step = Readonly<{ id: string }>;
type ProjectStep = Step & Readonly<{ project: AssistantProjectRef }>;
export type AssistantAction =
  | Step & Readonly<{ kind: "create_project"; name: string; description?: string }>
  | ProjectStep & Readonly<{ kind: "create_tasks"; tasks: readonly AssistantTaskDraft[]; template?: never }>
  | ProjectStep & Readonly<{ kind: "create_tasks"; template: AssistantTaskTemplate; tasks?: never }>
  | ProjectStep & Readonly<{ kind: "update_tasks"; targets: AssistantTaskSelector; changes: AssistantTaskFields }>
  | ProjectStep & Readonly<{ kind: "archive_project"; archived: boolean }>
  | Step & Readonly<{ kind: "create_drive_subfolder"; project: Exclude<AssistantProjectRef, { kind: "created" }>; folderName: string }>
  | ProjectStep & Readonly<{ kind: "archive_tasks"; targets: AssistantTaskSelector; archived: boolean }>
  | ProjectStep & Readonly<{ kind: "add_comment"; targets: AssistantTaskSelector; body: string }>
  | ProjectStep & Readonly<{ kind: "nudge_tasks"; targets: AssistantTaskSelector }>
  | ProjectStep & Readonly<{ kind: "invite_members"; emails: readonly string[] }>
  | ProjectStep & Readonly<{ kind: "send_message"; body: string; mentions?: readonly AssistantMemberRef[]; recipient?:AssistantMemberRef }>
  | ProjectStep & Readonly<{ kind: "set_checklist_item"; parent: AssistantTaskSelector; itemTitle: string; completed: boolean }>
  | ProjectStep & Readonly<{ kind: "create_checklist_items"; parent: AssistantTaskSelector; items: readonly string[] }>
  | ProjectStep & Readonly<{ kind: "open_project" | "open_chat" | "read_timeline" | "preview_timeline" }>
  | ProjectStep & Readonly<{ kind: "read_chat"; limit?: number }>
  | ProjectStep & Readonly<{ kind: "list_tasks"; status?: AssistantStatus; limit?: number }>;
export type AssistantPlan = Readonly<{ version: typeof ASSISTANT_VERSION; outcome: "plan"; mode: "execute" | "draft"; actions: readonly AssistantAction[] }> |
  Readonly<{ version: typeof ASSISTANT_VERSION; outcome: 'answer'; message: string; citations: readonly AssistantCitation[];basis?:Readonly<{kind:'waiting_plan';stepIds:readonly string[]}> }> |
  Readonly<{ version: typeof ASSISTANT_VERSION; outcome: 'edit'; edits: readonly AssistantPlanEdit[] }> |
  Readonly<{ version: typeof ASSISTANT_VERSION; outcome: "clarification" | "unsupported"; message: string }>;
export type AssistantPlannerContext = Readonly<{
  actorName: string; projectName: string | null; projects: readonly Readonly<{ name: string; archived?: boolean; canManageProject?: boolean; driveFolder?: "configured" | "unavailable" }>[];
  members: readonly Readonly<{ name: string }>[]; selectedTaskCount: number; previousTaskCount: number;
  referenceDate: string; timeZone: string;
  sources?: readonly AssistantSource[]; memory?: readonly AssistantMemoryTurn[];
  waitingPlan?: readonly AssistantAction[];
  needsYou?: readonly Readonly<{ref:string;projectName:string;unseen:boolean;createdAt:string}>[];
  tasks?: readonly Readonly<{title:string;projectName:string;description?:string;assignees:readonly string[];dueDate:string|null;dueTime:string|null;status:string;parentTitle:string|null}>[];
  coverage?:string;
  needsYouTotal?:number; needsYouComplete?:boolean;
  /** Display-only identity for the exact conversation or discussion Ping was invoked in. */
  selectedSource?:Readonly<{kind:'conversation'|'task_discussion';label:string;participants?:readonly string[]}>;
  /** `not_checked` and `unavailable` must never be described as an empty list. */
  needsYouState?:'checked'|'not_checked'|'unavailable';
}>;
export type AssistantResultItem = Readonly<{ id: string; title: string; detail?: string; href?: string }>;
export type AssistantActionResult = Readonly<{
  stepId: string; kind: AssistantAction["kind"]; status: "completed" | "blocked" | "failed" | "unknown" | "cancelled";
  summary: string; affectedCount: number; projectId?: string; createdProjectId?: string; createdProjectName?: string; createdTaskIds?: readonly string[];
  taskIds?: readonly string[]; href?: string; items?: readonly AssistantResultItem[];
  delivery?: Readonly<{ queued: number; accepted: number; unknown: number; suppressed: number }>;
  undo?: Readonly<{ projectId: string; taskIds: readonly string[]; archived: boolean }>;
  reversal?: AssistantReversal;
  undoResult?: AssistantUndoResult;
  code?: string;
}>;
export type AssistantRunStatus = "planning" | "ready" | "running" | "completed" | "partial" | "clarification" | "failed" | "cancelled" | "unknown";
export type AssistantStepStatus = "queued" | "running" | "completed" | "blocked" | "failed" | "unknown" | "cancelled";
export type AssistantStepView = Readonly<{ id: string; actionId: string; kind: AssistantAction["kind"]; status: AssistantStepStatus; result: AssistantActionResult | null; plan?:AssistantAction; canUndo?:boolean; undoResult?:AssistantUndoResult }>;
export type AssistantRunView = Readonly<{
  id: string; requestId: string; text: string; scope: AssistantScope; mode: "execute" | "draft";
  status: AssistantRunStatus; message?: string; steps: readonly AssistantStepView[]; createdAt: string; updatedAt: string;
  timing?: Readonly<{ planningMs?: number; executionMs?: number; totalMs?: number }>;
  model?: string; estimatedCostMicrousd?: number;
  citations?: readonly AssistantVisibleCitation[]; planRevision?:number; replyToRunId?:string; source?:AssistantSourceScope; accessUnavailable?:boolean;
}>;
export type AssistantApiCommand = Readonly<{ operation: "submit"; request: AssistantRequest }> |
  Readonly<{ operation: 'undo'; runId:string; stepId:string }> |
  Readonly<{ operation: "resume" | "cancel" | "apply"; runId: string }>;
export type AssistantApiResponse = Readonly<{
  version: typeof ASSISTANT_VERSION; ok: true; available: boolean; run?: AssistantRunView; runs?: readonly AssistantRunView[];
}> | Readonly<{ version: typeof ASSISTANT_VERSION; ok: false; code: string; message: string }>;

type Schema = Readonly<Record<string, unknown>>;
const string = (max = 240, min = 1): Schema => ({ type: "string", minLength: min, maxLength: max });
const integer = (max: number, min = 1): Schema => ({ type: "integer", minimum: min, maximum: max });
const enumeration = (...values: readonly string[]): Schema => ({ type: "string", enum: values });
const object = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: "object", properties, required, additionalProperties: false });
const array = (items: Schema, max: number, min = 0): Schema => ({ type: "array", items, minItems: min, maxItems: max });
const either = (...schemas: Schema[]): Schema => ({ anyOf: schemas });
const literal = (value: string): Schema => enumeration(value);
const stepId: Schema = { ...string(32), pattern: "^[a-zA-Z][a-zA-Z0-9_-]*$" };
const project = either(object({ kind: literal("current") }), object({ kind: literal("name"), name: string() }), object({ kind: literal("created"), stepId }));
const member = either(object({ kind: literal("self") }), object({ kind: literal("name"), name: string(120) }));
const status = enumeration("todo", "doing", "review", "done");
const date = either({ type: "null" }, { ...string(16), pattern: "^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|today|tomorrow|(?:next_)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))$" });
const selector = either(object({ kind: literal("selected") }), object({ kind: literal("titles"), titles: array(string(), 100, 1) }),
  object({ kind: literal("created"), stepId, limit: integer(500) }, ["kind", "stepId"]),
  object({ kind: literal("previous"), limit: integer(500) }, ["kind"]),
  object({ kind: literal("all"), status, limit: integer(500) }, ["kind"]));
const time = either({type:'null'}, {...string(5),pattern:'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'});
const fields = { title: string(), description: string(2000, 0), assignees: array(member, 20), dueDate: date, status, milestone: { type: "boolean" }, dueTime:time };
const task = object(fields, ["title"]);
const template = object({ count: integer(100), titlePrefix: string(), description: fields.description, assignees: fields.assignees,
  dueDate: date, dueTime:time, status, milestone: fields.milestone, distribution: enumeration("all", "round_robin"), milestoneCount: integer(100, 0) }, ["count", "titlePrefix"]);
const action = (kind: string, properties: Record<string, Schema>, required?: string[]): Schema => object({ id: stepId, kind: literal(kind), ...properties }, ["id", "kind", ...(required ?? Object.keys(properties))]);
export const ASSISTANT_ACTION_SCHEMA: Schema = either(
  action("create_project", { name: string(), description: string(2000, 0) }, ["name"]),
  action("create_tasks", { project, tasks: array(task, 100, 1) }), action("create_tasks", { project, template }),
  action("update_tasks", { project, targets: selector, changes: object(fields, []) }),
  action("archive_project", { project, archived: { type: "boolean" } }),
  action("create_drive_subfolder", { project: { anyOf: [object({kind:enumeration("current")}), object({kind:enumeration("name"),name:string()})] }, folderName: string(100) }),
  action("archive_tasks", { project, targets: selector, archived: { type: "boolean" } }),
  action("add_comment", { project, targets: selector, body: string(5000) }),
  action("nudge_tasks", { project, targets: selector }),
  action("invite_members", { project, emails: array({ ...string(254), pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" }, 20, 1) }),
  action("send_message", { project, body: string(5000), mentions: array(member, 20),recipient:member }, ["project", "body"]),
  action('set_checklist_item',{project,parent:selector,itemTitle:string(),completed:{type:'boolean'}}),
  action('create_checklist_items',{project,parent:selector,items:array(string(),100,1)}),
  ...["open_project", "open_chat", "read_timeline", "preview_timeline"].map(kind => action(kind, { project })),
  action("read_chat", { project, limit: integer(50) }, ["project"]),
  action("list_tasks", { project, status, limit: integer(100) }, ["project"]),
);
export const ASSISTANT_PLAN_SCHEMA: Schema = either(
  object({ version: literal(ASSISTANT_VERSION), outcome: literal("plan"), mode: enumeration("execute", "draft"), actions: array(ASSISTANT_ACTION_SCHEMA, 20, 1) }),
  object({version:literal(ASSISTANT_VERSION),outcome:literal('answer'),message:string(5000),citations:array(object({ref:string(80),quote:string(2000)}),12),basis:object({kind:literal('waiting_plan'),stepIds:array(string(80),20,1)})},['version','outcome','message','citations']),
  object({version:literal(ASSISTANT_VERSION),outcome:literal('edit'),edits:array(either(object({kind:literal('drop'),stepId,taskTitle:string()},['kind','stepId']),object({kind:literal('task_fields'),stepId,taskTitle:string(),changes:object(fields,[])},['kind','stepId','changes'])),20,1)}),
  object({ version: literal(ASSISTANT_VERSION), outcome: enumeration("clarification", "unsupported"), message: string(1000) }),
);

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.values(Object.getOwnPropertyDescriptors(value)).every(d => Object.hasOwn(d, "value"));
}
/** Deliberately limited to the fixed schema vocabulary above; never accepts an input schema. */
function matches(value: unknown, schema: Schema, depth = 0): boolean {
  if (depth > 24) return false;
  if (Array.isArray(schema.anyOf)) return schema.anyOf.some(s => matches(value, s as Schema, depth + 1));
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case "null": return value === null;
    case "boolean": return typeof value === "boolean";
    case "integer": return Number.isSafeInteger(value) && (value as number) >= (schema.minimum as number) && (value as number) <= (schema.maximum as number);
    case "string": return typeof value === "string" && value.length >= (schema.minLength as number ?? 0) && value.length <= (schema.maxLength as number ?? 100000) &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) && (!(schema.minLength as number) || value.trim().length > 0) && (!schema.pattern || new RegExp(schema.pattern as string, "u").test(value));
    case "array": return Array.isArray(value) && value.length >= (schema.minItems as number) && value.length <= (schema.maxItems as number) && value.every(v => matches(v, schema.items as Schema, depth + 1));
    case "object": {
      if (!record(value)) return false;
      const properties = schema.properties as Record<string, Schema>;
      return (schema.required as string[]).every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => Object.hasOwn(properties, key) && matches(value[key], properties[key], depth + 1));
    }
    default: return false;
  }
}
function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2199-12-31";
}
export function parseAssistantPlan(value: unknown): AssistantPlan | null {
  try {
    if (!matches(value, ASSISTANT_PLAN_SCHEMA)) return null;
    const plan = value as AssistantPlan;
    if(plan.outcome==='edit' && plan.edits.some(edit=>edit.kind==='task_fields'&&(!Object.keys(edit.changes).length||!validDate(edit.changes.dueDate))))return null;
    if (plan.outcome !== "plan") return structuredClone(plan);
    // Lifecycle plans may batch distinct Projects, but never invalidate sibling task/chat steps.
    if (plan.actions.some(item => item.kind === "archive_project") &&
        plan.actions.some(item => item.kind !== "archive_project" || item.project.kind === "created")) return null;
    if (plan.actions.some(item => item.kind === "create_drive_subfolder" && (item.folderName !== item.folderName.trim() || /[\\/\u0000-\u001f\u007f]/.test(item.folderName) || [".", ".."].includes(item.folderName)))) return null;
    const earlier = new Map<string, AssistantAction>(); let created = 0;
    for (const item of plan.actions) {
      if (earlier.has(item.id)) return null;
      if ("project" in item && item.project.kind === "created" && earlier.get(item.project.stepId)?.kind !== "create_project") return null;
      if ("targets" in item && item.targets.kind === "created" && earlier.get(item.targets.stepId)?.kind !== "create_tasks") return null;
      if ('parent' in item && item.parent.kind==='created' && earlier.get(item.parent.stepId)?.kind!=='create_tasks')return null;
      if (item.kind === "update_tasks" && Object.keys(item.changes).length === 0) return null;
      const taskFields = item.kind === "create_tasks" ? (item.tasks ?? [item.template]) : item.kind === "update_tasks" ? [item.changes] : [];
      if (taskFields.some(fields => !validDate(fields.dueDate))) return null;
      if (item.kind === "create_tasks") {
        const count = item.tasks?.length ?? item.template!.count; created += count;
        if (item.template?.milestoneCount !== undefined && item.template.milestoneCount > count) return null;
      }
      if (created > ASSISTANT_LIMITS.taskEffects) return null;
      earlier.set(item.id, item);
    }
    return structuredClone(plan);
  } catch { return null; }
}

const requestSchema = object({ requestId: { ...string(80), pattern: "^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$" }, text: string(16000),
  scope: either(object({ kind: literal("account") }), object({ kind: literal("project"), projectId: string(160) })),
  mode: enumeration("execute", "draft"), selectedTaskIds: array(string(160), 500), replyToRunId:string(160),
  source:either(object({kind:literal('conversation'),conversationId:string(160),rootId:string(160)},['kind','conversationId']),object({kind:literal('task_discussion'),taskId:string(160)})) }, ["requestId", "text", "scope", "mode"]);
export function parseAssistantRequest(value: unknown): AssistantRequest | null {
  try {
    if (!matches(value, requestSchema)) return null;
    const request = value as AssistantRequest;
    if (request.selectedTaskIds && new Set(request.selectedTaskIds).size !== request.selectedTaskIds.length) return null;
    if (request.scope.kind === "account" && request.selectedTaskIds?.length) return null;
    if(request.source&&request.scope.kind!=='project')return null;
    if(request.replyToRunId&&!/^[A-Za-z0-9_-]{8,160}$/.test(request.replyToRunId))return null;
    return structuredClone(request);
  } catch { return null; }
}
export function parseAssistantApiCommand(value: unknown): AssistantApiCommand | null {
  if (!record(value)) return null;
  if (value.operation === "submit" && Object.keys(value).length === 2) {
    const request = parseAssistantRequest(value.request); return request ? { operation: "submit", request } : null;
  }
  if(value.operation==='undo' && Object.keys(value).length===3 && typeof value.runId==='string' && /^[A-Za-z0-9_-]{8,160}$/.test(value.runId) && typeof value.stepId==='string' && /^[A-Za-z0-9_-]{8,160}$/.test(value.stepId))return {operation:'undo',runId:value.runId,stepId:value.stepId};
  return (value.operation === "resume" || value.operation === "cancel" || value.operation === "apply") && Object.keys(value).length === 2 && typeof value.runId === "string" && /^[A-Za-z0-9_-]{8,160}$/.test(value.runId)
    ? { operation: value.operation, runId: value.runId } : null;
}

export function resolveAssistantDate(value: AssistantDate, referenceDate: string): string | null {
  if (value === null) return null;
  if (!validDate(referenceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error("Invalid reference day");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { if (!validDate(value)) throw new Error("Invalid calendar day"); return value; }
  const day = new Date(`${referenceDate}T12:00:00Z`);
  if (value === "today") return referenceDate;
  if (value === "tomorrow") day.setUTCDate(day.getUTCDate() + 1);
  else {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const target = weekdays.indexOf(value.replace(/^next_/, ""));
    if (target < 0) throw new Error("Invalid relative day");
    let offset = (target - day.getUTCDay() + 7) % 7;
    if (value.startsWith("next_") && offset === 0) offset = 7;
    day.setUTCDate(day.getUTCDate() + offset);
  }
  return day.toISOString().slice(0, 10);
}

export function isAssistantInternalHref(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000 || !value.startsWith("/app/") || /[\\\u0000-\u0020]/u.test(value)) return false;
  try { const url = new URL(value, "https://app.signalstudio.ie"); return url.origin === "https://app.signalstudio.ie" && !url.username && !url.password; } catch { return false; }
}
