"use client";

// The workspace brief header from the approved Option-B design lab, extracted
// into its own module so the hybrid interior can use it without pulling in the
// full Option-B shell (product rail, projects sidebar) that production replaces
// with its own chrome. Renders the real workspace name from DomainProvider.

import { useEffect, useRef } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useDomain } from "@/lib/domain-context";
import { isTaskOverdue } from "../../dates";
import { useLabStore } from "../../store";
import type { LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-b.module.css";

/** Pull the part of the workspace title before " · " for the H1. */
function shortenWorkspaceTitle(value: string): string {
  const index = value.indexOf(" · ");
  return index > 0 ? value.slice(0, index) : value;
}

/**
 * Inline-editable brief text (the workspace heading and its supporting line).
 * Click to edit; the value persists per workspace in localStorage so the founder
 * can retitle a workspace board ("Q3 launch") and rewrite the line beneath it
 * without a round-trip. Renders as a real h1/p so the existing brief styles apply.
 */
function EditableText({
  tag: Tag,
  storageKey,
  legacyStorageKey,
  fallback,
  ariaLabel,
}: {
  tag: "h1" | "p";
  storageKey: string;
  legacyStorageKey?: string;
  fallback: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let value = fallback;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored && stored.length > 0) {
        value = stored;
      } else if (legacyStorageKey) {
        // Migration: fall back to old key; if found, promote to new key and
        // remove old so subsequent reads use the namespaced key.
        const legacy = window.localStorage.getItem(legacyStorageKey);
        if (legacy && legacy.length > 0) {
          value = legacy;
          window.localStorage.setItem(storageKey, legacy);
          window.localStorage.removeItem(legacyStorageKey);
        }
      }
    } catch {
      /* private mode / storage disabled — keep the fallback */
    }
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value;
  }, [storageKey, legacyStorageKey, fallback]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = (el.textContent ?? "").replace(/\s+/g, " ").trim() || fallback;
    el.textContent = next;
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* ignore persistence failure */
    }
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
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
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
      {fallback}
    </Tag>
  );
}

export function WorkspaceBrief({ tasks, showMilestones = true }: { tasks: LabTask[]; showMilestones?: boolean }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const domain = useDomain();
  const workspaceName = domain.boardName ?? shortenWorkspaceTitle(domain.workspaceTitle);
  const completed = store.tasks.filter((task) => task.completed).length;
  const overdue = store.tasks.filter((task) => isTaskOverdue(task, calendar.today)).length;
  const unscheduled = store.tasks.filter((task) => task.schedule.kind === "unscheduled").length;
  const milestones = store.tasks.filter((task) => task.schedule.kind === "milestone").sort((a, b) => {
    const aDate = a.schedule.kind === "milestone" ? a.schedule.on : "";
    const bDate = b.schedule.kind === "milestone" ? b.schedule.on : "";
    return aDate.localeCompare(bDate);
  }).slice(0, 3);
  const progress = store.tasks.length === 0 ? 0 : Math.round((completed / store.tasks.length) * 100);
  // The milestones panel renders only when there is a milestone to show. An
  // empty one used to draw a bordered column and a two-column "No date / No
  // milestones yet" row, which read as a broken record rather than an
  // absence, and cost the board ~120px to say nothing.
  const renderMilestones = showMilestones && milestones.length > 0;
  return (
    <header className={styles.workspaceBrief} data-milestones={renderMilestones ? "on" : undefined}>
      <div className={styles.workspaceIdentity}>
        <div className={styles.workspacePath}><span>Workspace</span><Icon name="chevron-right" size={12} /><strong>{workspaceName}</strong></div>
        <EditableText ariaLabel="Workspace name" fallback={workspaceName} storageKey={`signal-tasks.brief.title:${workspaceName}`} legacyStorageKey={`tasks:brief:title:${workspaceName}`} tag="h1" />
        <EditableText ariaLabel="Workspace description" fallback="Everything for this workspace in one view. Every task should leave a clear next handoff." storageKey={`signal-tasks.brief.subtitle:${workspaceName}`} legacyStorageKey={`tasks:brief:subtitle:${workspaceName}`} tag="p" />
      </div>
      {/*
        Progress reads as one number, one bar and one line. The old panel
        spent three table rows on Complete / Overdue / No date — a dashboard
        where a sentence does the same work in a quarter of the height.
      */}
      <section aria-label="Workspace progress" className={styles.workspaceProgress}>
        <div className={styles.progressHead}><strong>{progress}%</strong><span>Progress</span></div>
        <progress aria-label={`${completed} of ${store.tasks.length} tasks complete`} max={Math.max(1, store.tasks.length)} value={completed} />
        <p className={styles.progressFacts}>
          {completed} of {store.tasks.length} done
          {overdue > 0 ? <> · <b>{overdue} overdue</b></> : null}
          {unscheduled > 0 ? <> · {unscheduled} no date</> : null}
        </p>
      </section>
      {renderMilestones ? <section aria-label="Milestones" className={styles.workspaceMilestones}>
        <span>Milestones</span>
        <ol>
          {milestones.map((task) => <li data-task-id={task.id} key={task.id}><time dateTime={task.schedule.kind === "milestone" ? task.schedule.on : undefined}>{task.schedule.kind === "milestone" ? task.schedule.on.slice(5).replace("-", "/") : ""}</time><TaskOpenButton task={task} /></li>)}
        </ol>
        {tasks.length !== store.tasks.length ? <small>{tasks.length} of {store.tasks.length} tasks in the current view</small> : null}
      </section> : null}
    </header>
  );
}
