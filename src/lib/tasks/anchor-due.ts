/**
 * Reads a task's due date against the workspace's anchor date.
 *
 * A wedding workspace has one date that every other date is judged by. The
 * board already knows a task is due on 14 May; it does not know whether that
 * is four months out or four days out. This module answers that in calendar
 * days, with no elapsed-millisecond or DST arithmetic, so a due date can be
 * read as a position in the plan rather than as a bare date.
 *
 * The anchor is `workspaces.primary_date` with `workspaces.primary_date_label`
 * as its noun. Nothing here is wedding-specific in the data model: a workspace
 * with no anchor gets no relation and no line renders.
 *
 * Counts are exact days. No rounding to weeks or months, because "about six
 * weeks" is a different claim from the one the dates support.
 */

import {
  calendarDaysBetween,
  isCalendarDate,
  type CalendarDate,
} from "@/lib/planning/dates";

export type DueAnchorRelation = Readonly<{
  /** Where the due date sits relative to the anchor. */
  state: "before" | "on" | "after";
  /** Absolute calendar-day distance. Zero when `state` is "on". */
  days: number;
  /** Sentence-case line ready to render, e.g. "42 days before the wedding". */
  label: string;
}>;

/** Fallback noun when the workspace has an anchor date but no label. */
const DEFAULT_ANCHOR_NOUN = "the day";

/**
 * The noun this anchor is referred to by, as it reads inside a sentence.
 *
 * "Wedding" becomes "the wedding". A label that already starts with an
 * article is left alone so "The day itself" does not become "the the day".
 */
export function anchorNoun(anchorLabel: string | null | undefined): string {
  const trimmed = (anchorLabel ?? "").trim();
  if (trimmed.length === 0) return DEFAULT_ANCHOR_NOUN;
  const lowered = trimmed.toLowerCase();
  if (/^(the|our|your|my)\s/.test(lowered)) return lowered;
  return `the ${lowered}`;
}

/** Reads a Date as a calendar date in the frame's own terms. */
export function toCalendarDate(value: Date): CalendarDate | null {
  if (Number.isNaN(value.getTime())) return null;
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const candidate = `${year}-${month}-${day}`;
  return isCalendarDate(candidate) ? candidate : null;
}

/**
 * Relate a due date to the workspace anchor.
 *
 * Returns null when either date is missing or malformed, so callers can
 * render nothing rather than render a guess.
 */
export function relateDueToAnchor(
  due: string | null | undefined,
  anchor: string | null | undefined,
  anchorLabel?: string | null,
): DueAnchorRelation | null {
  if (!isCalendarDate(due) || !isCalendarDate(anchor)) return null;

  const noun = anchorNoun(anchorLabel);
  // Positive when the due date falls before the anchor.
  const days = calendarDaysBetween(due, anchor);

  if (days === 0) {
    return { state: "on", days: 0, label: `On ${noun}` };
  }
  const magnitude = Math.abs(days);
  const unit = magnitude === 1 ? "day" : "days";
  if (days > 0) {
    return {
      state: "before",
      days: magnitude,
      label: `${magnitude} ${unit} before ${noun}`,
    };
  }
  return {
    state: "after",
    days: magnitude,
    label: `${magnitude} ${unit} after ${noun}`,
  };
}

/**
 * How far the anchor itself is from today.
 *
 * Used to head the date picker so the couple can place a task without
 * counting on their fingers. Returns null when there is no anchor.
 */
export function describeAnchorFromToday(
  today: string | null | undefined,
  anchor: string | null | undefined,
  anchorLabel?: string | null,
): string | null {
  if (!isCalendarDate(today) || !isCalendarDate(anchor)) return null;
  const noun = anchorNoun(anchorLabel);
  const sentenceNoun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const days = calendarDaysBetween(today, anchor);
  if (days === 0) return `${sentenceNoun} is today`;
  const magnitude = Math.abs(days);
  const unit = magnitude === 1 ? "day" : "days";
  if (days > 0) return `${sentenceNoun} is in ${magnitude} ${unit}`;
  return `${sentenceNoun} was ${magnitude} ${unit} ago`;
}
