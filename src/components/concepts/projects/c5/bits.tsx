import type { CSSProperties } from "react";
import { initials, person, type Project } from "./data";
import s from "./shell.module.css";

export function hueVar(hue: number): string {
  return `var(--v3-project-${((hue - 1) % 8) + 1})`;
}

/** Carries a project's identity colour to everything beneath it. */
export function hueStyle(p: Pick<Project, "hue">): CSSProperties {
  return { ["--hue" as string]: hueVar(p.hue) } as CSSProperties;
}

export function Avatar({ id, size = 24, ring }: { id: string; size?: number; ring?: boolean }) {
  const who = person(id);
  return (
    <span
      className={s.avatar}
      data-ring={ring ? "" : undefined}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)), background: hueVar(who.hue) }}
      aria-hidden="true"
    >
      {initials(who.name)}
    </span>
  );
}

/**
 * How much is done, as a solid wedge filled clockwise in the project hue.
 * A filled slice reads as a quantity; a thin arc reads as "still loading".
 */
export function Pie({ value, size = 12 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(1, value));
  const c = size / 2;
  const r = c - 1.5;
  const a = v * 2 * Math.PI;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={s.pie} aria-hidden="true">
      <circle cx={c} cy={c} r={c - 0.5} className={s.pieTrack} />
      {v >= 1 ? (
        <circle cx={c} cy={c} r={r} className={s.pieValue} />
      ) : v > 0 ? (
        <path d={`M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${v > 0.5 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`} className={s.pieValue} />
      ) : null}
    </svg>
  );
}

/** The project's mark: a monogram on its identity colour. */
export function Glyph({ p, size }: { p: Project; size: number }) {
  return (
    <span className={s.glyph} style={{ ...hueStyle(p), width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(p.name)}
    </span>
  );
}
