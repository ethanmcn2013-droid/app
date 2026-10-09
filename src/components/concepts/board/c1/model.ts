import { TODAY, type Person, type Priority, type Task } from "./data";

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function toDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function daysFromToday(iso: string) {
  return Math.round((toDate(iso).getTime() - toDate(TODAY).getTime()) / DAY);
}

export function shortDate(iso: string) {
  const d = toDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type DueTone = "late" | "today" | "soon" | "later";

export type DueFact = { tone: DueTone; label: string; spoken: string };

export function dueFact(iso: string): DueFact {
  const diff = daysFromToday(iso);
  const d = toDate(iso);
  if (diff < 0) {
    const n = -diff;
    return { tone: "late", label: n === 1 ? "Yesterday" : `${n} days late`, spoken: `${n} ${n === 1 ? "day" : "days"} late, was due ${shortDate(iso)}` };
  }
  if (diff === 0) return { tone: "today", label: "Today", spoken: "Due today" };
  if (diff === 1) return { tone: "soon", label: "Tomorrow", spoken: "Due tomorrow" };
  if (diff < 7) return { tone: "soon", label: WEEKDAYS[d.getUTCDay()], spoken: `Due ${shortDate(iso)}` };
  return { tone: "later", label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, spoken: `Due ${shortDate(iso)}` };
}

export function isLate(task: Task) {
  return task.stage !== "done" && !!task.due && daysFromToday(task.due) < 0;
}

export const PRIORITY_WORDS: Record<Priority, string> = { 0: "No priority", 1: "Low priority", 2: "Medium priority", 3: "High priority" };

/* ── Composer tokens ───────────────────────────────────────────────── */

export type Token =
  | { kind: "date"; start: number; end: number; iso: string; label: string }
  | { kind: "person"; start: number; end: number; person: Person }
  | { kind: "priority"; start: number; end: number; priority: Priority };

export type Parsed = { title: string; tokens: Token[]; due?: string; dueLabel?: string; person?: Person; priority?: Priority };

const DAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const PRIORITY_TOKENS: Record<string, Priority> = {
  high: 3, h: 3, urgent: 3, hi: 3, medium: 2, med: 2, m: 2, low: 1, l: 1,
};

function addDays(n: number) {
  return toIso(new Date(toDate(TODAY).getTime() + n * DAY));
}

function dateWord(word: string, next?: string): { iso: string; span: 1 | 2 } | null {
  const w = word.toLowerCase();
  if (w === "today" || w === "tod") return { iso: TODAY, span: 1 };
  if (w === "tomorrow" || w === "tmr" || w === "tmrw") return { iso: addDays(1), span: 1 };
  if (w in DAY_WORDS) {
    const today = toDate(TODAY).getUTCDay();
    let diff = (DAY_WORDS[w] - today + 7) % 7;
    if (diff === 0) diff = 7;
    return { iso: addDays(diff), span: 1 };
  }
  // "3 oct", "12 october"
  if (/^\d{1,2}$/.test(w) && next) {
    const m = next.toLowerCase();
    const month = LONG_MONTHS.findIndex((name) => name.startsWith(m) && m.length >= 3);
    if (month >= 0) {
      const day = Number(w);
      const year = month < 8 ? 2027 : 2026;
      const d = new Date(Date.UTC(year, month, day));
      if (d.getUTCMonth() === month) return { iso: toIso(d), span: 2 };
    }
  }
  return null;
}

export function parseComposer(text: string, people: Person[]): Parsed {
  const tokens: Token[] = [];
  const words: { word: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) words.push({ word: match[0], start: match.index, end: match.index + match[0].length });

  const used = new Set<number>();
  for (let i = 0; i < words.length; i++) {
    const { word, start, end } = words[i];
    if (word.startsWith("@") && word.length > 1) {
      const q = word.slice(1).toLowerCase();
      const person = people.find((p) => p.first.toLowerCase().startsWith(q) || p.name.toLowerCase().startsWith(q));
      if (person && !tokens.some((t) => t.kind === "person")) {
        tokens.push({ kind: "person", start, end, person });
        used.add(i);
      }
      continue;
    }
    if (word.startsWith("!") && word.length > 1) {
      const p = PRIORITY_TOKENS[word.slice(1).toLowerCase()];
      if (p && !tokens.some((t) => t.kind === "priority")) {
        tokens.push({ kind: "priority", start, end, priority: p });
        used.add(i);
      }
      continue;
    }
    if (tokens.some((t) => t.kind === "date")) continue;
    const found = dateWord(word, words[i + 1]?.word);
    // A bare weekday only counts once there is a title in front of it.
    if (found && (i > 0 || found.span === 2)) {
      const last = found.span === 2 ? words[i + 1] : words[i];
      tokens.push({ kind: "date", start, end: last.end, iso: found.iso, label: dueFact(found.iso).label === "Today" ? "Today" : shortDate(found.iso) });
      used.add(i);
      if (found.span === 2) {
        used.add(i + 1);
        i++;
      }
    }
  }
  const title = words
    .filter((_, i) => !used.has(i))
    .map((w) => w.word)
    .join(" ")
    .trim();
  const date = tokens.find((t) => t.kind === "date");
  const person = tokens.find((t) => t.kind === "person");
  const priority = tokens.find((t) => t.kind === "priority");
  return {
    title,
    tokens: tokens.sort((a, b) => a.start - b.start),
    due: date?.kind === "date" ? date.iso : undefined,
    dueLabel: date?.kind === "date" ? date.label : undefined,
    person: person?.kind === "person" ? person.person : undefined,
    priority: priority?.kind === "priority" ? priority.priority : undefined,
  };
}
