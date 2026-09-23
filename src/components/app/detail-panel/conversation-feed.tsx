"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Activity } from "@/lib/data";
import type { ConversationResult } from "@/lib/conversations/contracts";
import type {
  EditTaskCommentInput,
  SendTaskCommentInput,
  TaskCommentRecord,
  TaskCommentReceipt,
  TaskCommentPage,
  TaskDiscussionDelta,
  TaskDiscussionSnapshot,
  TombstoneTaskCommentInput,
} from "@/lib/conversations/task-discussion-contracts";
import { useCurrentUser } from "@/lib/auth-context";
import { MentionField, type MentionPerson } from "@/components/ui/mention-field";
import { formatRelativeTime } from "@/lib/utils";
import { beginTaskSync } from "@/lib/tasks/delight-events";
import { conversationHeaders, shouldSendComposerKey } from "@/components/app/messages/conversation-client-model";
import { ConversationPoller } from "@/lib/conversations/polling";
import { loadDeepLinkedComment } from "@/lib/conversations/deep-link-comment";
import { emptyTaskCommentDraft, withTaskCommentBody, withTaskCommentMention,
  withoutTaskCommentMention, withTaskCommentRoot, type TaskCommentDraft } from "@/lib/conversations/task-comment-draft";
import { useConversationCaches } from "@/components/app/messages/conversation-session-provider";

export type ConversationFeedProps = {
  taskId: string;
  initialDiscussion: TaskDiscussionSnapshot;
  initialActivities?: readonly Activity[];
  /** Explicit lab-only actor forwarded to the local preview interceptor. */
  fixtureActor?: string;
  outgoingCache?: TaskDiscussionOutgoingCache;
};

export type PendingTaskOperation = Readonly<{
  input: (SendTaskCommentInput & { action: "send" }) |
    (EditTaskCommentInput & { action: "edit" }) |
    (TombstoneTaskCommentInput & { action: "tombstone" });
  state: "pending" | "uncertain" | "failed";
  error?: string;
}>;

type ComposerDraft = TaskCommentDraft;

export type TaskDiscussionOutgoingState = Readonly<{
  pending: readonly PendingTaskOperation[];
  draft: ComposerDraft;
  reviewedAudienceEpoch: number;
}>;
export type TaskDiscussionOutgoingCache = Map<string, TaskDiscussionOutgoingState>;

function outgoingKey(actorId: string, projectId: string, taskId: string) {
  return JSON.stringify([actorId, projectId, taskId]);
}

function newRequestId(kind: string) {
  return `${kind}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function apiResult<T>(url: string, fixtureActor: string | undefined, init?: RequestInit) {
  const headers = conversationHeaders(fixtureActor, Boolean(init?.body));
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", headers });
  return await response.json() as ConversationResult<T>;
}

function discussionUrl(action: string, values: Record<string, string | number>) {
  return `/api/task-discussion?${new URLSearchParams({ action,
    ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) })}`;
}

function mergeComments(current: readonly TaskCommentRecord[], incoming: readonly TaskCommentRecord[]) {
  const byId = new Map(current.map((comment) => [comment.id, comment]));
  for (const comment of incoming) {
    const prior = byId.get(comment.id);
    if (!prior || comment.revision >= prior.revision) byId.set(comment.id, comment);
  }
  return [...byId.values()].sort((a, b) => a.createSeq - b.createSeq);
}

/** Canonical task comments plus the task's existing body-free activity history. */
export function ConversationFeed(props: ConversationFeedProps) {
  return <ConversationFeedState
    key={`${props.fixtureActor ?? "current"}:${props.taskId}`}
    {...props}
  />;
}

function ConversationFeedState({
  taskId,
  initialDiscussion,
  initialActivities = [],
  fixtureActor,
  outgoingCache: suppliedOutgoingCache,
}: ConversationFeedProps) {
  const me = useCurrentUser();
  const actorId = fixtureActor ?? me;
  const sessionCaches = useConversationCaches(actorId);
  const outgoingCache = suppliedOutgoingCache ?? sessionCaches.taskDiscussions;
  const cacheKey = outgoingKey(actorId, initialDiscussion.projectId, taskId);
  const restored = outgoingCache.get(cacheKey);
  const [discussion, setDiscussion] = useState(initialDiscussion);
  const [comments, setComments] = useState(initialDiscussion.comments);
  const [pending, setPending] = useState<readonly PendingTaskOperation[]>(
    (restored?.pending ?? []).map((operation) => operation.state === "pending"
      ? { ...operation, state: "uncertain" as const, error: "navigation_interrupted" }
      : operation));
  const [composer, setComposer] = useState<ComposerDraft>(restored?.draft ?? emptyTaskCommentDraft);
  const [notice, setNotice] = useState<string | null>(null);
  const [access, setAccess] = useState<"ready" | "unavailable">("ready");
  const [reviewedAudienceEpoch, setReviewedAudienceEpoch] = useState(
    restored?.reviewedAudienceEpoch ?? initialDiscussion.audienceEpoch,
  );
  const generationRef = useRef(1);
  const operationControllersRef = useRef(new Set<AbortController>());
  const discussionRef = useRef(discussion);
  const cursorRef = useRef(initialDiscussion.throughChangeSeq);
  const pollerRef = useRef<ConversationPoller<{
    history: ConversationResult<TaskDiscussionDelta>;
    snapshot?: ConversationResult<TaskDiscussionSnapshot>;
  }> | null>(null);
  const observedCommentsRef = useRef(new Set<string>());
  const [unreadCommentIds, setUnreadCommentIds] = useState<ReadonlySet<string>>(new Set());
  const deepLinkFocusedRef = useRef(false);
  const deepLinkLoadAttemptedRef = useRef(new Set<string>());
  const discussionNodeRef = useRef<HTMLDivElement>(null);
  function revoke() {
    generationRef.current++;
    for (const controller of operationControllersRef.current) controller.abort();
    operationControllersRef.current.clear();
    pollerRef.current?.stop();
    setAccess("unavailable");
    setDiscussion((current) => ({ ...current, members: [], comments: [] }));
    setComments([]);
    setPending([]);
    setComposer({ body: "", mentionUserIds: [], rootCommentId: null });
    setReviewedAudienceEpoch(0);
    outgoingCache.delete(cacheKey);
    setNotice("Task Discussion is no longer available.");
  }

  function applySnapshot(fresh: TaskDiscussionSnapshot) {
    const changedAudience = fresh.audienceEpoch !== discussionRef.current.audienceEpoch;
    discussionRef.current = fresh;
    cursorRef.current = fresh.throughChangeSeq;
    setDiscussion(fresh);
    setComments((current) => mergeComments(current, fresh.comments));
    setAccess("ready");
    if (changedAudience) setNotice("The people with access changed. Review the current audience before sending.");
  }

  async function refresh(signal: AbortSignal = new AbortController().signal) {
    const generation = generationRef.current;
    const fresh = await apiResult<TaskDiscussionSnapshot>(
      discussionUrl("open", { taskId }), fixtureActor, { signal },
    );
    if (generation !== generationRef.current || signal.aborted) return false;
    if (!fresh.ok) {
      if (fresh.code === "unavailable" || fresh.code === "unauthenticated") revoke();
      return false;
    }
    applySnapshot(fresh.value);
    return true;
  }

  useEffect(() => {
    const operationControllers = operationControllersRef.current;
    const poll = async (signal: AbortSignal) => {
      const history = await apiResult<TaskDiscussionDelta>(
        discussionUrl("history", { taskId, afterChangeSeq: cursorRef.current, limit: 100 }),
        fixtureActor, { signal },
      );
      if ((history.ok && history.value.audienceEpoch !== discussionRef.current.audienceEpoch) ||
          (!history.ok && history.code === "resync_required")) {
        return { history, snapshot: await apiResult<TaskDiscussionSnapshot>(
          discussionUrl("open", { taskId }), fixtureActor, { signal },
        ) };
      }
      return { history };
    };
    const apply = ({ history, snapshot }: {
      history: ConversationResult<TaskDiscussionDelta>;
      snapshot?: ConversationResult<TaskDiscussionSnapshot>;
    }) => {
      if (snapshot?.ok) { applySnapshot(snapshot.value); return; }
      const failure = snapshot && !snapshot.ok ? snapshot : !history.ok ? history : null;
      if (failure) {
        if (failure.code === "unavailable" || failure.code === "unauthenticated") revoke();
        else if (failure.code !== "temporarily_unavailable") setNotice("Task Discussion could not be refreshed.");
        return;
      }
      if (!history.ok) return;
      cursorRef.current = history.value.throughChangeSeq;
      discussionRef.current = { ...discussionRef.current,
        audienceEpoch: history.value.audienceEpoch,
        throughChangeSeq: history.value.throughChangeSeq };
      setDiscussion((current) => ({ ...current,
        audienceEpoch: history.value.audienceEpoch,
        throughChangeSeq: history.value.throughChangeSeq }));
      setComments((current) => mergeComments(current, history.value.comments));
    };
    const poller = new ConversationPoller<{
      history: ConversationResult<TaskDiscussionDelta>;
      snapshot?: ConversationResult<TaskDiscussionSnapshot>;
    }>({
      poll: (_scope, signal) => poll(signal),
      apply,
      isRetryable: ({ history, snapshot }) =>
        (!history.ok && history.code === "temporarily_unavailable") ||
        Boolean(snapshot && !snapshot.ok && snapshot.code === "temporarily_unavailable"),
    });
    pollerRef.current = poller;
    const configure = () => poller.configure(
      { actorId, projectId: initialDiscussion.projectId, conversationId: taskId },
      document.visibilityState === "visible",
      document.hasFocus(),
    );
    configure();
    document.addEventListener("visibilitychange", configure);
    window.addEventListener("focus", configure);
    window.addEventListener("blur", configure);
    return () => {
      document.removeEventListener("visibilitychange", configure);
      window.removeEventListener("focus", configure);
      window.removeEventListener("blur", configure);
      poller.stop();
      for (const operation of operationControllers) operation.abort();
      operationControllers.clear();
      if (pollerRef.current === poller) pollerRef.current = null;
    };
    // Scope and generation are captured for this poller lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, fixtureActor, initialDiscussion.projectId, taskId]);

  useEffect(() => {
    if (access !== "ready") { outgoingCache.delete(cacheKey); return; }
    if (pending.length || composer.body) {
      outgoingCache.set(cacheKey, { pending, draft: composer, reviewedAudienceEpoch });
    } else {
      outgoingCache.delete(cacheKey);
    }
  }, [access, cacheKey, composer, outgoingCache, pending, reviewedAudienceEpoch]);

  useEffect(() => {
    if (fixtureActor || access !== "ready") return;
    const loaded = comments.filter(comment => comment.body !== null);
    if (!loaded.length) return;
    let cancelled = false;
    const groups = Array.from({ length: Math.ceil(loaded.length / 100) }, (_, index) => loaded.slice(index * 100, (index + 1) * 100));
    void Promise.all(groups.map(group => fetch("/api/message-attention", { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", items: group.map(comment => ({ kind: "task_discussion", scopeId: taskId, itemId: comment.id })) }),
    }).then(async response => response.ok ? await response.json() as { ok: boolean; value?: { unreadItemIds: string[] } } : null)))
      .then(results => {
        if (cancelled || results.some(result => !result?.ok || !result.value)) return;
        setUnreadCommentIds(new Set(results.flatMap(result => result?.value?.unreadItemIds ?? [])
          .filter(id => !observedCommentsRef.current.has(id))));
      }).catch(() => { /* Preserve the last proven status until the next loaded page. */ });
    return () => { cancelled = true; };
  }, [access, comments, fixtureActor, taskId]);

  useEffect(() => {
    if (fixtureActor || access !== "ready" || !discussionNodeRef.current || typeof IntersectionObserver === "undefined") return;
    const source = new Map(comments.filter(comment => comment.body !== null).map(comment => [comment.id, comment]));
    const nodes = [...discussionNodeRef.current.querySelectorAll<HTMLElement>("[data-comment-observe]")];
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible") return;
      const visible = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.6)
        .map(entry => source.get((entry.target as HTMLElement).dataset.observeCommentId ?? ""))
        .filter((comment): comment is TaskCommentRecord => comment !== undefined && !observedCommentsRef.current.has(comment.id));
      if (!visible.length) return;
      for (const comment of visible) observedCommentsRef.current.add(comment.id);
      void fetch("/api/message-attention", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "observe", items: visible.map(comment => ({ kind: "task_discussion", scopeId: taskId, itemId: comment.id })) }) })
        .then(response => { if (!response.ok) for (const comment of visible) observedCommentsRef.current.delete(comment.id);
          else setUnreadCommentIds(current => new Set([...current].filter(id => !visible.some(comment => comment.id === id)))); })
        .catch(() => { for (const comment of visible) observedCommentsRef.current.delete(comment.id); });
    }, { threshold: 0.6 });
    for (const node of nodes) observer.observe(node);
    // IntersectionObserver does not repeat an unchanged ratio when a hidden
    // tab returns to foreground. Re-observe loaded sentinels on that transition.
    const resample = () => {
      if (document.visibilityState !== "visible") return;
      for (const node of nodes) { observer.unobserve(node); observer.observe(node); }
    };
    document.addEventListener("visibilitychange", resample);
    return () => { document.removeEventListener("visibilitychange", resample); observer.disconnect(); };
  }, [access, comments, fixtureActor, taskId]);

  useEffect(() => {
    if (deepLinkFocusedRef.current || !location.hash.startsWith("#comment-")) return;
    let id: string;
    try { id = decodeURIComponent(location.hash.slice("#comment-".length)); } catch { return; }
    if (!comments.some(comment => comment.id === id && comment.body !== null)) {
      if (!fixtureActor && access === "ready" && !deepLinkLoadAttemptedRef.current.has(id)) {
        deepLinkLoadAttemptedRef.current.add(id);
        const generation = generationRef.current;
        const controller = new AbortController();
        operationControllersRef.current.add(controller);
        void loadDeepLinkedComment({
          commentId: id,
          isCurrent: () => generation === generationRef.current && !controller.signal.aborted,
          position: async () => {
            const response = await fetch("/api/message-attention", { method: "POST", credentials: "same-origin", cache: "no-store",
              headers: { "Content-Type": "application/json" }, signal: controller.signal,
              body: JSON.stringify({ action: "status", items: [{ kind: "task_discussion", scopeId: taskId, itemId: id }] }),
            });
            if (!response.ok) return { ok: false, code: "unavailable" } as const;
            return await response.json() as { ok: true; value: { positions: { itemId: string; createSeq: number }[] } } |
              { ok: false; code: "unavailable" };
          },
          page: beforeCreateSeq => apiResult<TaskCommentPage>(
            discussionUrl("comments", { taskId, beforeCreateSeq, limit: 100 }), fixtureActor, { signal: controller.signal }),
          onLoaded: loaded => setComments(current => mergeComments(current, loaded)),
        }).catch(() => { /* Keep a missing or revoked target private. */ })
          .finally(() => operationControllersRef.current.delete(controller));
      }
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`comment-${id}`);
      if (target) { target.scrollIntoView({ block: "center" }); target.focus({ preventScroll: true }); deepLinkFocusedRef.current = true; }
    });
    return () => cancelAnimationFrame(frame);
  }, [access, comments, fixtureActor, taskId]);

  const people = useMemo<MentionPerson[]>(() => discussion.members.map((member) => ({
    id: member.id,
    name: member.name,
    handle: member.name.toLowerCase().replace(/[^a-z0-9]+/g, ""),
  })), [discussion.members]);

  const updatePending = useCallback((clientRequestId: string,
    update: (operation: PendingTaskOperation) => PendingTaskOperation) => {
    setPending((current) => current.map((operation) =>
      operation.input.clientRequestId === clientRequestId ? update(operation) : operation));
  }, []);

  const completePending = useCallback((clientRequestId: string) => {
    setPending((current) => current.filter((operation) => operation.input.clientRequestId !== clientRequestId));
  }, []);

  async function receiptFor(operation: PendingTaskOperation, retryWhenAbsent: boolean) {
    const requestId = operation.input.clientRequestId;
    const generation = generationRef.current;
    const controller = new AbortController();
    operationControllersRef.current.add(controller);
    try {
      const lookup = await apiResult<
        { state: "committed"; receipt: TaskCommentReceipt } | { state: "absent" }
      >(discussionUrl("receipt", { taskId, clientRequestId: requestId }), fixtureActor,
        { signal: controller.signal });
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (!lookup.ok) {
        if (lookup.code === "unavailable" || lookup.code === "unauthenticated") { revoke(); return; }
        updatePending(requestId, (current) => ({ ...current, state: "uncertain", error: lookup.code }));
        return;
      }
      if (lookup.value.state === "committed") {
        completePending(requestId);
        await refresh();
        return;
      }
      if (!retryWhenAbsent) {
        updatePending(requestId, (current) => ({ ...current, state: "failed", error: "not_committed" }));
        return;
      }
      if (reviewedAudienceEpoch !== discussionRef.current.audienceEpoch) {
        updatePending(requestId, (current) => ({ ...current, state: "failed", error: "audience_changed" }));
        setNotice("Review the current audience before retrying this exact request.");
        return;
      }
      await postOperation(operation);
    } catch {
      if (generation === generationRef.current && !controller.signal.aborted) {
        updatePending(requestId, (current) => ({ ...current, state: "uncertain", error: "temporarily_unavailable" }));
      }
    } finally {
      operationControllersRef.current.delete(controller);
    }
  }

  async function postOperation(operation: PendingTaskOperation) {
    const requestId = operation.input.clientRequestId;
    const generation = generationRef.current;
    const controller = new AbortController();
    operationControllersRef.current.add(controller);
    updatePending(requestId, (current) => ({ ...current, state: "pending", error: undefined }));
    try {
      const result = await apiResult<TaskCommentReceipt>("/api/task-discussion", fixtureActor, {
        method: "POST",
        body: JSON.stringify({ ...operation.input,
          expectedAudienceEpoch: discussionRef.current.audienceEpoch }),
        signal: controller.signal,
      });
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (result.ok) {
        completePending(requestId);
        await refresh();
        return;
      }
      if (result.code === "unavailable" || result.code === "unauthenticated") { revoke(); return; }
      if (result.code === "temporarily_unavailable") {
        updatePending(requestId, (current) => ({ ...current, state: "uncertain", error: result.code }));
        await receiptFor(operation, false);
        return;
      }
      updatePending(requestId, (current) => ({ ...current, state: "failed", error: result.code }));
      if (result.code === "audience_changed") await refresh();
    } catch {
      if (generation === generationRef.current && !controller.signal.aborted) {
        updatePending(requestId, (current) => ({ ...current, state: "uncertain", error: "temporarily_unavailable" }));
        await receiptFor(operation, false);
      }
    } finally {
      operationControllersRef.current.delete(controller);
    }
  }

  async function queueOperation(operation: PendingTaskOperation) {
    if (access !== "ready") return false;
    if (reviewedAudienceEpoch !== discussionRef.current.audienceEpoch) {
      setNotice("Review the current audience before sending or changing comments.");
      return false;
    }
    setPending((current) => current.some((item) =>
      item.input.clientRequestId === operation.input.clientRequestId) ? current : [...current, operation]);
    setNotice(null);
    void postOperation(operation);
    return true;
  }

  async function submit(
    body: string,
    mentionUserIds: readonly string[],
    rootCommentId: string | null,
  ) {
    const clientRequestId = newRequestId("task_comment");
    const finishSync = beginTaskSync();
    const accepted = await queueOperation({ state: "pending", input: {
      action: "send", taskId, clientRequestId,
      expectedAudienceEpoch: discussion.audienceEpoch,
      body, rootCommentId, mentionUserIds: [...mentionUserIds],
    } });
    finishSync(accepted ? undefined : new Error("audience_changed"));
    return accepted;
  }

  async function edit(
    comment: TaskCommentRecord,
    body: string,
    mentionUserIds: readonly string[],
  ) {
    const clientRequestId = newRequestId("task_comment_edit");
    return queueOperation({ state: "pending", input: {
      action: "edit", taskId, commentId: comment.id, clientRequestId,
      expectedRevision: comment.revision, expectedAudienceEpoch: discussion.audienceEpoch,
      body, mentionUserIds: [...mentionUserIds],
    } });
  }

  async function tombstone(comment: TaskCommentRecord) {
    const clientRequestId = newRequestId("task_comment_delete");
    await queueOperation({ state: "pending", input: {
      action: "tombstone", taskId, commentId: comment.id, clientRequestId,
      expectedRevision: comment.revision, expectedAudienceEpoch: discussion.audienceEpoch,
    } });
  }

  const rows = useMemo(() => [
    ...comments.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
    ...initialActivities.map((activity) =>
      ({ kind: "activity" as const, at: activity.createdAt.getTime(), activity })),
  ].sort((a, b) => a.at - b.at), [comments, initialActivities]);

  if (access === "unavailable") return (
    <div id="discussion" className="space-y-3 pb-6" data-task-discussion data-discussion-unavailable>
      <p role="status" className="rounded-lg bg-bg-sunken px-3 py-2 text-[12px] text-ink-soft">
        Task Discussion is no longer available.
      </p>
    </div>
  );

  const audienceReady = reviewedAudienceEpoch === discussion.audienceEpoch;
  return (
    <div id="discussion" ref={discussionNodeRef} className="space-y-3 pb-6" data-task-discussion data-audience-epoch={discussion.audienceEpoch}>
      {notice ? (
        <p role="status" className="rounded-lg bg-bg-sunken px-3 py-2 text-[12px] text-ink-soft">{notice}</p>
      ) : null}
      {!audienceReady ? <div className="rounded-lg border border-line-soft bg-bg-sunken px-3 py-2 text-[12px] text-ink-soft">
        <p>Project access changed. Review the current {discussion.members.length} people before continuing.</p>
        <p>{discussion.members.map((member) => member.name).join(", ")}</p>
        <button type="button" className="mt-1 font-medium text-brand" onClick={() => {
          setReviewedAudienceEpoch(discussion.audienceEpoch);
          setNotice(null);
        }}>I reviewed the current audience</button>
      </div> : null}
      {rows.length === 0 && pending.length === 0 ? <EmptyState /> : (
        <AnimatePresence initial={false}>
          {rows.map((row) => row.kind === "comment" ? (
            <CommentRow key={row.comment.id} comment={row.comment} unread={unreadCommentIds.has(row.comment.id)} currentActorId={fixtureActor ?? me}
              members={people} onEdit={edit} onDelete={tombstone} />
          ) : <ActivityRow key={row.activity.id} activity={row.activity} />)}
          {pending.map((item) => <PendingRow key={item.input.clientRequestId} item={item}
            canRetry={audienceReady} onResolve={() => void receiptFor(item, true)}
            onDiscard={() => completePending(item.input.clientRequestId)} />)}
        </AnimatePresence>
      )}
      <Composer taskId={taskId} actorName={people.find((person) => person.id === actorId)?.name ?? "You"}
        people={people} draft={composer} onDraftChange={setComposer}
        disabled={discussion.lifecycle === "archived" || !audienceReady} onSubmit={submit} comments={comments} />
    </div>
  );
}

function EmptyState() {
  return <div className="py-1">
    <div className="text-[13px] text-ink-quiet">No discussion yet.</div>
    <div className="text-[12px] text-ink-faint">Comments and changes will appear here as they happen.</div>
  </div>;
}

function Initials({ name }: { name: string }) {
  return <span aria-hidden className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-bg-sunken text-[9px] font-semibold text-ink-soft">
    {name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
  </span>;
}

function CommentRow({ comment, unread, currentActorId, members, onEdit, onDelete }: {
  comment: TaskCommentRecord;
  unread: boolean;
  currentActorId: string;
  members: MentionPerson[];
  onEdit: (comment: TaskCommentRecord, body: string, mentions: readonly string[]) => Promise<boolean>;
  onDelete: (comment: TaskCommentRecord) => void;
}) {
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const [mentionIds, setMentionIds] = useState<readonly string[]>(comment.mentionUserIds);
  const own = comment.authorId === currentActorId;
  return <motion.article id={`comment-${comment.id}`} data-comment-id={comment.id} tabIndex={-1} layout="position"
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
    className={`group/comment relative flex items-start gap-2.5 rounded-md px-1 py-1 ${comment.rootCommentId ? "ml-8 border-l border-line-soft pl-3" : ""}`}>
    <span aria-hidden data-comment-observe data-observe-comment-id={comment.id} className="pointer-events-none absolute inset-x-0 top-0 h-6" />
    <Initials name={comment.authorName} />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-medium text-ink">{comment.authorName}</span>
        <span className="text-[11px] tabular-nums text-ink-quiet" title={new Date(comment.createdAt).toLocaleString()}>
          {formatRelativeTime(new Date(comment.createdAt))}{comment.editedAt ? " · edited" : ""}
        </span>
        {unread && comment.body !== null ? <span className="text-[11px] font-semibold text-indigo-700">Unread</span> : null}
      </div>
      {comment.body === null ? (
        <p className="mt-0.5 text-[13px] italic text-ink-quiet">Comment deleted</p>
      ) : editing ? (
        <div className="mt-1 space-y-2">
          <MentionField value={draft} onChange={setDraft} people={members}
            aria-label="Edit comment"
            onMention={(person) => setMentionIds((current) => current.includes(person.id) ? current : [...current, person.id])}
            className="w-full rounded-lg border border-line-soft bg-white p-2 text-[13px] text-ink" />
          <MentionSelection people={members} selectedIds={mentionIds}
            onRemove={(id) => setMentionIds((current) => current.filter((item) => item !== id))} />
          <div className="flex gap-2">
            <button type="button" className="text-[12px] font-medium text-brand"
              onClick={async () => { if (await onEdit(comment, draft, mentionIds)) setEditing(false); }}>Save</button>
            <button type="button" className="text-[12px] text-ink-quiet"
              onClick={() => { setDraft(comment.body ?? ""); setMentionIds(comment.mentionUserIds); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[var(--x-lead-read)] text-ink-soft">{comment.body}</p>
      )}
      {own && comment.body !== null && !editing ? (
        <div className="mt-1 flex gap-2 opacity-0 transition-opacity group-hover/comment:opacity-100 group-focus-within/comment:opacity-100">
          <button type="button" className="text-[11px] text-ink-quiet hover:text-ink" onClick={() => {
            setDraft(comment.body ?? ""); setMentionIds(comment.mentionUserIds); setEditing(true);
          }}>Edit</button>
          <button type="button" className="text-[11px] text-ink-quiet hover:text-ink" onClick={() => onDelete(comment)}>Delete</button>
        </div>
      ) : null}
    </div>
  </motion.article>;
}

function PendingRow({ item, canRetry, onResolve, onDiscard }: {
  item: PendingTaskOperation;
  canRetry: boolean;
  onResolve: () => void;
  onDiscard: () => void;
}) {
  const input = item.input;
  const body = input.action === "tombstone" ? "Delete comment" : input.body;
  const label = input.action === "send" ? "Comment" : input.action === "edit" ? "Edit" : "Deletion";
  return <motion.div initial={{ opacity: 0 }}
    animate={{ opacity: item.state === "pending" ? 0.65 : 1 }}
    className={`flex gap-2.5 px-1 py-1 ${input.action === "send" && input.rootCommentId ? "ml-8 border-l border-line-soft pl-3" : ""}`}>
    <Initials name="You" />
    <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap text-[13px] text-ink-soft">{body}</p>
      <span className="text-[11px] text-ink-quiet">{label} · {item.state === "pending" ? "Sending…" : item.state === "uncertain" ? "Receipt check needed" : "Not committed"}</span>
      {item.state !== "pending" ? <div className="mt-1 flex gap-2">
        <button type="button" disabled={!canRetry} className="text-[11px] font-medium text-brand disabled:opacity-40" onClick={onResolve}>Check receipt, then retry</button>
        {item.state === "failed" ? <button type="button" className="text-[11px] text-ink-quiet" onClick={onDiscard}>Discard</button> : null}
      </div> : null}
    </div>
  </motion.div>;
}

function MentionSelection({ people, selectedIds, onRemove }: {
  people: readonly MentionPerson[];
  selectedIds: readonly string[];
  onRemove: (id: string) => void;
}) {
  if (!selectedIds.length) return null;
  return <div className="flex flex-wrap gap-1" aria-label="Selected mentions">
    {selectedIds.map((id) => <button key={id} type="button" onClick={() => onRemove(id)}
      className="rounded-full bg-bg-sunken px-2 py-0.5 text-[10px] text-ink-soft">
      @{people.find((person) => person.id === id)?.name ?? "Member"} ×
    </button>)}
  </div>;
}

function ActivityRow({ activity }: { activity: Activity }) {
  const name = activity.authorName ?? "Someone";
  return <div className="flex items-center gap-2 px-1 text-[12px] text-ink-quiet">
    <Initials name={name} />
    <span><strong className="font-medium text-ink-soft">{name}</strong> updated this task</span>
    <span className="ml-auto text-[11px] tabular-nums">{formatRelativeTime(activity.createdAt)}</span>
  </div>;
}

function Composer({ taskId, actorName, people, draft, disabled, onSubmit, onDraftChange, comments }: {
  taskId: string;
  actorName: string;
  people: MentionPerson[];
  draft: ComposerDraft;
  disabled: boolean;
  onSubmit: (body: string, mentions: readonly string[], root: string | null) => Promise<boolean>;
  onDraftChange: Dispatch<SetStateAction<ComposerDraft>>;
  comments: readonly TaskCommentRecord[];
}) {
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const root = comments.find((comment) => comment.id === draft.rootCommentId);

  const change = (value: string) => {
    onDraftChange(withTaskCommentBody(value));
  };
  const submit = async () => {
    if (disabled || sending || !draft.body.trim()) return;
    setSending(true);
    const accepted = await onSubmit(draft.body, draft.mentionUserIds, draft.rootCommentId);
    setSending(false);
    if (accepted) onDraftChange(emptyTaskCommentDraft);
    requestAnimationFrame(() => ref.current?.focus());
  };

  return <div className="sticky bottom-0 -mx-6 mt-4 border-t border-line-soft bg-bg-elevated/95 px-6 pb-2 pt-3 backdrop-blur" data-comment-composer>
    {root ? <div className="mb-2 flex items-center justify-between rounded-md bg-bg-sunken px-2 py-1 text-[11px] text-ink-quiet">
      <span>Replying to {root.authorName}</span><button type="button" onClick={() => onDraftChange(withTaskCommentRoot(null))}>Cancel</button>
    </div> : null}
    {!root && comments.some((comment) => comment.body !== null && comment.rootCommentId === null) ? (
      <label className="mb-1 block text-[11px] text-ink-quiet">Reply to
        <select value="" onChange={(event) => onDraftChange(withTaskCommentRoot(event.target.value || null))} className="ml-1 bg-transparent text-ink-soft">
          <option value="">Discussion</option>
          {comments.filter((comment) => comment.body !== null && comment.rootCommentId === null).map((comment) =>
            <option key={comment.id} value={comment.id}>{comment.authorName}: {comment.body?.slice(0, 40)}</option>)}
        </select>
      </label>
    ) : null}
    <div className="flex items-start gap-2.5">
      <Initials name={actorName} />
      <MentionField ref={ref} value={draft.body} onChange={change} people={people}
        onMention={(person) => onDraftChange(withTaskCommentMention(person.id))}
        onKeyDown={(event) => {
          const mobileReturn = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
          if (shouldSendComposerKey({ key: event.key, shiftKey: event.shiftKey,
            composing: event.nativeEvent.isComposing, mobileReturn })) {
            event.preventDefault();
            void submit();
          }
        }}
        rows={1} placeholder="Reply or comment, @ to mention" disabled={disabled || sending}
        className="block min-h-[22px] w-full resize-none bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50" />
      <button type="button" disabled={disabled || sending || !draft.body.trim()} onClick={() => void submit()}
        className="rounded-full bg-brand px-3 py-1 text-[12px] font-medium text-white disabled:opacity-40">
        {sending ? "Sending" : "Send"}
      </button>
    </div>
    <div className="ml-8 mt-1">
      <MentionSelection people={people} selectedIds={draft.mentionUserIds}
        onRemove={(id) => onDraftChange(withoutTaskCommentMention(id))} />
    </div>
    <span className="sr-only">Task {taskId}</span>
  </div>;
}
