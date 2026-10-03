import type { ComponentType } from "react";
import type { Surface } from "./links";
import { projectById } from "./store";

/**
 * The integrated demo: every chosen design from the 30 September 2026 review,
 * one per surface, plus Home as the front door. Merged surfaces live in
 * ../final.
 */
export type SurfaceEntry = {
  surface: Surface;
  /** Sidebar label. */
  label: string;
  /** Page title in the browser tab. */
  title: string;
  /** Sub-views a surface understands; "any" lets the surface read the segment itself (a project id). */
  subs?: readonly string[] | "any";
  /** Tab titles for sub-views. */
  subTitles?: Record<string, string>;
  load: () => Promise<{ default: ComponentType<{ sub?: string }> }>;
};

export const SURFACES: readonly SurfaceEntry[] = [
  { surface: "home", label: "Home", title: "Home", load: () => import("./home") },
  { surface: "overview", label: "Overview", title: "Overview", load: () => import("../overview/c2") },
  { surface: "projects", label: "Projects", title: "Projects", subs: "any", subTitles: { ledger: "Projects list", covers: "Projects covers" }, load: () => import("../final/projects") },
  { surface: "tasks/board", label: "Board", title: "Tasks board", load: () => import("../board/c1") },
  { surface: "tasks/list", label: "List", title: "Tasks list", load: () => import("../final/tasks-list") },
  { surface: "tasks/calendar", label: "Calendar", title: "Tasks calendar", load: () => import("../calendar/c2") },
  { surface: "files", label: "Files", title: "Files", load: () => import("../files/c5") },
  {
    surface: "analytics",
    label: "Analytics",
    title: "Analytics",
    subs: ["ask", "all-projects", "replay"],
    subTitles: { "all-projects": "Analytics, all projects", replay: "Analytics, replay" },
    load: () => import("../final/analytics"),
  },
  { surface: "whiteboard", label: "Whiteboard", title: "Whiteboard", load: () => import("../whiteboard/c1") },
];

/** Resolve a /demo path (segments after /demo) to a surface and sub-view. */
export function resolveSurface(path: readonly string[]): { entry: SurfaceEntry; sub?: string } | null {
  if (path.length === 0) return { entry: SURFACES[0] };
  const joined = path.join("/");
  // Longest match first so "tasks/board" wins over a bare "tasks".
  const byLength = [...SURFACES].filter((s) => s.surface !== "home").sort((a, b) => b.surface.length - a.surface.length);
  for (const entry of byLength) {
    if (joined === entry.surface) return { entry };
    if (joined.startsWith(`${entry.surface}/`)) {
      const sub = joined.slice(entry.surface.length + 1);
      if (sub.includes("/")) return null;
      if (entry.subs === "any" || entry.subs?.includes(sub)) return { entry, sub };
      return null;
    }
  }
  if (joined === "tasks") return { entry: SURFACES.find((s) => s.surface === "tasks/board")! };
  return null;
}

export function surfaceTitle(entry: SurfaceEntry, sub?: string) {
  // A project's home is titled by the project.
  const project = entry.surface === "projects" && sub ? projectById(sub) : undefined;
  return project?.name ?? ((sub && entry.subTitles?.[sub]) || entry.title);
}
