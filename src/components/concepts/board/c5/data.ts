/* Sample data for the planning wall. Invented, front-end only. */

export type StageKey = "ideas" | "todo" | "doing" | "checking" | "done";
export type Tone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const STAGES: { key: StageKey; name: string; hint: string }[] = [
  { key: "ideas", name: "Ideas", hint: "Anything goes. Sort it out later." },
  { key: "todo", name: "To do", hint: "Agreed, with someone on it." },
  { key: "doing", name: "Doing", hint: "Being worked on right now." },
  { key: "checking", name: "Checking", hint: "Needs a second pair of eyes." },
  { key: "done", name: "Done", hint: "Finished and ticked off." },
];

export const STAGE_INDEX: Record<StageKey, number> = { ideas: 0, todo: 1, doing: 2, checking: 3, done: 4 };

export type Person = { id: string; name: string; first: string; initials: string; tone: Tone };

export type CheckItem = { text: string; done: boolean };

export type Note = {
  id: string;
  title: string;
  stage: StageKey;
  x: number;
  y: number;
  tone: Tone;
  owner?: string;
  due?: string; // ISO date
  clusterId?: string;
  detail?: string;
  checklist?: CheckItem[];
  comments?: number;
};

export type Cluster = { id: string; name: string; tone: Tone };
export type Connector = { id: string; from: string; to: string };
export type Zone = { stage: StageKey; x: number; y: number; w: number; h: number };
export type Scribble = { id: string; text: string; x: number; y: number };

export type Wall = {
  id: string;
  name: string;
  short: string;
  kind: string;
  tone: Tone;
  milestone?: { label: string; date: string };
  people: Person[];
  presence: [string, string] | [];
  zones: Zone[];
  notes: Note[];
  clusters: Cluster[];
  connectors: Connector[];
  scribbles: Scribble[];
  starterPad?: number;
};

export const TODAY = "2026-09-25";
export const NOTE = 168;

/* Zone frame shared by all walls. Wall coordinates, 1 unit = 1px at 100%. */
function zones(): Zone[] {
  return [
    { stage: "ideas", x: 40, y: 40, w: 640, h: 860 },
    { stage: "todo", x: 712, y: 40, w: 420, h: 860 },
    { stage: "doing", x: 1164, y: 40, w: 400, h: 860 },
    { stage: "checking", x: 1596, y: 40, w: 380, h: 860 },
    { stage: "done", x: 2008, y: 40, w: 380, h: 860 },
  ];
}

type Seed = Omit<Note, "x" | "y" | "stage" | "tone"> & { at: [number, number]; tone?: Tone };

function place(zs: Zone[], stage: StageKey, seeds: Seed[], fallbackTone: Tone): Note[] {
  const z = zs.find((zone) => zone.stage === stage)!;
  return seeds.map(({ at, tone, ...rest }) => ({
    ...rest,
    stage,
    tone: tone ?? fallbackTone,
    x: z.x + at[0],
    y: z.y + at[1],
  }));
}

/* ── Wall 1: Year 3 history project ─────────────────────────────────── */

function historyWall(): Wall {
  const zs = zones();
  const people: Person[] = [
    { id: "aoife", name: "Aoife Ní Bhriain", first: "Aoife", initials: "AB", tone: 1 },
    { id: "ben", name: "Ben Okafor", first: "Ben", initials: "BO", tone: 2 },
    { id: "chidi", name: "Chidi Mensah", first: "Chidi", initials: "CM", tone: 4 },
    { id: "dara", name: "Dara Keane", first: "Dara", initials: "DK", tone: 6 },
    { id: "eimear", name: "Eimear Walsh", first: "Eimear", initials: "EW", tone: 8 },
  ];
  const notes: Note[] = [
    ...place(zs, "ideas", [
      { id: "h1", title: "Interview Dara's grandad", owner: "dara", clusterId: "research", tone: 3, at: [24, 84], detail: "He grew up in Athenry and heard the stories first hand from his own father. Record on a phone, ask before we use his name.", comments: 3 },
      { id: "h2", title: "Map of the Athenry march", owner: "chidi", clusterId: "research", tone: 3, at: [206, 96] },
      { id: "h3", title: "Find Liam Mellows photos in the county archive", owner: "eimear", clusterId: "research", tone: 3, at: [30, 268] },
      { id: "h4", title: "Newspaper clippings from the Connacht Tribune, April and May 1916, including the reports on the arrests at Oranmore and Clarinbridge", clusterId: "research", tone: 3, at: [212, 280] },
      { id: "h5", title: "Podcast episode?", clusterId: "presentation", tone: 1, at: [436, 84], comments: 5 },
      { id: "h6", title: "Timeline poster for the classroom wall", owner: "aoife", clusterId: "presentation", tone: 1, at: [430, 266] },
      { id: "h7", title: "Walk the march route on Google Earth", owner: "ben", clusterId: "presentation", tone: 1, at: [440, 448] },
      { id: "h8", title: "Ask Ms Walsh about the word count", owner: "aoife", clusterId: "admin", tone: 5, at: [36, 560] },
      { id: "h9", title: "Shared folder for all our sources", owner: "ben", clusterId: "admin", tone: 5, at: [216, 574] },
      { id: "h10", title: "Soundtrack: sean-nós or silence", tone: 8, at: [446, 680] },
    ], 3),
    ...place(zs, "todo", [
      { id: "h11", title: "Book the library scanner", owner: "chidi", due: "2026-09-28", tone: 4, at: [24, 84], detail: "Two-hour slots, bring student card." },
      { id: "h12", title: "Scan the Kilmainham letters", owner: "chidi", due: "2026-09-29", tone: 4, at: [224, 300], checklist: [{ text: "Letter to Mary, 3 May", done: false }, { text: "Prison register page", done: false }, { text: "Photo of the cell door", done: false }] },
      { id: "h13", title: "Draft the script for the intro", owner: "aoife", due: "2026-09-29", tone: 1, at: [30, 296], comments: 2 },
      { id: "h14", title: "Choose 12 photos for the slides", owner: "eimear", due: "2026-09-30", tone: 1, at: [220, 520] },
      { id: "h15", title: "Print the handout, 30 copies", owner: "ben", due: "2026-10-01", tone: 5, at: [28, 540] },
    ], 1),
    ...place(zs, "doing", [
      { id: "h16", title: "Slide deck outline", owner: "aoife", due: "2026-09-30", tone: 1, at: [24, 84], checklist: [{ text: "Intro and why Galway", done: true }, { text: "The march", done: true }, { text: "Aftermath", done: false }, { text: "Sources", done: false }] },
      { id: "h17", title: "Transcribe grandad's interview", owner: "dara", due: "2026-09-25", tone: 3, at: [208, 104], comments: 1 },
      { id: "h18", title: "Write the bibliography", owner: "ben", due: "2026-09-24", tone: 5, at: [36, 296] },
    ], 1),
    ...place(zs, "checking", [
      { id: "h19", title: "Fact-check dates on the timeline", owner: "eimear", due: "2026-09-28", tone: 8, at: [24, 84] },
      { id: "h20", title: "Ms Walsh to approve our topic", owner: "aoife", tone: 5, at: [188, 250], comments: 2 },
    ], 1),
    ...place(zs, "done", [
      { id: "h21", title: "Pick the topic", owner: "aoife", tone: 1, at: [24, 84] },
      { id: "h22", title: "Set up the group chat", owner: "ben", tone: 2, at: [198, 104] },
      { id: "h23", title: "Split the research areas", owner: "dara", tone: 3, at: [36, 272] },
    ], 1),
  ];
  return {
    id: "history",
    name: "Year 3 history project: the 1916 Rising in Galway",
    short: "Year 3 history project",
    kind: "Group project",
    tone: 4,
    milestone: { label: "Presentation", date: "2026-10-01" },
    people,
    presence: ["eimear", "chidi"],
    zones: zs,
    notes,
    clusters: [
      { id: "research", name: "Research", tone: 3 },
      { id: "presentation", name: "Presentation", tone: 1 },
      { id: "admin", name: "Admin", tone: 5 },
    ],
    connectors: [{ id: "k1", from: "h11", to: "h12" }],
    scribbles: [{ id: "s1", text: "Ms Walsh: 10 minutes max, everyone speaks", x: 40 + 28, y: 40 + 792 }],
  };
}

/* ── Wall 2: The Orchard, Mara and Finn's wedding ───────────────────── */

function weddingWall(): Wall {
  const zs = zones();
  const people: Person[] = [
    { id: "orla", name: "Orla Brennan", first: "Orla", initials: "OB", tone: 1 },
    { id: "declan", name: "Declan Power", first: "Declan", initials: "DP", tone: 3 },
    { id: "siobhan", name: "Siobhán Kerr", first: "Siobhán", initials: "SK", tone: 8 },
    { id: "mateo", name: "Mateo Quinn", first: "Mateo", initials: "MQ", tone: 6 },
  ];
  const notes: Note[] = [
    ...place(zs, "ideas", [
      { id: "w1", title: "Hand-painted welcome board", owner: "siobhan", clusterId: "signage", tone: 8, at: [24, 84] },
      { id: "w2", title: "Table plan easel by the barn door", owner: "siobhan", clusterId: "signage", tone: 8, at: [206, 92] },
      { id: "w3", title: "Chalkboard for the bar menu", clusterId: "signage", tone: 8, at: [28, 272] },
      { id: "w4", title: "Arrows from the car park to the orchard", owner: "declan", clusterId: "signage", tone: 8, at: [210, 284] },
      { id: "w5", title: "Sparkler exit at 11pm?", tone: 5, at: [440, 88], comments: 4 },
      { id: "w6", title: "Late-night toasties from the kitchen", owner: "mateo", tone: 5, at: [436, 290] },
      { id: "w7", title: "Blankets on the benches if it turns cold", tone: 2, at: [60, 520] },
    ], 8),
    ...place(zs, "todo", [
      { id: "w8", title: "Confirm the celebrant's arrival time", owner: "orla", due: "2026-09-28", clusterId: "ceremony", tone: 2, at: [24, 84] },
      { id: "w9", title: "Set out 120 chairs in the orchard", owner: "declan", due: "2026-10-03", clusterId: "ceremony", tone: 2, at: [206, 96] },
      { id: "w10", title: "Wet-weather plan for the ceremony", owner: "orla", due: "2026-09-24", clusterId: "ceremony", tone: 2, at: [30, 270], detail: "Barn fits 120 seated if we lose the dance floor until 7pm. Ask Mara and Finn which they prefer.", comments: 6 },
      { id: "w11", title: "Order tonic and the good olives", owner: "declan", due: "2026-09-23", clusterId: "bar", tone: 5, at: [26, 520] },
      { id: "w12", title: "Signature cocktail names from the couple", owner: "siobhan", due: "2026-09-30", clusterId: "bar", tone: 5, at: [210, 530] },
    ], 2),
    ...place(zs, "doing", [
      { id: "w13", title: "Chase the florist deposit", owner: "siobhan", due: "2026-09-25", clusterId: "suppliers", tone: 3, at: [24, 84] },
      { id: "w14", title: "Confirm the band's arrival time", owner: "mateo", due: "2026-09-28", clusterId: "suppliers", tone: 3, at: [208, 96] },
      { id: "w15", title: "Menu tasting at The Orchard", owner: "orla", due: "2026-09-25", tone: 6, at: [40, 330], comments: 3, checklist: [{ text: "Starters", done: true }, { text: "Mains", done: true }, { text: "Desserts", done: false }, { text: "Wine pairing", done: false }, { text: "Kids' menu", done: false }] },
    ], 3),
    ...place(zs, "checking", [
      { id: "w16", title: "Approve the final seating plan", owner: "orla", due: "2026-10-01", tone: 1, at: [24, 84], comments: 5 },
      { id: "w17", title: "Run-sheet draft, version 3", owner: "mateo", due: "2026-10-02", tone: 6, at: [188, 260] },
    ], 1),
    ...place(zs, "done", [
      { id: "w18", title: "Book the marquee", owner: "declan", tone: 3, at: [24, 84] },
      { id: "w19", title: "Send Mara and Finn the timeline", owner: "orla", tone: 1, at: [198, 100] },
      { id: "w20", title: "Pay the band's deposit", owner: "siobhan", tone: 8, at: [40, 272] },
    ], 1),
  ];
  return {
    id: "orchard",
    name: "Mara and Finn's wedding",
    short: "The Orchard, events",
    kind: "Venue team",
    tone: 7,
    milestone: { label: "Wedding day", date: "2026-10-03" },
    people,
    presence: ["siobhan", "mateo"],
    zones: zs,
    notes,
    clusters: [
      { id: "signage", name: "Signage", tone: 8 },
      { id: "ceremony", name: "Ceremony", tone: 2 },
      { id: "bar", name: "Bar", tone: 5 },
      { id: "suppliers", name: "Suppliers", tone: 3 },
    ],
    connectors: [
      { id: "k1", from: "w14", to: "w17" },
      { id: "k2", from: "w12", to: "w3" },
    ],
    scribbles: [{ id: "s1", text: "Sunset is 19:12 on the day", x: 712 + 26, y: 40 + 772 }],
  };
}

function blankWall(): Wall {
  return {
    id: "blank",
    name: "A fresh wall",
    short: "New project",
    kind: "Empty",
    tone: 2,
    people: [{ id: "you", name: "You", first: "You", initials: "YO", tone: 1 }],
    presence: [],
    zones: zones(),
    notes: [],
    clusters: [],
    connectors: [],
    scribbles: [],
    starterPad: 3,
  };
}

export function initialWalls(): Record<string, Wall> {
  return { history: historyWall(), orchard: weddingWall(), blank: blankWall() };
}

export const WALL_ORDER = ["history", "orchard", "blank"] as const;
