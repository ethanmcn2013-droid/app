import { BOARDS, CORE, KINDS, TODAY_LABEL, TOOLS, UNSET_SUGGEST, UNSET_ZONES, ZONES, type Board, type BoardKind, type GlyphId, type Tool, type ZoneId } from "./data";

export type Hung = { by?: string; on?: string };

export type BoardState = {
  kind: BoardKind;
  order: Record<ZoneId, GlyphId[]>;
  hung: Partial<Record<GlyphId, Hung>>;
  takenDown: Partial<Record<GlyphId, string>>;
  /** The slot that was just hung or taken down, so only it animates. */
  moved: { id: GlyphId; how: "hang" | "down"; at: number } | null;
};

export const kindOf = (k: BoardKind) => KINDS.find((x) => x.id === k) ?? null;

export function suggestFor(k: BoardKind): Partial<Record<ZoneId, GlyphId[]>> {
  const kind = kindOf(k);
  return { ...(kind ? kind.suggest : UNSET_SUGGEST), always: CORE };
}

export function zoneTitles(k: BoardKind): Record<ZoneId, string> {
  return kindOf(k)?.zones ?? UNSET_ZONES;
}

export function nameOf(id: GlyphId, k: BoardKind) {
  return kindOf(k)?.rename?.[id] ?? TOOLS[id].name;
}

function zoneOfSuggestion(k: BoardKind, id: GlyphId): ZoneId | null {
  const s = suggestFor(k);
  for (const z of ZONES) if (s[z]?.includes(id)) return z;
  return null;
}

/** Where a tool goes when it is hung from the full list. */
export function homeZone(k: BoardKind, id: GlyphId): ZoneId {
  const direct = zoneOfSuggestion(k, id);
  if (direct) return direct;
  for (const kind of KINDS) {
    for (const z of ZONES) if (kind.suggest[z]?.includes(id)) return z;
  }
  return "before";
}

/** First layout of a board: what is on hangs first in each zone, outlines follow. */
export function initialState(b: Board): BoardState {
  const s = suggestFor(b.kind);
  const order = { before: [], day: [], touch: [], always: [] } as Record<ZoneId, GlyphId[]>;
  const placed = new Set<GlyphId>();
  for (const id of Object.keys(b.hung) as GlyphId[]) {
    const z = CORE.includes(id) ? "always" : homeZone(b.kind, id);
    order[z].push(id);
    placed.add(id);
  }
  for (const z of ZONES) {
    for (const id of s[z] ?? []) {
      if (!placed.has(id)) {
        order[z].push(id);
        placed.add(id);
      }
    }
  }
  // Core apps keep their own order.
  order.always = [...CORE];
  return { kind: b.kind, order, hung: { ...b.hung }, takenDown: {}, moved: null };
}

/**
 * Changing what the board is for. Anything on the board, or taken down and
 * still kept, stays exactly where it is. Only outlines come and go.
 */
export function rekind(st: BoardState, next: BoardKind): BoardState {
  const s = suggestFor(next);
  const wanted = new Set<GlyphId>(ZONES.flatMap((z) => s[z] ?? []));
  const order = { before: [], day: [], touch: [], always: [] } as Record<ZoneId, GlyphId[]>;
  const placed = new Set<GlyphId>();
  for (const z of ZONES) {
    for (const id of st.order[z]) {
      if (st.hung[id] || st.takenDown[id] || wanted.has(id)) {
        order[z].push(id);
        placed.add(id);
      }
    }
  }
  for (const z of ZONES) {
    for (const id of s[z] ?? []) {
      if (!placed.has(id)) {
        order[z].push(id);
        placed.add(id);
      }
    }
  }
  return { ...st, kind: next, order, moved: null };
}

export function hang(st: BoardState, id: GlyphId): BoardState {
  const takenDown = { ...st.takenDown };
  delete takenDown[id];
  let order = st.order;
  const present = ZONES.some((z) => st.order[z].includes(id));
  if (!present) {
    const z = homeZone(st.kind, id);
    order = { ...st.order, [z]: [...st.order[z], id] };
  }
  return { ...st, order, takenDown, hung: { ...st.hung, [id]: { by: "You", on: TODAY_LABEL } }, moved: { id, how: "hang", at: Date.now() } };
}

export function takeDown(st: BoardState, id: GlyphId): BoardState {
  const hung = { ...st.hung };
  delete hung[id];
  return { ...st, hung, takenDown: { ...st.takenDown, [id]: TODAY_LABEL }, moved: { id, how: "down", at: Date.now() } };
}

export function counts(st: BoardState) {
  let on = 0;
  let gaps = 0;
  for (const z of ZONES) {
    for (const id of st.order[z]) {
      if (st.hung[id]) on++;
      else gaps++;
    }
  }
  return { on, gaps };
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function reasonFor(b: Board, id: GlyphId): string {
  return b.detail[id]?.reason ?? TOOLS[id].fallbackReason;
}

export function statusFor(b: Board, st: BoardState, id: GlyphId): string {
  const h = st.hung[id];
  if (h?.on === TODAY_LABEL && h.by === "You") return b.detail[id]?.fresh ?? TOOLS[id].fresh;
  return b.detail[id]?.status ?? TOOLS[id].fresh;
}

export function readsFor(b: Board, t: Tool): string[] {
  return b.detail[t.id]?.reads ?? t.reads;
}

export const BOARD_INDEX = Object.fromEntries(BOARDS.map((b) => [b.id, b])) as Record<string, Board>;
