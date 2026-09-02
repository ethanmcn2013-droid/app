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

  /* ── a private dinner series ──────────────────────────────────
     Orla's second project, measured from the same pinned clock as
     everything else: Thursday 16 July 2026. Six private dinners in the
     barn from October to December — a menu to agree with the chef, a
     wine list, a long table to hire, a fire officer to satisfy, and a
     waiting list that already outgrew the room. The two other projects
     used to be a marketing degree and a school year, and the switcher
     leaked a different life the moment it opened; one world, one cast,
     one venue is the brief's own rule. */
  var DINNERS = {
    id: "dinners",
    name: "Winter dinner series",
    kind: "Six private dinners · Oct – Dec",
    initials: "OR",
    board: {
      workspace: "Winter dinner series",
      season: "Dinner series",
      period: "6 Jul – 18 Dec",
      progress: { done: 4, total: 14, overdue: 2, day: 11, of: 166, left: 155, undated: 4 },
      tasks: [
        { id: "ac-01", lane: "todo", title: "Agree the six-course menu with the chef",
          note: "Six dinners, one menu each. The chef wants the autumn one signed off first — game, then the two fish nights.",
          tag: "Menu", priority: "High", due: "Due in 6 days", dueAt: "2026-07-22", dueTone: "soon", comments: 1 },
        { id: "ac-02", lane: "todo", title: "Finish the wine list with Nóra",
          note: "Twelve wines, eight tasted. The two Burgundies are allocation-only so the order has to go in by the end of the month.",
          tag: "Wine", priority: "High", due: "Due in 11 days", dueAt: "2026-07-27", dueTone: "soon" },
        { id: "ac-03", lane: "todo", title: "Book the long table from the hire company",
          note: "Forty covers, one table down the barn. The hire company opens bookings 14 days ahead.",
          tag: "Barn", contact: "Hire company" },
        { id: "ac-04", lane: "todo", title: "Read the two supplier contracts before Thursday",
          note: "Candles and linen. Both want a deposit before they hold the dates.",
          tag: "Suppliers", quiet: "Nothing has moved on it for nine days" },
        { id: "ac-05", lane: "doing", title: "Go through the waiting-list replies",
          note: "184 replies, target was 150. Sort them by dinner before offering anyone a second date.",
          tag: "Guests", priority: "High", due: "Due today", dueAt: "2026-07-16", dueTone: "today", comments: 3, fromNote: true },
        { id: "ac-06", lane: "doing", title: "Confirm the ticket price with the accountant",
          note: "Costings approved 2 July. Twelve lines checked, six still to price.",
          tag: "Money", due: "Overdue by 3 days", dueAt: "2026-07-13", dueTone: "overdue", milestone: "Milestone due 27 Jul" },
        { id: "ac-07", lane: "doing", title: "Write the running order for the first dinner",
          note: "Ten minutes between courses, four speakers at the top. I have the welcome and the toast; nobody has taken the chef's introduction.",
          tag: "First dinner", contact: "Nóra, Dara, Sean" },
        { id: "ac-08", lane: "review", title: "Send the invitation proof to the printer",
          note: "The draft is with the printer for comment. They turn things around in about four days.",
          tag: "Invitations", due: "Overdue by 1 day", dueAt: "2026-07-15", dueTone: "overdue", comments: 2 },
        { id: "ac-09", lane: "review", title: "Second read of the guest letter",
          note: "Read it once cold before it goes. Last time the date on the letter contradicted the ticket.",
          tag: "Invitations" },
        { id: "ac-10", lane: "waiting", title: "Waiting on the fire officer's sign-off for candles in the barn",
          note: "Submitted 9 July. The officer visits fortnightly, so the next date is the 23rd.",
          tag: "Barn", contact: "Fire officer" },
        { id: "ac-11", lane: "waiting", title: "Waiting on Nóra's wine notes for the cards",
          note: "She has the tasting notes. The first dinner is the 2nd and we have not printed once.",
          tag: "Wine", contact: "Nóra" },
        { id: "ac-12", lane: "done", title: "Plan the six dinner dates",
          note: "Six Fridays, two a month. The December one is the one that keeps moving.",
          tag: "Dates", completedAt: "2026-07-14" },
        { id: "ac-13", lane: "done", title: "List the series with the tourist board",
          note: "All six listed. December was nearly full by the Tuesday.",
          tag: "Admin", completedAt: "2026-07-08" },
        { id: "ac-14", lane: "done", title: "Return the sample glassware",
          note: "Two days late. The rep did not mind.",
          tag: "Admin", quiet: "Nothing has moved on it for five days", completedAt: "2026-07-11" },
      ],
      planning: {
        title: "Planning",
        project: "Winter dinner series",
        line: "Dinner series · 6 Jul – 18 Dec",
        summary: "Day 11 of 166 · 155 days left",
        help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
        unscheduled: [
          "Book the long table from the hire company",
          "Read the two supplier contracts before Thursday",
          "Second read of the guest letter",
          "Waiting on Nóra's wine notes for the cards",
        ],
        milestones: [
          { title: "Wine order closes", date: "5 Aug" },
          { title: "Menu sign-off with the chef", date: "2 Sep" },
        ],
      },
    },
    timeline: {
      project: {
        slug: "dinners-2026",
        name: "Winter dinner series",
        oneLiner: "What is booked, what is next, and how long until the first plate goes out.",
        primaryDate: { label: "The first dinner", date: "2026-10-02", id: "dn-tl-first" },
      },
      workspace: { name: "Winter dinner series", owner: "Orla" },
      siblings: [
        { slug: "christmas-dinner", name: "The Christmas dinner", date: "2026-12-12", note: "Menu done, wine to choose" },
        { slug: "spring-series", name: "A spring series", date: null, note: "Nothing booked yet" },
      ],
      milestones: [
        { id: "dn-tl-costs", title: "Costings approved", date: "2026-07-02", state: "covered" },
        { id: "dn-tl-start", title: "Series planning begins", date: "2026-07-06", state: "covered" },
        { id: "dn-tl-proof", title: "Invitation proof to the printer", date: "2026-07-15", state: "open" },
        { id: "dn-tl-menu", title: "Menu agreed with the chef", date: "2026-07-22", state: "open" },
        { id: "dn-tl-wine", title: "Wine list finished", date: "2026-07-27", state: "open" },
        { id: "dn-tl-order", title: "Wine order closes", date: "2026-08-05", state: "open" },
        { id: "dn-tl-signoff", title: "Menu sign-off with the chef", date: "2026-09-02", state: "open" },
        { id: "dn-tl-first", title: "The first dinner", date: "2026-10-02", state: "open" },
        { id: "dn-tl-third", title: "The third dinner", date: "2026-10-30", state: "open" },
        { id: "dn-tl-fifth", title: "The fifth dinner", date: "2026-11-27", state: "open" },
        { id: "dn-tl-last", title: "The Christmas dinner", date: "2026-12-12", state: "open" },
      ],
    },
  };

  /* ── the spring trade fair ────────────────────────────────────
     Same clock, a longer run: a wedding fair at The Orchard in March,
     sixty stands across the barn and a marquee, and the work of the
     person selling the stands, drawing the floor plan and briefing the
     stewards while the season is still on. */
  var FAIR = {
    id: "fair",
    name: "Spring trade fair",
    kind: "Wedding fair at The Orchard · March",
    initials: "OR",
    board: {
      workspace: "Spring trade fair",
      season: "Fair season",
      period: "6 Jul – 30 Apr",
      progress: { done: 3, total: 13, overdue: 1, day: 11, of: 299, left: 288, undated: 4 },
      tasks: [
        { id: "sc-01", lane: "todo", title: "Draw the floor plan for the barn and the marquee",
          note: "Sixty stands, two rooms. The florists come back into the barn this year so the entrance has to count.",
          tag: "Floor plan", priority: "High", due: "Due in 9 days", dueAt: "2026-07-25", dueTone: "soon", milestone: "Milestone due 25 Jul" },
        { id: "sc-02", lane: "todo", title: "Write the exhibitor pack",
          note: "New prices, so last year's pack is out. Needs one real photograph of the barn with the stands in.",
          tag: "Exhibitors", priority: "High", due: "Due in 16 days", dueAt: "2026-08-01", dueTone: "soon", comments: 2 },
        { id: "sc-03", lane: "todo", title: "Upload the exhibitor list to the shared drive",
          note: "The team agreed everything goes in one folder this year. Mine is still on the desktop.",
          tag: "Team", contact: "Events team" },
        { id: "sc-04", lane: "todo", title: "Prepare the welcome talk for the exhibitors' evening",
          note: "Twenty minutes to the new exhibitors on what the fair actually is. Half of them book it blind.",
          tag: "Exhibitors", quiet: "Nothing has moved on it for twelve days" },
        { id: "sc-05", lane: "doing", title: "Go through the stand applications",
          note: "29 of 31 in. Two extensions granted, both due Friday.",
          tag: "Exhibitors", priority: "High", due: "Due today", dueAt: "2026-07-16", dueTone: "today", comments: 4, fromNote: true },
        { id: "sc-06", lane: "doing", title: "Review last year's exhibitor feedback",
          note: "Feedback sheets from the March fair. The new pack goes out in September, not before.",
          tag: "Exhibitors", due: "Overdue by 2 days", dueAt: "2026-07-14", dueTone: "overdue" },
        { id: "sc-07", lane: "doing", title: "Prepare the parking plan for the day",
          note: "The top field for exhibitors, the lane for guests. Two stewards, ninety minutes each way.",
          tag: "Day plan", contact: "Stewards" },
        { id: "sc-08", lane: "review", title: "Second read of the marketing plan",
          note: "With Máire for sign-off before it goes to the printer.",
          tag: "Marketing", contact: "Máire, marketing", comments: 1 },
        { id: "sc-09", lane: "waiting", title: "Waiting on the marquee quote for March",
          note: "Asked for the marquee with the clear roof. They say the first week of August.",
          tag: "Marquee", contact: "Hire company" },
        { id: "sc-10", lane: "waiting", title: "Waiting on the signage order",
          note: "Thirty-two boards for the lane. Ordered 30 June, nothing since.",
          tag: "Signage", contact: "Printer" },
        { id: "sc-11", lane: "waiting", title: "Book the caterers for the day",
          note: "Cannot fix numbers until the stands are sold. Usually the third week of September.",
          tag: "Catering", quiet: "Nothing has moved on it for eighteen days" },
        { id: "sc-12", lane: "done", title: "Confirm the date with the county council",
          note: "Road closure agreed for the Saturday.",
          tag: "Admin", completedAt: "2026-07-10" },
        { id: "sc-13", lane: "done", title: "Return the borrowed stand frames",
          note: "Back in the hire yard where they live.",
          tag: "Admin", quiet: "Nothing has moved on it for six days", completedAt: "2026-07-13" },
      ],
      planning: {
        title: "Planning",
        project: "Spring trade fair",
        line: "Fair season · 6 Jul – 30 Apr",
        summary: "Day 11 of 299 · 288 days left",
        help: "Give each task a day, or drag it onto the Schedule or Calendar view.",
        unscheduled: [
          "Upload the exhibitor list to the shared drive",
          "Prepare the welcome talk for the exhibitors' evening",
          "Prepare the parking plan for the day",
          "Book the caterers for the day",
        ],
        milestones: [
          { title: "Stand sales open", date: "1 Sep" },
          { title: "Stand sales close", date: "8 Dec" },
        ],
      },
    },
    timeline: {
      project: {
        slug: "fair-2027",
        name: "Spring trade fair",
        oneLiner: "What is sold, what is built, and how long until the gates open.",
        primaryDate: { label: "The fair opens", date: "2027-03-06", id: "sf-tl-open" },
      },
      workspace: { name: "Spring trade fair", owner: "Orla" },
      siblings: [
        { slug: "autumn-fair", name: "An autumn fair", date: "2027-10-02", note: "Runs alongside the season" },
        { slug: "open-day", name: "The open day", date: null, note: "Nothing booked yet" },
      ],
      milestones: [
        { id: "sf-tl-date", title: "Date confirmed with the council", date: "2026-07-10", state: "covered" },
        { id: "sf-tl-plan", title: "Floor plan drawn", date: "2026-07-25", state: "open" },
        { id: "sf-tl-pack", title: "Exhibitor pack written", date: "2026-08-01", state: "open" },
        { id: "sf-tl-evening", title: "The exhibitors' evening", date: "2026-08-27", state: "open" },
        { id: "sf-tl-sales", title: "Stand sales open", date: "2026-09-01", state: "open" },
        { id: "sf-tl-caterers", title: "Caterers booked", date: "2026-09-21", state: "open" },
        { id: "sf-tl-signage", title: "Signage goes up the lane", date: "2026-10-26", state: "open" },
        { id: "sf-tl-close", title: "Stand sales close", date: "2026-12-08", state: "open" },
        { id: "sf-tl-build", title: "Marquee build begins", date: "2027-02-08", state: "open" },
        { id: "sf-tl-brief", title: "Steward briefing", date: "2027-02-23", state: "open" },
        { id: "sf-tl-open", title: "The fair opens", date: "2027-03-06", state: "open" },
      ],
    },
  };

  var PROJECTS = [ORCHARD, DINNERS, FAIR];
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
