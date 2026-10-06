"use client";

/**
 * The flow band above the board: one status card per stage, a plain health
 * line, and a replay of the last three weeks. Plus the column sparkline and the
 * stuck-work sheet. Carried over from "Flow and friction".
 */

import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { STUCK_DAYS } from "../../demo/store";
import { nudgeWho } from "../../tasks/nudge";
import { STAGES, type StageKey } from "./data";
import { REPLAY_DAYS, ageLevel, dayLabel, daysText, moveOnLabel, shortDay, type Placed } from "./flow-model";
import { FlowIcon as Icon } from "./flow-icons";
import styles from "./flow.module.css";

const STAGE_NAME = Object.fromEntries(STAGES.map((s) => [s.key, s.name])) as Record<StageKey, string>;

export function TimeMachine({
  day,
  playing,
  caption,
  onDay,
  onPlay,
  onClose,
}: {
  day: number;
  playing: boolean;
  /** What happened on the chosen day, in a few words. */
  caption: string;
  onDay: (day: number) => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const days = Array.from({ length: REPLAY_DAYS }, (_, i) => i - (REPLAY_DAYS - 1));
  const pct = ((day + REPLAY_DAYS - 1) / (REPLAY_DAYS - 1)) * 100;
  return (
    <div className={styles.machine} data-past={day < 0 || undefined}>
      <button type="button" className={styles.playButton} onClick={onPlay} aria-label={playing ? "Pause the replay" : "Replay the last three weeks"}>
        {playing ? <Icon.pause size={14} /> : <Icon.play size={14} />}
        <span className={styles.playText}>{playing ? "Pause" : "Play"}</span>
      </button>
      <div className={styles.track} style={{ "--pct": `${pct}%` } as CSSProperties}>
        <input
          className={styles.range}
          type="range"
          min={-(REPLAY_DAYS - 1)}
          max={0}
          step={1}
          value={day}
          onChange={(e) => onDay(Number(e.target.value))}
          aria-label="Look back through the last three weeks"
          aria-valuetext={day === 0 ? "Today" : dayLabel(day, { long: true })}
        />
        <div className={styles.ticks} aria-hidden="true">
          {days.map((d) => {
            const sd = shortDay(d);
            return (
              <button
                key={d}
                type="button"
                tabIndex={-1}
                className={styles.tick}
                data-current={d === day || undefined}
                data-weekend={sd.weekday === "Sat" || sd.weekday === "Sun" || undefined}
                data-anchor={d === 0 || sd.weekday === "Mon" || undefined}
                onClick={() => onDay(d)}
              >
                <span className={styles.tickDay}>{d === 0 ? "Today" : sd.weekday.slice(0, 1)}</span>
                <span className={styles.tickDate}>{sd.date}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.machineStatus}>
        <p className={styles.machineCaption} aria-live="polite">
          <span className={styles.machineWhen}>
            <Icon.rewind size={13} />
            {day === 0 ? "Today" : dayLabel(day, { long: true }).replace(/^./, (c) => c.toUpperCase())}
          </span>
          <span className={styles.machineText}>{caption}</span>
        </p>
        <button type="button" className={styles.linkButton} onClick={onClose}>
          {day === 0 ? "Close" : "Back to today"}
        </button>
      </div>
    </div>
  );
}

/** Fourteen days of task count, latest point accented. */
export function Sparkline({ values, max, width = 64, height = 20, label }: { values: number[]; max: number; width?: number; height?: number; label: string }) {
  const pad = 3;
  const top = Math.max(max, 1);
  const pts = values.map((v, i) => [pad + (i * (width - pad * 2)) / (values.length - 1), height - pad - (v / top) * (height - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${height - pad} L${pts[0][0].toFixed(1)} ${height - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className={styles.spark} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path className={styles.sparkArea} d={area} />
      <path className={styles.sparkLine} d={d} />
      <circle className={styles.sparkDot} cx={last[0]} cy={last[1]} r={2.75} />
    </svg>
  );
}

/** A small gauge that fills over the stage's usual time: amber at 1x, a filled centre at 2x. */
function AgeRing({ age, usual, size = 18 }: { age: number; usual: number; size?: number }) {
  const stroke = size >= 30 ? 3.5 : 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = usual > 0 ? Math.min(age / usual, 1) : 0;
  const level = ageLevel(age, usual);
  return (
    <svg className={styles.ring} data-level={level} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className={styles.ringFill}
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(frac, age > 0 ? 0.06 : 0))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {level === "over" ? <circle className={styles.ringCore} cx={size / 2} cy={size / 2} r={r * 0.42} /> : null}
    </svg>
  );
}

const SHEET = { type: "spring", stiffness: 380, damping: 36 } as const;

export function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className={styles.scrim}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      aria-hidden="true"
    />
  );
}

export function StuckTriage({
  items,
  nudged,
  onClose,
  onNudge,
  onMoveOn,
  onSplit,
}: {
  items: Placed[];
  nudged: ReadonlySet<string>;
  onClose: () => void;
  onNudge: (p: Placed) => void;
  onMoveOn: (p: Placed) => void;
  onSplit: (p: Placed) => void;
}) {
  return (
    <motion.aside
      className={styles.triage}
      role="dialog"
      aria-modal="true"
      aria-labelledby="c1-triage-title"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={SHEET}
    >
      <span className={styles.grabber} aria-hidden="true" />
      <header className={styles.triageHead}>
        <div>
          <h2 id="c1-triage-title" className={styles.triageTitle}>
            {items.length ? `${items.length} ${items.length === 1 ? "thing has" : "things have"} sat too long` : "Nothing is stuck"}
          </h2>
          <p className={styles.triageSub}>
            {items.length ? `Started, and still for ${STUCK_DAYS} days or more. Oldest first: clear what you can, split what is too big.` : `Everything started has moved in the last ${STUCK_DAYS} days.`}
          </p>
        </div>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close" autoFocus>
          <Icon.close size={16} />
        </button>
      </header>
      <ol className={styles.triageList}>
        {items.map((p) => {
          const u = STUCK_DAYS;
          const who = nudgeWho(p.task.src);
          const isNudged = nudged.has(p.task.id);
          return (
            <motion.li key={p.task.id} layout className={styles.triageItem} exit={{ opacity: 0, x: 24 }}>
              <div className={styles.triageMain}>
                <AgeRing age={p.age} usual={u} size={26} />
                <span className={styles.triageText}>
                  <span className={styles.triageName}>{p.task.title}</span>
                  <span className={styles.triageMeta}>
                    {STAGE_NAME[p.stage]} for {daysText(p.age)}
                    {p.task.heldBy && p.stage === "waiting" ? ` · waiting on ${p.task.heldBy}` : ""}
                  </span>
                </span>
              </div>
              <div className={styles.triageActions}>
                <button type="button" className={styles.chipButton} onClick={() => onNudge(p)} disabled={isNudged}>
                  <Icon.bell size={13} />
                  {isNudged ? "Nudged today" : `Nudge ${who}`}
                </button>
                <button type="button" className={styles.chipButton} onClick={() => onMoveOn(p)}>
                  <Icon.moveOn size={13} />
                  {moveOnLabel(p.stage)}
                </button>
                <button type="button" className={styles.chipButton} onClick={() => onSplit(p)}>
                  <Icon.split size={13} />
                  Split
                </button>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </motion.aside>
  );
}
