/* The Road There: one story model, three audiences, five preview states.
   Every date is a plain ISO day ("2026-09-25") and every sum is done on
   whole UTC days, so the page reads the same in every time zone. */

export type Audience = "wedding" | "launch" | "class";
export type PreviewState = "live" | "early" | "dayof" | "after" | "empty" | "long";

export type Art = "ring" | "orchard" | "envelope" | "music" | "sketch" | "phone" | "river" | "poster";

export type ChapterSeed = {
  id: string;
  date: string;
  title: string;
  /** One or two sentences written for the people reading, not a task name. */
  body: string;
  /** What this chapter means for the reader, when there is something to do. */
  forYou?: string;
  quote?: { text: string; by: string };
  people?: { role: string; name: string }[];
  art?: Art;
};

export type RunItem = { time: string; minutes: number; what: string; where: string };

type AudienceSeed = {
  audience: Audience;
  name: string;
  longName: string;
  /** "A shared plan from …" line above the name. */
  from: string;
  place: string;
  placeShort: string;
  day: string;
  dayTitle: string;
  dayBody: string;
  /** The cover line on the day itself. */
  dayofBody: string;
  welcome: string[];
  signoff: string;
  chapters: ChapterSeed[];
  runningOrder: RunItem[];
  dayNotes: { label: string; value: string }[];
  /** Countdown wording after the day. */
  since: (days: number) => string;
  afterCover: string;
  afterBody: string;
  emptyLine: string;
  updatedBy: string;
  calendarTitle: string;
};

export const TODAY = "2026-09-25";

const WEDDING: AudienceSeed = {
  audience: "wedding",
  name: "Mara & Finn",
  longName: "Mara Whelan & Finn O'Sullivan, a long weekend of it at The Orchard",
  from: "A shared plan from Mara and Finn",
  place: "The Orchard, Co. Wicklow",
  placeShort: "The Orchard",
  day: "2027-05-22",
  dayTitle: "The day itself",
  dayBody:
    "Everything above was for this. Come as you are, bring comfortable shoes for the grass, and stay as long as the band does.",
  dayofBody: "Welcome, and thank you for being here. Bring comfortable shoes for the grass, and stay as long as the band does.",
  welcome: [
    "We wanted one place where you could see how the wedding is coming together, without a group chat or a spreadsheet in sight.",
    "Read it from the top and it ends at the day. We'll add to it as things happen.",
  ],
  signoff: "Mara and Finn",
  chapters: [
    {
      id: "yes",
      date: "2026-02-14",
      title: "We said yes",
      body: "Finn asked on the pier at Greystones, in the rain, with a ring he'd been carrying around for three weeks. Mara said yes before he finished the question.",
      art: "ring",
    },
    {
      id: "venue",
      date: "2026-04-03",
      title: "The Orchard is booked",
      body: "We walked the grounds on a cold April morning and knew straight away. The ceremony will be under the old apple trees, with the terrace for drinks afterwards.",
      art: "orchard",
    },
    {
      id: "save",
      date: "2026-06-12",
      title: "Save the dates are out",
      body: "If you're reading this, one probably found its way to you. Thank you for keeping the day free.",
      forYou: "Nothing to do yet. Just keep Saturday 22 May clear.",
      art: "envelope",
    },
    {
      id: "menu",
      date: "2026-08-01",
      title: "Menu tasting at The Orchard",
      body: "Six courses, two very full people, and one decision we couldn't make, so you're getting both desserts.",
      quote: { text: "The elderflower sorbet settled it. We're not changing a thing.", by: "Finn" },
    },
    {
      id: "crew",
      date: "2026-09-09",
      title: "Photographer and band booked",
      body: "Aoife will be taking photos all day, and The Late Swells will play from nine until someone asks them to stop.",
      people: [
        { role: "Photos", name: "Aoife Byrne" },
        { role: "Music", name: "The Late Swells" },
      ],
      art: "music",
    },
    {
      id: "invites",
      date: "2026-10-16",
      title: "Invitations go out",
      body: "Proper invitations this time, with the details of the day and a card to send back to us.",
      forYou: "Look out for a cream envelope in the post from mid October.",
    },
    {
      id: "reply",
      date: "2027-01-15",
      title: "Reply by",
      body: "Let us know whether you can come, and tell us about anything you can't eat. We'll chase gently, we promise.",
      forYou: "Send back the card in your invitation, or text either of us.",
    },
    {
      id: "numbers",
      date: "2027-03-19",
      title: "Final numbers to The Orchard",
      body: "The guest list and seating plan go to The Orchard. After this, the tables are set.",
    },
    {
      id: "rehearsal",
      date: "2027-05-21",
      title: "Rehearsal in the orchard",
      body: "A quick walk-through with the wedding party the evening before, then dinner in the village.",
    },
  ],
  runningOrder: [
    { time: "2:00pm", minutes: 14 * 60, what: "Ceremony", where: "Under the apple trees" },
    { time: "3:30pm", minutes: 15 * 60 + 30, what: "Drinks", where: "On the terrace" },
    { time: "5:30pm", minutes: 17 * 60 + 30, what: "Dinner", where: "In the long barn" },
    { time: "9:00pm", minutes: 21 * 60, what: "Dancing", where: "Until the band stops" },
  ],
  dayNotes: [
    { label: "What to wear", value: "Garden formal, flat shoes welcome" },
    { label: "Getting there", value: "A bus leaves Bray DART at 12:45pm" },
    { label: "Staying over", value: "Rooms held at The Glenview until March" },
  ],
  since: (d) => `Married ${d} ${d === 1 ? "day" : "days"} ago`,
  afterCover: "Thank you for being part of it",
  afterBody: "We're still catching our breath. Photos from Aoife will land here in a few weeks.",
  emptyLine: "Nothing to show yet, and that's fine. We'll tell the story here as plans come together. For now, save the date.",
  updatedBy: "Mara",
  calendarTitle: "Mara & Finn's wedding",
};

const LAUNCH: AudienceSeed = {
  audience: "launch",
  name: "The Kiln app",
  longName: "The Kiln app: booking wheels, classes and firings at Kiln Pottery Dublin",
  from: "A shared plan from Northlight Studio for Kiln Pottery Dublin",
  place: "Kiln Pottery, Dublin 8",
  placeShort: "the studio",
  day: "2026-11-03",
  dayTitle: "Launch night",
  dayBody:
    "The app goes live in the stores at six, and the studio opens its doors at half past. Bring your phone, book a wheel, and stay for a drink.",
  dayofBody: "Tonight's the night. The app is live in the stores from six, and the studio doors open at half past.",
  welcome: [
    "This is the plain-English story of how the Kiln app gets made, for everyone at the studio and the potters who'll use it.",
    "Read it from the top and it ends at launch night. We update it as each part lands.",
  ],
  signoff: "Northlight Studio",
  chapters: [
    {
      id: "brief",
      date: "2026-05-12",
      title: "Brief signed",
      body: "Kiln and Northlight agreed what the app has to do: let anyone book a wheel, a class or a firing slot in under a minute.",
      art: "sketch",
    },
    {
      id: "designs",
      date: "2026-06-30",
      title: "First designs approved",
      body: "Orla and the studio team picked a direction: warm, simple, and built around the week's class calendar.",
      quote: { text: "It feels like walking into the studio.", by: "Orla, Kiln Pottery" },
      art: "phone",
    },
    {
      id: "beta",
      date: "2026-09-04",
      title: "Beta with 40 potters",
      body: "Forty regulars have been booking real classes through the app. Their notes shaped the last round of changes.",
      people: [
        { role: "Bookings made", name: "312" },
        { role: "Fixes from feedback", name: "27" },
      ],
    },
    {
      id: "review",
      date: "2026-10-13",
      title: "App store review",
      body: "The app goes to Apple and Google for their checks. It usually takes about a week, and we'll say here when it's through.",
      forYou: "If you're in the beta, keep using it. Nothing changes for you.",
    },
  ],
  runningOrder: [
    { time: "6:30pm", minutes: 18 * 60 + 30, what: "Doors open", where: "Kiln Pottery, Dublin 8" },
    { time: "7:00pm", minutes: 19 * 60, what: "A short hello from Orla", where: "By the big wheel" },
    { time: "7:15pm", minutes: 19 * 60 + 15, what: "Book your first class", where: "Anywhere with signal" },
    { time: "8:00pm", minutes: 20 * 60, what: "Throwing demos and drinks", where: "Until half nine" },
  ],
  dayNotes: [
    { label: "Where", value: "14 Francis Street, Dublin 8" },
    { label: "Bring", value: "Your phone, and anyone who'd like to try a wheel" },
    { label: "Launch offer", value: "First class half price for the week" },
  ],
  since: (d) => `Launched ${d} ${d === 1 ? "day" : "days"} ago`,
  afterCover: "Thank you for being part of it",
  afterBody: "The app is live and the first week of bookings is filling up. We'll keep this page as a record of how it got made.",
  emptyLine: "The plan is still being drawn up. The story of how the app gets made will appear here, step by step.",
  updatedBy: "Dara at Northlight",
  calendarTitle: "Kiln app launch night",
};

const CLASS: AudienceSeed = {
  audience: "class",
  name: "Our river study",
  longName: "Our river study: measuring the Avonmore from Laragh down to Rathdrum",
  from: "From 5th Year Geography at St Brigid's College",
  place: "St Brigid's College hall",
  placeShort: "the hall",
  day: "2026-12-10",
  dayTitle: "Exhibition evening",
  dayBody:
    "The class will be standing by their posters, ready to explain what they found. Ask them hard questions. They've earned it.",
  dayofBody: "Tonight's the night. The posters are up, the kettle is on, and the class is ready for your questions.",
  welcome: [
    "Twenty-six students, one river, and a term's worth of fieldwork. This page follows the project from the first day out to the evening we show it to you.",
    "Read it from the top. It ends at the exhibition.",
  ],
  signoff: "Ms Kavanagh and 5th Year",
  chapters: [
    {
      id: "groups",
      date: "2026-09-01",
      title: "Groups and questions chosen",
      body: "Five groups, five questions. The favourite so far: does the river really run faster after it rains, and by how much?",
    },
    {
      id: "field",
      date: "2026-09-17",
      title: "A day on the Avonmore",
      body: "The class measured the river at four points between Laragh and Rathdrum. Everyone came home, mostly dry.",
      quote: { text: "I didn't know a river could be that cold in September.", by: "Seán, group 3" },
      art: "river",
    },
    {
      id: "write",
      date: "2026-10-09",
      title: "Findings written up",
      body: "Each group turns their measurements into charts and a short report. This is where the numbers start to tell a story.",
      forYou: "Ask at dinner what their group found. They'll know by now.",
    },
    {
      id: "drafts",
      date: "2026-11-06",
      title: "Posters drafted",
      body: "First drafts of the exhibition posters, read over by Ms Kavanagh and one other group.",
    },
    {
      id: "print",
      date: "2026-11-27",
      title: "Posters printed",
      body: "Final posters go to print, A1 and in colour, courtesy of the Parents' Association.",
      art: "poster",
    },
  ],
  runningOrder: [
    { time: "6:30pm", minutes: 18 * 60 + 30, what: "Doors open", where: "The school hall" },
    { time: "6:45pm", minutes: 18 * 60 + 45, what: "Welcome from Ms Kavanagh", where: "At the stage" },
    { time: "7:00pm", minutes: 19 * 60, what: "Walk the posters", where: "Ask the students anything" },
    { time: "8:00pm", minutes: 20 * 60, what: "Tea and scones", where: "In the canteen" },
  ],
  dayNotes: [
    { label: "Parking", value: "Staff car park, gate on Church Road" },
    { label: "Bring", value: "Nothing. Questions welcome" },
    { label: "Finishes", value: "Around half eight" },
  ],
  since: (d) => `${d} ${d === 1 ? "day" : "days"} since the exhibition`,
  afterCover: "Thank you for coming",
  afterBody: "The posters are going up in the main corridor for the rest of term. Thank you for the questions.",
  emptyLine: "The project is only getting started. The story will fill in here as the class works through it.",
  updatedBy: "Ms Kavanagh",
  calendarTitle: "River study exhibition evening",
};

export const AUDIENCES: Record<Audience, AudienceSeed> = { wedding: WEDDING, launch: LAUNCH, class: CLASS };

/* ── day arithmetic ────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
export function dayNum(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
export function isoOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}
function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", ...opts }).format(new Date(dayNum(iso) * DAY_MS));
}
export const fmtLong = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtDay = (iso: string) => fmt(iso, { day: "numeric" });
export const fmtMonth = (iso: string) => fmt(iso, { month: "long" });
export const fmtMonthShort = (iso: string) => fmt(iso, { month: "short" });
export const fmtYear = (iso: string) => fmt(iso, { year: "numeric" });
export const fmtWeekday = (iso: string) => fmt(iso, { weekday: "long" });
export const fmtDM = (iso: string) => fmt(iso, { day: "numeric", month: "short" });
export const fmtDMY = (iso: string) => fmt(iso, { day: "numeric", month: "long", year: "numeric" });

function inWords(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30.4)} months`;
}

/* ── the story the page renders ────────────────────────────────────── */

export type Status = "done" | "next" | "planned";
export type Chapter = ChapterSeed & { n: number; status: Status; statusLine: string };

export type Story = {
  audience: Audience;
  state: PreviewState;
  name: string;
  from: string;
  place: string;
  placeShort: string;
  day: string;
  today: string;
  dayTitle: string;
  dayBody: string;
  dayofBody: string;
  welcome: string[];
  signoff: string;
  chapters: Chapter[];
  /** Index of the first chapter still to come; chapters.length when all are done. */
  todayIndex: number;
  runningOrder: RunItem[];
  dayNotes: { label: string; value: string }[];
  daysToGo: number;
  /** The countdown line, e.g. "239 days to go" or "Married 3 days ago". */
  countNumber: string;
  countWords: string;
  since: string | null;
  afterCover: string;
  afterBody: string;
  emptyLine: string;
  updated: string;
  calendarTitle: string;
  /** Minutes past midnight on the day, used by the day-of preview. */
  nowMinutes: number | null;
  /** First date on the path. */
  start: string;
};

export function buildStory(audience: Audience, state: PreviewState): Story {
  const seed = AUDIENCES[audience];
  const dayN = dayNum(seed.day);
  let seeds = seed.chapters;
  let today = TODAY;
  if (state === "early") {
    seeds = seeds.slice(0, 2);
    today = isoOf(Math.max(dayNum(seeds[1].date) + 7, dayN - (audience === "wedding" ? 409 : 150)));
  } else if (state === "dayof") today = seed.day;
  else if (state === "after") today = isoOf(dayN + 3);
  else if (state === "empty") {
    seeds = [];
    today = audience === "wedding" ? "2026-02-20" : isoOf(dayN - 170);
  }
  const todayN = dayNum(today);
  const firstUpcoming = seeds.findIndex((c) => dayNum(c.date) > todayN);
  const todayIndex = firstUpcoming === -1 ? seeds.length : firstUpcoming;

  const chapters: Chapter[] = seeds.map((c, i) => {
    const d = dayNum(c.date);
    const status: Status = d <= todayN ? "done" : i === todayIndex ? "next" : "planned";
    const month = fmtMonth(c.date) + (fmtYear(c.date) !== fmtYear(today) ? ` ${fmtYear(c.date)}` : "");
    const statusLine =
      status === "done" ? `Done in ${month}` : status === "next" ? `Happening next, ${inWords(d - todayN)}` : `Planned for ${month}`;
    return { ...c, n: i + 1, status, statusLine };
  });

  const daysToGo = dayN - todayN;
  const since = daysToGo < 0 ? seed.since(-daysToGo) : null;
  const countNumber = daysToGo > 0 ? String(daysToGo) : "";
  const countWords = daysToGo > 1 ? "days to go" : daysToGo === 1 ? "day to go" : daysToGo === 0 ? "Today is the day" : (since ?? "");

  return {
    audience,
    state,
    name: state === "long" ? seed.longName : seed.name,
    from: seed.from,
    place: seed.place,
    placeShort: seed.placeShort,
    day: seed.day,
    today,
    dayTitle: seed.dayTitle,
    dayBody: seed.dayBody,
    dayofBody: seed.dayofBody,
    welcome: seed.welcome,
    signoff: seed.signoff,
    chapters,
    todayIndex,
    runningOrder: seed.runningOrder,
    dayNotes: seed.dayNotes,
    daysToGo,
    countNumber,
    countWords,
    since,
    afterCover: seed.afterCover,
    afterBody: seed.afterBody,
    emptyLine: seed.emptyLine,
    updated: `Last updated ${state === "after" ? "yesterday" : "2 days ago"} by ${seed.updatedBy}`,
    calendarTitle: seed.calendarTitle,
    nowMinutes: state === "dayof" ? (audience === "wedding" ? 12 * 60 + 40 : 17 * 60 + 50) : null,
    start: chapters[0]?.date ?? today,
  };
}

/* ── calendar file ─────────────────────────────────────────────────── */

export function icsFor(story: Story): string {
  const d = story.day.replaceAll("-", "");
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}00`;
  const first = story.runningOrder[0];
  const last = story.runningOrder[story.runningOrder.length - 1];
  const end = Math.min(last.minutes + 180, 23 * 60 + 59);
  const desc = story.runningOrder.map((r) => `${r.time}  ${r.what}, ${r.where.toLowerCase()}`).join("\\n");
  const esc = (s: string) => s.replace(/[,;]/g, (m) => `\\${m}`);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Signal Studio//Shared timeline//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${story.audience}-${d}@share.signalstudio.ie`,
    `DTSTAMP:${story.today.replaceAll("-", "")}T090000Z`,
    `DTSTART:${d}T${hm(first.minutes)}`,
    `DTEND:${d}T${hm(end)}`,
    `SUMMARY:${esc(story.calendarTitle)}`,
    `LOCATION:${esc(story.place)}`,
    `DESCRIPTION:${esc(desc)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
