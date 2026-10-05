import type { CSSProperties } from "react";
import {
  formatDay,
  formatDayRange,
  niceTicks,
  plural,
  type DueDay,
  type DurationBucket,
  type WeekBucket,
} from "@/lib/projects/project-analytics";
import styles from "./analytics.module.css";

/**
 * Analytics charts: server-rendered, no chart library, no client JS.
 *
 * The hidden tables sit inside a clipped box: a table ignores the 1px width
 * `sr-only` gives it, and would otherwise widen the scrolling column.
 *
 * Marks are HTML boxes (and an SVG sparkline), so bars keep crisp corners at
 * any width and text never scales with a viewBox. Added work is a tick on
 * each week rather than a line: the comparison is week by week, and a
 * zig-zag across the bars would cross the printed values. Every plot is
 * `aria-hidden`; a visually hidden table beside it carries the same numbers
 * for screen readers, and the hover tooltips are a pointer convenience on top
 * of values that are already printed on the bars.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

function edgeOf(index: number, count: number): "start" | "end" | undefined {
  if (count < 5) return undefined;
  if (index < 2) return "start";
  if (index > count - 3) return "end";
  return undefined;
}

// ── Finished and added, per week ─────────────────────────────────────────

export function WeeklyChart({
  weeks,
  average,
  captionId,
}: {
  weeks: readonly WeekBucket[];
  average: number;
  /** The card heading that names this chart. */
  captionId: string;
}) {
  const count = weeks.length;
  const max = Math.max(0, ...weeks.map((week) => Math.max(week.finished, week.added)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const pct = (value: number) => (value / top) * 100;
  // Label every week while they fit; thin to about seven labels beyond that,
  // always keeping the latest.
  const every = count <= 8 ? 1 : count <= 13 ? 2 : Math.ceil(count / 7);
  const dense = count > 12;

  return (
    <figure className={styles.chart} aria-labelledby={captionId}>
      <div className={styles.plotFrame} aria-hidden="true">
        <div className={styles.yAxis}>
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${pct(tick)}%` }}>{tick}</span>
          ))}
        </div>
        <div className={styles.plot} style={{ "--n": count } as Vars}>
          {ticks.map((tick) => (
            <span key={tick} className={styles.gridline} data-base={tick === 0 ? "" : undefined} style={{ bottom: `${pct(tick)}%` }} />
          ))}
          {average > 0 ? <span className={styles.average} style={{ bottom: `${pct(average)}%` }} /> : null}
          <div className={styles.columns}>
            {weeks.map((week, index) => (
              <div
                key={week.end}
                className={styles.col}
                data-latest={index === count - 1 ? "" : undefined}
                data-edge={edgeOf(index, count)}
              >
                <div
                  className={styles.bar}
                  data-zero={week.finished === 0 ? "" : undefined}
                  style={{ height: `${pct(week.finished)}%`, "--i": index } as Vars}
                >
                  {week.finished > 0 ? (
                    <span className={styles.barValue} data-dense={dense ? "" : undefined}>{week.finished}</span>
                  ) : null}
                </div>
                <span className={styles.tick} style={{ bottom: `${pct(week.added)}%`, "--i": index } as Vars} />
                <div className={styles.tip}>
                  <span className={styles.tipTitle}>
                    {formatDayRange(week.start, week.end)}
                    {index === count - 1 ? " · last 7 days" : ""}
                  </span>
                  <span className={styles.tipRow}>
                    <span><i className={styles.swatchBar} />Finished</span>
                    <b>{week.finished}</b>
                  </span>
                  <span className={styles.tipRow}>
                    <span><i className={styles.swatchLine} />Added</span>
                    <b>{week.added}</b>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.xAxis} style={{ "--n": count } as Vars}>
          {weeks.map((week, index) => {
            const fromLatest = count - 1 - index;
            const shown = fromLatest % every === 0;
            return (
              <span
                key={week.end}
                data-latest={index === count - 1 ? "" : undefined}
                data-optional={shown && fromLatest % (every * 2) !== 0 ? "" : undefined}
              >
                {shown ? formatDay(week.end) : ""}
              </span>
            );
          })}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Tasks finished and added each week, the week ending on each date</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Finished</th>
              <th scope="col">Added</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.end}>
                <th scope="row">{formatDayRange(week.start, week.end)}</th>
                <td>{week.finished}</td>
                <td>{week.added}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ── Due in the next fourteen days ────────────────────────────────────────

export function DueChart({
  days,
  overdue,
  captionId,
}: {
  days: readonly DueDay[];
  overdue: number;
  captionId: string;
}) {
  const max = Math.max(1, overdue, ...days.map((day) => day.count));
  const height = (value: number) => `${(value / max) * 100}%`;
  const total = days.length + 1;

  return (
    <figure className={styles.chart} aria-labelledby={captionId}>
      <div className={styles.dueFrame} aria-hidden="true">
        <div className={styles.dueCol} data-late="" data-edge="start">
          <div className={styles.duePlot}>
            {overdue > 0 ? (
              <div className={styles.dueBar} style={{ height: height(overdue), "--i": 0 } as Vars}>
                <span className={styles.dueValue}>{overdue}</span>
              </div>
            ) : (
              <span className={styles.dueZero} />
            )}
          </div>
          <span className={styles.dueLabel}>
            <b>Late</b>
            <span>&nbsp;</span>
          </span>
          <span className={styles.tip}>
            <span className={styles.tipTitle}>Past their date</span>
            <span>{overdue} open {plural(overdue, "task")}</span>
          </span>
        </div>
        {days.map((day, index) => {
          const weekend = day.weekday === 0 || day.weekday === 6;
          return (
            <div
              key={day.date}
              className={styles.dueCol}
              data-today={day.isToday ? "" : undefined}
              data-weekend={weekend ? "" : undefined}
              data-edge={edgeOf(index + 1, total)}
            >
              <div className={styles.duePlot}>
                {day.count > 0 ? (
                  <div className={styles.dueBar} style={{ height: height(day.count), "--i": index + 1 } as Vars}>
                    <span className={styles.dueValue}>{day.count}</span>
                  </div>
                ) : (
                  <span className={styles.dueZero} />
                )}
              </div>
              <span className={styles.dueLabel}>
                <b>{formatDay(day.date, { weekday: "short" }).slice(0, 2)}</b>
                <span>{formatDay(day.date, { day: "numeric" })}</span>
              </span>
              <span className={styles.tip}>
                <span className={styles.tipTitle}>
                  {day.isToday ? "Today, " : ""}
                  {formatDay(day.date, { weekday: day.isToday ? undefined : "long", day: "numeric", month: "short" })}
                </span>
                <span>{day.count === 0 ? "Nothing due" : `${day.count} due`}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="sr-only">
        <table>
          <caption>Open tasks due on each of the next 14 days, and those already past their date</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Tasks due</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Past their date</th>
              <td>{overdue}</td>
            </tr>
            {days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{formatDay(day.date, { weekday: "long", day: "numeric", month: "long" })}</th>
                <td>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ── Time to finish ───────────────────────────────────────────────────────

export function DurationChart({
  buckets,
  captionId,
}: {
  buckets: readonly DurationBucket[];
  captionId: string;
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <figure className={styles.chart} aria-labelledby={captionId}>
      <div className={styles.histFrame} aria-hidden="true">
        {buckets.map((bucket, index) => (
          <div key={bucket.key} className={styles.histCol} data-median={bucket.holdsMedian ? "" : undefined}>
            <div className={styles.histPlot}>
              {bucket.count > 0 ? (
                <div className={styles.histBar} style={{ height: `${(bucket.count / max) * 100}%`, "--i": index } as Vars}>
                  <span className={styles.dueValue}>{bucket.count}</span>
                </div>
              ) : (
                <span className={styles.dueZero} />
              )}
            </div>
            <span className={styles.histLabel}>{bucket.shortLabel}</span>
          </div>
        ))}
      </div>
      <div className="sr-only">
        <table>
          <caption>Finished tasks by how long they took, from added to finished</caption>
          <thead>
            <tr>
              <th scope="col">Time taken</th>
              <th scope="col">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.key}>
                <th scope="row">{bucket.label}{bucket.holdsMedian ? " (includes the median)" : ""}</th>
                <td>{bucket.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ── KPI sparkline ────────────────────────────────────────────────────────

export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = 100 / (values.length - 1);
  const y = (value: number) => 28 - (value / max) * 24;
  const line = values.map((value, index) => `${(index * step).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const area = `0,30 ${line} 100,30`;
  return (
    <svg className={styles.spark} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polygon className={styles.sparkArea} points={area} />
      <polyline className={styles.sparkLine} points={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
