/* Deterministic layout for the map: every card, row, port and route on one grid.
   Desktop runs left to right (from, through Signal, to); phone runs top to bottom
   with the lines in a left-hand gutter like a transit strip map. */

import { APPS, DESTS, SOURCES, type Conn, type NodeDef } from "./data";
import { estimate, type Measure } from "./measure";

export type RowBox = { conn: string; y: number; h: number; portY: number };
export type CardBox = {
  id: string;
  node: NodeDef;
  x: number;
  y: number;
  w: number;
  h: number;
  ghost: boolean;
  rows: RowBox[];
  /** Where a new line can be drawn from (the header port). */
  handle: { x: number; y: number } | null;
  /** App cards: port positions per connection id. */
  ports: Record<string, { x: number; y: number }>;
};

export type Seg = { x1: number; y1: number; x2: number; y2: number; len: number };
export type Route = { id: string; d: string; len: number; segs: Seg[] };

export type MapLayout = {
  width: number;
  height: number;
  cards: CardBox[];
  routes: Record<string, Route>;
  cols: { src: [number, number]; app: [number, number]; dest: [number, number] };
};

/* ── metrics ─────────────────────────────────────────────────────────── */

export const HEAD = 48;
export const ROW = 32;
const NOTE_LINE = 16;
const PAD_B = 8;
const GAP = 10;
const GHOST_H = 82;
const APP_MIN = 72;
const PORT_GAP = 14;

let measure: Measure = estimate;
/** Set by the maps before laying out: the real text measure once the page is live. */
export function setMeasure(m: Measure) {
  measure = m;
}

function lines(text: string, px: number, avail: number, max: number) {
  if (measure(text, px) <= avail) return 1;
  // Greedy word wrap, so a long word never undercounts.
  let n = 1;
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, px) > avail && line) {
      n++;
      line = word;
    } else line = next;
  }
  return Math.min(max, n);
}

export function noteLines(text: string | undefined, width: number) {
  if (!text) return 0;
  return lines(text, 12, width - 62, 3);
}

/** One or two lines for a row's label. */
export function labelLines(c: Conn, width: number) {
  // Row and button padding, the swatch and its gap, and the count when there is one.
  const avail = c.status === "live" ? width - 71 : width - 44;
  return lines(c.label, 12.5, avail, 2);
}

export function labelHeight(c: Conn, width: number) {
  return labelLines(c, width) === 1 ? ROW : ROW + NOTE_LINE;
}

export function rowHeight(c: Conn, width: number) {
  const note = rowNote(c);
  return labelHeight(c, width) + (note ? noteLines(note, width) * NOTE_LINE - 1 : 0);
}

/** The short status line under a row, in plain words. Never colour alone. */
export function rowNote(c: Conn): string | undefined {
  if (c.status === "broken") return "Stopped on 23 September";
  if (c.status === "waiting") return c.note ?? "Waiting for you to allow access";
  if (c.status === "paused") return c.by ? `Paused by ${c.by}` : "Paused";
  return undefined;
}

/* ── routes ──────────────────────────────────────────────────────────── */

const n1 = (v: number) => Math.round(v * 10) / 10;

/** An orthogonal route with rounded corners: out, along a lane, and in. Always the
    same command structure, so a moving route interpolates cleanly. */
export function orthRoute(id: string, x1: number, y1: number, x2: number, y2: number, xl: number, maxR = 10): Route {
  const dy = y2 - y1;
  const s = dy >= 0 ? 1 : -1;
  const dirIn = xl >= x1 ? 1 : -1; // horizontal direction out of the start
  const dirOut = x2 >= xl ? 1 : -1;
  const r = Math.max(0, Math.min(maxR, Math.abs(dy) / 2, Math.abs(xl - x1) - 1, Math.abs(x2 - xl) - 1));
  const d =
    `M ${n1(x1)} ${n1(y1)} H ${n1(xl - dirIn * r)} Q ${n1(xl)} ${n1(y1)} ${n1(xl)} ${n1(y1 + s * r)} ` +
    `V ${n1(y2 - s * r)} Q ${n1(xl)} ${n1(y2)} ${n1(xl + dirOut * r)} ${n1(y2)} H ${n1(x2)}`;
  const segs: Seg[] = [
    { x1, y1, x2: xl, y2: y1, len: Math.abs(xl - x1) },
    { x1: xl, y1, x2: xl, y2, len: Math.abs(dy) },
    { x1: xl, y1: y2, x2, y2, len: Math.abs(x2 - xl) },
  ];
  const corner = r * (Math.PI / 2 - 2);
  const len = segs.reduce((a, g) => a + g.len, 0) + 2 * corner;
  return { id, d, len: Math.max(1, len), segs };
}

export function pointAt(route: Route, t: number) {
  const total = route.segs.reduce((a, g) => a + g.len, 0);
  let left = Math.max(0, Math.min(1, t)) * total;
  for (const g of route.segs) {
    if (left <= g.len || g === route.segs[route.segs.length - 1]) {
      const k = g.len === 0 ? 0 : left / g.len;
      return { x: g.x1 + (g.x2 - g.x1) * k, y: g.y1 + (g.y2 - g.y1) * k };
    }
    left -= g.len;
  }
  return { x: route.segs[0].x1, y: route.segs[0].y1 };
}

/** Spread lanes through a channel so that lines rarely cross: lines heading down
    take the lanes nearest their start in reverse order, lines heading up the rest. */
function assignLanes(lines: { id: string; y1: number; y2: number }[], a: number, b: number) {
  const out: Record<string, number> = {};
  const mid = (a + b) / 2;
  const bent = lines.filter((l) => Math.abs(l.y2 - l.y1) > 2);
  for (const l of lines) if (!bent.includes(l)) out[l.id] = mid;
  const down = bent.filter((l) => l.y2 > l.y1).sort((p, q) => q.y1 - p.y1 || q.y2 - p.y2);
  const up = bent.filter((l) => l.y2 < l.y1).sort((p, q) => p.y1 - q.y1 || p.y2 - q.y2);
  const order = [...down, ...up];
  const n = order.length;
  if (n === 0) return out;
  const room = b - a - 36;
  const sp = n > 1 ? Math.min(13, room / (n - 1)) : 0;
  const start = mid - ((n - 1) * sp) / 2;
  order.forEach((l, i) => (out[l.id] = start + i * sp));
  return out;
}

/* ── desktop ─────────────────────────────────────────────────────────── */

type Opts = { empty: boolean };

function isConnected(id: string, conns: Conn[]) {
  return conns.some((c) => c.from === id || c.to === id);
}

function stackColumn(nodes: NodeDef[], conns: Conn[], x: number, w: number, side: "source" | "dest", opts: Opts) {
  const cards: CardBox[] = [];
  const ordered = [...nodes.filter((n) => !opts.empty && isConnected(n.id, conns)), ...nodes.filter((n) => opts.empty || !isConnected(n.id, conns))];
  let y = 0;
  for (const node of ordered) {
    const mine = opts.empty ? [] : conns.filter((c) => (side === "source" ? c.from : c.to) === node.id);
    const ghost = mine.length === 0;
    const rows: RowBox[] = [];
    let h: number;
    if (ghost) {
      h = opts.empty ? 56 : GHOST_H;
    } else {
      let ry = y + HEAD;
      for (const c of mine) {
        const rh = rowHeight(c, w);
        rows.push({ conn: c.id, y: ry, h: rh, portY: ry + labelHeight(c, w) / 2 });
        ry += rh;
      }
      h = ry - y + PAD_B;
    }
    const hx = side === "source" ? x + w : x;
    cards.push({ id: node.id, node, x, y, w, h, ghost, rows, handle: node.later ? null : { x: hx, y: y + 24 }, ports: {} });
    y += h + GAP;
  }
  return { cards, bottom: y - GAP };
}

export function layoutDesktop(W: number, conns: Conn[], opts: Opts): MapLayout {
  const width = Math.max(640, W);
  const appW = width >= 760 ? 160 : 146;
  const ch = Math.round(Math.max(80, Math.min(120, width * 0.125)));
  const sideW = Math.floor((width - appW - 2 * ch) / 2);
  const srcX = 0;
  const appX = sideW + ch;
  const destX = appX + appW + ch;

  const inConns = conns.filter((c) => SOURCES.some((s) => s.id === c.from));
  const outConns = conns.filter((c) => DESTS.some((d) => d.id === c.to));

  const src = stackColumn(SOURCES, inConns, srcX, sideW, "source", opts);
  const dst = stackColumn(DESTS, outConns, destX, sideW, "dest", opts);
  const portOf = (cards: CardBox[], connId: string) => {
    for (const c of cards) for (const r of c.rows) if (r.conn === connId) return r.portY;
    return 0;
  };

  // Apps sit near the lines they meet, in a stable order.
  const colH = Math.max(src.bottom, dst.bottom);
  const appCards: CardBox[] = [];
  const wants = APPS.map((node, i) => {
    const ins = opts.empty ? [] : inConns.filter((c) => c.to === node.id);
    const outs = opts.empty ? [] : outConns.filter((c) => c.from === node.id);
    const ys = [...ins.map((c) => portOf(src.cards, c.id)), ...outs.map((c) => portOf(dst.cards, c.id))];
    const h = Math.max(APP_MIN, 24 + Math.max(ins.length, outs.length) * PORT_GAP + 16);
    const even = ((i + 0.5) / APPS.length) * colH;
    const bary = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : even;
    const want = bary * 0.55 + even * 0.45;
    return { node, i, ins, outs, h, want };
  });
  wants.sort((a, b) => a.want - b.want || a.i - b.i);
  let cursor = 0;
  const placed = wants.map((w) => {
    const y = Math.max(cursor, w.want - w.h / 2);
    cursor = y + w.h + 22;
    return { ...w, y };
  });
  const overflow = cursor - 22 - Math.max(colH, 0);
  if (overflow > 0) {
    // Pull the column back up, keeping the gaps.
    let limit = Math.max(colH, cursor - 22 - overflow);
    for (let i = placed.length - 1; i >= 0; i--) {
      const p = placed[i];
      p.y = Math.min(p.y, limit - p.h);
      limit = p.y - 22;
    }
    if (placed[0].y < 0) {
      let y = 0;
      for (const p of placed) {
        p.y = Math.max(p.y, y);
        y = p.y + p.h + 22;
      }
    }
  }

  const routes: Record<string, Route> = {};
  const leftLines: { id: string; y1: number; y2: number; x1: number; x2: number }[] = [];
  const rightLines: { id: string; y1: number; y2: number; x1: number; x2: number }[] = [];

  for (const p of placed) {
    const card: CardBox = { id: p.node.id, node: p.node, x: appX, y: p.y, w: appW, h: p.h, ghost: false, rows: [], handle: { x: appX + appW, y: p.y + 17 }, ports: {} };
    const cy = p.y + p.h / 2 + 6;
    const ins = [...p.ins].sort((a, b) => portOf(src.cards, a.id) - portOf(src.cards, b.id));
    ins.forEach((c, i) => {
      const y = cy - ((ins.length - 1) * PORT_GAP) / 2 + i * PORT_GAP;
      card.ports[c.id] = { x: appX, y };
      leftLines.push({ id: c.id, x1: srcX + sideW, y1: portOf(src.cards, c.id), x2: appX, y2: y });
    });
    const outs = [...p.outs].sort((a, b) => portOf(dst.cards, a.id) - portOf(dst.cards, b.id));
    outs.forEach((c, i) => {
      const y = cy - ((outs.length - 1) * PORT_GAP) / 2 + i * PORT_GAP;
      card.ports[c.id] = { x: appX + appW, y };
      rightLines.push({ id: c.id, x1: appX + appW, y1: y, x2: destX, y2: portOf(dst.cards, c.id) });
    });
    appCards.push(card);
  }
  appCards.sort((a, b) => a.y - b.y);

  const leftLanes = assignLanes(leftLines, srcX + sideW, appX);
  for (const l of leftLines) routes[l.id] = orthRoute(l.id, l.x1, l.y1, l.x2, l.y2, leftLanes[l.id]);
  // Outgoing lines mirror the rule: sort by the app end, which is their start.
  const rightLanes = assignLanes(rightLines, appX + appW, destX);
  for (const l of rightLines) routes[l.id] = orthRoute(l.id, l.x1, l.y1, l.x2, l.y2, rightLanes[l.id]);

  const height = Math.ceil(Math.max(colH, ...appCards.map((c) => c.y + c.h)) + 8);
  return {
    width,
    height,
    cards: [...src.cards, ...appCards, ...dst.cards],
    routes,
    cols: { src: [srcX, sideW], app: [appX, appW], dest: [destX, sideW] },
  };
}

/* ── phone: a vertical strip ─────────────────────────────────────────── */

export type StripSection = { id: "from" | "signal" | "to"; y: number };
export type StripLayout = MapLayout & { sections: StripSection[]; gutter: number };

const SECTION_H = 40;
const LANE = 7;

export function layoutStrip(W: number, conns: Conn[], opts: Opts): StripLayout {
  const width = Math.max(300, W);
  const inConns = opts.empty ? [] : conns.filter((c) => SOURCES.some((s) => s.id === c.from));
  const outConns = opts.empty ? [] : conns.filter((c) => DESTS.some((d) => d.id === c.to));

  // Lanes first (they set the gutter), using order only; y comes after.
  const laneCount = Math.max(3, Math.min(9, Math.max(inConns.length, outConns.length)));
  const gutter = 12 + laneCount * LANE + 8;
  const x = gutter;
  const w = width - gutter;

  const sections: StripSection[] = [];
  let y = 0;
  sections.push({ id: "from", y });
  y += SECTION_H;
  const src = stackColumn(SOURCES, inConns, x, w, "source", opts);
  for (const c of src.cards) shift(c, y);
  y += src.bottom + 20;

  sections.push({ id: "signal", y });
  y += SECTION_H;
  const appCards: CardBox[] = [];
  const portOf = (cards: CardBox[], id: string) => {
    for (const c of cards) for (const r of c.rows) if (r.conn === id) return r.portY;
    return 0;
  };
  for (const node of APPS) {
    const ins = inConns.filter((c) => c.to === node.id).sort((a, b) => portOf(src.cards, a.id) - portOf(src.cards, b.id));
    const outs = outConns.filter((c) => c.from === node.id);
    const n = ins.length + outs.length;
    const h = Math.max(60, 20 + n * 9 + 20);
    const card: CardBox = { id: node.id, node, x, y, w, h, ghost: false, rows: [], handle: null, ports: {} };
    const top = y + h / 2 - ((n - 1) * 9) / 2;
    [...ins, ...outs].forEach((c, i) => (card.ports[c.id] = { x, y: top + i * 9 }));
    appCards.push(card);
    y += h + 10;
  }
  y += 10;

  sections.push({ id: "to", y });
  y += SECTION_H;
  const dst = stackColumn(DESTS, outConns, x, w, "dest", opts);
  for (const c of dst.cards) {
    shift(c, y);
    c.handle = null;
  }
  for (const c of src.cards) c.handle = null;
  y += dst.bottom;

  // Routes: every line runs left into the gutter, down, and back in.
  const lines = [
    ...inConns.map((c) => ({ id: c.id, y1: portOf(src.cards, c.id), y2: appCards.find((a) => a.id === c.to)!.ports[c.id].y })),
    ...outConns.map((c) => ({ id: c.id, y1: appCards.find((a) => a.id === c.from)!.ports[c.id].y, y2: portOf(dst.cards, c.id) })),
  ];
  // Longest lines take the outer lanes; lanes are reused where lines never overlap.
  const byLen = [...lines].sort((a, b) => b.y2 - b.y1 - (a.y2 - a.y1));
  const lanes: { until: number; from: number }[][] = [];
  const laneOf: Record<string, number> = {};
  for (const l of byLen) {
    let k = lanes.findIndex((spans) => spans.every((s) => l.y2 + 6 < s.from || l.y1 - 6 > s.until));
    if (k === -1) {
      lanes.push([]);
      k = lanes.length - 1;
    }
    lanes[k].push({ from: l.y1, until: l.y2 });
    laneOf[l.id] = k;
  }
  const used = Math.max(1, lanes.length);
  const routes: Record<string, Route> = {};
  for (const l of lines) {
    // Lane 0 is the outermost (leftmost); keep the bundle tucked against the cards.
    const k = laneOf[l.id];
    const xl = gutter - 10 - (used - 1 - k) * LANE;
    routes[l.id] = stripRoute(l.id, x, l.y1, l.y2, xl);
  }

  return {
    width,
    height: Math.ceil(y + 8),
    cards: [...src.cards, ...appCards, ...dst.cards],
    routes,
    cols: { src: [x, w], app: [x, w], dest: [x, w] },
    sections,
    gutter,
  };
}

function shift(c: CardBox, dy: number) {
  c.y += dy;
  c.rows = c.rows.map((r) => ({ ...r, y: r.y + dy, portY: r.portY + dy }));
  if (c.handle) c.handle = { ...c.handle, y: c.handle.y + dy };
}

function stripRoute(id: string, x: number, y1: number, y2: number, xl: number): Route {
  const r = Math.min(6, (y2 - y1) / 2, x - xl - 1);
  const d = `M ${n1(x)} ${n1(y1)} H ${n1(xl + r)} Q ${n1(xl)} ${n1(y1)} ${n1(xl)} ${n1(y1 + r)} V ${n1(y2 - r)} Q ${n1(xl)} ${n1(y2)} ${n1(xl + r)} ${n1(y2)} H ${n1(x)}`;
  const segs: Seg[] = [
    { x1: x, y1, x2: xl, y2: y1, len: x - xl },
    { x1: xl, y1, x2: xl, y2, len: y2 - y1 },
    { x1: xl, y1: y2, x2: x, y2, len: x - xl },
  ];
  return { id, d, len: segs.reduce((a, g) => a + g.len, 0), segs };
}
