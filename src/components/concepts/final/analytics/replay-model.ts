/**
 * Analytics, replay lens: the pure calculation.
 *
 * Given a project's task histories (built from the store's event log in
 * ./world), answer for any day: where was every task, how much was open, done
 * and late, what happened that week, and what changed between two days.
 * Moments are found in the same records (the lead's health changes and
 * reasons, dates that moved, long waits, big weeks), so every sentence quotes
 * something that happened.
 */
import { HEALTH_WORDS } from "../../demo/health";
import { SUPPLIERS, nameOf } from "../../demo/store";
import { PERSON_NAME, type HealthChange, type Moment, type ReplayProject, type Status, type Task } from "./world";

export type { Moment, ReplayProject, Status, Task };

/** The five statuses, in the words Tasks uses. */
export const COLUMNS: { key: Status; name: string }[] = [
  { key: "todo", name: "To do" },
  { key: "doing", name: "In progress" },
  { key: "waiting", name: "Waiting" },
  { key: "review", name: "To check" },
  { key: "done", name: "Done" },
];
export const STATUS_WORD: Record<Status, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.name])) as Record<Status, string>;

/* ── dates ─────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateOf(p: ReplayProject, day: number) {
  const [y, m, d] = p.start.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + day));
}

/** A date outside this year carries its year: "12 Mar 2027". */
const yearOf = (dt: Date) => (dt.getUTCFullYear() === 2026 ? "" : ` ${dt.getUTCFullYear()}`);

export function fmtDay(p: ReplayProject, day: number) {
  const dt = dateOf(p, day);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}${yearOf(dt)}`;
}

export function fmtLong(p: ReplayProject, day: number) {
  const dt = dateOf(p, day);
  return `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}${yearOf(dt)}`;
}

export function weekdayOf(p: ReplayProject, day: number) {
  return dateOf(p, day).getUTCDay();
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * How long the replay runs, said one way everywhere: the header, the caption
 * ("Week 3 of 6") and the replay button. Under two weeks it counts days.
 */
export function spanOf(p: ReplayProject) {
  const days = p.last + 1;
  const weeks = Math.ceil(days / 7);
  const byDay = days < 14;
  return {
    days,
    weeks,
    byDay,
    words: byDay ? plural(days, "day") : plural(weeks, "week"),
    /** "Week 3 of 6", or "Day 4 of 9". */
    at: (d: number) => (byDay ? `Day ${d + 1} of ${days}` : `Week ${Math.floor(d / 7) + 1} of ${weeks}`),
  };
}

/* ── one task on one day ───────────────────────────────────────────── */

/** The status it had at the end of day d, from its recorded steps; null before it existed. */
export function statusAt(t: Task, d: number): Status | null {
  if (t.created > d) return null;
  let out: Status = "todo";
  for (const s of t.steps) {
    if (s.day > d) break;
    out = s.status;
  }
  return out;
}

/** The date it was due on day d, or null when it had no date. */
export function dueAt(t: Task, d: number): number | null {
  let due = t.due;
  for (const m of t.moves) if (m.day <= d) due = m.to;
  return due;
}

/** Late on day d: open, with a date, and that date has passed. Due on the day is not late. */
export function lateAt(t: Task, d: number) {
  const due = dueAt(t, d);
  const s = statusAt(t, d);
  return s !== null && s !== "done" && due !== null && due < d;
}

export const movesBy = (t: Task, d: number) => t.moves.filter((m) => m.day <= d).length;

/** The day it entered the column it is in on day d (for stacking order and ages). */
export function sinceAt(t: Task, d: number) {
  let since = t.created;
  for (const s of t.steps) {
    if (s.day > d) break;
    since = s.day;
  }
  return since;
}

/** Who it was waiting on, on day d. */
export const waitingOnAt = (t: Task, d: number) => t.waits.find((w) => w.from <= d && d < w.to)?.on;

export type Placed = {
  task: Task;
  status: Status;
  since: number;
  late: boolean;
  slips: number;
};
export type Snapshot = {
  day: number;
  cols: Record<Status, Placed[]>;
  open: number;
  done: number;
  late: number;
  total: number;
};

export function snapshot(p: ReplayProject, d: number): Snapshot {
  const cols: Record<Status, Placed[]> = { todo: [], doing: [], waiting: [], review: [], done: [] };
  let late = 0;
  for (const t of p.tasks) {
    const s = statusAt(t, d);
    if (!s) continue;
    const isLate = lateAt(t, d);
    if (isLate) late++;
    cols[s].push({ task: t, status: s, since: sinceAt(t, d), late: isLate, slips: movesBy(t, d) });
  }
  const order = new Map(p.groups.map((g, i) => [g.id, i]));
  for (const k of Object.keys(cols) as Status[]) {
    cols[k].sort((a, b) => a.since - b.since || (order.get(a.task.group) ?? 0) - (order.get(b.task.group) ?? 0) || a.task.id.localeCompare(b.task.id));
  }
  const done = cols.done.length;
  const open = cols.todo.length + cols.doing.length + cols.waiting.length + cols.review.length;
  return { day: d, cols, open, done, late, total: open + done };
}

/* ── series across the whole history ───────────────────────────────── */

export type Series = {
  open: number[];
  done: number[];
  late: number[];
  waiting: number[];
  peakOpen: number;
  peakDay: number;
  /** The most marks each column ever holds (squares, or blocks of five), so the stage can size squares to fit the whole replay. */
  most: Record<Status, number>;
};

function marks(p: ReplayProject, items: Placed[]) {
  if (p.block === 1) return items.length;
  const count = (key: (t: Task) => string) => {
    const m = new Map<string, number>();
    for (const it of items) m.set(key(it.task), (m.get(key(it.task)) ?? 0) + 1);
    let n = 0;
    for (const v of m.values()) n += Math.ceil(v / 5);
    return n;
  };
  return Math.max(
    count((t) => t.group),
    count((t) => t.person),
  );
}

export function series(p: ReplayProject): Series {
  const open: number[] = [];
  const done: number[] = [];
  const late: number[] = [];
  const waiting: number[] = [];
  let peakOpen = 0;
  let peakDay = 0;
  const most: Record<Status, number> = { todo: 0, doing: 0, waiting: 0, review: 0, done: 0 };
  for (let d = 0; d <= p.last; d++) {
    const s = snapshot(p, d);
    for (const k of Object.keys(most) as Status[]) most[k] = Math.max(most[k], marks(p, s.cols[k]));
    open.push(s.open);
    done.push(s.done);
    late.push(s.late);
    waiting.push(s.cols.waiting.length);
    if (s.open > peakOpen) {
      peakOpen = s.open;
      peakDay = d;
    }
  }
  return { open, done, late, waiting, peakOpen, peakDay, most };
}

/* ── counting helpers ──────────────────────────────────────────────── */

const inRange = (x: number | null, a: number, b: number) => x !== null && x > a && x <= b;
export const finishedBetween = (p: ReplayProject, a: number, b: number) => p.tasks.filter((t) => inRange(t.done, a, b));
export const addedBetween = (p: ReplayProject, a: number, b: number) => p.tasks.filter((t) => t.created > a && t.created <= b);

function topBy<T>(items: T[], key: (x: T) => string) {
  const counts = new Map<string, number>();
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1);
  let best = "";
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return { key: best, count: n };
}

export const personName = (p: ReplayProject, id: string) => p.people.find((x) => x.id === id)?.name ?? PERSON_NAME[id] ?? "Someone";
export const groupName = (p: ReplayProject, id: string) => p.groups.find((x) => x.id === id)?.name ?? "Other";

/** The seven-day window with the most finished, aligned to the project's weeks. */
export function biggestWeek(p: ReplayProject) {
  let best = { start: 0, count: -1 };
  for (let s = 0; s <= p.last; s += 7) {
    const c = finishedBetween(p, s === 0 ? -Infinity : s - 1, Math.min(p.last, s + 6)).length;
    if (c > best.count) best = { start: s, count: c };
  }
  return best;
}

/* ── moments: found in the records ─────────────────────────────────── */

const quote = (t: string) => `“${t}”`;
const clause = (text: string) => text.trim().replace(/[.\s]+$/, "");
/** Names that keep their capital at the start of a clause. */
const NAMES = new Set([...SUPPLIERS.flatMap((x) => x.name.split(" ")), ...Object.values(PERSON_NAME), "Ada", "Theo", "Mark", "Sinéad", "Ruth", "Christmas", "Kinsale", "Cork"]);
/** Lower-case a clause's first word unless it is a name. */
const lower = (t: string) => (NAMES.has(t.split(/\s/)[0]) ? t : t.charAt(0).toLowerCase() + t.slice(1));

/** The moments the store's story names for one project, beyond what the records show by themselves. */
function storyMoments(p: ReplayProject): Moment[] {
  if (p.id !== "mara-finn") return [];
  const seating = p.tasks.find((t) => t.id === "mf-21");
  const day = seating?.waits[0]?.from;
  if (!seating || day === undefined || day < 0) return [];
  return [
    {
      id: "seating",
      day,
      label: "Seating plan v4 went to Mara",
      sentence: `${fmtDay(p, day)}. Aoife sent seating plan v4 to Mara. Mara approved v3 on 21 Sep; v4 waits on her, due ${fmtDay(p, dueAt(seating, day) ?? day)}.`,
      taskId: seating.id,
      ask: "waiting-longest",
    },
  ];
}

function healthMoment(p: ReplayProject, h: HealthChange): Moment {
  const who = PERSON_NAME[h.by] ?? "The lead";
  const word = HEALTH_WORDS[h.to];
  const label = h.to === "on_track" ? "Back on track" : `Marked ${word}`;
  const why = h.reason ? `: ${lower(clause(h.reason))}` : "";
  // A reason of more than one sentence reads better quoted, in the lead's own words.
  const quoted = h.reason && /\.\s+\S/.test(clause(h.reason)) ? `. ${who} wrote: “${clause(h.reason)}.”` : null;
  return {
    id: `health-${h.day}`,
    day: h.day,
    label,
    sentence: quoted ? `${fmtDay(p, h.day)}. ${who} marked ${p.short} ${word}${quoted}` : `${fmtDay(p, h.day)}. ${who} marked ${p.short} ${word}${why}.`,
    ask: "on-course",
  };
}

/**
 * Moments for any project, in priority order: the lead's health calls, the
 * dates that moved furthest, the longest wait, the biggest week, a burst of
 * new work, and the start. One per day, seven at most.
 */
function foundMoments(p: ReplayProject, sr: Series): Moment[] {
  const out: Moment[] = [];
  const inside = (d: number) => d >= 0 && d <= p.last;

  for (const h of p.healthChanges) if (h.from !== h.to && inside(h.day)) out.push(healthMoment(p, h));

  // Dates that moved, furthest first.
  const moves = p.tasks
    .flatMap((t) =>
      t.moves.map((m, i) => {
        const before = i === 0 ? t.due : t.moves[i - 1].to;
        return { t, m, before, push: m.to !== null && before !== null ? m.to - before : 0 };
      }),
    )
    .filter((x) => inside(x.m.day) && x.push > 0 && x.m.to !== null && x.before !== null)
    .sort((a, b) => b.push - a.push || a.m.day - b.m.day)
    .slice(0, 2);
  for (const { t, m, before } of moves) {
    const why = m.note?.match(/^Moved[^:]*:\s*(.+)$/)?.[1];
    const second = t.moves.indexOf(m) >= 1;
    out.push({
      id: `move-${t.id}-${m.day}`,
      day: m.day,
      label: `${t.title}: ${second ? "moved again" : "date moved"}`,
      sentence: `${fmtDay(p, m.day)}. ${quote(t.title)} moved from ${fmtDay(p, before!)} to ${fmtDay(p, m.to!)}${why ? `: ${lower(clause(why))}` : ""}.`,
      taskId: t.id,
      ask: "slipping",
    });
  }

  // The longest single wait on someone outside the team.
  const waits = p.tasks
    .flatMap((t) => t.waits.map((w) => ({ t, w, days: Math.min(w.to, p.last) - w.from, open: w.to > p.last })))
    .filter((x) => inside(x.w.from) && x.days >= 5)
    .sort((a, b) => b.days - a.days);
  if (waits[0]) {
    const { t, w, days, open } = waits[0];
    out.push({
      id: `wait-${t.id}`,
      day: w.from,
      label: `Waiting on ${w.on}`,
      sentence: open
        ? `${fmtDay(p, w.from)}. ${quote(t.title)} started waiting on ${w.on}. ${plural(days, "day")} on, it still is.`
        : `${fmtDay(p, w.from)}. ${quote(t.title)} started waiting on ${w.on}, and waited ${plural(days, "day")}.`,
      taskId: t.id,
      ask: "waiting-longest",
    });
  } else {
    let peakWait = 0;
    for (let d = 0; d <= p.last; d++) if (sr.waiting[d] > sr.waiting[peakWait]) peakWait = d;
    if (sr.waiting[peakWait] >= 3) {
      const top = topBy(snapshot(p, peakWait).cols.waiting, (x) => waitingOnAt(x.task, peakWait) ?? "someone");
      out.push({
        id: "waiting",
        day: peakWait,
        label: `${sr.waiting[peakWait]} tasks waiting on others`,
        sentence: `${fmtDay(p, peakWait)}. ${sr.waiting[peakWait]} tasks waiting on people outside the team, the most at once. ${top.key} held up ${top.count} of them.`,
        ask: "which-outsider",
      });
    }
  }

  const big = biggestWeek(p);
  if (big.count >= 5 && p.last >= 7) {
    const top = topBy(finishedBetween(p, big.start === 0 ? -Infinity : big.start - 1, big.start + 6), (t) => t.person);
    out.push({
      id: "big",
      day: big.start,
      label: `Biggest week: ${big.count} done`,
      sentence: `Week of ${fmtDay(p, big.start)}. The biggest week: ${big.count} done, ${top.count} of them by ${personName(p, top.key)}.`,
      ask: "done-week",
    });
  }

  // A burst: five or more tasks added within two days, after the first week.
  for (let d = 7; d <= p.last - 1; d++) {
    const added = addedBetween(p, d - 1, d + 1);
    if (added.length >= 5) {
      const top = topBy(added, (t) => t.person);
      const flag = p.milestones.find((m) => Math.abs(m.day - d) <= 1);
      out.push({
        id: "burst",
        day: d,
        label: `${added.length} tasks added in two days`,
        sentence: `${fmtDay(p, d)}. ${flag ? `${flag.label}: ` : ""}${added.length} new tasks in two days, ${top.count} of them for ${personName(p, top.key)}.`,
        ask: "changed",
      });
      break;
    }
  }

  // Where work began: the first task, how much followed that week, and what was there already.
  const week1 = p.tasks.filter((t) => t.created >= 0 && t.created <= Math.min(6, p.last)).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  const earlier = p.tasks.filter((t) => t.created < 0);
  const earlierDone = earlier.filter((t) => statusAt(t, 0) === "done").length;
  const before = earlier.length
    ? ` ${plural(earlier.length, "task")} from before the quiet stretch ${earlier.length === 1 ? "was" : "were"} on the board already${earlierDone === earlier.length ? ", all done" : earlierDone ? `, ${earlierDone} done` : ""}.`
    : "";
  if (week1.length) {
    const first = week1[0];
    const more = week1.length - 1;
    out.push({
      id: "start",
      day: 0,
      label: p.last === 0 ? "Started today" : "Work started",
      sentence:
        p.last === 0
          ? `${fmtDay(p, 0)}. ${p.short} started today with ${plural(week1.length, "task")}, the first ${quote(first.title)}.`
          : `${fmtDay(p, 0)}. Work started with ${quote(first.title)}${more ? `, and ${plural(more, "more task")} in the first week` : ""}.${before}`,
      taskId: first.id,
      ask: "left",
    });
  }

  if (p.finish) {
    const early = p.finish.due - p.finish.day;
    out.push({
      id: "end",
      day: p.finish.day,
      label: "Finished",
      sentence:
        early >= 0
          ? `${fmtDay(p, p.finish.day)}. Everything done, ${plural(early, "day")} before ${p.targetName}.`
          : `${fmtDay(p, p.finish.day)}. Everything done: the wrap-up closed ${plural(-early, "day")} after ${p.targetName}.`,
    });
  }
  return out;
}

/** One per day (the earlier in the list wins), seven at most, then in date order. */
function pickMoments(list: Moment[]): Moment[] {
  const seen = new Set<number>();
  const kept: Moment[] = [];
  for (const m of list) {
    if (seen.has(m.day)) continue;
    seen.add(m.day);
    kept.push(m);
  }
  const start = kept.find((m) => m.id === "start");
  const rest = kept.filter((m) => m !== start).slice(0, start ? 6 : 7);
  return [...(start ? [start] : []), ...rest].sort((a, b) => a.day - b.day);
}

/**
 * Colour by group: five or six hues can't be told apart at square size, so
 * only the three biggest groups (by tasks over the whole project) keep a hue
 * each, and the rest share a neutral "Other". Computed once per project so a
 * group never changes colour as the replay moves. Slot 0 is Other.
 */
export const GROUP_HUES = 3;

function groupSlots(p: ReplayProject): Record<string, number> {
  const size = new Map<string, number>();
  for (const t of p.tasks) size.set(t.group, (size.get(t.group) ?? 0) + 1);
  const ranked = p.groups.map((g, i) => ({ id: g.id, i, n: size.get(g.id) ?? 0 })).sort((a, b) => b.n - a.n || a.i - b.i);
  const out: Record<string, number> = {};
  ranked.forEach((g, r) => {
    out[g.id] = r < GROUP_HUES ? r + 1 : 0;
  });
  return out;
}

export type Replay = ReplayProject & {
  series: Series;
  /** Group id to colour slot: 1 to 3 for the biggest groups, 0 for Other. */
  groupSlot: Record<string, number>;
};

export const groupTone = (p: Replay, groupId: string) => `var(--c4-grp-${p.groupSlot[groupId] ?? 0})`;

/** The group legend: the hued groups by size, then Other with who it holds. */
export function groupKey(p: Replay) {
  const hued = p.groups.filter((g) => (p.groupSlot[g.id] ?? 0) > 0).sort((a, b) => p.groupSlot[a.id] - p.groupSlot[b.id]);
  const rest = p.groups.filter((g) => !(p.groupSlot[g.id] > 0));
  const items: { id: string; name: string; tone: string; holds?: string }[] = hued.map((g) => ({ id: g.id, name: g.name, tone: groupTone(p, g.id) }));
  if (rest.length === 1) items.push({ id: rest[0].id, name: rest[0].name, tone: "var(--c4-grp-0)" });
  else if (rest.length > 1) items.push({ id: "other", name: "Other", tone: "var(--c4-grp-0)", holds: rest.map((g) => g.name).join(", ") });
  return items;
}

/** A raw history, with its series, moments and colours worked out. */
export function toReplay(raw: ReplayProject): Replay {
  const sr = series(raw);
  // Story moments come first, so on a shared day the store's own story wins.
  const moments = pickMoments([...storyMoments(raw), ...foundMoments(raw, sr)]);
  return { ...raw, moments, series: sr, groupSlot: groupSlots(raw) };
}

/* ── captions ──────────────────────────────────────────────────────── */

/** The moment whose caption holds on day d, if any (it holds for 4 days, a week for weekly moments). */
export function momentAt(p: ReplayProject, d: number): Moment | null {
  let found: Moment | null = null;
  for (const m of p.moments) {
    const span = m.sentence.startsWith("Week of") ? 7 : 4;
    if (m.day <= d && d < m.day + span) found = m;
  }
  return found;
}

/** The project's health on day d, from the lead's calls. */
export function healthAt(p: ReplayProject, d: number) {
  let h = p.healthChanges.length ? p.healthChanges[0].from : p.health;
  for (const c of p.healthChanges) if (c.day <= d) h = c.to;
  return h;
}

export function weekCaption(p: ReplayProject, d: number) {
  const from = Math.max(-1, d - 7);
  const fin = finishedBetween(p, from, d);
  const add = addedBetween(p, Math.max(0, from), d);
  const top = topBy(fin, (t) => t.person);
  const days = d - Math.max(0, from);
  if (d === 0) {
    const s0 = snapshot(p, 0);
    const going = s0.cols.doing.length + s0.cols.waiting.length + s0.cols.review.length;
    return `${fmtDay(p, 0)}. Day one: ${plural(s0.total, "task")} on the board${s0.done ? `, ${s0.done} already done` : going ? `, ${going} already started` : ""}.`;
  }
  if (!fin.length && !add.length) return `${fmtDay(p, d)}. A quiet stretch: nothing finished or added in ${plural(days, "day")}.`;
  const lead = `${fmtDay(p, d)}. In the last ${plural(days, "day")}: ${fin.length} finished, ${add.length} added.`;
  return top.count >= 2 ? `${lead} ${personName(p, top.key)} finished the most.` : lead;
}

/* ── then and now ──────────────────────────────────────────────────── */

export type Diff = {
  a: number;
  b: number;
  finished: number;
  added: number;
  joined: string[];
  moved: number;
  then: Snapshot;
  now: Snapshot;
  groups: { id: string; name: string; tone: number; added: number; finished: number }[];
};

export function diff(p: ReplayProject, x: number, y: number): Diff {
  const a = Math.min(x, y);
  const b = Math.max(x, y);
  const fin = finishedBetween(p, a, b);
  const add = addedBetween(p, a, b);
  return {
    a,
    b,
    finished: fin.length,
    added: add.length,
    joined: p.people.filter((m) => m.joined > a && m.joined <= b).map((m) => m.name),
    moved: p.tasks.reduce((n, t) => n + t.moves.filter((m) => m.day > a && m.day <= b).length, 0),
    then: snapshot(p, a),
    now: snapshot(p, b),
    groups: p.groups.map((g) => ({
      ...g,
      added: add.filter((t) => t.group === g.id).length,
      finished: fin.filter((t) => t.group === g.id).length,
    })),
  };
}

/* ── one task's life ───────────────────────────────────────────────── */

export type Step = {
  day: number;
  kind: "created" | "started" | "waiting" | "back" | "done" | "moved" | "note" | "nudged" | "owner";
  text: string;
  span?: number;
};

const STEP_RANK: Record<Step["kind"], number> = { created: 0, owner: 1, started: 2, moved: 3, waiting: 4, nudged: 5, note: 6, back: 7, done: 8 };

/** A task's story, from its recorded events: every status, wait, nudge, note, hand-over and date move. */
export function journey(p: ReplayProject, t: Task): Step[] {
  const when = (d: number) => fmtDay(p, d);
  if (!t.log.length) return synthesisedJourney(p, t);
  const steps: Step[] = [];
  let due = t.due;
  let mi = 0;
  for (const e of t.log) {
    const by = e.by ? (PERSON_NAME[e.by] ?? e.by) : null;
    if (e.kind === "created") {
      steps.push({ day: e.day, kind: "created", text: `Added${by ? ` by ${by}` : ""}, ${t.due === null ? "no date" : `due ${when(t.due)}`}` });
    } else if (e.kind === "status") {
      if (e.to === "waiting") {
        const w = t.waits.find((x) => x.from === Math.max(t.created, e.day));
        const end = w ? Math.min(w.to, p.last) : e.day;
        const open = w ? w.to > p.last : false;
        steps.push({
          day: e.day,
          kind: "waiting",
          span: end - e.day,
          text: w ? (open ? `Waiting on ${w.on}, ${plural(end - e.day, "day")} so far` : `Waited ${plural(end - e.day, "day")} on ${w.on}`) : "Waiting",
        });
      } else if (e.to === "done") steps.push({ day: e.day, kind: "done", text: `Finished${by ? ` by ${by}` : ""}` });
      else if (e.to === "review") steps.push({ day: e.day, kind: "started", text: "Sent to be checked" });
      else if (e.to === "doing") steps.push({ day: e.day, kind: e.from === "todo" ? "started" : "back", text: e.from === "todo" ? `Started${by ? ` by ${by}` : ""}` : "Back in progress" });
      else if (e.to === "todo") steps.push({ day: e.day, kind: "back", text: "Back to To do" });
    } else if (e.kind === "due") {
      // Moves are built one for one from the due events, in order.
      const next = t.moves[mi++]?.to ?? null;
      steps.push({ day: e.day, kind: "moved", text: next === null ? "Date cleared" : due === null ? `Date set to ${when(next)}` : `Date moved from ${when(due)} to ${when(next)}` });
      due = next;
    } else if (e.kind === "owner") {
      steps.push({ day: e.day, kind: "owner", text: `Handed from ${PERSON_NAME[e.from ?? ""] ?? "someone"} to ${PERSON_NAME[e.to ?? ""] ?? "someone"}` });
    } else if (e.kind === "nudged") {
      steps.push({ day: e.day, kind: "nudged", text: `${by ?? "Someone"} nudged ${e.to ? nameOf(e.to) : "them"}` });
    } else if (e.kind === "note" && e.note && !/^Moved\b/.test(e.note)) {
      steps.push({ day: e.day, kind: "note", text: e.note });
    }
  }
  return steps.sort((a, b) => a.day - b.day || STEP_RANK[a.kind] - STEP_RANK[b.kind]);
}

/** The story of a synthesised task (the wrapped garden parties), from its fields. */
function synthesisedJourney(p: ReplayProject, t: Task): Step[] {
  const steps: Step[] = [{ day: t.created, kind: "created", text: t.due === null ? "Added, no date" : `Added, due ${fmtDay(p, t.due)}` }];
  if (t.started !== null) steps.push({ day: t.started, kind: "started", text: `Started by ${personName(p, t.person)}` });
  for (const w of t.waits) steps.push({ day: w.from, kind: "waiting", span: w.to - w.from, text: `Waited ${plural(w.to - w.from, "day")} on ${w.on}` });
  t.moves.forEach((m, i) => {
    const prev = (i === 0 ? t.due : t.moves[i - 1].to) ?? m.to;
    if (m.to !== null && prev !== null) steps.push({ day: m.day, kind: "moved", text: `Date moved from ${fmtDay(p, prev)} to ${fmtDay(p, m.to)}` });
  });
  if (t.done !== null) steps.push({ day: t.done, kind: "done", text: "Finished" });
  return steps.sort((a, b) => a.day - b.day || STEP_RANK[a.kind] - STEP_RANK[b.kind]);
}

export const slippers = (p: ReplayProject, d: number) => p.tasks.filter((t) => t.created <= d && movesBy(t, d) >= 2).sort((a, b) => movesBy(b, d) - movesBy(a, d));

/** Summary for a finished project. */
export function finishSummary(p: Replay) {
  if (!p.finish) return null;
  const early = p.finish.due - p.finish.day;
  const span = spanOf(p).words;
  const big = biggestWeek(p);
  let longest: { t: Task; days: number; on: string } | null = null;
  for (const t of p.tasks) for (const w of t.waits) if (!longest || w.to - w.from > longest.days) longest = { t, days: w.to - w.from, on: w.on };
  return {
    headline:
      early >= 0
        ? `Done ${plural(early, "day")} early. ${p.tasks.length} tasks in ${span}.`
        : `Wrapped up ${plural(-early, "day")} after ${p.targetName}. ${p.tasks.length} tasks in ${span}.`,
    big,
    longest,
    moved: p.tasks.reduce((n, t) => n + t.moves.length, 0),
  };
}
