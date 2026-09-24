"use client";

/**
 * v3 sidebar: the one persistent navigation for the whole suite.
 * Sections: primary (Home, Inbox, My tasks), Studio, Projects, footer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveProject } from "@/components/app/active-project-provider";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { useMessagesUnread } from "@/components/app/messages/messages-unread";
import { withSuiteContext } from "@/lib/suite-context";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import type { ChooserRow } from "@/lib/projects/project-chooser";
import { ShellIcon } from "./shell-icons";
import { openPalette, ThemeSwitch, useShell } from "./app-shell";
import {
  activeDestinationId,
  FOOTER_DESTINATIONS,
  PRIMARY_DESTINATIONS,
  WORKSPACE_DESTINATIONS,
  type ShellDestination,
} from "./shell-nav";
import styles from "./shell.module.css";

/** Stable project colour from its id: identity, never status. */
/* v3 identity tokens: white initials pass AA on every hue (src/ds/v3.css). */
const PROJECT_HUES = Array.from({ length: 8 }, (_, index) => `var(--v3-project-${index + 1})`);
export function projectColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return PROJECT_HUES[hash % PROJECT_HUES.length]!;
}

const PROJECT_LIMIT = 8;

function useProjectRows(enabled: boolean) {
  const [rows, setRows] = useState<readonly ChooserRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    void (async () => {
      try {
        const result = await loadProjectCatalogAction();
        if (result.ok) setRows(result.catalog.rows.filter((row) => !row.archived));
        else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
  }, [enabled]);
  return { rows, failed };
}

export function AppSidebar({
  messagesEnabled,
  inboxCount = 0,
  messagesUnread = 0,
}: {
  messagesEnabled: boolean;
  inboxCount?: number;
  /** Direct messages, mentions and requests waiting; Messages keeps it live. */
  messagesUnread?: number;
}) {
  const messagesCount = useMessagesUnread(messagesUnread);
  const pathname = usePathname() ?? "";
  const activeId = activeDestinationId(pathname);
  const suiteContext = useSuiteContext();
  const activeProject = useActiveProject();
  const { collapsed, toggleCollapsed, setMobileOpen } = useShell();
  const { rows, failed } = useProjectRows(Boolean(activeProject));
  const currentProjectId =
    activeProject?.chrome.kind === "verified"
      ? activeProject.chrome.project.id
      : activeProject?.chrome.kind === "pending"
        ? activeProject.chrome.showing.id
        : null;

  const openProject = useCallback(
    (row: ChooserRow) => {
      if (!activeProject || !row.selectable) return;
      activeProject.selectProject(row.project, { surface: "tasks" });
      setMobileOpen(false);
    },
    [activeProject, setMobileOpen],
  );

  const link = (destination: ShellDestination, extra?: React.ReactNode) => {
    const Icon = ShellIcon[destination.icon];
    const href = destination.id === "tasks" || destination.id === "notes" || destination.id === "timeline" || destination.id === "projects"
      ? withSuiteContext(destination.href, suiteContext)
      : destination.href;
    return (
      <Link
        key={destination.id}
        href={href}
        className={styles.item}
        aria-current={activeId === destination.id ? "page" : undefined}
        title={collapsed ? destination.label : undefined}
      >
        <Icon />
        <span className={styles.itemLabel}>{destination.label}</span>
        {extra}
      </Link>
    );
  };

  return (
    <aside className={styles.sidebar} aria-label="Signal Studio">
      <div className={styles.brandRow}>
        <Link href="/app/home" className={styles.brand} aria-label="Signal Studio home">
          <span className={styles.brandMark} aria-hidden="true">
            {/* The Signal Studio mark: the broadcast ring around the dot. */}
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="2.9" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.brandName}>Signal Studio</span>
        </Link>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.collapseButton ?? ""}`}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
        >
          <ShellIcon.sidebar />
        </button>
      </div>

      <button type="button" className={styles.searchTrigger} onClick={() => openPalette()} aria-label="Search or jump to">
        <ShellIcon.search />
        <span>Search or jump to…</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <div className={styles.scroll}>
        <nav className={styles.section} aria-label="Primary">
          {PRIMARY_DESTINATIONS.map((destination) =>
            link(
              destination,
              destination.id === "inbox" && inboxCount > 0 ? (
                <span className={styles.badge}>{inboxCount > 99 ? "99+" : inboxCount}</span>
              ) : null,
            ),
          )}
        </nav>

        <nav className={styles.section} aria-label="Studio">
          <div className={styles.label}>Studio</div>
          {WORKSPACE_DESTINATIONS.filter((destination) => !destination.requiresMessages || messagesEnabled).map((destination) =>
            link(
              destination,
              destination.id === "messages" && messagesCount > 0 ? (
                <span className={styles.badge}>
                  {messagesCount > 99 ? "99+" : messagesCount}
                  <span className="sr-only"> waiting</span>
                </span>
              ) : null,
            ),
          )}
        </nav>

        {activeProject ? (
          <nav className={styles.section} aria-label="Projects">
            <div className={styles.label}>
              <span>Projects</span>
              <Link href="/app/project" aria-label="All projects" title="All projects">
                <ShellIcon.plus size={13} />
              </Link>
            </div>
            {rows === null && !failed ? (
              <div className={styles.projectsEmpty}>Loading projects…</div>
            ) : null}
            {failed ? <div className={styles.projectsEmpty}>Projects are unavailable right now.</div> : null}
            {rows?.length === 0 ? <div className={styles.projectsEmpty}>No projects yet.</div> : null}
            {rows?.slice(0, PROJECT_LIMIT).map((row) => (
              <button
                key={row.id}
                type="button"
                className={styles.item}
                data-active={row.id === currentProjectId ? "" : undefined}
                onClick={() => openProject(row)}
                disabled={!row.selectable}
                title={row.blockedReason ?? (collapsed ? row.name : row.subtitle)}
                aria-label={row.accessibleName}
              >
                <span className={styles.projectSquare} style={{ background: projectColor(row.id) }} aria-hidden="true">
                  {row.monogram.slice(0, 1)}
                </span>
                <span className={styles.itemLabel}>{row.name}</span>
                {row.activeRootTaskCount > 0 ? <span className={styles.count}>{row.activeRootTaskCount}</span> : null}
              </button>
            ))}
            {rows && rows.length > PROJECT_LIMIT ? (
              <Link href="/app/project" className={styles.item}>
                <ShellIcon.chevronRight />
                <span className={styles.itemLabel}>All {rows.length} projects</span>
              </Link>
            ) : null}
            <Link href="/app/archived" className={styles.item} aria-current={pathname === "/app/archived" ? "page" : undefined}>
              <ShellIcon.archive />
              <span className={styles.itemLabel}>Archive</span>
            </Link>
          </nav>
        ) : null}
      </div>

      <div className={styles.footer}>
        {FOOTER_DESTINATIONS.map((destination) => link(destination))}
        <a className={styles.item} href="mailto:hello@signalstudio.ie?subject=Signal%20Studio%20help">
          <ShellIcon.help />
          <span className={styles.itemLabel}>Help and feedback</span>
        </a>
        {collapsed ? null : <ThemeSwitch />}
      </div>
    </aside>
  );
}
