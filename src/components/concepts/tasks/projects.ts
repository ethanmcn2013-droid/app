/**
 * The projects as the demo store has them now, for code that is not a React
 * component: the list's typed cells, the calendar's colours, the new-task
 * grammar. A project made during the session shows up here, a wrapped one
 * drops out of the active list, and names and hues follow the lead's edits.
 *
 * `useTaskScope` (every Tasks view calls it first) hands the live state over
 * on each render, before anything below it reads a project. On the server and
 * while hydrating that state is the canonical world, so markup always matches.
 * Every lookup is guarded: an unknown id gives undefined, never a throw.
 */

import { INITIAL_STATE, activeProjects, projectIn, projectsOf, type DemoState, type Project } from "../demo/store";

let live: DemoState = INITIAL_STATE;

/** Called by `useTaskScope` during render with the store's snapshot. */
export function syncLiveState(s: DemoState): void {
  live = s;
}

export const liveState = (): DemoState => live;

/** Every project, active and wrapped. */
export const liveProjects = (): readonly Project[] => projectsOf(live);

const activeCache = new WeakMap<readonly Project[], Project[]>();
/** The projects that are not wrapped, in the store's order. Stable while the projects do not change. */
export function liveActiveProjects(): Project[] {
  const all = projectsOf(live);
  let list = activeCache.get(all);
  if (!list) {
    list = activeProjects(live);
    activeCache.set(all, list);
  }
  return list;
}

/** One project by id, or undefined when there is no such project. */
export function liveProject(id: string | null | undefined): Project | undefined {
  return id ? projectIn(live, id) : undefined;
}

/** Whether a task can belong to it: it exists and is not wrapped. */
export function isActiveProject(id: string | null | undefined): boolean {
  const p = liveProject(id);
  return !!p && !p.wrapped;
}
