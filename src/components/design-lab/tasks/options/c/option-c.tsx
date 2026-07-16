"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { isTaskOverdue, LAB_TODAY, scheduleEnd } from "../../dates";
import { useLabStore } from "../../store";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  VIEW_LABELS,
  type CalendarDate,
  type LabTask,
  type TaskPriority,
  type TaskStatus,
} from "../../types";
import type { TasksOptionProps } from "../../option-contract";
import { Icon } from "../../shared/icons";
import { ViewTabs } from "../../shared/lab-chrome";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";
import { PlanningRail } from "./planning-rail";
import { TimelineView } from "./timeline-view";
import {
  INITIAL_LIST_FIELDS,
  type ListField,
  type SpatialFilter,
  type SpatialGroup,
  type SpatialSort,
} from "./spatial-types";
import styles from "./option-c.module.css";

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_RANK: Record<TaskStatus, number> = { queued: 0, active: 1, review: 2, waiting: 3, done: 4 };

function taskMatchesFilter(task: LabTask, filter: SpatialFilter): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return task.assigneeIds.includes("ethan");
  if (filter === "unscheduled") return task.schedule.kind === "unscheduled";
  if (filter === "blocked") return task.blockedByIds.length > 0;
  if (filter === "overdue") return isTaskOverdue(task);
  return task.status === filter.slice("status:".length);
}

function compareTasks(a: LabTask, b: LabTask, sort: SpatialSort): number {
  if (sort === "title") return a.title.localeCompare(b.title);
  if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order;
  if (sort === "due") {
    const aDate = scheduleEnd(a.schedule);
    const bDate = scheduleEnd(b.schedule);
    if (aDate === null && bDate === null) return a.order - b.order;
    if (aDate === null) return 1;
    if (bDate === null) return -1;
    return aDate.localeCompare(bDate) || a.order - b.order;
  }
  return a.order - b.order;
}

function SpatialNavigation({ onShortcuts }: { onShortcuts: () => void }) {
  return (
    <aside aria-label="Signal Studio hierarchy" className={styles.spatialNavigation}>
      <a className={styles.spatialBrand} href="#c-workspace-context"><span>S</span><strong>Signal Studio</strong></a>
      <div className={styles.accountContext}><span>Account</span><strong>Signal Studio</strong><small>Founder workspace</small></div>
      <nav aria-label="Account navigation">
        <a href="#c-workspace-context"><Icon name="inbox" size={16} /><span>Inbox</span><small>4</small></a>
        <a href="#c-planning-period"><Icon name="agenda" size={16} /><span>My work</span></a>
        <a aria-current="page" href="#c-workspace-context"><Icon name="board" size={16} /><span>Workspaces</span></a>
        <a href="#c-planning-period"><Icon name="timeline" size={16} /><span>Planning periods</span></a>
      </nav>
      <section className={styles.navPlanningPeriod} id="c-planning-period">
        <span>Planning period</span>
        <strong>Public launch</strong>
        <small>6 Jul to 14 Aug</small>
        <div><i aria-hidden="true" /><span>Current</span></div>
        <a href="#c-workspace-context"><Icon name="chevron-right" size={13} />Launch workspace</a>
      </section>
      <section className={styles.navWorkspace}>
        <span>Workspace</span><strong>Launch workspace</strong><small>Website readiness</small>
      </section>
      <button className={styles.shortcutsButton} onClick={onShortcuts} type="button"><Icon name="command" size={15} />Keyboard shortcuts <kbd>?</kbd></button>
      <div className={styles.navAccount}><span>EC</span><div><strong>Ethan</strong><small>Founder</small></div></div>
    </aside>
  );
}

function WorkspaceContext({ tasks, filter, onFilter }: { tasks: LabTask[]; filter: SpatialFilter; onFilter: (filter: SpatialFilter) => void }) {
  const completed = tasks.filter((task) => task.completed).length;
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled").length;
  const scheduledThisWeek = tasks.filter((task) => {
    const end = scheduleEnd(task.schedule);
    return end !== null && end >= LAB_TODAY && end <= "2026-07-22";
  }).length;
  return (
    <header className={styles.workspaceContext} id="c-workspace-context">
      <div className={styles.workspaceIdentity}>
        <p><span>Planning period</span><Icon name="chevron-right" size={12} /><strong>Public launch</strong></p>
        <div><h1>Launch workspace</h1><span className={styles.workspacePurpose}>Website readiness</span></div>
        <p className={styles.workspaceBrief}>Make the public launch clear, resilient, and supportable across every handoff.</p>
      </div>
      <dl className={styles.workspaceFacts}>
        <div><dt>Owner</dt><dd>Ethan</dd></div>
        <div><dt>Target</dt><dd>22 Jul</dd></div>
        <div><dt>Progress</dt><dd>{completed} of {tasks.length}</dd></div>
        <div><dt>This week</dt><dd>{scheduledThisWeek} dated</dd></div>
        <div><dt>Unscheduled</dt><dd>{unscheduled}</dd></div>
      </dl>
      <div aria-label="Status map" className={styles.statusMap} role="group">
        {TASK_STATUSES.map((status) => {
          const count = tasks.filter((task) => task.status === status).length;
          const active = filter === `status:${status}`;
          return <button aria-pressed={active} data-status={status} key={status} onClick={() => onFilter(active ? "all" : `status:${status}`)} type="button"><span>{STATUS_LABELS[status]}</span><strong>{count}</strong><i aria-hidden="true" /></button>;
        })}
      </div>
    </header>
  );
}

function FieldsPanel({
  fields,
  onChange,
  onClose,
  readOnly,
}: {
  fields: ListField[];
  onChange: (fields: ListField[]) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  const update = (key: ListField["key"], patch: Partial<ListField>) => onChange(fields.map((field) => field.key === key ? { ...field, ...patch } : field));
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };
  return (
    <div aria-label="List fields" className={styles.fieldsPanel} role="dialog">
      <header><div><span>List fields</span><strong>Show, order, and size</strong></div><button aria-label="Close fields" onClick={onClose} type="button"><Icon name="close" size={15} /></button></header>
      <p>The Task title stays frozen. These settings last for this mounted session.</p>
      <ul>
        {fields.map((field, index) => (
          <li key={field.key}>
            <label><input checked={field.visible} disabled={readOnly} onChange={() => update(field.key, { visible: !field.visible })} type="checkbox" /><span>{field.label}</span></label>
            <div aria-label={`Order ${field.label}`} role="group">
              <button aria-label={`Move ${field.label} left`} disabled={readOnly || index === 0} onClick={() => move(index, -1)} type="button"><Icon name="arrow-left" size={13} /></button>
              <button aria-label={`Move ${field.label} right`} disabled={readOnly || index === fields.length - 1} onClick={() => move(index, 1)} type="button"><Icon name="arrow-right" size={13} /></button>
            </div>
            <div aria-label={`Width of ${field.label}`} role="group">
              <button aria-label={`Narrow ${field.label}`} disabled={readOnly || field.width <= 88} onClick={() => update(field.key, { width: Math.max(88, field.width - 16) })} type="button">-</button>
              <output aria-label={`${field.label} width`}>{field.width}</output>
              <button aria-label={`Widen ${field.label}`} disabled={readOnly || field.width >= 240} onClick={() => update(field.key, { width: Math.min(240, field.width + 16) })} type="button">+</button>
            </div>
          </li>
        ))}
      </ul>
      <footer><button disabled={readOnly} onClick={() => onChange(INITIAL_LIST_FIELDS.map((field) => ({ ...field })))} type="button">Reset fields</button><button onClick={onClose} type="button">Done</button></footer>
    </div>
  );
}

function ShortcutDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  return (
    <div className={styles.shortcutBackdrop}>
      <div aria-labelledby="c-shortcuts-title" aria-modal="true" className={styles.shortcutDialog} role="dialog">
        <header><div><span>Signal Spatial</span><h2 id="c-shortcuts-title">Keyboard shortcuts</h2></div><button aria-label="Close keyboard shortcuts" onClick={onClose} ref={closeRef} type="button"><Icon name="close" size={16} /></button></header>
        <div>
          <section><h3>Global</h3><dl><div><dt>Task palette</dt><dd>Ctrl / Cmd + P</dd></div><div><dt>Create task</dt><dd>C</dd></div><div><dt>Search</dt><dd>/</dd></div><div><dt>Close or cancel</dt><dd>Esc</dd></div></dl></section>
          <section><h3>Task</h3><dl><div><dt>Open</dt><dd>Enter</dd></div><div><dt>Select</dt><dd>Space</dd></div><div><dt>Edit title</dt><dd>F2</dd></div><div><dt>Task menu</dt><dd>Shift + F10</dd></div></dl></section>
          <section><h3>Move</h3><dl><div><dt>Navigate</dt><dd>Arrow keys</dd></div><div><dt>Move or reorder</dt><dd>Alt + arrows</dd></div><div><dt>Resize range</dt><dd>Alt + Shift + arrows</dd></div></dl></section>
        </div>
      </div>
    </div>
  );
}

function CommandLayer({
  fields,
  fieldsOpen,
  filter,
  group,
  onFieldsOpen,
  onFilter,
  onGroup,
  onPlanningToggle,
  onRouteChange,
  onSave,
  onSearch,
  onSort,
  planningCollapsed,
  resultCount,
  route,
  saved,
  search,
  searchRef,
  sort,
}: TasksOptionProps & {
  fields: ListField[];
  fieldsOpen: boolean;
  filter: SpatialFilter;
  group: SpatialGroup;
  onFieldsOpen: () => void;
  onFilter: (value: SpatialFilter) => void;
  onGroup: (value: SpatialGroup) => void;
  onPlanningToggle: () => void;
  onSave: () => void;
  onSearch: (value: string) => void;
  onSort: (value: SpatialSort) => void;
  planningCollapsed: boolean;
  resultCount: number;
  saved: boolean;
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  sort: SpatialSort;
}) {
  const store = useLabStore();
  return (
    <div className={styles.commandLayer}>
      <ViewTabs onRouteChange={onRouteChange} route={route} />
      <span className={styles.commandDivider} />
      <label className={styles.spatialSearch}><Icon name="search" size={14} /><span className={styles.srOnly}>Search workspace tasks</span><input aria-label="Search workspace tasks" onChange={(event) => onSearch(event.target.value)} placeholder="Search tasks" ref={searchRef} type="search" value={search} /><kbd>/</kbd></label>
      <label className={styles.commandSelect}><span>Filter</span><select aria-label="Filter tasks" onChange={(event) => onFilter(event.target.value as SpatialFilter)} value={filter}><option value="all">All work</option><option value="mine">Assigned to me</option><option value="unscheduled">Unscheduled</option><option value="blocked">Blocked</option><option value="overdue">Overdue</option><optgroup label="Status">{TASK_STATUSES.map((status) => <option key={status} value={`status:${status}`}>{STATUS_LABELS[status]}</option>)}</optgroup></select></label>
      <label className={styles.commandSelect}><span>Group</span><select aria-label="Group tasks" disabled={route.view === "board"} onChange={(event) => onGroup(event.target.value as SpatialGroup)} title={route.view === "board" ? "Board is grouped by status lanes" : undefined} value={route.view === "board" ? "status" : group}><option value="status">Status</option><option value="priority">Priority</option></select></label>
      <label className={styles.commandSelect}><span>Sort</span><select aria-label="Sort tasks" onChange={(event) => onSort(event.target.value as SpatialSort)} value={sort}><option value="manual">Manual order</option><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Title</option></select></label>
      <button aria-expanded={fieldsOpen} className={styles.commandButton} disabled={route.view !== "list"} onClick={onFieldsOpen} title={route.view === "list" ? "Configure visible List fields" : "Fields are configured in List"} type="button"><Icon name="fields" size={14} />Fields <span>{fields.filter((field) => field.visible).length}</span></button>
      <label className={styles.commandSelect}><span>Density</span><select aria-label="Density" onChange={(event) => onRouteChange({ density: event.target.value as TasksOptionProps["route"]["density"] })} value={route.density}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
      <button aria-pressed={!planningCollapsed} className={styles.commandButton} onClick={onPlanningToggle} type="button"><Icon name="columns" size={14} />Planning</button>
      <button aria-pressed={saved} className={styles.commandButton} onClick={onSave} title="Saved only in this mounted session" type="button"><Icon name={saved ? "check" : "focus"} size={14} />{saved ? "Saved locally" : "Save view"}</button>
      <button className={styles.newTaskButton} disabled={store.readOnly} onClick={() => store.addTask("queued")} type="button"><Icon name="add" size={14} />New task</button>
      <output aria-live="polite" className={styles.resultCount}>{resultCount} shown</output>
    </div>
  );
}

export function OptionC({ route, onRouteChange }: TasksOptionProps) {
  const store = useLabStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SpatialFilter>("all");
  const [sort, setSort] = useState<SpatialSort>("manual");
  const [group, setGroup] = useState<SpatialGroup>("status");
  const [fields, setFields] = useState<ListField[]>(() => INITIAL_LIST_FIELDS.map((field) => ({ ...field })));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [planningCollapsed, setPlanningCollapsed] = useState(true);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(LAB_TODAY);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const narrowDesktop = window.matchMedia("(max-width: 1180px)");
    const syncPlanningRailToViewport = () => setPlanningCollapsed(narrowDesktop.matches);
    syncPlanningRailToViewport();
    narrowDesktop.addEventListener("change", syncPlanningRailToViewport);
    return () => narrowDesktop.removeEventListener("change", syncPlanningRailToViewport);
  }, []);

  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable=true]");
      if (!editing && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (!editing && event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (event.key === "Escape") {
        if (shortcutsOpen) { event.preventDefault(); setShortcutsOpen(false); }
        else if (fieldsOpen) { event.preventDefault(); setFieldsOpen(false); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [fieldsOpen, shortcutsOpen]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-GB");
    const filtered = store.tasks.filter((task) => taskMatchesFilter(task, filter) && (
      !query
      || task.title.toLocaleLowerCase("en-GB").includes(query)
      || task.description.toLocaleLowerCase("en-GB").includes(query)
      || STATUS_LABELS[task.status].toLocaleLowerCase("en-GB").includes(query)
      || PRIORITY_LABELS[task.priority].toLocaleLowerCase("en-GB").includes(query)
    ));
    return [...filtered].sort((a, b) => {
      if (route.view !== "board") {
        const grouped = group === "status" ? STATUS_RANK[a.status] - STATUS_RANK[b.status] : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (grouped !== 0) return grouped;
      }
      return compareTasks(a, b, sort);
    });
  }, [filter, group, route.view, search, sort, store.tasks]);

  const viewSignature = JSON.stringify({
    view: route.view,
    density: route.density,
    filter,
    sort,
    group: route.view === "board" ? "status" : group,
    search,
    fields,
    planningCollapsed,
  });
  const saved = savedSignature === viewSignature;
  const changeRoute = (patch: Partial<TasksOptionProps["route"]>) => {
    if (patch.view && patch.view !== "list") setFieldsOpen(false);
    onRouteChange(patch);
  };

  const view = route.view === "board" ? <BoardView tasks={visibleTasks} />
    : route.view === "list" ? <ListView fields={fields} groupBy={group} tasks={visibleTasks} />
      : route.view === "timeline" ? <TimelineView tasks={visibleTasks} />
        : <CalendarView onSelectedDate={setSelectedDate} selectedDate={selectedDate} tasks={visibleTasks} />;

  return (
    <div
      className={styles.spatialRoot}
      data-inspector-open={Boolean(store.inspectedId) || undefined}
      data-option="c"
      data-planning-collapsed={planningCollapsed || undefined}
    >
      <SpatialNavigation onShortcuts={() => setShortcutsOpen(true)} />
      <section className={styles.workspaceZone}>
        <WorkspaceContext filter={filter} onFilter={setFilter} tasks={store.tasks} />
        <div className={styles.commandAnchor}>
          <CommandLayer
            fields={fields}
            fieldsOpen={fieldsOpen}
            filter={filter}
            group={group}
            onFieldsOpen={() => setFieldsOpen((value) => !value)}
            onFilter={setFilter}
            onGroup={setGroup}
            onPlanningToggle={() => setPlanningCollapsed((value) => !value)}
            onRouteChange={changeRoute}
            onSave={() => setSavedSignature(viewSignature)}
            onSearch={setSearch}
            onSort={setSort}
            planningCollapsed={planningCollapsed}
            resultCount={visibleTasks.length}
            route={route}
            saved={saved}
            search={search}
            searchRef={searchRef}
            sort={sort}
          />
          {fieldsOpen && route.view === "list" ? <FieldsPanel fields={fields} onChange={setFields} onClose={() => setFieldsOpen(false)} readOnly={store.readOnly} /> : null}
        </div>
        <div aria-label={`${VIEW_LABELS[route.view]} view`} className={styles.viewSurface} data-view={route.view} data-work-surface="true">
          {view}
        </div>
      </section>
      <PlanningRail collapsed={planningCollapsed} onSelectedDate={setSelectedDate} onToggle={() => setPlanningCollapsed((value) => !value)} selectedDate={selectedDate} tasks={visibleTasks} view={route.view} />
      {shortcutsOpen ? <ShortcutDialog onClose={() => setShortcutsOpen(false)} /> : null}
      {store.readOnly ? <div className={styles.readOnlyBanner} role="status"><Icon name="focus" size={13} />Read-only prototype. Mutation controls are disabled.</div> : null}
    </div>
  );
}
