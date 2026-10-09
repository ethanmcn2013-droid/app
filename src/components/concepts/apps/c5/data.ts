/* The workbench: invented sample data. Nothing here touches a server. */

export type ProjectId = "mf" | "orchard" | "riverside" | "hollis";

export type ToolId =
  | "tasks"
  | "seating"
  | "guests"
  | "dayplan"
  | "suppliers"
  | "timer"
  | "outline"
  | "split"
  | "study"
  | "social"
  | "press"
  | "proofs"
  | "notes"
  | "files"
  | "budget"
  | "forms"
  | "calendar"
  | "whatsapp"
  | "email";

export type Tool = {
  id: ToolId;
  name: string;
  /** What it does, in one plain line. */
  line: string;
  /** Tile colour: an identity token that carries white glyphs at AA. */
  hue: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Shelf in the More tools list. */
  shelf: "Plan the day" | "People" | "Money and paperwork" | "Study and write" | "Connections";
  /** First step, shown when the pane has nothing in it yet. */
  first: string;
  firstAction: string;
};

export const TOOLS: Tool[] = [
  { id: "tasks", name: "Tasks", line: "Everything that needs doing, and who is doing it.", hue: 1, shelf: "Plan the day", first: "Add the first thing that needs doing.", firstAction: "Add a task" },
  { id: "seating", name: "Seating", line: "Draw the room and place people at tables.", hue: 3, shelf: "People", first: "Pick a room shape, then drop guests onto tables.", firstAction: "Draw the room" },
  { id: "guests", name: "Guest list", line: "Who is coming, who has replied, who eats what.", hue: 8, shelf: "People", first: "Paste your guest list and replies start collecting themselves.", firstAction: "Paste a list" },
  { id: "dayplan", name: "Day plan", line: "The day hour by hour, from load-in to close.", hue: 5, shelf: "Plan the day", first: "Add the first step of the day, like load-in at 8am.", firstAction: "Add a step" },
  { id: "suppliers", name: "Suppliers", line: "Every supplier, their contact and when they arrive.", hue: 2, shelf: "People", first: "Add a supplier and their phone number, so anyone can call them.", firstAction: "Add a supplier" },
  { id: "timer", name: "Timer", line: "A big countdown to whatever is next on the day.", hue: 7, shelf: "Plan the day", first: "Pick a step on the Day plan and the timer counts down to it.", firstAction: "Pick a step" },
  { id: "outline", name: "Shared doc", line: "One outline the whole group writes into.", hue: 2, shelf: "Study and write", first: "Write the headings first. Everyone can claim one.", firstAction: "Add a heading" },
  { id: "split", name: "Group split", line: "Who is doing which part, kept fair.", hue: 4, shelf: "Study and write", first: "Add the people in your group, then hand out the parts.", firstAction: "Add people" },
  { id: "study", name: "Study timer", line: "Twenty-five minutes on, five off, together.", hue: 7, shelf: "Study and write", first: "Start a session and your group sees you are studying.", firstAction: "Start a session" },
  { id: "social", name: "Social calendar", line: "Posts planned across the week, in one view.", hue: 6, shelf: "Plan the day", first: "Drop in the first post and pick a day for it.", firstAction: "Plan a post" },
  { id: "press", name: "Press list", line: "Journalists, who replied and who covered it.", hue: 1, shelf: "People", first: "Add a journalist and the outlet they write for.", firstAction: "Add a journalist" },
  { id: "proofs", name: "Proof approvals", line: "Designs waiting for a yes, with notes on each.", hue: 8, shelf: "Money and paperwork", first: "Upload a design and ask someone to approve it.", firstAction: "Upload a proof" },
  { id: "notes", name: "Notes", line: "Quick notes that stay with the Project.", hue: 5, shelf: "Study and write", first: "Write anything. It stays with this Project.", firstAction: "Write a note" },
  { id: "files", name: "Files", line: "Contracts, menus and photos in one drive.", hue: 2, shelf: "Money and paperwork", first: "Drop a file here, like the venue contract.", firstAction: "Add a file" },
  { id: "budget", name: "Budget", line: "What you planned to spend, and what you have.", hue: 4, shelf: "Money and paperwork", first: "Add your first cost, like the venue deposit, and the total keeps itself.", firstAction: "Add a cost" },
  { id: "forms", name: "Forms", line: "A simple form for replies, orders or sign-ups.", hue: 3, shelf: "People", first: "Ask your first question, like 'Any food we should know about?'", firstAction: "Ask a question" },
  { id: "calendar", name: "Calendar sync", line: "Your dates, in the calendar you already use.", hue: 6, shelf: "Connections", first: "Connect Google or Outlook and dates show up there too.", firstAction: "Connect a calendar" },
  { id: "whatsapp", name: "WhatsApp", line: "Messages from a group, next to the work.", hue: 4, shelf: "Connections", first: "Link a group and new messages show up here.", firstAction: "Link a group" },
  { id: "email", name: "Email in", line: "Forward emails in and they become tasks.", hue: 1, shelf: "Connections", first: "Forward any email to your Project address to turn it into a task.", firstAction: "Copy the address" },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;

export type Project = { id: ProjectId; name: string; hue: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; owner: string; on: ToolId[]; suggest: ToolId[] };

export const PROJECTS: Project[] = [
  { id: "mf", name: "Mara & Finn", hue: 8, owner: "Mara", on: ["tasks", "seating", "guests", "dayplan", "timer", "notes"], suggest: ["seating", "guests", "dayplan"] },
  { id: "orchard", name: "The Orchard", hue: 4, owner: "Dara", on: ["tasks", "dayplan", "suppliers", "timer", "seating", "files"], suggest: ["dayplan", "suppliers", "timer"] },
  { id: "riverside", name: "Riverside study group", hue: 2, owner: "Priya", on: ["tasks", "outline", "split", "study", "files"], suggest: ["outline", "split", "study"] },
  { id: "hollis", name: "Hollis launch", hue: 6, owner: "Aoife", on: ["tasks", "social", "press", "proofs", "notes", "files"], suggest: ["social", "press", "proofs"] },
];

export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

/* ── benches ─────────────────────────────────────────────────────── */

export type PaneState = { id: string; tool: ToolId; weight: number; used: number };
export type Bench = { id: string; name: string; project: ProjectId; panes: PaneState[]; saved: boolean };

let seq = 0;
export const paneId = (tool: ToolId) => `${tool}-${(seq += 1)}`;

export const initialBenches = (firstVisit: boolean): Bench[] => {
  if (firstVisit) {
    return [{ id: "mf-week", name: "Mara & Finn: the week before", project: "mf", saved: false, panes: [{ id: "tasks-mf", tool: "tasks", weight: 1, used: 1 }] }];
  }
  return [
    {
      id: "mf-week",
      name: "Mara & Finn: the week before",
      project: "mf",
      saved: false,
      panes: [
        { id: "tasks-mf", tool: "tasks", weight: 0.95, used: 3 },
        { id: "seating-mf", tool: "seating", weight: 1.3, used: 2 },
        { id: "guests-mf", tool: "guests", weight: 0.9, used: 1 },
      ],
    },
    {
      id: "orchard-sat",
      name: "Saturday at The Orchard",
      project: "orchard",
      saved: true,
      panes: [
        { id: "dayplan-or", tool: "dayplan", weight: 1.1, used: 3 },
        { id: "suppliers-or", tool: "suppliers", weight: 1.15, used: 2 },
        { id: "timer-or", tool: "timer", weight: 0.85, used: 1 },
      ],
    },
    {
      id: "riverside-essay",
      name: "Riverside: essay week",
      project: "riverside",
      saved: true,
      panes: [
        { id: "outline-rv", tool: "outline", weight: 1.2, used: 3 },
        { id: "split-rv", tool: "split", weight: 1, used: 2 },
        { id: "study-rv", tool: "study", weight: 0.8, used: 1 },
      ],
    },
    {
      id: "hollis-press",
      name: "Hollis launch: press day",
      project: "hollis",
      saved: true,
      panes: [
        { id: "social-hl", tool: "social", weight: 1.25, used: 3 },
        { id: "press-hl", tool: "press", weight: 1, used: 2 },
        { id: "proofs-hl", tool: "proofs", weight: 0.95, used: 1 },
      ],
    },
  ];
};

/* ── time ────────────────────────────────────────────────────────── */

/** Minutes after midnight on the day; 1am the next morning is 25 * 60. */
export const fmtTime = (m: number) => {
  const h24 = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const suffix = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h}${suffix}` : `${h}:${String(mm).padStart(2, "0")}${suffix}`;
};

/* ── people ──────────────────────────────────────────────────────── */

export type Person = { name: string; initials: string; hue: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 };
export const PEOPLE: Record<string, Person> = {
  Mara: { name: "Mara Quinn", initials: "MQ", hue: 8 },
  Finn: { name: "Finn Walsh", initials: "FW", hue: 2 },
  Dara: { name: "Dara Hegarty", initials: "DH", hue: 4 },
  Aoife: { name: "Aoife Brennan", initials: "AB", hue: 6 },
  Priya: { name: "Priya Nair", initials: "PN", hue: 3 },
  Sam: { name: "Sam Doyle", initials: "SD", hue: 1 },
  Jonah: { name: "Jonah Kerr", initials: "JK", hue: 5 },
  Leah: { name: "Leah Byrne", initials: "LB", hue: 7 },
  Cian: { name: "Cian Moloney", initials: "CM", hue: 2 },
};

/* ── tasks ───────────────────────────────────────────────────────── */

export type Task = {
  id: string;
  project: ProjectId;
  title: string;
  note?: string;
  who: keyof typeof PEOPLE;
  day: string;
  done: boolean;
  /** Set when the task is placed on the Day plan. */
  at?: number;
  /** Live link to another tool's progress. */
  link?: "seating";
};

export const DAYS: Record<string, string> = {
  fri: "Today, Friday 25 September",
  mon: "Monday 28 September",
  wed: "Wednesday 30 September",
  thu: "Thursday 1 October",
  fri2: "Friday 2 October",
  sat: "Saturday 26 September",
  tue: "Tuesday 29 September",
};

export const TASKS: Task[] = [
  { id: "t1", project: "mf", title: "Confirm final numbers with chef", note: "149 so far, 3 vegan, 2 coeliac", who: "Mara", day: "fri", done: false },
  { id: "t2", project: "mf", title: "Send playlist to the band", who: "Finn", day: "fri", done: true },
  { id: "t3", project: "mf", title: "Speeches", note: "Finn's dad first, then Aoife, then Mara", who: "Finn", day: "mon", done: false },
  { id: "t4", project: "mf", title: "Pay the florist balance", note: "€640 to Bloom & Wild", who: "Mara", day: "mon", done: false },
  { id: "t5", project: "mf", title: "Collect rings from Weir & Sons", who: "Finn", day: "wed", done: false },
  { id: "t6", project: "mf", title: "Final dress fitting", who: "Mara", day: "wed", done: false },
  { id: "t7", project: "mf", title: "Seating plan due 2 Oct", who: "Mara", day: "fri2", done: false, link: "seating" },
  { id: "t8", project: "mf", title: "Print table names", note: "Once the seating plan is done", who: "Finn", day: "fri2", done: false },
  { id: "t9", project: "mf", title: "First dance lesson", who: "Finn", day: "thu", done: false },
  { id: "t10", project: "mf", title: "Book taxis for 1am", who: "Mara", day: "fri", done: true },

  { id: "o1", project: "orchard", title: "Check the marquee heaters", who: "Dara", day: "sat", done: true },
  { id: "o2", project: "orchard", title: "Brief bar staff on the 11pm last call", who: "Dara", day: "sat", done: false },
  { id: "o3", project: "orchard", title: "Sparklers: buckets of sand by the door", who: "Cian", day: "sat", done: false },
  { id: "o4", project: "orchard", title: "Lost property box at the gate", who: "Cian", day: "sat", done: false },

  { id: "r1", project: "riverside", title: "Finish the interview notes", who: "Jonah", day: "tue", done: false },
  { id: "r2", project: "riverside", title: "Find three sources on the 2009 flood", who: "Priya", day: "mon", done: true },
  { id: "r3", project: "riverside", title: "Draft the conclusion", who: "Leah", day: "wed", done: false },
  { id: "r4", project: "riverside", title: "Hand in by 5pm Friday", who: "Sam", day: "fri2", done: false },

  { id: "h1", project: "hollis", title: "Send the press kit to the long list", who: "Aoife", day: "fri", done: true },
  { id: "h2", project: "hollis", title: "Book the photographer for 10am", who: "Cian", day: "mon", done: false },
  { id: "h3", project: "hollis", title: "Final menu proof back to the printer", who: "Aoife", day: "mon", done: false },
  { id: "h4", project: "hollis", title: "Reply to The Echo about a tasting", who: "Cian", day: "tue", done: false },
];

/* ── seating and guests ─────────────────────────────────────────── */

export type Guest = { id: string; name: string; side: "Mara's side" | "Finn's side" | "Friends of both"; diet?: string; table: number | null };
export type Table = { n: number; seats: number };

export const TABLES: Table[] = Array.from({ length: 18 }, (_, i) => ({ n: i + 1, seats: 8 }));

const FIRST = [
  "Aisling", "Brendan", "Ciara", "Donal", "Éabha", "Fergal", "Gráinne", "Hugh", "Ita", "Jarlath", "Kate", "Liam", "Maeve", "Niall", "Orla", "Pádraig", "Róisín", "Seán", "Tara", "Ultan",
  "Una", "Colm", "Deirdre", "Emmet", "Fiona", "Gavin", "Helen", "Ian", "Joan", "Kevin", "Lorna", "Mark", "Nuala", "Owen", "Peggy", "Rory", "Sinéad", "Tom", "Vera", "Will",
];
const LAST = ["Byrne", "Doherty", "Kelly", "Murphy", "Ó Súilleabháin", "Walsh", "Quinn", "Brennan", "Moriarty", "Lynch", "Fitzgerald", "Nolan", "Keane", "Daly", "Hayes", "Power", "Tierney", "Crowley", "Mahon", "Egan"];
const DIETS = [undefined, undefined, undefined, "Vegetarian", undefined, undefined, "No nuts", undefined, "Vegan", undefined, undefined, "Coeliac", undefined];
const SIDES: Guest["side"][] = ["Mara's side", "Finn's side", "Friends of both"];

/** Seats taken per table: 14 full, 4 with room. */
const FILL: Record<number, number> = { 5: 5, 11: 3, 16: 2, 18: 0 };

const WAITING_NAMES = [
  "Declan Byrne", "Róisín Byrne", "Aunt Bernie Doherty", "Tomás Ó Súilleabháin", "Ellen Moriarty", "Conor Moriarty", "Nora Kelly", "Paddy Kelly", "Siobhán Hayes",
  "Grace Hayes", "Jim Tierney", "Marian Tierney", "Eoin Crowley", "Ailbhe Crowley", "Rachel Egan", "Dave Egan", "Uncle Mick Walsh", "Breda Walsh", "Lucy Power",
  "Ben Power", "Saoirse Mahon", "Kieran Lynch", "Anna Lynch", "Father Tom Walsh", "Clare Nolan", "Joe Daly", "Hannah Keane",
];

export const GUESTS: Guest[] = (() => {
  const out: Guest[] = [];
  let k = 0;
  const used = new Set(WAITING_NAMES);
  for (const t of TABLES) {
    const count = FILL[t.n] ?? t.seats;
    for (let s = 0; s < count; s += 1) {
      let name = "";
      do {
        name = `${FIRST[(k * 7 + s * 3) % FIRST.length]} ${LAST[(k * 3 + t.n) % LAST.length]}`;
        k += 1;
      } while (used.has(name));
      used.add(name);
      out.push({ id: `g${out.length + 1}`, name, side: SIDES[(t.n + s) % 3], diet: DIETS[k % DIETS.length], table: t.n });
    }
  }
  WAITING_NAMES.forEach((name, i) => out.push({ id: `w${i + 1}`, name, side: SIDES[i % 3], diet: DIETS[(i * 5) % DIETS.length], table: null }));
  return out;
})();

/* ── the day ─────────────────────────────────────────────────────── */

export type Step = { id: string; at: number; title: string; who: string; fromTask?: string };

const BASE_STEPS: [number, string, string][] = [
  [8 * 60, "Load-in: marquee crew and furniture", "Venue team"],
  [8 * 60 + 45, "Tables and chairs set in the barn", "Venue team"],
  [9 * 60 + 30, "Florists arrive", "Bloom & Wild"],
  [10 * 60, "Linen and place settings", "Linen Room"],
  [10 * 60 + 30, "Sound check with the band", "The Low Tides"],
  [11 * 60, "Hair and make-up start at the house", "Glow Studio"],
  [11 * 60 + 30, "Cake delivered to the kitchen", "Cake by Nell"],
  [12 * 60, "Staff briefing in the barn", "Dara"],
  [12 * 60 + 30, "Photographer arrives", "Weir Photography"],
  [13 * 60 + 15, "Ushers in place at the gate", "Ushers"],
  [13 * 60 + 30, "Guests arrive, drinks on the lawn", "Bar team"],
  [14 * 60, "Ceremony in the orchard", "Celebrant"],
  [14 * 60 + 40, "Confetti and group photos", "Weir Photography"],
  [15 * 60, "Drinks reception and canapés", "Bar team"],
  [15 * 60 + 45, "Couple portraits by the pond", "Weir Photography"],
  [16 * 60 + 30, "Guests called to the barn", "Dara"],
  [16 * 60 + 45, "Couple enter", "The Low Tides"],
  [17 * 60, "Starters served", "Kitchen"],
  [17 * 60 + 40, "Mains served", "Kitchen"],
  [18 * 60 + 30, "Dessert served", "Kitchen"],
  [19 * 60, "Tables cleared, tea and coffee", "Kitchen"],
  [20 * 60, "Cake cutting", "Cake by Nell"],
  [20 * 60 + 15, "First dance", "The Low Tides"],
  [20 * 60 + 30, "Band, first set", "The Low Tides"],
  [21 * 60 + 30, "Evening guests arrive", "Ushers"],
  [22 * 60, "Pizza oven opens", "Crust Brothers"],
  [22 * 60 + 45, "Band, second set", "The Low Tides"],
  [23 * 60 + 30, "Sparklers on the lawn", "Dara"],
  [24 * 60, "DJ until close", "Sparkle Sound"],
  [24 * 60 + 45, "Last orders", "Bar team"],
  [25 * 60, "Close, taxis at the gate", "Kinsale Cabs"],
];

export const MF_STEPS: Step[] = BASE_STEPS.map(([at, title, who], i) => ({ id: `s${i + 1}`, at, title, who }));
/** The Orchard's Saturday: same shape, speeches already on it. 31 steps. */
export const ORCHARD_STEPS: Step[] = [
  ...BASE_STEPS.filter((_, i) => i !== 27).map(([at, title, who], i) => ({ id: `os${i + 1}`, at, title, who })),
  { id: "os-speech", at: 19 * 60 + 30, title: "Speeches", who: "Best man, then the couple" },
].sort((a, b) => a.at - b.at);

/** On the Saturday bench, the day is live: 7:15:38pm. */
export const ORCHARD_NOW_SECONDS = (19 * 60 + 15) * 60 + 38;

export type Supplier = { id: string; name: string; role: string; person: string; phone: string; status: "here" | "due" | "gone"; when: string };
export const SUPPLIERS: Supplier[] = [
  { id: "p1", name: "The Low Tides", role: "Band", person: "Rob", phone: "+353 87 555 0141", status: "here", when: "Arrived 10:12am" },
  { id: "p2", name: "Cake by Nell", role: "Cake", person: "Nell", phone: "+353 86 555 0178", status: "here", when: "Back at 7:50pm to cut" },
  { id: "p3", name: "Weir Photography", role: "Photographer", person: "Ciarán", phone: "+353 85 555 0112", status: "here", when: "Until 9pm" },
  { id: "p4", name: "Crust Brothers", role: "Pizza oven", person: "Luca", phone: "+353 87 555 0190", status: "due", when: "Due 9:30pm" },
  { id: "p5", name: "Sparkle Sound", role: "DJ", person: "Jess", phone: "+353 83 555 0164", status: "due", when: "Due 11:30pm" },
  { id: "p6", name: "Kinsale Cabs", role: "Taxis", person: "Declan", phone: "+353 21 555 0107", status: "due", when: "Six cars at 1am" },
  { id: "p7", name: "Bloom & Wild", role: "Florist", person: "Orla", phone: "+353 86 555 0133", status: "gone", when: "Collects at 11am Sunday" },
  { id: "p8", name: "Linen Room", role: "Linen", person: "Siobhán", phone: "+353 21 555 0156", status: "gone", when: "Collects Monday" },
  { id: "p9", name: "Glow Studio", role: "Hair and make-up", person: "Amy", phone: "+353 87 555 0122", status: "gone", when: "Finished 1:05pm" },
  { id: "p10", name: "Hollow Oak Marquees", role: "Marquee", person: "Tadhg", phone: "+353 85 555 0187", status: "here", when: "On call all night" },
  { id: "p11", name: "Gatekeepers", role: "Security", person: "Martin", phone: "+353 87 555 0119", status: "here", when: "Until 1:30am" },
  { id: "p12", name: "Cork Ice Co.", role: "Ice and bar stock", person: "Fiona", phone: "+353 21 555 0170", status: "gone", when: "Dropped at 4pm" },
];

/* ── Riverside ───────────────────────────────────────────────────── */

export type Section = { id: string; title: string; who: keyof typeof PEOPLE; words: number; target: number; points: string[] };
export const OUTLINE: Section[] = [
  { id: "x1", title: "Introduction", who: "Sam", words: 310, target: 400, points: ["Open with the 2009 Lee flood", "Why memory matters for planning"] },
  { id: "x2", title: "How the city grew on the river", who: "Priya", words: 540, target: 500, points: ["Marsh land and the quays", "The 1850s culverts"] },
  { id: "x3", title: "The 2009 flood, hour by hour", who: "Priya", words: 620, target: 600, points: ["Dam release timeline", "Who was warned, and when"] },
  { id: "x4", title: "What people remember", who: "Jonah", words: 180, target: 700, points: ["Six interviews on the Mardyke", "Plaques and flood marks"] },
  { id: "x5", title: "The other side of the argument", who: "Leah", words: 90, target: 400, points: ["Cost of the flood walls", "Tourism and the quays"] },
  { id: "x6", title: "Conclusion", who: "Leah", words: 0, target: 300, points: [] },
];

/* ── Hollis ──────────────────────────────────────────────────────── */

export type Post = { id: string; day: number; time: string; channel: "Instagram" | "LinkedIn" | "Newsletter" | "TikTok"; title: string; state: "ready" | "draft" | "posted" };
export const POSTS: Post[] = [
  { id: "q1", day: 0, time: "9am", channel: "Instagram", title: "Doors open Saturday: first look at the roastery", state: "posted" },
  { id: "q2", day: 0, time: "1pm", channel: "LinkedIn", title: "Why we moved roasting back to Cork", state: "posted" },
  { id: "q3", day: 1, time: "8am", channel: "Newsletter", title: "Launch week: what to expect", state: "ready" },
  { id: "q4", day: 2, time: "12pm", channel: "Instagram", title: "Meet Noel, head roaster", state: "ready" },
  { id: "q5", day: 2, time: "6pm", channel: "TikTok", title: "Sixty seconds of the roaster warming up", state: "draft" },
  { id: "q6", day: 3, time: "9am", channel: "Instagram", title: "Press morning: tasting flight", state: "draft" },
  { id: "q7", day: 4, time: "10am", channel: "LinkedIn", title: "Thank you to the press who came", state: "draft" },
  { id: "q8", day: 5, time: "9am", channel: "Instagram", title: "Open to everyone from 8am", state: "ready" },
  { id: "q9", day: 6, time: "11am", channel: "Instagram", title: "Sunday queue, in pictures", state: "draft" },
];

export type Journalist = { id: string; name: string; outlet: string; beat: string; state: "Covered" | "Coming" | "Kit sent" | "No reply" };
export const PRESS: Journalist[] = [
  { id: "j1", name: "Gemma Carty", outlet: "The Irish Times", beat: "Food", state: "Coming" },
  { id: "j2", name: "Ronan Twomey", outlet: "Echo Live", beat: "Cork news", state: "Covered" },
  { id: "j3", name: "Sadhbh Ní Riain", outlet: "RTÉ Radio Cork", beat: "Morning show", state: "Coming" },
  { id: "j4", name: "Martin Kiely", outlet: "Business Post", beat: "Small business", state: "Kit sent" },
  { id: "j5", name: "Laura Fenton", outlet: "Totally Dublin", beat: "Food and drink", state: "No reply" },
  { id: "j6", name: "Ciara O'Hare", outlet: "The Examiner", beat: "Weekend", state: "Coming" },
  { id: "j7", name: "Dan Molloy", outlet: "Coffee Review Ireland", beat: "Coffee", state: "Covered" },
  { id: "j8", name: "Nessa Burke", outlet: "Cork Independent", beat: "City", state: "Kit sent" },
  { id: "j9", name: "Hugh Madden", outlet: "Newstalk", beat: "Features", state: "No reply" },
  { id: "j10", name: "Tess Aherne", outlet: "Image magazine", beat: "Style", state: "Kit sent" },
];

export type Proof = { id: string; title: string; kind: string; version: number; state: "Approved" | "Waiting" | "Changes asked"; note: string; hue: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 };
export const PROOFS: Proof[] = [
  { id: "f1", title: "Opening poster", kind: "A2 poster", version: 3, state: "Approved", note: "Aoife approved Tuesday", hue: 6 },
  { id: "f2", title: "Tasting menu", kind: "Menu card", version: 2, state: "Waiting", note: "Waiting on Aoife since 10am", hue: 5 },
  { id: "f3", title: "Press invite", kind: "Email", version: 4, state: "Approved", note: "Sent Monday", hue: 1 },
  { id: "f4", title: "Window decal", kind: "Vinyl, 1.2m", version: 1, state: "Changes asked", note: "Logo 20% smaller, move down", hue: 3 },
];

/* ── Notes and Files ─────────────────────────────────────────────── */

export const NOTES: Record<ProjectId, { id: string; title: string; body: string; when: string }[]> = {
  mf: [
    { id: "n1", title: "Things Finn's gran asked for", body: "The Kerry hymn after the vows. A chair near the door, not the speakers. Tea, not coffee, with the cake.", when: "2h ago" },
    { id: "n2", title: "Chef call", body: "Lamb or hake for mains. Kids' plates for 9. Late bite at 10pm is pizza, not sandwiches.", when: "Yesterday" },
    { id: "n3", title: "Band requests", body: "No 'Galway Girl'. First dance is 'Harvest Moon', slower than the record.", when: "Tuesday" },
  ],
  orchard: [{ id: "n4", title: "Saturday notes", body: "Heaters on at 6pm. Gate code 4471. Pond fenced off after dark.", when: "Today" }],
  riverside: [{ id: "n5", title: "Tutor feedback", body: "More primary sources. The interviews are the strongest part.", when: "Monday" }],
  hollis: [
    { id: "n6", title: "Press morning run", body: "Coffee flight at 10:15, roastery tour at 10:40, Noel speaks at 11.", when: "Today" },
  ],
};

export const FILES: { id: string; name: string; kind: "doc" | "sheet" | "image" | "slides"; size: string; when: string }[] = [
  { id: "d1", name: "Venue contract, signed.pdf", kind: "doc", size: "412 KB", when: "12 Aug" },
  { id: "d2", name: "Final menu.docx", kind: "doc", size: "88 KB", when: "Yesterday" },
  { id: "d3", name: "Budget.xlsx", kind: "sheet", size: "40 KB", when: "Monday" },
  { id: "d4", name: "Barn floor plan.png", kind: "image", size: "1.8 MB", when: "3 Sep" },
  { id: "d5", name: "Run of the day.pptx", kind: "slides", size: "2.2 MB", when: "Tuesday" },
];
