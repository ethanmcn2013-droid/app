"use client";

/**
 * Deleting has no way back (undo covers done, move and add only), so it
 * asks first, in plain words, and says how many tasks it will remove.
 */

import { useEffect, useRef } from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useSurface } from "./surface";
import { Button } from "./ui";
import styles from "./workspace.module.css";

export function DeleteConfirm() {
  const surface = useSurface();
  const store = useLabStore();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const ids = surface.deleting;
  useEffect(() => {
    if (!ids) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [ids]);
  if (!ids || ids.length === 0) return null;
  const tasks = ids.map((id) => surface.all.find((t) => t.id === id)).filter(Boolean);
  const one = tasks.length === 1 ? tasks[0] : null;
  const confirm = () => {
    if (ids.length === 1) store.deleteTask(ids[0]);
    else {
      // The store's bulk delete acts on the selection.
      const selected = new Set(store.selectedIds);
      if (ids.every((id) => selected.has(id)) && selected.size === ids.length) store.bulkDelete();
      else ids.forEach((id) => store.deleteTask(id));
    }
    surface.cancelDelete();
  };
  return (
    <div
      className={styles.confirmScrim}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) surface.cancelDelete();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          surface.cancelDelete();
        }
      }}
    >
      <div className={styles.confirm} role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title" aria-describedby="delete-task-body">
        <h2 id="delete-task-title" className={styles.confirmTitle}>
          {one ? `Delete “${one.title.length > 60 ? `${one.title.slice(0, 57)}…` : one.title}”?` : `Delete ${tasks.length} tasks?`}
        </h2>
        <p id="delete-task-body" className={styles.confirmBody}>
          This can&rsquo;t be undone. {one ? "Its comments, subtasks and files go with it." : "Their comments, subtasks and files go with them."} To keep a task out of the way instead, archive it.
        </p>
        <div className={styles.confirmActions}>
          <Button ref={cancelRef} variant="ghost" onClick={surface.cancelDelete}>Keep {one ? "it" : "them"}</Button>
          <Button variant="danger" onClick={confirm}>{one ? "Delete task" : `Delete ${tasks.length} tasks`}</Button>
        </div>
      </div>
    </div>
  );
}
