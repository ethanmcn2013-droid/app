"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getDemoState, undo, updateTask, useDemoStore } from "../../demo/store/client";
import type { DemoState, Task as StoreTask } from "../../demo/store";
import type { ViewId } from "./model";
import { buildProjects, type Project } from "./data";

/*
 * Projects keep no edits of their own. Every project edit (health with a
 * reason, lead, date, milestones, updates, wrap up, a new project) and every
 * task tick goes through the demo store's mutations, so Home, Overview, Tasks
 * and Analytics see it, and the store's one undo stack takes it back.
 *
 * What lives here is view state only: which view both lenses show, and which
 * project this tab opened last (for "Recently opened").
 */

/* ── Tiny external store for view state ─────────────────────────────── */

function cell<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const l of listeners) l();
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

const EMPTY_OPENED: Readonly<Record<string, number>> = {};
const opened = cell<Readonly<Record<string, number>>>(EMPTY_OPENED);
const view = cell<ViewId>("active");

const wholeState = (s: DemoState) => s;

/** Every project, read from the live store. */
export function useProjects(): Project[] {
  const state = useDemoStore(wholeState);
  const o = useSyncExternalStore(opened.subscribe, opened.get, () => EMPTY_OPENED);
  return useMemo(() => buildProjects(state, o), [state, o]);
}

let openSeq = 0;
export function markOpened(id: string) {
  opened.set({ ...opened.get(), [id]: ++openSeq });
}

export function setSharedView(next: ViewId) {
  view.set(next);
}

export function useSharedView(): ViewId {
  return useSyncExternalStore(view.subscribe, view.get, () => "active" as ViewId);
}

/* ── Store edits, counted so one toast can take them all back ───────── */

/**
 * Run one store mutation per item and return an undo for exactly the steps
 * they made: a bulk edit over three projects is three steps on the store's
 * stack. `count` is 0 when the store refused or nothing changed.
 */
export function eachStep<T>(items: readonly T[], run: (item: T) => void) {
  let count = 0;
  for (const item of items) {
    const before = getDemoState();
    run(item);
    if (getDemoState() !== before) count += 1;
  }
  return {
    count,
    undo: () => {
      for (let i = 0; i < count; i++) undo();
    },
  };
}

/* ── Task ticks ─────────────────────────────────────────────────────── */

/** What a task was before this page ticked it, so unticking puts it back exactly. */
const before = new Map<string, Pick<StoreTask, "status" | "since" | "waitingOn">>();

export function toggleTask(taskId: string) {
  const t = getDemoState().tasks.find((x) => x.id === taskId);
  if (!t) return;
  if (t.status === "done") {
    const was = before.get(taskId);
    before.delete(taskId);
    updateTask(taskId, was ? { status: was.status, since: was.since, ...(was.waitingOn ? { waitingOn: was.waitingOn } : {}) } : { status: "todo" });
  } else {
    before.set(taskId, { status: t.status, since: t.since, waitingOn: t.waitingOn });
    updateTask(taskId, { status: "done" });
  }
}
