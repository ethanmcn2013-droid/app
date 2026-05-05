"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CURRENT_USER, USERS, type Comment } from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";
import { useTaskComments } from "@/lib/tasks/use-task-comments";
import { formatRelativeTime } from "@/lib/utils";

export function CommentThread({
  taskId,
  initialComments,
}: {
  taskId: string;
  initialComments: Comment[];
}) {
  const { comments, addComment, removeComment, isPending } =
    useTaskComments(taskId, initialComments);

  return (
    <div className="space-y-4 pb-6">
      {comments.length === 0 ? (
        <EmptyState />
      ) : (
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onRemove={() => removeComment(c.id)}
            />
          ))}
        </AnimatePresence>
      )}

      <Composer
        disabled={!taskId}
        isPending={isPending}
        onSubmit={addComment}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-1">
      <div className="text-[13px] text-ink-quiet">No comments yet.</div>
      <div className="text-[12px] text-ink-faint">
        Start the thread below.
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  onRemove,
}: {
  comment: Comment;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const u = USERS[comment.userId];
  const isOwn = comment.userId === CURRENT_USER;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={
        reduce
          ? { duration: 0.12 }
          : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
      }
      className="group/comment relative flex items-start gap-2.5"
    >
      <Avatar user={comment.userId} size={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12.5px] font-medium text-ink">{u.name}</span>
          <span
            className="text-[11px] tabular-nums text-ink-quiet"
            title={comment.createdAt.toLocaleString()}
          >
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[1.55] text-ink-soft">
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

function Composer({
  disabled,
  isPending,
  onSubmit,
}: {
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
    // Cap at ~8 lines (line-height 1.55 * 13px ≈ 20.15px → 8 lines ~= 161px)
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

  return (
    <div
      className="sticky bottom-0 -mx-6 mt-4 flex items-start gap-2.5 border-t border-line-soft bg-bg-elevated/95 px-6 pb-2 pt-3 backdrop-blur"
      data-comment-composer
    >
      <Avatar user={CURRENT_USER} size={22} />
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
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
        placeholder="Write a comment"
        disabled={disabled || isPending}
        className="block min-h-[22px] flex-1 resize-none bg-transparent text-[13px] leading-[1.55] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
      />
      <KbdHint
        state={isPending ? "pending" : draft.trim() ? "ready" : "empty"}
      />
    </div>
  );
}

function KbdHint({
  state,
}: {
  state: "empty" | "ready" | "pending";
}) {
  if (state === "pending") {
    return (
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
        className="mt-0.5 inline-block h-[10px] w-[10px] rounded-full border-2 border-brand/30 border-t-brand"
        aria-label="Posting"
      />
    );
  }
  return (
    <kbd
      className={
        "inline-flex h-[18px] select-none items-center rounded border border-line-soft bg-white px-1 text-[10px] tabular-nums transition-opacity " +
        (state === "ready"
          ? "text-ink-quiet opacity-100"
          : "text-ink-faint opacity-50")
      }
    >
      ⏎
    </kbd>
  );
}
