import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NO_FILTER,
  catererCsv,
  defaultHouseholdName,
  filterHouseholds,
  groupImport,
  guestName,
  guestTotals,
  householdRsvp,
  initials,
  parseGuestImport,
  type Guest,
  type Household,
} from "./guests";
import { DEMO_GUEST_LIST } from "../../server/wedding/guests-demo";

/**
 * The guest list's pure logic: totals that reconcile, a reply per household,
 * import that never guesses, and a caterer's file that carries no contact
 * details and cannot run as a formula.
 *
 * Run with: node --import tsx --test src/lib/wedding/guests.test.ts
 */

const guest = (id: string, seed: Partial<Guest> = {}): Guest => ({
  id,
  householdId: "h1",
  firstName: id,
  lastName: null,
  rsvp: "awaiting",
  meal: "not_provided",
  dietary: null,
  isChild: false,
  plusOneOf: null,
  ...seed,
});

const household = (id: string, guests: Guest[], seed: Partial<Household> = {}): Household => ({
  id,
  name: `${id} household`,
  email: "private@example.test",
  phone: "087 000 0000",
  address: "1 Private Road",
  groupLabel: null,
  invitedTo: "day",
  invitation: "not_sent",
  notes: "PRIVATE NOTE",
  guests,
  ...seed,
});

test("totals reconcile: attending, awaiting and not attending add up to everyone", () => {
  const totals = guestTotals(DEMO_GUEST_LIST.households);
  assert.equal(totals.attending + totals.awaiting + totals.notAttending, totals.people);
  assert.equal(totals.households, DEMO_GUEST_LIST.households.length);
  assert.ok(totals.mealsMissing <= totals.attending);
  assert.ok(totals.dietaryAlerts <= totals.attending);
});

test("the sample list agrees with the sample conversation about dietary needs", () => {
  const needs = DEMO_GUEST_LIST.households.flatMap((h) => h.guests).map((g) => g.dietary ?? "").join(" | ");
  assert.match(needs, /Coeliac/);
  assert.match(needs, /Nut allergy/);
});

test("an unnamed plus-one is named for the person who brings them", () => {
  const host = guest("g1", { firstName: "Theo", lastName: "Bennett" });
  const plus = guest("g2", { firstName: null, plusOneOf: "g1" });
  assert.equal(guestName(plus, [host, plus]), "Guest of Theo Bennett");
  assert.equal(initials(guestName(plus, [host, plus])), "+1");
  assert.equal(initials("Siobhán Byrne"), "SB");
  assert.equal(guestName(guest("g3", { firstName: null, plusOneOf: "gone" }), []), "Guest, name to come");
});

test("a household's reply is shared, mixed or empty", () => {
  assert.equal(householdRsvp(household("a", [guest("1", { rsvp: "attending" }), guest("2", { rsvp: "attending" })])), "attending");
  assert.equal(householdRsvp(household("b", [guest("1", { rsvp: "attending" }), guest("2")])), "mixed");
  assert.equal(householdRsvp(household("c", [])), "empty");
});

test("filters narrow people, keep their household, and drop empty households", () => {
  const list = [
    household("a", [guest("Ann", { rsvp: "attending" }), guest("Bob")]),
    household("b", [guest("Cara")], { invitedTo: "evening", groupLabel: "Book club" }),
  ];
  assert.deepEqual(filterHouseholds(list, { ...NO_FILTER, rsvp: "attending" }).map((h) => h.guests.map((g) => g.id)), [["Ann"]]);
  assert.deepEqual(filterHouseholds(list, { ...NO_FILTER, invitedTo: "evening" }).map((h) => h.id), ["b"]);
  assert.deepEqual(filterHouseholds(list, { ...NO_FILTER, query: "book" }).map((h) => h.id), ["b"]);
  assert.equal(filterHouseholds(list, NO_FILTER).length, 2);
});

test("a household is named after its shared surname, else its people", () => {
  assert.equal(defaultHouseholdName([{ firstName: "Úna", lastName: "Gallagher" }, { firstName: "Pádraig", lastName: "Gallagher" }]), "Gallagher household");
  assert.equal(defaultHouseholdName([{ firstName: "Niamh", lastName: "Walsh" }, { firstName: "Jack", lastName: "Moran" }]), "Niamh and Jack");
  assert.equal(defaultHouseholdName([{ firstName: "A" }, { firstName: "B" }, { firstName: "C" }]), "A and 2 others");
});

test("a pasted list reads names and emails, and groups a shared email into one household", () => {
  const result = parseGuestImport("Siobhán Byrne, siobhan@example.com\nDeclan Byrne, SIOBHAN@example.com\nConor Gallagher\n\n,,\n");
  assert.equal(result.rows.length, 3);
  assert.equal(result.skipped, 1);
  assert.equal(result.rows[1]!.email, "siobhan@example.com");
  const groups = groupImport(result.rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0]!.guests.map((g) => g.firstName), ["Siobhán", "Declan"]);
});

test("a spreadsheet with a header uses the columns it recognises, quotes included", () => {
  const csv = 'First name,Last name,Household,Email,Evening only\n"Mary ""Mae""",O\'Neill,The O\'Neills,mae@example.com,yes\nTom,O\'Neill,the o\'neills,,no\nLiz,Ray,,not-an-email,\n';
  const { rows, skipped } = parseGuestImport(csv);
  assert.equal(skipped, 0);
  assert.equal(rows[0]!.firstName, 'Mary "Mae"');
  assert.equal(rows[0]!.invitedTo, "evening");
  assert.equal(rows[2]!.email, null);
  const groups = groupImport(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.guests.length, 2);
  assert.equal(groups[0]!.invitedTo, "day");
});

test("a semicolon or tab separated export reads the same", () => {
  assert.equal(parseGuestImport("Name;Email\nAnn Lee;ann@example.com\n").rows[0]!.lastName, "Lee");
  assert.equal(parseGuestImport("Name\tEmail\nAnn Lee\tann@example.com\n").rows[0]!.email, "ann@example.com");
});

test("the caterer's file lists attending guests only, by surname, without contact details", () => {
  const list = [
    household("a", [
      guest("1", { firstName: "Zoe", lastName: "Adams", rsvp: "attending", meal: "vegan" }),
      guest("2", { firstName: "Al", lastName: "Burke", rsvp: "not_attending" }),
    ]),
    household("b", [guest("3", { firstName: "Bea", lastName: "Aaron", rsvp: "attending", dietary: "Coeliac", isChild: true, meal: "child" })]),
  ];
  const csv = catererCsv(list, { meal: true, dietary: true, household: false });
  assert.equal(csv, "Guest,Meal,Dietary needs\nBea Aaron (child),Child's meal,Coeliac\nZoe Adams,Vegan,None reported\n");
  assert.doesNotMatch(csv, /private|PRIVATE|087|Road/);
});

test("an unnamed plus-one is listed straight after their host", () => {
  const host = guest("1", { firstName: "Conor", lastName: "Gallagher", rsvp: "attending" });
  const plus = guest("2", { firstName: null, plusOneOf: "1", rsvp: "attending" });
  const csv = catererCsv([household("a", [plus, host]), household("b", [guest("3", { firstName: "Ann", lastName: "Hayes", rsvp: "attending" })])], { meal: false, dietary: false, household: false });
  assert.equal(csv, "Guest\nConor Gallagher\nGuest of Conor Gallagher\nAnn Hayes\n");
});

test("the caterer's file cannot run a formula in a spreadsheet", () => {
  const list = [household("a", [guest("1", { firstName: "=HYPERLINK(\"x\")", rsvp: "attending", dietary: "+1 nuts, \"severe\"" })])];
  const csv = catererCsv(list, { meal: false, dietary: true, household: true });
  const line = csv.split("\n")[1]!;
  assert.ok(line.startsWith(`"'=HYPERLINK(""x"")"`), line);
  assert.match(line, /"'\+1 nuts, ""severe"""$/);
});
