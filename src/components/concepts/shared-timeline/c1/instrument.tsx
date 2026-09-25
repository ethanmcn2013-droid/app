"use client";

/* The sticky instrument: one vertical path, y = date on a single linear
   scale from the first chapter to the day. The stroke fills to today,
   the chapter being read swells and names itself. */

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { dayNum, fmtDM, fmtMonthShort, type Story } from "./data";
import s from "./c1.module.css";

const PAD_TOP = 18;
const PAD_BOTTOM = 34;

export type PathGeometry = {
  y: (iso: string) => number;
  x: (y: number) => number;
  d: (y0: number, y1: number) => string;
};

export function geometry(
  story: Story,
  width: number,
  height: number,
  cxFrac = 0.4,
): PathGeometry {
  const a = dayNum(story.start);
  const b = Math.max(dayNum(story.day), a + 1);
  const span = height - PAD_TOP - PAD_BOTTOM;
  const y = (iso: string) =>
    PAD_TOP + ((Math.min(Math.max(dayNum(iso), a), b) - a) / (b - a)) * span;
  const cx = width * cxFrac;
  const amp = Math.min(22, width * 0.05);
  /* A slow hand-drawn meander: x wanders, y stays true to the date. */
  const x = (yy: number) =>
    cx +
    amp *
      Math.sin(((yy - PAD_TOP) / span) * Math.PI * 2.4 + 0.6) *
      (0.55 + 0.45 * Math.sin((yy / span) * 3.1));
  const d = (y0: number, y1: number) => {
    const pts: string[] = [];
    const step = 3;
    for (let yy = y0; yy < y1; yy += step)
      pts.push(`${x(yy).toFixed(1)} ${yy.toFixed(1)}`);
    pts.push(`${x(y1).toFixed(1)} ${y1.toFixed(1)}`);
    return `M${pts.join(" L")}`;
  };
  return { y, x, d };
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 440, h: 560 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      if (w > 0 && h > 0) setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function monthTicks(story: Story) {
  const a = dayNum(story.start);
  const b = dayNum(story.day);
  const out: { iso: string; label: string }[] = [];
  const [y0, m0] = story.start.split("-").map(Number);
  let y = y0;
  let m = m0 + 1;
  for (let guard = 0; guard < 40; guard += 1) {
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const iso = `${y}-${String(m).padStart(2, "0")}-01`;
    if (dayNum(iso) >= b) break;
    if (dayNum(iso) > a)
      out.push({
        iso,
        label: m === 1 ? `${fmtMonthShort(iso)} ${y}` : fmtMonthShort(iso),
      });
    m += 1;
  }
  return out;
}

export function Instrument({
  story,
  active,
  onJump,
}: {
  story: Story;
  active: string;
  onJump: (id: string) => void;
}) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const g = useMemo(() => geometry(story, w, h), [story, w, h]);
  const ticks = useMemo(() => monthTicks(story), [story]);
  const empty = story.chapters.length === 0;
  const yStart = g.y(story.start);
  const yEnd = g.y(story.day);
  const pastDay = dayNum(story.today) >= dayNum(story.day);
  const yToday = g.y(pastDay ? story.day : story.today);
  const full = g.d(yStart, yEnd);
  const done = g.d(yStart, Math.max(yToday, yStart + 0.5));
  const activeChapter = story.chapters.find((c) => c.id === active);
  const dayActive = active === "day";
  /* Space the month labels so they never touch: skip ticks closer than 22px. */
  const shown = ticks.filter((t, i, all) => {
    const yy = g.y(t.iso);
    const prev = all
      .slice(0, i)
      .reverse()
      .find((p) => g.y(p.iso) < yy);
    return !prev || yy - g.y(prev.iso) >= 22 || t.label.includes(" ");
  });
  const todayLabelTop = Math.min(Math.max(yToday, yStart + 26), yEnd - 26);
  const monthLabels = pastDay
    ? shown
    : shown.filter((t) => Math.abs(g.y(t.iso) - todayLabelTop) > 22);
  /* Quiet names beside every dot, dropped where they would touch a neighbour,
     the chapter being read (which gets the large label) or the day. */
  const yActive = activeChapter ? g.y(activeChapter.date) : null;
  const quiet: { id: string; y: number; title: string; done: boolean }[] = [];
  for (const c of story.chapters) {
    const cy = g.y(c.date);
    const last = quiet[quiet.length - 1];
    if (c.id === active) continue;
    if (last && cy - last.y < 20) continue;
    if (yActive !== null && Math.abs(cy - yActive) < 42) continue;
    if (yEnd - cy < 26) continue;
    quiet.push({ id: c.id, y: cy, title: c.title, done: c.status === "done" });
  }

  return (
    <div className={s.pathWrap} ref={ref}>
      <svg
        className={s.pathSvg}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden="true"
      >
        <defs>
          <filter id="rt-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <path d={full} className={s.pathTrack} fill="none" />
        {empty ? null : (
          <motion.path
            key={`${story.audience}-${story.state}`}
            d={done}
            className={s.pathDone}
            fill="none"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          />
        )}
        {story.chapters.map((c) => {
          const cy = g.y(c.date);
          const on = c.id === active;
          const isDone = c.status === "done";
          return (
            <motion.circle
              key={c.id}
              cx={g.x(cy)}
              cy={cy}
              r={5}
              className={isDone ? s.dotDone : s.dotTodo}
              initial={false}
              animate={{ scale: on ? 1.7 : 1 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 420, damping: 26 }
              }
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          );
        })}
        {/* The day: a ring that fills when the story arrives there. */}
        <circle
          cx={g.x(yEnd)}
          cy={yEnd}
          r={11}
          className={dayActive || pastDay ? s.dayRingOn : s.dayRing}
        />
        <circle cx={g.x(yEnd)} cy={yEnd} r={4} className={s.dayCore} />
        {pastDay ? null : (
          <g>
            <circle
              cx={g.x(yToday)}
              cy={yToday}
              r={11}
              className={s.hereGlow}
              filter="url(#rt-glow)"
            />
            {reduce ? null : (
              <motion.circle
                key={`pulse-${story.audience}-${story.state}`}
                cx={g.x(yToday)}
                cy={yToday}
                r={7}
                className={s.herePulse}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 3.2], opacity: [0.55, 0] }}
                transition={{ duration: 1.1, delay: 0.85, ease: "easeOut" }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            )}
            <motion.circle
              cx={g.x(yToday)}
              cy={yToday}
              r={7}
              className={s.hereDot}
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.8,
                type: "spring",
                stiffness: 380,
                damping: 18,
              }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          </g>
        )}
      </svg>

      {/* Labels are HTML so they wrap and take the audience's type. */}
      {monthLabels.map((t) => (
        <span key={t.iso} className={s.tick} style={{ top: g.y(t.iso) }}>
          {t.label}
        </span>
      ))}
      {pastDay ? null : (
        <span
          className={s.hereLabel}
          style={{ top: todayLabelTop, right: w - g.x(yToday) + 18 }}
        >
          You are here
          <span className={s.hereDate}>{fmtDM(story.today)}</span>
        </span>
      )}
      <button
        type="button"
        className={s.dayLabel}
        data-on={dayActive || undefined}
        style={{ top: yEnd, left: g.x(yEnd) + 22 }}
        onClick={() => onJump("day")}
      >
        <span className={s.dayLabelTitle}>{story.dayTitle}</span>
        <span className={s.dayLabelDate}>{fmtDM(story.day)}</span>
      </button>

      {quiet.map((q) => (
        <span
          key={q.id}
          className={s.quietLabel}
          data-done={q.done || undefined}
          style={{ top: q.y, left: g.x(q.y) + 16 }}
          aria-hidden="true"
        >
          {q.title}
        </span>
      ))}
      {story.chapters.map((c) => {
        const cy = g.y(c.date);
        const on = c.id === active;
        return (
          <button
            key={c.id}
            type="button"
            className={s.dotHit}
            style={{ top: cy, left: g.x(cy) }}
            onClick={() => onJump(c.id)}
            aria-label={`Go to chapter ${c.n}: ${c.title}`}
            data-on={on || undefined}
          />
        );
      })}
      {activeChapter ? (
        <motion.div
          key={activeChapter.id}
          className={s.activeLabel}
          data-status={activeChapter.status}
          style={{
            top: g.y(activeChapter.date),
            left: g.x(g.y(activeChapter.date)) + 22,
            y:
              yEnd - g.y(activeChapter.date) < 44
                ? "calc(-100% - 8px)"
                : "-50%",
          }}
          initial={reduce ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          aria-hidden="true"
        >
          <span className={s.activeDate}>{fmtDM(activeChapter.date)}</span>
          <span className={s.activeTitle}>{activeChapter.title}</span>
        </motion.div>
      ) : null}
    </div>
  );
}

/* Phone: the same scale, laid flat. */
export function ProgressLine({
  story,
  active,
}: {
  story: Story;
  active: string;
}) {
  const a = dayNum(story.start);
  const b = Math.max(dayNum(story.day), a + 1);
  const f = (iso: string) =>
    Math.min(Math.max((dayNum(iso) - a) / (b - a), 0), 1);
  const activeChapter = story.chapters.find((c) => c.id === active);
  return (
    <div className={s.progress} aria-hidden="true">
      <span
        className={s.progressFill}
        style={{ width: `${f(story.today) * 100}%` }}
      />
      {story.chapters.map((c) => (
        <span
          key={c.id}
          className={s.progressTick}
          data-done={c.status === "done" || undefined}
          data-on={c.id === activeChapter?.id || undefined}
          style={{ left: `${f(c.date) * 100}%` }}
        />
      ))}
      <span className={s.progressEnd} data-on={active === "day" || undefined} />
    </div>
  );
}
