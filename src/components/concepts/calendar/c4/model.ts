import type { Countdown, Task, Template } from "./data";

/** Offset 0 is Thursday 1 October 2026. */
const BASE = Date.UTC(2026, 9, 1);
const DAY_MS = 86_400_000;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function dateOf(offset: number) {
  return new Date(BASE + offset * DAY_MS);
}

/** Monday = 0 … Sunday = 6. */
export function dow(offset: number) {
  return (dateOf(offset).getUTCDay() + 6) % 7;
}

export function weekStart(offset: number) {
  return offset - dow(offset);
}

export const weekdayLetter = (o: number) =>
  WEEKDAYS[dateOf(o).getUTCDay()].slice(0, 1);
export const weekday = (o: number) => WEEKDAYS[dateOf(o).getUTCDay()];
export const dayNum = (o: number) => dateOf(o).getUTCDate();
export const month = (o: number) => MONTHS[dateOf(o).getUTCMonth()];

/** "Thu 1 Oct" */
export const fmtShort = (o: number) => `${weekday(o)} ${dayNum(o)} ${month(o)}`;
/** "Thu 1" */
export const fmtDay = (o: number) => `${weekday(o)} ${dayNum(o)}`;
/** "Saturday 24 October" */
export const fmtLong = (o: number) => {
  const d = dateOf(o);
  return `${WEEKDAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
};

/** "1 to 4 Oct", "28 Sep to 4 Oct", "Mon 12 Oct" */
export function fmtRange(a: number, b: number) {
  if (a === b) return fmtShort(a);
  if (month(a) === month(b)) return `${dayNum(a)} to ${dayNum(b)} ${month(a)}`;
  return `${dayNum(a)} ${month(a)} to ${dayNum(b)} ${month(b)}`;
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Distance to the big date in words: "9 days before", "on the day", "2 days after". */
export function relLabel(daysBefore: number) {
  if (daysBefore === 0) return "on the day";
  if (daysBefore > 0) return `${plural(daysBefore, "day")} before`;
  return `${plural(-daysBefore, "day")} after`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Column =
  | {
      kind: "week";
      key: string;
      label: string;
      days: number[];
      hasToday: boolean;
    }
  | { kind: "day"; key: "day"; label: string; days: number[] }
  | { kind: "wrap"; key: "wrap"; label: string; days: number[] };

export function buildColumns(c: Countdown, today: number): Column[] {
  const cols: Column[] = [];
  const lastWeek = weekStart(c.day - 1);
  if (today < c.day) {
    for (let ws = weekStart(today); ws <= lastWeek; ws += 7) {
      const days: number[] = [];
      for (
        let d = Math.max(ws, today);
        d <= Math.min(ws + 6, c.day - 1);
        d += 1
      )
        days.push(d);
      const n = (lastWeek - ws) / 7;
      const label = n === 0 ? "Final week" : `${plural(n, "week")} to go`;
      cols.push({
        kind: "week",
        key: `w${ws}`,
        label,
        days,
        hasToday: days.includes(today),
      });
    }
  }
  cols.push({ kind: "day", key: "day", label: "The day", days: [c.day] });
  const after = c.tasks.filter((task) => task.due > c.day);
  if (after.length) {
    const end = Math.max(...after.map((task) => task.due));
    const days: number[] = [];
    for (let d = c.day + 1; d <= end; d += 1) days.push(d);
    cols.push({ kind: "wrap", key: "wrap", label: "Wrap up", days });
  }
  return cols;
}

/** Shift every date in a countdown by `s` days: each task keeps its distance to the day. */
/**
 * Shift the big date by `s` days. Everything still ahead of today slides with
 * it and keeps its distance to the day; what is already behind stays put.
 */
export function shifted(c: Countdown, s: number, today = 0): Countdown {
  if (!s) return c;
  return {
    ...c,
    day: c.day + s,
    phases: c.phases.map((p) => ({ ...p, start: p.start + s, end: p.end + s })),
    checkpoints: c.checkpoints.map((k) => ({ ...k, day: k.day + s })),
    tasks: c.tasks.map((task) =>
      task.due >= today ? { ...task, due: task.due + s } : task,
    ),
  };
}

/**
 * "Look ahead" preview: everything due before the chosen day is treated as
 * done, so a later moment reads the way it would if the plan held.
 */
export function asOf(c: Countdown, today: number): Countdown {
  if (today <= 0) return c;
  return {
    ...c,
    tasks: c.tasks.map((task) =>
      task.due < today ? { ...task, done: true } : task,
    ),
    runsheet: c.runsheet.map((item) =>
      today > c.day ? { ...item, done: true } : item,
    ),
  };
}

export type Tone = "ok" | "risk" | "behind" | "day" | "passed";

export type Health = {
  tone: Tone;
  late: Task[];
  dueSoFar: number;
  doneSoFar: number;
  lead: string;
  rest: string;
  daysLeft: number;
  remaining: number;
};

export function health(c: Countdown, today: number): Health {
  const daysLeft = c.day - today;
  const late = c.tasks
    .filter((task) => !task.done && task.due < today)
    .sort((a, b) => a.due - b.due);
  const past = c.tasks.filter((task) => task.due < today);
  const doneSoFar = past.filter((task) => task.done).length;
  const dueSoFar = past.length;
  const remaining = c.tasks.filter((task) => !task.done).length;
  const noun = c.noun.replace(/^the /, "");

  if (daysLeft < 0) {
    const ago = -daysLeft;
    return {
      tone: "passed",
      late,
      dueSoFar,
      doneSoFar,
      daysLeft,
      remaining,
      lead: `${cap(c.noun)} was ${plural(ago, "day")} ago.`,
      rest: remaining
        ? `Wrap up ${plural(remaining, "remaining task")}.`
        : "Everything is wrapped up.",
    };
  }
  if (daysLeft === 0) {
    const open = c.runsheet.filter((item) => !item.done).length;
    return {
      tone: "day",
      late,
      dueSoFar,
      doneSoFar,
      daysLeft,
      remaining,
      lead: `It is ${noun} day.`,
      rest: open
        ? `${plural(open, "thing")} left on the run-sheet.`
        : "Everything on the run-sheet is done.",
    };
  }

  const nextCheck = c.checkpoints
    .filter((k) => k.day >= today)
    .sort((a, b) => a.day - b.day)[0];
  const ratio = dueSoFar ? doneSoFar / dueSoFar : 1;
  const phaseNames = [
    ...new Set(
      late.map((task) => c.phases.find((p) => p.id === task.phase)?.name ?? ""),
    ),
  ];
  const where =
    phaseNames.length === 1
      ? `${late.length === 1 ? "in" : "all in"} ${phaseNames[0]}`
      : `across ${phaseNames.slice(0, -1).join(", ")} and ${phaseNames.at(-1)}`;

  const broken = c.tasks.filter(
    (task) =>
      !task.done && task.due >= today && brokenCheckpoint(c, task, task.due),
  );
  const brokenNote = broken.length
    ? ` ${broken.length === 1 ? `${broken[0].title} now lands` : `${plural(broken.length, "task")} now land`} after ${
        c.checkpoints.find((k) => k.id === broken[0].before)?.short ??
        "its checkpoint"
      }.`
    : "";

  if (!late.length) {
    return {
      tone: "ok",
      late,
      dueSoFar,
      doneSoFar,
      daysLeft,
      remaining,
      lead: "On track.",
      rest: nextCheck
        ? `Nothing is running late. Next up, ${nextCheck.short} on ${fmtShort(nextCheck.day)}.${brokenNote}`
        : `Nothing is running late.${brokenNote}`,
    };
  }
  if (late.length <= 3 && ratio >= 0.7) {
    return {
      tone: "risk",
      late,
      dueSoFar,
      doneSoFar,
      daysLeft,
      remaining,
      lead: "On track.",
      rest: `${plural(late.length, "thing")} ${late.length === 1 ? "is" : "are"} running late, ${where}.${brokenNote}`,
    };
  }
  return {
    tone: "behind",
    late,
    dueSoFar,
    doneSoFar,
    daysLeft,
    remaining,
    lead: "Behind.",
    rest: nextCheck?.need
      ? `${plural(late.length, "task")} ${late.length === 1 ? "is" : "are"} late, and ${nextCheck.need}.`
      : `${plural(late.length, "task")} ${late.length === 1 ? "is" : "are"} late.`,
  };
}

/** The checkpoint a task would now land after, if any. */
export function brokenCheckpoint(c: Countdown, task: Task, day: number) {
  if (!task.before) return null;
  const k = c.checkpoints.find((x) => x.id === task.before);
  if (!k || day <= k.day) return null;
  return k;
}

export function fromTemplate(tpl: Template, day: number, today: number) {
  const phases = tpl.phases.map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    start: Math.max(day - p.from, today - 14),
    end: day - p.to,
  }));
  const tasks: Task[] = tpl.tasks.map((x, i) => ({
    id: `tpl-${tpl.id}-${i}-${day}`,
    title: x.title,
    due: Math.max(day - x.before, today),
    phase: phases.find((p) => p.name === x.phase)?.id ?? phases[0].id,
    owner: "you",
    done: false,
  }));
  return { phases, tasks };
}
