"use client";

/**
 * Activity: a year of finished work (by day or by week) and when in the week
 * it gets done (by hour, last eight weeks). The legend names its own numbers
 * for each view; the map opens scrolled to the latest weeks.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShellIcon } from "@/components/shell/shell-icons";
import { formatLongDay } from "@/lib/home/home-words";
import { HOUR_COUNT, HOUR_FIRST, type ActivityView } from "@/lib/home/home-bento";
import { dayMonth, monthOf, plural, prefersReducedMotion, shortDay, useHoverTips, useRove, yearOf } from "./chart-kit";
import styles from "./home-bento.module.css";

type Mode = "daily" | "weekly" | "hour";
type Props = Readonly<{ activity: ActivityView; historyKnown: boolean; hasProjects: boolean }>;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const dailyLevel = (v: number) => (v <= 0 ? 0 : v === 1 ? 1 : v <= 3 ? 2 : v <= 5 ? 3 : 4);
const weeklyLevel = (s: number) => (s <= 0 ? 0 : s <= 5 ? 1 : s <= 13 ? 2 : s <= 21 ? 3 : 4);
const hourLevelFor = (max: number) => (n: number) => (n <= 0 ? 0 : n / max <= 0.25 ? 1 : n / max <= 0.5 ? 2 : n / max <= 0.75 ? 3 : 4);

/** "0", "1", "2–3", "6+": the values each shade actually stands for, up to `maxValue`. */
function legendLabels(level: (v: number) => number, maxValue: number): (string | null)[] {
  const ranges: ([number, number] | null)[] = [[0, 0], null, null, null, null];
  for (let v = 1; v <= Math.max(1, maxValue); v++) {
    const l = level(v);
    const r = ranges[l];
    ranges[l] = r ? [r[0], v] : [v, v];
  }
  return ranges.map((r, i) => (!r ? null : i === 4 && r[0] !== r[1] ? `${r[0]}+` : r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`));
}

export function ActivityCard({ activity, historyKnown, hasProjects }: Props) {
  const [mode, setMode] = useState<Mode>("daily");
  const [sweep, setSweep] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [spoken, setSpoken] = useState("");
  const tipsRef = useHoverTips<HTMLElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const segRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const yearRove = useRove({ right: 7, down: 1 }, setSpoken);
  const hourRove = useRove({ right: 1, down: 14 }, setSpoken);
  const empty = !hasProjects || (historyKnown && activity.yearTotal === 0);

  // The map opens on the latest weeks, not last year's quiet ones.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 2600);
    return () => clearTimeout(t);
  }, []);

  // The segmented highlight slides to the pressed view.
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const seg = segRef.current;
      const ind = indicatorRef.current;
      const button = seg?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!ind || !button) return;
      if (!animate) ind.style.transition = "none";
      ind.style.width = `${button.offsetWidth}px`;
      ind.style.transform = `translateX(${button.offsetLeft - 3}px)`;
      if (!animate) {
        void ind.offsetWidth;
        ind.style.transition = "";
      }
    };
    place(false);
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const choose = (next: Mode) => {
    if (next === mode) return;
    const seg = segRef.current;
    const ind = indicatorRef.current;
    const button = seg?.querySelector<HTMLElement>(`[data-mode="${next}"]`);
    if (ind && button) {
      ind.style.width = `${button.offsetWidth}px`;
      ind.style.transform = `translateX(${button.offsetLeft - 3}px)`;
    }
    yearRove.reset();
    hourRove.reset();
    setMode(next);
    if (!prefersReducedMotion()) {
      setSweep(true);
      setTimeout(() => setSweep(false), 600);
    }
  };

  const maxHour = Math.max(1, ...activity.hours.flat());
  const hourLevel = hourLevelFor(maxHour);
  const legend =
    mode === "hour"
      ? legendLabels(hourLevel, maxHour)
      : mode === "weekly"
        ? legendLabels(weeklyLevel, Math.max(...activity.weeks))
        : legendLabels(dailyLevel, Math.max(...activity.cells.map((c) => c.count)));

  // A month is labelled where it starts, if it has room; the first label and January carry the year.
  const months = Array.from({ length: 53 }, (_, w) => {
    const date = activity.cells[w * 7]!.date;
    const month = monthOf(date);
    const starts = w === 0 || monthOf(activity.cells[(w - 1) * 7]!.date) !== month;
    let run = 0;
    for (let k = w; k < 53 && monthOf(activity.cells[k * 7]!.date) === month; k++) run++;
    return starts && run >= 2 && w <= 50 ? { date, month } : null;
  });
  const firstLabelled = months.findIndex((m) => m !== null);
  const monthLabels = months.map((m, w) =>
    !m ? "" : w === firstLabelled || m.month === "Jan" ? `${m.month} ’${String(yearOf(m.date)).slice(2)}` : m.month,
  );

  const note =
    mode === "daily"
      ? activity.busiest
        ? (
            <>
              Busiest day: <b>{formatLongDay(activity.busiest.date)}</b>, {plural(activity.busiest.count, "task")} finished.
            </>
          )
        : null
      : mode === "weekly"
        ? activity.bestWeek !== null
          ? (
              <>
                Best week: <b>w/c {dayMonth(activity.cells[activity.bestWeek * 7]!.date)}</b>, {plural(activity.weeks[activity.bestWeek]!, "task")}. Longest run:{" "}
                {plural(activity.bestRun, "week")} in a row.
              </>
            )
          : null
        : activity.peak
          ? (
              <>
                Over the last 8 weeks ({plural(activity.hourTotal, "task")}), most of your work lands on{" "}
                <b>
                  {WEEKDAYS_LONG[activity.peak.day]}s, {hh(HOUR_FIRST + activity.peak.hour)}–{hh(HOUR_FIRST + activity.peak.hour + 2)}
                </b>{" "}
                (outlined).
              </>
            )
          : null;

  return (
    <section ref={tipsRef} className={`${styles.tile} ${styles.s12}`} aria-labelledby="home-activity-title">
      <div className={styles.tileHead}>
        <h2 id="home-activity-title" className={styles.tileTitle} style={{ marginRight: 0 }}>
          Activity
        </h2>
        {!empty && activity.streakWeeks > 0 && activity.streakFrom ? (
          <span className={styles.pill} data-tone="accent" title={`At least one task finished every week since ${dayMonth(activity.streakFrom)}`}>
            <ShellIcon.pulse />
            {plural(activity.streakWeeks, "week")} in a row
          </span>
        ) : null}
        <span className={styles.actSub}>
          {!historyKnown ? "Could not be read just now" : empty ? "Nothing yet" : (
            <>
              <b>{activity.yearTotal}</b> tasks done in the last year
            </>
          )}
        </span>
        <div ref={segRef} className={styles.seg} role="group" aria-label="Activity view">
          <span ref={indicatorRef} className={styles.segIndicator} aria-hidden />
          {(
            [
              ["daily", "Year"],
              ["weekly", "By week"],
              ["hour", "By hour"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" className={styles.segButton} data-mode={value} aria-pressed={mode === value} onClick={() => choose(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode !== "hour" ? (
        <div ref={scrollRef} className={styles.yearScroll} data-scrolls-sideways="">
          <div className={styles.yearGrid}>
            <div className={styles.yearDays} aria-hidden>
              {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div
              className={`${styles.heat} ${sweep ? styles.sweep : ""}`}
              tabIndex={0}
              role="group"
              aria-label={
                empty
                  ? "Activity for the last year, empty so far."
                  : `Tasks finished each ${mode === "weekly" ? "week" : "day"} for the last year, ${activity.yearTotal} in total. Use the arrow keys to read each ${mode === "weekly" ? "week" : "day"}.`
              }
              {...yearRove.props}
            >
              {activity.cells.map((cell, i) => {
                const w = Math.floor(i / 7);
                if (cell.future) return <i key={cell.date} className={styles.cell} data-future="" />;
                const partial = mode === "weekly" && w === activity.currentWeek;
                const level = mode === "weekly" ? weeklyLevel(activity.weeks[w]!) : dailyLevel(cell.count);
                const tip =
                  mode === "weekly"
                    ? `Week of ${shortDay(activity.cells[w * 7]!.date)} · ${plural(activity.weeks[w]!, "task")}${partial ? " so far" : ""}`
                    : `${shortDay(cell.date)} · ${plural(cell.count, "task")}${cell.today ? " · today" : ""}`;
                return (
                  <i
                    key={cell.date}
                    className={`${styles.cell} ${mode === "daily" && cell.today && pulse ? styles.pulse : ""}`}
                    data-l={level}
                    data-today={mode === "daily" && cell.today ? "" : undefined}
                    data-partial={partial ? "" : undefined}
                    data-tip={tip}
                    style={{ "--d": `${w * 4}ms` } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>
          <div className={styles.months} aria-hidden>
            {monthLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          {empty ? (
            <div className={styles.actEmpty}>
              <div>
                <b>Your year starts here</b>
                Every day you finish something fills in a square, so you can watch your rhythm build.
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`${styles.hours} ${sweep ? styles.sweep : ""}`}
          tabIndex={0}
          role="group"
          aria-label="When your tasks get finished, by weekday and hour, over the last 8 weeks. Use the arrow keys to read each hour."
          {...hourRove.props}
        >
          <span />
          {Array.from({ length: HOUR_COUNT / 2 }, (_, i) => (
            <span key={i} className={styles.hourLabel}>
              {hh(HOUR_FIRST + i * 2)}
            </span>
          ))}
          {activity.hours.map((row, d) => [
            <span key={`d${d}`} className={d === 5 ? styles.weekend : undefined}>
              {WEEKDAYS[d]}
            </span>,
            ...row.map((n, i) => {
              const peak = activity.peak && d === activity.peak.day && (i === activity.peak.hour || i === activity.peak.hour + 1);
              return (
                <i
                  key={`${d}-${i}`}
                  className={`${styles.hourCell} ${d === 5 ? styles.weekend : ""}`}
                  data-l={hourLevel(n)}
                  data-peak={peak ? "" : undefined}
                  data-tip={`${WEEKDAYS_LONG[d]}s ${hh(HOUR_FIRST + i)}–${hh(HOUR_FIRST + i + 1)} · ${plural(n, "task")}`}
                  style={{ "--d": `${i * 6}ms` } as React.CSSProperties}
                />
              );
            }),
          ])}
        </div>
      )}

      {!empty && historyKnown ? (
        <div className={styles.actFoot}>
          <span>{note}</span>
          <div className={`${styles.legend} ${styles.heatLegend}`} aria-hidden>
            <span>{mode === "hour" ? "Tasks per hour" : mode === "weekly" ? "Tasks per week" : "Tasks per day"}</span>
            {legend.map((label, i) =>
              label === null ? null : (
                <span key={i}>
                  <i style={{ background: `var(--hb-h${i})` }} />
                  {label}
                </span>
              ),
            )}
          </div>
        </div>
      ) : null}
      <span className={styles.sr} aria-live="polite">
        {spoken}
      </span>
    </section>
  );
}
