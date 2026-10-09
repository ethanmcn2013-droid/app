/* Geometry for The Line. Time is one linear scale: every station, month
   tick and train sits at x = f(date) (or y = f(date) on a phone). Tracks
   only ever run straight or at 45 degrees. Labels are placed by a small
   greedy solver that never lets a label cover a track, another label or
   another label's leader. */

import { MON, dayNum, monthOf, yearOf, fromDayNum, type Iso, type Scenario, type Station } from "./data";

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
export type SegKind = "passed" | "firm" | "plan";

export type LabelPlace = {
  box: Box;
  anchor: "start" | "end";
  side: "up" | "down";
  /** Leader from the stop to the label edge. */
  leader: [Pt, Pt];
  row: number;
};

export type HStation = {
  station: Station;
  x: number;
  /** One point per line the stop sits on, in line order. */
  points: Pt[];
  pill: { x: number; y1: number; y2: number } | null;
  label: LabelPlace;
};

export type HGhost = { station: Station; x: number; y: number; label: LabelPlace };

export type HLine = {
  id: string;
  index: number;
  color: string;
  path: Pt[];
  segments: { kind: SegKind; pts: Pt[] }[];
  startX: number;
  train: { at: Pt; route: Pt[] } | null;
  plannedTags: Pt[];
};

export type HLayout = {
  width: number;
  height: number;
  pxPerDay: number;
  x0Day: number;
  lines: HLine[];
  stations: HStation[];
  ghosts: HGhost[];
  terminus: { x: number; y1: number; y2: number; label: Box };
  today: { x: number; top: number; bottom: number };
  months: { x: number; label: string; major: boolean }[];
  axisY: number;
  mergeX: number;
};

/* ── Text measure (approximate, stable between server and client) ──── */

const TITLE_W = 7.05; // 13.5px, 600 weight
const DATE_W = 6.25; // 12px tabular
export const LABEL_H = 34;
const ROW_GAP = 8;
const ROW_H = LABEL_H + ROW_GAP;
const OFFSET = 17;

export function labelWidth(title: string, date: string) {
  return Math.ceil(Math.max(title.length * TITLE_W, date.length * DATE_W)) + 4;
}

/* ── Small geometry helpers ─────────────────────────────────────────── */

export function yAt(path: Pt[], x: number): number {
  if (x <= path[0].x) return path[0].y;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (x <= b.x) {
      if (b.x === a.x) return b.y;
      return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
    }
  }
  return path[path.length - 1].y;
}

/** Part of a left-to-right polyline between two x positions. */
export function clipX(path: Pt[], from: number, to: number): Pt[] {
  if (to <= from) return [];
  const out: Pt[] = [{ x: from, y: yAt(path, from) }];
  for (const p of path) if (p.x > from && p.x < to) out.push(p);
  out.push({ x: to, y: yAt(path, to) });
  return out;
}

function hits(a: Box, b: Box, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

function segHitsBox(p: Pt, q: Pt, b: Box, pad: number) {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const n = Math.max(1, Math.ceil(len / 3));
  for (let i = 0; i <= n; i++) {
    const x = p.x + ((q.x - p.x) * i) / n;
    const y = p.y + ((q.y - p.y) * i) / n;
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

/* ── Horizontal map (desktop and tablet) ──────────────────────────── */

const LANE_TOP_GAP = 60;
const STRIPE = 10;
const LEAD = 26;

type Pending = {
  key: string;
  x: number;
  yTop: number;
  yBottom: number;
  side: "up" | "down";
  w: number;
  lane: number;
  kind: "station" | "ghost";
  ref: Station;
};

export function layoutH(s: Scenario, pxPerDay: number, padL = 56, padR = 236, nextId: string | null = null): HLayout {
  const startDay = dayNum(s.start);
  const todayDay = dayNum(s.today);
  const x = (iso: Iso) => padL + (dayNum(iso) - startDay) * pxPerDay;
  const xd = (d: number) => padL + (d - startDay) * pxPerDay;
  const n = s.lines.length;
  const lineIndex = new Map(s.lines.map((l, i) => [l.id, i]));
  const T = x(s.terminus.date);
  const mergeX = Math.min(Math.max(x(s.mergeBy), padL + 40), T - 44);

  // Lane gaps start generous and grow to fit the labels hung beneath lanes.
  let gaps: number[] = s.lines.map((_, i) => (i === 0 ? LANE_TOP_GAP : 64));
  let result: Omit<HLayout, "height" | "axisY" | "months" | "today"> & { maxY: number; minY: number } = null!;

  for (let pass = 0; pass < 5; pass++) {
    const laneY: number[] = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      laneY.push(acc);
      acc += gaps[i] ?? 60;
    }
    const stripeY = (i: number) => laneY[0] + i * STRIPE;
    const bundleBottom = stripeY(n - 1);

    // Tracks.
    const lines: HLine[] = s.lines.map((l, i) => {
      const own = s.stations.filter((st) => st.lines.includes(l.id));
      const firstX = own.length ? Math.min(...own.map((st) => x(st.movedFrom ?? st.date))) : mergeX - 60;
      const startX = Math.min(firstX - LEAD, mergeX - 30);
      const dy = laneY[i] - stripeY(i);
      const path: Pt[] =
        dy === 0
          ? [{ x: startX, y: laneY[i] }, { x: T, y: laneY[i] }]
          : [
              { x: startX, y: laneY[i] },
              { x: mergeX - dy, y: laneY[i] },
              { x: mergeX, y: stripeY(i) },
              { x: T, y: stripeY(i) },
            ];
      return { id: l.id, index: i, color: l.color, path, segments: [], startX, train: null, plannedTags: [] };
    });

    // Stations and the labels waiting to be placed.
    const pending: Pending[] = [];
    const stationPts = new Map<string, { x: number; points: Pt[]; pill: HStation["pill"] }>();
    for (const st of s.stations) {
      const sx = x(st.date);
      const idx = st.lines.map((id) => lineIndex.get(id) ?? 0).sort((a, b) => a - b);
      const points = idx.map((i) => ({ x: sx, y: yAt(lines[i].path, sx) }));
      const ys = points.map((p) => p.y);
      const pill = points.length > 1 ? { x: sx, y1: Math.min(...ys), y2: Math.max(...ys) } : null;
      stationPts.set(st.id, { x: sx, points, pill });
      const top = idx[0];
      const merged = sx >= mergeX;
      const side: "up" | "down" = top === 0 ? "up" : "down";
      pending.push({
        key: st.id,
        x: sx,
        yTop: merged ? laneY[0] : Math.min(...ys),
        yBottom: merged ? bundleBottom : Math.max(...ys),
        side,
        w: labelWidth(st.title, st.id === nextId ? `Next stop · ${dateLabel(st)}` : dateLabel(st)),
        lane: top,
        kind: "station",
        ref: st,
      });
      if (st.movedFrom) {
        const gx = x(st.movedFrom);
        const gy = yAt(lines[top].path, gx);
        pending.push({
          key: `ghost-${st.id}`,
          x: gx,
          yTop: gy,
          yBottom: gy,
          side,
          w: labelWidth("Was here", ghostLabel(st)),
          lane: top,
          kind: "ghost",
          ref: st,
        });
      }
    }

    // Obstacles: every track, every interchange, the terminus label.
    const trackList: { a: Pt; b: Pt; line: number; lane: boolean }[] = [];
    for (const l of lines)
      for (let i = 1; i < l.path.length; i++)
        trackList.push({ a: l.path[i - 1], b: l.path[i], line: l.index, lane: i === 1 && l.index > 0 && l.path.length > 2 });
    const tracks: [Pt, Pt][] = trackList.map((t) => [t.a, t.b]);
    // Lanes below a label's own lane move down to make room, so they never block it.
    const blocking = (p: Pending): [Pt, Pt][] =>
      trackList.filter((t) => !(p.side === "down" && t.lane && t.line > p.lane)).map((t) => [t.a, t.b]);
    const termMid = (laneY[0] + bundleBottom) / 2;
    const termBox: Box = { x: T + 18, y: termMid - 24, w: padR - 40, h: 48 };
    const fixed: Box[] = [termBox, { x: T - 12, y: laneY[0] - 12, w: 24, h: bundleBottom - laneY[0] + 24 }];
    for (const v of stationPts.values()) if (v.pill) fixed.push({ x: v.x - 9, y: v.pill.y1 - 9, w: 18, h: v.pill.y2 - v.pill.y1 + 18 });

    // Labels hung under different lanes never meet: the lanes move apart
    // to hold them. So they only test against their own group.
    const groupOf = (p: Pending) => (p.side === "down" && p.x < mergeX - 4 && p.lane > 0 ? `lane${p.lane}` : p.side);
    const placed: { box: Box; leader: [Pt, Pt]; group: string }[] = [];
    const labels = new Map<string, LabelPlace>();
    const order = [...pending].sort((a, b) => b.x - a.x);
    for (const p of order) {
      const g = groupOf(p);
      const others = placed.filter((q) => q.group === g || !(q.group.startsWith("lane") && g.startsWith("lane")));
      const block = blocking(p);
      let chosen: LabelPlace | null = null;
      let fallback: LabelPlace | null = null;
      for (const strict of [true, false]) {
        outer: for (let row = 0; row < 7; row++) {
          for (const anchor of ["start", "end"] as const) {
            const base = p.side === "up" ? p.yTop - OFFSET - row * ROW_H - LABEL_H : p.yBottom + OFFSET + row * ROW_H;
            const bx = anchor === "start" ? p.x + 6 : p.x - 6 - p.w;
            const box: Box = { x: bx, y: base, w: p.w, h: LABEL_H };
            const leader: [Pt, Pt] =
              p.side === "up"
                ? [{ x: p.x, y: p.yTop - 9 }, { x: p.x, y: base + LABEL_H }]
                : [{ x: p.x, y: p.yBottom + 9 }, { x: p.x, y: base }];
            const cand: LabelPlace = { box, anchor, side: p.side, leader, row };
            if (!fallback) fallback = cand;
            if (box.x < 8) continue;
            if (fixed.some((f) => hits(box, f, 4))) continue;
            if (block.some(([a, b]) => segHitsBox(a, b, box, 6))) continue;
            if (others.some((q) => hits(box, q.box, 6))) continue;
            if (strict && others.some((q) => segHitsBox(leader[0], leader[1], q.box, 3))) continue;
            // Reaching left over a stop still to be labelled would trap its leader.
            if (strict && anchor === "end" && order.some((o) => o !== p && !labels.has(o.key) && groupOf(o) === g && o.x < p.x && o.x > box.x - 6)) continue;
            if (others.some((q) => segHitsBox(q.leader[0], q.leader[1], box, 3))) continue;
            // A leader may cross its own lane's track only where it starts.
            if (row > 0 && block.some(([a, b]) => segHitsBox(a, b, { x: p.x - 0.5, y: Math.min(leader[0].y, leader[1].y) + 2, w: 1, h: Math.abs(leader[1].y - leader[0].y) - 4 }, 1))) continue;
            chosen = cand;
            break outer;
          }
        }
        if (chosen) break;
      }
      const c = chosen ?? fallback!;
      placed.push({ box: c.box, leader: c.leader, group: g });
      labels.set(p.key, c);
    }

    // Grow lane gaps to hold the labels hung beneath lanes 1..n-1.
    const need = gaps.slice();
    for (const p of pending) {
      if (p.side !== "down" || p.x >= mergeX - 4) continue;
      const lab = labels.get(p.key)!;
      const i = p.lane;
      if (i < n - 1) {
        const bottom = lab.box.y + lab.box.h + 14 - laneY[i];
        need[i] = Math.max(need[i], Math.ceil(bottom));
      }
    }
    for (let i = 1; i < n - 1; i++) need[i] = Math.max(need[i], 64);

    const stationsOut: HStation[] = s.stations.map((st) => {
      const v = stationPts.get(st.id)!;
      return { station: st, x: v.x, points: v.points, pill: v.pill, label: labels.get(st.id)! };
    });
    const ghosts: HGhost[] = s.stations
      .filter((st) => st.movedFrom)
      .map((st) => {
        const top = Math.min(...st.lines.map((id) => lineIndex.get(id) ?? 0));
        const gx = x(st.movedFrom!);
        return { station: st, x: gx, y: yAt(lines[top].path, gx), label: labels.get(`ghost-${st.id}`)! };
      });

    let minY = laneY[0] - 12;
    let maxY = Math.max(laneY[n - 1], bundleBottom) + 12;
    for (const l of labels.values()) {
      minY = Math.min(minY, l.box.y);
      maxY = Math.max(maxY, l.box.y + l.box.h);
    }

    // Segments: passed, firm, planned (dashed).
    const tx = Math.min(xd(todayDay), T);
    for (const l of lines) {
      const own = s.stations.filter((st) => st.lines.includes(l.id)).sort((a, b) => dayNum(a.date) - dayNum(b.date));
      const stops: { x: number; firm: boolean }[] = [
        ...own.map((st) => ({ x: x(st.date), firm: st.firm })),
        { x: T, firm: own.length ? own[own.length - 1].firm : true },
      ];
      let prev = l.startX;
      for (const stop of stops) {
        if (stop.x <= prev) continue;
        const a = prev;
        const b = stop.x;
        if (b <= tx) l.segments.push({ kind: "passed", pts: clipX(l.path, a, b) });
        else if (a >= tx) l.segments.push({ kind: stop.firm ? "firm" : "plan", pts: clipX(l.path, a, b) });
        else {
          l.segments.push({ kind: "passed", pts: clipX(l.path, a, tx) });
          l.segments.push({ kind: stop.firm ? "firm" : "plan", pts: clipX(l.path, tx, b) });
        }
        prev = b;
      }
      // Trains: on every line that has begun.
      if (tx >= l.startX) {
        const at = { x: Math.min(tx, T - 22), y: yAt(l.path, Math.min(tx, T - 22)) };
        l.train = { at, route: clipX(l.path, l.startX, at.x) };
      }
      // "Planned" tags on long dashed runs, where they fit.
      for (const seg of l.segments) {
        if (seg.kind !== "plan" || l.plannedTags.length) continue;
        const a = seg.pts[0];
        const b = seg.pts[seg.pts.length - 1];
        if (b.x - a.x < 150) continue;
        const px = a.x + 24;
        const py = yAt(l.path, px);
        const tag: Box = { x: px, y: py - 22, w: 52, h: 14 };
        if (placed.some((q) => hits(tag, q.box, 4)) || fixed.some((f) => hits(tag, f, 2))) continue;
        if (tracks.some(([p, q]) => segHitsBox(p, q, tag, 3))) continue;
        l.plannedTags.push({ x: px, y: py });
      }
    }

    result = {
      width: T + padR,
      pxPerDay,
      x0Day: startDay,
      lines,
      stations: stationsOut,
      ghosts,
      terminus: { x: T, y1: laneY[0], y2: bundleBottom, label: termBox },
      mergeX,
      minY,
      maxY,
    };

    const stable = need.every((v, i) => v <= gaps[i]);
    if (stable) break;
    gaps = need;
  }

  // Shift everything so the top of the drawing sits under the today tag.
  const top = 58;
  const dy = top - result.minY;
  const sh = (p: Pt): Pt => ({ x: p.x, y: p.y + dy });
  const shB = (b: Box): Box => ({ ...b, y: b.y + dy });
  const shL = (l: LabelPlace): LabelPlace => ({ ...l, box: shB(l.box), leader: [sh(l.leader[0]), sh(l.leader[1])] });
  const lines = result.lines.map((l) => ({
    ...l,
    path: l.path.map(sh),
    segments: l.segments.map((g) => ({ ...g, pts: g.pts.map(sh) })),
    train: l.train ? { at: sh(l.train.at), route: l.train.route.map(sh) } : null,
    plannedTags: l.plannedTags.map(sh),
  }));
  const stations = result.stations.map((h) => ({
    ...h,
    points: h.points.map(sh),
    pill: h.pill ? { ...h.pill, y1: h.pill.y1 + dy, y2: h.pill.y2 + dy } : null,
    label: shL(h.label),
  }));
  const ghosts = result.ghosts.map((g) => ({ ...g, y: g.y + dy, label: shL(g.label) }));
  const axisY = result.maxY + dy + 34;
  const height = axisY + 30;

  const months: HLayout["months"] = [];
  const first = dayNum(s.start);
  const last = dayNum(s.terminus.date) + Math.round(padR / pxPerDay);
  const d0 = fromDayNum(first);
  let y = yearOf(d0);
  let m = monthOf(d0) + 1;
  for (let k = 0; k < 40; k++) {
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-01` as Iso;
    const dn = dayNum(iso);
    if (dn > last) break;
    const mx = xd(dn);
    if (mx > 20) months.push({ x: mx, label: m === 0 ? `${MON[m]} ${y}` : MON[m], major: m === 0 });
    m += 1;
  }

  return {
    width: result.width,
    height,
    pxPerDay,
    x0Day: result.x0Day,
    lines,
    stations,
    ghosts,
    terminus: {
      x: result.terminus.x,
      y1: result.terminus.y1 + dy,
      y2: result.terminus.y2 + dy,
      label: shB(result.terminus.label),
    },
    today: { x: Math.min(xd(dayNum(s.today)), result.terminus.x), top: 22, bottom: axisY - 16 },
    months,
    axisY,
    mergeX: result.mergeX,
  };
}

/* ── Label text shared by both maps ───────────────────────────────── */

export function dateLabel(st: Station) {
  const [y, m, d] = st.date.split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
}
export function ghostLabel(st: Station) {
  const [, m, d] = st.date.split("-").map(Number);
  return `Moved to ${d} ${MON[m - 1]}`;
}

/* ── Vertical map (phone) ─────────────────────────────────────────── */

export type VStation = {
  station: Station;
  y: number;
  points: Pt[];
  pill: { y: number; x1: number; x2: number } | null;
  label: { y: number; h: number; lines: number };
};

export type VLayout = {
  width: number;
  height: number;
  lineX: number[];
  colX: number;
  labelX: number;
  lines: { id: string; index: number; color: string; path: Pt[]; segments: { kind: SegKind; pts: Pt[] }[]; train: { at: Pt; route: Pt[] } | null; startY: number }[];
  stations: VStation[];
  ghosts: { station: Station; y: number; x: number; label: { y: number; h: number } }[];
  terminus: { y: number; x1: number; x2: number; label: { y: number; h: number } };
  today: { y: number };
  months: { y: number; label: string }[];
};

function clipY(path: Pt[], from: number, to: number): Pt[] {
  const swap = path.map((p) => ({ x: p.y, y: p.x }));
  return clipX(swap, from, to).map((p) => ({ x: p.y, y: p.x }));
}
function xAt(path: Pt[], y: number) {
  return yAt(path.map((p) => ({ x: p.y, y: p.x })), y);
}

/** Spread labels along one axis so none overlap, keeping each as close to
    its stop as it can. Classic cluster merge: overlapping labels form a
    block centred on the mean of their stops. */
export function spread(items: { ideal: number; h: number }[], gap: number, min: number): number[] {
  type Block = { start: number; h: number; idx: number[]; sum: number };
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.ideal - b.ideal);
  const blocks: Block[] = [];
  for (const it of order) {
    let b: Block = { start: it.ideal - it.h / 2, h: it.h, idx: [it.i], sum: it.ideal - it.h / 2 };
    blocks.push(b);
    // Merge while this block overlaps the one before it.
    while (blocks.length > 1) {
      const prev = blocks[blocks.length - 2];
      if (prev.start + prev.h + gap <= b.start) break;
      blocks.pop();
      blocks.pop();
      const idx = [...prev.idx, ...b.idx];
      const h = prev.h + gap + b.h;
      // Centre the block on its stops.
      let offset = 0;
      let sumIdeal = 0;
      for (const k of idx) {
        sumIdeal += items[k].ideal - (offset + items[k].h / 2);
        offset += items[k].h + gap;
      }
      const start = sumIdeal / idx.length;
      b = { start, h, idx, sum: start };
      blocks.push(b);
    }
  }
  // Keep the first block below the minimum, pushing later blocks on.
  const out = new Array<number>(items.length);
  let floor = min;
  for (const b of blocks) {
    let y = Math.max(b.start, floor);
    for (const k of b.idx) {
      out[k] = y;
      y += items[k].h + gap;
    }
    floor = y;
  }
  return out;
}

export function layoutV(s: Scenario, width: number): VLayout {
  const n = s.lines.length;
  const startDay = dayNum(s.start);
  const endDay = dayNum(s.terminus.date);
  const todayDay = dayNum(s.today);
  const days = endDay - startDay;
  const py = Math.min(7, Math.max(2, (s.stations.length * 56) / days));
  const top = 30;
  const yd = (d: number) => top + (d - startDay) * py;
  const y = (iso: Iso) => yd(dayNum(iso));
  const colX = 62;
  const gap = 17;
  const lineX = s.lines.map((_, i) => colX + i * gap);
  const bundle = (i: number) => colX + i * STRIPE;
  const T = y(s.terminus.date);
  const mergeY = Math.min(Math.max(y(s.mergeBy), top + 30), T - 30);
  const labelX = lineX[n - 1] + 30;
  const colW = width - labelX - 16;
  const lineIndex = new Map(s.lines.map((l, i) => [l.id, i]));

  const lines = s.lines.map((l, i) => {
    const own = s.stations.filter((st) => st.lines.includes(l.id));
    const firstY = own.length ? Math.min(...own.map((st) => y(st.movedFrom ?? st.date))) : mergeY - 40;
    const startY = Math.min(firstY - 18, mergeY - 20);
    const dx = lineX[i] - bundle(i);
    const path: Pt[] =
      dx === 0
        ? [{ x: lineX[i], y: startY }, { x: lineX[i], y: T }]
        : [
            { x: lineX[i], y: startY },
            { x: lineX[i], y: mergeY - dx },
            { x: bundle(i), y: mergeY },
            { x: bundle(i), y: T },
          ];
    return { id: l.id, index: i, color: l.color, path, segments: [] as { kind: SegKind; pts: Pt[] }[], train: null as { at: Pt; route: Pt[] } | null, startY };
  });

  const ty = Math.min(yd(todayDay), T);
  for (const l of lines) {
    const own = s.stations.filter((st) => st.lines.includes(l.id)).sort((a, b) => dayNum(a.date) - dayNum(b.date));
    const stops = [...own.map((st) => ({ y: y(st.date), firm: st.firm })), { y: T, firm: own.length ? own[own.length - 1].firm : true }];
    let prev = l.startY;
    for (const stop of stops) {
      if (stop.y <= prev) continue;
      const a = prev;
      const b = stop.y;
      if (b <= ty) l.segments.push({ kind: "passed", pts: clipY(l.path, a, b) });
      else if (a >= ty) l.segments.push({ kind: stop.firm ? "firm" : "plan", pts: clipY(l.path, a, b) });
      else {
        l.segments.push({ kind: "passed", pts: clipY(l.path, a, ty) });
        l.segments.push({ kind: stop.firm ? "firm" : "plan", pts: clipY(l.path, ty, b) });
      }
      prev = b;
    }
    if (ty >= l.startY) {
      const at = { x: xAt(l.path, Math.min(ty, T - 18)), y: Math.min(ty, T - 18) };
      l.train = { at, route: clipY(l.path, l.startY, at.y) };
    }
  }

  const titleLines = (t: string) => (t.length * TITLE_W > colW ? 2 : 1);
  type Item = { ideal: number; h: number; kind: "st" | "ghost" | "term"; st?: Station };
  const items: Item[] = [];
  for (const st of s.stations) {
    const tl = titleLines(st.title);
    items.push({ ideal: y(st.date), h: tl === 2 ? 50 : 34, kind: "st", st });
    if (st.movedFrom) items.push({ ideal: y(st.movedFrom), h: 18, kind: "ghost", st });
  }
  items.push({ ideal: T + 8, h: 48, kind: "term" });
  const ys = spread(items, 8, top - 10);

  const stations: VStation[] = [];
  const ghosts: VLayout["ghosts"] = [];
  let termLabel = { y: T, h: 48 };
  items.forEach((it, k) => {
    if (it.kind === "term") termLabel = { y: ys[k], h: it.h };
    else if (it.kind === "ghost") {
      const st = it.st!;
      const top = Math.min(...st.lines.map((id) => lineIndex.get(id) ?? 0));
      const gy = y(st.movedFrom!);
      ghosts.push({ station: st, y: gy, x: xAt(lines[top].path, gy), label: { y: ys[k], h: it.h } });
    } else {
      const st = it.st!;
      const sy = y(st.date);
      const idx = st.lines.map((id) => lineIndex.get(id) ?? 0).sort((a, b) => a - b);
      const points = idx.map((i) => ({ x: xAt(lines[i].path, sy), y: sy }));
      const xs = points.map((p) => p.x);
      stations.push({
        station: st,
        y: sy,
        points,
        pill: points.length > 1 ? { y: sy, x1: Math.min(...xs), x2: Math.max(...xs) } : null,
        label: { y: ys[k], h: it.h, lines: titleLines(st.title) },
      });
    }
  });

  const months: VLayout["months"] = [];
  const d0 = fromDayNum(startDay);
  let yy = yearOf(d0);
  let m = monthOf(d0) + 1;
  for (let k = 0; k < 40; k++) {
    if (m > 11) {
      m = 0;
      yy += 1;
    }
    const iso = `${yy}-${String(m + 1).padStart(2, "0")}-01` as Iso;
    if (dayNum(iso) > endDay) break;
    months.push({ y: y(iso), label: m === 0 ? `${MON[m]} ${String(yy).slice(2)}` : MON[m] });
    m += 1;
  }

  const bottom = Math.max(T + 40, ...items.map((it, k) => ys[k] + it.h)) + 24;

  return {
    width,
    height: bottom,
    lineX,
    colX,
    labelX,
    lines,
    stations,
    ghosts,
    terminus: { y: T, x1: bundle(0), x2: bundle(n - 1), label: termLabel },
    today: { y: ty },
    months,
  };
}
