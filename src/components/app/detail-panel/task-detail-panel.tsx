"use client";

import { useCallback, useEffect, useOptimistic, useState, useTransition } from "react";
import { useTasksState, useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { getTaskConversationAction } from "@/server/actions/conversation";
import { setTaskMilestoneAction } from "@/server/actions/tasks";
import type { ConversationItem } from "@/server/db/queries";
import { PanelShell } from "./panel-shell";
import { PanelHeader } from "./panel-header";
import { FieldRows } from "./field-rows";
import { ConversationFeed } from "./conversation-feed";
import { ContactEditor } from "./contact-editor";
import { CentsEditor } from "./cents-editor";
import { DescriptionEditor } from "./description-editor";
import { RepeatButton } from "./repeat-button";
import { TIMELINE_URL } from "@/lib/product-urls";
import { SubtasksSection } from "./subtasks-section";
import { AttachmentsSection } from "./attachments-section";
import type { Task } from "@/lib/data";

export function TaskDetailPanel() {
  const { taskId, closeTask } = useTaskPanel();
  const state = useTasksState();
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;

  // Per-task unified conversation history (comments + activity merged).
  // Re-fetches when taskId OR task.updatedAt changes.
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  // C4: track whether the last fetch timed out so we can offer a retry.
  const [timedOut, setTimedOut] = useState(false);

  const refreshKey = task?.updatedAt?.getTime();

  // C4: stable fetch function so the retry button can re-run the same
  // logic without duplicating the effect body.
  const fetchConversation = useCallback(
    (taskId: string, signal: { ignored: boolean }) => {
      setLoading(true);
      setTimedOut(false);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      );

      Promise.race([getTaskConversationAction(taskId), timeout])
        .then((rows) => {
          if (!signal.ignored) {
            setItems(rows);
          }
        })
        .catch((err) => {
          if (!signal.ignored) {
            const isTimeout =
              err instanceof Error && err.message === "timeout";

            console.warn("conversation: fetch failed", err);
            setItems([]);
            if (isTimeout) setTimedOut(true);
          }
        })
        .finally(() => {
          // Always clear loading for the signal that owns this fetch.
          // Ignored signals belong to aborted fetches, their loading
          // state is already superseded by the next fetch's setLoading(true).
          if (!signal.ignored) {
            setLoading(false);
          }
        });
    },
    [setItems, setLoading, setTimedOut],
  );

  const conversationTaskId = task?.id;

  useEffect(() => {
    if (!conversationTaskId) return;
    const signal = { ignored: false };
    const timer = window.setTimeout(
      () => fetchConversation(conversationTaskId, signal),
      0,
    );
    return () => {
      signal.ignored = true;
      window.clearTimeout(timer);
    };
  }, [conversationTaskId, refreshKey, fetchConversation]);

  // Stale id (e.g. task was deleted), clear the param after a beat
  // so a deep-link to a no-longer-existing task degrades gracefully.
  useEffect(() => {
    if (taskId && !task) {
      const timer = window.setTimeout(closeTask, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [taskId, task, closeTask]);

  return (
    <PanelShell open={!!taskId} onClose={closeTask}>
      {task ? (
        <>
          <PanelHeader task={task} onClose={closeTask} />
          <div className="thin-scroll flex-1 overflow-y-auto">
            <FieldRows task={task} />
            <Section title="Description">
              <DescriptionEditor key={task.id} task={task} />
            </Section>
            <Section title="Contact">
              <ContactEditor key={task.id} task={task} />
            </Section>
            <Section title="Amount">
              <CentsEditor key={task.id} task={task} />
            </Section>
            <SubtasksSection key={`subtasks-${task.id}`} task={task} />
            <AttachmentsSection key={`attachments-${task.id}`} task={task} />
            <Section title="Conversation">
              {loading ? (
                <ConversationSkeleton />
              ) : timedOut ? (
                // C4: timeout path, show the C3 empty state copy + a
                // "Try again" control so the user isn't stuck on blank.
                <ConversationTimeout
                  onRetry={() => {
                    const signal = { ignored: false };
                    fetchConversation(task.id, signal);
                  }}
                />
              ) : (
                <ConversationFeed
                  key={task.id}
                  taskId={task.id}
                  initialItems={items}
                />
              )}
            </Section>
          </div>
          <PanelFooter task={task} />
        </>
      ) : taskId ? (
        <EmptyState />
      ) : null}
    </PanelShell>
  );
}

function ConversationSkeleton() {
  // Mix one comment-shaped row with one activity-shaped row so the
  // skeleton hints at the unified feed shape.
  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-start gap-2.5 px-1 py-1">
        <div className="h-[22px] w-[22px] flex-shrink-0 rounded-full bg-bg-sunken" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/3 rounded-full bg-bg-sunken" />
          <div className="h-3 w-3/4 rounded-full bg-bg-sunken" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-1">
        <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full bg-bg-sunken" />
        <div className="h-2.5 w-2/5 rounded-full bg-bg-sunken" />
      </div>
      <div className="flex items-start gap-2.5 px-1 py-1">
        <div className="h-[22px] w-[22px] flex-shrink-0 rounded-full bg-bg-sunken" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/4 rounded-full bg-bg-sunken" />
          <div className="h-3 w-2/3 rounded-full bg-bg-sunken" />
        </div>
      </div>
    </div>
  );
}


// C4: shown when the conversation fetch exceeds the 5s timeout guard.
// Uses the same voice as the C3 empty state + a "Try again" control.
function ConversationTimeout({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-1">
      <div className="text-[13px] text-ink-quiet">Couldn&apos;t load conversation.</div>
      <div className="mt-1 text-[12px] text-ink-faint">
        Took too long to load.{" "}
        <button
          type="button"
          onClick={onRetry}
          className="underline decoration-ink-faint underline-offset-2 hover:text-ink-soft hover:decoration-ink-soft transition-colors"
        >
          Try again
        </button>
        .
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line-soft px-6 py-5">
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Bottom row of the panel. Quiet by design, sibling buttons only.
 * "Repeat" opens the chain-duplicate popover; "Focus" dispatches
 * `focus-mode:open` so the global FocusMode overlay picks it up;
 * "Milestone" (RW-3b) toggles the `is_milestone` DB flag.
 * Sits below Contact + Cents so it never collides with those sections.
 */
function PanelFooter({ task }: { task: Task }) {
  return (
    <div className="flex flex-col gap-0 border-t border-line-soft">
      {/* "See it in your plan →" CTA, UX_SPEC §RW-3b friction point 3.
          Shown only when isMilestone=true so it guides Niamh from Tasks to
          Roadmap at the moment she needs it. Cross-product nav, quiet text
          link, never a prominent button. */}
      {task.isMilestone ? (
        <div className="flex justify-end px-6 pt-2">
          <a
            href={`${TIMELINE_URL}/app`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-ink-quiet transition-colors hover:text-ink-soft"
          >
            See it in your plan
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-1 px-6 py-3">
        <div className="flex items-center gap-1">
          <DeleteTaskButton task={task} />
          <ArchiveTaskButton task={task} />
        </div>
        <div className="flex items-center gap-1">
        <RepeatButton task={task} />
        <MilestoneButton task={task} />
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("focus-mode:open", {
                detail: { id: task.id, title: task.title },
              }),
            );
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
          aria-label="Open focus mode for this task"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Focus
        </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Archive this task from the panel. Reversible (restore from /app/archived),
 * so a single click — no confirm — then closes the panel.
 */
function ArchiveTaskButton({ task }: { task: Task }) {
  const { archiveTask } = useTasksDispatch();
  const { closeTask } = useTaskPanel();
  return (
    <button
      type="button"
      onClick={() => {
        archiveTask(task.id);
        closeTask();
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
      aria-label="Archive this task"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
        <path d="M10 12h4" />
      </svg>
      Archive
    </button>
  );
}

/**
 * Delete this task, from the panel. A discoverable, unambiguous delete for
 * the open task (the board card menu also carries one). Two-step inline
 * confirm — no accidental deletes, no modal — then closes the panel.
 */
function DeleteTaskButton({ task }: { task: Task }) {
  const { removeTask } = useTasksDispatch();
  const { closeTask } = useTaskPanel();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            removeTask(task.id);
            closeTask();
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11.5px] font-medium text-white transition-colors hover:bg-red-700"
        >
          Delete task
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-red-50 hover:text-red-600"
      aria-label="Delete this task"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      Delete
    </button>
  );
}

/**
 * RW-3b, "Milestone" toggle button in the PanelFooter.
 *
 * Visual treatment (UX_SPEC §RW-3b):
 *   - Unset: diamond outline SVG (◇) + label "Milestone", ink-quiet color.
 *   - Set: filled diamond SVG (◆) + same label, brand color with soft
 *     background tint.
 * aria-pressed signals state to assistive technology.
 * No confirm dialog, it's a toggle, reversible in one click.
 *
 * D6 contract: toggling to true fills the Roadmap's private draft only.
 * Nothing here auto-publishes.
 */
function MilestoneButton({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(!!task.isMilestone);

  function handleClick() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      await setTaskMilestoneAction(task.id, next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove milestone" : "Mark as milestone"}
      title={optimistic ? "Remove milestone" : "This task will appear on your plan"}
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors",
        optimistic
          ? "bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-[var(--brand)]"
          : "text-ink-quiet hover:bg-bg-sunken hover:text-ink-soft",
      ].join(" ")}
    >
      {/* Diamond SVG, outline when unset, filled when set */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill={optimistic ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2 L22 12 L12 22 L2 12 Z" />
      </svg>
      Milestone
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="text-[14.5px] font-medium text-ink">
        Task not found
      </div>
      <div className="max-w-[28ch] text-[12.5px] text-ink-soft">
        It may have been deleted or this link is stale. Closing in a moment.
      </div>
    </div>
  );
}
