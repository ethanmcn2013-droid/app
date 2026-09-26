/**
 * The route map: sample data for The Orchard, events (concept only).
 * Days are whole UTC day numbers so every date renders the same on the
 * server and in the browser.
 */

export const day = (month: number, date: number, year = 2026) => Math.round(Date.UTC(year, month - 1, date) / 86_400_000);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmt(d: number) {
  const date = new Date(d * 86_400_000);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
export function fmtLong(d: number) {
  const date = new Date(d * 86_400_000);
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]}`;
}
export function fmtDay(d: number) {
  const date = new Date(d * 86_400_000);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
export function monthOf(d: number) {
  return new Date(d * 86_400_000).getUTCMonth();
}
export function monthName(m: number) {
  return MONTHS_LONG[m];
}

export type LineId = "food" | "guests" | "venue" | "suppliers" | "admin";
export type StationStatus = "done" | "upcoming" | "held" | "overdue" | "review" | "today";
export type Variant = "live" | "good" | "empty" | "after";

export type Person = {
  id: string;
  name: string;
  full: string;
  initials: string;
  role: string;
};

export const PEOPLE: Record<string, Person> = {
  niamh: { id: "niamh", name: "Niamh", full: "Niamh Byrne", initials: "NB", role: "Head chef" },
  tomas: { id: "tomas", name: "Tomás", full: "Tomás Ó Riain", initials: "TÓ", role: "Venue operations" },
  aoife: { id: "aoife", name: "Aoife", full: "Aoife Kelly", initials: "AK", role: "Events manager" },
  priya: { id: "priya", name: "Priya", full: "Priya Nair", initials: "PN", role: "Guest coordinator" },
  dara: { id: "dara", name: "Dara", full: "Dara Walsh", initials: "DW", role: "Venue manager" },
};

export type Line = { id: LineId; name: string; short: string; color: string };

export const LINES: Line[] = [
  { id: "food", name: "Food and drink", short: "Food", color: "var(--c5-food)" },
  { id: "guests", name: "Guests and seating", short: "Guests", color: "var(--c5-guests)" },
  { id: "venue", name: "Venue and hire", short: "Venue", color: "var(--c5-venue)" },
  { id: "suppliers", name: "Suppliers", short: "Suppliers", color: "var(--c5-suppliers)" },
  { id: "admin", name: "Admin", short: "Admin", color: "var(--c5-admin)" },
];

export const LINE_BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l])) as Record<LineId, Line>;

export type LabelPlace = { side: "above" | "below"; align: "start" | "middle" | "end" };

export type Station = {
  id: string;
  name: string;
  /** Used when the full name would collide with a neighbour on the map. */
  short?: string;
  date: number;
  lines: LineId[];
  status: StationStatus;
  owner: string;
  /** What the stop is, in a sentence. */
  task: string;
  /** Stops on other lines this one waits for (same-line order is implied). */
  dependsOn?: string[];
  /** Day it was reached, for done stops. */
  doneOn?: number;
  /** Why it is held or in review, plainly. */
  note?: string;
  label: LabelPlace;
};

export const TODAY = day(7, 16);
export const WEEK_AGO = day(7, 9);
export const TERMINUS = { id: "terminus", name: "Wedding day", date: day(10, 3), place: "The Orchard, Kinsale" };

const BASE_STATIONS: Station[] = [
  // Food and drink
  { id: "f1", short: "Menu draft", name: "Menu draft", date: day(6, 29), lines: ["food"], status: "done", doneOn: day(6, 29), owner: "niamh", task: "Three-course draft with a vegetarian path, shared with Mara and Finn.", label: { side: "above", align: "start" } },
  { id: "f2", short: "Tonic and olives", name: "Order tonic and good olives", date: day(7, 14), lines: ["food"], status: "overdue", owner: "tomas", task: "Standing order with the wholesaler for the tasting and the day.", note: "Two days past its date.", label: { side: "below", align: "start" } },
  { id: "f3", short: "Tasting", name: "Menu tasting", date: day(8, 1), lines: ["food"], status: "held", owner: "niamh", task: "Tasting for six at The Orchard, wines paired.", note: "Waiting on the Ballymaloe Wines quote for 15 days.", label: { side: "above", align: "middle" } },
  { id: "f4", short: "Final numbers", name: "Final numbers to Niamh", date: day(9, 12), lines: ["food", "guests"], status: "upcoming", owner: "priya", task: "Confirmed head count and dietary needs go to the kitchen.", dependsOn: ["g3"], label: { side: "above", align: "middle" } },
  { id: "f5", short: "Kitchen prep", name: "Kitchen prep plan", date: day(9, 28), lines: ["food"], status: "upcoming", owner: "niamh", task: "Prep timings, staffing and deliveries for the day.", label: { side: "above", align: "start" } },
  // Guests and seating
  { id: "g1", short: "Invitations", name: "Invitations sent", date: day(6, 24), lines: ["guests"], status: "done", doneOn: day(6, 24), owner: "priya", task: "140 invitations out by post and email.", label: { side: "below", align: "start" } },
  { id: "g2", short: "Seating plan", name: "Seating plan approval", date: day(7, 20), lines: ["guests"], status: "review", owner: "dara", task: "First seating plan for 140, top table fixed.", note: "In review with Dara since Tuesday.", label: { side: "below", align: "start" } },
  { id: "g3", short: "RSVPs close", name: "RSVPs close", date: day(9, 5), lines: ["guests"], status: "upcoming", owner: "priya", task: "Last day for replies. 112 of 140 are in.", label: { side: "above", align: "end" } },
  { id: "g5", short: "Place cards", name: "Place cards", date: day(9, 25), lines: ["guests"], status: "upcoming", owner: "priya", task: "Printed place cards and table plan board.", label: { side: "below", align: "start" } },
  // Venue and hire
  { id: "v1", short: "Open day", name: "Open day", date: day(7, 15), lines: ["venue"], status: "done", doneOn: day(7, 15), owner: "aoife", task: "Open day at the venue. Nine couples came through.", label: { side: "below", align: "end" } },
  { id: "v2", short: "Marquee sides", name: "Marquee sides confirmed", date: day(7, 24), lines: ["venue"], status: "upcoming", owner: "tomas", task: "Clear sides on the garden run, confirmed with the hire company.", label: { side: "above", align: "start" } },
  { id: "v3", short: "Lighting walk", name: "Lighting walk-through", date: day(9, 18), lines: ["venue"], status: "upcoming", owner: "dara", task: "Walk the site at dusk with the lighting crew.", label: { side: "below", align: "middle" } },
  { id: "v4", short: "Set-up", name: "Set-up day", date: day(10, 2), lines: ["venue"], status: "upcoming", owner: "tomas", task: "Marquee dressed, tables out, kitchen stocked.", dependsOn: ["f5"], label: { side: "above", align: "end" } },
  // Suppliers
  { id: "s1", short: "Band", name: "Band contract", date: day(7, 3), lines: ["suppliers"], status: "done", doneOn: day(7, 3), owner: "aoife", task: "Signed with The Lough Swing for four hours.", label: { side: "above", align: "start" } },
  { id: "s2", short: "Florist", name: "Florist deposit", date: day(7, 30), lines: ["suppliers"], status: "upcoming", owner: "aoife", task: "Deposit to Wildflower Kinsale to hold the date.", label: { side: "below", align: "middle" } },
  { id: "s3", short: "Cake", name: "Cake tasting", date: day(8, 14), lines: ["suppliers"], status: "upcoming", owner: "niamh", task: "Three flavours with the couple at the bakery.", label: { side: "above", align: "start" } },
  // Admin
  { id: "a1", short: "Deposit", name: "Deposit settled", date: day(7, 15), lines: ["admin"], status: "done", doneOn: day(7, 15), owner: "aoife", task: "Mara and Finn settled the venue deposit.", label: { side: "below", align: "end" } },
  { id: "a2", short: "Run-sheet", name: "Saturday run-sheet", date: day(7, 16), lines: ["admin"], status: "today", owner: "aoife", task: "Hour by hour plan for this Saturday's viewing.", note: "Due today.", label: { side: "above", align: "start" } },
  { id: "a3", short: "Balance", name: "Balance invoice", date: day(9, 3), lines: ["admin"], status: "upcoming", owner: "aoife", task: "Final balance invoice to Mara and Finn.", label: { side: "below", align: "middle" } },
];

/** Stop order on each line, left to right. Final numbers is shared. */
export const LINE_STOPS: Record<LineId, string[]> = {
  food: ["f1", "f2", "f3", "f4", "f5"],
  guests: ["g1", "g2", "g3", "f4", "g5"],
  venue: ["v1", "v2", "v3", "v4"],
  suppliers: ["s1", "s2", "s3"],
  admin: ["a1", "a2", "a3"],
};

/** Segments on the chain that decides the date: [line, fromStopId]. */
export const CRITICAL: Array<[LineId, string]> = [
  ["food", "f2"],
  ["food", "f3"],
  ["food", "f4"],
  ["food", "f5"],
  ["guests", "g3"],
];

export type PersonPlace = { person: string; line: LineId; p: number; pWeekAgo: number; doing: string; since: string };

const BASE_PEOPLE: PersonPlace[] = [
  { person: "niamh", line: "food", p: 1.38, pWeekAgo: 1.2, doing: "Chasing Ballymaloe Wines for the pairing quote", since: "On this stretch since 1 Jul" },
  { person: "tomas", line: "venue", p: 0.5, pWeekAgo: -0.35, doing: "Marquee sides with the hire company. Also owes the tonic and olives order.", since: "Moved here after the open day" },
  { person: "priya", line: "guests", p: 1.55, pWeekAgo: 0.6, doing: "Folding 14 new RSVPs into the seating plan", since: "112 of 140 replies in" },
  { person: "dara", line: "guests", p: 0.86, pWeekAgo: 0.35, doing: "Reviewing the seating plan before it goes to the couple", since: "In review since Tuesday" },
  { person: "aoife", line: "admin", p: 0.5, pWeekAgo: -0.4, doing: "Writing the Saturday run-sheet, due today", since: "Settled the deposit yesterday" },
];

export type ServiceUpdate = {
  line: LineId;
  tone: "held" | "minor" | "good" | "today" | "arrived";
  headline: string;
  detail: string;
  impactFrom?: string;
};

export type Arrival = { line: LineId; name: string; when: string; who: string; stop: boolean };

export type Model = {
  variant: Variant;
  today: number;
  stations: Record<string, Station>;
  people: PersonPlace[];
  rsvps: number;
  statusLine: { tone: "held" | "good" | "done" | "empty"; lead: string; rest: string; /** Part of `rest` that opens the journey. */ link?: string };
  updates: ServiceUpdate[];
  arrived: Arrival[];
};

const LIVE_UPDATES: ServiceUpdate[] = [
  { line: "food", tone: "held", headline: "Held at Menu tasting", detail: "Waiting on the Ballymaloe Wines quote (15 days). Tonic and olives are 2 days late.", impactFrom: "f3" },
  { line: "guests", tone: "minor", headline: "Minor delays", detail: "Seating plan in review with Dara. 112 of 140 RSVPs in." },
  { line: "admin", tone: "today", headline: "A stop is due today", detail: "Aoife is finishing the Saturday run-sheet." },
  { line: "venue", tone: "good", headline: "Good service", detail: "Marquee sides next, on Fri 24 Jul." },
  { line: "suppliers", tone: "good", headline: "Good service", detail: "Florist deposit next, on Thu 30 Jul." },
];

const LIVE_ARRIVED: Arrival[] = [
  { line: "admin", name: "Deposit settled", when: "Yesterday", who: "aoife", stop: true },
  { line: "venue", name: "Open day, nine couples through", when: "Yesterday", who: "aoife", stop: true },
  { line: "guests", name: "14 more RSVPs in", when: "This week", who: "priya", stop: false },
  { line: "suppliers", name: "Band set list agreed", when: "Mon 13 Jul", who: "aoife", stop: false },
];

export function getModel(variant: Variant): Model {
  const stations: Record<string, Station> = {};
  for (const s of BASE_STATIONS) stations[s.id] = { ...s };

  if (variant === "good") {
    stations.f2 = { ...stations.f2, status: "done", doneOn: day(7, 13), note: undefined };
    stations.f3 = { ...stations.f3, status: "upcoming", note: "Wine quote in. Tasting booked for six." };
    stations.g2 = { ...stations.g2, status: "done", doneOn: day(7, 15), note: undefined };
    return {
      variant,
      today: TODAY,
      stations,
      people: BASE_PEOPLE.map((p) =>
        p.person === "niamh" ? { ...p, p: 1.55, doing: "Plating the tasting menu" } : p.person === "dara" ? { ...p, p: 1.18, doing: "Walking the marquee layout" } : p.person === "priya" ? { ...p, p: 1.72 } : p,
      ),
      rsvps: 118,
      statusLine: { tone: "good", lead: "On course, with 11 days to spare.", rest: "Good service on all lines. The wedding day is Sat 3 Oct." },
      updates: LINES.map((l) => ({ line: l.id, tone: "good" as const, headline: "Good service", detail: nextStopSentence(stations, l.id, TODAY) })),
      arrived: [{ line: "food", name: "Tonic and good olives ordered", when: "Mon 13 Jul", who: "tomas", stop: true }, { line: "guests", name: "Seating plan approved", when: "Yesterday", who: "dara", stop: true }, ...LIVE_ARRIVED.slice(0, 2)],
    };
  }

  if (variant === "after") {
    for (const id of Object.keys(stations)) stations[id] = { ...stations[id], status: "done", doneOn: stations[id].date, note: undefined };
    return {
      variant,
      today: day(10, 4),
      stations,
      people: [],
      rsvps: 138,
      statusLine: { tone: "done", lead: "Arrived on 3 October.", rest: "All 19 stops reached, on time." },
      updates: LINES.map((l) => ({ line: l.id, tone: "arrived" as const, headline: "Arrived", detail: `All ${LINE_STOPS[l.id].length} stops reached, on time.` })),
      arrived: [
        { line: "venue", name: "Wedding day", when: "Yesterday", who: "aoife", stop: true },
        { line: "venue", name: "Set-up day", when: "Fri 2 Oct", who: "tomas", stop: true },
        { line: "food", name: "Kitchen prep plan", when: "Mon 28 Sept", who: "niamh", stop: true },
        { line: "guests", name: "Place cards", when: "Fri 25 Sept", who: "priya", stop: true },
      ],
    };
  }

  if (variant === "empty") {
    return {
      variant,
      today: TODAY,
      stations: {},
      people: [],
      rsvps: 0,
      statusLine: { tone: "empty", lead: "No stops yet.", rest: "Six tasks are waiting in the depot without dates." },
      updates: [],
      arrived: [],
    };
  }

  return {
    variant,
    today: TODAY,
    stations,
    people: BASE_PEOPLE,
    rsvps: 112,
    statusLine: { tone: "held", lead: "Held at the menu tasting.", rest: "It is waiting on the wine quote. Clear it by 7 Aug and the wedding keeps its 6 days to spare.", link: "7 Aug" },
    updates: LIVE_UPDATES,
    arrived: LIVE_ARRIVED,
  };
}

function nextStopSentence(stations: Record<string, Station>, line: LineId, today: number) {
  const next = LINE_STOPS[line].map((id) => stations[id]).find((s) => s.status !== "done" && s.date >= today);
  return next ? `${next.name} next, on ${fmtDay(next.date)}.` : "Every stop reached.";
}

/** Undated tasks, parked in the depot siding when a project has no stops. */
export const DEPOT = [
  { name: "Book the photographer", who: "aoife" },
  { name: "Confirm the vegetarian count", who: "priya" },
  { name: "Hymn sheets for the ceremony", who: "priya" },
  { name: "Wet-weather plan for drinks", who: "dara" },
  { name: "Transport from the church", who: "tomas" },
  { name: "Tasting menu for six", who: "niamh" },
];

/* ── Stops and dependencies ───────────────────────────────────────── */

/** Every stop downstream of `fromId`, following each line forward and cross-line waits. */
export function downstreamOf(fromId: string, stations: Record<string, Station>): string[] {
  const next = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!next.has(a)) next.set(a, new Set());
    next.get(a)!.add(b);
  };
  for (const stops of Object.values(LINE_STOPS)) for (let i = 0; i < stops.length - 1; i++) add(stops[i], stops[i + 1]);
  for (const s of Object.values(stations)) for (const dep of s.dependsOn ?? []) add(dep, s.id);
  const seen = new Set<string>();
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const n of next.get(id) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return [...seen].filter((id) => stations[id]).sort((a, b) => stations[a].date - stations[b].date);
}

export function upstreamOf(id: string, stations: Record<string, Station>): string[] {
  const out: string[] = [];
  for (const stops of Object.values(LINE_STOPS)) {
    const i = stops.indexOf(id);
    if (i > 0) out.push(stops[i - 1]);
  }
  for (const dep of stations[id]?.dependsOn ?? []) out.push(dep);
  return [...new Set(out)];
}

export function allStops(stations: Record<string, Station>) {
  return Object.values(stations).sort((a, b) => a.date - b.date);
}

/* ── All projects: the network ────────────────────────────────────── */

export type NetProject = {
  id: string;
  name: string;
  kind: string;
  terminus: string;
  date: number;
  color: string;
  tone: "held" | "minor" | "good";
  status: string;
  stops: Array<{ name: string; date: number; done?: boolean; held?: boolean }>;
  heldFrom?: number;
  heldTo?: number;
};

export const NETWORK: NetProject[] = [
  {
    id: "kestrel",
    name: "Kestrel rebrand",
    kind: "Agency",
    terminus: "Kestrel launch",
    date: day(9, 4),
    color: "var(--c5-net-1)",
    tone: "good",
    status: "Guidelines next, 14 Aug.",
    stops: [
      { name: "Brand review", date: day(7, 8), done: true },
      { name: "Logo sign-off", date: day(7, 22) },
      { name: "Guidelines", date: day(8, 14) },
    ],
  },
  {
    id: "winter",
    name: "Winter launch",
    kind: "Retail",
    terminus: "Winter launch",
    date: day(11, 1),
    color: "var(--c5-net-2)",
    tone: "good",
    status: "Campaign brief next, 30 Jul.",
    stops: [
      { name: "Kick-off", date: day(6, 30), done: true },
      { name: "Campaign brief", date: day(7, 30) },
      { name: "Shoot day", date: day(9, 9) },
      { name: "Press preview", date: day(10, 20) },
    ],
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    kind: "Events",
    terminus: "Harvest supper club",
    date: day(9, 12),
    color: "var(--c5-net-3)",
    tone: "good",
    status: "Tickets go live on 20 Jul.",
    stops: [
      { name: "Menu drafted", date: day(7, 6), done: true },
      { name: "Tickets live", date: day(7, 20) },
      { name: "Farm visit", date: day(8, 15) },
    ],
  },
  {
    id: "orchard",
    name: "The Orchard, events",
    kind: "Events",
    terminus: "Wedding day",
    date: day(10, 3),
    color: "var(--c5-net-4)",
    tone: "held",
    status: "Menu tasting is waiting on the wine quote, 15 days now.",
    stops: [
      { name: "Open day", date: day(7, 15), done: true },
      { name: "Menu tasting", date: day(8, 1), held: true },
      { name: "Final numbers", date: day(9, 12) },
      { name: "Set-up day", date: day(10, 2) },
    ],
    heldFrom: day(7, 16),
    heldTo: day(8, 1),
  },
  {
    id: "burren",
    name: "Burren field trip",
    kind: "School",
    terminus: "Burren trip",
    date: day(9, 24),
    color: "var(--c5-net-5)",
    tone: "minor",
    status: "18 of 26 consent forms back.",
    stops: [
      { name: "Consent forms", date: day(7, 20) },
      { name: "Coach booked", date: day(8, 5) },
      { name: "Packing list", date: day(9, 10) },
    ],
  },
];

/** People shared by two adjacent projects: drawn as interchanges. */
export const NET_SHARED = [
  { person: "priya", a: "kestrel", b: "winter", date: day(8, 25), what: "Logo sign-off on Kestrel, campaign brief on Winter launch" },
  { person: "aoife", a: "harvest", b: "orchard", date: day(8, 30), what: "Tickets for Harvest, the run-sheet for The Orchard" },
  { person: "tomas", a: "orchard", b: "burren", date: day(8, 18), what: "Marquee sides for The Orchard, the coach for the Burren trip" },
];

/** The day after: what is left once every line has arrived. */
export const WRAP_UP = [
  { name: "Balance invoice paid", who: "aoife", when: "Fri 9 Oct", done: false },
  { name: "Marquee back to the hire company", who: "tomas", when: "Mon 5 Oct", done: true },
  { name: "Ask Mara and Finn for a review", who: "priya", when: "Mon 12 Oct", done: false },
  { name: "Photos from the photographer", who: "dara", when: "Sat 31 Oct", done: false },
];
