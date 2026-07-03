import type { RecurrenceSpec } from "@/lib/data";

/**
 * Parse a natural-language recurrence phrase.
 *
 * Exactly three patterns are supported:
 *
 *   "every Tuesday"                     → weekly on Tuesday
 *   "first of the month"                → monthly on day 1
 *   "15th of the month"                 → monthly on day 15
 *   "every first Monday of the month"   → first Monday of each month
 *
 * Everything else → null. No "every other Tuesday." No "weekdays."
 * Returning null is not an error, it means the phrase was not
 * parseable and the caller should surface the refusal UX.
 *
 * Weekday integers follow JS Date.getDay(): 0=Sun … 6=Sat.
 */
export function parseRecurrence(text: string): RecurrenceSpec | null {
  const t = text.trim().toLowerCase();

  // ── pattern 3: "every first <weekday> of the month" ─────────────
  // Must come before pattern 1 because it also starts with "every".
  const firstWeekdayMatch = t.match(
    /^every\s+first\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+of\s+(the|every)\s+month$/,
  );
  if (firstWeekdayMatch) {
    const wd = WEEKDAY_MAP[firstWeekdayMatch[1]];
    if (wd !== undefined) return { kind: "monthly-first-weekday", weekday: wd };
  }

  // ── pattern 1: "every <weekday>" ─────────────────────────────────
  const weeklyMatch = t.match(
    /^every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (weeklyMatch) {
    const wd = WEEKDAY_MAP[weeklyMatch[1]];
    if (wd !== undefined) return { kind: "weekly", weekday: wd };
  }

  // ── pattern 2: "<ordinal> of [the|every] month" ──────────────────
  // Accepts: "first", "1st", "2nd", "3rd", "4th"–"31st", numeric day.
  const monthlyMatch = t.match(
    /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-?first|twenty-?second|twenty-?third|twenty-?fourth|twenty-?fifth|twenty-?sixth|twenty-?seventh|twenty-?eighth|twenty-?ninth|thirtieth|thirty-?first|\d{1,2}(?:st|nd|rd|th)?)\s+of\s+(?:the|every)\s+month$/,
  );
  if (monthlyMatch) {
    const day = parseOrdinal(monthlyMatch[1]);
    if (day !== null && day >= 1 && day <= 31)
      return { kind: "monthly-day", day };
  }

  return null;
}

/**
 * Produce a short human label from a RecurrenceSpec.
 * Used in the chip ("Repeats: every Tuesday") and the refusal hint.
 */
export function formatRecurrenceLabel(r: RecurrenceSpec): string {
  if (r.kind === "weekly") {
    return `every ${WEEKDAY_NAMES[r.weekday]}`;
  }
  if (r.kind === "monthly-day") {
    return `${ordinalSuffix(r.day)} of the month`;
  }
  // monthly-first-weekday
  return `every first ${WEEKDAY_NAMES[r.weekday]} of the month`;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const WORD_TO_NUM: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty-first": 21,
  "twentyfirst": 21,
  "twenty-second": 22,
  "twentysecond": 22,
  "twenty-third": 23,
  "twentythird": 23,
  "twenty-fourth": 24,
  "twentyfourth": 24,
  "twenty-fifth": 25,
  "twentyfifth": 25,
  "twenty-sixth": 26,
  "twentysixth": 26,
  "twenty-seventh": 27,
  "twentyseventh": 27,
  "twenty-eighth": 28,
  "twentyeighth": 28,
  "twenty-ninth": 29,
  "twentyninth": 29,
  thirtieth: 30,
  "thirty-first": 31,
  "thirtyfirst": 31,
};

function parseOrdinal(s: string): number | null {
  // Try word form first
  const normalized = s.replace(/\s+/g, " ").trim();
  if (WORD_TO_NUM[normalized] !== undefined) return WORD_TO_NUM[normalized];
  // Numeric with suffix: "15th", "1st", "22nd"
  const numMatch = normalized.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Scan a raw task input string for a recurrence phrase. Returns the
 * parsed RecurrenceSpec and the input with the phrase scrubbed out,
 * or null if no phrase was found.
 *
 * Convention matches the date parser in `parse-task-input.ts`:
 * strip the matched phrase, collapse whitespace, return the clean title.
 *
 * Phrases tested (trailing position):
 *   "Send invoice every Tuesday"         → title "Send invoice"
 *   "Review slides first of the month"   → title "Review slides"
 */
export function extractRecurrence(raw: string): {
  recurrence: RecurrenceSpec;
  title: string;
} | null {
  const input = raw.trim();
  if (!input) return null;

  // The three pattern anchors we try to match at the END of the string.
  // Order matters: test the most-specific first.
  const TRAILING_PATTERNS = [
    // "every first <weekday> of [the|every] month"
    /\s*(every\s+first\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+of\s+(?:the|every)\s+month)\s*$/i,
    // "every <weekday>"
    /\s*(every\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\s*$/i,
    // "<ordinal> of [the|every] month"
    /\s*((?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-?first|twenty-?second|twenty-?third|twenty-?fourth|twenty-?fifth|twenty-?sixth|twenty-?seventh|twenty-?eighth|twenty-?ninth|thirtieth|thirty-?first|\d{1,2}(?:st|nd|rd|th)?)\s+of\s+(?:the|every)\s+month)\s*$/i,
  ];

  for (const pattern of TRAILING_PATTERNS) {
    const m = input.match(pattern);
    if (!m) continue;

    const phrase = m[1];
    const recurrence = parseRecurrence(phrase);
    if (!recurrence) continue;

    // Scrub the phrase from the input, strip trailing punctuation/whitespace.
    const before = input.slice(0, input.length - m[0].length);
    const title = before.replace(/[\s,;:.]+$/, "").trim() || input;
    return { recurrence, title };
  }

  return null;
}

/**
 * Detect whether the input LOOKS LIKE a recurrence attempt that the
 * parser couldn't handle. Surfaces the refusal hint when true.
 *
 * Heuristics (deliberately loose):
 *   - contains "every other"
 *   - contains "every N" (digit)
 *   - contains "weekdays" / "weekends"
 *   - contains "every" but not followed by a supported weekday name
 */
export function looksLikeUnsupportedRecurrence(raw: string): boolean {
  const t = raw.toLowerCase();
  if (/every\s+other/.test(t)) return true;
  if (/every\s+\d/.test(t)) return true;
  if (/\b(?:weekdays|weekends)\b/.test(t)) return true;
  // "every X" where X is not a weekday or "first"
  if (
    /every\s+/.test(t) &&
    !/every\s+(?:first\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}
