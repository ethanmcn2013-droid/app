import { SIGNAL_INDIGO, SIGNAL_INK, suiteMarkMetrics } from "@/lib/brand/suite-mark";
import styles from "./floating-chat.module.css";

/**
 * Ping's tile: the suite mark (indigo ring and dot) on the ink tile, the one
 * saturated object in the chat. Circles are people, rounded squares are
 * things, and the ring and dot is Signal.
 */
export function PingTile({ size = 32, working = false }: { size?: number; working?: boolean }) {
  const { stroke, ring, dot } = suiteMarkMetrics(size, true);
  const c = size / 2;
  return <span aria-hidden="true" className={styles.mark} style={{ width: size, height: size, borderRadius: size * 0.28, background: SIGNAL_INK }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={ring} fill="none" stroke={SIGNAL_INDIGO} strokeWidth={stroke} />
      <circle className={working ? styles.markDotWorking : undefined} cx={c} cy={c} r={dot} fill={SIGNAL_INDIGO} />
    </svg>
  </span>;
}

/** Saved notes: a private place, so a thing (rounded square) with a bookmark. */
export function NoteTile({ size = 32 }: { size?: number }) {
  return <span aria-hidden="true" className={`${styles.mark} ${styles.noteTile}`} style={{ width: size, height: size, borderRadius: size * 0.28 }}>
    <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M4.75 2.75h6.5v10.5L8 10.75l-3.25 2.5Z" /></svg>
  </span>;
}
