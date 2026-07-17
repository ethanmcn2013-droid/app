"use client";

// Editorial Project Room brief — the Option B port (selected 2026-07-17).
//
// The workspace is a purposeful room, not a neutral container: purpose,
// date window, ownership, progress receipts, and the next milestones stay
// visible above the execution surface on every view. Live numbers come
// from the tasks store; workspace facts arrive as server props from
// getRoomBriefData(). Purpose is operator-editable inline and persists
// via the meta KV (no schema change).

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDomain } from "@/lib/domain-context";
import { useTasks } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
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

function milestoneDateLabel(task: Task): string {
  if (!task.dueAt) return "No date";
  return task.dueAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function RoomBrief() {
  const data = useRoomBrief();
  const { state } = useTasks();
  const pack = useDomain();
  const { openTask } = useTaskPanel();

  if (!data) return null;

  const now = Date.now();
  const tasks = state.tasks;
  const total = tasks.length;
  const complete = tasks.filter((t) => t.lane === "done").length;
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;
  const undated = tasks.filter((t) => !t.dueAt && t.lane !== "done").length;
  const progress = total === 0 ? 0 : Math.round((complete / total) * 100);

  const milestones = tasks
    .filter((t) => t.isMilestone && t.lane !== "done")
    .sort((a, b) => {
      const ad = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bd = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ad - bd;
    })
    .slice(0, 3);

  return (
    <section
      aria-label="Workspace brief"
      className="grid grid-cols-1 gap-5 rounded-xl border border-line-soft bg-white px-5 py-4 lg:grid-cols-[minmax(280px,1fr)_180px_230px]"
    >
      {/* Identity */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          <span>{data.periodName ? "Planning period" : "Workspace"}</span>
          {data.periodName ? (
            <>
              <span aria-hidden="true">›</span>
              <strong className="font-semibold text-ink-soft normal-case tracking-normal text-[11px]">
                {data.periodName}
              </strong>
            </>
          ) : null}
        </div>
        <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-ink md:text-[26px]">
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

      {/* Milestones */}
      <div className="hidden min-w-0 flex-col justify-center border-line-soft lg:flex lg:border-l lg:pl-5">
        <span className="text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Milestones
        </span>
        {milestones.length > 0 ? (
          <ol className="mt-2 flex flex-col">
            {milestones.map((task) => (
              <li
                key={task.id}
                className="grid min-w-0 grid-cols-[44px_1fr] items-center gap-2 border-b border-line-soft py-1.5 last:border-0"
              >
                <time className="font-mono text-[9.5px] text-ink-quiet">
                  {milestoneDateLabel(task)}
                </time>
                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="truncate text-left text-[11.5px] font-medium text-ink transition-colors hover:text-brand"
                >
                  {task.title}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-quiet">
            No open milestones. Mark a task as a milestone in its panel and it
            anchors here.
          </p>
        )}
        <small className="mt-1.5 text-[9.5px] text-ink-quiet">
          Purpose, progress, and commitments stay in view.
        </small>
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
