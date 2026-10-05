import type { CSSProperties } from "react";
import { STAGE_BY_KEY, dayLabel, type Card, type Person } from "./data";
import { ORDER, ageLevel, staysOf } from "./model";
import { Icon } from "./icons";
import styles from "./flow.module.css";

export function Avatar({ person, size = 20 }: { person: Person | undefined; size?: number }) {
  if (!person) return null;
  const initials = person.first.slice(0, 1) + (person.full.split(" ")[1]?.slice(0, 1) ?? "");
  return (
    <span
      className={styles.avatar}
      style={{ "--tone": `var(--v3-project-${person.tone})`, width: size, height: size, fontSize: Math.round(size * 0.42) } as CSSProperties}
      title={person.full}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/**
 * A small gauge that fills over the stage's usual time. Full and amber at
 * 1x, full with a filled centre at 2x: ageing reads through form first.
 */
export function AgeRing({ age, usual, size = 18 }: { age: number; usual: number; size?: number }) {
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

/** Fourteen days of card count, latest point accented. */
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

/** The card's life as a strip of stages with days in each. */
export function Journey({ card, day, compact = false }: { card: Card; day: number; compact?: boolean }) {
  const stays = staysOf(card, day);
  return (
    <ol className={styles.journey} data-compact={compact || undefined} aria-label="Time in each stage">
      {stays.map((s, i) => {
        const days = (s.to ?? day) - s.from;
        const current = s.to === null;
        const back = i > 0 && stays[i - 1].stage !== "waiting" && s.stage !== "waiting" && ORDER[s.stage] < ORDER[stays[i - 1].stage];
        return (
          <li
            key={`${s.stage}-${s.from}-${i}`}
            className={styles.journeyStep}
            data-current={current || undefined}
            data-done={s.stage === "done" || undefined}
            style={{ flexGrow: Math.max(days, 0.7) }}
          >
            {back ? (
              <span className={styles.journeyBack} title="Sent back">
                <Icon.undo size={11} />
              </span>
            ) : null}
            <span className={styles.journeyBar} />
            <span className={styles.journeyName}>{STAGE_BY_KEY[s.stage].name}</span>
            <span className={styles.journeyDays}>
              {s.stage === "done" ? dayLabel(s.from) : days === 0 ? "under a day" : `${days}d`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BlockerLine({ who, since, day }: { who: string; since: number; day: number }) {
  const when = since === day ? "today" : `since ${dayLabel(since)}`;
  return (
    <p className={styles.blocker}>
      <Icon.hourglass size={13} />
      <span>
        Waiting on <strong>{who}</strong> {when}
      </span>
    </p>
  );
}
