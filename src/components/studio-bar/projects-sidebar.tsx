"use client";

/**
 * Tasks Projects sidebar — ported 1:1 from the Option B lab (T·95 lab
 * parity): identity header with collapse, the four nav rows, and the
 * PROJECTS tree, with the lab's collapse-to-strip and narrow-width
 * drawer. Every row is live: the tree is real planning periods and
 * workspaces (leaf click switches workspace), counts are real task
 * counts, Saved views opens the room's saved-view list.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { openTaskCount } from "@/lib/tasks/selectors";
import { selectWorkspaceAction } from "@/server/actions/cross-workspace";
import {
  archiveProjectAction,
  createProjectAction,
  deleteProjectAction,
  restoreProjectAction,
} from "@/server/actions/planning";
import type {
  ProjectsTreeData,
  ProjectsTreeLeaf,
} from "@/server/actions/projects-tree";
import { RailIcon, ShellGlyph, SidebarGlyph } from "./rail-icons";
import {
  CLOSE_NAV_DRAWER_EVENT,
  closeNavDrawer,
  collapseNavPanel,
  useTasksNav,
} from "@/components/app/tasks-nav-state";
import styles from "./signal-shell.module.css";

const DRAWER_QUERY = "(max-width: 1099px)";
const SIDEBAR_WIDTH_KEY = "signal-tasks.projects-sidebar-width";
const SIDEBAR_MIN_WIDTH = 196;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 236;

function clampSidebarWidth(value: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

function useDrawerViewport(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(DRAWER_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DRAWER_QUERY).matches,
    () => false,
  );
}

/**
 * Quiet "Add project" row at the foot of the Projects tree (T·97).
 * At rest it reads like a nav row with a "+" glyph. Clicking reveals
 * an inline input (mirrors the board's Add-column pattern): Enter
 * creates the project via `createProjectAction`, switches to it, and
 * refreshes; Escape or an empty blur cancels.
 */
function AddProjectRow({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function cancel() {
    setAdding(false);
    setDraft("");
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProjectAction(trimmed, null);
        await selectWorkspaceAction(result.id);
        window.sessionStorage.setItem("signal-tasks.recent-project", result.id);
        setAdding(false);
        setDraft("");
        onCreated?.();
        router.refresh();
      } catch {
        // Keep the draft so the founder can retry or amend the name.
      }
    });
  }

  if (adding) {
    return (
      <li>
        <div className={styles.projectParent}>
          <span aria-hidden="true" className={styles.disclosureGhost} />
          <input
            aria-label="New project name"
            className={styles.addProjectInput}
            disabled={pending}
            onBlur={() => {
              if (!draft.trim()) cancel();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder="Project name"
            ref={inputRef}
            value={draft}
          />
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        className={styles.projectParent}
        onClick={() => setAdding(true)}
        type="button"
      >
        <span aria-hidden="true" className={styles.disclosureGhost}>
          <svg
            aria-hidden="true"
            fill="none"
            height={13}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.75}
            style={{ display: "block" }}
            viewBox="0 0 24 24"
            width={13}
          >
            <path d="M12 5.75v12.5M5.75 12h12.5" />
          </svg>
        </span>
        <span className={styles.projectName}>Add project</span>
      </button>
    </li>
  );
}

/**
 * Per-project overflow menu (the ⋯ that appears on row hover). Hosts the
 * project lifecycle: Archive / Restore and Delete (delete is a two-step
 * confirm — no undo). Owner-gated server-side; the button is best-effort UI.
 */
function ProjectRowMenu({
  workspaceId,
  name,
  archived,
  onDone,
}: {
  workspaceId: string;
  name: string;
  archived: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        console.warn("project action failed", e);
      }
      setOpen(false);
      setConfirmingDelete(false);
      onDone();
    });
  }

  const itemStyle: CSSProperties = {
    alignItems: "center",
    background: "transparent",
    border: 0,
    borderRadius: 6,
    color: "var(--x-task-text-secondary)",
    cursor: "pointer",
    display: "flex",
    font: "inherit",
    fontSize: 11.5,
    gap: 8,
    padding: "7px 8px",
    textAlign: "left",
    width: "100%",
  };

  return (
    <div className={styles.projectRowMenu} data-open={open || undefined} ref={wrapRef}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Project options for ${name}`}
        className={styles.projectRowMenuBtn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setConfirmingDelete(false);
        }}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1, transform: "scale(1)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.99)" }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.985)" }}
          role="menu"
          aria-label={`${name} options`}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--x-task-overlay)",
            border: "1px solid var(--x-task-border)",
            borderRadius: 8,
            boxShadow: "var(--x-task-shadow)",
            padding: 5,
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            transformOrigin: "top right",
            width: 176,
            zIndex: 70,
          }}
          transition={{ duration: reduceMotion ? 0.1 : 0.14, ease: [0.23, 1, 0.32, 1] }}
        >
          {archived ? (
            <button
              disabled={pending}
              onClick={() => run(() => restoreProjectAction(workspaceId))}
              role="menuitem"
              style={itemStyle}
              type="button"
            >
              <RailIcon name="updates" size={14} />
              Restore project
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => run(() => archiveProjectAction(workspaceId))}
              role="menuitem"
              style={itemStyle}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                <path d="M10 12h4" />
              </svg>
              Archive project
            </button>
          )}
          {confirmingDelete ? (
            <button
              disabled={pending}
              onClick={() => run(() => deleteProjectAction(workspaceId))}
              role="menuitem"
              style={{ ...itemStyle, color: "var(--x-task-danger)" }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              {pending ? "Deleting…" : "Delete forever"}
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
              role="menuitem"
              style={{ ...itemStyle, color: "var(--x-task-danger)" }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete project
            </button>
          )}
          {confirmingDelete ? (
            <p
              style={{
                color: "var(--x-task-text-muted)",
                fontSize: 10,
                lineHeight: 1.45,
                margin: "2px 6px 4px",
              }}
            >
              Deletes every task in {name}. This can’t be undone.
            </p>
          ) : null}
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarBody({
  tree,
  activeWorkspaceId,
  onNavigate,
  projectsOpen,
}: {
  tree: ProjectsTreeData;
  activeWorkspaceId: string;
  onNavigate?: () => void;
  projectsOpen: boolean;
}) {
  const pathname = usePathname() ?? "";
  // A project reads as "where you are" only on the Tasks views
  // themselves - on Home, Inbox or My work, exactly one row lights up.
  const onTasksSurface = pathname === "/app/tasks" || pathname.startsWith("/app/tasks/");
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const tasks = useTasksState();
  const inboxCount = openTaskCount(tasks);
  const [, startTransition] = useTransition();
  const [switchPendingId, setSwitchPendingId] = useState<string | null>(null);
  const [showSwitchPending, setShowSwitchPending] = useState(false);
  const [recentProjectId, setRecentProjectId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    if (!switchPendingId) return;
    const timer = window.setTimeout(() => setShowSwitchPending(true), 300);
    return () => window.clearTimeout(timer);
  }, [switchPendingId]);

  useEffect(() => {
    const recent = window.sessionStorage.getItem("signal-tasks.recent-project");
    if (!recent || !tree.groups.some((group) => group.workspaces.some((workspace) => workspace.id === recent))) return;
    window.sessionStorage.removeItem("signal-tasks.recent-project");
    let timer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      setRecentProjectId(recent);
      timer = window.setTimeout(() => setRecentProjectId(null), 520);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [tree]);

  function chooseWorkspace(id: string) {
    onNavigate?.();
    if (id === activeWorkspaceId) return;
    startTransition(async () => {
      setShowSwitchPending(false);
      setSwitchPendingId(id);
      try {
        await selectWorkspaceAction(id);
        router.refresh();
      } finally {
        setShowSwitchPending(false);
        setSwitchPendingId(null);
      }
    });
  }

  const refreshTree = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  return (
    <div className={styles.sidebarScroll}>
      {/* "Shortcuts", not "Tasks": Home lives here for convenience but
          isn't a Tasks feature, and the label shouldn't claim it is. */}
      <nav aria-label="Shortcuts" className={styles.sidebarNav}>
        {/* Home leads: the suite landing left the black rail (pass 4),
            so local navigation is its front door. */}
        <Link
          aria-current={pathname === "/app/home" || pathname.startsWith("/app/home/") ? "page" : undefined}
          className={styles.navRow}
          href="/app/home"
          onClick={onNavigate}
        >
          <RailIcon name="home" size={16} />
          <span>Home</span>
        </Link>
        <Link
          aria-current={pathname === "/app/inbox" ? "page" : undefined}
          className={styles.navRow}
          href="/app/inbox"
          onClick={onNavigate}
        >
          <RailIcon name="updates" size={16} />
          <span>Inbox</span>
          {inboxCount > 0 ? (
            <span aria-label={`${inboxCount} open`} className={styles.navCount}>
              {inboxCount}
            </span>
          ) : null}
        </Link>
        <Link
          aria-current={pathname === "/app/my-tasks" ? "page" : undefined}
          className={styles.navRow}
          href="/app/my-tasks"
          onClick={onNavigate}
        >
          <SidebarGlyph name="agenda" size={16} />
          <span>My work</span>
        </Link>
      </nav>
      {projectsOpen ? <nav aria-label="Project folders" className={styles.projectsSection} id="projects-tree-panel">
        <h2 className={styles.projectsLabel}>Project folders</h2>
        <ul className={styles.projectTree}>
          {/* Projects used to be grouped under a planning-period name + date
              row (T·95 lab parity). The founder had that removed 2026-08-05:
              it repeated the "Active work" period the brief header's crumb
              also dropped, and every venue only ever has the one bucket to
              group by. Every project is a flat top-level row now — the
              ghost span keeps the name column aligned with Archived's
              chevron below. */}
          {tree.groups.flatMap((group) => group.workspaces).map((w) => (
            <li key={w.id}>
              <div className={styles.projectRowWrap} data-recently-placed={recentProjectId === w.id || undefined}>
                <button
                  aria-busy={showSwitchPending && switchPendingId === w.id || undefined}
                  aria-current={onTasksSurface && w.id === activeWorkspaceId ? "page" : undefined}
                  className={styles.projectParent}
                  data-active={w.id === activeWorkspaceId || undefined}
                  onClick={() => chooseWorkspace(w.id)}
                  type="button"
                >
                  <span aria-hidden="true" className={styles.disclosureGhost} />
                  <span className={styles.projectName} title={w.name}>{w.name}</span>
                  <span className={styles.leafCount}>
                    {w.taskCount}
                    <span className="sr-only"> task{w.taskCount === 1 ? "" : "s"}</span>
                  </span>
                </button>
                <ProjectRowMenu
                  archived={false}
                  name={w.name}
                  onDone={refreshTree}
                  workspaceId={w.id}
                />
              </div>
            </li>
          ))}
          <AddProjectRow onCreated={onNavigate} />
          {tree.archived.length > 0 ? (
            <li>
              <button
                aria-controls="projects-archived"
                aria-expanded={archivedOpen}
                className={styles.projectParent}
                onClick={() => setArchivedOpen((v) => !v)}
                type="button"
              >
                <span aria-hidden="true" className={styles.disclosure} data-open={archivedOpen || undefined}>
                  <ShellGlyph name="chevron" size={13} />
                </span>
                <span className={styles.projectName}>Archived</span>
                <span className={styles.leafCount}>
                  {tree.archived.length}
                  <span className="sr-only"> archived</span>
                </span>
              </button>
              <AnimatePresence initial={false}>
              {archivedOpen ? <motion.ul
                animate={{ opacity: 1, transform: "translateY(0)" }}
                className={styles.projectChildren}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
                id="projects-archived"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
                transition={{ duration: reduceMotion ? 0.1 : 0.16, ease: [0.23, 1, 0.32, 1] }}
              >
                {tree.archived.map((w: ProjectsTreeLeaf) => (
                  <li key={w.id}>
                    <div className={styles.projectRowWrap}>
                      <span className={styles.projectLeaf} data-archived="true">
                        <span className={styles.projectName} title={w.name}>{w.name}</span>
                        <span className={styles.leafCount}>
                          {w.taskCount}
                          <span className="sr-only"> task{w.taskCount === 1 ? "" : "s"}</span>
                        </span>
                      </span>
                      <ProjectRowMenu
                        archived
                        name={w.name}
                        onDone={refreshTree}
                        workspaceId={w.id}
                      />
                    </div>
                  </li>
                ))}
              </motion.ul> : null}
              </AnimatePresence>
            </li>
          ) : null}
        </ul>
      </nav> : null}
    </div>
  );
}

function SidebarHeader({
  closeLabel,
  onClose,
  onProjectsToggle,
  projectsOpen,
  tip,
}: {
  closeLabel: string;
  onClose: () => void;
  onProjectsToggle: () => void;
  projectsOpen: boolean;
  tip: string;
}) {
  return (
    <header className={styles.sidebarHeader}>
      {/* A quiet local-navigation label — the brand lockup lives in the
          black bar; this is just "where inside Tasks". */}
      <button
        aria-controls="projects-tree-panel"
        aria-expanded={projectsOpen}
        className={styles.sidebarPicker}
        onClick={onProjectsToggle}
        type="button"
      >
        <span className={styles.sidebarTitle}>Projects</span>
        <span aria-hidden="true" className={styles.disclosure} data-open={projectsOpen || undefined}>
          <ShellGlyph name="chevron" size={13} />
        </span>
      </button>
      <button
        aria-label={closeLabel}
        className={styles.sidebarCollapse}
        data-tip={tip}
        onClick={onClose}
        type="button"
      >
        <ShellGlyph name="panel" size={15} />
      </button>
    </header>
  );
}

export function ProjectsSidebar({
  tree,
  activeWorkspaceId,
}: {
  tree: ProjectsTreeData;
  activeWorkspaceId: string;
}) {
  const drawerMode = useDrawerViewport();
  const reduceMotion = useReducedMotion();
  // Visibility lives in the shared nav store: the band trigger and this
  // panel read one truth, and a collapsed panel renders NOTHING - no
  // strip, no reserved width.
  const { expanded, drawerOpen } = useTasksNav();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);

  useEffect(() => {
    let frame = 0;
    try {
      const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
      if (Number.isFinite(stored) && stored > 0) {
        const next = clampSidebarWidth(stored);
        frame = window.requestAnimationFrame(() => {
          sidebarWidthRef.current = next;
          setSidebarWidth(next);
        });
      }
    } catch {
      // A blocked preference store leaves the authored default intact.
    }

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateSidebarWidth = useCallback((value: number, persist = false) => {
    const next = clampSidebarWidth(value);
    sidebarWidthRef.current = next;
    setSidebarWidth(next);
    if (persist) {
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
      } catch {
        // Resizing remains live for this session when storage is unavailable.
      }
    }
  }, []);

  const beginSidebarResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidthRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = (pointerEvent: globalThis.PointerEvent) => {
      updateSidebarWidth(startWidth + pointerEvent.clientX - startX);
    };
    const finish = () => {
      updateSidebarWidth(sidebarWidthRef.current, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }, [updateSidebarWidth]);

  const [wasDrawerMode, setWasDrawerMode] = useState(drawerMode);
  if (wasDrawerMode !== drawerMode) {
    setWasDrawerMode(drawerMode);
    closeNavDrawer();
  }

  const focusBandTrigger = useCallback(() => {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[aria-label="Open Tasks navigation"]')
        ?.focus();
    });
  }, []);

  const closeDrawer = useCallback(() => {
    closeNavDrawer();
    focusBandTrigger();
  }, [focusBandTrigger]);

  // The planning drawer (or anything else) can ask this one to yield.
  useEffect(() => {
    const onClose = () => closeNavDrawer();
    window.addEventListener(CLOSE_NAV_DRAWER_EVENT, onClose);
    return () => window.removeEventListener(CLOSE_NAV_DRAWER_EVENT, onClose);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current
      ?.querySelector<HTMLElement>("button, [href]")
      ?.focus();
  }, [drawerOpen]);

  const onDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = drawerRef.current;
    if (!dialog) return;
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (drawerMode) {
    return (
      <>
        <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              aria-hidden="true"
              className={styles.drawerBackdrop}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={closeDrawer}
              transition={{ duration: reduceMotion ? 0.1 : 0.16, ease: [0.23, 1, 0.32, 1] }}
            />
            <motion.div
              animate={{ opacity: 1, transform: "translateX(0)" }}
              aria-label="Tasks navigation"
              aria-modal="true"
              className={styles.projectsDrawer}
              data-projects-drawer="true"
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateX(-18px)" }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateX(-18px)" }}
              onKeyDown={onDrawerKeyDown}
              ref={drawerRef}
              role="dialog"
              transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              <SidebarHeader
                closeLabel="Close Tasks navigation"
                onClose={closeDrawer}
                onProjectsToggle={() => setProjectsOpen((value) => !value)}
                projectsOpen={projectsOpen}
                tip="Close Tasks navigation"
              />
              <SidebarBody
                activeWorkspaceId={activeWorkspaceId}
                onNavigate={closeDrawer}
                projectsOpen={projectsOpen}
                tree={tree}
              />
            </motion.div>
          </>
        ) : null}
        </AnimatePresence>
      </>
    );
  }

  // Collapsed means gone: the board takes every pixel back and the
  // band trigger is the way home.
  if (!expanded) return null;

  return (
    <nav
      aria-label="Tasks navigation"
      className={`${styles.projectsSidebarHost} hidden md:block`}
      style={{ "--projects-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <div
        className={styles.projectsSidebar}
        data-projects-sidebar="true"
        ref={sidebarRef}
      >
        <SidebarHeader
          closeLabel="Collapse Tasks navigation"
          onClose={() => {
            collapseNavPanel();
            focusBandTrigger();
          }}
          onProjectsToggle={() => setProjectsOpen((value) => !value)}
          projectsOpen={projectsOpen}
          tip="Collapse Tasks navigation"
        />
        <SidebarBody activeWorkspaceId={activeWorkspaceId} projectsOpen={projectsOpen} tree={tree} />
        <div aria-hidden="true" className={styles.sidebarFoot} />
      </div>
      <button
        aria-label="Resize Projects sidebar"
        aria-orientation="vertical"
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuenow={sidebarWidth}
        className={styles.sidebarResizer}
        onDoubleClick={() => updateSidebarWidth(SIDEBAR_DEFAULT_WIDTH, true)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
          event.preventDefault();
          if (event.key === "Home") updateSidebarWidth(SIDEBAR_DEFAULT_WIDTH, true);
          else updateSidebarWidth(sidebarWidthRef.current + (event.key === "ArrowRight" ? 12 : -12), true);
        }}
        onPointerDown={beginSidebarResize}
        role="separator"
        title="Drag to resize. Double-click to reset."
        type="button"
      />
    </nav>
  );
}
