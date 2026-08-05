"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLabStore } from "../store";
import { columnDisplayName } from "@/lib/board-columns";
import { useBoardColumns } from "../columns-context";
import { Icon } from "./icons";
import styles from "./shared.module.css";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useLabStore();
  const columns = useBoardColumns();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  const close = () => {
    setQuery("");
    onClose();
    window.setTimeout(() => previousFocus.current?.focus(), 0);
  };
  const results = useMemo(() => store.tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query, store.tasks]);
  if (!open) return null;
  return (
    <div className={styles.paletteBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section
        aria-label="Task command palette"
        aria-modal="true"
        className={styles.commandPalette}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); close(); return; }
          if (event.key !== "Tab" || !dialogRef.current) return;
          const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <label><Icon name="search" size={18} /><input aria-label="Search tasks and commands" onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks and commands…" ref={inputRef} value={query} /><kbd>esc</kbd></label>
        <div className={styles.paletteCommands}>
          <button disabled={store.readOnly} onClick={() => { store.addTask("todo"); close(); }} type="button"><Icon name="add" size={16} /><span><b>Create a task</b><small>Lands at the top of the board</small></span><kbd>C</kbd></button>
          <div className={styles.paletteLabel}>Tasks</div>
          {results.map((task) => <button key={task.id} onClick={() => { store.openTask(task.id); close(); }} type="button"><span className={styles.paletteStatus} data-status={task.status} /><span><b>{task.title}</b><small>{columnDisplayName(columns, task.status)}</small></span></button>)}
          {results.length === 0 ? <p>No matching tasks</p> : null}
        </div>
        <footer><span><kbd>↵</kbd> Open</span><span><kbd>↑↓</kbd> Navigate</span><span>Fixture search · no network</span></footer>
      </section>
    </div>
  );
}
