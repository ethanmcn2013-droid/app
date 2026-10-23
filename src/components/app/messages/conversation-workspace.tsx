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
import { discardConversationFile } from "./conversation-attachment-client";
import { useConversationAttachments } from "./use-conversation-attachments";
import type { ConversationAttachmentCache } from "./conversation-attachment-drafts";
import { ConversationFilePicker, DraftConversationFiles, ConversationMessageFiles } from "./conversation-attachments";
import { useConversationCaches } from "./conversation-session-provider";
import { SavedDraftsPanel } from "./saved-drafts-panel";
import { hasDraftCapacity, listSavedDrafts, type SavedConversationScope } from "./conversation-client-model";
import { DirectMessageControls, DirectMessageDirectory, type DirectMessageScope } from "./direct-message-directory";
import { resolveTaskOutcome, type TaskOutcomeSubmission } from "./task-outcome-client";
import { TaskOutcomeForm, type TaskOutcomeRequest, type TaskOutcomeResult } from "./task-outcome-form";
import { anchoredScrollTop, resolveScrollAnchor, type ScrollAnchor, audienceResponseMatches, conversationHeaders, draftKey, forgetProjectDrafts, forgetConversationDrafts, needsFreshAudienceSend, rememberDraft, shouldSendComposerKey, type DraftCache, type OutgoingCache, type ScrollCache, retainConversationState } from "./conversation-client-model";
import styles from "./conversation-workspace.module.css";
import { ConversationOptions } from "./conversation-options";
import { useHiddenConversations } from "./use-hidden-conversations";
import { ChatDictationTools, ChatDraftCounter } from "./chat-composer-tools";
import { appendDictatedText } from "./chat-composer-model";
import { chatNavigationKey, shouldFocusChatTarget } from "./chat-navigation";
import { Avatar, ChatHeader, ChatIcon, ProjectTile } from "./chat-ui";
import { PingTile } from "./chat-marks";
import { PingPersonalAssistant } from "./ping-personal-assistant";
import type { AssistantSourceScope } from "@/lib/ping/assistant/release2";
import { routePrivatePingCommand, type PrivatePingForwardedRequest } from "./private-ping-command-router";

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

export type ConversationWorkspaceProps = Readonly<{ actorId: string; projects: readonly ProjectOption[]; initialProjectId?: ProjectId; initialConversationId?:string; initialRootId?: string; initialMessageId?: string; initialMessageSeq?: number; fixtureActor?: string; directMessagesEnabled?: boolean; privatePingEnabled?: boolean; visible?: boolean; navigationVersion?: number;
  /** The floating panel: one view at a time, with a way back to the chat list. */
  stacked?: boolean; onBack?: () => void; headerActions?: ReactNode }>;

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

function ConversationWorkspaceActor({ actorId, projects, initialProjectId, initialConversationId, initialRootId, initialMessageId, initialMessageSeq, fixtureActor, directMessagesEnabled = Boolean(fixtureActor), privatePingEnabled = false, visible = true, navigationVersion = 0, stacked = false, onBack, headerActions }: ConversationWorkspaceProps) {
  const initial = projects.some((project) => project.id === initialProjectId) ? initialProjectId! : projects[0]?.id;
  const [projectId, setProjectId] = useState<ProjectId | undefined>(initial);
  const [view, setView] = useState<"full" | "context">("full");
  // Stacked: the conversation, or this Project's direct messages and task threads.
  const [pane, setPane] = useState<"conversation" | "directory">("conversation");
  const [direct, setDirect] = useState<DirectMessageScope | null>(null);
  const [savedScope, setSavedScope] = useState<SavedConversationScope | null>(null);
  const hidden = useHiddenConversations(actorId);
  const requestKey = chatNavigationKey(navigationVersion, { projectId: initialProjectId, conversationId:initialConversationId, rootId: initialRootId, messageId: initialMessageId, messageSeq: initialMessageSeq });
  const [followedRequest, setFollowedRequest] = useState(requestKey);
  if (requestKey !== followedRequest) { setFollowedRequest(requestKey); setPane("conversation"); if (initialProjectId) { setProjectId(initialProjectId); setDirect(null); setSavedScope(null); } }
  const { drafts: draftCache, scroll: scrollCache, outgoing: outgoingCache, attachments: attachmentCache } = useConversationCaches(actorId);
  if (!projectId || projects.length === 0) return <section className={styles.noProjects}>{stacked ? <ChatHeader panel onBack={onBack} backLabel="All chats" title="Project conversations" actions={headerActions} /> : <h1>Chat</h1>}<p>Add a Project before starting a Project conversation.</p></section>;
  const selected = projects.find((project) => project.id === projectId) ?? { id: projectId, name: "Project" };
  const directId = directMessagesEnabled && initialConversationId && initialProjectId === selected.id ? initialConversationId : directMessagesEnabled ? (savedScope?.kind === "dm" ? savedScope.conversationId : direct?.conversationId) : undefined;
  const openSavedScope = (next: SavedConversationScope) => { if (next.kind === "dm" && !directMessagesEnabled) return; setDirect(null); setProjectId(next.projectId); setSavedScope(next); };
  return <section className={styles.workspace} data-view={view} data-stacked={stacked ? "" : undefined} data-pane={stacked ? pane : undefined}>
    <aside className={styles.projectList}>
      {stacked ? <ChatHeader panel onBack={() => setPane("conversation")} backLabel={`Back to ${selected.name}`} title="Direct messages and task threads" subtitle={selected.name} actions={headerActions} /> : <div className={styles.listHeading}><h1>Chat</h1><span>Project conversations</span></div>}
      {!stacked && projects.filter((project) => !hidden.hidden.includes(project.id)).map((project) => <div className={styles.projectRow} key={project.id} onContextMenu={(event) => { event.preventDefault(); const details = event.currentTarget.querySelector("details"); if (details) { details.open = true; details.querySelector("button")?.focus(); } }}><button aria-current={project.id === selected.id ? "page" : undefined} aria-label={project.name} onClick={() => { setSavedScope(null); setDirect(null); setProjectId(project.id); }} type="button"><span>{project.name.slice(0, 2).toUpperCase()}</span><strong>{project.name}</strong></button><ConversationOptions title={project.name} onHide={() => hidden.hide(project.id)} /></div>)}
      {!stacked && projects.some((project) => hidden.hidden.includes(project.id)) ? <details className={styles.hiddenConversations}><summary>Hidden conversations</summary>{projects.filter((project) => hidden.hidden.includes(project.id)).map((project) => <button key={project.id} onClick={() => { hidden.restore(project.id); setProjectId(project.id); setDirect(null); setSavedScope(null); }} type="button">Show {project.name}</button>)}</details> : null}
      {directMessagesEnabled ? <DirectMessageDirectory key={selected.id} actorId={actorId} projectId={selected.id} fixtureActor={fixtureActor} selectedId={directId} onSelect={(next) => { setSavedScope(null); setDirect(next); setPane("conversation"); }} /> : null}
      <TaskDiscussionDirectory key={`tasks:${selected.id}`} projectId={selected.id} fixtureActor={fixtureActor} />
      <p>Messages stay inside their named Project.</p>
    </aside>
    <ProjectConversationSession stacked={stacked} privatePingEnabled={privatePingEnabled} onBack={onBack} headerActions={headerActions} onOpenDirectory={stacked ? () => setPane("directory") : undefined} navigationRequestKey={requestKey} visible={visible && (!stacked || pane === "conversation")} directId={directId} initialRootId={savedScope?.rootId ?? initialRootId} initialMessageId={initialMessageId} initialMessageSeq={initialMessageSeq} onOpenSavedScope={openSavedScope} actorId={actorId} attachmentCache={attachmentCache} outgoingCache={outgoingCache} draftCache={draftCache} fixtureActor={fixtureActor} key={`${actorId}:${selected.id}:${directId ?? "project"}:${savedScope?.rootId ?? ""}`} onToggleView={() => setView((current) => current === "full" ? "context" : "full")} project={selected} projects={projects} scrollCache={scrollCache} view={view} />
  </section>;
}

type ProjectConversationSessionProps = Readonly<{
  actorId: string;
  privatePingEnabled?:boolean;
  project: ProjectOption;
  projects: readonly ProjectOption[];
  fixtureActor?: string;
  directId?: string;
  rootId?: string | null;
  initialRootId?: string;
  initialMessageId?: string;
  initialMessageSeq?: number;
  onOpenSavedScope: (scope: SavedConversationScope) => void;
  onCloseThread?: () => void;
  draftCache: DraftCache;
  outgoingCache: OutgoingCache;
  attachmentCache: ConversationAttachmentCache;
  scrollCache: ScrollCache;
  view: "full" | "context";
  onToggleView: () => void;
  visible?: boolean;
  navigationRequestKey?: string;
  stacked?: boolean;
  onBack?: () => void;
  onOpenDirectory?: () => void;
  headerActions?: ReactNode;
}>;

function ProjectConversationSession({ actorId, project, projects, fixtureActor, directId, rootId = null, initialRootId, initialMessageId, initialMessageSeq, onOpenSavedScope, onCloseThread, draftCache, outgoingCache, attachmentCache, scrollCache, view, onToggleView, visible = true, navigationRequestKey = "", stacked = false, onBack, onOpenDirectory, headerActions, privatePingEnabled=false }: ProjectConversationSessionProps) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, () => emptyConversationState(actorId, `${project.id}:pending`, 1));
  const [privatePingSource,setPrivatePingSource]=useState<AssistantSourceScope|null>(null);
  const [privatePingForwarded,setPrivatePingForwarded]=useState<PrivatePingForwardedRequest|null>(null);
  const [privatePingNotice,setPrivatePingNotice]=useState<string|null>(null);
  const privatePingTriggerRef=useRef<HTMLButtonElement>(null);
  const draftMentionUserIds = state.draftMentionUserIds;
  const setDraftMentionUserIds = (ids: readonly string[]) => {
    if (ids.length && scope && !hasDraftCapacity(draftCache, outgoingCache, scopeCacheKey(scope), 20, attachmentCache)) { setDraftLimitReached(true); return; }
    dispatch({ type: "draft_mentions", ids });
  };
  const [showDetails, setShowDetails] = useState(false);
  const [draftLimitReached, setDraftLimitReached] = useState(false);
  const [openedRoot, setOpenedRoot] = useState<string | null>(initialRootId ?? null);
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
  const observedMessagesRef = useRef(new Set<string>());
  const [unreadMessageIds, setUnreadMessageIds] = useState<ReadonlySet<string>>(new Set());
  const targetScrolledRef = useRef(false);
  const dispatchAt = (generation: number, action: GeneratedAction) => dispatch({ ...action, generation });
  const isCurrent = (generation: number, signal?: AbortSignal) => generation === generationRef.current && !signal?.aborted;
  const fileKey = scope ? draftKey(actorId, project.id, scope.conversationId, rootId) : null;
  const files = useConversationAttachments(attachmentCache, fileKey, scope && state.audienceEpoch !== null ? { kind: scope.kind, projectId: project.id, conversationId: scope.conversationId, rootId, expectedAudienceEpoch: state.audienceEpoch } : null,
    state.status === "ready" && !!scope && scope.lifecycle === "active" && (scope.kind !== "dm" || scope.canWrite) && !sendsOff && audience?.audienceEpoch === state.audienceEpoch && state.reviewedAudienceEpoch === state.audienceEpoch && !(rootId && state.messages.some(message => message.id === rootId && message.body === null)), fixtureActor);


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
    if (scope && outgoingHydrated) retainConversationState(draftCache, outgoingCache, scopeCacheKey(scope), stateRef.current, scope.kind);
    rememberScroll();
    sessionControllerRef.current?.abort();
    pollerRef.current?.stop();
    const generation = generationRef.current + 1;
    const controller = new AbortController();
    generationRef.current = generation;
    sessionControllerRef.current = controller;
    historyEpochRef.current = null; setBootstrapReady(false); setOutgoingHydrated(false);
    targetScrolledRef.current = false; scrollLoadedFor.current = null; scrollAnchorRef.current = null;
    clearAudience(); setEditing(null); setTaskSource(null); setCreatedTasks({}); setMutationError(null); setSendsOff(false); setHasOlder(false); setOlderCursor(null); setCatchingUp(false);
    dispatch({ type: "reset", actorId, scopeKey, generation });
    return { generation, controller };
  }
  function revoke(generation: number, failure: ConversationFailure) {
    if (!isCurrent(generation)) return;
    dispatchAt(generation, { type: "refused", failure });
    generationRef.current = generation + 1;
    sessionControllerRef.current?.abort(); pollerRef.current?.stop();
    if (directId) { forgetConversationDrafts(draftCache, actorId, project.id, directId); forgetConversationDrafts(outgoingCache, actorId, project.id, directId); forgetConversationDrafts(attachmentCache, actorId, project.id, directId); }
    else { forgetProjectDrafts(draftCache, actorId, project.id); forgetProjectDrafts(outgoingCache, actorId, project.id); forgetProjectDrafts(attachmentCache, actorId, project.id); }
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
    let cancelled = false;
    let requestController: AbortController | null = null;
    // Begin the external request after the current commit. A superseding
    // request can cancel this startup before it clears the visible state.
    queueMicrotask(() => {
    if (cancelled) return;
    const { generation, controller } = advanceSession(`${project.id}:pending`);
    requestController = controller;
    setScope(undefined); setStartFailure(null); setOpenedRoot(initialRootId ?? null);
    void apiResult<ConversationScope | null>(apiUrl(directId ? "dm-scope" : "project", project.id, directId ? { conversationId: directId } : {}), fixtureActor, { signal: controller.signal }).then(async (result) => {
      if (!isCurrent(generation, controller.signal)) return;
      if (!result.ok) { setStartFailure(result.code); handleFailure(result, generation); return; }
      setScope(result.value);
      if (!result.value) return;
      if (result.value.kind === "dm" && !result.value.canRead) { forgetConversationDrafts(draftCache, actorId, project.id, result.value.conversationId); forgetConversationDrafts(outgoingCache, actorId, project.id, result.value.conversationId); forgetConversationDrafts(attachmentCache, actorId, project.id, result.value.conversationId); return; }
      restoreScopedOutgoing(result.value, generation);
      const [page, audienceResult] = await Promise.all([loadMessages(result.value, initialMessageSeq && !directId ? initialMessageSeq + 1 : undefined, controller.signal), requestAudience(controller.signal)]);
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
    });
    return () => { cancelled = true; requestController?.abort(); if (sessionControllerRef.current === requestController) sessionControllerRef.current = null; };
  // A new explicit request creates a fresh generation in this same mounted
  // session. Outgoing custody is cached before aborting the old transport.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapAttempt, navigationRequestKey]);

  function retryBootstrap() { setBootstrapAttempt((current) => current + 1); }

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
    retainConversationState(draftCache, outgoingCache, key, state, scope.kind);
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

  function updateDraft(value: string) {
    if (!scope) return;
    const key = scopeCacheKey(scope);
    if (value && !hasDraftCapacity(draftCache, outgoingCache, key, 20, attachmentCache)) { setDraftLimitReached(true); return; }
    if (!rememberDraft(draftCache, key, value)) { setDraftLimitReached(true); return; }
    dispatch({ type: "draft", value });
  }

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

  useEffect(() => {
    if (!scope || historyEpochRef.current === null || !shouldFocusChatTarget({ visible, ready: state.status === "ready" && bootstrapReady, targetId: initialMessageId, found: state.messages.some(message => message.id === initialMessageId),
      alreadyFocused: targetScrolledRef.current, requestedRoot: initialRootId, currentRoot: rootId })) return;
    const generation = generationRef.current;
    const frame = requestAnimationFrame(() => {
      if (!isCurrent(generation) || historyEpochRef.current === null) return;
      const target = [...(feedRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? [])]
        .find(node => node.dataset.messageId === initialMessageId);
      if (target) { target.scrollIntoView({ block: "center" }); target.focus({ preventScroll: true }); targetScrolledRef.current = true; }
    });
    return () => cancelAnimationFrame(frame);
  }, [initialMessageId, initialRootId, rootId, scope, state.messages, state.status, visible, navigationRequestKey, bootstrapReady]);

  useEffect(() => {
    if (fixtureActor || !scope || scope.kind !== "project" || state.status !== "ready") return;
    const loaded = state.messages.filter(message => message.body !== null);
    if (!loaded.length) return;
    let cancelled = false;
    const groups = Array.from({ length: Math.ceil(loaded.length / 100) }, (_, index) => loaded.slice(index * 100, (index + 1) * 100));
    void Promise.all(groups.map(group => apiResult<{ unreadItemIds: string[] }>("/api/message-attention", undefined, {
      method: "POST", body: JSON.stringify({ action: "status", items: group.map(message =>
        ({ kind: "conversation", scopeId: scope.conversationId, itemId: message.id })) }),
    }))).then(results => {
      if (cancelled || results.some(result => !result.ok)) return;
      setUnreadMessageIds(new Set(results.flatMap(result => result.ok ? result.value.unreadItemIds : [])
        .filter(id => !observedMessagesRef.current.has(id))));
    }).catch(() => { /* Keep prior status; a retry follows the next loaded page or focus. */ });
    return () => { cancelled = true; };
  }, [fixtureActor, scope, state.messages, state.status]);

  useEffect(() => {
    if (!visible || fixtureActor || !scope || scope.kind !== "project" || state.status !== "ready" || !feedRef.current ||
        typeof IntersectionObserver === "undefined") return;
    const visibleMessages = new Map(state.messages.filter(message => message.body !== null).map(message => [message.id, message]));
    const observer = new IntersectionObserver((entries) => {
      if (!visible || document.visibilityState !== "visible") return;
      const items = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.6)
        .map(entry => visibleMessages.get((entry.target as HTMLElement).dataset.observeMessageId ?? ""))
        .filter((message): message is MessageRecord => message !== undefined && !observedMessagesRef.current.has(message.id));
      if (!items.length) return;
      for (const message of items) observedMessagesRef.current.add(message.id);
      void apiResult<{ observedItems: number }>("/api/message-attention", undefined, { method: "POST",
        body: JSON.stringify({ action: "observe", items: items.map(message => ({ kind: "conversation", scopeId: scope.conversationId, itemId: message.id })) }) })
        .then(result => { if (!result.ok) for (const message of items) observedMessagesRef.current.delete(message.id);
          else setUnreadMessageIds(current => new Set([...current].filter(id => !items.some(item => item.id === id)))); })
        .catch(() => { for (const message of items) observedMessagesRef.current.delete(message.id); });
    }, { root: feedRef.current, threshold: 0.6 });
    const nodes = [...feedRef.current.querySelectorAll<HTMLElement>("[data-message-observe]")];
    for (const node of nodes) observer.observe(node);
    // A hidden-tab callback must not mark read. On foreground, force a fresh
    // intersection notification even if the sentinel geometry did not move.
    const resample = () => {
      if (document.visibilityState !== "visible") return;
      for (const node of nodes) { observer.unobserve(node); observer.observe(node); }
    };
    document.addEventListener("visibilitychange", resample);
    return () => { document.removeEventListener("visibilitychange", resample); observer.disconnect(); };
  }, [fixtureActor, scope, state.messages, state.status, visible]);

  function restoreForFreshAudience(pending: PendingSend, generation: number) {
    if (!isCurrent(generation) || !scope) return;
    const restored = conversationReducer(stateRef.current, { type: "restore_absent", generation, requestId: pending.input.clientRequestId });
    if (!restored.recoveredDrafts.some(draft => draft.requestId === pending.input.clientRequestId)) files.release(pending.input.clientRequestId);
    clearAudience(); dispatchAt(generation, { type: "restore_absent", requestId: pending.input.clientRequestId });
  }
  async function resolveSend(pending: PendingSend) {
    if (!scope) return;
    const generation = generationRef.current; const currentScope = scope; const signal = sessionControllerRef.current?.signal;
    try {
      const lookup = await apiResult<{ state: "committed"; receipt: MessageReceipt } | { state: "absent" }>(apiUrl("receipt", project.id, { conversationId: currentScope.conversationId, clientRequestId: pending.input.clientRequestId }), fixtureActor, { signal });
      if (!isCurrent(generation, signal)) return;
      if (!lookup.ok) { if (lookup.code === "temporarily_unavailable") dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId }); else handleFailure(lookup, generation, pending.input.clientRequestId); return; }
      if (lookup.value.state === "committed") { files.consume(pending.input.clientRequestId); captureScrollAnchor(); dispatchAt(generation, { type: "receipt", receipt: lookup.value.receipt }); return; }
      if (needsFreshAudienceSend(pending.input.expectedAudienceEpoch, historyEpochRef.current)) { restoreForFreshAudience(pending, generation); return; }
      const result = await apiResult<MessageReceipt>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "send", ...pending.input }), signal });
      if (!isCurrent(generation, signal)) return;
      if (result.ok) { files.consume(pending.input.clientRequestId); captureScrollAnchor(); dispatchAt(generation, { type: "receipt", receipt: result.value }); }
      else if (result.code === "audience_changed") restoreForFreshAudience(pending, generation);
      else if (result.code === "temporarily_unavailable" || result.code === "rate_limited") dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId });
      else handleFailure(result, generation, pending.input.clientRequestId);
    } catch { if (isCurrent(generation, signal)) dispatchAt(generation, { type: "uncertain", requestId: pending.input.clientRequestId }); }
  }

  async function send() {
    const audienceReady = audience !== null && audience.audienceEpoch === state.audienceEpoch;
    if (!scope || (scope.kind === "dm" && !scope.canWrite) || !audienceReady || state.audienceEpoch === null || state.reviewedAudienceEpoch !== state.audienceEpoch || draftMentionUserIds.some((id) => !audience.members.some((member) => member.id === id)) || !(validMessageBody(state.draft) || (!state.draft.trim() && files.ready.length > 0)) || files.waiting || (files.files.length > 0 && !files.available) || sendsOff || scope.lifecycle === "archived") return;
    const input: SendInput = { projectId: project.id, conversationId: scope.conversationId, clientRequestId: newRequestId(), expectedAudienceEpoch: state.audienceEpoch, body: files.ready.length && !state.draft.trim() ? "" : normalizeMessageBody(state.draft), rootId, mentionUserIds: draftMentionUserIds, ...(files.ready.length ? { attachmentIds: files.ready.map(file => file.id) } : {}) };
    const next = conversationReducer(state, { type: "submit", input, attachments: files.ready });
    if (next === state || (input.attachmentIds?.length && !files.reserve(input.attachmentIds, input.clientRequestId))) return;
    stateRef.current = next;
    retainConversationState(draftCache, outgoingCache, scopeCacheKey(scope), next, scope.kind);
    scrollAnchorRef.current = { top: 0, bottomDistance: 0, mode: "live" }; dispatch({ type: "submit", input, attachments: files.ready }); rememberDraft(draftCache, scopeCacheKey(scope), ""); await resolveSend(next.pending[next.pending.length - 1]);
  }

  function sendOrRoutePrivatePing(){
    const commandScope=scope;if(!commandScope)return;
    setPrivatePingNotice(null);
    routePrivatePingCommand({draft:state.draft,enabled:privatePingEnabled,
      canOpen:state.status==="ready"&&audienceReady&&!removedRoot&&commandScope.lifecycle==="active"&&(commandScope.kind!=="dm"||commandScope.canRead),
      sendShared:()=>{void send();},
      blocked:()=>setPrivatePingNotice("Ping isn’t available for this conversation right now. Your draft was kept here and wasn’t sent to the shared chat."),
      openPrivate:({text})=>{setPrivatePingForwarded(text?{requestId:`ping_${crypto.randomUUID().replaceAll("-","")}`,text}:null);setPrivatePingSource({kind:"conversation",conversationId:commandScope.conversationId,...(rootId?{rootId}:{})});},
    });
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
  const bodyValid = validMessageBody(state.draft) || (!state.draft.trim() && files.ready.length > 0); const bodyBytes = new TextEncoder().encode(state.draft).byteLength;
  const SessionContainer = "section";
  const title = rootId ? "Replies" : scope?.kind === "dm" ? scope.other.name : project.name;
  const audienceDescription = scope?.kind === "dm" ? `Private conversation in ${project.name} · exactly two people` : audienceReady ? `Visible to ${members.length} current members · ${members.map((member) => member.name).join(", ")}` : "Visible to current Project members · membership list updating";
  const statusHeader = stacked ? <ChatHeader panel onBack={onBack} backLabel="All chats" leading={<ProjectTile id={project.id} name={project.name} size={32} />} title={title} actions={headerActions} /> : undefined;
  if (state.status === "unavailable") return <ConversationStatus header={statusHeader} title={title} message="This conversation is unavailable. It may have been removed or you may no longer have access." />;
  if (scope === undefined) return <ConversationStatus header={statusHeader} action={startFailure ? retryBootstrap : undefined} actionLabel="Retry" error={startFailure && startFailure !== "temporarily_unavailable" ? failureCopy[startFailure] : null} title={title} message={state.status === "offline" ? "Conversation history is offline. Your draft stays here; nothing will send automatically." : "Loading conversation…"} />;
  if (scope === null) return <ConversationStatus header={statusHeader} action={startConversation} actionLabel="Start conversation" error={startFailure ? failureCopy[startFailure] : null} title={title} message="No Project conversation has been started yet." />;
  if(privatePingSource&&privatePingEnabled)return <PingPersonalAssistant actorId={actorId} projects={projects} visible={visible} source={privatePingSource} initialProjectId={project.id} forwardedRequest={privatePingForwarded??undefined} onBack={()=>{setPrivatePingSource(null);setPrivatePingForwarded(null);requestAnimationFrame(()=>privatePingTriggerRef.current?.focus());}} backLabel="Back to conversation" actions={headerActions} />;

  return <SessionContainer className={styles.main} data-thread={rootId ? "true" : undefined}>
    {onCloseThread ? <button autoFocus className={styles.closeThread} onClick={onCloseThread} type="button">← Back to conversation</button> : null}
    {fixtureActor && !rootId ? <div className={styles.synthetic}>Synthetic live client · actor {fixtureActor} · no customer data</div> : null}
    {rootId ? <AudienceHeader showTabs={false} onShowDetails={() => setShowDetails((value) => !value)} description={audienceDescription} onToggleRelated={() => {}} relatedOpen={false} showRelatedWork={false} status={scope.lifecycle === "archived" ? "archived" : scope.kind === "dm" && !scope.canWrite ? scope.pairState : "active"} title={title} />
      : <ChatHeader panel={stacked} onBack={onBack} backLabel="All chats" leading={scope.kind === "dm" ? <Avatar id={scope.other.id} name={scope.other.name} size={32} /> : <ProjectTile id={project.id} name={project.name} size={32} />} title={title}
        subtitle={<span title={audienceDescription}>{scope.lifecycle === "archived" ? "Archived · read only" : scope.kind === "dm" ? (!scope.canWrite ? (scope.pairState === "pending" ? "Awaiting acceptance" : "Read only") : "Direct message · just the two of you") : audienceReady ? `${members.length} ${members.length === 1 ? "member" : "members"} can see this` : "Project members can see this"}</span>}
        actions={<>{onOpenDirectory ? <button aria-label="Direct messages and task threads" className={styles.headIcon} onClick={onOpenDirectory} title="Direct messages and task threads" type="button"><ChatIcon.users /></button> : null}<button aria-expanded={showDetails} aria-label="Conversation details" className={styles.headIcon} onClick={() => setShowDetails((value) => !value)} title="Who can see this" type="button"><ChatIcon.info /></button>{headerActions}</>} />}
    {showDetails ? <section className={styles.pairControls} aria-label="Conversation details"><p>{audienceDescription}. Task outcomes keep their destination Project access; linking a task does not share this conversation.</p><button onClick={() => setShowDetails(false)} type="button">Close details</button></section> : null}
    {scope.kind === "dm" && !rootId ? <DirectMessageControls actorId={actorId} scope={scope} fixtureActor={fixtureActor} onChange={() => retryBootstrap()} /> : null}
    <div className={styles.viewBar}>{rootId ? <span>Replies to this message</span> : stacked ? <span /> : <button onClick={onToggleView} type="button">{view === "full" ? "Context panel" : "Full view"}</button>}<span>{scope.kind === "dm" && !scope.canRead ? scope.pairState === "pending" ? "Awaiting acceptance" : "Messages unavailable" : state.status === "offline" ? "Offline · retrying" : state.status === "ready" && !catchingUp ? "History up to date" : "Updating history"}</span></div>
    {audienceNeedsReview && (scope.kind !== "dm" || scope.canWrite) ? <div className={styles.notice}><strong>{audienceReady ? "Audience changed" : "Checking audience"}</strong><span>{audienceReady ? "Review the current members before sending this draft." : "Sending is paused until the current Project membership is available."}</span>{audienceReady ? <button onClick={() => dispatch({ type: "review_audience", audienceEpoch: audience.audienceEpoch })} type="button">Review audience</button> : null}</div> : null}
    {scope.lifecycle === "archived" && (scope.kind !== "dm" || scope.canRead) ? <div className={styles.notice}><strong>Read-only history</strong><span>Restore the Project before sending or changing messages.</span></div> : null}
    {sendsOff ? <div className={styles.notice}><strong>Sends are off</strong><span>Existing history remains available.</span></div> : null}
    {privatePingNotice ? <p role="status" className={styles.notice}>{privatePingNotice}</p>:null}
    {mutationError ? <div className={styles.errorNotice} role="alert">{mutationError}</div> : null}
    <div aria-label="Message reading area" role="region" tabIndex={0} className={styles.feedScroller} onScroll={() => rememberScroll(scope)} ref={feedRef}><ol aria-label="Conversation history" className={styles.feed}>
      {hasOlder ? <li className={styles.olderHistory}><button disabled={loadingOlder} onClick={() => void loadOlder()} type="button">{loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}</button></li> : null}
      {state.messages.length === 0 && state.pending.length === 0 ? <li className={styles.emptyHistory}>{scope.kind === "dm" && !scope.canRead ? scope.pairState === "pending" ? "Messages will appear here after acceptance." : "You no longer have access to messages here." : rootId ? "No replies yet." : "No messages yet. Start with the decision or question the Project needs."}</li> : null}
      {state.messages.map((message) => <LiveMessage canMutate={canChange} unread={unreadMessageIds.has(message.id)} onReply={!rootId ? () => { replyTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpenedRoot(message.id); } : undefined} actorId={actorId} editing={editing} key={message.id} members={members} message={message} taskCreated={Boolean(createdTasks[message.id])} onCreateTask={canChange ? () => { taskTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setTaskSource({ sourceProjectId: project.id, conversationId: scope.conversationId, messageId: message.id, expectedRevision: message.revision, expectedAudienceEpoch: state.audienceEpoch! }); } : undefined} onCancelEdit={() => setEditing(null)} onDelete={() => void mutate("tombstone", message)} onEdit={(body) => void mutate("edit", message, body)} onStartEdit={() => message.body && setEditing({ id: message.id, body: message.body, revision: message.revision })} setEditing={setEditing} />)}
      {state.pending.map((pending) => <li className={styles.pendingMessage} key={pending.input.clientRequestId}><strong>You</strong><p>{pending.input.body}</p><ConversationMessageFiles files={pending.attachments} pending /><span>{pending.state === "pending" ? "Sending…" : pending.state === "uncertain" ? "Checking whether this sent" : `Not sent · ${pending.error ? failureCopy[pending.error] : "try again"}`}</span>{pending.state !== "pending" ? <button onClick={() => void resolveSend(pending)} type="button">Check receipt, then retry</button> : null}</li>)}
      {state.recoveredDrafts.map((draft) => <li className={styles.pendingMessage} key={`recovered:${draft.requestId}`}><strong>Earlier message was not sent</strong><p>{draft.body}</p><ConversationMessageFiles files={draft.attachments} pending /><span>{state.draft || draftMentionUserIds.length ? "Your current draft is kept. Send or save it before restoring this text." : "Restore this text to review it with the current audience."}</span><button disabled={state.draft !== "" || draftMentionUserIds.length > 0} onClick={() => { files.release(draft.requestId); dispatch({ type: "restore_recovered", requestId: draft.requestId }); }} type="button">Restore draft</button><button onClick={() => { files.discardReservation(draft.requestId); dispatch({ type: "discard_recovered", requestId: draft.requestId }); }} type="button">Discard earlier draft</button></li>)}
    </ol></div>
    {privatePingEnabled && state.status === "ready" && audienceReady && !removedRoot && (scope.kind !== "dm" || scope.canRead) ? <div className={styles.privatePingSlot}><button ref={privatePingTriggerRef} className={styles.askPingPrivately} onClick={()=>{setPrivatePingForwarded(null);setPrivatePingNotice(null);setPrivatePingSource({kind:"conversation",conversationId:scope.conversationId,...(rootId?{rootId}:{})});}} type="button"><PingTile size={18} />Ask Ping privately</button><span>Only you will see the reply</span></div>:null}
    <section aria-label="Message composer" className={styles.composer}>{state.status === "offline" ? <p>Offline. Your draft stays here; nothing will send automatically.</p> : removedRoot || scope.lifecycle === "archived" || sendsOff || (scope.kind === "dm" && !scope.canWrite) ? <p>{scope.kind === "dm" && !scope.canRead && scope.pairState !== "pending" ? "Messages are unavailable to you." : removedRoot ? "The original message was removed. Existing replies remain available." : scope.lifecycle === "archived" ? "This conversation is read only." : scope.kind === "dm" && !scope.canWrite ? "Messages are paused until both people can participate." : "Sending is currently turned off."}</p> : <>
      {draftLimitReached || !hasDraftCapacity(draftCache, outgoingCache, scopeCacheKey(scope), 20, attachmentCache) ? <SavedDraftsPanel entries={listSavedDrafts(actorId, draftCache, outgoingCache, attachmentCache).filter((entry) => entry.key !== scopeCacheKey(scope))} onOpen={onOpenSavedScope} onDiscard={(key) => {
        const saved = outgoingCache.get(key);
        if (saved?.pending.length || saved?.recoveredDrafts.length) return;
        for (const item of attachmentCache.get(key) ?? []) { if (item.attachment) void discardConversationFile(item.attachment.id, fixtureActor).catch(() => undefined); }
        attachmentCache.delete(key); draftCache.delete(key); outgoingCache.delete(key); setDraftLimitReached(false); dispatch({ type: "draft", value: state.draft });
      }} /> : null}
      <textarea disabled={!hasDraftCapacity(draftCache, outgoingCache, scopeCacheKey(scope), 20, attachmentCache)} aria-label={rootId ? "Write a reply" : `Message ${title}`} maxLength={CONVERSATION_LIMITS.bodyCharacters} onChange={(event) => updateDraft(event.target.value)} onPaste={(event) => { if (!files.available || !hasDraftCapacity(draftCache, outgoingCache, scopeCacheKey(scope), 20, attachmentCache) || !event.clipboardData.files.length) return; event.preventDefault(); files.add(event.clipboardData.files); }} onKeyDown={(event) => { const mobileReturn = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches; if (shouldSendComposerKey({ key: event.key, shiftKey: event.shiftKey, composing: event.nativeEvent.isComposing, mobileReturn })) { event.preventDefault(); sendOrRoutePrivatePing(); } }} placeholder={rootId ? "Write a reply" : `Message ${title}`} rows={3} value={state.draft} />
      {unavailableMention ? <p>A selected person is no longer available. Remove them from Notify people before sending.</p> : null}
      {audienceReady ? <MemberMentionPicker actorId={actorId} members={members} selected={draftMentionUserIds} onChange={setDraftMentionUserIds} /> : null}
      <DraftConversationFiles files={files.files} disabled={!files.available || audienceNeedsReview} audienceEpoch={state.audienceEpoch} onRemove={files.remove} onRetry={files.retry} />
      {files.notice ? <p role="status">{files.notice}</p> : null}
      {files.available ? <ConversationFilePicker disabled={!hasDraftCapacity(draftCache, outgoingCache, scopeCacheKey(scope), 20, attachmentCache) || files.files.length >= 3 || files.all.some(file => file.reservedFor)} onFiles={files.add} /> : null}
      <ChatDictationTools active={visible && !openedRoot && !audienceNeedsReview && !unavailableMention} contextKey={`${actorId}:${scope.conversationId}:${rootId ?? "root"}`} append={(text) => { const next = appendDictatedText(stateRef.current.draft, text); if (next === null) return false; stateRef.current = { ...stateRef.current, draft: next }; updateDraft(next); return true; }} />
      <div><ChatDraftCounter value={state.draft} /><button data-chat-send="true" disabled={!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes || audienceNeedsReview || unavailableMention || files.waiting || (files.files.length > 0 && !files.available)} onClick={sendOrRoutePrivatePing} type="button">Send</button></div>
    </>}</section>
    {openedRoot && !rootId ? <ThreadFrame visible={visible} onClose={() => { setOpenedRoot(null); requestAnimationFrame(() => replyTriggerRef.current?.focus()); }}><ProjectConversationSession privatePingEnabled={privatePingEnabled} navigationRequestKey={navigationRequestKey} visible={visible} key={openedRoot} rootId={openedRoot} initialMessageId={initialMessageId} initialMessageSeq={initialMessageSeq} onOpenSavedScope={onOpenSavedScope} onCloseThread={() => { setOpenedRoot(null); requestAnimationFrame(() => replyTriggerRef.current?.focus()); }} directId={directId} actorId={actorId} project={project} projects={projects} fixtureActor={fixtureActor} draftCache={draftCache} outgoingCache={outgoingCache} attachmentCache={attachmentCache} scrollCache={scrollCache} view="context" onToggleView={() => { setOpenedRoot(null); requestAnimationFrame(() => replyTriggerRef.current?.focus()); }} /></ThreadFrame> : null}
    {taskSource ? <TaskOutcomeForm open actorId={actorId} fixture={Boolean(fixtureActor)} source={taskSource} projects={projects} onClose={closeTaskOutcome} loadDestination={(destinationId, signal) => apiResult(apiUrl("task-destination", destinationId), fixtureActor, { signal })} submit={submitTask} onCreated={(result) => { if (result.taskAvailable !== false) setCreatedTasks((current) => ({ ...current, [taskSource.messageId]: result.taskId })); }} /> : null}
  </SessionContainer>;
}

function LiveMessage({ canMutate, unread, onReply, actorId, message, members, editing, setEditing, onStartEdit, onCancelEdit, onEdit, onDelete, onCreateTask, taskCreated }: Readonly<{ canMutate: boolean; unread: boolean; onReply?: () => void; onCreateTask?: () => void; taskCreated: boolean; actorId: string; message: MessageRecord & { replyCount?: number }; members: Audience["members"]; editing: { id: string; body: string; revision: number } | null; setEditing: (value: { id: string; body: string; revision: number } | null) => void; onStartEdit: () => void; onCancelEdit: () => void; onEdit: (body: string) => void; onDelete: () => void }>) {
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const name = message.authorId === null ? "Deleted account" : members.find((member) => member.id === message.authorId)?.name ?? (message.authorId === actorId ? "You" : "Project member");
  const cancelAndRestoreFocus = () => { onCancelEdit(); requestAnimationFrame(() => editButtonRef.current?.focus()); };
  return <li className={styles.message} data-message-id={message.id} tabIndex={-1}><span aria-hidden data-message-observe data-observe-message-id={message.id} className={styles.observeSentinel} /><span className={styles.avatarSlot}><Avatar id={message.authorId ?? "deleted"} name={name} size={32} /></span><div><div className={styles.messageMeta}><strong>{name}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{unread && message.body !== null ? <span className={styles.unreadBadge}>Unread</span> : null}{message.editedAt ? <span>Edited</span> : null}</div>{message.body === null ? <p className={styles.deleted}>Message removed</p> : editing?.id === message.id ? <div className={styles.editForm}><textarea aria-label="Edit message" autoFocus onChange={(event) => setEditing({ ...editing, body: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelAndRestoreFocus(); } }} value={editing.body} /><div><button onClick={cancelAndRestoreFocus} type="button">Cancel</button><button disabled={!validMessageBody(editing.body)} onClick={() => onEdit(editing.body)} type="button">Save edit</button></div></div> : <><p>{message.body}</p><ConversationMessageFiles files={message.attachments} /></>}{message.body === null && onReply ? <div className={styles.messageActions}><button onClick={onReply} type="button">View replies</button></div> : null}{message.body !== null && editing?.id !== message.id ? <div className={styles.messageActions}>{onReply ? <button onClick={onReply} type="button">{message.replyCount ? `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}` : "Reply"}</button> : null}{onCreateTask ? <button onClick={onCreateTask} type="button">Create task</button> : null}{taskCreated ? <span>Task created</span> : null}{canMutate && message.authorId === actorId ? <><button onClick={onStartEdit} ref={editButtonRef} type="button">Edit</button><button onClick={onDelete} type="button">Delete</button></> : null}</div> : null}</div></li>;
}

function ThreadFrame({ children, onClose, visible = true }: Readonly<{ children: ReactNode; onClose: () => void; visible?: boolean }>) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { const node = dialog.current; if (node && visible && !node.open) node.showModal(); else if (node && !visible) node.close(); return () => node?.close(); }, [visible]);
  return <dialog ref={dialog} className={styles.threadPanel} aria-label="Message replies" onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}

function ConversationStatus({ title, message, action, actionLabel, error, header }: Readonly<{ title: string; message: string; action?: () => void; actionLabel?: string; error?: string | null; header?: ReactNode }>) {
  return <section className={styles.main}>{header}<div className={styles.status}><Icon size={22}><path d="M4 5h16v12H9l-5 4Z" /></Icon><h1>{title}</h1><p>{message}</p>{error ? <span role="alert">{error}</span> : null}{action && actionLabel ? <button onClick={action} type="button">{actionLabel}</button> : null}</div></section>;
}
