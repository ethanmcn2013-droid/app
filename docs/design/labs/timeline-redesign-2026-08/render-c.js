/* ═══════════════════════════════════════════════════════════════════
   DIRECTION C · THE ANSWER — the renderer.

   Two objects: `answer()` and `plan()`. Everything in this file is one
   of those two, or both stacked. The owner sees the same `answer()` a
   guest does, live, at real phone width, which is the direction's whole
   claim about where editing belongs.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var C = window.__TLCORE, F = C.F, h = C.h;

  function lead() { return F.nextUp(); }

  function answer(opts) {
    var o = opts || {};
    var next = lead();
    var away = F.daysTo(next.date);
    return h("section.c-answer", { "aria-label": "What is next for " + F.project.name }, [
      h("p.c-who", { text: F.project.name }),
      h("div.c-answerBody", {}, [
        h("p.c-label", { text: away <= 0 ? "Happening now" : "Next" }),
        h("h1.c-headline", { text: next.title }),
        h("p.c-line", { text: F.fmt.longYear(next.date) }),
        h("p.c-lineQuiet", { text: "in " + away + " days" }),
      ]),
      h("div.c-rule"),
      h("div.c-dayBlock", {}, [
        h("p.c-dayLabel", { text: F.project.primaryDate.label }),
        h("p.c-dayValue", { text: F.fmt.longYear(F.project.primaryDate.date) }),
        h("p.c-dayAway.num", { text: F.toDay() + " days away" }),
      ]),
      o.more === false ? null : h("button.c-more", {
        type: "button",
        "aria-label": "Open the whole plan, " + F.counts().total + " moments",
      }, [
        h("span", { text: "The whole plan" }),
        h("span", { text: F.counts().total + " moments" }),
      ]),
    ]);
  }

  /* The plan under the answer. Conditions are named in words, the row
     the answer is about carries the only accent mark down here, and the
     numbers all come from the same accessor as the card above. */
  var ORDER = ["covered", "now", "next", "later", "cancelled"];

  function plan(opts) {
    var o = opts || {};
    var next = lead();
    var rows = [];
    ORDER.forEach(function (state) {
      var items = F.milestones.filter(function (m) { return m.state === state; });
      if (!items.length) return;
      var label = state === "now"
        ? (F.daysTo(items[0].date) <= 0 ? "Happening now" : "Next")
        : F.stateLabel[state];
      rows.push(h("h3.c-planCondition", { text: label }));
      if (state === "now") rows.push(h("p.c-planTodayRule", { text: "Today, " + F.fmt.medium(F.today) }));
      items.forEach(function (item) {
        var kids = [
          h("span.c-planDate.num", {
            text: item.date ? F.fmt.weekdayShort(item.date) + " " + F.fmt.short(item.date) : "No date",
          }),
          h("p.c-planTitle", { "data-clamp": "true", text: item.title }),
        ];
        if (o.owner) {
          kids.push(h("button.c-vis", {
            type: "button",
            "aria-label": item.title + " — shown to guests. Change what guests see.",
            text: "shown",
          }));
        }
        rows.push(h("div.c-planRow" + (o.owner ? ".c-ownerRow" : ""), {
          "data-state": item.state,
          "data-past": state === "covered" ? "true" : null,
          "data-lead": item === next ? "true" : null,
          "data-id": item.id,
        }, kids));
      });
      if (state === "covered") {
        rows.push(h("p.c-planFold", {
          text: items.length + " already done, the last of them " + F.fmt.medium(items[items.length - 1].date) + ".",
        }));
      }
    });

    var c = F.counts();
    return h("section.c-plan", {}, [
      h("h2.c-planLabel", { text: "The whole plan" }),
      h("p.c-planNote.num", {
        text: c.total + " moments, " + c.done + " of them done. One is not going ahead.",
      }),
      h("div.c-planGrid", {}, rows),
      o.foot === false ? null : h("footer.c-foot", {}, [
        h("span", { text: "Kept by " + F.workspace.owner }),
        h("span", { text: "Updated " + F.updatedLabel }),
        h("span", { text: "Signal Timeline" }),
      ]),
    ]);
  }

  function act(label, primary) {
    return h("button.c-act", { type: "button", "data-primary": primary ? "true" : null, text: label });
  }

  function bar(projectName, actions) {
    return h("div.c-bar", {}, [
      h("span.c-where", { text: F.workspace.name }),
      h("button.c-switch", { type: "button", "aria-label": "Change project. Currently " + projectName }, [
        projectName, h("span", { text: "change" }),
      ]),
      h("div.c-spacer"),
      actions,
    ]);
  }

  var states = {};

  states.phone = function () {
    return h("div.tl-device", {}, [answer({}), plan({})]);
  };

  states.desk = function () {
    return h("div.tl-paperEdge", {}, [answer({ more: false }), plan({})]);
  };

  states["owner-flight"] = function () {
    return h("div", {}, [
      bar(F.project.name, h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
        act("Add a moment"), act("Reorder"), act("Publish", true),
      ])),
      h("div.c-studio", {}, [
        h("div", { style: "line-height:1.5" }, [
          h("p.c-previewLabel", { text: "What they see first" }),
          h("div.c-preview", {}, [answer({ more: false })]),
        ]),
        h("div", { style: "line-height:1.5" }, [
          h("h2.c-editorHead", { text: "The plan" }),
          h("p.c-editorNote", {
            text: "Change anything here and the card on the left changes with it. "
              + "The card is what a guest reads, so it is the thing to keep true.",
          }),
          plan({ owner: true }),
        ]),
      ]),
    ]);
  };

  states["owner-empty"] = function () {
    var sibling = F.siblings[1];   /* Aisling & Tom — real, and genuinely empty */
    return h("div", {}, [
      bar(sibling.name, h("div", { style: "display:flex;gap:10px;line-height:1.5" }, [act("Preview")])),
      h("div.c-studio", {}, [
        h("div", { style: "line-height:1.5" }, [
          h("p.c-previewLabel", { text: "What they will see first" }),
          h("div.c-preview", {}, [
            h("div.c-empty", {}, [
              h("p.c-who", { text: sibling.name }),
              h("div", { style: "margin-top:26px;line-height:1.5" }, [
                h("h1.c-emptyTitle", { text: "When is the day?" }),
                h("p.c-emptyBody", { text: "It is the first thing a guest reads, so it is the first thing to set." }),
                h("label.c-dayLabel", { for: "c-empty-date", text: "The day" }),
                h("input.c-emptyInput", {
                  id: "c-empty-date", type: "text", placeholder: "3 October 2026",
                  style: "margin-top:8px", "aria-label": "The day",
                }),
                h("button.c-emptyAct", { type: "button", text: "Set the day" }),
              ]),
            ]),
          ]),
        ]),
        h("div", { style: "line-height:1.5" }, [
          h("h2.c-editorHead", { text: "The plan" }),
          h("p.c-editorNote", { text: "Nothing has been added yet. The day comes first, then the moments on the way to it." }),
        ]),
      ]),
    ]);
  };

  states["owner-editing"] = function () {
    var target = F.milestones.filter(function (m) { return m.id === "demo-audience-item-invitations"; })[0];
    var node = states["owner-flight"]();
    var host = node.querySelector('[data-id="' + target.id + '"]');
    if (host) {
      host.appendChild(h("div.c-edit", {}, [
        h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
          h("label.c-label2", { for: "c-edit-title", text: "What it is" }),
          h("input.c-input", { id: "c-edit-title", type: "text", value: target.title, "aria-label": "What it is" }),
        ]),
        h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
          h("label.c-label2", { for: "c-edit-date", text: "When" }),
          h("input.c-input", {
            id: "c-edit-date", type: "text", "data-mono": "true",
            value: F.fmt.longYear(target.date), style: "max-width:280px", "aria-label": "When",
          }),
        ]),
        h("div", { style: "display:grid;gap:6px;line-height:1.5" }, [
          h("span.c-label2", { id: "c-vis", text: "What guests see" }),
          h("div.c-seg", { role: "group", "aria-labelledby": "c-vis" }, [
            h("button", { type: "button", "aria-pressed": "true", text: "On the plan" }),
            h("button", { type: "button", "aria-pressed": "false", text: "Kept private" }),
          ]),
        ]),
        h("div.c-editActs", {}, [act("Done", true), h("button.c-act", { type: "button", text: "Take it off the plan" })]),
      ]));
      host.setAttribute("data-editing", "true");
    }
    node.appendChild(h("div.c-undo", { role: "status" }, [
      h("span", { text: "Last change: the invitations moved to Saturday 8 August." }),
      h("button", { type: "button", text: "Undo" }),
      h("kbd", { text: "Ctrl Z" }),
    ]));
    return node;
  };

  states.publish = function () {
    return h("div.c-press", {}, [
      h("div", { style: "line-height:1.5" }, [
        h("p.c-previewLabel", { text: "What lands in the message" }),
        h("div.c-preview", {}, [answer({ more: false })]),
      ]),
      h("div", { style: "line-height:1.5" }, [
        h("p.c-previewLabel", { text: "The moment it becomes theirs" }),
        h("h2.c-pressTitle", { text: "Send it to " + F.project.name + "." }),
        h("p.c-pressBody", {
          text: "They get one card with the answer on it and the whole plan underneath. "
            + "Nothing from your workspace travels with it: no notes, no suppliers, no prices.",
        }),
        h("div.c-linkRow", {}, [h("span", { text: F.shareUrl })]),
        h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;line-height:1.5" }, [
          act("Send the link", true), act("Copy the link"), act("Order a printed card"),
        ]),
        h("p.c-note", { text: "You can turn the link off at any time. Anyone holding it then sees that it has ended." }),
      ]),
    ]);
  };

  states.unfurl = function () {
    var next = lead();
    return h("div.c-chat", {}, [
      h("p.c-bubble", { text: "Here is everything, love. It updates itself." }),
      h("a.c-unfurl", { href: F.shareUrlFull, "aria-label": F.project.name + ", a wedding timeline" }, [
        h("div.c-og", {}, [
          h("p.c-ogWho", { text: F.project.name }),
          h("div", { style: "line-height:1.2" }, [
            h("p.c-ogNext", { text: next.title }),
            h("p.c-ogWhen", { text: F.fmt.long(next.date) + " · " + F.toDay() + " days to the day" }),
          ]),
        ]),
        h("div.c-unfurlMeta", {}, [
          h("p.c-unfurlTitle", { text: F.project.name + ", a wedding timeline" }),
          h("p.c-unfurlHost", { text: "timeline.signalstudio.ie" }),
        ]),
      ]),
    ]);
  };

  states.day = function () {
    return h("div.tl-device", {}, [
      h("div.c-dayCard", {}, [
        h("p.c-who", { text: F.project.name }),
        h("div", { style: "line-height:1.5" }, [
          h("p.c-label", { text: "Today" }),
          h("h1.c-dayHead", { text: F.project.primaryDate.label }),
          h("p.c-dayWhen", { style: "margin-top:12px", text: F.fmt.longYear(F.project.primaryDate.date) }),
        ]),
        h("div.c-rule"),
        h("p.c-dayFoot", { text: "Everything on the plan has happened. There is nothing left to check." }),
      ]),
    ]);
  };

  states.print = function () {
    var next = lead();
    return h("div.tl-paperEdge", {}, [
      h("div.c-print", {}, [
        h("div.c-printFront", {}, [
          h("p.c-ogWho", { text: "A wedding timeline" }),
          h("div", { style: "line-height:1.5" }, [
            h("h1.c-printNames", { text: F.project.name }),
            h("p.c-printDate", { text: F.fmt.longYear(F.project.primaryDate.date) }),
          ]),
          h("p.c-ogWho", { text: "The Orchard" }),
        ]),
        h("div.c-printInside", {}, [plan({ foot: false }), h("footer.c-foot", {}, [
          h("span", { text: "Kept by " + F.workspace.owner }),
          h("span", { text: F.shareUrl }),
        ])]),
      ]),
    ]);
  };

  states.ended = function () {
    return h("div.tl-device", {}, [
      h("div.c-ended", {}, [
        h("p.c-planLabel", { text: "Signal Timeline" }),
        h("h1.c-endedTitle", { style: "margin-top:14px", text: "This link has been turned off." }),
        h("p.c-endedBody", {
          text: "The plan for " + F.project.name + " is no longer shared here. "
            + F.workspace.owner + " can send a new link whenever they want to.",
        }),
        h("p.c-note", { text: "Nothing you saw before has been deleted. It is just not public any more." }),
      ]),
    ]);
  };

  states.loading = function () {
    /* The card is the frame, and the frame is known before the data. So
       the indigo lands at once, at its real geometry, and only the words
       are reserved. Nothing shimmers, and no row of the plan is drawn:
       how many rows there are is one of the things still arriving. */
    return h("div.tl-device", {}, [
      h("div.c-answer", { "aria-busy": "true", "aria-label": "Loading the plan" }, [
        h("div.c-skel", { style: "width:120px;height:11px" }),
        h("div.c-answerBody", {}, [
          h("div.c-skel", { style: "width:60px;height:11px;margin-bottom:14px" }),
          h("div.c-skel", { style: "width:86%;height:34px;margin-bottom:8px" }),
          h("div.c-skel", { style: "width:62%;height:34px;margin-bottom:14px" }),
          h("div.c-skel", { style: "width:54%;height:17px" }),
        ]),
        h("div.c-rule"),
        h("div.c-dayBlock", {}, [
          h("div.c-skel", { style: "width:88px;height:11px" }),
          h("div.c-skel", { style: "width:74%;height:24px" }),
        ]),
      ]),
    ]);
  };

  var MEDIUM = {
    "owner-flight": "full", "owner-empty": "full", "owner-editing": "full", publish: "full",
    phone: "phone", desk: "full", day: "phone", print: "sheet",
    unfurl: "card", ended: "phone", loading: "phone",
  };

  window.__TLD.c = {
    name: "C · The Answer",
    medium: function (state) { return MEDIUM[state] || "full"; },
    render: function (state) { return (states[state] || states.phone)(); },
  };
})();
