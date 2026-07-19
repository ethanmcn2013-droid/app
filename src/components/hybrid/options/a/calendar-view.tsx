"use client";

import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import {
  LAB_TODAY,
  addDays,
  differenceInDays,
  eachDate,
  formatDate,
  formatDateLong,
  formatSchedule,
  monthTitle,
  scheduleIncludes,
  scheduleStart,
  startOfWeek,
} from "../../dates";
import { scheduleFromDrop, useLabStore } from "../../store";
import type { CalendarDate, LabTask } from "../../types";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { Icon } from "../../shared/icons";
import {
  PriorityMark,
  ScheduleText,
  TaskOpenButton,
  TaskSelection,
} from "../../shared/task-ui";
import { DateCommand, KeyboardLegend, SurfaceEmpty } from "./quiet-command-components";
import {
  focusCalendarDate,
  monthGrid,
  rangeSegment,
  shiftMonth,
} from "./quiet-command-model";
import styles from "./option-a.module.css";

type CalendarMode = "month" | "week" | "agenda";
type TaskMenu = ReturnType<typeof useTaskContextMenu>;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function chunks<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function CalendarTask({
  task,
  date,
  orderedIds,
  context,
  onDragStart,
  compact = false,
}: {
  task: LabTask;
  date: CalendarDate;
  orderedIds: string[];
  context: TaskMenu;
  onDragStart: (event: DragEvent, task: LabTask) => void;
  compact?: boolean;
}) {
  const store = useLabStore();
  const segment = rangeSegment(task, date);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
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
    if (event.key === " ") {
      event.preventDefault();
      store.toggleSelected(task.id, orderedIds, event.shiftKey);
      return;
    }
    if (event.altKey && !store.readOnly && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const amount = event.key === "ArrowLeft" ? -1 : 1;
      if (event.shiftKey && task.schedule.kind === "range") store.resizeScheduleByDays(task.id, amount);
      else store.moveScheduleByDays(task.id, amount);
    }
  };

  return (
    <TaskOpenButton
      aria-label={`${task.title}, ${formatSchedule(task.schedule)}. Alt plus arrows moves one day. Add Shift to change a range end.`}
      className={`${styles.calendarTask} ${compact ? styles.calendarTaskCompact : ""}`}
      data-calendar-task="true"
      data-completed={task.completed || undefined}
      data-scheduled-task-id={task.id}
      data-segment={segment}
      draggable={!store.readOnly}
      onContextMenu={(event) => context.openMenu(task.id, event)}
      onDragEnd={() => store.setDrag(null)}
      onDragStart={(event) => onDragStart(event, task)}
      onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
      onKeyDown={onKeyDown}
      onMouseEnter={() => store.setPreview(task.id)}
      onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
      task={task}
      title={`${task.title}\n${formatSchedule(task.schedule)}`}
    >
      {task.schedule.kind === "milestone" ? <span aria-hidden="true" className={styles.calendarDiamond} /> : <span aria-hidden="true" className={styles.calendarStatus} data-status={task.status} />}
      <span>{task.title}</span>
    </TaskOpenButton>
  );
}

export function CalendarView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const context = useTaskContextMenu();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState<CalendarDate>(LAB_TODAY);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(LAB_TODAY);
  const [overflowDate, setOverflowDate] = useState<CalendarDate | null>(null);
  const monthDates = useMemo(() => monthGrid(cursor), [cursor]);
  const weekDates = useMemo(() => eachDate(startOfWeek(selectedDate), addDays(startOfWeek(selectedDate), 6)), [selectedDate]);
  const agendaDates = useMemo(() => eachDate(selectedDate, addDays(selectedDate, 20)), [selectedDate]);
  const scheduled = tasks.filter((task) => task.schedule.kind !== "unscheduled");
  const unscheduled = tasks.filter((task) => task.schedule.kind === "unscheduled");
  const orderedIds = tasks.map((task) => task.id);
  const activeTask = store.activeId ? store.taskById(store.activeId) : undefined;

  const tasksOn = (date: CalendarDate) => scheduled
    .filter((task) => scheduleIncludes(task.schedule, date))
    .sort((a, b) => a.order - b.order);

  const beginDrag = (event: DragEvent, task: LabTask) => {
    if (store.readOnly) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    store.setDrag({ kind: "schedule", taskId: task.id, source: "calendar", targetDate: null });
  };

  const dropOn = (event: DragEvent, date: CalendarDate) => {
    event.preventDefault();
    event.stopPropagation();
    if (store.readOnly) return;
    const taskId = event.dataTransfer.getData("text/task-id") || store.drag?.taskId;
    const task = taskId ? store.taskById(taskId) : undefined;
    if (!task) return;
    if (task.schedule.kind === "unscheduled") store.scheduleTask(task.id, scheduleFromDrop(date));
    else {
      const currentStart = scheduleStart(task.schedule);
      if (currentStart) store.moveScheduleByDays(task.id, differenceInDays(currentStart, date));
    }
    store.setDrag(null);
    store.setActive(task.id);
    setSelectedDate(date);
  };

  const createOn = (date: CalendarDate) => {
    if (store.readOnly) return;
    setSelectedDate(date);
    store.addTask("queued", { kind: "due", dueOn: date });
  };

  const navigate = (direction: -1 | 1) => {
    if (mode === "month") {
      const next = shiftMonth(cursor, direction);
      setCursor(next);
      setSelectedDate(next);
    } else {
      const amount = mode === "week" ? 7 : 21;
      const next = addDays(selectedDate, amount * direction);
      setSelectedDate(next);
      setCursor(next);
    }
    setOverflowDate(null);
  };

  const selectWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, date: CalendarDate) => {
    const offsets: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = addDays(date, offset);
    setSelectedDate(next);
    if (next.slice(0, 7) !== cursor.slice(0, 7)) setCursor(next);
    focusCalendarDate(next);
  };

  const currentTitle = mode === "month"
    ? monthTitle(cursor)
    : mode === "week"
      ? `${formatDate(weekDates[0], { day: "numeric", month: "short" })} - ${formatDate(weekDates[6], { day: "numeric", month: "short", year: "numeric" })}`
      : `Agenda from ${formatDate(selectedDate, { day: "numeric", month: "long", year: "numeric" })}`;

  const renderDateCell = (date: CalendarDate, maxItems: number, week = false) => {
    const dayTasks = tasksOn(date);
    const shown = dayTasks.slice(0, maxItems);
    const hidden = dayTasks.slice(maxItems);
    const empty = dayTasks.length === 0;
    return (
      <td
        aria-label={formatDateLong(date)}
        className={styles.calendarCell}
        data-date={date}
        data-outside={mode === "month" && date.slice(0, 7) !== cursor.slice(0, 7) || undefined}
        data-selected={date === selectedDate || undefined}
        data-today={date === LAB_TODAY || undefined}
        key={date}
        onDragOver={(event) => { if (!store.readOnly) event.preventDefault(); }}
        onDrop={(event) => dropOn(event, date)}
      >
        <header>
          <button
            aria-label={empty && !store.readOnly ? `Create task on ${formatDateLong(date)}` : `Select ${formatDateLong(date)}`}
            className={styles.dateButton}
            data-date-button={date}
            onClick={() => { setSelectedDate(date); if (empty && !store.readOnly) createOn(date); }}
            onKeyDown={(event) => selectWithKeyboard(event, date)}
            type="button"
          >
            {week ? <span>{formatDate(date, { weekday: "short" })}</span> : null}<b>{formatDate(date, { day: "numeric" })}</b>
          </button>
          <button aria-label={`Add task on ${formatDateLong(date)}`} className={styles.cellAdd} disabled={store.readOnly} onClick={() => createOn(date)} type="button"><Icon name="add" size={12} /></button>
        </header>
        <div className={styles.calendarItems}>
          {shown.map((task) => <CalendarTask context={context} date={date} key={task.id} onDragStart={beginDrag} orderedIds={orderedIds} task={task} />)}
        </div>
        {hidden.length ? (
          <button aria-expanded={overflowDate === date} className={styles.moreTasks} onClick={() => setOverflowDate((current) => current === date ? null : date)} type="button">+{hidden.length} more</button>
        ) : null}
        {overflowDate === date ? (
          <section aria-label={`More tasks on ${formatDateLong(date)}`} className={styles.calendarOverflow} role="dialog">
            <header><strong>{formatDate(date, { weekday: "short", day: "numeric", month: "short" })}</strong><button aria-label="Close more tasks" onClick={() => setOverflowDate(null)} type="button"><Icon name="close" size={13} /></button></header>
            {hidden.map((task) => <CalendarTask compact context={context} date={date} key={task.id} onDragStart={beginDrag} orderedIds={orderedIds} task={task} />)}
          </section>
        ) : null}
      </td>
    );
  };

  const selectedTasks = tasksOn(selectedDate);

  return (
    <div className={styles.calendarSurface}>
      <header className={styles.calendarToolbar}>
        <div className={styles.calendarNavigation}>
          <button aria-label="Previous calendar range" onClick={() => navigate(-1)} type="button"><Icon name="arrow-left" size={14} /></button>
          <button onClick={() => { setCursor(LAB_TODAY); setSelectedDate(LAB_TODAY); setOverflowDate(null); }} type="button">Today</button>
          <button aria-label="Next calendar range" onClick={() => navigate(1)} type="button"><Icon name="arrow-right" size={14} /></button>
        </div>
        <h2>{currentTitle}</h2>
        <div aria-label="Calendar mode" className={styles.calendarModes} role="group">
          {(["month", "week", "agenda"] as CalendarMode[]).map((item) => <button aria-pressed={mode === item} key={item} onClick={() => { setMode(item); setOverflowDate(null); }} type="button">{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </header>

      <div className={styles.calendarWorkspace}>
        <div className={styles.calendarMain}>
          {mode === "month" ? (
            <div className={styles.calendarTableScroll}>
              <table className={styles.calendarTable}>
                <caption>{monthTitle(cursor)} month calendar</caption>
                <thead><tr>{WEEKDAYS.map((day) => <th abbr={day} key={day} scope="col">{day}</th>)}</tr></thead>
                <tbody>{chunks(monthDates, 7).map((week) => <tr key={week[0]}>{week.map((date) => renderDateCell(date, 3))}</tr>)}</tbody>
              </table>
            </div>
          ) : null}
          {mode === "week" ? (
            <div className={styles.calendarTableScroll}>
              <table className={`${styles.calendarTable} ${styles.weekTable}`}>
                <caption>Week of {formatDateLong(weekDates[0])}</caption>
                <thead><tr>{WEEKDAYS.map((day) => <th abbr={day} key={day} scope="col">{day}</th>)}</tr></thead>
                <tbody><tr>{weekDates.map((date) => renderDateCell(date, 7, true))}</tr></tbody>
              </table>
            </div>
          ) : null}
          {mode === "agenda" ? (
            <div aria-label="Calendar agenda" className={styles.agendaMode}>
              {agendaDates.map((date) => {
                const dayTasks = tasksOn(date);
                if (!dayTasks.length) return null;
                return (
                  <section data-date={date} key={date}>
                    <header><time dateTime={date}>{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</time><button disabled={store.readOnly} onClick={() => createOn(date)} type="button"><Icon name="add" size={13} />Add</button></header>
                    <div>{dayTasks.map((task) => <CalendarTask compact context={context} date={date} key={task.id} onDragStart={beginDrag} orderedIds={orderedIds} task={task} />)}</div>
                  </section>
                );
              })}
              {agendaDates.every((date) => tasksOn(date).length === 0) ? <SurfaceEmpty body="Move forward or add a dated task to this planning window." onAdd={() => createOn(selectedDate)} title="No dated work in this agenda" /> : null}
            </div>
          ) : null}
        </div>

        <aside aria-label={`Agenda for ${formatDateLong(selectedDate)}`} className={styles.dayAgenda}>
          <header>
            <div><span>Selected day</span><strong>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</strong></div>
            <button aria-label={`Add task on ${formatDateLong(selectedDate)}`} disabled={store.readOnly} onClick={() => createOn(selectedDate)} type="button"><Icon name="add" size={14} /></button>
          </header>
          <div className={styles.dayAgendaList}>
            {selectedTasks.map((task) => (
              <article
                className={styles.agendaTask}
                data-scheduled-task-id={task.id}
                data-task-id={task.id}
                key={task.id}
                onContextMenu={(event) => context.openMenu(task.id, event)}
                onMouseEnter={() => store.setPreview(task.id)}
                onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
              >
                <TaskSelection disabled={store.readOnly} orderedIds={orderedIds} task={task} />
                <span className={styles.agendaTaskCopy}><TaskOpenButton onFocus={() => store.setPreview(task.id)} task={task}>{task.title}</TaskOpenButton><ScheduleText compact task={task} /></span>
                <PriorityMark task={task} />
                {task.schedule.kind === "range" ? (
                  <div aria-label={`Range controls for ${task.title}`} className={styles.agendaRangeControls} role="group">
                    <button aria-label={`Shorten ${task.title} by one day`} disabled={store.readOnly} onClick={() => store.resizeScheduleByDays(task.id, -1)} type="button"><Icon name="arrow-left" size={12} /></button>
                    <button aria-label={`Extend ${task.title} by one day`} disabled={store.readOnly} onClick={() => store.resizeScheduleByDays(task.id, 1)} type="button"><Icon name="arrow-right" size={12} /></button>
                  </div>
                ) : null}
              </article>
            ))}
            {selectedTasks.length === 0 ? <p>No dated tasks. Use Add or drop unscheduled work here.</p> : null}
          </div>
          <section aria-labelledby="a-calendar-unscheduled" className={styles.calendarUnscheduled}>
            <header><strong id="a-calendar-unscheduled">Unscheduled</strong><span>{unscheduled.length}</span></header>
            <div>
              {unscheduled.map((task) => (
                <article
                  data-task-id={task.id}
                  data-unscheduled-task-id={task.id}
                  draggable={!store.readOnly}
                  key={task.id}
                  onContextMenu={(event) => context.openMenu(task.id, event)}
                  onDragEnd={() => store.setDrag(null)}
                  onDragStart={(event) => beginDrag(event, task)}
                  onMouseEnter={() => store.setPreview(task.id)}
                  onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
                >
                  <TaskOpenButton onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }} task={task}>{task.title}</TaskOpenButton>
                  <button aria-label={`Schedule ${task.title} on ${formatDateLong(selectedDate)}`} disabled={store.readOnly} onClick={() => store.scheduleTask(task.id, scheduleFromDrop(selectedDate))} type="button"><Icon name="calendar" size={12} /></button>
                </article>
              ))}
              {unscheduled.length === 0 ? <p>No unscheduled tasks</p> : null}
            </div>
          </section>
        </aside>
      </div>

      <DateCommand label="Calendar dates" task={activeTask} />
      <KeyboardLegend>Date arrows navigate. Alt + Left or Right moves a task. Add Shift to extend or shorten a range.</KeyboardLegend>
      <TaskContextMenu menu={context.menu} onClose={context.closeMenu} />
    </div>
  );
}
