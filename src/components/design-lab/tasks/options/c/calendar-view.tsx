"use client";

import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import {
  addDays,
  asCalendarDate,
  compareDates,
  differenceInDays,
  eachDate,
  formatDate,
  formatDateLong,
  formatSchedule,
  LAB_TODAY,
  monthTitle,
  scheduleIncludes,
  scheduleStart,
  startOfMonthGrid,
  startOfWeek,
} from "../../dates";
import { scheduleFromDrop, useLabStore } from "../../store";
import type { CalendarDate, LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { AvatarStack, ScheduleText, TaskOpenButton, TaskSignals } from "../../shared/task-ui";
import type { CalendarDisplay, ScheduleDragMode } from "./spatial-types";
import styles from "./option-c.module.css";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function shiftMonth(value: CalendarDate, amount: number): CalendarDate {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, Math.min(day, 28), 12));
  return asCalendarDate(shifted.toISOString().slice(0, 10));
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export function CalendarView({
  tasks,
  selectedDate,
  onSelectedDate,
}: {
  tasks: LabTask[];
  selectedDate: CalendarDate;
  onSelectedDate: (date: CalendarDate) => void;
}) {
  const store = useLabStore();
  const { setPreview } = store;
  const menu = useTaskContextMenu();
  const [display, setDisplay] = useState<CalendarDisplay>("month");
  const [anchor, setAnchor] = useState<CalendarDate>(LAB_TODAY);
  const [overflowDate, setOverflowDate] = useState<CalendarDate | null>(null);
  const [dropDate, setDropDate] = useState<CalendarDate | null>(null);
  const [dragMode, setDragMode] = useState<ScheduleDragMode>("move");
  const [dragAnchor, setDragAnchor] = useState<CalendarDate | null>(null);
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const monthDates = useMemo(() => {
    const start = startOfMonthGrid(anchor);
    return eachDate(start, addDays(start, 41));
  }, [anchor]);
  const weekDates = useMemo(() => {
    const start = startOfWeek(anchor);
    return eachDate(start, addDays(start, 6));
  }, [anchor]);
  const agendaDates = useMemo(() => eachDate(anchor, addDays(anchor, 13)), [anchor]);
  const visibleDates = display === "month" ? monthDates : display === "week" ? weekDates : agendaDates;
  const visibleEnd = visibleDates[visibleDates.length - 1];

  const tasksOn = (date: CalendarDate) => tasks.filter((task) => task.schedule.kind !== "unscheduled" && scheduleIncludes(task.schedule, date));

  const finishDrag = () => {
    setDropDate(null);
    setDragAnchor(null);
    setDragMode("move");
    store.setDrag(null);
  };

  useEffect(() => {
    return () => setPreview(null);
  }, [setPreview]);

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

  const beginDrag = (event: DragEvent<HTMLElement>, task: LabTask, mode: ScheduleDragMode, date: CalendarDate) => {
    if (store.readOnly) { event.preventDefault(); return; }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    setDragMode(mode);
    setDragAnchor(date);
    store.setDrag({ kind: "schedule", taskId: task.id, source: "calendar", targetDate: null });
  };

  const onDateDragOver = (event: DragEvent<HTMLElement>, date: CalendarDate) => {
    if (store.readOnly || store.drag?.kind !== "schedule") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropDate(date);
    if (store.drag.targetDate !== date) store.setDrag({ ...store.drag, targetDate: date });
  };

  const dropOnDate = (event: DragEvent<HTMLElement>, date: CalendarDate) => {
    event.preventDefault();
    event.stopPropagation();
    const operation = store.drag;
    if (store.readOnly || operation?.kind !== "schedule") { finishDrag(); return; }
    const task = store.taskById(operation.taskId);
    if (!task) { finishDrag(); return; }
    if (task.schedule.kind === "unscheduled") {
      store.scheduleTask(task.id, scheduleFromDrop(date));
    } else if (task.schedule.kind === "range" && dragMode === "resize-start") {
      store.scheduleTask(task.id, { ...task.schedule, startOn: compareDates(date, task.schedule.dueOn) > 0 ? task.schedule.dueOn : date });
    } else if (task.schedule.kind === "range" && dragMode === "resize-end") {
      store.scheduleTask(task.id, { ...task.schedule, dueOn: compareDates(date, task.schedule.startOn) < 0 ? task.schedule.startOn : date });
    } else {
      const from = dragAnchor ?? scheduleStart(task.schedule);
      if (from) store.moveScheduleByDays(task.id, differenceInDays(from, date));
    }
    onSelectedDate(date);
    finishDrag();
  };

  const taskKeyDown = (event: KeyboardEvent<HTMLElement>, task: LabTask) => {
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

  const calendarTask = (task: LabTask, date: CalendarDate, expanded = false) => {
    const rangeSchedule = task.schedule.kind === "range" ? task.schedule : null;
    const rangePosition = rangeSchedule
      ? rangeSchedule.startOn === rangeSchedule.dueOn ? "only"
        : date === rangeSchedule.startOn ? "start"
          : date === rangeSchedule.dueOn ? "end" : "middle"
      : undefined;
    return (
      <div
        className={styles.calendarTask}
        data-kind={task.schedule.kind}
        data-range-position={rangePosition}
        data-scheduled-task-id={task.id}
        data-selected={store.selectedIds.includes(task.id) || undefined}
        data-task-id={task.id}
        key={`${task.id}:${date}`}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) store.setPreview(null); }}
        onMouseEnter={() => store.setPreview(task.id)}
        onMouseLeave={() => store.setPreview(null)}
      >
        <TaskOpenButton
          aria-label={`${task.title}, ${formatSchedule(task.schedule)}`}
          className={expanded ? styles.calendarTaskExpanded : styles.calendarTaskButton}
          data-scheduled-task-id={task.id}
          draggable={!store.readOnly}
          onContextMenu={(event: MouseEvent<HTMLButtonElement>) => menu.openMenu(task.id, event)}
          onDragEnd={finishDrag}
          onDragStart={(event) => beginDrag(event, task, "move", date)}
          onFocus={() => store.setPreview(task.id)}
          onKeyDown={(event) => taskKeyDown(event, task)}
          task={task}
        >
          {task.schedule.kind === "milestone" ? <Icon name="milestone" size={10} /> : null}
          <span>{task.title}</span>
          {expanded ? <ScheduleText compact task={task} /> : null}
        </TaskOpenButton>
        {rangeSchedule && date === rangeSchedule.dueOn ? (
          <button
            aria-label={`Extend range for ${task.title}`}
            className={styles.calendarRangeHandle}
            disabled={store.readOnly}
            draggable={!store.readOnly}
            onDragEnd={finishDrag}
            onDragStart={(event) => beginDrag(event, task, "resize-end", date)}
            onKeyDown={(event) => {
              if (!event.altKey || store.readOnly || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
              event.preventDefault();
              store.resizeScheduleByDays(task.id, event.key === "ArrowLeft" ? -1 : 1);
            }}
            type="button"
          />
        ) : null}
      </div>
    );
  };

  const createOn = (date: CalendarDate) => {
    if (store.readOnly) return;
    store.addTask("queued", { kind: "due", dueOn: date });
    onSelectedDate(date);
  };

  const renderCell = (date: CalendarDate, maxItems: number) => {
    const dateTasks = tasksOn(date);
    const visible = dateTasks.slice(0, maxItems);
    const hidden = dateTasks.slice(maxItems);
    const selected = selectedDate === date;
    return (
      <td
        aria-label={formatDateLong(date)}
        data-date={date}
        data-drop-target={dropDate === date || undefined}
        data-outside={display === "month" && date.slice(0, 7) !== anchor.slice(0, 7) || undefined}
        data-selected-day={selected || undefined}
        data-today={date === LAB_TODAY || undefined}
        key={date}
        onClick={(event) => { if (event.target === event.currentTarget) onSelectedDate(date); }}
        onDragOver={(event) => onDateDragOver(event, date)}
        onDrop={(event) => dropOnDate(event, date)}
      >
        <button aria-label={`Select ${formatDateLong(date)}`} className={styles.calendarDateButton} onClick={() => onSelectedDate(date)} type="button"><span>{formatDate(date, { day: "numeric" })}</span>{date === LAB_TODAY ? <small>Today</small> : null}</button>
        <div className={styles.calendarCellTasks}>{visible.map((task) => calendarTask(task, date))}</div>
        {hidden.length > 0 ? <button aria-expanded={overflowDate === date} className={styles.calendarOverflowButton} onClick={() => setOverflowDate((current) => current === date ? null : date)} type="button">+{hidden.length} more</button> : null}
        <button aria-label={`Add task on ${formatDateLong(date)}`} className={styles.calendarCellAdd} disabled={store.readOnly} onClick={() => createOn(date)} type="button"><Icon name="add" size={12} />Add</button>
        {overflowDate === date ? (
          <div aria-label={`All tasks on ${formatDateLong(date)}`} className={styles.calendarOverflow} role="dialog">
            <header><strong>{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</strong><button aria-label="Close day overflow" onClick={() => setOverflowDate(null)} type="button"><Icon name="close" size={14} /></button></header>
            <div>{dateTasks.map((task) => calendarTask(task, date, true))}</div>
            <button disabled={store.readOnly} onClick={() => createOn(date)} type="button"><Icon name="add" size={13} />Add task</button>
          </div>
        ) : null}
      </td>
    );
  };

  const moveRange = (direction: -1 | 1) => {
    if (display === "month") setAnchor((value) => shiftMonth(value, direction));
    else setAnchor((value) => addDays(value, direction * (display === "week" ? 7 : 14)));
    setOverflowDate(null);
  };
  const goToday = () => {
    setAnchor(LAB_TODAY);
    onSelectedDate(LAB_TODAY);
    setOverflowDate(null);
  };
  const title = display === "month" ? monthTitle(anchor)
    : `${formatDate(visibleDates[0], { day: "numeric", month: "short" })} to ${formatDate(visibleEnd, { day: "numeric", month: "short", year: "numeric" })}`;
  const previewTask = store.previewId ? store.taskById(store.previewId) : undefined;

  return (
    <section aria-label="Calendar planning surface" className={styles.calendarSurface}>
      <header className={styles.calendarToolbar}>
        <div>
          <button aria-label="Previous calendar range" onClick={() => moveRange(-1)} type="button"><Icon name="arrow-left" size={15} /></button>
          <button onClick={goToday} type="button">Today</button>
          <button aria-label="Next calendar range" onClick={() => moveRange(1)} type="button"><Icon name="arrow-right" size={15} /></button>
        </div>
        <strong>{title}</strong>
        <div aria-label="Calendar display" role="group">
          {(["month", "week", "agenda"] as const).map((value) => <button aria-pressed={display === value} key={value} onClick={() => { setDisplay(value); setOverflowDate(null); }} type="button">{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
      </header>

      {display === "agenda" ? (
        <ol className={styles.calendarAgenda}>
          {agendaDates.map((date) => {
            const dateTasks = tasksOn(date);
            return (
              <li
                data-date={date}
                data-drop-target={dropDate === date || undefined}
                data-selected-day={selectedDate === date || undefined}
                data-today={date === LAB_TODAY || undefined}
                key={date}
                onDragOver={(event) => onDateDragOver(event, date)}
                onDrop={(event) => dropOnDate(event, date)}
              >
                <button className={styles.agendaDate} onClick={() => onSelectedDate(date)} type="button"><span>{formatDate(date, { weekday: "short" })}</span><strong>{formatDate(date, { day: "numeric" })}</strong><small>{formatDate(date, { month: "long" })}</small></button>
                <div className={styles.agendaTasks}>{dateTasks.length > 0 ? dateTasks.map((task) => calendarTask(task, date, true)) : <span>No dated work</span>}</div>
                <button aria-label={`Add task on ${formatDateLong(date)}`} className={styles.agendaAdd} disabled={store.readOnly} onClick={() => createOn(date)} type="button"><Icon name="add" size={13} />Add task</button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.calendarTableWrap}>
          <table className={styles.calendarTable} data-display={display}>
            <caption>{display === "month" ? `${monthTitle(anchor)} calendar` : `Week of ${formatDateLong(weekDates[0])}`}</caption>
            <thead><tr>{DAY_LABELS.map((day) => <th key={day} scope="col"><span>{day.slice(0, 3)}</span><b>{day}</b></th>)}</tr></thead>
            <tbody>{chunks(display === "month" ? monthDates : weekDates, 7).map((week) => <tr key={week[0]}>{week.map((date) => renderCell(date, display === "month" ? 3 : 8))}</tr>)}</tbody>
          </table>
        </div>
      )}

      {previewTask ? (
        <aside aria-label={`Preview of ${previewTask.title}`} className={styles.calendarPreview}>
          <span>Task preview</span><strong>{previewTask.title}</strong><ScheduleText task={previewTask} /><div><AvatarStack limit={4} task={previewTask} /><TaskSignals task={previewTask} /></div>
        </aside>
      ) : null}
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </section>
  );
}
