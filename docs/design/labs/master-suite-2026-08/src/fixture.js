/* ═══════════════════════════════════════════════════════════════════
   ONE WORLD.

   The Orchard, events. Orla, venue manager. Mara & Finn on Saturday 3
   October, and the review clock pinned to Thursday 16 July 2026. Three
   products, one venue, one cast, one day.

   Everything below this header is the three labs' own data files, in
   their own words, unedited except for one number: Notes' clock, which
   said 15 July while its own copy said 16. The header declares the facts
   they share; the footer joins them and then ASSERTS the agreement, so a
   suite that quietly starts disagreeing with itself fails at load rather
   than in front of somebody.

   GENERATED ONCE by tools/split.mjs. After that this file is the world.
   ═══════════════════════════════════════════════════════════════════ */
var WORLD = (window.WORLD = {
  /* The pinned review clock. src/lib/review-suite-fixture.ts, reviewToday. */
  today: "2026-07-16",
  todayLabel: "Thursday 16 July",
  nowUTC: Date.UTC(2026, 6, 16, 9, 0, 0),

  /* ── the wedding, held ONCE ──────────────────────────────────
     Round 1 found the same couple carrying two irreconcilable days: the
     notebook's head read "Mara & Finn · Saturday 18 July, in 2 days" and
     the Timeline's count read 79 with its date on Saturday 3 October.
     Two seats filed it independently and both refuters confirmed it as
     the finding the suite's whole claim rests on — a person reading the
     notebook is preparing for a wedding that, according to the Timeline
     beside it, has not happened yet and will not for eleven weeks.

     3 October is the anchor, not 18 July, and that direction is forced:
     it is the date in `src/lib/review-suite-fixture.ts`, it is the date
     the ten milestones are measured from, and moving it to July would
     collapse the count from 79 to 2 and take the Timeline's entire
     composition with it. So the July claim moves, and the notebook now
     derives its subject and its head from here rather than declaring a
     second one. */
  wedding: { couple: "Mara & Finn", date: "2026-10-03", label: "Saturday 3 October" },

  venue: "The Orchard, events",
  operator: { name: "Orla", initials: "OR", role: "Orla, venue manager" },
  project: "Mara & Finn",
  couples: ["Mara & Finn", "Nora & Cian", "Aisling & Tom"],
});


/* ══ Tasks · data.js ═══════════════════════════════════════════ */
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
    { id: "done", name: "Done", tone: "done", note: "Finished and put away.", empty: "The first thing you finish lands here." },
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


/* ══ Notes · data.js ═══════════════════════════════════════════ */
/* Real content for the Notes design exploration.
 *
 * Every note body in NOTES.notes is lifted verbatim from the review-mode
 * fixture the app actually serves — src/modules/notes/server/demo/notes-demo.ts
 * — including its curled apostrophes and its en dashes, which are pinned by a
 * cross-suite contract and must not be normalised here. The cast, the venue
 * and the clock come from src/lib/review-suite-fixture.ts: The Orchard,
 * events; Mara & Finn; Orla; the pinned review clock of 16 July 2026, 09:00.
 *
 * Relative times ("35 minutes ago") are computed here from the same fixed
 * clock the product computes them from, so a lab frame and a product frame
 * can be laid beside each other and disagree about nothing.
 *
 * Two honest extensions, labelled wherever they appear:
 *   - DENSE repeats the fixture's own notes with unique ids and timestamps,
 *     exactly as the product's dense fixture does, because the shipped
 *     notebook holds fourteen notes and cannot exercise a full shelf.
 *   - LONG is the fixture's own long-content note, unedited.
 *
 * Copy strings come from src/modules/notes/lib/notes-copy.ts, generic
 * register, verbatim. No direction may rewrite them.
 */
window.NOTES = (function () {
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  /* 16 July 2026, 09:00 UTC. The product's DEMO_REFERENCE_TIME.
     It said 15 here and 16 in every other sentence it wrote — including
     its own `today`, "Thursday 16 July", which is a Thursday, and its
     own subject "Saturday 18 July, in 2 days", which is two days after
     the 16th and four after the 15th. Both other products pin 16 July.
     The comment was right and the number was wrong; the suite runs on
     one clock and this is it. The visible consequence is that notes two
     or more days old now name the weekday they were actually written
     on. */
  const NOW = WORLD.nowUTC;

  /* The product's own relative-time voice. "Yesterday" rather than "1 day
     ago", because that is what the shipped view model says. */
  function ago(ms) {
    const mins = Math.round(ms / MIN);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.round(ms / HOUR);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(ms / DAY);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  }

  /* The day a note belongs to, for the run's date rules. */
  function dayOf(ms) {
    const days = Math.floor(ms / DAY);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    const d = new Date(NOW - ms);
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  }

  /* What each note is ABOUT, as opposed to when it was written.
   *
   * This is the one honest extension to the fixture and it is labelled as
   * one wherever it appears. The subjects are not invented: every one of
   * them is named in the body of the notes it groups, and the two that are
   * dated come from the review fixture's own project and its wedding date.
   *
   * It exists because a panel seat put the direction's real failure
   * plainly: grouped only by the day they were captured, these notes could
   * be swapped for engineering standups and not one pixel of the design
   * would change. A venue's notes are ABOUT something — a Saturday, a
   * couple, the house, a course — and the product that holds them should
   * know that or admit it does not.
   */
  /* One grammar for every name, one meaning for every slot, and an order
     by what the venue is actually facing rather than by whichever date is
     nearest. A college reading due today does not outrank a wedding eleven
     weeks out, and a panel seat was right to say that sorting by proximity
     made the pile open on the wrong thing.

     stake 1  a day the venue is running. The business.
     stake 2  a commitment with a date on it that is not the business.
     stake 3  standing work that never stops and has no date.  */
  const SUBJECTS = {
    "mara-finn": { label: "Mara & Finn", when: null, days: null, stake: 1 },  /* world.foot.js derives these from WORLD.wedding. */
    "the-house": { label: "The house", when: null, days: null, stake: 3 },
    "the-studio": { label: "The studio", when: null, days: null, stake: 3 },
    "the-course": { label: "The course", when: "Thursday 16 July", days: 0, stake: 2 },
    "the-enquiries": { label: "The enquiries", when: null, days: null, stake: 3 },
  };

  /* The fixture, in the fixture's own order. `sent` means a task exists for
     this note; `reviewed` means the decision has already been made and the
     note is simply kept. Neither is missing by accident: a note with both
     absent is a note still waiting on a decision, which is the point. */
  const SEED = [
    {
      id: "n01",
      about: "mara-finn",
      body: "Saturday wedding, Mara & Finn. Ceremony 2pm in the orchard, drinks on the terrace if it stays dry. Confirm marquee sides with the hire company by Thursday.",
      ago: 35 * MIN,
      task: "Confirm marquee sides with hire company before Thursday",
      sent: true,
      edited: true,
    },
    {
      id: "n02",
      about: "mara-finn",
      body: "Mara & Finn’s menu tasting at The Orchard is booked for 1 August. Confirm the final dietary list before the venue team locks the service notes.",
      ago: 2 * HOUR,
      task: "Menu tasting with Mara & Finn",
      sent: true,
      edited: true,
    },
    {
      id: "n03",
      pick: "Ask the venue whether the ballroom can be accessed from 8am on the Saturday.",
      about: "mara-finn",
      body: "Ask the venue whether the ballroom can be accessed from 8am on the Saturday. If not we lose the whole morning setup and the florist has to come back twice.",
      ago: 3 * HOUR,
      source: "voice",
    },
    {
      id: "n04",
      about: "the-studio",
      body: "Idea for the studio newsletter: short piece on “what a calm Saturday actually looks like behind the bar”. People love the backstage angle.",
      ago: 5 * HOUR,
    },
    {
      id: "n05",
      about: "the-studio",
      body: "Saturday team, three things they kept asking for: one place to see who is on which room, a way to hand a job over without chasing it, and something that works on a phone out at the marquee.",
      ago: 6 * HOUR,
      source: "photo",
    },
    {
      id: "n06",
      about: "the-course",
      body: "Course reading for Thursday: chapters 4–5 on cash-flow forecasting. Bring the worked example, the lecturer always opens with it.",
      ago: 9 * HOUR,
      task: "Read cash-flow chapters 4–5 before Thursday class",
      edited: true,
    },
    {
      id: "n07",
      about: "the-studio",
      body: "Midweek pricing needs one simple off-season rate. Two rates and a seasonal supplement is already too many decisions for someone enquiring about a Tuesday in February.",
      ago: 1 * DAY + 1 * HOUR,
      source: "voice",
      reviewed: true,
    },
    {
      id: "n08",
      about: "the-enquiries",
      body: "Walk-in couple this morning, June 2027, ~80 guests, budget-conscious but lovely. Sent them the midweek rate. Follow up Friday if no reply.",
      ago: 1 * DAY + 3 * HOUR,
    },
    {
      id: "n09",
      about: "the-house",
      body: "Bar restock: tonic running low, order two extra cases before the weekend. Also the good olives, last delivery was short.",
      ago: 1 * DAY + 6 * HOUR,
      task: "Order 2 cases tonic + olives before weekend",
      sent: true,
      edited: true,
    },
    {
      id: "n10",
      about: "the-enquiries",
      body: "Photographer recommendation from the Hendersons: Aoife @ northlight. Natural light, doesn’t herd people. Keep her card for the recommended-suppliers list.",
      ago: 2 * DAY,
      reviewed: true,
    },
    {
      id: "n11",
      pick: "Reprint before the open day",
      about: "the-house",
      body: "Small thing but it matters: the welcome sign by the gate is faded. Reprint before the open day, first impression is the whole car-park walk.",
      ago: 2 * DAY + 4 * HOUR,
    },
    {
      id: "n12",
      about: "the-studio",
      body: "Quote from today that I want to keep: “we don’t want a big production, we just want it to feel like us.” That’s the whole pitch, really.",
      ago: 3 * DAY,
      reviewed: true,
    },
    {
      id: "n13",
      about: "the-studio",
      body: "Follow up with the motion designer about the venue film. She needs the final music choice before she can lock the edit, and the cut is due the week after next.",
      ago: 3 * DAY + 5 * HOUR,
      source: "email",
    },
    {
      id: "n14",
      pick: "Switch on before guests arrive, not when.",
      about: "the-house",
      body: "Heating: orchard room takes ~40 min to warm in October. Switch on before guests arrive, not when. Note for the winter brochure couples.",
      ago: 4 * DAY,
    },
  ];

  /* The fixture's long-content note, unedited. The torture test for the note
     object: 900 words of one person's actual sentence structure, including a
     deliberately unbreakable supplier name. */
  const LONG_BODY =
    "Post-event debrief for Mara and Finn. The orchard ceremony moved inside at 13:20 when the rain line reached the west gate, so the team reset eighty-four chairs in eighteen minutes and kept the terrace drinks plan intact. What worked: Aoife held family photographs until the room settled; the bar moved one person to the entrance before guests arrived; the florist reused the aisle foliage around the fireplace without needing another decision. What to change next time: keep a printed wet-weather sequence in the duty folder, confirm who owns the accessibility route before opening the side doors, and label the supplier crate for the extraordinarily long North Coast Botanical Installations and Seasonal Hire Company name so it does not disappear into general storage. Follow up with Mara on Thursday, send the revised room-turn checklist to the Saturday team, and keep this note as the source for the winter brochure case study.";

  /* Notes that crossed the one-way edge into Tasks. Each kept its private
     body here; the wording the person picked is the action that now lives in
     Tasks. This is the surface that shows how Notes behaves in the suite. */
  const CROSSED = [
    {
      id: "s1",
      about: "mara-finn",
      sent: true,
      body: "Mara asked about a late checkout for the bridal suite, Sunday 11am instead of 9. Said yes in principle, just needs to clear housekeeping.",
      ago: 1 * DAY + 8 * HOUR,
      source: "voice",
      task: "Clear Sunday 11am late checkout with housekeeping",
      crossedAgo: 20 * HOUR,
      lane: "In progress",
    },
    {
      id: "s2",
      about: "mara-finn",
      sent: true,
      body: "Linen supplier rang, the order now ships Tuesday, not Friday. Fine for Saturday, but tight if anything slips.",
      ago: 2 * DAY + 5 * HOUR,
      task: "Chase linen order, now shipping Tuesday",
      crossedAgo: 1 * DAY + 12 * HOUR,
      lane: "Waiting",
    },
    {
      id: "s3",
      about: "mara-finn",
      sent: true,
      body: "Registrar confirmed she can do 2pm but wants the final paperwork a fortnight out. Don’t leave it late this time.",
      ago: 4 * DAY,
      task: "Send registrar paperwork two weeks before the date",
      crossedAgo: 2 * DAY + 8 * HOUR,
      lane: "To do",
    },
  ];

  /* THE LEDE BUDGET, and the only copy of it.
     notebook.js declared LEDE_MAX = 48 — "a COMPLETE sentence, short
     enough to lead, with something left after it to lead into" — and
     applied it only to notes captured at run time. Every seeded note
     was shaped here by a bare sentence split with no budget at all, so
     thirteen of the fourteen shipped notes carried a lede over budget:
     lengths ran to 189 characters, and opening one rendered the whole
     thirty-eight-word note in semibold — four full lines of a person's
     own writing re-weighted by the machine, in the resting room, on the
     default data. That is the exact failure the 48 was bought to fix.
     The rule lives here now and notebook.js reads it, so the fixture is
     fixed through the rule rather than the rule bent around it. */
  const LEDE_MAX = 48;
  function ledeOf(body) {
    const stop = body.search(/(?<=[.?!”])\s/);
    if (stop <= 0 || stop + 1 > LEDE_MAX) return null;
    const head = body.slice(0, stop + 1).trim();
    return body.slice(head.length).trim() ? head : null;
  }

  function build(seed) {
    const about = SUBJECTS[seed.about] || SUBJECTS["the-house"];
    const lede = ledeOf(seed.body);
    const title = lede || seed.body;
    const rest = lede ? seed.body.slice(lede.length).trim() : "";
    return {
      id: seed.id,
      body: seed.body,
      title,
      rest,
      /* False means: this note has no lede and is set whole at 400.
         Thirteen of fourteen take that path, which is the honest
         one and the one the renderers already had. */
      lede: Boolean(lede),
      source: seed.source || "typed",
      when: ago(seed.ago),
      day: dayOf(seed.ago),
      ms: seed.ago,
      task: seed.task || null,
      sent: Boolean(seed.sent),
      reviewed: Boolean(seed.reviewed),
      edited: Boolean(seed.edited),
      /* The decision is outstanding when nothing has been decided and it has
         not already crossed. Everything else in the notebook is settled. */
      pending: !seed.sent && !seed.reviewed,
      crossedWhen: seed.crossedAgo ? ago(seed.crossedAgo) : null,
      lane: seed.lane || null,
      words: seed.body.trim().split(/\s+/).length,
      /* The words a person highlighted in their own note. The contract
         underneath the real product sends exactly this and nothing else,
         so the lab carries it as a field rather than inventing one at
         render time. */
      pick: seed.pick || null,
      about,
      aboutKey: seed.about || "the-house",
    };
  }

  const notes = SEED.map(build);
  const crossed = CROSSED.map(build);
  const long = build({ id: "long", about: "mara-finn", body: LONG_BODY, ago: 18 * MIN, task: "Write the wet-weather room-turn checklist and share it with the Saturday team" });

  /* Peak season. The shipped fixture holds fourteen notes and cannot
     exercise a full shelf, so the product's own dense fixture repeats them
     with unique ids and timestamps. Same rule here. Labelled as an
     extension wherever it appears. */
  const dense = Array.from({ length: 36 }, (_, i) => {
    const source = SEED[i % SEED.length];
    return build({
      ...source,
      id: `d${String(i + 1).padStart(2, "0")}`,
      ago: (i + 1) * 23 * MIN,
      sent: i % 7 === 0 ? true : source.sent,
    });
  });

  const pending = notes.filter((n) => n.pending);

  return {
    now: NOW,
    today: "Thursday 16 July",
    operator: { name: "Orla", initials: "OR", role: "Orla, venue manager" },
    workspace: "The Orchard, events",
    project: "Mara & Finn",

    notes,
    long,
    dense,
    crossed,
    pending,

    subjects: SUBJECTS,
    /* The venue's own next date, from the review fixture's project. The
       head states it because a notebook that does not know what is coming
       is a notebook that could belong to anyone. */
    next: { key: "mara-finn", label: "Mara & Finn", when: null, days: null },  /* derived; see world.foot.js */

    counts: {
      notebook: notes.length,
      review: pending.length,
      sent: crossed.length,
      dense: dense.length,
    },

    /* Verbatim from notes-copy.ts, generic register. Not rewritten by any
       direction; a direction may only decide where a string lives. */
    copy: {
      placeholder: "Write the thought before it disappears…",
      privacy: "Private to you",
      save: "Save it",
      photo: "Read a photo",
      filingLabel: "Filing under",
      otherWaysLabel: "Other ways in",
      privacyLong: "Yours until you send something on",
      emptyTitle: "Your notebook starts with one private thought.",
      emptyBody: "The capture field is ready above.",
      voiceStart: "Dictate",
      voiceStop: "Stop listening",
      voiceDisclosure:
        "Your browser may send microphone audio to its speech service to turn it into text. Signal Studio does not receive or retain that audio. Your browser or speech provider controls its service retention. Typing stays on your device until you save.",
      heading: "Turn this into a task",
      begin: "Use these words",
      handoffBoundary:
        "Your note stays here. Tasks only ever receives the exact words you pick and check below.",
      sourceLabel: "The words you picked",
      destinationLabel: "Which project",
      wordingLabel: "The task wording",
      /* Shown in the pick band at rest, so the mechanism is visible
         before the black button is pressed rather than only after a
         refused press. Short, because it sits under a note. */
      /* Speech comes back in more than one note. The product does not
       implement a pause rule, so it must not claim one: this states
       only what is observable — that it came back separated, and that
       they can be put back together. */
      join: "Put these back together",
      joinLabel: "Put this note and the next one back together as one",
      pickLabel: "To make a task",
      pickHint: "Tap a sentence, drag across the words, or walk them with the arrow keys.",
      payload:
        "Tasks receives these words and nothing else from this note. The rest of what you wrote stays private here.",
      cancel: "Never mind",
      send: "Send to Tasks",
      confirmed: "Tasks has it",
      open: "Open in Tasks",
      stayedPut: "Your note is still here, still private, still yours to edit.",
      sentReceipt: "Sent to Tasks. Your note stayed here.",
      offline: "You are offline. Nothing has left Notes. Reconnect and try again.",
      nothingSelected: "Highlight the words you want in the note first.",
      sourceChanged:
        "This note changed while you were sending. Both versions are kept. Read it again and pick your words.",
    },

    /* The four ways a note got here. The label is the accessible name for
       the mark, so state never rests on a glyph alone. */
    sources: {
      typed: { icon: "typed", label: "Written" },
      voice: { icon: "mic", label: "Spoken" },
      photo: { icon: "photo", label: "From a photo" },
      email: { icon: "email", label: "By email" },
    },

    /* The transcript the review build's rehearsal produces, and the two
       notes it separates into. Real strings from the product's speech
       rehearsal, so the read-back state is not invented. */
    speech: {
      transcript:
        "Ask the venue whether the ballroom can be accessed from eight in the morning. If not we lose the whole setup window and the florist has to come back twice.",
      separated: [
        "Ask the venue whether the ballroom can be accessed from eight in the morning.",
        "If not we lose the whole setup window and the florist has to come back twice.",
      ],
    },

    projects: ["The Orchard, events", "Mara & Finn", "Studio"],

    /* The lede budget, so notebook.js reads the same rule that shaped
       these notes rather than keeping a second copy of it. */
    ledeOf,
    LEDE_MAX,
  };
})();


/* ══ Timeline · fixture.js ═════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   The fixture. Every string, date and name below is lifted from the
   repo, not invented:
     src/lib/review-suite-fixture.ts          the ten milestones, the
                                              pinned review clock, the
                                              workspace and its projects
     src/modules/timeline/lib/vocabulary.ts   the five state labels
     src/lib/suite-contracts.v1.json          the public origins
   Nothing here is placeholder text. If a number appears on a surface it
   is derived from this object through one accessor, because a header
   that disagrees with the list below it spends the credibility of the
   whole product.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var TODAY = "2026-07-16";          // REVIEW_SUITE_FIXTURE.reviewToday
  var UPDATED = "2026-07-15T18:30:00.000Z";

  /* Dates are handled in UTC throughout. A wedding date that shifts by a
     day because the reader is in Auckland is not a rounding error to the
     person reading it. */
  function utc(iso) {
    var p = iso.slice(0, 10).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function days(fromIso, toIso) {
    return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
  }
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday"];

  function parts(iso) {
    var d = new Date(utc(iso));
    return {
      day: d.getUTCDate(),
      month: MONTHS[d.getUTCMonth()],
      monthShort: MONTHS[d.getUTCMonth()].slice(0, 3),
      year: d.getUTCFullYear(),
      weekday: DAYS[d.getUTCDay()],
      weekdayShort: DAYS[d.getUTCDay()].slice(0, 3),
    };
  }

  /* One grammar per fact. The artifact says "Saturday 3 October" for a
     day and "3 Oct" for a column; it never mixes elapsed, deictic and
     absolute forms for the same fact on the same screen. */
  /* A non-breaking space binds the day figure to its month, so the
     ceremonial date can break after the weekday but never between the 3
     and the October. Binding the WHOLE string overflows its column on a
     phone and on the printed sheet, which is why only this one joint is
     welded. parseDay normalises it back. */
  var NB = " ";
  var fmt = {
    long: function (iso) { var p = parts(iso); return p.weekday + " " + p.day + NB + p.month; },
    longYear: function (iso) { var p = parts(iso); return p.weekday + " " + p.day + NB + p.month + NB + p.year; },
    medium: function (iso) { var p = parts(iso); return p.day + NB + p.month; },
    short: function (iso) { var p = parts(iso); return p.day + NB + p.monthShort; },
    numeral: function (iso) { return String(parts(iso).day); },
    monthShort: function (iso) { return parts(iso).monthShort; },
    /* "1 days" is the kind of thing that makes a person stop trusting a
       screen. The plural lives here, once. */
    dayCount: function (n) { return n + (Math.abs(n) === 1 ? " day" : " days"); },
    weekdayShort: function (iso) { return parts(iso).weekdayShort; },
    year: function (iso) { return String(parts(iso).year); },
  };

  var STATE_LABEL = {           // MILESTONE_STATE_LABELS, verbatim
    covered: "Complete",
    now: "Happening now",
    next: "Coming up",
    later: "Later",
    cancelled: "Not going ahead",
  };

  var MILESTONES = [
    { id: "demo-audience-item-yes", title: "We said yes", date: "2026-01-02", state: "covered" },
    { id: "demo-audience-item-venue", title: "The Orchard reserved", date: "2026-04-18", state: "covered" },
    { id: "demo-audience-item-menu", title: "Menu tasting at The Orchard", date: "2026-08-01", state: "now" },
    { id: "demo-audience-item-invitations", title: "Send the invitations", date: "2026-08-08", state: "next" },
    { id: "demo-audience-item-fitting", title: "Final dress fitting", date: "2026-08-22", state: "next" },
    { id: "demo-audience-item-music", title: "Choose the evening music", date: "2026-08-29", state: "next" },
    { id: "demo-audience-item-guests", title: "Final guest numbers", date: "2026-09-05", state: "later" },
    { id: "demo-audience-item-walkthrough", title: "Venue walk-through", date: "2026-09-19", state: "later" },
    { id: "demo-audience-item-wedding", title: "Wedding day", date: "2026-10-03", state: "later" },
    { id: "demo-audience-item-hotel", title: "City hotel shortlist", date: null, state: "cancelled" },
  ];

  var PROJECT = {
    slug: "mara-finn",
    name: "Mara & Finn",
    oneLiner: "What is settled, what comes next, and what the couple can share.",
    /* The day is a milestone the project POINTS AT, by id. Three comments
       in render-b.js claimed identity was resolved this way and no id
       existed anywhere, so the day was whichever moment matched its date
       first - and any second moment on the wedding day took it. */
    primaryDate: { label: "Wedding day", date: "2026-10-03", id: "demo-audience-item-wedding" },
  };

  var SIBLINGS = [
    { slug: "nora-cian", name: "Nora & Cian", date: "2027-04-17", note: "Venue decisions into suppliers" },
    { slug: "aisling-tom", name: "Aisling & Tom", date: null, note: "At the start of its planning" },
  ];

  /* Opaque 43-character share token, the shape the DTO validator enforces
     (TOKEN_RE in audience-timeline.ts). Deterministic, not random: a lab
     that renders a different link on every reload cannot be graded. */
  var TOKEN = "j7Qm2vK4xR9bT1nL6yH3cW8pZ5sD0aG7fJ4uE2rN9tM";

  /* Everything derived lives here, so no surface can do its own
     arithmetic and disagree with another. */
  var dated = MILESTONES.filter(function (m) { return m.date; });
  /* Derived ON CALL, not once at load. As a snapshot, a moment the
     owner added never reached the guest surfaces and a moment they
     deleted came back, because every state remounts from here. */
  function live() { return MILESTONES.filter(function (m) { return m.state !== "cancelled"; }); }
  var api = {
    today: TODAY,
    updatedAt: UPDATED,
    updatedLabel: fmt.medium("2026-07-15") + " 2026",
    project: PROJECT,
    siblings: SIBLINGS,
    workspace: { name: "The Orchard, events", owner: "Orla" },
    milestones: MILESTONES,
    stateLabel: STATE_LABEL,
    token: TOKEN,
    shareUrl: "timeline.signalstudio.ie/s/" + TOKEN,
    shareUrlFull: "https://timeline.signalstudio.ie/s/" + TOKEN,
    fmt: fmt,
    parts: parts,
    days: days,
    daysTo: function (iso) { return days(TODAY, iso); },
    /* The one parser. An owner told "it has moved to Thursday 10
       September" should be able to type that, and the surface built to
       remove arithmetic should not make them count days to say it. */
    parseDay: function (text) {
      if (!text) return null;
      var clean = String(text).replace(/ /g, " ").trim().toLowerCase()
        .replace(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday),?\s+/, "")
        .replace(/(\d)(st|nd|rd|th)/g, "$1");
      var iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) return clean;
      var slash = clean.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
      if (slash) {
        return slash[3] + "-" + ("0" + slash[2]).slice(-2) + "-" + ("0" + slash[1]).slice(-2);
      }
      var words = clean.match(/^(\d{1,2})\s+([a-z]+)\s*(\d{4})?$/);
      if (!words) return null;
      var month = -1;
      for (var i = 0; i < MONTHS.length; i++) {
        if (MONTHS[i].toLowerCase().indexOf(words[2]) === 0 && words[2].length >= 3) month = i;
      }
      if (month < 0) return null;
      var day = Number(words[1]);
      if (day < 1 || day > 31) return null;
      var year = words[3] ? Number(words[3]) : Number(TODAY.slice(0, 4));
      var out = year + "-" + ("0" + (month + 1)).slice(-2) + "-" + ("0" + day).slice(-2);
      /* No year given means the next one that has not gone yet. */
      if (!words[3] && days(TODAY, out) < 0) {
        out = (year + 1) + "-" + ("0" + (month + 1)).slice(-2) + "-" + ("0" + day).slice(-2);
      }
      return out;
    },
    /* One place that does date arithmetic. Anything that needs "the date
       N days from here" asks for it rather than reaching for Date, so a
       moved milestone and its own label can never disagree. */
    plusDays: function (iso, n) {
      return new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
    },
    toDay: function () { return days(TODAY, PROJECT.primaryDate.date); },
    /* The countdown, said once for the whole product. It answers with a
       STATE, not a string, because the three cases are three different
       compositions: a number and its unit while the day is ahead, the
       word the morning is built on when it arrives, and a sentence with
       no numeral once it has gone. A guest must never see a negative. */
    countdown: function (n) {
      if (n > 0) return { state: "ahead", num: String(n), unit: n === 1 ? "day" : "days" };
      if (n === 0) return { state: "today", word: "Today" };
      return { state: "passed", said: "The day has been and gone." };
    },
    /* Mirrors the shipped publication DTO. Nothing invented: a share
       token exists in this projection, so the plan is published, and
       the date it was published is the one the record already carries. */
    publication: { state: "published", publishedAt: UPDATED },
    counts: function () {
      var on = live();
      return {
        total: on.length,                                        // 9
        done: on.filter(function (m) { return m.state === "covered"; }).length,     // 2
        ahead: on.filter(function (m) { return m.state !== "covered"; }).length,    // 7
        cancelled: MILESTONES.length - on.length,                // 1
      };
    },
    live: live,
    dated: function () { return dated.slice(); },
    nextUp: function () {
      return MILESTONES.filter(function (m) { return m.state === "now"; })[0];
    },
    span: function () {
      return { from: dated[0].date, to: dated[dated.length - 1].date };
    },
  };

  window.__TLFIXTURE = api;
})();


/* ═══════════════════════════════════════════════════════════════════
   THE JOIN, AND THE PROOF.

   Three fixtures have just declared the same world three times. This
   stitches the two seams that actually cross a product boundary, and then
   checks every fact they are supposed to share. A disagreement throws:
   three products contradicting each other about what day it is would
   break the illusion in the first ten seconds, and the second-worst place
   to find that out is a screenshot.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var B = window.BOARD;
  var N = window.NOTES;
  var T = window.__TLFIXTURE;
  var WORLD = window.WORLD;

  function agree(what, a, b) {
    if (a !== b) throw new Error("ONE WORLD: " + what + " — " + JSON.stringify(a) + " vs " + JSON.stringify(b));
  }

  /* ── one clock ─────────────────────────────────────────────── */
  agree("Tasks' today", B.today, WORLD.today);
  agree("Timeline's today", T.today, WORLD.today);
  agree("Notes' today", N.today, WORLD.todayLabel);
  agree("Notes' clock", N.now, WORLD.nowUTC);
  /* The label has to be the day it says it is. */
  agree(
    "the day of the week",
    N.today,
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      new Date(WORLD.nowUTC).getUTCDay()
    ] + " " + new Date(WORLD.nowUTC).getUTCDate() + " July",
  );

  /* ── one cast, one venue ───────────────────────────────────── */
  agree("Tasks' workspace", B.workspace, WORLD.venue);
  agree("Notes' workspace", N.workspace, WORLD.venue);
  agree("Timeline's workspace", T.workspace.name, WORLD.venue);
  agree("Tasks' operator", B.operator.role, WORLD.operator.role);
  agree("Notes' operator", N.operator.role, WORLD.operator.role);
  agree("Timeline's owner", T.workspace.owner, WORLD.operator.name);
  agree("Timeline's project", T.project.name, WORLD.project);
  agree("Notes' project", N.project, WORLD.project);

  /* ── one wedding, one day ──────────────────────────────────────
     The notebook declared its own date for the same couple. It derives it
     now, and the assertion below is what stops a third one appearing. */
  (function () {
    var w = WORLD.wedding;
    var days = Math.round((Date.parse(w.date + "T00:00:00Z") - Date.parse(WORLD.today + "T00:00:00Z")) / 86400000);
    var subject = N.subjects["mara-finn"];
    subject.label = w.couple;
    subject.when = w.label;
    subject.days = days;
    N.next = { key: "mara-finn", label: w.couple, when: w.label, days: days };
    /* Every note filed under the couple carries the derived date too. */
    N.notes.concat(N.crossed, N.dense, [N.long]).forEach(function (note) {
      if (note && note.aboutKey === "mara-finn" && note.about) {
        note.about = subject;
      }
    });
    agree("the wedding, in Timeline", T.project.primaryDate.date, w.date);
    agree("the couple whose wedding it is", T.project.name, w.couple);
    agree("the notebook's day for them", N.subjects["mara-finn"].when, w.label);
    agree("the notebook's head", N.next.when, w.label);
    if (N.next.days !== days) throw new Error("ONE WORLD: the notebook counts a different number of days to the wedding");
  })();

  /* ── the ledger counts what the index badges ────────────────────
     The pile headed "what has crossed into Tasks" counted its own fixture
     array — three — while the index beside it badged six notes "In
     Tasks". Two numbers for one fact, on one screen. The count is what
     the notebook actually shows. */
  N.counts.sent = N.notes.filter(function (n) { return n.sent; }).length + N.crossed.length;

  /* ── one set of milestones ─────────────────────────────────────
     Tasks names one milestone on the board and one in Planning; Timeline
     draws ten. Where a milestone appears in both it must be the same
     milestone on the same date. */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(iso) {
    var d = new Date(iso + "T00:00:00Z");
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  }
  B.planning.milestones.forEach(function (m) {
    var twin = T.milestones.find(function (t) { return t.title === m.title; });
    if (!twin) throw new Error("ONE WORLD: Tasks names the milestone " + JSON.stringify(m.title) + " and Timeline does not");
    agree("the date of " + m.title, m.date, shortDate(twin.date));
  });
  /* And the card on the board that carries it. */
  (function () {
    var card = B.tasks.find(function (t) { return t.milestone; });
    if (!card) return;
    var twin = T.milestones.find(function (t) { return t.title === card.title; });
    if (!twin) throw new Error("ONE WORLD: the board's milestone card is not a Timeline milestone");
    agree("the board's milestone chip", card.milestone, "Milestone due " + shortDate(twin.date));
  })();

  /* ── the seam's own join ───────────────────────────────────────
     Six notes in the notebook have already crossed into Tasks, and Tasks
     carries exactly six tasks marked as having come from a note. They are
     the same six. Nothing here invents a link: every pair below is a
     title the two fixtures already share, or the note whose wording the
     task was edited from — both fixtures derive from the same
     review-suite source, which is why the count comes out even. */
  var LINK = {
    n01: "demo-t-01",              /* Confirm marquee sides …             */
    n02: "demo-t-02",              /* Menu tasting at The Orchard         */
    n09: "demo-t-06",              /* Order tonic and the good olives     */
    s1: "demo_task_checkout",      /* Clear Sunday 11am late checkout …   */
    s2: "demo_task_linen",         /* Chase linen order …                 */
    s3: "demo_task_registrar",     /* Send registrar paperwork …          */
  };

  var fromNote = B.tasks.filter(function (t) { return t.fromNote; }).map(function (t) { return t.id; });
  Object.keys(LINK).forEach(function (noteId) {
    if (fromNote.indexOf(LINK[noteId]) === -1) {
      throw new Error("ONE WORLD: " + noteId + " points at " + LINK[noteId] + ", which is not a task that came from a note");
    }
  });
  if (fromNote.length !== Object.keys(LINK).length) {
    throw new Error(
      "ONE WORLD: " + fromNote.length + " tasks say they came from a note and " +
      Object.keys(LINK).length + " notes say they went to one",
    );
  }

  /* What "In Tasks as …" opens. */
  N.taskOf = function (noteId) { return LINK[noteId] || null; };

  /* ── the ledger tells the truth about the board ────────────────
     Notes' ledger column carries a Tasks LANE, and the two fixtures
     disagreed about all three of them: the ledger said In progress,
     Waiting and To do while the board had every one of those cards in
     Done. Side by side in one suite that is not a nuance, it is the
     product contradicting itself. The lane is a Tasks fact — Notes' own
     comment at sendPeel says so — so the board is the authority and the
     ledger is derived from it. Recorded in COMPOSITION.md; a live binding
     rather than a derivation at load is on BUILD-LIST.md. */
  N.crossed.forEach(function (row) {
    var task = B.tasks.find(function (t) { return t.id === LINK[row.id]; });
    if (!task) return;
    var column = B.columns.find(function (c) { return c.id === task.lane; });
    row.lane = column ? column.name : row.lane;
  });
})();

