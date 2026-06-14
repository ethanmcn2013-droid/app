import * as chrono from "chrono-node";
import type { RecurrenceSpec } from "@/lib/data";
import { extractRecurrence } from "@/lib/nlp/parse-recurrence";

export type ParsedTaskInput = {
  /** The task's clean title — date, recurrence AND #tag phrases stripped. */
  title: string;
  /** Structured due date if one was found in the input. */
  dueAt?: Date;
  /** A short human label for the due date — e.g. "Today", "Fri",
   *  "Mar 14, 3pm". Designed to fit in the existing `task.due` text
   *  column and the chip on cards. */
  dueLabel?: string;
  /** Parsed recurrence spec if a supported recurrence phrase was found. */
  recurrence?: RecurrenceSpec;
  /** Inline #tags found in the input. Tags are this product's only
   *  project primitive (tags-as-projects, SUITE.md §4) — capturing one
   *  inline lets a note land in the right "project" at quick-add speed
   *  without a picker. Lowercased, de-duped, order-preserved. */
  tags?: string[];
};

/**
 * Pull inline #tags out of a quick-add string and strip them from the
 * title. A tag is `#` followed by a letter/digit then letters, digits,
 * hyphens or underscores — matching the kebab tag style used across the
 * workspace (e.g. `#claire-wedding`). The leading `#` and the token are
 * removed from the returned title.
 */
function extractTags(input: string): { title: string; tags: string[] } {
  const tags: string[] = [];
  const seen = new Set<string>();
  const TAG_RE = /(?:^|\s)#([a-z0-9][a-z0-9_-]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(input)) !== null) {
    const tag = m[1].toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  if (tags.length === 0) return { title: input, tags };
  const title = input.replace(TAG_RE, " ").replace(/\s+/g, " ").trim();
  return { title, tags };
}

/** Days of the week names → for short formatting. */
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Months for "Mar 14" style. */
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Format a Date as a tight chip-friendly label:
 *   - same day → "Today"
 *   - tomorrow → "Tomorrow"
 *   - within a week → "Fri" (or "Fri 3pm" if a time was specified)
 *   - this year → "Mar 14"
 *   - other → "Mar 14, '27"
 *
 * The optional `withTime` param controls whether to append "3pm"-style
 * suffix. Pass true when the parser detected an explicit time.
 */
export function formatDueLabel(d: Date, withTime = false): string {
  const now = new Date();
  const dayDelta =
    (startOfDay(d) - startOfDay(now)) / (24 * 60 * 60 * 1000);

  let timeSuffix = "";
  if (withTime) {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    timeSuffix =
      m === 0 ? ` ${hour12}${ampm}` : ` ${hour12}:${m.toString().padStart(2, "0")}${ampm}`;
  }

  if (dayDelta === 0) return `Today${timeSuffix}`;
  if (dayDelta === 1) return `Tomorrow${timeSuffix}`;
  if (dayDelta > 1 && dayDelta < 7) {
    return `${DOW_SHORT[d.getDay()]}${timeSuffix}`;
  }
  const m = MONTH_SHORT[d.getMonth()];
  if (d.getFullYear() === now.getFullYear()) {
    return `${m} ${d.getDate()}${timeSuffix}`;
  }
  return `${m} ${d.getDate()}, '${(d.getFullYear() % 100).toString().padStart(2, "0")}${timeSuffix}`;
}

/**
 * Parse a quick-add task string for natural-language date references.
 *
 * Strips the date phrase (and any "by"/"on"/"due" lead-in) from the
 * title. Returns a structured Date plus a tight human label suitable
 * for the existing chip slot.
 *
 * Examples (today is Mon Mar 3):
 *   "Finish pitch deck by next Friday at 3pm"
 *     → title "Finish pitch deck", dueLabel "Fri 3pm"
 *
 *   "Submit thesis tomorrow"
 *     → title "Submit thesis", dueLabel "Tomorrow"
 *
 *   "Email Prof Liu"
 *     → title "Email Prof Liu", dueLabel undefined
 */
export function parseTaskInput(raw: string): ParsedTaskInput {
  const input = raw.trim();
  if (!input) return { title: "" };

  // Strip #tags first so they never reach chrono or end up in the title.
  const { title: inputAfterTags, tags } = extractTags(input);
  const tagsOut = tags.length ? tags : undefined;

  // Strip recurrence phrase next — the date parser sees a cleaner string.
  const recurrenceResult = extractRecurrence(inputAfterTags);
  const inputAfterRecurrence = recurrenceResult?.title ?? inputAfterTags;
  const recurrence = recurrenceResult?.recurrence;

  const results = chrono.parse(inputAfterRecurrence, new Date(), {
    forwardDate: true,
  });
  if (results.length === 0) {
    return { title: inputAfterRecurrence || input, recurrence, tags: tagsOut };
  }

  // Use the LAST match — usually the trailing "by next Friday" form.
  // Stripping the rightmost date keeps the leading verb phrase intact.
  const r = results[results.length - 1];
  const dueAt = r.start.date();
  const hasTime = r.start.isCertain("hour") || r.start.isCertain("minute");

  // Strip the date span itself plus a preceding "by"/"on"/"at"/"due"
  // / em-dash / hyphen lead-in if present.
  const lead = inputAfterRecurrence.slice(0, r.index);
  const trail = inputAfterRecurrence.slice(r.index + r.text.length);

  const cleanedLead = lead.replace(
    /\s*(?:by|on|at|due|due on|@|—|–|-|·)\s*$/i,
    "",
  );
  const cleanedTrail = trail.replace(/^[\s,;:.]+/, "");

  let title = (cleanedLead + " " + cleanedTrail).replace(/\s+/g, " ").trim();
  // If we end up with nothing (e.g. raw was just "next Friday"), keep
  // the original — better a date-shaped title than an empty task.
  if (!title) title = inputAfterRecurrence || input;

  const dueLabel = formatDueLabel(dueAt, hasTime);
  return { title, dueAt, dueLabel, recurrence, tags: tagsOut };
}
