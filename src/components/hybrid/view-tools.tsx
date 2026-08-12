"use client";

/**
 * View tools — the room's working controls, remounted into the hybrid
 * view bar (T·125). The T·99 interior consolidation dropped the 52px
 * room band and with it Filter / Sort / Save view and the Share/export
 * cluster; this module restores them against the live hybrid store.
 *
 * State stays in RoomToolsProvider (unchanged localStorage saved-view
 * contract), widened per the founder's call: filter by date, by owner
 * *by name*, and by board status. Filtering happens here on LabTask —
 * the views render exactly what the tools admit, while the brief and
 * planning rail keep the whole project (receipts never shrink to a
 * filtered subset).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { PRIORITY_LABEL, type Priority } from "@/lib/data";
import {
  useRoomTools,
  type RoomDueFilter,
  type RoomSortMode,
} from "@/components/app/room/room-tools-context";
import { Icon } from "@/components/app/room/room-icons";
import { useWorkspaceMembers } from "@/lib/domain-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
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
import { useFitColumns, useShowStatusDescriptions } from "./view-prefs";
import styles from "@/components/app/room/option-b.module.css";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];

export type ViewToolPanel = "filter" | "sort" | "view" | null;

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
}: {
  panel: ViewToolPanel;
  onToggle: (next: Exclude<ViewToolPanel, null>) => void;
  view: LabView;
}) {
  const { activeFilterCount, sort, savedViews } = useRoomTools();
  // When the board is not in its deliberate manual order, the button says
  // what IS ordering it — a sorted board that just says "Sort" hides the
  // one fact needed to understand the card order. "Due date", not
  // "Schedule": a tab named Schedule sits 400px away on the same row, and
  // a sort mode must not borrow a view's name.
  const sortLabel = sort === "date" ? "Sort · Due date" : sort === "title" ? "Sort · Title" : "Sort";
  return (
    <>
      <button
        aria-controls={panel === "filter" ? "tool-panel-filter" : undefined}
        aria-expanded={panel === "filter"}
        aria-haspopup="dialog"
        data-active={activeFilterCount > 0 || undefined}
        data-tool-trigger="filter"
        onClick={() => onToggle("filter")}
        title="Filter this view"
        type="button"
      >
        <Icon name="filter" size={15} />
        Filter
        {activeFilterCount > 0 ? <em aria-label={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}>{activeFilterCount}</em> : null}
      </button>
      <button
        aria-controls={panel === "sort" ? "tool-panel-sort" : undefined}
        aria-expanded={panel === "sort"}
        aria-haspopup="dialog"
        data-active={sort !== "manual" || undefined}
        data-tool-trigger="sort"
        onClick={() => onToggle("sort")}
        title="Sort this view"
        type="button"
      >
        <Icon name="sort" size={15} />
        {sortLabel}
      </button>
      {/* "Display", never "View": four view tabs share this row, and a
          button called View beside them gave the word two meanings. With
          saved views the label carries the count — the home the save
          toast promises has to look like one. */}
      <button
        aria-controls={panel === "view" ? "tool-panel-view" : undefined}
        aria-expanded={panel === "view"}
        aria-haspopup="dialog"
        data-tool-trigger="view"
        onClick={() => onToggle("view")}
        title="Layout, cards, and saved views"
        type="button"
      >
        <Icon name="fields" size={15} />
        Display
        {savedViews.length > 0 ? <em aria-label={`${savedViews.length} saved view${savedViews.length === 1 ? "" : "s"}`}>{savedViews.length}</em> : null}
      </button>
    </>
  );
}

/**
 * Active filters as removable chips, shown only while something is
 * actually filtered — the calm default toolbar stays a toolbar. Each chip
 * removes exactly its own condition; "Clear all" appears once two or more
 * are active.
 */
export function ActiveFilterChips() {
  const {
    query,
    setQuery,
    priority,
    setPriority,
    owner,
    setOwner,
    due,
    setDue,
    column,
    setColumn,
    clearFilters,
    activeFilterCount,
  } = useRoomTools();
  const members = useWorkspaceMembers();
  const columns = useBoardColumns();
  if (activeFilterCount === 0) return null;

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (query.trim()) chips.push({ key: "query", label: `“${query.trim()}”`, clear: () => setQuery("") });
  if (priority !== "all") chips.push({ key: "priority", label: PRIORITY_LABEL[priority].label, clear: () => setPriority("all") });
  if (column !== "all") {
    const name = columns.find((c) => c.key === column)?.name ?? column;
    chips.push({ key: "column", label: name, clear: () => setColumn("all") });
  }
  if (owner !== "all") {
    const label = owner === "assigned"
      ? "Has an owner"
      : owner === "unassigned"
        ? "No owner"
        : members.find((member) => member.id === owner)?.name ?? "Owner";
    chips.push({ key: "owner", label, clear: () => setOwner("all") });
  }
  if (due !== "all") {
    const label = DUE_OPTIONS.find(([value]) => value === due)?.[1] ?? "Date";
    chips.push({ key: "due", label, clear: () => setDue("all") });
  }
  if (chips.length === 0) return null;

  return (
    <div aria-label="Active filters" className={styles.activeChipsRow} role="group">
      {chips.map((chip) => (
        <button
          aria-label={`Remove filter: ${chip.label}`}
          className={styles.activeChip}
          key={chip.key}
          onClick={chip.clear}
          type="button"
        >
          {chip.label}
          <Icon name="close" size={11} />
        </button>
      ))}
      {chips.length > 1 ? (
        <button className={styles.activeChipsClear} onClick={clearFilters} type="button">
          Clear all
        </button>
      ) : null}
    </div>
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
  const shellRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // The popover contract the panel was missing: Escape closes it from
  // anywhere (the old handler only heard keys once focus was already
  // inside), pointer-down outside closes it (it used to float over the
  // board until the user found its ×), focus lands inside on open and
  // returns to the trigger on close.
  useEffect(() => {
    const node = shellRef.current;
    if (node && !node.contains(document.activeElement)) node.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (node?.contains(target)) return;
      // The three tool triggers toggle their own panel — closing here too
      // would reopen it on the same click. Scoped to THESE triggers only:
      // a blanket aria-haspopup exclusion let unrelated popover triggers
      // (the nav drawer's, notably) open their surface OVER a still-open
      // panel.
      if (target.closest?.("[data-tool-trigger]")) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      document
        .querySelector<HTMLElement>(`[data-tool-trigger="${panel}"]`)
        ?.focus();
    };
  }, [panel]);

  return (
    <section
      aria-label={title}
      className={styles.roomToolPanel}
      id={`tool-panel-${panel}`}
      ref={shellRef}
      role="dialog"
      tabIndex={-1}
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
  onShowShortcuts,
}: {
  panel: ViewToolPanel;
  onClose: () => void;
  view: LabView;
  onShowShortcuts?: () => void;
}) {
  const {
    priority,
    owner,
    due,
    column,
    sort,
    density,
    setDensity,
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
  const [showDescriptions, toggleDescriptions] = useShowStatusDescriptions();
  const [fitColumns, toggleFitColumns] = useFitColumns();

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
              <span>Status</span>
              <select
                aria-label="Filter by status"
                onChange={(event) => setColumn(event.target.value)}
                value={column}
              >
                <option value="all">All statuses</option>
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
                <option value="unassigned">No owner</option>
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
                ["manual", "Workspace order", "Keep the deliberate status and group order."],
                ["date", "Due date", "Dated work first, then explicitly unscheduled work."],
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

      {panel === "view" ? (
        <ToolPanelShell
          onClose={onClose}
          panel="view"
          subtitle="Layout, cards, and saved views"
          title="Display"
        >
          <div className={styles.roomFilterFields}>
            <fieldset>
              <legend>Density</legend>
              {(
                [
                  ["comfortable", "Comfortable"],
                  ["compact", "Compact"],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    checked={density === value}
                    name="view-density"
                    onChange={() => setDensity(value)}
                    type="radio"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label className={styles.roomToggleRow}>
              <input
                checked={fitColumns}
                onChange={toggleFitColumns}
                type="checkbox"
              />
              <span>Fit statuses to the board</span>
            </label>
            <label className={styles.roomToggleRow}>
              <input
                checked={showDescriptions}
                onChange={toggleDescriptions}
                type="checkbox"
              />
              <span>Show status descriptions</span>
            </label>
          </div>
          <div className={styles.viewPanelSection}>
            <span className={styles.viewPanelHeading}>Saved views</span>
          </div>
          <form
            className={styles.roomFilterFields}
            onSubmit={(event) => {
              event.preventDefault();
              const name = saveName.trim();
              if (!name) return;
              saveCurrentView(name, view);
              setSaveName("");
              // A save with no confirmation reads as a no-op. The toast
              // names the saved thing and where it now lives; the Display
              // trigger carries the saved count so that home is visible.
              window.dispatchEvent(
                new CustomEvent("tasks:toast", {
                  detail: {
                    title: `"${name}" saved`,
                    body: "Reopen it any time from the Display menu.",
                    tone: "success",
                  },
                }),
              );
              onClose();
            }}
          >
            <label>
              <span>Name</span>
              {/* No autoFocus: it won the race against the shell's own
                  focus, landing screen readers mid-panel at a tertiary
                  field instead of the dialog top. */}
              <input
                aria-label="Saved view name"
                className={styles.savedViewNameInput}
                maxLength={40}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="e.g. Overdue, mine only"
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
            <ul className={styles.savedViewsList}>
              {savedViews.map((entry) => (
                <li key={entry.id}>
                  <button
                    className={styles.savedViewOpen}
                    onClick={() => {
                      applySavedView(entry.id);
                      onClose();
                    }}
                    // The display name, never the route key: the raw key
                    // says "timeline", the name of a different product.
                    title={`Open the ${VIEW_LABELS[entry.view as LabView] ?? entry.view} view with these filters`}
                    type="button"
                  >
                    {entry.name}
                    <small>{VIEW_LABELS[entry.view as LabView] ?? entry.view}</small>
                  </button>
                  <button
                    aria-label={`Delete saved view ${entry.name}`}
                    className={styles.savedViewDelete}
                    onClick={() => deleteSavedView(entry.id)}
                    type="button"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {onShowShortcuts ? (
            <button
              className={styles.viewPanelShortcuts}
              onClick={() => {
                onClose();
                onShowShortcuts();
              }}
              type="button"
            >
              <span>Keyboard shortcuts</span>
              <kbd>?</kbd>
            </button>
          ) : null}
        </ToolPanelShell>
      ) : null}
    </div>
  );
}
