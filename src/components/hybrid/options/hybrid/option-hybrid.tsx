"use client";

import { useMemo, useState } from "react";
import { WorkspaceBoardColumnsProvider } from "../../columns-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import type { TasksOptionProps } from "../../option-contract";
import { useLabStore } from "../../store";
import { Icon } from "../../shared/icons";
import { SuiteRail, ViewTabs } from "../../shared/lab-chrome";
import { PlanningRail } from "../c/planning-rail";
import { WorkspaceBrief } from "../b/workspace-brief";
import { CalendarView as BCalendarView } from "../b/calendar-view";
import { BoardView } from "../a/board-view";
import { ListFieldsPanel, ListView } from "../a/list-view";
import { TimelineView } from "../a/timeline-view";
import { INITIAL_LIST_COLUMNS, projectTasks, type ListColumn } from "../a/quiet-command-model";
import { ViewToolButtons, ViewToolPanels, useVisibleLabTasks, type ViewToolPanel } from "../../view-tools";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { BoardGhost, CalendarGhost, ListGhost, TimelineGhost } from "@/components/app/empty-state/ghost-views";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { usePersonalization } from "@/lib/domain-context";
import type { CalendarDate } from "../../types";
import styles from "../a/option-a.module.css";

export function OptionHybrid({ route, onRouteChange, hideSuiteRail }: TasksOptionProps & { hideSuiteRail?: boolean }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const [columns, setColumns] = useState<ListColumn[]>(() => INITIAL_LIST_COLUMNS.map((column) => ({ ...column })));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [planningCollapsed, setPlanningCollapsed] = useState(true);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(
    () => calendar.today as CalendarDate,
  );

  // T·125: the room tools are back. The four views render the filtered,
  // sorted list; the brief and planning rail keep the whole project so
  // receipts and counts never quietly shrink to a filtered subset.
  const wholeProject = useMemo(() => projectTasks(store.tasks, "", "all", "manual"), [store.tasks]);
  const visibleTasks = useVisibleLabTasks(wholeProject);
  const [toolPanel, setToolPanel] = useState<ViewToolPanel>(null);
  const toggleToolPanel = (next: Exclude<ViewToolPanel, null>) => {
    setToolPanel((value) => (value === next ? null : next));
    setFieldsOpen(false);
  };

  const personalization = usePersonalization();
  const { clearFilters, activeFilterCount } = useRoomTools();

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
      {hideSuiteRail ? null : <SuiteRail />}
      <section className={styles.workspaceShell}>
        <WorkspaceBrief tasks={wholeProject} />
        <div className={styles.viewBar}>
          <div className={styles.tabsScroll}><ViewTabs onRouteChange={(patch) => { setFieldsOpen(false); setToolPanel(null); onRouteChange(patch); }} route={route} /></div>
          <div aria-label="Hybrid view controls" className={styles.functionalTools} role="toolbar">
            <ViewToolButtons onToggle={toggleToolPanel} panel={toolPanel} view={route.view} />
            <button aria-expanded={fieldsOpen} disabled={route.view !== "list"} onClick={() => { setFieldsOpen((value) => !value); setToolPanel(null); }} type="button"><Icon name="fields" size={15} />Fields</button>
            <label className={styles.densityControl}><Icon name="density" size={15} /><span className={styles.srOnly}>Density</span><select aria-label="Density" onChange={(event) => onRouteChange({ density: event.target.value as TasksOptionProps["route"]["density"] })} value={route.density}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
            <button disabled={store.readOnly} onClick={() => store.addTask("todo")} type="button"><Icon name="add" size={15} />Add task</button>
          </div>
        </div>
        <ViewToolPanels onClose={() => setToolPanel(null)} panel={toolPanel} view={route.view} />
        {fieldsOpen && route.view === "list" ? <ListFieldsPanel columns={columns} onClose={() => setFieldsOpen(false)} setColumns={setColumns} /> : null}
        {filteredToNothing ? (
          <div className={styles.filterEmptyNotice} role="status">
            <span>Nothing matches the filters.</span>
            <button onClick={clearFilters} type="button">Clear filters</button>
          </div>
        ) : null}
        <section aria-label={`${route.view} view`} className={styles.activeView} data-view={route.view} data-work-surface="true">{view}</section>
      </section>
      <PlanningRail collapsed={planningCollapsed} onSelectedDate={setSelectedDate} onToggle={() => setPlanningCollapsed((value) => !value)} selectedDate={selectedDate} tasks={wholeProject} view={route.view} />
    </div>
    </WorkspaceBoardColumnsProvider>
  );
}
