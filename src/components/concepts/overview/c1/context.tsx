"use client";

import { createContext, useContext } from "react";
import type { ProjectId, Task, TaskAction } from "./data";

export type Scope = ProjectId | "all";

export type EditionCtx = {
  tasks: Task[];
  task: (id: string) => Task;
  act: (taskId: string, action: TaskAction) => void;
  notify: (message: string) => void;
  openPill: string | null;
  pinned: boolean;
  setOpenPill: (key: string | null, pinned?: boolean) => void;
  closePill: (key: string) => void;
  tracked: boolean;
  toggleTracked: () => void;
  brief: boolean;
  setScope: (scope: Scope) => void;
};

export const Edition = createContext<EditionCtx | null>(null);

export function useEdition() {
  const ctx = useContext(Edition);
  if (!ctx) throw new Error("useEdition outside the edition");
  return ctx;
}
