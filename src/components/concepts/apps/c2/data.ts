/* Apps and tools concept 2, "The shadow board". Invented sample data only. */

export type ZoneId = "before" | "day" | "touch" | "always";
export const ZONES: ZoneId[] = ["before", "day", "touch", "always"];

export type KindId = "wedding" | "venue" | "launch" | "class" | "other";
export type BoardKind = KindId | null;

export type GlyphId =
  | "tasks" | "timeline" | "notes" | "files"
  | "guests" | "rsvp" | "budget" | "suppliers" | "dayplan" | "seating" | "timer"
  | "email" | "whatsapp" | "calsync" | "checklist" | "countdown" | "form"
  | "bookings" | "runsheets" | "deposits" | "supplierbook" | "enquiry" | "rota"
  | "deadlines" | "groupsplit" | "sources" | "studytimer" | "shareddoc" | "peercheck"
  | "press" | "social" | "proofs";

export type Preview =
  | { type: "rows"; rows: { a: string; b: string; tone?: "good" | "wait" | "quiet" }[] }
  | { type: "seating"; tables: number; seated: number; note: string }
  | { type: "timer"; label: string; time: string; next: string }
  | { type: "chat"; lines: { who: string; text: string; kept?: boolean }[] }
  | { type: "form"; title: string; fields: string[] }
  | { type: "count"; value: string; unit: string; note: string }
  | { type: "week"; days: { d: string; items: string[] }[] }
  | { type: "meter"; label: string; value: number; total: number; money?: boolean; rows: { a: string; b: string }[] };

export type Family = "everyday" | "events" | "venues" | "launches" | "classes" | "core";

export type Tool = {
  id: GlyphId;
  name: string;
  hue: string;
  family: Family;
  /** One line for the browse list. */
  line: string;
  does: string;
  reads: string[];
  adds: string[];
  /** What survives a take-down, used in "Your … is kept for 30 days." */
  kept: string;
  /** Used when a board has no Project-specific reason. Still concrete. */
  fallbackReason: string;
  fresh: string;
  preview: Preview;
};

const hue = {
  indigo: "var(--v3-project-1)",
  blue: "var(--v3-project-2)",
  teal: "var(--v3-project-3)",
  green: "var(--v3-project-4)",
  amber: "var(--v3-project-5)",
  orange: "var(--v3-project-6)",
  red: "var(--v3-project-7)",
  pink: "var(--v3-project-8)",
  doc: "var(--v3-kind-doc)",
  sheet: "var(--v3-kind-sheet)",
  design: "var(--v3-kind-design)",
  link: "var(--v3-kind-link)",
  slides: "var(--v3-kind-slides)",
  neutral: "var(--v3-kind-neutral)",
};

const T = (t: Tool) => t;

export const TOOLS: Record<GlyphId, Tool> = {
  tasks: T({
    id: "tasks", name: "Tasks", hue: hue.indigo, family: "core",
    line: "Everything to do, who has it and when it is due.",
    does: "Holds every job in this Project, who has it and when it is due.",
    reads: ["People in this Project", "Dates on the Timeline"],
    adds: ["Due dates to the Timeline", "Reminders for whoever has the task"],
    kept: "tasks", fallbackReason: "", fresh: "Ready for the first task",
    preview: { type: "rows", rows: [{ a: "Confirm the florist", b: "Due Tue", tone: "wait" }, { a: "Send the table plan", b: "Due 8 Oct" }, { a: "Book the band", b: "Done", tone: "good" }] },
  }),
  timeline: T({
    id: "timeline", name: "Timeline", hue: hue.blue, family: "core",
    line: "Where this Project is heading, week by week.",
    does: "Shows the big dates and what has to happen before each one.",
    reads: ["Due dates from Tasks", "The Project date"],
    adds: ["A page you can share without sign-in"],
    kept: "timeline", fallbackReason: "", fresh: "Ready for the first date",
    preview: { type: "rows", rows: [{ a: "Final fitting", b: "2 Oct" }, { a: "Table plan to venue", b: "8 Oct" }, { a: "The day", b: "17 Oct" }] },
  }),
  notes: T({
    id: "notes", name: "Notes", hue: hue.amber, family: "core",
    line: "Quick thoughts, voice memos and photos.",
    does: "Catches anything you type, say or photograph, and turns the useful lines into tasks.",
    reads: ["Nothing, it starts blank"],
    adds: ["Tasks you choose to send", "Lines other tools can pick up"],
    kept: "notes", fallbackReason: "", fresh: "Nothing written yet",
    preview: { type: "rows", rows: [{ a: "Ask Nana about the veil", b: "Yesterday" }, { a: "Photo: cake sketch", b: "Mon" }] },
  }),
  files: T({
    id: "files", name: "Files", hue: hue.doc, family: "core",
    line: "Contracts, photos and documents in one place.",
    does: "Keeps every file for this Project together, with who added it and when.",
    reads: ["Attachments from Tasks and Notes"],
    adds: ["Files any tool can link to"],
    kept: "files", fallbackReason: "", fresh: "No files yet",
    preview: { type: "rows", rows: [{ a: "Venue contract.pdf", b: "Signed" , tone: "good" }, { a: "Menu, final.docx", b: "2 days ago" }] },
  }),

  guests: T({
    id: "guests", name: "Guest list", hue: hue.pink, family: "events",
    line: "Every guest, their reply, meal and table.",
    does: "Keeps every guest in one list, with their reply, meal choice, plus-one and table.",
    reads: ["Names mentioned in tasks and notes", "Replies from the RSVP form"],
    adds: ["Names for Seating", "A count for the caterer"],
    kept: "guest list",
    fallbackReason: "You are inviting people. A guest list keeps names, replies and meals together.",
    fresh: "Guests moved in from your tasks",
    preview: { type: "rows", rows: [{ a: "Nora and Pat Keane", b: "Coming, 2", tone: "good" }, { a: "Dara Flynn", b: "Not replied", tone: "wait" }, { a: "The Ahern family", b: "Coming, 4", tone: "good" }, { a: "Sinead Walsh", b: "Can't make it", tone: "quiet" }] },
  }),
  rsvp: T({
    id: "rsvp", name: "RSVP form", hue: hue.red, family: "events",
    line: "One link guests use to reply. No sign-in.",
    does: "Gives guests one link to reply, choose a meal and add a plus-one. No account needed.",
    reads: ["The Project date and venue"],
    adds: ["Replies to the guest list", "A reminder for anyone who has not replied"],
    kept: "list of replies",
    fallbackReason: "People need to say if they are coming. One link collects every reply.",
    fresh: "Link ready to send",
    preview: { type: "form", title: "Mara and Finn, 17 October", fields: ["Your name", "Coming?", "Meal: beef, fish or garden", "Anything we should know"] },
  }),
  budget: T({
    id: "budget", name: "Budget", hue: hue.green, family: "everyday",
    line: "What you planned to spend and what you have.",
    does: "Tracks what you planned to spend against what you have committed and paid.",
    reads: ["Amounts written in tasks", "Invoices in Files"],
    adds: ["Payment dates to the Timeline"],
    kept: "budget",
    fallbackReason: "Money is mentioned in this Project. A budget adds it up as you go.",
    fresh: "Amounts found in your tasks",
    preview: { type: "meter", label: "Committed", value: 18400, total: 22000, money: true, rows: [{ a: "Venue and food", b: "€11,200" }, { a: "Band", b: "€2,600" }, { a: "Flowers", b: "€1,450" }] },
  }),
  suppliers: T({
    id: "suppliers", name: "Suppliers", hue: hue.orange, family: "events",
    line: "Who is supplying what, when they arrive, what is paid.",
    does: "One page per supplier: phone number, what they are bringing, arrival time and what is still owed.",
    reads: ["Supplier names in tasks and emails", "Invoices in Files"],
    adds: ["Arrival times to the Day plan", "Deposits to the Budget"],
    kept: "supplier book",
    fallbackReason: "Suppliers are spread across tasks. One book keeps numbers and arrival times.",
    fresh: "7 suppliers found in your tasks",
    preview: { type: "rows", rows: [{ a: "Wildflower Studio", b: "Arrives 10:00" }, { a: "The Lanterns (band)", b: "Deposit paid", tone: "good" }, { a: "Crumb and Co.", b: "€380 due", tone: "wait" }] },
  }),
  dayplan: T({
    id: "dayplan", name: "Day plan", hue: hue.indigo, family: "events",
    line: "The day minute by minute, for everyone working it.",
    does: "The day minute by minute, shared with everyone working it, updated live on the day.",
    reads: ["Arrival times from Suppliers", "Dates from the Timeline"],
    adds: ["Slots for the Timer", "A printable run-sheet"],
    kept: "day plan",
    fallbackReason: "There is a day to run. A day plan puts every minute in order.",
    fresh: "11 moments drafted from your notes",
    preview: { type: "rows", rows: [{ a: "11:30  Ceremony", b: "Church of St Brigid" }, { a: "14:00  Drinks reception", b: "The Orchard lawn" }, { a: "17:30  Dinner", b: "Barn" }, { a: "21:00  The Lanterns", b: "Barn" }] },
  }),
  seating: T({
    id: "seating", name: "Seating", hue: hue.design, family: "events",
    line: "Drag guests to tables. Share the plan with the venue.",
    does: "Seat guests at tables by dragging, keep couples together and share the plan with the venue.",
    reads: ["Guests who said yes", "Meal choices"],
    adds: ["A table plan the venue can print"],
    kept: "table plan",
    fallbackReason: "People are coming who will need a seat. Plan the tables here.",
    fresh: "112 guests ready to seat",
    preview: { type: "seating", tables: 14, seated: 0, note: "112 guests ready to seat, 14 tables of 8" },
  }),
  timer: T({
    id: "timer", name: "Timer", hue: hue.slides, family: "everyday",
    line: "Keep each part of the day to its slot.",
    does: "Counts down each slot so speeches, sets and breaks finish on time. Shows on any phone.",
    reads: ["Slots from the Day plan"],
    adds: ["A gentle buzz to whoever is running the slot"],
    kept: "timer settings",
    fallbackReason: "Parts of this Project run to the clock. A timer keeps each one to its slot.",
    fresh: "6 slots from your day plan",
    preview: { type: "timer", label: "Best man's speech", time: "04:00", next: "Then: father of the bride, 5 min" },
  }),
  email: T({
    id: "email", name: "Email", hue: hue.doc, family: "everyday",
    line: "Link threads to this Project so nothing is lost.",
    does: "Links email threads to this Project so replies from suppliers and guests are never lost.",
    reads: ["Threads you choose to link"],
    adds: ["Tasks from emails, only when you ask"],
    kept: "linked threads",
    fallbackReason: "Emails about this Project are arriving. Keep the threads here.",
    fresh: "Ready to link threads",
    preview: { type: "rows", rows: [{ a: "The Orchard: final numbers", b: "Today" }, { a: "Wildflower Studio: invoice", b: "Tue" }] },
  }),
  whatsapp: T({
    id: "whatsapp", name: "WhatsApp", hue: hue.sheet, family: "everyday",
    line: "Bring the useful messages from a group chat.",
    does: "Watches one group chat and brings in only the messages you mark as useful.",
    reads: ["One group you pick", "Nothing else on your phone"],
    adds: ["Marked messages as notes"],
    kept: "saved messages",
    fallbackReason: "Plans are being made in a group chat. Bring the useful messages here.",
    fresh: "Pick a group to connect",
    preview: { type: "chat", lines: [{ who: "Mara's mum", text: "Can Nana have a seat near the door?" , kept: true }, { who: "Aunt Ruth", text: "Lovely photos from the fitting" }, { who: "Finn", text: "Band want the set list by Friday", kept: true }] },
  }),
  calsync: T({
    id: "calsync", name: "Calendar sync", hue: hue.link, family: "everyday",
    line: "Dates from this Project on your own calendar.",
    does: "Puts this Project's dates on Google, Apple or Outlook calendars and keeps them current.",
    reads: ["Dates on the Timeline", "Due dates you choose from Tasks"],
    adds: ["Events on the calendars you pick"],
    kept: "calendar links",
    fallbackReason: "This Project has dates people will want on their own calendars.",
    fresh: "Pick calendars to sync",
    preview: { type: "week", days: [{ d: "Fri 2", items: ["Final fitting"] }, { d: "Wed 8", items: ["Table plan due"] }, { d: "Sat 17", items: ["The day"] }] },
  }),
  checklist: T({
    id: "checklist", name: "Checklist", hue: hue.teal, family: "everyday",
    line: "A simple list to tick off, no dates needed.",
    does: "A plain list to tick off. No dates, no owners, just done or not done.",
    reads: ["Lines starting with a dash in Notes"],
    adds: ["Ticked items as a record"],
    kept: "checklist",
    fallbackReason: "Some jobs here are small. A checklist is lighter than a task.",
    fresh: "Lines from your notes added",
    preview: { type: "rows", rows: [{ a: "Rings", b: "Packed", tone: "good" }, { a: "Speeches printed", b: "Not yet", tone: "wait" }, { a: "Emergency kit", b: "Not yet", tone: "wait" }] },
  }),
  countdown: T({
    id: "countdown", name: "Countdown", hue: hue.red, family: "everyday",
    line: "One number everyone can see.",
    does: "Shows the days to go on this Project and on its shared Timeline page.",
    reads: ["The Project date"],
    adds: ["The number to the shared Timeline page"],
    kept: "countdown",
    fallbackReason: "This Project has a big date. A countdown keeps it in view.",
    fresh: "Counting down",
    preview: { type: "count", value: "22", unit: "days to go", note: "Shows on the shared Timeline page too" },
  }),
  form: T({
    id: "form", name: "Form", hue: hue.design, family: "everyday",
    line: "Ask anyone a few questions. No sign-in.",
    does: "Asks anyone a few questions with one link. Answers land here, sorted.",
    reads: ["Nothing until you write the questions"],
    adds: ["Answers as a list", "Tasks from answers, if you ask"],
    kept: "answers",
    fallbackReason: "You are collecting answers from people. A form puts them in one place.",
    fresh: "Blank form ready",
    preview: { type: "form", title: "A few questions", fields: ["Name", "Your answer", "Anything else"] },
  }),

  bookings: T({
    id: "bookings", name: "Bookings", hue: hue.teal, family: "venues",
    line: "Every event booked at the venue, by date.",
    does: "Every event booked for the season, by date, with who is getting married or celebrating and how many are coming.",
    reads: ["Enquiries that became bookings", "Deposits"],
    adds: ["Each event to the Timeline", "A run-sheet to start from"],
    kept: "bookings", fallbackReason: "Events are being booked. Keep every date and couple in one place.", fresh: "Dates found in your tasks",
    preview: { type: "rows", rows: [{ a: "Sat 27 Sep  Byrne and Cole", b: "120 guests" }, { a: "Sat 4 Oct  Hughes 40th", b: "60 guests" }, { a: "Sat 17 Oct  Mara and Finn", b: "148 guests" }] },
  }),
  runsheets: T({
    id: "runsheets", name: "Run-sheets", hue: hue.indigo, family: "venues",
    line: "Minute-by-minute plans for each event.",
    does: "A minute-by-minute plan for each event, printed or on a phone for staff.",
    reads: ["Bookings", "Supplier arrival times"],
    adds: ["Shifts to the Staff rota"],
    kept: "run-sheets", fallbackReason: "Each event needs a plan for staff. Run-sheets keep one per event.", fresh: "One run-sheet per booking",
    preview: { type: "rows", rows: [{ a: "10:00  Florist arrives", b: "Side gate" }, { a: "13:30  Ceremony", b: "Orchard lawn" }, { a: "15:00  Canapés", b: "4 staff" }] },
  }),
  deposits: T({
    id: "deposits", name: "Deposits", hue: hue.green, family: "venues",
    line: "Who has paid, who owes and when it is due.",
    does: "Tracks each deposit and balance, and reminds couples before the due date.",
    reads: ["Bookings", "Amounts in emails"],
    adds: ["Due dates to the Timeline"],
    kept: "deposit records", fallbackReason: "Couples pay in parts. Deposits shows who still owes what.", fresh: "Amounts found in your bookings",
    preview: { type: "meter", label: "Paid this season", value: 38600, total: 42800, money: true, rows: [{ a: "Hughes 40th", b: "€1,200 due 1 Oct" }, { a: "Doyle and Shah", b: "€2,000 due 12 Oct" }] },
  }),
  supplierbook: T({
    id: "supplierbook", name: "Supplier book", hue: hue.orange, family: "venues",
    line: "The florists, bands and caterers you trust.",
    does: "The suppliers you work with again and again: numbers, rates, and which events they are on.",
    reads: ["Supplier names across bookings and tasks"],
    adds: ["Arrival times to run-sheets"],
    kept: "supplier book", fallbackReason: "You work with the same suppliers each season. Keep their details in one book.", fresh: "Suppliers found in your tasks",
    preview: { type: "rows", rows: [{ a: "Wildflower Studio", b: "9 events" }, { a: "The Lanterns", b: "6 events" }, { a: "Crumb and Co.", b: "11 events" }] },
  }),
  enquiry: T({
    id: "enquiry", name: "Enquiry form", hue: hue.red, family: "venues",
    line: "A form for your website. Enquiries land here.",
    does: "A form for your website. Every enquiry lands here with the date, numbers and budget.",
    reads: ["Dates already booked, so people see what is free"],
    adds: ["New bookings when you say yes"],
    kept: "enquiries", fallbackReason: "People ask about dates by email. A form catches the details first time.", fresh: "Form ready for your website",
    preview: { type: "form", title: "Ask about a date", fields: ["Date you have in mind", "How many guests", "Your budget", "Email or phone"] },
  }),
  rota: T({
    id: "rota", name: "Staff rota", hue: hue.blue, family: "venues",
    line: "Who is working each event.",
    does: "Who is working each event, with swaps and reminders the day before.",
    reads: ["Bookings", "Run-sheets"],
    adds: ["Reminders to staff phones"],
    kept: "rota", fallbackReason: "Staff work different events. A rota shows who is on.", fresh: "Shifts drafted from bookings",
    preview: { type: "week", days: [{ d: "Fri", items: ["Aoife, Tom"] }, { d: "Sat", items: ["Aoife, Tom, Leah, Sam"] }, { d: "Sun", items: ["Leah"] }] },
  }),

  deadlines: T({
    id: "deadlines", name: "Deadlines", hue: hue.red, family: "classes",
    line: "Every hand-in date, with who is doing it.",
    does: "Every hand-in date in one list, with who is doing each part.",
    reads: ["Dates from the brief", "The Timeline"],
    adds: ["Reminders two days before"],
    kept: "deadlines", fallbackReason: "Work is due on set dates. Keep them where the whole group sees them.", fresh: "Dates from your brief",
    preview: { type: "rows", rows: [{ a: "Data sheets", b: "3 Oct" }, { a: "Draft write-up", b: "20 Oct" }, { a: "Hand in", b: "30 Oct" }] },
  }),
  groupsplit: T({
    id: "groupsplit", name: "Group split", hue: hue.teal, family: "classes",
    line: "Who is doing which part, fairly.",
    does: "Splits the work into parts and shows who has each one, so it stays fair.",
    reads: ["People in this Project"],
    adds: ["A task for each part"],
    kept: "group split", fallbackReason: "Several people share the work. Split it so everyone can see who has what.", fresh: "Parts ready to hand out",
    preview: { type: "rows", rows: [{ a: "Upper river", b: "Cian" }, { a: "Weir to bridge", b: "Maya" }, { a: "Estuary", b: "Jonah" }] },
  }),
  sources: T({
    id: "sources", name: "Sources", hue: hue.link, family: "classes",
    line: "Links and books, with who found them.",
    does: "Keeps every link, book and article with who found it and a ready-made reference.",
    reads: ["Links in Notes and Tasks"],
    adds: ["References for the Shared doc"],
    kept: "sources", fallbackReason: "You are reading around the topic. Keep every source with who found it.", fresh: "Links from your notes added",
    preview: { type: "rows", rows: [{ a: "EPA water quality map", b: "Maya" }, { a: "River Dodder report, 2019", b: "Cian" }] },
  }),
  studytimer: T({
    id: "studytimer", name: "Study timer", hue: hue.slides, family: "classes",
    line: "Focused sessions with short breaks.",
    does: "Focused sessions with short breaks, and a shared count of hours put in.",
    reads: ["Study sessions on the Timeline"],
    adds: ["Hours to each person's part"],
    kept: "session history", fallbackReason: "You plan study sessions. A timer keeps them focused.", fresh: "45 minute sessions",
    preview: { type: "timer", label: "Data sheets", time: "45:00", next: "Then: 10 minute break" },
  }),
  shareddoc: T({
    id: "shareddoc", name: "Shared doc", hue: hue.doc, family: "classes",
    line: "One document the whole group writes in.",
    does: "One document the whole group writes, with each section tied to its owner.",
    reads: ["The Group split"],
    adds: ["Word counts per person"],
    kept: "document", fallbackReason: "There is something to write together.", fresh: "Blank document",
    preview: { type: "rows", rows: [{ a: "Introduction", b: "Maya, 310 words" }, { a: "Method", b: "Cian, 540 words" }] },
  }),
  peercheck: T({
    id: "peercheck", name: "Peer check form", hue: hue.design, family: "classes",
    line: "Each person checks another's part.",
    does: "Each person reads another's section and answers three short questions.",
    reads: ["The Group split", "The Shared doc"],
    adds: ["Comments on each section"],
    kept: "answers", fallbackReason: "Your work is marked on how you checked each other.", fresh: "Pairs drawn",
    preview: { type: "form", title: "Checking Cian's section", fields: ["What is clear", "What is missing", "One thing to change"] },
  }),

  press: T({
    id: "press", name: "Press list", hue: hue.slides, family: "launches",
    line: "Local press and who has said yes.",
    does: "Journalists and local pages to tell, with who you have contacted and who replied.",
    reads: ["Email threads you link"],
    adds: ["Follow-up tasks a week later"],
    kept: "press list", fallbackReason: "A launch needs people to hear about it.", fresh: "Blank list",
    preview: { type: "rows", rows: [{ a: "Galway Advertiser", b: "Not contacted", tone: "quiet" }, { a: "Eat Galway (Instagram)", b: "Not contacted", tone: "quiet" }] },
  }),
  social: T({
    id: "social", name: "Social calendar", hue: hue.pink, family: "launches",
    line: "Posts planned up to the big day.",
    does: "Posts planned day by day up to the launch, with the picture and words ready.",
    reads: ["Photos in Files", "The Project date"],
    adds: ["Posting reminders"],
    kept: "planned posts", fallbackReason: "A launch is shared online. Plan the posts to the day.", fresh: "Weeks laid out to opening",
    preview: { type: "week", days: [{ d: "Week 1", items: ["Sneak peek: the counter"] }, { d: "Week 3", items: ["Meet the baker"] }, { d: "Week 7", items: ["Doors open"] }] },
  }),
  proofs: T({
    id: "proofs", name: "Proof approvals", hue: hue.amber, family: "launches",
    line: "Get a clear yes before anything is printed.",
    does: "Send a proof, get a clear yes or a comment, and keep the approved version.",
    reads: ["Images and PDFs in Files"],
    adds: ["Approved versions back to Files"],
    kept: "approvals", fallbackReason: "Things are going to print. Get a yes on each proof first.", fresh: "Nothing waiting for a yes",
    preview: { type: "rows", rows: [{ a: "Menu board, v2", b: "Waiting", tone: "wait" }, { a: "Window sign", b: "Approved", tone: "good" }] },
  }),
};

export type Kind = {
  id: KindId;
  label: string;
  hint: string;
  noun: string;
  zones: Record<ZoneId, string>;
  suggest: Partial<Record<ZoneId, GlyphId[]>>;
  rename?: Partial<Record<GlyphId, string>>;
};

export const CORE: GlyphId[] = ["tasks", "timeline", "notes", "files"];

export const KINDS: Kind[] = [
  {
    id: "wedding", label: "Wedding", hint: "Guests, suppliers and the day itself", noun: "a wedding",
    zones: { before: "Before the day", day: "On the day", touch: "Keep everyone in touch", always: "Always here" },
    suggest: { before: ["guests", "rsvp", "budget", "suppliers"], day: ["dayplan", "seating", "timer"], touch: ["email", "whatsapp", "calsync"] },
  },
  {
    id: "venue", label: "Venue season", hint: "Many events, one place, the same staff", noun: "a venue season",
    zones: { before: "Taking bookings", day: "Running each event", touch: "Suppliers and dates", always: "Always here" },
    suggest: { before: ["bookings", "enquiry", "deposits"], day: ["runsheets", "rota"], touch: ["supplierbook", "email", "calsync"] },
  },
  {
    id: "launch", label: "Launch", hint: "A date, a crowd and getting the word out", noun: "a launch",
    zones: { before: "Getting ready", day: "Opening night", touch: "Getting the word out", always: "Always here" },
    suggest: { before: ["countdown", "budget", "proofs"], day: ["guests", "dayplan"], touch: ["press", "social"] },
    rename: { countdown: "Launch countdown", guests: "Opening guest list", dayplan: "Run of the night" },
  },
  {
    id: "class", label: "Class or group project", hint: "Deadlines, a fair split and sources", noun: "a group project",
    zones: { before: "Planning the work", day: "Doing the work", touch: "Working together", always: "Always here" },
    suggest: { before: ["deadlines", "groupsplit"], day: ["sources", "shareddoc", "studytimer"], touch: ["peercheck"] },
  },
  {
    id: "other", label: "Something else", hint: "A plain board you shape yourself", noun: "this kind of Project",
    zones: { before: "Getting ready", day: "When it happens", touch: "Keep everyone in touch", always: "Always here" },
    suggest: { before: ["checklist", "countdown", "budget"], day: ["dayplan", "timer"], touch: ["form", "email"] },
  },
];

export const UNSET_ZONES: Record<ZoneId, string> = {
  before: "Good places to start", day: "When it happens", touch: "Keep everyone in touch", always: "Always here",
};
export const UNSET_SUGGEST: Partial<Record<ZoneId, GlyphId[]>> = { before: ["checklist", "countdown", "form"] };

export type Detail = {
  status?: string;
  meter?: { value: number; total: number };
  reason?: string;
  reads?: string[];
  fresh?: string;
  /** A quiet line at the foot of a hung tile. */
  last?: string;
};

export type Board = {
  id: string;
  name: string;
  colour: string;
  kind: BoardKind;
  date: string;
  daysLabel: string;
  daysToGo: number | null;
  people: { name: string; initial: string }[];
  canEdit: boolean;
  owner: string;
  createdNote?: string;
  hung: Partial<Record<GlyphId, { by?: string; on?: string }>>;
  detail: Partial<Record<GlyphId, Detail>>;
};

export const TODAY_LABEL = "25 September";

export const BOARDS: Board[] = [
  {
    id: "mara",
    name: "Mara & Finn wedding",
    colour: "var(--v3-project-8)",
    kind: "wedding",
    date: "Saturday 17 October",
    daysLabel: "days to go",
    daysToGo: 22,
    people: [{ name: "You", initial: "A" }, { name: "Finn", initial: "F" }, { name: "Mara", initial: "M" }, { name: "Orla", initial: "O" }],
    canEdit: true,
    owner: "you",
    hung: {
      tasks: {}, timeline: {}, notes: {}, files: {},
      rsvp: { by: "You", on: "2 Aug" }, budget: { by: "You", on: "14 Jul" }, dayplan: { by: "You", on: "9 Sep" },
      email: { by: "You", on: "14 Jul" }, calsync: { by: "Finn", on: "20 Aug" },
    },
    detail: {
      tasks: { status: "31 open, 4 due this week", last: "Mara ticked off 2 today" },
      timeline: { status: "Next: final fitting, 2 Oct", last: "Shared with both families" },
      notes: { status: "14 notes, 2 from yesterday", last: "Voice note from Finn, 9:40" },
      files: { status: "38 files, venue contract signed", last: "Menu, final.docx added Tue" },
      rsvp: { status: "112 of 148 replied", meter: { value: 112, total: 148 }, reads: ["The date and venue from this Project", "148 invitations sent on 2 August"] },
      budget: { status: "€18,400 of €22,000 committed", meter: { value: 18400, total: 22000 } },
      dayplan: { status: "41 moments, 11:30 to 01:00", last: "Orla edited the drinks slot" },
      email: { status: "3 threads with the venue this week", last: "The Orchard replied today" },
      calsync: { status: "On Mara's and Finn's calendars", last: "Synced 10 minutes ago" },
      guests: {
        reason: "You have 9 tasks about guests. A guest list would hold them.",
        reads: ["9 tasks that mention guests", "112 replies from the RSVP form", "Addresses in Invitations.xlsx"],
        fresh: "148 guests, 9 tasks moved in",
      },
      suppliers: {
        reason: "Seven suppliers are spread across tasks and emails. One book keeps their numbers.",
        reads: ["7 supplier names in tasks", "3 invoices in Files", "Threads linked in Email"],
        fresh: "7 suppliers, 2 deposits owed",
      },
      seating: {
        reason: "The Orchard wants a table plan by 8 October. 112 guests have said yes.",
        reads: ["112 guests who said yes", "Meal choices from the RSVP form"],
        fresh: "112 guests ready to seat",
      },
      timer: {
        reason: "Your day plan has 6 speeches. A timer keeps each one to its slot.",
        reads: ["6 speeches and the first dance from the Day plan"],
        fresh: "6 slots from your day plan",
      },
      whatsapp: {
        reason: "Mara's family plans in a WhatsApp group. Bring the useful messages here.",
        reads: ["The one group you pick", "Nothing else on your phone"],
        fresh: "Mara's family group connected",
      },
      checklist: {
        reason: "23 lines in your notes start with a dash. They would tick off nicely.",
        fresh: "23 lines from your notes",
      },
      countdown: {
        reason: "22 days to go. A countdown puts that number on the shared Timeline page.",
        fresh: "22 days to go",
      },
      form: {
        reason: "You are collecting songs for the band by email. A form gathers them in one place.",
        fresh: "Song requests form ready",
      },
    },
  },
  {
    id: "orchard",
    name: "The Orchard",
    colour: "var(--v3-project-3)",
    kind: "venue",
    date: "Autumn season, 1 Sep to 20 Dec",
    daysLabel: "days left in the season",
    daysToGo: 86,
    people: [{ name: "You", initial: "A" }, { name: "Tom", initial: "T" }, { name: "Leah", initial: "L" }],
    canEdit: true,
    owner: "you",
    hung: {
      tasks: {}, timeline: {}, notes: {}, files: {},
      bookings: { by: "You", on: "1 Jun" }, enquiry: { by: "You", on: "1 Jun" }, deposits: { by: "Tom", on: "3 Jun" },
      runsheets: { by: "You", on: "12 Aug" }, email: { by: "You", on: "1 Jun" }, calsync: { by: "Leah", on: "30 Aug" },
    },
    detail: {
      tasks: { status: "58 open across 20 events", last: "Tom finished 6 today" },
      timeline: { status: "Next: Byrne and Cole, Sat 27 Sep", last: "3 events this fortnight" },
      notes: { status: "41 notes", last: "Leah, walk-through notes" },
      files: { status: "212 files", last: "Floor plan v4 added Mon" },
      bookings: { status: "20 events, next on Saturday", last: "2 dates left in October" },
      enquiry: { status: "5 new this week", last: "Newest: a June wedding" },
      deposits: { status: "€4,200 still due from 3 couples", meter: { value: 38600, total: 42800 } },
      runsheets: { status: "6 ready, 2 to write", last: "Saturday's is printed" },
      email: { status: "Linked to hello@theorchard.ie", last: "12 threads this week" },
      calsync: { status: "Staff calendar, 20 events", last: "Synced 4 minutes ago" },
      supplierbook: { reason: "You rebook the same florist and band in 11 tasks. Keep them in one book.", fresh: "14 suppliers found" },
      rota: { reason: "Weekend shifts are planned in Notes. A rota shows who is on each event.", fresh: "Shifts for 20 events drafted" },
    },
  },
  {
    id: "riverside",
    name: "Riverside survey",
    colour: "var(--v3-project-2)",
    kind: "class",
    date: "Hand in Friday 30 October",
    daysLabel: "days to hand in",
    daysToGo: 35,
    people: [{ name: "Aoife", initial: "A" }, { name: "Cian", initial: "C" }, { name: "Maya", initial: "M" }, { name: "Jonah", initial: "J" }, { name: "You", initial: "R" }],
    canEdit: false,
    owner: "Aoife",
    hung: {
      tasks: {}, timeline: {}, notes: {}, files: {},
      deadlines: { by: "Aoife", on: "8 Sep" }, groupsplit: { by: "Aoife", on: "8 Sep" }, shareddoc: { by: "Maya", on: "15 Sep" },
    },
    detail: {
      tasks: { status: "12 open, 2 yours", last: "Cian finished the map" },
      timeline: { status: "Next: data sheets, 3 Oct", last: "3 dates before hand-in" },
      notes: { status: "9 notes", last: "Maya, photo of the weir" },
      files: { status: "26 photos from the river walk", last: "Added by Jonah, Tue" },
      deadlines: { status: "Data sheets in 8 days", last: "3 hand-ins left" },
      groupsplit: { status: "5 people, a stretch of river each", last: "Your part: the estuary" },
      shareddoc: { status: "Write-up, 1,240 words so far", last: "Maya wrote 300 today" },
      sources: { reason: "There are 12 links in your notes. Sources keeps them with who found them." },
      studytimer: { reason: "Four study sessions are on the Timeline. A timer keeps them to 45 minutes." },
      peercheck: { reason: "Part of the mark is how you check each other's sections." },
    },
  },
  {
    id: "hollis",
    name: "Hollis Cafe launch",
    colour: "var(--v3-project-5)",
    kind: "launch",
    date: "Opening night, Saturday 14 November",
    daysLabel: "days to opening",
    daysToGo: 50,
    people: [{ name: "You", initial: "A" }, { name: "Ruth", initial: "R" }],
    canEdit: true,
    owner: "you",
    createdNote: "Made today",
    hung: { tasks: {}, timeline: {}, notes: {}, files: {} },
    detail: {
      tasks: { status: "No tasks yet" },
      timeline: { status: "Opening night, 14 Nov", last: "One date so far" },
      notes: { status: "1 note: the menu idea" },
      files: { status: "Nothing added yet" },
      countdown: { reason: "Opening night is 50 days away. Give the team one number to watch.", fresh: "50 days to opening" },
      budget: { reason: "The fit-out quote is in your first note. Set a limit before more arrive.", fresh: "€9,800 from your first note" },
      proofs: { reason: "Menus and the window sign go to print. Get a yes on each proof first." },
      guests: { reason: "Opening night is invite only. Keep the list and who is coming." },
      dayplan: { reason: "Doors, speeches and the first pour all need a time on the night." },
      press: { reason: "Launches like this contact local press about three weeks out, around 24 Oct." },
      social: { reason: "Your first note mentions Instagram. Plan the posts up to the opening." },
    },
  },
  {
    id: "bookclub",
    name: "Autumn book club",
    colour: "var(--v3-project-6)",
    kind: null,
    date: "First meeting Thursday 9 October",
    daysLabel: "days to the first meeting",
    daysToGo: 14,
    people: [{ name: "You", initial: "A" }, { name: "Niamh", initial: "N" }, { name: "Ed", initial: "E" }],
    canEdit: true,
    owner: "you",
    createdNote: "Made today",
    hung: { tasks: {}, timeline: {}, notes: {}, files: {} },
    detail: {
      tasks: { status: "No tasks yet" },
      timeline: { status: "First meeting, 9 Oct" },
      notes: { status: "No notes yet" },
      files: { status: "Nothing added yet" },
      checklist: { reason: "There are no tasks yet. A checklist is the quickest way to start." },
      countdown: { reason: "Your first meeting is on 9 October. Keep it in view." },
      form: { reason: "Three people have joined. A form asks which book to read first." },
    },
  },
];

export const FAMILY_LABEL: Record<Exclude<Family, "core">, string> = {
  everyday: "Useful anywhere",
  events: "Weddings and events",
  venues: "Venues",
  launches: "Launches",
  classes: "Classes and groups",
};
