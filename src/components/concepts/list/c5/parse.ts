/**
 * Reads a plain sentence ("Tom will price the late food by Thursday for the
 * Doyle 50th") into the parts of a promise, with character ranges so the
 * composer can underline each part as it is recognised.
 */
import { addDays, diffDays, FOR_OPTIONS, ME, PEOPLE, TODAY, toDate, toIso, type PersonId } from "./data";

export type Span = { kind: "owner" | "action" | "due" | "for" | "waiting"; start: number; end: number };

export type Parsed = {
  owner: PersonId | null;
  ownerKnown: boolean;
  action: string;
  due: string | null;
  forWhom: string | null;
  waitingOn: PersonId | null;
  waitingFor: string | null;
  spans: Span[];
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10,
  november: 10, dec: 11, december: 11,
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function personFromWord(word: string): PersonId | null | undefined {
  const w = fold(word);
  if (w === "i" || w === "me" || w === "i'll") return ME;
  if (w === "someone" || w === "somebody" || w === "nobody") return null;
  return PEOPLE.find((p) => fold(p.name) === w)?.id;
}

function dateFromWords(words: string): string | null | undefined {
  const w = fold(words.trim());
  if (w === "today" || w === "tonight" || w === "end of today") return TODAY;
  if (w === "tomorrow") return addDays(TODAY, 1);
  if (w === "next week") return addDays(TODAY, (8 - toDate(TODAY).getDay()) % 7 || 7);
  if (w === "end of the week" || w === "end of week" || w === "the weekend") {
    const n = (5 - toDate(TODAY).getDay() + 7) % 7;
    return addDays(TODAY, n);
  }
  const next = w.startsWith("next ");
  const day = WEEKDAYS.indexOf(next ? w.slice(5) : w);
  if (day >= 0) {
    let n = (day - toDate(TODAY).getDay() + 7) % 7;
    if (n === 0) n = 7;
    if (next && n < 7) n += 7;
    return addDays(TODAY, n);
  }
  const m1 = w.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)$/);
  const m2 = w.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?$/);
  const dd = m1 ? +m1[1] : m2 ? +m2[2] : NaN;
  const mon = m1 ? MONTHS[m1[2]] : m2 ? MONTHS[m2[1]] : undefined;
  if (!Number.isNaN(dd) && mon !== undefined && dd >= 1 && dd <= 31) {
    const d = new Date(toDate(TODAY).getFullYear(), mon, dd);
    let iso = toIso(d);
    if (diffDays(iso) < -60) iso = toIso(new Date(d.getFullYear() + 1, mon, dd));
    return iso;
  }
  return undefined;
}

const DATE_RE =
  /\b(?:by|on|before|due)\s+((?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|today|tonight|tomorrow|next week|(?:the\s+)?end of (?:the\s+)?week|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9}|[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?)\b/i;
const BARE_DATE_RE = /\b(today|tonight|tomorrow|next week)\b/i;
const NO_DATE_RE = /,?\s*\bno date(?: yet)?\b/i;
const WAIT_RE = /,?\s*\bwaiting (?:on|for) ([\p{L}]+)(?:\s+for\s+(.+?))?(?=,|\s+by\s|\s+for\s|$)/iu;

export function parseSentence(text: string): Parsed {
  const spans: Span[] = [];
  let owner: PersonId | null = null;
  let ownerKnown = false;
  let actionStart = 0;

  const head = text.match(/^\s*([\p{L}']+)(\s+will\b|'ll\b)?\s*/iu);
  if (head) {
    const word = head[1].replace(/'ll$/i, "");
    const who = personFromWord(word);
    if (who !== undefined) {
      owner = who;
      ownerKnown = true;
      const start = head.index! + head[0].indexOf(head[1]);
      spans.push({ kind: "owner", start, end: start + word.length });
      actionStart = head[0].length;
    } else if (head[2]) {
      actionStart = head[0].length;
    }
  }

  const clauses: { start: number; end: number }[] = [];
  let due: string | null = null;
  let waitingOn: PersonId | null = null;
  let waitingFor: string | null = null;
  let forWhom: string | null = null;

  const rest = text.slice(actionStart);
  const at = (i: number) => actionStart + i;

  const dm = rest.match(DATE_RE) ?? rest.match(BARE_DATE_RE);
  if (dm && dm.index !== undefined) {
    const iso = dateFromWords(dm[1]);
    if (iso !== undefined) {
      due = iso;
      spans.push({ kind: "due", start: at(dm.index), end: at(dm.index + dm[0].length) });
      clauses.push({ start: at(dm.index), end: at(dm.index + dm[0].length) });
    }
  } else {
    const nd = rest.match(NO_DATE_RE);
    if (nd && nd.index !== undefined) {
      const s = at(nd.index + nd[0].search(/no/i));
      spans.push({ kind: "due", start: s, end: at(nd.index + nd[0].length) });
      clauses.push({ start: at(nd.index), end: at(nd.index + nd[0].length) });
    }
  }

  const wm = rest.match(WAIT_RE);
  if (wm && wm.index !== undefined) {
    const who = personFromWord(wm[1]);
    if (who) {
      waitingOn = who;
      waitingFor = wm[2]?.trim() || null;
      const s = at(wm.index + wm[0].search(/waiting/i));
      spans.push({ kind: "waiting", start: s, end: at(wm.index + wm[0].length) });
      clauses.push({ start: at(wm.index), end: at(wm.index + wm[0].length) });
    }
  }

  // "for X": a known client or event first, then any capitalised name.
  const lower = fold(rest);
  let best: { start: number; end: number; value: string } | null = null;
  for (const opt of [...FOR_OPTIONS, "Mara and Finn", "Doyle 50th", "open day", ...PEOPLE.map((p) => p.name)]) {
    const needle = `for ${fold(opt)}`;
    let i = lower.indexOf(needle);
    while (i >= 0) {
      const after = lower[i + needle.length];
      const inside = clauses.some((cl) => at(i) >= cl.start && at(i) < cl.end);
      if ((after === undefined || /[\s,.]/.test(after)) && !inside) {
        const value = opt === "Mara and Finn" ? "Mara & Finn" : opt === "Doyle 50th" ? "the Doyle 50th" : opt === "open day" ? "the open day" : opt;
        if (!best || i < best.start) best = { start: i, end: i + needle.length, value };
        break;
      }
      i = lower.indexOf(needle, i + 1);
    }
  }
  if (!best) {
    const cap = rest.match(/\bfor ((?:the\s+)?[A-Z][\p{L}'0-9]*(?:\s+(?:&|and)\s+[A-Z][\p{L}']*|\s+[A-Z0-9][\p{L}'0-9]*)*)/u);
    if (cap && cap.index !== undefined) {
      const inside = clauses.some((cl) => at(cap.index!) >= cl.start && at(cap.index!) < cl.end);
      if (!inside) best = { start: cap.index, end: cap.index + cap[0].length, value: cap[1] };
    }
  }
  if (best) {
    forWhom = best.value;
    spans.push({ kind: "for", start: at(best.start), end: at(best.end) });
    clauses.push({ start: at(best.start), end: at(best.end) });
  }

  // The action is everything after "will" up to the first clause.
  const firstClause = clauses.length ? Math.min(...clauses.map((cl) => cl.start)) : text.length;
  const rawAction = text.slice(actionStart, Math.max(actionStart, firstClause));
  const action = rawAction.replace(/[\s,.;]+$/, "").trim();
  if (action && (ownerKnown || clauses.length)) {
    const s = actionStart + rawAction.indexOf(action);
    spans.push({ kind: "action", start: s, end: s + action.length });
  }

  spans.sort((a, b) => a.start - b.start);
  return { owner, ownerKnown, action, due, forWhom, waitingOn, waitingFor, spans };
}
