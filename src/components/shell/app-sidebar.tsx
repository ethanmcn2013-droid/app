"use client";

/**
 * v3 sidebar: the one persistent navigation for the whole suite.
 *
 * Top to bottom: the brand, search, Home, Analytics and Files, then the
 * Workspace trio and named groups with room between them. Workspace is the
 * places of the work. Projects lists every Project the reader can open,
 * each with its own project-coloured identity, an indigo ring on the active
 * Project, and a status dot only when it is late or at risk.
 * More groups tools by the kind of work; its visible rows can be customized
 * and saved in this browser. Chat
 * lists the reader's real conversations, or one quiet "Coming soon" row for
 * a reader who does not have Chat. Projects and Chat fold, and the choice is
 * remembered per browser. One row at a time is the page you are on. The
 * footer is one row: Settings, help and the theme.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SidebarIntentLink } from "./sidebar-intent-link";
import { usePathname, useSearchParams } from "next/navigation";
import { useActiveProject } from "@/components/app/active-project-provider";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { useChatDirectory, useMessagesUnread, type ChatDirectory, type ChatDirectoryEntry } from "@/components/app/messages/messages-unread";
import { withSuiteContext } from "@/lib/suite-context";
import { loadSidebarProjectsAction } from "@/server/actions/sidebar-projects";
import type { ChooserRow } from "@/lib/projects/project-chooser";
import { buildProjectUrl } from "@/lib/projects/project-url";
import { SIDEBAR_MARK_LABEL, type SidebarProjectMark } from "@/lib/projects/sidebar-mark";
import { ShellIcon } from "./shell-icons";
import { useFaviconBadge } from "./favicon-badge";
import { SIGNAL_INDIGO, suiteMarkMetrics } from "@/lib/brand/suite-mark";
import { CHAT_ENABLED_ATTRIBUTE, openPalette, ThemeCycleButton, useShell, useShortcutLabel } from "./app-shell";
import { SidebarIcon, type SidebarIconName } from "./sidebar-icon";
import { ProjectContextMenu } from "./project-context-menu";
import { useMorePreferences } from "./use-more-preferences";
import moreStyles from "./sidebar-more.module.css";
import {
  activeDestinationId,
  FOOTER_DESTINATIONS,
  MORE_DESTINATIONS,
  MORE_CUSTOMIZATION_ITEMS,
  PRIMARY_DESTINATIONS,
  sectionIsOpen,
  sectionStoreKey,
  SIDEBAR_GROUPS,
  TOOL_DESTINATIONS,
  WEDDING_DESTINATIONS,
  visibleMoreNavigationGroups,
  WORKSPACE_DESTINATIONS,
  type MoreNavigationEntry,
  type ShellDestination,
} from "./shell-nav";
import styles from "./shell.module.css";

/** Stable project colour from its id: identity, never status. */
/* v3 identity tokens: white initials pass AA on every hue (src/ds/v3.css).
   Amber (5), orange (6), red (7) and pink (8) are left out so an assigned
   colour never reads as a warning or as late work next to a red count;
   people can still pick them by hand. */
const PROJECT_HUES = [1, 2, 3, 4, 9].map((n) => `var(--v3-project-${n})`);
/** Sidebar rows drawn with the approved "solid when selected" set. */
const SIDEBAR_ICON: Partial<Record<ShellDestination["icon"], SidebarIconName>> = {
  home: "home",
  projects: "projects",
  tasks: "tasks",
  timeline: "timeline",
  files: "files",
  analytics: "analytics",
  automations: "automations",
  whiteboard: "whiteboard",
  messages: "chat",
  settings: "settings",
};

export function projectColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return PROJECT_HUES[hash % PROJECT_HUES.length]!;
}

/** Rows listed before "All projects" takes over; the rail shows fewer. */
const PROJECT_LIMIT = 8;
const PROJECT_RAIL_LIMIT = 5;
const BRAND_MARK = suiteMarkMetrics(24);
const MORE_ENTRY_PARENT: Readonly<Record<string, string>> = {
  automations: "development",
  "wedding-guest-list": "wedding-hub",
  "wedding-seating": "wedding-hub",
  "wedding-budget": "wedding-hub",
  whiteboard: "teacher-hub",
  "teacher-lessons": "teacher-hub",
  "teacher-marking": "teacher-hub",
  "teacher-share-plan": "teacher-hub",
  "student-deadlines": "student-hub",
  "student-group-work": "student-hub",
  "student-lecture-notes": "student-hub",
  "process-map": "other-tools",
  docs: "other-tools",
  forms: "other-tools",
};

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

const EMPTY_IDS: ReadonlySet<string> = new Set();

function useProjectRows(enabled: boolean) {
  const [rows, setRows] = useState<readonly ChooserRow[] | null>(null);
  const [marks, setMarks] = useState<Readonly<Record<string, SidebarProjectMark>>>({});
  const [weddingIds, setWeddingIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
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
          setWeddingIds(new Set(result.weddingIds));
        } else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
  }, [enabled]);
  return { rows, marks, weddingIds, failed };
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
  const resolvedActiveId = activeDestinationId(pathname);
  const activeId = resolvedActiveId === "tools" && (pathname === "/app/notes" || pathname.startsWith("/app/notes/"))
    ? "notes"
    : resolvedActiveId;
  const suiteContext = useSuiteContext();
  const activeProject = useActiveProject();
  const verifiedProjectName = suiteContext?.version === 3 && activeProject?.enabled && activeProject.chrome.kind === "verified" && suiteContext.workspaceId === activeProject.chrome.project.id
    ? activeProject.chrome.project.name
    : undefined;
  const { collapsed, toggleCollapsed, setMobileOpen } = useShell();
  const { rows, marks, weddingIds, failed } = useProjectRows(Boolean(activeProject));
  const foldedSections = useFolded();
  const morePreferences = useMorePreferences();
  const hiddenMore = new Set(morePreferences.hidden);
  const [moreCustomizeOpen, setMoreCustomizeOpen] = useState(false);
  const moreCustomizeTrigger = useRef<HTMLButtonElement>(null);
  const shortcut = useShortcutLabel();
  const currentProjectId =
    activeProject?.chrome.kind === "verified"
      ? activeProject.chrome.project.id
      : activeProject?.chrome.kind === "pending"
        ? activeProject.chrome.showing.id
        : null;
  // Keep the sidebar focused on channels and people. Task discussions remain
  // in their task views and still contribute to All conversations.
  const chatEntries = directory
    ? [...directory.channels, ...directory.direct].filter((entry) => entry.kind === "channel" || entry.kind === "dm")
    : [];
  // An open conversation is the page you are on; "All conversations" stays
  // quiet then, so only one row reads as "here".
  const chatRowOpen = chatEntries.some((entry) => entry.href === here);
  const moreDestinationsById = new Map([...MORE_DESTINATIONS, ...TOOL_DESTINATIONS].map((destination) => [destination.id, destination]));

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
      <>
        <span className={styles.sidebarUnreadDot} aria-hidden="true" />
        {" "}<span className="sr-only">{value} {noun}</span>
      </>
    ) : null;

  const link = (destination: ShellDestination, extra?: React.ReactNode, current = activeId === destination.id, className = styles.item) => {
    const Icon = ShellIcon[destination.icon];
    const sidebarIcon = SIDEBAR_ICON[destination.icon];
    const projectSurface = destination.id === "tasks" ? { surface: "tasks" as const }
      : destination.id === "notes" ? { surface: "notes" as const }
        : destination.id === "timeline" ? { surface: "timeline" as const }
          : destination.id === "projects" ? { surface: "project" as const }
            : null;
    // Keep the V2 emitter intact for its period/filter context. Readable names
    // are added only when the active Project is the verified V3 route target.
    const href = suiteContext?.version === 3 && verifiedProjectName && projectSurface && activeProject?.chrome.kind === "verified"
      ? buildProjectUrl(projectSurface, activeProject.chrome.project.id, verifiedProjectName)
      : destination.id === "tasks" || destination.id === "notes" || destination.id === "timeline" || destination.id === "projects"
        ? withSuiteContext(destination.href, suiteContext)
        : destination.href;
    return (
      <SidebarIntentLink
        key={destination.id}
        href={href}
        className={className}
        aria-current={current ? "page" : undefined}
        title={collapsed ? destination.label : undefined}
        onClick={() => setMobileOpen(false)}
      >
        {sidebarIcon ? <SidebarIcon name={sidebarIcon} selected={current} /> : <Icon />}
        <span className={styles.itemLabel}>{destination.label}</span>
        {destination.soon ? (
          <span className={styles.soonTag}>
            <span className="sr-only">Coming </span>Soon
          </span>
        ) : null}
        {destination.preview ? <span className={styles.soonTag} data-tone="preview">Preview</span> : null}
        {extra}
      </SidebarIntentLink>
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
              aria-label={id === "projects" && rows !== null && !failed ? `Projects, ${rows.length} total` : undefined}
              onClick={() => {
                if (id === "more" && open) setMoreCustomizeOpen(false);
                setSectionOpen(id, !open);
              }}
            >
              <span>{id === "projects" ? "Projects" : label}</span>
              {id === "projects" && rows !== null && !failed ? (
                <span className={styles.projectGroupCount} aria-hidden="true">{rows.length}</span>
              ) : null}
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
    // SidebarProjectMark currently contains status only; it has no authorized
    // completed/total task counts. The ring is decorative and must not imply
    // completion or an empty project without those counts.
    const tile = (
      <span className={styles.projectProgress} aria-hidden="true">
        <span className={styles.projectProgressCore} style={{ backgroundColor: projectColor(row.id) }} />
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
    const readableName = suiteContext?.version === 3 && verifiedProjectName && suiteContext.workspaceId === row.id
      ? row.name
      : undefined;
    return (
      <ProjectContextMenu key={row.id} projectId={row.id} projectName={row.name}>
        <SidebarIntentLink
          href={buildProjectUrl({ surface: "project" }, row.id, readableName)}
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
        </SidebarIntentLink>
      </ProjectContextMenu>
    );
  };

  /**
   * Wedding tools, nested under the open wedding Project. Only what has been
   * built is a link; the rest says it is coming and goes nowhere.
   */
  const weddingTools = (row: ChooserRow) => {
    if (collapsed || row.id !== currentProjectId || !weddingIds.has(row.id)) return null;
    return (
      <div key={`${row.id}-wedding`} className={styles.nested} role="group" aria-label={`Wedding tools for ${row.name}`}>
        {WEDDING_DESTINATIONS.map((destination) => {
          const current = destination.owns.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          if (destination.soon) {
            return (
              <span key={destination.id} className={styles.nestedItem} data-soon="" aria-disabled="true">
                <span className={styles.itemLabel}>{destination.label}</span>
                <span className={styles.soonTag}>
                  <span className="sr-only">Coming </span>Soon
                </span>
              </span>
            );
          }
          return (
            <SidebarIntentLink
              key={destination.id}
              href={`${destination.href}?workspaceId=${encodeURIComponent(row.id)}`}
              className={styles.nestedItem}
              aria-current={current ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <span className={styles.itemLabel}>{destination.label}</span>
            </SidebarIntentLink>
          );
        })}
      </div>
    );
  };

  const chatLink = (entry: ChatDirectoryEntry) => {
    const current = here === entry.href;
    const unread = (entry.unread || entry.count > 0) && !current;
    const trailing = <>
      {unread ? <span className={styles.sidebarUnreadDot} aria-hidden="true" /> : null}
      {entry.kind !== "dm" && entry.count > 0 ? <span className="sr-only">{` ${entry.count} ${entry.count === 1 ? "mention" : "mentions"}`}</span> : null}
      {entry.request ? <span className={styles.chatTag}>Request</span> : null}
    </>;
    return (
      <SidebarIntentLink
        key={entry.id}
        href={entry.href}
        className={styles.item}
        data-chat-row=""
        aria-current={current ? "page" : undefined}
        data-unread={unread ? "" : undefined}
        onClick={() => setMobileOpen(false)}
      >
        {entry.kind === "dm" ? (
          <span className={styles.chatAvatarWrap} aria-hidden="true">
            <span
              className={styles.chatAvatar}
              style={{ backgroundColor: `color-mix(in srgb, ${projectColor(entry.personId ?? entry.id)} 38%, var(--v3-chrome))` }}
            >
              {initialsOf(entry.title)}
            </span>
            {entry.online ? <span className={styles.presence} /> : null}
          </span>
        ) : entry.kind === "task" ? <ShellIcon.thread /> : <SidebarIcon name="channel" selected={current} />}
        <span className={styles.itemLabel}>
          {entry.title}
          {entry.online ? <span className="sr-only">, online</span> : null}
          {entry.kind === "dm" && entry.count > 0 ? (
            <span className="sr-only">, {entry.unread ? "unread, " : ""}{entry.count} new {entry.count === 1 ? "message" : "messages"}</span>
          ) : entry.unread ? <span className="sr-only">, unread</span> : null}
        </span>
        {trailing}
      </SidebarIntentLink>
    );
  };

  const projectLimit = collapsed ? PROJECT_RAIL_LIMIT : PROJECT_LIMIT;
  const customizeMore = () => {
    setSectionOpen("more", true);
    setMoreCustomizeOpen((isOpen) => !isOpen);
  };
  const revealCustomizeMore = () => {
    if (collapsed) toggleCollapsed();
    setSectionOpen("more", true);
    setMoreCustomizeOpen(true);
  };
  const moreCustomizeButton = collapsed ? null : (
    <button
      ref={moreCustomizeTrigger}
      type="button"
      className={moreStyles.customizeTrigger}
      aria-label="Customize More"
      aria-expanded={moreCustomizeOpen}
      aria-controls={moreCustomizeOpen ? "more-customization" : undefined}
      onClick={customizeMore}
    >
      Customize
    </button>
  );
  const renderMoreEntry = (entry: MoreNavigationEntry): React.ReactNode => {
    const destination = entry.destination;
    const isSoon = entry.soon || destination?.soon === true;
    const status = isSoon ? <span className={moreStyles.entryStatus}>Coming soon</span> : null;
    const row = destination ? (
      link(
        destination.soon ? { ...destination, soon: false } : destination,
        status,
        entry.id === "wedding-guest-list" ? false : activeId === destination.id,
        `${styles.item} ${entry.children ? moreStyles.parentLink : moreStyles.nestedLink}`,
      )
    ) : (
      <span className={`${styles.item} ${moreStyles.nestedItem}`} aria-disabled="true">
        <span className={moreStyles.soonMarker} aria-hidden="true">·</span>
        <span className={styles.itemLabel}>{entry.label}</span>
        {status}
      </span>
    );

    if (!entry.children?.length) return row;
    const foldId = `more:${entry.id}`;
    const open = sectionIsOpen(foldedSections, foldId);
    const childrenId = `more-children-${entry.id}`;
    return (
      <div className={moreStyles.treeNode}>
        <div className={moreStyles.parentRow}>
          {row}
          <button
            type="button"
            className={moreStyles.nestedToggle}
            aria-label={`${open ? "Collapse" : "Expand"} ${entry.label} tools`}
            aria-expanded={open}
            aria-controls={open ? childrenId : undefined}
            onClick={() => setSectionOpen(foldId, !open)}
          >
            <ShellIcon.chevronDown size={12} aria-hidden="true" />
          </button>
        </div>
        {open ? (
          <div id={childrenId} className={moreStyles.children} role="group" aria-label={`${entry.label} tools`}>
            {entry.children.map((child) => <div key={child.id}>{renderMoreEntry(child)}</div>)}
          </div>
        ) : null}
      </div>
    );
  };
  const moreBody = (
    <div className={moreStyles.root}>
      {collapsed ? (
        <button
          ref={moreCustomizeTrigger}
          type="button"
          className={`${styles.item} ${moreStyles.collapsedCustomize}`}
          aria-label="Customize More"
          title="Customize More"
          aria-expanded={moreCustomizeOpen}
          aria-controls={moreCustomizeOpen ? "more-customization" : undefined}
          onClick={revealCustomizeMore}
        >
          <ShellIcon.settings size={15} />
          <span className={styles.itemLabel}>Customize</span>
        </button>
      ) : null}
      {moreCustomizeOpen ? (
        <div
          id="more-customization"
          className={moreStyles.customizePanel}
          role="region"
          aria-labelledby="more-customization-title"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setMoreCustomizeOpen(false);
            moreCustomizeTrigger.current?.focus();
          }}
        >
          <div className={moreStyles.panelHeader}>
            <h3 id="more-customization-title">Show in More</h3>
            <button
              type="button"
              className={moreStyles.doneButton}
              onClick={() => {
                setMoreCustomizeOpen(false);
                moreCustomizeTrigger.current?.focus();
              }}
            >
              Done
            </button>
          </div>
          <fieldset className={moreStyles.choices}>
            <legend className="sr-only">Choose which groups and tools appear in More</legend>
            {MORE_CUSTOMIZATION_ITEMS.map((item) => {
              const parent = MORE_ENTRY_PARENT[item.id];
              const destination = moreDestinationsById.get(item.id);
              const status = item.soon || destination?.soon ? "Coming soon" : destination?.preview ? "Preview" : null;
              const toggleItem = () => {
                if (parent && hiddenMore.has(parent)) morePreferences.toggle(parent);
                morePreferences.toggle(item.id);
              };
              return (
                <label key={item.id} className={moreStyles.choice} data-depth={parent ? "nested" : undefined}>
                  <input type="checkbox" checked={!hiddenMore.has(item.id)} onChange={toggleItem} />
                  <span className={moreStyles.choiceLabel}>{item.label}</span>
                  {status ? <span className={moreStyles.choiceStatus}>{status}</span> : null}
                </label>
              );
            })}
          </fieldset>
          <div className={moreStyles.panelFooter}>
            <p aria-live="polite">Saved on this browser.</p>
            <button type="button" className={moreStyles.restoreButton} onClick={morePreferences.restore}>
              Restore defaults
            </button>
          </div>
        </div>
      ) : null}
      <div className={moreStyles.groups}>
        {visibleMoreNavigationGroups(hiddenMore).map((navigationGroup) => (
          <div key={navigationGroup.id} className={moreStyles.group} role="group" aria-label={navigationGroup.label || navigationGroup.entries[0]?.label || "More tools"}>
            {navigationGroup.label ? <span className={moreStyles.groupLabel} aria-hidden="true">{navigationGroup.label}</span> : null}
            <div className={moreStyles.groupEntries}>{navigationGroup.entries.map((entry) => <div key={entry.id}>{renderMoreEntry(entry)}</div>)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <aside className={styles.sidebar} aria-label="Signal Studio" {...{ [CHAT_ENABLED_ATTRIBUTE]: messagesEnabled ? "" : undefined }}>
      <div className={styles.brandRow}>
        <SidebarIntentLink href="/app/home" className={styles.brand} aria-label="Signal Studio home">
          <span className={styles.brandMark} aria-hidden="true">
            {/* The Signal Studio mark, the same backgroundless ring and dot as
                the tab icon, from the same geometry. */}
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r={BRAND_MARK.ring} fill="none" stroke={SIGNAL_INDIGO} strokeWidth={BRAND_MARK.stroke} />
              <circle cx="12" cy="12" r={BRAND_MARK.dot} fill={SIGNAL_INDIGO} />
            </svg>
          </span>
          <span className={styles.brandName}>Signal Studio</span>
        </SidebarIntentLink>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.collapseButton ?? ""}`}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <SidebarIcon name="collapse" />
        </button>
      </div>

      <button type="button" className={styles.searchTrigger} onClick={() => openPalette()} aria-label="Search or jump to" title={collapsed ? "Search or jump to" : undefined}>
        <SidebarIcon name="search" />
        <span>Search or jump to…</span>
        <kbd className={styles.kbd}>{shortcut}</kbd>
      </button>

      <div className={styles.scroll}>
        <nav className={styles.section} aria-label="Primary" data-group="primary">
          {PRIMARY_DESTINATIONS.map((destination) => link(destination))}
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
                    <SidebarIntentLink href="/app/project" onClick={() => setMobileOpen(false)}>Start one</SidebarIntentLink>
                  </div>
                ) : null}
                {rows?.slice(0, projectLimit).flatMap((row) => [projectRow(row), weddingTools(row)])}
                {rows && rows.length > projectLimit ? (
                  <SidebarIntentLink
                    href="/app/project"
                    className={`${styles.item} ${styles.quietRow}`}
                    title={collapsed ? `All ${rows.length} projects` : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <ShellIcon.chevronRight />
                    <span className={styles.itemLabel}>All {rows.length} projects</span>
                  </SidebarIntentLink>
                ) : null}
              </>,
              <>
                <SidebarIntentLink href="/app/archived" aria-label="Archived projects" title="Archived projects" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.archive size={13} />
                </SidebarIntentLink>
                <SidebarIntentLink href="/app/project" aria-label="All projects" title="All projects" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.arrowRight size={13} />
                </SidebarIntentLink>
              </>,
            )
          : null}

        {group(groupById("more"), moreBody, moreCustomizeButton)}

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
                <SidebarIntentLink href={directory.newMessageHref} aria-label="New message" title="New message" onClick={() => setMobileOpen(false)}>
                  <ShellIcon.plus size={13} />
                </SidebarIntentLink>
              ) : null,
            )
          : collapsed || chatPending
            ? null
            : group(
                groupById("chat"),
                // Not a link and not in the tab order: there is nowhere to go yet.
                <div className={`${styles.item} ${styles.comingRow}`}>
                  <SidebarIcon name="chat" />
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
            <SidebarIcon name="help" />
          </a>
          <ThemeCycleButton className={styles.iconButton} sidebar />
        </div>
      </div>
    </aside>
  );
}
