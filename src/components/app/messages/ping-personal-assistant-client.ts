import { createBrowserPingTelemetry, createPingTelemetryRequest, pingTelemetryBegin, pingTelemetryHeaders, pingTelemetryRecord } from "@/lib/ping/telemetry-client";
import type { PingTelemetryRecorder, PingTelemetryEnd, PingTelemetryOutcome } from "@/lib/ping/telemetry";
import { ASSISTANT_VERSION, isAssistantInternalHref, type AssistantApiCommand, type AssistantApiResponse, type AssistantRunView, type AssistantScope, type AssistantStepView, type AssistantStepStatus } from "@/lib/ping/assistant/contract";
export type PendingAssistantRequest = Readonly<{ version: 1; requestId: string; runId?: string }>;
const requestId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(value);
const runId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{8,160}$/.test(value);
export const pendingAssistantKey = (actorId: string) => `signal.ping.assistant.pending.v1:${actorId}`;
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
export function isAssistantRunView(value: unknown): value is AssistantRunView {
  if (!value || typeof value !== "object") return false;
  const run = value as Record<string, unknown>;
  return runId(run.id) && requestId(run.requestId) && typeof run.text === "string" && run.text.length <= 16000 &&
    isAssistantScope(run.scope) && (run.mode === "execute" || run.mode === "draft") &&
    ["planning", "ready", "running", "completed", "partial", "clarification", "failed", "cancelled", "unknown"].includes(run.status as string) &&
    typeof run.createdAt === "string" && typeof run.updatedAt === "string" &&
    (run.message === undefined || typeof run.message === "string") && Array.isArray(run.steps) && run.steps.length <= 20 && run.steps.every(step =>
      step && typeof step.id === "string" && typeof step.kind === "string" && typeof step.actionId === "string" &&
      ["queued", "running", "completed", "blocked", "failed", "unknown", "cancelled"].includes(step.status) &&
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
export const assistantIsWorking = (run: AssistantRunView) => run.status === "planning" || run.status === "running";
export const assistantNeedsRecovery = (run: AssistantRunView) => run.status !== "cancelled" && (assistantIsWorking(run) || run.status === "unknown" || run.steps.some(step => step.status === "unknown" || step.status === "running"));
export const assistantCanContinue = (run: AssistantRunView) => run.mode !== "draft" && !assistantNeedsRecovery(run) &&
  (run.status === "ready" || run.status === "partial" && run.steps.some(step => step.result?.code === "timeline_pending"));
export const assistantRunLabel = (run: AssistantRunView): string => ({ planning: "Understanding your request", ready: run.mode === "draft" ? "Draft ready" : "Ready to continue", running: "Working on your request", completed: "Done", partial: "Some work is saved", clarification: "A detail is needed", failed: "Could not finish", cancelled: "Remaining work cancelled", unknown: "Result not confirmed" })[run.status];
export const assistantStepLabel = (kind: string): string => ({ create_project: "Create Project", create_tasks: "Create tasks", update_tasks: "Update tasks", archive_tasks: "Archive or restore tasks", add_comment: "Add comments", nudge_tasks: "Send nudges", invite_members: "Invite members", send_message: "Send message", open_project: "Open Project", open_chat: "Open chat", read_timeline: "Read Timeline", preview_timeline: "Prepare private preview", read_chat: "Read chat", list_tasks: "Find tasks" } as Record<string, string>)[kind] ?? "Task";
/** A stored receipt is not necessarily a successful action or confirmed delivery. */
export function assistantVisibleStepStatus(step: AssistantStepView): AssistantStepStatus {
  if (step.result && step.result.status !== "completed") return step.result.status;
  if (step.result?.delivery?.unknown) return "unknown";
  if (step.result?.code === "timeline_pending" || step.result?.delivery?.queued) return "queued";
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
  response: AssistantApiResponse; pendingRequestId?: string; invalidate: () => void;
}): boolean {
  const { state, actorId, operation, response } = options;
  if (state.actorId !== actorId) { state.actorId = actorId; state.receipts.clear(); }
  if (!response.ok || !response.run) return false;
  const run = response.run;
  if (operation === "read" && (!options.pendingRequestId || options.pendingRequestId !== run.requestId)) return false;
  if (run.status === "ready" || run.status === "clarification" || run.status === "planning") return false;
  const keys = run.steps.filter(step =>
    ["create_tasks", "update_tasks", "archive_tasks"].includes(step.kind) && step.status === "completed" &&
    step.result?.status === "completed" && step.result.kind === step.kind &&
    Number.isSafeInteger(step.result.affectedCount) && step.result.affectedCount > 0
  ).map(step => JSON.stringify([actorId, run.id, step.id])).filter(key => !state.receipts.has(key));
  if (!keys.length) return false;
  try { options.invalidate(); } catch { return false; }
  for (const key of keys) {
    state.receipts.add(key);
    if (state.receipts.size > 2000) state.receipts.delete(state.receipts.values().next().value!);
  }
  return true;
}
