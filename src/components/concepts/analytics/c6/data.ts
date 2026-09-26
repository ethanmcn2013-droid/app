/*
 * Sample data for "All projects wall". Invented, deterministic, front-end only.
 *
 * Days are counted from today (Friday 25 September 2026 = 0). Weeks start on
 * Monday; there are 26 of them, the last one (21 Sep) is this week and is
 * only five days old.
 */

export const WEEKS = 26;
export const THIS_WEEK = WEEKS - 1;
/** Days of this week that have happened (Mon to Fri). */
export const THIS_WEEK_DAYS = 5;

const TODAY_UTC = Date.UTC(2026, 8, 25);
const DAY = 86_400_000;

export const dateOf = (day: number) => new Date(TODAY_UTC + day * DAY);
/** Day number of the Monday that starts week `w`. */
export const weekStart = (w: number) => -4 - (THIS_WEEK - w) * 7;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const fmtDay = (day: number) => {
  const d = dateOf(day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const fmtDayLong = (day: number) => {
  const d = dateOf(day);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
};
export const fmtWeekday = (day: number) => WEEKDAYS[dateOf(day).getUTCDay()];
/** yyyy-mm-dd for date inputs. */
export const isoOf = (day: number) => dateOf(day).toISOString().slice(0, 10);
export const dayFromIso = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - TODAY_UTC) / DAY);

export type Client =
  | "The Orchard"
  | "Brightwater"
  | "Riverside"
  | "Northgate"
  | "Hollow Lane";

export type Person = { name: string; open: number };
export type Issue = { text: string; tone: "danger" | "warning" | "neutral" };

export type Project = {
  id: string;
  name: string;
  client: Client;
  /** 1..8, maps to --v3-project-n. */
  hue: number;
  initials: string;
  /** What the big date is, in the owner's words. */
  dateLabel: string | null;
  bigDate: number | null;
  /** First week with any work (0..25). */
  start: number;
  finished: number[];
  added: number[];
  /** Of each week's finished things, how many were done after their due date. */
  finishedLate: number[];
  late: number;
  /** Days the oldest late thing has been late. */
  oldestLate: number;
  /** Median days from added to finished. */
  usualDays: number;
  unowned: number;
  people: Person[];
  issues: Issue[];
  /** Times the big date has moved. */
  dateMoves: number;
};

export type FinishedProject = {
  id: string;
  name: string;
  client: Client;
  hue: number;
  initials: string;
  dateLabel: string;
  bigDate: number;
  doneOn: number;
  total: number;
  weeks: number;
  finished: number[];
};

/* ── deterministic noise ─────────────────────────────────────────────── */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Spec = Omit<Project, "finished" | "added" | "finishedLate"> & {
  seed: number;
  /** Recent finished per week and added per week. */
  pace: number;
  inflow: number;
  /** Open things right now. */
  open: number;
  lateShare: number;
  /** Extra things added in a given week (menu changes, scope changes). */
  bursts?: Record<number, number>;
  /** Quiet weeks (holidays, exams). */
  lulls?: number[];
};

function series(spec: Spec) {
  const r = rng(spec.seed);
  const finished = new Array<number>(WEEKS).fill(0);
  const added = new Array<number>(WEEKS).fill(0);
  const finishedLate = new Array<number>(WEEKS).fill(0);
  const ramped = spec.start > 0;
  for (let w = spec.start; w < WEEKS; w++) {
    const age = w - spec.start;
    const ramp = ramped
      ? Math.min(1, 0.45 + age * 0.06)
      : 0.85 + 0.15 * Math.sin(w / 3);
    const partial = w === THIS_WEEK ? THIS_WEEK_DAYS / 7 : 1;
    const lull = spec.lulls?.includes(w) ? 0.35 : 1;
    const f = Math.max(
      0,
      Math.round(spec.pace * ramp * lull * partial * (0.78 + r() * 0.44)),
    );
    const a =
      Math.max(0, Math.round(spec.inflow * (0.6 + r() * 0.8) * partial)) +
      (spec.bursts?.[w] ?? 0);
    finished[w] = w === spec.start && ramped ? Math.round(f * 0.4) : f;
    added[w] = w === spec.start && ramped ? 0 : a;
    finishedLate[w] = Math.min(
      finished[w],
      Math.round(finished[w] * spec.lateShare * (0.6 + r() * 0.8)),
    );
  }
  // The first week carries in everything that was planned, so the open count
  // today lands exactly on spec.open.
  const net =
    finished.reduce((s, v) => s + v, 0) - added.reduce((s, v) => s + v, 0);
  added[spec.start] += spec.open + net;
  // Never let the open count dip below a handful on the way here.
  let run = 0;
  let low = Infinity;
  for (let w = spec.start; w < WEEKS; w++) {
    run += added[w] - finished[w];
    low = Math.min(low, run);
  }
  if (low < 3 && spec.open > 0) added[spec.start] += 3 - low;
  return { finished, added, finishedLate };
}

const SPECS: Spec[] = [
  {
    id: "mara",
    name: "Mara & Finn",
    client: "The Orchard",
    hue: 8,
    initials: "MF",
    dateLabel: "Wedding",
    bigDate: 22,
    start: 3,
    seed: 11,
    pace: 19,
    inflow: 3,
    open: 41,
    lateShare: 0.08,
    bursts: { 16: 11 },
    late: 3,
    oldestLate: 4,
    usualDays: 6,
    unowned: 2,
    dateMoves: 0,
    people: [
      { name: "Aoife", open: 17 },
      { name: "Declan", open: 12 },
      { name: "Niamh", open: 10 },
    ],
    issues: [
      {
        text: "Final numbers are due to the caterer on Wed 30 Sep",
        tone: "neutral",
      },
      { text: "Seating plan is 4 days late", tone: "warning" },
      { text: "2 things have no owner", tone: "neutral" },
    ],
  },
  {
    id: "nora",
    name: "Nora & Cian",
    client: "The Orchard",
    hue: 2,
    initials: "NC",
    dateLabel: "Wedding",
    bigDate: 43,
    start: 7,
    seed: 23,
    pace: 13,
    inflow: 3,
    open: 62,
    lateShare: 0.12,
    bursts: { 21: 7 },
    late: 5,
    oldestLate: 9,
    usualDays: 8,
    unowned: 4,
    dateMoves: 0,
    people: [
      { name: "Aoife", open: 21 },
      { name: "Declan", open: 19 },
      { name: "Ruth", open: 14 },
    ],
    issues: [
      { text: "Florist quote has been waiting 9 days", tone: "warning" },
      {
        text: "Pace dipped for two weeks while Mara & Finn took priority",
        tone: "neutral",
      },
      { text: "4 things have no owner", tone: "neutral" },
    ],
  },
  {
    id: "aisling",
    name: "Aisling & Tom",
    client: "The Orchard",
    hue: 5,
    initials: "AT",
    dateLabel: "Wedding",
    bigDate: 78,
    start: 23,
    seed: 37,
    pace: 7,
    inflow: 4,
    open: 34,
    lateShare: 0,
    late: 0,
    oldestLate: 0,
    usualDays: 3,
    unowned: 9,
    dateMoves: 0,
    people: [
      { name: "Ruth", open: 20 },
      { name: "Niamh", open: 5 },
    ],
    issues: [
      { text: "9 things have no owner yet", tone: "neutral" },
      { text: "Venue walk-through not booked", tone: "neutral" },
    ],
  },
  {
    id: "upkeep",
    name: "Venue upkeep",
    client: "The Orchard",
    hue: 4,
    initials: "VU",
    dateLabel: null,
    bigDate: null,
    start: 0,
    seed: 41,
    pace: 6,
    inflow: 5,
    open: 14,
    lateShare: 0.2,
    late: 2,
    oldestLate: 16,
    usualDays: 11,
    unowned: 1,
    dateMoves: 0,
    people: [
      { name: "Pádraig", open: 11 },
      { name: "Declan", open: 3 },
    ],
    issues: [
      { text: "Boiler service is 16 days late", tone: "warning" },
      {
        text: "Adds and finishes are level, so the list holds steady",
        tone: "neutral",
      },
    ],
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    client: "The Orchard",
    hue: 6,
    initials: "HS",
    dateLabel: "Supper club",
    bigDate: 8,
    start: 13,
    seed: 53,
    pace: 15,
    inflow: 3,
    open: 16,
    lateShare: 0.3,
    bursts: { 22: 6 },
    late: 7,
    oldestLate: 12,
    usualDays: 9,
    unowned: 3,
    dateMoves: 1,
    people: [
      { name: "Ruth", open: 10 },
      { name: "Pádraig", open: 8 },
      { name: "Aoife", open: 6 },
    ],
    issues: [
      { text: "Tent hire has moved 3 times", tone: "danger" },
      { text: "Wine pairing is 12 days late", tone: "warning" },
      { text: "11 things were added in the last 4 weeks", tone: "neutral" },
    ],
  },
  {
    id: "riverside",
    name: "Final year survey",
    client: "Riverside",
    hue: 3,
    initials: "FS",
    dateLabel: "Hand-in",
    bigDate: 70,
    start: 0,
    seed: 67,
    pace: 7,
    inflow: 1,
    open: 46,
    lateShare: 0.1,
    lulls: [10, 11, 12],
    late: 1,
    oldestLate: 3,
    usualDays: 5,
    unowned: 0,
    dateMoves: 0,
    people: [
      { name: "Saoirse", open: 18 },
      { name: "Oisín", open: 16 },
      { name: "Maeve", open: 12 },
    ],
    issues: [
      { text: "Ethics form is 3 days late", tone: "warning" },
      { text: "Three quiet weeks in June during exams", tone: "neutral" },
    ],
  },
  {
    id: "hollis",
    name: "Hollis Café rebrand",
    client: "Brightwater",
    hue: 1,
    initials: "HC",
    dateLabel: "Launch",
    bigDate: 38,
    start: 11,
    seed: 79,
    pace: 10,
    inflow: 3,
    open: 44,
    lateShare: 0.26,
    bursts: { 19: 9 },
    late: 8,
    oldestLate: 14,
    usualDays: 12,
    unowned: 2,
    dateMoves: 2,
    people: [
      { name: "Jess", open: 19 },
      { name: "Ronan", open: 15 },
      { name: "Lena", open: 10 },
    ],
    issues: [
      { text: "Menu board artwork has moved 3 times", tone: "danger" },
      { text: "Signage proofs are 14 days late", tone: "warning" },
      { text: "Launch date has already moved twice", tone: "neutral" },
    ],
  },
  {
    id: "kinsale",
    name: "Kinsale Arts Festival site",
    client: "Brightwater",
    hue: 7,
    initials: "KA",
    dateLabel: "Festival opens",
    bigDate: 56,
    start: 9,
    seed: 83,
    pace: 14,
    inflow: 5,
    open: 68,
    lateShare: 0.14,
    bursts: { 23: 8 },
    late: 4,
    oldestLate: 6,
    usualDays: 7,
    unowned: 12,
    dateMoves: 0,
    people: [
      { name: "Ronan", open: 26 },
      { name: "Lena", open: 20 },
      { name: "Jess", open: 14 },
    ],
    issues: [
      { text: "12 things have no owner", tone: "warning" },
      {
        text: "Ronan is carrying 26 open things, the most of anyone",
        tone: "neutral",
      },
      { text: "Generator hire is 6 days late", tone: "neutral" },
    ],
  },
  {
    id: "retainer",
    name: "Brightwater retainer",
    client: "Brightwater",
    hue: 2,
    initials: "BR",
    dateLabel: null,
    bigDate: null,
    start: 0,
    seed: 97,
    pace: 8,
    inflow: 6.4,
    open: 11,
    lateShare: 0.06,
    late: 0,
    oldestLate: 0,
    usualDays: 3,
    unowned: 0,
    dateMoves: 0,
    people: [
      { name: "Jess", open: 5 },
      { name: "Lena", open: 4 },
      { name: "Ronan", open: 2 },
    ],
    issues: [
      {
        text: "Adds and finishes are level, so the list holds steady",
        tone: "neutral",
      },
    ],
  },
];

function build(spec: Spec): Project {
  const {
    id,
    name,
    client,
    hue,
    initials,
    dateLabel,
    bigDate,
    start,
    late,
    oldestLate,
    usualDays,
    unowned,
    people,
    issues,
    dateMoves,
  } = spec;
  return {
    id,
    name,
    client,
    hue,
    initials,
    dateLabel,
    bigDate,
    start,
    late,
    oldestLate,
    usualDays,
    unowned,
    people,
    issues,
    dateMoves,
    ...series(spec),
  };
}

export const PROJECTS: Project[] = SPECS.map(build);

export const RECENTLY_FINISHED: FinishedProject = (() => {
  const r = rng(5);
  const finished = new Array<number>(WEEKS).fill(0);
  for (let w = 14; w <= 24; w++)
    finished[w] = Math.round((w < 17 ? 3 : 6) + r() * 4);
  const total = finished.reduce((s, v) => s + v, 0);
  return {
    id: "garden",
    name: "Summer garden party",
    client: "The Orchard",
    hue: 4,
    initials: "SG",
    dateLabel: "Party",
    bigDate: -5,
    doneOn: -7,
    total,
    weeks: 11,
    finished,
  };
})();

/* ── other states ────────────────────────────────────────────────────── */

const MANY_NAMES: [string, Client, string | null][] = [
  ["Byrne & Walsh", "The Orchard", "Wedding"],
  ["Doyle 40th", "The Orchard", "Party"],
  ["Autumn open day", "The Orchard", "Open day"],
  ["Keane & Lynch", "The Orchard", "Wedding"],
  ["Christmas markets", "The Orchard", "Opens"],
  ["Staff training", "The Orchard", null],
  ["Tidewater bakery", "Brightwater", "Launch"],
  ["Corrib Rowing kit", "Brightwater", "Delivery"],
  ["Marlow Books site", "Brightwater", "Launch"],
  ["Fennel & Fig menus", "Brightwater", "Print"],
  ["Westport trail maps", "Brightwater", "Print"],
  ["Harbour FM ads", "Brightwater", null],
  ["Year 2 field trip", "Riverside", "Trip"],
  ["Science fair", "Riverside", "Fair"],
  ["Thesis chapter 3", "Riverside", "Hand-in"],
  ["Debate society", "Riverside", null],
  ["Northgate fit-out", "Northgate", "Handover"],
  ["Northgate open house", "Northgate", "Open house"],
  ["Northgate signage", "Northgate", "Install"],
  ["Northgate upkeep", "Northgate", null],
  ["Hollow Lane spring menu", "Hollow Lane", "Launch"],
  ["Hollow Lane tasting", "Hollow Lane", "Tasting"],
  ["Hollow Lane hiring", "Hollow Lane", null],
  ["Hollow Lane patio", "Hollow Lane", "Opens"],
  ["O'Brien & Shaw", "The Orchard", "Wedding"],
  ["Quinn christening", "The Orchard", "Party"],
  ["Burren walking guide", "Brightwater", "Print"],
  ["Lough Ree regatta", "Brightwater", "Race day"],
  ["Christmas markets 2027", "The Orchard", null],
];

const WORRIES = [
  "Supplier quote has moved twice",
  "Artwork sign-off is 8 days late",
  "More was added than finished in 3 of the last 4 weeks",
  "Venue access date moved to later",
  "Print proofs are waiting on the client",
  "Two people are away next week",
];
const NOTES = [
  "Pace dipped over the last two weeks",
  "5 things have no owner",
  "Deposit reminder is due Monday",
];

function makeMany(): Project[] {
  const r = rng(2027);
  const extra = MANY_NAMES.map(([name, client, label], i): Project => {
    const noTasks = name === "Christmas markets 2027";
    const start = noTasks ? THIS_WEEK : Math.floor(r() * 18);
    const pace = 3 + Math.round(r() * 12);
    const inflow = Math.max(1, Math.round(pace * (0.2 + r() * 0.5)));
    const open = noTasks ? 0 : Math.round(pace * (1.2 + r() * 4));
    const roll = r();
    const spec: Spec = {
      id: `m${i}`,
      name,
      client,
      hue: 1 + (i % 8),
      initials: name
        .split(/[\s&']+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase(),
      dateLabel: label,
      bigDate: null,
      start,
      seed: 300 + i,
      pace: noTasks ? 0 : pace,
      inflow: noTasks ? 0 : inflow,
      open,
      lateShare: r() * 0.3,
      late: noTasks ? 0 : Math.round(r() * 6),
      oldestLate: noTasks ? 0 : Math.round(r() * 12),
      usualDays: 3 + Math.round(r() * 9),
      unowned: noTasks ? 0 : Math.round(r() * 6),
      dateMoves: roll < 0.2 ? 1 : 0,
      people: noTasks
        ? []
        : [
            { name: "Aoife", open: Math.round(open * 0.6) },
            { name: "Ronan", open: Math.round(open * 0.4) },
          ],
      issues: noTasks
        ? []
        : [
            {
              text:
                roll < 0.2
                  ? WORRIES[i % WORRIES.length]
                  : NOTES[i % NOTES.length],
              tone: roll < 0.2 ? "danger" : "warning",
            },
          ],
    };
    const p = build(spec);
    if (noTasks) {
      p.finished.fill(0);
      p.added.fill(0);
      p.finishedLate.fill(0);
      return p;
    }
    if (label) {
      // Set each big date against its own likely finish, so the wall shows a
      // believable mix: most with room, some tight, a few behind.
      const from = Math.max(start + 1, THIS_WEEK - 6);
      let net = 0;
      for (let w = from; w < THIS_WEEK; w++) net += p.finished[w] - p.added[w];
      net /= Math.max(1, THIS_WEEK - from);
      const ready = net > 0.5 ? Math.ceil((open / net) * 7) : 40;
      const offset =
        roll < 0.2
          ? -2 - Math.round(r() * 7)
          : roll < 0.4
            ? Math.round(r() * 2)
            : 4 + Math.round(r() * 18);
      p.bigDate = Math.max(6, ready + offset);
    }
    return p;
  });
  return [...PROJECTS, ...extra];
}

export type Scenario = "normal" | "single" | "many";

export function projectsFor(s: Scenario): Project[] {
  if (s === "single") return PROJECTS.filter((p) => p.id === "mara");
  if (s === "many") return makeMany();
  return PROJECTS;
}
