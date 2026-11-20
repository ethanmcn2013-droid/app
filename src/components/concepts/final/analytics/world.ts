/**
 * Analytics: the one history every lens reads, built from the demo store's
 * own records.
 *
 * Every task's life comes from the store's event log (`historyFor`): when it
 * was created, each status it passed through, who it waited on, every time its
 * date moved, every nudge and note. Nothing is invented for a task the store
 * keeps, so a task marked done on the board shows here as done today, and the
 * last day of every history is exactly the store's state.
 *
 * Only Summer garden parties 2026 (`garden-parties`) is filled in: the store
 * wraps it without task records, and Replay needs one finished project to show
 * what the end looks like. Its 36 tasks are synthesised deterministically.
 *
 * Days inside a project count from the day its work began; `offset` turns them
 * into days from today (Friday 25 September 2026).
 */

import {
  INITIAL_STATE,
  PROJECTS as STORE_PROJECTS,
  SUPPLIERS,
  TEAM,
  TODAY,
  daysBetween,
  fmtDate,
  nameOf,
  projectsOf,
  type DemoState,
  type Project as StoreProject,
  type ProjectEvent,
  type Task as StoreTask,
  type TaskEvent,
} from "../../demo/store";
import { PEOPLE as WORLD_PEOPLE } from "../../demo/world";

export type Status = "todo" | "doing" | "waiting" | "review" | "done";
export type Health = "on_track" | "at_risk" | "off_track";

export type GroupDef = { id: string; name: string; tone: number };
export type PersonDef = {
  id: string;
  name: string;
  tone: number;
  joined: number;
  away?: { from: number; to: number };
};
export type Wait = { from: number; to: number; on: string };
/** The date moved on `day`, to `to` (null when the date was cleared). */
export type Move = { day: number; to: number | null; note?: string };
/** The status a task had at the end of `day`. */
export type StatusStep = { day: number; status: Status };
/** One recorded event, in project days, for a task's story. */
export type LogEntry = { day: number; kind: TaskEvent["kind"]; from?: string; to?: string; by?: string; note?: string };

export type Task = {
  /** The store's id ("mf-21"), so every task links to the same task elsewhere. */
  id: string;
  title: string;
  group: string;
  person: string;
  created: number;
  /** Every status it held, in order; the one source for where it was on any day. */
  steps: StatusStep[];
  /** The first day it left To do. */
  started: number | null;
  /** The day it last went into Review, while it is there. */
  review: number | null;
  waits: Wait[];
  /** The day it was finished, while it is done. */
  done: number | null;
  /** The first date it was given; null when it had no date. */
  due: number | null;
  /** Each time the date moved. */
  moves: Move[];
  /** Work that follows the big date on purpose (return the marquee). */
  afterEvent?: boolean;
  /** Its events, oldest first, for the task's story. */
  log: LogEntry[];
};

export type Milestone = { day: number; label: string };

export type Moment = {
  id: string;
  day: number;
  /** Short label for the pin tooltip and the chapter list. */
  label: string;
  /** The caption sentence, starting with the date. */
  sentence: string;
  /** The task this moment is about, if one. */
  taskId?: string;
  /** A follow-up question Ask can answer about this moment. */
  ask?: string;
};

/** A change of health, with the lead's reason. */
export type HealthChange = { day: number; from: Health; to: Health; reason?: string; by: string };

export type ReplayProject = {
  id: string;
  name: string;
  short: string;
  /** "Wedding", "Supper club": what the big date is. */
  kindLabel: string;
  /** How the big date reads mid-sentence: "the wedding". */
  targetName: string;
  tile: number;
  initials: string;
  health: Health;
  healthReason?: string;
  healthChanges: HealthChange[];
  /** Too new to judge: shown as "Too early to tell". */
  tooEarly: boolean;
  /** One of the seven main projects. */
  canon: boolean;
  lead: string;
  /** ISO date of day 0: the day work began. */
  start: string;
  /** Global day (from today) of day 0. */
  offset: number;
  /** The last day the replay can reach: today, or the day it finished. */
  last: number;
  /** Today's index (may be after last for a finished project). */
  today: number;
  /** Where the scrubber's axis ends. */
  axisEnd: number;
  groups: GroupDef[];
  people: PersonDef[];
  tasks: Task[];
  milestones: Milestone[];
  moments: Moment[];
  /** Present when the project existed before its work began in earnest. */
  tracked?: { began: string; note: string; earlier: number };
  /** Present when every task is finished. */
  finish?: { day: number; due: number };
  /** The big date, in project days. */
  bigDay: { day: number; label: string };
  /** One square per task, or one per five. */
  block: 1 | 5;
};

/* ── dates ─────────────────────────────────────────────────────────── */

/** Days from today to an ISO date. */
export const globalOf = (iso: string) => daysBetween(TODAY, iso);
/** A quiet stretch at least this long splits early set-up from the work itself. */
const QUIET_DAYS = 28;

/* ── people and suppliers ─────────────────────────────────────────── */

export const PERSON_NAME: Record<string, string> = Object.fromEntries(WORLD_PEOPLE.map((p) => [p.id, p.first]));
/** Person squares in replay: 1 to 6 are the replay's person tones. */
const PERSON_TONE: Record<string, number> = { orla: 1, aoife: 4, dara: 2, tomas: 3, dev: 6, niamh: 5, siobhan: 2 };

/** Who things wait on, and what they are, for Ask's "who outside the team slips most". */
export const OUTSIDERS: Record<string, string> = {
  ...Object.fromEntries(SUPPLIERS.map((x) => [x.name, x.what])),
  Mara: "the bride",
  Finn: "the groom",
  Ada: "the client",
  Theo: "the client",
  "Sinéad": "the host",
  Mark: "the client",
  Ruth: "the organiser",
};

/* ── what each big date is ─────────────────────────────────────────── */

const BIG: Record<string, { label: string; target: string; initials: string }> = {
  "mara-finn": { label: "Wedding", target: "the wedding", initials: "MF" },
  harvest: { label: "Supper club", target: "the supper club", initials: "HS" },
  kavanagh: { label: "Party", target: "the party", initials: "K4" },
  "barn-roof": { label: "Handover", target: "the handover", initials: "BR" },
  "winter-launch": { label: "Launch", target: "the launch", initials: "WL" },
  christmas: { label: "Markets open", target: "the markets opening", initials: "CM" },
  "ada-theo": { label: "Micro-wedding", target: "the wedding", initials: "AT" },
  "keane-legal": { label: "Retreat", target: "the retreat", initials: "KL" },
  "food-fair": { label: "Fair day", target: "the fair", initials: "FF" },
  "open-day": { label: "Open day", target: "the open day", initials: "OD" },
  "staff-rota": { label: "Rota due", target: "the rota deadline", initials: "SR" },
  "photo-shoot": { label: "Shoot day", target: "the shoot", initials: "PS" },
  "wine-list": { label: "New list", target: "the new list", initials: "WN" },
  "path-lighting": { label: "Finish", target: "the finish date", initials: "PL" },
  "venue-upkeep": { label: "Ready for winter", target: "the winter deadline", initials: "VU" },
  "garden-parties": { label: "Last party", target: "the last party", initials: "GP" },
};
/** A project made during the review has no entry above: its kind decides the words. */
const BY_KIND: Record<StoreProject["kind"], { label: string; target: string }> = {
  wedding: { label: "Wedding", target: "the wedding" },
  event: { label: "Event day", target: "the event" },
  season: { label: "Season opens", target: "the opening" },
  works: { label: "Handover", target: "the handover" },
  marketing: { label: "Launch", target: "the launch" },
  operations: { label: "Due", target: "the due date" },
};
const bigOf = (p: StoreProject) => BIG[p.id] ?? { ...BY_KIND[p.kind], initials: "" };

function initialsOf(p: StoreProject) {
  return (
    BIG[p.id]?.initials ??
    p.short
      .split(/\s+/)
      .filter((w) => /^[A-Za-z0-9]/.test(w))
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );
}

/* ── one store task, from its events ───────────────────────────────── */

const STATUSES = new Set<string>(["todo", "doing", "waiting", "review", "done"]);

/** Where work began: after the last quiet stretch of four weeks or more. */
function workStart(days: string[]): string {
  const sorted = [...new Set(days)].sort();
  let start = sorted[0];
  for (let i = 1; i < sorted.length; i++) if (daysBetween(sorted[i - 1], sorted[i]) >= QUIET_DAYS) start = sorted[i];
  return start;
}

function lifeOf(st: StoreTask, events: readonly TaskEvent[], day: (iso: string) => number, today: number): Task {
  const created = day(st.created);
  // Status at the end of each day: same-day events collapse to the last one.
  const steps: StatusStep[] = [];
  const push = (d: number, status: Status) => {
    if (steps.length && steps[steps.length - 1].day === d) steps[steps.length - 1].status = status;
    else if (!steps.length || steps[steps.length - 1].status !== status) steps.push({ day: d, status });
  };
  for (const e of events) if ((e.kind === "created" || e.kind === "status") && e.to && STATUSES.has(e.to)) push(Math.max(created, day(e.on)), e.to as Status);
  if (!steps.length) push(created, "todo");
  // The record wins if the log falls short of it (a session saved before the log existed).
  if (steps[steps.length - 1].status !== st.status) push(Math.max(steps[steps.length - 1].day, day(st.since)), st.status);
  if (steps[0].day > created) steps.unshift({ day: created, status: "todo" });

  const final = steps[steps.length - 1];
  const started = steps.find((x) => x.status !== "todo")?.day ?? null;
  const lastReview = [...steps].reverse().find((x) => x.status === "review");
  const review = final.status === "review" && lastReview ? lastReview.day : null;

  // Waits: each stretch in Waiting, on whoever the log names.
  const waitEvents = events.filter((e) => e.kind === "waiting" && e.to);
  const supplier = st.supplier ? SUPPLIERS.find((x) => x.id === st.supplier)?.name : undefined;
  const waits: Wait[] = [];
  steps.forEach((x, i) => {
    if (x.status !== "waiting") return;
    const next = steps[i + 1];
    const named = [...waitEvents].reverse().find((e) => day(e.on) <= x.day)?.to ?? (next ? undefined : st.waitingOn?.who);
    waits.push({ from: x.day, to: next ? next.day : today + 365, on: named ? nameOf(named) : (supplier ?? "someone") });
  });

  // Dates: the first one it had, then each move, with the note written the same day.
  const dueEvents = events.filter((e) => e.kind === "due");
  const notes = events.filter((e) => e.kind === "note");
  const first = dueEvents.length ? dueEvents[0].from : st.due;
  const moves: Move[] = dueEvents.map((e) => ({
    day: day(e.on),
    to: e.to ? day(e.to) : null,
    note: notes.find((n) => n.on === e.on && n.note && /^Moved\b/.test(n.note))?.note,
  }));

  return {
    id: st.id,
    title: st.title,
    group: st.workstream,
    person: st.owner,
    created,
    steps,
    started,
    review,
    waits,
    done: final.status === "done" ? final.day : null,
    due: first ? day(first) : null,
    moves,
    afterEvent: st.afterEvent || undefined,
    log: events.map((e) => ({ day: day(e.on), kind: e.kind, from: e.from, to: e.to, by: e.by, note: e.note })),
  };
}

function healthChanges(events: readonly ProjectEvent[], day: (iso: string) => number): HealthChange[] {
  return events
    .filter((e) => e.kind === "health" && e.to)
    .map((e) => ({ day: day(e.on), from: (e.from ?? e.to) as Health, to: e.to as Health, reason: e.reason, by: e.by }));
}

/** One store project, as a replayable history that ends on today (or the day it wrapped). */
function fromStore(p: StoreProject, own: StoreTask[], events: Map<string, TaskEvent[]>, pEvents: readonly ProjectEvent[]): ReplayProject {
  const activity = own.flatMap((t) => [t.created, ...(events.get(t.id) ?? []).map((e) => e.on)]).filter((d) => d <= TODAY);
  // A project with nothing on it yet starts today; otherwise where its work began.
  const start = activity.length ? workStart(activity) : TODAY;
  const offset = globalOf(start);
  const today = -offset;
  const day = (iso: string) => daysBetween(start, iso);
  const wrappedOn = p.wrapped ? Math.min(today, day(p.wrapped.on)) : null;
  const tasks = own.map((t) => lifeOf(t, events.get(t.id) ?? [], day, today));
  const owners = new Set(tasks.map((t) => t.person));
  const team = [...new Set([...p.people.filter((x) => (TEAM as readonly string[]).includes(x)), ...owners])].filter((x) => owners.has(x) || x === p.lead);
  const bigDay = day(p.date);
  const big = bigOf(p);
  const earlier = tasks.filter((t) => t.created < 0).length;
  const firstActivity = activity.length ? activity.reduce((m, d) => (d < m ? d : m)) : start;
  const last = wrappedOn ?? today;
  let tracked: ReplayProject["tracked"];
  if (earlier) {
    const quietFrom = activity.filter((d) => d < start).reduce((m, d) => (d > m ? d : m), firstActivity);
    tracked = {
      began: p.start,
      earlier,
      note: `Work started ${fmtDate(start)}. ${earlier === 1 ? "1 task" : `${earlier} tasks`} from ${fmtDate(firstActivity)} to ${fmtDate(quietFrom)} ${earlier === 1 ? "starts" : "start"} on the board.`,
    };
  } else if (start > p.start) {
    tracked = { began: p.start, earlier: 0, note: `Booked ${fmtDate(p.start)}. Work started ${fmtDate(start)}.` };
  }
  return {
    id: p.id,
    name: p.name,
    short: p.short,
    kindLabel: big.label,
    targetName: big.target,
    tile: p.hue,
    initials: initialsOf(p),
    health: p.health,
    healthReason: p.healthReason,
    healthChanges: healthChanges(pEvents, day),
    tooEarly: !!p.tooEarly,
    canon: p.canon,
    lead: p.lead,
    start,
    offset,
    last,
    today,
    axisEnd: wrappedOn !== null ? Math.max(last, bigDay) : today,
    groups: p.workstreams.map((w, i) => ({ id: w.id, name: w.name, tone: i + 1 })),
    people: team.map((id) => ({ id, name: PERSON_NAME[id] ?? id, tone: PERSON_TONE[id] ?? 5, joined: 0 })),
    tasks,
    milestones: p.milestones.map((m) => ({ day: day(m.date), label: m.title })).filter((m) => m.day > 0 && m.day <= last),
    moments: [],
    tracked,
    finish: wrappedOn !== null ? { day: last, due: bigDay } : undefined,
    bigDay: { day: bigDay, label: `${big.label}, ${fmtDate(p.date)}` },
    block: 1,
  };
}

/* ── Summer garden parties 2026: wrapped without records, so synthesised ── */

/** A stable number in [0, 1) from an id and a salt. */
function hash(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const pickInt = (id: string, salt: number, lo: number, hi: number) => lo + Math.floor(hash(id, salt) * (hi - lo + 1));

const GARDEN_TITLES: Record<string, string[]> = {
  garden: ["Mow the orchard", "Bunting", "Garden games", "Shade for the lawn", "Tables on the lawn", "Lights in the trees", "Wet-weather plan", "Hay bales", "Bins on the lawn", "Stage for the band", "Return the hired gazebos", "Tidy the orchard after the last party"],
  food: ["Barbecue menu", "Order the meat", "Salads", "Lemonade and cider", "Ice cream stand", "Cake for the raffle", "Vegetarian grill", "Bar rota", "Cups and plates", "Reorder for the August parties", "Count the leftover stock"],
  guests: ["Invite the neighbours", "Booking page", "Raffle prizes", "Posters in town", "Volunteer rota", "Thank-you notes", "Face painting", "Book The Lindens for the afternoon", "Photos for socials", "Guest numbers for each party", "Feedback form", "Thank the volunteers", "Final guest count for the season"],
};
const GARDEN_WAIT: Record<string, string> = { garden: "Lawlor Hire", food: "Hayes Farm", guests: "PrintHaus Cork" };

/** Steps for a synthesised life: To do, In progress, any waits, Done. */
function stepsOf(created: number, started: number, waits: Wait[], done: number): StatusStep[] {
  const out: StatusStep[] = [{ day: created, status: "todo" }];
  if (started > created && started < done) out.push({ day: started, status: "doing" });
  for (const w of waits) {
    out.push({ day: w.from, status: "waiting" });
    if (w.to < done) out.push({ day: w.to, status: "doing" });
  }
  out.push({ day: done, status: "done" });
  return out.filter((x, i, all) => i === all.length - 1 || all[i + 1].day > x.day);
}

let garden: ReplayProject | null = null;
function gardenParties(): ReplayProject {
  if (garden) return garden;
  const p = STORE_PROJECTS.find((x) => x.id === "garden-parties") as StoreProject;
  const wrapped = p.wrapped as NonNullable<StoreProject["wrapped"]>;
  const start = p.start;
  const offset = globalOf(start);
  const last = daysBetween(start, wrapped.on);
  const bigDay = daysBetween(start, p.date);
  const who: Record<string, string[]> = { garden: ["niamh", "orla"], food: ["dev", "dev", "niamh"], guests: ["niamh", "orla"] };
  const tasks: Task[] = [];
  const all = Object.entries(GARDEN_TITLES).flatMap(([g, titles]) => titles.map((title, i) => ({ g, title, i, n: titles.length })));
  all.forEach(({ g, title, i, n }, k) => {
    const id = `gp-${k + 1}`;
    // Earlier titles go in early; the last few in each group are the wrap-up after the last party.
    const wrapUp = i >= n - 2;
    const created = wrapUp ? bigDay - pickInt(id, 1, 6, 14) : Math.round((i / n) * (bigDay - 30)) + pickInt(id, 2, 0, 6);
    const done = Math.min(last, wrapUp ? Math.max(created + 2, bigDay + pickInt(id, 3, -2, 2)) : created + pickInt(id, 4, 4, 18));
    const late = hash(id, 5) < 0.12;
    const due = late ? Math.max(created + 1, done - pickInt(id, 6, 1, 4)) : done + pickInt(id, 7, 0, 5);
    const started = Math.max(created, done - pickInt(id, 8, 1, 4));
    const waits = done - started >= 3 && hash(id, 9) < 0.35 ? [{ from: started + 1, to: done - 1, on: GARDEN_WAIT[g] }] : [];
    const moves: Move[] = !late && hash(id, 10) < 0.14 && done - created >= 6 ? [{ day: created + Math.floor((done - created) / 2), to: due }] : [];
    tasks.push({
      id,
      title,
      group: g,
      person: who[g][i % who[g].length],
      created,
      steps: [],
      started,
      review: null,
      waits,
      done,
      due: moves.length ? Math.max(created + 2, due - pickInt(id, 11, 3, 7)) : due,
      moves,
      log: [],
    });
  });
  // The last task closes on the day the project wrapped.
  const lastTask = tasks.reduce((a, b) => ((b.done ?? 0) > (a.done ?? 0) ? b : a));
  lastTask.done = last;
  for (const t of tasks) t.steps = stepsOf(t.created, t.started ?? t.created, t.waits, t.done ?? last);
  garden = {
    id: p.id,
    name: p.name,
    short: p.short,
    kindLabel: BIG[p.id].label,
    targetName: BIG[p.id].target,
    tile: p.hue,
    initials: BIG[p.id].initials,
    health: p.health,
    healthChanges: [],
    tooEarly: false,
    canon: false,
    lead: p.lead,
    start,
    offset,
    last,
    today: -offset,
    axisEnd: Math.max(last, bigDay),
    groups: [
      { id: "garden", name: "Garden", tone: 1 },
      { id: "food", name: "Food", tone: 2 },
      { id: "guests", name: "Guests", tone: 3 },
    ],
    people: ["niamh", "orla", "dev"].map((id) => ({ id, name: PERSON_NAME[id], tone: PERSON_TONE[id], joined: 0 })),
    tasks,
    milestones: p.milestones.map((m) => ({ day: daysBetween(start, m.date), label: m.title })),
    moments: [],
    finish: { day: last, due: bigDay },
    bigDay: { day: bigDay, label: `${BIG[p.id].label}, ${fmtDate(p.date)}` },
    block: 1,
  };
  return garden;
}

/**
 * Every project a state holds, as histories: the active ones in the store's
 * order, then the finished ones (a project wrapped during the review keeps its
 * records; the summer garden parties are the one filled in).
 */
export function rawProjects(s: DemoState): ReplayProject[] {
  const tasksBy = new Map<string, StoreTask[]>();
  for (const t of s.tasks) tasksBy.set(t.project, [...(tasksBy.get(t.project) ?? []), t]);
  const events = new Map<string, TaskEvent[]>();
  for (const e of s.history ?? INITIAL_STATE.history) events.set(e.taskId, [...(events.get(e.taskId) ?? []), e]);
  const pEvents = new Map<string, ProjectEvent[]>();
  for (const e of s.projectEvents ?? INITIAL_STATE.projectEvents) pEvents.set(e.projectId, [...(pEvents.get(e.projectId) ?? []), e]);
  const list = projectsOf(s);
  const of = (p: StoreProject) => fromStore(p, tasksBy.get(p.id) ?? [], events, pEvents.get(p.id) ?? []);
  const active = list.filter((p) => !p.wrapped).map(of);
  const wrapped = list.filter((p) => p.wrapped && (tasksBy.get(p.id)?.length ?? 0) > 0).map(of);
  const showGarden = list.some((p) => p.id === "garden-parties" && p.wrapped) && !wrapped.some((p) => p.id === "garden-parties");
  return [...active, ...wrapped, ...(showGarden ? [gardenParties()] : [])];
}
