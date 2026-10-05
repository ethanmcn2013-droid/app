"use client";

/**
 * Review: one note at a time, one decision each.
 *
 * A small deck. The note in front of you is a card; the next one peeks from
 * underneath. A decision sends the card the way of the decision (Keep right,
 * Delete left, Decide later down) and the next card rises into place, and
 * every decision leaves an Undo behind in the toast the notebook already
 * shows. Keys match the list and the open note (NOTES_DECISION_KEYS): T turn
 * into task, E keep, Backspace or Delete delete, and L decide later.
 * Swipe stays for touch, and every swipe has a button.
 */

import { useEffect, useRef, useState } from "react";

import {
  friendlyDate,
  noteSource,
  reviewProgress,
  SOURCE_LABELS,
} from "@/modules/notes/lib/notes-view-model";
import {
  NOTES_ACTIONS,
  NOTES_DECISION_KEYS,
  reviewSummary,
  type NotesCopy,
} from "@/modules/notes/lib/notes-copy";
import type { NoteRead } from "@/modules/notes/server/actions/notes";
import {
  ArrowRightIcon,
  CheckIcon,
  SourceIcon,
  TrashIcon,
} from "@/modules/notes/app/workspace/icons";
import { notesOverlayOpen } from "./NotesDialogs";

import styles from "./notes-workspace.module.css";

/** Decisions made in this session, for the finished line. */
export type ReviewTally = { kept: number; turned: number; deleted: number };

type Exit = { note: NoteRead; direction: "keep" | "delete" | "later"; id: number };

export function ReviewSession({
  note,
  nextNote,
  done,
  total,
  tally,
  now,
  copy,
  canSendToTasks,
  canSkip,
  settle,
  onKeep,
  onDelete,
  onTurnIntoTask,
  onSkip,
  onDone,
}: {
  note: NoteRead | null;
  nextNote: NoteRead | null;
  done: number;
  total: number;
  tally: ReviewTally;
  now: number;
  copy: NotesCopy;
  canSendToTasks: boolean;
  canSkip: boolean;
  /** The queue has already moved once, so this card is a swap, not a load. */
  settle: boolean;
  onKeep: (note: NoteRead) => void | Promise<void>;
  onDelete: (note: NoteRead) => void;
  onTurnIntoTask: (note: NoteRead) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [drag, setDrag] = useState<{ x: number; active: boolean }>({ x: 0, active: false });
  const [exit, setExit] = useState<Exit | null>(null);
  const exitCount = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "x" | "y">("none");
  const swipeIntent = drag.x > 72 ? "task" : drag.x < -72 ? "delete" : null;

  const reset = () => {
    setDrag({ x: 0, active: false });
    axis.current = "none";
  };

  const leave = (direction: Exit["direction"]) => {
    if (!note) return;
    exitCount.current += 1;
    setExit({ note, direction, id: exitCount.current });
    if (direction === "keep") void onKeep(note);
    else if (direction === "delete") onDelete(note);
    else onSkip();
  };

  // The latest handlers, for the one document listener below.
  const keys = useRef({ leave, note, canSendToTasks, canSkip, onTurnIntoTask });
  useEffect(() => {
    keys.current = { leave, note, canSendToTasks, canSkip, onTurnIntoTask };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        notesOverlayOpen()
      ) {
        return;
      }
      const current = keys.current;
      if (!current.note) return;
      const key = event.key.toLowerCase();
      if (key === "e") current.leave("keep");
      else if (key === "t" && current.canSendToTasks) current.onTurnIntoTask(current.note);
      else if (key === "l" && current.canSkip) current.leave("later");
      else if (event.key === "Backspace" || event.key === "Delete") current.leave("delete");
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const progress = reviewProgress(done, Math.max(total, done));

  if (!note) {
    return (
      <section className={styles.review} aria-label="Review">
        <div className={styles.reviewEnd}>
          <span className={styles.reviewEndMark} aria-hidden="true">
            <CheckIcon />
          </span>
          <h2 className={styles.reviewEndTitle}>
            {done > 0 ? copy.notebook.reviewDone : copy.notebook.reviewEmpty}
          </h2>
          {done > 0 ? (
            <p className={styles.reviewEndBody}>
              {reviewSummary(copy, tally).slice(copy.notebook.reviewDone.length).trim()}
            </p>
          ) : null}
          <button type="button" className={styles.primaryButton} onClick={onDone}>
            Back to notes
          </button>
        </div>
      </section>
    );
  }

  const source = noteSource(note.source);
  const ghostSource = exit ? noteSource(exit.note.source) : null;

  return (
    <section className={styles.review} aria-label="Review">
      <div className={styles.reviewHead}>
        <p className={styles.reviewCount}>
          Review <span aria-hidden="true">·</span> {progress.label}
        </p>
        <div
          className={styles.reviewTrack}
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(total, done)}
          aria-valuenow={done}
        >
          <span className={styles.reviewFill} style={{ inlineSize: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
        <button type="button" className={styles.quietButton} onClick={onDone}>
          Done
        </button>
      </div>

      <div className={styles.deck}>
        {nextNote ? (
          <div className={styles.peek} aria-hidden="true">
            <p className={styles.reviewBody}>{nextNote.body}</p>
          </div>
        ) : null}

        {exit && ghostSource ? (
          <div
            key={`exit-${exit.id}`}
            className={styles.ghost}
            data-direction={exit.direction}
            aria-hidden="true"
            onAnimationEnd={() => setExit((current) => (current?.id === exit.id ? null : current))}
          >
            <div className={styles.reviewMeta}>
              <SourceIcon source={ghostSource} />
              <span>{SOURCE_LABELS[ghostSource]}</span>
            </div>
            <p className={styles.reviewBody}>{exit.note.body}</p>
          </div>
        ) : null}

        <article
          key={note.id}
          className={`${styles.reviewCard}${settle ? ` ${styles.cardRise}` : ""}`}
          data-review-card=""
          data-swipe={swipeIntent ?? undefined}
          style={drag.active ? { transform: `translateX(${drag.x}px) rotate(${drag.x / 40}deg)`, transition: "none" } : undefined}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            startX.current = event.clientX;
            startY.current = event.clientY;
            axis.current = "none";
            setDrag({ x: 0, active: true });
          }}
          onPointerMove={(event) => {
            if (!drag.active) return;
            const dx = event.clientX - startX.current;
            const dy = event.clientY - startY.current;
            if (axis.current === "none") {
              // Let a vertical scroll stay a scroll. Only claim the gesture
              // once the movement is clearly sideways.
              if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
                axis.current = "y";
                reset();
                return;
              }
              if (Math.abs(dx) > 12) axis.current = "x";
              else return;
            }
            if (axis.current !== "x") return;
            setDrag({ x: dx, active: true });
          }}
          onPointerUp={() => {
            if (axis.current === "x" && swipeIntent === "task" && canSendToTasks) {
              onTurnIntoTask(note);
            } else if (axis.current === "x" && swipeIntent === "delete") {
              leave("delete");
            }
            reset();
          }}
          onPointerCancel={reset}
        >
          <div className={styles.reviewMeta}>
            <SourceIcon source={source} />
            <span>{SOURCE_LABELS[source]}</span>
            <span aria-hidden="true">·</span>
            <span>{friendlyDate(note.createdAt, now)}</span>
            {swipeIntent ? (
              <span className={styles.swipeHint} data-tone={swipeIntent}>
                {swipeIntent === "task" ? "Release to turn into a task" : "Release to delete"}
              </span>
            ) : null}
          </div>
          <p className={styles.reviewBody}>{note.body}</p>
        </article>
      </div>

      <div className={styles.reviewActions} data-notes-review-actions="">
        {canSendToTasks ? (
          <button
            type="button"
            className={`${styles.reviewButton} ${styles.reviewPrimary}`}
            data-decision="task"
            aria-keyshortcuts={NOTES_DECISION_KEYS.turnIntoTask.shortcut}
            onClick={() => onTurnIntoTask(note)}
          >
            <ArrowRightIcon />
            {NOTES_ACTIONS.turnIntoTask}
            <kbd className={styles.kbd} aria-hidden="true">
              {NOTES_DECISION_KEYS.turnIntoTask.keycap}
            </kbd>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.reviewButton}
          data-decision="keep"
          aria-keyshortcuts={NOTES_DECISION_KEYS.keep.shortcut}
          onClick={() => leave("keep")}
        >
          <CheckIcon />
          {NOTES_ACTIONS.keep}
          <kbd className={styles.kbd} aria-hidden="true">
            {NOTES_DECISION_KEYS.keep.keycap}
          </kbd>
        </button>
        <button
          type="button"
          className={`${styles.reviewButton} ${styles.reviewDanger}`}
          data-decision="delete"
          aria-keyshortcuts={NOTES_DECISION_KEYS.delete.shortcut}
          onClick={() => leave("delete")}
        >
          <TrashIcon />
          {NOTES_ACTIONS.delete}
          <kbd className={styles.kbd} aria-hidden="true">
            {NOTES_DECISION_KEYS.delete.keycap}
          </kbd>
        </button>
      </div>
      {canSkip ? (
        <button
          type="button"
          className={styles.laterButton}
          aria-keyshortcuts={NOTES_DECISION_KEYS.later.shortcut}
          onClick={() => leave("later")}
        >
          Decide later
          <kbd className={styles.kbd} aria-hidden="true">
            {NOTES_DECISION_KEYS.later.keycap}
          </kbd>
        </button>
      ) : null}
    </section>
  );
}
