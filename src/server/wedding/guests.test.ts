import assert from "node:assert/strict";
import { test } from "node:test";
import { freshMemoryDb } from "../db/memory-test-db";
import { users, weddingGuests, weddingHouseholds, workspaceMembers, workspaces } from "../db/schema";
import {
  GuestListError,
  addGuestWith,
  addHouseholdWith,
  deleteGuestWith,
  deleteHouseholdWith,
  importHouseholdsWith,
  readGuestListWith,
  readWeddingIdsWith,
  readWeddingProjectWith,
  setHouseholdRsvpWith,
  updateGuestWith,
  updateHouseholdWith,
} from "./guests";
import { groupImport, parseGuestImport } from "@/lib/wedding/guests";

/**
 * The guest list against the real schema in a disposable in-memory database
 * (foreign keys off, so every scope is proved by its own predicate). Nothing
 * here touches a configured database.
 *
 * Run with: node --import tsx --import ./src/test/register-server-only.mjs --test src/server/wedding/guests.test.ts
 */

async function seeded() {
  const local = await freshMemoryDb();
  await local.db.insert(users).values({ id: "orla", clerkId: "orla", handle: "orla", name: "Orla", email: "orla@example.test", initials: "OR", color: "fixture" });
  await local.db.insert(workspaces).values([
    { id: "w-a", slug: "w-a", name: "Mara & Finn", ownerUserId: "orla", activeDomain: "wedding", primaryDate: "2026-10-03", primaryDateLabel: "Wedding day" },
    { id: "w-b", slug: "w-b", name: "Other wedding", ownerUserId: "orla", templateId: "wedding-planning-workspace" },
    { id: "w-c", slug: "w-c", name: "Launch", ownerUserId: "orla" },
  ]);
  await local.db.insert(workspaceMembers).values([
    { workspaceId: "w-a", userId: "orla", role: "owner" },
    { workspaceId: "w-b", userId: "orla", role: "owner" },
  ]);
  return local;
}

test("a wedding is recognised by domain or template, and only then", async () => {
  const { db } = await seeded();
  assert.deepEqual(await readWeddingProjectWith(db, "w-a"), { isWedding: true, date: "2026-10-03", dateLabel: "Wedding day" });
  assert.equal((await readWeddingProjectWith(db, "w-b")).isWedding, true);
  assert.equal((await readWeddingProjectWith(db, "w-c")).isWedding, false);
  assert.equal((await readWeddingProjectWith(db, "missing")).isWedding, false);
  assert.deepEqual((await readWeddingIdsWith(db, ["w-a", "w-b", "w-c"])).sort(), ["w-a", "w-b"]);
  assert.deepEqual(await readWeddingIdsWith(db, []), []);
});

test("a household is added with its people, a child's meal and an unnamed plus-one", async () => {
  const { db } = await seeded();
  const id = await addHouseholdWith(db, "w-a", "orla", {
    guests: [{ firstName: "  Aoife ", lastName: "Byrne" }, { firstName: "Ella", lastName: "Keane", isChild: true }, { firstName: "  " }],
    unnamedPlusOne: true,
    email: "AOIFE@Example.com",
    groupLabel: "Mara’s family",
  });
  const { households } = await readGuestListWith(db, "w-a");
  assert.equal(households.length, 1);
  const [h] = households;
  assert.equal(h!.id, id);
  assert.equal(h!.name, "Aoife and Ella");
  assert.equal(h!.email, "aoife@example.com");
  assert.deepEqual(h!.guests.map((g) => [g.firstName, g.meal, g.plusOneOf === h!.guests[0]!.id]), [
    ["Aoife", "not_provided", false],
    ["Ella", "child", false],
    [null, "not_provided", true],
  ]);
  assert.equal((await readGuestListWith(db, "w-b")).households.length, 0, "another Project sees none of it");
});

test("bad input is refused in words, never saved", async () => {
  const { db } = await seeded();
  await assert.rejects(addHouseholdWith(db, "w-a", "orla", { guests: [{ firstName: " " }] }), (e) => e instanceof GuestListError && e.code === "invalid");
  await assert.rejects(addHouseholdWith(db, "w-a", "orla", { guests: [{ firstName: "A" }], email: "not an email" }), (e) => e instanceof GuestListError && e.code === "invalid");
  assert.equal((await readGuestListWith(db, "w-a")).households.length, 0);
});

test("every write is scoped: an id from another Project matches nothing", async () => {
  const { db } = await seeded();
  const theirs = await addHouseholdWith(db, "w-b", "orla", { guests: [{ firstName: "Private", lastName: "Person" }] });
  const [theirGuest] = (await readGuestListWith(db, "w-b")).households[0]!.guests;
  await assert.rejects(updateHouseholdWith(db, "w-a", theirs, { name: "Hijacked" }), (e) => e instanceof GuestListError && e.code === "not-found");
  await assert.rejects(setHouseholdRsvpWith(db, "w-a", theirs, "attending"), (e) => e instanceof GuestListError && e.code === "not-found");
  await assert.rejects(updateGuestWith(db, "w-a", theirGuest!.id, { rsvp: "attending" }), (e) => e instanceof GuestListError && e.code === "not-found");
  await assert.rejects(deleteGuestWith(db, "w-a", theirGuest!.id), (e) => e instanceof GuestListError && e.code === "not-found");
  await assert.rejects(deleteHouseholdWith(db, "w-a", theirs), (e) => e instanceof GuestListError && e.code === "not-found");
  await assert.rejects(addGuestWith(db, "w-a", theirs, { firstName: "Intruder" }), (e) => e instanceof GuestListError && e.code === "not-found");
  const after = (await readGuestListWith(db, "w-b")).households[0]!;
  assert.equal(after.name, "Person household");
  assert.equal(after.guests.length, 1);
  assert.equal(after.guests[0]!.rsvp, "awaiting");
});

test("replies, meals and dietary needs change one person or the whole household", async () => {
  const { db } = await seeded();
  const id = await addHouseholdWith(db, "w-a", "orla", { guests: [{ firstName: "Úna", lastName: "Gallagher" }, { firstName: "Pádraig", lastName: "Gallagher" }] });
  await setHouseholdRsvpWith(db, "w-a", id, "attending");
  let [h] = (await readGuestListWith(db, "w-a")).households;
  assert.deepEqual(h!.guests.map((g) => g.rsvp), ["attending", "attending"]);
  await updateGuestWith(db, "w-a", h!.guests[1]!.id, { meal: "vegetarian", dietary: "  Coeliac  ", rsvp: "not_attending" });
  [h] = (await readGuestListWith(db, "w-a")).households;
  assert.deepEqual([h!.guests[1]!.meal, h!.guests[1]!.dietary, h!.guests[1]!.rsvp], ["vegetarian", "Coeliac", "not_attending"]);
  await assert.rejects(updateGuestWith(db, "w-a", h!.guests[0]!.id, { firstName: "" }), (e) => e instanceof GuestListError && e.code === "invalid");
  await updateHouseholdWith(db, "w-a", id, { invitation: "sent", invitedTo: "evening", notes: "Step-free access" });
  [h] = (await readGuestListWith(db, "w-a")).households;
  assert.deepEqual([h!.invitation, h!.invitedTo, h!.notes], ["sent", "evening", "Step-free access"]);
});

test("removing a person takes their unnamed plus-one, and the last person takes the household", async () => {
  const { db } = await seeded();
  const id = await addHouseholdWith(db, "w-a", "orla", { guests: [{ firstName: "Conor" }, { firstName: "Méabh" }], unnamedPlusOne: true });
  let [h] = (await readGuestListWith(db, "w-a")).households;
  const [conor, meabh] = h!.guests;
  await deleteGuestWith(db, "w-a", conor!.id);
  [h] = (await readGuestListWith(db, "w-a")).households;
  assert.deepEqual(h!.guests.map((g) => g.firstName), ["Méabh"]);
  const named = await addGuestWith(db, "w-a", id, { plusOneOf: meabh!.id });
  await updateGuestWith(db, "w-a", named, { firstName: "Rob" });
  await deleteGuestWith(db, "w-a", meabh!.id);
  [h] = (await readGuestListWith(db, "w-a")).households;
  assert.deepEqual(h!.guests.map((g) => [g.firstName, g.plusOneOf]), [["Rob", null]], "a named plus-one stays, now in their own right");
  await deleteGuestWith(db, "w-a", named);
  assert.equal((await readGuestListWith(db, "w-a")).households.length, 0);
  assert.equal((await db.select().from(weddingHouseholds)).length, 0);
});

test("removing a household removes its people explicitly, with no cascade", async () => {
  const { db } = await seeded();
  const id = await addHouseholdWith(db, "w-a", "orla", { guests: [{ firstName: "A" }, { firstName: "B" }] });
  await deleteHouseholdWith(db, "w-a", id);
  assert.equal((await db.select().from(weddingGuests)).length, 0);
});

test("an import adds every household or none, within the list's limit", async () => {
  const { db } = await seeded();
  const groups = groupImport(parseGuestImport("Ann Lee, ann@example.com\nBen Lee, ann@example.com\nCara Fox").rows);
  assert.deepEqual(await importHouseholdsWith(db, "w-a", "orla", groups), { households: 2, guests: 3 });
  const many = groupImport(parseGuestImport(Array.from({ length: 598 }, (_, i) => `Guest${i} Person`).join("\n")).rows);
  await assert.rejects(importHouseholdsWith(db, "w-a", "orla", many), (e) => e instanceof GuestListError && e.code === "limit");
  assert.equal((await db.select().from(weddingGuests)).length, 3, "the refused import left nothing behind");
});
