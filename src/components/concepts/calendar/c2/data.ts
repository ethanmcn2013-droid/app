/* Plan my week, on the demo store. The week is the signed-in person's (Orla's),
 * or the person `?owner=` names: Monday 21 to Sunday 27 September 2026, today
 * Friday 25 at 11:40. Tasks, blocks, fixed events and each day's hours all
 * come from the store, for that one person; this file maps them to the
 * planner's own shapes. Days are indexes into the week (0 = Mon; above 6 is
 * next week). Times are minutes from midnight. */

import {
  NOW as STORE_NOW,
  TODAY as STORE_TODAY,
  VIEWER,
  WEEK_DAYS,
  WEEK_START as STORE_WEEK_START,
  addDays,
  blocksOn,
  capacityOf,
  daysBetween,
  fixedOn,
  fmtDay,
  personById,
  toMinutes,
  type Block,
  type DemoState,
  type ProjectId as StoreProjectId,
  type Task as StoreTask,
  type TeamPersonId,
} from "../../demo/store";
import { liveActiveProjects, liveProject } from "../../tasks/projects";
import type { TaskStatus } from "../../tasks/status";

export type ProjectId = StoreProjectId;

/** The shared Tasks stages. */
export type Status = TaskStatus;

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  color: string;
};

export type Plan = { day: number; start: number; dur: number };

export type Task = {
  id: string;
  title: string;
  project: ProjectId;
  /** Minutes. */
  estimate: number;
  /** Day index; above 6 means next week. Undefined: no date. */
  due?: number;
  status: Status;
  plan?: Plan;
  /** The store block behind the plan, so a move keeps its id. */
  blockId?: string;
  note?: string;
  with?: string;
  /** Who owns it, for the Tasks scope. */
  owner: string;
  /** Not on this person's week: shown because a link asked for it. */
  visiting?: boolean;
};

export type Fixed = {
  id: string;
  title: string;
  day: number;
  start: number;
  dur: number;
  personal?: boolean;
  where?: string;
};

export type Milestone = { id: string; title: string; day: number; project: ProjectId };


const color = (hue: number) => `var(--v3-project-${hue})`;

/**
 * Any project by id, read from the live store, so one made this session has
 * its name and its own hue here. An id that is not a project still gives a
 * neutral stand-in, so a block or a chip never fails to draw.
 */
export function projectOf(id: string | null | undefined): Project {
  const p = liveProject(id);
  if (p) return { id: p.id as ProjectId, name: p.name, short: p.short, color: color(p.hue) };
  return { id: (id ?? "") as ProjectId, name: id || "No project", short: id || "No project", color: "var(--v3-text-3)" };
}

/** The active projects now, for the week at a glance. */
export const activeProjectList = (): Project[] => liveActiveProjects().map((p) => projectOf(p.id));

const [wy, wm, wd] = STORE_WEEK_START.split("-").map(Number);
export const WEEK_START = { y: wy, m: wm - 1, d: wd }; // Monday 21 September 2026
export const TODAY = daysBetween(STORE_WEEK_START, STORE_TODAY); // 4: Friday 25 September
export const NOW = toMinutes(STORE_NOW); // 11:40

/** Day index to its ISO date, and back. */
export const isoOf = (day: number) => addDays(STORE_WEEK_START, day);
export const dayOf = (iso: string) => daysBetween(STORE_WEEK_START, iso);

export const GRID_START = 8 * 60;
export const GRID_END = 19 * 60;

/**
 * Each day's working window: `open` is when the day starts on the grid,
 * `start` when task work can begin, `end` when it stops. Null is a day off.
 */
export type DayWindow = { open: number; start: number; end: number } | null;

/* ── Whose week ──────────────────────────────────────────────────────
 * One person's week at a time. The hours, the working days and the fixed
 * events below are that person's; `setWeekOwner` swaps them in place, so the
 * grid, the tray, the meters, Make Friday fit and the footer always read the
 * same person. The planner calls it during render, before anything below it
 * draws (the same handover `useTaskScope` makes for the live projects). */

let owner: TeamPersonId = VIEWER;

/** Each day's working window, for the week's owner. */
export const WINDOWS: DayWindow[] = [];
/** Days with working time. */
export const WORK_DAYS: number[] = [];
/** Minutes set aside for task work each day, already less meetings. */
export const CAPACITY: number[] = [];
export const CAPACITY_NOTE: string[] = [];
/** What is fixed on the owner's calendar: meetings and personal time. */
export const FIXED: Fixed[] = [];

const fill = <T,>(into: T[], from: T[]) => {
  into.length = 0;
  into.push(...from);
};

function loadWeek(id: TeamPersonId) {
  owner = id;
  const week = capacityOf(id);
  const cap = (day: string) => week.find((c) => c.day === day);
  fill(
    WINDOWS,
    WEEK_DAYS.map((day) => {
      const w = cap(day)?.window;
      return w ? { open: toMinutes(w.open), start: toMinutes(w.start), end: toMinutes(w.end) } : null;
    }),
  );
  fill(WORK_DAYS, WINDOWS.map((w, i) => (w ? i : -1)).filter((i) => i >= 0));
  fill(CAPACITY, WEEK_DAYS.map((day) => cap(day)?.minutes ?? 0));
  fill(CAPACITY_NOTE, WEEK_DAYS.map((day) => cap(day)?.note ?? ""));
  fill(
    FIXED,
    WEEK_DAYS.flatMap((day, i) =>
      fixedOn(day, id).map((e) => ({ id: e.id, title: e.title, day: i, start: toMinutes(e.start), dur: e.minutes, personal: e.personal, where: e.where })),
    ),
  );
}
loadWeek(VIEWER);

/** Show this person's week. Cheap when it is already theirs. */
export function setWeekOwner(id: TeamPersonId): void {
  if (id !== owner) loadWeek(id);
}

/** Whose week it is. */
export const weekOwner = (): TeamPersonId => owner;
/** The week is the signed-in person's own. */
export const ownWeek = (): boolean => owner === VIEWER;
/** "Your week", or "Aoife's week". */
export const weekName = (): string => (owner === VIEWER ? "Your week" : `${personById(owner)?.first ?? owner}'s week`);
/** "your", or "Aoife's", for the middle of a sentence. */
export const weekWhose = (): string => (owner === VIEWER ? "your" : `${personById(owner)?.first ?? owner}'s`);
/** The last day this week with working time. */
export const lastWorkDay = (): number => WORK_DAYS[WORK_DAYS.length - 1] ?? 4;

export const ESTIMATES = [15, 30, 60, 120, 240];

/** Nothing lands this week; Mara & Finn's wedding is next Saturday, 3 Oct. */
export const MILESTONES: Milestone[] = [];

/* ── From the store ──────────────────────────────────────────────── */

const withWhom = (t: StoreTask) => {
  const names = [t.owner, ...(t.helpers ?? [])].filter((id) => id !== owner).map((id) => personById(id)?.name ?? id);
  return names.length ? names.join(" and ") : undefined;
};

export function toCalTask(t: StoreTask, block?: Block, visiting = false): Task {
  return {
    id: t.id,
    title: t.title,
    project: t.project,
    estimate: t.estimate ?? 30,
    due: t.due ? dayOf(t.due) : undefined,
    status: t.status,
    plan: block ? { day: dayOf(block.day), start: toMinutes(block.start), dur: block.minutes } : undefined,
    blockId: block?.id,
    note: t.notes,
    with: withWhom(t),
    owner: t.owner,
    visiting: visiting || undefined,
  };
}

/**
 * One person's week: every task with a block of theirs this week, then every
 * open task they own or help with that has no time yet (the tray). `extra`
 * adds one more task, when a link asks for it.
 */
export function weekTasks(s: DemoState, extra?: string, person: TeamPersonId = owner): Task[] {
  const out: Task[] = [];
  const seen = new Set<string>();
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  for (const day of WEEK_DAYS)
    for (const b of blocksOn(s, day, person)) {
      const t = byId.get(b.taskId);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(toCalTask(t, b));
    }
  const placed = new Set(s.blocks.filter((b) => b.person === person).map((b) => b.taskId));
  for (const t of s.tasks) {
    if (seen.has(t.id) || t.status === "done" || placed.has(t.id)) continue;
    if (t.owner !== person && !(t.helpers ?? []).includes(person)) continue;
    seen.add(t.id);
    out.push(toCalTask(t));
  }
  if (extra && !seen.has(extra)) {
    const t = byId.get(extra);
    if (t) out.push(toCalTask(t, undefined, true));
  }
  return out;
}

/* ── Formatting ───────────────────────────────────────────────────── */

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateOf(day: number) {
  const d = new Date(Date.UTC(WEEK_START.y, WEEK_START.m, WEEK_START.d + day));
  return { date: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], dow: (d.getUTCDay() + 6) % 7 };
}

export const dayShort = (day: number) => DAY_SHORT[((day % 7) + 7) % 7];
export const dayLong = (day: number) => DAY_LONG[((day % 7) + 7) % 7];
/** "Mon 28 Sep", with the year outside 2026: "Sun 14 Mar 2027". */
export const dayDate = (day: number) => fmtDay(isoOf(day));

export function clock(min: number) {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

export function dur(min: number) {
  if (min <= 0) return "0m";
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (!hh) return `${mm}m`;
  if (!mm) return `${hh}h`;
  return `${hh}h ${mm}m`;
}

export function estimateLabel(min: number) {
  return min === 240 ? "Half a day" : dur(min);
}

export function dueLabel(due: number | undefined) {
  if (due === undefined) return "No date";
  if (due === TODAY) return "Due today";
  if (due === TODAY + 1) return "Due tomorrow";
  if (due > TODAY && due <= 6) return `Due ${dayShort(due)}`;
  if (due > 6) return `Due ${dayDate(due)}`;
  if (due >= 0) return `Was due ${dayShort(due)}`;
  return `Was due ${dayDate(due)}`;
}

export const isOverdue = (task: Task) => task.due !== undefined && task.due < TODAY && task.status !== "done";
/** Planned on a day after the day it is due. */
export const plannedLate = (task: Task) =>
  task.plan !== undefined && task.due !== undefined && task.plan.day > task.due && task.status !== "done";

export type Tab = "week" | "overdue" | "none";
export function trayTab(task: Task): Tab | null {
  if (task.plan || task.status === "done") return null;
  if (task.due === undefined) return "none";
  if (task.due < TODAY) return "overdue";
  return "week";
}

export function plannedOn(tasks: Task[], day: number, exceptId?: string) {
  let sum = 0;
  for (const x of tasks) if (x.plan && x.plan.day === day && x.id !== exceptId) sum += x.plan.dur;
  return sum;
}

export type Tone = "ok" | "tight" | "over" | "off";
export function meterTone(planned: number, cap: number): Tone {
  if (cap === 0) return planned > 0 ? "over" : "off";
  const r = planned / cap;
  if (r > 1) return "over";
  if (r >= 0.85) return "tight";
  return "ok";
}

export function meterWords(planned: number, cap: number) {
  if (cap === 0) return planned > 0 ? `${dur(planned)} on a day off` : "Day off";
  if (planned > cap) return `Over by ${dur(planned - cap)}`;
  return `${dur(planned)} of ${dur(cap)}`;
}

/* ── Free time ───────────────────────────────────────────────────── */

type Span = { start: number; end: number };

export function busy(tasks: Task[], day: number, exceptId?: string): Span[] {
  const spans: Span[] = [];
  for (const f of FIXED) if (f.day === day) spans.push({ start: f.start, end: f.start + f.dur });
  for (const x of tasks)
    if (x.plan && x.plan.day === day && x.id !== exceptId) spans.push({ start: x.plan.start, end: x.plan.start + x.plan.dur });
  return spans.sort((a, b) => a.start - b.start);
}

/** Earliest start on a day at or after `from` with `length` free minutes inside working hours. */
export function firstGap(tasks: Task[], day: number, length: number, from: number, exceptId?: string): number | null {
  const win = WINDOWS[day];
  if (!win) return null;
  let cursor = Math.max(from, win.start);
  cursor = Math.ceil(cursor / 15) * 15;
  const spans = busy(tasks, day, exceptId);
  for (const s of spans) {
    if (s.end <= cursor) continue;
    if (s.start - cursor >= length) break;
    cursor = Math.max(cursor, s.end);
  }
  return cursor + length <= win.end ? cursor : null;
}

export type FitResult = { placed: { id: string; plan: Plan }[]; unplaced: string[] };

/** Flow tasks into open gaps from now onward, earliest due first, keeping each day inside its capacity. */
export function autoFit(tasks: Task[], ids: string[]): FitResult {
  const working = tasks.map((x) => ({ ...x }));
  const order = ids
    .map((id) => working.find((x) => x.id === id)!)
    .filter(Boolean)
    .sort((a, b) => (a.due ?? 99) - (b.due ?? 99) || b.estimate - a.estimate);
  const placed: FitResult["placed"] = [];
  const unplaced: string[] = [];
  for (const task of order) {
    /* Work that is already late takes the first free time left this week; the block still shows it was due earlier. */
    const last = lastWorkDay();
    const lastDay = task.due === undefined || task.due < TODAY ? last : Math.min(last, Math.max(task.due, TODAY));
    let done = false;
    for (let day = TODAY; day <= lastDay && !done; day++) {
      if (plannedOn(working, day) + task.estimate > CAPACITY[day]) continue;
      const start = firstGap(working, day, task.estimate, day === TODAY ? NOW : 0);
      if (start === null) continue;
      const plan = { day, start, dur: task.estimate };
      task.plan = plan;
      placed.push({ id: task.id, plan });
      done = true;
    }
    if (!done) unplaced.push(task.id);
  }
  return { placed, unplaced };
}
