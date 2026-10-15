"use client";

/**
 * The way back, on screen: "Marked done · Undo", "Moved to Review · Undo",
 * "Added to To do · Open · Undo". It lives six seconds, waits while it is
 * hovered or focused, and Cmd/Ctrl+Z keeps working after it has gone.
 */

import { useRef } from "react";
import { useSurface } from "./surface";
import { Kbd } from "./atoms";
import { TIcon } from "./icons";
import styles from "./workspace.module.css";

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";

function shortTitle(title: string): string {
  if (title.length <= 42) return title;
  const words = title.slice(0, 42).split(" ");
  words.pop();
  return `${words.join(" ")}…`;
}

export function UndoToast({ onOpen }: { onOpen: (id: string) => void }) {
  const surface = useSurface();
  const hovered = useRef(false);
  const focused = useRef(false);
  const act = surface.undo.showing;
  if (!act) return null;
  const columnName = (key: string) => surface.columnOf(key)?.name ?? "another column";
  const what =
    act.kind === "done" ? "Marked done" : act.kind === "add" ? `Added to ${columnName(act.toLane)}` : `Moved to ${columnName(act.toLane)}`;
  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      onMouseEnter={() => { hovered.current = true; surface.undo.hold(); }}
      onMouseLeave={() => {
        hovered.current = false;
        if (!focused.current) surface.undo.release();
      }}
      onFocusCapture={() => { focused.current = true; surface.undo.hold(); }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focused.current = false;
        if (!hovered.current) surface.undo.release();
      }}
    >
      <span className={styles.toastIcon} aria-hidden="true">
        {act.kind === "done" ? <TIcon.check size={14} /> : act.kind === "add" ? <TIcon.plus size={14} /> : <TIcon.arrowRight size={14} />}
      </span>
      <span className={styles.toastText}>
        <b>{what}</b>
        <span className={styles.toastTitle}>{shortTitle(act.title)}</span>
      </span>
      {act.kind === "add" ? (
        <button type="button" className={styles.toastAction} style={{ minHeight: 44 }} onClick={() => onOpen(act.id)}>Open</button>
      ) : null}
      <button type="button" className={styles.toastAction} style={{ minHeight: 44 }} onClick={surface.undo.undo}>
        Undo
        <Kbd>{MOD === "⌘" ? "⌘Z" : "Ctrl Z"}</Kbd>
      </button>
      {surface.undo.depth > 1 ? <span className={styles.toastDepth}>{surface.undo.depth - 1} more</span> : null}
    </div>
  );
}
