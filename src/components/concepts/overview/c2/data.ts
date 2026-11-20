/*
 * River of time: a view over the demo store. Nothing here is stored. Every
 * bar is a store task and every flag a project milestone, mapped to whole
 * days relative to today (Friday 25 September 2026 = 0), so the river's
 * geometry is plain arithmetic and nothing depends on the viewer's clock.
 */

import {
  type DemoState,
  type PersonId,
  type Project,
  type ProjectId,
  type Task,
  type TaskStatus,
  type TeamPersonId,
  TODAY,
  activeProjects,
  addDays,
  canonProjects,
  daysBetween,
  personById,
  projectById,
  toTime,
  historyFor,
  waitingOnName,
} from "../../demo/store";
import { type HealthKey, healthKey } from "../../demo/health";

export type { PersonId, ProjectId, TeamPersonId };

const TODAY_UTC = toTime(TODAY);
const DAY_MS = 86_400_000;

/** Day offset for a store date ("2026-10-03" is 8). */
export const dayOf = (iso: string): number => daysBetween(TODAY, iso);
/** Store date for a day offset. */
export const isoOf = (day: number): string => addDays(TODAY, day);

/** Day offset for a calendar date (month is 1-based). */
export function on(month: number, date: number, year = 2026): number {
  return Math.round((Date.UTC(year, month - 1, date) - TODAY_UTC) / DAY_MS);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parts(day: number) {
  const d = new Date(TODAY_UTC + day * DAY_MS);
  return { date: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

/** Monday = 0 … Sunday = 6. */
export function weekday(day: number): number {
  return (new Date(TODAY_UTC + day * DAY_MS).getUTCDay() + 6) % 7;
}

export function mondayOf(day: number): number {
  return day - weekday(day);
}

/** "25 Sep", or "14 Mar 2027" outside 2026. */
export function short(day: number): string {
  const p = parts(day);
  return `${p.date} ${MONTHS_SHORT[p.month]}${p.year === 2026 ? "" : ` ${p.year}`}`;
}

/** "25 September" */
export function long(day: number): string {
  const p = parts(day);
  return `${p.date} ${MONTHS_LONG[p.month]}${p.year === 2026 ? "" : ` ${p.year}`}`;
}

/** "Fri 25 Sep" */
export function withDay(day: number): string {
  return `${WEEKDAYS_SHORT[weekday(day)]} ${short(day)}`;
}

/** "Friday 25 September" */
export function fullDay(day: number): string {
  return `${WEEKDAYS_LONG[weekday(day)]} ${long(day)}`;
}

export function weekdayShort(day: number): string {
  return WEEKDAYS_SHORT[weekday(day)];
}

export function monthShort(day: number): string {
  return MONTHS_SHORT[parts(day).month];
}

export function dateOf(day: number): number {
  return parts(day).date;
}

export function isFirstOfMonth(day: number): boolean {
  return parts(day).date === 1;
}

/** "in 3 days", "tomorrow", "2 days ago". Always days, never weeks. */
export function relative(day: number, from = 0): string {
  const diff = day - from;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

// ── People ────────────────────────────────────────────────────────────

/** First name, as a sentence says it: "Aoife". */
export const personName = (id: string) => personById(id)?.first ?? id;
/** Full name, as a label says it: "Aoife Brennan". */
export const personFull = (id: string) => personById(id)?.name ?? id;
export const personInitials = (id: string) => personById(id)?.initials ?? id.slice(0, 2).toUpperCase();
export const personRole = (id: string) => personById(id)?.role ?? "";
/** A person's colour: their --v3-project-n hue from the store. */
export const personColor = (id: string) => `var(--v3-project-${personById(id)?.hue ?? 1})`;

// ── Projects and workstreams ─────────────────────────────────────────

/** A project's colour: its --v3-project-n hue from the store. */
export const projectColor = (id: string) => `var(--v3-project-${projectById(id)?.hue ?? 1})`;

/*
 * Workstreams carry no colour in the store, so the river gives each one a
 * hue from the sample palette by its place in the project's own list. Never
 * amber, orange or red, and never pink beside a red count.
 */
const STREAM_HUES = [1, 2, 3, 4, 9];

export function laneColor(project: string, lane: string): string {
  const p = projectById(project);
  const i = Math.max(0, p?.workstreams.findIndex((w) => w.id === lane) ?? 0);
  return `var(--v3-project-${STREAM_HUES[i % STREAM_HUES.length]})`;
}

export function laneLabel(project: string, lane: string): string {
  return projectById(project)?.workstreams.find((w) => w.id === lane)?.name ?? lane;
}

// ── Items ─────────────────────────────────────────────────────────────

export type Item = {
  id: string;
  project: ProjectId;
  title: string;
  /** The task's workstream id; a milestone's is empty. */
  lane: string;
  owner: TeamPersonId;
  kind: "task" | "milestone";
  /** Undefined for undated work (it waits in "No date yet"). */
  start?: number;
  due?: number;
  status: TaskStatus;
  doneOn?: number;
  /** The project's own date: where its river goes. */
  terminal?: boolean;
  note?: string;
  helpers?: PersonId[];
  /** Who it is waiting on, by name. */
  waitingOn?: string;
  /** Work that follows the project's date on purpose. */
  afterEvent?: boolean;
  /** When it lands at the project's recent pace, if that is after its date. */
  eta?: number;
  /** The day it came onto the board. */
  created?: number;
  /** Its date moved later: the date it first had, and the day it last moved. From the task's history. */
  slip?: { from: number; on: number };
  /** Every date move, oldest first, so a replay can draw the date it had then. */
  dueMoves?: { on: number; from?: number; to?: number }[];
};

/**
 * One store task as a bar. A task with only a due date is a one-day bar.
 * With a state, its history fills in when it was done (the day it last went
 * to Done) and any date it moved from, so the river draws what happened.
 */
export function taskItem(t: Task, s?: DemoState): Item {
  const due = t.due ? dayOf(t.due) : undefined;
  const start = t.start ? dayOf(t.start) : due;
  const events = s ? historyFor(s, t.id) : [];
  const dueMoves = events
    .filter((e) => e.kind === "due")
    .map((e) => ({ on: dayOf(e.on), from: e.from ? dayOf(e.from) : undefined, to: e.to ? dayOf(e.to) : undefined }));
  const first = dueMoves.find((m) => m.from !== undefined)?.from;
  const slip = due !== undefined && first !== undefined && first < due ? { from: first, on: dueMoves[dueMoves.length - 1].on } : undefined;
  const lastDone = [...events].reverse().find((e) => (e.kind === "status" || e.kind === "created") && e.to === "done");
  const doneOn = t.status === "done" ? (lastDone ? dayOf(lastDone.on) : t.doneOn ? dayOf(t.doneOn) : undefined) : undefined;
  return {
    id: t.id,
    project: t.project,
    title: t.title,
    lane: t.workstream,
    owner: t.owner,
    kind: "task",
    start: due === undefined ? undefined : Math.min(start ?? due, due),
    due,
    status: t.status,
    doneOn,
    created: dayOf(t.created),
    slip,
    dueMoves: dueMoves.length ? dueMoves : undefined,
    note: t.notes,
    helpers: t.helpers,
    waitingOn: waitingOnName(t),
    afterEvent: t.afterEvent,
  };
}

/** A project's own date, as the flag its river runs to. */
export function destinationOf(p: Project): Item {
  return {
    id: `${p.id}-date`,
    project: p.id,
    title: p.name,
    lane: "",
    owner: p.lead,
    kind: "milestone",
    due: dayOf(p.date),
    status: "todo",
    terminal: true,
  };
}

/** A project's milestones as flags, leaving out the one on the project's own date. */
export function milestonesOf(p: Project): Item[] {
  return p.milestones
    .filter((m) => m.date !== p.date)
    .map((m) => ({
      id: m.id,
      project: p.id,
      title: m.title,
      lane: "",
      owner: p.lead,
      kind: "milestone" as const,
      due: dayOf(m.date),
      status: m.done ? ("done" as const) : ("todo" as const),
      doneOn: m.done ? dayOf(m.date) : undefined,
    }));
}

// ── Scopes ────────────────────────────────────────────────────────────

export type ScopeId = ProjectId | "all";

export type ScopeDef = {
  id: ScopeId;
  /** The project's name, as every surface says it. */
  label: string;
  /** "Sat 3 Oct", or "15 active". */
  hint: string;
  /** The first of the smaller projects: the picker draws a rule above it. */
  split?: boolean;
  health?: HealthKey;
  color: string;
  /** The projects whose work the river shows. */
  projects: Project[];
};

/**
 * The project list, as the store orders it: the seven main projects, then the
 * smaller ones. Pass the live state so a lead's edits on Projects (health,
 * date, name) show here too.
 */
export function scopeList(s?: DemoState): ScopeDef[] {
  const canon = canonProjects(s).filter((p) => !p.wrapped);
  const others = activeProjects(s).filter((p) => !p.canon);
  const one = (p: Project): ScopeDef => ({
    id: p.id,
    label: p.name,
    hint: withDay(dayOf(p.date)),
    health: healthKey(p.health, p.tooEarly),
    color: projectColor(p.id),
    projects: [p],
  });
  // "All projects" is every active project, the same 15 Projects and Analytics count:
  // the main ones first, then the rest, then anything made since.
  const all = [...canon, ...others];
  return [
    { id: "all", label: "All projects", hint: `${all.length} active`, color: "var(--v3-text-2)", projects: all },
    ...canon.map(one),
    ...others.map((p, i) => ({ ...one(p), split: i === 0 })),
  ];
}

export function scopeDef(id: ScopeId, s?: DemoState): ScopeDef {
  const list = scopeList(s);
  return list.find((x) => x.id === id) ?? list[1];
}
