/* ═══════════════════════════════════════════════════════════════════
   PROJECTS — the workspace's source of truth.

   Until now the suite had one world and it was hard-wired: The Orchard's
   tasks were `window.BOARD`, its plan was `window.__TLFIXTURE`, and a
   reader with a second project had no way to say so. A suite whose whole
   argument is "one world of data underneath three products" has to be
   able to change which world.

   THE RULE THIS FILE EXISTS TO KEEP: the selected project is the source
   of truth for the ENTIRE workspace, not for the cards. Change it and
   Tasks, Timeline and Planning all change together, because they are
   reading the same object — not because three separate things were told
   to update and one of them was forgotten.

   HOW, and the constraint that decides it: `tasks.js` captured
   `const B = window.BOARD` at load, and `timeline.js` captured
   `F = window.__TLFIXTURE` the same way. Reassigning `window.BOARD` would
   leave both products holding the old object forever. So this file
   MUTATES those objects in place. Every reference, wherever it was
   captured, sees the change — which is also why the swap has to be
   exhaustive: a key the new project does not set is a key that keeps the
   PREVIOUS project's value, and that is precisely how one project's
   content leaks into another.

   Timeline's derived fields — counts, live, dated, nextUp, span,
   countdown — are FUNCTIONS on the fixture, so they recompute from
   whatever `milestones` currently holds. That is load-bearing and worth
   not breaking: if any of them were a value computed once at load, this
   whole approach would strand a stale count on screen.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var B = window.BOARD;
  var F = window.__TLFIXTURE;

  /* The keys a project owns. Anything on this list is swapped wholesale on
     every switch; anything off it is workspace furniture that belongs to
     the application rather than to a project — the column set, the view
     names, the clock. Keeping the list explicit is what makes "no leak"
     checkable rather than hopeful. */
  var BOARD_KEYS = ["workspace", "season", "period", "tasks", "planning", "progress"];
  var TL_KEYS = ["project", "milestones", "workspace", "siblings"];

  function snapshot(obj, keys) {
    var out = {};
    keys.forEach(function (k) { out[k] = obj[k]; });
    return JSON.parse(JSON.stringify(out));
  }

  /* ── the venue ────────────────────────────────────────────────
     Taken from the fixtures as they already stand rather than retyped, so
     the project that has been reviewed for three rounds is byte-identical
     to the one the panel saw. */
  var ORCHARD = {
    id: "orchard",
    name: "The Orchard, events",
    kind: "Wedding season",
    initials: "OR",
    board: snapshot(B, BOARD_KEYS),
    timeline: snapshot(F, TL_KEYS),
  };

  /* ── a university marketing student ───────────────────────────
     Second semester of the 2026 academic year, measured from the same
     pinned clock as everything else: Thursday 16 July 2026. The work is
     what a marketing undergraduate actually has in front of her — a
     strategy assignment, a consumer-behaviour study with real ethics
     paperwork, a group campaign nobody is leading, and an analytics exam
     she is behind on. */
  var ACADEMIC = {
    id: "academic",
    name: "Academic Year 2026",
    kind: "BSc Marketing · Year 3",
    initials: "OR",
    board: {
      workspace: "Academic Year 2026",
      season: "Semester 2",
      period: "6 Jul – 18 Dec",
      progress: { done: 4, total: 14, overdue: 2, day: 11, of: 166, left: 155, undated: 4 },
      tasks: [
        { id: "ac-01", lane: "todo", title: "Submit marketing strategy assignment",
          note: "3,000 words on the Aldi Ireland repositioning. Brief says one market, one decision, one recommendation — not a company profile.",
          tag: "MK3021 Strategy", priority: "High", due: "Due in 6 days", dueAt: "2026-07-22", dueTone: "soon", comments: 1 },
        { id: "ac-02", lane: "todo", title: "Finish the literature review",
          note: "Twelve sources, eight read. The two Kotler chapters are library-only so they have to be done on campus.",
          tag: "Dissertation", priority: "High", due: "Due in 11 days", dueAt: "2026-07-27", dueTone: "soon" },
        { id: "ac-03", lane: "todo", title: "Book a room for the group rehearsal",
          note: "Four of us, an hour, the week of the pitch. Library group rooms open for booking 14 days ahead.",
          tag: "MK3044 Campaigns", contact: "Library bookings" },
        { id: "ac-04", lane: "todo", title: "Read the two chapters for Thursday's seminar",
          note: "Consumer decision journeys. She said she would cold-call on these.",
          tag: "MK3018 Consumer", quiet: "Nothing has moved on it for nine days" },
        { id: "ac-05", lane: "doing", title: "Analyse the survey responses",
          note: "184 responses, target was 150. Cross-tab age against channel preference before writing anything.",
          tag: "Dissertation", priority: "High", due: "Due today", dueAt: "2026-07-16", dueTone: "today", comments: 3, fromNote: true },
        { id: "ac-06", lane: "doing", title: "Complete the consumer behaviour research",
          note: "Ethics form approved 2 July. Twelve interviews recorded, six transcribed.",
          tag: "MK3018 Consumer", due: "Overdue by 3 days", dueAt: "2026-07-13", dueTone: "overdue", milestone: "Milestone due 27 Jul" },
        { id: "ac-07", lane: "doing", title: "Prepare the presentation for the group project",
          note: "Ten minutes, four speakers. I have the strategy slide and the recommendation; nobody has taken the research section.",
          tag: "MK3044 Campaigns", contact: "Niamh, Dara, Sean" },
        { id: "ac-08", lane: "review", title: "Submit the campaign proposal",
          note: "Draft is with Dr Whelan for comment. She turns things around in about four days.",
          tag: "MK3044 Campaigns", due: "Overdue by 1 day", dueAt: "2026-07-15", dueTone: "overdue", comments: 2 },
        { id: "ac-09", lane: "review", title: "Second read of the strategy assignment",
          note: "Read it once cold before submitting. Last time the recommendation contradicted the segmentation.",
          tag: "MK3021 Strategy" },
        { id: "ac-10", lane: "waiting", title: "Waiting on ethics sign-off for the follow-up interviews",
          note: "Submitted 9 July. Committee sits fortnightly, so the next date is the 23rd.",
          tag: "Dissertation", contact: "Research Ethics Committee" },
        { id: "ac-11", lane: "waiting", title: "Waiting on Niamh's section of the deck",
          note: "She has the research slides. Pitch is the 5th and we have not rehearsed once.",
          tag: "MK3044 Campaigns", contact: "Niamh" },
        { id: "ac-12", lane: "done", title: "Study plan for marketing analytics",
          note: "Six weeks, three topics a week. Regression is the one I keep avoiding.",
          tag: "MK3030 Analytics", completedAt: "2026-07-14" },
        { id: "ac-13", lane: "done", title: "Register for semester 2 modules",
          note: "All four confirmed. Analytics was nearly full.",
          tag: "Admin", completedAt: "2026-07-08" },
        { id: "ac-14", lane: "done", title: "Return the interlibrary loan",
          note: "Two days late. €1.40.",
          tag: "Admin", quiet: "Nothing has moved on it for five days", completedAt: "2026-07-11" },
      ],
      planning: {
        title: "Planning",
        project: "Academic Year 2026",
        line: "Semester 2 · 6 Jul – 18 Dec",
        summary: "Day 11 of 166 · 155 days left",
        help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
        unscheduled: [
          "Book a room for the group rehearsal",
          "Read the two chapters for Thursday's seminar",
          "Second read of the strategy assignment",
          "Waiting on Niamh's section of the deck",
        ],
        milestones: [
          { title: "Campaign pitch", date: "5 Aug" },
          { title: "Dissertation draft to supervisor", date: "2 Sep" },
        ],
      },
    },
    timeline: {
      project: {
        slug: "academic-2026",
        name: "Academic Year 2026",
        oneLiner: "What is submitted, what is next, and how much of the semester is left.",
        primaryDate: { label: "Analytics exam", date: "2026-12-10", id: "ac-tl-exam" },
      },
      workspace: { name: "Academic Year 2026", owner: "Orla" },
      siblings: [
        { slug: "dissertation", name: "Dissertation", date: "2026-11-20", note: "Research done, writing to start" },
        { slug: "placement", name: "Placement search", date: null, note: "Nothing sent yet" },
      ],
      milestones: [
        { id: "ac-tl-start", title: "Semester 2 begins", date: "2026-07-06", state: "covered" },
        { id: "ac-tl-ethics", title: "Ethics approval for the dissertation study", date: "2026-07-02", state: "covered" },
        { id: "ac-tl-proposal", title: "Campaign proposal due", date: "2026-07-15", state: "open" },
        { id: "ac-tl-strategy", title: "Marketing strategy assignment due", date: "2026-07-22", state: "open" },
        { id: "ac-tl-litreview", title: "Literature review due", date: "2026-07-27", state: "open" },
        { id: "ac-tl-pitch", title: "Group campaign pitch", date: "2026-08-05", state: "open" },
        { id: "ac-tl-draft", title: "Dissertation draft to supervisor", date: "2026-09-02", state: "open" },
        { id: "ac-tl-reading", title: "Reading week", date: "2026-10-19", state: "open" },
        { id: "ac-tl-submit", title: "Dissertation submission", date: "2026-11-20", state: "open" },
        { id: "ac-tl-exam", title: "Marketing analytics exam", date: "2026-12-10", state: "open" },
        { id: "ac-tl-break", title: "Semester break begins", date: "2026-12-18", state: "open" },
      ],
    },
  };

  /* ── a secondary-school teacher ───────────────────────────────
     Same clock, a school year rather than a semester, and the work of
     somebody who teaches business studies and is preparing September
     while finishing the summer's marking. */
  var SCHOOL = {
    id: "school",
    name: "Secondary School Year 2026",
    kind: "Business Studies · Years 4–6",
    initials: "OR",
    board: {
      workspace: "Secondary School Year 2026",
      season: "School year",
      period: "1 Sep – 26 Jun",
      progress: { done: 3, total: 13, overdue: 1, day: 11, of: 299, left: 288, undated: 4 },
      tasks: [
        { id: "sc-01", lane: "todo", title: "Prepare September lesson plans",
          note: "Six weeks for 5th year, four for 6th. The 6th years come back into an exam year so week one has to count.",
          tag: "5th & 6th year", priority: "High", due: "Due in 9 days", dueAt: "2026-07-25", dueTone: "soon", milestone: "Milestone due 25 Jul" },
        { id: "sc-02", lane: "todo", title: "Create the marketing module resources",
          note: "New spec, so last year's slides are out. Needs one real Irish case study they have actually heard of.",
          tag: "5th year", priority: "High", due: "Due in 16 days", dueAt: "2026-08-01", dueTone: "soon", comments: 2 },
        { id: "sc-03", lane: "todo", title: "Upload curriculum resources to the shared drive",
          note: "The department agreed everything goes in one folder this year. Mine is still on the desktop.",
          tag: "Department", contact: "Business Studies dept" },
        { id: "sc-04", lane: "todo", title: "Prepare the classroom presentation for induction",
          note: "Twenty minutes to the incoming 5th years on what the subject actually is. Half of them pick it blind.",
          tag: "Induction", quiet: "Nothing has moved on it for twelve days" },
        { id: "sc-05", lane: "doing", title: "Grade the project submissions",
          note: "29 of 31 in. Two extensions granted, both due Friday.",
          tag: "6th year", priority: "High", due: "Due today", dueAt: "2026-07-16", dueTone: "today", comments: 4, fromNote: true },
        { id: "sc-06", lane: "doing", title: "Review student assignments from the summer term",
          note: "Feedback sheets for the 5th year enterprise task. They get these back in September, not before.",
          tag: "5th year", due: "Overdue by 2 days", dueAt: "2026-07-14", dueTone: "overdue" },
        { id: "sc-07", lane: "doing", title: "Prepare the end-of-term assessment",
          note: "Christmas exam paper for 5th year. Two sections, one case study, ninety minutes.",
          tag: "5th year", contact: "Exams office" },
        { id: "sc-08", lane: "review", title: "Second read of the marketing scheme of work",
          note: "With the subject coordinator for sign-off before it goes to the department.",
          tag: "Department", contact: "Máire, coordinator", comments: 1 },
        { id: "sc-09", lane: "waiting", title: "Waiting on the room allocation for September",
          note: "Asked for the room with the projector that works. Timetabling say the first week of August.",
          tag: "Admin", contact: "Timetabling" },
        { id: "sc-10", lane: "waiting", title: "Waiting on the textbook order",
          note: "Thirty-two copies of the new edition. Ordered 30 June, nothing since.",
          tag: "Department", contact: "Edco" },
        { id: "sc-11", lane: "waiting", title: "Schedule the parent meetings",
          note: "Cannot fix dates until the timetable lands. Usually the third week of September.",
          tag: "Admin", quiet: "Nothing has moved on it for eighteen days" },
        { id: "sc-12", lane: "done", title: "Submit predicted grades",
          note: "All 31 in on time.",
          tag: "6th year", completedAt: "2026-07-10" },
        { id: "sc-13", lane: "done", title: "Return the borrowed laptop trolley",
          note: "Back in the science block where it lives.",
          tag: "Admin", quiet: "Nothing has moved on it for six days", completedAt: "2026-07-13" },
      ],
      planning: {
        title: "Planning",
        project: "Secondary School Year 2026",
        line: "School year · 1 Sep – 26 Jun",
        summary: "Day 11 of 299 · 288 days left",
        help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
        unscheduled: [
          "Upload curriculum resources to the shared drive",
          "Prepare the classroom presentation for induction",
          "Prepare the end-of-term assessment",
          "Schedule the parent meetings",
        ],
        milestones: [
          { title: "Term begins", date: "1 Sep" },
          { title: "Christmas assessments", date: "8 Dec" },
        ],
      },
    },
    timeline: {
      project: {
        slug: "school-2026",
        name: "Secondary School Year 2026",
        oneLiner: "What is prepared, what is being taught, and what the year is walking towards.",
        primaryDate: { label: "Leaving Certificate begins", date: "2027-06-09", id: "sc-tl-lc" },
      },
      workspace: { name: "Secondary School Year 2026", owner: "Orla" },
      siblings: [
        { slug: "transition-year", name: "Transition Year enterprise", date: "2027-03-05", note: "Runs alongside the main year" },
        { slug: "cpd", name: "CPD and training", date: null, note: "Nothing booked yet" },
      ],
      milestones: [
        { id: "sc-tl-grades", title: "Predicted grades submitted", date: "2026-07-10", state: "covered" },
        { id: "sc-tl-plans", title: "September lesson plans ready", date: "2026-07-25", state: "open" },
        { id: "sc-tl-resources", title: "Marketing module resources built", date: "2026-08-01", state: "open" },
        { id: "sc-tl-induction", title: "Induction for incoming 5th years", date: "2026-08-27", state: "open" },
        { id: "sc-tl-term", title: "Term begins", date: "2026-09-01", state: "open" },
        { id: "sc-tl-parents", title: "Parent–teacher meetings", date: "2026-09-21", state: "open" },
        { id: "sc-tl-midterm", title: "October mid-term", date: "2026-10-26", state: "open" },
        { id: "sc-tl-assess", title: "Christmas assessments", date: "2026-12-08", state: "open" },
        { id: "sc-tl-mocks", title: "6th year mock examinations", date: "2027-02-08", state: "open" },
        { id: "sc-tl-projects", title: "Coursework projects submitted", date: "2027-04-23", state: "open" },
        { id: "sc-tl-lc", title: "Leaving Certificate begins", date: "2027-06-09", state: "open" },
      ],
    },
  };

  var PROJECTS = [ORCHARD, ACADEMIC, SCHOOL];
  var byId = {};
  PROJECTS.forEach(function (p) { byId[p.id] = p; });

  var currentId = ORCHARD.id;

  /* Replace, never merge. A merge leaves whatever the previous project set
     and the next one did not — which is the exact shape of a content leak,
     and the thing the founder's brief calls out by name. */
  function replace(target, source, keys) {
    keys.forEach(function (k) {
      var next = JSON.parse(JSON.stringify(source[k]));
      /* IN PLACE for arrays, and this is the whole difference between a
         switch that works and one that half-works.

         `__TLFIXTURE.milestones` is a REFERENCE to an array the fixture's
         own closure holds as `MILESTONES`, and `live()`, `counts()` and
         `nextUp()` all read that closure variable rather than the property.
         Rebinding the property therefore swapped what an outsider could
         see and left every derived reader looking at the previous project —
         the Timeline's name changed and its moments did not, which is the
         precise failure the brief names. Emptying the array and refilling
         it keeps the identity, so the closure comes with us. */
      if (Array.isArray(target[k]) && Array.isArray(next)) {
        target[k].length = 0;
        Array.prototype.push.apply(target[k], next);
      } else {
        target[k] = next;
      }
    });
  }

  /* Two derived readers are snapshots taken once at load — `dated` is a
     filtered copy made at parse time, and `span()` reads it — so neither
     can see an in-place refill. They are rebound here to derive from the
     live array on every call, which is what the rest of the fixture already
     does and what the fixture's own comment says it does: "Derived ON CALL,
     not once at load." Two functions were the exception. */
  F.dated = function () {
    return F.milestones.filter(function (m) { return m.date; });
  };
  F.span = function () {
    var d = F.dated();
    if (!d.length) return { from: null, to: null };
    return { from: d[0].date, to: d[d.length - 1].date };
  };

  function applyProject(id) {
    var p = byId[id];
    if (!p) return false;
    currentId = id;
    replace(B, p.board, BOARD_KEYS);
    replace(F, p.timeline, TL_KEYS);
    window.WORLD.project = id;
    return true;
  }

  /* ── every project at once ────────────────────────────────────
     Not a fourth project — a VIEW of the three. It is assembled on demand
     from whatever the projects currently hold, so a task added to the
     Academic year appears here without anything being told to sync, and a
     rename lands here too. Assembling it once at load and caching it would
     be the same class of staleness this file was written to remove.

     Each row keeps its own project's name in its tag, because a board that
     merges three projects and does not say which is which is a longer list
     rather than a wider view. */
  var ALL_ID = "all";
  function allProjects() {
    var tasks = [], unscheduled = [], milestones = [], tlMilestones = [];
    var done = 0, total = 0, overdue = 0, undated = 0;
    PROJECTS.forEach(function (p) {
      var b = p.board;
      b.tasks.forEach(function (t) {
        var copy = JSON.parse(JSON.stringify(t));
        copy.tag = p.name;
        tasks.push(copy);
      });
      total += b.progress.total; done += b.progress.done;
      overdue += b.progress.overdue; undated += b.progress.undated;
      (b.planning.unscheduled || []).forEach(function (u) { unscheduled.push(u); });
      (b.planning.milestones || []).forEach(function (m) { milestones.push(m); });
      p.timeline.milestones.forEach(function (m) {
        tlMilestones.push(JSON.parse(JSON.stringify(m)));
      });
    });
    /* One measure, so the moments have to be in date order or the Timeline
       is drawing three plans on top of each other. */
    tlMilestones.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return {
      board: {
        workspace: "All projects",
        season: PROJECTS.length + " projects",
        period: "6 Jul \u2013 26 Jun",
        progress: { done: done, total: total, overdue: overdue, day: 11, of: 356, left: 345, undated: undated },
        tasks: tasks,
        planning: {
          title: "Planning",
          project: "All projects",
          line: PROJECTS.length + " projects \u00b7 6 Jul \u2013 26 Jun",
          summary: total + " tasks \u00b7 " + undated + " with no day",
          help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
          unscheduled: unscheduled,
          milestones: milestones,
        },
      },
      timeline: {
        project: {
          slug: "all",
          name: "All projects",
          oneLiner: "Everything you are running, on one measure.",
          primaryDate: PROJECTS[0].timeline.project.primaryDate,
        },
        workspace: { name: "All projects", owner: "Orla" },
        siblings: PROJECTS.map(function (p) {
          return { slug: p.id, name: p.name, date: null, note: p.kind };
        }),
        milestones: tlMilestones,
      },
    };
  }

  function applyAll() {
    var v = allProjects();
    currentId = ALL_ID;
    replace(B, v.board, BOARD_KEYS);
    replace(F, v.timeline, TL_KEYS);
    window.WORLD.project = ALL_ID;
    return true;
  }

  /* ── naming ───────────────────────────────────────────────────
     A project's name is written in four places that must never disagree:
     the switcher, the board's head, Planning's own title, and the
     Timeline's workspace. They are all set from here. */
  function renameProject(id, name) {
    var next = String(name || "").trim();
    var p = byId[id];
    if (!p || !next || next === p.name) return false;
    p.name = next;
    p.board.workspace = next;
    p.board.planning.project = next;
    /* Guarded: renaming an undated project must not resurrect a span it
       never had, or print "· null". */
    p.board.planning.line = p.board.period ? p.kind + " \u00b7 " + p.board.period : p.kind;
    p.timeline.workspace.name = next;
    p.timeline.project.name = next;
    /* If it is the one on screen, the surfaces have to hear about it now. */
    if (currentId === id) applyProject(id);
    else if (currentId === ALL_ID) applyAll();
    return true;
  }

  var made = 0;
  function createProject(name) {
    var next = String(name || "").trim();
    if (!next) return null;
    made += 1;
    var id = "p" + (PROJECTS.length + made);
    /* A new project is EMPTY, and says so. Seeding it with sample tasks
       would be the product putting words in somebody's mouth on the first
       screen they ever see of their own work. */
    var p = {
      id: id,
      name: next,
      kind: "New project",
      initials: ORCHARD.initials,
      board: {
        workspace: next,
        season: "New project",
        /* NULL, not The Orchard's wedding season. These were hard-copied
           from the venue, so a project created on a Thursday opened
           reading "day 1 of 97" with a Planning axis measuring 6 Jul to
           10 Oct — a season nobody had typed, on somebody else's dates.
           `null` survives the JSON round-trip in replace(); an absent key
           does not, and `period` is in BOARD_KEYS. */
        period: null,
        progress: { done: 0, total: 0, overdue: 0, day: null, of: null, left: null, undated: 0 },
        tasks: [],
        planning: {
          title: "Planning",
          project: next,
          line: "New project",
          summary: "Nothing planned yet",
          help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
          unscheduled: [],
          milestones: [],
        },
      },
      timeline: {
        project: { slug: id, name: next, oneLiner: "Nothing on the measure yet.", primaryDate: null },
        workspace: { name: next, owner: ORCHARD.timeline.workspace.owner },
        siblings: [],
        milestones: [],
      },
    };
    PROJECTS.push(p);
    byId[id] = p;
    return id;
  }

  window.PROJECTS = {
    /* Built on read, not frozen at load — a rename or a new project has to
       reach the switcher without anything being told to refresh. */
    get list() {
      return PROJECTS.map(function (p) {
        return { id: p.id, name: p.name, kind: p.kind, count: p.board.tasks.length };
      });
    },
    current: function () { return currentId; },
    apply: function (id) { return id === ALL_ID ? applyAll() : applyProject(id); },
    rename: renameProject,
    create: createProject,
    ALL: ALL_ID,
    /* For a gate that wants to prove nothing leaked: the exact set of keys
       a switch is responsible for. */
    keys: { board: BOARD_KEYS, timeline: TL_KEYS },
  };
  window.WORLD.project = currentId;
})();
