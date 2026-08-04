import type { TaskSignal, TriggerKind } from "./types";

/**
 * Prose phrasings, three per trigger for v1. Rotation by index is
 * applied per (user, day) via a stable hash in build.ts so users
 * don't get the same phrasing two days running.
 *
 * Each phrasing returns the OBSERVATION only, never the task title.
 * The row's headline is the title itself (build.ts owns that split),
 * so every sentence here has to stay grammatical against any title
 * shape: an imperative ("Send the invitations."), a question ("Do we
 * need a marquee?"), a shout ("URGENT: confirm the band"). The subject
 * is therefore a pronoun or implicit, never an interpolated title.
 * Interpolating the title was the old failure: "Approve the final
 * seating plan is 2 days overdue".
 *
 * Voice rules (from docs/COLLABORATION_LOOP.md):
 *  - Plain English.
 *  - Never chart language.
 *  - Always has a clear "so what".
 *  - No percentages without an action.
 */

type Phrasing = (
  task: TaskSignal,
  days?: number,
  /** Resolved upstream blocker titles in order. Empty → no
   *  named blocker (generic fallback prose). One title → "X". Two
   *  titles → "X and Y" (both named, conversational). Three+ →
   *  "X and N more" (named lead + count). */
  byTitles?: string[],
) => string;

const STUCK: Phrasing[] = [
  (_t, days = 0) => `Nothing has moved on it for ${duration(days)}.`,
  (_t, days = 0) => `Quiet for ${plural(days, "day", "days")} now.`,
  (_t, days = 0) => `Open and untouched, ${duration(days)}.`,
];

const DUE_SOON: Phrasing[] = [
  (_t, daysOut = 0) =>
    daysOut < 0
      ? `${capitalise(plural(Math.abs(daysOut), "day", "days"))} past its date.`
      : daysOut < 1
        ? "Due today."
        : `Due ${byWhen(daysOut)}.`,
  (_t, daysOut = 0) =>
    daysOut < 0
      ? `The date passed ${plural(Math.abs(daysOut), "day", "days")} ago.`
      : daysOut < 1
        ? "The date is today."
        : `The date lands ${byWhen(daysOut)}.`,
  (_t, daysOut = 0) =>
    daysOut < 0
      ? `Still open ${plural(Math.abs(daysOut), "day", "days")} after it was due.`
      : daysOut < 1
        ? "It falls due today."
        : `It comes due ${byWhen(daysOut)}.`,
];

// Only the 24-hour window is known here, so the prose claims the
// window and not a weekday. "Closed out yesterday" would be a guess
// for anything shipped this morning.
const JUST_SHIPPED: Phrasing[] = [
  () => "Closed out in the last day.",
  () => "Marked done within the last twenty-four hours.",
  () => "Moved to shipped since this time yesterday.",
];

// The headline already carries the count, so the detail interprets
// rather than repeats. The old rotations said "in flight" twice in one
// line, borrowed clinical register ("cognitive load is high"), and
// lower-cased a synthetic title for no gain.
const OVERLOAD: Phrasing[] = [
  () => "That is a lot to hold open at the same time.",
  () => "Everything is started and nothing is narrowed.",
  () => "Enough at once that some of it will sit.",
];

const CROWDED_WEEK: Phrasing[] = [
  () => "They all land inside the same seven days.",
  () => "The dates sit on top of each other.",
  () => "One week is carrying all of them.",
];

/**
 * A title cleared to run inside a sentence, or null when it cannot.
 *
 * The rule the whole engine turns on is that a title is the reader's own
 * words, so it is a headline and never a clause. The one place the split
 * leaks is the upstream blocker, which has no row of its own and can only
 * be named inline. Two title shapes cannot survive that:
 *
 *  - a question or a shout carries its own mark wherever it goes, so it
 *    can never be the object of a clause. "Blocked by Do we need a
 *    marquee? for nine days." was the live string.
 *  - a shouted prefix ("URGENT: confirm the band") drags its register
 *    into a sentence that is meant to be quiet.
 *
 * Both are counted instead of named. Everything else keeps its words and
 * loses only its terminal punctuation, because the sentence supplies its
 * own full stop and "waiting on Send the invitations.." is not a sentence.
 */
function inlineTitle(raw: string | undefined): string | null {
  const title = (raw ?? "").trim();
  if (!title) return null;
  if (title.includes("?") || title.includes("!")) return null;
  if (/^[A-Z][A-Z0-9]{2,}[A-Z0-9 ]*:/.test(title)) return null;
  const trimmed = title.replace(/[.,;:]+$/, "").trim();
  return trimmed.length ? trimmed : null;
}

/** What the sentence says when a blocker cannot be named inline. */
function unnamedBlockers(count: number): string {
  return count === 1
    ? "one upstream item"
    : `${numberWord(count)} upstream items`;
}

// Build the blocker subject string. Centralised so all three
// phrasings produce consistent multi-blocker form. Only the titles that
// actually get rendered are cleared, so one unnameable title at the back
// of a long list does not silence the lead.
//   0 titles  → null (generic fallback)
//   1 title   → "X"                   or "one upstream item"
//   2 titles  → "X and Y"             or "two upstream items"
//   3+ titles → "X and two more"      or "four upstream items"
function blockerSubject(titles: string[]): string | null {
  const total = titles.length;
  if (total === 0) return null;
  if (total === 1) return inlineTitle(titles[0]) ?? unnamedBlockers(1);
  if (total === 2) {
    const first = inlineTitle(titles[0]);
    const second = inlineTitle(titles[1]);
    return first && second ? `${first} and ${second}` : unnamedBlockers(2);
  }
  const lead = inlineTitle(titles[0]);
  return lead
    ? `${lead} and ${numberWord(total - 1)} more`
    : unnamedBlockers(total);
}

// The blocker subject can be plural ("X and Y"), so no phrasing here
// may put a verb in agreement with it. No phrasing may follow the
// subject with a preposition either: the second rotation used to read
// "Blocked by {title} for nine days", which handed every imperative
// title a second reading ("send the invitations for nine days"). The
// subject now always sits at the end of its clause, in front of a
// full stop.
const BLOCKED_TOO_LONG: Phrasing[] = [
  (_t, days = 0, byTitles = []) => {
    const subject = blockerSubject(byTitles);
    const age = capitalise(plural(days, "day", "days"));
    return subject
      ? `Waiting on ${subject}. ${age} now.`
      : `Waiting on something upstream. ${age} now.`;
  },
  (_t, days = 0, byTitles = []) => {
    const subject = blockerSubject(byTitles);
    return subject
      ? `Blocked for ${plural(days, "day", "days")}, still waiting on ${subject}.`
      : `Blocked for ${plural(days, "day", "days")}.`;
  },
  (_t, days = 0, byTitles = []) => {
    const subject = blockerSubject(byTitles);
    const age = capitalise(plural(days, "day", "days"));
    return subject
      ? `${age} waiting on ${subject}.`
      : `${age} waiting, with nothing upstream cleared.`;
  },
];

const LIBRARY: Record<TriggerKind, Phrasing[]> = {
  "stuck-work": STUCK,
  "due-soon": DUE_SOON,
  "just-shipped": JUST_SHIPPED,
  overload: OVERLOAD,
  "crowded-week": CROWDED_WEEK,
  "blocked-too-long": BLOCKED_TOO_LONG,
};

/**
 * The observation for a row, never its headline. Callers pair the
 * return value with the task title, which they render verbatim.
 */
export function phraseFor(
  trigger: TriggerKind,
  task: TaskSignal,
  rotationIndex: number,
  context?: {
    idleDays?: number;
    daysOut?: number;
    /** Resolved titles of upstream blocker tasks (in order). */
    blockedByTitles?: string[];
  },
): string {
  const options = LIBRARY[trigger];
  const phrasing = options[rotationIndex % options.length];
  if (trigger === "stuck-work")
    return phrasing(task, context?.idleDays ?? task.idleDays);
  if (trigger === "due-soon") return phrasing(task, context?.daysOut ?? 0);
  if (trigger === "blocked-too-long") {
    return phrasing(
      task,
      context?.idleDays ?? task.idleDays,
      context?.blockedByTitles ?? [],
    );
  }
  return phrasing(task);
}

// ─────────────────────────────────────────────────────────────
// helpers, kept terse, prose lives in the phrasings themselves
// ─────────────────────────────────────────────────────────────

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
] as const;

/**
 * Spell a small number, print anything past twenty as a figure. Prose
 * reads as prose ("quiet for eighteen days"); a large count reads
 * better as a figure ("41 days"). Shared with triggers.ts so the row
 * and its "Why this" receipt say the number the same way.
 */
export function numberWord(n: number): string {
  const whole = Math.max(0, Math.round(n));
  return whole <= 20 ? NUMBER_WORDS[whole] : String(whole);
}

export function capitalise(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export function plural(n: number, single: string, many: string): string {
  const whole = Math.max(0, Math.round(n));
  return `${numberWord(whole)} ${whole === 1 ? single : many}`;
}

/**
 * Duration phrase for "nothing has moved on it for X". It states the day
 * count and nothing else. The row must never be coarser than its own
 * evidence: an earlier version called 18 days "3 weeks" beside a receipt
 * reading "No status update in 18 days", and the repair kept a vague
 * branch past 30 days, so at 59 idle days the row said "over a month"
 * while the reader could still count 59. One unit, one number, no split.
 */
function duration(days: number): string {
  const whole = Math.max(0, Math.floor(days));
  if (whole <= 1) return "a day";
  return plural(whole, "day", "days");
}

/** Same no-rounding-up rule as duration(): weeks are floored. */
function byWhen(daysOut: number): string {
  if (daysOut < 1) return "today";
  if (daysOut < 2) return "tomorrow";
  if (daysOut < 7) return `in ${plural(Math.floor(daysOut), "day", "days")}`;
  return `in ${plural(Math.floor(daysOut / 7), "week", "weeks")}`;
}
