"use client";

/**
 * TaskDetail — production task detail composition.
 *
 * Shared across two shells:
 *   panel  — resizable side panel (board visible beside it)
 *   focus  — full-page route /app/task/[id] (centred max-w 860px)
 *
 * Visual grammar came verbatim from the Phase 3 Hybrid C lab at
 * /lab/task-detail, which this composition superseded and which was
 * removed once it shipped. Real data replaced the lab fixtures;
 * production subcomponents replaced the lab stubs.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useDomain, useColumnConfig } from "@/lib/domain-context";
import { isTaskDone } from "@/lib/board-columns";
import { getTaskConversationAction } from "@/server/actions/conversation";
import type { ConversationItem } from "@/server/db/queries";

import { TaskIdChip, EditedStamp } from "@/components/app/detail-panel/panel-header";
import { DescriptionEditor } from "@/components/app/detail-panel/description-editor";
import { SubtasksSection } from "@/components/app/detail-panel/subtasks-section";
import { ResourcesSection } from "@/components/app/detail-panel/resources-section";
import { ConversationFeed } from "@/components/app/detail-panel/conversation-feed";
import { ActionsDropdown } from "@/components/primitives/context-actions";
import { hasOpenLayer } from "@/components/primitives/open-layer";
import { MetadataRail } from "./metadata-rail";
import { buildTaskDetailActions } from "./task-detail-actions";
import { TipCard } from "@/components/app/tip-card";

// ─── Props ────────────────────────────────────────────────────────────────────

export type TaskDetailShell = "panel" | "focus";

export type TaskDetailProps = {
  task: Task;
  shell: TaskDetailShell;
  onClose: () => void;
  onFocusToggle: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
};

// ─── Conversation logic (moved from task-detail-panel.tsx) ───────────────────

function useConversation(task: Task) {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const refreshKey = task.updatedAt?.getTime();

  const fetchConversation = useCallback(
    (taskId: string, signal: { ignored: boolean }) => {
      setLoading(true);
      setTimedOut(false);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      );

      Promise.race([getTaskConversationAction(taskId), timeout])
        .then((rows) => {
          if (!signal.ignored) setItems(rows);
        })
        .catch((err) => {
          if (!signal.ignored) {
            const isTimeout = err instanceof Error && err.message === "timeout";
            console.warn("conversation: fetch failed", err);
            setItems([]);
            if (isTimeout) setTimedOut(true);
          }
        })
        .finally(() => {
          if (!signal.ignored) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    const signal = { ignored: false };
    const timer = window.setTimeout(
      () => fetchConversation(task.id, signal),
      0,
    );
    return () => {
      signal.ignored = true;
      window.clearTimeout(timer);
    };
  }, [task.id, refreshKey, fetchConversation]);

  return { items, loading, timedOut, retry: () => {
    const signal = { ignored: false };
    fetchConversation(task.id, signal);
  }};
}

// ─── Auto-growing textarea for title ─────────────────────────────────────────

function TitleTextarea({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const [draft, setDraft] = useState(task.title);
  const [prevTitle, setPrevTitle] = useState(task.title);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external title changes
  if (prevTitle !== task.title) {
    setPrevTitle(task.title);
    setDraft(task.title);
  }

  // Auto-height
  const autoresize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoresize();
  }, [draft, autoresize]);

  // The title steps up a size at `md` (below, unchanged). A live window
  // resize across that line — or across the width where the window's own
  // max-width caps in — changes the wrap width the last measurement was
  // taken at, so re-measure or the box is left sized for stale text.
  useEffect(() => {
    window.addEventListener("resize", autoresize);
    return () => window.removeEventListener("resize", autoresize);
  }, [autoresize]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(task.title);
      return;
    }
    if (trimmed !== task.title) {
      updateTask(task.id, { title: trimmed });
    }
  }

  return (
    <textarea
      ref={textareaRef}
      id="task-panel-title"
      rows={1}
      value={draft}
      onChange={(e) => { setDraft(e.target.value); autoresize(); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setDraft(task.title);
          e.currentTarget.blur();
        }
      }}
      className="block w-full resize-none overflow-hidden bg-transparent text-[20px] font-semibold leading-[var(--x-lead-tight)] tracking-[-0.02em] text-ink outline-none placeholder:text-ink-quiet md:text-[24px]"
      placeholder="Untitled task"
      aria-label="Task title"
    />
  );
}

// ─── ConversationSkeleton ─────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="space-y-3">
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

/**
 * Conversation timeout.
 *
 * Was two stacked grey sentences and an underlined text link, which read as
 * broken page furniture rather than a state with a way out. One line of
 * plain cause, one real button.
 */
function ConversationTimeout({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line-soft bg-bg-sunken/40 px-3 py-2.5">
      <span className="text-[13px] text-ink-soft">
        The conversation took too long to load.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center rounded-full border border-line-soft bg-white px-2.5 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-ghost hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Try again
      </button>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function TaskDetailHeader({
  task,
  shell,
  onClose,
  onFocusToggle,
  onNavigate,
}: {
  task: Task;
  shell: TaskDetailShell;
  onClose: () => void;
  onFocusToggle: () => void;
  onNavigate?: (d: "prev" | "next") => void;
}) {
  const dispatchers = useTasksDispatch();
  const { boardName } = useDomain();
  const columnConfig = useColumnConfig();
  const projectLabel = boardName ?? "Project";
  const isFocus = shell === "focus";
  const done = isTaskDone(task, columnConfig);
  const [completionReceipt, setCompletionReceipt] = useState<{ taskId: string; message: string } | null>(null);
  const completionMessage = completionReceipt?.taskId === task.id ? completionReceipt.message : null;

  const actions = buildTaskDetailActions(task, {
    dispatchers,
    isFocus,
    onOpenFocus: onFocusToggle,
    onClosePanel: onClose,
    columnConfig,
  });

  const primaryLabel = done ? "Reopen" : "Mark done";

  return (
    <div className="flex-shrink-0 border-b border-line-soft bg-bg-elevated px-6 pb-3 pt-3 lg:px-8">
      {/* Thin line: breadcrumb + window controls. This row was never the
          problem the redesign below exists to fix — it stays as it was. */}
      <div className="flex items-center justify-between gap-2">
        {/* Breadcrumb */}
        {/* One line, truncating from the project name — the id chip and
            stamp never wrap into a second row. Provenance ("From Notes")
            is a Source field in the metadata rail, not header furniture. */}
        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-quiet">
          <span className="min-w-0 truncate">{projectLabel}</span>
          <span className="text-ink-faint" aria-hidden>/</span>
          <TaskIdChip id={task.id} seq={task.seq} />
          <EditedStamp updatedAt={task.updatedAt} />
        </div>

        {/* Right controls */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* j/k navigation */}
          {onNavigate ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate("prev")}
                aria-label="Previous task (k)"
                title="Previous (k)"
                className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent lg:h-7 lg:w-7"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onNavigate("next")}
                aria-label="Next task (j)"
                title="Next (j)"
                className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent lg:h-7 lg:w-7"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </>
          ) : null}

          {/* Expand/collapse toggle (e) */}
          <button
            type="button"
            onClick={onFocusToggle}
            aria-label={isFocus ? "Return to board (e)" : "Expand to focus mode (e)"}
            title={isFocus ? "Return to board (e)" : "Expand to focus mode (e)"}
            className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent lg:h-7 lg:w-7"
          >
            {isFocus ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="10" y1="14" x2="3" y2="21" />
                <line x1="21" y1="3" x2="14" y2="10" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
          </button>

          {/* ••• ActionsDropdown */}
          <ActionsDropdown
            items={actions}
            triggerLabel="More actions"
            triggerClassName="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent lg:h-7 lg:w-7"
            trigger={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            }
          />

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent lg:h-7 lg:w-7"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
      </div>

      {/*
        Main band. Two review rounds named the same defect: the title sat
        alone on its own row at the size it was in the 520px drawer this
        window replaced, the property strip stacked under it, and Mark
        done stacked under that — three left-aligned rows, each costing
        height, each leaving several hundred pixels empty on its right.
        One band now: the title sets the size of the row instead of
        hiding inside one, and the strip plus the primary action dock to
        its right on the same line, so the task's name is the first thing
        the eye meets instead of an indigo pill two rows below it. Stacks
        below `md`, where the window is a full-bleed sheet too narrow to
        hold both sides of the band without crowding.
      */}
      <div className="mt-2 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:gap-y-1.5">
        <div className="min-w-0 md:flex-1">
          <TitleTextarea task={task} />
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          {shell === "panel" ? (
            /* The primary property strip: what a person checks first,
               beside the title instead of on a row of its own. Status
               lives here rather than as a coloured pill beside the
               title, which used to drag the title sideways and give the
               header two competing focal points. */
            <MetadataRail task={task} variant="strip" />
          ) : null}
          {/* The panel's one primary action carries the suite's primary
              treatment — indigo and a pill, per the design system. */}
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              aria-describedby={completionMessage ? `task-completion-${task.id}` : undefined}
              onClick={() => {
                dispatchers.toggleComplete(task.id);
                setCompletionReceipt({ taskId: task.id, message: done ? "Reopened in In progress." : "Moved to Done." });
              }}
              className="inline-flex min-h-[44px] flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0 md:py-1.5"
            >
              {!done ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
              {primaryLabel}
            </button>
            {completionMessage ? (
              <span className="text-[11px] font-medium text-ink-soft" id={`task-completion-${task.id}`} role="status">
                {completionMessage}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Primary content column ───────────────────────────────────────────────────

function PrimaryContent({
  task,
  conversation,
  showTip,
}: {
  task: Task;
  conversation: ReturnType<typeof useConversation>;
  showTip: boolean;
}) {
  const { items, loading, timedOut, retry } = conversation;
  return (
    <div className="min-w-0">
      {/* Description */}
      <section aria-label="Description" className="border-b border-line-soft py-5">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
          Description
        </div>
        <DescriptionEditor key={task.id} task={task} />
      </section>

      {/* Subtasks */}
      <SubtasksSection key={`subtasks-${task.id}`} task={task} />

      {/* Resources */}
      <ResourcesSection key={`resources-${task.id}`} task={task} />

      {/* Conversation */}
      <section aria-label="Conversation" className="py-5">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
          Conversation
        </div>
        {loading ? (
          <ConversationSkeleton />
        ) : timedOut ? (
          <ConversationTimeout onRetry={retry} />
        ) : (
          <ConversationFeed
            key={task.id}
            taskId={task.id}
            initialItems={items}
            assigneeIds={task.assignees}
          />
        )}
      </section>

      {/*
        The hint used to sit in its own grid row below the metadata rail —
        a dedicated band the window had to keep tall enough for even when
        the hint had nothing to say, which cost 219px of blank space at
        1920 and was why the window scrolled at 1280 when nothing else on
        the page needed it to. It is the least important thing here, so it
        now closes the column that actually grows — the work — instead of
        owning a row the layout has to keep solvent.
      */}
      {showTip ? (
        <div className="mt-6 hidden md:block">
          <TipCard context="task-panel" />
        </div>
      ) : null}
    </div>
  );
}

// ─── TaskDetail — main export ─────────────────────────────────────────────────

export function TaskDetail({
  task,
  shell,
  onClose,
  onFocusToggle,
  onNavigate,
}: TaskDetailProps) {
  const isFocus = shell === "focus";
  const conversation = useConversation(task);

  // Keyboard: j/k navigate, e focus toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable]")) return;
      if (e.key === "j") { e.preventDefault(); onNavigate?.("next"); }
      if (e.key === "k") { e.preventDefault(); onNavigate?.("prev"); }
      if (e.key === "e") { e.preventDefault(); onFocusToggle(); }
      // Escape in focus shell closes (panel shell's PanelShell owns Escape).
      // A layered surface (menu, popover) owns Escape while open.
      if (e.key === "Escape" && isFocus && !hasOpenLayer()) {
        e.preventDefault();
        onClose();
      }
    }
    // Capture phase: Radix dismisses menus with a synchronously-flushed
    // discrete event, so a bubble listener would see the layer already gone
    // and close the shell in the same keypress.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onNavigate, onFocusToggle, onClose, isFocus]);

  return (
    <div
      className="flex h-full flex-col bg-bg-elevated overflow-hidden"
      role={isFocus ? "main" : undefined}
      aria-label={`Task detail: ${task.title}`}
    >
      <TaskDetailHeader
        task={task}
        shell={shell}
        onClose={onClose}
        onFocusToggle={onFocusToggle}
        onNavigate={onNavigate}
      />

      {/*
        One workspace, two framings. The task used to get a two-column
        layout on the full page and a single stacked column in the panel,
        because the panel was a 520px drawer where a rail could not fit.
        The panel is a 1120px centred window now, so both framings run the
        same architecture: the work people actually do — description,
        subtasks, conversation, attachments — reads down the main column,
        and the properties that merely describe the task sit in a rail
        beside it instead of forming a wall of labels above it. Below lg
        the rail folds back on top, which is the right order on a phone.
      */}
      <div className="thin-scroll flex-1 overflow-y-auto">
        <div
          className={
            isFocus
              ? "mx-auto w-full max-w-[860px] px-6 pb-12 pt-6 lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 lg:px-8"
              : "mx-auto w-full px-6 pb-10 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:px-8"
          }
        >
          <PrimaryContent task={task} conversation={conversation} showTip={!isFocus} />
          <aside className="order-first mb-8 lg:order-none lg:mb-0 lg:border-l lg:border-line-soft lg:pl-7 lg:pt-5">
            <MetadataRail task={task} variant={isFocus ? "full" : "rest"} />
          </aside>
        </div>
      </div>
    </div>
  );
}
