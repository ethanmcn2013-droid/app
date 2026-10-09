/*
 * Analytics concept 5, "Ask a question": sample data.
 *
 * Every date is a day offset from today, Friday 25 September 2026 (day 0).
 * Weekly series run oldest first over 14 weeks; index 13 is this week.
 */

export type Day = number;
export const TODAY = new Date(2026, 8, 25);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dateOf(d: Day) {
  const out = new Date(TODAY);
  out.setDate(out.getDate() + d);
  return out;
}
/** "18 Sep" */
export function fmtShort(d: Day) {
  const x = dateOf(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}`;
}
/** "15 October" */
export function fmtLong(d: Day) {
  const x = dateOf(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
}
/** "Thursday 8 October" */
export function fmtDay(d: Day) {
  const x = dateOf(d);
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`;
}
export function weekdayShort(d: Day) {
  return WEEKDAYS[dateOf(d).getDay()].slice(0, 3);
}
export function monthOf(d: Day) {
  return MONTHS[dateOf(d).getMonth()];
}
/** Monday that starts week i (0..13) of the history. */
export function weekStart(i: number): Day {
  return -4 - 7 * (13 - i);
}

export type ReasonId = "reply" | "check" | "start" | "tight";
export const REASONS: Record<ReasonId, string> = {
  reply: "Waiting on a reply",
  check: "Waiting to be checked",
  start: "Not started",
  tight: "Date was too tight",
};

export type Group = {
  id: string;
  name: string;
  /** How the group reads mid-sentence: "supplier tasks". */
  noun: string;
  /** Subject and verb for "how long": "Supplier tasks take". */
  says: string;
  /** The most recent finished or moved tasks looked at for slipping. */
  recent: number;
  recentMoved: number;
  moves: number;
  open: number;
  done: number;
  p25: number;
  median: number;
  p75: number;
  tone?: string;
};

export type Person = { id: string; name: string; open: number; dueNext: number; finished4w: number; project?: string };
export type Outsider = { id: string; name: string; role: string; tasks: number; moved: number; moves: number; last: Day; project?: string };
export type Moved = { id: string; title: string; who: string; from: Day; hops: Day[]; lastMovedOn: Day; project?: string };
export type Late = { id: string; title: string; name?: string; person: string; daysLate: number; reason: ReasonId; project?: string };
export type Waiting = { id: string; title: string; on: string; days: number; project?: string };
export type Upcoming = { id: string; title: string; lane: string; day: Day; project?: string };
export type Pick = { id: string; title: string; day: number; person: string; rank?: 1 | 2 | 3; why: string; project?: string };

export type Part = string | { b: string; marks: string[] };

export type TimeShare = { waiting: number; doing: number; checking: number; notStarted: number };

export type ProjectData = {
  id: string;
  name: string;
  tone: string;
  kind: string;
  status: "full" | "thin" | "empty" | "all";
  team: string[];
  target: { day: Day; name: string } | null;
  taskCount: number;
  datedCount: number;
  doneCount: number;
  /** Words for the people outside the team whose replies things wait on. */
  outsiderWord: { one: string; many: string; question: string };
  /** "step" when groups are stages of the work, "group" otherwise. */
  groupWord: string;
  weeks: { finished: number[]; added: number[]; moved: number[]; dueBeforeLeft: number[] };
  lateLastWeek: number;
  waitingLastWeek: number;
  groups: Group[];
  people: Person[];
  unassigned: number;
  outsiders: Outsider[];
  moved: Moved[];
  late: Late[];
  waiting: Waiting[];
  upcoming: Upcoming[];
  picks: Pick[];
  pickSentence: Part[];
  doneThisWeek: string[];
  time: TimeShare;
  timeDays: TimeShare;
  /** Short explanations when there is too little data to answer. Keyed by question id. */
  thin: Record<string, string>;
};

const NONE_THIN: Record<string, string> = {};

/* ── The Orchard: events venue, team of 3, Mara & Finn on 17 October ───── */

const orchard: ProjectData = {
  id: "orchard",
  name: "The Orchard",
  tone: "var(--v3-project-3)",
  kind: "Events venue · 3 people",
  status: "full",
  team: ["Niamh", "Orla", "Cian"],
  target: { day: 22, name: "Mara & Finn’s wedding" },
  taskCount: 66,
  datedCount: 58,
  doneCount: 43,
  outsiderWord: { one: "supplier", many: "suppliers", question: "Which supplier slips most?" },
  groupWord: "group",
  weeks: {
    finished: [1, 2, 3, 2, 3, 2, 3, 4, 2, 3, 4, 4, 4, 6],
    added: [6, 5, 5, 4, 4, 3, 3, 4, 2, 3, 4, 3, 3, 2],
    moved: [2, 3, 2, 4, 3, 5, 3, 2, 4, 3, 2, 1, 2, 1],
    dueBeforeLeft: [38, 38, 37, 37, 36, 35, 35, 34, 33, 31, 27, 23, 19, 13],
  },
  lateLastWeek: 5,
  waitingLastWeek: 6,
  groups: [
    { id: "g-sup", name: "Suppliers", noun: "supplier tasks", says: "Supplier tasks take", recent: 7, recentMoved: 5, moves: 11, open: 7, done: 9, p25: 6, median: 11, p75: 16 },
    { id: "g-food", name: "Food", noun: "food tasks", says: "Food tasks take", recent: 6, recentMoved: 2, moves: 3, open: 5, done: 8, p25: 4, median: 7, p75: 10 },
    { id: "g-venue", name: "Venue", noun: "venue tasks", says: "Venue tasks take", recent: 8, recentMoved: 2, moves: 2, open: 4, done: 11, p25: 2, median: 4, p75: 7 },
    { id: "g-guests", name: "Guests", noun: "guest tasks", says: "Guest tasks take", recent: 6, recentMoved: 1, moves: 1, open: 4, done: 9, p25: 1, median: 3, p75: 6 },
    { id: "g-paper", name: "Paperwork", noun: "paperwork tasks", says: "Paperwork takes", recent: 4, recentMoved: 0, moves: 0, open: 3, done: 6, p25: 1, median: 2, p75: 4 },
  ],
  people: [
    { id: "p-cian", name: "Cian", open: 11, dueNext: 5, finished4w: 4 },
    { id: "p-niamh", name: "Niamh", open: 5, dueNext: 2, finished4w: 8 },
    { id: "p-orla", name: "Orla", open: 4, dueNext: 1, finished4w: 6 },
  ],
  unassigned: 3,
  outsiders: [
    { id: "o-canvas", name: "Canvas & Co.", role: "tent hire", tasks: 2, moved: 2, moves: 5, last: -3 },
    { id: "o-wild", name: "Wildflower", role: "florist", tasks: 1, moved: 1, moves: 2, last: -11 },
    { id: "o-hazel", name: "Hazel Road", role: "band", tasks: 1, moved: 1, moves: 2, last: -2 },
    { id: "o-green", name: "Green Table", role: "caterer", tasks: 1, moved: 1, moves: 2, last: -9 },
    { id: "o-fern", name: "Fern Photo", role: "photographer", tasks: 1, moved: 0, moves: 0, last: 0 },
    { id: "o-linen", name: "Linen Room", role: "linen hire", tasks: 1, moved: 0, moves: 0, last: 0 },
  ],
  moved: [
    { id: "m-tent", title: "Tent hire confirmed", who: "Canvas & Co.", from: 7, hops: [11, 13, 14], lastMovedOn: -7 },
    { id: "m-layout", title: "Tent layout signed off", who: "Canvas & Co.", from: 2, hops: [5, 10], lastMovedOn: -3 },
    { id: "m-flowers", title: "Flowers final order", who: "Wildflower", from: 5, hops: [9, 12], lastMovedOn: -11 },
    { id: "m-band", title: "Band contract returned", who: "Hazel Road", from: -6, hops: [-2, 3], lastMovedOn: -2 },
    { id: "m-menu", title: "Tasting menu agreed", who: "Green Table", from: -14, hops: [-7, 4], lastMovedOn: -9 },
  ],
  late: [
    { id: "l-deposit", title: "Tent hire deposit", name: "the tent hire deposit", person: "Cian", daysLate: 9, reason: "reply" },
    { id: "l-wine", title: "Wine order confirmed", name: "the wine order", person: "Niamh", daysLate: 4, reason: "reply" },
    { id: "l-seating", title: "Seating plan checked", name: "the seating plan check", person: "Orla", daysLate: 2, reason: "check" },
  ],
  waiting: [
    { id: "w-deposit", title: "Tent hire deposit", on: "Canvas & Co.", days: 12 },
    { id: "w-wine", title: "Wine order", on: "Green Table", days: 6 },
    { id: "w-setlist", title: "Band set list", on: "Hazel Road", days: 5 },
    { id: "w-seating", title: "Seating plan", on: "Mara & Finn", days: 3 },
  ],
  upcoming: [
    { id: "u-band", title: "Band contract returned", lane: "Suppliers", day: 3 },
    { id: "u-menu", title: "Tasting menu agreed", lane: "Suppliers", day: 4 },
    { id: "u-numbers", title: "Final guest numbers to caterer", lane: "Guests", day: 5 },
    { id: "u-parking", title: "Parking plan", lane: "Venue", day: 6 },
    { id: "u-licence", title: "Drinks licence renewed", lane: "Paperwork", day: 7 },
    { id: "u-layout", title: "Tent layout signed off", lane: "Suppliers", day: 10 },
    { id: "u-rota", title: "Staff rota for the day", lane: "Venue", day: 11 },
    { id: "u-flowers", title: "Flowers final order", lane: "Suppliers", day: 12 },
    { id: "u-seating", title: "Seating plan printed", lane: "Guests", day: 13 },
    { id: "u-cards", title: "Menu cards to printer", lane: "Food", day: 13 },
    { id: "u-signs", title: "Welcome signs", lane: "Venue", day: 13 },
    { id: "u-tent", title: "Tent hire confirmed", lane: "Suppliers", day: 14 },
  ],
  picks: [
    { id: "k-deposit", title: "Tent hire deposit", day: 0, person: "Cian", rank: 1, why: "9 days late, and 3 things wait on it" },
    { id: "k-band", title: "Band contract returned", day: 0, person: "Cian", why: "Due Monday" },
    { id: "k-wine", title: "Chase the wine order", day: 0, person: "Niamh", rank: 3, why: "4 days late" },
    { id: "k-menu", title: "Tasting menu agreed", day: 1, person: "Niamh", why: "Moved twice already" },
    { id: "k-numbers", title: "Final guest numbers", day: 2, person: "Orla", rank: 2, why: "The caterer needs them by Wednesday" },
    { id: "k-parking", title: "Parking plan", day: 3, person: "Orla", why: "Due Thursday" },
    { id: "k-licence", title: "Drinks licence renewed", day: 4, person: "Niamh", why: "Due Friday" },
  ],
  pickSentence: [
    "Start with ",
    { b: "the tent hire deposit", marks: ["k-deposit"] },
    ": it is 9 days late and 3 other things wait on it. Then send ",
    { b: "final guest numbers", marks: ["k-numbers"] },
    " to the caterer by Wednesday, and ",
    { b: "chase the wine order", marks: ["k-wine"] },
    ".",
  ],
  doneThisWeek: ["Evening music chosen", "Florist signed off the colours", "Final guest numbers in (142)", "Chair hire booked", "Fire safety walk-through", "Welcome drinks menu"],
  time: { waiting: 38, doing: 27, checking: 22, notStarted: 13 },
  timeDays: { waiting: 4.2, doing: 3.0, checking: 2.4, notStarted: 1.4 },
  thin: NONE_THIN,
};

/* ── Brightwater: agency, team of 5, Harbour Foods launch on 30 October ─── */

const brightwater: ProjectData = {
  id: "brightwater",
  name: "Brightwater",
  tone: "var(--v3-project-5)",
  kind: "Agency · 5 people",
  status: "full",
  team: ["Aoife", "Tom", "Jess", "Ravi", "Lena"],
  target: { day: 35, name: "the Harbour Foods launch" },
  taskCount: 66,
  datedCount: 61,
  doneCount: 50,
  outsiderWord: { one: "person at the client", many: "people at the client", question: "Who at the client slips most?" },
  groupWord: "step",
  weeks: {
    finished: [3, 4, 3, 5, 4, 3, 4, 3, 4, 3, 4, 4, 3, 3],
    added: [5, 4, 4, 4, 3, 4, 3, 3, 3, 3, 2, 3, 2, 2],
    moved: [2, 1, 2, 3, 2, 2, 3, 3, 2, 3, 4, 3, 4, 3],
    dueBeforeLeft: [40, 39, 39, 38, 37, 36, 35, 33, 31, 28, 25, 22, 19, 16],
  },
  lateLastWeek: 3,
  waitingLastWeek: 5,
  groups: [
    { id: "g-feedback", name: "Client feedback", noun: "client feedback tasks", says: "Client feedback takes", recent: 8, recentMoved: 6, moves: 9, open: 5, done: 12, p25: 2, median: 4, p75: 7 },
    { id: "g-design", name: "Design", noun: "design tasks", says: "Design takes", recent: 9, recentMoved: 3, moves: 4, open: 4, done: 14, p25: 1, median: 3, p75: 5 },
    { id: "g-build", name: "Build", noun: "build tasks", says: "Build takes", recent: 7, recentMoved: 2, moves: 2, open: 4, done: 8, p25: 2, median: 3, p75: 5 },
    { id: "g-copy", name: "Copy", noun: "copy tasks", says: "Copy takes", recent: 8, recentMoved: 1, moves: 1, open: 2, done: 11, p25: 1, median: 2, p75: 3 },
    { id: "g-signoff", name: "Sign-off", noun: "sign-off tasks", says: "Sign-off takes", recent: 4, recentMoved: 1, moves: 1, open: 1, done: 5, p25: 1, median: 1, p75: 2 },
  ],
  people: [
    { id: "p-tom", name: "Tom", open: 4, dueNext: 2, finished4w: 4 },
    { id: "p-ravi", name: "Ravi", open: 4, dueNext: 2, finished4w: 2 },
    { id: "p-aoife", name: "Aoife", open: 3, dueNext: 1, finished4w: 3 },
    { id: "p-jess", name: "Jess", open: 3, dueNext: 1, finished4w: 3 },
    { id: "p-lena", name: "Lena", open: 2, dueNext: 0, finished4w: 2 },
  ],
  unassigned: 0,
  outsiders: [
    { id: "o-paula", name: "Paula", role: "marketing lead", tasks: 4, moved: 3, moves: 5, last: -1 },
    { id: "o-declan", name: "Declan", role: "legal", tasks: 2, moved: 2, moves: 3, last: -4 },
    { id: "o-sinead", name: "Sinéad", role: "brand", tasks: 2, moved: 1, moves: 1, last: -12 },
  ],
  moved: [
    { id: "m-home", title: "Homepage copy approved", who: "Paula", from: -12, hops: [-8, -6, 2], lastMovedOn: -1 },
    { id: "m-terms", title: "Offer terms checked", who: "Declan", from: -9, hops: [-5, 1], lastMovedOn: -4 },
    { id: "m-price", title: "Price list approved", who: "Paula", from: -3, hops: [4], lastMovedOn: -5 },
    { id: "m-video", title: "Launch video feedback", who: "Paula", from: 1, hops: [6], lastMovedOn: -2 },
    { id: "m-logo", title: "Logo lockup approved", who: "Sinéad", from: -10, hops: [-4], lastMovedOn: -12 },
    { id: "m-legal2", title: "Competition rules checked", who: "Declan", from: 4, hops: [9], lastMovedOn: -6 },
  ],
  late: [
    { id: "l-home", title: "Homepage copy approved", name: "the homepage copy", person: "Tom", daysLate: 6, reason: "reply" },
    { id: "l-terms", title: "Offer terms checked", name: "the offer terms", person: "Jess", daysLate: 5, reason: "reply" },
    { id: "l-video", title: "Launch video cut", name: "the launch video", person: "Ravi", daysLate: 2, reason: "check" },
    { id: "l-shots", title: "Product shots retouched", name: "the product shots", person: "Lena", daysLate: 1, reason: "start" },
  ],
  waiting: [
    { id: "w-home", title: "Homepage copy approval", on: "Paula", days: 9 },
    { id: "w-terms", title: "Offer terms", on: "Declan", days: 7 },
    { id: "w-logo", title: "Logo lockup", on: "Sinéad", days: 4 },
    { id: "w-price", title: "Price list", on: "Paula", days: 3 },
    { id: "w-video", title: "Video review", on: "Aoife", days: 2 },
    { id: "w-news", title: "Newsletter draft", on: "Paula", days: 1 },
  ],
  upcoming: [
    { id: "u-price", title: "Price list approved", lane: "Client feedback", day: 4 },
    { id: "u-banner", title: "Banner set", lane: "Design", day: 4 },
    { id: "u-video", title: "Launch video feedback", lane: "Client feedback", day: 6 },
    { id: "u-landing", title: "Landing page built", lane: "Build", day: 7 },
    { id: "u-email", title: "Launch email copy", lane: "Copy", day: 7 },
    { id: "u-rules", title: "Competition rules checked", lane: "Client feedback", day: 9 },
    { id: "u-social", title: "Social posts designed", lane: "Design", day: 11 },
    { id: "u-qa", title: "Site checked on phones", lane: "Build", day: 12 },
    { id: "u-sign", title: "Round two sign-off", lane: "Sign-off", day: 14 },
  ],
  picks: [
    { id: "k-home", title: "Get homepage copy approved", day: 0, person: "Tom", rank: 1, why: "6 days late, and the build waits on it" },
    { id: "k-terms", title: "Offer terms checked", day: 0, person: "Jess", rank: 2, why: "5 days late, with legal" },
    { id: "k-video", title: "Launch video cut", day: 1, person: "Ravi", rank: 3, why: "Needs checking before Paula sees it" },
    { id: "k-price", title: "Price list approved", day: 1, person: "Tom", why: "Due Tuesday" },
    { id: "k-banner", title: "Banner set", day: 1, person: "Aoife", why: "Due Tuesday" },
    { id: "k-landing", title: "Landing page built", day: 4, person: "Ravi", why: "Due Friday" },
    { id: "k-email", title: "Launch email copy", day: 4, person: "Jess", why: "Due Friday" },
  ],
  pickSentence: [
    "Start with ",
    { b: "the homepage copy", marks: ["k-home"] },
    ": it is 6 days late and the build cannot start without it. Then get ",
    { b: "the offer terms", marks: ["k-terms"] },
    " back from Declan, and check ",
    { b: "the launch video", marks: ["k-video"] },
    " before Paula sees it.",
  ],
  doneThisWeek: ["Email header designed", "Product page copy", "Tracking set up", "Round one sign-off"],
  time: { waiting: 46, doing: 24, checking: 19, notStarted: 11 },
  timeDays: { waiting: 4.6, doing: 2.4, checking: 1.9, notStarted: 1.1 },
  thin: NONE_THIN,
};

/* ── Riverside survey: students, team of 4, hand-in on 6 November ──────── */

const riverside: ProjectData = {
  id: "riverside",
  name: "Riverside survey",
  tone: "var(--v3-project-2)",
  kind: "Class project · 4 people",
  status: "full",
  team: ["Dara", "Aisling", "Seán", "Maeve"],
  target: { day: 42, name: "the hand-in" },
  taskCount: 60,
  datedCount: 51,
  doneCount: 32,
  outsiderWord: { one: "contact", many: "contacts", question: "Which contact slips most?" },
  groupWord: "part",
  weeks: {
    finished: [0, 0, 0, 0, 1, 2, 3, 2, 3, 4, 3, 4, 5, 5],
    added: [0, 0, 0, 0, 12, 8, 6, 5, 4, 4, 3, 3, 2, 2],
    moved: [0, 0, 0, 0, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2],
    dueBeforeLeft: [11, 11, 11, 11, 22, 29, 33, 36, 39, 41, 37, 33, 28, 24],
  },
  lateLastWeek: 3,
  waitingLastWeek: 4,
  groups: [
    { id: "g-int", name: "Interviews", noun: "interview tasks", says: "Interviews take", recent: 9, recentMoved: 4, moves: 6, open: 8, done: 6, p25: 3, median: 6, p75: 9 },
    { id: "g-survey", name: "Survey", noun: "survey tasks", says: "Survey tasks take", recent: 8, recentMoved: 2, moves: 2, open: 5, done: 9, p25: 2, median: 4, p75: 6 },
    { id: "g-analysis", name: "Analysis", noun: "analysis tasks", says: "Analysis takes", recent: 4, recentMoved: 1, moves: 1, open: 7, done: 3, p25: 3, median: 5, p75: 8 },
    { id: "g-writing", name: "Writing", noun: "writing tasks", says: "Writing takes", recent: 3, recentMoved: 0, moves: 0, open: 6, done: 2, p25: 2, median: 4, p75: 7 },
    { id: "g-admin", name: "Admin", noun: "admin tasks", says: "Admin takes", recent: 6, recentMoved: 1, moves: 1, open: 2, done: 12, p25: 1, median: 1, p75: 2 },
  ],
  people: [
    { id: "p-dara", name: "Dara", open: 14, dueNext: 5, finished4w: 3 },
    { id: "p-sean", name: "Seán", open: 6, dueNext: 2, finished4w: 4 },
    { id: "p-aisling", name: "Aisling", open: 4, dueNext: 1, finished4w: 5 },
    { id: "p-maeve", name: "Maeve", open: 4, dueNext: 1, finished4w: 5 },
  ],
  unassigned: 0,
  outsiders: [
    { id: "o-brigid", name: "St Brigid’s", role: "school", tasks: 3, moved: 2, moves: 3, last: -3 },
    { id: "o-youth", name: "Riverside Youth Club", role: "youth club", tasks: 3, moved: 1, moves: 2, last: -6 },
    { id: "o-parents", name: "Parents’ council", role: "parents", tasks: 2, moved: 1, moves: 1, last: -10 },
    { id: "o-library", name: "Town library", role: "library", tasks: 1, moved: 0, moves: 0, last: 0 },
  ],
  moved: [
    { id: "m-brigid", title: "St Brigid’s interviews", who: "St Brigid’s", from: -8, hops: [-1, 6], lastMovedOn: -3 },
    { id: "m-youth", title: "Youth club interviews booked", who: "Riverside Youth Club", from: -12, hops: [-9, -5], lastMovedOn: -6 },
    { id: "m-consent", title: "Consent forms back", who: "St Brigid’s", from: -2, hops: [5], lastMovedOn: -4 },
    { id: "m-parents", title: "Parents’ council survey link", who: "Parents’ council", from: -14, hops: [-7], lastMovedOn: -10 },
  ],
  late: [
    { id: "l-youth", title: "Youth club interviews booked", name: "booking the youth club interviews", person: "Dara", daysLate: 5, reason: "reply" },
    { id: "l-consent", title: "Consent forms collected", name: "the consent forms", person: "Dara", daysLate: 3, reason: "start" },
  ],
  waiting: [
    { id: "w-youth", title: "Youth club interview times", on: "Riverside Youth Club", days: 8 },
    { id: "w-consent", title: "Consent forms", on: "St Brigid’s", days: 5 },
    { id: "w-draft", title: "Methods draft", on: "Ms Kelly", days: 2 },
  ],
  upcoming: [
    { id: "u-survey", title: "Survey closes", lane: "Survey", day: 3 },
    { id: "u-codes", title: "Answer codes agreed", lane: "Analysis", day: 5 },
    { id: "u-brigid", title: "St Brigid’s interviews", lane: "Interviews", day: 6 },
    { id: "u-intro", title: "Introduction draft", lane: "Writing", day: 7 },
    { id: "u-charts", title: "First charts", lane: "Analysis", day: 10 },
    { id: "u-methods", title: "Methods section", lane: "Writing", day: 12 },
    { id: "u-notes", title: "Interview notes typed", lane: "Interviews", day: 13 },
  ],
  picks: [
    { id: "k-youth", title: "Book the youth club interviews", day: 0, person: "Dara", rank: 1, why: "5 days late, and Dara has 13 other things" },
    { id: "k-consent", title: "Collect consent forms", day: 0, person: "Maeve", rank: 2, why: "Move from Dara to Maeve, who has room" },
    { id: "k-survey", title: "Survey closes", day: 0, person: "Aisling", why: "Due Monday" },
    { id: "k-codes", title: "Answer codes agreed", day: 2, person: "Seán", rank: 3, why: "Analysis cannot start without them" },
    { id: "k-brigid", title: "St Brigid’s interviews", day: 3, person: "Dara", why: "Moved twice already" },
    { id: "k-intro", title: "Introduction draft", day: 4, person: "Aisling", why: "Due Friday" },
  ],
  pickSentence: [
    "Start with ",
    { b: "booking the youth club interviews", marks: ["k-youth"] },
    ": they are 5 days late. Then ",
    { b: "hand the consent forms to Maeve", marks: ["k-consent"] },
    " so Dara has less on, and agree ",
    { b: "the answer codes", marks: ["k-codes"] },
    " by Wednesday.",
  ],
  doneThisWeek: ["Survey reminder sent", "Library interview", "Literature notes", "Survey answers cleaned", "Ethics form signed"],
  time: { waiting: 29, doing: 34, checking: 15, notStarted: 22 },
  timeDays: { waiting: 3.1, doing: 3.6, checking: 1.6, notStarted: 2.3 },
  thin: NONE_THIN,
};

/* ── Kiln & Co. shop: small business, 2 people, too new to say much ─────── */

const kiln: ProjectData = {
  id: "kiln",
  name: "Kiln & Co. shop",
  tone: "var(--v3-project-8)",
  kind: "Small business · 2 people",
  status: "thin",
  team: ["Ellen", "Joe"],
  target: null,
  taskCount: 6,
  datedCount: 2,
  doneCount: 1,
  outsiderWord: { one: "supplier", many: "suppliers", question: "Which supplier slips most?" },
  groupWord: "group",
  weeks: {
    finished: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    added: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3],
    moved: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dueBeforeLeft: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  lateLastWeek: 0,
  waitingLastWeek: 0,
  groups: [
    { id: "g-stock", name: "Stock", noun: "stock tasks", says: "Stock tasks take", recent: 0, recentMoved: 0, moves: 0, open: 3, done: 1, p25: 0, median: 0, p75: 0 },
    { id: "g-shop", name: "Shop", noun: "shop tasks", says: "Shop tasks take", recent: 0, recentMoved: 0, moves: 0, open: 2, done: 0, p25: 0, median: 0, p75: 0 },
  ],
  people: [
    { id: "p-ellen", name: "Ellen", open: 3, dueNext: 1, finished4w: 1 },
    { id: "p-joe", name: "Joe", open: 2, dueNext: 0, finished4w: 0 },
  ],
  unassigned: 0,
  outsiders: [],
  moved: [],
  late: [],
  waiting: [],
  upcoming: [
    { id: "u-order", title: "Christmas stock order", lane: "Stock", day: 4 },
    { id: "u-window", title: "Window display", lane: "Shop", day: 13 },
  ],
  picks: [
    { id: "k-order", title: "Christmas stock order", day: 1, person: "Ellen", rank: 1, why: "The only thing due next week" },
    { id: "k-photos", title: "Photograph new mugs", day: 3, person: "Joe", why: "No date yet; a good one to start" },
  ],
  pickSentence: [
    "Start with ",
    { b: "the Christmas stock order", marks: ["k-order"] },
    ": it is the only thing due next week. Everything else has no date yet.",
  ],
  doneThisWeek: ["Price labels printed"],
  time: { waiting: 0, doing: 0, checking: 0, notStarted: 0 },
  timeDays: { waiting: 0, doing: 0, checking: 0, notStarted: 0 },
  thin: {
    "on-course": "Only 2 tasks have dates, so I cannot say if you are on course. Add dates to see.",
    "how-long": "Only 1 task is finished, so I cannot tell how long things usually take. Ask again after a few more.",
    slipping: "No dates have moved yet, so nothing is slipping. Ask again in a week or two.",
    "which-outsider": "No dates have moved yet, so no supplier is slipping. Ask again in a week or two.",
    "those-tasks": "No dates have moved yet, so there are no tasks to show.",
    "getting-better": "Kiln & Co. is 9 days old, so there is nothing to compare with yet. Ask again in a few weeks.",
    "time-goes": "Kiln & Co. is 9 days old, too new to show where time goes. Ask again in a couple of weeks.",
    late: "Nothing is late. Only 2 tasks have dates, and neither is due yet.",
    "waiting-longest": "Nothing is waiting on anyone outside the team.",
    "who-did": "Only 1 task is finished so far, by Ellen. Ask again once a few more are done.",
    changed: "Kiln & Co. started 9 days ago, so there is no earlier week to compare with yet.",
  },
};

/* ── Harbour walk: brand new, no tasks ─────────────────────────────────── */

const harbour: ProjectData = {
  ...kiln,
  id: "harbour",
  name: "Harbour walk 2027",
  tone: "var(--v3-project-4)",
  kind: "Charity event · 1 person",
  status: "empty",
  team: ["You"],
  taskCount: 0,
  datedCount: 0,
  doneCount: 0,
  groups: [],
  people: [],
  upcoming: [],
  picks: [],
  pickSentence: [],
  doneThisWeek: [],
  thin: {},
};

export const PROJECTS: ProjectData[] = [orchard, brightwater, riverside, kiln, harbour];
export const COMPARED = [orchard, brightwater, riverside];

/* ── All Projects: one merged view where the groups are the Projects ───── */

function sumWeeks(key: keyof ProjectData["weeks"]) {
  return Array.from({ length: 14 }, (_, i) => COMPARED.reduce((n, p) => n + p.weeks[key][i], 0));
}
function share(key: keyof TimeShare) {
  const days = COMPARED.map((p) => p.taskCount);
  const total = days.reduce((a, b) => a + b, 0);
  return Math.round(COMPARED.reduce((n, p, i) => n + p.time[key] * days[i], 0) / total);
}
const tag = <T extends object>(p: ProjectData, rows: T[]) => rows.map((r) => ({ ...r, id: `${p.id}:${(r as { id: string }).id}`, project: p.name }));

export const ALL: ProjectData = {
  id: "all",
  name: "All Projects",
  tone: "var(--v3-text-2)",
  kind: "3 Projects with enough history · 12 people",
  status: "all",
  team: COMPARED.flatMap((p) => p.team),
  target: null,
  taskCount: COMPARED.reduce((n, p) => n + p.taskCount, 0),
  datedCount: COMPARED.reduce((n, p) => n + p.datedCount, 0),
  doneCount: COMPARED.reduce((n, p) => n + p.doneCount, 0),
  outsiderWord: { one: "person outside a team", many: "people outside your teams", question: "Who outside the team slips most?" },
  groupWord: "Project",
  weeks: { finished: sumWeeks("finished"), added: sumWeeks("added"), moved: sumWeeks("moved"), dueBeforeLeft: sumWeeks("dueBeforeLeft") },
  lateLastWeek: COMPARED.reduce((n, p) => n + p.lateLastWeek, 0),
  waitingLastWeek: COMPARED.reduce((n, p) => n + p.waitingLastWeek, 0),
  groups: COMPARED.map((p) => {
    const g = p.groups;
    const sum = (k: "recent" | "recentMoved" | "moves" | "open" | "done") => g.reduce((n, x) => n + x[k], 0);
    const doneAll = g.reduce((n, x) => n + x.done, 0);
    const w = (k: "median" | "p25" | "p75") => Math.round(g.reduce((n, x) => n + x[k] * x.done, 0) / doneAll);
    return {
      id: `g-${p.id}`,
      name: p.name,
      noun: `${p.name} tasks`,
      says: `${p.name} tasks take`,
      recent: sum("recent"),
      recentMoved: sum("recentMoved"),
      moves: sum("moves"),
      open: sum("open"),
      done: sum("done"),
      p25: w("p25"),
      median: w("median"),
      p75: w("p75"),
      tone: p.tone,
    };
  }),
  people: COMPARED.flatMap((p) => tag(p, p.people)),
  unassigned: COMPARED.reduce((n, p) => n + p.unassigned, 0),
  outsiders: COMPARED.flatMap((p) => tag(p, p.outsiders)),
  moved: COMPARED.flatMap((p) => tag(p, p.moved)),
  late: COMPARED.flatMap((p) => tag(p, p.late)),
  waiting: COMPARED.flatMap((p) => tag(p, p.waiting)),
  upcoming: COMPARED.flatMap((p) => tag(p, p.upcoming).map((u) => ({ ...u, lane: p.name }))),
  picks: COMPARED.flatMap((p) => tag(p, p.picks.filter((k) => k.rank === 1))),
  pickSentence: [],
  doneThisWeek: COMPARED.flatMap((p) => p.doneThisWeek.slice(0, 2)),
  time: (() => {
    const t = { waiting: share("waiting"), doing: share("doing"), checking: share("checking"), notStarted: 0 };
    t.notStarted = 100 - t.waiting - t.doing - t.checking;
    return t;
  })(),
  timeDays: { waiting: 4.0, doing: 3.0, checking: 2.0, notStarted: 1.6 },
  thin: {},
};

export function projectById(id: string) {
  return id === "all" ? ALL : PROJECTS.find((p) => p.id === id) ?? orchard;
}
