/**
 * Wedding tools: the guest list (12 Oct 2026). Pure and client-safe.
 *
 * A household is one invitation; each guest in it replies for themselves.
 * Every total here reconciles: attending + awaiting + not attending = all
 * listed people, and each count says what it is out of.
 */

export const RSVP_VALUES = ["awaiting", "attending", "not_attending"] as const;
export type Rsvp = (typeof RSVP_VALUES)[number];

export const MEAL_VALUES = ["not_provided", "no_preference", "vegetarian", "vegan", "pescatarian", "child"] as const;
export type Meal = (typeof MEAL_VALUES)[number];

export const INVITED_TO_VALUES = ["day", "evening"] as const;
export type InvitedTo = (typeof INVITED_TO_VALUES)[number];

export const RSVP_LABEL: Record<Rsvp, string> = {
  awaiting: "Awaiting",
  attending: "Attending",
  not_attending: "Not attending",
};

export const MEAL_LABEL: Record<Meal, string> = {
  not_provided: "Not provided",
  no_preference: "No preference",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  child: "Child's meal",
};

export const INVITED_TO_LABEL: Record<InvitedTo, string> = { day: "Whole day", evening: "Evening only" };

export const NAME_MAX = 60;
export const HOUSEHOLD_NAME_MAX = 120;
export const DIETARY_MAX = 300;
export const NOTES_MAX = 1000;
export const ADDRESS_MAX = 500;
export const GROUP_MAX = 60;
/** One wedding's list stays readable and the import stays bounded. */
export const GUEST_LIMIT = 600;

export type Guest = Readonly<{
  id: string;
  householdId: string;
  firstName: string | null;
  lastName: string | null;
  rsvp: Rsvp;
  meal: Meal;
  dietary: string | null;
  isChild: boolean;
  /** Set when this guest came as someone's plus-one. */
  plusOneOf: string | null;
}>;

export type Household = Readonly<{
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  groupLabel: string | null;
  invitedTo: InvitedTo;
  invitation: "not_sent" | "sent";
  notes: string | null;
  guests: readonly Guest[];
}>;

export type GuestListRead = Readonly<{ households: readonly Household[] }>;

/** "Lily Bennett"; an unnamed plus-one reads "Guest of Theo Bennett". */
export function guestName(guest: Guest, all: readonly Guest[]): string {
  const name = [guest.firstName, guest.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  const host = guest.plusOneOf ? all.find((g) => g.id === guest.plusOneOf) : undefined;
  const hostName = host ? [host.firstName, host.lastName].filter(Boolean).join(" ").trim() : "";
  return hostName ? `Guest of ${hostName}` : "Guest, name to come";
}

export function initials(name: string): string {
  if (name.startsWith("Guest of ")) return "+1";
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

export type GuestTotals = Readonly<{
  people: number;
  households: number;
  attending: number;
  awaiting: number;
  notAttending: number;
  evening: number;
  children: number;
  /** Attending guests whose meal is still "Not provided". */
  mealsMissing: number;
  /** Attending guests with dietary needs recorded. */
  dietaryAlerts: number;
}>;

export function guestTotals(households: readonly Household[]): GuestTotals {
  let people = 0, attending = 0, awaiting = 0, notAttending = 0, evening = 0, children = 0, mealsMissing = 0, dietaryAlerts = 0;
  for (const household of households) {
    for (const guest of household.guests) {
      people++;
      if (guest.rsvp === "attending") attending++;
      else if (guest.rsvp === "awaiting") awaiting++;
      else notAttending++;
      if (household.invitedTo === "evening") evening++;
      if (guest.isChild) children++;
      if (guest.rsvp === "attending" && guest.meal === "not_provided") mealsMissing++;
      if (guest.rsvp === "attending" && guest.dietary?.trim()) dietaryAlerts++;
    }
  }
  return { people, households: households.length, attending, awaiting, notAttending, evening, children, mealsMissing, dietaryAlerts };
}

/** One shared reply for a household: the common value, or "mixed". */
export function householdRsvp(household: Household): Rsvp | "mixed" | "empty" {
  const values = new Set(household.guests.map((g) => g.rsvp));
  if (values.size === 0) return "empty";
  return values.size === 1 ? [...values][0]! : "mixed";
}

export type HouseholdPatch = Readonly<{
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  groupLabel?: string | null;
  invitedTo?: InvitedTo;
  invitation?: "not_sent" | "sent";
  notes?: string | null;
}>;

export type GuestPatch = Readonly<{
  firstName?: string | null;
  lastName?: string | null;
  rsvp?: Rsvp;
  meal?: Meal;
  dietary?: string | null;
  isChild?: boolean;
}>;

// ── Filters ─────────────────────────────────────────────────────────────

export type GuestFilter = Readonly<{
  query: string;
  rsvp: Rsvp | "all";
  meal: Meal | "all";
  invitedTo: InvitedTo | "all";
}>;

export const NO_FILTER: GuestFilter = { query: "", rsvp: "all", meal: "all", invitedTo: "all" };

export function filterHouseholds(households: readonly Household[], filter: GuestFilter): Household[] {
  const q = filter.query.trim().toLocaleLowerCase("en-IE");
  const out: Household[] = [];
  for (const household of households) {
    if (filter.invitedTo !== "all" && household.invitedTo !== filter.invitedTo) continue;
    const all = household.guests;
    const guests = all.filter((guest) => {
      if (filter.rsvp !== "all" && guest.rsvp !== filter.rsvp) return false;
      if (filter.meal !== "all" && guest.meal !== filter.meal) return false;
      if (!q) return true;
      const hay = `${guestName(guest, all)} ${household.name} ${household.groupLabel ?? ""}`.toLocaleLowerCase("en-IE");
      return hay.includes(q);
    });
    if (guests.length) out.push({ ...household, guests });
  }
  return out;
}

// ── Input checks (shared by the form and the server) ────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function cleanEmail(value: unknown): string | null | "invalid" {
  const email = cleanText(value, 254);
  if (!email) return null;
  return EMAIL_RE.test(email) ? email.toLowerCase() : "invalid";
}

export type NewGuestInput = Readonly<{ firstName: string; lastName?: string | null; isChild?: boolean }>;

export type NewHouseholdInput = Readonly<{
  guests: readonly NewGuestInput[];
  /** A plus-one with no name yet ("Guest of Noah"). Named plus-ones go in `guests`. */
  unnamedPlusOne?: boolean;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  groupLabel?: string | null;
  invitedTo?: InvitedTo;
}>;

/** "The Bennett household" from the guests, unless the couple named it. */
export function defaultHouseholdName(guests: readonly NewGuestInput[]): string {
  const surnames = [...new Set(guests.map((g) => g.lastName?.trim()).filter((s): s is string => Boolean(s)))];
  if (surnames.length === 1) return `${surnames[0]} household`;
  const firsts = guests.map((g) => g.firstName.trim()).filter(Boolean);
  if (firsts.length === 0) return "New household";
  return firsts.length <= 2 ? firsts.join(" and ") : `${firsts[0]} and ${firsts.length - 1} others`;
}

// ── Import from a spreadsheet or a pasted list ──────────────────────────

export type ImportRow = Readonly<{ firstName: string; lastName: string | null; household: string | null; email: string | null; invitedTo: InvitedTo }>;
export type ImportResult = Readonly<{ rows: ImportRow[]; skipped: number }>;

/** Splits one CSV line, honouring double quotes. */
function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

const HEADER = {
  first: /^(first( name)?|forename|given name)$/i,
  last: /^(last( name)?|surname|family name)$/i,
  full: /^(name|full name|guest|guest name)$/i,
  household: /^(household|family|party|invitation|group)$/i,
  email: /^(e-?mail|email address)$/i,
  evening: /^(evening|evening only|invited to|invite)$/i,
};

/**
 * Reads a pasted list or a CSV/TSV export. With a header row it maps the
 * columns it recognises; without one, each line is "First Last" or
 * "First Last, email". Lines it cannot read are counted, never guessed.
 */
export function parseGuestImport(text: string): ImportResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], skipped: 0 };
  const separator = lines[0]!.includes("\t") ? "\t" : lines[0]!.includes(",") || lines[0]!.includes(";") ? (lines[0]!.split(";").length > lines[0]!.split(",").length ? ";" : ",") : ",";
  const head = splitCsvLine(lines[0]!, separator);
  const index = (re: RegExp) => head.findIndex((h) => re.test(h));
  const hasHeader = [HEADER.first, HEADER.last, HEADER.full, HEADER.household, HEADER.email].some((re) => index(re) >= 0);
  const rows: ImportRow[] = [];
  let skipped = 0;
  const body = hasHeader ? lines.slice(1) : lines;
  const col = {
    first: hasHeader ? index(HEADER.first) : -1,
    last: hasHeader ? index(HEADER.last) : -1,
    full: hasHeader ? index(HEADER.full) : -1,
    household: hasHeader ? index(HEADER.household) : -1,
    email: hasHeader ? index(HEADER.email) : -1,
    evening: hasHeader ? index(HEADER.evening) : -1,
  };
  for (const line of body) {
    const cells = splitCsvLine(line, separator);
    let first = "", last: string | null = null, email: string | null = null, household: string | null = null;
    let invitedTo: InvitedTo = "day";
    if (hasHeader) {
      if (col.first >= 0) first = cells[col.first] ?? "";
      if (col.last >= 0) last = cleanText(cells[col.last], NAME_MAX);
      if (!first && col.full >= 0) {
        const parts = (cells[col.full] ?? "").split(/\s+/).filter(Boolean);
        first = parts.shift() ?? "";
        last = last ?? (parts.length ? parts.join(" ") : null);
      }
      if (col.household >= 0) household = cleanText(cells[col.household], HOUSEHOLD_NAME_MAX);
      if (col.email >= 0) { const e = cleanEmail(cells[col.email]); email = e === "invalid" ? null : e; }
      if (col.evening >= 0) invitedTo = /^(y|yes|evening|true|1)/i.test(cells[col.evening] ?? "") ? "evening" : "day";
    } else {
      const [namePart, emailPart] = [cells[0] ?? "", cells.slice(1).find((c) => c.includes("@"))];
      const parts = namePart.split(/\s+/).filter(Boolean);
      first = parts.shift() ?? "";
      last = parts.length ? parts.join(" ") : null;
      if (emailPart) { const e = cleanEmail(emailPart); email = e === "invalid" ? null : e; }
    }
    const firstName = cleanText(first, NAME_MAX);
    if (!firstName) { skipped++; continue; }
    rows.push({ firstName, lastName: cleanText(last, NAME_MAX), household, email, invitedTo });
  }
  return { rows: rows.slice(0, GUEST_LIMIT), skipped: skipped + Math.max(0, rows.length - GUEST_LIMIT) };
}

/**
 * Groups import rows into households: by the household column when there is
 * one, else by shared email, else one household per person.
 */
export function groupImport(rows: readonly ImportRow[]): NewHouseholdInput[] {
  const groups = new Map<string, ImportRow[]>();
  rows.forEach((row, i) => {
    const key = row.household ? `h:${row.household.toLocaleLowerCase("en-IE")}` : row.email ? `e:${row.email}` : `p:${i}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return [...groups.values()].map((members) => ({
    name: members[0]!.household,
    email: members.find((m) => m.email)?.email ?? null,
    invitedTo: members.every((m) => m.invitedTo === "evening") ? "evening" : "day",
    guests: members.map((m) => ({ firstName: m.firstName, lastName: m.lastName })),
  }));
}

// ── The caterer's export ─────────────────────────────────────────────────

export type CatererColumns = Readonly<{ meal: boolean; dietary: boolean; household: boolean }>;

function csvCell(value: string): string {
  // Leading = + - @ would run as a formula in a spreadsheet; quote them away.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Attending guests only: name, meal and dietary needs, sorted by surname.
 * Contact details and private notes never enter this file.
 */
export function catererCsv(households: readonly Household[], columns: CatererColumns): string {
  const header = ["Guest", ...(columns.household ? ["Household"] : []), ...(columns.meal ? ["Meal"] : []), ...(columns.dietary ? ["Dietary needs"] : [])];
  const rows: { sort: string; cells: string[] }[] = [];
  for (const household of households) {
    for (const guest of household.guests) {
      if (guest.rsvp !== "attending") continue;
      const name = guestName(guest, household.guests);
      rows.push({
        sort: `${guest.lastName ?? ""} ${guest.firstName ?? ""}`.toLocaleLowerCase("en-IE"),
        cells: [
          name + (guest.isChild ? " (child)" : ""),
          ...(columns.household ? [household.name] : []),
          ...(columns.meal ? [MEAL_LABEL[guest.meal]] : []),
          ...(columns.dietary ? [guest.dietary?.trim() || "None reported"] : []),
        ],
      });
    }
  }
  rows.sort((a, b) => a.sort.localeCompare(b.sort, "en-IE"));
  return [header, ...rows.map((r) => r.cells)].map((line) => line.map(csvCell).join(",")).join("\n") + "\n";
}
