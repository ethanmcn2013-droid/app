"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useKeyboardShortcut } from "@/lib/use-keyboard-shortcut";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { QuickCreateDialog } from "./quick-create-dialog";

type Ctx = {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
};

const AddTaskContext = createContext<Ctx | null>(null);

export function AddTaskRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { closeTask } = useTaskPanel();

  const openDialog = useCallback(() => {
    closeTask(); // single explicit dismissal of stacked surfaces
    setOpen(true);
  }, [closeTask]);
  const closeDialog = useCallback(() => setOpen(false), []);

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
    () => ({ open, openDialog, closeDialog }),
    [open, openDialog, closeDialog],
  );

  return (
    <AddTaskContext.Provider value={value}>
      {children}
      <QuickCreateDialog open={open} onClose={closeDialog} />
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
