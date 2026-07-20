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
import { useRoomTools } from "@/components/app/room/room-tools-context";
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

function SavedViewsRow() {
  const { savedViews, applySavedView, deleteSavedView } = useRoomTools();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.navRow}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <SidebarGlyph name="focus" size={16} />
        <span>Saved views</span>
        {savedViews.length > 0 ? (
          <span className={styles.navCount}>{savedViews.length}</span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Saved views"
          style={{
            background: "var(--x-task-overlay)",
            border: "1px solid var(--x-task-border)",
            borderRadius: 8,
            boxShadow: "var(--x-task-shadow)",
            left: 8,
            padding: 6,
            position: "absolute",
            top: "calc(100% + 4px)",
            width: 220,
            zIndex: 60,
          }}
        >
          {savedViews.length === 0 ? (
            <p
              style={{
                color: "var(--x-task-text-muted)",
                fontSize: 10,
                lineHeight: 1.5,
                margin: 0,
                padding: "6px 8px",
              }}
            >
              Save a view from the view bar and it lands here.
            </p>
          ) : (
            savedViews.map((v) => (
              <div key={v.id} style={{ alignItems: "center", display: "flex", gap: 4 }}>
                <button
                  className={styles.navRow}
                  onClick={() => {
                    setOpen(false);
                    applySavedView(v.id);
                  }}
                  type="button"
                >
                  <span className={styles.projectName}>{v.name}</span>
                  <span className={styles.navCount}>{v.view}</span>
                </button>
                <button
                  aria-label={`Delete saved view ${v.name}`}
                  className={styles.sidebarCollapse}
                  onClick={() => deleteSavedView(v.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
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
      {open ? (
        <div
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
            width: 176,
            zIndex: 70,
          }}
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
              style={{ ...itemStyle, color: "var(--x-task-danger, #dc2626)" }}
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
              style={{ ...itemStyle, color: "var(--x-task-danger, #dc2626)" }}
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
        </div>
      ) : null}
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
  const router = useRouter();
  const tasks = useTasksState();
  const inboxCount = openTaskCount(tasks);
  const [, startTransition] = useTransition();
  const activeGroup = tree.groups.find((g) =>
    g.workspaces.some((w) => w.id === activeWorkspaceId),
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroup?.periodId ? { [activeGroup.periodId]: true } : {},
  );
  const [archivedOpen, setArchivedOpen] = useState(false);

  function chooseWorkspace(id: string) {
    onNavigate?.();
    if (id === activeWorkspaceId) return;
    startTransition(async () => {
      await selectWorkspaceAction(id);
      router.refresh();
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
        <Link
          aria-current={pathname === "/app/your-work" ? "page" : undefined}
          className={styles.navRow}
          href="/app/your-work"
          onClick={onNavigate}
        >
          <SidebarGlyph name="people" size={16} />
          <span>Assigned to me</span>
        </Link>
        <Link
          aria-current={pathname === "/app/archived" ? "page" : undefined}
          className={styles.navRow}
          href="/app/archived"
          onClick={onNavigate}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
            <path d="M10 12h4" />
          </svg>
          <span>Archived</span>
        </Link>
        <SavedViewsRow />
      </nav>
      <nav aria-label="Projects" className={styles.projectsSection}>
        <h2 className={styles.projectsHeading}>Projects</h2>
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
                    <span className={styles.projectName}>{group.periodName}</span>
                    {group.dateRange ? (
                      <span className={styles.projectDate}>{group.dateRange}</span>
                    ) : null}
                  </button>
                  <ul className={styles.projectChildren} hidden={!open} id={domId}>
                    {group.workspaces.map((w) => (
                      <li key={w.id}>
                        <div className={styles.projectRowWrap}>
                          <button
                            aria-current={w.id === activeWorkspaceId ? "page" : undefined}
                            className={styles.projectLeaf}
                            onClick={() => chooseWorkspace(w.id)}
                            type="button"
                          >
                            <span className={styles.projectName}>{w.name}</span>
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
                  </ul>
                </li>
              );
            }
            // Periodless workspaces: standalone parent-level rows.
            return group.workspaces.map((w) => (
              <li key={w.id}>
                <div className={styles.projectRowWrap}>
                  <button
                    aria-current={w.id === activeWorkspaceId ? "page" : undefined}
                    className={styles.projectParent}
                    data-active={w.id === activeWorkspaceId || undefined}
                    onClick={() => chooseWorkspace(w.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.disclosureGhost} />
                    <span className={styles.projectName}>{w.name}</span>
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
              <ul className={styles.projectChildren} hidden={!archivedOpen} id="projects-archived">
                {tree.archived.map((w: ProjectsTreeLeaf) => (
                  <li key={w.id}>
                    <div className={styles.projectRowWrap}>
                      <span className={styles.projectLeaf} data-archived="true">
                        <span className={styles.projectName}>{w.name}</span>
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
              </ul>
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
      <div className={styles.sidebarIdentity}>
        <span className={styles.sidebarEyebrow}>Signal Studio</span>
        <strong className={styles.sidebarTitle}>Tasks</strong>
      </div>
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
        {drawerOpen ? (
          <>
            <div aria-hidden="true" className={styles.drawerBackdrop} onClick={closeDrawer} />
            <div
              aria-label="Tasks projects"
              aria-modal="true"
              className={styles.projectsDrawer}
              data-projects-drawer="true"
              onKeyDown={onDrawerKeyDown}
              ref={drawerRef}
              role="dialog"
            >
              <SidebarHeader closeLabel="Close Projects" onClose={closeDrawer} tip="Close Projects" />
              <SidebarBody
                activeWorkspaceId={activeWorkspaceId}
                onNavigate={closeDrawer}
                tree={tree}
              />
            </div>
          </>
        ) : null}
      </>
    );
  }

  if (collapsed) {
    return (
      <div className={`${styles.sidebarStrip} hidden md:flex`}>
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
    );
  }

  return (
    <aside
      aria-label="Tasks projects"
      className={`${styles.projectsSidebar} hidden md:flex`}
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
  );
}
