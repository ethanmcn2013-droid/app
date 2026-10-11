/* Sample data for the Planner's sheet: The Orchard, a venue running three
   events at once. Every figure is invented, and the totals are tuned so the
   sheet reads true: Mara & Finn is €8,420 with 6 paid, the whole sheet is
   €21,380 across 38 tasks. */

export const TODAY = "2026-09-25"; // Friday

export type StatusId = "todo" | "progress" | "waiting" | "done";
export type PersonId = "aoife" | "orla" | "dara" | "tomas";
export type EventId = "mf" | "doyle" | "open";
export type RoomId = "hall" | "garden" | "terrace" | "barn";

export const STATUSES: { id: StatusId; name: string }[] = [
  { id: "todo", name: "To do" },
  { id: "progress", name: "In progress" },
  { id: "waiting", name: "Waiting" },
  { id: "done", name: "Done" },
];

export const PEOPLE: Record<PersonId, { name: string; initial: string; tone: string }> = {
  aoife: { name: "Aoife", initial: "A", tone: "var(--v3-project-8)" },
  orla: { name: "Orla", initial: "O", tone: "var(--v3-project-3)" },
  dara: { name: "Dara", initial: "D", tone: "var(--v3-project-5)" },
  tomas: { name: "Tomás", initial: "T", tone: "var(--v3-project-2)" },
};
export const PERSON_IDS = Object.keys(PEOPLE) as PersonId[];

export const EVENTS: Record<EventId, { name: string; short: string; tone: string; date: string; guests: number }> = {
  mf: { name: "Mara & Finn wedding", short: "Mara & Finn", tone: "var(--v3-project-8)", date: "2026-10-17", guests: 110 },
  doyle: { name: "Doyle 50th", short: "Doyle 50th", tone: "var(--v3-project-5)", date: "2026-10-10", guests: 60 },
  open: { name: "Autumn open day", short: "Open day", tone: "var(--v3-project-3)", date: "2026-10-04", guests: 200 },
};
export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

export const ROOMS: Record<RoomId, { name: string; seats: number }> = {
  hall: { name: "Orchard hall", seats: 180 },
  garden: { name: "Walled garden", seats: 120 },
  terrace: { name: "Terrace", seats: 60 },
  barn: { name: "Barn", seats: 90 },
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];

export type CellValue = string | number | boolean | null;
export type Row = { id: string; table: string; cells: Record<string, CellValue> };

type Seed = [
  title: string,
  status: StatusId,
  owner: PersonId | null,
  due: string | null,
  event: EventId | null,
  supplier: string | null,
  cost: number | null,
  paid: boolean,
  guests: number | null,
  room: RoomId | null,
  notes: string | null,
];

const LONG_NOTE =
  "Lawlor Hire can swap the clear panels for the window ones, but only if we confirm by Wednesday. They also need the terrace measurements again because the last set was for the old layout, and Seán wants to check the ground pegs near the flagstones before anyone signs.";

const SEEDS: Seed[] = [
  // Mara & Finn wedding · 14 tasks · €8,420 · 6 paid
  ["Pay the florist deposit", "done", "aoife", "2026-09-18", "mf", "Wildflower Studio, Kinsale", 1200, true, null, null, "Ivory and sage, no lilies. Balance due a week out."],
  ["Confirm the photographer's shot list", "progress", "aoife", "2026-09-30", "mf", "Aisling Ryan Photography", 2100, false, null, null, "Family groups after the ceremony, golden hour in the walled garden."],
  ["Book the ceilidh band", "done", "orla", "2026-09-12", "mf", "The Humours of Bandon", 950, true, 110, "hall", "Two sets, 9pm and 10:30pm."],
  ["Confirm marquee sides with the hire company", "todo", "aoife", "2026-10-02", "mf", "Lawlor Hire", 640, false, null, "terrace", LONG_NOTE],
  ["Order prosecco for the drinks reception", "todo", "dara", "2026-10-05", "mf", "Kinsale Wine Co", 1480, false, 110, "garden", "Sale or return on unopened cases."],
  ["Candles and lanterns for the walled garden", "done", "orla", "2026-09-21", "mf", null, 220, true, null, "garden", null],
  ["Final headcount from the couple", "waiting", "aoife", "2026-09-23", "mf", null, null, false, 110, "hall", "Mara thinks two more from Galway."],
  ["Draft the seating plan", "todo", "orla", "2026-10-07", "mf", null, null, false, 110, "hall", null],
  ["Cake tasting and order", "done", "tomas", "2026-09-16", "mf", "Sugar Loaf Bakery", 480, true, null, null, "Lemon and elderflower, three tiers."],
  ["Hair and make-up trial", "todo", null, "2026-10-09", "mf", "Glow Studio", null, false, null, null, "The couple pays Glow directly."],
  ["Order table linen", "done", "dara", "2026-09-19", "mf", "Linen Loft", 360, true, null, "hall", null],
  ["Book the shuttle from Kinsale", "todo", "tomas", "2026-09-22", "mf", "Harbour Coaches", 840, false, 110, null, "Two runs back at midnight and 1am."],
  ["Guest welcome signs", "done", "orla", "2026-09-20", "mf", "PrintHaus Cork", 150, true, null, "terrace", null],
  ["Rain plan for the ceremony", "progress", "aoife", "2026-10-01", "mf", null, null, false, 110, "hall", "Move to the hall if the forecast is over 60% on the Thursday."],

  // Doyle 50th in the Barn · 9 tasks
  ["Book the DJ", "done", "dara", "2026-09-10", "doyle", "DJ Colm Byrne", 450, true, 60, "barn", "Eighties first, no Mr Brightside."],
  ["Three-tier birthday cake", "todo", "tomas", "2026-10-03", "doyle", "Sugar Loaf Bakery", 260, false, null, null, null],
  ["Replace the barn fairy lights", "progress", "dara", "2026-09-24", "doyle", null, 180, true, null, "barn", null],
  ["Sign off the buffet menu", "waiting", "orla", "2026-09-29", "doyle", "Orchard kitchen", 2880, false, 60, "barn", "Two vegan, one coeliac."],
  ["Bar tab deposit", "todo", "dara", "2026-10-01", "doyle", "Orchard bar", 1160, false, 60, "barn", "Cap at €1,500, then a cash bar."],
  ["Photo booth hire", "todo", null, "2026-10-06", "doyle", "Snapbox Cork", 395, false, null, "barn", null],
  ["Final numbers from Niamh Doyle", "waiting", "orla", "2026-09-21", "doyle", null, null, false, 60, "barn", null],
  ["Balloon arch", "done", "tomas", "2026-09-17", "doyle", "Pop Party Supplies", 145, true, null, "barn", "Gold and navy."],
  ["Parking marshal for the night", "todo", "dara", "2026-10-08", "doyle", "Barry Security", 220, false, null, null, null],

  // Autumn open day · 9 tasks
  ["Reprint the directional signage", "todo", "orla", "2026-09-28", "open", "PrintHaus Cork", 180, false, null, null, "The old signs still say the Coach House."],
  ["Lay out the tasting stations", "progress", "tomas", "2026-10-01", "open", null, null, false, 200, null, "Six stations, one per supplier, flow clockwise."],
  ["Canapé samples for tasting", "todo", "tomas", "2026-10-02", "open", "Orchard kitchen", 1240, false, null, "hall", "Six trays per station, restocked hourly."],
  ["Florist display for the hall", "todo", "aoife", "2026-10-02", "open", "Wildflower Studio, Kinsale", 310, false, null, "hall", null],
  ["Schedule the social posts", "progress", "orla", "2026-09-26", "open", null, null, false, null, null, null],
  ["Brochure print run", "done", "orla", "2026-09-15", "open", "PrintHaus Cork", 420, true, null, null, "500 copies."],
  ["Hire extra glassware", "todo", "dara", "2026-09-30", "open", "Lawlor Hire", 165, false, null, "hall", null],
  ["Live acoustic set", "done", "aoife", "2026-09-14", "open", "Sadhbh Keane", 450, true, null, "garden", null],
  ["Walk-in estimate for the hall", "todo", "tomas", "2026-09-29", "open", null, null, false, 1100, "hall", "From last year's sign-in sheets."],

  // Venue upkeep · no event · 6 tasks
  ["Re-seal the terrace flagstones", "todo", "dara", "2026-10-12", null, "Kerr Stoneworks", 420, false, null, "terrace", "Before the first frost."],
  ["Service the boiler", "done", "tomas", "2026-09-11", null, "Munster Heating", 260, true, null, null, null],
  ["Replace the barn door hinges", "todo", "dara", "2026-09-19", null, null, 95, false, null, "barn", null],
  ["Clear the gutters", "todo", null, null, null, null, 180, false, null, null, null],
  ["Fire safety inspection", "done", "orla", "2026-09-08", null, "SafeCert", 350, true, null, null, "Certificate filed in Files."],
  ["Repoint the walled garden wall", "waiting", "dara", "2026-11-03", null, "Kerr Stoneworks", 3200, false, null, "garden", "Quote holds until the end of October."],
];

export const SAMPLE_ROWS: Row[] = SEEDS.map((s, i) => ({
  id: `r${i + 1}`,
  table: "main",
  cells: {
    title: s[0],
    status: s[1],
    owner: s[2],
    due: s[3],
    event: s[4],
    supplier: s[5],
    cost: s[6],
    paid: s[7],
    guests: s[8],
    room: s[9],
    notes: s[10],
  },
}));

/* What the "Try an example paste" button puts on the clipboard: the band's
   and the caterer's add-ons for Mara & Finn, as a planner would copy them
   out of their own spreadsheet. */
export const EXAMPLE_PASTE = [
  "Item\tSupplier\tCost\tDue\tPaid",
  "Chair covers, ivory\tLinen Loft\t€210\t6 Oct\tno",
  "Late-night pizza van\tSlice Wagon\t€480\t9 Oct\tno",
  "Buttonholes for the groomsmen\tWildflower Studio, Kinsale\t€96\t8 Oct\tno",
  "Piper for the ceremony\tSeán Ó Riada\t€250\t7 Oct\tyes",
  "Hot port station\tKinsale Wine Co\t€185\t10 Oct\tno",
  "Sparklers for the send-off\tPop Party Supplies\t€64\t12 Oct\tno",
].join("\n");

/* ── Dates ─────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export function toIso(t: number) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function addDays(iso: string, n: number) {
  return toIso(parseIso(iso) + n * DAY);
}
export function daysFromToday(iso: string) {
  return Math.round((parseIso(iso) - parseIso(TODAY)) / DAY);
}
export function weekday(iso: string) {
  return WD[new Date(parseIso(iso)).getUTCDay()];
}
export function fmtDate(iso: string) {
  const d = new Date(parseIso(iso));
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}
/** Short and human, for the phone's second line. */
export function fmtRelative(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return weekday(iso);
  const d = new Date(parseIso(iso));
  return `${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}
export function monthName(y: number, m: number) {
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]} ${y}`;
}
/** Accepts "6 Oct", "6 October", "2026-10-06", "06/10/2026". */
export function parseLooseDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (dmY) {
    const y = dmY[3].length === 2 ? 2000 + Number(dmY[3]) : Number(dmY[3]);
    return toIso(Date.UTC(y, Number(dmY[2]) - 1, Number(dmY[1])));
  }
  const dm = t.match(/^(?:[a-z]{3,9}\s+)?(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?$/i);
  if (dm) {
    const mi = MO.findIndex((m) => dm[2].toLowerCase().startsWith(m.toLowerCase()));
    if (mi >= 0) return toIso(Date.UTC(dm[3] ? Number(dm[3]) : 2026, mi, Number(dm[1])));
  }
  return null;
}

/* ── Money and numbers ─────────────────────────────────────────────── */

const EUR0 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });

export function eur(n: number) {
  return Number.isInteger(n) ? EUR0.format(n) : EUR2.format(n);
}
export function num(n: number) {
  return NUM.format(n);
}
