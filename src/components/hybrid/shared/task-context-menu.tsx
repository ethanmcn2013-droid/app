"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import type { CalendarDate } from "../types";
import { useLabStore } from "../store";
import { useBoardColumns } from "../columns-context";
import { Icon } from "./icons";
import styles from "./shared.module.css";

type MenuState = { taskId: string; x: number; y: number } | null;

export function useTaskContextMenu() {
  const [menu, setMenu] = useState<MenuState>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeMenu = useCallback(() => {
    setMenu(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, []);
  return {
    menu,
    closeMenu,
    openMenu: (taskId: string, event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      returnFocusRef.current = event.currentTarget as HTMLElement;
      setMenu({ taskId, x: event.clientX, y: event.clientY });
    },
    openMenuAt: (taskId: string, element: HTMLElement) => {
      returnFocusRef.current = element;
      const rect = element.getBoundingClientRect();
      setMenu({ taskId, x: rect.right - 12, y: rect.bottom + 6 });
    },
  };
}

export function TaskContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const store = useLabStore();
  const columns = useBoardColumns();
  const calendar = useCalendarFrame();
  const firstRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const task = menu ? store.taskById(menu.taskId) : undefined;
  // Deleting has no undo, so the item arms per task and deletes on the
  // second press — the same two-step the bulk toolbar uses.
  const [armedFor, setArmedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    firstRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const pointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-task-menu="true"]')) onClose();
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", pointer);
    };
  }, [menu, onClose]);

  if (!menu || !task) return null;
  const left = Math.min(menu.x, Math.max(12, window.innerWidth - 240));
  const top = Math.min(menu.y, Math.max(12, window.innerHeight - 420));
  const run = (callback: () => void) => { callback(); onClose(); };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className={styles.contextMenu} data-task-menu="true" onKeyDown={handleKeyDown} ref={menuRef} role="menu" style={{ left, top }}>
      <button disabled={store.readOnly} onClick={() => run(() => store.openTask(task.id))} ref={firstRef} role="menuitem" type="button"><Icon name="focus" size={15} />Open task</button>
      <button disabled={store.readOnly} onClick={() => run(() => store.setEditing(task.id, "title"))} role="menuitem" type="button"><Icon name="redo" size={15} />Edit title</button>
      <div className={styles.menuLabel}>Move to</div>
      {columns.filter((column) => column.key !== task.status).map(({ key: status, name }) => (
        <button disabled={store.readOnly} key={status} onClick={() => run(() => store.moveStatus(task.id, status))} role="menuitem" type="button">
          <span className={styles.menuStatus} data-status={status} />{name}
        </button>
      ))}
      <div className={styles.menuDivider} />
      {task.schedule.kind === "unscheduled" ? (
        <button disabled={store.readOnly} onClick={() => run(() => store.scheduleOn(task.id, calendar.today as CalendarDate))} role="menuitem" type="button"><Icon name="calendar" size={15} />Schedule for today</button>
      ) : (
        <button disabled={store.readOnly} onClick={() => run(() => store.unscheduleTask(task.id))} role="menuitem" type="button"><Icon name="calendar" size={15} />Unschedule</button>
      )}
      <button disabled={store.readOnly} onClick={() => run(() => store.toggleComplete(task.id))} role="menuitem" type="button"><Icon name="check" size={15} />{task.completed ? "Reopen" : "Mark done"}</button>
      <button disabled={store.readOnly} onClick={() => run(() => store.duplicateTask(task.id))} role="menuitem" type="button"><Icon name="add" size={15} />Duplicate</button>
      <button
        className={styles.dangerMenuItem}
        disabled={store.readOnly}
        onClick={() => {
          if (armedFor === task.id) { setArmedFor(null); run(() => store.deleteTask(task.id)); }
          else setArmedFor(task.id);
        }}
        role="menuitem"
        type="button"
      ><Icon name="trash" size={15} />{armedFor === task.id ? "Confirm delete" : "Delete"}</button>
    </div>
  );
}
