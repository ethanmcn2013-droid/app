/**
 * Sample world for the Countdown concept. Every date is a whole-day offset
 * from "today", Thursday 1 October 2026 (offset 0). Nothing here is wired to
 * a backend.
 */

export type Person = {
  id: string;
  name: string;
  initials: string;
  hue: number;
};

export type Phase = { id: string; name: string; start: number; end: number };

export type Checkpoint = {
  id: string;
  name: string;
  /** Lower-case phrase used inside sentences: "before final numbers". */
  short: string;
  day: number;
  /** Status tail when it is the next thing that matters: "the printer needs files by Mon". */
  need?: string;
};

export type Task = {
  id: string;
  title: string;
  due: number;
  phase: string;
  owner: string;
  done: boolean;
  /** Checkpoint this task must land before. */
  before?: string;
  note?: string;
  steps?: { label: string; done: boolean }[];
};

export type RunItem = {
  id: string;
  time: string;
  title: string;
  who?: string;
  where?: string;
  done: boolean;
};

export type Countdown = {
  id: string;
  name: string;
  /** Short noun for sentences: "the wedding", "the launch". */
  noun: string;
  kind: string;
  day: number;
  /** CSS colour of the project identity. */
  color: string;
  people: Person[];
  phases: Phase[];
  checkpoints: Checkpoint[];
  tasks: Task[];
  runsheet: RunItem[];
};

export type Template = {
  id: string;
  label: string;
  noun: string;
  tasks: { title: string; before: number; phase: string }[];
  phases: { name: string; from: number; to: number }[];
};

const t = (
  id: string,
  due: number,
  title: string,
  phase: string,
  owner: string,
  done = false,
  extra: Partial<Task> = {},
): Task => ({ id, due, title, phase, owner, done, ...extra });

const r = (
  id: string,
  time: string,
  title: string,
  who?: string,
  where?: string,
): RunItem => ({
  id,
  time,
  title,
  who,
  where,
  done: false,
});

export const WEDDING: Countdown = {
  id: "wedding",
  name: "Mara & Finn's wedding",
  noun: "the wedding",
  kind: "Wedding",
  day: 23,
  color: "var(--v3-project-8)",
  people: [
    { id: "aoife", name: "Aoife Kelly", initials: "AK", hue: 330 },
    { id: "tom", name: "Tom Byrne", initials: "TB", hue: 210 },
    { id: "mara", name: "Mara Doyle", initials: "MD", hue: 20 },
    { id: "finn", name: "Finn Walsh", initials: "FW", hue: 150 },
  ],
  phases: [
    { id: "confirm", name: "Confirm", start: -21, end: 8 },
    { id: "finalise", name: "Finalise", start: 9, end: 15 },
    { id: "rehearse", name: "Rehearse", start: 16, end: 19 },
    { id: "week", name: "The week", start: 20, end: 22 },
    { id: "day", name: "The day", start: 23, end: 23 },
    { id: "wrap", name: "Wrap up", start: 24, end: 40 },
  ],
  checkpoints: [
    {
      id: "tasting",
      name: "Menu tasting",
      short: "the menu tasting",
      day: 9,
      need: "the menu tasting is on Sat 10 Oct",
    },
    {
      id: "numbers",
      name: "Final numbers",
      short: "final numbers",
      day: 15,
      need: "final numbers go to the caterer on Fri 16 Oct",
    },
    {
      id: "dinner",
      name: "Rehearsal dinner",
      short: "the rehearsal dinner",
      day: 22,
    },
  ],
  tasks: [
    t("w1", -20, "Book the band", "confirm", "finn", true),
    t("w2", -18, "Send save-the-dates", "confirm", "mara", true),
    t("w3", -15, "Choose the florist", "confirm", "aoife", true),
    t("w4", -12, "Order the invitations", "confirm", "mara", true),
    t("w5", -10, "Book the hair and make-up trial", "confirm", "aoife", true),
    t("w6", -8, "Confirm the photographer", "confirm", "aoife", true),
    t("w7", -6, "Post the invitations", "confirm", "mara", true),
    t("w8", -4, "Pick the ceremony readings", "confirm", "finn", true),
    t("w9", -3, "Book the guest shuttle bus", "confirm", "tom", true),
    t("w10", -2, "Hair and make-up trial", "confirm", "mara", true),
    t("w11", -1, "Order the cake", "confirm", "tom", true),
    t("w12", -3, "Chase 14 missing RSVPs", "confirm", "aoife", false, {
      before: "numbers",
      note: "Mostly Finn's side. A text works better than email for the cousins.",
      steps: [
        { label: "Text the Walsh cousins", done: true },
        { label: "Email Mara's college friends", done: false },
        { label: "Call Aunt Nuala", done: false },
      ],
    }),
    t("w13", -2, "Send the caterer the allergy list", "confirm", "tom", false, {
      before: "tasting",
      note: "Two coeliac guests, one nut allergy, eleven vegetarians so far.",
    }),
    t("w14", -1, "Pay the venue's second deposit", "confirm", "mara"),
    t(
      "w15",
      0,
      "Send the florist the colour palette",
      "confirm",
      "aoife",
      false,
      {
        note: "Dusty rose, sage and cream. Photos from the barn in the shared folder.",
      },
    ),
    t("w16", 1, "Draft the running order for the day", "confirm", "aoife"),
    t("w17", 2, "Second suit fitting", "confirm", "finn"),
    t("w18", 5, "Choose the table names", "confirm", "mara"),
    t("w19", 6, "Agree the band's set list", "confirm", "finn"),
    t(
      "w20",
      7,
      "Florist walk-through at the venue",
      "confirm",
      "aoife",
      false,
      {
        before: "numbers",
        note: "Walk the barn with Ellie from Wild Stem. Measure the arch.",
      },
    ),
    t("w21", 9, "Menu tasting at Ballymore Barn", "finalise", "mara"),
    t("w22", 11, "Draft the seating plan", "finalise", "aoife", false, {
      before: "numbers",
    }),
    t("w23", 12, "Collect the rings", "finalise", "finn"),
    t("w24", 13, "Confirm the wine order", "finalise", "tom", false, {
      before: "numbers",
    }),
    t("w25", 15, "Send final numbers to the caterer", "finalise", "aoife"),
    t("w26", 17, "First dance practice", "rehearse", "mara"),
    t("w27", 18, "Run through the speeches", "rehearse", "finn"),
    t("w28", 19, "Print the order of service", "rehearse", "tom"),
    t("w29", 19, "Confirm every supplier's arrival time", "rehearse", "aoife"),
    t("w30", 20, "Final dress fitting", "week", "mara"),
    t("w31", 20, "Pack the decoration boxes", "week", "tom"),
    t("w32", 21, "Drop the decorations at the barn", "week", "aoife"),
    t("w33", 21, "Write the speech cue cards", "week", "finn"),
    t("w34", 22, "Ceremony rehearsal, 17:00", "week", "aoife"),
    t("w35", 22, "Pick up the suits", "week", "finn"),
    t("w36", 25, "Return the hired glassware", "wrap", "tom"),
    t("w37", 27, "Pay the band's balance", "wrap", "finn"),
    t("w38", 30, "Send thank-you cards", "wrap", "mara"),
    t("w39", 34, "Share the photo gallery with guests", "wrap", "aoife"),
  ],
  runsheet: [
    r("wr1", "08:00", "Hair and make-up begins", "Mara", "Bridal suite"),
    r("wr2", "10:30", "Photographer arrives", "Aoife"),
    r("wr3", "12:00", "Florist dresses the barn", "Wild Stem", "Barn"),
    r("wr4", "13:30", "Guests seated", "Tom", "Orchard"),
    r("wr5", "14:00", "Ceremony", undefined, "Orchard"),
    r("wr6", "15:00", "Drinks on the lawn", undefined, "Lawn"),
    r("wr7", "17:00", "Dinner is served", undefined, "Barn"),
    r("wr8", "18:30", "Speeches", "Finn"),
    r("wr9", "20:00", "First dance", undefined, "Barn"),
    r("wr10", "23:30", "Carriages", "Tom", "Front gate"),
  ],
};

export const LAUNCH: Countdown = {
  id: "launch",
  name: "Crumb & Co launch",
  noun: "the launch",
  kind: "Launch",
  day: 12,
  color: "var(--v3-project-5)",
  people: [
    { id: "priya", name: "Priya Nair", initials: "PN", hue: 280 },
    { id: "jonah", name: "Jonah Reid", initials: "JR", hue: 30 },
    { id: "sam", name: "Sam Okafor", initials: "SO", hue: 190 },
  ],
  phases: [
    { id: "design", name: "Design", start: -14, end: 3 },
    { id: "print", name: "Print", start: 4, end: 9 },
    { id: "launch", name: "Launch", start: 10, end: 12 },
  ],
  checkpoints: [
    {
      id: "files",
      name: "Files to printer",
      short: "files go to the printer",
      day: 4,
      need: "the printer needs files by Mon",
    },
    {
      id: "proofs",
      name: "Proofs approved",
      short: "proofs are approved",
      day: 7,
      need: "proofs need approving by Thu 8 Oct",
    },
  ],
  tasks: [
    t("l1", -12, "Agree the brief with Crumb & Co", "design", "priya", true),
    t("l2", -10, "Share the moodboard", "design", "priya", true),
    t("l3", -8, "Pick the typefaces", "design", "priya", true),
    t("l4", -7, "Sign off the colour palette", "design", "jonah", true),
    t("l5", -6, "Final logo lockup sign-off", "design", "priya", false, {
      before: "files",
      note: "Client wants one more look at the wordmark spacing.",
    }),
    t("l6", -4, "Write the label copy", "design", "sam", false, {
      before: "files",
    }),
    t("l7", -3, "Photograph the new range", "design", "jonah", false, {
      before: "files",
      steps: [
        { label: "Sourdough loaf", done: true },
        { label: "Cardamom buns", done: false },
        { label: "Rye crackers", done: false },
      ],
    }),
    t("l8", -2, "Get the allergen text checked", "design", "sam", false, {
      before: "files",
    }),
    t("l9", -1, "Build the box dieline", "design", "priya", false, {
      before: "files",
    }),
    t("l10", 0, "Export print-ready files", "design", "priya", false, {
      before: "files",
    }),
    t("l11", 1, "Book the launch photographer", "design", "jonah"),
    t("l12", 4, "Send files to Northside Print", "print", "priya"),
    t("l13", 5, "Write the launch newsletter", "print", "sam"),
    t("l14", 6, "Check the printed proofs", "print", "jonah", false, {
      before: "proofs",
    }),
    t("l15", 7, "Approve proofs with the client", "print", "priya"),
    t("l16", 8, "Schedule the social posts", "print", "sam"),
    t("l17", 9, "Boxes delivered to the shop", "print", "jonah"),
    t("l18", 10, "Brief the shop staff on the range", "launch", "priya"),
    t("l19", 11, "Set up the window display", "launch", "jonah"),
    t("l20", 11, "Send press samples", "launch", "sam"),
  ],
  runsheet: [
    r("lr1", "07:30", "Stock arrives at the shop", "Jonah", "Back door"),
    r("lr2", "09:00", "Window display check", "Priya"),
    r("lr3", "10:00", "Doors open", undefined, "Crumb & Co, Capel St"),
    r("lr4", "12:00", "Post the launch photos", "Sam"),
    r("lr5", "16:00", "Tasting hour", "Jonah"),
    r("lr6", "19:00", "Thank-you drinks", undefined, "Upstairs"),
  ],
};

export const STUDY: Countdown = {
  id: "study",
  name: "Urban heat islands presentation",
  noun: "the presentation",
  kind: "Presentation",
  day: 20,
  color: "var(--v3-project-3)",
  people: [
    { id: "lena", name: "Lena Brady", initials: "LB", hue: 260 },
    { id: "kofi", name: "Kofi Mensah", initials: "KM", hue: 40 },
    { id: "maeve", name: "Maeve Quinn", initials: "MQ", hue: 170 },
  ],
  phases: [
    { id: "research", name: "Research", start: -10, end: 6 },
    { id: "write", name: "Write", start: 7, end: 15 },
    { id: "rehearse", name: "Rehearse", start: 16, end: 20 },
  ],
  checkpoints: [
    {
      id: "outline",
      name: "Outline to Dr Ryan",
      short: "the outline goes to Dr Ryan",
      day: 6,
      need: "the outline goes to Dr Ryan on Wed 7 Oct",
    },
    {
      id: "draft",
      name: "Draft slides due",
      short: "the draft slides are due",
      day: 15,
    },
    {
      id: "dress",
      name: "Dress rehearsal",
      short: "the dress rehearsal",
      day: 18,
    },
  ],
  tasks: [
    t("s1", -9, "Pick the topic", "research", "lena", true),
    t("s2", -7, "Split up the research", "research", "lena", true),
    t("s3", -5, "Find ten good sources", "research", "maeve", true),
    t(
      "s4",
      -3,
      "Download the Met Éireann temperature data",
      "research",
      "kofi",
      true,
    ),
    t("s5", -1, "Book the library room", "research", "maeve", true),
    t(
      "s6",
      -2,
      "Measure three streets with the thermometer",
      "research",
      "kofi",
      false,
      {
        before: "outline",
        note: "Dorset St, the canal path and the park. Same time of day for all three.",
      },
    ),
    t("s7", 0, "Read the Dublin heat study", "research", "lena"),
    t("s8", 2, "Map the green spaces", "research", "maeve"),
    t("s9", 3, "Interview the council planner", "research", "kofi", false, {
      before: "outline",
    }),
    t("s10", 5, "Draft the outline", "research", "lena", false, {
      before: "outline",
    }),
    t("s11", 6, "Send the outline to Dr Ryan", "research", "lena"),
    t("s12", 8, "Make the heat map", "write", "maeve", false, {
      before: "draft",
    }),
    t("s13", 10, "Write the introduction and method", "write", "lena", false, {
      before: "draft",
    }),
    t("s14", 12, "Write up the findings", "write", "kofi", false, {
      before: "draft",
    }),
    t("s15", 13, "Build slides one to eight", "write", "maeve", false, {
      before: "draft",
    }),
    t("s16", 14, "Add the sources slide", "write", "lena"),
    t("s17", 15, "Share the draft slides", "write", "maeve"),
    t("s18", 17, "Time the talk to twelve minutes", "rehearse", "kofi"),
    t("s19", 18, "Dress rehearsal in room 2.14", "rehearse", "lena"),
    t("s20", 19, "Print the handouts", "rehearse", "maeve"),
  ],
  runsheet: [
    r("sr1", "09:00", "Final run-through", "Everyone", "Library room"),
    r("sr2", "11:30", "Collect the handouts", "Maeve", "Print room"),
    r("sr3", "13:40", "Set up the room", "Kofi", "Room 2.14"),
    r("sr4", "14:00", "Presentation starts", "Lena"),
    r("sr5", "14:12", "Questions", "Everyone"),
    r("sr6", "15:00", "Upload the slides to the class page", "Maeve"),
  ],
};

export const COUNTDOWNS: Countdown[] = [WEDDING, LAUNCH, STUDY];

export const TEMPLATES: Template[] = [
  {
    id: "wedding",
    label: "Start from a wedding plan",
    noun: "the wedding",
    phases: [
      { name: "Confirm", from: 42, to: 22 },
      { name: "Finalise", from: 21, to: 8 },
      { name: "The week", from: 7, to: 1 },
      { name: "The day", from: 0, to: 0 },
    ],
    tasks: [
      { title: "Confirm the venue and date", before: 40, phase: "Confirm" },
      { title: "Book the photographer", before: 36, phase: "Confirm" },
      { title: "Send the invitations", before: 30, phase: "Confirm" },
      { title: "Menu tasting", before: 24, phase: "Confirm" },
      { title: "Chase missing RSVPs", before: 18, phase: "Finalise" },
      { title: "Draft the seating plan", before: 14, phase: "Finalise" },
      { title: "Send final numbers", before: 10, phase: "Finalise" },
      { title: "Confirm supplier arrival times", before: 5, phase: "The week" },
      { title: "Ceremony rehearsal", before: 1, phase: "The week" },
    ],
  },
  {
    id: "launch",
    label: "Start from a product launch",
    noun: "the launch",
    phases: [
      { name: "Design", from: 42, to: 22 },
      { name: "Make", from: 21, to: 8 },
      { name: "Launch", from: 7, to: 0 },
    ],
    tasks: [
      { title: "Agree the brief", before: 40, phase: "Design" },
      { title: "First designs to review", before: 32, phase: "Design" },
      { title: "Final designs signed off", before: 24, phase: "Design" },
      { title: "Files to the printer", before: 20, phase: "Make" },
      { title: "Check the proofs", before: 14, phase: "Make" },
      { title: "Write the announcement", before: 9, phase: "Make" },
      { title: "Brief the team", before: 3, phase: "Launch" },
      { title: "Schedule the posts", before: 2, phase: "Launch" },
    ],
  },
  {
    id: "study",
    label: "Start from an exam or talk",
    noun: "the talk",
    phases: [
      { name: "Research", from: 42, to: 22 },
      { name: "Write", from: 21, to: 8 },
      { name: "Rehearse", from: 7, to: 0 },
    ],
    tasks: [
      { title: "Pick the topic", before: 40, phase: "Research" },
      { title: "Gather sources", before: 33, phase: "Research" },
      { title: "Write the outline", before: 25, phase: "Research" },
      { title: "Write the first draft", before: 16, phase: "Write" },
      { title: "Make the slides", before: 10, phase: "Write" },
      { title: "Practise out loud", before: 5, phase: "Rehearse" },
      { title: "Dress rehearsal", before: 2, phase: "Rehearse" },
    ],
  },
  {
    id: "event",
    label: "Start from an event night",
    noun: "the event",
    phases: [
      { name: "Plan", from: 42, to: 15 },
      { name: "Promote", from: 14, to: 1 },
      { name: "The night", from: 0, to: 0 },
    ],
    tasks: [
      { title: "Lock the line-up", before: 38, phase: "Plan" },
      { title: "Tickets go on sale", before: 30, phase: "Plan" },
      { title: "Book the staff", before: 21, phase: "Plan" },
      { title: "First round of posts", before: 14, phase: "Promote" },
      { title: "Send the reminder email", before: 3, phase: "Promote" },
      { title: "Set up the room", before: 0, phase: "The night" },
    ],
  },
];
