import { CRITICAL, LINE_STOPS, LINES, TODAY, day, type LabelPlace, type LineId, type Station } from "./data";

/**
 * Pixel layout for the route map. Everything is computed at the map's real
 * width so labels render at true size and never scale with the SVG.
 *
 * The x axis is time, schematic like any transit map: near dates get more
 * room (the past fortnight and the coming month), September is compressed.
 * Lines run flat, then bend at 45 degrees into the terminus.
 */

export const LANE_TOP = 112;
export const LANE_GAP = 98;
export const TERM_GAP = 58;
export const GUTTER = 144;
export const LINE_START = 146;
const PLOT_PAD = 18;
const MIN_STOP_GAP = 52;
/** How far the scale leans towards even spacing between dated stops (0 is pure time). */
const EVENNESS = 0.62;

export const MAP_START = day(6, 22);
export const PLOT_END_DAY = day(10, 2);

export type Seg = {
  key: string;
  line: LineId;
  from: string | null;
  to: string | null;
  d: string;
  critical: boolean;
  /** Straight run for dash/label placement: from x to x at y. */
  x1: number;
  x2: number;
  y: number;
};

export type Geo = {
  W: number;
  H: number;
  plotX0: number;
  plotX1: number;
  termX: number;
  termTop: number;
  termBottom: number;
  laneY: (i: number) => number;
  /** Where lane i enters the terminus. */
  termY: (i: number) => number;
  x: (d: number) => number;
  pos: Record<string, Record<string, { x: number; y: number }>>;
  stationXY: (id: string, line?: LineId) => { x: number; y: number };
  segs: Seg[];
  paths: Record<LineId, string>;
  along: (line: LineId, p: number) => { x: number; y: number };
  months: Array<{ label: string; x: number; x2: number }>;
  /** Monday ticks along the axis, so the compression of later weeks shows. */
  weeks: number[];
};

export function layout(W: number, stations: Record<string, Station>): Geo {
  const laneY = (i: number) => LANE_TOP + i * LANE_GAP;
  const centerY = laneY(2);
  const termY = (i: number) => centerY + (i - 2) * TERM_GAP;
  const maxDy = 2 * (LANE_GAP - TERM_GAP);
  const plotX0 = GUTTER + PLOT_PAD;
  const plotX1 = Math.max(plotX0 + 360, W - 36 - 22 - maxDy - 22);
  const termX = plotX1 + 22 + maxDy + 22;
  const H = laneY(4) + 56;

  // Schematic time: a blend of true time and even spacing between the dated
  // stops, so a busy July gets room and a quiet stretch does not waste it.
  const knots = [...new Set([MAP_START, PLOT_END_DAY, TODAY, ...Object.values(stations).map((s) => s.date)])].sort((a, b) => a - b);
  const rankFrac = (d: number) => {
    for (let k = 1; k < knots.length; k++) {
      if (d <= knots[k]) return (k - 1 + (d - knots[k - 1]) / (knots[k] - knots[k - 1])) / (knots.length - 1);
    }
    return 1;
  };
  const x = (d: number) => {
    if (d <= MAP_START) return plotX0;
    if (d > PLOT_END_DAY) return d <= day(10, 3) ? termX : termX + 30;
    const f = EVENNESS * rankFrac(d) + (1 - EVENNESS) * ((d - MAP_START) / (PLOT_END_DAY - MAP_START));
    return plotX0 + f * (plotX1 - plotX0);
  };

  const pos: Geo["pos"] = {};
  const segs: Seg[] = [];
  const paths = {} as Record<LineId, string>;
  const critical = new Set(CRITICAL.map(([l, f]) => `${l}:${f}`));

  LINES.forEach((line, i) => {
    const y = laneY(i);
    const ids = LINE_STOPS[line.id].filter((id) => stations[id]);
    const xs = ids.map((id) => x(stations[id].date));
    // Keep neighbouring stops apart without moving shared stops.
    for (let k = xs.length - 2; k >= 0; k--) {
      if (stations[ids[k]].lines.length > 1) continue;
      xs[k] = Math.min(xs[k], xs[k + 1] - MIN_STOP_GAP);
    }
    pos[line.id] = {};
    ids.forEach((id, k) => (pos[line.id][id] = { x: xs[k], y }));

    const dy = termY(i) - y;
    const diagEndX = termX - 22;
    const bendX = diagEndX - Math.abs(dy);
    const tail = `L ${bendX} ${y} L ${diagEndX} ${y + dy} L ${termX} ${y + dy}`;
    paths[line.id] = `M ${LINE_START} ${y} ${tail}`;

    const pts: Array<{ id: string | null; x: number }> = [{ id: null, x: LINE_START }, ...ids.map((id, k) => ({ id, x: xs[k] }))];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const isCritical = a.id ? critical.has(`${line.id}:${a.id}`) : false;
      if (b) {
        segs.push({ key: `${line.id}:${a.id ?? "start"}`, line: line.id, from: a.id, to: b.id, d: `M ${a.x} ${y} L ${b.x} ${y}`, critical: isCritical, x1: a.x, x2: b.x, y });
      } else {
        segs.push({ key: `${line.id}:${a.id ?? "start"}`, line: line.id, from: a.id, to: null, d: `M ${a.x} ${y} ${tail}`, critical: isCritical, x1: a.x, x2: bendX, y });
      }
    }
  });

  const stationXY = (id: string, line?: LineId) => {
    if (line && pos[line]?.[id]) return pos[line][id];
    for (const l of LINES) if (pos[l.id]?.[id]) return pos[l.id][id];
    return { x: 0, y: 0 };
  };

  const along = (line: LineId, p: number) => {
    const i = LINES.findIndex((l) => l.id === line);
    const y = laneY(i);
    const ids = LINE_STOPS[line].filter((id) => stations[id]);
    const xs = ids.map((id) => pos[line][id].x);
    if (!xs.length) return { x: LINE_START, y };
    const pts = [LINE_START, ...xs];
    const q = Math.max(-1, Math.min(p, xs.length - 1));
    const k = Math.floor(q + 1);
    const t = q + 1 - k;
    const a = pts[Math.min(k, pts.length - 1)];
    const b = pts[Math.min(k + 1, pts.length - 1)];
    return { x: a + (b - a) * t, y };
  };

  const months: Geo["months"] = [];
  const edges = [day(6, 22), day(7, 1), day(8, 1), day(9, 1), day(10, 1), day(10, 3)];
  // October is only the terminus, which carries its own date.
  const names = ["", "July", "August", "September", ""];
  for (let k = 1; k < edges.length - 1; k++) {
    months.push({ label: names[k], x: x(edges[k]), x2: k + 1 < edges.length - 1 ? x(edges[k + 1]) : termX });
  }
  const weeks: number[] = [];
  // 22 Jun 2026 is a Monday.
  for (let d = MAP_START + 7; d < PLOT_END_DAY; d += 7) weeks.push(x(d));

  return {
    W,
    H,
    plotX0,
    plotX1,
    termX,
    termTop: termY(0) - 18,
    termBottom: termY(4) + 18,
    laneY,
    termY,
    x,
    pos,
    stationXY,
    segs,
    paths,
    along,
    months,
    weeks,
  };
}

/* ── Stop labels ──────────────────────────────────────────────────── */

export type LabelIn = {
  id: string;
  x: number;
  /** Lane index the label uses when above, and when below (differs for shared stops). */
  laneAbove: number;
  laneBelow: number;
  name: string;
  short?: string;
  meta: string;
  pref: LabelPlace;
  /** Held, late and due-today stops keep their chosen place first. */
  priority: boolean;
};

export type LabelOut = LabelPlace & { useShort: boolean };

const NAME_CH = 6.9;
const META_CH = 6.1;
const PAD = 12;
const GAP = 10;

export function labelWidth(name: string, meta: string) {
  return Math.max(name.length * NAME_CH, meta.length * META_CH) + PAD;
}

function extent(x: number, w: number, align: LabelPlace["align"]): [number, number] {
  if (align === "start") return [x - 7, x - 7 + w];
  if (align === "end") return [x + 7 - w, x + 7];
  return [x - w / 2, x + w / 2];
}

/**
 * Collision pass for stop labels. Each lane has a band above and below the
 * line; labels in the same band must not overlap. Try the preferred place,
 * then other alignments, then the other side, then the short name.
 */
export function placeLabels(items: LabelIn[], minX: number, maxX: number): Record<string, LabelOut> {
  const taken = new Map<string, Array<[number, number]>>();
  const out: Record<string, LabelOut> = {};
  const order = [...items].sort((a, b) => Number(b.priority) - Number(a.priority) || a.x - b.x);
  const aligns: LabelPlace["align"][] = ["start", "middle", "end"];

  for (const it of order) {
    const sides: LabelPlace["side"][] = [it.pref.side, it.pref.side === "above" ? "below" : "above"];
    const names: Array<[string, boolean]> = [[it.name, false]];
    if (it.short && it.short !== it.name) names.push([it.short, true]);
    let chosen: (LabelOut & { band: string; ext: [number, number] }) | null = null;

    search: for (const [text, useShort] of names) {
      const w = labelWidth(text, it.meta);
      for (const side of sides) {
        const band = side === "above" ? `${it.laneAbove}a` : `${it.laneBelow}b`;
        const list = taken.get(band) ?? [];
        for (const align of [it.pref.align, ...aligns.filter((a) => a !== it.pref.align)]) {
          const ext = extent(it.x, w, align);
          if (ext[0] < minX || ext[1] > maxX) continue;
          if (list.some(([a, b]) => ext[0] < b + GAP && ext[1] > a - GAP)) continue;
          chosen = { side, align, useShort, band, ext };
          break search;
        }
      }
    }
    if (!chosen) {
      const text = it.short ?? it.name;
      const w = labelWidth(text, it.meta);
      const band = it.pref.side === "above" ? `${it.laneAbove}a` : `${it.laneBelow}b`;
      chosen = { ...it.pref, useShort: Boolean(it.short), band, ext: extent(it.x, w, it.pref.align) };
    }
    const list = taken.get(chosen.band) ?? [];
    list.push(chosen.ext);
    taken.set(chosen.band, list);
    out[it.id] = { side: chosen.side, align: chosen.align, useShort: chosen.useShort };
  }
  return out;
}

/* ── Network (all projects) ───────────────────────────────────────── */

export const NET_START = day(6, 22);
export const NET_END = day(11, 8);

export function netLayout(W: number) {
  const x0 = 180;
  const x1 = W - 170;
  const x = (d: number) => x0 + ((d - NET_START) / (NET_END - NET_START)) * (x1 - x0);
  const laneY = (i: number) => 116 + i * 84;
  const H = laneY(4) + 64;
  const months: Array<{ label: string; x: number }> = [
    { label: "July", x: x(day(7, 1)) },
    { label: "August", x: x(day(8, 1)) },
    { label: "September", x: x(day(9, 1)) },
    { label: "October", x: x(day(10, 1)) },
    { label: "November", x: x(day(11, 1)) },
  ];
  return { W, H, x0, x1, x, laneY, months };
}
