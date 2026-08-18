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

  function rootEl() { return document.getElementById("deck") || document.body; }

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
    ["publish", "Publish"],
    ["phone", "Received · phone"],
    ["desk", "Received · desk"],
    ["day", "The day"],
    ["print", "Print"],
    ["unfurl", "Unfurl"],
    ["ended", "Ended"],
    ["loading", "Loading"],
  ];

  var CAPTIONS = {
    "owner-flight": ["Owner", "Mara &amp; Finn in full flight"],
    "owner-empty": ["Owner", "a project with nothing in it yet"],
    "owner-editing": ["Owner", "changing one line"],
    publish: ["Publish", "the moment it becomes theirs"],
    phone: ["Received", "390px, the screen that decides"],
    desk: ["Received", "desk width"],
    day: ["The day", "Saturday 3 October, morning"],
    print: ["Print", "A4, the keepsake"],
    unfurl: ["Unfurl", "the link before it is opened"],
    ended: ["Ended", "revoked or expired"],
    loading: ["Loading", "what the frame promises"],
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
        caption(state, direction.name),
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
    return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  }

  /* A trimmed string keeps its whole self in the accessibility tree. An
     aria-label on a paragraph is dropped — naming is not allowed on the
     generic role — so the visible remnant leaves the tree and an
     unclipped copy takes its place beside it. */
  function unhide(el) {
    el.removeAttribute("aria-hidden");
    el.removeAttribute("data-trimmed");
    var twin = el.nextElementSibling;
    if (twin && twin.getAttribute("data-clamp-full") === "true") twin.remove();
  }

  function clamp(el) {
    var full = el.getAttribute("data-full") || el.textContent;
    el.setAttribute("data-full", full);
    el.setAttribute("title", full);
    el.textContent = full;
    unhide(el);
    if (!over(el)) return;
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

    /* Three finished rooms. Each is a combination of the four named
       decisions below, never a copy: start from one, then change anything
       underneath and every combination you land on is buildable. */
    presets: {
      approach: { ground: "ink", past: "folded", accent: "once", spacing: "measured" },
      paper: { ground: "paper", past: "folded", accent: "once", spacing: "measured" },
      record: { ground: "ink", past: "listed", accent: "structure", spacing: "measured" },
    },
    presetCopy: {
      approach: { name: "The approach", note: "The direction as drawn: ink, and a measure you fall down." },
      paper: { name: "On paper", note: "The same composition inverted, for the light-lock." },
      record: { name: "The long view", note: "Everything that happened, and today drawn on the rail." },
    },
    controls: [
      {
        key: "ground", label: "The ground",
        help: "Ink is the direction as drawn. Paper is the same composition inverted through the ink ladder, and it is the reversal for the light-lock. Print is always paper either way.",
        options: [["ink", "Ink"], ["paper", "Paper"]],
      },
      {
        key: "spacing", label: "The measure",
        help: "Measured means a pixel is a real unit of time, so a fortnight of nothing looks like a fortnight of nothing. Even sets the same items at one rhythm. The honest cost of measured is holes.",
        options: [["measured", "Real distance"], ["even", "Even rhythm"]],
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
