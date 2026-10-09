/*
 * Sample world for the agenda river. Days are integers relative to today,
 * Thursday 1 October 2026 (day 0). Times are minutes after midnight.
 */

export type ProjectId = "orchard" | "wedding" | "heat" | "crumb";
export type PersonId = "you" | "aoife" | "dev" | "ronan" | "lena" | "tomas";
export type ItemKind = "task" | "event" | "milestone" | "span";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  color: string;
};

export type Person = {
  id: PersonId;
  name: string;
  initials: string;
  color: string;
};

export type Item = {
  id: string;
  kind: ItemKind;
  title: string;
  project: ProjectId;
  /** Undefined means it needs a date. */
  day?: number;
  /** Last day of a multi-day item, inclusive. */
  endDay?: number;
  start?: number;
  end?: number;
  people: PersonId[];
  done?: boolean;
  place?: string;
  note?: string;
};

export type Absence = { person: PersonId; from: number; to: number; why: string };
export type Holiday = { day: number; label: string };

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard", short: "Orchard", color: "var(--v3-project-3)" },
  { id: "wedding", name: "Mara & Finn wedding", short: "Wedding", color: "var(--v3-project-8)" },
  { id: "heat", name: "Urban heat islands", short: "Heat islands", color: "var(--v3-project-2)" },
  { id: "crumb", name: "Crumb & Co", short: "Crumb & Co", color: "var(--v3-project-5)" },
];

export const PEOPLE: Person[] = [
  { id: "you", name: "You", initials: "CM", color: "var(--v3-project-1)" },
  { id: "aoife", name: "Aoife", initials: "AB", color: "var(--v3-project-8)" },
  { id: "dev", name: "Dev", initials: "DP", color: "var(--v3-project-3)" },
  { id: "ronan", name: "Ronan", initials: "RK", color: "var(--v3-project-2)" },
  { id: "lena", name: "Lena", initials: "LW", color: "var(--v3-project-5)" },
  { id: "tomas", name: "Tomás", initials: "TÓ", color: "var(--v3-project-4)" },
];

export const projectById = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<ProjectId, Project>;
export const personById = Object.fromEntries(PEOPLE.map((p) => [p.id, p])) as Record<PersonId, Person>;

const t = (h: number, m = 0) => h * 60 + m;

let n = 0;
const id = () => `i${++n}`;

function task(day: number | undefined, project: ProjectId, title: string, people: PersonId[], extra: Partial<Item> = {}): Item {
  return { id: id(), kind: "task", day, project, title, people, ...extra };
}
function event(day: number, start: number, end: number, project: ProjectId, title: string, people: PersonId[], extra: Partial<Item> = {}): Item {
  return { id: id(), kind: "event", day, start, end, project, title, people, ...extra };
}
function milestone(day: number, project: ProjectId, title: string, extra: Partial<Item> = {}): Item {
  return { id: id(), kind: "milestone", day, project, title, people: [], ...extra };
}
function span(day: number, endDay: number, project: ProjectId, title: string, people: PersonId[], extra: Partial<Item> = {}): Item {
  return { id: id(), kind: "span", day, endDay, project, title, people, ...extra };
}

export const ITEMS: Item[] = [
  // ── Last week and earlier: mostly done ─────────────────────────────
  task(-10, "crumb", "Sign off packaging proofs", ["lena"], { done: true }),
  task(-10, "heat", "Draft the methods section", ["you"], { done: true }),
  task(-9, "orchard", "Confirm autumn menu with the kitchen", ["dev"], { done: true }),
  event(-8, t(9, 30), t(12), "crumb", "Photo shoot at the bakery", ["lena", "you"], { done: true, place: "Crumb & Co, Stoneybatter" }),
  task(-7, "heat", "Book the thermal camera from the lab", ["ronan"], { done: true }),
  task(-6, "wedding", "Send revised quote to Mara & Finn", ["you"], { done: true }),
  task(-3, "crumb", "Print the shelf cards", ["lena"], { done: true }),
  event(-3, t(11), t(12, 30), "orchard", "Harvest supper menu tasting", ["dev", "you"], { done: true, place: "The Orchard kitchen" }),
  milestone(-2, "crumb", "Crumb & Co launch", { done: true, note: "Sold out of sourdough by eleven." }),
  event(-2, t(7, 30), t(10), "crumb", "Launch morning at the shop", ["lena", "you", "tomas"], { done: true, place: "Crumb & Co, Smithfield" }),
  task(-1, "crumb", "Send the launch recap to Crumb & Co", ["you"], { done: true }),
  task(-1, "wedding", "Chase the florist for the deposit", ["aoife"], { note: "Invoice sent 18 Sep. Two reminders so far." }),

  // ── This week ──────────────────────────────────────────────────────
  event(0, t(9, 15), t(9, 45), "orchard", "Weekly check-in", ["you", "dev", "tomas"], { place: "Video call" }),
  event(0, t(14), t(15), "orchard", "Supplier call with Hollow Tree Farm", ["dev"], { note: "Apples for the harvest supper and the Christmas menu." }),
  event(0, t(16, 30), t(17, 30), "orchard", "Tasting menu run-through", ["dev", "you"], { place: "The Orchard kitchen" }),
  task(0, "wedding", "Finalise the seating plan draft", ["you"], { note: "Two tables still waiting on plus-ones." }),
  task(0, "heat", "Upload the sensor calibration notes", ["ronan"]),
  task(0, "orchard", "Approve the October rota", ["you"]),
  task(0, "wedding", "Reply to Finn about the ceilidh band", ["you"]),
  task(1, "wedding", "Order table linen samples", ["aoife"]),
  task(1, "orchard", "Print the harvest supper menus", ["dev"]),
  event(1, t(19), t(23), "orchard", "Harvest supper", ["dev", "you", "tomas"], { place: "The long barn", note: "72 guests. Two coeliac, one vegan." }),

  // ── Next week ──────────────────────────────────────────────────────
  span(4, 6, "heat", "Collect survey data at Smithfield", ["ronan", "you"], { place: "Smithfield Square", note: "Three readings a day: 08:00, 13:00, 18:00." }),
  event(4, t(10), t(10, 45), "orchard", "Studio meeting", ["you", "dev", "aoife", "tomas"]),
  task(4, "wedding", "Brief the catering team on dietary needs", ["dev"]),
  event(5, t(14), t(15, 30), "wedding", "Site visit with Mara & Finn", ["you", "aoife"], { place: "The Orchard, the long barn", note: "Walk the ceremony route and check where the band sets up." }),
  task(5, "wedding", "Confirm the marquee size", ["aoife"]),
  task(6, "heat", "Upload day-one readings", ["ronan"]),
  event(7, t(11, 30), t(12), "heat", "Check-in with Dr Nolan", ["you", "ronan"], { place: "Room 2.14" }),
  task(7, "wedding", "Send the save-the-date reminders", ["aoife"]),
  milestone(8, "heat", "Fieldwork complete"),
  task(8, "heat", "Back up the raw data", ["ronan"]),

  // ── In 2 weeks ─────────────────────────────────────────────────────
  task(11, "heat", "Clean the survey dataset", ["ronan", "you"]),
  task(11, "wedding", "Final guest numbers to the kitchen", ["aoife"]),
  event(12, t(11), t(12, 30), "wedding", "Menu tasting with Mara & Finn", ["dev"], { place: "The Orchard kitchen" }),
  task(12, "orchard", "Service the coffee machine", ["tomas"]),
  task(13, "wedding", "Book parking for the photographer", ["aoife"]),
  task(13, "heat", "Draw the first heat map", ["you"]),
  milestone(14, "heat", "Draft report to Dr Nolan"),
  event(15, t(18), t(21), "orchard", "Open evening at The Orchard", ["you", "dev", "tomas", "aoife"], { place: "The long barn" }),
  task(15, "orchard", "Put up the open evening signs", ["tomas"]),
  task(15, "orchard", "Stock the bar for the open evening", ["dev"]),

  // ── In 3 weeks: the wedding ────────────────────────────────────────
  task(20, "wedding", "Walk through the final checklist", ["aoife", "you"]),
  task(20, "wedding", "Confirm the ceremony running order", ["you"]),
  event(21, t(15), t(16), "wedding", "Final meeting with Mara & Finn", ["you", "aoife"], { place: "Video call" }),
  task(21, "wedding", "Collect the welcome signs from the printer", ["tomas"]),
  span(22, 24, "wedding", "Wedding weekend at The Orchard", ["you", "aoife", "dev", "tomas"]),
  event(22, t(17), t(18), "wedding", "Ceremony rehearsal", ["you", "aoife"], { place: "The walled garden" }),
  milestone(23, "wedding", "Mara & Finn's wedding", { note: "120 guests. Ceremony at two in the walled garden." }),
  event(23, t(9), t(10), "wedding", "Florist arrives", ["aoife"]),
  event(23, t(10), t(12), "wedding", "Hair and make-up in the cottage", ["aoife"]),
  event(23, t(12, 30), t(13), "wedding", "Photographer arrives", ["you"]),
  event(23, t(14), t(14, 45), "wedding", "Ceremony", ["you", "aoife"], { place: "The walled garden" }),
  event(23, t(15), t(17), "wedding", "Drinks reception", ["dev", "tomas"], { place: "The orchard lawn" }),
  event(23, t(17, 30), t(19, 30), "wedding", "Dinner service", ["dev", "tomas"], { place: "The long barn" }),
  event(23, t(19, 30), t(20, 15), "wedding", "Speeches", ["you"]),
  event(23, t(21), t(0, 30), "wedding", "Ceilidh band", ["tomas"]),
  task(23, "wedding", "Hand out the welcome packs", ["aoife"]),
  task(24, "wedding", "Return the hired glassware", ["tomas"]),
  task(26, "wedding", "Send a thank-you note to Mara & Finn", ["you"]),
  task(26, "wedding", "Invoice the final balance", ["you"]),
  event(28, t(10), t(11), "heat", "Present findings to the class", ["you", "ronan"], { place: "Lecture theatre B" }),

  // ── November onwards: sparse ───────────────────────────────────────
  task(33, "orchard", "Draft the Christmas menu", ["dev"]),
  milestone(36, "heat", "Final report submitted"),
  event(40, t(19), t(21), "orchard", "Wreath-making workshop", ["tomas", "aoife"], { place: "The long barn" }),
  task(46, "orchard", "Order the Christmas trees", ["tomas"]),
  task(48, "orchard", "Send Christmas party packs", ["you"]),
  milestone(55, "orchard", "Christmas menu goes live"),
  event(63, t(12), t(17), "orchard", "Christmas market", ["you", "dev", "tomas", "aoife"], { place: "The courtyard" }),

  // ── Needs a date ───────────────────────────────────────────────────
  task(undefined, "wedding", "Choose the ceremony music", ["you"]),
  task(undefined, "heat", "Ask the council for the tree-cover map", ["ronan"]),
  task(undefined, "orchard", "Refresh the website photos", ["tomas"]),
  task(undefined, "orchard", "Plan the staff Christmas night", ["you"]),
  task(undefined, "heat", "Write the methods appendix", ["you"]),
  task(undefined, "wedding", "Order spare festoon lights", ["aoife"]),
];

export const ABSENCES: Absence[] = [
  { person: "aoife", from: 0, to: 0, why: "annual leave" },
  { person: "aoife", from: 12, to: 12, why: "annual leave" },
  { person: "ronan", from: 26, to: 27, why: "a conference" },
];

export const HOLIDAYS: Holiday[] = [{ day: 25, label: "October bank holiday" }];

/** Hand-written briefs for days that deserve more than the computed one. */
export const BRIEFS: Record<number, string> = {
  [-1]: "The florist deposit is still open. Aoife has sent two reminders.",
  0: "Aoife is out today. Dev has the supplier call at 14:00, then the run-through with you at 16:30. The seating plan is the one to finish.",
  1: "Harvest supper tonight: 72 guests, two coeliac, one vegan. Menus need printing before four.",
  5: "Site visit with Mara & Finn at 14:00. Bring the marquee drawings. Day 2 of the Smithfield readings.",
  12: "Aoife is out. Dev has the tasting at 11 with Mara & Finn.",
  15: "Open evening from 18:00. Everyone is on, so keep the afternoon clear.",
  22: "Rehearsal at five in the walled garden. The weekend starts here.",
  23: "The big day. Florist at nine, ceremony at two, band until half twelve.",
};
