"use client";

/**
 * v3 sidebar: the one persistent navigation for the whole suite.
 *
 * Order, top to bottom: the brand, search, your day (Home, Inbox, My tasks),
 * the work itself (Tasks, Projects, Timeline, Chat, Files), then the wider
 * view (Overview, Analytics, Apps and tools). Below that, three sections you
 * can fold: Projects, Channels and Direct messages. One row at a time is the
 * page you are on; the open Project is marked with a dot, not a second
 * highlight. The footer is one row: Settings, help and the theme.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useActiveProject } from "@/components/app/active-project-provider";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { useChatDirectory, useMessagesUnread, type ChatDirectory, type ChatDirectoryEntry } from "@/components/app/messages/messages-unread";
import { withSuiteContext } from "@/lib/suite-context";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import type { ChooserRow } from "@/lib/projects/project-chooser";
import { ShellIcon } from "./shell-icons";
import { useFaviconBadge } from "./favicon-badge";
import { SIGNAL_INDIGO, suiteMarkMetrics } from "@/lib/brand/suite-mark";
import { openPalette, ThemeCycleButton, useShell } from "./app-shell";
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
const BRAND_MARK = suiteMarkMetrics(24);
/** Where the wider view starts: a quiet gap separates it from the work. */
const WIDER_VIEW_STARTS_AT = "overview";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

/* ── Foldable sections, remembered per browser ───────────────────── */

const SECTIONS_KEY = "signal:v3:sidebar-folded";
let folded: ReadonlySet<string> | null = null;
const foldListeners = new Set<() => void>();

function readFolded(): ReadonlySet<string> {
  if (folded) return folded;
  try {
    const raw = window.localStorage.getItem(SECTIONS_KEY);
    folded = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    folded = new Set();
  }
  return folded;
}

function toggleFolded(id: string) {
  const next = new Set(readFolded());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  folded = next;
  try {
    window.localStorage.setItem(SECTIONS_KEY, JSON.stringify([...next]));
  } catch {
    // Private windows: the fold still works for this visit.
  }
  for (const listener of foldListeners) listener();
}

const EMPTY_FOLDED: ReadonlySet<string> = new Set();
function subscribeFolded(listener: () => void) {
  foldListeners.add(listener);
  return () => {
    foldListeners.delete(listener);
  };
}
function useFolded(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeFolded, readFolded, () => EMPTY_FOLDED);
}

/** ⌘K on a Mac, Ctrl K everywhere else. */
const noSubscribe = () => () => {};
function useShortcutLabel(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}

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
  chatDirectory = null,
}: {
  messagesEnabled: boolean;
  inboxCount?: number;
  /** Direct messages, mentions and requests waiting; Chat keeps it live. */
  messagesUnread?: number;
  /** Channels and Direct messages; Chat keeps it live as you read. */
  chatDirectory?: ChatDirectory | null;
}) {
  const messagesCount = useMessagesUnread(messagesUnread);
  useFaviconBadge(inboxCount + (messagesEnabled ? messagesCount : 0));
  const pathname = usePathname() ?? "";
  const directory = useChatDirectory(messagesEnabled ? chatDirectory : null);
  const searchParams = useSearchParams();
  const here = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const activeId = activeDestinationId(pathname);
  const suiteContext = useSuiteContext();
  const activeProject = useActiveProject();
  const { collapsed, toggleCollapsed, setMobileOpen } = useShell();
  const { rows, failed } = useProjectRows(Boolean(activeProject));
  const foldedSections = useFolded();
  const shortcut = useShortcutLabel();
  const currentProjectId =
    activeProject?.chrome.kind === "verified"
      ? activeProject.chrome.project.id
      : activeProject?.chrome.kind === "pending"
        ? activeProject.chrome.showing.id
        : null;
  // An open Chat row is the page you are on; the Chat destination row stays
  // quiet then, so only one row reads as "here".
  const chatRowOpen = Boolean(directory && (here === directory.newMessageHref || [...directory.channels, ...directory.direct].some((entry) => entry.href === here)));

  const openProject = useCallback(
    (row: ChooserRow) => {
      if (!activeProject || !row.selectable) return;
      activeProject.selectProject(row.project, { surface: "tasks" });
      setMobileOpen(false);
    },
    [activeProject, setMobileOpen],
  );

  const count = (value: number, noun: string) =>
    value > 0 ? (
      <span className={styles.badge}>
        {value > 99 ? "99+" : value}
        <span className="sr-only"> {noun}</span>
      </span>
    ) : null;

  const link = (destination: ShellDestination, extra?: React.ReactNode) => {
    const Icon = ShellIcon[destination.icon];
    const href = destination.id === "tasks" || destination.id === "notes" || destination.id === "timeline" || destination.id === "projects"
      ? withSuiteContext(destination.href, suiteContext)
      : destination.href;
    const current = activeId === destination.id && !(destination.id === "messages" && chatRowOpen);
    return (
      <Link
        key={destination.id}
        href={href}
        className={styles.item}
        aria-current={current ? "page" : undefined}
        title={collapsed ? destination.label : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <Icon />
        <span className={styles.itemLabel}>{destination.label}</span>
        {extra}
      </Link>
    );
  };

  const section = (id: string, label: string, children: React.ReactNode, actions?: React.ReactNode) => {
    const open = !foldedSections.has(id);
    return (
      <nav className={styles.section} aria-label={label} data-folded={open ? undefined : ""}>
        <div className={styles.label}>
          <button type="button" className={styles.labelToggle} aria-expanded={open} onClick={() => toggleFolded(id)}>
            <span>{label}</span>
            <ShellIcon.chevronDown size={12} className={styles.labelChevron} />
          </button>
          {actions ? <span className={styles.labelActions}>{actions}</span> : null}
        </div>
        {open ? children : null}
      </nav>
    );
  };

  const chatLink = (entry: ChatDirectoryEntry) => {
    const current = here === entry.href;
    const trailing = entry.count > 0
      ? count(entry.count, entry.kind === "dm" ? (entry.count === 1 ? "new message" : "new messages") : entry.count === 1 ? "mention" : "mentions")
      : entry.request ? <span className={styles.chatTag}>Request</span> : null;
    return (
      <Link
        key={entry.id}
        href={entry.href}
        className={styles.item}
        aria-current={current ? "page" : undefined}
        data-unread={entry.unread && !current ? "" : undefined}
        title={collapsed ? entry.title : undefined}
        onClick={() => setMobileOpen(false)}
      >
        {entry.kind === "dm" ? (
          <span className={styles.chatAvatarWrap} aria-hidden="true">
            <span className={styles.chatAvatar} style={{ backgroundColor: projectColor(entry.personId ?? entry.id) }}>
              {initialsOf(entry.title)}
            </span>
            {entry.online ? <span className={styles.presence} /> : null}
          </span>
        ) : entry.kind === "task" ? <ShellIcon.thread /> : <ShellIcon.hash />}
        <span className={styles.itemLabel}>
          {entry.title}
          {entry.online ? <span className="sr-only">, online</span> : null}
        </span>
        {trailing}
      </Link>
    );
  };

  const work = WORKSPACE_DESTINATIONS.filter((destination) => !destination.requiresMessages || messagesEnabled);
  const widerAt = work.findIndex((destination) => destination.id === WIDER_VIEW_STARTS_AT);

  return (
    <aside className={styles.sidebar} aria-label="Signal Studio">
      <div className={styles.brandRow}>
        <Link href="/app/home" className={styles.brand} aria-label="Signal Studio home">
          <span className={styles.brandMark} aria-hidden="true">
            {/* The Signal Studio mark, the same backgroundless ring and dot as
                the tab icon, from the same geometry. */}
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r={BRAND_MARK.ring} fill="none" stroke={SIGNAL_INDIGO} strokeWidth={BRAND_MARK.stroke} />
              <circle cx="12" cy="12" r={BRAND_MARK.dot} fill={SIGNAL_INDIGO} />
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
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ShellIcon.sidebar />
        </button>
      </div>

      <button type="button" className={styles.searchTrigger} onClick={() => openPalette()} aria-label="Search or jump to" title={collapsed ? "Search or jump to" : undefined}>
        <ShellIcon.search />
        <span>Search or jump to…</span>
        <kbd className={styles.kbd}>{shortcut}</kbd>
      </button>

      <div className={styles.scroll}>
        <nav className={styles.section} aria-label="Primary">
          {PRIMARY_DESTINATIONS.map((destination) =>
            link(destination, destination.id === "inbox" ? count(inboxCount, "waiting") : null),
          )}
        </nav>

        <nav className={styles.section} aria-label="Studio">
          {work.map((destination, index) => (
            <div key={destination.id} className={styles.navSlot} data-gap={index === widerAt ? "" : undefined}>
              {link(destination, destination.id === "messages" ? count(messagesCount, "waiting") : null)}
            </div>
          ))}
        </nav>

        {activeProject
          ? section(
              "projects",
              "Projects",
              <>
                {rows === null && !failed ? <div className={styles.projectsEmpty}>Loading projects…</div> : null}
                {failed ? <div className={styles.projectsEmpty}>Projects are unavailable right now.</div> : null}
                {rows?.length === 0 ? <div className={styles.projectsEmpty}>No projects yet.</div> : null}
                {rows?.slice(0, PROJECT_LIMIT).map((row) => {
                  const current = row.id === currentProjectId;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={styles.item}
                      data-current-project={current ? "" : undefined}
                      onClick={() => openProject(row)}
                      disabled={!row.selectable}
                      title={row.blockedReason ?? (collapsed ? row.name : row.subtitle)}
                      aria-label={row.accessibleName}
                    >
                      <span className={styles.projectSquare} style={{ backgroundColor: projectColor(row.id) }} aria-hidden="true">
                        {row.monogram.slice(0, 1)}
                      </span>
                      <span className={styles.itemLabel}>{row.name}</span>
                      {current ? <span className={styles.currentDot} title="Open project" aria-hidden="true" /> : null}
                      {row.activeRootTaskCount > 0 ? (
                        <span className={styles.count} title={`${row.activeRootTaskCount} open tasks`}>{row.activeRootTaskCount}</span>
                      ) : null}
                    </button>
                  );
                })}
                {rows && rows.length > PROJECT_LIMIT ? (
                  <Link href="/app/project" className={styles.item} onClick={() => setMobileOpen(false)}>
                    <ShellIcon.chevronRight />
                    <span className={styles.itemLabel}>All {rows.length} projects</span>
                  </Link>
                ) : null}
              </>,
              <>
                <Link href="/app/archived" aria-label="Archived projects" title="Archived projects" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.archive size={13} />
                </Link>
                <Link href="/app/project" aria-label="All projects" title="All projects" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.plus size={13} />
                </Link>
              </>,
            )
          : null}

        {directory ? (
          <>
            {section(
              "channels",
              "Channels",
              <>
                {directory.channels.length === 0 ? <div className={styles.projectsEmpty}>No channels yet.</div> : null}
                {directory.channels.map((entry) => chatLink(entry))}
              </>,
            )}
            {section(
              "direct",
              "Direct messages",
              <>
                {directory.direct.map((entry) => chatLink(entry))}
                {directory.newMessageHref ? (
                  <Link
                    href={directory.newMessageHref}
                    className={`${styles.item} ${styles.chatAdd}`}
                    aria-current={here === directory.newMessageHref ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <ShellIcon.plus />
                    <span className={styles.itemLabel}>New message</span>
                  </Link>
                ) : null}
              </>,
              directory.newMessageHref ? (
                <Link href={directory.newMessageHref} aria-label="New message" title="New message" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.plus size={13} />
                </Link>
              ) : null,
            )}
          </>
        ) : null}
      </div>

      <div className={styles.footer}>
        {FOOTER_DESTINATIONS.map((destination) => link(destination))}
        <div className={styles.footerTools}>
          <a
            className={styles.iconButton}
            href="mailto:hello@signalstudio.ie?subject=Signal%20Studio%20help"
            aria-label="Help and feedback"
            title="Help and feedback"
          >
            <ShellIcon.help />
          </a>
          <ThemeCycleButton className={styles.iconButton} />
        </div>
      </div>
    </aside>
  );
}
