/*
 * Sample data for the "Will we make it" concept. Invented, but built the way
 * the real thing would be: a daily record of how many things were left, how
 * many got finished and how many new ones arrived.
 */
import { dayOf, mulberry32, type DayRecord, type LeverEffect } from "./model";

export const TODAY = dayOf("2026-09-25");

export type Person = { name: string; initials: string; tone: number };

export type Lever = {
  id: string;
  /** The action, said plainly. */
  title: string;
  /** What it involves, in one line. */
  detail: string;
  effect: LeverEffect;
};

export type RiskTone = "danger" | "warning" | "neutral";

export type Risk = {
  id: string;
  title: string;
  owner: Person;
  tag: string;
  tone: RiskTone;
  reason: string;
  story: { date: string; text: string }[];
};

export type Milestone = { day: number; label: string };
export type Burst = { day: number; label: string };

export type Situation = "forecast" | "no-date" | "too-early" | "done" | "passed" | "moving";

export type Project = {
  id: string;
  name: string;
  /** What the big date is, as a noun: "the wedding", "the launch". */
  occasion: string;
  /** Short label for the date rule on the chart. */
  dateLabel: string;
  bigDate: number | null;
  tone: number;
  initials: string;
  situation: Situation;
  history: DayRecord[];
  wobble: number;
  levers: Lever[];
  risks: Risk[];
  milestones: Milestone[];
  bursts: Burst[];
  team: number;
};

type GenSpec = {
  seed: number;
  first: number;
  last: number;
  /** Things finished each week, oldest first. */
  weekly: number[];
  /** Background new things per week: one figure, or one per week. */
  trickle: number | number[];
  bursts: { day: number; n: number }[];
  remaining: number;
};

const WEEKDAY_WEIGHT = [0.35, 1, 1, 1.05, 1.1, 1, 0.55];

/** Builds a believable day-by-day record that ends exactly on `remaining`. */
function generate(spec: GenSpec): DayRecord[] {
  const rand = mulberry32(spec.seed);
  const n = spec.last - spec.first + 1;
  const finished = new Array<number>(n).fill(0);
  const added = new Array<number>(n).fill(0);

  for (let w = 0; w * 7 < n; w++) {
    const target = spec.weekly[Math.min(w, spec.weekly.length - 1)];
    const idx: number[] = [];
    for (let d = w * 7; d < Math.min(n, w * 7 + 7); d++) idx.push(d);
    const weights = idx.map((d) => WEEKDAY_WEIGHT[new Date((spec.first + d) * 86_400_000).getUTCDay()]);
    const total = weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < Math.round((target * idx.length) / 7); k++) {
      let pick = rand() * total;
      for (let j = 0; j < idx.length; j++) {
        pick -= weights[j];
        if (pick <= 0) {
          finished[idx[j]] += 1;
          break;
        }
      }
    }
    const base = Array.isArray(spec.trickle) ? spec.trickle[Math.min(w, spec.trickle.length - 1)] : spec.trickle;
    const trickle = Math.round(base * (0.6 + rand() * 0.8) * (idx.length / 7));
    for (let k = 0; k < trickle; k++) added[idx[Math.floor(rand() * idx.length)]] += 1;
  }
  for (const b of spec.bursts) {
    const i = b.day - spec.first;
    if (i < 0 || i >= n) continue;
    const first = Math.ceil(b.n * 0.65);
    added[i] += first;
    if (i + 1 < n) added[i + 1] += b.n - first;
    else added[i] += b.n - first;
  }

  const out: DayRecord[] = new Array(n);
  let left = spec.remaining;
  for (let i = n - 1; i >= 0; i--) {
    out[i] = { day: spec.first + i, remaining: left, finished: finished[i], added: added[i] };
    left = left + finished[i] - added[i];
  }
  return out;
}

/** Ongoing work never dips below zero: take the first seed that stays above it. */
function steady(spec: GenSpec): DayRecord[] {
  for (let k = 0; k < 400; k++) {
    const h = generate({ ...spec, seed: spec.seed + k });
    if (h.every((r) => r.remaining >= 0) && h[0].remaining <= 12) return h;
  }
  return generate(spec);
}

const P = {
  niamh: { name: "Niamh Kelly", initials: "NK", tone: 1 },
  ciaran: { name: "Ciarán Doyle", initials: "CD", tone: 3 },
  aisling: { name: "Aisling Byrne", initials: "AB", tone: 8 },
  tom: { name: "Tom Walsh", initials: "TW", tone: 5 },
  sade: { name: "Sade Okafor", initials: "SO", tone: 2 },
  lena: { name: "Lena Fischer", initials: "LF", tone: 4 },
  dara: { name: "Dara Quinn", initials: "DQ", tone: 6 },
} satisfies Record<string, Person>;

const START = TODAY - 98;

const mara: Project = {
  id: "mara",
  name: "Mara & Finn",
  occasion: "the wedding",
  dateLabel: "Wedding",
  bigDate: dayOf("2026-10-17"),
  tone: 8,
  initials: "MF",
  situation: "forecast",
  wobble: 0.11,
  team: 4,
  history: generate({
    seed: 17,
    first: START,
    last: TODAY,
    weekly: [6, 7, 8, 7, 6, 9, 8, 10, 7, 9, 10, 17, 19, 20, 21],
    trickle: [2, 2, 2, 3, 2, 2, 2, 2, 3, 2, 2, 1, 1, 1],
    bursts: [
      { day: dayOf("2026-07-22"), n: 18 },
      { day: dayOf("2026-08-27"), n: 9 },
    ],
    remaining: 41,
  }),
  bursts: [
    { day: dayOf("2026-07-22"), label: "Guest list" },
    { day: dayOf("2026-08-27"), label: "Menu change" },
  ],
  milestones: [
    { day: dayOf("2026-07-10"), label: "Invitations sent" },
    { day: dayOf("2026-09-20"), label: "Final numbers" },
    { day: dayOf("2026-10-10"), label: "Walk-through" },
  ],
  levers: [
    {
      id: "nice",
      title: "Drop the photo booth and 2 other nice-to-haves",
      detail: "Photo booth, sparkler send-off and the late pizza van: 11 things off the list.",
      effect: { remove: 11 },
    },
    {
      id: "suppliers",
      title: "Finish the 4 supplier confirmations this week",
      detail: "Florist, bus, band and cake. Six other things are waiting on them.",
      effect: { remove: 4, pace: 1.06 },
    },
    {
      id: "aisling",
      title: "Add Aisling for 2 days a week",
      detail: "She ran the Keane wedding in June and knows the suppliers.",
      effect: { pace: 1.26 },
    },
    {
      id: "adding",
      title: "Keep adding new things at this month's pace",
      detail: "About 4 new things a week have arrived since the menu change.",
      effect: { addPerDay: 0.65 },
    },
  ],
  risks: [
    {
      id: "florist",
      title: "Confirm the florist's final order",
      owner: P.niamh,
      tag: "Waiting on Harbour Florals",
      tone: "warning",
      reason: "Two reminders since 11 Sep and no reply. Table settings can't be set until it lands.",
      story: [
        { date: "4 Sep", text: "Quote accepted, final order requested" },
        { date: "11 Sep", text: "First reminder sent" },
        { date: "19 Sep", text: "Second reminder sent" },
      ],
    },
    {
      id: "seating",
      title: "Seating plan, first draft",
      owner: P.aisling,
      tag: "Moved 4 times",
      tone: "neutral",
      reason: "It keeps slipping behind final numbers. Now due 2 Oct, a fortnight before the day.",
      story: [
        { date: "28 Aug", text: "Due date moved to 5 Sep" },
        { date: "4 Sep", text: "Moved to 14 Sep" },
        { date: "13 Sep", text: "Moved to 24 Sep" },
        { date: "23 Sep", text: "Moved to 2 Oct" },
      ],
    },
    {
      id: "bus",
      title: "Book the late bus back to Kilkenny",
      owner: P.ciaran,
      tag: "3 days late",
      tone: "danger",
      reason: "Only two coach firms still have a driver free on 17 Oct.",
      story: [
        { date: "8 Sep", text: "Added after final numbers came in" },
        { date: "22 Sep", text: "Was due, still open" },
      ],
    },
  ],
};

const hollis: Project = {
  id: "hollis",
  name: "Hollis Café launch",
  occasion: "the launch",
  dateLabel: "Launch",
  bigDate: dayOf("2026-11-02"),
  tone: 5,
  initials: "HC",
  situation: "forecast",
  wobble: 0.1,
  team: 3,
  history: generate({
    seed: 404,
    first: START,
    last: TODAY,
    weekly: [4, 5, 6, 6, 7, 5, 8, 7, 8, 9, 8, 10, 10, 10, 14],
    trickle: [2, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2, 1, 1, 1],
    bursts: [
      { day: dayOf("2026-08-05"), n: 14 },
      { day: dayOf("2026-09-03"), n: 7 },
    ],
    remaining: 58,
  }),
  bursts: [
    { day: dayOf("2026-08-05"), label: "Fit-out survey" },
    { day: dayOf("2026-09-03"), label: "Supplier switch" },
  ],
  milestones: [
    { day: dayOf("2026-07-14"), label: "Lease signed" },
    { day: dayOf("2026-08-24"), label: "Menu fixed" },
    { day: dayOf("2026-10-19"), label: "Soft opening" },
  ],
  levers: [
    {
      id: "loyalty",
      title: "Move the loyalty card work to after launch",
      detail: "Design, printing and the till set-up: 6 things that can wait a month.",
      effect: { remove: 6 },
    },
    {
      id: "tom",
      title: "Give Tom the fit-out list 3 days a week",
      detail: "He is free from 1 Oct once the Quay Street job wraps up.",
      effect: { pace: 1.13 },
    },
    {
      id: "boards",
      title: "Sign off the menu boards with the printer by Tuesday",
      detail: "Four things are waiting on the proof coming back.",
      effect: { remove: 2, pace: 1.02 },
    },
    {
      id: "landlord",
      title: "Take on the landlord's list of changes",
      detail: "About 8 new things if the snag list lands as expected.",
      effect: { remove: -8 },
    },
  ],
  risks: [
    {
      id: "gas",
      title: "Gas safety sign-off for the kitchen",
      owner: P.tom,
      tag: "Waiting on the inspector",
      tone: "warning",
      reason: "No date offered yet. The kitchen can't open without it.",
      story: [
        { date: "10 Sep", text: "Inspection requested" },
        { date: "21 Sep", text: "Chased by phone" },
      ],
    },
    {
      id: "coffee",
      title: "Espresso machine delivery",
      owner: P.sade,
      tag: "Moved 3 times",
      tone: "neutral",
      reason: "The supplier keeps pushing it back. Staff training depends on it.",
      story: [
        { date: "2 Sep", text: "Moved to 16 Sep" },
        { date: "15 Sep", text: "Moved to 29 Sep" },
        { date: "24 Sep", text: "Moved to 7 Oct" },
      ],
    },
    {
      id: "hire",
      title: "Hire two weekend baristas",
      owner: P.sade,
      tag: "5 days late",
      tone: "danger",
      reason: "Adverts are out but no trials booked. Weekends open from day one.",
      story: [{ date: "20 Sep", text: "Was due, still open" }],
    },
  ],
};

const riverside: Project = {
  id: "riverside",
  name: "Riverside survey",
  occasion: "hand-in",
  dateLabel: "Hand-in",
  bigDate: dayOf("2026-12-04"),
  tone: 3,
  initials: "RS",
  situation: "forecast",
  wobble: 0.12,
  team: 2,
  history: generate({
    seed: 88,
    first: START,
    last: TODAY,
    weekly: [3, 4, 4, 2, 5, 5, 6, 4, 5, 6, 5, 6, 6, 7],
    trickle: 0.8,
    bursts: [{ day: dayOf("2026-08-18"), n: 10 }],
    remaining: 26,
  }),
  bursts: [{ day: dayOf("2026-08-18"), label: "Second site added" }],
  milestones: [
    { day: dayOf("2026-07-03"), label: "Ethics approved" },
    { day: dayOf("2026-09-11"), label: "Field work done" },
    { day: dayOf("2026-11-13"), label: "Draft to tutor" },
  ],
  levers: [
    {
      id: "merge",
      title: "Write the two site reports as one chapter",
      detail: "Your tutor suggested it on 15 Sep: 4 things become 1.",
      effect: { remove: 3 },
    },
    {
      id: "lab",
      title: "Book the lab on Tuesdays as well",
      detail: "Sample processing is the slowest step right now.",
      effect: { pace: 1.2 },
    },
    {
      id: "extra",
      title: "Add the extra water samples",
      detail: "Nice to have for the discussion: about 6 more things.",
      effect: { remove: -6 },
    },
  ],
  risks: [
    {
      id: "samples",
      title: "Process the Glen sediment samples",
      owner: P.lena,
      tag: "Waiting on the lab",
      tone: "warning",
      reason: "The lab has a two-week queue. Chapter 4 needs the results.",
      story: [{ date: "16 Sep", text: "Samples dropped off" }],
    },
    {
      id: "maps",
      title: "Redraw the site maps",
      owner: P.dara,
      tag: "Moved twice",
      tone: "neutral",
      reason: "Pushed back for field work. Small, but everything cites them.",
      story: [
        { date: "5 Sep", text: "Moved to 19 Sep" },
        { date: "18 Sep", text: "Moved to 3 Oct" },
      ],
    },
    {
      id: "refs",
      title: "Tidy the references",
      owner: P.lena,
      tag: "Not started",
      tone: "neutral",
      reason: "Always takes longer than it looks. Better early than the night before.",
      story: [],
    },
  ],
};

const autumn: Project = {
  id: "autumn",
  name: "The Orchard autumn season",
  occasion: "the big date",
  dateLabel: "Big date",
  bigDate: null,
  tone: 4,
  initials: "OA",
  situation: "no-date",
  wobble: 0.12,
  team: 5,
  history: generate({
    seed: 9,
    first: START,
    last: TODAY,
    weekly: [5, 6, 5, 7, 6, 6, 8, 7, 7, 8, 7, 8, 9, 8],
    trickle: 3.4,
    bursts: [{ day: dayOf("2026-08-12"), n: 12 }],
    remaining: 34,
  }),
  bursts: [{ day: dayOf("2026-08-12"), label: "Harvest supper added" }],
  milestones: [{ day: dayOf("2026-09-01"), label: "Autumn menu live" }],
  levers: [
    {
      id: "supper",
      title: "Run the harvest supper next year instead",
      detail: "12 things come off the list this season.",
      effect: { remove: 12 },
    },
    {
      id: "hands",
      title: "Bring Dara in on Fridays",
      detail: "Mostly supplier calls and set-up lists.",
      effect: { pace: 1.18 },
    },
  ],
  risks: [
    {
      id: "heaters",
      title: "Service the patio heaters",
      owner: P.dara,
      tag: "Waiting on Coolmore Gas",
      tone: "warning",
      reason: "Evening bookings start 10 Oct and the heaters are needed from day one.",
      story: [{ date: "15 Sep", text: "Service booked, no date confirmed" }],
    },
    {
      id: "rota",
      title: "Autumn staff rota",
      owner: P.ciaran,
      tag: "Moved twice",
      tone: "neutral",
      reason: "Waiting on two people's college timetables.",
      story: [],
    },
    {
      id: "menu",
      title: "Price the new supper menu",
      owner: P.niamh,
      tag: "2 days late",
      tone: "danger",
      reason: "Bookings can't open until the price is set.",
      story: [],
    },
  ],
};

const popup: Project = {
  id: "popup",
  name: "Kilkenny pop-up",
  occasion: "opening night",
  dateLabel: "Opening",
  bigDate: dayOf("2026-11-14"),
  tone: 2,
  initials: "KP",
  situation: "too-early",
  wobble: 0.38,
  team: 2,
  history: generate({
    seed: 5,
    first: TODAY - 9,
    last: TODAY,
    weekly: [9, 10],
    trickle: 1.5,
    bursts: [],
    remaining: 44,
  }),
  bursts: [],
  milestones: [],
  levers: [],
  risks: [],
};

const party: Project = {
  id: "party",
  name: "Staff party",
  occasion: "the party",
  dateLabel: "Party",
  bigDate: dayOf("2026-10-03"),
  tone: 7,
  initials: "SP",
  situation: "done",
  wobble: 0.1,
  team: 3,
  history: (() => {
    const h = generate({
      seed: 31,
      first: TODAY - 70,
      last: TODAY - 1,
      weekly: [4, 5, 5, 6, 5, 7, 8, 9, 9, 11],
      trickle: 1,
      bursts: [{ day: TODAY - 44, n: 6 }],
      remaining: 0,
    });
    h.push({ day: TODAY, remaining: 0, finished: 0, added: 0 });
    return h;
  })(),
  bursts: [{ day: TODAY - 44, label: "Awards added" }],
  milestones: [{ day: TODAY - 30, label: "Venue booked" }],
  levers: [],
  risks: [],
};

const brochure: Project = {
  id: "brochure",
  name: "Autumn brochure",
  occasion: "print day",
  dateLabel: "Print day",
  bigDate: dayOf("2026-09-18"),
  tone: 6,
  initials: "AB",
  situation: "passed",
  wobble: 0.14,
  team: 2,
  history: generate({
    seed: 12,
    first: START,
    last: TODAY,
    weekly: [3, 4, 4, 5, 4, 5, 6, 5, 6, 7, 6, 5, 5, 6],
    trickle: [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 0.5, 0.5],
    bursts: [{ day: dayOf("2026-09-01"), n: 8 }],
    remaining: 6,
  }),
  bursts: [{ day: dayOf("2026-09-01"), label: "Late photo swap" }],
  milestones: [{ day: dayOf("2026-08-21"), label: "Copy signed off" }],
  levers: [
    {
      id: "photos",
      title: "Use last year's cover photo",
      detail: "The reshoot is 3 of the 6 things left.",
      effect: { remove: 3 },
    },
  ],
  risks: [
    {
      id: "proof",
      title: "Approve the printer's proof",
      owner: P.niamh,
      tag: "7 days late",
      tone: "danger",
      reason: "The printer is holding a slot for us until 30 Sep.",
      story: [],
    },
    {
      id: "reshoot",
      title: "Reshoot the cover",
      owner: P.sade,
      tag: "Waiting on the weather",
      tone: "warning",
      reason: "Needs a dry morning at the orchard.",
      story: [],
    },
    {
      id: "prices",
      title: "Check the 2027 prices",
      owner: P.ciaran,
      tag: "Moved twice",
      tone: "neutral",
      reason: "Waiting on the owners to agree next year's rates.",
      story: [],
    },
  ],
};

const care: Project = {
  id: "care",
  name: "Website care",
  occasion: "the finish",
  dateLabel: "Finish",
  bigDate: null,
  tone: 1,
  initials: "WC",
  situation: "moving",
  wobble: 0.1,
  team: 2,
  history: steady({
    seed: 77,
    first: START,
    last: TODAY,
    weekly: [6, 7, 7, 6, 8, 7, 7, 8, 6, 7, 8, 7, 7, 8],
    trickle: 7.2,
    bursts: [],
    remaining: 2,
  }),
  bursts: [],
  milestones: [],
  levers: [],
  risks: [],
};

export const PROJECTS: Project[] = [mara, hollis, riverside, autumn, popup, party, brochure, care];
