"use client";

/* One letter in the run, the quiet line for a milestone that passed
   without a note, and the single "thank you" a reader can leave. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Attach, Dispatch, Iso, Milestone } from "./data";
import { dayNum, monthDay, short, shortDow, weekday } from "./data";
import { FigureView } from "./figures";
import s from "./c5.module.css";

export function Rail({ date, fresh, quiet }: { date: Iso; fresh?: boolean; quiet?: boolean }) {
  const md = monthDay(date);
  return (
    <div className={s.rail} data-quiet={quiet || undefined}>
      <span className={s.railNode} data-fresh={fresh || undefined} aria-hidden="true" />
      {quiet ? (
        <span className={s.railQuiet}>{short(date)}</span>
      ) : (
        <>
          <span className={s.railDate}>
            {md.day} {md.month}
          </span>
          <span className={s.railDay}>{weekday(date)}</span>
        </>
      )}
    </div>
  );
}

export function DispatchView({
  d,
  fresh,
  thanked,
  onThank,
  dateOf,
  today,
  first,
}: {
  d: Dispatch;
  fresh: boolean;
  thanked: boolean;
  onThank: () => void;
  dateOf: (label: string) => Iso | undefined;
  today: Iso;
  first?: boolean;
}) {
  const hid = `dp-${d.id}`;
  return (
    <article className={s.row} aria-labelledby={hid} data-fresh={fresh || undefined} id={`update-${d.id}`}>
      <Rail date={d.date} fresh={fresh} />
      <div className={s.letter} data-first={first || undefined}>
        <header className={s.letterHead}>
          <span className={s.avatar} data-tone={d.author.tone} aria-hidden="true">
            {d.author.initials}
          </span>
          <span className={s.who}>
            <span className={s.whoName}>
              {fresh ? (
                <span className={s.freshDot}>
                  <span className={s.srOnly}>New since you last looked. </span>
                </span>
              ) : null}
              {d.author.name}
            </span>
            <span className={s.whoRole}>
              {d.author.role}
              <span className={s.phoneDate}> · {shortDow(d.date)}</span>
            </span>
          </span>
        </header>
        <h2 className={s.headline} id={hid}>
          {d.headline}
        </h2>
        <div className={s.body}>
          {d.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {d.figure ? <FigureView f={d.figure} /> : null}
        <footer className={s.letterFoot}>
          {d.attach ? <Chip a={d.attach} dateOf={dateOf} today={today} /> : <span />}
          <Thanks count={d.thanks + (thanked ? 1 : 0)} on={thanked} onToggle={onThank} title={d.headline} />
        </footer>
      </div>
    </article>
  );
}

function Chip({ a, dateOf, today }: { a: Attach; dateOf: (label: string) => Iso | undefined; today: Iso }) {
  const when = a.kind === "coming" ? dateOf(a.milestone) : undefined;
  const passed = a.kind === "coming" && when !== undefined && dayNum(when) <= dayNum(today);
  if (a.kind === "reached" || passed)
    return (
      <span className={s.chip} data-kind="reached">
        <svg viewBox="0 0 12 12" className={s.chipGlyph} aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" />
          <path d="M3.8 6.1 L 5.3 7.5 L 8.3 4.4" />
        </svg>
        <span>
          Milestone reached · <span className={s.chipStrong}>{a.milestone}</span>
        </span>
      </span>
    );
  if (a.kind === "coming") {
    return (
      <span className={s.chip} data-kind="coming">
        <svg viewBox="0 0 12 12" className={s.chipGlyph} aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" />
        </svg>
        <span>
          Coming up · <span className={s.chipStrong}>{a.milestone}</span>
          {when ? `, ${shortDow(when)}` : null}
        </span>
      </span>
    );
  }
  return (
    <span className={s.chip} data-kind="moved">
      <svg viewBox="0 0 12 12" className={s.chipGlyph} aria-hidden="true">
        <path d="M2 6 H 9.5 M7 3.5 L 9.5 6 L 7 8.5" />
      </svg>
      <span>
        <span className={s.chipStrong}>{a.milestone}</span> · moved from{" "}
        <del className={s.chipOld}>
          <span className={s.srOnly}>was </span>
          {short(a.from)}
        </del>{" "}
        to {short(a.to)}
      </span>
    </span>
  );
}

function Thanks({ count, on, onToggle, title }: { count: number; on: boolean; onToggle: () => void; title: string }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      className={s.thanks}
      aria-pressed={on}
      onClick={onToggle}
      aria-label={on ? `You said thank you for "${title}". ${count} thanks in all. Tap to take it back.` : `Say thank you for "${title}". ${count} people already have.`}
    >
      <span className={s.heartWrap} aria-hidden="true">
        <motion.svg
          viewBox="0 0 16 16"
          className={s.heart}
          animate={on && !reduce ? { scale: [1, 1.38, 0.94, 1] } : { scale: 1 }}
          transition={{ duration: 0.46, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <path d="M8 13.6 C 3.6 10.6 1.8 8.4 1.8 6 C 1.8 4.1 3.2 2.7 5 2.7 C 6.3 2.7 7.3 3.4 8 4.5 C 8.7 3.4 9.7 2.7 11 2.7 C 12.8 2.7 14.2 4.1 14.2 6 C 14.2 8.4 12.4 10.6 8 13.6 Z" />
        </motion.svg>
        <AnimatePresence>
          {on && !reduce ? (
            <motion.span key="burst" className={s.burst} initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
              {Array.from({ length: 6 }, (_, i) => {
                const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
                return (
                  <motion.span
                    key={i}
                    className={s.burstDot}
                    initial={{ x: 0, y: 0, scale: 0.6 }}
                    animate={{ x: Math.cos(ang) * 14, y: Math.sin(ang) * 14, scale: 0 }}
                    transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                );
              })}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      <span className={s.thanksLabel}>{on ? "Thanked" : "Thank you"}</span>
      <span className={s.thanksCount}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={reduce ? false : { y: on ? 10 : -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: on ? -10 : 10, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {count}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

export function PassedLine({ m, date }: { m: Milestone; date: Iso }) {
  return (
    <div className={s.row} data-kind="passed">
      <Rail date={date} quiet />
      <p className={s.passed}>
        <svg viewBox="0 0 12 12" className={s.passedGlyph} aria-hidden="true">
          <circle cx="6" cy="6" r="3.2" />
        </svg>
        <span className={s.passedLabel}>{m.label}</span>
        <span className={s.passedDate}>
          <span className={s.passedPhoneDate}>{short(date)} · </span>reached
        </span>
      </p>
    </div>
  );
}
