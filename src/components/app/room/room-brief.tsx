"use client";

// Editorial Project Room brief — the lab band, 1:1 (T·95 lab parity).
//
// The Option B lab's workspaceBrief: a full-bleed surface band with a
// hairline base, 27px workspace title, the operator-editable purpose
// line, the meta row with hairline separators, and the mono progress
// column. Breadcrumb and milestones stayed retired (founder order,
// T·94): scope reads in the Studio Bar capsule. Live numbers come from
// the tasks store; workspace facts from getRoomBriefData(); purpose
// persists via the meta KV.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDomain } from "@/lib/domain-context";
import { useTasks } from "@/lib/tasks/tasks-context";
import { useRoomBrief } from "@/components/app/room/room-brief-context";
import { setWorkspacePurposeAction } from "@/server/actions/room";
import { renameBoardAction } from "@/server/actions/board";
import type { Task } from "@/lib/data";
import styles from "./option-b.module.css";

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

  return (
    <header aria-label="Workspace brief" className={styles.workspaceBrief} data-milestones="off">
      <div className={styles.workspaceIdentity}>
        <WorkspaceTitle title={pack.boardName ?? shortenTitle(pack.workspaceTitle)} />
        <PurposeLine purpose={data.purpose} />
        <div className={styles.workspaceMeta}>
          {data.dateWindow ? <span>{data.dateWindow}</span> : null}
          {data.ownerName ? <span>{data.ownerName}, workspace owner</span> : null}
        </div>
      </div>
      <section aria-label="Workspace progress" className={styles.workspaceProgress}>
        <div>
          <span>Progress</span>
          <strong>{progress}%</strong>
        </div>
        <progress
          aria-label={`${complete} of ${total} tasks complete`}
          max={Math.max(1, total)}
          value={complete}
        />
        <dl>
          <div>
            <dt>Complete</dt>
            <dd>
              {complete}/{total}
            </dd>
          </div>
          <div>
            <dt>Overdue</dt>
            <dd data-alert={overdue > 0 || undefined}>{overdue}</dd>
          </div>
          <div>
            <dt>No date</dt>
            <dd>{undated}</dd>
          </div>
        </dl>
      </section>
    </header>
  );
}

/**
 * The workspace title — the big H1 in the brief, click to edit (T·97).
 * At rest a button carrying the title with a quiet pencil on hover;
 * clicking swaps to an input prefilled with the current title. Enter or
 * blur commits via renameBoardAction; Escape cancels; an empty input is
 * treated as cancel (never clears the name). The override persists in the
 * meta KV and re-renders through pack.boardName; when none is set the
 * title falls back to shortenTitle(workspaceTitle). Both display and
 * input wear the .workspaceIdentity h1 type via the h1 wrapper.
 */
function WorkspaceTitle({ title }: { title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [isPending, startTransition] = useTransition();
  const cancelled = useRef(false);

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    setEditing(false);
    // Empty input = cancel (don't clear); no-op when unchanged.
    if (!next || next === title) return;
    startTransition(async () => {
      await renameBoardAction(next);
      router.refresh();
    });
  }

  return (
    <h1>
      {editing ? (
        <input
          autoFocus
          type="text"
          maxLength={80}
          value={draft}
          disabled={isPending}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              cancelled.current = true;
              setDraft(title);
              setEditing(false);
            }
          }}
          aria-label="Workspace title"
          className={styles.titleInput}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
          title="Rename workspace"
          aria-label="Workspace title"
          className={`${styles.titleButton} group/wt`}
        >
          <span>{title}</span>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 transition-opacity group-hover/wt:opacity-100"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
    </h1>
  );
}

/**
 * The purpose sentence — click to edit, Enter or blur saves, Escape
 * cancels. Falls back to invitation copy until one is written. Renders
 * with the lab's identity-paragraph type via .purposeLine.
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
        className={styles.purposeLine}
        data-editing="true"
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
      className={styles.purposeLine}
      data-empty={purpose ? undefined : "true"}
    >
      {purpose ??
        "What is this workspace for? Write the one-line purpose everyone plans against."}
    </button>
  );
}
