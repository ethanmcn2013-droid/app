"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useDomain, useProjectMoney } from "@/lib/domain-context";
import { budgetCoverageLine } from "@/lib/money";
import { ActionsDropdown, type ActionItem } from "@/components/primitives/context-actions";
import { addDays, differenceInDays, formatDate, formatDateLong, scheduleIncludes, scheduleStart } from "../../dates";
import { activeUnscheduledTasks, endOfWeek } from "../../planning";
import { useLabStore } from "../../store";
import type { CalendarDate, LabTask, LabView } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { ScheduleText, TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-c.module.css";

/** Pull the part of the workspace title before " · " for display. */
function shortenWorkspaceTitle(value: string): string {
  const index = value.indexOf(" · ");
  return index > 0 ? value.slice(0, index) : value;
}

type UndoRecord = { ids: string[]; label: string };

export function PlanningRail({
  collapsed,
  onToggle,
  onSelectedDate,
  selectedDate,
  tasks,
  view,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onSelectedDate: (date: CalendarDate) => void;
  selectedDate: CalendarDate;
  tasks: LabTask[];
  view: LabView;
}) {
  const store = useLabStore();
  const reduceMotion = useReducedMotion();
  const calendar = useCalendarFrame();
  const domain = useDomain();
  const menu = useTaskContextMenu();
  const money = useProjectMoney();
  const panelRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState<"unscheduled" | "milestones">("unscheduled");
  // Selection for bulk scheduling is drawer-local: it must not open the
  // board's own bulk toolbar or collide with card selection semantics.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoRecord | null>(null);
  // The undo receipt fades on its own; keying the timer to the record
  // means a newer schedule simply restarts the window.
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 7000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  // Below 768px the drawer covers the workspace. A thing that covers the
  // workspace is a dialog: it takes focus, closes on Escape, and hands
  // focus back. At wider widths it is a docked (or edge-overlaid) panel
  // and none of this applies.
  const [asOverlay, setAsOverlay] = useState(false);
  useEffect(() => {
    if (collapsed) return;
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setAsOverlay(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [collapsed]);
  useEffect(() => {
    if (!asOverlay || collapsed) return;
    const panel = panelRef.current;
    const returnTo = document.activeElement as HTMLElement | null;
    panel?.focus({ preventScroll: true });
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onToggle();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [asOverlay, collapsed, onToggle]);

  const workspaceName = domain.boardName ?? shortenWorkspaceTitle(domain.workspaceTitle);
  const unscheduled = activeUnscheduledTasks(tasks);
  const selectedDayTasks = tasks.filter((task) => task.schedule.kind !== "unscheduled" && scheduleIncludes(task.schedule, selectedDate));
  // Milestones, upcoming first, then the past ones as a muted record.
  const milestones = useMemo(() => {
    const dated = tasks.filter((task) => task.schedule.kind === "milestone");
    const upcoming = dated
      .filter((task) => task.schedule.kind === "milestone" && task.schedule.on >= calendar.today)
      .sort((a, b) => (scheduleStart(a.schedule) ?? "").localeCompare(scheduleStart(b.schedule) ?? ""));
    const past = dated
      .filter((task) => task.schedule.kind === "milestone" && task.schedule.on < calendar.today)
      .sort((a, b) => (scheduleStart(b.schedule) ?? "").localeCompare(scheduleStart(a.schedule) ?? ""));
    return { upcoming, past, all: [...upcoming, ...past] };
  }, [calendar.today, tasks]);
  const planningView = view === "timeline" || view === "calendar";
  const sourcePeriod = calendar.planningPeriod;
  const period = sourcePeriod?.startDate && sourcePeriod.endDate
    ? {
        ...sourcePeriod,
        startDate: sourcePeriod.startDate as CalendarDate,
        endDate: sourcePeriod.endDate as CalendarDate,
      }
    : null;
  const periodSpan = period
    ? Math.max(1, differenceInDays(period.startDate, period.endDate))
    : 0;
  const todayOffset = period
    ? differenceInDays(period.startDate, calendar.today)
    : 0;
  const todayPosition = period
    ? `${Math.max(0, Math.min(100, todayOffset / periodSpan * 100))}%`
    : "0%";
  const positionLine = period
    ? calendar.today < period.startDate
      ? `Starts in ${Math.abs(todayOffset)} day${Math.abs(todayOffset) === 1 ? "" : "s"}`
      : calendar.today > period.endDate
        ? `Ended ${differenceInDays(period.endDate, calendar.today)} day${differenceInDays(period.endDate, calendar.today) === 1 ? "" : "s"} ago`
        : `Day ${todayOffset + 1} of ${periodSpan + 1} · ${periodSpan - todayOffset} day${periodSpan - todayOffset === 1 ? "" : "s"} left`
    : null;

  // Money, narrowly (T·124): restate and sum what the operator entered,
  // always with coverage. Renders only in this owner-side drawer — never
  // on share, print, embed or /p/{slug}.
  const costedTasks = tasks.filter((task) => typeof task.cents === "number" && task.cents > 0);
  const coverage = budgetCoverageLine({
    summedCents: costedTasks.reduce((sum, task) => sum + (task.cents ?? 0), 0),
    costedCount: costedTasks.length,
    uncostedCount: tasks.length - costedTasks.length,
    budgetCents: money.budgetCents,
    currency: money.currency,
  });

  const rememberUndo = (ids: string[], label: string) => {
    setUndo({ ids, label });
  };

  const scheduleOne = (task: LabTask, date: CalendarDate, label: string) => {
    store.scheduleOn(task.id, date);
    rememberUndo([task.id], `Scheduled “${task.title.length > 32 ? `${task.title.slice(0, 32)}…` : task.title}” for ${label}`);
    setSelectedIds((current) => {
      if (!current.has(task.id)) return current;
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
  };

  const scheduleSelected = (date: CalendarDate, label: string) => {
    const ids = unscheduled.filter((task) => selectedIds.has(task.id)).map((task) => task.id);
    if (ids.length === 0) return;
    ids.forEach((id) => store.scheduleOn(id, date));
    rememberUndo(ids, `Scheduled ${ids.length} task${ids.length === 1 ? "" : "s"} for ${label}`);
    setSelectedIds(new Set());
  };

  const undoScheduling = () => {
    if (!undo) return;
    undo.ids.forEach((id) => store.unscheduleTask(id));
    setUndo(null);
  };

  /** The quick presets every Schedule menu offers. */
  const presetItems = (apply: (date: CalendarDate, label: string) => void, onPick: () => void): ActionItem[] => {
    const today = calendar.today as CalendarDate;
    const items: Array<{ id: string; date: CalendarDate; label: string }> = [
      { id: "today", date: today, label: "today" },
      { id: "tomorrow", date: addDays(today, 1), label: "tomorrow" },
    ];
    const weekEnd = endOfWeek(today);
    if (weekEnd !== today && weekEnd !== addDays(today, 1)) {
      items.push({ id: "this-week", date: weekEnd, label: "this week" });
    }
    items.push({ id: "next-week", date: addDays(today, 7), label: "next week" });
    return [
      ...items.map(({ id, date, label }) => ({
        id,
        label: `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${formatDate(date)}`,
        group: "workflow" as ActionItem["group"],
        onSelect: () => apply(date, label),
      })),
      {
        id: "pick",
        label: "Pick a date…",
        group: "organisation" as ActionItem["group"],
        onSelect: onPick,
      },
    ];
  };

  const selectedCount = unscheduled.filter((task) => selectedIds.has(task.id)).length;
  const allSelected = unscheduled.length > 0 && selectedCount === unscheduled.length;

  const unscheduledKeyDown = (event: KeyboardEvent<HTMLElement>, task: LabTask) => {
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      menu.openMenuAt(task.id, event.currentTarget);
    }
  };

  const beginUnscheduledDrag = (event: DragEvent<HTMLElement>, task: LabTask) => {
    if (!planningView || store.readOnly) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline-tray", targetDate: null });
  };

  // Closed means gone: the drawer's trigger lives on the project band, so
  // no collapsed rail claims board width.
  if (collapsed) return null;

  return (
    <>
    {asOverlay ? (
      <div
        aria-hidden
        className={styles.planningScrim}
        onClick={onToggle}
      />
    ) : null}
    <motion.aside
      animate={{ opacity: 1, transform: "translateX(0px)" }}
      aria-label="Planning"
      aria-modal={asOverlay ? true : undefined}
      className={styles.planningRail}
      id="c-planning-rail"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateX(16px)" }}
      ref={panelRef}
      role={asOverlay ? "dialog" : undefined}
      tabIndex={asOverlay ? -1 : undefined}
      transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Scope, stated: this drawer plans the active project. The planning
          period it sits inside is the supporting line, dates included. */}
      <header className={styles.planningRailHeader}>
        <div>
          <span>Planning</span>
          <strong>{workspaceName}</strong>
          <small>
            {period
              ? `${sourcePeriod?.name ?? "Planning period"} · ${formatDate(period.startDate)} – ${formatDate(period.endDate)}`
              : sourcePeriod?.name ?? "No planning period dates"}
          </small>
        </div>
        <button aria-label="Close planning" onClick={onToggle} type="button"><Icon name="close" size={15} /></button>
      </header>

      {period ? (
        <section className={styles.currentPosition}>
          <div aria-label={positionLine ?? undefined} className={styles.periodTrack}>
            <span className={styles.periodStart}>{formatDate(period.startDate)}</span><span className={styles.periodEnd}>{formatDate(period.endDate)}</span><i aria-hidden="true" style={{ left: todayPosition }} /><b aria-hidden="true" style={{ left: todayPosition }} />
          </div>
          <p className={styles.periodPositionLabel}>{positionLine}</p>
        </section>
      ) : (
        <section className={styles.currentPosition} data-empty="true">
          <p>Add a start and end date to the planning period to see where today falls. Tasks keep only dates you choose.</p>
        </section>
      )}

      {view === "calendar" ? (
        <section className={styles.selectedDayPanel}>
          <header>
            <div><span>Selected day</span><strong>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "short" })}</strong></div>
            <input aria-label="Selected calendar day" onChange={(event) => onSelectedDate(event.target.value as CalendarDate)} type="date" value={selectedDate} />
          </header>
          {selectedDayTasks.length > 0 ? (
            <ul>{selectedDayTasks.slice(0, 6).map((task) => <li data-task-id={task.id} key={task.id}><TaskOpenButton task={task}>{task.title}</TaskOpenButton><ScheduleText compact task={task} /></li>)}</ul>
          ) : <p>No dated work on this day.</p>}
          {store.readOnly ? null : <button onClick={() => store.addTask("todo", { kind: "due", dueOn: selectedDate })} type="button"><Icon name="add" size={13} />Add on {formatDate(selectedDate)}</button>}
        </section>
      ) : null}

      {/* The drawer's two jobs, side by side — neither buried under the
          other. Counts come from the same selectors as the band badge. */}
      <div aria-label="Planning sections" className={styles.railTabs} role="tablist">
        <button
          aria-controls="planning-tab-unscheduled"
          aria-selected={tab === "unscheduled"}
          id="planning-tab-button-unscheduled"
          onClick={() => setTab("unscheduled")}
          role="tab"
          type="button"
        >
          Unscheduled{unscheduled.length > 0 ? <em>{unscheduled.length}</em> : null}
        </button>
        <button
          aria-controls="planning-tab-milestones"
          aria-selected={tab === "milestones"}
          id="planning-tab-button-milestones"
          onClick={() => setTab("milestones")}
          role="tab"
          type="button"
        >
          Milestones{milestones.all.length > 0 ? <em>{milestones.all.length}</em> : null}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {undo ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={styles.railUndo}
            exit={{ opacity: 0 }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            role="status"
            transition={{ duration: 0.14 }}
          >
            <span>{undo.label}</span>
            <button onClick={undoScheduling} type="button">Undo</button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {tab === "unscheduled" ? (
        <section
          aria-labelledby="planning-tab-button-unscheduled"
          className={styles.unscheduledSection}
          id="planning-tab-unscheduled"
          role="tabpanel"
        >
          {unscheduled.length > 0 ? (
            <>
              <header>
                <small>Give each task a day, or drag it onto the Schedule or Calendar view.</small>
                {unscheduled.length > 1 && !store.readOnly ? (
                  <button
                    onClick={() => setSelectedIds(allSelected ? new Set() : new Set(unscheduled.map((task) => task.id)))}
                    type="button"
                  >
                    {allSelected ? "Clear selection" : "Select all"}
                  </button>
                ) : null}
              </header>
              <ul className={styles.unscheduledList}>
                {unscheduled.map((task) => (
                  <li
                    data-unscheduled-task-id={task.id}
                    data-task-id={task.id}
                    draggable={planningView && !store.readOnly}
                    key={task.id}
                    onContextMenu={(event: MouseEvent<HTMLLIElement>) => menu.openMenu(task.id, event)}
                    onDragEnd={() => store.setDrag(null)}
                    onDragStart={(event) => beginUnscheduledDrag(event, task)}
                    onKeyDown={(event) => unscheduledKeyDown(event, task)}
                  >
                    <div className={styles.unscheduledMain}>
                      {store.readOnly ? null : (
                        <input
                          aria-label={`Select ${task.title} for scheduling`}
                          checked={selectedIds.has(task.id)}
                          className={styles.railSelect}
                          onChange={() => setSelectedIds((current) => {
                            const next = new Set(current);
                            if (next.has(task.id)) next.delete(task.id);
                            else next.add(task.id);
                            return next;
                          })}
                          type="checkbox"
                        />
                      )}
                      <TaskOpenButton data-unscheduled-task-id={task.id} task={task}>{task.title}</TaskOpenButton>
                      {store.readOnly ? null : (
                        <ActionsDropdown
                          items={presetItems(
                            (date, label) => scheduleOne(task, date, label),
                            () => setPickingId((current) => (current === task.id ? null : task.id)),
                          )}
                          trigger={<>Schedule<Icon name="chevron-down" size={12} /></>}
                          triggerClassName={styles.railScheduleTrigger}
                          triggerLabel={`Schedule ${task.title}`}
                        />
                      )}
                    </div>
                    {pickingId === task.id ? (
                      <label className={styles.railDatePick}>
                        <span>Date</span>
                        <input
                          aria-label={`Date for ${task.title}`}
                          autoFocus
                          disabled={store.readOnly}
                          onChange={(event) => {
                            if (!event.target.value) return;
                            setPickingId(null);
                            scheduleOne(task, event.target.value as CalendarDate, formatDate(event.target.value as CalendarDate));
                          }}
                          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setPickingId(null); } }}
                          type="date"
                        />
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
              {store.readOnly ? null : <button className={styles.addUnscheduled} onClick={() => store.addTask("todo")} type="button"><Icon name="add" size={13} />Add unscheduled task</button>}
            </>
          ) : (
            <p className={styles.railEmpty}><Icon name="check" size={16} /><strong>Everything has a date</strong><span>New tasks without one will appear here.</span></p>
          )}
        </section>
      ) : (
        <section
          aria-labelledby="planning-tab-button-milestones"
          className={styles.railMilestones}
          id="planning-tab-milestones"
          role="tabpanel"
        >
          {milestones.all.length > 0 ? (
            <ol>
              {milestones.all.map((task) => task.schedule.kind === "milestone" ? (
                <li data-past={task.schedule.on < calendar.today || undefined} data-task-id={task.id} key={task.id}>
                  <time dateTime={task.schedule.on}>{formatDate(task.schedule.on)}</time>
                  <TaskOpenButton task={task} />
                </li>
              ) : null)}
            </ol>
          ) : (
            <p>No milestones yet. Mark any task as a milestone from its card menu.</p>
          )}
          {milestones.upcoming[0] && milestones.upcoming[0].schedule.kind === "milestone" ? (
            <small title={`${milestones.upcoming[0].title} · ${formatDateLong(milestones.upcoming[0].schedule.on)}`}>
              Next: {formatDateLong(milestones.upcoming[0].schedule.on)}
            </small>
          ) : null}
        </section>
      )}

      {selectedCount > 0 && tab === "unscheduled" ? (
        <div className={styles.railBulkBar}>
          <strong>{selectedCount} selected</strong>
          <ActionsDropdown
            items={presetItems(
              (date, label) => scheduleSelected(date, label),
              () => {
                const first = unscheduled.find((task) => selectedIds.has(task.id));
                if (first) setPickingId(first.id);
              },
            )}
            trigger={<>Schedule<Icon name="chevron-down" size={12} /></>}
            triggerClassName={styles.railBulkSchedule}
            triggerLabel={`Schedule ${selectedCount} selected tasks`}
          />
          <button onClick={() => setSelectedIds(new Set())} type="button">Clear</button>
        </div>
      ) : null}

      {coverage ? (
        <section aria-label="Costs" className={styles.railCosts}>
          <span>Costs</span>
          <p>{coverage}</p>
        </section>
      ) : null}
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </motion.aside>
    </>
  );
}
