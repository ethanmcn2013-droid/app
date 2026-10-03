/*
 * Prepared answers. Each question reads the Project's sample data and states
 * the finding in one sentence, picks exactly one chart, and shows its working.
 * Bold phrases in the sentence name the chart marks they point at.
 */

import { HEALTH_WORDS, healthKey } from "../../demo/health";
import {
  REASONS,
  toneIn,
  quoted,
  fmtDay,
  fmtShort,
  weekStart,
  weekdayShort,
  type Day,
  type Part,
  type ProjectData,
  type ReasonId,
} from "./ask-data";
import { questionById } from "./ask-questions";

export type Tone = "key" | "plain" | "soft" | "late" | "risk" | "wait" | "doing" | "check" | "idle";

export type BarRow = {
  id: string;
  label: string;
  sub?: string;
  value: number;
  display: string;
  tone: Tone;
  color?: string;
  segs?: { value: number; tone: Tone }[];
  say: string;
};

export type Chart =
  | {
      kind: "course";
      series: { id: string; day: Day; value: number; say: string }[];
      pace: number;
      finish: Day;
      target: { day: Day; name: string };
      paceFrom: number;
      says: { pace: string; finish: string; target: string; gap: string };
    }
  | { kind: "bars"; rows: BarRow[]; max: number; share?: boolean; legend?: { tone: Tone; alt?: Tone; label: string }[]; diverge?: { left: string; right: string } }
  | { kind: "slope"; left: string; right: string; rows: { id: string; label: string; a: number; b: number; good: boolean | null; say: string }[] }
  | { kind: "waffle"; parts: { id: string; label: string; pct: number; tone: Tone; say: string }[] }
  | {
      kind: "dots";
      lanes: { id: string; label: string; color?: string }[];
      min: number;
      max: number;
      ticks: { x: number; label: string }[];
      axis: string;
      points: { id: string; lane: string; x: number; label: string; tone: Tone; say: string; color?: string }[];
    }
  | { kind: "range"; rows: { id: string; label: string; p25: number; median: number; p75: number; tone: Tone; color?: string; say: string }[]; max: number; typical: number }
  | {
      kind: "columns";
      cols: { id: string; label: string; value: number; tone: Tone; say: string }[];
      unit: string;
      lines?: { id: string; from: number; to: number; value: number; label: string; say: string }[];
    }
  | {
      kind: "week";
      days: { label: string; date: string }[];
      items: { id: string; title: string; day: number; person: string; rank?: number; why: string; color?: string; project?: string; say: string }[];
    }
  | {
      kind: "moves";
      rows: { id: string; label: string; sub: string; from: Day; hops: Day[]; say: string }[];
      min: Day;
      max: Day;
      target: { day: Day; name: string } | null;
    };

/** "Why I think this": the rows behind the chart, never fewer than the chart shows. `task` or `project` links the row's label. */
export type Why = { head: string[]; rows: { id: string; label: string; sub?: string; cells: string[]; marks?: string[]; task?: string; project?: string }[]; foot?: string };

/** The one thing to do about an answer. `done` confirms it in place; `to` opens that part of the app instead. */
export type Act = { label: string; done?: string; to?: "tasks/list" | "tasks/calendar" };

/** Where an answer can be seen another way: every project on one wall, or one project replayed. */
export type See = { label: string; lens: "all-projects" | "replay"; project?: string };

export type Answer = {
  act?: Act;
  see?: See;
  status: "ok" | "thin";
  sentence: Part[];
  plain: string;
  chart: Chart | null;
  note: string;
  why: Why | null;
  follow: string[];
};

/* ── helpers ────────────────────────────────────────────────────────────── */

const b = (text: string, marks: string[] = [], link: { task?: string; project?: string } = {}): Part => ({ b: text, marks, ...link });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtN = (n: number) => (Number.isInteger(round1(n)) ? String(round1(n)) : round1(n).toFixed(1));
const isPlural = (name: string) => /s$/.test(name) && !/(ss|us)$/.test(name);
const keep = (name: string) => (isPlural(name) ? "keep" : "keeps");
const has = (name: string) => (isPlural(name) ? "have" : "has");
const PROPER = /^(The Lindens|Mara|Finn|Lena|Sinéad|Ada|Theo|Santa|Christmas|Kinsale|Cork|Hayes|Fern|Lawlor)\b/;
export const lowerTitle = (t: string) => (PROPER.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const inP = (p: ProjectData, project?: string) => (p.status === "all" && project ? ` in ${project}` : "");

export function plainOf(parts: Part[]) {
  return parts.map((x) => (typeof x === "string" ? x : x.b)).join("");
}

function thin(text: string, follow: string[]): Answer {
  return { status: "thin", sentence: [text], plain: text, chart: null, note: "", why: null, follow };
}

function done(sentence: Part[], chart: Chart, note: string, why: Why | null, follow: string[]): Answer {
  return { status: "ok", sentence, plain: plainOf(sentence), chart, note, why, follow };
}

/* ── answers ────────────────────────────────────────────────────────────── */

export function answerFor(qid: string, p: ProjectData): Answer {
  const a = rawAnswer(qid, p);
  // A finished project can always be watched back, even when there is nothing left to answer.
  if (a.status !== "ok") return p.status === "done" ? { ...a, see: { label: `Replay ${p.short} week by week`, lens: "replay", project: p.id } } : a;
  const act = actFor(qid, p);
  const see = seeFor(qid, p);
  return { ...a, ...(act ? { act } : {}), ...(see ? { see } : {}) };
}

/** Questions about the past can be watched, not just read. */
const HISTORY = new Set(["changed", "slipping", "those-tasks", "getting-better", "done-week", "time-goes", "which-outsider", "how-long"]);

function seeFor(qid: string, p: ProjectData): See | undefined {
  if (p.status === "all") return { label: "See all projects side by side", lens: "all-projects" };
  if (HISTORY.has(qid)) return { label: `Replay ${p.short} week by week`, lens: "replay", project: p.id };
  if (qid === "on-course") return { label: "Compare with the other projects", lens: "all-projects", project: p.id };
  return undefined;
}

const TASKS = "tasks/list" as const;
const TIMELINE = "tasks/calendar" as const;

/** Every answer that points at something to do ends by offering to do it. */
function actFor(qid: string, p: ProjectData): Act | undefined {
  const all = p.status === "all";
  switch (qid) {
    case "on-course": {
      if (all) {
        const behind = p.members.filter((cp) => cp.status === "full").filter((cp) => cp.forecast?.spare !== null && cp.forecast?.spare !== undefined && cp.forecast.spare < 0).sort((a, z) => (a.forecast?.spare ?? 0) - (z.forecast?.spare ?? 0))[0];
        return behind ? { label: `Find what can move in ${behind.short}`, to: TASKS } : undefined;
      }
      const f = p.forecast;
      if (!p.target || !f || f.spare === null) return undefined;
      return f.spare >= 3
        ? { label: `Open the ${f.remaining} tasks due by ${p.target.name}`, to: TASKS }
        : { label: `Find what can move past ${fmtShort(p.target.day)}`, to: TASKS };
    }
    case "who-busy": {
      // Only people the chart shows: the answer charts everyone with work here.
      const ppl = [...p.people].sort((a, z) => z.open - a.open);
      const top = ppl[0];
      const light = ppl[ppl.length - 1];
      const n = Math.floor((top.open - light.open) / 3);
      if (!top || n < 1 || light.id === top.id) return undefined;
      return { label: `Move ${n} of ${top.name}’s tasks to ${light.name}`, done: `Moved ${plural(n, "task")} to ${light.name}` };
    }
    case "first-next-week": {
      const n = p.picks.filter((k) => k.rank).length || Math.min(3, p.picks.length);
      if (!n) return undefined;
      return { label: `Put these ${n} first on Monday`, done: `Put first on Monday, in this order` };
    }
    case "slipping": {
      const gs = p.groups.filter((g) => g.recent > 0).sort((a, z) => z.recentMoved / z.recent - a.recentMoved / a.recent || z.moves - a.moves);
      const top = gs[0];
      // No pattern, no reminder: with only a few moved dates the answer just names them.
      if (all || !top?.open || p.moved.length <= 3 || !p.groups.some((g) => g.recentMoved >= 3)) return undefined;
      return { label: `Remind me 3 days before the ${plural(top.open, "open task")} in ${top.name} ${top.open === 1 ? "is" : "are"} due`, done: `Reminders set on ${plural(top.open, "task")} in ${top.name}` };
    }
    case "late": {
      const top = [...p.late].sort((a, z) => z.daysLate - a.daysLate)[0];
      if (!top) return undefined;
      return { label: `Remind ${top.person} about ${top.name ?? `“${top.title}”`}`, done: `Reminder sent to ${top.person}` };
    }
    case "waiting-longest": {
      const top = [...p.waiting].sort((a, z) => z.days - a.days)[0];
      if (!top) return undefined;
      return { label: `Remind me to chase ${top.on} tomorrow`, done: `Reminder set for tomorrow morning` };
    }
    case "time-goes":
      return p.waiting.length ? { label: `See the ${p.waiting.length} tasks waiting on others`, to: TASKS } : undefined;
    case "how-long": {
      const top = p.groups.filter((g) => g.done > 0).sort((a, z) => z.median - a.median)[0];
      if (all || !top) return undefined;
      return { label: `Give new ${top.noun} ${top.median} days by default`, done: `New ${top.noun} now start with ${top.median} days` };
    }
    case "coming-up":
      return { label: "Open the next two weeks in the calendar", to: TIMELINE };
    default:
      return undefined;
  }
}

function rawAnswer(qid: string, p: ProjectData): Answer {
  const q = questionById(qid);
  if (p.thin[qid]) {
    const can = (id: string) => !p.thin[id] && id !== qid;
    const pool = [...q.follow, "first-next-week", "who-busy", "left", "coming-up", "done-week"].filter(can);
    return thin(p.thin[qid], [...new Set(pool)].slice(0, 3));
  }
  const empty = emptyAnswer(qid, p);
  if (empty) {
    const can = (id: string) => !p.thin[id] && id !== qid && !emptyAnswer(id, p);
    const pool = [...q.follow, "who-busy", "left", "on-course", "done-week"].filter(can);
    return thin(empty, [...new Set(pool)].slice(0, 3));
  }
  switch (qid) {
    case "on-course":
      return p.status === "all" ? onCourseAll(p, q.follow) : onCourse(p, q.follow);
    case "changed":
      return changed(p, q.follow);
    case "who-busy":
      return whoBusy(p, q.follow);
    case "first-next-week":
      return firstNextWeek(p, q.follow);
    case "slipping":
      return slipping(p, q.follow);
    case "late":
      return late(p, q.follow);
    case "time-goes":
      return timeGoes(p, q.follow);
    case "how-long":
      return howLong(p, q.follow);
    case "which-outsider":
      return whichOutsider(p, q.follow);
    case "getting-better":
      return gettingBetter(p, q.follow);
    case "those-tasks":
      return thoseTasks(p, q.follow);
    case "done-week":
      return doneWeek(p, q.follow);
    case "waiting-longest":
      return waitingLongest(p, q.follow);
    case "who-did":
      return whoDid(p, q.follow);
    case "left":
      return left(p, q.follow);
    case "coming-up":
      return comingUp(p, q.follow);
    default:
      return thin("I cannot answer that yet.", q.follow);
  }
}

/** When the records hold nothing to show, say so plainly instead of drawing an empty chart. */
function emptyAnswer(qid: string, p: ProjectData): string | null {
  const next = [...p.upcoming].sort((a, z) => a.day - z.day)[0];
  const nextWords = next ? ` The next thing due is “${next.title}” on ${fmtDay(next.day)}.` : "";
  switch (qid) {
    case "late":
      return p.late.length ? null : `Nothing is late.${nextWords}`;
    case "coming-up":
      return p.upcoming.length ? null : "Nothing is due in the next two weeks.";
    case "first-next-week":
      return p.picks.length ? null : `Nothing is late and nothing falls due next week, so start wherever suits.${nextWords}`;
    case "waiting-longest":
      return p.waiting.length ? null : "Nothing is waiting on anyone outside the team.";
    case "which-outsider":
      return p.outsiders.some((o) => o.moves > 0) ? null : "No dates have moved on anything that waited on someone outside the team.";
    case "those-tasks":
    case "slipping":
      return p.moved.length ? null : "No dates have moved yet, so nothing is slipping.";
    case "getting-better": {
      // A trend needs more than a couple of moves to stand on.
      const recent = p.weeks.moved.slice(10).reduce((n, v) => n + v, 0);
      const before = p.weeks.moved.slice(6, 10).reduce((n, v) => n + v, 0);
      if (recent + before >= 4) return null;
      const said = (n: number) => (n === 0 ? "none" : String(n));
      return recent + before === 0
        ? "No dates have moved in the last 8 weeks, so there is nothing to get better or worse."
        : `Too few dates have moved to call it a trend: ${said(recent)} in the last 4 weeks and ${said(before)} in the 4 before.`;
    }
    case "who-busy":
    case "who-did":
      return p.people.length > 1 ? null : "Only one person has work here, so there is nobody to compare.";
    default:
      return null;
  }
}

const ORDER = { off_track: 0, at_risk: 1, too_early: 2, on_track: 3 } as const;

function onCourse(p: ProjectData, follow: string[]): Answer {
  const t = p.target;
  const f = p.forecast;
  if (!t || !f) return thin("There is no forecast for this project yet.", follow);
  const s = p.weeks.remaining;
  const rem = f.remaining;
  const openNow = p.weeks.open[13];
  const after = openNow - rem;
  const health = HEALTH_WORDS[healthKey(p.health, p.tooEarly)];
  const healthNote = p.health === "on_track" ? "" : ` ${p.lead} has it marked ${health.toLowerCase()}.`;
  const afterNote = after > 0 ? ` ${plural(after, "more task")} ${after === 1 ? "follows" : "follow"} ${t.name} on purpose.` : "";
  if (f.ready === null || f.spare === null)
    return thin(`Not at this pace. Nothing has been finished yet, so the ${plural(rem, "task")} due by ${t.name} have no finish date.${healthNote}`, follow);
  const spare = f.spare;
  const finish = f.ready;
  const pace = f.pace;
  const paceWords = f.paceSinceStart ? `your pace since the start, ${fmtN(pace)} a week` : `the last 7 days' pace of ${fmtN(pace)} a week`;
  const need = rem / Math.max(t.day / 7, 1 / 7);
  const sentence: Part[] =
    spare >= 3
      ? ["Yes, with ", b(`${plural(spare, "day")} to spare`, ["gap"]), `. ${plural(rem, "task")} ${rem === 1 ? "is" : "are"} due by ${t.name}, and at `, b(paceWords, ["pace"]), " they are done by ", b(fmtDay(finish), ["finish"]), "."]
      : spare >= 0
        ? [
            "Only just. ",
            `${plural(rem, "task")} ${rem === 1 ? "is" : "are"} due by ${t.name}, and at `,
            b(paceWords, ["pace"]),
            " they are done by ",
            b(fmtDay(finish), ["finish"]),
            ", ",
            b(spare === 0 ? "on the day itself" : `${plural(spare, "day")} to spare`, ["gap"]),
            ". One slow day and it slips.",
          ]
        : [
            "Not at this pace. ",
            `${plural(rem, "task")} ${rem === 1 ? "is" : "are"} due by ${t.name}, and at `,
            b(paceWords, ["pace"]),
            " they are done on ",
            b(fmtDay(finish), ["finish"]),
            ", ",
            b(`${plural(-spare, "day")} after ${t.name}`, ["gap"]),
            `. To make it you need about ${fmtN(need)} a week.`,
          ];
  if (afterNote) sentence.push(afterNote);
  if (healthNote) sentence.push(healthNote);
  const series = s.map((value, i) => {
    const day = i === 13 ? 0 : weekStart(i) + 6;
    return { id: `w${i}`, day, value, say: i === 13 ? `Today: ${value} due by ${t.name} still open.` : `Week of ${fmtShort(weekStart(i))}: ${value} still open at the end of the week.` };
  });
  const first = Math.max(0, s.findIndex((v) => v > 0) - 1);
  const shown = series.slice(first);
  return done(
    sentence,
    {
      kind: "course",
      series: shown,
      pace,
      finish,
      target: t,
      // The last stretch, the past week, is the pace the dashed line carries on.
      paceFrom: Math.max(0, shown.length - 2),
      says: {
        pace: f.paceSinceStart
          ? `Nothing finished in the last 7 days, so the pace is the whole project's: ${fmtN(pace)} a week.`
          : `In the last 7 days you finished ${f.doneRecently}: a pace of ${fmtN(pace)} a week.`,
        finish: `At that pace the last one is done on ${fmtDay(finish)}.`,
        target: `${cap(t.name)} is on ${fmtDay(t.day)}, ${plural(t.day, "day")} away.`,
        gap: spare >= 0 ? `${plural(spare, "day")} between the last task and ${t.name}.` : `The last task lands ${plural(-spare, "day")} after ${t.name}.`,
      },
    },
    `The line is the tasks due by ${t.name} still open at the end of each week; it turns blue for the past week, the pace the dashed line carries on to the finish.`,
    {
      head: ["", ""],
      rows: [
        { id: "r1", label: "Open today", cells: [String(openNow)] },
        { id: "r2", label: `Due by ${t.name}`, cells: [String(rem)], marks: ["w13"] },
        { id: "r3", label: "Finished in the last 7 days", cells: [String(f.doneRecently)], marks: ["pace"] },
        { id: "r4", label: `Days until ${t.name}`, cells: [String(t.day)], marks: ["target"] },
        { id: "r5", label: "Last one done at this pace", cells: [fmtShort(finish)], marks: ["finish"] },
      ],
    },
    follow,
  );
}

/** Every active project, worst first: health as each lead set it, then days to spare at its pace. */
function onCourseAll(p: ProjectData, follow: string[]): Answer {
  const all = p.members.map((p) => ({ p, key: healthKey(p.health, p.tooEarly), f: p.forecast }));
  const ranked = [...all].sort((a, z) => ORDER[a.key] - ORDER[z.key] || (a.f?.spare ?? 999) - (z.f?.spare ?? 999) || a.p.short.localeCompare(z.p.short));
  const rows = ranked.filter((r) => r.f && r.f.spare !== null && r.f.ready !== null);
  const early = ranked.filter((r) => r.key === "too_early");
  const named = (xs: typeof all): Part[] =>
    xs.flatMap((r, i): Part[] => [i === 0 ? "" : i === xs.length - 1 ? " and " : ", ", b(r.p.short, [r.p.id], { project: r.p.id })]);
  const off = ranked.filter((r) => r.key === "off_track");
  const risk = ranked.filter((r) => r.key === "at_risk");
  const ok = ranked.filter((r) => r.key === "on_track");
  const sentence: Part[] = [];
  if (off.length) sentence.push(`${off.length === 1 ? "One is" : `${cap(numberWord(off.length))} are`} off track: `, ...named(off), ". ");
  if (risk.length) sentence.push(`${risk.length === 1 ? "One is" : `${cap(numberWord(risk.length))} are`} at risk: `, ...named(risk), ". ");
  sentence.push(`The other ${ok.length} ${ok.length === 1 ? "is" : "are"} on track`);
  if (early.length) sentence.push(", and ", ...named(early), ` ${early.length === 1 ? "is" : "are"} too early to tell`);
  sentence.push(".");
  const max = Math.max(...rows.map((r) => Math.abs(r.f!.spare!)), 7);
  const sayOf = (r: (typeof rows)[number]) => {
    const f = r.f!;
    return `${r.p.short}, ${HEALTH_WORDS[r.key].toLowerCase()}: ${f.remaining} due by ${r.p.target?.name}; at ${fmtN(f.pace)} a week the last one is done ${fmtShort(f.ready!)}, against ${fmtShort(r.p.target?.day ?? 0)}.`;
  };
  return done(
    sentence,
    {
      kind: "bars",
      max,
      diverge: { left: "Days past the date", right: "Days to spare" },
      rows: rows.map((r) => ({
        id: r.p.id,
        label: r.p.short,
        sub: `${HEALTH_WORDS[r.key]} · ${fmtShort(r.p.target?.day ?? 0)}`,
        value: r.f!.spare!,
        display: r.f!.spare! >= 0 ? `${r.f!.spare} to spare` : `${-r.f!.spare!} past`,
        // Red runs past the date; amber has under 3 days to spare; room is calm.
        tone: r.f!.spare! < 0 ? "late" : r.f!.spare! < 3 ? "risk" : "plain",
        say: sayOf(r),
      })),
    },
    "Projects run worst first: how each is doing, as its lead set it, then the gap between the big date and the day its work due by then runs out, at the last 7 days' pace. Red runs past the date; amber has under 3 days to spare.",
    {
      head: ["", "How it is doing", "Due by date", "Done at pace"],
      rows: rows.map((r) => ({ id: r.p.id, label: r.p.short, project: r.p.id, cells: [HEALTH_WORDS[r.key], String(r.f!.remaining), fmtShort(r.f!.ready!)], marks: [r.p.id] })),
      foot: early.length ? `${list(early.map((r) => r.p.short))} ${early.length === 1 ? "is" : "are"} left out of the chart: too early to tell, so no forecast yet.` : undefined,
    },
    follow,
  );
}

const numberWord = (n: number) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);

function changed(p: ProjectData, follow: string[]): Answer {
  const w = p.weeks;
  const rows = [
    { id: "c-done", label: "Finished", a: w.finished[12], b: w.finished[13], good: w.finished[13] === w.finished[12] ? null : w.finished[13] > w.finished[12] },
    { id: "c-added", label: "Added", a: w.added[12], b: w.added[13], good: null },
    { id: "c-moved", label: "Dates moved", a: w.moved[12], b: w.moved[13], good: w.moved[13] === w.moved[12] ? null : w.moved[13] < w.moved[12] },
    { id: "c-late", label: "Late", a: p.lateLastWeek, b: p.late.length, good: p.late.length === p.lateLastWeek ? null : p.late.length < p.lateLastWeek },
    { id: "c-wait", label: "Waiting on others", a: p.waitingLastWeek, b: p.waiting.length, good: p.waiting.length === p.waitingLastWeek ? null : p.waiting.length < p.waitingLastWeek },
  ];
  const better = rows.filter((r) => r.good === true).length;
  const worse = rows.filter((r) => r.good === false).length;
  const head = worse === 0 && better >= 3 ? "A better week on every count" : better > worse ? "A better week" : worse > better ? "A harder week" : "A mixed week";
  const phrase = (r: (typeof rows)[number]): Part[] => {
    const dir = r.b > r.a ? "up" : "down";
    switch (r.id) {
      case "c-done": {
        const best = Math.max(...w.finished.slice(0, 13));
        return ["you finished ", b(plural(r.b, "task"), [r.id]), r.b > best ? ", the most in 14 weeks" : `, ${dir} from ${r.a}`];
      }
      case "c-moved":
        if (r.b === 0) return [b("no dates moved", [r.id]), `, down from ${r.a}`];
        return [r.b < r.a && r.b <= 1 ? "only " : "", b(`${plural(r.b, "date")} moved`, [r.id]), `, ${dir} from ${r.a}`];
      case "c-late":
        return [b(`${plural(r.b, "task")} ${r.b === 1 ? "is" : "are"} late`, [r.id]), `, ${dir} from ${r.a}`];
      default:
        return [b(`${r.b} waiting on others`, [r.id]), `, ${dir} from ${r.a}`];
    }
  };
  const moving = rows.filter((r) => r.id !== "c-added" && r.a !== r.b);
  const pick = (head.startsWith("A better") ? moving.filter((r) => r.good) : head.startsWith("A harder") ? moving.filter((r) => r.good === false) : moving)
    .sort((x, y) => Math.abs(y.b - y.a) / Math.max(y.a, 1) - Math.abs(x.b - x.a) / Math.max(x.a, 1))
    .slice(0, 2);
  if (pick.length < 2) {
    const extra = rows.find((r) => r.id === "c-done" && !pick.includes(r));
    if (extra) pick.unshift(extra);
  }
  const sentence: Part[] = [`${head}: `, ...phrase(pick[0])];
  if (pick[1]) sentence.push(", and ", ...phrase(pick[1]));
  sentence.push(".");
  return done(
    sentence,
    {
      kind: "slope",
      left: `Last week`,
      right: `This week`,
      rows: rows.map((r) => ({
        ...r,
        say: `${r.label}: ${r.a} last week, ${r.b} this week${r.good === null ? "" : r.good ? ", which is better" : ", which is worse"}.`,
      })),
    },
    `Each line joins last week (${fmtShort(weekStart(12))}) to this week (${fmtShort(weekStart(13))}). Red lines are the counts that got worse.`,
    { head: ["", "Last week", "This week"], rows: rows.map((r) => ({ id: r.id, label: r.label, cells: [String(r.a), String(r.b)], marks: [r.id] })) },
    follow,
  );
}

function whoBusy(p: ProjectData, follow: string[]): Answer {
  const ppl = [...p.people].sort((a, z) => z.open - a.open || z.dueNext - a.dueNext);
  const top = ppl[0];
  const others = ppl.slice(1);
  const othersSum = others.reduce((n, x) => n + x.open, 0);
  const total = ppl.reduce((n, x) => n + x.open, 0) + p.unassigned;
  const minOpen = Math.min(...ppl.map((x) => x.open));
  const light = ppl.filter((x) => x.open === minOpen);
  const lightText = light.length > 1 ? `${list(light.map((x) => x.name))} have the most room, with ${minOpen} each.` : `${light[0].name} has the most room, with ${minOpen}.`;
  let sentence: Part[];
  if (p.status === "all") {
    const second = ppl[1];
    sentence = [
      b(`${top.name} has the most on across every project`, [top.id]),
      `: ${top.open} open${top.dueNext ? `, ${top.dueNext} due next week` : ""}. Next is ${second.name}, with ${second.open}.`,
    ];
  } else if (total < 8 || p.status === "thin") {
    sentence = ["Nobody has much on yet. ", b(`${top.name} has ${top.open} open`, [top.id]), ` and ${list(others.map((x) => `${x.name} has ${x.open}`))}.`];
  } else if (top.open > othersSum) {
    sentence = [
      b(`${top.name} has too much on`, [top.id]),
      `: ${top.open} open, ${top.dueNext ? `${top.dueNext} of them due next week` : "none due next week"}, more than ${others.length === 1 ? others[0].name : `${list(others.map((x) => x.name))} together`}. `,
      lightText,
    ];
  } else if (top.open / total >= 0.45) {
    sentence = [b(`${top.name} has half of the remaining work`, [top.id]), `: ${top.open} of ${total} open tasks, ${top.dueNext} due next week. `, lightText];
  } else if (top.open >= 1.5 * ppl[1].open) {
    sentence = [b(`${top.name} has the most on`, [top.id]), `: ${top.open} open, ${top.dueNext} due next week. `, lightText];
  } else {
    const tied = ppl.filter((x) => x.open === top.open);
    sentence = [
      "Nobody is overloaded. ",
      b(tied.length > 1 ? `${list(tied.map((x) => x.name))} have the most` : `${top.name} has the most`, tied.map((x) => x.id)),
      tied.length > 1 ? `, ${top.open} each, and ` : `, ${top.open}, and `,
      light.length > 1 ? `${list(light.map((x) => x.name))} have room with ${minOpen} each.` : `${light[0].name} has room with ${minOpen}.`,
    ];
  }
  // Everyone with work here, so any name the answer suggests is on the chart.
  const shown = ppl;
  const max = Math.max(1, ...shown.map((x) => x.open));
  const emphasise = p.status === "all" || top.open > othersSum || top.open / total >= 0.45 || top.open >= 1.5 * ppl[1].open;
  return done(
    sentence,
    {
      kind: "bars",
      max,
      legend: emphasise
        ? [
            { tone: "key", alt: "plain", label: "Due next week" },
            { tone: "soft", alt: "idle", label: "Later or no date" },
          ]
        : [
            { tone: "plain", label: "Due next week" },
            { tone: "idle", label: "Later or no date" },
          ],
      rows: shown.map((x) => {
        const hot = emphasise && x.id === top.id;
        return {
          id: x.id,
          label: x.name,
          sub: x.project,
          value: x.open,
          display: `${x.open} open`,
          tone: hot ? "key" : "plain",
          segs: [
            { value: x.dueNext, tone: hot ? "key" : "plain" },
            { value: x.open - x.dueNext, tone: hot ? "soft" : "idle" },
          ],
          say: `${x.name}${x.project ? ` (${x.project})` : ""}: ${x.open} open, ${x.dueNext} due next week, ${x.finished4w} finished in the last 4 weeks.`,
        };
      }),
    },
    "Each bar is one person’s open tasks. The stronger shade, on the left, is what is due next week.",
    {
      head: ["", "Open", "Due next week", "Finished in 4 weeks"],
      rows: shown.map((x) => ({ id: x.id, label: x.name, sub: x.project, cells: [String(x.open), String(x.dueNext), String(x.finished4w)], marks: [x.id] })),
      foot: p.unassigned ? `${plural(p.unassigned, "open task")} ${p.unassigned === 1 ? "has" : "have"} nobody on ${p.unassigned === 1 ? "it" : "them"}.` : undefined,
    },
    follow,
  );
}

const NEXT_MONDAY = 3;

function firstNextWeek(p: ProjectData, follow: string[]): Answer {
  const picks = p.picks;
  let sentence = p.pickSentence;
  if (p.status === "all") {
    sentence = ["Start with "];
    const firsts = p.members.map((cp) => ({ cp, first: cp.pickSentence.find((x) => typeof x !== "string"), pick: picks.find((k) => k.project === cp.short) })).filter(
      (x): x is { cp: ProjectData; first: { b: string; marks: string[] }; pick: NonNullable<typeof x.pick> } => !!x.first && typeof x.first !== "string" && !!x.pick,
    );
    // Late work first, then the soonest: three are named, the chart holds the rest.
    const lateness = (why: string) => (/late/.test(why) ? parseInt(why, 10) || 1 : 0);
    const named = [...firsts].sort((a, z) => lateness(z.pick.why) - lateness(a.pick.why) || a.pick.day - z.pick.day).slice(0, 3);
    named.forEach(({ cp, first, pick }, i) => {
      if (i) sentence.push(i === named.length - 1 ? " and " : ", ");
      sentence.push(b(first.b, [pick.id], { task: pick.task }), " in ", b(cp.short, [], { project: cp.id }));
    });
    sentence.push(
      firsts.length > named.length
        ? `: the most pressing of ${firsts.length}, one from each project with something due.`
        : ": each is the most pressing thing in its project.",
    );
  }
  const days = Array.from({ length: 5 }, (_, i) => ({ label: weekdayShort(NEXT_MONDAY + i), date: fmtShort(NEXT_MONDAY + i) }));
  const ranked = [...picks].sort((a, z) => (a.rank ?? 9) - (z.rank ?? 9) || a.day - z.day);
  return done(
    sentence,
    {
      kind: "week",
      days,
      items: picks.map((k, i) => ({
        ...k,
        rank: p.status === "all" ? i + 1 : k.rank,
        color: toneIn(p, k.project),
        say: `${k.title}: ${fmtDay(NEXT_MONDAY + k.day)}, ${k.person}. ${k.why}.`,
      })),
    },
    `Next week, ${fmtShort(NEXT_MONDAY)} to ${fmtShort(NEXT_MONDAY + 4)}. Numbered tasks are where to start; the rest can follow.`,
    {
      head: ["", "When", "Who"],
      rows: ranked.map((k) => ({ id: k.id, label: k.title, task: k.task, sub: k.project ? `${k.why} · ${k.project}` : k.why, cells: [weekdayShort(NEXT_MONDAY + k.day), k.person], marks: [k.id] })),
    },
    follow,
  );
}

function slipping(p: ProjectData, follow: string[]): Answer {
  // With only a few moved dates there is no pattern to rank: name them and show them.
  if (p.moved.length <= 3 || !p.groups.some((g) => g.recentMoved >= 3)) {
    const a = thoseTasks(p, follow);
    const rows = [...p.moved].sort((x, z) => z.lastMovedOn - x.lastMovedOn);
    const shown = rows.slice(0, 3);
    const sentence: Part[] = [`Not much slips${p.status === "all" ? "" : ` in ${p.short}`}: only `, b(plural(rows.length, "task"), rows.map((r) => r.id)), ` ${rows.length === 1 ? "has" : "have"} had a date moved${rows.length > shown.length ? ", most lately " : ": "}`];
    shown.forEach((r, i) => {
      if (i) sentence.push(i === shown.length - 1 ? (shown.length > 2 ? ", and " : " and ") : ", ");
      sentence.push(b(quoted(r.title), [r.id], { task: r.task }), `${inP(p, r.project)}, ${fmtShort(r.from)} to ${fmtShort(r.hops[r.hops.length - 1])}`);
    });
    sentence.push(".");
    return { ...a, sentence, plain: plainOf(sentence) };
  }
  // Groups with fewer than 3 tasks lately would rank on chance; they sit at the bottom.
  const enough = (g: (typeof p.groups)[number]) => (g.recent >= 3 ? 1 : 0);
  const gs = p.groups.filter((g) => g.recent > 0).sort((a, z) => enough(z) - enough(a) || z.recentMoved / z.recent - a.recentMoved / a.recent || z.moves - a.moves);
  const top = gs[0];
  const second = gs[1];
  const r1 = top.recentMoved / top.recent;
  const r2 = second ? second.recentMoved / second.recent : 0;
  const sentence: Part[] = [
    b(`${top.name} ${keep(top.name)} slipping`, [top.id]),
    ": ",
    b(`${top.recentMoved} of ${top.recent}`, [top.id]),
    ` ${top.noun} from the last 8 weeks had their date moved at least once.`,
  ];
  if (r2 < r1 / 2) sentence.push(" Nothing else slips half as often.");
  else if (r2 < r1 * 0.8) sentence.push(" Nothing else slips as often.");
  else sentence.push(" ", b(second.name, [second.id]), ` ${isPlural(second.name) ? "are" : "is"} close behind, at ${second.recentMoved} of ${second.recent}.`);
  return done(
    sentence,
    {
      kind: "bars",
      max: 100,
      share: true,
      rows: gs.map((g) => ({
        id: g.id,
        label: g.name,
        value: Math.round((g.recentMoved / g.recent) * 100),
        display: `${g.recentMoved} of ${g.recent}`,
        tone: g.id === top.id ? "key" : "plain",
        color: p.status === "all" ? g.tone : undefined,
        say: `${g.name}: ${g.recentMoved} of ${g.recent} from the last 8 weeks moved at least once, ${plural(g.moves, "move")} in all.`,
      })),
    },
    `Bar length is the share of tasks in each ${p.groupWord} from the last 8 weeks (open now, or finished in that time) whose date moved at least once. A full bar would be all of them.`,
    {
      head: ["", "Moved at least once", "Moves in all"],
      rows: gs.map((g) => ({ id: g.id, label: g.name, cells: [`${g.recentMoved} of ${g.recent}`, String(g.moves)], marks: [g.id] })),
    },
    follow,
  );
}

function whichOutsider(p: ProjectData, follow: string[]): Answer {
  const os = [...p.outsiders].sort((a, z) => z.moves - a.moves || z.moved - a.moved).slice(0, 6);
  const top = os[0];
  const next = os[1];
  const what = top.moved === top.tasks ? (top.tasks === 1 ? "The one task" : top.tasks === 2 ? "Both tasks" : `All ${top.tasks} tasks`) : `${top.moved} of the ${top.tasks} tasks`;
  const role = top.role && top.role.toLowerCase() !== top.name.toLowerCase() ? `, the ${top.role}${inP(p, top.project)},` : inP(p, top.project);
  const sentence: Part[] = [
    b(top.name, [top.id]),
    `${role} ${isPlural(top.name) ? "slip" : "slips"} most. `,
    b(what, [top.id]),
    ` ${top.tasks === 1 ? "that waits" : "that wait"} on ${top.name} moved, ${top.moves === 1 ? "once" : top.moved === 1 ? times(top.moves) : `${top.moves} times between them`}.`,
  ];
  if (next) sentence.push(next.moves === 0 ? " Nobody else’s dates moved." : next.moves < top.moves ? ` Nobody else moved a date more than ${times(next.moves)}.` : ` ${next.name} ${isPlural(next.name) ? "are" : "is"} level, with ${plural(next.moves, "move")}.`);
  return done(
    sentence,
    {
      kind: "bars",
      max: top.moves,
      rows: os.map((o) => ({
        id: o.id,
        label: o.name,
        sub: o.project ? `${o.role} · ${o.project}` : o.role,
        value: o.moves,
        display: o.moves ? plural(o.moves, "move") : "No moves",
        tone: o.id === top.id ? "key" : "plain",
        say: o.moves
          ? `${o.name}: ${o.moved} of ${plural(o.tasks, "task")} moved, ${plural(o.moves, "time")} in all, last on ${fmtShort(o.last)}.`
          : `${o.name}: ${plural(o.tasks, "task")}, none moved.`,
      })),
    },
    `Each bar is one ${p.outsiderWord.one}${p.status === "all" ? ", across every project" : ""}: the date moves on tasks that waited on them.`,
    {
      head: ["", "Tasks", "Moved", "Last moved"],
      rows: os.map((o) => ({ id: o.id, label: o.name, sub: o.project ? `${o.role} · ${o.project}` : o.role, cells: [String(o.tasks), String(o.moved), o.moves ? fmtShort(o.last) : "Never"], marks: [o.id] })),
    },
    follow,
  );
}

function activeFrom(p: ProjectData) {
  const w = p.weeks;
  const i = w.added.findIndex((n, k) => n + w.finished[k] > 0);
  return Math.max(0, i);
}

function gettingBetter(p: ProjectData, follow: string[]): Answer {
  const m = p.weeks.moved;
  const start = activeFrom(p);
  const recent = m.slice(10).reduce((a, x) => a + x, 0) / 4;
  const before = m.slice(start, 10);
  const prior = before.reduce((a, x) => a + x, 0) / Math.max(before.length, 1);
  const ratio = recent / Math.max(prior, 0.01);
  const rA = b(recent === 1 ? "once a week" : `${fmtN(recent)} times a week`, ["avg-recent"]);
  const rB = b(`${fmtN(prior)} a week`, ["avg-before"]);
  const sentence: Part[] =
    ratio <= 0.85
      ? ["Yes. Dates moved ", rA, " over the last 4 weeks, ", ratio <= 0.55 ? "half the " : "down from ", rB, " before that."]
      : ratio >= 1.15
        ? ["No, it is getting worse. Dates moved ", rA, " over the last 4 weeks, up from ", rB, " before that."]
        : ["About the same. Dates moved ", rA, " over the last 4 weeks, against ", rB, " before that."];
  const worst = m.indexOf(Math.max(...m));
  return done(
    sentence,
    {
      kind: "columns",
      unit: "dates moved",
      cols: m.map((v, i) => ({
        id: `wk${i}`,
        label: fmtShort(weekStart(i)),
        value: v,
        tone: i >= 10 ? "key" : i < start ? "idle" : "plain",
        say: `Week of ${fmtShort(weekStart(i))}: ${plural(v, "date")} moved.`,
      })),
      lines: [
        { id: "avg-before", from: start, to: 9, value: prior, label: `${fmtN(prior)} a week`, say: `Weeks ${fmtShort(weekStart(start))} to ${fmtShort(weekStart(9))}: ${fmtN(prior)} a week on average.` },
        { id: "avg-recent", from: 10, to: 13, value: recent, label: `${fmtN(recent)} a week`, say: `Last 4 weeks: ${fmtN(recent)} a week on average.` },
      ],
    },
    "Each column is one week: how many due dates were moved. The lines are the average before and during the last 4 weeks.",
    {
      head: ["", "Dates moved"],
      rows: [
        { id: "b1", label: "This week", cells: [String(m[13])], marks: ["wk13"] },
        { id: "b2", label: "Last 4 weeks, a week", cells: [fmtN(recent)], marks: ["avg-recent"] },
        { id: "b3", label: "Before that, a week", cells: [fmtN(prior)], marks: ["avg-before"] },
        { id: "b4", label: `Most in one week (${fmtShort(weekStart(worst))})`, cells: [String(m[worst])], marks: [`wk${worst}`] },
        { id: "b5", label: "All moves in 14 weeks", cells: [String(m.reduce((a, x) => a + x, 0))] },
      ],
    },
    follow,
  );
}

function thoseTasks(p: ProjectData, follow: string[]): Answer {
  const rows = [...p.moved].sort((a, z) => z.hops.length - a.hops.length || z.hops[z.hops.length - 1] - z.from - (a.hops[a.hops.length - 1] - a.from)).slice(0, 7);
  const top = rows[0];
  const last = (r: (typeof rows)[number]) => r.hops[r.hops.length - 1];
  const totalMoves = rows.reduce((n, r) => n + r.hops.length, 0);
  const avgPush = rows.reduce((n, r) => n + (last(r) - r.from), 0) / rows.length;
  const once = rows.every((r) => r.hops.length === 1);
  const furthest = [...rows].sort((a, z) => last(z) - z.from - (last(a) - a.from))[0];
  const sentence: Part[] = once
    ? [
        b(plural(rows.length, "task"), rows.map((r) => r.id)),
        ` ${rows.length === 1 ? "has" : "have"} had a date moved, ${rows.length === 1 ? "once" : "once each"}. `,
        b(quoted(furthest.title), [furthest.id], { task: furthest.task }),
        `${inP(p, furthest.project)} moved furthest: ${plural(last(furthest) - furthest.from, "day")}, from ${fmtShort(furthest.from)} to ${fmtShort(last(furthest))}.`,
      ]
    : [
        b(quoted(top.title), [top.id], { task: top.task }),
        `${inP(p, top.project)} moved most: ${times(top.hops.length)}, from ${fmtShort(top.from)} to ${fmtShort(last(top))}. Together the ${rows.length} tasks moved `,
        b(plural(totalMoves, "time"), rows.map((r) => r.id)),
        `, and each ended up about ${plural(Math.round(avgPush), "day")} later than first planned.`,
      ];
  const all = rows.flatMap((r) => [r.from, ...r.hops]);
  const target = p.target && p.target.day <= Math.max(...all) + 10 ? p.target : null;
  return done(
    sentence,
    {
      kind: "moves",
      rows: rows.map((r) => ({
        id: r.id,
        label: r.title,
        sub: r.project ? `${r.who} · ${r.project}` : r.who,
        from: r.from,
        hops: r.hops,
        say: `${r.title} moved ${times(r.hops.length)}, last on ${fmtShort(r.lastMovedOn)}. First due ${fmtShort(r.from)}, now ${fmtShort(last(r))}.`,
      })),
      min: Math.min(...all) - 2,
      max: Math.max(...all, target?.day ?? -99) + 2,
      target,
    },
    "Each row is a task. The hollow ring is the first date it was given, each dot a new date, the solid dot where it is due now.",
    {
      head: ["", "Moves", "First due", "Due now"],
      rows: rows.map((r) => ({ id: r.id, label: r.title, task: r.task, sub: r.project ? `${r.who} · ${r.project}` : r.who, cells: [String(r.hops.length), fmtShort(r.from), fmtShort(last(r))], marks: [r.id] })),
    },
    follow,
  );
}

function doneWeek(p: ProjectData, follow: string[]): Answer {
  const f = p.weeks.finished;
  const now = f[13];
  const start = activeFrom(p);
  let since = -1;
  for (let j = 12; j >= start; j--)
    if (f[j] >= now) {
      since = j;
      break;
    }
  const tail =
    p.status === "thin"
      ? ""
      : since === -1
        ? `, your best week in ${14 - start} weeks`
        : since === 12
          ? `, against ${f[12]} last week`
          : `, your best week since the week of ${fmtShort(weekStart(since))}`;
  const four = f.slice(10).reduce((a, x) => a + x, 0);
  const named = p.doneThisWeek.slice(0, 2).map((t) => `“${t}”`);
  const sentence: Part[] = [
    "You finished ",
    b(`${plural(now, "task")} this week`, ["wk13"]),
    tail,
    named.length ? `, including ${list(named)}.` : ".",
  ];
  if (p.status !== "thin") sentence.push(" That makes ", b(`${four} in the last 4 weeks`, ["wk10", "wk11", "wk12", "wk13"]), ".");
  if (p.status === "all") sentence.unshift(`Across your ${p.members.length} active projects, `);
  if (p.status === "all") sentence[1] = "you finished ";
  return done(
    sentence,
    {
      kind: "columns",
      unit: "finished",
      cols: f.map((v, i) => ({
        id: `wk${i}`,
        label: fmtShort(weekStart(i)),
        value: v,
        tone: i === 13 ? "key" : i < start ? "idle" : "plain",
        say: `Week of ${fmtShort(weekStart(i))}: ${plural(v, "task")} finished.`,
      })),
    },
    "Each column is one week: how many tasks were marked done.",
    {
      head: ["Finished this week"],
      rows: p.doneThisWeek.slice(0, 5).map((t, i) => ({ id: `d${i}`, label: t, cells: [], marks: ["wk13"] })),
      foot: p.doneThisWeek.length > 5 ? `And ${p.doneThisWeek.length - 5} more.` : undefined,
    },
    follow,
  );
}

function waitingLongest(p: ProjectData, follow: string[]): Answer {
  const ws = [...p.waiting].sort((a, z) => z.days - a.days).slice(0, 6);
  const top = ws[0];
  const threshold = 4;
  const long = ws.slice(1).filter((x) => x.days >= threshold);
  const sentence: Part[] = [
    "The longest wait is ",
    b(`“${top.title}”`, [top.id], { task: top.task }),
    `${inP(p, top.project)}: ${top.days} days on ${top.on}${top.on.endsWith(".") ? "" : "."} `,
    long.length
      ? b(`${long.length === 1 ? "1 other has" : `${long.length} others have`} waited ${threshold} days or more`, long.map((x) => x.id))
      : `Everything else has waited less than ${threshold} days`,
    ".",
  ];
  return done(
    sentence,
    {
      kind: "bars",
      max: top.days,
      rows: ws.map((x) => ({
        id: x.id,
        label: x.title,
        sub: `on ${x.on}${x.project ? ` · ${x.project}` : ""}`,
        value: x.days,
        display: plural(x.days, "day"),
        tone: x.id === top.id ? "key" : x.days >= threshold ? "plain" : "idle",
        say: `${x.title}: waiting ${plural(x.days, "day")} on ${x.on}.`,
      })),
    },
    "Each bar is how many days a task has been waiting on someone, counted from when it was sent.",
    { head: ["", "Waiting on", "Days"], rows: ws.map((x) => ({ id: x.id, label: x.title, task: x.task, sub: x.project, cells: [x.on, String(x.days)], marks: [x.id] })) },
    follow,
  );
}

function whoDid(p: ProjectData, follow: string[]): Answer {
  const ppl = [...p.people].sort((a, z) => z.finished4w - a.finished4w).slice(0, 6);
  const total = p.people.reduce((n, x) => n + x.finished4w, 0);
  const best = ppl[0].finished4w;
  const tops = ppl.filter((x) => x.finished4w === best);
  const busiest = [...p.people].sort((a, z) => z.open - a.open)[0];
  const sentence: Part[] =
    tops.length > 1
      ? [b(`${list(tops.map((x) => x.name))} finished the most`, tops.map((x) => x.id)), `, ${best} each of the last ${total}.`]
      : [b(`${tops[0].name}${inP(p, tops[0].project)} finished the most`, [tops[0].id]), `: ${best} of the last ${total}.`];
  if (p.status !== "done" && busiest.open > 0 && !tops.includes(busiest) && busiest.finished4w < best) sentence.push(` ${busiest.name} finished ${busiest.finished4w} while holding the most open work.`);
  return done(
    sentence,
    {
      kind: "bars",
      max: best,
      rows: ppl.map((x) => ({
        id: x.id,
        label: x.name,
        sub: x.project,
        value: x.finished4w,
        display: `${x.finished4w} finished`,
        tone: x.finished4w === best ? "key" : "plain",
        say: `${x.name}: ${x.finished4w} finished in the last 4 weeks, ${x.open} still open.`,
      })),
    },
    `Each bar is how many tasks that person finished in the last 4 weeks (${fmtShort(weekStart(10))} to today).`,
    { head: ["", "Finished", "Still open"], rows: ppl.map((x) => ({ id: x.id, label: x.name, sub: x.project, cells: [String(x.finished4w), String(x.open)], marks: [x.id] })) },
    follow,
  );
}

function left(p: ProjectData, follow: string[]): Answer {
  const gs = [...p.groups].sort((a, z) => z.open - a.open);
  const total = gs.reduce((n, g) => n + g.open, 0);
  const top = gs[0];
  const sentence: Part[] = [b(`${total} tasks are left`, gs.map((g) => g.id)), ". ", b(top.name, [top.id]), ` ${has(top.name)} the most, with ${top.open}`];
  const soon = p.upcoming.filter((u) => u.day <= 7).length;
  sentence.push(soon ? `, and ${soon} of the ${total} are due in the next 7 days.` : ".");
  return done(
    sentence,
    {
      kind: "bars",
      max: top.open,
      rows: gs.map((g) => ({
        id: g.id,
        label: g.name,
        value: g.open,
        display: `${g.open} left`,
        tone: g.id === top.id ? "key" : "plain",
        color: p.status === "all" ? g.tone : undefined,
        say: `${g.name}: ${g.open} left, ${g.done} done.`,
      })),
    },
    `Each bar is the open tasks in one ${p.groupWord}.`,
    { head: ["", "Left", "Done"], rows: gs.map((g) => ({ id: g.id, label: g.name, project: p.status === "all" ? g.id.replace(/^g-/, "") : undefined, cells: [String(g.open), String(g.done)], marks: [g.id] })) },
    follow,
  );
}

function comingUp(p: ProjectData, follow: string[]): Answer {
  const up = p.upcoming.filter((u) => u.day >= 1 && u.day <= 14);
  const counts = new Map<number, number>();
  up.forEach((u) => counts.set(u.day, (counts.get(u.day) ?? 0) + 1));
  const [busyDay, busyN] = [...counts.entries()].sort((a, z) => z[1] - a[1] || a[0] - z[0])[0];
  const busy = up.filter((u) => u.day === busyDay).map((u) => u.id);
  const sentence: Part[] = [b(`${plural(up.length, "task")} ${up.length === 1 ? "is" : "are"} due in the next two weeks`, up.map((u) => u.id))];
  if (busyN > 1) sentence.push(", and the busiest day is ", b(fmtDay(busyDay), busy), `, with ${busyN}.`);
  else sentence.push(`, the first on ${fmtDay(Math.min(...up.map((u) => u.day)))}.`);
  const lanes = [...new Set(up.map((u) => u.lane))];
  const laneOrder = p.groups.map((g) => g.name).filter((n) => lanes.includes(n));
  const orderedLanes = [...laneOrder, ...lanes.filter((l) => !laneOrder.includes(l))];
  return done(
    sentence,
    {
      kind: "dots",
      lanes: orderedLanes.map((l) => ({ id: l, label: l, color: toneIn(p, l) })),
      min: 0,
      max: 15,
      axis: "Due date",
      ticks: [
        { x: 0, label: "Today" },
        { x: 3, label: `Mon ${fmtShort(3)}` },
        { x: 10, label: `Mon ${fmtShort(10)}` },
      ],
      points: up.map((u) => ({
        id: u.id,
        lane: u.lane,
        x: u.day,
        label: u.title,
        tone: u.day === busyDay && busyN > 1 ? "key" : "plain",
        color: toneIn(p, u.project),
        say: `${u.title}${u.project ? ` (${u.project})` : ""}: due ${fmtDay(u.day)}.`,
      })),
    },
    "Each dot is a task placed on the day it is due. Rows split them by group; weekends are shaded.",
    {
      head: ["", "Due in the next two weeks"],
      rows: orderedLanes.map((l) => ({ id: l, label: l, cells: [String(up.filter((u) => u.lane === l).length)], marks: up.filter((u) => u.lane === l).map((u) => u.id) })),
    },
    follow,
  );
}

const REASON_PHRASE: Record<ReasonId, string> = {
  reply: "waiting on a reply",
  start: "not started",
  tight: "started but not finished",
};

function late(p: ProjectData, follow: string[]): Answer {
  const ls = [...p.late].sort((a, z) => z.daysLate - a.daysLate);
  const byReason = new Map<ReasonId, number>();
  ls.forEach((l) => byReason.set(l.reason, (byReason.get(l.reason) ?? 0) + 1));
  const [mainReason, mainN] = [...byReason.entries()].sort((a, z) => z[1] - a[1])[0];
  const mainIds = ls.filter((l) => l.reason === mainReason).map((l) => l.id);
  const top = ls[0];
  const lead = b(`${plural(ls.length, "task")} ${ls.length === 1 ? "is" : "are"} late`, ls.map((l) => l.id));
  const sentence: Part[] =
    mainN * 2 > ls.length || ls.length === 1
      ? [
          lead,
          ", and ",
          b(mainN === ls.length ? (ls.length === 1 ? "it" : ls.length === 2 ? "both" : "all of them") : `${mainN} of them`, mainIds),
          ` ${mainN === 1 ? "is" : "are"} ${REASON_PHRASE[mainReason]}.`,
        ]
      : [
          lead,
          ": ",
          ...[...byReason.entries()].flatMap(([r, n], i, arr): Part[] => [
            i === 0 ? "" : i === arr.length - 1 ? " and " : ", ",
            b(`${n} ${REASON_PHRASE[r]}`, ls.filter((l) => l.reason === r).map((l) => l.id)),
          ]),
          ".",
        ];
  sentence.push(" The furthest over is ", b(top.name ?? `“${top.title}”`, [top.id], { task: top.task }), `${inP(p, top.project)}, at ${plural(top.daysLate, "day")}.`);
  const reasons = (Object.keys(REASONS) as ReasonId[]).filter((r) => byReason.has(r));
  const max = Math.max(...ls.map((l) => l.daysLate));
  return done(
    sentence,
    {
      kind: "dots",
      lanes: reasons.map((r) => ({ id: r, label: REASONS[r] })),
      min: 0,
      max: max + 1,
      axis: "Days late",
      ticks: [...new Set([0, Math.min(...ls.map((l) => l.daysLate)), max])].map((x) => ({ x, label: x === 0 ? "Due" : plural(x, "day") })),
      points: ls.map((l) => ({
        id: l.id,
        lane: l.reason,
        x: l.daysLate,
        label: l.title,
        // Every late task is red; the sentence lights the main reason's dots.
        tone: "late",
        say: `${l.title}${l.project ? ` (${l.project})` : ""}: ${plural(l.daysLate, "day")} late, ${REASON_PHRASE[l.reason]}. ${l.person} has it.`,
      })),
    },
    "Each dot is a late task, placed by how many days it is over. Rows are the reason it is stuck.",
    {
      head: ["", "Late", "Most days over"],
      rows: reasons.map((r) => {
        const xs = ls.filter((l) => l.reason === r);
        return { id: r, label: REASONS[r], cells: [String(xs.length), String(Math.max(...xs.map((l) => l.daysLate)))], marks: xs.map((l) => l.id) };
      }),
    },
    follow,
  );
}

const TIME_PARTS: { id: "waiting" | "doing" | "notStarted"; label: string; mid: string; tone: Tone }[] = [
  { id: "waiting", label: "Waiting on others", mid: "waiting on others", tone: "wait" },
  { id: "doing", label: "Doing the work", mid: "doing the work", tone: "doing" },
  { id: "notStarted", label: "Not started", mid: "not started", tone: "idle" },
];

function timeGoes(p: ProjectData, follow: string[]): Answer {
  const parts = TIME_PARTS.filter((x) => x.id !== "notStarted").map((x) => ({ ...x, pct: p.time[x.id], days: p.timeDays[x.id] }));
  const sorted = [...parts].sort((a, z) => z.pct - a.pct);
  const top = sorted[0];
  const doing = parts[1];
  const sentence: Part[] =
    top.id === "waiting"
      ? [
          b("Waiting on others", ["waiting"]),
          ` takes most of the time: once a task is started, ${top.pct}% of its days go on waiting for a reply. `,
          b("Doing the work", ["doing"]),
          ` is only ${doing.pct}%.`,
        ]
      : [
          p.status === "all" ? "most of the time goes on " : "Most of the time goes on ",
          b(top.mid, [top.id]),
          `: ${top.pct}% of the days a task is under way. `,
          b(cap(sorted[1].mid), [sorted[1].id]),
          ` takes the other ${sorted[1].pct}%, about ${fmtN(sorted[1].days)} days a task.`,
        ];
  if (p.status === "all") sentence.unshift(`Across your ${p.members.length} active projects, `);
  if (p.status === "all" && typeof sentence[1] === "object") sentence[1] = b(sentence[1].b.charAt(0).toLowerCase() + sentence[1].b.slice(1), sentence[1].marks);
  return done(
    sentence,
    {
      kind: "waffle",
      parts: parts.map((x) => ({ id: x.id, label: x.label, pct: x.pct, tone: x.tone, say: `${x.label}: ${x.pct} of every 100 days a task is under way, about ${fmtN(x.days)} days for each task.` })),
    },
    "Each square is 1% of the days tasks spent under way over the last 14 weeks, from starting to finishing.",
    {
      head: ["", "Share of time", "Days per task"],
      rows: parts.map((x) => ({ id: x.id, label: x.label, cells: [`${x.pct}%`, fmtN(x.days)], marks: [x.id] })),
    },
    follow,
  );
}

function howLong(p: ProjectData, follow: string[]): Answer {
  const gs = p.groups.filter((g) => g.done > 0).sort((a, z) => z.median - a.median);
  const top = gs[0];
  const doneN = gs.reduce((n, g) => n + g.done, 0);
  const typical = Math.round(gs.reduce((n, g) => n + g.median * g.done, 0) / doneN);
  const ratio = top.median / typical;
  const word = p.groupWord;
  const sentence: Part[] = [b(`${top.says} ${top.median} days`, [top.id]), ` on average, the longest ${word}`];
  if (ratio >= 1.8) sentence.push(`: about ${ratio >= 2.6 ? "three times" : "twice"} as long as most things, which take `, b(`${typical} days`, ["typical"]), ".");
  else sentence.push(". Most tasks take about ", b(plural(typical, "day"), ["typical"]), ".");
  const max = Math.max(...gs.map((g) => g.p75)) + 1;
  return done(
    sentence,
    {
      kind: "range",
      max,
      typical,
      rows: gs.map((g) => ({
        id: g.id,
        label: g.name,
        p25: g.p25,
        median: g.median,
        p75: g.p75,
        tone: g.id === top.id ? "key" : "plain",
        color: p.status === "all" ? g.tone : undefined,
        say: `${g.name}: usually ${plural(g.median, "day")}, most between ${g.p25} and ${g.p75}, from ${g.done} finished tasks.`,
      })),
    },
    "The dot is the usual number of days from starting a task to finishing it. The line covers the middle half: quicker and slower ones sit outside it.",
    {
      head: ["", "Usually", "Most take", "Finished"],
      rows: gs.map((g) => ({ id: g.id, label: g.name, cells: [plural(g.median, "day"), `${g.p25} to ${g.p75} days`, String(g.done)], marks: [g.id] })),
    },
    follow,
  );
}

/** A preview line for the empty state: what each answer will look like. */
export const PROMISES: Record<string, string> = {
  "on-course": "Whether you finish before your big date, and by how much",
  changed: "What moved since last week, in one line",
  "who-busy": "Who has the most on, and who has room",
  "first-next-week": "The three things to start with on Monday",
  slipping: "Which kind of task moves its date most",
  late: "What is late, and the reason it is stuck",
  "time-goes": "How much time is doing, and how much is waiting",
  "how-long": "How many days things usually take",
};
