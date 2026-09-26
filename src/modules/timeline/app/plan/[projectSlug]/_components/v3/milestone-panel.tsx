"use client";

/**
 * One milestone, every setting (spec 5.3). Each field saves on its own, with
 * "Saving", "Saved" or "Couldn't save · Try again" beside it. A labelled
 * region in the side column on desktop; inside a sheet on tablet and phone.
 *
 *   Name              rename, or go back to the name from Tasks
 *   Date              From Tasks (1 Aug) · Set a date · No date, and a
 *                     calendar for the date set here
 *   Shared page       a switch, and where guests see it (Automatic by default)
 *   Source            From Tasks, or Added here
 *   Order             Move up and Move down, with its position
 */

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import type { AudienceItemState } from "@/modules/timeline/server/db/timeline-schema";
import { AUDIENCE_STATE_CHOICES, AUDIENCE_STATE_WORDS, driftSentence } from "@/modules/timeline/lib/plan-view";
import { formatShortDay, formatWeekdayDate, relativeDayPhrase } from "@/lib/projects/project-portfolio-scale";
import { DueCalendar } from "@/components/app/detail-panel/due-calendar";
import { RowMenu, type RowMenuState } from "@/components/app/portfolio/row-menu";
import { ChevronDown, Kbd } from "@/components/app/portfolio/timeline-ui";
import { EyeOffIcon } from "./milestone-row";
import type { EditField, FieldStatus, MilestoneEdits } from "./use-milestone-edits";
import styles from "./plan.module.css";

function Status({ status }: { status: FieldStatus | undefined }) {
  if (!status) return null;
  if (status.kind === "saving") return <span className={styles.fieldSaving}>Saving…</span>;
  if (status.kind === "saved")
    return (
      <span key={status.at} className={styles.fieldSaved}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Saved
      </span>
    );
  return null;
}

function FieldError({ status }: { status: FieldStatus | undefined }) {
  if (status?.kind !== "error") return null;
  return (
    <p className={styles.fieldError} role="alert">
      <span>Could not save. {status.message}</span>
      {status.retry ? (
        <button type="button" className={styles.textButton} onClick={status.retry}>
          Try again
        </button>
      ) : null}
    </p>
  );
}

function isoOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOf(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12);
}

export function MilestonePanel({
  node,
  todayIso,
  keyDateIso,
  canEdit,
  status,
  position,
  tasksHref,
  headingId,
  edits,
  onClose,
  onToggleHidden,
  onMove,
  onUseTasksDate,
  bare = false,
}: {
  node: EffectiveNode;
  todayIso: string;
  /** Marked in the calendar, so a date can be placed against it. */
  keyDateIso: string | null;
  canEdit: boolean;
  status: Partial<Record<EditField, FieldStatus>>;
  /** Place among the milestones it can trade places with. */
  position: { index: number; count: number };
  tasksHref: string;
  headingId: string;
  edits: MilestoneEdits;
  onClose: () => void;
  onToggleHidden: (node: EffectiveNode) => void;
  onMove: (node: EffectiveNode, direction: "up" | "down") => void;
  onUseTasksDate: (node: EffectiveNode) => void;
  /** Inside a sheet, which carries the title and the close control itself. */
  bare?: boolean;
}) {
  const id = useId();
  const [name, setName] = useState(node.title);
  const [nameError, setNameError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [menu, setMenu] = useState<RowMenuState | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  // Follow the milestone when it changes underneath the panel (a rollback,
  // an Undo, a refresh from Tasks) rather than showing a stale draft.
  const [seen, setSeen] = useState(node.title);
  if (seen !== node.title) {
    setSeen(node.title);
    setName(node.title);
  }
  const dateMode = node.dateOverrideMode;
  const drift = driftSentence(node, todayIso);
  const synced = node.source === "synced";
  const inheritedDate = node.sourceTargetDate;
  const draftDate = node.targetDate ?? node.sourceTargetDate ?? todayIso;

  useEffect(() => {
    if (!calendarOpen) return;
    function onDown(event: PointerEvent) {
      if (!calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setCalendarOpen(false);
        document.getElementById(`${id}-date`)?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [calendarOpen, id]);

  function commitName() {
    const next = name.trim();
    if (!next) {
      setNameError("A milestone needs a name.");
      return;
    }
    setNameError(null);
    if (next !== node.title) void edits.saveTitle(node, next);
  }

  function chooseMode(mode: "inherit" | "date" | "undated") {
    if (mode === dateMode) return;
    if (mode === "inherit") void edits.inheritDate(node);
    if (mode === "undated") void edits.setDate(node, "");
    if (mode === "date") {
      // Setting a date pins it here, so a later change in Tasks does not move it.
      void edits.setDate(node, draftDate);
      setCalendarOpen(true);
    }
  }

  const stateValue = node.audienceStateOverride;
  const stateLabel = stateValue ? AUDIENCE_STATE_WORDS[stateValue] : `Automatic (${AUDIENCE_STATE_WORDS[node.sourceAudienceState]})`;

  return (
    <div className={styles.panel} data-bare={bare ? "" : undefined}>
      <div className={styles.panelHead} hidden={bare || undefined}>
        <div className={styles.panelHeadText}>
          <p className={styles.panelEyebrow}>
            {node.targetDate ? `${formatWeekdayDate(node.targetDate)} · ${relativeDayPhrase(node.targetDate, todayIso)}` : "No date yet"}
          </p>
          <h2 id={headingId} className={styles.panelTitle}>
            {node.title}
          </h2>
        </div>
        <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close milestone details">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.panelBody}>
        {drift && canEdit ? (
          <div className={styles.drift} role="status">
            <p>{drift}</p>
            <div className={styles.driftActions}>
              <button type="button" className={styles.chipButton} onClick={() => onUseTasksDate(node)}>
                {node.sourceTargetDate && dateMode === "date" ? `Use ${formatShortDay(node.sourceTargetDate, todayIso)}` : "Use Tasks’ version"}
              </button>
              <button type="button" className={styles.chipButton} data-quiet="" onClick={() => void edits.keepMine(node)}>
                {node.targetDate && dateMode === "date" ? `Keep ${formatShortDay(node.targetDate, todayIso)}` : "Keep mine"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Name */}
        <div className={styles.fieldGroup}>
          <label htmlFor={`${id}-name`} className={styles.fieldLabel}>
            Name
            <Status status={status.name} />
          </label>
          {canEdit ? (
            <input
              id={`${id}-name`}
              className={styles.field}
              value={name}
              maxLength={120}
              autoComplete="off"
              data-panel-name=""
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${id}-name-error` : undefined}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitName();
                }
                if (event.key === "Escape" && name !== node.title) {
                  event.preventDefault();
                  event.stopPropagation();
                  setName(node.title);
                  setNameError(null);
                }
              }}
            />
          ) : (
            <p className={styles.fieldValue}>{node.title}</p>
          )}
          {nameError ? (
            <p id={`${id}-name-error`} className={styles.fieldError} role="alert">
              {nameError}
            </p>
          ) : null}
          <FieldError status={status.name} />
          {canEdit && node.labelOverride && synced ? (
            <button type="button" className={`${styles.textButton} ${styles.fieldAction}`} onClick={() => void edits.saveTitle(node, null)}>
              Use the name from Tasks
            </button>
          ) : null}
        </div>

        {/* Date */}
        <div className={styles.fieldGroup} role="group" aria-labelledby={`${id}-date-label`}>
          <span id={`${id}-date-label`} className={styles.fieldLabel}>
            Date
            <Status status={status.date} />
          </span>
          {canEdit ? (
            <>
              <div className={styles.segmented} role="radiogroup" aria-label={`Date for ${node.title}`}>
                {(
                  [
                    ["inherit", synced ? `From Tasks${inheritedDate ? ` (${formatShortDay(inheritedDate, todayIso)})` : ""}` : `As added${inheritedDate ? ` (${formatShortDay(inheritedDate, todayIso)})` : ""}`],
                    ["date", "Set a date"],
                    ["undated", "No date"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={dateMode === mode}
                    className={styles.segment}
                    onClick={() => chooseMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {dateMode === "date" ? (
                <div className={styles.dateLine} ref={calendarRef}>
                  <button
                    id={`${id}-date`}
                    type="button"
                    className={styles.dateButton}
                    aria-haspopup="dialog"
                    aria-expanded={calendarOpen}
                    onClick={() => setCalendarOpen((open) => !open)}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="2.5" y="3.5" width="11" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M2.5 6.75h11M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {node.targetDate ? formatWeekdayDate(node.targetDate) : "Pick a date"}
                    <span className={styles.dateSetHere}>✎ set here</span>
                  </button>
                  {calendarOpen ? (
                    <div className={styles.calendarPop} role="dialog" aria-label={`Pick a date for ${node.title}`}>
                      <DueCalendar
                        value={node.targetDate ? dateOf(node.targetDate) : null}
                        today={dateOf(todayIso)}
                        anchorDate={keyDateIso}
                        showQuickPicks={false}
                        onSelect={(date) => {
                          const iso = isoOf(date);
                          setCalendarOpen(false);
                          if (iso !== node.targetDate) void edits.setDate(node, iso);
                          document.getElementById(`${id}-date`)?.focus();
                        }}
                        onClear={() => {
                          setCalendarOpen(false);
                          void edits.setDate(node, "");
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.fieldValue}>
              {node.targetDate ? `${formatWeekdayDate(node.targetDate)} · ${relativeDayPhrase(node.targetDate, todayIso)}` : "No date yet"}
            </p>
          )}
          <FieldError status={status.date} />
          {canEdit ? (
            <p className={`${styles.fieldHelp} ${styles.phoneHide}`}>
              Or drag its diamond on the line. <Kbd className={styles.kbdInline}>←</Kbd>
              <Kbd className={styles.kbdInline}>→</Kbd> move it a day.
            </p>
          ) : null}
        </div>

        {/* Shared page */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel} id={`${id}-shared`}>
            Show on the shared page
            <Status status={status.hidden} />
          </span>
          {canEdit ? (
            <label className={styles.switchRow}>
              <span>{node.hidden ? "Hidden. Guests don’t see it." : "Shown to guests"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={!node.hidden}
                aria-labelledby={`${id}-shared`}
                className={styles.switch}
                onClick={() => onToggleHidden(node)}
              />
            </label>
          ) : (
            <p className={styles.fieldValue}>
              {node.hidden ? (
                <>
                  <EyeOffIcon /> Hidden from the shared page
                </>
              ) : (
                "Shown to guests"
              )}
            </p>
          )}
          <FieldError status={status.hidden} />
        </div>

        <div className={styles.fieldGroup}>
          <span id={`${id}-state`} className={styles.fieldLabel}>
            Where guests see it
            <Status status={status.state} />
          </span>
          {canEdit ? (
            <button
              type="button"
              className={styles.selectButton}
              aria-haspopup="menu"
              aria-labelledby={`${id}-state ${id}-state-value`}
              onClick={(event) => {
                const button = event.currentTarget;
                setMenu({
                  anchor: button.getBoundingClientRect(),
                  label: "Where guests see it",
                  returnTo: button,
                  items: [
                    {
                      id: "auto",
                      label: `Automatic (${AUDIENCE_STATE_WORDS[node.sourceAudienceState]})`,
                      current: stateValue === null,
                      onSelect: () => void edits.inheritPublicState(node),
                    },
                    { id: "sep", separator: true },
                    ...AUDIENCE_STATE_CHOICES.map((state: AudienceItemState) => ({
                      id: state,
                      label: AUDIENCE_STATE_WORDS[state],
                      current: stateValue === state,
                      onSelect: () => void edits.setPublicState(node, state),
                    })),
                  ],
                });
              }}
            >
              <span id={`${id}-state-value`}>{stateLabel}</span>
              <ChevronDown size={13} />
            </button>
          ) : (
            <p className={styles.fieldValue}>{AUDIENCE_STATE_WORDS[node.audienceState]}</p>
          )}
          <FieldError status={status.state} />
        </div>

        {/* Source */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Source</span>
          <p className={styles.sourceLine}>
            {synced ? (
              <>
                From Tasks ·{" "}
                <Link href={tasksHref} className={styles.link}>
                  Open task →
                </Link>
              </>
            ) : (
              "Added here"
            )}
          </p>
        </div>

        {/* Order */}
        {canEdit ? (
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              Order
              <Status status={status.order} />
            </span>
            <div className={styles.orderRow} role="group" aria-label={`Reorder ${node.title}`}>
              <button
                type="button"
                className={`${styles.button} ${styles.small}`}
                disabled={position.index <= 0}
                aria-label={`Move ${node.title} up`}
                onClick={() => onMove(node, "up")}
              >
                Move up
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.small}`}
                disabled={position.index >= position.count - 1}
                aria-label={`Move ${node.title} down`}
                onClick={() => onMove(node, "down")}
              >
                Move down
              </button>
              {position.count > 1 ? (
                <span className={styles.position}>
                  Position {position.index + 1} of {position.count}
                </span>
              ) : null}
            </div>
            <p className={styles.fieldHelp}>Order only matters for milestones on the same day or without a date.</p>
            <FieldError status={status.order} />
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className={styles.panelFoot} aria-hidden="true">
          <span>
            <Kbd>E</Kbd> rename · <Kbd>H</Kbd> hide · <Kbd>←</Kbd>
            <Kbd>→</Kbd> a day
          </span>
          <span>
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      ) : null}
      <RowMenu state={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
