"use client";

import { useEffect, useMemo, useState } from "react";
import { isTaskOverdue } from "../../dates";
import { labelById, personById } from "../../fixtures";
import type { TasksOptionProps } from "../../option-contract";
import { useLabStore } from "../../store";
import { PRIORITY_LABELS, TASK_PRIORITIES, type LabTask, type TaskPriority } from "../../types";
import { Icon } from "../../shared/icons";
import { SuiteRail, ViewTabs, ViewTools } from "../../shared/lab-chrome";
import { TaskOpenButton } from "../../shared/task-ui";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { DEFAULT_LIST_FIELDS, ListView, type ListFieldConfig } from "./list-view";
import { sortRoomTasks } from "./option-b-utils";
import { TimelineView } from "./timeline-view";
import styles from "./option-b.module.css";

type SortMode = "manual" | "date" | "title";
type OwnerFilter = "all" | "assigned" | "unassigned";
type ToolPanel = "filter" | "sort" | null;

function matchesRoomQuery(task: LabTask, query: string): boolean {
  const terms = [
    task.title,
    task.description,
    task.status,
    task.priority,
    ...task.assigneeIds.map((id) => personById(id)?.name ?? ""),
    ...task.labelIds.map((id) => labelById(id)?.name ?? ""),
  ].join(" ").toLocaleLowerCase("en-GB");
  return terms.includes(query.trim().toLocaleLowerCase("en-GB"));
}

function RoomToolPanel({
  panel,
  priority,
  owner,
  sort,
  onPriority,
  onOwner,
  onSort,
  onClose,
}: {
  panel: ToolPanel;
  priority: "all" | TaskPriority;
  owner: OwnerFilter;
  sort: SortMode;
  onPriority: (value: "all" | TaskPriority) => void;
  onOwner: (value: OwnerFilter) => void;
  onSort: (value: SortMode) => void;
  onClose: () => void;
}) {
  if (!panel) return null;
  return (
    <section
      aria-label={panel === "filter" ? "Task filters" : "Task sorting"}
      className={styles.roomToolPanel}
      onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
    >
      <header><div><strong>{panel === "filter" ? "Filter the room" : "Order the room"}</strong><span>Applies to every Option B view</span></div><button aria-label={`Close ${panel} controls`} onClick={onClose} type="button"><Icon name="close" size={14} /></button></header>
      {panel === "filter" ? (
        <div className={styles.roomFilterFields}>
          <label><span>Priority</span><select aria-label="Filter by priority" onChange={(event) => onPriority(event.target.value as "all" | TaskPriority)} value={priority}><option value="all">All priorities</option>{TASK_PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>)}</select></label>
          <fieldset><legend>People</legend>{(["all", "assigned", "unassigned"] as OwnerFilter[]).map((value) => <label key={value}><input checked={owner === value} name="owner-filter" onChange={() => onOwner(value)} type="radio" /><span>{value === "all" ? "Everyone" : value === "assigned" ? "Has an owner" : "Unassigned"}</span></label>)}</fieldset>
          <button className={styles.roomResetFilters} onClick={() => { onPriority("all"); onOwner("all"); }} type="button">Clear filters</button>
        </div>
      ) : (
        <fieldset className={styles.roomSortOptions}>
          <legend className={styles.srOnly}>Sort tasks</legend>
          {([
            ["manual", "Workspace order", "Keep the deliberate lane and group order."],
            ["date", "Schedule", "Dated work first, then explicitly unscheduled work."],
            ["title", "Task title", "A to Z within each view composition."],
          ] as const).map(([value, label, description]) => <label key={value}><input checked={sort === value} name="room-sort" onChange={() => onSort(value)} type="radio" /><span><strong>{label}</strong><small>{description}</small></span></label>)}
        </fieldset>
      )}
    </section>
  );
}

export function WorkspaceBrief({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const completed = store.tasks.filter((task) => task.completed).length;
  const overdue = store.tasks.filter(isTaskOverdue).length;
  const unscheduled = store.tasks.filter((task) => task.schedule.kind === "unscheduled").length;
  const milestones = store.tasks.filter((task) => task.schedule.kind === "milestone").sort((a, b) => {
    const aDate = a.schedule.kind === "milestone" ? a.schedule.on : "";
    const bDate = b.schedule.kind === "milestone" ? b.schedule.on : "";
    return aDate.localeCompare(bDate);
  }).slice(0, 3);
  const progress = store.tasks.length === 0 ? 0 : Math.round((completed / store.tasks.length) * 100);
  return (
    <header className={styles.workspaceBrief}>
      <div className={styles.workspaceIdentity}>
        <div className={styles.workspacePath}><span>Planning period</span><Icon name="chevron-right" size={12} /><strong>Public launch</strong><Icon name="chevron-right" size={12} /><span>Workspace</span></div>
        <h1>Launch workspace</h1>
        <p>Make the public launch legible, owned, and reversible. Every task should leave a clear next handoff.</p>
        <div className={styles.workspaceMeta}><span>6 Jul to 14 Aug</span><span>Ethan, workspace owner</span><span>{store.readOnly ? "Read-only review" : "Session-only prototype"}</span></div>
      </div>
      <section aria-label="Workspace progress" className={styles.workspaceProgress}>
        <div><span>Progress</span><strong>{progress}%</strong></div>
        <progress aria-label={`${completed} of ${store.tasks.length} tasks complete`} max={Math.max(1, store.tasks.length)} value={completed} />
        <dl>
          <div><dt>Complete</dt><dd>{completed}/{store.tasks.length}</dd></div>
          <div><dt>Overdue</dt><dd data-alert={overdue > 0 || undefined}>{overdue}</dd></div>
          <div><dt>No date</dt><dd>{unscheduled}</dd></div>
        </dl>
      </section>
      <section aria-label="Planning period milestones" className={styles.workspaceMilestones}>
        <span>Milestones</span>
        <ol>
          {milestones.map((task) => <li data-task-id={task.id} key={task.id}><time dateTime={task.schedule.kind === "milestone" ? task.schedule.on : undefined}>{task.schedule.kind === "milestone" ? task.schedule.on.slice(5).replace("-", "/") : ""}</time><TaskOpenButton task={task} /></li>)}
          {milestones.length === 0 ? <li><time>No date</time><strong>No milestones in this fixture</strong></li> : null}
        </ol>
        {tasks.length !== store.tasks.length ? <small>{tasks.length} of {store.tasks.length} tasks in the current room view</small> : <small>Purpose, progress, and commitments stay in view.</small>}
      </section>
    </header>
  );
}

export function OptionB({ route, onRouteChange }: TasksOptionProps) {
  const store = useLabStore();
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"all" | TaskPriority>("all");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [sort, setSort] = useState<SortMode>("manual");
  const [toolPanel, setToolPanel] = useState<ToolPanel>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [listFields, setListFields] = useState<ListFieldConfig[]>(DEFAULT_LIST_FIELDS);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable='true']");
      if (!editing && event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[data-option="b"] input[aria-label="Search this view"]')?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleTasks = useMemo(() => {
    const filtered = store.tasks.filter((task) => {
      if (query.trim() && !matchesRoomQuery(task, query)) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (owner === "assigned" && task.assigneeIds.length === 0) return false;
      if (owner === "unassigned" && task.assigneeIds.length > 0) return false;
      return true;
    });
    return sortRoomTasks(filtered, sort);
  }, [owner, priority, query, sort, store.tasks]);

  const activeFilterCount = (priority === "all" ? 0 : 1) + (owner === "all" ? 0 : 1);
  const changeViewRoute = (patch: Parameters<TasksOptionProps["onRouteChange"]>[0]) => {
    if (patch.view && patch.view !== "list") setFieldsOpen(false);
    onRouteChange(patch);
  };
  return (
    <div className={styles.optionB} data-option="b" data-read-only={store.readOnly || undefined}>
      <SuiteRail />
      <section className={styles.projectRoom}>
        <WorkspaceBrief tasks={visibleTasks} />
        <div className={styles.roomViewBar}>
          <ViewTabs onRouteChange={changeViewRoute} route={route} />
          <ViewTools
            onFields={route.view === "list" ? () => { setFieldsOpen((value) => !value); setToolPanel(null); } : undefined}
            onFilter={() => { setToolPanel((value) => value === "filter" ? null : "filter"); setFieldsOpen(false); }}
            onRouteChange={onRouteChange}
            onSearchChange={setQuery}
            onSort={() => { setToolPanel((value) => value === "sort" ? null : "sort"); setFieldsOpen(false); }}
            route={route}
            searchValue={query}
          >
            <span className={styles.roomResultCount}>{visibleTasks.length}/{store.tasks.length}<span> shown</span></span>
            {activeFilterCount > 0 ? <button className={styles.activeFilterButton} onClick={() => setToolPanel("filter")} type="button">{activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}</button> : null}
          </ViewTools>
          <RoomToolPanel
            onClose={() => setToolPanel(null)}
            onOwner={setOwner}
            onPriority={setPriority}
            onSort={setSort}
            owner={owner}
            panel={toolPanel}
            priority={priority}
            sort={sort}
          />
        </div>
        <div className={styles.activeViewSurface} data-view={route.view} data-work-surface="true">
          {route.view === "board" ? <BoardView tasks={visibleTasks} /> : null}
          {route.view === "list" ? <ListView fields={listFields} fieldsOpen={fieldsOpen && route.view === "list"} onFieldsChange={setListFields} onFieldsClose={() => setFieldsOpen(false)} tasks={visibleTasks} /> : null}
          {route.view === "timeline" ? <TimelineView tasks={visibleTasks} /> : null}
          {route.view === "calendar" ? <CalendarView tasks={visibleTasks} /> : null}
        </div>
      </section>
    </div>
  );
}
