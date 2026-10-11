/* Sample data for "Today's desk". Invented, front-end only. */

export type Reason = "late" | "today" | "waiting" | "suggested";

export type Project = {
  id: string;
  name: string;
  /** Index into --v3-project-1..8. */
  hue: number;
};

export type CheckItem = { id: string; text: string; done: boolean };

export type Comment = { who: string; text: string; when: string };

export type Task = {
  id: string;
  title: string;
  /** Estimate in minutes. */
  est: number;
  /** Minutes already spent (in-hand work). */
  spent?: number;
  project: string;
  reason?: Reason;
  /** Why it is waiting, shown on in-hand cards. */
  waitingOn?: string;
  checklist?: CheckItem[];
  comments?: Comment[];
  note?: string;
  /** Minutes since midnight, for finished work. */
  doneAt?: number;
};

export type Stage = "todo" | "doing" | "review" | "waiting";

export type BacklogTask = {
  id: string;
  title: string;
  est: number;
  project: string;
  owner: string;
  stage: Stage;
  due?: string;
  late?: boolean;
};

export type Busy = { start: number; end: number; title: string };

export type Person = {
  id: string;
  name: string;
  first: string;
  role: string;
  initials: string;
  hue: number;
};

export type Desk = {
  person: Person;
  /** Where this desk lives, printed on the end-of-day receipt. */
  place: string;
  /** One line about the thing that matters most this week. */
  horizon: string;
  projects: Project[];
  queue: Task[];
  hand: Task[];
  done: Task[];
  busy: Busy[];
  backlog: BacklogTask[];
  team: Person[];
};

export const DAY_START = 9 * 60;
export const DAY_END = 18 * 60;

export const DATE_LABEL = "Friday, 25 September";
export const NEXT_WORKDAY = "Monday";

const t = (h: number, m = 0) => h * 60 + m;
const items = (list: [string, boolean][], prefix: string): CheckItem[] =>
  list.map(([text, done], i) => ({ id: `${prefix}-${i}`, text, done }));

/* ── Siobhan Kelly, events at The Orchard ─────────────────────────── */

const orchardPeople: Person[] = [
  { id: "siobhan", name: "Siobhan Kelly", first: "Siobhan", role: "Events, The Orchard", initials: "SK", hue: 8 },
  { id: "dev", name: "Dev Nair", first: "Dev", role: "Bar and ops", initials: "DN", hue: 3 },
  { id: "orla", name: "Orla Keane", first: "Orla", role: "Venue manager", initials: "OK", hue: 1 },
  { id: "none", name: "No owner yet", first: "Nobody", role: "", initials: "", hue: 0 },
];

const orchardProjects: Project[] = [
  { id: "wedding", name: "Mara and Finn's wedding", hue: 8 },
  { id: "orchard", name: "The Orchard, events", hue: 3 },
  { id: "bar", name: "Bar and ops", hue: 5 },
  { id: "terrace", name: "Terrace refresh", hue: 4 },
];

const siobhan: Desk = {
  person: orchardPeople[0],
  place: "The Orchard, events",
  horizon: "4 days to Mara and Finn's wedding",
  projects: orchardProjects,
  team: orchardPeople,
  busy: [{ start: t(15, 30), end: t(16), title: "Tasting with the Lennons" }],
  queue: [
    {
      id: "piper",
      title: "Call the piper back",
      est: 15,
      project: "wedding",
      reason: "late",
      note: "Ronan asked on Wednesday whether he plays the guests in or only the couple.",
    },
    {
      id: "numbers",
      title: "Confirm final numbers with Mara",
      est: 20,
      project: "wedding",
      reason: "today",
      note: "Kitchen needs the number by 17:00 for the Saturday order.",
    },
    { id: "print", title: "Print table numbers 1 to 18", est: 45, project: "wedding" },
    {
      id: "barbrief",
      title: "Brief the Saturday bar team",
      est: 30,
      project: "bar",
      reason: "waiting",
      note: "Dev is holding the rota until he hears from you.",
    },
    { id: "florist", title: "Walk the terrace with the florist", est: 60, project: "terrace" },
    { id: "thanks", title: "Draft the thank-you email template", est: 30, project: "orchard" },
  ],
  hand: [
    {
      id: "runsheet",
      title: "Build the Saturday run-sheet",
      est: 120,
      spent: 60,
      project: "wedding",
      checklist: items(
        [
          ["Arrivals and parking, 12:15", true],
          ["Ceremony in the orchard, 13:00", true],
          ["Drinks reception on the terrace, 13:45", true],
          ["Photos by the old wall, 14:15", true],
          ["Guests seated for dinner, 16:30", false],
          ["Speeches before mains, 17:15", false],
          ["Cake cutting, 20:45", false],
          ["First dance, 21:15", false],
          ["Carriages and taxis, 00:30", false],
        ],
        "rs",
      ),
    },
    {
      id: "seating",
      title: "Approve final seating plan",
      est: 30,
      project: "wedding",
      waitingOn: "Waiting on Finn's aunt",
      checklist: items(
        [
          ["Top table confirmed", true],
          ["Move the Hegartys away from the speakers", false],
          ["Sign off with Mara and Finn", false],
        ],
        "sp",
      ),
      comments: [
        { who: "Orla Keane", text: "Bríd wants to sit with the Galway cousins, not table 4.", when: "11:52" },
        { who: "Mara", text: "Fine by us if Finn's mum agrees. Asking her tonight.", when: "13:20" },
      ],
    },
  ],
  done: [
    { id: "d1", title: "Send the deposit reminder to the Lennons", est: 10, project: "orchard", doneAt: t(9, 12) },
    { id: "d2", title: "Update the wet-weather plan", est: 35, project: "wedding", doneAt: t(9, 55) },
    { id: "d3", title: "Reply to the band about load-in", est: 15, project: "wedding", doneAt: t(10, 34) },
    { id: "d4", title: "Order extra fairy lights for the barn", est: 20, project: "terrace", doneAt: t(11, 20) },
    { id: "d5", title: "Confirm coach times with On Hire Co.", est: 15, project: "wedding", doneAt: t(12, 46) },
  ],
  backlog: [
    { id: "b1", title: "Restock the cellar before Saturday", est: 60, project: "bar", owner: "dev", stage: "todo", due: "Fri 2 Oct" },
    { id: "b2", title: "Order tonic and the good olives", est: 15, project: "bar", owner: "dev", stage: "todo", due: "2 days late", late: true },
    { id: "b3", title: "Clean the ice machine filters", est: 30, project: "bar", owner: "dev", stage: "todo", due: "Mon 28 Sep" },
    { id: "b4", title: "Fix the keg line in bar two", est: 45, project: "bar", owner: "dev", stage: "doing", due: "1 day late", late: true },
    { id: "b5", title: "Plan the cocktail station", est: 60, project: "wedding", owner: "dev", stage: "doing", due: "Thu 1 Oct" },
    { id: "b6", title: "September stock-take sheet", est: 40, project: "bar", owner: "dev", stage: "review" },
    { id: "b7", title: "New CO2 cylinders", est: 10, project: "bar", owner: "dev", stage: "waiting" },
    { id: "b8", title: "Approve the autumn menu cards", est: 20, project: "orchard", owner: "orla", stage: "review" },
    { id: "b9", title: "Insurance certificate for the marquee", est: 15, project: "wedding", owner: "orla", stage: "waiting" },
    { id: "b10", title: "Sign off the heaters quote", est: 15, project: "terrace", owner: "orla", stage: "doing", due: "Tomorrow" },
    { id: "b11", title: "Walk-in rate for June 2027 couples", est: 30, project: "orchard", owner: "orla", stage: "todo", due: "Tue 29 Sep" },
    { id: "b12", title: "Reprint the faded welcome sign", est: 20, project: "orchard", owner: "orla", stage: "todo" },
    { id: "b13", title: "Book the extra cloakroom staff", est: 15, project: "wedding", owner: "none", stage: "todo", due: "Tue 29 Sep" },
    { id: "b14", title: "Choose candles for the long tables", est: 20, project: "wedding", owner: "none", stage: "todo" },
    { id: "b15", title: "Collect the easel from Kilkenny", est: 90, project: "wedding", owner: "none", stage: "todo", due: "Thu 1 Oct" },
    { id: "b16", title: "Sweep the orchard path for leaves", est: 30, project: "terrace", owner: "none", stage: "todo" },
    { id: "b17", title: "Send the Lennons their tasting notes", est: 15, project: "orchard", owner: "siobhan", stage: "todo", due: "Mon 28 Sep" },
    { id: "b18", title: "Photograph the barn for the website", est: 45, project: "orchard", owner: "siobhan", stage: "todo" },
    { id: "b19", title: "Chase the Hegarty RSVP", est: 5, project: "wedding", owner: "siobhan", stage: "waiting" },
    { id: "b20", title: "Price a second marquee for October", est: 30, project: "orchard", owner: "siobhan", stage: "todo", due: "Wed 30 Sep" },
    { id: "b21", title: "Test the terrace festoon lights", est: 20, project: "terrace", owner: "dev", stage: "todo" },
    { id: "b22", title: "Update the allergy card template", est: 25, project: "orchard", owner: "orla", stage: "doing" },
    { id: "b23", title: "Confirm the photographer's arrival", est: 10, project: "wedding", owner: "siobhan", stage: "todo", due: "Tue 29 Sep" },
    { id: "b24", title: "Hang the bunting in the barn", est: 60, project: "wedding", owner: "none", stage: "todo", due: "Fri 2 Oct" },
    { id: "b25", title: "Get three quotes for gravel", est: 30, project: "terrace", owner: "orla", stage: "waiting" },
    { id: "b26", title: "Write the Christmas party pitch", est: 60, project: "orchard", owner: "siobhan", stage: "doing" },
    { id: "b27", title: "Review the October staff rota", est: 20, project: "bar", owner: "orla", stage: "review" },
    { id: "b28", title: "Label the wine fridge shelves", est: 15, project: "bar", owner: "dev", stage: "todo" },
    { id: "b29", title: "Check the ceremony chairs for damage", est: 30, project: "wedding", owner: "none", stage: "todo", due: "Wed 30 Sep" },
    { id: "b30", title: "Send the florist a terrace plan", est: 15, project: "terrace", owner: "siobhan", stage: "review" },
    { id: "b31", title: "Find a spare PA for the speeches", est: 20, project: "wedding", owner: "dev", stage: "waiting" },
  ],
};

/* ── Aoife Byrne, Year 3 history group ────────────────────────────── */

const historyPeople: Person[] = [
  { id: "aoife", name: "Aoife Byrne", first: "Aoife", role: "Year 3 history group", initials: "AB", hue: 2 },
  { id: "cian", name: "Cian Walsh", first: "Cian", role: "Year 3 history group", initials: "CW", hue: 4 },
  { id: "niamh", name: "Niamh Daly", first: "Niamh", role: "Year 3 history group", initials: "ND", hue: 6 },
  { id: "tomas", name: "Tomás Ryan", first: "Tomás", role: "Year 3 history group", initials: "TR", hue: 1 },
  { id: "none", name: "No owner yet", first: "Nobody", role: "", initials: "", hue: 0 },
];

const historyProjects: Project[] = [
  { id: "letters", name: "Kilmainham letters", hue: 2 },
  { id: "poster", name: "Exhibition poster", hue: 6 },
  { id: "essay", name: "Group essay", hue: 4 },
];

const aoife: Desk = {
  person: historyPeople[0],
  place: "Year 3 history group",
  horizon: "11 days to the exhibition hand-in",
  projects: historyProjects,
  team: historyPeople,
  busy: [{ start: t(15), end: t(16), title: "Lecture: Revolution and memory" }],
  queue: [
    {
      id: "scanner",
      title: "Book the library scanner",
      est: 10,
      project: "letters",
      reason: "today",
      note: "Slots for next week open at 15:00 and go fast.",
    },
    {
      id: "doyle",
      title: "Reply to Ms Doyle about the sources list",
      est: 15,
      project: "essay",
      reason: "waiting",
      note: "She wants primary and secondary sources split by Monday.",
    },
    { id: "kee", title: "Read chapter 4 of the Kee book", est: 45, project: "essay" },
    { id: "timeline", title: "Sketch the timeline for the poster", est: 30, project: "poster", reason: "late" },
  ],
  hand: [
    {
      id: "transcribe",
      title: "Transcribe the Kilmainham letters",
      est: 90,
      spent: 40,
      project: "letters",
      checklist: items(
        [
          ["Letter 1, Grace Gifford, May 1916", true],
          ["Letter 2, the chaplain's note", true],
          ["Letter 3, to a sister in Cork", false],
          ["Letter 4, unsigned, water damaged", false],
          ["Letter 5, prison governor", false],
          ["Check spellings against the archive scans", false],
        ],
        "tl",
      ),
      comments: [{ who: "Niamh Daly", text: "Letter 4 might be in the second box, I can check Tuesday.", when: "10:05" }],
    },
  ],
  done: [
    { id: "a1", title: "Collect the archive reader pass", est: 15, project: "letters", doneAt: t(9, 40) },
    { id: "a2", title: "Share the notes folder with the group", est: 5, project: "essay", doneAt: t(10, 15) },
    { id: "a3", title: "Pick three images for the poster", est: 25, project: "poster", doneAt: t(12, 5) },
  ],
  backlog: [
    { id: "hb1", title: "Write the introduction", est: 60, project: "essay", owner: "cian", stage: "doing", due: "Wed 30 Sep" },
    { id: "hb2", title: "Find a 1916 map of Dublin", est: 20, project: "poster", owner: "niamh", stage: "todo" },
    { id: "hb3", title: "Check the second archive box", est: 45, project: "letters", owner: "niamh", stage: "todo", due: "Tue 29 Sep" },
    { id: "hb4", title: "Print the poster draft at A2", est: 15, project: "poster", owner: "tomas", stage: "waiting" },
    { id: "hb5", title: "Reference list in Harvard style", est: 40, project: "essay", owner: "tomas", stage: "todo", due: "Fri 2 Oct" },
    { id: "hb6", title: "Ask the archivist about image rights", est: 10, project: "poster", owner: "none", stage: "todo", due: "1 day late", late: true },
    { id: "hb7", title: "Proofread section two", est: 30, project: "essay", owner: "aoife", stage: "todo" },
    { id: "hb8", title: "Agree the poster colours", est: 15, project: "poster", owner: "none", stage: "review" },
    { id: "hb9", title: "Summarise the Gifford letters", est: 30, project: "letters", owner: "cian", stage: "review" },
    { id: "hb10", title: "Book a group room for Thursday", est: 5, project: "essay", owner: "tomas", stage: "todo" },
  ],
};

export const DESKS: Desk[] = [siobhan, aoife];

/* ── Moments of the day, so every state can be seen ─────────────────── */

export type Moment = "morning" | "now" | "evening";

export const MOMENTS: { id: Moment; clock: number; label: string }[] = [
  { id: "morning", clock: t(8, 40), label: "First thing" },
  { id: "now", clock: t(14, 10), label: "Mid-afternoon" },
  { id: "evening", clock: t(17, 50), label: "End of the day" },
];

export type DeskState = {
  queue: Task[];
  hand: Task[];
  done: Task[];
  /** Morning: the queue is only a suggestion until you plan the day. */
  suggested: boolean;
  backlog: BacklogTask[];
};

export function stateFor(desk: Desk, moment: Moment): DeskState {
  if (moment === "morning") {
    const fromHand = desk.hand.map((task) => ({
      ...task,
      spent: 0,
      checklist: task.checklist?.map((item) => ({ ...item, done: false })),
    }));
    const pool = [...desk.queue, ...fromHand];
    const suggested = pool.filter((task) => task.reason === "late" || task.reason === "today" || task.reason === "waiting");
    const rest = pool.filter((task) => !suggested.includes(task));
    return {
      queue: [...suggested, ...rest.slice(0, 3)],
      hand: [],
      done: [],
      suggested: true,
      backlog: desk.backlog,
    };
  }
  if (moment === "evening") {
    const finishedLater: Task[] = [
      { ...desk.hand[0], doneAt: t(15, 5), checklist: desk.hand[0].checklist?.map((i) => ({ ...i, done: true })) },
      ...desk.queue.slice(0, desk.queue.length > 4 ? 4 : 2).map((task, i) => ({ ...task, doneAt: t(16, 10 + i * 22) })),
    ];
    const stillInHand = desk.hand.slice(1);
    return {
      queue: [],
      hand: stillInHand,
      done: [...desk.done, ...finishedLater],
      suggested: false,
      backlog: desk.backlog,
    };
  }
  return { queue: desk.queue, hand: desk.hand, done: desk.done, suggested: false, backlog: desk.backlog };
}
