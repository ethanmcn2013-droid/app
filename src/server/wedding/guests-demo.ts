import type { Guest, GuestListRead, Household, InvitedTo, Meal, Rsvp } from "@/lib/wedding/guests";

/**
 * The sample guest list for Mara & Finn (review and demo only). It agrees with
 * the sample conversations: the dietary list is not final yet, with two
 * vegetarians, one coeliac and one nut allergy known so far.
 */

type P = [first: string | null, last: string | null, rsvp: Rsvp, meal: Meal, dietary?: string | null, child?: boolean, plusOneOfIndex?: number];

function household(
  n: number,
  name: string,
  group: string,
  people: P[],
  extra: Partial<Pick<Household, "email" | "phone" | "address" | "notes">> & { invitedTo?: InvitedTo; sent?: boolean } = {},
): Household {
  const id = `demo-wh-${String(n).padStart(2, "0")}`;
  const guests: Guest[] = people.map(([firstName, lastName, rsvp, meal, dietary, child, plusOneOfIndex], i) => ({
    id: `${id}-g${i + 1}`,
    householdId: id,
    firstName,
    lastName,
    rsvp,
    meal,
    dietary: dietary ?? null,
    isChild: child === true,
    plusOneOf: plusOneOfIndex === undefined ? null : `${id}-g${plusOneOfIndex + 1}`,
  }));
  return {
    id,
    name,
    email: extra.email ?? null,
    phone: extra.phone ?? null,
    address: extra.address ?? null,
    groupLabel: group,
    invitedTo: extra.invitedTo ?? "day",
    invitation: extra.sent === false ? "not_sent" : "sent",
    notes: extra.notes ?? null,
    guests,
  };
}

export const DEMO_GUEST_LIST: GuestListRead = {
  households: [
    household(1, "Byrne household", "Mara’s family", [
      ["Siobhán", "Byrne", "attending", "no_preference"],
      ["Declan", "Byrne", "attending", "no_preference"],
    ], { email: "siobhan.byrne@example.com", address: "14 Orchard Lane, Kilkenny" }),
    household(2, "Aoife and Rob", "Mara’s family", [
      ["Aoife", "Byrne", "attending", "vegetarian"],
      ["Rob", "Keane", "attending", "no_preference"],
      ["Ella", "Keane", "attending", "child", null, true],
    ], { email: "aoife.byrne@example.com" }),
    household(3, "Nana Kathleen", "Mara’s family", [
      ["Kathleen", "Doyle", "attending", "pescatarian", "Soft food, please. No shellfish."],
    ], { phone: "056 772 1180", notes: "Needs a seat near the door and step-free access." }),
    household(4, "Gallagher household", "Finn’s family", [
      ["Úna", "Gallagher", "attending", "no_preference"],
      ["Pádraig", "Gallagher", "attending", "no_preference", "Coeliac"],
    ], { email: "una.gallagher@example.com" }),
    household(5, "Conor Gallagher", "Finn’s family", [
      ["Conor", "Gallagher", "attending", "no_preference"],
      [null, null, "attending", "not_provided", null, false, 0],
    ], { email: "conor.g@example.com" }),
    household(6, "Lynch household", "Finn’s family", [
      ["Gráinne", "Lynch", "awaiting", "not_provided"],
      ["Tadhg", "Lynch", "awaiting", "not_provided"],
      ["Rían", "Lynch", "awaiting", "child", null, true],
      ["Saoirse", "Lynch", "awaiting", "child", null, true],
    ], { email: "grainne.lynch@example.com" }),
    household(7, "Auntie Bríd", "Finn’s family", [
      ["Bríd", "Gallagher", "not_attending", "not_provided"],
    ], { notes: "Sent a card. In Boston that week." }),
    household(8, "Niamh and Jack", "College friends", [
      ["Niamh", "Walsh", "attending", "vegetarian"],
      ["Jack", "Moran", "attending", "no_preference", "Nut allergy, severe"],
    ], { email: "niamh.walsh@example.com" }),
    household(9, "Ciara Fitzgerald", "College friends", [
      ["Ciara", "Fitzgerald", "attending", "vegan"],
    ], { email: "ciara.fitz@example.com" }),
    household(10, "Seán and Holly", "College friends", [
      ["Seán", "Kelly", "awaiting", "not_provided"],
      ["Holly", "Brennan", "awaiting", "not_provided"],
    ], { email: "sean.kelly@example.com" }),
    household(11, "Dara Quinn", "College friends", [
      ["Dara", "Quinn", "attending", "not_provided"],
      ["Méabh", "Quinn", "attending", "not_provided"],
    ], { email: "dara.quinn@example.com" }),
    household(12, "Tom Ryan", "College friends", [
      ["Tom", "Ryan", "not_attending", "not_provided"],
    ], { email: "tom.ryan@example.com" }),
    household(13, "O’Brien household", "Mara’s work", [
      ["Lauren", "O’Brien", "attending", "no_preference"],
      ["Mark", "O’Brien", "attending", "no_preference"],
    ], { email: "lauren.obrien@example.com" }),
    household(14, "Emma Daly", "Mara’s work", [
      ["Emma", "Daly", "awaiting", "not_provided"],
      [null, null, "awaiting", "not_provided", null, false, 0],
    ], { email: "emma.daly@example.com" }),
    household(15, "Kevin Nolan", "Finn’s work", [
      ["Kevin", "Nolan", "attending", "no_preference"],
    ], { email: "kevin.nolan@example.com" }),
    household(16, "Róisín and Eoin", "Finn’s work", [
      ["Róisín", "Murphy", "awaiting", "not_provided"],
      ["Eoin", "Murphy", "awaiting", "not_provided"],
    ], { email: "roisin.murphy@example.com", sent: false }),
    household(17, "Football club", "Finn’s friends", [
      ["Liam", "Healy", "attending", "no_preference"],
      ["Cathal", "Burke", "attending", "no_preference"],
      ["Shane", "Duffy", "awaiting", "not_provided"],
    ], { invitedTo: "evening", email: "liam.healy@example.com" }),
    household(18, "Neighbours on Orchard Lane", "Mara’s family", [
      ["Maura", "Kinsella", "attending", "no_preference"],
      ["Joe", "Kinsella", "attending", "no_preference"],
    ], { invitedTo: "evening" }),
    household(19, "Book club", "Mara’s friends", [
      ["Fiona", "Hayes", "awaiting", "not_provided"],
      ["Gemma", "Power", "attending", "no_preference"],
      ["Sinéad", "Carroll", "not_attending", "not_provided"],
    ], { invitedTo: "evening", email: "fiona.hayes@example.com", sent: false }),
  ],
};
