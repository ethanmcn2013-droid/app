"use client";

/**
 * Calendar: the dated work on a month, a week or an agenda, with the work
 * that still needs a date in a tray beside it.
 *
 * - Month shows only the weeks the month actually uses; each day shows up
 *   to three tasks, then "+2 more", which selects the day.
 * - Drag a task onto a day to give it that date; drag a dated task back to
 *   the tray to clear its date. Ranges and milestones move whole.
 * - The day pane holds the tray, the milestones and the selected day, with
 *   "Add on this day". "Needs a date" in the toolbar shows or hides it; by
 *   default it shows only when the calendar is at least TRAY_ROOM wide, so
 *   day cells keep room for readable titles. On a tablet it is a drawer; on
 *   a phone the calendar opens as an agenda (decided after mount, behind a
 *   skeleton CSS picks by width, so the month never flashes first).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useActiveWorkspace } from "@/lib/domain-context";
import { useToast } from "@/components/primitives/toast";
import { addDays, compareDates, differenceInDays, eachDate, scheduleIncludes, scheduleStart, startOfWeek } from "@/components/hybrid/dates";
import { activeUnscheduledTasks, weekdayIndex } from "@/components/hybrid/planning";
import type { NewTaskDefaults } from "@/components/app/add-task/add-task-context";
import type { CalendarDate, LabTask } from "@/components/hybrid/types";
import { useSurface } from "./surface";
import { StatusGlyph } from "./atoms";
import { Highlight } from "./task-bits";
import { useCalendarDone, useCalendarTray, useCalendarWeekends, type CalendarMode } from "./display-prefs";
import { AgendaSkeleton, CalendarSkeleton } from "./skeletons";
import { shortDate } from "./time";
import { TIcon } from "./icons";
import { calendarOrder } from "./view-order";
import { setVisibleTaskOrder } from "./sheet-bridge";
import { Button } from "./ui";
import styles from "./calendar.module.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DRAG_TYPE = "application/x-signal-task";

function parts(date: CalendarDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function monthStart(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 7)}-01` as CalendarDate;
}

function shiftMonth(date: CalendarDate, amount: number): CalendarDate {
  const { y, m } = parts(date);
  const next = new Date(Date.UTC(y, m - 1 + amount, 1));
  return next.toISOString().slice(0, 10) as CalendarDate;
}

function longDay(date: CalendarDate): string {
  const { m, d } = parts(date);
  return `${LONG_DAYS[weekdayIndex(date)]} ${d} ${MONTHS[m - 1]}`;
}

/** The weeks a month actually uses: 4, 5 or 6 rows, never a padded 6. */
function monthWeeks(anchor: CalendarDate): CalendarDate[][] {
  const first = monthStart(anchor);
  const last = addDays(shiftMonth(anchor, 1), -1);
  const start = startOfWeek(first);
  const weeks: CalendarDate[][] = [];
  for (let week = start; compareDates(week, last) <= 0; week = addDays(week, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(week, i)));
  }
  return weeks;
}

function taskEnd(task: LabTask): CalendarDate | null {
  const s = task.schedule;
  return s.kind === "unscheduled" ? null : s.kind === "milestone" ? s.on : s.dueOn;
}

const PHONE = "(max-width: 767px)";
/** Below this calendar width the tray starts hidden, so a month cell keeps
 *  room for a readable title. Inside the 1180px page column that means the
 *  tray starts hidden and "Needs a date" in the toolbar brings it in. */
const TRAY_ROOM = 1200;
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
function subscribePhone(listener: () => void) {
  const media = window.matchMedia(PHONE);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function CalendarView({ onCompose }: { onCompose: (extra: Partial<NewTaskDefaults>, anchor: HTMLElement | null) => void }) {
  const surface = useSurface();
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const today = calendar.today as CalendarDate;
  // null on the server: the phone decision is made after mount.
  const phone = useSyncExternalStore<boolean | null>(subscribePhone, () => window.matchMedia(PHONE).matches, () => null);
  const [chosen, setChosen] = useState<CalendarMode | null>(null);
  const mode: CalendarMode | null = chosen ?? (phone === null ? null : phone ? "agenda" : "month");
  const [anchor, setAnchor] = useState<CalendarDate>(today);
  const [selected, setSelected] = useState<CalendarDate>(today);
  const [weekends] = useCalendarWeekends();
  const [showDone] = useCalendarDone();
  const [trayOver, setTrayOver] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trayPref, setTrayPref] = useCalendarTray();
  const [roomy, setRoomy] = useState<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setRoomy(entry.contentRect.width >= TRAY_ROOM));
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);
  const trayShown = trayPref === "auto" ? roomy === true : trayPref === "shown";

  const tasks = useMemo(
    () => surface.visible.filter((task) => showDone === "on" || !surface.isDone(task)),
    [showDone, surface],
  );
  const dated = useMemo(() => tasks.filter((t) => t.schedule.kind !== "unscheduled"), [tasks]);
  const undated = useMemo(() => activeUnscheduledTasks(surface.visible), [surface.visible]);
  useEffect(() => setVisibleTaskOrder(calendarOrder(tasks)), [tasks]);
  const milestones = useMemo(
    () => surface.all.filter((t) => t.schedule.kind === "milestone" && !surface.isDone(t)).sort((a, b) => (taskEnd(a) ?? "").localeCompare(taskEnd(b) ?? "")),
    [surface],
  );
  const onDay = useCallback(
    (date: CalendarDate) =>
      dated
        .filter((task) => scheduleIncludes(task.schedule, date))
        .sort((a, b) => (a.schedule.kind === "milestone" ? -1 : 0) - (b.schedule.kind === "milestone" ? -1 : 0) || a.order - b.order),
    [dated],
  );

  /* ── moving dates ─────────────────────────────────────────────────── */
  const dropOn = useCallback(
    (taskId: string, date: CalendarDate) => {
      if (surface.readOnly) return;
      const task = surface.all.find((t) => t.id === taskId);
      if (!task) return;
      const start = scheduleStart(task.schedule);
      if (task.schedule.kind === "unscheduled" || task.schedule.kind === "due") store.scheduleOn(taskId, date);
      else if (start) store.moveScheduleByDays(taskId, differenceInDays(taskEnd(task) ?? start, date));
      setSelected(date);
    },
    [store, surface],
  );
  const clearDate = useCallback(
    (taskId: string) => {
      if (surface.readOnly) return;
      store.unscheduleTask(taskId);
    },
    [store, surface.readOnly],
  );

  const period = (step: number) => {
    if (mode === "week") {
      setAnchor((a) => addDays(a, step * 7));
      setSelected((s) => addDays(s, step * 7));
    } else if (mode === "agenda") setAnchor((a) => addDays(a, step * 14));
    else setAnchor((a) => shiftMonth(a, step));
  };
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const onGridKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "t" || event.key === "T") {
      event.preventDefault();
      goToday();
      return;
    }
    const cell = target.closest<HTMLElement>("[data-date]");
    if (!cell || target.closest("[data-chip]")) return;
    const date = cell.dataset.date as CalendarDate;
    const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (move[event.key] !== undefined) {
      event.preventDefault();
      const next = addDays(date, move[event.key]);
      setSelected(next);
      if (next.slice(0, 7) !== anchor.slice(0, 7) && mode === "month") setAnchor(next);
      window.requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus());
    } else if (event.key === "Enter" && !surface.readOnly) {
      event.preventDefault();
      onCompose({ dueOn: date }, cell);
    }
  };

  const title =
    mode === "week"
      ? weekTitle(startOfWeek(anchor))
      : mode === "agenda"
        ? `From ${shortDate(anchor)}`
        : `${MONTHS[parts(anchor).m - 1]} ${parts(anchor).y}`;

  const weeks = mode === "month" ? monthWeeks(anchor) : [Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))];
  const visibleDays = (week: CalendarDate[]) => (weekends === "on" ? week : week.slice(0, 5));
  const monthCount = mode === "month" ? dated.filter((t) => (taskEnd(t) ?? "").slice(0, 7) === anchor.slice(0, 7)).length : null;

  return (
    <div className={styles.wrap} ref={wrapRef} data-mode={mode ?? "pending"} data-weekends={weekends} data-tray={trayShown ? "shown" : "hidden"}>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button variant="ghost" iconOnly size="sm" icon={<TIcon.chevronLeft />} aria-label={mode === "week" ? "Previous week" : mode === "agenda" ? "Earlier" : "Previous month"} onClick={() => period(-1)} />
          <h2 className={styles.title} aria-live="polite">{title}</h2>
          <Button variant="ghost" iconOnly size="sm" icon={<TIcon.chevronRight />} aria-label={mode === "week" ? "Next week" : mode === "agenda" ? "Later" : "Next month"} onClick={() => period(1)} />
          <Button size="sm" onClick={goToday} aria-keyshortcuts="T">Today</Button>
        </div>
        <div className={styles.modes} role="radiogroup" aria-label="Calendar layout">
          {(["month", "week", "agenda"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={styles.mode}
              // While the layout resolves, CSS marks the likely one by width:
              // Month on wider screens, Agenda on a phone.
              data-likely={value === "month" ? "wide" : value === "agenda" ? "phone" : undefined}
              onClick={() => setChosen(value)}
            >
              {value === "month" ? "Month" : value === "week" ? "Week" : "Agenda"}
            </button>
          ))}
        </div>
        {mode !== "agenda" && mode !== null ? (
          <button
            type="button"
            className={styles.trayToggle}
            aria-pressed={trayShown}
            title={trayShown ? "Hide the tasks that need a date" : "Show the tasks that need a date"}
            onClick={() => setTrayPref(trayShown ? "hidden" : "shown")}
          >
            <TIcon.noDate size={14} />
            Needs a date
            <span className={styles.trayCount}>{undated.length}</span>
          </button>
        ) : null}
        <SubscribeButton />
      </div>

      <div className={styles.body}>
        <div className={styles.main}>
          {mode === null ? (
            <>
              <div className={styles.skeletonWide}><CalendarSkeleton bare /></div>
              <div className={styles.skeletonPhone}><AgendaSkeleton /></div>
            </>
          ) : mode === "agenda" ? (
            <Agenda tasks={dated} from={anchor} today={today} onOpen={(id) => store.openTask(id)} undated={undated} onCompose={onCompose} />
          ) : (
            <div className={styles.grid} ref={gridRef} role="grid" aria-label={title} onKeyDown={onGridKey} data-weeks={weeks.length}>
              <div className={styles.weekdays} role="row">
                {visibleDays(WEEKDAYS as unknown as CalendarDate[]).map((day) => (
                  <span key={day} role="columnheader" className={styles.weekday}>{day}</span>
                ))}
              </div>
              {weeks.map((week) => (
                <div key={week[0]} role="row" className={styles.week} data-mode={mode}>
                  {visibleDays(week).map((date, index) => {
                    const items = onDay(date);
                    const limit = mode === "week" ? items.length : 3;
                    const outside = mode === "month" && date.slice(0, 7) !== anchor.slice(0, 7);
                    return (
                      <DayCell
                        key={date}
                        date={date}
                        today={date === today}
                        selected={date === selected}
                        outside={outside}
                        // The first day shown names its month when it
                        // belongs to the one before: "29 Jun".
                        withMonth={outside && week === weeks[0] && index === 0}
                        items={items}
                        limit={limit}
                        onSelect={() => setSelected(date)}
                        onDrop={(id) => dropOn(id, date)}
                        onCompose={(el) => onCompose({ dueOn: date }, el)}
                      />
                    );
                  })}
                </div>
              ))}
              {monthCount === 0 ? (
                <div className={styles.monthEmpty} role="status">
                  <span>Nothing dated in {MONTHS[parts(anchor).m - 1]}.</span>
                  {undated.length ? <span className={styles.monthEmptyHint}>{undated.length} {undated.length === 1 ? "task needs" : "tasks need"} a date. Drag one from the tray onto a day.</span> : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {mode !== "agenda" && mode !== null ? (
          <aside className={styles.pane} data-open={drawerOpen ? "" : undefined} aria-label="Day details">
            <button type="button" className={styles.drawerHandle} aria-expanded={drawerOpen} onClick={() => setDrawerOpen((v) => !v)}>
              <span className={styles.handleBar} aria-hidden="true" />
              Needs a date · {undated.length}
            </button>
            <section
              className={styles.tray}
              data-over={trayOver ? "" : undefined}
              aria-labelledby="tray-title"
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(DRAG_TYPE) || surface.readOnly) return;
                event.preventDefault();
                setTrayOver(true);
              }}
              onDragLeave={() => setTrayOver(false)}
              onDrop={(event) => {
                setTrayOver(false);
                const id = event.dataTransfer.getData(DRAG_TYPE);
                if (id) {
                  event.preventDefault();
                  clearDate(id);
                }
              }}
            >
              <div className={styles.paneHead}>
                <h3 id="tray-title" className={styles.paneTitle}>
                  <TIcon.noDate size={14} /> Needs a date <span className={styles.paneCount}>{undated.length}</span>
                </h3>
                <p className={styles.paneNote}>{trayOver ? "Drop here to clear its date." : "Drag onto a day to date it."}</p>
              </div>
              {undated.length === 0 ? (
                <p className={styles.paneEmpty}>Every open task has a date.</p>
              ) : (
                <ul className={styles.paneList}>
                  {undated.slice(0, 8).map((task) => (
                    <li key={task.id}>
                      <Chip task={task} variant="row" />
                    </li>
                  ))}
                  {undated.length > 8 ? <li className={styles.paneMore}>{undated.length - 8} more in List, filtered to No date</li> : null}
                </ul>
              )}
            </section>
            {milestones.length ? (
              <section className={styles.section} aria-labelledby="milestones-title">
                <h3 id="milestones-title" className={styles.paneTitle}>
                  <TIcon.diamond size={14} /> Milestones
                </h3>
                <ul className={styles.paneList}>
                  {milestones.slice(0, 4).map((task) => (
                    <li key={task.id}>
                      <button type="button" className={styles.milestone} onClick={() => { const d = taskEnd(task); if (d) { setSelected(d); setAnchor(d); } }}>
                        <TIcon.diamond size={12} />
                        <span className={styles.milestoneTitle}>{task.title}</span>
                        <span className={styles.milestoneDate}>{taskEnd(task) ? shortDate(taskEnd(task)!) : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className={styles.section} aria-labelledby="day-title">
              <h3 id="day-title" className={styles.dayTitle}>
                {selected === today ? "Today, " : ""}
                {longDay(selected)}
              </h3>
              {onDay(selected).length === 0 ? (
                <p className={styles.paneEmpty}>Nothing due this day.</p>
              ) : (
                <ul className={styles.paneList}>
                  {onDay(selected).map((task) => (
                    <li key={task.id}>
                      <Chip task={task} variant="row" />
                    </li>
                  ))}
                </ul>
              )}
              {surface.readOnly ? null : (
                <button type="button" className={styles.addDay} onClick={(event) => onCompose({ dueOn: selected }, event.currentTarget)}>
                  <TIcon.plus size={14} /> Add on this day
                </button>
              )}
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function weekTitle(start: CalendarDate): string {
  const end = addDays(start, 6);
  const a = parts(start);
  const b = parts(end);
  return a.m === b.m ? `${a.d} to ${b.d} ${MONTHS[a.m - 1]} ${a.y}` : `${a.d} ${MONTHS[a.m - 1].slice(0, 3)} to ${b.d} ${MONTHS[b.m - 1].slice(0, 3)} ${b.y}`;
}

function DayCell({
  date,
  today,
  selected,
  outside,
  withMonth = false,
  items,
  limit,
  onSelect,
  onDrop,
  onCompose,
}: {
  date: CalendarDate;
  today: boolean;
  selected: boolean;
  outside: boolean;
  withMonth?: boolean;
  items: LabTask[];
  limit: number;
  onSelect: () => void;
  onDrop: (id: string) => void;
  onCompose: (el: HTMLElement) => void;
}) {
  const surface = useSurface();
  const [over, setOver] = useState(false);
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  const { d } = parts(date);
  return (
    <div
      role="gridcell"
      className={styles.day}
      data-date={date}
      data-today={today ? "" : undefined}
      data-selected={selected ? "" : undefined}
      data-outside={outside ? "" : undefined}
      data-over={over ? "" : undefined}
      aria-selected={selected}
      aria-label={`${longDay(date)}, ${items.length} ${items.length === 1 ? "task" : "tasks"}`}
      tabIndex={selected ? 0 : -1}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-chip], button")) return;
        onSelect();
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE) || surface.readOnly) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        const id = event.dataTransfer.getData(DRAG_TYPE);
        if (id) {
          event.preventDefault();
          onDrop(id);
        }
      }}
    >
      <div className={styles.dayHead}>
        <span className={styles.dayNumber}>{d === 1 || withMonth ? `${d} ${SHORT_MONTHS[parts(date).m - 1]}` : d}</span>
        {surface.readOnly ? null : (
          <button type="button" className={styles.dayAdd} aria-label={`Add a task on ${longDay(date)}`} tabIndex={-1} onClick={(event) => onCompose(event.currentTarget)}>
            <TIcon.plus size={12} />
          </button>
        )}
      </div>
      <div className={styles.dayItems}>
        {shown.map((task) => (
          <Chip key={task.id} task={task} date={date} />
        ))}
        {rest > 0 ? (
          <button type="button" className={styles.more} onClick={onSelect}>
            +{rest} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ task, date, variant = "chip" }: { task: LabTask; date?: CalendarDate; variant?: "chip" | "row" }) {
  const surface = useSurface();
  const store = useLabStore();
  const { today } = useCalendarFrame();
  const column = surface.columnOf(task.status);
  const done = surface.isDone(task);
  const s = task.schedule;
  const end = taskEnd(task);
  const late = !done && end !== null && compareDates(end, today) < 0;
  const range = s.kind === "range" && date ? (date === s.startOn ? "start" : date === s.dueOn ? "end" : "middle") : undefined;
  return (
    <button
      type="button"
      data-chip=""
      data-id={task.id}
      className={variant === "row" ? styles.rowChip : styles.chip}
      data-milestone={s.kind === "milestone" ? "" : undefined}
      data-range={range}
      data-done={done ? "" : undefined}
      data-late={late ? "" : undefined}
      draggable={!surface.readOnly}
      title={late ? `${task.title} (overdue)` : task.title}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, task.id);
        event.dataTransfer.setData("text/plain", task.title);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={(event) => {
        event.stopPropagation();
        store.openTask(task.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        surface.openMenu(task.id, event.clientX, event.clientY);
      }}
      onFocus={() => surface.setFocusedId(task.id)}
    >
      {s.kind === "milestone" ? <TIcon.diamond size={12} /> : <StatusGlyph column={done ? { key: "done", isDone: true, isSystem: true, color: "emerald" } : column} size={12} />}
      <span className={styles.chipTitle}>
        <Highlight text={task.title} />
      </span>
      {variant === "row" && s.kind !== "unscheduled" ? <span className={styles.rowDate}>{shortDate(s.kind === "milestone" ? s.on : s.dueOn)}</span> : null}
    </button>
  );
}

function Agenda({
  tasks,
  from,
  today,
  onOpen,
  undated,
  onCompose,
}: {
  tasks: LabTask[];
  from: CalendarDate;
  today: CalendarDate;
  onOpen: (id: string) => void;
  undated: LabTask[];
  onCompose: (extra: Partial<NewTaskDefaults>, anchor: HTMLElement | null) => void;
}) {
  const surface = useSurface();
  const [trayOpen, setTrayOpen] = useState(false);
  const overdue = tasks.filter((t) => !surface.isDone(t) && compareDates(taskEnd(t)!, today) < 0);
  const days = eachDate(from, addDays(from, 27));
  const groups = days
    .map((date) => ({ date, items: tasks.filter((t) => scheduleIncludes(t.schedule, date) && !(overdue.includes(t) && date !== taskEnd(t))) }))
    .filter((g) => g.items.length > 0 || g.date === today);
  return (
    <div className={styles.agenda}>
      <section className={styles.agendaTray}>
        <button type="button" className={styles.agendaTrayHead} aria-expanded={trayOpen} onClick={() => setTrayOpen((v) => !v)}>
          <TIcon.noDate size={14} />
          <span>Needs a date</span>
          <span className={styles.paneCount}>{undated.length}</span>
          <span className={styles.agendaChevron} data-open={trayOpen ? "" : undefined}><TIcon.chevronDown size={14} /></span>
        </button>
        {trayOpen ? (
          <ul className={styles.paneList}>
            {undated.map((task) => (
              <li key={task.id}>
                <Chip task={task} variant="row" />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {overdue.length && compareDates(from, today) <= 0 ? (
        <section className={styles.agendaDay}>
          <h3 className={styles.agendaDate} data-tone="danger">Overdue</h3>
          {overdue.map((task) => (
            <AgendaRow key={task.id} task={task} onOpen={onOpen} />
          ))}
        </section>
      ) : null}
      {groups.map((group) => (
        <section key={group.date} className={styles.agendaDay}>
          <h3 className={styles.agendaDate} data-today={group.date === today ? "" : undefined}>
            {group.date === today ? "Today, " : group.date === addDays(today, 1) ? "Tomorrow, " : ""}
            {longDay(group.date)}
          </h3>
          {group.items.length === 0 ? <p className={styles.paneEmpty}>Nothing due today.</p> : null}
          {group.items.map((task) => (
            <AgendaRow key={task.id} task={task} onOpen={onOpen} />
          ))}
          {surface.readOnly ? null : (
            <button type="button" className={styles.agendaAdd} onClick={(event) => onCompose({ dueOn: group.date }, event.currentTarget)}>
              <TIcon.plus size={14} /> Add on this day
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

function AgendaRow({ task, onOpen }: { task: LabTask; onOpen: (id: string) => void }) {
  const surface = useSurface();
  const column = surface.columnOf(task.status);
  const done = surface.isDone(task);
  return (
    <button type="button" className={styles.agendaRow} data-id={task.id} data-done={done ? "" : undefined} onClick={() => onOpen(task.id)}>
      {task.schedule.kind === "milestone" ? <TIcon.diamond size={14} /> : <StatusGlyph column={done ? { key: "done", isDone: true, isSystem: true, color: "emerald" } : column} size={16} />}
      <span className={styles.agendaTitle}>
        <Highlight text={task.title} />
      </span>
      <span className={styles.agendaStatus}>{column?.name}</span>
    </button>
  );
}

function SubscribeButton() {
  const workspace = useActiveWorkspace();
  const { toast } = useToast();
  if (!workspace) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<TIcon.link />}
      className={styles.subscribe}
      onClick={() => {
        const url = `${window.location.origin.replace(/^https?/, "webcal")}/api/calendar/${workspace.id}`;
        void navigator.clipboard.writeText(url).then(
          () => toast("Calendar link copied", { tone: "success", body: "Paste it where your calendar app asks to add a subscription." }),
          () => toast("Couldn't copy", { tone: "error" }),
        );
      }}
    >
      Subscribe
    </Button>
  );
}
