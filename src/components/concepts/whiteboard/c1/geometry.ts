import { NOTE, STAGES, TODAY, type Note, type Tone, type TidyTemplate, type Wall } from "./data";

export type Rect = { x: number; y: number; w: number; h: number };
export type Mode = "wall" | "tidy";

/* ── Tidy layout: the wall as strict columns, from a template ───────── */

export const COL_W = 272;
export const COL_GAP = 24;
export const CARD_W = 248;
export const CARD_H = 100;
export const CARD_GAP = 8;
const COL_TOP = 40;
const COL_HEAD = 76;
const GROUP_HEAD = 34;

export const LOOSE = "loose";

export type TidyHead = { key: string; label: string; tone: Tone | null; x: number; y: number; count: number };
export type TidyColumn = { key: string; name: string; hint: string; tone: Tone | null; stage?: string; rect: Rect; count: number };
export type TidyLayout = { notes: Record<string, Rect>; cols: TidyColumn[]; heads: TidyHead[] };

/** Which column a note belongs to under a template. */
export function columnOf(wall: Wall, n: Note, template: TidyTemplate): string {
  if (template === "stages") return n.stage;
  return n.clusterId && wall.clusters.some((c) => c.id === n.clusterId) ? n.clusterId : LOOSE;
}

/** The columns a template makes from this wall, left to right. */
export function columnsFor(wall: Wall, template: TidyTemplate): Omit<TidyColumn, "rect" | "count">[] {
  if (template === "stages") return STAGES.map((st) => ({ key: st.key, name: st.name, hint: st.hint, tone: null, stage: st.key }));
  const groups = clustersInReadingOrder(wall).map((c) => ({
    key: c.id,
    name: c.name || "Unnamed group",
    hint: "Drag a note here to add it to this group",
    tone: c.tone,
  }));
  return [...groups, { key: LOOSE, name: "Not grouped", hint: "Drag a note here to take it out of its group", tone: null }];
}

/** Narrowest a column gets before Tidy zooms out instead. */
export const COL_MIN = 148;
const EDGE = 24;
const GAP_FIT = 12;

/**
 * Column width that fits every column across `width` (the viewport, at 100%),
 * between COL_MIN and COL_W. Below the minimum the view zooms out to fit.
 */
export function tidyColumnWidth(count: number, width?: number) {
  if (!width) return COL_W;
  const w = Math.floor((width - EDGE * 2 - (count - 1) * GAP_FIT) / Math.max(1, count));
  return clamp(w, COL_MIN, COL_W);
}

export function tidyLayout(wall: Wall, template: TidyTemplate, width?: number): TidyLayout {
  const notes: Record<string, Rect> = {};
  const heads: TidyHead[] = [];
  const defs = columnsFor(wall, template);
  const colW = tidyColumnWidth(defs.length, width);
  const gapX = width ? GAP_FIT : COL_GAP;
  const left = width ? EDGE : 40;
  const cardW = colW - (width ? 16 : COL_W - CARD_W);
  let tallest = 560;

  defs.forEach((col, i) => {
    const colX = left + i * (colW + gapX);
    const inCol = wall.notes.filter((n) => columnOf(wall, n, template) === col.key);
    // Planning columns keep the wall's groups as sub-headings; group columns need none.
    const groups: Group[] = template === "stages" ? groupsFor(wall, inCol) : [{ clusterId: null, notes: [...inCol].sort(readingSort) }];
    let y = COL_TOP + COL_HEAD;
    const showHeads = template === "stages" && (groups.length > 1 || (groups.length === 1 && groups[0].clusterId !== null));
    for (const g of groups) {
      if (showHeads) {
        const cluster = wall.clusters.find((c) => c.id === g.clusterId);
        heads.push({
          key: `${col.key}-${g.clusterId ?? LOOSE}`,
          label: cluster ? cluster.name || "Unnamed group" : "Not grouped",
          tone: cluster ? cluster.tone : null,
          x: colX + 10,
          y,
          count: g.notes.length,
        });
        y += GROUP_HEAD;
      }
      for (const n of g.notes) {
        notes[n.id] = { x: colX + (colW - cardW) / 2, y, w: cardW, h: CARD_H };
        y += CARD_H + CARD_GAP;
      }
      y += 10;
    }
    tallest = Math.max(tallest, y - COL_TOP + 16);
  });
  const cols: TidyColumn[] = defs.map((col, i) => ({
    ...col,
    rect: { x: left + i * (colW + gapX), y: COL_TOP, w: colW, h: tallest },
    count: wall.notes.filter((n) => columnOf(wall, n, template) === col.key).length,
  }));
  return { notes, cols, heads };
}

type Group = { clusterId: string | null; notes: Note[] };

function groupsFor(wall: Wall, inCol: Note[]): Group[] {
  const byCluster = new Map<string | null, Note[]>();
  for (const n of [...inCol].sort(readingSort)) {
    const key = n.clusterId && wall.clusters.some((c) => c.id === n.clusterId) ? n.clusterId : null;
    const list = byCluster.get(key) ?? [];
    list.push(n);
    byCluster.set(key, list);
  }
  const groups: Group[] = [];
  for (const [clusterId, list] of byCluster) if (clusterId !== null) groups.push({ clusterId, notes: list });
  groups.sort((a, b) => Math.min(...a.notes.map((n) => n.y)) - Math.min(...b.notes.map((n) => n.y)));
  const loose = byCluster.get(null);
  if (loose) groups.push({ clusterId: null, notes: loose });
  return groups;
}

export function readingSort(a: Note, b: Note) {
  const rowA = Math.round(a.y / 90);
  const rowB = Math.round(b.y / 90);
  return rowA - rowB || a.x - b.x;
}

/** Groups by where they start on the wall: top band first, then left to right. */
export function clustersInReadingOrder(wall: Wall) {
  const top = (id: string) => {
    const m = wall.notes.filter((n) => n.clusterId === id);
    return m.length ? { x: Math.min(...m.map((n) => n.x)), y: Math.min(...m.map((n) => n.y)) } : { x: Infinity, y: Infinity };
  };
  return [...wall.clusters]
    .filter((c) => wall.notes.some((n) => n.clusterId === c.id))
    .sort((a, b) => {
      const ta = top(a.id);
      const tb = top(b.id);
      return Math.round(ta.y / 300) - Math.round(tb.y / 300) || ta.x - tb.x;
    });
}

/** Tab order on the freeform wall: group by group, then the loose notes, each top to bottom, left to right. */
export function readingOrder(wall: Wall): Note[] {
  const rank = new Map(clustersInReadingOrder(wall).map((c, i) => [c.id, i]));
  const r = (n: Note) => (n.clusterId && rank.has(n.clusterId) ? rank.get(n.clusterId)! : rank.size);
  return [...wall.notes].sort((a, b) => r(a) - r(b) || readingSort(a, b));
}

/* ── Wall geometry ──────────────────────────────────────────────────── */

export function noteRect(n: Note): Rect {
  return { x: n.x, y: n.y, w: NOTE, h: NOTE };
}

export function gap(a: Rect, b: Rect) {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

export function union(rects: Rect[], pad = 0): Rect {
  const x1 = Math.min(...rects.map((r) => r.x)) - pad;
  const y1 = Math.min(...rects.map((r) => r.y)) - pad;
  const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
  const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * The nearest open spot to (x, y) where a note keeps clear of every other
 * note by at least `clear`, searched in widening rings.
 */
export function freeSpotNear(wall: Wall, x: number, y: number, exclude: Set<string>, clear = 24): { x: number; y: number } {
  const others = obstacles(wall, exclude);
  const ok = (px: number, py: number) => others.every((o) => gap(o, { x: px, y: py, w: NOTE, h: NOTE }) >= clear);
  if (ok(x, y)) return { x, y };
  for (let ring = 1; ring <= 40; ring++) {
    const d = ring * 28;
    for (let i = 0; i < ring * 8; i++) {
      const t = (i / (ring * 8)) * Math.PI * 2;
      const px = Math.round(x + Math.cos(t) * d);
      const py = Math.round(y + Math.sin(t) * d);
      if (py >= 20 && px >= 20 && ok(px, py)) return { x: px, y: py };
    }
  }
  return { x: x + 40, y: y + 40 };
}

/** A spot beside a group, so a note that joins it sits with the others. */
export function spotBesideGroup(wall: Wall, clusterId: string, exclude: Set<string>): { x: number; y: number } | null {
  const members = wall.notes.filter((n) => n.clusterId === clusterId && !exclude.has(n.id));
  if (!members.length) return null;
  const others = obstacles(wall, exclude);
  const step = NOTE + 18;
  const tries: { x: number; y: number }[] = [];
  for (const m of [...members].sort(readingSort)) {
    tries.push({ x: m.x + step, y: m.y }, { x: m.x, y: m.y + step }, { x: m.x - step, y: m.y }, { x: m.x, y: m.y - step });
  }
  const cx = members.reduce((t, m) => t + m.x, 0) / members.length;
  const cy = members.reduce((t, m) => t + m.y, 0) / members.length;
  // Stay out of every other group's frame, so two groups never overlap.
  const frames = wall.clusters
    .filter((c) => c.id !== clusterId)
    .map((c) => wall.notes.filter((n) => n.clusterId === c.id && !exclude.has(n.id)).map(noteRect))
    .filter((r) => r.length >= 2)
    .map((r) => union(r, 14));
  const open = tries
    .filter((t) => t.x >= 20 && t.y >= 20)
    .filter((t) => others.every((o) => gap(o, { ...t, w: NOTE, h: NOTE }) >= 12))
    .filter((t) => frames.every((f) => gap(f, { ...t, w: NOTE, h: NOTE }) >= 16))
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  if (open[0]) return open[0];
  // Hemmed in on every side: widen out from the group until there is room.
  const fits = (x: number, y: number) => {
    const r = { x, y, w: NOTE, h: NOTE };
    return x >= 20 && y >= 20 && others.every((o) => gap(o, r) >= 12) && frames.every((f) => gap(f, r) >= 16);
  };
  for (let ring = 1; ring <= 40; ring++) {
    const d = ring * 32;
    for (let i = 0; i < ring * 8; i++) {
      const t = (i / (ring * 8)) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(t) * d);
      const y = Math.round(cy + Math.sin(t) * d);
      if (fits(x, y)) return { x, y };
    }
  }
  return null;
}

/** Handwritten labels take up room too, so a placed note never covers one. */
export function scribbleRect(sc: Wall["scribbles"][number]): Rect {
  return { x: sc.x, y: sc.y, w: Math.max(120, sc.text.length * 9), h: 32 };
}

function obstacles(wall: Wall, exclude: Set<string>): Rect[] {
  return [...wall.notes.filter((n) => !exclude.has(n.id)).map(noteRect), ...wall.scribbles.map(scribbleRect)];
}

/** Everything people put on the wall, labels and group names included: what Open frames. */
export function contentRect(wall: Wall, pad = 24): Rect | null {
  const rects: Rect[] = [...wall.notes.map(noteRect), ...wall.scribbles.map(scribbleRect)];
  if (!rects.length) return null;
  const u = union(rects, pad);
  // A group's name and outline sit above its top notes.
  return { x: u.x, y: u.y - 24, w: u.w, h: u.h + 24 };
}

export function wallBounds(wall: Wall): Rect {
  const rects: Rect[] = [
    ...wall.notes.map(noteRect),
    ...wall.scribbles.map(scribbleRect),
  ];
  if (!rects.length) return { x: 0, y: 0, w: 1600, h: 900 };
  const u = union(rects, 80);
  return { x: 0, y: 0, w: Math.max(u.x + u.w, 1600), h: Math.max(u.y + u.h, 900) };
}

/* Snap a rect edge to an anchor on the border facing the other rect. */
export function connectorPath(a: Rect, b: Rect) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  const horizontal = Math.abs(dx) * (a.h / a.w) > Math.abs(dy);
  let p1: { x: number; y: number };
  let p2: { x: number; y: number };
  let c1: { x: number; y: number };
  let c2: { x: number; y: number };
  if (horizontal) {
    const s = Math.sign(dx) || 1;
    p1 = { x: ac.x + (s * a.w) / 2, y: ac.y };
    p2 = { x: bc.x - (s * b.w) / 2 - s * 6, y: bc.y };
    const k = Math.max(40, Math.abs(p2.x - p1.x) / 2);
    c1 = { x: p1.x + s * k, y: p1.y };
    c2 = { x: p2.x - s * k, y: p2.y };
  } else {
    const s = Math.sign(dy) || 1;
    p1 = { x: ac.x, y: ac.y + (s * a.h) / 2 };
    p2 = { x: bc.x, y: bc.y - (s * b.h) / 2 - s * 6 };
    const k = Math.max(40, Math.abs(p2.y - p1.y) / 2);
    c1 = { x: p1.x, y: p1.y + s * k };
    c2 = { x: p2.x, y: p2.y - s * k };
  }
  const mid = bezierPoint(p1, c1, c2, p2, 0.5);
  return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, mid, end: p2, p1 };
}

function bezierPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}
type Pt = { x: number; y: number };

/* ── Dates ──────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysFromToday(iso: string) {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / DAY);
}

export function shortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type DueInfo = { label: string; long: string; state: "late" | "today" | "soon" | "later" };

export function dueInfo(iso: string, done: boolean): DueInfo {
  const n = daysFromToday(iso);
  const long = shortDate(iso);
  if (!done && n < 0) return { label: n === -1 ? "1 day late" : `${-n} days late`, long, state: "late" };
  if (n === 0) return { label: "Today", long, state: "today" };
  if (n === 1) return { label: "Tomorrow", long, state: "soon" };
  if (n > 1 && n < 7) return { label: WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()], long, state: "soon" };
  return { label: long, long, state: "later" };
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
