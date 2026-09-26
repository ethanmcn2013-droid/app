"use client";

/**
 * The Tasks surface context: the actions every view shares.
 *
 * Complete, move and add go through here so each one records its way back
 * (undo toast and Cmd/Ctrl+Z), announces itself, and lets the board animate
 * the change. Pickers, the task menu and the delete confirm are opened from
 * here so a letter key, a card click and a list cell all reach the same
 * object.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useBoardColumns } from "@/components/hybrid/columns-context";
import type { BoardColumn } from "@/lib/board-columns";
import type { LabTask, TaskSchedule } from "@/components/hybrid/types";
import type { TasksViewId } from "@/lib/product-urls";
import { useTasksUndo, type TasksAct } from "./use-tasks-undo";

export type PickerKind = "status" | "assignee" | "due" | "priority" | "labels";
export type AnchorLike = HTMLElement | { x: number; y: number } | null;

/** The board registers these so undo and moves animate like direct acts. */
export type BoardMotion = {
  capture: () => void;
  arm: (id: string) => void;
  focus: (id: string | null) => void;
};

type PickerState = { kind: PickerKind; ids: string[]; anchor: AnchorLike } | null;
type MenuState = { id: string; x: number; y: number } | null;

export type SurfaceApi = {
  view: TasksViewId;
  readOnly: boolean;
  canManage: boolean;
  columns: BoardColumn[];
  /** Every task in the project, in board order. */
  all: LabTask[];
  /** The tasks the tools admit, in the view's order. */
  visible: LabTask[];
  filtering: boolean;
  columnOf: (key: string) => BoardColumn | undefined;
  isDone: (task: LabTask) => boolean;

  complete: (id: string) => void;
  move: (id: string, columnKey: string, index?: number) => void;
  addInline: (columnKey: string, title: string, schedule?: TaskSchedule) => void;
  undo: ReturnType<typeof useTasksUndo>;
  motion: MutableRefObject<BoardMotion | null>;
  /** The board registers how its changes animate; null when it unmounts. */
  setMotion: (motion: BoardMotion | null) => void;

  picker: PickerState;
  openPicker: (kind: PickerKind, ids: string[], anchor: AnchorLike) => void;
  closePicker: () => void;
  menu: MenuState;
  openMenu: (id: string, x: number, y: number) => void;
  closeMenu: () => void;
  deleting: string[] | null;
  requestDelete: (ids: string[]) => void;
  cancelDelete: () => void;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
};

const SurfaceContext = createContext<SurfaceApi | null>(null);

export function useSurface(): SurfaceApi {
  const value = useContext(SurfaceContext);
  if (!value) throw new Error("useSurface must be used inside TasksSurfaceProvider");
  return value;
}

export function TasksSurfaceProvider({
  view,
  readOnly,
  canManage,
  all,
  visible,
  filtering,
  children,
}: {
  view: TasksViewId;
  readOnly: boolean;
  canManage: boolean;
  all: LabTask[];
  visible: LabTask[];
  filtering: boolean;
  children: ReactNode;
}) {
  const store = useLabStore();
  const columns = useBoardColumns();
  const motion = useRef<BoardMotion | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const columnOf = useCallback((key: string) => columns.find((c) => c.key === key), [columns]);
  const isDone = useCallback((task: LabTask) => task.completed || columnOf(task.status)?.isDone === true, [columnOf]);

  /* Reversing an act runs through the same paths that made it, so an undone
     completion travels back exactly as it travelled out. */
  const onUndo = useCallback(
    (act: TasksAct) => {
      motion.current?.capture();
      if (act.kind === "done") {
        motion.current?.arm(act.id);
        store.toggleComplete(act.id);
      } else if (act.kind === "move") {
        motion.current?.arm(act.id);
        store.moveStatus(act.id, act.lane, act.index);
      } else {
        store.deleteTask(act.id);
      }
      motion.current?.focus(act.kind === "add" ? null : act.id);
    },
    [store],
  );
  const undo = useTasksUndo(onUndo);

  const complete = useCallback(
    (id: string) => {
      if (readOnly) return;
      const task = all.find((t) => t.id === id);
      if (!task) return;
      const done = isDone(task);
      motion.current?.capture();
      motion.current?.arm(id);
      store.toggleComplete(id);
      if (done) undo.forget(id, "done");
      else undo.arm({ kind: "done", id, title: task.title });
      motion.current?.focus(id);
    },
    [all, isDone, readOnly, store, undo],
  );

  const move = useCallback(
    (id: string, columnKey: string, index?: number) => {
      if (readOnly) return;
      const task = all.find((t) => t.id === id);
      if (!task) return;
      const laneTasks = all.filter((t) => t.status === task.status).sort((a, b) => a.order - b.order);
      const from = { lane: task.status, index: Math.max(0, laneTasks.findIndex((t) => t.id === id)) };
      if (from.lane === columnKey && (index === undefined || index === from.index)) return;
      const toDone = columnOf(columnKey)?.isDone;
      motion.current?.capture();
      motion.current?.arm(id);
      store.moveStatus(id, columnKey, index);
      // A move into a done column is a completion, whichever route took it there.
      if (toDone && !columnOf(from.lane)?.isDone) undo.arm({ kind: "done", id, title: task.title });
      else undo.arm({ kind: "move", id, title: task.title, lane: from.lane, index: from.index, toLane: columnKey });
      motion.current?.focus(id);
    },
    [all, columnOf, readOnly, store, undo],
  );

  /* A titled add never takes focus (the store keeps the author in the
     composer); the undo record lands once the store names the new task. */
  const pendingAdd = useRef<{ title: string; toLane: string; before: string | null } | null>(null);
  const addInline = useCallback(
    (columnKey: string, title: string, schedule?: TaskSchedule) => {
      if (readOnly) return;
      const clean = title.trim().replace(/\s+/g, " ");
      if (!clean) return;
      pendingAdd.current = { title: clean, toLane: columnKey, before: store.recentlyPlacedId };
      store.addTask(columnKey, schedule, clean);
    },
    [readOnly, store],
  );
  useEffect(() => {
    const pending = pendingAdd.current;
    const placed = store.recentlyPlacedId;
    if (!pending || !placed || placed === pending.before) return;
    pendingAdd.current = null;
    undo.arm({ kind: "add", id: placed, title: pending.title, toLane: pending.toLane });
  }, [store.recentlyPlacedId, undo]);

  const value = useMemo<SurfaceApi>(
    () => ({
      view,
      readOnly,
      canManage,
      columns,
      all,
      visible,
      filtering,
      columnOf,
      isDone,
      complete,
      move,
      addInline,
      undo,
      motion,
      setMotion: (next) => {
        motion.current = next;
      },
      picker,
      openPicker: (kind, ids, anchor) => {
        if (readOnly || ids.length === 0) return;
        setMenu(null);
        setPicker({ kind, ids, anchor });
      },
      closePicker: () => setPicker(null),
      menu,
      openMenu: (id, x, y) => {
        setPicker(null);
        setMenu({ id, x, y });
      },
      closeMenu: () => setMenu(null),
      deleting,
      requestDelete: (ids) => {
        if (readOnly || ids.length === 0) return;
        setMenu(null);
        setDeleting(ids);
      },
      cancelDelete: () => setDeleting(null),
      renaming,
      setRenaming,
      focusedId,
      setFocusedId,
      shortcutsOpen,
      setShortcutsOpen,
    }),
    [view, readOnly, canManage, columns, all, visible, filtering, columnOf, isDone, complete, move, addInline, undo, picker, menu, deleting, renaming, focusedId, shortcutsOpen],
  );

  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}
