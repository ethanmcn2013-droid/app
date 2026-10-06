import { STAGES, type Card, type Move, type StageKey } from "./data";

export const ORDER: Record<StageKey, number> = { todo: 0, doing: 1, waiting: 2, review: 3, done: 4 };
export const OPEN_STAGES: StageKey[] = ["todo", "doing", "waiting", "review"];
export const HISTORY_DAYS = 14;

export type Stay = { stage: StageKey; from: number; to: number | null };

/** Where the card was at the end of `day`, or null if it did not exist yet. */
export function moveAt(card: Card, day: number): Move | null {
  let found: Move | null = null;
  for (const m of card.history) if (m.day <= day) found = m;
  return found;
}

/** The card's journey up to `day`, one entry per stay in a stage. */
export function staysOf(card: Card, day: number): Stay[] {
  const moves = card.history.filter((m) => m.day <= day);
  return moves.map((m, i) => ({ stage: m.stage, from: m.day, to: i + 1 < moves.length ? moves[i + 1].day : null }));
}

/** Times the card went backwards (Review to In progress, say). Waiting to In progress is not backwards. */
export function sentBackCount(card: Card, day: number): number {
  const moves = card.history.filter((m) => m.day <= day);
  let n = 0;
  for (let i = 1; i < moves.length; i++) {
    const from = moves[i - 1].stage;
    const to = moves[i].stage;
    if (from !== "waiting" && to !== "waiting" && ORDER[to] < ORDER[from]) n++;
  }
  return n;
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** How long work usually sits in each stage, learned from finished stays. */
export function usualTimes(cards: Card[]): Record<StageKey, number> {
  const out = {} as Record<StageKey, number>;
  for (const stage of STAGES) {
    const samples: number[] = [];
    for (const c of cards) for (const s of staysOf(c, 0)) if (s.stage === stage.key && s.to !== null) samples.push(s.to - s.from);
    out[stage.key] = samples.length >= 3 ? Math.max(1, Math.round(median(samples))) : stage.fallbackUsual;
  }
  return out;
}

export type AgeLevel = "calm" | "due" | "over";

export function ageLevel(age: number, usual: number): AgeLevel {
  if (usual <= 0) return "calm";
  if (age >= usual * 2) return "over";
  if (age >= usual) return "due";
  return "calm";
}

export const isStuck = (age: number, usual: number) => usual > 0 && age > usual;

export type Placed = { card: Card; stage: StageKey; since: number; age: number; sentBack: number };

export type StageFlow = {
  key: StageKey;
  cards: Placed[];
  /** Arrivals and departures in the seven days up to the view day. */
  inWeek: number;
  outWeek: number;
  outFortnight: number;
  /** Card count at the end of each of the last 14 days. */
  spark: number[];
  pooled: boolean;
};

function transitions(cards: Card[]) {
  const t: { from: StageKey | null; to: StageKey; day: number }[] = [];
  for (const c of cards) c.history.forEach((m, i) => t.push({ from: i ? c.history[i - 1].stage : null, to: m.stage, day: m.day }));
  return t;
}

export function flowAt(cards: Card[], day: number): Record<StageKey, StageFlow> {
  const moves = transitions(cards);
  const out = {} as Record<StageKey, StageFlow>;
  for (const s of STAGES) {
    const placed: Placed[] = [];
    for (const card of cards) {
      const m = moveAt(card, day);
      if (!m || m.stage !== s.key) continue;
      if (s.key === "done" && m.day < day - (HISTORY_DAYS - 1)) continue;
      placed.push({ card, stage: s.key, since: m.day, age: day - m.day, sentBack: sentBackCount(card, day) });
    }
    if (s.key === "done") placed.sort((a, b) => b.since - a.since);
    else placed.sort((a, b) => b.age - a.age || a.card.title.localeCompare(b.card.title));

    const inWindow = (d: number, span: number) => d <= day && d > day - span;
    const inWeek = moves.filter((m) => m.to === s.key && m.from !== s.key && inWindow(m.day, 7)).length;
    const outWeek = moves.filter((m) => m.from === s.key && m.to !== s.key && inWindow(m.day, 7)).length;
    const outFortnight = moves.filter((m) => m.from === s.key && m.to !== s.key && inWindow(m.day, HISTORY_DAYS)).length;
    const spark: number[] = [];
    for (let d = day - (HISTORY_DAYS - 1); d <= day; d++) {
      let n = 0;
      for (const card of cards) {
        const m = moveAt(card, d);
        if (m && m.stage === s.key && (s.key !== "done" || m.day > d - 7)) n++;
      }
      spark.push(n);
    }
    const pooled = s.key !== "done" && s.key !== "todo" && placed.length >= 4 && inWeek - outWeek >= 3 && spark[HISTORY_DAYS - 8] > 0;
    out[s.key] = { key: s.key, cards: placed, inWeek, outWeek, outFortnight, spark, pooled };
  }
  return out;
}

/** Departures from a stage in the seven days up to `day`, split by where they went. */
export function movedOnWeek(cards: Card[], day: number, from: StageKey) {
  return transitions(cards).filter((m) => m.from === from && m.to !== from && m.day <= day && m.day > day - 7).length;
}

export function daysText(n: number) {
  return n === 1 ? "1 day" : `${n} days`;
}

export function ageText(age: number) {
  return age === 0 ? "New" : `${age}d here`;
}

export function nextStage(stage: StageKey): StageKey | null {
  if (stage === "todo") return "doing";
  if (stage === "doing") return "review";
  if (stage === "waiting") return "doing";
  if (stage === "review") return "done";
  return null;
}

export function moveOnLabel(stage: StageKey) {
  if (stage === "todo") return "Start";
  if (stage === "doing") return "Send for review";
  if (stage === "waiting") return "Unblock";
  if (stage === "review") return "Approve";
  return "Move on";
}
