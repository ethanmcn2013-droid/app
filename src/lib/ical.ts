/**
 * Tiny RFC 5545 calendar serializer. Pure functions, no deps.
 *
 * Scope intentionally narrow: a publishable VCALENDAR with VEVENTs.
 * No alarms, attendees, recurrence, or timezone definitions, those
 * arrive when the product asks for them. All emitted timestamps are
 * UTC (the trailing-Z form), which every consumer (Apple Calendar,
 * Google Calendar, Outlook) handles natively.
 *
 * Lines are CRLF-terminated and folded to ≤75 octets per the spec.
 * Field text is escaped for the four reserved characters: backslash,
 * semicolon, comma, and newline.
 */

export type ICalEvent = {
  /** Stable per-event key; we use the task id. */
  uid: string;
  summary: string;
  description?: string;
  start: Date;
  /** Omit to mark the VEVENT as all-day starting at `start`. */
  end?: Date;
  /** Optional URL the calendar client may link back to. */
  url?: string;
};

const CRLF = "\r\n";

/**
 * RFC 5545 §3.3.11 text escaping. Backslash first so we don't
 * double-escape the escape character itself.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/** UTC datetime form: 20260506T143000Z. */
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

/** Date-only form: 20260506. */
function formatDate(d: Date): string {
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate())
  );
}

/**
 * RFC 5545 §3.1 line folding. Lines longer than 75 octets must be
 * broken at any point with CRLF + a single whitespace char. We count
 * UTF-8 byte length, not characters, so a stray emoji can't push a
 * fold boundary past the limit.
 */
function foldLine(line: string): string {
  const MAX = 75;
  const enc = new TextEncoder();
  const bytes = enc.encode(line);
  if (bytes.length <= MAX) return line;

  const dec = new TextDecoder();
  const out: string[] = [];
  let offset = 0;
  let isFirst = true;
  while (offset < bytes.length) {
    const take = isFirst ? MAX : MAX - 1; // continuation lines reserve 1 byte for the leading space
    let end = Math.min(offset + take, bytes.length);
    // Don't slice mid-codepoint. Walk back until we land on a leading
    // byte (0xxxxxxx or 11xxxxxx). UTF-8 continuation bytes match 10xxxxxx.
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

/** Like `line` but with parameters, e.g. DTSTART;VALUE=DATE:20260506. */
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

/** True when the date sits exactly at UTC midnight, our all-day cue. */
function isAllDay(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function buildVevent(ev: ICalEvent, dtstamp: string): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(line("UID", ev.uid));
  lines.push(line("DTSTAMP", dtstamp));
  lines.push(line("SUMMARY", escapeText(ev.summary)));
  if (ev.description) {
    lines.push(line("DESCRIPTION", escapeText(ev.description)));
  }
  if (ev.url) {
    lines.push(line("URL", ev.url));
  }
  if (isAllDay(ev.start) && !ev.end) {
    lines.push(lineWithParams("DTSTART", { VALUE: "DATE" }, formatDate(ev.start)));
  } else {
    lines.push(line("DTSTART", formatUtc(ev.start)));
    const end = ev.end ?? new Date(ev.start.getTime() + 60 * 60 * 1000);
    lines.push(line("DTEND", formatUtc(end)));
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcsCalendar(input: {
  workspaceName: string;
  events: ICalEvent[];
}): string {
  const dtstamp = formatUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    line("X-WR-CALNAME", escapeText(input.workspaceName)),
  ];
  for (const ev of input.events) {
    lines.push(...buildVevent(ev, dtstamp));
  }
  lines.push("END:VCALENDAR");
  // Trailing CRLF, many parsers tolerate its absence, but the spec
  // wants every content line CRLF-terminated, including the last.
  return lines.join(CRLF) + CRLF;
}
