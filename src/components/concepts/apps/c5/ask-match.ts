/* Asking for a tool: plain rules that turn a sentence into tools. No model. */

import { TOOLS, type ProjectId, type ToolId } from "./data";

export type Answer = { tool: ToolId; rank: "Best fit" | "Another way" | "Closest" };

export type AskResult =
  | { kind: "idle" }
  | { kind: "short" }
  | { kind: "answers"; answers: Answer[] }
  | { kind: "none"; answers: Answer[] };

type Intent = { lead: ToolId; alts: ToolId[]; test: RegExp[] };

const INTENTS: Intent[] = [
  { lead: "dayplan", alts: ["timer", "suppliers"], test: [/hour by hour/, /plan (the|our|my) (day|saturday|wedding)/, /running order/, /run ?sheet/, /schedule/, /order of (the )?day/, /what happens when/, /timings?/] },
  { lead: "timer", alts: ["dayplan", "study"], test: [/\btimer\b/, /count ?down/, /how long (until|till)/, /\bspeech(es)?\b/, /\bclock\b/] },
  { lead: "seating", alts: ["guests", "dayplan"], test: [/\bseat/, /\btables?\b/, /sits? (where|next)/, /floor plan/] },
  { lead: "guests", alts: ["forms", "seating"], test: [/who('s| is)? (coming|going)/, /track of who/, /\bguests?\b/, /\brsvps?\b/, /\bwaiting\b/, /invit/, /head ?count/, /repl(y|ies)/] },
  { lead: "suppliers", alts: ["dayplan", "email"], test: [/suppliers?/, /vendors?/, /who (do i|to) call/, /phone numbers?/, /\bband\b|florist|caterer|pizza/] },
  { lead: "budget", alts: ["files", "forms"], test: [/spen[dt]/, /budget/, /\bcosts?\b/, /afford/, /money/, /deposits?/, /\bpa(y|id)\b/, /balance/, /€/] },
  { lead: "forms", alts: ["guests", "email"], test: [/\bforms?\b/, /sign[ -]?ups?/, /questionnaire/, /\bsurvey/, /collect (answers|orders)/, /\borders?\b/] },
  { lead: "outline", alts: ["split", "notes"], test: [/essay/, /\bwrit(e|ing)\b/, /\bdoc\b/, /outline/, /report/, /headings?/] },
  { lead: "split", alts: ["outline", "study"], test: [/\bsplit/, /divide/, /who does what/, /who has what/, /\bfair/, /share (out|the work)/, /group (work|project)/] },
  { lead: "study", alts: ["split", "timer"], test: [/stud(y|ying)/, /focus/, /pomodoro/, /revis(e|ion)/, /exam/] },
  { lead: "social", alts: ["press", "proofs"], test: [/social/, /instagram|tiktok|linkedin|newsletter/, /\bposts?\b/, /launch week/] },
  { lead: "press", alts: ["social", "email"], test: [/press/, /journalists?/, /media/, /coverage/, /replied/] },
  { lead: "proofs", alts: ["files", "notes"], test: [/proofs?/, /approv/, /sign[ -]off/, /designs?/, /poster/] },
  { lead: "notes", alts: ["files", "tasks"], test: [/\bnotes?\b/, /write (it )?down/, /remember/, /jot/] },
  { lead: "files", alts: ["notes", "proofs"], test: [/\bfiles?\b/, /contracts?/, /photos?/, /\bpdfs?\b/, /drive/, /menu/, /one place/, /sources/] },
  { lead: "calendar", alts: ["dayplan", "timer"], test: [/calendar/, /google|outlook|ical/, /\bsync/] },
  { lead: "whatsapp", alts: ["email", "notes"], test: [/whats ?app/, /group chat/, /messages?/] },
  { lead: "email", alts: ["whatsapp", "tasks"], test: [/e-?mails?/, /inbox/, /forward/] },
  { lead: "tasks", alts: ["notes", "dayplan"], test: [/to ?dos?/, /\btasks?\b/, /checklist/, /what('s| is) left/] },
];

const clean = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, " ");

export function interpret(raw: string): AskResult {
  const text = clean(raw);
  if (!text) return { kind: "idle" };

  // A tool named outright, or the start of one ("sea" for Seating), is its own answer.
  const named = TOOLS.filter((t) => {
    const n = t.name.toLowerCase();
    return text.length >= 3 && (n.startsWith(text) || text === n || text === `a ${n}` || text === `the ${n}`);
  });

  const scored = INTENTS.map((i, order) => ({ i, order, score: i.test.filter((r) => r.test(text)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const ids: ToolId[] = [];
  const push = (t: ToolId) => !ids.includes(t) && ids.push(t);
  named.forEach((t) => push(t.id));
  if (scored[0]) {
    push(scored[0].i.lead);
    scored[0].i.alts.forEach(push);
  }
  scored.slice(1, 3).forEach((x) => push(x.i.lead));

  if (ids.length) return { kind: "answers", answers: ids.slice(0, 4).map((tool, i) => ({ tool, rank: i === 0 ? "Best fit" : "Another way" })) };
  if (text.split(" ").length >= 3 && text.length >= 14) {
    return { kind: "none", answers: (["tasks", "notes", "forms"] as ToolId[]).map((tool) => ({ tool, rank: "Closest" })) };
  }
  return { kind: "short" };
}

/** Things to ask, drawn from what is going on in each Project right now. */
export const SUGGESTIONS: Record<ProjectId, { text: string; why: string }[]> = {
  mf: [
    { text: "plan the day hour by hour", why: "Saturday 3 October is eight days away" },
    { text: "see what we have spent", why: "The florist balance is due Monday" },
    { text: "a timer for the speeches", why: "Three speeches on the night" },
  ],
  orchard: [
    { text: "who do I call about the pizza oven", why: "Crust Brothers are due at 9:30pm" },
    { text: "keep the menu and contracts in one place", why: "Three files came in this week" },
    { text: "see what we have spent", why: "Twelve suppliers to pay after Saturday" },
  ],
  riverside: [
    { text: "split the essay fairly", why: "Three parts are under half their words" },
    { text: "focus together for 25 minutes", why: "Hand-in is 5pm Friday 2 October" },
    { text: "keep our sources in one place", why: "Three sources on the 2009 flood so far" },
  ],
  hollis: [
    { text: "track which journalists replied", why: "Two have not replied yet" },
    { text: "get the menu proof approved", why: "Waiting since 10am" },
    { text: "collect orders for opening day", why: "Doors open Saturday" },
  ],
};

/** A few examples that sit in the empty field. */
export const PLACEHOLDER: Record<ProjectId, string> = {
  mf: "plan the day hour by hour",
  orchard: "who do I call about the pizza oven",
  riverside: "split the essay fairly",
  hollis: "track which journalists replied",
};
