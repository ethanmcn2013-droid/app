"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import {
  addDays,
  differenceInDays,
  eachDate,
  formatDate,
  formatSchedule,
  isTaskDueToday,
  isTaskOverdue,
  scheduleStart,
  startOfWeek,
} from "../../dates";
import { scheduleFromDrop, useLabStore } from "../../store";
import type { CalendarDate, LabTask } from "../../types";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { Icon } from "../../shared/icons";
import {
  AvatarStack,
  PriorityMark,
  ScheduleText,
  TaskCompletion,
  TaskOpenButton,
  TaskSelection,
} from "../../shared/task-ui";
import { DateCommand, SurfaceEmpty } from "./quiet-command-components";
import { clamp, dateSpan, focusTask } from "./quiet-command-model";
import styles from "./option-a.module.css";

type TimelineZoom = "day" | "week" | "month";

const ZOOM: Record<TimelineZoom, { days: number; cell: number; shift: number }> = {
  day: { days: 21, cell: 48, shift: 7 },
  week: { days: 42, cell: 28, shift: 14 },
  month: { days: 84, cell: 18, shift: 28 },
};

function within(date: CalendarDate, dates: CalendarDate[]): boolean {
  return date >= dates[0] && date <= dates[dates.length - 1];
}

export function TimelineView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const context = useTaskContextMenu();
  const [zoom, setZoom] = useState<TimelineZoom>("week");
  const fitStart = (calendar.planningPeriod?.startDate ??
    startOfWeek(calendar.today)) as CalendarDate;
  const [start, setStart] = useState<CalendarDate>(() => fitStart);
  const resizeTask = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // First paint keeps today (and with it, this week's bars) in view. The
  // range can start at the planning period's opening date — on a phone
  // that left the visible window entirely empty until a manual pan.
  const didAnchorScroll = useRef(false);
  // Where the pointer was when the drag began. The drop moves the schedule
  // by the pointer's own travel, so manipulation is one-to-one by
  // construction (motion contract, Budgets) — no grid or element geometry
  // to get wrong. Measuring the grabbed ELEMENT instead was what threw a
  // due marker days off: its pill is as wide as its label, not its day.
  const dragStartX = useRef<number | null>(null);
  const config = ZOOM[zoom];
  const dates = useMemo(() => eachDate(start, addDays(start, config.days - 1)), [config.days, start]);
  const gridWidth = dates.length * config.cell;
  const scheduled = useMemo(() => tasks
    .filter((task) => task.schedule.kind !== "unscheduled")
    .sort((a, b) => (scheduleStart(a.schedule) ?? "9999-12-31").localeCompare(scheduleStart(b.schedule) ?? "9999-12-31")), [tasks]);
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled");
  const orderedIds = [...scheduled, ...unscheduled].map((task) => task.id);
  const activeTask = store.activeId ? store.taskById(store.activeId) : undefined;
  const todayIndex = differenceInDays(start, calendar.today);

  useEffect(() => {
    if (didAnchorScroll.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    didAnchorScroll.current = true;
    if (todayIndex <= 1 || todayIndex >= dates.length) return;
    const target = Math.max(0, (todayIndex - 1) * config.cell);
    // Only pan when today would otherwise be off-screen (phones, mostly).
    if (target > scroller.clientWidth * 0.5) scroller.scrollLeft = target;
  }, [config.cell, dates.length, todayIndex]);

  const dropAtDate = (event: DragEvent, date: CalendarDate) => {
    event.preventDefault();
    event.stopPropagation();
    if (store.readOnly) return;
    const taskId = event.dataTransfer.getData("text/task-id") || store.drag?.taskId;
    const task = taskId ? store.taskById(taskId) : undefined;
    if (!task) return;
    if (resizeTask.current === task.id && task.schedule.kind === "range") {
      store.resizeScheduleByDays(task.id, differenceInDays(task.schedule.dueOn, date));
    } else if (task.schedule.kind === "unscheduled") {
      store.scheduleTask(task.id, scheduleFromDrop(date));
    } else if (dragStartX.current !== null) {
      // The schedule travels exactly as far as the pointer did.
      const days = Math.round((event.clientX - dragStartX.current) / config.cell);
      if (days !== 0) store.moveScheduleByDays(task.id, days);
    } else {
      const currentStart = scheduleStart(task.schedule);
      if (currentStart) store.moveScheduleByDays(task.id, differenceInDays(currentStart, date));
    }
    dragStartX.current = null;
    resizeTask.current = null;
    store.setDrag(null);
    store.setActive(task.id);
    focusTask(task.id);
  };

  const dateFromPointer = (event: DragEvent<HTMLElement>): CalendarDate => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = clamp(Math.floor((event.clientX - rect.left) / config.cell), 0, dates.length - 1);
    return dates[index];
  };

  const keyTask = (event: KeyboardEvent<HTMLElement>, task: LabTask, index: number, control = false) => {
    if (!control && event.target !== event.currentTarget) return;
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      context.openMenuAt(task.id, event.currentTarget);
      return;
    }
    if (event.key === "F2" && !store.readOnly) {
      event.preventDefault();
      store.setEditing(task.id, "title");
      return;
    }
    if (event.key === " " && control) {
      event.preventDefault();
      store.toggleSelected(task.id, orderedIds, event.shiftKey);
      return;
    }
    if (event.key === " " && !control) {
      event.preventDefault();
      store.toggleSelected(task.id, orderedIds, event.shiftKey);
      return;
    }
    if (event.key === "Enter" && !control) {
      event.preventDefault();
      store.openTask(task.id);
      return;
    }
    if (event.altKey && !store.readOnly && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const amount = event.key === "ArrowLeft" ? -1 : 1;
      if (event.shiftKey && task.schedule.kind === "range") store.resizeScheduleByDays(task.id, amount);
      else if (task.schedule.kind !== "unscheduled") store.moveScheduleByDays(task.id, amount);
      return;
    }
    if (!event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const next = scheduled[event.key === "ArrowUp" ? index - 1 : index + 1];
      if (next) focusTask(next.id);
    }
  };

  const beginScheduledDrag = (event: DragEvent, task: LabTask) => {
    if (store.readOnly) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    dragStartX.current = event.clientX;
    store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline", targetDate: null });
  };

  const renderShape = (task: LabTask, index: number) => {
    const span = dateSpan(task);
    if (!span) return null;
    const intersects = span.end >= dates[0] && span.start <= dates[dates.length - 1];
    if (!intersects) {
      return (
        <button className={styles.outsideRange} onClick={() => setStart(addDays(span.start, -2))} type="button">
          Outside range. Jump to {formatDate(span.start)}
        </button>
      );
    }
    if (task.schedule.kind === "range") {
      const rawStart = differenceInDays(start, task.schedule.startOn);
      const rawEnd = differenceInDays(start, task.schedule.dueOn) + 1;
      const left = Math.max(0, rawStart) * config.cell + 3;
      const right = Math.min(dates.length, rawEnd) * config.cell - 3;
      return (
        <div
          className={styles.timelineRange}
          data-clipped-end={rawEnd > dates.length || undefined}
          data-clipped-start={rawStart < 0 || undefined}
          data-dragging={store.drag?.kind === "schedule" && store.drag.taskId === task.id || undefined}
          data-inspected={store.inspectedId === task.id || undefined}
          data-recently-placed={store.recentlyPlacedId === task.id || undefined}
          data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
          data-scheduled-task-id={task.id}
          style={{ left, width: Math.max(12, right - left) }}
        >
          <TaskOpenButton
            aria-label={`${task.title}, ${formatSchedule(task.schedule)}. Alt plus arrows moves. Alt plus Shift plus arrows changes the end date.`}
            className={styles.timelineRangeButton}
            draggable={!store.readOnly}
            onContextMenu={(event) => context.openMenu(task.id, event)}
            onDragEnd={() => { resizeTask.current = null; store.setDrag(null); }}
            onDragStart={(event) => beginScheduledDrag(event, task)}
            onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
            onKeyDown={(event) => keyTask(event, task, index, true)}
            onMouseEnter={() => store.setPreview(task.id)}
            onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
            task={task}
          >
            <span>{task.title}</span><small>{formatDate(task.schedule.startOn)} - {formatDate(task.schedule.dueOn)}</small>
          </TaskOpenButton>
          <button
            aria-label={`Drag to resize end date for ${task.title}`}
            className={styles.rangeHandle}
            disabled={store.readOnly}
            draggable={!store.readOnly}
            onDragEnd={() => { resizeTask.current = null; store.setDrag(null); }}
            onDragStart={(event) => {
              event.stopPropagation();
              resizeTask.current = task.id;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/task-id", task.id);
              store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline", targetDate: null });
            }}
            type="button"
          />
        </div>
      );
    }
    if (task.schedule.kind !== "due" && task.schedule.kind !== "milestone") return null;
    const date = task.schedule.kind === "due" ? task.schedule.dueOn : task.schedule.on;
    if (!within(date, dates)) return null;
    const left = differenceInDays(start, date) * config.cell + config.cell / 2;
    return (
      <TaskOpenButton
        aria-label={`${task.title}, ${formatSchedule(task.schedule)}. Alt plus Left or Right moves by one day.`}
        className={task.schedule.kind === "milestone" ? styles.timelineMilestone : styles.timelineDue}
        data-due-today={isTaskDueToday(task, calendar.today) || undefined}
        data-dragging={store.drag?.kind === "schedule" && store.drag.taskId === task.id || undefined}
        data-overdue={isTaskOverdue(task, calendar.today) || undefined}
        data-inspected={store.inspectedId === task.id || undefined}
        data-recently-placed={store.recentlyPlacedId === task.id || undefined}
        data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
        data-scheduled-task-id={task.id}
        draggable={!store.readOnly}
        onContextMenu={(event) => context.openMenu(task.id, event)}
        onDragEnd={() => store.setDrag(null)}
        onDragStart={(event) => beginScheduledDrag(event, task)}
        onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
        onKeyDown={(event) => keyTask(event, task, index, true)}
        onMouseEnter={() => store.setPreview(task.id)}
        onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
        style={{ left }}
        task={task}
      >
        {task.schedule.kind === "milestone" ? <span aria-hidden="true" className={styles.milestoneDiamond} /> : <span aria-hidden="true" className={styles.dueStem} />}
        <span>{task.title}</span>
      </TaskOpenButton>
    );
  };

  return (
    <div className={styles.timelineSurface}>
      <header className={styles.timelineToolbar}>
        <div className={styles.rangeNavigation}>
          <button aria-label="Previous timeline range" onClick={() => setStart(addDays(start, -config.shift))} type="button"><Icon name="arrow-left" size={14} /></button>
          <button onClick={() => { setStart(fitStart); setZoom("month"); }} type="button">Fit</button>
          <button aria-label="Next timeline range" onClick={() => setStart(addDays(start, config.shift))} type="button"><Icon name="arrow-right" size={14} /></button>
        </div>
        <strong>{formatDate(dates[0], { day: "numeric", month: "short", year: "numeric" })} – {formatDate(dates[dates.length - 1], { day: "numeric", month: "short", year: "numeric" })}</strong>
        <div aria-label="Schedule zoom" className={styles.zoomControl} role="group">
          {(["day", "week", "month"] as TimelineZoom[]).map((level) => <button aria-pressed={zoom === level} key={level} onClick={() => setZoom(level)} type="button">{level[0].toUpperCase() + level.slice(1)}</button>)}
        </div>
      </header>

      <div className={styles.mobileSchedule}>
        <header className={styles.mobileScheduleHeader}>
          <div>
            <span>Schedule</span>
            <strong>Put every task on a clear day.</strong>
          </div>
          <span>{scheduled.length} dated</span>
        </header>

        <div className={styles.mobileDateCommand}>
          <DateCommand label="Edit dates" task={activeTask} />
        </div>

        <section aria-labelledby="mobile-unscheduled-heading" className={styles.mobileScheduleGroup}>
          <header>
            <div>
              <strong id="mobile-unscheduled-heading">Needs a date</strong>
              <span>{unscheduled.length}</span>
            </div>
            <small>Choose a task, then set its date above.</small>
          </header>
          <div className={styles.mobileScheduleList}>
            {unscheduled.map((task) => (
              <article className={styles.mobileScheduleCard} data-task-id={task.id} key={task.id}>
                <TaskCompletion task={task} />
                <span className={styles.mobileScheduleCopy}>
                  <TaskOpenButton task={task}>{task.title}</TaskOpenButton>
                  <span><PriorityMark task={task} withLabel /><ScheduleText compact task={task} /></span>
                </span>
                <button
                  className={styles.mobileScheduleAction}
                  disabled={store.readOnly}
                  onClick={() => store.setActive(task.id)}
                  type="button"
                >
                  Choose date
                </button>
              </article>
            ))}
            {unscheduled.length === 0 ? (
              <p className={styles.mobileScheduleEmpty}>Every visible task has a date.</p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="mobile-dated-heading" className={styles.mobileScheduleGroup}>
          <header>
            <div>
              <strong id="mobile-dated-heading">Scheduled</strong>
              <span>{scheduled.length}</span>
            </div>
            <small>Earliest first.</small>
          </header>
          <div className={styles.mobileScheduleList}>
            {scheduled.map((task) => (
              <article className={styles.mobileScheduleCard} data-task-id={task.id} key={task.id}>
                <TaskCompletion task={task} />
                <span className={styles.mobileScheduleCopy}>
                  <TaskOpenButton task={task}>{task.title}</TaskOpenButton>
                  <span><PriorityMark task={task} withLabel /><ScheduleText compact task={task} /></span>
                </span>
                <button
                  className={styles.mobileScheduleAction}
                  disabled={store.readOnly}
                  onClick={() => store.setActive(task.id)}
                  type="button"
                >
                  Edit dates
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section aria-labelledby="a-timeline-unscheduled" className={styles.unscheduledTray}>
        <header><div><Icon name="inbox" size={15} /><strong id="a-timeline-unscheduled">Unscheduled</strong><span>{unscheduled.length}</span></div><small>Drag a task onto any date, or focus it and use the date controls.</small></header>
        <div className={styles.unscheduledItems}>
          {unscheduled.map((task, index) => (
            <article
              aria-label={`${task.title}, unscheduled`}
              className={styles.unscheduledItem}
              data-dragging={store.drag?.kind === "schedule" && store.drag.taskId === task.id || undefined}
              data-inspected={store.inspectedId === task.id || undefined}
              data-recently-placed={store.recentlyPlacedId === task.id || undefined}
              data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
              data-task-id={task.id}
              data-unscheduled-task-id={task.id}
              draggable={!store.readOnly}
              key={task.id}
              onContextMenu={(event) => context.openMenu(task.id, event)}
              onDragEnd={() => store.setDrag(null)}
              onDragStart={(event) => {
                if (store.readOnly) return;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/task-id", task.id);
                store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline-tray", targetDate: null });
              }}
              onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
              onKeyDown={(event) => keyTask(event, task, scheduled.length + index)}
              onMouseEnter={() => store.setPreview(task.id)}
              onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
              tabIndex={0}
            >
              <TaskSelection disabled={store.readOnly} orderedIds={orderedIds} task={task} />
              <TaskCompletion task={task} />
              <PriorityMark task={task} />
              <TaskOpenButton task={task}>{task.title}</TaskOpenButton>
              <button disabled={store.readOnly} onClick={() => store.setActive(task.id)} type="button">Schedule</button>
            </article>
          ))}
          {unscheduled.length === 0 ? <span className={styles.trayEmpty}>Every visible task has an explicit date.</span> : null}
        </div>
      </section>

      {scheduled.length ? (
        <div aria-label="Schedule planning surface" className={styles.timelineScroller} ref={scrollerRef} role="region">
          <div className={styles.timelineCanvas} style={{ "--timeline-cell": `${config.cell}px`, "--timeline-width": `${gridWidth}px` } as CSSProperties}>
            <div className={styles.timelineHeaderRow}>
              <div className={styles.timelinePaneHeader}><span>Task</span><span>{scheduled.length} scheduled</span></div>
              <div className={styles.timelineDateHeader} style={{ gridTemplateColumns: `repeat(${dates.length}, ${config.cell}px)` }}>
                {dates.map((date) => (
                  <div
                    className={styles.timelineDate}
                    data-drop-target={store.drag?.kind === "schedule" && store.drag.targetDate === date || undefined}
                    data-today={date === calendar.today || undefined}
                    key={date}
                    onDragOver={(event) => {
                      if (store.readOnly || store.drag?.kind !== "schedule") return;
                      event.preventDefault();
                      if (store.drag.targetDate !== date) store.setDrag({ ...store.drag, targetDate: date });
                    }}
                    onDrop={(event) => dropAtDate(event, date)}
                    title={`Drop on ${formatDate(date, { weekday: "long", day: "numeric", month: "long" })}`}
                  >
                    <span>{formatDate(date, { weekday: "short" }).slice(0, 1)}</span><b>{formatDate(date, { day: "numeric" })}</b>
                  </div>
                ))}
              </div>
            </div>
            {scheduled.map((task, index) => (
              <div
                className={styles.timelineRow}
                data-completed={task.completed || undefined}
                data-inspected={store.inspectedId === task.id || undefined}
                data-recently-placed={store.recentlyPlacedId === task.id || undefined}
                data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
                key={task.id}
              >
                <div
                  className={styles.timelineTaskPane}
                  data-task-id={task.id}
                  onContextMenu={(event) => context.openMenu(task.id, event)}
                  onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
                  onKeyDown={(event) => keyTask(event, task, index)}
                  tabIndex={0}
                >
                  <TaskSelection disabled={store.readOnly} orderedIds={orderedIds} task={task} />
                  <TaskCompletion task={task} />
                  <PriorityMark task={task} />
                  <span className={styles.timelineTaskCopy}><TaskOpenButton task={task}>{task.title}</TaskOpenButton><ScheduleText compact task={task} /></span>
                  <AvatarStack limit={2} showUnassigned={false} task={task} />
                </div>
                <div
                  className={styles.timelineGeometry}
                  onDragOver={(event) => {
                    if (store.readOnly || store.drag?.kind !== "schedule") return;
                    event.preventDefault();
                    const targetDate = dateFromPointer(event);
                    if (store.drag.targetDate !== targetDate) store.setDrag({ ...store.drag, targetDate });
                  }}
                  onDrop={(event) => dropAtDate(event, dateFromPointer(event))}
                  style={{ width: gridWidth }}
                >
                  <div aria-hidden="true" className={styles.timelineGrid} style={{ gridTemplateColumns: `repeat(${dates.length}, ${config.cell}px)` }}>{dates.map((date) => <span data-weekend={[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) || undefined} key={date} />)}</div>
                  {todayIndex >= 0 && todayIndex < dates.length ? <span aria-hidden="true" className={styles.todayLine} style={{ left: todayIndex * config.cell + config.cell / 2 }} /> : null}
                  {renderShape(task, index)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : <SurfaceEmpty body="Scheduled tasks will appear here as distinct ranges, due markers, and milestones." title="No scheduled work" />}

      <div className={styles.desktopDateCommand}>
        <DateCommand label="Schedule dates" task={activeTask} />
      </div>
      <TaskContextMenu menu={context.menu} onClose={context.closeMenu} />
    </div>
  );
}
