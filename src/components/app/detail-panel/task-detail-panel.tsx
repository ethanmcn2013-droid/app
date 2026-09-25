"use client";

/**
 * The task sheet host, mounted once for the whole app and opened by ?task=.
 *
 * On the Tasks surface at 1280px and wider it docks into the slot beside
 * the board (no backdrop; F6 moves between the board and the task; Escape
 * closes and hands focus back to the card). Everywhere else, and below
 * 1280px, it is a modal sheet over a scrim that traps focus. A task that
 * no longer exists says so and waits to be closed; nothing auto-closes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { hasOpenLayer } from "@/components/primitives/open-layer";
import { useHydrated } from "@/lib/use-hydrated";
import { getVisibleTaskOrder, useSheetDock, useWideSheet } from "@/components/tasks/sheet-bridge";
import { StaleTask, TaskSheet } from "./task-sheet";
import styles from "./task-sheet.module.css";

export function TaskDetailPanel() {
  const { taskId, closeTask, openTask } = useTaskPanel();
  const state = useTasksState();
  const dock = useSheetDock();
  const wide = useWideSheet();
  const hydrated = useHydrated();
  const task = taskId ? state.tasks.find((t) => t.id === taskId) ?? null : null;
  const docked = Boolean(dock && wide);

  // Up and down follow the order the current view shows, falling back to
  // the store's order when the sheet is open over another page.
  const order = useCallback((): string[] => {
    const visible = getVisibleTaskOrder();
    return taskId && visible.includes(taskId) ? [...visible] : state.tasks.map((t) => t.id);
  }, [state.tasks, taskId]);

  const navigate = useCallback(
    (direction: "prev" | "next") => {
      if (!taskId) return;
      const ids = order();
      const at = ids.indexOf(taskId);
      if (at === -1) return;
      const next = ids[Math.max(0, Math.min(ids.length - 1, at + (direction === "prev" ? -1 : 1)))];
      if (next && next !== taskId) openTask(next);
    },
    [openTask, order, taskId],
  );

  // "Open full page" lays the same task out in two columns over the app.
  // The /app/task/[id] address resolves back to this sheet, so the full
  // page lives here rather than behind a navigation that returns.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = Boolean(taskId && expandedFor === taskId);
  const expand = useCallback(() => {
    if (!taskId) return;
    setExpandedFor((current) => (current === taskId ? null : taskId));
  }, [taskId]);

  const ids = taskId ? order() : [];
  const at = taskId ? ids.indexOf(taskId) : -1;
  const position = at >= 0 && ids.length > 1 ? `${at + 1} of ${ids.length}` : null;

  // The sheet portals into the page, so it waits for the client.
  if (!taskId || !hydrated) return null;
  if (expanded && task) {
    return (
      <ModalFrame onClose={closeTask} full>
        <TaskSheet task={task} mode="page" overlay onClose={closeTask} onNavigate={navigate} onExpand={expand} position={position} />
      </ModalFrame>
    );
  }
  const body = task ? (
    <TaskSheet
      task={task}
      mode={docked ? "docked" : "modal"}
      onClose={closeTask}
      onNavigate={navigate}
      onExpand={expand}
      position={position}
    />
  ) : (
    <StaleTask onClose={closeTask} />
  );

  if (docked && dock) return createPortal(<DockedFrame onClose={closeTask}>{body}</DockedFrame>, dock);
  return <ModalFrame onClose={closeTask}>{body}</ModalFrame>;
}

/** Beside the board: a labelled region, not a trap. */
function DockedFrame({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F6") {
        event.preventDefault();
        const inside = ref.current?.contains(document.activeElement);
        if (inside) {
          const card = document.querySelector<HTMLElement>('[data-board] [data-id][tabindex="0"], [role="grid"] [data-id][tabindex="0"]');
          card?.focus();
        } else {
          ref.current?.focus();
        }
        return;
      }
      if (event.key !== "Escape" || hasOpenLayer()) return;
      const target = event.target as HTMLElement;
      // Escape inside the board belongs to the board first (carry, search).
      if (!ref.current?.contains(target) && target !== document.body && target.closest("[data-board], [role='grid'], input, textarea")) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className={styles.dockFrame}
      role="complementary"
      aria-labelledby="task-panel-title"
      tabIndex={-1}
      data-task-detail-panel=""
    >
      {children}
    </div>
  );
}

/** Over the page: a modal sheet with a scrim and a focus trap. */
function ModalFrame({ onClose, children, full = false }: { onClose: () => void; children: React.ReactNode; full?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      // Focus lands on the sheet itself; its label is the task title.
      ref.current?.focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || hasOpenLayer(ref.current)) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = body;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [onClose]);

  const trap = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || hasOpenLayer(ref.current)) return;
    const node = ref.current;
    if (!node) return;
    const items = [...node.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <section
        ref={ref}
        className={styles.modalFrame}
        data-full={full ? "" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-panel-title"
        tabIndex={-1}
        onKeyDown={trap}
        data-task-detail-panel=""
        data-task-focus-window=""
      >
        {children}
      </section>
    </>,
    document.body,
  );
}
