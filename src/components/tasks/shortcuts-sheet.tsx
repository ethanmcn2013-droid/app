"use client";

/**
 * The keyboard reference, opened with "?". Grouped the way people reach
 * for keys: moving around, acting on a task, switching views, and inside an
 * open task.
 */

import { useEffect, useRef } from "react";
import { useSurface } from "./surface";
import { Kbd } from "./atoms";
import { TIcon } from "./icons";
import styles from "./workspace.module.css";

type Row = [keys: string[], what: string];

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Move around",
    rows: [
      [["↑", "↓", "←", "→"], "Move between tasks"],
      [["J", "K"], "Next or previous task"],
      [["Enter"], "Open the task"],
      [["/"], "Find a task"],
      [["F"], "Filter"],
      [["⇧", "F"], "Clear filters"],
      [["Esc"], "Close, clear or put back"],
    ],
  },
  {
    title: "Act on a task",
    rows: [
      [["C"], "New task"],
      [["E"], "Rename in place"],
      [["Space"], "Pick up, then drop with Space"],
      [["S"], "Status"],
      [["A"], "Assign"],
      [["D"], "Due date"],
      [["P"], "Priority"],
      [["L"], "Labels"],
      [["X"], "Select"],
      [["."], "More actions"],
      [["⌘", "↵"], "Mark done or reopen"],
      [["⌘", "D"], "Duplicate"],
      [["⌘", "Z"], "Undo"],
      [["Delete"], "Delete, after a check"],
    ],
  },
  {
    title: "Views",
    rows: [
      [["1"], "Board"],
      [["2"], "List"],
      [["3"], "Calendar"],
      [["T"], "Today, in Calendar"],
      [["⌘", "K"], "Search everything"],
    ],
  },
  {
    title: "In an open task",
    rows: [
      [["↑", "↓"], "Previous or next task in this view"],
      [["E"], "Open it full page"],
      [["F6"], "Move between the board and the task"],
      [["Esc"], "Close"],
    ],
  },
];

export function ShortcutsSheet() {
  const surface = useSurface();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const open = surface.shortcutsOpen;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        surface.setShortcutsOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, surface]);
  if (!open) return null;
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
  return (
    <div
      className={styles.confirmScrim}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) surface.setShortcutsOpen(false);
      }}
    >
      <div className={styles.shortcuts} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <div className={styles.shortcutsHead}>
          <h2 id="shortcuts-title" className={styles.confirmTitle}>Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className={styles.iconClose} aria-label="Close" onClick={() => surface.setShortcutsOpen(false)}>
            <TIcon.close size={14} />
          </button>
        </div>
        <div className={styles.shortcutsGrid}>
          {GROUPS.map((group) => (
            <section key={group.title} className={styles.shortcutGroup}>
              <h3 className={styles.shortcutTitle}>{group.title}</h3>
              <dl>
                {group.rows.map(([keys, what]) => (
                  <div key={what} className={styles.shortcutRow}>
                    <dt>{what}</dt>
                    <dd>
                      {keys.map((key) => (
                        <Kbd key={key}>{key === "⌘" ? mod : key}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className={styles.shortcutsFoot}>Letter keys never fire while you are typing in a field.</p>
      </div>
    </div>
  );
}
