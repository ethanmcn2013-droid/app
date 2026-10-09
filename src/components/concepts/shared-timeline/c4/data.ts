/* Every Day Poster: sample worlds and the day model.
   Front-end only. Every date is a UTC calendar day so the grid never
   drifts with the viewer's time zone. */

import { APP_ORIGIN } from "@/lib/product-urls";

export type Grammar = "centred" | "asym" | "playful";
export type WorldId = "wedding" | "launch" | "class" | "restoration";
export type Moment = "live" | "early" | "final" | "after" | "tba";
export type Format = "poster" | "story" | "square" | "wide";

export type Milestone = { date: string; label: string };

export type World = {
  id: WorldId;
  /** Picker label. */
  label: string;
  grammar: Grammar;
  /** The poster headline, one entry per line. */
  title: string[];
  /** Plain-text title for the page heading and file names. */
  plainTitle: string;
  kicker: string;
  place: string;
  /** Who the page is from. */
  from: string;
  /** What the final day is called. */
  dayName: string;
  start: string;
  end: string;
  today: string;
  milestones: Milestone[];
  /** Smaller moments that only surface when someone touches that day. */
  moments: Milestone[];
  slug: string;
};

export const FORMATS: { id: Format; label: string; ratio: string; w: number; h: number }[] = [
  { id: "poster", label: "Poster", ratio: "4:5", w: 1080, h: 1350 },
  { id: "story", label: "Story", ratio: "9:16", w: 1080, h: 1920 },
  { id: "square", label: "Square", ratio: "1:1", w: 1080, h: 1080 },
  { id: "wide", label: "Wide", ratio: "16:9", w: 1920, h: 1080 },
];

export const MOMENTS: { id: Moment; label: string }[] = [
  { id: "live", label: "Today" },
  { id: "early", label: "Day 8" },
  { id: "final", label: "Last week" },
  { id: "after", label: "After" },
  { id: "tba", label: "No date" },
];

export const WORLDS: World[] = [
  {
    id: "wedding",
    label: "Wedding",
    grammar: "centred",
    title: ["Mara & Finn"],
    plainTitle: "Mara & Finn",
    kicker: "The wedding of",
    place: "Ballynahinch Castle, Connemara",
    from: "Mara and Finn",
    dayName: "The wedding",
    start: "2026-02-14",
    end: "2027-05-22",
    today: "2026-09-25",
    slug: "mara-and-finn",
    milestones: [
      { date: "2026-02-14", label: "Engaged" },
      { date: "2026-03-21", label: "Venue booked" },
      { date: "2026-05-02", label: "Save the dates sent" },
      { date: "2026-09-08", label: "Photographer and band booked" },
      { date: "2026-10-16", label: "Dress and suits chosen" },
      { date: "2026-11-12", label: "Invitations in the post" },
      { date: "2027-01-22", label: "Menu tasting" },
      { date: "2027-03-12", label: "Replies due" },
      { date: "2027-04-30", label: "Seating plan final" },
      { date: "2027-05-22", label: "The wedding" },
    ],
    moments: [
      { date: "2026-03-07", label: "First look round the castle" },
      { date: "2026-04-11", label: "Engagement party in Galway" },
      { date: "2026-06-20", label: "Florist chosen" },
      { date: "2026-07-24", label: "Rings ordered" },
      { date: "2026-08-15", label: "Cake tasting, too much cake" },
    ],
  },
  {
    id: "launch",
    label: "Launch",
    grammar: "asym",
    title: ["Kiln 1.0"],
    plainTitle: "Kiln 1.0",
    kicker: "Northlight Studio for Kiln Pottery Co.",
    place: "Belfast and online",
    from: "Northlight Studio",
    dayName: "Kiln goes live",
    start: "2026-06-04",
    end: "2026-11-03",
    today: "2026-09-25",
    slug: "kiln-launch",
    milestones: [
      { date: "2026-06-04", label: "First workshop" },
      { date: "2026-06-26", label: "Name and brand signed off" },
      { date: "2026-07-24", label: "Clickable prototype" },
      { date: "2026-08-21", label: "First build to testers" },
      { date: "2026-09-18", label: "Beta opens to 200 potters" },
      { date: "2026-10-09", label: "Sent for app store review" },
      { date: "2026-10-20", label: "Launch film final" },
      { date: "2026-11-03", label: "Kiln goes live" },
    ],
    moments: [
      { date: "2026-06-17", label: "Studio visit, clay everywhere" },
      { date: "2026-07-08", label: "Booking flow tested with 12 potters" },
      { date: "2026-09-02", label: "Payments switched on" },
      { date: "2026-09-23", label: "First 100 bookings in beta" },
    ],
  },
  {
    id: "class",
    label: "Class",
    grammar: "playful",
    title: ["River Dargle", "field study"],
    plainTitle: "River Dargle field study",
    kicker: "St Brigid's · 5th Year Geography",
    place: "Enniskerry, Co. Wicklow",
    from: "Ms Byrne and 5th Year",
    dayName: "Exhibition evening",
    start: "2026-09-01",
    end: "2026-12-10",
    today: "2026-09-25",
    slug: "dargle-field-study",
    milestones: [
      { date: "2026-09-04", label: "Groups formed" },
      { date: "2026-10-08", label: "River Dargle field day" },
      { date: "2026-11-13", label: "Data in" },
      { date: "2026-12-03", label: "Posters printed" },
      { date: "2026-12-10", label: "Exhibition evening" },
    ],
    moments: [
      { date: "2026-09-15", label: "Permission slips home" },
      { date: "2026-09-22", label: "Wellies and clipboards sorted" },
      { date: "2026-10-22", label: "Mid-term, no homework" },
    ],
  },
  {
    id: "restoration",
    label: "Library",
    grammar: "asym",
    title: ["The Harbour", "Library"],
    plainTitle: "The Harbour Library",
    kicker: "Mourne Conservation Architects with Kilkeel Harbour Trust",
    place: "Kilkeel, Co. Down",
    from: "Kilkeel Harbour Trust",
    dayName: "Doors reopen",
    start: "2025-03-03",
    end: "2028-06-30",
    today: "2026-09-25",
    slug: "harbour-library",
    milestones: [
      { date: "2025-03-03", label: "Survey begins" },
      { date: "2025-11-14", label: "Planning granted" },
      { date: "2026-02-02", label: "Old roof comes off" },
      { date: "2026-05-11", label: "New oak roof on" },
      { date: "2026-09-24", label: "Windows back from the joiner" },
      { date: "2027-02-01", label: "Stonework repointed" },
      { date: "2027-09-06", label: "Heating and lights in" },
      { date: "2028-03-03", label: "Books return to the shelves" },
      { date: "2028-06-30", label: "Doors reopen" },
    ],
    moments: [
      { date: "2025-06-12", label: "Swallows' nests found, work paused" },
      { date: "2026-07-18", label: "Open day, 340 visitors" },
    ],
  },
];

/* ── Calendar days ───────────────────────────────────────────────── */

const DAY = 86_400_000;
export const dayNum = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
const dateOf = (n: number) => new Date(n * DAY);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const fmtDM = (n: number) => `${dateOf(n).getUTCDate()} ${MON[dateOf(n).getUTCMonth()]}`;
export const fmtDMY = (n: number) => `${fmtDM(n)} ${dateOf(n).getUTCFullYear()}`;
export const fmtWDM = (n: number) => `${WD[dateOf(n).getUTCDay()]} ${fmtDM(n)}`;
export const fmtWDMY = (n: number) => `${WD[dateOf(n).getUTCDay()]} ${fmtDMY(n)}`;
export const fmtLong = (n: number) =>
  `${WD_LONG[dateOf(n).getUTCDay()]} ${dateOf(n).getUTCDate()} ${MON_LONG[dateOf(n).getUTCMonth()]} ${dateOf(n).getUTCFullYear()}`;
export const yearOf = (n: number) => dateOf(n).getUTCFullYear();
export const monthOf = (n: number) => dateOf(n).getUTCMonth();
export const dateOfMonth = (n: number) => dateOf(n).getUTCDate();
export const monthInitial = (n: number) => MON_LONG[monthOf(n)][0];
/** Monday = 0. */
export const weekdayMon = (n: number) => (dateOf(n).getUTCDay() + 6) % 7;

/* ── The model the poster draws ──────────────────────────────────── */

export type DayKind = "past" | "today" | "future" | "tail";

export type Day = {
  i: number;
  n: number;
  kind: DayKind;
  /** Milestone number, 1-based, when this day carries one. */
  m?: number;
  label?: string;
  isEnd: boolean;
  /** 0..1 fade for the open end of an undated project. */
  fade?: number;
};

export type MilestoneRow = Milestone & {
  n: number;
  i: number;
  num: number;
  state: "done" | "next" | "later";
  isEnd: boolean;
};

export type Model = {
  world: World;
  moment: Moment;
  days: Day[];
  start: number;
  end: number | null;
  today: number;
  todayIdx: number;
  /** Monday-aligned offset of the first day. */
  offset: number;
  total: number;
  dayNumber: number;
  toGo: number;
  milestones: MilestoneRow[];
  /** The corner statement. */
  big: string;
  bigIsWord: boolean;
  small: string;
  dateLine: string;
  long: boolean;
  finalWeekFrom: number;
  shareUrl: string;
  spanLabel: string;
};

export function buildModel(worldId: WorldId, moment: Moment): Model {
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const start = dayNum(world.start);
  const realEnd = dayNum(world.end);
  let today = dayNum(world.today);
  if (moment === "early") today = start + 7;
  if (moment === "final") today = realEnd - 4;
  if (moment === "after") today = realEnd + 9;

  const tba = moment === "tba";
  const known = world.milestones.filter((m) => !(tba && dayNum(m.date) === realEnd));
  const lastKnown = Math.max(...known.map((m) => dayNum(m.date)), today);
  const end = tba ? null : realEnd;
  const tail = 21;
  const lastDrawn = tba ? lastKnown + tail : realEnd;

  const byDay = new Map<number, { m: number; label: string }>();
  known.forEach((m, idx) => byDay.set(dayNum(m.date), { m: idx + 1, label: m.label }));
  const moments = new Map(world.moments.map((m) => [dayNum(m.date), m.label]));

  const days: Day[] = [];
  for (let n = start; n <= lastDrawn; n += 1) {
    const i = n - start;
    const ms = byDay.get(n);
    const kind: DayKind =
      tba && n > lastKnown ? "tail" : n < today ? "past" : n === today ? "today" : "future";
    days.push({
      i,
      n,
      kind,
      m: ms?.m,
      label: ms?.label ?? moments.get(n),
      isEnd: end !== null && n === end,
      fade: kind === "tail" ? 1 - (n - lastKnown) / (tail + 1) : undefined,
    });
  }

  const total = end !== null ? end - start + 1 : days.length;
  const dayNumber = today - start + 1;
  const toGo = end !== null ? end - today : 0;

  let nextFound = false;
  const milestones: MilestoneRow[] = known.map((m, idx) => {
    const n = dayNum(m.date);
    let state: MilestoneRow["state"] = n < today ? "done" : "later";
    if (state === "later" && !nextFound) {
      state = "next";
      nextFound = true;
    }
    if (n === today) state = "next";
    return { ...m, n, i: n - start, num: idx + 1, state, isEnd: end !== null && n === end };
  });

  let big = String(toGo);
  let bigIsWord = false;
  let small = toGo === 1 ? "day to go" : "days to go";
  if (moment === "early") {
    big = `Day ${dayNumber}`;
    small = `of ${total.toLocaleString("en-IE")} · ${toGo.toLocaleString("en-IE")} to go`;
  }
  if (moment === "after") {
    big = "It happened.";
    bigIsWord = true;
    small = fmtDMY(realEnd);
  }
  if (tba) {
    big = `Day ${dayNumber}`;
    small = "Date to be announced";
  }

  const dateLine = tba ? "Date to be announced" : fmtLong(realEnd);
  const spanLabel = tba
    ? `From ${fmtDMY(start)}, date to be announced`
    : `${fmtDMY(start)} to ${fmtDMY(realEnd)}`;

  return {
    world,
    moment,
    days,
    start,
    end,
    today,
    todayIdx: today - start,
    offset: weekdayMon(start),
    total,
    dayNumber,
    toGo,
    milestones,
    big,
    bigIsWord,
    small,
    dateLine,
    long: days.length > 700,
    finalWeekFrom: end !== null ? end - weekdayMon(end) : Number.POSITIVE_INFINITY,
    shareUrl: `${APP_ORIGIN}/s/${world.slug}`,
    spanLabel,
  };
}

/** What a single day says when someone touches it. */
export function describeDay(model: Model, d: Day): { title: string; line: string; sub: string } {
  const title = model.long || yearOf(model.start) !== yearOf(d.n) || yearOf(model.today) !== yearOf(d.n)
    ? fmtWDMY(d.n)
    : fmtWDM(d.n);
  let line: string;
  if (d.isEnd) line = model.world.dayName;
  else if (d.label) line = d.label;
  else if (d.kind === "today") line = "Today";
  else if (d.kind === "past") line = "a quiet day";
  else if (d.kind === "tail") line = "the date is still to be set";
  else line = "nothing planned yet";
  if (d.kind === "today" && d.label) line = `Today · ${d.label}`;
  const k = (d.i + 1).toLocaleString("en-IE");
  const sub = model.end !== null ? `Day ${k} of ${model.total.toLocaleString("en-IE")}` : `Day ${k}`;
  return { title, line, sub };
}
