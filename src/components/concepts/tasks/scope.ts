"use client";

/**
 * What the Tasks views are looking at, kept in the address so Board, List and
 * Calendar agree and a link can open any of them already narrowed:
 *
 *   ?project=mara-finn   one project (the scope pill)
 *   ?owner=orla          one person's tasks (a face, or "Orla's tasks")
 *   ?task=mf-33          one task, open in the view
 *   ?new=1               open New task with the cursor in its title, once
 *
 * Changes replace the address without a navigation, so nothing reloads.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { TEAM, type DemoState, type ProjectId, type Scope, type TeamPersonId } from "../demo/store";
import { useDemoStore } from "../demo/store/client";
import { isActiveProject, syncLiveState } from "./projects";

const EVENT = "tasks-scope";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const read = () => window.location.search;

const wholeState = (s: DemoState) => s;

export type TaskScope = {
  project?: ProjectId;
  owner?: TeamPersonId;
  task?: string;
  /** `?new=1`: New task was asked for from somewhere else. */
  fresh?: boolean;
};

/** The keys a view can set in the address. `new` is only ever removed. */
type ScopePatch = Partial<Record<"project" | "owner" | "task" | "new", string | undefined>>;

export function parseScope(search: string): TaskScope {
  const q = new URLSearchParams(search);
  const p = q.get("project");
  const o = q.get("owner");
  const t = q.get("task");
  // Checked against the live projects, so one made this session is a valid scope and a wrapped one is not.
  const project = isActiveProject(p) ? (p as ProjectId) : undefined;
  const owner = o && (TEAM as readonly string[]).includes(o) ? (o as TeamPersonId) : undefined;
  return { project, owner, task: t || undefined, fresh: q.get("new") === "1" || undefined };
}

/** Change the scope in place. `undefined` removes a key. */
export function setScope(patch: ScopePatch) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  if (url.href === window.location.href) return;
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(EVENT));
}

export function useTaskScope() {
  const search = useSyncExternalStore(subscribe, read, () => "");
  // Hand the live projects to the non-React lookups before anything below renders.
  const state = useDemoStore(wholeState);
  syncLiveState(state);
  const projects = state.projects;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the address when the projects change
  const scope = useMemo(() => parseScope(search), [search, projects]);
  const set = useCallback((patch: ScopePatch) => setScope(patch), []);
  return { ...scope, set };
}

/** The store's scope for selectors: one project and one owner, or everything. */
export function storeScope(scope: TaskScope): Scope | undefined {
  if (!scope.project && !scope.owner) return undefined;
  return { project: scope.project, owner: scope.owner };
}

/** A selector-friendly test, for views that filter their own lists. */
export function inTaskScope(scope: TaskScope) {
  // A wrapped project's tasks drop out of the views, as they do from the workspace counts.
  return (t: DemoState["tasks"][number]) => (!scope.project || t.project === scope.project) && (!scope.owner || t.owner === scope.owner) && isActiveProject(t.project);
}
