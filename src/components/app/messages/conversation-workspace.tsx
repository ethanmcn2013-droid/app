"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationDelta, ConversationFailure, ConversationResult, MessageReceipt, MessageRecord, SendInput } from "@/lib/conversations/contracts";
import { CONVERSATION_LIMITS, normalizeMessageBody, validMessageBody } from "@/lib/conversations/contracts";
import { conversationReducer, emptyConversationState, type PendingSend } from "@/lib/conversations/reducer";
import { ConversationPoller } from "@/lib/conversations/polling";
import { AudienceHeader, Icon } from "./prototype-panels";
import { audienceResponseMatches, conversationHeaders, draftKey, forgetProjectDrafts, needsFreshAudienceSend, rememberDraft, type DraftCache, type ScrollCache } from "./conversation-client-model";
import styles from "./conversation-workspace.module.css";

type ProjectOption = Readonly<{ id: ProjectId; name: string }>;
type ConversationScope = Readonly<{ conversationId: string; projectId: ProjectId; kind: "project"; audienceEpoch: number; lifecycle: "active" | "archived" }>;
type Audience = Readonly<{ audienceEpoch: number; members: readonly Readonly<{ id: string; name: string }>[] }>;
type MutationReceipt = Readonly<{ messageId: string; clientRequestId: string; changeSeq: number; revision: number; committedAt: number }>;
type GeneratedAction =
  | Readonly<{ type: "delta"; delta: ConversationDelta }>
  | Readonly<{ type: "receipt"; receipt: MessageReceipt }>
  | Readonly<{ type: "uncertain" | "restore_absent"; requestId: string }>
  | Readonly<{ type: "refused"; failure: ConversationFailure; requestId?: string }>
  | Readonly<{ type: "offline" }>;

export type ConversationWorkspaceProps = Readonly<{ actorId: string; projects: readonly ProjectOption[]; initialProjectId?: ProjectId; fixtureActor?: string }>;

const failureCopy: Record<ConversationFailure["code"], string> = {
  unauthenticated: "Your session is no longer available.", unavailable: "This conversation is unavailable.",
  archived: "This Project is archived. Its conversation is read only.", audience_changed: "The audience changed. Review the current members before sending.",
  consent_required: "Sending requires consent.", read_only: "Conversation sends are currently turned off.",
  invalid_input: "That message could not be sent. Review it and try again.", request_conflict: "This request no longer matches the original message.",
  revision_conflict: "This message changed elsewhere. Its latest version will be loaded.", temporarily_unavailable: "Signal Studio cannot reach conversations right now.",
  resync_required: "The conversation needs a fresh history check.", rate_limited: "Too many attempts. Wait a moment and try again.",
};

const newRequestId = (prefix = "request") => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

async function apiResult<T>(url: string, fixtureActor: string | undefined, init?: RequestInit): Promise<ConversationResult<T>> {
  const headers = conversationHeaders(fixtureActor, Boolean(init?.body));
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", headers });
  return await response.json() as ConversationResult<T>;
}

function apiUrl(action: string, projectId: ProjectId, values: Record<string, string | number> = {}) {
  const query = new URLSearchParams({ action, projectId, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
  return `/api/conversations?${query}`;
}

export function ConversationWorkspace(props: ConversationWorkspaceProps) {
  return <ConversationWorkspaceActor key={props.actorId} {...props} />;
}

function ConversationWorkspaceActor({ actorId, projects, initialProjectId, fixtureActor }: ConversationWorkspaceProps) {
  const initial = projects.some((project) => project.id === initialProjectId) ? initialProjectId! : projects[0]?.id;
  const [projectId, setProjectId] = useState<ProjectId | undefined>(initial);
  const [view, setView] = useState<"full" | "context">("full");
  const [draftCache] = useState<DraftCache>(() => new Map());
  const [scrollCache] = useState<ScrollCache>(() => new Map());
  if (!projectId || projects.length === 0) return <main className={styles.noProjects}><h1>Messages</h1><p>Add a Project before starting a Project conversation.</p></main>;
  const selected = projects.find((project) => project.id === projectId) ?? projects[0];
  return <section className={styles.workspace} data-view={view}>
    <aside className={styles.projectList}>
      <div className={styles.listHeading}><h1>Messages</h1><span>Project conversations</span></div>
      {projects.map((project) => <button aria-current={project.id === selected.id ? "page" : undefined} aria-label={project.name} key={project.id} onClick={() => setProjectId(project.id)} type="button"><span>{project.name.slice(0, 2).toUpperCase()}</span><strong>{project.name}</strong></button>)}
      <p>Messages stay inside their named Project.</p>
    </aside>
    <ProjectConversationSession actorId={actorId} draftCache={draftCache} fixtureActor={fixtureActor} key={`${actorId}:${selected.id}`} onToggleView={() => setView((current) => current === "full" ? "context" : "full")} project={selected} scrollCache={scrollCache} view={view} />
  </section>;
}

function ProjectConversationSession({ actorId, project, fixtureActor, draftCache, scrollCache, view, onToggleView }: Readonly<{ actorId: string; project: ProjectOption; fixtureActor?: string; draftCache: DraftCache; scrollCache: ScrollCache; view: "full" | "context"; onToggleView: () => void }>) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, () => emptyConversationState(actorId, `${project.id}:pending`, 1));
  const [scope, setScope] = useState<ConversationScope | null | undefined>(undefined);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [startFailure, setStartFailure] = useState<ConversationFailure["code"] | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [sendsOff, setSendsOff] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [catchingUp, setCatchingUp] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string; revision: number } | null>(null);
  const stateRef = useRef(state);
  const generationRef = useRef(1);
  const historyEpochRef = useRef<number | null>(null);
  const audienceRef = useRef<Audience | null>(null);
  const sessionControllerRef = useRef<AbortController | null>(null);
  const pollerRef = useRef<ConversationPoller<ConversationResult<ConversationDelta>> | null>(null);
  const draftLoadedFor = useRef<string | null>(null);
  const scrollLoadedFor = useRef<string | null>(null);
  const scrollAnchorRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const catchupRef = useRef(false);
  const dispatchAt = (generation: number, action: GeneratedAction) => dispatch({ ...action, generation });
  const isCurrent = (generation: number, signal?: AbortSignal) => generation === generationRef.current && !signal?.aborted;

  useEffect(() => { stateRef.current = state; }, [state]);

  const scopeCacheKey = (currentScope: ConversationScope) => draftKey(actorId, project.id, currentScope.conversationId, null);
  function rememberScroll(currentScope = scope) {
    const node = feedRef.current;
    if (node && currentScope) scrollCache.set(scopeCacheKey(currentScope), { top: node.scrollTop, bottomDistance: Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop) });
  }
  function captureScrollAnchor() {
    const node = feedRef.current;
    if (node) scrollAnchorRef.current = Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop);
  }
  function clearAudience() { audienceRef.current = null; setAudience(null); }
  function advanceSession(scopeKey: string) {
    rememberScroll();
    sessionControllerRef.current?.abort();
    pollerRef.current?.stop();
    const generation = generationRef.current + 1;
    const controller = new AbortController();
    generationRef.current = generation;
    sessionControllerRef.current = controller;
    historyEpochRef.current = null;
    clearAudience(); setEditing(null); setMutationError(null); setSendsOff(false);
    dispatch({ type: "reset", actorId, scopeKey, generation });
    return { generation, controller };
  }
  function revoke(generation: number, failure: ConversationFailure) {
    if (!isCurrent(generation)) return;
    dispatchAt(generation, { type: "refused", failure });
    generationRef.current = generation + 1;
    sessionControllerRef.current?.abort(); pollerRef.current?.stop();
    forgetProjectDrafts(draftCache, actorId, project.id);
    if (scope) scrollCache.delete(scopeCacheKey(scope));
    historyEpochRef.current = null; clearAudience(); setEditing(null); setMutationError(null); setScope(undefined);
  }
  function handleFailure(failure: ConversationFailure, generation: number, requestId?: string) {
    if (!isCurrent(generation)) return;
    if (failure.code === "unavailable" || failure.code === "unauthenticated") { revoke(generation, failure); return; }
    if (failure.code === "archived") setScope((current) => current ? { ...current, lifecycle: "archived" } : current);
    if (failure.code === "read_only") setSendsOff(true);
    if (failure.code === "audience_changed") clearAudience();
    dispatchAt(generation, failure.code === "temporarily_unavailable" ? { type: "offline" } : { type: "refused", failure, requestId });
  }
  function applyDelta(delta: ConversationDelta, generation: number) {
    if (!isCurrent(generation)) return;
    captureScrollAnchor(); historyEpochRef.current = delta.audienceEpoch;
    if (audienceRef.current?.audienceEpoch !== delta.audienceEpoch) clearAudience();
    dispatchAt(generation, { type: "delta", delta });
  }
  function acceptAudience(value: Audience, generation: number, expectedEpoch: number) {
    if (!audienceResponseMatches(generation, generationRef.current, expectedEpoch, historyEpochRef.current, value.audienceEpoch)) return false;
    audienceRef.current = value; setAudience(value); return true;
  }
  const requestAudience = (signal?: AbortSignal) => apiResult<Audience>(apiUrl("audience", project.id), fixtureActor, { signal });
  const loadHistory = (currentScope: ConversationScope, afterChangeSeq: number, signal?: AbortSignal) => apiResult<ConversationDelta>(apiUrl("history", project.id, { conversationId: currentScope.conversationId, afterChangeSeq, limit: 100 }), fixtureActor, { signal });

  async function loadThroughCurrent(currentScope: ConversationScope, generation: number, signal: AbortSignal, first?: ConversationDelta): Promise<{ finalPage: ConversationDelta | null; caughtUp: boolean }> {
    let page = first ?? null;
    let lastPage: ConversationDelta | null = null;
    let cursor = page?.throughChangeSeq ?? 0;
    for (let pageCount = 0; pageCount < 10 && isCurrent(generation, signal); pageCount++) {
      if (!page) {
        const result = await loadHistory(currentScope, cursor, signal);
        if (!result.ok) { handleFailure(result, generation); return { finalPage: null, caughtUp: false }; }
        page = result.value;
      }
      lastPage = page;
      applyDelta(page, generation);
      cursor = page.throughChangeSeq;
      if (!page.hasMore) return { finalPage: page, caughtUp: true };
      page = null;
    }
    return { finalPage: lastPage, caughtUp: false };
  }

  useEffect(() => {
    const generation = generationRef.current;
    const controller = new AbortController();
    sessionControllerRef.current = controller;
    void apiResult<ConversationScope | null>(apiUrl("project", project.id), fixtureActor, { signal: controller.signal }).then(async (result) => {
      if (!isCurrent(generation, controller.signal)) return;
      if (!result.ok) { setStartFailure(result.code); handleFailure(result, generation); return; }
      setScope(result.value);
      if (!result.value) return;
      const [history, audienceResult] = await Promise.all([loadHistory(result.value, 0, controller.signal), requestAudience(controller.signal)]);
      if (!isCurrent(generation, controller.signal)) return;
      if (!history.ok) { handleFailure(history, generation); return; }
      const catchup = await loadThroughCurrent(result.value, generation, controller.signal, history.value);
      if (!catchup.finalPage || !isCurrent(generation, controller.signal)) return;
      setCatchingUp(!catchup.caughtUp);
      if (audienceResult.ok) acceptAudience(audienceResult.value, generation, catchup.finalPage.audienceEpoch); else handleFailure(audienceResult, generation);
    }).catch(() => { if (isCurrent(generation, controller.signal)) { setStartFailure("temporarily_unavailable"); dispatchAt(generation, { type: "offline" }); } });
    return () => { controller.abort(); if (sessionControllerRef.current === controller) sessionControllerRef.current = null; };
  // Project-keyed session reruns only for an explicit retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapAttempt]);

  function retryBootstrap() { advanceSession(`${project.id}:pending`); setScope(undefined); setStartFailure(null); setBootstrapAttempt((current) => current + 1); }

  useEffect(() => {
    if (!scope) return;
    const generation = generationRef.current;
    const poller = new ConversationPoller<ConversationResult<ConversationDelta>>({
      poll: ({ conversationId }, signal) => loadHistory({ ...scope, conversationId }, stateRef.current.cursor, signal),
      apply: (result) => {
        if (!isCurrent(generation)) return;
        if (result.ok) {
          if (catchupRef.current) return;
          catchupRef.current = true;
          const signal = sessionControllerRef.current?.signal ?? new AbortController().signal;
          void loadThroughCurrent(scope, generation, signal, result.value).then((catchup) => {
            if (!catchup.finalPage || !isCurrent(generation) || audienceRef.current?.audienceEpoch === catchup.finalPage.audienceEpoch) return;
            setCatchingUp(!catchup.caughtUp);
            const expectedEpoch = catchup.finalPage.audienceEpoch;
            void requestAudience().then((next) => { if (!isCurrent(generation)) return; if (next.ok) acceptAudience(next.value, generation, expectedEpoch); else handleFailure(next, generation); }).catch(() => { if (isCurrent(generation)) dispatchAt(generation, { type: "offline" }); });
          }).finally(() => { catchupRef.current = false; });
        } else if (result.code === "resync_required") {
          if (catchupRef.current) return;
          catchupRef.current = true;
          const signal = sessionControllerRef.current?.signal ?? new AbortController().signal;
          void loadThroughCurrent(scope, generation, signal).then((catchup) => setCatchingUp(!catchup.caughtUp)).catch(() => { if (isCurrent(generation)) dispatchAt(generation, { type: "offline" }); }).finally(() => { catchupRef.current = false; });
        } else handleFailure(result, generation);
      },
      onFailure: () => { if (isCurrent(generation)) dispatchAt(generation, { type: "offline" }); },
    });
    pollerRef.current = poller;
    const configure = () => poller.configure({ actorId, projectId: project.id, conversationId: scope.conversationId }, document.visibilityState === "visible", document.hasFocus());
    configure(); document.addEventListener("visibilitychange", configure); window.addEventListener("focus", configure); window.addEventListener("blur", configure);
    return () => { document.removeEventListener("visibilitychange", configure); window.removeEventListener("focus", configure); window.removeEventListener("blur", configure); poller.stop(); if (pollerRef.current === poller) pollerRef.current = null; };
  // Scope and generation are captured; changing them stops the poller.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.conversationId]);

  useEffect(() => {
    if (!scope || draftLoadedFor.current === scope.conversationId) return;
    draftLoadedFor.current = scope.conversationId;
    const saved = draftCache.get(scopeCacheKey(scope));
    if (saved) dispatch({ type: "draft", value: saved });
  // scopeCacheKey is a pure tuple builder scoped to this keyed session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCache, scope]);
  // Save this exact scope's scroll position as the keyed session unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => rememberScroll(), [scope]);
  useLayoutEffect(() => {
    const node = feedRef.current;
    if (!node || !scope) return;
    const key = scopeCacheKey(scope);
    if (scrollLoadedFor.current !== key) {
      scrollLoadedFor.current = key;
      const saved = scrollCache.get(key);
      if (saved) node.scrollTop = saved.bottomDistance < 80 ? node.scrollHeight - node.clientHeight - saved.bottomDistance : saved.top;
    } else if (scrollAnchorRef.current !== null) {
      node.scrollTop = Math.max(0, node.scrollHeight - node.clientHeight - scrollAnchorRef.current);
      scrollAnchorRef.current = null;
    }
  // scopeCacheKey is a pure tuple builder scoped to this keyed session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scrollCache, state.cursor, state.messages.length, state.pending.length]);

  function updateDraft(value: string) { if (scope) { dispatch({ type: "draft", value }); rememberDraft(draftCache, scopeCacheKey(scope), value); } }

  async function startConversation() {
    const requestGeneration = generationRef.current; const signal = sessionControllerRef.current?.signal; setStartFailure(null);
    try {
      const result = await apiResult<ConversationScope>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "ensure", projectId: project.id }), signal });
      if (!isCurrent(requestGeneration, signal)) return;
      if (!result.ok) { setStartFailure(result.code); handleFailure(result, requestGeneration); return; }
      const { generation, controller } = advanceSession(`${project.id}:${result.value.conversationId}`); setScope(result.value);
      const [history, audienceResult] = await Promise.all([loadHistory(result.value, 0, controller.signal), requestAudience(controller.signal)]);
      if (!isCurrent(generation, controller.signal)) return;
      if (!history.ok) { handleFailure(history, generation); return; }
      const catchup = await loadThroughCurrent(result.value, generation, controller.signal, history.value);
      if (!catchup.finalPage) return;
      setCatchingUp(!catchup.caughtUp);
      if (audienceResult.ok) acceptAudience(audienceResult.value, generation, catchup.finalPage.audienceEpoch); else handleFailure(audienceResult, generation);
    } catch { if (isCurrent(requestGeneration, signal)) { setStartFailure("temporarily_unavailable"); dispatchAt(requestGeneration, { type: "offline" }); } }
  }

  function restoreForFreshAudience(pending: PendingSend, generation: number) {
    if (!isCurrent(generation) || !scope) return;
    clearAudience(); rememberDraft(draftCache, scopeCacheKey(scope), pending.input.body); dispatchAt(generation, { type: "restore_absent", requestId: pending.input.clientRequestId });
  }
  async function resolveSend(pending: PendingSend) {
    if (!scope) return;
    const generation = generationRef.current; const currentScope = scope; const signal = sessionControllerRef.current?.signal;
    try {
      const lookup = await apiResult<{ state: "committed"; receipt: MessageReceipt } | { state: "absent" }>(apiUrl("receipt", project.id, { conversationId: currentScope.conversationId, clientRequestId: pending.input.clientRequestId }), fixtureActor, { signal });
      if (!isCurrent(generation, signal)) return;
      if (!lookup.ok) { if (lookup.code === "temporarily_unavailable") dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId }); else handleFailure(lookup, generation, pending.input.clientRequestId); return; }
      if (lookup.value.state === "committed") { captureScrollAnchor(); dispatchAt(generation, { type: "receipt", receipt: lookup.value.receipt }); return; }
      if (needsFreshAudienceSend(pending.input.expectedAudienceEpoch, historyEpochRef.current)) { restoreForFreshAudience(pending, generation); return; }
      const result = await apiResult<MessageReceipt>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "send", ...pending.input }), signal });
      if (!isCurrent(generation, signal)) return;
      if (result.ok) { captureScrollAnchor(); dispatchAt(generation, { type: "receipt", receipt: result.value }); }
      else if (result.code === "audience_changed") restoreForFreshAudience(pending, generation);
      else handleFailure(result, generation, pending.input.clientRequestId);
    } catch { if (isCurrent(generation, signal)) dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId }); }
  }

  async function send() {
    const audienceReady = audience !== null && audience.audienceEpoch === state.audienceEpoch;
    if (!scope || !audienceReady || state.audienceEpoch === null || state.reviewedAudienceEpoch !== state.audienceEpoch || !validMessageBody(state.draft) || sendsOff || scope.lifecycle === "archived") return;
    const input: SendInput = { projectId: project.id, conversationId: scope.conversationId, clientRequestId: newRequestId(), expectedAudienceEpoch: state.audienceEpoch, body: normalizeMessageBody(state.draft), rootId: null, mentionUserIds: [] };
    const next = conversationReducer(state, { type: "submit", input });
    if (next === state) return;
    scrollAnchorRef.current = 0; dispatch({ type: "submit", input }); rememberDraft(draftCache, scopeCacheKey(scope), ""); await resolveSend(next.pending[next.pending.length - 1]);
  }

  async function mutate(action: "edit" | "tombstone", message: MessageRecord, body?: string) {
    const audienceReady = audience !== null && audience.audienceEpoch === state.audienceEpoch;
    if (!scope || !audienceReady || state.audienceEpoch === null || sendsOff || scope.lifecycle === "archived") return;
    const generation = generationRef.current; const currentScope = scope; const signal = sessionControllerRef.current?.signal; setMutationError(null);
    try {
      const result = await apiResult<MutationReceipt>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action, projectId: project.id, conversationId: currentScope.conversationId, clientRequestId: newRequestId(action), expectedAudienceEpoch: state.audienceEpoch, messageId: message.id, expectedRevision: message.revision, ...(action === "edit" ? { body, mentionUserIds: [] } : {}) }), signal });
      if (!isCurrent(generation, signal)) return;
      if (!result.ok) { handleFailure(result, generation); if (result.code !== "unavailable" && result.code !== "unauthenticated") setMutationError(failureCopy[result.code]); return; }
      const history = await loadHistory(currentScope, stateRef.current.cursor, signal);
      if (!isCurrent(generation, signal)) return;
      if (history.ok) applyDelta(history.value, generation); else handleFailure(history, generation);
      setEditing(null);
    } catch { if (isCurrent(generation, signal)) setMutationError("The change outcome is unknown. Refresh history before trying again."); }
  }

  const members = audience?.members ?? [];
  const audienceReady = audience !== null && state.audienceEpoch !== null && audience.audienceEpoch === state.audienceEpoch;
  const audienceNeedsReview = state.audienceEpoch !== null && (!audienceReady || state.reviewedAudienceEpoch !== state.audienceEpoch);
  const bodyValid = validMessageBody(state.draft); const bodyBytes = new TextEncoder().encode(state.draft).byteLength;
  const title = project.name;
  const audienceDescription = audienceReady ? `Visible to ${members.length} current members · ${members.map((member) => member.name).join(", ")}` : "Visible to current Project members · membership list updating";
  if (state.status === "unavailable") return <ConversationStatus title={title} message="This conversation is unavailable. It may have been removed or you may no longer have access." />;
  if (scope === undefined) return <ConversationStatus action={startFailure ? retryBootstrap : undefined} actionLabel="Retry" error={startFailure && startFailure !== "temporarily_unavailable" ? failureCopy[startFailure] : null} title={title} message={state.status === "offline" ? "Conversation history is offline. Your draft stays here; nothing will send automatically." : "Loading conversation…"} />;
  if (scope === null) return <ConversationStatus action={startConversation} actionLabel="Start conversation" error={startFailure ? failureCopy[startFailure] : null} title={title} message="No Project conversation has been started yet." />;

  return <main className={styles.main}>
    {fixtureActor ? <div className={styles.synthetic}>Synthetic live client · actor {fixtureActor} · no customer data</div> : null}
    <AudienceHeader description={audienceDescription} onToggleRelated={() => {}} relatedOpen={false} showRelatedWork={false} status={scope.lifecycle === "archived" ? "archived" : "active"} title={title} />
    <div className={styles.viewBar}><button onClick={onToggleView} type="button">{view === "full" ? "Context panel" : "Full view"}</button><span>{state.status === "offline" ? "Offline · retrying" : state.status === "ready" && !catchingUp ? "History up to date" : "Updating history"}</span></div>
    {audienceNeedsReview ? <div className={styles.notice}><strong>{audienceReady ? "Audience changed" : "Checking audience"}</strong><span>{audienceReady ? "Review the current members before sending this draft." : "Sending is paused until the current Project membership is available."}</span>{audienceReady ? <button onClick={() => dispatch({ type: "review_audience", audienceEpoch: audience.audienceEpoch })} type="button">Review audience</button> : null}</div> : null}
    {scope.lifecycle === "archived" ? <div className={styles.notice}><strong>Read-only history</strong><span>Restore the Project before sending or changing messages.</span></div> : null}
    {sendsOff ? <div className={styles.notice}><strong>Sends are off</strong><span>Existing history remains available.</span></div> : null}
    {mutationError ? <div className={styles.errorNotice} role="alert">{mutationError}</div> : null}
    <div className={styles.feedScroller} onScroll={() => rememberScroll(scope)} ref={feedRef}><ol aria-label="Conversation history" className={styles.feed}>
      {state.messages.length === 0 && state.pending.length === 0 ? <li className={styles.emptyHistory}>No messages yet. Start with the decision or question the Project needs.</li> : null}
      {state.messages.map((message) => <LiveMessage actorId={actorId} editing={editing} key={message.id} members={members} message={message} onCancelEdit={() => setEditing(null)} onDelete={() => void mutate("tombstone", message)} onEdit={(body) => void mutate("edit", message, body)} onStartEdit={() => message.body && setEditing({ id: message.id, body: message.body, revision: message.revision })} setEditing={setEditing} />)}
      {state.pending.map((pending) => <li className={styles.pendingMessage} key={pending.input.clientRequestId}><strong>You</strong><p>{pending.input.body}</p><span>{pending.state === "pending" ? "Sending…" : pending.state === "uncertain" ? "Checking whether this sent" : `Not sent · ${pending.error ? failureCopy[pending.error] : "try again"}`}</span>{pending.state !== "pending" ? <button onClick={() => void resolveSend(pending)} type="button">Check receipt, then retry</button> : null}</li>)}
    </ol></div>
    <section aria-label="Message composer" className={styles.composer}>{state.status === "offline" ? <p>Offline. Your draft stays here; nothing will send automatically.</p> : scope.lifecycle === "archived" || sendsOff ? <p>{scope.lifecycle === "archived" ? "This conversation is read only." : "Sending is currently turned off."}</p> : <>
      <textarea aria-label={`Message ${project.name}`} maxLength={CONVERSATION_LIMITS.bodyCharacters} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { const mobileReturn = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches; if (!event.nativeEvent.isComposing && event.key === "Enter" && !event.shiftKey && !mobileReturn) { event.preventDefault(); void send(); } }} placeholder={`Message ${project.name}`} rows={3} value={state.draft} />
      <div><span data-invalid={state.draft.length > 0 && (!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes) || undefined}>{Array.from(state.draft).length.toLocaleString()} / {CONVERSATION_LIMITS.bodyCharacters.toLocaleString()}</span><button disabled={!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes || audienceNeedsReview} onClick={() => void send()} type="button">Send</button></div>
    </>}</section>
  </main>;
}

function LiveMessage({ actorId, message, members, editing, setEditing, onStartEdit, onCancelEdit, onEdit, onDelete }: Readonly<{ actorId: string; message: MessageRecord; members: Audience["members"]; editing: { id: string; body: string; revision: number } | null; setEditing: (value: { id: string; body: string; revision: number } | null) => void; onStartEdit: () => void; onCancelEdit: () => void; onEdit: (body: string) => void; onDelete: () => void }>) {
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const name = members.find((member) => member.id === message.authorId)?.name ?? (message.authorId === actorId ? "You" : "Project member");
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const cancelAndRestoreFocus = () => { onCancelEdit(); requestAnimationFrame(() => editButtonRef.current?.focus()); };
  return <li className={styles.message}><span className={styles.avatar}>{initials}</span><div><div className={styles.messageMeta}><strong>{name}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{message.editedAt ? <span>Edited</span> : null}</div>{message.body === null ? <p className={styles.deleted}>Message removed</p> : editing?.id === message.id ? <div className={styles.editForm}><textarea aria-label="Edit message" autoFocus onChange={(event) => setEditing({ ...editing, body: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelAndRestoreFocus(); } }} value={editing.body} /><div><button onClick={cancelAndRestoreFocus} type="button">Cancel</button><button disabled={!validMessageBody(editing.body)} onClick={() => onEdit(editing.body)} type="button">Save edit</button></div></div> : <p>{message.body}</p>}{message.authorId === actorId && message.body !== null && editing?.id !== message.id ? <div className={styles.messageActions}><button onClick={onStartEdit} ref={editButtonRef} type="button">Edit</button><button onClick={onDelete} type="button">Delete</button></div> : null}</div></li>;
}

function ConversationStatus({ title, message, action, actionLabel, error }: Readonly<{ title: string; message: string; action?: () => void; actionLabel?: string; error?: string | null }>) {
  return <main className={styles.main}><div className={styles.status}><Icon size={22}><path d="M4 5h16v12H9l-5 4Z" /></Icon><h1>{title}</h1><p>{message}</p>{error ? <span role="alert">{error}</span> : null}{action && actionLabel ? <button onClick={action} type="button">{actionLabel}</button> : null}</div></main>;
}
