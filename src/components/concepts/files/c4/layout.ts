/*
 * Masonry maths for the moodwall.
 *
 * Columns are assigned with a nominal column width per column count, so the
 * assignment never depends on the measured width. That lets the server render
 * the exact same wall with CSS (container units, see .fb in the stylesheet)
 * before JavaScript has measured anything, and the measured wall lands on
 * identical positions: no blank first frame and no reshuffle when it hydrates.
 */

export const COL_COUNTS = [2, 3, 4, 5] as const;
export type ColCount = (typeof COL_COUNTS)[number];

const NOMINAL: Record<ColCount, number> = { 2: 170, 3: 230, 4: 280, 5: 270 };

export function columnsFor(w: number): ColCount {
  if (w < 600) return 2;
  if (w < 880) return 3;
  if (w < 1500) return 4;
  return 5;
}

export const gapFor = (cols: ColCount) => (cols === 2 ? 8 : 12);

export type Slot = { c: number; r: number; n: number };

/** r = sum of ratios above the tile in its column, n = tiles above it. */
export function assign(list: { id: string; ratio: number }[], cols: ColCount) {
  const nom = NOMINAL[cols];
  const gap = gapFor(cols);
  const R = new Array<number>(cols).fill(0);
  const N = new Array<number>(cols).fill(0);
  const pos = new Map<string, Slot>();
  for (const a of list) {
    let c = 0;
    let best = Infinity;
    for (let i = 0; i < cols; i++) {
      const h = R[i] * nom + N[i] * gap;
      if (h < best - 0.5) {
        best = h;
        c = i;
      }
    }
    pos.set(a.id, { c, r: R[c], n: N[c] });
    R[c] += a.ratio;
    N[c] += 1;
  }
  return { pos, R, N };
}

/** Pixel positions for a measured wall. */
export function place(list: { id: string; ratio: number }[], width: number) {
  const cols = columnsFor(width);
  const gap = gapFor(cols);
  const colW = (width - gap * (cols - 1)) / cols;
  const { pos, R, N } = assign(list, cols);
  const px = new Map<string, { x: number; y: number; h: number }>();
  for (const a of list) {
    const p = pos.get(a.id)!;
    px.set(a.id, { x: p.c * (colW + gap), y: p.r * colW + p.n * gap, h: a.ratio * colW });
  }
  const height = Math.max(0, ...R.map((r, i) => r * colW + Math.max(0, N[i] - 1) * gap));
  return { px, height, colW };
}

/** CSS custom properties for the server-rendered wall, one set per column count. */
export function fallbackVars(list: { id: string; ratio: number }[]) {
  const tiles = new Map<string, Record<string, number>>();
  const wall: Record<string, number> = {};
  for (const cols of COL_COUNTS) {
    const { pos, R, N } = assign(list, cols);
    const nom = NOMINAL[cols];
    const gap = gapFor(cols);
    let tall = 0;
    R.forEach((r, i) => {
      if (r * nom + N[i] * gap > R[tall] * nom + N[tall] * gap) tall = i;
    });
    wall[`--R${cols}`] = R[tall] ?? 0;
    wall[`--N${cols}`] = Math.max(0, (N[tall] ?? 0) - 1);
    for (const a of list) {
      const p = pos.get(a.id)!;
      const t = tiles.get(a.id) ?? { "--h": a.ratio };
      t[`--c${cols}`] = p.c;
      t[`--r${cols}`] = p.r;
      t[`--n${cols}`] = p.n;
      tiles.set(a.id, t);
    }
  }
  return { tiles, wall };
}
