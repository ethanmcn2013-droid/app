"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { WorkspaceBoardColumnsProvider } from "../../columns-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import type { TasksOptionProps } from "../../option-contract";
import { useLabStore } from "../../store";
import { ViewTabs } from "../../shared/lab-chrome";
import { Icon } from "../../shared/icons";
import { PlanningRail } from "../c/planning-rail";
import { WorkspaceBrief } from "../b/workspace-brief";
import { CalendarView as BCalendarView } from "../b/calendar-view";
import { BoardView } from "../a/board-view";
import { ListView } from "../a/list-view";
import { TimelineView } from "../a/timeline-view";
import { INITIAL_LIST_COLUMNS, projectTasks, type ListColumn } from "../a/quiet-command-model";
import { ActiveFilterChips, ViewToolButtons, ViewToolPanels, useVisibleLabTasks, type ViewToolPanel } from "../../view-tools";
import { ShortcutsDialog } from "../../shared/shortcuts-dialog";
import { activeUnscheduledTasks } from "../../planning";
import { CLOSE_NAV_DRAWER_EVENT, CLOSE_PLANNING_EVENT } from "@/components/app/tasks-nav-state";
import { ShareButton } from "@/components/app/share/share-button";
import { PageActionsOverflow } from "@/components/app/page-header";
import type { ShareView } from "@/server/actions/share";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { BoardGhost, CalendarGhost, ListGhost, TimelineGhost } from "@/components/app/empty-state/ghost-views";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { usePersonalization } from "@/lib/domain-context";
import type { CalendarDate } from "../../types";
import briefStyles from "../b/option-b.module.css";
import styles from "../a/option-a.module.css";

/** Drawer visibility is a view preference, like folded lanes — one key.
 *  Same external-store shape as useCollapsedLanes (board-view.tsx): the
 *  server snapshot is "closed", the client read is post-hydration, and the
 *  storage event keeps two tabs agreeing. */
const PLANNING_STORAGE_KEY = "signal-tasks.board.planning-open";

let planningCache: { raw: string | null; value: boolean } = { raw: null, value: false };

function readPlanningOpen(): boolean {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PLANNING_STORAGE_KEY);
  } catch {
    /* private mode — the drawer simply starts closed */
  }
  if (raw !== planningCache.raw) planningCache = { raw, value: raw === "open" };
  return planningCache.value;
}

const planningListeners = new Set<() => void>();

function subscribePlanningOpen(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PLANNING_STORAGE_KEY) listener();
  };
  planningListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    planningListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Non-hook read for the cross-drawer truce listener. */
function readPlanningOpenForTruce(): boolean {
  return readPlanningOpen();
}

function usePlanningOpen() {
  const open = useSyncExternalStore(subscribePlanningOpen, readPlanningOpen, () => false);
  const toggle = useCallback(() => {
    const next = !readPlanningOpen();
    try {
      window.localStorage.setItem(PLANNING_STORAGE_KEY, next ? "open" : "closed");
    } catch {
      /* persistence failed — still toggle for this session via the cache */
      planningCache = { raw: planningCache.raw, value: next };
    }
    planningListeners.forEach((notify) => notify());
  }, []);
  return [open, toggle] as const;
}

// T·97 heritage: arbitrary-variant overrides that repaint the wrapped
// production Share/overflow trigger buttons in the band's ghost register.
// Targets `> div > button` so only the trigger is restyled, never the
// popover/menu buttons inside it.
const bandButtonWrap =
  "[&>div>button]:!h-[30px] [&>div>button]:!min-h-[30px] [&>div>button]:!rounded-md " +
  "[&>div>button]:!border-0 [&>div>button]:!bg-transparent " +
  "[&>div>button]:!text-[var(--x-task-text-secondary)] " +
  "[&>div>button]:!text-[12px] [&>div>button]:!font-medium " +
  "[&>div>button]:!px-2.5 [&>div>button]:!gap-1.5 " +
  "hover:[&>div>button]:!text-[var(--x-task-text)] " +
  "hover:[&>div>button]:!bg-[var(--x-task-hover)]";

export function OptionHybrid({ route, onRouteChange }: TasksOptionProps) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const [columns, setColumns] = useState<ListColumn[]>(() => INITIAL_LIST_COLUMNS.map((column) => ({ ...column })));
  const [planningOpen, togglePlanning] = usePlanningOpen();
  const planningCollapsed = !planningOpen;
  // Drawer truce: anything (the local Tasks navigation, notably) can ask
  // the planning drawer to close; and opening planning on a phone asks
  // the navigation drawer to yield, so two modal panels never stack.
  useEffect(() => {
    const onClose = () => { if (readPlanningOpenForTruce()) togglePlanning(); };
    window.addEventListener(CLOSE_PLANNING_EVENT, onClose);
    return () => window.removeEventListener(CLOSE_PLANNING_EVENT, onClose);
  }, [togglePlanning]);
  const openPlanningExclusive = () => {
    if (planningCollapsed && window.matchMedia("(max-width: 767px)").matches) {
      window.dispatchEvent(new CustomEvent(CLOSE_NAV_DRAWER_EVENT));
    }
    togglePlanning();
  };
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(
    () => calendar.today as CalendarDate,
  );

  // "?" opens the keyboard reference — the replacement for the retired
  // always-on legend strip. Ignored while typing anywhere editable.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      setShortcutsOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // T·125: the room tools are back. The four views render the filtered,
  // sorted list; the brief and planning rail keep the whole project so
  // receipts and counts never quietly shrink to a filtered subset.
  const wholeProject = useMemo(() => projectTasks(store.tasks, "", "all", "manual"), [store.tasks]);
  const visibleTasks = useVisibleLabTasks(wholeProject);
  const [toolPanel, setToolPanel] = useState<ViewToolPanel>(null);
  const toggleToolPanel = (next: Exclude<ViewToolPanel, null>) => {
    setToolPanel((value) => (value === next ? null : next));
  };

  const personalization = usePersonalization();
  const { clearFilters, activeFilterCount } = useRoomTools();

  // The one definition of "needs a date" (planning.ts): the badge, the
  // drawer list and the tab count all read it, so they cannot disagree —
  // and finished work never counts as a planning obligation.
  const unscheduledCount = useMemo(
    () => activeUnscheduledTasks(wholeProject).length,
    [wholeProject],
  );
  const shareView = route.view as ShareView;

  // Personalized first-run state (restored from the pre-consolidation
  // views): when the project has no tasks at all, the view gives way to
  // the guided empty state over that view's structural ghost. A view
  // emptied only by filters keeps its chrome — the notice below the bar
  // says why it is empty and offers the way back.
  const view = wholeProject.length === 0 ? (
    <EmptyStateOverlay
      body={personalization.body}
      ghost={
        route.view === "board" ? <BoardGhost />
          : route.view === "list" ? <ListGhost />
            : route.view === "timeline" ? <TimelineGhost />
              : <CalendarGhost />
      }
      headline={personalization.headline}
      primaryLabel={personalization.firstTaskExample}
    />
  ) : route.view === "board" ? <BoardView tasks={visibleTasks} />
    : route.view === "list" ? <ListView columns={columns} group="status" setColumns={setColumns} tasks={visibleTasks} />
      : route.view === "timeline" ? <TimelineView tasks={visibleTasks} />
        : (
          <BCalendarView
            onSelectedDateChange={setSelectedDate}
            selectedDate={selectedDate}
            tasks={visibleTasks}
          />
        );

  const filteredToNothing = wholeProject.length > 0 && visibleTasks.length === 0 && activeFilterCount > 0;

  return (
    <WorkspaceBoardColumnsProvider>
    <div className={styles.optionA} data-option="hybrid" data-planning-collapsed={planningCollapsed || undefined}>
      <section className={styles.workspaceShell}>
        {/* Project-level actions live on the project band, not the view
            toolbar: sharing and printing concern the project, and the
            Planning drawer frames the whole of it. */}
        <WorkspaceBrief
          actions={
            <>
              <span className={`hidden lg:inline-flex ${bandButtonWrap}`}>
                <ShareButton view={shareView} />
              </span>
              <button
                aria-controls="c-planning-rail"
                aria-expanded={!planningCollapsed}
                className={briefStyles.planningTrigger}
                onClick={openPlanningExclusive}
                title={planningCollapsed ? "Open the planning drawer" : "Close the planning drawer"}
                type="button"
              >
                <Icon name="panel" size={15} />
                Planning
                {unscheduledCount > 0 ? <strong>{unscheduledCount}<span className={styles.srOnly}> unscheduled tasks</span></strong> : null}
              </button>
              <span className={`inline-flex ${bandButtonWrap}`}>
                <PageActionsOverflow
                  printPath={`/print/${route.view}`}
                  shareView={shareView}
                  showShare
                />
              </span>
            </>
          }
          tasks={wholeProject}
        />
        <div className={styles.viewBar}>
          <div className={styles.tabsScroll}><ViewTabs onRouteChange={(patch) => { setToolPanel(null); onRouteChange(patch); }} route={route} /></div>
          <div aria-label="View controls" className={styles.functionalTools} role="toolbar">
            <ViewToolButtons onToggle={toggleToolPanel} panel={toolPanel} view={route.view} />
          </div>
        </div>
        <ShortcutsDialog onClose={() => setShortcutsOpen(false)} open={shortcutsOpen} view={route.view} />
        <ViewToolPanels
          onClose={() => setToolPanel(null)}
          onShowShortcuts={() => setShortcutsOpen(true)}
          panel={toolPanel}
          view={route.view}
        />
        <ActiveFilterChips />
        {filteredToNothing ? (
          <div className={styles.filterEmptyNotice} role="status">
            <span>Nothing matches the filters.</span>
            <button onClick={clearFilters} type="button">Clear filters</button>
          </div>
        ) : null}
        <section aria-label={`${route.view} view`} className={styles.activeView} data-view={route.view} data-work-surface="true">{view}</section>
      </section>
      <PlanningRail collapsed={planningCollapsed} onSelectedDate={setSelectedDate} onToggle={togglePlanning} selectedDate={selectedDate} tasks={wholeProject} view={route.view} />
    </div>
    </WorkspaceBoardColumnsProvider>
  );
}
