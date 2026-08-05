"use client";

// The local Tasks navigation panel's visibility, shared between the panel
// itself (studio-bar/projects-sidebar) and the project-context band that
// carries its reopen trigger (hybrid/workspace-brief). Same external-store
// shape as the board's other view preferences: server snapshot is the
// default, hydration never disagrees, storage keeps two tabs together.

import { useCallback, useSyncExternalStore } from "react";

const EXPANDED_KEY = "signal-tasks.nav.expanded";

/** Below this the panel never docks — it opens as a drawer instead. */
export const NAV_DRAWER_QUERY = "(max-width: 1099px)";

/** Cross-panel truce: opening one drawer may need to close the other. */
export const CLOSE_PLANNING_EVENT = "tasks:planning:close";
export const CLOSE_NAV_DRAWER_EVENT = "tasks:nav:close";

let expandedCache: { raw: string | null; value: boolean } = { raw: null, value: true };

function readExpanded(): boolean {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(EXPANDED_KEY);
  } catch {
    /* private mode — the panel simply stays visible */
  }
  if (raw !== expandedCache.raw) expandedCache = { raw, value: raw !== "collapsed" };
  return expandedCache.value;
}

let drawerOpen = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === EXPANDED_KEY) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeExpanded(value: boolean) {
  try {
    window.localStorage.setItem(EXPANDED_KEY, value ? "expanded" : "collapsed");
  } catch {
    expandedCache = { raw: expandedCache.raw, value };
  }
  notify();
}

export function collapseNavPanel(): void {
  writeExpanded(false);
}

export function openNavDrawer(): void {
  drawerOpen = true;
  // One overlay at a time on a phone: the planning drawer yields.
  if (window.matchMedia("(max-width: 767px)").matches) {
    window.dispatchEvent(new CustomEvent(CLOSE_PLANNING_EVENT));
  }
  notify();
}

export function closeNavDrawer(): void {
  if (!drawerOpen) return;
  drawerOpen = false;
  notify();
}

/** The band trigger's one verb: dock the panel where it can dock,
 *  open the drawer where it cannot. */
export function requestOpenNav(): void {
  if (window.matchMedia(NAV_DRAWER_QUERY).matches) openNavDrawer();
  else writeExpanded(true);
}

export function useTasksNav(): { expanded: boolean; drawerOpen: boolean } {
  const expanded = useSyncExternalStore(subscribe, readExpanded, () => true);
  const drawer = useSyncExternalStore(subscribe, () => drawerOpen, () => false);
  return { expanded, drawerOpen: drawer };
}

/** Whether the docked panel is currently hidden (collapsed or drawer-mode)
 *  — i.e. whether the band should offer the reopen trigger. */
export function useNavPanelHidden(): boolean {
  const { expanded } = useTasksNav();
  const drawerMode = useSyncExternalStore(
    useCallback((listener: () => void) => {
      const media = window.matchMedia(NAV_DRAWER_QUERY);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }, []),
    () => window.matchMedia(NAV_DRAWER_QUERY).matches,
    () => false,
  );
  return drawerMode || !expanded;
}
