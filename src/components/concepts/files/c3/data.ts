/**
 * Sample data for the "What changed" Files concept. Everything here is
 * invented: three weeks of file changes across four projects. Times are
 * plain strings ("YYYY-MM-DD HH:MM") so ordering and day labels are
 * deterministic on the server and in the browser.
 */

export const NOW = "2026-09-25 17:05";
export const LAST_VISIT = "2026-09-22 16:20";

/* ── people ─────────────────────────────────────────────────────── */

export type PersonId = "orla" | "dev" | "niamh" | "mara" | "finn" | "hireco";

export type Person = {
  id: PersonId;
  name: string;
  full: string;
  role: string;
  initials: string;
  /** --v3-project-N used for the avatar ground. */
  tone: number;
  client?: boolean;
  org?: boolean;
};

export const PEOPLE: Record<PersonId, Person> = {
  orla: { id: "orla", name: "Orla", full: "Orla Keane", role: "Venue manager", initials: "OK", tone: 3 },
  dev: { id: "dev", name: "Dev", full: "Dev Mistry", role: "Events coordinator", initials: "DM", tone: 2 },
  niamh: { id: "niamh", name: "Niamh", full: "Niamh Byrne", role: "Designer", initials: "NB", tone: 8 },
  mara: { id: "mara", name: "Mara", full: "Mara Quinn", role: "Client, Mara & Finn wedding", initials: "MQ", tone: 5, client: true },
  finn: { id: "finn", name: "Finn", full: "Finn Doyle", role: "Client, Mara & Finn wedding", initials: "FD", tone: 4, client: true },
  hireco: { id: "hireco", name: "Hireco", full: "Hireco Marquees", role: "Supplier", initials: "H", tone: 0, org: true },
};

export const PEOPLE_ORDER: PersonId[] = ["orla", "dev", "niamh", "mara", "finn", "hireco"];

/* ── projects ───────────────────────────────────────────────────── */

export type ProjectId = "orchard" | "wedding" | "bakery" | "kiln";

export type Project = { id: ProjectId; name: string; tone: number };

export const PROJECTS: Record<ProjectId, Project> = {
  orchard: { id: "orchard", name: "The Orchard", tone: 7 },
  wedding: { id: "wedding", name: "Mara & Finn wedding", tone: 1 },
  bakery: { id: "bakery", name: "Harbour Bakery launch", tone: 5 },
  kiln: { id: "kiln", name: "Kiln & Co rebrand", tone: 3 },
};

export const PROJECT_ORDER: ProjectId[] = ["wedding", "orchard", "bakery", "kiln"];

/* ── files and versions ─────────────────────────────────────────── */

export type Kind = "pdf" | "doc" | "sheet" | "image" | "link" | "design" | "folder";

export type Version = { id: string; label: string; at: string; by: PersonId; note: string };

export type FileRec = {
  id: string;
  name: string;
  kind: Kind;
  project: ProjectId;
  source: "Upload" | "Google Drive" | "Link";
  tasks: string[];
  versions: Version[];
};

export const FILES: Record<string, FileRec> = {
  seating: {
    id: "seating",
    name: "Seating plan",
    kind: "sheet",
    project: "wedding",
    source: "Google Drive",
    tasks: ["Approve the final seating plan", "Send place cards to print"],
    versions: [
      { id: "seating-1", label: "v1", at: "2026-09-10 20:14", by: "mara", note: "Started: 138 guests across 8 tables" },
      { id: "seating-2", label: "v2", at: "2026-09-18 11:02", by: "orla", note: "Added table 9 by the orchard doors" },
      { id: "seating-3", label: "v3", at: "2026-09-25 16:45", by: "mara", note: "40 edits: 4 guests moved, 1 added" },
    ],
  },
  vows: {
    id: "vows",
    name: "Vows and readings",
    kind: "doc",
    project: "wedding",
    source: "Google Drive",
    tasks: ["Confirm the ceremony order with the celebrant"],
    versions: [{ id: "vows-1", label: "Draft", at: "2026-09-20 21:40", by: "mara", note: "Two readings and the vows" }],
  },
  marquee: {
    id: "marquee",
    name: "Marquee quote, Hireco",
    kind: "pdf",
    project: "wedding",
    source: "Upload",
    tasks: ["Confirm marquee sides with the hire company", "Pay the marquee deposit", "Book the rigging crew"],
    versions: [
      { id: "marquee-1", label: "v1", at: "2026-09-08 09:30", by: "hireco", note: "First quote: €4,600 for three days" },
      { id: "marquee-2", label: "v2", at: "2026-09-15 14:10", by: "hireco", note: "Down to €4,200 after dropping the dance floor" },
      { id: "marquee-3", label: "v3", at: "2026-09-24 10:05", by: "hireco", note: "Down to €3,850: cheaper sides and rigging" },
    ],
  },
  welcome: {
    id: "welcome",
    name: "Welcome sign artwork",
    kind: "image",
    project: "wedding",
    source: "Upload",
    tasks: ["Reprint the welcome sign", "Approve the stationery set"],
    versions: [
      { id: "welcome-1", label: "v1", at: "2026-09-16 15:20", by: "niamh", note: "First draft on cream card" },
      { id: "welcome-2", label: "v2", at: "2026-09-24 18:30", by: "niamh", note: "Orchard green, date added, signed off by Mara" },
    ],
  },
  runsheet: {
    id: "runsheet",
    name: "Run-sheet, Saturday",
    kind: "doc",
    project: "wedding",
    source: "Upload",
    tasks: ["Build the Saturday run-sheet", "Brief the bar staff"],
    versions: [
      { id: "runsheet-5", label: "v5", at: "2026-09-17 17:45", by: "dev", note: "Timings agreed with the band" },
      { id: "runsheet-6", label: "v6", at: "2026-09-23 12:40", by: "dev", note: "Speeches before dinner, photos 15 minutes earlier" },
    ],
  },
  selects: {
    id: "selects",
    name: "Photo shoot selects",
    kind: "folder",
    project: "bakery",
    source: "Upload",
    tasks: ["Choose menu photography", "Brief the printer"],
    versions: [{ id: "selects-1", label: "14 photos", at: "2026-09-23 09:15", by: "niamh", note: "14 photos, 3 starred for the menu" }],
  },
  sides: {
    id: "sides",
    name: "Marquee sides spec",
    kind: "link",
    project: "orchard",
    source: "Link",
    tasks: ["Confirm marquee sides with the hire company"],
    versions: [{ id: "sides-1", label: "Link", at: "2026-09-23 16:00", by: "orla", note: "Clear and solid sides, sizes and weights" }],
  },
  bar: {
    id: "bar",
    name: "Bar order",
    kind: "sheet",
    project: "orchard",
    source: "Google Drive",
    tasks: ["Order tonic and the good olives"],
    versions: [
      { id: "bar-1", label: "v1", at: "2026-09-14 12:30", by: "orla", note: "More tonic and olives" },
      { id: "bar-2", label: "v2", at: "2026-09-22 15:52", by: "dev", note: "Renamed from Bar order, July" },
    ],
  },
  menu: {
    id: "menu",
    name: "Launch menu",
    kind: "pdf",
    project: "bakery",
    source: "Upload",
    tasks: ["Price the launch menu", "Brief the printer"],
    versions: [
      { id: "menu-1", label: "v1", at: "2026-09-11 10:20", by: "niamh", note: "18 items, first pass" },
      { id: "menu-2", label: "v2", at: "2026-09-21 09:40", by: "niamh", note: "Three prices up after the flour order" },
    ],
  },
  rota: {
    id: "rota",
    name: "Staff rota, September",
    kind: "sheet",
    project: "orchard",
    source: "Google Drive",
    tasks: ["Staff the wedding weekend"],
    versions: [{ id: "rota-1", label: "v1", at: "2026-09-19 08:50", by: "orla", note: "Saturday shifts swapped" }],
  },
  logo: {
    id: "logo",
    name: "Kiln & Co logo",
    kind: "design",
    project: "kiln",
    source: "Upload",
    tasks: ["Sign off the new mark", "Prepare the signage files"],
    versions: [
      { id: "logo-4", label: "v4", at: "2026-09-14 16:05", by: "niamh", note: "Outlined arch, serif wordmark" },
      { id: "logo-5", label: "v5", at: "2026-09-17 11:30", by: "niamh", note: "Solid arch with a flame, heavier wordmark" },
    ],
  },
  guidelines: {
    id: "guidelines",
    name: "Kiln & Co brand guidelines",
    kind: "doc",
    project: "kiln",
    source: "Google Drive",
    tasks: ["Write the brand guidelines"],
    versions: [{ id: "guidelines-1", label: "Draft", at: "2026-09-09 15:00", by: "niamh", note: "Six sections, colour and type first" }],
  },
  deposit: {
    id: "deposit",
    name: "Deposit invoice, Mara & Finn",
    kind: "pdf",
    project: "wedding",
    source: "Upload",
    tasks: ["Deposit invoice settled, Mara & Finn"],
    versions: [{ id: "deposit-1", label: "v1", at: "2026-09-07 10:10", by: "orla", note: "€1,500 deposit, due 1 October" }],
  },
};

/** Files the viewer follows, in the order they were followed. */
export const INITIAL_FOLLOWING = ["seating", "marquee", "runsheet", "logo"];

/** Versions already marked as the one before this visit. */
export const INITIAL_FINALS: Record<string, string> = { welcome: "welcome-2" };

/* ── diffs ──────────────────────────────────────────────────────── */

export type Money = { from?: number; to?: number };

export type Diff =
  | { type: "price"; rows: ({ label: string } & Money)[]; total: Money; fromLabel: string; toLabel: string }
  | {
      type: "seating";
      moves: { guest: string; from: number; to: number }[];
      notes: string[];
      noisy?: { edits: number; span: string; ticks: number[]; bursts: { when: string; count: number; text: string }[] };
    }
  | { type: "text"; lines: { k: " " | "+" | "-" | "fold"; t: string; n?: number }[]; fromLabel: string; toLabel: string }
  | { type: "wipe"; art: "welcome" | "logo"; fromLabel: string; toLabel: string }
  | { type: "art"; art: "welcome" | "logo"; variant: 1 | 2; caption: string }
  | { type: "comments"; quote: string; comments: { by: PersonId; at: string; text: string }[] }
  | { type: "link"; domain: string; title: string; description: string; url: string }
  | { type: "photos"; count: number; starred: number[] }
  | { type: "sheet"; columns: string[]; rows: (string | { from: string; to: string })[][] }
  | { type: "rename"; from: string; to: string }
  | { type: "facts"; facts: { label: string; value: string }[]; note: string }
  | { type: "outline"; headings: { title: string; pages: string }[] }
  | { type: "tables"; guests: number; tables: number };

/* ── feed events ────────────────────────────────────────────────── */

/** A sentence is plain text with person and file references woven in. */
export type Segment = string | { p: PersonId } | { f: string; label?: string };

export type Verb = "changed" | "new" | "signed" | "comment" | "renamed";

export type FeedEvent = {
  id: string;
  at: string;
  actor: PersonId;
  file: string;
  version?: string;
  verb: Verb;
  sentence: Segment[];
  /** A one-line version of the change for the digest and ghost rows. */
  gist: string;
  diff: Diff;
};

export const EVENTS: FeedEvent[] = [
  {
    id: "e-seating-noisy",
    at: "2026-09-25 16:45",
    actor: "mara",
    file: "seating",
    version: "seating-3",
    verb: "changed",
    sentence: [{ p: "mara" }, " edited the ", { f: "seating", label: "seating plan" }, " 40 times this afternoon. In the end, 4 guests moved and 1 was added."],
    gist: "Mara moved 4 guests on the seating plan",
    diff: {
      type: "seating",
      moves: [
        { guest: "Aunt Clare", from: 3, to: 6 },
        { guest: "Uncle Pat", from: 3, to: 6 },
        { guest: "Siobhán Walsh", from: 6, to: 3 },
        { guest: "Tom Byrne", from: 9, to: 2 },
      ],
      notes: ["Added Rosa Quinn to table 1", "Renamed table 9 to Family"],
      noisy: {
        edits: 40,
        span: "13:10 to 16:45",
        ticks: [
          0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 16, 18, 20, 22, 55, 58, 60, 62, 64, 66, 69, 70, 71, 150, 153, 156, 160, 163, 167, 170, 174, 178,
          181, 185, 190, 196, 200, 204, 209, 215,
        ],
        bursts: [
          { when: "13:10 to 13:32", count: 14, text: "Moved Aunt Clare and Uncle Pat from table 3 to table 6" },
          { when: "14:05 to 14:21", count: 9, text: "Tried Tom Byrne at three tables, settled on table 2" },
          { when: "15:40 to 16:45", count: 17, text: "Swapped Siobhán Walsh to table 3, added Rosa Quinn, renamed table 9" },
        ],
      },
    },
  },
  {
    id: "e-vows-comments",
    at: "2026-09-25 11:20",
    actor: "finn",
    file: "vows",
    verb: "comment",
    sentence: [{ p: "finn" }, " left 2 comments on ", { f: "vows", label: "Vows and readings" }, ". Both are about the second reading."],
    gist: "Finn left 2 comments on Vows and readings",
    diff: {
      type: "comments",
      quote: "Second reading: an extract from Late Fragment, read by Aunt Clare",
      comments: [
        { by: "finn", at: "11:18", text: "Could Rosa read this one instead? Clare is already doing the toast." },
        { by: "finn", at: "11:20", text: "And can we keep it under two minutes. The light goes fast out there." },
      ],
    },
  },
  {
    id: "e-welcome-signed",
    at: "2026-09-24 18:30",
    actor: "mara",
    file: "welcome",
    version: "welcome-2",
    verb: "signed",
    sentence: [{ p: "mara" }, " signed off the ", { f: "welcome", label: "welcome sign artwork" }, ". Version 2 moves to orchard green and adds the date."],
    gist: "Mara signed off the welcome sign",
    diff: { type: "wipe", art: "welcome", fromLabel: "v1", toLabel: "v2" },
  },
  {
    id: "e-marquee-3",
    at: "2026-09-24 10:05",
    actor: "hireco",
    file: "marquee",
    version: "marquee-3",
    verb: "changed",
    sentence: [{ p: "hireco" }, " sent a revised ", { f: "marquee", label: "marquee quote" }, ". The total dropped €350 on cheaper sides and rigging."],
    gist: "The marquee quote dropped €350",
    diff: {
      type: "price",
      fromLabel: "v2",
      toLabel: "v3",
      rows: [
        { label: "Marquee, 12 × 24 m, three days", from: 2900, to: 2900 },
        { label: "Clear sides, six panels", from: 650, to: 420 },
        { label: "Delivery and rigging", from: 650, to: 530 },
      ],
      total: { from: 4200, to: 3850 },
    },
  },
  {
    id: "e-sides-link",
    at: "2026-09-23 16:00",
    actor: "orla",
    file: "sides",
    version: "sides-1",
    verb: "new",
    sentence: [{ p: "orla" }, " added the ", { f: "sides", label: "marquee sides spec" }, " from Hireco, so the clear panels can be checked against the terrace."],
    gist: "Orla added the marquee sides spec",
    diff: {
      type: "link",
      domain: "hireco.ie",
      url: "hireco.ie/marquees/sides",
      title: "Marquee sides: clear, solid and window panels",
      description: "Panel sizes, weights and fixing points for 6 m and 12 m frames. Clear PVC panels come in 3 m widths.",
    },
  },
  {
    id: "e-runsheet-6",
    at: "2026-09-23 12:40",
    actor: "dev",
    file: "runsheet",
    version: "runsheet-6",
    verb: "changed",
    sentence: [{ p: "dev" }, " moved the speeches before dinner on the ", { f: "runsheet", label: "Saturday run-sheet" }, " and brought photos forward 15 minutes."],
    gist: "Speeches now come before dinner",
    diff: {
      type: "text",
      fromLabel: "v5",
      toLabel: "v6",
      lines: [
        { k: "fold", t: "", n: 6 },
        { k: " ", t: "14:00  Ceremony on the orchard lawn" },
        { k: " ", t: "14:40  Drinks reception on the terrace" },
        { k: "-", t: "15:30  Photos in the walled garden" },
        { k: "+", t: "15:15  Photos in the walled garden, before the light drops" },
        { k: " ", t: "16:30  Guests seated for dinner" },
        { k: "+", t: "16:40  Speeches: father of the bride, Finn, Aunt Clare" },
        { k: " ", t: "17:00  Dinner served" },
        { k: "-", t: "18:15  Speeches after the main course" },
        { k: "fold", t: "", n: 9 },
      ],
    },
  },
  {
    id: "e-selects",
    at: "2026-09-23 09:15",
    actor: "niamh",
    file: "selects",
    version: "selects-1",
    verb: "new",
    sentence: [{ p: "niamh" }, " added 14 ", { f: "selects", label: "photo shoot selects" }, " and starred 3 for the menu cover."],
    gist: "Niamh added 14 photo selects",
    diff: { type: "photos", count: 14, starred: [0, 2, 3] },
  },
  /* ── before the last visit ── */
  {
    id: "e-bar-rename",
    at: "2026-09-22 15:52",
    actor: "dev",
    file: "bar",
    version: "bar-2",
    verb: "renamed",
    sentence: [{ p: "dev" }, " renamed ", { f: "bar", label: "Bar order" }, ". It now covers the whole season, not only July."],
    gist: "Dev renamed Bar order",
    diff: { type: "rename", from: "Bar order, July", to: "Bar order" },
  },
  {
    id: "e-menu-2",
    at: "2026-09-21 09:40",
    actor: "niamh",
    file: "menu",
    version: "menu-2",
    verb: "changed",
    sentence: [{ p: "niamh" }, " raised three prices on the ", { f: "menu", label: "launch menu" }, " after the new flour order."],
    gist: "Three prices went up on the launch menu",
    diff: {
      type: "price",
      fromLabel: "v1",
      toLabel: "v2",
      rows: [
        { label: "Sourdough loaf", from: 5.5, to: 6 },
        { label: "Cardamom bun", from: 3.8, to: 4.2 },
        { label: "Seeded rye", from: 6.2, to: 6.8 },
      ],
      total: {},
    },
  },
  {
    id: "e-rota",
    at: "2026-09-19 08:50",
    actor: "orla",
    file: "rota",
    version: "rota-1",
    verb: "changed",
    sentence: [{ p: "orla" }, " swapped two Saturday shifts on the ", { f: "rota", label: "September rota" }, ", so the wedding bar has three people from 16:00."],
    gist: "Orla swapped Saturday shifts",
    diff: {
      type: "sheet",
      columns: ["Name", "Sat 26", "Sun 27"],
      rows: [
        ["Aoife", { from: "Off", to: "16:00 to 00:00" }, "Off"],
        ["Cian", "12:00 to 20:00", "12:00 to 20:00"],
        ["Leah", { from: "16:00 to 00:00", to: "Off" }, { from: "Off", to: "10:00 to 16:00" }],
      ],
    },
  },
  {
    id: "e-seating-2",
    at: "2026-09-18 11:02",
    actor: "orla",
    file: "seating",
    version: "seating-2",
    verb: "changed",
    sentence: [{ p: "orla" }, " added table 9 by the orchard doors on the ", { f: "seating", label: "seating plan" }, " and moved 8 guests onto it."],
    gist: "Orla added table 9",
    diff: {
      type: "seating",
      moves: [
        { guest: "Tom Byrne", from: 4, to: 9 },
        { guest: "Gráinne Byrne", from: 4, to: 9 },
        { guest: "Uncle Pat", from: 5, to: 3 },
      ],
      notes: ["5 more guests moved from tables 7 and 8 to table 9"],
    },
  },
  {
    id: "e-logo-5",
    at: "2026-09-17 11:30",
    actor: "niamh",
    file: "logo",
    version: "logo-5",
    verb: "changed",
    sentence: [{ p: "niamh" }, " uploaded ", { f: "logo", label: "Kiln & Co logo v5" }, ". The arch is solid now, with a flame cut through it."],
    gist: "Kiln & Co logo went from v4 to v5",
    diff: { type: "wipe", art: "logo", fromLabel: "v4", toLabel: "v5" },
  },
  {
    id: "e-welcome-1",
    at: "2026-09-16 15:20",
    actor: "niamh",
    file: "welcome",
    version: "welcome-1",
    verb: "new",
    sentence: [{ p: "niamh" }, " drafted the ", { f: "welcome", label: "welcome sign" }, " on cream card for Mara and Finn to react to."],
    gist: "Niamh drafted the welcome sign",
    diff: { type: "art", art: "welcome", variant: 1, caption: "A1 portrait, cream card, sage sprigs" },
  },
  {
    id: "e-marquee-2",
    at: "2026-09-15 14:10",
    actor: "hireco",
    file: "marquee",
    version: "marquee-2",
    verb: "changed",
    sentence: [{ p: "hireco" }, " took the dance floor off the ", { f: "marquee", label: "marquee quote" }, ". The total fell €400."],
    gist: "The marquee quote fell €400",
    diff: {
      type: "price",
      fromLabel: "v1",
      toLabel: "v2",
      rows: [
        { label: "Marquee, 12 × 24 m, three days", from: 2900, to: 2900 },
        { label: "Dance floor, 6 × 6 m", from: 400 },
      ],
      total: { from: 4600, to: 4200 },
    },
  },
  {
    id: "e-bar-1",
    at: "2026-09-14 12:30",
    actor: "orla",
    file: "bar",
    version: "bar-1",
    verb: "changed",
    sentence: [{ p: "orla" }, " raised the tonic and olives on the ", { f: "bar", label: "bar order" }, " after the tasting."],
    gist: "More tonic and olives on the bar order",
    diff: {
      type: "sheet",
      columns: ["Item", "Quantity", "Supplier"],
      rows: [
        ["Tonic, 200 ml", { from: "48", to: "72" }, "Fever-Tree"],
        ["Gordal olives", { from: "4 kg", to: "6 kg" }, "Sheridans"],
        ["Lemons", "60", "Market"],
      ],
    },
  },
  {
    id: "e-menu-1",
    at: "2026-09-11 10:20",
    actor: "niamh",
    file: "menu",
    version: "menu-1",
    verb: "new",
    sentence: [{ p: "niamh" }, " shared the first ", { f: "menu", label: "launch menu" }, ": 18 items across bread, pastry and coffee."],
    gist: "Niamh shared the launch menu",
    diff: {
      type: "facts",
      note: "Read from the PDF",
      facts: [
        { label: "Items", value: "18" },
        { label: "Cheapest", value: "€3.20, espresso" },
        { label: "Dearest", value: "€6.20, seeded rye" },
        { label: "Pages", value: "2, A4" },
      ],
    },
  },
  {
    id: "e-seating-1",
    at: "2026-09-10 20:14",
    actor: "mara",
    file: "seating",
    version: "seating-1",
    verb: "new",
    sentence: [{ p: "mara" }, " started the ", { f: "seating", label: "seating plan" }, " in Google Drive with every confirmed guest."],
    gist: "Mara started the seating plan",
    diff: { type: "tables", guests: 138, tables: 8 },
  },
  {
    id: "e-guidelines",
    at: "2026-09-09 15:00",
    actor: "niamh",
    file: "guidelines",
    version: "guidelines-1",
    verb: "new",
    sentence: [{ p: "niamh" }, " drafted the ", { f: "guidelines", label: "Kiln & Co brand guidelines" }, ". Colour and type are done, voice is still a stub."],
    gist: "Niamh drafted the brand guidelines",
    diff: {
      type: "outline",
      headings: [
        { title: "The mark and its clear space", pages: "1 to 3" },
        { title: "Colour: clay, ash and kiln white", pages: "4 to 5" },
        { title: "Type: Fraunces and Inter", pages: "6 to 7" },
        { title: "Voice (stub)", pages: "8" },
      ],
    },
  },
  {
    id: "e-marquee-1",
    at: "2026-09-08 09:30",
    actor: "hireco",
    file: "marquee",
    version: "marquee-1",
    verb: "new",
    sentence: [{ p: "hireco" }, " sent the first ", { f: "marquee", label: "marquee quote" }, ": €4,600 for three days, including a dance floor."],
    gist: "Hireco sent the first marquee quote",
    diff: {
      type: "facts",
      note: "Read from the PDF",
      facts: [
        { label: "Total", value: "€4,600" },
        { label: "Hire", value: "Fri 25 to Sun 27 Sep" },
        { label: "Deposit", value: "30% on booking" },
        { label: "Valid until", value: "30 Sep" },
      ],
    },
  },
  {
    id: "e-deposit",
    at: "2026-09-07 10:10",
    actor: "orla",
    file: "deposit",
    version: "deposit-1",
    verb: "new",
    sentence: [{ p: "orla" }, " raised the ", { f: "deposit", label: "deposit invoice" }, " for Mara and Finn."],
    gist: "Orla raised the deposit invoice",
    diff: {
      type: "facts",
      note: "Read from the PDF",
      facts: [
        { label: "Amount", value: "€1,500" },
        { label: "Due", value: "1 October" },
        { label: "Status", value: "Paid on 16 Sep" },
      ],
    },
  },
];

/** Two copies of the same plan that disagree. */
export const CONFLICT = {
  file: "seating",
  a: { label: "Google Drive", name: "Seating plan", by: "mara" as PersonId, when: "today 16:45", guests: 139, detail: "Live, 40 edits today" },
  b: { label: "Uploaded copy", name: "Seating plan final.xlsx", by: "orla" as PersonId, when: "Wed 09:02", guests: 138, detail: "A copy of v2, attached to Send place cards to print" },
  differences: [
    { guest: "Aunt Clare", drive: "Table 6", upload: "Table 3" },
    { guest: "Uncle Pat", drive: "Table 6", upload: "Table 3" },
    { guest: "Tom Byrne", drive: "Table 2", upload: "Table 9" },
    { guest: "Rosa Quinn", drive: "Table 1", upload: "Not listed" },
  ],
};

/* ── time helpers ───────────────────────────────────────────────── */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(at: string) {
  const [d, t] = at.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day, time: t, date: d };
}

function weekday(at: string) {
  const { y, m, day } = parts(at);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
}

function dayNumber(at: string) {
  const { y, m, day } = parts(at);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}

export function dayKey(at: string) {
  return parts(at).date;
}

export function timeOf(at: string) {
  return parts(at).time;
}

/** Relative day, as a person would say it: Today, Yesterday, Tuesday, Last Friday. */
export function dayLabel(at: string) {
  const diff = dayNumber(NOW) - dayNumber(at);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return weekday(at);
  if (diff < 14) return `Last ${weekday(at)}`;
  return weekday(at);
}

/** The muted date that always follows the day label. */
export function dayDetail(at: string) {
  const { day, m } = parts(at);
  const diff = dayNumber(NOW) - dayNumber(at);
  return `${diff < 2 ? `${weekday(at)} ` : ""}${day} ${MONTHS[m - 1]}`;
}

/** Short "when": 16:45 today, Thu 10:05, 14 Sep. */
export function shortWhen(at: string) {
  const diff = dayNumber(NOW) - dayNumber(at);
  const { day, m, time } = parts(at);
  if (diff === 0) return time;
  if (diff === 1) return `Yesterday ${time}`;
  if (diff < 7) return `${weekday(at).slice(0, 3)} ${time}`;
  return `${day} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Lower-case "when" for use inside a sentence: today 16:45, yesterday 18:30, Wed 10:05, 14 Sep. */
export function whenPhrase(at: string) {
  const diff = dayNumber(NOW) - dayNumber(at);
  const { time } = parts(at);
  if (diff === 0) return `today ${time}`;
  if (diff === 1) return `yesterday ${time}`;
  return shortWhen(at);
}

/** A stable name for a version: "v3 · today 16:45". */
export function versionName(v: Version) {
  return /^v\d/.test(v.label) ? `${v.label} · ${whenPhrase(v.at)}` : whenPhrase(v.at);
}

export function euro(n: number) {
  const whole = Number.isInteger(n);
  return `€${n.toLocaleString("en-IE", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function sentenceText(s: Segment[]) {
  return s
    .map((seg) => (typeof seg === "string" ? seg : "p" in seg ? PEOPLE[seg.p].name : (seg.label ?? FILES[seg.f].name)))
    .join("");
}
