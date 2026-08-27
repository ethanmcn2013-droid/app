/* ═══════════════════════════════════════════════════════════════════
   THE SUITE.

   Three products already exist, already work, and already draw the spine
   that would carry a person between them. Every tile that is not the
   product you are on says "Not here yet." This file is the whole of the
   difference: it makes those doors real, and it does nothing else.

   What it owns:
     the floor and the spine   rendered once, for all three
     the router                which sheet is on the floor, and the URL
     the app state container   three products mounted at once, none of
                               them ever torn down, so nothing you were
                               doing is lost when you glance at another
     the seam                  a note peeled in Notes becomes a card on
                               the Tasks board, in the lane the seam
                               chose, and undo takes it back out of both

   What it deliberately does not own: any product's rendering. Tasks,
   Notes and Timeline paint their own sheets with the code they were
   locked with. This file never reaches into one of their trees.
   ═══════════════════════════════════════════════════════════════════ */
window.__SUITE = (function () {
  "use strict";

  var I = window.ICON;
  var B = window.BOARD;
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var PRODUCTS = ["tasks", "notes", "timeline"];
  /* Tasks and Notes both answer ?state= and ?v= and both would read the
     other's. One query string, one product's worth of it at a time: the
     parameters belong to whichever product ?p= names, and a product that
     is not on screen opens on its own locked defaults. */
  var query = new URLSearchParams(location.search);
  var deck = document.getElementById("deck");

  /* ── one parameter that names a surface completely ────────────────
     `?state=` may be a product's own state ("board"), or it may name the
     product too ("notes.voice"). Both reach the same place; the compound
     form exists because a toolchain that can only set one parameter can
     still reach all three products with it, and because a deep link that
     names the surface completely is a better link than two that have to
     agree. The per-product form is untouched, so every gate already
     pointed at ?state= keeps working.

     A DOT, not a colon. The first version used a colon, which reads
     better in a URL and cannot be put in a filename on Windows — so the
     shot harness, which names every frame after its state, silently
     collapsed forty frames into three and then reported the two that
     "differed" between runs. A state name has to survive being a
     filename, because that is one of the places it lives. */
  var compound = (query.get("state") || "").split(".");
  if (compound.length === 2 && PRODUCTS.indexOf(compound[0]) >= 0) {
    query.set("p", compound[0]);
    query.set("state", compound[1]);
  }
  /* Which sheet the app opens on: ?p= if it is given, otherwise whatever
     the markup already says. The markup default is what lets a copy of
     this page open on Notes with no query string at all — which is how the
     three products' own audits, none of which knows about ?p=, are pointed
     at the composed file rather than rewritten. */
  var current = PRODUCTS.indexOf(query.get("p")) >= 0
    ? query.get("p")
    : PRODUCTS.indexOf(deck.getAttribute("data-product")) >= 0
      ? deck.getAttribute("data-product")
      : "tasks";
  /* `?state=` belongs to whichever product was deep-linked, and to no other.
     Nothing writes a live state back into `query`, so once the operator moves
     on, the departing product's state is a stale value that the next reload
     would hand to a product that has never heard of it. Remembered here, at
     the one moment it is still true. */
  var stateOwner = current;
  var hosts = {};
  var registry = {};
  var railCurrent = null;

  /* The three app elements are in the document before any script runs, so
     a product asks for its own root the moment it loads — long before the
     suite has finished starting. Resolved from the DOM and remembered,
     never handed in. */
  function hostOf(product) {
    if (!hosts[product]) hosts[product] = deck.querySelector('[data-app="' + product + '"]');
    return hosts[product];
  }

  /* ── the world's own doors ────────────────────────────────────
     Home, Inbox, Help, More and the account tile are not in scope and are
     not invented. They stay exactly as the two products drew them:
     present, reachable, in the tab order, and saying plainly that they
     are not here yet. That is a designed answer, not a gap. */
  var NOT_YET = {
    home: "Every project in one list. Not here yet.",
    inbox: "What came in while you were working. Not here yet.",
    help: "Guides and support. Not here yet.",
    settings: "Your workspace, your way. Not here yet.",
    me: "Your account, in Signal Studio. Not here yet.",
  };
  /* The doors that used to sit in the rail. They are not deleted — deleting
     an honest door is how a product starts lying about what it is — they
     move behind the plus, where the rail can be three products and nothing
     else and the doors are still one press and still in the tab order. */
  var MORE_DOORS = [
    { key: "home", label: "All projects" },
    { key: "inbox", label: "Inbox" },
    { key: "help", label: "Help" },
  ];
  var LABEL = { notes: "Notes", tasks: "Tasks", timeline: "Timeline" };

  /* ── the spine ────────────────────────────────────────────────
     Tasks' rail, unchanged, with its doors opened. The roving tabindex is
     Tasks' discipline and it is kept at suite level for the reason it was
     written: one piece of state says where the group's index is, every
     button is addressed by the same key, and the position survives a
     repaint — and now a product switch as well. */
  /* Is the plus open? One flag, because the rail is rendered whole. */
  var moreOpen = false;

  function railHtml() {
    if (!railCurrent) railCurrent = current;
    var stop = function (key) { return ' tabindex="' + (key === railCurrent ? "0" : "-1") + '"'; };
    var notYet = function (what) { return ' aria-disabled="true" title="' + esc(what) + '"'; };
    /* A product tile carries its own name. The rail was three abstract
       glyphs and a reader had to decode them; a 10px word under the icon
       costs eight pixels of height and removes the decoding entirely. The
       icon still does the work at a glance — the word is there for the
       first glance, not the hundredth. */
    var tile = function (key, label, live) {
      var active = live && key === current;
      return '<button type="button" class="railTile" data-rail="' + key + '" aria-label="' + esc(label) +
        (active ? ", the page you are on" : "") + '"' + stop(key) +
        (active
          ? ' data-active aria-current="page" title="' + esc(label) + '"'
          : live ? ' title="' + esc(label) + '"' : notYet(NOT_YET[key] || label)) +
        ">" + I[key] + '<span class="railName">' + esc(label) + "</span></button>";
    };
    /* No label, no name underneath: a utility is not a destination and
       giving it one would flatten the hierarchy the products just gained. */
    var util = function (key, label, extra) {
      return '<button type="button" class="railTile" data-util data-rail="' + key +
        '" aria-label="' + esc(label) + '"' + stop(key) + (extra || "") + ">" + I[key] + "</button>";
    };
    /* Settings has no room in a five-across dock, so on a phone it joins the
       doors behind the plus rather than disappearing. */
    var phone = matchMedia("(max-width: 720px)").matches;
    var list = phone
      ? MORE_DOORS.concat([{ key: "settings", label: "Settings" }])
      : MORE_DOORS;
    var doors = list.map(function (d) {
      /* role="menuitem". The container declares role="menu" and its
         children were plain buttons with no role at all, so the menu
         reported no items to anything reading the tree — a menu whose
         contents are invisible to the one reader most dependent on it. */
      return '<button type="button" role="menuitem" class="moreItem" data-door="' + d.key + '" aria-disabled="true" title="' +
        esc(NOT_YET[d.key]) + '">' + I[d.key] + "<span>" + esc(d.label) + "</span>" +
        '<em>Not here yet</em></button>';
    }).join("");
    return (
      '<nav class="rail" data-group="rail" aria-label="Signal Studio">' +
      /* The brand is a dot. It was a four-square grid glyph with a dot beside
         it, which read as a menu and invited a press that went nowhere. One
         indigo dot is the whole identity and it asks for nothing. */
      '<span class="railBrand" aria-label="Signal Studio" role="img"></span>' +
      '<span class="railDivider"></span>' +
      '<div class="railGroup">' +
        tile("notes", "Notes", true) +
        tile("tasks", "Tasks", true) +
        tile("timeline", "Timeline", true) +
      "</div>" +
      '<span class="railSpacer"></span>' +
      '<div class="railUtil">' +
        /* `more`, not `plus`. The plus path is the create mark — it is on
           five "Add here" buttons, the dock's "Add task" and the phone
           capsule's own add — and the More door drew it byte-identically.
           At 390 the two land 52px apart in the same dock, told apart only
           by fill, and fill is what this system uses for "primary", so the
           thinner of the two plus signs read as the secondary ADD. The grid
           mark has been in the icon set the whole time and rendered zero
           times. */
        util("more", "More", ' aria-expanded="' + (moreOpen ? "true" : "false") +
          '" aria-haspopup="menu"' + (moreOpen ? " data-open" : "")) +
        util("settings", "Settings", notYet(NOT_YET.settings)) +
      "</div>" +
      (moreOpen
        ? '<div class="morePop" role="menu" aria-label="More"><p>Also in Signal Studio</p>' + doors + "</div>"
        : "") +
      '<button type="button" class="railAdd" data-rail="add" aria-label="Add task"' + stop("add") + ">" + I.plus + "</button>" +
      '<button type="button" class="railAvatar" data-rail="me" aria-label="' + esc(B.operator.role) + '"' +
        stop("me") + notYet(NOT_YET.me) + ">" + B.operator.initials + "</button>" +
      "</nav>"
    );
  }

  function paintRail() {
    var nav = deck.querySelector(".rail");
    if (!nav) return;
    var was = document.activeElement;
    var focused = was && was.closest && was.closest(".rail") ? was.dataset.rail : null;
    nav.outerHTML = railHtml();
    if (focused) {
      var back = deck.querySelector('.rail [data-rail="' + focused + '"]');
      if (back) back.focus();
    }
  }

  /* ── the keycap ───────────────────────────────────────────────
     One modifier, four printings, in one document. Notes printed
     "Ctrl K" in the dock and "Ctrl+Z" on the undo bar — space and plus on
     the same sheet, in the same frame — and Timeline printed "Ctrl Z"
     with a stray space before the letter. On a Mac it got worse: Notes
     printed "⌘+Z", a form macOS does not use and no premium product
     prints.

     And the DETECTION differed, which is the load-bearing half. Notes and
     Tasks read `navigator.platform`; Timeline read
     `navigator.userAgentData.platform` first, which reports "macOS" and
     does not match /Mac|iPhone|iPad/ — so on one Mac, in one document,
     Notes printed ⌘ and Timeline printed Ctrl. The application could tell
     one person she had two different keyboards.

     Tasks' join is the one promoted, because it was already right: ⌘
     abuts its letter, per Apple's own convention, and Ctrl is a word so
     it takes a space. The words stay words — "Enter", not ↵. Orla reads
     Enter off her keyboard, and ⌘ already renders 18px against 10.7px
     for "A" in the same declared stack, which is a glyph resolving out of
     Geist into a system fallback. One unmeasured glyph is enough. */
  var MAC = /mac|iphone|ipad/i.test(
    navigator.platform || (navigator.userAgentData && navigator.userAgentData.platform) || navigator.userAgent || "");
  function keycap(rest) {
    return MAC ? "⌘" + rest : "Ctrl " + rest;
  }

  /* ── the live region ──────────────────────────────────────────
     One region for the suite. Two products each appending their own would
     put two elements with id="say" in one document, and a region that is
     replaced is a new region every time, which announces nothing. */
  function region() {
    var node = document.getElementById("say");
    if (!node) {
      node = document.createElement("p");
      node.id = "say";
      node.className = "sr";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }
    return node;
  }
  function say(words) {
    var node = region();
    node.textContent = node.textContent === words ? words + " " : words;
  }

  /* ── the router ───────────────────────────────────────────────
     Nothing is torn down. The product leaving keeps its DOM, its scroll,
     its focus and every fact it was holding; it is hidden and made inert,
     and the product arriving is shown. Sort the board, read a note, come
     back — the board is still sorted. */
  function go(product, opts) {
    if (PRODUCTS.indexOf(product) < 0) return false;
    var o = opts || {};
    if (product === current) {
      if (o.announce !== false) say("You are on " + LABEL[product] + ".");
      return true;
    }
    current = product;
    railCurrent = product;
    apply();
    paintRail();
    /* A sheet that was off the floor was measuring a box with no width:
       every trim, fade, scrim reserve and clamp in it was computed
       against zero. The product repaints itself on arrival — with its own
       repaint, which is the one that already restores scroll, focus and
       caret, so nothing it was holding is spent to get the measurements
       back. */
    show(product);
    /* Focus moves to the sheet the spine just opened, and the arrival is
       announced on the region that was already there. A switch that
       leaves focus on the tile leaves a keyboard in the chrome. */
    if (o.focus !== false) {
      var host = hostOf(product);
      var sheet = host.classList.contains("sheet") ? host : host.querySelector(".sheet");
      if (sheet) {
        sheet.setAttribute("tabindex", "-1");
        sheet.focus({ preventScroll: true });
      }
    }
    if (o.announce !== false) say(LABEL[product] + ". " + summary(product));
    writeUrl();
    return true;
  }

  /* What the product being opened has to say for itself, in one line, so
     the announcement is an arrival rather than a label read twice. */
  function summary(product) {
    try {
      if (product === "tasks") {
        var rows = registry.tasks.api.rows();
        var done = rows.filter(function (t) { return t.lane === "done"; }).length;
        return rows.length ? done + " of " + rows.length + " done." : "Nothing on the board.";
      }
      if (product === "notes") return window.NOTES.counts.notebook + " notes.";
      var T = window.__TLFIXTURE;
      return T.project.name + ", " + T.fmt.dayCount(T.toDay()) + " to the day.";
    } catch (err) {
      return "";
    }
  }

  /* Each product's own repaint, by the name it registered. */
  function show(product) {
    var entry = registry[product];
    if (entry && typeof entry.show === "function") entry.show();
  }

  function apply() {
    deck.setAttribute("data-product", current);
    PRODUCTS.forEach(function (key) {
      var host = hostOf(key);
      if (!host) return;
      var on = key === current;
      host.toggleAttribute("hidden", !on);
      if (on) host.removeAttribute("inert");
      else host.setAttribute("inert", "");
    });
    /* The spine stands outside all three products, so it cannot read a
       decision off a product's own root. The mounted product's radius and
       indigo are mirrored onto the deck, which is where shell.css reads
       them. Timeline has neither decision and takes the locked values the
       other two share. */
    var root = hostOf(current);
    if (!root) return;
    deck.setAttribute("data-radius", root.getAttribute("data-radius") || "soft");
    deck.setAttribute("data-indigo", root.getAttribute("data-indigo") || "subtle");
    /* One place a gate can read what is on the floor. */
    deck.setAttribute("data-state", root.getAttribute("data-state") || "");
  }

  /* The URL is a deep link and a gate handle, never a switch UI.
     Reading it is the contract; writing it back is a courtesy, and one the
     page is not always allowed — a sandboxed artifact frame and a file://
     URL both refuse replaceState. The suite is not allowed to fall over
     because the address bar would not take a hint. */
  function writeUrl() {
    var next = new URLSearchParams();
    next.set("p", current);
    /* `v`, `ground` and `layout` are the suite's own and travel with it:
       params() hands the last two to Timeline whether or not Timeline is on
       the floor, by design. Only `state` is product-specific. */
    ["v", "ground", "layout"].forEach(function (key) {
      var value = query.get(key);
      if (value) next.set(key, value);
    });
    if (current === stateOwner && query.get("state")) next.set("state", query.get("state"));
    try {
      /* Qualified deliberately. An unqualified `history` here resolved to a
         `const history` at the top level of another product's script and
         threw on every navigation — the URL contract never wrote once in the
         composed document, and the catch below quietly swallowed it. */
      window.history.replaceState(null, "", location.pathname + "?" + next.toString());
    } catch (err) {
      /* An opaque-origin sandbox raises SecurityError, and Chromium rate-limits
         rapid successive replaceState. Deep links still arrive either way;
         this one just cannot be written back. */
    }
  }

  /* ── the seam ─────────────────────────────────────────────────
     The one genuinely new path in the artefact, and the whole argument for
     a suite existing. Notes already peels the words off a note, already
     resolves where they are going, already records the crossing and
     already offers the way back. It had no destination. This is the
     destination.

     A crossing is one act with two halves, so it has one undo. Notes owns
     its half (the note's own receipt, its ledger row); this owns the
     other (a real card, on the real board, in the lane the seam chose)
     and hands back the way to take it out again. */
  var crossings = Object.create(null);   /* note id → the task it became */

  function cross(entry) {
    var api = registry.tasks && registry.tasks.api;
    if (!api) return null;
    var noteId = String(entry.id).replace(/^crossed_/, "");
    var task = api.add({
      id: "seam_" + noteId + "_" + (Object.keys(crossings).length + 1),
      /* The lane the seam chose. Notes says it in the words a person
         reads; the board knows it by id and does the translation. */
      lane: api.laneIdFor(entry.lane) || B.columns[0].id,
      title: entry.task,
      /* Only what crossed. `entry.body` is the whole private note, and
         putting it here made a stated guarantee false one click after it
         was read. The card carries the picked words, and carries nothing
         at all when the title already IS them — a note that repeats its
         own title is noise, not privacy. */
      note: entry.crossedWords && entry.crossedWords.trim() !== String(entry.task).trim()
        ? entry.crossedWords
        : "",
      /* What the note was about is what the task is tagged with. The seam
         resolved a destination on the Notes side; it would be thrown away
         here otherwise. */
      tag: (entry.about && entry.about.label) || "",
      fromNote: true,
    });
    crossings[noteId] = task.id;
    return task.id;
  }

  function uncross(entry) {
    var api = registry.tasks && registry.tasks.api;
    var noteId = String(entry && entry.id).replace(/^crossed_/, "");
    var id = crossings[noteId];
    if (!api || !id) return false;
    api.remove(id);
    delete crossings[noteId];
    return true;
  }

  /* "In Tasks as …" has to actually open Tasks and show the card. Notes
     hands over the note; the join in fixture.js says which card that note
     became, whether it crossed a minute ago or before the fixture was
     written. */
  function openTask(noteId) {
    var api = registry.tasks && registry.tasks.api;
    var id = crossings[noteId] || (window.NOTES.taskOf && window.NOTES.taskOf(noteId));
    if (!api || !id || !api.byId(id)) {
      go("tasks");
      say("That task is not on this board.");
      return false;
    }
    go("tasks", { announce: false, focus: false });
    api.reveal(id);
    say("Opened in Tasks. Your note stayed in Notes.");
    return true;
  }

  /* ── wiring ───────────────────────────────────────────────── */
  function register(name, api) { registry[name] = api; }

  /* ── the project reached every product ────────────────────────
     `window.PROJECTS.apply()` has already swapped the data underneath all
     three. This is the other half: every product repaints, including the
     two that are mounted but hidden.

     Repainting the hidden ones is the whole point and it is easy to talk
     yourself out of — they are not on screen, so why pay for it? Because
     the suite never tears a product down, so a hidden Timeline still holds
     the PREVIOUS project's measure in the DOM, and the reader would walk
     the spine and find it there. "The previous project's timeline must not
     remain visible" is not satisfied by it merely being off screen. */
  function reproject() {
    PRODUCTS.forEach(function (key) {
      var entry = registry[key];
      if (entry && typeof entry.show === "function") {
        try { entry.show(); } catch (err) { /* one product must not stop the rest */ }
      }
    });
    /* Timeline registers no `show` — it is drawn by its own core, which
       rebuilds the measure from the fixture it has just been handed. */
    if (window.__TLCORE && window.__TLCORE.mount) {
      try { window.__TLCORE.mount(); } catch (err) { /* as above */ }
    }
  }

  deck.addEventListener("click", function (event) {
    /* A press anywhere that is not the plus or its own panel closes the
       panel. Sited before the tile test so a press on the floor closes it
       too, and after nothing, so it cannot be skipped by an early return. */
    var insideMore = event.target.closest &&
      (event.target.closest(".morePop") || event.target.closest('[data-rail="more"]'));
    if (moreOpen && !insideMore) { moreOpen = false; paintRail(); }

    var door = event.target.closest && event.target.closest(".moreItem");
    if (door) {
      event.preventDefault();
      say(door.getAttribute("title"));
      return;
    }

    var tile = event.target.closest && event.target.closest("[data-rail]");
    if (!tile) return;
    event.preventDefault();
    var key = tile.dataset.rail;
    railCurrent = key;

    if (key === "more") {
      moreOpen = !moreOpen;
      paintRail();
      var plus = deck.querySelector('.rail [data-rail="more"]');
      if (plus) plus.focus();
      say(moreOpen ? "More, open." : "More, closed.");
      return;
    }
    if (tile.getAttribute("aria-disabled") === "true") {
      say(tile.getAttribute("title"));
      paintRail();
      var back = deck.querySelector('.rail [data-rail="' + key + '"]');
      if (back) back.focus();
      return;
    }
    if (key === "add") {
      /* The add verb on the phone capsule belongs to the sheet that is
         open, which is the only product that has one. */
      var api = registry[current] && registry[current].api;
      if (api && api.add0) api.add0();
      return;
    }
    go(key);
  });

  /* Focus leaving the panel closes it. Tabbing past its last door landed
     on the sheet's own head with the panel still open, still painted and
     still over the board — a layer nobody was in and nothing would shut.
     `focusout` fires before the next focus lands, so the check is deferred
     one turn to see where focus actually WENT. */
  deck.addEventListener("focusout", function () {
    if (!moreOpen) return;
    setTimeout(function () {
      if (!moreOpen) return;
      var on = document.activeElement;
      var inside = on && on.closest &&
        (on.closest(".morePop") || on.closest('[data-rail="more"]'));
      if (!inside) { moreOpen = false; paintRail(); }
    }, 0);
  });

  /* The spine is one stop the arrows walk, and this is the ONLY thing
     that walks it. Round 1 found six blocking findings from five seats in
     this one handler and the two that used to compete with it:

       · Tasks still carried its own rover for `[data-group="rail"]`,
         which is now this nav. Two handlers, one group, two tiles per
         press, half the spine unreachable.
       · Notes' document handler guarded on "is Notes mounted", which is
         true while the reader is standing on the rail, so ArrowDown off
         a tile walked the note index.
       · The member list was every `[data-rail]` in the nav, including
         `.railAdd`, which `display: none` hides at every desk width. The
         walk clamped on a tile nobody can see.

     Both products now decline these keys, and the list is DERIVED from
     what is actually laid out rather than authored — the capsule carries
     the add verb on a phone and not at a desk, so its membership is
     different at the two widths and cannot be written down. */
  deck.addEventListener("keydown", function (event) {
    /* Escape closes the plus, from anywhere, and puts the reader back on
       the control that opened it. Sited before the rover's own test so it
       works while focus is inside the panel, where there is no [data-rail]
       to close on. */
    if (event.key === "Escape" && moreOpen) {
      event.preventDefault();
      event.stopPropagation();
      moreOpen = false;
      paintRail();
      var plus = deck.querySelector('.rail [data-rail="more"]');
      if (plus) plus.focus();
      say("More, closed.");
      return;
    }
    var tile = event.target.closest && event.target.closest(".rail [data-rail]");
    if (!tile) return;
    /* offsetParent is null for anything display:none — the same predicate
       the board's own rover has used since it was written. */
    var keys = [].slice.call(deck.querySelectorAll(".rail [data-rail]"))
      .filter(function (el) { return el.offsetParent !== null; });
    var i = keys.indexOf(tile);
    if (i < 0) return;
    var next = null;
    /* The capsule lies down on a phone, so the arrows that walk it lie
       down with it. */
    var horizontal = matchMedia("(max-width: 720px)").matches;
    var fwd = horizontal ? "ArrowRight" : "ArrowDown";
    var back = horizontal ? "ArrowLeft" : "ArrowUp";
    if (event.key === fwd) next = keys[(i + 1) % keys.length];
    else if (event.key === back) next = keys[(i - 1 + keys.length) % keys.length];
    else if (event.key === "Home") next = keys[0];
    else if (event.key === "End") next = keys[keys.length - 1];
    if (!next) return;
    event.preventDefault();
    /* And nothing downstream sees it. A key the spine has answered is a
       key the spine has answered. */
    event.stopPropagation();
    railCurrent = next.dataset.rail;
    keys.forEach(function (el) { el.tabIndex = el === next ? 0 : -1; });
    next.focus();
  });

  return {
    /* Each product reads the URL through here, so one query string serves
       three products without any of them answering another's ?state=. */
    params: function (product) {
      if (product === current) return query;
      var own = new URLSearchParams();
      /* Timeline's ratified twin is a ground, not a state, and it is
         reachable whether or not Timeline is the sheet on the floor. */
      if (product === "timeline") {
        for (const key of ["ground", "layout"]) {
          if (query.get(key)) own.set(key, query.get(key));
        }
      }
      return own;
    },
    root: hostOf,
    host: hostOf,
    frame: function () { return deck; },
    active: function (product) { return current === product; },
    current: function () { return current; },
    region: region,
    say: say,
    /* Every <kbd> in all three products comes through here. */
    key: keycap,
    mac: function () { return MAC; },
    go: go,
    cross: cross,
    uncross: uncross,
    openTask: openTask,
    register: register,
    reproject: reproject,
    /* Called once, after all three products have registered. */
    start: function () {
      deck.insertAdjacentHTML("afterbegin", railHtml());
      apply();
      show(current);
      writeUrl();
    },
    refresh: function () { apply(); paintRail(); },
  };
})();
