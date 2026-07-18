"use client";

/**
 * Task-card action surfaces (Phase 3): the ellipsis overflow menu
 * (Section E), the tag editor, and the Nudge UI. All render through a
 * portal so they are never clipped by an independently scrolling Kanban
 * column, and all reuse the existing task mutation dispatchers.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useTagDefs } from "@/lib/domain-context";
import { COLUMN_COLORS, COLUMN_PICKER_ORDER, type ColumnColorKey } from "@/lib/board-colors";
import { addTagAction } from "@/server/actions/tags";
import { tagColor, tagKey, type TagDef } from "@/lib/tags";
import { Icon } from "@/components/app/room/room-icons";
import styles from "./card-actions.module.css";

// ─── Anchored portal ───────────────────────────────────────────────────────

/**
 * Position a fixed-position panel next to a trigger, flipping/shifting to
 * stay inside the viewport. Recomputed on open; the parent closes the panel
 * on scroll so a stale anchor never lingers.
 */
function useAnchoredPosition(
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const t = trigger.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const margin = 8;
    // Prefer below-right-aligned; flip up / shift left near an edge.
    let top = t.bottom + 4;
    if (top + ph > window.innerHeight - margin) {
      top = Math.max(margin, t.top - ph - 4);
    }
    let left = t.right - pw;
    if (left < margin) left = margin;
    if (left + pw > window.innerWidth - margin) {
      left = window.innerWidth - margin - pw;
    }
    setPos({ top, left });
  }, [open, triggerRef, panelRef]);
  return pos;
}

function Portal({ children }: { children: ReactNode }) {
  // These surfaces only render on a client interaction (an open popover), so
  // document is always present; the guard just keeps SSR/first-render safe.
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

// ─── Keyboard menu navigation ───────────────────────────────────────────────

/** Move focus through the menu's enabled items with arrow keys. */
function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") {
    return;
  }
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
  );
  if (items.length === 0) return;
  e.preventDefault();
  const idx = items.indexOf(document.activeElement as HTMLElement);
  let next = 0;
  if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  else if (e.key === "ArrowDown") next = idx < 0 ? 0 : (idx + 1) % items.length;
  else next = idx <= 0 ? items.length - 1 : idx - 1;
  items[next]?.focus();
}

// ─── Card overflow menu (Section E) ─────────────────────────────────────────

export type MenuColumn = {
  key: string;
  name: string;
  color: ColumnColorKey;
  dot: string;
  isSystem: boolean;
};

export function CardMenu({
  task,
  currentColumnKey,
  columns,
  triggerRef,
  onClose,
  onEditTitle,
}: {
  task: Task;
  currentColumnKey: string;
  columns: MenuColumn[];
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onEditTitle: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pos = useAnchoredPosition(triggerRef, panelRef, true);
  const { openTask } = useTaskPanel();
  const { moveTask, moveTaskToColumn, toggleComplete, updateTask, duplicateTask } =
    useTasksDispatch();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  const isDone = task.lane === "done";
  const isScheduled = Boolean(task.due || task.dueAt);

  // Focus the first item; close on outside click / Escape / scroll; return
  // focus to the trigger when the menu closes.
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    function onDocPointer(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    }
    function onScroll() { if (!confirmDelete && !nudgeOpen) onClose(); }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDelete, nudgeOpen]);

  function close() {
    onClose();
    // Return focus to the originating ellipsis button.
    triggerRef.current?.focus();
  }

  function run(fn: () => void) {
    fn();
    close();
  }

  const dotStyle = (c: MenuColumn) =>
    c.color !== "neutral" && COLUMN_COLORS[c.color].var
      ? { background: COLUMN_COLORS[c.color].var as string }
      : { background: c.dot };

  if (confirmDelete) {
    return (
      <DeleteTaskDialog
        task={task}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run(() => {})}
      />
    );
  }

  return (
    <Portal>
      <div
        ref={panelRef}
        role="menu"
        aria-label={`Actions for ${task.title}`}
        onKeyDown={onMenuKeyDown}
        className={styles.menu}
        style={{
          position: "fixed",
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <button type="button" role="menuitem" className={styles.item} onClick={() => run(() => openTask(task.id))}>
          <Icon name="board" size={14} />
          Open task
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={() => { onEditTitle(); close(); }}>
          <Icon name="fields" size={14} />
          Edit title
        </button>

        <p className={styles.sectionLabel}>Move to</p>
        {columns.map((c) => {
          const current = c.key === currentColumnKey;
          return (
            <button
              key={c.key}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={current}
              aria-current={current ? "true" : undefined}
              onClick={() =>
                run(() => {
                  if (c.isSystem) moveTask(task.id, c.key as Task["lane"]);
                  else moveTaskToColumn(task.id, c.key);
                })
              }
            >
              <span className={styles.dot} style={dotStyle(c)} />
              {c.name}
              {current ? <span className={styles.currentTick}><Icon name="check" size={13} /></span> : null}
            </button>
          );
        })}

        <div className={styles.divider} />
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() =>
            run(() => {
              if (isScheduled) {
                // Unschedule: clear the single canonical date model. Nulls
                // (not undefined) so the server write actually clears the
                // columns; we reuse the one existing date model, never a second.
                updateTask(task.id, { due: null, dueAt: null } as unknown as Partial<Task>);
              } else {
                // Schedule: open the existing date-selection interface.
                openTask(task.id);
              }
            })
          }
        >
          <Icon name="calendar" size={14} />
          {isScheduled ? "Unschedule" : "Schedule"}
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={() => run(() => toggleComplete(task.id))}>
          <Icon name="check" size={14} />
          {isDone ? "Reopen" : "Complete"}
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={() => run(() => duplicateTask(task.id))}>
          <Icon name="columns" size={14} />
          Duplicate in session
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={() => setNudgeOpen(true)}>
          <Icon name="spark" size={14} />
          Nudge…
        </button>

        <div className={styles.divider} />
        <button
          type="button"
          role="menuitem"
          className={`${styles.item} ${styles.danger}`}
          onClick={() => setConfirmDelete(true)}
        >
          <Icon name="trash" size={14} />
          Delete in session
        </button>
      </div>

      {nudgeOpen ? (
        <NudgeDialog task={task} onClose={() => { setNudgeOpen(false); close(); }} />
      ) : null}
    </Portal>
  );
}

// ─── Delete confirmation ─────────────────────────────────────────────────────

function DeleteTaskDialog({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { removeTask } = useTasksDispatch();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <Portal>
      <div
        className={styles.backdrop}
        onClick={onCancel}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      >
        <div
          ref={ref}
          role="alertdialog"
          aria-modal="true"
          aria-label={`Delete ${task.title}`}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={styles.dialog}
        >
          <h2 className={styles.dialogTitle}>Delete this task?</h2>
          <p className={styles.dialogBody}>
            “{task.title}” will be removed from this board. This can’t be undone.
          </p>
          <div className={styles.dialogActions}>
            <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className={styles.btnDanger}
              autoFocus
              onClick={() => { removeTask(task.id); onConfirm(); }}
            >
              Delete task
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ─── Nudge UI (Phase 3C — UI only, backend not connected) ────────────────────

function NudgeDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [note, setNote] = useState("");
  const assignee = task.assignees[0] ?? null;
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <Portal>
      <div
        className={styles.backdrop}
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`Nudge about ${task.title}`}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={styles.dialog}
        >
          <h2 className={styles.dialogTitle}>Nudge</h2>
          <p className={styles.dialogBody}>A gentle reminder about “{task.title}”.</p>

          <label className={styles.field}>
            <span>To</span>
            <input
              readOnly
              value={assignee ? `Assignee · ${assignee}` : "No assignee yet"}
              aria-label="Recipient"
            />
          </label>
          <label className={styles.field}>
            <span>Note <em>(optional)</em></span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a short note…"
              aria-label="Optional note"
            />
          </label>

          {/*
            NUDGE BACKEND BOUNDARY — do NOT wire a send here.
            The send action is intentionally disabled: there is no nudge
            delivery backend yet (no persistence, permissions, recipient
            resolution, or notification transport). Connect this to the
            server action / endpoint when the Nudge backend ships. See the
            founder to-do "Nudge backend" in docs/founder-todos.md.
            TODO(nudge-backend): replace the disabled button below with the
            real send mutation once the endpoint exists.
          */}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <span title="Nudges aren’t connected yet — coming soon.">
              <button type="button" className={styles.btnPrimary} disabled aria-disabled="true">
                Send nudge
              </button>
            </span>
          </div>
          <p className={styles.nudgeHint}>
            Sending isn’t available yet. This will notify the recipient once the
            Nudge feature is switched on.
          </p>
        </div>
      </div>
    </Portal>
  );
}

// ─── Tag editor ──────────────────────────────────────────────────────────────

export function TagEditor({
  task,
  triggerRef,
  onClose,
}: {
  task: Task;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pos = useAnchoredPosition(triggerRef, panelRef, true);
  const defs = useTagDefs();
  const { updateTask } = useTasksDispatch();
  const [query, setQuery] = useState("");
  const [color, setColor] = useState<ColumnColorKey>("neutral");
  // Local optimistic view of the definition list so a freshly created tag
  // appears immediately (the server revalidation catches up). Re-sync from
  // the authoritative defs during render when they change (no effect).
  const [localDefs, setLocalDefs] = useState<TagDef[]>(defs);
  const [prevDefs, setPrevDefs] = useState(defs);
  if (prevDefs !== defs) {
    setPrevDefs(defs);
    setLocalDefs(defs);
  }

  const assigned = task.tags ?? [];
  const assignedKeys = new Set(assigned.map(tagKey));

  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>("input");
    first?.focus();
    function onDocPointer(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.preventDefault(); onClose(); } }
    function onScroll() { onClose(); }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose, triggerRef]);

  function toggle(name: string) {
    const key = tagKey(name);
    const next = assignedKeys.has(key)
      ? assigned.filter((t) => tagKey(t) !== key)
      : [...assigned, name];
    updateTask(task.id, { tags: next });
  }

  async function createAndAssign() {
    const name = query.trim();
    if (!name) return;
    // Reuse an existing definition (case-insensitive) if present.
    const existing = localDefs.find((d) => tagKey(d.name) === tagKey(name));
    if (!existing) {
      setLocalDefs((prev) => [...prev, { name, color }]);
    }
    setQuery("");
    setColor("neutral");
    if (!assignedKeys.has(tagKey(name))) {
      updateTask(task.id, { tags: [...assigned, existing?.name ?? name] });
    }
    try {
      await addTagAction(name, existing?.color ?? color);
    } catch {
      // Revalidation will reconcile; the assignment already persisted.
    }
  }

  const filtered = localDefs.filter((d) =>
    query.trim() ? d.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );
  const exactExists = localDefs.some((d) => tagKey(d.name) === tagKey(query));

  return (
    <Portal>
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Tags for ${task.title}`}
        className={styles.tagPanel}
        style={{
          position: "fixed",
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <div className={styles.tagSearchRow}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim() && !exactExists) {
                e.preventDefault();
                void createAndAssign();
              }
            }}
            placeholder="Find or create a tag…"
            aria-label="Find or create a tag"
            maxLength={32}
          />
          <span className={styles.tagColorPicker} role="group" aria-label="New tag colour">
            {COLUMN_PICKER_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={COLUMN_COLORS[key].label}
                aria-pressed={color === key}
                title={COLUMN_COLORS[key].label}
                data-color={key}
                data-selected={color === key ? "" : undefined}
                onClick={() => setColor(key)}
                className={styles.tagSwatch}
                style={
                  COLUMN_COLORS[key].var
                    ? { background: COLUMN_COLORS[key].var as string, borderColor: COLUMN_COLORS[key].var as string }
                    : undefined
                }
              />
            ))}
          </span>
        </div>

        <div className={styles.tagList} role="listbox" aria-label="Tags">
          {filtered.map((d) => {
            const on = assignedKeys.has(tagKey(d.name));
            const cssVar = COLUMN_COLORS[d.color].var;
            return (
              <button
                key={tagKey(d.name)}
                type="button"
                role="option"
                aria-selected={on}
                className={styles.tagOption}
                onClick={() => toggle(d.name)}
              >
                <span
                  className={styles.tagOptionDot}
                  style={cssVar ? { background: cssVar } : { background: "var(--x-task-border-strong)" }}
                />
                <span className={styles.tagOptionName}>{d.name}</span>
                {on ? <Icon name="check" size={13} /> : null}
              </button>
            );
          })}
          {query.trim() && !exactExists ? (
            <button type="button" className={styles.tagCreate} onClick={() => void createAndAssign()}>
              <Icon name="add" size={13} />
              Create “{query.trim()}”
            </button>
          ) : null}
          {filtered.length === 0 && !query.trim() ? (
            <p className={styles.tagEmpty}>No tags yet. Type to create one.</p>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/** Assigned tag names on a task (case-insensitive helper for callers). */
export function taskHasTag(task: Task, name: string): boolean {
  return (task.tags ?? []).some((t) => tagKey(t) === tagKey(name));
}
export { tagColor };
