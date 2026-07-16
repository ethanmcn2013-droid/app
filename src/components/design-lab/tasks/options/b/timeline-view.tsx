"use client";

import { useMemo, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import {
  addDays,
  compareDates,
  differenceInDays,
  eachDate,
  formatDate,
  formatDateLong,
  LAB_TODAY,
  scheduleEnd,
  scheduleStart,
} from "../../dates";
import { useLabStore } from "../../store";
import type { CalendarDate, LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { AvatarStack, ScheduleText, TaskOpenButton, TaskSelection } from "../../shared/task-ui";
import { UnscheduledTray } from "./schedule-tray";
import styles from "./option-b.module.css";

const INITIAL_START = "2026-06-29" as CalendarDate;
const INITIAL_DAYS = 49;

type TimelineShapeProps = {
  task: LabTask;
  windowStart: CalendarDate;
  windowEnd: CalendarDate;
  cellWidth: number;
  onOpenMenu: ReturnType<typeof useTaskContextMenu>["openMenuAt"];
};

function TimelineShape({ task, windowStart, windowEnd, cellWidth, onOpenMenu }: TimelineShapeProps) {
  const store = useLabStore();
  const start = scheduleStart(task.schedule);
  const end = scheduleEnd(task.schedule);
  if (!start || !end || compareDates(end, windowStart) < 0 || compareDates(start, windowEnd) > 0) return null;
  const clippedStart = compareDates(start, windowStart) < 0 ? windowStart : start;
  const clippedEnd = compareDates(end, windowEnd) > 0 ? windowEnd : end;
  const left = differenceInDays(windowStart, clippedStart) * cellWidth;
  const selected = store.selectedIds.includes(task.id);

  const beginDrag = (event: DragEvent<HTMLElement>, operation: "move" | "resize") => {
    if (store.readOnly) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/x-signal-task", task.id);
    event.dataTransfer.setData("application/x-signal-schedule-operation", operation);
    store.setDrag({ kind: "schedule", taskId: task.id, source: "timeline", targetDate: null });
  };

  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      onOpenMenu(task.id, event.currentTarget);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      store.openTask(task.id);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      store.toggleSelected(task.id);
      return;
    }
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      if (store.readOnly) return;
      const amount = event.key === "ArrowLeft" ? -1 : 1;
      if (event.shiftKey && task.schedule.kind === "range") store.resizeScheduleByDays(task.id, amount);
      else store.moveScheduleByDays(task.id, amount);
    }
  };

  const common = {
    "data-active": store.activeId === task.id || undefined,
    "data-scheduled-task-id": task.id,
    "data-selected": selected || undefined,
    "data-task-id": task.id,
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => { event.preventDefault(); onOpenMenu(task.id, event.currentTarget); },
    onDragEnd: () => store.setDrag(null),
    onFocus: () => store.setActive(task.id),
    onKeyDown: keyboard,
  };

  if (task.schedule.kind === "range") {
    const width = Math.max(cellWidth - 6, (differenceInDays(clippedStart, clippedEnd) + 1) * cellWidth - 6);
    return (
      <div
        {...common}
        aria-label={`${task.title}. Date range ${formatDate(task.schedule.startOn)} to ${formatDate(task.schedule.dueOn)}. Drag to move.`}
        className={styles.timelineRange}
        data-clipped-end={compareDates(end, windowEnd) > 0 || undefined}
        data-clipped-start={compareDates(start, windowStart) < 0 || undefined}
        draggable={!store.readOnly}
        onDragStart={(event) => beginDrag(event, "move")}
        style={{ left, width }}
        tabIndex={0}
      >
        <button aria-label={`Open ${task.title}`} onClick={() => store.openTask(task.id)} type="button"><span>{task.title}</span></button>
        <button
          aria-label={`Resize end date for ${task.title}. Current end ${formatDateLong(task.schedule.dueOn)}`}
          className={styles.timelineResizeHandle}
          disabled={store.readOnly}
          draggable={!store.readOnly}
          onDragStart={(event) => { event.stopPropagation(); beginDrag(event, "resize"); }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            store.resizeScheduleByDays(task.id, event.key === "ArrowLeft" ? -1 : 1);
          }}
          title="Drag, or use Left and Right arrows, to change the range end"
          type="button"
        />
      </div>
    );
  }

  if (task.schedule.kind === "milestone") {
    return (
      <button
        {...common}
        aria-label={`${task.title}. Milestone on ${formatDateLong(task.schedule.on)}. Drag to move.`}
        className={styles.timelineMilestone}
        draggable={!store.readOnly}
        onClick={() => store.openTask(task.id)}
        onDragStart={(event) => beginDrag(event, "move")}
        style={{ left: left + Math.max(2, cellWidth / 2 - 11) }}
        title={`${task.title} - ${formatDateLong(task.schedule.on)}`}
        type="button"
      ><Icon name="milestone" size={17} /><span>{task.title}</span></button>
    );
  }

  if (task.schedule.kind !== "due") return null;

  return (
    <button
      {...common}
      aria-label={`${task.title}. Due ${formatDateLong(task.schedule.dueOn)}. Drag to move.`}
      className={styles.timelineDue}
      draggable={!store.readOnly}
      onClick={() => store.openTask(task.id)}
      onDragStart={(event) => beginDrag(event, "move")}
      style={{ left: left + Math.max(2, cellWidth / 2 - 8) }}
      title={`${task.title} - Due ${formatDateLong(task.schedule.dueOn)}`}
      type="button"
    ><span className={styles.timelineDuePin} /><span>{task.title}</span></button>
  );
}

export function TimelineView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const contextMenu = useTaskContextMenu();
  const [windowStart, setWindowStart] = useState<CalendarDate>(INITIAL_START);
  const [dayCount, setDayCount] = useState(INITIAL_DAYS);
  const [cellWidth, setCellWidth] = useState(36);
  const windowEnd = addDays(windowStart, dayCount - 1);
  const dates = useMemo(() => eachDate(windowStart, windowEnd), [windowEnd, windowStart]);
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled");
  const scheduled = [...tasks].filter((task) => task.schedule.kind !== "unscheduled").sort((a, b) => (scheduleStart(a.schedule) ?? windowEnd).localeCompare(scheduleStart(b.schedule) ?? windowEnd));
  const visibleIds = tasks.map((task) => task.id);
  const milestones = scheduled.filter((task) => task.schedule.kind === "milestone").slice(0, 3);
  const gridStyle = { "--timeline-cell": `${cellWidth}px`, "--timeline-days": dayCount, "--timeline-width": `${dayCount * cellWidth}px` } as CSSProperties;

  const fit = () => {
    const starts = scheduled.map((task) => scheduleStart(task.schedule)).filter((date): date is CalendarDate => Boolean(date));
    const ends = scheduled.map((task) => scheduleEnd(task.schedule)).filter((date): date is CalendarDate => Boolean(date));
    if (starts.length === 0 || ends.length === 0) {
      setWindowStart(addDays(LAB_TODAY, -7));
      setDayCount(28);
      return;
    }
    const first = starts.sort()[0];
    const last = ends.sort().at(-1) ?? first;
    setWindowStart(addDays(first, -2));
    setDayCount(Math.min(70, Math.max(21, differenceInDays(first, last) + 5)));
    setCellWidth(30);
  };

  const dropOnDate = (event: DragEvent<HTMLElement>, date: CalendarDate) => {
    event.preventDefault();
    if (store.readOnly) return;
    const taskId = event.dataTransfer.getData("text/x-signal-task") || (store.drag?.kind === "schedule" ? store.drag.taskId : "");
    const operation = event.dataTransfer.getData("application/x-signal-schedule-operation") || "move";
    const task = store.taskById(taskId);
    if (!task) return;
    if (task.schedule.kind === "unscheduled" || operation === "schedule") {
      store.scheduleOn(task.id, date);
    } else if (operation === "resize" && task.schedule.kind === "range") {
      store.resizeScheduleByDays(task.id, differenceInDays(task.schedule.dueOn, date));
    } else {
      const currentStart = scheduleStart(task.schedule);
      if (currentStart) store.moveScheduleByDays(task.id, differenceInDays(currentStart, date));
    }
    store.setDrag(null);
  };

  const dateFromPointer = (event: DragEvent<HTMLElement>): CalendarDate => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.max(0, Math.min(dayCount - 1, Math.floor((event.clientX - rect.left) / cellWidth)));
    return dates[index] ?? windowStart;
  };

  const dragTargetIndex = store.drag?.kind === "schedule" && store.drag.targetDate
    ? differenceInDays(windowStart, store.drag.targetDate)
    : -1;

  return (
    <section aria-label="Workspace Timeline" className={styles.timelineView}>
      <header className={styles.timelineStory}>
        <div>
          <span>Planning story</span>
          <strong>Readiness first, public launch next, customer handoff after.</strong>
          <p>Ranges show sustained work. Due markers show a single commitment. Diamonds are milestones.</p>
        </div>
        <ol aria-label="Visible milestones">
          {milestones.map((task) => <li data-task-id={task.id} key={task.id}><span>{task.schedule.kind === "milestone" ? formatDate(task.schedule.on) : ""}</span><TaskOpenButton task={task} /></li>)}
          {milestones.length === 0 ? <li><span>No date</span><strong>No milestone in this filtered view</strong></li> : null}
        </ol>
      </header>

      <UnscheduledTray source="timeline-tray" tasks={unscheduled} />

      <div className={styles.timelineToolbar} role="toolbar" aria-label="Timeline navigation and scale">
        <div className={styles.timelineNavigation}>
          <button aria-label="Previous timeline range" onClick={() => setWindowStart(addDays(windowStart, -14))} type="button"><Icon name="arrow-left" size={14} />Previous</button>
          <button aria-label="Next timeline range" onClick={() => setWindowStart(addDays(windowStart, 14))} type="button">Next<Icon name="arrow-right" size={14} /></button>
          <button onClick={() => { setWindowStart(addDays(LAB_TODAY, -7)); setDayCount(35); }} type="button">Today</button>
          <button onClick={fit} type="button">Fit</button>
        </div>
        <strong>{formatDate(windowStart, { day: "numeric", month: "short", year: "numeric" })} to {formatDate(windowEnd, { day: "numeric", month: "short", year: "numeric" })}</strong>
        <label>Zoom
          <select aria-label="Timeline zoom" onChange={(event) => setCellWidth(Number(event.target.value))} value={cellWidth}>
            <option value="30">Overview</option>
            <option value="36">Balanced</option>
            <option value="54">Detailed</option>
          </select>
        </label>
      </div>

      <div aria-label="Dated task planning grid" className={styles.timelineScroller} role="region" style={gridStyle}>
        <div className={styles.timelineGrid}>
          <div className={styles.timelineCorner}><span>Work and purpose</span><small>{scheduled.length} scheduled</small></div>
          <div className={styles.timelineDateHeader}>
            {dates.map((date) => (
              <div className={styles.timelineDateHeading} data-today={date === LAB_TODAY || undefined} key={date}>
                <span>{formatDate(date, { weekday: "short" })}</span><strong>{formatDate(date, { day: "numeric" })}</strong>
              </div>
            ))}
          </div>
          <div aria-hidden="true" className={styles.timelineSharedCells}>
            {dates.map((date) => <span data-today={date === LAB_TODAY || undefined} key={date} />)}
            {dragTargetIndex >= 0 && dragTargetIndex < dayCount ? <i className={styles.timelineDropColumn} style={{ left: dragTargetIndex * cellWidth, width: cellWidth }} /> : null}
          </div>
          {scheduled.length === 0 ? (
            <div className={styles.timelineEmpty}><Icon name="timeline" size={20} /><strong>No scheduled work in this view</strong><span>Use the tray above to choose an explicit date.</span></div>
          ) : scheduled.map((task) => (
            <div className={styles.timelineRowContents} key={task.id}>
              <div className={styles.timelineTaskPane} data-task-id={task.id}>
                <TaskSelection disabled={store.readOnly} orderedIds={visibleIds} task={task} />
                <div><TaskOpenButton className={styles.timelineTaskTitle} task={task} /><ScheduleText compact task={task} /></div>
                <AvatarStack limit={2} task={task} />
              </div>
              <div
                className={styles.timelineTrack}
                onDragEnter={(event) => {
                  if (store.drag?.kind !== "schedule") return;
                  const date = dateFromPointer(event);
                  if (store.drag.targetDate !== date) store.setDrag({ ...store.drag, targetDate: date });
                }}
                onDragOver={(event) => {
                  if (store.readOnly) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (store.drag?.kind === "schedule") {
                    const date = dateFromPointer(event);
                    if (store.drag.targetDate !== date) store.setDrag({ ...store.drag, targetDate: date });
                  }
                }}
                onDrop={(event) => dropOnDate(event, dateFromPointer(event))}
              >
                <TimelineShape cellWidth={cellWidth} onOpenMenu={contextMenu.openMenuAt} task={task} windowEnd={windowEnd} windowStart={windowStart} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className={styles.timelineKeyboardNote}>Keyboard: Alt + Left/Right moves one day. Add Shift to change a range end. Date fields in the tray and inspector provide the same outcome.</p>
      <TaskContextMenu menu={contextMenu.menu} onClose={contextMenu.closeMenu} />
    </section>
  );
}
