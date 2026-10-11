/**
 * Sample data for "Who's carrying what". Two teams, invented, front end only.
 * Today is Friday 25 September 2026.
 */

export type Stage = "todo" | "doing" | "review" | "waiting" | "done";

export const STAGES: readonly { id: Stage; label: string; hint: string }[] = [
  { id: "todo", label: "To do", hint: "Agreed, not started" },
  { id: "doing", label: "Doing", hint: "In someone's hands now" },
  { id: "review", label: "Review", hint: "Needs a second look" },
  { id: "waiting", label: "Waiting", hint: "Held by a reply or delivery" },
  { id: "done", label: "Done", hint: "Finished this week" },
];

export type Person = {
  id: string;
  name: string;
  first: string;
  initials: string;
  role: string;
  /** Tasks this person usually carries in a week. */
  capacity: number;
  /** 1..8, maps to --v3-project-n for the avatar disc. */
  hue: number;
  away?: string;
};

export type Project = {
  id: string;
  name: string;
  short: string;
  hue: number;
  note: string;
};

export type Due = { label: string; tone?: "late" | "soon" };

export type Task = {
  id: string;
  title: string;
  stage: Stage;
  owner: string | null;
  project: string;
  due?: Due;
  /** One quiet label: a waiting-on, a place, a kind of job. */
  label?: string;
};

export type TeamSet = {
  id: string;
  name: string;
  short: string;
  hue: number;
  /** What free capacity is being saved for, used in empty lanes. */
  leaveRoomFor: string;
  people: Person[];
  projects: Project[];
  tasks: Task[];
};

const orchard: TeamSet = {
  id: "orchard",
  name: "The Orchard",
  short: "OR",
  hue: 4,
  leaveRoomFor: "Saturday",
  people: [
    { id: "orla", name: "Orla Keane", first: "Orla", initials: "OK", role: "Venue manager", capacity: 6, hue: 1 },
    { id: "dev", name: "Dev Nair", first: "Dev", initials: "DN", role: "Bar and ops", capacity: 6, hue: 3 },
    { id: "siobhan", name: "Siobhan Walsh", first: "Siobhan", initials: "SW", role: "Events", capacity: 5, hue: 8 },
    {
      id: "tomas",
      name: "Tomás Byrne",
      first: "Tomás",
      initials: "TB",
      role: "Weekend bar",
      capacity: 3,
      hue: 5,
      away: "Away until Monday",
    },
  ],
  projects: [
    { id: "wedding", name: "Mara & Finn wedding", short: "Mara & Finn", hue: 8, note: "Saturday 3 October" },
    { id: "garden", name: "Autumn beer garden", short: "Beer garden", hue: 5, note: "Opens 10 October" },
    { id: "upkeep", name: "Venue upkeep", short: "Upkeep", hue: 3, note: "Ongoing" },
  ],
  tasks: [
    { id: "o1", title: "Call the piper back", stage: "todo", owner: null, project: "wedding", due: { label: "Today", tone: "soon" } },
    { id: "o2", title: "Book the extra cloakroom staff", stage: "todo", owner: null, project: "wedding", due: { label: "Tue 29 Sep" } },
    { id: "o3", title: "Print table numbers 1 to 18", stage: "todo", owner: null, project: "wedding", due: { label: "Thu 1 Oct" } },

    { id: "o10", title: "Confirm final numbers with Mara", stage: "todo", owner: "orla", project: "wedding", due: { label: "Mon 28 Sep" } },
    { id: "o11", title: "Build the Saturday run-sheet", stage: "doing", owner: "orla", project: "wedding", due: { label: "Wed 30 Sep" } },
    { id: "o12", title: "Sign off the heaters quote", stage: "doing", owner: "orla", project: "garden", due: { label: "Tomorrow", tone: "soon" } },
    { id: "o13", title: "Approve the autumn menu cards", stage: "review", owner: "orla", project: "garden", label: "Print" },
    { id: "o14", title: "Insurance certificate for the marquee", stage: "waiting", owner: "orla", project: "wedding", label: "On Hire Co." },
    { id: "o15", title: "Pay the September linen invoice", stage: "done", owner: "orla", project: "upkeep" },
    { id: "o16", title: "Walk the garden with the electrician", stage: "done", owner: "orla", project: "garden" },
    { id: "o17", title: "Send Mara the timeline draft", stage: "done", owner: "orla", project: "wedding" },
    { id: "o18", title: "Renew the late licence", stage: "done", owner: "orla", project: "upkeep" },

    { id: "o20", title: "Order tonic and the good olives", stage: "todo", owner: "dev", project: "garden", due: { label: "2 days late", tone: "late" }, label: "Bar" },
    { id: "o21", title: "Restock the cellar before Saturday", stage: "todo", owner: "dev", project: "wedding", due: { label: "Fri 2 Oct" }, label: "Cellar" },
    { id: "o22", title: "Clean the ice machine filters", stage: "todo", owner: "dev", project: "upkeep", due: { label: "Mon 28 Sep" } },
    { id: "o23", title: "Swap the bulbs on the terrace lights", stage: "todo", owner: "dev", project: "garden", due: { label: "Tue 29 Sep" } },
    { id: "o24", title: "Count glassware for 120 guests", stage: "todo", owner: "dev", project: "wedding", due: { label: "Wed 30 Sep" } },
    { id: "o25", title: "Fix the keg line in bar two", stage: "doing", owner: "dev", project: "upkeep", due: { label: "1 day late", tone: "late" }, label: "Bar two" },
    { id: "o26", title: "Plan the cocktail station", stage: "doing", owner: "dev", project: "wedding", due: { label: "Thu 1 Oct" } },
    { id: "o27", title: "September stock-take sheet", stage: "review", owner: "dev", project: "upkeep", label: "Orla to check" },
    { id: "o28", title: "New CO2 cylinders", stage: "waiting", owner: "dev", project: "upkeep", label: "On BOC" },
    { id: "o29", title: "Descale the coffee machine", stage: "done", owner: "dev", project: "upkeep" },
    { id: "o30", title: "Taste the three house ciders", stage: "done", owner: "dev", project: "garden" },
    { id: "o31", title: "Re-seal the bar two sink", stage: "done", owner: "dev", project: "upkeep" },
    { id: "o32", title: "Price the prosecco reception", stage: "done", owner: "dev", project: "wedding" },
    { id: "o33", title: "Move the empties cage", stage: "done", owner: "dev", project: "upkeep" },
    { id: "o34", title: "Take the Tuesday delivery", stage: "done", owner: "dev", project: "upkeep" },

    { id: "o40", title: "Seating plan, draft two", stage: "todo", owner: "siobhan", project: "wedding", due: { label: "Tue 29 Sep" } },
    { id: "o41", title: "Welcome sign with the florist", stage: "doing", owner: "siobhan", project: "wedding", due: { label: "Wed 30 Sep" } },
    { id: "o42", title: "Band's final set list", stage: "waiting", owner: "siobhan", project: "wedding", label: "On The Swells" },
    { id: "o43", title: "Confirm the photographer's arrival", stage: "done", owner: "siobhan", project: "wedding" },
    { id: "o44", title: "Draft the garden launch post", stage: "done", owner: "siobhan", project: "garden" },
    { id: "o45", title: "Choose the candle holders", stage: "done", owner: "siobhan", project: "wedding" },

    { id: "o50", title: "Stack the terrace chairs", stage: "done", owner: "tomas", project: "garden" },
    { id: "o51", title: "Close-down checklist, Sunday", stage: "done", owner: "tomas", project: "upkeep" },
  ],
};

const history: TeamSet = {
  id: "history",
  name: "Year 3 history project",
  short: "H3",
  hue: 2,
  leaveRoomFor: "the class talk",
  people: [
    { id: "aoife", name: "Aoife Brennan", first: "Aoife", initials: "AB", role: "Research lead", capacity: 4, hue: 6 },
    { id: "ben", name: "Ben Okafor", first: "Ben", initials: "BO", role: "Maps and slides", capacity: 4, hue: 2 },
    { id: "chidi", name: "Chidi Eze", first: "Chidi", initials: "CE", role: "Writing", capacity: 4, hue: 4 },
    { id: "dara", name: "Dara Quinn", first: "Dara", initials: "DQ", role: "Interviews", capacity: 4, hue: 7 },
    { id: "eimear", name: "Eimear Lynch", first: "Eimear", initials: "EL", role: "Poster and design", capacity: 4, hue: 1 },
  ],
  projects: [
    { id: "research", name: "Research", short: "Research", hue: 3, note: "Sources by Fri 2 Oct" },
    { id: "essay", name: "Group essay", short: "Essay", hue: 1, note: "Due Wed 7 Oct" },
    { id: "talk", name: "Class talk", short: "Talk", hue: 6, note: "Friday 9 October" },
  ],
  tasks: [
    { id: "h1", title: "Print handouts for the class", stage: "todo", owner: null, project: "talk", due: { label: "Thu 8 Oct" } },
    { id: "h2", title: "Record a practice run", stage: "todo", owner: null, project: "talk", due: { label: "Tue 6 Oct" } },

    { id: "h10", title: "Find photos of Athenry in 1916", stage: "todo", owner: "aoife", project: "research", due: { label: "Tue 29 Sep" } },
    { id: "h11", title: "Draft the timeline of Easter week", stage: "todo", owner: "aoife", project: "essay", due: { label: "Wed 30 Sep" } },
    { id: "h12", title: "Book the library room for practice", stage: "todo", owner: "aoife", project: "talk", due: { label: "Fri 2 Oct" } },
    { id: "h13", title: "Summarise Liam Mellows' route", stage: "doing", owner: "aoife", project: "research", due: { label: "1 day late", tone: "late" } },
    { id: "h14", title: "Write the introduction", stage: "doing", owner: "aoife", project: "essay", due: { label: "Mon 28 Sep" } },
    { id: "h15", title: "Check the sources list with Ms Kelly", stage: "review", owner: "aoife", project: "essay", label: "Ms Kelly" },
    { id: "h16", title: "Scans from the county archive", stage: "waiting", owner: "aoife", project: "research", label: "On the archive" },
    { id: "h17", title: "Pick the three main events", stage: "done", owner: "aoife", project: "essay" },

    { id: "h20", title: "Map of the Volunteers' camps", stage: "doing", owner: "ben", project: "research", due: { label: "Tomorrow", tone: "soon" } },
    { id: "h21", title: "Slides 1 to 4", stage: "todo", owner: "ben", project: "talk", due: { label: "Mon 5 Oct" } },
    { id: "h22", title: "Paragraph on Moyode Castle", stage: "review", owner: "ben", project: "essay" },

    { id: "h30", title: "Interview Grandad about the family story", stage: "todo", owner: "dara", project: "research", due: { label: "Sun 27 Sep" } },
    { id: "h31", title: "Build the bibliography", stage: "doing", owner: "dara", project: "essay" },
    { id: "h32", title: "Rehearsal plan", stage: "todo", owner: "dara", project: "talk", due: { label: "Mon 5 Oct" } },
    { id: "h33", title: "Set up the shared folder", stage: "done", owner: "dara", project: "research" },

    { id: "h40", title: "Design the poster layout", stage: "doing", owner: "eimear", project: "talk", due: { label: "Thu 1 Oct" } },
    { id: "h41", title: "Quotes from the Bureau of Military History", stage: "review", owner: "eimear", project: "research" },
    { id: "h42", title: "Choose the poster font", stage: "done", owner: "eimear", project: "talk" },
  ],
};

export const TEAM_SETS: readonly TeamSet[] = [orchard, history];

export const TODAY_LABEL = "Friday 25 September";
