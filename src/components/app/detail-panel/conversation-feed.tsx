"use client";

import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  isSeedUser,
  LANES,
  USERS,
  type Activity,
  type ActivityPayload,
  type Comment,
  type LaneId,
  type UserId,
} from "@/lib/data";
import { useCurrentUser } from "@/lib/auth-context";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { Avatar } from "@/components/showcase/avatar";
import { MentionField, toMentionPeople, type MentionPerson } from "@/components/ui/mention-field";
import { formatRelativeTime } from "@/lib/utils";
import {
  addCommentAction,
  removeCommentAction,
} from "@/server/actions/comments";
import type { ConversationItem } from "@/server/db/queries";
import { DraftReplyButton } from "@/components/app/ai/draft-reply-button";
import { ConversationSummary } from "@/components/app/ai/conversation-summary";
import { beginTaskSync } from "@/lib/tasks/delight-events";

/** Threshold: thread must have ≥ this many comments before the
 *  "Summarize this thread" affordance is offered. Below that the
 *  reader can just read it. */
const SUMMARIZE_MIN_MESSAGES = 6;

type Props = {
  taskId: string;
  initialItems: ConversationItem[];
  /** People to offer for @mentions — the task's assignees. Participants who
   *  have already commented are folded in from the live feed. */
  assigneeIds?: UserId[];
};

/**
 * Unified Conversation feed, comments and activity interleaved
 * chronologically (oldest at top, composer at bottom). Replaces the
 * previous separate Activity + Comments sections so the panel reads
 * like a real conversation history.
 *
 * Optimistic adds use `temp-<n>` ids so deletes that haven't been
 * acknowledged by the server are pure local removes.
 */
export function ConversationFeed({ taskId, initialItems, assigneeIds = [] }: Props) {
  const [items, setItems] = useState<ConversationItem[]>(initialItems);
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const me = useCurrentUser();
  const members = useWorkspaceMembers();

  // Mention pool: everyone in the workspace, then the task's assignees, then
  // everyone who has spoken in the thread. Members lead because that is who
  // the writer can actually reach; assignees and past speakers are folded in
  // so a person who has since left the workspace still resolves in an old
  // thread. Before members were included the pool was assignees plus speakers
  // only, so in a fresh workspace nobody could be mentioned until someone had
  // already commented — a two-person wedding workspace could not @ its second
  // person. Names carry into the posted body as "@Name" and the server's
  // existing mention scan turns those into notifications.
  const people: MentionPerson[] = useMemo(() => {
    const commentAuthors = items
      .filter((it) => it.kind === "comment")
      .map((it) => it.comment.userId);
    const memberNames = new Map(members.map((m) => [m.id, m.name]));
    return toMentionPeople(
      [...members.map((m) => m.id), ...assigneeIds, ...commentAuthors],
      (id) => {
        const name = memberNames.get(id);
        return name ? { name } : USERS[id];
      },
    );
  }, [assigneeIds, items, members]);

  const handleAdd = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const tempId = `temp-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Comment = {
        id: tempId,
        taskId,
        userId: me,
        // authorName null here, the server round-trip will supply the real
        // name; the fallback in CommentRow reads USERS[me].name for seed
        // users and will show the right name for the current session user.
        authorName: null,
        body: trimmed,
        createdAt: new Date(),
      };
      setItems((cur) => [
        ...cur,
        { kind: "comment", comment: optimistic },
      ]);
      setPending(true);
      const finishSync = beginTaskSync();
      startTransition(async () => {
        try {
          const fresh = await addCommentAction(taskId, trimmed);
          // Reconcile: replace temp comment with the server's persisted
          // comments + leave activity alone (parent reload will refresh
          // activities through the panel re-fetch).
          setItems((cur) => {
            const nonComments = cur.filter((it) => it.kind !== "comment");
            const next: ConversationItem[] = [
              ...nonComments,
              ...fresh.map<ConversationItem>((c) => ({
                kind: "comment",
                comment: c,
              })),
            ];
            next.sort(
              (a, b) =>
                keyOf(a).getTime() - keyOf(b).getTime(),
            );
            return next;
          });
          finishSync();
        } catch (err) {
          console.warn("comments: add failed; rolling back", err);
          setItems((cur) =>
            cur.filter(
              (it) =>
                !(it.kind === "comment" && it.comment.id === tempId),
            ),
          );
          finishSync(err);
        } finally {
          setPending(false);
        }
      });
    },
    [taskId, me],
  );

  const handleRemove = useCallback(
    (commentId: string) => {
      const removed = items.find(
        (item) => item.kind === "comment" && item.comment.id === commentId,
      );
      // Optimistic delete; if it's a temp id we never sent it.
      setItems((cur) =>
        cur.filter(
          (it) =>
            !(it.kind === "comment" && it.comment.id === commentId),
        ),
      );
      if (commentId.startsWith("temp-")) return;
      const finishSync = beginTaskSync();
      startTransition(async () => {
        try {
          await removeCommentAction(commentId);
          finishSync();
        } catch (err) {
          console.warn("comments: remove failed", err);
          if (removed) {
            setItems((current) => {
              if (current.some((item) => item.kind === "comment" && item.comment.id === commentId)) return current;
              return [...current, removed].sort((a, b) => keyOf(a).getTime() - keyOf(b).getTime());
            });
          }
          finishSync(err);
        }
      });
    },
    [items],
  );

  const commentCount = items.filter((it) => it.kind === "comment").length;

  return (
    <div className="space-y-3 pb-6">
      <ConversationSummary
        taskId={taskId}
        eligible={commentCount >= SUMMARIZE_MIN_MESSAGES}
      />
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <AnimatePresence initial={false}>
          {items.map((it) =>
            it.kind === "comment" ? (
              <CommentRow
                key={it.comment.id}
                comment={it.comment}
                me={me}
                onRemove={() => handleRemove(it.comment.id)}
              />
            ) : (
              <ActivityRow key={it.activity.id} activity={it.activity} />
            ),
          )}
        </AnimatePresence>
      )}

      <Composer
        me={me}
        taskId={taskId}
        people={people}
        disabled={!taskId}
        isPending={pending}
        onSubmit={handleAdd}
      />
    </div>
  );
}

function keyOf(i: ConversationItem): Date {
  return i.kind === "comment" ? i.comment.createdAt : i.activity.createdAt;
}

function EmptyState() {
  return (
    <div className="py-1">
      <div className="text-[13px] text-ink-quiet">No conversation yet.</div>
      <div className="text-[12px] text-ink-faint">
        Comments and changes will appear here as they happen.
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  me,
  onRemove,
}: {
  comment: Comment;
  me: import("@/lib/data").UserId;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const u = USERS[comment.userId];
  // authorName is resolved at query time via LEFT JOIN users; fall back to
  // the seeded USERS map for demo data, then to a generic label.
  const displayName = comment.authorName ?? u.name;
  const isOwn = comment.userId === me;

  return (
    <motion.div
      layout="position"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      exit={{ opacity: 0 }}
      transition={
        reduce
          ? { duration: 0.12 }
          : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
      }
      className="group/comment relative flex items-start gap-2.5 rounded-md px-1 py-1"
    >
      <Avatar user={comment.userId} size={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-medium text-ink">{displayName}</span>
          {isSeedUser(comment.userId) ? (
            <span className="rounded bg-bg-sunken px-1 py-0 text-[11px] text-ink-faint">
              sample
            </span>
          ) : null}
          <span
            className="text-[11px] tabular-nums text-ink-quiet"
            title={comment.createdAt.toLocaleString()}
          >
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[var(--x-lead-read)] text-ink-soft">
          {comment.body}
        </p>
      </div>
      {isOwn ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete comment"
          className="absolute right-0 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity duration-150 hover:bg-bg-sunken hover:text-ink-soft group-hover/comment:opacity-100 focus-visible:opacity-100"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      ) : null}
    </motion.div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const reduce = useReducedMotion();
  const u = USERS[activity.userId];
  // authorName resolved at query time; fall back to seeded USERS map.
  const displayName = activity.authorName ?? u.name;
  const sentence = formatActivityLine(activity.payload);
  return (
    <motion.li
      layout="position"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(2px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      transition={{ duration: reduce ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center gap-2 px-1 text-[12px] leading-[var(--x-lead-read)] text-ink-quiet"
    >
      <span className="block h-px flex-shrink-0" style={{ width: 22 }} aria-hidden>
        <Avatar user={activity.userId} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-ink-soft">{displayName}</span>
        {isSeedUser(activity.userId) ? (
          <span className="ml-1 rounded bg-bg-sunken px-1 py-0 text-[11px] text-ink-faint">
            sample
          </span>
        ) : null}{" "}
        <span>{sentence}</span>
      </span>
      <span
        className="flex-shrink-0 select-none tabular-nums"
        title={activity.createdAt.toLocaleString("en-US")}
      >
        {formatRelativeTime(activity.createdAt)}
      </span>
    </motion.li>
  );
}

function laneLabel(lane: LaneId): string {
  return LANES[lane].name;
}

function formatActivityLine(payload: ActivityPayload): string {
  switch (payload.kind) {
    case "taskAdd":
      return "created this task";
    case "move":
      return `moved this from ${laneLabel(payload.from)} to ${laneLabel(payload.to)}`;
    case "toggleComplete":
      return payload.to === "done"
        ? "marked this complete"
        : "reopened this";
    case "update": {
      switch (payload.field) {
        case "title":
          return "renamed this";
        case "description":
          return "edited the description";
        case "priority":
          return "changed the priority";
        case "due":
          return "updated the due date";
        case "assignees":
          return "updated assignees";
        case "tags":
          return "updated tags";
        case "estimate":
          return "updated the estimate";
        case "recurrence":
          return "set a recurrence";
        default: {
          const _exhaustive: never = payload.field;
          void _exhaustive;
          return "edited this";
        }
      }
    }
    case "commentAdd":
      return "commented";
    case "commentRemove":
      return "deleted a comment";
    case "attach":
      return `attached \`${payload.filename}\` · ${formatBytesShort(payload.sizeBytes)}`;
    case "detach":
      return `removed the attachment \`${payload.filename}\``;
    case "parentChanged": {
      if (payload.from === null && payload.to !== null) {
        return "moved this under a parent task";
      }
      if (payload.from !== null && payload.to === null) {
        return "removed this from its parent task";
      }
      return "changed the parent task";
    }
    case "resourceAdd":
      return `added resource \`${payload.title}\``;
    case "resourceRemove":
      return `removed resource \`${payload.title}\``;
    case "nudgeSent":
      return "sent a nudge";
    case "inviteSent":
      return "invited a new member";
    case "inviteAccepted":
      return "accepted the workspace invite";
    case "archived":
      return "archived this task";
    case "restored":
      return "restored this task";
    default: {
      const _exhaustive: never = payload;
      void _exhaustive;
      return "did something";
    }
  }
}

/** Inline byte formatter, kept local to avoid pulling the
 *  attachments-section helper across the client boundary. Matches
 *  its rounding so the conversation copy reads consistently. */
function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${(Math.round(kb * 10) / 10).toString()} KB`;
  const mb = kb / 1024;
  return `${(Math.round(mb * 10) / 10).toString()} MB`;
}

function Composer({
  me,
  taskId,
  people,
  disabled,
  isPending,
  onSubmit,
}: {
  me: import("@/lib/data").UserId;
  taskId: string;
  people: MentionPerson[];
  disabled: boolean;
  isPending: boolean;
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoresize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, []);

  useEffect(() => {
    autoresize();
  }, [draft, autoresize]);

  function submit() {
    if (disabled || isPending) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft("");
    requestAnimationFrame(() => {
      ref.current?.focus();
    });
  }

  // The Draft button writes streaming tokens directly into the
  // composer state, which means the user sees the reply forming in
  // place, no modal, no review step. They can edit before posting.
  const handleDraft = useCallback((cumulative: string) => {
    setDraft(cumulative);
    requestAnimationFrame(() => {
      ref.current?.focus();
      // Move caret to end so subsequent typing appends.
      const len = cumulative.length;
      ref.current?.setSelectionRange(len, len);
    });
  }, []);

  return (
    <div
      className="sticky bottom-0 -mx-6 mt-4 flex items-start gap-2.5 border-t border-line-soft bg-bg-elevated/95 px-6 pb-2 pt-3 backdrop-blur"
      data-comment-composer
    >
      <Avatar user={me} size={22} />
      <MentionField
        ref={ref}
        value={draft}
        onChange={setDraft}
        people={people}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Reply or comment, @ to mention"
        disabled={disabled || isPending}
        className="block min-h-[22px] w-full resize-none bg-transparent text-[13px] leading-[var(--x-lead-read)] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center gap-1.5">
        <DraftReplyButton
          taskId={taskId}
          onDraft={handleDraft}
          disabled={disabled || isPending}
        />
        <KbdHint
          state={isPending ? "pending" : draft.trim() ? "ready" : "empty"}
        />
      </div>
    </div>
  );
}

function KbdHint({ state }: { state: "empty" | "ready" | "pending" }) {
  const reduce = useReducedMotion();
  if (state === "pending") {
    return (
      <motion.span
        animate={reduce ? { opacity: 0.65 } : { rotate: 360 }}
        transition={reduce ? { duration: 0 } : { duration: 0.9, ease: "linear", repeat: Infinity }}
        className="mt-0.5 inline-block h-[10px] w-[10px] rounded-full border-2 border-brand/30 border-t-brand"
        aria-label="Posting"
      />
    );
  }
  return (
    <kbd
      className={
        "inline-flex h-[18px] select-none items-center rounded border border-line-soft bg-white px-1 text-[11px] tabular-nums transition-opacity " +
        (state === "ready"
          ? "text-ink-quiet opacity-100"
          : "text-ink-faint opacity-50")
      }
    >
      ⏎
    </kbd>
  );
}
