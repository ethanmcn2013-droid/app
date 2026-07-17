"use client";

// Editorial Project Room brief — the Option B port (selected 2026-07-17).
//
// The workspace is a purposeful room, not a neutral container: purpose,
// date window, ownership, and progress receipts stay visible above the
// execution surface on every view. Live numbers come from the tasks
// store; workspace facts arrive as server props from getRoomBriefData().
// Purpose is operator-editable inline and persists via the meta KV (no
// schema change). Scope breadcrumb + milestones panel retired 2026-07-17
// (T·94): scope reads in the Studio Bar capsule.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDomain } from "@/lib/domain-context";
import { useTasks } from "@/lib/tasks/tasks-context";
import { useRoomBrief } from "@/components/app/room/room-brief-context";
import { setWorkspacePurposeAction } from "@/server/actions/room";
import type { Task } from "@/lib/data";

/** Pull the part of the workspace title before " · " for the H1. */
function shortenTitle(t: string): string {
  const idx = t.indexOf(" · ");
  return idx > 0 ? t.slice(0, idx) : t;
}

function isOverdue(task: Task, now: number): boolean {
  return Boolean(task.dueAt && task.dueAt.getTime() < now && task.lane !== "done");
}

export function RoomBrief() {
  const data = useRoomBrief();
  const { state } = useTasks();
  const pack = useDomain();

  // Mount-stable clock: the React Compiler forbids impure calls in render,
  // and overdue receipts don't need sub-navigation freshness.
  const [now] = useState(() => Date.now());

  if (!data) return null;

  const tasks = state.tasks;
  const total = tasks.length;
  const complete = tasks.filter((t) => t.lane === "done").length;
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;
  const undated = tasks.filter((t) => !t.dueAt && t.lane !== "done").length;
  const progress = total === 0 ? 0 : Math.round((complete / total) * 100);

  /* T·94: breadcrumb + milestones panel removed. Project scope now reads
     in the Studio Bar's capsule; the brief keeps only title, purpose,
     owner/date metadata, and the compact progress summary, so the header
     stays low and the views start sooner. */
  return (
    <section
      aria-label="Workspace brief"
      className="grid grid-cols-1 gap-5 rounded-xl border border-line-soft bg-white px-5 py-3.5 lg:grid-cols-[minmax(280px,1fr)_220px]"
    >
      {/* Identity */}
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink md:text-[24px]">
          <span className="block truncate">{shortenTitle(pack.workspaceTitle)}</span>
        </h1>
        <PurposeLine purpose={data.purpose} />
        <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-ink-quiet">
          {data.dateWindow ? <span>{data.dateWindow}</span> : null}
          {data.ownerName ? (
            <span className="border-l border-line-soft pl-3.5 first:border-0 first:pl-0">
              {data.ownerName}, workspace owner
            </span>
          ) : null}
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col justify-center border-line-soft lg:border-l lg:pl-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Progress
          </span>
          <strong className="font-mono text-[20px] font-medium tracking-tight text-ink">
            {progress}%
          </strong>
        </div>
        <div
          aria-label={`${complete} of ${total} tasks complete`}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, total)}
          aria-valuenow={complete}
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <dl className="mt-3 grid gap-1">
          <div className="flex items-baseline justify-between">
            <dt className="text-[10.5px] text-ink-quiet">Complete</dt>
            <dd className="font-mono text-[11px] text-ink-soft">
              {complete}/{total}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-[10.5px] text-ink-quiet">Overdue</dt>
            <dd
              className={
                "font-mono text-[11px] " +
                (overdue > 0 ? "font-semibold text-rose-700" : "text-ink-soft")
              }
            >
              {overdue}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-[10.5px] text-ink-quiet">No date</dt>
            <dd className="font-mono text-[11px] text-ink-soft">{undated}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/**
 * The purpose sentence — click to edit, Enter or blur saves, Escape
 * cancels. Falls back to invitation copy until one is written.
 */
function PurposeLine({ purpose }: { purpose: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(purpose ?? "");
  const [isPending, startTransition] = useTransition();
  const cancelled = useRef(false);

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (next === (purpose ?? "")) return;
    startTransition(async () => {
      await setWorkspacePurposeAction(next);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={2}
        maxLength={280}
        value={draft}
        disabled={isPending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            cancelled.current = true;
            setDraft(purpose ?? "");
            setEditing(false);
          }
        }}
        aria-label="Workspace purpose"
        className="mt-1.5 w-full max-w-[60ch] resize-none rounded-md border border-line bg-white px-2 py-1 text-[12.5px] leading-relaxed text-ink-soft outline-none focus:border-brand"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(purpose ?? "");
        setEditing(true);
      }}
      title="Edit workspace purpose"
      className={
        "mt-1.5 block max-w-[60ch] rounded text-left text-[12.5px] leading-relaxed transition-colors hover:text-ink " +
        (purpose ? "text-ink-soft" : "text-ink-quiet italic")
      }
    >
      {purpose ??
        "What is this workspace for? Write the one-line purpose everyone plans against."}
    </button>
  );
}
