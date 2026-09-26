/*
 * Project ledger: sample data for the Orchard world.
 * Concept only. Every value here is invented; nothing reads from the server.
 * "Today" is pinned so relative dates, amber windows and sparklines stay stable.
 */

export const TODAY = "2026-09-25";

export type StatusId = "on_track" | "at_risk" | "off_track" | "wrapped";
export type KindId = "wedding" | "event" | "works" | "marketing" | "operations" | "client" | "school";
export type PersonId = "orla" | "tomas" | "aoife" | "dev" | "niamh" | "ciaran" | "sive" | "byrne";

export type Person = { id: PersonId; name: string; short: string; initials: string; role: string; tone: number };

export const PEOPLE: Record<PersonId, Person> = {
  orla: { id: "orla", name: "Orla Brennan", short: "Orla", initials: "OB", role: "General manager", tone: 1 },
  tomas: { id: "tomas", name: "Tomás Ryan", short: "Tomás", initials: "TR", role: "Operations", tone: 3 },
  aoife: { id: "aoife", name: "Aoife Kelly", short: "Aoife", initials: "AK", role: "Events coordinator", tone: 8 },
  dev: { id: "dev", name: "Dev Sharma", short: "Dev", initials: "DS", role: "Marketing and design", tone: 2 },
  niamh: { id: "niamh", name: "Niamh Walsh", short: "Niamh", initials: "NW", role: "Head chef", tone: 5 },
  ciaran: { id: "ciaran", name: "Ciarán Doyle", short: "Ciarán", initials: "CD", role: "Maintenance", tone: 4 },
  sive: { id: "sive", name: "Sive O'Neill", short: "Sive", initials: "SO", role: "Northside Studio", tone: 6 },
  byrne: { id: "byrne", name: "Ms Byrne", short: "Ms Byrne", initials: "MB", role: "Year 5 teacher", tone: 7 },
};

export const OWNERS: PersonId[] = ["orla", "tomas", "aoife", "dev"];
export const ME: PersonId = "orla";

export const STATUSES: { id: StatusId; label: string; key: string }[] = [
  { id: "on_track", label: "On track", key: "1" },
  { id: "at_risk", label: "At risk", key: "2" },
  { id: "off_track", label: "Off track", key: "3" },
  { id: "wrapped", label: "Wrapped", key: "4" },
];

export const STATUS_LABEL: Record<StatusId, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  wrapped: "Wrapped",
};

export const KINDS: { id: KindId; label: string }[] = [
  { id: "wedding", label: "Wedding" },
  { id: "event", label: "Event" },
  { id: "works", label: "Venue works" },
  { id: "marketing", label: "Marketing" },
  { id: "operations", label: "Operations" },
  { id: "client", label: "Client" },
  { id: "school", label: "School" },
];

export const KIND_LABEL: Record<KindId, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.label])) as Record<
  KindId,
  string
>;

export type StatusChange = { status: StatusId; date: string; by: PersonId; reason: string };
export type Milestone = { id: string; name: string; date: string; done: boolean };
export type Task = { id: string; title: string; who: PersonId; due: string };
export type LinkRef = { label: string; kind: "doc" | "sheet" | "image" | "link" | "design" | "slides" };
export type Activity = { id: string; who: PersonId; text: string; minsAgo: number; kind?: "status" | "note" | "task" };

export type Project = {
  id: string;
  name: string;
  purpose: string;
  kind: KindId;
  tone: number;
  status: StatusId;
  statusReason: string;
  history: StatusChange[];
  owner: PersonId;
  people: PersonId[];
  start: string;
  date: string;
  done: number;
  total: number;
  overdue: number;
  sparkDone: number[];
  sparkAdded: number[];
  milestones: Milestone[];
  tasks: Task[];
  links: LinkRef[];
  activity: Activity[];
  updatedMins: number;
  updatedBy: PersonId;
  archived?: boolean;
  isNew?: boolean;
};

/* ── Date helpers (UTC, day precision) ─────────────────────────────── */

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toTime(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toIso(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  return toIso(toTime(iso) + n * DAY);
}

export function daysFromToday(iso: string): number {
  return Math.round((toTime(iso) - toTime(TODAY)) / DAY);
}

export function fmtDate(iso: string, withYear = false): string {
  const d = new Date(toTime(iso));
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withYear || d.getUTCFullYear() !== 2026 ? `${base} ${d.getUTCFullYear()}` : base;
}

export function fmtWeekday(iso: string): string {
  return WEEKDAYS[new Date(toTime(iso)).getUTCDay()];
}

/** "Tue" inside a week, "Fri 9 Oct" inside a month, "14 Nov" beyond. */
export function fmtShort(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1 && n < 7) return fmtWeekday(iso);
  return fmtDate(iso);
}

export function fmtRelative(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  if (n < 60) return `In ${n} days`;
  return `In ${Math.round(n / 30)} months`;
}

export function monthKey(iso: string): string {
  const d = new Date(toTime(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtAgo(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.round(d / 7)}w ago`;
}

/** Plain-language dates for the create row and the date editor: "fri", "12 dec", "in 3 weeks", "+5". */
export function parseDate(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === "today") return TODAY;
  if (s === "tomorrow" || s === "tmrw") return addDays(TODAY, 1);
  const rel = s.match(/^(?:in\s+)?\+?(\d+)\s*(d|day|days|w|wk|week|weeks|m|month|months)?$/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2] ?? "d";
    if (!rel[2] && !s.startsWith("+") && !s.startsWith("in")) {
      // A bare number reads as a day of the month.
      const day = n;
      if (day >= 1 && day <= 31) {
        let t = toTime(TODAY);
        for (let i = 0; i < 62; i++) {
          const d = new Date(t);
          if (d.getUTCDate() === day && t >= toTime(TODAY)) return toIso(t);
          t += DAY;
        }
      }
      return null;
    }
    const mult = unit.startsWith("w") ? 7 : unit.startsWith("m") ? 30 : 1;
    return addDays(TODAY, n * mult);
  }
  const wd = WEEKDAYS.findIndex((w) => s === w.toLowerCase() || s.startsWith(w.toLowerCase()) && s.length <= 9);
  if (wd >= 0) {
    const cur = new Date(toTime(TODAY)).getUTCDay();
    let diff = (wd - cur + 7) % 7;
    if (diff === 0) diff = 7;
    if (s.startsWith("next ")) diff += 7;
    return addDays(TODAY, diff);
  }
  const dm = s.match(/^(\d{1,2})\s*([a-z]{3,})\.?\s*(\d{4})?$/) ?? null;
  const md = s.match(/^([a-z]{3,})\.?\s*(\d{1,2})\s*(\d{4})?$/) ?? null;
  const parts = dm ? { d: Number(dm[1]), m: dm[2], y: dm[3] } : md ? { d: Number(md[2]), m: md[1], y: md[3] } : null;
  if (parts) {
    const mi = MONTHS.findIndex((m) => parts.m.startsWith(m.toLowerCase()));
    if (mi < 0 || parts.d < 1 || parts.d > 31) return null;
    let y = parts.y ? Number(parts.y) : 2026;
    let iso = toIso(Date.UTC(y, mi, parts.d));
    if (!parts.y && daysFromToday(iso) < -30) {
      y += 1;
      iso = toIso(Date.UTC(y, mi, parts.d));
    }
    return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/* ── Deterministic sparklines ──────────────────────────────────────── */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function spark(seed: number, doneRate: number, addRate: number): { done: number[]; added: number[] } {
  const r = seeded(seed);
  const done: number[] = [];
  const added: number[] = [];
  for (let i = 0; i < 14; i++) {
    const weekend = i % 7 === 1 || i % 7 === 2;
    done.push(Math.max(0, Math.round((weekend ? 0.3 : 1) * doneRate * (0.4 + r() * 1.2))));
    added.push(Math.max(0, Math.round((weekend ? 0.2 : 1) * addRate * (0.3 + r() * 1.3))));
  }
  return { done, added };
}

/* ── Templates for the quieter projects ────────────────────────────── */

const LINKS: Record<KindId, LinkRef[]> = {
  wedding: [
    { label: "Run sheet", kind: "doc" },
    { label: "Guest list and dietary needs", kind: "sheet" },
    { label: "Floor plan, barn", kind: "design" },
    { label: "Supplier contacts", kind: "sheet" },
  ],
  event: [
    { label: "Run sheet", kind: "doc" },
    { label: "Budget", kind: "sheet" },
    { label: "Menu draft", kind: "doc" },
  ],
  works: [
    { label: "Contractor quotes", kind: "sheet" },
    { label: "Site photos", kind: "image" },
    { label: "Insurance letter", kind: "doc" },
  ],
  marketing: [
    { label: "Shot list", kind: "doc" },
    { label: "Campaign plan", kind: "slides" },
    { label: "Brand assets", kind: "design" },
  ],
  operations: [
    { label: "Rota, October", kind: "sheet" },
    { label: "Training handbook", kind: "doc" },
  ],
  client: [
    { label: "Brief", kind: "doc" },
    { label: "Moodboard", kind: "design" },
    { label: "Proposal", kind: "slides" },
  ],
  school: [
    { label: "Floor plan, barn", kind: "design" },
    { label: "Risk assessment", kind: "doc" },
    { label: "Parent letter", kind: "doc" },
  ],
};

type Seed = Omit<Project, "sparkDone" | "sparkAdded" | "links" | "activity" | "tasks"> & {
  spark: [number, number, number];
  links?: LinkRef[];
  activity?: Activity[];
  tasks?: Task[];
  taskTitles?: [string, PersonId, number][];
};

let uid = 0;
const id = (p: string) => `${p}-${++uid}`;

function ms(name: string, date: string, done = false): Milestone {
  return { id: id("m"), name, date, done };
}

function build(seed: Seed): Project {
  const { spark: sp, taskTitles, ...rest } = seed;
  const { done, added } = spark(sp[0], sp[1], sp[2]);
  const tasks =
    seed.tasks ??
    (taskTitles ?? []).map(([title, who, inDays]) => ({ id: id("t"), title, who, due: addDays(TODAY, inDays) }));
  return {
    ...rest,
    sparkDone: done,
    sparkAdded: added,
    tasks,
    links: seed.links ?? LINKS[seed.kind],
    activity:
      seed.activity ??
      [
        { id: id("a"), who: seed.updatedBy, text: `Completed “${tasks[0]?.title ?? "Kick-off call"}”`, minsAgo: seed.updatedMins, kind: "task" as const },
        { id: id("a"), who: seed.owner, text: seed.statusReason, minsAgo: seed.updatedMins + 60 * 26, kind: "status" as const },
        { id: id("a"), who: seed.people[1] ?? seed.owner, text: "Added 3 tasks from the planning call", minsAgo: seed.updatedMins + 60 * 72, kind: "task" as const },
      ],
  };
}

export const SEED_PROJECTS: Project[] = [
  build({
    id: "mara-finn",
    name: "Mara & Finn's wedding",
    purpose: "Run Mara & Finn's day from one place, with every supplier, date and decision accounted for.",
    kind: "wedding",
    tone: 7,
    status: "on_track",
    statusReason: "Final numbers in: 112 guests. Seating plan is the last big piece.",
    history: [
      { status: "on_track", date: "2026-06-02", by: "aoife", reason: "Deposit paid, date locked." },
      { status: "at_risk", date: "2026-08-18", by: "aoife", reason: "Florist cancelled; looking for a replacement." },
      { status: "on_track", date: "2026-08-29", by: "aoife", reason: "Bloom & Wild Co. confirmed for the day." },
    ],
    owner: "aoife",
    people: ["aoife", "orla", "niamh", "tomas"],
    start: "2026-05-20",
    date: "2026-10-03",
    done: 5,
    total: 13,
    overdue: 1,
    spark: [11, 1.4, 1.1],
    milestones: [
      ms("Menu tasting", "2026-09-12", true),
      ms("Final numbers", "2026-09-22", true),
      ms("Seating plan", "2026-09-29"),
      ms("Supplier run-through", "2026-10-01"),
      ms("Wedding day", "2026-10-03"),
    ],
    tasks: [
      { id: id("t"), title: "Chase last three RSVPs", who: "aoife", due: "2026-09-24" },
      { id: id("t"), title: "Draft seating plan with Mara", who: "aoife", due: "2026-09-29" },
      { id: id("t"), title: "Confirm dietary list with kitchen", who: "niamh", due: "2026-09-30" },
      { id: id("t"), title: "Heaters and festoon lights for the courtyard", who: "tomas", due: "2026-10-01" },
      { id: id("t"), title: "Print table names", who: "orla", due: "2026-10-02" },
    ],
    activity: [
      { id: id("a"), who: "dev", text: "Uploaded the printed menu proofs", minsAgo: 120, kind: "note" },
      { id: id("a"), who: "aoife", text: "Final numbers in: 112 guests. Seating plan is the last big piece.", minsAgo: 60 * 27, kind: "status" },
      { id: id("a"), who: "niamh", text: "Completed “Tasting feedback into the menu”", minsAgo: 60 * 50, kind: "task" },
      { id: id("a"), who: "tomas", text: "Booked the courtyard heaters", minsAgo: 60 * 75, kind: "task" },
    ],
    updatedMins: 120,
    updatedBy: "dev",
  }),
  build({
    id: "harvest",
    name: "Harvest supper club",
    purpose: "A long-table supper in the orchard for 60, cooked from what's in season that week.",
    kind: "event",
    tone: 5,
    status: "on_track",
    statusReason: "Tickets 48 of 60 sold. Menu tasting next Thursday.",
    history: [
      { status: "on_track", date: "2026-08-10", by: "orla", reason: "Tickets on sale." },
    ],
    owner: "orla",
    people: ["orla", "niamh", "dev"],
    start: "2026-08-01",
    date: "2026-10-17",
    done: 9,
    total: 16,
    overdue: 0,
    spark: [23, 1.5, 0.9],
    milestones: [
      ms("Tickets on sale", "2026-08-12", true),
      ms("Menu tasting", "2026-10-01"),
      ms("Wine pairing signed off", "2026-10-08"),
      ms("Supper club", "2026-10-17"),
    ],
    taskTitles: [
      ["Book tasting with Niamh and the growers", "niamh", 6],
      ["Post the menu teaser", "dev", 3],
      ["Hire long tables and linen", "orla", 9],
      ["Candle and lantern count", "orla", 12],
      ["Seating chart for 60", "orla", 18],
    ],
    updatedMins: 35,
    updatedBy: "niamh",
  }),
  build({
    id: "barn-roof",
    name: "Barn roof and heating works",
    purpose: "Re-roof the main barn and put in underfloor heating before the winter bookings start.",
    kind: "works",
    tone: 6,
    status: "at_risk",
    statusReason: "Roofer pushed the start by a week; heating quote still open.",
    history: [
      { status: "on_track", date: "2026-07-01", by: "tomas", reason: "Contractor chosen, start agreed for 14 Sep." },
      { status: "at_risk", date: "2026-09-21", by: "tomas", reason: "Roofer pushed the start by a week; heating quote still open." },
    ],
    owner: "tomas",
    people: ["tomas", "ciaran", "orla"],
    start: "2026-07-01",
    date: "2026-10-30",
    done: 7,
    total: 18,
    overdue: 3,
    spark: [37, 0.8, 1.6],
    milestones: [
      ms("Contractor signed", "2026-07-20", true),
      ms("Scaffold up", "2026-10-05"),
      ms("Roof watertight", "2026-10-19"),
      ms("Heating commissioned", "2026-10-28"),
      ms("Barn back in use", "2026-10-30"),
    ],
    tasks: [
      { id: id("t"), title: "Second quote for the heat pump", who: "tomas", due: "2026-09-21" },
      { id: id("t"), title: "Move stored furniture out of the loft", who: "ciaran", due: "2026-09-23" },
      { id: id("t"), title: "Tell October couples about the scaffold", who: "orla", due: "2026-09-24" },
      { id: id("t"), title: "Confirm skip delivery", who: "tomas", due: "2026-10-02" },
      { id: id("t"), title: "Building control notice", who: "tomas", due: "2026-10-04" },
    ],
    activity: [
      { id: id("a"), who: "tomas", text: "Roofer pushed the start by a week; heating quote still open.", minsAgo: 60 * 5, kind: "status" },
      { id: id("a"), who: "ciaran", text: "Added site photos of the north slope", minsAgo: 60 * 30, kind: "note" },
      { id: id("a"), who: "tomas", text: "Completed “Asbestos survey”", minsAgo: 60 * 96, kind: "task" },
    ],
    updatedMins: 60 * 5,
    updatedBy: "tomas",
  }),
  build({
    id: "kavanagh",
    name: "Kavanagh 40th",
    purpose: "A surprise 40th in the barn: 80 guests, a ceilidh band and a late pizza oven.",
    kind: "event",
    tone: 2,
    status: "on_track",
    statusReason: "Band booked. Waiting on the guest list from Sinéad.",
    history: [{ status: "on_track", date: "2026-09-02", by: "aoife", reason: "Deposit in." }],
    owner: "aoife",
    people: ["aoife", "niamh"],
    start: "2026-09-01",
    date: "2026-11-14",
    done: 4,
    total: 11,
    overdue: 0,
    spark: [41, 0.7, 0.6],
    milestones: [
      ms("Band booked", "2026-09-18", true),
      ms("Guest list in", "2026-10-09"),
      ms("Final menu", "2026-10-30"),
      ms("Party", "2026-11-14"),
    ],
    taskTitles: [
      ["Guest list from Sinéad", "aoife", 14],
      ["Pizza oven hire", "niamh", 21],
      ["Keep it secret: set up a separate thread", "aoife", 4],
      ["Decor brief", "aoife", 25],
      ["Taxi list for the end of night", "aoife", 40],
    ],
    updatedMins: 60 * 20,
    updatedBy: "aoife",
  }),
  build({
    id: "xmas-markets",
    name: "Christmas markets",
    purpose: "Two weekends of stalls, mulled cider and a carol night in the courtyard.",
    kind: "event",
    tone: 4,
    status: "on_track",
    statusReason: "31 stallholders confirmed; list closes 9 Oct.",
    history: [{ status: "on_track", date: "2026-08-25", by: "orla", reason: "Applications open." }],
    owner: "orla",
    people: ["orla", "dev", "tomas", "niamh"],
    start: "2026-08-20",
    date: "2026-11-28",
    done: 6,
    total: 24,
    overdue: 1,
    spark: [53, 1.1, 1.3],
    milestones: [
      ms("Applications open", "2026-08-25", true),
      ms("Stallholder list closes", "2026-10-09"),
      ms("Poster out", "2026-10-23"),
      ms("Market opens", "2026-11-28"),
    ],
    taskTitles: [
      ["Chase stallholder insurance", "orla", -2],
      ["Poster and social launch", "dev", 20],
      ["Power plan for the courtyard", "tomas", 26],
      ["Mulled cider recipe and costing", "niamh", 30],
      ["Carol night choir", "orla", 34],
    ],
    updatedMins: 60 * 3,
    updatedBy: "orla",
  }),
  build({
    id: "ada-theo",
    name: "Ada & Theo micro-wedding",
    purpose: "Twelve guests, the snug and the orchard at golden hour.",
    kind: "wedding",
    tone: 8,
    status: "on_track",
    statusReason: "Early days. Venue walk-round booked for October.",
    history: [{ status: "on_track", date: "2026-09-10", by: "aoife", reason: "Booked." }],
    owner: "aoife",
    people: ["aoife", "niamh"],
    start: "2026-09-10",
    date: "2026-12-12",
    done: 2,
    total: 9,
    overdue: 0,
    spark: [67, 0.4, 0.5],
    milestones: [
      ms("Booking confirmed", "2026-09-10", true),
      ms("Walk-round", "2026-10-14"),
      ms("Menu chosen", "2026-11-11"),
      ms("Wedding day", "2026-12-12"),
    ],
    taskTitles: [
      ["Walk-round with Ada and Theo", "aoife", 19],
      ["Photographer shortlist", "aoife", 26],
      ["Tasting menu for 12", "niamh", 40],
      ["Snug decor", "aoife", 60],
      ["Winter golden-hour timing", "aoife", 62],
    ],
    updatedMins: 60 * 50,
    updatedBy: "aoife",
  }),
  build({
    id: "winter-launch",
    name: "Winter season launch",
    purpose: "Launch the winter menu, fire-pit evenings and gift vouchers in one push.",
    kind: "marketing",
    tone: 1,
    status: "off_track",
    statusReason: "Photography slipped two weeks; menus not signed off.",
    history: [
      { status: "on_track", date: "2026-08-04", by: "dev", reason: "Plan agreed." },
      { status: "at_risk", date: "2026-09-08", by: "dev", reason: "Menu sign-off late." },
      { status: "off_track", date: "2026-09-22", by: "dev", reason: "Photography slipped two weeks; menus not signed off." },
    ],
    owner: "dev",
    people: ["dev", "orla", "niamh"],
    start: "2026-08-04",
    date: "2026-10-06",
    done: 8,
    total: 21,
    overdue: 5,
    spark: [71, 0.6, 1.7],
    milestones: [
      ms("Plan agreed", "2026-08-04", true),
      ms("Menus signed off", "2026-09-18"),
      ms("Photo shoot", "2026-09-30"),
      ms("Launch", "2026-10-06"),
    ],
    tasks: [
      { id: id("t"), title: "Sign off winter menu", who: "niamh", due: "2026-09-18" },
      { id: id("t"), title: "Voucher pricing", who: "orla", due: "2026-09-19" },
      { id: id("t"), title: "Rebook the photographer", who: "dev", due: "2026-09-22" },
      { id: id("t"), title: "Email to past guests", who: "dev", due: "2026-09-23" },
      { id: id("t"), title: "Fire-pit booking page", who: "dev", due: "2026-09-24" },
    ],
    activity: [
      { id: id("a"), who: "dev", text: "Photography slipped two weeks; menus not signed off.", minsAgo: 60 * 70, kind: "status" },
      { id: id("a"), who: "niamh", text: "Shared the draft winter menu", minsAgo: 60 * 76, kind: "note" },
    ],
    updatedMins: 60 * 70,
    updatedBy: "dev",
  }),
  build({
    id: "northside",
    name: "Northside Studio rebrand",
    purpose: "New identity, signage and a small site for Northside Studio, a client of Dev's.",
    kind: "client",
    tone: 3,
    status: "on_track",
    statusReason: "Logo round two approved. Moving to signage.",
    history: [{ status: "on_track", date: "2026-07-15", by: "dev", reason: "Kick-off." }],
    owner: "dev",
    people: ["dev", "sive"],
    start: "2026-07-15",
    date: "2026-11-20",
    done: 12,
    total: 19,
    overdue: 0,
    spark: [83, 1.2, 0.8],
    milestones: [
      ms("Logo approved", "2026-09-20", true),
      ms("Signage proofs", "2026-10-12"),
      ms("Site live", "2026-11-20"),
    ],
    taskTitles: [
      ["Signage proofs to Sive", "dev", 11],
      ["Colour tests on oak", "dev", 5],
      ["Site copy review", "sive", 20],
      ["Business cards print run", "dev", 28],
      ["Handover pack", "dev", 55],
    ],
    updatedMins: 60 * 8,
    updatedBy: "sive",
  }),
  build({
    id: "science-fair",
    name: "Year 5 science fair",
    purpose: "St Brigid's Year 5 science fair in the barn: 28 projects, one afternoon.",
    kind: "school",
    tone: 4,
    status: "on_track",
    statusReason: "Table plan agreed with Ms Byrne.",
    history: [{ status: "on_track", date: "2026-09-14", by: "orla", reason: "Date agreed with the school." }],
    owner: "orla",
    people: ["orla", "byrne"],
    start: "2026-09-14",
    date: "2026-12-04",
    done: 3,
    total: 10,
    overdue: 0,
    spark: [97, 0.3, 0.4],
    milestones: [
      ms("Date agreed", "2026-09-14", true),
      ms("Risk assessment", "2026-10-16"),
      ms("Parent letter out", "2026-11-06"),
      ms("Science fair", "2026-12-04"),
    ],
    taskTitles: [
      ["Risk assessment draft", "orla", 21],
      ["Extension leads and tables", "orla", 60],
      ["Parent letter", "byrne", 42],
      ["Judges and prizes", "byrne", 50],
      ["Hot chocolate for 60", "orla", 70],
    ],
    updatedMins: 60 * 24 * 4,
    updatedBy: "byrne",
  }),
  build({
    id: "spring-open-day",
    name: "Spring 2027 wedding open day",
    purpose: "Show 2027 couples the barn dressed three ways, with suppliers on hand.",
    kind: "wedding",
    tone: 8,
    status: "on_track",
    statusReason: "Suppliers invited. Nothing urgent yet.",
    history: [{ status: "on_track", date: "2026-09-18", by: "aoife", reason: "Planned." }],
    owner: "aoife",
    people: ["aoife", "dev"],
    start: "2026-09-18",
    date: "2027-03-14",
    done: 1,
    total: 8,
    overdue: 0,
    spark: [101, 0.2, 0.5],
    milestones: [
      ms("Supplier invites out", "2026-10-20"),
      ms("Registration page", "2027-01-15"),
      ms("Open day", "2027-03-14"),
    ],
    taskTitles: [
      ["Supplier invite list", "aoife", 25],
      ["Three styling looks", "aoife", 90],
      ["Registration page", "dev", 110],
      ["Welcome drinks", "aoife", 160],
      ["Photo recap plan", "dev", 165],
    ],
    updatedMins: 60 * 24 * 6,
    updatedBy: "aoife",
  }),
  build({
    id: "staff-rota",
    name: "Staff rota and training",
    purpose: "Cover the busy season: rota to December and first-aid training for everyone.",
    kind: "operations",
    tone: 3,
    status: "on_track",
    statusReason: "First-aid course booked for 12 Oct.",
    history: [{ status: "on_track", date: "2026-09-01", by: "tomas", reason: "Started." }],
    owner: "tomas",
    people: ["tomas", "orla", "niamh"],
    start: "2026-09-01",
    date: "2026-10-16",
    done: 6,
    total: 9,
    overdue: 0,
    spark: [113, 0.9, 0.4],
    milestones: [
      ms("October rota", "2026-09-26"),
      ms("First-aid course", "2026-10-12"),
      ms("Rota to December", "2026-10-16"),
    ],
    taskTitles: [
      ["Publish October rota", "tomas", 1],
      ["Holiday requests into the rota", "tomas", 4],
      ["First-aid attendee list", "orla", 10],
      ["Two extra weekend staff", "tomas", 15],
      ["Kitchen cover for 17 Oct", "niamh", 20],
    ],
    updatedMins: 60 * 26,
    updatedBy: "tomas",
  }),
  build({
    id: "photo-shoot",
    name: "Website photo shoot",
    purpose: "New photos of the barn, orchard and snug for the site and brochure.",
    kind: "marketing",
    tone: 2,
    status: "on_track",
    statusReason: "Photographer booked for 8 Oct, weather permitting.",
    history: [{ status: "on_track", date: "2026-09-05", by: "dev", reason: "Brief written." }],
    owner: "dev",
    people: ["dev", "orla"],
    start: "2026-09-05",
    date: "2026-10-08",
    done: 4,
    total: 7,
    overdue: 0,
    spark: [127, 0.6, 0.3],
    milestones: [
      ms("Shot list", "2026-09-22", true),
      ms("Shoot day", "2026-10-08"),
    ],
    taskTitles: [
      ["Props from the store room", "dev", 10],
      ["Wet-weather backup date", "dev", 4],
      ["Model release forms", "orla", 8],
      ["Select 40 finals", "dev", 16],
      ["Resize for the site", "dev", 20],
    ],
    updatedMins: 60 * 9,
    updatedBy: "dev",
  }),
  build({
    id: "wine-list",
    name: "Orchard wine list refresh",
    purpose: "Cut the list to 24 wines, add two local ciders, and reprice for winter.",
    kind: "operations",
    tone: 7,
    status: "on_track",
    statusReason: "Tasting with the supplier on 2 Oct.",
    history: [{ status: "on_track", date: "2026-09-12", by: "tomas", reason: "Started." }],
    owner: "tomas",
    people: ["tomas", "niamh"],
    start: "2026-09-12",
    date: "2026-10-23",
    done: 2,
    total: 6,
    overdue: 0,
    spark: [131, 0.3, 0.3],
    milestones: [
      ms("Supplier tasting", "2026-10-02"),
      ms("New list printed", "2026-10-23"),
    ],
    taskTitles: [
      ["Supplier tasting", "tomas", 7],
      ["Cider samples from Longueville", "tomas", 9],
      ["Pairing notes with Niamh", "niamh", 14],
      ["Reprice", "tomas", 20],
      ["Print run", "tomas", 27],
    ],
    updatedMins: 60 * 44,
    updatedBy: "niamh",
  }),
  build({
    id: "keane-legal",
    name: "Corporate retreat for Keane Legal",
    purpose: "Two-day retreat for 30 from Keane Legal: workshops in the barn, dinner in the snug.",
    kind: "event",
    tone: 1,
    status: "at_risk",
    statusReason: "Waiting on final headcount; AV supplier unconfirmed.",
    history: [
      { status: "on_track", date: "2026-08-20", by: "orla", reason: "Contract signed." },
      { status: "at_risk", date: "2026-09-23", by: "orla", reason: "Waiting on final headcount; AV supplier unconfirmed." },
    ],
    owner: "orla",
    people: ["orla", "aoife", "niamh", "tomas"],
    start: "2026-08-20",
    date: "2026-11-06",
    done: 5,
    total: 17,
    overdue: 2,
    spark: [139, 0.7, 1.2],
    milestones: [
      ms("Contract signed", "2026-08-20", true),
      ms("Final headcount", "2026-10-02"),
      ms("AV confirmed", "2026-10-09"),
      ms("Agenda locked", "2026-10-23"),
      ms("Retreat", "2026-11-06"),
    ],
    tasks: [
      { id: id("t"), title: "Chase headcount from Keane's office", who: "orla", due: "2026-09-22" },
      { id: id("t"), title: "Two AV quotes", who: "tomas", due: "2026-09-24" },
      { id: id("t"), title: "Dinner menu options", who: "niamh", due: "2026-10-01" },
      { id: id("t"), title: "Room allocation at the inn", who: "aoife", due: "2026-10-05" },
      { id: id("t"), title: "Workshop breakout plan", who: "orla", due: "2026-10-12" },
    ],
    updatedMins: 60 * 30,
    updatedBy: "orla",
  }),
  build({
    id: "garden-lighting",
    name: "Garden path lighting",
    purpose: "Low path lights from the car park to the orchard so evening guests can find their way.",
    kind: "works",
    tone: 5,
    status: "on_track",
    statusReason: "Lights in. Just the timer to set.",
    history: [{ status: "on_track", date: "2026-08-15", by: "tomas", reason: "Electrician booked." }],
    owner: "tomas",
    people: ["tomas", "ciaran"],
    start: "2026-08-15",
    date: "2026-09-22",
    done: 11,
    total: 12,
    overdue: 1,
    spark: [149, 0.8, 0.2],
    milestones: [
      ms("Trenching", "2026-09-04", true),
      ms("Lights in", "2026-09-18", true),
      ms("Timer set", "2026-09-22"),
    ],
    taskTitles: [["Set the dusk timer", "ciaran", -3]],
    updatedMins: 60 * 24 * 3,
    updatedBy: "ciaran",
  }),
  /* Wrapped */
  build({
    id: "summer-weddings",
    name: "Summer garden weddings",
    purpose: "Six garden weddings, June to August.",
    kind: "wedding",
    tone: 4,
    status: "wrapped",
    statusReason: "All six delivered. Two five-star reviews in.",
    history: [
      { status: "on_track", date: "2026-03-01", by: "aoife", reason: "Season planned." },
      { status: "wrapped", date: "2026-09-02", by: "aoife", reason: "All six delivered. Two five-star reviews in." },
    ],
    owner: "aoife",
    people: ["aoife", "orla", "niamh"],
    start: "2026-03-01",
    date: "2026-08-29",
    done: 64,
    total: 64,
    overdue: 0,
    spark: [151, 0.2, 0],
    milestones: [ms("Last wedding", "2026-08-29", true)],
    taskTitles: [],
    updatedMins: 60 * 24 * 23,
    updatedBy: "aoife",
  }),
  build({
    id: "bar-fitout",
    name: "Barn bar fit-out",
    purpose: "A proper bar in the barn with two taps and a back bar.",
    kind: "works",
    tone: 6,
    status: "wrapped",
    statusReason: "Bar open. Snag list closed.",
    history: [{ status: "wrapped", date: "2026-07-30", by: "tomas", reason: "Bar open. Snag list closed." }],
    owner: "tomas",
    people: ["tomas", "ciaran"],
    start: "2026-05-01",
    date: "2026-07-24",
    done: 22,
    total: 22,
    overdue: 0,
    spark: [157, 0, 0],
    milestones: [ms("Bar open", "2026-07-24", true)],
    taskTitles: [],
    updatedMins: 60 * 24 * 57,
    updatedBy: "tomas",
  }),
  build({
    id: "brochure-2026",
    name: "Wedding brochure 2026",
    purpose: "Printed and PDF brochure for 2026 enquiries.",
    kind: "marketing",
    tone: 2,
    status: "wrapped",
    statusReason: "Printed and live on the site.",
    history: [{ status: "wrapped", date: "2026-05-12", by: "dev", reason: "Printed and live on the site." }],
    owner: "dev",
    people: ["dev", "aoife"],
    start: "2026-03-10",
    date: "2026-05-08",
    done: 14,
    total: 14,
    overdue: 0,
    spark: [163, 0, 0],
    milestones: [ms("Printed", "2026-05-08", true)],
    taskTitles: [],
    updatedMins: 60 * 24 * 136,
    updatedBy: "dev",
  }),
];

/* ── Derived values ────────────────────────────────────────────────── */

export function nextMilestone(p: Project): Milestone | undefined {
  return p.milestones.filter((m) => !m.done).sort((a, b) => toTime(a.date) - toTime(b.date))[0];
}

/**
 * Open tasks split by person. Late tasks are a subset of open tasks, so every row
 * satisfies open >= overdue: late work is placed first, the rest is shared out.
 */
export function openByPerson(p: Project): { who: PersonId; open: number; overdue: number }[] {
  const open = Math.max(0, p.total - p.done);
  const rows = p.people.map((who) => ({ who, open: 0, overdue: 0 }));
  // Overdue sits with the people who own the overdue tasks.
  const overdueTasks = p.tasks.filter((t) => daysFromToday(t.due) < 0).slice(0, Math.min(p.overdue, open));
  for (const t of overdueTasks) {
    const row = rows.find((r) => r.who === t.who);
    if (row) row.overdue += 1;
  }
  for (const r of rows) r.open = r.overdue;
  const weights = p.people.map((_, i) => (i === 0 ? 3 : i === 1 ? 2 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const rest = Math.max(0, open - rows.reduce((a, r) => a + r.open, 0));
  let left = rest;
  rows.forEach((r, i) => {
    const n = i === rows.length - 1 ? left : Math.min(left, Math.round((rest * weights[i]) / wsum));
    r.open += n;
    left -= n;
  });
  if (process.env.NODE_ENV !== "production") {
    for (const r of rows) if (r.open < r.overdue) console.error(`openByPerson: ${p.id}/${r.who} has more late than open`);
  }
  return rows;
}

/** Share of the time between start and date that has already gone, 0 to 1. */
export function elapsedShare(p: Project): number {
  const span = toTime(p.date) - toTime(p.start);
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (toTime(TODAY) - toTime(p.start)) / span));
}

/**
 * Tasks ahead (+) or behind (-) a straight-line plan from start to date.
 * A project halfway through its time with 10 of 20 done is exactly on plan.
 */
export function vsPlan(p: Project): number {
  return Math.round(p.done - p.total * elapsedShare(p));
}

/** Net change in open tasks over the last 14 days: added minus done. */
export function netOpen(p: Project): number {
  return sum(p.sparkAdded) - sum(p.sparkDone);
}

/** Late milestones: not done and their date has passed. */
export function lateMilestones(p: Project): Milestone[] {
  return p.milestones.filter((m) => !m.done && daysFromToday(m.date) < 0);
}

/** Marked on track, yet past its date or holding a late milestone. */
export function statusLooksStale(p: Project): boolean {
  return p.status === "on_track" && (daysFromToday(p.date) < 0 || lateMilestones(p).length > 0);
}

/**
 * One milestone date format for every surface.
 * Within six days: "Tue 29 Sep". Otherwise "29 Sep", with a year only when it differs.
 * `late` is set when the date has passed and the milestone is still open.
 */
export function fmtMilestone(m: Pick<Milestone, "date" | "done">): { date: string; weekday: string | null; day: string; late: string | null; soon: boolean } {
  const n = daysFromToday(m.date);
  const weekday = n >= 0 && n <= 6 ? fmtWeekday(m.date) : null;
  const day = fmtDate(m.date);
  const date = weekday ? `${weekday} ${day}` : day;
  const late = !m.done && n < 0 ? `${-n} ${n === -1 ? "day" : "days"} late` : null;
  return { date, weekday, day, late, soon: !m.done && n >= 0 && n <= 3 };
}

export function isPastDue(p: Project): boolean {
  return p.status !== "wrapped" && daysFromToday(p.date) < 0;
}

export function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

export type Template = { id: string; name: string; kind: KindId; blurb: string; tasks: number };

export const TEMPLATES: Template[] = [
  { id: "tpl-wedding", name: "Wedding", kind: "wedding", blurb: "Run sheet, suppliers, seating, 34 tasks", tasks: 34 },
  { id: "tpl-party", name: "Private party", kind: "event", blurb: "Menu, music, guest list, 18 tasks", tasks: 18 },
  { id: "tpl-corporate", name: "Corporate day", kind: "event", blurb: "Headcount, AV, agenda, 22 tasks", tasks: 22 },
  { id: "tpl-works", name: "Venue works", kind: "works", blurb: "Quotes, contractor, sign-off, 15 tasks", tasks: 15 },
  { id: "tpl-campaign", name: "Marketing campaign", kind: "marketing", blurb: "Plan, shoot, launch, 16 tasks", tasks: 16 },
  { id: "tpl-school", name: "School event", kind: "school", blurb: "Risk assessment, letters, 12 tasks", tasks: 12 },
];
