/* The command line's small grammar. Plain words in any order become
   tokens: a person, a date, a priority, a status, a label, or "delete".
   Anything it cannot place becomes an unknown word with a best guess. */

import {
  LABELS,
  PEOPLE,
  PRIORITIES,
  STATUSES,
  TODAY,
  type LabelId,
  type PersonId,
  type Priority,
  type StatusId,
  type Task,
} from "./data";

export type Token =
  | { kind: "assign"; person: PersonId | null }
  | { kind: "due"; date: string | null }
  | { kind: "priority"; p: Priority }
  | { kind: "status"; s: StatusId }
  | { kind: "label"; label: LabelId }
  | { kind: "late" }
  | { kind: "delete" }
  | { kind: "word"; word: string; suggestion?: string };

/* ── Dates ─────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
export const daysFromToday = (iso: string) => Math.round((toDate(iso).getTime() - toDate(TODAY).getTime()) / DAY_MS);

/** "Fri 2 Oct" */
export function longDate(iso: string) {
  const d = toDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Compact due text for a row. */
export function dueText(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < -1) return `${-n} days late`;
  if (n < 7) return WEEKDAYS[toDate(iso).getUTCDay()];
  const d = toDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type DueTone = "late" | "today" | "soon" | "later";
export function dueTone(iso: string): DueTone {
  const n = daysFromToday(iso);
  if (n < 0) return "late";
  if (n === 0) return "today";
  if (n < 3) return "soon";
  return "later";
}

function nextWeekday(target: number) {
  const today = toDate(TODAY).getUTCDay();
  let diff = (target - today + 7) % 7;
  if (diff === 0) diff = 7; // "friday" on a Friday means next Friday
  return addDays(TODAY, diff);
}

/* ── Vocabulary ────────────────────────────────────────────────────── */

type Entry = { token: Token; display: string };
const VOCAB = new Map<string, Entry>();
const add = (keys: string[], token: Token, display: string) => keys.forEach((k) => VOCAB.set(k, { token, display }));

for (const id of Object.keys(PEOPLE) as PersonId[]) add([id, PEOPLE[id].full.toLowerCase()], { kind: "assign", person: id }, PEOPLE[id].name);
add(["me", "myself"], { kind: "assign", person: "orla" }, "me");
add(["no one", "nobody", "unassign", "unassigned"], { kind: "assign", person: null }, "no one");

add(["today", "tonight", "tod"], { kind: "due", date: TODAY }, "today");
add(["tomorrow", "tmrw", "tmw", "tom'row"], { kind: "due", date: addDays(TODAY, 1) }, "tomorrow");
add(["next week"], { kind: "due", date: nextWeekday(1) }, "next week");
add(["no date", "undated", "someday"], { kind: "due", date: null }, "no date");
const DAY_KEYS: string[][] = [
  ["sun", "sunday"],
  ["mon", "monday"],
  ["tue", "tues", "tuesday"],
  ["wed", "weds", "wednesday"],
  ["thu", "thur", "thurs", "thursday"],
  ["fri", "friday"],
  ["sat", "saturday"],
];
DAY_KEYS.forEach((keys, i) => add(keys, { kind: "due", date: nextWeekday(i) }, WEEKDAYS_LONG[i]));

add(["urgent", "asap"], { kind: "priority", p: 4 }, "urgent");
add(["high"], { kind: "priority", p: 3 }, "high");
add(["medium", "med", "normal"], { kind: "priority", p: 2 }, "medium");
add(["low"], { kind: "priority", p: 1 }, "low");
add(["no priority"], { kind: "priority", p: 0 }, "no priority");

add(["todo", "to do", "not started", "backlog"], { kind: "status", s: "todo" }, "to do");
add(["in progress", "progress", "doing", "started"], { kind: "status", s: "progress" }, "in progress");
add(["review", "in review"], { kind: "status", s: "review" }, "review");
add(["waiting", "blocked", "on hold"], { kind: "status", s: "waiting" }, "waiting");
add(["done", "complete", "completed", "finished"], { kind: "status", s: "done" }, "done");

add(["mara & finn", "mara and finn", "mara", "finn"], { kind: "label", label: "mara" }, "Mara & Finn");
add(["venue"], { kind: "label", label: "venue" }, "venue");
add(["bar"], { kind: "label", label: "bar" }, "bar");
add(["enquiry", "enquiries"], { kind: "label", label: "enquiry" }, "enquiry");
add(["kitchen"], { kind: "label", label: "kitchen" }, "kitchen");
add(["open day", "openday"], { kind: "label", label: "openday" }, "open day");
add(["late", "overdue"], { kind: "late" }, "late");
add(["delete", "remove", "bin"], { kind: "delete" }, "delete");

const FILLERS = new Set(["set", "to", "and", "due", "assign", "assigned", "give", "for", "on", "by", "the", "it", "them", "priority", "status", "label", "make", "is", "as", "&", "with", "please", "then", "move"]);

/* ── Suggestions ───────────────────────────────────────────────────── */

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function suggest(word: string): string | undefined {
  if (word.length < 3) return undefined;
  let best: { key: string; d: number } | undefined;
  for (const key of VOCAB.keys()) {
    if (key.includes(" ")) continue;
    const d = distance(word, key);
    if (d <= (word.length > 5 ? 2 : 1) && (!best || d < best.d)) best = { key, d };
  }
  return best?.key;
}

/** How a vocabulary word reads in a sentence: "Tuesday", "Orla", "high". */
export function prettyWord(key: string) {
  const t = VOCAB.get(key)?.token;
  const proper = t && ((t.kind === "assign" && t.person) || (t.kind === "due" && /day$/.test(key)));
  return proper ? key[0].toUpperCase() + key.slice(1) : key;
}

/* ── Parse ─────────────────────────────────────────────────────────── */

export function parse(input: string): Token[] {
  const words = input
    .toLowerCase()
    .replace(/[,.;]/g, " ")
    .replace(/&/g, " & ")
    .split(/\s+/)
    .filter(Boolean);
  const out: Token[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let n = 3; n >= 1; n--) {
      if (i + n > words.length) continue;
      const phrase = words.slice(i, i + n).join(" ");
      const entry = VOCAB.get(phrase);
      if (entry) {
        out.push(entry.token);
        i += n;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const w = words[i];
    i++;
    if (FILLERS.has(w)) continue;
    // "2 oct" / "oct 2"
    const dm = parseDayMonth(w, words[i]);
    if (dm) {
      out.push({ kind: "due", date: dm });
      i++;
      continue;
    }
    out.push({ kind: "word", word: w, suggestion: suggest(w) });
  }
  return out;
}

function parseDayMonth(a: string, b?: string): string | null {
  if (!b) return null;
  const mi = (s: string) => MONTHS.findIndex((m) => s.startsWith(m.toLowerCase()));
  let day = Number(a);
  let month = mi(b);
  if (!Number.isInteger(day) || month < 0) {
    day = Number(b);
    month = mi(a);
  }
  if (!Number.isInteger(day) || day < 1 || day > 31 || month < 0) return null;
  const year = month < 8 ? 2027 : 2026;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Collapse tokens into the change they describe (later words win). */
export type Change = {
  assign?: PersonId | null;
  due?: string | null;
  priority?: Priority;
  status?: StatusId;
  labels?: LabelId[];
  remove?: boolean;
};

export function toChange(tokens: Token[]): Change {
  const c: Change = {};
  for (const t of tokens) {
    if (t.kind === "assign") c.assign = t.person;
    else if (t.kind === "due") c.due = t.date;
    else if (t.kind === "priority") c.priority = t.p;
    else if (t.kind === "status") c.status = t.s;
    else if (t.kind === "label") c.labels = [...(c.labels ?? []), t.label];
    else if (t.kind === "delete") c.remove = true;
  }
  return c;
}

export const hasChange = (c: Change) => Object.keys(c).length > 0;

/** Filter semantics: every token must hold; loose words search titles. */
export function matches(task: Task, tokens: Token[]) {
  return tokens.every((t) => {
    switch (t.kind) {
      case "assign":
        return task.assignee === t.person;
      case "due":
        return task.due === t.date;
      case "priority":
        return task.priority === t.p;
      case "status":
        return task.status === t.s;
      case "label":
        return task.labels.includes(t.label);
      case "late":
        return !!task.due && task.status !== "done" && daysFromToday(task.due) < 0;
      case "delete":
        return true;
      case "word":
        return `${task.title} ${task.description ?? ""} orc-${task.id}`.toLowerCase().includes(t.word);
    }
  });
}

/** Human summary of a change for toasts and the activity trail. */
export function describeChange(c: Change): string[] {
  const parts: string[] = [];
  if (c.status) parts.push(`moved it to ${STATUSES.find((s) => s.id === c.status)!.name}`);
  if (c.assign !== undefined) parts.push(c.assign ? `assigned it to ${PEOPLE[c.assign].name}` : "removed the assignee");
  if (c.due !== undefined) parts.push(c.due ? `set the due date to ${longDate(c.due)}` : "cleared the due date");
  if (c.priority !== undefined) parts.push(`set priority to ${PRIORITIES.find((p) => p.p === c.priority)!.name}`);
  if (c.labels) parts.push(`added ${c.labels.map((l) => LABELS[l].name).join(", ")}`);
  return parts;
}
