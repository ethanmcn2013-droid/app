"use client";

import { motion } from "motion/react";
import { LANES, PRIORITY_LABEL, USERS, type Task } from "@/lib/data";
import { AvatarStack } from "./avatar";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  hidden,
  picked,
  pickedBy,
  highlightDependency,
  flash,
  showComments,
  showInlineThread,
  typingUser,
  typingProgress,
  postedComment,
  forwardRef,
  onClick,
  variant = "board",
}: {
  task: Task;
  hidden?: boolean;
  picked?: boolean;
  pickedBy?: string | null;
  highlightDependency?: boolean;
  flash?: boolean;
  showComments?: boolean;
  showInlineThread?: boolean;
  typingUser?: string | null;
  typingProgress?: number;
  postedComment?: { user: string; text: string } | null;
  forwardRef?: (el: HTMLDivElement | null) => void;
  onClick?: () => void;
  variant?: "board" | "list";
}) {
  const lane = LANES[task.lane];
  const prio = PRIORITY_LABEL[task.priority];
  const isUrgent = task.priority === "p0";

  return (
    <motion.div
      layoutId={`task-${task.id}`}
      ref={forwardRef}
      onClick={onClick}
      data-task-id={task.id}
      className={cn(
        "relative cursor-grab select-none rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-snug text-ink shadow-[0_1px_2px_rgba(20,21,26,0.05),0_0_0_1px_rgba(20,21,26,0.04)] transition-shadow",
        variant === "list" && "rounded-md py-2",
        hidden && "pointer-events-none opacity-30",
        flash && "ring-2 ring-emerald-400",
      )}
      style={{
        borderColor: highlightDependency
          ? "var(--brand)"
          : pickedBy
            ? pickedBy
            : "transparent",
        boxShadow: pickedBy
          ? `0 0 0 1.5px ${pickedBy}, 0 1px 2px rgba(20,21,26,0.05)`
          : undefined,
        opacity: picked ? 0.0 : hidden ? 0.3 : 1,
      }}
      transition={{
        layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 pr-1">{task.title}</span>
        {isUrgent ? (
          <span
            className="flex-shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-600"
            aria-label="Priority p0"
          >
            P0
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-md bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft"
            title={prio.label}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: prio.color }}
            />
            {task.priority.toUpperCase()}
          </span>
          {task.due ? (
            <span className="text-[10.5px] text-ink-quiet">{task.due}</span>
          ) : null}
          {task.estimate ? (
            <span className="text-[10.5px] text-ink-quiet">·</span>
          ) : null}
          {task.estimate ? (
            <span className="text-[10.5px] text-ink-quiet">
              {task.estimate}h
            </span>
          ) : null}
        </div>
        <AvatarStack users={task.assignees} size={18} />
      </div>

      {(task.idleDays || task.comments) && (
        <div className="mt-2 flex items-center gap-2">
          {task.idleDays ? (
            <span className="inline-flex items-center gap-1 rounded border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" />
              </svg>
              Idle {task.idleDays}d
            </span>
          ) : null}
          {task.comments ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-quiet">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {task.comments}
            </span>
          ) : null}
        </div>
      )}

      {/* Inline comment thread expansion */}
      {showInlineThread ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 space-y-2 overflow-hidden border-t border-line-soft pt-2.5"
        >
          <div className="flex items-start gap-2">
            <div
              className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-white"
              style={{ background: USERS.alex.color }}
            >
              {USERS.alex.initials}
            </div>
            <div className="text-[11.5px] leading-relaxed text-ink-soft">
              <span className="font-medium text-ink">Alex</span> · 2h ago
              <p>Looks good. Moving this forward today.</p>
            </div>
          </div>

          {postedComment ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              <div
                className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-white"
                style={{ background: USERS[postedComment.user as keyof typeof USERS].color }}
              >
                {USERS[postedComment.user as keyof typeof USERS].initials}
              </div>
              <div className="text-[11.5px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">
                  {USERS[postedComment.user as keyof typeof USERS].name}
                </span>
                · just now
                <p>{postedComment.text}</p>
              </div>
            </motion.div>
          ) : null}

          {typingUser ? (
            <div className="flex items-start gap-2">
              <div
                className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-white"
                style={{ background: USERS[typingUser as keyof typeof USERS].color }}
              >
                {USERS[typingUser as keyof typeof USERS].initials}
              </div>
              <div className="flex-1 text-[11.5px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">
                  {USERS[typingUser as keyof typeof USERS].name}
                </span>
                <span className="ml-1 text-ink-quiet">is typing…</span>
                <div className="mt-1 inline-flex gap-1">
                  <span className="block h-1 w-1 animate-pulse rounded-full bg-ink-quiet [animation-delay:0ms]" />
                  <span className="block h-1 w-1 animate-pulse rounded-full bg-ink-quiet [animation-delay:160ms]" />
                  <span className="block h-1 w-1 animate-pulse rounded-full bg-ink-quiet [animation-delay:320ms]" />
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : null}

      {pickedBy ? (
        <span
          className="absolute -right-1 -top-1.5 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-white shadow-md"
          style={{ background: pickedBy }}
        >
          editing
        </span>
      ) : null}
    </motion.div>
  );
}
