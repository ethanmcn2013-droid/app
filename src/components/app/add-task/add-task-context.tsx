"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useKeyboardShortcut } from "@/lib/use-keyboard-shortcut";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import type { TaskPriority } from "@/components/hybrid/types";
import { NewTaskComposer } from "./quick-create-dialog";

/**
 * What a new task starts with. The Tasks surface supplies these from the
 * column whose "+" was pressed and from the active filters, so a board
 * filtered to Orla creates a task already assigned to Orla.
 */
export type NewTaskDefaults = {
  columnKey?: string;
  /** Calendar date, YYYY-MM-DD. */
  dueOn?: string;
  assigneeIds?: string[];
  priority?: TaskPriority;
  labelIds?: string[];
  /** Where the composer anchors on desktop; a centred sheet when absent. */
  anchor?: HTMLElement | null;
};

type Ctx = {
  open: boolean;
  defaults: NewTaskDefaults;
  /** Accepts a click event too, so it can be wired straight to onClick. */
  openDialog: (defaults?: NewTaskDefaults | { nativeEvent: unknown }) => void;
  closeDialog: () => void;
  /** The Tasks surface registers its filter-aware defaults here. */
  setDefaultsProvider: (provider: (() => NewTaskDefaults) | null) => void;
};

const AddTaskContext = createContext<Ctx | null>(null);

export function AddTaskRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<NewTaskDefaults>({});
  const provider = useRef<(() => NewTaskDefaults) | null>(null);
  const { closeTask } = useTaskPanel();

  const openDialog = useCallback(
    (next?: NewTaskDefaults | { nativeEvent: unknown }) => {
      closeTask(); // single explicit dismissal of stacked surfaces
      // Some callers wire openDialog straight to onClick, which hands over the
      // click event; only a plain defaults object counts as defaults.
      const given = next && typeof next === "object" && !("nativeEvent" in next) ? (next as NewTaskDefaults) : undefined;
      const base = given ?? provider.current?.() ?? {};
      const anchor =
        base.anchor ??
        (typeof document !== "undefined" ? document.querySelector<HTMLElement>("[data-new-task-anchor]") : null);
      setDefaults({ ...base, anchor });
      setOpen(true);
    },
    [closeTask],
  );
  const closeDialog = useCallback(() => setOpen(false), []);
  const setDefaultsProvider = useCallback((next: (() => NewTaskDefaults) | null) => {
    provider.current = next;
  }, []);

  // `c` shortcut. Bind on keydown and preventDefault so the
  // keystroke doesn't bleed into the about-to-mount input.
  useKeyboardShortcut(
    "c",
    (e) => {
      e.preventDefault();
      openDialog();
    },
    { enabled: !open },
  );

  const value = useMemo<Ctx>(
    () => ({ open, defaults, openDialog, closeDialog, setDefaultsProvider }),
    [open, defaults, openDialog, closeDialog, setDefaultsProvider],
  );

  return (
    <AddTaskContext.Provider value={value}>
      {children}
      <NewTaskComposer open={open} defaults={defaults} onClose={closeDialog} />
    </AddTaskContext.Provider>
  );
}

export function useAddTask(): Ctx {
  const ctx = useContext(AddTaskContext);
  if (!ctx) {
    throw new Error("useAddTask must be used within <AddTaskRoot>");
  }
  return ctx;
}
