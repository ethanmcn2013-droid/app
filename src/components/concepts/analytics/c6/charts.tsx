"use client";

import type { CSSProperties, ReactNode } from "react";
import { THIS_WEEK, WEEKS, fmtDay, fmtDayLong, weekStart } from "./data";
import {
  plural,
  spareWords,
  weekLabel,
  type Derived,
  type Period,
} from "./model";
import s from "./c6.module.css";

/* ── Finished each week: the small multiple ──────────────────────────── */

type BarsProps = {
  d: Derived;
  period: Period;
  max: number;
  same: boolean;
  week: number | null;
  onWeek: (w: number | null) => void;
  onPin: (w: number) => void;
  size?: "card" | "row" | "mini";
};

export function WeekBars({
  d,
  period,
  max,
  same,
  week,
  onWeek,
  onPin,
  size = "card",
}: BarsProps) {
  const from = WEEKS - period;
  const weeks = Array.from({ length: period }, (_, i) => from + i);
  const started = Math.max(d.p.start, from);
  const young = d.status === "new";
  const peak = weeks.reduce((m, w) => Math.max(m, d.p.finished[w]), 0);
  const label = `Finished each week, ${plural(period, "week")}. This week so far ${d.doneThisWeek}, busiest week ${peak}.`;
  return (
    <div className={s.bars} data-size={size}>
      {size === "card" && (
        <div className={s.barsHead}>
          <span>Finished each week</span>
          <span className={s.scaleNote} data-own={!same || undefined}>
            {same ? `Top ${max} · all cards` : `Top ${max} · own scale`}
          </span>
        </div>
      )}
      <div
        className={s.plot}
        role="img"
        aria-label={label}
        data-hover={week !== null || undefined}
        style={{ "--n": period } as CSSProperties}
        onPointerLeave={() => onWeek(null)}
      >
        {size !== "mini" && <span className={s.topLine} aria-hidden />}
        {weeks.map((w) => {
          const v = d.p.finished[w];
          const pct = (v / max) * 100;
          const on = week === w;
          return (
            <div
              key={w}
              className={s.col}
              data-on={on || undefined}
              data-partial={w === THIS_WEEK || undefined}
              data-before={w < d.p.start || undefined}
              onPointerEnter={() => onWeek(w)}
              onClick={(e) => {
                e.stopPropagation();
                onPin(w);
              }}
            >
              <span
                className={s.bar}
                style={{ height: v > 0 ? `max(2px, ${pct}%)` : 0 }}
              />
              {on && size !== "mini" && w >= d.p.start && (
                <span
                  className={s.val}
                  style={{ bottom: `calc(${Math.min(pct, 100)}% + 3px)` }}
                >
                  {v}
                </span>
              )}
            </div>
          );
        })}
        {young && size !== "mini" && (
          <span
            className={s.youngNote}
            style={{ right: `${((WEEKS - started) / period) * 100}%` }}
          >
            Started {plural(d.weeksOld, "week")} ago
          </span>
        )}
        {!d.hasWork && size !== "mini" && (
          <span className={s.youngNote} style={{ right: 0 }}>
            Nothing added yet
          </span>
        )}
      </div>
    </div>
  );
}

/* ── The runway: now to the big date, same 13 weeks on every card ────── */

export const HORIZON = 91;
const pct = (day: number) =>
  `${(Math.max(0, Math.min(HORIZON, day)) / HORIZON) * 100}%`;
const MONTH_TICKS = [
  { day: 6, label: "Oct" },
  { day: 37, label: "Nov" },
  { day: 67, label: "Dec" },
];

export function Runway({
  d,
  onSetDate,
}: {
  d: Derived;
  onSetDate: () => void;
}) {
  const big = d.p.bigDate;
  const ready = d.ready;
  const late = d.spare !== null && d.spare < 0;
  let text: ReactNode;
  if (d.status === "empty")
    text = <>Nothing to forecast until things are added</>;
  else if (d.status === "new")
    text = <>A forecast appears after 3 weeks of work</>;
  else if (big === null)
    text = (
      <>
        No big date, so nothing to be ready for.{" "}
        <button
          type="button"
          className={s.linkBtn}
          onClick={(e) => {
            e.stopPropagation();
            onSetDate();
          }}
        >
          Set a big date
        </button>
      </>
    );
  else if (ready === null)
    text = (
      <span className={s.dangerText}>
        Not shrinking: as much is added as finished
      </span>
    );
  else
    text = (
      <>
        Likely ready {fmtDay(ready)},{" "}
        <span
          className={
            late
              ? s.dangerText
              : d.spare !== null && d.spare < 3
                ? s.warnText
                : s.goodText
          }
        >
          {spareWords(d)}
        </span>
      </>
    );

  const workEnd =
    ready === null ? null : big === null ? ready : Math.min(ready, big);
  return (
    <div className={s.runway}>
      <div className={s.track} aria-hidden>
        {MONTH_TICKS.map((m) => (
          <span key={m.day} className={s.month} style={{ left: pct(m.day) }}>
            {m.label}
          </span>
        ))}
        {workEnd !== null && big !== null && (
          <span className={s.work} style={{ width: pct(workEnd) }} />
        )}
        {ready !== null && big !== null && !late && (
          <span
            className={s.spare}
            style={{
              left: pct(ready),
              width: `calc(${pct(big)} - ${pct(ready)})`,
            }}
          />
        )}
        {ready !== null && big !== null && late && (
          <span
            className={s.over}
            style={{
              left: pct(big),
              width: `calc(${pct(ready)} - ${pct(big)})`,
            }}
          />
        )}
        {big !== null && big <= HORIZON && (
          <span className={s.dateTick} style={{ left: pct(big) }} />
        )}
        {big !== null && big > HORIZON && (
          <span className={s.beyond}>{fmtDay(big)} ›</span>
        )}
        {ready !== null && big !== null && ready <= HORIZON && (
          <span className={s.readyDot} style={{ left: pct(ready) }} />
        )}
        <span className={s.nowTick} />
      </div>
      <p className={s.runwayText}>{text}</p>
    </div>
  );
}

/* ── Sparkline for the table and phone rows ──────────────────────────── */

export function Spark({
  d,
  period,
  max,
  week,
}: {
  d: Derived;
  period: Period;
  max: number;
  week?: number | null;
}) {
  const from = WEEKS - period;
  const W = 96;
  const H = 24;
  const n = period;
  const bw = W / n;
  return (
    <svg
      className={s.spark}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
    >
      <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className={s.sparkBase} />
      {Array.from({ length: n }, (_, i) => {
        const w = from + i;
        const v = d.p.finished[w];
        const h = v > 0 ? Math.max(1.5, (v / max) * (H - 2)) : 0;
        return (
          <rect
            key={w}
            x={i * bw + bw * 0.15}
            width={bw * 0.7}
            y={H - h}
            height={h}
            rx={Math.min(1.5, bw * 0.2)}
            className={
              week === w
                ? s.sparkOn
                : w === THIS_WEEK
                  ? s.sparkPartial
                  : s.sparkBar
            }
          />
        );
      })}
    </svg>
  );
}

/* ── Detail: finished above the line, added below it ─────────────────── */

export function Diverging({
  d,
  period,
  week,
  onWeek,
  onPin,
}: {
  d: Derived;
  period: Period;
  week: number | null;
  onWeek: (w: number | null) => void;
  onPin: (w: number) => void;
}) {
  const weeks = Array.from({ length: WEEKS }, (_, i) => i);
  const fMax = Math.max(1, ...d.p.finished);
  // The first week carries everything planned up front; show it as a note, not a tower.
  const addedShown = d.p.added.map((v, w) => (w === d.p.start ? 0 : v));
  const aMax = Math.max(1, ...addedShown);
  const scale = Math.max(fMax, aMax);
  const upH = (fMax / scale) * 100;
  const downH = (aMax / scale) * 100;
  const from = WEEKS - period;
  const ticks = [0, 9, 17, THIS_WEEK];
  return (
    <figure className={s.div}>
      <figcaption className={s.figHead}>
        <span className={s.figTitle}>Finished and added each week</span>
        <span className={s.legend}>
          <span className={s.keyUp} aria-hidden /> Finished{" "}
          <span className={s.keyDown} aria-hidden /> Added
        </span>
      </figcaption>
      <div
        className={s.divPlot}
        style={{ "--up": `${upH}`, "--down": `${downH}` } as CSSProperties}
        data-hover={week !== null || undefined}
        onPointerLeave={() => onWeek(null)}
        role="img"
        aria-label={`Finished and added each week for 26 weeks. Busiest week ${fMax} finished. Most added in a week ${aMax}.`}
      >
        <span
          className={s.band}
          style={{ left: `${(from / WEEKS) * 100}%` }}
          aria-hidden
        >
          <span className={s.bandLabel}>
            {period === 26 ? "" : `Your ${period} weeks`}
          </span>
        </span>
        <span className={s.yUp}>{fMax}</span>
        <span className={s.yZero}>0</span>
        <span className={s.yDown}>{aMax}</span>
        <div className={s.divCols}>
          {weeks.map((w) => {
            const f = d.p.finished[w];
            const a = addedShown[w];
            const on = week === w;
            return (
              <div
                key={w}
                className={s.divCol}
                data-on={on || undefined}
                data-partial={w === THIS_WEEK || undefined}
                onPointerEnter={() => onWeek(w)}
                onClick={() => onPin(w)}
              >
                <span className={s.upHalf}>
                  <span
                    className={s.upBar}
                    style={{ height: f ? `max(2px, ${(f / fMax) * 100}%)` : 0 }}
                  />
                </span>
                <span className={s.downHalf}>
                  <span
                    className={s.downBar}
                    style={{ height: a ? `max(2px, ${(a / aMax) * 100}%)` : 0 }}
                  />
                </span>
                {on && (
                  <span className={s.divTip}>
                    <b>{weekLabel(w)}</b>
                    <span>
                      {f} finished ·{" "}
                      {w === d.p.start ? "planned up front" : `${a} added`}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className={s.xAxis} aria-hidden>
          {ticks.map((w) => (
            <span key={w} style={{ left: `${((w + 0.5) / WEEKS) * 100}%` }}>
              {w === THIS_WEEK ? "This week" : fmtDay(weekStart(w))}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/* ── Detail: open work, with the forecast run-out ────────────────────── */

export function OpenLine({ d }: { d: Derived }) {
  const start = weekStart(Math.max(0, d.p.start)) + 7;
  const big = d.p.bigDate;
  const end = Math.max(21, (big ?? 0) + 10, (d.readyLate ?? 0) + 5);
  const span = end - start;
  const x = (day: number) => ((day - start) / span) * 100;
  const pts: [number, number][] = [];
  for (let w = Math.max(0, d.p.start); w < WEEKS; w++) {
    const day = w === THIS_WEEK ? 0 : weekStart(w) + 7;
    pts.push([day, d.openSeries[w]]);
  }
  const yMax = Math.max(1, ...pts.map((p) => p[1]));
  const y = (v: number) => 100 - (v / yMax) * 100;
  const line = pts
    .map(
      ([dd, v], i) => `${i ? "L" : "M"}${x(dd).toFixed(2)},${y(v).toFixed(2)}`,
    )
    .join(" ");
  const peakPt = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    <figure className={s.openFig}>
      <figcaption className={s.figHead}>
        <span className={s.figTitle}>Open work</span>
        <span className={s.figSub}>
          {d.ready !== null
            ? `At the pace of the last 6 weeks, it runs out between ${fmtDay(d.readyEarly!)} and ${fmtDay(d.readyLate!)}.`
            : d.status === "new"
              ? "Too new to forecast."
              : d.hasWork
                ? "Holding steady: about as much is added as finished."
                : "Nothing added yet."}
        </span>
      </figcaption>
      <div className={s.openPlot}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={s.openSvg}
          aria-hidden
        >
          <line x1={0} x2={100} y1={100} y2={100} className={s.axisLine} />
          {d.ready !== null &&
            d.readyEarly !== null &&
            d.readyLate !== null && (
              <>
                <polygon
                  points={`${x(0)},${y(d.open)} ${x(d.readyEarly)},100 ${x(d.readyLate)},100`}
                  className={s.fan}
                />
                <line
                  x1={x(0)}
                  y1={y(d.open)}
                  x2={x(d.ready)}
                  y2={100}
                  className={s.forecast}
                />
              </>
            )}
          <path d={line} className={s.openPath} />
        </svg>
        <span className={s.yTop}>{yMax}</span>
        <span className={s.todayRule} style={{ left: `${x(0)}%` }}>
          <span>Today · {d.open} open</span>
        </span>
        {big !== null && (
          <span className={s.bigRule} style={{ left: `${x(big)}%` }}>
            <span>
              {d.p.dateLabel} · {fmtDay(big)}
            </span>
          </span>
        )}
        {d.ready !== null && (
          <span className={s.readyMark} style={{ left: `${x(d.ready)}%` }}>
            <span>Likely {fmtDay(d.ready)}</span>
          </span>
        )}
        {big !== null && d.ready !== null && d.ready > big && (
          <span
            className={s.overBand}
            style={{ left: `${x(big)}%`, width: `${x(d.ready) - x(big)}%` }}
            aria-hidden
          />
        )}
        <span
          className={s.peakDot}
          style={{ left: `${x(peakPt[0])}%`, top: `${y(peakPt[1])}%` }}
          aria-hidden
        />
        <span className={s.xStart} aria-hidden>
          {d.p.start === 0
            ? `Week of ${fmtDay(weekStart(0))}`
            : `Started ${fmtDay(weekStart(d.p.start))}`}
        </span>
      </div>
      <p className={s.srOnly}>
        {d.open} things open today.{" "}
        {d.ready !== null ? `Likely ready ${fmtDayLong(d.ready)}.` : ""}
      </p>
    </figure>
  );
}
