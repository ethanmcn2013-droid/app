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
 * The sidebar, top to bottom (founder instruction, 6 Oct 2026): Home on its
 * own, then four named groups with room between them. Overview is a tab of
 * Home, so Home owns its paths and there is no Overview row.
 */
export const HOME_DESTINATION: ShellDestination = {
  id: "home",
  label: "Home",
  href: "/app/home",
  icon: "home",
  owns: ["/app/home", "/app/signal"],
};

export const WORKSPACE_DESTINATIONS: readonly ShellDestination[] = [
  { id: "projects", label: "Projects", href: "/app/project", icon: "projects", owns: ["/app/project", "/app/archived"] },
  { id: "tasks", label: "Tasks", href: "/app/tasks", icon: "tasks", owns: ["/app/tasks", "/app/task"] },
  { id: "timeline", label: "Timeline", href: "/app/timeline", icon: "timeline", owns: ["/app/timeline"] },
  { id: "files", label: "Files", href: "/app/files", icon: "files", owns: ["/app/files"] },
  { id: "analytics", label: "Analytics", href: "/app/analytics", icon: "analytics", owns: ["/app/analytics"] },
];

/** Things you build with. Whiteboard opens its existing "Coming soon" page. */
export const BUILD_DESTINATIONS: readonly ShellDestination[] = [
  { id: "automations", label: AUTOMATIONS_LABEL, href: AUTOMATIONS_APP_PATH, icon: "automations", owns: [AUTOMATIONS_APP_PATH], preview: true },
  { id: "whiteboard", label: "Whiteboard", href: "/app/tools/whiteboard", icon: "whiteboard", owns: ["/app/tools/whiteboard"], soon: true },
];

/** The named groups, in order. Projects and Chat fold; the others are fixed. */
export const SIDEBAR_GROUPS = [
  { id: "workspace", label: "Workspace", folds: false },
  { id: "projects", label: "Projects", folds: true },
  { id: "build", label: "Build", folds: false },
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

export const FOOTER_DESTINATIONS: readonly ShellDestination[] = [
  { id: "settings", label: "Settings", href: "/app/settings", icon: "settings", owns: ["/app/settings", "/app/import"] },
];

const ALL = [HOME_DESTINATION, ...WORKSPACE_DESTINATIONS, ...BUILD_DESTINATIONS, ...UTILITY_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS];
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
