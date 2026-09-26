"use client";

/**
 * The open note: read it, change it, decide what it is.
 *
 * Reading comes first. The note is shown as a page (its first line as the
 * heading, the rest as paragraphs) and turns into the editor on a click or
 * Enter, with the caret at the end; leaving the field, or Escape, returns to
 * the page. Edits save themselves a moment after typing stops, through the
 * notebook's own compare-and-swap save, and the pill beside the meta line
 * says where that stands. Every decision is a named button under the note.
 *
 * Autosave, the conflict chooser, the delete grace period and the In Tasks
 * record are the notebook's own behaviour (use-notebook.ts), unchanged.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  friendlyDate,
  isSent,
  needsReview,
  noteSource,
  readerRest,
  readerTitle,
  SOURCE_LABELS,
  wordCount,
  wordLabel,
  type PresentableNote,
} from "@/modules/notes/lib/notes-view-model";
import { NOTES_ACTIONS, NOTES_DECISION_KEYS, NOTES_LEGEND } from "@/modules/notes/lib/notes-copy";
import type { NoteRead } from "@/modules/notes/server/actions/notes";
import { taskFocusPath } from "@/lib/product-urls";
import type { useNotebook } from "@/modules/notes/app/workspace/use-notebook";
import {
  ArrowRightIcon,
  BackIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  PencilIcon,
  SourceIcon,
  TrashIcon,
} from "@/modules/notes/app/workspace/icons";
import { ActionMenu, type MenuItem } from "./NotesDialogs";

import styles from "./notes-workspace.module.css";

/** How long typing has to pause before an edit saves itself. */
const AUTOSAVE_MS = 1200;

/** "captured yesterday", but never "captured 14 jul". */
function inSentence(date: string): string {
  return date === "Just now" || date === "Yesterday" ? date.toLowerCase() : date;
}

export function NoteReader({
  note,
  notebook,
  now,
  detailRef,
  onBack,
  onTurnIntoTask,
  onDelete,
  canSendToTasks,
  sendBlockedReason,
  settle,
}: {
  note: NoteRead;
  notebook: ReturnType<typeof useNotebook>;
  now: number;
  detailRef: React.RefObject<HTMLTextAreaElement | null>;
  onBack: () => void;
  onTurnIntoTask: () => void;
  onDelete: () => void;
  canSendToTasks: boolean;
  /** Why Turn into task is off here, in words, when it is. */
  sendBlockedReason: string | null;
  /** This pane has held a different note already, so this one is a swap. */
  settle: boolean;
}) {
  const swap = settle ? ` ${styles.swapSettle}` : "";
  // Keyed by note id, so opening another note always starts on the page.
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const editing = editingFor === note.id && !notebook.readOnly;
  const displayRef = useRef<HTMLDivElement>(null);
  const source = noteSource(note.source);
  const body = notebook.detailBody;
  const dirty = body !== note.body;
  const edited = note.updatedAt > note.createdAt;
  const sent = isSent(note as PresentableNote);
  const waiting = needsReview(note as PresentableNote);
  const readOnly = notebook.readOnly;
  const rest = readerRest(body);

  // Grow the editor to its content so a note stays one continuous page
  // rather than a box with its own scrollbar inside a scrolling pane.
  useLayoutEffect(() => {
    const field = detailRef.current;
    if (!field || !editing) return;
    field.style.height = "auto";
    field.style.height = `${Math.max(140, field.scrollHeight)}px`;
  }, [detailRef, body, editing, note.id]);

  // Entering edit mode puts the caret at the end of what is there.
  useEffect(() => {
    if (!editing) return;
    const field = detailRef.current;
    if (!field || document.activeElement === field) return;
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  }, [detailRef, editing]);

  // Autosave: a moment after typing stops, through the versioned save.
  const saveDetail = notebook.saveDetail;
  const conflictOpen = Boolean(notebook.conflict);
  const status = notebook.detailStatus;
  useEffect(() => {
    if (!dirty || conflictOpen || readOnly || status === "saving" || status === "failed") return;
    const timer = window.setTimeout(() => void saveDetail(note), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [body, conflictOpen, dirty, note, readOnly, saveDetail, status]);

  const leaveEditing = (focusPage: boolean) => {
    setEditingFor(null);
    if (dirty && !notebook.conflict) void notebook.saveDetail(note);
    if (focusPage) window.setTimeout(() => displayRef.current?.focus({ preventScroll: true }), 0);
  };

  const pill: { tone: "saving" | "saved" | "failed" | "pending"; text: string } | null =
    status === "saving"
      ? { tone: "saving", text: NOTES_ACTIONS.saving }
      : status === "failed" && !notebook.conflict
        ? { tone: "failed", text: NOTES_ACTIONS.notSaved }
        : status === "saved"
          ? { tone: "saved", text: NOTES_ACTIONS.saved }
          : dirty
            ? { tone: "pending", text: notebook.recoveryAvailable ? "Editing" : "Only in this tab" }
            : null;

  const readOnlyReason = readOnly ? "This review notebook is read-only, so changes are off here." : null;
  const turnReason = readOnlyReason ?? (canSendToTasks ? null : sendBlockedReason);

  const topMenu: MenuItem[] = [
    {
      label: NOTES_ACTIONS.editNote,
      icon: <PencilIcon />,
      disabled: readOnly,
      onSelect: () => setEditingFor(note.id),
    },
    {
      label: "Delete note",
      icon: <TrashIcon />,
      tone: "danger" as const,
      disabled: readOnly,
      onSelect: onDelete,
    },
  ];

  const footer = [
    wordLabel(wordCount(body)),
    `captured ${inSentence(friendlyDate(note.createdAt, now))}`,
    ...(edited ? [`edited ${inSentence(friendlyDate(note.updatedAt, now))}`] : []),
  ].join(" · ");

  return (
    <article className={styles.reader} aria-label="Open note" data-editing={editing ? "" : undefined}>
      <div className={styles.readerBar}>
        <button type="button" data-notes-back="" className={styles.backButton} onClick={onBack}>
          <BackIcon />
          Notes
        </button>
        <p className={`${styles.readerMeta}${swap}`} key={note.id}>
          <SourceIcon source={source} />
          <span>{SOURCE_LABELS[source]}</span>
          <span aria-hidden="true">·</span>
          <span>{friendlyDate(note.createdAt, now)}</span>
          <span aria-hidden="true" className={styles.metaPrivateDot}>
            ·
          </span>
          <span className={styles.privateTag}>
            <LockIcon />
            Private
          </span>
        </p>
        <span className={styles.savePillSlot} role="status" aria-live="polite">
          {pill?.tone === "failed" ? (
            <button
              type="button"
              className={styles.savePill}
              data-tone="failed"
              onClick={() => void notebook.saveDetail(note)}
            >
              {pill.text}
            </button>
          ) : pill ? (
            <span className={styles.savePill} data-tone={pill.tone} key={`${pill.tone}-${note.updatedAt}`}>
              {pill.tone === "saving" ? <span className={styles.spinner} aria-hidden="true" /> : null}
              {pill.tone === "saved" ? <CheckIcon /> : null}
              {pill.text}
            </span>
          ) : null}
        </span>
        <ActionMenu label={NOTES_ACTIONS.moreForNote} items={topMenu} className={styles.readerMore} />
      </div>

      <div className={styles.readerScroll}>
        <div className={`${styles.readerColumn}${swap}`} key={note.id}>
          {notebook.detailError ? (
            <p className={styles.readerError} role="alert">
              {notebook.detailError}
            </p>
          ) : null}

          {notebook.conflict?.noteId === note.id ? (
            <div className={styles.panel} data-tone="warning" role="group" aria-label="This note changed somewhere else">
              <p className={styles.panelTitle}>This note changed somewhere else</p>
              <p className={styles.panelBody}>Nothing was overwritten. Read both, then choose.</p>
              <div className={styles.conflictVersions}>
                <div className={styles.conflictVersion}>
                  <span className={styles.conflictLabel}>Yours</span>
                  {notebook.conflict.localBody}
                </div>
                <div className={styles.conflictVersion}>
                  <span className={styles.conflictLabel}>Saved version</span>
                  {notebook.conflict.remote.body}
                </div>
              </div>
              <div className={styles.panelActions}>
                <button type="button" className={styles.quietButton} onClick={() => void notebook.resolveConflict("mine", note)}>
                  Keep mine
                </button>
                <button type="button" className={styles.quietButton} onClick={() => void notebook.resolveConflict("theirs", note)}>
                  Use the saved one
                </button>
                <button type="button" className={styles.quietButton} onClick={() => void notebook.resolveConflict("both", note)}>
                  Keep both
                </button>
              </div>
            </div>
          ) : null}

          {editing ? (
            <div className={styles.editWrap}>
              <label className={styles.srOnly} htmlFor="note-body">
                Note
              </label>
              <textarea
                id="note-body"
                ref={detailRef}
                className={styles.readerField}
                value={body}
                onChange={(event) => notebook.editDetail(note, event.target.value)}
                onBlur={() => leaveEditing(false)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                    event.preventDefault();
                    void notebook.saveDetail(note);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    leaveEditing(true);
                  }
                }}
              />
            </div>
          ) : (
            <div
              ref={displayRef}
              className={styles.readerPage}
              role={readOnly ? undefined : "button"}
              tabIndex={0}
              aria-label={readOnly ? undefined : `${NOTES_ACTIONS.editNote}: ${readerTitle(body)}`}
              data-note-display=""
              onClick={() => {
                if (readOnly) return;
                // A selection is someone reading closely, not asking to edit.
                if (window.getSelection()?.toString()) return;
                setEditingFor(note.id);
              }}
              onKeyDown={(event) => {
                if (readOnly || event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setEditingFor(note.id);
                }
              }}
            >
              <h2 className={styles.readerTitle}>{readerTitle(body)}</h2>
              {rest.map((paragraph, index) => (
                <p key={index} className={styles.readerParagraph}>
                  {paragraph}
                </p>
              ))}
              {readOnly ? null : (
                <span className={styles.editHint} aria-hidden="true">
                  <PencilIcon />
                  Click to edit
                </span>
              )}
            </div>
          )}

          {sent && note.promotedTaskId ? (
            <div className={styles.receipt}>
              <span className={styles.receiptMark} aria-hidden="true">
                <CheckIcon />
              </span>
              <p className={styles.receiptText}>
                <span className={styles.receiptLabel}>{NOTES_LEGEND.inTasks}</span>
                <span className={styles.receiptWording}>“{note.extractBody || readerTitle(note.body)}”</span>
              </p>
              <a className={styles.receiptLink} href={taskFocusPath(note.promotedTaskId)}>
                {NOTES_ACTIONS.openTask}
                <ChevronRightIcon />
              </a>
            </div>
          ) : (
            <section className={styles.decision} aria-labelledby={`decision-${note.id}`}>
              <h3 className={styles.decisionTitle} id={`decision-${note.id}`}>
                {waiting ? (
                  <>
                    <span className={styles.waitingDot} aria-hidden="true" />
                    {NOTES_LEGEND.waiting}
                  </>
                ) : (
                  "Kept in your notes"
                )}
              </h3>
              <div className={styles.decisionBar}>
                {canSendToTasks ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    data-decision="task"
                    onClick={onTurnIntoTask}
                    disabled={readOnly}
                    aria-keyshortcuts={NOTES_DECISION_KEYS.turnIntoTask.shortcut}
                  >
                    <ArrowRightIcon />
                    {NOTES_ACTIONS.turnIntoTask}
                    <kbd className={styles.keycap} aria-hidden="true">
                      {NOTES_DECISION_KEYS.turnIntoTask.keycap}
                    </kbd>
                  </button>
                ) : null}
                {waiting ? (
                  <button
                    type="button"
                    className={styles.quietButton}
                    data-decision="keep"
                    onClick={() => void notebook.keepInNotes(note)}
                    disabled={readOnly}
                    aria-keyshortcuts={NOTES_DECISION_KEYS.keep.shortcut}
                  >
                    <CheckIcon />
                    {NOTES_ACTIONS.keep}
                    <kbd className={styles.keycap} aria-hidden="true">
                      {NOTES_DECISION_KEYS.keep.keycap}
                    </kbd>
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.quietButton}
                  data-decision="delete"
                  data-tone="danger"
                  onClick={onDelete}
                  disabled={readOnly}
                  aria-keyshortcuts={NOTES_DECISION_KEYS.delete.shortcut}
                >
                  <TrashIcon />
                  {NOTES_ACTIONS.delete}
                  <kbd className={styles.keycap} aria-hidden="true">
                    {NOTES_DECISION_KEYS.delete.keycap}
                  </kbd>
                </button>
                <ActionMenu
                  label={NOTES_ACTIONS.moreForNote}
                  className={styles.decisionMore}
                  items={[
                    {
                      label: "Delete note",
                      icon: <TrashIcon />,
                      tone: "danger",
                      disabled: readOnly,
                      onSelect: onDelete,
                    },
                  ]}
                />
              </div>
              {turnReason ? <p className={styles.fieldHint}>{turnReason}</p> : null}
            </section>
          )}

          <p className={styles.readerFacts}>{footer}</p>
        </div>
      </div>
    </article>
  );
}
