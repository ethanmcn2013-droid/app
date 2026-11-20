/* Plain-sentence parser for the quick-add bar. Everything resolves against the fixed TODAY. */

import {
  PEOPLE,
  PROJECTS,
  TODAY,
  addDays,
  isoOf,
  mondayOf,
  parseIso,
  type Person,
  type Priority,
  type ProjectId,
} from "./data";

export type TokenKind = "date" | "person" | "project" | "priority";

export type Token = {
  kind: TokenKind;
  /** Highlighted range in the source text. */
  start: number;
  end: number;
  /** Range removed from the title (may include a lead word like "on" or "with"). */
  stripStart: number;
  label: string;
};

export type Parsed = {
  tokens: Token[];
  title: string;
  date?: string;
  end?: string;
  people: string[];
  project?: ProjectId;
  priority: Priority;
};

const WD: Record<string, number> = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, weds: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};
const MON: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const WD_RE = "mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";
const MON_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const ORD = "(?:st|nd|rd|th)?";
const DATE_RE = [
  `(?:${WD_RE}),?\\s+\\d{1,2}${ORD}\\s+(?:${MON_RE})`,
  `(?:${WD_RE}),?\\s+(?:${MON_RE})\\s+\\d{1,2}${ORD}`,
  `(?:${WD_RE}),?\\s+the\\s+\\d{1,2}${ORD}`,
  "today|tonight|tomorrow|tmrw|tmr",
  "next week|next month",
  `(?:next|this)\\s+(?:${WD_RE})`,
  `\\d{1,2}${ORD}\\s+(?:${MON_RE})`,
  `(?:${MON_RE})\\s+\\d{1,2}${ORD}`,
  "\\d{1,2}\\/\\d{1,2}",
  "in\\s+\\d{1,2}\\s+(?:days?|weeks?)",
  `the\\s+\\d{1,2}${ORD}`,
  `(?:${WD_RE})`,
].join("|");

function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function clampYear(y: number, m: number, d: number) {
  let iso = isoOf(y, m, d);
  if (iso < addDays(TODAY, -45)) iso = isoOf(y + 1, m, d);
  return iso;
}

export function resolveDate(raw: string): string | undefined {
  // "Fri 9 Oct" and "Friday, the 9th": the date decides, the weekday is only a reading aid.
  const s = fold(raw)
    .replace(/[,\s]+/g, " ")
    .trim()
    .replace(new RegExp(`^(?:${WD_RE}) (?=\\d|the |${MON_RE})`), "");
  const today = parseIso(TODAY);
  const y = today.getUTCFullYear();
  const todayWd = (today.getUTCDay() + 6) % 7;
  if (s === "today" || s === "tonight") return TODAY;
  if (s === "tomorrow" || s === "tmrw" || s === "tmr") return addDays(TODAY, 1);
  if (s === "next week") return addDays(mondayOf(TODAY), 7);
  if (s === "next month") return isoOf(y, today.getUTCMonth() + 1, 1);
  let m = s.match(/^(next|this) (\w+)$/);
  if (m && m[2] in WD) {
    if (m[1] === "next") return addDays(mondayOf(TODAY), 7 + WD[m[2]]);
    return addDays(TODAY, (WD[m[2]] - todayWd + 7) % 7);
  }
  if (s in WD) return addDays(TODAY, (WD[s] - todayWd + 7) % 7);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? (\w+)$/);
  if (m && m[2] in MON) return clampYear(y, MON[m[2]], Number(m[1]));
  m = s.match(/^(\w+) (\d{1,2})(?:st|nd|rd|th)?$/);
  if (m && m[1] in MON) return clampYear(y, MON[m[1]], Number(m[2]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return clampYear(y, Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^in (\d{1,2}) (day|days|week|weeks)$/);
  if (m) return addDays(TODAY, Number(m[1]) * (m[2].startsWith("week") ? 7 : 1));
  m = s.match(/^the (\d{1,2})(?:st|nd|rd|th)?$/);
  if (m) {
    const d = Number(m[1]);
    const iso = isoOf(y, today.getUTCMonth(), d);
    return iso < TODAY ? isoOf(y, today.getUTCMonth() + 1, d) : iso;
  }
  return undefined;
}

function matchPerson(word: string): Person | undefined {
  const w = fold(word);
  if (w.length < 2) return undefined;
  return PEOPLE.find((p) => fold(p.name).startsWith(w));
}

type Candidate = Token & { value?: string; value2?: string; person?: string; project?: ProjectId; priority?: Priority };

export function parseSentence(text: string): Parsed {
  const cands: Candidate[] = [];
  const lower = text;

  // Date ranges: "Mon to Wed", "12 Oct - 14 Oct", "from fri until sun"
  const spanRe = new RegExp(`\\b(?:from\\s+)?(${DATE_RE})\\s*(?:to|until|till|-|–)\\s*(${DATE_RE})\\b`, "gi");
  for (const m of lower.matchAll(spanRe)) {
    const a = resolveDate(m[1]);
    const b = resolveDate(m[2]);
    if (!a || !b) continue;
    const [s, e] = a <= b ? [a, b] : [b, a];
    const start = m.index ?? 0;
    const lead = /^from\s+/i.test(m[0]) ? m[0].match(/^from\s+/i)![0].length : 0;
    cands.push({ kind: "date", start: start + lead, end: start + m[0].length, stripStart: start, label: "", value: s, value2: e });
  }
  const dateRe = new RegExp(`\\b(?:(on|by|due|for|before)\\s+)?(${DATE_RE})\\b`, "gi");
  for (const m of lower.matchAll(dateRe)) {
    const iso = resolveDate(m[2]);
    if (!iso) continue;
    const start = m.index ?? 0;
    const lead = m[1] ? m[0].length - m[2].length : 0;
    cands.push({ kind: "date", start: start + lead, end: start + m[0].length, stripStart: start, label: "", value: iso });
  }
  for (const m of lower.matchAll(/(?:\b(?:with|for)\s+)?@([\p{L}]+)/giu)) {
    const p = matchPerson(m[1]);
    if (!p) continue;
    const start = m.index ?? 0;
    const at = start + m[0].indexOf("@");
    cands.push({ kind: "person", start: at, end: start + m[0].length, stripStart: start, label: p.name, person: p.id });
  }
  for (const m of lower.matchAll(/\b(with|and|&)\s+([\p{L}]+)/giu)) {
    const p = matchPerson(m[2]);
    if (!p || m[2].length < 3) continue;
    const start = m.index ?? 0;
    const lead = m[0].length - m[2].length;
    cands.push({ kind: "person", start: start + lead, end: start + m[0].length, stripStart: start, label: p.name, person: p.id });
  }
  for (const m of lower.matchAll(/#([\p{L}\d&-]+)/gu)) {
    const w = fold(m[1]);
    const proj = PROJECTS.find((p) => p.tags.some((tag) => tag.startsWith(w)) || fold(p.short).replace(/[^a-z]/g, "").startsWith(w));
    if (!proj) continue;
    const start = m.index ?? 0;
    cands.push({ kind: "project", start, end: start + m[0].length, stripStart: start, label: proj.short, project: proj.id });
  }
  for (const m of lower.matchAll(/(^|\s)(!{1,3}|urgent|asap|high priority)(?=\s|$)/gi)) {
    const start = (m.index ?? 0) + m[1].length;
    const word = m[2].toLowerCase();
    const priority: Priority = word === "!" || word === "high priority" ? "high" : "urgent";
    cands.push({ kind: "priority", start, end: start + m[2].length, stripStart: start, label: priority === "urgent" ? "Urgent" : "High", priority });
  }

  // Longest, earliest wins; no overlaps.
  cands.sort((a, b) => a.stripStart - b.stripStart || b.end - b.stripStart - (a.end - a.stripStart));
  const chosen: Candidate[] = [];
  for (const c of cands) {
    const clash = chosen.some((k) => c.stripStart < k.end && k.stripStart < c.end);
    if (!clash) chosen.push(c);
  }
  // "with Aoife and Sam": a person chosen via "and" only counts after another person.
  const tokens: Token[] = [];
  let date: string | undefined;
  let end: string | undefined;
  const people: string[] = [];
  let project: ProjectId | undefined;
  let priority: Priority = "normal";
  for (const c of chosen) {
    const leadWord = text.slice(c.stripStart, c.start).trim().toLowerCase();
    if (c.kind === "person" && (leadWord === "and" || leadWord === "&") && people.length === 0) continue;
    if (c.kind === "date") {
      if (date) continue; // first date wins
      date = c.value;
      end = c.value2;
    }
    if (c.person && !people.includes(c.person)) people.push(c.person);
    if (c.project) project = c.project;
    if (c.priority) priority = c.priority;
    tokens.push({ kind: c.kind, start: c.start, end: c.end, stripStart: c.stripStart, label: c.label });
  }
  tokens.sort((a, b) => a.start - b.start);

  let title = "";
  let cursor = 0;
  for (const tk of tokens) {
    title += text.slice(cursor, tk.stripStart);
    cursor = tk.end;
  }
  title += text.slice(cursor);
  title = title.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").replace(/^[\s,;:-]+|[\s,;:-]+$/g, "");
  if (title) title = title[0].toUpperCase() + title.slice(1);

  if (!project && people.length) project = PEOPLE.find((p) => p.id === people[0])?.home;
  return { tokens, title, date, end, people, project, priority };
}
