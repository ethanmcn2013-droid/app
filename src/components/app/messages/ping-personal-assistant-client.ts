import { createBrowserPingTelemetry, createPingTelemetryRequest, pingTelemetryBegin, pingTelemetryHeaders, pingTelemetryRecord } from "@/lib/ping/telemetry-client";
import type { PingTelemetryRecorder, PingTelemetryEnd, PingTelemetryOutcome } from "@/lib/ping/telemetry";
import { ASSISTANT_VERSION, isAssistantInternalHref, parseAssistantPlan, type AssistantAction, type AssistantApiCommand, type AssistantApiResponse, type AssistantRunView, type AssistantScope, type AssistantStepView, type AssistantStepStatus, type AssistantMemberRef } from "@/lib/ping/assistant/contract";
import type { AssistantSourceScope } from "@/lib/ping/assistant/release2";
import { isAssistantDriveFolderPending } from "@/lib/ping/assistant/drive-folder";
export { isAssistantDriveFolderHref } from "@/lib/ping/assistant/drive-folder";
export type PendingAssistantRequest = Readonly<{ version: 1; requestId: string; runId?: string }>;
const requestId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(value);
const runId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{8,160}$/.test(value);
export const pendingAssistantKey = (actorId: string, source?:AssistantSourceScope) => `signal.ping.assistant.pending.v1:${actorId}${source?`:source:${encodeURIComponent(source.kind==="conversation"?`${source.conversationId}:${source.rootId??"root"}`:source.taskId)}`:""}`;
export function parsePendingAssistantRequest(raw: string | null): PendingAssistantRequest | null {
  try { const value = raw ? JSON.parse(raw) : null;
    return value && value.version === 1 && requestId(value.requestId) &&
      Object.keys(value).every(key => ["version", "requestId", "runId"].includes(key)) &&
      (value.runId === undefined || runId(value.runId)) ? value : null;
  } catch { return null; }
}
export function isAssistantScope(value: unknown): value is AssistantScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Record<string, unknown>;
  return scope.kind === "account" && Object.keys(scope).length === 1 || scope.kind === "project" && Object.keys(scope).length === 2 && typeof scope.projectId === "string" && scope.projectId.length > 0;
}
export function isAssistantSourceScope(value:unknown):value is AssistantSourceScope{
  if(!value||typeof value!=="object")return false;
  const source=value as Record<string,unknown>;
  if(source.kind==="conversation")return Object.keys(source).every(key=>["kind","conversationId","rootId"].includes(key))&&typeof source.conversationId==="string"&&source.conversationId.length>0&&(source.rootId===undefined||typeof source.rootId==="string"&&source.rootId.length>0);
  return source.kind==="task_discussion"&&Object.keys(source).length===2&&typeof source.taskId==="string"&&source.taskId.length>0;
}
export function isAssistantRunView(value: unknown): value is AssistantRunView {
  if (!value || typeof value !== "object") return false;
  const run = value as Record<string, unknown>;
  const rawSteps=Array.isArray(run.steps)?run.steps:[];
  const plannedActions=rawSteps.flatMap(step=>step&&typeof step==="object"&&(step as Record<string,unknown>).plan&&typeof (step as Record<string,unknown>).plan==="object"?[(step as Record<string,unknown>).plan]:[]);
  const plannedActionsValid=!plannedActions.length||!!parseAssistantPlan({version:ASSISTANT_VERSION,outcome:"plan",mode:"draft",actions:plannedActions});
  return runId(run.id) && requestId(run.requestId) && typeof run.text === "string" && run.text.length <= 16000 &&
    isAssistantScope(run.scope) && (run.mode === "execute" || run.mode === "draft") &&
    ["planning", "ready", "running", "completed", "partial", "clarification", "failed", "cancelled", "unknown"].includes(run.status as string) &&
    typeof run.createdAt === "string" && typeof run.updatedAt === "string" &&
    (run.message === undefined || typeof run.message === "string") &&
    (run.accessUnavailable===undefined||typeof run.accessUnavailable==='boolean') &&
    (run.planRevision === undefined || Number.isSafeInteger(run.planRevision) && Number(run.planRevision) >= 0) &&
    (run.replyToRunId === undefined || runId(run.replyToRunId)) &&
    (run.source === undefined || isAssistantSourceScope(run.source)) &&
    (run.citations === undefined || Array.isArray(run.citations) && run.citations.length <= 12 && run.citations.every((citation: Record<string, unknown>) =>
      citation && typeof citation.ref === "string" && citation.ref.length <= 80 && typeof citation.quote === "string" && citation.quote.length <= 2000 &&
      typeof citation.authorName === "string" && citation.authorName.length <= 120 && isAssistantInternalHref(citation.href))) &&
    Array.isArray(run.steps) && run.steps.length <= 20 && plannedActionsValid && run.steps.every(step =>
      step && typeof step.id === "string" && typeof step.kind === "string" && typeof step.actionId === "string" &&
      ["queued", "running", "completed", "blocked", "failed", "unknown", "cancelled"].includes(step.status) &&
      (step.plan === undefined || typeof step.plan === "object" && step.plan !== null && step.plan.kind === step.kind && step.plan.id === step.actionId) &&
      (step.canUndo === undefined || typeof step.canUndo === "boolean") &&
      (step.undoResult === undefined || step.undoResult && ["reverted", "conflict", "unavailable"].includes(step.undoResult.status) && typeof step.undoResult.summary === "string" && Number.isSafeInteger(step.undoResult.affectedCount) && step.undoResult.affectedCount >= 0) &&
      (step.result === null || step.result && typeof step.result.summary === "string" && Number.isSafeInteger(step.result.affectedCount) && step.result.affectedCount >= 0 &&
        (step.result.delivery === undefined || ["queued", "accepted", "unknown", "suppressed"].every(key => Number.isSafeInteger(step.result.delivery[key]) && step.result.delivery[key] >= 0)) &&
        (step.result.items === undefined || Array.isArray(step.result.items) && step.result.items.length <= 500 && step.result.items.every((item: Record<string, unknown>) => item && typeof item.id === "string" && typeof item.title === "string"))));
}
export function parseAssistantApiResponse(value: unknown): AssistantApiResponse | null {
  if (!value || typeof value !== "object") return null;
  const response = value as Record<string, unknown>;
  if (response.version !== ASSISTANT_VERSION) return null;
  if (response.ok === false) return typeof response.code === "string" && typeof response.message === "string" ? value as AssistantApiResponse : null;
  return response.ok === true && typeof response.available === "boolean" &&
    (response.run === undefined || isAssistantRunView(response.run)) &&
    (response.runs === undefined || Array.isArray(response.runs) && response.runs.length <= 100 && response.runs.every(isAssistantRunView)) ? value as AssistantApiResponse : null;
}
/** Keep a specific server read authoritative in the rendered history without reordering messages. */
export function mergeAssistantRun(runs: readonly AssistantRunView[], run: AssistantRunView): readonly AssistantRunView[] {
  return [run, ...runs.filter(value => value.id !== run.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function sameOptionalAssistantSource(a: AssistantSourceScope | undefined, b: AssistantSourceScope | undefined): boolean {
  if (a === undefined) return b === undefined;
  return b !== undefined && sameAssistantSource(a, b);
}
/** Find the live waiting plan through recent informational replies, within the server's eight-turn memory bound. */
export function assistantWaitingPlanAncestor(runs: readonly AssistantRunView[], replyToRunId: string | undefined, next: Pick<AssistantRunView, "scope" | "source">, limit = 8): AssistantRunView | null {
  const byId = new Map(runs.map(run => [run.id, run]));
  const visited = new Set<string>();
  let id = replyToRunId;
  for (let depth = 0; id && depth < Math.min(Math.max(limit, 0), 8); depth++) {
    if (visited.has(id)) return null;
    visited.add(id);
    const ancestor = byId.get(id);
    if (!ancestor || !sameAssistantScope(ancestor.scope, next.scope) || !sameOptionalAssistantSource(ancestor.source, next.source)) return null;
    if (ancestor.status === "ready" && ancestor.mode === "draft" && ancestor.steps.some(step => step.plan)) return ancestor;
    id = ancestor.replyToRunId;
  }
  return null;
}
export const assistantIsWorking = (run: AssistantRunView) => run.status === "planning" || run.status === "running";
export const assistantNeedsRecovery = (run: AssistantRunView) => run.steps.some(step=>isAssistantDriveFolderPending(step.result)) || run.status !== "cancelled" && (assistantIsWorking(run) || run.status === "unknown" || run.steps.some(step => step.status === "unknown" || step.status === "running"));
export const assistantCanContinue = (run: AssistantRunView) => run.mode !== "draft" && !assistantNeedsRecovery(run) &&
  (run.status === "ready" || run.status === "partial" && run.steps.some(step => step.result?.code === "timeline_pending"));
export const assistantRunLabel = (run: AssistantRunView): string => ({ planning: "Understanding your request", ready: run.mode === "draft" ? "Draft ready" : "Ready to continue", running: "Working on your request", completed: "Done", partial: "Some work is saved", clarification: "A detail is needed", failed: "Could not finish", cancelled: "Remaining work cancelled", unknown: "Result not confirmed" })[run.status];
export const assistantStepLabel = (kind: string): string => ({ create_project: "Create Project", create_drive_subfolder: "Create Drive folder", archive_project: "Archive or restore Project", create_tasks: "Create tasks", update_tasks: "Update tasks", archive_tasks: "Archive or restore tasks", add_comment: "Add comments", nudge_tasks: "Send nudges", invite_members: "Invite members", send_message: "Send message", set_checklist_item: "Update checklist item", create_checklist_items: "Add checklist items", open_project: "Open Project", open_chat: "Open chat", read_timeline: "Read Timeline", preview_timeline: "Prepare private preview", read_chat: "Read chat", list_tasks: "Find tasks" } as Record<string, string>)[kind] ?? "Task";

const projectName = (action: AssistantAction) => {
  if(!("project" in action))return "the Project";
  if (action.project.kind === "current") return "this Project";
  if (action.project.kind === "name") return action.project.name;
  return "the new Project";
};
const memberNames = (refs: readonly AssistantMemberRef[] | undefined) => refs?.map(ref=>ref.kind==="self"?"you":ref.name).join(", ");
const dateText = (date: string | null | undefined) => date === null ? "no due date" : date === undefined ? undefined : date;
/** A compact, literal preview of the closed action schema. Never invent effect text. */
export function assistantPlanDescription(action: AssistantAction): string {
  const destination=projectName(action);
  switch(action.kind){
    case "create_project":return `Create Project “${action.name}”${action.description?` · ${action.description}`:""}`;
    case "create_drive_subfolder":return `Create folder “${action.folderName}” in ${destination}’s existing Drive folder. It uses existing folder access; there is no Undo.`;
    case "archive_project":return action.archived
      ? `Archive ${destination}. Tasks, members and history stay saved. Any published Timeline stays published.`
      : `Restore ${destination} to your active Projects. Tasks, members and history stay saved.`;
    case "create_tasks":return `${action.tasks?`Create ${action.tasks.length} task${action.tasks.length===1?"":"s"}`:`Create ${action.template.count} task${action.template.count===1?"":"s"}`} in ${destination}${action.tasks?`: ${action.tasks.slice(0,5).map(task=>task.title).join("; ")}${action.tasks.length>5?`; and ${action.tasks.length-5} more (view full list)`:""}`:""}`;
    case "update_tasks":return `Update ${action.targets.kind==="titles"?action.targets.titles.join(", "):"selected tasks"}${action.changes.assignees?` · assign to ${memberNames(action.changes.assignees)}`:""}${action.changes.dueDate!==undefined?` · due ${dateText(action.changes.dueDate)}`:""}${action.changes.dueTime!==undefined?` · at ${action.changes.dueTime??"no time"}`:""}`;
    case "archive_tasks":return `${action.archived?"Archive":"Restore"} ${action.targets.kind==="titles"?action.targets.titles.join(", "):"selected tasks"}`;
    case "add_comment":return `Comment on ${action.targets.kind==="titles"?action.targets.titles.join(", "):"selected tasks"}: “${action.body}”`;
    case "nudge_tasks":return `Send a nudge about ${action.targets.kind==="titles"?action.targets.titles.join(", "):"selected tasks"}`;
    case "invite_members":return `Invite ${action.emails.join(", ")} to ${destination}`;
    case "send_message":return action.recipient?`Send a private message to ${action.recipient.kind==="self"?"you":action.recipient.name}: “${action.body}”`:`Send in ${destination} chat: “${action.body}”`;
    case "set_checklist_item":return `${action.completed?"Tick":"Untick"} “${action.itemTitle}”`;
    case "create_checklist_items":return `Add checklist items: ${action.items.join("; ")}`;
    case "open_project":return `Open ${destination}`;
    case "open_chat":return `Open the chat for ${destination}`;
    case "read_timeline":return `Read the Timeline for ${destination}`;
    case "preview_timeline":return `Prepare a private Timeline preview for ${destination}`;
    case "read_chat":return `Read recent messages in ${destination}`;
    case "list_tasks":return `Find tasks in ${destination}`;
  }
}
export function assistantFollowUpRequest(input:{text:string;scope:AssistantScope;latest?:AssistantRunView|null;requestId:string;source?:AssistantSourceScope}):AssistantRequestDraft {
  const latest=input.latest;
  return {requestId:input.requestId,text:input.text,scope:input.scope,mode:"draft",...(latest&&sameAssistantScope(latest.scope,input.scope)?{replyToRunId:latest.id}: {}),...(input.source?{source:input.source}:{})};
}
export type AssistantRequestDraft = Readonly<{requestId:string;text:string;scope:AssistantScope;mode:"draft";replyToRunId?:string;source?:AssistantSourceScope}>;
export const sameAssistantScope=(a:AssistantScope,b:AssistantScope)=>a.kind===b.kind&&(a.kind==="account"||b.kind==="project"&&a.projectId===b.projectId);
export const sameAssistantSource=(a:AssistantSourceScope|undefined,b:AssistantSourceScope)=>!!a&&a.kind===b.kind&&(a.kind==="conversation"&&b.kind==="conversation"&&a.conversationId===b.conversationId&&(a.rootId??null)===(b.rootId??null)||a.kind==="task_discussion"&&b.kind==="task_discussion"&&a.taskId===b.taskId);
/** A stored receipt is not necessarily a successful action or confirmed delivery. */
export function assistantVisibleStepStatus(step: AssistantStepView): AssistantStepStatus {
  if (step.result && step.result.status !== "completed") return step.result.status;
  if (step.result?.delivery?.unknown) return "unknown";
  if (step.result?.code === "timeline_pending" || isAssistantDriveFolderPending(step.result) || step.result?.delivery?.queued) return "queued";
  return step.status;
}
/** Navigation belongs to the direct command reply, never history or recovery reads. */
export function assistantNavigationTarget(operation: "submit" | "apply" | "resume" | "cancel" | "read", run?: AssistantRunView): string | null {
  if (!["submit", "apply", "resume"].includes(operation) || run?.status !== "completed" ||
    run.steps.some(step => assistantVisibleStepStatus(step) !== "completed")) return null;
  const step = [...run.steps].reverse().find(value => ["open_project", "open_chat", "preview_timeline"].includes(value.kind));
  if (step?.result?.status !== "completed" || !isAssistantInternalHref(step.result.href)) return null;
  const destination = new URL(step.result.href, "https://app.signalstudio.ie");
  return destination.pathname.startsWith("/app/") ? `${destination.pathname}${destination.search}${destination.hash}` : null;
}


export type AssistantVisibleTiming = { requestId: string; startedAt: number; receivedAt?: number; recorder: PingTelemetryRecorder | null; endAttempt: PingTelemetryEnd; requestEnd?: PingTelemetryEnd; done: boolean };
export function finishAssistantTiming(timing: AssistantVisibleTiming | null | undefined, outcome: PingTelemetryOutcome) {
  if (!timing || timing.done) return;
  timing.done = true;
  try { timing.requestEnd?.(outcome); } catch { /* Closes diagnostics, never the physical product promise. */ }
  try { timing.endAttempt(outcome); } catch { /* Diagnostic only; never affects request ownership. */ }
}
function elapsed(start: number | undefined, now: () => number): number | null {
  try { const value = start === undefined ? NaN : now() - start; return Number.isFinite(value) && value >= 0 && value <= 300000 ? value : null; }
  catch { return null; }
}
/** One physical product request: request includes body receipt; decode is JSON/contract work.
 * Optional diagnostics are best effort, never a retry or payload log. */
export async function assistantRequest(query = "", command?: AssistantApiCommand, signal?: AbortSignal,
  timing?: AssistantVisibleTiming | null, dependencies: { fetcher?: typeof fetch; now?: () => number } = {}): Promise<AssistantApiResponse> {
  const recorder = timing ? createPingTelemetryRequest(timing.recorder) : createBrowserPingTelemetry("typed");
  const ownsAttempt = !timing || timing.done;
  const endAttempt = ownsAttempt ? pingTelemetryBegin(recorder, "attempt") : null;
  const endRequest = pingTelemetryBegin(recorder, "request");
  let endDecode: PingTelemetryEnd | null = null;
  const now = dependencies.now ?? (() => performance.now());
  let startedAt: number | undefined;
  try { startedAt = now(); } catch { /* Missing clock is not zero latency. */ }
  let diagnosticClosed = false;
  const closeRequest: PingTelemetryEnd = outcome => {
    diagnosticClosed = true;
    endRequest(outcome); endDecode?.(outcome); endAttempt?.(outcome);
  };
  if (timing && !ownsAttempt) timing.requestEnd = closeRequest;
  const onAbort = () => {
    closeRequest("cancelled");
    if (!ownsAttempt) finishAssistantTiming(timing, "cancelled");
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) onAbort();
  try {
    const response = await (dependencies.fetcher ?? fetch)(`/api/ping/assistant${query}`, {
      method: command ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
      headers: { ...pingTelemetryHeaders(recorder), ...(command ? { "content-type": "application/json" } : {}) },
      ...(command ? { body: JSON.stringify(command) } : {}),
    });
    const body = await response.text();
    if (!diagnosticClosed) { endRequest("completed"); endDecode = pingTelemetryBegin(recorder, "decode"); }
    const value = parseAssistantApiResponse(JSON.parse(body));
    if (!value) throw new Error("Ping's response could not be read. Check the original request before trying again.");
    endDecode?.("completed");
    const outcome: PingTelemetryOutcome = signal?.aborted ? "cancelled" : value.ok ? "completed" : value.code === "unauthenticated" ? "unauthenticated" :
      value.code === "invalid_input" ? "invalid_input" : value.code === "unavailable" || value.code === "temporarily_unavailable" ? "unavailable" : "failed";
    if (!diagnosticClosed) pingTelemetryRecord(recorder, { stage: "receipt", outcome, durationMs: elapsed(startedAt, now) });
    if (timing && !timing.done) { try { timing.receivedAt = now(); } catch { timing.receivedAt = undefined; } }
    if ((!value.ok || signal?.aborted) && !ownsAttempt) finishAssistantTiming(timing, outcome);
    endAttempt?.(outcome);
    return value;
  } catch (failure) {
    const outcome = signal?.aborted ? "cancelled" : "unknown";
    endRequest(outcome); endDecode?.(outcome); endAttempt?.(outcome);
    if (!ownsAttempt) finishAssistantTiming(timing, outcome);
    throw failure;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (timing?.requestEnd === closeRequest) delete timing.requestEnd;
  }
}
/** Called after the matching result commits. A frame is a render opportunity, never proof of paint. */
export function observeAssistantResultCommit(options: {
  timing: AssistantVisibleTiming; run: Pick<AssistantRunView, "status" | "mode">;
  isCurrent: () => boolean; requestFrame: (callback: () => void) => number; cancelFrame: (id: number) => void; now?: () => number;
}): () => void {
  const { timing, run } = options;
  if (timing.done || run.status === "planning" || run.status === "running" || run.status === "ready" && run.mode !== "draft") return () => {};
  const outcome: PingTelemetryOutcome = run.status === "completed" || run.status === "ready" ? "completed" : run.status === "clarification" ? "refused" : run.status === "cancelled" ? "cancelled" : run.status === "failed" ? "failed" : "unknown";
  let disposed = false;
  const current = () => { try { return !disposed && options.isCurrent(); } catch { return false; } };
  if (!current()) return () => {};
  const now = options.now ?? (() => performance.now());
  pingTelemetryRecord(timing.recorder, { stage: "react-commit", outcome, durationMs: elapsed(timing.receivedAt, now) });
  let frame: number;
  try { frame = options.requestFrame(() => {
    if (!current() || timing.done) return;
    pingTelemetryRecord(timing.recorder, { stage: "render-opportunity", outcome, durationMs: elapsed(timing.startedAt, now) });
    finishAssistantTiming(timing, outcome);
  }); } catch { finishAssistantTiming(timing, "unavailable"); return () => {}; }
  return () => { disposed = true; try { options.cancelFrame(frame); } catch { /* Diagnostic only. */ } };
}

/** Re-entry is allowed only after an authoritative empty lookup, retaining the saved identity. */
export function assistantReentryId(pending: PendingAssistantRequest | null, authoritativeAbsent: boolean): string | null {
  return pending && authoritativeAbsent ? pending.requestId : null;
}
export function assistantCreatedProjects(run: AssistantRunView): readonly { id: string; name: string }[] {
  if (!["completed", "partial"].includes(run.status)) return [];
  const projects = new Map<string, { id: string; name: string }>();
  for (const step of run.steps) {
    const result = step.result as (NonNullable<typeof step.result> & { createdProjectName?: string }) | null;
    if (step.status === "completed" && result?.status === "completed" && typeof result.createdProjectId === "string" && result.createdProjectId && typeof result.createdProjectName === "string" && result.createdProjectName.trim()) projects.set(result.createdProjectId, { id: result.createdProjectId, name: result.createdProjectName });
  }
  return [...projects.values()];
}

/** Freshness only: saved receipts trigger an authoritative Tasks read, never publish task data. */
export type AssistantTaskRefreshState = { actorId: string | null; receipts: Set<string> };
export function refreshAssistantTasks(options: {
  state: AssistantTaskRefreshState; actorId: string; operation: AssistantApiCommand["operation"] | "read";
  response: AssistantApiResponse; pendingRequestId?: string; invalidate: () => void; refreshProjects?: () => void;
}): boolean {
  const { state, actorId, operation, response } = options;
  if (state.actorId !== actorId) { state.actorId = actorId; state.receipts.clear(); }
  if (!response.ok || !response.run) return false;
  const run = response.run;
  if (operation === "read" && (!options.pendingRequestId || options.pendingRequestId !== run.requestId)) return false;
  if (run.status === "ready" || run.status === "clarification" || run.status === "planning") return false;
  const saved = run.steps.filter(step =>
    ["create_tasks", "update_tasks", "archive_tasks", "set_checklist_item", "create_checklist_items", "archive_project"].includes(step.kind) && step.status === "completed" &&
    step.result?.status === "completed" && step.result.kind === step.kind &&
    Number.isSafeInteger(step.result.affectedCount) && step.result.affectedCount > 0 &&
    (operation !== "undo" || step.undoResult?.status === "reverted")
  ).map(step => ({step,key:JSON.stringify([actorId, run.id, step.id, step.undoResult?.status === "reverted" ? "undo" : "apply"])})).filter(({key}) => !state.receipts.has(key));
  const keys=saved.map(({key})=>key);
  if (!keys.length) return false;
  try {
    options.invalidate();
    if(saved.some(({step})=>step.kind==="archive_project"))options.refreshProjects?.();
  } catch { return false; }
  for (const key of keys) {
    state.receipts.add(key);
    if (state.receipts.size > 2000) state.receipts.delete(state.receipts.values().next().value!);
  }
  return true;
}
