/**
 * Sample data for "Who owes what": The Orchard's events team, a week of
 * promises. Front-end only; nothing here touches a server.
 */

export type PersonId = "orla" | "dev" | "aoife" | "tom" | "niamh" | "sinead" | "mara";

export type Person = {
  id: PersonId;
  name: string;
  full: string;
  role: string;
  /** Shown after the name for people outside the team: "from Kite Studio". */
  from?: string;
  external?: boolean;
  /** The company they work for, used in summaries: "Sinéad from Kite Studio". */
  org?: string;
  /** One of the v3 project identity hues, used for the avatar tile. */
  hue: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export type Commitment = {
  id: string;
  owner: PersonId | null;
  /** The verb phrase: "confirm the marquee sides with the hire company". */
  action: string;
  /** ISO date (yyyy-mm-dd) or null for "no date yet". */
  due: string | null;
  /** Who it is for: a client, an event, a person. */
  forWhom: string | null;
  waitingOn: PersonId | null;
  /** What they are waiting for: "the budget". */
  waitingFor: string | null;
  note?: string;
  /** ISO date it was kept, or null while open. */
  keptOn: string | null;
};

export const ME: PersonId = "orla";

/** Friday 25 September 2026: the day of the weekly check-in. */
export const TODAY = "2026-09-25";
export const WEEK_START = "2026-09-21";

export const PROJECT = { name: "The Orchard, events", initials: "TO" };

export const PEOPLE: Person[] = [
  { id: "orla", name: "Orla", full: "Orla Brennan", role: "Operations", hue: 1 },
  { id: "dev", name: "Dev", full: "Dev Mehta", role: "Bar", hue: 3 },
  { id: "aoife", name: "Aoife", full: "Aoife Kinsella", role: "Events", hue: 8 },
  { id: "tom", name: "Tom", full: "Tom Doherty", role: "Kitchen", hue: 5 },
  { id: "niamh", name: "Niamh", full: "Niamh Ryan", role: "Front of house", hue: 2 },
  { id: "sinead", name: "Sinéad", full: "Sinéad Walsh", role: "Designer", from: "Kite Studio", org: "Kite Studio", external: true, hue: 6 },
  { id: "mara", name: "Mara", full: "Mara Quinn", role: "Client, wedding on 10 October", from: "Mara & Finn's wedding", external: true, hue: 4 },
];

export const personById = (id: PersonId | null | undefined) => PEOPLE.find((p) => p.id === id) ?? null;

/** Things a promise can be for. People are offered too, in the picker. */
export const FOR_OPTIONS = ["Mara & Finn", "the Doyle 50th", "the open day", "the Harvest supper", "the bar", "the team"];

let seq = 0;
const c = (
  owner: PersonId | null,
  action: string,
  due: string | null,
  forWhom: string | null = null,
  extra: Partial<Commitment> = {},
): Commitment => ({
  id: `p${++seq}`,
  owner,
  action,
  due,
  forWhom,
  waitingOn: null,
  waitingFor: null,
  keptOn: null,
  ...extra,
});

export const COMMITMENTS: Commitment[] = [
  // Orla: 9 open, 2 running late
  c("orla", "confirm the marquee sides with the hire company", "2026-09-25", "Mara & Finn", {
    note: "Peak Marquees, ask for Colm. They need the pole count by noon.",
  }),
  c("orla", "send the deposit invoice", "2026-09-23", "the Doyle 50th"),
  c("orla", "chase the fire cert renewal with the council", "2026-09-21", null, {
    note: "Left a message with the planning office on Tuesday.",
  }),
  c("orla", "order compostable cups and napkins", "2026-09-26", "the open day"),
  c("orla", "sign off the open day budget", "2026-09-28", "the open day"),
  c("orla", "book two extra floor staff", "2026-09-30", "the Harvest supper"),
  c("orla", "walk the orchard path with the photographer", "2026-10-03", "Mara & Finn"),
  c("orla", "renew the music licence", "2026-10-09", null),
  c("orla", "reprint the faded sign at the gate", null, null),

  // Dev: 4 open, 1 running late
  c("dev", "order tonic and the good olives", "2026-09-22", "the bar", {
    note: "Supplier was out of the Gordal olives last week.",
  }),
  c("dev", "get the glass washer serviced", "2026-09-29", "the bar"),
  c("dev", "write the signature cocktail list", "2026-10-01", "Mara & Finn"),
  c("dev", "price the drinks package", "2026-10-06", "Mara & Finn", { waitingOn: "mara", waitingFor: "the final guest numbers" }),

  // Aoife: 5 open
  c(
    "aoife",
    "walk the Doyles through the room layout and the timings for speeches, the cake and the surprise slideshow",
    "2026-09-25",
    "the Doyle 50th",
  ),
  c("aoife", "confirm the florist's delivery time", "2026-09-26", "Mara & Finn"),
  c("aoife", "send the run of the day", "2026-09-28", "Mara & Finn"),
  c("aoife", "draft the open day social posts", "2026-09-30", "the open day"),
  c("aoife", "book the ceilidh band", "2026-10-02", "the open day", { waitingOn: "orla", waitingFor: "the budget" }),

  // Tom: 3 open
  c("tom", "get the allergy list from the Doyles' planner", "2026-09-28", "the Doyle 50th"),
  c("tom", "send the final menu", "2026-09-30", "Mara & Finn"),
  c("tom", "cost the late-night food", "2026-10-01", "the Doyle 50th"),

  // Sinéad from Kite Studio: 2 open
  c("sinead", "send poster proofs", "2026-09-28", "the open day"),
  c("sinead", "send the final signage files", "2026-10-05", "the open day", { waitingOn: "aoife", waitingFor: "the event times" }),

  // Mara, the client: 2 open
  c("mara", "confirm the final guest numbers", "2026-09-30", "Dev"),
  c("mara", "return the seating plan", "2026-10-05", "Aoife"),

  // Nobody yet
  c(null, "find a second supplier for ice", "2026-09-29", "the open day"),
  c(null, "fix the fairy lights on the terrace", null, null),

  // Kept this week (12)
  c("orla", "send the guest list template to Kite Studio", "2026-09-22", "the open day", { keptOn: "2026-09-22" }),
  c("orla", "send the Harvest supper menu to print", "2026-09-23", "the Harvest supper", { keptOn: "2026-09-23" }),
  c("orla", "sort the staff rota for October", "2026-09-24", "the team", { keptOn: "2026-09-23" }),
  c("orla", "confirm the parking plan with the farm", "2026-09-24", "the open day", { keptOn: "2026-09-24" }),
  c("orla", "reply to the Doyles about the date change", "2026-09-21", "the Doyle 50th", { keptOn: "2026-09-21" }),
  c("aoife", "send the wedding questionnaire", "2026-09-22", "Mara & Finn", { keptOn: "2026-09-22" }),
  c("aoife", "book the photographer's site visit", "2026-09-24", "Mara & Finn", { keptOn: "2026-09-24" }),
  c("aoife", "brief Kite Studio on the posters", "2026-09-21", "the open day", { keptOn: "2026-09-21" }),
  c("niamh", "reset the terrace tables for autumn", "2026-09-22", null, { keptOn: "2026-09-21" }),
  c("niamh", "train the new starters on the booking book", "2026-09-23", "the team", { keptOn: "2026-09-23" }),
  c("niamh", "update the opening hours on the gate board", "2026-09-24", null, { keptOn: "2026-09-24" }),
  c("niamh", "call back the three walk-in enquiries", "2026-09-24", "the Harvest supper", { keptOn: "2026-09-24" }),
];

/* ── Dates ─────────────────────────────────────────────────────────── */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};
export const diffDays = (iso: string, from = TODAY) =>
  Math.round((toDate(iso).getTime() - toDate(from).getTime()) / 86_400_000);
export const weekday = (iso: string) => DAYS[toDate(iso).getDay()];
export const dayMonth = (iso: string) => {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const monthName = (m: number) => MONTHS[m];

export const isLate = (x: Commitment) => !x.keptOn && !!x.due && diffDays(x.due) < 0;

/** "today", "tomorrow", "Monday", "2 October". */
export function relDay(iso: string) {
  const n = diffDays(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1 && n < 7) return weekday(iso);
  if (n < -1 && n > -7) return weekday(iso);
  return dayMonth(iso);
}

/** The date clause of the sentence: "by Friday", "was due Tuesday", "no date yet". */
export function dueClause(x: Pick<Commitment, "due" | "keptOn">) {
  if (!x.due) return "no date yet";
  if (!x.keptOn && diffDays(x.due) < 0) return `was due ${relDay(x.due)}`;
  if (diffDays(x.due) === 0) return "by end of day";
  return `by ${relDay(x.due)}`;
}

/** Label for agenda rows: "Today", "Tomorrow", "Monday 28". */
export function agendaLabel(iso: string) {
  const n = diffDays(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  const d = toDate(iso);
  if (n > 1 && n < 7) return `${weekday(iso)} ${d.getDate()}`;
  return dayMonth(iso);
}

/** Quick picks in the date picker. */
export const QUICK_DATES: { label: string; iso: string | null }[] = [
  { label: "Today", iso: TODAY },
  { label: "Tomorrow", iso: addDays(TODAY, 1) },
  { label: "Monday", iso: addDays(TODAY, 3) },
  { label: "In a week", iso: addDays(TODAY, 7) },
];

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
