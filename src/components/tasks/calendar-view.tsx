"use client";

/**
 * Calendar: the dated work on a week, a month or an agenda, with the work
 * still to plan in a tray on the right.
 *
 * - It opens on the week: one column a day, each task on the day it is due.
 *   Tasks carry a date, not a time of day or an estimate, so there are no
 *   hours and no capacity here: the line beside the week says how many are
 *   due and how many are late, counted from the tasks themselves.
 * - Month shows only the weeks the month actually uses; each day shows up
 *   to three tasks, then "+2 more", which selects the day.
 * - Drag a task onto a day to give it that date; drag a dated task back to
 *   the tray to clear its date. Ranges and milestones move whole.
 * - The "To plan" tray sits to the right of the grid, never the left. Its
 *   tabs are Due soon, Late and No date. Under it are the milestones and, in
 *   the month, the selected day with "Add on this day". "To plan" in the
 *   toolbar shows or hides it; by default it shows when the calendar is at
 *   least TRAY_ROOM wide. On a tablet it is a sheet at the foot of the
 *   screen; on a phone the calendar opens as an agenda with the tray folded
 *   at the top (decided after mount, behind a skeleton CSS picks by width,
 *   so the week never flashes first).
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
import { shortDate, timeOf, weekdayDate } from "./time";
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
const TRAY_ROOM = 1000;
/** The most tray rows shown before the tray points at the list. */
const TRAY_LIMIT = 12;

type PlanTab = "soon" | "late" | "undated";
const PLAN_TABS: { id: PlanTab; label: string }[] = [
  { id: "soon", label: "Due soon" },
  { id: "late", label: "Late" },
  { id: "undated", label: "No date" },
];
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
  const mode: CalendarMode | null = chosen ?? (phone === null ? null : phone ? "agenda" : "week");
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
  /* What is still to plan, counted from the tasks the tools admit: open work
     due in the next seven days, open work past its date, and open work with
     no date at all. */
  const plan = useMemo(() => {
    const open = surface.visible.filter((task) => !surface.isDone(task) && taskEnd(task) !== null);
    const byEnd = (a: LabTask, b: LabTask) => (taskEnd(a) ?? "").localeCompare(taskEnd(b) ?? "") || a.order - b.order;
    const horizon = addDays(today, 6);
    return {
      soon: open.filter((task) => compareDates(taskEnd(task)!, today) >= 0 && compareDates(taskEnd(task)!, horizon) <= 0).sort(byEnd),
      late: open.filter((task) => compareDates(taskEnd(task)!, today) < 0).sort(byEnd),
      undated,
    } satisfies Record<PlanTab, LabTask[]>;
  }, [surface, today, undated]);
  const toPlan = plan.late.length + plan.undated.length;
  const [tabChosen, setTabChosen] = useState<PlanTab | null>(null);
  const tab: PlanTab = tabChosen ?? (plan.soon.length ? "soon" : plan.late.length ? "late" : "undated");
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
  /* The plain line beside the period: what is due in it and what is late. */
  const periodLine = (() => {
    if (mode !== "week" && mode !== "month") return null;
    const open = dated.filter((task) => !surface.isDone(task));
    const inPeriod =
      mode === "week"
        ? open.filter((task) => compareDates(taskEnd(task)!, weeks[0][0]) >= 0 && compareDates(taskEnd(task)!, weeks[0][6]) <= 0)
        : open.filter((task) => (taskEnd(task) ?? "").slice(0, 7) === anchor.slice(0, 7));
    const late = inPeriod.filter((task) => compareDates(taskEnd(task)!, today) < 0).length;
    const where = mode === "week" ? "this week" : `in ${MONTHS[parts(anchor).m - 1]}`;
    const viewing = mode === "week" ? compareDates(today, weeks[0][0]) >= 0 && compareDates(today, weeks[0][6]) <= 0 : today.slice(0, 7) === anchor.slice(0, 7);
    return { due: inPeriod.length, late, where: mode === "week" && !viewing ? "in this week" : where };
  })();

  return (
    <div className={styles.wrap} ref={wrapRef} data-mode={mode ?? "pending"} data-weekends={weekends} data-tray={trayShown ? "shown" : "hidden"}>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button variant="ghost" iconOnly size="sm" icon={<TIcon.chevronLeft />} aria-label={mode === "week" ? "Previous week" : mode === "agenda" ? "Earlier" : "Previous month"} onClick={() => period(-1)} />
          <h2 className={styles.title} aria-live="polite" suppressHydrationWarning>{title}</h2>
          <Button variant="ghost" iconOnly size="sm" icon={<TIcon.chevronRight />} aria-label={mode === "week" ? "Next week" : mode === "agenda" ? "Later" : "Next month"} onClick={() => period(1)} />
          <Button size="sm" onClick={goToday} aria-keyshortcuts="T">Today</Button>
        </div>
        {periodLine ? (
          <p className={styles.periodLine}>
            {periodLine.due === 0 ? (
              `Nothing due ${periodLine.where}`
            ) : (
              <>
                <strong>{periodLine.due}</strong> due {periodLine.where}
              </>
            )}
            {periodLine.late ? (
              <>
                <span className={styles.periodSep} aria-hidden="true">·</span>
                <span className={styles.periodLate}>{periodLine.late} late</span>
              </>
            ) : null}
          </p>
        ) : null}
        <div className={styles.modes} role="radiogroup" aria-label="Calendar layout">
          {(["week", "month", "agenda"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={styles.mode}
              // While the layout resolves, CSS marks the likely one by width:
              // Month on wider screens, Agenda on a phone.
              data-likely={value === "week" ? "wide" : value === "agenda" ? "phone" : undefined}
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
            title={trayShown ? "Hide the tasks still to plan" : "Show the tasks still to plan"}
            onClick={() => setTrayPref(trayShown ? "hidden" : "shown")}
          >
            <TIcon.noDate size={14} />
            To plan
            <span className={styles.trayCount}>{toPlan}</span>
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
              <div className={styles.weekdays} role="row" data-mode={mode}>
                {mode === "week"
                  ? visibleDays(weeks[0]).map((date) => {
                      // Due that day: a task that runs across days is due on its last.
                      const open = onDay(date).filter((task) => !surface.isDone(task) && taskEnd(task) === date).length;
                      return (
                        <span key={date} role="columnheader" className={styles.weekday} data-today={date === today ? "" : undefined} aria-label={longDay(date)}>
                          <span className={styles.weekdayTop}>
                            <span className={styles.weekdayName}>{WEEKDAYS[weekdayIndex(date)]}</span>
                            <span className={styles.weekdayNumber}>{parts(date).d}</span>
                            {date === today ? <span className={styles.todayTag}>Today</span> : null}
                          </span>
                          <span className={styles.weekdayCount}>{open === 0 ? "Nothing due" : `${open} due`}</span>
                        </span>
                      );
                    })
                  : visibleDays(WEEKDAYS as unknown as CalendarDate[]).map((day) => (
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
                  {undated.length ? <span className={styles.monthEmptyHint}>{undated.length} {undated.length === 1 ? "task has" : "tasks have"} no date. Drag one from the tray onto a day.</span> : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {mode !== "agenda" && mode !== null ? (
          <aside className={styles.pane} data-open={drawerOpen ? "" : undefined} aria-label="Day details">
            <button type="button" className={styles.drawerHandle} aria-expanded={drawerOpen} onClick={() => setDrawerOpen((v) => !v)}>
              <span className={styles.handleBar} aria-hidden="true" />
              To plan · {toPlan}
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
                <h3 id="tray-title" className={styles.paneTitle}>To plan</h3>
                <p className={styles.paneNote}>{trayOver ? "Drop here to clear its date." : surface.readOnly ? "Open work by date." : "Drag a task onto a day to set its date."}</p>
              </div>
              <PlanTabs tab={tab} counts={{ soon: plan.soon.length, late: plan.late.length, undated: plan.undated.length }} onPick={setTabChosen} />
              <div role="tabpanel" id="plan-panel" aria-labelledby={`plan-tab-${tab}`}>
                {plan[tab].length === 0 ? (
                  <p className={styles.paneEmpty}>
                    {tab === "soon" ? "Nothing due in the next 7 days." : tab === "late" ? "Nothing is late." : "Every open task has a date."}
                  </p>
                ) : (
                  <ul className={styles.planList}>
                    {plan[tab].slice(0, TRAY_LIMIT).map((task) => (
                      <li key={task.id}>
                        <Chip task={task} variant="plan" />
                      </li>
                    ))}
                    {plan[tab].length > TRAY_LIMIT ? <li className={styles.paneMore}>{plan[tab].length - TRAY_LIMIT} more. The list shows them all.</li> : null}
                  </ul>
                )}
              </div>
            </section>
            {milestones.length ? (
              <section className={styles.section} aria-labelledby="milestones-title">
                <h3 id="milestones-title" className={styles.paneTitle}>
                  <TIcon.diamond size={14} /> Big dates
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
            <section className={styles.section} data-day="" aria-labelledby="day-title">
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

/** Due soon, Late and No date: one tab stop, arrows move between them. */
function PlanTabs({ tab, counts, onPick }: { tab: PlanTab; counts: Record<PlanTab, number>; onPick: (tab: PlanTab) => void }) {
  return (
    <div
      className={styles.planTabs}
      role="tablist"
      aria-label="To plan"
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const at = PLAN_TABS.findIndex((item) => item.id === tab);
        const next = PLAN_TABS[(at + step + PLAN_TABS.length) % PLAN_TABS.length];
        onPick(next.id);
        window.requestAnimationFrame(() => document.getElementById(`plan-tab-${next.id}`)?.focus());
      }}
    >
      {PLAN_TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`plan-tab-${item.id}`}
          aria-selected={tab === item.id}
          aria-controls="plan-panel"
          tabIndex={tab === item.id ? 0 : -1}
          className={styles.planTab}
          data-tone={item.id === "late" && counts.late > 0 ? "danger" : undefined}
          onClick={() => onPick(item.id)}
        >
          {item.label}
          <span className={styles.planTabCount}>{counts[item.id]}</span>
        </button>
      ))}
    </div>
  );
}

function weekTitle(start: CalendarDate): string {
  const end = addDays(start, 6);
  const a = parts(start);
  const b = parts(end);
  return a.m === b.m ? `${a.d} to ${b.d} ${SHORT_MONTHS[a.m - 1]} ${a.y}` : `${a.d} ${SHORT_MONTHS[a.m - 1]} to ${b.d} ${SHORT_MONTHS[b.m - 1]} ${b.y}`;
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

function Chip({ task, date, variant = "chip" }: { task: LabTask; date?: CalendarDate; variant?: "chip" | "row" | "plan" }) {
  const surface = useSurface();
  const store = useLabStore();
  const frame = useCalendarFrame();
  const { today } = frame;
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
      className={variant === "plan" ? styles.planCard : variant === "row" ? styles.rowChip : styles.chip}
      data-milestone={s.kind === "milestone" ? "" : undefined}
      data-range={range}
      data-done={done ? "" : undefined}
      data-late={late ? "" : undefined}
      draggable={!surface.readOnly}
      title={late ? `${task.title} (late)` : task.title}
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
      {variant === "plan" ? (
        <span className={styles.planText}>
          <span className={styles.planTitle}>
            <Highlight text={task.title} />
          </span>
          <span className={styles.planMeta} data-late={late ? "" : undefined}>
            {end === null ? "No date" : late ? `${timeOf(task, false, frame).label}` : `Due ${weekdayDate(end)}`}
            {column ? <span className={styles.planStatus}> · {column.name}</span> : null}
          </span>
        </span>
      ) : (
        <span className={styles.chipTitle}>
          <Highlight text={task.title} />
        </span>
      )}
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
          <span>To plan, no date yet</span>
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
          <h3 className={styles.agendaDate} data-tone="danger">Late</h3>
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
