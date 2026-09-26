import { TODAY, type Person, type Project, type Task } from "./data";

/* ── Dates (UTC so nothing drifts with the viewer's time zone) ────── */

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toTime(iso: string) {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}
export function toIso(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number) {
  return toIso(toTime(iso) + n * DAY);
}
export function weekday(iso: string) {
  return new Date(toTime(iso)).getUTCDay();
}
export function mondayOf(iso: string) {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}
export function dayNum(iso: string) {
  return +iso.slice(8, 10);
}
export function wd(iso: string) {
  return WEEKDAYS[weekday(iso)];
}
export function wdLong(iso: string) {
  return WEEKDAYS_LONG[weekday(iso)];
}
export function month(iso: string) {
  return MONTHS[+iso.slice(5, 7) - 1];
}
/** "Fri 9 Oct" */
export function shortDate(iso: string) {
  return `${wd(iso)} ${dayNum(iso)} ${month(iso)}`;
}
/** "28 Sep – 4 Oct" */
export function spanLabel(from: string, to: string) {
  return month(from) === month(to)
    ? `${dayNum(from)} – ${dayNum(to)} ${month(to)}`
    : `${dayNum(from)} ${month(from)} – ${dayNum(to)} ${month(to)}`;
}
export function isWeekend(iso: string) {
  const d = weekday(iso);
  return d === 0 || d === 6;
}
export function daysFrom(start: string, n: number) {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}
export function isPast(iso: string) {
  return iso < TODAY;
}

/** Relative day name used in sentences: "Fri", or "Fri 16 Oct" when it's another week. */
export function dayWord(iso: string, near: string) {
  return mondayOf(iso) === mondayOf(near) ? wd(iso) : shortDate(iso);
}

export function hrs(n: number) {
  const r = Math.round(n * 10) / 10;
  return `${r}h`;
}

/* ── Availability and load ────────────────────────────────────────── */

export type DayKind = "work" | "off" | "away" | "extra";

export function dayKind(p: Person, iso: string): DayKind {
  if (p.away && iso >= p.away.from && iso <= p.away.to) return "away";
  if (p.extra?.some((e) => e.date === iso)) return "extra";
  return p.days.includes(weekday(iso)) ? "work" : "off";
}

export function available(p: Person, iso: string) {
  const k = dayKind(p, iso);
  return k === "work" || k === "extra" ? p.hoursPerDay : 0;
}

export type Level = "none" | "empty" | "light" | "full" | "over";

export function levelOf(hours: number, avail: number): Level {
  if (avail === 0) return hours > 0 ? "over" : "none";
  if (hours === 0) return "empty";
  const r = hours / avail;
  if (r > 1) return "over";
  if (r >= 0.8) return "full";
  return "light";
}

export const LEVEL_WORD: Record<Level, string> = {
  none: "Not working",
  empty: "Free",
  light: "Light",
  full: "Full",
  over: "Over",
};

export type Cell = {
  personId: string | null;
  date: string;
  tasks: Task[];
  hours: number;
  avail: number;
  kind: DayKind;
  level: Level;
};

export type LoadMap = Map<string, Cell>;

export const cellKey = (personId: string | null, date: string) => `${personId ?? "none"}|${date}`;

export function buildLoad(project: Project, tasks: Task[], days: string[]): LoadMap {
  const map: LoadMap = new Map();
  const byKey = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = cellKey(t.personId, t.date);
    const list = byKey.get(k);
    if (list) list.push(t);
    else byKey.set(k, [t]);
  }
  const rows: (Person | null)[] = [...project.people, null];
  for (const p of rows) {
    for (const d of days) {
      const k = cellKey(p?.id ?? null, d);
      const list = (byKey.get(k) ?? []).slice().sort((a, b) => b.hours - a.hours);
      const hours = list.reduce((s, t) => s + t.hours, 0);
      const avail = p ? available(p, d) : 0;
      const kind: DayKind = p ? dayKind(p, d) : "work";
      map.set(k, {
        personId: p?.id ?? null,
        date: d,
        tasks: list,
        hours,
        avail,
        kind,
        level: p ? levelOf(hours, avail) : hours > 0 ? "light" : "empty",
      });
    }
  }
  return map;
}

/* ── Rebalance suggestions ────────────────────────────────────────── */

export type Suggestion = {
  id: string;
  kind: "over" | "away" | "unassigned";
  from: { personId: string | null; date: string };
  to: { personId: string; date: string };
  task: Task;
  /** First sentence: the problem. */
  problem: string;
  /** Second sentence: the room that fixes it. */
  room: string;
};

function freeOn(p: Person, iso: string, load: LoadMap, all: Task[]) {
  const cell = load.get(cellKey(p.id, iso));
  const hours = cell ? cell.hours : all.filter((t) => t.personId === p.id && t.date === iso).reduce((s, t) => s + t.hours, 0);
  return available(p, iso) - hours;
}

function workingBefore(iso: string, n: number) {
  const out: string[] = [];
  let d = iso;
  while (out.length < n) {
    d = addDays(d, -1);
    if (!isWeekend(d)) out.push(d);
  }
  return out;
}

/** One idea per problem cell: over days, away days with work, then unassigned work. */
export function suggest(project: Project, tasks: Task[], days: string[], load: LoadMap): Suggestion[] {
  const out: Suggestion[] = [];
  const people = project.people;
  const byId = new Map(people.map((p) => [p.id, p]));
  const pick = (task: Task, fromPerson: Person | null, date: string) => {
    type Option = { p: Person; date: string; free: number; score: number };
    const options: Option[] = [];
    const candidatesDays = [date, ...workingBefore(date, 2)].filter((d) => d >= TODAY);
    candidatesDays.forEach((d, i) => {
      for (const p of people) {
        if (fromPerson && p.id === fromPerson.id && d === date) continue;
        if (p.takes && !p.takes.some((k) => task.title.toLowerCase().includes(k))) continue;
        const free = freeOn(p, d, load, tasks);
        if (free >= task.hours) {
          const samePerson = fromPerson && p.id === fromPerson.id;
          options.push({ p, date: d, free, score: i + (samePerson ? 0.5 : 0) + (p.guest ? 0.2 : 0) });
        }
      }
    });
    options.sort((a, b) => a.score - b.score || b.free - a.free);
    return options[0];
  };

  for (const d of days) {
    if (d < TODAY) continue;
    for (const p of people) {
      const cell = load.get(cellKey(p.id, d));
      if (!cell || cell.level !== "over") continue;
      const over = cell.hours - cell.avail;
      const movable = cell.tasks.filter((t) => !t.fixed);
      if (!movable.length) continue;
      const ordered = [
        ...movable.filter((t) => t.hours >= over).sort((a, b) => a.hours - b.hours),
        ...movable.filter((t) => t.hours < over).sort((a, b) => b.hours - a.hours),
      ];
      for (const task of ordered) {
        const opt = pick(task, p, d);
        if (!opt) continue;
        const target = byId.get(opt.p.id)!;
        const problem =
          cell.kind === "away"
            ? `${p.first} is away on ${dayWord(d, d)}.`
            : cell.kind === "off"
              ? `${dayWord(d, d)} is ${p.first}'s day off.`
              : `${dayWord(d, d)} is over by ${hrs(over)}.`;
        const room =
          target.id === p.id
            ? `${p.first} has ${hrs(opt.free)} free on ${dayWord(opt.date, d)}.`
            : `${target.first} has ${hrs(opt.free)} free on ${dayWord(opt.date, d)}.`;
        out.push({
          id: `${p.id}|${d}|${task.id}`,
          kind: cell.kind === "away" ? "away" : "over",
          from: { personId: p.id, date: d },
          to: { personId: opt.p.id, date: opt.date },
          task,
          problem,
          room,
        });
        break;
      }
    }
  }

  for (const d of days) {
    if (d < TODAY) continue;
    const cell = load.get(cellKey(null, d));
    if (!cell) continue;
    for (const task of cell.tasks) {
      const opt = pick(task, null, d);
      if (!opt) continue;
      out.push({
        id: `none|${d}|${task.id}`,
        kind: "unassigned",
        from: { personId: null, date: d },
        to: { personId: opt.p.id, date: opt.date },
        task,
        problem: `${task.title} needs someone.`,
        room: `${opt.p.first} has ${hrs(opt.free)} free on ${dayWord(opt.date, d)}.`,
      });
    }
  }
  return out;
}

/* ── Summaries ────────────────────────────────────────────────────── */

export function weekSummary(project: Project, load: LoadMap, week: string[]) {
  let over = 0;
  let full = 0;
  for (const p of project.people) {
    for (const d of week) {
      const c = load.get(cellKey(p.id, d));
      if (!c) continue;
      if (c.level === "over") over++;
      else if (c.level === "full") full++;
    }
  }
  const unassigned = week.reduce((s, d) => s + (load.get(cellKey(null, d))?.tasks.length ?? 0), 0);
  return { over, full, unassigned };
}

export function personTotal(personId: string | null, load: LoadMap, days: string[]) {
  let hours = 0;
  let avail = 0;
  let over = 0;
  for (const d of days) {
    const c = load.get(cellKey(personId, d));
    if (!c) continue;
    hours += c.hours;
    avail += c.avail;
    if (personId && c.level === "over") over++;
  }
  return { hours, avail, over };
}
