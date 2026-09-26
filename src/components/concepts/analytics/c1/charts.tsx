"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { Glyph, Note, NoteChart, Tone } from "./data";
import styles from "./letter.module.css";

/* ── colour helpers: every mark reads from v3 tokens ─────────────── */

const TONE: Record<Tone, string> = {
  accent: "var(--v3-accent)",
  warning: "var(--v3-warning-stroke)",
  neutral: "var(--v3-text-2)",
};
const BASE = "var(--v3-control-border)";
const QUIET = "var(--v3-border-strong)";

/* ── word-sized glyphs, set into the sentence ─────────────────────── */

export function InlineGlyph({ glyph, lit }: { glyph: Glyph; lit: boolean }) {
  const cls = `${styles.glyph} ${lit ? styles.glyphLit : ""}`;
  if (glyph.type === "spark") {
    const n = glyph.values.length;
    const max = Math.max(...glyph.values, 1);
    const step = 4.6;
    const w = n * step - 1.4;
    return (
      <svg className={cls} width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden="true">
        {glyph.values.map((v, i) => {
          const h = Math.max(1.5, (v / max) * 13);
          return <rect key={i} x={i * step} y={14 - h} width={3.2} height={h} rx={0.8} fill={i === glyph.current ? TONE.accent : BASE} />;
        })}
      </svg>
    );
  }
  if (glyph.type === "trail") {
    const gap = 11;
    const w = (glyph.stops - 1) * gap + 8;
    return (
      <svg className={cls} width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden="true">
        <line x1={4} x2={w - 4} y1={7} y2={7} stroke={BASE} strokeWidth={1.2} strokeDasharray="1.6 2" />
        {Array.from({ length: glyph.stops }, (_, i) => {
          const last = i === glyph.stops - 1;
          return (
            <circle
              key={i}
              cx={4 + i * gap}
              cy={7}
              r={last ? 3.2 : 2.6}
              fill={last ? TONE.warning : "var(--v3-canvas)"}
              stroke={last ? TONE.warning : BASE}
              strokeWidth={1.3}
            />
          );
        })}
      </svg>
    );
  }
  if (glyph.type === "squares") {
    const s = 5.5;
    const step = 7.5;
    const w = glyph.total * step - 2;
    return (
      <svg className={cls} width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden="true">
        {Array.from({ length: glyph.total }, (_, i) => {
          const on = i < glyph.lit;
          return (
            <rect
              key={i}
              x={i * step + 0.5}
              y={4.5}
              width={s - 1}
              height={s - 1}
              rx={1}
              fill={on ? TONE[glyph.tone] : "transparent"}
              stroke={on ? TONE[glyph.tone] : BASE}
              strokeWidth={1}
            />
          );
        })}
      </svg>
    );
  }
  const n = glyph.values.length;
  const max = Math.max(...glyph.values, 1);
  const step = n > 14 ? 3.6 : 4.8;
  const w = n * step - 1.2;
  return (
    <svg className={cls} width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden="true">
      <line x1={0} x2={w} y1={13.6} y2={13.6} stroke={QUIET} strokeWidth={0.8} />
      {glyph.values.map((v, i) => {
        const h = v === 0 ? 0 : Math.max(2, (v / max) * 12.5);
        const on = i >= glyph.lit[0] && i <= glyph.lit[1];
        return h ? <rect key={i} x={i * step} y={13.2 - h} width={step - 1.2} height={h} rx={0.6} fill={on ? TONE.accent : BASE} /> : null;
      })}
    </svg>
  );
}

/* ── mark resolution ──────────────────────────────────────────────── */

function markSet(mark: string | null | undefined): Set<string> {
  return new Set((mark ?? "").split(",").filter(Boolean));
}

function weekIndexes(mark: string | null | undefined, n: number): Set<number> {
  const set = new Set<number>();
  if (!mark) return set;
  if (mark === "last4") {
    for (let i = Math.max(0, n - 4); i < n; i++) set.add(i);
    return set;
  }
  for (const m of markSet(mark)) {
    const i = Number(m.replace(/^w/, ""));
    if (!Number.isNaN(i)) set.add(i);
  }
  return set;
}

function dayIndexes(chart: Extract<NoteChart, { type: "days" }>, mark: string | null | undefined): Set<number> {
  const set = new Set<number>();
  if (!mark) return set;
  if (mark.startsWith("d")) {
    set.add(Number(mark.slice(1)));
    return set;
  }
  const range = chart.ranges[mark];
  if (range) for (let i = range[0]; i <= range[1]; i++) set.add(i);
  return set;
}

/** Plain-language reading of whatever is lit. */
export function describe(chart: NoteChart, mark: string | null | undefined): string {
  switch (chart.type) {
    case "weeks": {
      const idx = [...weekIndexes(mark, chart.values.length)];
      if (idx.length === 0) return "";
      if (idx.length > 1) {
        const sum = idx.reduce((a, i) => a + chart.values[i], 0);
        return `${chart.starts[idx[0]]} to ${chart.starts[idx[idx.length - 1]]}: ${sum} ${chart.unit}`;
      }
      const i = idx[0];
      const added = chart.added ? `, ${chart.added[i]} added` : "";
      return `Week of ${chart.starts[i]}: ${chart.values[i]} ${chart.unit}${added}`;
    }
    case "people": {
      const row = chart.rows.find((r) => r.name === mark);
      if (!row) return "";
      const open = row.soon + row.later;
      return `${row.name}: ${row.done} done, ${open} open, ${row.soon} ${chart.soonLabel}`;
    }
    case "units": {
      if (mark === "all") return chart.allLabel ?? "";
      const names = markSet(mark);
      const rows = chart.rows.filter((r) => names.has(r.name));
      return rows.map((r) => `${r.name}: ${r.lit} of ${r.total} ${chart.litLabel}`).join(" · ");
    }
    case "days": {
      if (mark === "nobody") {
        const n = chart.days.reduce((a, d) => a + (d.nobody ?? 0), 0);
        return `${n} due next week with nobody on them`;
      }
      const idx = [...dayIndexes(chart, mark)];
      if (idx.length === 0) return "";
      const sum = idx.reduce((a, i) => a + chart.days[i].count, 0);
      if (idx.length === 1) return `${chart.days[idx[0]].label}: ${sum} due`;
      const short = (i: number) => chart.days[i].label.replace(/^\w+ /, "");
      return `${short(idx[0])} to ${short(idx[idx.length - 1])}: ${sum} due`;
    }
    case "bars": {
      if (mark === "all") return chart.allLabel ?? "";
      const row = chart.rows.find((r) => r.name === mark);
      return row ? `${row.name}: ${row.value} ${row.unit}`.trim() : "";
    }
    case "trail": {
      const item = chart.items.find((it) => it.name === mark);
      if (!item) return "";
      return `${item.name}: ${item.points.map((p) => p.label).join(" → ")}`;
    }
    case "figure":
      return "";
    case "course": {
      const i = mark === "x" || !mark ? chart.current : Number(mark.replace(/^w/, ""));
      const b = chart.behind[i];
      if (b == null) return "";
      return `Week of ${chart.starts[i]}: ${b === 0 ? "on course" : `${b} ${b === 1 ? "week" : "weeks"} behind`}`;
    }
  }
}

/* ── the sidenote charts ──────────────────────────────────────────── */

const W = 232;

type ChartProps = {
  chart: NoteChart;
  mark: string | null;
  onFocusMark: (mark: string | null) => void;
  label: string;
};

function useRoving(keys: string[], onFocusMark: (m: string | null) => void, mark: string | null) {
  return {
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const at = mark ? keys.indexOf(mark) : -1;
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      const next = at === -1 ? (dir > 0 ? 0 : keys.length - 1) : Math.min(keys.length - 1, Math.max(0, at + dir));
      onFocusMark(keys[next]);
    },
  };
}

function WeeksChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "weeks" }> }) {
  const n = chart.values.length;
  const H = 64;
  const top = 14;
  const bottom = 16;
  const plot = H - top - bottom;
  const max = Math.max(...chart.values, 1);
  const band = W / Math.max(n, 6);
  const bw = Math.min(12, band * 0.62);
  const lit = weekIndexes(mark, n);
  const keys = chart.values.map((_, i) => `w${i}`);
  const y = (v: number) => top + plot - (v / max) * plot;
  const labelled = lit.size === 1 ? [...lit][0] : lit.size > 1 ? -1 : chart.current;
  const roving = useRoving(keys, onFocusMark, mark);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      {...roving}
      onFocus={() => onFocusMark(mark ?? `w${chart.current}`)}
      onMouseLeave={() => onFocusMark(null)}
    >
      <line x1={0} x2={W} y1={top + plot + 0.5} y2={top + plot + 0.5} stroke={QUIET} />
      {chart.values.map((v, i) => {
        const x = i * band + (band - bw) / 2;
        const on = lit.has(i);
        const dim = lit.size > 0 && !on;
        return (
          <g key={i} onMouseEnter={() => onFocusMark(`w${i}`)}>
            <rect x={i * band} y={0} width={band} height={H} fill="transparent" />
            <rect
              className={styles.mark}
              x={x}
              y={y(v)}
              width={bw}
              height={Math.max(1, (v / max) * plot)}
              rx={1.5}
              fill={on ? TONE.accent : BASE}
              opacity={dim ? 0.42 : 1}
            />

            {i === labelled || (lit.size > 1 && i === Math.max(...lit)) ? (
              <text className={styles.chartValue} x={x + bw / 2} y={y(v) - 4} textAnchor="middle">
                {lit.size > 1 ? [...lit].reduce((a, k) => a + chart.values[k], 0) : v}
              </text>
            ) : null}
          </g>
        );
      })}
      {lit.size > 1 ? (
        <line
          x1={Math.min(...lit) * band + 2}
          x2={(Math.max(...lit) + 1) * band - 2}
          y1={top + plot + 4}
          y2={top + plot + 4}
          stroke={TONE.accent}
          strokeWidth={1.5}
        />
      ) : null}
      <text className={styles.chartAxis} x={Math.max(0, band / 2 - 14)} y={H - 3}>
        {chart.starts[0]}
      </text>
      {n > 1 ? (
        <text className={styles.chartAxis} x={Math.min(W, (n - 0.5) * band + 14)} y={H - 3} textAnchor="end">
          {chart.starts[n - 1]}
        </text>
      ) : null}
    </svg>
  );
}

function PeopleChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "people" }> }) {
  const rowH = 20;
  const H = chart.rows.length * rowH;
  const nameW = 78;
  const endW = 44;
  const max = Math.max(...chart.rows.map((r) => r.done + r.soon + r.later), 1);
  const unit = (W - nameW - endW) / max;
  const keys = chart.rows.map((r) => r.name);
  const roving = useRoving(keys, onFocusMark, mark);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...roving} onFocus={() => onFocusMark(mark ?? keys[0])} onMouseLeave={() => onFocusMark(null)}>
      {chart.rows.map((r, i) => {
        const yy = i * rowH + 4.5;
        const dim = mark != null && mark !== r.name;
        const segs: [number, string][] = [
          [r.done, TONE.accent],
          [r.soon, TONE.warning],
          [r.later, BASE],
        ];
        let x = nameW;
        return (
          <g key={r.name} opacity={dim ? 0.4 : 1} onMouseEnter={() => onFocusMark(r.name)} className={styles.mark}>
            <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
            <text className={styles.chartLabel} x={0} y={yy + 8.5}>
              {r.name}
            </text>
            {segs.map(([v, fill], k) => {
              const rect = v > 0 ? <rect key={k} x={x + 0.5} y={yy} width={Math.max(0, v * unit - 1.5)} height={10} rx={2} fill={fill} /> : null;
              x += v * unit;
              return rect;
            })}
            <text className={styles.chartAxis} x={W} y={yy + 8.5} textAnchor="end">
              {r.soon + r.later} open
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function UnitsChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "units" }> }) {
  const rowH = 19;
  const H = chart.rows.length * rowH;
  const nameW = Math.min(104, 8 + Math.max(...chart.rows.map((r) => r.name.length)) * 6.4);
  const countW = 40;
  const maxTotal = Math.max(...chart.rows.map((r) => r.total), 1);
  const step = Math.min(12.5, (W - nameW - countW) / maxTotal);
  const s = Math.min(9, step - 2.5);
  const names = markSet(mark);
  const all = mark === "all";
  const keys = chart.rows.map((r) => r.name);
  const roving = useRoving(keys, onFocusMark, mark);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...roving} onFocus={() => onFocusMark(mark ?? keys[0])} onMouseLeave={() => onFocusMark(null)}>
      {chart.rows.map((r, i) => {
        const yy = i * rowH;
        const dim = names.size > 0 && !all && !names.has(r.name);
        return (
          <g key={r.name} opacity={dim ? 0.38 : 1} onMouseEnter={() => onFocusMark(r.name)} className={styles.mark}>
            <rect x={0} y={yy} width={W} height={rowH} fill="transparent" />
            <text className={styles.chartLabel} x={0} y={yy + 13}>
              {r.name}
            </text>
            {Array.from({ length: r.total }, (_, k) => {
              const on = k < r.lit;
              return (
                <rect
                  key={k}
                  x={nameW + k * step + 0.5}
                  y={yy + 4.5 + (9 - s) / 2}
                  width={s}
                  height={s}
                  rx={1.5}
                  fill={on ? TONE[chart.tone] : "transparent"}
                  stroke={on ? TONE[chart.tone] : BASE}
                />
              );
            })}
            <text className={styles.chartAxis} x={W} y={yy + 13} textAnchor="end">
              {r.lit} of {r.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DaysChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "days" }> }) {
  const n = chart.days.length;
  const H = 64;
  const top = 14;
  const bottom = 16;
  const plot = H - top - bottom;
  const max = Math.max(...chart.days.map((d) => d.count), 1);
  const band = W / n;
  const bw = band * 0.64;
  const lit = dayIndexes(chart, mark === "nobody" ? "next" : mark);
  const nobodyMode = mark === "nobody";
  const keys = chart.days.map((_, i) => `d${i}`);
  const y = (v: number) => top + plot - (v / max) * plot;
  const roving = useRoving(keys, onFocusMark, mark && mark.startsWith("d") ? mark : null);
  const single = lit.size === 1 ? [...lit][0] : -1;
  const maxAt = chart.days.findIndex((d) => d.count === max);
  const short = (i: number) => chart.days[i].label.replace(/^\w+ /, "");
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...roving} onFocus={() => onFocusMark(mark ?? "d0")} onMouseLeave={() => onFocusMark(null)}>
      {chart.days.map((d, i) =>
        d.weekend ? <rect key={`we${i}`} x={i * band} y={top - 4} width={band} height={plot + 4} fill="var(--v3-sunken)" /> : null,
      )}
      <line x1={0} x2={W} y1={top + plot + 0.5} y2={top + plot + 0.5} stroke={QUIET} />
      {chart.days.map((d, i) => {
        const x = i * band + (band - bw) / 2;
        const on = lit.has(i);
        const dim = lit.size > 0 && !on;
        const nob = d.nobody ?? 0;
        const h = (d.count / max) * plot;
        const hn = (nob / max) * plot;
        return (
          <g key={i} onMouseEnter={() => onFocusMark(`d${i}`)} opacity={dim ? 0.42 : 1} className={styles.mark}>
            <rect x={i * band} y={0} width={band} height={H} fill="transparent" />
            {d.count > 0 ? (
              <>
                <rect x={x} y={y(d.count)} width={bw} height={h} rx={1.5} fill={on && !nobodyMode ? TONE.accent : BASE} />
                {nob > 0 ? (
                  <rect x={x} y={y(d.count)} width={bw} height={hn} rx={1.5} fill={TONE.warning} opacity={nobodyMode || !mark ? 1 : 0.9} />
                ) : null}
              </>
            ) : (
              <rect x={x} y={top + plot - 1.5} width={bw} height={1.5} fill={BASE} />
            )}
            {(single === i || (single === -1 && i === maxAt)) && d.count > 0 ? (
              <text className={styles.chartValue} x={x + bw / 2} y={y(d.count) - 4} textAnchor="middle">
                {d.count}
              </text>
            ) : null}
          </g>
        );
      })}
      {lit.size > 1 ? (
        <line
          x1={Math.min(...lit) * band + 1}
          x2={(Math.max(...lit) + 1) * band - 1}
          y1={top + plot + 4}
          y2={top + plot + 4}
          stroke={nobodyMode ? TONE.warning : TONE.accent}
          strokeWidth={1.5}
        />
      ) : null}
      <text className={styles.chartAxis} x={0} y={H - 3}>
        {short(0)}
      </text>
      <text className={styles.chartAxis} x={W} y={H - 3} textAnchor="end">
        {short(n - 1)}
      </text>
    </svg>
  );
}

function BarsChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "bars" }> }) {
  const rowH = 27;
  const H = chart.rows.length * rowH - 3;
  const max = Math.max(...chart.rows.map((r) => r.value), 1);
  const keys = chart.rows.map((r) => r.name);
  const roving = useRoving(keys, onFocusMark, mark);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...roving} onFocus={() => onFocusMark(mark ?? keys[0])} onMouseLeave={() => onFocusMark(null)}>
      {chart.rows.map((r, i) => {
        const yy = i * rowH;
        const dim = mark != null && mark !== "all" && mark !== r.name;
        return (
          <g key={r.name} opacity={dim ? 0.4 : 1} onMouseEnter={() => onFocusMark(r.name)} className={styles.mark}>
            <rect x={0} y={yy} width={W} height={rowH} fill="transparent" />
            <text className={styles.chartLabel} x={0} y={yy + 10}>
              {r.name}
            </text>
            <text className={styles.chartAxis} x={W} y={yy + 10} textAnchor="end">
              {r.value} {r.unit}
            </text>
            <rect x={0} y={yy + 14} width={Math.max(3, (r.value / max) * W)} height={8} rx={2} fill={chart.tone === "neutral" ? BASE : TONE[chart.tone]} />
          </g>
        );
      })}
    </svg>
  );
}

function TrailChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "trail" }> }) {
  const rowH = 40;
  const top = 14;
  const H = top + chart.items.length * rowH;
  const days = chart.items.flatMap((it) => it.points.map((p) => p.day)).concat(chart.today);
  const lo = Math.min(...days) - 2;
  const hi = Math.max(...days) + 2;
  const pad = 14;
  const x = (d: number) => pad + ((d - lo) / (hi - lo)) * (W - pad * 2);
  const keys = chart.items.map((it) => it.name);
  const roving = useRoving(keys, onFocusMark, mark);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...roving} onFocus={() => onFocusMark(mark ?? keys[0])} onMouseLeave={() => onFocusMark(null)}>
      <line x1={x(chart.today)} x2={x(chart.today)} y1={10} y2={H} stroke="var(--v3-text-3)" strokeDasharray="2 3" />
      <text className={styles.chartAxis} x={x(chart.today)} y={9} textAnchor="middle">
        Today
      </text>
      {chart.items.map((it, i) => {
        const yy = top + i * rowH;
        const dim = mark != null && mark !== it.name;
        const cy = yy + 18;
        return (
          <g key={it.name} opacity={dim ? 0.38 : 1} onMouseEnter={() => onFocusMark(it.name)} className={styles.mark}>
            <rect x={0} y={yy} width={W} height={rowH} fill="transparent" />
            <text className={styles.chartLabel} x={0} y={yy + 6}>
              {it.name}
            </text>
            {it.points.slice(1).map((p, k) => {
              const from = it.points[k];
              const x1 = x(from.day) + 4;
              const x2 = x(p.day) - 5;
              return (
                <g key={k}>
                  <path d={`M${x1} ${cy} Q ${(x1 + x2) / 2} ${cy - 9} ${x2} ${cy}`} fill="none" stroke={BASE} strokeWidth={1.2} />
                  <path d={`M${x2 - 3.5} ${cy - 3} L${x2} ${cy} L${x2 - 4} ${cy + 1}`} fill="none" stroke={BASE} strokeWidth={1.2} />
                </g>
              );
            })}
            {it.points.map((p, k) => {
              const last = k === it.points.length - 1;
              const room = last || x(it.points[k + 1].day) - x(p.day) > 40;
              const lx = Math.min(W - 16, Math.max(16, x(p.day)));
              return (
                <g key={k}>
                  <circle cx={x(p.day)} cy={cy} r={last ? 4 : 3.2} fill={last ? TONE.warning : "var(--v3-canvas)"} stroke={last ? TONE.warning : BASE} strokeWidth={1.4} />
                  {room ? (
                    <text className={last ? styles.chartValue : styles.chartAxis} x={lx} y={cy + 15} textAnchor="middle">
                      {p.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function CourseChart({ chart, mark, onFocusMark, label }: ChartProps & { chart: Extract<NoteChart, { type: "course" }> }) {
  const n = chart.behind.length;
  const maxB = Math.max(...chart.behind, 1);
  const levels = maxB + 1;
  const labelW = 84;
  const rowGap = 16;
  const top = 6;
  const H = top + (levels - 1) * rowGap + 27;
  const band = (W - labelW) / Math.max(n, 6);
  const cx = (i: number) => labelW + i * band + band / 2;
  const cy = (b: number) => top + b * rowGap + 4;
  const sel = mark === "x" || !mark ? chart.current : Number(mark.replace(/^w/, ""));
  const keys = chart.behind.map((_, i) => `w${i}`);
  const roving = useRoving(keys, onFocusMark, mark && mark !== "x" ? mark : `w${chart.current}`);
  const reached = [...new Set(chart.behind)].sort();
  const path = chart.behind.map((b, i) => `${i ? "L" : "M"}${cx(i)} ${cy(b)}`).join(" ");
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...roving} onFocus={() => onFocusMark(mark ?? `w${chart.current}`)} onMouseLeave={() => onFocusMark(null)}>
      {reached.map((b) => (
        <g key={b}>
          <line x1={labelW - 6} x2={W} y1={cy(b)} y2={cy(b)} stroke={QUIET} strokeDasharray={b === 0 ? undefined : "2 3"} />
          <text className={styles.chartAxis} x={0} y={cy(b) + 3.5}>
            {b === 0 ? "On course" : `${b} ${b === 1 ? "week" : "weeks"} behind`}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={BASE} strokeWidth={1.4} strokeLinejoin="round" />
      {chart.behind.map((b, i) => (
        <g key={i} onMouseEnter={() => onFocusMark(`w${i}`)}>
          <rect x={cx(i) - band / 2} y={0} width={band} height={H} fill="transparent" />
          <circle cx={cx(i)} cy={cy(b)} r={i === sel ? 4 : 2.6} fill={i === sel ? TONE.accent : b === 0 ? "var(--v3-canvas)" : BASE} stroke={i === sel ? TONE.accent : BASE} strokeWidth={1.3} />
        </g>
      ))}
      <text className={styles.chartAxis} x={cx(0)} y={H - 3} textAnchor="middle">
        {chart.starts[0]}
      </text>
      <text className={styles.chartAxis} x={Math.min(W - 14, cx(n - 1))} y={H - 3} textAnchor="middle">
        {chart.starts[n - 1]}
      </text>
    </svg>
  );
}

export function NoteChartView(props: ChartProps) {
  const { chart } = props;
  switch (chart.type) {
    case "weeks":
      return <WeeksChart {...props} chart={chart} />;
    case "people":
      return <PeopleChart {...props} chart={chart} />;
    case "units":
      return <UnitsChart {...props} chart={chart} />;
    case "days":
      return <DaysChart {...props} chart={chart} />;
    case "bars":
      return <BarsChart {...props} chart={chart} />;
    case "trail":
      return <TrailChart {...props} chart={chart} />;
    case "figure":
      return (
        <p className={styles.figure}>
          {chart.value}
          {chart.unit ? <span className={styles.figureUnit}> {chart.unit}</span> : null}
        </p>
      );
    case "course":
      return <CourseChart {...props} chart={chart} />;
  }
}

function LegendItem({ swatch, className, children }: { swatch?: string; className?: string; children: ReactNode }) {
  return (
    <span className={styles.legendItem}>
      <span className={`${styles.key} ${className ?? ""}`} style={swatch ? { background: swatch } : undefined} />
      {children}
    </span>
  );
}

function Legend({ chart }: { chart: NoteChart }) {
  if (chart.type === "people") {
    return (
      <p className={styles.legend}>
        <LegendItem swatch={TONE.accent}>done</LegendItem>
        <LegendItem swatch={TONE.warning}>{chart.soonLabel}</LegendItem>
        <LegendItem swatch={BASE}>later</LegendItem>
      </p>
    );
  }
  if (chart.type === "units") {
    return (
      <p className={styles.legend}>
        <LegendItem swatch={TONE[chart.tone]}>{chart.litLabel}</LegendItem>
        <LegendItem className={styles.keyHollow}>{chart.restLabel}</LegendItem>
      </p>
    );
  }
  if (chart.type === "trail") {
    return (
      <p className={styles.legend}>
        <LegendItem className={`${styles.keyHollow} ${styles.keyRound}`}>planned before</LegendItem>
        <LegendItem swatch={TONE.warning} className={styles.keyRound}>
          due now
        </LegendItem>
      </p>
    );
  }
  return null;
}

/** One sidenote: title, chart, then one line that is the legend at rest and a readout on hover. */
export function Sidenote({ note, external, lit, compact }: { note: Note; external: string | null; lit: boolean; compact?: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const pointed = hover ?? external;
  const mark = pointed ?? note.mark ?? null;
  const readout = describe(note.chart, mark);
  const hasLegend = ["people", "units", "trail"].includes(note.chart.type);
  const showReadout = Boolean(readout) && (compact || pointed != null || !hasLegend);
  return (
    <div className={`${styles.note} ${lit ? styles.noteLit : ""} ${compact ? styles.noteCompact : ""}`}>
      <p className={styles.noteTitle}>{note.title}</p>
      <NoteChartView chart={note.chart} mark={mark} onFocusMark={setHover} label={`${note.title}. ${note.caption}`} />
      <div className={styles.noteLine} aria-live="polite">
        {showReadout ? <p className={styles.readout}>{readout}</p> : null}
        {compact || !showReadout ? <Legend chart={note.chart} /> : null}
      </div>
      {compact ? <p className={styles.noteCaption}>{note.caption}</p> : null}
    </div>
  );
}
