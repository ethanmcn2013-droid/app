"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Guest, ProjectId, Section, Step, Table, Task, ToolId } from "./data";
import { ORCHARD_NOW_SECONDS } from "./data";

export type DragItem = { kind: "task" | "guest"; id: string; label: string } | { kind: "tool"; id: ToolId; label: string };
export type SendTarget = { kind: "task" | "guest"; id: string };

export type BenchApi = {
  project: ProjectId;
  tasks: Task[];
  toggleTask: (id: string) => void;
  guests: Guest[];
  tables: Table[];
  seatGuest: (guestId: string, table: number | null) => void;
  addTable: () => void;
  selectedTable: number | null;
  selectTable: (n: number | null) => void;
  mfSteps: Step[];
  orchardSteps: Step[];
  placeTask: (taskId: string, at: number) => void;
  unplaceTask: (taskId: string) => void;
  nudgeTask: (taskId: string, delta: number) => void;
  pushLater: (fromAt: number, minutes: number) => void;
  sections: Section[];
  reassign: (sectionId: string, who: Section["who"]) => void;
  drag: DragItem | null;
  setDrag: (d: DragItem | null) => void;
  openSend: (t: SendTarget) => void;
  /** Recently changed item, for a one-off highlight. */
  flash: string | null;
  isOpen: (tool: ToolId) => boolean;
  openTool: (tool: ToolId) => void;
  focusPane: (tool: ToolId) => void;
  say: (message: string, undo?: () => void) => void;
};

export const BenchCtx = createContext<BenchApi | null>(null);
export const useBench = () => {
  const v = useContext(BenchCtx);
  if (!v) throw new Error("BenchCtx missing");
  return v;
};

/* ── the Saturday clock: one shared tick for every pane that is live ── */

let started = 0;
let current = ORCHARD_NOW_SECONDS;
let timer: number | null = null;
const subs = new Set<() => void>();

function subscribe(cb: () => void) {
  subs.add(cb);
  if (timer === null) {
    if (!started) started = Date.now();
    timer = window.setInterval(() => {
      current = ORCHARD_NOW_SECONDS + Math.floor((Date.now() - started) / 1000);
      subs.forEach((s) => s());
    }, 1000);
  }
  return () => {
    subs.delete(cb);
    if (subs.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** Seconds after midnight on the live Saturday. */
export const useSaturdayClock = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => ORCHARD_NOW_SECONDS,
  );

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

/** Chrome often reports no relatedTarget on dragleave, so test the pointer against the box. */
export const outside = (e: { clientX: number; clientY: number; currentTarget: EventTarget }) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom;
};
