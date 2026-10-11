"use client";

import { motion } from "motion/react";
import { PEOPLE, type PersonId } from "./data";
import s from "./outline.module.css";

/** Parent progress: a conic pie inside a 3:1 ring. Full turns into a tick. */
export function ProgressRing({
  done,
  total,
  size = 16,
  delay = 0,
  pulseKey,
}: {
  done: number;
  total: number;
  size?: number;
  delay?: number;
  pulseKey?: number | null;
}) {
  const frac = total ? done / total : 0;
  const complete = total > 0 && done === total;
  const r = size / 2;
  const inner = r - 3; // pie radius
  const pieR = inner / 2; // stroke-trick radius
  const circ = 2 * Math.PI * pieR;
  const td = { transitionDelay: `${delay}ms` };
  return (
    <span className={s.ringWrap} style={{ width: size, height: size }}>
      {pulseKey != null && complete && (
        <motion.span
          key={pulseKey}
          className={s.pulse}
          initial={{ opacity: 0.55, scale: 1 }}
          animate={{ opacity: 0, scale: 2.1 }}
          transition={{ delay: delay / 1000 + 0.28, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className={s.ringSvg}>
        <circle cx={r} cy={r} r={r - 0.75} className={complete ? s.ringTrackDone : s.ringTrack} style={td} />
        <circle
          cx={r}
          cy={r}
          r={pieR}
          className={s.ringPie}
          strokeWidth={inner}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform={`rotate(-90 ${r} ${r})`}
          style={td}
        />
        <circle cx={r} cy={r} r={r - 0.25} className={complete ? s.ringFillOn : s.ringFill} style={td} />
        <path
          d={`M${r - r * 0.42} ${r + r * 0.02} L${r - r * 0.1} ${r + r * 0.34} L${r + r * 0.46} ${r - r * 0.32}`}
          className={complete ? s.ringTickOn : s.ringTick}
          style={td}
          strokeWidth={size > 18 ? 2 : 1.75}
        />
      </svg>
    </span>
  );
}

export function Check({ done }: { done: boolean }) {
  return (
    <span className={done ? `${s.check} ${s.checkOn}` : s.check} aria-hidden>
      <svg width="12" height="12" viewBox="0 0 12 12">
        <motion.path
          d="M2.6 6.3 L5 8.6 L9.6 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
    </span>
  );
}

export function Avatar({ person, size = 20 }: { person: PersonId; size?: number }) {
  const p = PEOPLE[person];
  return (
    <span
      className={s.avatar}
      style={{ width: size, height: size, background: p.hue, fontSize: size <= 20 ? 9 : 11 }}
      title={p.name}
    >
      {p.initials}
    </span>
  );
}

type IconName =
  | "chevron"
  | "back"
  | "zoom"
  | "calendar"
  | "person"
  | "indent"
  | "outdent"
  | "up"
  | "down"
  | "check"
  | "eye"
  | "eyeOff"
  | "keys"
  | "switch"
  | "plus"
  | "expand"
  | "collapse"
  | "close";

const PATHS: Record<IconName, string> = {
  chevron: "M6 4l4 4-4 4",
  back: "M10 3.5 5.5 8l4.5 4.5",
  zoom: "M9.5 3.5h3v3M12.5 3.5 8.5 7.5M6.5 12.5h-3v-3M3.5 12.5l4-4",
  calendar: "M3 5.5h10M5 2.5v2M11 2.5v2M3.5 4h9a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5Z",
  person: "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 13.5c.6-2.4 2.6-3.6 5-3.6s4.4 1.2 5 3.6",
  indent: "M3 3.5h10M7 8h6M7 12.5h6M3 6.5 5 8l-2 1.5",
  outdent: "M3 3.5h10M7 8h6M7 12.5h6M5 6.5 3 8l2 1.5",
  up: "M8 13V3.5M4 7.5 8 3.5l4 4",
  down: "M8 3v9.5M4 8.5l4 4 4-4",
  check: "M3.5 8.5 6.5 11.5 12.5 4.5",
  eye: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  eyeOff: "M2.5 2.5l11 11M6.6 4c.5-.3 1-.4 1.4-.4 4 0 6.5 4.4 6.5 4.4s-.7 1.3-2 2.5M4.2 5.3C2.500 6.500 1.5 8 1.5 8S4 12.5 8 12.5c1 0 1.9-.3 2.7-.7",
  keys: "M2.5 4.5h11v7h-11zM5 7h.01M8 7h.01M11 7h.01M5.5 9.5h5",
  switch: "M5 6l3-3 3 3M5 10l3 3 3-3",
  plus: "M8 3.5v9M3.5 8h9",
  expand: "M4.5 6 8 9.5 11.5 6M4.5 10 8 13.5 11.5 10",
  collapse: "M4.5 10 8 6.5l3.5 3.5M4.5 6 8 2.5 11.5 6",
  close: "M4 4l8 8M12 4l-8 8",
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={className}>
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
