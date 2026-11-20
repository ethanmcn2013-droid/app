/* Sample data for the planning wall. Invented, front-end only. */

import { INITIAL_STATE, personById, projectById, type ProjectId } from "../../demo/store";
import type { TaskStatus } from "../../tasks/status";

/**
 * A note's progress. The five task statuses are the shared ones (To do, In
 * progress, Waiting, Review, Done); Ideas is the wall's own, for notes that
 * are not tasks yet.
 */
export type StageKey = "ideas" | TaskStatus;
export type Tone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** New notes start blue: amber, orange and red stay for people to pick by hand. */
export const DEFAULT_TONE: Tone = 2;

export const STAGES: { key: StageKey; name: string; hint: string }[] = [
  { key: "ideas", name: "Ideas", hint: "Not a task yet. Sort it out later." },
  { key: "todo", name: "To do", hint: "Agreed, with someone on it." },
  { key: "doing", name: "In progress", hint: "Being worked on right now." },
  { key: "waiting", name: "Waiting", hint: "Waiting on someone else." },
  { key: "review", name: "To check", hint: "Needs a second pair of eyes." },
  { key: "done", name: "Done", hint: "Finished and ticked off." },
];

export const STAGE_INDEX: Record<StageKey, number> = { ideas: 0, todo: 1, doing: 2, waiting: 3, review: 4, done: 5 };

/*
 * Tidy is optional: it arranges the freeform wall into columns using a
 * template the person picks, and "Back to the wall" returns every note to
 * where it was. Groups is the default because it only uses what people
 * already made on the wall.
 */
export type TidyTemplate = "groups" | "stages";

export const TEMPLATES: { key: TidyTemplate; name: string; short: string; hint: string }[] = [
  { key: "groups", name: "One column per group", short: "By group", hint: "Drag a note across to move it to another group" },
  { key: "stages", name: "Ideas to done", short: "Ideas to done", hint: "Ideas, then To do through Done" },
];

export type Person = { id: string; name: string; first: string; initials: string; tone: Tone };

/** A step. On a task note the steps are the task's own (`id` is the subtask id); on an idea they live on the wall. */
export type CheckItem = { id?: string; text: string; done: boolean };

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
  /** A task in the shared store ("mf-21"): title, owner, due and status come from it. */
  taskId?: string;
  detail?: string;
  /** An idea's own steps. A task note's steps are read from its task, never stored here. */
  checklist?: CheckItem[];
  comments?: number;
  /** Read from the task, never stored on the wall: who it waits on, days stuck, nudged today. */
  waitingOn?: string;
  stuckDays?: number;
  nudged?: boolean;
};

export type Cluster = { id: string; name: string; tone: Tone };
export type Connector = { id: string; from: string; to: string };
export type Scribble = { id: string; text: string; x: number; y: number };

export type Wall = {
  id: string;
  name: string;
  short: string;
  kind: string;
  /** The project in the shared store this wall plans, when it has one: ideas here can become its tasks. */
  project?: ProjectId;
  tone: Tone;
  people: Person[];
  presence: [string, string] | [];
  notes: Note[];
  clusters: Cluster[];
  connectors: Connector[];
  scribbles: Scribble[];
  starterPad?: number;
};

export const TODAY = "2026-09-25";
export const NOTE = 168;

/*
 * The wall opens as a freeform canvas: notes sit where people put them, in
 * loose clusters, with arrows and handwritten labels between. Stage is only
 * a note detail, used when someone tidies into planning columns.
 * Wall coordinates, 1 unit = 1px at 100%.
 */
type Seed = Omit<Note, "x" | "y" | "stage" | "tone"> & { at: [number, number]; tone: Tone; stage?: StageKey };

function place(seeds: Seed[]): Note[] {
  return seeds.map(({ at, stage, ...rest }) => ({ ...rest, stage: stage ?? "ideas", x: at[0], y: at[1] }));
}

/* ── Wall 1: The Orchard, Mara & Finn's wedding ─────────────────────── */

/*
 * The Orchard's team planning Mara & Finn's day, Saturday 3 October, eight
 * days out. People, suppliers and task titles follow the shared demo world.
 */
function weddingWall(): Wall {
  // Hues come from the shared store, so a face here matches the same person everywhere.
  const people: Person[] = (["aoife", "orla", "dara", "dev", "tomas", "niamh"] as const).map((id) => {
    const p = personById(id)!;
    return { id, name: p.name, first: p.first, initials: p.initials, tone: p.hue as Tone };
  });
  /*
   * Notes with a taskId are tasks in the shared store: their title, owner, due
   * date and status are read from it live, and edits here go back through the
   * store. The values below are only a fallback. Notes without one are ideas
   * that are not tasks yet.
   * A grid of 186 (a note and an 18px gutter) in four columns, two bands,
   * kept compact so the whole wall opens in view on a 1440 by 900 screen.
   */
  const notes: Note[] = place([
    // The day
    { id: "w1", taskId: "mf-41", title: "Build the Saturday run-sheet", owner: "aoife", due: "2026-09-29", stage: "doing", clusterId: "day", tone: 1, at: [40, 60], comments: 2 },
    { id: "w2", taskId: "mf-21", title: "Approve the seating plan", owner: "aoife", due: "2026-09-26", stage: "waiting", clusterId: "day", tone: 1, at: [226, 60], comments: 5, detail: "v4 is with Mara since Thu 24 Sep: 118 guests at 15 tables, with the Galway cousins together and the wheelchair route to table 6. She approved v3 on 21 Sep." },
    { id: "w3", taskId: "mf-26", title: "Draft a wet-weather plan for the drinks reception", owner: "orla", due: "2026-09-30", stage: "doing", clusterId: "day", tone: 1, at: [40, 246], comments: 3, detail: "If it rains, drinks move into the orchard marquee instead of the terrace. Ask Mara and Finn which they prefer." },
    { id: "w4", taskId: "mf-14", title: "Test the festoon lights on the terrace", owner: "tomas", due: "2026-10-01", stage: "todo", clusterId: "day", tone: 1, at: [226, 246] },
    // Suppliers
    { id: "w5", taskId: "mf-33", title: "Chase florist deposit", owner: "aoife", due: "2026-09-28", stage: "waiting", clusterId: "suppliers", tone: 2, at: [452, 60], detail: "The Orchard paid the €300 deposit on 18 Sep. Waiting on Fern and Furrow to confirm it landed." },
    { id: "w6", taskId: "mf-13", title: "Confirm marquee sides with Lawlor Hire", owner: "aoife", due: "2026-09-28", stage: "todo", clusterId: "suppliers", tone: 2, at: [638, 60], detail: "Quote v3 is €3,850 with clear sides, down from €4,200, and waiting on Mara. A 30% deposit holds the date until 30 Sep." },
    { id: "w7", taskId: "mf-36", title: "Confirm the band's arrival time with The Lindens", owner: "dara", due: "2026-09-29", stage: "waiting", clusterId: "suppliers", tone: 2, at: [452, 246], detail: "Waiting on The Lindens. Load-in not before 17:30, per their rider." },
    { id: "w8", taskId: "mf-6", title: "Order prosecco for the drinks reception", owner: "dev", due: "2026-09-29", stage: "todo", clusterId: "suppliers", tone: 2, at: [638, 246], detail: "Kinsale Wine Co, 10 cases and a magnum, €1,180. Mara approved the order sheet on 25 Sep." },
    // Kitchen and bar
    { id: "w9", taskId: "mf-3", title: "Order tonic and the good olives", owner: "dev", due: "2026-09-23", stage: "doing", clusterId: "kitchen", tone: 3, at: [864, 60] },
    { id: "w10", taskId: "mf-4", title: "Menu tasting at The Orchard", owner: "dev", due: "2026-09-25", stage: "doing", clusterId: "kitchen", tone: 3, at: [1050, 60], comments: 3, detail: "16:00 today in the Orchard kitchen, with Mara." },
    { id: "w11", taskId: "mf-7", title: "Final numbers to the kitchen", owner: "aoife", due: "2026-09-30", stage: "todo", clusterId: "kitchen", tone: 3, at: [864, 246] },
    { id: "w12", taskId: "mf-8", title: "Prep the late-night blaas and chips", owner: "dev", due: "2026-10-02", stage: "todo", clusterId: "kitchen", tone: 3, at: [1050, 246] },
    // Sorted
    { id: "w22", taskId: "mf-32", title: "Confirm Harbour Coaches pick-up times", owner: "niamh", due: "2026-09-23", stage: "done", clusterId: "sorted", tone: 2, at: [1276, 60] },
    { id: "w23", taskId: "mf-31", title: "Walk the site with the photographer", owner: "aoife", due: "2026-09-24", stage: "done", clusterId: "sorted", tone: 9, at: [1276, 246] },
    // Signage
    { id: "w13", taskId: "mf-12", title: "Reprint the faded welcome sign", owner: "dara", due: "2026-09-22", stage: "todo", clusterId: "signage", tone: 4, at: [40, 476] },
    { id: "w14", title: "Table plan easel by the barn door", clusterId: "signage", tone: 4, at: [226, 476] },
    { id: "w15", title: "Arrows from the car park to the orchard", owner: "tomas", clusterId: "signage", tone: 4, at: [40, 662] },
    // Loose ideas
    { id: "w16", title: "Sparkler exit at 23:00?", tone: 9, at: [462, 506], comments: 4 },
    { id: "w17", title: "Blankets on the benches if it turns cold", tone: 2, at: [672, 500] },
    { id: "w18", title: "Rings back from Tolland & Sons in time?", tone: 9, at: [566, 672] },
    // After the day
    { id: "w19", taskId: "mf-17", title: "Return the marquee to Lawlor Hire", owner: "tomas", due: "2026-10-05", stage: "todo", clusterId: "after", tone: 9, at: [864, 476] },
    { id: "w20", taskId: "mf-37", title: "Pay The Lindens' balance", owner: "orla", due: "2026-10-06", stage: "todo", clusterId: "after", tone: 9, at: [1050, 476] },
    { id: "w21", taskId: "mf-27", title: "Send Mara and Finn the thank-you card", owner: "aoife", due: "2026-10-07", stage: "todo", clusterId: "after", tone: 9, at: [864, 662] },
  ]);
  return {
    id: "orchard",
    name: "Mara & Finn's wedding, Sat 3 Oct",
    short: "Mara & Finn's wedding",
    kind: "The Orchard, events",
    project: "mara-finn",
    tone: (projectById("mara-finn")?.hue ?? 9) as Tone,
    people,
    presence: ["aoife", "dara"],
    notes,
    clusters: [
      { id: "day", name: "The day", tone: 1 },
      { id: "suppliers", name: "Suppliers", tone: 2 },
      { id: "kitchen", name: "Kitchen and bar", tone: 3 },
      { id: "sorted", name: "Sorted", tone: 1 },
      { id: "signage", name: "Signage", tone: 4 },
      { id: "after", name: "After the day", tone: 9 },
    ],
    connectors: [
      { id: "k1", from: "w7", to: "w1" },
      { id: "k2", from: "w10", to: "w11" },
    ],
    scribbles: [
      { id: "s1", text: "118 guests, 8 days to go", x: 1262, y: 484 },
      { id: "s2", text: "Golden hour on the terrace at 19:10", x: 462, y: 452 },
      { id: "s3", text: "Ask Mara before ordering", x: 1262, y: 548 },
    ],
  };
}

/* ── Walls 2 and 3: two more Orchard projects, built from the shared store ── */

type ProjectWallSpec = {
  id: string;
  project: ProjectId;
  name: string;
  short: string;
  kind: string;
  /** Columns per workstream group, in the project's workstream order. Default 2. */
  cols?: Record<string, number>;
  /** Ideas that are not tasks yet, and any group of their own. */
  ideas: Seed[];
  ideaGroups?: Cluster[];
  scribbles: Scribble[];
  presence: [string, string];
};

const GROUP_TONES: Tone[] = [1, 2, 3, 9, 4];
const GRID = NOTE + 18;

/**
 * A wall for a project in the shared store. Every task in the project is a
 * note, grouped by its workstream and laid out as a grid, left to right; the
 * title, owner, date, status and steps are read live from the task. Only the
 * ideas and the handwritten labels are the wall's own.
 */
function projectWall(spec: ProjectWallSpec): Wall {
  const project = projectById(spec.project)!;
  const tasks = INITIAL_STATE.tasks.filter((t) => t.project === spec.project);
  const ids = [...new Set<string>([...project.people, ...tasks.map((t) => t.owner)])];
  const people: Person[] = ids.flatMap((id) => {
    const p = personById(id);
    return p ? [{ id, name: p.name, first: p.first, initials: p.initials, tone: p.hue as Tone }] : [];
  });
  const clusters: Cluster[] = [];
  const seeds: Seed[] = [];
  let x = 40;
  project.workstreams.forEach((ws, i) => {
    const mine = tasks.filter((t) => t.workstream === ws.id);
    if (!mine.length) return;
    const tone = GROUP_TONES[i % GROUP_TONES.length];
    const cols = Math.min(mine.length, spec.cols?.[ws.id] ?? 2);
    // One note is not a group: it sits loose, in its own column.
    const clusterId = mine.length >= 2 ? ws.id : undefined;
    if (clusterId) clusters.push({ id: clusterId, name: ws.name, tone });
    mine.forEach((t, j) => {
      seeds.push({
        id: `${spec.id}-${t.id}`,
        taskId: t.id,
        title: t.title,
        owner: t.owner,
        due: t.due,
        stage: t.status,
        clusterId,
        tone,
        at: [x + (j % cols) * GRID, 60 + Math.floor(j / cols) * GRID],
      });
    });
    x += cols * GRID + 40;
  });
  return {
    id: spec.id,
    name: spec.name,
    short: spec.short,
    kind: spec.kind,
    project: spec.project,
    tone: project.hue as Tone,
    people,
    presence: spec.presence,
    notes: place([...seeds, ...spec.ideas]),
    clusters: [...clusters, ...(spec.ideaGroups ?? [])],
    connectors: [],
    scribbles: spec.scribbles,
  };
}

/* Winter season launch, Mon 12 Oct: the brochure, the menus, the photos and the website, plus ideas for the evening. */
function winterWall(): Wall {
  return projectWall({
    id: "winter",
    project: "winter-launch",
    name: "Winter season launch ideas",
    short: "Winter launch ideas",
    kind: "The Orchard, marketing",
    cols: { photos: 1, web: 1 },
    ideas: [
      { id: "wi1", title: "Hot port and mince pies on arrival?", clusterId: "evening", tone: 4, at: [1040, 476], comments: 3 },
      { id: "wi2", title: "Fire pit on the terrace for the launch evening", clusterId: "evening", tone: 4, at: [1226, 476] },
      { id: "wi3", title: "A short film of the barn by firelight, if Fern Photo can stay on", clusterId: "evening", tone: 4, at: [1040, 662], comments: 1 },
      { id: "wi4", title: "Wreath-making table as a taster for December", clusterId: "evening", tone: 4, at: [1226, 662] },
      { id: "wi5", title: "Gift vouchers at the door?", tone: 9, at: [462, 500] },
      { id: "wi6", title: "Invite this year's couples back for the evening", tone: 2, at: [672, 506], comments: 2 },
    ],
    ideaGroups: [{ id: "evening", name: "Ideas for the evening", tone: 4 }],
    scribbles: [
      { id: "s1", text: "Brochure to print Fri 2 Oct", x: 462, y: 452 },
      { id: "s2", text: "Launch evening, Mon 12 Oct", x: 1030, y: 410 },
    ],
    presence: ["siobhan", "dev"],
  });
}

/* Christmas markets, opening Sat 5 Dec: the stalls, the site, the food, and where everything goes in the courtyard. */
function christmasWall(): Wall {
  return projectWall({
    id: "christmas",
    project: "christmas",
    name: "Christmas markets layout",
    short: "Christmas markets layout",
    kind: "The Orchard, seasons",
    cols: { site: 1, food: 1 },
    ideas: [
      { id: "ci1", title: "Two rows of stalls down the courtyard, fifteen a side", clusterId: "layout", tone: 4, at: [1040, 60], comments: 2 },
      { id: "ci2", title: "Mulled cider by the barn door, where the queue has room", clusterId: "layout", tone: 4, at: [1226, 60] },
      { id: "ci3", title: "Food stalls along the walled garden, away from the craft tables", clusterId: "layout", tone: 4, at: [1040, 246] },
      { id: "ci4", title: "Choir on the terrace steps at 17:00?", clusterId: "layout", tone: 4, at: [1226, 246], comments: 4 },
      { id: "ci5", title: "Buggy and wheelchair route past the marquee", tone: 2, at: [1040, 500] },
      { id: "ci6", title: "Wreath stall beside the tree?", tone: 9, at: [1240, 506] },
    ],
    ideaGroups: [{ id: "layout", name: "Courtyard layout", tone: 4 }],
    scribbles: [
      { id: "s1", text: "Thirty stalls, two weekends", x: 462, y: 640 },
      { id: "s2", text: "Opening weekend, Sat 5 Dec", x: 1030, y: 440 },
    ],
    presence: ["niamh", "tomas"],
  });
}

function blankWall(): Wall {
  return {
    id: "blank",
    name: "New wall",
    short: "New wall",
    kind: "Empty",
    tone: 2,
    people: [{ id: "you", name: "You", first: "You", initials: "YO", tone: 1 }],
    presence: [],
    notes: [],
    clusters: [],
    connectors: [],
    scribbles: [],
    starterPad: 3,
  };
}

export function initialWalls(): Record<string, Wall> {
  return { orchard: weddingWall(), winter: winterWall(), christmas: christmasWall(), blank: blankWall() };
}

export const WALL_ORDER = ["orchard", "winter", "christmas", "blank"] as const;
