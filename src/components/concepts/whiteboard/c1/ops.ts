import { NOTE, type Cluster, type Note, type StageKey, type Tone, type Wall } from "./data";
import { LOOSE, freeSpotNear, gap, noteRect, readingSort, scribbleRect, spotBesideGroup, union, type Rect } from "./geometry";

/** One note and its gutter: groups sit on this grid. */
export const STEP = NOTE + 18;
/** The group frame's padding, and the room its name takes above it. */
export const FRAME_PAD = 14;
export const LABEL_H = 28;

/** A group's frame with room for its name above, so nothing lands on the label. */
export function frameOf(rects: Rect[]): Rect {
  const r = union(rects, FRAME_PAD);
  return { x: r.x, y: r.y - LABEL_H / 2, w: r.w, h: r.h + LABEL_H / 2 };
}

/**
 * Lay a group out as a tidy grid, so notes dropped on each other never
 * stack. It keeps the group's corner (`anchor`, or its top-left note) and,
 * where it can, its number of columns; it widens or narrows when that would
 * run into another note, a label or another group. Order is reading order,
 * so a note dropped between two others lands between them.
 */
export function layoutGroup(wall: Wall, clusterId: string, anchor?: { x: number; y: number }): Wall {
  const members = wall.notes.filter((n) => n.clusterId === clusterId).sort(readingSort);
  const n = members.length;
  if (n < 2) return wall;
  const ids = new Set(members.map((m) => m.id));
  const ax = Math.round(anchor?.x ?? Math.min(...members.map((m) => m.x)));
  const ay = Math.round(anchor?.y ?? Math.min(...members.map((m) => m.y)));
  let x0 = ax;
  let y0 = ay;
  // Hard: labels and grouped notes never move. Soft: a loose note may step aside.
  const blockers: Rect[] = [
    ...wall.notes.filter((m) => !ids.has(m.id) && m.clusterId).map(noteRect),
    ...wall.scribbles.map(scribbleRect),
  ];
  const loose: Rect[] = wall.notes.filter((m) => !ids.has(m.id) && !m.clusterId).map(noteRect);
  const frames = wall.clusters
    .filter((c) => c.id !== clusterId)
    .map((c) => wall.notes.filter((m) => m.clusterId === c.id && !ids.has(m.id)).map(noteRect))
    .filter((r) => r.length >= 2)
    .map(frameOf);
  const frameFor = (cols: number): Rect => {
    const rows = Math.ceil(n / cols);
    return frameOf([{ x: x0, y: y0, w: cols * STEP - 18, h: rows * STEP - 18 }]);
  };
  const fits = (cols: number, soft: boolean) => {
    const f = frameFor(cols);
    return (
      blockers.every((b) => gap(b, f) >= 8) &&
      frames.every((g) => gap(g, f) >= 16) &&
      (!soft || loose.every((b) => gap(b, f) >= 8))
    );
  };
  const clear = (cols: number) => fits(cols, true);
  // The columns it has now: distinct x positions on the grid.
  const now = new Set(members.map((m) => Math.round((m.x - x0) / STEP))).size;
  // A group is a compact grid, two or three across (four once it is large), and
  // never a single column: a column of five runs off the foot of the screen.
  const compact = n <= 4 ? 2 : 3;
  const preferred = now >= 2 && now <= 4 && Math.ceil(n / now) <= Math.max(2, now) ? Math.min(n, now) : Math.min(n, compact);
  const order = [preferred, ...[compact, 2, 3, 4].filter((c, i, all) => c !== preferred && c <= n && all.indexOf(c) === i)];
  let cols = order.find(clear);
  // Nearly room: stay put and let a loose note or two step aside, rather than move the group away.
  if (cols === undefined) cols = order.find((c) => fits(c, false));
  // No room at its corner: look outward, nearest first, for a spot where the whole grid fits.
  for (let ring = 1; cols === undefined && ring <= 14; ring++) {
    const d = ring * 46;
    for (let i = 0; i < ring * 8 && cols === undefined; i++) {
      const a = (i / (ring * 8)) * Math.PI * 2;
      x0 = Math.round(ax + Math.cos(a) * d);
      y0 = Math.round(ay + Math.sin(a) * d);
      if (x0 < 20 || y0 < 40) continue;
      cols = order.find(clear) ?? order.find((c) => fits(c, false));
    }
  }
  if (cols === undefined) {
    x0 = ax;
    y0 = ay;
    cols = preferred;
  }
  const spot = new Map(members.map((m, i) => [m.id, { x: x0 + (i % cols) * STEP, y: y0 + Math.floor(i / cols) * STEP }]));
  let next: Wall = { ...wall, notes: wall.notes.map((m) => (spot.has(m.id) ? { ...m, ...spot.get(m.id)! } : m)) };
  if (!clear(cols)) {
    // Hemmed in: step loose notes out of the new frame rather than stack on them.
    const f = frameFor(cols);
    for (const m of next.notes) {
      if (ids.has(m.id) || m.clusterId || gap(noteRect(m), f) >= 8) continue;
      const to = freeSpotNear(next, f.x + f.w + 24, m.y, new Set([m.id]), 24);
      next = { ...next, notes: next.notes.map((x) => (x.id === m.id ? { ...x, ...to } : x)) };
    }
  }
  return next;
}

/** Group the selected notes into a new group, laid out as a grid where the selection began. */
export function groupNotes(wall: Wall, ids: string[]): { wall: Wall; clusterId: string } | null {
  const picked = wall.notes.filter((n) => ids.includes(n.id));
  if (picked.length < 2) return null;
  const first = picked[0].clusterId;
  if (first && picked.every((n) => n.clusterId === first) && wall.notes.filter((n) => n.clusterId === first).length === picked.length) return null;
  const lead = [...picked].sort(readingSort)[0];
  const cluster: Cluster = { id: uid("c"), name: "", tone: lead.tone };
  const anchor = { x: Math.min(...picked.map((n) => n.x)), y: Math.min(...picked.map((n) => n.y)) };
  const set = new Set(ids);
  const next = dissolve({
    ...wall,
    clusters: [...wall.clusters, cluster],
    notes: wall.notes.map((n) => (set.has(n.id) ? { ...n, clusterId: cluster.id } : n)),
  });
  return { wall: layoutGroup(next, cluster.id, anchor), clusterId: cluster.id };
}

export const JOIN_GAP = 30;

export type ClusterTarget = { kind: "join"; clusterId: string } | { kind: "new"; withId: string } | null;

/** Where a single note would land, group-wise, if dropped at (x, y). */
export function clusterTarget(wall: Wall, id: string, x: number, y: number): ClusterTarget {
  const me = wall.notes.find((n) => n.id === id);
  if (!me) return null;
  const r = { x, y, w: NOTE, h: NOTE };
  let best: Note | null = null;
  let bestGap = Infinity;
  for (const n of wall.notes) {
    if (n.id === id) continue;
    const g = gap(r, noteRect(n));
    if (g <= JOIN_GAP && g < bestGap) {
      best = n;
      bestGap = g;
    }
  }
  if (!best) return null;
  const valid = best.clusterId && wall.clusters.some((c) => c.id === best.clusterId);
  if (valid) return best.clusterId === me.clusterId ? null : { kind: "join", clusterId: best.clusterId! };
  return { kind: "new", withId: best.id };
}

function dissolve(wall: Wall): Wall {
  const counts = new Map<string, number>();
  for (const n of wall.notes) if (n.clusterId) counts.set(n.clusterId, (counts.get(n.clusterId) ?? 0) + 1);
  const alive = wall.clusters.filter((c) => (counts.get(c.id) ?? 0) >= 2);
  const aliveIds = new Set(alive.map((c) => c.id));
  return {
    ...wall,
    clusters: alive,
    notes: wall.notes.map((n) => (n.clusterId && !aliveIds.has(n.clusterId) ? { ...n, clusterId: undefined } : n)),
  };
}

let seq = 0;
export function uid(prefix: string) {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export type DropResult = { wall: Wall; freshCluster: string | null };

/** On the freeform wall a drop only moves notes, and may group or ungroup one. */
export function dropNotes(wall: Wall, ids: string[], dx: number, dy: number): DropResult {
  const set = new Set(ids);
  let next: Wall = {
    ...wall,
    notes: wall.notes.map((n) => (set.has(n.id) ? { ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) } : n)),
  };
  let freshCluster: string | null = null;
  if (ids.length === 1) {
    const id = ids[0];
    const me = next.notes.find((n) => n.id === id)!;
    const target = clusterTarget(next, id, me.x, me.y);
    if (target?.kind === "join") {
      // The group keeps its corner; the dropped note takes its place in the grid.
      const stay = next.notes.filter((n) => n.clusterId === target.clusterId);
      const anchor = { x: Math.min(...stay.map((n) => n.x)), y: Math.min(...stay.map((n) => n.y)) };
      next = { ...next, notes: next.notes.map((n) => (n.id === id ? { ...n, clusterId: target.clusterId } : n)) };
      next = layoutGroup(dissolve(next), target.clusterId, anchor);
    } else if (target?.kind === "new") {
      const other = next.notes.find((n) => n.id === target.withId)!;
      const cluster: Cluster = { id: uid("c"), name: "", tone: other.tone };
      freshCluster = cluster.id;
      next = {
        ...next,
        clusters: [...next.clusters, cluster],
        notes: next.notes.map((n) => (n.id === id || n.id === other.id ? { ...n, clusterId: cluster.id } : n)),
      };
      // Side by side from the note it was dropped on, never stacked on top of it.
      next = layoutGroup(dissolve(next), cluster.id, { x: Math.min(other.x, me.x), y: other.y });
    } else if (me.clusterId) {
      const stillNear = next.notes.some((n) => n.id !== id && n.clusterId === me.clusterId && gap(noteRect(n), noteRect(me)) <= JOIN_GAP);
      if (!stillNear) next = { ...next, notes: next.notes.map((n) => (n.id === id ? { ...n, clusterId: undefined } : n)) };
    }
  }
  return { wall: dissolve(next), freshCluster };
}

/** Stage is a note detail: changing it never moves the note on the wall. */
export function setStage(wall: Wall, id: string, stage: StageKey): Wall {
  return patchNote(wall, id, { stage });
}

/**
 * Move a note into a group (or out of one, with LOOSE). On the wall it
 * settles beside its new group, or steps clear of its old one.
 */
export function moveToGroup(wall: Wall, id: string, groupKey: string): Wall {
  const me = wall.notes.find((n) => n.id === id);
  if (!me) return wall;
  const clusterId = groupKey === LOOSE ? undefined : groupKey;
  if ((me.clusterId ?? undefined) === clusterId) return wall;
  const skip = new Set([id]);
  let spot: { x: number; y: number };
  if (clusterId) spot = spotBesideGroup(wall, clusterId, skip) ?? freeSpotNear(wall, me.x, me.y, skip);
  else {
    // Clear of every note by more than the join distance, so it stays loose.
    spot = freeSpotNear(wall, me.x, me.y, skip, JOIN_GAP + 40);
  }
  return dissolve({
    ...wall,
    notes: wall.notes.map((n) => (n.id === id ? { ...n, clusterId, x: spot.x, y: spot.y } : n)),
  });
}

export function nudge(wall: Wall, ids: string[], dx: number, dy: number): Wall {
  const set = new Set(ids);
  return { ...wall, notes: wall.notes.map((n) => (set.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
}

export function removeNotes(wall: Wall, ids: string[]): Wall {
  const set = new Set(ids);
  return dissolve({
    ...wall,
    notes: wall.notes.filter((n) => !set.has(n.id)),
    connectors: wall.connectors.filter((k) => !set.has(k.from) && !set.has(k.to)),
  });
}

export function patchNote(wall: Wall, id: string, patch: Partial<Note>): Wall {
  return { ...wall, notes: wall.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function createNote(wall: Wall, x: number, y: number, tone: Tone, title = "", stage: StageKey = "ideas"): { wall: Wall; id: string } {
  const id = uid("n");
  const note: Note = { id, title, stage, x: Math.round(x), y: Math.round(y), tone };
  return { wall: { ...wall, notes: [...wall.notes, note] }, id };
}

export const TONE_NAMES: Record<Tone, string> = {
  1: "Indigo",
  2: "Blue",
  3: "Teal",
  4: "Green",
  5: "Amber",
  6: "Orange",
  7: "Red",
  8: "Rose",
  9: "Purple",
};
