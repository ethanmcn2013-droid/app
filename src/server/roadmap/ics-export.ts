import "server-only";
import { asc, isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { roadmapItems } from "@/server/db/schema";

/**
 * ICS export of `roadmap_items`, every dated row in the GTM plan
 * (post-times, press-send beats, paid-spend launches, live launch
 * milestones) becomes a `VEVENT` so the user can one-tap import to
 * Google / Apple Calendar and never miss a beat.
 *
 * Sister to `src/lib/ical.ts` (which serves the per-workspace task
 * feed). Kept separate because (a) the column shape is roadmap-
 * specific, (b) the time-zone logic differs, roadmap rows store a
 * human "9am" / "3:01am" string per the GTM plan rather than a Date.
 *
 * All emitted timestamps are UTC (`Z`-suffixed). The 8-week window
 * (2026-05-11 → 2026-07-05) sits entirely inside US summer DST, so
 * ET = UTC-4 and PT = UTC-7 for the whole feed, no multi-offset
 * fallback needed. If the plan ever extends past November this needs
 * a real tz library.
 *
 * Posting-time defaults to ET because the GTM plan was written in
 * ET ("9am ET" is the implicit shorthand throughout). The PH launch
 * row uses the conventional `3:01am PT` slot, so we route any
 * `3:01am` or explicit `PT` string through the Pacific offset.
 *
 * Unrecognised time strings ("Coordinate w/ creator",
 * "7am/12pm/5pm", "—") fall back to all-day events, the calendar
 * still gets a marker, just no specific minute.
 */

const CRLF = "\r\n";

/** Half-hour bump for posts. */
const POST_DURATION_MIN = 30;
/** Generous block for live launches (Show HN front-page hover, etc.). */
const LAUNCH_DURATION_MIN = 90;
/** One hour to actually compose + hit send for press rows. */
const PRESS_DURATION_MIN = 60;

/** May–July 2026 sits in DST. ET = UTC-4, PT = UTC-7. */
const ET_OFFSET_HOURS = 4;
const PT_OFFSET_HOURS = 7;

interface ParsedTime {
  hour: number;
  minute: number;
  zone: "ET" | "PT";
}

/**
 * Parse a posting_time string into 24h hour+minute + timezone.
 * Returns null when the string is unrecognised (caller falls back
 * to an all-day event).
 *
 * Accepted shapes (case-insensitive):
 *   9am, 9:00am, 9:15am, 9:20am, 9:30am, 10am, 11am, 12pm
 *   1:30pm, 3pm, 6pm, 7am, 8am, 8pm
 *   8am launch          → 8am, trailing word ignored
 *   3:01am              → treated as PT (PH-launch convention)
 *   3:01am PT, 9am ET   → explicit zones honored
 *
 * Everything else → null.
 */
function parsePostingTime(raw: string | null): ParsedTime | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject explicit multi-times and other freeform strings up-front.
  if (trimmed.includes("/")) return null;
  if (/^[—-]$/.test(trimmed)) return null;
  if (/coordinate/i.test(trimmed)) return null;

  // Pull off an explicit zone suffix if present.
  let zone: "ET" | "PT" = "ET";
  let body = trimmed;
  const zoneMatch = body.match(/\b(ET|PT)\b\s*$/i);
  if (zoneMatch) {
    zone = zoneMatch[1].toUpperCase() as "ET" | "PT";
    body = body.slice(0, zoneMatch.index).trim();
  }

  // Match "9am", "9:00am", "12pm", etc., tolerate a trailing word
  // ("8am launch") by anchoring on the first time-shaped token.
  const m = body.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3].toLowerCase();
  if (hour < 1 || hour > 12) return null;
  if (minute < 0 || minute > 59) return null;
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  // PH-launch convention, `3:01am` with no explicit zone is PT.
  if (!zoneMatch && hour === 3 && minute === 1) {
    zone = "PT";
  }

  return { hour, minute, zone };
}

/**
 * Compose a UTC `Date` from an ISO date plus a parsed posting time.
 * Adds the offset (since ET/PT are negative) to shift wall-clock
 * local time → UTC.
 */
function toUtcDate(isoDate: string, t: ParsedTime): Date | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const offset = t.zone === "ET" ? ET_OFFSET_HOURS : PT_OFFSET_HOURS;
  return new Date(
    Date.UTC(year, month, day, t.hour + offset, t.minute, 0, 0),
  );
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function formatUtc(d: Date): string {
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** YYYYMMDD form for all-day VALUE=DATE properties. */
function formatDateOnly(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Add `n` days to a YYYY-MM-DD string and return the same form. */
function addDays(isoDate: string, n: number): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + n);
  return (
    String(d.getUTCFullYear()) +
    "-" +
    pad(d.getUTCMonth() + 1) +
    "-" +
    pad(d.getUTCDate())
  );
}

/** RFC 5545 §3.3.11 text escaping, backslash first. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** RFC 5545 §3.1 line folding at 75 octets. UTF-8 safe. */
function foldLine(value: string): string {
  const MAX = 75;
  const enc = new TextEncoder();
  const bytes = enc.encode(value);
  if (bytes.length <= MAX) return value;

  const dec = new TextDecoder();
  const out: string[] = [];
  let offset = 0;
  let isFirst = true;
  while (offset < bytes.length) {
    const take = isFirst ? MAX : MAX - 1;
    let end = Math.min(offset + take, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    const chunk = dec.decode(bytes.slice(offset, end));
    out.push(isFirst ? chunk : " " + chunk);
    offset = end;
    isFirst = false;
  }
  return out.join(CRLF);
}

function line(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function lineWithParams(
  name: string,
  params: Record<string, string>,
  value: string,
): string {
  const paramStr = Object.entries(params)
    .map(([k, v]) => `;${k}=${v}`)
    .join("");
  return foldLine(`${name}${paramStr}:${value}`);
}

/** Cap a string at `n` chars, trimming trailing whitespace. */
function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd();
}

interface RoadmapRowMin {
  id: string;
  date: string | null;
  kind: string;
  channel: string | null;
  format: string | null;
  body: string | null;
  cta: string | null;
  postingTime: string | null;
  isLaunch: boolean;
}

function buildSummary(row: RoadmapRowMin): string {
  const isLaunchRow = row.kind === "launch" || row.isLaunch;
  if (isLaunchRow) {
    return `Tasks · LAUNCH · ${row.format ?? row.body ?? "launch"}`;
  }
  switch (row.kind) {
    case "kpi":
      return "Tasks · KPI standup";
    case "asset":
      return `Tasks · ASSET · ${row.body ?? row.format ?? "asset"}`;
    case "press":
      return `Tasks · PRESS · ${row.format ?? row.body ?? "press"}`;
    default: {
      // Default post pattern.
      const channel = row.channel ?? "post";
      const fmt = truncate(row.format ?? row.body ?? "", 60);
      return `Tasks · ${channel} · ${fmt}`;
    }
  }
}

/**
 * Pick the right block length for a timed event. Launches get 90m,
 * press sends 60m, everything else 30m.
 */
function durationFor(row: RoadmapRowMin): number {
  if (row.kind === "launch" || row.isLaunch) return LAUNCH_DURATION_MIN;
  if (row.kind === "press") return PRESS_DURATION_MIN;
  return POST_DURATION_MIN;
}

/** Look up a CTA URL inside the free-form `cta` text, if any. */
function extractUrl(cta: string | null): string | null {
  if (!cta) return null;
  const m = cta.match(/https?:\/\/\S+/i);
  return m ? m[0] : null;
}

function buildVevent(row: RoadmapRowMin, dtstamp: string): string[] {
  if (!row.date) return [];

  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(line("UID", row.id));
  lines.push(line("DTSTAMP", dtstamp));
  lines.push(line("SUMMARY", escapeText(buildSummary(row))));

  const descParts: string[] = [];
  if (row.body) descParts.push(row.body);
  if (row.cta) descParts.push(row.cta);
  if (descParts.length) {
    lines.push(line("DESCRIPTION", escapeText(descParts.join("\n\n"))));
  }

  const url = extractUrl(row.cta);
  if (url) lines.push(line("URL", url));

  const parsed = parsePostingTime(row.postingTime);
  const start = parsed ? toUtcDate(row.date, parsed) : null;

  if (start) {
    const dur = durationFor(row);
    const end = new Date(start.getTime() + dur * 60 * 1000);
    lines.push(line("DTSTART", formatUtc(start)));
    lines.push(line("DTEND", formatUtc(end)));
  } else {
    // All-day event. RFC 5545 wants DTEND to be the day AFTER the
    // start (exclusive end), so a single-day event spans one date.
    lines.push(
      lineWithParams("DTSTART", { VALUE: "DATE" }, formatDateOnly(row.date)),
    );
    lines.push(
      lineWithParams(
        "DTEND",
        { VALUE: "DATE" },
        formatDateOnly(addDays(row.date, 1)),
      ),
    );
  }

  lines.push(line("STATUS", "CONFIRMED"));
  lines.push(line("CATEGORIES", row.kind.toUpperCase()));
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Build the full ICS document for every dated roadmap item. Returns
 * a complete VCALENDAR string ready to drop into an HTTP response.
 *
 * Server-only, opens the SQLite db.
 */
export async function exportRoadmapIcs(): Promise<string> {
  const rows = await db
    .select({
      id: roadmapItems.id,
      date: roadmapItems.date,
      kind: roadmapItems.kind,
      channel: roadmapItems.channel,
      format: roadmapItems.format,
      body: roadmapItems.body,
      cta: roadmapItems.cta,
      postingTime: roadmapItems.postingTime,
      isLaunch: roadmapItems.isLaunch,
      ord: roadmapItems.ord,
    })
    .from(roadmapItems)
    .where(isNotNull(roadmapItems.date))
    .orderBy(asc(roadmapItems.date), asc(roadmapItems.ord));

  const dtstamp = formatUtc(new Date());
  const out: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tasks//GTM Roadmap//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tasks GTM",
  ];

  for (const r of rows) {
    out.push(...buildVevent(r as RoadmapRowMin, dtstamp));
  }
  out.push("END:VCALENDAR");
  return out.join(CRLF) + CRLF;
}
