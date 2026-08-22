"use client";

// The project context band. One row: identity (editable name + supporting
// line), the progress facts, and the project-level actions the interior
// mounts into it (Share, Planning, overflow). The 2026-08-05 redesign cut
// the old two/three-panel dashboard — milestones and the money coverage
// line now live in the Planning drawer, so the band answers "where am I,
// how is it going" in ~54px and the lanes get the rest of the screen.

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { requestOpenNav, useNavPanelHidden } from "@/components/app/tasks-nav-state";
import { Icon } from "../../shared/icons";
import { useDomain } from "@/lib/domain-context";
import { promoteLocalBrief } from "@/lib/brief/promote-local-brief";
import { renameBoardAction } from "@/server/actions/board";
import { setProjectDescriptionAction } from "@/server/actions/settings";
import {
  TASKS_SYNC_EVENT,
  type TaskSyncEventDetail,
} from "@/lib/tasks/delight-events";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { Hint } from "@/components/primitives/hint";
import { isTaskOverdue } from "../../dates";
import { useLabStore } from "../../store";
import type { LabTask } from "../../types";
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
  const lastCommitted = useRef<string | null>(null);
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
    syncEmpty();
    // Enter commits without blurring, so the blur that follows would
    // otherwise re-send the same text before the server value has come
    // back through `shown`.
    if (next === shown || next === lastCommitted.current) return;
    lastCommitted.current = next;
    // The band's own edits report through the same Saving…/Saved whisper as
    // task mutations — the status line sits 20px away and used to imply
    // coverage it didn't have. On failure the user's text STAYS; snapping
    // their words back to the old value read as the product losing the
    // edit without a word. Events are emitted directly rather than via
    // beginTaskSync because its error toast says the last confirmed state
    // was restored — true for task mutations, a lie here.
    const emit = (phase: "pending" | "success" | "error") =>
      window.dispatchEvent(
        new CustomEvent<TaskSyncEventDetail>(TASKS_SYNC_EVENT, {
          detail: { id: `brief-${ariaLabel}`, phase },
        }),
      );
    emit("pending");
    startTransition(async () => {
      try {
        await onCommit(next);
        emit("success");
      } catch {
        emit("error");
        window.dispatchEvent(
          new CustomEvent("tasks:toast", {
            detail: {
              title: "The change was not saved",
              body: "Your text is still here. Press Enter to try again.",
              tone: "error",
            },
          }),
        );
      }
    });
  };

  // Emptiness must track the LIVE text, not the committed value: with
  // data-empty derived only from `shown`, the placeholder ghost sat at 55%
  // opacity in front of the user's own words until blur.
  const syncEmpty = () => {
    const el = ref.current;
    if (!el) return;
    const empty = (el.textContent ?? "").trim().length === 0;
    if (empty) el.setAttribute("data-empty", "");
    else el.removeAttribute("data-empty");
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
      onInput={syncEmpty}
      // contentEditable accepts rich clipboard payloads by default —
      // pasted markup would render styled inside a plain-text field.
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData
          .getData("text/plain")
          .replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
        syncEmpty();
      }}
      onKeyDown={(event) => {
        // Enter and Escape used to blur, which drops focus to the
        // document body — the next Tab restarts from the top of the page
        // and a keyboard user loses their place entirely. Both keys now
        // resolve the edit in place and leave focus where it is.
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          // Escape abandons the edit: restore the stored value, then stop.
          event.preventDefault();
          event.currentTarget.textContent = shown;
          syncEmpty();
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

/**
 * The season fact. A hover tooltip was the only carrier of "days of
 * WHAT" — mute for every touch and keyboard user. Tapping the fact
 * opens its referent ("Your planning period ends 29 Sep · 86 days
 * left") in a small layer under the sentence — never swapped inline,
 * which reflowed the whole receipts row and could live-truncate the
 * title. role="status" reads the detail to screen readers when it
 * opens; the title tooltip stays as a bonus for pointer users, never
 * the sole carrier.
 */
function PeriodFact({ label, detail }: { label: string; detail: string }) {
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => {
    if (!showDetail) return;
    const timer = window.setTimeout(() => setShowDetail(false), 8000);
    return () => window.clearTimeout(timer);
  }, [showDetail]);
  return (
    <button
      aria-expanded={showDetail}
      className={styles.briefPeriod}
      onClick={() => setShowDetail((value) => !value)}
      title={showDetail ? undefined : detail}
      type="button"
    >
      {label}
      {showDetail ? (
        <span className={styles.briefPeriodDetail} role="status">
          {detail}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The band's two earned moments (founder verdict 2026-08-12: animate,
 * restrained).
 *
 * S9 — `advanced`: the completed count went UP. The receipts figure takes
 * a single accent-tint pass, the calendar's shipped placement-receipt
 * grammar, so finishing work anywhere lands as felt progress here.
 * S10 — `cleared`: the last overdue task just went away. The whisper slot
 * says so once, in success ink. Both are transient and never fire on
 * mount, on a filter change, or when the number moves the wrong way —
 * a receipt for work you did, not a status light.
 */
function useProgressReceipt(completed: number, overdue: number) {
  const previous = useRef<{ completed: number; overdue: number } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const before = previous.current;
    previous.current = { completed, overdue };
    // First render establishes the baseline: arriving at a board with
    // work already done is not an event.
    if (!before) return;
    if (completed > before.completed) setAdvanced(true);
    if (overdue === 0 && before.overdue > 0) setCleared(true);
  }, [completed, overdue]);

  useEffect(() => {
    if (!advanced) return;
    const timer = window.setTimeout(() => setAdvanced(false), 320);
    return () => window.clearTimeout(timer);
  }, [advanced]);

  useEffect(() => {
    if (!cleared) return;
    const timer = window.setTimeout(() => setCleared(false), 2600);
    return () => window.clearTimeout(timer);
  }, [cleared]);

  return { advanced, cleared };
}

export function WorkspaceBrief({
  tasks,
  actions,
}: {
  tasks: LabTask[];
  actions?: ReactNode;
}) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const domain = useDomain();
  const { setDue } = useRoomTools();
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
  const filteredNote = tasks.length !== store.tasks.length
    ? `${tasks.length} of ${store.tasks.length} tasks in the current view`
    : null;
  const [syncState, setSyncState] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const { advanced, cleared } = useProgressReceipt(completed, overdue);

  useEffect(() => {
    const pending = new Set<string>();
    let settleTimer: number | undefined;
    const settle = (state: "saved" | "error") => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      setSyncState(state);
      // "Saved" whispers and fades; "Not saved" HOLDS until the next
      // attempt — a failure notice that evaporates after seconds leaves
      // the band showing text the server never accepted, marked by
      // nothing.
      if (state === "saved") {
        settleTimer = window.setTimeout(() => setSyncState("idle"), 1400);
      }
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

  /* How far through the season this project is — the one line that is
     about this venue's year rather than about task management. It was
     only readable with the Planning drawer open. Said once: "Day 11 of
     97" and "86 days left" are the same fact twice, and two clauses read
     as telemetry where one reads as a pulse. The arithmetic and the
     period's end date move to the tooltip, which also answers days of
     WHAT — the line used to have no referent at all. */
  const periodProgress = (() => {
    const period = calendar.planningPeriod;
    if (!period?.startDate || !period.endDate) return null;
    const day = (value: string) => Math.floor(Date.parse(`${value}T00:00:00Z`) / 86400000);
    const start = day(period.startDate);
    const end = day(period.endDate);
    const today = day(calendar.today);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const total = end - start + 1;
    const elapsed = Math.min(Math.max(today - start + 1, 1), total);
    const left = Math.max(end - today, 0);
    const ends = new Date(`${period.endDate}T00:00:00Z`).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    return {
      label: `Day ${elapsed} of ${total}`,
      detail: `Your planning period ends ${ends} · ${left} ${left === 1 ? "day" : "days"} left`,
    };
  })();
  const navHidden = useNavPanelHidden();

  return (
    <header className={styles.workspaceBrief}>
      {navHidden ? (
        <button
          aria-haspopup="dialog"
          aria-label="Open Tasks navigation"
          className={styles.navTrigger}
          onClick={requestOpenNav}
          title="Open Tasks navigation"
          type="button"
        >
          <Icon name="panel-left" size={15} />
        </button>
      ) : null}
      <div className={styles.workspaceIdentity}>
        <EditableText
          ariaLabel="Project name"
          onCommit={renameBoardAction}
          placeholder="Name this project"
          tag="h1"
          value={workspaceName}
        />
        {/* Editability had no resting signal: the caret and the hover
            hairline only answer someone already pointing at the title.
            A quiet pencil fades in whenever the band is engaged — the
            prior art this band inherited from the room brief. Decorative:
            the h1 is already the control. */}
        <svg
          aria-hidden="true"
          className={styles.titleAffordance}
          fill="none"
          height="13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
          viewBox="0 0 24 24"
          width="13"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <EditableText
          ariaLabel="Project description"
          onCommit={setProjectDescriptionAction}
          placeholder="+ Add description"
          tag="p"
          value={domain.boardDescription}
        />
      </div>
      {/*
        Progress is one sentence, not an instrument panel: the strong
        number carries the proportion, the count carries the detail, and
        red exists only when work is genuinely overdue. The 4px bar this
        replaces was decoration at reading distance.
      */}
      <section aria-label="Project progress" className={styles.briefProgress}>
        {/* One whisper slot, two speakers: the save state, and — when the
            last overdue task clears — the band's single earned note. The
            clearance outranks a "Saved" that is about to fade anyway. */}
        <span
          aria-live="polite"
          className={styles.syncState}
          // A congratulation must never speak over a failed save: an
          // unsaved change outranks the good news, and the error state is
          // the one thing in this slot the owner has to act on.
          data-state={cleared && syncState !== "error" ? "cleared" : syncState}
          role="status"
        >
          {cleared && syncState !== "error"
            ? "Nothing overdue"
            : syncState === "pending" ? "Saving…" : syncState === "saved" ? "Saved" : syncState === "error" ? "Not saved" : ""}
        </span>
        <p className={styles.briefFacts} title={filteredNote ?? undefined}>
          <strong data-advanced={advanced || undefined}>{completed} of {store.tasks.length} complete</strong>
          {overdue > 0 ? (
            // "Show overdue work", not "go to the first overdue task": the
            // control does one of two things depending on what is on
            // screen, and a hint that names only the happy path is a
            // promise the fallback breaks.
            <Hint text="Show the overdue work">
              <button
                className={styles.briefOverdue}
                onClick={() => {
                  const first = document.querySelector<HTMLElement>("[data-overdue='true']");
                  if (first) {
                    first.scrollIntoView({ block: "center", inline: "center" });
                    first.focus({ preventScroll: true });
                    return;
                  }
                  // The count reads the whole project; the view may be filtered
                  // (or not mark overdue in its DOM). A click that does nothing
                  // is a broken promise — fall back to showing the overdue work
                  // through the filter that already exists.
                  setDue("overdue");
                }}
                type="button"
              >
                {overdue} overdue
              </button>
            </Hint>
          ) : null}
          {periodProgress ? (
            <PeriodFact detail={periodProgress.detail} label={periodProgress.label} />
          ) : null}
        </p>
      </section>
      {actions ? (
        <div className={styles.briefActions}>
          <span aria-hidden="true" className={styles.briefDivider} />
          {actions}
        </div>
      ) : null}
    </header>
  );
}
