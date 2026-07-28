/**
 * The Signal Studio QR mark.
 *
 * Drawn as SVG from the committed matrix in qr-matrix.generated.ts, so it
 * inherits the surface ink colour (`currentColor`) and costs no image request.
 *
 * Three deliberate departures from a stock QR, all inside the 30% headroom of
 * error-correction level H:
 *   - modules are rounded, not square
 *   - the three finder eyes are drawn as rounded rings
 *   - the centre carries the indigo dot, the company mark
 *
 * Set --qr-surface on an ancestor when the card is not paper, so the centre
 * badge punches the right colour.
 */

import { QR_ROWS, QR_SIZE } from "./qr-matrix.generated";

/** Quiet zone, in modules. Four is the spec floor; two plus card padding reads cleaner. */
const QUIET = 2;
const SPAN = QR_SIZE + QUIET * 2;

/** Centre of the matrix, in module coordinates. */
const CENTRE = (QR_SIZE - 1) / 2;

/** Modules cleared either side of centre to seat the dot badge. */
const BADGE_CLEAR = 2;

function isFinder(row: number, col: number): boolean {
  const n = QR_SIZE;
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= n - 7) ||
    (row >= n - 7 && col < 7)
  );
}

function isBadge(row: number, col: number): boolean {
  return (
    Math.abs(row - CENTRE) <= BADGE_CLEAR &&
    Math.abs(col - CENTRE) <= BADGE_CLEAR
  );
}

function FinderEye({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Corner radii stay under 1 module. Anything rounder cuts the corner
          module out of the ring, and the finder pattern is the one thing a
          decoder cannot recover from error correction. */}
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={6}
        height={6}
        rx={0.9}
        ry={0.9}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
      <rect
        x={x + 2}
        y={y + 2}
        width={3}
        height={3}
        rx={0.75}
        ry={0.75}
        fill="currentColor"
      />
    </g>
  );
}

export function SignalQr({
  size = 104,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const modules: React.ReactElement[] = [];

  for (let row = 0; row < QR_SIZE; row += 1) {
    const line = QR_ROWS[row];
    for (let col = 0; col < QR_SIZE; col += 1) {
      if (line[col] !== "1") continue;
      if (isFinder(row, col) || isBadge(row, col)) continue;
      modules.push(
        <rect
          key={`${row}-${col}`}
          x={col + 0.06}
          y={row + 0.06}
          width={0.88}
          height={0.88}
          rx={0.3}
          ry={0.3}
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SPAN} ${SPAN}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="QR code for the Signal Studio iPhone app page"
      shapeRendering="geometricPrecision"
    >
      <g transform={`translate(${QUIET} ${QUIET})`} fill="currentColor">
        {modules}
        <FinderEye x={0} y={0} />
        <FinderEye x={QR_SIZE - 7} y={0} />
        <FinderEye x={0} y={QR_SIZE - 7} />
        {/* The badge stays inside the cleared square: BADGE_CLEAR modules
            either side of centre is a half-width of 2.5, so 2.5 is the
            ceiling on this radius. Past it the circle starts covering
            modules that were never cleared. */}
        <circle
          cx={CENTRE + 0.5}
          cy={CENTRE + 0.5}
          r={2.5}
          fill="var(--qr-surface, var(--paper))"
        />
        <circle
          cx={CENTRE + 0.5}
          cy={CENTRE + 0.5}
          r={1.05}
          fill="var(--accent)"
        />
      </g>
    </svg>
  );
}
