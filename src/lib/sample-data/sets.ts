/**
 * The three sample sets. Invented content only: no real school, university,
 * business or person. Supplier names are made up for this file. Sentence
 * case, plain words, and every date is a day offset from the run day.
 *
 * Project keys are part of each project's identity. Change the text freely;
 * never rename a key.
 */

import type { ColumnColorKey } from "@/lib/board-colors";
import type { SampleProject, SampleSet, SampleSetId, SampleStatus, SampleStep, SampleTask } from "./model";

type Extra = Omit<SampleTask, "title" | "status" | "due">;

function t(title: string, status: SampleStatus, due: number | null, extra: Extra = {}): SampleTask {
  return { title, status, due, ...extra };
}

/** A big date. One in the past reads as done unless a status says otherwise. */
function big(title: string, due: number, extra: Extra = {}, status?: SampleStatus): SampleTask {
  return { title, status: status ?? (due < 0 ? "done" : "todo"), due, bigDate: true, ...extra };
}

function steps(...items: Array<string | [string, true]>): readonly SampleStep[] {
  return items.map((item) => (typeof item === "string" ? { title: item } : { title: item[0], done: true }));
}

function labels(...items: Array<[string, ColumnColorKey]>) {
  return items.map(([name, color]) => ({ name, color }));
}

// ── Secondary school teacher ─────────────────────────────────────────

const TEACHER: SampleSet = {
  id: "teacher",
  name: "secondary school teacher",
  blurb: "A history teacher's term: a class project, the musical, sports day, parent-teacher meetings and the mocks.",
  projects: [
    {
      key: "history-project",
      status: "on-track",
      name: "Third year history project",
      about: "A research project for two third year class groups, from the brief to the results.",
      mainDate: { due: 24, label: "Projects due" },
      labels: labels(["Marking", "amber"], ["Parents", "sky"], ["Permission slips", "rose"], ["Library", "teal"]),
      tasks: [
        t("Write the project brief and marking scheme", "done", -20, {
          labels: ["Marking"], mine: true,
          link: { title: "Marking scheme", path: "history-project/marking-scheme" },
        }),
        t("Share the topic list with both class groups", "done", -17),
        t("Book the library for research periods", "done", -14, { labels: ["Library"] }),
        t("Collect topic choices from 3B", "done", -10),
        t("Collect topic choices from 3A", "doing", -2, {
          priority: "p1", mine: true, notes: "Six still missing. Ask again at registration.",
        }),
        t("Chase permission slips for the museum visit", "waiting", -1, {
          labels: ["Permission slips"], notes: "Waiting on Declan in the office for the list of who has paid.",
        }),
        big("First draft deadline", 3),
        t("Check first drafts from 3A", "todo", 0, { labels: ["Marking"], priority: "p1", mine: true, hours: 3 }),
        t("Check first drafts from 3B", "todo", 2, { labels: ["Marking"], mine: true, hours: 3 }),
        t("Letter to parents about the project deadline", "review", 1, {
          labels: ["Parents"], notes: "Draft is with the year head for a read.",
        }),
        t("Book the computer room for the final week", "todo", 5),
        t("Print the marking sheets", "todo", 8, { labels: ["Marking"] }),
        big("Museum visit", 10, {
          labels: ["Permission slips"],
          steps: steps(["Book the coach", true], "Confirm numbers with the museum", "Print the worksheet", "Arrange cover for two classes"),
        }),
        big("Projects due", 24, { priority: "p0" }),
        t("Mark projects from 3A", "todo", 31, { labels: ["Marking"], mine: true, hours: 6 }),
        t("Mark projects from 3B", "todo", 33, { labels: ["Marking"], mine: true, hours: 6 }),
        big("Results back to students", 38),
        t("Display the best projects for the open night", "todo", 45),
      ],
    },
    {
      key: "musical",
      status: "at-risk",
      name: "Transition year musical",
      about: "The school show, from auditions to the last night.",
      mainDate: { due: 40, label: "Opening night" },
      budgetEuros: 2400,
      labels: labels(["Hall booking", "violet"], ["Parents", "sky"], ["Costumes", "pink"], ["Music", "teal"], ["Tickets", "amber"]),
      tasks: [
        t("Choose the show and apply for the licence", "done", -30, {
          notes: "Licence covers four performances.",
        }),
        t("Pay the licence fee", "done", -24, { euros: 450 }),
        t("Book the hall for rehearsals", "done", -21, { labels: ["Hall booking"] }),
        big("Auditions", -6),
        t("Post the cast list", "done", -4),
        t("Rehearsal schedule to all cast", "doing", -1, { mine: true, priority: "p1" }),
        t("Costume list from the wardrobe team", "waiting", 0, {
          labels: ["Costumes"], notes: "Waiting on Niamh for sizes.",
        }),
        t("Book the hall for show week", "review", 2, {
          labels: ["Hall booking"], notes: "Caretaker to confirm the Thursday.",
        }),
        t("Order scripts and scores", "doing", 1, { labels: ["Music"], euros: 180 }),
        t("Letter to parents about rehearsal times", "todo", 0, { labels: ["Parents"], priority: "p1" }),
        t("Recruit the stage crew", "todo", 4),
        t("Sound and lighting hire quote", "waiting", 6, {
          notes: "Waiting on the hire company for a price.",
        }),
        t("Design the poster and programme", "todo", 12, {
          link: { title: "Poster draft", path: "musical/poster-draft" },
        }),
        t("Set build weekend", "todo", 18, {
          steps: steps("Ask the woodwork room for timber offcuts", "Borrow ladders from the caretaker", "Paint the backdrop", "Mark the stage"),
        }),
        big("Ticket sales open", 20, { labels: ["Tickets"] }),
        big("Tech rehearsal", 36, { labels: ["Hall booking"] }),
        big("Dress rehearsal", 38),
        big("Opening night", 40, { priority: "p0" }),
        t("Thank you notes and the cast party", "todo", 47),
        t("Return costumes and scripts", "todo", 49, { labels: ["Costumes"] }),
      ],
    },
    {
      key: "sports-day",
      status: "on-track",
      name: "Sports day",
      about: "The whole school sports day, with a wet weather plan.",
      mainDate: { due: 17, label: "Sports day" },
      budgetEuros: 600,
      labels: labels(["Equipment", "emerald"], ["Parents", "sky"], ["Volunteers", "violet"], ["First aid", "rose"]),
      tasks: [
        t("Agree the date with the principal", "done", -15),
        t("Book the pitch, and the hall as a wet weather backup", "done", -12),
        t("Draft the timetable of events", "done", -7, {
          link: { title: "Timetable of events", path: "sports-day/timetable" },
        }),
        t("Order medals and ribbons", "doing", -3, { labels: ["Equipment"], euros: 220 }),
        t("House team lists from year heads", "waiting", -1, {
          notes: "Two year heads still to send theirs.",
        }),
        t("Check the equipment store", "todo", 0, {
          labels: ["Equipment"], mine: true,
          steps: steps(["Count cones and bibs", true], "Check the relay batons", "Pump the footballs", "Find the starting whistle"),
        }),
        t("Ask for parent volunteers", "review", 1, { labels: ["Parents", "Volunteers"] }),
        t("First aid cover", "waiting", 3, {
          labels: ["First aid"], notes: "Waiting on Sorcha to confirm she is free.",
        }),
        t("Permission slips for the off-site run", "todo", 4),
        t("Book the PA system", "todo", 5, { labels: ["Equipment"] }),
        t("Order water and fruit", "todo", 10, { euros: 95 }),
        t("Brief the student helpers", "todo", 14, { labels: ["Volunteers"] }),
        t("Mark out the track", "todo", 16, { labels: ["Equipment"] }),
        big("Sports day", 17, { priority: "p0" }),
        t("Results and photos to the newsletter", "todo", 19, { labels: ["Parents"] }),
        t("Return hired equipment", "todo", 20, { labels: ["Equipment"] }),
      ],
    },
    {
      key: "parent-teacher",
      status: "on-track",
      name: "Parent-teacher meetings",
      about: "Two evenings of meetings, with bookings, comments and follow-up calls.",
      mainDate: { due: 12, label: "Third year meetings" },
      labels: labels(["Parents", "sky"], ["Hall booking", "violet"], ["Reports", "amber"]),
      tasks: [
        t("Confirm dates with the deputy principal", "done", -18),
        t("Book the hall and the prefabs", "done", -14, { labels: ["Hall booking"] }),
        t("Booking form out to parents", "done", -9, { labels: ["Parents"] }),
        t("Write comments for 3A", "doing", -2, { labels: ["Reports"], mine: true, hours: 3 }),
        t("Chase parents who have not booked", "doing", 0, { labels: ["Parents"], mine: true, priority: "p1" }),
        t("Print class lists and results", "todo", 2, { labels: ["Reports"] }),
        t("Write comments for 3B", "todo", 3, { labels: ["Reports"], mine: true, hours: 3 }),
        t("Interpreter for two families", "waiting", 5, {
          notes: "Waiting on the home school liaison.",
        }),
        t("Write comments for 5C", "todo", 6, { labels: ["Reports"], mine: true, hours: 2 }),
        t("Timetable of appointments", "review", 7),
        t("Tea and coffee for staff", "todo", 11),
        big("Third year meetings", 12),
        t("Follow-up calls", "todo", 14, {
          labels: ["Parents"], mine: true,
          steps: steps("Families who could not attend", "Two attendance concerns", "One subject change request"),
        }),
        t("Notes to year heads", "todo", 16),
        big("Fifth year meetings", 26),
      ],
    },
    {
      key: "mock-exams",
      name: "Leaving cert mock exams",
      about: "Two weeks of mock exams, then marking and results.",
      mainDate: { due: 30, label: "Mocks begin" },
      budgetEuros: 800,
      labels: labels(["Marking", "amber"], ["Hall booking", "violet"], ["Exam papers", "rose"], ["Supervision", "sky"]),
      tasks: [
        t("Order mock papers", "done", -25, { labels: ["Exam papers"], euros: 640 }),
        t("Draft the mock timetable", "done", -16, {
          link: { title: "Mock timetable", path: "mock-exams/timetable" },
        }),
        t("Book the hall for two weeks", "done", -13, { labels: ["Hall booking"] }),
        t("Supervision rota", "doing", -4, {
          labels: ["Supervision"], priority: "p1", notes: "Four slots still empty in the second week.",
        }),
        t("Timetable to students and parents", "review", 0),
        t("Reasonable accommodations list", "waiting", 1, {
          notes: "Waiting on the special needs coordinator.",
        }),
        t("Seating plan for the hall", "todo", 9, { labels: ["Hall booking"] }),
        t("Check the listening test equipment", "todo", 13),
        t("Count and sort papers by day", "todo", 27, { labels: ["Exam papers"] }),
        big("Mocks begin", 30, { priority: "p0" }),
        big("Mocks end", 41),
        t("Mark history papers", "todo", 50, {
          labels: ["Marking"], mine: true, hours: 12,
          steps: steps("Class 6A", "Class 6B", "Class 6C"),
        }),
        t("Enter results", "todo", 55, { labels: ["Marking"] }),
        big("Results day", 58),
        t("Review meetings with students", "todo", 62),
      ],
    },
  ],
};

// ── Third level student ──────────────────────────────────────────────

const STUDENT_LABELS = labels(
  ["Exam", "rose"],
  ["Assignment", "amber"],
  ["Group work", "sky"],
  ["Reading", "teal"],
  ["Revision", "violet"],
);

type Dated = Readonly<{ title: string; due: number; extra?: Extra; status?: SampleStatus }>;

/** One module: exactly two assignments and two exams as big dates, plus its own tasks. */
function moduleProject(input: {
  key: string;
  name: string;
  about: string;
  status?: SampleProject["status"];
  assignments: readonly [Dated, Dated];
  exams: readonly [Dated, Dated];
  tasks: readonly SampleTask[];
}): SampleProject {
  const assignment = (item: Dated) =>
    big(item.title, item.due, { ...item.extra, labels: ["Assignment", ...(item.extra?.labels ?? [])] }, item.status);
  const exam = (item: Dated) =>
    big(item.title, item.due, { ...item.extra, labels: ["Exam", ...(item.extra?.labels ?? [])] }, item.status);
  return {
    key: input.key,
    name: input.name,
    about: input.about,
    status: input.status,
    mainDate: { due: input.exams[1].due, label: "Final exam" },
    labels: STUDENT_LABELS,
    tasks: [
      ...input.tasks,
      assignment(input.assignments[0]),
      assignment(input.assignments[1]),
      exam(input.exams[0]),
      exam(input.exams[1]),
    ],
  };
}

const STUDENT: SampleSet = {
  id: "student",
  name: "third level student",
  blurb: "A business student's semester: six modules, each with two assignments and two exams.",
  projects: [
    moduleProject({
      key: "statistics",
      status: "on-track",
      name: "Statistics",
      about: "Probability, sampling and a data analysis report.",
      assignments: [
        { title: "Problem set 1 due", due: 9 },
        { title: "Data analysis report due", due: 37 },
      ],
      exams: [
        { title: "Statistics midterm exam", due: 23 },
        { title: "Statistics final exam", due: 65, extra: { priority: "p1" } },
      ],
      tasks: [
        t("Read chapters 1 to 3 on probability", "done", -12, { labels: ["Reading"] }),
        t("Install the stats software and load the sample data", "done", -8),
        t("Read chapter 4 on sampling", "doing", -1, { labels: ["Reading"], mine: true }),
        t("Ask the tutor about question 4", "waiting", 0, { notes: "Waiting on a reply from the tutor." }),
        t("Weekly study group", "todo", 2, { labels: ["Group work"], weekly: true }),
        t("Problem set 1, questions 1 to 6", "doing", 3, {
          labels: ["Assignment"], mine: true, hours: 4,
          steps: steps(["Questions 1 and 2", true], ["Question 3", true], "Question 4", "Questions 5 and 6"),
        }),
        t("Read chapter 5 on confidence intervals", "todo", 4, { labels: ["Reading"] }),
        t("Pick a dataset for the report", "todo", 12, {
          labels: ["Assignment"], link: { title: "Report brief", path: "statistics/report-brief" },
        }),
        t("Revision cards for the midterm", "todo", 15, { labels: ["Revision"] }),
        t("Past paper under timed conditions", "todo", 19, { labels: ["Revision", "Exam"], hours: 2 }),
      ],
    }),
    moduleProject({
      key: "microeconomics",
      status: "on-track",
      name: "Microeconomics",
      about: "Supply and demand, elasticity and market structures.",
      assignments: [
        { title: "Essay on price controls due", due: 11 },
        { title: "Market structure case study due", due: 38 },
      ],
      exams: [
        { title: "Microeconomics midterm exam", due: 24 },
        { title: "Microeconomics final exam", due: 66, extra: { priority: "p1" } },
      ],
      tasks: [
        t("Read chapters 2 and 3 on supply and demand", "done", -14, { labels: ["Reading"] }),
        t("Read chapter 6 on elasticity", "done", -5, { labels: ["Reading"] }),
        t("Find three sources for the essay", "doing", -2, { labels: ["Assignment"], mine: true }),
        t("Tutorial questions for week 5", "todo", 0, { priority: "p1", mine: true }),
        t("Essay outline", "review", 1, {
          labels: ["Assignment"], notes: "With Sinead for a read before the first draft.",
        }),
        t("Type up lecture notes", "doing", 2),
        t("Study group on elasticity problems", "todo", 3, { labels: ["Group work"], weekly: true }),
        t("Read chapter 8 on market failure", "todo", 6, { labels: ["Reading"] }),
        t("Summary sheet of the key diagrams", "todo", 17, { labels: ["Revision"] }),
        t("Midterm past papers", "todo", 20, { labels: ["Revision", "Exam"], hours: 3 }),
      ],
    }),
    moduleProject({
      key: "marketing",
      status: "on-track",
      name: "Marketing principles",
      about: "A brand audit and a group campaign plan.",
      assignments: [
        { title: "Brand audit due", due: -3 },
        { title: "Group campaign plan due", due: 30, extra: { labels: ["Group work"] } },
      ],
      exams: [
        { title: "Marketing class test", due: 25 },
        { title: "Marketing final exam", due: 68, extra: { priority: "p1" } },
      ],
      tasks: [
        t("Read chapters 1 and 2 on segmentation", "done", -16, { labels: ["Reading"] }),
        t("Brand audit, first draft", "done", -7, { labels: ["Assignment"] }),
        t("Agree roles for the group campaign", "done", -2, { labels: ["Group work"] }),
        t("Pick the product for the campaign", "waiting", 0, {
          labels: ["Group work"], notes: "Waiting on Cian and Aoife to vote.",
        }),
        t("Competitor research for the campaign", "doing", -1, { labels: ["Group work"], mine: true, hours: 3 }),
        t("Read chapter 7 on pricing", "todo", 4, { labels: ["Reading"] }),
        t("Feedback on the brand audit", "waiting", 10, { notes: "Waiting on the lecturer." }),
        t("Book a room for the pitch rehearsal", "todo", 21, { labels: ["Group work"] }),
        t("Class test revision", "todo", 22, { labels: ["Revision", "Exam"] }),
        t("Slides for the campaign pitch", "todo", 26, {
          labels: ["Group work"],
          steps: steps("Audience and insight", "The idea", "Channels and budget", "How we would measure it"),
        }),
      ],
    }),
    moduleProject({
      key: "financial-accounting",
      status: "at-risk",
      name: "Financial accounting",
      about: "Double entry, trial balances and reading company accounts.",
      assignments: [
        { title: "Bookkeeping exercise due", due: 10 },
        { title: "Company accounts analysis due", due: 44 },
      ],
      exams: [
        { title: "Financial accounting midterm exam", due: 22 },
        { title: "Financial accounting final exam", due: 67, extra: { priority: "p1" } },
      ],
      tasks: [
        t("Read chapters 1 to 3 on double entry", "done", -13, { labels: ["Reading"] }),
        t("Practice set on journals and ledgers", "done", -6),
        t("Practice set on trial balances", "doing", -1, { mine: true }),
        t("Sign up for a tutorial slot", "todo", 0, { priority: "p1" }),
        t("Read chapter 5 on accruals and prepayments", "todo", 3, { labels: ["Reading"] }),
        t("Bookkeeping exercise, part A", "doing", 4, {
          labels: ["Assignment"], mine: true, hours: 5,
          steps: steps(["Journal entries", true], "Post to the ledgers", "Trial balance", "Check against the sample answer"),
        }),
        t("Study group on the bookkeeping exercise", "todo", 6, { labels: ["Group work"], weekly: true }),
        t("Choose a company for the analysis", "todo", 14, { labels: ["Assignment"] }),
        t("Formula sheet", "todo", 16, { labels: ["Revision"] }),
        t("Midterm practice paper", "todo", 18, { labels: ["Revision", "Exam"], hours: 2 }),
      ],
    }),
    moduleProject({
      key: "business-law",
      status: "at-risk",
      name: "Business law",
      about: "Contract law, a case note and a problem question.",
      assignments: [
        { title: "Case note due", due: -2, status: "doing", extra: { priority: "p0", notes: "Two days late. Extension asked for." } },
        { title: "Contract problem question due", due: 45 },
      ],
      exams: [
        { title: "Business law midterm exam", due: 31 },
        { title: "Business law final exam", due: 72, extra: { priority: "p1" } },
      ],
      tasks: [
        t("Read the assigned case twice", "done", -9, { labels: ["Reading"] }),
        t("Case note, first draft", "done", -4, { labels: ["Assignment"] }),
        t("Check citations in the case note", "doing", -2, { labels: ["Assignment"], priority: "p1", mine: true }),
        t("Ask for a short extension", "waiting", -1, { notes: "Waiting on the module coordinator." }),
        t("Seminar preparation for week 6", "todo", 0, { mine: true }),
        t("Read chapters 3 and 4 on contract formation", "doing", 2, { labels: ["Reading"] }),
        t("Sign up for the moot court", "todo", 5),
        t("Read chapter 6 on remedies", "todo", 9, { labels: ["Reading"] }),
        t("Case summaries for revision", "todo", 24, {
          labels: ["Revision"], link: { title: "Case list", path: "business-law/case-list" },
        }),
        t("Plan the problem question", "todo", 34, { labels: ["Assignment"] }),
      ],
    }),
    moduleProject({
      key: "research-methods",
      name: "Research methods",
      about: "A research proposal, an ethics form and a literature review.",
      assignments: [
        { title: "Research proposal due", due: 2, extra: { priority: "p1" } },
        { title: "Literature review due", due: 51 },
      ],
      exams: [
        { title: "Research methods in-class test", due: 32 },
        { title: "Research methods final exam", due: 73, extra: { priority: "p1" } },
      ],
      tasks: [
        t("Choose a research question", "done", -11),
        t("Meet the supervisor about the question", "done", -5),
        t("Reference list for the proposal", "doing", -1, { labels: ["Assignment"], mine: true }),
        t("Proposal, first draft", "review", 0, {
          labels: ["Assignment"], notes: "With Dara for a read through.",
        }),
        t("Ethics form", "doing", 1, {
          priority: "p1", mine: true,
          steps: steps(["Project summary", true], "Consent wording", "Data storage plan", "Supervisor signature"),
        }),
        t("Library workshop on databases", "todo", 6),
        t("Read the two set papers on survey design", "todo", 8, { labels: ["Reading"] }),
        t("Group presentation on sampling", "todo", 13, { labels: ["Group work"] }),
        t("Reading log", "todo", 20, { labels: ["Reading"], weekly: true }),
        t("Plan the literature review", "todo", 28, { labels: ["Assignment"] }),
      ],
    }),
  ],
};

// ── Couple planning a wedding ────────────────────────────────────────

const WEDDING: SampleSet = {
  id: "wedding",
  name: "couple planning a wedding",
  blurb: "A couple's year: the wedding, the hen and stag, the honeymoon and moving in together.",
  projects: [
    {
      key: "the-wedding",
      status: "on-track",
      name: "The wedding",
      about: "Venue, guests, suppliers, fittings and payments, up to the day.",
      mainDate: { due: 75, label: "The day" },
      budgetEuros: 28000,
      labels: labels(
        ["Venue", "violet"], ["Flowers", "pink"], ["Music", "teal"], ["Guests", "sky"],
        ["Paperwork", "amber"], ["Food", "emerald"], ["Outfits", "rose"],
      ),
      tasks: [
        t("Set the budget", "done", -40),
        t("Book the venue", "done", -35, {
          labels: ["Venue"], euros: 2500, notes: "Deposit paid to Tullymarrow House.",
          link: { title: "Venue brochure", path: "the-wedding/venue-brochure" },
        }),
        t("Book the registrar and give notice", "done", -30, { labels: ["Paperwork"] }),
        t("Draft the guest list", "done", -21, { labels: ["Guests"] }),
        t("Book the photographer", "done", -18, { euros: 600, notes: "Deposit paid to Marlowfinch Photography." }),
        t("Send save the dates", "done", -12, { labels: ["Guests"] }),
        t("Choose the florist", "done", -9, { labels: ["Flowers"] }),
        t("Second payment to the venue", "doing", -2, {
          labels: ["Venue"], euros: 4000, priority: "p0", mine: true,
        }),
        t("Final guest list from both families", "waiting", -1, {
          labels: ["Guests"], notes: "Waiting on Mam for the cousins' addresses.",
        }),
        t("Book the band", "doing", 0, {
          labels: ["Music"], euros: 500, priority: "p1", notes: "The Lanternquay Band is holding the date until Friday.",
        }),
        t("Flower order and deposit", "review", 2, {
          labels: ["Flowers"], euros: 350, notes: "Quote is in from Quillfern Flowers. Checking it against the budget.",
        }),
        t("Send invitations", "todo", 3, {
          labels: ["Guests"], mine: true,
          steps: steps(["Proof the wording", true], ["Order the print run", true], "Address the envelopes", "Post them"),
        }),
        big("Menu tasting", 6, { labels: ["Food", "Venue"] }),
        t("Choose the menu", "todo", 8, { labels: ["Food"] }),
        t("Order the cake", "todo", 10, { labels: ["Food"], euros: 420, notes: "Crumbwell Bakery needs six weeks." }),
        big("Dress fitting", 12, { labels: ["Outfits"] }),
        t("Suit fitting", "todo", 14, { labels: ["Outfits"] }),
        t("First dance song", "todo", 20, { labels: ["Music"] }),
        t("Wedding rings", "todo", 25, { euros: 1800 }),
        t("Collect the marriage registration form", "todo", 30, { labels: ["Paperwork"] }),
        t("Order of service", "todo", 45),
        t("Seating plan", "todo", 55, {
          labels: ["Guests"],
          steps: steps("Top table", "Family tables", "Friends", "Check for anyone sitting alone"),
          link: { title: "Seating plan draft", path: "the-wedding/seating-plan" },
        }),
        big("Final numbers to the venue", 61, { labels: ["Venue", "Guests"] }),
        t("Final payment to the venue", "todo", 65, { labels: ["Venue"], euros: 9500 }),
        big("Final dress fitting", 66, { labels: ["Outfits"] }),
        big("Rehearsal at the venue", 73, { labels: ["Venue"] }),
        big("The day", 75, { priority: "p0" }),
        t("Thank you cards", "todo", 95, { labels: ["Guests"] }),
      ],
    },
    {
      key: "hen-and-stag",
      status: "on-track",
      name: "Hen and stag",
      about: "Two weekends away, with bookings and a kitty for each.",
      mainDate: { due: 33, label: "Hen weekend" },
      budgetEuros: 2000,
      labels: labels(["Guests", "sky"], ["Travel", "teal"], ["Payments", "amber"]),
      tasks: [
        t("Pick the dates", "done", -20),
        t("Guest lists for both weekends", "done", -15, { labels: ["Guests"] }),
        t("Book the house for the hen", "done", -10, { euros: 900 }),
        t("Collect hen deposits", "doing", -3, {
          labels: ["Payments"], euros: 720, notes: "Seven of twelve paid.",
        }),
        t("Book the stag activity", "waiting", 0, { notes: "Waiting on Eoin to confirm numbers." }),
        t("Book the hen dinner", "review", 1, { euros: 480 }),
        t("Book the stag dinner", "todo", 4, { euros: 300 }),
        t("Transport for the hen", "todo", 9, { labels: ["Travel"] }),
        t("Playlist and games", "todo", 20),
        t("Shopping list for the house", "todo", 28),
        big("Hen weekend", 33),
        big("Stag weekend", 40),
        t("Settle up the kitty", "todo", 44, { labels: ["Payments"] }),
      ],
    },
    {
      key: "honeymoon",
      status: "at-risk",
      name: "Honeymoon",
      about: "Flights, two stops, paperwork and the packing list.",
      mainDate: { due: 78, label: "Flights out" },
      budgetEuros: 5000,
      labels: labels(["Travel", "teal"], ["Paperwork", "amber"], ["Payments", "emerald"]),
      tasks: [
        t("Agree the budget", "done", -25),
        t("Shortlist three places", "done", -18),
        t("Book flights", "done", -8, { labels: ["Travel"], euros: 1240 }),
        t("Renew the passport", "waiting", -1, {
          labels: ["Paperwork"], priority: "p1", notes: "Application sent. Waiting on the passport office.",
        }),
        t("Travel insurance", "todo", 0, { labels: ["Paperwork"], euros: 85 }),
        t("Book the first hotel", "doing", 2, {
          labels: ["Travel"], euros: 980, notes: "Casa Marevento, five nights.",
          link: { title: "Hotel shortlist", path: "honeymoon/hotel-shortlist" },
        }),
        t("Check entry and vaccination rules", "todo", 5, { labels: ["Paperwork"] }),
        t("Book the second stop", "todo", 7, { labels: ["Travel"] }),
        t("Car hire", "todo", 15, { labels: ["Travel"], euros: 260 }),
        big("Final balance on the hotel", 48, { labels: ["Payments"], euros: 600 }),
        t("Currency and cards", "todo", 60, { labels: ["Payments"] }),
        t("Packing list", "todo", 70, {
          steps: steps("Passports and bookings", "Chargers and adaptors", "Sun cream", "Something smart for dinner"),
        }),
        big("Flights out", 78),
        big("Flights home", 90),
      ],
    },
    {
      key: "moving-in",
      status: "on-track",
      name: "Moving in",
      about: "The lease, the move and setting up the new place.",
      mainDate: { due: 20, label: "Keys" },
      budgetEuros: 4000,
      labels: labels(["Paperwork", "amber"], ["Payments", "emerald"], ["Furniture", "teal"], ["Utilities", "sky"]),
      tasks: [
        t("View the last two apartments", "done", -22),
        t("Send references and payslips", "done", -14, { labels: ["Paperwork"] }),
        t("Pay the deposit", "done", -9, { labels: ["Payments"], euros: 2100 }),
        t("Book the van", "doing", -1, { euros: 120, mine: true }),
        t("Sign the lease", "review", 0, { labels: ["Paperwork"], notes: "Lease is with Ronan for a read." }),
        t("Broadband order", "waiting", 3, { labels: ["Utilities"], notes: "Waiting on an install date." }),
        t("Order the bed and mattress", "todo", 10, { labels: ["Furniture"], euros: 850 }),
        t("Set up electricity and gas", "todo", 16, { labels: ["Utilities"] }),
        t("Contents insurance", "todo", 18, { labels: ["Payments"], euros: 140 }),
        big("Keys", 20),
        t("Measure the rooms", "todo", 21, { labels: ["Furniture"] }),
        big("Moving day", 22, { priority: "p1" }),
        t("Sofa delivery slot", "todo", 24, { labels: ["Furniture"] }),
        t("Change of address list", "todo", 26, {
          labels: ["Paperwork"],
          steps: steps("Bank", "Work", "Revenue", "Doctor"),
        }),
        t("House warming", "todo", 50),
      ],
    },
  ],
};

export const SAMPLE_SETS: Readonly<Record<SampleSetId, SampleSet>> = Object.freeze({
  teacher: TEACHER,
  student: STUDENT,
  wedding: WEDDING,
});
