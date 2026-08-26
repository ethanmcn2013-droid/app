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
