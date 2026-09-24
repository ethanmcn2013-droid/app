/**
 * The v3 sidebar's destinations and the top bar's breadcrumb, in one place.
 * Pure: no React, so the order and the path ownership can be tested directly.
 */
import type { ShellIconName } from "./shell-icons";

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
  { id: "overview", label: "Overview", href: "/app/home/briefing", icon: "overview", owns: ["/app/home/briefing", "/app/signal"] },
  { id: "projects", label: "Projects", href: "/app/project", icon: "projects", owns: ["/app/project", "/app/archived"] },
  { id: "tasks", label: "Tasks", href: "/app/tasks", icon: "tasks", owns: ["/app/tasks", "/app/task"] },
  { id: "notes", label: "Notes", href: "/app/notes", icon: "notes", owns: ["/app/notes"] },
  { id: "messages", label: "Messages", href: "/app/messages", icon: "messages", owns: ["/app/messages"], requiresMessages: true },
  { id: "timeline", label: "Timeline", href: "/app/timeline", icon: "timeline", owns: ["/app/timeline"] },
  { id: "files", label: "Files", href: "/app/files", icon: "files", owns: ["/app/files"] },
  { id: "analytics", label: "Analytics", href: "/app/analytics", icon: "analytics", owns: ["/app/analytics"] },
];

export const FOOTER_DESTINATIONS: readonly ShellDestination[] = [
  { id: "settings", label: "Settings", href: "/app/settings", icon: "settings", owns: ["/app/settings", "/app/import"] },
];

const ALL = [...PRIMARY_DESTINATIONS, ...WORKSPACE_DESTINATIONS, ...FOOTER_DESTINATIONS];

function ownsPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The single destination a path belongs to; the most specific prefix wins. */
export function activeDestinationId(pathname: string): string | null {
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

export type Crumb = Readonly<{ label: string; href?: string }>;

export function crumbsForPath(pathname: string): Crumb[] {
  const id = activeDestinationId(pathname);
  const destination = ALL.find((entry) => entry.id === id);
  const crumbs: Crumb[] = [{ label: "Signal Studio", href: "/app/home" }];
  if (!destination) return crumbs;
  crumbs.push({ label: destination.label, href: destination.href });
  if (pathname === "/app/archived") crumbs.push({ label: "Archive" });
  if (pathname === "/app/import") crumbs.push({ label: "Import" });
  if (pathname.startsWith("/app/task/")) crumbs.push({ label: "Task" });
  if (pathname.startsWith("/app/timeline/") && pathname !== "/app/timeline") {
    const rest = pathname.slice("/app/timeline/".length).split("/")[0] ?? "";
    crumbs.push({ label: rest === "audience" ? "Shared timelines" : "Plan" });
  }
  return crumbs;
}
