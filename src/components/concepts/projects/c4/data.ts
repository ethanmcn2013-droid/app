/*
 * Sample world for the Project map concept: The Orchard, a venue that runs
 * weddings, venue events, its own works and marketing. Every date is a day
 * offset from a fixed "today" (Friday 25 September 2026) so the map reads the
 * same on every render and never drifts with the wall clock.
 */

export type Health = "good" | "watch" | "help";
export type Kind = "wedding" | "event" | "works" | "marketing" | "other";
export type PersonId = "orla" | "dev" | "tomas" | "aoife";
export type FileKind = "doc" | "sheet" | "image" | "slides" | "design" | "link";

export type Person = {
  id: PersonId;
  name: string;
  first: string;
  initials: string;
  role: string;
  /** CSS colour for the People lens. */
  color: string;
};

export type Milestone = { day: number; label: string; done?: boolean };
export type Task = { title: string; who: PersonId; due: number; done?: boolean };
export type KeyLink = { kind: FileKind; title: string; meta: string };
export type Activity = { who: PersonId; text: string; ago: string };

export type Project = {
  id: string;
  name: string;
  /** Short form for tight spots. */
  short: string;
  kind: Kind;
  /** Day offset from today. Undefined means no date yet. */
  day?: number;
  /** For projects that run over a range (markets, seasons). */
  endDay?: number;
  health: Health;
  status: string;
  progress: number;
  open: number;
  overdue: number;
  owner: PersonId;
  team: PersonId[];
  color: string;
  /** Why the project sits where it does, in one line. */
  signal: string;
  milestones: Milestone[];
  tasks: Task[];
  links: KeyLink[];
  activity: Activity[];
  /** Set on projects past their date that are not wrapped up. */
  unwrapped?: string;
  isNew?: boolean;
};

export type Relation = { a: string; b: string; reason: string };

/** Friday 25 September 2026. */
export const TODAY = { y: 2026, m: 8, d: 25 };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Calendar parts for a day offset, computed in UTC so SSR and client agree. */
export function parts(day: number) {
  const t = Date.UTC(TODAY.y, TODAY.m, TODAY.d + Math.round(day));
  const date = new Date(t);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate(), wd: date.getUTCDay() };
}

export const monthName = (m: number) => MONTHS[m];
export const monthShort = (m: number) => MONTHS_SHORT[m];

/** "Sat 3 Oct" */
export function fmtShort(day: number) {
  const p = parts(day);
  return `${WEEKDAYS_SHORT[p.wd]} ${p.d} ${MONTHS_SHORT[p.m]}`;
}

/** "3 Oct" */
export function fmtDayMonth(day: number) {
  const p = parts(day);
  return `${p.d} ${MONTHS_SHORT[p.m]}`;
}

/** "Saturday 3 October" (year added when it is not this year). */
export function fmtLong(day: number) {
  const p = parts(day);
  const year = p.y !== TODAY.y ? ` ${p.y}` : "";
  return `${WEEKDAYS[p.wd]} ${p.d} ${MONTHS[p.m]}${year}`;
}

/** "3 October" */
export function fmtPlain(day: number) {
  const p = parts(day);
  const year = p.y !== TODAY.y ? ` ${p.y}` : "";
  return `${p.d} ${MONTHS[p.m]}${year}`;
}

/** "8 days", "Tomorrow", "Today", "6 days over" */
export function fmtUntil(day: number) {
  const d = Math.round(day);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "1 day over";
  if (d < 0) return `${-d} days over`;
  if (d < 70) return `${d} days`;
  return `${Math.round(d / 7)} weeks`;
}

/** "in 8 days" for sentences and labels read aloud. */
export function fmtIn(day: number) {
  const d = Math.round(day);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 0) return `${-d} ${d === -1 ? "day" : "days"} ago`;
  if (d < 70) return `in ${d} days`;
  return `in ${Math.round(d / 7)} weeks`;
}

/** Monday on or before the given day offset. */
export function weekStart(day: number) {
  const wd = parts(day).wd; // 0 Sun .. 6 Sat
  const back = (wd + 6) % 7;
  return Math.floor(day) - back;
}

export const PEOPLE: Record<PersonId, Person> = {
  orla: { id: "orla", name: "Orla Byrne", first: "Orla", initials: "OB", role: "Events lead", color: "var(--v3-project-8)" },
  dev: { id: "dev", name: "Dev Mehta", first: "Dev", initials: "DM", role: "Operations", color: "var(--v3-project-2)" },
  tomas: { id: "tomas", name: "Tomás Ó Ceallaigh", first: "Tomás", initials: "TÓ", role: "Venue and works", color: "var(--v3-project-5)" },
  aoife: { id: "aoife", name: "Aoife Nolan", first: "Aoife", initials: "AN", role: "Bookings and marketing", color: "var(--v3-project-3)" },
};

export const PEOPLE_ORDER: PersonId[] = ["orla", "dev", "tomas", "aoife"];

export const KIND_LABEL: Record<Kind, string> = {
  wedding: "Wedding",
  event: "Venue event",
  works: "Venue works",
  marketing: "Marketing",
  other: "Other",
};

export const KIND_LANES: { id: Kind; label: string }[] = [
  { id: "wedding", label: "Weddings" },
  { id: "event", label: "Venue events" },
  { id: "works", label: "Venue works" },
  { id: "marketing", label: "Marketing" },
  { id: "other", label: "Other" },
];

/** One lane per status word: the words on the rows are the words everywhere. */
export const HEALTH_LANES: { id: Health; label: string }[] = [
  { id: "good", label: "Going well" },
  { id: "watch", label: "Watch" },
  { id: "help", label: "Needs help" },
];

export const HEALTH_LABEL: Record<Health, string> = { good: "Going well", watch: "Watch", help: "Needs help" };

/** The colour that means "how it is going", wherever it appears. */
export const HEALTH_COLOR: Record<Health, string> = {
  good: "var(--v3-success)",
  watch: "var(--v3-warning-stroke)",
  help: "var(--v3-danger)",
};

/**
 * The one status vocabulary: the map's rows. A project past its date and not
 * wrapped up is the only exception, and says so.
 */
export function statusWord(p: Project) {
  return p.unwrapped ? "Not wrapped" : HEALTH_LABEL[p.health];
}

export const PROJECTS: Project[] = [
  {
    id: "doyle",
    name: "Doyle anniversary lunch",
    short: "Doyle lunch",
    kind: "event",
    day: -6,
    health: "watch",
    status: "Not wrapped",
    progress: 90,
    open: 2,
    overdue: 2,
    owner: "dev",
    team: ["dev"],
    color: "var(--v3-project-4)",
    signal: "Final invoice and thank-you note still open",
    unwrapped: "Final invoice unpaid",
    milestones: [
      { day: -40, label: "Menu agreed", done: true },
      { day: -13, label: "Numbers final", done: true },
      { day: -6, label: "Lunch", done: true },
      { day: -1, label: "Final invoice" },
    ],
    tasks: [
      { title: "Send final invoice", who: "dev", due: -1 },
      { title: "Post thank-you card and photos", who: "dev", due: 1 },
    ],
    links: [
      { kind: "sheet", title: "Doyle lunch costs", meta: "Sheet · edited 6 days ago" },
      { kind: "image", title: "Table photos", meta: "24 images" },
    ],
    activity: [
      { who: "dev", text: "marked the lunch done", ago: "6 days ago" },
      { who: "orla", text: "asked about the invoice", ago: "2 days ago" },
    ],
  },
  {
    id: "mara-finn",
    name: "Mara & Finn's wedding",
    short: "Mara & Finn",
    kind: "wedding",
    day: 8,
    health: "good",
    status: "On track",
    progress: 38,
    open: 8,
    overdue: 1,
    owner: "orla",
    team: ["orla", "dev"],
    color: "var(--v3-project-1)",
    signal: "Going well, with one overdue task",
    milestones: [
      { day: -52, label: "Venue walk-through", done: true },
      { day: -18, label: "Menu tasting", done: true },
      { day: -4, label: "Seating plan", done: true },
      { day: 4, label: "Final numbers to caterer" },
      { day: 7, label: "Rehearsal" },
      { day: 8, label: "Wedding day" },
    ],
    tasks: [
      { title: "Confirm florist arrival time", who: "orla", due: -1 },
      { title: "Send final numbers to Fennel & Salt", who: "dev", due: 4 },
      { title: "Print table plan and place cards", who: "orla", due: 5 },
      { title: "Book late bar staff", who: "dev", due: 6, done: true },
    ],
    links: [
      { kind: "sheet", title: "Guest list and dietary needs", meta: "Sheet · 112 guests" },
      { kind: "doc", title: "Run of the day", meta: "Doc · edited 2 hours ago" },
      { kind: "design", title: "Table plan", meta: "Design · 14 tables" },
      { kind: "link", title: "Fennel & Salt quote", meta: "fennelandsalt.ie" },
    ],
    activity: [
      { who: "orla", text: "moved the ceremony to 1.30pm", ago: "2 hours ago" },
      { who: "dev", text: "booked two late bar staff", ago: "Yesterday" },
      { who: "orla", text: "uploaded the table plan", ago: "Tuesday" },
    ],
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    short: "Harvest supper",
    kind: "event",
    day: 22,
    health: "watch",
    status: "Slipping",
    progress: 52,
    open: 11,
    overdue: 2,
    owner: "dev",
    team: ["dev", "tomas"],
    color: "var(--v3-project-6)",
    signal: "Menu not signed off and two tasks overdue",
    milestones: [
      { day: -30, label: "Chef booked", done: true },
      { day: -9, label: "Tickets on sale", done: true },
      { day: 3, label: "Menu sign-off" },
      { day: 15, label: "Numbers close" },
      { day: 22, label: "Supper club" },
    ],
    tasks: [
      { title: "Sign off the five-course menu", who: "dev", due: -2 },
      { title: "Chase the cider pairing order", who: "dev", due: -1 },
      { title: "Long tables out of storage", who: "tomas", due: 6 },
    ],
    links: [
      { kind: "doc", title: "Menu draft v3", meta: "Doc · 3 comments" },
      { kind: "sheet", title: "Ticket sales", meta: "Sheet · 46 of 60 sold" },
      { kind: "image", title: "Supper club poster", meta: "Image · 1080 × 1350" },
    ],
    activity: [
      { who: "dev", text: "flagged the menu as late", ago: "This morning" },
      { who: "tomas", text: "counted the long tables", ago: "Yesterday" },
    ],
  },
  {
    id: "newsletter",
    name: "Autumn newsletter",
    short: "Newsletter",
    kind: "marketing",
    day: 34,
    health: "good",
    status: "On track",
    progress: 70,
    open: 3,
    overdue: 0,
    owner: "aoife",
    team: ["aoife"],
    color: "var(--v3-project-2)",
    signal: "Draft written, photos chosen",
    milestones: [
      { day: -10, label: "Outline", done: true },
      { day: 20, label: "Draft to Orla" },
      { day: 34, label: "Send" },
    ],
    tasks: [
      { title: "Pick six photos from the summer weddings", who: "aoife", due: 5 },
      { title: "Write the lantern trail blurb", who: "aoife", due: 6 },
    ],
    links: [
      { kind: "doc", title: "Autumn newsletter draft", meta: "Doc · 740 words" },
      { kind: "image", title: "Summer wedding selects", meta: "38 images" },
    ],
    activity: [{ who: "aoife", text: "shared the outline", ago: "Monday" }],
  },
  {
    id: "science",
    name: "Year 5 science fair",
    short: "Science fair",
    kind: "other",
    day: 35,
    health: "good",
    status: "On track",
    progress: 64,
    open: 6,
    overdue: 0,
    owner: "orla",
    team: ["orla", "dev"],
    color: "var(--v3-project-3)",
    signal: "School confirmed 28 stands",
    milestones: [
      { day: -21, label: "Booking confirmed", done: true },
      { day: 14, label: "Stand plan from school" },
      { day: 28, label: "Power and tables check" },
      { day: 35, label: "Science fair" },
    ],
    tasks: [
      { title: "Send the hall floor plan to Ms Brennan", who: "orla", due: 2 },
      { title: "Quote for extra power points", who: "dev", due: 6 },
    ],
    links: [
      { kind: "design", title: "Hall floor plan", meta: "Design · 28 stands" },
      { kind: "doc", title: "School booking form", meta: "Doc · signed" },
    ],
    activity: [{ who: "orla", text: "confirmed 28 stands with the school", ago: "Wednesday" }],
  },
  {
    id: "barn",
    name: "Barn roof and heating works",
    short: "Barn works",
    kind: "works",
    day: 35,
    health: "help",
    status: "Off track",
    progress: 30,
    open: 14,
    overdue: 3,
    owner: "tomas",
    team: ["tomas", "dev", "orla"],
    color: "var(--v3-project-5)",
    signal: "Roofer slipped nine days; heating waits on the roof",
    milestones: [
      { day: -35, label: "Contractor signed", done: true },
      { day: -8, label: "Scaffold up", done: true },
      { day: 9, label: "Roof sealed (was 30 Sep)" },
      { day: 24, label: "Heating installed" },
      { day: 35, label: "Barn handed back" },
    ],
    tasks: [
      { title: "Agree a new roofing date with Hegarty", who: "tomas", due: -3 },
      { title: "Hold the heating installer for 20 Oct", who: "tomas", due: -1 },
      { title: "Tell Kavanagh family about the barn plan B", who: "orla", due: -1 },
      { title: "Price a marquee as fallback", who: "dev", due: 3 },
    ],
    links: [
      { kind: "doc", title: "Works schedule", meta: "Doc · edited today" },
      { kind: "sheet", title: "Works budget", meta: "Sheet · €38,400" },
      { kind: "image", title: "Roof survey photos", meta: "16 images" },
      { kind: "link", title: "Hegarty Roofing", meta: "hegartyroofing.ie" },
    ],
    activity: [
      { who: "tomas", text: "moved roof sealing to 4 Oct", ago: "1 hour ago" },
      { who: "dev", text: "asked for a marquee quote", ago: "This morning" },
      { who: "orla", text: "linked Kavanagh 40th", ago: "Yesterday" },
    ],
  },
  {
    id: "halloween",
    name: "Halloween lantern trail",
    short: "Lantern trail",
    kind: "event",
    day: 36,
    health: "good",
    status: "On track",
    progress: 45,
    open: 9,
    overdue: 0,
    owner: "tomas",
    team: ["tomas", "aoife"],
    color: "var(--v3-project-7)",
    signal: "Tickets ahead of last year",
    milestones: [
      { day: -14, label: "Route walked", done: true },
      { day: 10, label: "Tickets on sale" },
      { day: 30, label: "Lanterns installed" },
      { day: 36, label: "Trail night" },
    ],
    tasks: [
      { title: "Order 400 lantern candles", who: "tomas", due: 4 },
      { title: "Ticket page copy", who: "aoife", due: 6 },
    ],
    links: [
      { kind: "design", title: "Trail route map", meta: "Design · 1.2 km" },
      { kind: "sheet", title: "Lantern stock", meta: "Sheet · 312 in store" },
    ],
    activity: [{ who: "tomas", text: "walked the orchard route", ago: "2 weeks ago" }],
  },
  {
    id: "keane",
    name: "Keane Legal retreat",
    short: "Keane retreat",
    kind: "event",
    day: 42,
    health: "watch",
    status: "Slipping",
    progress: 41,
    open: 10,
    overdue: 1,
    owner: "dev",
    team: ["dev", "orla"],
    color: "var(--v3-project-4)",
    signal: "Rooms not confirmed; same caterer as Harvest supper",
    milestones: [
      { day: -24, label: "Contract signed", done: true },
      { day: 7, label: "Rooming list" },
      { day: 28, label: "Agenda final" },
      { day: 42, label: "Retreat day" },
    ],
    tasks: [
      { title: "Chase the rooming list from Keane", who: "dev", due: -1 },
      { title: "Hold 18 rooms at the Mill House", who: "orla", due: 5 },
    ],
    links: [
      { kind: "doc", title: "Retreat agenda", meta: "Doc · draft" },
      { kind: "slides", title: "Keane welcome deck", meta: "Slides · 12" },
      { kind: "sheet", title: "Rooming list", meta: "Sheet · 18 of 34" },
    ],
    activity: [{ who: "dev", text: "sent the agenda draft to Keane", ago: "Tuesday" }],
  },
  {
    id: "kavanagh",
    name: "Kavanagh 40th",
    short: "Kavanagh 40th",
    kind: "event",
    day: 50,
    health: "help",
    status: "At risk",
    progress: 25,
    open: 12,
    overdue: 0,
    owner: "aoife",
    team: ["aoife", "tomas"],
    color: "var(--v3-project-8)",
    signal: "Needs the heated barn, and the barn works are late",
    milestones: [
      { day: -20, label: "Deposit paid", done: true },
      { day: 21, label: "Band confirmed" },
      { day: 38, label: "Barn ready check" },
      { day: 50, label: "Party night" },
    ],
    tasks: [
      { title: "Share plan B with the Kavanaghs", who: "aoife", due: 3 },
      { title: "Confirm the band can play in a marquee", who: "aoife", due: 6 },
    ],
    links: [
      { kind: "doc", title: "Party brief", meta: "Doc · from Siobhán" },
      { kind: "image", title: "Barn mood board", meta: "22 images" },
    ],
    activity: [{ who: "aoife", text: "asked Tomás for a barn-ready date", ago: "Yesterday" }],
  },
  {
    id: "markets",
    name: "Christmas markets",
    short: "Christmas markets",
    kind: "event",
    day: 64,
    endDay: 87,
    health: "watch",
    status: "Slipping",
    progress: 22,
    open: 23,
    overdue: 1,
    owner: "aoife",
    team: ["aoife", "tomas", "orla"],
    color: "var(--v3-project-6)",
    signal: "18 of 30 stallholders confirmed",
    milestones: [
      { day: -12, label: "Stall applications open", done: true },
      { day: 20, label: "Applications close" },
      { day: 45, label: "Stall map final" },
      { day: 64, label: "Opening weekend" },
      { day: 87, label: "Last day" },
    ],
    tasks: [
      { title: "Follow up with 12 undecided stallholders", who: "aoife", due: -1 },
      { title: "Book the Santa's grotto actor", who: "orla", due: 5 },
      { title: "Check barn power for 30 stalls", who: "tomas", due: 6 },
    ],
    links: [
      { kind: "sheet", title: "Stallholders", meta: "Sheet · 18 of 30" },
      { kind: "design", title: "Stall map", meta: "Design · draft" },
      { kind: "image", title: "Market poster", meta: "Image · A2" },
    ],
    activity: [{ who: "aoife", text: "confirmed three new stallholders", ago: "This morning" }],
  },
  {
    id: "ada-theo",
    name: "Ada & Theo's wedding",
    short: "Ada & Theo",
    kind: "wedding",
    day: 78,
    health: "good",
    status: "On track",
    progress: 18,
    open: 16,
    overdue: 0,
    owner: "orla",
    team: ["orla", "dev"],
    color: "var(--v3-project-3)",
    signal: "Early days, everything on plan",
    milestones: [
      { day: -60, label: "Booking", done: true },
      { day: 18, label: "Menu tasting" },
      { day: 55, label: "Final numbers" },
      { day: 78, label: "Wedding day" },
    ],
    tasks: [{ title: "Send tasting date options", who: "orla", due: 4 }],
    links: [
      { kind: "doc", title: "Ada & Theo planning notes", meta: "Doc · 6 pages" },
      { kind: "sheet", title: "Winter guest list", meta: "Sheet · 84 guests" },
    ],
    activity: [{ who: "orla", text: "shared tasting dates", ago: "Monday" }],
  },
  {
    id: "spring",
    name: "Spring 2027 open day",
    short: "Open day",
    kind: "marketing",
    day: 135,
    health: "good",
    status: "On track",
    progress: 5,
    open: 7,
    overdue: 0,
    owner: "aoife",
    team: ["aoife", "orla"],
    color: "var(--v3-project-7)",
    signal: "Planning starts in November",
    milestones: [
      { day: 49, label: "Suppliers invited" },
      { day: 100, label: "Invites out" },
      { day: 135, label: "Open day" },
    ],
    tasks: [{ title: "List suppliers to invite", who: "aoife", due: 6 }],
    links: [{ kind: "doc", title: "Open day plan", meta: "Doc · outline" }],
    activity: [{ who: "aoife", text: "created the project", ago: "3 weeks ago" }],
  },
  {
    id: "winter-launch",
    name: "Winter season launch",
    short: "Winter launch",
    kind: "marketing",
    health: "watch",
    status: "No date",
    progress: 10,
    open: 12,
    overdue: 0,
    owner: "aoife",
    team: ["aoife", "orla"],
    color: "var(--v3-project-2)",
    signal: "Waiting on a date",
    milestones: [],
    tasks: [{ title: "Pick a launch date", who: "aoife", due: 5 }],
    links: [{ kind: "slides", title: "Winter season ideas", meta: "Slides · 9" }],
    activity: [{ who: "aoife", text: "added nine ideas", ago: "Last week" }],
  },
  {
    id: "northside",
    name: "Northside rebrand",
    short: "Rebrand",
    kind: "marketing",
    health: "good",
    status: "No date",
    progress: 20,
    open: 4,
    overdue: 0,
    owner: "dev",
    team: ["dev", "aoife"],
    color: "var(--v3-project-8)",
    signal: "Brief written, no deadline",
    milestones: [],
    tasks: [{ title: "Shortlist three studios", who: "dev", due: 6 }],
    links: [{ kind: "doc", title: "Rebrand brief", meta: "Doc · 2 pages" }],
    activity: [{ who: "dev", text: "wrote the brief", ago: "2 weeks ago" }],
  },
];

export const RELATIONS: Relation[] = [
  { a: "barn", b: "kavanagh", reason: "Kavanagh 40th needs the heated barn" },
  { a: "barn", b: "markets", reason: "The markets run in the barn" },
  { a: "harvest", b: "keane", reason: "Same caterer: Fennel & Salt" },
  { a: "newsletter", b: "halloween", reason: "The newsletter launches the trail" },
];

/* ── Load and crunch ─────────────────────────────────────────────────── */

export const MAP_START = -21;
export const MAP_END = 182;

/** Projects with a date, in time order. */
export function dated(projects: Project[]) {
  return projects.filter((p) => p.day !== undefined).sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.name.localeCompare(b.name));
}

/**
 * How heavily a project weighs on its team in the week starting `ws`.
 * 1 = final fortnight (or running), 0.35 = run-up in the six weeks before.
 */
export function weight(p: Project, ws: number) {
  if (p.day === undefined || p.unwrapped) return 0;
  const we = ws + 6;
  if (p.endDay !== undefined) {
    if (we >= p.day - 7 && ws <= p.endDay) return 1;
    if (we >= p.day - 42 && ws < p.day - 7) return 0.35;
    return 0;
  }
  if (p.day >= ws && p.day <= ws + 13) return 1;
  if (p.day > ws + 13 && p.day <= ws + 13 + 35) return 0.35;
  return 0;
}

export type Crunch = {
  /** First day of the fortnight (a Monday). */
  start: number;
  /** Day after the fortnight ends. */
  end: number;
  people: PersonId[];
  count: number;
  projects: string[];
};

export function weeks() {
  const out: number[] = [];
  for (let ws = weekStart(MAP_START); ws <= MAP_END; ws += 7) out.push(ws);
  return out;
}

/**
 * Fortnights where one person finishes three or more projects. Overlapping
 * fortnights merge into one stretch, so the map never shows two bands for
 * the same pile-up.
 */
export function crunches(projects: Project[]): Crunch[] {
  const out: Crunch[] = [];
  for (const ws of weeks()) {
    if (ws + 13 < 0) continue;
    const active = projects.filter((p) => weight(p, ws) === 1);
    const counts = new Map<PersonId, string[]>();
    for (const p of active) for (const who of p.team) counts.set(who, [...(counts.get(who) ?? []), p.id]);
    let max = 0;
    for (const list of counts.values()) max = Math.max(max, list.length);
    if (max < 3) continue;
    const people = PEOPLE_ORDER.filter((id) => (counts.get(id)?.length ?? 0) === max);
    const ids = new Set<string>();
    for (const id of people) for (const pid of counts.get(id) ?? []) ids.add(pid);
    const next: Crunch = { start: ws, end: ws + 14, people, count: max, projects: [...ids] };
    const prev = out[out.length - 1];
    if (prev && prev.end > next.start) {
      prev.end = next.end;
      prev.count = Math.max(prev.count, next.count);
      prev.people = PEOPLE_ORDER.filter((id) => prev.people.includes(id) || next.people.includes(id));
      prev.projects = [...new Set([...prev.projects, ...next.projects])];
    } else out.push(next);
  }
  return out;
}

/** Two crunch stretches that share any day are the same pile-up. */
export const sameCrunch = (a: Crunch, b: Crunch) => a.start < b.end && b.start < a.end;

export function joinNames(names: string[]) {
  return names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Orla and Dev each finish 3 projects" / "Orla finishes 3 projects". */
export function crunchLabel(c: Crunch) {
  const names = c.people.map((id) => PEOPLE[id].first);
  return names.length === 1 ? `${names[0]} finishes ${c.count} projects` : `${joinNames(names)} each finish ${c.count} projects`;
}

/** "26 Oct to 8 Nov" */
export function crunchRange(c: Crunch) {
  return `${fmtDayMonth(c.start)} to ${fmtDayMonth(c.end - 1)}`;
}

/** The one sentence every surface uses: "Crunch 26 Oct to 8 Nov: Orla and Dev each finish 3 projects." */
export function crunchSentence(c: Crunch) {
  return `Crunch ${crunchRange(c)}: ${crunchLabel(c)}.`;
}

/** Person load as a share of a comfortable week (1.0 = full). */
export function load(projects: Project[], who: PersonId, ws: number) {
  let sum = 0;
  const on: string[] = [];
  for (const p of projects) {
    if (!p.team.includes(who)) continue;
    const w = weight(p, ws);
    if (w > 0) {
      sum += w;
      if (w === 1) on.push(p.name);
    }
  }
  return { share: sum / 2.2, on };
}

/** Projects that land in the next 90 days (past, unwrapped ones excluded). */
export function soon(projects: Project[]) {
  return projects.filter((p) => p.day !== undefined && !p.unwrapped && p.day >= 0 && p.day <= 90);
}

/** The one way every view words the count: "10 projects in the next 90 days · 14 in total". */
export function countLine(projects: Project[]) {
  const n = soon(projects).length;
  return `${n} ${n === 1 ? "project" : "projects"} in the next 90 days · ${projects.length} in total`;
}

export function nextMilestone(p: Project) {
  return p.milestones.find((m) => !m.done && m.day >= -1 && m.day !== p.day);
}

export function fullLabel(p: Project) {
  const bits = [p.name];
  if (p.day === undefined) bits.push("no date yet");
  else if (p.endDay !== undefined) bits.push(`${fmtPlain(p.day)} to ${fmtPlain(p.endDay)}`, p.day >= 0 ? `starts ${fmtIn(p.day)}` : "running now");
  else bits.push(fmtPlain(p.day), p.day < 0 ? `${-p.day} days past, not wrapped` : fmtIn(p.day));
  bits.push(statusWord(p).toLowerCase(), `${p.progress}% done`);
  if (p.overdue) bits.push(`${p.overdue} overdue`);
  return bits.join(", ");
}
