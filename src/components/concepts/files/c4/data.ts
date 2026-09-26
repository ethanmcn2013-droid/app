/*
 * Sample data for the moodwall concept. Invented, front-end only.
 * Every picture is drawn in art.tsx from a scene key plus a variant, so the
 * wall carries real colour without shipping photographs.
 */

export type ToneId =
  | "candle"
  | "ivory"
  | "sage"
  | "blush"
  | "slate"
  | "night"
  | "terracotta"
  | "crust"
  | "sea"
  | "charcoal"
  | "moss"
  | "sky";

export const TONES: Record<ToneId, { name: string; hex: string }> = {
  candle: { name: "Candlelight", hex: "#E3A857" },
  ivory: { name: "Ivory linen", hex: "#EDE4D3" },
  sage: { name: "Eucalyptus", hex: "#8FA68A" },
  blush: { name: "Peony blush", hex: "#E3A6A4" },
  slate: { name: "Slate", hex: "#3F4A52" },
  night: { name: "Barn at night", hex: "#1D2742" },
  terracotta: { name: "Terracotta", hex: "#C2623E" },
  crust: { name: "Crust", hex: "#B27A3E" },
  sea: { name: "Harbour blue", hex: "#4F7F91" },
  charcoal: { name: "Charcoal", hex: "#2A2826" },
  moss: { name: "Moss", hex: "#5E7247" },
  sky: { name: "Golden hour", hex: "#EFA46A" },
};

export type Scene =
  | "candles"
  | "tapers"
  | "garland"
  | "tabletop"
  | "placecard"
  | "glassware"
  | "linen"
  | "budvases"
  | "slate"
  | "numbers"
  | "peonies"
  | "arch"
  | "palette"
  | "fabric"
  | "terrace"
  | "barn"
  | "barninside"
  | "parquet"
  | "firepit"
  | "logo"
  | "specimen"
  | "loaf"
  | "croissant"
  | "buns"
  | "coffee";

export type Kind = "image" | "pdf" | "sheet" | "quote" | "link" | "doc" | "note";

export type ProjectId = "mara" | "kiln" | "harbour";

export type Asset = {
  id: string;
  project: ProjectId;
  name: string;
  kind: Kind;
  /** height / width */
  ratio: number;
  scene?: Scene;
  variant?: number;
  tones: ToneId[];
  task?: string;
  by: string;
  added: string;
  source: "Upload" | "Google Drive" | "Link";
  size?: string;
  hearts?: string[];
  comments?: number;
  version?: string;
  broken?: boolean;
  /** Typographic tiles. */
  vendor?: string;
  amount?: string;
  detail?: string;
  domain?: string;
  lines?: string[];
  pages?: number;
  /** What the client sees under the picture on a shared page. */
  caption?: string;
  /** Link tiles: the site's own colour, for its mark and a faint tint. */
  brand?: string;
};

export type Verdict = "love" | "pass";

export type Board = {
  id: string;
  project: ProjectId;
  name: string;
  items: string[];
  shared?: { with: string[]; on: string };
};

export type Project = {
  id: ProjectId;
  name: string;
  line: string;
  colour: string;
  initials: string;
  client: string[];
};

export const PROJECTS: Project[] = [
  {
    id: "mara",
    name: "Mara & Finn",
    line: "Wedding at The Orchard, Saturday 12 June",
    colour: "var(--v3-project-8)",
    initials: "MF",
    client: ["Mara", "Finn"],
  },
  {
    id: "kiln",
    name: "Kiln & Co rebrand",
    line: "Identity for a ceramics studio, round 2",
    colour: "var(--v3-project-6)",
    initials: "KC",
    client: ["Sadhbh"],
  },
  {
    id: "harbour",
    name: "Harbour Bakery",
    line: "Spring product photography",
    colour: "var(--v3-project-2)",
    initials: "HB",
    client: ["Tomás"],
  },
];

const a = (x: Omit<Asset, "by" | "added" | "source"> & Partial<Pick<Asset, "by" | "added" | "source">>): Asset => ({
  by: "Orla",
  added: "3 days ago",
  source: "Upload",
  ...x,
});

export const ASSETS: Asset[] = [
  /* ── Mara & Finn: tablescape ─────────────────────────────────────── */
  a({ id: "m1", project: "mara", name: "Long table by candlelight.jpg", kind: "image", ratio: 1.24, scene: "candles", variant: 0, tones: ["candle", "night", "ivory"], task: "Lock the tablescape", hearts: ["Orla", "Cian"], comments: 3, size: "4.2 MB", caption: "The long table, lit only by candles" }),
  a({ id: "m2", project: "mara", name: "Eucalyptus runner, loose.jpg", kind: "image", ratio: 0.66, scene: "garland", variant: 0, tones: ["sage", "ivory"], task: "Lock the tablescape", hearts: ["Cian"], size: "2.9 MB", caption: "A loose eucalyptus runner down the middle" }),
  a({ id: "m3", project: "mara", name: "Place setting, top down.jpg", kind: "image", ratio: 1, scene: "tabletop", variant: 0, tones: ["ivory", "sage", "candle"], task: "Lock the tablescape", size: "3.1 MB", caption: "Each place: linen, a sprig, brass cutlery" }),
  a({ id: "m4", project: "mara", name: "Place card, Aoife.jpg", kind: "image", ratio: 1.3, scene: "placecard", variant: 0, tones: ["ivory", "blush", "sage"], task: "Order place cards", hearts: ["Orla"], comments: 1, size: "1.8 MB", caption: "Handwritten place cards on the plate" }),
  a({ id: "m5", project: "mara", name: "Menu, draft 2.pdf", kind: "pdf", ratio: 1.41, tones: ["ivory"], task: "Menu tasting with the kitchen", pages: 2, size: "412 KB", by: "Cian", added: "Yesterday", caption: "The menu, second draft", lines: ["Supper", "Burrata, blood orange, basil", "Hake, brown butter, samphire", "Lamb rump, salsa verde", "Strawberries, elderflower, cream"] }),
  a({ id: "m6", project: "mara", name: "Linen napkin, knotted.jpg", kind: "image", ratio: 0.82, scene: "linen", variant: 0, tones: ["ivory", "sage"], size: "2.2 MB", caption: "Knotted linen napkins with a sprig" }),
  a({ id: "m7", project: "mara", name: "Amber glassware.jpg", kind: "image", ratio: 1.18, scene: "glassware", variant: 0, tones: ["candle", "crust"], task: "Confirm hire order with Hireco", hearts: ["Orla", "Cian", "Dee"], size: "2.6 MB", caption: "Amber tumblers instead of clear" }),
  a({ id: "m8", project: "mara", name: "Brass tapers, close.jpg", kind: "image", ratio: 1.5, scene: "tapers", variant: 0, tones: ["candle", "slate"], size: "3.4 MB", caption: "Tall tapers in brass holders" }),
  a({ id: "m9", project: "mara", name: "Seating plan, final", kind: "sheet", ratio: 0.72, tones: ["ivory", "sage"], task: "Approve the final seating plan", source: "Google Drive", by: "Dee", added: "Monday", caption: "The seating plan", lines: ["Table", "Guests", "Side"] }),
  a({ id: "m10", project: "mara", name: "Bud vases, cluster.jpg", kind: "image", ratio: 1.12, scene: "budvases", variant: 0, tones: ["blush", "sage", "ivory"], hearts: ["Dee"], size: "1.9 MB", caption: "Clusters of bud vases between candles" }),
  a({ id: "m11", project: "mara", name: "Stoneware chargers.jpg", kind: "image", ratio: 0.9, scene: "tabletop", variant: 1, tones: ["slate", "ivory"], size: "2.4 MB", caption: "Dark stoneware chargers" }),
  a({ id: "m12", project: "mara", name: "Chair hire quote", kind: "quote", ratio: 0.74, tones: ["ivory"], vendor: "Hireco crossback chairs", amount: "EUR 1,140", detail: "120 chairs, delivered Friday, collected Monday", task: "Confirm hire order with Hireco", source: "Upload", size: "96 KB", caption: "Crossback chairs, 120 of them" }),

  /* ── Mara & Finn: signage ────────────────────────────────────────── */
  a({ id: "m13", project: "mara", name: "Welcome sign, v1.png", kind: "image", ratio: 1.34, scene: "slate", variant: 0, tones: ["slate", "ivory"], version: "v1", task: "Final welcome sign artwork", size: "1.1 MB", added: "2 weeks ago", caption: "Welcome sign, first draft" }),
  a({ id: "m14", project: "mara", name: "Welcome sign, v2.png", kind: "image", ratio: 1.34, scene: "slate", variant: 1, tones: ["slate", "ivory"], version: "v2", task: "Final welcome sign artwork", comments: 4, size: "1.2 MB", added: "Last week", caption: "Welcome sign, second draft" }),
  a({ id: "m15", project: "mara", name: "Welcome sign, v3.png", kind: "image", ratio: 1.34, scene: "slate", variant: 2, tones: ["slate", "sage", "ivory"], version: "v3", task: "Final welcome sign artwork", hearts: ["Orla", "Dee"], comments: 2, size: "1.3 MB", added: "Today", caption: "Welcome sign, third draft" }),
  a({ id: "m16", project: "mara", name: "Table numbers, set of 14.jpg", kind: "image", ratio: 0.78, scene: "numbers", variant: 0, tones: ["ivory", "sage"], task: "Order place cards", size: "1.5 MB", caption: "Table numbers on folded card" }),
  a({ id: "m17", project: "mara", name: "Signage wording", kind: "doc", ratio: 1.05, tones: ["ivory"], by: "Dee", added: "Monday", source: "Google Drive", task: "Final welcome sign artwork", lines: ["Welcome to the wedding of Mara & Finn", "Unplugged ceremony: phones away, please", "Bar opens after the speeches", "Carriages at midnight from the front gate"], caption: "What every sign says" }),
  a({ id: "m18", project: "mara", name: "niamhwrites.ie", kind: "link", ratio: 0.62, tones: ["ivory"], domain: "niamhwrites.ie", detail: "Niamh Walsh, calligraphy and signwriting", source: "Link", by: "Dee", caption: "Our calligrapher", brand: "#3F4A52" }),
  a({ id: "m19", project: "mara", name: "Bar sign, slate.jpg", kind: "image", ratio: 0.75, scene: "slate", variant: 3, tones: ["slate", "candle"], size: "0.9 MB", caption: "The bar sign" }),

  /* ── Mara & Finn: florals ────────────────────────────────────────── */
  a({ id: "m20", project: "mara", name: "Peony and garden rose.jpg", kind: "image", ratio: 1.28, scene: "peonies", variant: 0, tones: ["blush", "sage", "ivory"], task: "Florist walkthrough", hearts: ["Orla", "Dee"], comments: 2, size: "3.8 MB", caption: "Peonies with garden roses" }),
  a({ id: "m21", project: "mara", name: "Ceremony arch, meadow.jpg", kind: "image", ratio: 1.42, scene: "arch", variant: 0, tones: ["sage", "blush", "sky"], task: "Florist walkthrough", size: "4.4 MB", caption: "A meadow arch for the ceremony" }),
  a({ id: "m22", project: "mara", name: "Bridal bouquet, loose.jpg", kind: "image", ratio: 1.36, scene: "peonies", variant: 1, tones: ["ivory", "blush", "sage"], hearts: ["Dee"], size: "3.2 MB", caption: "A loose, white-led bouquet" }),
  a({ id: "m23", project: "mara", name: "Florist quote", kind: "quote", ratio: 0.74, tones: ["ivory"], vendor: "Wildflower & Co", amount: "EUR 2,460", detail: "Arch, 14 centrepieces, bouquet, 8 buttonholes", task: "Florist walkthrough", size: "120 KB", caption: "Florals, all in" }),
  a({ id: "m24", project: "mara", name: "Palette card, florals.jpg", kind: "image", ratio: 0.7, scene: "palette", variant: 0, tones: ["blush", "sage", "ivory", "candle"], size: "0.7 MB", caption: "The colours we keep coming back to" }),
  a({ id: "m25", project: "mara", name: "Garland on the barn beam.jpg", kind: "image", ratio: 0.6, scene: "garland", variant: 1, tones: ["sage", "moss", "candle"], size: "2.8 MB", caption: "Garland along the beam" }),
  a({ id: "m26", project: "mara", name: "Dress fabric swatch.jpg", kind: "image", ratio: 1.1, scene: "fabric", variant: 0, tones: ["ivory", "blush"], by: "Mara", added: "Last week", hearts: ["Orla"], size: "1.4 MB", caption: "The dress fabric, to match the flowers to" }),
  a({ id: "m27", project: "mara", name: "pinterest.com/marabyrne", kind: "link", ratio: 0.62, tones: ["blush"], domain: "pinterest.com", detail: "Mara's board: garden wedding, 214 pins", source: "Link", by: "Mara", caption: "Mara's own board", brand: "#B8323A" }),

  /* ── Mara & Finn: the barn at night ──────────────────────────────── */
  a({ id: "m28", project: "mara", name: "Barn with festoon lights.jpg", kind: "image", ratio: 0.72, scene: "barn", variant: 0, tones: ["night", "candle", "slate"], task: "Lighting plan sign-off", hearts: ["Orla", "Cian", "Dee"], comments: 5, size: "5.1 MB", caption: "The barn from the orchard after dark" }),
  a({ id: "m29", project: "mara", name: "Barn inside, candlelit.jpg", kind: "image", ratio: 1.2, scene: "barninside", variant: 0, tones: ["candle", "crust", "night"], task: "Lighting plan sign-off", size: "4.6 MB", caption: "Inside, under the beams" }),
  a({ id: "m30", project: "mara", name: "Festoon reference.jpg", kind: "image", ratio: 0.9, tones: ["night"], broken: true, source: "Google Drive", by: "Cian", added: "Last week", caption: "Festoon reference" }),
  a({ id: "m31", project: "mara", name: "Marquee quote", kind: "quote", ratio: 0.74, tones: ["ivory"], vendor: "Hireco marquee", amount: "EUR 3,850", detail: "Sailcloth, 12 by 24 metres, clear sides for rain", task: "Confirm marquee sides with Hireco", size: "184 KB", caption: "The marquee, if it rains" }),
  a({ id: "m32", project: "mara", name: "Lighting plan.pdf", kind: "pdf", ratio: 0.72, tones: ["night"], task: "Lighting plan sign-off", pages: 6, size: "2.1 MB", by: "Cian", added: "Monday", lines: ["Lighting plan", "Festoon runs A to D", "Uplighters on the beams", "Dimmer at the bar"] }),
  a({ id: "m33", project: "mara", name: "Parquet dance floor.jpg", kind: "image", ratio: 0.8, scene: "parquet", variant: 0, tones: ["crust", "candle"], size: "2.0 MB", caption: "Parquet dance floor under the lights" }),
  a({ id: "m34", project: "mara", name: "Fire pit on the terrace.jpg", kind: "image", ratio: 1.25, scene: "firepit", variant: 0, tones: ["night", "candle", "terracotta"], hearts: ["Cian"], size: "3.3 MB", caption: "The fire pit, for late night" }),

  /* ── Mara & Finn: everything else ────────────────────────────────── */
  a({ id: "m35", project: "mara", name: "The Orchard terrace, golden hour.jpg", kind: "image", ratio: 0.74, scene: "terrace", variant: 0, tones: ["sky", "sage", "candle"], hearts: ["Orla", "Dee"], size: "4.9 MB", added: "A month ago", caption: "The terrace at golden hour" }),
  a({ id: "m36", project: "mara", name: "Terrace in the morning.jpg", kind: "image", ratio: 1.3, scene: "terrace", variant: 1, tones: ["sage", "sky", "ivory"], size: "4.1 MB", added: "A month ago", caption: "The terrace in the morning" }),
  a({ id: "m37", project: "mara", name: "Run sheet, Saturday", kind: "doc", ratio: 1.1, tones: ["ivory"], task: "Build the Saturday run sheet", source: "Google Drive", by: "Orla", added: "Today", lines: ["14:00  Ceremony in the orchard", "15:00  Drinks on the terrace", "17:30  Supper in the barn", "21:00  Band, then the fire pit"] }),
  a({ id: "m38", project: "mara", name: "Note from Finn", kind: "note", ratio: 0.72, tones: ["ivory"], by: "Finn", added: "Yesterday", detail: "Mum would love white flowers on the top table. Everywhere else, go wild." }),
  a({ id: "m39", project: "mara", name: "Budget, all suppliers", kind: "sheet", ratio: 0.7, tones: ["ivory"], source: "Google Drive", by: "Dee", added: "Tuesday", lines: ["Supplier", "Quote", "Paid"] }),
  a({ id: "m40", project: "mara", name: "Tapers at dusk.jpg", kind: "image", ratio: 0.8, scene: "tapers", variant: 1, tones: ["sky", "candle", "blush"], size: "2.7 MB", caption: "Tapers as the sun goes" }),

  /* ── Kiln & Co rebrand ───────────────────────────────────────────── */
  a({ id: "k1", project: "kiln", name: "Arch mark, terracotta.png", kind: "image", ratio: 1, scene: "logo", variant: 0, tones: ["terracotta", "ivory"], task: "Logo round 2 review", hearts: ["Orla"], comments: 3, size: "0.6 MB", by: "Rua", caption: "The arch mark on terracotta" }),
  a({ id: "k2", project: "kiln", name: "Arch mark, bone.png", kind: "image", ratio: 1.25, scene: "logo", variant: 1, tones: ["ivory", "charcoal"], task: "Logo round 2 review", size: "0.5 MB", by: "Rua", caption: "The arch mark on bone" }),
  a({ id: "k3", project: "kiln", name: "Wordmark, charcoal.png", kind: "image", ratio: 0.62, scene: "logo", variant: 2, tones: ["charcoal", "ivory"], task: "Logo round 2 review", hearts: ["Rua", "Orla"], size: "0.4 MB", by: "Rua", caption: "Wordmark on charcoal" }),
  a({ id: "k4", project: "kiln", name: "Stamp mark, glaze.png", kind: "image", ratio: 1.1, scene: "logo", variant: 3, tones: ["moss", "ivory"], size: "0.5 MB", by: "Rua", caption: "A stamp for the base of each pot" }),
  a({ id: "k5", project: "kiln", name: "Type specimen, serif.png", kind: "image", ratio: 1.3, scene: "specimen", variant: 0, tones: ["ivory", "charcoal"], task: "Choose the typeface", size: "0.8 MB", by: "Rua", caption: "Serif specimen" }),
  a({ id: "k6", project: "kiln", name: "Type specimen, grotesk.png", kind: "image", ratio: 0.9, scene: "specimen", variant: 1, tones: ["terracotta", "ivory"], task: "Choose the typeface", size: "0.7 MB", by: "Rua", caption: "Grotesk specimen" }),
  a({ id: "k7", project: "kiln", name: "Brand deck, round 2.pdf", kind: "pdf", ratio: 0.72, tones: ["terracotta"], pages: 18, size: "8.4 MB", by: "Rua", lines: ["Kiln & Co", "Round 2", "Made slowly, by hand"] }),
  a({ id: "k8", project: "kiln", name: "kilnandco.ie", kind: "link", ratio: 0.62, tones: ["ivory"], domain: "kilnandco.ie", detail: "The current site, for reference", source: "Link", by: "Rua", brand: "#A94F2E" }),

  /* ── Harbour Bakery ──────────────────────────────────────────────── */
  a({ id: "h1", project: "harbour", name: "Sourdough, scored.jpg", kind: "image", ratio: 1.2, scene: "loaf", variant: 0, tones: ["crust", "ivory"], task: "Pick the website selects", hearts: ["Orla", "Tomás"], size: "6.2 MB", by: "Sam", caption: "The country sourdough" }),
  a({ id: "h2", project: "harbour", name: "Croissants on the rack.jpg", kind: "image", ratio: 0.8, scene: "croissant", variant: 0, tones: ["crust", "candle"], task: "Pick the website selects", size: "5.8 MB", by: "Sam", caption: "Croissants, just out" }),
  a({ id: "h3", project: "harbour", name: "Cinnamon buns, tray.jpg", kind: "image", ratio: 1.05, scene: "buns", variant: 0, tones: ["crust", "ivory"], hearts: ["Tomás"], size: "5.4 MB", by: "Sam", caption: "Cinnamon buns" }),
  a({ id: "h4", project: "harbour", name: "Flat white and pastry.jpg", kind: "image", ratio: 1.3, scene: "coffee", variant: 0, tones: ["sea", "crust", "ivory"], task: "Pick the website selects", size: "4.9 MB", by: "Sam", caption: "Coffee by the harbour window" }),
  a({ id: "h5", project: "harbour", name: "Loaf, sea light.jpg", kind: "image", ratio: 0.75, scene: "loaf", variant: 1, tones: ["sea", "crust"], size: "6.0 MB", by: "Sam", caption: "Loaf in the window light" }),
  a({ id: "h6", project: "harbour", name: "Croissant, close.jpg", kind: "image", ratio: 1.25, scene: "croissant", variant: 1, tones: ["candle", "sea"], size: "5.1 MB", by: "Sam", caption: "One croissant, close" }),
  a({ id: "h7", project: "harbour", name: "Shot list", kind: "doc", ratio: 1, tones: ["ivory"], source: "Google Drive", by: "Orla", lines: ["Sourdough, three angles", "Croissants on the cooling rack", "Buns, top down", "Coffee by the window, morning light"] }),
  a({ id: "h8", project: "harbour", name: "Selects, round 1", kind: "sheet", ratio: 0.7, tones: ["ivory"], source: "Google Drive", by: "Sam", lines: ["Frame", "Use", "Crop"] }),
];

export const BOARDS: Board[] = [
  {
    id: "tablescape",
    project: "mara",
    name: "Tablescape",
    items: ["m1", "m2", "m3", "m4", "m7", "m8", "m10", "m11", "m6", "m40", "m5", "m12"],
    shared: { with: ["Mara"], on: "Tuesday" },
  },
  { id: "signage", project: "mara", name: "Signage", items: ["m15", "m14", "m13", "m16", "m19", "m17", "m18"] },
  { id: "florals", project: "mara", name: "Florals", items: ["m20", "m22", "m21", "m24", "m26", "m25", "m10", "m23", "m27", "m38"] },
  { id: "barn", project: "mara", name: "The barn at night", items: ["m28", "m29", "m34", "m33", "m30", "m31", "m32", "m1"] },
  { id: "round2", project: "kiln", name: "Logo round 2", items: ["k1", "k2", "k3", "k4", "k7"] },
  { id: "type", project: "kiln", name: "Type", items: ["k5", "k6"] },
  { id: "selects", project: "harbour", name: "Website selects", items: ["h1", "h2", "h4"] },
];

/** How "Everything" is hung: mixed so the wall reads like the whole wedding, with paper (a quote, a note, a menu, a run sheet) every five or six pictures. */
export const EVERYTHING_ORDER = [
  "m35", "m20", "m28", "m31", "m1", "m15", "m38", "m26", "m24", "m5",
  "m2", "m21", "m37", "m29", "m7", "m18", "m4", "m34", "m9", "m14",
  "m10", "m23", "m36", "m22", "m17", "m3", "m33", "m27", "m8", "m12",
  "m25", "m16", "m32", "m30", "m40", "m39", "m13", "m6", "m19", "m11",
];

/** Reactions Mara already left on the Tablescape page on Tuesday. */
export const INITIAL_VERDICTS: Record<string, { by: string; verdict: Verdict }> = {
  m1: { by: "Mara", verdict: "love" },
  m2: { by: "Mara", verdict: "love" },
  m3: { by: "Mara", verdict: "pass" },
  m4: { by: "Mara", verdict: "love" },
  m7: { by: "Mara", verdict: "love" },
  m6: { by: "Mara", verdict: "pass" },
};

export const TASKS = [
  "Lock the tablescape",
  "Florist walkthrough",
  "Final welcome sign artwork",
  "Confirm marquee sides with Hireco",
  "Lighting plan sign-off",
  "Order place cards",
];

export const PEOPLE: Record<string, string> = {
  Orla: "#7c5cf5",
  Cian: "#0f766e",
  Dee: "#b45309",
  Mara: "#be185d",
  Finn: "#2563eb",
  Rua: "#c2410c",
  Sam: "#2563eb",
  Tomás: "#15803d",
  Sadhbh: "#be185d",
};

/** "Long table by candlelight.jpg" reads as "Long table by candlelight" on the wall. */
export const bare = (name: string) => name.replace(/\.(jpe?g|png|pdf|gif|webp|heic)$/i, "");

export function kindLabel(kind: Kind) {
  return { image: "Image", pdf: "PDF", sheet: "Sheet", quote: "Quote", link: "Link", doc: "Doc", note: "Note" }[kind];
}
