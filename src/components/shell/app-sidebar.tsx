"use client";

/**
 * v3 sidebar: the one persistent navigation for the whole suite.
 *
 * Top to bottom (founder instruction, 6 Oct 2026): the brand, search, Home,
 * then four named groups with room between them. Workspace is the five
 * places of the work. Projects lists every Project the reader can open,
 * each with its own colour tile and a dot only when it is late or at risk.
 * Build holds Automations (a preview) and Whiteboard (on its way). Chat
 * lists the reader's real conversations, or one quiet "Coming soon" row for
 * a reader who does not have Chat. Projects and Chat fold, and the choice is
 * remembered per browser. One row at a time is the page you are on. The
 * footer is one row: Settings, help and the theme.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useActiveProject } from "@/components/app/active-project-provider";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { useChatDirectory, useMessagesUnread, type ChatDirectory, type ChatDirectoryEntry } from "@/components/app/messages/messages-unread";
import { withSuiteContext } from "@/lib/suite-context";
import { loadSidebarProjectsAction } from "@/server/actions/sidebar-projects";
import type { ChooserRow } from "@/lib/projects/project-chooser";
import { buildProjectUrl } from "@/lib/projects/project-url";
import { SIDEBAR_MARK_LABEL, type SidebarProjectMark } from "@/lib/projects/sidebar-projects";
import { ShellIcon } from "./shell-icons";
import { useFaviconBadge } from "./favicon-badge";
import { SIGNAL_INDIGO, suiteMarkMetrics } from "@/lib/brand/suite-mark";
import { CHAT_ENABLED_ATTRIBUTE, openPalette, ThemeCycleButton, useShell, useShortcutLabel } from "./app-shell";
import {
  activeDestinationId,
  BUILD_DESTINATIONS,
  FOOTER_DESTINATIONS,
  HOME_DESTINATION,
  sectionIsOpen,
  sectionStoreKey,
  SIDEBAR_GROUPS,
  WORKSPACE_DESTINATIONS,
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

/** Rows listed before "All projects" takes over; the rail shows fewer. */
const PROJECT_LIMIT = 8;
const PROJECT_RAIL_LIMIT = 5;
const BRAND_MARK = suiteMarkMetrics(24);

type SidebarGroup = (typeof SIDEBAR_GROUPS)[number];
function groupById(id: SidebarGroup["id"]): SidebarGroup {
  return SIDEBAR_GROUPS.find((entry) => entry.id === id)!;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

/* ── Foldable groups, remembered per browser ─────────────────────── */

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

/** Writes a group's state: the list holds only the groups someone folded. */
function setSectionOpen(id: string, open: boolean) {
  const next = new Set(readFolded());
  const key = sectionStoreKey(id);
  if (open) next.delete(key);
  else next.add(key);
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
  const [marks, setMarks] = useState<Readonly<Record<string, SidebarProjectMark>>>({});
  const [failed, setFailed] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    void (async () => {
      try {
        const result = await loadSidebarProjectsAction();
        if (result.ok) {
          setRows(result.rows);
          setMarks(result.marks);
        } else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
  }, [enabled]);
  return { rows, marks, failed };
}

export function AppSidebar({
  messagesEnabled,
  chatPending = false,
  inboxCount = 0,
  messagesUnread = 0,
  chatDirectory = null,
}: {
  messagesEnabled: boolean;
  /** The shell is still finding out whether this reader has Chat. */
  chatPending?: boolean;
  inboxCount?: number;
  /** Direct messages, mentions and requests waiting; Chat keeps it live. */
  messagesUnread?: number;
  /** The reader's conversations; Chat keeps it live as you read. */
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
  const { rows, marks, failed } = useProjectRows(Boolean(activeProject));
  const foldedSections = useFolded();
  const shortcut = useShortcutLabel();
  const currentProjectId =
    activeProject?.chrome.kind === "verified"
      ? activeProject.chrome.project.id
      : activeProject?.chrome.kind === "pending"
        ? activeProject.chrome.showing.id
        : null;
  const chatEntries = directory ? [...directory.channels, ...directory.direct] : [];
  // An open conversation is the page you are on; "All conversations" stays
  // quiet then, so only one row reads as "here".
  const chatRowOpen = chatEntries.some((entry) => entry.href === here);

  const openProject = useCallback(
    (event: React.MouseEvent, row: ChooserRow) => {
      setMobileOpen(false);
      // A plain click goes through the guarded switch (it holds unsaved
      // work); a new-tab click follows the link.
      if (!activeProject || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      activeProject.selectProject(row.project, { surface: "project" });
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

  const link = (destination: ShellDestination, extra?: React.ReactNode, current = activeId === destination.id) => {
    const Icon = ShellIcon[destination.icon];
    const href = destination.id === "tasks" || destination.id === "notes" || destination.id === "timeline" || destination.id === "projects"
      ? withSuiteContext(destination.href, suiteContext)
      : destination.href;
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
        {destination.preview ? <span className={styles.soonTag} data-tone="preview">Preview</span> : null}
        {extra}
      </Link>
    );
  };

  /** A named group. One that folds has a real disclosure for its name. */
  const group = ({ id, label, folds }: SidebarGroup, children: React.ReactNode, actions?: React.ReactNode) => {
    // The rail has no headers to fold with, so it shows every group.
    const open = !folds || collapsed || sectionIsOpen(foldedSections, id);
    const bodyId = `shell-group-${id}`;
    return (
      <nav className={styles.section} aria-label={label} data-group={id} data-folded={open ? undefined : ""}>
        <div className={styles.label}>
          {folds ? (
            <button
              type="button"
              className={styles.labelToggle}
              aria-expanded={open}
              aria-controls={open ? bodyId : undefined}
              onClick={() => setSectionOpen(id, !open)}
            >
              <span>{label}</span>
              <ShellIcon.chevronDown size={12} className={styles.labelChevron} />
            </button>
          ) : (
            <span className={styles.labelText} aria-hidden="true">{label}</span>
          )}
          {actions ? <span className={styles.labelActions}>{actions}</span> : null}
        </div>
        {open ? (
          <div id={bodyId} className={styles.groupBody}>
            {children}
          </div>
        ) : null}
      </nav>
    );
  };

  const projectRow = (row: ChooserRow) => {
    const current = row.id === currentProjectId;
    const mark = marks[row.id];
    const tile = (
      <span className={styles.projectSquare} style={{ backgroundColor: projectColor(row.id) }} aria-hidden="true">
        {row.monogram.slice(0, 1)}
      </span>
    );
    const dot = mark ? <span className={styles.statusDot} data-tone={mark} title={SIDEBAR_MARK_LABEL[mark]} aria-hidden="true" /> : null;
    const name = `${row.accessibleName}${mark ? `, ${SIDEBAR_MARK_LABEL[mark].toLowerCase()}` : ""}${current ? ", open now" : ""}`;
    if (!row.selectable) {
      return (
        <span key={row.id} className={styles.item} data-blocked="" role="link" aria-disabled="true" aria-label={name} title={row.blockedReason ?? row.name}>
          {tile}
          <span className={styles.itemLabel}>{row.name}</span>
          {dot}
        </span>
      );
    }
    return (
      <Link
        key={row.id}
        href={buildProjectUrl({ surface: "project" }, row.id)}
        className={styles.item}
        data-project-row=""
        data-current-project={current ? "" : undefined}
        data-mark={mark}
        aria-label={name}
        title={collapsed ? row.name : mark ? SIDEBAR_MARK_LABEL[mark] : row.subtitle}
        onClick={(event) => openProject(event, row)}
      >
        {tile}
        <span className={styles.itemLabel}>{row.name}</span>
        {dot}
      </Link>
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
        data-chat-row=""
        aria-current={current ? "page" : undefined}
        data-unread={entry.unread && !current ? "" : undefined}
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
          {entry.unread && entry.count === 0 ? <span className="sr-only">, unread</span> : null}
        </span>
        {trailing}
      </Link>
    );
  };

  const projectLimit = collapsed ? PROJECT_RAIL_LIMIT : PROJECT_LIMIT;

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
        <nav className={styles.section} aria-label="Home" data-group="home">
          {link(HOME_DESTINATION)}
        </nav>

        {group(groupById("workspace"), WORKSPACE_DESTINATIONS.map((destination) => link(destination)))}

        {activeProject
          ? group(
              groupById("projects"),
              <>
                {rows === null && !failed ? (
                  <div className={styles.projectsEmpty} role="status">Loading projects…</div>
                ) : null}
                {failed ? <div className={styles.projectsEmpty}>Projects are unavailable right now.</div> : null}
                {rows?.length === 0 ? (
                  <div className={styles.groupEmpty}>
                    <span>No projects yet</span>
                    <Link href="/app/project" onClick={() => setMobileOpen(false)}>Start one</Link>
                  </div>
                ) : null}
                {rows?.slice(0, projectLimit).map((row) => projectRow(row))}
                {rows && rows.length > projectLimit ? (
                  <Link
                    href="/app/project"
                    className={`${styles.item} ${styles.quietRow}`}
                    title={collapsed ? `All ${rows.length} projects` : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
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
                  <ShellIcon.arrowRight size={13} />
                </Link>
              </>,
            )
          : null}

        {group(groupById("build"), BUILD_DESTINATIONS.map((destination) => link(destination)))}

        {messagesEnabled
          ? group(
              groupById("chat"),
              <>
                {link(
                  { id: "messages", label: collapsed ? "Chat" : "All conversations", href: "/app/messages", icon: "messages", owns: [] },
                  count(messagesCount, "waiting"),
                  activeId === "messages" && !chatRowOpen,
                )}
                {collapsed ? null : chatEntries.map((entry) => chatLink(entry))}
                {!collapsed && directory && chatEntries.length === 0 ? (
                  <div className={styles.projectsEmpty}>No conversations yet</div>
                ) : null}
              </>,
              directory?.newMessageHref ? (
                <Link href={directory.newMessageHref} aria-label="New message" title="New message" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.plus size={13} />
                </Link>
              ) : null,
            )
          : collapsed || chatPending
            ? null
            : group(
                groupById("chat"),
                // Not a link and not in the tab order: there is nowhere to go yet.
                <div className={`${styles.item} ${styles.comingRow}`}>
                  <ShellIcon.messages />
                  <span className={styles.itemLabel}>Conversations</span>
                  <span className={styles.soonTag}>Coming soon</span>
                </div>,
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
