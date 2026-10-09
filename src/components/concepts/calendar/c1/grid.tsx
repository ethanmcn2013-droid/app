"use client";

import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  PROJECT,
  STATUS_LABEL,
  TODAY,
  WEEKDAYS_SHORT,
  dayOfMonth,
  isOverdue,
  longDay,
  monthShort,
  parseIso,
  plural,
  shortDay,
  type Task,
  type YM,
} from "./data";
import { GHOST_ID, layoutWeek, type Segment } from "./layout";
import { LoadBar, loadSentence } from "./bits";
import { ClockAlert, Diamond, StatusGlyph } from "./icons";
import styles from "./cal.module.css";

export type DragView = {
  id: string;
  over: string | null;
  range: [string, string] | null;
  projected: number | null;
};

export type GridHandlers = {
  onDayOpen: (iso: string, el: HTMLElement) => void;
  onFocusDay: (iso: string) => void;
  onChipDown: (e: ReactPointerEvent<HTMLElement>, task: Task, iso: string) => void;
  onChipOpen: (task: Task, iso: string, el: HTMLElement) => void;
  onChipHover: (task: Task | null, el?: HTMLElement) => void;
  onChipKey: (e: KeyboardEvent<HTMLElement>, task: Task) => void;
};

type Props = GridHandlers & {
  weeks: string[][];
  ym: YM | null;
  tasks: Task[];
  focusDay: string;
  peekDate: string | null;
  pulse: { date: string; key: number } | null;
  settleId: string | null;
  drag: DragView | null;
  gridRef: RefObject<HTMLDivElement | null>;
  animKey: string;
  dir: number;
  compact?: boolean;
};

export function MonthGrid(props: Props) {
  const { weeks, tasks, settleId, gridRef, animKey, dir, compact } = props;
  const layouts = useMemo(() => weeks.map((w) => layoutWeek(w, tasks, settleId)), [weeks, tasks, settleId]);
  const ghostDay = tasks.find((t) => t.id === GHOST_ID)?.start ?? null;
  const slots = useRowSlots(gridRef, weeks.length);

  function moveFocus(e: KeyboardEvent<HTMLElement>, iso: string) {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in deltas && !e.altKey) {
      e.preventDefault();
      const d = parseIso(iso);
      d.setUTCDate(d.getUTCDate() + deltas[e.key]);
      const next = d.toISOString().slice(0, 10);
      props.onFocusDay(next);
      requestAnimationFrame(() => {
        gridRef.current?.querySelector<HTMLElement>(`[data-drop-date="${next}"]`)?.focus();
      });
    } else if (e.key === "Enter" || e.key === " ") {
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      props.onDayOpen(iso, e.currentTarget);
    }
  }

  return (
    <div className={styles.grid} ref={gridRef} data-compact={compact ? "" : undefined}>
      <div className={styles.weekHead} aria-hidden>
        {WEEKDAYS_SHORT.map((d, i) => (
          <span key={d} data-weekend={i >= 5 ? "" : undefined}>
            {d}
          </span>
        ))}
      </div>
      <div
        key={animKey}
        className={styles.weeks}
        role="grid"
        aria-label="Month"
        data-dir={dir > 0 ? "next" : dir < 0 ? "prev" : "none"}
        style={{ "--weeks": weeks.length } as CSSProperties}
      >
        {layouts.map((wk, w) => (
          <div
            role="row"
            key={weeks[w][0]}
            className={styles.week}
            style={{ "--lanes": wk.lanes } as CSSProperties}
          >
            {wk.days.map((day, i) => (
              <DayCell
                key={day.iso}
                {...props}
                day={day}
                col={i}
                ghostHere={ghostDay === day.iso}
                cap={capFor(day.singles.length, day.spanCount, day.lanesHere, slots, compact)}
                onKeyDown={(e) => moveFocus(e, day.iso)}
              />
            ))}
            <div className={styles.spanLayer}>
              {wk.segments
                .filter((s) => s.lane < wk.lanes)
                .map((seg) => (
                  <SpanBar key={seg.task.id} seg={seg} week={weeks[w]} {...props} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Slots for lanes, chips and the "+ more" line that fit one week row, from the measured grid height. */
function useRowSlots(gridRef: RefObject<HTMLDivElement | null>, weeks: number) {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setHeight((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef]);
  if (height === null) return null;
  const row = (height - WEEK_HEAD) / weeks;
  return Math.max(2, Math.floor((row - CELL_CHROME) / SLOT));
}

const WEEK_HEAD = 31;
const CELL_CHROME = 26 + 4 + 8;
const SLOT = 22;

function capFor(singles: number, hiddenSpans: number, lanes: number, slots: number | null, compact?: boolean) {
  const max = compact ? 2 : VISIBLE;
  if (slots === null) return max;
  const free = slots - lanes;
  if (hiddenSpans === 0 && singles <= Math.min(free, max)) return max;
  return Math.max(1, Math.min(max, free - 1));
}

type CellProps = Props & {
  day: ReturnType<typeof layoutWeek>["days"][number];
  col: number;
  cap: number;
  ghostHere: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
};

const VISIBLE = 3;

function DayCell(p: CellProps) {
  const { day, ym, drag, pulse, peekDate, focusDay } = p;
  const iso = day.iso;
  const d = parseIso(iso);
  const out = ym ? d.getUTCMonth() !== ym.m : false;
  const isToday = iso === TODAY;
  const dom = dayOfMonth(iso);
  const cap = p.cap;
  const shown = day.singles.slice(0, cap);
  const more = day.singles.length - shown.length + day.spanCount;
  const over = drag?.over === iso;
  const inRange = drag?.range ? iso >= drag.range[0] && iso <= drag.range[1] : false;
  const ghostOpen = day.singles.some((t) => t.id === GHOST_ID);
  const realOpen = day.open - (ghostOpen ? 1 : 0);
  const sentence = loadSentence(realOpen, day.done, day.people);
  const label = [
    longDay(iso) + (isToday ? ", today" : ""),
    sentence,
    ...day.milestones.map((m) => `Milestone: ${m.title}`),
  ].join(". ");

  return (
    <div
      role="gridcell"
      tabIndex={focusDay === iso ? 0 : -1}
      aria-label={label}
      aria-selected={peekDate === iso}
      className={styles.cell}
      data-drop-date={iso}
      data-weekend={p.col >= 5 ? "" : undefined}
      data-out={out ? "" : undefined}
      data-today={isToday ? "" : undefined}
      data-past={iso < TODAY ? "" : undefined}
      data-open={peekDate === iso ? "" : undefined}
      data-over={over ? "" : undefined}
      data-range={inRange ? "" : undefined}
      data-ghost={p.ghostHere ? "" : undefined}
      onClick={(e) => p.onDayOpen(iso, e.currentTarget)}
      onFocus={(e) => {
        if (e.target === e.currentTarget && focusDay !== iso) p.onFocusDay(iso);
      }}
      onKeyDown={p.onKeyDown}
    >
      {pulse && pulse.date === iso ? <span key={pulse.key} className={styles.pulse} aria-hidden /> : null}
      <div className={styles.cellHead}>
        <span className={styles.num} title={sentence}>
          {dom === 1 ? (
            <>
              {dom} <span className={styles.numMonth}>{monthShort(d.getUTCMonth())}</span>
            </>
          ) : (
            dom
          )}
        </span>
        {day.milestones.map((m) => (
          <MilestoneChip key={m.id} task={m} iso={iso} {...p} />
        ))}
      </div>
      <div className={styles.laneSpacer} style={{ "--day-lanes": day.lanesHere } as CSSProperties} aria-hidden />
      <div className={styles.chips}>
        {shown.map((task) => (
          <TaskChip key={task.id} task={task} iso={iso} {...p} />
        ))}
      </div>
      {more > 0 ? (
        <button
          type="button"
          className={styles.more}
          onClick={(e) => {
            e.stopPropagation();
            p.onDayOpen(iso, e.currentTarget.closest<HTMLElement>("[data-drop-date]") ?? e.currentTarget);
          }}
          aria-label={`${plural(more, "more task")} on ${shortDay(iso)}`}
        >
          +{more} more
        </button>
      ) : null}
      <span className={styles.loadWrap} title={sentence}>
        <LoadBar open={realOpen} preview={over && drag?.projected != null ? drag.projected : undefined} />
      </span>
      {over && drag?.projected != null ? (
        <span className={styles.dropNote} aria-hidden>
          {drag.range ? `${Math.round((parseIso(drag.range[1]).getTime() - parseIso(drag.range[0]).getTime()) / 86_400_000) + 1} days` : `${drag.projected} open`}
        </span>
      ) : null}
    </div>
  );
}

function chipLabel(task: Task, iso?: string) {
  const bits = [task.title, PROJECT[task.project].short, STATUS_LABEL[task.status]];
  if (isOverdue(task)) bits.push("overdue");
  if (task.priority === "urgent") bits.push("urgent");
  if (task.priority === "high") bits.push("high priority");
  if (iso) bits.push(shortDay(iso));
  return bits.join(", ");
}

export function TaskChip({ task, iso, ...p }: Props & { task: Task; iso: string }) {
  const ghost = task.id === GHOST_ID;
  const overdue = isOverdue(task);
  return (
    <button
      type="button"
      className={styles.chip}
      style={{ "--p": PROJECT[task.project].color } as CSSProperties}
      data-status={task.status}
      data-overdue={overdue ? "" : undefined}
      data-ghost={ghost ? "" : undefined}
      data-settle={p.settleId === task.id ? "" : undefined}
      data-lifted={p.drag?.id === task.id ? "" : undefined}
      data-priority={task.priority}
      aria-label={ghost ? `New task preview: ${task.title}` : chipLabel(task, iso)}
      tabIndex={ghost ? -1 : 0}
      onPointerDown={ghost ? undefined : (e) => p.onChipDown(e, task, iso)}
      onClick={(e) => {
        e.stopPropagation();
        if (!ghost) p.onChipOpen(task, iso, e.currentTarget.closest<HTMLElement>("[data-drop-date]") ?? e.currentTarget);
      }}
      onPointerEnter={(e) => {
        if (!ghost && e.pointerType === "mouse") p.onChipHover(task, e.currentTarget);
      }}
      onPointerLeave={() => p.onChipHover(null)}
      onKeyDown={(e) => p.onChipKey(e, task)}
    >
      {overdue ? (
        <span className={styles.overdueGlyph}>
          <ClockAlert />
        </span>
      ) : ghost ? (
        <span className={styles.ghostPlus} aria-hidden>
          +
        </span>
      ) : (
        <StatusGlyph status={task.status} />
      )}
      <span className={styles.chipTitle}>{task.title || "New task"}</span>
      {task.priority === "urgent" && !ghost ? <span className={styles.urgent} aria-hidden>!</span> : null}
    </button>
  );
}

function MilestoneChip({ task, iso, ...p }: Props & { task: Task; iso: string }) {
  return (
    <button
      type="button"
      className={styles.milestone}
      style={{ "--p": PROJECT[task.project].color } as CSSProperties}
      data-done={task.status === "done" ? "" : undefined}
      data-ghost={task.id === GHOST_ID ? "" : undefined}
      aria-label={`Milestone: ${task.title}, ${PROJECT[task.project].short}`}
      title={task.title}
      onClick={(e) => {
        e.stopPropagation();
        p.onChipOpen(task, iso, e.currentTarget.closest<HTMLElement>("[data-drop-date]") ?? e.currentTarget);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") p.onChipHover(task, e.currentTarget);
      }}
      onPointerLeave={() => p.onChipHover(null)}
    >
      <Diamond size={9} color="var(--p)" />
      <span>{task.short ?? task.title}</span>
    </button>
  );
}

function SpanBar({ seg, week, ...p }: Props & { seg: Segment; week: string[] }) {
  const { task } = seg;
  const ghost = task.id === GHOST_ID;
  const days = seg.to - seg.from + 1;
  return (
    <button
      type="button"
      className={styles.span}
      style={
        {
          "--p": PROJECT[task.project].color,
          "--from": seg.from,
          "--len": days,
          "--lane": seg.lane,
        } as CSSProperties
      }
      data-clip-left={seg.clippedLeft ? "" : undefined}
      data-clip-right={seg.clippedRight ? "" : undefined}
      data-status={task.status}
      data-ghost={ghost ? "" : undefined}
      data-settle={p.settleId === task.id ? "" : undefined}
      data-lifted={p.drag?.id === task.id ? "" : undefined}
      data-overdue={isOverdue(task) ? "" : undefined}
      aria-label={ghost ? `New task preview: ${task.title}` : `${chipLabel(task)}, ${shortDay(task.start as string)} to ${shortDay(task.end as string)}`}
      tabIndex={ghost ? -1 : 0}
      onPointerDown={
        ghost
          ? undefined
          : (e) => {
              const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n instanceof HTMLElement && n.dataset.dropDate) as HTMLElement | undefined;
              p.onChipDown(e, task, el?.dataset.dropDate ?? week[seg.from]);
            }
      }
      onClick={(e) => {
        e.stopPropagation();
        if (ghost) return;
        const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n instanceof HTMLElement && n.dataset.dropDate) as HTMLElement | undefined;
        p.onChipOpen(task, el?.dataset.dropDate ?? week[seg.from], el ?? e.currentTarget);
      }}
      onPointerEnter={(e) => {
        if (!ghost && e.pointerType === "mouse") p.onChipHover(task, e.currentTarget);
      }}
      onPointerLeave={() => p.onChipHover(null)}
      onKeyDown={(e) => p.onChipKey(e, task)}
    >
      {seg.clippedLeft ? <span className={styles.spanCont} aria-hidden>‹</span> : <StatusGlyph status={task.status} />}
      <span className={styles.chipTitle}>{task.title || "New task"}</span>
      <span className={styles.spanDays} aria-hidden>
        {seg.clippedLeft ? "" : `${dayCount(task)} days`}
      </span>
    </button>
  );
}

function dayCount(task: Task) {
  return Math.round((parseIso(task.end as string).getTime() - parseIso(task.start as string).getTime()) / 86_400_000) + 1;
}

