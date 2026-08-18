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
  var SCALE = { phone: 12, sheet: 14, full: 14, card: 12, print: 10 };
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

  function horizon(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var next = ahead(clock, o.owner)[0];
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
    return "Edit " + nameOf(record) + ". " + F.fmt.long(iso) + ", in " + F.fmt.dayCount(away)
      + ". " + (hidden ? "Hidden from guests." : "Shown to guests.");
  }

  function row(item, away, owner) {
    return h("div.b-item", {
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
      h("span.b-vh.b-unitSaid", { text: " days away," }),
      h("span.b-tick", { "aria-hidden": "true" }),
      h("div.b-copy", {}, [
        h("p.b-title", { "data-clamp": "true", text: nameOf(item) }),
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

  function measure(opts) {
    var o = opts || {};
    var clock = o.clock || F.today;
    var px = o.owner ? ownerScale() : (SCALE[o.medium] || SCALE.phone);
    var kids = [h("div.b-rail", { "aria-hidden": "true" })];
    /* The top of the rail is today, and it says so. The instrument could
       not be read on its own: the only anchor for "now" was in the other
       column, four hundred pixels away. */
    kids.push(h("p.b-origin", { "aria-hidden": "true", text: "Today, " + F.fmt.medium(clock) }));
    ahead(clock, o.owner).forEach(function (item) {
      var node = row(item, daysFrom(clock, item.date), o.owner);
      if (item.hidden) setVisibility(node, true);
      kids.push(node);
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

     The tick and the count stay on the true pixel, always, because they
     are the truth; only the words are pushed clear. Where two moments
     land on the SAME day they become one mark with two rows under it,
     done by attribute rather than by structure, so nothing is
     reparented and every row keeps its own name. */
  function place(measureEl) {
    if (!measureEl) return;
    var px = Number(measureEl.getAttribute("data-px")) || 14;
    var clock = measureEl.getAttribute("data-clock") || F.today;
    var horizonDays = daysFrom(clock, F.project.primaryDate.date);
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

    var bottom = -Infinity, lastBottom = 0, run = [];
    function closeRun() {
      run.forEach(function (el, i) {
        el.setAttribute("data-stack", run.length === 1 ? "" : (i === 0 ? "lead" : "follow"));
        var said = el.querySelector(".b-unitSaid");
        if (said) {
          said.textContent = run.length === 1
            ? " days away,"
            : " days away, " + (i === 0 ? "first" : "then") + " of "
              + run.length + " moments on this day,";
        }
      });
      run = [];
    }

    items.forEach(function (el, index) {
      var away = Number(el.getAttribute("data-away"));
      var top = away * px;
      el.style.top = top + "px";
      el.removeAttribute("data-lead");

      if (run.length && Number(run[0].getAttribute("data-away")) !== away) closeRun();
      run.push(el);

      var copy = el.querySelector(".b-copy");
      copy.style.setProperty("--push", "0px");
      var height = copy.getBoundingClientRect().height;
      var gap = el.getAttribute("data-stack") === "follow" ? 1 : 10;
      var push = bottom > top ? Math.ceil(bottom - top) : 0;
      copy.style.setProperty("--push", push + "px");
      el.setAttribute("data-crowded", push > 0 ? "true" : "false");
      bottom = top + push + height + gap;
      lastBottom = bottom;
      if (index === 0) el.setAttribute("data-lead", "true");
    });
    closeRun();

    var field = measureEl.closest(".b-field");
    var note = field && field.querySelector(".b-gapNote");
    if (note && items.length) note.textContent = gapSentence(items[0].getAttribute("data-date"));
    /* The measure is at least the horizon, and taller if the words at
       the foot of it need the room. A rail that ends above its own last
       row is the undesigned edge a panel looks for first. */
    measureEl.style.height = Math.max(horizonDays * px + ROW, Math.ceil(lastBottom + 24)) + "px";
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

    var head = [
      h("h2.b-behindLabel", { text: dayOf ? "How you got here" : "Behind you" }),
      h("span.b-behindCount.num", { text: past.length + " moments" }),
    ];
    var rowsNode = h("div.b-behindRows", {}, rows);
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
      h("p.b-behindNote", { text: note.trim() }),
    ]);
  }

  function foot(opts) {
    var o = opts || {};
    return h("footer.b-foot", {}, [
      h("span", { text: "Kept by " + F.workspace.owner }),
      /* No stamp where there is nothing to stamp: a project that has
         never held anything, and the morning itself, where an
         eleven-week-old timestamp reads as neglect. */
      o.stamp === false ? null : h("span", { text: "Updated " + F.updatedLabel }),
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
    text.textContent = "";
    if (!top) {
      bar.setAttribute("data-empty", "true");
      button.disabled = true;
      button.setAttribute("tabindex", "-1");
      root.removeAttribute("data-undo");
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
  }

  function remember(root, entry) {
    /* The place the owner was looking at is part of the change. Undo
       used to restore the moment and leave them a screen away from it. */
    entry.at = window.scrollY;
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
    paintUndo(root);
    if (top.focus) top.focus();
    if (typeof top.at === "number") window.scrollTo(0, top.at);
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
      steps[i].setAttribute("aria-disabled",
        (delta > 0 ? away >= ceiling : away <= 1) ? "true" : "false");
    }
    var ceilingNote = root.querySelector(".b-ceiling");
    if (ceilingNote) {
      ceilingNote.textContent = away >= ceiling
        ? "This is as far as it goes. " + F.project.primaryDate.label + " is the last day."
        : (away <= 1 ? "This is as near as it goes. Tomorrow is the soonest." : "");
    }
    place(measureEl);
    keepInBand(root, item);
    return away;
  }

  /* The move is the one animated thing in the product, and below the
     gutter width it was happening under a sheet that covered the row.
     Gated on the sheet, not on a width: where the editor is the static
     rail the steppers cannot move under the hand, so the scroll path is
     unreachable there and the page keeps its place exactly as before. */
  function keepInBand(root, item) {
    var panel = root.querySelector(".b-edit");
    if (!panel || getComputedStyle(panel).position !== "fixed") return;
    var free = panel.getBoundingClientRect().top - 16;
    var box = item.querySelector(".b-copy").getBoundingClientRect();
    if (box.top >= 16 && box.bottom <= free) return;
    window.scrollBy(0, Math.round(box.top - Math.max(16, (free - box.height) / 2)));
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
            if (to === from) return;
            var moved = Math.abs(to - from);
            remember(root, {
              id: record.id,
              say: [nameOf(record) + " moved ", moved, moved === 1 ? " day " : " days ",
                to < from ? "earlier." : "later."],
              undo: function () { setAway(root, item, from); },
              focus: function () { event.currentTarget.focus({ preventScroll: true }); },
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
              say: [nameOf(record) + (wantHidden ? " is now hidden from guests." : " is now shown to guests.")],
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
      "aria-label": "Editing " + nameOf(record),
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
          h("span.b-stepRead.num", {
            role: "status",
            text: F.fmt.longYear(iso) + " · in " + F.fmt.dayCount(away),
          }),
        ]),
        h("p.b-ceiling#b-edit-when-hint", { text: "" }),
      ]),
      h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
        h("span.b-label", { id: "b-vis", text: "What guests see" }),
        h("div.b-seg", { role: "group", "aria-labelledby": "b-vis" }, [
          visButton("Shown", false), visButton("Hidden", true),
        ]),
      ]),
      h("div.b-editActs", {}, [act("Done", true, { "data-act": "done" })]),
      /* On its own line, after a rule. It used to sit ten pixels to the
         right of the safe action at two and a half times its width. */
      h("div.b-editDanger", {}, [
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
    if (!iso) return refuse("That is not a date. Try 3 October 2026.");
    var away = daysFrom(clock, iso);
    if (away < 1) return refuse("That day has gone. Pick one still ahead.");
    if (away > ceiling) {
      return refuse("This is as far as it goes. " + F.project.primaryDate.label + " is the last day.");
    }
    input.setAttribute("aria-invalid", "false");
    if (hint) hint.textContent = "";
    var record = recordFor(item.getAttribute("data-id"));
    var from = Number(item.getAttribute("data-away"));
    var to = setAway(root, item, away);
    input.value = F.fmt.medium(F.plusDays(clock, to)) + " " + F.fmt.year(F.plusDays(clock, to));
    if (to === from) return;
    var moved = Math.abs(to - from);
    remember(root, {
      id: record.id,
      say: [nameOf(record) + " moved ", moved, moved === 1 ? " day " : " days ",
        to < from ? "earlier." : "later."],
      undo: function () {
        setAway(root, item, from);
        input.value = F.fmt.medium(F.plusDays(clock, from)) + " " + F.fmt.year(F.plusDays(clock, from));
      },
    });
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
    if (focusBack && grab) land(grab, root);
  }

  function openEditor(root, item) {
    if (item.getAttribute("data-editing") === "true") return;
    closeEditor(root, false);
    var node = editor(root, item);
    (root.querySelector(".b-editHost") || item.parentElement).appendChild(node);
    moveUndoBar(root, node);
    item.setAttribute("data-editing", "true");
    root.setAttribute("data-editor-open", "true");
    var grab = item.querySelector(".b-grab");
    if (grab) grab.setAttribute("aria-expanded", "true");
    place(root.querySelector(".b-measure"));
    /* A fixed sheet stands outside layout, so the column it covers has
       to be given the room back or the last rows are unreachable. */
    if (getComputedStyle(node).position === "fixed") {
      root.style.setProperty("--b-sheet", (node.offsetHeight + 24) + "px");
    }
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
        item.remove();
        if (index >= 0) F.milestones.splice(index, 1);
        place(measureEl);
        focusAfterRemoval(root, next);
        /* The live node is kept, not its markup: setAway writes the
           owner's edits to the DOM, so rebuilding from the record would
           restore a moment they never had. */
        remember(root, {
          id: record.id,
          say: [nameOf(record) + " was removed."],
          undo: function () {
            if (index >= 0) F.milestones.splice(index, 0, record);
            measureEl.insertBefore(item, next && next.isConnected ? next : null);
            place(measureEl);
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
          id: "moment-" + (F.milestones.length + 1),
          title: "",
          date: F.plusDays(clock, away),
          state: "next",
        };
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
      if (name === "preview") { cameFromOwner = true; go("desk"); return; }
      if (name === "publish") { cameFromOwner = true; go("publish"); return; }
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

    var undoAct = root.querySelector(".b-undoAct");
    if (undoAct) undoAct.addEventListener("click", function () { undo(root); });

    /* Deferred to after the mount: getComputedStyle on a node that is
       not in the document yet reports static for everything, so the
       sheet would never know it was a sheet and would reserve nothing. */
    if (o.open) {
      requestAnimationFrame(function () {
        var target = root.querySelector('.b-item[data-id="' + o.open + '"]');
        if (target) openEditor(root, target);
      });
    }
  }

  var cameFromOwner = false;
  var SAID = {
    desk: "The plan as guests will see it.",
    publish: "Ready to send. The link is below.",
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
    if (live && SAID[state]) live.textContent = SAID[state];
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
      h("p.b-live.b-vh", { role: "status", text: "" }),
      h("div.b-two", {}, [
        h("div.b-stick", { style: "line-height:1.5" }, [
          horizon({}), h("div.b-editHost"), h("div.b-undoHome", {}, [undoBar()]),
        ]),
        h("div", { style: "line-height:1.5" }, [
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
      field([horizon({}), measure({ medium: "phone" }), behindBlock({}), foot({})]),
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

  states["owner-flight"] = function () { return ownerSurface({}); };
  states["owner-editing"] = function () {
    return ownerSurface({ open: "demo-audience-item-invitations" });
  };

  states["owner-empty"] = function () {
    var sibling = F.siblings[1];      /* Aisling & Tom — real, and genuinely empty */
    var node = field([
      bar(sibling.name, [inert("Nothing to preview yet")]),
      h("div.b-empty", {}, [
        h("h1.b-who", { text: sibling.name }),
        h("p.b-emptyTitle", { text: "When is the day?" }),
        h("p.b-emptyBody", { text: "Everything on this page is measured from it, so it is the only thing needed to start." }),
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
    node.addEventListener("click", function (event) {
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

  function card() {
    return h("a.b-unfurl", { href: F.shareUrlFull, "aria-label": F.project.name + ", a wedding timeline" }, [
      h("div.b-og", {}, [
        h("p.b-ogWho", { text: F.project.name }),
        h("div", { style: "line-height:var(--lead-display)" }, [
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
    var node = field([
      bar(F.project.name, [act("Back to the plan", false, { "data-act": "owner" })]),
      h("div.b-press", {}, [
        h("div", { style: "line-height:1.5" }, [
          h("p.b-who", { text: "What lands in the message" }),
          h("div", { style: "margin-top:14px;line-height:1.5" }, [card()]),
        ]),
        h("div", { style: "line-height:1.5" }, [
          h("p.b-who", { text: "The link" }),
          h("h2.b-pressTitle", { text: "Send it to " + F.project.name + "." }),
          h("p.b-pressBody", {
            text: "It carries the day, the distance and the plan, and nothing from "
              + "your workspace: no notes, no suppliers, no prices.",
          }),
          h("div.b-linkRow", {}, [h("span", { text: F.shareUrl })]),
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
          action.textContent = "Copied";
          live.textContent = "Link copied.";
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
    var todayItems = F.live().filter(function (m) { return m.date && daysFrom(clock, m.date) === 0; });
    return h("div.tl-device", {}, [
      field([
        h("div.b-dayWrap", {}, [
          h("h1.b-who", { text: F.project.name }),
          h("p.b-dayCount", { text: "Today" }),
          h("p.b-dayDate", { text: F.fmt.longYear(clock) }),
          h("div.b-dayRule"),
          h("p.b-dayNote", { text: "This is the day the plan was for." }),
        ]),
        todayItems.length ? h("section.b-dayNow", {}, [
          h("h2.b-behindLabel", { text: "Happening now" }),
          h("p.b-dayNowTitle", { text: todayItems[0].title + " at The Orchard" }),
        ]) : null,
        behindBlock({ clock: clock }),
        foot({ stamp: false }),
      ]),
    ]);
  };

  states.print = function () {
    return h("div.tl-paperEdge", { style: "min-height:1123px" }, [
      field([
        /* Print sets the horizon beside the measure and drops to ten
           pixels a day: A4 is 1123px and the screen scale runs off the
           bottom of it. The scale changes; the proportion between one
           gap and the next does not. */
        h("div.b-two", {}, [
          h("div", { style: "line-height:1.5" }, [horizon({})]),
          h("div", { style: "line-height:1.5" }, [
            measure({ medium: "print" }), behindBlock({ print: true }),
          ]),
        ]),
        /* The footer is uppercase, and this token is case-sensitive: the
           only link on the keepsake could not be typed by the person
           holding it. It is set as data now, in its own case-preserving
           line, and the footer closes on the product name. */
        h("p.b-printLink", { text: "The plan stays online at " + F.shareUrlFull }),
        foot({}),
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
          h("p.b-note", { text: "Nothing has been deleted. Only the link stopped working." }),
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
        h("div.b-skel", { style: "width:100%;height:17px;margin-bottom:22px" }),
        h("div.b-skel", { style: "width:100%;height:83px;margin-bottom:14px" }),
        h("div.b-skel", { style: "width:100%;height:26px;margin-bottom:10px" }),
        h("div.b-skel", { style: "width:100%;height:23px" }),
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
    settle: function () {
      var all = document.querySelectorAll(".b-measure");
      for (var i = 0; i < all.length; i++) place(all[i]);
    },
  };
})();
