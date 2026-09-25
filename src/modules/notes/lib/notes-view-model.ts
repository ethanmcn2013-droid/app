/**
 * The Notes view model.
 *
 * Everything on this page that turns a stored row into something a person
 * reads lives here: which of the three views a note belongs to, what its
 * list row says, how old it looks, and what the counts in the header mean.
 *
 * Pure. No React, no server imports, no DB. Safe from a client component
 * and from a test, which is the point: the rules a person sees are the
 * rules the tests check.
 */

import { withActiveProject } from "@/lib/projects/project-url";
import type { ProjectId } from "@/lib/projects/project-ref";

/** The four capture routes, plus the calendar scaffold that predates them. */
export type NoteSource = "typed" | "voice" | "photo" | "email" | "calendar";

/** The three local views. Notebook is the resting state. */
export type NotesView = "notebook" | "review" | "sent";

/** How the notebook list is ordered. */
export type NotebookSort = "newest" | "oldest";

/** Optional narrowing of the notebook list. */
export type NotebookFilter = "all" | "typed" | "voice" | "photo" | "email" | "review";

export const NOTES_VIEWS: readonly NotesView[] = ["notebook", "review", "sent"];

/** Minimum a note must carry for this module to present it. */
export type PresentableNote = {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  extractBody: string | null;
  promotedTaskId: string | null;
  archivedAt: number | null;
  reviewedAt: number | null;
  source: string | null;
  workspaceId: string | null;
};

/**
 * A stored `source` of null means the note was written in the composer.
 * Every note that existed before capture provenance was recorded reads as
 * typed, which is what it was, so nothing needs backfilling.
 */
export function noteSource(source: string | null | undefined): NoteSource {
  switch (source) {
    case "voice":
    case "photo":
    case "email":
    case "calendar":
      return source;
    default:
      return "typed";
  }
}

/** What the source icon's accessible label says. */
export const SOURCE_LABELS: Record<NoteSource, string> = {
  typed: "Written",
  voice: "Spoken",
  photo: "From a photo",
  email: "By email",
  calendar: "From your calendar",
};

/**
 * A note has no title column and never will: asking someone to name a
 * thought before writing it down is the friction this product exists to
 * remove. The first meaningful line is the title, the rest is the preview.
 */
export function derivePresentation(body: string): {
  title: string;
  preview: string;
} {
  const lines = body.split(/\r?\n/);
  let titleIndex = lines.findIndex((line) => line.trim().length > 0);
  if (titleIndex < 0) titleIndex = 0;
  const firstLine = (lines[titleIndex] ?? "").trim();
  const rest = lines
    .slice(titleIndex + 1)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!firstLine) return { title: "Untitled note", preview: rest };

  // The row and the reader name a note the same way: one rule, splitLead.
  // The row only adds a character clamp for a first line with no natural
  // break, and CSS clamps it visually before that anyway.
  const { title, lead } = splitLead(firstLine);
  return { title: clampTitle(title), preview: [lead, rest].filter(Boolean).join(" ") };
}

/** A first line this short is always the whole title. */
const LEAD_TITLE_MAX = 72;
/** A break must land after this many characters to make a useful title. */
const LEAD_BREAK_MIN = 16;
/** ...and within this many, or the title is a paragraph. */
const LEAD_BREAK_MAX = 120;

/**
 * Splits a note's first line into the title and what continues it.
 *
 * Most notes are one paragraph with no line breaks at all. A short line is
 * the title. A long one is cut after its first sentence or its first colon,
 * provided that break names something (past character 16) and comes early
 * (within the first 120). Without such a break the whole line is the title:
 * a note is never cut at an arbitrary word, because a heading that ends on
 * a dangling word, with the body resuming mid-clause, reads as broken.
 */
export function splitLead(firstLine: string): { title: string; lead: string } {
  const line = firstLine.trim();
  if (line.length <= LEAD_TITLE_MAX) return { title: line, lead: "" };
  const match = /[.!?](?=\s|$)|:(?=\s)/g;
  for (const hit of line.matchAll(match)) {
    const index = hit.index ?? -1;
    if (index <= LEAD_BREAK_MIN) continue;
    if (index >= LEAD_BREAK_MAX) break;
    return { title: line.slice(0, index + 1).trim(), lead: line.slice(index + 1).trim() };
  }
  return { title: line, lead: "" };
}

function clampTitle(value: string): string {
  return value.length > LEAD_BREAK_MAX ? `${value.slice(0, LEAD_BREAK_MAX - 1).trimEnd()}…` : value;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Dates people say out loud. "3d ago" is a log line, not a sentence.
 *
 * Calendar-aware where it matters: something captured at 23:50 reads
 * "Yesterday" at 00:10, not "20 minutes ago", because that is what a person
 * means. Beyond a week it becomes a date, and beyond this year it carries
 * the year so an old note is never mistaken for a recent one.
 */
/**
 * Intl formatters are expensive to construct and free to reuse.
 *
 * Building one inside the function cost 425ms to render a 500-note list,
 * 27x the cost of reusing them. They are cached per time zone because the
 * signature allows one, not because anything passes a second today.
 */
const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const shortDateFormatters = new Map<string, Intl.DateTimeFormat>();

function cached(
  store: Map<string, Intl.DateTimeFormat>,
  key: string,
  build: () => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  const existing = store.get(key);
  if (existing) return existing;
  const created = build();
  store.set(key, created);
  return created;
}

export function friendlyDate(
  timestamp: number,
  now: number,
  timeZone = "Europe/Dublin",
): string {
  const diff = now - timestamp;
  if (diff < 0) return "Just now";
  if (diff < MINUTE) return "Just now";
  const dayKey = cached(dayKeyFormatters, timeZone, () =>
    new Intl.DateTimeFormat("en-IE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  );
  const startOfDay = (value: number) => {
    const parts = dayKey.formatToParts(new Date(value));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  const today = startOfDay(now);
  const then = startOfDay(timestamp);
  // The calendar day is decided before the elapsed time is read as a
  // sentence: a note from 23:50 is "Yesterday" at 00:10, not "20 minutes
  // ago", even though less than an hour has elapsed. Elapsed-time wording
  // only applies within the day it happened.
  if (today === then) {
    if (diff < HOUR) {
      const minutes = Math.floor(diff / MINUTE);
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const yesterday = startOfDay(now - DAY);
  if (yesterday === then) return "Yesterday";
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days} days ago`;
  const sameYear = today.slice(0, 4) === then.slice(0, 4);
  return cached(shortDateFormatters, `${timeZone}:${sameYear}`, () =>
    new Intl.DateTimeFormat("en-IE", {
      timeZone,
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    }),
  ).format(new Date(timestamp));
}

/** The compact form, for places where a row is genuinely tight. */
export function compactDate(timestamp: number, now: number): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: "Europe/Dublin",
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

/**
 * Sent means a task exists for this note.
 *
 * Not "archived". The send path writes `promoted_task_id` and deliberately
 * leaves `archived_at` null, so the note stays in the notebook. Archiving is
 * the older promote path, which the current product refuses to run. Reading
 * Sent off the archive flag is what made the old history pane look empty on
 * an account that had sent plenty.
 */
export function isSent(note: PresentableNote): boolean {
  return Boolean(note.promotedTaskId);
}

/** An archived note is out of the notebook until it is restored. */
export function isArchived(note: PresentableNote): boolean {
  return note.archivedAt !== null;
}

/**
 * Review holds the notes nobody has decided about yet.
 *
 * Turning a note into a task is a decision, so a sent note is never queued
 * even if it was sent without passing through Review. Deleting is a decision
 * too, and it takes the row with it.
 */
export function needsReview(note: PresentableNote): boolean {
  return !isArchived(note) && note.reviewedAt === null && !isSent(note);
}

export function inNotebook(note: PresentableNote): boolean {
  return !isArchived(note);
}

export type NotesCounts = { notebook: number; review: number; sent: number };

export function countViews(notes: readonly PresentableNote[]): NotesCounts {
  let notebook = 0;
  let review = 0;
  let sent = 0;
  for (const note of notes) {
    if (inNotebook(note)) notebook += 1;
    if (needsReview(note)) review += 1;
    if (isSent(note)) sent += 1;
  }
  return { notebook, review, sent };
}

/** "10 notes", "1 note", "4 to review", "3 in Tasks" — the label describes
 *  the view. The `sent` key is the internal view id; the words follow the
 *  tab, which reads "In Tasks" since wave 6. */
export function countLabel(view: NotesView, count: number): string {
  if (view === "review") return `${count} to review`;
  if (view === "sent") return `${count} in Tasks`;
  return count === 1 ? "1 note" : `${count} notes`;
}

export function sortNotes(
  notes: readonly PresentableNote[],
  sort: NotebookSort,
): PresentableNote[] {
  const direction = sort === "oldest" ? 1 : -1;
  return [...notes].sort((a, b) => {
    const byDate = (a.createdAt - b.createdAt) * direction;
    // Two notes captured in the same millisecond still need one stable order,
    // or the list reshuffles itself on every render.
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

export function matchesFilter(
  note: PresentableNote,
  filter: NotebookFilter,
): boolean {
  switch (filter) {
    case "typed":
    case "voice":
    case "photo":
    case "email":
      return noteSource(note.source) === filter;
    case "review":
      return needsReview(note);
    default:
      return true;
  }
}

/** Search folds accents and case so "cafe" finds "café". */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-IE")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesQuery(note: PresentableNote, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  if (normalizeSearch(note.body).includes(needle)) return true;
  // The wording that became a task is part of this note's history, so a
  // search for it should find the note it came from.
  return Boolean(note.extractBody && normalizeSearch(note.extractBody).includes(needle));
}

/**
 * A snippet centred on the match, so a hit deep in a long note is visible in
 * the row rather than requiring the note to be opened to find out why it
 * matched.
 */
export function searchSnippet(body: string, query: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  const needle = normalizeSearch(query);
  if (!needle) return derivePresentation(body).preview.slice(0, 200);
  const index = normalizeSearch(compact).indexOf(needle);
  if (index < 0) return compact.slice(0, 200);
  const start = Math.max(0, index - 64);
  const end = Math.min(compact.length, index + needle.length + 110);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${
    end < compact.length ? "…" : ""
  }`;
}

/**
 * Which note the notebook should open with.
 *
 * A route-selected note wins, then whatever was open before, then the newest
 * note. Narrow viewports get null: opening a note over the list before the
 * person has chosen one is how a list turns into a trapdoor.
 */
export function defaultSelection(
  notes: readonly PresentableNote[],
  routeNoteId: string | null,
  narrow: boolean,
): string | null {
  if (routeNoteId && notes.some((note) => note.id === routeNoteId)) {
    return routeNoteId;
  }
  if (narrow) return null;
  return notes[0]?.id ?? null;
}

/** Where the view lives in the URL. `notebook` is the bare route. */
export function viewFromParam(value: string | null | undefined): NotesView {
  return value === "review" || value === "sent" ? value : "notebook";
}

export function notesHref(view: NotesView, noteId: string | null, workspaceId?: ProjectId | null): string {
  const params = new URLSearchParams();
  if (view !== "notebook") params.set("view", view);
  if (noteId) params.set("note", noteId);
  const query = params.toString();
  const href = query ? `/app/notes?${query}` : "/app/notes";
  return workspaceId ? withActiveProject(href, workspaceId) : href;
}

/**
 * A task title derived from a note.
 *
 * The first sentence of the first meaningful line, trimmed of the trailing
 * full stop, capped at the length a task can hold. It is a starting point the
 * person edits, never a silent decision: the composer shows it before
 * anything is created.
 */
export const MAX_TASK_TITLE_CHARS = 280;

export function deriveTaskTitle(body: string): string {
  const { title } = derivePresentation(body);
  if (title === "Untitled note") return "";
  const sentence = title.split(/(?<=[.!?])\s+/)[0] ?? title;
  const trimmed = sentence.replace(/[.\s]+$/, "").trim() || title.trim();
  return trimmed.length > MAX_TASK_TITLE_CHARS
    ? `${trimmed.slice(0, MAX_TASK_TITLE_CHARS - 1).trimEnd()}…`
    : trimmed;
}

// ── v3 list and review helpers ─────────────────────────────────────────

export type DayGroup = {
  /** Stable key for React and for the sticky header. */
  key: string;
  label: string;
  notes: PresentableNote[];
};

const monthFormatters = new Map<string, Intl.DateTimeFormat>();

/** Whole calendar days between two instants, in the reader's zone. */
function calendarDaysBetween(now: number, then: number, timeZone: string): number {
  const dayKey = cached(dayKeyFormatters, timeZone, () =>
    new Intl.DateTimeFormat("en-IE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  );
  const utcDay = (value: number) => {
    const parts = dayKey.formatToParts(new Date(value));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
    return Date.UTC(get("year"), get("month") - 1, get("day"));
  };
  return Math.round((utcDay(now) - utcDay(then)) / DAY);
}

/**
 * The list's date groups: "Today", "Yesterday", "Earlier this week", then
 * one group per month ("July 2026"). Input order is kept, so the groups
 * follow whichever sort the list is in; a note from the future reads Today.
 */
export function groupByDay(
  notes: readonly PresentableNote[],
  now: number,
  timeZone = "Europe/Dublin",
): DayGroup[] {
  const month = cached(monthFormatters, timeZone, () =>
    new Intl.DateTimeFormat("en-IE", { timeZone, month: "long", year: "numeric" }),
  );
  const groups: DayGroup[] = [];
  for (const note of notes) {
    const days = calendarDaysBetween(now, note.createdAt, timeZone);
    const label =
      days <= 0
        ? "Today"
        : days === 1
          ? "Yesterday"
          : days < 7
            ? "Earlier this week"
            : month.format(new Date(note.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.notes.push(note);
    else groups.push({ key: `${label}-${groups.length}`, label, notes: [note] });
  }
  return groups;
}

/**
 * Where a review session stands. `done` decisions made out of `total` notes
 * that were waiting when it began; the label names the note in front of you,
 * so two decided out of eight reads "3 of 8".
 */
export function reviewProgress(done: number, total: number): { label: string; ratio: number } {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeDone = Math.max(0, Math.min(Math.floor(done), safeTotal));
  if (safeTotal === 0) return { label: "0 of 0", ratio: 0 };
  return {
    label: `${Math.min(safeDone + 1, safeTotal)} of ${safeTotal}`,
    ratio: safeDone / safeTotal,
  };
}

export type SourceCounts = Record<NoteSource, number>;

/** How many notebook notes came in each way, for the source chips. */
export function sourceCounts(notes: readonly PresentableNote[]): SourceCounts {
  const counts: SourceCounts = { typed: 0, voice: 0, photo: 0, email: 0, calendar: 0 };
  for (const note of notes) {
    if (isArchived(note)) continue;
    counts[noteSource(note.source)] += 1;
  }
  return counts;
}

// ── v3 reader helpers ──────────────────────────────────────────────────

/**
 * The reader's page: a heading and the paragraphs after it.
 *
 * The heading is the first meaningful line, split by the same rule as the
 * list row (splitLead), so a note has one title everywhere. What the split
 * leaves over opens the body. Blank lines separate paragraphs; single line
 * breaks inside one are kept as written.
 */
export function readerParts(body: string): { title: string; rest: string[] } {
  const lines = body.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first < 0) return { title: "Untitled note", rest: [] };
  const { title, lead } = splitLead(lines[first]!);
  const remainder = [lead, lines.slice(first + 1).join("\n")].filter(Boolean).join("\n\n");
  const rest = remainder
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return { title, rest };
}

/** The reader's heading. Never empty ("Untitled note"). */
export function readerTitle(body: string): string {
  return readerParts(body).title;
}

/** Everything after the heading, as paragraphs. */
export function readerRest(body: string): string[] {
  return readerParts(body).rest;
}

/** Words a person would count: runs of letters or digits, apostrophes kept. */
export function wordCount(body: string): number {
  return body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

/** "1 word", "38 words". */
export function wordLabel(count: number): string {
  return count === 1 ? "1 word" : `${count.toLocaleString("en-IE")} words`;
}

/** The ways in the filter offers, in the order it lists them. */
export const FILTER_SOURCES = ["typed", "voice", "photo", "email"] as const;
export type FilterSource = (typeof FILTER_SOURCES)[number];

/** The filter's own names for each way in. */
export const FILTER_LABELS: Record<FilterSource, string> = {
  typed: "Written",
  voice: "Spoken",
  photo: "Photos",
  email: "Email",
};

/**
 * The sources worth offering: only those with at least one note, in a fixed
 * order, with their counts. A filter that can only ever return nothing is
 * not a choice.
 */
export function activeSources(counts: SourceCounts): Array<{ source: FilterSource; count: number }> {
  return FILTER_SOURCES.filter((source) => counts[source] > 0).map((source) => ({
    source,
    count: counts[source],
  }));
}
