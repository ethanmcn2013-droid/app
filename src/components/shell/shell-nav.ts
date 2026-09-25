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
}>;

export const PRIMARY_DESTINATIONS: readonly ShellDestination[] = [
  { id: "home", label: "Home", href: "/app/home", icon: "home", owns: ["/app/home"] },
  { id: "inbox", label: "Inbox", href: "/app/inbox", icon: "inbox", owns: ["/app/inbox"] },
  { id: "my-tasks", label: "My tasks", href: "/app/my-tasks", icon: "myTasks", owns: ["/app/my-tasks", "/app/your-work"] },
];

export const WORKSPACE_DESTINATIONS: readonly ShellDestination[] = [
  { id: "overview", label: "Overview", href: "/app/home/briefing", icon: "pulse", owns: ["/app/home/briefing", "/app/signal"] },
  { id: "projects", label: "Projects", href: "/app/project", icon: "projects", owns: ["/app/project", "/app/archived"] },
  { id: "tasks", label: "Tasks", href: "/app/tasks", icon: "tasks", owns: ["/app/tasks", "/app/task"] },
  { id: "messages", label: "Messages", href: "/app/messages", icon: "messages", owns: ["/app/messages"], requiresMessages: true },
  { id: "timeline", label: "Timeline", href: "/app/timeline", icon: "timeline", owns: ["/app/timeline"] },
  { id: "files", label: "Files", href: "/app/files", icon: "files", owns: ["/app/files"] },
  { id: "analytics", label: "Analytics", href: "/app/analytics", icon: "analytics", owns: ["/app/analytics"] },
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

const ALL = [...PRIMARY_DESTINATIONS, ...WORKSPACE_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS];
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

export type Crumb = Readonly<{ label: string; href?: string }>;

export function crumbsForPath(pathname: string): Crumb[] {
  const id = resolveDestinationId(pathname);
  const destination = ALL.find((entry) => entry.id === id);
  const crumbs: Crumb[] = [{ label: "Signal Studio", href: "/app/home" }];
  if (!destination) return crumbs;
  // Tools sit one level under Apps and tools.
  if (TOOL_DESTINATIONS.includes(destination)) crumbs.push(APPS_AND_TOOLS);
  crumbs.push({ label: destination.label, href: destination.href });
  if (pathname.startsWith("/app/tools/")) {
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
