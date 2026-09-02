/* ═══════════════════════════════════════════════════════════════════
   NAMING — round 4's six misleading findings.

   Every one of them is the product asserting something untrue, and five
   of the six are in surfaces this engagement built after round 3 and then
   asserted rather than drove. That is the pattern of the whole round: the
   gates proved the new work EXISTS and never asked what it SAYS.

   A misleading finding outranks every defect, because a product that
   lies is worse than one that visibly fails — the failure is at least
   honest.
   ═══════════════════════════════════════════════════════════════════ */

export async function naming({ browser, url, check, head }) {
  head("18 · what the new surfaces say about themselves");

  const open = async (state, width = 1440) => {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 900 },
      hasTouch: width < 500, isMobile: width < 500,
    });
    await page.goto(url + `?v=paper&state=${state}`);
    await page.waitForTimeout(750);
    return page;
  };

  /* ── one word, one object ───────────────────────────────────────
     "Project" named two different things: the workspace the whole suite
     is showing, and the notebook subject a peeled task is filed under.
     The seam offered "Which project: The house" and the card that
     arrived read `Project · The Orchard, events` and `Tag · The house`. */
  {
    const page = await open("notes.seam");
    const words = await page.evaluate(() => {
      const all = document.querySelector('[data-app="notes"]');
      const labels = [...all.querySelectorAll("[aria-label]")]
        .map((e) => e.getAttribute("aria-label"))
        .filter((t) => /project/i.test(t));
      return { labels, text: /project/i.test(all.textContent || "") };
    });
    check("naming", "the seam does not call a notebook subject a project",
      words.labels.length === 0,
      words.labels.length ? words.labels[0].slice(0, 70) : "no stray use of the word");
    await page.close();
  }

  /* ── two current projects at once ───────────────────────────────
     Notes is deliberately NOT partitioned by project — it is the capture
     surface. That decision is recorded and it is not what this checks.
     What it checks is that Notes then must not NAME a project, because a
     head reading "The Orchard, events" while Tasks and Timeline both read
     "Academic Year 2026" is the app displaying two current projects at
     once. The unpartitioned index is a decision; the head is a lie. */
  {
    const page = await open("tasks.board");
    const heads = await page.evaluate(async () => {
      const b = document.querySelector('[data-act="projects"]');
      if (b.getAttribute("aria-expanded") !== "true") b.click();
      await new Promise((r) => setTimeout(r, 320));
      document.querySelector('[data-project="dinners"]').click();
      await new Promise((r) => setTimeout(r, 900));
      const notes = document.querySelector('[data-app="notes"]');
      const head = (notes.querySelector(".head") || notes).textContent || "";
      /* A PROJECT name, not any name. "Mara & Finn" is a notebook SUBJECT
         and the index is deliberately cross-project — that decision is
         recorded. The lie was the h1 painting a workspace, so this asks
         whether Notes names a workspace at all, which is the thing it must
         not do while Tasks and Timeline show a different one. */
      const projects = window.PROJECTS.list.map((x) => x.name);
      return {
        tasks: (document.querySelector(".projSwitch span") || {}).textContent || "",
        notesNames: projects.some((n) => head.includes(n)),
      };
    });
    check("naming", "Notes does not name a project the rest of the suite has left",
      /Winter dinner series/.test(heads.tasks) && heads.notesNames === false,
      `tasks:"${heads.tasks}" notesHeadNamesOrchard:${heads.notesNames}`);
    await page.close();
  }

  /* ── a new project invents nothing ──────────────────────────────
     `createProject` hard-copied The Orchard's wedding-season bounds into
     every project it minted: a brand-new project opened reading "day 1 of
     97" and a Planning axis measuring 6 Jul to 10 Oct, when nobody had
     typed a date. */
  {
    const page = await open("tasks.board");
    const fresh = await page.evaluate(async () => {
      const b = document.querySelector('[data-act="projects"]');
      if (b.getAttribute("aria-expanded") !== "true") b.click();
      await new Promise((r) => setTimeout(r, 320));
      document.querySelector('[data-act="project-new"]').click();
      await new Promise((r) => setTimeout(r, 320));
      const f = document.querySelector(".projField");
      f.value = "Nora & Cian";
      f.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 900));
      /* Close the switcher first: it renders INSIDE `.head`, so reading the
         head with it open reads the whole project list back and every
         assertion about the head's own words is meaningless. */
      (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 320));
      const headEl = document.querySelector('[data-app="tasks"] .head');
      const clone = headEl.cloneNode(true);
      clone.querySelectorAll(".projMenu").forEach((n) => n.remove());
      const head = clone.textContent || "";
      /* And Planning's own axis, which reads the period. */
      const plan = document.querySelector('[data-act="planning"]');
      if (plan) { plan.click(); await new Promise((r) => setTimeout(r, 500)); }
      const axis = [...document.querySelectorAll(".axisEnds span")].map((s) => s.textContent.trim());
      return { head: head.replace(/\s+/g, " "), axis, period: window.BOARD.period };
    });
    /* Word-bounded. "Thu 16 Jul" contains the substring "6 Jul", so an
       unbounded match failed a head that had already been fixed — the
       today-stamp was flagged as the venue's season. */
    const season = /6 Jul|10 Oct|day 1 of 97|of 97/;
    const invented = season.test(fresh.head) || fresh.axis.some((a) => season.test(a));
    check("naming", "a new project does not inherit another project's season",
      !invented,
      `head "${fresh.head.slice(0, 80)}" · axis ${JSON.stringify(fresh.axis)} · period ${JSON.stringify(fresh.period)}`);
    await page.close();
  }

  /* ── a door that answers only in the live region ────────────────
     Four controls in Notes changed nothing on screen when pressed — same
     innerText, same node count, no title, no aria-disabled, no popover.
     The only answer was a string a sighted reader never receives. Every
     other closed door in the suite carries `aria-disabled` and a title. */
  {
    const page = await open("notes.notebook");
    const mute = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[data-app="notes"] .verb, [data-app="notes"] [data-act]')) {
        if (el.getBoundingClientRect().width < 2) continue;
        const t = (el.textContent || "").trim();
        if (!/photo|option/i.test(t)) continue;
        out.push({
          what: t.slice(0, 22),
          disabled: el.getAttribute("aria-disabled") === "true",
          says: /not here yet|another screen/i.test(el.getAttribute("title") || ""),
        });
      }
      return out;
    });
    check("naming", "Notes' unavailable verbs say so the way every other door does",
      mute.length === 0 || mute.every((m) => m.disabled && m.says),
      mute.length ? JSON.stringify(mute) : "none on this surface");
    await page.close();
  }

  /* ── one glyph, one meaning ─────────────────────────────────────
     The rail's More door and every create control in the suite drew the
     identical plus path. At 390 they land 52px apart in the same dock. */
  {
    const page = await open("tasks.board", 390);
    const glyphs = await page.evaluate(() => {
      /* The whole mark, not its first <path>. The grid glyph is drawn from
         rects and a circle and has no path at all, so comparing paths
         reported it as an empty string and failed a mark that is now
         plainly different. */
      const path = (el) => {
        const svg = el.querySelector("svg");
        return svg ? svg.innerHTML.replace(/\s+/g, " ").trim() : "";
      };
      const more = document.querySelector('.rail [data-rail="more"]');
      const add = document.querySelector('.rail [data-rail="add"]');
      return {
        more: more ? path(more) : "",
        add: add ? path(add) : "",
        bothVisible: Boolean(more && add && more.offsetParent && add.offsetParent),
      };
    });
    check("naming", "the More door and the add button do not draw the same mark",
      glyphs.more !== glyphs.add && glyphs.more.length > 0,
      `more "${glyphs.more.slice(0, 26)}" vs add "${glyphs.add.slice(0, 26)}"`);
    await page.close();
  }

  /* ── Escape belongs to the topmost layer ────────────────────────
     A picked-up card survived the opening of a modal dialog, and the
     dialog's own dismiss key was then eaten by the carry: the card was
     thrown back to where it started, the dialog stayed open, and focus
     parked under the scrim. A keystroke destroyed work without saying so. */
  {
    const page = await open("tasks.board");
    const esc = await page.evaluate(async () => {
      const card = document.querySelector('.board [data-lane="todo"] .card');
      const id = card.dataset.id;
      const lane = () => {
        const c = document.querySelector(`.card[data-id="${id}"]`);
        return c ? c.closest("[data-lane]").dataset.lane : null;
      };
      card.focus();
      const key = (k) => document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
      key(" ");                                  /* pick it up  */
      key("ArrowRight");                         /* walk it     */
      await new Promise((r) => setTimeout(r, 260));
      const moved = lane();
      key("Enter");                              /* open the task */
      await new Promise((r) => setTimeout(r, 450));
      const opened = Boolean(document.querySelector(".taskPanel"));
      (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 400));
      return {
        opened,
        movedTo: moved,
        closedPanel: !document.querySelector(".taskPanel"),
        stillThere: lane(),
      };
    });
    check("naming", "Escape closes the dialog rather than silently undoing a move",
      esc.opened && esc.closedPanel && esc.stillThere === esc.movedTo,
      `opened:${esc.opened} closed:${esc.closedPanel} lane ${esc.movedTo} → ${esc.stillThere}`);
    await page.close();
  }
}
