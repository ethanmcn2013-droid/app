"use client";

/**
 * Done this week: this week against last week, day by day, with the plain
 * comparison spelled out. Arrow keys read each day; the bars grow from the
 * baseline once, on arrival.
 */

import { useEffect, useRef, useState } from "react";
import type { WeekView } from "@/lib/home/home-bento";
import { plural, prefersReducedMotion, rollNumber, useHoverTips, useRove } from "./chart-kit";
import styles from "./home-bento.module.css";

type Props = Readonly<{ week: WeekView; historyKnown: boolean; hasProjects: boolean; dueThisWeek: number }>;

function pace(week: WeekView, dueThisWeek: number): { tone: "good" | "neutral" | "warn" | "accent"; chip: string; text: React.ReactNode } {
  const day = week.days[week.todayIndex]!.long;
  switch (week.tone) {
    case "fresh":
      return {
        tone: "accent",
        chip: "New week",
        text: (
          <>
            New week. Last week you finished <b>{week.lastTotal}</b>
            {dueThisWeek > 0 ? (
              <>
                , and <b>{dueThisWeek}</b> {dueThisWeek === 1 ? "task is" : "tasks are"} due this week.
              </>
            ) : (
              "."
            )}
          </>
        ),
      };
    case "ahead":
      return {
        tone: "good",
        chip: "Ahead of last week",
        text:
          week.thisSum > week.lastTotal ? (
            <>
              That&apos;s already more than all of last week (<b>{week.lastTotal}</b>). Same time last week: <b>{week.lastBy}</b>.
            </>
          ) : (
            <>
              Same time last week you had <b>{week.lastBy}</b>, and <b>{week.lastTotal}</b> by Sunday.
            </>
          ),
      };
    case "level":
      return {
        tone: "neutral",
        chip: "Level with last week",
        text: (
          <>
            Same as this time last week (<b>{week.lastBy}</b>). Last week finished on <b>{week.lastTotal}</b>.
          </>
        ),
      };
    default:
      return {
        tone: "warn",
        chip: "Behind last week",
        text: (
          <>
            Same time last week you had <b>{week.lastBy}</b> by {day}. Plenty of week left.
          </>
        ),
      };
  }
}

export function WeekCard({ week, historyKnown, hasProjects, dueThisWeek }: Props) {
  const tipsRef = useHoverTips<HTMLElement>();
  const numRef = useRef<HTMLElement>(null);
  const weekRef = useRef<HTMLDivElement>(null);
  const [spoken, setSpoken] = useState("");
  const rove = useRove({ right: 1, down: 1 }, setSpoken);

  useEffect(() => {
    const bars = weekRef.current;
    if (!numRef.current || !bars) return;
    if (!prefersReducedMotion()) {
      // The bars grow once, on arrival; the class is a DOM detail, not render state.
      const grow = styles.grow ?? "";
      bars.classList.add(grow);
      const t = setTimeout(() => bars.classList.remove(grow), 1000);
      const stop = rollNumber(numRef.current, week.thisSum, 0, 160);
      return () => {
        clearTimeout(t);
        bars.classList.remove(grow);
        stop();
      };
    }
  }, [week.thisSum]);

  if (!hasProjects || !historyKnown) {
    return (
      <section className={`${styles.tile} ${styles.s5}`} aria-labelledby="home-week-title">
        <div className={styles.tileHead}>
          <h2 id="home-week-title" className={styles.tileTitle}>
            Done this week
          </h2>
        </div>
        <div className={styles.doneBig}>
          <b>{historyKnown ? 0 : "–"}</b>
          <span>done so far</span>
        </div>
        <p className={styles.note}>
          {historyKnown
            ? "Tick off your first task and it shows up here, next to last week, so you can see your pace."
            : "This week's finished work could not be read just now. Nothing has changed."}
        </p>
      </section>
    );
  }

  const p = pace(week, dueThisWeek);
  const max = Math.max(...week.days.map((d) => Math.max(d.lastWeek, d.thisWeek ?? 0)), 4) * 1.28;
  const bar = (value: number | null, series: "this" | "last", delay: number, label: boolean) => {
    if (value === null) return <span className={styles.barCol} />;
    if (value === 0)
      return (
        <span className={styles.barCol}>
          <span className={styles.bar} data-series={series} data-zero="" />
        </span>
      );
    return (
      <span className={styles.barCol}>
        {label ? (
          <b className={styles.value} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
            {value}
          </b>
        ) : null}
        <span className={styles.bar} data-series={series} style={{ height: `${(value / max) * 100}%`, "--d": `${delay}ms` } as React.CSSProperties} />
      </span>
    );
  };

  return (
    <section ref={tipsRef} className={`${styles.tile} ${styles.s5}`} aria-labelledby="home-week-title">
      <div className={styles.tileHead}>
        <h2 id="home-week-title" className={styles.tileTitle}>
          Done this week
        </h2>
        <span className={styles.pill} data-tone={p.tone}>
          {p.chip}
        </span>
      </div>
      <div className={styles.doneBig}>
        <b ref={numRef}>{week.thisSum}</b>
        <span>done so far</span>
      </div>
      <p className={styles.pace}>{p.text}</p>
      <div
        ref={weekRef}
        className={styles.week}
        tabIndex={0}
        role="group"
        aria-label={`This week against last week, day by day. ${week.thisSum} done so far, ${week.lastBy} by the same day last week. Use the arrow keys to read each day.`}
        {...rove.props}
      >
        {week.days.map((d, i) => (
          <div
            key={d.label}
            className={styles.weekCol}
            data-today={i === week.todayIndex ? "" : undefined}
            data-tip={`${d.long}: ${d.thisWeek === null ? "still to come" : plural(d.thisWeek, "task")} this week · ${plural(d.lastWeek, "task")} last week`}
          >
            <div className={styles.weekBars}>
              {bar(d.lastWeek, "last", i * 30, false)}
              {bar(d.thisWeek, "this", i * 30 + 50, true)}
            </div>
            <span className={styles.dayLabel}>{i === week.todayIndex ? "Today" : d.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.legend} aria-hidden>
        <span>
          <i style={{ background: "var(--v3-accent)" }} />
          This week
        </span>
        <span>
          <i style={{ background: "var(--v3-border-strong)" }} />
          Last week
        </span>
      </div>
      <span className={styles.sr} aria-live="polite">
        {spoken}
      </span>
    </section>
  );
}
