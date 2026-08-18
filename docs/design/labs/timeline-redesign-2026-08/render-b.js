/* ═══════════════════════════════════════════════════════════════════
   DIRECTION B · THE APPROACH — the renderer.

   The one number that decides this composition is the scale. Every
   vertical position below is `daysFromToday × pixelsPerDay`, computed
   from the real dates, so the measure cannot flatter the plan: a
   fortnight is twice a week, on the screen, always.

   Round 1 rebuilt everything an owner touches. The panel's verdict was
   that at rest this was studio-grade and under the hand it was a five,
   and it was right: the gesture wrote a pixel and a count and left the
   date, the accessible name and the readout saying something else.
   There is now exactly ONE writer of an item's position — setAway() —
   and every fact about that item is derived from the date it produces.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var C = window.__TLCORE, F = C.F, h = C.h;

  /* Pixels per day. The tightest real gap on this plan is seven days and
     an item that wraps to two lines is 70px on a phone and 81px at desk
     width, so the scale has to be at least 10 and 12 respectively or two
     items can touch. 12 and 14 leave a hairline of air at the tightest
     pair. The consequence is a long page, and that is the point: a plan
     that is seventy-nine days long should take a while to scroll. */
  /* The owner measure runs at eighteen. An owner row carries a third
     line — the control that says what a guest sees — so it is a hundred
     pixels tall against the guest row's seventy, and fourteen pixels a
     day would let the tightest real pair touch before the owner had
     touched anything. The scale is a page-size decision; the proportion
     between one gap and the next is identical at every scale. */
  var SCALE = { phone: 12, sheet: 14, full: 14, owner: 18, card: 12, print: 10 };
  var ROW = 92;

  function daysFrom(clock, iso) { return F.days(clock, iso); }

  function ahead(clock) {
    return F.live()
      .filter(function (m) { return m.date && daysFrom(clock, m.date) > 0; })
      .sort(function (a, b) { return daysFrom(clock, a.date) - daysFrom(clock, b.date); });
  }
  /* Strictly behind. Anything dated exactly on the clock is happening,
     not happened, and on the wedding morning the difference is the whole
     screen: the day itself was appearing in the keepsake list as the
     last thing already done. */
  function behind(clock) {
    return F.milestones.filter(function (m) { return !m.date || daysFrom(clock, m.date) < 0; });
  }

  /* ── the horizon ──────────────────────────────────────────────── */

  /* The empty run before the first thing is stated as a boundary, not as
     a count. "The next 16 days" swallows the sixteenth day, which is the
     day the menu tasting falls on, so the sentence was false by one on
     the one surface whose whole claim is that time is measured honestly.
     A boundary cannot go off by one. */
  function gapSentence(nearestIso) {
    return "Nothing is planned until " + F.fmt.medium(nearestIso) + ".";
  }

  function horizon(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var next = ahead(clock)[0];
    return h("header.b-horizon", {}, [
      h("h1.b-who", { text: F.project.name }),
      h("div.b-count", {}, [
        h("span.b-num.num", { text: String(daysFrom(clock, F.project.primaryDate.date)) }),
        h("span.b-unit", { text: "days" }),
      ]),
      h("p.b-when", { text: F.fmt.longYear(F.project.primaryDate.date) }),
      h("p.b-sub", { text: F.project.primaryDate.label + " at The Orchard" }),
      h("div.b-todayRule"),
      h("p.b-todayLabel", { text: "Today is " + F.fmt.medium(clock) }),
      next ? h("p.b-gapNote", { text: gapSentence(next.date) }) : null,
    ]);
  }

  /* ── the measure ──────────────────────────────────────────────── */

  function grabLabel(record, iso, away, hidden) {
    return record.title + ", " + F.fmt.long(iso) + ", in " + F.fmt.dayCount(away)
      + ". " + (hidden ? "Hidden from guests" : "Shown to guests") + ". Open to change it.";
  }

  function recordFor(id) {
    return F.milestones.filter(function (m) { return m.id === id; })[0];
  }

  function measure(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var px = SCALE[o.medium] || SCALE.phone;
    var kids = [h("div.b-rail", { "aria-hidden": "true" })];

    ahead(clock).forEach(function (item) {
      var away = daysFrom(clock, item.date);
      kids.push(h("div.b-item", {
        role: "listitem",
        "data-anchor": item.date === F.project.primaryDate.date ? "true" : null,
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
        h("span.b-vh", { text: " days away," }),
        h("span.b-tick", { "aria-hidden": "true" }),
        h("div.b-copy", {}, [
          h("p.b-title", { "data-clamp": "true", text: item.title }),
          h("p.b-date", { text: F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date) }),
          o.owner ? h("button.b-grab", {
            type: "button",
            "aria-label": grabLabel(item, item.date, away, false),
          }, [h("span.b-grabWord", { text: "Shown" })]) : null,
        ]),
      ]));
    });

    return h("div", { style: "line-height:1.5" }, [
      h("h2.b-measureHead", { text: "days away" }),
      h("div.b-measure", {
        role: "list",
        "aria-label": "What is still ahead, nearest first",
        "data-px": String(px),
        "data-clock": clock,
      }, kids),
    ]);
  }

  /* place() is the only thing that decides where an item sits, and it
     runs at first paint and after every change. It never reparents a
     node — moving the subtree that holds the focused stepper drops focus
     to the body, and the gesture dies for a keyboard user.

     Two items can legitimately land near each other once an owner starts
     moving things. The tick and the count stay on the true pixel,
     always, because they are the truth; only the words are pushed clear.
     So the measure can never restate one item's distance as another's,
     and it never quietly fudges a close pair. */
  function place(measureEl) {
    if (!measureEl) return;
    var px = Number(measureEl.getAttribute("data-px")) || 14;
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var horizonDays = daysFrom(clock, F.project.primaryDate.date);
    var items = Array.prototype.slice.call(measureEl.querySelectorAll(".b-item"));
    items.sort(function (a, b) {
      return Number(a.getAttribute("data-away")) - Number(b.getAttribute("data-away"));
    });

    var bottom = -Infinity, lastBottom = 0;
    items.forEach(function (el, index) {
      var away = Number(el.getAttribute("data-away"));
      var top = away * px;
      el.style.top = top + "px";
      el.removeAttribute("data-lead");

      var copy = el.querySelector(".b-copy");
      copy.style.setProperty("--push", "0px");
      var height = copy.getBoundingClientRect().height;
      var push = bottom > top ? Math.ceil(bottom - top) : 0;
      copy.style.setProperty("--push", push + "px");
      el.setAttribute("data-crowded", push > 0 ? "true" : "false");
      bottom = top + push + height + 10;
      lastBottom = bottom;
      if (index === 0) el.setAttribute("data-lead", "true");
    });

    var note = measureEl.closest(".b-field");
    note = note && note.querySelector(".b-gapNote");
    if (note && items.length) note.textContent = gapSentence(items[0].getAttribute("data-date"));
    /* The measure is at least the horizon, and taller if the words at
       the foot of it need the room. A rail that ends above its own last
       row is the undesigned edge the panel looks for first. */
    var needed = Math.ceil(lastBottom + 24);
    measureEl.style.height = Math.max(horizonDays * px + ROW, needed) + "px";
  }

  /* ── behind you ───────────────────────────────────────────────── */

  /* Two sentences, split by who is reading. The owner is the person
     doing the work and a tally is the right thing to hand them. A guest
     is not, and "2 done" to somebody who has never used a tracker, with
     a cancellation alluded to and never named, reads as withheld bad
     news. The received surfaces name the things instead. */
  function behindBlock(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var past = behind(clock);
    /* "Done" is everything behind the clock that is still going ahead,
       not everything the fixture happens to label covered. Read at the
       day-of clock the two are very different numbers, and the label is
       the one that would have been wrong. */
    var done = past.filter(function (m) { return m.state !== "cancelled"; });
    var dropped = past.filter(function (m) { return m.state === "cancelled"; });
    var last = done[done.length - 1];

    var note;
    if (o.owner) {
      note = done.length + " done, the last of them " + F.fmt.medium(last.date) + "."
        + (dropped.length ? " One thing is not going ahead." : "");
    } else {
      note = (last ? last.title + ", " + F.fmt.medium(last.date) + "." : "")
        + (dropped.length
          ? " The " + dropped[0].title.charAt(0).toLowerCase() + dropped[0].title.slice(1)
            + " is not going ahead."
          : "");
    }

    return h("section.b-behind", {}, [
      h("h2.b-behindLabel", { text: "Behind you" }),
      h("p.b-behindNote", { text: note.trim() }),
    ].concat(past.map(function (item) {
      return h("div.b-behindRow", {}, [
        h("span.b-behindDate.num", {
          text: item.date ? F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date) : "No date",
        }),
        h("p.b-behindTitle", {
          "data-cancelled": item.state === "cancelled" ? "true" : null,
          text: item.title,
        }),
      ]);
    })));
  }

  function foot() {
    return h("footer.b-foot", {}, [
      h("span", { text: "Kept by " + F.workspace.owner }),
      h("span", { text: "Updated " + F.updatedLabel }),
      h("span", { text: "Signal Timeline" }),
    ]);
  }

  /* A labelled section is a region landmark. It travels better than
     <main> too: when this language moves to Home, Notes and Tasks it
     will sit inside an app shell that already owns the document's one
     main element. */
  function field(kids, extra) {
    return h("section.b-field" + (extra || ""), {
      "aria-label": "The plan for " + F.project.name,
    }, kids);
  }

  function act(label, primary, attrs) {
    var a = { type: "button", "data-primary": primary ? "true" : null, text: label };
    if (attrs) for (var k in attrs) a[k] = attrs[k];
    return h("button.b-act", a);
  }

  /* Anything not built is inert text, never a focusable promise. The
     panel counted fifteen named, focus-ringed, hover-styled controls
     advertising verbs the direction did not have. */
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

  /* One surface, one place, and empty until it has something true to
     say. A live region that announces a change on arrival is announcing
     a change that did not happen. */
  var history = [];

  function undoBar() {
    return h("div.b-undo", { role: "status", "data-empty": "true" }, [
      h("span.b-undoText", { text: "" }),
      h("button.b-undoAct", { type: "button", disabled: "disabled", tabindex: "-1", text: "Undo" }),
      h("kbd", { text: "Ctrl Z" }),
    ]);
  }

  function paintUndo(root) {
    var bar = root.querySelector(".b-undo");
    if (!bar) return;
    var text = bar.querySelector(".b-undoText");
    var button = bar.querySelector(".b-undoAct");
    var top = history[history.length - 1];
    if (!top) {
      bar.setAttribute("data-empty", "true");
      text.textContent = "";
      button.disabled = true;
      /* The bar is display:none while it has nothing to say, and a
         control inside a hidden box that can still take focus strands a
         keyboard user in a place they cannot see. */
      button.setAttribute("tabindex", "-1");
      return;
    }
    var moved = Math.abs(top.to - top.from);
    bar.setAttribute("data-empty", "false");
    text.textContent = "";
    text.appendChild(document.createTextNode("Last change: " + top.title + " moved "));
    text.appendChild(h("span.num", { text: String(moved) }));
    text.appendChild(document.createTextNode(
      (moved === 1 ? " day " : " days ") + (top.to < top.from ? "closer." : "later."),
    ));
    button.disabled = false;
    button.removeAttribute("tabindex");
  }

  /* ── the primary gesture ──────────────────────────────────────── */

  /* setAway is the ONLY writer of an item's distance. Every fact about
     the item is derived from the one date it computes, in the same
     frame, so the count, the date line, the accessible name and the
     readout cannot drift apart the way they did in round 1. */
  function setAway(root, item, next) {
    var measureEl = item.parentElement;
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var ceiling = daysFrom(clock, F.project.primaryDate.date);
    var away = Math.max(1, Math.min(ceiling, next));
    var iso = F.plusDays(clock, away);
    var record = recordFor(item.getAttribute("data-id"));
    var hidden = item.getAttribute("data-visibility") === "hidden";

    item.setAttribute("data-away", String(away));
    item.setAttribute("data-date", iso);
    item.querySelector(".b-away").textContent = String(away);
    item.querySelector(".b-date").textContent = F.fmt.weekdayShort(iso) + " " + F.fmt.short(iso);
    var grab = item.querySelector(".b-grab");
    if (grab) grab.setAttribute("aria-label", grabLabel(record, iso, away, hidden));

    var read = root.querySelector(".b-stepRead");
    if (read) read.textContent = F.fmt.longYear(iso) + " · in " + F.fmt.dayCount(away);

    var steps = root.querySelectorAll(".b-step");
    for (var i = 0; i < steps.length; i++) {
      var delta = Number(steps[i].getAttribute("data-delta"));
      var blocked = delta > 0 ? away >= ceiling : away <= 1;
      steps[i].setAttribute("aria-disabled", blocked ? "true" : "false");
    }
    var ceilingNote = root.querySelector(".b-ceiling");
    if (ceilingNote) {
      ceilingNote.textContent = away >= ceiling
        ? "The day itself is in " + F.fmt.dayCount(ceiling) + "."
        : "";
    }
    place(measureEl);
    return away;
  }

  function setVisibility(item, hidden) {
    item.setAttribute("data-visibility", hidden ? "hidden" : "shown");
    var word = item.querySelector(".b-grabWord");
    if (word) word.textContent = hidden ? "Hidden" : "Shown";
    var grab = item.querySelector(".b-grab");
    if (grab) {
      grab.setAttribute("aria-label", grabLabel(
        recordFor(item.getAttribute("data-id")),
        item.getAttribute("data-date"),
        Number(item.getAttribute("data-away")),
        hidden,
      ));
    }
  }

  /* ── the editor ───────────────────────────────────────────────── */

  function editor(root, item) {
    var record = recordFor(item.getAttribute("data-id"));
    var away = Number(item.getAttribute("data-away"));
    var iso = item.getAttribute("data-date");
    var hidden = item.getAttribute("data-visibility") === "hidden";

    function step(delta, label) {
      return h("button.b-step", {
        type: "button",
        "data-delta": String(delta),
        "aria-label": label,
        "aria-disabled": "false",
        text: (delta > 0 ? "+" : "−") + Math.abs(delta),
        on: {
          click: function (event) {
            if (event.currentTarget.getAttribute("aria-disabled") === "true") return;
            var from = Number(item.getAttribute("data-away"));
            var to = setAway(root, item, from + delta);
            if (to !== from) {
              history.push({ id: record.id, title: record.title, from: from, to: to });
              paintUndo(root);
            }
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
            for (var i = 0; i < group.length; i++) {
              group[i].setAttribute("aria-pressed", String(group[i] === event.currentTarget));
            }
            setVisibility(item, wantHidden);
          },
        },
      });
    }

    return h("div.b-edit", {}, [
      h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
        h("label.b-label", { for: "b-edit-title", text: "What it is" }),
        h("input.b-input", { id: "b-edit-title", type: "text", value: record.title }),
      ]),
      h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
        h("span.b-label", { text: "When" }),
        h("div.b-stepRow", {}, [
          h("div.b-stepBtns", {}, [
            step(-7, "Move a week earlier"), step(-1, "Move a day earlier"),
            step(1, "Move a day later"), step(7, "Move a week later"),
          ]),
          /* Its own line, and a fixed measure. When this readout lived
             beside the buttons it collapsed from 347px to 99px on the
             first press and threw the button you were about to press
             again 209px out from under the cursor. */
          h("span.b-stepRead.num", {
            role: "status",
            text: F.fmt.longYear(iso) + " · in " + F.fmt.dayCount(away),
          }),
        ]),
        h("p.b-ceiling", { text: "" }),
      ]),
      h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
        h("span.b-label", { id: "b-vis", text: "What guests see" }),
        h("div.b-seg", { role: "group", "aria-labelledby": "b-vis" }, [
          visButton("Shown", false), visButton("Hidden", true),
        ]),
      ]),
      h("div.b-editActs", {}, [
        act("Done", true, { "data-act": "done" }),
        /* "Take it off the plan" sat thirteen pixels under a toggle
           reading "On the plan", so the same three words meant both
           "a guest can see this" and "this ceases to exist". */
        act("Delete this moment", false, { "data-act": "delete" }),
      ]),
    ]);
  }

  function closeEditor(root, focusBack) {
    var open = root.querySelector('.b-item[data-editing="true"]');
    if (!open) return;
    var node = root.querySelector(".b-edit");
    if (node) node.remove();
    open.removeAttribute("data-editing");
    root.removeAttribute("data-editor-open");
    place(root.querySelector(".b-measure"));
    if (focusBack) {
      var grab = open.querySelector(".b-grab");
      if (grab) grab.focus();
    }
  }

  /* The panel is appended to the MEASURE, not to the item, and pinned at
     the height the item had when it was opened. Hung off the item it
     travelled ninety-eight pixels on the first press and took the button
     you were about to press again with it. The thing you are moving
     moves; the thing you are pressing does not. */
  function openEditor(root, item) {
    if (item.getAttribute("data-editing") === "true") return;
    closeEditor(root, false);
    var node = editor(root, item);
    (root.querySelector(".b-editHost") || item.parentElement).appendChild(node);
    item.setAttribute("data-editing", "true");
    root.setAttribute("data-editor-open", "true");
    place(root.querySelector(".b-measure"));
  }

  function undo(root) {
    var last = history.pop();
    if (!last) return;
    var item = root.querySelector('.b-item[data-id="' + last.id + '"]');
    if (item) {
      setAway(root, item, last.from);
      var back = root.querySelector('.b-step[data-delta="' + (last.to < last.from ? "-7" : "7") + '"]');
      if (back) back.focus();
    }
    paintUndo(root);
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
        /* The editor is a sibling of the rows now, not a child of one,
           so the row it belongs to has to be named rather than walked
           up to. */
        var item = root.querySelector('.b-item[data-editing="true"]');
        if (!item) return;
        var measureEl = item.parentElement;
        closeEditor(root, false);
        item.remove();
        place(measureEl);
        return;
      }
      if (name === "add") {
        var first = root.querySelector(".b-item");
        if (first) openEditor(root, first);
        return;
      }
      if (name === "preview") { C.rootEl().setAttribute("data-state", "desk"); C.mount(); return; }
      if (name === "publish") { C.rootEl().setAttribute("data-state", "publish"); C.mount(); }
    });

    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { closeEditor(root, true); return; }
      var grab = event.target.closest(".b-grab");
      if (grab && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openEditor(root, grab.closest(".b-item"));
        return;
      }
      /* Ctrl+Z is printed on the reversibility bar, so it exists. It
         stays out of the way of native undo inside a text field, which
         is a different promise the browser already keeps. */
      var key = (event.key || "").toLowerCase();
      if (key !== "z" || !(event.ctrlKey || event.metaKey) || event.shiftKey) return;
      var el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      event.preventDefault();
      undo(root);
    });

    var undoAct = root.querySelector(".b-undoAct");
    if (undoAct) undoAct.addEventListener("click", function () { undo(root); });

    if (o.open) {
      var target = root.querySelector('.b-item[data-id="' + o.open + '"]');
      if (target) openEditor(root, target);
    }
  }

  /* ── the states ───────────────────────────────────────────────── */

  var states = {};

  function ownerSurface(opts) {
    var node = field([
      bar(F.project.name, [
        act("Add a moment", false, { "data-act": "add" }),
        act("Preview", false, { "data-act": "preview" }),
        act("Publish", true, { "data-act": "publish" }),
      ]),
      h("div.b-two", {}, [
        /* The editor takes the rail, beside the plan. Reserving a gutter
           inside the measure column starved the titles down to 144px at
           1440, and hanging the panel off the item took the button you
           were pressing with it. The rail is already there, it is
           sticky, and it costs the measure nothing. */
        h("div.b-stick", { style: "line-height:1.5" }, [horizon({}), h("div.b-editHost")]),
        h("div", { style: "line-height:1.5" }, [
          measure({ owner: true, medium: "owner" }), behindBlock({ owner: true }),
        ]),
      ]),
      undoBar(),
      foot(),
    ]);
    wireOwner(node, opts || {});
    return node;
  }

  states.phone = function () {
    return h("div.tl-device", {}, [
      field([horizon({}), measure({ medium: "phone" }), behindBlock({}), foot()]),
    ]);
  };

  states.desk = function () {
    /* At desk width the horizon holds the left and stops scrolling, and
       the approach runs down the right. Seeing both at once is the one
       thing a phone cannot give the reader, so it is the only thing this
       state does differently. */
    return h("div.tl-paperEdge", { style: "border-color:var(--fore-16)" }, [
      field([
        h("div.b-two", {}, [
          h("div.b-stick", { style: "line-height:1.5" }, [horizon({})]),
          h("div", { style: "line-height:1.5" }, [measure({ medium: "full" }), behindBlock({})]),
        ]),
        foot(),
      ]),
    ]);
  };

  states["owner-flight"] = function () { return ownerSurface({}); };
  states["owner-editing"] = function () {
    return ownerSurface({ open: "demo-audience-item-invitations" });
  };

  states["owner-empty"] = function () {
    var sibling = F.siblings[1];      /* Aisling & Tom — real, and genuinely empty */
    var node = field([
      /* No Preview on a project with nothing to preview. An aria-disabled
         control the owner cannot use is worse than an absent one. */
      bar(sibling.name, [inert("Nothing to preview yet")]),
      h("div.b-empty", {}, [
        h("h1.b-who", { text: sibling.name }),
        h("p.b-emptyTitle", { text: "When is the day?" }),
        h("p.b-emptyBody", { text: "Everything on this page is measured from it, so it is the only thing needed to start." }),
        h("div.b-emptyForm", {}, [
          h("label.b-label", { for: "b-empty-date", text: "The day" }),
          h("input.b-input", {
            id: "b-empty-date", type: "text", "data-mono": "true",
            placeholder: "3 October 2026", style: "max-width:240px",
            "aria-describedby": "b-empty-hint",
          }),
          act("Set the day", true, { "data-act": "setday" }),
        ]),
        h("p.b-hint", { id: "b-empty-hint", role: "status", text: "" }),
      ]),
      foot(),
    ]);
    /* The one form in the direction had no failure path at all: pressing
       the button on an empty field changed nothing, said nothing, and
       moved nothing. */
    node.addEventListener("click", function (event) {
      if (!event.target.closest('[data-act="setday"]')) return;
      var input = node.querySelector("#b-empty-date");
      var hint = node.querySelector("#b-empty-hint");
      if (input.value.trim()) {
        input.setAttribute("aria-invalid", "false");
        hint.textContent = "";
        return;
      }
      input.setAttribute("aria-invalid", "true");
      hint.textContent = "Pick the date of the day first.";
      input.focus();
    });
    return node;
  };

  function card() {
    return h("a.b-unfurl", { href: F.shareUrlFull, "aria-label": F.project.name + ", a wedding timeline" }, [
      h("div.b-og", {}, [
        h("p.b-ogWho", { text: F.project.name }),
        h("div", { style: "line-height:1" }, [
          h("p.b-ogNum.num", { text: String(F.toDay()) }),
          h("p.b-ogDate", { text: "days to " + F.fmt.longYear(F.project.primaryDate.date) }),
        ]),
      ]),
      h("div.b-unfurlMeta", {}, [
        h("p.b-unfurlTitle", { text: F.project.name + ", a wedding timeline" }),
        h("p.b-unfurlHost", { text: "timeline.signalstudio.ie" }),
      ]),
    ]);
  }

  states.publish = function () {
    return field([
      h("div.b-press", {}, [
        h("div", { style: "line-height:1.5" }, [
          h("p.b-who", { text: "What lands in the message" }),
          h("div", { style: "margin-top:14px;line-height:1.5" }, [card()]),
        ]),
        h("div", { style: "line-height:1.5" }, [
          h("p.b-who", { text: "The moment it becomes theirs" }),
          h("h2.b-pressTitle", { text: "Send it to " + F.project.name + "." }),
          h("p.b-pressBody", {
            text: "This is what lands in the message. It carries the day, the distance "
              + "and the plan, and nothing from your workspace: no notes, no suppliers, no prices.",
          }),
          h("div.b-linkRow", {}, [h("span", { text: F.shareUrl })]),
          h("div.b-barActs", {}, [act("Send the link", true), act("Copy the link")]),
          h("p.b-note", { text: "You can turn the link off at any time. Anyone holding it then sees that it has ended." }),
        ]),
      ]),
    ]);
  };

  states.unfurl = function () {
    return h("div.b-chat", {}, [
      h("p.b-bubble", { text: "Here is everything, love. It updates itself." }),
      card(),
    ]);
  };

  /* The wedding morning. The count is a countdown, and a countdown that
     has arrived is a word, not a zero, so the number goes and "Today"
     takes its place. Everything else on the screen is the fixture read
     at the day-of clock: the milestone dated 3 October is happening, and
     the eight that got the couple here are the keepsake reading. The old
     copy said everything had happened while a live milestone was dated
     that morning, which made this the one screen in the set telling a
     lie on the one morning it is read. */
  states.day = function () {
    var clock = F.project.primaryDate.date;
    var todayItems = F.live().filter(function (m) { return m.date && daysFrom(clock, m.date) === 0; });
    return h("div.tl-device", {}, [
      field([
        h("div.b-dayWrap", {}, [
          h("p.b-dayToday", { text: "Today" }),
          h("h1.b-dayNames", { text: F.project.name }),
          h("p.b-dayDate", { text: F.fmt.longYear(clock) }),
          h("p.b-sub", { text: F.project.primaryDate.label + " at The Orchard" }),
          h("div.b-dayRule"),
          h("p.b-dayNote", { text: "This is the day the plan was for." }),
        ]),
        todayItems.length ? h("section.b-dayNow", {}, [
          h("h2.b-behindLabel", { text: "Happening now" }),
          h("p.b-dayNowTitle", { text: todayItems[0].title }),
        ]) : null,
        behindBlock({ clock: clock }),
        foot(),
      ]),
    ]);
  };

  states.print = function () {
    return h("div.tl-paperEdge", { style: "min-height:1123px" }, [
      field([
        /* Print sets the horizon beside the measure and drops to ten
           pixels a day: A4 is 1123px tall and the screen scale runs off
           the bottom of it. The scale changes; the proportion between
           one gap and the next does not. */
        h("div.b-two", {}, [
          h("div", { style: "line-height:1.5" }, [horizon({})]),
          h("div", { style: "line-height:1.5" }, [measure({ medium: "print" }), behindBlock({})]),
        ]),
        h("footer.b-foot", {}, [
          h("span", { text: "Kept by " + F.workspace.owner }),
          h("span", { text: "Updated " + F.updatedLabel }),
          h("span", { text: F.shareUrl }),
        ]),
      ], ".b-print"),
    ]);
  };

  states.ended = function () {
    return h("div.tl-device", {}, [
      field([
        h("div.b-ended", {}, [
          h("h1.b-who", { text: "Signal Timeline" }),
          h("p.b-endedTitle", { text: "This link has been turned off." }),
          h("p.b-endedBody", {
            text: "The plan for " + F.project.name + " is no longer shared here. "
              + F.workspace.owner + " can send a new link whenever they want to.",
          }),
          h("p.b-note", { text: "Nothing you saw before has been deleted. It is just not public any more." }),
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
        h("div.b-skel", { style: "width:120px;height:11px;margin-bottom:22px" }),
        h("div.b-skel", { style: "width:180px;height:82px;margin-bottom:14px" }),
        h("div.b-skel", { style: "width:64%;height:20px;margin-bottom:10px" }),
        h("div.b-skel", { style: "width:44%;height:15px" }),
        h("div", { style: "height:1px;background:var(--fore-16);margin:26px 0 0" }),
        h("p.b-todayLabel", { text: "Today is " + F.fmt.medium(F.today) }),
        h("p.b-sub", { style: "margin-top:26px;line-height:1.5", text: "Bringing in what is ahead." }),
      ]),
    ]);
  };

  var MEDIUM = {
    "owner-flight": "full", "owner-empty": "full", "owner-editing": "full", publish: "full",
    phone: "phone", desk: "full", day: "phone", print: "sheet",
    unfurl: "card", ended: "phone", loading: "phone",
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
      return node;
    },
    /* The core calls this after layout and again after the webfonts
       swap, so a title that clamps to one less word re-places the rows
       below it rather than leaving them on a stale push. */
    settle: function () {
      var all = document.querySelectorAll(".b-measure");
      for (var i = 0; i < all.length; i++) place(all[i]);
    },
  };
})();
