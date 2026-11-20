/*
 * River of time: pure layout and reasoning helpers. No React, no DOM.
 */
import { type Item, type TeamPersonId, laneColor, mondayOf, personColor, projectColor, short } from "./data";

export type Lens = "streams" | "people";

export type LaneDef = {
  id: string;
  name: string;
  /** CSS colour expression for the lane's identity. */
  color: string;
  person?: TeamPersonId;
  project?: string;
};

/** The colour an item wears: its workstream, or its project when the river shows every project. */
export function itemColor(item: Item, allProjects = false): string {
  return allProjects || !item.lane ? projectColor(item.project) : laneColor(item.project, item.lane);
}

export { personColor };

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
// A label on the left of its bar reads as belonging to the bar before it, so
// flipping sides costs more than giving up a few words.
const TIER_LOSS: Record<string, number> = { inside: 0, full: 0, mid: 1, tight: 2, left: 2.5, squeeze: 3, bare: 30 };

const GAP = 6;
/** A 16px owner disc plus its gap. */
export const AVATAR_W = 21;
/** Fewer than this many items that do not fit never become a "+N" chip. */
const MIN_CLUSTER = 3;

type Tier = { start: number; end: number; kind: "inside" | "full" | "left" | "mid" | "tight" | "squeeze" | "bare" };

/**
 * Near the right edge of the view a label that runs on past it would be cut
 * off mid-word, so it hangs to the left of its bar instead. Tiers that would
 * cross the edge drop behind the left one and the bare fallback.
 */
function edgeAware(tiers: Tier[], barEnd: number, maxX: number): Tier[] {
  if (!Number.isFinite(maxX) || barEnd >= maxX - 8) return tiers;
  const crosses = (t: Tier) => (t.kind === "full" || t.kind === "mid" || t.kind === "tight") && t.end > maxX;
  if (!tiers.some(crosses)) return tiers;
  const keep = tiers.filter((t) => !crosses(t));
  const bare = keep.filter((t) => t.kind === "bare");
  return [...keep.filter((t) => t.kind !== "bare"), ...tiers.filter(crosses), ...bare];
}

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
  /** The right edge of the opening view: a label that would run past it flips to the left of its bar. */
  maxX = Infinity,
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
        return { item, x: g.x, w: 0, label, badge, labelStart: g.x + 12, tiers: edgeAware(tiers, g.x + 8, maxX) };
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
      return { item, x: g.x, w: g.w, label, badge, labelStart: tail, tiers: edgeAware(tiers, g.x + g.w, maxX) };
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
      (it) => it.kind === "task" && it.due !== undefined && it.due >= wk && it.due < wk + 7 && openAt(it, ref),
    );
    weeks.push({ week: wk, items: list, count: list.length });
  }
  return weeks;
}

/*
 * Busy is not a warning. A week's load is drawn in neutral ink that deepens
 * with what is due; it turns amber only past what the team can do, which is
 * the number of tasks the team finished in the last seven days.
 */
export type Heat = "quiet" | "steady" | "busy" | "over";

export function heatOf(count: number, capacity: number): Heat {
  if (capacity > 0 && count > capacity) return "over";
  if (count >= 4) return "busy";
  if (count >= 1) return "steady";
  return "quiet";
}

export const HEAT_WORD: Record<Heat, string> = {
  quiet: "Quiet",
  steady: "Steady",
  busy: "Busy",
  over: "Over what the team can do",
};

/** Ink density for a week: more due, darker ink. Amber only when over capacity. */
export function heatColor(count: number, capacity: number): string {
  if (capacity > 0 && count > capacity) return "var(--v3-warning)";
  const pct = Math.min(78, 22 + count * 6);
  return `color-mix(in srgb, var(--v3-text-2) ${pct}%, var(--v3-canvas))`;
}

export function ownerBreakdown(items: Item[]): { person: TeamPersonId; count: number }[] {
  const counts = new Map<TeamPersonId, number>();
  for (const it of items) counts.set(it.owner, (counts.get(it.owner) ?? 0) + 1);
  return [...counts.entries()].map(([person, count]) => ({ person, count })).sort((a, b) => b.count - a.count);
}

export function topOwner(items: Item[]): { person: TeamPersonId; count: number } | null {
  const best = ownerBreakdown(items)[0];
  return best && best.count >= 2 ? best : null;
}

// ── Spreading a crowded week ─────────────────────────────────────────

export type SpreadMove = { id: string; delta: number };

/**
 * Suggest moving To do work a week or more later until the week holds no
 * more than `target`. Nothing moves past its project's date.
 */
export function spreadWeek(items: Item[], week: number, ref: number, dateOf: (project: string) => number | undefined, target = 4): SpreadMove[] {
  const load = (wk: number, moved: Map<string, number>) =>
    items.filter((it) => {
      if (it.kind !== "task" || it.due === undefined || !openAt(it, ref)) return false;
      const due = it.due + (moved.get(it.id) ?? 0);
      return due >= wk && due < wk + 7;
    }).length;

  const moved = new Map<string, number>();
  const candidates = items
    .filter((it) => it.kind === "task" && it.due !== undefined && it.status === "todo" && it.due >= week && it.due < week + 7)
    .sort((a, b) => b.due! - a.due!);

  for (const it of candidates) {
    if (load(week, moved) <= target) break;
    for (let delta = 7; delta <= 21; delta += 7) {
      const to = it.due! + delta;
      const day = dateOf(it.project);
      if (day !== undefined && it.due! < day && to >= day) break;
      if (load(mondayOf(to), moved) < 3) {
        moved.set(it.id, delta);
        break;
      }
    }
  }
  return [...moved.entries()].map(([id, delta]) => ({ id, delta }));
}

export function listJoin(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
