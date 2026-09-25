"use client";

/* Ask for a tool: one-line tools, made on the spot. */

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { NOW_ISO } from "./data";
import { Minus, Pause, Play, Plus, Reset } from "./glyphs";
import s from "./c4.module.css";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/* ── speech timer ────────────────────────────────────────────────── */

export function Timer({ seconds, label }: { seconds: number; label: string }) {
  const [length, setLength] = useState(seconds);
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rest = Math.max(0, (endAt.current - performance.now()) / 1000);
      setLeft(rest);
      if (rest <= 0) setRunning(false);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    const from = left <= 0 ? length : left;
    endAt.current = performance.now() + from * 1000;
    setLeft(from);
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setLeft(length);
  };
  const nudge = (d: number) => {
    const next = Math.min(20 * 60, Math.max(30, length + d));
    setLength(next);
    if (!running) setLeft(next);
    else endAt.current += d * 1000;
  };

  const shown = Math.ceil(left);
  const frac = length ? left / length : 0;
  const late = left > 0 && left <= 30;
  const up = left <= 0;
  const R = 58;
  const C = 2 * Math.PI * R;

  return (
    <div className={s.timer}>
      <div className={s.timerDial}>
        <svg viewBox="0 0 140 140" width="100%" aria-hidden>
          <circle cx="70" cy="70" r={R} className={s.timerTrack} />
          <circle
            cx="70"
            cy="70"
            r={R}
            className={cx(s.timerArc, late && s.timerArcLate, up && s.timerArcUp)}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            transform="rotate(-90 70 70)"
          />
          {Array.from({ length: 60 }, (_, k) => {
            const a = (k / 60) * Math.PI * 2;
            const r1 = k % 5 === 0 ? 45 : 47;
            return <line key={k} x1={70 + Math.sin(a) * r1} y1={70 - Math.cos(a) * r1} x2={70 + Math.sin(a) * 49} y2={70 - Math.cos(a) * 49} className={s.timerTick} />;
          })}
        </svg>
        <div className={s.timerFace}>
          <span className={cx(s.timerNum, s.num, up && s.timerNumUp)} aria-live="off">
            {mmss(shown)}
          </span>
          <span className={s.timerSub} aria-live="polite">
            {up ? "Time is up" : late ? "Thirty seconds left" : running ? "Running" : `${label}, ready`}
          </span>
        </div>
      </div>
      <div className={s.timerSide}>
        <p className={s.timerName}>{label}</p>
        <p className={s.timerLen}>
          <span className={s.num}>{mmss(length)}</span> each
        </p>
        <div className={s.timerRow}>
          <button type="button" className={s.primary} onClick={running ? () => setRunning(false) : start}>
            {running ? <Pause /> : <Play />}
            {running ? "Pause" : up ? "Start again" : "Start"}
          </button>
          <button type="button" className={s.iconBtn} onClick={reset} aria-label="Reset the timer">
            <Reset />
          </button>
        </div>
        <div className={s.timerRow}>
          <button type="button" className={s.stepBtn} onClick={() => nudge(-30)} aria-label="Thirty seconds shorter">
            <Minus /> 30s
          </button>
          <button type="button" className={s.stepBtn} onClick={() => nudge(30)} aria-label="Thirty seconds longer">
            <Plus /> 30s
          </button>
        </div>
        <p className={s.timerHint}>The ring turns amber at thirty seconds, so the speaker can see it from the top table.</p>
      </div>
    </div>
  );
}

/* ── countdown to a date ─────────────────────────────────────────── */

export function Countdown({ iso }: { iso: string }) {
  const reduced = useReducedMotion();
  const base = new Date(NOW_ISO).getTime();
  const target = new Date(iso).getTime();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - t0), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, target - base - elapsed);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const cells = [
    { n: d, u: d === 1 ? "day" : "days" },
    { n: h, u: h === 1 ? "hour" : "hours" },
    { n: m, u: "min" },
    { n: sec, u: "sec" },
  ];
  const totalDays = d + 1;
  return (
    <div className={s.cd}>
      <div className={s.cdCells}>
        {cells.map((c, i) => (
          <div key={c.u} className={cx(s.cdCell, i === 0 && s.cdCellMain)}>
            <span className={cx(s.cdNum, s.num)}>{String(c.n).padStart(2, "0")}</span>
            <span className={s.cdUnit}>{c.u}</span>
          </div>
        ))}
      </div>
      <div className={s.cdDots} aria-label={`${totalDays} days, one dot each`} role="img">
        {Array.from({ length: Math.min(totalDays, 70) }, (_, k) => (
          <motion.span
            key={k}
            className={cx(s.cdDot, k === 0 && s.cdDotToday, k === totalDays - 1 && s.cdDotDay)}
            initial={reduced ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: reduced ? 0 : 0.1 + k * 0.012 }}
          />
        ))}
      </div>
      <p className={s.cdLegend}>
        <span className={cx(s.cdDot, s.cdDotToday)} aria-hidden /> Today
        <span className={cx(s.cdDot, s.cdDotDay)} aria-hidden /> The day
        <span className={s.cdLegendRest}>One dot for each day left</span>
      </p>
    </div>
  );
}
