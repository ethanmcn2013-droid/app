/**
 * Sample data for the Inspector concept. Invented, front-end only.
 * Four projects, about thirty files, versions with real content so the
 * previewer can render and diff them.
 */

export type Kind = "doc" | "image" | "sheet" | "link" | "design" | "slides" | "other";
export type Source = "upload" | "drive" | "link" | "email";
export type PersonId = "you" | "orla" | "dev" | "niamh" | "mara" | "finn" | "tom";
export type ProjectId = "orchard" | "wedding" | "kiln" | "harbour";
export type TaskId =
  | "runsheet"
  | "seating"
  | "marquee"
  | "sign"
  | "deposit"
  | "florist"
  | "band"
  | "bar"
  | "suppliers"
  | "openday"
  | "kilnlogo"
  | "palette"
  | "kilndeck"
  | "menu"
  | "poster"
  | "shopfront"
  | "counter";

export type Person = { id: PersonId; name: string; short: string; initials: string; tone: string; client?: boolean };
export type Project = { id: ProjectId; name: string; short: string; tone: string; initial: string };
export type TaskStatus = "To do" | "In progress" | "Waiting" | "In review" | "Done";
export type Task = { id: TaskId; title: string; project: ProjectId; status: TaskStatus; due: string; owner: PersonId };

export const PEOPLE: Record<PersonId, Person> = {
  you: { id: "you", name: "Dara O'Neill", short: "You", initials: "DO", tone: "var(--v3-project-1)" },
  orla: { id: "orla", name: "Orla Byrne", short: "Orla", initials: "OB", tone: "var(--v3-project-3)" },
  dev: { id: "dev", name: "Dev Mehta", short: "Dev", initials: "DM", tone: "var(--v3-project-2)" },
  niamh: { id: "niamh", name: "Niamh Kelly", short: "Niamh", initials: "NK", tone: "var(--v3-project-6)" },
  mara: { id: "mara", name: "Mara Quinn", short: "Mara", initials: "MQ", tone: "var(--v3-project-8)", client: true },
  finn: { id: "finn", name: "Finn Doyle", short: "Finn", initials: "FD", tone: "var(--v3-project-5)", client: true },
  tom: { id: "tom", name: "Tom at Hireco", short: "Tom", initials: "TH", tone: "var(--v3-project-4)" },
};

export const PROJECTS: Record<ProjectId, Project> = {
  orchard: { id: "orchard", name: "The Orchard, events", short: "The Orchard", tone: "var(--v3-project-4)", initial: "O" },
  wedding: { id: "wedding", name: "Mara & Finn wedding", short: "Mara & Finn", tone: "var(--v3-project-8)", initial: "M" },
  kiln: { id: "kiln", name: "Kiln & Co rebrand", short: "Kiln & Co", tone: "var(--v3-project-5)", initial: "K" },
  harbour: { id: "harbour", name: "Harbour Bakery launch", short: "Harbour Bakery", tone: "var(--v3-project-2)", initial: "H" },
};

export const PROJECT_ORDER: ProjectId[] = ["orchard", "wedding", "kiln", "harbour"];

export const TASKS: Record<TaskId, Task> = {
  runsheet: { id: "runsheet", title: "Build the Saturday run-sheet", project: "wedding", status: "In progress", due: "Thu 15 Oct", owner: "orla" },
  seating: { id: "seating", title: "Approve the final seating plan", project: "wedding", status: "Waiting", due: "Fri 9 Oct", owner: "mara" },
  marquee: { id: "marquee", title: "Confirm marquee sides with Hireco", project: "wedding", status: "In review", due: "Tue 6 Oct", owner: "dev" },
  sign: { id: "sign", title: "Reprint the faded welcome sign", project: "wedding", status: "To do", due: "Mon 12 Oct", owner: "niamh" },
  deposit: { id: "deposit", title: "Deposit invoice settled, Mara & Finn", project: "wedding", status: "Done", due: "Sat 12 Sep", owner: "you" },
  florist: { id: "florist", title: "Choose the florist for the barn", project: "wedding", status: "In progress", due: "Wed 30 Sep", owner: "niamh" },
  band: { id: "band", title: "Book the ceilidh band", project: "wedding", status: "To do", due: "Fri 2 Oct", owner: "dev" },
  bar: { id: "bar", title: "Order tonic and the good olives", project: "orchard", status: "To do", due: "Mon 5 Oct", owner: "dev" },
  suppliers: { id: "suppliers", title: "Sign off the recommended suppliers list", project: "orchard", status: "In review", due: "Tue 29 Sep", owner: "orla" },
  openday: { id: "openday", title: "Plan the October open day", project: "orchard", status: "In progress", due: "Sun 25 Oct", owner: "niamh" },
  kilnlogo: { id: "kilnlogo", title: "Present logo round two", project: "kiln", status: "In review", due: "Thu 1 Oct", owner: "dev" },
  palette: { id: "palette", title: "Lock the glaze palette", project: "kiln", status: "In progress", due: "Fri 2 Oct", owner: "niamh" },
  kilndeck: { id: "kilndeck", title: "Pitch deck for the stockists", project: "kiln", status: "To do", due: "Fri 16 Oct", owner: "you" },
  menu: { id: "menu", title: "Print the launch menu", project: "harbour", status: "In progress", due: "Wed 7 Oct", owner: "orla" },
  poster: { id: "poster", title: "Design the launch poster", project: "harbour", status: "To do", due: "Fri 9 Oct", owner: "niamh" },
  shopfront: { id: "shopfront", title: "Photograph the shopfront", project: "harbour", status: "Done", due: "Mon 21 Sep", owner: "dev" },
  counter: { id: "counter", title: "Sign off the counter layout", project: "harbour", status: "Waiting", due: "Thu 8 Oct", owner: "you" },
};

/* ── File bodies: what the previewer renders ─────────────────────────── */

export type RunRow = { id: string; time: string; title: string; where: string };
export type QuoteLine = { id: string; item: string; detail: string; amount: number };
export type MenuItem = { id: string; name: string; note: string; price: string };
export type LetterBlock = { h?: string; p?: string; list?: string[] };
export type Scene = "terrace" | "snowbarn" | "studio" | "shopfront" | "sourdough" | "oldsign";

export type Body =
  | { t: "runsheet"; rows: RunRow[] }
  | { t: "quote"; ref: string; lines: QuoteLine[] }
  | { t: "invoice" }
  | { t: "letter"; kicker: string; heading: string; blocks: LetterBlock[] }
  | { t: "menu"; items: MenuItem[] }
  | { t: "grid"; title: string; cols: string[]; rows: string[][]; align?: ("l" | "r")[] }
  | { t: "seating"; tables: { name: string; seats: string[] }[] }
  | { t: "photo"; scene: Scene; caption: string; w: number; h: number }
  | { t: "sign"; look: "first" | "reprint" }
  | { t: "swatches" }
  | { t: "link"; site: string; domain: string; title: string; desc: string; favicon: string; tint: string; path: string }
  | { t: "logo"; round: 1 | 2 }
  | { t: "slide" }
  | { t: "mood" }
  | { t: "none"; ext: string; what: string };

export type Version = { n: number; by: PersonId; ago: string; note?: string; body: Body };

export type FileItem = {
  id: string;
  name: string;
  ext: string;
  kind: Kind;
  project: ProjectId;
  tasks: TaskId[];
  owner: PersonId;
  size: string;
  pages?: string;
  source: Source;
  sharedWith: PersonId[];
  linkAccess: "view" | "comment" | "off";
  starred?: boolean;
  /** Minutes since the latest change; drives Recent grouping. */
  minutesAgo: number;
  versions: Version[];
  unfiled?: { from: string; suggest: TaskId; reason: string };
  locked?: PersonId;
  uploading?: boolean;
};

const RUN_V1: RunRow[] = [
  { id: "gate", time: "13:30", title: "Guests arrive at the orchard gate", where: "Gate lawn" },
  { id: "ceremony", time: "14:00", title: "Ceremony under the old apple tree", where: "Orchard" },
  { id: "drinks", time: "15:00", title: "Drinks on the terrace", where: "Terrace" },
  { id: "dinner", time: "17:00", title: "Dinner in the barn", where: "Barn" },
  { id: "speeches", time: "19:30", title: "Speeches, then cake", where: "Barn" },
  { id: "dance", time: "21:00", title: "First dance, band starts", where: "Barn" },
  { id: "orders", time: "23:30", title: "Last orders at the bar", where: "Barn bar" },
  { id: "carriages", time: "00:30", title: "Carriages from the gate", where: "Gate lawn" },
];

const RUN_V2: RunRow[] = [
  RUN_V1[0],
  RUN_V1[1],
  { id: "drinks", time: "15:30", title: "Drinks on the terrace", where: "Terrace" },
  { id: "photos", time: "16:15", title: "Family photos in the walled garden", where: "Walled garden" },
  RUN_V1[3],
  RUN_V1[4],
  RUN_V1[5],
  RUN_V1[6],
  RUN_V1[7],
];

const RUN_V3: RunRow[] = [
  RUN_V2[0],
  RUN_V2[1],
  RUN_V2[2],
  RUN_V2[3],
  { id: "dinner", time: "17:30", title: "Dinner in the barn", where: "Barn" },
  { id: "speeches", time: "19:45", title: "Speeches, then cake", where: "Barn" },
  { id: "dance", time: "21:00", title: "First dance with The Hollow Pines", where: "Barn" },
  RUN_V2[7],
  RUN_V2[8],
];

const QUOTE_V1: QuoteLine[] = [
  { id: "tent", item: "Clipper marquee, 12 × 24 m", detail: "Frame, roof and gable ends", amount: 2600 },
  { id: "walls", item: "Side walls, clear PVC", detail: "Full height, all four sides", amount: 650 },
  { id: "floor", item: "Coconut matting", detail: "Whole floor, 288 m²", amount: 480 },
  { id: "lights", item: "Festoon lighting", detail: "6 runs, warm white", amount: 310 },
  { id: "crew", item: "Delivery, build and strike", detail: "Crew of four, Fri and Sun", amount: 160 },
];

const QUOTE_V2: QuoteLine[] = [
  QUOTE_V1[0],
  { id: "walls", item: "Side walls, half height", detail: "Clear upper panels, open to the orchard", amount: 450 },
  { id: "floor", item: "Coconut matting", detail: "Dance floor and walkways, 190 m²", amount: 330 },
  QUOTE_V1[3],
  QUOTE_V1[4],
];

const SEAT_V1 = [
  { name: "Table 1", seats: ["Mara", "Finn", "Nuala Quinn", "Declan Quinn", "Rose Doyle", "Peter Doyle"] },
  { name: "Table 2", seats: ["Aoife", "Sam", "Leo", "Grace", "Tadhg", "Maeve"] },
  { name: "Table 3", seats: ["Aunt Bríd", "Uncle Joe", "Ciara", "Owen", "Hannah", "Rory"] },
  { name: "Table 4", seats: ["Priya", "Tom", "Isla", "Cormac", "Julia", "Ben"] },
  { name: "Table 5", seats: ["Eimear", "Fionn", "Lucy", "Pádraig", "Sorcha", "Dan"] },
  { name: "Table 6", seats: ["Kate", "Noel", "Sinéad", "Harry", "Clodagh", "Luke"] },
];
const SEAT_V2 = [
  SEAT_V1[0],
  { name: "Table 2", seats: ["Aoife", "Leo", "Sam", "Grace", "Aunt Bríd", "Maeve"] },
  { name: "Table 3", seats: ["Tadhg", "Uncle Joe", "Ciara", "Owen", "Hannah", "Rory"] },
  SEAT_V1[3],
  SEAT_V1[4],
  { name: "Table 6", seats: ["Kate", "Noel", "Sinéad", "Harry", "Clodagh", "Luke + 1"] },
];

const MENU_V1: MenuItem[] = [
  { id: "sour", name: "Harbour sourdough", note: "48-hour ferment, sea salt butter", price: "5.50" },
  { id: "croissant", name: "Butter croissant", note: "Laminated in-house, every morning", price: "3.20" },
  { id: "rye", name: "Dark rye and treacle", note: "Dense, a little sweet, keeps for days", price: "6.00" },
  { id: "tart", name: "Plum and almond tart", note: "While the plums last", price: "4.80" },
  { id: "coffee", name: "Filter coffee", note: "Roasted up the road by Tidewater", price: "3.00" },
];
const MENU_V2: MenuItem[] = [
  { id: "sour", name: "Harbour sourdough", note: "48-hour ferment, sea salt butter", price: "6.00" },
  MENU_V1[1],
  { id: "bun", name: "Cardamom bun", note: "Knotted, sticky, gone by eleven", price: "3.60" },
  MENU_V1[2],
  MENU_V1[3],
  MENU_V1[4],
];

const letter = (kicker: string, heading: string, blocks: LetterBlock[]): Body => ({ t: "letter", kicker, heading, blocks });

export const FILES: FileItem[] = [
  /* ── Mara & Finn wedding ── */
  {
    id: "runsheet",
    name: "Run-sheet, Saturday 17 Oct.pdf",
    ext: "pdf",
    kind: "doc",
    project: "wedding",
    tasks: ["runsheet", "marquee"],
    owner: "orla",
    size: "402 KB",
    pages: "2 pages",
    source: "upload",
    sharedWith: ["orla", "dev", "niamh", "mara", "finn"],
    linkAccess: "view",
    starred: true,
    minutesAgo: 120,
    versions: [
      { n: 1, by: "orla", ago: "6 days ago", note: "First draft from the planning call", body: { t: "runsheet", rows: RUN_V1 } },
      { n: 2, by: "dev", ago: "3 days ago", note: "Drinks moved 15:00 to 15:30, family photos added", body: { t: "runsheet", rows: RUN_V2 } },
      { n: 3, by: "orla", ago: "2h ago", note: "Dinner moved 17:00 to 17:30, band named", body: { t: "runsheet", rows: RUN_V3 } },
    ],
  },
  {
    id: "quote",
    name: "Marquee quote, Hireco.pdf",
    ext: "pdf",
    kind: "doc",
    project: "wedding",
    tasks: ["marquee"],
    owner: "dev",
    size: "184 KB",
    pages: "1 page",
    source: "upload",
    sharedWith: ["dev", "orla", "tom"],
    linkAccess: "off",
    minutesAgo: 60 * 26,
    versions: [
      { n: 1, by: "tom", ago: "9 days ago", note: "First quote, EUR 4,200", body: { t: "quote", ref: "HC-2291", lines: QUOTE_V1 } },
      { n: 2, by: "tom", ago: "Yesterday", note: "Half-height walls, less matting: EUR 350 less", body: { t: "quote", ref: "HC-2291-B", lines: QUOTE_V2 } },
    ],
  },
  {
    id: "seating",
    name: "Seating plan, final",
    ext: "gsheet",
    kind: "sheet",
    project: "wedding",
    tasks: ["seating"],
    owner: "mara",
    size: "Google Sheet",
    source: "drive",
    sharedWith: ["mara", "finn", "orla", "you"],
    linkAccess: "comment",
    starred: true,
    minutesAgo: 45,
    versions: [
      { n: 1, by: "orla", ago: "4 days ago", note: "Orla's first pass from the RSVP list", body: { t: "seating", tables: SEAT_V1 } },
      { n: 2, by: "mara", ago: "45 min ago", note: "Mara moved Aunt Bríd to table 2 and added a plus one", body: { t: "seating", tables: SEAT_V2 } },
    ],
  },
  {
    id: "sign",
    name: "Welcome sign artwork.png",
    ext: "png",
    kind: "image",
    project: "wedding",
    tasks: ["sign"],
    owner: "niamh",
    size: "1.1 MB",
    source: "upload",
    sharedWith: ["niamh", "mara", "finn"],
    linkAccess: "view",
    minutesAgo: 60 * 5,
    versions: [
      { n: 1, by: "niamh", ago: "Last month", note: "The original, printed in June", body: { t: "sign", look: "first" } },
      { n: 2, by: "niamh", ago: "5h ago", note: "Reprint: deeper green, gold arch, bigger names", body: { t: "sign", look: "reprint" } },
    ],
  },
  {
    id: "deposit",
    name: "Deposit invoice, Mara & Finn.pdf",
    ext: "pdf",
    kind: "doc",
    project: "wedding",
    tasks: ["deposit"],
    owner: "you",
    size: "94 KB",
    pages: "1 page",
    source: "upload",
    sharedWith: ["mara", "finn"],
    linkAccess: "off",
    minutesAgo: 60 * 24 * 13,
    versions: [{ n: 1, by: "you", ago: "12 Sep", body: { t: "invoice" } }],
  },
  {
    id: "florist-link",
    name: "Wildflower & Co, portfolio",
    ext: "link",
    kind: "link",
    project: "wedding",
    tasks: ["florist"],
    owner: "niamh",
    size: "Link",
    source: "link",
    sharedWith: ["niamh", "mara"],
    linkAccess: "view",
    minutesAgo: 60 * 30,
    versions: [
      {
        n: 1,
        by: "niamh",
        ago: "Yesterday",
        body: {
          t: "link",
          site: "Wildflower & Co",
          domain: "wildflowerandco.ie",
          path: "/weddings/autumn",
          title: "Autumn weddings, Wildflower & Co",
          desc: "Loose, seasonal arrangements grown in Wicklow. Barn installs, hanging meadows and table runners from September to November.",
          favicon: "W",
          tint: "linear-gradient(135deg, #c96f4a 0%, #e8b77d 45%, #7b8a55 100%)",
        },
      },
    ],
  },
  {
    id: "tasting",
    name: "Menu tasting notes.docx",
    ext: "docx",
    kind: "doc",
    project: "wedding",
    tasks: ["runsheet"],
    owner: "niamh",
    size: "38 KB",
    pages: "1 page",
    source: "upload",
    sharedWith: ["niamh", "orla"],
    linkAccess: "off",
    minutesAgo: 60 * 50,
    versions: [
      {
        n: 1,
        by: "niamh",
        ago: "2 days ago",
        body: letter("Tasting, Thursday 24 Sep", "Menu tasting notes", [
          { p: "Mara and Finn tasted with chef Aidan in the barn kitchen. Both mothers came. The room was cold; we will need the heaters on for the day." },
          { h: "Keep" },
          { list: ["Beetroot, whipped goat's cheese, hazelnut", "Slow-cooked lamb shoulder, salsa verde", "Apple and blackberry crumble tart from our own trees"] },
          { h: "Change" },
          { list: ["Swap the hake for stone bass: Finn found it dry", "Smaller bread course, it filled everyone up", "Vegan main needs more heft: try the roast squash and farro"] },
          { h: "Numbers" },
          { p: "112 adults, 9 children, 6 vegetarian, 3 vegan, 2 coeliac. Final numbers due to the kitchen by Friday 9 October." },
        ]),
      },
    ],
  },
  {
    id: "guestlist",
    name: "Guest list, Mara's side",
    ext: "gsheet",
    kind: "sheet",
    project: "wedding",
    tasks: ["seating"],
    owner: "mara",
    size: "Google Sheet",
    source: "drive",
    sharedWith: ["mara"],
    linkAccess: "off",
    locked: "mara",
    minutesAgo: 60 * 72,
    versions: [{ n: 1, by: "mara", ago: "3 days ago", body: { t: "grid", title: "Guest list", cols: [], rows: [] } }],
  },

  /* ── The Orchard, events ── */
  {
    id: "terrace",
    name: "Terrace at golden hour.jpg",
    ext: "jpg",
    kind: "image",
    project: "orchard",
    tasks: ["openday", "suppliers"],
    owner: "orla",
    size: "2.3 MB",
    source: "upload",
    sharedWith: ["orla", "niamh", "dev"],
    linkAccess: "view",
    starred: true,
    minutesAgo: 60 * 3,
    versions: [
      {
        n: 1,
        by: "orla",
        ago: "3h ago",
        body: { t: "photo", scene: "terrace", caption: "The terrace at 19:40, facing west over the orchard. For the open day flyer.", w: 3, h: 2 },
      },
    ],
  },
  {
    id: "bar",
    name: "Bar order, October",
    ext: "gsheet",
    kind: "sheet",
    project: "orchard",
    tasks: ["bar"],
    owner: "dev",
    size: "Google Sheet",
    source: "drive",
    sharedWith: ["dev", "orla"],
    linkAccess: "off",
    minutesAgo: 60 * 8,
    versions: [
      {
        n: 1,
        by: "dev",
        ago: "Last week",
        body: {
          t: "grid",
          title: "Bar order, October",
          cols: ["Item", "Supplier", "Qty", "Unit", "Cost"],
          align: ["l", "l", "r", "l", "r"],
          rows: [
            ["Light tonic", "Fever-Tree", "18", "case", "€324"],
            ["Castelvetrano olives", "Sheridans", "6", "tub 1kg", "€138"],
            ["Orchard cider", "Longueville", "40", "case", "€1,120"],
            ["House red", "Le Caveau", "24", "case", "€1,584"],
            ["Sparkling water", "Tipperary", "20", "case", "€190"],
            ["Limes", "Market", "6", "box", "€72"],
          ],
        },
      },
      {
        n: 2,
        by: "dev",
        ago: "8h ago",
        note: "Tonic up to 24 cases for the two October weddings",
        body: {
          t: "grid",
          title: "Bar order, October",
          cols: ["Item", "Supplier", "Qty", "Unit", "Cost"],
          align: ["l", "l", "r", "l", "r"],
          rows: [
            ["Light tonic", "Fever-Tree", "24", "case", "€432"],
            ["Castelvetrano olives", "Sheridans", "8", "tub 1kg", "€184"],
            ["Orchard cider", "Longueville", "40", "case", "€1,120"],
            ["House red", "Le Caveau", "24", "case", "€1,584"],
            ["Sparkling water", "Tipperary", "20", "case", "€190"],
            ["Limes", "Market", "6", "box", "€72"],
            ["Crisps, sea salt", "Keogh's", "10", "box", "€95"],
          ],
        },
      },
    ],
  },
  {
    id: "suppliers",
    name: "Recommended suppliers",
    ext: "link",
    kind: "link",
    project: "orchard",
    tasks: ["suppliers"],
    owner: "orla",
    size: "Link",
    source: "link",
    sharedWith: ["orla", "dev", "niamh"],
    linkAccess: "view",
    minutesAgo: 60 * 28,
    versions: [
      {
        n: 1,
        by: "orla",
        ago: "Yesterday",
        body: {
          t: "link",
          site: "The Orchard",
          domain: "theorchard.ie",
          path: "/weddings/suppliers",
          title: "Recommended suppliers, The Orchard",
          desc: "Florists, bands, photographers and caterers who know the barn, the power points and where the vans can park.",
          favicon: "O",
          tint: "linear-gradient(135deg, #2f5d3a 0%, #6f9a57 50%, #e3c16f 100%)",
        },
      },
    ],
  },
  {
    id: "hireterms",
    name: "Venue hire terms 2027.pdf",
    ext: "pdf",
    kind: "doc",
    project: "orchard",
    tasks: ["suppliers"],
    owner: "you",
    size: "212 KB",
    pages: "4 pages",
    source: "upload",
    sharedWith: ["orla", "dev", "niamh"],
    linkAccess: "view",
    minutesAgo: 60 * 24 * 6,
    versions: [
      {
        n: 1,
        by: "you",
        ago: "6 days ago",
        body: letter("The Orchard, Kilmacanogue", "Venue hire terms, 2027 season", [
          { h: "1. Booking and deposit" },
          { p: "A booking is held when we receive the signed form and a deposit of 30% of the venue fee. The balance is due eight weeks before the day." },
          { h: "2. Access" },
          { p: "Suppliers may arrive from 09:00 on the day. The barn is yours until 01:00, with music off at 00:30 out of respect for our neighbours." },
          { h: "3. Numbers" },
          { p: "Final numbers are due fourteen days before the day. We can add guests up to seven days before, subject to the kitchen." },
          { h: "4. Cancellation" },
          { list: ["More than 12 months: deposit refunded less €500", "6 to 12 months: deposit kept", "Under 6 months: 50% of the venue fee"] },
        ]),
      },
    ],
  },
  {
    id: "snowbarn",
    name: "Barn in the snow.jpg",
    ext: "jpg",
    kind: "image",
    project: "orchard",
    tasks: ["openday"],
    owner: "niamh",
    size: "3.4 MB",
    source: "upload",
    sharedWith: ["niamh", "orla"],
    linkAccess: "view",
    minutesAgo: 60 * 24 * 9,
    versions: [
      { n: 1, by: "niamh", ago: "9 days ago", body: { t: "photo", scene: "snowbarn", caption: "Last January, the morning after the big snow. Winter weddings page.", w: 3, h: 2 } },
    ],
  },
  {
    id: "poster-openday",
    name: "Open day timetable.pdf",
    ext: "pdf",
    kind: "doc",
    project: "orchard",
    tasks: ["openday"],
    owner: "niamh",
    size: "76 KB",
    pages: "1 page",
    source: "upload",
    sharedWith: ["niamh", "orla", "dev"],
    linkAccess: "view",
    minutesAgo: 60 * 24 * 2 + 30,
    versions: [
      {
        n: 1,
        by: "niamh",
        ago: "2 days ago",
        body: letter("Sunday 25 October, 11:00 to 16:00", "Open day at The Orchard", [
          { p: "Couples booking for 2027 walk the grounds with our team, meet our suppliers and taste the menu." },
          { list: ["11:00 Doors open, coffee in the barn", "12:00 Guided walk: orchard, terrace, walled garden", "13:00 Tasting with chef Aidan", "14:30 Meet the florist and the band", "15:30 Q&A with couples married here this year"] },
          { p: "Parking in the lower field. Dogs welcome on leads." },
        ]),
      },
    ],
  },

  /* ── Kiln & Co rebrand ── */
  {
    id: "logo",
    name: "Kiln logo, round two",
    ext: "fig",
    kind: "design",
    project: "kiln",
    tasks: ["kilnlogo"],
    owner: "dev",
    size: "Figma file",
    source: "link",
    sharedWith: ["dev", "niamh", "you"],
    linkAccess: "comment",
    starred: true,
    minutesAgo: 60 * 4,
    versions: [
      { n: 1, by: "dev", ago: "Last week", note: "Round one: three directions", body: { t: "logo", round: 1 } },
      { n: 2, by: "dev", ago: "4h ago", note: "Round two: the arch, refined, with a heavier ampersand", body: { t: "logo", round: 2 } },
    ],
  },
  {
    id: "palette",
    name: "Glaze palette.png",
    ext: "png",
    kind: "image",
    project: "kiln",
    tasks: ["palette"],
    owner: "niamh",
    size: "640 KB",
    source: "upload",
    sharedWith: ["niamh", "dev"],
    linkAccess: "off",
    minutesAgo: 60 * 24 + 90,
    versions: [{ n: 1, by: "niamh", ago: "Yesterday", body: { t: "swatches" } }],
  },
  {
    id: "studio",
    name: "Kiln studio, wide.jpg",
    ext: "jpg",
    kind: "image",
    project: "kiln",
    tasks: ["kilndeck"],
    owner: "dev",
    size: "4.1 MB",
    source: "upload",
    sharedWith: ["dev", "niamh"],
    linkAccess: "off",
    minutesAgo: 60 * 24 * 4,
    versions: [{ n: 1, by: "dev", ago: "4 days ago", body: { t: "photo", scene: "studio", caption: "The drying shelves before the October firing.", w: 3, h: 2 } }],
  },
  {
    id: "deck",
    name: "Stockist pitch deck.key",
    ext: "key",
    kind: "slides",
    project: "kiln",
    tasks: ["kilndeck"],
    owner: "you",
    size: "18.2 MB",
    pages: "14 slides",
    source: "upload",
    sharedWith: ["dev", "niamh"],
    linkAccess: "off",
    minutesAgo: 60 * 24 * 3,
    versions: [{ n: 1, by: "you", ago: "3 days ago", body: { t: "slide" } }],
  },
  {
    id: "voice",
    name: "Brand voice notes.docx",
    ext: "docx",
    kind: "doc",
    project: "kiln",
    tasks: ["kilnlogo"],
    owner: "niamh",
    size: "29 KB",
    pages: "2 pages",
    source: "upload",
    sharedWith: ["niamh", "dev"],
    linkAccess: "off",
    minutesAgo: 60 * 24 * 8,
    versions: [
      {
        n: 1,
        by: "niamh",
        ago: "8 days ago",
        body: letter("Kiln & Co, rebrand", "How Kiln & Co sounds", [
          { p: "Like the potter talking to you across the wheel: warm, specific, a bit dry. Never precious about the craft." },
          { h: "We say" },
          { list: ["Fired twice, used every day", "Made in Thomastown from Irish clay", "Chips happen. We'll fix it or swap it."] },
          { h: "We never say" },
          { list: ["Artisanal, curated, elevated", "Luxury anything", "Handcrafted with love"] },
        ]),
      },
    ],
  },

  /* ── Harbour Bakery launch ── */
  {
    id: "menu",
    name: "Launch menu.pdf",
    ext: "pdf",
    kind: "doc",
    project: "harbour",
    tasks: ["menu"],
    owner: "orla",
    size: "118 KB",
    pages: "1 page",
    source: "upload",
    sharedWith: ["orla", "you"],
    linkAccess: "view",
    minutesAgo: 60 * 6,
    versions: [
      { n: 1, by: "orla", ago: "3 days ago", note: "First menu for the printer", body: { t: "menu", items: MENU_V1 } },
      { n: 2, by: "orla", ago: "6h ago", note: "Sourdough up to 6.00, cardamom bun added", body: { t: "menu", items: MENU_V2 } },
    ],
  },
  {
    id: "shopfront",
    name: "Shopfront at 7am.jpg",
    ext: "jpg",
    kind: "image",
    project: "harbour",
    tasks: ["shopfront", "poster"],
    owner: "dev",
    size: "2.8 MB",
    source: "upload",
    sharedWith: ["dev", "niamh", "you"],
    linkAccess: "view",
    minutesAgo: 60 * 24 * 4 + 60,
    versions: [{ n: 1, by: "dev", ago: "4 days ago", body: { t: "photo", scene: "shopfront", caption: "First light on the quay. The one for the poster.", w: 3, h: 2 } }],
  },
  {
    id: "counter",
    name: "Counter floor plan.dwg",
    ext: "dwg",
    kind: "other",
    project: "harbour",
    tasks: ["counter"],
    owner: "you",
    size: "5.6 MB",
    source: "upload",
    sharedWith: ["you"],
    linkAccess: "off",
    minutesAgo: 60 * 24 * 5,
    versions: [{ n: 1, by: "you", ago: "5 days ago", body: { t: "none", ext: "dwg", what: "an AutoCAD drawing" } }],
  },
  {
    id: "rota",
    name: "Opening week rota",
    ext: "gsheet",
    kind: "sheet",
    project: "harbour",
    tasks: ["menu"],
    owner: "orla",
    size: "Google Sheet",
    source: "drive",
    sharedWith: ["orla", "you"],
    linkAccess: "off",
    minutesAgo: 60 * 24 * 2,
    versions: [
      {
        n: 1,
        by: "orla",
        ago: "2 days ago",
        body: {
          t: "grid",
          title: "Opening week rota",
          cols: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          rows: [
            ["Ovens, 04:00", "Seán", "Seán", "Ana", "Ana", "Seán", "Seán + Ana"],
            ["Counter, 07:00", "Orla", "Kev", "Kev", "Orla", "Orla", "Kev + Orla"],
            ["Coffee, 07:00", "Kev", "Orla", "Beth", "Beth", "Beth", "Beth"],
            ["Close, 15:00", "Beth", "Beth", "Orla", "Kev", "Kev", "Orla"],
          ],
        },
      },
    ],
  },
  {
    id: "sourdough",
    name: "Sourdough close-up.jpg",
    ext: "jpg",
    kind: "image",
    project: "harbour",
    tasks: ["poster"],
    owner: "you",
    size: "3.9 MB",
    source: "upload",
    sharedWith: ["you"],
    linkAccess: "off",
    uploading: true,
    minutesAgo: 0,
    versions: [{ n: 1, by: "you", ago: "Just now", body: { t: "photo", scene: "sourdough", caption: "The crumb shot for the poster.", w: 3, h: 2 } }],
  },

  /* ── Unfiled: arrived by email ── */
  {
    id: "img4471",
    name: "IMG_4471.heic",
    ext: "heic",
    kind: "image",
    project: "wedding",
    tasks: [],
    owner: "mara",
    size: "2.1 MB",
    source: "email",
    sharedWith: ["mara"],
    linkAccess: "off",
    minutesAgo: 35,
    unfiled: { from: "Mara Quinn, by email", suggest: "sign", reason: "It's a photo of the old sign, and Mara mentioned the faded lettering." },
    versions: [{ n: 1, by: "mara", ago: "35 min ago", body: { t: "photo", scene: "oldsign", caption: "Sent from Mara's phone: the old sign by the gate.", w: 3, h: 4 } }],
  },
  {
    id: "florist-mood",
    name: "Florist mood.pdf",
    ext: "pdf",
    kind: "doc",
    project: "wedding",
    tasks: [],
    owner: "mara",
    size: "1.4 MB",
    pages: "3 pages",
    source: "email",
    sharedWith: ["mara"],
    linkAccess: "off",
    minutesAgo: 90,
    unfiled: { from: "Wildflower & Co, by email", suggest: "florist", reason: "Sent by Wildflower & Co, the florist on that task's shortlist." },
    versions: [
      {
        n: 1,
        by: "mara",
        ago: "90 min ago",
        body: { t: "mood" },
      },
    ],
  },
  {
    id: "numbers",
    name: "Final numbers from Mara.xlsx",
    ext: "xlsx",
    kind: "sheet",
    project: "wedding",
    tasks: [],
    owner: "mara",
    size: "22 KB",
    source: "email",
    sharedWith: ["mara"],
    linkAccess: "off",
    minutesAgo: 60 * 2 + 10,
    unfiled: { from: "Mara Quinn, by email", suggest: "seating", reason: "Guest numbers by table: the seating plan is waiting on these." },
    versions: [
      {
        n: 1,
        by: "mara",
        ago: "2h ago",
        body: {
          t: "grid",
          title: "Final numbers",
          cols: ["Table", "Adults", "Children", "Dietary"],
          align: ["l", "r", "r", "l"],
          rows: [
            ["Table 1", "6", "0", "1 coeliac"],
            ["Table 2", "6", "0", "2 vegetarian"],
            ["Table 3", "5", "1", "—"],
            ["Table 4", "6", "0", "1 vegan"],
            ["Table 5", "5", "2", "2 vegetarian"],
            ["Table 6", "7", "0", "1 vegan, 1 coeliac"],
            ["Total", "112", "9", "13 notes"],
          ],
        },
      },
    ],
  },
  {
    id: "canva",
    name: "Launch poster, Canva",
    ext: "link",
    kind: "link",
    project: "harbour",
    tasks: [],
    owner: "niamh",
    size: "Link",
    source: "email",
    sharedWith: ["niamh"],
    linkAccess: "view",
    minutesAgo: 60 * 20,
    unfiled: { from: "Niamh Kelly, by email", suggest: "poster", reason: "A Canva design titled 'Harbour launch poster'." },
    versions: [
      {
        n: 1,
        by: "niamh",
        ago: "Yesterday",
        body: {
          t: "link",
          site: "Canva",
          domain: "canva.com",
          path: "/design/harbour-launch-poster",
          title: "Harbour launch poster, draft 1",
          desc: "A2 poster for the quay windows. Opening Saturday 10 October, 07:00. Free coffee with the first hundred loaves.",
          favicon: "C",
          tint: "linear-gradient(135deg, #0e4f6b 0%, #2a8fb0 50%, #f2d49b 100%)",
        },
      },
    ],
  },
];

/* ── Collections ─────────────────────────────────────────────────────── */

export type CollectionId =
  | "recent"
  | "starred"
  | "unfiled"
  | `task:${TaskId}`
  | `person:${PersonId}`
  | `type:${"docs" | "images" | "sheets" | "drive" | "links"}`
  | `project:${ProjectId}`;

export const RAIL_TASKS: TaskId[] = ["runsheet", "seating", "marquee", "sign", "florist", "band", "bar", "openday", "kilnlogo", "menu"];
export const RAIL_PEOPLE: PersonId[] = ["orla", "dev", "niamh", "mara"];
export const RAIL_TYPES: { id: "docs" | "images" | "sheets" | "drive" | "links"; label: string }[] = [
  { id: "docs", label: "Documents" },
  { id: "images", label: "Images" },
  { id: "sheets", label: "Sheets" },
  { id: "drive", label: "Drive" },
  { id: "links", label: "Links" },
];

export function inCollection(f: FileItem, c: CollectionId, filedTask: Record<string, TaskId | undefined>): boolean {
  const tasks = filedTask[f.id] ? [...f.tasks, filedTask[f.id] as TaskId] : f.tasks;
  if (c === "recent") return true;
  if (c === "starred") return !!f.starred;
  if (c === "unfiled") return !!f.unfiled;
  if (c.startsWith("task:")) return tasks.includes(c.slice(5) as TaskId);
  if (c.startsWith("person:")) {
    const p = c.slice(7) as PersonId;
    return f.owner === p || f.versions.some((v) => v.by === p);
  }
  if (c.startsWith("project:")) return f.project === c.slice(8);
  switch (c) {
    case "type:docs":
      return f.kind === "doc" || f.kind === "slides";
    case "type:images":
      return f.kind === "image";
    case "type:sheets":
      return f.kind === "sheet";
    case "type:drive":
      return f.source === "drive";
    case "type:links":
      return f.kind === "link" || f.kind === "design";
  }
  return false;
}

export function collectionLabel(c: CollectionId): string {
  if (c === "recent") return "Recent";
  if (c === "starred") return "Starred";
  if (c === "unfiled") return "Unfiled";
  if (c.startsWith("task:")) return TASKS[c.slice(5) as TaskId].title;
  if (c.startsWith("person:")) {
    const p = PEOPLE[c.slice(7) as PersonId];
    return p.client ? `${p.short} (client)` : p.short;
  }
  if (c.startsWith("project:")) return PROJECTS[c.slice(8) as ProjectId].name;
  return RAIL_TYPES.find((t) => `type:${t.id}` === c)?.label ?? "Files";
}

export function agoShort(min: number): string {
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.round(min / 60)}h`;
  const d = Math.round(min / (60 * 24));
  return d === 1 ? "1d" : `${d}d`;
}

export function sourceLabel(f: FileItem): string {
  switch (f.source) {
    case "upload":
      return "Uploaded";
    case "drive":
      return "Google Drive";
    case "link":
      return f.kind === "design" ? "Figma link" : "Link";
    case "email":
      return "Email";
  }
}

/* ── Filter tokens: from:Mara, type:sheet ────────────────────────────── */

export type TypeId = "docs" | "images" | "sheets" | "drive" | "links";
export type Token = { kind: "from"; id: PersonId } | { kind: "type"; id: TypeId };

export const TOKEN_PEOPLE: PersonId[] = ["orla", "dev", "niamh", "mara", "finn", "tom"];
export const TOKEN_TYPES: { id: TypeId; word: string; label: string }[] = [
  { id: "docs", word: "doc", label: "Documents" },
  { id: "images", word: "image", label: "Images" },
  { id: "sheets", word: "sheet", label: "Sheets" },
  { id: "drive", word: "drive", label: "Google Drive" },
  { id: "links", word: "link", label: "Links" },
];

export const tokenKey = (t: Token) => `${t.kind}:${t.id}`;

export function tokenText(t: Token): string {
  return t.kind === "from" ? `from:${PEOPLE[t.id].short}` : `type:${TOKEN_TYPES.find((x) => x.id === t.id)?.word}`;
}

export function tokenLabel(t: Token): string {
  return t.kind === "from" ? `From ${PEOPLE[t.id].short}` : (TOKEN_TYPES.find((x) => x.id === t.id)?.label ?? "");
}

const ALL_TOKENS: Token[] = [
  ...TOKEN_PEOPLE.map((id) => ({ kind: "from" as const, id })),
  ...TOKEN_TYPES.map((t) => ({ kind: "type" as const, id: t.id })),
];

/** Exact match for a typed word such as "from:mara" or "type:sheets". */
export function parseToken(word: string): Token | undefined {
  const w = word.toLowerCase();
  return ALL_TOKENS.find((t) => {
    const text = tokenText(t).toLowerCase();
    return text === w || (t.kind === "type" && `${text}s` === w);
  });
}

/** Suggestions for the word being typed. An empty word gets a short sampler. */
export function suggestTokens(word: string, taken: Token[]): Token[] {
  const w = word.toLowerCase();
  const free = ALL_TOKENS.filter((t) => !taken.some((x) => tokenKey(x) === tokenKey(t)));
  if (!w) return [];
  return free
    .filter((t) => {
      const text = tokenText(t).toLowerCase();
      const value = text.split(":")[1];
      return text.startsWith(w) || (w.length >= 2 && value.startsWith(w));
    })
    .slice(0, 6);
}

export function tokenMatches(f: FileItem, t: Token): boolean {
  if (t.kind === "from") return inCollection(f, `person:${t.id}`, {});
  return inCollection(f, `type:${t.id}`, {});
}

/* ── What changed between versions, for the filmstrip ─────────────────── */

export type Delta = { label: string; lines: number; changed: number[]; grid?: { cols: number } };

function listDelta<T extends { id: string }>(rows: T[], prev: T[] | undefined, same: (a: T, b: T) => boolean): Delta {
  if (!prev) return { label: "First draft", lines: rows.length, changed: [] };
  const byId = new Map(prev.map((r) => [r.id, r]));
  const changed = rows.flatMap((r, i) => {
    const was = byId.get(r.id);
    return !was || !same(was, r) ? [i] : [];
  });
  return { label: changed.length === 1 ? "1 change" : `${changed.length} changes`, lines: rows.length, changed };
}

function gridDelta(rows: string[][], prev: string[][] | undefined, first: string): Delta {
  const cols = rows[0]?.length ?? 1;
  const flat = rows.flat();
  if (!prev) return { label: first, lines: flat.length, changed: [], grid: { cols } };
  const pf = prev.flat();
  const changed = flat.flatMap((c, i) => (pf[i] !== c ? [i] : []));
  return { label: changed.length === 1 ? "1 edit" : `${changed.length} edits`, lines: flat.length, changed, grid: { cols } };
}

export function versionDelta(f: FileItem, i: number): Delta {
  const b = f.versions[i].body;
  const p = i > 0 ? f.versions[i - 1].body : undefined;
  switch (b.t) {
    case "runsheet":
      return listDelta(b.rows, p?.t === "runsheet" ? p.rows : undefined, (a, c) => a.time === c.time && a.title === c.title);
    case "quote":
      return listDelta(b.lines, p?.t === "quote" ? p.lines : undefined, (a, c) => a.amount === c.amount && a.item === c.item);
    case "menu":
      return listDelta(b.items, p?.t === "menu" ? p.items : undefined, (a, c) => a.price === c.price);
    case "grid":
      return gridDelta(b.rows, p?.t === "grid" ? p.rows : undefined, "First count");
    case "seating": {
      const toRows = (t: { seats: string[] }[]) => t[0].seats.map((_, r) => t.map((x) => x.seats[r] ?? ""));
      return gridDelta(toRows(b.tables), p?.t === "seating" ? toRows(p.tables) : undefined, "First pass");
    }
    case "sign":
      return { label: b.look === "first" ? "First print" : "Reprint", lines: 0, changed: [] };
    case "logo":
      return { label: b.round === 1 ? "Round one" : "Round two", lines: 0, changed: [] };
    default:
      return { label: i === 0 ? "Original" : "Updated", lines: 6, changed: [] };
  }
}
