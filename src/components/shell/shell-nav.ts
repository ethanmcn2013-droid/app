/**
 * The v3 sidebar's destinations and the top bar's breadcrumb, in one place.
 * Pure: no React, so the order and the path ownership can be tested directly.
 */
import type { ShellIconName } from "./shell-icons";
import { LAUNCHER_NAME, toolBySlug } from "./launcher/launcher-catalog";
import { AUTOMATIONS_APP_PATH, AUTOMATIONS_LABEL } from "@/lib/product-urls";

export type ShellDestination = Readonly<{
  id: string;
  label: string;
  href: string;
  icon: ShellIconName;
  /** Paths this destination owns for the active state and the breadcrumb. */
  owns: readonly string[];
  /** Only shown when the viewer can use Messages. */
  requiresMessages?: boolean;
  /** Not built yet: the row carries a quiet "Soon" tag. */
  soon?: boolean;
  /** Built to try, not yet running for real: the row carries "Preview". */
  preview?: boolean;
}>;

/**
 * The sidebar, top to bottom: Home, Analytics, Files; the Workspace trio;
 * actual Projects; then More. Overview is a tab of Home, so Home owns its
 * paths and there is no Overview row.
 */
export const HOME_DESTINATION: ShellDestination = {
  id: "home",
  label: "Home",
  href: "/app/home",
  icon: "home",
  owns: ["/app/home", "/app/signal"],
};

const ANALYTICS_DESTINATION: ShellDestination = {
  id: "analytics", label: "Analytics", href: "/app/analytics", icon: "analytics", owns: ["/app/analytics"],
};

const FILES_DESTINATION: ShellDestination = {
  id: "files", label: "Files", href: "/app/files", icon: "files", owns: ["/app/files"],
};

export const PRIMARY_DESTINATIONS: readonly ShellDestination[] = [HOME_DESTINATION, ANALYTICS_DESTINATION, FILES_DESTINATION];

export const WORKSPACE_DESTINATIONS: readonly ShellDestination[] = [
  { id: "projects", label: "Projects", href: "/app/project", icon: "projects", owns: ["/app/project", "/app/archived"] },
  { id: "tasks", label: "Tasks", href: "/app/tasks", icon: "tasks", owns: ["/app/tasks", "/app/task"] },
  { id: "timeline", label: "Timeline", href: "/app/timeline", icon: "timeline", owns: ["/app/timeline"] },
];

const AUTOMATIONS_DESTINATION: ShellDestination = {
  id: "automations", label: AUTOMATIONS_LABEL, href: AUTOMATIONS_APP_PATH, icon: "automations", owns: [AUTOMATIONS_APP_PATH], preview: true,
};

function toolDestination(slug: "wedding-planner" | "teacher-toolkit" | "student-hub" | "whiteboard" | "process-map" | "docs" | "forms"): ShellDestination {
  const tool = toolBySlug(slug)!;
  const id = slug === "wedding-planner" ? "wedding-hub" : slug === "teacher-toolkit" ? "teacher-hub" : slug;
  const icon: ShellDestination["icon"] = slug === "whiteboard" ? "whiteboard" : slug === "docs" ? "files" : slug === "forms" ? "tasks" : slug === "process-map" ? "timeline" : "projects";
  return { id, label: tool.name, href: `/app/tools/${slug}`, icon, owns: [`/app/tools/${slug}`], soon: slug !== "wedding-planner" };
}

const WEDDING_HUB_DESTINATION = toolDestination("wedding-planner");
const TEACHER_HUB_DESTINATION = toolDestination("teacher-toolkit");
const WHITEBOARD_DESTINATION = toolDestination("whiteboard");
const STUDENT_HUB_DESTINATION = toolDestination("student-hub");
const PROCESS_MAP_DESTINATION = toolDestination("process-map");
const DOCS_DESTINATION = toolDestination("docs");
const FORMS_DESTINATION = toolDestination("forms");

/** Every More link, including optional entries, keeps an active path and crumb. */
export const MORE_DESTINATIONS: readonly ShellDestination[] = [
  AUTOMATIONS_DESTINATION,
  WHITEBOARD_DESTINATION,
  WEDDING_HUB_DESTINATION,
  TEACHER_HUB_DESTINATION,
  STUDENT_HUB_DESTINATION,
  PROCESS_MAP_DESTINATION,
  DOCS_DESTINATION,
  FORMS_DESTINATION,
];

/** Stable parent and link ids used by the browser-saved More preferences. */
export const MORE_CUSTOMIZATION_ITEMS: readonly Readonly<{ id: string; label: string; defaultVisible?: boolean; soon?: boolean }>[] = [
  { id: "development", label: "Development" },
  { id: "automations", label: AUTOMATIONS_LABEL },
  { id: "wedding-hub", label: "Wedding hub" },
  { id: "wedding-guest-list", label: "Guest list" },
  { id: "wedding-seating", label: "Seating", soon: true },
  { id: "wedding-budget", label: "Budget", soon: true },
  { id: "teacher-hub", label: "Teacher hub" },
  { id: "whiteboard", label: "Whiteboard", soon: true },
  { id: "teacher-lessons", label: "Lessons", soon: true },
  { id: "teacher-marking", label: "Marking", soon: true },
  { id: "teacher-share-plan", label: "Share a plan", soon: true },
  { id: "student-hub", label: "Student hub" },
  { id: "student-deadlines", label: "Deadlines", soon: true },
  { id: "student-group-work", label: "Group work", soon: true },
  { id: "student-lecture-notes", label: "Lecture notes", soon: true },
  { id: "notes", label: "Notes", defaultVisible: false },
  { id: "process-map", label: "Process map", defaultVisible: false, soon: true },
  { id: "docs", label: "Docs", defaultVisible: false, soon: true },
  { id: "forms", label: "Forms", defaultVisible: false, soon: true },
];

export type MoreNavigationEntry = Readonly<{
  id: string;
  label: string;
  destination?: ShellDestination;
  soon?: boolean;
  children?: readonly MoreNavigationEntry[];
}>;
export type MoreNavigationGroup = Readonly<{ id: string; label: string; entries: readonly MoreNavigationEntry[] }>;

const WEDDING_GUEST_LIST_DESTINATION: ShellDestination = {
  id: "wedding-guest-list", label: "Guest list", href: WEDDING_HUB_DESTINATION.href, icon: "projects", owns: [],
};

/** Tools stay under the kind of work they help with; this is sidebar grouping, not new products. */
export const MORE_NAVIGATION_GROUPS: readonly MoreNavigationGroup[] = [
  { id: "development", label: "Development", entries: [{ id: "automations", label: AUTOMATIONS_DESTINATION.label, destination: AUTOMATIONS_DESTINATION }] },
  { id: "wedding-hub", label: "", entries: [{
    id: "wedding-hub", label: WEDDING_HUB_DESTINATION.label, destination: WEDDING_HUB_DESTINATION, children: [
      { id: "wedding-guest-list", label: "Guest list", destination: WEDDING_GUEST_LIST_DESTINATION },
      { id: "wedding-seating", label: "Seating", soon: true },
      { id: "wedding-budget", label: "Budget", soon: true },
    ],
  }] },
  { id: "teacher-hub", label: "", entries: [{
    id: "teacher-hub", label: TEACHER_HUB_DESTINATION.label, destination: TEACHER_HUB_DESTINATION, children: [
      { id: "whiteboard", label: WHITEBOARD_DESTINATION.label, destination: WHITEBOARD_DESTINATION, soon: true },
      { id: "teacher-lessons", label: "Lessons", soon: true },
      { id: "teacher-marking", label: "Marking", soon: true },
      { id: "teacher-share-plan", label: "Share a plan", soon: true },
    ],
  }] },
  { id: "student-hub", label: "", entries: [{
    id: "student-hub", label: STUDENT_HUB_DESTINATION.label, destination: STUDENT_HUB_DESTINATION, children: [
      { id: "student-deadlines", label: "Deadlines", soon: true },
      { id: "student-group-work", label: "Group work", soon: true },
      { id: "student-lecture-notes", label: "Lecture notes", soon: true },
    ],
  }] },
  { id: "other-tools", label: "Other tools", entries: [
    { id: "notes", label: "Notes", destination: { id: "notes", label: "Notes", href: "/app/notes", icon: "notes", owns: ["/app/notes"] } },
    { id: "process-map", label: PROCESS_MAP_DESTINATION.label, destination: PROCESS_MAP_DESTINATION },
    { id: "docs", label: DOCS_DESTINATION.label, destination: DOCS_DESTINATION },
    { id: "forms", label: FORMS_DESTINATION.label, destination: FORMS_DESTINATION },
  ] },
];

/** Apply browser customization without changing routes or saved child choices. */
export function visibleMoreNavigationGroups(hidden: ReadonlySet<string>): MoreNavigationGroup[] {
  return MORE_NAVIGATION_GROUPS.flatMap((group) => {
    if (hidden.has(group.id)) return [];
    const entries = group.entries.flatMap((entry) => {
      if (hidden.has(entry.id)) return [];
      const children = entry.children?.filter((child) => !hidden.has(child.id));
      return [{ ...entry, ...(entry.children ? { children } : {}) }];
    });
    return entries.length > 0 ? [{ ...group, entries }] : [];
  });
}

/** The named groups, in order. Every group can be folded from its heading. */
export const SIDEBAR_GROUPS = [
  { id: "workspace", label: "Workspace", folds: true },
  { id: "projects", label: "Projects", folds: true },
  { id: "more", label: "More", folds: true },
  { id: "chat", label: "Chat", folds: true },
] as const;

/**
 * Places with no sidebar row of their own. They still own their paths, so the
 * breadcrumb resolves. Inbox is the top bar's bell; My tasks is in Search or
 * jump to; Chat is the sidebar's Chat group; Apps and tools is the top bar's
 * launcher.
 */
export const UTILITY_DESTINATIONS: readonly ShellDestination[] = [
  { id: "inbox", label: "Inbox", href: "/app/inbox", icon: "inbox", owns: ["/app/inbox"] },
  { id: "my-tasks", label: "My tasks", href: "/app/my-tasks", icon: "myTasks", owns: ["/app/my-tasks", "/app/your-work"] },
  { id: "messages", label: "Chat", href: "/app/messages", icon: "messages", owns: ["/app/messages"], requiresMessages: true },
  // The label is a literal so the contract can read it; launcher-catalog.test.ts
  // holds it equal to LAUNCHER_NAME.
  { id: "tools", label: "Apps and tools", href: "/app/tools", icon: "apps", owns: ["/app/tools"] },
];

/**
 * Places reached through Apps and tools, not listed in the sidebar. They still
 * own their paths, so the breadcrumb and the active state resolve.
 */
export const TOOL_DESTINATIONS: readonly ShellDestination[] = [
  { id: "notes", label: "Notes", href: "/app/notes", icon: "notes", owns: ["/app/notes"] },
];

/**
 * Wedding tools (12 Oct 2026): nested under the open Project's row when that
 * Project is a wedding, never a group of their own. Only the guest list is
 * built; Seating and Budget say they are coming and go nowhere.
 */
export const WEDDING_DESTINATIONS: readonly ShellDestination[] = [
  { id: "wedding-guests", label: "Guest list", href: "/app/wedding/guests", icon: "projects", owns: ["/app/wedding/guests"] },
  { id: "wedding-seating", label: "Seating", href: "/app/wedding/seating", icon: "projects", owns: ["/app/wedding/seating"], soon: true },
  { id: "wedding-budget", label: "Budget", href: "/app/wedding/budget", icon: "projects", owns: ["/app/wedding/budget"], soon: true },
];

export const FOOTER_DESTINATIONS: readonly ShellDestination[] = [
  { id: "settings", label: "Settings", href: "/app/settings", icon: "settings", owns: ["/app/settings", "/app/import"] },
];

const ALL = [...PRIMARY_DESTINATIONS, ...WORKSPACE_DESTINATIONS, ...MORE_DESTINATIONS, ...UTILITY_DESTINATIONS, ...TOOL_DESTINATIONS, ...WEDDING_DESTINATIONS, ...FOOTER_DESTINATIONS];
const APPS_AND_TOOLS: Crumb = { label: LAUNCHER_NAME, href: "/app/tools" };

function ownsPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The single destination a path belongs to; the most specific prefix wins. */
function resolveDestinationId(pathname: string): string | null {
  let best: { id: string; length: number } | null = null;
  for (const destination of ALL) {
    for (const prefix of destination.owns) {
      if (ownsPath(pathname, prefix) && (!best || prefix.length > best.length)) {
        best = { id: destination.id, length: prefix.length };
      }
    }
  }
  return best?.id ?? null;
}

const TOOL_IDS = new Set(TOOL_DESTINATIONS.map((destination) => destination.id));

/**
 * The sidebar row that lights up for a path. Overview is a tab of Home, so
 * Home lights for it. A tool reached through Apps and tools (Notes today)
 * resolves to "tools", which has no row: the breadcrumb says where you are.
 */
export function activeDestinationId(pathname: string): string | null {
  const id = resolveDestinationId(pathname);
  return id && TOOL_IDS.has(id) ? "tools" : id;
}

/** Whether a path is one of Home's tabs' second page. */
function isOverviewPath(pathname: string): boolean {
  return ownsPath(pathname, "/app/home/briefing") || ownsPath(pathname, "/app/signal");
}

/* ── Fold memory ────────────────────────────────────────────────────
   The sidebar keeps one list per browser: a group is listed by its id once
   someone folds it, so an empty list means "as designed" (everything open).
   Ids that no longer name a group (the old "open:initial-setup") are
   ignored. */

/** The entry a group writes to the list when it is folded. */
export function sectionStoreKey(id: string): string {
  return id;
}

/** Whether a group is open, given the stored list. */
export function sectionIsOpen(stored: ReadonlySet<string>, id: string): boolean {
  return !stored.has(id);
}

export type Crumb = Readonly<{ label: string; href?: string }>;

export function crumbsForPath(pathname: string): Crumb[] {
  const id = resolveDestinationId(pathname);
  const destination = ALL.find((entry) => entry.id === id);
  const crumbs: Crumb[] = [{ label: "Signal Studio", href: "/app/home" }];
  if (!destination) return crumbs;
  // Tools sit one level under Apps and tools.
  if (TOOL_DESTINATIONS.includes(destination)) crumbs.push(APPS_AND_TOOLS);
  if (WEDDING_DESTINATIONS.includes(destination)) crumbs.push({ label: "Wedding tools" });
  crumbs.push({ label: destination.label, href: destination.href });
  if (destination.id === "home" && isOverviewPath(pathname)) crumbs.push({ label: "Overview" });
  if (destination.id === "automations" && pathname !== AUTOMATIONS_APP_PATH) crumbs.push({ label: "Draft" });
  if (destination.id === "tools" && pathname.startsWith("/app/tools/")) {
    const tool = toolBySlug(pathname.slice("/app/tools/".length).split("/")[0] ?? "");
    if (tool) crumbs.push({ label: tool.name });
  }
  if (pathname === "/app/archived") crumbs.push({ label: "Archive" });
  if (pathname === "/app/import") crumbs.push({ label: "Import" });
  if (pathname.startsWith("/app/task/")) crumbs.push({ label: "Task" });
  if (pathname.startsWith("/app/timeline/") && pathname !== "/app/timeline") {
    const rest = pathname.slice("/app/timeline/".length).split("/")[0] ?? "";
    crumbs.push({ label: rest === "audience" ? "Shared timelines" : "Plan" });
  }
  return crumbs;
}
