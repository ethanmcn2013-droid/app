"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { formatRelativeTime } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

export function PanelHeader({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  return (
    <header className="px-6 pb-3 pt-5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-quiet">
        <div className="flex items-center gap-1.5">
          <TaskIdChip id={task.id} seq={task.seq} />
          <EditedStamp updatedAt={task.updatedAt} />
          {task.sourceNoteId ? <FromNotesChip /> : null}
        </div>
        <button
          type="button"
          aria-label="Close task panel"
          onClick={onClose}
          className="-m-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      </div>
      <TitleEditor key={task.id} task={task} />
    </header>
  );
}

// Named exports for TaskDetail header composition (premium-p1).
// Behaviour is unchanged; adding `export` makes each chip importable directly.

export function EditedStamp({ updatedAt }: { updatedAt: Date }) {
  // Defer rendering until after hydration: relative time + locale-
  // formatted tooltip both differ between server and client (server
  // clock != client clock; locale defaults can differ). Render
  // nothing on the server, hydrate to actual content on the client.
  const hydrated = useHydrated();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const revealAt = updatedAt.getTime() + 5000;
    const revealTimer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, revealAt - Date.now()),
    );
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearInterval(clock);
    };
  }, [updatedAt]);

  if (!hydrated || now === null) return null;

  // Hide if mutation just landed, avoids flashing "edited just now"
  // on every render right after the user's own edit.
  const ageMs = now - updatedAt.getTime();
  if (ageMs < 5000) return null;

  return (
    <>
      <span className="text-ink-faint">·</span>
      <span
        className="select-none text-[10.5px] tabular-nums text-ink-quiet"
        title={updatedAt.toLocaleString("en-US")}
      >
        edited {formatRelativeTime(updatedAt)}
      </span>
    </>
  );
}

/**
 * Quiet provenance chip, surfaces when a task arrived via the Notes →
 * Tasks extract endpoint (`task.sourceNoteId` is set). Matches the
 * TaskIdChip register: mono, 10.5px, ink-quiet, bg-sunken on hover.
 *
 * Non-interactive for now, the sourceNoteId is the `{userId}:{noteId}`
 * idempotency tuple, not a public URL. When Notes ships a deep-link
 * surface for individual notes, swap the span for an anchor.
 */
export function FromNotesChip() {
  return (
    <>
      <span className="text-ink-faint">·</span>
      <span
        className="select-none rounded px-1 py-0.5 text-[10.5px] tracking-tight text-ink-quiet"
        title="Created from a Signal Notes extract"
      >
        <span aria-hidden="true">↩</span> From Notes
      </span>
    </>
  );
}

export function TaskIdChip({ id, seq }: { id: string; seq?: number | null }) {
  const [copied, setCopied] = useState(false);
  // The human number ("T-14") when the row has one — a per-workspace
  // counter allocated at insert (drizzle/0021). The hex id remains the
  // stable reference and the fallback display for unnumbered rows.
  const display =
    typeof seq === "number" && seq > 0
      ? `T-${seq}`
      : id.replace(/^t-/, "T-").toUpperCase();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard.writeText(display);
          setCopied(true);
          setTimeout(() => setCopied(false), 1100);
        }
      }}
      className="select-none rounded px-1 py-0.5 font-mono tabular-nums text-[10.5px] tracking-tight text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
      aria-label={`Copy task id ${display}`}
    >
      {copied ? "copied" : display}
    </button>
  );
}

function TitleEditor({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const [draft, setDraft] = useState(task.title);
  const [previousTitle, setPreviousTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external title changes (e.g. another client edits it; today
  // there's only one client but the pattern holds).
  if (previousTitle !== task.title) {
    setPreviousTitle(task.title);
    setDraft(task.title);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setDraft(task.title);
      return;
    }
    if (trimmed !== task.title) {
      updateTask(task.id, { title: trimmed });
    }
  }

  return (
    <input
      ref={inputRef}
      id="task-panel-title"
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(task.title);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className="mt-3 w-full bg-transparent text-[22px] font-semibold leading-[1.16] tracking-[-0.025em] text-ink outline-none placeholder:text-ink-quiet"
      placeholder="Untitled task"
    />
  );
}
