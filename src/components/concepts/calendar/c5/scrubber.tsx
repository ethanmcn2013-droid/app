"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  SCRUB_DAYS,
  SCRUB_START,
  STREAM_END,
  STREAM_START,
  dateNum,
  fmtDay,
  isWeekend,
  mondayOf,
  monthLong,
  monthShort,
  weekday,
} from "./model";
import { Icon } from "./parts";
import styles from "./river.module.css";

export type DayStat = { load: number; label: string; milestones: string[] };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function TimeScrubber({
  stats,
  visible,
  onFly,
  dragActive,
  overDay,
}: {
  stats: (day: number) => DayStat;
  visible: { from: number; to: number };
  onFly: (day: number, mode: "drag" | "settle") => void;
  dragActive: boolean;
  overDay: number | null | "none";
}) {
  const track = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const last = useRef<number | null>(null);

  const dayAt = (clientY: number) => {
    const el = track.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const i = clamp(Math.floor(((clientY - r.top) / r.height) * SCRUB_DAYS), 0, SCRUB_DAYS - 1);
    return SCRUB_START + i;
  };

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || dragActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const d = dayAt(e.clientY);
    last.current = d;
    setScrub(d);
    onFly(d, "drag");
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dayAt(e.clientY);
    if (scrub === null) {
      if (e.pointerType === "mouse") setHover(d);
      return;
    }
    if (d !== last.current) {
      last.current = d;
      setScrub(d);
      onFly(d, "drag");
    }
  }
  function up() {
    if (scrub === null) return;
    onFly(scrub, "settle");
    setScrub(null);
    last.current = null;
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const base = clamp(visible.from, SCRUB_START, SCRUB_START + SCRUB_DAYS - 1);
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : e.key === "PageDown" ? 7 : e.key === "PageUp" ? -7 : 0;
    if (!step) return;
    e.preventDefault();
    onFly(clamp(base + step, SCRUB_START, SCRUB_START + SCRUB_DAYS - 1), "settle");
  }

  const pct = (d: number) => ((d - SCRUB_START) / SCRUB_DAYS) * 100;
  const vFrom = clamp(visible.from, SCRUB_START, SCRUB_START + SCRUB_DAYS);
  const vTo = clamp(visible.to + 1, SCRUB_START, SCRUB_START + SCRUB_DAYS);
  const bubbleDay = scrub ?? hover;
  const bubble = bubbleDay !== null ? stats(bubbleDay) : null;

  return (
    <nav className={styles.scrubber} aria-label="Jump through the next ten weeks">
      <div className={styles.scrubHead}>
        <span>Coming up</span>
      </div>
      <div
        ref={track}
        className={cx(styles.scrubTrack, scrub !== null && styles.scrubbing)}
        role="slider"
        tabIndex={0}
        aria-label="Date on screen"
        aria-valuemin={0}
        aria-valuemax={SCRUB_DAYS - 1}
        aria-valuenow={clamp(visible.from - SCRUB_START, 0, SCRUB_DAYS - 1)}
        aria-valuetext={fmtDay(visible.from)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => setHover(null)}
        onKeyDown={key}
      >
        {vTo > vFrom && (
          <motion.span
            className={styles.scrubView}
            aria-hidden="true"
            initial={false}
            animate={{ top: `${pct(vFrom)}%`, height: `${Math.max(pct(vTo) - pct(vFrom), 1.4)}%` }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          />
        )}
        {Array.from({ length: SCRUB_DAYS }, (_, i) => {
          const d = SCRUB_START + i;
          const s = stats(d);
          const width = s.load ? 6 + Math.min(s.load, 9) * 4 : 3;
          const monday = mondayOf(d) === d;
          const newMonth = dateNum(d) === 1 || i === 0;
          return (
            <div
              key={d}
              className={cx(
                styles.scrubDay,
                d === 0 && styles.scrubToday,
                d < 0 && styles.scrubPast,
                isWeekend(d) && styles.scrubWeekend,
                dragActive && overDay === d && styles.scrubDrop,
              )}
              data-drop-day={dragActive ? d : undefined}
            >
              {newMonth && <span className={styles.scrubMonth}>{monthShort(d)}</span>}
              {monday && !newMonth && <span className={styles.scrubMonday}>{dateNum(d)}</span>}
              <span className={cx(styles.scrubTick, s.load === 0 && styles.scrubTickEmpty)} style={{ width }} />
              {s.milestones.map((c, j) => (
                <span key={j} className={styles.scrubDiamond} style={{ background: c, left: 30 + width + 4 + j * 9 }} />
              ))}
            </div>
          );
        })}
        <AnimatePresence>
          {bubble && bubbleDay !== null && (
            <motion.div
              className={styles.scrubBubble}
              aria-hidden="true"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0, top: `${pct(bubbleDay + 0.5)}%` }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
            >
              <span className={styles.bubbleDate}>{bubbleDay === 0 ? `Today, ${fmtDay(0)}` : fmtDay(bubbleDay)}</span>
              <span className={styles.bubbleSub}>{s0(bubble)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

const s0 = (s: DayStat) => s.label;

export function WeekStrip({
  focus,
  stats,
  onFly,
}: {
  focus: number;
  stats: (day: number) => DayStat;
  onFly: (day: number, mode: "drag" | "settle") => void;
}) {
  const monday = mondayOf(clamp(focus, STREAM_START, STREAM_END));
  const days = Array.from({ length: 7 }, (_, i) => monday + i);
  return (
    <div className={styles.strip}>
      <div className={styles.stripHead}>
        <span className={styles.stripMonth}>
          {monthLong(focus)} <span className={styles.stripYear}>2026</span>
        </span>
        <span className={styles.stripNav}>
          <button type="button" className={styles.iconBtn} aria-label="Previous week" disabled={monday - 7 < mondayOf(STREAM_START)} onClick={() => onFly(Math.max(monday - 7, STREAM_START), "settle")}>
            <Icon name="chevron-left" size={16} />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Next week" disabled={monday + 7 > STREAM_END} onClick={() => onFly(monday + 7, "settle")}>
            <Icon name="chevron-right" size={16} />
          </button>
        </span>
      </div>
      <div className={styles.stripDays}>
        {days.map((d) => {
          const s = stats(d);
          const dots = s.load === 0 ? 0 : s.load < 2.5 ? 1 : s.load < 5 ? 2 : 3;
          return (
            <button
              key={d}
              type="button"
              className={cx(styles.stripDay, d === focus && styles.stripDayOn, d === 0 && styles.stripToday, d < 0 && styles.stripPast)}
              onClick={() => onFly(d, "settle")}
              aria-label={`${fmtDay(d)}. ${s.label}`}
              aria-current={d === focus ? "date" : undefined}
            >
              <span className={styles.stripDow}>{weekday(d).charAt(0)}</span>
              <span className={styles.stripNum}>{dateNum(d)}</span>
              <span className={styles.stripDots} aria-hidden="true">
                {s.milestones.length > 0 ? (
                  <span className={styles.stripDiamond} style={{ background: s.milestones[0] }} />
                ) : (
                  Array.from({ length: dots }, (_, i) => <span key={i} className={styles.stripDot} />)
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
