/* Timeline · B · The Approach — render-core.js then render-b.js, as they were
   frozen in the lab. Two patches: rootEl(), and the undo chord. */

/* ═══════════════════════════════════════════════════════════════════
   The renderer core. Three directions share one contract:

     window.__TLD[variant] = {
       medium(state)  -> "phone" | "card" | "sheet" | "full"
       caption(state) -> the lab's own label for what you are looking at
       render(state)  -> a DOM node
     }

   The page keeps its state on ONE element — <body> when the master is
   opened directly, #deck when it has been compiled into the console —
   because the compiled CSS attaches every [data-*] decision to .deck.
   Reading and writing through rootEl() is what lets the same file be
   both the master and the console's live deck.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var F = window.__TLFIXTURE;
  window.__TLD = window.__TLD || {};

  function rootEl() { return window.__SUITE.root("timeline"); }

  /* A very small DOM builder. Strings are text, never markup: every
     visible string in this lab is content, and content is never parsed. */
  function h(tag, attrs, kids) {
    var parts = String(tag).split(/([.#])/);
    var el = document.createElement(parts[0] || "div");
    for (var i = 1; i < parts.length; i += 2) {
      if (parts[i] === ".") el.classList.add(parts[i + 1]);
      else el.id = parts[i + 1];
    }
    if (attrs) {
      for (var key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        var value = attrs[key];
        if (value === null || value === undefined || value === false) continue;
        if (key === "text") { el.textContent = String(value); continue; }
        if (key === "on") {
          for (var evt in value) el.addEventListener(evt, value[evt]);
          continue;
        }
        if (key === "style") { el.setAttribute("style", value); continue; }
        el.setAttribute(key, value === true ? "" : String(value));
      }
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return el;
  }

  /* Uppercase micro-labels are a typographic treatment, not a shout: the
     string stays sentence case in the DOM so a screen reader says
     "Coming up", not "C O M I N G  U P", and CSS does the capitals. */
  function micro(text, cls) { return h("span." + (cls || "micro"), { text: text }); }

  var STATES = [
    ["owner-flight", "Owner · in flight"],
    ["owner-empty", "Owner · new"],
    ["owner-editing", "Owner · editing"],
    ["owner-undone", "Owner · one move back"],
    ["owner-draft", "Owner · not yet handed over"],
    ["publish", "Publish"],
    ["phone", "Received · phone"],
    ["desk", "Received · desk"],
    ["day", "The day"],
    ["print", "Print"],
    ["unfurl", "Unfurl"],
    ["ended", "Ended"],
    ["loading", "Loading"],
    ["loading-slow", "Loading · slow"],
  ];

  var CAPTIONS = {
    "owner-flight": ["Owner", "Mara &amp; Finn in full flight"],
    "owner-empty": ["Owner", "a project with nothing in it yet"],
    "owner-editing": ["Owner", "changing one line"],
    "owner-undone": ["Owner", "the way back, showing"],
    "owner-draft": ["Owner", "a plan nobody holds yet"],
    publish: ["Publish", "the moment it becomes theirs"],
    phone: ["Received", "390px, the screen that decides"],
    desk: ["Received", "desk width"],
    day: ["The day", "Saturday 3 October, morning"],
    print: ["Print", "A4, the keepsake"],
    unfurl: ["Unfurl", "the link before it is opened"],
    ended: ["Ended", "revoked or expired"],
    loading: ["Loading", "what the frame promises"],
    "loading-slow": ["Loading", "when it stops arriving"],
  };

  function caption(state, variantName) {
    var pair = CAPTIONS[state] || [state, ""];
    return h("p.tl-caption", {}, [
      h("b", { text: pair[0] }),
      h("span", { text: pair[1].replace("&amp;", "&") }),
      h("span", { text: variantName }),
    ]);
  }

  /* One direction is locked, so the variant is no longer a choice of
     direction — the console writes the ROOM name into data-v and the
     rooms are combinations of the named decisions below. Whichever
     direction file is loaded is the direction. */
  function theDirection() {
    var keys = Object.keys(window.__TLD);
    return window.__TLD[keys[0]];
  }
  function currentState() {
    var s = rootEl().getAttribute("data-state");
    return CAPTIONS[s] ? s : STATES[0][0];
  }

  /* A state may force a decision the reader cannot argue with — print is
     always paper, because a home printer cannot make an ink page. The
     chooser's own value is stashed and given back the moment the state
     stops forcing it, so leaving print does not silently change what the
     operator had picked. */
  var stashedGround = null;

  function mount() {
    var host = document.getElementById("tl");
    if (!host) return;
    var state = currentState();
    var direction = theDirection();
    var root = rootEl();
    var forced = direction.forces ? direction.forces(state) : null;
    if (forced && forced.ground) {
      if (root.getAttribute("data-ground") !== forced.ground) {
        stashedGround = root.getAttribute("data-ground");
      }
      root.setAttribute("data-ground", forced.ground);
    } else if (stashedGround) {
      root.setAttribute("data-ground", stashedGround);
      stashedGround = null;
    }
    root.setAttribute("data-medium", direction.medium(state));
    root.setAttribute("data-state", state);

    host.textContent = "";
    var page = h("div.tl-page", {}, [
      h("div.tl-stage", {}, [
        /* The caption is gone. shell.css names it itself — "the caption
           that names what medium you are looking at. It is lab furniture,
           not product" — and it was printing
           OWNER · MARA & FINN IN FULL FLIGHT · B · THE APPROACH across the
           top of a production application. Same rule as the console
           chrome: apparatus for reviewing the product is not the product.
           Removed rather than hidden, because there is no production
           version of it to restyle into. */
        direction.render(state),
      ]),
    ]);
    host.appendChild(page);
    /* Trims and measured fades run after layout, and again once the
       webfonts have swapped — a trim that runs once at first paint
       produces complete-looking sentences with the middle missing. */
    requestAnimationFrame(settle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  }

  /* A trim decided at 320px is wrong at 1440px, so the settle has to run
     again when the box changes. Debounced to a frame so a drag-resize
     does not re-measure a hundred times. */
  var pending = 0;
  window.addEventListener("resize", function () {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () { pending = 0; settle(); });
  });

  /* Post-layout work every direction gets for free. Word-safe clamping:
     the full string always stays in title and aria-label, and the visible
     string is rebuilt from the full string every time, so running this
     twice can never eat a second bite out of the same sentence. */
  function settle() {
    var nodes = document.querySelectorAll("[data-clamp]");
    for (var i = 0; i < nodes.length; i++) clamp(nodes[i]);
    var fades = document.querySelectorAll("[data-fade]");
    for (var j = 0; j < fades.length; j++) {
      var el = fades[j];
      var hidden = el.scrollHeight - el.clientHeight > 2 || el.scrollWidth - el.clientWidth > 2;
      el.setAttribute("data-fade", hidden ? "on" : "off");
    }
    /* Trimming can change a block's height, and in a direction where
       position means time the rows below it have to be re-placed from
       the real geometry rather than left on a stale measurement. */
    var v = window.__TLD[currentVariantKey()];
    if (v && v.settle) v.settle();
  }

  function currentVariantKey() { return Object.keys(window.__TLD)[0]; }

  /* Overflow in either axis. The original test compared scrollWidth with
     clientWidth only, and the thing actually doing the clipping was a
     two-line -webkit-box, which never overflows horizontally — so this
     function returned at its first test and had never trimmed a single
     word in its life while its own comment promised it had. */
  function over(el) {
    if (el.scrollWidth > el.clientWidth + 1) return true;
    var cs = getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight);
    var max = parseInt(cs.webkitLineClamp, 10);
    /* No usable leading: fall back to the box comparison. */
    if (!(lh > 0)) return el.scrollHeight > el.clientHeight + 1;
    /* A clamp is a LINE budget, so the test is lines, not pixels. The
       box comparison trimmed a legitimately two-line title because a
       two-line -webkit-box is taller than its own content box - at a
       24px root that took seven of seven owner titles down to one word
       each. */
    if (max > 0) return el.scrollHeight > (max + 0.5) * lh;
    /* No clamp and visible overflow means nothing is hidden, so there
       is nothing to trim for. The guest surfaces switch the clamp off
       by name (b.css) and were being trimmed regardless. */
    return false;
  }

  /* A trimmed string keeps its whole self in the accessibility tree. An
     aria-label on a paragraph is dropped — naming is not allowed on the
     generic role — so the visible remnant leaves the tree and an
     unclipped copy takes its place beside it. */
  function unhide(el) {
    el.removeAttribute("aria-hidden");
    el.removeAttribute("data-trimmed");
    /* Including the tooltip, or a string that fitted after a resize kept
       promising a longer form it no longer has. */
    el.removeAttribute("title");
    var twin = el.nextElementSibling;
    if (twin && twin.getAttribute("data-clamp-full") === "true") twin.remove();
  }

  function clamp(el) {
    var full = el.getAttribute("data-full") || el.textContent;
    el.setAttribute("data-full", full);
    el.textContent = full;
    unhide(el);
    if (!over(el)) return;
    /* The tooltip belongs to the trim, so it is stamped AFTER the test.
       Stamped before it, every title in the product carried a hover
       tooltip byte-identical to the words already on screen - noise on
       every row, and a promise of more that was not there. */
    el.setAttribute("title", full);
    var words = full.split(" ");
    while (words.length > 1 && over(el)) {
      words.pop();
      el.textContent = words.join(" ") + "…";
    }
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-trimmed", "true");
    var twin = h("span.tl-vh", { "data-clamp-full": "true", text: full });
    el.parentNode.insertBefore(twin, el.nextSibling);
  }

  window.__TLCORE = { h: h, micro: micro, F: F, rootEl: rootEl, settle: settle, mount: mount };

  window.__elevate = {
    states: STATES,
    setState: function (state) { rootEl().setAttribute("data-state", state); },
    mount: mount,

    /* Three finished rooms. Each is a combination of the three named
       decisions below, never a copy: start from one, then change anything
       underneath and every combination you land on is buildable. */
    /* Two rooms, one design. Paper is what ships; ink is the same four
       decisions read in the dark. They are not alternatives to choose
       between - every fix has to land in both, and the gate grades both. */
    presets: {
      paper: { ground: "paper", past: "folded", accent: "structure" },
      ink: { ground: "ink", past: "folded", accent: "structure" },
    },
    presetCopy: {
      paper: { name: "On paper", note: "The room as it ships: ink on white, and today drawn down the rail." },
      ink: { name: "After dark", note: "The same four decisions with the ground flipped. Not a theme - the same room at night." },
    },
    controls: [
      {
        key: "ground", label: "The ground",
        help: "Ink is the direction as drawn. Paper is the same composition inverted through the ink ladder, and it is the reversal for the light-lock. Print is always paper either way.",
        options: [["ink", "Ink"], ["paper", "Paper"]],
      },
      {
        key: "past", label: "The past",
        help: "A guest opening this in August does not need January. The question is whether the plan still says January happened.",
        options: [["folded", "Folded to a line"], ["listed", "Listed in full"]],
      },
      {
        key: "accent", label: "The indigo",
        help: "One accent, spent like a laser. Either it marks only the next thing, or it also draws the part of the rail that is still ahead.",
        options: [["once", "Only the next thing"], ["structure", "Next thing and the rail"]],
      },
    ],
  };
})();


/* ═══════════════════════════════════════════════════════════════════
   DIRECTION B · THE APPROACH — the renderer.

   The one number that decides this composition is the scale. Every
   vertical position below is `daysFromToday × pixelsPerDay`, computed
   from the real dates, so the measure cannot flatter the plan: a
   fortnight is twice a week, on the screen, always.

   Round 1 rebuilt the gesture: setAway() is the only writer of an
   item's distance and every fact is derived from the one date it
   produces. Round 2 finished the controls around it. The panel's
   verdict was that the gesture felt like Linear and everything beside
   it was a promise — a create verb that created nothing, a title field
   that discarded what you typed, a delete with no way back that then
   left the undo bar offering to reverse a row that no longer existed,
   and a reversibility surface rendered a thousand pixels below the
   button that filled it.

   So there is now one history stack, every entry carries its own undo
   closure, and nothing changes the plan without joining it.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var C = window.__TLCORE, F = C.F, h = C.h;

  /* Pixels per day. The tightest real gap on this plan is seven days.
     A guest row is 70px on a phone and 81px at desk width; an owner row
     carries a third line — the control that says what a guest sees — so
     it is 74px and 100px. Fourteen and eighteen leave air at the
     tightest pair in each case. The scale is a page-size decision; the
     proportion between one gap and the next is identical at every
     scale. */
  var SCALE = { phone: 12, sheet: 14, full: 14, card: 12, print: 8 };
  var OWNER_SCALE = { narrow: 14, wide: 18 };
  var ROW = 92;

  function ownerScale() {
    return window.innerWidth >= 701 ? OWNER_SCALE.wide : OWNER_SCALE.narrow;
  }

  function daysFrom(clock, iso) { return F.days(clock, iso); }

  /* One name for a moment, used by the row, the accessible name, every
     receipt and the editor. A moment with no title yet had a name on
     screen and an empty one everywhere else, so the reversibility bar
     offered to undo a change to nothing. */
  function nameOf(record) {
    return ((record && record.title) || "").trim() || "Untitled moment";
  }

  /* The reversibility bar sits in a band of its own, and the band has a
     measured height. A title long enough to take the sentence to four
     lines used to grow the plate straight back over the first field's
     name - and clipping the plate instead would have hidden the Undo
     control itself, which is the one thing on that bar that must never
     be hard to find. So the NAME gives way, not the act: the full title
     is in the field two rows below, and the sentence still says what
     happened and offers the way back. */
  function briefly(record) {
    var name = nameOf(record);
    if (name.length <= 44) return name;
    /* To the last WHOLE word. A raw character slice cut six of six
       ordinary wedding titles mid-word - "Champagne and canapes on the
       west terrace b..." - which is the first entry under Typography in
       the paid-for defect library. The floor of 20 stops a single very
       long first word from collapsing the sentence to an ellipsis. */
    var cut = name.slice(0, 43);
    var space = cut.lastIndexOf(" ");
    if (space >= 20) cut = cut.slice(0, space);
    /* An ESCAPED \s. Written unescaped this class matched the letter s,
       so a name ending in one lost it before the ellipsis. The dash is
       here so a cut inside "make-up" leaves no hanging hyphen. */
    return cut.replace(/[\s,;:–—-]+$/, "") + "…";
  }

  /* A guest list is the owner list minus what the owner hid, and it is
     filtered HERE, once, rather than in each surface. Hiding a moment
     used to write an attribute on a row and nothing else, so the field
     titled "What guests see" was the one control in the panel with no
     effect on what a guest saw. */
  function ahead(clock, owner) {
    return F.live()
      .filter(function (m) {
        return m.date && daysFrom(clock, m.date) > 0 && (owner || !m.hidden);
      })
      .sort(function (a, b) { return daysFrom(clock, a.date) - daysFrom(clock, b.date); });
  }
  /* Strictly behind. Anything dated exactly on the clock is happening,
     not happened, and on the wedding morning the difference is the whole
     screen. */
  function behind(clock, owner) {
    return F.milestones.filter(function (m) {
      return (!m.date || daysFrom(clock, m.date) < 0) && (owner || !m.hidden);
    });
  }
  function recordFor(id) {
    return F.milestones.filter(function (m) { return m.id === id; })[0];
  }

  /* ── the horizon ──────────────────────────────────────────────── */

  /* The empty run before the first thing is stated as a boundary, not a
     count. "The next 16 days" swallows the day the menu tasting falls
     on. A boundary cannot go off by one. */
  function gapSentence(nearestIso) {
    return "Nothing is planned until " + F.fmt.medium(nearestIso) + ".";
  }

  /* The count, in whichever of its three states the clock is in. The
     arrival is the same object the morning is built on, at the same
     display step, so the two screens cannot disagree about what an
     arrived countdown looks like. */
  function countBlock(n, medium) {
    var said = F.countdown(n);
    if (said.state === "today") return h("p.b-dayCount", { text: said.word });
    if (said.state === "passed") return h("p.b-passed", { text: said.said });
    return h("div.b-count", {}, [
      h("span.b-num.num", { text: said.num }),
      /* Paper cannot be reloaded, so it dates itself. On a screen the
         unit is the unit; on a sheet it is the unit and the day the
         figure was true. */
      h("span.b-unit", {
        text: medium === "print"
          ? said.unit + " away on " + F.fmt.longYear(F.today)
          : said.unit,
      }),
    ]);
  }

  /* The count in place, for when the day itself moves. countBlock builds
     one of three shapes, so only the figure-and-unit shape is repainted
     here; the other two mean the day has arrived or gone, and neither is
     reachable from the owner's editor, whose ceiling IS the day. */
  function paintHorizonCount(field) {
    if (!field) return;
    var said = F.countdown(daysFrom(F.today, F.project.primaryDate.date));
    var num = field.querySelector(".b-count .b-num");
    var unit = field.querySelector(".b-count .b-unit");
    if (num) num.textContent = said.num;
    if (unit) unit.textContent = said.unit;
  }

  function horizon(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var next = ahead(clock, o.owner)[0];
    return h("header.b-horizon", {}, [
      h("h1.b-who", { text: F.project.name }),
      countBlock(daysFrom(clock, F.project.primaryDate.date), o.medium),
      h("p.b-when", { "data-type": "date", text: F.fmt.longYear(F.project.primaryDate.date) }),
      /* The venue was a string literal typed into the renderer, in two
         places, presented as a fact about the record. The record has no
         venue field, and inventing one is a data-model change. */
      /* Rendered only when there is something to render. .b-sub carries
         margin 0 and the rule below brings its own top margin, so the
         line simply is not there when the day has no name. */
      F.project.primaryDate.label
        ? h("p.b-sub", { text: F.project.primaryDate.label })
        : null,
      /* Provenance was answered last and smallest, at the very bottom of
         a seventeen-hundred-pixel document, in the one artifact whose
         whole job is that a person sent it. */
      o.keeper ? h("p.b-keeper", { text: "Kept by " + F.workspace.owner }) : null,
      /* Today is a screen fact. On paper it is already in the line
         above, and a second, differently grammared one dates the sheet
         twice. */
      o.medium === "print" ? null : h("div.b-todayRule"),
      o.medium === "print" ? null : h("p.b-todayLabel", { text: "Today is " + F.fmt.medium(clock) }),
      next ? h("p.b-gapNote", { text: gapSentence(next.date) }) : null,
    ]);
  }

  /* ── the measure ──────────────────────────────────────────────── */

  function grabLabel(record, iso, away, hidden) {
    return "Edit " + nameOf(record) + ". " + F.fmt.long(iso) + ", in " + F.fmt.dayCount(away)
      + ". " + (hidden ? "Hidden from guests." : "Shown to guests.");
  }

  /* The unit the row speaks. The past rail reuses this builder, and a
     row on it read "14 days away" under a heading saying "days back" -
     in the visible text and in the accessible name both. */
  /* The day is the project's, not a moment that happens to sit on it.
     Identity is the id, FULL STOP - not the id re-validated against the
     date, because the moment the day is legitimately moved that guard
     would fail and drop straight back to the collision it exists to
     prevent. The date scan survives only as the one-time seeder for a
     project whose primaryDate carries no id yet, and it stamps the id
     the first time it runs so a later arrival can never take it.

     This comment used to describe exactly this behaviour beside code
     that did a bare date scan; the fix it claimed had never landed. */
  function theDayRecord() {
    var pin = F.project.primaryDate;
    if (pin.id) {
      var held = recordFor(pin.id);
      if (held) return held;
    }
    for (var i = 0; i < F.milestones.length; i++) {
      if (F.milestones[i].date === pin.date) {
        pin.id = F.milestones[i].id;
        return F.milestones[i];
      }
    }
    return null;
  }
  function isTheDay(item) {
    var day = theDayRecord();
    return !!(day && item && item.id === day.id);
  }

  function row(item, away, owner, unit) {
    return h("div.b-item", {
      role: "listitem",
      /* Identity, not collision. Stamped from the project's own day
         record rather than from any row that shares its date, so a
         second moment on the same day cannot claim to be the day. */
      "data-anchor": isTheDay(item) ? "true" : null,
      "data-id": item.id,
      "data-away": String(away),
      "data-date": item.date,
      "data-visibility": "shown",
    }, [
      h("span.b-away.num", { text: String(away) }),
      /* The count column carries a bare figure under one header, which
         is the right typography and leaves the unit unspoken. It is
         spoken here instead, so the row reads as a sentence to anyone
         not looking at the column. */
      h("span.b-vh.b-unitSaid", { text: " " + (unit || "days away") + "," }),
      h("span.b-tick", { "aria-hidden": "true" }),
      h("div.b-copy", {}, [
        h("p.b-title", { "data-type": "title", "data-clamp": "true", text: nameOf(item) }),
        h("p.b-date", { text: F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date) }),
        owner ? h("button.b-grab", {
          type: "button",
          "aria-controls": "b-edit",
          "aria-expanded": "false",
          "aria-label": grabLabel(item, item.date, away, false),
        }, [h("span.b-grabWord", { text: "Edit" })]) : null,
        owner ? h("p.b-hiddenMark", { text: "Hidden from guests" }) : null,
      ]),
    ]);
  }

  /* ── the two orientations ─────────────────────────────────────────
     ACROSS and DOWN are two designs of one idea, not one design rotated.

     Down the page, distance is read by scrolling: the composition is a
     column and it is the right answer on a phone, where the whole
     approach cannot be in frame and pretending otherwise would lie
     about the proportion.

     Across the page, the WHOLE approach is one object — today at your
     feet, the day at the far end, every moment between them sitting at
     its true share of the distance. That is the thing a phone cannot
     give you and the only reason this orientation exists. It is what
     the artifact opens on at a desk.

     The scale follows: down, it is the lock's fixed pixels-per-day and
     the page grows. Across, the track fills the width and the scale
     falls out of it — with the lock's own desk figure as a FLOOR, below
     which the track scrolls rather than lying about the proportion.
     Fourteen is that floor because it is derived from the tightest real
     gap in the fixture (seven days) against the largest a label can
     grow; on this axis that is width rather than height, and the
     stagger doubles the room every label gets. */
  /* px per day, and the floor is NOT the vertical measure's fourteen.
     Down the page, fourteen exists because a row is 92px tall and a
     crowded pair can only be pushed along the same axis it is measured
     on. Across, a crowded pair is stepped OUT — a second rank, with a
     stem back to its own mark — so the constraint is not the label at
     all: it is that the tightest real gap in the fixture stays legible
     as a distance. Seven days is that gap, and at eight pixels a day it
     is 56px of rail between two ticks, which reads.

     Fourteen as a floor cost the composition its whole argument at two
     ordinary desk widths: 1280 and 1024 both fell short of 79 × 14 and
     the track scrolled, so "the whole approach in one frame" became a
     horizontal scrollbar. Eight fits every desk width this fixture can
     be opened at, and below it the track scrolls rather than lying
     about the proportion. */
  var ACROSS_FLOOR = 8;
  var ACROSS_LABEL = 168;  /* px. A two-line title at the body size.  */
  var ACROSS_RANK = 58;    /* px. One label plus its air.             */
  var ACROSS_STEM = 26;    /* px. Rule to the near edge of the figure. */

  /* Across is a desk composition. A phone is a column, and a printed
     sheet is a column, and neither is a decision the reader makes. */
  function acrossAllowed(medium) { return medium === "full" || medium === "sheet"; }

  function layoutOf(medium) {
    var want = C.rootEl().getAttribute("data-layout");
    if (!acrossAllowed(medium)) return "down";
    return want === "across" ? "across" : "down";
  }

  /* The control belongs to the measure, not to the chrome: it changes
     how this instrument is drawn and nothing else on the page. It sits
     beside the measure's own head for the same reason Notes' grouping
     control sits beside "your notes". */
  function orientationToggle(medium) {
    if (!acrossAllowed(medium)) return null;
    var now = layoutOf(medium);
    var pick = function (key, label, hint) {
      return h("button.b-layoutBtn", {
        type: "button",
        "data-layout-to": key,
        "aria-pressed": now === key ? "true" : "false",
        title: hint,
        "aria-label": hint,
      }, [h("span", { text: label })]);
    };
    return h("div.b-layout", { role: "group", "aria-label": "How the measure is drawn" }, [
      pick("across", "Across", "Draw the whole approach across the page"),
      pick("down", "Down", "Draw the approach down the page"),
    ]);
  }

  function measure(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var medium = o.medium || (o.owner ? "full" : "phone");
    var across = layoutOf(medium) === "across";
    var px = o.owner ? ownerScale() : (SCALE[o.medium] || SCALE.phone);
    var kids = [h("div.b-rail", { "aria-hidden": "true" })];
    /* The top of the rail is today, and it says so. The instrument could
       not be read on its own: the only anchor for "now" was in the other
       column, four hundred pixels away. */
    kids.push(h("p.b-origin", {
      "aria-hidden": "true",
      /* One ceremonial date per sheet. The dateline under the count
         already carries "79 days away on Thursday 16 July 2026"; the
         origin said the same day again in the same full form 200px
         away, and on paper both always print together. The origin
         keeps its anchoring job at the short form its own column
         speaks on every other medium.

         And on paper it stops saying "today". A sheet cannot be
         reloaded: it dates itself in three other places absolutely -
         the unit, the stamp and every row's own date - and this was the
         one deictic string left on it, printed and read weeks later.
         "From" rather than a bare date, so the zero mark still says
         what it is instead of reading as a moment whose name was cut. */
      text: o.medium === "print"
        ? "From " + F.fmt.weekdayShort(clock) + " " + F.fmt.short(clock)
        : "Today, " + F.fmt.medium(clock),
    }));
    ahead(clock, o.owner).forEach(function (item) {
      var node = row(item, daysFrom(clock, item.date), o.owner);
      if (item.hidden) setVisibility(node, true);
      kids.push(node);
    });
    /* The measure ends ON the day. A plan the owner built has no
       milestone for it - the fixture seeds one and would otherwise be
       drawn twice - so the terminus is rendered from the project's own
       record, through the same row builder, and is not a moment: no
       control, no editor, and its own unit so a listener hears why the
       list ends where it does. */
    /* Only while the day is still ahead. A terminus drawn for a day
       that has already gone printed a negative figure on a guest
       surface - the exact class an earlier round paid for - and a
       measure of what is ahead has nothing to say about it. */
    var toDay0 = F.project.primaryDate.date ? daysFrom(clock, F.project.primaryDate.date) : 0;
    if (!theDayRecord() && F.project.primaryDate.date && toDay0 >= 1) {
      var end = row({
        id: "the-day",
        title: F.project.primaryDate.label || "The day itself",
        date: F.project.primaryDate.date,
      }, toDay0, false, "days away, the day itself,");
      end.setAttribute("data-anchor", "true");
      end.setAttribute("data-terminus", "true");
      kids.push(end);
    }
    /* The terminus label sits at the far end of the track and the origin
       at the near one, so across they are the two things that name what
       the measure runs BETWEEN. Down, the origin alone does that job.

       Only when no moment already stands on the day — the same rule the
       measure's own terminus row uses. The fixture puts "Wedding day" on
       the day, so drawing this as well printed the day's name twice, one
       string on top of the other, at the one end of the measure a reader
       is most likely to look at. */
    if (across && !theDayRecord() && toDay0 >= 1) {
      kids.push(h("p.b-terminus", { "aria-hidden": "true" }, [
        h("span.b-terminusDay", { text: F.fmt.long(F.project.primaryDate.date) }),
        h("span.b-terminusWhat", { text: F.project.primaryDate.label || "The day itself" }),
      ]));
    }
    return h("div", { style: "line-height:1.5" }, [
      h("div.b-measureBar", {}, [
        h("h2.b-measureHead", { text: "days away" }),
        orientationToggle(medium),
      ]),
      h("div.b-measure", {
        role: "list",
        "aria-label": "What is still ahead, nearest first",
        "data-px": String(px),
        "data-clock": clock,
        "data-across": across ? "true" : null,
      }, kids),
    ]);
  }

  /* place() is the only thing that decides where an item sits, and it
     runs at first paint and after every change. It never reparents a
     node — moving the subtree that holds the focused stepper drops focus
     to the body, and the gesture dies for a keyboard user.

     The tick and the count stay on the true pixel, always, because they
     are the truth; only the words are pushed clear. Where two moments
     land on the SAME day they become one mark with two rows under it,
     done by attribute rather than by structure, so nothing is
     reparented and every row keeps its own name. */
  /* Across, position is still the quantity — it has just moved axis. The
     tick sits on the true pixel and never moves; the words are staggered
     above and below the rule and, where two on the same side would still
     touch, stepped one rank further out with a stem back to their own
     mark. Nothing is nudged onto a lie: a label that cannot sit centred
     over its tick aligns to the track's edge instead, which is what an
     axis does at its two ends. */
  function placeAcross(measureEl) {
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var horizonDays = daysFrom(clock, F.project.primaryDate.date);
    if (!(horizonDays > 0)) horizonDays = 1;

    /* The track fills the width; the scale falls out of that, floored.
       Half a tick is reserved at each end: the mark is 7px across and is
       centred on its own pixel, so a terminus sitting exactly on the
       track's edge hung 4px past it. */
    var EDGE = 4;
    var box = measureEl.clientWidth || measureEl.getBoundingClientRect().width || 0;
    var usable = Math.max(0, box - EDGE * 2);
    var px = usable > 0 ? Math.max(ACROSS_FLOOR, usable / horizonDays) : ACROSS_FLOOR;
    var span = horizonDays * px;

    var items = Array.prototype.slice.call(measureEl.querySelectorAll(".b-item"));
    items.sort(function (a, b) {
      return Number(a.getAttribute("data-away")) - Number(b.getAttribute("data-away"));
    });

    /* Two moments on one day are one mark with two labels, exactly as
       they are down the page — by attribute, never by reparenting. */
    var ORDINAL = ["first", "second", "third", "fourth", "fifth"];
    for (var g = 0; g < items.length;) {
      var day = items[g].getAttribute("data-away");
      var end = g;
      while (end < items.length && items[end].getAttribute("data-away") === day) end++;
      var runLen = end - g;
      for (var k = g; k < end; k++) {
        var el0 = items[k], i0 = k - g;
        el0.setAttribute("data-stack", runLen === 1 ? "" : (i0 === 0 ? "lead" : "follow"));
        var said0 = el0.querySelector(".b-unitSaid");
        if (said0) {
          said0.textContent = runLen === 1
            ? " days away,"
            : (i0 === 0 ? " " : " " + day + " ") + "days away, the "
              + (ORDINAL[i0] || (i0 + 1) + "th") + " of " + runLen + " moments on this day,";
        }
      }
      g = end;
    }

    var half = ACROSS_LABEL / 2;
    var lanes = { above: [], below: [] };
    var deepest = { above: 0, below: 0 };
    var side = "below";   /* the first moment goes above; this flips first */
    var leader = null;

    items.forEach(function (el) {
      var away = Number(el.getAttribute("data-away"));
      var x = EDGE + away * px;
      el.style.left = x + "px";
      el.style.removeProperty("top");
      el.style.setProperty("--x", x + "px");

      /* A follower shares its leader's mark, its side and its rank —
         it is the same day, so it is the same place on the measure. */
      var follow = el.getAttribute("data-stack") === "follow";
      if (follow && leader) {
        el.setAttribute("data-side", leader.getAttribute("data-side"));
        el.setAttribute("data-rank", leader.getAttribute("data-rank"));
        el.style.setProperty("--rank", leader.getAttribute("data-rank"));
        var edgeF = leader.getAttribute("data-edge");
        if (edgeF) el.setAttribute("data-edge", edgeF); else el.removeAttribute("data-edge");
        return;
      }
      side = side === "above" ? "below" : "above";
      el.setAttribute("data-side", side);

      /* At the two ends the label aligns inward rather than hanging off
         the track. An axis names its ends from the inside. */
      var edge = x - half < EDGE ? "start" : (x + half > EDGE + span ? "end" : null);
      if (edge) el.setAttribute("data-edge", edge); else el.removeAttribute("data-edge");
      var left = edge === "start" ? x : (edge === "end" ? x - ACROSS_LABEL : x - half);
      var right = left + ACROSS_LABEL;

      var lane = lanes[side];
      var rank = 0;
      while (lane[rank] !== undefined && left < lane[rank] + 14) rank++;
      lane[rank] = right;
      el.setAttribute("data-rank", String(rank));
      el.style.setProperty("--rank", String(rank));
      deepest[side] = Math.max(deepest[side], rank);
      leader = el;
    });

    /* ── the band, measured ───────────────────────────────────────
       How tall a rank is depends on what is in it, and what is in it
       differs by surface: an owner's row carries an Edit control that a
       guest's does not, and a two-line title is taller than a one-line
       one. Guessing a step produced a band that clipped its own labels
       top and bottom on the first surface it met. So the step is the
       tallest label actually rendered, plus its air, and the band is
       that step against the deepest rank each side actually reached. */
    measureEl.style.setProperty("--across-span", span + "px");
    measureEl.style.setProperty("--across-edge", EDGE + "px");
    measureEl.style.setProperty("--across-px", String(Math.round(px * 100) / 100));
    var awayH = 0, blockH = 0;
    items.forEach(function (el) {
      var a = el.querySelector(".b-away"), c = el.querySelector(".b-copy");
      if (a) awayH = Math.max(awayH, a.getBoundingClientRect().height);
      if (c) blockH = Math.max(blockH, c.getBoundingClientRect().height);
    });
    /* A stacked pair takes two label heights in one rank. */
    var stacked = items.some(function (el) { return el.getAttribute("data-stack") === "follow"; });
    var step = Math.round(awayH + blockH * (stacked ? 2 : 1) + 14);
    measureEl.style.setProperty("--away-h", Math.round(awayH) + "px");
    measureEl.style.setProperty("--step", step + "px");

    var band = function (n) { return ACROSS_STEM + (n + 1) * step; };
    var above = band(deepest.above), below = band(deepest.below);
    measureEl.style.setProperty("--rule-y", above + "px");
    measureEl.style.height = above + below + "px";
    /* Only when the floor bites. A track that fits never scrolls, and a
       scrollbar under a composition that fits is a lie about the width. */
    measureEl.setAttribute("data-scrolls", span > usable + 1 ? "true" : "false");
  }

  function place(measureEl) {
    if (!measureEl) return;
    /* One entry point, two instruments. Every caller — the settle, both
       editor paths — asks for the measure to be placed and does not need
       to know which way it runs. */
    if (measureEl.getAttribute("data-across") === "true") return placeAcross(measureEl);
    var px = Number(measureEl.getAttribute("data-px")) || 14;
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var back = measureEl.getAttribute("data-back") === "true";
    /* Going back, the horizon is the oldest thing there is rather than
       the wedding day, and the ceiling clamp does not apply. */
    var horizonDays = back
      ? Number(measureEl.lastChild && measureEl.lastChild.getAttribute
        ? measureEl.lastChild.getAttribute("data-away") : 0) || 0
      : daysFrom(clock, F.project.primaryDate.date);
    var items = Array.prototype.slice.call(measureEl.querySelectorAll(".b-item"));
    items.sort(function (a, b) {
      return Number(a.getAttribute("data-away")) - Number(b.getAttribute("data-away"));
    });

    /* The list calls itself "nearest first" and stopped being it on the
       owner's first press: the sort decided the pixels and was then
       thrown away, so tab order and screen-reader order contradicted the
       column a sighted owner was looking at. Each row is pinned to where
       it already is before it is reparented, and layout is flushed, so
       the move still animates and the pressed stepper keeps focus. */
    var current = Array.prototype.slice.call(measureEl.querySelectorAll(".b-item"));
    var outOfOrder = items.some(function (el, i) { return current[i] !== el; });
    if (outOfOrder) {
      var held = document.activeElement;
      items.forEach(function (el) {
        el.style.top = getComputedStyle(el).top;
        measureEl.appendChild(el);
      });
      void measureEl.offsetHeight;
      if (held && held.isConnected && measureEl.contains(held)) {
        held.focus({ preventScroll: true });
      }
    }

    var unit = back ? "days back" : "days away";
    var bottom = -Infinity, lastBottom = 0;

    /* Grouping happens BEFORE anything is measured. It used to run as a
       row was passed, so the render that first formed a stacked pair
       measured the leader without the padding its lead state was about
       to give it, and the pair overlapped by a pixel until some later
       repaint corrected it. place() has to be a fixed point. */
    var ORDINAL = ["first", "second", "third", "fourth", "fifth"];
    function nth(i) { return ORDINAL[i] || (i + 1) + "th"; }
    for (var g = 0; g < items.length;) {
      var day = items[g].getAttribute("data-away");
      var end = g;
      while (end < items.length && items[end].getAttribute("data-away") === day) end++;
      var runLen = end - g;
      for (var k = g; k < end; k++) {
        var el0 = items[k], i0 = k - g;
        el0.setAttribute("data-stack", runLen === 1 ? "" : (i0 === 0 ? "lead" : "follow"));
        var said0 = el0.querySelector(".b-unitSaid");
        if (said0) {
          /* The follower's numeral is hidden in the gutter, so it says
             the figure here or a listener gets a unit with no number in
             front of it - and both members take a real ordinal, because
             "then of 2" is not English in any register. */
          said0.textContent = runLen === 1
            ? " " + unit + ","
            : (i0 === 0 ? " " : " " + day + " ")
              + unit + ", the " + nth(i0) + " of " + runLen + " moments on this day,";
        }
      }
      g = end;
    }

    items.forEach(function (el, index) {
      var away = Number(el.getAttribute("data-away"));
      var top = away * px;
      el.style.top = top + "px";
      /* The other axis's leftovers. A row placed across and then placed
         down again keeps an inline `left` that pins it off the rail. */
      el.style.removeProperty("left");
      el.removeAttribute("data-side");
      el.removeAttribute("data-rank");
      el.removeAttribute("data-edge");
      el.removeAttribute("data-lead");

      var copy = el.querySelector(".b-copy");
      /* --push belongs to the ROW, not to the words alone. It used to be
         set on .b-copy, whose siblings inherit nothing from it, so when
         two moments fell closer than a row is tall the words were pushed
         clear and the count was left behind on the true pixel - beside
         somebody else's title. On the compressed past rail, where a week
         is 14px and a row of type is 39px, six of eight rows crowd at
         once: three numerals stacked against one title, and three titles
         with no numeral anywhere near them. The tick stays on the true
         pixel because the tick IS the position; the count is a readout
         of the row and travels with the words it names. */
      el.style.setProperty("--push", "0px");
      var height = copy.getBoundingClientRect().height;
      var gap = el.getAttribute("data-stack") === "follow" ? 1 : 10;
      var push = bottom > top ? Math.ceil(bottom - top) : 0;
      el.style.setProperty("--push", push + "px");
      el.setAttribute("data-crowded", push > 0 ? "true" : "false");
      bottom = top + push + height + gap;
      lastBottom = bottom;
      if (index === 0) el.setAttribute("data-lead", "true");
    });

    var field = measureEl.closest(".b-field");
    var note = field && field.querySelector(".b-gapNote");
    /* The guard, not the wording of one instance: with no rows at all
       the sentence used to freeze on whatever it last said - after
       deleting farthest-first it went on naming a date that now holds
       nothing, which is a plain falsehood rather than a stale phrasing. */
    if (note) {
      /* ONE WRITER. place() used to paint the at-rest sentence on every
         repaint while speak() painted the scrolled one only on scroll,
         so a move, a resize, fonts.ready or a keystroke snapped the line
         back to a fact about the top of a plan the owner was not looking
         at. place() computes; speak() paints. */
      var atRest = items.length
        ? gapSentence(items[0].getAttribute("data-date"))
        : "Nothing is planned yet.";
      if (field) field.__gapAtRest = atRest;
      if (field && field.__gapSpeak) field.__gapSpeak();
      else note.textContent = atRest;
    }
    /* The measure is at least the horizon, and taller if the words at
       the foot of it need the room. A rail that ends above its own last
       row is the undesigned edge a panel looks for first. */
    /* An empty measure is sized to what it holds, which is nothing. The
       horizon floor is what a plan is measured against, not a reason to
       draw 1198px of bare rule under a plan with no moments in it. */
    measureEl.style.height = items.length
      ? Math.max(horizonDays * px + ROW, Math.ceil(lastBottom + 24)) + "px"
      : "0px";
    var host0 = measureEl.closest(".b-plan");
    if (host0 && !items.length) host0.scrollTop = 0;
    markFolds(measureEl.closest(".b-field"));
  }

  /* ── behind you ───────────────────────────────────────────────── */

  /* Two sentences, split by who is reading, and the rows behind a
     disclosure the reader can actually open. The lock says the past is
     stated in a sentence and listed in full only if asked for; the
     asking was the half that had never been built, so the rows were in
     the DOM and reachable by nobody. */
  function behindBlock(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var dayOf = clock === F.project.primaryDate.date;
    /* Cancelled moments stay in the record on BOTH clocks. Dropping
       them on the day itself meant the same guest read "3 moments" in
       July and "8 moments" in October with one of them having quietly
       left the story. */
    var past = behind(clock, o.owner);
    var done = past.filter(function (m) { return m.state !== "cancelled"; });
    var dropped = past.filter(function (m) { return m.state === "cancelled"; });
    var last = done[done.length - 1];
    if (!past.length) return null;

    var note;
    if (dayOf) {
      note = last ? last.title + ", " + F.fmt.medium(last.date) + "." : "";
    } else if (o.owner) {
      note = done.length + " done, the last of them " + F.fmt.medium(last.date) + "."
        + (dropped.length ? " One thing is not going ahead." : "");
    } else {
      note = (last ? last.title + ", " + F.fmt.medium(last.date) + "." : "")
        + (dropped.length
          ? " The " + dropped[0].title.charAt(0).toLowerCase() + dropped[0].title.slice(1)
            + " is not going ahead."
          : "");
    }

    var rows = past.map(function (item) {
      var off = item.state === "cancelled";
      return h("div.b-behindRow", {}, [
        /* A thing that was called off did not fail to have a date, and
           a line drawn through 15px text at 28% is not a statement. The
           row says what it is, in words, so the accessible name carries
           it too. */
        h("span.b-behindDate.num", {
          text: off || !item.date
            ? ""
            : F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date),
        }),
        h("p.b-behindTitle", {
          "data-cancelled": off ? "true" : null,
          text: nameOf(item),
        }),
        off ? h("span.b-behindState", { text: F.stateLabel.cancelled }) : null,
      ]);
    });

    /* On the day itself the past is drawn in the product's own
       language rather than as a dated table: the same rail, the same
       ticks, the same mono date beside the person's words, running
       downward from today into the closed months at two pixels a day.
       The best idea in the direction was absent from the one screen the
       whole company is judged by. No new data and no new control - the
       measure that draws what is ahead draws what is behind. */
    var rowsNode = o.back
      ? backMeasure(clock, past, o.owner)
      /* CONFIRMED AND DEFERRED (round 6). The owner's past carries no
         control, so a moment is uneditable the day after it passes. The
         fix is a build, not a polish: the editor refuses any date behind
         today by design - itself the remedy for a confirmed round-1
         finding - and a row placed on a measure inside a collapsed
         disclosure has no geometry to be placed against. Landing it
         unverified in the last rounds would trade a proven surface for
         an unproven one. Recorded in the round report as open. */
      : h("div.b-behindRows", {}, rows);

    var head = [
      /* One name. The morning called this "How you got here" while its
         own closing sentence read "moments behind you", so the screen
         contradicted itself. */
      h("h2.b-behindLabel", { text: "Behind you" }),
      h("span.b-behindCount.num", { text: past.length + " moments" }),
    ];
    /* Where the past is listed in full - the record room, and paper -
       there is no disclosure at all. Taking the control away in CSS took
       the heading and the count with it and left the rows unreachable
       behind a <details> that was still closed, so the two surfaces
       whose whole subject is the past showed LESS of it than the one
       that folds. */
    var listed = C.rootEl().getAttribute("data-past") === "listed" || o.print === true;

    return h("section.b-behind", {}, [
      listed
        ? h("div.b-behindHead", {}, head)
        : h("details.b-behindDetails", {}, [
          h("summary.b-behindSummary", {}, head),
          rowsNode,
        ]),
      listed ? rowsNode : null,
      /* The sentence closes the block. It used to open it, so on the
         wedding morning the last thing a guest read before the footer
         was a cancelled hotel search. */
      /* Two closings, one shown. Where the rows are visible the
         sentence was printing a title the reader could already see,
         twelve pixels below it; where they are folded the sentence is
         the only statement of the past there is. */
      listed ? null : h("p.b-behindNote", { "data-when": "folded", text: note.trim() }),
      /* The head carries the only total - it counts the rows a reader
         can see. This line partitions that total; it never recounts it,
         because the same noun printing two different numbers on one
         sheet is the whole defect. */
      dropped.length
        ? h("p.b-behindNote", {
          "data-when": listed ? "listed" : "open",
          text: dropped.length === 1
            ? "One of them did not happen."
            : dropped.length + " of them did not happen.",
        })
        : null,
    ]);
  }

  /* Two pixels a day. Nine months of a wedding is 274 days, which is
     3,300px at guest scale and unreadable; at two it is about 550 and
     the proportion between one gap and the next is exactly what it is
     everywhere else. The scale is a page-size decision; the ratio is
     not. */
  var BACK_PX = 2;

  function backMeasure(clock, past, owner) {
    var dated = past.filter(function (m) { return m.date; });
    var undated = past.filter(function (m) { return !m.date; });
    var kids = [h("div.b-rail", { "aria-hidden": "true" })];
    dated.forEach(function (item) {
      kids.push(row(item, -daysFrom(clock, item.date), owner, "days back"));
    });
    return h("div.b-backWrap", {}, [
      h("h2.b-measureHead", { text: "days back" }),
      h("div.b-measure.b-back", {
        role: "list",
        "aria-label": "Behind you, most recent first",
        "data-px": String(BACK_PX),
        "data-clock": clock,
        "data-back": "true",
      }, kids),
      undated.length
        ? h("div.b-behindOff", {}, undated.map(function (item) {
          return h("p.b-behindOffRow", {
            text: nameOf(item) + " \u2014 " + F.stateLabel[item.state],
          });
        }))
        : null,
    ]);
  }

  function foot(opts) {
    var o = opts || {};
    return h("footer.b-foot", {}, [
      o.keeper === false ? null : h("span", { text: "Kept by " + F.workspace.owner }),
      /* No stamp where there is nothing to stamp: a project that has
         never held anything, and the morning itself, where an
         eleven-week-old timestamp reads as neglect. */
      o.stamp === false ? null : h("span.b-stamp", { text: "Updated " + F.updatedLabel }),
      h("span", { text: o.link || "Signal Timeline" }),
    ]);
  }

  /* A labelled section is a region landmark. It travels better than
     <main>: when this language moves to Home, Notes and Tasks it will
     sit inside an app shell that already owns the document's one main. */
  function field(kids, extra, projectName) {
    return h("section.b-field" + (extra || ""), {
      "aria-label": "The plan for " + (projectName || F.project.name),
    }, kids);
  }

  function act(label, primary, attrs) {
    var a = { type: "button", "data-primary": primary ? "true" : null, text: label };
    if (attrs) for (var k in attrs) a[k] = attrs[k];
    return h("button.b-act", a);
  }
  /* Anything not built is inert text, never a focusable promise. */
  function inert(label) { return h("span.b-inert", { text: label }); }

  function bar(projectName, actions) {
    return h("div.b-bar", {}, [
      h("span.b-where", { text: F.workspace.name }),
      h("span.b-switch", {}, [projectName, h("span", { text: "one of three" })]),
      h("div.b-spacer"),
      h("div.b-barActs", {}, actions),
    ]);
  }

  /* ── reversibility ────────────────────────────────────────────── */

  /* One surface, one place, silent until it has something true to say,
     and every entry carries the closure that reverses it. Round 2 found
     a stack that only knew how to move a date: a delete left a live
     offer to restore a row that no longer existed, and pressing it
     restored nothing and cleared itself as though it had worked. */
  /* The undo handler has always accepted either modifier; the keycap
     named only one of them. */
  var MAC_KEYS = /Mac|iPhone|iPad/.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "");
  var history = [];
  /* Monotonic for the life of the project. Minting from milestones.length
     reissued live ids after a delete, which silently wrote one moment's
     name onto another and made undo restore the wrong row. */
  var minted = F.milestones.length;

  function undoBar() {
    return h("div.b-undo", { role: "status", "data-empty": "true" }, [
      h("span.b-undoText", { text: "" }),
      h("button.b-undoAct", { type: "button", disabled: "disabled", tabindex: "-1", text: "Undo" }),
      h("kbd", { text: MAC_KEYS ? "⌘ Z" : "Ctrl Z" }),
    ]);
  }

  function paintUndo(root) {
    var bar = root.querySelector(".b-undo");
    if (!bar) return;
    var text = bar.querySelector(".b-undoText");
    var button = bar.querySelector(".b-undoAct");
    var top = history[history.length - 1];
    text.textContent = "";
    if (!top) {
      bar.setAttribute("data-empty", "true");
      button.disabled = true;
      button.setAttribute("tabindex", "-1");
      root.removeAttribute("data-undo");
      root.style.removeProperty("--b-undo");
      return;
    }
    bar.setAttribute("data-empty", "false");
    top.say.forEach(function (part) {
      text.appendChild(typeof part === "number"
        ? h("span.num", { text: String(part) })
        : document.createTextNode(part));
    });
    button.disabled = false;
    button.removeAttribute("tabindex");
    root.setAttribute("data-undo", "true");
    /* Below the two-column boundary the bar is fixed to the bottom edge
       and can be filled with no editor open - after a delete, or after
       Escape. Its band was reserved by nothing, so it covered the foot
       and the last Edit controls with no scroll left to free them. It
       wraps to two lines at 390 and one at 768, so it is measured. */
    reserveUndo(root);
  }

  function remember(root, entry) {
    /* The stamp moves, because the plan just changed. It used to be
       written by hand inside the add branch, so it was true after one
       of the six things an owner can do and stale after the other
       five - and the guest, who has no "Live since" line, has this
       string and nothing else to date the plan by. Every change that
       can be undone passes through here, which is what makes this the
       one place it belongs. */
    F.updatedLabel = F.fmt.medium(F.today) + " " + F.fmt.year(F.today);
    paintPublication(root);
    /* The place the owner was looking at is part of the change. Undo
       used to restore the moment and leave them a screen away from it. */
    entry.at = window.scrollY;
    var pane = paneOf(root);
    entry.paneAt = pane ? pane.scrollTop : null;
    history.push(entry);
    paintUndo(root);
  }

  function undo(root) {
    var top = history[history.length - 1];
    if (!top) return;
    var restored = top.undo();
    /* Peek, then pop. Popping first is how pressing Undo after a delete
       used to restore nothing and empty the bar as though it had. */
    if (restored !== false) history.pop();
    /* Was the owner standing on the Undo control itself? paintUndo is
       about to disable it when the stack empties, and disabling the
       focused element drops focus to the body. */
    var stoodOnUndo = document.activeElement === root.querySelector(".b-undoAct");
    paintUndo(root);
    /* The place restore cannot be stranded by the focus restore. It used
       to sit after an unguarded call, so one throw inside a closure took
       the scroll with it. Every focus call here passes preventScroll,
       which is what makes restoring scroll first safe. */
    try {
      if (top.focus) top.focus();
      else if (stoodOnUndo) {
        /* Only the stepper entry carries a focus closure. Every other
           reversal - rename, hide, delete - left a keyboard owner on the
           body once the control they pressed went away. */
        var back = (top.id && root.querySelector('.b-item[data-id="' + top.id + '"] .b-grab'))
          || root.querySelector(".b-edit") || root.querySelector(".b-undoAct");
        if (back && back.isConnected) {
          if (!back.hasAttribute("tabindex") && back.tagName !== "BUTTON") back.setAttribute("tabindex", "-1");
          back.focus({ preventScroll: true });
        }
      }
    } finally {
      if (typeof top.at === "number") window.scrollTo(0, top.at);
      if (typeof top.paneAt === "number") {
        var back = paneOf(root);
        if (back) back.scrollTop = top.paneAt;
      }
    }
  }

  /* ── the primary gesture ──────────────────────────────────────── */

  /* setAway is the ONLY writer of an item's distance. Every fact about
     the item is derived from the one date it computes, in the same
     frame, so the count, the date line, the accessible name and the
     readout cannot drift apart. */
  function setAway(root, item, next) {
    var measureEl = item.parentElement;
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var ceiling = daysFrom(clock, F.project.primaryDate.date);
    var away = Math.max(1, Math.min(ceiling, next));
    var iso = F.plusDays(clock, away);
    var record = recordFor(item.getAttribute("data-id"));
    var hidden = item.getAttribute("data-visibility") === "hidden";

    /* The record, not only the row. Every state remounts from the
       record, so a date written to the DOM alone survived exactly as
       long as the owner stayed on one screen. */
    if (record) record.date = iso;
    /* And the PROJECT, when the row being moved is the day. setTitle
       already writes the project's label here for exactly this reason;
       the date was left behind, so one press in the day's own editor
       moved the milestone while the largest type on the surface went on
       reading the date it used to be - and every distance on the page
       is measured from that number. */
    if (record && isTheDay(record)) {
      F.project.primaryDate.date = iso;
      var fieldEl = item.closest(".b-field");
      var whenEl = fieldEl && fieldEl.querySelector(".b-when");
      if (whenEl) whenEl.textContent = F.fmt.longYear(iso);
      paintHorizonCount(fieldEl);
    }
    item.setAttribute("data-away", String(away));
    item.setAttribute("data-date", iso);
    item.querySelector(".b-away").textContent = String(away);
    item.querySelector(".b-date").textContent = F.fmt.weekdayShort(iso) + " " + F.fmt.short(iso);
    var grab = item.querySelector(".b-grab");
    if (grab) grab.setAttribute("aria-label", grabLabel(record, iso, away, hidden));

    var read = root.querySelector(".b-stepRead");
    var readParts = read ? read.querySelectorAll("span") : [];
    if (readParts.length === 2) {
      readParts[0].textContent = F.fmt.longYear(iso);
      readParts[1].textContent = "in " + F.fmt.dayCount(away);
    }

    /* The field is the FIFTH consumer of this date, not a rival source
       of it. It used to be seeded once when the editor opened and never
       written again, so three presses of +7 left the largest, most
       authoritative, most editable statement of the date on the panel
       reading the value it had before any of them - and a bare Enter in
       that untouched field then committed the stale string and dragged
       the moment back twenty-one days. The guard is focus, not equality:
       a stepper press moves focus to the button, so the stepper can
       never lose to a half-typed value, and a half-typed value is never
       yanked out from under the typist. */
    var when = root.querySelector("#b-edit-date");
    if (when && document.activeElement !== when) {
      when.value = F.fmt.medium(iso) + " " + F.fmt.year(iso);
      when.setAttribute("aria-invalid", "false");
      var refusal = root.querySelector(".b-ceiling");
      if (refusal && /not a date|has gone|Nothing can sit after|Type the day first/.test(refusal.textContent)) refusal.textContent = "";
    }

    var steps = root.querySelectorAll(".b-step");
    for (var i = 0; i < steps.length; i++) {
      var delta = Number(steps[i].getAttribute("data-delta"));
      steps[i].setAttribute("aria-disabled",
        (delta > 0 ? away >= ceiling : away <= 1) ? "true" : "false");
    }
    var ceilingNote = root.querySelector(".b-ceiling");
    if (ceilingNote) {
      ceilingNote.textContent = away >= ceiling
        ? "This is as far as it goes. Nothing can sit after the day itself."
        : (away <= 1 ? "This is as near as it goes. Tomorrow is the soonest." : "");
    }
    place(measureEl);
    /* On the next frame, not this one: the bar that reports the move
       fills after the move, and the sheet is anchored to the bottom
       edge, so the band the row must stay inside grows upward under it. */
    requestAnimationFrame(function () { keepInBand(root, item); });
    return away;
  }

  /* The move is the one animated thing in the product, and below the
     gutter width it was happening under a sheet that covered the row.
     Gated on the sheet, not on a width: where the editor is the static
     rail the steppers cannot move under the hand, so the scroll path is
     unreachable there and the page keeps its place exactly as before. */
  /* The pane, but only while it is actually the thing that scrolls. */
  /* An edge that means something. The panes were given a frame and no
     edge, so a title or a control could be sliced mid-glyph at the fold
     with nothing saying so. Measured after layout, per pane, and
     removed when nothing is hidden - a permanent gradient would be the
     always-on decoration the defect library forbids. */
  function markFold(el) {
    if (!el) return;
    if (getComputedStyle(el).overflowY !== "auto") { el.removeAttribute("data-fold"); return; }
    var above = el.scrollTop > 2;
    var below = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    if (above && below) el.setAttribute("data-fold", "both");
    else if (below) el.setAttribute("data-fold", "below");
    else if (above) el.setAttribute("data-fold", "above");
    else el.removeAttribute("data-fold");
  }
  function markFolds(root) {
    var scope = root || document;
    markFold(scope.querySelector(".b-plan"));
    markFold(scope.querySelector(".b-ownerField .b-stick"));
  }

  function paneOf(root) {
    var pane = root && root.querySelector(".b-plan");
    if (!pane || getComputedStyle(pane).overflowY !== "auto") return null;
    return pane.scrollHeight > pane.clientHeight + 1 ? pane : null;
  }

  /* Removing or restoring a row changes the pane's content height, and
     a scroller re-anchors on its own terms - so the picture is held
     explicitly across the mutation rather than left to the browser. */
  function holdingPlace(root, fn) {
    var pane = paneOf(root);
    var at = pane ? pane.scrollTop : null;
    fn();
    if (pane && pane.isConnected) pane.scrollTop = at;
  }

  function keepInBand(root, item) {
    var panel = root.querySelector(".b-edit");
    var pane = root.querySelector(".b-plan");
    var paneScrolls = pane && pane.scrollHeight > pane.clientHeight + 1
      && getComputedStyle(pane).overflowY === "auto";
    var fixed = panel && getComputedStyle(panel).position === "fixed";
    /* Two bands, one law. Under a docked sheet the free band is the
       window above it; in the pane the free band is the pane, and the
       rail with the steppers in it is outside the pane entirely, so
       following the moment cannot move the control being pressed. */
    if (!fixed && !paneScrolls) return;
    var free = fixed ? panel.getBoundingClientRect().top - 16 : pane.clientHeight - 16;
    var copy = item.querySelector(".b-copy");
    /* Where the row WILL be, not where it is mid-flight. The move is
       animated, so a rect read during the transition is the position the
       row is leaving, and scrolling to that lands the reader ninety-odd
       pixels behind the thing they just moved. */
    var measureEl = item.parentElement;
    var px = Number(measureEl.getAttribute("data-px")) || 14;
    var away = Number(item.getAttribute("data-away"));
    var push = parseFloat(getComputedStyle(copy).getPropertyValue("--push")) || 0;
    var height = copy.getBoundingClientRect().height;
    var top = measureEl.getBoundingClientRect().top + away * px + push;
    if (!fixed) top -= pane.getBoundingClientRect().top;
    if (top >= 16 && top + height <= free) return;
    /* The MINIMUM correction that puts the row back in the band, not a
       re-centre. A row two pixels past the edge used to move the whole
       plan by 287 - the lock promises this control "moves the item on
       the measure while you hold it, and moves nothing else", and a
       pane that bolts a third of a screen because a moment crossed a
       boundary by two pixels is the opposite of that. Re-centring
       survives only as the fallback for a row too tall to fit. */
    var pad = 24;
    var delta;
    if (height + pad * 2 > free) delta = Math.round(top - Math.max(16, (free - height) / 2));
    else if (top < 16) delta = Math.round(top - pad);
    else delta = Math.round(top + height - (free - pad));
    if (fixed) window.scrollBy(0, delta);
    else pane.scrollTop += delta;
  }

  function setVisibility(item, hidden) {
    var record = recordFor(item.getAttribute("data-id"));
    if (record) record.hidden = hidden;
    item.setAttribute("data-visibility", hidden ? "hidden" : "shown");
    var grab = item.querySelector(".b-grab");
    if (grab) {
      grab.setAttribute("aria-label", grabLabel(
        record,
        item.getAttribute("data-date"),
        Number(item.getAttribute("data-away")),
        hidden,
      ));
    }
  }

  function setTitle(item, value) {
    /* One accessor. When the row being renamed IS the day, the project's
       own label is what the horizon, the card and the sheet all read, so
       it is written here and the two can never disagree. */
    var rec0 = recordFor(item.getAttribute("data-id"));
    if (rec0 && isTheDay(rec0)) {
      F.project.primaryDate.label = value;
      /* The horizon reads this label, so it is repainted in the same
         frame - otherwise the row and the horizon carry two names for
         one day, which is the defect this branch exists to close. */
      var field0 = item.closest(".b-field");
      var sub0 = field0 && field0.querySelector(".b-sub");
      if (sub0) sub0.textContent = value;
    }
    var record = recordFor(item.getAttribute("data-id"));
    record.title = value.trim();
    var shown = nameOf(record);
    var title = item.querySelector(".b-title");
    title.setAttribute("data-full", shown);
    title.textContent = shown;
    /* The panel is named once, at open, and a name typed into it has to
       reach that label too, or the editor goes on announcing a moment
       nobody can find under that name any more. */
    var panel = document.getElementById("b-edit");
    if (panel) panel.setAttribute("aria-label", "Editing " + shown);
    /* The trim is an invariant, not a one-time measurement: typing a
       long name used to leave the row cut mid-word by the CSS safety
       net with a tooltip still naming the moment before it. */
    title.removeAttribute("title");
    C.settle();
    var grab = item.querySelector(".b-grab");
    if (grab) {
      grab.setAttribute("aria-label", grabLabel(
        record,
        item.getAttribute("data-date"),
        Number(item.getAttribute("data-away")),
        item.getAttribute("data-visibility") === "hidden",
      ));
    }
  }

  /* ── the editor ───────────────────────────────────────────────── */

  function editor(root, item) {
    var record = recordFor(item.getAttribute("data-id"));
    var away = Number(item.getAttribute("data-away"));
    var iso = item.getAttribute("data-date");
    var hidden = item.getAttribute("data-visibility") === "hidden";
    var titleAtOpen = record.title;
    /* Resolved once, by identity rather than by date collision. */
    var theDay = isTheDay(record);

    function step(delta, label) {
      return h("button.b-step", {
        type: "button",
        "data-delta": String(delta),
        "aria-label": label,
        "aria-disabled": "false",
        text: (delta > 0 ? "+" : "−") + Math.abs(delta),
        on: {
          /* The rail is a scroll pane, and a mouse press on a control
             sitting near its edge makes the browser scroll that control
             into view - which moves the button out from under the
             pointer between one press and the next. Round 1 paid for
             these buttons holding still; keepInBand holds the plan's
             pane for the same reason and its comment assumed the rail
             could never move. Focus is still taken, just without the
             scroll that came with it. */
          mousedown: function (event) {
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
          },
          click: function (event) {
            /* Capture the NODE, not the event. currentTarget is nulled
               the moment dispatch finishes, so a closure that read it
               later threw on every undo of a move - the product's most
               frequent reversal - and the throw landed between the
               repaint and the line that gives the owner their place
               back, so undo annihilated both focus and scroll on the
               one action an owner takes all day. */
            var pressed = event.currentTarget;
            if (pressed.getAttribute("aria-disabled") === "true") return;
            var from = Number(item.getAttribute("data-away"));
            var to = setAway(root, item, from + delta);
            if (to === from) return;
            var moved = Math.abs(to - from);
            remember(root, {
              id: record.id,
              say: [briefly(record) + " moved ", moved, moved === 1 ? " day " : " days ",
                to < from ? "earlier." : "later."],
              undo: function () { setAway(root, item, from); },
              focus: function () {
                if (pressed && pressed.isConnected) pressed.focus({ preventScroll: true });
              },
            });
          },
        },
      });
    }

    function visButton(label, wantHidden) {
      return h("button", {
        type: "button",
        "aria-pressed": String(wantHidden === hidden),
        text: label,
        on: {
          click: function (event) {
            var group = event.currentTarget.parentElement.querySelectorAll("button");
            var was = item.getAttribute("data-visibility") === "hidden";
            if (was === wantHidden) return;
            for (var i = 0; i < group.length; i++) {
              group[i].setAttribute("aria-pressed", String(group[i] === event.currentTarget));
            }
            setVisibility(item, wantHidden);
            remember(root, {
              id: record.id,
              say: [briefly(record) + (wantHidden ? " is now hidden from guests." : " is now shown to guests.")],
              undo: function () {
                setVisibility(item, was);
                for (var j = 0; j < group.length; j++) {
                  group[j].setAttribute("aria-pressed", String(group[j].textContent === (was ? "Hidden" : "Shown")));
                }
              },
            });
          },
        },
      });
    }

    return h("div.b-edit#b-edit", {
      role: "group",
      tabindex: "-1",
      "aria-label": theDay ? "Editing the day itself" : "Editing " + nameOf(record),
    }, [
      h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
        h("label.b-label", { for: "b-edit-title", text: "What it is" }),
        h("input.b-input", {
          id: "b-edit-title", type: "text", value: record.title,
          placeholder: "What is happening",
          on: {
            input: function (event) { setTitle(item, event.target.value); },
            change: function (event) {
              var to = event.target.value.trim();
              if (to === titleAtOpen) return;
              var from = titleAtOpen;
              titleAtOpen = to;
              remember(root, {
                id: record.id,
                say: ["Renamed to " + (to || "Untitled moment") + "."],
                undo: function () {
                  setTitle(item, from);
                  event.target.value = from;
                  titleAtOpen = from;
                },
              });
              C.settle();
            },
          },
        }),
      ]),
      h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
        h("label.b-label", { for: "b-edit-date", text: "When" }),
        /* A planner told "it has moved to Thursday 10 September" should
           not have to work out that this is nineteen days from Saturday
           22 August on the one surface built to remove arithmetic. */
        h("input.b-input", {
          id: "b-edit-date", type: "text", "data-mono": "true",
          value: F.fmt.medium(iso) + " " + F.fmt.year(iso),
          "aria-describedby": "b-edit-when-hint",
          on: {
            change: function (event) { commitDate(root, item, event.target); },
            keydown: function (event) {
              if (event.key === "Enter") { event.preventDefault(); commitDate(root, item, event.target); }
            },
          },
        }),
        h("div.b-stepRow", {}, [
          h("div.b-stepBtns", {}, [
            step(-7, "Move a week earlier"), step(-1, "Move a day earlier"),
            step(1, "Move a day later"), step(7, "Move a week later"),
          ]),
          /* Its own line, at a reserved height. Beside the buttons it
             collapsed on the first press and threw the button you were
             about to press again two hundred pixels sideways. */
          /* Two facts, two lines - not one sentence with a connector in
             it. The nbsp bound the middot backwards so it could never
             OPEN line two, but the string does not fit its measure at
             any width the panel is ever given, so the break simply moved
             to the other side of the same glyph and left the separator
             hanging in white space at the end of line one - which at
             this size reads as a truncation mark, not as a joint. The
             reserve was always two lines high; this is what it was for. */
          h("span.b-stepRead.num", { role: "status" }, [
            h("span", { text: F.fmt.longYear(iso) }),
            h("span", { text: "in " + F.fmt.dayCount(away) }),
          ]),
        ]),
        /* role=status, exactly as #b-empty-hint one screen away. The
           describedby relationship is correct and does update, but a
           description is only spoken when the reader arrives at the
           field - so the editor announced acceptance and said nothing
           at all when it REFUSED. Not alert: assertive would cut across
           the reversibility bar and the readout on the accepted path. */
        h("p.b-ceiling#b-edit-when-hint", { role: "status", text: "" }),
      ]),
      /* The day is not a moment and does not get a moment's controls.
         Hiding it would hide the thing every figure on the page is
         measured from, and deleting it took it out of the measure while
         the horizon four hundred pixels away went on counting to it.
         What remains is what the day actually has: a name and a date. */
      theDay ? null : h("div.b-editGroup", {}, [
        h("span.b-label", { id: "b-vis", text: "What guests see" }),
        h("div.b-seg", { role: "group", "aria-labelledby": "b-vis" }, [
          visButton("Shown", false), visButton("Hidden", true),
        ]),
      ]),
      theDay ? h("p.b-ceiling.b-standing", {
        text: "Everything on this plan is measured from this day.",
      }) : null,
      h("div.b-editActs", {}, [act("Done", true, { "data-act": "done" })]),
      /* On its own line, after a rule. It used to sit ten pixels to the
         right of the safe action at two and a half times its width. */
      theDay ? null : h("div.b-editDanger", {}, [
        act("Delete this moment", false, { "data-act": "delete" }),
      ]),
    ]);
  }

  function commitDate(root, item, input) {
    var measureEl = item.parentElement;
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var ceiling = daysFrom(clock, F.project.primaryDate.date);
    var iso = F.parseDay(input.value);
    var hint = root.querySelector(".b-ceiling");
    function refuse(message) {
      input.setAttribute("aria-invalid", "true");
      if (hint) hint.textContent = message;
    }
    /* Three cases, three sentences - the same split the first field
       the product ever offers already makes. Nothing typed is not an
       unreadable date, and telling a person who typed nothing that what
       they typed is not a date tells them to type. */
    if (!(input.value || "").trim()) {
      return refuse("Type the day first. For example, 3 October 2026.");
    }
    if (!iso) return refuse("That is not a date. Try 3 October 2026.");
    var away = daysFrom(clock, iso);
    if (away < 1) return refuse("That day has gone. Pick one still ahead.");
    if (away > ceiling) {
      /* Not the standing note's words. That sentence is also what the
         panel writes when a date IS accepted at the limit, so one
         string carried both "we took it, you are at the edge" and "we
         did not take it" - and the field went on holding the rejected
         string. Like the other two refusals: state the rule, and name
         what still stands. */
      var standing = recordFor(item.getAttribute("data-id")).date;
      return refuse("Nothing can sit after " + F.fmt.longYear(F.project.primaryDate.date)
        + ". Still " + F.fmt.longYear(standing) + ".");
    }
    input.setAttribute("aria-invalid", "false");
    if (hint) hint.textContent = "";
    var record = recordFor(item.getAttribute("data-id"));
    var from = Number(item.getAttribute("data-away"));
    /* A confirm on an unchanged field is a no-op, and it returns BEFORE
       setAway rather than after the move. Pressing Enter in a field
       nobody had typed in used to run the whole writer, relaying the
       measure and nudging the band for a date that had not changed. */
    if (away === from) {
      input.value = F.fmt.medium(iso) + " " + F.fmt.year(iso);
      return;
    }
    var to = setAway(root, item, away);
    input.value = F.fmt.medium(F.plusDays(clock, to)) + " " + F.fmt.year(F.plusDays(clock, to));
    if (to === from) return;
    var moved = Math.abs(to - from);
    remember(root, {
      id: record.id,
      say: [briefly(record) + " moved ", moved, moved === 1 ? " day " : " days ",
        to < from ? "earlier." : "later."],
      /* setAway writes the field now, and on this path focus is on the
         Undo control rather than the field, so its guard lets the write
         through. One writer, not two. */
      undo: function () { setAway(root, item, from); },
    });
  }

  /* Everything that states whether anyone is holding a copy, written
     from the one record, in one place. */
  function paintPublication(root) {
    if (!root) return;
    var live = F.publication.state === "published";
    var shared = root.querySelector(".b-shared");
    if (shared) {
      shared.textContent = live
        ? "Live since " + F.fmt.medium(F.publication.publishedAt)
          + " \u00b7 anyone with the link can read it"
        : "Only you can see this";
    }
    var verb = root.querySelector('[data-act="publish"]');
    if (verb) verb.textContent = live ? "Get the link" : "Publish";
    var stamp = root.querySelector(".b-stamp");
    if (stamp) stamp.textContent = "Updated " + F.updatedLabel;
  }

  function moveUndoBar(root, into) {
    var bar = root.querySelector(".b-undo");
    if (!bar) return;
    if (into) into.insertBefore(bar, into.firstChild);
    else {
      var host = root.querySelector(".b-undoHome") || root;
      host.appendChild(bar);
    }
  }

  /* Called wherever the bar changes host or fill: its band can only be
     measured once it is where it will be painted. */
  function reserveUndo(root) {
    if (!root) return;
    var bar = root.querySelector(".b-undo");
    if (!bar || bar.getAttribute("data-empty") === "true"
      || getComputedStyle(bar).position !== "fixed") {
      root.style.removeProperty("--b-undo");
      return;
    }
    root.style.setProperty("--b-undo", (bar.offsetHeight + 24) + "px");
  }

  function closeEditor(root, focusBack) {
    var open = root.querySelector('.b-item[data-editing="true"]');
    var node = root.querySelector(".b-edit");
    /* The bar comes home BEFORE the panel is removed, or the one
       reversibility surface is destroyed with it and paintUndo has
       nothing to find for the rest of the mount. */
    moveUndoBar(root, null);
    if (node) node.remove();
    root.removeAttribute("data-editor-open");
    root.style.removeProperty("--b-sheet");
    if (!open) return;
    open.removeAttribute("data-editing");
    var grab = open.querySelector(".b-grab");
    if (grab) grab.setAttribute("aria-expanded", "false");
    place(root.querySelector(".b-measure"));
    /* The bar has just come home to a different host, so its band is
       re-measured where it now sits. */
    reserveUndo(root);
    if (focusBack && grab) land(grab, root);
  }

  /* A fixed sheet stands outside layout, so the column it covers has to
     be given the room back or the last rows are unreachable at maximum
     scroll. Measured from the sheet's real top rather than its height,
     because a filled undo bar raises the sheet 76px and the height alone
     left the reserve 52px short of the band actually covered. Called on
     open AND on every settle, so narrowing a window while the editor is
     open cannot dock the sheet over an unreserved column. */
  function reserve(root) {
    if (!root) return;
    var node = root.querySelector(".b-edit");
    if (!node) { root.style.removeProperty("--b-sheet"); return; }
    if (getComputedStyle(node).position !== "fixed") {
      root.style.removeProperty("--b-sheet");
      return;
    }
    var top = node.getBoundingClientRect().top;
    root.style.setProperty("--b-sheet", Math.max(0, Math.ceil(window.innerHeight - top + 24)) + "px");
  }

  function openEditor(root, item) {
    /* The badge on an open row still announces aria-expanded="true"
       over a panel it names by id, so refusing the press is a control
       declaring a state and then not honouring it - and it stranded the
       keyboard, because the panel precedes the rows in DOM order and
       the only route back was Shift+Tab through every row above. Hand
       over to the panel it names instead. land() is the one place that
       moves focus without moving the page unless the target is off
       screen. */
    if (item.getAttribute("data-editing") === "true") {
      land(root.querySelector("#b-edit"), root);
      return;
    }
    closeEditor(root, false);
    var node = editor(root, item);
    (root.querySelector(".b-editHost") || item.parentElement).appendChild(node);
    moveUndoBar(root, node);
    item.setAttribute("data-editing", "true");
    root.setAttribute("data-editor-open", "true");
    var grab = item.querySelector(".b-grab");
    if (grab) grab.setAttribute("aria-expanded", "true");
    place(root.querySelector(".b-measure"));
    reserve(root);
    keepInBand(root, item);
    node.focus({ preventScroll: true });
  }

  /* One place that hands focus over, and it never moves the page to do
     it. Everything below goes through here: the browser scrolls to
     whatever takes focus, which threw the surface hundreds of pixels
     after a delete, and the way back restored the moment without
     restoring the view. Where the target genuinely is off screen, the
     page is nudged by the same math the editor already uses. */
  function land(target, root) {
    if (!target) return;
    target.focus({ preventScroll: true });
    var box = target.getBoundingClientRect();
    if (box.bottom > 0 && box.top < window.innerHeight) return;
    var item = target.closest ? target.closest(".b-item") : null;
    if (item && root) keepInBand(root, item);
    else target.scrollIntoView({ block: "nearest" });
  }

  function focusAfterRemoval(root, next) {
    land((next && next.isConnected && next.querySelector(".b-grab"))
      || root.querySelector(".b-item .b-grab")
      || root.querySelector('[data-act="add"]'), root);
  }

  function wireOwner(root, opts) {
    var o = opts || {};

    root.addEventListener("click", function (event) {
      var grab = event.target.closest(".b-grab");
      if (grab) { openEditor(root, grab.closest(".b-item")); return; }
      var action = event.target.closest("[data-act]");
      if (!action) return;
      var name = action.getAttribute("data-act");
      if (name === "done") { closeEditor(root, true); return; }
      if (name === "delete") {
        var item = root.querySelector('.b-item[data-editing="true"]');
        if (!item) return;
        var measureEl = item.parentElement;
        var record = recordFor(item.getAttribute("data-id"));
        var index = F.milestones.indexOf(record);
        var next = item.nextElementSibling;
        closeEditor(root, false);
        holdingPlace(root, function () {
          item.remove();
          if (index >= 0) F.milestones.splice(index, 1);
          place(measureEl);
        });
        focusAfterRemoval(root, next);
        /* The live node is kept, not its markup: setAway writes the
           owner's edits to the DOM, so rebuilding from the record would
           restore a moment they never had. */
        remember(root, {
          id: record.id,
          say: [briefly(record) + " was removed."],
          undo: function () {
            holdingPlace(root, function () {
              if (index >= 0) F.milestones.splice(index, 0, record);
              measureEl.insertBefore(item, next && next.isConnected ? next : null);
              place(measureEl);
            });
            land(item.querySelector(".b-grab"), root);
          },
        });
        return;
      }
      if (name === "add") {
        var host = root.querySelector(".b-measure");
        var clock = host.getAttribute("data-clock") || F.today;
        var first = ahead(clock)[0];
        var away = Math.max(1, (first ? daysFrom(clock, first.date) : 8) - 7);
        var fresh = {
          id: "moment-" + (++minted),
          title: "",
          date: F.plusDays(clock, away),
          state: "next",
        };
        /* The publication record does NOT move: adding a moment to a
           plan people are already holding cannot un-hand it to them. A
           brand-new plan is made a draft where it is created, before
           go(). The stamp is remember()'s to write, for every change. */
        F.milestones.push(fresh);
        var node = row(fresh, away, true);
        host.insertBefore(node, host.querySelector(".b-item"));
        place(host);
        openEditor(root, node);
        var input = root.querySelector("#b-edit-title");
        if (input) { input.value = ""; input.focus({ preventScroll: true }); }
        remember(root, {
          id: fresh.id,
          say: ["A moment was added."],
          undo: function () {
            closeEditor(root, false);
            node.remove();
            F.milestones.splice(F.milestones.indexOf(fresh), 1);
            place(host);
          },
        });
        return;
      }
      if (name === "copy") {
        var live = root.querySelector(".b-live");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(F.shareUrlFull).then(function () {
            action.textContent = "Copied";
            if (live) live.textContent = "Link copied.";
            setTimeout(function () { action.textContent = "Copy the link"; }, 2000);
          }, function () {
            if (live) live.textContent = "Copy did not work. Select the link and copy it by hand.";
          });
        } else if (live) {
          live.textContent = "Copy did not work. Select the link and copy it by hand.";
        }
        return;
      }
      /* The owner's most repeated loop is: find a row, change it, check
         what the guest sees, come back, next row - and the return leg
         threw the plan back to the top every time. The row's ID is kept,
         not only the offset: the plan can be shorter on return, after a
         hide or a delete, and a raw offset then lands on the wrong row. */
      if (name === "preview") { cameFromOwner = true; markPlace(root); go("desk"); return; }
      if (name === "publish") { cameFromOwner = true; markPlace(root); go("publish"); return; }
      if (name === "owner") { cameFromOwner = false; go("owner-flight"); }
    });

    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { closeEditor(root, true); return; }
      var grab = event.target.closest(".b-grab");
      if (grab && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openEditor(root, grab.closest(".b-item"));
      }
    });

    /* On document, not on the field: after a delete used to drop focus
       to the body, a root-bound listener meant the advertised key was
       dead for the rest of the session. */
    if (!wireOwner.keys) {
      wireOwner.keys = true;
      document.addEventListener("keydown", function (event) {
        /* The artifact that is not on screen keeps its DOM, and with it a
           .b-undo this would find. A product's keys are its own. */
        if (!window.__SUITE.active("timeline")) return;
        var key = (event.key || "").toLowerCase();
        if (key !== "z" || !(event.ctrlKey || event.metaKey) || event.shiftKey) return;
        var el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
        var live = document.querySelector(".b-undo");
        if (!live) return;
        event.preventDefault();
        undo(live.closest(".b-field") || document.body);
      });
    }

    /* At desk width the horizon is pinned while the plan scrolls past
       it, and after a screen it was still announcing the empty stretch
       before the first moment - a sentence about a part of the plan no
       longer on screen. It now names the nearest tick above the fold,
       from the same accessors every other figure comes from. */
    var note = root.querySelector(".b-gapNote");
    if (note) {
      var stick = root.querySelector(".b-stick");
      var pane = root.querySelector(".b-plan");
      var pending = false;
      var speak = function () {
        pending = false;
        /* Where there is no pinned column there is no scrolled
           reading, but this is still the only writer of the node - so
           it paints the at-rest sentence rather than returning and
           leaving whatever was there last. */
        if (!stick || getComputedStyle(stick).position !== "sticky") {
          if (root.__gapAtRest && note.textContent !== root.__gapAtRest) {
            note.textContent = root.__gapAtRest;
          }
          return;
        }
        var rows = root.querySelectorAll(".b-measure .b-item");
        /* Against the PANE's own top edge, not the viewport's. Once the
           plan became a pane the window stopped scrolling, so a
           viewport-relative test named a row that had been scrolled out
           of the pane - the horizon reporting a moment nobody could
           see. */
        var edge = pane && getComputedStyle(pane).overflowY === "auto"
          ? pane.getBoundingClientRect().top : 0;
        var top = null;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].getBoundingClientRect().top >= edge) { top = rows[i]; break; }
        }
        /* Read the sentence live, never from a snapshot. This used to
           restore the string captured when the surface was wired, so
           moving the first moment and then scrolling down and back
           repainted a sentence that was no longer true. Both writers of
           this node now derive from gapSentence(), so it cannot outlive
           the fact it describes. */
        if (!rows.length) return;
        var said = !top || top === rows[0]
          ? (root.__gapAtRest || gapSentence(rows[0].getAttribute("data-date")))
          : F.fmt.medium(top.getAttribute("data-date")) + " \u00b7 "
            + F.fmt.dayCount(Number(top.getAttribute("data-away"))) + " away";
        if (note.textContent !== said) note.textContent = said;
      };
      /* place() repaints this node; it needs the scrolled reading back. */
      root.__gapSpeak = function () {
        speak();
        /* keepInBand moves the pane on the NEXT frame after a repaint,
           so the reading is taken again once it has settled. */
        requestAnimationFrame(speak);
      };
      var onScroll = function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(speak);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      if (pane) pane.addEventListener("scroll", onScroll, { passive: true });
      var rail = root.querySelector(".b-stick");
      var onFold = function () { markFolds(root); };
      if (pane) pane.addEventListener("scroll", onFold, { passive: true });
      if (rail) rail.addEventListener("scroll", onFold, { passive: true });
      requestAnimationFrame(onFold);
    }

    /* The editor is docked, not modal: the page may scroll under it, and
       nothing is trapped. But a fixed panel is invisible to the
       browser's own scrolling - a row underneath it counts as on screen
       - so tabbing past the last control in the panel used to land on
       buttons a keyboard owner could not see. Focus is followed, not
       fenced: anything that takes it and is standing behind the sheet is
       brought out from behind it. */
    root.addEventListener("focusin", function (event) {
      var panel = root.querySelector(".b-edit");
      if (!panel || getComputedStyle(panel).position !== "fixed") return;
      var el = event.target;
      if (!el || panel.contains(el)) return;
      var box = el.getBoundingClientRect();
      var free = panel.getBoundingClientRect().top;
      if (box.bottom <= free) return;
      window.scrollBy(0, Math.round(box.bottom - free + 16));
    });

    var undoAct = root.querySelector(".b-undoAct");
    if (undoAct) undoAct.addEventListener("click", function () { undo(root); });

    /* Deferred to after the mount: getComputedStyle on a node that is
       not in the document yet reports static for everything, so the
       sheet would never know it was a sheet and would reserve nothing. */
    if (o.open) {
      requestAnimationFrame(function () {
        var target = root.querySelector('.b-item[data-id="' + o.open + '"]');
        if (!target) return;
        openEditor(root, target);
        /* The one surface the measured gate could never see. The
           reversibility bar is display:none or visibility:hidden in
           every other state, so nothing about the product's way out
           of a mistake - its hit target, its letterfit, its contrast
           - had ever been graded, and both defects found there this
           round were found by hand. This state pushes one real entry
           so the bar renders filled on load and stands inside the
           measured perimeter from now on. */
        if (o.undone) {
          requestAnimationFrame(function () {
            var step = root.querySelector('.b-step[data-delta="7"]');
            if (step) step.click();
          });
        }
      });
    }
  }

  var cameFromOwner = false;
  function F_PUBLISHED() { return F.publication.state === "published"; }
  var SAID = {
    desk: "The plan as guests will see it.",
    /* "Ready to send" contradicted the plan's own status line and the
       card beside it, both of which say it went out on 15 July. */
    /* It said "below" while the link sat a hundred pixels ABOVE it, on
       the one screen where the owner is looking for exactly that. The
       line names the act instead of the direction. */
    publish: function () {
      return F_PUBLISHED()
        ? "Ready to copy."
        : "Ready to send. Copy the link to hand it over.";
    },
    "owner-flight": "Back to the plan.",
  };

  /* A change of surface used to leave focus on the body with nothing
     said, so three of the owner's five top-level actions were silent
     screen changes for anyone not using a mouse. The heading is made
     focusable HERE rather than in the state builders, so a guest
     loading the artifact directly still gets it untouched. */
  function go(state) {
    C.rootEl().setAttribute("data-state", state);
    C.mount();
    var root = document.querySelector(".b-field");
    if (!root) return;
    var head = root.querySelector(".b-pressTitle") || root.querySelector(".b-who");
    if (head) {
      head.setAttribute("tabindex", "-1");
      head.focus({ preventScroll: true });
    }
    var live = document.querySelector(".b-live");
    /* A value may be a function, because the publish strap depends on
       whether anyone is holding a copy YET - read at load time it
       announced the published wording to an owner still in draft. */
    var said = SAID[state];
    if (live && said) live.textContent = typeof said === "function" ? said() : said;
  }

  /* ── the states ───────────────────────────────────────────────── */

  var states = {};

  /* Where the owner was standing when they left for the guest's view.
     Held as a row id first and offsets second: the plan can be shorter
     on return, after a hide or a delete, and a raw offset then clamps
     onto whatever row happens to be there instead. */
  var placeMark = null;
  function markPlace(root) {
    var pane = paneOf(root);
    var rows = root ? [...root.querySelectorAll(".b-measure:not(.b-back) .b-item")] : [];
    var edge = pane ? pane.getBoundingClientRect().top : 0;
    var seen = rows.filter(function (el) {
      return el.getBoundingClientRect().bottom > edge + 8;
    })[0];
    placeMark = {
      y: window.scrollY,
      pane: pane ? pane.scrollTop : null,
      id: seen ? seen.getAttribute("data-id") : null,
      /* Where in the frame that row was sitting, so the return puts it
         back at the same height rather than flush to the top edge -
         being returned to the right row at the wrong offset still reads
         as a jump. */
      at: seen ? seen.getBoundingClientRect().top : 0,
    };
  }
  /* Restored after the remount, on the frame the rows actually exist. */
  function takePlace(root) {
    var mark = placeMark;
    placeMark = null;
    if (!mark || !root) return;
    requestAnimationFrame(function () {
      var row0 = mark.id && root.querySelector('.b-item[data-id="' + mark.id + '"]');
      var pane = paneOf(root);
      if (row0) {
        var box = row0.getBoundingClientRect();
        if (pane) pane.scrollTop += box.top - pane.getBoundingClientRect().top - 16;
        else window.scrollBy(0, box.top - mark.at);
        return;
      }
      if (pane && mark.pane !== null) pane.scrollTop = mark.pane;
      else window.scrollTo(0, mark.y);
    });
  }

  function ownerSurface(opts) {
    var node = field([
      bar(F.project.name, [
        act("Add a moment", false, { "data-act": "add" }),
        act("Preview", false, { "data-act": "preview" }),
        /* The verb branches on whether anyone is already holding a copy.
           On a plan whose own line four pixels below reads "Live since
           15 July", the primary control said "Publish" - offering to do
           a thing that had already been done, on the screen where the
           owner is closest to giving the plan away. */
        act(F.publication.state === "published" ? "Get the link" : "Publish",
          true, { "data-act": "publish" }),
      ]),
      h("p.b-live.b-vh", { role: "status", text: "" }),
      /* The owner was never told anyone was holding a copy of the plan
         they keep editing: the surface was byte-identical before and
         after publishing. */
      h("p.b-shared", {
        text: F.publication.state === "published"
          ? "Live since " + F.fmt.medium(F.publication.publishedAt)
            + " \u00b7 anyone with the link can read it"
          : "Only you can see this",
      }),
      h("div.b-two", {}, [
        h("div.b-stick", { style: "line-height:1.5" }, [
          horizon({}), h("div.b-editHost"), h("div.b-undoHome", {}, [undoBar()]),
        ]),
        /* The owner's plan is its own pane at desk width. The lock says
           the horizon never moves and stops scrolling there; done with
           sticky alone the rail still drifted 191px before it stuck,
           which is why a prior round refused to scroll the window at
           all - and the moment being moved then walked off the bottom
           of the screen after two presses while the owner kept pressing.
           A pane the rail is not inside solves both: the plan scrolls,
           the steppers never move under the hand. */
        h("div.b-plan", { style: "line-height:1.5" }, [
          measure({ owner: true }), behindBlock({ owner: true }),
        ]),
      ]),
      foot({}),
    ], ".b-ownerField");
    wireOwner(node, opts || {});
    return node;
  }

  states.phone = function () {
    return h("div.tl-device", {}, [
      field([
        horizon({ keeper: true }), measure({ medium: "phone" }),
        behindBlock({}), foot({ keeper: false }),
      ]),
    ]);
  };

  states.desk = function () {
    /* At desk width the horizon holds the left and stops scrolling, and
       the approach runs down the right. Seeing both at once is the one
       thing a phone cannot give the reader. */
    var artifact = h("div.tl-paperEdge", { style: "border-color:var(--fore-16)" }, [
      field([
        h("div.b-two", {}, [
          h("div.b-stick", { style: "line-height:1.5" }, [horizon({})]),
          h("div", { style: "line-height:1.5" }, [measure({ medium: "full" }), behindBlock({})]),
        ]),
        foot({}),
      ]),
    ]);
    if (!cameFromOwner) return artifact;
    /* The way back lives OUTSIDE the audience artifact, and only when
       the owner arrived here by pressing Preview. Loading this state
       directly is byte-identical to what a guest gets. */
    var node = h("div", {}, [
      h("div.b-previewStrip", {}, [
        h("span.b-where", { text: "Preview" }),
        h("p.b-live.b-vh", { role: "status", text: "" }),
        act("Back to the plan", false, { "data-act": "owner" }),
      ]),
      artifact,
    ]);
    node.addEventListener("click", function (event) {
      if (event.target.closest('[data-act="owner"]')) { cameFromOwner = false; go("owner-flight"); }
    });
    return node;
  };

  states["owner-flight"] = function () {
    var built = ownerSurface({});
    /* On the frame after the rows exist, put the owner back where they
       were standing when they left to look at the guest's view. */
    requestAnimationFrame(function () { takePlace(document.querySelector(".b-field")); });
    return built;
  };
  states["owner-editing"] = function () {
    return ownerSurface({ open: "demo-audience-item-invitations" });
  };

  /* A plan nobody is holding yet. The publication record is
     fixture-wide, so the draft half of every publication branch - the
     status line, the primary verb, the press heading and strap - had
     never been rendered in any graded state. */
  states["owner-draft"] = function () {
    /* Committed, not borrowed. Handing the record back before anyone
       could press anything made the draft branch true only until it was
       touched - pressing Publish from here landed on "Mara & Finn have
       had this since 15 July", the wording reserved for a plan somebody
       is already holding. Every state is entered by a fresh load, so a
       committed mutation cannot leak into another graded frame; this is
       exactly what the first-run path already does. */
    F.publication = { state: "draft", publishedAt: null };
    F.updatedLabel = F.fmt.medium(F.today) + " " + F.fmt.year(F.today);
    return ownerSurface({});
  };

  /* Editing, one move in, with the way back showing. */
  states["owner-undone"] = function () {
    return ownerSurface({ open: "demo-audience-item-invitations", undone: true });
  };

  /* Enter commits the day. It is the first field the product ever
     offers and the return key did nothing in it, while the same key
     commits in the editor's date field. Delegated to the button so every
     refusal sentence, the aria-invalid write, the screen replacement and
     the focus move are inherited rather than duplicated; event.repeat
     stops a held key committing and then pressing what it focuses. */
  function wireFirstField(node) {
    var input = node.querySelector("#b-empty-date");
    if (!input || input.__wired) return;
    input.__wired = true;
    input.setAttribute("enterkeyhint", "go");
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return;
      event.preventDefault();
      var press = node.querySelector('[data-act="setday"]');
      if (press) press.click();
    });
  }

  states["owner-empty"] = function () {
    var sibling = F.siblings[1];      /* Aisling & Tom — real, and genuinely empty */
    var started = null;
    var node = field([
      bar(sibling.name, [inert("Nothing to preview yet")]),
      h("div.b-empty", {}, [
        h("h1.b-who", { text: sibling.name }),
        h("p.b-emptyTitle", { "data-type": "headline", text: "When is the day?" }),
        /* "plan", not "page". This was the only string in the product
           that called the object a page - and it is the first sentence
           a new owner ever reads, on the screen where they are learning
           what the thing is called. */
        h("p.b-emptyBody", { text: "Everything on this plan is measured from it, so it is the only thing needed to start." }),
        h("div.b-emptyForm", {}, [
          h("label.b-label", { for: "b-empty-date", text: "The day" }),
          h("input.b-input", {
            id: "b-empty-date", type: "text", "data-mono": "true",
            style: "max-width:240px", "aria-describedby": "b-empty-hint",
          }),
          act("Set the day", true, { "data-act": "setday" }),
        ]),
        /* The format lives in a line that survives typing, not in a
           placeholder that vanishes at the first keystroke. */
        h("p.b-hint#b-empty-hint", { role: "status", text: "For example, 3 October 2026." }),
      ]),
      foot({ stamp: false }),
    ], "", sibling.name);
    wireFirstField(node);
    node.addEventListener("click", function (event) {
      /* The owner's very first action in the product. It used to be a
         focused primary button that did nothing at all, on the one
         screen that had just told them moments come next. The plan this
         opens is genuinely theirs: a project with one day in it and one
         untitled moment, not the demonstration plan. */
      if (event.target.closest('[data-act="add"]') && started) {
        F.project.name = sibling.name;
        /* No invented label. An empty string is the honest value for a
           day nobody has named, and every consumer now guards it rather
           than printing a placeholder as though the owner wrote it. */
        F.project.primaryDate = { label: "", date: started };
        /* A plan created two seconds ago has never been handed to
           anyone. The publication record is fixture-wide, so without
           this the owner's first screen claimed "Live since 15 July",
           offered "Get the link" and carried a stamp from before the
           project existed. Set before go(), so the surface renders the
           draft branch rather than being corrected after the fact. */
        F.publication = { state: "draft", publishedAt: null };
        F.updatedLabel = F.fmt.medium(F.today) + " " + F.fmt.year(F.today);
        var half = Math.max(1, Math.round(F.days(F.today, started) / 2));
        F.milestones.length = 0;
        /* The counter resets with the array, so a fresh project reads
           moment-1, moment-2, moment-3 rather than continuing from the
           demonstration fixture is length. */
        minted = 1;
        F.milestones.push({
          id: "moment-1", title: "", date: F.plusDays(F.today, half), state: "next",
        });
        cameFromOwner = false;
        go("owner-flight");
        /* Keyed to the transition, not the destination: this owner has
           no plan to be back to. Same string the same action uses on a
           plan that already exists. */
        var live0 = document.querySelector(".b-live");
        if (live0) live0.textContent = "A moment was added.";
        var host = document.querySelector(".b-measure");
        var first = host && host.querySelector(".b-item");
        if (first) {
          openEditor(document.querySelector(".b-field"), first);
          var field = document.querySelector("#b-edit-title");
          if (field) field.focus({ preventScroll: true });
        }
        return;
      }
      if (!event.target.closest('[data-act="setday"]')) return;
      var input = node.querySelector("#b-empty-date");
      var hint = node.querySelector("#b-empty-hint");
      /* Three answers, three sentences - the same three the editor
         gives. One refusal for an empty field, an unreadable date and a
         day that has already gone told a typist to type. */
      var typed = (input.value || "").trim();
      var iso = F.parseDay(typed);
      if (iso && F.days(F.today, iso) >= 1) {
        input.setAttribute("aria-invalid", "false");
        hint.textContent = "The day is set. Moments come next.";
        /* The question is answered, so the screen stops asking it. It
           used to leave the heading, the field and the button exactly
           as they were and append a sentence under the button, which is
           a form that congratulates you and then offers nothing. */
        var empty = node.querySelector(".b-empty");
        var away = F.days(F.today, iso);
        var next = h("div.b-empty", {}, [
          h("h1.b-who", { text: sibling.name }),
          countBlock(away),
          h("p.b-when", { "data-type": "date", text: F.fmt.longYear(iso) }),
          /* The second screen a new owner ever sees showed a count and a
             ceremonial date and stated today NOWHERE - the unanchored-time
             class, on the one screen with nothing else on it to read the
             date against. Same rule and same label the horizon uses. */
          h("div.b-todayRule"),
          h("p.b-todayLabel", { text: "Today is " + F.fmt.medium(F.today) }),
          h("p.b-emptyBody", {
            text: "Nothing sits between today and the day yet. "
              + "Everything you add is measured from it.",
          }),
          h("div.b-emptyForm", {}, [act("Add a moment", true, { "data-act": "add" })]),
          h("p.b-hint#b-empty-hint", { role: "status", text: "The day is set. Moments come next." }),
        ]);
        empty.parentElement.replaceChild(next, empty);
        var onward = next.querySelector('[data-act="add"]');
        if (onward) onward.focus({ preventScroll: true });
        started = iso;
        return;
      }
      input.setAttribute("aria-invalid", "true");
      hint.textContent = !typed
        ? "Type the day first. For example, 3 October 2026."
        : (!iso
          ? "That is not a date. Try 3 October 2026."
          : "That day has gone. Pick one still ahead.");
      input.focus();
    });
    return node;
  };

  /* The page says "select the link and copy it by hand" when the
     clipboard refuses. It has to be possible to do that with a
     keyboard, so the link takes focus and selects itself. */
  /* An opaque token has no seam that carries meaning, so every seam is
     free - and a break offered every ten characters means no line is
     ever a four-character sliver at any width. */
  function breakable(text) {
    var out = [];
    for (var i = 0; i < text.length; i += 10) {
      if (i) out.push(h("wbr"));
      out.push(text.slice(i, i + 10));
    }
    return out;
  }

  function selectAll(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var pick = window.getSelection();
    pick.removeAllRanges();
    pick.addRange(range);
  }

  /* The day the plan was actually handed over, or null when that has not
     happened yet - the SAME test pressHead() uses, so the headline, the
     card and the caption can never disagree about whether a send has
     occurred. */
  function sentDay() {
    var at = F.publication.publishedAt;
    return at && F.days(String(at).slice(0, 10), F.today) >= 1
      ? String(at).slice(0, 10)
      : null;
  }

  function card() {
    /* Measured from the day it CLAIMS. The figure was built from today
       and captioned "when this was sent", so on a plan sent yesterday
       the two largest figures on the publish screen disagreed by a day
       and the caption between them was what made it legible. */
    var sent = sentDay();
    var said = F.countdown(F.days(sent || F.today, F.project.primaryDate.date));
    var when = F.fmt.longYear(F.project.primaryDate.date);
    /* A chat client caches a preview at the moment it is sent, so the
       card has to be true a month later. The figure stays, because the
       distance IS the product, and the sentence under it says when it
       was true. */
    var figure = said.state === "ahead"
      ? [h("p.b-ogNum.num", { text: said.num }),
        /* The qualifier only when there is a send to qualify. Before one,
           the figure is simply the distance, and the screen's own
           headline says sending comes next. */
        h("p.b-ogDate", { text: said.unit + (sent ? " away when this was sent" : " away") })]
      : [h("p.b-ogWord", { text: said.state === "today" ? said.word : "The day" }),
        h("p.b-ogDate", { text: when })];
    /* Named with the very strings it paints, so the name and the picture
       cannot drift: the figure carried "when this was sent" on screen
       while the name said "79 days to", dropping the one qualifier that
       keeps a cached preview honest a month later. */
    var figureSaid = said.state === "ahead"
      ? said.num + " " + said.unit + (sent ? " away when this was sent" : " away")
      : (said.state === "today" ? said.word : "The day");
    return h("a.b-unfurl", {
      href: F.shareUrlFull,
      /* Built from what the card shows. An aria-label on an anchor
         REPLACES its contents, so the 64px figure and the date were
         announced to nobody. */
      "aria-label": F.project.name + ", " + figureSaid + ". "
        + (F.project.primaryDate.label ? F.project.primaryDate.label + ", " : "") + when,
    }, [
      h("div.b-og", {}, [
        h("p.b-ogWho", { text: F.project.name }),
        h("div", { style: "line-height:var(--lead-display)" }, figure),
      ]),
      h("div.b-unfurlMeta", {}, [
        /* The break may fall after the comma and nowhere else. Left to
           itself it split the date between the weekday and the day
           number - "Wedding day, Saturday" / "3 October 2026" - on the
           preview of the card that is the product's first impression
           inside a message. */
        /* The card that lands in someone's message names the day only
           if the day has a name; otherwise the date carries it alone,
           rather than announcing "The day, Saturday 3 October 2026". */
        h("p.b-unfurlTitle", {}, [
          F.project.primaryDate.label
            ? document.createTextNode(F.project.primaryDate.label + ", ")
            : document.createTextNode(""),
          h("span", { style: "white-space:nowrap", text: when }),
        ]),
        h("p.b-unfurlHost", { text: "timeline.signalstudio.ie" }),
      ]),
    ]);
  }

  /* One sentence, one writer. "Have had this since" is the present
     perfect: it states elapsed possession, and at the instant of
     publishing the elapsed time is zero and nobody has been handed
     anything - copying a link to your own clipboard is not sending it.
     So the day of publication gets its own sentence, and it says what
     the strap beside it has always said: sending comes next. The day
     AFTER, the original sentence is true and is the one round 7
     ratified. */
  function pressHead() {
    var since = F.publication.publishedAt ? F.days(F.publication.publishedAt, F.today) : -1;
    if (since >= 1) {
      return F.project.name + " have had this since "
        + F.fmt.medium(F.publication.publishedAt) + ".";
    }
    if (since === 0) return F.project.name + " can open this as soon as you send it.";
    return "Send it to " + F.project.name + ".";
  }

  /* One writer. Taking the link IS the handover in this model, so the
     record, the heading the owner is looking at, and everything the
     owner surface paints on return all move together, once. */
  function takeTheLink(node) {
    if (F.publication.state === "published") return false;
    F.publication = { state: "published", publishedAt: F.today };
    var head = node && node.querySelector(".b-pressTitle");
    if (head) head.textContent = pressHead();
    return true;
  }

  states.publish = function () {
    var node = field([
      bar(F.project.name, [act("Back to the plan", false, { "data-act": "owner" })]),
      h("div.b-press", {}, [
        h("div", { style: "line-height:1.5" }, [
          h("p.b-who", { text: "What lands in the message" }),
          /* The card is a fixed asset that lands in somebody else's
             chat client, so it is shown on a plate rather than floating
             on the owner's own ground, where it painted ink on ink. */
          h("div.b-chat.b-chatPlate", { style: "margin-top:14px" }, [card()]),
        ]),
        h("div", { style: "line-height:1.5" }, [
          h("p.b-who", { text: "The link" }),
          /* The screen stops pretending this is a first send. When the
             plan is already live the fact is the headline - the card
             beside it already says "when this was sent" - and the act
             on offer is the one that is actually available. */
          h("h1.b-pressTitle", { "data-type": "headline", text: pressHead() }),
          h("p.b-pressBody", {
            text: "It carries the day, the distance and the plan, and nothing "
              + "else: no notes, no suppliers, no prices.",
          }),
          /* The page says "select the link and copy it by hand" when the
             clipboard refuses, and the link was a bare span with no tab
             stop - an instruction the product did not support. A
             readonly field is built and functional, so it may hold
             focus. The break is at the midpoint rather than wherever
             the box runs out: an opaque token has no seam that means
             anything, so any break is free and a four-character orphan
             is not. */
          h("div.b-linkRow", {}, [
            h("span.b-linkField", {
              tabindex: "0",
              role: "textbox",
              "aria-readonly": "true",
              "aria-label": "The link, ready to select",
              on: {
                focus: function (event) { selectAll(event.target); },
                click: function (event) { selectAll(event.target); },
              },
            }, breakable(F.shareUrlFull)),
          ]),
          h("div.b-barActs", {}, [
            act("Copy the link", true, { "data-act": "copy" }),
            inert("Sending comes next"),
          ]),
          h("p.b-live", { role: "status", text: "" }),
          h("p.b-note", { text: "You can turn the link off at any time. Anyone holding it then sees that it has ended." }),
        ]),
      ]),
    ]);
    node.addEventListener("click", function (event) {
      var action = event.target.closest("[data-act]");
      if (!action) return;
      if (action.getAttribute("data-act") === "owner") { cameFromOwner = false; go("owner-flight"); return; }
      if (action.getAttribute("data-act") !== "copy") return;
      var live = node.querySelector(".b-live");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(F.shareUrlFull).then(function () {
          var first = takeTheLink(node);
          action.textContent = "Copied";
          /* The heading changes silently — it is already focused, so a
             rewrite announces nothing. The one live region on this
             screen carries the fact instead. */
          /* Not "they can open this now" - they have not been given it.
             The one thing that IS true of a link on a clipboard is that
             whoever holds it can open the plan, which is the grammar
             the note and the owner surface already use. */
          live.textContent = first
            ? "Link copied. Anyone holding the link can open the plan."
            : "Link copied.";
          setTimeout(function () { action.textContent = "Copy the link"; }, 2000);
        }, function () {
          live.textContent = "Copy did not work. Select the link and copy it by hand.";
        });
      } else {
        live.textContent = "Copy did not work. Select the link and copy it by hand.";
      }
    });
    return node;
  };

  states.unfurl = function () {
    return h("div.b-chat", {}, [
      h("p.b-bubble", { text: "Here is everything, love. It updates itself." }),
      card(),
    ]);
  };

  /* The wedding morning. The count is a countdown, and a countdown that
     has arrived is a word, not a zero — so the word takes the count's
     slot rather than being demoted to a micro-label while the couple's
     name is promoted into the display register, which is the register
     swap round 2 caught. */
  states.day = function () {
    var clock = F.project.primaryDate.date;
    /* No sort. The record carries no time, so nothing here can promise
       the order they HAPPEN - but alphabetical was a promise of its own,
       and a false one: it printed dinner before drinks, and it made the
       one screen the company is judged by the only surface that
       disagreed with the phone and the printed sheet about the order of
       the very same four moments. Record order is what every other
       surface already prints. */
    var todayItems = F.live()
      .filter(function (m) { return m.date && daysFrom(clock, m.date) === 0; });
    return h("div.tl-device", {}, [
      field([
        h("div.b-dayWrap", {}, [
          h("h1.b-who", { text: F.project.name }),
          h("p.b-dayCount", { text: "Today" }),
          h("p.b-dayDate", { "data-type": "date", text: F.fmt.longYear(clock) }),
          h("div.b-dayRule"),
          h("p.b-dayNote", { text: "This is the day the plan was for." }),
        ]),
        /* Every moment dated on the day, not the first of them: a
           second thing on the wedding day used to make the wedding
           itself vanish from its own screen, because behind() excludes
           anything dated on the clock and nothing else rendered it. */
        todayItems.length ? h("section.b-dayNow", {}, [
          h("h2.b-behindLabel", { text: todayItems.length > 1 ? "Happening today" : "Happening now" }),
          h("div", {}, todayItems.map(function (m) {
            return h("p.b-dayNowTitle", { "data-type": "title", text: nameOf(m) });
          })),
        ]) : null,
        behindBlock({ clock: clock, back: true }),
        foot({ stamp: false }),
      ]),
    ]);
  };

  function printCode() {
    var made = window.__TLQR && window.__TLQR.svg;
    if (!made) return null;
    var block = h("div", {}, [
      h("p.b-printLinkLabel", { text: "Scan for the live plan" }),
      h("div.b-printCode", { role: "img", "aria-label": "Scan to open the plan online" }),
    ]);
    block.querySelector(".b-printCode").innerHTML = made;
    return block;
  }

  states.print = function () {
    return h("div.tl-paperEdge", { style: "min-height:1123px" }, [
      field([
        /* Print sets the horizon beside the measure and drops to ten
           pixels a day: A4 is 1123px and the screen scale runs off the
           bottom of it. The scale changes; the proportion between one
           gap and the next does not. */
        h("div.b-two", {}, [
          h("div", { style: "line-height:1.5" }, [
            horizon({ medium: "print" }),
            behindBlock({ print: true }),
            /* The footer is uppercase and this token is case-sensitive,
               so the only route back from paper used to be one nobody
               could type. It is set as data, in its own case-preserving
               block, in the column that had the room. */
            h("div.b-printLink", {}, [
              /* The sheet is the one surface with no way back: it goes
                 to the venue, the celebrant and the helpers, who are
                 exactly the people who never got the card in a message.
                 The typed URL stays, underneath, for anyone who wants
                 to read it - this is the route that can actually be
                 taken off paper. Generated at build time from the same
                 token, so there is no asset to lose and no library to
                 load. */
              printCode(),
              h("p.b-printLinkLabel", { text: "The plan stays online at" }),
              h("p.b-printLinkUrl", { text: F.shareUrlFull }),
            ]),
          ]),
          h("div", { style: "line-height:1.5" }, [measure({ medium: "print" })]),
        ]),
        foot({}),
      ], ".b-print"),
    ]);
  };

  states.ended = function () {
    return h("div.tl-device", {}, [
      field([
        h("div.b-ended", {}, [
          /* Every other guest surface gives its heading to the project,
             and the region here already announces the project by name,
             so withholding it from the heading protected nothing and
             only made the visible and the announced page disagree. The
             product name closes the page, as it does everywhere else. */
          h("p.b-who", { text: F.project.name }),
          /* True whether the link was turned off or simply ran out -
             the surface cannot tell the two apart and used to assert
             one of them. */
          /* Names the state rather than a malfunction, and uses the word
             publish already used for it one screen earlier - so the two
             surfaces stop carrying two names for one thing, and the
             product stops shipping the harsher of them. Still true
             whether the link was turned off or ran out. */
          h("h1.b-endedTitle", { "data-type": "headline", text: "This link has ended." }),
          /* The tense follows the clock. This was hardcoded past, so a
             link switched off in July told the couple's family that the
             most important day of their life was over - three months
             before it. */
          h("p.b-endedBody", {
            text: (F.toDay() > 0 ? "The day is " : "The day was ")
              + F.fmt.longYear(F.project.primaryDate.date) + ". "
              + "Ask " + F.workspace.owner + " for a new link.",
          }),
          /* One sentence, not two. The second clause existed only to
             walk back an alarm the headline no longer raises. */
          h("p.b-note", { text: "Nothing has been deleted." }),
          foot({ stamp: false, ended: true }),
        ]),
      ]),
    ]);
  };

  states.loading = function () {
    /* The horizon is reserved at its real height because its geometry is
       known before the data lands. The measure is NOT drawn: tick
       positions come from the dates, and a skeleton that invents them is
       a picture of a plan nobody has. */
    return h("div.tl-device", {}, [
      field([
        /* Sized to the real objects they stand for, measured at phone
           medium: the four bars used to stack to 174px under a comment
           claiming the horizon was reserved at its real height, which is
           271px. Nothing below the horizon is drawn, because tick
           positions come from the dates. */
        /* The name is not pending: the card the guest just tapped
           printed it, and the region here is already labelled with it.
           So it is set as the real heading, in the real rule, and
           cannot drift from the one the loaded page uses. */
        h("h1.b-who", { text: F.project.name }),
        /* Sized to the shape of what is coming, not to the width of the
           column. Four full-bleed bars stood in for 106, 107, 227 and
           188 pixels of ink - the only filled panels in a hairline
           product, and a mass that collapsed on arrival. */
        /* The count slab is DERIVED from the count it stands for, not a
           literal measured once against a 96px numeral. The display tier
           moves with the reader's own text size now, so a fixed 86 was a
           frame promising a figure 34px shorter than the one that
           arrives. 0.9 is the numeral's painted height against its own
           size at this face. */
        h("div.b-skel", {
          style: "width:107px;height:calc(var(--size-count) * 0.9);margin:0 0 10px -5px",
        }),
        h("div.b-skel", { style: "width:227px;height:26px;margin-bottom:8px" }),
        h("div.b-skel", { style: "width:188px;height:23px;margin-bottom:12px" }),
        h("div.b-skel", { style: "width:92px;height:15px" }),
        /* The same object, the same token, the same width as the page
           this frame is promising - not a hairline that resembles it. */
        h("div.b-todayRule", { style: "margin:26px 0 0" }),
        h("p.b-todayLabel", { text: "Today is " + F.fmt.medium(F.today) }),
        h("p.b-sub", { style: "margin-top:26px;line-height:1.5", text: "Bringing in what is ahead." }),
      ]),
    ]);
  };

  /* A load that has stopped arriving. Declared as its own state
     rather than fired by a timer, so it is photographed and graded
     deterministically; every reserved dimension is byte-identical to
     the loading frame, so nothing moves between the two faces. */
  states["loading-slow"] = function () {
    var node = states.loading();
    var field = node.querySelector(".b-field");
    field.setAttribute("aria-busy", "false");
    var says = node.querySelector(".b-sub");
    var STALLED = "This is taking longer than it should.";
    says.textContent = STALLED;
    var note = h("p.b-note", {
      text: "The plan has not been deleted, and the link still works.",
    });
    says.parentElement.appendChild(note);
    /* A live region of its own. The .b-field cannot serve as one: it
       contains the button being pressed, so announcing through it
       re-reads the whole screen back at the person who pressed it. */
    var live = h("p.b-live", { role: "status", "aria-live": "polite", text: "" });
    says.parentElement.appendChild(live);
    /* The only control on the only screen where the audience meets
       failure, and it did nothing at all - no row, no announcement, not
       even an acknowledgement that the product had tried. A guest
       pressing it in the evening on a phone had no way to tell whether
       anything happened. It now goes back to the honest loading face,
       says so, and comes back to the stalled face still telling the
       truth about what is and is not lost. */
    var button = act("Try again", false, { "data-act": "retry" });
    var trying = false;
    button.addEventListener("click", function () {
      if (trying) return;
      trying = true;
      field.setAttribute("aria-busy", "true");
      says.textContent = "Bringing in what is ahead.";
      note.style.display = "none";
      live.textContent = "Trying again.";
      window.setTimeout(function () {
        trying = false;
        field.setAttribute("aria-busy", "false");
        says.textContent = STALLED;
        /* The note is NOT restored: the live region below now carries
           that clause in the voice that is actually new, and restoring
           it printed the same ten words twice, one line apart. */
        live.textContent = "Still not arriving. The plan has not been deleted, and the link still works.";
      }, 1400);
    });
    says.parentElement.appendChild(h("div.b-barActs", {}, [button]));
    return node;
  };

  var MEDIUM = {
    "owner-flight": "full", "owner-empty": "full", "owner-editing": "full",
    "owner-undone": "full", "owner-draft": "full", publish: "full",
    phone: "phone", desk: "full", day: "phone", print: "sheet",
    unfurl: "card", ended: "phone", loading: "phone", "loading-slow": "phone",
  };

  window.__TLD.b = {
    name: "B · The Approach",
    medium: function (state) { return MEDIUM[state] || "full"; },
    /* Print is paper whatever the ground decision says. A home printer
       cannot make an ink page, and pretending otherwise would put a
       state in this lab that nobody can actually hold. */
    forces: function (state) { return state === "print" ? { ground: "paper" } : null; },
    render: function (state) {
      history.length = 0;
      var node = (states[state] || states.phone)();
      if (state === "loading") {
        var f = node.querySelector(".b-field");
        if (f) f.setAttribute("aria-busy", "true");
      }
      /* The orientation control. Delegated on the freshly built tree, so
         it works in every state that draws a measure — the owner's plan
         and the guest's desk both — without either of them knowing about
         it. It writes the decision where every other decision lives and
         asks for a remount; nothing else in the page has to change. */
      node.addEventListener("click", function (event) {
        var btn = event.target.closest && event.target.closest("[data-layout-to]");
        if (!btn) return;
        var to = btn.getAttribute("data-layout-to");
        if (C.rootEl().getAttribute("data-layout") === to) return;
        C.rootEl().setAttribute("data-layout", to);
        C.mount();
        /* The control the press landed on is rebuilt, so focus is put
           back on its replacement rather than dropped to the body. */
        var back = document.querySelector('[data-layout-to="' + to + '"]');
        if (back) back.focus({ preventScroll: true });
        var say = document.querySelector(".b-live");
        if (say) {
          say.textContent = to === "across"
            ? "The measure runs across the page."
            : "The measure runs down the page.";
        }
      });
      return node;
    },
    settle: function () {
      var all = document.querySelectorAll(".b-measure");
      for (var i = 0; i < all.length; i++) place(all[i]);
      /* The reserve is recomputed on every settle - render-core already
         runs this on the debounced resize and on fonts.ready - so a
         window narrowed while the editor is open cannot dock the sheet
         over a column that reserved nothing for it. */
      reserve(document.querySelector("[data-editor-open]"));
      markFolds(document.querySelector(".b-field"));
      /* And the reversibility band, for the same reason. It was measured
         once, when the bar was filled, and never again - so a window
         narrowed across the docked boundary kept the band the OTHER
         width produced, and at maximum scroll the opaque bar covered the
         foot with no scroll left to free it. reserveUndo returns early
         unless the bar is filled and fixed, so this is a no-op at every
         desk width and in every empty state. */
      reserveUndo(document.querySelector(".b-field"));
    },
  };
})();


/* ══ the decisions the URL carries ═══════════════════════════════
   The lab master's build.mjs put these on <body> and read five of them.
   Nothing may be authored onto <body> here, so the shipping room rides on
   the app element as markup, and the URL carries the two the suite's
   contract names: the state, and the ratified twin.

   ?ground=ink is "After dark" — the same four decisions read in the dark,
   and the room the founder asked for alongside the paper one. It is a
   deep link, not a toggle: there is no theme switch in this chrome. */
(function () {
  var q = window.__SUITE.params("timeline");
  var root = window.__SUITE.root("timeline");
  var presets = window.__elevate.presets;

  /* ── which way the measure runs ─────────────────────────────────
     A desk gets the whole approach in one frame; a phone gets the
     column, because a phone cannot hold the distance and drawing it
     across anyway would compress the proportion into a lie. The reader
     may say otherwise at any time, and ?layout= says it for them.

     Decided ONCE, at load, from the width the reader actually has —
     not re-decided on resize. An orientation that flips itself under a
     hand mid-read is a surface that overrules a choice the reader has
     already made. */
  var asked = q.get("layout");
  root.setAttribute(
    "data-layout",
    asked === "across" || asked === "down"
      ? asked
      : (window.innerWidth >= 1024 ? "across" : "down"),
  );
  /* ?ground= is the suite's name for it and ?v= is the lab's name for the
     same room, so the Timeline engagement's own measured gate reaches the
     composed file with its config unchanged. */
  var ground = q.get("ground") || q.get("v");
  if (ground && presets[ground]) {
    Object.keys(presets[ground]).forEach(function (key) {
      root.setAttribute("data-" + key, presets[ground][key]);
    });
    root.setAttribute("data-v", ground);
  }
  var state = q.get("state");
  if (state) root.setAttribute("data-state", state);
})();
