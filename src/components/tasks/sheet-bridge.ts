"use client";

/**
 * The bridge between the Tasks surface and the globally mounted task sheet.
 *
 * The sheet (src/components/app/detail-panel/task-detail-panel.tsx) is
 * mounted once for the whole app so it can open over My tasks, Inbox and
 * Tasks alike. Two things only the Tasks surface knows travel through here:
 *
 * - the dock: at 1280px and wider the surface offers a slot beside the
 *   board, and the sheet renders into it with no backdrop, so the board
 *   stays visible and usable next to the task;
 * - the visible order: up and down in the sheet walk the tasks in the order
 *   the current view shows them, not the raw store order.
 *
 * Both are tiny external stores so either side can mount first.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;

function createCell<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((notify) => notify());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const dock = createCell<HTMLElement | null>(null);
const order = createCell<readonly string[]>([]);

export const setSheetDock = dock.set;
export function useSheetDock(): HTMLElement | null {
  return useSyncExternalStore(dock.subscribe, dock.get, () => null);
}

export const setVisibleTaskOrder = order.set;
export const getVisibleTaskOrder = order.get;

const WIDE_QUERY = "(min-width: 1280px)";
function subscribeWide(listener: Listener) {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
/** True at 1280px and wider, where the sheet docks instead of covering. */
export function useWideSheet(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

/** Emitted by the new-task composer so the surface can offer Open and Undo. */
export const TASK_CREATED_EVENT = "tasks:created";
export type TaskCreatedDetail = { id: string; title: string; columnKey: string; open?: boolean };
