/* Your tool shelf: sample data. Invented, believable, one week in late September. */

export type Size = "s" | "m" | "l";
export type ProjectId = "orchard" | "mf" | "river" | "hollis" | "night";
export type GroupId = "all" | ProjectId;
export type Kind = "wedding" | "venue" | "study" | "launch";

export type ToolId =
  | "countdown"
  | "guests"
  | "budget"
  | "dayplan"
  | "seating"
  | "notes"
  | "whatsapp"
  | "email"
  | "calendar"
  | "bookings"
  | "runsheet"
  | "suppliers"
  | "deposits"
  | "rota"
  | "payments"
  | "deadlines"
  | "timer"
  | "groupsplit"
  | "sources"
  | "survey"
  | "press"
  | "social"
  | "proofs"
  | "checklist"
  | "weather"
  | "gifts"
  | "photos"
  | "forms"
  | "drive";

/** Identity hues: the fixed project-1..8 tiles, where white passes AA in both themes. */
export type Hue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const hueVar = (h: Hue) => `var(--v3-project-${h})`;

export type Tool = {
  id: ToolId;
  name: string;
  /** One plain line for the drawer. */
  line: string;
  does: string;
  reads: string;
  hue: Hue;
  sizes: Size[];
  size: Size;
  goodFor: Kind[];
};

export const TOOLS: Tool[] = [
  { id: "countdown", name: "Countdown", line: "Days to the big day, always in view", does: "Counts down to the date that matters and shows how much planning time is left.", reads: "The Project date", hue: 8, sizes: ["s", "m", "l"], size: "m", goodFor: ["wedding", "launch"] },
  { id: "guests", name: "Guest list", line: "Who is coming, who said no, who has not replied", does: "Keeps every invite and reply in one list, and chases the people who have not answered.", reads: "Replies from your RSVP link, and names you add", hue: 1, sizes: ["s", "m", "l"], size: "l", goodFor: ["wedding", "launch"] },
  { id: "budget", name: "Budget", line: "What you planned to spend, and what you have", does: "Adds up every quote and payment so you can see what is left and where it is running over.", reads: "Costs on tasks, and payments you record", hue: 4, sizes: ["s", "m", "l"], size: "m", goodFor: ["wedding", "launch"] },
  { id: "dayplan", name: "Day plan", line: "The day, step by step, with times", does: "Lays out the day minute by minute so everyone knows what happens when.", reads: "Steps you add, and dated tasks in Timeline", hue: 5, sizes: ["s", "m", "l"], size: "s", goodFor: ["wedding"] },
  { id: "seating", name: "Seating", line: "Tables and who sits where", does: "Puts your guests at tables and shows which tables still have empty seats.", reads: "Everyone who said yes on the Guest list", hue: 3, sizes: ["s", "m"], size: "s", goodFor: ["wedding", "venue"] },
  { id: "notes", name: "Notes", line: "The latest thought, before it gets lost", does: "Shows your newest notes from this Project so a quick thought is never far away.", reads: "Notes filed to this Project", hue: 6, sizes: ["s", "m", "l"], size: "s", goodFor: ["wedding", "venue", "study", "launch"] },
  { id: "whatsapp", name: "WhatsApp group", line: "New messages from a group you choose", does: "Brings one WhatsApp group into view, so supplier updates are not buried in your phone.", reads: "One WhatsApp group you connect", hue: 4, sizes: ["s", "m"], size: "s", goodFor: ["wedding", "venue", "launch"] },
  { id: "email", name: "Email inbox", line: "Replies from one inbox, next to the work", does: "Shows new email from one address, and turns any message into a task.", reads: "One Gmail or Outlook inbox you connect", hue: 2, sizes: ["s", "m"], size: "s", goodFor: ["venue", "launch"] },
  { id: "calendar", name: "Calendar sync", line: "Keep Google or Apple Calendar in step", does: "Puts dated tasks in your calendar and shows what is on today.", reads: "Your Google or Apple Calendar", hue: 7, sizes: ["s", "m"], size: "s", goodFor: ["venue", "study"] },
  { id: "bookings", name: "Bookings", line: "Every event in the room, month by month", does: "Shows every booked date at a glance, with the busy weeks standing out.", reads: "Events you confirm in Tasks", hue: 3, sizes: ["s", "m", "l"], size: "l", goodFor: ["venue"] },
  { id: "runsheet", name: "Run-sheet", line: "The night's running order for the team", does: "The running order your staff follow on the night, shared with suppliers.", reads: "The couple's Day plan, and your house steps", hue: 5, sizes: ["s", "m"], size: "m", goodFor: ["venue"] },
  { id: "suppliers", name: "Suppliers", line: "Florists, bands and caterers in one place", does: "Keeps every supplier's contact, and what they are bringing, in one list.", reads: "Contacts you add or import", hue: 2, sizes: ["s", "m"], size: "s", goodFor: ["venue", "wedding"] },
  { id: "deposits", name: "Deposits due", line: "Money you are waiting on, and when", does: "Lists deposits and balances by due date so nothing slips past.", reads: "Payments you record on bookings", hue: 4, sizes: ["s", "m"], size: "s", goodFor: ["venue"] },
  { id: "rota", name: "Staff rota", line: "Who is on, and who still needs to confirm", does: "Shows who is working each event, and who has not said yes to a shift.", reads: "People in this Project and the shifts you set", hue: 1, sizes: ["s", "m"], size: "m", goodFor: ["venue"] },
  { id: "payments", name: "Card payments", line: "Take deposits by card", does: "Lets clients pay a deposit by card from a link.", reads: "A card account the owner connects", hue: 2, sizes: ["s"], size: "s", goodFor: ["venue"] },
  { id: "deadlines", name: "Deadlines", line: "The next hand-in, counted down", does: "Counts down to each hand-in so the group can see the next one coming.", reads: "Dated tasks marked as a hand-in", hue: 7, sizes: ["s", "m"], size: "m", goodFor: ["study"] },
  { id: "timer", name: "Study timer", line: "Twenty-five minutes of focus, then a break", does: "A simple focus timer. Start it, work until it rings, take five.", reads: "Nothing. It keeps time on this device", hue: 6, sizes: ["s", "m"], size: "s", goodFor: ["study"] },
  { id: "groupsplit", name: "Who has what", line: "Each person's part, and how far along it is", does: "Shows who is doing which part of the work, and how much of it is done.", reads: "Tasks and who they belong to", hue: 1, sizes: ["s", "m", "l"], size: "m", goodFor: ["study"] },
  { id: "sources", name: "Sources", line: "Every article and book you will cite", does: "Collects your references and tells you which ones nobody has read yet.", reads: "Links and files you add", hue: 5, sizes: ["s", "m"], size: "s", goodFor: ["study"] },
  { id: "survey", name: "Survey replies", line: "Replies coming in, day by day", does: "Counts replies to your form and shows how many more you need.", reads: "Replies to a form you share", hue: 2, sizes: ["s", "m"], size: "m", goodFor: ["study"] },
  { id: "press", name: "Press list", line: "Who you have pitched, and who wrote back", does: "Tracks every journalist and writer you contact, and what they said.", reads: "Contacts you add, and replies you log", hue: 8, sizes: ["s", "m"], size: "m", goodFor: ["launch"] },
  { id: "social", name: "Social calendar", line: "Posts planned for the next two weeks", does: "Plans posts across the next fortnight so the feed never goes quiet.", reads: "Posts you draft here", hue: 7, sizes: ["s", "m"], size: "m", goodFor: ["launch"] },
  { id: "proofs", name: "Proofs waiting", line: "Designs waiting for your yes", does: "Collects designs that need your approval and nudges you when they wait.", reads: "Images and PDFs added to Files", hue: 6, sizes: ["s", "m"], size: "s", goodFor: ["launch", "wedding"] },
  { id: "checklist", name: "Checklist", line: "A simple list for the night", does: "A plain list you tick through on the day, shared with everyone helping.", reads: "Items you add", hue: 3, sizes: ["s", "m", "l"], size: "m", goodFor: ["launch", "venue", "wedding"] },
  { id: "weather", name: "Weather on the day", line: "The forecast, from ten days out", does: "Shows the forecast for the date once it is close enough to trust.", reads: "The Project date and place", hue: 2, sizes: ["s", "m"], size: "s", goodFor: ["wedding", "venue", "launch"] },
  { id: "gifts", name: "Gift list", line: "Gifts received and thank-you cards sent", does: "Logs each gift as it arrives and who still needs a thank-you card.", reads: "Gifts you log", hue: 8, sizes: ["s", "m"], size: "s", goodFor: ["wedding"] },
  { id: "photos", name: "Photo drop", line: "Guests add their photos after the day", does: "A private link where guests add photos, collected in one album.", reads: "Photos guests upload", hue: 1, sizes: ["s", "m"], size: "s", goodFor: ["wedding", "launch"] },
  { id: "forms", name: "Forms", line: "Questions out, answers in as tasks", does: "Send a short form. Each answer arrives as a task you can act on.", reads: "Answers to forms you share", hue: 5, sizes: ["s", "m"], size: "s", goodFor: ["venue", "study"] },
  { id: "drive", name: "Google Drive", line: "Drive folders beside your files", does: "Shows the latest files in one Drive folder, next to your Project files.", reads: "One Google Drive folder you connect", hue: 3, sizes: ["s", "m"], size: "s", goodFor: ["study", "venue"] },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;

export type Project = {
  id: ProjectId;
  name: string;
  hue: Hue;
  kind: Kind;
  /** For the drawer heading: "Good for weddings". */
  goodForLabel: string;
  when: string;
  isNew?: boolean;
};

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard", hue: 3, kind: "venue", goodForLabel: "Good for venues", when: "Venue, 7 events in October" },
  { id: "mf", name: "Mara & Finn", hue: 8, kind: "wedding", goodForLabel: "Good for weddings", when: "Wedding, Saturday 17 October" },
  { id: "river", name: "Riverside survey", hue: 2, kind: "study", goodForLabel: "Good for group projects", when: "Group project, hand-in 22 October" },
  { id: "hollis", name: "Hollis Cafe launch", hue: 5, kind: "launch", goodForLabel: "Good for launches", when: "Launch, Wednesday 7 October" },
  { id: "night", name: "Opening night", hue: 6, kind: "launch", goodForLabel: "Good for launches", when: "Event, Thursday 5 November", isNew: true },
];
export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

export type WidgetState = "ok" | "locked" | "error" | "loading";
export type Widget = {
  wid: string;
  tool: ToolId;
  project: ProjectId;
  size: Size;
  state?: WidgetState;
  lockedBy?: string;
};

let seq = 0;
const w = (tool: ToolId, project: ProjectId, size: Size, extra: Partial<Widget> = {}): Widget => ({
  wid: `w${++seq}`,
  tool,
  project,
  size,
  ...extra,
});

export const INITIAL: Record<GroupId, Widget[]> = {
  all: [
    w("countdown", "mf", "m"),
    w("guests", "mf", "s"),
    w("deposits", "orchard", "s"),
    w("deadlines", "river", "m"),
    w("timer", "river", "s"),
    w("countdown", "hollis", "s"),
    w("budget", "mf", "m"),
    w("whatsapp", "mf", "s"),
    w("proofs", "hollis", "s"),
    w("runsheet", "orchard", "m"),
    w("notes", "mf", "s"),
    w("press", "hollis", "s"),
    w("groupsplit", "river", "m"),
    w("sources", "river", "s"),
    w("seating", "mf", "s"),
    w("suppliers", "orchard", "s"),
  ],
  orchard: [
    w("bookings", "orchard", "l"),
    w("runsheet", "orchard", "m"),
    w("suppliers", "orchard", "s"),
    w("deposits", "orchard", "s"),
    w("rota", "orchard", "m"),
    w("payments", "orchard", "s", { state: "locked", lockedBy: "Aoife" }),
    w("email", "orchard", "s"),
  ],
  mf: [
    w("countdown", "mf", "m"),
    w("guests", "mf", "l"),
    w("budget", "mf", "m"),
    w("dayplan", "mf", "s"),
    w("seating", "mf", "s"),
    w("notes", "mf", "s"),
    w("whatsapp", "mf", "s"),
  ],
  river: [
    w("deadlines", "river", "m"),
    w("timer", "river", "s"),
    w("sources", "river", "s"),
    w("groupsplit", "river", "m"),
    w("survey", "river", "m"),
  ],
  hollis: [
    w("countdown", "hollis", "s"),
    w("proofs", "hollis", "s"),
    w("press", "hollis", "m"),
    w("social", "hollis", "m"),
    w("guests", "hollis", "m", { state: "error" }),
  ],
  night: [],
};

export const newWidget = (tool: ToolId, project: ProjectId, size?: Size): Widget =>
  w(tool, project, size ?? toolById(tool).size);

/** Suggestions for a brand-new Project. */
export const SUGGESTIONS: { tool: ToolId; title: string; reason: string }[] = [
  { tool: "countdown", title: "A countdown to the opening", reason: "Forty-one days. Everyone sees it the moment they open the Project." },
  { tool: "guests", title: "A guest list", reason: "Share one link. Replies land here on their own." },
  { tool: "checklist", title: "A checklist for the night", reason: "Tick through it on the door, with whoever is helping." },
];

/* ── sample numbers ─────────────────────────────────────────────── */

export const TODAY_LINE = "Friday 25 September";

export const COUNTDOWN: Record<ProjectId, { days: number; date: string; short: string; detail: string; startMonth: number; endMonth: number; since: string; left: { what: string; by: string }[] }> = {
  mf: { days: 22, date: "Saturday 17 October", short: "Sat 17 Oct", detail: "ceremony at 2pm", startMonth: 1, endMonth: 9.55, since: "Planning since February", left: [ { what: "Final numbers to The Orchard", by: "3 Oct" }, { what: "Seating plan signed off", by: "10 Oct" }, { what: "Collect the rings", by: "14 Oct" } ] },
  hollis: { days: 12, date: "Wednesday 7 October", short: "Wed 7 Oct", detail: "doors at 8am", startMonth: 6, endMonth: 9.2, since: "Planning since July", left: [ { what: "Menu boards printed", by: "1 Oct" }, { what: "Soft opening for friends", by: "5 Oct" } ] },
  night: { days: 41, date: "Thursday 5 November", short: "Thu 5 Nov", detail: "doors at 7pm", startMonth: 8.8, endMonth: 10.15, since: "Planning since today", left: [] },
  orchard: { days: 8, date: "Saturday 3 October", short: "Sat 3 Oct", detail: "Doyle 60th", startMonth: 8, endMonth: 9.1, since: "Next event", left: [] },
  river: { days: 27, date: "Thursday 22 October", short: "Thu 22 Oct", detail: "presentation", startMonth: 8, endMonth: 9.7, since: "Started in September", left: [] },
};

export type GuestData = { invited: number; yes: number; no: number; waiting: number; waitingNames: { name: string; party: string; since: string }[] };
export const GUESTS: Partial<Record<ProjectId, GuestData | null>> = {
  mf: {
    invited: 148,
    yes: 112,
    no: 9,
    waiting: 27,
    waitingNames: [
      { name: "Declan and Róisín Byrne", party: "Family of 4", since: "Invited 6 August" },
      { name: "Aunt Bernie Doherty", party: "Plus one", since: "Invited 6 August" },
      { name: "Tomás Ó Súilleabháin", party: "Just him", since: "Invited 12 August" },
      { name: "The Kellys from Clonakilty", party: "Couple", since: "Invited 12 August" },
    ],
  },
  hollis: {
    invited: 60,
    yes: 41,
    no: 3,
    waiting: 16,
    waitingNames: [
      { name: "Sadhbh at the Examiner", party: "Plus one", since: "Invited 9 September" },
      { name: "Cork Coffee Collective", party: "Three", since: "Invited 9 September" },
    ],
  },
  night: null,
};

export const BUDGET = {
  committed: 18400,
  total: 21000,
  over: { what: "Flowers", by: 340 },
  lines: [
    { what: "Venue and food", spent: 9800, plan: 9800 },
    { what: "Band and DJ", spent: 2600, plan: 2800 },
    { what: "Flowers", spent: 1840, plan: 1500 },
    { what: "Photos and video", spent: 2900, plan: 3200 },
    { what: "Everything else", spent: 1260, plan: 3700 },
  ],
};

export const DAYPLAN = {
  steps: 31,
  first: "9am",
  firstWhat: "Hair and make-up at the house",
  /** Minutes after 9am for each step, 9am to 1am. */
  marks: [0, 30, 90, 150, 210, 270, 285, 300, 330, 345, 360, 375, 390, 420, 450, 465, 480, 510, 540, 555, 570, 600, 615, 630, 660, 690, 720, 750, 780, 870, 960],
  next: [
    { time: "9:00", what: "Hair and make-up at the house" },
    { time: "12:30", what: "Cars leave for the church" },
    { time: "14:00", what: "Ceremony, St Brigid's" },
    { time: "15:30", what: "Drinks in the orchard garden" },
    { time: "18:00", what: "Dinner is served" },
  ],
};

export const SEATING = { set: 14, tables: 18, open: [3, 9, 12, 17], unseated: 22 };

export const NOTES: Partial<Record<ProjectId, { text: string; who: string; when: string }[]>> = {
  mf: [
    { text: "Finn's gran wants the Kerry hymn after the vows. Ask Fr. Walsh if the organist knows it.", who: "Mara", when: "2h ago" },
    { text: "Bloom & Wild can do peonies after all, but only in blush. Fine by us.", who: "Finn", when: "Yesterday" },
    { text: "Taxi rank closes at 1am. Book two minibuses back to Kinsale.", who: "Mara", when: "Tuesday" },
    { text: "Speeches: Dad, then Siobhán, then Finn. Five minutes each, strict.", who: "Finn", when: "Monday" },
  ],
  orchard: [{ text: "Walk-in fridge serviced Thursday. Keep the side door clear for the engineer.", who: "Aoife", when: "3h ago" }],
  river: [{ text: "Lecturer said 12 to 15 sources is plenty. We have 38, cut the weak ones.", who: "Priya", when: "Today" }],
  hollis: [{ text: "Oat milk supplier can't do the launch week. Try Glenilen as backup.", who: "Jess", when: "1h ago" }],
  night: [],
};

export const WHATSAPP: Partial<Record<ProjectId, { group: string; unread: number; msgs: { who: string; text: string; when: string }[] }>> = {
  mf: {
    group: "Suppliers group",
    unread: 3,
    msgs: [
      { who: "Bloom & Wild", text: "Petals arrive 11am on the day, straight to the church.", when: "10:42" },
      { who: "The Lost Brothers", text: "Can we load in at 5? Set list attached.", when: "09:15" },
      { who: "Orchard kitchen", text: "Menu tasting moved to Thursday 7pm.", when: "Yesterday" },
    ],
  },
  orchard: { group: "Floor staff", unread: 1, msgs: [{ who: "Ciarán", text: "Swapped Saturday with Neasa, all sorted.", when: "08:10" }] },
  hollis: { group: "Launch crew", unread: 5, msgs: [{ who: "Jess", text: "Signage fitter coming Monday at 8.", when: "11:02" }] },
};

export const BOOKINGS = {
  month: "October",
  /** Day of month to guests. 1 October 2026 is a Thursday. */
  events: [
    { day: 3, what: "Doyle 60th", guests: 80 },
    { day: 10, what: "Kavanagh wedding", guests: 160 },
    { day: 17, what: "Mara & Finn", guests: 148 },
    { day: 18, what: "Sunday lunch club", guests: 40 },
    { day: 24, what: "Byrne wedding", guests: 190 },
    { day: 30, what: "Harvest supper", guests: 70 },
    { day: 31, what: "Halloween quiz", guests: 55 },
  ],
  firstWeekday: 3, // Monday = 0
  days: 31,
};

export const RUNSHEET = {
  event: "Mara & Finn",
  date: "Saturday 17 October",
  line: "112 guests so far, load-in 8am",
  steps: [
    { time: "08:00", what: "Load-in" },
    { time: "13:30", what: "Guests arrive" },
    { time: "15:30", what: "Drinks" },
    { time: "18:00", what: "Dinner" },
  ],
};

export const SUPPLIERS = { count: 12, people: ["BW", "LB", "OK", "CP", "RM"] };
export const DEPOSITS = { count: 3, total: 4200, next: "Kavanagh, €1,800 on Monday" };
export const ROTA = {
  line: "Saturday 3 October, Doyle 60th",
  staff: [
    { i: "AO", ok: true },
    { i: "CM", ok: true },
    { i: "NB", ok: true },
    { i: "PL", ok: true },
    { i: "RD", ok: false },
    { i: "SK", ok: false },
  ],
};
export const EMAIL = { unread: 4, latest: { who: "Kavanagh wedding", text: "Can we swap the starter to the soup?" } };

export const DEADLINES = {
  headline: "Draft due in 9 days",
  steps: [
    { what: "Survey closes", date: "2 Oct", day: 7 },
    { what: "Draft", date: "4 Oct", day: 9 },
    { what: "Presentation", date: "22 Oct", day: 27 },
  ],
  span: 32,
};

export const GROUP = [
  { i: "AB", name: "Aisling", part: "Survey design", done: 1 },
  { i: "TM", name: "Tomás", part: "Reading and sources", done: 0.7 },
  { i: "PS", name: "Priya", part: "Crunching the replies", done: 0.35 },
  { i: "KA", name: "Kofi", part: "Slides", done: 0.1 },
];

export const SOURCES = { count: 38, unread: 6 };

export const SURVEY = { got: 64, need: 100, perDay: [2, 5, 9, 4, 3, 6, 8, 1, 0, 4, 7, 5, 6, 4] };

export const PRESS = {
  total: 18,
  replied: 5,
  booked: 2,
  rows: [
    { who: "Sadhbh Ní Bhriain", where: "Irish Examiner", state: "Feature booked" },
    { who: "Cork Eats podcast", where: "Episode 41", state: "Feature booked" },
    { who: "Rory Kiely", where: "Totally Cork", state: "Replied" },
  ],
};

export const SOCIAL = {
  planned: 9,
  next: "Monday 10am, the counter build",
  /** Posts per day for the next 14 days, from Saturday 26 September. */
  days: [0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 2, 0, 1, 1],
  letters: ["S", "S", "M", "T", "W", "T", "F", "S", "S", "M", "T", "W", "T", "F"],
};

export const PROOFS: Partial<Record<ProjectId, { count: number; first: string; wait: string }>> = {
  hollis: { count: 4, first: "Menu boards", wait: "waiting 2 days" },
  mf: { count: 2, first: "Order of service", wait: "waiting since Tuesday" },
};

export const WEATHER: Partial<Record<ProjectId, { ready: boolean; line: string; temp?: string }>> = {
  mf: { ready: false, line: "Too far out to trust. The forecast opens on 7 October." },
  orchard: { ready: true, line: "Saturday, light cloud, dry until 9pm", temp: "14°" },
  hollis: { ready: true, line: "Launch day looks bright and cold", temp: "12°" },
  night: { ready: false, line: "Too far out to trust. The forecast opens on 26 October." },
};

export const CORE_APPS = [
  { id: "tasks", name: "Tasks", hue: 1 as Hue, badge: 6, badgeLabel: "6 due this week" },
  { id: "timeline", name: "Timeline", hue: 3 as Hue, badge: 0, badgeLabel: "" },
  { id: "notes", name: "Notes", hue: 6 as Hue, badge: 0, badgeLabel: "" },
  { id: "files", name: "Files", hue: 2 as Hue, badge: 0, badgeLabel: "" },
] as const;
