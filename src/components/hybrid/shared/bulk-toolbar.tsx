"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLabStore } from "../store";
import { STATUS_LABELS, TASK_STATUSES } from "../types";
import { Icon } from "./icons";
import styles from "./shared.module.css";

export function BulkToolbar() {
  const store = useLabStore();
  const reduceMotion = useReducedMotion();
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const selectionKey = [...store.selectedIds].sort().join(":");
  const deleteArmed = deleteConfirmation === selectionKey;
  return (
    <AnimatePresence>
    {store.selectedIds.length > 0 ? <motion.div
      animate={{ opacity: 1, transform: "translate(-50%, 0)" }}
      aria-label="Bulk actions"
      className={styles.bulkToolbar}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translate(-50%, 3px)" }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translate(-50%, 4px)" }}
      role="toolbar"
      transition={{ duration: reduceMotion ? 0.1 : 0.16, ease: [0.23, 1, 0.32, 1] }}
    >
      <strong>{store.selectedIds.length} selected</strong>
      <span className={styles.toolbarDivider} />
      <label>
        <span className={styles.srOnly}>Move selected tasks</span>
        <select aria-label="Move selected tasks" disabled={store.readOnly} onChange={(event) => store.bulkStatus(event.target.value as (typeof TASK_STATUSES)[number])} value="">
          <option disabled value="">Move to…</option>
          {TASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
      </label>
      <button disabled={store.readOnly} onClick={() => store.bulkComplete()} type="button"><Icon name="check" size={15} />Complete</button>
      <button
        disabled={store.readOnly}
        onClick={() => {
          if (deleteArmed) { store.bulkDelete(); setDeleteConfirmation(null); }
          else setDeleteConfirmation(selectionKey);
        }}
        type="button"
      ><Icon name="trash" size={15} />{deleteArmed ? "Confirm delete" : "Delete"}</button>
      <button onClick={store.clearSelection} type="button"><Icon name="close" size={15} />Clear</button>
    </motion.div> : null}
    </AnimatePresence>
  );
}
