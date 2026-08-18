"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { WorkspaceBoardColumnsProvider } from "../../columns-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import type { TasksOptionProps } from "../../option-contract";
import { useLabStore } from "../../store";
import { ViewTabs } from "../../shared/lab-chrome";
import { Icon } from "../../shared/icons";
import { PlanningRail } from "../c/planning-rail";
import { WorkspaceBrief } from "../b/workspace-brief";
import { INITIAL_LIST_COLUMNS, projectTasks, type ListColumn } from "../a/quiet-command-model";
import { ActiveFilterChips, ViewToolButtons, ViewToolPanels, useVisibleLabTasks, type ViewToolPanel } from "../../view-tools";
import { ShortcutsDialog } from "../../shared/shortcuts-dialog";
import { activeUnscheduledTasks } from "../../planning";
import { CLOSE_NAV_DRAWER_EVENT, CLOSE_PLANNING_EVENT, useNavPanelHidden } from "@/components/app/tasks-nav-state";
import { TASKS_VIEW_PATHS } from "@/lib/product-urls";
import { Hint } from "@/components/primitives/hint";
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

/**
 * The four views are four chunks, not one.
 *
 * Every Tasks route statically imported all four, so a reader who only ever
 * opens the board still downloaded, parsed and shipped the list table, the
 * schedule chart and the calendar grid — board-view alone is a 2,132-line
 * client component. Each route renders exactly one of these, so splitting
 * them means each route now carries only the view it actually paints.
 *
 * SSR stays ON (the default): the point is the client bundle, and turning
 * prerendering off would trade a real first paint for a spinner. `loading`
 * is deliberately null — the route's own loading.tsx already reserves this
 * region, and a second placeholder inside the first is one more thing
 * flashing on a fast connection.
 */
const BoardView = dynamic(() => import("../a/board-view").then((m) => m.BoardView));
import { FloorWorkspace } from "@/components/floor/floor-workspace";
import { useDomain, useWorkspaceMembers } from "@/lib/domain-context";
const ListView = dynamic(() => import("../a/list-view").then((m) => m.ListView));
const TimelineView = dynamic(() => import("../a/timeline-view").then((m) => m.TimelineView));
const BCalendarView = dynamic(() => import("../b/calendar-view").then((m) => m.CalendarView));

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

// Share and the overflow carry the band's ghost register natively, via
// their own `variant="band"` prop. The T·97 !important Tailwind costume
// and the .bandActionButton descendant override that replaced it are both
// gone: a register reaching into a component from outside loses to that
// component's own theme rules (it did, in dark), and the styling belongs
// where the markup is.

export function OptionHybrid({ route, onRouteChange }: TasksOptionProps) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  // With the projects rail hidden the brief's nav trigger renders, and at
  // ≥768px the content gutter widens so the trigger hangs in it and the
  // title keeps the one content grid line (option-a.module.css).
  const navHidden = useNavPanelHidden();
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
  ) : route.view === "board" ? null
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

  const domain = useDomain();
  const members = useWorkspaceMembers();
  const floorProjectName = domain.boardName ?? domain.workspaceTitle ?? "This project";
  const operatorInitials = members[0]?.initials ?? "—";

  return (
    <WorkspaceBoardColumnsProvider>
    <div className={styles.optionA} data-nav-hidden={navHidden || undefined} data-option="hybrid" data-planning-collapsed={planningCollapsed || undefined} data-floor="true">
      <FloorWorkspace
        initials={operatorInitials}
        onOpenPlanning={openPlanningExclusive}
        projectName={floorProjectName}
        tasks={visibleTasks}
        view={route.view}
      >
        {view}
      </FloorWorkspace>
      <PlanningRail collapsed={planningCollapsed} onSelectedDate={setSelectedDate} onToggle={togglePlanning} selectedDate={selectedDate} tasks={wholeProject} view={route.view} />
    </div>
    </WorkspaceBoardColumnsProvider>
  );
}
