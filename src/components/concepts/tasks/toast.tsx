"use client";

/**
 * One toast for every edit in Tasks, the same on the board, the list and the
 * calendar: what happened, as a sentence, then Undo with its shortcut.
 *
 *   Marked done. Undo Ctrl Z
 *   Moved to Aoife, due Mon 28 Sep. Undo Ctrl Z
 *
 * A view keeps the state with `useTaskToast` and renders `TaskToast` as the
 * last child of its root (a column that fills the page), so the toast sits at
 * the foot of the view whatever is above it.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useModKeys } from "./keys";
import styles from "./tasks.module.css";

export type TaskToastState = { id: number; text: string; undo: boolean };

/** "Marked done" becomes "Marked done." A sentence that already ends is left alone. */
export function toastSentence(text: string): string {
  const t = text.trim();
  return /[.?…]$/.test(t) ? t : `${t}.`;
}

/** "Ctrl Z" on Windows and Linux, "⌘Z" on a Mac. */
export function useUndoHint(): string {
  const { mod } = useModKeys();
  return mod === "⌘" ? "⌘Z" : `${mod} Z`;
}

/** The toast's state for one view. `say(text, true)` offers Undo. */
export function useTaskToast() {
  const [toast, setToast] = useState<TaskToastState | null>(null);
  const seq = useRef(0);
  const say = useCallback((text: string, undo = false) => {
    seq.current += 1;
    setToast({ id: seq.current, text, undo });
  }, []);
  const close = useCallback(() => setToast(null), []);
  return { toast, say, close };
}

export function TaskToast({
  toast,
  onUndo,
  onClose,
  lift = 0,
  phoneLift = 0,
}: {
  toast: TaskToastState | null;
  /** Step back one gesture. The view says "Undone" itself. */
  onUndo: () => void;
  onClose: () => void;
  /** Pixels of bar under the toast on a desk (the list's command line). */
  lift?: number;
  /** The same on a phone, where the round New task button sits beside it. */
  phoneLift?: number;
}) {
  const hint = useUndoHint();
  const [held, setHeld] = useState(false);
  const id = toast?.id;
  const undo = toast?.undo;
  // Long enough to read and reach Undo; it waits while the pointer or focus is on it.
  useEffect(() => {
    if (id === undefined || held) return;
    const t = window.setTimeout(onClose, undo ? 7000 : 3200);
    return () => window.clearTimeout(t);
  }, [id, undo, held, onClose]);

  return (
    <div className={styles.toastDock} style={{ "--lift": `${lift}px`, "--lift-phone": `${phoneLift}px` } as CSSProperties}>
      {toast ? (
        <div
          key={toast.id}
          className={styles.toast}
          role="status"
          data-task-toast=""
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span className={styles.toastText}>{toastSentence(toast.text)}</span>
          {toast.undo ? (
            <button type="button" className={styles.toastUndo} onClick={onUndo} aria-keyshortcuts="Control+Z Meta+Z">
              Undo
              <kbd className={styles.toastKbd}>{hint}</kbd>
            </button>
          ) : null}
          <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Dismiss">
            <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
