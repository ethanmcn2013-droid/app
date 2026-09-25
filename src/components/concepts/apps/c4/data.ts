/* Ask for a tool: sample data. Invented, believable, Friday 25 September 2026. */

export type Hue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const hueVar = (h: Hue) => `var(--v3-project-${h})`;

export type ProjectId = "mf" | "orchard" | "river" | "hollis" | "night";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  hue: Hue;
  detail: string;
  /** The day the Project is building towards, if it has one. */
  day?: { iso: string; label: string; what: string };
  empty?: boolean;
  suppliers: string[];
};

export const PROJECTS: Project[] = [
  {
    id: "mf",
    name: "Mara & Finn wedding",
    short: "Mara & Finn",
    hue: 8,
    detail: "Wedding, Saturday 17 October",
    day: { iso: "2026-10-17T14:00:00", label: "Saturday 17 October", what: "the ceremony at 2pm" },
    suppliers: ["Bloom & Wild", "The Hollow Band", "Farrell's Catering"],
  },
  {
    id: "hollis",
    name: "Hollis Cafe launch",
    short: "Hollis Cafe",
    hue: 5,
    detail: "Opens Monday 2 November",
    day: { iso: "2026-11-02T08:00:00", label: "Monday 2 November", what: "doors open at 8am" },
    suppliers: ["Roast Co.", "Kiln Print", "Dublin Tiles"],
  },
  {
    id: "orchard",
    name: "The Orchard, events",
    short: "The Orchard",
    hue: 3,
    detail: "Venue, 11 events this autumn",
    day: { iso: "2026-10-03T19:00:00", label: "Saturday 3 October", what: "the Kelly 50th" },
    suppliers: ["Farrell's Catering", "Lumen AV", "Greenfield Linen"],
  },
  {
    id: "river",
    name: "Riverside survey",
    short: "Riverside survey",
    hue: 2,
    detail: "Group essay, due 23 October",
    day: { iso: "2026-10-23T17:00:00", label: "Friday 23 October", what: "the essay hand-in at 5pm" },
    suppliers: [],
  },
  {
    id: "night",
    name: "Opening night",
    short: "Opening night",
    hue: 6,
    detail: "New, nothing in it yet",
    empty: true,
    suppliers: [],
  },
];

export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

/** The fixed moment every preview is computed from, so server and client agree. */
export const NOW_ISO = "2026-09-25T14:20:00";

export const daysUntil = (iso: string, from = NOW_ISO) =>
  Math.ceil((new Date(iso.slice(0, 10)).getTime() - new Date(from.slice(0, 10)).getTime()) / 86_400_000);

/* ── the catalogue ─────────────────────────────────────────────────── */

export type Glyph =
  | "guests" | "form" | "seating" | "clock" | "list" | "timer" | "wallet" | "coins" | "receipt"
  | "hourglass" | "check" | "megaphone" | "split" | "calendar" | "mail" | "chat" | "forward"
  | "note" | "book" | "chart" | "card" | "folder" | "rota" | "press" | "sun" | "template" | "grid" | "gift";

export type ToolId =
  | "guests" | "rsvp" | "seating" | "dayplan" | "runsheet" | "budget" | "deposits" | "receipts"
  | "payments" | "countdown" | "checklist" | "social" | "press" | "split" | "deadlines" | "studytimer"
  | "sources" | "survey" | "email" | "whatsapp" | "forward" | "notes" | "calsync" | "drive"
  | "rota" | "bookings" | "templates" | "weather" | "gifts" | "forms";

export type Tool = {
  id: ToolId;
  name: string;
  glyph: Glyph;
  hue: Hue;
  /** One plain line: what it is for. */
  line: string;
  /** Where its data comes from, in plain words. */
  reads: string;
  /** How to start it when there is nothing yet. */
  start: string;
  /** The verb on the keep button: "Keep this guest list". */
  noun: string;
};

export const TOOLS: Tool[] = [
  { id: "guests", name: "Guest list", glyph: "guests", hue: 8, noun: "guest list", line: "Who is coming, who said no, and who has not replied", reads: "Names in your notes and tasks, and replies from your RSVP form", start: "Paste names, or share a link so guests add themselves" },
  { id: "rsvp", name: "RSVP form", glyph: "form", hue: 1, noun: "RSVP form", line: "Guests answer themselves from one link", reads: "Your guest list, and the date of the day", start: "Write the question once and share the link" },
  { id: "seating", name: "Seating plan", glyph: "seating", hue: 3, noun: "seating plan", line: "Tables, and who sits where", reads: "Everyone who said yes on the guest list", start: "Add tables, then drag names onto them" },
  { id: "dayplan", name: "Day plan", glyph: "clock", hue: 5, noun: "day plan", line: "The day hour by hour, so everyone knows what happens when", reads: "Dated tasks on Timeline, and times in your notes", start: "Add the first thing that happens, and the time" },
  { id: "runsheet", name: "Run-sheet", glyph: "list", hue: 6, noun: "run-sheet", line: "The running order your suppliers and staff follow", reads: "Your day plan, with a line for each supplier", start: "Start from your day plan, or add steps by hand" },
  { id: "budget", name: "Budget", glyph: "wallet", hue: 4, noun: "budget", line: "What you planned to spend, and what you have", reads: "Costs on tasks, and payments you record", start: "Set a total, then add the first cost" },
  { id: "deposits", name: "Deposits due", glyph: "coins", hue: 4, noun: "deposits list", line: "Money you are waiting on, and when it is due", reads: "Payments you record against bookings", start: "Add who owes what, and by when" },
  { id: "receipts", name: "Receipts", glyph: "receipt", hue: 3, noun: "receipt box", line: "Snap a receipt, and it adds itself to the total", reads: "Photos of receipts you take or forward", start: "Take a photo of your first receipt" },
  { id: "payments", name: "Card payments", glyph: "card", hue: 2, noun: "payment link", line: "Take a deposit by card from a link", reads: "A card account the Project owner connects", start: "Connect a card account to make your first link" },
  { id: "countdown", name: "Countdown", glyph: "hourglass", hue: 7, noun: "countdown", line: "Days to the day that matters, with the milestones on the way", reads: "The Project date, and milestones on Timeline", start: "Pick the day you are counting to" },
  { id: "checklist", name: "Checklist", glyph: "check", hue: 3, noun: "checklist", line: "A plain list to tick through, with a date if you want one", reads: "Items you add", start: "Add the first thing to tick off" },
  { id: "social", name: "Social calendar", glyph: "megaphone", hue: 7, noun: "social calendar", line: "Posts planned for the next two weeks", reads: "Posts you draft here, and dates on Timeline", start: "Draft your first post and give it a day" },
  { id: "press", name: "Press list", glyph: "press", hue: 1, noun: "press list", line: "Who you have pitched, and who wrote back", reads: "Contacts you add, and replies you log", start: "Add the first writer or paper you want to reach" },
  { id: "split", name: "Who has what", glyph: "split", hue: 2, noun: "split", line: "Each person's part of the work, and how far along it is", reads: "Headings in your notes, and who each task belongs to", start: "Name the parts, then give each one to a person" },
  { id: "deadlines", name: "Deadlines", glyph: "calendar", hue: 7, noun: "deadlines view", line: "The next hand-in, counted down", reads: "Dated tasks marked as a hand-in", start: "Mark a task as a hand-in to see it here" },
  { id: "studytimer", name: "Study timer", glyph: "timer", hue: 6, noun: "study timer", line: "Twenty-five minutes of focus, then a break", reads: "Nothing. It keeps time on this device", start: "Press start" },
  { id: "sources", name: "Sources", glyph: "book", hue: 5, noun: "source list", line: "Every article and book you will cite", reads: "Links and files you add", start: "Paste the first link you want to cite" },
  { id: "survey", name: "Survey replies", glyph: "chart", hue: 2, noun: "survey counter", line: "Replies coming in, day by day", reads: "Replies to a form you share", start: "Share your form to start counting" },
  { id: "email", name: "Email to tasks", glyph: "mail", hue: 2, noun: "email connection", line: "Supplier emails arrive as tasks on the right Project", reads: "One Gmail or Outlook inbox you connect", start: "Connect an inbox" },
  { id: "whatsapp", name: "WhatsApp group", glyph: "chat", hue: 4, noun: "WhatsApp connection", line: "New messages from one group, next to the work", reads: "One WhatsApp group you connect", start: "Pick a group to connect" },
  { id: "forward", name: "Forwarding address", glyph: "forward", hue: 1, noun: "forwarding address", line: "Forward any email to the Project and it becomes a task", reads: "Only the emails you forward", start: "Copy the address and forward an email to it" },
  { id: "notes", name: "Notes", glyph: "note", hue: 6, noun: "notes", line: "Quick thoughts, filed to the right Project", reads: "Notes you write or say", start: "Write the first note" },
  { id: "calsync", name: "Calendar sync", glyph: "calendar", hue: 7, noun: "calendar sync", line: "Keep Google or Apple Calendar in step with Timeline", reads: "Your Google or Apple Calendar", start: "Connect a calendar" },
  { id: "drive", name: "File drive", glyph: "folder", hue: 2, noun: "file drive", line: "Contracts, photos and plans in one shared place", reads: "Files you add, or a Google Drive folder", start: "Drop in the first file" },
  { id: "rota", name: "Staff rota", glyph: "rota", hue: 1, noun: "rota", line: "Who is working each event, and who has not confirmed", reads: "People on the Project and the shifts you set", start: "Add the first shift" },
  { id: "bookings", name: "Bookings", glyph: "grid", hue: 3, noun: "bookings calendar", line: "Every event in the room, month by month", reads: "Events you confirm in Tasks", start: "Confirm your first booking" },
  { id: "templates", name: "Templates", glyph: "template", hue: 5, noun: "template", line: "Start a new Project from one that worked", reads: "Projects you choose to copy", start: "Pick a Project to copy" },
  { id: "weather", name: "Weather for the day", glyph: "sun", hue: 5, noun: "weather watch", line: "The forecast for the day, from ten days out", reads: "The Project date and place", start: "Set the place" },
  { id: "gifts", name: "Gift list", glyph: "gift", hue: 8, noun: "gift list", line: "What people gave, and who you have thanked", reads: "Names from your guest list", start: "Add the first gift" },
  { id: "forms", name: "Forms", glyph: "form", hue: 6, noun: "form", line: "Ask anyone anything, and the answers land here", reads: "Answers to forms you share", start: "Write your first question" },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;

/* ── already on ────────────────────────────────────────────────────── */

export type OnItem = { tool: ToolId; project: ProjectId | "all"; used: string };

export const ALREADY_ON: OnItem[] = [
  { tool: "budget", project: "mf", used: "Used today" },
  { tool: "countdown", project: "mf", used: "Used today" },
  { tool: "notes", project: "all", used: "Used today" },
  { tool: "bookings", project: "orchard", used: "Used yesterday" },
  { tool: "whatsapp", project: "orchard", used: "Used Tuesday" },
  { tool: "press", project: "hollis", used: "Used Monday" },
  { tool: "studytimer", project: "river", used: "Used last week" },
];

/* ── the guest list, as found in Mara's note ───────────────────────── */

export type Reply = "yes" | "waiting" | "no";
export type Guest = {
  name: string;
  side: "Mara's side" | "Finn's side" | "Friends";
  reply: Reply;
  from: "note" | "task";
  meal?: "Beef" | "Hake" | "Veggie";
  plusOne?: boolean;
};

const HANDPICKED: Guest[] = [
  { name: "Declan Byrne", side: "Mara's side", reply: "yes", from: "note", meal: "Beef", plusOne: true },
  { name: "Róisín Byrne", side: "Mara's side", reply: "yes", from: "note", meal: "Hake" },
  { name: "Aunt Bernie Doherty", side: "Mara's side", reply: "waiting", from: "task" },
  { name: "Tomás Ó Súilleabháin", side: "Finn's side", reply: "yes", from: "note", meal: "Veggie" },
  { name: "Grace Adeyemi", side: "Friends", reply: "yes", from: "note", meal: "Hake", plusOne: true },
  { name: "Luca Moretti", side: "Friends", reply: "no", from: "task" },
  { name: "Niamh Kelly", side: "Finn's side", reply: "yes", from: "note", meal: "Beef" },
  { name: "Oisín Kelly", side: "Finn's side", reply: "waiting", from: "note" },
  { name: "Saoirse Walsh", side: "Friends", reply: "yes", from: "note", meal: "Veggie", plusOne: true },
  { name: "Fionn Brady", side: "Finn's side", reply: "yes", from: "task", meal: "Beef" },
];

const FIRSTS = ["Aoife", "Cian", "Maeve", "Conor", "Ciara", "Rory", "Orla", "Darragh", "Sinéad", "Eoin", "Clodagh", "Pádraig", "Hannah", "Seán", "Aisling", "Kevin", "Emer", "Ronan", "Laura", "Dara", "Ailbhe", "Shane", "Fiona", "Colm", "Megan", "Tadhg", "Éabha", "Barry", "Yvonne", "Mícheál", "Priya", "Jonas", "Chloe", "Liam", "Sorcha", "Niall", "Ella", "Brendan"];
const SURNAMES = ["Murphy", "Ryan", "O'Connor", "Nolan", "Fitzgerald", "Keane", "Lynch", "Quinn", "Farrell", "Hayes", "Duffy", "Kavanagh", "Power", "Carroll", "Healy", "McCarthy", "Burke", "Daly", "Nowak", "Reilly", "Byrne", "Doherty", "Walsh"];
const SIDES: Guest["side"][] = ["Mara's side", "Finn's side", "Friends"];
const MEALS: NonNullable<Guest["meal"]>[] = ["Beef", "Hake", "Veggie"];

function buildGuests(): Guest[] {
  const out = [...HANDPICKED];
  // Fixed reply counts for the rest: 112 yes, 27 waiting and 9 no in total.
  const want = { yes: 112 - 7, waiting: 27 - 2, no: 9 - 1 };
  const rest = 148 - HANDPICKED.length;
  const replies: Reply[] = [];
  for (let i = 0; i < rest; i++) {
    const k = (i * 47) % rest; // a fixed shuffle
    replies.push(k < want.no ? "no" : k < want.no + want.waiting ? "waiting" : "yes");
  }
  // Tasks hold 9 of the names in total; three are handpicked above.
  const fromTask = new Set([11, 29, 44, 63, 87, 118]);
  for (let i = 0; i < rest; i++) {
    const first = FIRSTS[i % FIRSTS.length];
    const last = SURNAMES[(i * 5 + Math.floor(i / FIRSTS.length)) % SURNAMES.length];
    const reply = replies[i];
    out.push({
      name: `${first} ${last}`,
      side: SIDES[(i * 7) % 3],
      reply,
      from: fromTask.has(i) ? "task" : "note",
      meal: reply === "yes" && i % 4 !== 1 ? MEALS[(i * 3) % 3] : undefined,
      plusOne: reply === "yes" && i % 6 === 2,
    });
  }
  return out;
}

export const GUESTS: Guest[] = buildGuests();

export const GUEST_COUNTS = {
  total: GUESTS.length,
  yes: GUESTS.filter((g) => g.reply === "yes").length,
  waiting: GUESTS.filter((g) => g.reply === "waiting").length,
  no: GUESTS.filter((g) => g.reply === "no").length,
  meals: GUESTS.filter((g) => g.meal).length,
  plusOnes: GUESTS.filter((g) => g.plusOne).length,
  fromTasks: GUESTS.filter((g) => g.from === "task").length,
};

export const GUEST_NOTE = {
  title: "Guests",
  author: "Mara",
  date: "2 September",
  lines: [
    "Final-ish list. Ticks are people who told us yes.",
    "Byrne side: Declan ✓ (+1), Róisín ✓, Aoife ✓, Cian ✓",
    "Aunt Bernie, still no word. Finn to ring her?",
    "Kellys: Niamh ✓, Oisín (asked for a week)",
    "College: Grace ✓ +1, Saoirse ✓ +1, Luca (can't, in Milan)",
  ],
  marks: ["Declan", "Róisín", "Aoife", "Cian", "Bernie", "Niamh", "Oisín", "Grace", "Saoirse", "Luca"],
};

export const GUEST_TASKS = [
  "Ring Aunt Bernie about the date",
  "Chase Luca's reply (he's in Milan)",
  "Add Finn's rugby lot: Fionn Brady and two more",
  "Ask Oisín if he's bringing anyone",
  "Invite the Nowaks from next door",
  "Check numbers with Farrell's Catering",
  "Book rooms for the Healys",
  "Send save-the-date to Priya",
  "Confirm Tomás is doing a reading",
];

/* ── other previews ────────────────────────────────────────────────── */

export const DAY_PLAN = [
  { t: "10:00", what: "Hair and make-up at the Byrnes'", who: "Mara, bridesmaids", from: "note" },
  { t: "12:30", what: "Photos in the orchard", who: "Aine, photographer", from: "task" },
  { t: "13:40", what: "Guests arrive, the band plays", who: "The Hollow Band", from: "task" },
  { t: "14:00", what: "Ceremony", who: "Fr. Walsh", from: "timeline" },
  { t: "15:00", what: "Drinks on the lawn", who: "Farrell's Catering", from: "task" },
  { t: "17:30", what: "Dinner is served", who: "Farrell's Catering", from: "timeline" },
  { t: "19:10", what: "Speeches, four minutes each", who: "Declan, Grace, Finn", from: "note" },
  { t: "21:00", what: "First dance, then the band", who: "The Hollow Band", from: "timeline" },
] as const;

export const BUDGET_HOLLIS = {
  total: 42000,
  lines: [
    { what: "Fit-out and tiling", amount: 21400, from: "4 tasks" },
    { what: "Espresso machine", amount: 8900, from: "a task" },
    { what: "Signage and print", amount: 3150, from: "2 tasks" },
    { what: "Opening week stock", amount: 2700, from: "a note" },
  ],
};

export const BUDGET_MF = { spent: 18400, total: 21000, over: "Flowers are €340 over" };

export const SPLIT = [
  { who: "Ayo", part: "Introduction and method", words: 620, of: 800, hue: 2 as Hue },
  { who: "Kate", part: "The river survey results", words: 1240, of: 1600, hue: 4 as Hue },
  { who: "Dev", part: "What the results mean", words: 380, of: 1200, hue: 5 as Hue },
  { who: "Lin", part: "Conclusion and sources", words: 90, of: 600, hue: 8 as Hue },
];

export const MILESTONES: Record<ProjectId, { d: string; what: string; done?: boolean }[]> = {
  hollis: [
    { d: "2026-09-18", what: "Lease signed", done: true },
    { d: "2026-10-05", what: "Tiling finished" },
    { d: "2026-10-12", what: "Menu to print" },
    { d: "2026-10-30", what: "Friends and family morning" },
    { d: "2026-11-02", what: "Doors open" },
  ],
  mf: [
    { d: "2026-09-02", what: "Invites out", done: true },
    { d: "2026-10-01", what: "Replies close" },
    { d: "2026-10-09", what: "Final numbers to Farrell's" },
    { d: "2026-10-17", what: "The day" },
  ],
  orchard: [
    { d: "2026-09-28", what: "Menu tasting" },
    { d: "2026-10-03", what: "Kelly 50th" },
  ],
  river: [
    { d: "2026-10-09", what: "First draft to Ms Doyle" },
    { d: "2026-10-23", what: "Hand-in" },
  ],
  night: [],
};

export const EMAILS: Record<ProjectId, { from: string; subject: string; task: string; when: string }[]> = {
  mf: [
    { from: "Bloom & Wild", subject: "Re: peonies are out of season", task: "Pick a flower instead of peonies", when: "9:12" },
    { from: "Farrell's Catering", subject: "Final numbers by 9 October please", task: "Send final numbers to Farrell's", when: "Yesterday" },
    { from: "The Hollow Band", subject: "Setlist for the first dance", task: "Choose the first dance song", when: "Tuesday" },
  ],
  hollis: [
    { from: "Roast Co.", subject: "Grinder delivery window", task: "Be in for the grinder delivery", when: "10:40" },
    { from: "Kiln Print", subject: "Menu proofs attached", task: "Sign off the menu proofs", when: "Yesterday" },
    { from: "Dublin Tiles", subject: "Grout colour?", task: "Choose the grout colour", when: "Monday" },
  ],
  orchard: [
    { from: "Lumen AV", subject: "Projector for the Kelly 50th", task: "Confirm the projector for 3 October", when: "8:55" },
    { from: "Greenfield Linen", subject: "Invoice 2231", task: "Pay Greenfield Linen", when: "Yesterday" },
    { from: "Farrell's Catering", subject: "Tasting on the 28th", task: "Add the menu tasting to Timeline", when: "Monday" },
  ],
  river: [],
  night: [],
};
