"use client";

import { useState } from "react";
import { useLabStore } from "../store";
import { STATUS_LABELS, TASK_STATUSES } from "../types";
import { Icon } from "./icons";
import styles from "./shared.module.css";

export function BulkToolbar() {
  const store = useLabStore();
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  if (store.selectedIds.length === 0) return null;
  const selectionKey = [...store.selectedIds].sort().join(":");
  const deleteArmed = deleteConfirmation === selectionKey;
  return (
    <div aria-label="Bulk actions" className={styles.bulkToolbar} role="toolbar">
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
    </div>
  );
}
