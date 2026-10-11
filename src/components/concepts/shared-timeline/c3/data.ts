/* The Invitation Suite: sample data. Three worlds (a wedding, a public
   supper club, a school exhibition evening) and five moments in the life of
   the link. Everything is invented and front-end only. */

export type WorldId = "wedding" | "supper" | "school";
export type Moment = "live" | "announced" | "closed" | "dayof" | "postponed" | "long";

export type Format =
  | "date" // a postcard with the date set large
  | "letter" // a formal card inside a double rule
  | "reply" // deckled reply card with form lines
  | "ticket" // a ticket with a perforated stub
  | "menu" // a tall menu card
  | "seats" // a seating plan: every seat is one dot
  | "schedule" // an order of events
  | "map" // a drawn map of the grounds
  | "note"; // a folded note

export type Status = "done" | "next" | "later" | "info" | "soon";

export type ScheduleRow = { day?: string; time: string; what: string; where: string };

export type Back =
  | { kind: "text"; heading: string; body: string[] }
  | { kind: "calendar"; heading: string; body: string }
  | { kind: "note"; heading: string; body: string; placeholder: string }
  | { kind: "schedule"; heading: string; rows: ScheduleRow[]; foot?: string }
  | { kind: "directions"; heading: string; rows: { how: string; text: string }[] };

export type Piece = {
  id: string;
  format: Format;
  title: string;
  /** ISO date of the milestone, when it has one. */
  date?: string;
  /** The verb a postmark uses once the milestone is done. */
  doneWord: string;
  /** One line, readable on the table. */
  lead: string;
  body?: string[];
  schedule?: ScheduleRow[];
  map?: "orchard" | "school";
  seats?: { total: number; taken: number };
  menu?: string[];
  price?: string;
  /** Set large on a date card instead of the milestone's own date. */
  big?: string;
  /** How many guests have replied so far, one mark each on the back. */
  replies?: { in: number; of: number };
  /** Numbered stops on a map card, in walking order. */
  stops?: { name: string; what: string }[];
  back: Back;
};

export type World = {
  id: WorldId;
  label: string;
  /** Short name for the sample picker. */
  kind: string;
  title: string;
  kicker: string;
  /** Printed on the sealed envelope, under the title. */
  greeting: string;
  monogram: string;
  day: string;
  time?: string;
  place: string;
  placeLong: string;
  host: string;
  updated: string;
  ink: "claret" | "orchard" | "navy";
  stamps: { what: string; date: string }[];
  runOrder: { time: string; what: string }[];
  pieces: Piece[];
  replyId: string;
  closedText: string;
  postponed: { day: string; note: string; shifts: Record<string, string>; leads?: Record<string, string> };
  todayFor: Record<Exclude<Moment, "long" | "postponed" | "live">, string>;
};

export const TODAY = "2026-09-25";

const orchardWays = [
  { how: "By car", text: "Take the N11 south to Rathnew, then follow the Aughrim road for 14 km. The gate is on the left after the stone bridge. Park in the paddock." },
  { how: "By coach", text: "A coach leaves Dawson Street, Dublin at 12.30 and comes back from the barn at 00.30." },
  { how: "On foot", text: "It is a flat, ten-minute walk from the gate to the barn, lit after dark." },
];

const wedding: World = {
  id: "wedding",
  label: "Mara & Finn",
  kind: "Wedding",
  title: "Mara & Finn",
  kicker: "are getting married",
  greeting: "would love you to follow along",
  monogram: "M & F",
  day: "2027-05-22",
  place: "The Orchard, Co. Wicklow",
  placeLong: "The Orchard, Ballinacor, Co. Wicklow",
  host: "Mara & Finn",
  updated: "Updated 9 September",
  ink: "claret",
  stamps: [
    { what: "Venue booked", date: "2026-04-03" },
    { what: "Menu chosen", date: "2026-08-01" },
    { what: "Band booked", date: "2026-09-09" },
  ],
  runOrder: [
    { time: "1.30pm", what: "Gates open" },
    { time: "2pm", what: "Ceremony on the orchard lawn" },
    { time: "3pm", what: "Drinks on the terrace" },
    { time: "6pm", what: "Dinner in the barn" },
    { time: "9pm", what: "The band" },
    { time: "12.30am", what: "Coaches back to Dublin" },
  ],
  replyId: "reply",
  closedText: "Replies are closed · thank you",
  postponed: {
    day: "2027-09-11",
    note: "We have moved the day to Saturday 11 September. The Orchard, the plan and the people all stay the same, and we cannot wait to see you then.",
    shifts: { reply: "2027-05-14", weekend: "2027-09-10" },
    leads: { weekend: "Friday to Sunday, 10 to 12 September", savedate: "Keep Saturday 11 September free" },
  },
  todayFor: { announced: "2026-06-14", closed: "2027-01-20", dayof: "2027-05-22" },
  pieces: [
    {
      id: "savedate",
      format: "date",
      title: "Save the date",
      date: "2026-06-12",
      doneWord: "Sent",
      lead: "Keep Saturday 22 May free",
      big: "day",
      back: {
        kind: "text",
        heading: "Save the date",
        body: [
          "We sent this card to 142 of you on 12 June.",
          "If it never reached you, this page has everything it said, and more as it happens.",
        ],
      },
    },
    {
      id: "invitation",
      format: "letter",
      title: "Invitations",
      date: "2026-10-16",
      doneWord: "Posted",
      lead: "In the post on 16 October",
      body: ["A printed invitation is on its way to every guest, with the full details of the day."],
      back: {
        kind: "text",
        heading: "Moved house?",
        body: [
          "Tell Mara or Finn before 10 October so your invitation goes to the right door.",
          "Families with children get one card with every name on it.",
        ],
      },
    },
    {
      id: "reply",
      format: "reply",
      title: "Reply card",
      date: "2027-01-15",
      doneWord: "Closed",
      lead: "Please reply by 15 January",
      replies: { in: 38, of: 112 },
      back: {
        kind: "calendar",
        heading: "Keep it in mind",
        body: "Put the day in your calendar, or have this page nudge you a week before replies close.",
      },
    },
    {
      id: "weekend",
      format: "schedule",
      title: "The weekend",
      date: "2027-05-21",
      doneWord: "Began",
      lead: "Friday to Sunday, 21 to 23 May",
      schedule: [
        { day: "Friday", time: "7pm", what: "Welcome drinks", where: "Kavanagh's, Aughrim" },
        { day: "Saturday", time: "2pm", what: "Ceremony", where: "The orchard lawn" },
        { day: "Sunday", time: "11am", what: "Brunch", where: "The terrace" },
      ],
      back: {
        kind: "schedule",
        heading: "Saturday, hour by hour",
        rows: [
          { time: "1.30pm", what: "Gates open", where: "The lane" },
          { time: "2pm", what: "Ceremony", where: "Orchard lawn" },
          { time: "3pm", what: "Drinks", where: "The terrace" },
          { time: "6pm", what: "Dinner", where: "The barn" },
          { time: "9pm", what: "The band", where: "The barn" },
        ],
        foot: "Garden formal. The lawn is soft, so leave the stilettos at home.",
      },
    },
    {
      id: "travel",
      format: "map",
      title: "Getting there",
      doneWord: "",
      lead: "The Orchard, Ballinacor, Co. Wicklow",
      map: "orchard",
      stops: [
        { name: "The gate", what: "Park in the paddock" },
        { name: "Orchard lawn", what: "The ceremony" },
        { name: "The terrace", what: "Drinks" },
        { name: "The barn", what: "Dinner and dancing" },
      ],
      back: { kind: "directions", heading: "Getting there", rows: orchardWays },
    },
    {
      id: "gifts",
      format: "note",
      title: "Gifts and notes",
      doneWord: "",
      lead: "Your being there is the gift",
      body: [
        "If you would like to mark the day, we are saving for a slow trip around the Azores next spring.",
      ],
      back: {
        kind: "note",
        heading: "Leave us a note",
        body: "We will read every one on the morning of the day.",
        placeholder: "Write something for Mara and Finn",
      },
    },
  ],
};

const supper: World = {
  id: "supper",
  label: "Harvest Supper Club",
  kind: "Supper club",
  title: "Harvest Supper Club",
  kicker: "at The Orchard",
  greeting: "would love you at the long table",
  monogram: "H S",
  day: "2026-10-17",
  time: "7pm",
  place: "Long tables in the barn · 120 seats",
  placeLong: "The Orchard, Ballinacor, Co. Wicklow",
  host: "The Orchard",
  updated: "Updated 22 September",
  ink: "orchard",
  stamps: [
    { what: "Growers chosen", date: "2026-08-20" },
    { what: "Tables built", date: "2026-09-12" },
    { what: "Candles in", date: "2026-09-22" },
  ],
  runOrder: [
    { time: "6.30pm", what: "Doors open, cider outside" },
    { time: "7pm", what: "Seated at the long tables" },
    { time: "7.15pm", what: "Five courses, one after another" },
    { time: "10pm", what: "Fireside and fiddles" },
    { time: "11.30pm", what: "Last bus to Rathdrum" },
  ],
  replyId: "seats",
  closedText: "Every seat is taken · thank you",
  postponed: {
    day: "2026-10-24",
    note: "The barn roof needs one more week of mending, so supper moves to Saturday 24 October, same time. Your ticket carries over as it is.",
    shifts: { seats: "2026-10-17", evening: "2026-10-24", menu: "2026-10-08" },
  },
  todayFor: { announced: "2026-09-02", closed: "2026-10-12", dayof: "2026-10-17" },
  pieces: [
    {
      id: "tickets",
      format: "ticket",
      title: "Tickets on sale",
      date: "2026-09-01",
      doneWord: "Opened",
      lead: "Five courses, cider and wine",
      price: "€65",
      back: {
        kind: "text",
        heading: "About tickets",
        body: [
          "Tickets went on sale on 1 September and 94 of 120 seats have gone.",
          "One ticket is one seat at the long table. Children under 12 eat free with an adult.",
        ],
      },
    },
    {
      id: "menu",
      format: "menu",
      title: "The menu",
      date: "2026-10-01",
      doneWord: "Announced",
      lead: "The full menu arrives 1 October",
      menu: ["Bread and orchard butter", "Something from the walled garden", "Something from the river", "Something from the fire", "Apple, three ways"],
      back: {
        kind: "text",
        heading: "What we can say now",
        body: [
          "Five courses, all grown or caught within 30 km of the barn.",
          "Every course has a vegetarian version. Tell the kitchen about allergies by 10 October.",
        ],
      },
    },
    {
      id: "seats",
      format: "seats",
      title: "Last seats",
      date: "2026-10-10",
      doneWord: "Closed",
      lead: "Booking closes 10 October",
      seats: { total: 120, taken: 94 },
      back: {
        kind: "calendar",
        heading: "Keep it in mind",
        body: "Put the evening in your calendar, or have this page nudge you a week before booking closes.",
      },
    },
    {
      id: "evening",
      format: "schedule",
      title: "The evening",
      date: "2026-10-17",
      doneWord: "Began",
      lead: "Saturday 17 October, from 7pm",
      schedule: [
        { time: "7pm", what: "Cider in the orchard", where: "Under the trees" },
        { time: "7.45pm", what: "Supper", where: "The long tables" },
        { time: "10pm", what: "Fireside music", where: "The terrace" },
      ],
      back: {
        kind: "schedule",
        heading: "The evening, hour by hour",
        rows: [
          { time: "6.30pm", what: "Doors open", where: "The gate" },
          { time: "7pm", what: "Cider", where: "The orchard" },
          { time: "7.45pm", what: "Supper", where: "The barn" },
          { time: "10pm", what: "Fireside", where: "The terrace" },
          { time: "11.30pm", what: "Last bus", where: "The gate" },
        ],
        foot: "Bring a warm layer. The barn is heated, the terrace is not.",
      },
    },
    {
      id: "travel",
      format: "map",
      title: "Getting there",
      doneWord: "",
      lead: "The Orchard, Ballinacor, Co. Wicklow",
      map: "orchard",
      stops: [
        { name: "The gate", what: "Park in the paddock" },
        { name: "Orchard lawn", what: "Cider under the trees" },
        { name: "The terrace", what: "Fireside music" },
        { name: "The barn", what: "Supper" },
      ],
      back: { kind: "directions", heading: "Getting there", rows: orchardWays },
    },
    {
      id: "notes",
      format: "note",
      title: "Allergies and notes",
      doneWord: "",
      lead: "Tell the kitchen what you cannot eat",
      body: ["Every dish can change. Tell us by 10 October and it will be on your plate, not in it."],
      back: {
        kind: "note",
        heading: "A note for the kitchen",
        body: "The chef reads these on the Friday before.",
        placeholder: "For example: no nuts, and my partner is vegetarian",
      },
    },
  ],
};

const school: World = {
  id: "school",
  label: "St Brigid's",
  kind: "School evening",
  title: "5th Year Exhibition Evening",
  kicker: "St Brigid's Community School",
  greeting: "would love you to see the year's work",
  monogram: "S B",
  day: "2026-12-10",
  time: "7pm",
  place: "Main hall and art rooms",
  placeLong: "St Brigid's Community School, Bray, Co. Wicklow",
  host: "Ms Doyle and 5th Year",
  updated: "Updated 21 September",
  ink: "navy",
  stamps: [
    { what: "Rooms booked", date: "2026-09-02" },
    { what: "Letter home", date: "2026-09-11" },
    { what: "Topics chosen", date: "2026-09-18" },
  ],
  runOrder: [
    { time: "6.45pm", what: "Doors open, tea in the hall" },
    { time: "7pm", what: "Welcome from Ms Doyle" },
    { time: "7.20pm", what: "Walk the rooms with your student" },
    { time: "8.15pm", what: "Five short talks from students" },
    { time: "9pm", what: "Home time" },
  ],
  replyId: "reply",
  closedText: "Replies are closed · thank you",
  postponed: {
    day: "2026-12-17",
    note: "Mock exams moved, so the evening moves one week to Thursday 17 December, same time. The students are using the week well.",
    shifts: { reply: "2026-12-10", programme: "2026-12-17" },
  },
  todayFor: { announced: "2026-09-20", closed: "2026-12-05", dayof: "2026-12-10" },
  pieces: [
    {
      id: "topics",
      format: "date",
      title: "Topics chosen",
      date: "2026-09-18",
      doneWord: "Chosen",
      lead: "questions, one for every student",
      big: "28",
      back: {
        kind: "text",
        heading: "What they chose",
        body: [
          "28 students, 28 questions, from why the Dargle floods to how a violin is made.",
          "Ask your student about theirs. They will enjoy telling you.",
        ],
      },
    },
    {
      id: "halfway",
      format: "letter",
      title: "Halfway showing",
      date: "2026-10-30",
      doneWord: "Shown",
      lead: "Work in progress shown in class on 30 October",
      body: ["Each student shows the class where their piece has got to, and gets two ideas back."],
      back: {
        kind: "text",
        heading: "How you can help",
        body: ["Ask to see the sketchbook, not the finished thing. The messy middle is the point."],
      },
    },
    {
      id: "handin",
      format: "letter",
      title: "Pieces handed in",
      date: "2026-11-20",
      doneWord: "Handed in",
      lead: "Finished work is due on 20 November",
      body: ["Pieces go to the art room by 4pm, labelled with a name and a title."],
      back: {
        kind: "text",
        heading: "Large or fragile pieces",
        body: ["Tell Ms Doyle by 13 November and the caretaker will collect it from the car park."],
      },
    },
    {
      id: "reply",
      format: "reply",
      title: "Reply card",
      date: "2026-12-03",
      doneWord: "Closed",
      lead: "Please reply by 3 December",
      replies: { in: 9, of: 28 },
      back: {
        kind: "calendar",
        heading: "Keep it in mind",
        body: "Put the evening in your calendar, or have this page nudge you a week before replies close.",
      },
    },
    {
      id: "programme",
      format: "schedule",
      title: "The programme",
      date: "2026-12-10",
      doneWord: "Began",
      lead: "Thursday 10 December, from 7pm",
      schedule: [
        { time: "7pm", what: "Welcome", where: "Main hall" },
        { time: "7.20pm", what: "Walk the rooms", where: "Art rooms 1 to 3" },
        { time: "8.15pm", what: "Student talks", where: "Main hall" },
      ],
      back: {
        kind: "schedule",
        heading: "The five talks",
        rows: [
          { time: "8.15pm", what: "Why the Dargle floods", where: "Aoife" },
          { time: "8.25pm", what: "A violin, from a plank", where: "Tomás" },
          { time: "8.35pm", what: "Bray in 1926", where: "Precious" },
          { time: "8.45pm", what: "Growing light", where: "Oisín" },
          { time: "8.55pm", what: "My nana's recipes", where: "Wiktoria" },
        ],
        foot: "Talks are five minutes each. Tea and biscuits after.",
      },
    },
    {
      id: "travel",
      format: "map",
      title: "Getting there",
      doneWord: "",
      lead: "St Brigid's, Vevay Road, Bray",
      map: "school",
      stops: [
        { name: "Back gate", what: "Park here" },
        { name: "Reception", what: "Sign in, get a programme" },
        { name: "Main hall", what: "Welcome and talks" },
        { name: "Art rooms", what: "The work itself" },
      ],
      back: {
        kind: "directions",
        heading: "Getting there",
        rows: [
          { how: "By car", text: "Use the back gate on Vevay Road. The front car park is kept for wheelchair users." },
          { how: "By DART", text: "Bray station is a twelve-minute walk. Students will meet the 6.40 arrival." },
          { how: "Inside", text: "Follow the painted footprints from reception to the main hall." },
        ],
      },
    },
  ],
};

export const WORLDS: Record<WorldId, World> = { wedding, supper, school };

export const MOMENTS: { id: Moment; label: string; hint: string }[] = [
  { id: "live", label: "As it stands", hint: "Today, with some cards done" },
  { id: "announced", label: "Just announced", hint: "Only the first card is out" },
  { id: "closed", label: "Replies closed", hint: "The deadline has passed" },
  { id: "dayof", label: "On the day", hint: "The main card becomes today" },
  { id: "postponed", label: "New date", hint: "The day has moved" },
  { id: "long", label: "Long names", hint: "Two long Irish names" },
];

/* ── Dates ─────────────────────────────────────────────────────────── */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, t: Date.UTC(y, m - 1, d) };
}
export const dayNum = (iso: string) => parts(iso).t / 86_400_000;
export const daysBetween = (a: string, b: string) => Math.round(dayNum(b) - dayNum(a));
export const fmtDM = (iso: string) => {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1]}`;
};
export const fmtShort = (iso: string) => {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1].slice(0, 3)}`;
};
export const fmtLong = (iso: string) => {
  const p = parts(iso);
  return `${DAYS[new Date(p.t).getUTCDay()]} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
};
export const fmtWeekday = (iso: string) => DAYS[new Date(parts(iso).t).getUTCDay()];
export const fmtMonthYear = (iso: string) => {
  const p = parts(iso);
  return `${MONTHS[p.m - 1]} ${p.y}`;
};
export const fmtNumeric = (iso: string) => {
  const p = parts(iso);
  return `${p.d}.${p.m}.${String(p.y).slice(2)}`;
};
export const yearOf = (iso: string) => parts(iso).y;

/** A stable pseudo-random number in [-1, 1] from a string, for card tilt. */
export function seeded(key: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2001) / 1000 - 1;
}

/* ── The suite for a world at a moment ─────────────────────────────── */

export type SuitePiece = Piece & {
  n: number;
  status: Status;
  placeholder?: boolean;
  closed?: boolean;
  /** Days from today to the milestone (negative once passed). */
  inDays?: number;
};

export type Suite = {
  world: World;
  moment: Moment;
  today: string;
  day: string;
  oldDay?: string;
  daysToGo: number;
  title: string;
  /** Who the suite is from, as it reads in a sentence. */
  host: string;
  monogram: string;
  pieces: SuitePiece[];
  next?: SuitePiece;
  doneCount: number;
  datedCount: number;
  replyClosed: boolean;
};

export function buildSuite(worldId: WorldId, moment: Moment): Suite {
  const world = WORLDS[worldId];
  const today =
    moment === "announced" || moment === "closed" || moment === "dayof"
      ? world.todayFor[moment]
      : TODAY;
  const postponed = moment === "postponed";
  const day = postponed ? world.postponed.day : world.day;
  const long = moment === "long" && worldId === "wedding";

  let seenNext = false;
  const pieces: SuitePiece[] = world.pieces.map((p, i) => {
    const date = postponed && world.postponed.shifts[p.id] ? world.postponed.shifts[p.id] : p.date;
    let status: Status = "info";
    let inDays: number | undefined;
    if (date) {
      inDays = daysBetween(today, date);
      if (inDays < 0 || (inDays === 0 && moment === "dayof")) status = "done";
      else if (!seenNext) {
        status = "next";
        seenNext = true;
      } else status = "later";
    }
    const placeholder = moment === "announced" && i > 0;
    const lead = postponed && world.postponed.leads?.[p.id] ? world.postponed.leads[p.id] : p.lead;
    return {
      ...p,
      lead,
      date,
      n: i + 1,
      status: placeholder ? "soon" : status,
      placeholder,
      closed: p.id === world.replyId && status === "done",
      inDays,
    };
  });

  const title = long ? "Aoibheann Ní Mhurchú & Fionnbarra O'Sullivan-Whelan" : world.title;
  const monogram = long ? "A & F" : world.monogram;
  const dated = pieces.filter((p) => p.date && !p.placeholder);
  return {
    world,
    moment,
    today,
    day,
    oldDay: postponed ? world.day : undefined,
    daysToGo: daysBetween(today, day),
    title,
    host: long ? "Aoibheann & Fionnbarra" : world.host,
    monogram,
    pieces,
    next: pieces.find((p) => p.status === "next"),
    doneCount: dated.filter((p) => p.status === "done").length,
    datedCount: dated.length,
    replyClosed: pieces.some((p) => p.closed),
  };
}

/** A calendar file for the day, built in the browser. */
export function icsFor(suite: Suite) {
  const d = suite.day.replaceAll("-", "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Signal Studio//Invitation Suite//EN",
    "BEGIN:VEVENT",
    `UID:${suite.world.id}-${d}@signalstudio.ie`,
    `DTSTART;VALUE=DATE:${d}`,
    `SUMMARY:${suite.title}`,
    `LOCATION:${suite.world.placeLong}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
