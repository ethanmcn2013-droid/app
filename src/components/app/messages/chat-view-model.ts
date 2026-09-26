/**
 * Messages view model: pure presentation helpers shared by the live Project
 * conversation client and the in-memory review preview. Nothing here grants
 * access, sends, or reads data; it only shapes records for display.
 */

/** `online` only when real presence data exists: no data means no dot. */
export type ChatPerson = Readonly<{ id: string; name: string; role?: string; online?: boolean }>;

export type ChatDeliveryState = "sent" | "sending" | "uncertain" | "failed";

export type ChatTaskStatus = "todo" | "doing" | "review" | "done";

export type ChatLinkedTask = Readonly<{ id: string; title: string; href: string; status?: ChatTaskStatus; statusLabel?: string }>;

export type ChatMessage = Readonly<{
  id: string;
  authorId: string | null;
  /** null is a removed message; its place in history is kept. */
  body: string | null;
  createdAt: number;
  editedAt?: number | null;
  rootId?: string | null;
  replyCount?: number;
  replyAuthorIds?: readonly string[];
  lastReplyAt?: number | null;
  delivery?: ChatDeliveryState;
  linkedTask?: ChatLinkedTask | null;
}>;

export type ChatClock = Readonly<{ nowMs: number; timeZone?: string; locale?: string }>;

export type MessageRun = Readonly<{ key: string; authorId: string | null; messages: readonly ChatMessage[] }>;
export type DaySection = Readonly<{ key: string; label: string; runs: readonly MessageRun[] }>;

/** Consecutive messages from one author within this window share one header. */
export const RUN_WINDOW_MS = 5 * 60 * 1000;

function parts(ms: number, clock: ChatClock) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: clock.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return formatter.format(new Date(ms));
}

/** yyyy-mm-dd in the clock's time zone. */
export function dayKey(ms: number, clock: ChatClock): string {
  return parts(ms, clock);
}

function dayDistance(ms: number, clock: ChatClock): number {
  const a = Date.parse(`${dayKey(ms, clock)}T00:00:00Z`);
  const b = Date.parse(`${dayKey(clock.nowMs, clock)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Labels are assembled from parts rather than a locale pattern, so the server
 * render and the browser agree even when their CLDR data differ (a comma
 * after the weekday is the usual drift, and a hydration mismatch with it).
 */
function dateParts(ms: number, clock: ChatClock, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const formatted = new Intl.DateTimeFormat(clock.locale ?? "en-GB", { timeZone: clock.timeZone, ...options }).formatToParts(new Date(ms));
  return Object.fromEntries(formatted.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function dayLabel(ms: number, clock: ChatClock): string {
  const distance = dayDistance(ms, clock);
  if (distance === 0) return "Today";
  if (distance === 1) return "Yesterday";
  const sameYear = dayKey(ms, clock).slice(0, 4) === dayKey(clock.nowMs, clock).slice(0, 4);
  const value = dateParts(ms, clock, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${value.weekday} ${value.day} ${value.month}${sameYear ? "" : ` ${value.year}`}`;
}

export function timeLabel(ms: number, clock: ChatClock): string {
  const value = dateParts(ms, clock, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${value.hour}:${value.minute}`;
}

/** A full, unambiguous stamp for tooltips and screen readers. */
export function fullStampLabel(ms: number, clock: ChatClock): string {
  const value = dateParts(ms, clock, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${value.weekday} ${value.day} ${value.month} ${value.year} at ${timeLabel(ms, clock)}`;
}

/** Compact recency for the conversation list. */
export function listTimeLabel(ms: number, clock: ChatClock): string {
  const distance = dayDistance(ms, clock);
  if (distance <= 0) return timeLabel(ms, clock);
  if (distance === 1) return "Yesterday";
  if (distance < 7) return dateParts(ms, clock, { weekday: "short" }).weekday;
  const value = dateParts(ms, clock, { day: "numeric", month: "short" });
  return `${value.day} ${value.month}`;
}

/**
 * Days, then author runs. Input order is preserved; callers sort by sequence.
 * `breakBefore` starts a fresh run (with its author line) at a message, for
 * example the first new message under a "New" divider.
 */
export function groupMessages(messages: readonly ChatMessage[], clock: ChatClock, windowMs = RUN_WINDOW_MS, breakBefore?: string | null): DaySection[] {
  const sections: { key: string; label: string; runs: { key: string; authorId: string | null; messages: ChatMessage[] }[] }[] = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt, clock);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, label: dayLabel(message.createdAt, clock), runs: [] };
      sections.push(section);
    }
    const run = section.runs[section.runs.length - 1];
    const previous = run?.messages[run.messages.length - 1];
    const continues = run && previous && message.id !== breakBefore && run.authorId === message.authorId && message.authorId !== null &&
      message.createdAt - previous.createdAt <= windowMs && previous.body !== null && message.body !== null &&
      !previous.replyCount && !previous.linkedTask;
    if (continues) run.messages.push(message);
    else section.runs.push({ key: message.id, authorId: message.authorId, messages: [message] });
  }
  return sections;
}

export type BodySegment =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "mention"; text: string; personId: string; self: boolean }>
  | Readonly<{ kind: "link"; text: string; href: string }>;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"’”]+$/;

function linkSegments(text: string): BodySegment[] {
  const out: BodySegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let href = match[0];
    const trailing = href.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    if (trailing) href = href.slice(0, -trailing.length);
    let safe: URL | null = null;
    try { safe = new URL(href); } catch { safe = null; }
    if (!safe || (safe.protocol !== "http:" && safe.protocol !== "https:")) continue;
    if (start > cursor) out.push({ kind: "text", text: text.slice(cursor, start) });
    out.push({ kind: "link", text: href, href: safe.toString() });
    cursor = start + href.length;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor) });
  return out;
}

/**
 * Split a message into text, links and @mentions of known people. Mentions
 * are display only: who is notified comes from the send's member IDs, never
 * from names parsed out of text.
 */
export function tokenizeBody(body: string, people: readonly ChatPerson[], selfId: string | null): BodySegment[] {
  const names = people.flatMap((person) => {
    const first = person.name.split(/\s+/)[0] ?? person.name;
    const firstIsUnique = people.filter((other) => (other.name.split(/\s+/)[0] ?? other.name) === first).length === 1;
    return firstIsUnique && first !== person.name ? [[person.name, person] as const, [first, person] as const] : [[person.name, person] as const];
  }).sort((a, b) => b[0].length - a[0].length);
  const out: BodySegment[] = [];
  let buffer = "";
  let index = 0;
  while (index < body.length) {
    const char = body[index];
    const before = index === 0 ? " " : body[index - 1];
    if (char === "@" && /[\s(\[{"'“‘]/.test(before)) {
      const rest = body.slice(index + 1);
      const hit = names.find(([name]) => rest.startsWith(name) && !/[\p{L}\p{N}]/u.test(rest.charAt(name.length)));
      if (hit) {
        if (buffer) { out.push(...linkSegments(buffer)); buffer = ""; }
        out.push({ kind: "mention", text: `@${hit[0]}`, personId: hit[1].id, self: hit[1].id === selfId });
        index += hit[0].length + 1;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  if (buffer) out.push(...linkSegments(buffer));
  return out;
}

export function mentionsPerson(body: string | null, people: readonly ChatPerson[], personId: string): boolean {
  if (!body) return false;
  return tokenizeBody(body, people, personId).some((segment) => segment.kind === "mention" && segment.self);
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Stable identity tone, never status. Six tones map to v3 tokens in CSS. */
export function toneOf(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % 6;
}

export function hostOf(href: string): string {
  try { return new URL(href).host.replace(/^www\./, ""); } catch { return href; }
}

/** Host and path, without the scheme noise, for a link card. */
export function linkLabel(href: string, max = 44): string {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/$/, "");
    const label = `${url.host.replace(/^www\./, "")}${path}`;
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
  } catch { return href; }
}

/** Plain one-line preview for the list. A direct message names only you. */
export function previewText(message: ChatMessage | undefined, people: readonly ChatPerson[], selfId: string | null, direct = false): string {
  if (!message) return "";
  if (message.body === null) return "Message removed";
  const author = message.authorId === selfId ? "You" : direct ? null : people.find((person) => person.id === message.authorId)?.name.split(/\s+/)[0];
  const text = message.body.replace(/\s+/g, " ").trim();
  return author ? `${author}: ${text}` : text;
}

/** Case- and accent-insensitive containment. */
export function matchesQuery(value: string, query: string): boolean {
  const fold = (input: string) => input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return fold(value).includes(fold(query.trim()));
}

/** The @query being typed immediately before the caret, if any. */
export function activeMentionQuery(text: string, caret: number): Readonly<{ start: number; query: string }> | null {
  const before = text.slice(0, caret);
  const match = before.match(/(^|[\s(])@([\p{L}\p{M}'’-]{0,24})$/u);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
}

export function mentionCandidates(people: readonly ChatPerson[], query: string, excludeId: string | null): ChatPerson[] {
  const q = query.trim();
  return people.filter((person) => person.id !== excludeId && (!q || person.name.split(/\s+/).some((word) => matchesQuery(word.slice(0, q.length), q)) || matchesQuery(person.name, q))).slice(0, 6);
}
