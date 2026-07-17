"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLabStore } from "../../store";
import { RailIcon } from "./signal-rail-icons";
import { ShellGlyph } from "./signal-rail-icons";
import { Icon } from "../../shared/icons";
import styles from "./signal-shell.module.css";

const DRAWER_QUERY = "(max-width: 1099px)";
const PREVIEW_TIP = "Preview only in this lab";

const PREVIEW_PROJECTS = ["Product readiness", "Brand & launch", "Partnerships", "Operations"];

function useDrawerViewport(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(DRAWER_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(subscribe, () => window.matchMedia(DRAWER_QUERY).matches, () => false);
}

function SidebarBody({ taskCount, onCurrentSelect }: { taskCount: number; onCurrentSelect?: () => void }) {
  const [publicLaunchOpen, setPublicLaunchOpen] = useState(true);
  return (
    <div className={styles.sidebarScroll}>
      <nav aria-label="Tasks shortcuts" className={styles.sidebarNav}>
        <button aria-disabled="true" className={styles.navRow} data-tip={`Inbox · ${PREVIEW_TIP}`} type="button">
          <RailIcon name="updates" size={16} />
          <span>Inbox</span>
          <span aria-label="4 unread" className={styles.navCount}>4</span>
        </button>
        <button aria-disabled="true" className={styles.navRow} data-tip={`My work · ${PREVIEW_TIP}`} type="button">
          <Icon name="agenda" size={16} strokeWidth={1.75} />
          <span>My work</span>
        </button>
        <button aria-disabled="true" className={styles.navRow} data-tip={`Assigned to me · ${PREVIEW_TIP}`} type="button">
          <Icon name="people" size={16} strokeWidth={1.75} />
          <span>Assigned to me</span>
        </button>
        <button aria-disabled="true" className={styles.navRow} data-tip={`Saved views · ${PREVIEW_TIP}`} type="button">
          <Icon name="focus" size={16} strokeWidth={1.75} />
          <span>Saved views</span>
        </button>
      </nav>
      <nav aria-label="Projects" className={styles.projectsSection}>
        <h2 className={styles.projectsHeading}>Projects</h2>
        <ul className={styles.projectTree}>
          <li>
            <button
              aria-controls="b-projects-public-launch"
              aria-expanded={publicLaunchOpen}
              className={styles.projectParent}
              data-project-row="public-launch"
              onClick={() => setPublicLaunchOpen((value) => !value)}
              type="button"
            >
              <span aria-hidden="true" className={styles.disclosure} data-open={publicLaunchOpen || undefined}>
                <ShellGlyph name="chevron" size={13} />
              </span>
              <span className={styles.projectName}>Public launch</span>
              <span className={styles.projectDate}>6 Jul – 14 Aug</span>
            </button>
            <ul className={styles.projectChildren} hidden={!publicLaunchOpen} id="b-projects-public-launch">
              <li>
                <button
                  aria-current="page"
                  className={styles.projectLeaf}
                  data-project-row="launch-workspace"
                  onClick={onCurrentSelect}
                  type="button"
                >
                  <span className={styles.projectName}>Launch workspace</span>
                  <span aria-label={`${taskCount} tasks`} className={styles.leafCount}>{taskCount}</span>
                </button>
              </li>
              <li>
                <button aria-disabled="true" className={styles.projectLeaf} data-project-row="customer-proof" data-tip={`Customer proof · ${PREVIEW_TIP}`} type="button">
                  <span className={styles.projectName}>Customer proof</span>
                </button>
              </li>
              <li>
                <button aria-disabled="true" className={styles.projectLeaf} data-project-row="launch-operations" data-tip={`Launch operations · ${PREVIEW_TIP}`} type="button">
                  <span className={styles.projectName}>Launch operations</span>
                </button>
              </li>
            </ul>
          </li>
          {PREVIEW_PROJECTS.map((name) => (
            <li key={name}>
              <button aria-disabled="true" className={styles.projectParent} data-project-row={name.toLowerCase().replace(/[^a-z]+/g, "-")} data-tip={`${name} · ${PREVIEW_TIP}`} type="button">
                <span aria-hidden="true" className={styles.disclosureGhost} />
                <span className={styles.projectName}>{name}</span>
              </button>
            </li>
          ))}
          <li>
            <button aria-disabled="true" className={styles.projectParent} data-project-row="personal-projects" data-tip={`Personal projects · private · ${PREVIEW_TIP}`} type="button">
              <span aria-hidden="true" className={styles.disclosureGhost} />
              <span className={styles.projectName}>Personal projects</span>
              <span className={styles.privacyMark}><ShellGlyph name="lock" size={12} /><span className={styles.srOnly}>Private</span></span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function SidebarHeader({ closeLabel, onClose, tip }: { closeLabel: string; onClose: () => void; tip: string }) {
  return (
    <header className={styles.sidebarHeader}>
      <div className={styles.sidebarIdentity}>
        <span className={styles.sidebarEyebrow}>Signal Studio</span>
        <strong className={styles.sidebarTitle}>Tasks</strong>
      </div>
      <button aria-label={closeLabel} className={styles.sidebarCollapse} data-tip={tip} onClick={onClose} type="button">
        <ShellGlyph name="panel" size={15} />
      </button>
    </header>
  );
}

export function ProjectsSidebar() {
  const store = useLabStore();
  const drawerMode = useDrawerViewport();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const collapseIntent = useRef(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const taskCount = store.tasks.length;

  const [wasDrawerMode, setWasDrawerMode] = useState(drawerMode);
  if (wasDrawerMode !== drawerMode) {
    setWasDrawerMode(drawerMode);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (collapsed && collapseIntent.current) expandButtonRef.current?.focus();
  }, [collapsed]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    drawerTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const dialog = drawerRef.current;
    dialog?.querySelector<HTMLElement>("button:not([aria-disabled='true'])")?.focus();
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
    const focusable = [...dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")];
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
        <div className={styles.sidebarStrip}>
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
              <SidebarBody onCurrentSelect={closeDrawer} taskCount={taskCount} />
            </div>
          </>
        ) : null}
      </>
    );
  }

  if (collapsed) {
    return (
      <div className={styles.sidebarStrip}>
        <button
          aria-expanded={false}
          aria-label="Expand Projects sidebar"
          className={styles.stripButton}
          data-tip="Expand Projects sidebar"
          onClick={() => setCollapsed(false)}
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
    <aside aria-label="Tasks projects" className={styles.projectsSidebar} data-projects-sidebar="true">
      <SidebarHeader
        closeLabel="Collapse Projects sidebar"
        onClose={() => {
          collapseIntent.current = true;
          setCollapsed(true);
        }}
        tip="Collapse Projects sidebar"
      />
      <SidebarBody taskCount={taskCount} />
      <div aria-hidden="true" className={styles.sidebarFoot} />
    </aside>
  );
}
