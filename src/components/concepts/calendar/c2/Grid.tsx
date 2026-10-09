"use client";

import { motion } from "motion/react";
import { useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import {
  CAPACITY,
  CAPACITY_NOTE,
  clock,
  dateOf,
  dayShort,
  dueLabel,
  dur,
  FIXED,
  GRID_END,
  GRID_START,
  meterTone,
  meterWords,
  MILESTONES,
  NOW,
  PROJECT,
  plannedLate,
  TODAY,
  WORK_END,
  WORK_START,
  type Fixed,
  type Plan,
  type Task,
} from "./data";
import { Icon, StatusGlyph } from "./icons";
import { lanes } from "./state";
import s from "./c2.module.css";

export type Preview = { day: number; plan: Plan; over: boolean; id: string } | null;

const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => GRID_START / 60 + i);

/* ── Capacity meter ─────────────────────────────────────────────── */

export function CapacityMeter({
  day,
  planned,
  preview,
  compact,
}: {
  day: number;
  planned: number;
  /** Minutes the dragged task would add. */
  preview: number;
  compact?: boolean;
}) {
  const cap = CAPACITY[day];
  const total = planned + preview;
  const tone = meterTone(total, cap);
  const scale = Math.max(cap, 60);
  const base = Math.min(planned / scale, 1);
  const extra = Math.max(0, Math.min(total / scale, 1) - base);
  const words = meterWords(total, cap);
  const label = preview > 0 ? (tone === "over" ? words : `Would be ${words}`) : tone === "tight" ? `Tight, ${words}` : words;
  return (
    <div className={s.meter} data-tone={tone} data-preview={preview > 0 || undefined} title={CAPACITY_NOTE[day]}>
      <div className={s.meterTrack} aria-hidden>
        <span className={s.meterFill} style={{ width: `${base * 100}%` }} />
        <span className={s.meterAdd} style={{ left: `${base * 100}%`, width: `${extra * 100}%` }} />
      </div>
      {!compact && <span className={s.meterWords}>{label}</span>}
      <span className={s.srOnly}>
        {dayShort(day)}: {dur(total)} planned of {dur(cap)} for tasks. {tone === "over" ? words : ""}
      </span>
    </div>
  );
}

/* ── Day headers and the all-day row ─────────────────────────────── */

export function DayHeads({
  days,
  tasks,
  preview,
  dragId,
  selected,
  onOpenDue,
  dueOpen,
}: {
  days: number[];
  tasks: Task[];
  preview: Preview;
  dragId: string | null;
  selected: Task | null;
  onOpenDue: (day: number | null) => void;
  dueOpen: number | null;
}) {
  return (
    <>
      <div className={s.heads}>
        <div className={s.gutterHead} aria-hidden />
        {days.map((day) => {
          const x = dateOf(day);
          let planned = 0;
          for (const t of tasks) if (t.plan && t.plan.day === day && t.id !== (preview ? dragId : null)) planned += t.plan.dur;
          const add = preview && preview.day === day ? preview.plan.dur : 0;
          return (
            <div key={day} className={s.head} data-today={day === TODAY || undefined} data-past={day < TODAY || undefined}>
              <div className={s.headDay}>
                <span className={s.headDow}>{dayShort(day)}</span>
                <span className={s.headDate}>{x.date}</span>
                {day === TODAY && <span className={s.headToday}>Today</span>}
              </div>
              <CapacityMeter day={day} planned={planned} preview={add} />
            </div>
          );
        })}
      </div>
      <div className={s.allDay}>
        <div className={s.gutterHead}>
          <span className={s.allDayLabel}>Due</span>
        </div>
        {days.map((day) => {
          const due = tasks.filter((t) => t.due === day && t.status !== "done");
          const ms = MILESTONES.filter((m) => m.day === day);
          const mine = selected && selected.due === day;
          return (
            <div key={day} className={s.allDayCell}>
              {ms.map((m) => (
                <span key={m.id} className={s.milestone} style={{ background: PROJECT[m.project].color }}>
                  <span className={s.milestoneDiamond} aria-hidden />
                  {m.title}
                </span>
              ))}
              {mine && (
                <motion.span
                  layoutId="dueFlag"
                  className={s.dueMine}
                  data-late={plannedLate(selected) || undefined}
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                >
                  <Icon.flag size={12} />
                  <span>Due here</span>
                </motion.span>
              )}
              {due.length > 0 && !mine && (
                <button
                  type="button"
                  className={s.dueChip}
                  aria-expanded={dueOpen === day}
                  onClick={() => onOpenDue(dueOpen === day ? null : day)}
                  data-late={due.some((t) => plannedLate(t) || !t.plan) || undefined}
                >
                  <Icon.flag size={12} />
                  {due.length} due
                </button>
              )}
              {dueOpen === day && <DuePopover day={day} tasks={due} end={day >= 3} onClose={() => onOpenDue(null)} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

function DuePopover({ day, tasks, end, onClose }: { day: number; tasks: Task[]; end: boolean; onClose: () => void }) {
  return (
    <motion.div
      className={s.duePop}
      data-end={end || undefined}
      role="dialog"
      aria-label={`Due ${dayShort(day)}`}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16 }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className={s.duePopHead}>
        <strong>Due {dayShort(day)} {dateOf(day).date} {dateOf(day).month}</strong>
        <button type="button" className={s.iconBtn} aria-label="Close" onClick={onClose}>
          <Icon.x size={14} />
        </button>
      </div>
      <ul className={s.duePopList}>
        {tasks.map((t) => {
          const late = plannedLate(t);
          return (
            <li key={t.id}>
              <span className={s.dot} style={{ background: PROJECT[t.project].color }} aria-hidden />
              <span className={s.duePopTitle}>{t.title}</span>
              <span className={s.duePopWhen} data-tone={late ? "late" : t.plan ? "ok" : "none"}>
                {late ? `Planned ${dayShort(t.plan!.day)}, after it is due` : t.plan ? `${dayShort(t.plan.day)} ${clock(t.plan.start)}` : "Not planned yet"}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

/* ── Blocks ──────────────────────────────────────────────────────── */

export function TimeBlock({
  task,
  hour,
  lane,
  selected,
  fresh,
  dragging,
  onPointerDown,
  onToggleDone,
  onOpen,
}: {
  task: Task;
  hour: number;
  lane: { lane: number; of: number };
  selected: boolean;
  fresh: boolean;
  dragging: boolean;
  onPointerDown?: (e: RPointerEvent, mode: "move" | "resize") => void;
  onToggleDone: () => void;
  onOpen: () => void;
}) {
  const plan = task.plan!;
  const top = ((plan.start - GRID_START) / 60) * hour;
  const height = Math.max((plan.dur / 60) * hour - 2, 12);
  const late = plannedLate(task);
  const size = plan.dur <= 15 ? "xs" : plan.dur <= 30 ? "s" : plan.dur < 60 ? "m" : "l";
  const project = PROJECT[task.project];
  const past = plan.day < TODAY || (plan.day === TODAY && plan.start + plan.dur <= NOW);
  const missed = past && task.status !== "done";
  return (
    <motion.div
      className={s.block}
      data-size={size}
      data-status={task.status}
      data-late={late || undefined}
      data-missed={missed || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      style={
        {
          top,
          height,
          left: `calc(${(lane.lane / lane.of) * 100}% + 2px)`,
          width: `calc(${100 / lane.of}% - 6px)`,
          "--p": project.color,
        } as CSSProperties
      }
      initial={fresh ? { opacity: 0, scale: 0.94, y: -6 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      onPointerDown={(e) => onPointerDown?.(e, "move")}
      onClick={onPointerDown ? undefined : onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${task.title}, ${dayShort(plan.day)} ${clock(plan.start)} to ${clock(plan.start + plan.dur)}${task.status === "done" ? ", done" : ""}${late ? ", planned after it is due" : ""}`}
    >
      {fresh && <span className={s.blockFlash} aria-hidden />}
      <div className={s.blockRow}>
        <button
          type="button"
          className={s.blockGlyph}
          aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
        >
          <StatusGlyph status={task.status} size={size === "xs" ? 11 : 13} />
        </button>
        <span className={s.blockTitle}>{task.title}</span>
        {size === "s" && <span className={s.blockTimeInline}>{dur(plan.dur)}</span>}
        {late && size !== "l" && size !== "m" && <Icon.alert size={12} className={s.blockWarnIcon} />}
      </div>
      {(size === "l" || size === "m") && !late && (
        <div className={s.blockMeta}>
          {clock(plan.start)} to {clock(plan.start + plan.dur)}
          <span aria-hidden> · </span>
          {dur(plan.dur)}
        </div>
      )}
      {late && (size === "l" || size === "m") && (
        <div className={s.blockLate}>
          <Icon.alert size={11} />
          Planned after it is due
        </div>
      )}
      {missed && size === "l" && plan.dur >= 90 && !late && <div className={s.blockMissed}>Not done yet</div>}
      {onPointerDown && task.status !== "done" && (
        <span
          className={s.resize}
          aria-hidden
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, "resize");
          }}
        />
      )}
    </motion.div>
  );
}

function FixedEvent({ ev, hour, lane }: { ev: Fixed; hour: number; lane: { lane: number; of: number } }) {
  const top = ((ev.start - GRID_START) / 60) * hour;
  const height = Math.max((ev.dur / 60) * hour - 2, 11);
  return (
    <div
      className={s.fixed}
      data-personal={ev.personal || undefined}
      data-size={ev.dur <= 15 ? "xs" : ev.dur <= 30 ? "s" : "l"}
      style={{ top, height, left: `calc(${(lane.lane / lane.of) * 100}% + 2px)`, width: `calc(${100 / lane.of}% - 6px)` }}
      title={`${ev.title}, ${clock(ev.start)} to ${clock(ev.start + ev.dur)}. ${ev.personal ? "Personal time" : "Fixed, from your calendar"}`}
    >
      <div className={s.fixedRow}>
        {ev.personal ? <Icon.moon size={11} /> : <Icon.lock size={11} />}
        <span className={s.fixedTitle}>{ev.title}</span>
        {ev.dur <= 30 && <span className={s.fixedTime}>{clock(ev.start)}</span>}
      </div>
      {ev.dur > 30 && (
        <div className={s.fixedMeta}>
          {clock(ev.start)} to {clock(ev.start + ev.dur)}
          {ev.where ? ` · ${ev.where}` : ""}
        </div>
      )}
    </div>
  );
}

/* ── The grid ────────────────────────────────────────────────────── */

export function TimeGrid({
  days,
  tasks,
  hour,
  selectedId,
  fresh,
  preview,
  dragId,
  armed,
  colRef,
  onBlockPointerDown,
  onToggleDone,
  onSelect,
  onSlot,
}: {
  days: number[];
  tasks: Task[];
  hour: number;
  selectedId: string | null;
  fresh: string[];
  preview: Preview;
  dragId: string | null;
  /** A tray task waiting for a click on a time. */
  armed: Task | null;
  colRef?: (day: number, el: HTMLDivElement | null) => void;
  onBlockPointerDown?: (e: RPointerEvent, id: string, mode: "move" | "resize") => void;
  onToggleDone: (id: string) => void;
  onSelect: (id: string) => void;
  onSlot: (day: number, start: number) => void;
}) {
  const [hover, setHover] = useState<{ day: number; start: number } | null>(null);
  const height = ((GRID_END - GRID_START) / 60) * hour;
  const pos = (m: number) => ((m - GRID_START) / 60) * hour;

  const slotAt = (e: RPointerEvent<HTMLDivElement>, length: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const m = GRID_START + ((e.clientY - rect.top) / rect.height) * (GRID_END - GRID_START);
    const snapped = Math.round((m - length / 2) / 15) * 15;
    return Math.max(GRID_START, Math.min(GRID_END - length, snapped));
  };

  return (
    <div className={s.gridBody} style={{ height, "--hour": `${hour}px` } as CSSProperties}>
      <div className={s.gutter} aria-hidden>
        {HOURS.map((hh) => (
          <span key={hh} className={s.hourLabel} style={{ top: pos(hh * 60) }}>
            {hh}:00
          </span>
        ))}
        {days.includes(TODAY) && (
          <span className={s.nowLabel} style={{ top: pos(NOW) }}>
            {clock(NOW)}
          </span>
        )}
      </div>
      {days.map((day) => {
        const items = [
          ...FIXED.filter((f) => f.day === day).map((f) => ({ key: f.id, start: f.start, end: f.start + f.dur })),
          ...tasks
            .filter((t) => t.plan && t.plan.day === day)
            .map((t) => ({ key: t.id, start: t.plan!.start, end: t.plan!.start + t.plan!.dur })),
        ];
        const lay = lanes(items);
        const workEnd = day === 4 ? 16 * 60 + 30 : WORK_END;
        const off = day > 4;
        const ghost = preview && preview.day === day ? preview.plan : null;
        const hoverGhost = armed && hover && hover.day === day ? hover.start : null;
        return (
          <div
            key={day}
            className={s.col}
            data-today={day === TODAY || undefined}
            data-past={day < TODAY || undefined}
            data-armed={armed ? true : undefined}
            ref={colRef ? (el) => colRef(day, el) : undefined}
            onPointerMove={armed ? (e) => setHover({ day, start: slotAt(e, armed.estimate) }) : undefined}
            onPointerLeave={armed ? () => setHover(null) : undefined}
            onClick={(e) => {
              if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.slot) return;
              if (armed) onSlot(day, slotAt(e as unknown as RPointerEvent<HTMLDivElement>, armed.estimate));
            }}
          >
            {!off && <div className={s.offHours} style={{ top: 0, height: pos(WORK_START - 15) }} data-slot aria-hidden />}
            {!off && <div className={s.offHours} style={{ top: pos(workEnd), height: height - pos(workEnd) }} data-slot aria-hidden />}
            {off && <div className={s.offHours} style={{ top: 0, height }} data-slot aria-hidden />}
            {day === TODAY && <div className={s.pastShade} style={{ height: pos(NOW) }} data-slot aria-hidden />}
            {HOURS.slice(0, -1).map((hh) => (
              <div key={hh} className={s.hourLine} style={{ top: pos(hh * 60) }} data-slot aria-hidden />
            ))}
            {FIXED.filter((f) => f.day === day).map((f) => (
              <FixedEvent key={f.id} ev={f} hour={hour} lane={lay.get(f.id) ?? { lane: 0, of: 1 }} />
            ))}
            {tasks
              .filter((t) => t.plan && t.plan.day === day)
              .map((t) => (
                <TimeBlock
                  key={t.id}
                  task={t}
                  hour={hour}
                  lane={lay.get(t.id) ?? { lane: 0, of: 1 }}
                  selected={selectedId === t.id}
                  fresh={fresh.includes(t.id)}
                  dragging={dragId === t.id}
                  onPointerDown={onBlockPointerDown ? (e, mode) => onBlockPointerDown(e, t.id, mode) : undefined}
                  onToggleDone={() => onToggleDone(t.id)}
                  onOpen={() => onSelect(t.id)}
                />
              ))}
            {ghost && (
              <div
                className={s.ghost}
                data-over={preview?.over || undefined}
                style={{ top: pos(ghost.start), height: Math.max((ghost.dur / 60) * hour - 2, 12) }}
                aria-hidden
              >
                <span>
                  {clock(ghost.start)} to {clock(ghost.start + ghost.dur)}
                </span>
              </div>
            )}
            {hoverGhost !== null && armed && (
              <div
                className={s.ghost}
                style={{ top: pos(hoverGhost), height: Math.max((armed.estimate / 60) * hour - 2, 12) }}
                aria-hidden
              >
                <span>
                  {clock(hoverGhost)} to {clock(hoverGhost + armed.estimate)}
                </span>
              </div>
            )}
            {day === TODAY && (
              <div className={s.nowLine} style={{ top: pos(NOW) }} aria-hidden>
                <span className={s.nowDot} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { dueLabel };
