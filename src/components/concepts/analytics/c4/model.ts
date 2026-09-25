/**
 * Analytics concept 4, "Project replay": the pure calculation.
 *
 * Given a Project's task histories, answer for any day: where was every task,
 * how much was open, done and late, what happened that week, and what changed
 * between two days. Moments ("chapters") are detected from the same records,
 * so every sentence quotes numbers the board can show.
 */
import {
  RAW_PROJECTS,
  type Moment,
  type PersonDef,
  type ReplayProject,
  type Status,
  type Task,
} from "./data";

export type { Moment, ReplayProject, Status, Task };

export const COLUMNS: { key: Status; name: string }[] = [
  { key: "todo", name: "To do" },
  { key: "doing", name: "Doing" },
  { key: "waiting", name: "Waiting" },
  { key: "done", name: "Done" },
];

/* ── dates ─────────────────────────────────────────────────────────── */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateOf(p: ReplayProject, day: number) {
  const [y, m, d] = p.start.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + day));
}

export function fmtDay(p: ReplayProject, day: number) {
  const dt = dateOf(p, day);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

export function fmtLong(p: ReplayProject, day: number) {
  const dt = dateOf(p, day);
  return `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

export function weekdayOf(p: ReplayProject, day: number) {
  return dateOf(p, day).getUTCDay();
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/* ── one task on one day ───────────────────────────────────────────── */

export function statusAt(t: Task, d: number): Status | null {
  if (t.created > d) return null;
  if (t.done !== null && t.done <= d) return "done";
  if (t.waits.some((w) => w.from <= d && d < w.to)) return "waiting";
  if (t.started !== null && t.started <= d) return "doing";
  return "todo";
}

export function dueAt(t: Task, d: number) {
  let due = t.due;
  for (const m of t.moves) if (m.day <= d) due = m.to;
  return due;
}

export const movesBy = (t: Task, d: number) =>
  t.moves.filter((m) => m.day <= d).length;

/** The day it entered the column it is in on day d (for stacking order). */
function sinceAt(t: Task, s: Status, d: number) {
  if (s === "done") return t.done ?? d;
  if (s === "waiting")
    return t.waits.find((w) => w.from <= d && d < w.to)?.from ?? d;
  if (s === "doing") {
    const lastWait = t.waits.filter((w) => w.to <= d).at(-1);
    return lastWait ? lastWait.to : (t.started ?? d);
  }
  return t.created;
}

export type Placed = {
  task: Task;
  status: Status;
  since: number;
  late: boolean;
  slips: number;
};
export type Snapshot = {
  day: number;
  cols: Record<Status, Placed[]>;
  open: number;
  done: number;
  late: number;
  total: number;
};

export function snapshot(p: ReplayProject, d: number): Snapshot {
  const cols: Record<Status, Placed[]> = {
    todo: [],
    doing: [],
    waiting: [],
    done: [],
  };
  let late = 0;
  for (const t of p.tasks) {
    const s = statusAt(t, d);
    if (!s) continue;
    const isLate = s !== "done" && dueAt(t, d) < d;
    if (isLate) late++;
    cols[s].push({
      task: t,
      status: s,
      since: sinceAt(t, s, d),
      late: isLate,
      slips: movesBy(t, d),
    });
  }
  const order = new Map(p.groups.map((g, i) => [g.id, i]));
  for (const k of Object.keys(cols) as Status[]) {
    cols[k].sort(
      (a, b) =>
        a.since - b.since ||
        (order.get(a.task.group) ?? 0) - (order.get(b.task.group) ?? 0) ||
        a.task.id.localeCompare(b.task.id),
    );
  }
  const done = cols.done.length;
  const open = cols.todo.length + cols.doing.length + cols.waiting.length;
  return { day: d, cols, open, done, late, total: open + done };
}

/* ── series across the whole history ───────────────────────────────── */

export type Series = {
  open: number[];
  done: number[];
  late: number[];
  waiting: number[];
  peakOpen: number;
  peakDay: number;
  /** The most marks each column ever holds (squares, or blocks of five), so the stage can size squares to fit the whole replay. */
  most: Record<Status, number>;
};

function marks(p: ReplayProject, items: Placed[]) {
  if (p.block === 1) return items.length;
  const count = (key: (t: Task) => string) => {
    const m = new Map<string, number>();
    for (const it of items) m.set(key(it.task), (m.get(key(it.task)) ?? 0) + 1);
    let n = 0;
    for (const v of m.values()) n += Math.ceil(v / 5);
    return n;
  };
  return Math.max(
    count((t) => t.group),
    count((t) => t.person),
  );
}

export function series(p: ReplayProject): Series {
  const open: number[] = [];
  const done: number[] = [];
  const late: number[] = [];
  const waiting: number[] = [];
  let peakOpen = 0;
  let peakDay = 0;
  const most: Record<Status, number> = {
    todo: 0,
    doing: 0,
    waiting: 0,
    done: 0,
  };
  for (let d = 0; d <= p.last; d++) {
    const s = snapshot(p, d);
    for (const k of Object.keys(most) as Status[])
      most[k] = Math.max(most[k], marks(p, s.cols[k]));
    open.push(s.open);
    done.push(s.done);
    late.push(s.late);
    waiting.push(s.cols.waiting.length);
    if (s.open > peakOpen) {
      peakOpen = s.open;
      peakDay = d;
    }
  }
  return { open, done, late, waiting, peakOpen, peakDay, most };
}

/* ── counting helpers ──────────────────────────────────────────────── */

const inRange = (x: number | null, a: number, b: number) =>
  x !== null && x > a && x <= b;
export const finishedBetween = (p: ReplayProject, a: number, b: number) =>
  p.tasks.filter((t) => inRange(t.done, a, b));
export const addedBetween = (p: ReplayProject, a: number, b: number) =>
  p.tasks.filter((t) => t.created > a && t.created <= b);

function topBy<T>(items: T[], key: (x: T) => string) {
  const counts = new Map<string, number>();
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1);
  let best = "";
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return { key: best, count: n };
}

export const personName = (p: ReplayProject, id: string) =>
  p.people.find((x) => x.id === id)?.name ?? "Someone";
export const groupName = (p: ReplayProject, id: string) =>
  p.groups.find((x) => x.id === id)?.name ?? "Other";

/** The seven-day window with the most finished, aligned to the Project's weeks. */
export function biggestWeek(p: ReplayProject) {
  let best = { start: 0, count: -1 };
  for (let s = 0; s <= p.last; s += 7) {
    const c = finishedBetween(
      p,
      s === 0 && p.tracked ? 0 : s - 1,
      Math.min(p.last, s + 6),
    ).length;
    if (c > best.count) best = { start: s, count: c };
  }
  return best;
}

/* ── moments: detected from the records ────────────────────────────── */

function weddingMoments(p: ReplayProject, sr: Series): Moment[] {
  const first = addedBetween(p, -1, 0);
  const firstTop = topBy(first, (t) => t.person);
  const niamh = p.people.find((x) => x.id === "niamh") as PersonDef;
  let peakWaitDay = 10;
  for (let d = 10; d <= 55; d++)
    if (sr.waiting[d] > sr.waiting[peakWaitDay]) peakWaitDay = d;
  const waitingThen = snapshot(p, peakWaitDay).cols.waiting;
  const waitOn = [
    ...new Set(
      waitingThen.map(
        (x) =>
          x.task.waits.find((w) => w.from <= peakWaitDay && peakWaitDay < w.to)
            ?.on ?? "",
      ),
    ),
  ].filter(Boolean);
  const waitList =
    waitOn.length > 3
      ? `${waitOn.slice(0, 3).join(", ")} and others`
      : waitOn.length > 1
        ? `${waitOn.slice(0, -1).join(", ")} and ${waitOn.at(-1)}`
        : (waitOn[0] ?? "suppliers");
  const waitTop = topBy(
    waitingThen,
    (x) =>
      x.task.waits.find((w) => w.from <= peakWaitDay && peakWaitDay < w.to)
        ?.on ?? "",
  );
  const menu = addedBetween(p, 41, 43).filter((t) => t.group === "food");
  const menuCian = menu.filter((t) => t.person === "cian").length;
  const s56 = snapshot(p, 56);
  const cianDoing = s56.cols.doing.filter(
    (x) => x.task.person === "cian",
  ).length;
  const cianOpen = [
    ...s56.cols.todo,
    ...s56.cols.doing,
    ...s56.cols.waiting,
  ].filter((x) => x.task.person === "cian").length;
  const big = biggestWeek(p);
  const bigTop = topBy(
    finishedBetween(p, big.start - 1, big.start + 6),
    (t) => t.person,
  );
  const tent = p.tasks.find((t) => t.id === "tent") as Task;
  const tentDue = dueAt(tent, 70);
  const moments: Moment[] = [
    {
      id: "start",
      day: 0,
      label: `The plan went in: ${first.length} tasks`,
      sentence: `${fmtDay(p, 0)}. The wedding plan went in: ${first.length} tasks on day one, most of them for ${personName(p, firstTop.key)}.`,
    },
    {
      id: "niamh",
      day: niamh.joined,
      label: "Niamh joined",
      sentence: `${fmtDay(p, niamh.joined)}. Niamh joined and took on the music and most of the guest list.`,
    },
    {
      id: "waiting",
      day: peakWaitDay,
      label: `${sr.waiting[peakWaitDay]} tasks waiting on others`,
      sentence: `${fmtDay(p, peakWaitDay)}. ${sr.waiting[peakWaitDay]} tasks waiting on people outside the team, the most so far${waitTop.count >= 3 ? `. ${cap(waitTop.key)} held up ${waitTop.count} of them.` : `: ${waitList}.`}`,
    },
    {
      id: "menu",
      day: 42,
      label: `Menu change added ${menu.length} tasks`,
      sentence: `${fmtDay(p, 42)}. Menu change: ${menu.length} new tasks in two days, ${menuCian} of them for Cian.`,
    },
    {
      id: "away",
      day: 56,
      label: "Cian away",
      sentence: `${fmtDay(p, 56)}. Cian away until 28 Aug. His ${plural(cianOpen, "open task")} sat still${cianDoing ? `, ${cianDoing} of them half done` : ""}.`,
    },
    {
      id: "big",
      day: big.start,
      label: `Biggest week: ${big.count} done`,
      sentence: `Week of ${fmtDay(p, big.start)}. Biggest week: ${big.count} done, ${bigTop.count} by ${personName(p, bigTop.key)}.`,
    },
    {
      id: "tent",
      day: 70,
      label: "Tent hire slipped again",
      sentence: `${fmtDay(p, 70)}. Tent hire slipped for the second time. It is now due ${fmtDay(p, tentDue)}, eight weeks after the first date.`,
      taskId: "tent",
    },
  ];
  return moments.sort((a, b) => a.day - b.day);
}

function riversideMoments(p: ReplayProject): Moment[] {
  const first = addedBetween(p, -1, 0).length;
  const doneByFour = finishedBetween(p, -1, 27).length;
  const push = p.tasks.filter(
    (t) => t.started !== null && t.started >= 28 && t.started <= 34,
  ).length;
  const beforeCheck = finishedBetween(p, 30, 52).length;
  const feedback = addedBetween(p, 52, 60).length;
  const big = biggestWeek(p);
  const slow = p.tasks.find((t) => t.title === "Find three past surveys");
  return [
    {
      id: "start",
      day: 0,
      label: `Started with ${first} tasks`,
      sentence: `${fmtDay(p, 0)}. The group started with ${first} tasks, four people and ten weeks.`,
    },
    ...(slow
      ? [
          {
            id: "slip",
            day: 22,
            label: "Past surveys slipped twice",
            sentence: `${fmtDay(p, 22)}. Finding three past surveys slipped for the second time.`,
            taskId: slow.id,
          },
        ]
      : []),
    {
      id: "slow",
      day: 28,
      label: `A slow start: ${doneByFour} done`,
      sentence: `${fmtDay(p, 28)}. Four weeks in and ${doneByFour} tasks were done. Most of the list had not been touched.`,
    },
    {
      id: "push",
      day: 31,
      label: "The push began",
      sentence: `${fmtDay(p, 31)}. The push began: ${push} tasks started in a week, ahead of the tutor check-in.`,
    },
    {
      id: "big",
      day: big.start,
      label: `Biggest week: ${big.count} done`,
      sentence: `Week of ${fmtDay(p, big.start)}. Biggest week: ${big.count} done, including both survey days.`,
    },
    {
      id: "check",
      day: 53,
      label: `Tutor added ${feedback} tasks`,
      sentence: `${fmtDay(p, 53)}. After the check-in: ${beforeCheck} done in the three weeks before it, and the tutor's notes added ${feedback} more.`,
    },
    {
      id: "end",
      day: p.last,
      label: "Handed in early",
      sentence: `${fmtDay(p, p.last)}. Handed in, 3 days before it was due.`,
    },
  ].sort((a, b) => a.day - b.day);
}

function brightwaterMoments(p: ReplayProject, sr: Series): Moment[] {
  const s0 = snapshot(p, 0);
  const menu = addedBetween(p, 48, 52).filter((t) => t.group === "menu").length;
  const big = biggestWeek(p);
  let peakWait = 0;
  for (let d = 0; d <= p.last; d++)
    if (sr.waiting[d] > sr.waiting[peakWait]) peakWait = d;
  const waitTop = topBy(
    snapshot(p, peakWait).cols.waiting,
    (x) =>
      x.task.waits.find((w) => w.from <= peakWait && peakWait < w.to)?.on ?? "",
  );
  const webAll = p.tasks.filter((t) => t.group === "web");
  const webDone = webAll.filter((t) => t.done !== null && t.done <= 77).length;
  return [
    {
      id: "start",
      day: 0,
      label: "History starts here",
      sentence: `${fmtDay(p, 0)}. History starts here. The Project began on 4 May, so ${s0.total} tasks were already on the board and ${s0.done} were done.`,
    },
    {
      id: "wait",
      day: peakWait,
      label: `${sr.waiting[peakWait]} waiting at once`,
      sentence: `${fmtDay(p, peakWait)}. ${sr.waiting[peakWait]} tasks waiting at once. ${cap(waitTop.key)} held up ${waitTop.count}.`,
    },
    {
      id: "menu",
      day: 49,
      label: `Menu redesign: ${menu} tasks`,
      sentence: `${fmtDay(p, 49)}. The client added a menu redesign: ${menu} tasks in four days, and two people joined for it.`,
    },
    {
      id: "peak",
      day: sr.peakDay,
      label: `Open work peaked at ${sr.peakOpen}`,
      sentence: `${fmtDay(p, sr.peakDay)}. Open work peaked at ${sr.peakOpen} tasks.`,
    },
    {
      id: "web",
      day: 77,
      label: "Website live",
      sentence: `${fmtDay(p, 77)}. Website live, with ${webDone} of its ${webAll.length} tasks done. The rest are fixes for after launch.`,
    },
    {
      id: "big",
      day: big.start,
      label: `Biggest week: ${big.count} done`,
      sentence: `Week of ${fmtDay(p, big.start)}. Biggest week: ${big.count} done.`,
    },
  ]
    .sort((a, b) => a.day - b.day)
    .filter((m, i, all) => i === 0 || m.day !== all[i - 1].day);
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export type Replay = ReplayProject & { series: Series };

export const PROJECTS: Replay[] = RAW_PROJECTS.map((raw) => {
  const sr = series(raw);
  const moments =
    raw.id === "wedding"
      ? weddingMoments(raw, sr)
      : raw.id === "riverside"
        ? riversideMoments(raw)
        : raw.id === "brightwater"
          ? brightwaterMoments(raw, sr)
          : [];
  return { ...raw, moments, series: sr };
});

/* ── captions ──────────────────────────────────────────────────────── */

/** The moment whose caption holds on day d, if any (it holds for 4 days, a week for weekly moments). */
export function momentAt(p: ReplayProject, d: number): Moment | null {
  let found: Moment | null = null;
  for (const m of p.moments) {
    const span = m.sentence.startsWith("Week of") ? 7 : 4;
    if (m.day <= d && d < m.day + span) found = m;
  }
  return found;
}

export function weekCaption(p: ReplayProject, d: number) {
  const from = Math.max(-1, d - 7);
  const fin = finishedBetween(p, from, d);
  const add = addedBetween(p, Math.max(0, from), d);
  const top = topBy(fin, (t) => t.person);
  const days = d - Math.max(0, from);
  if (d === 0) {
    const s0 = snapshot(p, 0);
    const going = s0.cols.doing.length;
    return `${fmtDay(p, 0)}. Day one: ${plural(s0.total, "task")} on the board${going ? `, ${going} already started` : ""}.`;
  }
  if (!fin.length && !add.length)
    return `${fmtDay(p, d)}. A quiet stretch: nothing finished or added in ${plural(days, "day")}.`;
  const lead = `${fmtDay(p, d)}. In the last ${plural(days, "day")}: ${fin.length} finished, ${add.length} added.`;
  return top.count >= 2
    ? `${lead} ${personName(p, top.key)} finished the most.`
    : lead;
}

/* ── then and now ──────────────────────────────────────────────────── */

export type Diff = {
  a: number;
  b: number;
  finished: number;
  added: number;
  joined: string[];
  moved: number;
  then: Snapshot;
  now: Snapshot;
  groups: {
    id: string;
    name: string;
    tone: number;
    added: number;
    finished: number;
  }[];
};

export function diff(p: ReplayProject, x: number, y: number): Diff {
  const a = Math.min(x, y);
  const b = Math.max(x, y);
  const fin = finishedBetween(p, a, b);
  const add = addedBetween(p, a, b);
  return {
    a,
    b,
    finished: fin.length,
    added: add.length,
    joined: p.people
      .filter((m) => m.joined > a && m.joined <= b)
      .map((m) => m.name),
    moved: p.tasks.reduce(
      (n, t) => n + t.moves.filter((m) => m.day > a && m.day <= b).length,
      0,
    ),
    then: snapshot(p, a),
    now: snapshot(p, b),
    groups: p.groups.map((g) => ({
      ...g,
      added: add.filter((t) => t.group === g.id).length,
      finished: fin.filter((t) => t.group === g.id).length,
    })),
  };
}

/* ── one task's life ───────────────────────────────────────────────── */

export type Step = {
  day: number;
  kind: "created" | "started" | "waiting" | "back" | "done" | "moved";
  text: string;
  span?: number;
};

export function journey(p: ReplayProject, t: Task): Step[] {
  const steps: Step[] = [
    { day: t.created, kind: "created", text: `Added, due ${fmtDay(p, t.due)}` },
  ];
  if (t.started !== null)
    steps.push({
      day: t.started,
      kind: "started",
      text: `Started by ${personName(p, t.person)}`,
    });
  for (const w of t.waits) {
    const end = Math.min(w.to, p.last);
    const open = w.to > p.last;
    steps.push({
      day: w.from,
      kind: "waiting",
      span: end - w.from,
      text: open
        ? `Waiting on ${w.on}, ${plural(end - w.from, "day")} so far`
        : `Waiting ${plural(w.to - w.from, "day")} on ${w.on}`,
    });
  }
  t.moves.forEach((m, i) => {
    const prev = i === 0 ? t.due : t.moves[i - 1].to;
    steps.push({
      day: m.day,
      kind: "moved",
      text: `Date moved from ${fmtDay(p, prev)} to ${fmtDay(p, m.to)}`,
    });
  });
  if (t.done !== null)
    steps.push({ day: t.done, kind: "done", text: "Finished" });
  const rank: Record<Step["kind"], number> = {
    created: 0,
    started: 1,
    moved: 2,
    waiting: 3,
    back: 4,
    done: 5,
  };
  return steps.sort((a, b) => a.day - b.day || rank[a.kind] - rank[b.kind]);
}

export const slippers = (p: ReplayProject, d: number) =>
  p.tasks
    .filter((t) => t.created <= d && movesBy(t, d) >= 2)
    .sort((a, b) => movesBy(b, d) - movesBy(a, d));

/** Summary for a finished Project. */
export function finishSummary(p: Replay) {
  if (!p.finish) return null;
  const early = p.finish.due - p.finish.day;
  const weeks = Math.round((p.finish.day + 1) / 7);
  const big = biggestWeek(p);
  let longest: { t: Task; days: number } | null = null;
  for (const t of p.tasks)
    for (const w of t.waits)
      if (!longest || w.to - w.from > longest.days)
        longest = { t, days: w.to - w.from };
  return {
    headline: `Done ${plural(early, "day")} early. ${p.tasks.length} tasks, ${weeks} weeks.`,
    big,
    longest,
    moved: p.tasks.reduce((n, t) => n + t.moves.length, 0),
  };
}
