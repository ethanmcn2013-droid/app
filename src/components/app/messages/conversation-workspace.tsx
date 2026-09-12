"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationDelta, ConversationFailure, ConversationResult, MessageReceipt, MessageRecord, SendInput } from "@/lib/conversations/contracts";
import { CONVERSATION_LIMITS, normalizeMessageBody, validMessageBody } from "@/lib/conversations/contracts";
import { conversationReducer, emptyConversationState, type PendingSend } from "@/lib/conversations/reducer";
import { ConversationPoller } from "@/lib/conversations/polling";
import { AudienceHeader, Icon } from "./prototype-panels";
import { conversationHeaders, draftKey, rememberDraft, type DraftCache } from "./conversation-client-model";
import styles from "./conversation-workspace.module.css";

type ProjectOption = Readonly<{ id: ProjectId; name: string }>;
type ConversationScope = Readonly<{ conversationId: string; projectId: ProjectId; kind: "project"; audienceEpoch: number; lifecycle: "active" | "archived" }>;
type Audience = Readonly<{ audienceEpoch: number; members: readonly Readonly<{ id: string; name: string }>[] }>;
type MutationReceipt = Readonly<{ messageId: string; clientRequestId: string; changeSeq: number; revision: number; committedAt: number }>;
type GeneratedAction =
  | Readonly<{ type: "delta"; delta: ConversationDelta }>
  | Readonly<{ type: "receipt"; receipt: MessageReceipt }>
  | Readonly<{ type: "uncertain"; requestId: string }>
  | Readonly<{ type: "refused"; failure: ConversationFailure; requestId?: string }>
  | Readonly<{ type: "offline" }>;

export type ConversationWorkspaceProps = Readonly<{
  actorId: string;
  projects: readonly ProjectOption[];
  initialProjectId?: ProjectId;
  fixtureActor?: string;
}>;

const failureCopy: Record<ConversationFailure["code"], string> = {
  unauthenticated: "Your session is no longer available.",
  unavailable: "This conversation is unavailable.",
  archived: "This Project is archived. Its conversation is read only.",
  audience_changed: "The audience changed. Review the current members before sending.",
  consent_required: "Sending requires consent.",
  read_only: "Conversation sends are currently turned off.",
  invalid_input: "That message could not be sent. Review it and try again.",
  request_conflict: "This request no longer matches the original message.",
  revision_conflict: "This message changed elsewhere. Its latest version will be loaded.",
  temporarily_unavailable: "Signal Studio cannot reach conversations right now.",
  resync_required: "The conversation needs a fresh history check.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
};

function requestId(prefix = "request"): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function apiResult<T>(url: string, fixtureActor: string | undefined, init?: RequestInit): Promise<ConversationResult<T>> {
  const headers = conversationHeaders(fixtureActor, Boolean(init?.body));
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", headers });
  return await response.json() as ConversationResult<T>;
}

function apiUrl(action: string, projectId: ProjectId, values: Record<string, string | number> = {}): string {
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

  if (!projectId || projects.length === 0) {
    return <section className={styles.noProjects}><h1>Messages</h1><p>Add a Project before starting a Project conversation.</p></section>;
  }
  const selected = projects.find((project) => project.id === projectId) ?? projects[0];
  return (
    <section className={styles.workspace} data-view={view}>
      <aside className={styles.projectList}>
        <div className={styles.listHeading}><h1>Messages</h1><span>Project conversations</span></div>
        {projects.map((project) => (
          <button aria-current={project.id === selected.id ? "page" : undefined} aria-label={project.name} key={project.id} onClick={() => setProjectId(project.id)} type="button">
            <span>{project.name.slice(0, 2).toUpperCase()}</span><strong>{project.name}</strong>
          </button>
        ))}
        <p>Messages stay inside their named Project.</p>
      </aside>
      <ProjectConversationSession actorId={actorId} draftCache={draftCache} fixtureActor={fixtureActor} key={`${actorId}:${selected.id}`} onToggleView={() => setView((current) => current === "full" ? "context" : "full")} project={selected} view={view} />
    </section>
  );
}

function ProjectConversationSession({ actorId, project, fixtureActor, draftCache, view, onToggleView }: Readonly<{ actorId: string; project: ProjectOption; fixtureActor?: string; draftCache: DraftCache; view: "full" | "context"; onToggleView: () => void }>) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, () => emptyConversationState(actorId, `${project.id}:pending`));
  const [scope, setScope] = useState<ConversationScope | null | undefined>(undefined);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [startFailure, setStartFailure] = useState<ConversationFailure["code"] | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [sendsOff, setSendsOff] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string; revision: number } | null>(null);
  const stateRef = useRef(state);
  const generationRef = useRef(0);
  const draftLoadedFor = useRef<string | null>(null);

  const dispatchCurrent = (action: GeneratedAction) => dispatch({ ...action, generation: generationRef.current });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state.status === "unavailable") draftCache.clear();
  }, [draftCache, state.status]);

  async function loadAudience(signal?: AbortSignal): Promise<boolean> {
    const result = await apiResult<Audience>(apiUrl("audience", project.id), fixtureActor, { signal });
    if (result.ok) {
      setAudience(result.value);
      return true;
    }
    if (result.code === "unavailable" || result.code === "unauthenticated") dispatchCurrent({ type: "refused", failure: result });
    else dispatchCurrent({ type: "offline" });
    return false;
  }

  async function loadHistory(currentScope: ConversationScope, afterChangeSeq: number, signal?: AbortSignal): Promise<ConversationResult<ConversationDelta>> {
    return apiResult<ConversationDelta>(apiUrl("history", project.id, { conversationId: currentScope.conversationId, afterChangeSeq, limit: 100 }), fixtureActor, { signal });
  }

  useEffect(() => {
    const controller = new AbortController();
    const generation = generationRef.current;
    void apiResult<ConversationScope | null>(apiUrl("project", project.id), fixtureActor, { signal: controller.signal }).then(async (result) => {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      if (!result.ok) {
        setStartFailure(result.code);
        dispatch(result.code === "temporarily_unavailable" ? { type: "offline", generation } : { type: "refused", generation, failure: result });
        return;
      }
      setScope(result.value);
      if (!result.value) return;
      const nextGeneration = generationRef.current + 1;
      generationRef.current = nextGeneration;
      dispatch({ type: "reset", actorId, scopeKey: `${project.id}:${result.value.conversationId}` });
      try {
        const [history, audienceReady] = await Promise.all([loadHistory(result.value, 0, controller.signal), loadAudience(controller.signal)]);
        if (controller.signal.aborted || nextGeneration !== generationRef.current) return;
        if (history.ok) {
          if (audienceReady) dispatch({ type: "delta", generation: nextGeneration, delta: history.value });
        } else {
          if (history.code === "archived") setScope({ ...result.value, lifecycle: "archived" });
          dispatch(history.code === "temporarily_unavailable" ? { type: "offline", generation: nextGeneration } : { type: "refused", generation: nextGeneration, failure: history });
        }
      } catch {
        if (!controller.signal.aborted && nextGeneration === generationRef.current) dispatch({ type: "offline", generation: nextGeneration });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setStartFailure("temporarily_unavailable");
        dispatch({ type: "offline", generation });
      }
    });
    return () => controller.abort();
  // This session is keyed by actor + Project, so bootstrap runs exactly once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapAttempt]);

  function retryBootstrap() {
    generationRef.current += 1;
    setScope(undefined);
    setStartFailure(null);
    dispatch({ type: "reset", actorId, scopeKey: `${project.id}:pending` });
    setBootstrapAttempt((current) => current + 1);
  }

  useEffect(() => {
    if (!scope) return;
    const poller = new ConversationPoller<ConversationResult<ConversationDelta>>({
      poll: ({ conversationId }, signal) => loadHistory({ ...scope, conversationId }, stateRef.current.cursor, signal),
      apply: (result) => {
        if (result.ok) {
          const changed = stateRef.current.audienceEpoch !== null && stateRef.current.audienceEpoch !== result.value.audienceEpoch;
          dispatchCurrent({ type: "delta", delta: result.value });
          if (changed) void loadAudience().catch(() => dispatchCurrent({ type: "offline" }));
        } else if (result.code === "resync_required") {
          void loadHistory(scope, 0).then((fresh) => fresh.ok ? dispatchCurrent({ type: "delta", delta: fresh.value }) : dispatchCurrent({ type: "refused", failure: fresh }));
        } else if (result.code === "temporarily_unavailable") {
          dispatchCurrent({ type: "offline" });
        } else {
          if (result.code === "archived") setScope((current) => current ? { ...current, lifecycle: "archived" } : current);
          dispatchCurrent({ type: "refused", failure: result });
        }
      },
      onFailure: () => dispatchCurrent({ type: "offline" }),
    });
    const configure = () => poller.configure({ actorId, projectId: project.id, conversationId: scope.conversationId }, document.visibilityState === "visible", document.hasFocus());
    configure();
    document.addEventListener("visibilitychange", configure);
    window.addEventListener("focus", configure);
    window.addEventListener("blur", configure);
    return () => { document.removeEventListener("visibilitychange", configure); window.removeEventListener("focus", configure); window.removeEventListener("blur", configure); poller.stop(); };
  // Scope identity is immutable; reducer state is read through stateRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.conversationId]);

  useEffect(() => {
    if (!scope || draftLoadedFor.current === scope.conversationId) return;
    draftLoadedFor.current = scope.conversationId;
    const saved = draftCache.get(draftKey(actorId, project.id, scope.conversationId, null));
    if (saved) dispatch({ type: "draft", value: saved });
  }, [actorId, draftCache, project.id, scope]);

  function updateDraft(value: string) {
    if (!scope) return;
    dispatch({ type: "draft", value });
    rememberDraft(draftCache, draftKey(actorId, project.id, scope.conversationId, null), value);
  }

  async function startConversation() {
    setStartFailure(null);
    try {
      const result = await apiResult<ConversationScope>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "ensure", projectId: project.id }) });
      if (!result.ok) { setStartFailure(result.code); if (result.code === "read_only") setSendsOff(true); return; }
      generationRef.current += 1;
      dispatch({ type: "reset", actorId, scopeKey: `${project.id}:${result.value.conversationId}` });
      setScope(result.value);
      const generation = generationRef.current;
      const [history, audienceReady] = await Promise.all([loadHistory(result.value, 0), loadAudience()]);
      if (history.ok) {
        if (audienceReady) dispatch({ type: "delta", generation, delta: history.value });
      } else dispatch(history.code === "temporarily_unavailable" ? { type: "offline", generation } : { type: "refused", generation, failure: history });
    } catch {
      setStartFailure("temporarily_unavailable");
      dispatchCurrent({ type: "offline" });
    }
  }

  async function resolveSend(pending: PendingSend) {
    if (!scope) return;
    try {
      const lookup = await apiResult<{ state: "committed"; receipt: MessageReceipt } | { state: "absent" }>(apiUrl("receipt", project.id, { conversationId: scope.conversationId, clientRequestId: pending.input.clientRequestId }), fixtureActor);
      if (!lookup.ok) { dispatchCurrent({ type: "refused", failure: lookup, requestId: pending.input.clientRequestId }); return; }
      if (lookup.value.state === "committed") { dispatchCurrent({ type: "receipt", receipt: lookup.value.receipt }); return; }
      const result = await apiResult<MessageReceipt>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action: "send", ...pending.input }) });
      if (result.ok) dispatchCurrent({ type: "receipt", receipt: result.value });
      else {
        if (result.code === "read_only") setSendsOff(true);
        if (result.code === "archived") setScope({ ...scope, lifecycle: "archived" });
        dispatchCurrent({ type: "refused", failure: result, requestId: pending.input.clientRequestId });
      }
    } catch { dispatchCurrent({ type: "uncertain", requestId: pending.input.clientRequestId }); }
  }

  async function send() {
    if (!scope || state.audienceEpoch === null || !validMessageBody(state.draft) || sendsOff || scope.lifecycle === "archived") return;
    const input: SendInput = { projectId: project.id, conversationId: scope.conversationId, clientRequestId: requestId(), expectedAudienceEpoch: state.audienceEpoch, body: normalizeMessageBody(state.draft), rootId: null, mentionUserIds: [] };
    const next = conversationReducer(state, { type: "submit", input });
    if (next === state) return;
    dispatch({ type: "submit", input });
    rememberDraft(draftCache, draftKey(actorId, project.id, scope.conversationId, null), "");
    await resolveSend(next.pending[next.pending.length - 1]);
  }

  async function mutate(action: "edit" | "tombstone", message: MessageRecord, body?: string) {
    if (!scope || state.audienceEpoch === null || sendsOff || scope.lifecycle === "archived") return;
    setMutationError(null);
    try {
      const result = await apiResult<MutationReceipt>("/api/conversations", fixtureActor, { method: "POST", body: JSON.stringify({ action, projectId: project.id, conversationId: scope.conversationId, clientRequestId: requestId(action), expectedAudienceEpoch: state.audienceEpoch, messageId: message.id, expectedRevision: message.revision, ...(action === "edit" ? { body, mentionUserIds: [] } : {}) }) });
      if (!result.ok) {
        if (result.code === "read_only") setSendsOff(true);
        if (result.code === "archived") setScope({ ...scope, lifecycle: "archived" });
        setMutationError(failureCopy[result.code]);
        return;
      }
      const history = await loadHistory(scope, stateRef.current.cursor);
      if (history.ok) dispatchCurrent({ type: "delta", delta: history.value });
      setEditing(null);
    } catch { setMutationError("The change outcome is unknown. Refresh history before trying again."); }
  }

  const members = audience?.members ?? [];
  const audienceChanged = state.audienceEpoch !== null && state.reviewedAudienceEpoch !== state.audienceEpoch;
  const bodyValid = validMessageBody(state.draft);
  const bodyBytes = new TextEncoder().encode(state.draft).byteLength;
  const title = project.name;
  const audienceDescription = members.length ? `Visible to ${members.length} current members · ${members.map((member) => member.name).join(", ")}` : "Visible to current Project members";

  if (state.status === "unavailable") return <ConversationStatus title={title} message="This conversation is unavailable. It may have been removed or you may no longer have access." />;
  if (scope === undefined) return <ConversationStatus action={startFailure ? retryBootstrap : undefined} actionLabel="Retry" error={startFailure && startFailure !== "temporarily_unavailable" ? failureCopy[startFailure] : null} title={title} message={state.status === "offline" ? "Conversation history is offline. Your draft stays here; nothing will send automatically." : "Loading conversation…"} />;
  if (scope === null) return <ConversationStatus action={startConversation} actionLabel="Start conversation" error={startFailure ? failureCopy[startFailure] : null} title={title} message="No Project conversation has been started yet." />;

  return (
    <main className={styles.main}>
      {fixtureActor ? <div className={styles.synthetic}>Synthetic live client · actor {fixtureActor} · no customer data</div> : null}
      <AudienceHeader description={audienceDescription} onToggleRelated={() => {}} relatedOpen={false} showRelatedWork={false} status={scope.lifecycle === "archived" ? "archived" : "active"} title={title} />
      <div className={styles.viewBar}><button onClick={onToggleView} type="button">{view === "full" ? "Context panel" : "Full view"}</button><span>{state.status === "offline" ? "Offline · retrying" : `History checked · revision ${state.cursor}`}</span></div>
      {audienceChanged ? <div className={styles.notice}><strong>Audience changed</strong><span>Review the current members before sending this draft.</span><button onClick={() => state.audienceEpoch !== null && dispatch({ type: "review_audience", audienceEpoch: state.audienceEpoch })} type="button">Review audience</button></div> : null}
      {scope.lifecycle === "archived" ? <div className={styles.notice}><strong>Read-only history</strong><span>Restore the Project before sending or changing messages.</span></div> : null}
      {sendsOff ? <div className={styles.notice}><strong>Sends are off</strong><span>Existing history remains available.</span></div> : null}
      {mutationError ? <div className={styles.errorNotice} role="alert">{mutationError}</div> : null}
      <div className={styles.feedScroller}>
        <ol aria-label="Conversation history" className={styles.feed}>
          {state.messages.length === 0 && state.pending.length === 0 ? <li className={styles.emptyHistory}>No messages yet. Start with the decision or question the Project needs.</li> : null}
          {state.messages.map((message) => <LiveMessage actorId={actorId} editing={editing} key={message.id} members={members} message={message} onCancelEdit={() => setEditing(null)} onDelete={() => void mutate("tombstone", message)} onEdit={(body) => void mutate("edit", message, body)} onStartEdit={() => message.body && setEditing({ id: message.id, body: message.body, revision: message.revision })} setEditing={setEditing} />)}
          {state.pending.map((pending) => <li className={styles.pendingMessage} key={pending.input.clientRequestId}><strong>You</strong><p>{pending.input.body}</p><span>{pending.state === "pending" ? "Sending…" : pending.state === "uncertain" ? "Checking whether this sent" : `Not sent · ${pending.error ? failureCopy[pending.error] : "try again"}`}</span>{pending.state !== "pending" ? <button onClick={() => void resolveSend(pending)} type="button">Check receipt, then retry</button> : null}</li>)}
        </ol>
      </div>
      <section aria-label="Message composer" className={styles.composer}>
        {state.status === "offline" ? <p>Offline. Your draft stays here; nothing will send automatically.</p> : scope.lifecycle === "archived" || sendsOff ? <p>{scope.lifecycle === "archived" ? "This conversation is read only." : "Sending is currently turned off."}</p> : (
          <>
            <textarea aria-label={`Message ${project.name}`} maxLength={CONVERSATION_LIMITS.bodyCharacters} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (!event.nativeEvent.isComposing && event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void send(); } }} placeholder={`Message ${project.name}`} rows={3} value={state.draft} />
            <div><span data-invalid={state.draft.length > 0 && (!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes) || undefined}>{Array.from(state.draft).length.toLocaleString()} / {CONVERSATION_LIMITS.bodyCharacters.toLocaleString()}</span><button disabled={!bodyValid || bodyBytes > CONVERSATION_LIMITS.bodyBytes || audienceChanged} onClick={() => void send()} type="button">Send</button></div>
          </>
        )}
      </section>
    </main>
  );
}

function LiveMessage({ actorId, message, members, editing, setEditing, onStartEdit, onCancelEdit, onEdit, onDelete }: Readonly<{ actorId: string; message: MessageRecord; members: Audience["members"]; editing: { id: string; body: string; revision: number } | null; setEditing: (value: { id: string; body: string; revision: number } | null) => void; onStartEdit: () => void; onCancelEdit: () => void; onEdit: (body: string) => void; onDelete: () => void }>) {
  const name = members.find((member) => member.id === message.authorId)?.name ?? (message.authorId === actorId ? "You" : "Project member");
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <li className={styles.message}><span className={styles.avatar}>{initials}</span><div><div className={styles.messageMeta}><strong>{name}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{message.editedAt ? <span>Edited</span> : null}</div>{message.body === null ? <p className={styles.deleted}>Message removed</p> : editing?.id === message.id ? <div className={styles.editForm}><textarea aria-label="Edit message" onChange={(event) => setEditing({ ...editing, body: event.target.value })} value={editing.body} /><div><button onClick={onCancelEdit} type="button">Cancel</button><button disabled={!validMessageBody(editing.body)} onClick={() => onEdit(editing.body)} type="button">Save edit</button></div></div> : <p>{message.body}</p>}{message.authorId === actorId && message.body !== null && editing?.id !== message.id ? <div className={styles.messageActions}><button onClick={onStartEdit} type="button">Edit</button><button onClick={onDelete} type="button">Delete</button></div> : null}</div></li>;
}

function ConversationStatus({ title, message, action, actionLabel, error }: Readonly<{ title: string; message: string; action?: () => void; actionLabel?: string; error?: string | null }>) {
  return <main className={styles.main}><div className={styles.status}><Icon size={22}><path d="M4 5h16v12H9l-5 4Z" /></Icon><h1>{title}</h1><p>{message}</p>{error ? <span role="alert">{error}</span> : null}{action && actionLabel ? <button onClick={action} type="button">{actionLabel}</button> : null}</div></main>;
}
