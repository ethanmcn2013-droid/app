/*
 * Weekly check-in: sample data for the Orchard.
 *
 * Invented, front-end only. "Today" is Friday 25 September 2026; the last
 * check-in ran on Monday 14 September, so this week's (21 Sep) is still due.
 */

export type Status = "on" | "risk" | "off";
export type Lane = "needs" | "watch" | "smooth" | "wrapped";
export type Weight = "needs" | "watch" | "fine";
export type SignalKind = "overdue" | "review" | "clash" | "declared" | "quiet" | "deadline" | "owner" | "link";

export type Person = {
  id: string;
  name: string;
  first: string;
  initials: string;
  role: string;
  hue: number;
  pronoun: "her" | "him" | "them";
};

export type Signal = {
  id: string;
  kind: SignalKind;
  weight: Weight;
  /** Leads the card when it is the strongest open signal. */
  sentence: string;
  detail: string;
};

export type ActionOption = { label: string; toast: string; /** The consequence, shown under the label. */ detail?: string };

export type Action = {
  id: string;
  label: string;
  kind: "resolve" | "nudge" | "choose" | "open";
  signalId?: string;
  toast?: string;
  done?: string;
  options?: ActionOption[];
};

export type HistoryEntry = { week: string; status: Status; line: string };

export type NextItem = { title: string; owner: string; due: string; late?: boolean };
export type Milestone = { title: string; date: string; done?: boolean; moved?: string };
export type Waiting = { person: string; count: number; what: string };
export type KeyLink = { label: string; kind: "doc" | "sheet" | "image" | "link" | "slides" | "design" };
export type Activity = { who: string; what: string; when: string };

export type Project = {
  id: string;
  name: string;
  hue: number;
  owner: string | null;
  date: string;
  dateWhat: string;
  daysOut: number;
  done: number;
  total: number;
  wrapped?: { on: string; note: string };
  isNew?: boolean;
  /** One line shown when nothing is asking for attention. */
  calm: string;
  signals: Signal[];
  actions: Action[];
  declared: { status: Status; by: string; when: string } | null;
  history: HistoryEntry[];
  since: { done: number; added: number; overdue: number };
  suggestion: { status: Status; line: string };
  next: NextItem[];
  milestones: Milestone[];
  waiting: Waiting[];
  links: KeyLink[];
  activity: Activity[];
};

export const ME = "orla";
export const TODAY = "Friday 25 September";
export const THIS_WEEK = "21 Sep";
export const WEEKS = ["10 Aug", "17 Aug", "24 Aug", "31 Aug", "7 Sep", "14 Sep"];

export const PEOPLE: Record<string, Person> = {
  orla: { id: "orla", name: "Orla Byrne", first: "Orla", initials: "OB", role: "Venue manager", hue: 1, pronoun: "her" },
  sam: { id: "sam", name: "Sam Kelly", first: "Sam", initials: "SK", role: "Bar and suppliers", hue: 6, pronoun: "him" },
  niamh: { id: "niamh", name: "Niamh Walsh", first: "Niamh", initials: "NW", role: "Events planner", hue: 8, pronoun: "her" },
  aoife: { id: "aoife", name: "Aoife Ryan", first: "Aoife", initials: "AR", role: "Marketing", hue: 2, pronoun: "her" },
  declan: { id: "declan", name: "Declan Moore", first: "Declan", initials: "DM", role: "Moore & Sons, contractor", hue: 5, pronoun: "him" },
  ciara: { id: "ciara", name: "Ciara Dunne", first: "Ciara", initials: "CD", role: "Year 5 teacher", hue: 3, pronoun: "her" },
  tomas: { id: "tomas", name: "Tomás Reilly", first: "Tomás", initials: "TR", role: "Designer", hue: 4, pronoun: "him" },
};

export const LANES: { id: Lane; title: string; hint: string }[] = [
  { id: "needs", title: "Needs you", hint: "Something is waiting on you, or will be soon." },
  { id: "watch", title: "Keep an eye on", hint: "Moving, with someone on it. Worth a look." },
  { id: "smooth", title: "Running smoothly", hint: "Nothing to do here this week." },
  { id: "wrapped", title: "Recently wrapped", hint: "Finished in the last 30 days." },
];

export const STATUS_LABEL: Record<Status, string> = { on: "On track", risk: "At risk", off: "Off track" };

/** Where each signal was read from, and since when. Shown when a card has only one thing to say. */
export const SIGNAL_FROM: Record<string, string> = {
  tonic: "From Tasks · due Mon 14 Sep",
  seating: "From Files · sent Tue 22 Sep",
  clash: "From Timeline · moved Mon 21 Sep",
  quote: "From Files · sent Wed 16 Sep",
  photos: "From Aoife's status · Tue 22 Sep",
  copy: "From Tasks · no owner since Fri 18 Sep",
  stalls: "From Tasks · deposits due Thu 1 Oct",
  quiet: "From Tasks · last activity Sun 13 Sep",
  owner: "From Tasks · created Tue 22 Sep",
};

export const PROJECTS: Project[] = [
  {
    id: "mara-finn",
    name: "Mara & Finn's wedding",
    hue: 8,
    owner: "orla",
    date: "Sat 3 Oct",
    dateWhat: "Wedding day",
    daysOut: 8,
    done: 31,
    total: 42,
    calm: "Everything is in hand for the day.",
    signals: [
      {
        id: "tonic",
        kind: "overdue",
        weight: "needs",
        sentence: "Tonic and olives order is 11 days overdue and the day is in 8 days.",
        detail: "Task was due Mon 14 Sep. Sam owns it and hasn't updated it since.",
      },
      {
        id: "seating",
        kind: "review",
        weight: "needs",
        sentence: "Seating plan has waited 3 days for your review.",
        detail: "Niamh sent version 3 on Tuesday. Table cards print once it is approved.",
      },
    ],
    actions: [
      { id: "a1", label: "Review seating plan", kind: "resolve", signalId: "seating", toast: "Seating plan approved. Niamh can print the table cards.", done: "Approved" },
      { id: "a2", label: "Nudge Sam", kind: "nudge", signalId: "tonic", toast: "Sam will get a nudge about the tonic and olives order.", done: "Nudged just now" },
    ],
    declared: { status: "on", by: "orla", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Menu tasting done. Finn wants the lamb, Mara wants the hake; both it is." },
      { week: "17 Aug", status: "on", line: "Florist confirmed. Band sent their set list for sign-off." },
      { week: "24 Aug", status: "on", line: "Replies all back: 112 yes, 6 no. Dietary list is in the run sheet." },
      { week: "31 Aug", status: "on", line: "Marquee booked for the courtyard in case of rain." },
      { week: "7 Sep", status: "risk", line: "Bar order slipping. Sam is chasing the supplier." },
      { week: "14 Sep", status: "on", line: "Bar sorted apart from tonic and olives. Seating plan next." },
    ],
    since: { done: 4, added: 2, overdue: 1 },
    suggestion: { status: "risk", line: "Seating plan is with me and the tonic order is late; chasing Sam today." },
    next: [
      { title: "Approve seating plan v3", owner: "orla", due: "Today" },
      { title: "Order tonic and olives", owner: "sam", due: "11 days late", late: true },
      { title: "Confirm final numbers with the caterer", owner: "niamh", due: "Tue 29 Sep" },
    ],
    milestones: [
      { title: "Invites out", date: "20 Jul", done: true },
      { title: "Menu locked", date: "28 Aug", done: true },
      { title: "Final numbers", date: "29 Sep" },
      { title: "Rehearsal", date: "2 Oct" },
      { title: "The day", date: "3 Oct" },
    ],
    waiting: [
      { person: "orla", count: 1, what: "Seating plan review" },
      { person: "niamh", count: 2, what: "Table cards, final numbers" },
      { person: "sam", count: 1, what: "Tonic and olives order" },
    ],
    links: [
      { label: "Run sheet", kind: "doc" },
      { label: "Seating plan v3", kind: "sheet" },
      { label: "Supplier contacts", kind: "sheet" },
      { label: "Flower mood board", kind: "image" },
    ],
    activity: [
      { who: "niamh", what: "commented on the run sheet", when: "1 hour ago" },
      { who: "orla", what: "added Buy guest book pens", when: "Thursday" },
      { who: "sam", what: "finished Confirm ice delivery", when: "Wednesday" },
      { who: "niamh", what: "shared Seating plan v3 for review", when: "Tuesday" },
    ],
  },
  {
    id: "barn-roof",
    name: "Barn roof and heating works",
    hue: 9,
    owner: "orla",
    date: "Fri 13 Nov",
    dateWhat: "Heating on",
    daysOut: 49,
    done: 9,
    total: 20,
    calm: "Works are on programme.",
    signals: [
      {
        id: "clash",
        kind: "clash",
        weight: "needs",
        sentence: "Contractor pushed the roof works two weeks; heating is due before the Kavanagh 40th.",
        detail: "Roof now finishes 30 Oct. Heating is commissioned Fri 13 Nov, the day before the party in the barn.",
      },
      {
        id: "quote",
        kind: "deadline",
        weight: "watch",
        sentence: "The heating quote is still waiting for your signature.",
        detail: "Declan sent it on 16 Sep. Price holds until 2 Oct.",
      },
    ],
    actions: [
      {
        id: "a1",
        label: "Decide on heating",
        kind: "choose",
        done: "Decided",
        signalId: "clash",
        options: [
          { label: "Ask for heating by Fri 6 Nov", detail: "The Kavanagh 40th keeps a week of slack. Declan has to agree.", toast: "Asked Declan to bring heating forward to Fri 6 Nov. The Kavanagh 40th keeps a week of margin." },
          { label: "Keep 13 Nov, hire patio heaters", detail: "No change for Declan. Adds a hire task for Niamh.", toast: "Kept 13 Nov. Added Hire patio heaters to the Kavanagh 40th for Niamh." },
        ],
      },
      { id: "a2", label: "Message Declan", kind: "nudge", signalId: "clash", toast: "Started a message to Declan about the new heating date.", done: "Message started" },
    ],
    declared: { status: "risk", by: "orla", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Scaffold quotes in. Going with Moore & Sons." },
      { week: "17 Aug", status: "on", line: "Survey done: two slates and the flashing, nothing worse." },
      { week: "24 Aug", status: "on", line: "Contract signed. Works start 5 Oct." },
      { week: "31 Aug", status: "on", line: "Heating spec agreed with Declan: underfloor in the main barn." },
      { week: "7 Sep", status: "risk", line: "Declan flagged a delay on the slates from the quarry." },
      { week: "14 Sep", status: "risk", line: "Slates still delayed. Watching the knock-on for November." },
    ],
    since: { done: 2, added: 3, overdue: 0 },
    suggestion: { status: "off", line: "Roof slipped two weeks, so heating lands the day before the Kavanagh 40th. Asking Declan for 6 Nov." },
    next: [
      { title: "Agree a new heating date with Declan", owner: "orla", due: "Mon 28 Sep" },
      { title: "Sign the heating quote", owner: "orla", due: "Fri 2 Oct" },
      { title: "Share the revised programme with Niamh", owner: "orla", due: "Tue 29 Sep" },
    ],
    milestones: [
      { title: "Contract signed", date: "28 Aug", done: true },
      { title: "Roof starts", date: "19 Oct", moved: "was 5 Oct" },
      { title: "Roof done", date: "30 Oct", moved: "was 16 Oct" },
      { title: "Heating on", date: "13 Nov" },
    ],
    waiting: [
      { person: "orla", count: 2, what: "Heating quote, new date" },
      { person: "declan", count: 1, what: "Revised programme" },
    ],
    links: [
      { label: "Contract and programme", kind: "doc" },
      { label: "Heating quote", kind: "doc" },
      { label: "Roof survey photos", kind: "image" },
    ],
    activity: [
      { who: "declan", what: "moved Roof starts from 5 Oct to 19 Oct", when: "Wednesday" },
      { who: "declan", what: "uploaded Revised programme draft", when: "Wednesday" },
      { who: "orla", what: "finished Clear the loft", when: "Monday" },
    ],
  },
  {
    id: "winter-launch",
    name: "Winter season launch",
    hue: 1,
    owner: "aoife",
    date: "Thu 22 Oct",
    dateWhat: "Launch",
    daysOut: 27,
    done: 12,
    total: 28,
    calm: "Launch plan is on schedule.",
    signals: [
      {
        id: "photos",
        kind: "declared",
        weight: "watch",
        sentence: "Aoife marked this off track on Tuesday: 40 of 120 photos are in.",
        detail: "The photographer re-shoots the dining room on Monday. Aoife owns it.",
      },
      {
        id: "copy",
        kind: "deadline",
        weight: "watch",
        sentence: "Brochure copy hasn't started and print is booked for 9 Oct.",
        detail: "Task has no owner yet. Print slot is 2 weeks away.",
      },
    ],
    actions: [
      { id: "a1", label: "Ask Aoife", kind: "nudge", signalId: "photos", toast: "Asked Aoife what would help with the photos.", done: "Asked Aoife" },
      { id: "a2", label: "Shot list", kind: "open" },
    ],
    declared: { status: "off", by: "aoife", when: "Tue 22 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Brief signed off. Shoot booked for 8 Sep." },
      { week: "17 Aug", status: "on", line: "Winter menu cards drafted with chef." },
      { week: "24 Aug", status: "on", line: "Launch night date set: Thursday 22 October." },
      { week: "31 Aug", status: "on", line: "Dining room dressed for the shoot." },
      { week: "7 Sep", status: "risk", line: "Shoot rained off halfway. About a third done." },
      { week: "14 Sep", status: "risk", line: "Photographer rebooked. Aoife is watching the print slot." },
    ],
    since: { done: 1, added: 4, overdue: 2 },
    suggestion: { status: "off", line: "Photos still short; Aoife re-shoots Monday. Brochure copy needs a writer." },
    next: [
      { title: "Re-shoot the dining room", owner: "aoife", due: "Mon 28 Sep" },
      { title: "Find a writer for the brochure", owner: "orla", due: "Wed 30 Sep" },
      { title: "Book the launch email", owner: "aoife", due: "Fri 9 Oct" },
    ],
    milestones: [
      { title: "Brief", date: "10 Aug", done: true },
      { title: "Photos in", date: "28 Sep", moved: "was 14 Sep" },
      { title: "Brochure to print", date: "9 Oct" },
      { title: "Launch night", date: "22 Oct" },
    ],
    waiting: [
      { person: "aoife", count: 3, what: "Photos, launch email, social plan" },
      { person: "orla", count: 1, what: "A writer for the brochure" },
    ],
    links: [
      { label: "Shot list", kind: "sheet" },
      { label: "Brochure layout", kind: "slides" },
      { label: "Photo selects", kind: "image" },
    ],
    activity: [
      { who: "aoife", what: "set the status to off track", when: "Tuesday" },
      { who: "aoife", what: "uploaded 40 photos to Photo selects", when: "Monday" },
      { who: "orla", what: "added Brochure copy", when: "Monday" },
    ],
  },
  {
    id: "markets",
    name: "Christmas markets",
    hue: 11,
    owner: "niamh",
    date: "Fri 27 Nov",
    dateWhat: "Opening night",
    daysOut: 63,
    done: 11,
    total: 26,
    calm: "Stalls are filling up on time.",
    signals: [
      {
        id: "stalls",
        kind: "deadline",
        weight: "watch",
        sentence: "6 of 14 stalls are confirmed and deposits are due on Thursday.",
        detail: "Deposit deadline is Thu 1 Oct. 8 stallholders haven't replied to the contract.",
      },
    ],
    actions: [
      { id: "a1", label: "Chase stallholders", kind: "nudge", signalId: "stalls", toast: "Niamh has the list of 8 stallholders to chase, with a reminder drafted.", done: "List sent to Niamh" },
      {
        id: "a2",
        label: "Deposit date",
        kind: "choose",
        done: "Decided",
        signalId: "stalls",
        options: [
          { label: "Move it to Thu 8 Oct", detail: "One more week for the 8 unpaid stalls.", toast: "Deposit deadline moved to Thu 8 Oct. Niamh will let the stallholders know." },
          { label: "Keep Thursday", detail: "Unpaid stalls go to the waiting list on Friday.", toast: "Kept Thursday. Unpaid stalls go to the waiting list on Friday." },
        ],
      },
    ],
    declared: { status: "risk", by: "niamh", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Stall layout agreed with the council." },
      { week: "17 Aug", status: "on", line: "Applications open. 20 enquiries in the first week." },
      { week: "24 Aug", status: "on", line: "Shortlist of 14 stalls picked, with 5 on the waiting list." },
      { week: "31 Aug", status: "on", line: "Contracts out to all 14." },
      { week: "7 Sep", status: "on", line: "4 contracts signed. Electrics quote requested." },
      { week: "14 Sep", status: "risk", line: "Only 6 signed. Deposits due 1 Oct." },
    ],
    since: { done: 3, added: 1, overdue: 0 },
    suggestion: { status: "risk", line: "6 of 14 stalls signed; Niamh is chasing the other 8 before Thursday." },
    next: [
      { title: "Chase 8 unsigned stallholders", owner: "niamh", due: "Tue 29 Sep" },
      { title: "Approve the electrics quote", owner: "orla", due: "Fri 2 Oct" },
      { title: "Offer free places to the waiting list", owner: "niamh", due: "Fri 2 Oct" },
    ],
    milestones: [
      { title: "Layout agreed", date: "10 Aug", done: true },
      { title: "Contracts out", date: "31 Aug", done: true },
      { title: "Deposits due", date: "1 Oct" },
      { title: "Opening night", date: "27 Nov" },
    ],
    waiting: [
      { person: "niamh", count: 2, what: "Stallholder replies, electrics quote" },
      { person: "orla", count: 1, what: "Electrics quote sign-off" },
    ],
    links: [
      { label: "Stall map", kind: "image" },
      { label: "Stallholder tracker", kind: "sheet" },
      { label: "Council licence", kind: "doc" },
    ],
    activity: [
      { who: "niamh", what: "marked 2 stalls as signed", when: "Thursday" },
      { who: "niamh", what: "requested an electrics quote", when: "Tuesday" },
    ],
  },
  {
    id: "science-fair",
    name: "Year 5 science fair",
    hue: 10,
    owner: "ciara",
    date: "Thu 19 Nov",
    dateWhat: "Fair",
    daysOut: 55,
    done: 5,
    total: 18,
    calm: "Planning is moving along.",
    signals: [
      {
        id: "quiet",
        kind: "quiet",
        weight: "watch",
        sentence: "No one has touched this in 12 days, and the hall booking still needs confirming.",
        detail: "Last activity was Sun 13 Sep. The hall booking is due Fri 2 Oct.",
      },
    ],
    actions: [
      { id: "a1", label: "Ask Ciara", kind: "nudge", signalId: "quiet", toast: "Sent Ciara a note asking how the fair is going.", done: "Note sent" },
      { id: "a2", label: "Take the booking", kind: "resolve", signalId: "quiet", toast: "The hall booking is yours now. It's due Fri 2 Oct.", done: "Yours now" },
    ],
    declared: { status: "on", by: "ciara", when: "Mon 7 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Theme picked with the class: water." },
      { week: "17 Aug", status: "on", line: "Asked four judges. Three said yes." },
      { week: "24 Aug", status: "on", line: "Letter to parents drafted." },
      { week: "31 Aug", status: "on", line: "Letter out to 58 families." },
      { week: "7 Sep", status: "on", line: "School is back; project groups picked." },
      { week: "14 Sep", status: "on", line: "Quiet week while Ciara settles the class." },
    ],
    since: { done: 0, added: 0, overdue: 0 },
    suggestion: { status: "risk", line: "Quiet for 12 days and the hall is still unbooked. Checking in with Ciara." },
    next: [
      { title: "Confirm the hall booking", owner: "ciara", due: "Fri 2 Oct" },
      { title: "Find a fourth judge", owner: "ciara", due: "Fri 16 Oct" },
      { title: "Order display boards", owner: "orla", due: "Fri 23 Oct" },
    ],
    milestones: [
      { title: "Theme", date: "10 Aug", done: true },
      { title: "Letters out", date: "31 Aug", done: true },
      { title: "Hall booked", date: "2 Oct" },
      { title: "Fair", date: "19 Nov" },
    ],
    waiting: [{ person: "ciara", count: 2, what: "Hall booking, fourth judge" }],
    links: [
      { label: "Parent letter", kind: "doc" },
      { label: "Project groups", kind: "sheet" },
    ],
    activity: [{ who: "ciara", what: "finished Pick project groups", when: "13 Sep" }],
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    hue: 2,
    owner: "sam",
    date: "Sat 10 Oct",
    dateWhat: "Supper",
    daysOut: 15,
    done: 18,
    total: 22,
    calm: "Menu is locked and 38 of 40 seats are sold.",
    signals: [],
    actions: [],
    declared: { status: "on", by: "sam", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Chef's harvest menu drafted." },
      { week: "17 Aug", status: "on", line: "Tickets on sale. 12 gone on the first day." },
      { week: "24 Aug", status: "on", line: "Local cider maker on board for the pairing." },
      { week: "31 Aug", status: "on", line: "26 of 40 seats sold." },
      { week: "7 Sep", status: "on", line: "Long table hire booked." },
      { week: "14 Sep", status: "on", line: "34 seats sold. Menu locked." },
    ],
    since: { done: 5, added: 1, overdue: 0 },
    suggestion: { status: "on", line: "38 of 40 seats sold and the menu is locked. Pairing tasting on Thursday." },
    next: [
      { title: "Pairing tasting with the cider maker", owner: "sam", due: "Thu 1 Oct" },
      { title: "Print menus", owner: "sam", due: "Wed 7 Oct" },
      { title: "Send guest arrival note", owner: "niamh", due: "Thu 8 Oct" },
    ],
    milestones: [
      { title: "Tickets on sale", date: "17 Aug", done: true },
      { title: "Menu locked", date: "14 Sep", done: true },
      { title: "Supper", date: "10 Oct" },
    ],
    waiting: [{ person: "sam", count: 1, what: "Menu print proof" }],
    links: [
      { label: "Menu", kind: "doc" },
      { label: "Guest list", kind: "sheet" },
    ],
    activity: [
      { who: "sam", what: "sold 4 more seats", when: "Thursday" },
      { who: "sam", what: "finished Lock the menu", when: "Monday" },
    ],
  },
  {
    id: "kavanagh",
    name: "Kavanagh 40th",
    hue: 8,
    owner: "niamh",
    date: "Sat 14 Nov",
    dateWhat: "Party",
    daysOut: 50,
    done: 14,
    total: 31,
    calm: "Band and caterer are booked; invites go out on Monday.",
    signals: [
      {
        id: "barn",
        kind: "link",
        weight: "fine",
        sentence: "Needs the barn heated. That date is being sorted in Barn roof and heating works.",
        detail: "Linked to Heating on, Fri 13 Nov.",
      },
    ],
    actions: [],
    declared: { status: "on", by: "niamh", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "First call with the Kavanaghs. 90 guests, barn and garden." },
      { week: "17 Aug", status: "on", line: "Deposit paid." },
      { week: "24 Aug", status: "on", line: "Band booked: The Late Arrivals." },
      { week: "31 Aug", status: "on", line: "Caterer chosen after the tasting." },
      { week: "7 Sep", status: "on", line: "Invite design approved by Aisling Kavanagh." },
      { week: "14 Sep", status: "on", line: "Guest list final at 94." },
    ],
    since: { done: 3, added: 2, overdue: 0 },
    suggestion: { status: "on", line: "Invites go out Monday. Keeping an eye on the barn heating date." },
    next: [
      { title: "Send invites", owner: "niamh", due: "Mon 28 Sep" },
      { title: "Confirm the cake", owner: "niamh", due: "Fri 16 Oct" },
      { title: "Walk the barn with the band", owner: "orla", due: "Thu 5 Nov" },
    ],
    milestones: [
      { title: "Deposit", date: "17 Aug", done: true },
      { title: "Invites out", date: "28 Sep" },
      { title: "Final numbers", date: "30 Oct" },
      { title: "Party", date: "14 Nov" },
    ],
    waiting: [{ person: "niamh", count: 1, what: "Cake tasting" }],
    links: [
      { label: "Guest list", kind: "sheet" },
      { label: "Barn layout", kind: "image" },
    ],
    activity: [{ who: "niamh", what: "finished Final guest list", when: "Tuesday" }],
  },
  {
    id: "ada-theo",
    name: "Ada & Theo's wedding",
    hue: 9,
    owner: "orla",
    date: "Sat 12 Jun",
    dateWhat: "Wedding day",
    daysOut: 260,
    done: 8,
    total: 40,
    calm: "Venue walkthrough done on Wednesday. Save-the-dates are next.",
    signals: [],
    actions: [],
    declared: { status: "on", by: "orla", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Enquiry in. Ada found us through the Doyle & Chen wedding." },
      { week: "17 Aug", status: "on", line: "Date held: Saturday 12 June 2027." },
      { week: "24 Aug", status: "on", line: "Booking form and deposit back." },
      { week: "31 Aug", status: "on", line: "Welcome pack sent." },
      { week: "7 Sep", status: "on", line: "Mood board started together." },
      { week: "14 Sep", status: "on", line: "Walkthrough booked for Wednesday." },
    ],
    since: { done: 2, added: 3, overdue: 0 },
    suggestion: { status: "on", line: "Walkthrough done. Save-the-dates next, with Ada's design." },
    next: [
      { title: "Save-the-date design", owner: "orla", due: "Fri 16 Oct" },
      { title: "Hold rooms for family", owner: "orla", due: "Fri 30 Oct" },
      { title: "First menu chat", owner: "sam", due: "Jan" },
    ],
    milestones: [
      { title: "Booked", date: "24 Aug", done: true },
      { title: "Walkthrough", date: "23 Sep", done: true },
      { title: "Save-the-dates", date: "16 Oct" },
      { title: "The day", date: "12 Jun" },
    ],
    waiting: [],
    links: [
      { label: "Mood board", kind: "image" },
      { label: "Booking form", kind: "doc" },
    ],
    activity: [{ who: "orla", what: "finished Venue walkthrough", when: "Wednesday" }],
  },
  {
    id: "northside",
    name: "Northside rebrand",
    hue: 11,
    owner: "tomas",
    date: "Thu 5 Nov",
    dateWhat: "New signs up",
    daysOut: 41,
    done: 22,
    total: 30,
    calm: "Logo signed off. The sign-maker is booked for 2 November.",
    signals: [],
    actions: [],
    declared: { status: "on", by: "tomas", when: "Mon 14 Sep" },
    history: [
      { week: "10 Aug", status: "on", line: "Three logo routes in from Tomás." },
      { week: "17 Aug", status: "risk", line: "None of the three felt right. Tomás is trying a fourth." },
      { week: "24 Aug", status: "on", line: "Fourth route is the one." },
      { week: "31 Aug", status: "on", line: "Colours and type agreed." },
      { week: "7 Sep", status: "on", line: "Menus and cards laid out." },
      { week: "14 Sep", status: "on", line: "Logo signed off. Sign quotes in." },
    ],
    since: { done: 4, added: 0, overdue: 0 },
    suggestion: { status: "on", line: "Sign-maker booked for 2 Nov. Menus at the printer." },
    next: [
      { title: "Menus to the printer", owner: "tomas", due: "Fri 2 Oct" },
      { title: "Update the website", owner: "aoife", due: "Fri 30 Oct" },
      { title: "Signs up", owner: "tomas", due: "Mon 2 Nov" },
    ],
    milestones: [
      { title: "Logo", date: "14 Sep", done: true },
      { title: "Print", date: "2 Oct" },
      { title: "Signs up", date: "5 Nov" },
    ],
    waiting: [{ person: "tomas", count: 1, what: "Menu proofs" }],
    links: [
      { label: "Brand guide", kind: "slides" },
      { label: "Logo files", kind: "design" },
    ],
    activity: [{ who: "tomas", what: "uploaded Logo final", when: "Monday" }],
  },
  {
    id: "doyle-chen",
    name: "Doyle & Chen wedding",
    hue: 1,
    owner: "orla",
    date: "Sat 12 Sep",
    dateWhat: "Wedding day",
    daysOut: -13,
    done: 46,
    total: 46,
    wrapped: { on: "Sat 12 Sep", note: "The couple's thank-you card is pinned in Files." },
    calm: "Wrapped.",
    signals: [],
    actions: [],
    declared: { status: "on", by: "orla", when: "Mon 7 Sep" },
    history: [],
    since: { done: 0, added: 0, overdue: 0 },
    suggestion: { status: "on", line: "" },
    next: [],
    milestones: [],
    waiting: [],
    links: [],
    activity: [],
  },
  {
    id: "summer",
    name: "Summer garden parties",
    hue: 2,
    owner: "niamh",
    date: "Sun 30 Aug",
    dateWhat: "Last party",
    daysOut: -26,
    done: 24,
    total: 24,
    wrapped: { on: "Sun 30 Aug", note: "Four parties, 310 guests. Notes for next year are in." },
    calm: "Wrapped.",
    signals: [],
    actions: [],
    declared: { status: "on", by: "niamh", when: "Mon 31 Aug" },
    history: [],
    since: { done: 0, added: 0, overdue: 0 },
    suggestion: { status: "on", line: "" },
    next: [],
    milestones: [],
    waiting: [],
    links: [],
    activity: [],
  },
];

/** Extra projects for the "new and unowned" preview state. */
export const EDGE_PROJECTS: Project[] = [
  {
    id: "brunch",
    name: "Sunday brunch series",
    hue: 10,
    owner: null,
    date: "Sun 18 Oct",
    dateWhat: "First brunch",
    daysOut: 23,
    done: 0,
    total: 6,
    calm: "Planning is moving along.",
    signals: [
      {
        id: "owner",
        kind: "owner",
        weight: "needs",
        sentence: "No one owns this yet.",
        detail: "Niamh created it on Tuesday. 6 tasks, none of them assigned.",
      },
    ],
    actions: [
      { id: "a1", label: "Take it", kind: "resolve", signalId: "owner", toast: "You own Sunday brunch series now.", done: "Yours now" },
      { id: "a2", label: "Ask Niamh", kind: "nudge", signalId: "owner", toast: "Asked Niamh who should own the brunch series.", done: "Asked Niamh" },
    ],
    declared: null,
    history: [],
    since: { done: 0, added: 6, overdue: 0 },
    suggestion: { status: "risk", line: "Needs an owner before we book the first date." },
    next: [
      { title: "Pick an owner", owner: "orla", due: "This week" },
      { title: "Price a brunch menu", owner: "sam", due: "Fri 2 Oct" },
      { title: "Open bookings", owner: "niamh", due: "Mon 5 Oct" },
    ],
    milestones: [
      { title: "Menu", date: "2 Oct" },
      { title: "Bookings open", date: "5 Oct" },
      { title: "First brunch", date: "18 Oct" },
    ],
    waiting: [],
    links: [],
    activity: [{ who: "niamh", what: "created the project", when: "Tuesday" }],
  },
  {
    id: "staff-party",
    name: "Staff Christmas party",
    hue: 9,
    owner: "orla",
    date: "Fri 11 Dec",
    dateWhat: "Party",
    daysOut: 77,
    done: 0,
    total: 2,
    isNew: true,
    calm: "Too new to tell. Check back after a few tasks.",
    signals: [],
    actions: [],
    declared: null,
    history: [],
    since: { done: 0, added: 2, overdue: 0 },
    suggestion: { status: "on", line: "Just started. Date picked, venue next." },
    next: [
      { title: "Pick a venue", owner: "orla", due: "Fri 16 Oct" },
      { title: "Ask the team about dietary needs", owner: "orla", due: "Fri 23 Oct" },
    ],
    milestones: [{ title: "Party", date: "11 Dec" }],
    waiting: [],
    links: [],
    activity: [{ who: "orla", what: "created the project", when: "Today" }],
  },
];
