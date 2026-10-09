import type { ReactNode, SVGProps } from "react";
import type { Priority, StageKey } from "./data";
import styles from "./board.module.css";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
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
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  board: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="2.75" width="4.25" height="10.5" rx="1.2" /><rect x="9.25" y="2.75" width="4.25" height="6.5" rx="1.2" /></Svg>
  ),
  list: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><circle cx="2.75" cy="4" r=".6" fill="currentColor" /><circle cx="2.75" cy="8" r=".6" fill="currentColor" /><circle cx="2.75" cy="12" r=".6" fill="currentColor" /></Svg>
  ),
  calendar: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" /><path d="M2.25 6.5h11.5M5.5 2v2.5M10.5 2v2.5" /></Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>
  ),
  plus: (p: IconProps) => (
    <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}><path d="m3.5 8.5 3 3 6-7" /></Svg>
  ),
  chevronDown: (p: IconProps) => (
    <Svg {...p}><path d="m4.5 6.25 3.5 3.5 3.5-3.5" /></Svg>
  ),
  chevronRight: (p: IconProps) => (
    <Svg {...p}><path d="m6.25 4.5 3.5 3.5-3.5 3.5" /></Svg>
  ),
  chevronLeft: (p: IconProps) => (
    <Svg {...p}><path d="M9.75 4.5 6.25 8l3.5 3.5" /></Svg>
  ),
  comment: (p: IconProps) => (
    <Svg {...p}><path d="M3 4.25c0-.83.67-1.5 1.5-1.5h7c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H7l-2.75 2.5v-2.5h0c-.69 0-1.25-.56-1.25-1.25Z" /></Svg>
  ),
  clock: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M8 5v3.2l2 1.3" /></Svg>
  ),
  group: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></Svg>
  ),
  arrows: (p: IconProps) => (
    <Svg {...p}><path d="M3 8h10M10.5 5.5 13 8l-2.5 2.5M5.5 5.5 3 8l2.5 2.5" /></Svg>
  ),
  sparkle: (p: IconProps) => (
    <Svg {...p}><path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.4 4.4l1.4 1.4M10.2 10.2l1.4 1.4M11.6 4.4l-1.4 1.4M5.8 10.2l-1.4 1.4" /></Svg>
  ),
  expand: (p: IconProps) => (
    <Svg {...p}><path d="M9.5 3h3.5v3.5M13 3 9 7M6.5 13H3V9.5M3 13l4-4" /></Svg>
  ),
  collapse: (p: IconProps) => (
    <Svg {...p}><path d="M3 6.5h3.5V3M6.5 6.5 2.5 2.5M13 9.5H9.5V13M9.5 9.5l4 4" /></Svg>
  ),
  hand: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 8V3.75a1 1 0 0 1 2 0V7.5m0-.5V3a1 1 0 0 1 2 0v4.5m0-3a1 1 0 0 1 2 0v4.25c0 2.62-1.63 4.75-4.25 4.75-1.6 0-2.6-.7-3.5-2L2.5 8.9a1 1 0 0 1 1.6-1.2L5.5 9.5" /></Svg>
  ),
  undo: (p: IconProps) => (
    <Svg {...p}><path d="M5 4 2.5 6.5 5 9" /><path d="M2.5 6.5h7a3.5 3.5 0 0 1 0 7H7" /></Svg>
  ),
};

/* ── Status glyphs: the same vocabulary as My tasks ───────────────── */

export const STAGE_TONE: Record<StageKey, string> = {
  todo: "var(--v3-control-border)",
  doing: "var(--v3-warning-stroke)",
  review: "var(--v3-review)",
  waiting: "var(--v3-text-2)",
  done: "var(--v3-success)",
};

export function StageGlyph({ stage, size = 16, draw = false }: { stage: StageKey; size?: number; draw?: boolean }) {
  const tone = STAGE_TONE[stage];
  return (
    <svg
      className={styles.glyph}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={{ color: tone }}
    >
      {stage === "done" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            className={draw ? styles.glyphTickDraw : undefined}
            d="M5 8.3 7.1 10.4 11 6"
            pathLength={1}
            fill="none"
            stroke="var(--v3-canvas)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth={1.5} />
          {stage === "doing" ? <path d="M8 3.25a4.75 4.75 0 0 1 0 9.5Z" fill="currentColor" /> : null}
          {stage === "review" ? <path d="M8 3.25a4.75 4.75 0 1 1-4.75 4.75H8Z" fill="currentColor" /> : null}
          {stage === "waiting" ? (
            <path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </>
      )}
    </svg>
  );
}

/** Three rising bars; the filled count is the priority. */
export function PriorityBars({ priority }: { priority: Priority }) {
  return (
    <svg className={styles.bars} data-p={priority} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx=".8" data-on={priority >= 1 ? "" : undefined} />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx=".8" data-on={priority >= 2 ? "" : undefined} />
      <rect x="10" y="2" width="2.5" height="10.5" rx=".8" data-on={priority >= 3 ? "" : undefined} />
    </svg>
  );
}
