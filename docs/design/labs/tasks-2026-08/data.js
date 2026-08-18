/* Real content for the Tasks design exploration.
 *
 * Everything in BOARD is lifted verbatim from the review-mode fixture the app
 * actually serves: src/server/demo/tasks-demo.ts (the thirteen tasks, their
 * lanes, priorities, tags, dates, comment counts) and
 * src/lib/review-suite-fixture.ts (The Orchard, events; Mara & Finn; Orla;
 * the pinned review clock of 16 July 2026). Column names and their one-line
 * descriptions are the shipped strings.
 *
 * DENSE_EXTRA is the one honest extension. The shipped fixture holds a single
 * project, which cannot exercise a dense board, so peak season is written out
 * using the two other couples the fixture already names (Nora & Cian,
 * Aisling & Tom) plus the venue's own upkeep. Same voice, same venue, same
 * rules. It is labelled as an extension everywhere it is used.
 */
window.BOARD = {
  today: "2026-07-16",
  workspace: "The Orchard, events",
  season: "Wedding season",
  period: "6 Jul – 10 Oct",
  operator: { name: "Orla", initials: "OR", role: "Orla, venue manager" },
  progress: { done: 5, total: 13, overdue: 1, day: 11, of: 97, left: 86, undated: 5 },
  sidebar: {
    places: [
      { label: "Home", icon: "home" },
      { label: "Inbox", icon: "inbox", count: 8 },
      { label: "My work", icon: "work" },
    ],
    folder: "Project folders",
    projects: [{ label: "The Orchard, events", count: 13, active: true }],
  },
  rail: {
    products: [
      { key: "notes", label: "Notes" },
      { key: "tasks", label: "Tasks", active: true },
      { key: "timeline", label: "Timeline" },
    ],
  },
  views: ["Board", "List", "Schedule", "Calendar"],
  columns: [
    { id: "todo", name: "To do", tone: "neutral", note: "Agreed and ready to start.", empty: "Add the first thing you have to do." },
    { id: "doing", name: "In progress", tone: "flight", note: "In motion right now.", empty: "Move something across when you start it." },
    { id: "review", name: "Review", tone: "neutral", note: "Being checked before it goes out.", empty: "Nothing to check yet." },
    { id: "waiting", name: "Waiting", tone: "neutral", note: "Held by a reply, a delivery, or a decision.", empty: "Nothing held up." },
    { id: "done", name: "Done", tone: "done", note: "Work that is finished and settled.", empty: "The first thing you finish lands here." },
  ],
  tasks: [
    {
      id: "demo-t-01",
      lane: "todo",
      title: "Confirm marquee sides with the hire company",
      note: "Mara & Finn, Saturday. Terrace plan if dry, marquee if not, they need the call by Thursday.",
      tag: "Mara & Finn",
      priority: "High",
      contact: "County Marquee Hire",
      fromNote: true,
    },
    {
      id: "demo-t-03",
      lane: "todo",
      title: "Reprint the faded welcome sign before the open day",
      tag: "Venue",
    },
    {
      id: "demo-t-04",
      lane: "todo",
      title: "Send midweek rate to the June 2027 walk-in couple",
      note: "About 80 guests, budget-conscious. Follow up Friday if no reply.",
      tag: "Enquiry",
    },
    {
      id: "demo-t-02",
      lane: "doing",
      title: "Menu tasting at The Orchard",
      note: "Mara & Finn confirmed the tasting. The venue team needs the final dietary list before service notes are locked.",
      tag: "Mara & Finn",
      priority: "High",
      milestone: "Milestone due 1 Aug",
      contact: "Mara Doyle",
      quiet: "Nothing has moved on it for fifteen days",
      fromNote: true,
    },
    {
      id: "demo-t-05",
      lane: "doing",
      title: "Build the Saturday run-sheet",
      note: "Ceremony 2pm orchard, drinks terrace, dinner 5.30pm. Share with the floor team.",
      tag: "Mara & Finn",
      priority: "High",
      due: "Due today",
      dueAt: "2026-07-16",
      dueTone: "today",
      comments: 2,
    },
    {
      id: "demo-t-06",
      lane: "doing",
      title: "Order tonic and the good olives",
      note: "Two extra cases of tonic; last olive delivery was short.",
      tag: "Bar",
      due: "Overdue by 2 days",
      dueAt: "2026-07-14",
      dueTone: "overdue",
      contact: "Greenfield Wholesale",
      fromNote: true,
    },
    {
      id: "demo-t-07",
      lane: "review",
      title: "Approve the final seating plan",
      note: "Top table moved away from the speakers, check sightlines to the arch.",
      tag: "Mara & Finn",
      priority: "High",
      comments: 1,
    },
    {
      id: "demo-t-08",
      lane: "review",
      title: "Sign off the recommended-suppliers list",
      note: "Add Northlight (photography) and County Marquee. Drop the lapsed DJ.",
      tag: "Venue",
    },
    {
      id: "demo-t-09",
      lane: "done", completedAt: "2026-07-15",
      title: "Open day, nine couples through",
      note: "Three asked for dates. Tea urn was the hero. Repeat the format in spring.",
      tag: "Venue",
    },
    { id: "demo-t-10", lane: "done", completedAt: "2026-07-09", title: "Deposit invoice settled, Mara & Finn", tag: "Mara & Finn" },
    {
      id: "demo_task_checkout",
      lane: "done", completedAt: "2026-07-14",
      title: "Clear Sunday 11am late checkout with housekeeping",
      tag: "Mara & Finn",
      fromNote: true,
    },
    {
      id: "demo_task_linen",
      lane: "done", completedAt: "2026-07-15",
      title: "Chase linen order, now shipping Tuesday",
      tag: "Venue",
      fromNote: true,
    },
    {
      id: "demo_task_registrar",
      lane: "done", completedAt: "2026-07-02",
      title: "Send registrar paperwork two weeks before the date",
      tag: "Mara & Finn",
      fromNote: true,
    },
  ],
  planning: {
    title: "Planning",
    project: "The Orchard, events",
    line: "Wedding season · 6 Jul – 10 Oct",
    summary: "Day 11 of 97 · 86 days left",
    help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
    unscheduled: [
      "Confirm marquee sides with the hire company",
      "Reprint the faded welcome sign before the open day",
      "Send midweek rate to the June 2027 walk-in couple",
      "Approve the final seating plan",
      "Sign off the recommended-suppliers list",
    ],
    milestones: [{ title: "Menu tasting at The Orchard", date: "1 Aug" }],
  },
};

/* Peak season. Written in the venue's own voice, using the two couples the
   review fixture already names. Used only by the dense state, and always
   labelled as an extension of the shipped fixture. */
window.DENSE_EXTRA = [
  { lane: "todo", title: "Send Nora & Cian three photographer names", tag: "Nora & Cian" },
  { lane: "todo", title: "Book the tasting date for Nora & Cian", tag: "Nora & Cian", priority: "High" },
  { lane: "todo", title: "Price the extra hour on the bar for Nora & Cian", tag: "Enquiry" },
  { lane: "todo", title: "Send Aisling & Tom the autumn pricing sheet", tag: "Aisling & Tom" },
  { lane: "todo", title: "Pencil the autumn date in the diary", tag: "Aisling & Tom" },
  { lane: "todo", title: "Service the terrace heaters before October", tag: "Venue" },
  { lane: "todo", title: "Replace the two broken chairs in the barn", tag: "Venue" },
  {
    lane: "doing",
    title: "Chase the florist quote for the spring date",
    tag: "Nora & Cian",
    due: "Due Friday",
    dueAt: "2026-07-17",
    dueTone: "soon",
  },
  { lane: "doing", title: "Confirm the ceremony room layout with Nora", tag: "Nora & Cian", comments: 3 },
  { lane: "doing", title: "Walk Aisling & Tom through the orchard on Sunday", tag: "Aisling & Tom" },
  { lane: "doing", title: "Repaint the gate posts", tag: "Venue" },
  { lane: "review", title: "Check the spring menu against the new supplier list", tag: "Nora & Cian" },
  { lane: "review", title: "Sign off the new drinks list with the bar team", tag: "Bar", priority: "High" },
  {
    lane: "waiting",
    heldSince: "2026-07-14",
    title: "The band’s contract for the spring date",
    tag: "Nora & Cian",
    note: "Sent Tuesday, no reply yet.",
  },
  { lane: "waiting", heldSince: "2026-06-25", title: "Tom’s guest number, before we hold the room", tag: "Aisling & Tom" },
  { lane: "done", completedAt: "2026-07-10", title: "Nora & Cian deposit received", tag: "Nora & Cian" },
  { lane: "done", completedAt: "2026-07-08", title: "First call with Aisling & Tom", tag: "Aisling & Tom" },
  { lane: "done", completedAt: "2026-07-12", title: "Gravel delivered for the top car park", tag: "Venue" },
  { lane: "done", completedAt: "2026-07-11", title: "New signage quote agreed", tag: "Venue" },
];
