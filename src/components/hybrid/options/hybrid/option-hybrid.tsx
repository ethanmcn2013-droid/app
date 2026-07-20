"use client";

import { useMemo, useState } from "react";
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
import styles from "../a/option-a.module.css";

export function OptionHybrid({ route, onRouteChange, hideSuiteRail }: TasksOptionProps & { hideSuiteRail?: boolean }) {
  const store = useLabStore();
  const [columns, setColumns] = useState<ListColumn[]>(() => INITIAL_LIST_COLUMNS.map((column) => ({ ...column })));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [planningCollapsed, setPlanningCollapsed] = useState(true);

  // Search, filtering, and sorting moved out of this row: the black Studio
  // Bar owns global search (⌘K), so the interior view stays in the workspace's
  // manual order and lets the board/list handle their own grouping.
  const visibleTasks = useMemo(() => projectTasks(store.tasks, "", "all", "manual"), [store.tasks]);

  const view = route.view === "board" ? <BoardView tasks={visibleTasks} />
    : route.view === "list" ? <ListView columns={columns} group="status" setColumns={setColumns} tasks={visibleTasks} />
      : route.view === "timeline" ? <TimelineView tasks={visibleTasks} />
        : <BCalendarView tasks={visibleTasks} />;

  return (
    <div className={styles.optionA} data-option="hybrid" data-planning-collapsed={planningCollapsed || undefined}>
      {hideSuiteRail ? null : <SuiteRail />}
      <section className={styles.workspaceShell}>
        <WorkspaceBrief tasks={visibleTasks} />
        <div className={styles.viewBar}>
          <div className={styles.tabsScroll}><ViewTabs onRouteChange={(patch) => { setFieldsOpen(false); onRouteChange(patch); }} route={route} /></div>
          <div aria-label="Hybrid view controls" className={styles.functionalTools} role="toolbar">
            <button aria-expanded={fieldsOpen} disabled={route.view !== "list"} onClick={() => setFieldsOpen((value) => !value)} type="button"><Icon name="fields" size={15} />Fields</button>
            <label className={styles.densityControl}><Icon name="density" size={15} /><span className={styles.srOnly}>Density</span><select aria-label="Density" onChange={(event) => onRouteChange({ density: event.target.value as TasksOptionProps["route"]["density"] })} value={route.density}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
            <button disabled={store.readOnly} onClick={() => store.addTask("queued")} type="button"><Icon name="add" size={15} />Add task</button>
          </div>
        </div>
        {fieldsOpen && route.view === "list" ? <ListFieldsPanel columns={columns} onClose={() => setFieldsOpen(false)} setColumns={setColumns} /> : null}
        <section aria-label={`${route.view} view`} className={styles.activeView} data-view={route.view} data-work-surface="true">{view}</section>
      </section>
      <PlanningRail collapsed={planningCollapsed} onSelectedDate={() => undefined} onToggle={() => setPlanningCollapsed((value) => !value)} selectedDate="2026-07-16" tasks={visibleTasks} view={route.view} />
    </div>
  );
}
