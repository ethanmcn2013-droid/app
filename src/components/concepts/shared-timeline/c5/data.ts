/* The Dispatch: sample worlds. Each world is one continuous story; a
   "moment" picks where "today" sits in it (and, for the quiet spell,
   which notes were never written). Everything here is invented. */

export type Iso = `${number}-${number}-${number}`;

export type WorldId = "class" | "wedding" | "launch";
export type MomentId = "first" | "live" | "quiet" | "moved" | "finished";

export type Author = {
  name: string;
  role: string;
  initials: string;
  /** 1 to 8: a --v3-project-n identity colour for the avatar. */
  tone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export type Art = "river" | "band" | "table" | "wheel" | "hall" | "post";

export type Figure =
  | { kind: "bar"; label: string; value: number; total: number; note?: string }
  | { kind: "art"; art: Art; caption: string }
  | { kind: "list"; label: string; items: string[] }
  | {
      kind: "recap";
      label: string;
      stats: { value: string; label: string }[];
      series?: { title: string; unit: string; note?: string; points: { label: string; value: number }[] };
    };

export type Attach =
  | { kind: "reached"; milestone: string }
  | { kind: "coming"; milestone: string }
  | { kind: "moved"; milestone: string; from: Iso; to: Iso };

export type Dispatch = {
  id: string;
  date: Iso;
  author: Author;
  headline: string;
  body: string[];
  figure?: Figure;
  attach?: Attach;
  /** How many people already said thank you (before this reader). */
  thanks: number;
  /** Written in some moments only. */
  onlyIn?: MomentId[];
  notIn?: MomentId[];
};

export type Milestone = {
  id: string;
  label: string;
  date: Iso;
  /** In the "moved" story this milestone had an earlier date. */
  movedFrom?: Iso;
  /** The day everything leads to. */
  final?: boolean;
};

export type World = {
  id: WorldId;
  pick: string;
  kicker: string;
  title: string;
  byline: string;
  sharer: string;
  audienceNoun: string;
  event: { title: string; when: string; where: string; start: string; end: string };
  milestones: Milestone[];
  dispatches: Dispatch[];
  moments: Record<MomentId, Iso>;
  status: (m: MomentId, ctx: { days: number; quietWeeks: number; eventLong: string; eventShort: string }) => string;
  firstIntro: string;
  finishedNote: string;
};

/* ── Dates ─────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayNum(d: Iso): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / 86_400_000);
}
export function fromDayNum(n: number): Iso {
  const d = new Date(n * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}` as Iso;
}
function parts(d: Iso) {
  const n = dayNum(d);
  const date = new Date(n * 86_400_000);
  return { day: date.getUTCDate(), month: date.getUTCMonth(), year: date.getUTCFullYear(), dow: date.getUTCDay() };
}
/** "29 Sep" */
export const short = (d: Iso) => {
  const p = parts(d);
  return `${p.day} ${MONTHS[p.month]}`;
};
/** "Thu 8 Oct" */
export const shortDow = (d: Iso) => {
  const p = parts(d);
  return `${DAYS[p.dow]} ${p.day} ${MONTHS[p.month]}`;
};
/** "Thursday 10 December" */
export const long = (d: Iso) => {
  const p = parts(d);
  return `${DAYS_LONG[p.dow]} ${p.day} ${MONTHS_LONG[p.month]}`;
};
export const weekday = (d: Iso) => DAYS_LONG[parts(d).dow];
export const monthDay = (d: Iso) => {
  const p = parts(d);
  return { day: p.day, month: MONTHS[p.month], year: p.year };
};
/** "10 December" */
export const dayMonthLong = (d: Iso) => {
  const p = parts(d);
  return `${p.day} ${MONTHS_LONG[p.month]}`;
};

export function relative(from: Iso, to: Iso): string {
  const n = dayNum(to) - dayNum(from);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1 && n < 14) return `in ${n} days`;
  if (n > 0) return `in ${Math.round(n / 7)} weeks`;
  if (n > -14) return `${-n} days ago`;
  return `${Math.round(-n / 7)} weeks ago`;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
export const inWords = (n: number) => WORDS[n] ?? String(n);

/* ── People ────────────────────────────────────────────────────────── */

const byrne: Author = { name: "Ms Byrne", role: "Geography teacher", initials: "SB", tone: 3 };
const aoife: Author = { name: "Aoife", role: "Group 2, 5th Year", initials: "A", tone: 8 };
const cian: Author = { name: "Cian", role: "Group 4, 5th Year", initials: "C", tone: 2 };
const mara: Author = { name: "Mara", role: "One half of the couple", initials: "M", tone: 8 };
const finn: Author = { name: "Finn", role: "The other half", initials: "F", tone: 2 };
const both: Author = { name: "Mara & Finn", role: "The couple", initials: "M&F", tone: 1 };
const niamh: Author = { name: "Niamh Walsh", role: "Director, Northlight", initials: "NW", tone: 5 };
const tomas: Author = { name: "Tomás Reilly", role: "Lead engineer, Northlight", initials: "TR", tone: 3 };

/* ── World 1: the field study ──────────────────────────────────────── */

const fieldStudy: World = {
  id: "class",
  pick: "Field study",
  kicker: "St Brigid's College · 5th Year geography",
  title: "The River Dargle field study",
  byline: "Updates from Ms Byrne and the 5th Year geography group",
  sharer: "Ms Byrne",
  audienceNoun: "parents",
  event: {
    title: "Exhibition evening",
    when: "Thursday 10 December, 7pm",
    where: "The school hall, St Brigid's College",
    start: "20261210T190000",
    end: "20261210T210000",
  },
  milestones: [
    { id: "groups", label: "Groups formed", date: "2026-09-12" },
    { id: "slips", label: "Permission slips in", date: "2026-09-18" },
    { id: "field", label: "River Dargle field day", date: "2026-10-08" },
    { id: "data", label: "Data in", date: "2026-11-13" },
    { id: "posters", label: "Posters printed", date: "2026-12-05", movedFrom: "2026-12-03" },
    { id: "evening", label: "Exhibition evening", date: "2026-12-10", final: true },
  ],
  moments: {
    first: "2026-09-14",
    live: "2026-09-29",
    quiet: "2026-10-23",
    moved: "2026-11-17",
    finished: "2026-12-11",
  },
  firstIntro:
    "This is where updates about the field study will appear. The first one is below.",
  finishedNote: "The exhibition happened. Thank you for coming.",
  status: (m, c) => {
    if (m === "finished") return `The exhibition happened on ${c.eventLong}. Thank you for coming.`;
    if (m === "quiet") return `No news for ${inWords(c.quietWeeks)} weeks, still on track for ${c.eventShort}`;
    if (m === "moved") return `Still on for ${c.eventLong} · ${c.days} days to go · one small date moved`;
    return `On track for ${c.eventLong} · ${c.days} days to go`;
  },
  dispatches: [
    {
      id: "c1",
      date: "2026-09-12",
      author: byrne,
      headline: "Groups are formed",
      body: [
        "Twenty-four students, six groups of four. Each group has chosen a stretch of the Dargle between Enniskerry and Bray, and each will ask one question about it: how wide it is, how fast it runs, what lives there.",
        "I'll write here every couple of weeks so you know what's happening without having to ask at the dinner table. The students will write some of these too.",
      ],
      attach: { kind: "reached", milestone: "Groups formed" },
      thanks: 19,
    },
    {
      id: "c2",
      date: "2026-09-26",
      author: aoife,
      headline: "Our first measurements",
      body: [
        "We measured river width at 6 sites on Saturday with a 30 metre tape and a lot of shouting across the water. The narrowest point was 4.2 metres, just under the bridge at Enniskerry.",
        "Group 2 is timing the water speed with an orange and a stopwatch, which works better than it sounds. We have about a fifth of our readings done.",
      ],
      figure: {
        kind: "bar",
        label: "Measurements gathered",
        value: 84,
        total: 400,
        note: "Every group needs 66 readings before 13 November.",
      },
      thanks: 23,
    },
    {
      id: "c3",
      date: "2026-09-29",
      author: byrne,
      headline: "Field day is next Thursday",
      body: [
        "On Thursday 8 October the whole group spends the day on the river. The bus leaves the front gate at 9am and we're back by 3.30pm, in time for the usual pick-up.",
        "It will almost certainly rain. Please pack the things below, and don't send anything you'd mind getting muddy.",
      ],
      figure: {
        kind: "list",
        label: "What to pack",
        items: ["Wellies or old runners", "A packed lunch and a drink", "A rain jacket", "A change of socks in a plastic bag"],
      },
      attach: { kind: "coming", milestone: "River Dargle field day" },
      thanks: 31,
    },
    {
      id: "c4",
      date: "2026-10-09",
      author: byrne,
      headline: "A wet, brilliant day on the Dargle",
      body: [
        "Everyone came back soaked and in good form. Every group got its readings, and Group 5 found a heron that stayed long enough to be counted.",
        "The photos are going up on the classroom wall, and a few will make it onto the posters in December.",
      ],
      figure: { kind: "art", art: "river", caption: "Group 3 measuring depth below the Enniskerry bridge." },
      attach: { kind: "reached", milestone: "River Dargle field day" },
      thanks: 42,
      notIn: ["quiet"],
    },
    {
      id: "c5",
      date: "2026-11-02",
      author: cian,
      headline: "Nearly there with the data",
      body: [
        "We're past three quarters. Most of what's left is the water speed readings from the last two sites, which we'll do after school on Wednesday if it isn't flooded.",
        "Then comes the good bit: turning 400 numbers into something people can understand from across a room.",
      ],
      figure: { kind: "bar", label: "Measurements gathered", value: 312, total: 400 },
      thanks: 17,
    },
    {
      id: "c6",
      date: "2026-11-16",
      author: byrne,
      headline: "Posters will be printed two days later",
      body: [
        "The print shop in Bray is swamped with Christmas orders, so our posters will be ready on Saturday 5 December rather than Thursday the 3rd.",
        "That still gives us five days to hang them. The exhibition evening doesn't move, and the data all came in on time.",
      ],
      attach: { kind: "moved", milestone: "Posters printed", from: "2026-12-03", to: "2026-12-05" },
      thanks: 12,
    },
    {
      id: "c7",
      date: "2026-12-11",
      author: byrne,
      headline: "The exhibition happened. Thank you for coming.",
      body: [
        "Last night 118 of you walked round six posters and asked the questions the students had spent three months getting ready for. Several of them told me it was the best part.",
        "Here is what the river looked like when it was all added up. The posters stay in the hall until the Christmas break if you missed it.",
      ],
      figure: {
        kind: "recap",
        label: "The field study, added up",
        stats: [
          { value: "400", label: "measurements" },
          { value: "6", label: "sites on the river" },
          { value: "118", label: "people came" },
        ],
        series: {
          title: "River width at our six sites",
          unit: "m",
          note: "The Dargle more than triples in width on its way from Enniskerry to the sea.",
          points: [
            { label: "Enniskerry", value: 4.2 },
            { label: "Knocksink", value: 5.8 },
            { label: "Tinnehinch", value: 7.1 },
            { label: "Kilcroney", value: 8.4 },
            { label: "Old Connaught", value: 9.6 },
            { label: "Bray harbour", value: 14.3 },
          ],
        },
      },
      attach: { kind: "reached", milestone: "Exhibition evening" },
      thanks: 64,
    },
  ],
};

/* ── World 2: the wedding ──────────────────────────────────────────── */

const wedding: World = {
  id: "wedding",
  pick: "Wedding",
  kicker: "Letters to family · The Orchard, Co. Wicklow",
  title: "Mara & Finn",
  byline: "Updates from Mara and Finn on the way to the wedding",
  sharer: "Mara",
  audienceNoun: "family",
  event: {
    title: "The wedding",
    when: "Saturday 5 June 2027, 2pm",
    where: "The Orchard, Ashford, Co. Wicklow",
    start: "20270605T140000",
    end: "20270606T010000",
  },
  milestones: [
    { id: "venue", label: "Venue booked", date: "2026-08-02" },
    { id: "band", label: "Band booked", date: "2026-09-14" },
    { id: "menu", label: "Menu chosen", date: "2026-09-26" },
    { id: "invites", label: "Invitations posted", date: "2026-10-16" },
    { id: "rsvp", label: "Replies close", date: "2027-03-01" },
    { id: "rehearsal", label: "Rehearsal dinner", date: "2027-06-04", movedFrom: "2027-06-03" },
    { id: "day", label: "The wedding", date: "2027-06-05", final: true },
  ],
  moments: {
    first: "2026-08-04",
    live: "2026-09-29",
    quiet: "2026-10-27",
    moved: "2027-03-10",
    finished: "2027-06-07",
  },
  firstIntro: "This is where we'll share news on the way to the wedding. The first letter is below.",
  finishedNote: "We're married. Thank you for every part of it.",
  status: (m, c) => {
    if (m === "finished") return `We got married on ${c.eventLong}. Thank you.`;
    if (m === "quiet") return `No news for ${inWords(c.quietWeeks)} weeks, still on for ${c.eventShort}`;
    if (m === "moved") return `All on for ${c.eventLong} · ${c.days} days to go · one small date moved`;
    return `All on track for ${c.eventLong} · ${c.days} days to go`;
  },
  dispatches: [
    {
      id: "w1",
      date: "2026-08-02",
      author: both,
      headline: "We've booked The Orchard",
      body: [
        "It's official: Saturday 5 June next year, in the old apple barn at The Orchard in Ashford. Granny Kath has already asked if there will be cider. There will be cider.",
        "We'll write here now and then so nobody has to keep track of it all in the family group chat.",
      ],
      attach: { kind: "reached", milestone: "Venue booked" },
      thanks: 38,
    },
    {
      id: "w2",
      date: "2026-09-14",
      author: finn,
      headline: "We found our band",
      body: [
        "The Lanterns are a five-piece from Galway who play everything from Van Morrison to the Pogues without once making it feel like a function. We saw them at Ciara's wedding and never forgot.",
        "They've promised a slow set for the older crowd around ten, then no mercy.",
      ],
      figure: { kind: "art", art: "band", caption: "The Lanterns at a barn in Connemara last summer." },
      attach: { kind: "reached", milestone: "Band booked" },
      thanks: 27,
    },
    {
      id: "w3",
      date: "2026-09-27",
      author: mara,
      headline: "Tasting day at The Orchard",
      body: [
        "We spent Saturday afternoon eating our way through the menu. The lamb won, the beetroot starter won, and there's a vegetarian pie that Finn keeps talking about.",
        "If you have a dietary need we don't know about yet, there's a box for it on the reply card.",
      ],
      figure: { kind: "art", art: "table", caption: "Seven courses, two forks each, no regrets." },
      attach: { kind: "reached", milestone: "Menu chosen" },
      thanks: 22,
    },
    {
      id: "w4",
      date: "2026-09-29",
      author: both,
      headline: "Invitations go out 16 October",
      body: [
        "They're printed and sitting in a box in the hall. We'll post them all on Friday 16 October, so they should land the week after.",
        "If you've moved in the last year, or you're not sure we have the right address, tell Mara before then.",
      ],
      figure: { kind: "bar", label: "Envelopes addressed", value: 71, total: 96 },
      attach: { kind: "coming", milestone: "Invitations posted" },
      thanks: 16,
    },
    {
      id: "w5",
      date: "2026-10-16",
      author: mara,
      headline: "They're in the post",
      body: [
        "Ninety-six envelopes, one very tired tongue. They went out from Ashford post office this morning.",
        "Please reply by 1 March so The Orchard can plan the seating.",
      ],
      figure: { kind: "art", art: "post", caption: "The last bundle, just before the post box." },
      attach: { kind: "reached", milestone: "Invitations posted" },
      thanks: 33,
      notIn: ["quiet"],
    },
    {
      id: "w6",
      date: "2027-03-02",
      author: finn,
      headline: "The rehearsal dinner moves to Friday",
      body: [
        "The Orchard has another booking on the Thursday, so the rehearsal dinner for the wedding party is now on Friday 4 June instead of Thursday 3 June.",
        "Nothing else changes. If you're in the wedding party, you'll get a separate note with times.",
      ],
      figure: { kind: "bar", label: "Replies received", value: 88, total: 96 },
      attach: { kind: "moved", milestone: "Rehearsal dinner", from: "2027-06-03", to: "2027-06-04" },
      thanks: 14,
    },
    {
      id: "w7",
      date: "2027-06-07",
      author: both,
      headline: "We're married. Thank you for every part of it.",
      body: [
        "It rained at two and was sunny by four, which everyone agreed was the right order. The Lanterns played until one, and Granny Kath was the last to leave the floor.",
        "Thank you for travelling, for the speeches, and for putting up with a year of updates.",
      ],
      figure: {
        kind: "recap",
        label: "The day, added up",
        stats: [
          { value: "91", label: "guests" },
          { value: "3", label: "speeches" },
          { value: "1am", label: "last song" },
        ],
      },
      attach: { kind: "reached", milestone: "The wedding" },
      thanks: 87,
    },
  ],
};

/* ── World 3: the launch ───────────────────────────────────────────── */

const launch: World = {
  id: "launch",
  pick: "Product launch",
  kicker: "Northlight for Kiln · launch updates",
  title: "Kiln goes live",
  byline: "Updates from Northlight to Kiln's investors",
  sharer: "Niamh Walsh",
  audienceNoun: "investors",
  event: {
    title: "Public launch",
    when: "Tuesday 19 January 2027",
    where: "Online, with a launch evening at the Kiln studio in Dublin 8",
    start: "20270119T180000",
    end: "20270119T210000",
  },
  milestones: [
    { id: "design", label: "Design signed off", date: "2026-09-01" },
    { id: "beta", label: "Private beta opens", date: "2026-09-28" },
    { id: "payments", label: "Card payments on", date: "2026-10-30" },
    { id: "store", label: "App store approval", date: "2026-12-11", movedFrom: "2026-12-04" },
    { id: "launch", label: "Public launch", date: "2027-01-19", final: true },
  ],
  moments: {
    first: "2026-09-03",
    live: "2026-09-29",
    quiet: "2026-11-06",
    moved: "2026-12-07",
    finished: "2027-01-21",
  },
  firstIntro: "This is where we'll post progress on the Kiln launch. The first update is below.",
  finishedNote: "Kiln is live. Thank you for backing it.",
  status: (m, c) => {
    if (m === "finished") return `Kiln went live on ${c.eventLong}.`;
    if (m === "quiet") return `No news for ${inWords(c.quietWeeks)} weeks, still on track for ${c.eventShort}`;
    if (m === "moved") return `Still on track for ${c.eventLong} · ${c.days} days to go · one date moved`;
    return `On track for ${c.eventLong} · ${c.days} days to go`;
  },
  dispatches: [
    {
      id: "k1",
      date: "2026-09-01",
      author: niamh,
      headline: "Kiln's design is signed off",
      body: [
        "After three rounds with the founders, the app looks and feels the way a good studio does: warm, a bit messy, easy to find your way around. Booking a class takes three taps.",
        "We start building this week. Updates here every fortnight.",
      ],
      attach: { kind: "reached", milestone: "Design signed off" },
      thanks: 6,
    },
    {
      id: "k2",
      date: "2026-09-15",
      author: tomas,
      headline: "Booking works from start to finish",
      body: [
        "A potter can now list a class, a student can book it, and both get a reminder the day before. We tested it with two studios in Stoneybatter.",
        "We're inviting studios to the beta now. The founders hoped for 40; we have 26 so far.",
      ],
      figure: { kind: "bar", label: "Studios signed up for the beta", value: 26, total: 40 },
      thanks: 4,
    },
    {
      id: "k3",
      date: "2026-09-28",
      author: niamh,
      headline: "Beta opens with 40 potters",
      body: [
        "Forty studios across Dublin, Cork and Galway are live in the private beta, taking real bookings from real students.",
        "The most common request so far is a waiting list for classes that sell out. That's next.",
      ],
      figure: { kind: "art", art: "wheel", caption: "Aisling at Clay Lane, first studio to take a booking." },
      attach: { kind: "reached", milestone: "Private beta opens" },
      thanks: 9,
    },
    {
      id: "k4",
      date: "2026-10-30",
      author: tomas,
      headline: "Students can pay by card",
      body: [
        "Payments are on. Studios are paid out every Friday, and the first week moved €3,140 in class fees.",
        "Next is the app store review, which we'll submit in November.",
      ],
      figure: { kind: "bar", label: "Classes booked in the beta", value: 212, total: 300, note: "The founders' goal for the beta was 300." },
      attach: { kind: "reached", milestone: "Card payments on" },
      thanks: 7,
      notIn: ["quiet"],
    },
    {
      id: "k5",
      date: "2026-12-05",
      author: niamh,
      headline: "App store approval is a week later",
      body: [
        "Apple asked for one more screen explaining how refunds work. It's a small change and it's done, but the review queue means approval is now expected on 11 December, not the 4th.",
        "The public launch on 19 January doesn't move. We had kept two weeks spare for exactly this.",
      ],
      attach: { kind: "moved", milestone: "App store approval", from: "2026-12-04", to: "2026-12-11" },
      thanks: 5,
    },
    {
      id: "k6",
      date: "2027-01-20",
      author: niamh,
      headline: "Kiln is live",
      body: [
        "Yesterday Kiln opened to everyone in Ireland. By midnight 1,480 people had made an account and 96 studios were taking bookings.",
        "Thank you for backing this. We'll send one last note with the first month's numbers.",
      ],
      figure: {
        kind: "recap",
        label: "Launch day, added up",
        stats: [
          { value: "1,480", label: "new accounts" },
          { value: "96", label: "studios" },
          { value: "311", label: "classes booked" },
        ],
      },
      attach: { kind: "reached", milestone: "Public launch" },
      thanks: 11,
    },
  ],
};

export const WORLDS: Record<WorldId, World> = { class: fieldStudy, wedding, launch };
export const WORLD_ORDER: WorldId[] = ["class", "wedding", "launch"];

export const MOMENTS: { id: MomentId; label: string }[] = [
  { id: "first", label: "First update" },
  { id: "live", label: "This week" },
  { id: "quiet", label: "A quiet spell" },
  { id: "moved", label: "A date moved" },
  { id: "finished", label: "Finished" },
];

/* ── Building the page for one moment ──────────────────────────────── */

export type FeedItem =
  | { kind: "dispatch"; date: Iso; d: Dispatch }
  | { kind: "passed"; date: Iso; m: Milestone };

export type StandMark = {
  m: Milestone;
  /** The milestone's date in this moment (moved ones only move in "moved"/"finished"). */
  date: Iso;
  state: "done" | "next" | "later";
  moved: boolean;
};

export type Page = {
  world: World;
  moment: MomentId;
  today: Iso;
  status: string;
  tone: "good" | "quiet" | "moved" | "done";
  feed: FeedItem[];
  upcoming: StandMark[];
  marks: StandMark[];
  final: Milestone;
  lastNote: Iso | null;
};

function writtenIn(d: Dispatch, m: MomentId) {
  if (d.onlyIn && !d.onlyIn.includes(m)) return false;
  if (d.notIn && d.notIn.includes(m)) return false;
  return true;
}

export function buildPage(worldId: WorldId, moment: MomentId): Page {
  const world = WORLDS[worldId];
  const today = world.moments[moment];
  const t = dayNum(today);

  // Moved milestones keep their original date until the note about the move.
  const moveNote = world.dispatches.find((d) => d.attach?.kind === "moved");
  const moveKnown = !!moveNote && dayNum(moveNote.date) <= t;
  const dateOf = (m: Milestone): Iso => (m.movedFrom && !moveKnown ? m.movedFrom : m.date);

  const dispatches = world.dispatches.filter((d) => dayNum(d.date) <= t && writtenIn(d, moment));
  const noted = new Set(
    dispatches
      .filter((d) => d.attach && d.attach.kind !== "coming")
      .map((d) => d.attach!.milestone),
  );

  const marks: StandMark[] = [];
  let nextSet = false;
  for (const m of world.milestones) {
    const date = dateOf(m);
    const done = dayNum(date) <= t;
    let state: StandMark["state"] = done ? "done" : "later";
    if (!done && !nextSet) {
      state = "next";
      nextSet = true;
    }
    marks.push({ m, date, state, moved: !!m.movedFrom && moveKnown });
  }

  const passed: FeedItem[] = marks
    .filter((k) => k.state === "done" && !noted.has(k.m.label))
    .map((k) => ({ kind: "passed", date: k.date, m: k.m }));

  const feed: FeedItem[] = [
    ...dispatches.map((d) => ({ kind: "dispatch" as const, date: d.date, d })),
    ...passed,
  ].sort((a, b) => dayNum(b.date) - dayNum(a.date) || (a.kind === "dispatch" ? -1 : 1));

  const final = world.milestones.find((m) => m.final)!;
  const days = dayNum(final.date) - t;
  const lastNote = dispatches.length ? dispatches[dispatches.length - 1].date : null;
  const quietDays = lastNote ? t - dayNum(lastNote) : 0;

  const status = world.status(moment, {
    days,
    quietWeeks: Math.max(1, Math.floor(quietDays / 7)),
    eventLong: long(final.date),
    eventShort: dayMonthLong(final.date),
  });

  const tone: Page["tone"] =
    moment === "finished" ? "done" : moment === "quiet" ? "quiet" : moment === "moved" ? "moved" : "good";

  return {
    world,
    moment,
    today,
    status,
    tone,
    feed,
    upcoming: marks.filter((k) => k.state !== "done"),
    marks,
    final,
    lastNote,
  };
}
