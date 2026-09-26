"use client";

/* "Where things stand": every milestone on one time scale, as a thin
   segmented line. Labels only for the last one reached, the next one and
   the day itself, so it reads at a glance. */

import { motion, useReducedMotion } from "motion/react";
import type { Page } from "./data";
import { dayNum, relative, short, shortDow } from "./data";
import s from "./c5.module.css";

export function Standing({ page }: { page: Page }) {
  const reduce = useReducedMotion();
  const { marks, today, final } = page;
  const start = dayNum(marks[0].date);
  const end = dayNum(marks[marks.length - 1].date);
  const span = Math.max(1, end - start);
  const x = (d: number) => Math.min(1, Math.max(0, (d - start) / span));
  const t = x(dayNum(today));

  const done = marks.filter((k) => k.state === "done");
  const last = done[done.length - 1];
  const next = marks.find((k) => k.state === "next");
  const finalMark = marks[marks.length - 1];
  const allDone = !next;
  const notes = page.feed.filter((f) => f.kind === "dispatch").length;

  return (
    <section className={s.stand} aria-labelledby="dp-stand">
      <div className={s.standHead}>
        <h2 id="dp-stand" className={s.standTitle}>
          Where things stand
        </h2>
        <span className={s.standCount}>
          {done.length} of {marks.length} milestones reached
        </span>
      </div>
      <div className={s.standLine} role="img" aria-label={marks.map((k) => `${k.m.label}, ${shortDow(k.date)}, ${k.state === "done" ? "done" : k.state === "next" ? "next" : "later"}`).join("; ")}>
        <span className={s.standTrack} />
        <motion.span
          className={s.standDone}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: t }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        />
        {marks.map((k) => (
          <span
            key={k.m.id}
            className={s.standNode}
            data-state={k.state}
            data-final={k.m.final || undefined}
            data-moved={k.moved || undefined}
            style={{ left: `${x(dayNum(k.date)) * 100}%` }}
            title={`${k.m.label} · ${shortDow(k.date)}`}
          />
        ))}
        {!allDone ? (
          <span className={s.standToday} style={{ left: `${t * 100}%` }}>
            <span className={s.standTodayLabel}>Today</span>
          </span>
        ) : null}
      </div>
      <dl className={s.standLegend}>
        <div className={s.standCell}>
          <dt>{allDone ? "Reached" : "Last reached"}</dt>
          <dd>
            {allDone ? (
              <span className={s.standName}>All {marks.length} milestones</span>
            ) : last ? (
              <>
                <span className={s.standName}>{last.m.label}</span>
                <span className={s.standWhen}>{short(last.date)}</span>
              </>
            ) : (
              <span className={s.standName}>Not yet</span>
            )}
          </dd>
        </div>
        <div className={s.standCell} data-next>
          <dt>{allDone ? "Updates written" : "Next"}</dt>
          <dd>
            {allDone ? (
              <>
                <span className={s.standName} data-plain>
                  {notes} {notes === 1 ? "note" : "notes"}
                </span>
                <span className={s.standWhen}>since {short(marks[0].date)}</span>
              </>
            ) : next && next !== finalMark ? (
              <>
                <span className={s.standName}>{next.m.label}</span>
                <span className={s.standWhen}>
                  {shortDow(next.date)}, {relative(today, next.date)}
                </span>
              </>
            ) : (
              <span className={s.standName}>The day itself</span>
            )}
          </dd>
        </div>
        <div className={s.standCell} data-end>
          <dt>The day</dt>
          <dd>
            <span className={s.standName}>{final.label}</span>
            <span className={s.standWhen}>{shortDow(finalMark.date)}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
