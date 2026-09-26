/**
 * Kit for the day: invented sample data. Front-end concept only.
 * "Today" is fixed so the countdown reads the same in every review.
 */

export const TODAY = "2026-09-25";

export type FileState = "ready" | "draft" | "waiting" | "missing";

export type PreviewType =
  | "doc"
  | "menu"
  | "sheet"
  | "invoice"
  | "photo"
  | "plan"
  | "seating"
  | "slides"
  | "design"
  | "link"
  | "form"
  | "contract";

export type FileKind = "doc" | "pdf" | "sheet" | "image" | "slides" | "design" | "link";

export type Preview = {
  type: PreviewType;
  /** Short title printed on the thumbnail. */
  label?: string;
  /** Variant seed: palette for photos, layout for plans. */
  v?: number;
};

export type KitFile = {
  id: string;
  name: string;
  kind: FileKind;
  preview: Preview;
  state: FileState;
  /** Person or supplier; for ready files, who signed it off. */
  who?: string;
  /** Human line under the name. */
  note: string;
  size?: string;
  updated?: string;
  task?: string;
  /** Shared from another project, such as the venue's own files. */
  from?: string;
};

export type Milestone = {
  id: string;
  title: string;
  /** Used in sentences: "Kit for the walkthrough". */
  kitName: string;
  date: string;
  time?: string;
  place?: string;
  tasks: number;
  /** The headline moment of the project: drawn larger on the ribbon. */
  major?: boolean;
  /** The person asked when something is missing. */
  askName?: string;
  files: KitFile[];
};

export type Project = {
  id: string;
  name: string;
  kind: string;
  tone: number;
  initials: string;
  milestones: Milestone[];
  anytime: KitFile[];
  /** Files on tasks without a date. */
  undated?: number;
};

const ORCHARD_REFERENCE: KitFile[] = [
  {
    id: "a-floor",
    name: "Barn floor plan",
    kind: "pdf",
    preview: { type: "plan", v: 0 },
    state: "ready",
    who: "Orla",
    note: "Updated with the new bar position",
    size: "1.2 MB",
    updated: "2 Sep",
    from: "The Orchard",
  },
  {
    id: "a-terrace",
    name: "Terrace capacity",
    kind: "doc",
    preview: { type: "doc", label: "Terrace" },
    state: "ready",
    who: "Orla",
    note: "120 standing, 80 seated",
    size: "84 KB",
    updated: "19 Aug",
    from: "The Orchard",
  },
  {
    id: "a-fire",
    name: "Fire safety plan",
    kind: "pdf",
    preview: { type: "plan", v: 1, label: "Exits" },
    state: "ready",
    who: "Declan",
    note: "Reviewed by the county, valid to March",
    size: "2.4 MB",
    updated: "11 Mar",
    from: "The Orchard",
  },
];

const WEDDING: Project = {
  id: "wedding",
  name: "Mara & Finn wedding",
  kind: "Wedding",
  tone: 8,
  initials: "MF",
  undated: 2,
  anytime: [
    ...ORCHARD_REFERENCE,
    {
      id: "w-suppliers",
      name: "Recommended suppliers",
      kind: "link",
      preview: { type: "link", label: "theorchard.ie/suppliers" },
      state: "ready",
      who: "Orla",
      note: "Florists, bands, cars and cakes we trust",
      updated: "4 Sep",
      from: "The Orchard",
    },
    {
      id: "w-brand",
      name: "Mara & Finn brand kit",
      kind: "design",
      preview: { type: "design", label: "M&F" },
      state: "ready",
      who: "Mara",
      note: "Monogram, sage and blush, two typefaces",
      size: "6.8 MB",
      updated: "28 Aug",
    },
  ],
  milestones: [
    {
      id: "w-contract",
      title: "Venue contract signed",
      kitName: "the contract",
      date: "2026-09-14",
      tasks: 2,
      files: [
        { id: "w1", name: "Venue contract, signed", kind: "pdf", preview: { type: "contract", label: "Contract" }, state: "ready", who: "Mara", note: "Signed by Mara and Finn", size: "312 KB", updated: "14 Sep", task: "Send the venue contract" },
        { id: "w2", name: "Deposit invoice", kind: "pdf", preview: { type: "invoice", label: "€4,500" }, state: "ready", who: "Orla", note: "Paid on 16 Sep", size: "94 KB", updated: "16 Sep", task: "Take the deposit" },
        { id: "w3", name: "Booking terms", kind: "doc", preview: { type: "doc", label: "Terms" }, state: "ready", who: "Orla", note: "Standard 2026 terms", size: "61 KB", updated: "10 Sep", task: "Send the venue contract" },
      ],
    },
    {
      id: "w-guests",
      title: "Guest list to the venue",
      kitName: "the guest list",
      date: "2026-09-22",
      tasks: 2,
      askName: "Finn",
      files: [
        { id: "w4", name: "Guest list", kind: "sheet", preview: { type: "sheet", v: 1 }, state: "draft", who: "Mara", note: "Mara is still adding plus-ones", size: "38 KB", updated: "Yesterday", task: "Collect the guest list" },
        { id: "w5", name: "Save the date", kind: "image", preview: { type: "photo", v: 3, label: "Save the date" }, state: "ready", who: "Mara", note: "Sent to 118 guests", size: "2.1 MB", updated: "8 Sep", task: "Collect the guest list" },
        { id: "w6", name: "Accessibility needs", kind: "doc", preview: { type: "form" }, state: "missing", who: "Finn", note: "Expected from Finn", task: "Check step-free access for guests" },
      ],
    },
    {
      id: "w-tasting",
      title: "Menu tasting",
      kitName: "the tasting",
      date: "2026-10-01",
      time: "2:30 pm",
      place: "The Barn kitchen",
      tasks: 3,
      files: [
        { id: "w7", name: "Tasting menu, v2", kind: "pdf", preview: { type: "menu", label: "Tasting menu" }, state: "ready", who: "Dev", note: "Signed off by Dev, head chef", size: "220 KB", updated: "23 Sep", task: "Confirm the tasting menu" },
        { id: "w8", name: "Wine pairing notes", kind: "doc", preview: { type: "doc", label: "Wine" }, state: "ready", who: "Dev", note: "Three pairings, one alcohol-free", size: "48 KB", updated: "22 Sep", task: "Confirm the tasting menu" },
        { id: "w9", name: "Tasting table", kind: "sheet", preview: { type: "seating", v: 1 }, state: "ready", who: "Orla", note: "Six seats, window table", size: "22 KB", updated: "21 Sep", task: "Book the tasting table" },
        { id: "w10", name: "Plating photos", kind: "image", preview: { type: "photo", v: 1 }, state: "ready", who: "Dev", note: "From the September trial", size: "8.4 MB", updated: "20 Sep", task: "Confirm the tasting menu" },
      ],
    },
    {
      id: "w-numbers",
      title: "Final numbers due",
      kitName: "final numbers",
      date: "2026-10-05",
      tasks: 4,
      askName: "Mara",
      files: [
        { id: "w11", name: "Guest count, final", kind: "sheet", preview: { type: "sheet", v: 2 }, state: "ready", who: "Mara", note: "112 adults, 9 children", size: "31 KB", updated: "24 Sep", task: "Lock the guest count" },
        { id: "w12", name: "Marquee quote, Hireco", kind: "pdf", preview: { type: "invoice", label: "Hireco" }, state: "waiting", who: "Hireco", note: "Waiting on Hireco for the revised quote", size: "184 KB", updated: "18 Sep", task: "Confirm marquee sides with the hire company" },
        { id: "w13", name: "Allergy list", kind: "sheet", preview: { type: "form" }, state: "missing", who: "Mara", note: "Expected from Mara", task: "Collect dietary needs" },
        { id: "w14", name: "Bar order", kind: "sheet", preview: { type: "sheet", v: 3 }, state: "ready", who: "Orla", note: "Tonic, the good olives, 40 Prosecco", size: "19 KB", updated: "23 Sep", task: "Order tonic and the good olives" },
        { id: "w15", name: "Children's menu", kind: "doc", preview: { type: "menu", label: "Little ones" }, state: "ready", who: "Dev", note: "Signed off by Dev", size: "40 KB", updated: "22 Sep", task: "Confirm the tasting menu" },
        { id: "w16", name: "Place card names", kind: "sheet", preview: { type: "sheet", v: 0 }, state: "ready", who: "Finn", note: "Spellings checked by Finn", size: "12 KB", updated: "24 Sep", task: "Print the place cards" },
        { id: "w17", name: "Room layout, banquet", kind: "pdf", preview: { type: "seating", v: 0 }, state: "ready", who: "Orla", note: "Twelve rounds of ten", size: "640 KB", updated: "21 Sep", task: "Approve the final seating plan" },
      ],
    },
    {
      id: "w-walk",
      title: "Walkthrough with Mara & Finn",
      kitName: "the walkthrough",
      date: "2026-10-10",
      time: "11:00 am",
      place: "Meet at the Barn doors",
      tasks: 3,
      askName: "Mara",
      files: [
        { id: "w18", name: "Run-sheet, Saturday v3", kind: "doc", preview: { type: "doc", label: "Run-sheet" }, state: "draft", who: "Orla", note: "Draft, edited 2 hours ago", size: "402 KB", updated: "Today", task: "Build the Saturday run-sheet" },
        { id: "w19", name: "Seating plan", kind: "sheet", preview: { type: "seating", v: 2 }, state: "draft", who: "Mara", note: "Two tables still to settle", size: "58 KB", updated: "Yesterday", task: "Approve the final seating plan" },
        { id: "w20", name: "Ceremony layout", kind: "design", preview: { type: "plan", v: 2, label: "Ceremony" }, state: "ready", who: "Orla", note: "Aisle on the terrace, 80 chairs", size: "1.8 MB", updated: "19 Sep", task: "Plan the ceremony space" },
        { id: "w21", name: "Florist mood board", kind: "image", preview: { type: "photo", v: 2 }, state: "ready", who: "Mara", note: "Blush, sage, lots of greenery", size: "12 MB", updated: "15 Sep", task: "Brief the florist" },
        { id: "w22", name: "Supplier contacts", kind: "sheet", preview: { type: "sheet", v: 4 }, state: "ready", who: "Orla", note: "Nine suppliers, arrival windows", size: "16 KB", updated: "20 Sep", task: "Confirm supplier arrival times" },
        { id: "w23", name: "Terrace at golden hour", kind: "image", preview: { type: "photo", v: 0 }, state: "ready", who: "Orla", note: "For the photographer", size: "2.3 MB", updated: "14 Sep", task: "Share the terrace photos" },
      ],
    },
    {
      id: "w-day",
      title: "Wedding day",
      kitName: "the day",
      major: true,
      date: "2026-10-17",
      time: "1:00 pm ceremony",
      place: "The Orchard",
      tasks: 11,
      askName: "Finn",
      files: [
        { id: "w24", name: "Run-sheet, final", kind: "doc", preview: { type: "doc", label: "Run-sheet" }, state: "missing", who: "you", note: "Yours to finish after the walkthrough", task: "Build the Saturday run-sheet" },
        { id: "w25", name: "Speeches order", kind: "doc", preview: { type: "doc", label: "Speeches" }, state: "waiting", who: "Finn", note: "Waiting on Finn for the speeches order", size: "12 KB", updated: "20 Sep", task: "Confirm the speeches" },
        { id: "w26", name: "Emergency contacts", kind: "doc", preview: { type: "form" }, state: "ready", who: "Orla", note: "Venue, couple, both families", size: "9 KB", updated: "18 Sep", task: "Share emergency contacts" },
        { id: "w27", name: "Welcome sign artwork", kind: "image", preview: { type: "design", label: "Welcome", v: 1 }, state: "ready", who: "Mara", note: "A1, sage on cream", size: "1.1 MB", updated: "12 Sep", task: "Reprint the faded welcome sign" },
        { id: "w28", name: "Wet weather plan", kind: "doc", preview: { type: "plan", v: 3, label: "Plan B" }, state: "ready", who: "Orla", note: "Ceremony moves to the Barn", size: "210 KB", updated: "10 Sep", task: "Agree the wet weather plan" },
        { id: "w29", name: "Supplier arrival times", kind: "sheet", preview: { type: "sheet", v: 0 }, state: "ready", who: "Orla", note: "Florist 9 am, band 5 pm", size: "14 KB", updated: "20 Sep", task: "Confirm supplier arrival times" },
      ],
    },
    {
      id: "w-invoices",
      title: "Supplier invoices",
      kitName: "supplier invoices",
      date: "2026-10-23",
      tasks: 4,
      askName: "Hireco",
      files: [
        { id: "w30", name: "Hireco invoice", kind: "pdf", preview: { type: "invoice" }, state: "missing", who: "Hireco", note: "Expected from Hireco after the day", task: "Settle supplier invoices" },
        { id: "w31", name: "Florist invoice", kind: "pdf", preview: { type: "invoice", label: "Wildflower" }, state: "waiting", who: "Wildflower Co", note: "Waiting on Wildflower Co for the final count", size: "76 KB", updated: "21 Sep", task: "Settle supplier invoices" },
        { id: "w32", name: "Catering bill", kind: "sheet", preview: { type: "sheet", v: 2 }, state: "draft", who: "Dev", note: "Draft, settles after final numbers", size: "28 KB", updated: "23 Sep", task: "Settle supplier invoices" },
        { id: "w33", name: "Band invoice", kind: "pdf", preview: { type: "invoice" }, state: "missing", who: "The Harbour Band", note: "Expected from The Harbour Band", task: "Settle supplier invoices" },
      ],
    },
  ],
};

const ORCHARD: Project = {
  id: "orchard",
  name: "The Orchard, events",
  kind: "Venue",
  tone: 3,
  initials: "TO",
  anytime: [
    ...ORCHARD_REFERENCE,
    { id: "o-rota", name: "Staff rota template", kind: "sheet", preview: { type: "sheet", v: 4 }, state: "ready", who: "Orla", note: "Front of house and bar", size: "21 KB", updated: "1 Sep" },
    { id: "o-brand", name: "Orchard brand kit", kind: "design", preview: { type: "design", label: "Orchard", v: 2 }, state: "ready", who: "Orla", note: "Logo, apple green, signage type", size: "9.2 MB", updated: "3 Jun" },
  ],
  milestones: [
    {
      id: "o-open",
      title: "Autumn open day",
      kitName: "the open day",
      major: true,
      date: "2026-10-03",
      time: "10 am to 4 pm",
      tasks: 6,
      askName: "Aoife",
      files: [
        { id: "o1", name: "Open day run-sheet", kind: "doc", preview: { type: "doc", label: "Open day" }, state: "ready", who: "Orla", note: "Tours every half hour", size: "88 KB", updated: "22 Sep", task: "Plan the open day" },
        { id: "o2", name: "Signage artwork", kind: "image", preview: { type: "design", label: "Welcome", v: 2 }, state: "ready", who: "Aoife", note: "Six boards, one banner", size: "4.2 MB", updated: "18 Sep", task: "Reprint the faded welcome sign" },
        { id: "o3", name: "Canapé order", kind: "sheet", preview: { type: "sheet", v: 3 }, state: "draft", who: "Dev", note: "Numbers depend on sign-ups", size: "15 KB", updated: "Yesterday", task: "Order canapés" },
        { id: "o4", name: "Parking plan", kind: "pdf", preview: { type: "plan", v: 3, label: "Parking" }, state: "missing", who: "Aoife", note: "Expected from Aoife", task: "Plan overflow parking" },
      ],
    },
    {
      id: "o-fire",
      title: "Fire inspection",
      kitName: "the inspection",
      date: "2026-10-14",
      time: "9:30 am",
      tasks: 3,
      askName: "Declan",
      files: [
        { id: "o5", name: "Fire safety plan", kind: "pdf", preview: { type: "plan", v: 1, label: "Exits" }, state: "ready", who: "Declan", note: "Reviewed by the county", size: "2.4 MB", updated: "11 Mar", task: "Prepare for the inspection" },
        { id: "o6", name: "Extinguisher service record", kind: "pdf", preview: { type: "contract", label: "Certificate" }, state: "waiting", who: "Firecheck", note: "Waiting on Firecheck for the service certificate", size: "120 KB", updated: "9 Sep", task: "Book the extinguisher service" },
        { id: "o7", name: "Evacuation drill log", kind: "sheet", preview: { type: "form" }, state: "missing", who: "Declan", note: "Expected from Declan", task: "Run a staff evacuation drill" },
      ],
    },
    {
      id: "o-xmas",
      title: "Christmas menus to print",
      kitName: "the Christmas menus",
      date: "2026-10-30",
      tasks: 2,
      files: [
        { id: "o8", name: "Christmas party menu", kind: "pdf", preview: { type: "menu", label: "Christmas" }, state: "draft", who: "Dev", note: "Dev is testing the pudding", size: "180 KB", updated: "21 Sep", task: "Write the Christmas menus" },
        { id: "o9", name: "Menu photography", kind: "image", preview: { type: "photo", v: 1 }, state: "ready", who: "Orla", note: "Shot in the Barn kitchen", size: "18 MB", updated: "17 Sep", task: "Write the Christmas menus" },
      ],
    },
  ],
};

const SCHOOL: Project = {
  id: "trip",
  name: "St Brigid's Year 6 trip",
  kind: "School",
  tone: 2,
  initials: "SB",
  anytime: [
    { id: "s-policy", name: "School trips policy", kind: "pdf", preview: { type: "doc", label: "Policy" }, state: "ready", who: "Ms Keane", note: "Board approved, 2025", size: "310 KB", updated: "Jan" },
    { id: "s-letter", name: "Parent letter template", kind: "doc", preview: { type: "doc", label: "Dear parents" }, state: "ready", who: "Ms Keane", note: "Plain, friendly, one page", size: "24 KB", updated: "Aug" },
  ],
  milestones: [
    {
      id: "s-slips",
      title: "Permission slips",
      kitName: "the permission slips",
      date: "2026-10-02",
      tasks: 2,
      askName: "the parents",
      files: [
        { id: "s1", name: "Permission slip form", kind: "pdf", preview: { type: "form" }, state: "ready", who: "Ms Keane", note: "Sent home in bags on Monday", size: "58 KB", updated: "21 Sep", task: "Send permission slips home" },
        { id: "s2", name: "Returned slips", kind: "sheet", preview: { type: "sheet", v: 1 }, state: "draft", who: "Ms Keane", note: "24 of 28 back", size: "11 KB", updated: "Today", task: "Chase the last four slips" },
        { id: "s3", name: "Medical forms", kind: "pdf", preview: { type: "form" }, state: "missing", who: "the parents", note: "Expected from the parents", task: "Collect medical forms" },
      ],
    },
    {
      id: "s-bus",
      title: "Bus booking",
      kitName: "the bus booking",
      date: "2026-10-07",
      tasks: 2,
      askName: "Galway Coaches",
      files: [
        { id: "s4", name: "Coach quote", kind: "pdf", preview: { type: "invoice", label: "Coaches" }, state: "waiting", who: "Galway Coaches", note: "Waiting on Galway Coaches for the booking confirmation", size: "70 KB", updated: "19 Sep", task: "Book the bus" },
        { id: "s5", name: "Bus seating list", kind: "sheet", preview: { type: "seating", v: 3 }, state: "draft", who: "Ms Keane", note: "Buddies paired, two to finish", size: "9 KB", updated: "23 Sep", task: "Pair travel buddies" },
      ],
    },
    {
      id: "s-risk",
      title: "Risk assessment",
      kitName: "the risk assessment",
      date: "2026-10-12",
      tasks: 3,
      askName: "the aquarium",
      files: [
        { id: "s6", name: "Risk assessment", kind: "doc", preview: { type: "doc", label: "Risk" }, state: "draft", who: "Ms Keane", note: "Waiting for the principal to read", size: "96 KB", updated: "22 Sep", task: "Write the risk assessment" },
        { id: "s7", name: "Venue risk statement", kind: "pdf", preview: { type: "contract", label: "Aquarium" }, state: "missing", who: "the aquarium", note: "Expected from the aquarium", task: "Request the venue statement" },
        { id: "s8", name: "First aid certificate", kind: "pdf", preview: { type: "contract", label: "First aid" }, state: "ready", who: "Mr Daly", note: "Valid to June 2027", size: "140 KB", updated: "Jun", task: "Confirm a first aider" },
      ],
    },
    {
      id: "s-trip",
      title: "Trip day",
      kitName: "trip day",
      major: true,
      date: "2026-10-22",
      time: "8:15 am at the gate",
      tasks: 5,
      files: [
        { id: "s9", name: "Itinerary", kind: "doc", preview: { type: "doc", label: "Itinerary" }, state: "ready", who: "Ms Keane", note: "Back by 3:30 pm", size: "32 KB", updated: "20 Sep", task: "Plan the day" },
        { id: "s10", name: "Emergency contacts", kind: "sheet", preview: { type: "form" }, state: "ready", who: "Ms Keane", note: "28 families", size: "10 KB", updated: "21 Sep", task: "Collect medical forms" },
        { id: "s11", name: "Packing list for pupils", kind: "doc", preview: { type: "form" }, state: "ready", who: "Ms Keane", note: "Lunch, rain jacket, no phones", size: "8 KB", updated: "18 Sep", task: "Send the packing list" },
      ],
    },
  ],
};

const KILN: Project = {
  id: "kiln",
  name: "Kiln & Co rebrand",
  kind: "Agency",
  tone: 6,
  initials: "KC",
  anytime: [
    { id: "k-brief", name: "Rebrand brief", kind: "doc", preview: { type: "doc", label: "Brief" }, state: "ready", who: "Sam", note: "Signed off by Kiln & Co", size: "54 KB", updated: "Aug" },
    { id: "k-old", name: "Current brand guidelines", kind: "pdf", preview: { type: "slides", v: 1 }, state: "ready", who: "Kiln & Co", note: "For reference only", size: "22 MB", updated: "2021" },
  ],
  milestones: [
    {
      id: "k-review",
      title: "Client review",
      kitName: "the client review",
      major: true,
      date: "2026-09-30",
      time: "3:00 pm, video call",
      tasks: 4,
      askName: "the printer",
      files: [
        { id: "k1", name: "Logo routes", kind: "slides", preview: { type: "slides", v: 0, label: "Kiln" }, state: "ready", who: "Sam", note: "Three routes, one recommended", size: "14 MB", updated: "24 Sep", task: "Prepare logo routes" },
        { id: "k2", name: "Colour palette", kind: "design", preview: { type: "design", label: "Kiln", v: 3 }, state: "ready", who: "Sam", note: "Clay, ash, glaze blue", size: "2 MB", updated: "23 Sep", task: "Prepare logo routes" },
        { id: "k3", name: "Type specimen", kind: "design", preview: { type: "doc", label: "Aa" }, state: "draft", who: "Priya", note: "Pairing still in question", size: "1.4 MB", updated: "Today", task: "Choose the typefaces" },
        { id: "k4", name: "Packaging mock-ups", kind: "image", preview: { type: "photo", v: 4 }, state: "waiting", who: "the printer", note: "Waiting on the printer for proofs", size: "—", updated: "22 Sep", task: "Order packaging proofs" },
      ],
    },
    {
      id: "k-print",
      title: "Print handover",
      kitName: "the print handover",
      date: "2026-10-13",
      tasks: 2,
      askName: "Priya",
      files: [
        { id: "k5", name: "Print-ready artwork", kind: "pdf", preview: { type: "design", label: "Print", v: 3 }, state: "missing", who: "Priya", note: "Expected from Priya after the review", task: "Export print files" },
        { id: "k6", name: "Paper stock choice", kind: "doc", preview: { type: "doc", label: "Paper" }, state: "ready", who: "Sam", note: "Uncoated, 350 gsm", size: "20 KB", updated: "20 Sep", task: "Choose the paper" },
      ],
    },
  ],
};

const SUPPER: Project = {
  id: "supper",
  name: "Harvest supper club",
  kind: "Event idea",
  tone: 5,
  initials: "HS",
  undated: 4,
  anytime: [
    { id: "h1", name: "Supper club idea", kind: "doc", preview: { type: "doc", label: "Idea" }, state: "draft", who: "Orla", note: "Long table, one menu, forty seats", size: "18 KB", updated: "Today" },
    { id: "h2", name: "Long table sketch", kind: "image", preview: { type: "seating", v: 3 }, state: "draft", who: "Orla", note: "Down the middle of the Barn", size: "1.3 MB", updated: "Yesterday" },
    { id: "h3", name: "Harvest menu ideas", kind: "doc", preview: { type: "menu", label: "Harvest" }, state: "draft", who: "Dev", note: "Squash, apples, cider", size: "22 KB", updated: "22 Sep" },
    { id: "h4", name: "Orchard in September", kind: "image", preview: { type: "photo", v: 0 }, state: "ready", who: "Orla", note: "For the invitation", size: "3.9 MB", updated: "15 Sep" },
  ],
  milestones: [],
};

export const PROJECTS: Project[] = [WEDDING, ORCHARD, SCHOOL, KILN, SUPPER];
