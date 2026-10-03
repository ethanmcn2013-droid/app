"use client";

/**
 * TasksWorkspace: the whole Tasks page inside the v3 shell.
 *
 * One calm page that answers what is next, what is stuck and what is done:
 * the header states progress and three pressable facts, the toolbar switches
 * between Board, List and Calendar, and the view canvas fills the rest. At
 * 1280px and wider an open task docks beside the canvas so the board stays
 * usable next to it.
 *
 * Data, selection and persistence are the hybrid store's; this file owns the
 * layout, the shared keyboard map and the floating layers.
 */

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLabStore } from "@/components/hybrid/store";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { useAddTask, type NewTaskDefaults } from "@/components/app/add-task/add-task-context";
import { priorityToLab } from "@/components/hybrid/adapter";
import type { TasksViewId } from "@/lib/product-urls";
import { TasksSurfaceProvider, useSurface, type PickerKind } from "./surface";
import { useVisibleLabTasks } from "./visible-tasks";
import { TasksHeader } from "./header";
import { FilterChips, FirstRunHint, TasksToolbar, useViewHref } from "./toolbar";
import { getVisibleTaskOrder, setSheetDock, setVisibleTaskOrder, useWideSheet, TASK_CREATED_EVENT, type TaskCreatedDetail } from "./sheet-bridge";
import { readSurfaceLayerState, shouldHandleSurfaceKey, surfaceKeyEventFrom } from "./surface-keys";
import { BulkBar } from "./bulk-bar";
import { UndoToast } from "./undo-toast";
import { TaskMenu } from "./task-menu";
import { PropertyPicker } from "./property-picker";
import { DeleteConfirm } from "./delete-confirm";
import { ShortcutsSheet } from "./shortcuts-sheet";
import { TasksColumnsProvider } from "./column-config";
import { TIcon } from "./icons";
import { BoardSkeleton, CalendarSkeleton, ListSkeleton } from "./skeletons";
import styles from "./workspace.module.css";

/** Targets where a bare j, k or Enter belongs to the control, not the surface. */
const BARE_SURFACE_EXCLUDE = 'input, textarea, select, button, a, [contenteditable="true"], [contenteditable=""], [data-act], [role="button"], [role="option"], [role="menuitem"]';

const BoardView = dynamic(() => import("./board-view").then((m) => m.BoardView), { loading: () => <BoardSkeleton /> });
const ListView = dynamic(() => import("./list-view").then((m) => m.ListView), { loading: () => <ListSkeleton /> });
const CalendarView = dynamic(() => import("./calendar-view").then((m) => m.CalendarView), { loading: () => <CalendarSkeleton /> });

export type TasksWorkspaceProps = {
  view: TasksViewId;
  readOnly: boolean;
  canManage: boolean;
};

export function TasksWorkspace(props: TasksWorkspaceProps) {
  return (
    <TasksColumnsProvider>
      <WorkspaceData {...props} />
    </TasksColumnsProvider>
  );
}

function WorkspaceData({ view, readOnly, canManage }: TasksWorkspaceProps) {
  const store = useLabStore();
  const tools = useRoomTools();
  const all = store.tasks;
  const visible = useVisibleLabTasks(all);
  const filtering = tools.activeFilterCount > 0 || tools.query.trim().length > 0;
  return (
    <TasksSurfaceProvider view={view} readOnly={readOnly || store.readOnly} canManage={canManage} all={all} visible={visible} filtering={filtering}>
      <Workspace />
    </TasksSurfaceProvider>
  );
}

/** What the composer should start with: the column, then the active filters. */
export function useNewTaskDefaults() {
  const surface = useSurface();
  const tools = useRoomTools();
  const members = useWorkspaceMembers();
  const calendar = useCalendarFrame();
  return useCallback(
    (extra: Partial<NewTaskDefaults> = {}): NewTaskDefaults => {
      const owner = tools.owner;
      const memberOwner = members.some((m) => m.id === owner) ? owner : null;
      return {
        columnKey: tools.column !== "all" ? tools.column : surface.columns[0]?.key,
        assigneeIds: memberOwner ? [memberOwner] : [],
        priority: tools.priority !== "all" ? priorityToLab(tools.priority) : undefined,
        labelIds: tools.label !== "all" ? [tools.label] : [],
        dueOn: tools.due === "today" ? calendar.today : undefined,
        ...extra,
      };
    },
    [calendar.today, members, surface.columns, tools.column, tools.due, tools.label, tools.owner, tools.priority],
  );
}

function Workspace() {
  const surface = useSurface();
  const store = useLabStore();
  const tools = useRoomTools();
  const router = useRouter();
  const { taskId, openTask } = useTaskPanel();
  const wide = useWideSheet();
  const addTask = useAddTask();
  const defaults = useNewTaskDefaults();
  const viewHref = useViewHref();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const docked = wide && Boolean(taskId);

  // The composer reads the same defaults when opened from the shell's New
  // menu or the C key, so a filtered board pre-fills the new task.
  useEffect(() => {
    addTask.setDefaultsProvider(() => defaults());
    return () => addTask.setDefaultsProvider(null);
  }, [addTask, defaults]);

  // Each view publishes the order it draws (view-order.ts); the sheet's
  // up and down, Shift ranges and Enter all walk that order.
  useEffect(() => () => setVisibleTaskOrder([]), []);

  // A task made in the composer offers Open and Undo here.
  useEffect(() => {
    const onCreated = (event: Event) => {
      const detail = (event as CustomEvent<TaskCreatedDetail>).detail;
      if (!detail?.id) return;
      surface.undo.arm({ kind: "add", id: detail.id, title: detail.title, toLane: detail.columnKey });
    };
    window.addEventListener(TASK_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(TASK_CREATED_EVENT, onCreated);
  }, [surface.undo]);

  const openComposer = useCallback(
    (anchor: HTMLElement | null, extra: Partial<NewTaskDefaults> = {}) => {
      if (surface.readOnly) return;
      addTask.openDialog({ ...defaults(extra), anchor });
    },
    [addTask, defaults, surface.readOnly],
  );

  /* ── The surface keyboard map ───────────────────────────────────── */
  const focusedTask = useCallback((): string | null => {
    const active = document.activeElement as HTMLElement | null;
    const card = active?.closest<HTMLElement>("[data-id]");
    return card?.dataset.id ?? surface.focusedId;
  }, [surface.focusedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const visibleIds = getVisibleTaskOrder();
      if (!shouldHandleSurfaceKey(surfaceKeyEventFrom(event), readSurfaceLayerState())) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const lower = key.toLowerCase();
      const focused = focusedTask();
      const targets = store.selectedIds.length > 0 ? store.selectedIds : focused ? [focused] : [];

      if (mod && lower === "z") {
        event.preventDefault();
        surface.undo.undo();
        return;
      }
      if (mod && key === "Enter" && focused) {
        event.preventDefault();
        surface.complete(focused);
        return;
      }
      if (mod && lower === "d" && focused && !surface.readOnly) {
        event.preventDefault();
        store.duplicateTask(focused);
        return;
      }
      if (mod) return;

      if (!event.shiftKey && (key === "1" || key === "2" || key === "3") && !viewHref.blocked) {
        const next = (["board", "list", "calendar"] as const)[Number(key) - 1];
        if (next !== surface.view) {
          event.preventDefault();
          router.push(viewHref.href(next));
        }
        return;
      }
      if (key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (key === "?") {
        event.preventDefault();
        surface.setShortcutsOpen(true);
        return;
      }
      if (lower === "f") {
        event.preventDefault();
        if (event.shiftKey) tools.clearFilters();
        else document.querySelector<HTMLButtonElement>('[aria-keyshortcuts="F"]')?.click();
        return;
      }
      if (key === "Escape") {
        if (store.selectedIds.length > 0 && !taskId) {
          event.preventDefault();
          store.clearSelection();
        }
        return;
      }
      // The way in: with no card focused, j / ArrowDown lands on the first
      // task in view and k / ArrowUp on the last, so the keyboard works from
      // a cold page without a Tab hunt first.
      const target = event.target instanceof HTMLElement ? event.target : null;
      const onBareSurface = !target || target === document.body || target.tagName === "MAIN" || !target.closest(BARE_SURFACE_EXCLUDE);
      const cardHasFocus = Boolean((document.activeElement as HTMLElement | null)?.closest("[data-canvas] [data-id]"));
      if (!cardHasFocus && !event.shiftKey && onBareSurface && visibleIds.length > 0 && (lower === "j" || lower === "k" || key === "ArrowDown" || key === "ArrowUp")) {
        const forward = lower === "j" || key === "ArrowDown";
        const id = forward ? visibleIds[0] : visibleIds[visibleIds.length - 1];
        const node = document.querySelector<HTMLElement>(`[data-canvas] [data-id="${CSS.escape(id)}"]`);
        if (node) {
          event.preventDefault();
          surface.setFocusedId(id);
          node.focus({ preventScroll: true });
          node.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        return;
      }
      // Enter on the bare surface opens the first task in view.
      if (key === "Enter" && !cardHasFocus && onBareSurface && visibleIds[0]) {
        event.preventDefault();
        openTask(focused && visibleIds.includes(focused) ? focused : visibleIds[0]);
        return;
      }
      if (!focused && targets.length === 0) return;
      const picker: Record<string, PickerKind> = { s: "status", a: "assignee", d: "due", p: "priority", l: "labels" };
      if (picker[lower] && !event.shiftKey && targets.length > 0 && !surface.readOnly) {
        event.preventDefault();
        const anchor = focused ? document.querySelector<HTMLElement>(`[data-id="${CSS.escape(focused)}"]`) : null;
        surface.openPicker(picker[lower], targets, anchor);
        return;
      }
      if (!focused) return;
      if (lower === "x") {
        event.preventDefault();
        store.toggleSelected(focused, [...visibleIds], event.shiftKey);
        return;
      }
      if (lower === "e" && !surface.readOnly) {
        event.preventDefault();
        surface.setRenaming(focused);
        return;
      }
      if (key === ".") {
        event.preventDefault();
        const card = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(focused)}"]`);
        const rect = card?.getBoundingClientRect();
        surface.openMenu(focused, rect ? rect.right - 8 : 0, rect ? rect.top + 24 : 0);
        return;
      }
      if ((key === "Delete" || key === "Backspace") && !surface.readOnly) {
        event.preventDefault();
        surface.requestDelete(targets);
        return;
      }
      if (key === "Enter" && !(event.target as HTMLElement).closest("button, a, [data-act]")) {
        event.preventDefault();
        openTask(focused);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusedTask, openTask, router, store, surface, taskId, tools, viewHref]);

  const dockRef = useCallback((node: HTMLElement | null) => setSheetDock(node), []);

  // Sticky rows below the tools (list header, group rows, calendar pane)
  // sit under the tool zone, whose height changes with chips and the hint.
  const mainRef = useRef<HTMLDivElement | null>(null);
  const toolRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const tool = toolRef.current;
    const main = mainRef.current;
    if (!tool || !main || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      main.style.setProperty("--tool-h", `${Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)}px`);
    });
    observer.observe(tool);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.workspace} data-view={surface.view} data-docked={docked ? "" : undefined} data-floor-runtime="true">
      <div className={styles.main} ref={mainRef}>
        <div className={styles.headZone}>
          <div className={styles.column}>
            <TasksHeader onNewTask={(anchor) => openComposer(anchor)} />
          </div>
        </div>
        {/* The tools stay in reach while a long list or month scrolls. */}
        <div className={styles.toolZone} ref={toolRef}>
          <div className={styles.column}>
            <TasksToolbar searchRef={searchRef} />
            <FilterChips shown={surface.visible.length} total={surface.all.length} />
            <FirstRunHint />
          </div>
        </div>
        <div className={styles.canvas} data-canvas={surface.view}>
          {surface.view === "board" ? (
            <BoardView onCompose={(columnKey, anchor) => openComposer(anchor, { columnKey })} />
          ) : surface.view === "list" ? (
            <ListView onCompose={(extra, anchor) => openComposer(anchor, extra)} />
          ) : (
            <CalendarView onCompose={(extra, anchor) => openComposer(anchor, extra)} />
          )}
        </div>
      </div>
      <aside
        ref={dockRef}
        className={styles.dock}
        data-open={docked ? "" : undefined}
        aria-label="Task details"
        hidden={!docked}
      />
      {surface.readOnly ? null : (
        <button type="button" className={styles.fab} aria-label="New task" onClick={(event) => openComposer(event.currentTarget)}>
          <TIcon.plus size={22} />
        </button>
      )}
      <BulkBar />
      <UndoToast onOpen={(id) => openTask(id)} />
      <TaskMenu />
      <PropertyPicker />
      <DeleteConfirm />
      <ShortcutsSheet />
      <div aria-live="polite" className={styles.srOnly}>{store.announcement}</div>
    </div>
  );
}
