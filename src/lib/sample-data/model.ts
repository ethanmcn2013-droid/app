/**
 * Sample data model (operator only).
 *
 * Three invented sets an operator can add to their own account to see the
 * product with realistic material in it. Everything here is synthetic: no real
 * school, university, business or person. People appear only as first names
 * inside task text, never as members, assignees or contacts with an address.
 *
 * Pure and client-safe: no database, no I/O. Dates are day offsets from the
 * day the set is added, so there is always a mix of late, due today, due this
 * week, later and done.
 */

import type { ColumnColorKey } from "@/lib/board-colors";
import type { Priority } from "@/lib/data";

export const SAMPLE_SET_IDS = ["teacher", "student", "wedding"] as const;
export type SampleSetId = (typeof SAMPLE_SET_IDS)[number];

export function isSampleSetId(value: unknown): value is SampleSetId {
  return typeof value === "string" && (SAMPLE_SET_IDS as readonly string[]).includes(value);
}

/** The five default board columns. "waiting" is the default custom column. */
export type SampleStatus = "todo" | "doing" | "review" | "waiting" | "done";

export type SampleStep = Readonly<{ title: string; done?: boolean }>;

export type SampleTask = Readonly<{
  title: string;
  status: SampleStatus;
  /** Whole days from the run day. Negative is in the past. Null is undated. */
  due: number | null;
  priority?: Priority;
  labels?: readonly string[];
  /** Task description. */
  notes?: string;
  /** A big date: shown as a milestone on the board and the Timeline. */
  bigDate?: boolean;
  /** Assigned to the operator who adds the set. Otherwise unassigned. */
  mine?: boolean;
  /** Amount in whole euro, stored as cents. */
  euros?: number;
  /** Estimate in hours. */
  hours?: number;
  /** Repeats weekly on the weekday its due date falls on. */
  weekly?: boolean;
  steps?: readonly SampleStep[];
  /** A link resource. Always on the reserved example.com domain. */
  link?: Readonly<{ title: string; path: string }>;
}>;

export type SampleProject = Readonly<{
  /** Stable key. Part of the project identity, so never rename one. */
  key: string;
  /** Shown name, before the quiet sample marker is added. */
  name: string;
  /** One plain line about the project. The set name is added in front. */
  about: string;
  /**
   * The project's main date, as a day offset, with its label. Also stored as
   * the project's target date, which the Timeline and Projects pages read.
   */
  mainDate?: Readonly<{ due: number; label: string }>;
  /** The declared project status. Absent leaves it as "No status". */
  status?: "on-track" | "at-risk" | "paused" | "complete";
  /** Budget in whole euro. Sets the project currency to EUR. */
  budgetEuros?: number;
  labels: readonly Readonly<{ name: string; color: ColumnColorKey }>[];
  tasks: readonly SampleTask[];
}>;

export type SampleSet = Readonly<{
  id: SampleSetId;
  /** Sentence case, used in descriptions and confirmations. */
  name: string;
  /** One line for the Settings row. */
  blurb: string;
  projects: readonly SampleProject[];
}>;

/** Hard ceilings. A set that breaks one is refused before anything is written. */
export const SAMPLE_LIMITS = Object.freeze({
  projectsPerSet: 8,
  tasksPerProject: 40,
  stepsPerTask: 8,
  rowsPerSet: 200,
});

/** The quiet marker every sample project name carries. */
export const SAMPLE_NAME_MARKER = "sample";

export function sampleProjectName(project: Pick<SampleProject, "name">): string {
  return `${project.name} · ${SAMPLE_NAME_MARKER}`;
}

export function sampleProjectDescription(
  set: Pick<SampleSet, "name">,
  project: Pick<SampleProject, "about">,
): string {
  return `Sample data: ${set.name}. ${project.about}`;
}

export type SampleSetSummary = Readonly<{
  id: SampleSetId;
  name: string;
  blurb: string;
  projectNames: readonly string[];
  projects: number;
  tasks: number;
  steps: number;
  bigDates: number;
  links: number;
  byStatus: Readonly<Record<SampleStatus, number>>;
  labels: readonly string[];
}>;

export function summariseSampleSet(set: SampleSet): SampleSetSummary {
  const byStatus: Record<SampleStatus, number> = { todo: 0, doing: 0, review: 0, waiting: 0, done: 0 };
  let tasks = 0;
  let steps = 0;
  let bigDates = 0;
  let links = 0;
  const labels = new Set<string>();
  for (const project of set.projects) {
    for (const label of project.labels) labels.add(label.name);
    for (const task of project.tasks) {
      tasks += 1;
      byStatus[task.status] += 1;
      steps += task.steps?.length ?? 0;
      if (task.bigDate) bigDates += 1;
      if (task.link) links += 1;
    }
  }
  return Object.freeze({
    id: set.id,
    name: set.name,
    blurb: set.blurb,
    projectNames: set.projects.map(sampleProjectName),
    projects: set.projects.length,
    tasks,
    steps,
    bigDates,
    links,
    byStatus: Object.freeze(byStatus),
    labels: [...labels].sort((a, b) => a.localeCompare(b)),
  });
}

/** Refuse a malformed or oversized set before any write. */
export function assertSampleSetWithinLimits(set: SampleSet): void {
  if (set.projects.length === 0 || set.projects.length > SAMPLE_LIMITS.projectsPerSet) {
    throw new Error("Sample set has an unexpected number of projects.");
  }
  const keys = new Set<string>();
  let rows = 0;
  for (const project of set.projects) {
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(project.key) || keys.has(project.key)) {
      throw new Error("Sample set has an invalid project key.");
    }
    keys.add(project.key);
    if (project.tasks.length === 0 || project.tasks.length > SAMPLE_LIMITS.tasksPerProject) {
      throw new Error("Sample project has an unexpected number of tasks.");
    }
    const known = new Set(project.labels.map((label) => label.name));
    for (const task of project.tasks) {
      rows += 1 + (task.steps?.length ?? 0);
      if ((task.steps?.length ?? 0) > SAMPLE_LIMITS.stepsPerTask) {
        throw new Error("Sample task has too many steps.");
      }
      for (const label of task.labels ?? []) {
        if (!known.has(label)) throw new Error("Sample task uses a label its project does not define.");
      }
    }
  }
  if (rows > SAMPLE_LIMITS.rowsPerSet) throw new Error("Sample set is larger than the limit.");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** The run day as a calendar date (UTC), the anchor every offset counts from. */
export function sampleRunDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** A calendar date a whole number of days from the run day. */
export function sampleCalendarDate(runDay: string, offsetDays: number): string {
  return new Date(Date.parse(`${runDay}T00:00:00.000Z`) + Math.trunc(offsetDays) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The stored due label, in the same shape the task actions store: Today,
 * Tomorrow, a weekday inside the week, otherwise month and day.
 */
export function sampleDueLabel(runDay: string, offsetDays: number): string {
  const offset = Math.trunc(offsetDays);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const date = new Date(Date.parse(`${runDay}T00:00:00.000Z`) + offset * DAY_MS);
  if (offset > 1 && offset < 7) return DOW_SHORT[date.getUTCDay()];
  return `${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Weekday (0 is Sunday) of an offset date, for weekly repeats. */
export function sampleWeekday(runDay: string, offsetDays: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const date = new Date(Date.parse(`${runDay}T00:00:00.000Z`) + Math.trunc(offsetDays) * DAY_MS);
  return date.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

// ── What the server reports back ─────────────────────────────────────

export type SampleProjectPresence = Readonly<{ id: string; name: string }>;

export type SampleSetStatus = Readonly<{
  summary: SampleSetSummary;
  /** Marked sample projects of this set that exist now, owned by the operator. */
  present: readonly SampleProjectPresence[];
}>;

export type SeedSampleResult =
  | Readonly<{
      ok: true;
      set: SampleSetId;
      created: readonly string[];
      alreadyPresent: readonly string[];
      tasks: number;
      steps: number;
      links: number;
    }>
  | Readonly<{
      ok: false;
      set: SampleSetId;
      reason: "busy" | "failed";
      /** Whole projects that exist after this run. Nothing is ever half made. */
      created: readonly string[];
      alreadyPresent: readonly string[];
      failedAt?: string;
    }>;

export type RemoveSampleResult =
  | Readonly<{
      ok: true;
      set: SampleSetId;
      removed: readonly string[];
      /** Sample projects left alone because other people can reach them. */
      skipped: readonly string[];
    }>
  | Readonly<{
      ok: false;
      set: SampleSetId;
      reason: "busy" | "failed";
      removed: readonly string[];
      skipped: readonly string[];
      failedAt?: string;
    }>;
