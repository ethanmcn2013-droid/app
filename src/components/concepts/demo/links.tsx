"use client";

/**
 * One map of where everything lives, so the chosen designs link to each
 * other as one product. Inside the integrated demo (/demo) every link stays in
 * the demo; in the concept gallery the same calls fall back to the gallery.
 *
 * Addresses inside the demo:
 *   /demo                         Home
 *   /demo/overview                Overview (a project's river)
 *   /demo/projects[/covers|/ledger]  Projects: the console (?show= a filter), covers or list
 *   /demo/projects/<projectId>    One project's home, opened over the covers
 *   /demo/tasks/<view>?task=<id>  A Tasks view with one task open
 *   /demo/files?q=<question>      Files, asked a question
 *   /demo/analytics[/<lens>]?q=<question>&project=<id>
 *   /demo/whiteboard
 */

import { createContext, useContext, type ReactNode } from "react";

export type Surface =
  | "home"
  | "overview"
  | "projects"
  | "tasks/board"
  | "tasks/list"
  | "tasks/calendar"
  | "files"
  | "analytics"
  | "whiteboard";

/** Where each surface opens in the gallery, outside the demo. */
const GALLERY: Record<Surface, string> = {
  home: "/app/concepts",
  overview: "/app/concepts/overview/2",
  projects: "/app/concepts/projects/2",
  "tasks/board": "/app/concepts/board/1",
  "tasks/list": "/app/concepts/list/3",
  "tasks/calendar": "/app/concepts/calendar/2",
  files: "/app/concepts/files/5",
  analytics: "/app/concepts/analytics/5",
  whiteboard: "/app/concepts/whiteboard/1",
};

export const DEMO_BASE = "/demo";

const DemoContext = createContext(false);

export function DemoLinksProvider({ children }: { children: ReactNode }) {
  return <DemoContext.Provider value>{children}</DemoContext.Provider>;
}

/** True inside the integrated demo. */
export function useInDemo() {
  return useContext(DemoContext);
}

const query = (params?: Record<string, string | undefined>) => {
  if (!params) return "";
  const entries = Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
};

/** Build the href for a surface, with an optional sub-view and query. */
export function surfaceHref(inDemo: boolean, surface: Surface, sub?: string, params?: Record<string, string | undefined>) {
  if (!inDemo) return GALLERY[surface];
  const base = surface === "home" ? DEMO_BASE : `${DEMO_BASE}/${surface}`;
  return `${base}${sub ? `/${sub}` : ""}${query(params)}`;
}

/** One project's home. */
export const projectHref = (inDemo: boolean, projectId: string) => (inDemo ? `${DEMO_BASE}/projects/${projectId}` : GALLERY.projects);

/** One task, open in a Tasks view (the board unless a view is given). */
export const taskHref = (inDemo: boolean, taskId: string, view: "board" | "list" | "calendar" = "board") =>
  inDemo ? `${DEMO_BASE}/tasks/${view}${query({ task: taskId })}` : GALLERY[`tasks/${view}`];

/** Hook form: `const href = useSurfaceHref(); href("projects", "ledger")`. */
export function useSurfaceHref() {
  const inDemo = useInDemo();
  return (surface: Surface, sub?: string, params?: Record<string, string | undefined>) => surfaceHref(inDemo, surface, sub, params);
}

/** Hook form for projects and tasks: `const to = useDemoLinks(); to.project("mara-finn")`. */
export function useDemoLinks() {
  const inDemo = useInDemo();
  return {
    inDemo,
    surface: (surface: Surface, sub?: string, params?: Record<string, string | undefined>) => surfaceHref(inDemo, surface, sub, params),
    project: (projectId: string) => projectHref(inDemo, projectId),
    task: (taskId: string, view?: "board" | "list" | "calendar") => taskHref(inDemo, taskId, view),
  };
}
