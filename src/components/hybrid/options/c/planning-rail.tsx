"use client";

import { useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { differenceInDays, formatDate, formatDateLong, LAB_TODAY, scheduleIncludes, scheduleStart } from "../../dates";
import { useLabStore } from "../../store";
import type { CalendarDate, LabTask, LabView } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { ScheduleText, TaskOpenButton, TaskSelection } from "../../shared/task-ui";
import styles from "./option-c.module.css";

const PERIOD_START = "2026-07-06" as CalendarDate;
const PERIOD_END = "2026-08-14" as CalendarDate;

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
  const menu = useTaskContextMenu();
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled");
  const selectedDayTasks = tasks.filter((task) => task.schedule.kind !== "unscheduled" && scheduleIncludes(task.schedule, selectedDate));
  const completed = tasks.filter((task) => task.completed).length;
  const milestones = tasks
    .filter((task) => task.schedule.kind === "milestone" && task.schedule.on >= LAB_TODAY)
    .sort((a, b) => (scheduleStart(a.schedule) ?? "").localeCompare(scheduleStart(b.schedule) ?? ""));
  const planningView = view === "timeline" || view === "calendar";
  const periodDays = differenceInDays(PERIOD_START, PERIOD_END);
  const todayPosition = `${Math.max(0, Math.min(100, differenceInDays(PERIOD_START, LAB_TODAY) / periodDays * 100))}%`;

  const unscheduledKeyDown = (event: KeyboardEvent<HTMLElement>, task: LabTask) => {
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      menu.openMenuAt(task.id, event.currentTarget);
      return;
    }
    if (event.key === " ") {
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
      <aside aria-label="Collapsed planning rail" className={`${styles.planningRail} ${styles.planningRailCollapsed}`}>
        <button aria-expanded="false" className={styles.planningRailExpand} onClick={onToggle} type="button"><Icon name="arrow-left" size={14} /><span>Planning</span><strong>{unscheduled.length}</strong></button>
      </aside>
    );
  }

  return (
    <aside aria-label="Planning rail" className={styles.planningRail} id="c-planning-rail">
      <header className={styles.planningRailHeader}>
        <div><span>Planning period</span><strong>Public launch</strong></div>
        <button aria-expanded="true" aria-label="Collapse planning rail" onClick={onToggle} type="button"><Icon name="arrow-right" size={15} /></button>
      </header>

      <section className={styles.currentPosition}>
        <header><span>Current position</span><strong>{formatDate(LAB_TODAY, { weekday: "short", day: "numeric", month: "short" })}</strong></header>
        <div aria-label={`Today is ${differenceInDays(PERIOD_START, LAB_TODAY) + 1} days into the planning period`} className={styles.periodTrack}>
          <span className={styles.periodStart}>6 Jul</span><span className={styles.periodEnd}>14 Aug</span><i aria-hidden="true" style={{ left: todayPosition }} /><b aria-hidden="true" style={{ left: todayPosition }} />
        </div>
        <div className={styles.periodStats}><span><strong>{completed}</strong> complete</span><span><strong>{tasks.length - completed}</strong> open</span><span><strong>{unscheduled.length}</strong> unplanned</span></div>
      </section>

      {view === "calendar" ? (
        <section className={styles.selectedDayPanel}>
          <header>
            <div><span>Selected day</span><strong>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "short" })}</strong></div>
            <input aria-label="Selected calendar day" onChange={(event) => onSelectedDate(event.target.value as CalendarDate)} type="date" value={selectedDate} />
          </header>
          {selectedDayTasks.length > 0 ? (
            <ul>{selectedDayTasks.slice(0, 6).map((task) => <li data-task-id={task.id} key={task.id}><TaskOpenButton task={task}>{task.title}</TaskOpenButton><ScheduleText compact task={task} /></li>)}</ul>
          ) : <p>No dated work on this day.</p>}
          <button disabled={store.readOnly} onClick={() => store.addTask("queued", { kind: "due", dueOn: selectedDate })} type="button"><Icon name="add" size={13} />Add on {formatDate(selectedDate)}</button>
        </section>
      ) : null}

      <section className={styles.unscheduledSection}>
        <header>
          <button aria-expanded={unscheduledOpen} onClick={() => setUnscheduledOpen((value) => !value)} type="button"><Icon name={unscheduledOpen ? "chevron-down" : "chevron-right"} size={14} /><span>Unscheduled work</span><strong>{unscheduled.length}</strong></button>
          {planningView ? <small>Drag to the canvas or choose a date</small> : <small>Plan without leaving this view</small>}
        </header>
        {unscheduledOpen ? (
          <>
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
            <button className={styles.addUnscheduled} disabled={store.readOnly} onClick={() => store.addTask("queued")} type="button"><Icon name="add" size={13} />Add unscheduled task</button>
          </>
        ) : null}
      </section>

      <section className={styles.nextMilestone}>
        <span>Next milestone</span>
        {milestones[0] ? <TaskOpenButton task={milestones[0]}><strong>{milestones[0].title}</strong><small>{formatDateLong(milestones[0].schedule.kind === "milestone" ? milestones[0].schedule.on : LAB_TODAY)}</small></TaskOpenButton> : <p>No upcoming milestone in this filter.</p>}
      </section>
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </aside>
  );
}
