"use client";

/**
 * Per-device display preferences for Tasks.
 *
 * Each preference is a localStorage key read through useSyncExternalStore:
 * the server snapshot is the default, the client read lands after hydration
 * without a setState-in-effect, and the storage event keeps two tabs in
 * step. Storage can be missing or throw (private windows, previews), so every
 * read and write is guarded and the default always renders.
 */

import { useCallback, useSyncExternalStore } from "react";

type Pref<T> = {
  use: () => readonly [T, (next: T) => void];
  read: () => T;
};

function createPref<T extends string>(key: string, allowed: readonly T[], fallback: T): Pref<T> {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } = { raw: null, value: fallback };
  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      /* storage unavailable: the cached value stands */
      return cache.value;
    }
    if (raw !== cache.raw) {
      cache = { raw, value: raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback };
    }
    return cache.value;
  };
  const subscribe = (listener: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) listener();
    };
    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
  const write = (next: T) => {
    try {
      window.localStorage.setItem(key, next);
    } catch {
      cache = { raw: cache.raw, value: next };
    }
    listeners.forEach((notify) => notify());
  };
  return {
    read,
    use: () => {
      const value = useSyncExternalStore(subscribe, read, () => fallback);
      const set = useCallback((next: T) => write(next), []);
      return [value, set] as const;
    },
  };
}

export type DoneMode = "compact" | "full" | "collapsed";
export type ListGroup = "status" | "assignee" | "priority" | "due" | "none";
export type OnOff = "on" | "off";
export type CalendarMode = "month" | "week" | "agenda";
/** "auto" shows the tray only when the calendar has the room (see calendar-view). */
export type TrayPref = "auto" | "shown" | "hidden";

const doneMode = createPref<DoneMode>("signal-tasks.v3.done-mode", ["compact", "full", "collapsed"], "compact");
const taskNumbers = createPref<OnOff>("signal-tasks.v3.task-numbers", ["on", "off"], "off");
const listGroup = createPref<ListGroup>("signal-tasks.v3.list-group", ["status", "assignee", "priority", "due", "none"], "status");
const weekends = createPref<OnOff>("signal-tasks.v3.calendar-weekends", ["on", "off"], "on");
const calendarDone = createPref<OnOff>("signal-tasks.v3.calendar-done", ["on", "off"], "on");
const calendarTray = createPref<TrayPref>("signal-tasks.v3.calendar-tray", ["auto", "shown", "hidden"], "auto");
const firstRunHint = createPref<OnOff>("signal-tasks.v3.first-run-hint", ["on", "off"], "on");

export const useDoneMode = doneMode.use;
export const useTaskNumbers = taskNumbers.use;
export const useListGroup = listGroup.use;
export const useCalendarWeekends = weekends.use;
export const useCalendarDone = calendarDone.use;
export const useFirstRunHint = firstRunHint.use;
export const useCalendarTray = calendarTray.use;

/** Visible optional list columns, comma separated; raw storage read. */
const LIST_COLUMN_KEY = "signal-tasks.v3.list-columns";
const listColumnListeners = new Set<() => void>();
// `undefined` means "never read": the first client read with no stored key
// must compute the default ("labels"), matching the server snapshot, rather
// than short-circuit on null === null and hide the column after hydration.
let listColumnCache: { raw: string | null | undefined; value: string } = { raw: undefined, value: "labels" };
export function readListColumns(): string {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LIST_COLUMN_KEY);
  } catch {
    return listColumnCache.value;
  }
  if (raw !== listColumnCache.raw) listColumnCache = { raw, value: raw ?? "labels" };
  return listColumnCache.value;
}
function subscribeListColumns(listener: () => void) {
  listColumnListeners.add(listener);
  return () => listColumnListeners.delete(listener);
}
export function useListColumns(): readonly [string[], (next: string[]) => void] {
  const raw = useSyncExternalStore(subscribeListColumns, readListColumns, () => "labels");
  const set = useCallback((next: string[]) => {
    const value = next.join(",");
    try {
      window.localStorage.setItem(LIST_COLUMN_KEY, value);
    } catch {
      listColumnCache = { raw: listColumnCache.raw, value };
    }
    listColumnListeners.forEach((notify) => notify());
  }, []);
  return [raw ? raw.split(",").filter(Boolean) : [], set] as const;
}

/**
 * Collapsed board columns, persisted per device. Same key the retired board
 * used, so a column someone folded stays folded across the redesign.
 */
const COLLAPSE_KEY = "signal-tasks.board.collapsed";
const collapsedListeners = new Set<() => void>();
const EMPTY: Readonly<Record<string, boolean>> = Object.freeze({});
let collapsedCache: { raw: string | null; value: Readonly<Record<string, boolean>> } = { raw: null, value: EMPTY };
function readCollapsed(): Readonly<Record<string, boolean>> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COLLAPSE_KEY);
  } catch {
    return collapsedCache.value;
  }
  if (raw !== collapsedCache.raw) {
    let value: Record<string, boolean> = {};
    try {
      const parsed = raw ? (JSON.parse(raw) as unknown) : {};
      if (parsed && typeof parsed === "object") {
        value = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => v === true)) as Record<string, boolean>;
      }
    } catch {
      value = {};
    }
    collapsedCache = { raw, value };
  }
  return collapsedCache.value;
}
function subscribeCollapsed(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === COLLAPSE_KEY) listener();
  };
  collapsedListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    collapsedListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
export function useCollapsedLanes(): readonly [Readonly<Record<string, boolean>>, (key: string) => void] {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => EMPTY);
  const toggle = useCallback((key: string) => {
    const current = readCollapsed();
    const next: Record<string, boolean> = { ...current };
    if (next[key]) delete next[key];
    else next[key] = true;
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, raw);
    } catch {
      collapsedCache = { raw: collapsedCache.raw, value: next };
    }
    collapsedListeners.forEach((notify) => notify());
  }, []);
  return [collapsed, toggle] as const;
}
