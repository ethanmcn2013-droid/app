import { covers, dayLoad, endOf, isSpan, taskOrder, type Task } from "./data";

export type Segment = {
  task: Task;
  /** 0-6 */
  from: number;
  to: number;
  lane: number;
  clippedLeft: boolean;
  clippedRight: boolean;
};

export type DayLayout = {
  iso: string;
  milestones: Task[];
  singles: Task[];
  /** Span lanes that cover this day, for the hidden count. */
  spanCount: number;
  /** Span lanes drawn over this day; chips start below them. */
  lanesHere: number;
  open: number;
  done: number;
  people: number;
};

export type WeekLayout = {
  days: DayLayout[];
  segments: Segment[];
  lanes: number;
};

export const MAX_LANES = 2;

export function layoutWeek(week: string[], tasks: Task[], pinId?: string | null): WeekLayout {
  const first = week[0];
  const last = week[6];
  const spans = tasks
    .filter((t) => isSpan(t) && (t.start as string) <= last && (endOf(t) as string) >= first)
    .sort((a, b) => (a.start as string).localeCompare(b.start as string) || (endOf(b) as string).localeCompare(endOf(a) as string));
  const laneEnds: number[] = [];
  const segments: Segment[] = [];
  for (const task of spans) {
    const from = Math.max(0, week.indexOf((task.start as string) < first ? first : (task.start as string)));
    const endIso = endOf(task) as string;
    const to = endIso > last ? 6 : week.indexOf(endIso);
    let lane = laneEnds.findIndex((e) => e < from);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(to);
    } else laneEnds[lane] = to;
    segments.push({ task, from, to, lane, clippedLeft: (task.start as string) < first, clippedRight: endIso > last });
  }
  const lanes = Math.min(MAX_LANES, laneEnds.length);
  const days = week.map((iso, col) => {
    const here = tasks.filter((t) => covers(t, iso));
    const milestones = here.filter((t) => t.milestone && !isSpan(t));
    const singles = here.filter((t) => !t.milestone && !isSpan(t)).sort((a, b) => pinFirst(a, b, pinId));
    const spanCount = segments.filter((s) => s.lane >= MAX_LANES && covers(s.task, iso)).length;
    const lanesHere = segments.reduce((m, s) => (s.lane < lanes && s.from <= col && s.to >= col ? Math.max(m, s.lane + 1) : m), 0);
    return { iso, milestones, singles, spanCount, lanesHere, ...dayLoad(here, iso) };
  });
  return { days, segments, lanes };
}

function pinFirst(a: Task, b: Task, pinId?: string | null) {
  if (a.id === GHOST_ID || a.id === pinId) return -1;
  if (b.id === GHOST_ID || b.id === pinId) return 1;
  return taskOrder(a, b);
}

export const GHOST_ID = "__ghost";
