"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Person } from "./data";
import styles from "./countdown.module.css";

type IconName =
  | "check"
  | "plus"
  | "calendar"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "x"
  | "alert"
  | "keyboard"
  | "arrow-right"
  | "clock"
  | "pin"
  | "undo"
  | "steps"
  | "note"
  | "eye";

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M3.5 8.5l3 3 6-7" />,
  plus: <path d="M8 3v10M3 8h10" />,
  calendar: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </>
  ),
  "chevron-left": <path d="M10 3.5L5.5 8l4.5 4.5" />,
  "chevron-right": <path d="M6 3.5L10.5 8 6 12.5" />,
  "chevron-down": <path d="M3.5 6l4.5 4.5L12.5 6" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  alert: (
    <>
      <path d="M8 2.5l6 10.5H2L8 2.5z" />
      <path d="M8 6.5v3M8 11.3v.2" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
      <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6" />
    </>
  ),
  "arrow-right": <path d="M3 8h10M9 4l4 4-4 4" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  pin: (
    <path d="M8 1.5l1.8 4.2 4.2.4-3.2 2.8 1 4.3L8 11l-3.8 2.2 1-4.3L2 6.1l4.2-.4L8 1.5z" />
  ),
  undo: <path d="M5 6.5H10a3 3 0 010 6H7M5 6.5L7.5 4M5 6.5L7.5 9" />,
  steps: <path d="M3 4.5h1.5M3 8h1.5M3 11.5h1.5M7 4.5h6M7 8h6M7 11.5h6" />,
  note: <path d="M3 4h10M3 8h10M3 12h6" />,
  eye: (
    <>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Diamond({
  size = 10,
  filled = true,
  className,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 .8L9.2 5 5 9.2.8 5z"
        fill={filled ? "currentColor" : "var(--v3-surface)"}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Avatar({
  person,
  size = 20,
}: {
  person?: Person;
  size?: number;
}) {
  if (!person) return null;
  return (
    <span
      className={styles.avatar}
      style={
        {
          "--h": person.hue,
          width: size,
          height: size,
          fontSize: Math.round(size * 0.42),
        } as CSSProperties
      }
      title={person.name}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

/** Done over due-so-far, with the late share drawn in danger right after it. */
export function ReadinessRing({
  done,
  late,
  total,
  size = 64,
  stroke = 6,
  label = true,
}: {
  done: number;
  late: number;
  total: number;
  size?: number;
  stroke?: number;
  label?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const doneShare = total ? done / total : 1;
  const lateShare = total ? late / total : 0;
  const gap =
    doneShare > 0 && doneShare < 1 ? Math.min(stroke + 2, c * 0.04) : 0;
  const doneLen = Math.max(0, doneShare * c - (lateShare ? gap : 0));
  const lateLen = Math.max(0, lateShare * c - gap);
  const pct = Math.round(doneShare * 100);
  const rot = `rotate(-90 ${size / 2} ${size / 2})`;
  return (
    <span className={styles.ring} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={styles.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />
        {lateLen > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={styles.ringLate}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            transform={rot}
            style={{
              strokeDasharray: `0 ${doneShare * c + gap / 2} ${lateLen} ${c}`,
            }}
          />
        ) : null}
        {doneLen > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={styles.ringDone}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            transform={rot}
            style={{ strokeDasharray: `${doneLen} ${c}` }}
          />
        ) : null}
      </svg>
      {label ? (
        <span
          className={styles.ringLabel}
          style={{ fontSize: Math.max(11, Math.round(size * 0.22)) }}
        >
          {pct}
          <span className={styles.ringPct}>%</span>
        </span>
      ) : null}
    </span>
  );
}
