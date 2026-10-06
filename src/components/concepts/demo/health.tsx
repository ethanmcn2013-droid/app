/**
 * One way to show a project's health, everywhere in the demo: the same words
 * and the same marks. On track stays quiet; amber is at risk; red is off
 * track; a dashed ring means it is too early to tell.
 */

import type { CSSProperties } from "react";
import styles from "./health.module.css";

export type HealthKey = "on_track" | "at_risk" | "off_track" | "too_early";

export const HEALTH_WORDS: Record<HealthKey, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  too_early: "Too early to tell",
};

const TONE: Record<HealthKey, string> = {
  on_track: "var(--v3-text-2)",
  at_risk: "var(--v3-warning-stroke)",
  off_track: "var(--v3-danger)",
  too_early: "var(--v3-text-3)",
};

/** Turn a stored health plus the too-early flag into the one key to show. */
export const healthKey = (health: "on_track" | "at_risk" | "off_track", tooEarly?: boolean): HealthKey => (tooEarly ? "too_early" : health);

export function HealthMark({ health, size = 14, label }: { health: HealthKey; size?: number; label?: string }) {
  const style: CSSProperties = { color: TONE[health], flex: "none", display: "block" };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {health === "on_track" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : health === "at_risk" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
        </>
      ) : health === "off_track" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.6 5.6 4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--v3-surface, #fff)" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
      )}
    </svg>
  );
}

/** The mark and its word, as a quiet pill. */
export function HealthPill({ health, className }: { health: HealthKey; className?: string }) {
  return (
    <span className={[styles.pill, className].filter(Boolean).join(" ")} data-health={health}>
      <HealthMark health={health} size={13} />
      {HEALTH_WORDS[health]}
    </span>
  );
}
