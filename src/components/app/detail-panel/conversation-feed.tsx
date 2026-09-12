"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Activity, UserId } from "@/lib/data";
import type { ConversationResult } from "@/lib/conversations/contracts";
import type { TaskCommentRecord, TaskDiscussionSnapshot } from "@/lib/conversations/task-discussion-contracts";
import { useCurrentUser } from "@/lib/auth-context";
import { Avatar } from "@/components/showcase/avatar";
import { MentionField, type MentionPerson } from "@/components/ui/mention-field";
import { formatRelativeTime } from "@/lib/utils";
import { beginTaskSync } from "@/lib/tasks/delight-events";
import { conversationHeaders } from "@/components/app/messages/conversation-client-model";

export type ConversationFeedProps = {
  taskId: string;
  initialDiscussion: TaskDiscussionSnapshot;
  initialActivities?: readonly Activity[];
  /** Explicit lab-only actor forwarded to the local preview interceptor. */
  fixtureActor?: string;
};

type PendingComment = Readonly<{
  clientRequestId: string;
  body: string;
  rootCommentId: string | null;
  state: "pending" | "uncertain";
}>;

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
    key={`${props.taskId}:${props.initialDiscussion.audienceEpoch}:${props.initialDiscussion.throughChangeSeq}`}
    {...props}
  />;
}

function ConversationFeedState({
  taskId,
  initialDiscussion,
  initialActivities = [],
  fixtureActor,
}: ConversationFeedProps) {
  const [discussion, setDiscussion] = useState(initialDiscussion);
  const [comments, setComments] = useState(initialDiscussion.comments);
  const [pending, setPending] = useState<readonly PendingComment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const me = useCurrentUser();

  const refresh = useCallback(async () => {
    const fresh = await apiResult<TaskDiscussionSnapshot>(
      discussionUrl("open", { taskId }), fixtureActor,
    );
    if (!fresh.ok) return false;
    setDiscussion(fresh.value);
    setComments((current) => mergeComments(current, fresh.value.comments));
    setPending([]);
    return true;
  }, [fixtureActor, taskId]);

  useEffect(() => {
    let cancelled = false;
    let cursor = discussion.throughChangeSeq;
    const poll = async () => {
      try {
        const result = await apiResult<import("@/lib/conversations/task-discussion-contracts").TaskDiscussionDelta>(
          discussionUrl("history", { taskId, afterChangeSeq: cursor, limit: 100 }), fixtureActor,
        );
        if (cancelled) return;
        if (result.ok) {
          setComments((current) => mergeComments(current, result.value.comments));
          cursor = result.value.throughChangeSeq;
          if (result.value.audienceEpoch !== discussion.audienceEpoch) {
            setNotice("The people with access changed. Review recipients before sending.");
            await refresh();
          }
        } else if (result.code === "resync_required") {
          await refresh();
        }
      } catch {
        // Polling is advisory. Pending sends use durable receipts for recovery.
      }
    };
    const timer = window.setInterval(poll, 2_500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [discussion.audienceEpoch, discussion.throughChangeSeq, fixtureActor, refresh, taskId]);

  const people = useMemo<MentionPerson[]>(() => discussion.members.map((member) => ({
    id: member.id,
    name: member.name,
    handle: member.name.toLowerCase().replace(/[^a-z0-9]+/g, ""),
  })), [discussion.members]);

  const submit = useCallback(async (
    body: string,
    mentionUserIds: readonly string[],
    rootCommentId: string | null,
  ) => {
    const clientRequestId = newRequestId("task_comment");
    setPending((current) => [...current, { clientRequestId, body, rootCommentId, state: "pending" }]);
    setNotice(null);
    const finishSync = beginTaskSync();
    try {
      const result = await apiResult<import("@/lib/conversations/task-discussion-contracts").TaskCommentReceipt>(
        "/api/task-discussion", fixtureActor, { method: "POST", body: JSON.stringify({
          action: "send", taskId, clientRequestId, expectedAudienceEpoch: discussion.audienceEpoch,
          body, rootCommentId, mentionUserIds,
        }) },
      );
      if (!result.ok) {
        if (result.code === "temporarily_unavailable") throw new Error(result.code);
        setPending((current) => current.filter((item) => item.clientRequestId !== clientRequestId));
        if (result.code === "audience_changed") {
          setNotice("The people with access changed. Review recipients and send again.");
          await refresh();
        } else {
          setNotice(result.code === "archived" ? "This task is archived and read-only." : "Comment not sent.");
        }
        finishSync(new Error(result.code));
        return false;
      }
      await refresh();
      finishSync();
      return true;
    } catch (error) {
      try {
        const lookup = await apiResult<
          { state: "committed"; receipt: import("@/lib/conversations/task-discussion-contracts").TaskCommentReceipt } |
          { state: "absent" }
        >(discussionUrl("receipt", { taskId, clientRequestId }), fixtureActor);
        if (lookup.ok && lookup.value.state === "committed") {
          await refresh();
          finishSync();
          return true;
        }
        if (lookup.ok && lookup.value.state === "absent") {
          setPending((current) => current.filter((item) => item.clientRequestId !== clientRequestId));
          setNotice("Comment not sent. Your draft is still here.");
          finishSync(error);
          return false;
        }
      } catch {
        // The receipt lookup is also uncertain, so keep the local row.
      }
      setPending((current) => current.map((item) =>
        item.clientRequestId === clientRequestId ? { ...item, state: "uncertain" } : item));
      setNotice("Delivery is uncertain. Check the receipt before trying again.");
      finishSync(error);
      return true;
    }
  }, [discussion.audienceEpoch, fixtureActor, refresh, taskId]);

  const edit = useCallback(async (
    comment: TaskCommentRecord,
    body: string,
    mentionUserIds: readonly string[],
  ) => {
    const clientRequestId = newRequestId("task_comment_edit");
    try {
      const result = await apiResult<import("@/lib/conversations/task-discussion-contracts").TaskCommentMutationReceipt>(
        "/api/task-discussion", fixtureActor, { method: "POST", body: JSON.stringify({
          action: "edit", taskId, commentId: comment.id, clientRequestId,
          expectedRevision: comment.revision, expectedAudienceEpoch: discussion.audienceEpoch,
          body, mentionUserIds,
        }) },
      );
      if (result.ok) { await refresh(); return true; }
      if (result.code !== "temporarily_unavailable") {
        setNotice(result.code === "revision_conflict"
          ? "This comment changed. Review the latest version."
          : "Edit not saved.");
        await refresh();
        return false;
      }
    } catch { /* resolve the exact mutation receipt below */ }
    const receipt = await apiResult<{ state: "committed"; receipt: unknown } | { state: "absent" }>(
      discussionUrl("receipt", { taskId, clientRequestId }), fixtureActor,
    ).catch(() => null);
    if (receipt?.ok && receipt.value.state === "committed") { await refresh(); return true; }
    setNotice(receipt?.ok ? "Edit not saved. Your text is still here." : "The edit receipt could not be checked.");
    return false;
  }, [discussion.audienceEpoch, fixtureActor, refresh, taskId]);

  const tombstone = useCallback(async (comment: TaskCommentRecord) => {
    const clientRequestId = newRequestId("task_comment_delete");
    try {
      const result = await apiResult<import("@/lib/conversations/task-discussion-contracts").TaskCommentMutationReceipt>(
        "/api/task-discussion", fixtureActor, { method: "POST", body: JSON.stringify({
          action: "tombstone", taskId, commentId: comment.id, clientRequestId,
          expectedRevision: comment.revision, expectedAudienceEpoch: discussion.audienceEpoch,
        }) },
      );
      if (result.ok) { await refresh(); return; }
      if (result.code !== "temporarily_unavailable") {
        setNotice(result.code === "revision_conflict"
          ? "This comment changed. Review the latest version."
          : "Comment not deleted.");
        await refresh();
        return;
      }
    } catch { /* resolve the exact mutation receipt below */ }
    const receipt = await apiResult<{ state: "committed"; receipt: unknown } | { state: "absent" }>(
      discussionUrl("receipt", { taskId, clientRequestId }), fixtureActor,
    ).catch(() => null);
    if (receipt?.ok && receipt.value.state === "committed") { await refresh(); return; }
    setNotice(receipt?.ok ? "Comment was not deleted." : "The delete receipt could not be checked.");
  }, [discussion.audienceEpoch, fixtureActor, refresh, taskId]);

  const rows = useMemo(() => [
    ...comments.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
    ...initialActivities.map((activity) =>
      ({ kind: "activity" as const, at: activity.createdAt.getTime(), activity })),
  ].sort((a, b) => a.at - b.at), [comments, initialActivities]);

  return (
    <div id="discussion" className="space-y-3 pb-6" data-task-discussion data-audience-epoch={discussion.audienceEpoch}>
      {notice ? (
        <p role="status" className="rounded-lg bg-bg-sunken px-3 py-2 text-[12px] text-ink-soft">{notice}</p>
      ) : null}
      {rows.length === 0 && pending.length === 0 ? <EmptyState /> : (
        <AnimatePresence initial={false}>
          {rows.map((row) => row.kind === "comment" ? (
            <CommentRow key={row.comment.id} comment={row.comment} currentActorId={fixtureActor ?? me}
              members={people} onEdit={edit} onDelete={tombstone} />
          ) : <ActivityRow key={row.activity.id} activity={row.activity} />)}
          {pending.map((item) => <PendingRow key={item.clientRequestId} item={item} />)}
        </AnimatePresence>
      )}
      <Composer key={taskId} taskId={taskId} me={me} people={people}
        disabled={discussion.lifecycle === "archived"} onSubmit={submit} comments={comments} />
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

function CommentRow({ comment, currentActorId, members, onEdit, onDelete }: {
  comment: TaskCommentRecord;
  currentActorId: string;
  members: MentionPerson[];
  onEdit: (comment: TaskCommentRecord, body: string, mentions: readonly string[]) => Promise<boolean>;
  onDelete: (comment: TaskCommentRecord) => void;
}) {
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const own = comment.authorId === currentActorId;
  const mentions = comment.mentionUserIds.filter((id) => members.some((member) => member.id === id));
  return <motion.article id={`comment-${comment.id}`} layout="position"
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
    className={`group/comment flex items-start gap-2.5 rounded-md px-1 py-1 ${comment.rootCommentId ? "ml-8 border-l border-line-soft pl-3" : ""}`}>
    <Initials name={comment.authorName} />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-medium text-ink">{comment.authorName}</span>
        <span className="text-[11px] tabular-nums text-ink-quiet" title={new Date(comment.createdAt).toLocaleString()}>
          {formatRelativeTime(new Date(comment.createdAt))}{comment.editedAt ? " · edited" : ""}
        </span>
      </div>
      {comment.body === null ? (
        <p className="mt-0.5 text-[13px] italic text-ink-quiet">Comment deleted</p>
      ) : editing ? (
        <div className="mt-1 space-y-2">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-lg border border-line-soft bg-white p-2 text-[13px] text-ink" />
          <div className="flex gap-2">
            <button type="button" className="text-[12px] font-medium text-brand"
              onClick={async () => { if (await onEdit(comment, draft, mentions)) setEditing(false); }}>Save</button>
            <button type="button" className="text-[12px] text-ink-quiet"
              onClick={() => { setDraft(comment.body ?? ""); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[var(--x-lead-read)] text-ink-soft">{comment.body}</p>
      )}
      {own && comment.body !== null && !editing ? (
        <div className="mt-1 flex gap-2 opacity-0 transition-opacity group-hover/comment:opacity-100 group-focus-within/comment:opacity-100">
          <button type="button" className="text-[11px] text-ink-quiet hover:text-ink" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="text-[11px] text-ink-quiet hover:text-ink" onClick={() => onDelete(comment)}>Delete</button>
        </div>
      ) : null}
    </div>
  </motion.article>;
}

function PendingRow({ item }: { item: PendingComment }) {
  return <motion.div initial={{ opacity: 0 }}
    animate={{ opacity: item.state === "pending" ? 0.65 : 1 }}
    className={`flex gap-2.5 px-1 py-1 ${item.rootCommentId ? "ml-8 border-l border-line-soft pl-3" : ""}`}>
    <Initials name="You" />
    <div><p className="whitespace-pre-wrap text-[13px] text-ink-soft">{item.body}</p>
      <span className="text-[11px] text-ink-quiet">{item.state === "pending" ? "Sending…" : "Receipt check needed"}</span>
    </div>
  </motion.div>;
}

function ActivityRow({ activity }: { activity: Activity }) {
  const name = activity.authorName ?? "Someone";
  return <div className="flex items-center gap-2 px-1 text-[12px] text-ink-quiet">
    <Initials name={name} />
    <span><strong className="font-medium text-ink-soft">{name}</strong> updated this task</span>
    <span className="ml-auto text-[11px] tabular-nums">{formatRelativeTime(activity.createdAt)}</span>
  </div>;
}

function Composer({ taskId, me, people, disabled, onSubmit, comments }: {
  taskId: string;
  me: UserId;
  people: MentionPerson[];
  disabled: boolean;
  onSubmit: (body: string, mentions: readonly string[], root: string | null) => Promise<boolean>;
  comments: readonly TaskCommentRecord[];
}) {
  const [draft, setDraft] = useState("");
  const [mentionIds, setMentionIds] = useState<readonly string[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const root = comments.find((comment) => comment.id === rootId);

  const change = (value: string) => {
    setDraft(value);
    setMentionIds((ids) => ids.filter((id) => {
      const person = people.find((candidate) => candidate.id === id);
      return person ? value.includes(`@${person.name}`) : false;
    }));
  };
  const submit = async () => {
    if (disabled || sending || !draft.trim()) return;
    setSending(true);
    const accepted = await onSubmit(draft, mentionIds, rootId);
    setSending(false);
    if (accepted) { setDraft(""); setMentionIds([]); setRootId(null); }
    requestAnimationFrame(() => ref.current?.focus());
  };

  return <div className="sticky bottom-0 -mx-6 mt-4 border-t border-line-soft bg-bg-elevated/95 px-6 pb-2 pt-3 backdrop-blur" data-comment-composer>
    {root ? <div className="mb-2 flex items-center justify-between rounded-md bg-bg-sunken px-2 py-1 text-[11px] text-ink-quiet">
      <span>Replying to {root.authorName}</span><button type="button" onClick={() => setRootId(null)}>Cancel</button>
    </div> : null}
    {!root && comments.some((comment) => comment.body !== null && comment.rootCommentId === null) ? (
      <label className="mb-1 block text-[11px] text-ink-quiet">Reply to
        <select value="" onChange={(event) => setRootId(event.target.value || null)} className="ml-1 bg-transparent text-ink-soft">
          <option value="">Discussion</option>
          {comments.filter((comment) => comment.body !== null && comment.rootCommentId === null).map((comment) =>
            <option key={comment.id} value={comment.id}>{comment.authorName}: {comment.body?.slice(0, 40)}</option>)}
        </select>
      </label>
    ) : null}
    <div className="flex items-start gap-2.5">
      <Avatar user={me} size={22} />
      <MentionField ref={ref} value={draft} onChange={change} people={people}
        onMention={(person) => setMentionIds((ids) => ids.includes(person.id) ? ids : [...ids, person.id])}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        rows={1} placeholder="Reply or comment, @ to mention" disabled={disabled || sending}
        className="block min-h-[22px] w-full resize-none bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50" />
      <button type="button" disabled={disabled || sending || !draft.trim()} onClick={() => void submit()}
        className="rounded-full bg-brand px-3 py-1 text-[12px] font-medium text-white disabled:opacity-40">
        {sending ? "Sending" : "Send"}
      </button>
    </div>
    <span className="sr-only">Task {taskId}</span>
  </div>;
}

