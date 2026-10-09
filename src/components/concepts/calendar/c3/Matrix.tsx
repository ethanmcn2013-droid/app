"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Person, Project, Task } from "./data";
import { TODAY } from "./data";
import {
  LEVEL_WORD,
  available,
  cellKey,
  dayKind,
  dayNum,
  hrs,
  isPast,
  isWeekend,
  levelOf,
  personTotal,
  shortDate,
  spanLabel,
  wd,
  weekSummary,
  type Cell,
  type LoadMap,
  type Suggestion,
} from "./model";
import { Avatar, Num, SuggestionCard, tagOf } from "./Bits";
import { Icon } from "./icons";
import type { Selected } from "./index";
import styles from "./c3.module.css";

type Density = "roomy" | "compact" | "dense";
type Flash = { keys: string[]; at: number } | null;

const HEAD_WEEKS = 30;
const HEAD_DAYS = 46;
const HEAD_LANE = 30;

/* ── Drag: pointer based so it works with mouse, pen and touch ────── */

type DragState = { task: Task; x: number; y: number; overKey: string | null };

function useTaskDrag(onDrop: (task: Task, key: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const live = useRef<{ task: Task; sx: number; sy: number; started: boolean; overKey: string | null } | null>(null);
  const ghost = useRef<HTMLDivElement | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = useCallback(
    (e: RPointerEvent, task: Task) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      live.current = { task, sx: e.clientX, sy: e.clientY, started: false, overKey: null };

      const move = (ev: PointerEvent) => {
        const s = live.current;
        if (!s) return;
        if (!s.started) {
          if (Math.hypot(ev.clientX - s.sx, ev.clientY - s.sy) < 5) return;
          s.started = true;
          document.body.style.cursor = "grabbing";
          setDrag({ task: s.task, x: ev.clientX, y: ev.clientY, overKey: null });
        }
        if (ghost.current) ghost.current.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-cell]");
        const key = hit?.dataset.cell ?? null;
        if (key !== s.overKey) {
          s.overKey = key;
          setDrag((d) => (d ? { ...d, overKey: key } : d));
        }
      };
      const end = (commit: boolean) => {
        const s = live.current;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", esc, true);
        document.body.style.cursor = "";
        live.current = null;
        if (s?.started) {
          suppressClick.current = true;
          setTimeout(() => (suppressClick.current = false), 0);
          setDrag(null);
          if (commit && s.overKey) onDrop(s.task, s.overKey);
        }
      };
      const up = () => end(true);
      const cancel = () => end(false);
      const esc = (ev: KeyboardEvent | globalThis.KeyboardEvent) => {
        if (ev.key === "Escape") {
          ev.stopPropagation();
          end(false);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", esc, true);
    },
    [onDrop],
  );

  return { drag, ghost, onPointerDown, suppressClick };
}

/* ── Matrix ───────────────────────────────────────────────────────── */

export function LoadMatrix({
  project,
  tasks,
  load,
  days,
  range,
  suggestions,
  focusId,
  onFocus,
  selected,
  onSelect,
  onMove,
  onApply,
  flash,
}: {
  project: Project;
  tasks: Task[];
  load: LoadMap;
  days: string[];
  range: 2 | 4 | 6;
  suggestions: Suggestion[];
  focusId: string | null;
  onFocus: (id: string | null) => void;
  selected: Selected;
  onSelect: (s: Selected) => void;
  onMove: (taskId: string, to: { personId: string | null; date: string }) => void;
  onApply: (s: Suggestion) => void;
  flash: Flash;
}) {
  const density: Density = range === 2 ? "roomy" : range === 4 ? "compact" : "dense";
  const rows: (Person | null)[] = [...project.people, null];
  const gridRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(() => cellKey(project.people[0]?.id ?? null, days.includes(TODAY) ? TODAY : days[0]));
  const [hover, setHover] = useState<{ s: Suggestion; x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestionFor = new Map(suggestions.filter((s) => s.kind !== "unassigned").map((s) => [cellKey(s.from.personId, s.from.date), s]));

  const handleDrop = useCallback(
    (task: Task, key: string) => {
      const [pid, date] = key.split("|");
      const personId = pid === "none" ? null : pid;
      if (key === "total") return;
      onMove(task.id, { personId, date });
    },
    [onMove],
  );
  const { drag, ghost, onPointerDown, suppressClick } = useTaskDrag(handleDrop);

  const colTemplate = days
    .map((d) => (isWeekend(d) ? `minmax(${density === "roomy" ? 38 : density === "compact" ? 18 : 15}px, 0.5fr)` : `minmax(${density === "roomy" ? 70 : density === "compact" ? 33 : 24}px, 1fr)`))
    .join(" ");
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `var(--c3-name-w) ${colTemplate}`,
    gridTemplateRows: `${HEAD_WEEKS}px ${HEAD_DAYS}px ${HEAD_LANE}px repeat(${rows.length}, auto) auto`,
  };

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const col = (d: string) => days.indexOf(d) + 2;
  const rowOf = (i: number) => i + 4;
  const totalRow = rows.length + 4;

  /* Keyboard: arrows move between cells, Enter opens the panel. */
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const key = target.dataset.cell;
    if (!key || key === "total") return;
    const [pid, date] = key.split("|");
    const r = rows.findIndex((p) => (p?.id ?? "none") === pid);
    const c = days.indexOf(date);
    let nr = r;
    let nc = c;
    if (e.key === "ArrowRight") nc = Math.min(days.length - 1, c + 1);
    else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
    else if (e.key === "ArrowDown") nr = Math.min(rows.length - 1, r + 1);
    else if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
    else if (e.key === "Home") nc = 0;
    else if (e.key === "End") nc = days.length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect({ personId: pid === "none" ? null : pid, date });
      return;
    } else return;
    e.preventDefault();
    const next = cellKey(rows[nr]?.id ?? null, days[nc]);
    setActive(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus();
  };

  const showHover = (s: Suggestion | undefined, el: HTMLElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!s || drag) return;
    hoverTimer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setHover({ s, x: Math.min(window.innerWidth - 176, Math.max(176, r.left + r.width / 2)), y: Math.min(window.innerHeight - 170, r.bottom + 6) });
    }, 380);
  };
  const hideHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 160);
  };
  const keepHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const selKey = selected ? cellKey(selected.personId, selected.date) : null;
  useEffect(() => {
    if (!selKey) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${selKey}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selKey]);

  const activeKey = days.some((d) => active.endsWith(d)) ? active : cellKey(project.people[0]?.id ?? null, days[0]);
  const dragTarget = drag?.overKey && drag.overKey !== "total" ? load.get(drag.overKey) : undefined;
  const dragFrom = drag ? cellKey(drag.task.personId, drag.task.date) : null;

  return (
    <div className={styles.matrixScroll} data-dragging={drag ? "" : undefined}>
      <div
        ref={gridRef}
        className={styles.matrix}
        style={gridStyle}
        data-density={density}
        data-focus={focusId ? "" : undefined}
        role="grid"
        aria-label={`Team load for ${project.name}, ${spanLabel(days[0], days[days.length - 1])}`}
        aria-rowcount={rows.length + 2}
        onKeyDown={onGridKey}
      >
        {/* Corner */}
        <div className={styles.corner} style={{ gridRow: "1 / 4", gridColumn: 1 }}>
          <span className={styles.cornerLabel}>People</span>
          <span className={styles.cornerHint}>Key dates</span>
        </div>

        {/* Week spans */}
        {weeks.map((w, i) => {
          const sum = weekSummary(project, load, w);
          const calm = sum.over === 0 && sum.full === 0;
          return (
            <div key={w[0]} className={styles.weekHead} style={{ gridRow: 1, gridColumn: `${i * 7 + 2} / span 7` }}>
              <span className={styles.weekSpan}>{spanLabel(w[0], w[6])}</span>
              {calm ? (
                <span className={styles.weekCalm} title="Everyone has room this week.">
                  <Icon.check size={12} />
                  {density === "roomy" ? "Everyone has room this week." : density === "compact" ? "Everyone has room" : "Room for all"}
                </span>
              ) : sum.over > 0 ? (
                <span className={styles.weekOver}>
                  <Icon.over size={12} />
                  {sum.over} {sum.over === 1 ? "day" : "days"} over
                </span>
              ) : (
                <span className={styles.weekFull}>
                  {sum.full} full {sum.full === 1 ? "day" : "days"}
                </span>
              )}
            </div>
          );
        })}

        {/* Days */}
        {days.map((d) => {
          const today = d === TODAY;
          return (
            <div
              key={d}
              role="columnheader"
              className={styles.dayHead}
              data-today={today || undefined}
              data-weekend={isWeekend(d) || undefined}
              data-past={isPast(d) || undefined}
              style={{ gridRow: 2, gridColumn: col(d) }}
              aria-label={`${shortDate(d)}${today ? ", today" : ""}`}
            >
              <span className={styles.dayWd}>{density === "dense" || (density === "compact" && isWeekend(d)) ? wd(d).slice(0, 1) : wd(d)}</span>
              <span className={styles.dayNum}>{dayNum(d)}</span>
            </div>
          );
        })}

        {/* Key dates lane */}
        <div className={styles.laneBg} style={{ gridRow: 3, gridColumn: `2 / ${days.length + 2}` }} />
        {project.milestones
          .filter((m) => days.includes(m.date))
          .map((m, i, list) => {
            const idx = days.indexOf(m.date);
            const next = list[i + 1] ? days.indexOf(list[i + 1].date) : days.length + 3;
            const room = density === "roomy" ? 1 : density === "compact" ? 3 : 4;
            const iconOnly = next - idx < room;
            const nearEnd = days.length - idx <= room;
            return { m, iconOnly, nearEnd };
          })
          .map(({ m, iconOnly, nearEnd }) => (
            <div
              key={m.date + m.label}
              className={styles.milestone}
              data-kind={m.kind}
              data-end={nearEnd || undefined}
              style={{ gridRow: 3, gridColumn: nearEnd ? `${col(m.date)} / ${days.length + 2}` : col(m.date) }}
            >
              <span className={styles.milestoneChip} data-icon-only={iconOnly || undefined} title={`${m.label} · ${shortDate(m.date)}`} aria-label={`${m.label}, ${shortDate(m.date)}`}>
                {m.kind === "deadline" ? <Icon.flag size={12} /> : m.kind === "event" ? <Icon.star size={12} /> : <Icon.diamond size={12} />}
                <span className={styles.milestoneText}>{m.label}</span>
              </span>
            </div>
          ))}
        {project.milestones
          .filter((m) => days.includes(m.date))
          .map((m) => (
            <div key={`line${m.date}`} className={styles.milestoneLine} data-kind={m.kind} style={{ gridRow: `4 / ${totalRow}`, gridColumn: col(m.date) }} aria-hidden="true" />
          ))}

        {/* Today column */}
        {days.includes(TODAY) && <div className={styles.todayCol} style={{ gridRow: `2 / ${totalRow + 1}`, gridColumn: col(TODAY) }} aria-hidden="true" />}

        {/* People rows */}
        {rows.map((p, i) => {
          const pid = p?.id ?? null;
          const dim = focusId !== null && focusId !== pid;
          const focused = focusId !== null && focusId === pid;
          const total = personTotal(pid, load, days);
          const hasAny = total.hours > 0;
          const away = p?.away && p.away.to >= days[0] && p.away.from <= days[days.length - 1] ? p.away : null;
          const awayFrom = away ? (away.from < days[0] ? days[0] : away.from) : null;
          const awayTo = away ? (away.to > days[days.length - 1] ? days[days.length - 1] : away.to) : null;
          const awayTasks = away ? tasks.filter((t) => t.personId === pid && t.date >= away.from && t.date <= away.to) : [];
          const firstOffRun = p && !hasAny ? offRun(p, days) : null;

          return (
            <div key={pid ?? "none"} role="row" className={styles.rowGroup} data-dim={dim || undefined} data-focused={focused || undefined}>
              <PersonName
                person={p}
                row={rowOf(i)}
                total={total}
                range={range}
                unassignedCount={p ? 0 : days.reduce((s, d) => s + (load.get(cellKey(null, d))?.tasks.length ?? 0), 0)}
                focused={focused}
                onFocus={() => pid && onFocus(pid)}
              />
              {away && awayFrom && awayTo && p && (
                <AwayBand person={p} row={rowOf(i)} colFrom={col(awayFrom)} colTo={col(awayTo)} count={awayTasks.length} note={away.note} density={density} />
              )}
              {firstOffRun && p && (
                <div className={styles.emptyNote} style={{ gridRow: rowOf(i), gridColumn: `${col(firstOffRun[0])} / span ${firstOffRun.length}` }}>
                  <span>
                    Nothing on {p.first} yet.
                    {density === "roomy" && <span className={styles.emptyNoteSub}> {p.pattern}.</span>}
                  </span>
                </div>
              )}
              {days.map((d) => {
                const key = cellKey(pid, d);
                const cell = load.get(key)!;
                const s = suggestionFor.get(key);
                return (
                  <LoadCell
                    key={key}
                    cellId={key}
                    cell={cell}
                    person={p}
                    row={rowOf(i)}
                    col={col(d)}
                    density={focused ? "focus" : density}
                    active={activeKey === key}
                    selected={selected?.personId === pid && selected?.date === d}
                    flashAt={flash?.keys.includes(key) ? flash.at : null}
                    suggestion={s}
                    dropState={drag ? (drag.overKey === key ? (key === dragFrom ? "same" : "target") : key === dragFrom ? "source" : null) : null}
                    draggingId={drag?.task.id ?? null}
                    onBarDown={onPointerDown}
                    onClick={() => {
                      if (suppressClick.current) return;
                      setActive(key);
                      onSelect({ personId: pid, date: d });
                    }}
                    onEnter={(el) => showHover(s, el)}
                    onLeave={hideHover}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Team total */}
        <div role="row" className={styles.rowGroup}>
          <div className={styles.totalName} style={{ gridRow: totalRow, gridColumn: 1 }} role="rowheader">
            <span className={styles.totalIcon}>
              <Icon.users size={14} />
            </span>
            <span className={styles.nameText}>
              <span className={styles.name}>Team total</span>
              <span className={styles.role}>
                {hrs(teamSum(project, load, days).hours)} of {hrs(teamSum(project, load, days).avail)}
              </span>
            </span>
          </div>
          {days.map((d) => {
            const t = teamSum(project, load, [d]);
            const lvl = t.avail === 0 ? (t.hours > 0 ? "over" : "none") : levelOf(t.hours, t.avail);
            return (
              <div
                key={d}
                role="gridcell"
                className={styles.totalCell}
                data-level={lvl}
                data-weekend={isWeekend(d) || undefined}
                style={{ gridRow: totalRow, gridColumn: col(d) }}
                aria-label={`Team total ${shortDate(d)}: ${hrs(t.hours)} of ${hrs(t.avail)}`}
              >
                {t.hours > 0 ? (
                  <>
                    <span className={styles.totalNum}>
                      {density === "dense" || (isWeekend(d) && density !== "roomy") ? Math.round(t.hours) : <Num value={t.hours} />}
                    </span>
                    {density === "roomy" && t.avail > 0 && <span className={styles.totalOf}>of {hrs(t.avail)}</span>}
                    {t.avail > 0 && (
                      <span className={styles.totalMeter} aria-hidden="true">
                        <span style={{ width: `${Math.min(100, (t.hours / t.avail) * 100)}%` }} />
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.totalZero} aria-hidden="true">
                    –
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag ghost with a preview of where the work lands */}
      {drag && (
        <div ref={ghost} className={styles.ghost} style={{ transform: `translate(${drag.x + 14}px, ${drag.y + 12}px)` }} aria-hidden="true">
          <DragGhost task={drag.task} project={project} target={dragTarget} same={drag.overKey === dragFrom} />
        </div>
      )}

      {/* Hover idea for over cells */}
      <AnimatePresence>
        {hover && !drag && (
          <motion.div
            key={hover.s.id}
            className={styles.hoverCard}
            style={{ left: hover.x, top: hover.y }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            onPointerEnter={keepHover}
            onPointerLeave={hideHover}
          >
            <SuggestionCard
              s={hover.s}
              project={project}
              compact
              onApply={() => {
                onApply(hover.s);
                setHover(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function teamSum(project: Project, load: LoadMap, days: string[]) {
  let hours = 0;
  let avail = 0;
  for (const d of days) {
    for (const p of project.people) {
      const c = load.get(cellKey(p.id, d));
      if (c) {
        hours += c.hours;
        avail += c.avail;
      }
    }
  }
  return { hours, avail };
}

/** Longest run of 3+ consecutive days the person is not working, for an empty-row note. */
function offRun(p: Person, days: string[]) {
  let best: string[] = [];
  let run: string[] = [];
  for (const d of days) {
    if (available(p, d) === 0) {
      run.push(d);
      if (run.length > best.length) best = run.slice();
    } else run = [];
  }
  return best.length >= 3 ? best : null;
}

/* ── Person name cell ─────────────────────────────────────────────── */

function PersonName({
  person,
  row,
  total,
  range,
  unassignedCount,
  focused,
  onFocus,
}: {
  person: Person | null;
  row: number;
  total: { hours: number; avail: number; over: number };
  range: number;
  unassignedCount: number;
  focused: boolean;
  onFocus: () => void;
}) {
  if (!person) {
    return (
      <div className={styles.nameCell} data-unassigned="" style={{ gridRow: row, gridColumn: 1 }} role="rowheader">
        <span className={styles.unassignedIcon}>
          <Icon.inbox size={14} />
        </span>
        <span className={styles.nameText}>
          <span className={styles.name}>Unassigned</span>
          <span className={styles.role}>
            {unassignedCount === 0 ? "Nothing waiting" : `${unassignedCount} waiting for someone`}
          </span>
          {unassignedCount > 0 && range === 2 && <span className={styles.nameHint}>Drag one onto a person</span>}
        </span>
      </div>
    );
  }
  return (
    <div className={styles.nameCell} style={{ gridRow: row, gridColumn: 1 }} role="rowheader">
      <button
        type="button"
        className={styles.nameBtn}
        onClick={onFocus}
        aria-pressed={focused}
        title={focused ? "Show everyone" : `Show only ${person.first}`}
      >
        <Avatar person={person} />
        <span className={styles.nameText}>
          <span className={styles.name}>
            {person.first}
            {person.guest && <span className={styles.guest}>Guest</span>}
            {total.over > 0 && (
              <span className={styles.personOver} title={`${total.over} ${total.over === 1 ? "day" : "days"} over`}>
                <Icon.over size={11} />
                {total.over} over
              </span>
            )}
          </span>
          <span className={styles.role}>{person.role}</span>
          <span className={styles.personTotal} data-over={total.over > 0 || undefined}>
            {total.hours === 0 ? (
              <>Nothing yet</>
            ) : (
              <>
                {hrs(total.hours)} over {range} weeks
              </>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

/* ── Away band ────────────────────────────────────────────────────── */

function AwayBand({
  person,
  row,
  colFrom,
  colTo,
  count,
  note,
  density,
}: {
  person: Person;
  row: number;
  colFrom: number;
  colTo: number;
  count: number;
  note: string;
  density: Density;
}) {
  return (
    <div className={styles.awayBand} title={`${person.first} is away · ${note}`} style={{ gridRow: row, gridColumn: `${colFrom} / ${colTo + 1}` }}>
      <span className={styles.awayLabel}>
        <Icon.plane size={12} />
        Away{density === "roomy" && <span className={styles.awayNote}> · {note}</span>}
      </span>
      {count > 0 && (
        <span className={styles.awayWarn}>
          <Icon.over size={11} />
          {person.first} is away
          {density === "roomy" && <span> · {count} {count === 1 ? "task" : "tasks"} still assigned</span>}
        </span>
      )}
    </div>
  );
}

/* ── One day for one person ───────────────────────────────────────── */

function LoadCell({
  cellId,
  cell,
  person,
  row,
  col,
  density,
  active,
  selected,
  flashAt,
  suggestion,
  dropState,
  draggingId,
  onBarDown,
  onClick,
  onEnter,
  onLeave,
}: {
  cellId: string;
  cell: Cell;
  person: Person | null;
  row: number;
  col: number;
  density: Density | "focus";
  active: boolean;
  selected: boolean;
  flashAt: number | null;
  suggestion?: Suggestion;
  dropState: "target" | "source" | "same" | null;
  draggingId: string | null;
  onBarDown: (e: RPointerEvent, t: Task) => void;
  onClick: () => void;
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
}) {
  const unassigned = !person;
  const kind = person ? dayKind(person, cell.date) : "work";
  const off = person && cell.avail === 0 && cell.tasks.length === 0;
  const over = cell.level === "over";
  const overBy = cell.hours - cell.avail;
  const pct = cell.avail > 0 ? Math.min(100, (cell.hours / cell.avail) * 100) : cell.hours > 0 ? 100 : 0;
  const visible = density === "focus" ? cell.tasks : density === "roomy" ? cell.tasks.slice(0, 2) : density === "compact" ? cell.tasks.slice(0, 3) : [];
  const more = cell.tasks.length - visible.length;

  const label = person
    ? `${person.first}, ${shortDate(cell.date)}: ${
        cell.avail === 0 && cell.hours === 0
          ? kind === "away"
            ? "away"
            : "not working"
          : `${hrs(cell.hours)} of ${hrs(cell.avail)}, ${kind === "away" ? "away" : LEVEL_WORD[cell.level]}`
      }${cell.tasks.length ? `, ${cell.tasks.length} ${cell.tasks.length === 1 ? "task" : "tasks"}` : ""}`
    : `Unassigned, ${shortDate(cell.date)}: ${cell.tasks.length} ${cell.tasks.length === 1 ? "task" : "tasks"}`;

  return (
    <div
      role="gridcell"
      tabIndex={active ? 0 : -1}
      data-cell={cellId}
      className={styles.cell}
      data-level={unassigned ? (cell.tasks.length ? "waiting" : "none") : off ? "off" : cell.level}
      data-kind={kind}
      data-weekend={isWeekend(cell.date) || undefined}
      data-past={isPast(cell.date) || undefined}
      data-selected={selected || undefined}
      data-drop={dropState ?? undefined}
      data-density={density}
      style={{ gridRow: row, gridColumn: col }}
      aria-label={label}
      aria-selected={selected}
      onClick={onClick}
      onPointerEnter={(e) => over && onEnter(e.currentTarget)}
      onPointerLeave={onLeave}
    >
      {flashAt !== null && <span key={flashAt} className={styles.flash} aria-hidden="true" />}
      {off ? (
        density === "roomy" && !isWeekend(cell.date) && kind !== "away" && person && person.days.length >= 4 ? <span className={styles.offText}>Off</span> : null
      ) : (
        <>
          <span className={styles.cellTop}>
            {cell.hours > 0 || cell.avail > 0 ? (
              <span className={styles.cellNum}>
                {over && kind !== "away" && (density === "roomy" || density === "focus") && <Icon.over size={11} className={styles.overIcon} />}
                {cell.hours > 0 ? density === "dense" ? Math.round(cell.hours * 10) / 10 : <Num value={cell.hours} /> : density === "roomy" || density === "focus" ? <span className={styles.freeText}>{hrs(cell.avail)} free</span> : null}
              </span>
            ) : null}
            {(density === "roomy" || density === "focus") && cell.hours > 0 && !unassigned && kind !== "away" && (
              <span className={styles.cellOf}>
                {over ? (cell.avail === 0 ? "day off" : `+${hrs(overBy)}`) : `of ${hrs(cell.avail)}`}
              </span>
            )}
            {over && kind !== "away" && density !== "roomy" && density !== "focus" && (
              <span className={styles.overCorner} aria-hidden="true">
                <Icon.over size={8} />
              </span>
            )}
            {suggestion && (density === "roomy" || density === "focus") && (
              <span className={styles.sparkDot} aria-hidden="true" title="There's an idea to even this out">
                <Icon.spark size={10} />
              </span>
            )}
          </span>
          {visible.length > 0 && (
            <span className={styles.bars} data-density={density}>
              {visible.map((t) => (
                <TaskBar key={t.id} task={t} density={density} lifted={draggingId === t.id} onDown={onBarDown} />
              ))}
              {more > 0 && density !== "compact" && <span className={styles.more}>+{more} more</span>}
            </span>
          )}
          {!unassigned && cell.avail > 0 && (
            <span className={styles.meter} aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          )}
        </>
      )}
    </div>
  );
}

function TaskBar({ task, density, lifted, onDown }: { task: Task; density: Density | "focus"; lifted: boolean; onDown: (e: RPointerEvent, t: Task) => void }) {
  const style = { "--tag": `var(--v3-project-${tagOf(task.tag)})`, "--h": task.hours } as CSSProperties;
  if (density === "compact" || density === "dense") {
    return <span className={styles.sliver} style={style} data-lifted={lifted || undefined} onPointerDown={(e) => onDown(e, task)} title={`${task.title} · ${hrs(task.hours)}. Drag to move.`} />;
  }
  return (
    <span className={styles.bar} style={style} data-lifted={lifted || undefined} data-fixed={task.fixed || undefined} data-focus={density === "focus" || undefined} onPointerDown={(e) => onDown(e, task)} title={`${task.title} · ${hrs(task.hours)}. Drag to move.`}>
      <span className={styles.barTitle}>{task.title}</span>
      {density === "focus" ? <span className={styles.barFocusHours}>{hrs(task.hours)}</span> : <span className={styles.barHours}>{hrs(task.hours)}</span>}
    </span>
  );
}

function DragGhost({ task, project, target, same }: { task: Task; project: Project; target?: Cell; same: boolean }) {
  const who = target ? (target.personId ? project.people.find((p) => p.id === target.personId) : null) : undefined;
  const after = target ? target.hours + task.hours : 0;
  const lvl = target && who ? levelOf(after, target.avail) : null;
  return (
    <div className={styles.ghostCard}>
      <span className={styles.ghostTitle}>
        <span className={styles.ghostTag} style={{ background: `var(--v3-project-${tagOf(task.tag)})` }} />
        {task.title}
        <span className={styles.ghostHours}>{hrs(task.hours)}</span>
      </span>
      {!target || same ? (
        <span className={styles.ghostHint}>Drop on another person or day</span>
      ) : (
        <span className={styles.ghostHint}>
          To {who ? who.first : "Unassigned"} · {shortDate(target.date)}
          {who && lvl && (
            <span className={styles.ghostLevel} data-level={lvl}>
              {hrs(after)} of {hrs(target.avail)} · {target.avail === 0 ? (target.kind === "away" ? "Away" : "Day off") : LEVEL_WORD[lvl]}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
