/*
 * Projects: one view of the demo store for both lenses (covers and ledger) and
 * the project home. Every count, owner, date, health, milestone, task, file,
 * status change and update comes from the live state of ../../demo/store, and
 * every edit goes back through its mutations (see ./live.ts). This file only
 * maps the store's records into the shapes the lenses draw, plus the cover-art
 * seed, which is this surface's own.
 */

import {
  FILES,
  HEALTH_LABEL,
  PEOPLE as STORE_PEOPLE,
  PROJECTS as STORE_PROJECTS,
  TEAM,
  TODAY as STORE_TODAY,
  VIEWER,
  addDays as storeAddDays,
  countsFor,
  daysBetween,
  forecast as storeForecast,
  fmtDate as storeFmtDate,
  fmtDay,
  fmtRelative as storeFmtRelative,
  isLate,
  nameOf,
  projectHistory,
  projectUpdates,
  projectsOf,
  templateById,
  TEMPLATES as STORE_TEMPLATES,
  toIso as storeToIso,
  toTime as storeToTime,
  waitingOnName,
  type DemoState,
  type FileRef,
  type Health,
  type ProjectUpdate,
  type PersonId as StorePersonId,
  type ProjectKind,
  type Project as StoreProject,
  type Task as StoreTask,
  type TaskStatus,
} from "../../demo/store";
import { HEALTH_WORDS, healthKey, type HealthKey } from "../../demo/health";

export const TODAY = STORE_TODAY;

export type StatusId = Health | "wrapped";
export type KindId = ProjectKind | "school";
export type PersonId = StorePersonId;

export type Person = {
  id: PersonId;
  name: string;
  short: string;
  initials: string;
  role: string;
  /** --v3-project-n, from the store: never amber, orange or red. */
  tone: number;
  team: boolean;
};

export const PEOPLE = Object.fromEntries(
  STORE_PEOPLE.map((p) => [p.id, { id: p.id, name: p.name, short: p.first, initials: p.initials, role: p.role, tone: p.hue, team: !p.external }]),
) as Record<PersonId, Person>;

/** "You" is always the viewer, Orla. */
export const ME: PersonId = VIEWER;
export const OWNERS: PersonId[] = [...TEAM];

/** Health is set by the lead. Wrapping up is lifecycle, not health, so it is not in this list. */
export const STATUSES: { id: Health; label: string; key: string }[] = [
  { id: "on_track", label: HEALTH_LABEL.on_track, key: "1" },
  { id: "at_risk", label: HEALTH_LABEL.at_risk, key: "2" },
  { id: "off_track", label: HEALTH_LABEL.off_track, key: "3" },
];

export const STATUS_LABEL: Record<StatusId, string> = { ...HEALTH_LABEL, wrapped: "Wrapped" };

export const KINDS: { id: KindId; label: string }[] = [
  { id: "wedding", label: "Wedding" },
  { id: "event", label: "Event" },
  { id: "season", label: "Season" },
  { id: "works", label: "Venue works" },
  { id: "marketing", label: "Marketing" },
  { id: "operations", label: "Operations" },
  { id: "school", label: "School" },
];

export const KIND_LABEL: Record<KindId, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.label])) as Record<KindId, string>;

/** One step in a project's health over time, from the store's project history. "reason" means only the reason changed. */
export type StatusChange = { status: StatusId; date: string; by: PersonId; reason: string; kind: "start" | "change" | "reason" };
/** One post in the project's updates feed. */
export type Update = { id: string; who: PersonId; text: string; date: string; kind: ProjectUpdate["kind"]; seq: number };
export type Milestone = { id: string; name: string; date: string; done: boolean };
export type TaskState = "open" | "waiting" | "review" | "done";
export type Task = {
  id: string;
  title: string;
  who: PersonId;
  due?: string;
  status: TaskStatus;
  state: TaskState;
  /** Who it waits on, by name. */
  waitingOn?: string;
  afterEvent?: boolean;
  late: boolean;
};
export type LinkKind = "doc" | "sheet" | "image" | "folder" | "plan" | "deck";
export type LinkRef = { id: string; label: string; kind: LinkKind; meta: string };
export type Activity = { id: string; who: PersonId; text: string; date: string; kind: "status" | "note" | "task" | "file"; seq?: number };
/** The most pressing open task the viewer owns here: never invented, always one of Orla's tasks. */
export type NeedsYou = { taskId: string; title: string; body: string; short: string; late: number };

export type Project = {
  id: string;
  name: string;
  short: string;
  /** One line about what it is. */
  purpose: string;
  kind: KindId;
  /** Identity colour, --v3-project-n, from the store. */
  tone: number;
  /** Seeds the generated cover. Defaults to the id. */
  artSeed?: string;
  status: StatusId;
  /** No evidence yet: shows "Too early to tell". */
  tooEarly: boolean;
  /** Why it is at risk or off track, set with the status. */
  reason?: string;
  /** One short line: what is true about it now. */
  note: string;
  history: StatusChange[];
  /** The updates feed, newest first. */
  updates: Update[];
  owner: PersonId;
  people: PersonId[];
  start: string;
  /** The project's date: the day itself, or when it is due. */
  date: string;
  /** A season that runs to a last day. */
  end?: string;
  done: number;
  total: number;
  overdue: number;
  review: number;
  waiting: number;
  /** The store's forecast: open work due by the date at the last 7 days' pace. */
  pace: { verdict: "ahead" | "tight" | "behind" | "too_early" | "done"; spare: number | null; finish: string | null; perDay: number; remaining: number };
  /** Tasks finished and added on each of the last 14 days, today last. */
  sparkDone: number[];
  sparkAdded: number[];
  milestones: Milestone[];
  tasks: Task[];
  links: LinkRef[];
  activity: Activity[];
  updatedOn: string;
  updatedBy: PersonId;
  /** When this viewer last opened it, for "Recently opened". Higher is more recent. */
  opened: number;
  needsYou?: NeedsYou;
  wrappedOn?: string;
  /** Wrapped projects: the one line worth remembering. */
  wrapStat?: string;
  /** Made during this review, not one of the sample world's projects. */
  isNew?: boolean;
  /** The template it was seeded from. */
  template?: string;
};

/* ── Dates: the store's one format ─────────────────────────────────── */

export const toTime = storeToTime;
export const toIso = storeToIso;
export const addDays = storeAddDays;

export function daysFromToday(iso: string): number {
  return daysBetween(TODAY, iso);
}

/** "3 Oct", or "14 Mar 2027" outside 2026. */
export function fmtDate(iso: string, withYear = false): string {
  const base = storeFmtDate(iso);
  return withYear && !/\d{4}$/.test(base) ? `${base} ${iso.slice(0, 4)}` : base;
}

export function fmtWeekday(iso: string): string {
  return fmtDay(iso).split(" ")[0];
}

/** "Fri 25 Sep". */
export const dayDate = fmtDay;

/** "today", "tomorrow", "in 17 days", "3 days ago". Always days, never weeks. Lower case. */
export const fmtRelative = storeFmtRelative;

export function capFirst(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** "today", "tomorrow", "Tue" inside a week, "9 Oct" beyond. Lower case for mid-sentence use. */
export function fmtShort(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1 && n < 7) return fmtWeekday(iso);
  return fmtDate(iso);
}

/** "Today", "Yesterday", "Tue", "9 Oct". */
export function weekday(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (Math.abs(n) < 7) return fmtWeekday(iso);
  return fmtDate(iso);
}

/** "today", "yesterday", "3 days ago". */
export function fmtAgo(iso: string): string {
  const n = -daysFromToday(iso);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n} days ago`;
}

export function fmtDaysCount(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthKey(iso: string): string {
  const d = new Date(toTime(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Plain-language dates for the create row and the date editor: "fri", "12 dec", "in 3 weeks", "+5". */
export function parseDate(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === "today") return TODAY;
  if (s === "tomorrow" || s === "tmrw") return addDays(TODAY, 1);
  const rel = s.match(/^(?:in\s+)?\+?(\d+)\s*(d|day|days|w|wk|week|weeks|m|month|months)?$/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2] ?? "d";
    if (!rel[2] && !s.startsWith("+") && !s.startsWith("in")) {
      // A bare number reads as a day of the month.
      if (n >= 1 && n <= 31) {
        for (let i = 0; i < 62; i++) {
          const iso = addDays(TODAY, i);
          if (Number(iso.slice(8)) === n) return iso;
        }
      }
      return null;
    }
    const mult = unit.startsWith("w") ? 7 : unit.startsWith("m") ? 30 : 1;
    return addDays(TODAY, n * mult);
  }
  const wd = WEEKDAYS.findIndex((w) => s === w.toLowerCase() || (s.startsWith(w.toLowerCase()) && s.length <= 9));
  if (wd >= 0) {
    const cur = new Date(toTime(TODAY)).getUTCDay();
    let diff = (wd - cur + 7) % 7;
    if (diff === 0) diff = 7;
    if (s.startsWith("next ")) diff += 7;
    return addDays(TODAY, diff);
  }
  const dm = s.match(/^(\d{1,2})\s*([a-z]{3,})\.?\s*(\d{4})?$/) ?? null;
  const md = s.match(/^([a-z]{3,})\.?\s*(\d{1,2})\s*(\d{4})?$/) ?? null;
  const parts = dm ? { d: Number(dm[1]), m: dm[2], y: dm[3] } : md ? { d: Number(md[2]), m: md[1], y: md[3] } : null;
  if (parts) {
    const mi = MONTHS.findIndex((m) => parts.m.startsWith(m.toLowerCase()));
    if (mi < 0 || parts.d < 1 || parts.d > 31) return null;
    let y = parts.y ? Number(parts.y) : 2026;
    let iso = toIso(Date.UTC(y, mi, parts.d));
    if (!parts.y && daysFromToday(iso) < -30) {
      y += 1;
      iso = toIso(Date.UTC(y, mi, parts.d));
    }
    return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/* ── Health words and marks: the demo's one set ─────────────────────── */

/** The health to show, or null for a wrapped project (lifecycle, not health). */
export function healthOf(p: Pick<Project, "status" | "tooEarly">): HealthKey | null {
  if (p.status === "wrapped") return null;
  return healthKey(p.status, p.tooEarly && p.status === "on_track");
}

/** "On track", "Too early to tell", "Wrapped". */
export function statusWord(p: Pick<Project, "status" | "tooEarly">): string {
  const h = healthOf(p);
  return h ? HEALTH_WORDS[h] : "Wrapped";
}

/* ── Cover art: this surface's own parameters ──────────────────────── */

/**
 * The seed each generated cover is drawn from. The canonical projects keep
 * their own; a project made during a review draws from its kind and name, so
 * any id, known or not, always has a cover.
 */
const ART_SEED: Partial<Record<string, string>> = {
  "mara-finn": "mara-finn",
  "ada-theo": "ada-theo",
  christmas: "christmas",
};
const CANON_IDS = new Set<string>(STORE_PROJECTS.map((p) => p.id));

/** The seed a new cover draws from: its kind and its name. The create card previews with the same seed. */
export function newArtSeed(kind: KindId, name: string): string {
  return `${kind}:${name.trim()}`;
}

function artSeedFor(sp: StoreProject, kind: KindId): string {
  return ART_SEED[sp.id] ?? (CANON_IDS.has(sp.id) ? sp.id : newArtSeed(kind, sp.name));
}

/** The surface's kind: a project seeded from the school template draws the school cover. */
function kindFor(sp: StoreProject): KindId {
  return sp.template === "school" ? "school" : sp.kind;
}

/* ── Building projects from the store ───────────────────────────────── */

const STATE_OF: Record<TaskStatus, TaskState> = { todo: "open", doing: "open", waiting: "waiting", review: "review", done: "done" };

function mapTask(t: StoreTask): Task {
  return {
    id: t.id,
    title: t.title,
    who: t.owner,
    due: t.due,
    status: t.status,
    state: STATE_OF[t.status],
    waitingOn: waitingOnName(t),
    afterEvent: t.afterEvent,
    late: isLate(t),
  };
}

const FILE_KIND: Record<FileRef["kind"], LinkKind> = { sheet: "sheet", doc: "doc", pdf: "doc", image: "image", design: "deck", link: "folder" };

/** The latest version of each document, with the state the store gives it. */
function linksFor(id: string): LinkRef[] {
  const files = FILES.filter((f) => f.project === id);
  const latest = new Map<string, FileRef>();
  for (const f of files) {
    const key = f.series ?? f.id;
    const have = latest.get(key);
    if (!have || f.version > have.version) latest.set(key, f);
  }
  return [...latest.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((f) => ({
      id: f.id,
      label: f.title.replace(/\.(pdf|docx|xlsx|png)$/i, ""),
      kind: FILE_KIND[f.kind],
      meta:
        f.state === "awaiting" && f.awaiting
          ? `With ${f.awaiting === ME ? "you" : nameOf(f.awaiting)}`
          : f.state === "approved" && f.approvedBy
            ? `Approved by ${f.approvedBy === ME ? "you" : nameOf(f.approvedBy)}, ${fmtDate(f.approvedOn ?? f.date)}`
            : f.state === "signed"
              ? "Signed"
              : `Draft, ${fmtDate(f.date)}`,
    }));
}

/** Work that moved: tasks finished, waits begun, tasks added, files shared and approved. */
function workActivity(id: string, tasks: StoreTask[], start: string): Activity[] {
  const out: Activity[] = [];
  for (const t of tasks) {
    if (t.status === "done" && t.doneOn && t.doneOn <= TODAY) out.push({ id: `done-${t.id}`, who: t.owner, text: `Finished “${t.title}”`, date: t.doneOn, kind: "task" });
    if (t.waitingOn && t.waitingOn.since <= TODAY)
      out.push({ id: `wait-${t.id}`, who: t.owner, text: `Waiting on ${nameOf(t.waitingOn.who)} for “${t.title}”`, date: t.waitingOn.since, kind: "task" });
    if (t.created > start && t.created <= TODAY) out.push({ id: `add-${t.id}`, who: t.owner, text: `Added “${t.title}”`, date: t.created, kind: "task" });
  }
  for (const f of FILES.filter((x) => x.project === id)) {
    if (f.date <= TODAY && STORE_PEOPLE.some((p) => p.id === f.by)) out.push({ id: `file-${f.id}`, who: f.by, text: `Shared ${f.title}`, date: f.date, kind: "file" });
    if (f.approvedBy && f.approvedOn && f.approvedOn <= TODAY) out.push({ id: `ok-${f.id}`, who: f.approvedBy, text: `Approved ${f.title}`, date: f.approvedOn, kind: "file" });
  }
  return out;
}

const byRecent = (a: Activity, b: Activity) => b.date.localeCompare(a.date) || (b.seq ?? 0) - (a.seq ?? 0);

/** The store's updates feed, newest first. A health change posts its reason; a wrap posts its line. */
function updatesFor(s: DemoState, id: string): Update[] {
  const feed = projectUpdates(s, id);
  return feed.map((u, i) => ({ id: u.id, who: u.by, text: u.text, date: u.on, kind: u.kind, seq: feed.length - i }));
}

/**
 * Health over time, oldest first, read from the store's project history with
 * real dates: when it started, each change of health (and each new reason),
 * wrapping up and coming back.
 */
function historyOf(s: DemoState, sp: StoreProject): StatusChange[] {
  const events = projectHistory(s, sp.id);
  const firstHealth = events.find((e) => e.kind === "health");
  let now: Health = (firstHealth?.from as Health | undefined) ?? sp.health;
  const out: StatusChange[] = [];
  for (const e of events) {
    if (e.kind === "created") {
      const tpl = e.text ? templateById(e.text) : undefined;
      out.push({ status: now, date: e.on, by: e.by, reason: tpl ? `Started from the ${tpl.name.toLowerCase()} template, with ${tpl.tasks.length} starter tasks.` : "Project started.", kind: "start" });
    } else if (e.kind === "health" && e.to) {
      const to = e.to as Health;
      out.push({ status: to, date: e.on, by: e.by, reason: e.reason ?? "", kind: to === now ? "reason" : "change" });
      now = to;
    } else if (e.kind === "wrapped") {
      out.push({ status: "wrapped", date: e.on, by: e.by, reason: e.text ? `Wrapped up: ${e.text}.` : "Wrapped up.", kind: "change" });
    } else if (e.kind === "unwrapped") {
      out.push({ status: now, date: e.on, by: e.by, reason: "Brought back from Wrapped.", kind: "change" });
    }
  }
  if (out.length === 0) out.push({ status: sp.health, date: sp.start, by: sp.lead, reason: "Project started.", kind: "start" });
  return out;
}

/** Tasks finished and added on each of the last 14 days, read from doneOn and created. */
function sparks(tasks: StoreTask[]): { done: number[]; added: number[] } {
  const done: number[] = [];
  const added: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(TODAY, -i);
    done.push(tasks.filter((t) => t.status === "done" && t.doneOn === day).length);
    added.push(tasks.filter((t) => t.created === day).length);
  }
  return { done, added };
}

/** Orla's most pressing open task in a project: late first, then one waiting on her approval, then the soonest due. */
function needsYouFrom(tasks: Task[], awaitingMe: Set<string>): NeedsYou | undefined {
  const mine = tasks.filter((t) => t.who === ME && t.state !== "done" && !t.afterEvent);
  if (mine.length === 0) return undefined;
  const rank = (t: Task) => (t.late ? 0 : awaitingMe.has(t.id) ? 1 : 2);
  const top = [...mine].sort((a, b) => rank(a) - rank(b) || (a.due ?? "9999").localeCompare(b.due ?? "9999"))[0];
  const late = top.late && top.due ? -daysFromToday(top.due) : 0;
  const soon = top.due ? daysFromToday(top.due) : Infinity;
  if (!late && !awaitingMe.has(top.id) && soon > 7) return undefined;
  const allMine = tasks.filter((t) => t.who === ME && t.state !== "done");
  const lateCount = allMine.filter((t) => t.late).length;
  const title = late
    ? `“${top.title}” is yours and ${fmtDaysCount(late)} late`
    : awaitingMe.has(top.id)
      ? `“${top.title}” is waiting on your approval`
      : `“${top.title}” is yours, due ${fmtShort(top.due!)}`;
  const short = late ? `Yours, ${fmtDaysCount(late)} late: ${top.title}` : awaitingMe.has(top.id) ? `Waiting on your approval: ${top.title}` : `Yours, due ${fmtShort(top.due!)}: ${top.title}`;
  const body = `You own ${allMine.length} open ${allMine.length === 1 ? "task" : "tasks"} here${lateCount ? `, ${lateCount} late` : ""}.`;
  return { taskId: top.id, title, body, short, late };
}

function firstSentence(text: string) {
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : text).replace(/\.$/, "");
}

/** The cover's "what is true now" line when nothing is wrong: the next milestone. */
function calmNote(milestones: Milestone[]): string {
  const next = milestones.filter((m) => !m.done && m.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return "No milestones ahead";
  const n = daysFromToday(next.date);
  return `Next: ${next.name}, ${n <= 6 ? fmtDay(next.date) : fmtDate(next.date)}`;
}

const awaitingMe = new Set(FILES.filter((f) => f.state === "awaiting" && f.awaiting === ME && f.taskId).map((f) => f.taskId!));

function fromStore(sp: StoreProject, s: DemoState, opened: Readonly<Record<string, number>>): Project {
  const raw = s.tasks.filter((t) => t.project === sp.id);
  const tasks = raw.map(mapTask);
  const c = countsFor(s, sp.id);
  const f = storeForecast(s, sp.id);
  const { done, added } = sparks(raw);
  // A seeded project's one milestone is the day itself; say so rather than repeat the project's name.
  const milestones = sp.milestones.map((m) => ({ id: m.id, name: m.title === sp.name ? "The day itself" : m.title, date: m.date, done: m.done }));
  const status: StatusId = sp.wrapped ? "wrapped" : sp.health;
  const reason = sp.health === "on_track" ? undefined : sp.healthReason;
  const updates = updatesFor(s, sp.id);
  const activity = [
    ...workActivity(sp.id, raw, sp.start),
    ...updates.map((u): Activity => ({ id: u.id, who: u.who, text: u.text, date: u.date, kind: u.kind === "update" ? "note" : "status", seq: u.seq })),
  ].sort(byRecent);
  const latest = activity[0];
  const people = sp.people.includes(sp.lead) ? sp.people : [sp.lead, ...sp.people];
  const kind = kindFor(sp);
  const fresh = !CANON_IDS.has(sp.id);
  const note =
    status === "wrapped"
      ? `${c.done} of ${c.total} tasks, wrapped ${fmtDate(sp.wrapped!.on)}`
      : (status === "at_risk" || status === "off_track") && reason
        ? firstSentence(reason)
        : tasks.length === 0
          ? "No tasks yet. Add the first few"
          : fresh && c.done === 0
            ? `${c.total} starter tasks, ${calmNote(milestones).replace(/^Next: /, "next: ")}`
            : calmNote(milestones);
  return {
    id: sp.id,
    name: sp.name,
    short: sp.short,
    purpose: sp.wrapped && !fresh ? sp.wrapped.stat : sp.note,
    kind,
    tone: sp.hue,
    artSeed: artSeedFor(sp, kind),
    status,
    tooEarly: !!sp.tooEarly && sp.health === "on_track",
    reason,
    note,
    history: historyOf(s, sp),
    updates,
    owner: sp.lead,
    people,
    start: sp.start,
    date: sp.date,
    end: sp.end,
    done: c.done,
    total: c.total,
    overdue: c.late,
    review: c.review,
    waiting: c.waiting,
    pace: { verdict: f.verdict, spare: f.spare, finish: f.finish, perDay: f.pacePerDay, remaining: f.remaining },
    sparkDone: done,
    sparkAdded: added,
    milestones,
    tasks,
    links: linksFor(sp.id),
    activity,
    updatedOn: latest?.date ?? sp.start,
    updatedBy: latest?.who ?? sp.lead,
    opened: opened[sp.id] ?? 0,
    needsYou: status === "wrapped" ? undefined : needsYouFrom(tasks, awaitingMe),
    wrappedOn: sp.wrapped?.on,
    wrapStat: sp.wrapped?.stat,
    isNew: fresh,
    template: sp.template,
  };
}

/** Every project as the live state has it now. Projects made during the review come first, newest first. */
export function buildProjects(s: DemoState, opened: Readonly<Record<string, number>> = {}): Project[] {
  const all = projectsOf(s).map((sp) => fromStore(sp, s, opened));
  return [...all.filter((p) => p.isNew).reverse(), ...all.filter((p) => !p.isNew)];
}

/* ── Derived values ────────────────────────────────────────────────── */

export function sum(ns: number[]): number {
  return ns.reduce((x, y) => x + y, 0);
}

export function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function roleOf(p: Project, who: PersonId): string {
  if (who === p.owner) return "Lead";
  return PEOPLE[who]?.role ?? "";
}

export function nextMilestone(p: Project): Milestone | undefined {
  return p.milestones.filter((m) => !m.done).sort((x, y) => toTime(x.date) - toTime(y.date))[0];
}

/** Open and late tasks per person, read from who owns each task. */
export function openByPerson(p: Project): { who: PersonId; open: number; overdue: number }[] {
  const owners = [...p.people.filter((who) => PEOPLE[who]?.team), ...new Set(p.tasks.map((t) => t.who).filter((w) => !p.people.includes(w)))];
  return owners.map((who) => {
    const mine = p.tasks.filter((t) => t.who === who && t.state !== "done");
    return { who, open: mine.length, overdue: mine.filter((t) => t.late).length };
  });
}

/** Share of the time between start and date that has already gone, 0 to 1. */
export function elapsedShare(p: Project): number {
  const span = toTime(p.date) - toTime(p.start);
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (toTime(TODAY) - toTime(p.start)) / span));
}

/** Tasks ahead (+) or behind (-) a straight-line plan from start to date. */
export function vsPlan(p: Project): number {
  return Math.round(p.done - p.total * elapsedShare(p));
}

/** Net change in open tasks over the last 14 days: added minus done. */
export function netOpen(p: Project): number {
  return sum(p.sparkAdded) - sum(p.sparkDone);
}

export function lateMilestones(p: Project): Milestone[] {
  return p.milestones.filter((m) => !m.done && daysFromToday(m.date) < 0);
}

/** Marked on track, yet holding a late milestone. */
export function statusLooksStale(p: Project): boolean {
  return p.status === "on_track" && !p.tooEarly && !isPastDue(p) && lateMilestones(p).length > 0;
}

/** One milestone date format for every surface: "Tue 29 Sep" inside a week, "14 Nov" beyond. */
export function fmtMilestone(m: Pick<Milestone, "date" | "done">): { date: string; weekday: string | null; day: string; late: string | null; soon: boolean } {
  const n = daysFromToday(m.date);
  const wd = n >= 0 && n <= 6 ? fmtWeekday(m.date) : null;
  const day = fmtDate(m.date);
  const date = wd ? `${wd} ${day}` : day;
  const late = !m.done && n < 0 ? `${fmtDaysCount(-n)} late` : null;
  return { date, weekday: wd, day, late, soon: !m.done && n >= 0 && n <= 3 };
}

/** The project's date has gone by and it is not wrapped: a prompt to wrap up or move the date. */
export function isPastDue(p: Pick<Project, "status" | "date" | "end">): boolean {
  return p.status !== "wrapped" && daysFromToday(p.end ?? p.date) < 0;
}

/** At risk, off track, or past its date: what "needs attention" counts. */
export function needsAttention(p: Project): boolean {
  return p.status === "at_risk" || p.status === "off_track" || isPastDue(p);
}

/** The cover's date badge: a big line and a small line. Days, never weeks. */
export function badgeFor(p: Pick<Project, "date" | "end" | "status">): { big: string; small: string } {
  const n = daysFromToday(p.date);
  if (p.end && n > 0) return { big: fmtDate(p.date), small: `to ${fmtDate(p.end)}` };
  if (n === 0) return { big: "Today", small: dayDate(p.date) };
  if (n === 1) return { big: "Tomorrow", small: dayDate(p.date) };
  if (n > 1 && n <= 14) return { big: `In ${n} days`, small: dayDate(p.date) };
  if (n > 14) return { big: fmtDate(p.date), small: `in ${n} days` };
  return { big: fmtDate(p.date), small: p.status === "wrapped" ? "Wrapped" : n === -1 ? "Yesterday" : `${-n} days ago` };
}

/** The one line a cover shows under the name, and what kind of line it is. */
export type FactTone = "you" | "risk" | "calm" | "done" | "past";
export function factFor(p: Project): { text: string; tone: FactTone } {
  if (p.status === "wrapped") return { text: p.note, tone: "done" };
  if (isPastDue(p)) {
    const open = p.total - p.done;
    return { text: `Past its date${open ? `, ${open} still open` : ""}. Wrap up or move the date`, tone: "past" };
  }
  if (p.needsYou) return { text: p.needsYou.short, tone: "you" };
  if (p.status === "at_risk" || p.status === "off_track") return { text: p.note, tone: "risk" };
  return { text: p.note, tone: "calm" };
}

export type Template = { id: string; name: string; kind: KindId; blurb: string; tasks: number };

/** The store's templates: what a new project starts with. The school one draws the school cover. */
export const TEMPLATES: Template[] = STORE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, kind: t.id === "school" ? "school" : t.kind, blurb: t.blurb, tasks: t.tasks.length }));

/** The template a kind starts from by default, or none. */
export function templateForKind(kind: KindId): string | undefined {
  return ({ wedding: "wedding", event: "party", works: "works", marketing: "campaign", school: "school" } as Partial<Record<KindId, string>>)[kind];
}

/** The store's kind for this surface's kind: the school cover is an event in the store. */
export function storeKind(kind: KindId): ProjectKind {
  return kind === "school" ? "event" : kind;
}
