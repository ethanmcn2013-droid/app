/**
 * Pure reads over the demo's state. Every count, list and forecast a surface
 * shows comes from here, so the board, the list, the calendar, the overview,
 * projects and analytics agree. Each selector takes the state first: pass
 * INITIAL_STATE on the server, or the live state from useDemoStore.
 *
 * Server-safe.
 */

import {
  CALENDAR_OWNER,
  CAPACITY,
  FILES,
  FIXED_EVENTS,
  PERSON_CAPACITY,
  STANDARD_CAPACITY,
  INITIAL_STATE,
  PEOPLE,
  PROJECTS,
  SUPPLIERS,
  TEAM,
  VIEWER,
  nameOf,
  personById,
  projectById,
} from "./data";
import { TODAY, WEEK_START, addDays, daysBetween, fmtDays, toMinutes } from "./dates";
import type {
  Block,
  DayCapacity,
  DemoState,
  FileRef,
  FixedEvent,
  Health,
  IsoDate,
  Milestone,
  PersonId,
  Project,
  ProjectEvent,
  ProjectId,
  ProjectUpdate,
  Scope,
  Task,
  TaskEvent,
  TaskStatus,
  TeamPersonId,
} from "./types";

/* ── Vocabulary ─────────────────────────────────────────────────────── */

/** Stages where work has started. Mirrors STARTED_STATUSES in tasks/status.tsx. */
export const STARTED: readonly TaskStatus[] = ["doing", "waiting", "review"];

/** A started task with no movement for this many days or more is stuck. */
export const STUCK_DAYS = 5;

/** The forecast's pace window: tasks finished in the last seven days, today included. */
export const PACE_DAYS = 7;

export const HEALTH_LABEL: Record<Health, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

export const PRIORITY_LABEL = { none: "No priority", low: "Low", medium: "Medium", high: "High", urgent: "Urgent" } as const;

/* ── Projects ───────────────────────────────────────────────────────── */

/** Every project in a state, with the lead's edits and any made during the review. */
export function projectsOf(s: DemoState = INITIAL_STATE): readonly Project[] {
  return s.projects ?? PROJECTS;
}

/** One project as the state has it now. Falls back to the canonical record. */
export function projectIn(s: DemoState, id: string): Project | undefined {
  return projectsOf(s).find((p) => p.id === id) ?? projectById(id);
}

/** Every project that is not wrapped: the seven main ones and the smaller ones. Pass the live state to see edits. */
export function activeProjects(s?: DemoState): Project[] {
  return projectsOf(s).filter((p) => !p.wrapped);
}

/** The seven projects in demo/world.ts, in its order. */
export function canonProjects(s?: DemoState): Project[] {
  return projectsOf(s).filter((p) => p.canon);
}

export function wrappedProjects(s?: DemoState): Project[] {
  return projectsOf(s).filter((p) => !!p.wrapped);
}

/** Ids of wrapped projects in a state, cached per projects array. */
const wrappedCache = new WeakMap<readonly Project[], Set<string>>();
function wrappedIds(s: DemoState): Set<string> {
  const list = projectsOf(s);
  let ids = wrappedCache.get(list);
  if (!ids) {
    ids = new Set(list.filter((p) => p.wrapped).map((p) => p.id));
    wrappedCache.set(list, ids);
  }
  return ids;
}

/* ── Tasks ──────────────────────────────────────────────────────────── */

function inScope(t: Task, scope?: Scope): boolean {
  if (!scope) return true;
  if (scope.project && t.project !== scope.project) return false;
  if (scope.owner && t.owner !== scope.owner) return false;
  if (scope.person && t.owner !== scope.person && !(t.helpers ?? []).includes(scope.person)) return false;
  return true;
}

/** All tasks, or one project's. */
export function tasksFor(s: DemoState, project?: ProjectId): Task[] {
  return project ? s.tasks.filter((t) => t.project === project) : s.tasks.slice();
}

/**
 * Tasks in a scope. Without a project in the scope, tasks of projects wrapped
 * during the review are left out, so workspace views show current work only.
 */
export function tasksIn(s: DemoState, scope?: Scope): Task[] {
  const wrapped = scope?.project ? undefined : wrappedIds(s);
  return s.tasks.filter((t) => inScope(t, scope) && !(wrapped && wrapped.has(t.project)));
}

/** Owned by or helped by this person. */
export function tasksForPerson(s: DemoState, person: PersonId): Task[] {
  return tasksIn(s, { person });
}

/** The viewer's own tasks (Orla's). */
export function myTasks(s: DemoState): Task[] {
  return tasksIn(s, { owner: VIEWER });
}

export const isOpen = (t: Task) => t.status !== "done";

/** Late: due before today and not done. Due today is not late. */
export function isLate(t: Task, today: IsoDate = TODAY): boolean {
  return t.status !== "done" && !!t.due && t.due < today;
}

/** Whole days past due, 0 when not late. */
export function daysLate(t: Task, today: IsoDate = TODAY): number {
  return isLate(t, today) && t.due ? daysBetween(t.due, today) : 0;
}

/** The day the task last moved: when the wait began, or when it entered its status. */
export function lastMoved(t: Task): IsoDate {
  return t.status === "waiting" && t.waitingOn ? t.waitingOn.since : t.since;
}

/** Days in the current status (or waiting), from today. */
export function ageInStatus(t: Task, today: IsoDate = TODAY): number {
  return daysBetween(lastMoved(t), today);
}

/**
 * Stuck: work has started (In progress, Waiting or Review) and nothing has
 * moved for STUCK_DAYS days or more. A To do task is queued, never stuck.
 */
export function isStuck(t: Task, today: IsoDate = TODAY): boolean {
  return STARTED.includes(t.status) && ageInStatus(t, today) >= STUCK_DAYS;
}

export function openTasks(s: DemoState, scope?: Scope): Task[] {
  return tasksIn(s, scope).filter(isOpen);
}

/** Late work, most overdue first. */
export function lateTasks(s: DemoState, scope?: Scope): Task[] {
  return tasksIn(s, scope)
    .filter((t) => isLate(t))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "") || a.id.localeCompare(b.id));
}

export function stuckTasks(s: DemoState, scope?: Scope): Task[] {
  return tasksIn(s, scope)
    .filter((t) => isStuck(t))
    .sort((a, b) => lastMoved(a).localeCompare(lastMoved(b)));
}

export function waitingTasks(s: DemoState, scope?: Scope): Task[] {
  return tasksIn(s, scope).filter((t) => t.status === "waiting");
}

/** Finished from Monday of this week to today. */
export function doneThisWeek(s: DemoState, scope?: Scope): Task[] {
  return tasksIn(s, scope).filter((t) => t.status === "done" && !!t.doneOn && t.doneOn >= WEEK_START && t.doneOn <= TODAY);
}

/** Tasks finished from `from` to `to`, both days included. */
export function doneBetween(s: DemoState, from: IsoDate, to: IsoDate, scope?: Scope): Task[] {
  return tasksIn(s, scope).filter((t) => t.status === "done" && !!t.doneOn && t.doneOn >= from && t.doneOn <= to);
}

/**
 * The pace figures every surface quotes, in one place so they tell one story.
 * `last7` is the forecast's window (today and the six days before), and "N a
 * week" always means it. `last14` is the project home's two weeks, so
 * `last14 - last7` is the week before. `lastWeek` and `thisWeek` are calendar
 * weeks (Monday to Sunday, this one up to today), as Analytics counts them.
 */
export type PaceStory = { last7: number; last14: number; added14: number; lastWeek: number; thisWeek: number };
export function paceStory(s: DemoState, scope?: Scope, today: IsoDate = TODAY): PaceStory {
  const n = (from: IsoDate, to: IsoDate) => doneBetween(s, from, to, scope).length;
  const monday = today === TODAY ? WEEK_START : addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const from14 = addDays(today, -13);
  return {
    last7: n(addDays(today, -(PACE_DAYS - 1)), today),
    last14: n(from14, today),
    added14: tasksIn(s, scope).filter((t) => t.created >= from14 && t.created <= today).length,
    lastWeek: n(addDays(monday, -7), addDays(monday, -1)),
    thisWeek: n(monday, today),
  };
}

/** Open tasks due between two days, inclusive, soonest first. */
export function tasksDueBetween(s: DemoState, from: IsoDate, to: IsoDate, scope?: Scope): Task[] {
  return openTasks(s, scope)
    .filter((t) => !!t.due && t.due >= from && t.due <= to)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
}

export function dueToday(s: DemoState, scope?: Scope): Task[] {
  return tasksDueBetween(s, TODAY, TODAY, scope);
}

export function byStatus(s: DemoState, scope?: Scope): Record<TaskStatus, Task[]> {
  const out: Record<TaskStatus, Task[]> = { todo: [], doing: [], waiting: [], review: [], done: [] };
  for (const t of tasksIn(s, scope)) out[t.status].push(t);
  return out;
}

/** Tasks grouped by the project's own workstreams, in their order. */
export function byWorkstream(s: DemoState, project: ProjectId): { id: string; name: string; tasks: Task[] }[] {
  const p = projectIn(s, project);
  if (!p) return [];
  return p.workstreams.map((w) => ({ ...w, tasks: s.tasks.filter((t) => t.project === project && t.workstream === w.id) }));
}

/* ── Counts ─────────────────────────────────────────────────────────── */

export type Counts = {
  total: number;
  done: number;
  open: number;
  late: number;
  stuck: number;
  waiting: number;
  review: number;
  /** Percent done, rounded. */
  pct: number;
};

function count(tasks: Task[]): Counts {
  const done = tasks.filter((t) => t.status === "done").length;
  return {
    total: tasks.length,
    done,
    open: tasks.length - done,
    late: tasks.filter((t) => isLate(t)).length,
    stuck: tasks.filter((t) => isStuck(t)).length,
    waiting: tasks.filter((t) => t.status === "waiting").length,
    review: tasks.filter((t) => t.status === "review").length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}

/** One project's counts. A wrapped project reports its stored total, all done. */
export function countsFor(s: DemoState, project: ProjectId): Counts {
  const p = projectIn(s, project);
  // A project wrapped during the review still has its records: count those.
  if (p?.wrapped && !s.tasks.some((t) => t.project === project)) return { total: p.wrapped.tasks, done: p.wrapped.tasks, open: 0, late: 0, stuck: 0, waiting: 0, review: 0, pct: 100 };
  return count(tasksFor(s, project));
}

/** Counts over any scope: a person, an owner, a project. */
export function countsIn(s: DemoState, scope?: Scope): Counts {
  return count(tasksIn(s, scope));
}

export type WorkspaceCounts = Counts & {
  /** Active projects: the seven main ones plus the smaller ones. */
  activeProjects: number;
  /** The seven projects in demo/world.ts. */
  canonProjects: number;
  wrappedProjects: number;
  atRisk: number;
  offTrack: number;
  doneThisWeek: number;
  dueToday: number;
};

/** The whole workspace. Task records exist only on active projects, so this is all current work. */
export function workspaceCounts(s: DemoState): WorkspaceCounts {
  const active = activeProjects(s);
  return {
    ...count(tasksIn(s)),
    activeProjects: active.length,
    canonProjects: canonProjects(s).filter((p) => !p.wrapped).length,
    wrappedProjects: wrappedProjects(s).length,
    atRisk: active.filter((p) => p.health === "at_risk").length,
    offTrack: active.filter((p) => p.health === "off_track").length,
    doneThisWeek: doneThisWeek(s).length,
    dueToday: dueToday(s).length,
  };
}

/* ── Health and forecast ────────────────────────────────────────────── */

export type Forecast = {
  /** Open work that has to be done by the date: due on or before it, or undated. Work flagged afterEvent is left out. */
  remaining: number;
  /** Tasks finished in the last PACE_DAYS days, today included. */
  doneRecently: number;
  /** Tasks a day: the last PACE_DAYS days, or since the project began when nothing finished lately. */
  pacePerDay: number;
  /** Days of work left at that pace; null when it cannot be judged. */
  daysNeeded: number | null;
  /** When the remaining work would be finished. */
  finish: IsoDate | null;
  /** Days between the finish and the project's date: positive is room to spare, negative runs past. */
  spare: number | null;
  /** "ahead" with 3 or more days to spare, "tight" with 0 to 2, "behind" when it runs past, "too_early" for a project too new to judge. */
  verdict: "ahead" | "tight" | "behind" | "too_early" | "done";
};

/** Open work against recent pace, to the project's date. A derived helper; the stored health is what surfaces show as health. */
export function forecast(s: DemoState, project: ProjectId, today: IsoDate = TODAY): Forecast {
  const p = projectIn(s, project);
  const tasks = tasksFor(s, project);
  const remaining = tasks.filter((t) => isOpen(t) && !t.afterEvent && (!t.due || !p || t.due <= p.date)).length;
  const from = addDays(today, -(PACE_DAYS - 1));
  const doneRecently = tasks.filter((t) => t.status === "done" && !!t.doneOn && t.doneOn >= from && t.doneOn <= today).length;
  const doneEver = tasks.filter((t) => t.status === "done" && !!t.doneOn && t.doneOn <= today).length;
  const sinceStart = p ? Math.max(1, daysBetween(p.start, today) + 1) : PACE_DAYS;
  const pacePerDay = doneRecently > 0 ? doneRecently / PACE_DAYS : doneEver / sinceStart;
  if (!p || p.wrapped || remaining === 0) {
    return { remaining, doneRecently, pacePerDay, daysNeeded: 0, finish: today, spare: p ? daysBetween(today, p.date) : null, verdict: "done" };
  }
  if (p.tooEarly) return { remaining, doneRecently, pacePerDay, daysNeeded: null, finish: null, spare: null, verdict: "too_early" };
  if (pacePerDay === 0) return { remaining, doneRecently, pacePerDay, daysNeeded: null, finish: null, spare: null, verdict: "behind" };
  // The small epsilon keeps 17 / (17 / 7) at 7 days, not 8.
  const daysNeeded = Math.ceil(remaining / pacePerDay - 1e-9);
  const finish = addDays(today, daysNeeded);
  const spare = daysBetween(finish, p.date);
  return { remaining, doneRecently, pacePerDay, daysNeeded, finish, spare, verdict: spare >= 3 ? "ahead" : spare >= 0 ? "tight" : "behind" };
}

export type ProjectHealth = {
  /** Stored health, set by the lead. This is the one every surface shows. */
  health: Health;
  label: string;
  reason?: string;
  tooEarly: boolean;
  counts: Counts;
  forecast: Forecast;
};

export function projectHealth(s: DemoState, project: ProjectId): ProjectHealth | undefined {
  const p = projectIn(s, project);
  if (!p) return undefined;
  return {
    health: p.health,
    label: HEALTH_LABEL[p.health],
    reason: p.healthReason,
    tooEarly: !!p.tooEarly,
    counts: countsFor(s, project),
    forecast: forecast(s, project),
  };
}

/* ── Milestones ─────────────────────────────────────────────────────── */

export type MilestoneView = Milestone & { project: ProjectId; late: boolean };

/** One project's milestones by date, or every active project's. Pass the live state to see ticks. */
export function milestonesFor(project?: ProjectId, s?: DemoState): MilestoneView[] {
  const list = project ? projectsOf(s).filter((p) => p.id === project) : activeProjects(s);
  return list
    .flatMap((p) => p.milestones.map((m) => ({ ...m, project: p.id, late: !m.done && m.date < TODAY })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The next milestone not yet done, today or later. */
export function nextMilestone(project: ProjectId, s?: DemoState): MilestoneView | undefined {
  return milestonesFor(project, s).find((m) => !m.done && m.date >= TODAY);
}

/* ── People ─────────────────────────────────────────────────────────── */

export type PersonLoad = {
  person: TeamPersonId;
  open: number;
  late: number;
  stuck: number;
  waiting: number;
  dueToday: number;
  /** Open tasks due in the next seven days, today included. */
  dueThisWeek: number;
};

/** What each person on the team owns, busiest first. */
export function peopleLoad(s: DemoState, scope?: Pick<Scope, "project">): PersonLoad[] {
  const weekEnd = addDays(TODAY, 6);
  return TEAM.map((person) => {
    const mine = openTasks(s, { ...scope, owner: person });
    return {
      person,
      open: mine.length,
      late: mine.filter((t) => isLate(t)).length,
      stuck: mine.filter((t) => isStuck(t)).length,
      waiting: mine.filter((t) => t.status === "waiting").length,
      dueToday: mine.filter((t) => t.due === TODAY).length,
      dueThisWeek: mine.filter((t) => !!t.due && t.due >= TODAY && t.due <= weekEnd).length,
    };
  }).sort((a, b) => b.open - a.open || a.person.localeCompare(b.person));
}

/* ── Lookups ────────────────────────────────────────────────────────── */

/** By id ("mf-12"), then exact title, then the first title that starts with it. Case-insensitive. */
export function findTask(s: DemoState, idOrTitle: string): Task | undefined {
  const q = idOrTitle.trim().toLowerCase();
  if (!q) return undefined;
  return (
    s.tasks.find((t) => t.id === q) ??
    s.tasks.find((t) => t.title.toLowerCase() === q) ??
    s.tasks.find((t) => t.title.toLowerCase().startsWith(q))
  );
}

/** Who a task waits on, by name: "Mara", "Fern and Furrow". */
export function waitingOnName(t: Task): string | undefined {
  return t.waitingOn ? nameOf(t.waitingOn.who) : undefined;
}

/** Files that belong to a task. */
export function filesForTask(taskId: string): FileRef[] {
  return FILES.filter((f) => f.taskId === taskId);
}

export function filesFor(project?: ProjectId): FileRef[] {
  return project ? FILES.filter((f) => f.project === project) : FILES.slice();
}

/** Files waiting on an approval, or on one person's. */
export function awaitingApproval(person?: PersonId): FileRef[] {
  return FILES.filter((f) => f.state === "awaiting" && (!person || f.awaiting === person));
}

/** A series ("seating"), newest first, with its latest and latest approved versions. */
export function seriesOf(series: string): { latest?: FileRef; latestApproved?: FileRef; versions: FileRef[] } {
  const versions = FILES.filter((f) => f.series === series).sort((a, b) => b.version - a.version);
  return { latest: versions[0], latestApproved: versions.find((f) => f.state === "approved"), versions };
}

/* ── Calendar ───────────────────────────────────────────────────────── */

/** A person's week of hours: their own when it is written down (Aoife, Orla), otherwise a plain working week. */
export function capacityOf(person: TeamPersonId = CALENDAR_OWNER): readonly DayCapacity[] {
  return person === CALENDAR_OWNER ? CAPACITY : (PERSON_CAPACITY[person] ?? STANDARD_CAPACITY);
}

/** One day's hours for a person (the calendar owner by default). */
export function capacityFor(day: IsoDate, person: TeamPersonId = CALENDAR_OWNER): DayCapacity | undefined {
  return capacityOf(person).find((c) => c.day === day);
}

/** Blocks on a day for a person (the calendar owner by default), in time order. */
export function blocksOn(s: DemoState, day: IsoDate, person: TeamPersonId = CALENDAR_OWNER): Block[] {
  return s.blocks.filter((b) => b.day === day && b.person === person).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function blocksForTask(s: DemoState, taskId: string): Block[] {
  return s.blocks.filter((b) => b.taskId === taskId);
}

/** Fixed events on a person's calendar that day, the team's included. */
export function fixedOn(day: IsoDate, person: TeamPersonId = CALENDAR_OWNER): FixedEvent[] {
  return FIXED_EVENTS.filter((e) => e.day === day && (e.person === person || e.person === "team")).sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start),
  );
}

export function plannedMinutes(s: DemoState, day: IsoDate, person: TeamPersonId = CALENDAR_OWNER): number {
  return blocksOn(s, day, person).reduce((sum, b) => sum + b.minutes, 0);
}

/** Planned minutes past the day's capacity: 60 on Friday 25 Sep. */
export function overCapacity(s: DemoState, day: IsoDate, person: TeamPersonId = CALENDAR_OWNER): number {
  const cap = capacityFor(day, person)?.minutes ?? 0;
  return Math.max(0, plannedMinutes(s, day, person) - cap);
}

/** Open tasks the person owns or helps with that have no block yet: the calendar's tray. */
export function unscheduled(s: DemoState, person: TeamPersonId = CALENDAR_OWNER): Task[] {
  const placed = new Set(s.blocks.filter((b) => b.person === person).map((b) => b.taskId));
  return openTasks(s, { person }).filter((t) => !placed.has(t.id));
}

/* ── Search (Ctrl K) ────────────────────────────────────────────────── */

export type SearchHit = {
  kind: "project" | "task" | "person" | "file" | "supplier";
  id: string;
  title: string;
  /** One quiet line: the project, a role, a health. */
  detail: string;
  project?: ProjectId;
  score: number;
};

function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(/[\s,'&-]+/).some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  return 0;
}

/** Projects, people, tasks, suppliers and files, best first. */
export function search(s: DemoState, query: string, limit = 12): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  const kindBoost: Record<SearchHit["kind"], number> = { project: 6, person: 5, task: 3, supplier: 2, file: 1 };
  const add = (hit: Omit<SearchHit, "score">, ...texts: (string | undefined)[]) => {
    // The first text is the name; matches in later ones (notes, roles) rank lower.
    const best = Math.max(...texts.map((x, i) => (x ? Math.max(0, score(x, q) - i * 25) : 0)));
    if (best > 0) hits.push({ ...hit, score: best + kindBoost[hit.kind] });
  };
  for (const p of projectsOf(s))
    add({ kind: "project", id: p.id, title: p.name, detail: p.wrapped ? "Wrapped" : HEALTH_LABEL[p.health], project: p.id }, p.name, p.short);
  for (const p of PEOPLE) add({ kind: "person", id: p.id, title: p.name, detail: p.role }, p.name, p.role);
  for (const t of s.tasks)
    add({ kind: "task", id: t.id, title: t.title, detail: projectIn(s, t.project)?.short ?? "", project: t.project }, t.title, t.notes);
  for (const x of SUPPLIERS) add({ kind: "supplier", id: x.id, title: x.name, detail: x.what }, x.name, x.what);
  for (const f of FILES) add({ kind: "file", id: f.id, title: f.title, detail: projectById(f.project)?.short ?? "", project: f.project }, f.title, f.summary);
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/* ── Task history ───────────────────────────────────────────────────── */

const isState = (x: unknown): x is DemoState => !!x && typeof x === "object" && Array.isArray((x as DemoState).tasks);

/** Events grouped by task, cached per history array (the log only grows, so each edit makes a new array). */
const historyIndex = new WeakMap<readonly TaskEvent[], Map<string, TaskEvent[]>>();
function indexHistory(history: readonly TaskEvent[]): Map<string, TaskEvent[]> {
  let map = historyIndex.get(history);
  if (!map) {
    map = new Map();
    for (const e of history) {
      const list = map.get(e.taskId);
      if (list) list.push(e);
      else map.set(e.taskId, [e]);
    }
    historyIndex.set(history, map);
  }
  return map;
}

const historyOf = (s: DemoState): readonly TaskEvent[] => s.history ?? INITIAL_STATE.history;

/**
 * One task's events, oldest first. `historyFor(s, id)` reads a state (the
 * live one inside useDemoStore); `historyFor(id)` reads the canonical world.
 */
export function historyFor(a: DemoState | string, b?: string | DemoState): TaskEvent[] {
  const s = isState(a) ? a : isState(b) ? b : INITIAL_STATE;
  const id = typeof a === "string" ? a : typeof b === "string" ? b : "";
  return (indexHistory(historyOf(s)).get(id) ?? []).slice();
}

/** The status the events say a task had at the end of a day. "created" counts as entering its first status. */
function replayStatus(events: readonly TaskEvent[], date: IsoDate): TaskStatus | undefined {
  let out: TaskStatus | undefined;
  for (const e of events) {
    if (e.on > date) break;
    if ((e.kind === "created" || e.kind === "status") && e.to) out = e.to as TaskStatus;
  }
  return out;
}

/**
 * The status a task had at the end of a day; undefined before it was
 * created. Call it `statusOn(task, date, s?)` or `statusOn(s, taskOrId, date)`.
 * With a state it replays that state's history exactly. Without one it reads
 * the canonical history, and trusts the task itself from its `since` on.
 */
export function statusOn(task: Task, date: IsoDate, s?: DemoState): TaskStatus | undefined;
export function statusOn(s: DemoState, task: Task | string, date: IsoDate): TaskStatus | undefined;
export function statusOn(a: Task | DemoState, b: IsoDate | Task | string, c?: DemoState | IsoDate): TaskStatus | undefined {
  let task: Task | undefined;
  let date: IsoDate;
  let s: DemoState | undefined;
  if (isState(a)) {
    s = a;
    task = typeof b === "string" ? a.tasks.find((t) => t.id === b) : (b as Task);
    date = c as IsoDate;
  } else {
    task = a;
    date = b as IsoDate;
    s = c as DemoState | undefined;
  }
  if (!task || date < task.created) return undefined;
  if (!s && date >= task.since) return task.status;
  const events = indexHistory(historyOf(s ?? INITIAL_STATE)).get(task.id) ?? [];
  return replayStatus(events, date) ?? (date >= task.since ? task.status : "todo");
}

/** The board as it stood at the end of a day: tasks that existed then, grouped by the status they had. For replays. */
export function boardOn(s: DemoState, date: IsoDate, scope?: Scope): Record<TaskStatus, Task[]> {
  const out: Record<TaskStatus, Task[]> = { todo: [], doing: [], waiting: [], review: [], done: [] };
  for (const t of tasksIn(s, scope)) {
    const st = statusOn(s, t, date);
    if (st) out[st].push(t);
  }
  return out;
}

export type TaskMove = {
  task: Task;
  /** Its status the day before the window; undefined when it was created inside it. */
  from?: TaskStatus;
  /** Its status at the end of the window. */
  to: TaskStatus;
  /** The day of its last move inside the window. */
  on: IsoDate;
  /** Status changes inside the window. */
  steps: number;
};

/** Tasks whose status changed between two days, inclusive, most recent first. A task that moved and came back is left out. */
export function movedBetween(s: DemoState, from: IsoDate, to: IsoDate, scope?: Scope): TaskMove[] {
  const index = indexHistory(historyOf(s));
  const out: TaskMove[] = [];
  for (const t of tasksIn(s, scope)) {
    const moves = (index.get(t.id) ?? []).filter((e) => e.kind === "status" && e.on >= from && e.on <= to);
    if (!moves.length) continue;
    const before = statusOn(s, t, addDays(from, -1));
    const after = statusOn(s, t, to);
    if (!after || before === after) continue;
    out.push({ task: t, from: before, to: after, on: moves[moves.length - 1].on, steps: moves.length });
  }
  return out.sort((a, b) => b.on.localeCompare(a.on) || a.task.id.localeCompare(b.task.id));
}

/** Tasks created between two days, inclusive, oldest first. */
export function cameIn(s: DemoState, from: IsoDate, to: IsoDate, scope?: Scope): Task[] {
  return tasksIn(s, scope)
    .filter((t) => t.created >= from && t.created <= to)
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

/* ── Project history and updates ────────────────────────────────────── */

/** One project's events, oldest first. `projectHistory(s, id)`, or `projectHistory(id)` for the canonical world. */
export function projectHistory(a: DemoState | string, b?: string | DemoState): ProjectEvent[] {
  const s = isState(a) ? a : isState(b) ? b : INITIAL_STATE;
  const id = typeof a === "string" ? a : typeof b === "string" ? b : "";
  return (s.projectEvents ?? INITIAL_STATE.projectEvents).filter((e) => e.projectId === id);
}

/** One project's updates feed, newest first. `projectUpdates(s, id)`, or `projectUpdates(id)`. */
export function projectUpdates(a: DemoState | string, b?: string | DemoState): ProjectUpdate[] {
  const s = isState(a) ? a : isState(b) ? b : INITIAL_STATE;
  const id = typeof a === "string" ? a : typeof b === "string" ? b : "";
  return (s.updates ?? INITIAL_STATE.updates)
    .map((u, i) => ({ u, i }))
    .filter(({ u }) => u.projectId === id)
    .sort((x, y) => y.u.on.localeCompare(x.u.on) || y.i - x.i)
    .map(({ u }) => u);
}

/** A project's health at the end of a day, from its history; undefined before it began. */
export function healthOn(s: DemoState, project: ProjectId, date: IsoDate): Health | undefined {
  const p = projectIn(s, project);
  if (!p || date < p.start) return undefined;
  const changes = projectHistory(s, project).filter((e) => e.kind === "health");
  if (!changes.length) return p.health;
  let out = (changes[0].from as Health | undefined) ?? "on_track";
  for (const e of changes) if (e.on <= date && e.to) out = e.to as Health;
  return out;
}

/* ── The lead stuck task ────────────────────────────────────────────── */

/** A project whose day is further off than this does not pull its stuck work forward. */
export const NEAR_DAYS = 60;

/** Days until a project's day (a season's last day once it has begun); Infinity when it is not near. */
function daysToTheDay(p: Project | undefined, today: IsoDate): number {
  if (!p) return Infinity;
  const day = p.date >= today ? p.date : p.end && p.end >= today ? p.end : p.date;
  const n = daysBetween(today, day);
  return n > NEAR_DAYS ? Infinity : Math.max(0, n);
}

/**
 * Stuck work by urgency, not age: first by days until its project's day
 * (soonest first; projects with no near date last), then by days stuck.
 */
export function stuckByUrgency(s: DemoState, scope?: Scope, today: IsoDate = TODAY): Task[] {
  return stuckTasks(s, scope)
    .map((t) => ({ t, near: daysToTheDay(projectIn(s, t.project), today), age: ageInStatus(t, today) }))
    .sort((a, b) => (a.near === b.near ? 0 : a.near < b.near ? -1 : 1) || b.age - a.age || a.t.id.localeCompare(b.t.id))
    .map(({ t }) => t);
}

/** The one stuck task to lead with. Across the workspace: "Chase florist deposit". */
export function leadStuck(s: DemoState, scope?: Scope): Task | undefined {
  return stuckByUrgency(s, scope)[0];
}

export type StuckSentence = {
  task: Task;
  /** Days without movement. */
  days: number;
  /** Who it waits on, by name ("Fern and Furrow"), when it is Waiting. */
  waitingOn?: string;
  /** The button: "Nudge Fern and Furrow", "Nudge Dev", "Check it", "Open it". */
  actionLabel: string;
  /** "3 more stuck", or "" when it is the only one. */
  more: string;
  moreCount: number;
  /** "Chase florist deposit has waited 7 days on Fern and Furrow." */
  sentence: string;
};

/** The lead stuck task in words, so every surface says it the same way. Undefined when nothing is stuck. */
export function stuckSentence(s: DemoState, scope?: Scope): StuckSentence | undefined {
  const all = stuckByUrgency(s, scope);
  const task = all[0];
  if (!task) return undefined;
  const days = ageInStatus(task);
  const waitingOn = task.status === "waiting" ? waitingOnName(task) : undefined;
  const owner = task.owner === VIEWER ? undefined : personById(task.owner)?.first;
  let sentence: string;
  let actionLabel: string;
  if (waitingOn) {
    sentence = `${task.title} has waited ${fmtDays(days)} on ${waitingOn}.`;
    actionLabel = `Nudge ${waitingOn}`;
  } else if (task.status === "review") {
    sentence = `${task.title} has waited ${fmtDays(days)} to be checked.`;
    actionLabel = owner ? `Nudge ${owner}` : "Check it";
  } else {
    sentence = `${task.title} has not moved in ${fmtDays(days)}.`;
    actionLabel = owner ? `Nudge ${owner}` : "Open it";
  }
  const moreCount = all.length - 1;
  return { task, days, waitingOn, actionLabel, more: moreCount ? `${moreCount} more stuck` : "", moreCount, sentence };
}

/* ── Projects at a glance (the Projects console) ────────────────────── */

/** How the console groups project kinds for its filters. Marketing shows under All only. */
export type ProjectGroup = "events" | "works" | "marketing";
export const PROJECT_GROUP: Record<Project["kind"], ProjectGroup> = {
  wedding: "events",
  event: "events",
  season: "events",
  works: "works",
  operations: "works",
  marketing: "marketing",
};

/** The console's filters, in order. */
export type ProjectFilter = "all" | "attention" | "mine" | "events" | "works" | "wrapped";
export const PROJECT_FILTERS: readonly ProjectFilter[] = ["all", "attention", "mine", "events", "works", "wrapped"];

/** Needs a look: active and at risk, off track, or past its date. */
export function needsALook(p: Project, today: IsoDate = TODAY): boolean {
  if (p.wrapped) return false;
  return p.health !== "on_track" || (p.end ?? p.date) < today;
}

/** Where a project sits in the console's groups: needs a look, on track, or too early to tell. */
export type ProjectStanding = "attention" | "on_track" | "too_early";
export function projectStanding(p: Project, today: IsoDate = TODAY): ProjectStanding {
  if (needsALook(p, today)) return "attention";
  return p.tooEarly ? "too_early" : "on_track";
}

/** The projects one filter shows, soonest date first (wrapped: most recent first). "all" is every active project. */
export function projectsFiltered(s: DemoState, filter: ProjectFilter): Project[] {
  const active = activeProjects(s);
  const pick =
    filter === "all"
      ? active
      : filter === "attention"
        ? active.filter((p) => needsALook(p))
        : filter === "mine"
          ? active.filter((p) => p.lead === VIEWER)
          : filter === "events" || filter === "works"
            ? active.filter((p) => PROJECT_GROUP[p.kind] === filter)
            : wrappedProjects(s);
  return pick
    .slice()
    .sort((a, b) => (filter === "wrapped" ? (b.wrapped?.on ?? b.date).localeCompare(a.wrapped?.on ?? a.date) : a.date.localeCompare(b.date)) || a.id.localeCompare(b.id));
}

/** How many projects each filter shows. */
export function projectFilterCounts(s: DemoState): Record<ProjectFilter, number> {
  return Object.fromEntries(PROJECT_FILTERS.map((f) => [f, projectsFiltered(s, f).length])) as Record<ProjectFilter, number>;
}

export type ProjectGlance = {
  project: Project;
  standing: ProjectStanding;
  counts: Counts;
  forecast: Forecast;
  /** The next big date not yet done: a late one first, else the next one ahead. */
  next?: MilestoneView;
  /** Share of the wait for the next big date that has gone, 0 to 1, counted from the big date before it (or the start). */
  nextElapsed: number;
  /** Late tasks, oldest first. */
  late: Task[];
  /** Waiting tasks, longest wait first. */
  waiting: Task[];
  /** What Nudge chases: the lead stuck task, else the longest wait, else the oldest late task someone else owns. */
  nudge?: { task: Task; who: string };
  /** That task was nudged today already, read from its history. */
  nudgedToday: boolean;
};

/** One project's row in the console: what is done, its next big date, late work and what it waits on. */
export function projectGlance(s: DemoState, id: ProjectId, today: IsoDate = TODAY): ProjectGlance | undefined {
  const project = projectIn(s, id);
  if (!project) return undefined;
  const scope = { project: id };
  const ahead = milestonesFor(id, s).filter((m) => !m.done);
  const next = ahead.find((m) => m.date < today) ?? ahead.find((m) => m.date >= today);
  let nextElapsed = 0;
  if (next) {
    const before = project.milestones
      .filter((m) => m.date < next.date)
      .map((m) => m.date)
      .sort();
    const from = before.length ? before[before.length - 1] : project.start;
    const span = daysBetween(from, next.date);
    nextElapsed = next.date < today || span <= 0 ? 1 : Math.min(1, Math.max(0, daysBetween(from, today) / span));
  }
  const late = lateTasks(s, scope).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "") || a.id.localeCompare(b.id));
  const waiting = waitingTasks(s, scope).sort((a, b) => ageInStatus(b, today) - ageInStatus(a, today) || a.id.localeCompare(b.id));
  // Nobody nudges themselves: a task the viewer owns is only a candidate while it waits on someone else.
  const target = [leadStuck(s, scope), ...waiting, ...late].find((t): t is Task => !!t && (t.status === "waiting" || t.owner !== VIEWER));
  const nudge = target ? { task: target, who: (target.status === "waiting" && waitingOnName(target)) || nameOf(target.owner) } : undefined;
  const nudgedToday = !!target && historyFor(s, target.id).some((e) => e.kind === "nudged" && e.on === today);
  return { project, standing: projectStanding(project, today), counts: countsFor(s, id), forecast: forecast(s, id, today), next, nextElapsed, late, waiting, nudge, nudgedToday };
}

/** Every active project by how it is doing, soonest first, and the most urgent one that needs a look. */
export function standingSummary(s: DemoState, today: IsoDate = TODAY): { offTrack: Project[]; atRisk: Project[]; onTrack: Project[]; tooEarly: Project[]; first?: Project } {
  const active = activeProjects(s)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const looks = active.filter((p) => needsALook(p, today));
  return {
    offTrack: active.filter((p) => p.health === "off_track"),
    atRisk: active.filter((p) => p.health === "at_risk"),
    onTrack: active.filter((p) => p.health === "on_track" && !p.tooEarly),
    tooEarly: active.filter((p) => p.health === "on_track" && !!p.tooEarly),
    // The most urgent is the one whose day comes first.
    first: looks.find((p) => p.date >= today) ?? looks[0],
  };
}

/** The next wedding or event day ahead, with its countdown and counts. */
export function nextBigDay(s: DemoState, today: IsoDate = TODAY): { project: Project; days: number; counts: Counts } | undefined {
  const p = activeProjects(s)
    .filter((x) => PROJECT_GROUP[x.kind] === "events" && x.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  return p ? { project: p, days: daysBetween(today, p.date), counts: countsFor(s, p.id) } : undefined;
}

/** Late work across the venue, by project (most first), with the oldest late task. */
export function lateAcrossVenue(s: DemoState): { total: number; byProject: { project: Project; late: number }[]; oldest?: Task } {
  const late = lateTasks(s);
  const byProject = activeProjects(s)
    .map((project) => ({ project, late: late.filter((t) => t.project === project.id).length }))
    .filter((x) => x.late > 0)
    .sort((a, b) => b.late - a.late || a.project.date.localeCompare(b.project.date));
  const oldest = late.slice().sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "") || a.id.localeCompare(b.id))[0];
  return { total: late.length, byProject, oldest };
}

/** This calendar week, Monday to Sunday: tasks finished each day, the pace story, and the busiest project. */
export function weekDone(
  s: DemoState,
  today: IsoDate = TODAY,
): { days: { day: IsoDate; done: number; future: boolean }[]; pace: PaceStory; busiest?: { project: Project; done: number } } {
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, done: day > today ? 0 : doneBetween(s, day, day).length, future: day > today };
  });
  const pace = paceStory(s, undefined, today);
  const busiest = activeProjects(s)
    .map((project) => ({ project, done: paceStory(s, { project: project.id }, today).thisWeek }))
    .sort((a, b) => b.done - a.done || a.project.date.localeCompare(b.project.date))[0];
  return { days, pace, busiest: busiest && busiest.done > 0 ? busiest : undefined };
}
