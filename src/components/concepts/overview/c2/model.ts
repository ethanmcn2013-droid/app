/*
 * River of time: pure layout and reasoning helpers. No React, no DOM.
 */
import {
  type Item,
  type PersonId,
  type ProjectId,
  type ScopeId,
  PEOPLE,
  PERSON,
  PROJECTS,
  PROJECT_LANES,
  WORKSTREAMS,
  long,
  mondayOf,
  short,
} from "./data";

export type Lens = "streams" | "people" | "projects";

export type LaneDef = {
  id: string;
  name: string;
  /** CSS colour expression for the lane's identity. */
  color: string;
  person?: PersonId;
  project?: ProjectId;
};

export const WS_COLOR = (lane: string) => `var(--rv-ws-${lane})`;
export const PJ_COLOR = (project: string) => `var(--rv-pj-${project})`;

export function lanesFor(lens: Lens): LaneDef[] {
  if (lens === "people") {
    return PEOPLE.map((p) => ({ id: p.id, name: p.name, color: "var(--v3-text-2)", person: p.id }));
  }
  if (lens === "projects") {
    return PROJECT_LANES.map((id) => ({ id, name: PROJECTS[id].short, color: PJ_COLOR(id), project: id }));
  }
  return WORKSTREAMS.map((w) => ({ id: w.id, name: w.name, color: WS_COLOR(w.id) }));
}

export function laneKey(item: Item, lens: Lens): string {
  if (lens === "people") return item.owner;
  if (lens === "projects") return item.project;
  return item.lane;
}

/** The colour an item wears: its workstream, or its project in the Projects lens. */
export function itemColor(item: Item, lens: Lens): string {
  return lens === "projects" ? PJ_COLOR(item.project) : WS_COLOR(item.lane);
}

export function inScope(item: Item, scope: ScopeId): boolean {
  if (scope === "all") return PROJECT_LANES.includes(item.project);
  return item.project === scope;
}

/** Is the item still open at the end of `day`? */
export function openAt(item: Item, day: number): boolean {
  return item.doneOn === undefined || item.doneOn > day;
}

export function lateAt(item: Item, day: number): boolean {
  return item.due !== undefined && openAt(item, day) && item.due < day;
}

export function isDated(item: Item): item is Item & { due: number } {
  return item.due !== undefined;
}

// ── Text measurement (approximate, for packing) ───────────────────────

export function textWidth(text: string, size = 12): number {
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += 0.28;
    else if ("iljtf.,'".includes(ch)) w += 0.3;
    else if ("mwMW".includes(ch)) w += 0.82;
    else if (ch >= "A" && ch <= "Z") w += 0.66;
    else w += 0.54;
  }
  return Math.ceil(w * size);
}

// ── Lane packing ──────────────────────────────────────────────────────

export type Placed = {
  item: Item;
  row: number;
  x: number;
  w: number;
  /** Label sits inside the pill when true. */
  inside: boolean;
  /** Label hangs to the left of the bar (or flag) because the run ahead is taken. */
  left: boolean;
  /** No label at all: the bar (or flag) and its owner only. */
  bare: boolean;
  /** Most the label text itself may take before it meets the next thing in its row. */
  labelMax: number;
  /** Width reserved for a status badge beside the label. */
  badge: number;
};

export type Cluster = { key: string; x: number; row: number; items: Item[]; week: number };

export type Packed = {
  placed: Placed[];
  clusters: Cluster[];
  overflowed: boolean;
  rowsUsed: number;
  /** How many words this packing gave up: shorter labels, bare bars, anything that did not fit. */
  loss: number;
};

// A bare bar says nothing, so it costs as much as work that found no row at all:
// lanes grow (and the stage scrolls) before anything goes anonymous.
const TIER_LOSS: Record<string, number> = { inside: 0, full: 0, left: 1, mid: 1, tight: 2, squeeze: 3, bare: 30 };

const GAP = 6;
/** A 16px owner disc plus its gap. */
export const AVATAR_W = 21;
/** Fewer than this many items that do not fit never become a "+N" chip. */
const MIN_CLUSTER = 3;

type Tier = { start: number; end: number; kind: "inside" | "full" | "left" | "mid" | "tight" | "squeeze" | "bare" };

export function geometry(item: Item & { due: number }, ppd: number, r0: number) {
  if (item.kind === "milestone") {
    const x = (item.due - r0 + 0.5) * ppd;
    return { x, w: 0 };
  }
  const start = item.start ?? item.due;
  return { x: (start - r0) * ppd, w: Math.max(8, (item.due - start + 1) * ppd) };
}

/**
 * Pack a lane into rows. Each item tries, in order: its full label, a medium
 * label, a short stub, then no label at all (bar and owner only). Only when a
 * week still has three or more things that fit nowhere do they share a "+N".
 */
export function packLane(
  items: (Item & { due: number })[],
  ppd: number,
  r0: number,
  rows: number,
  extra: (item: Item) => number = () => 0,
  avatar = false,
  /** Labels may hang left of their bar only this far: the edge of the opening view. */
  minX = 4,
): Packed {
  const av = avatar ? AVATAR_W : 0;
  const entries = items
    .map((item) => {
      const g = geometry(item, ppd, r0);
      const badge = extra(item);
      if (item.kind === "milestone") {
        const label = Math.ceil(textWidth(item.title) * 1.12) + textWidth(short(item.due), 11.5) + 14 + badge;
        const s0 = g.x - 8;
        const tiers: Tier[] = [
          { start: s0, end: g.x + 12 + label, kind: "full" },
          ...(badge || g.x - 14 - label < minX ? [] : [{ start: g.x - 14 - label, end: g.x + 8, kind: "left" } as Tier]),
          { start: s0, end: g.x + 12 + Math.min(label, 120 + badge), kind: "mid" },
          { start: s0, end: g.x + 12 + Math.min(label, 96 + badge), kind: "tight" },
          { start: s0, end: g.x + 8, kind: "bare" },
        ];
        return { item, x: g.x, w: 0, label, badge, labelStart: g.x + 12, tiers };
      }
      const text = textWidth(item.title);
      const label = av + text + 10 + badge;
      const tail = g.x + g.w + 6;
      const tiers: Tier[] =
        g.w >= label + 12
          ? [{ start: g.x, end: g.x + g.w, kind: "inside" }]
          : [
              { start: g.x, end: tail + label, kind: "full" },
              // The run ahead is taken: hang the whole label behind the bar instead.
              ...(badge || g.x - 6 - label < minX ? [] : [{ start: g.x - 6 - label, end: g.x + g.w, kind: "left" } as Tier]),
              { start: g.x, end: tail + Math.min(label, av + 110 + badge), kind: "mid" },
              { start: g.x, end: tail + Math.min(label, av + 56 + badge), kind: "tight" },
              // A bar long enough to carry a few words keeps them inside itself.
              ...(g.w >= 72 ? [{ start: g.x, end: g.x + g.w, kind: "squeeze" } as Tier] : []),
              // Bare: the owner sits inside the bar when it is wide enough, else just after it.
              { start: g.x, end: g.x + g.w + (avatar && g.w < 22 ? 20 : 0), kind: "bare" },
            ];
      return { item, x: g.x, w: g.w, label, badge, labelStart: tail, tiers };
    })
    // Milestones claim their place first; tasks fill around them.
    .sort(
      (a, b) =>
        Number(b.item.kind === "milestone") - Number(a.item.kind === "milestone") || a.tiers[0].start - b.tiers[0].start,
    );

  type Entry = (typeof entries)[number];
  const fits = (row: { start: number; end: number }[], start: number, end: number) =>
    row.every((o) => start >= o.end + GAP || end + GAP <= o.start);
  // Each item takes the richest tier any row can give it. When that leaves
  // something with nowhere to go, the label standing in its way gives up a
  // tier and the lane is packed again, so words yield before work disappears.
  const weight = (e: Entry) => (e.badge ? 3 : 1);
  const run = (cap: number[]) => {
    const taken: { start: number; end: number }[][] = Array.from({ length: rows }, () => []);
    const placed: (Entry & { row: number; tier: Tier; idx: number; ti: number })[] = [];
    const overflow: Entry[] = [];
    entries.forEach((e, idx) => {
      for (let ti = cap[idx]; ti < e.tiers.length; ti++) {
        const t = e.tiers[ti];
        const r = taken.findIndex((row) => fits(row, t.start, t.end));
        if (r >= 0) {
          placed.push({ ...e, row: r, tier: t, idx, ti });
          taken[r].push({ start: t.start, end: t.end });
          return;
        }
      }
      overflow.push(e);
    });
    const loss =
      placed.reduce((sum, pl) => sum + TIER_LOSS[pl.tier.kind] * weight(pl), 0) + overflow.length * 30;
    return { taken, placed, overflow, loss };
  };
  // Try giving up one tier on each label standing in the way, and keep the
  // change that costs the fewest words overall.
  let cap = entries.map(() => 0);
  let best = run(cap);
  for (let guard = 0; guard < 40 && best.overflow.length; guard++) {
    const need = best.overflow[0].tiers[best.overflow[0].tiers.length - 1];
    let next: { cap: number[]; res: ReturnType<typeof run> } | null = null;
    for (const pl of best.placed) {
      if (pl.ti >= pl.tiers.length - 1) continue;
      if (pl.tier.end + GAP <= need.start || pl.tier.start >= need.end + GAP) continue;
      const c = cap.slice();
      c[pl.idx] = pl.ti + 1;
      const res = run(c);
      if (!next || res.loss < next.res.loss) next = { cap: c, res };
    }
    if (!next) break;
    cap = next.cap;
    best = next.res;
  }
  const { taken, placed, overflow } = best;

  const clusters: Cluster[] = [];
  if (overflow.length) {
    const byWeek = new Map<number, Entry[]>();
    for (const e of overflow) {
      const wk = mondayOf(e.item.due);
      byWeek.set(wk, [...(byWeek.get(wk) ?? []), e]);
    }
    for (const [week, list] of byWeek) {
      if (list.length < MIN_CLUSTER) {
        // One or two strays: squeeze them in bare wherever they overlap least.
        for (const e of list) {
          const t = e.tiers[e.tiers.length - 1];
          let best = 0;
          let bestHit = Infinity;
          taken.forEach((row, r) => {
            const hit = row.reduce(
              (sum, o) => sum + Math.max(0, Math.min(o.end, t.end) - Math.max(o.start, t.start) + GAP),
              0,
            );
            if (hit < bestHit) {
              bestHit = hit;
              best = r;
            }
          });
          placed.push({ ...e, row: best, tier: t, idx: -1, ti: e.tiers.length - 1 });
          taken[best].push({ start: t.start, end: t.end });
        }
        continue;
      }
      const x0 = Math.min(...list.map((e) => e.x));
      let row = rows - 1;
      let x = (week - r0) * ppd + 2;
      // Find the first gap in the week wide enough for the chip.
      let found = false;
      for (let cx = x0; cx <= (week + 7 - r0) * ppd + 24 && !found; cx += 4) {
        for (let r = rows - 1; r >= 0 && !found; r--) {
          if (fits(taken[r], cx, cx + 30)) {
            row = r;
            x = cx;
            found = true;
          }
        }
      }
      taken[row].push({ start: x, end: x + 30 });
      clusters.push({ key: `c${week}`, x, row, items: list.map((e) => e.item), week });
    }
  }

  // How far each label may run before it meets the next thing in its row.
  const out: Placed[] = placed.map((e) => {
    const inside = e.tier.kind === "inside" || e.tier.kind === "squeeze";
    const left = e.tier.kind === "left";
    const bare = e.tier.kind === "bare";
    let room: number;
    if (inside) room = e.w - 12;
    else if (left) room = e.label;
    else {
      const limit = Math.min(
        Infinity,
        ...placed.filter((o) => o !== e && o.row === e.row && o.tier.start > e.tier.start).map((o) => o.tier.start),
        ...clusters.filter((c) => c.row === e.row && c.x > e.tier.start).map((c) => c.x),
      );
      room = Math.min(e.label, limit - e.labelStart - GAP);
    }
    const own = e.item.kind === "milestone" ? 0 : av;
    return {
      item: e.item,
      row: e.row,
      x: e.x,
      w: e.w,
      inside,
      left,
      bare,
      badge: e.badge,
      labelMax: Math.max(28, room - e.badge - own),
    };
  });
  return {
    placed: out,
    clusters,
    loss: placed.reduce((sum, pl) => sum + TIER_LOSS[pl.tier.kind] * (pl.badge ? 3 : 1), 0) + overflow.length * 30,
    overflowed: overflow.length > 0,
    rowsUsed: Math.max(1, ...out.map((p) => p.row + 1), ...clusters.map((c) => c.row + 1)),
  };
}

// ── Pressure ──────────────────────────────────────────────────────────

export type WeekLoad = { week: number; items: Item[]; count: number };

export function weeklyLoad(items: Item[], ref: number, r0: number, r1: number): WeekLoad[] {
  const weeks: WeekLoad[] = [];
  for (let wk = mondayOf(r0); wk <= r1; wk += 7) {
    const list = items.filter(
      (it) => it.due !== undefined && !it.terminal && it.due >= wk && it.due < wk + 7 && openAt(it, ref),
    );
    weeks.push({ week: wk, items: list, count: list.length });
  }
  return weeks;
}

export type Heat = "calm" | "busy" | "warm" | "hot";

export function heatOf(count: number): Heat {
  if (count >= 6) return "hot";
  if (count >= 4) return "warm";
  if (count >= 2) return "busy";
  return "calm";
}

export function heatColor(h: Heat): string {
  if (h === "hot") return "var(--v3-danger)";
  if (h === "warm") return "var(--v3-warning)";
  if (h === "busy") return "var(--rv-ribbon-busy)";
  return "var(--rv-ribbon-calm)";
}

/** "3 on Aoife" when one person carries two or more. */
export function topOwner(items: Item[]): { person: PersonId; count: number } | null {
  const counts = new Map<PersonId, number>();
  for (const it of items) counts.set(it.owner, (counts.get(it.owner) ?? 0) + 1);
  let best: { person: PersonId; count: number } | null = null;
  for (const [person, count] of counts) if (!best || count > best.count) best = { person, count };
  return best && best.count >= 2 ? best : null;
}

export function ownerBreakdown(items: Item[]): { person: PersonId; count: number }[] {
  const counts = new Map<PersonId, number>();
  for (const it of items) counts.set(it.owner, (counts.get(it.owner) ?? 0) + 1);
  return [...counts.entries()].map(([person, count]) => ({ person, count })).sort((a, b) => b.count - a.count);
}

// ── Dependencies ──────────────────────────────────────────────────────

export function dependentsOf(items: Item[], id: string): Item[] {
  return items.filter((it) => it.after?.includes(id));
}

export function allDownstream(items: Item[], id: string, seen = new Set<string>()): Item[] {
  const out: Item[] = [];
  for (const d of dependentsOf(items, id)) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d, ...allDownstream(items, d.id, seen));
  }
  return out;
}

/** Shift one item by `delta` days and push anything that waits on it. */
export function cascade(items: Item[], id: string, delta: number): Map<string, number> {
  const shifts = new Map<string, number>([[id, delta]]);
  if (delta <= 0) return shifts;
  const byId = new Map(items.map((it) => [it.id, it]));
  const queue = [id];
  while (queue.length) {
    const cur = byId.get(queue.shift()!)!;
    const curDue = (cur.due ?? 0) + (shifts.get(cur.id) ?? 0);
    for (const dep of dependentsOf(items, cur.id)) {
      if (dep.due === undefined || dep.status === "done") continue;
      const depStart = (dep.start ?? dep.due) + (shifts.get(dep.id) ?? 0);
      if (depStart <= curDue) {
        const push = curDue + 1 - (dep.start ?? dep.due);
        if (push > (shifts.get(dep.id) ?? 0)) {
          shifts.set(dep.id, push);
          queue.push(dep.id);
        }
      }
    }
  }
  return shifts;
}

export function applyShifts(items: Item[], shifts: Map<string, number>): Item[] {
  return items.map((it) => {
    const s = shifts.get(it.id);
    if (!s || it.due === undefined) return it;
    return { ...it, due: it.due + s, start: it.start === undefined ? undefined : it.start + s };
  });
}

// ── Spreading a crowded week ─────────────────────────────────────────

export type SpreadMove = { id: string; delta: number };

export function spreadWeek(items: Item[], week: number, ref: number): SpreadMove[] {
  const load = (wk: number, moved: Map<string, number>) =>
    items.filter((it) => {
      if (it.due === undefined || it.terminal || !openAt(it, ref)) return false;
      const due = it.due + (moved.get(it.id) ?? 0);
      return due >= wk && due < wk + 7;
    }).length;

  const moved = new Map<string, number>();
  const candidates = items
    .filter(
      (it) =>
        it.kind === "task" &&
        it.due !== undefined &&
        it.status === "todo" &&
        it.due >= week &&
        it.due < week + 7 &&
        !it.terminal,
    )
    .sort((a, b) => dependentsOf(items, a.id).length - dependentsOf(items, b.id).length || b.due! - a.due!);

  for (const it of candidates) {
    if (load(week, moved) <= 4) break;
    for (let delta = 7; delta <= 21; delta += 7) {
      const target = it.due! + delta;
      const blocked = dependentsOf(items, it.id).some((d) => (d.start ?? d.due ?? Infinity) <= target);
      if (blocked) break;
      if (load(mondayOf(target), moved) < 3) {
        moved.set(it.id, delta);
        break;
      }
    }
  }
  return [...moved.entries()].map(([id, delta]) => ({ id, delta }));
}

// ── Clashes across projects ──────────────────────────────────────────

export type Clash = { day: number; items: Item[]; people: PersonId[]; sentence: string };

export function clashes(items: Item[]): Clash[] {
  const ms = items
    .filter((it) => it.kind === "milestone" && it.due !== undefined && it.status !== "done")
    .sort((a, b) => a.due! - b.due!);
  const groups: Item[][] = [];
  for (const m of ms) {
    const last = groups[groups.length - 1];
    if (last && m.due! - last[last.length - 1].due! <= 2) last.push(m);
    else groups.push([m]);
  }
  const out: Clash[] = [];
  for (const g of groups) {
    const projects = new Set(g.map((m) => m.project));
    if (projects.size < 2) continue;
    const peopleByProject = new Map<ProjectId, Set<PersonId>>();
    for (const m of g) {
      const set = peopleByProject.get(m.project) ?? new Set<PersonId>();
      set.add(m.owner);
      m.involves?.forEach((p) => set.add(p));
      peopleByProject.set(m.project, set);
    }
    const shared = new Set<PersonId>();
    const sets = [...peopleByProject.values()];
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++) for (const p of sets[i]) if (sets[j].has(p)) shared.add(p);
    if (!shared.size) continue;
    const people = [...shared];
    const day = g[0].due!;
    const names = people.map((p) => PERSON[p].name).join(" and ");
    const titles = g.map((m) => m.title);
    const span = g[g.length - 1].due! - day;
    const when = span === 0 ? long(day) : `${long(day)} to ${long(g[g.length - 1].due!)}`;
    out.push({
      day,
      items: g,
      people,
      sentence: `${when}: ${listJoin(titles)} all need ${names}.`.replace(" all need", g.length === 2 ? " both need" : " all need"),
    });
  }
  return out;
}

export function listJoin(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
