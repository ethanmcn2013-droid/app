/**
 * One plain-words grammar for every Tasks view. Words in any order become
 * tokens: a person, a day, a priority, a status, a project, paid or not, a
 * cost, a headcount, a supplier. The list's command line edits and filters
 * with it; "New task" on the board, the list and the calendar reads a line
 * like "Collect the cake stand orla fri high" with it.
 *
 * Server-safe and pure, so a preview and the apply step read the same answer.
 */

import {
  PEOPLE,
  SUPPLIERS,
  TEAM,
  TODAY,
  addDays,
  fmtDay,
  fmtEuro,
  personById,
  type IsoDate,
  type Priority,
  type Project,
  type ProjectId,
  type SupplierId,
  type TaskStatus,
  type TeamPersonId,
} from "../demo/store";
import { liveActiveProjects, liveProject } from "./projects";
import { statusName } from "./status";

export type PriorityId = Exclude<Priority, "none">;

export type Token =
  | { kind: "owner"; person: TeamPersonId | null }
  | { kind: "due"; date: IsoDate | null }
  | { kind: "shift"; days: number }
  | { kind: "priority"; p: PriorityId | null }
  | { kind: "status"; s: TaskStatus }
  | { kind: "event"; e: ProjectId | null }
  | { kind: "paid"; on: boolean }
  | { kind: "cost"; n: number | null }
  | { kind: "guests"; n: number | null }
  | { kind: "supplier"; text: string | null }
  | { kind: "late" }
  | { kind: "stuck" }
  | { kind: "delete" }
  | { kind: "word"; word: string; suggestion?: string; hint?: string };

/* ── Vocabulary ────────────────────────────────────────────────────── */

/* The fixed words, in two halves around the project names, which are read
   live (see `vocab`), so a project made this session can be typed by name. */
const BEFORE = new Map<string, Token>();
const AFTER = new Map<string, Token>();
let target = BEFORE;
const add = (keys: string[], token: Token) => keys.forEach((k) => target.set(k, token));
const MAX_PHRASE = 5;

function nextWeekday(target: number) {
  const today = new Date(`${TODAY}T12:00:00Z`).getUTCDay();
  let diff = (target - today + 7) % 7;
  if (diff === 0) diff = 7; // "friday" on a Friday means next Friday
  return addDays(TODAY, diff);
}

for (const id of TEAM) {
  const p = personById(id);
  if (p) add([id, p.first.toLowerCase(), p.name.toLowerCase(), p.first.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()], { kind: "owner", person: id });
}
add(["no one", "nobody", "unassign", "unassigned", "no owner"], { kind: "owner", person: null });

add(["today", "tonight"], { kind: "due", date: TODAY });
add(["tomorrow", "tmrw", "tmw", "tmr"], { kind: "due", date: addDays(TODAY, 1) });
add(["next week"], { kind: "due", date: nextWeekday(1) });
add(["no date", "undated", "clear date"], { kind: "due", date: null });
[
  ["sun", "sunday"],
  ["mon", "monday"],
  ["tue", "tues", "tuesday"],
  ["wed", "weds", "wednesday"],
  ["thu", "thur", "thurs", "thursday"],
  ["fri", "friday"],
  ["sat", "saturday"],
].forEach((keys, i) => add(keys, { kind: "due", date: nextWeekday(i) }));

add(["urgent", "asap"], { kind: "priority", p: "urgent" });
add(["high"], { kind: "priority", p: "high" });
add(["medium", "med", "normal"], { kind: "priority", p: "medium" });
add(["low"], { kind: "priority", p: "low" });
add(["no priority"], { kind: "priority", p: null });

add(["todo", "to do", "not started"], { kind: "status", s: "todo" });
add(["in progress", "doing", "started"], { kind: "status", s: "doing" });
add(["waiting", "on hold", "blocked"], { kind: "status", s: "waiting" });
add(["review", "in review", "to check", "check"], { kind: "status", s: "review" });
add(["done", "complete", "completed", "finished"], { kind: "status", s: "done" });

/* Projects by name, short name and a few words people use for them. */
const ALIASES: Partial<Record<ProjectId, string[]>> = {
  "mara-finn": ["mara & finn's", "mara and finn", "mara", "finn", "wedding", "the wedding"],
  kavanagh: ["kavanagh", "40th"],
  harvest: ["harvest", "supper club"],
  "barn-roof": ["barn roof", "roof", "heating works"],
  "winter-launch": ["winter launch", "launch"],
  christmas: ["christmas", "christmas markets", "markets"],
  "ada-theo": ["ada & theo", "ada and theo", "ada", "theo"],
  "keane-legal": ["keane", "keane legal"],
  "food-fair": ["food fair"],
  "open-day": ["open day"],
  "staff-rota": ["rota", "staff rota"],
  "photo-shoot": ["photo shoot"],
  "wine-list": ["wine list"],
  "path-lighting": ["path lighting"],
  "venue-upkeep": ["upkeep", "venue upkeep"],
};

const vocabCache = new WeakMap<readonly Project[], Map<string, Token>>();
/** Every word the grammar knows, with the active projects as they are now. */
function vocab(): Map<string, Token> {
  const active = liveActiveProjects();
  let v = vocabCache.get(active);
  if (!v) {
    v = new Map(BEFORE);
    for (const p of active) for (const k of [p.id, p.name.toLowerCase(), p.short.toLowerCase()]) v.set(k, { kind: "event", e: p.id });
    for (const p of active) for (const k of ALIASES[p.id] ?? []) v.set(k, { kind: "event", e: p.id });
    for (const [k, t] of AFTER) v.set(k, t);
    // A project made this session has no hand-written words, so its own name's words find it ("murphy"),
    // unless a word already means something or two new projects share it.
    const seen = new Map<string, string | null>();
    for (const p of active) {
      if (ALIASES[p.id]) continue;
      for (const word of p.name.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
        if (word.length < 4 || v.has(word) || FILLERS.has(word)) continue;
        seen.set(word, seen.has(word) && seen.get(word) !== p.id ? null : p.id);
      }
    }
    for (const [word, id] of seen) if (id) v.set(word, { kind: "event", e: id as ProjectId });
    vocabCache.set(active, v);
  }
  return v;
}
target = AFTER;
add(["no project"], { kind: "event", e: null });

add(["paid", "settled"], { kind: "paid", on: true });
add(["unpaid", "not paid", "owed"], { kind: "paid", on: false });
add(["no cost", "clear cost"], { kind: "cost", n: null });
add(["no guests", "clear guests"], { kind: "guests", n: null });
add(["no supplier", "clear supplier"], { kind: "supplier", text: null });

add(["late", "overdue"], { kind: "late" });
add(["stuck"], { kind: "stuck" });
add(["delete", "remove"], { kind: "delete" });

const FILLERS = new Set([
  "set", "to", "and", "due", "assign", "assigned", "give", "for", "on", "by", "the", "it", "them", "make", "is", "as", "&",
  "with", "please", "then", "move", "mark", "owner", "priority", "status", "event", "project", "in", "at", "a", "of",
]);
const FILTER_VERBS = new Set(["show", "find", "only", "filter", "where"]);
const COST_WORDS = new Set(["cost", "costs", "budget", "price", "quote", "€"]);
const GUEST_WORDS = new Set(["guests", "guest", "headcount", "pax", "people", "covers"]);
const EURO_AFTER = new Set(["euro", "euros", "eur"]);

/* ── Suggestions ───────────────────────────────────────────────────── */

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function suggest(word: string): string | undefined {
  if (word.length < 3) return undefined;
  let best: { key: string; d: number } | undefined;
  for (const key of [...vocab().keys(), "cost", "guests", "supplier"]) {
    if (key.includes(" ")) continue;
    const d = distance(word, key);
    if (d <= (word.length > 5 ? 2 : 1) && (!best || d < best.d)) best = { key, d };
  }
  return best?.key;
}

/* ── Parse ─────────────────────────────────────────────────────────── */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const amount = (w: string | undefined) => {
  if (!w) return null;
  const n = Number(w.replace(/^€/, "").replace(/k$/, "000"));
  return w.length && Number.isFinite(n) && /\d/.test(w) ? n : null;
};

function dayMonth(a: string, b?: string): string | null {
  if (!b) return null;
  const mi = (x: string) => (x.length >= 3 ? MONTHS.findIndex((m) => x.startsWith(m)) : -1);
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

export type Parsed = { tokens: Token[]; filterVerb: boolean };

export function parse(input: string): Parsed {
  const raw = input
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/[,.;]/g, " ")
    .replace(/&/g, " & ")
    .replace(/€\s+(\d)/g, "€$1")
    .split(/\s+/)
    .filter(Boolean);
  // "&" is spaced out above, matching "mara & finn" in the vocabulary.
  const words = raw.map((w) => w.toLowerCase());
  const out: Token[] = [];
  let filterVerb = false;
  let i = 0;
  const phrase = (at: number): [Token, number] | null => {
    for (let n = MAX_PHRASE; n >= 1; n--) {
      if (at + n > words.length) continue;
      const hit = vocab().get(words.slice(at, at + n).join(" "));
      if (hit) return [hit, n];
    }
    return null;
  };
  const known = (at: number) => phrase(at) !== null;

  while (i < words.length) {
    const w = words[i];
    if (i === 0 && FILTER_VERBS.has(w)) {
      filterVerb = true;
      i++;
      continue;
    }
    // Phrases first, longest wins: "mara and finn", "in progress".
    const hit = phrase(i);
    if (hit) {
      out.push(hit[0]);
      i += hit[1];
      continue;
    }

    // "cost 400", "budget €1,200", "€400", "400 euro"
    if (COST_WORDS.has(w) && amount(words[i + 1]) != null) {
      out.push({ kind: "cost", n: amount(words[i + 1]) });
      i += 2;
      continue;
    }
    if (/^€\d/.test(w) && amount(w) != null) {
      out.push({ kind: "cost", n: amount(w) });
      i++;
      continue;
    }
    // "guests 110", "110 guests", "headcount 90"
    if (GUEST_WORDS.has(w) && amount(words[i + 1]) != null) {
      out.push({ kind: "guests", n: amount(words[i + 1]) });
      i += 2;
      continue;
    }
    const n = amount(w);
    if (n != null && GUEST_WORDS.has(words[i + 1] ?? "")) {
      out.push({ kind: "guests", n });
      i += 2;
      continue;
    }
    if (n != null && EURO_AFTER.has(words[i + 1] ?? "")) {
      out.push({ kind: "cost", n });
      i += 2;
      continue;
    }
    // "push 2 days", "+3d", "-1w". Always in days: "in 17 days", never weeks.
    const rel = w.match(/^([+-])(\d+)([dw]?)$/);
    if (rel) {
      out.push({ kind: "shift", days: (rel[1] === "-" ? -1 : 1) * Number(rel[2]) * (rel[3] === "w" ? 7 : 1) });
      i++;
      continue;
    }
    if (w === "push" || w === "pull" || w === "delay") {
      const sign = w === "pull" ? -1 : 1;
      const qty = words[i + 1] === "a" || words[i + 1] === "one" ? 1 : amount(words[i + 1]);
      const unit = words[i + 2] ?? "";
      if (qty != null && /^(day|days|week|weeks)$/.test(unit)) {
        out.push({ kind: "shift", days: sign * qty * (unit.startsWith("week") ? 7 : 1) });
        i += 3;
        continue;
      }
    }
    // "supplier Lawlor Hire": the name runs until the next word it knows.
    if (w === "supplier" || w === "from") {
      let j = i + 1;
      const name: string[] = [];
      while (j < words.length && !known(j) && !COST_WORDS.has(words[j]) && !GUEST_WORDS.has(words[j]) && amount(words[j]) == null) name.push(raw[j++]);
      if (name.length) {
        out.push({ kind: "supplier", text: name.join(" ") });
        i = j;
        continue;
      }
    }
    // "2 oct", "oct 2"
    const dm = dayMonth(w, words[i + 1]);
    if (dm) {
      out.push({ kind: "due", date: dm });
      i += 2;
      continue;
    }
    i++;
    if (FILLERS.has(w)) continue;
    if (n != null) out.push({ kind: "word", word: raw[i - 1], hint: `Say “cost ${raw[i - 1]}” or “${raw[i - 1]} guests”.` });
    else out.push({ kind: "word", word: w, suggestion: suggest(w) });
  }
  return { tokens: out, filterVerb };
}

/** How a vocabulary word reads in a sentence: "Tuesday", "Orla", "high". */
export function prettyWord(key: string) {
  const t = vocab().get(key);
  const proper = t && ((t.kind === "owner" && t.person) || (t.kind === "due" && /day$/.test(key)) || t.kind === "event");
  return proper ? key[0].toUpperCase() + key.slice(1) : key;
}

/** A supplier named in plain words, if we know them. */
export function supplierByName(text: string | null | undefined): SupplierId | undefined {
  if (!text) return undefined;
  const q = text.trim().toLowerCase();
  return (SUPPLIERS.find((s) => s.name.toLowerCase() === q) ?? SUPPLIERS.find((s) => s.name.toLowerCase().startsWith(q)))?.id;
}

/* ── A new task in one line ────────────────────────────────────────── */

export type TaskLine = {
  /** What is left once the details are read off the end. */
  title: string;
  owner?: TeamPersonId;
  due?: IsoDate;
  priority?: PriorityId;
  project?: ProjectId;
  status?: TaskStatus;
  supplier?: SupplierId;
  cost?: number;
  guests?: number;
  paid?: boolean;
  /** Where the details begin in the text, for highlighting. -1 when there are none. */
  detailsAt: number;
};

const DETAIL_KINDS = new Set<Token["kind"]>(["owner", "due", "priority", "status", "event", "paid", "cost", "guests", "supplier"]);

/**
 * "Collect the cake stand orla fri high": the longest run of words at the
 * end that reads as details becomes the details; the rest is the title.
 * The board's "@orla" and "!high" work anywhere in the line.
 */
export function parseTaskLine(text: string): TaskLine {
  const line: TaskLine = { title: "", detailsAt: -1 };
  // @name and !priority, anywhere.
  let rest = text.replace(/(^|\s)@(\S+)/g, (m, sp: string, who: string) => {
    const hit = vocab().get(who.toLowerCase());
    if (hit?.kind === "owner" && hit.person) {
      line.owner = hit.person;
      return sp;
    }
    const byStart = TEAM.find((id) => personById(id)?.first.toLowerCase().startsWith(who.toLowerCase()));
    if (byStart) {
      line.owner = byStart;
      return sp;
    }
    return m;
  });
  rest = rest.replace(/(^|\s)!(\S+)/g, (m, sp: string, p: string) => {
    const key = { h: "high", hi: "high", m: "medium", med: "medium", l: "low", u: "urgent" }[p.toLowerCase()] ?? p.toLowerCase();
    const hit = vocab().get(key);
    if (hit?.kind === "priority" && hit.p) {
      line.priority = hit.p;
      return sp;
    }
    return m;
  });

  const spans: { w: string; at: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) spans.push({ w: m[0], at: m.index });
  let cut = spans.length;
  let tokens: Token[] = [];
  for (let k = 1; k < spans.length; k++) {
    const p = parse(spans.slice(k).map((s) => s.w).join(" "));
    if (!p.filterVerb && p.tokens.length > 0 && p.tokens.every((t) => DETAIL_KINDS.has(t.kind))) {
      cut = k;
      tokens = p.tokens;
      break;
    }
  }
  for (const t of tokens) {
    if (t.kind === "owner" && t.person) line.owner = t.person;
    else if (t.kind === "due" && t.date) line.due = t.date;
    else if (t.kind === "priority" && t.p) line.priority = t.p;
    else if (t.kind === "status") line.status = t.s;
    else if (t.kind === "event" && t.e) line.project = t.e;
    else if (t.kind === "paid") line.paid = t.on;
    else if (t.kind === "cost" && t.n != null) line.cost = t.n;
    else if (t.kind === "guests" && t.n != null) line.guests = t.n;
    else if (t.kind === "supplier") line.supplier = supplierByName(t.text);
  }
  const title = spans
    .slice(0, cut)
    .map((s) => s.w)
    .join(" ")
    .trim();
  line.title = title ? title[0].toUpperCase() + title.slice(1) : "";
  if (cut < spans.length) line.detailsAt = spans[cut].at;
  return line;
}

export type LineChip = { key: string; label: string; hue?: number; initials?: string };

/** The details a line will set, as words for chips. */
export function lineChips(line: TaskLine, fallbackProject?: ProjectId): LineChip[] {
  const chips: LineChip[] = [];
  const project = line.project ?? fallbackProject;
  if (project) chips.push({ key: "project", label: liveProject(project)?.short ?? project, hue: liveProject(project)?.hue });
  if (line.owner) {
    const p = personById(line.owner);
    chips.push({ key: "owner", label: p?.first ?? line.owner, hue: p?.hue, initials: p?.initials });
  }
  if (line.due) chips.push({ key: "due", label: line.due === TODAY ? "Today" : fmtDay(line.due) });
  if (line.priority) chips.push({ key: "priority", label: line.priority[0].toUpperCase() + line.priority.slice(1) });
  if (line.status && line.status !== "todo") chips.push({ key: "status", label: statusName(line.status) });
  if (line.supplier) chips.push({ key: "supplier", label: SUPPLIERS.find((s) => s.id === line.supplier)?.name ?? "" });
  if (line.cost != null) chips.push({ key: "cost", label: fmtEuro(line.cost) });
  if (line.guests != null) chips.push({ key: "guests", label: `${line.guests} guests` });
  return chips;
}

/** People who can own a task, for pickers. */
export const TEAM_PEOPLE = TEAM.map((id) => PEOPLE.find((p) => p.id === id)!);
