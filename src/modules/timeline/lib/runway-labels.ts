/**
 * Runway label placement (plan runway, spec 3.2), kept pure so it can be
 * tested without a browser.
 *
 * Rules:
 *   - A label always belongs to its own diamond: centred on it when that
 *     fits, otherwise starting at it (or ending at it near the right edge).
 *     It is never slid onto free space away from its diamond.
 *   - Labels sit on the lanes given (above, then below), and stay `inset`
 *     pixels inside both edges of the card.
 *   - A label prefers a spot that does not sit over a neighbouring diamond,
 *     so the eye does not read it as that diamond's label.
 *   - When a label fits in no lane, its diamond folds with the nearest
 *     neighbour into a count badge. Nothing is dropped silently: every
 *     diamond ends up labelled or counted.
 *
 * Everything is in on-screen pixels.
 */

export type RunwayLane = "above" | "below";
export type RunwayAlign = "center" | "start" | "end";

export type RunwayMark<T> = Readonly<{ x: number; item: T }>;

export type RunwayGroup<T> =
  | Readonly<{ kind: "single"; x: number; item: T }>
  | Readonly<{ kind: "cluster"; x: number; items: readonly T[] }>;

export type RunwayLabel = Readonly<{
  id: string;
  x: number;
  lane: RunwayLane;
  align: RunwayAlign;
  from: number;
  to: number;
  strong: boolean;
}>;

export type RunwayLayout<T> = Readonly<{ groups: readonly RunwayGroup<T>[]; labels: readonly RunwayLabel[] }>;

export type RunwayLayoutOptions<T> = Readonly<{
  widthPx: number;
  lanes: readonly RunwayLane[];
  /** Id of an item, used to key labels. */
  idOf: (item: T) => string;
  /** Estimated label width in px (text plus knockout padding). */
  widthOf: (item: T) => number;
  /** Placed first and kept out of a fold where there is a choice. */
  isPriority?: (item: T) => boolean;
  /** Minimum gap between diamonds before they fold into a badge. */
  clusterPx?: number;
  /** Labels stay this far inside both card edges. */
  inset?: number;
  /** Space between two labels in the same lane. */
  gap?: number;
  /** Aligned "start"/"end" labels begin this far to the diamond's side. */
  nudge?: number;
}>;

type Working<T> = { x: number; items: T[] };

function toGroups<T>(working: readonly Working<T>[]): RunwayGroup<T>[] {
  return working.map((group) =>
    group.items.length === 1
      ? { kind: "single", x: group.x, item: group.items[0] }
      : { kind: "cluster", x: group.x, items: group.items },
  );
}

function merge<T>(a: Working<T>, b: Working<T>, xOf: Map<T, number>): Working<T> {
  const items = [...a.items, ...b.items].sort((p, q) => (xOf.get(p) ?? 0) - (xOf.get(q) ?? 0));
  const xs = items.map((item) => xOf.get(item) ?? 0);
  return { x: xs.reduce((sum, v) => sum + v, 0) / xs.length, items };
}

export function layoutRunway<T>(marks: readonly RunwayMark<T>[], options: RunwayLayoutOptions<T>): RunwayLayout<T> {
  const {
    widthPx,
    lanes,
    idOf,
    widthOf,
    isPriority = () => false,
    clusterPx = 18,
    inset = 12,
    gap = 12,
    nudge = 6,
  } = options;

  const xOf = new Map<T, number>();
  for (const mark of marks) xOf.set(mark.item, mark.x);

  // 1. Diamonds closer than clusterPx fold first, regardless of labels.
  const sorted = [...marks].sort((a, b) => a.x - b.x);
  let working: Working<T>[] = [];
  for (const mark of sorted) {
    const last = working[working.length - 1];
    const lastX = last ? (xOf.get(last.items[last.items.length - 1]) ?? last.x) : -Infinity;
    if (last && mark.x - lastX < clusterPx) working[working.length - 1] = merge(last, { x: mark.x, items: [mark.item] }, xOf);
    else working.push({ x: mark.x, items: [mark.item] });
  }

  // 2. Place labels; fold the first diamond that cannot be labelled and retry.
  //    Each retry removes one group, so this ends.
  for (;;) {
    const result = place(working);
    if (result.unplaced === null) return { groups: toGroups(working), labels: result.labels };
    const index = working.findIndex((group) => group.items.length === 1 && group.items[0] === result.unplaced);
    if (index < 0 || working.length < 2) return { groups: toGroups(working), labels: result.labels };
    const left = index > 0 ? working[index - 1] : null;
    const right = index < working.length - 1 ? working[index + 1] : null;
    const cost = (neighbour: Working<T> | null) => {
      if (!neighbour) return Infinity;
      const distance = Math.abs(neighbour.x - working[index].x);
      // Prefer folding into a plain neighbour or an existing badge over a
      // priority milestone, which should keep its own label if it can.
      const protectedNeighbour = neighbour.items.length === 1 && isPriority(neighbour.items[0]);
      return distance + (protectedNeighbour ? widthPx : 0);
    };
    const withLeft = cost(left) <= cost(right);
    const neighbourIndex = withLeft ? index - 1 : index + 1;
    const [a, b] = withLeft ? [neighbourIndex, index] : [index, neighbourIndex];
    const merged = merge(working[a], working[b], xOf);
    working = [...working.slice(0, a), merged, ...working.slice(b + 1)];
  }

  function place(groups: readonly Working<T>[]): { labels: RunwayLabel[]; unplaced: T | null } {
    const singles = groups.filter((group) => group.items.length === 1);
    const diamondXs = groups.map((group) => group.x);
    const order = [...singles.filter((g) => isPriority(g.items[0])), ...singles.filter((g) => !isPriority(g.items[0]))];
    const taken: { lane: RunwayLane; from: number; to: number }[] = [];
    const labels: RunwayLabel[] = [];

    // Lanes alternate along the line, so neighbours start on opposite sides.
    const rank = new Map(singles.map((group, index) => [group, index]));
    for (const group of order) {
      const item = group.items[0];
      const turn = (rank.get(group) ?? 0) % lanes.length;
      const laneOrder = [...lanes.slice(turn), ...lanes.slice(0, turn)];
      const x = group.x;
      const w = widthOf(item);
      const candidates: { align: RunwayAlign; from: number; to: number }[] = [
        { align: "center", from: x - w / 2, to: x + w / 2 },
        // Near an edge the aligned label starts (or ends) at the inset, but
        // never further from its diamond than the nudge.
        { align: "start", from: Math.max(x - nudge, Math.min(inset, x)), to: Math.max(x - nudge, Math.min(inset, x)) + w },
        { align: "end", from: Math.min(x + nudge, Math.max(widthPx - inset, x)) - w, to: Math.min(x + nudge, Math.max(widthPx - inset, x)) },
      ];
      const lo = Math.min(inset, x);
      const hi = Math.max(widthPx - inset, x);
      const fits = (c: { from: number; to: number }) => c.from >= lo && c.to <= hi;
      const free = (lane: RunwayLane, c: { from: number; to: number }) =>
        !taken.some((t) => t.lane === lane && c.from < t.to + gap && c.to > t.from - gap);
      // Sitting over another diamond is allowed only as a last resort.
      const overNeighbour = (c: { from: number; to: number }) =>
        diamondXs.some((dx) => dx !== x && dx > c.from + 4 && dx < c.to - 4);

      let chosen: { lane: RunwayLane; align: RunwayAlign; from: number; to: number } | null = null;
      for (const strict of [true, false]) {
        for (const lane of laneOrder) {
          for (const c of candidates) {
            if (!fits(c) || !free(lane, c)) continue;
            if (strict && overNeighbour(c)) continue;
            chosen = { lane, ...c };
            break;
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
      if (!chosen) return { labels, unplaced: item };
      taken.push({ lane: chosen.lane, from: chosen.from, to: chosen.to });
      labels.push({ id: idOf(item), x, lane: chosen.lane, align: chosen.align, from: chosen.from, to: chosen.to, strong: isPriority(item) });
    }
    return { labels, unplaced: null };
  }
}

/** Every mark is either labelled or counted in a badge. Used by tests. */
export function everyMarkAccounted<T>(marks: readonly RunwayMark<T>[], layout: RunwayLayout<T>, idOf: (item: T) => string): boolean {
  const labelled = new Set(layout.labels.map((label) => label.id));
  const counted = new Set<string>();
  for (const group of layout.groups) if (group.kind === "cluster") for (const item of group.items) counted.add(idOf(item));
  return marks.every((mark) => labelled.has(idOf(mark.item)) || counted.has(idOf(mark.item)));
}
