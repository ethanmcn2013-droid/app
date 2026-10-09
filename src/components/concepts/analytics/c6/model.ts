import {
  THIS_WEEK,
  WEEKS,
  fmtDay,
  weekStart,
  type Client,
  type Project,
} from "./data";

export type Period = 4 | 12 | 26;
export const PERIODS: { value: Period; label: string; long: string }[] = [
  { value: 4, label: "4 weeks", long: "last 4 weeks" },
  { value: 12, label: "12 weeks", long: "last 12 weeks" },
  { value: 26, label: "6 months", long: "last 6 months" },
];

export type SortKey = "date" | "late" | "changed" | "name";
export const SORTS: { value: SortKey; label: string }[] = [
  { value: "date", label: "Next big date" },
  { value: "late", label: "Most late" },
  { value: "changed", label: "Most changed" },
  { value: "name", label: "Name" },
];

export type Status = "course" | "watch" | "behind" | "nodate" | "new" | "empty";
export const STATUS_WORD: Record<Status, string> = {
  course: "On course",
  watch: "Watch",
  behind: "Behind",
  nodate: "No date",
  new: "Just started",
  empty: "Not started",
};

/** Weeks used for the pace behind every forecast: the last six full weeks. */
const PACE_WEEKS = 6;

export type Derived = {
  p: Project;
  open: number;
  /** Open count at the end of every week. */
  openSeries: number[];
  doneThisWeek: number;
  donePeriod: number;
  addedPeriod: number;
  onTime: number | null;
  /** Things finished minus things added, per week, over the last six full weeks. */
  netPace: number | null;
  ready: number | null;
  readyEarly: number | null;
  readyLate: number | null;
  spare: number | null;
  status: Status;
  reason: string | null;
  /** Started this many weeks ago (only for young Projects). */
  weeksOld: number;
  hasWork: boolean;
};

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export function derive(p: Project, period: Period): Derived {
  const from = WEEKS - period;
  const openSeries: number[] = [];
  let run = 0;
  for (let w = 0; w < WEEKS; w++) {
    run += p.added[w] - p.finished[w];
    openSeries.push(run);
  }
  const open = run;
  const hasWork = sum(p.added) > 0;
  const weeksOld = THIS_WEEK - p.start;
  const fullWeeks = THIS_WEEK - p.start;
  const paceFrom = Math.max(p.start + 1, THIS_WEEK - PACE_WEEKS);
  let netPace: number | null = null;
  if (fullWeeks >= 3) {
    const f = sum(p.finished.slice(paceFrom, THIS_WEEK));
    const a = sum(p.added.slice(paceFrom, THIS_WEEK));
    netPace = (f - a) / (THIS_WEEK - paceFrom);
  }
  let ready: number | null = null;
  let readyEarly: number | null = null;
  let readyLate: number | null = null;
  if (netPace !== null && netPace > 0.5 && open > 0) {
    ready = Math.ceil((open / netPace) * 7);
    readyEarly = Math.ceil((open / (netPace * 1.2)) * 7);
    readyLate = Math.ceil((open / (netPace * 0.82)) * 7);
  }
  const spare = p.bigDate !== null && ready !== null ? p.bigDate - ready : null;
  let status: Status;
  if (!hasWork) status = "empty";
  else if (fullWeeks < 3) status = "new";
  else if (p.bigDate === null) status = "nodate";
  else if (ready === null || (spare !== null && spare < 0)) status = "behind";
  else if (spare !== null && spare < 3) status = "watch";
  else if (p.unowned >= 10 || p.late >= 8) status = "watch";
  else status = "course";

  const donePeriod = sum(p.finished.slice(from));
  const lateDone = sum(p.finishedLate.slice(from));
  return {
    p,
    open,
    openSeries,
    doneThisWeek: p.finished[THIS_WEEK],
    donePeriod,
    addedPeriod: sum(p.added.slice(Math.max(from, p.start + 1))),
    onTime: donePeriod > 0 ? 1 - lateDone / donePeriod : null,
    netPace,
    ready,
    readyEarly,
    readyLate,
    spare,
    status,
    reason:
      status === "watch" || status === "behind"
        ? (p.issues[0]?.text ?? null)
        : null,
    weeksOld,
    hasWork,
  };
}

export function sortBy(list: Derived[], key: SortKey): Derived[] {
  const out = [...list];
  const byName = (a: Derived, b: Derived) => a.p.name.localeCompare(b.p.name);
  if (key === "name") return out.sort(byName);
  if (key === "late")
    return out.sort(
      (a, b) =>
        b.p.late - a.p.late || b.p.oldestLate - a.p.oldestLate || byName(a, b),
    );
  if (key === "changed")
    return out.sort(
      (a, b) =>
        b.addedPeriod +
          b.p.dateMoves * 5 -
          (a.addedPeriod + a.p.dateMoves * 5) || byName(a, b),
    );
  return out.sort(
    (a, b) => (a.p.bigDate ?? 9999) - (b.p.bigDate ?? 9999) || byName(a, b),
  );
}

/** The largest weekly finished count in the window, across every Project given. */
export function sharedMax(list: Derived[], period: Period) {
  let m = 0;
  for (const d of list)
    for (let w = WEEKS - period; w < WEEKS; w++)
      m = Math.max(m, d.p.finished[w]);
  return Math.max(1, m);
}

export function ownMax(d: Derived, period: Period) {
  let m = 0;
  for (let w = WEEKS - period; w < WEEKS; w++) m = Math.max(m, d.p.finished[w]);
  return Math.max(1, m);
}

export function weekLabel(w: number) {
  return w === THIS_WEEK ? "This week" : `Week of ${fmtDay(weekStart(w))}`;
}

export function weekSummary(list: Derived[], w: number) {
  let total = 0;
  const byClient = new Map<Client, number>();
  let topProject: Derived | null = null;
  for (const d of list) {
    const v = d.p.finished[w];
    total += v;
    byClient.set(d.p.client, (byClient.get(d.p.client) ?? 0) + v);
    if (!topProject || v > topProject.p.finished[w]) topProject = d;
  }
  const clients = [...byClient.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total,
    topClient: clients[0] ?? null,
    clientCount: clients.length,
    topProject,
  };
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Readable gap between the likely finish and the big date. */
export function spareWords(d: Derived) {
  if (d.spare === null) return null;
  if (d.spare === 0) return "right on the day";
  return d.spare > 0
    ? `${plural(d.spare, "day")} to spare`
    : `${plural(-d.spare, "day")} late`;
}
