import type { CSSProperties, ReactNode } from "react";
import s from "./ledger.module.css";
import { PEOPLE, STATUS_LABEL, fmtMilestone, type Milestone, type PersonId, type StatusId } from "./data";

/* ── Icons: 16px, 1.5 stroke, currentColor ─────────────────────────── */

type IconProps = { size?: number; className?: string };
const I = ({ size = 16, className, children }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {children}
  </svg>
);

export const Icon = {
  plus: (p: IconProps) => (
    <I {...p}>
      <path d="M8 3.5v9M3.5 8h9" />
    </I>
  ),
  filter: (p: IconProps) => (
    <I {...p}>
      <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />
    </I>
  ),
  group: (p: IconProps) => (
    <I {...p}>
      <rect x="2.5" y="2.5" width="11" height="4" rx="1" />
      <rect x="2.5" y="9.5" width="11" height="4" rx="1" />
    </I>
  ),
  display: (p: IconProps) => (
    <I {...p}>
      <path d="M2.5 4.5h3M8.5 4.5h5M2.5 11.5h7M12.5 11.5h1" />
      <circle cx="7" cy="4.5" r="1.5" />
      <circle cx="11" cy="11.5" r="1.5" />
    </I>
  ),
  close: (p: IconProps) => (
    <I {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </I>
  ),
  chevron: (p: IconProps) => (
    <I {...p}>
      <path d="M6 4l4 4-4 4" />
    </I>
  ),
  chevronDown: (p: IconProps) => (
    <I {...p}>
      <path d="M4 6l4 4 4-4" />
    </I>
  ),
  arrowUp: (p: IconProps) => (
    <I {...p}>
      <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
    </I>
  ),
  arrowDown: (p: IconProps) => (
    <I {...p}>
      <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
    </I>
  ),
  arrowRight: (p: IconProps) => (
    <I {...p}>
      <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" />
    </I>
  ),
  open: (p: IconProps) => (
    <I {...p}>
      <path d="M9.5 2.5h4v4M13.5 2.5L8 8M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </I>
  ),
  calendar: (p: IconProps) => (
    <I {...p}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </I>
  ),
  person: (p: IconProps) => (
    <I {...p}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </I>
  ),
  archive: (p: IconProps) => (
    <I {...p}>
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 9h3" />
    </I>
  ),
  compare: (p: IconProps) => (
    <I {...p}>
      <rect x="2" y="2.5" width="5" height="11" rx="1" />
      <rect x="9" y="2.5" width="5" height="11" rx="1" />
    </I>
  ),
  search: (p: IconProps) => (
    <I {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L13.5 13.5" />
    </I>
  ),
  check: (p: IconProps) => (
    <I {...p}>
      <path d="M3.5 8.5l3 3 6-7" />
    </I>
  ),
  clock: (p: IconProps) => (
    <I {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2 1.3" />
    </I>
  ),
  flag: (p: IconProps) => (
    <I {...p}>
      <path d="M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8" />
    </I>
  ),
  doc: (p: IconProps) => (
    <I {...p}>
      <path d="M4 1.5h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z" />
      <path d="M9 1.5v3h3" />
    </I>
  ),
  grip: (p: IconProps) => (
    <I {...p}>
      <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" strokeWidth={2.2} />
    </I>
  ),
  eyeOff: (p: IconProps) => (
    <I {...p}>
      <path d="M2 2l12 12M6.6 3.8A6.5 6.5 0 0 1 8 3.6c3.6 0 5.8 3.2 6.4 4.4-.3.6-.9 1.5-1.7 2.3M4 5.2C2.9 6.1 2 7.3 1.6 8c.6 1.2 2.8 4.4 6.4 4.4 1 0 1.9-.2 2.7-.6" />
    </I>
  ),
  bolt: (p: IconProps) => (
    <I {...p}>
      <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" />
    </I>
  ),
  template: (p: IconProps) => (
    <I {...p}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M2.5 6.5h11M6.5 6.5v7" />
    </I>
  ),
  history: (p: IconProps) => (
    <I {...p}>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5" />
      <path d="M8 5v3l2 1.5" />
    </I>
  ),
  more: (p: IconProps) => (
    <I {...p}>
      <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" strokeWidth={2.4} />
    </I>
  ),
  back: (p: IconProps) => (
    <I {...p}>
      <path d="M12.5 8h-9M7 4.5L3.5 8 7 11.5" />
    </I>
  ),
  link: (p: IconProps) => (
    <I {...p}>
      <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" />
    </I>
  ),
};

/* ── Status ─────────────────────────────────────────────────────────── */

export function StatusGlyph({ status, size = 12 }: { status: StatusId; size?: number }) {
  // Shape carries meaning as well as colour: full ring, half, cross, tick.
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className={s.statusGlyph} data-status={status}>
      {status === "on_track" && (
        <>
          <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="2.25" fill="currentColor" />
        </>
      )}
      {status === "at_risk" && (
        <>
          <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.25a4.75 4.75 0 0 1 0 9.5z" fill="currentColor" />
        </>
      )}
      {status === "off_track" && (
        <>
          <circle cx="6" cy="6" r="5.5" fill="currentColor" />
          <path d="M4.2 4.2l3.6 3.6M7.8 4.2L4.2 7.8" stroke="var(--c2-glyph-ink)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {status === "wrapped" && (
        <>
          <circle cx="6" cy="6" r="5.5" fill="currentColor" />
          <path d="M3.7 6.2l1.6 1.6 3-3.4" fill="none" stroke="var(--c2-glyph-ink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/**
 * `past`: the project's date has gone by and it isn't wrapped. That fact outranks the status, so the pill says so.
 * `stale`: marked on track while a milestone is late. A visible "?" asks for a second look; the reason shows on hover and focus.
 */
export function StatusPill({ status, compact, stale, past }: { status: StatusId; compact?: boolean; stale?: boolean; past?: boolean }) {
  if (past) {
    return (
      <span className={s.pill} data-status="past" data-compact={compact || undefined}>
        <Icon.clock size={12} />
        <span>Past date</span>
      </span>
    );
  }
  return (
    <span className={s.pill} data-status={status} data-compact={compact || undefined} data-stale={stale || undefined}>
      <StatusGlyph status={status} />
      <span>{STATUS_LABEL[status]}</span>
      {stale && (
        <span className={s.pillCheck} aria-hidden="true">
          ?
        </span>
      )}
    </span>
  );
}

/* ── People ─────────────────────────────────────────────────────────── */

export function Avatar({ who, size = 22, ring }: { who: PersonId; size?: number; ring?: boolean }) {
  const p = PEOPLE[who];
  return (
    <span
      className={s.avatar}
      data-ring={ring || undefined}
      style={{ "--size": `${size}px`, "--tone": `var(--c2-id-${p.tone})` } as CSSProperties}
      title={p.name}
      aria-label={p.name}
      role="img"
    >
      {p.initials}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 22 }: { people: PersonId[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={s.stack} aria-label={people.map((p) => PEOPLE[p].short).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p} who={p} size={size} ring />
      ))}
      {extra > 0 && (
        <span className={s.stackMore} style={{ "--size": `${size}px` } as CSSProperties}>
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ── Swatch ─────────────────────────────────────────────────────────── */

/**
 * Project identity tile. Uses the concept's own identity palette (--c2-id-*), which
 * keeps red, orange and amber free for "late" and "at risk". Two letters at every size
 * from 16px up, so the same project reads the same in the ledger, peek, compare and hub.
 */
export function initials(name: string) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter((w) => w && !/^(and|for|of|the)$/i.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export function Swatch({ tone, name, size = 20 }: { tone: number; name: string; size?: number }) {
  const letters = size >= 16 ? initials(name) : "";
  return (
    <span
      className={s.swatch}
      data-size={size >= 22 ? "lg" : size >= 16 ? "sm" : undefined}
      style={{ "--tone": `var(--c2-id-${tone})`, "--size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {letters || null}
    </span>
  );
}

/* ── Open tasks over the last 14 days ──────────────────────────────── */

/** Open tasks at the end of each of the last 14 days, rebuilt from done and added per day. */
export function openSeries(total: number, done: number, sparkDone: number[], sparkAdded: number[]): number[] {
  const n = sparkDone.length;
  const out = Array<number>(n);
  out[n - 1] = total - done;
  for (let i = n - 1; i > 0; i--) out[i - 1] = out[i] - sparkAdded[i] + sparkDone[i];
  return out;
}

export type Trend = { dir: "down" | "up" | "flat" | "quiet"; n: number; words: string; label: string };

/** Plain words for the change in open tasks: "6 fewer", "13 more", "No change", "Quiet". */
export function trend(net: number, quiet = false): Trend {
  if (quiet) return { dir: "quiet", n: 0, words: "Quiet", label: "No tasks done or added in 14 days" };
  if (net === 0) return { dir: "flat", n: 0, words: "No change", label: "Same number of open tasks as 14 days ago" };
  const n = Math.abs(net);
  return net < 0
    ? { dir: "down", n, words: `${n} fewer`, label: `${n} fewer open ${n === 1 ? "task" : "tasks"} than 14 days ago` }
    : { dir: "up", n, words: `${n} more`, label: `${n} more open ${n === 1 ? "task" : "tasks"} than 14 days ago` };
}

/** A 14-point line of open tasks with an end dot. Rising lines turn amber; everything else stays neutral. */
export function OpenLine({ series, width = 48, height = 16, stroke = 1.5 }: { series: number[]; width?: number; height?: number; stroke?: number }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = stroke + 1.5;
  const span = Math.max(1, max - min);
  const x = (i: number) => pad + (i / (series.length - 1)) * (width - pad * 2);
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2));
  const d = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = series.length - 1;
  const rising = series[last] > series[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={s.openLine} data-rising={rising || undefined} aria-hidden="true">
      <path d={d} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(series[last])} r={stroke + 0.9} />
    </svg>
  );
}

/** The ledger's one live signal: line plus plain words with a direction arrow. */
export function OpenTrend({ p, width = 44, height = 16 }: { p: { total: number; done: number; sparkDone: number[]; sparkAdded: number[] }; width?: number; height?: number }) {
  const d = p.sparkDone.reduce((a, b) => a + b, 0);
  const a = p.sparkAdded.reduce((x, y) => x + y, 0);
  const t = trend(a - d, a + d === 0);
  return (
    <span className={s.trend} data-dir={t.dir}>
      <OpenLine series={openSeries(p.total, p.done, p.sparkDone, p.sparkAdded)} width={width} height={height} />
      <span className={s.trendWords}>
        {(t.dir === "down" || t.dir === "up") && (
          <span className={s.trendArrow} aria-hidden="true">
            {t.dir === "down" ? "↓" : "↑"}
          </span>
        )}
        {t.words}
      </span>
    </span>
  );
}

/** Day by day: done rises above the line, added hangs below it. */
export function DayBars({ done, added, width = 196, height = 48 }: { done: number[]; added: number[]; width?: number; height?: number }) {
  const n = done.length;
  const max = Math.max(1, ...done, ...added);
  const gap = 2;
  const bw = (width - gap * (n - 1)) / n;
  const mid = height / 2;
  const h = (v: number) => (v / max) * (mid - 2);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={s.dayBars} aria-hidden="true">
      <line x1={0} x2={width} y1={mid} y2={mid} className={s.dayBarsBase} />
      {done.map((v, i) => (
        <g key={i}>
          {v > 0 && <rect x={i * (bw + gap)} y={mid - h(v) - 0.5} width={bw} height={h(v)} rx={1.5} className={s.dayBarDone} />}
          {added[i] > 0 && <rect x={i * (bw + gap)} y={mid + 0.5} width={bw} height={h(added[i])} rx={1.5} className={s.dayBarAdded} />}
        </g>
      ))}
    </svg>
  );
}

/* ── Progress ───────────────────────────────────────────────────────── */

export function Progress({ done, total, width = 44, late = 0 }: { done: number; total: number; width?: number; late?: number }) {
  const pct = total ? done / total : 0;
  return (
    <span className={s.progress}>
      <span className={s.progressTrack} style={{ width }} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} of ${total} tasks done`}>
        <span className={s.progressFill} style={{ width: `${Math.round(pct * 100)}%` }} data-full={pct >= 1 || undefined} />
      </span>
      <span className={s.progressText}>
        {done}
        <span className={s.progressOf}>/{total}</span>
      </span>
      {late > 0 && <span className={s.progressLate}>· {late} late</span>}
    </span>
  );
}

/** The one way a milestone date is written: "Tue 29 Sep", "14 Nov", "18 Sep, 7 days late". */
export function MilestoneWhen({ m, className, tight }: { m: Pick<Milestone, "date" | "done">; className?: string; tight?: boolean }) {
  const f = fmtMilestone(m);
  // `tight` (ledger cells only): a late milestone leads with how late it is, so the name keeps its room.
  if (tight && f.late) {
    return (
      <span className={`${s.msWhen} ${className ?? ""}`} title={f.date}>
        <span className={s.msWhenLate}>{f.late}</span>
      </span>
    );
  }
  return (
    <span className={`${s.msWhen} ${className ?? ""}`} data-soon={f.soon || undefined}>
      {f.weekday && <span className={s.msWeekday}>{f.weekday} </span>}
      {f.day}
      {f.late && <span className={s.msWhenLate}>, {f.late}</span>}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}
