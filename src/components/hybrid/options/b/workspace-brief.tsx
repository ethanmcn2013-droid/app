"use client";

// The workspace brief header from the approved Option-B design lab, extracted
// into its own module so the hybrid interior can use it without pulling in the
// full Option-B shell (product rail, projects sidebar) that production replaces
// with its own chrome. Renders the real workspace name from DomainProvider.

import { useEffect, useRef, useState, useTransition } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useDomain, useProjectMoney } from "@/lib/domain-context";
import { budgetCoverageLine } from "@/lib/money";
import { promoteLocalBrief } from "@/lib/brief/promote-local-brief";
import { renameBoardAction } from "@/server/actions/board";
import { setProjectDescriptionAction } from "@/server/actions/settings";
import {
  TASKS_SYNC_EVENT,
  type TaskSyncEventDetail,
} from "@/lib/tasks/delight-events";
import { formatDate, isTaskOverdue } from "../../dates";
import { useLabStore } from "../../store";
import type { LabTask } from "../../types";
import { TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-b.module.css";

/** Pull the part of the workspace title before " · " for the H1. */
function shortenWorkspaceTitle(value: string): string {
  const index = value.indexOf(" · ");
  return index > 0 ? value.slice(0, index) : value;
}

/**
 * Inline-editable brief text (the project heading and its supporting line).
 *
 * T·114: this used to persist to localStorage keyed by the workspace's
 * *display name*. That meant the text was device-local and invisible to every
 * collaborator, two projects sharing a display name shared one value, and
 * renaming a project orphaned both. It now commits through a server action and
 * renders the server's value, so what the owner types is what everyone reads.
 *
 * `value` is the stored text (null when the owner hasn't written one).
 * `placeholder` is shown in its absence and is never persisted — an empty
 * commit clears the record rather than storing the placeholder as if it were
 * the user's own sentence. Renders as a real h1/p so the brief styles apply.
 */
function EditableText({
  tag: Tag,
  value,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  tag: "h1" | "p";
  value: string | null;
  placeholder: string;
  ariaLabel: string;
  onCommit: (next: string) => Promise<unknown>;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [, startTransition] = useTransition();
  const shown = value ?? "";

  // Re-sync the DOM when the server value changes underneath us (another
  // device, or our own commit revalidating the layout). Guarded on equality
  // so it never fights the caret while the user is mid-edit.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== shown) {
      el.textContent = shown;
    }
  }, [shown]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    // Reflect the normalised value immediately; the server action revalidates
    // the layout and the effect above reconciles if the server disagrees.
    el.textContent = next;
    if (next === shown) return;
    startTransition(async () => {
      try {
        await onCommit(next);
      } catch {
        // Put the stored value back rather than leaving the surface showing
        // text that was never saved.
        if (ref.current) ref.current.textContent = shown;
      }
    });
  };

  // aria-allowed-role fix (Phase 9): heading elements (h1–h6) prohibit
  // role="textbox". Apply it only when Tag is a non-heading element ("p").
  // contentEditable alone signals editability to AT on h1; aria-label carries
  // the accessible name.
  return (
    <Tag
      aria-label={Tag === "h1" ? undefined : ariaLabel}
      className={styles.editable}
      contentEditable
      data-placeholder={placeholder}
      data-empty={shown.length === 0 ? "" : undefined}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          // Escape abandons the edit: restore the stored value, then leave.
          event.currentTarget.textContent = shown;
          event.currentTarget.blur();
        }
      }}
      ref={(node) => {
        ref.current = node;
      }}
      role={Tag === "p" ? "textbox" : undefined}
      spellCheck={false}
      suppressContentEditableWarning
      tabIndex={0}
    >
      {shown}
    </Tag>
  );
}

export function WorkspaceBrief({ tasks, showMilestones = true }: { tasks: LabTask[]; showMilestones?: boolean }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const domain = useDomain();
  const money = useProjectMoney();
  const workspaceName = domain.boardName ?? shortenWorkspaceTitle(domain.workspaceTitle);

  // T·114: rescue any pre-migration brief text still sitting in this browser's
  // localStorage. Runs at most once per browser per project, never overwrites
  // a server value, and clears the old keys either way. Remove with
  // promote-local-brief.ts once no browser plausibly still holds one.
  useEffect(() => {
    void promoteLocalBrief({
      displayName: workspaceName,
      serverName: domain.boardName,
      serverDescription: domain.boardDescription,
      onPromoteName: renameBoardAction,
      onPromoteDescription: setProjectDescriptionAction,
    });
  }, [workspaceName, domain.boardName, domain.boardDescription]);

  const completed = store.tasks.filter((task) => task.completed).length;
  const overdue = store.tasks.filter((task) => isTaskOverdue(task, calendar.today)).length;
  const unscheduled = store.tasks.filter((task) => task.schedule.kind === "unscheduled").length;
  const milestones = store.tasks.filter((task) => task.schedule.kind === "milestone").sort((a, b) => {
    const aDate = a.schedule.kind === "milestone" ? a.schedule.on : "";
    const bDate = b.schedule.kind === "milestone" ? b.schedule.on : "";
    return aDate.localeCompare(bDate);
  }).slice(0, 3);
  const progress = store.tasks.length === 0 ? 0 : Math.round((completed / store.tasks.length) * 100);
  // Money, narrowly (T·124): restate and sum what the operator entered,
  // always with coverage. Renders only here — never on share, print,
  // embed or /p/{slug}.
  const costedTasks = store.tasks.filter((task) => typeof task.cents === "number" && task.cents > 0);
  const coverage = budgetCoverageLine({
    summedCents: costedTasks.reduce((sum, task) => sum + (task.cents ?? 0), 0),
    costedCount: costedTasks.length,
    uncostedCount: store.tasks.length - costedTasks.length,
    budgetCents: money.budgetCents,
    currency: money.currency,
  });
  const [syncState, setSyncState] = useState<"idle" | "pending" | "saved" | "error">("idle");

  useEffect(() => {
    const pending = new Set<string>();
    let settleTimer: number | undefined;
    const settle = (state: "saved" | "error") => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      setSyncState(state);
      settleTimer = window.setTimeout(() => setSyncState("idle"), state === "error" ? 3600 : 1400);
    };
    const handleSync = (event: Event) => {
      const { id, phase } = (event as CustomEvent<TaskSyncEventDetail>).detail;
      if (phase === "pending") {
        pending.add(id);
        setSyncState("pending");
        return;
      }
      pending.delete(id);
      if (phase === "error") {
        settle("error");
        return;
      }
      if (pending.size > 0) setSyncState("pending");
      else settle("saved");
    };
    window.addEventListener(TASKS_SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener(TASKS_SYNC_EVENT, handleSync);
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    };
  }, []);
  // The milestones panel renders only when there is a milestone to show. An
  // empty one used to draw a bordered column and a two-column "No date / No
  // milestones yet" row, which read as a broken record rather than an
  // absence, and cost the board ~120px to say nothing.
  const renderMilestones = showMilestones && milestones.length > 0;
  return (
    <header className={styles.workspaceBrief} data-milestones={renderMilestones ? "on" : undefined}>
      {/*
        T·114: the crumb above the title read "Workspace ›" — a hardcoded
        literal that was neither a link nor a real hierarchy, and that used a
        noun D-011 retired ("Projects = Tasks workspaces"). Nothing replaces
        it; the title is the top of the page.
      */}
      <div className={styles.workspaceIdentity}>
        <EditableText
          ariaLabel="Project name"
          onCommit={renameBoardAction}
          placeholder="Name this project"
          tag="h1"
          value={workspaceName}
        />
        <EditableText
          ariaLabel="Project description"
          onCommit={setProjectDescriptionAction}
          placeholder="Say what this project is for."
          tag="p"
          value={domain.boardDescription}
        />
      </div>
      {/*
        Progress reads as one number, one bar and one line. The old panel
        spent three table rows on Complete / Overdue / No date — a dashboard
        where a sentence does the same work in a quarter of the height.
      */}
      <section aria-label="Project progress" className={styles.workspaceProgress}>
        <div className={styles.progressHead}>
          <strong>{progress}%</strong>
          <span>Progress</span>
          <span aria-live="polite" className={styles.syncState} data-state={syncState} role="status">
            {syncState === "pending" ? "Saving…" : syncState === "saved" ? "Saved" : syncState === "error" ? "Not saved" : ""}
          </span>
        </div>
        <progress aria-label={`${completed} of ${store.tasks.length} tasks complete`} max={Math.max(1, store.tasks.length)} value={completed} />
        {/* Each fact is an unbreakable unit — a count split from its label
            ("1 overdue · 7 / no date") reads as a different number. Wraps
            may only land on the separators. */}
        <p className={styles.progressFacts}>
          <span>{completed} of {store.tasks.length} done</span>
          {overdue > 0 ? <> · <b>{overdue} overdue</b></> : null}
          {unscheduled > 0 ? <> · <span>{unscheduled} unscheduled</span></> : null}
        </p>
        {coverage ? (
          <p aria-label="Budget coverage" className={styles.progressFacts}>
            {coverage.split(/(?<=[.,])\s+/).map((segment) => (
              <span key={segment}>{segment} </span>
            ))}
          </p>
        ) : null}
      </section>
      {renderMilestones ? <section aria-label="Milestones" className={styles.workspaceMilestones}>
        <span>Milestones</span>
        <ol>
          {/* Day-month, like every other date on screen — the old
              `slice(5).replace("-", "/")` printed US-style "08/01", which
              an en-IE reader parses as 8 January. */}
          {milestones.map((task) => <li data-task-id={task.id} key={task.id}><time dateTime={task.schedule.kind === "milestone" ? task.schedule.on : undefined}>{task.schedule.kind === "milestone" ? formatDate(task.schedule.on) : ""}</time><TaskOpenButton task={task} /></li>)}
        </ol>
        {tasks.length !== store.tasks.length ? <small>{tasks.length} of {store.tasks.length} tasks in the current view</small> : null}
      </section> : null}
    </header>
  );
}
