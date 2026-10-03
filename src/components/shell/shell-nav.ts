/**
 * The v3 sidebar's destinations and the top bar's breadcrumb, in one place.
 * Pure: no React, so the order and the path ownership can be tested directly.
 */
import type { ShellIconName } from "./shell-icons";
import { LAUNCHER_NAME, toolBySlug } from "./launcher/launcher-catalog";

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
}>;

/**
 * The sidebar's top level, in the approved order (2 Oct 2026): the same
 * eight places the design demo and the marketing header name. Whiteboard
 * opens its existing "Coming soon" page.
 */
export const TOP_LEVEL_DESTINATIONS: readonly ShellDestination[] = [
  { id: "home", label: "Home", href: "/app/home", icon: "home", owns: ["/app/home"] },
  { id: "overview", label: "Overview", href: "/app/home/briefing", icon: "pulse", owns: ["/app/home/briefing", "/app/signal"] },
  { id: "projects", label: "Projects", href: "/app/project", icon: "projects", owns: ["/app/project", "/app/archived"] },
  { id: "tasks", label: "Tasks", href: "/app/tasks", icon: "tasks", owns: ["/app/tasks", "/app/task"] },
  { id: "timeline", label: "Timeline", href: "/app/timeline", icon: "timeline", owns: ["/app/timeline"] },
  { id: "files", label: "Files", href: "/app/files", icon: "files", owns: ["/app/files"] },
  { id: "analytics", label: "Analytics", href: "/app/analytics", icon: "analytics", owns: ["/app/analytics"] },
  { id: "whiteboard", label: "Whiteboard", href: "/app/tools/whiteboard", icon: "whiteboard", owns: ["/app/tools/whiteboard"], soon: true },
];

/**
 * Founder instruction (2 Oct 2026): everything else the sidebar had stays,
 * nested under one group to review, so nothing is removed outright. These
 * are the group's own rows; the Projects list, Channels and Direct messages
 * sit inside the same group in the sidebar.
 */
export const INITIAL_SETUP = { id: "initial-setup", label: "Initial setup" } as const;

export const INITIAL_SETUP_DESTINATIONS: readonly ShellDestination[] = [
  { id: "inbox", label: "Inbox", href: "/app/inbox", icon: "inbox", owns: ["/app/inbox"] },
  { id: "my-tasks", label: "My tasks", href: "/app/my-tasks", icon: "myTasks", owns: ["/app/my-tasks", "/app/your-work"] },
  { id: "messages", label: "Chat", href: "/app/messages", icon: "messages", owns: ["/app/messages"], requiresMessages: true },
  // Everything else lives behind one row and the top bar's launcher. The
  // label is a literal so the contract can read it; launcher-catalog.test.ts
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

const ALL = [...TOP_LEVEL_DESTINATIONS, ...INITIAL_SETUP_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS];
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
 * The sidebar row that lights up for a path. A tool reached through Apps and
 * tools (Notes today) has no row of its own, so its parent row carries the
 * active state, which is what the breadcrumb says too.
 */
export function activeDestinationId(pathname: string): string | null {
  const id = resolveDestinationId(pathname);
  return id && TOOL_IDS.has(id) ? "tools" : id;
}

const INITIAL_SETUP_IDS = new Set(INITIAL_SETUP_DESTINATIONS.map((destination) => destination.id));

/**
 * True when the page you are on is one of the group's rows (Chat's channels
 * and direct messages are Chat's paths), so the group opens by itself.
 */
export function isInsideInitialSetup(pathname: string): boolean {
  const id = activeDestinationId(pathname);
  return id !== null && INITIAL_SETUP_IDS.has(id);
}

/* ── Fold memory ────────────────────────────────────────────────────
   The sidebar keeps one list per browser. A section that starts open is
   listed by its id once someone folds it. A section that starts folded
   (Initial setup) is listed as "open:<id>" once someone opens it, so an
   empty list means "as designed" for both kinds. */

const STARTS_FOLDED: ReadonlySet<string> = new Set([INITIAL_SETUP.id]);

/** The entry a section writes to the list when it leaves its starting state. */
export function sectionStoreKey(id: string): string {
  return STARTS_FOLDED.has(id) ? `open:${id}` : id;
}

/** Whether a section is open, given the stored list. */
export function sectionIsOpen(stored: ReadonlySet<string>, id: string): boolean {
  return STARTS_FOLDED.has(id) ? stored.has(sectionStoreKey(id)) : !stored.has(id);
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
