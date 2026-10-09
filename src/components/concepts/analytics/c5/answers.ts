/*
 * Prepared answers. Each question reads the Project's sample data and states
 * the finding in one sentence, picks exactly one chart, and shows its working.
 * Bold phrases in the sentence name the chart marks they point at.
 */

import {
  COMPARED,
  REASONS,
  fmtDay,
  fmtLong,
  fmtShort,
  weekStart,
  weekdayShort,
  type Day,
  type Part,
  type ProjectData,
  type ReasonId,
} from "./data";
import { questionById } from "./questions";

export type Tone = "key" | "plain" | "soft" | "late" | "wait" | "doing" | "check" | "idle";

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
  | { kind: "bars"; rows: BarRow[]; max: number; share?: boolean; legend?: { tone: Tone; label: string }[]; diverge?: { left: string; right: string } }
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

export type Why = { head: string[]; rows: { id: string; label: string; sub?: string; cells: string[]; marks?: string[] }[]; foot?: string };

export type Answer = {
  status: "ok" | "thin";
  sentence: Part[];
  plain: string;
  chart: Chart | null;
  note: string;
  why: Why | null;
  follow: string[];
};

/* ── helpers ────────────────────────────────────────────────────────────── */

const b = (text: string, marks: string[] = []): Part => ({ b: text, marks });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtN = (n: number) => (Number.isInteger(round1(n)) ? String(round1(n)) : round1(n).toFixed(1));
const isPlural = (name: string) => /s$/.test(name) && !/(ss|us)$/.test(name);
const keep = (name: string) => (isPlural(name) ? "keep" : "keeps");
const has = (name: string) => (isPlural(name) ? "have" : "has");
const PROPER = /^(St|Riverside|Harbour|Round|Paula|Declan|Sinéad|Christmas)\b/;
export const lowerTitle = (t: string) => (PROPER.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const inP = (p: ProjectData, project?: string) => (p.status === "all" && project ? ` in ${project}` : "");
const projectTone = (name?: string) => COMPARED.find((x) => x.name === name)?.tone;

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
  const q = questionById(qid);
  if (p.thin[qid]) {
    const can = (id: string) => !p.thin[id] && id !== qid;
    const pool = [...q.follow, "first-next-week", "who-busy", "left", "coming-up", "done-week"].filter(can);
    return thin(p.thin[qid], [...new Set(pool)].slice(0, 3));
  }
  switch (qid) {
    case "on-course":
      return p.status === "all" ? onCourseAll(q.follow) : onCourse(p, q.follow);
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

function courseNumbers(p: ProjectData) {
  const s = p.weeks.dueBeforeLeft;
  const leftNow = s[13];
  const pace = (s[9] - s[13]) / 4;
  const finish = Math.round((leftNow / pace) * 7);
  const spare = (p.target?.day ?? 0) - finish;
  return { s, leftNow, pace, finish, spare };
}

function onCourse(p: ProjectData, follow: string[]): Answer {
  const t = p.target;
  if (!t) return thin("There is no big date on this Project yet, so there is nothing to be on course for.", follow);
  const { s, leftNow, pace, finish, spare } = courseNumbers(p);
  const need = leftNow / (t.day / 7);
  const sentence: Part[] =
    spare >= 0
      ? [
          "Yes, with ",
          b(`${plural(spare, "day")} to spare`, ["gap"]),
          `. ${leftNow} things are due before ${fmtLong(t.day)}, and at `,
          b(`your pace of ${fmtN(pace)} a week`, ["pace"]),
          " you clear them by ",
          b(fmtLong(finish), ["finish"]),
          ".",
        ]
      : [
          "Not at this pace. ",
          `${leftNow} things are due before ${fmtLong(t.day)}, and at `,
          b(`${fmtN(pace)} a week`, ["pace"]),
          " you clear them on ",
          b(fmtLong(finish), ["finish"]),
          ", ",
          b(`${plural(-spare, "day")} late`, ["gap"]),
          `. To make it you need ${fmtN(need)} a week.`,
        ];
  const series = s.map((value, i) => {
    const day = weekStart(i) + 4;
    return { id: `w${i}`, day, value, say: i === 13 ? `Today: ${value} still open.` : `Week of ${fmtShort(weekStart(i))}: ${value} still open at the end of the week.` };
  });
  return done(
    sentence,
    {
      kind: "course",
      series,
      pace,
      finish,
      target: t,
      paceFrom: 9,
      says: {
        pace: `Over the last 4 weeks the list went from ${s[9]} to ${s[13]}: ${fmtN(pace)} a week.`,
        finish: `At that pace the last one is done on ${fmtDay(finish)}.`,
        target: `${cap(t.name)} is on ${fmtDay(t.day)}, ${t.day} days away.`,
        gap: spare >= 0 ? `${plural(spare, "day")} between the last task and ${t.name}.` : `The last task lands ${plural(-spare, "day")} after ${t.name}.`,
      },
    },
    `The solid line is how many things due before ${fmtLong(t.day)} were still open each week. The dashed line carries on at your recent pace.`,
    {
      head: ["", ""],
      rows: [
        { id: "r1", label: `Due before ${fmtShort(t.day)} and still open`, cells: [String(leftNow)], marks: ["w13"] },
        { id: "r2", label: "Finished in the last 4 weeks", cells: [String(s[9] - s[13])], marks: ["pace"] },
        { id: "r3", label: "Pace", cells: [`${fmtN(pace)} a week`], marks: ["pace"] },
        { id: "r4", label: `Days until ${t.name}`, cells: [String(t.day)], marks: ["target"] },
        { id: "r5", label: "Last one done at this pace", cells: [fmtShort(finish)], marks: ["finish"] },
      ],
    },
    follow,
  );
}

function onCourseAll(follow: string[]): Answer {
  const rows = COMPARED.map((p) => ({ p, ...courseNumbers(p) }));
  const ok = rows.filter((r) => r.spare >= 0);
  const behind = rows.filter((r) => r.spare < 0);
  const sentence: Part[] = [
    b(`${ok.length} of ${rows.length} Projects`, ok.map((r) => r.p.id)),
    ` ${ok.length === 1 ? "is" : "are"} on course`,
  ];
  if (behind.length) {
    const w = behind.sort((a, z) => a.spare - z.spare)[0];
    sentence.push(". ", b(w.p.name, [w.p.id]), ` is not: at its pace it finishes ${plural(-w.spare, "day")} after ${w.p.target?.name}.`);
  } else sentence.push(".");
  const max = Math.max(...rows.map((r) => Math.abs(r.spare)), 7);
  return done(
    sentence,
    {
      kind: "bars",
      max,
      diverge: { left: "Days late", right: "Days to spare" },
      rows: rows.map((r) => ({
        id: r.p.id,
        label: r.p.name,
        sub: `${fmtShort(r.p.target?.day ?? 0)} · ${fmtN(r.pace)} a week`,
        value: r.spare,
        display: r.spare >= 0 ? `${r.spare} to spare` : `${-r.spare} late`,
        tone: r.spare >= 0 ? "plain" : "late",
        color: r.spare >= 0 ? r.p.tone : undefined,
        say: `${r.p.name}: ${r.leftNow} left before ${fmtLong(r.p.target?.day ?? 0)}; at ${fmtN(r.pace)} a week the last one is done ${fmtLong(r.finish)}.`,
      })),
    },
    "Each bar is the gap between the Project’s big date and the day its remaining work finishes at its recent pace.",
    {
      head: ["", "Left", "Big date", "Done at pace"],
      rows: rows.map((r) => ({ id: r.p.id, label: r.p.name, cells: [String(r.leftNow), fmtShort(r.p.target?.day ?? 0), fmtShort(r.finish)], marks: [r.p.id] })),
      foot: "Kiln & Co. shop is left out: only 2 of its tasks have dates.",
    },
    follow,
  );
}

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
        return ["you finished ", b(plural(r.b, "thing"), [r.id]), r.b > best ? ", the most in 14 weeks" : `, ${dir} from ${r.a}`];
      }
      case "c-moved":
        return [r.b < r.a && r.b <= 1 ? "only " : "", b(`${plural(r.b, "date")} moved`, [r.id]), `, ${dir} from ${r.a}`];
      case "c-late":
        return [b(`${plural(r.b, "thing")} ${r.b === 1 ? "is" : "are"} late`, [r.id]), `, ${dir} from ${r.a}`];
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
    `Each line joins last week (${fmtShort(weekStart(12))}) to this week (${fmtShort(weekStart(13))}). Green lines got better, red lines got worse.`,
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
      b(`${top.name} in ${top.project} has the most on`, [top.id]),
      `: ${top.open} open, ${top.dueNext} due next week. Next is ${second.name} in ${second.project}, with ${second.open}.`,
    ];
  } else if (total < 8) {
    sentence = ["Nobody has much on yet. ", b(`${top.name} has ${top.open} open`, [top.id]), ` and ${list(others.map((x) => `${x.name} has ${x.open}`))}.`];
  } else if (top.open > othersSum) {
    sentence = [
      b(`${top.name} has too much on`, [top.id]),
      `: ${top.open} open, ${top.dueNext} of them due next week, more than ${list(others.map((x) => x.name))} together. `,
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
  const shown = ppl.slice(0, 6);
  const max = Math.max(...shown.map((x) => x.open));
  const emphasise = p.status === "all" || top.open > othersSum || top.open / total >= 0.45 || top.open >= 1.5 * ppl[1].open;
  return done(
    sentence,
    {
      kind: "bars",
      max,
      legend: [
        { tone: "key", label: "Due next week" },
        { tone: "soft", label: "Later or no date" },
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
    "Each bar is one person’s open tasks. The darker part is what is due next week.",
    {
      head: ["", "Open", "Due next week", "Finished in 4 weeks"],
      rows: shown.slice(0, 5).map((x) => ({ id: x.id, label: x.name, sub: x.project, cells: [String(x.open), String(x.dueNext), String(x.finished4w)], marks: [x.id] })),
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
    COMPARED.forEach((cp, i) => {
      const first = cp.pickSentence.find((x) => typeof x !== "string");
      const pick = picks.find((k) => k.project === cp.name);
      if (!first || typeof first === "string" || !pick) return;
      if (i) sentence.push(i === COMPARED.length - 1 ? " and " : ", ");
      sentence.push(b(first.b, [pick.id]), ` in ${cp.name}`);
    });
    sentence.push(": each is the most pressing thing in its Project.");
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
        color: projectTone(k.project),
        say: `${k.title}: ${fmtDay(NEXT_MONDAY + k.day)}, ${k.person}. ${k.why}.`,
      })),
    },
    `Next week, ${fmtShort(NEXT_MONDAY)} to ${fmtShort(NEXT_MONDAY + 4)}. Numbered tasks are where to start; the rest can follow.`,
    {
      head: ["", "When", "Who"],
      rows: ranked.slice(0, 5).map((k) => ({ id: k.id, label: k.title, sub: k.why, cells: [weekdayShort(NEXT_MONDAY + k.day), k.person], marks: [k.id] })),
    },
    follow,
  );
}

function slipping(p: ProjectData, follow: string[]): Answer {
  const gs = p.groups.filter((g) => g.recent > 0).sort((a, z) => z.recentMoved / z.recent - a.recentMoved / a.recent || z.moves - a.moves);
  const top = gs[0];
  const second = gs[1];
  const r1 = top.recentMoved / top.recent;
  const r2 = second ? second.recentMoved / second.recent : 0;
  const sentence: Part[] = [
    b(`${top.name} ${keep(top.name)} slipping`, [top.id]),
    ": ",
    b(`${top.recentMoved} of the last ${top.recent}`, [top.id]),
    ` ${top.noun} moved their date at least once.`,
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
        say: `${g.name}: ${g.recentMoved} of the last ${g.recent} moved at least once, ${plural(g.moves, "move")} in all.`,
      })),
    },
    `Bar length is the share of recent ${p.groupWord === "Project" ? "tasks in each Project" : `tasks in each ${p.groupWord}`} that moved their date at least once. A full bar would be all of them.`,
    {
      head: ["", "Moved at least once", "Moves in all"],
      rows: gs.slice(0, 5).map((g) => ({ id: g.id, label: g.name, cells: [`${g.recentMoved} of ${g.recent}`, String(g.moves)], marks: [g.id] })),
    },
    follow,
  );
}

function whichOutsider(p: ProjectData, follow: string[]): Answer {
  const os = [...p.outsiders].sort((a, z) => z.moves - a.moves || z.moved - a.moved).slice(0, 6);
  const top = os[0];
  const next = os[1];
  const what = top.moved === top.tasks ? (top.tasks === 2 ? "Both tasks" : `All ${top.tasks} tasks`) : `${top.moved} of the ${top.tasks} tasks`;
  const sentence: Part[] = [
    b(top.name, [top.id]),
    `, the ${top.role}${inP(p, top.project)}, slips most. `,
    b(what, [top.id]),
    ` that wait on ${top.name} moved, ${plural(top.moves, "time")} between them.`,
  ];
  if (next) sentence.push(next.moves < top.moves ? ` Nobody else moved a date more than ${times(next.moves)}.` : ` ${next.name} is level with ${next.moves}.`);
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
    `Each bar counts how many times a date moved while it waited on that ${p.outsiderWord.one}.`,
    {
      head: ["", "Tasks", "Moved", "Last moved"],
      rows: os.slice(0, 5).map((o) => ({ id: o.id, label: o.name, sub: o.role, cells: [String(o.tasks), String(o.moved), o.moves ? fmtShort(o.last) : "Never"], marks: [o.id] })),
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
  const rA = b(`${fmtN(recent)} times a week`, ["avg-recent"]);
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
  const sentence: Part[] = [
    b(top.title, [top.id]),
    `${inP(p, top.project)} moved most: ${times(top.hops.length)}, from ${fmtShort(top.from)} to ${fmtShort(last(top))}. Together the ${rows.length} tasks moved `,
    b(plural(totalMoves, "time"), rows.map((r) => r.id)),
    `, and each ended up about ${Math.round(avgPush)} days later than first planned.`,
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
      rows: rows.slice(0, 5).map((r) => ({ id: r.id, label: r.title, sub: r.who, cells: [String(r.hops.length), fmtShort(r.from), fmtShort(last(r))], marks: [r.id] })),
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
  const named = p.doneThisWeek.slice(0, 2).map(lowerTitle);
  const sentence: Part[] = [
    "You finished ",
    b(`${plural(now, "thing")} this week`, ["wk13"]),
    tail,
    named.length ? `, including ${list(named)}.` : ".",
  ];
  if (p.status !== "thin") sentence.push(" That makes ", b(`${four} in the last 4 weeks`, ["wk10", "wk11", "wk12", "wk13"]), ".");
  if (p.status === "all") sentence.unshift("Across your 3 Projects, ");
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
        say: `Week of ${fmtShort(weekStart(i))}: ${plural(v, "thing")} finished.`,
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
    b(`the ${lowerTitle(top.title)}`, [top.id]),
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
    { head: ["", "Waiting on", "Days"], rows: ws.slice(0, 5).map((x) => ({ id: x.id, label: x.title, cells: [x.on, String(x.days)], marks: [x.id] })) },
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
  if (!tops.includes(busiest) && busiest.finished4w < best) sentence.push(` ${busiest.name} finished ${busiest.finished4w} while holding the most open work.`);
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
    { head: ["", "Finished", "Still open"], rows: ppl.slice(0, 5).map((x) => ({ id: x.id, label: x.name, sub: x.project, cells: [String(x.finished4w), String(x.open)], marks: [x.id] })) },
    follow,
  );
}

function left(p: ProjectData, follow: string[]): Answer {
  const gs = [...p.groups].sort((a, z) => z.open - a.open);
  const total = gs.reduce((n, g) => n + g.open, 0);
  const top = gs[0];
  const sentence: Part[] = [b(`${total} things are left`, gs.map((g) => g.id)), ". ", b(top.name, [top.id]), ` ${has(top.name)} the most, with ${top.open}`];
  if (p.target) {
    const after = total - p.weeks.dueBeforeLeft[13];
    sentence.push(after > 0 ? `, and ${after} of the ${total} can wait until after ${fmtLong(p.target.day)}.` : `, and all of them are due before ${fmtLong(p.target.day)}.`);
  } else sentence.push(".");
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
    `Each bar is the open tasks in one ${p.groupWord === "Project" ? "Project" : p.groupWord}.`,
    { head: ["", "Left", "Done"], rows: gs.slice(0, 5).map((g) => ({ id: g.id, label: g.name, cells: [String(g.open), String(g.done)], marks: [g.id] })) },
    follow,
  );
}

function comingUp(p: ProjectData, follow: string[]): Answer {
  const up = p.upcoming.filter((u) => u.day >= 1 && u.day <= 14);
  const counts = new Map<number, number>();
  up.forEach((u) => counts.set(u.day, (counts.get(u.day) ?? 0) + 1));
  const [busyDay, busyN] = [...counts.entries()].sort((a, z) => z[1] - a[1] || a[0] - z[0])[0];
  const busy = up.filter((u) => u.day === busyDay).map((u) => u.id);
  const sentence: Part[] = [b(`${plural(up.length, "thing")} ${up.length === 1 ? "is" : "are"} due in the next two weeks`, up.map((u) => u.id))];
  if (busyN > 1) sentence.push(", and the busiest day is ", b(fmtDay(busyDay), busy), `, with ${busyN}.`);
  else sentence.push(`, the first on ${fmtDay(Math.min(...up.map((u) => u.day)))}.`);
  const lanes = [...new Set(up.map((u) => u.lane))];
  const laneOrder = p.groups.map((g) => g.name).filter((n) => lanes.includes(n));
  const orderedLanes = [...laneOrder, ...lanes.filter((l) => !laneOrder.includes(l))];
  return done(
    sentence,
    {
      kind: "dots",
      lanes: orderedLanes.map((l) => ({ id: l, label: l, color: projectTone(l) })),
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
        color: projectTone(u.project),
        say: `${u.title}${u.project ? ` (${u.project})` : ""}: due ${fmtDay(u.day)}.`,
      })),
    },
    "Each dot is a task placed on the day it is due. Rows split them by group; weekends are shaded.",
    {
      head: ["", "Due in the next two weeks"],
      rows: orderedLanes.slice(0, 5).map((l) => ({ id: l, label: l, cells: [String(up.filter((u) => u.lane === l).length)], marks: up.filter((u) => u.lane === l).map((u) => u.id) })),
    },
    follow,
  );
}

const REASON_PHRASE: Record<ReasonId, string> = {
  reply: "waiting on a reply",
  check: "waiting to be checked",
  start: "not started",
  tight: "on a date that was too tight",
};

function late(p: ProjectData, follow: string[]): Answer {
  const ls = [...p.late].sort((a, z) => z.daysLate - a.daysLate);
  const byReason = new Map<ReasonId, number>();
  ls.forEach((l) => byReason.set(l.reason, (byReason.get(l.reason) ?? 0) + 1));
  const [mainReason, mainN] = [...byReason.entries()].sort((a, z) => z[1] - a[1])[0];
  const mainIds = ls.filter((l) => l.reason === mainReason).map((l) => l.id);
  const top = ls[0];
  const lead = b(`${plural(ls.length, "thing")} ${ls.length === 1 ? "is" : "are"} late`, ls.map((l) => l.id));
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
  sentence.push(" The furthest over is ", b(top.name ?? `“${top.title}”`, [top.id]), `${inP(p, top.project)}, at ${plural(top.daysLate, "day")}.`);
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
      ticks: [...new Set([Math.min(...ls.map((l) => l.daysLate)), max])].map((x) => ({ x, label: plural(x, "day") })),
      points: ls.map((l) => ({
        id: l.id,
        lane: l.reason,
        x: l.daysLate,
        label: l.title,
        tone: l.reason === mainReason ? "late" : "plain",
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

const TIME_PARTS: { id: "waiting" | "doing" | "checking" | "notStarted"; label: string; mid: string; tone: Tone }[] = [
  { id: "waiting", label: "Waiting on others", mid: "waiting on others", tone: "wait" },
  { id: "doing", label: "Doing the work", mid: "doing the work", tone: "doing" },
  { id: "checking", label: "Waiting to be checked", mid: "waiting to be checked", tone: "check" },
  { id: "notStarted", label: "Not started", mid: "not started", tone: "idle" },
];

function timeGoes(p: ProjectData, follow: string[]): Answer {
  const parts = TIME_PARTS.map((x) => ({ ...x, pct: p.time[x.id], days: p.timeDays[x.id] }));
  const sorted = [...parts].sort((a, z) => z.pct - a.pct);
  const top = sorted[0];
  const doing = parts[1];
  const sentence: Part[] =
    top.id === "waiting"
      ? [
          b("Waiting on others", ["waiting"]),
          ` takes the most time: ${top.pct}% of the time a task is open, it is waiting for a reply. `,
          b("Doing the work", ["doing"]),
          ` is only ${doing.pct}%.`,
        ]
      : [
          "Most of your time goes on ",
          b(top.mid, [top.id]),
          `: ${top.pct}% of the time a task is open. `,
          b(cap(sorted[1].mid), [sorted[1].id]),
          ` is next, at ${sorted[1].pct}%.`,
        ];
  if (p.status === "all") sentence.unshift("Across your 3 Projects, ");
  if (p.status === "all" && typeof sentence[1] === "object") sentence[1] = b("waiting on others", ["waiting"]);
  return done(
    sentence,
    {
      kind: "waffle",
      parts: parts.map((x) => ({ id: x.id, label: x.label, pct: x.pct, tone: x.tone, say: `${x.label}: ${x.pct} of every 100 days a task is open, about ${fmtN(x.days)} days for each task.` })),
    },
    "Each square is 1% of all the days your open tasks have spent in each state over the last 14 weeks.",
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
  const word = p.groupWord === "Project" ? "Project" : p.groupWord;
  const sentence: Part[] = [b(`${top.says} ${top.median} days`, [top.id]), ` on average, the longest ${word}`];
  if (ratio >= 1.8) sentence.push(`: about ${ratio >= 2.6 ? "three times" : "twice"} as long as most things, which take `, b(`${typical} days`, ["typical"]), ".");
  else sentence.push(". Most things take about ", b(plural(typical, "day"), ["typical"]), ".");
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
      rows: gs.slice(0, 5).map((g) => ({ id: g.id, label: g.name, cells: [plural(g.median, "day"), `${g.p25} to ${g.p75} days`, String(g.done)], marks: [g.id] })),
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
