/* ═══════════════════════════════════════════════════════════════════
   DIRECTION A · THE PROGRAMME — the renderer.

   One builder, `sheet()`, makes the artifact. Every state in this file
   is that same sheet under different conditions, which is the direction
   argument expressed in code: there are not five surfaces here, there is
   one object seen five ways.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var C = window.__TLCORE, F = C.F, h = C.h;

  /* The repo maps state `now` to the string "Happening now"
     (src/modules/timeline/lib/vocabulary.ts). On this fixture the `now`
     milestone is sixteen days away, so that label is not true, and a
     plan that says something untrue in its loudest line is finished
     before it starts. The label is derived from the date instead: it
     only says "Happening now" when it is. Proposed additively — see
     DIRECTIONS.md. */
  function conditionLabel(state, item) {
    if (state !== "now") return F.stateLabel[state];
    if (!item || !item.date) return "Next";
    return F.daysTo(item.date) <= 0 ? "Happening now" : "Next";
  }

  var ORDER = ["covered", "now", "next", "later", "cancelled"];

  function groups() {
    var out = [];
    ORDER.forEach(function (state) {
      var items = F.milestones.filter(function (m) { return m.state === state; });
      if (items.length) out.push({ state: state, items: items });
    });
    return out;
  }

  /* One accessor for every number on the sheet, so the masthead cannot
     disagree with the rows underneath it. */
  function factsLine() {
    var c = F.counts();
    return h("p.a-facts", {}, [
      h("span.num", {}, [h("b", { text: String(F.toDay()) }), " days to go"]),
      h("span.num", {}, [h("b", { text: c.done + " of " + c.total }), " done"]),
      c.cancelled ? h("span.num", {}, [h("b", { text: String(c.cancelled) }), " not going ahead"]) : null,
    ]);
  }

  function masthead(opts) {
    return h("header.a-mast", {}, [
      h("p.a-kicker", { text: opts.kicker }),
      h("h1.a-names", { text: F.project.name }),
      h("p.a-day", {}, [F.project.primaryDate.label + ", " + F.fmt.longYear(F.project.primaryDate.date)]),
      opts.facts === false ? null : factsLine(),
    ]);
  }

  function row(item, opts) {
    var isAnchor = item.date === F.project.primaryDate.date;
    var kids = [
      h("span.a-date.num", {
        text: item.date ? F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date) : "No date",
      }),
      h("p.a-title", { "data-clamp": "true", text: item.title }),
    ];
    if (opts && opts.owner) {
      kids.push(h("button.a-vis", {
        type: "button",
        "aria-label": item.state === "cancelled"
          ? item.title + " — not going ahead, still shown to guests. Change what guests see."
          : item.title + " — shown to guests. Change what guests see.",
        text: "shown",
      }));
    }
    return h("div.a-row" + (opts && opts.owner ? ".a-ownerRow" : ""), {
      "data-id": item.id,
      "data-state": item.state,
      "data-anchor": isAnchor ? "true" : null,
    }, kids);
  }

  function register(opts) {
    var o = opts || {};
    var todayDrawn = false;
    return h("div.a-register", {}, groups().map(function (group) {
      var label = conditionLabel(group.state, group.items[0]);
      var kids = [
        /* No count beside the condition: the facts line above already
           states every number this sheet knows, and a second copy is a
           second chance to disagree with itself. */
        h("h2.a-groupLabel", { text: label }),
      ];
      /* Today is drawn once, immediately before the first thing that has
         not happened yet, and only when the accent is asked to carry
         structure. A date on a plan with no anchor for today makes the
         reader do arithmetic. */
      if (!todayDrawn && group.state !== "covered") {
        todayDrawn = true;
        kids.push(h("p.a-today", {}, ["Today, " + F.fmt.medium(F.today)]));
      }
      group.items.forEach(function (item) { kids.push(row(item, o)); });
      if (group.state === "covered") {
        kids.push(h("p.a-fold", {
          text: group.items.length + " already done, the last of them "
            + F.fmt.medium(group.items[group.items.length - 1].date) + ".",
        }));
      }
      return h("section.a-group", { "data-state": group.state }, kids);
    }));
  }

  function foot() {
    return h("footer.a-foot", {}, [
      h("span", { text: "Kept by " + F.workspace.owner }),
      h("span", { text: "Updated " + F.updatedLabel }),
      h("span", { text: "Signal Timeline" }),
    ]);
  }

  function sheet(opts) {
    var o = opts || {};
    return h("article.a-sheet", { "aria-label": "The plan for " + F.project.name }, [
      masthead(o),
      register(o),
      foot(),
    ]);
  }

  /* ── owner chrome ─────────────────────────────────────────────── */
  function bench(projectName, actions) {
    return h("div.a-bench", {}, [
      h("span.a-benchWhere", { text: F.workspace.name }),
      h("button.a-switch", { type: "button", "aria-label": "Change project. Currently " + projectName }, [
        projectName,
        h("span", { text: "change" }),
      ]),
      h("div.a-benchSpacer"),
      actions,
    ]);
  }

  function act(label, primary) {
    return h("button.a-act", { type: "button", "data-primary": primary ? "true" : null, text: label });
  }

  /* ── the states ───────────────────────────────────────────────── */
  var states = {};

  states["owner-flight"] = function () {
    return h("div", {}, [
      bench(F.project.name, h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
        act("Add a moment"), act("Reorder"), act("Preview"), act("Publish", true),
      ])),
      h("div.a-benchSheet", { style: "max-width:794px;margin:0 auto;line-height:1.5" }, [
        h("div.tl-paperEdge", {}, [sheet({ kicker: "The sheet as it stands", owner: true })]),
        h("p.a-note", { style: "margin-top:14px;text-align:center;line-height:1.55" },
          ["This sheet is live. Anyone holding the link can read it."]),
      ]),
    ]);
  };

  states["owner-empty"] = function () {
    var sibling = F.siblings[1];   /* Aisling & Tom, real, and genuinely empty */
    return h("div", {}, [
      bench(sibling.name, h("div", { style: "display:flex;gap:10px;line-height:1.5" }, [act("Preview")])),
      h("div", { style: "max-width:794px;margin:0 auto;line-height:1.5" }, [
        h("div.tl-paperEdge", {}, [
          h("div.a-empty", {}, [
            h("div.a-emptyRule"),
            h("p.a-kicker", { text: "A new sheet" }),
            h("h1.a-emptyTitle", { text: "Set the day." }),
            h("p.a-emptyBody", { text: "Everything else on this sheet follows from it." }),
            h("div.a-emptyForm", {}, [
              h("label.a-fieldLabel", { for: "a-empty-date", text: "The day" }),
              h("input.a-input", {
                id: "a-empty-date", type: "text", "data-mono": "true",
                placeholder: "3 October 2026", style: "max-width:220px",
                "aria-label": "The day",
              }),
              act("Set the day", true),
            ]),
            h("p.a-emptyLater", { text: "Moments can be added once the day is set." }),
          ]),
        ]),
      ]),
    ]);
  };

  states["owner-editing"] = function () {
    var target = F.milestones.filter(function (m) { return m.id === "demo-audience-item-invitations"; })[0];
    var node = h("div", {}, [
      bench(F.project.name, h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
        act("Add a moment"), act("Reorder"), act("Preview"), act("Publish", true),
      ])),
      h("div", { style: "max-width:794px;margin:0 auto;line-height:1.5" }, [
        h("div.tl-paperEdge", {}, [
          h("article.a-sheet", { "aria-label": "The plan for " + F.project.name }, [
            masthead({ kicker: "The sheet as it stands" }),
            editingRegister(target),
            foot(),
          ]),
        ]),
        h("div.a-undo", { role: "status" }, [
          h("span", { text: "Last change: the invitations moved to Saturday 8 August." }),
          h("button", { type: "button", text: "Undo" }),
          h("kbd", { text: "Ctrl Z" }),
        ]),
      ]),
    ]);
    return node;
  };

  function editingRegister(target) {
    var node = register({});
    /* The editor takes the row's own place in the register. The plan
       stays on screen because the plan is what you are judging the
       change against. */
    /* Match on the item id, never on rendered text. data-full is written
       by the word-safe clamp during settle(), which has not run at render
       time, so matching on it produced no editor at all: the row looked
       normal and the whole state was quietly a lie. */
    var rows = node.querySelectorAll(".a-row[data-id='" + target.id + "']");
    for (var i = 0; i < rows.length; i++) {
      var editor = h("div.a-edit", {}, [
        h("div.a-field", {}, [
          h("label.a-fieldLabel", { for: "a-edit-title", text: "What it is" }),
          h("input.a-input", { id: "a-edit-title", type: "text", value: target.title, "aria-label": "What it is" }),
        ]),
        h("div.a-field", {}, [
          h("label.a-fieldLabel", { for: "a-edit-date", text: "When" }),
          h("input.a-input", {
            id: "a-edit-date", type: "text", "data-mono": "true",
            value: F.fmt.longYear(target.date), style: "max-width:280px", "aria-label": "When",
          }),
        ]),
        h("div.a-field", {}, [
          h("span.a-fieldLabel", { id: "a-edit-vis-label", text: "What guests see" }),
          h("div.a-seg", { role: "group", "aria-labelledby": "a-edit-vis-label" }, [
            h("button", { type: "button", "aria-pressed": "true", text: "On the shared sheet" }),
            h("button", { type: "button", "aria-pressed": "false", text: "Kept private" }),
          ]),
        ]),
        h("div.a-editActs", {}, [
          act("Done", true),
          h("button.a-act", { type: "button", text: "Remove from the sheet" }),
        ]),
      ]);
      rows[i].appendChild(editor);
      rows[i].setAttribute("data-editing", "true");
      break;
    }
    return node;
  }

  states.publish = function () {
    var node = h("div.a-press", {}, [
      h("header.a-pressHead", {}, [
        h("p.a-kicker", { text: "The moment it becomes theirs" }),
        h("h2.a-pressTitle", { text: "Print it for " + F.project.name + "." }),
        h("p.a-pressBody", {
          text: "This makes a copy that is theirs. It carries the plan and nothing else: "
            + "no notes, no suppliers, no prices, no way back into your workspace.",
        }),
      ]),
      h("div.a-pressCols", {}, [
      h("div.a-pressSheet", {}, [
        sheet({ kicker: "What they will hold" }),
        h("span.a-stamp", { text: "Printed 16 July 2026" }),
      ]),
      h("div.a-pressPanel", {}, [
        h("div.a-link", {}, [
          h("span", { text: F.shareUrl }),
        ]),
        h("div.a-pressActs", {}, [
          h("button.a-act", {
            type: "button", "data-primary": "true", text: "Print the sheet",
            on: {
              click: function () {
                var root = C.rootEl();
                root.setAttribute("data-pressed", root.getAttribute("data-pressed") === "true" ? "false" : "true");
              },
            },
          }),
          act("Copy the link"),
        ]),
        h("p.a-note", { text: "You can turn the link off at any time. Anyone holding it then sees that it has ended." }),
      ]),
      ]),
    ]);
    return node;
  };

  states.phone = function () {
    return h("div.tl-device", {}, [sheet({ kicker: "A wedding timeline" })]);
  };

  states.desk = function () {
    return h("div.tl-paperEdge", {}, [sheet({ kicker: "A wedding timeline" })]);
  };

  states.day = function () {
    var done = F.live().filter(function (m) { return m.date && F.days(m.date, F.project.primaryDate.date) > 0; });
    return h("div.tl-device", {}, [
      h("article.a-sheet", { "aria-label": "The plan for " + F.project.name + ", today" }, [
        h("header.a-dayMast", {}, [
          h("p.a-dayKicker", { text: "Today" }),
          h("h1.a-dayNames", { text: F.project.name }),
          h("p.a-dayDate", { text: F.fmt.longYear(F.project.primaryDate.date) }),
        ]),
        h("div.a-dayLine", {}, [
          h("h2.a-dayLineTitle", { text: "Wedding day" }),
          h("p.a-dayLineNote", { text: "The Orchard" }),
        ]),
        h("div", { style: "border-top:1px solid var(--ink-16);padding-top:18px;line-height:1.5" }, [
          h("p.a-kicker", { text: "Everything before today" }),
          h("p.a-fold", { style: "display:block;padding-top:0", text: done.length + " moments, all of them done. The last was the venue walk-through on " + F.fmt.medium("2026-09-19") + "." }),
        ]),
        foot(),
      ]),
    ]);
  };

  states.print = function () {
    return h("div.tl-paperEdge", { style: "min-height:1123px" }, [
      h("article.a-sheet", { "aria-label": "The printed sheet" }, [
        masthead({ kicker: "A wedding timeline" }),
        register({}),
        h("footer.a-foot", {}, [
          h("span", { text: "Kept by " + F.workspace.owner }),
          h("span", { text: "Updated " + F.updatedLabel }),
          h("span", { text: F.shareUrl }),
        ]),
      ]),
    ]);
  };

  states.unfurl = function () {
    return h("div.a-chat", {}, [
      h("p.a-bubble", { text: "Here is everything, love. It updates itself." }),
      h("a.a-unfurl", { href: F.shareUrlFull, "aria-label": "Mara & Finn, a wedding timeline" }, [
        h("div.a-og", {}, [
          h("p.a-ogNames", { text: F.project.name }),
          h("p.a-ogDate", { text: F.fmt.longYear(F.project.primaryDate.date) }),
          h("div.a-ogRule"),
          h("p.a-ogDays.num", { text: F.toDay() + " days to go" }),
        ]),
        h("div.a-unfurlMeta", {}, [
          h("p.a-unfurlTitle", { text: F.project.name + ", a wedding timeline" }),
          h("p.a-unfurlHost", { text: "timeline.signalstudio.ie" }),
        ]),
      ]),
    ]);
  };

  states.ended = function () {
    return h("div.tl-device", {}, [
      h("div.a-ended", {}, [
        h("p.a-kicker", { text: "Signal Timeline" }),
        h("h1.a-endedTitle", { text: "This link has been turned off." }),
        h("p.a-endedBody", {
          text: "The plan for " + F.project.name + " is no longer shared here. "
            + F.workspace.owner + " can send a new link whenever they want to.",
        }),
        h("p.a-note", { text: "Nothing you saw before has been deleted. It is just not public any more." }),
      ]),
    ]);
  };

  states.loading = function () {
    /* Only the sections that will actually render, at their real
       geometry: the masthead block, then one row for every group this
       plan has. Not one shimmer, not one invented section. */
    var g = groups();
    return h("div.tl-device", {}, [
      h("div.a-sheet", { "aria-busy": "true", "aria-label": "Loading the plan" }, [
        h("div.a-skel", { style: "width:96px;height:11px;margin-bottom:14px" }),
        h("div.a-skel", { style: "width:78%;height:38px;margin-bottom:10px" }),
        h("div.a-skel", { style: "width:58%;height:17px" }),
        h("div", { style: "border-top:1px solid var(--ink-16);margin-top:20px;padding-top:12px;line-height:1.5" }, [
          h("div.a-skel", { style: "width:64%;height:12px" }),
        ]),
        h("div", { style: "margin-top:26px;line-height:1.5" }, g.map(function (group, i) {
          return h("div", { style: i ? "margin-top:22px;line-height:1.5" : "line-height:1.5" }, [
            h("div.a-skel", { style: "width:110px;height:11px;margin-bottom:16px" }),
            h("div.a-skelRow", {}, [
              h("div.a-skel", { style: "height:13px" }),
              h("div.a-skel", { style: "height:17px;width:" + [72, 64, 80, 68, 58][i % 5] + "%" }),
            ]),
          ]);
        })),
      ]),
    ]);
  };

  var MEDIUM = {
    "owner-flight": "full", "owner-empty": "full", "owner-editing": "full", publish: "full",
    phone: "phone", desk: "sheet", day: "phone", print: "sheet",
    unfurl: "card", ended: "phone", loading: "phone",
  };

  window.__TLD.a = {
    name: "A · The Programme",
    medium: function (state) { return MEDIUM[state] || "full"; },
    render: function (state) { return (states[state] || states.phone)(); },
  };
})();
