/* The field guide: sample data. Invented, believable, front-end only. */

export type ProjectId = "mara" | "orchard" | "hollis" | "riverside";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  kind: string;
  hue: number; // --v3-project-n
};

export const PROJECTS: Project[] = [
  { id: "mara", name: "Mara & Finn", short: "Mara & Finn", kind: "Wedding, 17 October", hue: 8 },
  { id: "orchard", name: "The Orchard, events", short: "The Orchard", kind: "Venue, weekends", hue: 7 },
  { id: "hollis", name: "Hollis Cafe launch", short: "Hollis Cafe", kind: "Launch, 3 November", hue: 5 },
  { id: "riverside", name: "Riverside survey", short: "Riverside", kind: "Class project, due 9 October", hue: 3 },
];

export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

export type ToolId =
  | "budget"
  | "calendar"
  | "countdown"
  | "dayplan"
  | "email"
  | "files"
  | "forms"
  | "groupsplit"
  | "guestlist"
  | "moodboard"
  | "notes"
  | "polls"
  | "rota"
  | "seating"
  | "social"
  | "suppliers"
  | "tasks"
  | "templates"
  | "timeline"
  | "timers"
  | "weather"
  | "whatsapp";

export type Tag = "weddings" | "venues" | "events" | "classes" | "groups" | "launches" | "cafes and shops" | "everyone";

export type Tool = {
  id: ToolId;
  name: string;
  /** What it does, in one plain line. */
  line: string;
  /** The field guide entry: where you find it, what it is like to use. */
  entry: string;
  goodFor: Tag[];
  /** Tile colour: a v3 token name without the leading dashes. */
  tone: string;
  status: "core" | "ready" | "building";
  /** Story that shows it in use. */
  story?: StoryId;
  pairs?: ToolId[];
};

export const TOOLS: Tool[] = [
  {
    id: "budget",
    name: "Budget",
    line: "What is paid, what is due, and when",
    entry: "A running list of costs with a due date on each deposit. Paid and still to pay sit side by side, so the total never surprises you.",
    goodFor: ["weddings", "venues", "launches"],
    tone: "v3-project-4",
    status: "ready",
    story: "deposits",
    pairs: ["calendar", "suppliers"],
  },
  {
    id: "calendar",
    name: "Calendar sync",
    line: "Your dates in Google, Apple or Outlook calendar",
    entry: "Every date in a Project shows up in the calendar you already check. Change it in one place and the other follows.",
    goodFor: ["everyone"],
    tone: "v3-project-2",
    status: "ready",
    story: "deposits",
    pairs: ["budget", "countdown"],
  },
  {
    id: "countdown",
    name: "Countdown",
    line: "Days to the big day, shared with anyone",
    entry: "Pick the day and work backwards. The count sits at the top of the Project and on a page you can send to people outside it.",
    goodFor: ["launches", "weddings", "events"],
    tone: "v3-project-6",
    status: "ready",
    story: "launch",
    pairs: ["social", "timeline"],
  },
  {
    id: "dayplan",
    name: "Day plan",
    line: "The run of the day, minute by minute",
    entry: "One page for the day itself. Each step has a time and an owner, suppliers see only their own steps, and anything running late turns amber.",
    goodFor: ["weddings", "venues", "events"],
    tone: "v3-project-5",
    status: "ready",
    story: "orchard",
    pairs: ["suppliers", "timers"],
  },
  {
    id: "email",
    name: "Email in",
    line: "Forward an email, get a task",
    entry: "Each Project has its own address. Forward a supplier's email to it and it arrives as a task with the email attached.",
    goodFor: ["venues", "cafes and shops"],
    tone: "v3-kind-link",
    status: "ready",
    pairs: ["tasks"],
  },
  {
    id: "files",
    name: "Files",
    line: "Every file in one place",
    entry: "Contracts, floor plans and photos, kept with the Project they belong to.",
    goodFor: ["everyone"],
    tone: "v3-kind-doc",
    status: "core",
  },
  {
    id: "forms",
    name: "Forms",
    line: "Questions that answer straight into your lists",
    entry: "Send a short form by link. Each answer becomes a row in the list it belongs to: a reply, a booking, a sign-up.",
    goodFor: ["weddings", "classes", "events"],
    tone: "v3-kind-design",
    status: "ready",
    story: "replies",
    pairs: ["guestlist"],
  },
  {
    id: "groupsplit",
    name: "Group split",
    line: "Share out the work fairly",
    entry: "List the parts of the job and who is in the group. Each part gets one name, and the split stays even as work moves around.",
    goodFor: ["classes", "groups"],
    tone: "v3-project-3",
    status: "ready",
    story: "students",
    pairs: ["polls", "notes"],
  },
  {
    id: "guestlist",
    name: "Guest list",
    line: "Everyone invited, and who replied",
    entry: "Names, replies, plus-ones and dietary notes in one list. The people who have not answered float to the top.",
    goodFor: ["weddings", "events", "launches"],
    tone: "v3-project-8",
    status: "ready",
    story: "replies",
    pairs: ["forms", "seating"],
  },
  {
    id: "moodboard",
    name: "Mood board",
    line: "Pictures and colours in one place",
    entry: "Drop in photos, swatches and links. Pin any of them to a task so the florist sees exactly the arch you meant.",
    goodFor: ["weddings", "launches"],
    tone: "v3-kind-image",
    status: "ready",
    pairs: ["files"],
  },
  {
    id: "notes",
    name: "Notes",
    line: "Catch a thought before it goes",
    entry: "Write, speak or snap a photo. Lines with a name and a date are offered back to you as tasks, and you check each one first.",
    goodFor: ["everyone"],
    tone: "v3-kind-slides",
    status: "core",
    story: "lectures",
  },
  {
    id: "polls",
    name: "Quick poll",
    line: "Let the group decide in a minute",
    entry: "Ask one question with a few answers. Everyone taps once and the choice is written onto the task it was about.",
    goodFor: ["classes", "groups"],
    tone: "v3-review",
    status: "ready",
    pairs: ["groupsplit"],
  },
  {
    id: "rota",
    name: "Rota",
    line: "Who works which shift",
    entry: "A week at a glance with a name on every shift. Swaps are asked for and agreed in the rota, not in a group chat.",
    goodFor: ["venues", "cafes and shops"],
    tone: "v3-project-2",
    status: "ready",
    pairs: ["dayplan"],
  },
  {
    id: "seating",
    name: "Seating plan",
    line: "Tables drawn from your guest list",
    entry: "Drag guests onto tables drawn to the room. Dietary notes follow each guest to the kitchen's copy.",
    goodFor: ["weddings", "venues"],
    tone: "v3-project-8",
    status: "building",
    pairs: ["guestlist"],
  },
  {
    id: "social",
    name: "Social calendar",
    line: "Plan posts next to the work",
    entry: "Posts sit on the same line as the tasks they talk about, so the photo of the new menu is ready before the menu is.",
    goodFor: ["launches", "cafes and shops"],
    tone: "v3-project-6",
    status: "ready",
    story: "launch",
    pairs: ["countdown"],
  },
  {
    id: "suppliers",
    name: "Suppliers",
    line: "Everyone you hire, with their steps",
    entry: "A contact card for each supplier with their deposit, their arrival time and a link that shows them only their part of the day.",
    goodFor: ["weddings", "venues"],
    tone: "v3-project-4",
    status: "ready",
    story: "orchard",
    pairs: ["dayplan", "budget"],
  },
  {
    id: "tasks",
    name: "Tasks",
    line: "Plan and track work together",
    entry: "Everything that needs doing, who is doing it, and when.",
    goodFor: ["everyone"],
    tone: "v3-accent",
    status: "core",
  },
  {
    id: "templates",
    name: "Templates",
    line: "Start from a Project that worked",
    entry: "Save any Project as a starting point. Dates shift to the new day, names are left blank, and the steps stay in order.",
    goodFor: ["everyone"],
    tone: "v3-kind-neutral",
    status: "ready",
  },
  {
    id: "timeline",
    name: "Timeline",
    line: "Dates and the run of the day",
    entry: "The big dates in order, and a page you can share with people outside the Project.",
    goodFor: ["everyone"],
    tone: "v3-project-3",
    status: "core",
  },
  {
    id: "timers",
    name: "Timers",
    line: "Keep a talk, a speech or a set on time",
    entry: "A large, calm clock for whoever is on stage, with a quiet nudge at two minutes to go.",
    goodFor: ["classes", "events"],
    tone: "v3-project-1",
    status: "ready",
    pairs: ["dayplan"],
  },
  {
    id: "weather",
    name: "Weather watch",
    line: "A nudge when rain is due on an outdoor day",
    entry: "Watches the forecast for the days in your Timeline and tells you in time to book the marquee.",
    goodFor: ["events", "weddings"],
    tone: "v3-kind-link",
    status: "building",
  },
  {
    id: "whatsapp",
    name: "WhatsApp updates",
    line: "Send the day's changes to a group chat",
    entry: "When a time moves on the day plan, the group hears about it once, in plain words.",
    goodFor: ["weddings", "events"],
    tone: "v3-success",
    status: "building",
    pairs: ["dayplan"],
  },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;

export const CORE: ToolId[] = ["tasks", "timeline", "notes", "files"];

/** Which Projects each tool is on for, in the established account. */
export const ENABLED_ESTABLISHED: Partial<Record<ToolId, ProjectId[]>> = {
  tasks: ["mara", "orchard", "hollis", "riverside"],
  timeline: ["mara", "orchard", "hollis", "riverside"],
  notes: ["orchard", "riverside"],
  files: ["mara", "orchard", "hollis", "riverside"],
  guestlist: ["orchard"],
  dayplan: ["orchard", "hollis"],
};

export const ENABLED_NEW: Partial<Record<ToolId, ProjectId[]>> = {
  tasks: ["mara", "orchard", "hollis", "riverside"],
  timeline: ["mara", "orchard", "hollis", "riverside"],
  notes: ["mara", "orchard", "hollis", "riverside"],
  files: ["mara", "orchard", "hollis", "riverside"],
};

/* ── stories ─────────────────────────────────────────────────────────── */

export type StoryId = "orchard" | "replies" | "students" | "launch" | "deposits" | "lectures";

export type Fit = "events" | "venue" | "class";

export type Row = {
  /** Time, date or short lead cell. */
  a: string;
  /** What happens. */
  b: string;
  /** Who. */
  c: string;
  tone?: "late" | "done" | "wait" | "shared";
};

export type Section = { heading: string; body: string[]; quote?: { text: string; who: string } };

export type Story = {
  id: StoryId;
  headline: string;
  dek: string;
  byline: string;
  team: string; // initials mark
  hue: number;
  minutes: number;
  tools: ToolId[];
  /** The tool the reader can try and turn on. */
  primary: ToolId;
  fits: Fit[];
  sections: [Section, Section, Section];
  figure: {
    title: string;
    caption: string;
    callouts: [string, string, string];
  };
  specimen: {
    /** Heading over their example. */
    title: string;
    columns: [string, string, string];
    rows: Row[];
    /** Heading and rows once it is tried on your Project. */
    yours: Record<ProjectId, { title: string; rows: Row[] }>;
  };
};

export const STORIES: Story[] = [
  {
    id: "orchard",
    headline: "How The Orchard runs a 180‑guest Saturday on one page",
    dek: "Five people, eleven suppliers and a walled garden. Aoife stopped printing the run-sheet in March, and nobody has asked for paper since.",
    byline: "The Orchard, events team of 5",
    team: "O",
    hue: 7,
    minutes: 4,
    tools: ["dayplan", "suppliers"],
    primary: "dayplan",
    fits: ["events", "venue"],
    sections: [
      {
        heading: "The sheet that was always out of date",
        body: [
          "Until this spring The Orchard ran every wedding from a printed run-sheet. Aoife Byrne, who manages events, would print twelve copies on Friday afternoon. By eleven on Saturday morning at least one time had moved, and the copies in the kitchen, the bar and the florist's van no longer agreed.",
          "The fix was not a better sheet. It was one sheet that everyone looks at, which changes when the day changes.",
        ],
        quote: { text: "I used to spend the first hour of every wedding walking round with a pen, correcting paper.", who: "Aoife Byrne, events manager" },
      },
      {
        heading: "Every step has a time and a name",
        body: [
          "The day plan is a single page: a time, what happens, and who makes it happen. Suppliers get a link that shows only their own steps, so the band never scrolls past the cake table and the kitchen never sees the florist's load-in.",
          "When a step runs late, it turns amber on every phone at once. The kitchen sees the speeches have slipped fifteen minutes before anyone has to go and tell them.",
        ],
        quote: { text: "Chef stopped asking me what time it is. He just looks at his phone.", who: "Niamh Walsh, front of house" },
      },
      {
        heading: "Saturday, by the numbers",
        body: [
          "A typical Orchard Saturday now has 34 steps, 11 suppliers and one page. Aoife writes it on Wednesday from the template of the last wedding, and it is finished by lunchtime.",
          "The printer is still in the office. It mostly prints place cards now.",
        ],
      },
    ],
    figure: {
      title: "Anatomy of a day plan",
      caption: "The Orchard's plan for Saturday 12 September, as the team sees it at 7.40 in the evening.",
      callouts: ["Each step has a time and an owner", "Suppliers see only their steps", "Late steps turn amber"],
    },
    specimen: {
      title: "Saturday 12 September at The Orchard",
      columns: ["Time", "What happens", "Who"],
      rows: [
        { a: "11:00", b: "Florist dresses the arch", c: "Bloom Room", tone: "shared" },
        { a: "12:30", b: "Tables laid in the long barn", c: "Aoife" },
        { a: "14:00", b: "Ceremony in the walled garden", c: "Niamh" },
        { a: "15:15", b: "Drinks on the lawn", c: "Bar team" },
        { a: "17:30", b: "Dinner is served", c: "Kitchen" },
        { a: "19:45", b: "Speeches", c: "Best man", tone: "late" },
        { a: "21:00", b: "First dance", c: "The Lanterns", tone: "shared" },
      ],
      yours: {
        mara: {
          title: "Saturday 17 October, Mara & Finn",
          rows: [
            { a: "10:30", b: "Harbour Florists set up the arch", c: "Harbour Florists", tone: "shared" },
            { a: "12:00", b: "Hair and make-up finished", c: "Mara" },
            { a: "14:00", b: "Ceremony 2pm", c: "Sinéad, celebrant" },
            { a: "15:00", b: "Photos down by the lake", c: "Finn" },
            { a: "17:00", b: "Dinner by Chef Ronan", c: "Chef Ronan", tone: "shared" },
            { a: "19:30", b: "Speeches", c: "Cian" },
            { a: "21:00", b: "First dance", c: "The Tuesday Club" },
          ],
        },
        orchard: {
          title: "Saturday 19 September at The Orchard",
          rows: [
            { a: "11:30", b: "Florist dresses the long barn", c: "Bloom Room", tone: "shared" },
            { a: "13:00", b: "Tables laid for 140", c: "Aoife" },
            { a: "14:30", b: "Ceremony in the orchard", c: "Niamh" },
            { a: "15:45", b: "Drinks and lawn games", c: "Bar team" },
            { a: "18:00", b: "Dinner is served", c: "Kitchen" },
            { a: "20:00", b: "Speeches", c: "Father of the bride" },
            { a: "21:15", b: "First dance", c: "Sound of Arklow", tone: "shared" },
          ],
        },
        hollis: {
          title: "Opening day, 3 November, Hollis Cafe",
          rows: [
            { a: "06:30", b: "Bread delivery at the back door", c: "Tallow Bakery", tone: "shared" },
            { a: "07:15", b: "Coffee machine warmed and dialled in", c: "Jess" },
            { a: "08:00", b: "Doors open", c: "Ollie" },
            { a: "10:00", b: "First free-cake hour", c: "Jess" },
            { a: "12:30", b: "Lunch menu goes live", c: "Kitchen" },
            { a: "15:00", b: "Local radio drops in", c: "Brightwater", tone: "shared" },
            { a: "18:00", b: "Close and count up", c: "Ollie" },
          ],
        },
        riverside: {
          title: "Presentation day, 9 October, Riverside",
          rows: [
            { a: "09:00", b: "Print the survey handouts", c: "Priya" },
            { a: "09:30", b: "Test the slides on the room screen", c: "Tom" },
            { a: "10:00", b: "Introduction and method", c: "Priya" },
            { a: "10:06", b: "What the river data shows", c: "Sam" },
            { a: "10:12", b: "What we would do next", c: "Leah" },
            { a: "10:18", b: "Questions from the class", c: "Everyone" },
            { a: "10:30", b: "Hand in the written report", c: "Tom" },
          ],
        },
      },
    },
  },
  {
    id: "replies",
    headline: "The 27 replies Mara and Finn nearly missed",
    dek: "Half their guests answered by text, a few by email and one by postcard. A form and a list put every answer in the same place.",
    byline: "Mara & Finn, a wedding for 120",
    team: "M",
    hue: 8,
    minutes: 3,
    tools: ["guestlist", "forms"],
    primary: "guestlist",
    fits: ["events"],
    sections: [
      {
        heading: "Replies in five places",
        body: [
          "Six weeks out, Mara counted 93 yes, 12 no, and a feeling that something was missing. The answers were spread across two phones, one inbox, a note on the fridge and Finn's mother's memory.",
          "When they finally sat down with every message side by side, 27 people had replied in ways neither of them had written down.",
        ],
        quote: { text: "We had been planning a dinner for the wrong number of people for three weeks.", who: "Mara" },
      },
      {
        heading: "One link, one list",
        body: [
          "They sent a short form: coming or not, a plus-one, and anything the kitchen should know. Each answer became a row in the guest list the moment someone pressed send.",
          "People who had not replied rose to the top of the list on their own. Finn sent one polite nudge a week to whoever was there, and that was all the chasing they did.",
        ],
        quote: { text: "The list told us who to text. We stopped trying to remember.", who: "Finn" },
      },
      {
        heading: "What the kitchen saw",
        body: [
          "Dietary notes went straight to Chef Ronan's copy: 9 vegetarian, 3 no gluten, 1 no nuts at table 6. He never had to ask, and nobody had to retype it.",
        ],
      },
    ],
    figure: {
      title: "Anatomy of a guest list",
      caption: "Mara & Finn's list, five weeks before the day.",
      callouts: ["Every reply lands as a row", "No reply yet floats to the top", "Dietary notes go to the kitchen"],
    },
    specimen: {
      title: "Mara & Finn's guest list",
      columns: ["Reply", "Guest", "Note"],
      rows: [
        { a: "Waiting", b: "Aunt Bríd and Pádraig", c: "Asked twice", tone: "wait" },
        { a: "Waiting", b: "Dara Keane", c: "Asked once", tone: "wait" },
        { a: "Coming", b: "Lucy and Sam Hart", c: "One vegetarian", tone: "done" },
        { a: "Coming", b: "Ronan Duffy", c: "No gluten", tone: "done" },
        { a: "Not coming", b: "The Morrisseys", c: "Sent a card" },
      ],
      yours: {
        mara: {
          title: "Your list for Mara & Finn",
          rows: [
            { a: "Waiting", b: "Cian's plus-one", c: "Name not given", tone: "wait" },
            { a: "Waiting", b: "Orla and Mick Ryan", c: "Asked once", tone: "wait" },
            { a: "Coming", b: "Grace Adeyemi", c: "Vegetarian", tone: "done" },
            { a: "Coming", b: "Sinéad Hayes", c: "Celebrant, no meal", tone: "done" },
            { a: "Not coming", b: "Uncle Tom", c: "In Boston that week" },
          ],
        },
        orchard: {
          title: "Open day guests, The Orchard",
          rows: [
            { a: "Waiting", b: "Kelly and Dan", c: "Enquired in August", tone: "wait" },
            { a: "Waiting", b: "Ailbhe Murphy", c: "Asked once", tone: "wait" },
            { a: "Coming", b: "Joe and Ana Reyes", c: "Bringing parents", tone: "done" },
            { a: "Coming", b: "Siobhán Kerr", c: "Wants the barn tour", tone: "done" },
            { a: "Not coming", b: "Conor Lane", c: "Booked elsewhere" },
          ],
        },
        hollis: {
          title: "Launch night guests, Hollis Cafe",
          rows: [
            { a: "Waiting", b: "Local radio", c: "Asked once", tone: "wait" },
            { a: "Waiting", b: "Tallow Bakery", c: "Name the plus-one", tone: "wait" },
            { a: "Coming", b: "Neighbours at number 12", c: "Two people", tone: "done" },
            { a: "Coming", b: "Brightwater studio", c: "Three people", tone: "done" },
            { a: "Not coming", b: "The landlord", c: "Sends best wishes" },
          ],
        },
        riverside: {
          title: "Presentation audience, Riverside",
          rows: [
            { a: "Waiting", b: "Ms Kavanagh", c: "Asked once", tone: "wait" },
            { a: "Waiting", b: "River trust volunteer", c: "Asked twice", tone: "wait" },
            { a: "Coming", b: "Mr Doyle's class", c: "Twenty-four people", tone: "done" },
            { a: "Coming", b: "Priya's parents", c: "Two people", tone: "done" },
            { a: "Not coming", b: "Council officer", c: "Sent questions" },
          ],
        },
      },
    },
  },
  {
    id: "students",
    headline: "Four students, one deadline, no group chat arguments",
    dek: "Priya, Tom, Sam and Leah split a river survey four ways and kept it fair without a single late-night message thread.",
    byline: "Riverside survey, a class group of 4",
    team: "R",
    hue: 3,
    minutes: 3,
    tools: ["groupsplit"],
    primary: "groupsplit",
    fits: ["class"],
    sections: [
      {
        heading: "Who is doing what",
        body: [
          "Every group project starts with the same question and most never quite answer it. The Riverside group listed the job in nine parts on the first afternoon: sampling, photos, the map, the write-up, and so on.",
          "Each part got exactly one name. Not two, not a question mark.",
        ],
        quote: { text: "It is very hard to argue with a list you all made together.", who: "Leah, group member" },
      },
      {
        heading: "Keeping it even",
        body: [
          "When Sam was ill for a week, two of his parts moved to Tom and one to Priya. The split showed everyone was still carrying about a quarter, so nobody felt short-changed.",
        ],
        quote: { text: "The bar at the top showed we were all about the same. That ended the conversation.", who: "Tom" },
      },
      {
        heading: "The last three days",
        body: [
          "With one deadline and four names on it, each of them could see what was left without asking. They handed in on the Thursday, a day early.",
        ],
      },
    ],
    figure: {
      title: "Anatomy of a group split",
      caption: "The Riverside split, eleven days before hand-in.",
      callouts: ["Each part has one name on it", "The split stays even as work moves", "Everyone sees the same deadline"],
    },
    specimen: {
      title: "Riverside's split",
      columns: ["Share", "Part of the job", "Who"],
      rows: [
        { a: "3 parts", b: "Water sampling at three points", c: "Priya", tone: "done" },
        { a: "2 parts", b: "Photos and the site map", c: "Tom" },
        { a: "2 parts", b: "Data tables and charts", c: "Sam", tone: "late" },
        { a: "2 parts", b: "Write-up and references", c: "Leah" },
        { a: "Due", b: "Hand-in, Friday 9 October", c: "Everyone" },
      ],
      yours: {
        riverside: {
          title: "Your split for Riverside",
          rows: [
            { a: "3 parts", b: "Survey the east bank", c: "Priya", tone: "done" },
            { a: "2 parts", b: "Slides for presentation day", c: "Tom" },
            { a: "2 parts", b: "Interview the river trust", c: "Sam" },
            { a: "2 parts", b: "Final report", c: "Leah" },
            { a: "Due", b: "Hand-in, Friday 9 October", c: "Everyone" },
          ],
        },
        mara: {
          title: "Your split for Mara & Finn",
          rows: [
            { a: "3 parts", b: "Suppliers and deposits", c: "Mara" },
            { a: "3 parts", b: "Guests and replies", c: "Finn" },
            { a: "2 parts", b: "Music and the first dance", c: "Finn" },
            { a: "1 part", b: "Flowers with Harbour Florists", c: "Mara" },
            { a: "Due", b: "The day, 17 October", c: "Both" },
          ],
        },
        orchard: {
          title: "Your split for The Orchard",
          rows: [
            { a: "3 parts", b: "Supplier calls", c: "Aoife" },
            { a: "2 parts", b: "Room layouts", c: "Niamh" },
            { a: "2 parts", b: "Bar stock", c: "Declan" },
            { a: "2 parts", b: "Menus with the kitchen", c: "Chef Ronan" },
            { a: "Due", b: "Saturday 19 September", c: "Everyone" },
          ],
        },
        hollis: {
          title: "Your split for Hollis Cafe",
          rows: [
            { a: "3 parts", b: "Fit-out and signage", c: "Ollie" },
            { a: "3 parts", b: "Menu and suppliers", c: "Jess" },
            { a: "2 parts", b: "Social posts", c: "Brightwater" },
            { a: "1 part", b: "Opening-day rota", c: "Ollie" },
            { a: "Due", b: "Opening, 3 November", c: "Everyone" },
          ],
        },
      },
    },
  },
  {
    id: "launch",
    headline: "The launch week Brightwater planned backwards",
    dek: "Start with the morning the doors open, then ask what has to be true the day before. Repeat until today.",
    byline: "Brightwater, a studio of 3, for Hollis Cafe",
    team: "B",
    hue: 6,
    minutes: 4,
    tools: ["countdown", "social"],
    primary: "countdown",
    fits: ["events"],
    sections: [
      {
        heading: "Day zero first",
        body: [
          "Brightwater were hired to launch a cafe that did not have a name yet. They put the opening morning on the page first, 3 November at 8am, and wrote each step backwards from there.",
          "The countdown at the top of the Project did the rest. At 21 days, everyone knew what 21 days meant.",
        ],
        quote: { text: "The number at the top is the only status meeting we have.", who: "Hana Obi, Brightwater" },
      },
      {
        heading: "Posts on the same line as the work",
        body: [
          "The social calendar sits under the same dates as the tasks. The post about the new pastry case is on the same day the pastry case arrives, not a week before it.",
        ],
        quote: { text: "We never announced anything that was not ready. That used to happen every launch.", who: "Jess Hollis, owner" },
      },
      {
        heading: "Sharing the count",
        body: [
          "The owners got a page with the count and the next three things. No sign-in, nothing to learn. They checked it more than anyone.",
        ],
      },
    ],
    figure: {
      title: "Anatomy of a countdown",
      caption: "Hollis Cafe, 21 days before opening.",
      callouts: ["Pick the day, work backwards", "Posts sit on the same line as the work", "The count is shared with the owners"],
    },
    specimen: {
      title: "Hollis Cafe, working back from opening",
      columns: ["Days to go", "What has to be true", "Who"],
      rows: [
        { a: "21", b: "Name and sign agreed", c: "Brightwater", tone: "done" },
        { a: "14", b: "Menu photographed", c: "Hana" },
        { a: "7", b: "First post: the pastry case", c: "Social", tone: "shared" },
        { a: "2", b: "Soft opening for neighbours", c: "Jess" },
        { a: "0", b: "Doors open at 8am", c: "Everyone" },
      ],
      yours: {
        mara: {
          title: "Mara & Finn, working back from the day",
          rows: [
            { a: "22", b: "Final numbers to Chef Ronan", c: "Finn" },
            { a: "14", b: "Seating plan agreed", c: "Mara" },
            { a: "7", b: "Arch design with Harbour Florists", c: "Mara", tone: "shared" },
            { a: "1", b: "Rehearsal at the church", c: "Everyone" },
            { a: "0", b: "Ceremony 2pm", c: "Mara & Finn" },
          ],
        },
        orchard: {
          title: "The Orchard, working back from Saturday",
          rows: [
            { a: "21", b: "Menus confirmed", c: "Kitchen" },
            { a: "10", b: "Final numbers from the couple", c: "Aoife" },
            { a: "5", b: "Supplier links sent", c: "Aoife", tone: "shared" },
            { a: "1", b: "Barn set and lit", c: "Declan" },
            { a: "0", b: "Guests arrive at 1.30pm", c: "Everyone" },
          ],
        },
        hollis: {
          title: "Your countdown for Hollis Cafe",
          rows: [
            { a: "39", b: "Signage goes up", c: "Ollie" },
            { a: "21", b: "Menu photographed", c: "Brightwater" },
            { a: "7", b: "First post: the new pastry case", c: "Social", tone: "shared" },
            { a: "2", b: "Soft opening for neighbours", c: "Jess" },
            { a: "0", b: "Doors open at 8am", c: "Everyone" },
          ],
        },
        riverside: {
          title: "Riverside, working back from hand-in",
          rows: [
            { a: "14", b: "Last samples taken", c: "Priya" },
            { a: "9", b: "Charts drafted", c: "Sam" },
            { a: "5", b: "Report read aloud together", c: "Everyone" },
            { a: "2", b: "Slides rehearsed", c: "Tom" },
            { a: "0", b: "Hand-in and presentation", c: "Everyone" },
          ],
        },
      },
    },
  },
  {
    id: "deposits",
    headline: "Deposits that stopped being a surprise",
    dek: "The Orchard used to find out about a supplier's final payment when the supplier rang. Now it is in the calendar a week ahead.",
    byline: "The Orchard, events team of 5",
    team: "O",
    hue: 4,
    minutes: 3,
    tools: ["budget", "calendar"],
    primary: "budget",
    fits: ["venue", "events"],
    sections: [
      {
        heading: "The call nobody wants",
        body: [
          "A band's balance falls due, the band rings, and someone opens a spreadsheet to find out whether it was paid. At The Orchard that happened twice a month.",
        ],
        quote: { text: "We were never late on purpose. We just never saw it coming.", who: "Declan Fox, owner" },
      },
      {
        heading: "Every deposit has a date",
        body: [
          "Each line in the budget carries a due date. The dates go straight into the calendar the team already checks each morning, a week before they fall due.",
          "Paid and still to pay sit next to each other, so the question is never whether, only when.",
        ],
        quote: { text: "The calendar reminds me. I did not have to set anything.", who: "Aoife Byrne" },
      },
      {
        heading: "Since June",
        body: ["No supplier has had to ring about a payment. The spreadsheet is archived."],
      },
    ],
    figure: {
      title: "Anatomy of a budget",
      caption: "The Orchard's supplier costs for September.",
      callouts: ["Every deposit has a due date", "Due dates appear in your calendar", "Paid and still to pay, side by side"],
    },
    specimen: {
      title: "The Orchard, September suppliers",
      columns: ["Due", "Cost", "Who"],
      rows: [
        { a: "2 Sep", b: "Band balance, €1,800", c: "The Lanterns", tone: "done" },
        { a: "5 Sep", b: "Florist deposit, €450", c: "Bloom Room", tone: "done" },
        { a: "14 Sep", b: "Marquee hire, €2,200", c: "Wicklow Tents" },
        { a: "21 Sep", b: "Cake balance, €320", c: "Sugar Loaf", tone: "wait" },
        { a: "28 Sep", b: "Photographer, €900", c: "Fern Studio" },
      ],
      yours: {
        mara: {
          title: "Mara & Finn's budget",
          rows: [
            { a: "1 Oct", b: "Harbour Florists balance, €950", c: "Harbour Florists", tone: "wait" },
            { a: "3 Oct", b: "Menu deposit, €2,400", c: "Chef Ronan" },
            { a: "7 Oct", b: "Band balance, €1,200", c: "The Tuesday Club" },
            { a: "10 Oct", b: "Dress alterations, €180", c: "Mara", tone: "done" },
            { a: "17 Oct", b: "Celebrant gift, €100", c: "Finn" },
          ],
        },
        orchard: {
          title: "The Orchard, October suppliers",
          rows: [
            { a: "3 Oct", b: "Bar restock, €1,100", c: "Declan", tone: "done" },
            { a: "9 Oct", b: "Linen hire, €380", c: "Kerry Linen" },
            { a: "15 Oct", b: "Band balance, €1,600", c: "Sound of Arklow", tone: "wait" },
            { a: "22 Oct", b: "Heaters for the barn, €640", c: "Wicklow Tents" },
            { a: "30 Oct", b: "Window cleaning, €220", c: "Clear View" },
          ],
        },
        hollis: {
          title: "Hollis Cafe, launch costs",
          rows: [
            { a: "6 Oct", b: "Signage, €1,450", c: "Brightwater", tone: "done" },
            { a: "13 Oct", b: "Coffee machine deposit, €900", c: "Roast & Co" },
            { a: "20 Oct", b: "Opening flowers, €160", c: "Harbour Florists" },
            { a: "27 Oct", b: "Launch printing, €240", c: "Brightwater", tone: "wait" },
            { a: "3 Nov", b: "Free-cake hour, €90", c: "Tallow Bakery" },
          ],
        },
        riverside: {
          title: "Riverside, what the survey costs",
          rows: [
            { a: "25 Sep", b: "Water test kit, €24", c: "Priya", tone: "done" },
            { a: "28 Sep", b: "Bus to the east bank, €12", c: "Tom", tone: "done" },
            { a: "2 Oct", b: "Printing the report, €18", c: "Leah" },
            { a: "6 Oct", b: "Poster board, €9", c: "Sam", tone: "wait" },
            { a: "9 Oct", b: "Biscuits for the class, €6", c: "Everyone" },
          ],
        },
      },
    },
  },
  {
    id: "lectures",
    headline: "Lecture notes that became tasks",
    dek: "Leah writes fast and tidies later. Notes picks out the lines with a name and a date, and asks before it turns them into anything.",
    byline: "Riverside survey, a class group of 4",
    team: "R",
    hue: 2,
    minutes: 2,
    tools: ["notes"],
    primary: "notes",
    fits: ["class"],
    sections: [
      {
        heading: "Write as fast as the lecture",
        body: [
          "Leah types during every lecture and never goes back to organise it. Notes does not ask her to. Headings, lists and half sentences are all fine.",
        ],
        quote: { text: "My notes look like a mess. They are supposed to.", who: "Leah" },
      },
      {
        heading: "The lines that matter",
        body: [
          "Any line with a person and a date in it, like 'Tom to book the minibus by Tuesday', is offered back as a task. Leah checks each one, fixes the odd date, and sends them to the group.",
        ],
      },
      {
        heading: "What was left",
        body: ["Eleven lectures, 23 tasks, and not one forgotten reading."],
      },
    ],
    figure: {
      title: "Anatomy of a note",
      caption: "Leah's notes from the Thursday lecture.",
      callouts: ["Write as fast as the lecture", "Lines with a name and a date become tasks", "You check each one first"],
    },
    specimen: {
      title: "From Leah's Thursday notes",
      columns: ["By", "Task", "Who"],
      rows: [
        { a: "Tue", b: "Book the minibus", c: "Tom" },
        { a: "Wed", b: "Read chapter 4 on flow rates", c: "Everyone" },
        { a: "Fri", b: "Email the river trust", c: "Sam" },
        { a: "Mon", b: "Draft the method section", c: "Leah" },
        { a: "Mon", b: "Pick the three sample points", c: "Priya" },
      ],
      yours: {
        mara: { title: "", rows: [] },
        orchard: { title: "", rows: [] },
        hollis: { title: "", rows: [] },
        riverside: { title: "", rows: [] },
      },
    },
  },
];

export const storyById = (id: StoryId) => STORIES.find((s) => s.id === id)!;

export const LEAD: StoryId = "orchard";
export const GRID_ORDER: StoryId[] = ["replies", "students", "launch", "deposits", "lectures"];

export const FIT_LABEL: Record<Fit, string> = {
  events: "I plan events",
  venue: "I run a venue",
  class: "We are a class or group",
};

export const FIT_LEAD: Record<Fit, StoryId> = { events: "orchard", venue: "deposits", class: "students" };

export const FIT_TAGS: Record<Fit, Tag[]> = {
  events: ["weddings", "events", "launches"],
  venue: ["venues", "weddings", "cafes and shops"],
  class: ["classes", "groups"],
};

export const TAGS: Tag[] = ["weddings", "venues", "events", "classes", "groups", "launches", "cafes and shops"];
