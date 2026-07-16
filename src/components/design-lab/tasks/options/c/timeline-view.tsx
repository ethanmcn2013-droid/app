"use client";

import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import {
  addDays,
  compareDates,
  differenceInDays,
  eachDate,
  formatDate,
  formatDateLong,
  formatSchedule,
  isTaskOverdue,
  LAB_TODAY,
  scheduleEnd,
  scheduleStart,
  startOfWeek,
} from "../../dates";
import { scheduleFromDrop, useLabStore } from "../../store";
import type { CalendarDate, LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { PriorityMark, ScheduleText, TaskOpenButton, TaskSelection } from "../../shared/task-ui";
import { InlineTaskTitle } from "./spatial-task";
import type { ScheduleDragMode, TimelineZoom } from "./spatial-types";
import styles from "./option-c.module.css";

const ZOOM: Record<TimelineZoom, { days: number; cell: number; label: string }> = {
  fortnight: { days: 14, cell: 58, label: "2 weeks" },
  month: { days: 28, cell: 40, label: "4 weeks" },
  "six-weeks": { days: 42, cell: 30, label: "6 weeks" },
};

function timelineStyle(left: number, width?: number): CSSProperties {
  return width === undefined ? { left } : { left, width };
}

export function TimelineView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const menu = useTaskContextMenu();
  const [zoom, setZoom] = useState<TimelineZoom>("month");
  const [rangeStart, setRangeStart] = useState<CalendarDate>(() => addDays(startOfWeek(LAB_TODAY), -7));
  const [dropDate, setDropDate] = useState<CalendarDate | null>(null);
  const [dragMode, setDragMode] = useState<ScheduleDragMode>("move");
  const scale = ZOOM[zoom];
  const rangeEnd = addDays(rangeStart, scale.days - 1);
  const dates = useMemo(() => eachDate(rangeStart, rangeEnd), [rangeEnd, rangeStart]);
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const scheduledTasks = useMemo(() => tasks.filter((task) => {
    const start = scheduleStart(task.schedule);
    const end = scheduleEnd(task.schedule);
    return start !== null && end !== null && compareDates(end, rangeStart) >= 0 && compareDates(start, rangeEnd) <= 0;
  }), [rangeEnd, rangeStart, tasks]);
  const timelineWidth = scale.days * scale.cell;
  const todayIndex = differenceInDays(rangeStart, LAB_TODAY);

  const finishDrag = () => {
    setDropDate(null);
    setDragMode("move");
    store.setDrag(null);
  };

  useEffect(() => {
    if (!store.drag) return;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishDrag();
      }
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  });

  const fit = () => {
    const starts = tasks.map((task) => scheduleStart(task.schedule)).filter((date): date is CalendarDate => date !== null).sort();
    const ends = tasks.map((task) => scheduleEnd(task.schedule)).filter((date): date is CalendarDate => date !== null).sort();
    if (starts.length === 0 || ends.length === 0) {
      setZoom("month");
      setRangeStart(addDays(startOfWeek(LAB_TODAY), -7));
      return;
    }
    const first = starts[0];
    const last = ends[ends.length - 1];
    const span = differenceInDays(first, last) + 5;
    setZoom(span <= 14 ? "fortnight" : span <= 28 ? "month" : "six-weeks");
    setRangeStart(addDays(first, -2));
  };

  const beginDrag = (event: DragEvent<HTMLElement>, task: LabTask, mode: ScheduleDragMode) => {
    if (store.readOnly) { event.preventDefault(); return; }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    setDragMode(mode);
    store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline", targetDate: null });
  };

  const dateFromPointer = (event: DragEvent<HTMLElement>): CalendarDate => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.max(0, Math.min(scale.days - 1, Math.floor((event.clientX - rect.left) / scale.cell)));
    return addDays(rangeStart, index);
  };

  const onGridDragOver = (event: DragEvent<HTMLElement>) => {
    if (store.readOnly || store.drag?.kind !== "schedule") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const date = dateFromPointer(event);
    setDropDate(date);
    if (store.drag.targetDate !== date) store.setDrag({ ...store.drag, targetDate: date });
  };

  const onGridDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const operation = store.drag;
    const target = dropDate ?? dateFromPointer(event);
    if (store.readOnly || operation?.kind !== "schedule") { finishDrag(); return; }
    const task = store.taskById(operation.taskId);
    if (!task) { finishDrag(); return; }
    if (task.schedule.kind === "unscheduled") {
      store.scheduleTask(task.id, scheduleFromDrop(target));
      finishDrag();
      return;
    }
    if (task.schedule.kind === "range" && dragMode === "resize-start") {
      store.scheduleTask(task.id, { ...task.schedule, startOn: compareDates(target, task.schedule.dueOn) > 0 ? task.schedule.dueOn : target });
    } else if (task.schedule.kind === "range" && dragMode === "resize-end") {
      store.scheduleTask(task.id, { ...task.schedule, dueOn: compareDates(target, task.schedule.startOn) < 0 ? task.schedule.startOn : target });
    } else {
      const start = scheduleStart(task.schedule);
      if (start) store.moveScheduleByDays(task.id, differenceInDays(start, target));
    }
    finishDrag();
  };

  const geometryKeyDown = (event: KeyboardEvent<HTMLElement>, task: LabTask) => {
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      menu.openMenuAt(task.id, event.currentTarget);
      return;
    }
    if (event.key === "F2" && !store.readOnly) {
      event.preventDefault();
      store.setEditing(task.id, "title");
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      store.toggleSelected(task.id, orderedIds, event.shiftKey);
      return;
    }
    if (!event.altKey || store.readOnly || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const amount = event.key === "ArrowLeft" ? -1 : 1;
    if (event.shiftKey && task.schedule.kind === "range") store.resizeScheduleByDays(task.id, amount);
    else store.moveScheduleByDays(task.id, amount);
  };

  const renderGeometry = (task: LabTask) => {
    const start = scheduleStart(task.schedule);
    const end = scheduleEnd(task.schedule);
    if (!start || !end) return null;
    const startIndex = differenceInDays(rangeStart, start);
    const endIndex = differenceInDays(rangeStart, end);
    const clippedStart = Math.max(0, startIndex);
    const clippedEnd = Math.min(scale.days - 1, endIndex);
    const overdue = isTaskOverdue(task);

    if (task.schedule.kind === "range") {
      const left = clippedStart * scale.cell + 3;
      const width = Math.max(scale.cell - 6, (clippedEnd - clippedStart + 1) * scale.cell - 6);
      return (
        <div
          className={styles.timelineRange}
          data-clipped-end={endIndex >= scale.days || undefined}
          data-clipped-start={startIndex < 0 || undefined}
          data-overdue={overdue || undefined}
          data-scheduled-task-id={task.id}
          data-task-id={task.id}
          style={timelineStyle(left, width)}
        >
          <button
            aria-label={`Resize start of ${task.title}`}
            className={styles.timelineResizeStart}
            disabled={store.readOnly}
            draggable={!store.readOnly}
            onDragEnd={finishDrag}
            onDragStart={(event) => beginDrag(event, task, "resize-start")}
            onKeyDown={(event) => {
              if (!event.altKey || store.readOnly || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
              event.preventDefault();
              const next = addDays(task.schedule.kind === "range" ? task.schedule.startOn : start, event.key === "ArrowLeft" ? -1 : 1);
              if (task.schedule.kind === "range") store.scheduleTask(task.id, { ...task.schedule, startOn: compareDates(next, task.schedule.dueOn) > 0 ? task.schedule.dueOn : next });
            }}
            type="button"
          />
          <TaskOpenButton
            aria-label={`${task.title}, ${formatSchedule(task.schedule)}`}
            className={styles.timelineRangeButton}
            data-scheduled-task-id={task.id}
            draggable={!store.readOnly}
            onContextMenu={(event: MouseEvent<HTMLButtonElement>) => menu.openMenu(task.id, event)}
            onDragEnd={finishDrag}
            onDragStart={(event) => beginDrag(event, task, "move")}
            onKeyDown={(event) => geometryKeyDown(event, task)}
            task={task}
          >{task.title}</TaskOpenButton>
          <button
            aria-label={`Resize end of ${task.title}`}
            className={styles.timelineResizeEnd}
            disabled={store.readOnly}
            draggable={!store.readOnly}
            onDragEnd={finishDrag}
            onDragStart={(event) => beginDrag(event, task, "resize-end")}
            onKeyDown={(event) => {
              if (!event.altKey || store.readOnly || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
              event.preventDefault();
              store.resizeScheduleByDays(task.id, event.key === "ArrowLeft" ? -1 : 1);
            }}
            type="button"
          />
        </div>
      );
    }

    const index = Math.max(0, Math.min(scale.days - 1, startIndex));
    const left = index * scale.cell + scale.cell / 2;
    const milestone = task.schedule.kind === "milestone";
    return (
      <TaskOpenButton
        aria-label={`${task.title}, ${formatSchedule(task.schedule)}`}
        className={milestone ? styles.timelineMilestone : styles.timelineDue}
        data-overdue={overdue || undefined}
        data-scheduled-task-id={task.id}
        draggable={!store.readOnly}
        onContextMenu={(event: MouseEvent<HTMLButtonElement>) => menu.openMenu(task.id, event)}
        onDragEnd={finishDrag}
        onDragStart={(event) => beginDrag(event, task, "move")}
        onKeyDown={(event) => geometryKeyDown(event, task)}
        style={timelineStyle(left)}
        task={task}
        title={`${task.title}: ${formatSchedule(task.schedule)}`}
      ><span aria-hidden="true" />{task.title}</TaskOpenButton>
    );
  };

  const gridStyle = { width: timelineWidth, minWidth: timelineWidth };
  const navigationStep = Math.max(7, scale.days - 7);

  return (
    <section aria-label="Timeline planning surface" className={styles.timelineSurface}>
      <header className={styles.timelineToolbar}>
        <div>
          <button aria-label="Previous timeline range" onClick={() => setRangeStart((value) => addDays(value, -navigationStep))} type="button"><Icon name="arrow-left" size={15} /></button>
          <button onClick={() => setRangeStart(addDays(startOfWeek(LAB_TODAY), -7))} type="button">Today</button>
          <button aria-label="Next timeline range" onClick={() => setRangeStart((value) => addDays(value, navigationStep))} type="button"><Icon name="arrow-right" size={15} /></button>
        </div>
        <strong>{formatDate(rangeStart, { day: "numeric", month: "short" })} to {formatDate(rangeEnd, { day: "numeric", month: "short", year: "numeric" })}</strong>
        <div>
          <button onClick={fit} type="button">Fit</button>
          <label><span>Zoom</span><select aria-label="Timeline zoom" onChange={(event) => setZoom(event.target.value as TimelineZoom)} value={zoom}>{Object.entries(ZOOM).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
        </div>
      </header>
      <div className={styles.timelineScroller} role="region" aria-label={`${scale.label} timeline from ${formatDateLong(rangeStart)}`}>
        <div className={`${styles.timelineRow} ${styles.timelineHeaderRow}`}>
          <div className={styles.timelineCorner}><span>Workspace task</span><small>{scheduledTasks.length} dated</small></div>
          <div className={styles.timelineDateHeader} style={gridStyle}>
            {dates.map((date) => <div data-today={date === LAB_TODAY || undefined} key={date}><span>{formatDate(date, { weekday: "short" })}</span><strong>{formatDate(date, { day: "numeric" })}</strong></div>)}
            {todayIndex >= 0 && todayIndex < scale.days ? <span aria-hidden="true" className={styles.timelineTodayLine} style={{ left: todayIndex * scale.cell + scale.cell / 2 }}><b>Today</b></span> : null}
          </div>
        </div>
        {scheduledTasks.length === 0 ? (
          <div className={styles.timelineEmpty}><div className={styles.timelineTaskPane}><Icon name="timeline" size={18} /><strong>No dated work in range</strong><span>Navigate, change the filter, or schedule work from the rail.</span></div><div className={styles.timelineGrid} style={gridStyle}>{dates.map((date) => <span key={date} />)}</div></div>
        ) : scheduledTasks.map((task) => (
          <div className={styles.timelineRow} data-task-id={task.id} key={task.id}>
            <div className={styles.timelineTaskPane}>
              <TaskSelection orderedIds={orderedIds} task={task} />
              <div><InlineTaskTitle task={task} /><span><PriorityMark task={task} /><ScheduleText compact task={task} /></span></div>
            </div>
            <div
              className={styles.timelineGrid}
              onDragOver={onGridDragOver}
              onDrop={onGridDrop}
              style={gridStyle}
            >
              {dates.map((date) => <span data-weekend={["Sat", "Sun"].includes(formatDate(date, { weekday: "short" })) || undefined} key={date} />)}
              {todayIndex >= 0 && todayIndex < scale.days ? <span aria-hidden="true" className={styles.timelineTodayLine} style={{ left: todayIndex * scale.cell + scale.cell / 2 }} /> : null}
              {dropDate ? <span className={styles.timelineDropGuide} style={{ left: differenceInDays(rangeStart, dropDate) * scale.cell, width: scale.cell }}><b>{formatDate(dropDate, { weekday: "short", day: "numeric", month: "short" })}</b></span> : null}
              {renderGeometry(task)}
            </div>
          </div>
        ))}
      </div>
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </section>
  );
}
