/*
 * Ask the files: invented sample data for The Orchard, events (Kinsale, Co.
 * Cork). Every file carries the text written inside it, so snippets, answers
 * and highlights are real passages rather than lorem. People, projects,
 * suppliers and task titles follow the demo's shared world. Today is Friday
 * 25 September 2026.
 */

import {
  FILES as STORE_FILES,
  INITIAL_STATE,
  fmtDate,
  personById,
  projectById,
  type DemoState,
  type FileRef,
} from "../../demo/store";

export const TODAY = "2026-09-25";

/** A project or person colour from the shared store, so every surface shows the same hue. */
const hueOf = (hue: number | undefined) =>
  hue ? `var(--v3-project-${hue})` : "var(--v3-kind-neutral)";
const projectTone = (id: string) => hueOf(projectById(id)?.hue);
const personTone = (id: string) => hueOf(personById(id)?.hue);

export type ProjectId =
  | "mara-finn"
  | "harvest"
  | "kavanagh"
  | "barn-roof"
  | "winter-launch"
  | "christmas"
  | "ada-theo";
export type PersonId =
  | "you"
  | "aoife"
  | "dara"
  | "tomas"
  | "dev"
  | "niamh"
  | "siobhan"
  | "mara"
  | "finn"
  | "sinead"
  | "lawlor";
export type Kind = "doc" | "pdf" | "sheet" | "image" | "design" | "link";
export type State = "approved" | "signed" | "draft" | "awaiting";
export type Source = "upload" | "drive" | "link";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  tone: string;
  lead: PersonId;
  /** Who files are shared with when the lead made them. */
  second: PersonId;
};
export type Person = {
  id: PersonId;
  name: string;
  first: string;
  initials: string;
  role: string;
  tone: string;
  client?: boolean;
  /** A supplier who owns a file, not someone on the team. Left out of the people filter. */
  supplier?: boolean;
};

export const PROJECTS: Project[] = [
  {
    id: "mara-finn",
    name: "Mara & Finn's wedding",
    short: "Mara & Finn",
    tone: projectTone("mara-finn"),
    lead: "aoife",
    second: "dara",
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    short: "Harvest supper",
    tone: projectTone("harvest"),
    lead: "dev",
    second: "niamh",
  },
  {
    id: "kavanagh",
    name: "Kavanagh 40th",
    short: "Kavanagh 40th",
    tone: projectTone("kavanagh"),
    lead: "you",
    second: "aoife",
  },
  {
    id: "barn-roof",
    name: "Barn roof and heating works",
    short: "Barn roof",
    tone: projectTone("barn-roof"),
    lead: "tomas",
    second: "dara",
  },
  {
    id: "winter-launch",
    name: "Winter season launch",
    short: "Winter launch",
    tone: projectTone("winter-launch"),
    lead: "siobhan",
    second: "niamh",
  },
  {
    id: "christmas",
    name: "Christmas markets at The Orchard",
    short: "Christmas markets",
    tone: projectTone("christmas"),
    lead: "niamh",
    second: "dara",
  },
  {
    id: "ada-theo",
    name: "Ada & Theo's winter micro-wedding",
    short: "Ada & Theo",
    tone: projectTone("ada-theo"),
    lead: "aoife",
    second: "dara",
  },
];

/** The project with no files yet, for the first-run state. */
export const EMPTY_PROJECT: ProjectId = "ada-theo";

export const PEOPLE: Person[] = [
  {
    id: "you",
    name: "Orla Byrne",
    first: "You",
    initials: "OB",
    role: "Owner",
    tone: personTone("orla"),
  },
  {
    id: "aoife",
    name: "Aoife Brennan",
    first: "Aoife",
    initials: "AB",
    role: "Wedding coordinator",
    tone: personTone("aoife"),
  },
  {
    id: "dara",
    name: "Dara Hegarty",
    first: "Dara",
    initials: "DH",
    role: "Venue manager",
    tone: personTone("dara"),
  },
  {
    id: "tomas",
    name: "Tomás Ryan",
    first: "Tomás",
    initials: "TR",
    role: "Venue and works",
    tone: personTone("tomas"),
  },
  {
    id: "dev",
    name: "Dev Patel",
    first: "Dev",
    initials: "DP",
    role: "Head chef",
    tone: personTone("dev"),
  },
  {
    id: "niamh",
    name: "Niamh Walsh",
    first: "Niamh",
    initials: "NW",
    role: "Front of house",
    tone: personTone("niamh"),
  },
  {
    id: "siobhan",
    name: "Siobhán Kelly",
    first: "Siobhán",
    initials: "SK",
    role: "Sales and marketing",
    tone: personTone("siobhan"),
  },
  {
    id: "mara",
    name: "Mara Quinn",
    first: "Mara",
    initials: "MQ",
    role: "Client",
    tone: personTone("mara"),
    client: true,
  },
  {
    id: "finn",
    name: "Finn Walsh",
    first: "Finn",
    initials: "FW",
    role: "Client",
    tone: personTone("finn"),
    client: true,
  },
  {
    id: "sinead",
    name: "Sinéad Kavanagh",
    first: "Sinéad",
    initials: "SK",
    role: "Client, Lena's sister",
    tone: personTone("sinead"),
    client: true,
  },
  {
    id: "lawlor",
    name: "Lawlor Hire",
    first: "Lawlor Hire",
    initials: "LH",
    role: "Supplier, marquee",
    tone: "var(--v3-kind-neutral)",
    supplier: true,
  },
];

export type FileItem = {
  id: string;
  name: string;
  kind: Kind;
  project: ProjectId;
  by: PersonId;
  date: string;
  source: Source;
  pages: number;
  body: string[];
  approvedBy?: PersonId;
  approvedOn?: string;
  state?: State;
  /** The task title, read from the shared store by `taskId`. */
  task?: string;
  /** The task it belongs to, in the shared store ("mf-21"). */
  taskId?: string;
  shared?: boolean;
  due?: boolean;
  /** Series key and version number. */
  series?: string;
  v?: number;
  /** Text read out of an image. Only searched when "read text in images" is on. */
  ocr?: string;
  /** Who still has to approve it, when state is "awaiting". */
  waitingOn?: PersonId;
  /** Someone else's Drive folder: we know it exists and roughly what it is, nothing more. */
  lockedIn?: PersonId;
  size: string;
  /** Last opened, for Jump back in. */
  opened?: string;
  /** Art direction for image previews. */
  art?: [string, string];
};

type Raw = Omit<FileItem, "task">;

function f(x: Raw): Raw {
  return x;
}

/* ── One store ──────────────────────────────────────────────────────
 * Files keeps the words written inside each file, but every fact another
 * surface repeats (who added it, when, its version, its approval, who it is
 * waiting on and the task it belongs to) is read from demo/store. A file the
 * store knows is aligned to it here, so Files can never disagree with Tasks,
 * Projects or the Ctrl K menu.
 */

/** Files surface id → store file id. */
const STORE_ID: Record<string, string> = {
  "w-seat-4": "f-seat-4",
  "w-seat-3": "f-seat-3",
  "w-seat-2": "f-seat-2",
  "w-marquee-3": "f-marquee-3",
  "w-marquee-2": "f-marquee-2",
  "w-menu": "f-menu-2",
  "w-florist": "f-florist",
  "w-band": "f-rider",
  "w-shots": "f-shots",
  "w-prosecco": "f-prosecco",
  "w-bar": "f-bar",
  "w-runsheet": "f-runsheet-2",
  "w-weather": "f-wet",
  "w-sign": "f-sign",
  "w-coach": "f-coach",
  "w-contract": "f-contract",
  "r-heating": "f-heating",
  "r-slate": "f-slate",
  "l-plan": "f-launch-plan",
  "l-brochure-2": "f-brochure-2",
  "l-brochure-1": "f-brochure-1",
  "kv-invite": "f-kv-invite",
};

/** Files the store doesn't list, and the store task each one belongs to. */
const TASK_ID: Record<string, string> = {
  "w-tasting": "mf-4",
  "w-guests": "mf-7",
  "w-marquee-1": "mf-13",
  "w-runsheet-1": "mf-41",
  "h-menu": "hv-2",
  "h-tickets": "hv-5",
  "h-table": "hv-3",
  "l-web": "wl-11",
  "c-stalls": "cm-1",
};

const STORE_BY_ID = new Map<string, FileRef>(STORE_FILES.map((x) => [x.id, x]));
const LOCAL_PERSON: Record<string, PersonId> = { orla: "you" };
const local = (id: string | undefined): PersonId | undefined =>
  id ? (LOCAL_PERSON[id] ?? (id as PersonId)) : undefined;

/** The store's task title, so a file and its task always use the same words. */
export function taskTitle(taskId: string | undefined): string | undefined {
  return taskId ? INITIAL_STATE.tasks.find((x) => x.id === taskId)?.title : undefined;
}

function align(x: Raw): FileItem {
  const ref = STORE_BY_ID.get(STORE_ID[x.id] ?? "");
  const taskId = ref ? ref.taskId : TASK_ID[x.id];
  const out: FileItem = { ...x, taskId, task: taskTitle(taskId) };
  if (!ref) return out;
  out.by = local(ref.by) ?? x.by;
  out.date = ref.date;
  out.state = ref.state;
  out.approvedBy = ref.state === "approved" ? local(ref.approvedBy) : undefined;
  out.approvedOn = ref.approvedOn ? fmtDate(ref.approvedOn) : undefined;
  out.waitingOn = ref.state === "awaiting" ? local(ref.awaiting) : undefined;
  if (ref.series) out.v = ref.version;
  return out;
}

const RAW: Raw[] = [
  /* ── Mara & Finn's wedding ─────────────────────────────────────── */
  // Mara approved this on the morning of 25 Sep: the store lists it (f-prosecco), so it is here from first paint.
  f({
    id: "w-prosecco",
    name: "Prosecco order, Kinsale Wine Co.xlsx",
    kind: "sheet",
    project: "mara-finn",
    by: "dev",
    date: "2026-09-25",
    source: "drive",
    pages: 1,
    approvedBy: "mara",
    approvedOn: "25 Sep",
    state: "approved",
    shared: true,
    due: true,
    size: "Google Sheet",
    body: [
      "Prosecco for the drinks reception, from Kinsale Wine Co.",
      "10 cases (60 bottles) for 118 guests, plus a magnum for the toast: €1,180 in all.",
      "Approved by Mara, 25 Sep. Dev places the order by Tuesday 29 September.",
    ],
  }),
  f({
    id: "w-seat-4",
    name: "Seating plan v4",
    kind: "sheet",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-24",
    source: "drive",
    pages: 3,
    series: "seating",
    v: 4,
    approvedBy: "mara",
    approvedOn: "24 Sep",
    state: "approved",
    shared: true,
    due: true,
    size: "Google Sheet",
    opened: "2h ago",
    body: [
      "Mara & Finn · Saturday 3 October · The Orchard, long barn and the orchard marquee",
      "Final count: 118 guests at 15 tables. Sent to Mara for approval on Thursday 24 September.",
      "Table 1 (top table) | Mara, Finn, Clodagh, Rory, Pádraig, Úna",
      "Table 4 | College friends. Aunt Rose moves to table 11, away from the speakers",
      "Table 6 | Wheelchair route kept clear from the barn door",
      "Table 9 | Walsh cousins, two high chairs",
      "Table 14 | The Galway cousins, together since v3",
      "Changes since v3: the Galway cousins together at table 14, Aunt Rose away from the speakers, the children's table by the doors and the wheelchair route to table 6.",
      "Dietary: 9 vegetarian, 3 vegan, 2 coeliac, 1 nut allergy at table 6.",
    ],
  }),
  f({
    id: "w-seat-3",
    name: "Seating plan v3",
    kind: "sheet",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-18",
    source: "drive",
    pages: 3,
    series: "seating",
    v: 3,
    state: "draft",
    size: "Google Sheet",
    body: [
      "Mara & Finn · Saturday 3 October · The Orchard, long barn and the orchard marquee",
      "Count: 118 guests at 15 tables. Approved by Mara, 21 Sep.",
      "Table 1 (top table) | Mara, Finn, Clodagh, Rory",
      "Table 4 | College friends and Aunt Rose",
      "Fifteen rounds of 8 keep the dance floor. The Galway cousins are split across two tables.",
    ],
  }),
  f({
    id: "w-seat-2",
    name: "Seating plan v2",
    kind: "sheet",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-10",
    source: "drive",
    pages: 2,
    series: "seating",
    v: 2,
    state: "draft",
    size: "Google Sheet",
    body: [
      "First pass seating plan for Mara & Finn.",
      "Draft count: 124 guests at long tables in the barn, before the last replies.",
      "Mara prefers rounds. Redo with rounds of 8.",
    ],
  }),
  f({
    id: "w-marquee-3",
    name: "Marquee quote, Lawlor Hire v3.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-23",
    source: "upload",
    pages: 4,
    series: "marquee",
    v: 3,
    state: "awaiting",
    waitingOn: "mara",
    due: true,
    size: "184 KB",
    opened: "Yesterday",
    body: [
      "Lawlor Hire · Quote 2231-C for The Orchard, Saturday 3 October.",
      "Prepared for Aoife Brennan. Valid for 14 days.",
      "Revised total for the 12 x 24m frame marquee with clear sides: €3,850 incl. VAT. This replaces our quote of 18 Sep (€4,200).",
      "The saving comes from dropping the second patio heater and using your own festoon lights.",
      "Build Thursday 1 October from 10:00. Collection Monday 5 October from 09:00.",
      "A 30% deposit holds the date until 30 Sep.",
      "Clear sides can swap for white sides on the day at no charge if it rains.",
      "Signed for Lawlor Hire: Pat Lawlor.",
    ],
  }),
  f({
    id: "w-marquee-2",
    name: "Marquee quote, Lawlor Hire v2.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-18",
    source: "upload",
    pages: 4,
    series: "marquee",
    v: 2,
    size: "179 KB",
    body: [
      "Lawlor Hire · Quote 2231-B for The Orchard, Saturday 3 October.",
      "Total for the 12 x 24m frame marquee with clear sides: €4,200 incl. VAT.",
      "Includes two patio heaters and Lawlor Hire festoon lighting.",
    ],
  }),
  f({
    id: "w-marquee-1",
    name: "Marquee quote, Lawlor Hire.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-04",
    source: "upload",
    pages: 3,
    series: "marquee",
    v: 1,
    size: "166 KB",
    body: [
      "Lawlor Hire · Quote 2231 for The Orchard.",
      "Total for the 12 x 30m frame marquee: €4,960 incl. VAT.",
      "Hard flooring optional at €780.",
    ],
  }),
  f({
    id: "w-tasting",
    name: "Menu tasting booking.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "dev",
    date: "2026-09-12",
    source: "upload",
    pages: 1,
    shared: true,
    size: "62 KB",
    body: [
      "Menu tasting for Mara & Finn.",
      "Friday 25 September at 16:00 in the Orchard kitchen, with Dev.",
      "Six courses. Mara asked to bring Finn's mother, so we're setting for three.",
      "Kinsale Wine Co are sending two whites to try with the main. Final numbers to the kitchen by Wednesday 30 September.",
    ],
  }),
  f({
    id: "w-menu",
    name: "Wedding menu, draft 2.docx",
    kind: "doc",
    project: "mara-finn",
    by: "dev",
    date: "2026-09-24",
    source: "upload",
    pages: 2,
    approvedBy: "mara",
    approvedOn: "24 Sep",
    state: "approved",
    shared: true,
    size: "38 KB",
    body: [
      "Wedding breakfast for 118, served at 17:00.",
      "Starter: beetroot, goat's curd and toasted hazelnut.",
      "Main: slow lamb shoulder with salsa verde, or wild mushroom risotto.",
      "Dessert: lemon posset with brown butter shortbread.",
      "Evening food at 21:30: blaas with chips in paper cones.",
    ],
  }),
  f({
    id: "w-deposit",
    name: "Deposit invoice, Mara & Finn.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "you",
    date: "2026-07-09",
    source: "upload",
    pages: 1,
    shared: true,
    size: "94 KB",
    body: [
      "Invoice 0098 · The Orchard · Mara Quinn and Finn Walsh.",
      "Deposit received: €2,500 on 9 July. Thank you.",
      "Balance of €7,480 due by 30 September, bank transfer to the account below.",
    ],
  }),
  f({
    id: "w-contract",
    name: "Venue contract, signed.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "you",
    date: "2026-07-02",
    source: "upload",
    pages: 6,
    state: "signed",
    shared: true,
    size: "412 KB",
    body: [
      "Venue hire agreement between The Orchard and Mara Quinn and Finn Walsh.",
      "Exclusive use of The Orchard from 12:00 Saturday 3 October to 11:00 Sunday 4 October.",
      "Music off at 00:30 under the venue licence. Bar closes at 00:15.",
      "Maximum 130 guests seated in the long barn, 180 with the marquee.",
      "Signed by both parties on 2 July 2026.",
    ],
  }),
  f({
    id: "w-runsheet",
    name: "Saturday run-sheet v2.docx",
    kind: "doc",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-24",
    source: "upload",
    pages: 2,
    series: "w-run",
    v: 2,
    state: "draft",
    due: true,
    size: "44 KB",
    body: [
      "13:30 Ceremony in the walled garden. Chairs out by 12:45.",
      "14:15 Drinks reception on the terrace. Prosecco, tonic and the good olives out, ice in the trough.",
      "17:00 Dinner called by the bell.",
      "20:45 First dance, then The Lindens.",
      "21:30 Evening food: blaas and chips.",
      "00:30 Music off. Harbour Coaches at the gate from 00:45.",
    ],
  }),
  f({
    id: "w-runsheet-1",
    name: "Saturday run-sheet.docx",
    kind: "doc",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-16",
    source: "upload",
    pages: 1,
    series: "w-run",
    v: 1,
    size: "39 KB",
    body: [
      "13:00 Ceremony in the walled garden.",
      "17:00 Dinner.",
      "Band and coach times to be confirmed.",
    ],
  }),
  f({
    id: "w-coach",
    name: "Coach booking, Harbour Coaches.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "niamh",
    date: "2026-09-23",
    source: "upload",
    pages: 1,
    state: "signed",
    shared: true,
    size: "74 KB",
    body: [
      "Harbour Coaches · Booking 4471 for Mara & Finn's wedding, Saturday 3 October.",
      "Two 49-seat coaches for guests staying in town.",
      "Outbound: the coaches leave Kinsale town pier at 13:00 and reach The Orchard by 13:15.",
      "Home runs from The Orchard gate at 00:45 and 01:15, back to the pier.",
      "€1,140 for both coaches, invoice to The Orchard.",
    ],
  }),
  f({
    id: "w-bar",
    name: "Bar order, wedding weekend.xlsx",
    kind: "sheet",
    project: "mara-finn",
    by: "dev",
    date: "2026-09-19",
    source: "drive",
    pages: 2,
    state: "draft",
    due: true,
    size: "Google Sheet",
    opened: "Monday",
    body: [
      "Bar order for Mara & Finn's wedding, through Kinsale Wine Co.",
      "Tonic: 6 cases of Mediterranean tonic, and the good olives (2 x 1kg tubs).",
      "Gin | Irish botanical gin | 8 bottles",
      "Beer | Kinsale pale ale | 6 kegs",
      "Not ordered yet. Needed by Wednesday 30 September, side gate before 11:00.",
    ],
  }),
  f({
    id: "w-weather",
    name: "Wet-weather plan, drinks reception.docx",
    kind: "doc",
    project: "mara-finn",
    by: "you",
    date: "2026-09-24",
    source: "upload",
    pages: 1,
    state: "draft",
    size: "21 KB",
    body: [
      "If it rains, the drinks reception moves from the terrace into the orchard marquee.",
      "Clear sides swap for white sides, per Lawlor Hire's quote.",
      "Festoon lights on the terrace still to be tested by Tomás on Thursday 1 October.",
    ],
  }),
  f({
    id: "w-sign",
    name: "Welcome sign artwork.png",
    kind: "image",
    project: "mara-finn",
    by: "dara",
    date: "2026-09-12",
    source: "upload",
    pages: 1,
    size: "1.1 MB",
    art: ["#1f5c4f", "#d9c9a3"],
    body: ["Artwork for the new welcome sign at the lane entrance."],
    ocr: "Welcome to The Orchard. Parking behind the walled garden. Please drive slowly, hens about.",
  }),
  f({
    id: "w-terrace",
    name: "Terrace at golden hour.jpg",
    kind: "image",
    project: "mara-finn",
    by: "finn",
    date: "2026-09-14",
    source: "upload",
    pages: 1,
    size: "2.3 MB",
    art: ["#e8a15a", "#6d3b52"],
    body: ["Reference photo Finn took at the viewing, for the photographer."],
  }),
  f({
    id: "w-sketch",
    name: "Dessert table sketch.jpg",
    kind: "image",
    project: "mara-finn",
    by: "mara",
    date: "2026-09-19",
    source: "upload",
    pages: 1,
    size: "1.4 MB",
    art: ["#f1e6d2", "#b48a66"],
    body: ["Mara's sketch of the dessert table, photographed on her phone."],
    ocr: "Cake stand left of the bar, three tiers, the lemon one on top. Flowers: no lilies. Candles in jars, not tapers.",
  }),
  f({
    id: "w-florist",
    name: "Florist proposal, Fern and Furrow.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "mara",
    date: "2026-09-15",
    source: "upload",
    pages: 3,
    approvedBy: "mara",
    approvedOn: "20 Sep",
    state: "approved",
    shared: true,
    size: "2.1 MB",
    body: [
      "Fern and Furrow · Proposal for Mara & Finn.",
      "Garden roses, sweet pea and trailing jasmine. No lilies.",
      "Ceremony arch: €640. Table posies for 15 tables: €450.",
      "Delivery Saturday 3 October at 10:00, collection Sunday before 11:00.",
      "A €300 deposit holds the date. We'll confirm once it lands.",
    ],
  }),
  f({
    id: "w-playlist",
    name: "Evening playlist",
    kind: "link",
    project: "mara-finn",
    by: "finn",
    date: "2026-09-20",
    source: "link",
    pages: 1,
    shared: true,
    size: "Link",
    body: [
      "Finn's evening playlist for between The Lindens' sets.",
      "First dance at 20:45. No line dancing, per Mara.",
    ],
  }),
  f({
    id: "w-guests",
    name: "Guest list and RSVPs.xlsx",
    kind: "sheet",
    project: "mara-finn",
    by: "mara",
    date: "2026-09-22",
    source: "drive",
    pages: 2,
    shared: true,
    due: true,
    size: "Google Sheet",
    body: [
      "118 yes, 11 no. Everyone has replied.",
      "Plus-ones confirmed for everyone at tables 4 and 7.",
      "Twenty-six guests staying in Kinsale take the Harbour Coaches from the pier.",
    ],
  }),
  f({
    id: "w-band",
    name: "Band rider, The Lindens.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "finn",
    date: "2026-09-16",
    source: "upload",
    pages: 2,
    approvedBy: "mara",
    approvedOn: "17 Sep",
    state: "approved",
    size: "88 KB",
    body: [
      "The Lindens · Technical rider.",
      "Two 13A sockets stage left. Stage at least 5m x 3m.",
      "Arrival and load-in time to be confirmed, not before 17:30.",
      "Hot meal for five at 19:30, not before the speeches.",
      "Sets: 21:00 to 22:00 and 22:30 to 00:15.",
    ],
  }),
  f({
    id: "w-shots",
    name: "Photographer shot list.docx",
    kind: "doc",
    project: "mara-finn",
    by: "finn",
    date: "2026-09-18",
    source: "upload",
    pages: 2,
    approvedBy: "mara",
    approvedOn: "19 Sep",
    state: "approved",
    size: "31 KB",
    body: [
      "Must have: Mara's grandmother with all the grandchildren, under the old pear tree.",
      "Golden hour on the terrace at 19:10, ten minutes, just the two of us.",
      "No posed shots during the speeches.",
    ],
  }),
  f({
    id: "w-rings",
    name: "Ring collection, Tolland & Sons.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "finn",
    date: "2026-09-19",
    source: "upload",
    pages: 1,
    size: "46 KB",
    body: [
      "Tolland & Sons · Two bands, engraved inside with 3.10.26.",
      "Ready to collect from Tuesday 29 September. Bring the receipt.",
    ],
  }),
  f({
    id: "w-marquee-layout",
    name: "Marquee layout, Lawlor Hire.png",
    kind: "image",
    project: "mara-finn",
    by: "aoife",
    date: "2026-09-23",
    source: "upload",
    pages: 1,
    size: "740 KB",
    art: ["#e9eef2", "#6b8594"],
    body: ["Lawlor Hire's layout drawing for the orchard marquee."],
    ocr: "12 x 24m frame. Clear sides. Entrance on the terrace side. Heater position A only.",
  }),
  f({
    id: "w-insurance",
    name: "Public liability insurance, Lawlor Hire.pdf",
    kind: "pdf",
    project: "mara-finn",
    by: "lawlor",
    date: "2026-09-20",
    source: "drive",
    pages: 3,
    lockedIn: "lawlor",
    size: "Drive file",
    body: [],
  }),

  /* ── Harvest supper club ──────────────────────────────────────── */
  f({
    id: "h-menu",
    name: "Harvest supper menu, draft 1.docx",
    kind: "doc",
    project: "harvest",
    by: "dev",
    date: "2026-09-22",
    source: "upload",
    pages: 2,
    state: "draft",
    size: "33 KB",
    body: [
      "Harvest supper club · Saturday 17 October · forty seats at one long table in the long barn.",
      "Five courses from the orchard and the walled garden.",
      "Wine pairing tasting with Kinsale Wine Co: Tuesday 6 October at 15:00 in the kitchen.",
      "Apples three ways to finish: tart, cider sorbet, and a cheese course with membrillo.",
    ],
  }),
  f({
    id: "h-tickets",
    name: "Booking page, Harvest supper",
    kind: "link",
    project: "harvest",
    by: "niamh",
    date: "2026-09-23",
    source: "link",
    pages: 1,
    shared: true,
    due: true,
    size: "Link",
    body: [
      "Forty seats at €65 each, on sale Monday 28 September at 10:00.",
      "One long table, one sitting, 19:30 for 20:00.",
    ],
  }),
  f({
    id: "h-table",
    name: "Long table layout.pdf",
    kind: "design",
    project: "harvest",
    by: "dara",
    date: "2026-09-16",
    source: "upload",
    pages: 1,
    size: "610 KB",
    body: [
      "One long table of forty down the middle of the long barn.",
      "Candles in jars, not tapers. Benches on the fireplace side.",
    ],
  }),
  f({
    id: "h-rota",
    name: "Staff rota, October.xlsx",
    kind: "sheet",
    project: "harvest",
    by: "dev",
    date: "2026-09-24",
    source: "drive",
    pages: 1,
    size: "Google Sheet",
    body: [
      "Saturday 3 Oct | Mara & Finn's wedding. Dev leads the kitchen, Niamh front of house.",
      "Saturday 17 Oct | Harvest supper club. Dev and two chefs, Niamh on the floor.",
      "Monday 12 Oct | Winter season launch. Siobhán in from 08:00.",
    ],
  }),

  /* ── Kavanagh 40th ────────────────────────────────────────────── */
  f({
    id: "kv-invite",
    name: "Invitation, Kavanagh 40th.pdf",
    kind: "design",
    project: "kavanagh",
    by: "siobhan",
    date: "2026-09-21",
    source: "upload",
    pages: 1,
    state: "awaiting",
    size: "1.6 MB",
    body: [
      "Lena is 40. Keep it quiet.",
      "Saturday 14 November, 19:30, the barn at The Orchard.",
      "RSVPs to Orla by Friday 30 October.",
    ],
  }),
  f({
    id: "kv-brief",
    name: "Party brief, Kavanagh 40th.docx",
    kind: "doc",
    project: "kavanagh",
    by: "you",
    date: "2026-09-08",
    source: "upload",
    pages: 1,
    size: "24 KB",
    body: [
      "Surprise party for Lena Kavanagh, booked by her sister.",
      "70 guests in the barn, food stations, no speeches.",
    ],
  }),

  /* ── Barn roof and heating works ──────────────────────────────── */
  f({
    id: "r-heating",
    name: "Heating quote, underfloor.pdf",
    kind: "pdf",
    project: "barn-roof",
    by: "tomas",
    date: "2026-09-22",
    source: "upload",
    pages: 3,
    state: "awaiting",
    due: true,
    size: "212 KB",
    opened: "Tuesday",
    body: [
      "Underfloor heating for the long barn, 24m x 14m.",
      "Total: €18,400 incl. VAT, with a heat pump and a new manifold.",
      "Work starts once the slates are on. Two weeks on site.",
    ],
  }),
  f({
    id: "r-slate",
    name: "Slate delivery note.pdf",
    kind: "pdf",
    project: "barn-roof",
    by: "tomas",
    date: "2026-09-17",
    source: "upload",
    pages: 1,
    due: true,
    size: "58 KB",
    body: [
      "Blue slate, 4,200 pieces, for the barn roof.",
      "Delivery moved from 16 September to Wednesday 30 September: the quarry is behind.",
      "The roof can't close until the slates are on, so the heating starts late.",
    ],
  }),
  f({
    id: "r-fire",
    name: "Fire safety certificate 2026.pdf",
    kind: "pdf",
    project: "barn-roof",
    by: "you",
    date: "2026-08-03",
    source: "upload",
    pages: 2,
    state: "signed",
    size: "240 KB",
    body: [
      "Certified for 250 people standing and 180 seated in the long barn.",
      "Four exits, all lit and signed. Recheck after the roof and heating works.",
    ],
  }),
  f({
    id: "r-floor",
    name: "Barn floor plan.pdf",
    kind: "design",
    project: "barn-roof",
    by: "dara",
    date: "2026-09-09",
    source: "upload",
    pages: 1,
    size: "860 KB",
    body: [
      "Long barn, 24m x 14m.",
      "15 rounds of 8 fit with a 6m dance floor. 16 rounds lose the dance floor.",
      "Stage to the left of the fireplace, two sockets behind the beam.",
    ],
  }),
  f({
    id: "r-survey",
    name: "Roof survey photos.jpg",
    kind: "image",
    project: "barn-roof",
    by: "tomas",
    date: "2026-09-02",
    source: "upload",
    pages: 1,
    size: "4.4 MB",
    art: ["#9aa3ab", "#3b4650"],
    body: ["Twelve photos of the barn roof from the survey, north side first."],
  }),

  /* ── Winter season launch ─────────────────────────────────────── */
  f({
    id: "l-plan",
    name: "Winter launch plan.docx",
    kind: "doc",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-20",
    source: "upload",
    pages: 3,
    state: "approved",
    approvedBy: "you",
    approvedOn: "21 Sep",
    due: true,
    size: "64 KB",
    opened: "Yesterday",
    body: [
      "The winter season goes live on Monday 12 October: brochure, website and socials on the same morning.",
      "The brochure goes to print on Friday 2 October.",
      "Photograph the barn with the fire lit on Monday 28 September, before the roof work starts.",
      "The winter weddings web page is live by Wednesday 7 October.",
      "Budget for launch week: €1,800 including the print run.",
    ],
  }),
  f({
    id: "l-brochure-2",
    name: "Winter brochure v2.pdf",
    kind: "design",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-23",
    source: "upload",
    pages: 8,
    series: "l-brochure",
    v: 2,
    state: "awaiting",
    due: true,
    size: "6.8 MB",
    body: [
      "The Orchard in winter · weddings, suppers and the Christmas markets.",
      "Winter weekdays from €4,500. Saturdays €9,800.",
      "Print run: 400 at A5 on uncoated stock.",
    ],
  }),
  f({
    id: "l-brochure-1",
    name: "Winter brochure.pdf",
    kind: "design",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-10",
    source: "upload",
    pages: 6,
    series: "l-brochure",
    v: 1,
    size: "5.2 MB",
    body: [
      "The Orchard in winter, first draft.",
      "Prices to be confirmed.",
    ],
  }),
  f({
    id: "l-grid",
    name: "Instagram grid, launch week",
    kind: "design",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-24",
    source: "link",
    pages: 1,
    state: "awaiting",
    size: "Figma",
    body: [
      "Nine posts for launch week. Post one: the fire lit in the barn. Post nine: winter dates open.",
    ],
  }),
  f({
    id: "l-web",
    name: "Winter weddings web page, draft.docx",
    kind: "doc",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-24",
    source: "upload",
    pages: 2,
    state: "draft",
    size: "29 KB",
    body: [
      "Winter weddings at The Orchard, from twenty guests by the fire to 130 in the long barn.",
      "The barn is heated from November.",
    ],
  }),
  f({
    id: "l-prices",
    name: "2027 wedding prices.pdf",
    kind: "pdf",
    project: "winter-launch",
    by: "you",
    date: "2026-09-23",
    source: "upload",
    pages: 2,
    state: "draft",
    size: "120 KB",
    body: [
      "Saturday exclusive use: €9,800. Fridays and Sundays: €7,200.",
      "Winter weekdays from €4,500. Marquee hire passed through at cost.",
    ],
  }),
  f({
    id: "l-reference",
    name: "Reference shots, last winter.jpg",
    kind: "image",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-14",
    source: "upload",
    pages: 1,
    shared: true,
    size: "3.2 MB",
    art: ["#c98a4b", "#2e2a3a"],
    body: ["Last winter's barn by candlelight, as a guide for Monday's shoot."],
  }),
  f({
    id: "l-press",
    name: "Press list.xlsx",
    kind: "sheet",
    project: "winter-launch",
    by: "siobhan",
    date: "2026-09-19",
    source: "drive",
    pages: 1,
    size: "Google Sheet",
    body: [
      "Twelve local writers and two wedding magazines.",
      "Send on Monday 12 October with the brochure.",
    ],
  }),

  /* ── Christmas markets at The Orchard ─────────────────────────── */
  f({
    id: "c-stalls",
    name: "Stall application form",
    kind: "link",
    project: "christmas",
    by: "niamh",
    date: "2026-09-24",
    source: "link",
    pages: 1,
    state: "draft",
    size: "Link",
    body: [
      "Thirty stalls over two weekends, from Saturday 5 December.",
      "€90 a weekend, electricity €20 extra.",
      "Applications open Thursday 1 October.",
    ],
  }),
  f({
    id: "c-map",
    name: "Market layout, courtyard.png",
    kind: "image",
    project: "christmas",
    by: "dara",
    date: "2026-09-15",
    source: "upload",
    pages: 1,
    size: "690 KB",
    art: ["#bfe0ea", "#2f6f8f"],
    body: ["Annotated plan of the courtyard and the long barn."],
    ocr: "Stalls 1 to 18 in the courtyard, 19 to 30 in the long barn. Mulled wine by the gate.",
  }),
];

export const FILES: FileItem[] = RAW.map(align);

/* ── Answers: a question gets a sentence back, always with its source ── */

export type Answer = {
  id: string;
  /** Every group must match at least one word (prefix match). */
  when: string[][];
  /**
   * The answer. A function reads the live store, so a task someone just
   * moved on the board changes the sentence here too.
   */
  sentence: string | ((s: DemoState) => string);
  /** Parts of the sentence to set in the strong weight. */
  strong: string[];
  file: string;
  /** Index into the file body. */
  passage: number;
  /** A second passage the answer also leans on (a deadline, a date). */
  also?: number;
  /** The words that answer the question: lit with the full highlighter. */
  marks: string[];
  /** Supporting context in the same passage (an old price, a date): underlined, never lit. */
  context?: string[];
  /**
   * What the live store changes about this answer: once an approval task is
   * done, the answer leads with the version it approved, from that file.
   */
  live?: (s: DemoState) => Partial<Omit<Answer, "id" | "when" | "live">> | undefined;
};

const statusOf = (s: DemoState, id: string) =>
  s.tasks.find((x) => x.id === id)?.status;
/** The day a task was finished, as "25 Sep"; undefined while it is open. */
const doneDay = (s: DemoState, id: string) => {
  const task = s.tasks.find((x) => x.id === id);
  return task?.status === "done" ? fmtDate(task.doneOn ?? TODAY) : undefined;
};

export const ANSWERS: Answer[] = [
  {
    id: "seating-approved",
    when: [
      ["seating", "tables", "plan"],
      ["approve", "approved", "signed", "sign", "agreed", "ok"],
    ],
    sentence: "Seating plan v3, on 21 Sep: 118 guests at 15 tables. v4 has been with Mara since Thu 24 Sep.",
    strong: ["Seating plan v3", "21 Sep"],
    file: "w-seat-3",
    passage: 1,
    marks: ["Approved by Mara, 21 Sep"],
    context: ["118 guests at 15 tables"],
    // "Approve the seating plan" is done: v4 is the plan Mara approved, so it leads.
    live: (s) => {
      const on = doneDay(s, "mf-21");
      if (!on) return undefined;
      return {
        sentence: `Seating plan v4, on ${on}: 118 guests at 15 tables. It replaces v3, which she approved on 21 Sep.`,
        strong: ["Seating plan v4", on],
        file: "w-seat-4",
        passage: 1,
        marks: ["118 guests at 15 tables"],
        context: ["Thursday 24 September"],
      };
    },
  },
  {
    id: "seating",
    when: [
      ["seating", "tables", "guests", "headcount", "count"],
      ["latest", "final", "many", "how", "plan", "current", "newest", "numbers"],
    ],
    sentence:
      "Seating plan v4: 118 guests at 15 tables. It's waiting for Mara's approval; she approved v3 on 21 Sep.",
    strong: ["Seating plan v4", "118 guests at 15 tables"],
    file: "w-seat-4",
    passage: 1,
    marks: ["118 guests at 15 tables"],
    context: ["Thursday 24 September"],
    live: (s) => {
      const on = doneDay(s, "mf-21");
      return on ? { sentence: `Seating plan v4: 118 guests at 15 tables. Mara approved it on ${on}.` } : undefined;
    },
  },
  {
    id: "marquee-price",
    when: [
      ["marquee", "lawlor"],
      ["much", "cost", "price", "quote", "total", "now", "eur", "euro", "deposit"],
    ],
    sentence:
      "€3,850, down from €4,200. A 30% deposit holds the date until 30 Sep, and Mara hasn't approved the quote yet.",
    strong: ["€3,850", "until 30 Sep"],
    file: "w-marquee-3",
    passage: 2,
    also: 5,
    marks: ["€3,850", "until 30 Sep"],
    context: ["€4,200", "18 Sep"],
  },
  {
    id: "florist-deposit",
    when: [
      ["florist", "fern", "furrow", "flowers"],
      ["deposit", "paid", "pay", "owe", "money", "much", "cost", "price", "landed"],
    ],
    sentence: (s) =>
      statusOf(s, "mf-33") === "done"
        ? "A €300 deposit holds the date. The Orchard paid it on 18 Sep and Fern and Furrow have confirmed it."
        : "A €300 deposit holds the date. The Orchard paid it on 18 Sep; Fern and Furrow haven't confirmed it landed, so Aoife is chasing them by Mon 28 Sep.",
    strong: ["€300", "paid it on 18 Sep"],
    file: "w-florist",
    passage: 4,
    marks: ["€300 deposit"],
  },
  {
    id: "prosecco",
    when: [["prosecco", "fizz", "bubbly", "sparkling"]],
    sentence:
      "10 cases and a magnum from Kinsale Wine Co, €1,180. Mara approved it on 25 Sep; Dev orders by Tue 29 Sep.",
    strong: ["10 cases and a magnum", "€1,180", "Tue 29 Sep"],
    file: "w-prosecco",
    passage: 1,
    also: 2,
    marks: ["10 cases", "€1,180", "Tuesday 29 September"],
  },
  {
    id: "coach",
    when: [
      ["bus", "coach", "coaches", "shuttle"],
      ["leave", "leaves", "time", "when", "depart", "go", "pick"],
    ],
    sentence:
      "13:00 from Kinsale town pier on Saturday 3 October. Home runs leave the gate at 00:45 and 01:15.",
    strong: ["13:00"],
    file: "w-coach",
    passage: 2,
    marks: ["leave Kinsale town pier at 13:00"],
  },
  {
    id: "harvest-seats",
    when: [
      ["seats", "tickets", "ticket"],
      ["harvest", "supper", "many", "much", "price", "when", "sale"],
    ],
    sentence: "Forty seats at €65 each, on sale Monday 28 September at 10:00.",
    strong: ["Forty seats at €65", "Monday 28 September"],
    file: "h-tickets",
    passage: 0,
    marks: ["Forty seats at €65", "Monday 28 September at 10:00"],
  },
  {
    id: "tonic",
    when: [["tonic", "olives"]],
    sentence:
      "6 cases of tonic and 2 tubs of the good olives, still not ordered. Dev's task was due Wed 23 Sep; the bar needs them by Wed 30 Sep.",
    strong: ["6 cases", "still not ordered"],
    file: "w-bar",
    passage: 1,
    also: 4,
    marks: ["6 cases of Mediterranean tonic", "Wednesday 30 September"],
    context: ["the good olives"],
  },
  {
    id: "winter-launch",
    when: [
      ["launch", "winter", "season"],
      ["when", "date", "day", "live", "start", "go"],
    ],
    sentence: "Monday 12 October. The brochure goes to print on 2 Oct.",
    strong: ["Monday 12 October"],
    file: "l-plan",
    passage: 0,
    marks: ["Monday 12 October"],
  },
  {
    id: "heating",
    when: [
      ["heating", "heat", "underfloor"],
      ["much", "cost", "price", "quote", "total"],
    ],
    sentence:
      "€18,400 for underfloor heating in the long barn. It's waiting for your sign-off, due Tue 29 Sep.",
    strong: ["€18,400", "Tue 29 Sep"],
    file: "r-heating",
    passage: 1,
    marks: ["€18,400"],
  },
  {
    id: "balance",
    when: [
      ["balance", "deposit", "owe", "owed", "due"],
      ["mara", "finn", "wedding", "balance", "venue"],
    ],
    sentence: "€7,480 is due by 30 Sep. The €2,500 deposit landed on 9 July.",
    strong: ["€7,480", "30 Sep"],
    file: "w-deposit",
    passage: 2,
    marks: ["€7,480", "30 September"],
  },
  {
    id: "music",
    when: [
      ["music", "band", "lindens", "finish", "curfew"],
      ["off", "time", "when", "finish", "stop", "until"],
    ],
    sentence:
      "Music off at 00:30 under the venue licence. The bar closes at 00:15.",
    strong: ["00:30"],
    file: "w-contract",
    passage: 2,
    marks: ["Music off at 00:30"],
    context: ["00:15"],
  },
];

export const sentenceOf = (a: Answer, s: DemoState) =>
  typeof a.sentence === "function" ? a.sentence(s) : a.sentence;

/** The answer as the live store has it now: its sentence resolved, and any `live` change applied. */
export function liveAnswer(a: Answer, s: DemoState): Answer & { sentence: string } {
  const now = { ...a, ...(a.live?.(s) ?? {}) };
  return { ...now, sentence: sentenceOf(now, s) };
}

/** Questions with two good readings. We never guess: we show both. */
export type Ambiguity = {
  id: string;
  when: string[][];
  prompt: string;
  options: {
    label: string;
    project: ProjectId;
    sentence: string;
    strong: string[];
    file: string;
    passage: number;
    marks: string[];
  }[];
};

export const AMBIGUITIES: Ambiguity[] = [
  {
    id: "tasting",
    when: [["tasting", "tastings"]],
    prompt: "Two tastings match. Which one did you mean?",
    options: [
      {
        label: "Mara & Finn's menu tasting",
        project: "mara-finn",
        sentence: "Today, Friday 25 September at 16:00, in the Orchard kitchen.",
        strong: ["Friday 25 September at 16:00"],
        file: "w-tasting",
        passage: 1,
        marks: ["Friday 25 September at 16:00"],
      },
      {
        label: "The Harvest supper wine tasting",
        project: "harvest",
        sentence: "Tuesday 6 October at 15:00, with Kinsale Wine Co.",
        strong: ["Tuesday 6 October at 15:00"],
        file: "h-menu",
        passage: 2,
        marks: ["Tuesday 6 October at 15:00"],
      },
    ],
  },
];

/** Locked questions: the answer probably lives in a file you can't open. */
export const LOCKED_HINTS: {
  when: string[][];
  file: string;
  sentence: string;
}[] = [
  {
    when: [["insurance", "insured", "liability", "cover"]],
    file: "w-insurance",
    sentence:
      "The answer is most likely in Lawlor Hire's public liability certificate, which you can't open yet.",
  },
];

/** Did-you-mean pairs for words that are not in any file. */
export const NEAR: Record<string, string> = {
  cake: "w-menu",
  cakes: "w-menu",
  bread: "h-menu",
  flowers: "w-florist",
  dj: "w-playlist",
  logo: "l-brochure-2",
  photos: "l-reference",
};

export const SUGGESTIONS = [
  { id: "due", label: "Needed this week", token: "is:this-week" },
  { id: "notask", label: "Missing a task", token: "is:no-task" },
  { id: "images", label: "Images", token: "type:image" },
] as const;

/** Home leads with this one, already answered, so the idea lands before you type. */
export const FEATURED = "which seating plan did Mara approve?";

export const TRY = [
  "how much is the marquee now?",
  "when does the coach leave?",
  "has the florist deposit landed?",
];

/* ── Live ───────────────────────────────────────────────────────────
 * The files' facts as the live store has them now. A task renamed on the
 * board renames the file's task link; an approval task finished elsewhere
 * (Mara approves the seating plan on Tasks) shows the file as approved, on
 * the day it was done, so Files never contradicts Tasks or Projects.
 */

/** Approval asks recorded in the store today: `${fileId}:approve` keys, read from task events. */
export function approvalAsks(files: FileItem[], s: DemoState): Set<string> {
  const out = new Set<string>();
  for (const file of files) {
    if (!file.taskId || file.state !== "awaiting" || !file.waitingOn) continue;
    const who = PEOPLE.find((p) => p.id === file.waitingOn)?.first ?? "";
    const asked = s.history.some(
      (e) =>
        e.taskId === file.taskId &&
        e.on === TODAY &&
        ((e.kind === "nudged" && e.note?.includes(file.name)) || (e.kind === "note" && e.note === askNote(who, file))),
    );
    if (asked) out.add(`${file.id}:approve`);
  }
  return out;
}

/** The words an approval ask leaves in the task's history. */
export function askNote(who: string, file: FileItem): string {
  return `Asked ${who} to approve ${file.name}.`;
}

export function liveFiles(files: FileItem[], s: DemoState): FileItem[] {
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  return files.map((file) => {
    if (!file.taskId) return file;
    const task = byId.get(file.taskId);
    if (!task) return file.task ? { ...file, task: undefined } : file;
    let out = task.title === file.task ? file : { ...file, task: task.title };
    // The approval task is done: the version waiting on that person is approved.
    if (out.state === "awaiting" && out.waitingOn && task.status === "done" && /^approve\b/i.test(task.title)) {
      out = {
        ...out,
        state: "approved",
        approvedBy: out.waitingOn,
        approvedOn: fmtDate(task.doneOn ?? TODAY),
        waitingOn: undefined,
      };
    }
    return out;
  });
}
