"use client";

/**
 * The bulk bar: appears when tasks are selected and acts on all of them.
 * Move, assign, date and priority loop through the store's own per-task
 * dispatchers (no new server action); delete asks first.
 */

import { useState } from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useSurface } from "./surface";
import { StatusGlyph, Kbd } from "./atoms";
import { TIcon } from "./icons";
import { Button, MenuContent, MenuItem, MenuRoot, MenuTrigger } from "./ui";
import styles from "./workspace.module.css";

export function BulkBar() {
  const surface = useSurface();
  const store = useLabStore();
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const ids = store.selectedIds.filter((id) => surface.all.some((t) => t.id === id));
  if (ids.length === 0 || surface.readOnly) return null;
  const allDone = ids.every((id) => {
    const task = surface.all.find((t) => t.id === id);
    return task ? surface.isDone(task) : false;
  });
  return (
    <div className={styles.bulk} role="toolbar" aria-label={`${ids.length} selected`} ref={setAnchor}>
      <span className={styles.bulkCount}>
        <b>{ids.length}</b>
        <span className={styles.bulkWord}> selected</span>
      </span>
      <span className={styles.bulkDivider} aria-hidden="true" />
      <MenuRoot>
        <MenuTrigger asChild>
          <Button variant="ghost" size="sm" icon={<TIcon.arrowRight />}><span className={styles.bulkLabel}>Move to</span></Button>
        </MenuTrigger>
        <MenuContent side="top" align="start" width={220} label="Move selected tasks">
          {surface.columns.map((column) => (
            <MenuItem key={column.key} icon={<StatusGlyph column={column} size={14} />} onSelect={() => ids.forEach((id) => surface.move(id, column.key))}>
              {column.name}
            </MenuItem>
          ))}
        </MenuContent>
      </MenuRoot>
      <Button variant="ghost" size="sm" icon={<TIcon.person />} onClick={() => surface.openPicker("assignee", ids, anchor)}><span className={styles.bulkLabel}>Assign</span></Button>
      <Button variant="ghost" size="sm" icon={<TIcon.calendar />} onClick={() => surface.openPicker("due", ids, anchor)}><span className={styles.bulkLabel}>Due</span></Button>
      <Button variant="ghost" size="sm" icon={<TIcon.flag />} onClick={() => surface.openPicker("priority", ids, anchor)}><span className={styles.bulkLabel}>Priority</span></Button>
      <Button variant="ghost" size="sm" icon={<TIcon.check />} onClick={() => store.bulkComplete(!allDone)}><span className={styles.bulkLabel}>{allDone ? "Reopen" : "Mark done"}</span></Button>
      <Button variant="ghost" size="sm" icon={<TIcon.trash />} className={styles.bulkDanger} onClick={() => surface.requestDelete(ids)}><span className={styles.bulkLabel}>Delete</span></Button>
      <span className={`${styles.bulkDivider} ${styles.bulkWide}`} aria-hidden="true" />
      <Button variant="ghost" size="sm" iconOnly icon={<TIcon.close />} aria-label="Clear selection" title="Clear selection (Esc)" onClick={() => store.clearSelection()} />
      <span className={`${styles.bulkKeys} ${styles.bulkWide}`} aria-hidden="true"><Kbd>Esc</Kbd></span>
    </div>
  );
}
