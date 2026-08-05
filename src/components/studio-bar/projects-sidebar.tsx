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
import styles from "./signal-shell.module.css";

const DRAWER_QUERY = "(max-width: 1099px)";

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
}: {
  tree: ProjectsTreeData;
  activeWorkspaceId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const tasks = useTasksState();
  const inboxCount = openTaskCount(tasks);
  const [, startTransition] = useTransition();
  const [switchPendingId, setSwitchPendingId] = useState<string | null>(null);
  const [showSwitchPending, setShowSwitchPending] = useState(false);
  const [recentProjectId, setRecentProjectId] = useState<string | null>(null);
  const activeGroup = tree.groups.find((g) =>
    g.workspaces.some((w) => w.id === activeWorkspaceId),
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroup?.periodId ? { [activeGroup.periodId]: true } : {},
  );
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
      <nav aria-label="Tasks shortcuts" className={styles.sidebarNav}>
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
      <nav aria-label="Projects" className={styles.projectsSection}>
        <h2 className="sr-only">Projects</h2>
        <ul className={styles.projectTree}>
          {tree.groups.map((group) => {
            if (group.periodId) {
              const open = openGroups[group.periodId] ?? false;
              const domId = `projects-${group.periodId}`;
              return (
                <li key={group.periodId}>
                  <button
                    aria-controls={domId}
                    aria-expanded={open}
                    className={styles.projectParent}
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [group.periodId as string]: !open,
                      }))
                    }
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.disclosure} data-open={open || undefined}>
                      <ShellGlyph name="chevron" size={13} />
                    </span>
                    <span className={styles.projectName} title={group.periodName ?? undefined}>{group.periodName}</span>
                    {group.dateRange ? (
                      <span className={styles.projectDate} title={`Planning period · ${group.dateRange}`}>{group.dateRange}</span>
                    ) : null}
                  </button>
                  <AnimatePresence initial={false}>
                  {open ? <motion.ul
                    animate={{ opacity: 1, transform: "translateY(0)" }}
                    className={styles.projectChildren}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
                    id={domId}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
                    transition={{ duration: reduceMotion ? 0.1 : 0.16, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {group.workspaces.map((w) => (
                      <li key={w.id}>
                        <div className={styles.projectRowWrap} data-recently-placed={recentProjectId === w.id || undefined}>
                          <button
                            aria-busy={showSwitchPending && switchPendingId === w.id || undefined}
                            aria-current={w.id === activeWorkspaceId ? "page" : undefined}
                            className={styles.projectLeaf}
                            onClick={() => chooseWorkspace(w.id)}
                            type="button"
                          >
                            <span className={styles.projectName} title={w.name}>{w.name}</span>
                            <span aria-label={`${w.taskCount} tasks`} className={styles.leafCount}>
                              {w.taskCount}
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
                  </motion.ul> : null}
                  </AnimatePresence>
                </li>
              );
            }
            // Periodless workspaces: standalone parent-level rows.
            return group.workspaces.map((w) => (
              <li key={w.id}>
                <div className={styles.projectRowWrap} data-recently-placed={recentProjectId === w.id || undefined}>
                  <button
                    aria-busy={showSwitchPending && switchPendingId === w.id || undefined}
                    aria-current={w.id === activeWorkspaceId ? "page" : undefined}
                    className={styles.projectParent}
                    data-active={w.id === activeWorkspaceId || undefined}
                    onClick={() => chooseWorkspace(w.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.disclosureGhost} />
                    <span className={styles.projectName} title={w.name}>{w.name}</span>
                    <span aria-label={`${w.taskCount} tasks`} className={styles.leafCount}>
                      {w.taskCount}
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
            ));
          })}
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
                <span aria-label={`${tree.archived.length} archived`} className={styles.leafCount}>
                  {tree.archived.length}
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
                        <span aria-label={`${w.taskCount} tasks`} className={styles.leafCount}>
                          {w.taskCount}
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
      </nav>
    </div>
  );
}

function SidebarHeader({
  closeLabel,
  onClose,
  tip,
}: {
  closeLabel: string;
  onClose: () => void;
  tip: string;
}) {
  return (
    <header className={styles.sidebarHeader}>
      {/* The panel says what it is — a lone icon read as an unlabeled
          mystery row. Same height, one word. */}
      <span className={styles.sidebarTitle}>Projects</span>
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
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapseIntent = useRef(false);
  const expandIntent = useRef(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  const [wasDrawerMode, setWasDrawerMode] = useState(drawerMode);
  if (wasDrawerMode !== drawerMode) {
    setWasDrawerMode(drawerMode);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (collapsed && collapseIntent.current) {
      collapseIntent.current = false;
      expandButtonRef.current?.focus();
    }
    if (!collapsed && expandIntent.current) {
      expandIntent.current = false;
      sidebarRef.current
        ?.querySelector<HTMLElement>('[aria-label="Collapse Projects sidebar"]')
        ?.focus();
    }
  }, [collapsed]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    drawerTriggerRef.current?.focus();
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
        <div className={`${styles.sidebarStrip} hidden md:flex`}>
          <button
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            aria-label="Open Projects"
            className={styles.stripButton}
            data-tip="Open Projects"
            onClick={() => setDrawerOpen(true)}
            ref={drawerTriggerRef}
            type="button"
          >
            <ShellGlyph name="panel" size={15} />
          </button>
          <span aria-hidden="true" className={styles.stripLabel}>Projects</span>
        </div>
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
              aria-label="Tasks projects"
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
              <SidebarHeader closeLabel="Close Projects" onClose={closeDrawer} tip="Close Projects" />
              <SidebarBody
                activeWorkspaceId={activeWorkspaceId}
                onNavigate={closeDrawer}
                tree={tree}
              />
            </motion.div>
          </>
        ) : null}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className={`${styles.projectsSidebarHost} hidden md:block`} data-collapsed={collapsed || undefined}>
      {collapsed ? (
        <div className={`${styles.sidebarStrip} flex`}>
          <button
            aria-expanded={false}
            aria-label="Expand Projects sidebar"
            className={styles.stripButton}
            data-tip="Expand Projects sidebar"
            onClick={() => {
              expandIntent.current = true;
              setCollapsed(false);
            }}
            ref={expandButtonRef}
            type="button"
          >
            <ShellGlyph name="panel" size={15} />
          </button>
          <span aria-hidden="true" className={styles.stripLabel}>Projects</span>
        </div>
      ) : (
        <aside
          aria-label="Tasks projects"
          className={styles.projectsSidebar}
          data-projects-sidebar="true"
          ref={sidebarRef}
        >
          <SidebarHeader
            closeLabel="Collapse Projects sidebar"
            onClose={() => {
              collapseIntent.current = true;
              setCollapsed(true);
            }}
            tip="Collapse Projects sidebar"
          />
          <SidebarBody activeWorkspaceId={activeWorkspaceId} tree={tree} />
          <div aria-hidden="true" className={styles.sidebarFoot} />
        </aside>
      )}
    </div>
  );
}
