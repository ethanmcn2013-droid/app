"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TasksOptionProps } from "../../option-contract";
import { useLabStore } from "../../store";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { SuiteRail, ViewTabs } from "../../shared/lab-chrome";
import { PlanningRail } from "../c/planning-rail";
import { WorkspaceBrief } from "../b/workspace-brief";
import { CalendarView as BCalendarView } from "../b/calendar-view";
import { BoardView } from "../a/board-view";
import { ListFieldsPanel, ListView } from "../a/list-view";
import { TimelineView } from "../a/timeline-view";
import { INITIAL_LIST_COLUMNS, projectTasks, type ListColumn, type QuietFilter, type QuietSort } from "../a/quiet-command-model";
import styles from "../a/option-a.module.css";

const FILTER_LABELS: Record<QuietFilter, string> = {
  all: "All tasks",
  open: "Open tasks",
  queued: STATUS_LABELS.queued,
  active: STATUS_LABELS.active,
  review: STATUS_LABELS.review,
  waiting: STATUS_LABELS.waiting,
  done: STATUS_LABELS.done,
};

function matchesQuery(task: LabTask, query: string): boolean {
  const haystack = `${task.title} ${task.description} ${task.status} ${task.priority}`.toLocaleLowerCase("en-GB");
  return haystack.includes(query.trim().toLocaleLowerCase("en-GB"));
}

export function OptionHybrid({ route, onRouteChange, hideSuiteRail }: TasksOptionProps & { hideSuiteRail?: boolean }) {
  const store = useLabStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuietFilter>("all");
  const [sort, setSort] = useState<QuietSort>("manual");
  const [columns, setColumns] = useState<ListColumn[]>(() => INITIAL_LIST_COLUMNS.map((column) => ({ ...column })));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [planningCollapsed, setPlanningCollapsed] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !target.matches("input, textarea, select, [contenteditable=true]")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleTasks = useMemo(() => {
    const filtered = store.tasks.filter((task) => {
      if (!matchesQuery(task, query)) return false;
      if (filter === "open") return !task.completed;
      if (filter === "all") return true;
      return task.status === filter;
    });
    return projectTasks(filtered, "", "all", sort);
  }, [filter, query, sort, store.tasks]);

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
            <label className={styles.workspaceSearch}><Icon name="search" size={14} /><span className={styles.srOnly}>Search tasks</span><input aria-label="Search tasks" onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" ref={searchRef} type="search" value={query} /><kbd>/</kbd></label>
            <label className={styles.compactSelect}><span className={styles.srOnly}>Filter</span><select aria-label="Filter tasks" onChange={(event) => setFilter(event.target.value as QuietFilter)} value={filter}>{(Object.keys(FILTER_LABELS) as QuietFilter[]).map((value) => <option key={value} value={value}>{FILTER_LABELS[value]}</option>)}</select></label>
            <label className={styles.compactSelect}><span className={styles.srOnly}>Sort</span><select aria-label="Sort tasks" onChange={(event) => setSort(event.target.value as QuietSort)} value={sort}><option value="manual">Manual order</option><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Task title</option></select></label>
            <button aria-expanded={fieldsOpen} disabled={route.view !== "list"} onClick={() => setFieldsOpen((value) => !value)} type="button"><Icon name="fields" size={14} />Fields</button>
            <label className={styles.densityControl}><Icon name="density" size={14} /><span className={styles.srOnly}>Density</span><select aria-label="Density" onChange={(event) => onRouteChange({ density: event.target.value as TasksOptionProps["route"]["density"] })} value={route.density}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
            <button aria-pressed={!planningCollapsed} onClick={() => setPlanningCollapsed((value) => !value)} type="button"><Icon name="columns" size={14} />Planning</button>
            <button disabled={store.readOnly} onClick={() => store.addTask("queued")} type="button"><Icon name="add" size={14} />Add task</button>
            <output aria-live="polite">{visibleTasks.length} shown</output>
          </div>
        </div>
        {fieldsOpen && route.view === "list" ? <ListFieldsPanel columns={columns} onClose={() => setFieldsOpen(false)} setColumns={setColumns} /> : null}
        <section aria-label={`${route.view} view`} className={styles.activeView} data-view={route.view} data-work-surface="true">{view}</section>
      </section>
      <PlanningRail collapsed={planningCollapsed} onSelectedDate={() => undefined} onToggle={() => setPlanningCollapsed((value) => !value)} selectedDate="2026-07-16" tasks={visibleTasks} view={route.view} />
    </div>
  );
}
