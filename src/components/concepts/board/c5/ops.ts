import { NOTE, type Cluster, type Note, type StageKey, type Tone, type Wall } from "./data";
import { freeSpot, gap, noteRect, stageAt } from "./geometry";

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

export type DropResult = { wall: Wall; nowDone: string[]; freshCluster: string | null; stageChanges: number };

export function dropNotes(wall: Wall, ids: string[], dx: number, dy: number): DropResult {
  const set = new Set(ids);
  const nowDone: string[] = [];
  let stageChanges = 0;
  let next: Wall = {
    ...wall,
    notes: wall.notes.map((n) => {
      if (!set.has(n.id)) return n;
      const x = Math.round(n.x + dx);
      const y = Math.round(n.y + dy);
      const stage = stageAt(x + NOTE / 2, y + NOTE / 2, wall.zones) ?? n.stage;
      if (stage !== n.stage) {
        stageChanges += 1;
        if (stage === "done") nowDone.push(n.id);
      }
      return { ...n, x, y, stage };
    }),
  };
  let freshCluster: string | null = null;
  if (ids.length === 1) {
    const id = ids[0];
    const me = next.notes.find((n) => n.id === id)!;
    const target = clusterTarget(next, id, me.x, me.y);
    if (target?.kind === "join") {
      next = { ...next, notes: next.notes.map((n) => (n.id === id ? { ...n, clusterId: target.clusterId } : n)) };
    } else if (target?.kind === "new") {
      const other = next.notes.find((n) => n.id === target.withId)!;
      const cluster: Cluster = { id: uid("c"), name: "", tone: other.tone };
      freshCluster = cluster.id;
      next = {
        ...next,
        clusters: [...next.clusters, cluster],
        notes: next.notes.map((n) => (n.id === id || n.id === other.id ? { ...n, clusterId: cluster.id } : n)),
      };
    } else if (me.clusterId) {
      const stillNear = next.notes.some((n) => n.id !== id && n.clusterId === me.clusterId && gap(noteRect(n), noteRect(me)) <= JOIN_GAP);
      if (!stillNear) next = { ...next, notes: next.notes.map((n) => (n.id === id ? { ...n, clusterId: undefined } : n)) };
    }
  }
  return { wall: dissolve(next), nowDone, freshCluster, stageChanges };
}

/** Move a note to another stage without a position: it finds room in that zone. */
export function moveToStage(wall: Wall, id: string, stage: StageKey): Wall {
  const me = wall.notes.find((n) => n.id === id);
  if (!me || me.stage === stage) return wall;
  const zone = wall.zones.find((z) => z.stage === stage)!;
  const spot = freeSpot(zone, wall.notes, new Set([id]));
  return dissolve({
    ...wall,
    notes: wall.notes.map((n) => (n.id === id ? { ...n, stage, x: spot.x, y: spot.y, clusterId: undefined } : n)),
  });
}

export function nudge(wall: Wall, ids: string[], dx: number, dy: number): Wall {
  const set = new Set(ids);
  return {
    ...wall,
    notes: wall.notes.map((n) => {
      if (!set.has(n.id)) return n;
      const x = n.x + dx;
      const y = n.y + dy;
      return { ...n, x, y, stage: stageAt(x + NOTE / 2, y + NOTE / 2, wall.zones) ?? n.stage };
    }),
  };
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

export function createNote(wall: Wall, x: number, y: number, tone: Tone, title = ""): { wall: Wall; id: string } {
  const id = uid("n");
  const stage = stageAt(x + NOTE / 2, y + NOTE / 2, wall.zones) ?? "ideas";
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
};
