/**
 * Sample data for "Flow and friction". Every age, sparkline and in/out
 * number on the page is computed from each card's stage history below;
 * nothing is hard-coded. Days are counted relative to today
 * (Friday 25 September 2026 = day 0, yesterday = -1).
 */

export type StageKey = "todo" | "doing" | "waiting" | "review" | "done";

export type Stage = {
  key: StageKey;
  name: string;
  /** Verb used when work leaves this stage ("3 moved on", "1 approved"). */
  leaveVerb: string;
  /** Used when history is too thin to learn a usual time. */
  fallbackUsual: number;
  empty: string;
};

export const STAGES: Stage[] = [
  { key: "todo", name: "To do", leaveVerb: "started", fallbackUsual: 5, empty: "Nothing queued up." },
  { key: "doing", name: "In progress", leaveVerb: "moved on", fallbackUsual: 4, empty: "No one is working on anything here." },
  { key: "waiting", name: "Waiting", leaveVerb: "unblocked", fallbackUsual: 3, empty: "Nothing is waiting on anyone." },
  { key: "review", name: "Review", leaveVerb: "approved", fallbackUsual: 3, empty: "Nothing waiting for sign-off." },
  { key: "done", name: "Done", leaveVerb: "", fallbackUsual: 0, empty: "Finished work lands here." },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, Stage>;

export type Person = { id: string; first: string; full: string; role: string; tone: number };

export type Move = { stage: StageKey; day: number };

export type Card = {
  id: string;
  title: string;
  owner: string;
  history: Move[];
  /** Who has to sign it off while it sits in Review. */
  approver?: string;
  /** Present while the card sits in Waiting. */
  blocker?: { who: string; since: number };
  note?: string;
};

export type Project = {
  id: string;
  name: string;
  team: string;
  tone: number;
  people: Person[];
  cards: Card[];
  /** Day the project was created: a brand new project has no history. */
  created: number;
};

const h = (...moves: [StageKey, number][]): Move[] => moves.map(([stage, day]) => ({ stage, day }));

const NORTHLIGHT: Person[] = [
  { id: "nia", first: "Nia", full: "Nia Okafor", role: "Design lead", tone: 8 },
  { id: "tom", first: "Tom", full: "Tom Reilly", role: "Words", tone: 3 },
  { id: "priya", first: "Priya", full: "Priya Nair", role: "Web and social", tone: 2 },
  { id: "luca", first: "Luca", full: "Luca Moretti", role: "Print and production", tone: 5 },
  { id: "orla", first: "Orla", full: "Orla Byrne", role: "Marketing, The Orchard", tone: 6 },
];

const REBRAND: Project = {
  id: "rebrand",
  name: "The Orchard rebrand",
  team: "Northlight Studio",
  tone: 1,
  people: NORTHLIGHT,
  created: -30,
  cards: [
    // To do
    { id: "t1", title: "Autumn menu photography brief", owner: "tom", history: h(["todo", -19]), note: "Needs the final menu from the kitchen before the brief can go out." },
    { id: "t2", title: "Gift voucher design", owner: "nia", history: h(["todo", -8]) },
    { id: "t3", title: "Favicon and app icons", owner: "priya", history: h(["todo", -4]) },
    { id: "t4", title: "Wine list typography", owner: "nia", history: h(["todo", -2]) },
    { id: "t5", title: "Launch press release", owner: "tom", history: h(["todo", -3]) },
    { id: "t6", title: "Social ad variants", owner: "priya", history: h(["todo", -2]) },
    { id: "t7", title: "Gate banner for the car park", owner: "luca", history: h(["todo", -1]) },
    { id: "t8", title: "Update Google profile photos", owner: "priya", history: h(["todo", 0]) },
    // In progress
    { id: "d1", title: "Staff uniform patches", owner: "luca", history: h(["todo", -12], ["doing", -4]) },
    { id: "d2", title: "Tone of voice one-pager", owner: "tom", history: h(["todo", -11], ["doing", -3]) },
    { id: "d3", title: "Brand guidelines PDF", owner: "nia", history: h(["todo", -14], ["doing", -3]) },
    { id: "d4", title: "Instagram launch grid", owner: "priya", history: h(["todo", -8], ["doing", -2]) },
    { id: "d5", title: "Email newsletter template", owner: "priya", history: h(["todo", -6], ["doing", -1]) },
    // Waiting
    {
      id: "w1",
      title: "Printer proof from Clarke's",
      owner: "luca",
      history: h(["todo", -13], ["doing", -8], ["waiting", -3]),
      blocker: { who: "Clarke's Print", since: -3 },
      note: "Proof for the menu cards and the signage set, 350gsm uncoated.",
    },
    {
      id: "w2",
      title: "Florist styling shots",
      owner: "nia",
      history: h(["todo", -18], ["doing", -14], ["waiting", -10]),
      blocker: { who: "Bloom and Wild", since: -10 },
    },
    // Review: the bottleneck, all waiting on Orla
    { id: "r1", title: "Logo lockups round 3", owner: "nia", approver: "orla", history: h(["todo", -20], ["doing", -15], ["review", -9]), note: "Stacked, horizontal and monogram versions, with the orchard leaf." },
    { id: "r2", title: "Menu card layout", owner: "nia", approver: "orla", history: h(["todo", -15], ["doing", -11], ["review", -6]) },
    { id: "r3", title: "Signage wayfinding set", owner: "luca", approver: "orla", history: h(["todo", -17], ["doing", -13], ["review", -9], ["doing", -8], ["review", -5]), note: "Orla asked for bigger arrows on the car park signs." },
    { id: "r4", title: "Website hero photo selects", owner: "priya", approver: "orla", history: h(["todo", -12], ["doing", -7], ["review", -4]) },
    { id: "r5", title: "Wedding brochure copy", owner: "tom", approver: "orla", history: h(["todo", -10], ["doing", -6], ["review", -3]) },
    // Done
    { id: "x1", title: "Colour palette final", owner: "nia", approver: "orla", history: h(["todo", -19], ["doing", -14], ["review", -7], ["done", -2]) },
    { id: "x2", title: "Moodboard sign-off", owner: "nia", approver: "orla", history: h(["todo", -24], ["doing", -19], ["review", -14], ["done", -11]) },
    { id: "x3", title: "Typeface licence", owner: "priya", approver: "orla", history: h(["todo", -20], ["doing", -16], ["review", -12], ["done", -10]) },
    { id: "x4", title: "Business card design", owner: "nia", approver: "orla", history: h(["todo", -26], ["doing", -20], ["review", -17], ["done", -14]) },
    { id: "x5", title: "Brand workshop notes", owner: "tom", history: h(["todo", -22], ["doing", -18], ["done", -13]) },
    { id: "x6", title: "Wi-fi password card", owner: "luca", history: h(["todo", -9], ["doing", -3], ["done", -1]) },
    { id: "x7", title: "Stationery templates", owner: "nia", approver: "orla", history: h(["todo", -21], ["doing", -17], ["review", -15], ["done", -12]) },
  ],
};

const VENUE_TEAM: Person[] = [
  { id: "orla", first: "Orla", full: "Orla Byrne", role: "Marketing", tone: 6 },
  { id: "sean", first: "Sean", full: "Sean Doyle", role: "Events manager", tone: 4 },
  { id: "aoife", first: "Aoife", full: "Aoife Kelly", role: "Front of house", tone: 7 },
  { id: "dara", first: "Dara", full: "Dara Quinn", role: "Head chef", tone: 3 },
];

const VENUE: Project = {
  id: "venue",
  name: "The Orchard venue",
  team: "The Orchard",
  tone: 4,
  people: VENUE_TEAM,
  created: -40,
  cards: [
    { id: "v1", title: "Confirm marquee sides with the hire company", owner: "sean", history: h(["todo", -1]) },
    { id: "v2", title: "Reprint the welcome sign", owner: "aoife", history: h(["todo", -1]) },
    { id: "v13", title: "Book the October open evening", owner: "orla", history: h(["todo", 0]) },
    { id: "v3", title: "Test the festoon lights on the terrace", owner: "sean", history: h(["todo", -4], ["doing", -1]) },
    { id: "v4", title: "Book an extra cloakroom attendant", owner: "aoife", history: h(["todo", -5], ["doing", -2]) },
    { id: "v5", title: "Chase the florist deposit", owner: "orla", history: h(["todo", -3], ["waiting", -1]), blocker: { who: "Bloom and Wild", since: -1 } },
    { id: "v6", title: "Approve the final seating plan", owner: "sean", approver: "orla", history: h(["todo", -6], ["doing", -3], ["review", -1]) },
    { id: "v7", title: "Menu tasting for the Walsh wedding", owner: "dara", approver: "orla", history: h(["todo", -5], ["doing", -2], ["review", 0]) },
    { id: "v8", title: "Order tonic and the good olives", owner: "dara", history: h(["todo", -6], ["doing", -4], ["done", -2]) },
    { id: "v9", title: "Saturday run-sheet", owner: "sean", approver: "orla", history: h(["todo", -9], ["doing", -7], ["review", -5], ["done", -3]) },
    { id: "v10", title: "Wet-weather plan for the drinks reception", owner: "sean", approver: "orla", history: h(["todo", -12], ["doing", -10], ["review", -8], ["done", -6]) },
    { id: "v11", title: "Sound check with the band", owner: "aoife", history: h(["todo", -4], ["doing", -3], ["done", -1]) },
    { id: "v12", title: "Staff rota for October", owner: "aoife", approver: "orla", history: h(["todo", -13], ["doing", -11], ["review", -9], ["done", -7]) },
    { id: "v14", title: "Fix the courtyard gate latch", owner: "sean", history: h(["todo", -10], ["doing", -8], ["done", -6]) },
  ],
};

const NEW_PROJECT: Project = {
  id: "christmas",
  name: "Christmas parties 2026",
  team: "The Orchard",
  tone: 7,
  people: VENUE_TEAM,
  created: 0,
  cards: [
    { id: "n1", title: "Draft the party packages", owner: "orla", history: h(["todo", 0]) },
    { id: "n2", title: "Price the festive menu", owner: "dara", history: h(["todo", 0]) },
    { id: "n3", title: "Photograph the dressed barn", owner: "aoife", history: h(["todo", 0]) },
    { id: "n4", title: "Set up the enquiry form", owner: "sean", history: h(["todo", 0]) },
  ],
};

export const PROJECTS: Project[] = [REBRAND, VENUE, NEW_PROJECT];

/** Friday 25 September 2026. */
const TODAY_Y = 2026;
const TODAY_M = 8; // zero-based: September
const TODAY_D = 25;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateFor(day: number) {
  return new Date(Date.UTC(TODAY_Y, TODAY_M, TODAY_D + day));
}

/** "Tue" within the last week, "Tue 15 Sep" beyond it. */
export function dayLabel(day: number, opts: { long?: boolean } = {}) {
  if (day === 0) return "today";
  if (day === -1) return "yesterday";
  const d = dateFor(day);
  const wd = WEEKDAYS[d.getUTCDay()];
  if (!opts.long && day > -7) return wd;
  return `${wd} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function shortDate(day: number) {
  const d = dateFor(day);
  return { weekday: WEEKDAYS[d.getUTCDay()], date: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
}
