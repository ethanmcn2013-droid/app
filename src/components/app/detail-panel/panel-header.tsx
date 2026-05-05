"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { formatRelativeTime } from "@/lib/utils";

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
          <TaskIdChip id={task.id} />
          <EditedStamp updatedAt={task.updatedAt} />
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

function EditedStamp({ updatedAt }: { updatedAt: Date }) {
  // Defer rendering until after hydration: relative time + locale-
  // formatted tooltip both differ between server and client (server
  // clock != client clock; locale defaults can differ). Render
  // nothing on the server, hydrate to actual content on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Hide if mutation just landed — avoids flashing "edited just now"
  // on every render right after the user's own edit.
  const ageMs = Date.now() - updatedAt.getTime();
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

function TaskIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  // Format t-101 → T-101 (uppercase, looks like a real ticket id)
  const display = id.replace(/^t-/, "T-").toUpperCase();
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external title changes (e.g. another client edits it; today
  // there's only one client but the pattern holds).
  useEffect(() => {
    setDraft(task.title);
  }, [task.title]);

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
