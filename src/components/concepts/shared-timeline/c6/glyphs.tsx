/* Small drawn marks shared by both maps, the board and the key. */

import type { StopState } from "./data";
import s from "./c6.module.css";

export const cssVar = (token: string) => `var(${token.replace("--v3-project-", "--c6-project-")})`;

/** A stop on one line. Done stops are filled with a tick; the next stop
    carries a soft halo in its line colour. */
export function StopDot({ x, y, state, color, r = 7.5, focus }: { x: number; y: number; state: StopState; color: string; r?: number; focus?: boolean }) {
  return (
    <g className={s.stopDot}>
      {state === "next" ? <circle cx={x} cy={y} r={r + 7} className={s.halo} style={{ stroke: cssVar(color) }} /> : null}
      {focus ? <circle cx={x} cy={y} r={r + 5} className={s.focusRing} /> : null}
      <circle
        cx={x}
        cy={y}
        r={state === "next" ? r + 1 : r}
        className={state === "done" ? s.dotDone : s.dotOpen}
      />
      {state === "done" ? <path d={`M${x - r * 0.42} ${y + 0.2} l${r * 0.3} ${r * 0.3} l${r * 0.56} -${r * 0.62}`} className={s.tick} /> : null}
    </g>
  );
}

/** An interchange: one stop on two or more lines, drawn as a linked pill. */
export function StopPill({
  x1,
  y1,
  x2,
  y2,
  state,
  focus,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: StopState;
  focus?: boolean;
}) {
  const pad = 8.5;
  const rx = Math.min(x1, x2) - pad;
  const ry = Math.min(y1, y2) - pad;
  const w = Math.abs(x2 - x1) + pad * 2;
  const h = Math.abs(y2 - y1) + pad * 2;
  return (
    <g className={s.stopDot}>
      {state === "next" ? <rect x={rx - 6} y={ry - 6} width={w + 12} height={h + 12} rx={pad + 6} className={s.haloPill} /> : null}
      {focus ? <rect x={rx - 5} y={ry - 5} width={w + 10} height={h + 10} rx={pad + 5} className={s.focusRing} /> : null}
      <rect x={rx} y={ry} width={w} height={h} rx={pad} className={state === "done" ? s.dotDone : s.dotOpen} />
      {state === "done"
        ? [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ].map((p, i) => <path key={i} d={`M${p.x - 3.2} ${p.y + 0.2} l2.3 2.3 l4.2 -4.6`} className={s.tick} />)
        : null}
    </g>
  );
}

/** A train, drawn nose first. Rotated for the phone map. */
export function TrainShape({ color, vertical = false }: { color: string; vertical?: boolean }) {
  return (
    <g transform={vertical ? "rotate(90)" : undefined}>
      <path d="M-15 -6.5 h20 a10 6.5 0 0 1 0 13 h-20 a2.5 2.5 0 0 1 -2.5 -2.5 v-8 a2.5 2.5 0 0 1 2.5 -2.5 z" className={s.trainBody} />
      <rect x={-13} y={-3.2} width={4.2} height={3.4} rx={1} className={s.trainWin} />
      <rect x={-7.4} y={-3.2} width={4.2} height={3.4} rx={1} className={s.trainWin} />
      <rect x={-1.8} y={-3.2} width={4.2} height={3.4} rx={1} className={s.trainWin} />
      <path d="M6 -3.4 h2.4 a5 3.2 0 0 1 3.6 3.4 h-6 z" className={s.trainWin} />
      <rect x={-15} y={3.4} width={27} height={1.6} rx={0.8} style={{ fill: cssVar(color) }} />
    </g>
  );
}

/** A short run of track, used as the colour key for a line. */
export function LineSwatch({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <svg className={s.swatch} width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" style={{ opacity: dim ? 0.4 : 1 }}>
      <line x1="2" y1="5" x2="26" y2="5" strokeWidth="6" strokeLinecap="round" style={{ stroke: cssVar(color) }} />
    </svg>
  );
}

/** Small round colour chips, one per line a stop sits on. */
export function Chips({ colors }: { colors: string[] }) {
  return (
    <span className={s.chips} aria-hidden="true">
      {colors.map((c, i) => (
        <span key={i} className={s.chip} style={{ background: cssVar(c) }} />
      ))}
    </span>
  );
}

/** The Signal Studio credit mark: a line running into a stop. */
export function StudioMark() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" className={s.studioMark}>
      <line x1="1.5" y1="5" x2="12" y2="5" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="13" cy="5" r="3.2" strokeWidth="1.8" />
    </svg>
  );
}
