/* Plan my week: sample world. Fixed "now" so the concept never drifts.
 * Days are indexes into the week of Monday 28 September 2026 (0 = Mon).
 * Times are minutes from midnight. */

export type ProjectId = "orchard" | "wedding" | "heat" | "crumb";
export type Status = "todo" | "doing" | "done";

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
  /** Day index; negative means last week. Undefined: no date. */
  due?: number;
  status: Status;
  plan?: Plan;
  note?: string;
  with?: string;
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

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard, events", short: "The Orchard", color: "var(--v3-project-3)" },
  { id: "wedding", name: "Mara & Finn wedding", short: "Mara & Finn", color: "var(--v3-project-8)" },
  { id: "heat", name: "Urban heat islands", short: "Heat islands", color: "var(--v3-project-5)" },
  { id: "crumb", name: "Crumb & Co, with Fieldwork", short: "Crumb & Co", color: "var(--v3-project-2)" },
];

export const PROJECT = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<ProjectId, Project>;

export const WEEK_START = { y: 2026, m: 8, d: 28 }; // Monday 28 September 2026
export const TODAY = 3; // Thursday 1 October
export const NOW = 11 * 60 + 40; // 11:40

export const GRID_START = 8 * 60;
export const GRID_END = 19 * 60;
/** When task work can start, after stand-up. */
export const WORK_START = 9 * 60 + 15;
export const WORK_END = 17 * 60 + 30;

/** Hours Aoife sets aside for task work each day, already less meetings. */
export const CAPACITY = [420, 330, 330, 420, 360, 0, 0];
export const CAPACITY_NOTE = [
  "7h for tasks: a 7h 15m day less stand-up",
  "5h 30m for tasks: the site visit takes 1h 30m",
  "5h 30m for tasks: supplier lunch takes 1h 30m",
  "7h for tasks: a 7h 15m day less stand-up",
  "6h for tasks: a short Friday, finishing at 16:30",
  "A day off",
  "A day off",
];

export const ESTIMATES = [15, 30, 60, 120, 240];

const h = (hh: number, mm = 0) => hh * 60 + mm;

let seq = 0;
function t(
  title: string,
  project: ProjectId,
  estimate: number,
  due: number | undefined,
  extra: Partial<Omit<Task, "id" | "title" | "project" | "estimate" | "due">> = {},
): Task {
  seq += 1;
  return { id: `k${seq}`, title, project, estimate, due, status: "todo", ...extra };
}

const p = (day: number, start: number, dur: number): Plan => ({ day, start, dur });

export const INITIAL_TASKS: Task[] = [
  /* Monday */
  t("Confirm marquee sides with Hanleys", "wedding", 30, 1, { status: "done", plan: p(0, h(9, 30), 30), with: "Orla" }),
  t("Guest list tidy-up, Fennelly 40th", "orchard", 60, 2, { status: "done", plan: p(0, h(10, 0), 60) }),
  t("Seating plan v3 from Mara", "wedding", 60, 3, { status: "done", plan: p(0, h(11, 30), 60), with: "Mara" }),
  t("Invoice the Fennelly deposit", "orchard", 30, 0, { status: "done", plan: p(0, h(14, 0), 30) }),
  t("Draft the Saturday run-sheet", "orchard", 120, 4, { status: "done", plan: p(0, h(15, 0), 120) }),

  /* Tuesday */
  t("Linen supplier shortlist", "wedding", 60, 2, { status: "done", plan: p(1, h(9, 30), 60) }),
  t("Sign the ceilidh band contract", "wedding", 30, 1, { status: "done", plan: p(1, h(10, 45), 30) }),
  t("Questions for the site visit", "wedding", 30, 1, { status: "done", plan: p(1, h(12, 0), 30) }),
  t("Rehearsal dinner menu with Dev", "wedding", 60, 2, { status: "done", plan: p(1, h(16, 0), 60), with: "Dev" }),
  t("Photography shot list, first pass", "wedding", 60, 3, {
    plan: p(4, h(14, 0), 60),
    note: "Mara wants the orchard at golden hour and the dog in at least one group shot.",
    with: "Mara",
  }),

  /* Wednesday */
  t("Staff rota for October", "orchard", 120, 2, { status: "done", plan: p(2, h(9, 30), 120) }),
  t("Menu cards for the Fennelly 40th", "orchard", 60, 3, { status: "done", plan: p(2, h(14, 15), 60) }),
  t("Update the wedding budget", "wedding", 60, 2, {
    plan: p(2, h(15, 30), 60),
    note: "Marquee went up by €420 when they added clear sides.",
  }),

  /* Thursday, today */
  t("Reply to Mara about the top table", "wedding", 30, 3, { status: "done", plan: p(3, h(9, 15), 30) }),
  t("Seating plan sign-off", "wedding", 60, 3, { status: "done", plan: p(3, h(9, 45), 60) }),
  t("Fennelly final numbers and dietary list", "orchard", 90, 4, {
    status: "doing",
    plan: p(3, h(11, 0), 90),
    note: "Two coeliac, one vegan, and a nut allergy at table four.",
    with: "Dev",
  }),
  t("Compare the three florist quotes", "wedding", 60, 4, { plan: p(3, h(14, 0), 60) }),
  t("Risk assessment for the class visit", "heat", 60, 7, {
    plan: p(3, h(16, 0), 60),
    note: "Twenty-four students on the grounds on Monday morning, surveying tree cover.",
  }),

  /* Friday, overbooked */
  t("Saturday run-sheet, final version", "orchard", 120, 4, { plan: p(4, h(9, 15), 120), with: "Orla" }),
  t("Print table plans for the Fennelly 40th", "orchard", 30, 4, { plan: p(4, h(11, 30), 30) }),
  t("Menu card proofs from Fieldwork", "crumb", 60, 4, { plan: p(4, h(12, 0), 60), with: "Jess" }),
  t("Brief Dev on Saturday service", "orchard", 30, 4, { plan: p(4, h(13, 15), 30), with: "Dev" }),
  t("Linen count and order", "wedding", 60, 6, { plan: p(4, h(15, 0), 75) }),
  t("Bread order with Crumb & Co", "crumb", 60, 6, { plan: p(4, h(16, 15), 60) }),

  /* To plan: due this week */
  t("Confirm dietary needs with Mara & Finn", "wedding", 30, 4, { with: "Mara" }),
  t("Send the band the Fennelly timings", "orchard", 15, 4),
  t("Walk the grounds for the class visit", "heat", 60, 4, { note: "Check the routes are clear and mark the three survey points." }),
  t("Chase the marquee invoice", "wedding", 15, 4),
  t("Call Hanleys about marquee delivery", "wedding", 15, 4, { with: "Orla" }),
  t("Order place card stock", "wedding", 30, 5),
  t("Taste the Crumb & Co bread samples", "crumb", 30, 5, { with: "Dev" }),
  t("Fennelly thank-you email", "orchard", 30, 6),

  /* To plan: overdue */
  t("Return the Hanleys deposit form", "wedding", 15, 0),
  t("Send Mara the payment schedule", "wedding", 30, -2, { with: "Mara" }),

  /* To plan: no date */
  t("Quote for the Doyle christening", "orchard", 60, undefined),
  t("Winter menu ideas with Dev", "orchard", 240, undefined, { with: "Dev" }),
  t("Honeymoon taxi to the airport", "wedding", 15, undefined),
  t("Notes for the Fieldwork case study", "crumb", 60, undefined),
];

export const FIXED: Fixed[] = [
  ...[0, 1, 2, 3, 4].map((day) => ({ id: `su${day}`, title: "Team stand-up", day, start: h(9), dur: 15 })),
  { id: "sv", title: "Site visit with Mara & Finn", day: 1, start: h(14), dur: 90, where: "The Orchard lawn" },
  { id: "sl", title: "Supplier lunch", day: 2, start: h(12, 30), dur: 90, where: "Hartes, Kildare" },
  { id: "sr2", title: "School run", day: 1, start: h(15, 30), dur: 30, personal: true },
  { id: "sr4", title: "School run", day: 3, start: h(15, 15), dur: 30, personal: true },
  { id: "fn", title: "Fennelly 40th, on shift", day: 5, start: h(16), dur: 180, where: "The Orchard" },
  { id: "rn", title: "Park run", day: 6, start: h(9, 30), dur: 60, personal: true },
];

export const MILESTONES: Milestone[] = [
  { id: "m1", title: "Fennelly 40th", day: 5, project: "orchard" },
];

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
export function dayDate(day: number) {
  const x = dateOf(day);
  return `${dayShort(day)} ${x.date} ${x.month}`;
}

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
  if (due > 6) return `Due ${dayShort(due)} ${dateOf(due).date} ${dateOf(due).month}`;
  if (due >= 0) return `Was due ${dayShort(due)}`;
  const x = dateOf(due);
  return `Was due ${x.date} ${x.month}`;
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
  let cursor = Math.max(from, WORK_START);
  cursor = Math.ceil(cursor / 15) * 15;
  const spans = busy(tasks, day, exceptId);
  for (const s of spans) {
    if (s.end <= cursor) continue;
    if (s.start - cursor >= length) break;
    cursor = Math.max(cursor, s.end);
  }
  const end = day === 4 ? 16 * 60 + 30 : WORK_END;
  return cursor + length <= end ? cursor : null;
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
    const lastDay = task.due === undefined ? 4 : Math.min(4, Math.max(task.due, TODAY));
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
