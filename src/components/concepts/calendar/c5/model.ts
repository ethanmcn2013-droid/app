import {
  ABSENCES,
  BRIEFS,
  HOLIDAYS,
  ITEMS,
  personById,
  projectById,
  type Absence,
  type Holiday,
  type Item,
  type ProjectId,
} from "./data";

/** Day 0 is Thursday 1 October 2026. */
const BASE = Date.UTC(2026, 9, 1);
export const STREAM_START = -10; // Mon 21 Sep
export const STREAM_END = 66; // Sun 6 Dec
export const SCRUB_START = -3; // Mon 28 Sep, the start of this week
export const SCRUB_DAYS = 70; // ten weeks

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function dateOf(day: number) {
  return new Date(BASE + day * 86_400_000);
}
export const weekday = (day: number) => WD[dateOf(day).getUTCDay()];
export const weekdayLong = (day: number) => WD_LONG[dateOf(day).getUTCDay()];
export const dateNum = (day: number) => dateOf(day).getUTCDate();
export const monthShort = (day: number) => MON[dateOf(day).getUTCMonth()];
export const monthLong = (day: number) => MON_LONG[dateOf(day).getUTCMonth()];
export const isWeekend = (day: number) => {
  const d = dateOf(day).getUTCDay();
  return d === 0 || d === 6;
};
/** Monday on or before the day. */
export function mondayOf(day: number) {
  const wd = (dateOf(day).getUTCDay() + 6) % 7;
  return day - wd;
}
/** "Fri 16 Oct" */
export const fmtDay = (day: number) => `${weekday(day)} ${dateNum(day)} ${monthShort(day)}`;
/** "16 Oct" */
export const fmtShort = (day: number) => `${dateNum(day)} ${monthShort(day)}`;

export function relDay(day: number) {
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  if (day === -1) return "Yesterday";
  return fmtDay(day);
}

export function relDistance(day: number) {
  if (day === 0) return "today";
  if (day === 1) return "tomorrow";
  if (day === -1) return "yesterday";
  if (day > 0) return `in ${day} days`;
  return `${-day} days ago`;
}

/** "5 to 11 Oct" or "26 Oct to 1 Nov" */
export function fmtRange(from: number, to: number) {
  if (monthShort(from) === monthShort(to)) return `${dateNum(from)} to ${dateNum(to)} ${monthShort(to)}`;
  return `${fmtShort(from)} to ${fmtShort(to)}`;
}

export function fmtTime(min?: number) {
  if (min === undefined) return "";
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Lenses ─────────────────────────────────────────────────────────────

export type Lens = "all" | "mine" | ProjectId;

export function inLens(item: Item, lens: Lens) {
  if (lens === "all") return true;
  if (lens === "mine") return item.people.includes("you") || item.kind === "milestone";
  return item.project === lens;
}

// ── Occurrences on a day ───────────────────────────────────────────────

export type Occurrence = {
  item: Item;
  /** For spans: 1-based position and length. */
  spanIndex?: number;
  spanLength?: number;
};

export function itemsOnDay(items: Item[], day: number, lens: Lens): Occurrence[] {
  const out: Occurrence[] = [];
  for (const item of items) {
    if (item.day === undefined || !inLens(item, lens)) continue;
    if (item.kind === "span" && item.endDay !== undefined) {
      if (day >= item.day && day <= item.endDay) {
        out.push({ item, spanIndex: day - item.day + 1, spanLength: item.endDay - item.day + 1 });
      }
    } else if (item.day === day) {
      out.push({ item });
    }
  }
  const rank = (o: Occurrence) =>
    o.item.kind === "milestone" ? 0 : o.item.kind === "span" ? 1 : o.item.start !== undefined ? 2 : 3;
  return out.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    return (a.item.start ?? 0) - (b.item.start ?? 0);
  });
}

const PROJECT_PEOPLE = (() => {
  const map = new Map<ProjectId, Set<string>>();
  for (const it of ITEMS) {
    const set = map.get(it.project) ?? new Set<string>();
    for (const person of it.people) set.add(person);
    map.set(it.project, set);
  }
  return map;
})();

export function absencesOn(day: number, lens: Lens): Absence[] {
  const hits = ABSENCES.filter((a) => day >= a.from && day <= a.to);
  if (lens === "all" || lens === "mine") return hits;
  return hits.filter((a) => PROJECT_PEOPLE.get(lens)?.has(a.person));
}

export const holidayOn = (day: number): Holiday | undefined => HOLIDAYS.find((h) => h.day === day);

/** Load is what the scrubber tick length shows. */
export function loadOf(occ: Occurrence[]) {
  let n = 0;
  for (const o of occ) {
    if (o.item.kind === "milestone") n += 1.5;
    else if (o.item.kind === "span") n += 0.6;
    else n += 1;
  }
  return n;
}

// ── Summaries ──────────────────────────────────────────────────────────

export function summarise(day: number, occ: Occurrence[]): string {
  const work = occ.filter((o) => o.item.kind === "task" || o.item.kind === "event");
  const tasks = work.filter((o) => o.item.kind === "task");
  const events = work.filter((o) => o.item.kind === "event");
  const ms = occ.find((o) => o.item.kind === "milestone");
  const spans = occ.filter((o) => o.item.kind === "span");

  if (day < 0) {
    if (!work.length && !ms) return "Nothing was planned.";
    const done = occ.filter((o) => o.item.done && o.item.kind !== "span").length;
    const total = occ.filter((o) => o.item.kind !== "span").length;
    if (done === total) return total === 1 ? "Done." : `All ${total} done.`;
    return `${done} of ${total} done. ${plural(total - done, "thing")} still open.`;
  }

  const parts: string[] = [];
  if (tasks.length) parts.push(plural(tasks.length, "task"));
  if (events.length) parts.push(plural(events.length, "event"));
  let head = parts.join(", ");
  if (!head && ms) head = "Milestone day";
  if (!head && spans.length) head = `Day ${spans[0].spanIndex} of ${spans[0].spanLength}`;
  if (!head) return day === 0 ? "Nothing planned. A clear day." : "Nothing planned.";

  const am = events.filter((o) => (o.item.start ?? 0) < 12 * 60).length;
  const pm = events.length - am;
  let mood = "";
  if (work.length >= 8) mood = "A full day.";
  else if (pm >= 2 && pm > am) mood = "Busy afternoon.";
  else if (am >= 2 && am > pm) mood = "Busy morning.";
  else if (events.some((o) => (o.item.start ?? 0) >= 18 * 60)) mood = "Late finish.";
  else if (work.length === 1) mood = "Light day.";
  else if (events.length === 0) mood = "No meetings.";
  return `${head}. ${mood}`.trim();
}

export function briefFor(day: number, occ: Occurrence[], lens: Lens): string {
  if (lens === "all" && BRIEFS[day]) return BRIEFS[day];
  const bits: string[] = [];
  for (const a of absencesOn(day, lens)) bits.push(`${personById[a.person].name} is out for ${a.why}.`);
  const first = occ.find((o) => o.item.kind === "event" && !o.item.done);
  if (first) {
    const who = first.item.people[0];
    const name = who === "you" ? "You have" : `${personById[who].name} has`;
    bits.push(`${name} ${lower(first.item.title)} at ${fmtTime(first.item.start)}.`);
  }
  const ms = occ.find((o) => o.item.kind === "milestone");
  if (ms) bits.push(`${ms.item.title} lands today.`);
  const mine = occ.filter((o) => o.item.kind === "task" && o.item.people.includes("you") && !o.item.done).length;
  if (mine) bits.push(`${plural(mine, "task")} ${mine === 1 ? "is" : "are"} yours.`);
  const late = occ.filter((o) => day < 0 && !o.item.done && o.item.kind !== "span").length;
  if (late) bits.push(`${plural(late, "thing")} didn't get done.`);
  if (!bits.length) return "Nothing that needs you. A good day to get ahead.";
  return bits.join(" ");
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ── Blocks: what the river renders ─────────────────────────────────────

export type DayBlock = { kind: "day"; key: string; day: number; occ: Occurrence[] };
export type QuietBlock = { kind: "quiet"; key: string; from: number; to: number };
export type WeekBlock = {
  kind: "week";
  key: string;
  monday: number;
  lead: string;
  range: string;
  blocks: (DayBlock | QuietBlock)[];
};

export function weekLead(monday: number) {
  const w = Math.round((monday - SCRUB_START) / 7);
  if (w === 0) return "This week";
  if (w === 1) return "Next week";
  if (w === -1) return "Last week";
  if (w < 0) return `${-w} weeks ago`;
  if (monthShort(monday) !== monthShort(SCRUB_START) && w >= 5) return `Week of ${fmtShort(monday)}`;
  return `In ${w} weeks`;
}

export type QuietWeeksBlock = { kind: "quietWeeks"; key: string; from: number; to: number };
export type Section = WeekBlock | QuietWeeksBlock;

export function buildWeeks(items: Item[], lens: Lens, opts: { stopAfterToday?: boolean } = {}): Section[] {
  const out: Section[] = [];
  let emptyRun: { from: number; to: number } | null = null;
  const flushWeeks = () => {
    if (emptyRun) out.push({ kind: "quietWeeks", key: `qw${emptyRun.from}`, ...emptyRun });
    emptyRun = null;
  };
  for (let monday = mondayOf(STREAM_START); monday <= STREAM_END; monday += 7) {
    const blocks: (DayBlock | QuietBlock)[] = [];
    let run: number[] = [];
    let busy = false;
    const flush = () => {
      if (run.length >= 2) {
        blocks.push({ kind: "quiet", key: `q${run[0]}`, from: run[0], to: run[run.length - 1] });
      } else if (run.length === 1) {
        blocks.push({ kind: "day", key: `d${run[0]}`, day: run[0], occ: [] });
      }
      run = [];
    };
    const sunday = Math.min(monday + 6, STREAM_END);
    for (let day = Math.max(monday, STREAM_START); day <= sunday; day++) {
      if (opts.stopAfterToday && day > 0) break;
      const occ = itemsOnDay(items, day, lens);
      const empty = occ.length === 0 && !holidayOn(day);
      if (empty && day !== 0) {
        run.push(day);
        continue;
      }
      busy = true;
      flush();
      blocks.push({ kind: "day", key: `d${day}`, day, occ });
    }
    flush();
    if (!blocks.length) continue;
    if (!busy) {
      const from = Math.max(monday, STREAM_START);
      emptyRun = emptyRun ? { from: emptyRun.from, to: sunday } : { from, to: sunday };
      continue;
    }
    flushWeeks();
    out.push({ kind: "week", key: `w${monday}`, monday, lead: weekLead(monday), range: fmtRange(monday, monday + 6), blocks });
    if (opts.stopAfterToday && monday + 6 >= 0) break;
  }
  flushWeeks();
  return out;
}

/** Which rendered block holds each day, for the scrubber and week strip. */
export function anchorMap(sections: Section[]) {
  const map = new Map<number, string>();
  for (const w of sections) {
    if (w.kind === "quietWeeks") {
      for (let d = w.from; d <= w.to; d++) map.set(d, w.key);
      continue;
    }
    for (const b of w.blocks) {
      if (b.kind === "day") map.set(b.day, b.key);
      else for (let d = b.from; d <= b.to; d++) map.set(d, b.key);
    }
  }
  return map;
}

export function projectName(p: ProjectId) {
  return projectById[p].name;
}

// ── Composer parsing ───────────────────────────────────────────────────

/** "Call Hollow Tree at 14:30" → title and a start time. */
export function parseQuick(text: string): { title: string; start?: number } {
  const m = text.match(/(?:\s+at)?\s*\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!m || m.index === undefined) return { title: text.trim() };
  const start = Number(m[1]) * 60 + Number(m[2]);
  const title = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  return { title: title || text.trim(), start };
}
