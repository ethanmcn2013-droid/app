/**
 * The demo's canonical world: every project, person, supplier, task, calendar
 * block and file reference that a /demo surface shows. Names, dates, colours,
 * health and leads of the seven main projects come from ../world.ts; this file
 * adds the work itself. Counts are never written down here: they are derived
 * by ./selectors.ts, so every surface gets the same number.
 *
 * Today is Friday 25 September 2026, 11:40. The viewer is Orla. The calendar
 * week (Mon 21 to Sun 27 Sep) is Aoife's, the wedding coordinator's.
 *
 * Server-safe: plain data, importable from server and client components.
 */

import {
  DEMO_TODAY,
  PEOPLE as WORLD_PEOPLE,
  PROJECTS as WORLD_PROJECTS,
  SUPPLIERS as WORLD_SUPPLIERS,
  VIEWER as WORLD_VIEWER,
  WORKSPACE as WORLD_WORKSPACE,
} from "../world";

import { synthesizeHistory, synthesizeProjectHistory } from "./history";
import type {
  Block,
  DayCapacity,
  DemoState,
  FileRef,
  FixedEvent,
  IsoDate,
  Milestone,
  Person,
  PersonId,
  Priority,
  Project,
  ProjectId,
  Room,
  Subtask,
  Supplier,
  SupplierId,
  ProjectEvent,
  ProjectUpdate,
  Task,
  TaskEvent,
  TaskStatus,
  TeamPersonId,
  WorldProjectId,
} from "./types";

/** Bump when the canonical data changes, so a stale saved session is dropped. */
export const DATA_VERSION = "2026-10-02.2";

export const WORKSPACE = WORLD_WORKSPACE;
/** "You" and "yours" always mean Orla. */
export const VIEWER: TeamPersonId = WORLD_VIEWER;
/** The person whose week the calendar shows. */
export const CALENDAR_OWNER: TeamPersonId = "aoife";

/* ── People ─────────────────────────────────────────────────────────── */

const EXTRA_PEOPLE: Person[] = [
  { id: "ada", name: "Ada Lynch", first: "Ada", initials: "AL", role: "Client", hue: 1, external: true, clientOf: "ada-theo" },
  { id: "theo", name: "Theo Marsh", first: "Theo", initials: "TM", role: "Client", hue: 3, external: true, clientOf: "ada-theo" },
  { id: "sinead", name: "Sinéad Kavanagh", first: "Sinéad", initials: "SK", role: "Client, Lena's sister", hue: 9, external: true, clientOf: "kavanagh" },
  { id: "mark", name: "Mark Keane", first: "Mark", initials: "MK", role: "Client, Keane Legal", hue: 1, external: true, clientOf: "keane-legal" },
  { id: "ruth", name: "Ruth Nolan", first: "Ruth", initials: "RN", role: "Organiser, Kinsale Food Festival", hue: 1, external: true, clientOf: "food-fair" },
];

/** The team and the couple from world.ts, then the ledger's other clients. */
export const PEOPLE: readonly Person[] = [
  ...WORLD_PEOPLE.map((p) =>
    p.role === "Client" ? { ...p, external: true, clientOf: "mara-finn" as const } : { ...p },
  ),
  ...EXTRA_PEOPLE,
];

export const TEAM: readonly TeamPersonId[] = ["orla", "aoife", "dara", "tomas", "dev", "niamh", "siobhan"];

/* ── Suppliers ──────────────────────────────────────────────────────── */

/** The first six are world.ts's recurring suppliers, in its order. */
export const SUPPLIERS: readonly Supplier[] = [
  { id: "bloom", name: "Fern and Furrow", what: "florist" },
  { id: "lawlor", name: "Lawlor Hire", what: "marquee" },
  { id: "lindens", name: "The Lindens", what: "band" },
  { id: "kinsale-wine", name: "Kinsale Wine Co", what: "wine merchant" },
  { id: "weir", name: "Tolland & Sons", what: "rings" },
  { id: "harbour", name: "Harbour Coaches", what: "coaches" },
  { id: "printhaus", name: "PrintHaus Cork", what: "printer" },
  { id: "linen-loft", name: "Linen Loft", what: "linen hire" },
  { id: "sugar-loaf", name: "Sugar Loaf Bakery", what: "cakes" },
  { id: "aisling-moran", name: "Aisling Moran Photography", what: "wedding photographer" },
  { id: "fern-photo", name: "Fern Photo", what: "photographer" },
  { id: "kerr", name: "Kerr Stoneworks", what: "stonemason" },
  { id: "farrell", name: "Farrell Build", what: "main contractor" },
  { id: "rossa", name: "Rossa Heating", what: "heating engineer" },
  { id: "valentia", name: "Valentia Slate", what: "slate quarry" },
  { id: "hayes", name: "Hayes Farm", what: "produce" },
  { id: "snapbox", name: "Snapbox Cork", what: "photo booth" },
  { id: "barry", name: "Barry Security", what: "security" },
  { id: "pop-party", name: "Pop Party Supplies", what: "party supplies" },
  { id: "safecert", name: "SafeCert", what: "fire safety" },
];

/** world.ts lists suppliers as "Fern and Furrow (florist)"; this keeps the two in step. */
export const WORLD_SUPPLIER_NAMES: readonly string[] = WORLD_SUPPLIERS.map((s) => s.replace(/\s*\(.*\)$/, ""));

/* ── Projects ───────────────────────────────────────────────────────── */

let msSeq = 0;
function ms(prefix: string, title: string, date: IsoDate, done = false): Milestone {
  msSeq += 1;
  return { id: `${prefix}-m${msSeq}`, title, date, done };
}

type ProjectExtra = Omit<Project, "id" | "name" | "short" | "hue" | "date" | "health" | "lead" | "note" | "canon">;

/** A main project: identity from world.ts, the rest from here. */
function fromWorld(id: WorldProjectId, extra: ProjectExtra): Project {
  const w = WORLD_PROJECTS.find((p) => p.id === id);
  if (!w) throw new Error(`Unknown world project ${id}`);
  return {
    id: w.id,
    name: w.name,
    short: w.short,
    hue: w.hue,
    date: w.date,
    health: w.health,
    lead: w.lead,
    note: w.note,
    canon: true,
    ...extra,
  };
}

const WEDDING_STREAMS = [
  { id: "food", name: "Food and drink" },
  { id: "venue", name: "Venue and hire" },
  { id: "guests", name: "Guests and seating" },
  { id: "suppliers", name: "Suppliers" },
  { id: "admin", name: "Admin" },
];

export const PROJECTS: readonly Project[] = [
  fromWorld("mara-finn", {
    prefix: "mf",
    kind: "wedding",
    start: "2026-03-14",
    healthReason: "Two jobs are late, seating plan v4 is with Mara, and Lawlor Hire release the clear marquee sides on Monday.",
    people: ["aoife", "orla", "dara", "tomas", "dev", "niamh", "siobhan", "mara", "finn"],
    workstreams: WEDDING_STREAMS,
    milestones: [
      ms("mf", "Venue booked", "2026-03-14", true),
      ms("mf", "Invitations out", "2026-07-06", true),
      ms("mf", "RSVPs close", "2026-09-11", true),
      ms("mf", "Menu tasting", "2026-09-25"),
      ms("mf", "Seating plan approved", "2026-09-26"),
      ms("mf", "Marquee goes up", "2026-09-30"),
      ms("mf", "Final numbers", "2026-09-30"),
      ms("mf", "The wedding", "2026-10-03"),
    ],
  }),
  fromWorld("harvest", {
    prefix: "hv",
    kind: "event",
    start: "2026-08-03",
    people: ["dev", "orla", "aoife", "niamh", "dara", "siobhan"],
    workstreams: [
      { id: "menu", name: "Menu" },
      { id: "tickets", name: "Bookings" },
      { id: "room", name: "Room" },
    ],
    milestones: [
      ms("hv", "Producers confirmed", "2026-09-04", true),
      ms("hv", "Menu locked", "2026-09-18", true),
      ms("hv", "Bookings open", "2026-09-28"),
      ms("hv", "Wine pairing tasting", "2026-10-06"),
      ms("hv", "Supper", "2026-10-17"),
    ],
  }),
  fromWorld("kavanagh", {
    prefix: "kv",
    kind: "event",
    start: "2026-08-24",
    people: ["orla", "aoife", "dara", "tomas", "dev", "niamh", "sinead"],
    workstreams: [
      { id: "guests", name: "Guests" },
      { id: "food", name: "Food" },
      { id: "music", name: "Music" },
      { id: "room", name: "Room" },
    ],
    milestones: [
      ms("kv", "Quote agreed", "2026-09-08", true),
      ms("kv", "Band confirmed", "2026-09-30"),
      ms("kv", "Invitations out", "2026-10-05"),
      ms("kv", "Guest list in", "2026-10-30"),
      ms("kv", "Party", "2026-11-14"),
    ],
  }),
  fromWorld("barn-roof", {
    prefix: "br",
    kind: "works",
    start: "2026-07-10",
    healthReason: "Farrell Build now finish on 13 Nov, two weeks after our date. Three jobs are late and the slates land on 30 Sep.",
    people: ["tomas", "orla", "dara", "aoife"],
    workstreams: [
      { id: "roof", name: "Roof" },
      { id: "heating", name: "Heating" },
      { id: "planning", name: "Planning" },
      { id: "moving", name: "Moving out" },
    ],
    milestones: [
      ms("br", "Survey", "2026-07-10", true),
      ms("br", "Old slates off", "2026-09-22", true),
      ms("br", "Slate delivery", "2026-09-30"),
      ms("br", "Heating in", "2026-10-23"),
      ms("br", "Handover", "2026-10-30"),
    ],
  }),
  fromWorld("winter-launch", {
    prefix: "wl",
    kind: "marketing",
    start: "2026-08-15",
    healthReason: "Four jobs are late: the price list, the winter menu and the brochure copy hold up the print run on 2 Oct.",
    people: ["siobhan", "orla", "dev", "aoife", "dara"],
    workstreams: [
      { id: "brochure", name: "Brochure" },
      { id: "photos", name: "Photos" },
      { id: "menus", name: "Menus" },
      { id: "web", name: "Website" },
    ],
    milestones: [
      ms("wl", "Plan agreed", "2026-08-15", true),
      ms("wl", "Menus signed off", "2026-09-18"),
      ms("wl", "Firelight shoot", "2026-09-28"),
      ms("wl", "Brochure to print", "2026-10-02"),
      ms("wl", "Launch", "2026-10-12"),
    ],
  }),
  fromWorld("christmas", {
    prefix: "cm",
    kind: "season",
    start: "2026-09-03",
    end: "2026-12-13",
    people: ["niamh", "orla", "aoife", "dara", "tomas", "dev", "siobhan"],
    workstreams: [
      { id: "stalls", name: "Stalls" },
      { id: "site", name: "Site" },
      { id: "promo", name: "Promotion" },
      { id: "food", name: "Food" },
    ],
    milestones: [
      ms("cm", "Applications open", "2026-09-03", true),
      ms("cm", "Stallholder list closes", "2026-10-09"),
      ms("cm", "Poster out", "2026-10-23"),
      ms("cm", "Lights and power", "2026-11-20"),
      ms("cm", "Opening weekend", "2026-12-05"),
    ],
  }),
  fromWorld("ada-theo", {
    prefix: "at",
    kind: "wedding",
    start: "2026-09-10",
    tooEarly: true,
    people: ["aoife", "orla", "dara", "dev", "ada", "theo"],
    workstreams: [
      { id: "plan", name: "Plan" },
      { id: "food", name: "Food" },
    ],
    milestones: [
      ms("at", "Booking confirmed", "2026-09-10", true),
      ms("at", "First call", "2026-10-02"),
      ms("at", "Menu tasting", "2026-10-24"),
      ms("at", "Final numbers", "2026-11-28"),
      ms("at", "The wedding", "2026-12-12"),
    ],
  }),

  /* Smaller Orchard projects. Active, so they count, but not the main stories. */
  {
    id: "keane-legal",
    name: "Keane Legal retreat",
    short: "Keane Legal",
    hue: 2,
    date: "2026-11-06",
    start: "2026-08-20",
    health: "at_risk",
    healthReason: "Waiting on Mark for the headcount, and the AV quotes are late.",
    lead: "orla",
    people: ["orla", "dev", "tomas", "niamh", "mark"],
    kind: "event",
    note: "Two days for 30: workshops in the barn, dinner in the snug",
    prefix: "kl",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("kl", "Contract signed", "2026-08-20", true), ms("kl", "Final headcount", "2026-10-02"), ms("kl", "AV confirmed", "2026-10-09"), ms("kl", "Retreat", "2026-11-06")],
  },
  {
    id: "food-fair",
    name: "Kinsale food fair in the barn",
    short: "Food fair",
    hue: 4,
    date: "2026-12-04",
    start: "2026-09-14",
    health: "on_track",
    lead: "orla",
    people: ["orla", "tomas", "ruth"],
    kind: "event",
    note: "Twenty-eight local producers, one afternoon in the barn",
    prefix: "ff",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("ff", "Date agreed", "2026-09-14", true), ms("ff", "Stall bookings close", "2026-10-02"), ms("ff", "Fair day", "2026-12-04")],
  },
  {
    id: "open-day",
    name: "Spring 2027 wedding open day",
    short: "Open day",
    hue: 9,
    date: "2027-03-14",
    start: "2026-09-18",
    health: "on_track",
    lead: "aoife",
    people: ["aoife", "siobhan"],
    kind: "wedding",
    note: "The barn dressed three ways, with suppliers on hand",
    prefix: "od",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("od", "Supplier invites out", "2026-10-20"), ms("od", "Open day", "2027-03-14")],
  },
  {
    id: "staff-rota",
    name: "Staff rota and training",
    short: "Staff rota",
    hue: 1,
    date: "2026-10-16",
    start: "2026-09-01",
    health: "on_track",
    lead: "dara",
    people: ["dara", "orla", "niamh", "dev"],
    kind: "operations",
    note: "First-aid course booked for 12 Oct",
    prefix: "sr",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("sr", "October rota", "2026-09-26"), ms("sr", "First-aid course", "2026-10-12"), ms("sr", "Rota to December", "2026-10-16")],
  },
  {
    id: "photo-shoot",
    name: "Website photo shoot",
    short: "Photo shoot",
    hue: 9,
    date: "2026-10-08",
    start: "2026-09-05",
    health: "on_track",
    lead: "siobhan",
    people: ["siobhan", "orla"],
    kind: "marketing",
    note: "Fern Photo booked for 8 Oct, weather permitting",
    prefix: "ps",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("ps", "Shot list", "2026-09-22", true), ms("ps", "Shoot day", "2026-10-08")],
  },
  {
    id: "wine-list",
    name: "Orchard wine list refresh",
    short: "Wine list",
    hue: 3,
    date: "2026-10-23",
    start: "2026-09-12",
    health: "on_track",
    lead: "dev",
    people: ["dev", "niamh"],
    kind: "operations",
    note: "Tasting with Kinsale Wine Co on 2 Oct",
    prefix: "wn",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("wn", "Supplier tasting", "2026-10-02"), ms("wn", "New list printed", "2026-10-23")],
  },
  {
    id: "path-lighting",
    name: "Garden path lighting",
    short: "Path lighting",
    hue: 4,
    date: "2026-10-02",
    start: "2026-08-15",
    health: "on_track",
    lead: "tomas",
    people: ["tomas", "dara", "orla"],
    kind: "works",
    note: "Lights in, just the timer to set",
    prefix: "pl",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("pl", "Trenching", "2026-09-04", true), ms("pl", "Lights in", "2026-09-21", true), ms("pl", "Timer set", "2026-09-29")],
  },
  {
    id: "venue-upkeep",
    name: "Venue upkeep",
    short: "Upkeep",
    hue: 1,
    date: "2026-11-30",
    start: "2026-09-01",
    health: "on_track",
    lead: "dara",
    people: ["dara", "tomas", "orla"],
    kind: "operations",
    note: "Autumn jobs before the first frost",
    prefix: "vu",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("vu", "Wall repointed", "2026-11-03"), ms("vu", "Ready for winter", "2026-11-30")],
  },

  /* Wrapped: finished, kept for the ledger. Figures stand in for their tasks. */
  {
    id: "doyle-chen",
    name: "Doyle & Chen wedding",
    short: "Doyle & Chen",
    hue: 9,
    date: "2026-09-12",
    start: "2026-02-02",
    health: "on_track",
    lead: "aoife",
    people: ["aoife", "orla", "dev", "niamh"],
    kind: "wedding",
    note: "41 of 41 tasks, 2 days early",
    prefix: "dc",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("dc", "Venue booked", "2026-02-02", true), ms("dc", "The wedding", "2026-09-12", true)],
    wrapped: { on: "2026-09-12", tasks: 41, stat: "Ninety guests, a céilí and a very late cake" },
  },
  {
    id: "garden-parties",
    name: "Summer garden parties 2026",
    short: "Garden parties",
    hue: 9,
    date: "2026-08-29",
    start: "2026-06-06",
    health: "on_track",
    lead: "niamh",
    people: ["niamh", "orla", "dev"],
    kind: "season",
    note: "36 of 36 tasks, 1,140 guests",
    prefix: "gp",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("gp", "Last party", "2026-08-29", true)],
    wrapped: { on: "2026-08-31", tasks: 36, stat: "Six parties, 1,140 guests" },
  },
  {
    id: "bar-fitout",
    name: "Barn bar fit-out",
    short: "Bar fit-out",
    hue: 2,
    date: "2026-07-24",
    start: "2026-05-01",
    health: "on_track",
    lead: "tomas",
    people: ["tomas", "orla"],
    kind: "works",
    note: "22 of 22 tasks, on budget",
    prefix: "bf",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("bf", "Bar open", "2026-07-24", true)],
    wrapped: { on: "2026-07-30", tasks: 22, stat: "Two taps and a back bar, on budget" },
  },
  {
    id: "spring-tastings",
    name: "Spring tasting evenings",
    short: "Spring tastings",
    hue: 4,
    date: "2026-05-30",
    start: "2026-04-01",
    health: "on_track",
    lead: "dev",
    people: ["dev", "orla", "aoife"],
    kind: "event",
    note: "18 of 18 tasks, 11 bookings",
    prefix: "st",
    canon: false,
    workstreams: [{ id: "plan", name: "Plan" }],
    milestones: [ms("st", "Last evening", "2026-05-30", true)],
    wrapped: { on: "2026-05-30", tasks: 18, stat: "Three evenings, 11 bookings" },
  },
];

/* ── Tasks ──────────────────────────────────────────────────────────── */

type Extra = Partial<Omit<Task, "id" | "title" | "project" | "workstream" | "status" | "owner" | "due" | "doneOn" | "waitingOn" | "subtasks">> & {
  /** doneOn, for done tasks. */
  done?: IsoDate;
  /** waitingOn, for waiting tasks: who and since when. */
  wait?: [PersonId | SupplierId, IsoDate];
  subs?: [string, boolean][];
};

type Spec = { n: number; title: string; ws: string; status: TaskStatus; owner: TeamPersonId; due?: IsoDate; x: Extra };

const T = (n: number, title: string, ws: string, status: TaskStatus, owner: TeamPersonId, due: IsoDate | null, x: Extra = {}): Spec => ({
  n,
  title,
  ws,
  status,
  owner,
  due: due ?? undefined,
  x,
});

const earliest = (...dates: (IsoDate | undefined)[]) => dates.filter((d): d is IsoDate => !!d).sort()[0];
const shift = (iso: IsoDate, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

function build(projectId: ProjectId, specs: Spec[]): Task[] {
  const p = PROJECTS.find((x) => x.id === projectId);
  if (!p) throw new Error(`Unknown project ${projectId}`);
  return specs.map(({ n, title, ws, status, owner, due, x }) => {
    const { done, wait, subs, created: createdIn, since: sinceIn, priority, ...rest } = x;
    const id = `${p.prefix}-${n}`;
    const first = earliest(rest.start, done, wait?.[1], due) ?? p.start;
    // Ten days before the first date it carries, but never before the project or after today.
    const guess = shift(first, -10) < p.start ? p.start : shift(first, -10);
    const created = createdIn ?? (guess > DEMO_TODAY ? DEMO_TODAY : guess);
    const since =
      sinceIn ?? (status === "done" ? done : status === "waiting" ? wait?.[1] : status === "todo" ? created : rest.start) ?? created;
    const subtasks: Subtask[] | undefined = subs?.map(([t, d], i) => ({ id: `${id}-s${i + 1}`, title: t, done: d }));
    const task: Task = {
      id,
      title,
      project: projectId,
      workstream: ws,
      status,
      owner,
      due,
      created,
      since,
      priority: priority ?? ("none" as Priority),
      ...rest,
    };
    if (done) task.doneOn = done;
    if (wait) task.waitingOn = { who: wait[0], since: wait[1] };
    if (subtasks) task.subtasks = subtasks;
    if (task.due === undefined) delete task.due;
    return task;
  });
}

/*
 * Mara & Finn's wedding, Saturday 3 October, eight days out. The summer's
 * work is done; the last fortnight is crowded; two jobs are late (the tonic
 * and the welcome sign); three jobs follow the day itself.
 */
const MARA_FINN = build("mara-finn", [
  // Food and drink
  T(1, "Draft the tasting menu", "food", "done", "dev", "2026-09-18", { start: "2026-09-07", done: "2026-09-19", priority: "medium", created: "2026-08-21" }),
  T(2, "Cake tasting and order", "food", "done", "dev", "2026-09-16", { start: "2026-09-10", done: "2026-09-16", supplier: "sugar-loaf", cost: 480, paid: true, notes: "Lemon and elderflower, three tiers." }),
  T(3, "Order tonic and the good olives", "food", "doing", "dev", "2026-09-23", {
    start: "2026-09-18",
    since: "2026-09-21",
    priority: "high",
    supplier: "kinsale-wine",
    cost: 186,
    paid: false,
    labels: ["Bar"],
    estimate: 30,
    notes: "Six cases of the light tonic and two tubs of the good olives. Kinsale Wine Co deliver on Monday if the order is in by Saturday.",
  }),
  T(4, "Menu tasting at The Orchard", "food", "doing", "dev", "2026-09-25", {
    helpers: ["aoife", "mara", "finn"],
    start: "2026-09-21",
    since: "2026-09-24",
    priority: "urgent",
    guests: 6,
    estimate: 120,
    notes: "Mara, Finn and both mothers at 16:00. Dev is doing the lamb and the hake side by side. Keep the vegan starter on the list.",
    subs: [
      ["Print tasting cards", true],
      ["Set the long table in the snug", true],
      ["Confirm numbers with Aoife", false],
      ["Wine pairing from Kinsale Wine Co", false],
      ["Take notes on the final picks", false],
    ],
  }),
  T(5, "Print the tasting menus", "food", "todo", "aoife", "2026-09-25", { helpers: ["dev"], priority: "medium", estimate: 30, created: "2026-09-21" }),
  T(6, "Order prosecco for the drinks reception", "food", "todo", "dev", "2026-09-29", {
    start: "2026-09-28",
    created: "2026-09-14",
    priority: "high",
    supplier: "kinsale-wine",
    cost: 1180,
    paid: false,
    guests: 118,
    estimate: 30,
    notes: "Ten cases (60 bottles) and a magnum for the toast, sale or return on unopened cases. Mara approved the order sheet on 25 Sep. It needs a day in the cold room.",
  }),
  T(7, "Final numbers to the kitchen", "food", "todo", "aoife", "2026-09-30", {
    helpers: ["dev"],
    start: "2026-09-28",
    created: "2026-09-11",
    priority: "urgent",
    guests: 118,
    estimate: 60,
    notes: "118 guests and the dietary list: 9 vegetarian, 3 vegan, 2 coeliac, 1 nut allergy at table 6. Goes to Dev once Mara approves seating plan v4.",
  }),
  T(8, "Prep the late-night blaas and chips", "food", "todo", "dev", "2026-10-02", { priority: "low", created: "2026-09-24", notes: "Evening food at 21:30, in paper cones." }),

  // Venue and hire
  T(9, "Marquee booked with Lawlor Hire", "venue", "done", "tomas", "2026-06-30", { start: "2026-06-22", done: "2026-06-30", supplier: "lawlor", cost: 3210, paid: true, created: "2026-06-15" }),
  T(10, "Renew the late licence", "venue", "done", "orla", "2026-09-17", { start: "2026-09-07", done: "2026-09-17", priority: "high" }),
  T(11, "Hang the new terrace heaters", "venue", "done", "tomas", "2026-09-21", { start: "2026-09-14", done: "2026-09-21" }),
  T(12, "Reprint the faded welcome sign", "venue", "todo", "dara", "2026-09-22", {
    start: "2026-09-17",
    created: "2026-09-16",
    priority: "medium",
    supplier: "printhaus",
    cost: 150,
    paid: false,
    estimate: 30,
    notes: "The one at the gate has gone pale in the sun. Same artwork, matte this time. PrintHaus Cork can turn it round in two days.",
  }),
  T(13, "Confirm marquee sides with Lawlor Hire", "venue", "todo", "aoife", "2026-09-28", {
    start: "2026-09-21",
    created: "2026-09-21",
    priority: "urgent",
    supplier: "lawlor",
    cost: 640,
    paid: false,
    estimate: 60,
    notes: "Lawlor Hire are holding clear sides and two solid ones, €3,850 in all on quote v3. Mara has not picked yet, and they release the clear panels on Monday.",
    subs: [
      ["Check the forecast for the 3rd", true],
      ["Ask Mara which view matters more", false],
      ["Email Lawlor Hire with the final choice", false],
    ],
  }),
  T(14, "Test the festoon lights on the terrace", "venue", "todo", "tomas", "2026-10-01", {
    start: "2026-10-01",
    priority: "medium",
    notes: "Run the full string from dusk. Last year two bulbs near the steps kept flickering.",
    subs: [
      ["Swap the two dead bulbs by the steps", false],
      ["Check the timer on the outdoor socket", false],
      ["Run them from dusk for an hour", false],
    ],
  }),
  T(15, "Linen count and order", "venue", "done", "aoife", "2026-09-22", { start: "2026-09-21", done: "2026-09-22", supplier: "linen-loft", cost: 360, paid: true }),
  T(16, "Book the extra cloakroom attendant", "venue", "todo", "aoife", null, { priority: "low", estimate: 30, created: "2026-09-18", notes: "One more person on the cloakroom from 19:00. Ask the agency first." }),
  T(17, "Return the marquee to Lawlor Hire", "venue", "todo", "tomas", "2026-10-05", { afterEvent: true, supplier: "lawlor", created: "2026-09-01" }),

  // Guests and seating
  T(18, "Invitations out", "guests", "done", "aoife", "2026-07-06", { start: "2026-06-29", done: "2026-07-06" }),
  T(19, "Update the allergy list for the kitchen", "guests", "done", "aoife", "2026-09-22", { start: "2026-09-16", done: "2026-09-22", priority: "high" }),
  T(20, "Draft the seating plan", "guests", "done", "aoife", "2026-09-24", {
    helpers: ["orla"],
    start: "2026-09-14",
    done: "2026-09-24",
    created: "2026-09-01",
    priority: "high",
    guests: 118,
    estimate: 60,
    notes: "Seating plan v4: 118 guests at 15 tables in the long barn. Aunt Rose moves away from the speakers, the children's table sits near the doors, and the wheelchair route to table 6 is clear.",
    subs: [
      ["Top table order", true],
      ["Wheelchair route to table 6", true],
      ["Children's table near the doors", true],
    ],
  }),
  T(21, "Approve the seating plan", "guests", "waiting", "aoife", "2026-09-26", {
    wait: ["mara", "2026-09-24"],
    start: "2026-09-24",
    created: "2026-09-24",
    priority: "high",
    guests: 118,
    notes: "Seating plan v4 went to Mara on Thursday. She approved v3 on 21 Sep; v4 seats the Galway cousins together and moves Aunt Rose.",
  }),
  T(22, "Reply to Mara about the top table", "guests", "done", "aoife", "2026-09-24", { start: "2026-09-23", done: "2026-09-24" }),
  T(23, "Place cards to the calligrapher", "guests", "done", "aoife", "2026-09-24", { start: "2026-09-22", done: "2026-09-24" }),
  T(24, "Order place card stock", "guests", "todo", "aoife", "2026-09-26", {
    priority: "medium",
    estimate: 30,
    created: "2026-09-22",
    notes: "The calligrapher has the names. She needs the card stock by Monday.",
  }),
  T(25, "Collect the table numbers from the printer", "guests", "done", "niamh", "2026-09-22", { start: "2026-09-22", done: "2026-09-22", supplier: "printhaus" }),
  T(26, "Draft a wet-weather plan for the drinks reception", "guests", "doing", "orla", "2026-09-30", {
    helpers: ["aoife", "dev"],
    start: "2026-09-23",
    created: "2026-09-21",
    priority: "high",
    guests: 118,
    notes: "Terrace first, then the orchard lawn. If it rains, the drinks move into the orchard marquee with the white sides. Decide the call time for switching.",
  }),
  T(27, "Send Mara and Finn the thank-you card", "guests", "todo", "aoife", "2026-10-07", { afterEvent: true, created: "2026-09-01" }),

  // Suppliers
  T(28, "The Lindens booked for the evening", "suppliers", "done", "dara", "2026-06-26", {
    start: "2026-06-15",
    done: "2026-06-26",
    supplier: "lindens",
    cost: 950,
    paid: true,
    notes: "Deposit paid. Two sets, 21:00 and 22:30. The balance is due after the day.",
  }),
  T(29, "Book the Harbour Coaches shuttle", "suppliers", "done", "niamh", "2026-09-04", {
    start: "2026-08-28",
    done: "2026-09-02",
    supplier: "harbour",
    cost: 1140,
    paid: true,
    guests: 26,
    notes: "Two 49-seat coaches. Out from Kinsale town pier at 13:00, home from the gate at 00:45 and 01:15.",
  }),
  T(30, "Agree the photographer's shot list", "suppliers", "done", "aoife", "2026-09-19", {
    start: "2026-09-14",
    done: "2026-09-19",
    supplier: "aisling-moran",
    cost: 2100,
    paid: false,
    notes: "Family groups after the ceremony, golden hour on the terrace. Mara approved it on 19 Sep.",
  }),
  T(31, "Walk the site with the photographer", "suppliers", "done", "aoife", "2026-09-24", { start: "2026-09-22", done: "2026-09-24", supplier: "aisling-moran", estimate: 60 }),
  T(32, "Confirm Harbour Coaches pick-up times", "suppliers", "done", "niamh", "2026-09-23", { helpers: ["aoife"], start: "2026-09-18", done: "2026-09-23", supplier: "harbour", priority: "high" }),
  T(33, "Chase florist deposit", "suppliers", "waiting", "aoife", "2026-09-28", {
    wait: ["bloom", "2026-09-18"],
    start: "2026-09-18",
    created: "2026-09-18",
    priority: "high",
    supplier: "bloom",
    // No cost or paid flag here: the money left on 18 Sep, and what is open is the
    // florist's confirmation. A "Paid" chip beside "Chase" reads as a contradiction.
    estimate: 30,
    notes: "We paid the €300 deposit on 18 Sep. Fern and Furrow said they would confirm once it landed and have not. If nothing by Monday, ring the shop.",
  }),
  T(34, "Sign The Lindens' contract", "suppliers", "done", "aoife", "2026-09-23", { start: "2026-09-21", done: "2026-09-22", supplier: "lindens" }),
  T(35, "Send The Lindens the first-dance song", "suppliers", "done", "aoife", "2026-09-25", { start: "2026-09-24", done: "2026-09-25", supplier: "lindens" }),
  T(36, "Confirm the band's arrival time with The Lindens", "suppliers", "waiting", "dara", "2026-09-29", {
    wait: ["lindens", "2026-09-22"],
    start: "2026-09-22",
    priority: "medium",
    supplier: "lindens",
    estimate: 15,
    notes: "They need 90 minutes to set up and can't load in before 17:30.",
  }),
  T(37, "Pay The Lindens' balance", "suppliers", "todo", "orla", "2026-10-06", { afterEvent: true, supplier: "lindens", cost: 1250, paid: false, created: "2026-09-01" }),

  // Admin
  T(38, "Update the wedding budget", "admin", "done", "aoife", "2026-09-21", {
    done: "2026-09-21",
    start: "2026-09-21",
    estimate: 60,
    notes: "Added the florist deposit and the coaches. The marquee comes to €3,850 if Mara takes the clear sides.",
  }),
  T(39, "Rehearsal timings with Mara and Finn", "admin", "done", "aoife", "2026-09-22", { helpers: ["mara", "finn"], start: "2026-09-21", done: "2026-09-21", estimate: 120 }),
  T(40, "Staff rota for the wedding weekend", "admin", "done", "aoife", "2026-09-24", { helpers: ["niamh"], start: "2026-09-21", done: "2026-09-23", estimate: 120 }),
  T(41, "Build the Saturday run-sheet", "admin", "doing", "aoife", "2026-09-29", {
    start: "2026-09-16",
    since: "2026-09-21",
    priority: "urgent",
    estimate: 120,
    notes: "Minute by minute from the 11:00 set-up to the last Harbour Coaches run. Goes to The Lindens, the photographer and the kitchen by Tuesday.",
    subs: [
      ["Set-up and deliveries", true],
      ["Ceremony", true],
      ["Drinks reception", true],
      ["Dinner and speeches", false],
      ["First dance and band", false],
      ["Late food", false],
      ["Last coach and close", false],
      ["Send to suppliers", false],
    ],
  }),
  T(42, "Send the final invoice to Mara and Finn", "admin", "done", "orla", "2026-09-25", {
    start: "2026-09-21",
    done: "2026-09-25",
    priority: "high",
    notes: "Balance of €7,480 due by 30 September.",
  }),
  T(43, "Brief the whole team on the day", "admin", "todo", "aoife", "2026-10-02", { helpers: ["dara", "dev", "niamh", "tomas"], priority: "high", start: "2026-10-02", estimate: 60 }),
  T(44, "Ask Mara and Finn for a few words online", "admin", "todo", "siobhan", "2026-10-09", { afterEvent: true, created: "2026-09-01" }),
]);

const HARVEST = build("harvest", [
  T(1, "Producers confirmed", "menu", "done", "dev", "2026-09-04", { start: "2026-08-24", done: "2026-09-04", supplier: "hayes" }),
  T(2, "Lock the five-course menu", "menu", "done", "dev", "2026-09-18", { start: "2026-09-07", done: "2026-09-18" }),
  T(3, "Harvest supper table plan, first pass", "room", "done", "aoife", "2026-09-23", { helpers: ["dev"], start: "2026-09-21", done: "2026-09-21", estimate: 60 }),
  T(4, "Shortlist the wines with Kinsale Wine Co", "menu", "done", "aoife", "2026-09-28", { helpers: ["dev"], start: "2026-09-24", done: "2026-09-24", supplier: "kinsale-wine", estimate: 60 }),
  T(5, "Open bookings", "tickets", "todo", "niamh", "2026-09-28", { priority: "high", notes: "Forty seats at €65, on sale Monday 28 September at 10:00.", guests: 40 }),
  T(6, "Post the supper on socials", "tickets", "todo", "siobhan", "2026-09-30", { priority: "medium" }),
  T(7, "Send the allergy form to everyone booked", "tickets", "todo", "niamh", "2026-10-01"),
  T(8, "Wine pairing tasting with Kinsale Wine Co", "menu", "todo", "dev", "2026-10-06", { supplier: "kinsale-wine", notes: "Tuesday 6 October at 15:00 in the kitchen." }),
  T(9, "Source the apples from Hayes Farm", "menu", "waiting", "dev", "2026-10-08", { wait: ["hayes", "2026-09-22"], start: "2026-09-21", supplier: "hayes" }),
  T(10, "Borrow the second trestle", "room", "doing", "dara", "2026-10-09", { start: "2026-09-23" }),
  T(11, "Staff rota for the night", "room", "todo", "dara", "2026-10-12"),
  T(12, "Print the menus and place cards", "room", "todo", "orla", "2026-10-14", { supplier: "printhaus" }),
  T(13, "Set the price per seat", "tickets", "done", "niamh", "2026-09-23", { helpers: ["dev"], start: "2026-09-21", done: "2026-09-23", notes: "€65 a seat, wine pairing included." }),
]);

const KAVANAGH = build("kavanagh", [
  T(1, "Quote agreed with the Kavanaghs", "guests", "done", "orla", "2026-09-08", { start: "2026-09-01", done: "2026-09-08" }),
  T(2, "Balloon arch", "room", "done", "tomas", "2026-09-17", { start: "2026-09-14", done: "2026-09-17", supplier: "pop-party", cost: 145, paid: true, notes: "Gold and navy." }),
  T(3, "Guest list for the Kavanagh 40th", "guests", "done", "aoife", "2026-09-22", { helpers: ["orla", "sinead"], start: "2026-09-21", done: "2026-09-21", guests: 70, estimate: 60 }),
  T(4, "Kavanagh 40th menu choices to Dev", "food", "todo", "aoife", "2026-09-28", { helpers: ["dev"], estimate: 30 }),
  T(5, "Keep it secret: a separate thread with Sinéad", "guests", "todo", "orla", "2026-09-29", { helpers: ["sinead"] }),
  T(6, "Chase The Lindens for a yes", "music", "waiting", "orla", "2026-09-30", { wait: ["lindens", "2026-09-21"], start: "2026-09-21", supplier: "lindens", priority: "medium" }),
  T(7, "Bar tab deposit", "food", "todo", "dara", "2026-10-01", { cost: 1160, paid: false, guests: 70, priority: "medium", notes: "Cap at €1,500, then a cash bar." }),
  T(8, "Send Kavanagh 40th invitations", "guests", "todo", "orla", "2026-10-05", { helpers: ["sinead"], guests: 70 }),
  T(9, "Photo booth hire", "room", "todo", "niamh", "2026-10-06", { supplier: "snapbox", cost: 395, paid: false }),
  T(10, "Sign off the buffet menu", "food", "review", "dev", "2026-10-09", { start: "2026-09-18", since: "2026-09-22", cost: 2880, paid: false, guests: 70, priority: "high", notes: "Two vegan, one coeliac." }),
  T(11, "Replace the barn fairy lights", "room", "doing", "dara", "2026-10-09", { start: "2026-09-22", cost: 180, paid: true }),
  T(12, "Three-tier birthday cake", "food", "todo", "dev", "2026-10-23", { supplier: "sugar-loaf", cost: 260, paid: false }),
  T(13, "Parking marshal for the night", "room", "todo", "niamh", "2026-11-06", { supplier: "barry", cost: 220, paid: false }),
  T(14, "Draft the invitation", "guests", "done", "orla", "2026-09-22", { helpers: ["sinead"], start: "2026-09-18", done: "2026-09-22", notes: "Lena is 40. Keep it quiet." }),
]);

const BARN_ROOF = build("barn-roof", [
  T(1, "Roof survey", "roof", "done", "tomas", "2026-07-10", { start: "2026-07-10", done: "2026-07-10" }),
  T(2, "Pick the roofer", "roof", "done", "tomas", "2026-07-24", { start: "2026-07-13", done: "2026-07-24", supplier: "farrell" }),
  T(3, "Strip the old slates", "roof", "done", "tomas", "2026-09-18", { start: "2026-09-07", done: "2026-09-22", supplier: "farrell" }),
  T(4, "Questions for the barn roof site meeting", "planning", "done", "aoife", "2026-09-22", { helpers: ["tomas"], start: "2026-09-22", done: "2026-09-22", estimate: 30 }),
  T(5, "Order the heating manifold", "heating", "todo", "tomas", "2026-09-21", { supplier: "rossa", priority: "high", created: "2026-09-10" }),
  T(6, "Agree the revised schedule with Farrell Build", "planning", "waiting", "tomas", "2026-09-23", {
    wait: ["farrell", "2026-09-18"],
    start: "2026-09-16",
    supplier: "farrell",
    priority: "urgent",
    notes: "Farrell Build now finish on 13 Nov, the day before the Kavanagh 40th. Waiting on their revised dates in writing.",
  }),
  T(7, "Tell October couples about the scaffold", "planning", "todo", "dara", "2026-09-24", { priority: "medium" }),
  T(8, "Sign off the heating quote", "heating", "review", "orla", "2026-09-29", { start: "2026-09-23", supplier: "rossa", cost: 18400, paid: false, priority: "high", notes: "€18,400 with a heat pump and a new manifold. Two weeks on site once the slates are on." }),
  T(9, "Slate delivery for the barn roof", "roof", "todo", "tomas", "2026-09-30", { supplier: "valentia", priority: "high", created: "2026-08-31", notes: "4,200 blue slates. Moved from 16 Sep: the quarry is behind." }),
  T(10, "Check the scaffold insurance", "planning", "todo", "tomas", "2026-09-29"),
  T(11, "Building control notice", "planning", "todo", "tomas", "2026-10-04"),
  T(12, "Scaffold up on the barn", "roof", "todo", "tomas", "2026-10-09", { supplier: "farrell" }),
  T(13, "Plan a fallback room for the Kavanagh 40th", "planning", "todo", "orla", "2026-10-09", { notes: "Farrell Build now finish on 13 Nov. The party uses the barn on 14 Nov." }),
  T(14, "Lay the underfloor pipes", "heating", "todo", "tomas", "2026-10-20", { supplier: "rossa" }),
  T(15, "Photos of the barn roof for the insurer", "planning", "todo", "tomas", null, { helpers: ["aoife"], estimate: 60 }),
]);

const WINTER_LAUNCH = build("winter-launch", [
  T(1, "Brief the photographer on the winter shoot", "photos", "done", "siobhan", "2026-09-04", { start: "2026-08-31", done: "2026-09-08", supplier: "fern-photo" }),
  T(2, "Agree the winter launch plan", "brochure", "done", "orla", "2026-09-21", { start: "2026-09-14", done: "2026-09-21" }),
  T(3, "Agree the winter price list", "brochure", "todo", "orla", "2026-09-18", { priority: "high", created: "2026-09-08" }),
  T(4, "Sign off the winter menu", "menus", "review", "dev", "2026-09-18", { start: "2026-09-08", since: "2026-09-22", priority: "high" }),
  T(5, "Approve the brochure copy", "brochure", "review", "orla", "2026-09-24", {
    start: "2026-09-22",
    since: "2026-09-23",
    priority: "urgent",
    notes: "Siobhán needs your yes to send the brochure to print. Two pages have tracked changes from Dev.",
  }),
  T(6, "Hire extra glassware for the launch evening", "menus", "todo", "dara", "2026-09-23", { supplier: "lawlor", cost: 165, paid: false, priority: "low" }),
  T(7, "Proof the winter brochure", "brochure", "doing", "siobhan", "2026-09-29", { helpers: ["aoife"], start: "2026-09-23", estimate: 60 }),
  T(8, "Photograph the barn with the fire lit", "photos", "todo", "siobhan", "2026-09-28", { supplier: "fern-photo", notes: "Moved to Monday. Fern Photo from 18:00." }),
  T(9, "Send the winter brochure to print", "brochure", "todo", "siobhan", "2026-10-02", { supplier: "printhaus", cost: 420, paid: false, notes: "400 copies, A5, uncoated." }),
  T(10, "Schedule the launch week social posts", "web", "todo", "siobhan", "2026-10-05"),
  T(11, "Write the winter weddings web page", "web", "todo", "siobhan", "2026-10-07"),
  T(12, "Reprint the directional signage", "brochure", "todo", "orla", "2026-10-08", { supplier: "printhaus", cost: 180, paid: false, notes: "The old signs still say the Coach House." }),
  T(13, "Lay out the tasting stations", "menus", "doing", "dev", "2026-10-08", { start: "2026-09-23", guests: 200, notes: "Six stations, one per supplier, flowing clockwise." }),
  T(14, "Canapé samples for the launch evening", "menus", "todo", "dev", "2026-10-09", { cost: 1240, paid: false }),
]);

const CHRISTMAS = build("christmas", [
  T(1, "Open stall applications", "stalls", "done", "niamh", "2026-09-03", { start: "2026-08-27", done: "2026-09-03", created: "2026-09-03" }),
  T(2, "Put both market weekends on the calendar", "site", "done", "niamh", "2026-09-22", { start: "2026-09-21", done: "2026-09-22" }),
  T(3, "List the thirty stalls we want to fill", "stalls", "doing", "orla", "2026-10-09", { start: "2026-09-22" }),
  T(4, "Stall pricing for the Christmas markets", "stalls", "todo", "niamh", "2026-10-01", { helpers: ["aoife"], estimate: 60, notes: "Thirty stalls over two weekends." }),
  T(5, "Invite last year's stallholders back", "stalls", "todo", "dara", "2026-10-02"),
  T(6, "Chase stallholder insurance", "stalls", "todo", "niamh", "2026-10-02"),
  T(7, "Send stall offers to the waiting list", "stalls", "todo", "niamh", "2026-10-09"),
  T(8, "Poster and social launch", "promo", "todo", "siobhan", "2026-10-15"),
  T(9, "Power plan for the courtyard", "site", "todo", "tomas", "2026-10-21"),
  T(10, "Mulled cider recipe and costing", "food", "todo", "dev", "2026-10-25"),
  T(11, "Food stall ideas for the Christmas markets", "food", "todo", "niamh", null, { helpers: ["aoife"], estimate: 60 }),
]);

const ADA_THEO = build("ada-theo", [
  T(1, "Send the quote for twenty guests by the fire", "plan", "done", "aoife", "2026-09-21", { start: "2026-09-16", done: "2026-09-21", created: "2026-09-10" }),
  T(2, "Hold 12 Dec in the venue diary", "plan", "done", "dara", "2026-09-22", { start: "2026-09-22", done: "2026-09-22", created: "2026-09-10" }),
  T(3, "Log the deposit from Ada and Theo", "plan", "done", "aoife", "2026-09-24", { start: "2026-09-24", done: "2026-09-24", created: "2026-09-10" }),
  T(4, "Lay out the long table for twenty", "plan", "review", "dara", "2026-09-28", { helpers: ["aoife"], start: "2026-09-23", since: "2026-09-24", guests: 20 }),
  T(5, "Check the fire safety sign-off for the fireside room", "plan", "doing", "dara", "2026-09-30", {
    start: "2026-09-24",
    priority: "high",
    notes: "The insurer wants this year's flue certificate before we seat anyone within two metres of the fire.",
  }),
  T(6, "First call with Ada and Theo", "plan", "todo", "aoife", "2026-10-02", { helpers: ["ada", "theo"], priority: "medium", estimate: 60, notes: "Twenty minutes on video: the fireside room, the winter menu and how the day runs with twenty guests." }),
  T(7, "Send Ada and Theo the winter menu", "food", "todo", "dev", "2026-10-09"),
  T(8, "Pick the winter florals with Fern and Furrow", "plan", "todo", "aoife", "2026-10-16", {
    supplier: "bloom",
    subs: [
      ["Ask Ada for three pictures she likes", false],
      ["Book a call with Fern and Furrow", false],
      ["Agree the table pieces", false],
    ],
  }),
]);

const EXTRAS = [
  ...build("keane-legal", [
    T(1, "Contract signed with Keane Legal", "plan", "done", "orla", "2026-08-20", { start: "2026-08-20", done: "2026-08-20" }),
    T(2, "Book rooms in Kinsale for thirty", "plan", "done", "niamh", "2026-09-18", { start: "2026-09-10", done: "2026-09-18", guests: 30 }),
    T(3, "Chase the headcount from Mark", "plan", "waiting", "orla", "2026-09-22", { wait: ["mark", "2026-09-15"], start: "2026-09-15", priority: "high" }),
    T(4, "Two AV quotes", "plan", "todo", "tomas", "2026-09-24", { priority: "medium" }),
    T(5, "Dinner menu options", "plan", "todo", "dev", "2026-10-01"),
    T(6, "Workshop breakout plan", "plan", "todo", "orla", "2026-10-12"),
  ]),
  ...build("food-fair", [
    T(1, "Agree the date with the festival", "plan", "done", "orla", "2026-09-14", { helpers: ["ruth"], start: "2026-09-14", done: "2026-09-14" }),
    T(2, "Chase the last six stallholders", "plan", "todo", "orla", "2026-10-02", { helpers: ["ruth"] }),
    T(3, "Risk assessment draft", "plan", "todo", "orla", "2026-10-14"),
    T(4, "Extension leads and tables", "plan", "todo", "tomas", "2026-11-20"),
  ]),
  ...build("open-day", [
    T(1, "Plan the open day on one page", "plan", "done", "aoife", "2026-09-18", { start: "2026-09-18", done: "2026-09-18" }),
    T(2, "Supplier invite list", "plan", "todo", "aoife", "2026-10-20"),
    T(3, "Follow up the show-round couple", "plan", "todo", "aoife", null, { estimate: 30 }),
    T(4, "Registration page", "plan", "todo", "siobhan", "2027-01-15"),
  ]),
  ...build("staff-rota", [
    T(1, "Book the first-aid course", "plan", "done", "dara", "2026-09-21", { start: "2026-09-08", done: "2026-09-21" }),
    T(2, "Publish the October rota", "plan", "todo", "dara", "2026-09-26", { priority: "high" }),
    T(3, "Holiday requests into the rota", "plan", "todo", "dara", "2026-09-29"),
    T(4, "Two extra weekend staff", "plan", "doing", "niamh", "2026-10-09", { start: "2026-09-21" }),
    T(5, "First-aid course for everyone", "plan", "todo", "dara", "2026-10-12"),
    T(6, "Collect the rota requests", "plan", "done", "dara", "2026-09-23", { start: "2026-09-21", done: "2026-09-23" }),
  ]),
  ...build("photo-shoot", [
    T(1, "Write the shot list", "plan", "done", "siobhan", "2026-09-22", { start: "2026-09-15", done: "2026-09-22" }),
    T(2, "Wet-weather backup date", "plan", "todo", "siobhan", "2026-09-29"),
    T(3, "Model release forms", "plan", "todo", "orla", "2026-10-02"),
    T(4, "Props from the store room", "plan", "todo", "siobhan", "2026-10-05"),
    T(5, "Pick the rooms to shoot", "plan", "done", "orla", "2026-09-23", { helpers: ["siobhan"], start: "2026-09-21", done: "2026-09-23" }),
    T(6, "Book Fern Photo for 8 Oct", "plan", "done", "siobhan", "2026-09-24", { start: "2026-09-22", done: "2026-09-24", supplier: "fern-photo" }),
  ]),
  ...build("wine-list", [
    T(1, "Cut the list to 24 wines", "plan", "done", "dev", "2026-09-21", { start: "2026-09-14", done: "2026-09-21" }),
    T(2, "Supplier tasting with Kinsale Wine Co", "plan", "todo", "dev", "2026-10-02", { supplier: "kinsale-wine" }),
    T(3, "Pairing notes", "plan", "todo", "niamh", "2026-10-09"),
    T(4, "Reprice for winter", "plan", "todo", "dev", "2026-10-16"),
  ]),
  ...build("path-lighting", [
    T(1, "Trenching", "plan", "done", "tomas", "2026-09-04", { start: "2026-08-24", done: "2026-09-04" }),
    T(2, "Lights in", "plan", "done", "tomas", "2026-09-21", { start: "2026-09-07", done: "2026-09-21" }),
    T(3, "Set the dusk timer", "plan", "todo", "dara", "2026-09-29"),
    T(4, "Wire the lights to the board", "plan", "done", "tomas", "2026-09-23", { start: "2026-09-21", done: "2026-09-23" }),
  ]),
  ...build("venue-upkeep", [
    T(1, "Fire safety inspection", "plan", "done", "orla", "2026-09-08", { start: "2026-09-08", done: "2026-09-08", supplier: "safecert", cost: 350, paid: true, notes: "Certificate filed in Files." }),
    T(2, "Service the boiler", "plan", "done", "tomas", "2026-09-11", { start: "2026-09-11", done: "2026-09-11", supplier: "rossa", cost: 260, paid: true }),
    T(3, "Repoint the walled garden wall", "plan", "waiting", "dara", "2026-11-03", {
      wait: ["kerr", "2026-09-13"],
      start: "2026-09-13",
      supplier: "kerr",
      cost: 3200,
      paid: false,
      notes: "Quote holds until the end of October. Waiting on Kerr Stoneworks for a start date.",
    }),
    T(4, "Replace the barn door hinges", "plan", "todo", "dara", "2026-10-09", { cost: 95, paid: false, priority: "low" }),
    T(5, "Re-seal the terrace flagstones", "plan", "todo", "dara", "2026-10-12", { supplier: "kerr", cost: 420, paid: false, notes: "Before the first frost." }),
    T(6, "Clear the gutters", "plan", "todo", "tomas", null, { cost: 180, paid: false, priority: "low" }),
  ]),
];

/** Where event work happens, for the list's Room column. */
const ROOMS: Record<string, Room> = {
  "mf-6": "Terrace",
  "mf-8": "Orchard marquee",
  "mf-13": "Orchard marquee",
  "mf-14": "Terrace",
  "mf-16": "Long barn",
  "mf-17": "Orchard marquee",
  "mf-20": "Long barn",
  "mf-21": "Long barn",
  "mf-26": "Terrace",
  "mf-36": "Long barn",
  "hv-3": "Orchard hall",
  "hv-10": "Orchard hall",
  "hv-12": "Orchard hall",
  "kv-2": "Long barn",
  "kv-9": "Long barn",
  "kv-10": "Long barn",
  "kv-11": "Long barn",
  "wl-8": "Long barn",
  "wl-13": "Long barn",
  "cm-9": "Walled garden",
  "kl-6": "Long barn",
  "ff-4": "Long barn",
  "vu-3": "Walled garden",
  "vu-5": "Terrace",
};

/**
 * A calendar estimate for open work that has none, from what the title says
 * it is: a chase or a quick send is short, drafting and building take longer.
 */
function guessEstimate(title: string): number {
  if (/^(chase|confirm|tell|ask|post|log|hold|check)\b/i.test(title)) return 15;
  if (/^(send|book|order|collect|borrow|open|invite|pick|set the|follow up|hire|reprint)\b/i.test(title)) return 30;
  if (/^(draft|write|plan|build|proof|lay out|risk|power plan|wet-weather)\b/i.test(title)) return 90;
  if (/(tasting|photograph|shoot|scaffold|first-aid course for everyone)/i.test(title)) return 120;
  return 60;
}

export const TASKS: readonly Task[] = [...MARA_FINN, ...HARVEST, ...KAVANAGH, ...BARN_ROOF, ...WINTER_LAUNCH, ...CHRISTMAS, ...ADA_THEO, ...EXTRAS].map((t) => {
  const room = ROOMS[t.id];
  if (room) t.room = room;
  if (t.status !== "done" && t.estimate === undefined) t.estimate = guessEstimate(t.title);
  return t;
});

/* ── Calendar: Aoife's week, Mon 21 to Sun 27 Sep ───────────────────── */

const WEEKDAY_WINDOW = { open: "09:00", start: "09:15", end: "17:30" };

/** Minutes Aoife sets aside for task work each day, already less meetings. */
export const CAPACITY: readonly DayCapacity[] = [
  { day: "2026-09-21", window: WEEKDAY_WINDOW, minutes: 420, note: "7h for tasks: a 7h 15m day less the morning catch-up" },
  { day: "2026-09-22", window: WEEKDAY_WINDOW, minutes: 330, note: "5h 30m for tasks: the barn roof site meeting takes 1h 30m" },
  { day: "2026-09-23", window: WEEKDAY_WINDOW, minutes: 330, note: "5h 30m for tasks: supplier lunch takes 1h 30m" },
  { day: "2026-09-24", window: WEEKDAY_WINDOW, minutes: 420, note: "7h for tasks: a 7h 15m day less the morning catch-up" },
  { day: "2026-09-25", window: WEEKDAY_WINDOW, minutes: 420, note: "7h for tasks: a 7h 15m day less the morning catch-up" },
  { day: "2026-09-26", window: { open: "10:00", start: "10:00", end: "14:00" }, minutes: 180, note: "3h for tasks: a Saturday morning, less the show-round" },
  { day: "2026-09-27", window: null, minutes: 0, note: "A day off" },
];

export const FIXED_EVENTS: readonly FixedEvent[] = [
  ...["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"].map(
    (day, i): FixedEvent => ({ id: `fx-standup-${i + 1}`, title: "Morning catch-up", day, start: "09:00", minutes: 15, person: "team" }),
  ),
  { id: "fx-barn-meeting", title: "Barn roof site meeting", day: "2026-09-22", start: "14:00", minutes: 90, person: "aoife", where: "The long barn", project: "barn-roof" },
  { id: "fx-supplier-lunch", title: "Supplier lunch", day: "2026-09-23", start: "12:30", minutes: 90, person: "aoife", where: "Kinsale Wine Co" },
  { id: "fx-school-run-1", title: "School run", day: "2026-09-22", start: "15:30", minutes: 30, person: "aoife", personal: true },
  { id: "fx-school-run-2", title: "School run", day: "2026-09-24", start: "15:15", minutes: 30, person: "aoife", personal: true },
  { id: "fx-show-round", title: "Show-round for a 2027 couple", day: "2026-09-26", start: "11:00", minutes: 60, person: "aoife", where: "The Orchard", project: "open-day" },
  { id: "fx-park-run", title: "Park run", day: "2026-09-27", start: "09:30", minutes: 60, person: "aoife", personal: true },
  // Orla's own calendar. The morning catch-ups above are hers too.
  { id: "fx-orla-accounts", title: "Weekly numbers with the accountant", day: "2026-09-21", start: "11:00", minutes: 60, person: "orla", where: "The office" },
  { id: "fx-orla-bank", title: "Bank call about the heating loan", day: "2026-09-22", start: "11:00", minutes: 60, person: "orla", project: "barn-roof" },
  { id: "fx-orla-show-round", title: "Show-round for the Kavanaghs", day: "2026-09-23", start: "15:00", minutes: 60, person: "orla", where: "The long barn", project: "kavanagh" },
  { id: "fx-orla-launch", title: "Winter launch catch-up", day: "2026-09-24", start: "14:00", minutes: 60, person: "orla", project: "winter-launch" },
  { id: "fx-orla-tasting", title: "Menu tasting with Mara and Finn", day: "2026-09-25", start: "16:00", minutes: 90, person: "orla", where: "The long barn", project: "mara-finn" },
  { id: "fx-orla-grounds", title: "Walk the grounds with Tomás", day: "2026-09-26", start: "10:00", minutes: 60, person: "orla", where: "The Orchard" },
];

const blk = (taskId: string, day: IsoDate, start: string, minutes: number): Block => ({
  id: `blk-${taskId}-${day.slice(8)}`,
  taskId,
  day,
  start,
  minutes,
  person: CALENDAR_OWNER,
});

/**
 * Aoife's planned week. Monday to Thursday are mostly done; one block on
 * Wednesday (stall pricing) was missed. Friday is planned 1h past the 7h she
 * has, so "Make Friday fit" has real work to do.
 */
export const BLOCKS: readonly Block[] = [
  // Mon 21
  blk("mf-38", "2026-09-21", "09:30", 60),
  blk("kv-3", "2026-09-21", "10:45", 60),
  blk("hv-3", "2026-09-21", "14:00", 60),
  blk("mf-39", "2026-09-21", "15:00", 120),
  // Tue 22
  blk("mf-34", "2026-09-22", "09:30", 30),
  blk("mf-15", "2026-09-22", "10:15", 60),
  blk("br-4", "2026-09-22", "12:00", 30),
  blk("mf-19", "2026-09-22", "16:00", 60),
  // Wed 23
  blk("mf-40", "2026-09-23", "09:30", 120),
  blk("mf-32", "2026-09-23", "14:15", 30),
  blk("cm-4", "2026-09-23", "15:30", 60),
  // Thu 24
  blk("mf-31", "2026-09-24", "09:15", 60),
  blk("mf-22", "2026-09-24", "10:30", 30),
  blk("mf-23", "2026-09-24", "11:15", 60),
  blk("mf-20", "2026-09-24", "12:15", 60),
  blk("hv-4", "2026-09-24", "14:00", 60),
  // Fri 25, today: 8h planned against 7h
  blk("mf-41", "2026-09-25", "09:15", 90),
  blk("mf-33", "2026-09-25", "10:45", 30),
  blk("mf-24", "2026-09-25", "11:15", 30),
  blk("mf-16", "2026-09-25", "11:45", 30),
  blk("mf-5", "2026-09-25", "12:15", 30),
  blk("mf-13", "2026-09-25", "13:00", 60),
  blk("mf-7", "2026-09-25", "14:00", 60),
  blk("wl-7", "2026-09-25", "15:00", 60),
  blk("mf-4", "2026-09-25", "16:00", 90),
];

/* ── Calendar: Orla's week, and everyone else's ─────────────────────── */

/**
 * Minutes Orla sets aside for task work each day, already less meetings.
 * Friday is short: the menu tasting takes the last hour and a half.
 */
export const ORLA_CAPACITY: readonly DayCapacity[] = [
  { day: "2026-09-21", window: WEEKDAY_WINDOW, minutes: 360, note: "6h for tasks: the weekly numbers with the accountant take 1h" },
  { day: "2026-09-22", window: WEEKDAY_WINDOW, minutes: 360, note: "6h for tasks: the bank call about the heating loan takes 1h" },
  { day: "2026-09-23", window: WEEKDAY_WINDOW, minutes: 360, note: "6h for tasks: the Kavanagh show-round takes 1h" },
  { day: "2026-09-24", window: WEEKDAY_WINDOW, minutes: 360, note: "6h for tasks: the winter launch catch-up takes 1h" },
  { day: "2026-09-25", window: WEEKDAY_WINDOW, minutes: 330, note: "5h 30m for tasks: the menu tasting takes 1h 30m" },
  { day: "2026-09-26", window: { open: "10:00", start: "10:00", end: "13:00" }, minutes: 120, note: "2h for tasks: a Saturday morning, less the walk round the grounds" },
  { day: "2026-09-27", window: null, minutes: 0, note: "A day off" },
];

/** A plain working week, for anyone whose own week is not written down: weekdays, less the morning catch-up. */
export const STANDARD_CAPACITY: readonly DayCapacity[] = CAPACITY.map((c, i) =>
  i < 5
    ? { day: c.day, window: WEEKDAY_WINDOW, minutes: 420, note: "7h for tasks: a 7h 15m day less the morning catch-up" }
    : { day: c.day, window: null, minutes: 0, note: "A day off" },
);

/** Each person's week of hours. Aoife's is `CAPACITY`. Read through `capacityOf(person)` or `capacityFor(day, person)`. */
export const PERSON_CAPACITY: Partial<Record<TeamPersonId, readonly DayCapacity[]>> = {
  [CALENDAR_OWNER]: CAPACITY,
  orla: ORLA_CAPACITY,
};

const orlaBlk = (taskId: string, day: IsoDate, start: string, minutes: number): Block => ({
  id: `blk-orla-${taskId}-${day.slice(8)}`,
  taskId,
  day,
  start,
  minutes,
  person: "orla",
});

/**
 * Orla's planned week, built from her own tasks. Monday to Thursday hold what
 * she finished. Friday is planned 1h past the 5h 30m she has before the menu
 * tasting, so "Make Friday fit" has real work to do on her week as well.
 * "Chase the headcount from Mark" is late and has no time yet.
 */
export const ORLA_BLOCKS: readonly Block[] = [
  // Mon 21
  orlaBlk("wl-2", "2026-09-21", "09:30", 90),
  orlaBlk("kv-3", "2026-09-21", "14:00", 30),
  // Tue 22
  orlaBlk("kv-14", "2026-09-22", "09:15", 90),
  // Wed 23
  orlaBlk("ps-5", "2026-09-23", "10:00", 60),
  // Thu 24
  orlaBlk("mf-20", "2026-09-24", "11:30", 30),
  // Fri 25, today: 6h 30m planned against 5h 30m
  orlaBlk("mf-42", "2026-09-25", "09:15", 30),
  orlaBlk("wl-5", "2026-09-25", "09:45", 60),
  orlaBlk("br-8", "2026-09-25", "10:45", 60),
  orlaBlk("kv-6", "2026-09-25", "11:45", 15),
  orlaBlk("wl-3", "2026-09-25", "12:15", 60),
  orlaBlk("mf-26", "2026-09-25", "13:15", 90),
  orlaBlk("kv-5", "2026-09-25", "14:45", 60),
  orlaBlk("ff-2", "2026-09-25", "15:45", 15),
];

/** Every planned block the demo starts with: Aoife's week (`BLOCKS`) and Orla's. */
export const ALL_BLOCKS: readonly Block[] = [...BLOCKS, ...ORLA_BLOCKS];

/* ── Files and approvals ────────────────────────────────────────────── */

/**
 * Files that carry a fact other surfaces repeat: an approval, a version, a
 * price. The Files surface keeps its own bodies and previews, but its states,
 * versions, approvers and dates must match these.
 */
export const FILES: readonly FileRef[] = [
  { id: "f-seat-4", title: "Seating plan v4", project: "mara-finn", kind: "sheet", by: "aoife", date: "2026-09-24", series: "seating", version: 4, state: "awaiting", awaiting: "mara", taskId: "mf-21", summary: "118 guests at 15 tables. With Mara since Thursday." },
  { id: "f-seat-3", title: "Seating plan v3", project: "mara-finn", kind: "sheet", by: "aoife", date: "2026-09-18", series: "seating", version: 3, state: "approved", approvedBy: "mara", approvedOn: "2026-09-21", taskId: "mf-20", summary: "118 guests at 15 tables. Approved by Mara on 21 Sep." },
  { id: "f-seat-2", title: "Seating plan v2", project: "mara-finn", kind: "sheet", by: "aoife", date: "2026-09-10", series: "seating", version: 2, state: "draft", taskId: "mf-20", summary: "First pass with long tables. Mara asked for rounds." },
  { id: "f-marquee-3", title: "Marquee quote, Lawlor Hire v3.pdf", project: "mara-finn", kind: "pdf", by: "aoife", date: "2026-09-23", series: "marquee", version: 3, state: "awaiting", awaiting: "mara", taskId: "mf-13", summary: "€3,850 with clear sides, down from €4,200." },
  { id: "f-marquee-2", title: "Marquee quote, Lawlor Hire v2.pdf", project: "mara-finn", kind: "pdf", by: "aoife", date: "2026-09-18", series: "marquee", version: 2, state: "draft", taskId: "mf-13", summary: "€4,200." },
  { id: "f-menu-2", title: "Wedding menu, draft 2.docx", project: "mara-finn", kind: "doc", by: "dev", date: "2026-09-22", series: "menu", version: 2, state: "approved", approvedBy: "mara", approvedOn: "2026-09-24", taskId: "mf-4" },
  { id: "f-florist", title: "Florist proposal, Fern and Furrow.pdf", project: "mara-finn", kind: "pdf", by: "aoife", date: "2026-09-15", version: 1, state: "approved", approvedBy: "mara", approvedOn: "2026-09-20", taskId: "mf-33", summary: "A €300 deposit holds the date." },
  { id: "f-rider", title: "Band rider, The Lindens.pdf", project: "mara-finn", kind: "pdf", by: "dara", date: "2026-09-14", version: 1, state: "approved", approvedBy: "mara", approvedOn: "2026-09-17", taskId: "mf-36" },
  { id: "f-shots", title: "Photographer shot list.docx", project: "mara-finn", kind: "doc", by: "aoife", date: "2026-09-17", version: 1, state: "approved", approvedBy: "mara", approvedOn: "2026-09-19", taskId: "mf-30" },
  { id: "f-prosecco", title: "Prosecco order, Kinsale Wine Co.xlsx", project: "mara-finn", kind: "sheet", by: "dev", date: "2026-09-25", version: 1, state: "approved", approvedBy: "mara", approvedOn: "2026-09-25", taskId: "mf-6", summary: "10 cases and a magnum. Dev orders by Tue 29 Sep." },
  { id: "f-bar", title: "Bar order, wedding weekend.xlsx", project: "mara-finn", kind: "sheet", by: "dev", date: "2026-09-20", version: 1, state: "draft", taskId: "mf-3", summary: "Tonic and the good olives, not ordered yet." },
  { id: "f-runsheet-2", title: "Saturday run-sheet v2.docx", project: "mara-finn", kind: "doc", by: "aoife", date: "2026-09-24", series: "runsheet", version: 2, state: "draft", taskId: "mf-41" },
  { id: "f-wet", title: "Wet-weather plan, drinks reception.docx", project: "mara-finn", kind: "doc", by: "orla", date: "2026-09-23", version: 1, state: "draft", taskId: "mf-26" },
  { id: "f-sign", title: "Welcome sign artwork.png", project: "mara-finn", kind: "image", by: "dara", date: "2026-09-17", version: 1, state: "draft", taskId: "mf-12" },
  { id: "f-coach", title: "Coach booking, Harbour Coaches.pdf", project: "mara-finn", kind: "pdf", by: "niamh", date: "2026-09-02", version: 1, state: "signed", taskId: "mf-29", summary: "Booking 4471, €1,140 for both coaches." },
  { id: "f-contract", title: "Venue contract, signed.pdf", project: "mara-finn", kind: "pdf", by: "orla", date: "2026-07-02", version: 1, state: "signed" },
  { id: "f-heating", title: "Heating quote, underfloor.pdf", project: "barn-roof", kind: "pdf", by: "tomas", date: "2026-09-23", version: 1, state: "awaiting", awaiting: "orla", taskId: "br-8", summary: "€18,400 with a heat pump and a new manifold." },
  { id: "f-slate", title: "Slate delivery note.pdf", project: "barn-roof", kind: "pdf", by: "tomas", date: "2026-09-16", version: 1, state: "draft", taskId: "br-9", summary: "Delivery moved from 16 Sep to Wed 30 Sep." },
  { id: "f-launch-plan", title: "Winter launch plan.docx", project: "winter-launch", kind: "doc", by: "siobhan", date: "2026-09-14", version: 1, state: "approved", approvedBy: "orla", approvedOn: "2026-09-21", taskId: "wl-2" },
  { id: "f-brochure-2", title: "Winter brochure v2.pdf", project: "winter-launch", kind: "design", by: "siobhan", date: "2026-09-23", series: "brochure", version: 2, state: "awaiting", awaiting: "orla", taskId: "wl-5", summary: "Copy waiting on Orla before it goes to print on 2 Oct." },
  { id: "f-brochure-1", title: "Winter brochure.pdf", project: "winter-launch", kind: "design", by: "siobhan", date: "2026-09-10", series: "brochure", version: 1, state: "draft" },
  { id: "f-kv-invite", title: "Invitation, Kavanagh 40th.pdf", project: "kavanagh", kind: "design", by: "orla", date: "2026-09-22", version: 1, state: "awaiting", awaiting: "sinead", taskId: "kv-8" },
];

/* ── The starting state ─────────────────────────────────────────────── */

/** Every task's past, oldest first. Replays to TASKS exactly. */
export const TASK_HISTORY: readonly TaskEvent[] = synthesizeHistory(TASKS, PROJECTS);

const PROJECT_PAST = synthesizeProjectHistory(PROJECTS);
/** Every project's past, oldest first. Each project's last health event matches its stored health. */
export const PROJECT_EVENTS: readonly ProjectEvent[] = PROJECT_PAST.events;
/** Every project's updates feed, oldest first. */
export const PROJECT_UPDATES: readonly ProjectUpdate[] = PROJECT_PAST.updates;

/** What a fresh review starts from. Never mutated; the client store copies it. */
export const INITIAL_STATE: DemoState = {
  tasks: TASKS as Task[],
  blocks: ALL_BLOCKS as Block[],
  history: TASK_HISTORY as TaskEvent[],
  projects: PROJECTS as Project[],
  projectEvents: PROJECT_EVENTS as ProjectEvent[],
  updates: PROJECT_UPDATES as ProjectUpdate[],
};

/* ── Lookups ────────────────────────────────────────────────────────── */

const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));
const PERSON_BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));
const SUPPLIER_BY_ID = new Map(SUPPLIERS.map((s) => [s.id, s]));
const FILE_BY_ID = new Map(FILES.map((f) => [f.id, f]));

export const projectById = (id: string): Project | undefined => PROJECT_BY_ID.get(id as ProjectId);
export const personById = (id: string): Person | undefined => PERSON_BY_ID.get(id as PersonId);
export const supplierById = (id: string): Supplier | undefined => SUPPLIER_BY_ID.get(id as SupplierId);
export const fileById = (id: string): FileRef | undefined => FILE_BY_ID.get(id);

/** A waited-on party's display name: "Mara", "Fern and Furrow". */
export function nameOf(who: string): string {
  return personById(who)?.first ?? supplierById(who)?.name ?? who;
}
