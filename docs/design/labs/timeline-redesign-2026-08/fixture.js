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
    primaryDate: { label: "Wedding day", date: "2026-10-03" },
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
