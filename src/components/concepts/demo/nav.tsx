"use client";

/** The demo's places: sidebar items, their G-key letters and page titles. */

import type { ReactNode } from "react";
import type { Surface } from "./links";

export type NavItem = { surface: Surface; label: string; key: string; icon: ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const Icon = ({ children }: { children: ReactNode }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
    {children}
  </svg>
);

export const TOP: readonly NavItem[] = [
  { surface: "home", label: "Home", key: "H", icon: <Icon><path d="M2.5 7.25 8 2.75l5.5 4.5V13a.75.75 0 0 1-.75.75H9.5V10h-3v3.75H3.25A.75.75 0 0 1 2.5 13z" /></Icon> },
  { surface: "overview", label: "Overview", key: "O", icon: <Icon><path d="M1.5 10.5c2-3 3.5-3 5 0s3 3 5 0 2.5-3 3 0" /><path d="M1.5 6c2-3 3.5-3 5 0s3 3 5 0 2.5-3 3 0" /></Icon> },
  { surface: "projects", label: "Projects", key: "P", icon: <Icon><rect x="2" y="2.5" width="5" height="6" rx="1.2" /><rect x="9" y="2.5" width="5" height="6" rx="1.2" /><path d="M2 11.5h12M2 14h8" /></Icon> },
];

export const TASKS: readonly NavItem[] = [
  { surface: "tasks/board", label: "Board", key: "B", icon: <Icon><rect x="2.5" y="2.75" width="4.25" height="10.5" rx="1.2" /><rect x="9.25" y="2.75" width="4.25" height="6.5" rx="1.2" /></Icon> },
  { surface: "tasks/list", label: "List", key: "L", icon: <Icon><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><circle cx="2.75" cy="4" r=".6" fill="currentColor" /><circle cx="2.75" cy="8" r=".6" fill="currentColor" /><circle cx="2.75" cy="12" r=".6" fill="currentColor" /></Icon> },
  { surface: "tasks/calendar", label: "Calendar", key: "C", icon: <Icon><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" /><path d="M2.25 6.5h11.5M5.5 2v2.5M10.5 2v2.5" /></Icon> },
];

export const MORE: readonly NavItem[] = [
  { surface: "files", label: "Files", key: "F", icon: <Icon><path d="M3.5 1.75h5.5l3.5 3.5v9h-9z" /><path d="M9 1.75v3.5h3.5" /></Icon> },
  { surface: "analytics", label: "Analytics", key: "A", icon: <Icon><path d="M2.5 13.5h11" /><path d="M4.5 11V8M8 11V4.5M11.5 11V6.5" /></Icon> },
  { surface: "whiteboard", label: "Whiteboard", key: "W", icon: <Icon><rect x="1.75" y="2.5" width="12.5" height="9" rx="1.5" /><path d="M5 14l3-2.5 3 2.5" /><path d="M4.5 8.5c1.5-2 2.5-2 3.5-.5s2 1.5 3.5-1" /></Icon> },
];

export const NAV_ALL: readonly NavItem[] = [...TOP, ...TASKS, ...MORE];

/**
 * The sidebar's sections, each under a small uppercase label. Destinations and
 * G-key letters are unchanged; only the grouping is named.
 */
export const SECTIONS: readonly { id: string; label: string; items: readonly NavItem[] }[] = [
  { id: "work", label: "Work", items: TOP.filter((item) => item.surface !== "projects") },
  { id: "projects", label: "Projects and tasks", items: [...TOP.filter((item) => item.surface === "projects"), ...TASKS] },
  { id: "more", label: "More", items: MORE },
];

export const TITLES: Record<Surface, { group?: string; title: string }> = {
  home: { title: "Home" },
  overview: { title: "Overview" },
  projects: { title: "Projects" },
  "tasks/board": { group: "Tasks", title: "Board" },
  "tasks/list": { group: "Tasks", title: "List" },
  "tasks/calendar": { group: "Tasks", title: "Calendar" },
  files: { title: "Files" },
  analytics: { title: "Analytics" },
  whiteboard: { title: "Whiteboard" },
};

