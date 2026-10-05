"use client";

/**
 * v3 sidebar: the one persistent navigation for the whole suite.
 *
 * Order, top to bottom: the brand, search, then the eight places of the
 * approved navigation (Home, Overview, Projects, Tasks, Timeline, Files,
 * Analytics, Whiteboard). Below that, one group that folds, "Initial setup":
 * everything the sidebar had before (Inbox, My tasks, Chat, Apps and tools,
 * the Projects list, Channels and Direct messages), kept whole so it can be
 * reviewed (founder instruction, 2 Oct 2026). It starts folded, remembers
 * the choice, opens by itself when the page you are on is inside it, and
 * shows what is waiting on its header while folded. One row at a time is
 * the page you are on; the open Project is marked with a dot, not a second
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
import { CHAT_ENABLED_ATTRIBUTE, openPalette, ThemeCycleButton, useShell, useShortcutLabel } from "./app-shell";
import {
  activeDestinationId,
  FOOTER_DESTINATIONS,
  INITIAL_SETUP,
  INITIAL_SETUP_DESTINATIONS,
  isInsideInitialSetup,
  sectionIsOpen,
  sectionStoreKey,
  TOP_LEVEL_DESTINATIONS,
  type ShellDestination,
} from "./shell-nav";
import styles from "./shell.module.css";

/** Stable project colour from its id: identity, never status. */
/* v3 identity tokens: white initials pass AA on every hue (src/ds/v3.css).
   Amber (5), orange (6), red (7) and pink (8) are left out so an assigned
   colour never reads as a warning or as late work next to a red count;
   people can still pick them by hand. */
const PROJECT_HUES = [1, 2, 3, 4, 9].map((n) => `var(--v3-project-${n})`);
export function projectColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return PROJECT_HUES[hash % PROJECT_HUES.length]!;
}

const PROJECT_LIMIT = 8;
const BRAND_MARK = suiteMarkMetrics(24);
const SETUP_BODY_ID = "shell-initial-setup";

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

/** Writes a section's state: the list holds only what differs from the design. */
function setSectionOpen(id: string, open: boolean) {
  const next = new Set(readFolded());
  const key = sectionStoreKey(id);
  // "open:<id>" is listed when open; a plain id is listed when folded.
  if (key === id ? !open : open) next.add(key);
  else next.delete(key);
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
  // Initial setup: the remembered choice, or open because you are inside it.
  // Folding it while inside holds for that page, and is remembered as well.
  const insideSetup = isInsideInitialSetup(pathname);
  const [setupChoice, setSetupChoice] = useState<{ path: string; open: boolean } | null>(null);
  const setupOpen =
    setupChoice?.path === pathname ? setupChoice.open : sectionIsOpen(foldedSections, INITIAL_SETUP.id) || insideSetup;
  const chooseSetupOpen = (open: boolean) => {
    setSetupChoice({ path: pathname, open });
    setSectionOpen(INITIAL_SETUP.id, open);
  };
  const setupWaiting = inboxCount + (messagesEnabled ? messagesCount : 0);
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
        {destination.soon ? (
          <span className={styles.soonTag}>
            <span className="sr-only">Coming </span>Soon
          </span>
        ) : null}
        {extra}
      </Link>
    );
  };

  const section = (id: string, label: string, children: React.ReactNode, actions?: React.ReactNode) => {
    const open = sectionIsOpen(foldedSections, id);
    return (
      <nav className={styles.section} aria-label={label} data-folded={open ? undefined : ""}>
        <div className={styles.label}>
          <button type="button" className={styles.labelToggle} aria-expanded={open} onClick={() => setSectionOpen(id, !open)}>
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

  const setupRows = INITIAL_SETUP_DESTINATIONS.filter((destination) => !destination.requiresMessages || messagesEnabled);

  return (
    <aside className={styles.sidebar} aria-label="Signal Studio" {...{ [CHAT_ENABLED_ATTRIBUTE]: messagesEnabled ? "" : undefined }}>
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
          {TOP_LEVEL_DESTINATIONS.map((destination) => link(destination))}
        </nav>

        {collapsed ? (
          // Icons only: one button that widens the sidebar and opens the group.
          <div className={styles.setup}>
            <button
              type="button"
              className={styles.item}
              data-active={insideSetup ? "" : undefined}
              aria-label={`${INITIAL_SETUP.label}${setupWaiting > 0 ? `, ${setupWaiting > 99 ? "99+" : setupWaiting} waiting inside` : ""}: expand the sidebar and show it`}
              title={INITIAL_SETUP.label}
              onClick={() => {
                chooseSetupOpen(true);
                toggleCollapsed();
              }}
            >
              <ShellIcon.setup />
              {count(setupWaiting, "waiting inside")}
            </button>
          </div>
        ) : (
          <div className={styles.setup} data-open={setupOpen ? "" : undefined}>
            <button
              type="button"
              className={styles.setupToggle}
              aria-expanded={setupOpen}
              aria-controls={setupOpen ? SETUP_BODY_ID : undefined}
              onClick={() => chooseSetupOpen(!setupOpen)}
            >
              <ShellIcon.setup />
              <span className={styles.itemLabel}>{INITIAL_SETUP.label}</span>
              {/* Folded, the group still says what is waiting inside it. */}
              {setupOpen ? null : count(setupWaiting, "waiting inside")}
              <ShellIcon.chevronDown size={12} className={styles.setupChevron} />
            </button>
            {setupOpen ? (
              <div id={SETUP_BODY_ID} className={styles.setupBody}>
                <nav className={styles.section} aria-label={INITIAL_SETUP.label}>
                  {setupRows.map((destination) =>
                    link(
                      destination,
                      destination.id === "inbox"
                        ? count(inboxCount, "waiting")
                        : destination.id === "messages"
                          ? count(messagesCount, "waiting")
                          : null,
                    ),
                  )}
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
            ) : null}
          </div>
        )}
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
