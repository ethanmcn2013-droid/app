/**
 * Flow maths for the board: how long work usually sits in each stage, what is
 * stuck, what is pooling, and where everything was on any of the last 21 days.
 * Every number comes from each task's history; nothing is hard-coded.
 */

import { STAGES, TODAY, type Move, type StageKey, type Task } from "./data";

export const ORDER: Record<StageKey, number> = { todo: 0, doing: 1, waiting: 2, review: 3, done: 4 };
export const OPEN_STAGES: StageKey[] = ["todo", "doing", "waiting", "review"];
/** Work that has started. A task still in To do is queued, not stuck. */
export const STUCK_STAGES: StageKey[] = ["doing", "waiting", "review"];
export const HISTORY_DAYS = 14;
/** How far back the replay goes: three weeks, so the run-up to the busy fortnight shows. */
export const REPLAY_DAYS = 21;

/** Verb used when work leaves a stage ("6 passed on", "1 approved"). */
export const LEAVE_VERB: Record<StageKey, string> = { todo: "started", doing: "passed on", waiting: "unblocked", review: "approved", done: "" };
/** Used when history is too thin to learn a usual time. */
const FALLBACK_USUAL: Record<StageKey, number> = { todo: 5, doing: 4, waiting: 3, review: 3, done: 0 };

const historyOf = (task: Task): Move[] => task.history ?? [{ stage: task.stage, day: 0 }];

/** Where the task was at the end of `day`, or null if it did not exist yet. */
export function moveAt(task: Task, day: number): Move | null {
  let found: Move | null = null;
  for (const m of historyOf(task)) if (m.day <= day) found = m;
  return found;
}

type Stay = { stage: StageKey; from: number; to: number | null };

function staysOf(task: Task, day: number): Stay[] {
  const moves = historyOf(task).filter((m) => m.day <= day);
  return moves.map((m, i) => ({ stage: m.stage, from: m.day, to: i + 1 < moves.length ? moves[i + 1].day : null }));
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** How long work usually sits in each stage, learned from finished stays. */
export function usualTimes(tasks: Task[]): Record<StageKey, number> {
  const out = {} as Record<StageKey, number>;
  for (const stage of STAGES) {
    const samples: number[] = [];
    for (const t of tasks) for (const s of staysOf(t, 0)) if (s.stage === stage.key && s.to !== null) samples.push(s.to - s.from);
    out[stage.key] = samples.length >= 3 ? Math.max(1, Math.round(median(samples))) : FALLBACK_USUAL[stage.key];
  }
  return out;
}

export type AgeLevel = "calm" | "due" | "over";

export function ageLevel(age: number, usual: number): AgeLevel {
  if (usual <= 0) return "calm";
  if (age >= usual * 2) return "over";
  if (age >= usual) return "due";
  return "calm";
}

export const isStuck = (age: number, usual: number) => usual > 0 && age > usual;

export type Placed = { task: Task; stage: StageKey; since: number; age: number };

export type StageFlow = {
  key: StageKey;
  placed: Placed[];
  /** Arrivals and departures in the seven days up to the view day. */
  inWeek: number;
  outWeek: number;
  outFortnight: number;
  /** Task count at the end of each of the last 14 days. */
  spark: number[];
  pooled: boolean;
};

function transitions(tasks: Task[]) {
  const t: { from: StageKey | null; to: StageKey; day: number }[] = [];
  for (const task of tasks) {
    const moves = historyOf(task);
    moves.forEach((m, i) => t.push({ from: i ? moves[i - 1].stage : null, to: m.stage, day: m.day }));
  }
  return t;
}

export function flowAt(tasks: Task[], day: number): Record<StageKey, StageFlow> {
  const moves = transitions(tasks);
  const out = {} as Record<StageKey, StageFlow>;
  for (const s of STAGES) {
    const placed: Placed[] = [];
    for (const task of tasks) {
      const m = moveAt(task, day);
      if (!m || m.stage !== s.key) continue;
      placed.push({ task, stage: s.key, since: m.day, age: day - m.day });
    }
    const inWindow = (d: number, span: number) => d <= day && d > day - span;
    const inWeek = moves.filter((m) => m.to === s.key && m.from !== s.key && inWindow(m.day, 7)).length;
    const outWeek = moves.filter((m) => m.from === s.key && m.to !== s.key && inWindow(m.day, 7)).length;
    const outFortnight = moves.filter((m) => m.from === s.key && m.to !== s.key && inWindow(m.day, HISTORY_DAYS)).length;
    const spark: number[] = [];
    for (let d = day - (HISTORY_DAYS - 1); d <= day; d++) {
      let n = 0;
      for (const task of tasks) {
        const m = moveAt(task, d);
        if (m && m.stage === s.key && (s.key !== "done" || m.day > d - 7)) n++;
      }
      spark.push(n);
    }
    const pooled = s.key !== "done" && s.key !== "todo" && placed.length >= 4 && inWeek - outWeek >= 3 && spark[HISTORY_DAYS - 8] > 0;
    out[s.key] = { key: s.key, placed, inWeek, outWeek, outFortnight, spark, pooled };
  }
  return out;
}

/** The board as it stood at the end of `day`: tasks that existed, in the stage they were in. */
export function boardAt(tasks: Task[], day: number): Task[] {
  if (day === 0) return tasks;
  const out: Task[] = [];
  for (const task of tasks) {
    const m = moveAt(task, day);
    if (!m) continue;
    out.push({ ...task, stage: m.stage, doneAt: m.stage === "done" ? isoFor(m.day) : undefined, heldBy: m.stage === "waiting" ? task.heldBy : undefined });
  }
  return out;
}

/** The same task in a new stage, with the move written into its history. */
export function withStage(task: Task, stage: StageKey): Task {
  if (task.stage === stage) return task;
  // Several moves on the same day collapse into one, so a card nudged across
  // the board with the arrow keys records where it landed, not every step.
  const past = historyOf(task);
  let history = past.length > 1 && past[past.length - 1].day === 0 ? past.slice(0, -1) : past;
  if (history[history.length - 1]?.stage !== stage) history = [...history, { stage, day: 0 }];
  const next: Task = { ...task, stage, history };
  if (stage === "done") next.doneAt = TODAY;
  else delete next.doneAt;
  if (stage !== "waiting") delete next.heldBy;
  return next;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateFor(day: number) {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + day));
}

export function isoFor(day: number) {
  return dateFor(day).toISOString().slice(0, 10);
}

/** "today", "yesterday", "Tue", or "Tue 15 Sep" beyond the last week (or when long). */
export function dayLabel(day: number, opts: { long?: boolean } = {}) {
  if (day === 0) return "today";
  if (day === -1) return "yesterday";
  const d = dateFor(day);
  const wd = WEEKDAYS[d.getUTCDay()];
  if (!opts.long && day > -7) return wd;
  return `${wd} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function shortDay(day: number) {
  const d = dateFor(day);
  return { weekday: WEEKDAYS[d.getUTCDay()], date: d.getUTCDate() };
}

export const daysText = (n: number) => (n === 1 ? "1 day" : `${n} days`);

export function nextStage(stage: StageKey): StageKey | null {
  if (stage === "todo") return "doing";
  if (stage === "doing") return "review";
  if (stage === "waiting") return "doing";
  if (stage === "review") return "done";
  return null;
}

export function moveOnLabel(stage: StageKey) {
  if (stage === "todo") return "Start";
  if (stage === "doing") return "Send to be checked";
  if (stage === "waiting") return "Unblock";
  if (stage === "review") return "Approve";
  return "Move on";
}

export type DayMove = { task: Task; from: StageKey | null; to: StageKey };

/** Every move made on `day`, in the order the tasks sit on the board. */
export function movesOn(tasks: Task[], day: number): DayMove[] {
  const out: DayMove[] = [];
  for (const task of tasks) {
    const moves = historyOf(task);
    moves.forEach((m, i) => {
      if (m.day === day) out.push({ task, from: i ? moves[i - 1].stage : null, to: m.stage });
    });
  }
  return out;
}

function moveVerb(m: DayMove) {
  if (m.from === null) return "added";
  if (m.to === "done") return "finished";
  if (m.to === "review") return "sent to be checked";
  if (m.to === "waiting") return "now waiting";
  if (m.to === "doing" && m.from === "waiting") return "unblocked";
  if (m.to === "doing" && m.from === "review") return "sent back";
  if (m.to === "doing") return "started";
  return "moved to To do";
}

/** "Seating plan sent back, and 2 more moves." Plain words for the replay caption. */
export function dayCaption(moves: DayMove[], day: number) {
  if (moves.length === 0) return day === 0 ? "The board as it stands now." : "A quiet day. Nothing moved.";
  const shown = moves.slice(0, 2).map((m) => `${m.task.title} ${moveVerb(m)}`);
  const rest = moves.length - shown.length;
  return `${shown.join(". ")}${rest > 0 ? `. And ${rest} more ${rest === 1 ? "move" : "moves"}.` : "."}`;
}
