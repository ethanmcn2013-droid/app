/*
 * The landing forecast. Pure and deterministic: a seeded random source means
 * the server render and the browser render always agree.
 *
 * How it works, in the words the page uses: take the last three weeks of
 * real days (how many things got finished, how many new ones arrived), then
 * play the coming weeks out a few hundred times by drawing from those days.
 * Where most of the runs hit zero is the forecast; how spread out they are is
 * how sure we can be.
 */

export const DAY_MS = 86_400_000;

/** Day numbers count whole UTC days since 1 Jan 1970. */
export function dayOf(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parts(day: number) {
  const d = new Date(day * DAY_MS);
  return { date: d.getUTCDate(), month: d.getUTCMonth(), weekday: d.getUTCDay(), year: d.getUTCFullYear() };
}
export const fmtShort = (day: number) => {
  const p = parts(day);
  return `${p.date} ${MONTHS_SHORT[p.month]}`;
};
export const fmtLong = (day: number) => {
  const p = parts(day);
  return `${p.date} ${MONTHS_LONG[p.month]}`;
};
export const fmtWeekday = (day: number) => {
  const p = parts(day);
  return `${WEEKDAYS[p.weekday]} ${p.date} ${MONTHS_SHORT[p.month]}`;
};
export const monthShort = (m: number) => MONTHS_SHORT[m];
export const monthLong = (m: number) => MONTHS_LONG[m];

/** A range of two dates in the fewest words: "11–16 Oct" or "29 Oct – 3 Nov". */
export function fmtRange(a: number, b: number) {
  const pa = parts(a);
  const pb = parts(b);
  if (a === b) return fmtShort(a);
  if (pa.month === pb.month) return `${pa.date}–${pb.date} ${MONTHS_SHORT[pa.month]}`;
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DayRecord = { day: number; remaining: number; finished: number; added: number };

/** What a lever does to the forecast's inputs. */
export type LeverEffect = {
  /** Things taken off the list today. */
  remove?: number;
  /** Multiplies the finishing pace (1.25 = a quarter faster). */
  pace?: number;
  /** Extra new things arriving per day. */
  addPerDay?: number;
};

export type ForecastInput = {
  history: DayRecord[];
  today: number;
  /** Last day the fan is drawn to. */
  end: number;
  /** How much the pace itself might wander, run to run (0.1 = about 10%). */
  wobble: number;
  effects: LeverEffect[];
  /** Last date that still counts as ready (the day before the big date). */
  deadline: number | null;
};

export type Forecast = {
  /** Day numbers from today to end, inclusive. */
  days: number[];
  low: number[];
  mid: number[];
  high: number[];
  /** Landing days: early, most likely, late. Null when it never lands inside the horizon. */
  early: number | null;
  likely: number | null;
  late: number | null;
  /** Share of runs that land on or before the deadline. */
  chance: number | null;
  startRemaining: number;
  /** Net things cleared per day, on average, after levers. */
  netPerDay: number;
};

const RUNS = 400;
const HORIZON = 200;
const POOL = 21;

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

export function forecast(input: ForecastInput): Forecast {
  const { history, today, end, wobble, effects, deadline } = input;
  const pool = history.slice(-POOL);
  const remove = effects.reduce((s, e) => s + (e.remove ?? 0), 0);
  const pace = effects.reduce((s, e) => s * (e.pace ?? 1), 1);
  const addPerDay = effects.reduce((s, e) => s + (e.addPerDay ?? 0), 0);
  const last = history[history.length - 1];
  const start = Math.max(0, last.remaining - remove);

  const span = end - today;
  const rand = mulberry32(20261017);
  const paths: Float64Array[] = [];
  const landings: number[] = [];
  let netSum = 0;
  for (const rec of pool) netSum += rec.finished * pace - rec.added - addPerDay;
  const netPerDay = pool.length ? netSum / pool.length : 0;

  for (let r = 0; r < RUNS; r++) {
    // Box-Muller: each run gets its own steady pace factor, then daily draws.
    const u1 = Math.max(1e-9, rand());
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const factor = Math.max(0.35, 1 + z * wobble);
    const path = new Float64Array(span + 1);
    let left = start;
    path[0] = left;
    let landed: number | null = start <= 0 ? 0 : null;
    for (let t = 1; t <= HORIZON; t++) {
      const rec = pool[Math.floor(rand() * pool.length)];
      const extra = addPerDay > 0 && rand() < addPerDay % 1 ? 1 : 0;
      const added = rec.added + Math.floor(addPerDay) + extra;
      if (left > 0) left = Math.max(0, left - rec.finished * pace * factor + added);
      if (landed === null && left <= 0.5) {
        landed = t;
        left = 0;
      }
      if (t <= span) path[t] = left;
    }
    paths.push(path);
    landings.push(landed ?? Number.POSITIVE_INFINITY);
  }

  const days: number[] = [];
  const low: number[] = [];
  const mid: number[] = [];
  const high: number[] = [];
  const column: number[] = new Array(RUNS);
  for (let t = 0; t <= span; t++) {
    for (let r = 0; r < RUNS; r++) column[r] = paths[r][t];
    column.sort((a, b) => a - b);
    days.push(today + t);
    low.push(quantile(column, 0.1));
    mid.push(quantile(column, 0.5));
    high.push(quantile(column, 0.9));
  }

  landings.sort((a, b) => a - b);
  const at = (q: number) => {
    const v = quantile(landings, q);
    return Number.isFinite(v) ? today + v : null;
  };
  const chance =
    deadline === null ? null : landings.filter((l) => today + l <= deadline).length / RUNS;

  return {
    days,
    low,
    mid,
    high,
    early: at(0.1),
    likely: at(0.5),
    late: at(0.9),
    chance,
    startRemaining: start,
    netPerDay,
  };
}

/** What the forecast said on a past day, using only what was known then. */
export function pastLanding(history: DayRecord[], index: number): number | null {
  const from = Math.max(0, index - POOL + 1);
  const slice = history.slice(from, index + 1);
  if (slice.length < 7) return null;
  let net = 0;
  for (const r of slice) net += r.finished - r.added;
  net /= slice.length;
  if (net <= 0.05) return null;
  return history[index].day + Math.round(history[index].remaining / net);
}

/** Plain words for how sure the forecast is. */
export function sureness(chance: number): string {
  if (chance >= 0.9) return "Very likely";
  if (chance >= 0.7) return "Fairly sure";
  if (chance >= 0.45) return "Could go either way";
  if (chance >= 0.2) return "Unlikely as things stand";
  return "Very unlikely as things stand";
}

export function inTen(chance: number) {
  return Math.max(0, Math.min(10, Math.round(chance * 10)));
}
