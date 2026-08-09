"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useActiveWorkspace } from "@/lib/domain-context";
import { useToast } from "@/components/primitives/toast";
import type { CalendarFrame } from "@/lib/calendar-frame";
import {
  addDays,
  asCalendarDate,
  differenceInDays,
  eachDate,
  formatDate,
  formatDateLong,
  monthTitle,
  scheduleIncludes,
  scheduleStart,
  startOfMonthGrid,
  startOfWeek,
} from "../../dates";
import { useLabStore } from "../../store";
import { activeUnscheduledTasks } from "../../planning";
import type { CalendarDate, LabTask, TaskSchedule } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { AvatarStack, ScheduleText, TaskCompletion, TaskOpenButton, TaskSelection, TaskSignals } from "../../shared/task-ui";
import { UnscheduledTray } from "./schedule-tray";
import styles from "./option-b.module.css";

type CalendarMode = "month" | "week" | "agenda";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function shiftMonth(value: CalendarDate, amount: number): CalendarDate {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10) as CalendarDate;
}

function tasksForDate(tasks: LabTask[], date: CalendarDate): LabTask[] {
  const order: Record<TaskSchedule["kind"], number> = { milestone: 0, due: 1, range: 2, unscheduled: 3 };
  return tasks
    .filter((task) => task.schedule.kind !== "unscheduled" && scheduleIncludes(task.schedule, date))
    .sort((a, b) => order[a.schedule.kind] - order[b.schedule.kind] || a.order - b.order);
}

function focusCalendarDate(date: CalendarDate) {
  window.setTimeout(() => document.querySelector<HTMLElement>(`[data-option="b"] td[data-date="${date}"] [data-date-select="true"]`)?.focus(), 0);
}

function CalendarTaskChip({
  task,
  date,
  visibleIds,
  onOpenMenu,
}: {
  task: LabTask;
  date: CalendarDate;
  visibleIds: string[];
  onOpenMenu: ReturnType<typeof useTaskContextMenu>["openMenuAt"];
}) {
  const store = useLabStore();
  if (task.schedule.kind === "unscheduled") return null;
  const rangeSchedule = task.schedule.kind === "range" ? task.schedule : null;
  const rangeStart = rangeSchedule?.startOn === date;
  const rangeEnd = rangeSchedule?.dueOn === date;
  const selected = store.selectedIds.includes(task.id);

  const moveByKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      onOpenMenu(task.id, event.currentTarget);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      store.toggleSelected(task.id, visibleIds, event.shiftKey);
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

  return (
    <div
      className={styles.calendarTaskWrap}
      data-active={store.activeId === task.id || undefined}
      data-completed={task.completed || undefined}
      data-dragging={store.drag?.kind === "schedule" && store.drag.taskId === task.id || undefined}
      data-inspected={store.inspectedId === task.id || undefined}
      data-kind={task.schedule.kind}
      data-recently-placed={store.recentlyPlacedId === task.id || undefined}
      data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
      data-range-end={rangeEnd || undefined}
      data-range-start={rangeStart || undefined}
      data-scheduled-task-id={task.id}
      data-selected={selected || undefined}
      data-task-id={task.id}
      draggable={!store.readOnly}
      onContextMenu={(event) => { event.preventDefault(); onOpenMenu(task.id, event.currentTarget); }}
      onDragEnd={() => store.setDrag(null)}
      onDragStart={(event) => {
        if (store.readOnly) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/x-signal-task", task.id);
        event.dataTransfer.setData("application/x-signal-schedule-operation", "move");
        store.setDrag({ kind: "schedule", taskId: task.id, source: "calendar", targetDate: date });
      }}
      onFocusCapture={() => { store.setActive(task.id); store.setPreview(task.id); }}
      onMouseEnter={() => store.setPreview(task.id)}
    >
      <button
        aria-label={`${task.title}. ${task.completed ? "Done. " : ""}${task.schedule.kind === "milestone" ? "Milestone" : task.schedule.kind === "due" ? "Due date" : "Date range"}. ${formatDateLong(date)}`}
        className={styles.calendarTaskChip}
        onClick={() => store.openTask(task.id)}
        onKeyDown={moveByKeyboard}
        type="button"
      >
        {task.schedule.kind === "milestone" ? <Icon name="milestone" size={11} /> : null}
        <span>{task.title}</span>
      </button>
      {rangeEnd ? (
        <button
          aria-label={`Extend ${task.title} by one day`}
          className={styles.calendarExtendButton}
          disabled={store.readOnly}
          onClick={() => store.resizeScheduleByDays(task.id, 1)}
          title="Extend range by one day"
          type="button"
        ><Icon name="arrow-right" size={11} /></button>
      ) : null}
    </div>
  );
}

function CalendarDateEditor({ task }: { task: LabTask }) {
  const store = useLabStore();
  const schedule = task.schedule;
  if (schedule.kind === "unscheduled") return null;
  if (schedule.kind === "range") return (
    <div className={styles.agendaDateEditor}>
      <label><span>Starts</span><input disabled={store.readOnly} max={schedule.dueOn} onChange={(event) => store.scheduleTask(task.id, { ...schedule, startOn: asCalendarDate(event.target.value) })} type="date" value={schedule.startOn} /></label>
      <label><span>Range end</span><input disabled={store.readOnly} min={schedule.startOn} onChange={(event) => store.scheduleTask(task.id, { ...schedule, dueOn: asCalendarDate(event.target.value) })} type="date" value={schedule.dueOn} /></label>
    </div>
  );
  const date = schedule.kind === "due" ? schedule.dueOn : schedule.on;
  return (
    <label className={styles.agendaSingleDate}><span>{schedule.kind === "due" ? "Due" : "Milestone date"}</span><input disabled={store.readOnly} onChange={(event) => store.scheduleTask(task.id, schedule.kind === "due" ? { kind: "due", dueOn: asCalendarDate(event.target.value) } : { kind: "milestone", on: asCalendarDate(event.target.value) })} type="date" value={date} /></label>
  );
}

function SelectedDayAgenda({ date, tasks, visibleIds }: { date: CalendarDate; tasks: LabTask[]; visibleIds: string[] }) {
  const store = useLabStore();
  const previewTask = store.previewId ? store.taskById(store.previewId) : undefined;
  const milestones = tasks.filter((task) => task.schedule.kind === "milestone").length;
  const waiting = tasks.filter((task) => task.status === "waiting" || task.blockedByIds.length > 0).length;
  return (
    <aside aria-label={`Agenda for ${formatDateLong(date)}`} className={styles.selectedAgenda}>
      <header>
        <span>Selected day</span>
        <h2>{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
        <p>{tasks.length} task{tasks.length === 1 ? "" : "s"}{milestones > 0 ? `, ${milestones} milestone${milestones === 1 ? "" : "s"}` : ""}{waiting > 0 ? `, ${waiting} waiting` : ""}</p>
        {store.readOnly ? null : <button onClick={() => store.addTask("todo", { kind: "due", dueOn: date })} type="button"><Icon name="add" size={14} />Create on this date</button>}
      </header>

      {previewTask ? (
        <section aria-label={`Preview of ${previewTask.title}`} className={styles.calendarPreview} data-task-id={previewTask.id}>
          <div><span>Preview</span><button aria-label="Close task preview" onClick={() => store.setPreview(null)} type="button"><Icon name="close" size={13} /></button></div>
          <strong>{previewTask.title}</strong>
          <p>{previewTask.description}</p>
          <footer><ScheduleText task={previewTask} /><AvatarStack limit={3} task={previewTask} /></footer>
        </section>
      ) : null}

      {tasks.length === 0 ? (
        <div className={styles.agendaEmpty}><Icon name="calendar" size={18} /><strong>The day is open</strong><p>Create a dated task here, or drag one in from Unscheduled.</p></div>
      ) : (
        <ol className={styles.selectedAgendaList}>
          {tasks.map((task) => (
            <li
              data-inspected={store.inspectedId === task.id || undefined}
              data-recently-placed={store.recentlyPlacedId === task.id || undefined}
              data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
              data-scheduled-task-id={task.id}
              data-task-id={task.id}
              key={task.id}
            >
              <article>
                <div className={styles.agendaTaskLead}>
                  <TaskSelection disabled={store.readOnly} orderedIds={visibleIds} task={task} />
                  <div><TaskOpenButton className={styles.agendaTaskTitle} task={task} /><ScheduleText task={task} /></div>
                  <TaskCompletion disabled={store.readOnly} task={task} />
                </div>
                <p>{task.description}</p>
                <div className={styles.agendaTaskPeople}><AvatarStack limit={4} task={task} /><TaskSignals task={task} /></div>
                {task.blockedByIds.length > 0 ? <div className={styles.agendaBlocker}><Icon name="dependency" size={13} />Waiting on {task.blockedByIds.length} named dependency</div> : null}
                <CalendarDateEditor task={task} />
              </article>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function OverflowPopover({
  date,
  tasks,
  id,
  labelledBy,
  onClose,
}: {
  date: CalendarDate;
  tasks: LabTask[];
  id: string;
  labelledBy: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("ul button, header button")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <motion.section
      animate={{ opacity: 1, transform: "scale(1)" }}
      aria-labelledby={labelledBy}
      className={styles.calendarOverflowPopover}
      id={id}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.985)" }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      ref={dialogRef}
      role="dialog"
      transition={{ duration: reduceMotion ? 0.12 : 0.16, ease: [0.23, 1, 0.32, 1] }}
    >
      <header><div><span>Day agenda</span><strong id={labelledBy}>{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</strong></div><button aria-label="Close day agenda" onClick={onClose} type="button"><Icon name="close" size={15} /></button></header>
      <ul>{tasks.map((task) => <li data-scheduled-task-id={task.id} data-task-id={task.id} key={task.id}><TaskOpenButton task={task} /><ScheduleText compact task={task} /></li>)}</ul>
    </motion.section>
  );
}

function AgendaLedger({ dates, tasks, selectedDate, onSelect }: { dates: CalendarDate[]; tasks: LabTask[]; selectedDate: CalendarDate; onSelect: (date: CalendarDate) => void }) {
  const store = useLabStore();
  const groups = dates.map((date) => ({ date, tasks: tasksForDate(tasks, date) })).filter((group) => group.tasks.length > 0);
  return (
    <div aria-label="Calendar agenda view" className={styles.agendaLedger}>
      {groups.length === 0 ? <div className={styles.calendarSurfaceEmpty}><Icon name="agenda" size={20} /><strong>No dated work in this agenda window</strong><span>Unscheduled tasks stay in their tray below.</span></div> : groups.map((group) => (
        <section data-date={group.date} data-selected={group.date === selectedDate || undefined} key={group.date}>
          <button aria-label={`Select ${formatDateLong(group.date)}`} onClick={() => onSelect(group.date)} type="button"><span>{formatDate(group.date, { weekday: "short" })}</span><strong>{formatDate(group.date, { day: "numeric", month: "short" })}</strong></button>
          <ol>{group.tasks.map((task) => <li data-inspected={store.inspectedId === task.id || undefined} data-recently-placed={store.recentlyPlacedId === task.id || undefined} data-recently-updated={store.recentlyUpdatedId === task.id || undefined} data-scheduled-task-id={task.id} data-task-id={task.id} key={task.id}><TaskOpenButton task={task} /><ScheduleText task={task} /><AvatarStack limit={2} task={task} /></li>)}</ol>
        </section>
      ))}
    </div>
  );
}

/**
 * Subscribe control for the calendar toolbar. Copies a `webcal://` link the
 * operator pastes into their own calendar app's "Add subscription" dialog —
 * the feed itself is read-only and refreshed on the client's own cadence.
 * Renders nothing outside the app shell, where there is no workspace to
 * build a feed URL for.
 */
function CalendarSubscribeButton() {
  const ws = useActiveWorkspace();
  const { toast } = useToast();

  const onSubscribe = useCallback(() => {
    if (!ws) return;
    const url = `${window.location.origin.replace(/^https?/, "webcal")}/api/calendar/${ws.id}`;
    const finish = () => toast("Link copied", { tone: "success", body: "Paste into Calendar's 'Add subscription' dialog." });
    const fallbackCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        finish();
      } catch {
        toast("Couldn't copy the link", { tone: "warn" });
      }
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(finish, fallbackCopy);
    else fallbackCopy();
  }, [toast, ws]);

  if (!ws) return null;
  return (
    <button onClick={onSubscribe} title="Subscribe in your calendar app" type="button">Subscribe</button>
  );
}

/**
 * Mobile day-list. Below md the month/week grid (and the agenda ledger
 * beside it) don't fit a phone width usefully, so narrow viewports get a
 * plain chronological 14-day list instead, anchored to the toolbar's
 * Previous/Next/Today navigation. The Month/Week/Agenda switch is hidden
 * at this width — the list replaces all three modes.
 */
function MobileDayList({ anchor, calendar, tasks }: { anchor: CalendarDate; calendar: CalendarFrame; tasks: LabTask[] }) {
  // Anchored to the toolbar's navigation state, not permanently to today —
  // Previous/Next/Today were verifiably dead controls at phone width.
  const dates = useMemo(() => eachDate(anchor, addDays(anchor, 13)), [anchor]);
  return (
    <div aria-label="Upcoming 14 days" className={styles.calendarDayList} role="region">
      {dates.map((date) => {
        const dayTasks = tasksForDate(tasks, date);
        const isToday = date === calendar.today;
        return (
          <section className={styles.calendarDayListRow} data-today={isToday || undefined} key={date}>
            <header>
              <span>{isToday ? "Today" : formatDate(date, { weekday: "short" })}</span>
              <strong>{formatDate(date, { day: "numeric", month: "short" })}</strong>
            </header>
            {dayTasks.length === 0 ? (
              <p className={styles.calendarDayListEmpty}>Nothing scheduled.</p>
            ) : (
              <ul>
                {dayTasks.map((task) => (
                  <li key={task.id}>
                    <TaskOpenButton task={task} />
                    <ScheduleText compact task={task} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function CalendarView({
  tasks,
  selectedDate,
  onSelectedDateChange,
}: {
  tasks: LabTask[];
  selectedDate: CalendarDate;
  onSelectedDateChange: (date: CalendarDate) => void;
}) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const contextMenu = useTaskContextMenu();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchorDate, setAnchorDate] = useState<CalendarDate>(selectedDate);
  const [overflowDate, setOverflowDate] = useState<CalendarDate | null>(null);
  const overflowDialogId = useId();
  const overflowTitleId = useId();
  const overflowTriggerRef = useRef<HTMLButtonElement | null>(null);
  const unscheduled = activeUnscheduledTasks(tasks);
  const visibleIds = tasks.map((task) => task.id);
  const anchorWindowStart = mode === "month"
    ? startOfMonthGrid(anchorDate)
    : mode === "week"
      ? startOfWeek(anchorDate)
      : anchorDate;
  const anchorWindowEnd = addDays(
    anchorWindowStart,
    mode === "month" ? 41 : mode === "week" ? 6 : 20,
  );
  const visibleAnchor = selectedDate >= anchorWindowStart && selectedDate <= anchorWindowEnd
    ? anchorDate
    : selectedDate;
  const monthStart = startOfMonthGrid(visibleAnchor);
  const monthDates = useMemo(() => eachDate(monthStart, addDays(monthStart, 41)), [monthStart]);
  const weekStart = startOfWeek(visibleAnchor);
  const weekDates = useMemo(() => eachDate(weekStart, addDays(weekStart, 6)), [weekStart]);
  const agendaDates = useMemo(() => eachDate(visibleAnchor, addDays(visibleAnchor, 20)), [visibleAnchor]);
  const selectedTasks = tasksForDate(tasks, selectedDate);
  const displayedDates = mode === "month" ? monthDates : mode === "week" ? weekDates : agendaDates;
  const overflowTasks = overflowDate ? tasksForDate(tasks, overflowDate) : [];
  const title = mode === "month" ? monthTitle(visibleAnchor)
    : mode === "week" ? `${formatDate(weekDates[0], { day: "numeric", month: "short" })} to ${formatDate(weekDates[6], { day: "numeric", month: "short", year: "numeric" })}`
      : `Agenda from ${formatDate(visibleAnchor, { day: "numeric", month: "long", year: "numeric" })}`;

  // Navigation moves the SELECTION with the window. visibleAnchor falls back
  // to selectedDate whenever the selection sits outside the anchor's window —
  // a guard meant to follow a far-away pick, which also fired on every
  // Previous/Next and snapped the view straight back, leaving all three
  // controls inert (the phone day list most visibly, since it has no grid to
  // hide the fact).
  const navigate = (direction: -1 | 1) => {
    const nextAnchor = mode === "month"
      ? shiftMonth(visibleAnchor, direction)
      : addDays(visibleAnchor, direction * (mode === "week" ? 7 : 21));
    setAnchorDate(nextAnchor);
    const nextSelected = mode === "month"
      ? shiftMonth(selectedDate, direction)
      : addDays(selectedDate, direction * (mode === "week" ? 7 : 21));
    onSelectedDateChange(nextSelected);
    setOverflowDate(null);
  };

  const closeOverflow = useCallback(() => {
    setOverflowDate(null);
    window.requestAnimationFrame(() => {
      overflowTriggerRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const dropOnDate = (event: DragEvent<HTMLElement>, date: CalendarDate) => {
    event.preventDefault();
    if (store.readOnly) return;
    const taskId = event.dataTransfer.getData("text/x-signal-task") || (store.drag?.kind === "schedule" ? store.drag.taskId : "");
    const operation = event.dataTransfer.getData("application/x-signal-schedule-operation") || "move";
    const task = store.taskById(taskId);
    if (!task) return;
    if (task.schedule.kind === "unscheduled" || operation === "schedule") store.scheduleOn(task.id, date);
    else {
      const currentStart = scheduleStart(task.schedule);
      if (currentStart) store.moveScheduleByDays(task.id, differenceInDays(currentStart, date));
    }
    store.setDrag(null);
    onSelectedDateChange(date);
  };

  const dateKeyboard = (event: KeyboardEvent<HTMLButtonElement>, date: CalendarDate) => {
    const movement: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const amount = movement[event.key];
    if (amount === undefined) return;
    event.preventDefault();
    const next = addDays(date, amount);
    onSelectedDateChange(next);
    if (!displayedDates.includes(next)) setAnchorDate(next);
    focusCalendarDate(next);
  };

  const renderCalendarTable = (dates: CalendarDate[]) => {
    const rows = Array.from({ length: dates.length / 7 }, (_, index) => dates.slice(index * 7, index * 7 + 7));
    const maxVisible = mode === "week" ? 8 : 3;
    return (
      <table className={`${styles.calendarTable} ${mode === "week" ? styles.calendarWeekTable : ""}`}>
        <caption>{mode === "week" ? "Week calendar" : `Month calendar for ${monthTitle(anchorDate)}`}. Use arrow keys on day numbers to move between dates.</caption>
        <thead><tr>{WEEKDAYS.map((day) => <th key={day} scope="col"><span>{day}</span></th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((date) => {
          const dayTasks = tasksForDate(tasks, date);
          const outside = mode === "month" && date.slice(0, 7) !== anchorDate.slice(0, 7);
          const visible = dayTasks.slice(0, maxVisible);
          return (
            <td
              className={styles.calendarCell}
              data-date={date}
              data-drop-target={store.drag?.kind === "schedule" && store.drag.targetDate === date || undefined}
              data-outside={outside || undefined}
              data-selected={selectedDate === date || undefined}
              data-today={date === calendar.today || undefined}
              key={date}
              onDragEnter={() => { if (store.drag?.kind === "schedule") store.setDrag({ ...store.drag, targetDate: date }); }}
              onDragOver={(event) => { if (!store.readOnly) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
              onDrop={(event) => dropOnDate(event, date)}
            >
              <div className={styles.calendarDayHeader}>
                <button aria-label={`Select ${formatDateLong(date)}`} data-date-select="true" onClick={() => onSelectedDateChange(date)} onKeyDown={(event) => dateKeyboard(event, date)} type="button">{formatDate(date, { day: "numeric" })}</button>
                {store.readOnly ? null : <button aria-label={`Create task due ${formatDateLong(date)}`} onClick={() => { store.addTask("todo", { kind: "due", dueOn: date }); onSelectedDateChange(date); }} type="button"><Icon name="add" size={12} /></button>}
              </div>
              <div className={styles.calendarItems}>
                {visible.map((task) => <CalendarTaskChip date={date} key={task.id} onOpenMenu={contextMenu.openMenuAt} task={task} visibleIds={visibleIds} />)}
                {dayTasks.length > maxVisible ? <button aria-controls={overflowDate === date ? overflowDialogId : undefined} aria-expanded={overflowDate === date} aria-haspopup="dialog" aria-label={`Show ${dayTasks.length - maxVisible} more tasks on ${formatDateLong(date)}`} className={styles.calendarMoreButton} onClick={(event) => { overflowTriggerRef.current = event.currentTarget; setOverflowDate(date); onSelectedDateChange(date); }} type="button">+{dayTasks.length - maxVisible} more</button> : null}
              </div>
            </td>
          );
        })}</tr>)}</tbody>
      </table>
    );
  };

  return (
    <section aria-label="Project Calendar" className={styles.calendarView}>
      <header className={styles.calendarToolbar}>
        <div className={styles.calendarNavigation}>
          <button aria-label="Previous calendar range" onClick={() => navigate(-1)} type="button"><Icon name="arrow-left" size={14} />Previous</button>
          <button aria-label="Next calendar range" onClick={() => navigate(1)} type="button">Next<Icon name="arrow-right" size={14} /></button>
          <button onClick={() => { setAnchorDate(calendar.today as CalendarDate); onSelectedDateChange(calendar.today as CalendarDate); }} type="button">Today</button>
          <CalendarSubscribeButton />
        </div>
        <h2>{title}</h2>
        <div aria-label="Calendar view" className={styles.calendarModeSwitch} role="group">
          {(["month", "week", "agenda"] as CalendarMode[]).map((value) => <button aria-pressed={mode === value} key={value} onClick={() => setMode(value)} type="button">{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
      </header>

      <div className={styles.calendarMobileAgenda}>
        <MobileDayList anchor={visibleAnchor} calendar={calendar} tasks={tasks} />
      </div>

      <div className={styles.calendarWorkspace}>
        <div className={styles.calendarPrimary}>
          {mode === "agenda" ? <AgendaLedger dates={agendaDates} onSelect={onSelectedDateChange} selectedDate={selectedDate} tasks={tasks} /> : renderCalendarTable(mode === "week" ? weekDates : monthDates)}
          {overflowDate ? <OverflowPopover date={overflowDate} id={overflowDialogId} labelledBy={overflowTitleId} onClose={closeOverflow} tasks={overflowTasks} /> : null}
        </div>
        <SelectedDayAgenda date={selectedDate} tasks={selectedTasks} visibleIds={visibleIds} />
      </div>

      <UnscheduledTray compact source="calendar" tasks={unscheduled} />
      <TaskContextMenu menu={contextMenu.menu} onClose={contextMenu.closeMenu} />
    </section>
  );
}
