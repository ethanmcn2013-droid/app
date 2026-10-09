"use client";

/*
 * One chart per answer, hand-drawn. Every mark reports what it is in words
 * (hover or focus), and every mark can be lit from the sentence above it.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Chart, Tone } from "./answers";
import { dateOf, fmtShort, type Day } from "./data";
import s from "./c5.module.css";

export const TONE: Record<Tone, string> = {
  key: "var(--v3-accent)",
  plain: "var(--c5-plain)",
  soft: "var(--c5-soft)",
  idle: "var(--c5-idle)",
  late: "var(--v3-danger)",
  wait: "var(--c5-wait)",
  doing: "var(--v3-success)",
  check: "var(--c5-check)",
};

export type Link = {
  hot: Set<string> | null;
  point: (ids: string[], say: string) => void;
  leave: () => void;
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function mark(link: Link, ids: string[], say: string) {
  return {
    tabIndex: 0,
    onMouseEnter: () => link.point(ids, say),
    onMouseLeave: link.leave,
    onFocus: () => link.point(ids, say),
    onBlur: link.leave,
  };
}

const dim = (link: Link, ...ids: string[]) => (link.hot && !ids.some((id) => link.hot?.has(id)) ? s.dim : "");
const lit = (link: Link, ...ids: string[]) => (link.hot && ids.some((id) => link.hot?.has(id)) ? s.lit : "");

/** All the words a chart can say, keyed by mark id. */
export function saysOf(c: Chart): Record<string, string> {
  const out: Record<string, string> = {};
  switch (c.kind) {
    case "course":
      c.series.forEach((p) => (out[p.id] = p.say));
      Object.assign(out, c.says);
      break;
    case "bars":
      c.rows.forEach((r) => (out[r.id] = r.say));
      break;
    case "slope":
      c.rows.forEach((r) => (out[r.id] = r.say));
      break;
    case "waffle":
      c.parts.forEach((r) => (out[r.id] = r.say));
      break;
    case "dots":
      c.points.forEach((r) => (out[r.id] = r.say));
      break;
    case "range":
      c.rows.forEach((r) => (out[r.id] = r.say));
      out.typical = `Most things take about ${c.typical} days.`;
      break;
    case "columns":
      c.cols.forEach((r) => (out[r.id] = r.say));
      c.lines?.forEach((r) => (out[r.id] = r.say));
      break;
    case "week":
      c.items.forEach((r) => (out[r.id] = r.say));
      break;
    case "moves":
      c.rows.forEach((r) => (out[r.id] = r.say));
      break;
  }
  return out;
}

export function ChartView({ chart, link, compact }: { chart: Chart; link: Link; compact: boolean }) {
  switch (chart.kind) {
    case "course":
      return <Course c={chart} link={link} compact={compact} />;
    case "bars":
      return <Bars c={chart} link={link} />;
    case "slope":
      return <Slope c={chart} link={link} />;
    case "waffle":
      return <Waffle c={chart} link={link} />;
    case "dots":
      return <Dots c={chart} link={link} />;
    case "range":
      return <Range c={chart} link={link} />;
    case "columns":
      return <Columns c={chart} link={link} />;
    case "week":
      return <Week c={chart} link={link} />;
    case "moves":
      return <Moves c={chart} link={link} />;
  }
}

/* ── Course: the list shrinking toward the big date ─────────────────────── */

function Course({ c, link, compact }: { c: Extract<Chart, { kind: "course" }>; link: Link; compact: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = compact ? 230 : 280;
  const pad = { l: 34, r: compact ? 20 : 30, t: 40, b: 30 };
  const x0 = c.series[0].day;
  const x1 = Math.max(c.finish, c.target.day) + 5;
  const yMax = Math.max(...c.series.map((p) => p.value));
  const X = (d: number) => pad.l + ((d - x0) / (x1 - x0)) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / yMax) * (h - pad.t - pad.b);
  const last = c.series[c.series.length - 1];
  const path = (pts: { day: number; value: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p.day).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const late = c.finish > c.target.day;
  const gapA = Math.min(c.finish, c.target.day);
  const gapB = Math.max(c.finish, c.target.day);
  const base = h - pad.b;
  return (
    <div ref={ref} className={s.svgWrap} style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="How many things are still open each week, and where your pace takes the line">
          <line x1={pad.l} x2={w - pad.r} y1={base} y2={base} className={s.axisLine} />
          {/* the gap between finishing and the big date */}
          <g className={`${s.mark} ${dim(link, "gap")}`} {...mark(link, ["gap"], c.says.gap)}>
            <rect x={X(gapA)} y={pad.t - 8} width={Math.max(X(gapB) - X(gapA), 2)} height={base - pad.t + 8} className={late ? s.gapLate : s.gapOk} />
          </g>
          {/* history */}
          <path d={`${path(c.series)} L${X(last.day)},${base} L${X(c.series[0].day)},${base} Z`} className={s.courseArea} />
          <path d={path(c.series.slice(0, c.paceFrom + 1))} className={`${s.courseLine} ${dim(link, "history")}`} />
          <path d={path(c.series.slice(c.paceFrom))} className={`${s.courseLine} ${s.coursePace} ${dim(link, "pace")} ${lit(link, "pace")}`} />
          <path
            d={`M${X(0)},${Y(last.value)} L${X(c.finish)},${Y(0)}`}
            className={`${s.courseProjection} ${late ? s.courseProjectionLate : ""} ${dim(link, "pace", "finish")}`}
          />
          {/* today */}
          <line x1={X(0)} x2={X(0)} y1={pad.t - 14} y2={base} className={s.todayLine} />
          <text x={X(0)} y={pad.t - 20} className={s.svgLabel} textAnchor="middle">
            Today
          </text>
          {/* the big date */}
          <g className={`${s.mark} ${dim(link, "target", "gap")}`} {...mark(link, ["target"], c.says.target)}>
            <line x1={X(c.target.day)} x2={X(c.target.day)} y1={pad.t - 14} y2={base} className={s.targetLine} />
            <text x={X(c.target.day) + (late ? -6 : 6)} y={pad.t - 20} className={s.svgStrong} textAnchor={late ? "end" : "start"}>
              {fmtShort(c.target.day)}
            </text>
          </g>
          {/* finish */}
          <g className={`${s.mark} ${dim(link, "finish", "gap")} ${lit(link, "finish")}`} {...mark(link, ["finish"], c.says.finish)}>
            <circle cx={X(c.finish)} cy={Y(0)} r={5} className={late ? s.dotLate : s.dotKey} />
            <text x={X(c.finish) + (late ? 8 : -8)} y={Y(0) - 10} className={s.svgStrong} textAnchor={late ? "start" : "end"}>
              {fmtShort(c.finish)}
            </text>
          </g>
          {/* points */}
          {c.series.map((p, i) => {
            const ids = i >= c.paceFrom ? [p.id, "pace"] : [p.id, "history"];
            const on = link.hot?.has(p.id);
            return (
              <g key={p.id} className={s.mark} {...mark(link, [p.id], p.say)}>
                <circle cx={X(p.day)} cy={Y(p.value)} r={12} className={s.hit} />
                <circle cx={X(p.day)} cy={Y(p.value)} r={on ? 5 : i === c.series.length - 1 ? 4.5 : 2.5} className={`${i >= c.paceFrom ? s.dotKey : s.dotInk} ${dim(link, ...ids)}`} />
              </g>
            );
          })}
          {/* y labels at values the data reaches */}
          <text x={pad.l - 8} y={Y(yMax) + 4} className={s.svgLabel} textAnchor="end">
            {yMax}
          </text>
          <text x={X(0) - 10} y={Y(last.value) + 20} className={s.svgStrong} textAnchor="end">
            {last.value} left
          </text>
          <text x={pad.l} y={h - 8} className={s.svgLabel}>
            {fmtShort(c.series[0].day - 4)}
          </text>
        </svg>
      )}
    </div>
  );
}

/* ── Bars: ranked, one scale ─────────────────────────────────────────────── */

function Bars({ c, link }: { c: Extract<Chart, { kind: "bars" }>; link: Link }) {
  const div = c.diverge;
  return (
    <div className={s.bars}>
      {div && (
        <div className={s.barsDivergeHead}>
          <span />
          <span className={s.divergeHeads}>
            <span>← {div.left}</span>
            <span>{div.right} →</span>
          </span>
          <span />
        </div>
      )}
      {c.rows.map((r, i) => {
        const pct = (Math.abs(r.value) / c.max) * 100;
        const color = r.color ?? TONE[r.tone];
        return (
          <div
            key={r.id}
            className={`${s.barRow} ${s.mark} ${dim(link, r.id)} ${lit(link, r.id)}`}
            style={{ "--i": i } as CSSProperties}
            {...mark(link, [r.id], r.say)}
            aria-label={r.say}
          >
            <span className={s.barLabel}>
              <span className={s.barName}>{r.label}</span>
              {r.sub && <span className={s.barSub}>{r.sub}</span>}
            </span>
            {div ? (
              <span className={s.barTrackDiverge}>
                <span className={s.divergeHalf}>
                  {r.value < 0 && <span className={s.barFill} style={{ width: `${pct}%`, background: color, marginLeft: "auto", transformOrigin: "right" }} />}
                </span>
                <span className={s.divergeZero} />
                <span className={s.divergeHalf}>{r.value >= 0 && <span className={s.barFill} style={{ width: `${Math.max(pct, 1.5)}%`, background: color }} />}</span>
              </span>
            ) : (
              <span className={`${s.barTrack} ${c.share ? s.barTrackShare : ""}`}>
                {r.segs ? (
                  <span className={s.barStack} style={{ width: `${pct}%` }}>
                    {r.segs
                      .filter((g) => g.value > 0)
                      .map((g, k) => (
                        <span key={k} className={s.barSeg} style={{ flexGrow: g.value, background: TONE[g.tone] }} />
                      ))}
                  </span>
                ) : (
                  <span className={s.barFill} style={{ width: `${Math.max(pct, r.value ? 1.5 : 0)}%`, background: color }} />
                )}
                {!r.value && <span className={s.barZero} />}
              </span>
            )}
            <span className={`${s.barValue} ${r.tone === "key" || r.tone === "late" ? s.barValueKey : ""}`}>{r.display}</span>
          </div>
        );
      })}
      {c.legend && (
        <div className={s.legend}>
          {c.legend.map((l) => (
            <span key={l.label} className={s.legendItem}>
              <span className={s.legendSwatch} style={{ background: TONE[l.tone] }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Slope: last week to this week ──────────────────────────────────────── */

function spread(ys: number[], gap: number) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, z) => a.y - z.y);
  for (let k = 1; k < order.length; k++) if (order[k].y - order[k - 1].y < gap) order[k].y = order[k - 1].y + gap;
  const out = [...ys];
  order.forEach((o) => (out[o.i] = o.y));
  return out;
}

function Slope({ c, link }: { c: Extract<Chart, { kind: "slope" }>; link: Link }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 250;
  const max = Math.max(...c.rows.flatMap((r) => [r.a, r.b]));
  const top = 34;
  const bottom = h - 16;
  const Y = (v: number) => bottom - (v / max) * (bottom - top);
  const narrow = w < 520;
  const xa = narrow ? 36 : Math.max(120, w * 0.2);
  const xb = narrow ? w - 150 : Math.min(w - 220, w * 0.66);
  const la = spread(c.rows.map((r) => Y(r.a)), 17);
  const lb = spread(c.rows.map((r) => Y(r.b)), 17);
  const stroke = (g: boolean | null) => (g === null ? "var(--c5-plain)" : g ? "var(--v3-success)" : "var(--v3-danger)");
  return (
    <div ref={ref} className={s.svgWrap} style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Last week beside this week">
          <text x={xa} y={14} className={s.svgStrong} textAnchor="middle">
            {c.left}
          </text>
          <text x={xb} y={14} className={s.svgStrong} textAnchor="middle">
            {c.right}
          </text>
          <line x1={xa} x2={xa} y1={top - 8} y2={bottom} className={s.axisLine} />
          <line x1={xb} x2={xb} y1={top - 8} y2={bottom} className={s.axisLine} />
          {c.rows.map((r, i) => (
            <g key={r.id} className={`${s.mark} ${dim(link, r.id)} ${lit(link, r.id)}`} {...mark(link, [r.id], r.say)}>
              <line x1={xa} x2={xb} y1={Y(r.a)} y2={Y(r.b)} stroke="transparent" strokeWidth={14} />
              <line x1={xa} x2={xb} y1={Y(r.a)} y2={Y(r.b)} stroke={stroke(r.good)} className={s.slopeLine} style={{ "--i": i } as CSSProperties} />
              <circle cx={xa} cy={Y(r.a)} r={4} fill={stroke(r.good)} />
              <circle cx={xb} cy={Y(r.b)} r={4.5} fill={stroke(r.good)} />
              <text x={xa - 10} y={la[i] + 4} className={s.svgNum} textAnchor="end">
                {r.a}
              </text>
              <text x={xb + 10} y={lb[i] + 4} className={s.svgNum}>
                {r.b}
              </text>
              <text x={xb + 30} y={lb[i] + 4} className={s.svgRowLabel}>
                {r.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ── Waffle: 100 squares of open time ───────────────────────────────────── */

function Waffle({ c, link }: { c: Extract<Chart, { kind: "waffle" }>; link: Link }) {
  const cells: { id: string; tone: Tone; say: string }[] = [];
  c.parts.forEach((p) => {
    for (let i = 0; i < p.pct; i++) cells.push({ id: p.id, tone: p.tone, say: p.say });
  });
  return (
    <div className={s.waffleWrap}>
      <div className={s.waffle} role="img" aria-label={c.parts.map((p) => `${p.label} ${p.pct}%`).join(", ")}>
        {cells.map((cell, i) => (
          <span
            key={i}
            className={`${s.waffleCell} ${dim(link, cell.id)}`}
            style={{ background: TONE[cell.tone], "--i": i } as CSSProperties}
            onMouseEnter={() => link.point([cell.id], cell.say)}
            onMouseLeave={link.leave}
          />
        ))}
      </div>
      <ul className={s.waffleKey}>
        {c.parts.map((p) => (
          <li key={p.id} className={`${s.waffleKeyRow} ${s.mark} ${dim(link, p.id)} ${lit(link, p.id)}`} {...mark(link, [p.id], p.say)}>
            <span className={s.legendSwatch} style={{ background: TONE[p.tone] }} />
            <span className={s.waffleKeyLabel}>{p.label}</span>
            <span className={s.waffleKeyPct}>{p.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Dots: tasks on one line, split into lanes ──────────────────────────── */

function Dots({ c, link }: { c: Extract<Chart, { kind: "dots" }>; link: Link }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const narrow = w < 560;
  const laneH = 46;
  const labelW = narrow ? 0 : 170;
  const top = narrow ? 22 : 8;
  const h = top + c.lanes.length * (laneH + (narrow ? 18 : 0)) + 30;
  const X = (x: number) => labelW + 16 + ((x - c.min) / (c.max - c.min)) * (w - labelW - 40);
  const dated = c.axis === "Due date";
  const laneY = (i: number) => top + i * (laneH + (narrow ? 18 : 0)) + (narrow ? 18 : 0) + laneH / 2;
  const weekends: number[] = [];
  if (dated) for (let d = c.min; d <= c.max; d++) if ([0, 6].includes(dateOf(d).getDay())) weekends.push(d);
  const unit = (w - labelW - 40) / (c.max - c.min);
  return (
    <div ref={ref} className={s.svgWrap} style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={c.axis}>
          {weekends.map((d) => (
            <rect key={d} x={X(d) - unit / 2} y={top} width={unit} height={h - top - 30} className={s.weekend} />
          ))}
          {c.lanes.map((lane, i) => (
            <g key={lane.id}>
              <line x1={labelW + 8} x2={w - 12} y1={laneY(i)} y2={laneY(i)} className={s.laneLine} />
              {narrow ? (
                <text x={4} y={laneY(i) - laneH / 2 - 2} className={s.svgLabel}>
                  {lane.label}
                </text>
              ) : (
                <text x={0} y={laneY(i) + 4} className={s.svgRowLabel}>
                  {lane.label}
                </text>
              )}
              {lane.color && !narrow && <circle cx={labelW - 4} cy={laneY(i)} r={4} fill={lane.color} />}
            </g>
          ))}
          {c.ticks.map((t) => (
            <g key={t.x}>
              <line x1={X(t.x)} x2={X(t.x)} y1={top} y2={h - 26} className={t.label === "Today" ? s.todayLine : s.tickLine} />
              <text x={X(t.x)} y={h - 8} className={s.svgLabel} textAnchor={t.x === c.min ? "start" : "middle"}>
                {t.label}
              </text>
            </g>
          ))}
          {c.lanes.map((lane, li) => {
            const pts = c.points.filter((p) => p.lane === lane.id).sort((a, z) => a.x - z.x);
            return pts.map((p, k) => {
              const right = (k < pts.length - 1 ? X(pts[k + 1].x) : w - 4) - X(p.x) - 18;
              const leftRoom = X(p.x) - (k > 0 ? X(pts[k - 1].x) + 60 : labelW + 12) - 14;
              const need = p.label.length * 6.9;
              const onLeft = right < need && leftRoom > right && k === pts.length - 1;
              const room = onLeft ? leftRoom : right;
              const same = pts.filter((q) => q.x === p.x);
              const stack = same.indexOf(p);
              const cy = laneY(li) + (same.length > 1 ? (stack - (same.length - 1) / 2) * 14 : 0);
              const chars = Math.floor(room / 6.9);
              const text = chars >= 6 ? (p.label.length > chars ? `${p.label.slice(0, chars - 1)}…` : p.label) : "";
              const color = p.color ?? TONE[p.tone];
              return (
                <g key={p.id} className={`${s.mark} ${dim(link, p.id)} ${lit(link, p.id)}`} {...mark(link, [p.id], p.say)}>
                  <circle cx={X(p.x)} cy={cy} r={12} className={s.hit} />
                  <circle cx={X(p.x)} cy={cy} r={6.5} fill={color} className={s.dotPop} style={{ "--i": k + li } as CSSProperties} />
                  {text && stack === 0 && (
                    <text x={X(p.x) + (onLeft ? -11 : 11)} y={cy + 4} className={s.svgRowLabel} textAnchor={onLeft ? "end" : "start"}>
                      {text}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      )}
    </div>
  );
}

/* ── Range: usual days, with the middle half ────────────────────────────── */

function Range({ c, link }: { c: Extract<Chart, { kind: "range" }>; link: Link }) {
  const P = (v: number) => `${(v / c.max) * 100}%`;
  return (
    <div className={s.range}>
      <div className={s.rangeRows}>
        {c.rows.map((r, i) => {
          const color = r.color ?? TONE[r.tone];
          return (
            <div
              key={r.id}
              className={`${s.rangeRow} ${s.mark} ${dim(link, r.id)} ${lit(link, r.id)}`}
              style={{ "--i": i } as CSSProperties}
              {...mark(link, [r.id], r.say)}
              aria-label={r.say}
            >
              <span className={s.barName}>{r.label}</span>
              <span className={s.rangeTrack}>
                <span className={s.rangeSpan} style={{ left: P(r.p25), width: `calc(${P(r.p75 - r.p25)})`, background: color }} />
                <span className={s.rangeDot} style={{ left: P(r.median), background: color }} />
              </span>
              <span className={`${s.barValue} ${r.tone === "key" ? s.barValueKey : ""}`}>{r.median} days</span>
            </div>
          );
        })}
        <div className={s.rangeTypicalWrap} aria-hidden>
          <span />
          <span className={s.rangeTypicalTrack}>
            <span className={`${s.rangeTypical} ${dim(link, "typical")}`} style={{ left: P(c.typical) }}>
              <span className={s.rangeTypicalLabel}>Most things: {c.typical} days</span>
            </span>
          </span>
          <span />
        </div>
      </div>
    </div>
  );
}

/* ── Columns: one per week ──────────────────────────────────────────────── */

function Columns({ c, link }: { c: Extract<Chart, { kind: "columns" }>; link: Link }) {
  const max = Math.max(...c.cols.map((x) => x.value), ...(c.lines ?? []).map((l) => l.value), 1);
  const n = c.cols.length;
  return (
    <div className={s.cols}>
      <div className={s.colsPlot}>
        {c.cols.map((col, i) => (
          <div key={col.id} className={`${s.col} ${s.mark} ${dim(link, col.id)} ${lit(link, col.id)}`} {...mark(link, [col.id], col.say)} aria-label={col.say}>
            <span className={s.colValue}>{col.value}</span>
            <span className={s.colBar} style={{ height: `${(col.value / max) * 100}%`, background: TONE[col.tone], "--i": i } as CSSProperties} />
          </div>
        ))}
        {c.lines?.map((l) => (
          <span
            key={l.id}
            className={`${s.colLine} ${s.mark} ${dim(link, l.id)} ${lit(link, l.id)}`}
            style={{ left: `${(l.from / n) * 100}%`, width: `${((l.to - l.from + 1) / n) * 100}%`, bottom: `${(l.value / max) * 100}%` }}
            {...mark(link, [l.id], l.say)}
          >
            <span className={s.colLineLabel}>{l.label}</span>
          </span>
        ))}
      </div>
      <div className={s.colsAxis}>
        <span>Week of {c.cols[0].label}</span>
        <span>This week</span>
      </div>
    </div>
  );
}

/* ── Week: next week, Monday to Friday ──────────────────────────────────── */

function Week({ c, link }: { c: Extract<Chart, { kind: "week" }>; link: Link }) {
  return (
    <div className={s.week}>
      {c.days.map((d, di) => {
        const items = c.items.filter((x) => x.day === di).sort((a, z) => (a.rank ?? 9) - (z.rank ?? 9));
        return (
          <div key={d.label} className={s.weekDay}>
            <div className={s.weekHead}>
              <span className={s.weekName}>{d.label}</span>
              <span className={s.weekDate}>{d.date}</span>
            </div>
            <div className={s.weekItems}>
              {items.length === 0 && <span className={s.weekEmpty}>Nothing due</span>}
              {items.map((x, k) => (
                <div
                  key={x.id}
                  className={`${s.weekItem} ${x.rank ? s.weekItemRanked : ""} ${s.mark} ${dim(link, x.id)} ${lit(link, x.id)}`}
                  style={{ "--i": di * 2 + k, ...(x.color ? { "--c5-item": x.color } : {}) } as CSSProperties}
                  {...mark(link, [x.id], x.say)}
                >
                  {x.rank ? <span className={s.weekRank}>{x.rank}</span> : null}
                  <span className={s.weekTitle}>{x.title}</span>
                  <span className={s.weekWho}>{x.project ? `${x.person} · ${x.project}` : x.person}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Moves: each date a task was given, first to latest ─────────────────── */

function Moves({ c, link }: { c: Extract<Chart, { kind: "moves" }>; link: Link }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const narrow = w < 600;
  const labelW = narrow ? 0 : 210;
  const rowH = narrow ? 58 : 44;
  const top = 26;
  const h = top + c.rows.length * rowH + 28;
  const X = (d: Day) => labelW + 14 + ((d - c.min) / (c.max - c.min)) * (w - labelW - 34);
  return (
    <div ref={ref} className={s.svgWrap} style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Each moved task, from its first date to its date now">
          <line x1={X(0)} x2={X(0)} y1={top - 10} y2={h - 26} className={s.todayLine} />
          <text x={X(0)} y={top - 14} className={s.svgLabel} textAnchor="middle">
            Today
          </text>
          {c.target && (
            <>
              <line x1={X(c.target.day)} x2={X(c.target.day)} y1={top - 10} y2={h - 26} className={s.targetLine} />
              <text x={X(c.target.day)} y={top - 14} className={s.svgStrong} textAnchor="middle">
                {fmtShort(c.target.day)}
              </text>
            </>
          )}
          {c.rows.map((r, i) => {
            const y = top + i * rowH + (narrow ? 38 : rowH / 2);
            const last = r.hops[r.hops.length - 1];
            const key = i === 0;
            return (
              <g key={r.id} className={`${s.mark} ${dim(link, r.id)} ${lit(link, r.id)}`} {...mark(link, [r.id], r.say)}>
                <rect x={0} y={y - (narrow ? 34 : rowH / 2)} width={w} height={rowH} className={s.hitRect} />
                {narrow ? (
                  <text x={0} y={y - 16} className={s.svgRowLabel}>
                    {r.label}
                    <tspan className={s.svgLabel}> · {r.sub}</tspan>
                  </text>
                ) : (
                  <>
                    <text x={0} y={y - 2} className={s.svgRowLabel}>
                      {r.label}
                    </text>
                    <text x={0} y={y + 13} className={s.svgLabel}>
                      {r.sub}
                    </text>
                  </>
                )}
                <line x1={X(r.from)} x2={X(last)} y1={y} y2={y} className={key ? s.moveLineKey : s.moveLine} />
                <circle cx={X(r.from)} cy={y} r={5} className={s.ring} />
                {r.hops.slice(0, -1).map((d, k) => (
                  <circle key={k} cx={X(d)} cy={y} r={3} className={key ? s.dotKey : s.dotInk} />
                ))}
                <circle cx={X(last)} cy={y} r={6} className={key ? s.dotKey : s.dotInk} />
                <text x={X(last) + 10} y={y + 4} className={s.svgNum}>
                  {fmtShort(last)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ── Glyphs: the tiny preview of each answer's shape ────────────────────── */

export function Glyph({ kind, muted = false }: { kind: Chart["kind"]; muted?: boolean }) {
  const a = muted ? "var(--c5-idle)" : "var(--v3-accent)";
  const g = "var(--c5-idle)";
  const common = { width: 44, height: 28, viewBox: "0 0 44 28", "aria-hidden": true, className: s.glyph };
  switch (kind) {
    case "course":
      return (
        <svg {...common}>
          <path d="M2 5 L12 7 L20 9 L27 15" fill="none" stroke={g} strokeWidth="2" strokeLinecap="round" />
          <path d="M27 15 L36 24" fill="none" stroke={a} strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
          <line x1="39" x2="39" y1="3" y2="26" stroke={a} strokeWidth="1.5" />
        </svg>
      );
    case "slope":
      return (
        <svg {...common}>
          <path d="M8 20 L36 8" stroke={a} strokeWidth="2" />
          <path d="M8 10 L36 18" stroke={g} strokeWidth="2" />
          <path d="M8 15 L36 14" stroke={g} strokeWidth="2" />
          <circle cx="8" cy="20" r="2.5" fill={a} />
          <circle cx="36" cy="8" r="2.5" fill={a} />
        </svg>
      );
    case "bars":
      return (
        <svg {...common}>
          <rect x="2" y="3" width="36" height="5" rx="2" fill={a} />
          <rect x="2" y="11.5" width="22" height="5" rx="2" fill={g} />
          <rect x="2" y="20" width="14" height="5" rx="2" fill={g} />
        </svg>
      );
    case "waffle":
      return (
        <svg {...common}>
          {Array.from({ length: 24 }, (_, i) => (
            <rect key={i} x={8 + (i % 6) * 5} y={2 + Math.floor(i / 6) * 6.2} width="4" height="4.4" rx="1" fill={i < 9 ? a : g} />
          ))}
        </svg>
      );
    case "dots":
      return (
        <svg {...common}>
          <line x1="2" x2="42" y1="9" y2="9" stroke={g} strokeWidth="1" />
          <line x1="2" x2="42" y1="20" y2="20" stroke={g} strokeWidth="1" />
          <circle cx="30" cy="9" r="3" fill={a} />
          <circle cx="14" cy="9" r="3" fill={a} />
          <circle cx="22" cy="20" r="3" fill={g} />
        </svg>
      );
    case "range":
      return (
        <svg {...common}>
          <line x1="16" x2="40" y1="7" y2="7" stroke={a} strokeWidth="3" strokeLinecap="round" />
          <circle cx="28" cy="7" r="3.5" fill={a} />
          <line x1="6" x2="20" y1="20" y2="20" stroke={g} strokeWidth="3" strokeLinecap="round" />
          <circle cx="12" cy="20" r="3.5" fill={g} />
        </svg>
      );
    case "columns":
      return (
        <svg {...common}>
          {[10, 14, 8, 16, 12, 18, 22].map((v, i) => (
            <rect key={i} x={3 + i * 5.8} y={26 - v} width="4" height={v} rx="1" fill={i === 6 ? a : g} />
          ))}
        </svg>
      );
    case "week":
      return (
        <svg {...common}>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={2 + i * 8.4} y="3" width="7" height="22" rx="1.5" fill="none" stroke={g} strokeWidth="1" />
          ))}
          <rect x="3.5" y="6" width="4" height="4" rx="1" fill={a} />
          <rect x="20.3" y="6" width="4" height="4" rx="1" fill={a} />
          <rect x="3.5" y="12" width="4" height="4" rx="1" fill={g} />
        </svg>
      );
    case "moves":
      return (
        <svg {...common}>
          <line x1="6" x2="34" y1="8" y2="8" stroke={a} strokeWidth="1.5" />
          <circle cx="6" cy="8" r="3" fill="none" stroke={a} strokeWidth="1.5" />
          <circle cx="20" cy="8" r="2" fill={a} />
          <circle cx="34" cy="8" r="3" fill={a} />
          <line x1="10" x2="26" y1="20" y2="20" stroke={g} strokeWidth="1.5" />
          <circle cx="10" cy="20" r="3" fill="none" stroke={g} strokeWidth="1.5" />
          <circle cx="26" cy="20" r="3" fill={g} />
        </svg>
      );
  }
}
