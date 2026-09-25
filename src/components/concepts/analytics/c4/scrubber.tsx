"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  fmtDay,
  fmtLong,
  journey,
  weekdayOf,
  type Moment,
  type Replay,
  type Task,
} from "./model";
import styles from "./c4.module.css";

const PAD_L = 30;
const PAD_R = 14;
const RAIL = 30; // flags and pins
const CHART = 88;
const LANE = 22; // a traced task's life
const AXIS = 24;

/**
 * The timeline under the stage: open work day by day (one scale), the
 * Project's milestones as flags, detected moments as numbered pins, and a
 * playhead you drag. Shift-click (or the Compare button) drops a second
 * marker for then-versus-now. The area to the right of the playhead is only
 * a ghost, so pressing play draws the chart as the replay passes.
 */
export function Scrubber({
  p,
  day,
  compareAt,
  traced,
  activeMoment,
  compact,
  onSeek,
  onCompare,
  onKey,
  onMoment,
}: {
  p: Replay;
  day: number;
  compareAt: number | null;
  traced: Task | null;
  activeMoment: string | null;
  compact: boolean;
  onSeek: (d: number) => void;
  onCompare: (d: number) => void;
  onKey: (e: KeyboardEvent<SVGSVGElement>) => void;
  onMoment: (m: Moment) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setW(Math.max(280, Math.round(entry.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const end = Math.max(1, p.axisEnd);
  const innerW = w - PAD_L - PAD_R;
  const x = (d: number) => PAD_L + (d / end) * innerW;
  const top = RAIL;
  const base = RAIL + CHART;
  const peak = Math.max(1, p.series.peakOpen);
  const y = (v: number) => base - (v / peak) * (CHART - 8);
  const lane = traced ? LANE : 0;
  const h = base + lane + AXIS;
  const railLabels = !compact;

  const open = p.series.open;
  const line = open
    .map((v, d) => `${d ? "L" : "M"}${x(d).toFixed(1)},${y(v).toFixed(1)}`)
    .join("");
  const area = `${line}L${x(open.length - 1).toFixed(1)},${base}L${x(0).toFixed(1)},${base}Z`;

  const dayFrom = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return day;
    return Math.max(
      0,
      Math.min(p.last, Math.round(((clientX - r.left - PAD_L) / innerW) * end)),
    );
  };

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-pin]")) return;
    const d = dayFrom(e.clientX);
    if (e.shiftKey) {
      onCompare(d);
      return;
    }
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(d);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const d = dayFrom(e.clientX);
    if (dragging.current) onSeek(d);
    else if (e.pointerType === "mouse") setHover(d);
  };
  const up = () => {
    dragging.current = false;
  };

  // Week labels: every week when there is room, else every second or third.
  const weekPx = (7 / end) * innerW;
  const every = weekPx > 58 ? 1 : weekPx > 30 ? 2 : 3;
  const weeks: number[] = [];
  for (let d = 0, i = 0; d <= p.axisEnd; d += 7, i++)
    if (i % every === 0) weeks.push(d);

  // Flag labels take the top row unless they would collide, then drop a row.
  const title = compact ? "Open tasks" : `Open tasks, ${peak} at most`;
  const rowEnds = [PAD_L - 6 + title.length * 6.3, -Infinity];
  const flags = p.milestones.map((m) => {
    const fx = x(m.day);
    const width = m.label.length * 6.4 + 14;
    const flip = fx + width > w - 4;
    const from = flip ? fx - width : fx;
    let row = rowEnds.findIndex((e) => from > e + 6);
    if (row < 0) row = 1;
    rowEnds[row] = Math.max(rowEnds[row], flip ? fx : fx + width);
    return { m, fx, flip, row };
  });

  const steps = traced ? journey(p, traced) : [];
  const px = x(day);
  const hoverOn = hover !== null && hover !== day && !dragging.current;
  const pinned = p.moments.find((m) => m.id === pin) ?? null;
  const cmp = compareAt;

  return (
    <div ref={box} className={styles.scrubBox}>
      <svg
        className={styles.scrub}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="slider"
        tabIndex={0}
        aria-label="Replay position"
        aria-valuemin={0}
        aria-valuemax={p.last}
        aria-valuenow={day}
        aria-valuetext={`${fmtLong(p, day)}, ${open[day]} open`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        <defs>
          <clipPath id={`c4-played-${p.id}`}>
            <rect x={0} y={0} width={Math.max(0, px)} height={h} />
          </clipPath>
          <pattern
            id={`c4-hatch-${p.id}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatchLine} />
          </pattern>
        </defs>

        {/* compare band */}
        {cmp !== null ? (
          <rect
            className={styles.cmpBand}
            x={Math.min(x(cmp), px)}
            y={top}
            width={Math.abs(px - x(cmp))}
            height={CHART}
          />
        ) : null}

        {/* peak gridline, labelled at the value the data reaches */}
        <line
          className={styles.grid}
          x1={PAD_L}
          x2={w - PAD_R}
          y1={y(peak)}
          y2={y(peak)}
        />
        <text
          className={styles.gridLabel}
          x={PAD_L - 6}
          y={y(peak) + 3.5}
          textAnchor="end"
        >
          {peak}
        </text>
        <text className={styles.chartTitle} x={PAD_L - 6} y={15}>
          {title}
        </text>
        <line
          className={styles.baseline}
          x1={PAD_L}
          x2={w - PAD_R}
          y1={base}
          y2={base}
        />

        {/* the ghost of what is still to come, then what has played */}
        <path className={styles.ghostArea} d={area} />
        <g clipPath={`url(#c4-played-${p.id})`}>
          <path className={styles.area} d={area} />
          <path className={styles.line} d={line} />
        </g>

        {/* history began before tracking */}
        {p.tracked ? (
          <g>
            <rect
              x={PAD_L}
              y={top}
              width={10}
              height={CHART}
              fill={`url(#c4-hatch-${p.id})`}
            />
            {railLabels ? (
              <text className={styles.trackNote} x={PAD_L + 16} y={top + 14}>
                {p.tracked.note}
              </text>
            ) : null}
          </g>
        ) : null}

        {/* milestones */}
        {flags.map(({ m, fx, flip, row }) => (
          <g key={m.label}>
            <line
              className={styles.flagLine}
              x1={fx}
              x2={fx}
              y1={8 + row * 12}
              y2={base}
            />
            <path
              className={styles.flag}
              d={`M${fx},${6 + row * 12} h8 l-2.5,3.5 l2.5,3.5 h-8 z`}
            />
            {railLabels ? (
              <text
                className={styles.flagText}
                x={flip ? fx - 4 : fx + 11}
                y={15 + row * 12}
                textAnchor={flip ? "end" : "start"}
              >
                {m.label}
              </text>
            ) : null}
          </g>
        ))}

        {/* finished */}
        {p.finish ? (
          <g>
            <circle
              className={styles.finishDot}
              cx={x(p.finish.day)}
              cy={y(0)}
              r={4.5}
            />
          </g>
        ) : null}

        {/* daily ticks and week labels */}
        {open.map((_, d) => (
          <line
            key={d}
            className={styles.tick}
            data-week={weekdayOf(p, d) === weekdayOf(p, 0) ? "" : undefined}
            x1={x(d)}
            x2={x(d)}
            y1={base + lane}
            y2={base + lane + (weekdayOf(p, d) === weekdayOf(p, 0) ? 6 : 3)}
          />
        ))}
        {weeks
          .filter(
            (d) =>
              Math.abs(x(d) - px) > 42 &&
              (cmp === null || Math.abs(x(d) - x(cmp)) > 52),
          )
          .map((d) => (
            <text
              key={d}
              className={styles.axisLabel}
              x={x(d)}
              y={base + lane + 18}
              textAnchor={d === 0 ? "start" : "middle"}
            >
              {fmtDay(p, d)}
            </text>
          ))}

        {/* a traced task's life, on its own lane */}
        {traced ? (
          <Lane p={p} t={traced} x={x} y0={base + 6} steps={steps} />
        ) : null}

        {/* moments */}
        {p.moments.map((m, i) => {
          const cx = x(m.day);
          const cy = Math.max(
            top + 9,
            y(open[Math.min(m.day, open.length - 1)]) - 12,
          );
          const active = activeMoment === m.id;
          return (
            <g
              key={m.id}
              data-pin=""
              className={styles.pin}
              data-active={active ? "" : undefined}
              onPointerEnter={() => setPin(m.id)}
              onPointerLeave={() => setPin(null)}
              onClick={() => onMoment(m)}
            >
              <line
                className={styles.pinStem}
                x1={cx}
                x2={cx}
                y1={cy + 8}
                y2={y(open[Math.min(m.day, open.length - 1)])}
              />
              <circle
                className={styles.pinDot}
                cx={cx}
                cy={cy}
                r={compact ? 7 : 8.5}
              />
              <text
                className={styles.pinNum}
                x={cx}
                y={cy + 3.6}
                textAnchor="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* hover readout */}
        {hoverOn && hover !== null ? (
          <g className={styles.hoverMark} pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={base} />
            <circle cx={x(hover)} cy={y(open[hover])} r={3} />
          </g>
        ) : null}

        {/* compare marker */}
        {cmp !== null ? (
          <g pointerEvents="none">
            <line
              className={styles.cmpLine}
              x1={x(cmp)}
              x2={x(cmp)}
              y1={top - 4}
              y2={base}
            />
            <Pill
              x={x(cmp)}
              y={base + lane + 4}
              w={w}
              text={`Then ${fmtDay(p, cmp)}`}
              kind="then"
            />
          </g>
        ) : null}

        {/* playhead */}
        <g pointerEvents="none">
          <line
            className={styles.head}
            x1={px}
            x2={px}
            y1={top - 4}
            y2={base}
          />
          <circle
            className={styles.headDot}
            cx={px}
            cy={y(open[day])}
            r={4.5}
          />
          <Pill
            x={px}
            y={base + lane + 4}
            w={w}
            text={day === p.today && !p.finish ? "Today" : fmtDay(p, day)}
            kind="now"
          />
        </g>
      </svg>

      {pinned ? (
        <div
          className={styles.pinTip}
          style={{ left: Math.min(Math.max(x(pinned.day), 130), w - 130) }}
          role="tooltip"
        >
          <div className={styles.pinTipDate}>{fmtDay(p, pinned.day)}</div>
          <div>{pinned.label}</div>
        </div>
      ) : null}
      {hoverOn && hover !== null ? (
        <div
          className={styles.hoverTip}
          style={{ left: Math.min(Math.max(x(hover), 50), w - 50) }}
          aria-hidden
        >
          {fmtDay(p, hover)} · {open[hover]} open
        </div>
      ) : null}
    </div>
  );
}

function Pill({
  x,
  y,
  w,
  text,
  kind,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  kind: "now" | "then";
}) {
  const width = text.length * 6.4 + 16;
  const left = Math.min(Math.max(x - width / 2, 0), w - width);
  return (
    <g className={styles.pill} data-kind={kind}>
      <rect x={left} y={y} width={width} height={18} rx={9} />
      <text x={left + width / 2} y={y + 12.5} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function Lane({
  p,
  t,
  x,
  y0,
  steps,
}: {
  p: Replay;
  t: Task;
  x: (d: number) => number;
  y0: number;
  steps: ReturnType<typeof journey>;
}) {
  const end = t.done ?? p.last;
  const started = t.started ?? end;
  const segs: {
    from: number;
    to: number;
    kind: "todo" | "doing" | "waiting";
  }[] = [];
  segs.push({ from: t.created, to: Math.min(started, end), kind: "todo" });
  let cursor = started;
  for (const w of t.waits) {
    if (w.from > cursor) segs.push({ from: cursor, to: w.from, kind: "doing" });
    segs.push({ from: w.from, to: Math.min(w.to, end), kind: "waiting" });
    cursor = Math.min(w.to, end);
  }
  if (t.started !== null && cursor < end)
    segs.push({ from: cursor, to: end, kind: "doing" });
  return (
    <g pointerEvents="none">
      {segs
        .filter((s) => s.to > s.from)
        .map((s, i) => (
          <rect
            key={i}
            className={styles.laneSeg}
            data-kind={s.kind}
            x={x(s.from)}
            y={y0}
            width={Math.max(2, x(s.to) - x(s.from))}
            height={6}
            rx={3}
          />
        ))}
      <circle
        className={styles.laneStart}
        cx={x(t.created)}
        cy={y0 + 3}
        r={4}
      />
      {t.done !== null ? (
        <circle
          className={styles.laneDone}
          cx={x(t.done)}
          cy={y0 + 3}
          r={4.5}
        />
      ) : null}
      {steps
        .filter((s) => s.kind === "moved")
        .map((s, i) => (
          <path
            key={i}
            className={styles.laneMove}
            d={`M${x(s.day)},${y0 - 2} l5,5 l-5,5 l-5,-5 z`}
          />
        ))}
    </g>
  );
}
