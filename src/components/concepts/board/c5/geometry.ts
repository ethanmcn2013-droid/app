import { NOTE, STAGES, STAGE_INDEX, TODAY, type Note, type StageKey, type Tone, type Wall, type Zone } from "./data";

export type Rect = { x: number; y: number; w: number; h: number };
export type Mode = "wall" | "tidy";

/* ── Tidy layout: the wall as strict columns ─────────────────────────── */

export const COL_W = 272;
export const COL_GAP = 24;
export const CARD_W = 248;
export const CARD_H = 100;
export const CARD_GAP = 8;
const COL_TOP = 40;
const COL_HEAD = 76;
const GROUP_HEAD = 34;

export type TidyHead = { key: string; label: string; tone: Tone | null; x: number; y: number; count: number };
export type TidyLayout = { notes: Record<string, Rect>; zones: Record<StageKey, Rect>; heads: TidyHead[] };

export function tidyLayout(wall: Wall): TidyLayout {
  const notes: Record<string, Rect> = {};
  const heads: TidyHead[] = [];
  const zoneRects = {} as Record<StageKey, Rect>;
  let tallest = 560;
  const heights: number[] = [];

  STAGES.forEach((stage, i) => {
    const colX = 40 + i * (COL_W + COL_GAP);
    const inStage = wall.notes.filter((n) => n.stage === stage.key);
    const groups = groupsFor(wall, inStage);
    let y = COL_TOP + COL_HEAD;
    const showHeads = groups.length > 1 || (groups.length === 1 && groups[0].clusterId !== null);
    for (const g of groups) {
      if (showHeads) {
        const cluster = wall.clusters.find((c) => c.id === g.clusterId);
        heads.push({
          key: `${stage.key}-${g.clusterId ?? "loose"}`,
          label: cluster ? cluster.name || "Unnamed group" : "Not grouped",
          tone: cluster ? cluster.tone : null,
          x: colX + 12,
          y,
          count: g.notes.length,
        });
        y += GROUP_HEAD;
      }
      for (const n of g.notes) {
        notes[n.id] = { x: colX + (COL_W - CARD_W) / 2, y, w: CARD_W, h: CARD_H };
        y += CARD_H + CARD_GAP;
      }
      y += 10;
    }
    heights.push(y - COL_TOP + 16);
    tallest = Math.max(tallest, y - COL_TOP + 16);
  });
  STAGES.forEach((stage, i) => {
    zoneRects[stage.key] = { x: 40 + i * (COL_W + COL_GAP), y: COL_TOP, w: COL_W, h: tallest };
  });
  return { notes, zones: zoneRects, heads };
}

type Group = { clusterId: string | null; notes: Note[] };

function groupsFor(wall: Wall, inStage: Note[]): Group[] {
  const byCluster = new Map<string | null, Note[]>();
  for (const n of [...inStage].sort(readingSort)) {
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

/** Tab order: stage by stage, then top to bottom, left to right. */
export function readingOrder(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => STAGE_INDEX[a.stage] - STAGE_INDEX[b.stage] || readingSort(a, b));
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

export function stageAt(x: number, y: number, zones: Zone[]): StageKey | null {
  const z = zones.find((zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h);
  return z ? z.stage : null;
}

export function freeSpot(zone: Zone, notes: Note[], exclude: Set<string>): { x: number; y: number } {
  const others = notes.filter((n) => !exclude.has(n.id)).map(noteRect);
  for (let y = zone.y + 84; y + NOTE <= zone.y + zone.h - 12; y += 28) {
    for (let x = zone.x + 24; x + NOTE <= zone.x + zone.w - 12; x += 28) {
      const r = { x, y, w: NOTE, h: NOTE };
      if (others.every((o) => gap(o, r) >= 20)) return { x, y };
    }
  }
  return { x: zone.x + zone.w / 2 - NOTE / 2 + (notes.length % 5) * 8, y: zone.y + zone.h / 2 - NOTE / 2 };
}

export function wallBounds(wall: Wall): Rect {
  const rects: Rect[] = [...wall.zones.map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h })), ...wall.notes.map(noteRect)];
  const u = union(rects, 40);
  return { x: Math.min(0, u.x), y: Math.min(0, u.y), w: Math.max(u.x + u.w, 2428), h: Math.max(u.y + u.h, 980) };
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
