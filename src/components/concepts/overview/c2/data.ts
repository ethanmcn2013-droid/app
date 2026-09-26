/*
 * River of time: invented sample data for the concept. Days are integers
 * relative to today (Thursday 16 July 2026 = 0), so every calculation in the
 * river is plain arithmetic and nothing depends on the viewer's clock.
 */

const TODAY_UTC = Date.UTC(2026, 6, 16);
const DAY_MS = 86_400_000;

/** Day offset for a calendar date in 2026 (month is 1-based). */
export function on(month: number, date: number, year = 2026): number {
  return Math.round((Date.UTC(year, month - 1, date) - TODAY_UTC) / DAY_MS);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parts(day: number) {
  const d = new Date(TODAY_UTC + day * DAY_MS);
  return { date: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

/** Monday = 0 … Sunday = 6. Today is a Thursday. */
export function weekday(day: number): number {
  return (((3 + day) % 7) + 7) % 7;
}

export function mondayOf(day: number): number {
  return day - weekday(day);
}

/** "16 Jul" */
export function short(day: number): string {
  const p = parts(day);
  return `${p.date} ${MONTHS_SHORT[p.month]}`;
}

/** "16 July" */
export function long(day: number): string {
  const p = parts(day);
  return `${p.date} ${MONTHS_LONG[p.month]}`;
}

/** "Thu 16 Jul" */
export function withDay(day: number): string {
  return `${WEEKDAYS_SHORT[weekday(day)]} ${short(day)}`;
}

/** "Thursday 16 July" */
export function fullDay(day: number): string {
  return `${WEEKDAYS_LONG[weekday(day)]} ${long(day)}`;
}

export function weekdayShort(day: number): string {
  return WEEKDAYS_SHORT[weekday(day)];
}

export function monthShort(day: number): string {
  return MONTHS_SHORT[parts(day).month];
}

export function dateOf(day: number): number {
  return parts(day).date;
}

export function isFirstOfMonth(day: number): boolean {
  return parts(day).date === 1;
}

/** "in 3 days", "tomorrow", "2 days ago" */
export function relative(day: number, from = 0): string {
  const diff = day - from;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return diff < 14 ? `in ${diff} days` : `in ${Math.round(diff / 7)} weeks`;
  return -diff < 14 ? `${-diff} days ago` : `${Math.round(-diff / 7)} weeks ago`;
}

// ── People ────────────────────────────────────────────────────────────

export type PersonId = "dara" | "aoife" | "niamh" | "tomas" | "priya";

export type Person = { id: PersonId; name: string; initials: string; role: string };

export const PEOPLE: readonly Person[] = [
  { id: "dara", name: "Dara", initials: "DQ", role: "Events lead" },
  { id: "aoife", name: "Aoife", initials: "AK", role: "Guest experience" },
  { id: "niamh", name: "Niamh", initials: "NB", role: "Head chef" },
  { id: "tomas", name: "Tomás", initials: "TÓ", role: "Venue and hire" },
  { id: "priya", name: "Priya", initials: "PN", role: "Suppliers" },
];

export const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.id, p])) as Record<PersonId, Person>;

// ── Workstreams and projects ─────────────────────────────────────────

export type LaneId = "food" | "venue" | "guests" | "suppliers" | "admin";

export const WORKSTREAMS: readonly { id: LaneId; name: string }[] = [
  { id: "food", name: "Food and drink" },
  { id: "venue", name: "Venue and hire" },
  { id: "guests", name: "Guests and seating" },
  { id: "suppliers", name: "Suppliers" },
  { id: "admin", name: "Admin" },
];

export const WORKSTREAM = Object.fromEntries(WORKSTREAMS.map((w) => [w.id, w])) as Record<
  LaneId,
  { id: LaneId; name: string }
>;

export type ProjectId = "orchard" | "harvest" | "kestrel" | "burren" | "winter" | "lunch" | "spring";

export const PROJECTS: Record<ProjectId, { id: ProjectId; name: string; short: string }> = {
  orchard: { id: "orchard", name: "Mara and Finn, The Orchard", short: "Mara and Finn" },
  harvest: { id: "harvest", name: "Harvest supper club", short: "Harvest supper club" },
  kestrel: { id: "kestrel", name: "Kestrel Studio rebrand", short: "Kestrel rebrand" },
  burren: { id: "burren", name: "Year 11 Burren trip", short: "Burren trip" },
  winter: { id: "winter", name: "Winter season launch", short: "Winter launch" },
  lunch: { id: "lunch", name: "Ní Bhriain anniversary lunch", short: "Anniversary lunch" },
  spring: { id: "spring", name: "Spring open day 2027", short: "Spring open day" },
};

/** Lanes in the Projects lens, in order. */
export const PROJECT_LANES: readonly ProjectId[] = ["orchard", "harvest", "kestrel", "burren", "winter"];

// ── Items ─────────────────────────────────────────────────────────────

export type Status = "todo" | "doing" | "review" | "done";

export type Item = {
  id: string;
  project: ProjectId;
  title: string;
  lane: LaneId;
  owner: PersonId;
  kind: "task" | "milestone";
  /** Undefined for undated items (they wait in the eddy). */
  start?: number;
  due?: number;
  status: Status;
  doneOn?: number;
  /** Ids this item waits on. */
  after?: string[];
  /** Other people it leans on, for clash detection. */
  involves?: PersonId[];
  note?: string;
  /** The destination of a project: the day it is for. */
  terminal?: boolean;
  /** Predicted finish at the current pace, when it differs from the due date. */
  eta?: number;
  /** How a sentence refers to it: "the tasting". */
  ref?: string;
};

const O = "orchard" as const;

export const ITEMS: Item[] = [
  // Food and drink
  { id: "f0", project: O, title: "Canapé shortlist to Mara and Finn", lane: "food", owner: "niamh", kind: "task", start: on(6, 22), due: on(6, 30), status: "done", doneOn: on(6, 30) },
  { id: "f1", project: O, title: "Order tonic and the good olives", lane: "food", owner: "dara", kind: "task", start: on(7, 8), due: on(7, 14), status: "todo", note: "Fever-Tree Mediterranean and the Nocellara olives from Sheridans. The supplier needs 10 days." },
  { id: "f3", project: O, title: "Draft the tasting menu", lane: "food", owner: "niamh", kind: "task", start: on(7, 17), due: on(7, 24), status: "doing", eta: on(7, 29), note: "Three starters, two mains, a vegetarian main that is not risotto." },
  { id: "f4", project: O, title: "Wine pairing shortlist", lane: "food", owner: "tomas", kind: "task", start: on(7, 22), due: on(7, 30), status: "todo" },
  { id: "f2", project: O, title: "Menu tasting", lane: "food", owner: "niamh", kind: "milestone", due: on(8, 1), status: "todo", ref: "the tasting", after: ["f3", "f4"], involves: ["dara"], note: "Mara, Finn and both mothers. Saturday lunch at the Orchard kitchen." },
  { id: "f7", project: O, title: "Confirm menu with the kitchen", lane: "food", owner: "niamh", kind: "task", start: on(8, 3), due: on(8, 7), status: "todo", after: ["f2"] },
  { id: "f6", project: O, title: "Cake tasting", lane: "food", owner: "aoife", kind: "task", start: on(8, 10), due: on(8, 14), status: "todo", after: ["f7"] },
  { id: "f5", project: O, title: "Final numbers to Niamh", lane: "food", owner: "aoife", kind: "milestone", due: on(9, 12), status: "todo", ref: "final numbers", after: ["g2"], involves: ["niamh"] },

  // Venue and hire
  { id: "v0", project: O, title: "Open day, nine couples through", lane: "venue", owner: "dara", kind: "task", start: on(7, 6), due: on(7, 9), status: "done", doneOn: on(7, 9) },
  { id: "v5", project: O, title: "Marquee booked", lane: "venue", owner: "tomas", kind: "task", start: on(6, 29), due: on(7, 7), status: "done", doneOn: on(7, 7) },
  { id: "v1", project: O, title: "Confirm marquee sides", lane: "venue", owner: "tomas", kind: "task", start: on(7, 13), due: on(7, 24), status: "doing", note: "Clear sides for the view, solid sides on standby if the forecast turns." },
  { id: "v3", project: O, title: "Book the backup generator", lane: "venue", owner: "tomas", kind: "task", start: on(7, 27), due: on(7, 31), status: "todo" },
  { id: "v4", project: O, title: "Ceremony chair count", lane: "venue", owner: "priya", kind: "task", start: on(8, 10), due: on(8, 21), status: "todo", eta: on(8, 25) },
  { id: "v2", project: O, title: "Lighting walk-through", lane: "venue", owner: "tomas", kind: "milestone", due: on(9, 18), status: "todo", involves: ["dara"] },

  // Guests and seating
  { id: "g0", project: O, title: "Save-the-date proofs", lane: "guests", owner: "aoife", kind: "task", start: on(6, 25), due: on(7, 1), status: "done", doneOn: on(7, 1) },
  { id: "g1", project: O, title: "Seating plan approval", lane: "guests", owner: "aoife", kind: "task", start: on(7, 6), due: on(7, 20), status: "review", eta: on(7, 22), note: "With Mara since Monday. Two tables still argue about the band side." },
  { id: "g3", project: O, title: "Chase the 28 missing RSVPs", lane: "guests", owner: "aoife", kind: "task", start: on(7, 27), due: on(7, 29), status: "todo" },
  { id: "g4", project: O, title: "Access needs list", lane: "guests", owner: "aoife", kind: "task", start: on(7, 27), due: on(7, 31), status: "todo" },
  { id: "g2", project: O, ref: "RSVPs", title: "RSVPs close", lane: "guests", owner: "aoife", kind: "milestone", due: on(9, 5), status: "todo", note: "112 of 140 replied so far." },
  { id: "g5", project: O, title: "Place cards to the printer", lane: "guests", owner: "priya", kind: "task", start: on(9, 14), due: on(9, 21), status: "todo", after: ["f5"] },

  // Suppliers
  { id: "s2", project: O, title: "Band contract signed", lane: "suppliers", owner: "dara", kind: "task", start: on(6, 26), due: on(7, 3), status: "done", doneOn: on(7, 3) },
  { id: "s3", project: O, title: "Photographer shot list", lane: "suppliers", owner: "aoife", kind: "task", start: on(7, 20), due: on(7, 29), status: "todo" },
  { id: "s1", project: O, title: "Florist deposit", lane: "suppliers", owner: "priya", kind: "milestone", due: on(7, 30), status: "todo", note: "€600 to Wildflower Room to hold the date." },
  { id: "s5", project: O, title: "Florist mood board", lane: "suppliers", owner: "priya", kind: "task", start: on(8, 17), due: on(8, 25), status: "todo", after: ["s1"] },
  { id: "s4", project: O, title: "Confirm band set times", lane: "suppliers", owner: "dara", kind: "task", start: on(8, 24), due: on(9, 4), status: "todo", eta: on(9, 9) },

  // Admin
  { id: "a0", project: O, title: "Deposit settled, Mara and Finn", lane: "admin", owner: "dara", kind: "task", start: on(7, 6), due: on(7, 15), status: "done", doneOn: on(7, 15) },
  { id: "a1", project: O, title: "Build the Saturday run-sheet", lane: "admin", owner: "dara", kind: "task", start: on(7, 10), due: on(7, 16), status: "doing", eta: on(7, 17) },
  { id: "a3", project: O, title: "Insurance certificate", lane: "admin", owner: "dara", kind: "task", start: on(7, 20), due: on(7, 24), status: "todo" },
  { id: "a2", project: O, title: "Balance invoice", lane: "admin", owner: "dara", kind: "milestone", due: on(9, 3), status: "todo" },
  { id: "a4", project: O, title: "Final run-sheet", lane: "admin", owner: "dara", kind: "task", start: on(9, 21), due: on(9, 28), status: "todo", after: ["g5"] },

  // Destination
  { id: "w0", project: O, title: "Wedding day", lane: "admin", owner: "dara", kind: "milestone", due: on(10, 3), status: "todo", terminal: true },

  // Other projects, for the Projects lens
  { id: "h1", project: "harvest", title: "Tickets on sale", lane: "admin", owner: "priya", kind: "milestone", due: on(8, 3), status: "todo" },
  { id: "h2", project: "harvest", title: "Menu locked", lane: "food", owner: "niamh", kind: "milestone", due: on(8, 28), status: "todo" },
  { id: "h3", project: "harvest", title: "Harvest supper club", lane: "food", owner: "niamh", kind: "milestone", due: on(9, 12), status: "todo", terminal: true },
  { id: "h0", project: "harvest", title: "Producers confirmed", lane: "suppliers", owner: "niamh", kind: "task", start: on(7, 1), due: on(7, 10), status: "done", doneOn: on(7, 10) },
  { id: "k1", project: "kestrel", title: "Concept review", lane: "admin", owner: "tomas", kind: "milestone", due: on(8, 7), status: "todo" },
  { id: "k2", project: "kestrel", title: "Signage proofs", lane: "admin", owner: "tomas", kind: "task", start: on(8, 17), due: on(8, 28), status: "todo" },
  { id: "k3", project: "kestrel", title: "Rebrand launch", lane: "admin", owner: "tomas", kind: "milestone", due: on(9, 4), status: "todo", involves: ["aoife"], terminal: true },
  { id: "k0", project: "kestrel", title: "Brief signed off", lane: "admin", owner: "tomas", kind: "task", start: on(6, 29), due: on(7, 2), status: "done", doneOn: on(7, 2) },
  { id: "b1", project: "burren", title: "Consent forms back", lane: "guests", owner: "aoife", kind: "milestone", due: on(9, 4), status: "todo" },
  { id: "b2", project: "burren", title: "Year 11 Burren trip", lane: "guests", owner: "dara", kind: "milestone", due: on(9, 24), status: "todo", terminal: true },
  { id: "n1", project: "winter", title: "Menu shoot", lane: "food", owner: "niamh", kind: "milestone", due: on(10, 15), status: "todo" },
  { id: "n2", project: "winter", title: "Winter season launch", lane: "admin", owner: "dara", kind: "milestone", due: on(11, 1), status: "todo", terminal: true },

  // The day after: an event that happened yesterday
  ...lunchItems(),

  // No dates yet
  { id: "p1", project: "spring", title: "Choose a date with the Orchard team", lane: "admin", owner: "dara", kind: "task", status: "todo" },
  { id: "p2", project: "spring", title: "Draft the invite list", lane: "guests", owner: "aoife", kind: "task", status: "todo" },
  { id: "p3", project: "spring", title: "Brief the photographer", lane: "suppliers", owner: "priya", kind: "task", status: "todo" },
];

function lunchItems(): Item[] {
  const L = "lunch" as const;
  const rows: [string, LaneId, PersonId, number, number, number][] = [
    ["Walk the room with the family", "venue", "tomas", on(5, 28), on(6, 2), on(6, 2)],
    ["Menu agreed", "food", "niamh", on(6, 1), on(6, 12), on(6, 11)],
    ["Invites out", "guests", "aoife", on(6, 3), on(6, 8), on(6, 8)],
    ["Deposit settled", "admin", "dara", on(6, 1), on(6, 10), on(6, 9)],
    ["Harpist booked", "suppliers", "priya", on(6, 8), on(6, 16), on(6, 18)],
    ["Wine order in", "food", "tomas", on(6, 15), on(6, 26), on(6, 24)],
    ["RSVPs closed, 46 guests", "guests", "aoife", on(6, 20), on(6, 30), on(6, 30)],
    ["Seating plan signed off", "guests", "aoife", on(7, 1), on(7, 6), on(7, 6)],
    ["Flowers confirmed", "suppliers", "priya", on(6, 22), on(7, 3), on(7, 2)],
    ["Cake collected", "food", "niamh", on(7, 13), on(7, 14), on(7, 14)],
    ["Run-sheet sent", "admin", "dara", on(7, 6), on(7, 10), on(7, 10)],
    ["Tables and linen set", "venue", "tomas", on(7, 13), on(7, 14), on(7, 14)],
    ["Speeches order agreed", "guests", "dara", on(7, 7), on(7, 12), on(7, 13)],
    ["Final numbers to kitchen", "food", "aoife", on(7, 6), on(7, 8), on(7, 8)],
    ["Balance paid", "admin", "dara", on(7, 1), on(7, 8), on(7, 7)],
  ];
  const items: Item[] = rows.map(([title, lane, owner, start, due, doneOn], i) => ({
    id: `l${i}`,
    project: L,
    title,
    lane,
    owner,
    kind: "task",
    start,
    due,
    status: "done",
    doneOn,
  }));
  items.push({
    id: "lz",
    project: L,
    title: "Anniversary lunch",
    lane: "admin",
    owner: "dara",
    kind: "milestone",
    due: on(7, 15),
    status: "done",
    doneOn: on(7, 15),
    terminal: true,
  });
  return items;
}

// ── Scopes ────────────────────────────────────────────────────────────

export type ScopeId = "orchard" | "all" | "lunch" | "spring";

export type Scope = {
  id: ScopeId;
  label: string;
  hint: string;
  /** The canvas: first and last day drawn. */
  range: [number, number];
  /** The default window that fits the viewport at the widest zoom. */
  window: [number, number];
};

export const SCOPES: readonly Scope[] = [
  { id: "orchard", label: "Mara and Finn, The Orchard", hint: "Wedding, Sat 3 Oct", range: [on(6, 1), on(10, 25)], window: [on(6, 22), on(10, 10)] },
  { id: "all", label: "All projects", hint: "5 running side by side", range: [on(6, 1), on(11, 22)], window: [on(6, 15), on(11, 8)] },
  { id: "lunch", label: "Ní Bhriain anniversary lunch", hint: "Held yesterday", range: [on(5, 25), on(7, 26)], window: [on(5, 25), on(7, 26)] },
  { id: "spring", label: "Spring open day 2027", hint: "No dates yet", range: [on(6, 15), on(5, 2, 2027)], window: [on(6, 15), on(4, 25, 2027)] },
];

export const SCOPE = Object.fromEntries(SCOPES.map((s) => [s.id, s])) as Record<ScopeId, Scope>;
