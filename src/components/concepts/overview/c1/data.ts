/*
 * The morning edition: invented sample data. Today is Thursday 16 July,
 * 09:00. The reader is Dara O'Neill, who leads The Orchard, events.
 */

export const TODAY = "2026-07-16";
export const WEEK_END = "2026-07-19";
export const LAST_READ = "Tuesday";

export type PersonId = "dara" | "aoife" | "niamh" | "tomas" | "priya" | "siobhan" | "mara" | "finn";

export type Person = {
  id: PersonId;
  name: string;
  initials: string;
  role: string;
  tone: number; // 1..8, maps to --v3-project-n
  client?: boolean;
  lastSeen: string;
};

export const PEOPLE: Record<PersonId, Person> = {
  dara: { id: "dara", name: "Dara", initials: "DO", role: "Lead, Orchard events (you)", tone: 1, lastSeen: "Here now" },
  aoife: { id: "aoife", name: "Aoife", initials: "AB", role: "Events coordinator", tone: 8, lastSeen: "Active 4 min ago" },
  niamh: { id: "niamh", name: "Niamh", initials: "NK", role: "Head chef", tone: 5, lastSeen: "Active 1 hr ago" },
  tomas: { id: "tomas", name: "Tomás", initials: "TR", role: "Operations", tone: 3, lastSeen: "On site at the marquee field" },
  priya: { id: "priya", name: "Priya", initials: "PS", role: "Designer", tone: 2, lastSeen: "Active yesterday" },
  siobhan: { id: "siobhan", name: "Siobhán", initials: "SM", role: "Year 11 teacher", tone: 4, lastSeen: "Active 2 hr ago" },
  mara: { id: "mara", name: "Mara", initials: "MA", role: "Client, marrying 3 October", tone: 7, client: true, lastSeen: "Replied yesterday" },
  finn: { id: "finn", name: "Finn", initials: "FL", role: "Client, marrying 3 October", tone: 6, client: true, lastSeen: "Replied yesterday" },
};

export type ProjectId = "orchard" | "harvest" | "kestrel" | "burren" | "winter";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  initials: string;
  tone: number;
  lead: PersonId;
  status: string;
  need: number; // higher = needs the reader more
};

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard, events", short: "Orchard events", initials: "OE", tone: 7, lead: "dara", status: "2 slipped, 1 call for you", need: 3 },
  { id: "harvest", name: "Harvest supper club", short: "Harvest supper club", initials: "HS", tone: 6, lead: "niamh", status: "Needs attention", need: 4 },
  { id: "burren", name: "Year 11 field trip to the Burren", short: "Burren field trip", initials: "YB", tone: 4, lead: "siobhan", status: "Forms 22 of 28", need: 2 },
  { id: "kestrel", name: "Kestrel Studio rebrand", short: "Kestrel rebrand", initials: "KS", tone: 2, lead: "priya", status: "On track", need: 1 },
  { id: "winter", name: "The Orchard winter season launch", short: "Orchard winter launch", initials: "WS", tone: 3, lead: "dara", status: "Early, 2 tasks", need: 0 },
];

export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

export type TaskStatus = "todo" | "doing" | "review" | "stalled" | "done";

export type TaskAction =
  | { kind: "done"; label: string; key: string }
  | { kind: "reschedule"; label: string; key: string; to: string }
  | { kind: "reassign"; label: string; key: string; to: PersonId }
  | { kind: "nudge"; label: string; key: string; to: PersonId };

export type Task = {
  id: string;
  project: ProjectId;
  title: string;
  /* How the task reads inside a sentence: lower case, no template slots. */
  phrase: string;
  owner: PersonId;
  due: string | null;
  status: TaskStatus;
  priority?: "high";
  lastActivity: string;
  handled?: string; // what the reader did about it, in past tense
  lastAction?: TaskAction;
  doneAt?: string;
  actions?: TaskAction[];
};

const DONE: TaskAction = { kind: "done", label: "Mark done", key: "D" };

export const INITIAL_TASKS: Task[] = [
  {
    id: "tonic",
    project: "orchard",
    title: "Order tonic + the good olives",
    phrase: "the tonic and olives order",
    owner: "tomas",
    due: "2026-07-14",
    status: "todo",
    lastActivity: "Tomás added the olive supplier, Mon 13 Jul",
    actions: [
      { kind: "reschedule", label: "Push to 20 Jul", key: "S", to: "2026-07-20" },
      { kind: "reassign", label: "Give to Aoife", key: "R", to: "aoife" },
    ],
  },
  {
    id: "runsheet",
    project: "orchard",
    title: "Build the Saturday run-sheet",
    phrase: "the Saturday run-sheet",
    owner: "aoife",
    due: "2026-07-16",
    status: "doing",
    lastActivity: "Aoife edited the timings, 08:41 today",
    actions: [DONE, { kind: "nudge", label: "Check in with Aoife", key: "N", to: "aoife" }],
  },
  {
    id: "tasting",
    project: "orchard",
    title: "Menu tasting at The Orchard",
    phrase: "the menu tasting",
    owner: "niamh",
    due: "2026-08-01",
    status: "stalled",
    lastActivity: "No change for 15 days. Niamh moved the date on Wednesday",
    actions: [
      { kind: "nudge", label: "Ask Niamh", key: "N", to: "niamh" },
      { kind: "nudge", label: "Chase the supplier", key: "C", to: "tomas" },
    ],
  },
  {
    id: "marquee",
    project: "orchard",
    title: "Confirm marquee sides with the hire company",
    phrase: "confirming the marquee sides",
    owner: "tomas",
    due: null,
    status: "todo",
    lastActivity: "Created by Dara, 2 Jul",
    actions: [
      { kind: "reschedule", label: "Set for 21 Jul", key: "S", to: "2026-07-21" },
      DONE,
    ],
  },
  {
    id: "seating",
    project: "orchard",
    title: "Approve the final seating plan",
    phrase: "approving the seating plan",
    owner: "dara",
    due: "2026-07-17",
    status: "review",
    lastActivity: "Aoife sent version 4 for review, Wed 16:12",
    actions: [
      { kind: "done", label: "Approve plan", key: "A" },
      { kind: "nudge", label: "Ask for changes", key: "C", to: "aoife" },
    ],
  },
  {
    id: "midweek",
    project: "orchard",
    title: "Send midweek rate to the June 2027 walk-in couple",
    phrase: "the midweek rate for the walk-in couple",
    owner: "aoife",
    due: "2026-07-17",
    status: "todo",
    priority: "high",
    lastActivity: "The couple asked again by email, Wed 11:05",
    actions: [DONE, { kind: "reschedule", label: "Push to Monday", key: "S", to: "2026-07-20" }],
  },
  { id: "sign", project: "orchard", title: "Draft the christening welcome sign", phrase: "the christening welcome sign", owner: "aoife", due: "2026-07-17", status: "todo", lastActivity: "Created Tue 14 Jul" },
  { id: "numbers", project: "orchard", title: "Chase Mara & Finn for final guest numbers", phrase: "chasing Mara and Finn’s guest numbers", owner: "aoife", due: "2026-07-24", status: "todo", lastActivity: "Created Mon 6 Jul" },
  { id: "florist", project: "orchard", title: "Confirm the florist walk-through", phrase: "the florist walk-through", owner: "aoife", due: "2026-07-29", status: "todo", lastActivity: "Created Mon 6 Jul" },
  { id: "ceilidh", project: "orchard", title: "Hold the ceilidh band for 3 October", phrase: "holding the ceilidh band", owner: "aoife", due: "2026-08-07", status: "todo", lastActivity: "Created Fri 10 Jul" },
  { id: "prep", project: "orchard", title: "Prep list for the christening lunch", phrase: "the christening prep list", owner: "niamh", due: "2026-07-18", status: "doing", lastActivity: "Niamh started it, 07:30 today" },
  { id: "proofs", project: "orchard", title: "Stationery proofs for Mara & Finn", phrase: "the stationery proofs", owner: "priya", due: "2026-07-27", status: "doing", lastActivity: "Priya uploaded a draft, Mon 13 Jul" },
  { id: "openday", project: "orchard", title: "Open day, nine couples through", phrase: "the open day", owner: "aoife", due: "2026-07-15", status: "done", doneAt: "2026-07-15", lastActivity: "Aoife closed it, Wed 18:20" },
  { id: "deposit", project: "orchard", title: "Deposit invoice settled, Mara & Finn", phrase: "Mara and Finn’s deposit", owner: "dara", due: "2026-07-15", status: "done", doneAt: "2026-07-15", lastActivity: "Payment landed, Wed 10:02" },

  // Other projects
  {
    id: "tickets",
    project: "harvest",
    title: "Sell the last 18 supper club seats",
    phrase: "the last 18 supper club seats",
    owner: "niamh",
    due: "2026-09-05",
    status: "doing",
    lastActivity: "3 seats sold last week, 11 the week before",
    actions: [
      { kind: "nudge", label: "Ask Priya for a poster", key: "P", to: "priya" },
      { kind: "reschedule", label: "Push to 12 Sep", key: "S", to: "2026-09-12" },
    ],
  },
  { id: "harvestmenu", project: "harvest", title: "Write the harvest menu", phrase: "the harvest menu", owner: "niamh", due: "2026-08-14", status: "doing", lastActivity: "Niamh drafted four courses, Sun 12 Jul" },
  {
    id: "consent",
    project: "burren",
    title: "Collect the last 6 consent forms",
    phrase: "the last six consent forms",
    owner: "siobhan",
    due: "2026-09-04",
    status: "doing",
    lastActivity: "Two forms came back on Monday",
    actions: [
      { kind: "nudge", label: "Remind six families", key: "N", to: "siobhan" },
      DONE,
    ],
  },
  { id: "bus", project: "burren", title: "Book the coach to Ballyvaughan", phrase: "the coach to Ballyvaughan", owner: "siobhan", due: "2026-07-31", status: "todo", lastActivity: "Two quotes in, Fri 10 Jul" },
  { id: "logo", project: "kestrel", title: "Logo review with Kestrel", phrase: "the logo review", owner: "priya", due: "2026-07-24", status: "doing", lastActivity: "Priya shared three routes, Tue 14 Jul" },
  { id: "type", project: "kestrel", title: "Choose the type pairing", phrase: "the type pairing", owner: "priya", due: "2026-07-31", status: "todo", lastActivity: "Created Mon 13 Jul" },
  { id: "wintermenu", project: "winter", title: "Sketch the winter menu", phrase: "the winter menu", owner: "niamh", due: "2026-09-18", status: "todo", lastActivity: "Created by Dara, Mon 13 Jul", actions: [DONE, { kind: "reassign", label: "Give to Aoife", key: "R", to: "aoife" }] },
  { id: "winterdates", project: "winter", title: "Pick three launch dates", phrase: "picking three launch dates", owner: "dara", due: null, status: "todo", lastActivity: "Created by Dara, Mon 13 Jul", actions: [DONE, { kind: "reschedule", label: "Set for 24 Jul", key: "S", to: "2026-07-24" }] },
];

export type FileId = "seating" | "winelist" | "quote" | "runsheet" | "proofs" | "poster";

export type FileRef = {
  id: FileId;
  name: string;
  kind: "doc" | "sheet" | "image" | "design" | "slides" | "neutral";
  ext: string;
  size: string;
  updated: string;
  by: PersonId;
};

export const FILES: Record<FileId, FileRef> = {
  seating: { id: "seating", name: "Seating plan v4", kind: "design", ext: "PDF", size: "2.1 MB", updated: "Wed 16:12", by: "aoife" },
  winelist: { id: "winelist", name: "Wine list draft", kind: "doc", ext: "DOC", size: "84 KB", updated: "1 Jul", by: "niamh" },
  quote: { id: "quote", name: "Ballymaloe Wines quote", kind: "neutral", ext: "Waiting", size: "Not received", updated: "Requested 1 Jul", by: "niamh" },
  runsheet: { id: "runsheet", name: "Saturday run-sheet", kind: "sheet", ext: "SHEET", size: "31 rows", updated: "08:41 today", by: "aoife" },
  proofs: { id: "proofs", name: "Stationery proofs, round 1", kind: "image", ext: "PNG", size: "6 images", updated: "Mon 13 Jul", by: "priya" },
  poster: { id: "poster", name: "Harvest poster", kind: "design", ext: "FIG", size: "Draft", updated: "Fri 10 Jul", by: "priya" },
};

/* Things that happen on a date. An event that stands for a task names it,
   so the date card never lists the same work twice. */
export type DayEvent = { label: string; taskId?: string };

export const EVENTS: Record<string, DayEvent[]> = {
  "2026-07-16": [{ label: "Aoife’s run-sheet is due", taskId: "runsheet" }],
  "2026-07-17": [
    { label: "Seating plan to the printer by noon", taskId: "seating" },
    { label: "Midweek rate goes to the walk-in couple", taskId: "midweek" },
  ],
  "2026-07-18": [{ label: "The Kelly christening lunch, 40 guests" }],
  "2026-07-21": [{ label: "Marquee site visit with the hire company" }],
  "2026-07-24": [
    { label: "Final guest numbers from Mara & Finn", taskId: "numbers" },
    { label: "Logo review with Kestrel", taskId: "logo" },
  ],
  "2026-07-27": [{ label: "Stationery proofs from Priya", taskId: "proofs" }],
  "2026-08-01": [{ label: "Menu tasting at The Orchard", taskId: "tasting" }],
  "2026-08-14": [{ label: "Menu goes to print" }],
  "2026-10-03": [{ label: "Mara & Finn’s wedding, 140 guests" }],
  "2026-09-12": [{ label: "Harvest supper club, 60 seats" }],
  "2026-09-17": [{ label: "Year 11 trip to the Burren" }],
};

/* Finished per week, oldest first (the last bar is this week). */
export const WEEKLY_DONE = [4, 5, 4, 2];

export type Change = {
  id: string;
  subject: string;
  from?: string;
  to: string;
  who: PersonId;
  when: string;
  /* What the change means, so colour carries signal, not the diff operation. */
  tone?: "late" | "you" | "good";
};

export const CHANGES: Change[] = [
  { id: "c1", subject: "Seating plan", from: "In progress", to: "Waiting for your approval", who: "aoife", when: "Wed 16:12", tone: "you" },
  { id: "c2", subject: "Tonic and olives order", from: "Due Tue 14 Jul", to: "2 days late", who: "tomas", when: "no word since Mon", tone: "late" },
  { id: "c3", subject: "Menu tasting", from: "Sat 25 Jul", to: "Sat 1 Aug", who: "niamh", when: "Wed 09:30" },
  { id: "c4", subject: "Mara and Finn’s deposit", from: "Waiting", to: "Settled", who: "dara", when: "Wed 10:02", tone: "good" },
  { id: "c5", subject: "Open day", from: "Planned", to: "Nine couples through", who: "aoife", when: "Wed 18:20", tone: "good" },
];

/* ── dates ─────────────────────────────────────────────────────── */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

export function addDays(iso: string, n: number) {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtShort(iso: string) {
  const d = parseIso(iso);
  return `${DAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

export function fmtLong(iso: string) {
  const d = parseIso(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtDayMonth(iso: string) {
  const d = parseIso(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function weekday(iso: string) {
  return DAYS[parseIso(iso).getUTCDay()];
}

export function relative(iso: string) {
  const n = daysBetween(TODAY, iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days late`;
  if (n < 7) return `This ${weekday(iso)}`;
  return `In ${n} days`;
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
export const word = (n: number) => WORDS[n] ?? String(n);
export const lowerWord = (n: number) => word(n).toLowerCase();
