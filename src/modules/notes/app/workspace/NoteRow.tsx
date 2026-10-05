"use client";

/**
 * One row in the Notes list.
 *
 * Memoised, and that is the whole point: nothing here depends on the
 * composer, so typing a sentence never re-derives five hundred rows. A row
 * says what the note is (its first line), how it continues, when it came in
 * and one state mark with words behind it. On a pointer that can hover, the
 * row's decisions surface on hover and on keyboard focus as compact icon
 * buttons (Keep, Turn into task, More) that take the place of the time and
 * state column only, one row at a time, and never on the note already open
 * in the reader, whose decision bar carries them. On touch they live in the
 * reader, one tap away.
 */

import { memo } from "react";

import {
  compactDate,
  derivePresentation,
  friendlyDate,
  isArchived,
  isSent,
  needsReview,
  noteSource,
  searchSnippet,
  SOURCE_LABELS,
  type PresentableNote,
} from "@/modules/notes/lib/notes-view-model";
import { EMPTY_ROW_PREVIEW, NOTES_ACTIONS, NOTES_LEGEND } from "@/modules/notes/lib/notes-copy";
import type { NoteRead } from "@/modules/notes/server/actions/notes";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  RestoreIcon,
  SourceIcon,
  TrashIcon,
} from "@/modules/notes/app/workspace/icons";
import { ActionMenu, type MenuItem } from "./NotesDialogs";

import styles from "./notes-workspace.module.css";

export type RowVariant = "notebook" | "review" | "sent";

/** Highlights the matched run without splitting a word mid-character. */
export function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLocaleLowerCase("en-IE");
  if (!needle) return <>{text}</>;
  const haystack = text.toLocaleLowerCase("en-IE");
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark className={styles.highlight} key={`${index}-${cursor}`}>
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }
  if (!parts.length) return <>{text}</>;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export type NoteRowProps = {
  note: PresentableNote;
  variant: RowVariant;
  now: number;
  query: string;
  selected: boolean;
  state: string | undefined;
  canSendToTasks: boolean;
  readOnly: boolean;
  /** This note appeared after the page did: one placement beat, once. */
  arriving: boolean;
  /** The note has left the notebook; the row is closing the gap behind it. */
  departing: boolean;
  /** The promotion resolved in this session, so the mark fades up in place. */
  promoted: boolean;
  /** Saved from the canvas moments ago. */
  fresh: boolean;
  demoMode: boolean;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
  onKeep: (note: NoteRead) => void | Promise<void>;
  onTurnIntoTask: (note: NoteRead) => void;
  onDelete: (note: NoteRead, rowId: string) => void;
  onRestore: (note: NoteRead) => void | Promise<void>;
};

export const NoteRow = memo(function NoteRow({
  note,
  variant,
  now,
  query,
  selected,
  state,
  canSendToTasks,
  readOnly,
  arriving,
  departing,
  promoted,
  fresh,
  demoMode,
  onSelect,
  onRetry,
  onKeep,
  onTurnIntoTask,
  onDelete,
  onRestore,
}: NoteRowProps) {
  const presentation = derivePresentation(note.body);
  const source = noteSource(note.source);
  const sentRow = variant === "sent";
  const title = sentRow ? note.extractBody || presentation.title : presentation.title;
  const preview = sentRow
    ? presentation.title
    : query.trim()
      ? searchSnippet(note.body, query)
      : presentation.preview;
  const stamp = sentRow ? (note.archivedAt ?? note.updatedAt) : note.createdAt;
  const settled = !state;
  const waiting = needsReview(note);

  const status: { tone: string; label: string; icon: React.ReactNode } | null =
    state === "pending"
      ? { tone: "pending", label: "Saving", icon: <span className={styles.spinner} /> }
      : state === "offline"
        ? { tone: "warning", label: "Waiting to save", icon: <ClockIcon /> }
        : state === "failed"
          ? { tone: "warning", label: "Not saved", icon: <AlertIcon /> }
          : sentRow && isArchived(note)
            ? { tone: "muted", label: "Not in your notebook", icon: <RestoreIcon /> }
            : isSent(note)
              ? { tone: "success", label: NOTES_LEGEND.inTasks, icon: <CheckIcon /> }
              : waiting
                ? { tone: "review", label: NOTES_LEGEND.waiting, icon: <span className={styles.waitingDot} /> }
                : null;

  const canAct = settled && !sentRow && !readOnly;
  const canTurn = canAct && !isSent(note) && canSendToTasks;
  const menu: MenuItem[] = [];
  const keepButton = waiting && canAct;
  if (canAct) {
    if (waiting) {
      menu.push({
        label: NOTES_ACTIONS.keep,
        ariaLabel: `Keep: ${presentation.title}`,
        icon: <CheckIcon />,
        onSelect: () => void onKeep(note),
      });
    }
    if (canTurn) {
      menu.push({
        label: NOTES_ACTIONS.turnIntoTask,
        ariaLabel: `Turn into task: ${presentation.title}`,
        icon: <ArrowRightIcon />,
        onSelect: () => onTurnIntoTask(note),
      });
    }
    menu.push({
      label: NOTES_ACTIONS.delete,
      ariaLabel: `Delete: ${presentation.title}`,
      icon: <TrashIcon />,
      tone: "danger",
      onSelect: () => onDelete(note, note.id),
    });
  }
  if (sentRow && isArchived(note) && !demoMode) {
    menu.push({
      label: "Restore to notebook",
      ariaLabel: `Restore: ${presentation.title}`,
      icon: <RestoreIcon />,
      onSelect: () => void onRestore(note),
    });
  }

  return (
    <li
      className={styles.rowShell}
      data-arriving={arriving ? "" : undefined}
      data-departing={departing ? "" : undefined}
      inert={departing || undefined}
    >
      <div className={styles.rowShellInner}>
        <div
          className={styles.rowWrap}
          data-selected={selected ? "" : undefined}
          data-fresh={fresh ? "" : undefined}
          data-actions={menu.length ? "" : undefined}
          data-waiting={waiting && !sentRow ? "" : undefined}
        >
          <button
            type="button"
            className={styles.row}
            // A row on its way out is not a row anyone can walk to, and it is
            // not one the count should include either.
            data-note-row={departing ? undefined : ""}
            data-sent-row={sentRow ? "" : undefined}
            data-note-id={departing ? undefined : note.id}
            aria-current={selected ? "true" : undefined}
            aria-keyshortcuts={canAct ? `Enter${canTurn ? " T" : ""}${waiting ? " E" : ""} Delete Backspace` : undefined}
            onClick={() => onSelect(note.id)}
          >
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>
                <Highlighted text={title} query={sentRow ? "" : query} />
              </span>
              <span className={styles.rowPreview} data-empty={preview ? undefined : ""}>
                {preview ? <Highlighted text={preview} query={sentRow ? "" : query} /> : EMPTY_ROW_PREVIEW[source]}
              </span>
            </span>
            <span className={styles.rowAside}>
              <span className={styles.rowTime}>
                {source !== "typed" ? <SourceIcon source={source} className={styles.rowSource} /> : null}
                <span aria-hidden="true">{compactDate(stamp, now)}</span>
                <span className={styles.srOnly}>
                  {SOURCE_LABELS[source]}, {friendlyDate(stamp, now)}
                </span>
              </span>
              {status ? (
                <span
                  className={styles.rowStatus}
                  data-tone={status.tone}
                  data-resolved={promoted && status.tone === "success" ? "" : undefined}
                  title={status.label}
                >
                  {status.icon}
                  <span className={styles.srOnly}>{status.label}</span>
                </span>
              ) : (
                <span className={styles.rowStatus} aria-hidden="true" />
              )}
            </span>
          </button>
          {menu.length ? (
            <div
              className={styles.rowActions}
              data-count={1 + (keepButton ? 1 : 0) + (canTurn ? 1 : 0)}
            >
              {canTurn ? (
                <button
                  type="button"
                  className={styles.rowAction}
                  data-tone="primary"
                  aria-label={`Turn into task: ${presentation.title}`}
                  aria-keyshortcuts="T"
                  title={`${NOTES_ACTIONS.turnIntoTask} (T)`}
                  onClick={() => onTurnIntoTask(note)}
                >
                  <ArrowRightIcon />
                </button>
              ) : null}
              {keepButton ? (
                <button
                  type="button"
                  className={styles.rowAction}
                  aria-label={`Keep: ${presentation.title}`}
                  aria-keyshortcuts="E"
                  title={`${NOTES_ACTIONS.keep} (E)`}
                  onClick={() => void onKeep(note)}
                >
                  <CheckIcon />
                </button>
              ) : null}
              <ActionMenu
                className={styles.rowMore}
                label={`${NOTES_ACTIONS.moreForNote}: ${presentation.title}`}
                items={menu}
              />
            </div>
          ) : null}
        </div>
        {state === "failed" ? (
          <div className={styles.rowRetry}>
            <AlertIcon />
            <span>Not saved yet.</span>
            <button type="button" className={styles.linkButton} onClick={() => void onRetry(note.id)}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
});
