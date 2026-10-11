"use client";

import { createContext, useContext } from "react";
import type { Item, ProjectId } from "./data";
import type { Lens } from "./model";

export type MoveHow = "drag" | "key" | "swipe" | "menu";

export type RiverApi = {
  lens: Lens;
  expandedId: string | null;
  openDays: Set<number>;
  dragId: string | null;
  overDay: number | null | "none";
  arrivedDay: number | null;
  toggleDone: (id: string) => void;
  move: (id: string, day: number | undefined, how: MoveHow) => void;
  rename: (id: string, title: string) => void;
  add: (day: number, title: string, project: ProjectId, start?: number) => void;
  toggleExpand: (id: string) => void;
  toggleDay: (day: number) => void;
  dragStart: (id: string, x: number, y: number) => void;
  dragMove: (x: number, y: number) => void;
  dragEnd: (commit: boolean) => void;
  isPhone: () => boolean;
  composerDay: number | null;
  setComposerDay: (day: number | null) => void;
  items: Item[];
};

export const RiverCtx = createContext<RiverApi | null>(null);

export function useRiver() {
  const api = useContext(RiverCtx);
  if (!api) throw new Error("useRiver outside the river");
  return api;
}

/** Parse a drop target attribute: a day number, or "none" for Needs a date. */
export function readDrop(el: Element | null): number | "none" | null {
  const target = el?.closest("[data-drop-day]");
  if (!target) return null;
  const raw = target.getAttribute("data-drop-day");
  if (raw === "none") return "none";
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
