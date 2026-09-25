/**
 * Quick-add date phrases (Timeline v3, round 2).
 *
 * Typing "Florist 12 Nov" into the milestone composer shows a date chip
 * before anything is saved, and the chip can be removed. This is the pure
 * half: it reads a trailing date phrase off the end of what was typed and
 * returns the title without it plus the calendar day it names.
 *
 * Deterministic and local. `todayIso` is always passed in, nothing reads a
 * clock, and only these shapes are understood (en-IE, day before month):
 *
 *   12 Nov · 12 November · 12 Nov 2027 · 12th Nov · on 12 Nov
 *   today · tomorrow
 *   Friday · Fri · next Friday · on Friday
 *
 * A day and month with no year means its next occurrence on or after today.
 * A weekday, with or without "next", means the first one after today. Anything
 * else is left in the title and no date is guessed: the chip is the promise,
 * so it only appears when the phrase is unambiguous.
 */

import { addDays, isIsoDay, weekdayOf } from "@/lib/projects/project-portfolio-scale";

export type QuickDate = Readonly<{ title: string; date: string | null }>;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const WEEKDAYS: Readonly<Record<string, number>> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTH_WORD = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const WEEKDAY_WORD = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");

// Each pattern is anchored at the end and may be preceded by "on" or "by".
const DAY_MONTH = new RegExp(`(?:^|\\s)(?:(?:on|by)\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORD})\\.?(?:\\s+(\\d{4}))?\\s*$`, "i");
const RELATIVE = /(?:^|\s)(?:(?:on|by)\s+)?(today|tomorrow)\s*$/i;
const WEEKDAY = new RegExp(`(?:^|\\s)(?:(?:on|by)\\s+)?(?:(next)\\s+)?(${WEEKDAY_WORD})\\.?\\s*$`, "i");

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayMonth(day: number, month: number, year: number): string | null {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isIsoDay(iso) ? iso : null;
}

function cleanTitle(text: string): string {
  return text.replace(/[\s,;:–-]+$/, "").trim();
}

/**
 * Read a trailing date phrase. Returns the title without it and the day, or
 * the text unchanged (trimmed) and `null` when there is no phrase, when the
 * phrase names a day that does not exist, or when nothing would be left of
 * the title.
 */
export function parseQuickDate(text: string, todayIso: string): QuickDate {
  const input = text.replace(/\s+/g, " ").trim();
  const none: QuickDate = { title: input, date: null };
  if (!input || !isIsoDay(todayIso)) return none;
  const thisYear = Number(todayIso.slice(0, 4));

  const withTitle = (match: RegExpExecArray, date: string | null): QuickDate => {
    if (!date) return none;
    const title = cleanTitle(input.slice(0, match.index));
    return title ? { title, date } : none;
  };

  const dm = DAY_MONTH.exec(input);
  if (dm) {
    const day = Number(dm[1]);
    const month = MONTHS[dm[2].toLowerCase()];
    if (dm[3]) return withTitle(dm, dayMonth(day, month, Number(dm[3])));
    const sameYear = dayMonth(day, month, thisYear);
    if (sameYear && sameYear >= todayIso) return withTitle(dm, sameYear);
    // Already passed (or 29 Feb in a short year): the next one that exists.
    for (let year = thisYear + 1; year <= thisYear + 8; year += 1) {
      const next = dayMonth(day, month, year);
      if (next) return withTitle(dm, next);
    }
    return none;
  }

  const rel = RELATIVE.exec(input);
  if (rel) return withTitle(rel, rel[1].toLowerCase() === "today" ? todayIso : addDays(todayIso, 1));

  const wd = WEEKDAY.exec(input);
  if (wd) {
    const target = WEEKDAYS[wd[2].toLowerCase()];
    const ahead = ((target - weekdayOf(todayIso) + 7) % 7) || 7;
    return withTitle(wd, addDays(todayIso, ahead));
  }

  return none;
}
