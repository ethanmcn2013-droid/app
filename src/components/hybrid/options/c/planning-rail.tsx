"use client";

import { useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
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
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled");
  const selectedDayTasks = tasks.filter((task) => task.schedule.kind !== "unscheduled" && scheduleIncludes(task.schedule, selectedDate));
  const completed = tasks.filter((task) => task.completed).length;
  const milestones = tasks
    .filter((task) => task.schedule.kind === "milestone" && task.schedule.on >= calendar.today)
    .sort((a, b) => (scheduleStart(a.schedule) ?? "").localeCompare(scheduleStart(b.schedule) ?? ""));
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

  if (collapsed) {
    return (
      <motion.aside
        animate={{ opacity: 1 }}
        aria-label="Collapsed planning rail"
        className={`${styles.planningRail} ${styles.planningRailCollapsed}`}
        initial={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.16 }}
      >
        <button aria-expanded="false" aria-label={`Expand the planning rail. ${unscheduled.length} unscheduled task${unscheduled.length === 1 ? "" : "s"}.`} className={styles.planningRailExpand} onClick={onToggle} title={`${unscheduled.length} unscheduled`} type="button"><Icon name="arrow-left" size={14} /><span>Planning</span><strong>{unscheduled.length}</strong></button>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      animate={{ opacity: 1 }}
      aria-label="Planning rail"
      className={styles.planningRail}
      id="c-planning-rail"
      initial={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.16 }}
    >
      <header className={styles.planningRailHeader}>
        <div><span>Planning period</span><strong>{sourcePeriod?.name ?? "Dates not set"}</strong></div>
        <button aria-expanded="true" aria-label="Collapse planning rail" onClick={onToggle} type="button"><Icon name="arrow-right" size={15} /></button>
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
          <button disabled={store.readOnly} onClick={() => store.addTask("todo", { kind: "due", dueOn: selectedDate })} type="button"><Icon name="add" size={13} />Add on {formatDate(selectedDate)}</button>
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
            <button className={styles.addUnscheduled} disabled={store.readOnly} onClick={() => store.addTask("todo")} type="button"><Icon name="add" size={13} />Add unscheduled task</button>
          </motion.div>
        ) : null}
        </AnimatePresence>
      </section>

      <section className={styles.nextMilestone}>
        <span>Next milestone</span>
        {milestones[0] && milestones[0].schedule.kind === "milestone" ? <TaskOpenButton task={milestones[0]}><strong>{milestones[0].title}</strong><small>{formatDateLong(milestones[0].schedule.on)}</small></TaskOpenButton> : <p>No upcoming milestone in this filter.</p>}
      </section>
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </motion.aside>
  );
}
