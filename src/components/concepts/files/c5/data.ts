/*
 * Ask the files: invented sample data. Every file carries the text written
 * inside it, so snippets, answers and highlights are real passages rather
 * than lorem. Today is Thursday 25 September 2026.
 */

export const TODAY = "2026-09-25";

export type ProjectId = "orchard" | "wedding" | "trip" | "bakery" | "kiln";
export type PersonId =
  | "you"
  | "dev"
  | "niamh"
  | "mara"
  | "finn"
  | "aoife"
  | "conor"
  | "jess"
  | "ruth"
  | "hireco";
export type Kind = "doc" | "pdf" | "sheet" | "image" | "design" | "link";
export type State = "approved" | "signed" | "draft" | "awaiting";
export type Source = "upload" | "drive" | "link";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  tone: string;
  lead: PersonId;
  second: PersonId;
};
export type Person = {
  id: PersonId;
  name: string;
  first: string;
  role: string;
  tone: string;
  client?: boolean;
};

export const PROJECTS: Project[] = [
  {
    id: "orchard",
    name: "The Orchard",
    short: "Orchard",
    tone: "var(--v3-project-3)",
    lead: "dev",
    second: "niamh",
  },
  {
    id: "wedding",
    name: "Mara & Finn wedding",
    short: "Mara & Finn",
    tone: "var(--v3-project-8)",
    lead: "dev",
    second: "niamh",
  },
  {
    id: "trip",
    name: "St Brigid's Year 6 trip",
    short: "Year 6 trip",
    tone: "var(--v3-project-2)",
    lead: "aoife",
    second: "conor",
  },
  {
    id: "bakery",
    name: "Harbour Bakery launch",
    short: "Harbour Bakery",
    tone: "var(--v3-project-5)",
    lead: "niamh",
    second: "dev",
  },
  {
    id: "kiln",
    name: "Kiln & Co rebrand",
    short: "Kiln & Co",
    tone: "var(--v3-project-1)",
    lead: "niamh",
    second: "dev",
  },
];

export const PEOPLE: Person[] = [
  {
    id: "you",
    name: "Orla Byrne",
    first: "You",
    role: "Runs The Orchard",
    tone: "var(--v3-project-1)",
  },
  {
    id: "dev",
    name: "Dev Patel",
    first: "Dev",
    role: "Events lead",
    tone: "var(--v3-project-3)",
  },
  {
    id: "niamh",
    name: "Niamh Kelly",
    first: "Niamh",
    role: "Designer",
    tone: "var(--v3-project-6)",
  },
  {
    id: "mara",
    name: "Mara Doyle",
    first: "Mara",
    role: "Client, wedding",
    tone: "var(--v3-project-8)",
    client: true,
  },
  {
    id: "finn",
    name: "Finn Walsh",
    first: "Finn",
    role: "Client, wedding",
    tone: "var(--v3-project-2)",
    client: true,
  },
  {
    id: "aoife",
    name: "Aoife Brennan",
    first: "Aoife",
    role: "Year 6 teacher",
    tone: "var(--v3-project-4)",
  },
  {
    id: "conor",
    name: "Conor Duggan",
    first: "Conor",
    role: "Year 6 teacher",
    tone: "var(--v3-project-6)",
  },
  {
    id: "jess",
    name: "Jess Harbour",
    first: "Jess",
    role: "Client, bakery",
    tone: "var(--v3-project-5)",
    client: true,
  },
  {
    id: "ruth",
    name: "Ruth Kiely",
    first: "Ruth",
    role: "Client, Kiln & Co",
    tone: "var(--v3-project-7)",
    client: true,
  },
  {
    id: "hireco",
    name: "Hireco Event Hire",
    first: "Hireco",
    role: "Supplier",
    tone: "var(--v3-kind-neutral)",
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
  task?: string;
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

function f(x: FileItem): FileItem {
  return x;
}

export const FILES: FileItem[] = [
  /* ── Mara & Finn wedding ───────────────────────────────────────── */
  f({
    id: "w-seat-4",
    name: "Seating plan v4",
    kind: "sheet",
    project: "wedding",
    by: "dev",
    date: "2026-09-22",
    source: "drive",
    pages: 3,
    series: "seating",
    v: 4,
    approvedBy: "mara",
    approvedOn: "22 Sep",
    state: "approved",
    shared: true,
    due: true,
    task: "Approve the final seating plan",
    size: "Google Sheet",
    opened: "2h ago",
    body: [
      "Mara & Finn · Saturday 11 October · The Orchard, main barn",
      "Final count: 112 guests, 14 tables. Approved by Mara, 22 Sep.",
      "Table 1 (top table) | Mara, Finn, Clodagh, Rory, Siobhán, Pádraig",
      "Table 4 | College friends, keep away from the speakers",
      "Table 9 | Walsh cousins, two high chairs",
      "Dietary: 9 vegetarian, 3 vegan, 2 coeliac, 1 nut allergy at table 6.",
      "Changes after 22 Sep go through Dev, not the caterer.",
    ],
  }),
  f({
    id: "w-seat-3",
    name: "Seating plan v3",
    kind: "sheet",
    project: "wedding",
    by: "dev",
    date: "2026-09-17",
    source: "drive",
    pages: 3,
    series: "seating",
    v: 3,
    state: "draft",
    task: "Approve the final seating plan",
    size: "Google Sheet",
    body: [
      "Mara & Finn · Saturday 11 October · The Orchard, main barn",
      "Draft count: 118 guests, 15 tables. Still waiting on Finn's side for six replies.",
      "Table 1 (top table) | Mara, Finn, Clodagh, Rory",
      "Fifteen rounds lose the dance floor. Talk to Mara about dropping a table.",
    ],
  }),
  f({
    id: "w-seat-2",
    name: "Seating plan v2",
    kind: "sheet",
    project: "wedding",
    by: "dev",
    date: "2026-09-10",
    source: "drive",
    pages: 2,
    series: "seating",
    v: 2,
    state: "draft",
    size: "Google Sheet",
    body: [
      "First pass seating plan for Mara & Finn.",
      "Draft count: 124 guests, 16 tables, long tables in the barn.",
      "Mara prefers rounds. Redo with rounds of 8.",
    ],
  }),
  f({
    id: "w-marquee-3",
    name: "Marquee quote, Hireco v3.pdf",
    kind: "pdf",
    project: "wedding",
    by: "you",
    date: "2026-09-23",
    source: "upload",
    pages: 4,
    series: "marquee",
    v: 3,
    state: "awaiting",
    waitingOn: "mara",
    due: true,
    task: "Confirm marquee sides with the hire company",
    size: "184 KB",
    opened: "Yesterday",
    body: [
      "Hireco Event Hire · Quote 2231-C for The Orchard, Saturday 11 October.",
      "Prepared for Dev Patel. Valid for 14 days.",
      "Revised total for the 12 x 24m frame marquee with clear sides: EUR 3,850 incl. VAT. This replaces our quote of 18 Sep (EUR 4,200).",
      "The saving comes from dropping the second patio heater and using your own festoon lights.",
      "Build Thursday 9 October from 10:00. Strike Monday 13 October from 09:00.",
      "A 30% deposit holds the date until 30 September.",
      "Clear sides can swap for white sides on the day at no charge if it rains.",
      "Signed for Hireco: Pat Hennessy.",
    ],
  }),
  f({
    id: "w-marquee-2",
    name: "Marquee quote, Hireco v2.pdf",
    kind: "pdf",
    project: "wedding",
    by: "dev",
    date: "2026-09-18",
    source: "upload",
    pages: 4,
    series: "marquee",
    v: 2,
    size: "179 KB",
    body: [
      "Hireco Event Hire · Quote 2231-B for The Orchard, Saturday 11 October.",
      "Total for the 12 x 24m frame marquee with clear sides: EUR 4,200 incl. VAT.",
      "Includes two patio heaters and Hireco festoon lighting.",
    ],
  }),
  f({
    id: "w-marquee-1",
    name: "Marquee quote, Hireco.pdf",
    kind: "pdf",
    project: "wedding",
    by: "dev",
    date: "2026-09-04",
    source: "upload",
    pages: 3,
    series: "marquee",
    v: 1,
    size: "166 KB",
    body: [
      "Hireco Event Hire · Quote 2231 for The Orchard.",
      "Total for the 12 x 30m frame marquee: EUR 4,960 incl. VAT.",
      "Hard flooring optional at EUR 780.",
    ],
  }),
  f({
    id: "w-tasting",
    name: "Menu tasting booking.pdf",
    kind: "pdf",
    project: "wedding",
    by: "you",
    date: "2026-09-12",
    source: "upload",
    pages: 1,
    shared: true,
    task: "Book the menu tasting",
    size: "62 KB",
    body: [
      "Menu tasting for Mara & Finn.",
      "Friday 3 October at 18:00 in the Orchard kitchen, with chef Colm.",
      "Six courses. Mara asked to bring Finn's mother, so we're setting for three.",
      "Wine pairing on the house. Decisions on the main course by Monday 6 October.",
    ],
  }),
  f({
    id: "w-menu",
    name: "Wedding menu, draft 2.docx",
    kind: "doc",
    project: "wedding",
    by: "you",
    date: "2026-09-24",
    source: "upload",
    pages: 2,
    approvedBy: "mara",
    approvedOn: "24 Sep",
    state: "approved",
    shared: true,
    task: "Lock the wedding menu",
    size: "38 KB",
    body: [
      "Wedding breakfast for 112, served at 17:00.",
      "Starter: beetroot, goat's curd and toasted hazelnut.",
      "Main: slow lamb shoulder with salsa verde, or wild mushroom risotto.",
      "Dessert: lemon posset with Harbour Bakery shortbread.",
      "Evening food at 21:30: blaas with chips in paper cones.",
    ],
  }),
  f({
    id: "w-deposit",
    name: "Deposit invoice, Mara & Finn.pdf",
    kind: "pdf",
    project: "wedding",
    by: "you",
    date: "2026-07-09",
    source: "upload",
    pages: 1,
    shared: true,
    task: "Deposit invoice settled, Mara & Finn",
    size: "94 KB",
    body: [
      "Invoice 0098 · The Orchard · Mara Doyle and Finn Walsh.",
      "Deposit received: EUR 2,500 on 9 July. Thank you.",
      "Balance of EUR 7,480 due by 10 October, bank transfer to the account below.",
    ],
  }),
  f({
    id: "w-contract",
    name: "Venue contract, signed.pdf",
    kind: "pdf",
    project: "wedding",
    by: "you",
    date: "2026-07-02",
    source: "upload",
    pages: 6,
    state: "signed",
    shared: true,
    size: "412 KB",
    body: [
      "Venue hire agreement between The Orchard and Mara Doyle and Finn Walsh.",
      "Exclusive use of The Orchard from 12:00 Saturday 11 October to 11:00 Sunday 12 October.",
      "Music off at 00:30 under the venue licence. Bar closes at 00:15.",
      "Maximum 120 guests seated in the main barn, 180 with the marquee.",
      "Signed by both parties on 2 July 2026.",
    ],
  }),
  f({
    id: "w-runsheet",
    name: "Wedding day run-sheet v2.docx",
    kind: "doc",
    project: "wedding",
    by: "you",
    date: "2026-09-21",
    source: "upload",
    pages: 2,
    series: "w-run",
    v: 2,
    state: "draft",
    due: true,
    task: "Build the wedding day run-sheet",
    size: "44 KB",
    body: [
      "13:30 Ceremony in the walled garden. Chairs out by 12:45.",
      "14:15 Drinks on the terrace. Tonic and olives out, ice in the trough.",
      "17:00 Dinner called by the bell.",
      "20:45 First dance, then The Lowdowns.",
      "21:30 Evening food: blaas and chips.",
      "00:30 Music off. Taxis booked for 00:45 at the gate.",
    ],
  }),
  f({
    id: "w-terrace",
    name: "Terrace at golden hour.jpg",
    kind: "image",
    project: "wedding",
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
    project: "wedding",
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
    name: "Florist proposal, Wild Stem.pdf",
    kind: "pdf",
    project: "wedding",
    by: "mara",
    date: "2026-09-15",
    source: "upload",
    pages: 3,
    approvedBy: "mara",
    approvedOn: "20 Sep",
    state: "approved",
    shared: true,
    task: "Confirm the florist",
    size: "2.1 MB",
    body: [
      "Wild Stem · Proposal for Mara & Finn.",
      "Garden roses, sweet pea and trailing jasmine. No lilies.",
      "Ceremony arch: EUR 640. Table posies for 14 tables: EUR 420.",
      "Delivery Saturday 11 October at 10:00, collection Sunday before 11:00.",
    ],
  }),
  f({
    id: "w-playlist",
    name: "Evening playlist",
    kind: "link",
    project: "wedding",
    by: "finn",
    date: "2026-09-20",
    source: "link",
    pages: 1,
    shared: true,
    size: "Link",
    body: [
      "Finn's evening playlist for the DJ between band sets.",
      "First dance at 20:45. No line dancing, per Mara.",
    ],
  }),
  f({
    id: "w-guests",
    name: "Guest list and RSVPs.xlsx",
    kind: "sheet",
    project: "wedding",
    by: "mara",
    date: "2026-09-22",
    source: "drive",
    pages: 2,
    shared: true,
    due: true,
    task: "Chase the last RSVPs",
    size: "Google Sheet",
    body: [
      "112 yes, 9 no, 3 still to reply (the Galway side).",
      "Plus-ones confirmed for everyone at tables 4 and 7.",
      "Two guests arriving by the 16:10 train, taxi from Kilkenny station.",
    ],
  }),
  f({
    id: "w-band",
    name: "Band rider, The Lowdowns.pdf",
    kind: "pdf",
    project: "wedding",
    by: "finn",
    date: "2026-09-16",
    source: "upload",
    pages: 2,
    approvedBy: "mara",
    approvedOn: "17 Sep",
    state: "approved",
    size: "88 KB",
    body: [
      "The Lowdowns · Technical rider.",
      "Two 13A sockets stage left. Stage at least 5m x 3m.",
      "Hot meal for five at 19:30, not before the speeches.",
      "Sets: 21:00 to 22:00 and 22:30 to 00:15.",
    ],
  }),
  f({
    id: "w-shots",
    name: "Photographer shot list.docx",
    kind: "doc",
    project: "wedding",
    by: "finn",
    date: "2026-09-18",
    source: "upload",
    pages: 2,
    approvedBy: "mara",
    approvedOn: "19 Sep",
    state: "approved",
    task: "Send the shot list to the photographer",
    size: "31 KB",
    body: [
      "Must have: Mara's grandmother with all the grandchildren, under the old pear tree.",
      "Golden hour on the terrace at 19:10, ten minutes, just the two of us.",
      "No posed shots during the speeches.",
    ],
  }),

  /* ── The Orchard ──────────────────────────────────────────────── */
  f({
    id: "o-bar",
    name: "Bar order, October.xlsx",
    kind: "sheet",
    project: "orchard",
    by: "dev",
    date: "2026-09-19",
    source: "drive",
    pages: 2,
    approvedBy: "you",
    approvedOn: "19 Sep",
    state: "approved",
    task: "Order tonic + the good olives",
    size: "Google Sheet",
    opened: "Monday",
    body: [
      "Bar order for the October weekends, Sheridans and Fever-Tree.",
      "Tonic: 6 cases of Fever-Tree Mediterranean, the good olives from Sheridans (2 x 1kg tubs).",
      "Gin | Glendalough Wild Botanical | 8 bottles",
      "Beer | Kinnegar Scraggy Bay | 6 kegs",
      "Ordered 19 Sep. Delivery Wednesday 8 October before 11:00, side gate.",
    ],
  }),
  f({
    id: "o-runsheet",
    name: "Run-sheet, Saturday v3.pdf",
    kind: "pdf",
    project: "orchard",
    by: "you",
    date: "2026-09-16",
    source: "upload",
    pages: 2,
    state: "approved",
    approvedBy: "you",
    approvedOn: "16 Sep",
    task: "Build the Saturday run-sheet",
    size: "402 KB",
    body: [
      "Open day, Saturday 4 October. Gates at 11:00.",
      "11:30 Tours of the barn every half hour, Dev leads.",
      "13:00 Tasting plates on the terrace.",
      "16:00 Gates close. Clear the car park by 16:30.",
    ],
  }),
  f({
    id: "o-welcome",
    name: "Welcome sign artwork.png",
    kind: "image",
    project: "orchard",
    by: "niamh",
    date: "2026-09-12",
    source: "upload",
    pages: 1,
    task: "Reprint the faded welcome sign before the open day",
    size: "1.1 MB",
    art: ["#1f5c4f", "#d9c9a3"],
    body: ["Artwork for the new welcome sign at the lane entrance."],
    ocr: "Welcome to The Orchard. Parking behind the walled garden. Please drive slowly, hens about.",
  }),
  f({
    id: "o-suppliers",
    name: "Recommended suppliers",
    kind: "link",
    project: "orchard",
    by: "you",
    date: "2026-09-11",
    source: "link",
    pages: 1,
    shared: true,
    task: "Sign off the recommended-suppliers list",
    size: "Link",
    body: [
      "Hireco for marquees, Wild Stem for flowers, Burke's Coaches for transport, Sheridans for cheese and olives.",
    ],
  }),
  f({
    id: "o-fire",
    name: "Fire safety certificate 2026.pdf",
    kind: "pdf",
    project: "orchard",
    by: "you",
    date: "2026-08-03",
    source: "upload",
    pages: 2,
    state: "signed",
    size: "240 KB",
    body: [
      "Certified for 250 people standing and 180 seated in the main barn.",
      "Four exits, all lit and signed. Next inspection March 2027.",
    ],
  }),
  f({
    id: "o-insurance",
    name: "Public liability insurance, Hireco.pdf",
    kind: "pdf",
    project: "orchard",
    by: "hireco",
    date: "2026-09-20",
    source: "drive",
    pages: 3,
    lockedIn: "hireco",
    task: "Get Hireco's insurance cert for the marquee",
    size: "Drive file",
    body: [],
  }),
  f({
    id: "o-rota",
    name: "Staff rota, October.xlsx",
    kind: "sheet",
    project: "orchard",
    by: "dev",
    date: "2026-09-24",
    source: "drive",
    pages: 1,
    due: true,
    task: "Publish the October rota",
    size: "Google Sheet",
    body: [
      "Saturday 11 Oct | Dev leads. Aisling on the bar, Cian and Rosa on the floor.",
      "Saturday 11 Oct | Orla on the gate until 16:00.",
      "Saturday 18 Oct | Closed for a private event.",
    ],
  }),
  f({
    id: "o-floor",
    name: "Barn floor plan.pdf",
    kind: "design",
    project: "orchard",
    by: "niamh",
    date: "2026-09-09",
    source: "upload",
    pages: 1,
    size: "860 KB",
    body: [
      "Main barn, 24m x 14m.",
      "14 rounds of 8 fit with a 6m dance floor. 15 rounds lose the dance floor.",
      "Stage stage-left of the fireplace, two sockets behind the beam.",
    ],
  }),
  f({
    id: "o-prices",
    name: "2027 wedding prices.pdf",
    kind: "pdf",
    project: "orchard",
    by: "you",
    date: "2026-09-23",
    source: "upload",
    pages: 2,
    state: "draft",
    size: "120 KB",
    body: [
      "Saturday exclusive use: EUR 9,800. Fridays and Sundays: EUR 7,200.",
      "Winter weekdays from EUR 4,500. Marquee hire passed through at cost.",
    ],
  }),
  f({
    id: "o-openday",
    name: "Open day, 14 Sep.jpg",
    kind: "image",
    project: "orchard",
    by: "dev",
    date: "2026-09-14",
    source: "upload",
    pages: 1,
    shared: true,
    size: "3.2 MB",
    art: ["#8fb07a", "#2e4a3a"],
    body: ["Crowd on the terrace at the September open day."],
  }),
  f({
    id: "o-cleaning",
    name: "Cleaning checklist.docx",
    kind: "doc",
    project: "orchard",
    by: "dev",
    date: "2026-09-01",
    source: "upload",
    pages: 1,
    size: "22 KB",
    body: [
      "Barn floor mopped after every event. Fire exits clear. Bins out Monday night.",
    ],
  }),
  f({
    id: "o-marquee-layout",
    name: "Marquee layout, Hireco.png",
    kind: "image",
    project: "orchard",
    by: "dev",
    date: "2026-09-23",
    source: "upload",
    pages: 1,
    size: "740 KB",
    art: ["#e9eef2", "#6b8594"],
    body: ["Hireco's layout drawing for the terrace marquee."],
    ocr: "12 x 24m frame. Clear sides. Entrance on the terrace side. Heater position A only.",
  }),

  /* ── St Brigid's Year 6 trip ──────────────────────────────────── */
  f({
    id: "t-letter",
    name: "Trip letter to parents.pdf",
    kind: "pdf",
    project: "trip",
    by: "aoife",
    date: "2026-09-18",
    source: "upload",
    pages: 2,
    approvedBy: "aoife",
    approvedOn: "18 Sep",
    state: "approved",
    shared: true,
    task: "Send the trip letter home",
    size: "128 KB",
    opened: "Tuesday",
    body: [
      "Dear parents and guardians,",
      "Year 6 are going to Galway Atlantaquaria and Salthill on Thursday 9 October.",
      "The bus leaves the school at 08:15 sharp on Thursday 9 October and returns by 17:30.",
      "Please send a packed lunch, a rain jacket and EUR 12 for the aquarium in an envelope with your child's name on it.",
      "Consent slips back to Ms Brennan by Friday 3 October.",
    ],
  }),
  f({
    id: "t-consent",
    name: "Consent slips, returned.xlsx",
    kind: "sheet",
    project: "trip",
    by: "aoife",
    date: "2026-09-24",
    source: "drive",
    pages: 1,
    due: true,
    task: "Collect consent slips",
    size: "Google Sheet",
    body: [
      "24 of 28 returned. Still waiting on four.",
      "Reminder going home in bags on Friday.",
    ],
  }),
  f({
    id: "t-risk",
    name: "Risk assessment, Salthill.docx",
    kind: "doc",
    project: "trip",
    by: "aoife",
    date: "2026-09-16",
    source: "upload",
    pages: 3,
    state: "awaiting",
    task: "Get the risk assessment signed off",
    size: "56 KB",
    body: [
      "One adult to seven children on the prom.",
      "No paddling beyond knee height. Meeting point: the diving tower.",
      "First aid kit with Mr Duggan. Head count at every stop.",
    ],
  }),
  f({
    id: "t-bus",
    name: "Bus booking, Burke's Coaches.pdf",
    kind: "pdf",
    project: "trip",
    by: "aoife",
    date: "2026-09-12",
    source: "upload",
    pages: 1,
    state: "signed",
    task: "Book the bus",
    size: "74 KB",
    body: [
      "53-seater with seatbelts. Driver at the school gate from 08:00 on Thursday 9 October.",
      "Return pick-up from Salthill at 15:30. EUR 690 return, invoice to the school office.",
    ],
  }),
  f({
    id: "t-itin-3",
    name: "Itinerary v3.docx",
    kind: "doc",
    project: "trip",
    by: "aoife",
    date: "2026-09-22",
    source: "upload",
    pages: 1,
    series: "itin",
    v: 3,
    due: true,
    task: "Finalise the itinerary",
    size: "28 KB",
    body: [
      "10:30 Atlantaquaria, two groups.",
      "12:30 Packed lunch on the prom, rain plan: the aquarium café.",
      "13:30 Salthill beach walk to the diving tower.",
      "15:30 Bus home.",
    ],
  }),
  f({
    id: "t-itin-2",
    name: "Itinerary v2.docx",
    kind: "doc",
    project: "trip",
    by: "aoife",
    date: "2026-09-15",
    source: "upload",
    pages: 1,
    series: "itin",
    v: 2,
    size: "27 KB",
    body: [
      "10:00 Atlantaquaria.",
      "12:00 Lunch at Leisureland.",
      "15:00 Bus home.",
    ],
  }),
  f({
    id: "t-map",
    name: "Salthill meeting points.png",
    kind: "image",
    project: "trip",
    by: "aoife",
    date: "2026-09-17",
    source: "upload",
    pages: 1,
    size: "690 KB",
    art: ["#bfe0ea", "#2f6f8f"],
    body: ["Annotated map of the prom."],
    ocr: "Meeting point: diving tower. Toilets: Leisureland. Bus waits at the Salthill Hotel.",
  }),
  f({
    id: "t-budget",
    name: "Trip budget.xlsx",
    kind: "sheet",
    project: "trip",
    by: "aoife",
    date: "2026-09-13",
    source: "drive",
    pages: 1,
    size: "Google Sheet",
    body: [
      "Bus | EUR 690",
      "Aquarium | EUR 336 for 28 children",
      "Total EUR 1,026, EUR 36.64 per child.",
    ],
  }),
  f({
    id: "t-bring",
    name: "What to bring.pdf",
    kind: "pdf",
    project: "trip",
    by: "aoife",
    date: "2026-09-18",
    source: "upload",
    pages: 1,
    shared: true,
    size: "40 KB",
    body: [
      "Packed lunch and a water bottle. Rain jacket. EUR 12 in a named envelope. No phones, please.",
    ],
  }),

  /* ── Harbour Bakery launch ───────────────────────────────────── */
  f({
    id: "b-menu-2",
    name: "Harbour Bakery menu v2.pdf",
    kind: "pdf",
    project: "bakery",
    by: "niamh",
    date: "2026-09-21",
    source: "upload",
    pages: 2,
    series: "b-menu",
    v: 2,
    approvedBy: "jess",
    approvedOn: "22 Sep",
    state: "approved",
    shared: true,
    size: "520 KB",
    body: [
      "Harbour Bakery · Harbour Road, Howth.",
      "Sourdough, cardamom buns, the lemon drizzle loaf and sausage rolls with fennel.",
      "Coffee from Badger & Dodo. Oat milk at no extra charge.",
    ],
  }),
  f({
    id: "b-menu-1",
    name: "Harbour Bakery menu.pdf",
    kind: "pdf",
    project: "bakery",
    by: "niamh",
    date: "2026-09-08",
    source: "upload",
    pages: 2,
    series: "b-menu",
    v: 1,
    size: "498 KB",
    body: [
      "Sourdough, cinnamon buns and sausage rolls.",
      "Coffee to be confirmed.",
    ],
  }),
  f({
    id: "b-launch",
    name: "Launch plan.docx",
    kind: "doc",
    project: "bakery",
    by: "you",
    date: "2026-09-20",
    source: "upload",
    pages: 3,
    state: "approved",
    approvedBy: "jess",
    approvedOn: "21 Sep",
    shared: true,
    due: true,
    task: "Agree the launch plan with Jess",
    size: "64 KB",
    opened: "Yesterday",
    body: [
      "Harbour Bakery opens on Saturday 18 October, doors at 08:00.",
      "The first 50 customers get a free cardamom bun.",
      "Press tasting: Thursday 16 October at 11:00, upstairs, eight food writers.",
      "Jess speaks at 11:20 for five minutes, no more.",
      "Budget for launch week: EUR 1,800 including the poster run.",
    ],
  }),
  f({
    id: "b-press",
    name: "Press list.xlsx",
    kind: "sheet",
    project: "bakery",
    by: "you",
    date: "2026-09-19",
    source: "drive",
    pages: 1,
    task: "Invite the press",
    size: "Google Sheet",
    body: [
      "Eight writers confirmed for the press tasting.",
      "Two photographers, one from the Independent.",
    ],
  }),
  f({
    id: "b-poster",
    name: "Launch poster, A2.pdf",
    kind: "design",
    project: "bakery",
    by: "niamh",
    date: "2026-09-23",
    source: "upload",
    pages: 1,
    approvedBy: "jess",
    approvedOn: "23 Sep",
    state: "approved",
    shared: true,
    task: "Print the launch posters",
    size: "4.8 MB",
    body: [
      "Harbour Bakery · Opening Saturday 18 October · 08:00 · Harbour Road, Howth.",
      "Print run: 40 at A2 on uncoated stock.",
    ],
  }),
  f({
    id: "b-grid",
    name: "Instagram grid, week 1",
    kind: "design",
    project: "bakery",
    by: "niamh",
    date: "2026-09-24",
    source: "link",
    pages: 1,
    state: "awaiting",
    due: true,
    size: "Figma",
    body: [
      "Nine posts for launch week. Post one: the oven going in. Post nine: doors open.",
    ],
  }),
  f({
    id: "b-snag",
    name: "Shopfit snag list.docx",
    kind: "doc",
    project: "bakery",
    by: "jess",
    date: "2026-09-24",
    source: "upload",
    pages: 1,
    due: true,
    task: "Close the shopfit snags",
    size: "19 KB",
    body: [
      "Counter lights flicker. Second oven vent not signed off.",
      "Door sign still says coming soon.",
    ],
  }),
  f({
    id: "b-crumb",
    name: "Crumb shots.jpg",
    kind: "image",
    project: "bakery",
    by: "jess",
    date: "2026-09-17",
    source: "upload",
    pages: 1,
    shared: true,
    size: "5.6 MB",
    art: ["#e7c79a", "#7a4a26"],
    body: ["Close-ups of the sourdough crumb for the menu board."],
  }),
  f({
    id: "b-flour",
    name: "Flour order, Macroom Mills.pdf",
    kind: "pdf",
    project: "bakery",
    by: "jess",
    date: "2026-09-10",
    source: "upload",
    pages: 1,
    size: "51 KB",
    body: [
      "Stoneground wholemeal, 10 x 25kg. Strong white, 20 x 16kg. Delivery Tuesdays.",
    ],
  }),
  f({
    id: "b-prices",
    name: "Price list.xlsx",
    kind: "sheet",
    project: "bakery",
    by: "jess",
    date: "2026-09-22",
    source: "drive",
    pages: 1,
    state: "draft",
    size: "Google Sheet",
    body: [
      "Sourdough | EUR 6.50",
      "Cardamom bun | EUR 3.80",
      "Flat white | EUR 3.60",
    ],
  }),

  /* ── Kiln & Co rebrand ────────────────────────────────────────── */
  f({
    id: "k-guide-2",
    name: "Brand guidelines v2.pdf",
    kind: "pdf",
    project: "kiln",
    by: "niamh",
    date: "2026-09-21",
    source: "upload",
    pages: 18,
    series: "k-guide",
    v: 2,
    approvedBy: "ruth",
    approvedOn: "22 Sep",
    state: "approved",
    shared: true,
    task: "Hand over brand guidelines",
    size: "9.2 MB",
    opened: "Monday",
    body: [
      "Kiln & Co brand guidelines, version 2.",
      "Three colours: Clay #C8643B, Glaze #1F4E5F and Ash #E8E2D8. Clay leads; Glaze carries text on Ash.",
      "Typeface: a grotesk for headings, Newsreader for body copy.",
      "The kiln mark always sits on Ash or Clay, never on photography.",
      "Minimum logo width: 24mm in print, 96px on screen.",
    ],
  }),
  f({
    id: "k-guide-1",
    name: "Brand guidelines.pdf",
    kind: "pdf",
    project: "kiln",
    by: "niamh",
    date: "2026-09-05",
    source: "upload",
    pages: 14,
    series: "k-guide",
    v: 1,
    size: "7.9 MB",
    body: [
      "Kiln & Co brand guidelines, first draft.",
      "Colours: Clay #C8643B and Slate #3A4750.",
    ],
  }),
  f({
    id: "k-logo",
    name: "Logo, final lockups",
    kind: "design",
    project: "kiln",
    by: "niamh",
    date: "2026-09-18",
    source: "link",
    pages: 1,
    approvedBy: "ruth",
    approvedOn: "18 Sep",
    state: "approved",
    shared: true,
    size: "Figma",
    body: ["Stacked and horizontal lockups, kiln mark without the flame."],
  }),
  f({
    id: "k-mood",
    name: "Moodboard, glaze tests.jpg",
    kind: "image",
    project: "kiln",
    by: "niamh",
    date: "2026-08-28",
    source: "upload",
    pages: 1,
    size: "3.9 MB",
    art: ["#c8643b", "#1f4e5f"],
    body: ["Glaze test tiles from the studio, shot on the Ash backdrop."],
  }),
  f({
    id: "k-proposal",
    name: "Rebrand proposal.pdf",
    kind: "pdf",
    project: "kiln",
    by: "you",
    date: "2026-08-02",
    source: "upload",
    pages: 8,
    state: "signed",
    shared: true,
    size: "1.2 MB",
    body: [
      "Fee: EUR 8,400 in three stages.",
      "Stage two invoice on logo sign-off. Stage three on the website going live.",
    ],
  }),
  f({
    id: "k-invoice",
    name: "Invoice 0142, stage two.pdf",
    kind: "pdf",
    project: "kiln",
    by: "you",
    date: "2026-09-19",
    source: "upload",
    pages: 1,
    shared: true,
    task: "Invoice stage two",
    size: "58 KB",
    body: [
      "Kiln & Co · Stage two, logo and guidelines.",
      "EUR 2,800 due 3 October.",
    ],
  }),
  f({
    id: "k-copy",
    name: "Website copy, draft 3.docx",
    kind: "doc",
    project: "kiln",
    by: "niamh",
    date: "2026-09-23",
    source: "upload",
    pages: 4,
    state: "draft",
    due: true,
    task: "Write the website copy",
    size: "47 KB",
    body: [
      "Handmade in Kilkenny since 2009.",
      "Every mug is thrown, glazed and fired in the same shed, by the same four people.",
      "Shipping to Ireland and the UK. Seconds sale every March.",
    ],
  }),
  f({
    id: "k-dielines",
    name: "Packaging dielines.pdf",
    kind: "design",
    project: "kiln",
    by: "niamh",
    date: "2026-09-15",
    source: "upload",
    pages: 3,
    size: "2.4 MB",
    body: ["Mug box 110 x 110 x 120mm. Kraft board, one-colour Glaze print."],
  }),
  f({
    id: "k-shoot",
    name: "Studio shoot selects.jpg",
    kind: "image",
    project: "kiln",
    by: "ruth",
    date: "2026-09-11",
    source: "upload",
    pages: 1,
    shared: true,
    size: "6.1 MB",
    art: ["#d9cbb6", "#5a3b2c"],
    body: ["Twelve selects from the studio shoot for the homepage."],
  }),
  f({
    id: "k-feedback",
    name: "Ruth's feedback, logo round 2.docx",
    kind: "doc",
    project: "kiln",
    by: "ruth",
    date: "2026-09-14",
    source: "upload",
    pages: 1,
    size: "18 KB",
    body: [
      "Keep the kiln mark, lose the flame.",
      "Clay feels right. The blue felt cold, try something deeper.",
    ],
  }),
  f({
    id: "k-audit",
    name: "Instagram audit",
    kind: "link",
    project: "kiln",
    by: "niamh",
    date: "2026-09-02",
    source: "link",
    pages: 1,
    size: "Link",
    body: [
      "Best posts are process shots. Product-on-white posts get half the saves.",
    ],
  }),
];

/** Arrives a few seconds after the page opens, to show saved searches updating live. */
export const INCOMING: FileItem = f({
  id: "w-bar-wed",
  name: "Bar order, wedding weekend.xlsx",
  kind: "sheet",
  project: "wedding",
  by: "dev",
  date: "2026-09-25",
  source: "drive",
  pages: 1,
  approvedBy: "mara",
  approvedOn: "25 Sep",
  state: "approved",
  shared: true,
  due: true,
  task: "Order tonic + the good olives",
  size: "Google Sheet",
  body: [
    "Wedding weekend bar, on top of the October order.",
    "Two extra cases of tonic and a magnum of Mara's Crémant for the toast.",
    "Approved by Mara, 25 Sep.",
  ],
});

/* ── Answers: a question gets a sentence back, always with its source ── */

export type Answer = {
  id: string;
  /** Every group must match at least one word (prefix match). */
  when: string[][];
  sentence: string;
  /** Parts of the sentence to set in the strong weight. */
  strong: string[];
  file: string;
  /** Index into the file body. */
  passage: number;
  /** The words that answer the question: lit with the full highlighter. */
  marks: string[];
  /** Supporting context in the same passage (an old price, a date): underlined, never lit. */
  context?: string[];
};

export const ANSWERS: Answer[] = [
  {
    id: "marquee-price",
    when: [
      ["marquee", "hireco"],
      ["much", "cost", "price", "quote", "total", "now", "eur", "euro"],
    ],
    sentence: "EUR 3,850, down from EUR 4,200. Mara hasn't approved it yet.",
    strong: ["EUR 3,850"],
    file: "w-marquee-3",
    passage: 2,
    marks: ["EUR 3,850"],
    context: ["EUR 4,200", "18 Sep"],
  },
  {
    id: "seating",
    when: [
      ["seating", "tables", "guests", "headcount", "count"],
      ["mara", "approved", "latest", "final", "many", "how", "plan"],
    ],
    sentence:
      "Seating plan v4 is the latest. Mara approved it on 22 Sep: 112 guests at 14 tables.",
    strong: ["Seating plan v4", "112 guests at 14 tables"],
    file: "w-seat-4",
    passage: 1,
    marks: ["112 guests", "14 tables"],
    context: ["Approved by Mara, 22 Sep"],
  },
  {
    id: "bus",
    when: [
      ["bus", "coach"],
      ["leave", "leaves", "time", "when", "depart", "go", "back", "return"],
    ],
    sentence: "08:15 from the school, back by 17:30 on Thursday 9 October.",
    strong: ["08:15", "17:30"],
    file: "t-letter",
    passage: 2,
    marks: ["bus leaves the school at 08:15", "17:30"],
  },
  {
    id: "bring",
    when: [
      ["bring", "pack", "packed", "need", "money"],
      ["trip", "children", "kids", "year", "aquarium", "bring", "they"],
    ],
    sentence:
      "A packed lunch, a rain jacket and EUR 12 for the aquarium in a named envelope.",
    strong: ["packed lunch", "rain jacket", "EUR 12"],
    file: "t-letter",
    passage: 3,
    marks: ["packed lunch", "rain jacket", "EUR 12"],
  },
  {
    id: "tonic",
    when: [["tonic", "olives", "fever", "sheridans"]],
    sentence:
      "6 cases of Fever-Tree Mediterranean, ordered on 19 Sep for delivery on 8 October.",
    strong: ["6 cases"],
    file: "o-bar",
    passage: 1,
    marks: ["6 cases of Fever-Tree Mediterranean"],
    context: ["the good olives from Sheridans"],
  },
  {
    id: "launch",
    when: [
      ["launch", "open", "opening", "opens"],
      ["when", "date", "day", "time", "bakery", "doors"],
    ],
    sentence: "Saturday 18 October, doors at 08:00.",
    strong: ["Saturday 18 October", "08:00"],
    file: "b-launch",
    passage: 0,
    marks: ["Saturday 18 October", "doors at 08:00"],
  },
  {
    id: "kiln-colours",
    when: [
      ["colour", "colours", "color", "colors", "palette", "hex"],
      ["kiln", "brand", "rebrand", "clay", "what", "which"],
    ],
    sentence: "Clay, Glaze and Ash. Clay leads; Glaze carries text on Ash.",
    strong: ["Clay", "Glaze", "Ash"],
    file: "k-guide-2",
    passage: 1,
    marks: ["Clay #C8643B", "Glaze #1F4E5F", "Ash #E8E2D8"],
  },
  {
    id: "balance",
    when: [
      ["balance", "deposit", "owe", "owed", "due"],
      ["mara", "finn", "wedding", "balance", "deposit"],
    ],
    sentence:
      "EUR 7,480 is due by 10 October. The EUR 2,500 deposit landed on 9 July.",
    strong: ["EUR 7,480", "10 October"],
    file: "w-deposit",
    passage: 2,
    marks: ["EUR 7,480", "10 October"],
  },
  {
    id: "music",
    when: [
      ["music", "band", "finish", "curfew", "late"],
      ["off", "time", "when", "finish", "stop", "late", "until"],
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
        label: "The menu tasting",
        project: "wedding",
        sentence: "Friday 3 October at 18:00 in the Orchard kitchen.",
        strong: ["Friday 3 October at 18:00"],
        file: "w-tasting",
        passage: 1,
        marks: ["Friday 3 October at 18:00"],
      },
      {
        label: "The press tasting",
        project: "bakery",
        sentence: "Thursday 16 October at 11:00, upstairs at Harbour Bakery.",
        strong: ["Thursday 16 October at 11:00"],
        file: "b-launch",
        passage: 2,
        marks: ["Thursday 16 October at 11:00"],
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
    file: "o-insurance",
    sentence:
      "The answer is most likely in Hireco's public liability certificate, which you can't open yet.",
  },
];

/** Did-you-mean pairs for words that are not in any file. */
export const NEAR: Record<string, string> = {
  cake: "b-menu-2",
  cakes: "b-menu-2",
  bread: "b-menu-2",
  flowers: "w-florist",
  dj: "w-playlist",
  logo: "k-logo",
  photos: "o-openday",
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
  "when does the bus leave?",
  "when is the tasting?",
];
