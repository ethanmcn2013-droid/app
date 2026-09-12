"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationDelta, ConversationFailure, ConversationResult, MessagePage, MessageReceipt, MessageRecord, SendInput } from "@/lib/conversations/contracts";
import { CONVERSATION_LIMITS, normalizeMessageBody, validMessageBody } from "@/lib/conversations/contracts";
import { conversationReducer, emptyConversationState, type PendingSend } from "@/lib/conversations/reducer";
import { ConversationPoller } from "@/lib/conversations/polling";
import { AudienceHeader, Icon } from "./prototype-panels";
import { MemberMentionPicker } from "./member-mention-picker";
import { TaskDiscussionDirectory } from "./task-discussion-directory";
import { DirectMessageControls, DirectMessageDirectory, type DirectMessageScope } from "./direct-message-directory";
import { resolveTaskOutcome, type TaskOutcomeSubmission } from "./task-outcome-client";
import { TaskOutcomeForm, type TaskOutcomeRequest, type TaskOutcomeResult } from "./task-outcome-form";
import { anchoredScrollTop, resolveScrollAnchor, type ScrollAnchor, audienceResponseMatches, conversationHeaders, draftKey, forgetProjectDrafts, forgetConversationDrafts, needsFreshAudienceSend, rememberDraft, shouldSendComposerKey, type DraftCache, type OutgoingCache, type ScrollCache } from "./conversation-client-model";
import styles from "./conversation-workspace.module.css";

type ProjectOption = Readonly<{ id: ProjectId; name: string }>;
type ConversationScope = Readonly<{ conversationId: string; projectId: ProjectId; kind: "project"; audienceEpoch: number; lifecycle: "active" | "archived" }> | DirectMessageScope;
type Audience = Readonly<{ audienceEpoch: number; members: readonly Readonly<{ id: string; name: string }>[] }>;
type MutationReceipt = Readonly<{ messageId: string; clientRequestId: string; changeSeq: number; revision: number; committedAt: number }>;
type GeneratedAction =
  | Readonly<{ type: "delta"; delta: ConversationDelta }>
  | Readonly<{ type: "page"; page: MessagePage; initialize: boolean }>
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
  const [direct, setDirect] = useState<DirectMessageScope | null>(null);
  const [draftCache] = useState<DraftCache>(() => new Map());
  const [scrollCache] = useState<ScrollCache>(() => new Map());
  const [outgoingCache] = useState<OutgoingCache>(() => new Map());
  if (!projectId || projects.length === 0) return <main className={styles.noProjects}><h1>Messages</h1><p>Add a Project before starting a Project conversation.</p></main>;
  const selected = projects.find((project) => project.id === projectId) ?? projects[0];
  return <section className={styles.workspace} data-view={view}>
    <aside className={styles.projectList}>
      <div className={styles.listHeading}><h1>Messages</h1><span>Project conversations</span></div>
      {projects.map((project) => <button aria-current={project.id === selected.id ? "page" : undefined} aria-label={project.name} key={project.id} onClick={() => { setDirect(null); setProjectId(project.id); }} type="button"><span>{project.name.slice(0, 2).toUpperCase()}</span><strong>{project.name}</strong></button>)}
      <DirectMessageDirectory key={selected.id} actorId={actorId} projectId={selected.id} fixtureActor={fixtureActor} selectedId={direct?.conversationId} onSelect={setDirect} />
      <TaskDiscussionDirectory key={`tasks:${selected.id}`} projectId={selected.id} fixtureActor={fixtureActor} />
      <p>Messages stay inside their named Project.</p>
    </aside>
    <ProjectConversationSession directId={direct?.conversationId} actorId={actorId} outgoingCache={outgoingCache} draftCache={draftCache} fixtureActor={fixtureActor} key={`${actorId}:${selected.id}:${direct?.conversationId ?? "project"}`} onToggleView={() => setView((current) => current === "full" ? "context" : "full")} project={selected} projects={projects} scrollCache={scrollCache} view={view} />
  </section>;
}

function ProjectConversationSession({ actorId, project, projects, fixtureActor, directId, rootId = null, onCloseThread, draftCache, outgoingCache, scrollCache, view, onToggleView }: Readonly<{ actorId: string; project: ProjectOption; projects: readonly ProjectOption[]; fixtureActor?: string; directId?: string; rootId?: string | null; onCloseThread?: () => void; draftCache: DraftCache; outgoingCache: OutgoingCache; scrollCache: ScrollCache; view: "full" | "context"; onToggleView: () => void }>) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, () => emptyConversationState(actorId, `${project.id}:pending`, 1));
  const draftMentionUserIds = state.draftMentionUserIds;
  const setDraftMentionUserIds = (ids: readonly string[]) => dispatch({ type: "draft_mentions", ids });
  const [showDetails, setShowDetails] = useState(false);
  const [openedRoot, setOpenedRoot] = useState<string | null>(null);
  const [scope, setScope] = useState<ConversationScope | null | undefined>(undefined);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [startFailure, setStartFailure] = useState<ConversationFailure["code"] | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [outgoingHydrated, setOutgoingHydrated] = useState(false);
  const replyTriggerRef = useRef<HTMLElement | null>(null);
  const taskTriggerRef = useRef<HTMLElement | null>(null);
  const [sendsOff, setSendsOff] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [catchingUp, setCatchingUp] = useState(false);
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string; revision: number } | null>(null);
  const [taskSource, setTaskSource] = useState<Pick<TaskOutcomeRequest, "sourceProjectId" | "conversationId" | "messageId" | "expectedRevision" | "expectedAudienceEpoch"> | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Record<string, string>>({});
  const stateRef = useRef(state);
  const generationRef = useRef(1);
  const historyEpochRef = useRef<number | null>(null);
  const audienceRef = useRef<Audience | null>(null);
  const sessionControllerRef = useRef<AbortController | null>(null);
  const pollerRef = useRef<ConversationPoller<ConversationResult<ConversationDelta>> | null>(null);
  const scrollLoadedFor = useRef<string | null>(null);
  const scrollAnchorRef = useRef<ScrollAnchor | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const catchupRef = useRef<number | null>(null);
  const dispatchAt = (generation: number, action: GeneratedAction) => dispatch({ ...action, generation });
  const isCurrent = (generation: number, signal?: AbortSignal) => generation === generationRef.current && !signal?.aborted;

  useEffect(() => { stateRef.current = state; }, [state]);

  const scopeCacheKey = (currentScope: ConversationScope) => draftKey(actorId, project.id, currentScope.conversationId, rootId);
  function restoreScopedOutgoing(currentScope: ConversationScope, generation: number) {
    const key = scopeCacheKey(currentScope);
    const draft = draftCache.get(key);
    if (draft) dispatch({ type: "draft", value: draft });
    const outgoing = outgoingCache.get(key);
    if (outgoing) dispatch({ type: "resume_outgoing", generation, ...outgoing });
    setOutgoingHydrated(true);
  }
  function rememberScroll(currentScope = scope) {
    const node = feedRef.current;
    if (node && currentScope) scrollCache.set(scopeCacheKey(currentScope), { top: node.scrollTop, bottomDistance: Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop) });
  }
  function captureScrollAnchor(mode: "live" | "prepend" = "live") {
    const node = feedRef.current;
    if (node) scrollAnchorRef.current = { top: node.scrollTop, bottomDistance: Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop), mode };
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
    historyEpochRef.current = null; setBootstrapReady(false); setOutgoingHydrated(false);
    clearAudience(); setEditing(null); setTaskSource(null); setCreatedTasks({}); setMutationError(null); setSendsOff(false); setHasOlder(false); setOlderCursor(null); setCatchingUp(false);
    dispatch({ type: "reset", actorId, scopeKey, generation });
    return { generation, controller };
  }
  function revoke(generation: number, failure: ConversationFailure) {
    if (!isCurrent(generation)) return;
    dispatchAt(generation, { type: "refused", failure });
    generationRef.current = generation + 1;
    sessionControllerRef.current?.abort(); pollerRef.current?.stop();
    if (directId) { forgetConversationDrafts(draftCache, actorId, project.id, directId); forgetConversationDrafts(outgoingCache, actorId, project.id, directId); }
    else { forgetProjectDrafts(draftCache, actorId, project.id); forgetProjectDrafts(outgoingCache, actorId, project.id); }
    if (scope) scrollCache.delete(scopeCacheKey(scope));
    historyEpochRef.current = null; clearAudience(); setEditing(null); setOpenedRoot(null); setTaskSource(null); setCreatedTasks({}); setMutationError(null); setScope(undefined);
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
    dispatchAt(generation, { type: "delta", delta: { ...delta, messages: delta.messages.filter((message) => rootId ? message.id === rootId || message.rootId === rootId : message.rootId === null) } });
  }
  function acceptAudience(value: Audience, generation: number, expectedEpoch: number) {
    if (!audienceResponseMatches(generation, generationRef.current, expectedEpoch, historyEpochRef.current, value.audienceEpoch)) return false;
    audienceRef.current = value; setAudience(value); return true;
  }
  const requestAudience = (signal?: AbortSignal) => apiResult<Audience>(apiUrl(directId ? "dm-audience" : "audience", project.id, directId ? { conversationId: directId } : {}), fixtureActor, { signal });
  const loadHistory = (currentScope: ConversationScope, afterChangeSeq: number, signal?: AbortSignal) => apiResult<ConversationDelta>(apiUrl("history", project.id, { conversationId: currentScope.conversationId, afterChangeSeq, limit: 100 }), fixtureActor, { signal });
  const loadMessages = (currentScope: ConversationScope, beforeCreateSeq?: number, signal?: AbortSignal) => apiResult<MessagePage>(apiUrl("messages", project.id, { conversationId: currentScope.conversationId, limit: 100, ...(rootId ? { rootId } : {}), ...(beforeCreateSeq === undefined ? {} : { beforeCreateSeq }) }), fixtureActor, { signal });
  async function refreshAudience(expectedEpoch: number, generation: number, signal?: AbortSignal) {
    const result = await requestAudience(signal);
    if (!isCurrent(generation, signal)) return;
    if (result.ok) acceptAudience(result.value, generation, expectedEpoch); else { handleFailure(result, generation); if (result.code === "temporarily_unavailable") throw new Error("retryable_audience_failure"); }
  }

  async function loadThroughCurrent(currentScope: ConversationScope, generation: number, signal: AbortSignal, first?: ConversationDelta): Promise<{ finalPage: ConversationDelta | null; caughtUp: boolean }> {
    let page = first ?? null;
    let lastPage: ConversationDelta | null = null;
    let cursor = page?.throughChangeSeq ?? 0;
    for (let pageCount = 0; pageCount < 10 && isCurrent(generation, signal); pageCount++) {
      if (!page) {
        const result = await loadHistory(currentScope, cursor, signal);
        if (!result.ok) { handleFailure(result, generation); if (result.code === "temporarily_unavailable") throw new Error("retryable_history_failure"); return { finalPage: null, caughtUp: false }; }
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
    sessionControllerRef.current?.abort();
    const controller = new AbortController();
    sessionControllerRef.current = controller;
    void apiResult<ConversationScope | null>(apiUrl(directId ? "dm-scope" : "project", project.id, directId ? { conversationId: directId } : {}), fixtureActor, { signal: controller.signal }).then(async (result) => {
      if (!isCurrent(generation, controller.signal)) return;
      if (!result.ok) { setStartFailure(result.code); handleFailure(result, generation); return; }
      setScope(result.value);
      if (!result.value) return;
      if (result.value.kind === "dm" && !result.value.canRead) { forgetConversationDrafts(draftCache, actorId, project.id, result.value.conversationId); forgetConversationDrafts(outgoingCache, actorId, project.id, result.value.conversationId); return; }
      restoreScopedOutgoing(result.value, generation);
      const [page, audienceResult] = await Promise.all([loadMessages(result.value, undefined, controller.signal), requestAudience(controller.signal)]);
      if (!isCurrent(generation, controller.signal)) return;
      if (!page.ok) { handleFailure(page, generation); if (page.code === "temporarily_unavailable") throw new Error("retryable_page_failure"); return; }
      historyEpochRef.current = page.value.audienceEpoch;
      dispatchAt(generation, { type: "page", page: page.value, initialize: true });
      setBootstrapReady(true);
      setHasOlder(page.value.hasOlder); setOlderCursor(page.value.beforeCreateSeq); setCatchingUp(false);
      if (audienceResult.ok) {
        if (!acceptAudience(audienceResult.value, generation, page.value.audienceEpoch)) await refreshAudience(page.value.audienceEpoch, generation, controller.signal);
      } else handleFailure(audienceResult, generation);
    }).catch(() => { if (isCurrent(generation, controller.signal)) { setStartFailure("temporarily_unavailable"); dispatchAt(generation, { type: "offline" }); } });
    return () => { controller.abort(); if (sessionControllerRef.current === controller) sessionControllerRef.current = null; };
  // Project-keyed session reruns only for an explicit retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapAttempt]);

  function retryBootstrap() { advanceSession(`${project.id}:pending`); setScope(undefined); setStartFailure(null); setBootstrapAttempt((current) => current + 1); }

  useEffect(() => {
    if (!directId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refreshPair() {
      try {
        const result = await apiResult<DirectMessageScope>(apiUrl("dm-scope", project.id, { conversationId: directId! }), fixtureActor, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!result.ok) { if (result.code === "unavailable" || result.code === "unauthenticated") revoke(generationRef.current, result); }
        else if (scope?.kind === "dm" && (result.value.audienceEpoch !== scope.audienceEpoch || result.value.pairState !== scope.pairState)) retryBootstrap();
      } catch { /* The existing history poller reports connectivity without discarding drafts. */ }
      finally { if (!controller.signal.aborted) timer = setTimeout(refreshPair, 3000); }
    }
    timer = setTimeout(refreshPair, 3000);
    return () => { controller.abort(); clearTimeout(timer); };
  // Pair metadata is refreshed independently, including before consent permits history.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directId, scope]);

  useEffect(() => {
    if (!scope || !bootstrapReady) return;
    const generation = generationRef.current;
    const poller = new ConversationPoller<ConversationResult<ConversationDelta>>({
      isRetryable: (result) => !result.ok && result.code === "temporarily_unavailable",
      poll: ({ conversationId }, signal) => loadHistory({ ...scope, conversationId }, stateRef.current.cursor, signal),
      apply: async (result) => {
        if (!isCurrent(generation)) return;
        if (result.ok) {
          if (catchupRef.current !== null) return;
          catchupRef.current = generation;
          const signal = sessionControllerRef.current?.signal ?? new AbortController().signal;
          try {
            const catchup = await loadThroughCurrent(scope, generation, signal, result.value);
            if (!catchup.finalPage || !isCurrent(generation)) return;
            setCatchingUp(!catchup.caughtUp);
            if (audienceRef.current?.audienceEpoch === catchup.finalPage.audienceEpoch) return;
            await refreshAudience(catchup.finalPage.audienceEpoch, generation, signal);
          } finally { if (catchupRef.current === generation) catchupRef.current = null; }
        } else if (result.code === "resync_required") {
          // A server-directed new baseline is a new generation, never a
          // lower-cursor page mixed into the current generation's records.
          retryBootstrap();
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
  }, [scope?.conversationId, bootstrapReady]);

  useEffect(() => {
    if (!scope || !outgoingHydrated || state.status === "unavailable") return;
    const key = scopeCacheKey(scope);
    rememberDraft(draftCache, key, state.draft);
    if (state.draft || draftMentionUserIds.length || state.pending.length || state.recoveredDrafts.length) outgoingCache.set(key, { pending: state.pending, recoveredDrafts: state.recoveredDrafts, reviewedAudienceEpoch: state.reviewedAudienceEpoch, draftMentionUserIds });
    else outgoingCache.delete(key);
  // Only this session owns the scope tuple.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, outgoingHydrated, outgoingCache, draftCache, state.draft, state.pending, state.recoveredDrafts, state.reviewedAudienceEpoch, state.status, draftMentionUserIds]);
  // Save this exact scope's scroll position as the keyed session unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => rememberScroll(), [scope]);
  useLayoutEffect(() => {
    const node = feedRef.current;
    if (!node || !scope || state.status !== "ready") return;
    const key = scopeCacheKey(scope);
    if (scrollLoadedFor.current !== key) {
      scrollLoadedFor.current = key;
      const saved = scrollCache.get(key);
      if (saved) node.scrollTop = saved.bottomDistance < 80 ? anchoredScrollTop(node.scrollHeight, node.clientHeight, saved.bottomDistance) : saved.top;
      else node.scrollTop = node.scrollHeight;
    } else if (scrollAnchorRef.current !== null) {
      node.scrollTop = resolveScrollAnchor(node.scrollHeight, node.clientHeight, scrollAnchorRef.current);
      scrollAnchorRef.current = null;
    }
  // scopeCacheKey is a pure tuple builder scoped to this keyed session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scrollCache, state.cursor, state.messages.length, state.pending.length, state.status]);

  function updateDraft(value: string) { if (scope) { dispatch({ type: "draft", value }); rememberDraft(draftCache, scopeCacheKey(scope), value); } }

  async function startConversation() {
    let requestGeneration = generationRef.current; let signal = sessionControllerRef.current?.signal; setStartFailure(null);
    try {
      const result = await apiResult<ConversationScope>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "ensure", projectId: project.id }), signal });
      if (!isCurrent(requestGeneration, signal)) return;
      if (!result.ok) { setStartFailure(result.code); handleFailure(result, requestGeneration); return; }
      const { generation, controller } = advanceSession(`${project.id}:${result.value.conversationId}`); requestGeneration = generation; signal = controller.signal; setScope(result.value);
      restoreScopedOutgoing(result.value, generation);
      const [page, audienceResult] = await Promise.all([loadMessages(result.value, undefined, controller.signal), requestAudience(controller.signal)]);
      if (!isCurrent(generation, controller.signal)) return;
      if (!page.ok) { handleFailure(page, generation); if (page.code === "temporarily_unavailable") throw new Error("retryable_page_failure"); return; }
      historyEpochRef.current = page.value.audienceEpoch;
      dispatchAt(generation, { type: "page", page: page.value, initialize: true });
      setBootstrapReady(true);
      setHasOlder(page.value.hasOlder); setOlderCursor(page.value.beforeCreateSeq); setCatchingUp(false);
      if (audienceResult.ok) {
        if (!acceptAudience(audienceResult.value, generation, page.value.audienceEpoch)) await refreshAudience(page.value.audienceEpoch, generation, controller.signal);
      } else handleFailure(audienceResult, generation);
    } catch { if (isCurrent(requestGeneration, signal)) { setStartFailure("temporarily_unavailable"); dispatchAt(requestGeneration, { type: "offline" }); } }
  }

  async function loadOlder() {
    if (!scope || !hasOlder || olderCursor === null || loadingOlder) return;
    const generation = generationRef.current; const signal = sessionControllerRef.current?.signal;
    setLoadingOlder(true);
    try {
      const page = await loadMessages(scope, olderCursor, signal);
      if (!isCurrent(generation, signal)) return;
      if (!page.ok) { handleFailure(page, generation); if (page.code === "temporarily_unavailable") throw new Error("retryable_page_failure"); return; }
      captureScrollAnchor("prepend"); dispatchAt(generation, { type: "page", page: page.value, initialize: false });
      setHasOlder(page.value.hasOlder); setOlderCursor(page.value.beforeCreateSeq);
    } catch { if (isCurrent(generation, signal)) dispatchAt(generation, { type: "offline" }); }
    finally { if (isCurrent(generation, signal)) setLoadingOlder(false); }
  }

  function restoreForFreshAudience(pending: PendingSend, generation: number) {
    if (!isCurrent(generation) || !scope) return;
    clearAudience(); dispatchAt(generation, { type: "restore_absent", requestId: pending.input.clientRequestId });
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
      else if (result.code === "temporarily_unavailable" || result.code === "rate_limited") dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId });
      else handleFailure(result, generation, pending.input.clientRequestId);
    } catch { if (isCurrent(generation, signal)) dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId }); }
  }

  async function send() {
    const audienceReady = audience !== null && audience.audienceEpoch === state.audienceEpoch;
    if (!scope || (scope.kind === "dm" && !scope.canWrite) || !audienceReady || state.audienceEpoch === null || state.reviewedAudienceEpoch !== state.audienceEpoch || draftMentionUserIds.some((id) => !audience.members.some((member) => member.id === id)) || !validMessageBody(state.draft) || sendsOff || scope.lifecycle === "archived") return;
    const input: SendInput = { projectId: project.id, conversationId: scope.conversationId, clientRequestId: newRequestId(), expectedAudienceEpoch: state.audienceEpoch, body: normalizeMessageBody(state.draft), rootId, mentionUserIds: draftMentionUserIds };
    const next = conversationReducer(state, { type: "submit", input });
    if (next === state) return;
    scrollAnchorRef.current = { top: 0, bottomDistance: 0, mode: "live" }; dispatch({ type: "submit", input }); rememberDraft(draftCache, scopeCacheKey(scope), ""); await resolveSend(next.pending[next.pending.length - 1]);
  }

  async function mutate(action: "edit" | "tombstone", message: MessageRecord, body?: string) {
    const audienceReady = audience !== null && audience.audienceEpoch === state.audienceEpoch;
    if (!scope || (scope.kind === "dm" && !scope.canWrite) || !audienceReady || state.audienceEpoch === null || sendsOff || scope.lifecycle === "archived") return;
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

  async function submitTask(input: TaskOutcomeRequest): Promise<TaskOutcomeSubmission> {
    const generation = generationRef.current;
    const signal = sessionControllerRef.current?.signal;
    return resolveTaskOutcome(input, {
      isCurrent: () => isCurrent(generation, signal),
      lookup: (clientRequestId) => apiResult(apiUrl("task-receipt", project.id, { clientRequestId }), fixtureActor, { signal }),
      promote: ({ sourceProjectId, ...fields }) => apiResult<TaskOutcomeResult>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "promote-task", projectId: sourceProjectId, ...fields }), signal }),
    });
  }

  function closeTaskOutcome() {
    setTaskSource(null);
    const trigger = taskTriggerRef.current;
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); else feedRef.current?.focus(); });
  }

  const members = audience?.members ?? [];
  const audienceReady = audience !== null && state.audienceEpoch !== null && audience.audienceEpoch === state.audienceEpoch;
  const audienceNeedsReview = state.audienceEpoch !== null && (!audienceReady || state.reviewedAudienceEpoch !== state.audienceEpoch);
  const canChange = audienceReady && !audienceNeedsReview && !sendsOff && scope?.lifecycle === "active" && (scope.kind !== "dm" || scope.canWrite);
  const unavailableMention = audienceReady && draftMentionUserIds.some((id) => !members.some((member) => member.id === id));
  const removedRoot = rootId !== null && state.messages.some((message) => message.id === rootId && message.body === null);
  const bodyValid = validMessageBody(state.draft); const bodyBytes = new TextEncoder().encode(state.draft).byteLength;
  const SessionContainer = rootId ? "section" : "main";
  const title = rootId ? "Replies" : scope?.kind === "dm" ? scope.other.name : project.name;
  const audienceDescription = scope?.kind === "dm" ? `Private conversation in ${project.name} · exactly two people` : audienceReady ? `Visible to ${members.length} current members · ${members.map((member) => member.name).join(", ")}` : "Visible to current Project members · membership list updating";
  if (state.status === "unavailable") return <ConversationStatus title={title} message="This conversation is unavailable. It may have been removed or you may no longer have access." />;
  if (scope === undefined) return <ConversationStatus action={startFailure ? retryBootstrap : undefined} actionLabel="Retry" error={startFailure && startFailure !== "temporarily_unavailable" ? failureCopy[startFailure] : null} title={title} message={state.status === "offline" ? "Conversation history is offline. Your draft stays here; nothing will send automatically." : "Loading conversation…"} />;
  if (scope === null) return <ConversationStatus action={startConversation} actionLabel="Start conversation" error={startFailure ? failureCopy[startFailure] : null} title={title} message="No Project conversation has been started yet." />;

  return <SessionContainer className={styles.main} data-thread={rootId ? "true" : undefined}>
    {onCloseThread ? <button autoFocus className={styles.closeThread} onClick={onCloseThread} type="button">← Back to conversation</button> : null}
    {fixtureActor && !rootId ? <div className={styles.synthetic}>Synthetic live client · actor {fixtureActor} · no customer data</div> : null}
    <AudienceHeader showTabs={!rootId} onShowDetails={() => setShowDetails((value) => !value)} description={audienceDescription} onToggleRelated={() => {}} relatedOpen={false} showRelatedWork={false} status={scope.lifecycle === "archived" ? "archived" : scope.kind === "dm" && !scope.canWrite ? scope.pairState : "active"} title={title} />
    {showDetails ? <section className={styles.pairControls} aria-label="Conversation details"><p>{audienceDescription}. Task outcomes keep their destination Project access; linking a task does not share this conversation.</p><button onClick={() => setShowDetails(false)} type="button">Close details</button></section> : null}
    {scope.kind === "dm" && !rootId ? <DirectMessageControls actorId={actorId} scope={scope} fixtureActor={fixtureActor} onChange={() => retryBootstrap()} /> : null}
    <div className={styles.viewBar}>{rootId ? <span>Replies to this message</span> : <button onClick={onToggleView} type="button">{view === "full" ? "Context panel" : "Full view"}</button>}<span>{scope.kind === "dm" && !scope.canRead ? scope.pairState === "pending" ? "Awaiting acceptance" : "Messages unavailable" : state.status === "offline" ? "Offline · retrying" : state.status === "ready" && !catchingUp ? "History up to date" : "Updating history"}</span></div>
    {audienceNeedsReview && (scope.kind !== "dm" || scope.canWrite) ? <div className={styles.notice}><strong>{audienceReady ? "Audience changed" : "Checking audience"}</strong><span>{audienceReady ? "Review the current members before sending this draft." : "Sending is paused until the current Project membership is available."}</span>{audienceReady ? <button onClick={() => dispatch({ type: "review_audience", audienceEpoch: audience.audienceEpoch })} type="button">Review audience</button> : null}</div> : null}
    {scope.lifecycle === "archived" ? <div className={styles.notice}><strong>Read-only history</strong><span>Restore the Project before sending or changing messages.</span></div> : null}
    {sendsOff ? <div className={styles.notice}><strong>Sends are off</strong><span>Existing history remains available.</span></div> : null}
    {mutationError ? <div className={styles.errorNotice} role="alert">{mutationError}</div> : null}
    <div aria-label="Message reading area" role="region" tabIndex={0} className={styles.feedScroller} onScroll={() => rememberScroll(scope)} ref={feedRef}><ol aria-label="Conversation history" className={styles.feed}>
      {hasOlder ? <li className={styles.olderHistory}><button disabled={loadingOlder} onClick={() => void loadOlder()} type="button">{loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}</button></li> : null}
      {state.messages.length === 0 && state.pending.length === 0 ? <li className={styles.emptyHistory}>{scope.kind === "dm" && !scope.canRead ? scope.pairState === "pending" ? "Messages will appear here after acceptance." : "You no longer have access to messages here." : rootId ? "No replies yet." : "No messages yet. Start with the decision or question the Project needs."}</li> : null}
      {state.messages.map((message) => <LiveMessage canMutate={canChange} onReply={!rootId ? () => { replyTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpenedRoot(message.id); } : undefined} actorId={actorId} editing={editing} key={message.id} members={members} message={message} taskCreated={Boolean(createdTasks[message.id])} onCreateTask={canChange ? () => { taskTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setTaskSource({ sourceProjectId: project.id, conversationId: scope.conversationId, messageId: message.id, expectedRevision: message.revision, expectedAudienceEpoch: state.audienceEpoch! }); } : undefined} onCancelEdit={() => setEditing(null)} onDelete={() => void mutate("tombstone", message)} onEdit={(body) => void mutate("edit", message, body)} onStartEdit={() => message.body && setEditing({ id: message.id, body: message.body, revision: message.revision })} setEditing={setEditing} />)}
      {state.pending.map((pending) => <li className={styles.pendingMessage} key={pending.input.clientRequestId}><strong>You</strong><p>{pending.input.body}</p><span>{pending.state === "pending" ? "Sending…" : pending.state === "uncertain" ? "Checking whether this sent" : `Not sent · ${pending.error ? failureCopy[pending.error] : "try again"}`}</span>{pending.state !== "pending" ? <button onClick={() => void resolveSend(pending)} type="button">Check receipt, then retry</button> : null}</li>)}
      {state.recoveredDrafts.map((draft) => <li className={styles.pendingMessage} key={`recovered:${draft.requestId}`}><strong>Earlier message was not sent</strong><p>{draft.body}</p><span>{state.draft || draftMentionUserIds.length ? "Your current draft is kept. Send or save it before restoring this text." : "Restore this text to review it with the current audience."}</span><button disabled={state.draft !== "" || draftMentionUserIds.length > 0} onClick={() => dispatch({ type: "restore_recovered", requestId: draft.requestId })} type="button">Restore draft</button><button onClick={() => dispatch({ type: "discard_recovered", requestId: draft.requestId })} type="button">Discard earlier draft</button></li>)}
    </ol></div>
    <section aria-label="Message composer" className={styles.composer}>{state.status === "offline" ? <p>Offline. Your draft stays here; nothing will send automatically.</p> : removedRoot || scope.lifecycle === "archived" || sendsOff || (scope.kind === "dm" && !scope.canWrite) ? <p>{scope.kind === "dm" && !scope.canRead && scope.pairState !== "pending" ? "Messages are unavailable to you." : removedRoot ? "The original message was removed. Existing replies remain available." : scope.lifecycle === "archived" ? "This conversation is read only." : scope.kind === "dm" && !scope.canWrite ? "Messages are paused until both people can participate." : "Sending is currently turned off."}</p> : <>
      <textarea aria-label={rootId ? "Write a reply" : `Message ${title}`} maxLength={CONVERSATION_LIMITS.bodyCharacters} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { const mobileReturn = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches; if (shouldSendComposerKey({ key: event.key, shiftKey: event.shiftKey, composing: event.nativeEvent.isComposing, mobileReturn })) { event.preventDefault(); void send(); } }} placeholder={rootId ? "Write a reply" : `Message ${title}`} rows={3} value={state.draft} />
      {unavailableMention ? <p>A selected person is no longer available. Remove them from Notify people before sending.</p> : null}
      {audienceReady ? <MemberMentionPicker actorId={actorId} members={members} selected={draftMentionUserIds} onChange={setDraftMentionUserIds} /> : null}
      <div><span data-invalid={state.draft.length > 0 && (!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes) || undefined}>{Array.from(state.draft).length.toLocaleString()} / {CONVERSATION_LIMITS.bodyCharacters.toLocaleString()}</span><button disabled={!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes || audienceNeedsReview || unavailableMention} onClick={() => void send()} type="button">Send</button></div>
    </>}</section>
    {openedRoot && !rootId ? <ThreadFrame onClose={() => { setOpenedRoot(null); requestAnimationFrame(() => replyTriggerRef.current?.focus()); }}><ProjectConversationSession key={openedRoot} rootId={openedRoot} onCloseThread={() => { setOpenedRoot(null); requestAnimationFrame(() => replyTriggerRef.current?.focus()); }} directId={directId} actorId={actorId} project={project} projects={projects} fixtureActor={fixtureActor} draftCache={draftCache} outgoingCache={outgoingCache} scrollCache={scrollCache} view="context" onToggleView={() => { setOpenedRoot(null); requestAnimationFrame(() => replyTriggerRef.current?.focus()); }} /></ThreadFrame> : null}
    {taskSource ? <TaskOutcomeForm open actorId={actorId} fixture={Boolean(fixtureActor)} source={taskSource} projects={projects} onClose={closeTaskOutcome} loadDestination={(destinationId, signal) => apiResult(apiUrl("task-destination", destinationId), fixtureActor, { signal })} submit={submitTask} onCreated={(result) => { if (result.taskAvailable !== false) setCreatedTasks((current) => ({ ...current, [taskSource.messageId]: result.taskId })); }} /> : null}
  </SessionContainer>;
}

function LiveMessage({ canMutate, onReply, actorId, message, members, editing, setEditing, onStartEdit, onCancelEdit, onEdit, onDelete, onCreateTask, taskCreated }: Readonly<{ canMutate: boolean; onReply?: () => void; onCreateTask?: () => void; taskCreated: boolean; actorId: string; message: MessageRecord & { replyCount?: number }; members: Audience["members"]; editing: { id: string; body: string; revision: number } | null; setEditing: (value: { id: string; body: string; revision: number } | null) => void; onStartEdit: () => void; onCancelEdit: () => void; onEdit: (body: string) => void; onDelete: () => void }>) {
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const name = members.find((member) => member.id === message.authorId)?.name ?? (message.authorId === actorId ? "You" : "Project member");
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const cancelAndRestoreFocus = () => { onCancelEdit(); requestAnimationFrame(() => editButtonRef.current?.focus()); };
  return <li className={styles.message}><span className={styles.avatar}>{initials}</span><div><div className={styles.messageMeta}><strong>{name}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{message.editedAt ? <span>Edited</span> : null}</div>{message.body === null ? <p className={styles.deleted}>Message removed</p> : editing?.id === message.id ? <div className={styles.editForm}><textarea aria-label="Edit message" autoFocus onChange={(event) => setEditing({ ...editing, body: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelAndRestoreFocus(); } }} value={editing.body} /><div><button onClick={cancelAndRestoreFocus} type="button">Cancel</button><button disabled={!validMessageBody(editing.body)} onClick={() => onEdit(editing.body)} type="button">Save edit</button></div></div> : <p>{message.body}</p>}{message.body === null && onReply ? <div className={styles.messageActions}><button onClick={onReply} type="button">View replies</button></div> : null}{message.body !== null && editing?.id !== message.id ? <div className={styles.messageActions}>{onReply ? <button onClick={onReply} type="button">{message.replyCount ? `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}` : "Reply"}</button> : null}{onCreateTask ? <button onClick={onCreateTask} type="button">Create task</button> : null}{taskCreated ? <span>Task created</span> : null}{canMutate && message.authorId === actorId ? <><button onClick={onStartEdit} ref={editButtonRef} type="button">Edit</button><button onClick={onDelete} type="button">Delete</button></> : null}</div> : null}</div></li>;
}

function ThreadFrame({ children, onClose }: Readonly<{ children: ReactNode; onClose: () => void }>) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { const node = dialog.current; if (node && !node.open) node.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className={styles.threadPanel} aria-label="Message replies" onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}

function ConversationStatus({ title, message, action, actionLabel, error }: Readonly<{ title: string; message: string; action?: () => void; actionLabel?: string; error?: string | null }>) {
  return <main className={styles.main}><div className={styles.status}><Icon size={22}><path d="M4 5h16v12H9l-5 4Z" /></Icon><h1>{title}</h1><p>{message}</p>{error ? <span role="alert">{error}</span> : null}{action && actionLabel ? <button onClick={action} type="button">{actionLabel}</button> : null}</div></main>;
}
