import {
  HEALTH_LANES,
  KIND_LANES,
  PEOPLE,
  PEOPLE_ORDER,
  fmtUntil,
  nextMilestone,
  type Health,
  type Kind,
  type PersonId,
  type Project,
} from "./data";

export type Lens = "health" | "people" | "kind";
export type Camera = { x0: number; scale: number };
export type Level = "far" | "mid" | "near";
export type Rect = { x1: number; x2: number; y1: number; y2: number };

export const RULER_H = 48;
export const TOOLBAR_SPACE = 84;
export const LOAD_H = 148;
export const MIN_SCALE = 2.6;
export const MAX_SCALE = 90;
export const DEFAULT_SCALE = 9;
/** Right edge of the floating Projects panel, plus a gutter. */
export const LEFT_FREE = 324;
/** Below this canvas width, labels drop to one short line so they never collide. */
export const NARROW_W = 1180;
/** Today sits this far into the free canvas (right of the panel) by default. */
export const TODAY_SHARE = 0.16;

/** Left edge of a day cell (grid lines, weeks, crunch bands). */
export const sx = (cam: Camera, day: number) => (day - cam.x0) * cam.scale;
/** Centre of a day cell: where anything that happens on a day sits, so it lines up with the ruler's day numbers. */
export const cx = (cam: Camera, day: number) => sx(cam, day + 0.5);
export const dayAt = (cam: Camera, x: number) => cam.x0 + x / cam.scale;
/** The whole day under a screen x. */
export const dayUnder = (cam: Camera, x: number) => Math.floor(dayAt(cam, x));

export function defaultCamera(w: number, scale = DEFAULT_SCALE): Camera {
  const todayX = LEFT_FREE + Math.max(0, w - LEFT_FREE) * TODAY_SHARE;
  return { scale, x0: 0.5 - todayX / scale };
}

export function levelFor(scale: number): Level {
  if (scale < 6.2) return "far";
  if (scale < 22) return "mid";
  return "near";
}

export function radiusFor(open: number) {
  return Math.max(10, Math.min(22, 8 + Math.sqrt(open) * 2.7));
}

export type LaneBox = { id: string; label: string; person?: PersonId; top: number; bottom: number; count: number };

export type PlacedNode = {
  type: "node";
  p: Project;
  x: number;
  y: number;
  r: number;
  labelW: number;
  compact: boolean;
  /** No room for a label anywhere: the disc alone, named on hover and to screen readers. */
  bare: boolean;
  flip: boolean;
  lane: string;
};

export type PlacedPill = {
  type: "pill";
  p: Project;
  x1: number;
  x2: number;
  y: number;
  h: number;
  labelInside: boolean;
  labelW: number;
  /** The span runs past the right edge and fades out there. */
  bleed: boolean;
  /** Too little of it shows for its name: the label sits just before it. */
  flipLabel: boolean;
  lane: string;
};

export type PlacedCluster = {
  type: "cluster";
  key: string;
  members: Project[];
  x: number;
  y: number;
  r: number;
  labelW: number;
  bare: boolean;
  flip: boolean;
  lane: string;
};

export type Placed = PlacedNode | PlacedPill | PlacedCluster;

export function laneOf(p: Project, lens: Lens): string {
  if (lens === "kind") return p.kind;
  if (lens === "people") return p.owner;
  return p.health;
}

export function lanesFor(lens: Lens): { id: Health | Kind | PersonId; label: string; person?: PersonId }[] {
  if (lens === "kind") return KIND_LANES;
  if (lens === "people") return PEOPLE_ORDER.map((id) => ({ id, label: PEOPLE[id].first, person: id }));
  return HEALTH_LANES;
}

/** Rough text width for the 13px UI face. */
export function textW(s: string, px = 13) {
  return Math.ceil(s.length * px * 0.56);
}

/** Extra label room for a "linked to" tag, when the link line itself is hidden. */
export type RelTags = Map<string, string>;

function labelWidth(p: Project, level: Level, tag?: string) {
  const line1 = textW(p.name, 13) + 10 + textW(p.day === undefined ? "" : fmtUntil(p.day), 12);
  if (level === "far") return Math.min(line1, 210);
  const nm = nextMilestone(p);
  const line2 = (nm ? textW(`Next: ${nm.label} · 29 Sep`, 12) : 60) + 40 + (tag ? textW(tag, 11.5) + 26 : 0);
  return Math.min(Math.max(line1, line2), level === "near" ? 400 : 380);
}

export type LayoutOpts = {
  extraBottom?: number;
  /** Floating chrome the labels must stay clear of, in canvas pixels. */
  keepOut?: Rect[];
  tags?: RelTags;
};

export type LayoutResult = {
  lanes: LaneBox[];
  items: Placed[];
  level: Level;
  /** Projects entirely past the right edge, per lane. */
  offRight: Map<string, Project[]>;
  /** Projects entirely past the left edge. */
  offLeft: Project[];
  lanesBottom: number;
};

export function layout(projects: Project[], cam: Camera, size: { w: number; h: number }, lens: Lens, opts: LayoutOpts = {}): LayoutResult {
  const { extraBottom = 0, keepOut = [], tags } = opts;
  const top = RULER_H + 6;
  const maxBottom = size.h - TOOLBAR_SPACE - extraBottom;
  const defs = lanesFor(lens);
  const counts = defs.map((d) => projects.filter((p) => p.day !== undefined && laneOf(p, lens) === d.id).length);
  const avail = Math.max(0, maxBottom - top);
  const reserveFor = (i: number) => (i === 0 ? 40 : 28);
  // Busy lanes are promised more rows up front, so their labels have room.
  const floorRows = (c: number) => (c ? Math.max(2, Math.min(4, Math.ceil(c * 0.6))) : 1);
  const floorFor = (i: number, rh: number) => reserveFor(i) + floorRows(counts[i]) * rh + (counts[i] ? 10 : 0);
  const floorSumFor = (rh: number) => counts.reduce((sum, _c, i) => sum + floorFor(i, rh), 0);

  // Two-line labels need width and height. A narrow canvas, or lanes too
  // short for two rows each, read at the far level: one short line per
  // project, so labels never have to fight for room.
  const scaleLevel = levelFor(cam.scale);
  const level: Level = scaleLevel === "mid" && (size.w < NARROW_W || floorSumFor(56) > avail) ? "far" : scaleLevel;
  const rowH = level === "far" ? 34 : level === "mid" ? 56 : 66;
  const twoLine = level !== "far";

  // Lanes get height by how many projects they hold, and never more than
  // they can use: on a tall screen the spare room collects at the bottom,
  // under the tray and toolbar, instead of stranding nodes in empty lanes.
  const weights = counts.map((c) => 1 + c * 0.55);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const cap = (i: number) => reserveFor(i) + Math.max(3, Math.min(8, counts[i] + 3)) * rowH + 10;
  // Every lane with projects gets at least two rows, so a label never has to
  // share its only row with an edge chip.
  const floors = defs.map((_, i) => floorFor(i, rowH));
  const floorSum = floors.reduce((a, b) => a + b, 0);
  const heights =
    floorSum < avail
      ? weights.map((w, i) => Math.min(floors[i] + ((avail - floorSum) * w) / totalW, Math.max(floors[i], cap(i))))
      : weights.map((w) => (avail * w) / totalW);
  // Hand room freed by capped lanes to the ones that still want it.
  for (let pass = 0; pass < 3; pass++) {
    const spare = avail - heights.reduce((a, b) => a + b, 0);
    const hungry = heights.map((h, i) => (h < cap(i) - 0.5 ? i : -1)).filter((i) => i >= 0);
    if (spare < 1 || !hungry.length || floorSum >= avail) break;
    const hw = hungry.reduce((a, i) => a + weights[i], 0);
    for (const i of hungry) heights[i] = Math.min(cap(i), heights[i] + (spare * weights[i]) / hw);
  }
  let acc = top;
  const lanes: LaneBox[] = defs.map((d, i) => {
    const box: LaneBox = { id: d.id, label: d.label, person: d.person, top: acc, bottom: acc + heights[i], count: 0 };
    acc += heights[i];
    return box;
  });
  const lanesBottom = acc;
  const items: Placed[] = [];
  const offRight = new Map<string, Project[]>();
  const offLeft: Project[] = [];

  lanes.forEach((lane, laneIndex) => {
    const inLane = projects
      .filter((p) => p.day !== undefined && laneOf(p, lens) === lane.id)
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
    lane.count = inLane.length;

    // A disc that would be cut by the right edge becomes an edge chip, never
    // half a node. A span only needs its start on screen: it bleeds off the
    // edge with its name inside.
    const onScreen: Project[] = [];
    const later = (p: Project) => offRight.set(lane.id, [...(offRight.get(lane.id) ?? []), p]);
    for (const p of inLane) {
      const x = cx(cam, p.day ?? 0);
      const right = p.endDay !== undefined ? sx(cam, p.endDay + 1) : x;
      if (p.endDay !== undefined ? sx(cam, p.day ?? 0) > size.w - 96 : x + radiusFor(p.open) + 8 > size.w) later(p);
      else if (right < 4) offLeft.push(p);
      else onScreen.push(p);
    }

    // Group points that would overlap into clusters.
    type Group = { members: Project[]; x: number };
    const groups: Group[] = [];
    for (const p of onScreen) {
      const x = cx(cam, p.day ?? 0);
      const last = groups[groups.length - 1];
      const isSpan = p.endDay !== undefined;
      const lastSpan = last?.members.some((m) => m.endDay !== undefined);
      if (last && !isSpan && !lastSpan && x - last.x < 26) {
        last.members.push(p);
      } else {
        groups.push({ members: [p], x });
      }
    }

    const reserve = reserveFor(laneIndex);
    const usable = lane.bottom - lane.top - reserve - 4;
    const nRows = Math.max(1, Math.floor(usable / rowH));
    const order: number[] = [];
    const mid = Math.floor((nRows - 1) / 2);
    order.push(mid);
    for (let k = 1; order.length < nRows; k++) {
      if (mid - k >= 0) order.push(mid - k);
      if (mid + k < nRows && order.length < nRows) order.push(mid + k);
    }
    const occupied: [number, number][][] = Array.from({ length: nRows }, () => []);
    // Second label lines hang below their row; circles poke above theirs.
    const lines2: [number, number][][] = Array.from({ length: nRows }, () => []);
    const discs: [number, number][][] = Array.from({ length: nRows }, () => []);
    const used = nRows * rowH;
    const y0 = lane.top + reserve + (usable - used) / 2;
    const rowY = (row: number) => y0 + (row + 0.5) * rowH;
    const clear = (list: [number, number][] | undefined, a: number, b: number) => !list || list.every(([x1, x2]) => b < x1 || a > x2);
    // A row is blocked where floating chrome sits over its band.
    const chromeClear = (row: number, a: number, b: number) => {
      const y = rowY(row);
      const yA = y - 20;
      const yB = y + (twoLine ? 34 : 14);
      return keepOut.every((k) => b < k.x1 || a > k.x2 || yB < k.y1 || yA > k.y2);
    };
    let disc: [number, number] | null = null;
    let line2: [number, number] | null = null;
    const free = (row: number, a: number, b: number) =>
      chromeClear(row, a, b) &&
      clear(occupied[row], a, b) &&
      (!disc || clear(lines2[row - 1], disc[0], disc[1])) &&
      (!line2 || clear(discs[row + 1], line2[0], line2[1]));
    const take = (row: number, a: number, b: number) => {
      occupied[row].push([a, b]);
      if (disc) discs[row].push(disc);
      if (line2) lines2[row].push(line2);
    };
    const firstFree = (a: number, b: number) => order.find((row) => free(row, a, b));
    // When a lane is truly full, take the row where the overlap is smallest,
    // counting chrome as a heavy overlap so labels slide out from under it.
    const overlap = (row: number, a: number, b: number) =>
      occupied[row].reduce((sum, [x1, x2]) => sum + Math.max(0, Math.min(b, x2) - Math.max(a, x1)), 0) + (chromeClear(row, a, b) ? 0 : 400);
    const leastOverlap = (a: number, b: number) =>
      order.reduce((best, row) => (overlap(row, a, b) < overlap(best, a, b) ? row : best), order[0]);

    for (const g of groups) {
      if (g.members.length > 1) {
        const key = g.members.map((m) => m.id).join("+");
        const r = 16;
        const labelW = textW(`${g.members.length} projects`, 13) + 70;
        disc = [g.x - r - 12, g.x + r + 12];
        line2 = null;
        // Near the right edge the label sits on the left of the stack.
        const flip = g.x + r + 10 + labelW > size.w - 12;
        const a = flip ? g.x - r - 10 - labelW : g.x - r - 10;
        const b = flip ? g.x + r + 10 : g.x + r + 10 + labelW;
        const row = firstFree(a, b);
        if (row !== undefined) {
          take(row, a, b);
          items.push({ type: "cluster", key, members: g.members, x: g.x, y: rowY(row), r, labelW, bare: false, flip, lane: lane.id });
          continue;
        }
        // No room for the words: the stack alone, with its count badge.
        const d0 = g.x - r - 6;
        const d1 = g.x + r + 6;
        const bareRow = firstFree(d0, d1) ?? leastOverlap(d0, d1);
        take(bareRow, d0, d1);
        items.push({ type: "cluster", key, members: g.members, x: g.x, y: rowY(bareRow), r, labelW: 0, bare: true, flip, lane: lane.id });
        continue;
      }
      const p = g.members[0];
      const tag = tags?.get(p.id);
      if (p.endDay !== undefined) {
        const x1 = sx(cam, p.day ?? 0);
        const x2 = sx(cam, p.endDay + 1);
        const bleed = x2 > size.w - 8;
        // A span that runs past the right edge fades out there and says where
        // it ends ("→ 21 Dec"). Its label sits inside the visible part when
        // that has room, otherwise just before the span starts.
        const labelW = textW(p.name, 13) + 16 + textW(fmtUntil(p.day ?? 0), 12) + (bleed ? 64 : 0);
        const visible = Math.min(x2, size.w) - x1;
        const flipLabel = bleed && visible < labelW + 56;
        const labelInside = !flipLabel && (visible > labelW + 24 || bleed);
        disc = null;
        const belowW = 280 + (tag ? textW(tag, 11.5) + 26 : 0);
        let span: [number, number];
        if (flipLabel) {
          const reach = Math.max(labelW, twoLine ? belowW : 0) + 14;
          line2 = twoLine ? [x1 - reach, x1] : null;
          span = [x1 - reach, size.w];
        } else {
          line2 = twoLine ? [x1, x1 + belowW] : null;
          const b = labelInside ? x2 + 8 : x2 + 12 + labelW;
          span = [x1 - 6, Math.max(b, twoLine ? x1 + belowW : b)];
        }
        const row = firstFree(span[0], span[1]);
        if (row === undefined && bleed) {
          // No row can take its label: it waits in the lane's "later" chip.
          later(p);
          continue;
        }
        const at = row ?? firstFree(x1 - 6, x2 + 8) ?? leastOverlap(span[0], span[1]);
        take(at, span[0], span[1]);
        items.push({ type: "pill", p, x1, x2, y: rowY(at), h: 30, labelInside, labelW, bleed, flipLabel, lane: lane.id });
        continue;
      }
      const r = radiusFor(p.open);
      const dotW = lens === "health" ? 0 : 16;
      const labelW = labelWidth(p, level, tag) + dotW;
      // Only big circles reach into the row above.
      disc = r > 19 ? [g.x - r - 4, g.x + r + 4] : null;
      const right: [number, number] = [g.x - r - 6, g.x + r + 10 + labelW];
      const left: [number, number] = [g.x - r - 14 - labelW, g.x + r + 6];
      const nearEdge = right[1] > size.w - 12;
      const canLeft = left[0] > 0;
      const tries: { span: [number, number]; flip: boolean; compact: boolean }[] = nearEdge
        ? [
            { span: left, flip: true, compact: false },
            { span: right, flip: false, compact: false },
          ]
        : [
            { span: right, flip: false, compact: false },
            ...(canLeft ? [{ span: left, flip: true, compact: false }] : []),
          ];
      const shortW = Math.min(labelW, textW(p.short, 13) + 22 + dotW + textW(fmtUntil(p.day ?? 0), 12));
      tries.push({ span: [g.x - r - 6, g.x + r + 10 + shortW], flip: false, compact: true });
      if (canLeft) tries.push({ span: [g.x - r - 14 - shortW, g.x + r + 6], flip: true, compact: true });
      let placed = false;
      for (const t of tries) {
        line2 = twoLine && !t.compact ? (t.flip ? [t.span[0], g.x - r] : [g.x + r, t.span[1]]) : null;
        const row = firstFree(t.span[0], t.span[1]);
        if (row === undefined) continue;
        take(row, t.span[0], t.span[1]);
        items.push({ type: "node", p, x: g.x, y: rowY(row), r, labelW: t.compact ? shortW : labelW, compact: t.compact, bare: false, flip: t.flip, lane: lane.id });
        placed = true;
        break;
      }
      if (!placed) {
        // Nowhere for a label to go without covering another: the disc alone
        // (named on hover, focus and to screen readers). Near the right edge a
        // lone disc says too little, so it joins that lane's "later" chip.
        line2 = null;
        disc = null;
        if (nearEdge) {
          later(p);
          continue;
        }
        const span: [number, number] = [g.x - r - 6, g.x + r + 6];
        const best = firstFree(span[0], span[1]) ?? leastOverlap(span[0], span[1]);
        take(best, span[0], span[1]);
        items.push({ type: "node", p, x: g.x, y: rowY(best), r, labelW: 0, compact: true, bare: true, flip: false, lane: lane.id });
      }
    }
  });
  return { lanes, items, level, offRight, offLeft, lanesBottom };
}

/** Screen centre for a project, clusters included. */
export function anchorOf(items: Placed[], id: string): { x: number; y: number } | null {
  for (const it of items) {
    if (it.type === "node" && it.p.id === id) return { x: it.x, y: it.y };
    if (it.type === "pill" && it.p.id === id) return { x: it.x1, y: it.y };
    if (it.type === "cluster" && it.members.some((m) => m.id === id)) return { x: it.x, y: it.y };
  }
  return null;
}

/** Approximate label boxes, for keeping transient tags off them. */
export function labelRects(items: Placed[], level: Level): (Rect & { id: string })[] {
  const h = level === "far" ? 22 : 44;
  return items.map((it) => {
    if (it.type === "node") {
      if (it.bare) return { id: it.p.id, x1: it.x - it.r, x2: it.x + it.r, y1: it.y - it.r, y2: it.y + it.r };
      const x1 = it.flip ? it.x - it.r - 8 - it.labelW : it.x - it.r;
      const x2 = it.flip ? it.x + it.r : it.x + it.r + 8 + it.labelW;
      return { id: it.p.id, x1, x2, y1: it.y - it.r, y2: it.y - 11 + h };
    }
    if (it.type === "pill")
      return { id: it.p.id, x1: it.flipLabel ? it.x1 - it.labelW - 14 : it.x1, x2: Math.max(it.x2, it.x1 + 260), y1: it.y - it.h / 2, y2: it.y + it.h / 2 + (level === "far" ? 0 : 24) };
    if (it.bare) return { id: it.key, x1: it.x - it.r, x2: it.x + it.r, y1: it.y - it.r, y2: it.y + it.r };
    return { id: it.key, x1: it.flip ? it.x - it.r - 10 - it.labelW : it.x - it.r, x2: it.flip ? it.x + it.r : it.x + it.r + 10 + it.labelW, y1: it.y - it.r, y2: it.y + it.r };
  });
}
