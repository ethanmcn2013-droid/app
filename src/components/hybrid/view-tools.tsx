"use client";

/**
 * View tools — the room's working controls, remounted into the hybrid
 * view bar (T·125). The T·99 interior consolidation dropped the 52px
 * room band and with it Filter / Sort / Save view and the Share/export
 * cluster; this module restores them against the live hybrid store.
 *
 * State stays in RoomToolsProvider (unchanged localStorage saved-view
 * contract), widened per the founder's call: filter by date, by owner
 * *by name*, and by board column. Filtering happens here on LabTask —
 * the views render exactly what the tools admit, while the brief and
 * planning rail keep the whole project (receipts never shrink to a
 * filtered subset).
 */

import { useMemo, useState } from "react";
import { PRIORITY_LABEL, type Priority } from "@/lib/data";
import {
  useRoomTools,
  type RoomDueFilter,
  type RoomSortMode,
} from "@/components/app/room/room-tools-context";
import { Icon } from "@/components/app/room/room-icons";
import { ShareButton } from "@/components/app/share/share-button";
import { PageActionsOverflow } from "@/components/app/page-header";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import type { ShareView } from "@/server/actions/share";
import { useBoardColumns } from "./columns-context";
import { priorityToLab } from "./adapter";
import {
  addDays,
  compareDates,
  isTaskDueToday,
  isTaskOverdue,
  scheduleEnd,
} from "./dates";
import { VIEW_LABELS, type CalendarDate, type LabTask, type LabView } from "./types";
import styles from "@/components/app/room/option-b.module.css";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];

// T·97 heritage: arbitrary-variant overrides that repaint the wrapped
// production Share/overflow trigger buttons in the lab tool-button style.
// Targets `> div > button` so only the trigger is restyled, never the
// popover/menu buttons inside it.
const labButtonWrap =
  "[&>div>button]:!h-[34px] [&>div>button]:!min-h-[34px] [&>div>button]:!rounded-md " +
  "[&>div>button]:!border-0 [&>div>button]:!bg-transparent " +
  "[&>div>button]:!text-[var(--x-task-text-secondary)] " +
  "[&>div>button]:!text-[12px] [&>div>button]:!font-normal " +
  "[&>div>button]:!px-2.5 [&>div>button]:!gap-1.5 " +
  "hover:[&>div>button]:!text-[var(--x-task-text)] " +
  "hover:[&>div>button]:!bg-[var(--x-task-hover)]";

export type ViewToolPanel = "filter" | "sort" | "save" | null;

function matchesQuery(task: LabTask, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("en-GB");
  if (!q) return true;
  return (
    task.title.toLocaleLowerCase("en-GB").includes(q) ||
    task.description.toLocaleLowerCase("en-GB").includes(q)
  );
}

function matchesDue(task: LabTask, due: RoomDueFilter, today: CalendarDate): boolean {
  switch (due) {
    case "all":
      return true;
    case "overdue":
      return isTaskOverdue(task, today);
    case "today":
      return isTaskDueToday(task, today);
    case "week": {
      const end = scheduleEnd(task.schedule);
      return (
        end !== null &&
        compareDates(end, today) >= 0 &&
        compareDates(end, addDays(today, 6)) <= 0
      );
    }
    case "unscheduled":
      return task.schedule.kind === "unscheduled";
  }
}

function sortVisible(tasks: LabTask[], sort: RoomSortMode): LabTask[] {
  if (sort === "manual") return tasks;
  const list = [...tasks];
  if (sort === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title, "en-GB"));
  } else {
    // Dated work first (soonest due first), then explicitly unscheduled.
    list.sort((a, b) => {
      const ae = scheduleEnd(a.schedule);
      const be = scheduleEnd(b.schedule);
      if (ae === null && be === null) return 0;
      if (ae === null) return 1;
      if (be === null) return -1;
      return compareDates(ae, be);
    });
  }
  return list;
}

/**
 * The room's visible task list: the hybrid store's tasks filtered and
 * ordered by the tools. The four views render THIS, so Filter/Sort
 * apply everywhere — board, list, schedule, and calendar alike.
 */
export function useVisibleLabTasks(tasks: LabTask[]): LabTask[] {
  const { query, priority, owner, due, column, sort } = useRoomTools();
  const calendar = useCalendarFrame();
  return useMemo(() => {
    const labPriority = priority === "all" ? null : priorityToLab(priority);
    const filtered = tasks.filter((task) => {
      if (!matchesQuery(task, query)) return false;
      if (labPriority !== null && task.priority !== labPriority) return false;
      if (owner === "assigned" && task.assigneeIds.length === 0) return false;
      if (owner === "unassigned" && task.assigneeIds.length > 0) return false;
      if (
        owner !== "all" &&
        owner !== "assigned" &&
        owner !== "unassigned" &&
        !task.assigneeIds.includes(owner)
      )
        return false;
      if (column !== "all" && task.status !== column) return false;
      if (!matchesDue(task, due, calendar.today as CalendarDate)) return false;
      return true;
    });
    return sortVisible(filtered, sort);
  }, [calendar.today, column, due, owner, priority, query, sort, tasks]);
}

/**
 * Filter / Sort / Save view buttons plus the Share/overflow cluster.
 * Rendered as direct children of the view bar's tools row so the
 * `.functionalTools > button` styling applies.
 */
export function ViewToolButtons({
  panel,
  onToggle,
  view,
}: {
  panel: ViewToolPanel;
  onToggle: (next: Exclude<ViewToolPanel, null>) => void;
  view: LabView;
}) {
  const { activeFilterCount } = useRoomTools();
  const shareView = view as ShareView;
  return (
    <>
      <button
        aria-expanded={panel === "filter"}
        onClick={() => onToggle("filter")}
        title="Filter this view"
        type="button"
      >
        <Icon name="filter" size={15} />
        Filter
      </button>
      <button
        aria-expanded={panel === "sort"}
        onClick={() => onToggle("sort")}
        title="Sort this view"
        type="button"
      >
        <Icon name="sort" size={15} />
        Sort
      </button>
      {activeFilterCount > 0 ? (
        <button
          className={styles.activeFilterButton}
          onClick={() => onToggle("filter")}
          type="button"
        >
          {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
        </button>
      ) : null}
      <button
        aria-expanded={panel === "save"}
        onClick={() => onToggle("save")}
        title="Save this view"
        type="button"
      >
        <Icon name="save" size={15} />
        Save view
      </button>
      <span className={`hidden lg:inline-flex ${labButtonWrap}`}>
        <ShareButton view={shareView} />
      </span>
      <span className={`inline-flex ${labButtonWrap}`}>
        <PageActionsOverflow
          printPath={`/print/${view}`}
          shareView={shareView}
          showShare
        />
      </span>
    </>
  );
}

function ToolPanelShell({
  title,
  subtitle,
  panel,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  panel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={styles.roomToolPanel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <button aria-label={`Close ${panel} controls`} onClick={onClose} type="button">
          <Icon name="close" size={14} />
        </button>
      </header>
      {children}
    </section>
  );
}

const DUE_OPTIONS: Array<[RoomDueFilter, string]> = [
  ["all", "Any time"],
  ["overdue", "Overdue"],
  ["today", "Due today"],
  ["week", "Next seven days"],
  ["unscheduled", "Unscheduled"],
];

/**
 * The open tool panel, anchored under the view bar. The zero-height
 * relative wrapper keeps the absolutely-positioned panel out of the view
 * bar's own overflow context (the bar scrolls horizontally on narrow
 * screens and would clip it).
 */
export function ViewToolPanels({
  panel,
  onClose,
  view,
}: {
  panel: ViewToolPanel;
  onClose: () => void;
  view: LabView;
}) {
  const {
    priority,
    owner,
    due,
    column,
    sort,
    setPriority,
    setOwner,
    setDue,
    setColumn,
    setSort,
    clearFilters,
    savedViews,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
  } = useRoomTools();
  const members = useWorkspaceMembers();
  const columns = useBoardColumns();
  const [saveName, setSaveName] = useState("");

  if (!panel) return null;

  return (
    <div style={{ position: "relative" }}>
      {panel === "filter" ? (
        <ToolPanelShell
          onClose={onClose}
          panel="filter"
          subtitle="Applies to every view"
          title="Filter this project"
        >
          <div className={styles.roomFilterFields}>
            <label>
              <span>Priority</span>
              <select
                aria-label="Filter by priority"
                onChange={(event) => setPriority(event.target.value as "all" | Priority)}
                value={priority}
              >
                <option value="all">All priorities</option>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABEL[value].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Column</span>
              <select
                aria-label="Filter by column"
                onChange={(event) => setColumn(event.target.value)}
                value={column}
              >
                <option value="all">All columns</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Owner</span>
              <select
                aria-label="Filter by owner"
                onChange={(event) => setOwner(event.target.value)}
                value={owner}
              >
                <option value="all">Everyone</option>
                <option value="assigned">Has an owner</option>
                <option value="unassigned">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Date</legend>
              {DUE_OPTIONS.map(([value, label]) => (
                <label key={value}>
                  <input
                    checked={due === value}
                    name="due-filter"
                    onChange={() => setDue(value)}
                    type="radio"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <button className={styles.roomResetFilters} onClick={clearFilters} type="button">
              Clear filters
            </button>
          </div>
        </ToolPanelShell>
      ) : null}

      {panel === "sort" ? (
        <ToolPanelShell
          onClose={onClose}
          panel="sort"
          subtitle="Applies to every view"
          title="Order this project"
        >
          <fieldset className={styles.roomSortOptions}>
            <legend className="sr-only">Sort tasks</legend>
            {(
              [
                ["manual", "Workspace order", "Keep the deliberate column and group order."],
                ["date", "Schedule", "Dated work first, then explicitly unscheduled work."],
                ["title", "Task title", "A to Z within each view composition."],
              ] as const
            ).map(([value, label, description]) => (
              <label key={value}>
                <input
                  checked={sort === value}
                  name="room-sort"
                  onChange={() => setSort(value as RoomSortMode)}
                  type="radio"
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </ToolPanelShell>
      ) : null}

      {panel === "save" ? (
        <ToolPanelShell
          onClose={onClose}
          panel="save"
          subtitle="Current view, filters, sort, and density"
          title="Save this view"
        >
          <form
            className={styles.roomFilterFields}
            onSubmit={(event) => {
              event.preventDefault();
              const name = saveName.trim();
              if (!name) return;
              saveCurrentView(name, view);
              setSaveName("");
              onClose();
            }}
          >
            <label>
              <span>Name</span>
              <input
                aria-label="Saved view name"
                autoFocus
                maxLength={40}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="e.g. Overdue, mine only"
                style={{
                  background: "var(--x-task-raised)",
                  border: "1px solid var(--x-task-border)",
                  borderRadius: 6,
                  color: "var(--x-task-text)",
                  font: "inherit",
                  fontSize: 11,
                  minHeight: 30,
                  padding: "0 8px",
                }}
                type="text"
                value={saveName}
              />
            </label>
            <button className={styles.roomResetFilters} type="submit">
              Save to this project
            </button>
          </form>
          {/* The full loop lives here since T·115 retired the sidebar
              listing: a saved view you cannot reopen is not saved. */}
          {savedViews.length > 0 ? (
            <ul
              style={{
                borderTop: "1px solid var(--x-task-border)",
                display: "grid",
                gap: 2,
                listStyle: "none",
                margin: "12px 0 0",
                padding: "10px 0 0",
              }}
            >
              {savedViews.map((entry) => (
                <li key={entry.id} style={{ alignItems: "center", display: "flex", gap: 6 }}>
                  <button
                    onClick={() => {
                      applySavedView(entry.id);
                      onClose();
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--x-task-text)",
                      cursor: "pointer",
                      flex: 1,
                      font: "inherit",
                      fontSize: 11,
                      overflow: "hidden",
                      padding: "5px 2px",
                      textAlign: "left",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    // The display name, never the route key: the raw key
                    // says "timeline", the name of a different product.
                    title={`Open the ${VIEW_LABELS[entry.view as LabView] ?? entry.view} view with these filters`}
                    type="button"
                  >
                    {entry.name}
                    <span style={{ color: "var(--x-task-text-muted)", marginLeft: 6, fontSize: 9 }}>
                      {VIEW_LABELS[entry.view as LabView] ?? entry.view}
                    </span>
                  </button>
                  <button
                    aria-label={`Delete saved view ${entry.name}`}
                    onClick={() => deleteSavedView(entry.id)}
                    style={{
                      alignItems: "center",
                      background: "transparent",
                      border: 0,
                      color: "var(--x-task-text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      height: 24,
                      justifyContent: "center",
                      width: 24,
                    }}
                    type="button"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </ToolPanelShell>
      ) : null}
    </div>
  );
}
