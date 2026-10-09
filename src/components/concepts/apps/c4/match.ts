/* Ask for a tool: turning a sentence into answers. Plain rules, no model. */

import { ALREADY_ON, NOW_ISO, projectById, TOOLS, type ProjectId, type ToolId } from "./data";

export type Micro =
  | { kind: "timer"; seconds: number; label: string; why: string }
  | { kind: "countdown"; iso: string; label: string; project: ProjectId | null; why: string };

export type Result =
  | { kind: "idle" }
  | { kind: "short" }
  | { kind: "answers"; intent: string; lead: ToolId; alts: ToolId[]; more: ToolId[]; home?: ProjectId; homeWhy?: string }
  | { kind: "already"; intent: string; tool: ToolId; alts: ToolId[]; more: ToolId[] }
  | { kind: "ask"; question: string; options: { label: string; need: string }[] }
  | { kind: "micro"; micro: Micro }
  | { kind: "none"; item: string };

type Intent = {
  id: string;
  test: RegExp[];
  lead: ToolId;
  alts: ToolId[];
  more: ToolId[];
  home?: ProjectId;
  homeWhy?: string;
};

const INTENTS: Intent[] = [
  { id: "guests", test: [/who('s| is)? (coming|going)/, /track of who/, /guest/, /\brsvps?\b/, /(track|count).*(people|invite)/, /invit/, /head ?count/], lead: "guests", alts: ["rsvp", "seating"], more: ["gifts", "forms", "checklist"] },
  { id: "rsvp", test: [/answer themselves/, /(reply|replies|respond)/], lead: "rsvp", alts: ["guests", "forms"], more: ["seating", "checklist", "email"] },
  { id: "seating", test: [/seat/, /tables?\b/, /sits? (where|next)/], lead: "seating", alts: ["guests", "rsvp"], more: ["dayplan", "checklist", "gifts"] },
  { id: "dayplan", test: [/hour by hour/, /plan the day/, /running order/, /schedule/, /order of (the )?day/, /what happens when/], lead: "dayplan", alts: ["runsheet", "countdown"], more: ["checklist", "weather", "rota"] },
  { id: "spend", test: [/spen[dt]/, /budget/, /cost/, /afford/, /expens/], lead: "budget", alts: ["receipts", "deposits"], more: ["payments", "checklist", "forms"] },
  { id: "countdown", test: [/count ?down to the/, /how (many|long) (days|until|till)/, /days (to|until|till) the/], lead: "countdown", alts: ["checklist", "social"], more: ["deadlines", "weather", "press"], home: "hollis", homeWhy: "the launch" },
  { id: "split", test: [/split/, /essay/, /divide/, /share (out|the work)/, /who does what/, /who has what/], lead: "split", alts: ["deadlines", "studytimer"], more: ["sources", "survey", "notes"], home: "river", homeWhy: "the essay plan" },
  { id: "email", test: [/e-?mails?/, /inbox/, /gmail|outlook/], lead: "email", alts: ["forward", "whatsapp"], more: ["calsync", "drive", "notes"] },
  { id: "whatsapp", test: [/whats ?app/, /group chat/, /messages? from/], lead: "whatsapp", alts: ["email", "forward"], more: ["notes", "calsync", "drive"] },
  { id: "press", test: [/press|journalist|pitch/], lead: "press", alts: ["social", "checklist"], more: ["email", "countdown", "forms"] },
  { id: "social", test: [/social|instagram|posts?\b|tiktok/], lead: "social", alts: ["press", "countdown"], more: ["checklist", "drive", "forms"] },
  { id: "staff", test: [/staff|rota|shifts?/], lead: "rota", alts: ["runsheet", "calsync"], more: ["checklist", "whatsapp", "bookings"] },
  { id: "files", test: [/files?\b|contracts?|photos|drive/], lead: "drive", alts: ["notes", "templates"], more: ["email", "forms", "receipts"] },
  { id: "calendar", test: [/calendar|google cal|ical/], lead: "calsync", alts: ["bookings", "countdown"], more: ["deadlines", "dayplan", "rota"] },
  { id: "survey", test: [/survey|questionnaire/], lead: "survey", alts: ["forms", "split"], more: ["sources", "deadlines", "notes"] },
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = MONTHS.map((m) => m.slice(0, 3)).join("|");

function parseDate(text: string): { iso: string; label: string } | null {
  const a = text.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)? (${MONTH_RE})[a-z]*`));
  const b = text.match(new RegExp(`(${MONTH_RE})[a-z]* (\\d{1,2})(?:st|nd|rd|th)?`));
  const day = a ? +a[1] : b ? +b[2] : NaN;
  const mon = a ? a[2] : b ? b[1] : "";
  if (!day || !mon || day > 31) return null;
  const m = MONTHS.findIndex((x) => x.startsWith(mon));
  const now = new Date(NOW_ISO);
  let year = now.getFullYear();
  if (new Date(year, m, day) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) year += 1;
  const d = new Date(year, m, day);
  const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00:00`;
  const label = d.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" });
  return { iso, label };
}

function projectForDate(iso: string): ProjectId | null {
  const day = iso.slice(0, 10);
  for (const id of ["mf", "hollis", "orchard", "river"] as ProjectId[]) {
    if (projectById(id).day?.iso.slice(0, 10) === day) return id;
  }
  return null;
}

function micro(text: string): Micro | null {
  const isTimer = /\btimer\b|\btime (the|my)\b|\bstopwatch\b/.test(text);
  if (isTimer) {
    const mins = text.match(/(\d+)\s*(min|minute)/);
    const secs = mins ? +mins[1] * 60 : /speech/.test(text) ? 240 : /toast/.test(text) ? 120 : /focus|study/.test(text) ? 1500 : 300;
    const what = /speech/.test(text) ? "Speech timer" : /toast/.test(text) ? "Toast timer" : /focus|study/.test(text) ? "Focus timer" : "Timer";
    const why = /speech/.test(text)
      ? "Set to 4 minutes, the length in your Day plan note: 'Speeches, four minutes each'."
      : mins
        ? `Set to the ${mins[1]} minutes you asked for.`
        : "Set to a sensible default. Change it with the buttons.";
    return { kind: "timer", seconds: secs, label: what, why };
  }
  if (/count ?down|days (to|until|till)|how long (until|till)/.test(text)) {
    const date = parseDate(text);
    if (!date) return null;
    const project = projectForDate(date.iso);
    const why = project
      ? `${date.label.split(" ").slice(1).join(" ")} is the ${projectById(project).short} day, so it counts to ${projectById(project).day!.what}.`
      : "Counts to 9am on the day. Pin it to a Project to keep it.";
    return { kind: "countdown", iso: project ? projectById(project).day!.iso : date.iso, label: date.label, project, why };
  }
  return null;
}

export function interpret(raw: string, project: ProjectId): Result {
  const text = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return { kind: "idle" };

  const m = micro(text);
  if (m) return { kind: "micro", micro: m };

  if (/^(money|cash|payments?|pay|€|euro)s?\??$/.test(text)) {
    return {
      kind: "ask",
      question: "Money coming in or going out?",
      options: [
        { label: "Coming in", need: "take deposits and see who has paid" },
        { label: "Going out", need: "see what we have spent" },
      ],
    };
  }

  if (/photo ?booth|book(ing)? (a|the) (photo|dj|magician|bouncy)|order the cake/.test(text)) {
    const item = raw.trim().replace(/^(something|a way|a tool|an app|somewhere)\s+(to|for)\s+/i, "");
    return { kind: "none", item: item.charAt(0).toUpperCase() + item.slice(1) };
  }

  if (/take deposits|who has paid|coming in/.test(text)) {
    return { kind: "answers", intent: "in", lead: "deposits", alts: ["payments", "budget"], more: ["receipts", "forms", "checklist"] };
  }

  // A tool named outright ("guest list", "seating plan") is its own answer.
  const named = TOOLS.find((t) => text === t.name.toLowerCase() || text === `a ${t.name.toLowerCase()}` || text === `use ${t.name.toLowerCase()}`);
  const intent =
    named
      ? INTENTS.find((i) => i.lead === named.id) ?? { id: named.id, test: [], lead: named.id, alts: [], more: [] }
      : INTENTS.map((i) => ({ i, score: i.test.filter((r) => r.test(text)).length })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)[0]?.i;

  if (!intent) {
    if (text.split(" ").length >= 4 && text.length >= 18) {
      const item = raw.trim().replace(/^(something|a way|a tool|an app|somewhere)\s+(to|for)\s+/i, "");
      return { kind: "none", item: item.charAt(0).toUpperCase() + item.slice(1) };
    }
    return { kind: "short" };
  }

  const alts = named && !intent.alts.length ? fallbackAlts(named.id) : intent.alts;
  const more = named && !intent.more.length ? ["checklist", "notes", "forms"].filter((x) => x !== named.id) as ToolId[] : intent.more;
  const home = intent.home && intent.home !== project ? intent.home : undefined;
  const on = ALREADY_ON.find((o) => o.tool === intent.lead && o.project === (home ?? project));
  if (on) return { kind: "already", intent: intent.id, tool: intent.lead, alts, more };
  return { kind: "answers", intent: intent.id, lead: intent.lead, alts, more, home, homeWhy: intent.homeWhy };
}

function fallbackAlts(id: ToolId): ToolId[] {
  const pool: ToolId[] = ["checklist", "forms", "notes", "drive"];
  return pool.filter((x) => x !== id).slice(0, 2);
}

/** Suggestion phrases, drawn from what is going on in each Project. */
export const SUGGESTIONS: { text: string; project: ProjectId }[] = [
  { text: "keep track of who is coming", project: "mf" },
  { text: "plan the day hour by hour", project: "mf" },
  { text: "see what we have spent", project: "mf" },
  { text: "count down to the launch", project: "hollis" },
  { text: "split the essay between four people", project: "river" },
  { text: "get supplier emails into tasks", project: "orchard" },
];

/** Examples that rotate in the empty field, including the one-line tools. */
export const EXAMPLES = [
  "keep track of who is coming",
  "a timer for the speeches",
  "countdown to 2 November",
  "see what we have spent",
  "plan the day hour by hour",
];

/** Completion for what has been typed so far, from the known phrases. */
export function completion(typed: string): string {
  const t = typed.toLowerCase();
  if (t.trim().length < 3) return "";
  const pool = [...SUGGESTIONS.map((s) => s.text), "a timer for the speeches", "countdown to 2 November", "money"];
  const hit = pool.find((p) => p.toLowerCase().startsWith(t) && p.length > t.length);
  return hit ? hit.slice(typed.length) : "";
}
