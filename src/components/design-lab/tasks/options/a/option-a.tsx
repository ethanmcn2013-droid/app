"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { TasksOptionProps } from "../../option-contract";
import { useLabStore } from "../../store";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  VIEW_LABELS,
  type LabDensity,
} from "../../types";
import { SuiteRail, ViewTabs } from "../../shared/lab-chrome";
import { Icon } from "../../shared/icons";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ListFieldsPanel, ListView } from "./list-view";
import { TaskPeek } from "./quiet-command-components";
import {
  INITIAL_LIST_COLUMNS,
  projectTasks,
  type ListColumn,
  type QuietFilter,
  type QuietGroup,
  type QuietSort,
} from "./quiet-command-model";
import { TimelineView } from "./timeline-view";
import styles from "./option-a.module.css";

type ToolPanel = "filter" | "sort" | "group" | "fields" | null;

type SavedView = {
  view: TasksOptionProps["route"]["view"];
  density: LabDensity;
  query: string;
  filter: QuietFilter;
  sort: QuietSort;
  group: QuietGroup;
  columns: ListColumn[];
};

const SORT_LABELS: Record<QuietSort, string> = {
  manual: "Manual order",
  due: "Due date",
  priority: "Priority",
  title: "Task title",
};

const FILTER_LABELS: Record<QuietFilter, string> = {
  all: "All tasks",
  open: "Open tasks",
  queued: STATUS_LABELS.queued,
  active: STATUS_LABELS.active,
  review: STATUS_LABELS.review,
  waiting: STATUS_LABELS.waiting,
  done: STATUS_LABELS.done,
};

const GROUP_LABELS: Record<QuietGroup, string> = {
  status: "Status",
  priority: "Priority",
  none: "No groups",
};

function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <section aria-label="Quiet Command keyboard shortcuts" aria-modal="false" className={styles.shortcutsPanel} role="dialog">
      <header><div><strong>Keyboard</strong><span>Commands follow the focused surface.</span></div><button aria-label="Close keyboard shortcuts" onClick={onClose} type="button"><Icon name="close" size={15} /></button></header>
      <dl>
        <div><dt><kbd>Ctrl P</kbd></dt><dd>Open task palette</dd></div>
        <div><dt><kbd>/</kbd></dt><dd>Focus workspace search</dd></div>
        <div><dt><kbd>C</kbd></dt><dd>Create a queued task</dd></div>
        <div><dt><kbd>Enter</kbd></dt><dd>Open focused task</dd></div>
        <div><dt><kbd>Space</kbd></dt><dd>Select focused task</dd></div>
        <div><dt><kbd>F2</kbd></dt><dd>Edit task title</dd></div>
        <div><dt><kbd>Shift F10</kbd></dt><dd>Open task actions</dd></div>
        <div><dt><kbd>Alt arrows</kbd></dt><dd>Move status, order, or date</dd></div>
      </dl>
    </section>
  );
}

export function OptionA({ route, onRouteChange }: TasksOptionProps) {
  const store = useLabStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuietFilter>("all");
  const [sort, setSort] = useState<QuietSort>("manual");
  const [group, setGroup] = useState<QuietGroup>("status");
  const [panel, setPanel] = useState<ToolPanel>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [columns, setColumns] = useState<ListColumn[]>(() => INITIAL_LIST_COLUMNS.map((column) => ({ ...column })));
  const [savedView, setSavedView] = useState<SavedView | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const visibleTasks = useMemo(() => projectTasks(store.tasks, query, filter, sort), [filter, query, sort, store.tasks]);
  const completedCount = store.tasks.filter((task) => task.completed).length;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable=true]");
      if (!editing && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!editing && event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (!editing && event.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (panel) setPanel(null);
        else if (store.previewId) store.setPreview(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panel, shortcutsOpen, store]);

  const saveCurrentView = () => {
    setSavedView({
      view: route.view,
      density: route.density,
      query,
      filter,
      sort,
      group,
      columns: columns.map((column) => ({ ...column })),
    });
    setSaveNotice(`${VIEW_LABELS[route.view]} view saved for this mounted session`);
  };

  const applySavedView = () => {
    if (!savedView) return;
    setQuery(savedView.query);
    setFilter(savedView.filter);
    setSort(savedView.sort);
    setGroup(savedView.group);
    setColumns(savedView.columns.map((column) => ({ ...column })));
    onRouteChange({ view: savedView.view, density: savedView.density });
    setSaveNotice("Session view applied");
  };

  const renderPanel = () => {
    if (panel === "fields") return <ListFieldsPanel columns={columns} onClose={() => setPanel(null)} setColumns={setColumns} />;
    if (!panel) return null;
    const title = panel === "filter" ? "Filter tasks" : panel === "sort" ? "Sort tasks" : "Group list";
    return (
      <section aria-label={title} aria-modal="false" className={styles.toolPanel} role="dialog">
        <header><div><strong>{title}</strong><span>Applies in this mounted session</span></div><button aria-label={`Close ${title.toLowerCase()}`} onClick={() => setPanel(null)} type="button"><Icon name="close" size={15} /></button></header>
        {panel === "filter" ? (
          <div className={styles.toolChoices}>
            {(["all", "open", ...TASK_STATUSES] as QuietFilter[]).map((item) => <button aria-pressed={filter === item} key={item} onClick={() => { setFilter(item); setPanel(null); }} type="button"><span className={styles.statusPip} data-status={item === "open" || item === "all" ? undefined : item} />{FILTER_LABELS[item]}{filter === item ? <Icon name="check" size={14} /> : null}</button>)}
          </div>
        ) : null}
        {panel === "sort" ? (
          <div className={styles.toolChoices}>
            {(Object.keys(SORT_LABELS) as QuietSort[]).map((item) => <button aria-pressed={sort === item} key={item} onClick={() => { setSort(item); setPanel(null); }} type="button">{SORT_LABELS[item]}{sort === item ? <Icon name="check" size={14} /> : null}</button>)}
          </div>
        ) : null}
        {panel === "group" ? (
          <div className={styles.toolChoices}>
            {(Object.keys(GROUP_LABELS) as QuietGroup[]).map((item) => <button aria-pressed={group === item} key={item} onClick={() => { setGroup(item); setPanel(null); }} type="button">{GROUP_LABELS[item]}{group === item ? <Icon name="check" size={14} /> : null}</button>)}
          </div>
        ) : null}
      </section>
    );
  };

  const createTask = () => store.addTask("queued");
  const onSearch = (event: FormEvent<HTMLInputElement>) => setQuery(event.currentTarget.value);
  const openPanel = (event: MouseEvent<HTMLButtonElement>, next: Exclude<ToolPanel, null>) => {
    event.stopPropagation();
    setPanel((current) => current === next ? null : next);
  };

  let view: React.ReactNode;
  if (route.view === "board") view = <BoardView tasks={visibleTasks} />;
  else if (route.view === "list") view = <ListView columns={columns} group={group} setColumns={setColumns} tasks={visibleTasks} />;
  else if (route.view === "timeline") view = <TimelineView tasks={visibleTasks} />;
  else view = <CalendarView tasks={visibleTasks} />;

  return (
    <div className={styles.optionA} data-option="a">
      <SuiteRail />
      <section className={styles.workspaceShell}>
        <header className={styles.contextHeader}>
          <div className={styles.contextCopy}>
            <nav aria-label="Task context"><span>Planning period</span><b>Public launch</b><Icon name="chevron-right" size={13} /><span>Workspace</span><b>Launch workspace</b></nav>
            <div><h1>Website readiness</h1><p>Coordinate the public launch handoff across product, customer, and operations work.</p></div>
          </div>
          <dl className={styles.contextFacts}>
            <div><dt>Owner</dt><dd>Ethan</dd></div>
            <div><dt>Target</dt><dd>22 Jul</dd></div>
            <div><dt>Progress</dt><dd><Icon name="check" size={13} />{completedCount}/{store.tasks.length || 0}</dd></div>
            <div><dt>Visible</dt><dd>{visibleTasks.length}/{store.tasks.length}</dd></div>
          </dl>
          {store.readOnly ? <span className={styles.readOnlyFlag}>Read-only</span> : null}
        </header>

        <div className={styles.viewBar}>
          <div className={styles.tabsScroll}><ViewTabs onRouteChange={(patch) => { setPanel(null); onRouteChange(patch); }} route={route} /></div>
          <div aria-label="View controls" className={styles.functionalTools} role="toolbar">
            <label className={styles.workspaceSearch}>
              <Icon name="search" size={14} /><span className={styles.srOnly}>Search tasks</span>
              <input aria-label="Search tasks" onInput={onSearch} placeholder="Search tasks" ref={searchRef} type="search" value={query} />
              <kbd>/</kbd>
            </label>
            <button aria-expanded={panel === "filter"} data-active={filter !== "all" || undefined} onClick={(event) => openPanel(event, "filter")} type="button"><Icon name="filter" size={14} />{filter === "all" ? "Filter" : FILTER_LABELS[filter]}</button>
            <button aria-expanded={panel === "sort"} data-active={sort !== "manual" || undefined} onClick={(event) => openPanel(event, "sort")} type="button"><Icon name="sort" size={14} />{sort === "manual" ? "Sort" : SORT_LABELS[sort]}</button>
            {route.view === "list" ? <button aria-expanded={panel === "group"} data-active={group !== "status" || undefined} onClick={(event) => openPanel(event, "group")} type="button"><Icon name="columns" size={14} />Group: {GROUP_LABELS[group]}</button> : null}
            <button aria-expanded={panel === "fields"} disabled={route.view !== "list"} onClick={(event) => openPanel(event, "fields")} title={route.view === "list" ? "Configure List fields" : "Fields are configured in List view"} type="button"><Icon name="fields" size={14} />Fields</button>
            <label className={styles.densityControl}><Icon name="density" size={14} /><span className={styles.srOnly}>Density</span><select aria-label="Density" onChange={(event) => onRouteChange({ density: event.target.value as LabDensity })} value={route.density}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
            <button disabled={store.readOnly} onClick={createTask} type="button"><Icon name="add" size={14} />Add task</button>
            <button aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts" type="button"><Icon name="command" size={14} />Shortcuts</button>
            <button data-saved={Boolean(savedView) || undefined} onClick={saveCurrentView} type="button">{savedView ? "Update saved view" : "Save view"}<span>local</span></button>
          </div>
        </div>

        {renderPanel()}
        {shortcutsOpen ? <Shortcuts onClose={() => setShortcutsOpen(false)} /> : null}
        {savedView ? <div className={styles.savedViewBar}><Icon name="check" size={13} /><span>Session view: {VIEW_LABELS[savedView.view]}</span><button onClick={applySavedView} type="button">Apply</button><button aria-label="Remove saved session view" onClick={() => { setSavedView(null); setSaveNotice("Session view removed"); }} type="button"><Icon name="close" size={13} /></button></div> : null}
        {saveNotice ? <div aria-live="polite" className={styles.saveNotice} role="status">{saveNotice}</div> : null}

        <section aria-label={`${VIEW_LABELS[route.view]} view`} className={styles.activeView} data-view={route.view} data-work-surface="true">
          {view}
        </section>
        <TaskPeek />
      </section>
    </div>
  );
}
