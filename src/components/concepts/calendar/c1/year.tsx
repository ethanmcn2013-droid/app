"use client";

import type { CSSProperties } from "react";
import {
  PROJECT,
  TODAY,
  covers,
  dayLoad,
  daysInMonth,
  isoOf,
  monthName,
  plural,
  shortDay,
  weekday,
  type Task,
  type YM,
} from "./data";
import { loadSentence, loadTone } from "./bits";
import { Diamond } from "./icons";
import styles from "./cal.module.css";

export function YearStrip({ year, tasks, onPick }: { year: number; tasks: Task[]; onPick: (ym: YM, iso: string) => void }) {
  return (
    <div className={styles.year}>
      <div className={styles.yearGrid}>
        {Array.from({ length: 12 }, (_, m) => {
          const ym = { y: year, m };
          const n = daysInMonth(ym);
          const lead = weekday(isoOf(year, m, 1));
          const days = Array.from({ length: n }, (_, i) => isoOf(year, m, i + 1));
          const inMonth = tasks.filter((t) => t.start && days.some((d) => covers(t, d)));
          const milestones = inMonth.filter((t) => t.milestone);
          const isNow = year === 2026 && m === 9;
          return (
            <section key={m} className={styles.yearMonth} data-now={isNow ? "" : undefined} aria-label={`${monthName(ym)} ${year}`}>
              <header>
                <button type="button" className={styles.yearMonthName} onClick={() => onPick(ym, isoOf(year, m, 1))}>
                  {monthName(ym)}
                </button>
                <span>{inMonth.length ? plural(inMonth.length, "task") : "Nothing dated"}</span>
              </header>
              <div className={styles.yearDays}>
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {days.map((iso) => {
                  const load = dayLoad(tasks, iso);
                  const hasMs = tasks.some((t) => t.milestone && t.start === iso);
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={styles.yearDay}
                      data-tone={loadTone(load.open)}
                      data-level={Math.min(load.open, 8)}
                      data-today={iso === TODAY ? "" : undefined}
                      data-ms={hasMs ? "" : undefined}
                      aria-label={`${shortDay(iso)}: ${loadSentence(load.open, load.done)}${hasMs ? ", milestone" : ""}`}
                      title={`${shortDay(iso)} · ${loadSentence(load.open, load.done)}`}
                      onClick={() => onPick(ym, iso)}
                    />
                  );
                })}
              </div>
              {milestones.length ? (
                <ul className={styles.yearMs}>
                  {milestones.slice(0, 3).map((t) => (
                    <li key={t.id} style={{ "--p": PROJECT[t.project].color } as CSSProperties}>
                      <Diamond size={8} color="var(--p)" />
                      <span className={styles.yearMsDate}>{shortDay(t.start as string).replace(/^\w+ /, "")}</span>
                      <span className={styles.yearMsTitle}>{t.short ?? t.title}</span>
                    </li>
                  ))}
                  {milestones.length > 3 ? <li className={styles.yearMsMore}>+{milestones.length - 3} more</li> : null}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
      <div className={styles.yearLegend} aria-hidden>
        <span>Free</span>
        <i data-tone="none" />
        <i data-tone="calm" data-level="1" />
        <i data-tone="calm" data-level="3" />
        <i data-tone="warn" />
        <i data-tone="hot" data-level="5" />
        <i data-tone="hot" data-level="8" />
        <span>Packed</span>
        <span className={styles.yearLegendMs}>
          <Diamond size={8} color="var(--v3-text-2)" /> Milestone
        </span>
      </div>
    </div>
  );
}
