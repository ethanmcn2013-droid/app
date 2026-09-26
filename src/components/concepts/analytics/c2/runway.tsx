"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Burst, Milestone } from "./data";
import { fmtRange, fmtShort, fmtWeekday, monthShort, parts, pastLanding, type DayRecord, type Forecast } from "./model";
import s from "./c2.module.css";

export type RunwayMode = "forecast" | "rough" | "done" | "moving";

type Props = {
  history: DayRecord[];
  start: number;
  end: number;
  today: number;
  bigDate: number | null;
  dateLabel: string;
  forecast: Forecast | null;
  /** The forecast before any what-if levers, drawn as a ghost while levers are on. */
  ghost: Forecast | null;
  milestones: Milestone[];
  bursts: Burst[];
  mode: RunwayMode;
  compact: boolean;
  celebrate: number;
  /** Day everything was finished, for the done state. */
  doneDay: number | null;
  /** For the moving-target state: the band the list usually sits in. */
  usual: [number, number] | null;
};

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Rough width of a label at the chart's 12px size, for keeping labels apart. */
const textW = (t: string, size = 12) => t.length * size * 0.56;

function niceStep(max: number) {
  const raw = max / 4;
  for (const step of [2, 5, 10, 20, 25, 50, 100]) if (step >= raw) return step;
  return 200;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.round(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Runway(props: Props) {
  const { history, start, end, today, bigDate, dateLabel, forecast, ghost, milestones, bursts, mode, compact, celebrate, doneDay, usual } =
    props;
  const reduced = useReducedMotion();
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const width = measured || 760;
  const height = compact ? 260 : 420;
  const m = compact
    ? { top: 34, right: 14, bottom: 30, left: 30 }
    : { top: 44, right: 22, bottom: 64, left: 40 };
  const plotW = Math.max(10, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const [hover, setHover] = useState<number | null>(null);
  const descId = useId();

  const visible = useMemo(() => history.filter((r) => r.day >= start), [history, start]);
  const yMaxData = useMemo(() => {
    let v = 0;
    for (const r of visible) v = Math.max(v, r.remaining);
    if (forecast && mode !== "moving") for (const x of forecast.high) v = Math.max(v, x);
    if (ghost) for (const x of ghost.high) v = Math.max(v, x);
    if (usual) v = Math.max(v, usual[1]);
    return Math.max(4, v);
  }, [visible, forecast, ghost, mode, usual]);
  const step = niceStep(yMaxData);
  const yTop = yMaxData * (compact ? 1.12 : 1.24);
  const x = useCallback((day: number) => m.left + ((day - start) / (end - start)) * plotW, [m.left, start, end, plotW]);
  const y = useCallback((v: number) => m.top + plotH - (v / yTop) * plotH, [m.top, plotH, yTop]);
  const base = y(0);
  const clampX = (day: number) => x(Math.min(end, Math.max(start, day)));

  const ticks: number[] = [];
  for (let v = 0; v <= yMaxData; v += step) ticks.push(v);

  const months: number[] = [];
  for (let d = start; d <= end; d++) if (parts(d).date === 1) months.push(d);

  const actualPath = useMemo(() => {
    if (!visible.length) return "";
    return visible.map((r, i) => `${i ? "L" : "M"}${x(r.day).toFixed(1)},${y(r.remaining).toFixed(1)}`).join("");
  }, [visible, x, y]);
  const actualArea = visible.length
    ? `${actualPath}L${x(visible[visible.length - 1].day).toFixed(1)},${base}L${x(visible[0].day).toFixed(1)},${base}Z`
    : "";

  const fanPaths = useCallback(
    (f: Forecast) => {
      const pts = f.days.map((d, i) => [x(d), y(f.high[i])] as const);
      const lo = f.days.map((d, i) => [x(d), y(f.low[i])] as const).reverse();
      const band = `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}L${lo
        .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
        .join("L")}Z`;
      // Once the likely path reaches zero it stops: later points collapse onto the landing
      // point, so the path keeps the same shape for morphing but draws nothing more.
      let landed = -1;
      const mid = `M${f.days
        .map((d, i) => {
          if (landed < 0 && f.mid[i] <= 0) landed = i;
          const j = landed >= 0 ? landed : i;
          return `${x(f.days[j]).toFixed(1)},${y(f.mid[j]).toFixed(1)}`;
        })
        .join("L")}`;
      return { band, mid };
    },
    [x, y],
  );
  const fan = forecast && (mode === "forecast" || mode === "rough") ? fanPaths(forecast) : null;
  const ghostPaths = ghost && fan ? fanPaths(ghost) : null;

  const pathT = reduced ? { duration: 0 } : { duration: 0.65, ease: EASE };

  // Past forecasts: one tick a week, looking back from today.
  const trail = useMemo(() => {
    const out: { day: number; landing: number | null; age: number }[] = [];
    for (let back = 1; back <= 28; back += 1) {
      const idx = history.findIndex((r) => r.day === today - back);
      if (idx < 0 || history[idx].day < start) continue;
      out.push({ day: today - back, landing: pastLanding(history, idx), age: back });
    }
    return out;
  }, [history, today, start]);

  const late = forecast && bigDate !== null && forecast.likely !== null && forecast.likely >= bigDate && mode !== "done" && mode !== "moving";
  const shortBy = late && forecast?.likely != null && bigDate !== null ? forecast.likely - bigDate + 1 : 0;

  /* ── scrubbing ─────────────────────────────────────────────── */
  const dayAt = (px: number) => Math.round(start + ((px - m.left) / plotW) * (end - start));
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const d = dayAt(e.clientX - rect.left);
    setHover(Math.min(end, Math.max(Math.max(start, visible[0]?.day ?? start), d)));
  };
  const lastDay = forecast && mode !== "done" && mode !== "moving" ? end : today;
  const firstDay = visible[0]?.day ?? start;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const stepDays = e.shiftKey ? 7 : 1;
    const cur = hover ?? today;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = cur - stepDays;
    else if (e.key === "ArrowRight") next = cur + stepDays;
    else if (e.key === "Home") next = firstDay;
    else if (e.key === "End") next = lastDay;
    else if (e.key === "Escape") {
      setHover(null);
      return;
    } else return;
    e.preventDefault();
    setHover(Math.min(lastDay, Math.max(firstDay, next)));
  };

  const readout = useMemo(() => {
    if (hover === null) return null;
    const rec = history.find((r) => r.day === hover);
    if (hover <= today && rec) {
      const idx = history.indexOf(rec);
      const then = hover < today ? pastLanding(history, idx) : null;
      const title = hover === today ? `Today · ${rec.remaining} left` : `${fmtWeekday(hover)} · ${rec.remaining} left`;
      let line: string;
      if (hover === today) line = forecast?.likely != null && mode !== "moving" && mode !== "done" ? `The forecast now says ${fmtShort(forecast.likely)}.` : `${rec.finished} finished, ${rec.added} new.`;
      else if (idx < 7) line = "Too early for a forecast on this day.";
      else if (then === null) line = "No finish in sight then. New things arrived about as fast as others got done.";
      else line = `The forecast then said ${fmtShort(then)}.`;
      const day = rec.finished || rec.added ? `${rec.finished} finished that day, ${rec.added} new.` : "A quiet day.";
      const ms = milestones.find((x) => x.day === hover);
      return { title, line, day: ms ? `${ms.label}. ${day}` : hover === today ? null : day, then, value: rec.remaining };
    }
    if (forecast && hover > today) {
      const i = hover - today;
      const mid = Math.round(forecast.mid[i] ?? 0);
      const lo = Math.round(forecast.low[i] ?? 0);
      const hi = Math.round(forecast.high[i] ?? 0);
      const title = mid <= 0 ? `${fmtWeekday(hover)} · likely all done` : `${fmtWeekday(hover)} · likely ${mid} left`;
      const line = hi <= 0 ? "Nearly every way it could go is finished by now." : `Somewhere between ${lo} and ${hi}.`;
      const ms = milestones.find((x) => x.day === hover);
      return { title, line, day: ms ? `${ms.label} is planned for this day.` : null, then: null, value: mid };
    }
    return null;
  }, [hover, history, today, forecast, mode, milestones]);

  const hoverX = hover !== null ? x(hover) : 0;
  const hoverY = readout ? y(readout.value) : 0;
  const tipLeft = hoverX > width * 0.62;

  /* ── labels ────────────────────────────────────────────────── */
  const readyLabel = (() => {
    if (!forecast || (mode !== "forecast" && mode !== "rough") || forecast.likely === null) return null;
    const off = forecast.likely > end;
    const e0 = forecast.early ?? forecast.likely;
    const l0 = forecast.late ?? end;
    return {
      off,
      x1: clampX(e0),
      x2: clampX(l0),
      xm: clampX(forecast.likely),
      main: off ? `Ready after ${fmtShort(end)}` : `Ready ${fmtShort(forecast.likely)}`,
      range: forecast.late === null ? `maybe much later` : `most likely ${fmtRange(e0, l0)}`,
    };
  })();

  const lastRec = visible[visible.length - 1];

  // The Today and big-date labels share the top row: when they are close, push them apart.
  type Anchor = "start" | "middle" | "end";
  const todayLabel: { x: number; anchor: Anchor } = { x: x(today), anchor: "middle" };
  const dateLabelPos: { x: number; anchor: Anchor } = { x: bigDate !== null ? x(bigDate) : 0, anchor: "middle" };
  if (bigDate !== null) {
    const dx = x(bigDate) - x(today);
    if (Math.abs(dx) < 130 && !compact) {
      todayLabel.anchor = dx >= 0 ? "end" : "start";
      todayLabel.x = x(today) + (dx >= 0 ? -6 : 6);
      dateLabelPos.anchor = dx >= 0 ? "start" : "end";
      dateLabelPos.x = x(bigDate) + (dx >= 0 ? 6 : -6);
    }
    const dw = textW(compact ? `${dateLabel} ${fmtShort(bigDate)}` : `${dateLabel} · ${fmtWeekday(bigDate)}`, 12.5);
    if (dateLabelPos.anchor === "middle" && x(bigDate) + dw / 2 > width - 4) {
      dateLabelPos.anchor = "end";
      dateLabelPos.x = x(bigDate) + 6;
    }
    if (dateLabelPos.anchor === "start" && x(bigDate) + dw > width - 4) {
      dateLabelPos.anchor = "end";
      dateLabelPos.x = x(bigDate) - 6;
    }
  }
  let showToday = !compact;
  if (bigDate !== null && showToday) {
    const dw = textW(`${dateLabel} · ${fmtWeekday(bigDate)}`, 12.5);
    const d0 = dateLabelPos.anchor === "start" ? dateLabelPos.x : dateLabelPos.anchor === "end" ? dateLabelPos.x - dw : dateLabelPos.x - dw / 2;
    const tw = textW("Today");
    const t0 = todayLabel.anchor === "start" ? todayLabel.x : todayLabel.anchor === "end" ? todayLabel.x - tw : todayLabel.x - tw / 2;
    if (t0 < d0 + dw + 6 && t0 + tw > d0 - 6) showToday = false;
  }
  if (todayLabel.anchor === "middle" && x(today) - m.left < 120 + textW("Things left to do")) {
    todayLabel.anchor = "start";
    todayLabel.x = x(today) + 6;
  }
  const doneX = doneDay !== null ? x(doneDay) : 0;

  const summary = (() => {
    if (!lastRec) return "";
    const bits = [`Things left to do each day since ${fmtShort(firstDay)}. ${lastRec.remaining} left today.`];
    if (readyLabel && forecast?.likely != null) bits.push(`Forecast: ready ${fmtShort(forecast.likely)}.`);
    if (bigDate !== null) bits.push(`${dateLabel} on ${fmtShort(bigDate)}.`);
    bits.push("Use the left and right arrow keys to read any day.");
    return bits.join(" ");
  })();

  return (
    <div
      ref={wrapRef}
      className={s.runway}
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label="Runway chart"
      aria-describedby={descId}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
    >
      <svg width={width} height={height} className={s.runwaySvg} aria-hidden="true">
        {/* grid and y axis */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? s.axisBase : s.grid} />
            <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className={s.axisText}>
              {v}
            </text>
          </g>
        ))}
        {!compact && (
          <text x={m.left - 8} y={m.top - 12} className={s.axisTitle}>
            Things left to do
          </text>
        )}
        {/* months */}
        {months.map((d) => (
          <g key={d}>
            <line x1={x(d)} x2={x(d)} y1={base} y2={base + 5} className={s.axisBase} />
            <text x={x(d)} y={base + (compact ? 18 : 20)} textAnchor="middle" className={s.axisText}>
              {compact ? monthShort(parts(d).month) : `1 ${monthShort(parts(d).month)}`}
            </text>
          </g>
        ))}

        {/* the usual band, for ongoing work */}
        {usual && mode === "moving" && (
          <g>
            <rect x={x(firstDay)} width={x(end) - x(firstDay)} y={y(usual[1])} height={Math.max(2, y(usual[0]) - y(usual[1]))} className={s.usualBand} />
            <text x={x(end) - 6} y={y(usual[1]) - 8} textAnchor="end" className={s.labelStrong}>
              {`Usually ${usual[0]} to ${usual[1]} left`}
            </text>
          </g>
        )}

        {/* shortfall: the gap between the big date and the landing */}
        {bigDate !== null && fan && (
          <motion.rect
            className={s.gap}
            y={m.top - 6}
            height={plotH + 6}
            initial={false}
            animate={{
              x: x(bigDate),
              width: late && forecast?.likely != null ? Math.max(0, clampX(forecast.likely) - x(bigDate)) : 0,
              opacity: late ? 1 : 0,
            }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, ease: EASE }}
          />
        )}

        {/* done: the calm stretch between finishing and the day */}
        {mode === "done" && doneDay !== null && bigDate !== null && (
          <g>
            <rect x={doneX} y={m.top - 6} width={Math.max(0, x(bigDate) - doneX)} height={plotH + 6} className={s.earlyZone} />
            {!compact && (
              <text x={(doneX + x(bigDate)) / 2} y={m.top + 14} textAnchor="middle" className={s.earlyText}>
                {`${bigDate - doneDay} days early`}
              </text>
            )}
          </g>
        )}

        {/* history */}
        <path d={actualArea} className={s.actualArea} />
        <path d={actualPath} className={s.actualLine} />

        {/* the ghost of reality while a what-if is on */}
        {ghostPaths && <path d={ghostPaths.mid} className={s.ghostLine} />}

        {/* forecast fan */}
        {fan && (
          <g>
            <motion.path initial={false} animate={{ d: fan.band }} transition={pathT} className={mode === "rough" ? s.fanRough : s.fan} />
            <motion.path initial={false} animate={{ d: fan.mid }} transition={pathT} className={s.fanMid} />
          </g>
        )}
        {fan && forecast && !compact && mode === "forecast" && !ghost && (() => {
          const t = Math.max(2, Math.round((forecast.days.length - 1) * 0.08));
          return (
            <motion.text
              x={x(today + t) + 4}
              initial={false}
              animate={{ y: y(forecast.high[t] ?? 0) - 10 }}
              transition={pathT}
              className={s.fanLabel}
            >
              Likely path and range
            </motion.text>
          );
        })()}
        {ghostPaths && ghost && ghost.likely !== null && !compact && (() => {
          const t = Math.max(1, Math.round((Math.min(ghost.likely, end) - today) * 0.32));
          return (
            <text x={x(today + t) + 10} y={y(ghost.mid[t] ?? 0) - 8} className={s.ghostText}>
              Before your what-if
            </text>
          );
        })()}
        {mode === "rough" && forecast && !compact && (
          <text x={x(today) + 12} y={y((forecast.high[4] ?? 0) + 2) - 8} className={s.labelStrong}>
            Rough guess, sharpens after two weeks
          </text>
        )}

        {/* annotations: bursts of new work and milestones, labelled in quiet lanes at the top */}
        {(() => {
          type Note = { key: string; day: number; px: number; py: number; kind: "burst" | "milestone"; num?: string; text: string };
          const notes: Note[] = [];
          for (const b of bursts) {
            if (b.day < firstDay || b.day > today) continue;
            const i = history.findIndex((r) => r.day === b.day);
            if (i < 0) continue;
            const n = history[i].added + (history[i + 1]?.added ?? 0);
            const peak = Math.max(history[i].remaining, history[i + 1]?.remaining ?? 0);
            notes.push({ key: `b${b.day}`, day: b.day, px: x(b.day), py: y(peak), kind: "burst", num: `+${n}`, text: ` ${b.label.toLowerCase()}` });
          }
          for (const ms of milestones) {
            if (ms.day < firstDay || ms.day > end) continue;
            let v: number | null = null;
            if (ms.day <= today) v = history.find((r) => r.day === ms.day)?.remaining ?? null;
            else if (forecast && mode !== "moving") v = forecast.mid[ms.day - today] ?? null;
            if (v === null) continue;
            notes.push({ key: `m${ms.day}`, day: ms.day, px: x(ms.day), py: y(v), kind: "milestone", text: `${ms.label} · ${fmtShort(ms.day)}` });
          }
          notes.sort((n1, n2) => n1.px - n2.px);
          const lane0 = m.top + 22;
          const placed: { x0: number; x1: number; row: number }[] = [];
          return notes.map((note) => {
            const { px, py } = note;
            const future = note.day > today;
            const label = (note.num ?? "") + note.text;
            const w = compact ? textW(note.num ?? "") : textW(label);
            const nearRule = [today, bigDate].some((r) => r !== null && r > note.day && r - note.day < 12);
            let anchor: "start" | "middle" | "end" = nearRule ? "end" : "middle";
            let lx = anchor === "end" ? px + 4 : px;
            let x0 = anchor === "end" ? lx - w : lx - w / 2;
            if (x0 < m.left - 6) {
              anchor = "start";
              lx = px - 4;
              x0 = lx;
            }
            const x1 = x0 + w;
            let row = 0;
            while (placed.some((q) => q.row === row && x0 < q.x1 + 10 && x1 > q.x0 - 10)) row++;
            const lane = lane0 + row * 16;
            const inLane = row < 2 && py - lane > 16;
            if (inLane) placed.push({ x0, x1, row });
            const showText = !compact || note.kind === "burst";
            return (
              <g key={note.key}>
                {inLane && showText && (
                  <motion.line
                    x1={px}
                    x2={px}
                    y1={lane + 5}
                    initial={false}
                    animate={{ y2: py - 6 }}
                    transition={pathT}
                    className={s.leader}
                  />
                )}
                {note.kind === "milestone" && (
                  <motion.circle
                    cx={px}
                    initial={false}
                    animate={{ cy: py }}
                    transition={pathT}
                    r={4}
                    className={future ? s.milestoneFuture : s.milestone}
                  />
                )}
                {showText && (
                  <text
                    x={inLane ? lx : px - 8}
                    y={inLane ? lane : py + 18}
                    textAnchor={inLane ? anchor : "end"}
                    className={note.kind === "burst" ? s.burstText : s.milestoneText}
                  >
                    {note.num && <tspan className={s.burstNum}>{note.num}</tspan>}
                    {!compact && <tspan className={note.kind === "burst" ? s.burstLabel : undefined}>{note.text}</tspan>}
                  </text>
                )}
              </g>
            );
          });
        })()}

        {/* a what-if that takes things off the list drops the start of the fan */}
        {lastRec && forecast && fan && Math.round(forecast.startRemaining) !== lastRec.remaining && (
          <g>
            <motion.line
              x1={x(today)}
              x2={x(today)}
              y1={y(lastRec.remaining)}
              initial={false}
              animate={{ y2: y(forecast.startRemaining) }}
              transition={pathT}
              className={s.dropLine}
            />
            {!compact && (
              <motion.text
                x={x(today) + 8}
                initial={false}
                animate={{ y: (y(lastRec.remaining) + y(forecast.startRemaining)) / 2 + 4 }}
                transition={pathT}
                className={s.dropText}
              >
                {`${forecast.startRemaining < lastRec.remaining ? "−" : "+"}${Math.abs(lastRec.remaining - Math.round(forecast.startRemaining))}`}
              </motion.text>
            )}
          </g>
        )}

        {/* today */}
        <line x1={x(today)} x2={x(today)} y1={m.top - 6} y2={base} className={s.todayRule} />
        {showToday && (
          <text x={todayLabel.x} y={m.top - 12} textAnchor={todayLabel.anchor} className={s.ruleText}>
            Today
          </text>
        )}
        {lastRec && mode !== "done" && (
          <g>
            <circle cx={x(today)} cy={y(lastRec.remaining)} r={5} className={s.nowDot} />
            <text x={x(today) - 10} y={y(lastRec.remaining) + 20} textAnchor="end" className={s.nowText}>
              {`${lastRec.remaining} left`}
            </text>
          </g>
        )}

        {/* the big date */}
        {bigDate !== null && bigDate >= start && bigDate <= end && (
          <g>
            <line x1={x(bigDate)} x2={x(bigDate)} y1={m.top - 6} y2={base} className={s.dateRule} />
            <text x={dateLabelPos.x} y={m.top - 12} textAnchor={dateLabelPos.anchor} className={s.dateText}>
              {compact ? `${dateLabel} ${fmtShort(bigDate)}` : `${dateLabel} · ${fmtWeekday(bigDate)}`}
            </text>
          </g>
        )}
        {late && forecast?.likely != null && bigDate !== null && !compact && (
          <text x={x(bigDate) + 8} y={m.top + 14} className={s.gapText}>
            <tspan x={x(bigDate) + 8}>{bigDate < today ? `${shortBy - 1} days past` : "Short by about"}</tspan>
            <tspan x={x(bigDate) + 8} dy="1.3em">
              {bigDate < today ? dateLabel.toLowerCase() : `${shortBy} ${shortBy === 1 ? "day" : "days"}`}
            </tspan>
          </text>
        )}

        {/* done flag */}
        {mode === "done" && doneDay !== null && (
          <g>
            <circle cx={doneX} cy={base} r={5} className={s.doneDot} />
            <text x={doneX - 8} y={base - 12} textAnchor="end" className={s.doneText}>
              {`All done · ${fmtWeekday(doneDay)}`}
            </text>
          </g>
        )}

        {/* ready bracket: settles with one spring when the forecast comes good */}
        {readyLabel && (
          <motion.g
            key={celebrate}
            initial={celebrate && !reduced ? { y: -14, opacity: 0.4 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 16, mass: 0.9 }}
          >
            <motion.line
              initial={false}
              animate={{ x1: readyLabel.x1, x2: readyLabel.x2 }}
              transition={pathT}
              y1={base - 12}
              y2={base - 12}
              className={late ? s.bracketLate : s.bracket}
            />
            <motion.line initial={false} animate={{ x1: readyLabel.x1, x2: readyLabel.x1 }} transition={pathT} y1={base - 17} y2={base - 7} className={late ? s.bracketLate : s.bracket} />
            <motion.line initial={false} animate={{ x1: readyLabel.x2, x2: readyLabel.x2 }} transition={pathT} y1={base - 17} y2={base - 7} className={late ? s.bracketLate : s.bracket} />
            <motion.circle initial={false} animate={{ cx: readyLabel.xm }} transition={pathT} cy={base - 12} r={5} className={late ? s.readyDotLate : s.readyDot} />
            <motion.text
              initial={false}
              animate={{ x: Math.min(width - m.right, Math.max(m.left + 60, readyLabel.xm)) }}
              transition={pathT}
              y={base - (compact ? 24 : 52)}
              textAnchor={readyLabel.xm > width - 100 ? "end" : "middle"}
              className={late ? s.readyTextLate : s.readyText}
            >
              {readyLabel.main}
            </motion.text>
            {!compact && (
              <motion.text
                initial={false}
                animate={{ x: Math.min(width - m.right, Math.max(m.left + 60, readyLabel.xm)) }}
                transition={pathT}
                y={base - 35}
                textAnchor={readyLabel.xm > width - 100 ? "end" : "middle"}
                className={s.readyRange}
              >
                {readyLabel.range}
              </motion.text>
            )}
          </motion.g>
        )}

        {/* trail of earlier forecasts */}
        {!compact && trail.length > 0 && mode === "forecast" && (
          <g>
            <text x={x(today) - 10} y={base + 46} textAnchor="end" className={s.trailLabel}>
              Each day’s forecast, last 4 weeks
            </text>
            <line x1={x(today)} x2={x(end)} y1={base + 42} y2={base + 42} className={s.trailTrack} />
            {trail.map((t) => {
              if (t.landing === null || t.landing < today) return null;
              const beyond = t.landing > end;
              const tx = beyond ? x(end) : x(t.landing);
              const on = hover === t.day;
              const opacity = on ? 1 : Math.max(0.22, 1 - t.age / 30);
              return (
                <line
                  key={t.day}
                  x1={tx}
                  x2={tx}
                  y1={base + 36}
                  y2={base + 48}
                  className={on ? s.trailTickOn : s.trailTick}
                  style={{ opacity }}
                />
              );
            })}
            {(() => {
              const later = trail.filter((t) => t.landing === null || t.landing > end).length;
              return later ? (
                <text x={x(end)} y={base + 62} textAnchor="end" className={s.trailNote}>
                  {`${later} pointed past ${fmtShort(end)}`}
                </text>
              ) : null;
            })()}
          </g>
        )}

        {/* hover */}
        {readout && hover !== null && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={m.top - 6} y2={base} className={s.hoverRule} />
            {readout.then !== null && hover < today && (
              <line
                x1={hoverX}
                y1={hoverY}
                x2={x(Math.min(end, readout.then))}
                y2={readout.then > end ? y(readout.value * (1 - (end - hover) / (readout.then - hover))) : base}
                className={s.thenLine}
              />
            )}
            <circle cx={hoverX} cy={hoverY} r={5} className={hover > today ? s.hoverDotFuture : s.hoverDot} />
          </g>
        )}

        <rect
          x={m.left}
          y={m.top - 10}
          width={plotW}
          height={plotH + 10}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          className={s.hit}
        />
      </svg>

      {readout && hover !== null && (
        <div
          className={s.tip}
          style={{
            left: tipLeft ? undefined : hoverX + 14,
            right: tipLeft ? width - hoverX + 14 : undefined,
            top: Math.max(4, Math.min(height - 110, hoverY - 40)),
          }}
        >
          <div className={s.tipTitle}>{readout.title}</div>
          <div className={s.tipLine}>{readout.line}</div>
          {readout.day && <div className={s.tipDay}>{readout.day}</div>}
        </div>
      )}
      <p id={descId} className={s.srOnly}>
        {summary}
      </p>
      <div className={s.srOnly} aria-live="polite">
        {readout ? `${readout.title}. ${readout.line}` : ""}
      </div>
    </div>
  );
}
