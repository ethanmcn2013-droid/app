/**
 * Home's presentation model (5 October 2026): what needs the reader today,
 * across every Project they can open.
 *
 * Pure and client-safe. The server read (`src/server/home/home-board-read.ts`)
 * hands over plain facts for Projects the catalog already authorized; this
 * module turns them into the page. Every count, name and date here comes from
 * those facts. Nothing is forecast and nobody is guessed at:
 *
 *   - "yours" is a task you are assigned to, or a task nobody current is
 *     assigned to in a Project you own;
 *   - "late" is an unfinished task whose date is before today in your time
 *     zone, the same rule the Projects page counts by;
 *   - "waiting" is a task sitting in the board's own Waiting column, and how
 *     long is the time since the task last changed, nothing finer;
 *   - Project standing, the next big date and "done this week" are the
 *     Projects page's own figures (`project-console.ts`).
 */

import { WAITING_COLUMN_KEY } from "@/lib/board-config";
import type { ColumnColorKey } from "@/lib/board-colors";
import {
  buildConsole,
  dayOrdinalIn,
  formatConsoleDate,
  formatDayCount,
  ordinalToIsoDate,
  type ConsoleMark,
  type ConsoleProjectInput,
} from "@/lib/projects/project-console";
import { parseProjectId } from "@/lib/projects/project-ref";
import { buildProjectUrl, withActiveProject } from "@/lib/projects/project-url";

// ── What the server hands over ─────────────────────────────────────────────

export type HomeColumn = Readonly<{
  key: string;
  name: string;
  isDone: boolean;
  isSystem: boolean;
  color: ColumnColorKey;
}>;

export type HomeTaskFact = Readonly<{
  id: string;
  projectId: string;
  title: string;
  /** The task's effective board column. */
  columnKey: string;
  /** Epoch milliseconds, or null. */
  dueAt: number | null;
  completedAt: number | null;
  updatedAt: number;
  assignees: readonly string[];
  /** Completing a repeating task brings it round again; there is no undo. */
  recurring: boolean;
}>;

export type HomeProjectFact = ConsoleProjectInput &
  Readonly<{
    columns: readonly HomeColumn[];
    /** Current members of this Project, by user id. Nobody else is named. */
    members: Readonly<Record<string, string>>;
  }>;

export type HomeBoardInput = Readonly<{
  /** Epoch milliseconds. */
  now: number;
  timeZone: string;
  viewerId: string;
  /** The reader's own name, or null. */
  viewerName: string | null;
  projects: readonly HomeProjectFact[];
  tasks: readonly HomeTaskFact[];
  /** The task read hit its bound: lists are right, but may not be complete. */
  truncated: boolean;
  /** False where nothing can be saved or sent (review mode). */
  canAct: boolean;
}>;

// ── What the page draws ────────────────────────────────────────────────────

export type HomeRow = Readonly<{
  id: string;
  title: string;
  href: string;
  projectId: string;
  projectName: string;
  column: HomeColumn | null;
  done: boolean;
  late: boolean;
  /** "7 days late", "Due today", "Due in 5 days", "No date", "Done". */
  due: string;
  note: string | null;
  recurring: boolean;
}>;

export type HomeStuck = Readonly<{
  taskId: string;
  title: string;
  href: string;
  /** The rest of the sentence, starting with a space. */
  rest: string;
  /** Someone else on the task who is still a member, by name. */
  nudge: string | null;
  more: number;
  moreHref: string;
}>;

export type HomeNextDay = Readonly<{
  projectId: string;
  title: string;
  /** The Project's name, when the title is a big date inside it. */
  projectName: string | null;
  projectHref: string;
  days: number;
  dayLabel: string;
  mark: ConsoleMark;
  markLabel: string;
  open: number;
  late: number;
  timelineHref: string;
  tasksHref: string;
}>;

export type HomeProjectRow = Readonly<{
  id: string;
  name: string;
  href: string;
  mark: ConsoleMark;
  markLabel: string;
  /** Said only when the Project is not simply on track. */
  word: string | null;
  tone: "late" | "risk" | null;
  late: number;
  date: string | null;
}>;

export type HomeBoard = Readonly<{
  today: string;
  /** "Monday 5 October". */
  dateLabel: string;
  firstName: string | null;
  /** The greeting for this hour in the reader's saved time zone; the browser's own clock takes over once it loads. */
  serverGreeting: string;
  canAct: boolean;
  needsYou: number;
  /** Null when some Project's counts could not be read. */
  lateEverywhere: number | null;
  /** Where the late count leads. */
  lateHref: string;
  /** "across your projects", or "in Winter launch" when there is one. */
  lateWhere: string;
  doneThisWeek: number | null;
  stuck: HomeStuck | null;
  late: readonly HomeRow[];
  dueToday: readonly HomeRow[];
  soon: readonly HomeRow[];
  soonMore: number;
  toCheck: readonly HomeRow[];
  toCheckMore: number;
  waiting: readonly HomeRow[];
  /** Your open tasks with no date on them, and where to give them one. */
  undated: number;
  undatedHref: string;
  nextDay: HomeNextDay | null;
  projects: readonly HomeProjectRow[];
  projectCount: number;
  projectsHref: string;
  footnote: string | null;
  newTaskHref: string;
  truncated: boolean;
}>;

// ── Words ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Monday 5 October". Spelled here so the server and the browser agree. */
export function formatLongDay(isoDate: string): string {
  const ms = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) return isoDate;
  const date = new Date(ms);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** The greeting for an hour of the reader's own day, 0 to 23. */
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function hourIn(timeZone: string, ms: number): number {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));
  return Number.isFinite(hour) ? hour % 24 : 12;
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  // An email's local part or a handle is not a name to greet someone by.
  return first && !first.includes("@") ? first : null;
}

function dueWords(days: number | null): string {
  if (days === null) return "No date";
  if (days < 0) return `${formatDayCount(-days)} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${formatDayCount(days)}`;
}

function quietFor(days: number): string | null {
  return days >= 1 ? `no change in ${formatDayCount(days)}` : null;
}

const SOON_DAYS = 7;
const SOON_CAP = 6;
const CHECK_CAP = 5;
const PROJECT_CAP = 7;
/** Quiet this long in Waiting reads as stuck: the briefing's own threshold. */
const STUCK_DAYS = 3;

const MARK_WORD: Readonly<Record<ConsoleMark, { word: string | null; tone: "late" | "risk" | null }>> = {
  past_date: { word: "Past its date", tone: "late" },
  at_risk: { word: "At risk", tone: "risk" },
  on_track: { word: null, tone: null },
  paused: { word: "Paused", tone: null },
  unset: { word: null, tone: null },
  wrapped: { word: "Wrapped", tone: null },
};

function projectHref(id: string, surface: "project" | "tasks" | "timeline"): string {
  const projectId = parseProjectId(id);
  if (projectId) return buildProjectUrl({ surface }, projectId);
  return surface === "project" ? "/app/project" : `/app/${surface}`;
}

function contextual(path: string, id: string): string {
  const projectId = parseProjectId(id);
  return projectId ? withActiveProject(path, projectId) : path;
}

export function homeTaskHref(projectId: string, taskId: string): string {
  return contextual(`/app/tasks?task=${encodeURIComponent(taskId)}`, projectId);
}

// ── The board ──────────────────────────────────────────────────────────────

export function buildHomeBoard(input: HomeBoardInput): HomeBoard {
  const dayOf = dayOrdinalIn(input.timeZone);
  const todayOrdinal = dayOf(input.now);
  const today = ordinalToIsoDate(todayOrdinal);
  const projectById = new Map(input.projects.map((project) => [project.id, project]));
  const model = buildConsole(input.projects, today);
  const active = model.rows.filter((row) => row.standing !== "wrapped");
  const activeIds = new Set(active.map((row) => row.id));

  type Seen = {
    task: HomeTaskFact;
    project: HomeProjectFact;
    column: HomeColumn | null;
    done: boolean;
    dueDays: number | null;
    quietDays: number;
    mine: boolean;
    unassigned: boolean;
    others: string[];
  };
  const seen: Seen[] = [];
  for (const task of input.tasks) {
    const project = projectById.get(task.projectId);
    // A wrapped Project asks nothing of anyone.
    if (!project || !activeIds.has(project.id)) continue;
    const column = project.columns.find((candidate) => candidate.key === task.columnKey) ?? null;
    const current = task.assignees.filter((id) => id === input.viewerId || project.members[id] !== undefined);
    const unassigned = current.length === 0;
    seen.push({
      task,
      project,
      column,
      done: column?.isDone ?? false,
      dueDays: task.dueAt === null ? null : dayOf(task.dueAt) - todayOrdinal,
      quietDays: Math.max(0, todayOrdinal - dayOf(task.updatedAt)),
      mine: current.includes(input.viewerId) || (unassigned && project.role !== "member"),
      unassigned,
      others: current.filter((id) => id !== input.viewerId).map((id) => project.members[id]!).filter(Boolean),
    });
  }

  const row = (entry: Seen, note: string | null = null, due?: string): HomeRow => ({
    id: entry.task.id,
    title: entry.task.title,
    href: homeTaskHref(entry.project.id, entry.task.id),
    projectId: entry.project.id,
    projectName: entry.project.name,
    column: entry.column,
    done: entry.done,
    late: !entry.done && entry.dueDays !== null && entry.dueDays < 0,
    due: due ?? (entry.done ? "Done" : dueWords(entry.dueDays)),
    note,
    recurring: entry.task.recurring,
  });
  const byDue = (a: Seen, b: Seen) =>
    (a.task.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.task.dueAt ?? Number.MAX_SAFE_INTEGER) || a.task.id.localeCompare(b.task.id);
  const isWaiting = (entry: Seen) => !entry.done && entry.task.columnKey === WAITING_COLUMN_KEY && entry.column !== null;
  const ownNote = (entry: Seen): string | null =>
    isWaiting(entry) ? `in ${entry.column!.name}` : entry.unassigned ? "no one assigned" : null;

  // Finished today stays in its list, so a tick can be taken back.
  const doneToday = (entry: Seen) =>
    entry.done && entry.task.completedAt !== null && dayOf(entry.task.completedAt) === todayOrdinal;
  const mine = seen.filter((entry) => entry.mine);
  const shown = mine.filter((entry) => !entry.done || doneToday(entry)).sort(byDue);
  const late = shown.filter((entry) => entry.dueDays !== null && entry.dueDays < 0);
  const dueToday = shown.filter((entry) => entry.dueDays === 0);
  const open = mine.filter((entry) => !entry.done).sort(byDue);
  const soonAll = shown.filter((entry) => entry.dueDays !== null && entry.dueDays > 0 && entry.dueDays <= SOON_DAYS && !isWaiting(entry));
  // Each task appears once: a late one stays under Late, and says it waits.
  const waiting = open.filter((entry) => isWaiting(entry) && (entry.dueDays === null || entry.dueDays > 0));

  const undated = open.filter((entry) => entry.dueDays === null && !isWaiting(entry));
  const undatedProjects = new Set(undated.map((entry) => entry.project.id));

  // To check: work sitting in the board's own check column that someone
  // other than the reader put there, or that nobody current holds.
  const checkAll = seen
    .filter((entry) => !entry.done && entry.task.columnKey === "review" && (entry.others.length > 0 || entry.unassigned))
    .sort((a, b) => a.task.updatedAt - b.task.updatedAt || a.task.id.localeCompare(b.task.id));

  const openLate = late.filter((entry) => !entry.done).length;
  const openToday = dueToday.filter((entry) => !entry.done).length;

  // Stuck: quiet in Waiting for three days or more, whoever holds it.
  const stuckAll = seen
    .filter((entry) => isWaiting(entry) && entry.quietDays >= STUCK_DAYS)
    .sort((a, b) => b.quietDays - a.quietDays || a.task.id.localeCompare(b.task.id));
  const worst = stuckAll[0];
  const stuck: HomeStuck | null = worst
    ? {
        taskId: worst.task.id,
        title: worst.task.title,
        href: homeTaskHref(worst.project.id, worst.task.id),
        rest: ` has been in ${worst.column!.name} with no change for ${formatDayCount(worst.quietDays)}.`,
        nudge: input.canAct ? (worst.others[0] ?? null) : null,
        more: stuckAll.length - 1,
        moreHref: projectHref(worst.project.id, "tasks"),
      }
    : null;

  // Next big day: the Projects page's own nearest date still ahead.
  const next = model.cards.nextDate;
  const nextRow = next ? model.rows.find((candidate) => candidate.id === next.projectId) : undefined;
  const nextDay: HomeNextDay | null =
    next && nextRow && nextRow.nextDate
      ? {
          projectId: next.projectId,
          title: next.title === "Target date" ? next.projectName : next.title,
          projectName: next.title === "Target date" ? null : next.projectName,
          projectHref: projectHref(next.projectId, "project"),
          days: next.days,
          dayLabel: formatLongDay(nextRow.nextDate),
          mark: nextRow.mark,
          markLabel: nextRow.markLabel,
          open: nextRow.open,
          late: nextRow.late,
          timelineHref: projectHref(next.projectId, "timeline"),
          tasksHref: projectHref(next.projectId, "tasks"),
        }
      : null;

  // Projects: trouble first, then by date, as the Projects page orders them.
  const projects: HomeProjectRow[] = active.slice(0, PROJECT_CAP).map((entry) => ({
    id: entry.id,
    name: entry.name,
    href: projectHref(entry.id, "project"),
    mark: entry.mark,
    markLabel: entry.markLabel,
    word: MARK_WORD[entry.mark].word,
    tone: MARK_WORD[entry.mark].tone,
    late: entry.late,
    date: entry.nextDate ? formatConsoleDate(entry.nextDate, today) : null,
  }));

  const activeInputs = active.map((entry) => projectById.get(entry.id)!);
  const lateEverywhere = activeInputs.every((project) => project.stats !== null)
    ? active.reduce((sum, entry) => sum + entry.late, 0)
    : null;
  const doneThisWeek = model.cards.week?.total ?? null;

  const teamToday = seen.filter((entry) => !entry.done && entry.dueDays === 0).length;
  const footnote =
    active.length === 0 || teamToday === 0
      ? null
      : `${teamToday} ${teamToday === 1 ? "task is" : "tasks are"} due today across ${active.length === 1 ? "the project" : "your projects"}.${
          lateEverywhere ? ` ${lateEverywhere} late in all.` : ""
        }`;

  const lateProjects = active.filter((entry) => entry.late > 0);
  const only = active.length === 1 ? active[0]! : null;
  // New work starts in the Project that needs it most, else the first one.
  const home = nextDay?.projectId ?? active[0]?.id ?? null;

  return {
    today,
    dateLabel: formatLongDay(today),
    firstName: firstNameOf(input.viewerName),
    serverGreeting: greetingForHour(hourIn(input.timeZone, input.now)),
    canAct: input.canAct,
    needsYou: openLate + openToday + checkAll.length,
    lateEverywhere,
    lateHref: lateProjects.length === 1 ? projectHref(lateProjects[0]!.id, "tasks") : "/app/project",
    lateWhere: only ? `in ${only.name}` : "across your projects",
    doneThisWeek,
    stuck,
    late: late.map((entry) => row(entry, ownNote(entry))),
    dueToday: dueToday.map((entry) => row(entry, ownNote(entry))),
    soon: soonAll.slice(0, SOON_CAP).map((entry) => row(entry, entry.unassigned ? "no one assigned" : null)),
    soonMore: Math.max(0, soonAll.length - SOON_CAP),
    toCheck: checkAll.slice(0, CHECK_CAP).map((entry) =>
      row(entry, [entry.others[0] ? `from ${firstNameOf(entry.others[0]) ?? entry.others[0]}` : null, quietFor(entry.quietDays)].filter(Boolean).join(", ") || null, "To check"),
    ),
    toCheckMore: Math.max(0, checkAll.length - CHECK_CAP),
    waiting: waiting.map((entry) => row(entry, quietFor(entry.quietDays))),
    undated: undated.length,
    undatedHref: undatedProjects.size === 1 ? projectHref([...undatedProjects][0]!, "tasks") : "/app/tasks",
    nextDay,
    projects,
    projectCount: active.length,
    projectsHref: "/app/project",
    footnote,
    newTaskHref: home ? contextual("/app/tasks?create=task", home) : "/app/tasks?create=task",
    truncated: input.truncated,
  };
}
