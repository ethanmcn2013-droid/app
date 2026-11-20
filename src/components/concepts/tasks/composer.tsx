"use client";

/**
 * The one New task composer, the same on the board, the list and the
 * calendar: a single line in plain words, read by the shared grammar and
 * previewed as chips underneath.
 *
 *   Enter   adds the task and keeps the line open for the next one
 *   Escape  closes it
 *
 * Clicking away from an empty line closes it too. A view decides only where
 * the composer sits and what a line's missing details default to.
 */

import { useEffect, useRef, useState } from "react";
import type { ProjectId } from "../demo/store";
import { parseTaskLine, type TaskLine } from "./grammar";
import { LineChips } from "./task-line";
import styles from "./tasks.module.css";

export const NEW_TASK_PLACEHOLDER = "New task, in plain words";

/** Put the cursor back in an open composer (N pressed again, or `?new=1`). */
export function focusNewTask(): boolean {
  const el = document.querySelector<HTMLInputElement>("[data-new-task-input]");
  if (!el) return false;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

export function NewTaskComposer({
  onAdd,
  onClose,
  fallbackProject,
  where,
  className,
}: {
  onAdd: (line: TaskLine) => void;
  onClose: () => void;
  /** Where the task goes when the line names no project. */
  fallbackProject?: ProjectId;
  /** Said to a screen reader after the label: "in To do", "for Aoife's week". */
  where?: string;
  className?: string;
}) {
  const [text, setText] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const line = parseTaskLine(text);

  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    input.current?.focus({ preventScroll: true });
  }, []);

  const add = () => {
    if (!line.title) return;
    onAdd(line);
    setText("");
    input.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={root}
      className={[styles.composer, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="New task"
      data-new-task=""
      onBlur={(e) => {
        // Leaving an empty line closes it; a line with words in it stays until Escape.
        if (text.trim() || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        onClose();
      }}
    >
      <div className={styles.composerRow}>
        <svg className={styles.composerPlus} width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
        <input
          ref={input}
          type="text"
          className={styles.composerInput}
          data-new-task-input=""
          value={text}
          placeholder={NEW_TASK_PLACEHOLDER}
          aria-label={where ? `${NEW_TASK_PLACEHOLDER}, ${where}` : NEW_TASK_PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
      </div>
      {/* The line has the whole first row, so its placeholder is never cut, even in a board column. */}
      <div className={styles.composerFoot}>
        <LineChips line={line} fallbackProject={fallbackProject} />
        <span className={styles.composerEnd}>
          <span className={styles.composerKeys} aria-hidden="true">
            <kbd>Esc</kbd> to close
          </span>
          <button type="button" className={styles.composerAdd} disabled={!line.title} onMouseDown={(e) => e.preventDefault()} onClick={add}>
            Add
            <kbd className={styles.kbdOnAccent} aria-hidden="true">
              ↵
            </kbd>
          </button>
        </span>
      </div>
    </div>
  );
}
