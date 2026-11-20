/*
 * Analytics, Ask lens: what each answer reads, built from the same task
 * histories the replay plays and the wall counts. Nothing here is typed in by
 * hand: open, late, waiting, pace and the forecast all come from the live
 * store, through ./world. `askWorld` builds them once per store state.
 *
 * Every date is a day offset from today, Friday 25 September 2026 (day 0).
 * Weekly series run oldest first over 14 weeks; index 13 is this week, the
 * same weeks as the wall's last 14.
 */

import { dueAt, lateAt, statusAt, type Replay } from "./replay-model";
import { THIS_WEEK, derive, type Derived, type Project as WallProject } from "./wall-model";
import { OUTSIDERS, PERSON_NAME } from "./world";

export type Day = number;
const WEEKDAY_LONG: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
export const TODAY = new Date(2026, 8, 25);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dateOf(d: Day) {
  const out = new Date(TODAY);
  out.setDate(out.getDate() + d);
  return out;
}
/** "18 Sep" */
export function fmtShort(d: Day) {
  const x = dateOf(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}${yearOf(x)}`;
}
/** A date outside this year carries its year: "12 Mar 2027". */
function yearOf(x: Date) {
  return x.getFullYear() === 2026 ? "" : ` ${x.getFullYear()}`;
}
/** "3 Oct": the house date. */
export function fmtLong(d: Day) {
  return fmtShort(d);
}
/** "Sat 3 Oct" */
export function fmtDay(d: Day) {
  const x = dateOf(d);
  return `${WEEKDAYS[x.getDay()].slice(0, 3)} ${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}${yearOf(x)}`;
}
export function weekdayShort(d: Day) {
  return WEEKDAYS[dateOf(d).getDay()].slice(0, 3);
}
export function monthOf(d: Day) {
  return MONTHS[dateOf(d).getMonth()];
}
/** Monday that starts week i (0..13) of the history. */
export function weekStart(i: number): Day {
  return -4 - 7 * (13 - i);
}

export type ReasonId = "reply" | "start" | "tight";
export const REASONS: Record<ReasonId, string> = {
  reply: "Waiting on a reply",
  start: "Not started",
  tight: "Started, not finished",
};

export type Group = {
  id: string;
  name: string;
  /** How the group reads mid-sentence: "venue tasks". */
  noun: string;
  /** Subject and verb for "how long": "Venue tasks take". */
  says: string;
  /** Tasks from the last 8 weeks (open now, or finished in that time), looked at for slipping. */
  recent: number;
  recentMoved: number;
  moves: number;
  open: number;
  done: number;
  p25: number;
  median: number;
  p75: number;
  tone?: string;
};

export type Person = { id: string; name: string; open: number; dueNext: number; finished4w: number; project?: string };
/** `task` is the store task id, so a row can open the task itself. */
export type Outsider = { id: string; name: string; role: string; tasks: number; moved: number; moves: number; last: Day; project?: string };
export type Moved = { id: string; task: string; title: string; who: string; from: Day; hops: Day[]; lastMovedOn: Day; project?: string };
export type Late = { id: string; task: string; title: string; name?: string; person: string; daysLate: number; reason: ReasonId; on?: string; project?: string };
export type Waiting = { id: string; task: string; title: string; on: string; days: number; project?: string };
export type Upcoming = { id: string; task: string; title: string; lane: string; day: Day; project?: string };
export type Pick = { id: string; task: string; title: string; day: number; person: string; rank?: 1 | 2 | 3; why: string; project?: string };

/** A bold phrase that points at chart marks; `task` or `project` makes it a link. */
export type Part = string | { b: string; marks: string[]; task?: string; project?: string };

export type TimeShare = { waiting: number; doing: number; notStarted: number };

export type ProjectData = {
  id: string;
  name: string;
  short: string;
  tone: string;
  kind: string;
  /** full: enough history; thin: too new to say much; done: finished; all: every project. */
  status: "full" | "thin" | "done" | "all";
  team: string[];
  target: { day: Day; name: string } | null;
  taskCount: number;
  doneCount: number;
  /** Words for the people outside the team whose replies things wait on. */
  outsiderWord: { one: string; many: string; question: string };
  groupWord: string;
  weeks: { finished: number[]; added: number[]; moved: number[]; open: number[]; remaining: number[] };
  /** The forecast the wall draws, so both lenses say the same date. */
  forecast: Derived | null;
  lateLastWeek: number;
  waitingLastWeek: number;
  groups: Group[];
  people: Person[];
  unassigned: number;
  outsiders: Outsider[];
  moved: Moved[];
  late: Late[];
  waiting: Waiting[];
  upcoming: Upcoming[];
  picks: Pick[];
  pickSentence: Part[];
  doneThisWeek: string[];
  time: TimeShare;
  timeDays: TimeShare;
  /** Health in the shared words. */
  health: "on_track" | "at_risk" | "off_track";
  tooEarly: boolean;
  lead: string;
  /** Short explanations when there is too little data to answer. Keyed by question id. */
  thin: Record<string, string>;
  /** For All projects only: the active projects it adds up. Empty for one project. */
  members: ProjectData[];
};

/* ── from a replay history to an answerable project ──────────────────── */

const WEEKS14 = Array.from({ length: 14 }, (_, i) => i);
const g = (r: Replay, d: number) => d + r.offset;
const pct = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))];
};
/** A task title inside a sentence: quoted, as written. */
export const quoted = (t: string) => `“${t}”`;

function openIn(r: Replay, idx: number) {
  return r.tasks.filter((t) => {
    const s = statusAt(t, idx);
    return s !== null && s !== "done";
  });
}

function build(r: Replay, wall: WallProject | undefined): ProjectData {
  const idx = Math.min(r.today, r.last);
  const done = !!r.finish;
  const forecast = wall && !done ? derive(wall, 12) : null;
  const status: ProjectData["status"] = done ? "done" : forecast?.young ? "thin" : "full";
  const open = openIn(r, idx);
  const bigDate = g(r, r.bigDay.day);
  const inWeek = (day: number, i: number) => day >= weekStart(i) && day < weekStart(i) + 7;
  const moves = r.tasks.flatMap((t) => t.moves.map((m) => ({ t, m })));

  const weeks = {
    finished: WEEKS14.map((i) => wall?.finished[THIS_WEEK - 13 + i] ?? 0),
    added: WEEKS14.map((i) => wall?.added[THIS_WEEK - 13 + i] ?? 0),
    moved: WEEKS14.map((i) => moves.filter(({ m }) => inWeek(g(r, m.day), i)).length),
    open: WEEKS14.map((i) => wall?.openSeries[THIS_WEEK - 13 + i] ?? 0),
    // Work that has to be done by the big date: the store forecast's "remaining", week by week.
    remaining: WEEKS14.map((i) => {
      const d = Math.min(idx, (i === 13 ? 0 : weekStart(i) + 6) - r.offset);
      if (d < 0) return 0;
      return openIn(r, d).filter((t) => {
        const due = dueAt(t, d);
        return !t.afterEvent && (due === null || due <= r.bigDay.day);
      }).length;
    }),
  };

  const lateOn = (d: number) => openIn(r, d).filter((t) => lateAt(t, d)).length;
  const waitingAt = (d: number) => r.tasks.filter((t) => statusAt(t, d) === "waiting").length;

  const groups: Group[] = r.groups.map((gr) => {
    const ts = r.tasks.filter((t) => t.group === gr.id);
    const finished = ts.filter((t) => t.done !== null);
    const recent = ts.filter((t) => (t.done === null ? statusAt(t, idx) !== null : g(r, t.done) > -56));
    const spans = finished.map((t) => Math.max(1, t.done! - (t.started ?? t.created)));
    const noun = `tasks in ${gr.name}`;
    return {
      id: `g-${gr.id}`,
      name: gr.name,
      noun,
      says: `Tasks in ${gr.name} take`,
      recent: recent.length,
      recentMoved: recent.filter((t) => t.moves.length > 0).length,
      moves: ts.reduce((n, t) => n + t.moves.length, 0),
      open: ts.filter((t) => open.includes(t)).length,
      done: finished.length,
      p25: pct(spans, 0.25),
      median: pct(spans, 0.5),
      p75: pct(spans, 0.75),
    };
  });

  const people: Person[] = r.people
    .map((p) => {
      const mine = open.filter((t) => t.person === p.id);
      return {
        id: `p-${p.id}`,
        name: p.name,
        open: mine.length,
        dueNext: mine.filter((t) => {
          const due = dueAt(t, idx);
          const d = due === null ? -1 : g(r, due);
          return d >= 3 && d <= 9;
        }).length,
        finished4w: r.tasks.filter((t) => t.person === p.id && t.done !== null && g(r, t.done) > -28).length,
      };
    })
    .filter((p) => !done || p.finished4w > 0);

  const waitedOn = new Map<string, Set<string>>();
  for (const t of r.tasks) for (const w of t.waits) waitedOn.set(w.on, (waitedOn.get(w.on) ?? new Set()).add(t.id));
  const outsiders: Outsider[] = [...waitedOn.entries()].map(([name, ids]) => {
    const ts = r.tasks.filter((t) => ids.has(t.id));
    const lastMove = Math.max(-999, ...ts.flatMap((t) => t.moves.map((m) => g(r, m.day))));
    return {
      id: `o-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      name,
      role: OUTSIDERS[name] ?? "",
      tasks: ts.length,
      moved: ts.filter((t) => t.moves.length).length,
      moves: ts.reduce((n, t) => n + t.moves.length, 0),
      last: lastMove === -999 ? 0 : lastMove,
    };
  });

  const moved: Moved[] = r.tasks
    .filter((t) => t.moves.length)
    .map((t) => ({
      id: `m-${t.id}`,
      task: t.id,
      title: t.title,
      who: t.waits.at(-1)?.on ?? PERSON_NAME[t.person] ?? t.person,
      from: g(r, t.due ?? 0),
      hops: t.moves.flatMap((m) => (m.to === null ? [] : [g(r, m.to)])),
      lastMovedOn: g(r, t.moves.at(-1)!.day),
    }));

  const waitNow = (t: Replay["tasks"][number]) => t.waits.find((w) => w.from <= idx && idx < w.to);
  const late: Late[] = open
    .filter((t) => lateAt(t, idx))
    .map((t) => {
      const w = waitNow(t);
      const s = statusAt(t, idx);
      return {
        id: `l-${t.id}`,
        task: t.id,
        title: t.title,
        name: quoted(t.title),
        person: PERSON_NAME[t.person] ?? t.person,
        daysLate: idx - (dueAt(t, idx) ?? idx),
        reason: (w ? "reply" : s === "todo" ? "start" : "tight") as ReasonId,
        on: w?.on,
      };
    });

  const waiting: Waiting[] = open
    .filter((t) => waitNow(t))
    .map((t) => ({ id: `w-${t.id}`, task: t.id, title: t.title, on: waitNow(t)!.on, days: Math.max(1, idx - waitNow(t)!.from) }));

  const dueDay = (t: Replay["tasks"][number]) => {
    const due = dueAt(t, idx);
    return due === null ? null : g(r, due);
  };
  const upcoming: Upcoming[] = open
    .map((t) => ({ t, day: dueDay(t) }))
    .filter((x): x is { t: Replay["tasks"][number]; day: number } => x.day !== null && x.day >= 1 && x.day <= 14)
    .map(({ t, day }) => ({ id: `u-${t.id}`, task: t.id, title: t.title, lane: r.groups.find((x) => x.id === t.group)?.name ?? "Other", day }));

  // Next week, in order: what is late first (longest first), then what falls due.
  const lateSorted = [...late].sort((a, b) => b.daysLate - a.daysLate);
  const dueNext = open
    .map((t) => ({ t, day: dueDay(t) ?? -1 }))
    .filter((x) => x.day >= 3 && x.day <= 9 && !late.some((l) => l.id === `l-${x.t.id}`))
    .sort((a, b) => a.day - b.day);
  const picks: Pick[] = [];
  lateSorted.slice(0, 3).forEach((l, i) => {
    picks.push({ id: `k-${l.id}`, task: l.task, title: l.title, day: Math.min(i, 1), person: l.person, why: `${l.daysLate} ${l.daysLate === 1 ? "day" : "days"} late${l.on ? `, waiting on ${l.on}` : ""}` });
  });
  for (const x of dueNext) {
    if (picks.length >= 7) break;
    picks.push({ id: `k-${x.t.id}`, task: x.t.id, title: x.t.title, day: Math.max(0, Math.min(4, x.day - 3)), person: PERSON_NAME[x.t.person] ?? x.t.person, why: `Due ${weekdayShort(x.day)}` });
  }
  picks.slice(0, 3).forEach((k, i) => (k.rank = (i + 1) as 1 | 2 | 3));
  const [k1, k2, k3] = picks;
  const pickSentence: Part[] = [];
  if (k1) {
    pickSentence.push("Start with ", { b: quoted(k1.title), marks: [k1.id], task: k1.task }, `: ${k1.why.startsWith("Due") ? `it is due ${WEEKDAY_LONG[k1.why.slice(4)] ?? k1.why.slice(4)}` : `it is ${k1.why}`}.`);
    if (k2) pickSentence.push(" Then ", { b: quoted(k2.title), marks: [k2.id], task: k2.task }, k2.why.startsWith("Due") ? ` by ${WEEKDAY_LONG[k2.why.slice(4)] ?? k2.why.slice(4)}` : "", k3 ? ", and " : ".");
    if (k3) pickSentence.push({ b: quoted(k3.title), marks: [k3.id], task: k3.task }, k3.why.startsWith("Due") ? ` by ${WEEKDAY_LONG[k3.why.slice(4)] ?? k3.why.slice(4)}.` : ".");
  }

  // Where time goes once a task is started, over the last 14 weeks: doing
  // the work, or waiting on someone outside the team.
  const from = Math.max(0, idx - 97);
  const days = { waiting: 0, doing: 0, notStarted: 0 };
  const seen = { waiting: new Set<string>(), doing: new Set<string>(), notStarted: new Set<string>() };
  for (const t of r.tasks)
    for (let d = Math.max(from, t.created); d <= idx; d++) {
      const s = statusAt(t, d);
      if (s !== "waiting" && s !== "doing" && s !== "review") continue;
      const k = s === "waiting" ? "waiting" : "doing";
      days[k]++;
      seen[k].add(t.id);
    }
  const totalDays = days.waiting + days.doing || 1;
  const time: TimeShare = {
    waiting: Math.round((days.waiting / totalDays) * 100),
    doing: 0,
    notStarted: 0,
  };
  time.doing = 100 - time.waiting;
  const per = (k: keyof TimeShare) => Math.round((days[k] / Math.max(1, seen[k].size)) * 10) / 10;

  const thin: Record<string, string> = {};
  if (status === "thin") {
    const daysIn = Math.max(0, r.today);
    const ago = daysIn === 0 ? "today" : daysIn < 14 ? `${daysIn} ${daysIn === 1 ? "day" : "days"} ago` : `${Math.round(daysIn / 7)} weeks ago`;
    const why = `${r.short} started ${ago}`;
    const finishedN = r.tasks.filter((t) => t.done !== null).length;
    const fewDone = finishedN === 0 ? "Nothing is finished yet" : `Only ${finishedN} ${finishedN === 1 ? "task is" : "tasks are"} finished`;
    thin["on-course"] = `Too early to tell. ${why} and is marked too early to judge, so there is no forecast yet.`;
    thin["getting-better"] = `${why}, so there is nothing to compare with yet. Ask again in a few weeks.`;
    thin["changed"] = daysIn < 7 ? `${why}, so there is no last week to compare with. Ask again next week.` : `${why}, so last week was its first. Ask again next week.`;
    thin["slipping"] = "No dates have moved yet, so nothing is slipping.";
    thin["which-outsider"] = "No dates have moved yet, so nobody outside the team is slipping.";
    thin["those-tasks"] = "No dates have moved yet, so there are no tasks to show.";
    thin["how-long"] = `${fewDone}, too few to say how long things take.`;
    thin["late"] = "Nothing is late.";
    thin["time-goes"] = `${why}, too new to show where time goes.`;
    thin["who-did"] = `${fewDone}. Ask again once a few more are done.`;
  }
  if (status === "done") {
    const doneOn = fmtShort(g(r, r.finish!.day));
    const gone = `${r.name} finished on ${doneOn}, so there is nothing left to plan.`;
    for (const q of ["changed", "who-busy", "first-next-week", "late", "waiting-longest", "left", "coming-up"]) thin[q] = gone;
    const early = r.finish!.due - r.finish!.day;
    thin["on-course"] =
      early >= 0
        ? `Yes. ${r.name} finished on ${doneOn}, ${early} ${early === 1 ? "day" : "days"} before ${r.targetName}, with all ${r.tasks.length} tasks done.`
        : `Yes. ${r.name} ran to plan: all ${r.tasks.length} tasks were done by ${doneOn}, with the wrap-up closing ${-early} ${early === -1 ? "day" : "days"} after ${r.targetName}.`;
    thin["done-week"] = `${r.name} finished on ${doneOn}. Nothing was finished this week.`;
  }

  return {
    id: r.id,
    name: r.name,
    short: r.short,
    tone: r.tile ? `var(--v3-project-${r.tile})` : "var(--v3-text-3)",
    kind: done ? `Finished ${fmtShort(g(r, r.finish!.day))} · ${r.tasks.length} tasks` : `${r.kindLabel} ${fmtShort(bigDate)} · ${r.people.length} people`,
    status,
    team: r.people.map((p) => p.name),
    target: { day: bigDate, name: r.targetName },
    taskCount: r.tasks.length,
    doneCount: r.tasks.filter((t) => t.done !== null).length,
    outsiderWord: { one: "person outside the team", many: "people outside the team", question: "Who outside the team slips most?" },
    groupWord: "group",
    weeks,
    forecast,
    lateLastWeek: lateOn(Math.max(0, idx - 7)),
    waitingLastWeek: waitingAt(Math.max(0, idx - 7)),
    groups,
    people,
    unassigned: 0,
    outsiders,
    moved,
    late,
    waiting,
    upcoming,
    picks,
    pickSentence,
    doneThisWeek: r.tasks.filter((t) => t.done !== null && g(r, t.done) >= -4).map((t) => t.title),
    time,
    timeDays: { waiting: per("waiting"), doing: per("doing"), notStarted: per("notStarted") },
    health: r.health,
    tooEarly: r.tooEarly,
    lead: PERSON_NAME[r.lead] ?? r.lead,
    thin,
    members: [],
  };
}

/* ── All projects: one merged view where the groups are the projects ───── */

function sumWeeks(active: ProjectData[], key: keyof ProjectData["weeks"]) {
  return WEEKS14.map((i) => active.reduce((n, p) => n + p.weeks[key][i], 0));
}
function share(active: ProjectData[], key: keyof TimeShare) {
  const w = active.map((p) => p.taskCount);
  const total = w.reduce((a, b) => a + b, 0) || 1;
  return Math.round(active.reduce((n, p, i) => n + p.time[key] * w[i], 0) / total);
}

/** One row per person or company outside the team, across every project. */
function mergedOutsiders(active: ProjectData[]): Outsider[] {
  const by = new Map<string, Outsider & { in: string[] }>();
  for (const p of active)
    for (const o of p.outsiders) {
      const cur = by.get(o.name) ?? { ...o, id: `all:${o.id}`, tasks: 0, moved: 0, moves: 0, last: -999, in: [] };
      cur.tasks += o.tasks;
      cur.moved += o.moved;
      cur.moves += o.moves;
      if (o.moves) cur.last = Math.max(cur.last, o.last);
      cur.in.push(p.short);
      by.set(o.name, cur);
    }
  return [...by.values()].map(({ in: projects, ...o }) => ({ ...o, last: o.last === -999 ? 0 : o.last, project: projects.length === 1 ? projects[0] : `${projects.length} projects` }));
}
const tag = <T extends object>(p: ProjectData, rows: T[]) => rows.map((r) => ({ ...r, id: `${p.id}:${(r as { id: string }).id}`, project: p.short }));

/** One person across every project. */
function mergedPeople(active: ProjectData[]): Person[] {
  const by = new Map<string, Person>();
  for (const p of active)
    for (const x of p.people) {
      const cur = by.get(x.name) ?? { id: `all:${x.id}`, name: x.name, open: 0, dueNext: 0, finished4w: 0 };
      cur.open += x.open;
      cur.dueNext += x.dueNext;
      cur.finished4w += x.finished4w;
      by.set(x.name, cur);
    }
  return [...by.values()];
}

function allOf(active: ProjectData[]): ProjectData {
  const avg = (k: keyof TimeShare) => Math.round((active.reduce((n, p) => n + p.timeDays[k], 0) / Math.max(1, active.length)) * 10) / 10;
  const waiting = share(active, "waiting");
  return {
    id: "all",
    name: "All projects",
    short: "All projects",
    tone: "var(--v3-text-2)",
    kind: `${active.length} active projects`,
    status: "all",
    team: [...new Set(active.flatMap((p) => p.team))],
    target: null,
    taskCount: active.reduce((n, p) => n + p.taskCount, 0),
    doneCount: active.reduce((n, p) => n + p.doneCount, 0),
    outsiderWord: { one: "person outside the team", many: "people outside the team", question: "Who outside the team slips most?" },
    groupWord: "project",
    weeks: {
      finished: sumWeeks(active, "finished"),
      added: sumWeeks(active, "added"),
      moved: sumWeeks(active, "moved"),
      open: sumWeeks(active, "open"),
      remaining: sumWeeks(active, "remaining"),
    },
    forecast: null,
    lateLastWeek: active.reduce((n, p) => n + p.lateLastWeek, 0),
    waitingLastWeek: active.reduce((n, p) => n + p.waitingLastWeek, 0),
    groups: active.map((p) => {
      const gs = p.groups;
      const sum = (k: "recent" | "recentMoved" | "moves" | "open" | "done") => gs.reduce((n, x) => n + x[k], 0);
      const doneAll = Math.max(1, gs.reduce((n, x) => n + x.done, 0));
      const w = (k: "median" | "p25" | "p75") => Math.round(gs.reduce((n, x) => n + x[k] * x.done, 0) / doneAll);
      return {
        id: `g-${p.id}`,
        name: p.short,
        noun: `${p.short} tasks`,
        says: `${p.short} tasks take`,
        recent: sum("recent"),
        recentMoved: sum("recentMoved"),
        moves: sum("moves"),
        open: sum("open"),
        done: sum("done"),
        p25: w("p25"),
        median: w("median"),
        p75: w("p75"),
        tone: p.tone,
      };
    }),
    people: mergedPeople(active),
    unassigned: 0,
    outsiders: mergedOutsiders(active),
    moved: active.flatMap((p) => tag(p, p.moved)),
    late: active.flatMap((p) => tag(p, p.late)),
    waiting: active.flatMap((p) => tag(p, p.waiting)),
    upcoming: active.flatMap((p) => tag(p, p.upcoming).map((u) => ({ ...u, lane: p.short }))),
    picks: active.flatMap((p) => tag(p, p.picks.filter((k) => k.rank === 1))),
    pickSentence: [],
    doneThisWeek: active.flatMap((p) => p.doneThisWeek),
    time: { waiting, doing: 100 - waiting, notStarted: 0 },
    timeDays: { waiting: avg("waiting"), doing: avg("doing"), notStarted: avg("notStarted") },
    health: "on_track",
    tooEarly: false,
    lead: "",
    thin: {},
    members: active,
  };
}

export type AskWorld = {
  /** Projects in the scope picker: soonest big date first, finished last. */
  projects: ProjectData[];
  /** Every active project: what "All projects" counts, the same as the Projects ledger. */
  active: ProjectData[];
  all: ProjectData;
  byId: (id: string) => ProjectData;
};

/** What Ask reads, for one state of the store. */
export function askWorld(replays: Replay[], wallOf: (id: string) => WallProject | undefined): AskWorld {
  const projects = replays
    .map((r) => build(r, wallOf(r.id)))
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || (a.target?.day ?? 0) - (b.target?.day ?? 0));
  const active = projects.filter((p) => p.status !== "done");
  const all = allOf(active);
  const byIdMap = new Map(projects.map((p) => [p.id, p]));
  return { projects, active, all, byId: (id) => (id === "all" ? all : (byIdMap.get(id) ?? all)) };
}

/** The tone of a project named by its short name, among the projects All projects adds up. */
export const toneIn = (p: ProjectData, short?: string) => p.members.find((x) => x.short === short)?.tone;
