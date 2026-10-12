import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { weddingGuests, weddingHouseholds, workspaces } from "@/server/db/schema";
import { isDemoMode } from "@/lib/access-mode";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import {
  ADDRESS_MAX,
  DIETARY_MAX,
  GROUP_MAX,
  GUEST_LIMIT,
  HOUSEHOLD_NAME_MAX,
  INVITED_TO_VALUES,
  MEAL_VALUES,
  NAME_MAX,
  NOTES_MAX,
  RSVP_VALUES,
  cleanEmail,
  cleanText,
  defaultHouseholdName,
  type Guest,
  type GuestListRead,
  type Household,
  type Meal,
  type NewHouseholdInput,
  type Rsvp,
  type GuestPatch,
  type HouseholdPatch,
} from "@/lib/wedding/guests";

export type { GuestPatch, HouseholdPatch } from "@/lib/wedding/guests";
import { DEMO_GUEST_LIST } from "@/server/wedding/guests-demo";

/**
 * Wedding tools: the guest list (12 Oct 2026).
 *
 * Reads take a Project the route boundary already proved openable. Writes take
 * an executor the action has already authorized inside its own transaction,
 * and every statement still carries `workspace_id`, so a guest or household id
 * from another Project matches nothing. Children are deleted explicitly, never
 * left to a cascade: tests run with foreign keys off to prove exactly that.
 */

type Database = typeof db;
type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;

export type WeddingProject = Readonly<{ isWedding: boolean; date: string | null; dateLabel: string | null }>;

/** A Project is a wedding when it was made as one, by context, domain or template. */
export function isWeddingWorkspace(row: { contextType: string | null; activeDomain: string | null; templateId: string | null }): boolean {
  return row.contextType === "wedding" || row.activeDomain === "wedding" || Boolean(row.templateId?.toLowerCase().includes("wedding"));
}

export async function loadWeddingProject(workspaceId: string): Promise<WeddingProject> {
  if (isDemoMode()) return { isWedding: true, date: REVIEW_SUITE_FIXTURE.primaryDate.date, dateLabel: REVIEW_SUITE_FIXTURE.primaryDate.label };
  return readWeddingProjectWith(db, workspaceId);
}

export async function readWeddingProjectWith(database: Executor, workspaceId: string): Promise<WeddingProject> {
  const [row] = await database
    .select({
      contextType: workspaces.contextType,
      activeDomain: workspaces.activeDomain,
      templateId: workspaces.templateId,
      primaryDate: workspaces.primaryDate,
      primaryDateLabel: workspaces.primaryDateLabel,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) return { isWedding: false, date: null, dateLabel: null };
  return { isWedding: isWeddingWorkspace(row), date: row.primaryDate ?? null, dateLabel: row.primaryDateLabel ?? null };
}

/** Which of these Projects are weddings. Used by the sidebar to nest Wedding tools. */
export async function readWeddingIdsWith(database: Executor, workspaceIds: readonly string[]): Promise<string[]> {
  if (workspaceIds.length === 0) return [];
  const rows = await database
    .select({ id: workspaces.id, contextType: workspaces.contextType, activeDomain: workspaces.activeDomain, templateId: workspaces.templateId })
    .from(workspaces)
    .where(inArray(workspaces.id, [...workspaceIds]));
  return rows.filter(isWeddingWorkspace).map((row) => row.id);
}

export async function loadGuestList(workspaceId: string): Promise<GuestListRead> {
  if (isDemoMode()) return DEMO_GUEST_LIST;
  return readGuestListWith(db, workspaceId);
}

const pick = <T extends string>(values: readonly T[], value: string, fallback: T): T =>
  (values as readonly string[]).includes(value) ? (value as T) : fallback;

/** The list itself, over any database handle, so a test can prove its scope. */
export async function readGuestListWith(database: Executor, workspaceId: string): Promise<GuestListRead> {
  const [householdRows, guestRows] = await Promise.all([
    database
      .select()
      .from(weddingHouseholds)
      .where(eq(weddingHouseholds.workspaceId, workspaceId))
      .orderBy(asc(weddingHouseholds.createdAt), asc(weddingHouseholds.id)),
    database
      .select()
      .from(weddingGuests)
      .where(eq(weddingGuests.workspaceId, workspaceId))
      .orderBy(asc(weddingGuests.sortOrder), asc(weddingGuests.createdAt), asc(weddingGuests.id)),
  ]);
  const byHousehold = new Map<string, Guest[]>();
  for (const row of guestRows) {
    const guest: Guest = {
      id: row.id,
      householdId: row.householdId,
      firstName: row.firstName,
      lastName: row.lastName,
      rsvp: pick(RSVP_VALUES, row.rsvp, "awaiting"),
      meal: pick(MEAL_VALUES, row.meal, "not_provided"),
      dietary: row.dietary,
      isChild: row.isChild,
      plusOneOf: row.plusOneOf,
    };
    byHousehold.set(row.householdId, [...(byHousehold.get(row.householdId) ?? []), guest]);
  }
  const households: Household[] = householdRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    groupLabel: row.groupLabel,
    invitedTo: pick(INVITED_TO_VALUES, row.invitedTo, "day"),
    invitation: row.invitation === "sent" ? "sent" : "not_sent",
    notes: row.notes,
    // A guest whose household row is missing is not shown anywhere: it has no invitation.
    guests: byHousehold.get(row.id) ?? [],
  }));
  return { households };
}

// ── Writes ──────────────────────────────────────────────────────────────

export type GuestListErrorCode = "invalid" | "not-found" | "limit";

/** A refusal the action turns into plain words. Never carries another Project's data. */
export class GuestListError extends Error {
  constructor(readonly code: GuestListErrorCode, message: string) {
    super(message);
  }
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
const householdId = () => `wh-${randomUUID()}`;
const guestId = () => `wg-${randomUUID()}`;

async function guestCount(ex: Executor, workspaceId: string): Promise<number> {
  const [row] = await ex.select({ n: count() }).from(weddingGuests).where(eq(weddingGuests.workspaceId, workspaceId));
  return Number(row?.n ?? 0);
}

async function assertRoom(ex: Executor, workspaceId: string, adding: number): Promise<void> {
  if ((await guestCount(ex, workspaceId)) + adding > GUEST_LIMIT) {
    throw new GuestListError("limit", `A guest list holds up to ${GUEST_LIMIT} people.`);
  }
}

function cleanHouseholdFields(input: Partial<NewHouseholdInput> & { notes?: string | null }) {
  const email = input.email === undefined ? undefined : cleanEmail(input.email);
  if (email === "invalid") throw new GuestListError("invalid", "That email address doesn’t look right.");
  return {
    ...(input.name !== undefined ? { name: cleanText(input.name, HOUSEHOLD_NAME_MAX) } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(input.phone !== undefined ? { phone: cleanText(input.phone, 40) } : {}),
    ...(input.address !== undefined ? { address: cleanText(input.address, ADDRESS_MAX) } : {}),
    ...(input.groupLabel !== undefined ? { groupLabel: cleanText(input.groupLabel, GROUP_MAX) } : {}),
    ...(input.invitedTo !== undefined ? { invitedTo: pick(INVITED_TO_VALUES, input.invitedTo, "day") } : {}),
    ...(input.notes !== undefined ? { notes: cleanText(input.notes, NOTES_MAX) } : {}),
  };
}

/** Adds one invitation and its people. Returns the new household id. */
export async function addHouseholdWith(
  ex: Executor,
  workspaceId: string,
  actorUserId: string,
  input: NewHouseholdInput,
): Promise<string> {
  const named = input.guests
    .map((g) => ({ firstName: cleanText(g.firstName, NAME_MAX), lastName: cleanText(g.lastName ?? null, NAME_MAX), isChild: g.isChild === true }))
    .filter((g): g is { firstName: string; lastName: string | null; isChild: boolean } => g.firstName !== null);
  if (named.length === 0) throw new GuestListError("invalid", "Add at least one guest’s first name.");
  const total = named.length + (input.unnamedPlusOne ? 1 : 0);
  await assertRoom(ex, workspaceId, total);
  const fields = cleanHouseholdFields(input);
  const now = nowSeconds();
  const id = householdId();
  await ex.insert(weddingHouseholds).values({
    id,
    workspaceId,
    name: fields.name ?? defaultHouseholdName(named),
    email: fields.email ?? null,
    phone: fields.phone ?? null,
    address: fields.address ?? null,
    groupLabel: fields.groupLabel ?? null,
    invitedTo: fields.invitedTo ?? "day",
    invitation: "not_sent",
    notes: null,
    createdBy: actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  const rows = named.map((g, i) => ({
    id: guestId(),
    workspaceId,
    householdId: id,
    firstName: g.firstName,
    lastName: g.lastName,
    isChild: g.isChild,
    meal: (g.isChild ? "child" : "not_provided") as Meal,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
  const plusOne = input.unnamedPlusOne
    ? [{ id: guestId(), workspaceId, householdId: id, firstName: null, lastName: null, isChild: false, meal: "not_provided" as Meal, plusOneOf: rows[0]!.id, sortOrder: rows.length, createdAt: now, updatedAt: now }]
    : [];
  await ex.insert(weddingGuests).values([...rows, ...plusOne]);
  return id;
}



export async function updateHouseholdWith(ex: Executor, workspaceId: string, id: string, patch: HouseholdPatch): Promise<void> {
  const fields = cleanHouseholdFields(patch);
  if ("name" in fields && !fields.name) throw new GuestListError("invalid", "A household needs a name.");
  const set = {
    ...fields,
    name: fields.name ?? undefined,
    ...(patch.invitation !== undefined ? { invitation: patch.invitation === "sent" ? "sent" : "not_sent" } : {}),
    updatedAt: nowSeconds(),
  };
  const done = await ex
    .update(weddingHouseholds)
    .set(set)
    .where(and(eq(weddingHouseholds.id, id), eq(weddingHouseholds.workspaceId, workspaceId)))
    .returning({ id: weddingHouseholds.id });
  if (done.length === 0) throw new GuestListError("not-found", "That household isn’t on this list.");
}



export async function updateGuestWith(ex: Executor, workspaceId: string, id: string, patch: GuestPatch): Promise<void> {
  const [current] = await ex
    .select({ plusOneOf: weddingGuests.plusOneOf })
    .from(weddingGuests)
    .where(and(eq(weddingGuests.id, id), eq(weddingGuests.workspaceId, workspaceId)))
    .limit(1);
  if (!current) throw new GuestListError("not-found", "That guest isn’t on this list.");
  const set: Partial<typeof weddingGuests.$inferInsert> = { updatedAt: nowSeconds() };
  if (patch.firstName !== undefined) {
    set.firstName = cleanText(patch.firstName, NAME_MAX);
    if (!set.firstName && !current.plusOneOf) throw new GuestListError("invalid", "A guest needs a first name.");
  }
  if (patch.lastName !== undefined) set.lastName = cleanText(patch.lastName, NAME_MAX);
  if (patch.rsvp !== undefined) set.rsvp = pick(RSVP_VALUES, patch.rsvp, "awaiting");
  if (patch.meal !== undefined) set.meal = pick(MEAL_VALUES, patch.meal, "not_provided");
  if (patch.dietary !== undefined) set.dietary = cleanText(patch.dietary, DIETARY_MAX);
  if (patch.isChild !== undefined) set.isChild = patch.isChild === true;
  await ex.update(weddingGuests).set(set).where(and(eq(weddingGuests.id, id), eq(weddingGuests.workspaceId, workspaceId)));
}

/** Adds a person to an existing invitation: named, or as someone's unnamed plus-one. */
export async function addGuestWith(
  ex: Executor,
  workspaceId: string,
  household: string,
  input: Readonly<{ firstName?: string | null; lastName?: string | null; isChild?: boolean; plusOneOf?: string | null }>,
): Promise<string> {
  const [owner] = await ex
    .select({ id: weddingHouseholds.id })
    .from(weddingHouseholds)
    .where(and(eq(weddingHouseholds.id, household), eq(weddingHouseholds.workspaceId, workspaceId)))
    .limit(1);
  if (!owner) throw new GuestListError("not-found", "That household isn’t on this list.");
  const firstName = cleanText(input.firstName ?? null, NAME_MAX);
  let plusOneOf: string | null = null;
  if (input.plusOneOf) {
    const [host] = await ex
      .select({ id: weddingGuests.id })
      .from(weddingGuests)
      .where(and(eq(weddingGuests.id, input.plusOneOf), eq(weddingGuests.householdId, household), eq(weddingGuests.workspaceId, workspaceId)))
      .limit(1);
    if (!host) throw new GuestListError("not-found", "That guest isn’t on this list.");
    plusOneOf = host.id;
  }
  if (!firstName && !plusOneOf) throw new GuestListError("invalid", "Add the guest’s first name.");
  await assertRoom(ex, workspaceId, 1);
  const siblings = await ex
    .select({ n: count() })
    .from(weddingGuests)
    .where(and(eq(weddingGuests.householdId, household), eq(weddingGuests.workspaceId, workspaceId)));
  const now = nowSeconds();
  const id = guestId();
  const isChild = input.isChild === true;
  await ex.insert(weddingGuests).values({
    id,
    workspaceId,
    householdId: household,
    firstName,
    lastName: cleanText(input.lastName ?? null, NAME_MAX),
    isChild,
    meal: isChild ? "child" : "not_provided",
    plusOneOf,
    sortOrder: Number(siblings[0]?.n ?? 0),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** One reply for everyone on the invitation, the way most households answer. */
export async function setHouseholdRsvpWith(ex: Executor, workspaceId: string, household: string, rsvp: Rsvp): Promise<void> {
  const value = pick(RSVP_VALUES, rsvp, "awaiting");
  const done = await ex
    .update(weddingGuests)
    .set({ rsvp: value, updatedAt: nowSeconds() })
    .where(and(eq(weddingGuests.householdId, household), eq(weddingGuests.workspaceId, workspaceId)))
    .returning({ id: weddingGuests.id });
  if (done.length === 0) throw new GuestListError("not-found", "That household isn’t on this list.");
}

/**
 * Removes one person. Their unnamed plus-one goes with them; a named plus-one
 * stays as a guest in their own right. The last person out takes the
 * household with them, so no empty invitation is left behind.
 */
export async function deleteGuestWith(ex: Executor, workspaceId: string, id: string): Promise<void> {
  const [guest] = await ex
    .select({ householdId: weddingGuests.householdId })
    .from(weddingGuests)
    .where(and(eq(weddingGuests.id, id), eq(weddingGuests.workspaceId, workspaceId)))
    .limit(1);
  if (!guest) throw new GuestListError("not-found", "That guest isn’t on this list.");
  const unnamedGuests = await ex
    .select({ id: weddingGuests.id, firstName: weddingGuests.firstName })
    .from(weddingGuests)
    .where(and(eq(weddingGuests.plusOneOf, id), eq(weddingGuests.workspaceId, workspaceId)));
  const unnamed = unnamedGuests.filter((g) => !g.firstName).map((g) => g.id);
  await ex.delete(weddingGuests).where(and(inArray(weddingGuests.id, [id, ...unnamed]), eq(weddingGuests.workspaceId, workspaceId)));
  await ex.update(weddingGuests).set({ plusOneOf: null }).where(and(eq(weddingGuests.plusOneOf, id), eq(weddingGuests.workspaceId, workspaceId)));
  const [left] = await ex
    .select({ n: count() })
    .from(weddingGuests)
    .where(and(eq(weddingGuests.householdId, guest.householdId), eq(weddingGuests.workspaceId, workspaceId)));
  if (Number(left?.n ?? 0) === 0) {
    await ex.delete(weddingHouseholds).where(and(eq(weddingHouseholds.id, guest.householdId), eq(weddingHouseholds.workspaceId, workspaceId)));
  }
}

export async function deleteHouseholdWith(ex: Executor, workspaceId: string, id: string): Promise<void> {
  const done = await ex
    .delete(weddingHouseholds)
    .where(and(eq(weddingHouseholds.id, id), eq(weddingHouseholds.workspaceId, workspaceId)))
    .returning({ id: weddingHouseholds.id });
  if (done.length === 0) throw new GuestListError("not-found", "That household isn’t on this list.");
  await ex.delete(weddingGuests).where(and(eq(weddingGuests.householdId, id), eq(weddingGuests.workspaceId, workspaceId)));
}

/** Adds every grouped household from an import, all or nothing. */
export async function importHouseholdsWith(
  ex: Executor,
  workspaceId: string,
  actorUserId: string,
  groups: readonly NewHouseholdInput[],
): Promise<{ households: number; guests: number }> {
  const people = groups.reduce((n, g) => n + g.guests.length, 0);
  if (people === 0) throw new GuestListError("invalid", "There were no names to add.");
  await assertRoom(ex, workspaceId, people);
  for (const group of groups) await addHouseholdWith(ex, workspaceId, actorUserId, group);
  return { households: groups.length, guests: people };
}
