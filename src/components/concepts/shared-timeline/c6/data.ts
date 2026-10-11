/* The Line: sample stories. Every date is invented; nothing is fetched.
   A story is a set of lines (strands of work) that run towards one day.
   Stations are the moments on those lines; a station on two lines is an
   interchange. */

export type Iso = `${number}-${number}-${number}`;

export type LineId = string;

export type Line = {
  id: LineId;
  name: string;
  /** Project identity token, e.g. "--v3-project-2". */
  color: string;
  /** Who tends to follow this line, in plain words. */
  whoFor: string;
};

export type Station = {
  id: string;
  title: string;
  date: Iso;
  /** Lines this stop sits on. Two or more makes it an interchange. */
  lines: LineId[];
  note: string;
  /** False while the date is still a plan rather than a fixed booking. */
  firm: boolean;
  /** Set when the stop moved later. */
  movedFrom?: Iso;
  movedWhy?: string;
};

export type Scenario = {
  worldId: WorldId;
  moment: MomentId;
  h1: string;
  eyebrow: string;
  sharedBy: string;
  updated: string;
  lines: Line[];
  stations: Station[];
  terminus: { title: string; date: Iso; note: string };
  /** Lines run together from here to the day. */
  mergeBy: Iso;
  today: Iso;
  /** The map starts a little before this. */
  start: Iso;
};

export type WorldId = "wedding" | "launch" | "class";
export type MomentId = "now" | "early" | "delay" | "crowded" | "arrived" | "single";

export const WORLD_ORDER: WorldId[] = ["wedding", "launch", "class"];
export const WORLD_LABEL: Record<WorldId, string> = {
  wedding: "Mara and Finn's wedding",
  launch: "Halden Coffee opening",
  class: "Year 9 river study",
};

export const MOMENTS: { id: MomentId; label: string }[] = [
  { id: "now", label: "Today, on the way" },
  { id: "early", label: "Early days" },
  { id: "delay", label: "A stop moved later" },
  { id: "crowded", label: "A crowded month" },
  { id: "arrived", label: "Arrived" },
  { id: "single", label: "One line only" },
];

/* ── Dates ──────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
export function dayNum(iso: Iso): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}
export function fromDayNum(n: number): Iso {
  const t = new Date(n * DAY);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}` as Iso;
}
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MON = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(iso: Iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m: m - 1, d, wd };
}
/** "16 Oct" */
export function shortDate(iso: Iso) {
  const p = parts(iso);
  return `${p.d} ${MON[p.m]}`;
}
/** "Fri 25 Sep" */
export function tinyDate(iso: Iso) {
  const p = parts(iso);
  return `${WEEKDAYS[p.wd].slice(0, 3)} ${p.d} ${MON[p.m]}`;
}
/** "Fri 16 October" */
export function boardDate(iso: Iso) {
  const p = parts(iso);
  return `${WEEKDAYS[p.wd].slice(0, 3)} ${p.d} ${MONTHS[p.m]}`;
}
/** "15 January" */
export function dayMonth(iso: Iso) {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m]}`;
}
/** "22 May 2027" */
export function longDate(iso: Iso) {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
}
/** "Saturday 22 May 2027" */
export function fullDate(iso: Iso) {
  const p = parts(iso);
  return `${WEEKDAYS[p.wd]} ${p.d} ${MONTHS[p.m]} ${p.y}`;
}
export function monthOf(iso: Iso) {
  return parts(iso).m;
}
export function yearOf(iso: Iso) {
  return parts(iso).y;
}

/** "in 21 days", "tomorrow", "today", "3 days ago" */
export function relative(from: Iso, to: Iso): string {
  const n = dayNum(to) - dayNum(from);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n < 0) {
    const a = -n;
    if (a < 14) return `${a} days ago`;
    if (a < 60) return `${Math.round(a / 7)} weeks ago`;
    return `${Math.round(a / 30.4)} months ago`;
  }
  if (n < 60) return `in ${n} days`;
  return `in ${Math.round(n / 30.4)} months`;
}

/* ── Stories ───────────────────────────────────────────────────────── */

type Base = Omit<Scenario, "moment" | "today"> & { today: Iso };

const WEDDING: Base = {
  worldId: "wedding",
  h1: "Mara & Finn · the way to 22 May",
  eyebrow: "Our wedding plan, shared with family and the people helping",
  sharedBy: "Mara Quinn",
  updated: "Updated this morning",
  today: "2026-09-25",
  start: "2026-03-20",
  mergeBy: "2027-03-31",
  lines: [
    { id: "venue", name: "The venue and food", color: "--v3-project-2", whoFor: "The Orchard team and anyone helping with food" },
    { id: "guests", name: "Guests", color: "--v3-project-5", whoFor: "Family, and anyone asking when invitations arrive" },
    { id: "suppliers", name: "Music, flowers and photos", color: "--v3-project-7", whoFor: "The band, the florist and the photographer" },
  ],
  stations: [
    { id: "orchard", title: "The Orchard booked", date: "2026-04-03", lines: ["venue"], firm: true, note: "Deposit paid and the barn is ours for the whole weekend." },
    { id: "std", title: "Save the dates", date: "2026-06-12", lines: ["guests"], firm: true, note: "Cards posted to 112 guests, with a note about the date only." },
    { id: "tasting", title: "Menu tasting", date: "2026-08-01", lines: ["venue", "guests"], firm: true, note: "Three starters tried and the vegetarian main chosen, so guests can pick on their reply." },
    { id: "photo", title: "Photographer and band booked", date: "2026-09-09", lines: ["suppliers"], firm: true, note: "Aisling Byrne for photos and The Late Trains for the evening." },
    { id: "invites", title: "Invitations go out", date: "2026-10-16", lines: ["guests"], firm: true, note: "Printed invitations with the reply card and the menu choice." },
    { id: "flowers", title: "Flowers chosen", date: "2026-11-06", lines: ["suppliers"], firm: true, note: "A walk through the florist's samples to settle colours for the barn and the tables." },
    { id: "reply", title: "Reply by", date: "2027-01-15", lines: ["guests"], firm: true, note: "The last day to say yes or no and pick a main course." },
    { id: "numbers", title: "Final numbers to The Orchard", date: "2027-03-19", lines: ["venue"], firm: true, note: "Guest count and dietary needs go to the kitchen." },
    { id: "hair", title: "Hair and makeup trial", date: "2027-04-10", lines: ["suppliers"], firm: false, note: "A run-through so there are no surprises on the morning." },
    { id: "seating", title: "Seating plan shared", date: "2027-05-01", lines: ["guests"], firm: false, note: "Everyone can see where they are sitting before the day." },
    { id: "rehearsal", title: "Rehearsal", date: "2027-05-21", lines: ["venue"], firm: true, note: "A walk-through at The Orchard, then dinner for the wedding party." },
  ],
  terminus: { title: "The day", date: "2027-05-22", note: "Ceremony at two in the orchard, dinner in the barn, dancing until late." },
};

const LAUNCH: Base = {
  worldId: "launch",
  h1: "Halden Coffee · the way to launch night",
  eyebrow: "Opening our second shop on Capel Street, shared with the team and our landlord",
  sharedBy: "Dara Halden",
  updated: "Updated 2 hours ago",
  today: "2026-09-25",
  start: "2026-06-26",
  mergeBy: "2026-10-26",
  lines: [
    { id: "word", name: "Getting the word out", color: "--v3-project-8", whoFor: "Anyone sharing the news" },
    { id: "build", name: "Build", color: "--v3-project-3", whoFor: "The fit-out crew and the landlord" },
    { id: "design", name: "Design", color: "--v3-project-1", whoFor: "The studio making the signs and menus" },
  ],
  stations: [
    { id: "brief", title: "Brief signed off", date: "2026-07-06", lines: ["design"], firm: true, note: "What the shop should feel like, agreed in one page." },
    { id: "logo", title: "Logo and colours chosen", date: "2026-07-31", lines: ["design"], firm: true, note: "The river mark and a warm oat colour for the walls." },
    { id: "fitout", title: "Shop fit-out starts", date: "2026-08-17", lines: ["build"], firm: true, note: "Counter, seating and lighting go in over six weeks." },
    { id: "teaser", title: "First teaser posted", date: "2026-09-01", lines: ["word"], firm: true, note: "A photo of the empty shop and the words 'coming soon'." },
    { id: "boards", title: "Menu boards designed", date: "2026-09-11", lines: ["design"], firm: true, note: "Prices and the new seasonal drinks, ready to print." },
    { id: "site", title: "Website goes live", date: "2026-10-02", lines: ["word", "build"], firm: true, note: "Opening hours, the menu and a map, all in one place." },
    { id: "press", title: "Local press visit", date: "2026-10-08", lines: ["word"], firm: true, note: "Dublin Inquirer comes for coffee and a chat." },
    { id: "machine", title: "Coffee machine delivered", date: "2026-10-14", lines: ["build"], firm: true, note: "Installed and tested by the supplier the same day." },
    { id: "signs", title: "Signage installed", date: "2026-10-30", lines: ["design"], firm: false, note: "The painted sign over the door and the window lettering." },
    { id: "soft", title: "Soft opening for friends", date: "2026-11-01", lines: ["build"], firm: false, note: "A quiet Sunday to test the menu on friends and family." },
  ],
  terminus: { title: "Launch night", date: "2026-11-03", note: "Doors open at six, free coffee for the street until nine." },
};

const CLASS: Base = {
  worldId: "class",
  h1: "Year 9 river study · the way to exhibition evening",
  eyebrow: "Our class project on the River Dodder, shared with parents",
  sharedBy: "Ms Ní Bhriain",
  updated: "Updated yesterday",
  today: "2026-09-25",
  start: "2026-09-04",
  mergeBy: "2026-12-02",
  lines: [
    { id: "width", name: "River width group", color: "--v3-project-3", whoFor: "Aoife, Tom, Precious and Luca" },
    { id: "water", name: "Water quality group", color: "--v3-project-2", whoFor: "Ciara, Ben, Maya and Oisín" },
    { id: "wild", name: "Wildlife group", color: "--v3-project-4", whoFor: "Sam, Niamh, Ruth and Jay" },
    { id: "weather", name: "Weather group", color: "--v3-project-6", whoFor: "Leo, Hannah, Kofi and Erin" },
  ],
  stations: [
    { id: "kit", title: "Kit checked out", date: "2026-09-11", lines: ["water"], firm: true, note: "Test strips, sample jars and gloves from the science room." },
    { id: "trip", title: "First field trip", date: "2026-09-18", lines: ["width", "water"], firm: true, note: "Both groups at the Dodder by Rathfarnham, back by lunch." },
    { id: "gauge", title: "Rain gauge set up", date: "2026-09-21", lines: ["weather"], firm: true, note: "On the school roof, read every morning before class." },
    { id: "plan", title: "Survey plan approved", date: "2026-09-23", lines: ["wild"], firm: true, note: "Which stretch to survey and what to count." },
    { id: "measure", title: "Measurements at five points", date: "2026-10-02", lines: ["width"], firm: true, note: "Width and depth at five places along the same stretch." },
    { id: "samples", title: "Samples tested", date: "2026-10-09", lines: ["water"], firm: true, note: "pH and clarity checked in the lab." },
    { id: "pond", title: "Pond dipping day", date: "2026-10-16", lines: ["wild"], firm: true, note: "Nets, trays and a species chart by the river bank." },
    { id: "readings", title: "Two weeks of readings", date: "2026-10-23", lines: ["weather"], firm: true, note: "Rain, wind and temperature logged every school day." },
    { id: "chart", title: "Results chart drafted", date: "2026-11-13", lines: ["water"], firm: false, note: "One clear chart showing how clean the water is." },
    { id: "model", title: "Cross-section model built", date: "2026-11-20", lines: ["width"], firm: false, note: "A cardboard model of the riverbed, to scale." },
    { id: "guide", title: "Species guide written", date: "2026-11-18", lines: ["wild"], firm: false, note: "A small booklet of everything the group found." },
    { id: "video", title: "Weather video edited", date: "2026-11-12", lines: ["weather"], firm: false, note: "A two-minute film about how rain changes the river." },
    { id: "printed", title: "Exhibition boards printed", date: "2026-12-04", lines: ["width", "water", "wild", "weather"], firm: false, note: "Every group's work on one set of boards, ready to hang." },
  ],
  terminus: { title: "Exhibition evening", date: "2026-12-10", note: "In the school hall from seven. Parents and families welcome." },
};

const BASES: Record<WorldId, Base> = { wedding: WEDDING, launch: LAUNCH, class: CLASS };

/* ── Moments: the same story at a different point, or in a different mood ── */

export function buildScenario(worldId: WorldId, moment: MomentId): Scenario {
  const b = BASES[worldId];
  let stations = b.stations.map((s) => ({ ...s }));
  let lines = b.lines;
  let today = b.today;
  let updated = b.updated;

  if (moment === "early") {
    today = fromDayNum(dayNum(b.start) + Math.round((dayNum(b.terminus.date) - dayNum(b.start)) * 0.1));
    const cutoff = dayNum(today) + 45;
    stations = stations.map((s) => ({ ...s, firm: dayNum(s.date) <= cutoff }));
    updated = "Updated last week";
  }

  if (moment === "arrived") {
    today = fromDayNum(dayNum(b.terminus.date) + 1);
    stations = stations.map((s) => ({ ...s, firm: true }));
    updated = "Kept as a memento";
  }

  if (moment === "delay") {
    const target: Record<WorldId, { id: string; to: Iso; why: string }> = {
      wedding: { id: "invites", to: "2026-10-24", why: "The printer needed an extra week for the letterpress. Replies are still due by 15 January." },
      launch: { id: "machine", to: "2026-10-21", why: "The supplier's van was booked. Launch night is unchanged." },
      class: { id: "samples", to: "2026-10-16", why: "The lab was in use for mock exams. The exhibition date is unchanged." },
    };
    const t = target[worldId];
    stations = stations.map((s) => (s.id === t.id ? { ...s, movedFrom: s.date, date: t.to, movedWhy: t.why } : s));
    updated = "Updated an hour ago";
  }

  if (moment === "crowded") {
    const extra: Record<WorldId, Station[]> = {
      wedding: [
        { id: "cake", title: "Cake tasting", date: "2026-11-03", lines: ["venue"], firm: true, note: "Lemon and elderflower, or chocolate and raspberry." },
        { id: "rings", title: "Rings ordered", date: "2026-11-05", lines: ["suppliers"], firm: true, note: "Made in Galway, ready in March." },
        { id: "hotel", title: "Rooms held for guests", date: "2026-11-09", lines: ["guests"], firm: true, note: "Thirty rooms at the Ballymore Inn, held until February." },
        { id: "readers", title: "Readers asked", date: "2026-11-11", lines: ["guests"], firm: true, note: "Two readings, one from each family." },
        { id: "songs", title: "First dance chosen", date: "2026-11-13", lines: ["suppliers"], firm: true, note: "The band needs it early to learn it." },
      ],
      launch: [
        { id: "cups", title: "Cups printed", date: "2026-10-12", lines: ["design"], firm: true, note: "Two thousand cups with the new mark." },
        { id: "staff", title: "Staff training", date: "2026-10-15", lines: ["build"], firm: true, note: "Two days on the machine and the till." },
        { id: "flyers", title: "Flyers on the street", date: "2026-10-17", lines: ["word"], firm: true, note: "Every door within five minutes' walk." },
        { id: "radio", title: "Radio mention", date: "2026-10-19", lines: ["word"], firm: true, note: "Thirty seconds on the morning show." },
      ],
      class: [
        { id: "bugs", title: "Insect count", date: "2026-10-12", lines: ["wild"], firm: true, note: "Counting under stones at three spots." },
        { id: "wind", title: "Wind vane made", date: "2026-10-13", lines: ["weather"], firm: true, note: "From a bottle, a pencil and a pin." },
        { id: "flow", title: "Flow speed timed", date: "2026-10-14", lines: ["width"], firm: true, note: "An orange, a stopwatch and ten metres of bank." },
        { id: "nitrate", title: "Nitrate test", date: "2026-10-15", lines: ["water"], firm: true, note: "A second set of strips from the same spots." },
      ],
    };
    stations = [...stations, ...extra[worldId]];
    if (worldId === "wedding") today = "2026-10-26";
    updated = "Updated today";
  }

  if (moment === "single") {
    const keep = lines[0].id;
    lines = [lines[0]];
    stations = stations
      .filter((s) => s.lines.includes(keep))
      .map((s) => ({ ...s, lines: [keep] }));
  }

  stations.sort((a, c) => dayNum(a.date) - dayNum(c.date));

  return {
    ...b,
    moment,
    lines,
    stations,
    today,
    updated,
  };
}

/* ── Derived facts ─────────────────────────────────────────────────── */

export type StopState = "done" | "next" | "planned";

export function stopState(s: Scenario, st: Station, nextId: string | null): StopState {
  if (dayNum(st.date) <= dayNum(s.today)) return "done";
  if (st.id === nextId) return "next";
  return "planned";
}

export function upcoming(s: Scenario, lineId?: LineId | null): Station[] {
  const t = dayNum(s.today);
  return s.stations.filter((st) => dayNum(st.date) > t && (!lineId || st.lines.includes(lineId)));
}

export function reachedCount(s: Scenario, lineId?: LineId | null) {
  const t = dayNum(s.today);
  const pool = s.stations.filter((st) => !lineId || st.lines.includes(lineId));
  return { done: pool.filter((st) => dayNum(st.date) <= t).length, total: pool.length };
}

export function arrived(s: Scenario) {
  return dayNum(s.today) >= dayNum(s.terminus.date);
}
