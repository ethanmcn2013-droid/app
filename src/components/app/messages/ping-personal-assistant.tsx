"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { ASSISTANT_LIMITS, type AssistantApiResponse, type AssistantRequest, type AssistantRunView, isAssistantInternalHref } from "@/lib/ping/assistant/contract";
import { createBrowserPingTelemetry, pingTelemetryBegin } from "@/lib/ping/telemetry-client";
import { invalidateTaskSnapshotEpoch } from "@/lib/tasks/task-snapshot-epoch";
import { ChatHeader, Composer } from "./chat-ui";
import { PingTile } from "./chat-marks";
import { refreshAssistantTasks, type AssistantTaskRefreshState, assistantRequest, finishAssistantTiming, assistantNavigationTarget, assistantVisibleStepStatus, assistantCanContinue, assistantCreatedProjects, assistantReentryId, assistantIsWorking, assistantNeedsRecovery, assistantRunLabel, assistantStepLabel, parsePendingAssistantRequest, pendingAssistantKey, observeAssistantResultCommit, type AssistantVisibleTiming, type PendingAssistantRequest } from "./ping-personal-assistant-client";
import styles from "./ping-personal-assistant.module.css";
function readEventTime() { return performance.now(); }
const queryFor = (pending: PendingAssistantRequest) => pending.runId ? `?runId=${encodeURIComponent(pending.runId)}` : `?clientRequestId=${encodeURIComponent(pending.requestId)}`;
/** Actor-keyed by the chat shell. A recovery note stores identifiers, never request text or results. */
export function PingPersonalAssistant({ actorId, projects, visible, onBack, actions }: { actorId: string; projects: readonly { id: string; name: string }[]; visible: boolean; onBack?: () => void; actions?: ReactNode }) {
  const router = useRouter();
  const [runs, setRuns] = useState<readonly AssistantRunView[]>([]);
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState("");
  const [createdProjects, setCreatedProjects] = useState<readonly { id: string; name: string }[]>([]);
  const scopeProjects = [...projects, ...createdProjects.filter(project => !projects.some(value => value.id === project.id))];
  // Ping always shows a plan before anything changes (founder decision): requests are drafts until applied.
  const [mode, setMode] = useState<"execute" | "draft">("draft");
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState<PendingAssistantRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [absent, setAbsent] = useState(false);
  const [hasOriginal, setHasOriginal] = useState(false);
  const [reentering, setReentering] = useState(false);
  const pendingRef = useRef<PendingAssistantRequest | null>(null);
  const original = useRef<AssistantRequest | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const latch = useRef(false);
  const visibleTiming = useRef<AssistantVisibleTiming | null>(null);
  const lookupAbort = useRef<AbortController | null>(null);
  const taskRefresh = useRef<AssistantTaskRefreshState>({ actorId, receipts: new Set() });
  const historyRef = useRef<HTMLDivElement>(null);
  const keepPending = useCallback((next: PendingAssistantRequest | null) => {
    const key = pendingAssistantKey(actorId);
    if (next) window.localStorage.setItem(key, JSON.stringify(next)); else window.localStorage.removeItem(key);
    pendingRef.current = next; setPending(next);
  }, [actorId]);
  const receive = useCallback((response: AssistantApiResponse) => {
    if (!response.ok) throw new Error(response.message);
    setAvailable(response.available);
    if (response.runs) setRuns(response.runs);
    if (response.run) {
      const run = response.run;
      const created = assistantCreatedProjects(run);
      if (created.length) { setCreatedProjects(previous => [...previous.filter(project => !created.some(value => value.id === project.id)), ...created]); if (created.length === 1) setScope(previous => previous || created[0].id); }
      setRuns(previous => [run, ...previous.filter(value => value.id !== run.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (pendingRef.current?.requestId === run.requestId) {
        keepPending(assistantNeedsRecovery(run) ? { version: 1, requestId: run.requestId, runId: run.id } : null);
        setAbsent(false); setReentering(false);
        if (original.current?.requestId === run.requestId) { original.current = null; setHasOriginal(false); setDraft(""); requestAnimationFrame(() => { if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight; }); }
      }
    }
    return response;
  }, [keepPending]);
  const checkOriginal = useCallback(async () => {
    if (latch.current || !pendingRef.current) return;
    latch.current = true; setBusy(true); setError(null);
    const epoch = generation.current;
    const pendingRequestId = pendingRef.current.requestId;
    const timing = visibleTiming.current?.requestId === pendingRef.current.requestId ? visibleTiming.current : null;
    const controller = new AbortController(); lookupAbort.current = controller;
    try {
      const response = await assistantRequest(queryFor(pendingRef.current), undefined, controller.signal, timing);
      if (!mounted.current || epoch !== generation.current) return;
      const accepted = receive(response);
      refreshAssistantTasks({ state: taskRefresh.current, actorId, operation: "read", response: accepted, pendingRequestId, invalidate: invalidateTaskSnapshotEpoch });
      if (!accepted.run) { setAbsent(true); setError("The original request is not recorded yet. Check again before starting another request."); }
    } catch (failure) { finishAssistantTiming(timing, "unknown"); if (mounted.current && epoch === generation.current) setError(failure instanceof Error ? failure.message : "The original result could not be checked."); }
    finally { if (lookupAbort.current === controller) lookupAbort.current = null; if (epoch === generation.current) { latch.current = false; if (mounted.current) setBusy(false); } }
  }, [receive, actorId]);
  useEffect(() => {
    mounted.current = true;
    const epoch = ++generation.current;
    const controller = new AbortController();
    void (async () => {
      try {
        const raw = window.localStorage.getItem(pendingAssistantKey(actorId));
        const saved = parsePendingAssistantRequest(raw);
        if (raw !== null && !saved) throw new Error("A recovery note could not be read. Reload before starting another request.");
        pendingRef.current = saved; setPending(saved);
        const history = await assistantRequest("", undefined, controller.signal);
        if (!mounted.current || epoch !== generation.current) return;
        receive(history);
        if (saved) {
          const response = await assistantRequest(queryFor(saved), undefined, controller.signal);
          if (!mounted.current || epoch !== generation.current) return;
          const accepted = receive(response);
          refreshAssistantTasks({ state: taskRefresh.current, actorId, operation: "read", response: accepted, pendingRequestId: saved.requestId, invalidate: invalidateTaskSnapshotEpoch });
          if (!accepted.run) { setAbsent(true); setError("The original request is not recorded yet. Check its status before starting another request."); }
        }
        setReady(true);
      } catch (failure) { if (!controller.signal.aborted && mounted.current && epoch === generation.current) setError(failure instanceof Error ? failure.message : "Ping could not load your saved requests."); }
    })();
    return () => { mounted.current = false; generation.current = epoch + 1; controller.abort();
      lookupAbort.current?.abort(); lookupAbort.current = null;
      finishAssistantTiming(visibleTiming.current, "context_invalidated");
      visibleTiming.current = null;
    };
  }, [actorId, receive]);
  const active = pending ? runs.find(run => run.requestId === pending.requestId) : undefined;
  useEffect(() => {
    if (!visible || !ready || !pending || !active || !assistantIsWorking(active)) return;
    const timer = window.setTimeout(() => { void checkOriginal(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [visible, ready, pending, active, busy, checkOriginal]);
  useLayoutEffect(() => {
    const timing = visibleTiming.current;
    if (!visible) { finishAssistantTiming(timing, "unfinished"); return; }
    const run = timing && runs.find(value => value.requestId === timing.requestId);
    if (!timing || !run || !visible) return;
    return observeAssistantResultCommit({ timing, run, isCurrent: () => mounted.current && visible && visibleTiming.current === timing,
      requestFrame: callback => window.requestAnimationFrame(callback), cancelFrame: frame => window.cancelAnimationFrame(frame) });
  }, [runs, visible]);
  function beginVisibleTiming(requestId: string) {
    try {
      finishAssistantTiming(visibleTiming.current, "unfinished");
      const startedAt = readEventTime();
      const recorder = createBrowserPingTelemetry("typed");
      visibleTiming.current = { requestId, startedAt, recorder, endAttempt: pingTelemetryBegin(recorder, "attempt"), done: false };
    } catch { visibleTiming.current = null; }
    return visibleTiming.current;
  }
  function openCommandResult(operation: "submit" | "apply" | "resume" | "cancel", response: AssistantApiResponse) {
    if (!response.ok) return;
    const href = assistantNavigationTarget(operation, response.run);
    if (href) {
      try { router.push(href); }
      catch { setError("Your work is saved. Open the result below."); }
    }
  }
  async function submit(retry = false) {
    if (latch.current || !ready || !available || (!retry && pendingRef.current && !reentering)) return;
    const request = retry ? original.current : { requestId: reentering ? assistantReentryId(pendingRef.current, absent)! : `ping_${crypto.randomUUID().replaceAll("-", "")}`, text: draft.trim(),
      scope: scope ? { kind: "project" as const, projectId: scope } : { kind: "account" as const }, mode };
    if (reentering && (!absent || !pendingRef.current)) return;
    if (!request || !request.text || request.text.length > ASSISTANT_LIMITS.text) return;
    latch.current = true; setBusy(true); setError(null); setAbsent(false);
    const timing = beginVisibleTiming(request.requestId);
    const epoch = generation.current;
    try {
      keepPending({ version: 1, requestId: request.requestId });
      original.current = request; setHasOriginal(true);
      const response = await assistantRequest("", { operation: "submit", request }, undefined, timing);
      if (mounted.current && epoch === generation.current) { receive(response); refreshAssistantTasks({ state: taskRefresh.current, actorId, operation: "submit", response, invalidate: invalidateTaskSnapshotEpoch }); openCommandResult("submit", response); }
    } catch (failure) {
      finishAssistantTiming(timing, pendingRef.current ? "unknown" : "not_invoked");
      if (mounted.current && epoch === generation.current) setError(pendingRef.current ? "The result is not confirmed. Check status before trying again. Your original request will not be sent again automatically." : failure instanceof Error ? failure.message : "This browser could not keep a recovery note. No request was sent.");
    } finally { if (epoch === generation.current) { latch.current = false; if (mounted.current) setBusy(false); } }
  }
  async function operate(operation: "resume" | "cancel" | "apply", run: AssistantRunView) {
    if (latch.current || pendingRef.current && pendingRef.current.requestId !== run.requestId) return;
    latch.current = true; setBusy(true); setError(null);
    const timing = beginVisibleTiming(run.requestId);
    const epoch = generation.current;
    try {
      keepPending({ version: 1, requestId: run.requestId, runId: run.id });
      const response = await assistantRequest("", { operation, runId: run.id }, undefined, timing);
      if (mounted.current && epoch === generation.current) { receive(response); refreshAssistantTasks({ state: taskRefresh.current, actorId, operation, response, invalidate: invalidateTaskSnapshotEpoch }); openCommandResult(operation, response); }
    } catch { finishAssistantTiming(timing, "unknown"); if (mounted.current && epoch === generation.current) setError("The latest result is not confirmed. Check status; work already saved stays saved."); }
    finally { if (epoch === generation.current) { latch.current = false; if (mounted.current) setBusy(false); } }
  }
  const latest = runs[0];
  const currentStep = latest?.steps.find(step => step.status === "running");
  const working = busy || !!latest && assistantIsWorking(latest);
  // A conversation: oldest at the top, the newest request and its plan at the bottom.
  const ordered = [...runs].reverse();
  const status = working ? currentStep ? assistantStepLabel(currentStep.kind) : "Working" : pending ? "Check request" : !ready ? "Loading" : !available ? "Unavailable" : "Ready";
  return <section className={styles.assistant} aria-label="Ping personal assistant">
    <ChatHeader panel onBack={onBack} backLabel="All chats" leading={<PingTile size={32} working={working} />} title="Ping"
      subtitle={<span className={styles.presence} data-active={working || undefined} role="status"><span aria-hidden="true" />{status} · only you see what you ask</span>} actions={actions} />
    <div className={styles.scopeBar}><label className={styles.scope}>Work in<select value={scope} onChange={event => setScope(event.target.value)} disabled={!ready || !!pending && !reentering || busy} aria-label="Ping scope">
      <option value="">Across my account</option>{scopeProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select></label></div>
    <div className={styles.history} ref={historyRef} tabIndex={0} aria-label="Ping requests and results">
      {!ready && !error ? <p className={styles.note} role="status">Loading your saved requests...</p> : null}
      {ready && !available ? <p className={styles.note}>Ping is not available for this account yet.</p> : null}
      {ready && available && !runs.length && !pending ? <div className={styles.empty}><PingTile size={44} /><h3>What would you like to move forward?</h3><p>Ask in your own words: create a Project, put tasks in order, assign work or prepare a private Timeline preview. You can put several actions in one request.</p><p>Ping always shows you a plan first. Nothing changes until you apply it.</p></div> : null}
      <ol className={styles.runs}>{ordered.map((run, index) => { const current = index === ordered.length - 1; const plan = run.status === "ready" && run.mode === "draft"; return <li key={run.id} className={styles.run} data-current={current || undefined}>
        <div className={styles.ask}><span className={styles.who}>You</span><p>{run.text}</p></div>
        <div className={styles.reply}><PingTile size={28} /><div className={styles.result}>
          <div className={styles.resultHead}><h3 aria-live={current ? "polite" : undefined}>{plan ? "Here's the plan" : assistantRunLabel(run)}</h3>{run.steps.length && !plan ? <span className={styles.progress}>{run.steps.filter(step => assistantVisibleStepStatus(step) === "completed" && step.result?.status === "completed").length} of {run.steps.length} {run.steps.length === 1 ? "step" : "steps"} complete</span> : null}</div>
          {run.message ? <p>{run.message}</p> : null}
          {run.steps.length ? <div className={styles.plan} role="group" aria-label={plan ? "Ping's plan" : "Ping's steps"} data-plan={plan || undefined}>
            {plan ? <div className={styles.planHead}><strong>Plan · {run.steps.length} {run.steps.length === 1 ? "change" : "changes"}</strong></div> : null}
            <ol className={styles.steps}>{run.steps.map(step => { const visibleStatus = assistantVisibleStepStatus(step); return <li key={step.id} data-state={visibleStatus}>
              <div className={styles.stepHead}><span className={styles.stepTitle}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{visibleStatus === "completed" && step.result?.status === "completed" ? <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/> : <circle cx="8" cy="8" r="4.5" stroke="currentColor"/>}</svg>{assistantStepLabel(step.kind)}</span><span>{visibleStatus === "completed" ? "Done" : visibleStatus === "running" ? "In progress" : visibleStatus === "queued" ? plan ? "Planned" : "Waiting" : visibleStatus === "unknown" ? "Not confirmed" : visibleStatus === "cancelled" ? "Cancelled" : visibleStatus === "blocked" ? "Needs attention" : "Could not finish"}</span></div>
              {step.result ? <><p>{step.result.summary}</p>{step.result.status === "completed" && step.result.affectedCount > 0 && ["create_tasks", "update_tasks", "archive_tasks"].includes(step.kind) ? <p className={styles.note}>{step.result.affectedCount} {step.result.affectedCount === 1 ? "task" : "tasks"}</p> : null}
                <div className={styles.resultLinks}>{isAssistantInternalHref(step.result.href) ? <Link href={step.result.href}>{step.kind === "preview_timeline" ? "Open private preview" : step.kind === "open_project" ? "Open tasks" : step.kind === "open_chat" || step.kind === "send_message" ? "Open chat" : step.kind === "read_timeline" ? "Open Timeline" : "Open result"}</Link> : null}
                {step.result.status === "completed" && step.result.projectId && ["create_tasks", "update_tasks", "archive_tasks"].includes(step.kind) ? <Link href={`${PRODUCT_APP_PATHS.tasks}?workspaceId=${encodeURIComponent(step.result.projectId)}`}>Open tasks</Link> : null}</div>
                {step.result.delivery ? <p className={styles.note}>Delivery: {step.result.delivery.queued} queued / {step.result.delivery.accepted} accepted / {step.result.delivery.unknown} unconfirmed / {step.result.delivery.suppressed} suppressed</p> : null}
                {step.result.items?.length ? <details><summary>View {step.result.items.length} {step.result.items.length === 1 ? "item" : "items"}</summary><ul className={styles.items}>{step.result.items.map(item => <li key={item.id}>{isAssistantInternalHref(item.href) ? <Link href={item.href}>{item.title}</Link> : <span>{item.title}</span>}{typeof item.detail === "string" ? <p>{item.detail}</p> : null}</li>)}</ul></details> : null}
              </> : null}
            </li>; })}</ol>
            <div className={styles.actions}>
              {plan ? <span className={styles.hint}>Nothing changes until you apply</span> : null}
              {["planning", "ready", "running", "partial", "unknown"].includes(run.status) ? <button type="button" className={styles.secondary} disabled={busy || !!pending && pending.requestId !== run.requestId} onClick={() => void operate("cancel", run)}>{plan ? "Cancel" : "Cancel remaining work"}</button> : null}
              {assistantCanContinue(run) ? <button type="button" className={styles.secondary} disabled={busy || !!pending && pending.requestId !== run.requestId} onClick={() => void operate("resume", run)}>{run.status === "partial" ? "Retry private preview" : "Continue remaining work"}</button> : null}
              {plan ? <button type="button" className={styles.primary} disabled={busy || !!pending && pending.requestId !== run.requestId} onClick={() => void operate("apply", run)}>Apply plan</button> : null}
            </div>
          </div> : null}
        </div></div>
      </li>; })}</ol>
    </div>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    {pending ? <div className={styles.recovery} role="status"><span>{busy ? "Waiting for the latest result..." : "Your request is kept until its result is confirmed."}</span><button type="button" onClick={() => void checkOriginal()} disabled={busy}>Check status</button>{absent && !hasOriginal && !reentering ? <button type="button" disabled={busy} onClick={() => setReentering(true)}>Re-enter original request</button> : null}{absent && hasOriginal ? <button type="button" onClick={() => void submit(true)} disabled={busy}>Retry original request</button> : null}</div> : null}
    <div className={styles.compose}>
      {reentering ? <><p className={styles.note}>Re-enter the exact original request and choose its original scope and mode. Ping will use the saved request ID to check for duplicate work.</p>
        <label className={styles.mode}><input type="checkbox" checked={mode === "draft"} onChange={event => setMode(event.target.checked ? "draft" : "execute")} disabled={busy} />Show a plan first</label></> : null}
      <Composer value={draft} onChange={setDraft} onSend={() => void submit()} label="Request for Ping" placeholder="Ask Ping to get something done" people={[]} selfId={actorId} mentionIds={[]} disabled={!ready || !available || !!pending && !reentering || busy} sendDisabled={!draft.trim() || draft.length > ASSISTANT_LIMITS.text} showHint={false} count={<span className={styles.note}>{draft.length.toLocaleString()} / {ASSISTANT_LIMITS.text.toLocaleString()}</span>} />
    </div>
  </section>;
}



