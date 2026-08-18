/* ═══════════════════════════════════════════════════════════════════
   DIRECTION B · THE APPROACH — the renderer.

   The one number that decides this composition is PX_PER_DAY. Every
   vertical position below is `daysFromToday * PX_PER_DAY`, computed from
   the real dates, so the measure cannot flatter the plan: a fortnight
   is twice a week, on the screen, always.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var C = window.__TLCORE, F = C.F, h = C.h;

  /* Pixels per day — the only number that decides this composition.
     The tightest real gap on this plan is seven days, and an item that
     wraps to two lines is 70px on a phone and 81px at desk width. So the
     scale has to be at least 10 and 12 respectively or two items can
     touch; 12 and 14 leave a hairline of air at the tightest pair. This
     is why the measure can stay strictly proportional instead of
     quietly fudging the close ones: the scale is derived from the
     tightest gap the data actually contains.

     The consequence is a long page. That is the point. A plan that is
     seventy-nine days long should take a while to scroll. */
  var SCALE = { phone: 12, sheet: 14, full: 14, card: 12, print: 10 };
  var ROW = 92;

  function ahead() {
    return F.live()
      .filter(function (m) { return m.date && F.daysTo(m.date) > 0; })
      .sort(function (a, b) { return F.daysTo(a.date) - F.daysTo(b.date); });
  }
  function behind() {
    return F.milestones.filter(function (m) { return !m.date || F.daysTo(m.date) <= 0; });
  }

  function horizon(opts) {
    var o = opts || {};
    return h("header.b-horizon", {}, [
      h("p.b-who", { text: F.project.name }),
      h("div.b-count", {}, [
        h("span.b-num.num", { text: String(F.toDay()) }),
        h("span.b-unit", { text: "days" }),
      ]),
      h("p.b-when", { text: F.fmt.longYear(F.project.primaryDate.date) }),
      h("p.b-sub", { text: F.project.primaryDate.label + " at The Orchard" }),
      o.rule === false ? null : h("div.b-todayRule"),
      o.rule === false ? null : h("p.b-todayLabel", { text: "Today is " + F.fmt.medium(F.today) }),
      o.rule === false ? null : h("p.b-gapNote", {
        text: "Nothing is planned for the next " + F.daysTo(ahead()[0].date) + " days.",
      }),
    ]);
  }

  /* The measure. Height is the distance to the day plus one row, so the
     last item is never clipped by the container it sits in — the bottom
     of a scrolling region is where a panel looks first. */
  function measure(opts) {
    var o = opts || {};
    var px = SCALE[o.medium] || SCALE.phone;
    var items = ahead();
    var lead = items[0];
    var kids = [h("div.b-rail")];

    items.forEach(function (item) {
      var away = F.daysTo(item.date);
      var isAnchor = item.date === F.project.primaryDate.date;
      var body = [
        h("span.b-away.num", { text: String(away) }),
        h("span.b-tick", { "aria-hidden": "true" }),
        h("p.b-title", { "data-clamp": "true", text: item.title }),
        h("p.b-date", { text: F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date) }),
      ];
      if (o.owner) {
        body.push(h("button.b-grab", {
          type: "button",
          "aria-label": item.title + ", " + F.fmt.long(item.date) + ", in " + away
            + " days. Shown to guests. Open to change it.",
          text: "shown",
        }));
      }
      kids.push(h("div.b-item", {
        "data-lead": item === lead ? "true" : null,
        "data-anchor": isAnchor ? "true" : null,
        "data-id": item.id,
        style: "top:" + (away * px) + "px",
      }, body));
    });

    return h("div", { style: "line-height:1.5" }, [
      h("p.b-measureHead", { text: "days away" }),
      h("div.b-measure", {
        style: "height:" + (F.toDay() * px + ROW) + "px",
        "data-px": String(px),
        role: "list",
        "aria-label": "What is still ahead, nearest first",
      }, kids),
    ]);
  }

  function behindBlock() {
    var past = behind();
    var done = past.filter(function (m) { return m.state === "covered"; });
    return h("section.b-behind", {}, [
      h("h2.b-behindLabel", { text: "Behind you" }),
      h("p.b-behindNote", {
        text: done.length + " done, the last of them " + F.fmt.medium(done[done.length - 1].date)
          + ". One thing is not going ahead.",
      }),
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

  function field(kids, extraClass) {
    return h("div.b-field" + (extraClass || ""), { "aria-label": "The plan for " + F.project.name }, kids);
  }

  function act(label, primary) {
    return h("button.b-act", { type: "button", "data-primary": primary ? "true" : null, text: label });
  }

  function bar(projectName, actions) {
    return h("div.b-bar", {}, [
      h("span.b-where", { text: F.workspace.name }),
      h("button.b-switch", { type: "button", "aria-label": "Change project. Currently " + projectName }, [
        projectName, h("span", { text: "change" }),
      ]),
      h("div.b-spacer"),
      actions,
    ]);
  }

  var states = {};

  states.phone = function () {
    return h("div.tl-device", {}, [
      field([horizon({}), measure({ medium: "phone" }), behindBlock(), foot()]),
    ]);
  };

  states.desk = function () {
    /* At desk width the horizon holds the left and stops scrolling, and
       the approach runs down the right. Seeing both at once is the one
       thing a phone cannot give the reader, so it is the only thing this
       state does differently. */
    return h("div.tl-paperEdge", { style: "border-color:var(--paper-16)" }, [
      field([
        h("div.b-two", {}, [
          h("div.b-stick", { style: "line-height:1.5" }, [horizon({}), behindBlock()]),
          h("div", { style: "line-height:1.5" }, [measure({ medium: "full" }), foot()]),
        ]),
      ]),
    ]);
  };

  states["owner-flight"] = function () {
    return field([
      bar(F.project.name, h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
        act("Add a moment"), act("Preview"), act("Publish", true),
      ])),
      h("div.b-two", {}, [
        h("div.b-stick", { style: "line-height:1.5" }, [horizon({}), behindBlock()]),
        h("div", { style: "line-height:1.5" }, [measure({ owner: true, medium: "full" }), foot()]),
      ]),
    ]);
  };

  states["owner-empty"] = function () {
    var sibling = F.siblings[1];      /* Aisling & Tom — real, and genuinely empty */
    return field([
      bar(sibling.name, h("div", { style: "display:flex;gap:10px;line-height:1.5" }, [act("Preview")])),
      h("div.b-empty", {}, [
        h("p.b-who", { text: sibling.name }),
        h("h1.b-emptyTitle", { text: "When is the day?" }),
        h("p.b-emptyBody", { text: "Everything on this page is measured from it, so it is the only thing needed to start." }),
        h("div.b-emptyForm", {}, [
          h("label.b-label", { for: "b-empty-date", text: "The day" }),
          h("input.b-input", {
            id: "b-empty-date", type: "text", "data-mono": "true",
            placeholder: "3 October 2026", style: "max-width:240px", "aria-label": "The day",
          }),
          act("Set the day", true),
        ]),
      ]),
    ]);
  };

  states["owner-editing"] = function () {
    var target = F.milestones.filter(function (m) { return m.id === "demo-audience-item-invitations"; })[0];
    var node = field([
      bar(F.project.name, h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
        act("Add a moment"), act("Preview"), act("Publish", true),
      ])),
      h("div.b-two", {}, [
        h("div.b-stick", { style: "line-height:1.5" }, [horizon({}), behindBlock()]),
        h("div", { style: "line-height:1.5" }, [measure({ owner: true, medium: "full" }), foot()]),
      ]),
      h("div.b-undo", { role: "status" }, [
        h("span", { text: "Last change: the invitations moved seven days closer." }),
        h("button", { type: "button", text: "Undo" }),
        h("kbd", { text: "Ctrl Z" }),
      ]),
    ]);

    /* The editor opens in the item's own place on the measure, and the
       stepper moves the item while you hold it. Changing a date here is
       not filling in a field, it is pulling something nearer. */
    var host = node.querySelector('[data-id="' + target.id + '"]');
    if (host) {
      var away = F.daysTo(target.date);
      var read = h("span.b-stepRead.num", { text: F.fmt.longYear(target.date) + " · in " + away + " days" });
      var move = function (delta) {
        var item = host;
        var current = Number(item.getAttribute("data-away") || away) + delta;
        if (current < 1) current = 1;
        item.setAttribute("data-away", String(current));
        item.style.top = (current * Number(item.parentElement.getAttribute("data-px") || 14)) + "px";
        /* A bare number, like every other row. The column has one header
           and one grammar; writing "in 16" into the one row you just
           touched gives that row a second grammar nobody asked for. */
        item.querySelector(".b-away").textContent = String(current);
        read.textContent = "in " + current + " days";
      };
      host.appendChild(h("div.b-edit", {}, [
        h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
          h("label.b-label", { for: "b-edit-title", text: "What it is" }),
          h("input.b-input", { id: "b-edit-title", type: "text", value: target.title, "aria-label": "What it is" }),
        ]),
        h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
          h("span.b-label", { text: "When" }),
          h("div.b-stepRow", {}, [
            h("button.b-step", { type: "button", "aria-label": "Move a week earlier", text: "−7", on: { click: function () { move(-7); } } }),
            h("button.b-step", { type: "button", "aria-label": "Move a day earlier", text: "−1", on: { click: function () { move(-1); } } }),
            read,
            h("button.b-step", { type: "button", "aria-label": "Move a day later", text: "+1", on: { click: function () { move(1); } } }),
            h("button.b-step", { type: "button", "aria-label": "Move a week later", text: "+7", on: { click: function () { move(7); } } }),
          ]),
        ]),
        h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
          h("span.b-label", { id: "b-vis", text: "What guests see" }),
          h("div.b-seg", { role: "group", "aria-labelledby": "b-vis" }, [
            h("button", { type: "button", "aria-pressed": "true", text: "On the plan" }),
            h("button", { type: "button", "aria-pressed": "false", text: "Kept private" }),
          ]),
        ]),
        h("div.b-editActs", {}, [act("Done", true), h("button.b-act", { type: "button", text: "Take it off the plan" })]),
      ]));
      host.setAttribute("data-editing", "true");
    }
    return node;
  };

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
            text: "This is what lands in the message. It carries the day, the distance and the plan, "
              + "and nothing from your workspace: no notes, no suppliers, no prices.",
          }),
          h("div.b-linkRow", {}, [h("span", { text: F.shareUrl })]),
          h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
            act("Send the link", true), act("Copy the link"),
          ]),
          h("p.b-note", { text: "You can turn the link off at any time. Anyone holding it then sees that it has ended." }),
        ]),
      ]),
    ]);
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

  states.unfurl = function () {
    return h("div.b-chat", {}, [
      h("p.b-bubble", { text: "Here is everything, love. It updates itself." }),
      card(),
    ]);
  };

  states.day = function () {
    return h("div.tl-device", {}, [
      h("div.b-field", {}, [
        h("div.b-dayWrap", {}, [
          h("p.b-dayToday", { text: "Today" }),
          h("h1.b-dayNames", { text: F.project.name }),
          h("p.b-dayDate", { text: F.fmt.longYear(F.project.primaryDate.date) }),
          h("div.b-dayRule"),
          h("p.b-dayNote", { text: "Everything on the plan has happened. Nothing is left to count." }),
        ]),
        foot(),
      ]),
    ]);
  };

  states.print = function () {
    return h("div.tl-paperEdge", { style: "min-height:1123px" }, [
      h("div.b-print.b-field", {}, [
        /* Print sets the horizon beside the measure and drops to nine
           pixels a day: A4 is 1123px tall and the screen scale runs
           off the bottom of it. The scale changes; the proportion
           between one gap and the next does not. */
        h("div.b-two", {}, [
          h("div", { style: "line-height:1.5" }, [horizon({}), behindBlock()]),
          h("div", { style: "line-height:1.5" }, [measure({ medium: "print" })]),
        ]),
        h("footer.b-foot", {}, [
          h("span", { text: "Kept by " + F.workspace.owner }),
          h("span", { text: "Updated " + F.updatedLabel }),
          h("span", { text: F.shareUrl }),
        ]),
      ]),
    ]);
  };

  states.ended = function () {
    return h("div.tl-device", {}, [
      h("div.b-field", {}, [
        h("div.b-ended", {}, [
          h("p.b-who", { text: "Signal Timeline" }),
          h("h1.b-endedTitle", { text: "This link has been turned off." }),
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
      h("div.b-field", { "aria-busy": "true", "aria-label": "Loading the plan" }, [
        h("div.b-skel", { style: "width:120px;height:11px;margin-bottom:22px" }),
        h("div.b-skel", { style: "width:180px;height:82px;margin-bottom:14px" }),
        h("div.b-skel", { style: "width:64%;height:20px;margin-bottom:10px" }),
        h("div.b-skel", { style: "width:44%;height:15px" }),
        h("div", { style: "height:1px;background:var(--paper-16);margin:26px 0 0" }),
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
    render: function (state) { return (states[state] || states.phone)(); },
  };
})();
