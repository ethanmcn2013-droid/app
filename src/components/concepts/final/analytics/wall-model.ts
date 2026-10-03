/**
 * Analytics, all-projects lens: every project counted by week from the same
 * task histories the replay plays back, and one forecast that Ask quotes too.
 *
 * Days are counted from today (Friday 25 September 2026 = 0). Weeks start on
 * Monday; there are 26 of them, the last one (21 Sep) is this week and is only
 * five days old.
 */

import { forecast as storeForecast, type DemoState, type Forecast, type ProjectId } from "../../demo/store";
import { HEALTH_WORDS, healthKey, type HealthKey } from "../../demo/health";
import { dueAt, lateAt, statusAt, type Replay } from "./replay-model";
import { PERSON_NAME, type Health } from "./world";

export const WEEKS = 26;
export const THIS_WEEK = WEEKS - 1;
/** Days of this week that have happened (Mon to Fri). */
export const THIS_WEEK_DAYS = 5;

const TODAY_UTC = Date.UTC(2026, 8, 25);
const DAY = 86_400_000;

export const dateOf = (day: number) => new Date(TODAY_UTC + day * DAY);
/** Day number of the Monday that starts week `w`. */
export const weekStart = (w: number) => -4 - (THIS_WEEK - w) * 7;
/** The week a day falls in (may be below 0 for older days). */
export const weekOf = (day: number) => THIS_WEEK - Math.floor((-4 - day + 6) / 7);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A date outside this year carries its year: "12 Mar 2027". */
const yearOf = (d: Date) => (d.getUTCFullYear() === 2026 ? "" : ` ${d.getUTCFullYear()}`);
export const fmtDay = (day: number) => {
  const d = dateOf(day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${yearOf(d)}`;
};
export const fmtDayLong = (day: number) => {
  const d = dateOf(day);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${yearOf(d)}`;
};
export const fmtWeekday = (day: number) => WEEKDAYS[dateOf(day).getUTCDay()];

export type Person = { name: string; open: number };
/** One thing that needs a look. `title` is a task title inside `text`, linked by `taskId`. */
export type Issue = { text: string; tone: "danger" | "warning" | "neutral"; taskId?: string; title?: string };

export type Project = {
  id: string;
  name: string;
  short: string;
  /** What the big date is: "Wedding", "Supper club". */
  dateLabel: string;
  /** 1..9 maps to --v3-project-n; 0 is a finished grey. */
  hue: number;
  initials: string;
  health: Health;
  /** The lead's reason, when it is not On track. */
  healthReason?: string;
  tooEarly: boolean;
  canon: boolean;
  /** How the big date reads mid-sentence: "the wedding". */
  targetName: string;
  lead: string;
  bigDate: number;
  /** The week work began (0..25). */
  start: number;
  /** The day work began, from today: earlier tasks were set-up before a quiet stretch. */
  startDay: number;
  finished: number[];
  added: number[];
  /** Open at the end of every week (today for this week), counted from the records. */
  openSeries: number[];
  /** Of each week's finished things, how many were done after their due date. */
  finishedLate: number[];
  late: number;
  /** Days the oldest late thing has been late. */
  oldestLate: number;
  /** Median days from added to finished. */
  usualDays: number;
  people: Person[];
  issues: Issue[];
  /** Global day it finished, for a finished project. */
  doneOn: number | null;
  total: number;
  /** The store's forecast for an active project, from the same state. */
  fc: Forecast | null;
};

export const tileColor = (hue: number) => (hue ? `var(--v3-project-${hue})` : "var(--v3-text-3)");

const g = (r: Replay, d: number) => d + r.offset;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function openAt(r: Replay, idx: number) {
  return r.tasks.filter((t) => {
    const s = statusAt(t, idx);
    return s !== null && s !== "done";
  });
}

/** Open on a global day: every task added by then and not yet finished. */
function openOn(r: Replay, day: number) {
  const idx = Math.min(day - r.offset, r.last);
  return idx < 0 ? 0 : openAt(r, idx).length;
}

/** Count one project by week, from its tasks; the forecast reads the same state. */
export function wallProject(r: Replay, state: DemoState): Project {
  const finished = new Array<number>(WEEKS).fill(0);
  const added = new Array<number>(WEEKS).fill(0);
  const finishedLate = new Array<number>(WEEKS).fill(0);
  for (const t of r.tasks) {
    const cw = weekOf(g(r, t.created));
    if (cw >= 0 && cw < WEEKS) added[cw]++;
    if (t.done !== null) {
      const dw = weekOf(g(r, t.done));
      if (dw >= 0 && dw < WEEKS) {
        finished[dw]++;
        const due = dueAt(t, t.done);
        if (due !== null && t.done > due) finishedLate[dw]++;
      }
    }
  }
  const idx = Math.min(r.today, r.last);
  const open = openAt(r, idx);
  const lateTasks = open.filter((t) => lateAt(t, idx));
  const openSeries = Array.from({ length: WEEKS }, (_, w) => openOn(r, w === THIS_WEEK ? 0 : weekStart(w) + 6));
  const people = r.people
    .map((p) => ({ name: p.name, open: open.filter((t) => t.person === p.id).length }))
    .filter((p) => p.open > 0)
    .sort((a, b) => b.open - a.open);
  const usual = median(r.tasks.filter((t) => t.done !== null).map((t) => t.done! - t.created));
  return {
    id: r.id,
    name: r.name,
    short: r.short,
    dateLabel: r.kindLabel,
    hue: r.tile,
    initials: r.initials,
    health: r.health,
    healthReason: r.healthReason,
    tooEarly: r.tooEarly,
    canon: r.canon,
    targetName: r.targetName,
    lead: PERSON_NAME[r.lead] ?? r.lead,
    bigDate: g(r, r.bigDay.day),
    start: Math.max(0, weekOf(r.offset)),
    startDay: r.offset,
    finished,
    added,
    openSeries,
    finishedLate,
    late: lateTasks.length,
    oldestLate: lateTasks.reduce((m, t) => Math.max(m, idx - (dueAt(t, idx) ?? idx)), 0),
    usualDays: usual,
    people,
    issues: issuesFor(r, idx, open),
    doneOn: r.finish ? g(r, r.finish.day) : null,
    total: r.tasks.length,
    fc: r.finish ? null : storeForecast(state, r.id as ProjectId),
  };
}


/** What needs a look, worst first: the things the team would chase today. Late is always red. */
function issuesFor(r: Replay, idx: number, open: Replay["tasks"]): Issue[] {
  const out: Issue[] = [];
  const late = open
    .filter((t) => lateAt(t, idx))
    .map((t) => ({ t, days: idx - (dueAt(t, idx) ?? idx) }))
    .sort((a, b) => b.days - a.days);
  const slipping = open.filter((t) => t.moves.length >= 2).sort((a, b) => b.moves.length - a.moves.length);
  const waiting = open
    .map((t) => ({ t, w: t.waits.find((w) => w.from <= idx && idx < w.to) }))
    .filter((x) => x.w)
    .map((x) => ({ t: x.t, on: x.w!.on, days: idx - x.w!.from }))
    .sort((a, b) => b.days - a.days);
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  if (late[0]) out.push({ text: `${late[0].t.title} is ${days(late[0].days)} late`, tone: "danger", taskId: late[0].t.id, title: late[0].t.title });
  if (slipping[0])
    out.push({ text: `${slipping[0].title} has moved ${slipping[0].moves.length === 2 ? "twice" : `${slipping[0].moves.length} times`}`, tone: "warning", taskId: slipping[0].id, title: slipping[0].title });
  if (waiting[0] && waiting[0].days >= 5 && !out.some((o) => o.taskId === waiting[0].t.id))
    out.push({ text: `${waiting[0].t.title} has waited ${days(waiting[0].days)} on ${waiting[0].on}`, tone: "warning", taskId: waiting[0].t.id, title: waiting[0].t.title });
  const soon = open.filter((t) => {
    const due = dueAt(t, idx);
    return due !== null && due - idx >= 0 && due - idx <= 7;
  }).length;
  if (soon) out.push({ text: `${soon} ${soon === 1 ? "task is" : "tasks are"} due in the next 7 days`, tone: "neutral" });
  return out;
}

/* ── derived: the forecast and status ───────────────────────────────── */

export type Period = 6 | 12 | 26;
/** Six weeks first: most projects' work began inside it, so the bars start full, not empty. */
export const PERIODS: { value: Period; label: string; long: string }[] = [
  { value: 6, label: "6 weeks", long: "last 6 weeks" },
  { value: 12, label: "12 weeks", long: "last 12 weeks" },
  { value: 26, label: "6 months", long: "last 6 months" },
];

export type SortKey = "look" | "date" | "late" | "changed" | "name";
export const SORTS: { value: SortKey; label: string }[] = [
  // The default: projects that are at risk or off track lead, soonest date first, so the wall
  // opens on the cards with something to say. The rest follow by date.
  { value: "look", label: "Needs a look" },
  { value: "date", label: "Next big date" },
  { value: "late", label: "Most late" },
  { value: "changed", label: "Most added" },
  { value: "name", label: "Name" },
];

/** Project health in the shared words: On track, At risk, Off track, Too early to tell. */
export type Status = HealthKey;
export const STATUS_WORD: Record<Status, string> = HEALTH_WORDS;

/** Weeks the header's "finished lately" total counts. */
export const PACE_WEEKS = 4;

export type Derived = {
  p: Project;
  open: number;
  /** Open count at the end of every week. */
  openSeries: number[];
  doneThisWeek: number;
  donePeriod: number;
  addedPeriod: number;
  onTime: number | null;
  /** Of `donePeriod`, how many were finished by their due date. */
  onTimeCount: number;
  /** Open work that has to be done by the big date (the store's forecast). */
  remaining: number;
  /** Finished in the last 7 days. */
  doneRecently: number;
  /** Tasks finished a week, at the store's forecast pace. */
  pace: number;
  /** The pace came from the whole project, as nothing finished in the last 7 days. */
  paceSinceStart: boolean;
  verdict: "ahead" | "tight" | "behind" | "too_early" | "done";
  ready: number | null;
  readyEarly: number | null;
  readyLate: number | null;
  spare: number | null;
  status: Status;
  reason: string | null;
  /** Too early to tell: no forecast yet. */
  young: boolean;
  /** Started this many weeks ago. */
  weeksOld: number;
  hasWork: boolean;
};

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export function derive(p: Project, period: Period): Derived {
  const from = WEEKS - period;
  const openSeries = p.openSeries;
  const open = openSeries[THIS_WEEK];
  const hasWork = p.total > 0;
  const weeksOld = THIS_WEEK - p.start;
  // The one forecast every surface quotes: open work due by the date against the last 7 days' pace.
  const f = p.fc;
  const young = p.tooEarly || f?.verdict === "too_early";
  const ready = f?.finish ? daysFromToday(f.finish) : null;
  const need = f?.daysNeeded ?? null;
  const readyEarly = ready !== null && need !== null ? Math.ceil(need / 1.2) : null;
  const readyLate = ready !== null && need !== null ? Math.ceil(need / 0.82) : null;
  const status = healthKey(p.health, p.tooEarly);
  const donePeriod = sum(p.finished.slice(from));
  const lateDone = sum(p.finishedLate.slice(from));
  return {
    p,
    open,
    openSeries,
    doneThisWeek: p.finished[THIS_WEEK],
    donePeriod,
    addedPeriod: sum(p.added.slice(Math.max(from, p.start + 1))),
    onTime: donePeriod > 0 ? 1 - lateDone / donePeriod : null,
    onTimeCount: donePeriod - lateDone,
    remaining: f?.remaining ?? 0,
    doneRecently: f?.doneRecently ?? 0,
    pace: f ? Math.round(f.pacePerDay * 7 * 10) / 10 : 0,
    paceSinceStart: !!f && f.doneRecently === 0,
    verdict: f?.verdict ?? "done",
    ready: young ? null : ready,
    readyEarly: young ? null : readyEarly,
    readyLate: young ? null : readyLate,
    spare: young ? null : (f?.spare ?? null),
    status,
    reason: status === "at_risk" || status === "off_track" ? (p.healthReason ?? p.issues[0]?.text ?? null) : null,
    young,
    weeksOld,
    hasWork,
  };
}

const daysFromToday = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - TODAY_UTC) / DAY);

export function sortBy(list: Derived[], key: SortKey): Derived[] {
  const out = [...list];
  const byName = (a: Derived, b: Derived) => a.p.name.localeCompare(b.p.name);
  if (key === "name") return out.sort(byName);
  if (key === "late") return out.sort((a, b) => b.p.late - a.p.late || b.p.oldestLate - a.p.oldestLate || byName(a, b));
  if (key === "changed") return out.sort((a, b) => b.addedPeriod - a.addedPeriod || byName(a, b));
  const byDate = (a: Derived, b: Derived) => a.p.bigDate - b.p.bigDate || byName(a, b);
  if (key === "look") {
    const trouble = (d: Derived) => (d.status === "at_risk" || d.status === "off_track" ? 0 : 1);
    return out.sort((a, b) => trouble(a) - trouble(b) || byDate(a, b));
  }
  return out.sort(byDate);
}

/** The largest weekly finished count in the window, across every project given. */
export function sharedMax(list: Derived[], period: Period) {
  let m = 0;
  for (const d of list) for (let w = WEEKS - period; w < WEEKS; w++) m = Math.max(m, d.p.finished[w]);
  return Math.max(1, m);
}

export function ownMax(d: Derived, period: Period) {
  let m = 0;
  for (let w = WEEKS - period; w < WEEKS; w++) m = Math.max(m, d.p.finished[w]);
  return Math.max(1, m);
}

export function weekLabel(w: number) {
  return w === THIS_WEEK ? "This week" : `Week of ${fmtDay(weekStart(w))}`;
}

export function weekSummary(list: Derived[], w: number) {
  let total = 0;
  let topProject: Derived | null = null;
  for (const d of list) {
    const v = d.p.finished[w];
    total += v;
    if (!topProject || v > topProject.p.finished[w]) topProject = d;
  }
  return { total, topProject };
}

/** "4 of 4": finished by their due date, of everything finished in the period. Never a bare percentage. */
export const onTimeText = (d: Pick<Derived, "onTime" | "onTimeCount" | "donePeriod">) => (d.onTime === null ? "–" : `${d.onTimeCount} of ${d.donePeriod}`);
export const periodWords = (period: Period) => (period === 26 ? "last 6 months" : `last ${period} weeks`);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "in 8 days", "today", "3 days ago". */
export const inDays = (n: number) => (n === 0 ? "today" : n > 0 ? `in ${plural(n, "day")}` : `${plural(-n, "day")} ago`);

/** Readable gap between the likely finish and the big date. */
export function spareWords(d: Derived) {
  if (d.spare === null) return null;
  if (d.spare === 0) return "right on the day";
  return d.spare > 0 ? `${plural(d.spare, "day")} to spare` : `${plural(-d.spare, "day")} past the date`;
}

export { PERSON_NAME };
