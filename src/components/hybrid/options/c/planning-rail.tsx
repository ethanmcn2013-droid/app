"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useProjectMoney } from "@/lib/domain-context";
import { budgetCoverageLine } from "@/lib/money";
import { differenceInDays, formatDate, formatDateLong, scheduleIncludes, scheduleStart } from "../../dates";
import { useLabStore } from "../../store";
import type { CalendarDate, LabTask, LabView } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { ScheduleText, TaskOpenButton, TaskSelection } from "../../shared/task-ui";
import styles from "./option-c.module.css";

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
  const menu = useTaskContextMenu();
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);
  const panelRef = useRef<HTMLElement | null>(null);
  // Below 768px the expanded rail leaves the flow and covers the workspace
  // (option-c.module.css). A thing that covers the workspace is a dialog:
  // it takes focus, closes on Escape, and hands focus back. Above 768px it
  // is an ordinary in-flow column and none of this applies.
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
  const money = useProjectMoney();
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled");
  const selectedDayTasks = tasks.filter((task) => task.schedule.kind !== "unscheduled" && scheduleIncludes(task.schedule, selectedDate));
  const completed = tasks.filter((task) => task.completed).length;
  // Every milestone, past ones included — the drawer is the project's
  // planning record, not just its future (moved here from the old header
  // module, 2026-08-05).
  const milestones = tasks
    .filter((task) => task.schedule.kind === "milestone")
    .sort((a, b) => (scheduleStart(a.schedule) ?? "").localeCompare(scheduleStart(b.schedule) ?? ""));
  const upcomingMilestones = milestones.filter((task) => task.schedule.kind === "milestone" && task.schedule.on >= calendar.today);
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
  const positionLabel = period
    ? calendar.today < period.startDate
      ? `Starts in ${Math.abs(todayOffset)} days`
      : calendar.today > period.endDate
        ? `Ended ${differenceInDays(period.endDate, calendar.today)} days ago`
        : `Day ${todayOffset + 1} of ${periodSpan + 1}`
    : null;

  const unscheduledKeyDown = (event: KeyboardEvent<HTMLElement>, task: LabTask) => {
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      menu.openMenuAt(task.id, event.currentTarget);
      return;
    }
    if (event.key === " ") {
      // Only when the row itself is focused — the same guard the views
      // use. Without it, Space inside the row's date input toggled
      // selection instead of typing.
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      event.stopPropagation();
      store.toggleSelected(task.id, orderedIds, event.shiftKey);
    }
  };

  const beginUnscheduledDrag = (event: DragEvent<HTMLElement>, task: LabTask) => {
    if (!planningView || store.readOnly) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline-tray", targetDate: null });
  };

  // Closed means gone: the drawer's trigger lives on the project band, so
  // no collapsed rail claims board width (the rotated strip is retired).
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
      animate={{ opacity: 1 }}
      aria-label="Planning"
      aria-modal={asOverlay ? true : undefined}
      className={styles.planningRail}
      id="c-planning-rail"
      initial={{ opacity: 0 }}
      ref={panelRef}
      role={asOverlay ? "dialog" : undefined}
      tabIndex={asOverlay ? -1 : undefined}
      transition={{ duration: reduceMotion ? 0.1 : 0.16 }}
    >
      <header className={styles.planningRailHeader}>
        <div><span>Planning</span><strong>{sourcePeriod?.name ?? "Dates not set"}</strong></div>
        <button aria-label="Close planning" onClick={onToggle} type="button"><Icon name="close" size={15} /></button>
      </header>

      {period ? (
        <section className={styles.currentPosition}>
          <header><span>Current position</span><strong>{formatDate(calendar.today, { weekday: "short", day: "numeric", month: "short" })}</strong></header>
          <div aria-label={positionLabel ?? undefined} className={styles.periodTrack}>
            <span className={styles.periodStart}>{formatDate(period.startDate)}</span><span className={styles.periodEnd}>{formatDate(period.endDate)}</span><i aria-hidden="true" style={{ left: todayPosition }} /><b aria-hidden="true" style={{ left: todayPosition }} />
          </div>
          <p className={styles.periodPositionLabel}>{positionLabel}</p>
          <div className={styles.periodStats}><span><strong>{completed}</strong> done</span><span><strong>{tasks.length - completed}</strong> open</span><span><strong>{unscheduled.length}</strong> unscheduled</span></div>
        </section>
      ) : (
        <section className={styles.currentPosition} data-empty="true">
          <header><span>Calendar position</span><strong>Not available</strong></header>
          <p>Add a start and end date to the project planning period to see time position. Tasks keep only dates you choose.</p>
          <div className={styles.periodStats}><span><strong>{completed}</strong> done</span><span><strong>{tasks.length - completed}</strong> open</span><span><strong>{unscheduled.length}</strong> unscheduled</span></div>
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

      <section className={styles.unscheduledSection}>
        <header>
          <button aria-expanded={unscheduledOpen} onClick={() => setUnscheduledOpen((value) => !value)} type="button"><Icon name={unscheduledOpen ? "chevron-down" : "chevron-right"} size={14} /><span>Unscheduled work</span><strong>{unscheduled.length}</strong></button>
          {planningView ? <small>Drag to the canvas or choose a date</small> : <small>Plan without leaving this view</small>}
        </header>
        <AnimatePresence initial={false}>
        {unscheduledOpen ? (
          <motion.div
            animate={{ opacity: 1, transform: "translateY(0)" }}
            className={styles.unscheduledDisclosure}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }}
            transition={{ duration: reduceMotion ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {unscheduled.length > 0 ? (
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
                    <div>
                      <TaskSelection orderedIds={orderedIds} task={task} />
                      <TaskOpenButton data-unscheduled-task-id={task.id} task={task}>{task.title}</TaskOpenButton>
                    </div>
                    <label><span>Schedule</span><input aria-label={`Schedule ${task.title}`} disabled={store.readOnly} onChange={(event) => { if (event.target.value) store.scheduleOn(task.id, event.target.value as CalendarDate); }} type="date" /></label>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.railEmpty}><Icon name="check" size={16} /><strong>Everything has a date</strong><span>No schedule has been inferred.</span></p>}
            {store.readOnly ? null : <button className={styles.addUnscheduled} onClick={() => store.addTask("todo")} type="button"><Icon name="add" size={13} />Add unscheduled task</button>}
          </motion.div>
        ) : null}
        </AnimatePresence>
      </section>

      {/* The milestones record, rehoused from the old header module. Past
          milestones stay listed — muted — because a plan you can no longer
          see is a plan you cannot trust. */}
      <section className={styles.railMilestones}>
        <header><span>Milestones</span>{milestones.length > 0 ? <strong>{milestones.length}</strong> : null}</header>
        {milestones.length > 0 ? (
          <ol>
            {milestones.map((task) => task.schedule.kind === "milestone" ? (
              <li data-past={task.schedule.on < calendar.today || undefined} data-task-id={task.id} key={task.id}>
                <time dateTime={task.schedule.on}>{formatDate(task.schedule.on)}</time>
                <TaskOpenButton task={task} />
              </li>
            ) : null)}
          </ol>
        ) : (
          <p>No milestones yet. Mark any task as a milestone from its card.</p>
        )}
        {upcomingMilestones[0] && upcomingMilestones[0].schedule.kind === "milestone" ? (
          <small>Next: {upcomingMilestones[0].title} · {formatDateLong(upcomingMilestones[0].schedule.on)}</small>
        ) : null}
      </section>

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
