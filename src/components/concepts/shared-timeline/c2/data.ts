/**
 * Sample worlds for the Countdown Instrument. Every date is UTC so the
 * server and every visitor's browser agree on the same numbers.
 */

export type WorldId = "agency" | "wedding" | "supper";

export type Milestone = {
  id: string;
  /** Full name, used in lists and the story view. */
  name: string;
  /** Short rim label on the dial. */
  short: string;
  /** When it happens (UTC ms). */
  at: number;
  /** Where it was before it moved, if it moved. */
  movedFrom?: number;
  /** What the upcoming milestone is, said as a sentence start: "Beta opens". */
  soon: string;
  /** One plain sentence about it. */
  note: string;
  /** The event the whole countdown is for. */
  isEvent?: boolean;
};

export type RunItem = { time: string; what: string };

export type World = {
  id: WorldId;
  /** Who shares this page. */
  from: string;
  monogram: string;
  /** The h1. */
  title: string;
  /** "Launch night", "The wedding", "Supper club". */
  eventName: string;
  /** Lower-case form used mid-sentence: "launch night". */
  eventInline: string;
  target: number;
  whenLong: string;
  timeLine: string;
  /** "7pm" */
  timeShort: string;
  place: string;
  address: string;
  /** Minutes the event lasts, for the calendar file. */
  durationMin: number;
  /** "We're live". */
  liveLine: string;
  /** "Launched" / "Married" / "Held". */
  pastVerb: string;
  status: string;
  statusNote: string;
  lastChangeDays: number;
  lastChange: string;
  milestones: Milestone[];
  recap: { figure: string; label: string }[];
  recapNote: string;
  detailsTitle: string;
  detailsIntro: string;
  run: RunItem[];
  gettingThere: string;
  extra?: { label: string; value: string };
  noDateNote: string;
};

const day = (y: number, m: number, d: number, h = 12, min = 0) => Date.UTC(y, m - 1, d, h, min, 0);

/** 25 September 2026, early morning in Dublin. */
export const TODAY = Date.UTC(2026, 8, 25, 4, 37, 52);

export const WORLDS: Record<WorldId, World> = {
  agency: {
    id: "agency",
    from: "Northlight Studio × Kiln Pottery",
    monogram: "NK",
    title: "Kiln, the booking app for Kiln Pottery Dublin",
    eventName: "Launch night",
    eventInline: "launch night",
    target: day(2026, 11, 3, 19, 0),
    whenLong: "Tuesday 3 November 2026",
    timeLine: "7pm to 10pm",
    timeShort: "7pm",
    place: "Kiln's Smithfield studio",
    address: "14 Smithfield Square, Dublin 7",
    durationMin: 180,
    liveLine: "We're live",
    pastVerb: "Launched",
    status: "On track for 3 November",
    statusNote: "Nothing is holding the launch up.",
    lastChangeDays: 2,
    lastChange: "App store review moved from 20 to 24 October.",
    milestones: [
      {
        id: "brief",
        name: "Brief signed",
        short: "Brief signed",
        at: day(2026, 6, 4),
        soon: "Brief signing",
        note: "Kiln and Northlight agreed what the app must do: book a class, pay, and move a booking without a phone call.",
      },
      {
        id: "brand",
        name: "Brand and name approved",
        short: "Brand approved",
        at: day(2026, 7, 2),
        soon: "Brand sign-off",
        note: "The name Kiln stayed. The glaze-blue colour and the hand-drawn wheel mark were signed off by Aoife.",
      },
      {
        id: "designs",
        name: "First designs approved",
        short: "Designs approved",
        at: day(2026, 7, 30),
        soon: "Design sign-off",
        note: "Twelve screens, from finding a class to the reminder the night before. Two rounds of changes.",
      },
      {
        id: "built",
        name: "Built and tested with the Kiln team",
        short: "Built and tested",
        at: day(2026, 9, 3),
        soon: "Testing with the Kiln team",
        note: "Kiln's four teachers booked, cancelled and rebooked classes for a week. Nine small fixes went in.",
      },
      {
        id: "beta",
        name: "Beta with 40 potters",
        short: "Beta opens",
        at: day(2026, 10, 4),
        soon: "Beta opens",
        note: "Forty regulars from Kiln's Thursday classes use the app for real bookings and payments for two weeks.",
      },
      {
        id: "store",
        name: "App store review",
        short: "App store review",
        at: day(2026, 10, 24),
        movedFrom: day(2026, 10, 20),
        soon: "App store review",
        note: "Apple and Google check the app before it can go public. We moved this by four days to fit in beta feedback.",
      },
      {
        id: "press",
        name: "Press preview",
        short: "Press preview",
        at: day(2026, 10, 29),
        soon: "Press preview",
        note: "Six Dublin food and craft writers get the app a week early, with a class at the studio.",
      },
      {
        id: "launch",
        name: "Launch night",
        short: "Launch night",
        at: day(2026, 11, 3, 19, 0),
        soon: "Launch night",
        note: "The app goes public in both stores at 7pm, live from the studio floor.",
        isEvent: true,
      },
    ],
    recap: [
      { figure: "412", label: "classes booked in the first week" },
      { figure: "4.8", label: "stars from 61 reviews" },
      { figure: "0", label: "phone calls to move a booking" },
    ],
    recapNote: "The Thursday wheel class sold out in eleven minutes. Northlight keeps looking after the app until the end of January.",
    detailsTitle: "Launch night",
    detailsIntro: "Come and see Kiln go live. Wheels will be spinning, the first public booking happens on stage, and there is food from Grano next door.",
    run: [
      { time: "7:00", what: "Doors open, wheel demos on the studio floor" },
      { time: "7:45", what: "The app goes public, first booking made live" },
      { time: "8:15", what: "A few words from Aoife, Kiln's founder" },
      { time: "10:00", what: "Last glaze, last drinks" },
    ],
    gettingThere: "Red Line Luas to Smithfield, then two minutes on foot. Bikes can go in the yard.",
    extra: { label: "Guests", value: "80 people, invite only" },
    noDateNote: "We will post the launch date here as soon as app store review comes back.",
  },
  wedding: {
    id: "wedding",
    from: "Mara Quinn and Finn Byrne",
    monogram: "M&F",
    title: "Mara and Finn are getting married",
    eventName: "The wedding",
    eventInline: "the wedding",
    target: day(2027, 5, 22, 14, 0),
    whenLong: "Saturday 22 May 2027",
    timeLine: "Ceremony at 2pm",
    timeShort: "2pm",
    place: "The Orchard",
    address: "Ballinacor Road, Rathdrum, Co. Wicklow",
    durationMin: 600,
    liveLine: "It's the day",
    pastVerb: "Married",
    status: "On track for 22 May",
    statusNote: "Everything booked so far is confirmed.",
    lastChangeDays: 5,
    lastChange: "Final numbers moved from 17 to 24 April.",
    milestones: [
      {
        id: "venue",
        name: "The Orchard booked",
        short: "Venue booked",
        at: day(2026, 3, 14),
        soon: "Venue booking",
        note: "The barn, the walled garden and the old apple trees, for one day in May.",
      },
      {
        id: "save",
        name: "Save the dates sent",
        short: "Save the dates",
        at: day(2026, 5, 2),
        soon: "Save the dates go out",
        note: "One hundred and ten cards, hand-addressed by Mara's sister Clíona.",
      },
      {
        id: "band",
        name: "Photographer and band booked",
        short: "Band booked",
        at: day(2026, 6, 20),
        soon: "Band booking",
        note: "Aisling Keane behind the camera and The Lovely Tones after dinner.",
      },
      {
        id: "dress",
        name: "First dress fitting",
        short: "Dress fitting",
        at: day(2026, 9, 5),
        soon: "First fitting",
        note: "Second fitting in March. Nobody is getting a photo of it.",
      },
      {
        id: "invites",
        name: "Invitations go out",
        short: "Invitations",
        at: day(2026, 10, 16),
        soon: "Invitations go out",
        note: "Paper invitations with a link back to this page, so everyone can see what is coming.",
      },
      {
        id: "rsvp",
        name: "Replies close",
        short: "Replies close",
        at: day(2027, 2, 5),
        soon: "Replies close",
        note: "Please let us know by then, including anything you cannot eat.",
      },
      {
        id: "tasting",
        name: "Menu tasting at The Orchard",
        short: "Menu tasting",
        at: day(2027, 3, 13),
        soon: "Menu tasting",
        note: "Three starters, two mains, one very serious cake decision.",
      },
      {
        id: "numbers",
        name: "Final numbers to The Orchard",
        short: "Final numbers",
        at: day(2027, 4, 24),
        movedFrom: day(2027, 4, 17),
        soon: "Final numbers",
        note: "The Orchard gave us an extra week, so late replies can still get a seat.",
      },
      {
        id: "day",
        name: "The wedding",
        short: "The day",
        at: day(2027, 5, 22, 14, 0),
        soon: "The wedding",
        note: "Ceremony in the walled garden, dinner in the barn, dancing until late.",
        isEvent: true,
      },
    ],
    recap: [
      { figure: "104", label: "guests made it" },
      { figure: "3", label: "speeches, all under ten minutes" },
      { figure: "1", label: "cake, gone by nine" },
    ],
    recapNote: "Thank you for being there. Aisling's photos arrive in July, and we will post the link here.",
    detailsTitle: "The day",
    detailsIntro: "We would love you to be there. Come for the ceremony in the walled garden and stay for dinner and dancing in the barn.",
    run: [
      { time: "1:30", what: "Arrive and find a seat in the garden" },
      { time: "2:00", what: "Ceremony" },
      { time: "3:00", what: "Drinks under the apple trees" },
      { time: "5:30", what: "Dinner in the barn, then dancing" },
    ],
    gettingThere: "A coach leaves the Grand Hotel Wicklow at 12:45 and comes back at midnight and 1am.",
    extra: { label: "Dress", value: "Garden smart, flat shoes welcome" },
    noDateNote: "We will share the date here once The Orchard confirms it.",
  },
  supper: {
    id: "supper",
    from: "The Orchard",
    monogram: "TO",
    title: "The Harvest Supper Club",
    eventName: "Supper club",
    eventInline: "the supper club",
    target: day(2026, 10, 17, 19, 30),
    whenLong: "Saturday 17 October 2026",
    timeLine: "7:30pm, one long table",
    timeShort: "7:30pm",
    place: "The barn at The Orchard",
    address: "Ballinacor Road, Rathdrum, Co. Wicklow",
    durationMin: 240,
    liveLine: "Doors are open",
    pastVerb: "Held",
    status: "On track for 17 October",
    statusNote: "94 of 120 seats are taken.",
    lastChangeDays: 1,
    lastChange: "Wine tasting moved from 26 to 30 September.",
    milestones: [
      {
        id: "menu",
        name: "Menu drafted",
        short: "Menu drafted",
        at: day(2026, 8, 10),
        soon: "Menu drafted",
        note: "Five courses built around what the orchard and three Wicklow farms have in October.",
      },
      {
        id: "growers",
        name: "Growers confirmed",
        short: "Growers",
        at: day(2026, 8, 24),
        soon: "Growers confirm",
        note: "Apples and pears from us, lamb from Glenmalure, cheese from Ballyhook.",
      },
      {
        id: "tickets",
        name: "Tickets on sale",
        short: "Tickets on sale",
        at: day(2026, 9, 1),
        soon: "Tickets go on sale",
        note: "120 seats at one long table in the barn.",
      },
      {
        id: "half",
        name: "Half the seats gone",
        short: "Half sold",
        at: day(2026, 9, 12),
        soon: "Half sold",
        note: "Faster than last year, mostly thanks to the cider pairing.",
      },
      {
        id: "wine",
        name: "Wine and cider tasting",
        short: "Tasting",
        at: day(2026, 9, 30),
        movedFrom: day(2026, 9, 26),
        soon: "Tasting",
        note: "Choosing one drink for each course with Wicklow Wolf and our own cider press.",
      },
      {
        id: "seating",
        name: "Seating plan final",
        short: "Seating plan",
        at: day(2026, 10, 10),
        soon: "Seating plan",
        note: "Groups sit together. Solo guests sit near the kitchen, which is the best spot.",
      },
      {
        id: "last",
        name: "Last tickets",
        short: "Last tickets",
        at: day(2026, 10, 14),
        soon: "Last tickets",
        note: "Whatever is left goes on sale to the waiting list first.",
      },
      {
        id: "supper",
        name: "Supper club",
        short: "Supper club",
        at: day(2026, 10, 17, 19, 30),
        soon: "Supper club",
        note: "Five courses, one long table, the barn lit with lanterns.",
        isEvent: true,
      },
    ],
    recap: [
      { figure: "120", label: "seats filled" },
      { figure: "38", label: "kilos of apples, pressed and baked" },
      { figure: "4.9", label: "average rating from guests" },
    ],
    recapNote: "The winter supper is on 12 December. Everyone who came this time gets first pick of seats.",
    detailsTitle: "The supper",
    detailsIntro: "Five courses at one long table in the barn, with a drink chosen for each one. Come hungry and a bit early.",
    run: [
      { time: "7:00", what: "Cider in the yard" },
      { time: "7:30", what: "Sit down, first course" },
      { time: "9:00", what: "A walk through the orchard with lanterns" },
      { time: "11:30", what: "Last pour" },
    ],
    gettingThere: "Parking in the lower field. A minibus runs from Rathdrum station at 6:40pm.",
    extra: { label: "Seats", value: "26 of 120 left" },
    noDateNote: "We will post the date as soon as the growers confirm the harvest.",
  },
};

export const WORLD_ORDER: WorldId[] = ["agency", "wedding", "supper"];

export const WORLD_LABEL: Record<WorldId, string> = {
  agency: "Kiln launch",
  wedding: "Wedding",
  supper: "Supper club",
};

export type Moment = "live" | "far" | "finalDay" | "finalTen" | "after" | "noDate";

export const MOMENT_ORDER: Moment[] = ["live", "far", "finalDay", "finalTen", "after", "noDate"];

export const MOMENT_LABEL: Record<Moment, string> = {
  live: "Today",
  far: "A year out",
  finalDay: "Final day",
  finalTen: "Last ten seconds",
  after: "After",
  noDate: "No date yet",
};

const DAY = 86_400_000;

/** The simulated "now" for a world at a given moment. */
export function momentNow(world: World, moment: Moment): number {
  switch (moment) {
    case "far":
      return world.target - 431 * DAY - 5 * 3_600_000;
    case "finalDay":
      return world.target - (6 * 3600 + 41 * 60 + 12) * 1000;
    case "finalTen":
      return world.target - 10_000;
    case "after":
      return world.target + 12 * DAY + 2 * 3_600_000;
    default:
      return TODAY;
  }
}
