/**
 * Overview's presentation model (5 October 2026): the week view. Every task
 * with a date sits on the day it is due, in a lane; big dates fly as flags;
 * finished work settles under its lane; work with no date waits in a row of
 * its own until someone gives it a day.
 *
 * Pure and client-safe. The server read (`src/server/home/overview-river-read.ts`)
 * hands over plain facts for Projects the reader may open. Nothing here is
 * forecast, and nothing is drawn that the data does not hold:
 *
 *   - a task has one date, the day it is due, so a task is one day wide. The
 *     product stores no start date to draw a longer bar from;
 *   - an Area is a task's first label. A Project with no labels has no Areas
 *     view, and its lanes are its board's own columns instead;
 *   - a big date is a task marked as one in Tasks; the flag the river runs to
 *     is the Project's own target date, when it has one;
 *   - "late" is unfinished and due before today in the reader's time zone.
 */

import { WAITING_COLUMN_KEY } from "@/lib/board-config";
import { buildConsole, dayOrdinalIn, formatDayCount, initialsOf, ordinalToIsoDate, type ConsoleMark } from "@/lib/projects/project-console";
import type { ProjectStatus } from "@/lib/projects/project-hub";
import { parseProjectId, type ProjectRole } from "@/lib/projects/project-ref";
import { buildProjectUrl } from "@/lib/projects/project-url";
import { homeTaskHref, type HomeColumn } from "@/lib/home/home-board";
import {
  RIVER_NO_LANE,
  areaName,
  hash,
  hueAt,
  riverDayOf,
  riverMonday,
  riverPlural,
  riverWithDay,
  type River,
  type RiverItem,
  type RiverLane,
  type RiverLens,
  type RiverLensId,
} from "@/lib/home/overview-river-kit";

export * from "@/lib/home/overview-river-kit";

// ── What the server hands over ─────────────────────────────────────────────

export type RiverTaskFact = Readonly<{
  id: string;
  projectId: string;
  title: string;
  columnKey: string;
  /** Epoch milliseconds, or null. */
  dueAt: number | null;
  completedAt: number | null;
  assignees: readonly string[];
  labels: readonly string[];
  bigDate: boolean;
  recurring: boolean;
}>;

export type RiverProjectFact = Readonly<{
  id: string;
  name: string;
  role: ProjectRole;
  status: ProjectStatus;
  /** Plain `YYYY-MM-DD`, or null. */
  targetDate: string | null;
  columns: readonly HomeColumn[];
  /** Current members, by user id. Nobody else is named. */
  members: Readonly<Record<string, string>>;
}>;

export type RiverInput = Readonly<{
  now: number;
  timeZone: string;
  viewerId: string;
  projects: readonly RiverProjectFact[];
  tasks: readonly RiverTaskFact[];
  truncated: boolean;
  /** False where nothing can be saved (review mode). */
  canAct: boolean;
}>;

/** How far back and ahead the river is drawn, whatever the dates say. */
const BACK_LIMIT = -182;
const AHEAD_LIMIT = 365;

// ── The river ──────────────────────────────────────────────────────────────

export function buildRiver(input: RiverInput): River {
  const dayOf = dayOrdinalIn(input.timeZone);
  const todayOrdinal = dayOf(input.now);
  const today = ordinalToIsoDate(todayOrdinal);
  const projects = new Map(input.projects.map((project) => [project.id, project]));
  const single = input.projects.length === 1;
  const only = single ? input.projects[0]! : null;

  const items: RiverItem[] = [];
  for (const task of input.tasks) {
    const project = projects.get(task.projectId);
    if (!project) continue;
    const column = project.columns.find((candidate) => candidate.key === task.columnKey) ?? null;
    const done = column?.isDone ?? false;
    const day = task.dueAt === null ? null : dayOf(task.dueAt) - todayOrdinal;
    const ownerId = task.assignees.find((id) => project.members[id] !== undefined) ?? null;
    const ownerName = ownerId ? project.members[ownerId]! : null;
    const area = task.labels[0] ?? null;
    items.push({
      id: task.id,
      projectId: project.id,
      title: task.title,
      href: homeTaskHref(project.id, task.id),
      kind: task.bigDate ? "big" : "task",
      day,
      doneDay: done && task.completedAt !== null ? Math.min(0, dayOf(task.completedAt) - todayOrdinal) : null,
      done,
      late: !done && day !== null && day < 0,
      statusName: column?.name ?? "No status",
      waiting: !done && task.columnKey === WAITING_COLUMN_KEY && column !== null,
      owner: ownerId && ownerName ? { id: ownerId, name: ownerName, initials: initialsOf(ownerName), hue: hueAt(hash(ownerId)) } : null,
      lanes: {
        areas: area ?? RIVER_NO_LANE,
        people: ownerId ?? RIVER_NO_LANE,
        status: task.columnKey,
        projects: project.id,
      },
      recurring: task.recurring,
    });
  }

  const open = items.filter((item) => !item.done);
  const late = open.filter((item) => item.late);

  const lane = (_lensId: RiverLensId, id: string, name: string, hue: string, initials?: string): RiverLane => ({
    id,
    name,
    hue,
    ...(initials ? { initials } : {}),
  });
  const used = (lensId: RiverLensId) => new Set(items.map((item) => item.lanes[lensId]));
  // "No area yet" and "No one yet" are lanes for work still to do; finished
  // work with no label or holder does not open one.
  const needsNoLane = (lensId: RiverLensId) => items.some((item) => !item.done && item.lanes[lensId] === RIVER_NO_LANE);

  const lenses: RiverLens[] = [];
  if (!single) {
    lenses.push({ id: "projects", label: "Projects", lanes: input.projects.map((project, index) => lane("projects", project.id, project.name, hueAt(index))) });
  } else {
    const project = only!;
    const labels = [...new Set(items.flatMap((item) => (item.lanes.areas === RIVER_NO_LANE ? [] : [item.lanes.areas])))].sort((a, b) =>
      areaName(a).localeCompare(areaName(b), "en"),
    );
    if (labels.length > 0) {
      const lanes = labels.map((label, index) => lane("areas", label, areaName(label), hueAt(index)));
      if (needsNoLane("areas")) lanes.push(lane("areas", RIVER_NO_LANE, "No area yet", "var(--v3-text-3)"));
      lenses.push({ id: "areas", label: "Areas", lanes });
    }
    // A column nothing sits in takes no lane.
    const statusLanes = project.columns
      .filter((column) => !column.isDone && used("status").has(column.key))
      .map((column, index) => lane("status", column.key, column.name, hueAt(index)));
    const status: RiverLens = { id: "status", label: "Status", lanes: statusLanes };
    const people = Object.entries(project.members)
      .filter(([id]) => used("people").has(id))
      .sort((a, b) => a[1].localeCompare(b[1], "en"))
      .map(([id, name]) => lane("people", id, name, hueAt(hash(id)), initialsOf(name)));
    if (needsNoLane("people")) people.push(lane("people", RIVER_NO_LANE, "No one yet", "var(--v3-text-3)"));
    // Without labels there are no Areas; the board's own columns lead instead.
    if (labels.length === 0) lenses.push(status);
    if (people.length > 0) lenses.push({ id: "people", label: "People", lanes: people });
    if (labels.length > 0) lenses.push(status);
  }

  // The Project's own standing and date, in the Projects page's words.
  let mark: ConsoleMark | null = null;
  let markLabel: string | null = null;
  let destination: River["destination"] = null;
  let lead: string;
  if (only) {
    const total = items.length;
    const row = buildConsole(
      [
        {
          id: only.id,
          name: only.name,
          role: only.role,
          selectable: true,
          blockedReason: null,
          openCount: open.length,
          stats: { status: only.status, targetDate: only.targetDate, purpose: null, total, complete: total - open.length, overdue: late.length },
          facts: null,
        },
      ],
      today,
    ).rows[0]!;
    mark = row.mark;
    markLabel = row.markLabel;
    const target = only.targetDate && /^\d{4}-\d{2}-\d{2}/.test(only.targetDate) ? riverDayOf(today, only.targetDate) : null;
    if (target === null) lead = "No target date set.";
    else {
      const when = riverWithDay(today, target);
      destination = { day: target, title: only.name, meta: target > 0 ? `${when}, in ${formatDayCount(target)}` : target === 0 ? `${when}, today` : when };
      lead = target > 0 ? `${formatDayCount(target)} to the target date, ${when}.` : target === 0 ? "The target date is today." : `The target date was ${when}.`;
    }
  } else {
    lead = `${riverPlural(input.projects.length, "project")}.`;
  }

  // The canvas: from a week before the earliest work in reach to two weeks
  // past the last date, and never less than five weeks either side of today.
  const days = items.flatMap((item) => [item.done ? null : item.day, item.doneDay]).filter((day): day is number => day !== null);
  const first = Math.max(BACK_LIMIT, Math.min(-28, ...days));
  const last = Math.min(AHEAD_LIMIT, Math.max(35, destination?.day ?? 0, ...days));
  const r0 = riverMonday(today, first) - 7;
  const r1 = riverMonday(today, last) + 20;

  const projectId = only ? parseProjectId(only.id) : null;
  return {
    today,
    single,
    projectId: only?.id ?? null,
    name: only?.name ?? "All projects",
    hue: only ? hueAt(hash(only.id)) : "var(--v3-text-2)",
    mark,
    markLabel,
    lead,
    destination,
    items,
    lenses,
    r0,
    r1,
    tasksHref: projectId ? buildProjectUrl({ surface: "tasks" }, projectId) : "/app/tasks",
    timelineHref: projectId ? buildProjectUrl({ surface: "timeline" }, projectId) : "/app/timeline",
    canAct: input.canAct,
    truncated: input.truncated,
  };
}
