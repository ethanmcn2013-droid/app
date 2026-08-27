/* ═══════════════════════════════════════════════════════════════════
   PROJECTS — the selected project is the source of truth, and nothing
   from another one is left on the floor.

   The founder's brief states the rule and then states the failure mode by
   name: "The previous project's timeline must NOT remain visible." That
   is not satisfied by the timeline being off screen — the suite never
   tears a product down, so a hidden Timeline holds whatever it last
   rendered and the reader finds it there the moment they walk the spine.

   So the assertion is not "the head changed". It is: after switching to
   a project, no phrase belonging to either OTHER project appears anywhere
   in the document — visible or hidden, in any of the three products.

   This is the check that would have caught the real bug in this work.
   `__TLFIXTURE.milestones` is a reference to an array the fixture's own
   closure holds, and `live()`, `counts()` and `nextUp()` read the closure
   variable rather than the property. Rebinding the property swapped what
   an outsider could see and left every derived reader on the previous
   project: the Timeline's NAME changed and its MOMENTS did not. A gate
   that checked the head would have passed it.
   ═══════════════════════════════════════════════════════════════════ */

/* Phrases that belong to exactly one project and could not plausibly
   appear in another. Deliberately drawn from the CONTENT rather than from
   the project name — a leak shows up as somebody else's work sitting on
   your board, not as a stray title. */
const MARKERS = {
  orchard: ["Mara & Finn", "marquee", "The Orchard reserved", "run-sheet"],
  academic: ["MK3021", "literature review", "Aldi Ireland", "dissertation"],
  school: ["5th year", "Leaving Certificate", "Edco", "predicted grades"],
};

export async function projects({ browser, url, check, head }) {
  head("15 · the project is the source of truth");

  const ids = Object.keys(MARKERS);

  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 900 },
      hasTouch: width < 500, isMobile: width < 500,
    });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(750);

    for (const target of ids) {
      const moved = await page.evaluate(async (id) => {
        const open = document.querySelector('[data-act="projects"]');
        if (!open) return { noSwitcher: true };
        if (open.getAttribute("aria-expanded") !== "true") open.click();
        await new Promise((r) => setTimeout(r, 320));
        const item = document.querySelector(`[data-project="${id}"]`);
        if (!item) return { noItem: true };
        item.click();
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true };
      }, target);

      if (moved.noSwitcher || moved.noItem) {
        check("projects", `${target} @${width} · the switcher offers it`, false,
          moved.noSwitcher ? "no switcher on the head" : "project not in the list");
        continue;
      }

      /* Everything in the document, including the two products that are
         mounted but hidden. `innerText` would skip them, which is exactly
         the blind spot this check exists to close. */
      const found = await page.evaluate((all) => {
        /* The RENDERED products, not the document. `document.body.textContent`
           includes the page's own inline <script> source, and this file's
           markers are literals inside it — so the first version of this check
           reported every project leaking into every other one, and the leak it
           had found was itself.

           Tasks and Timeline only. Notes is deliberately NOT partitioned by
           project: it is the capture surface, its own fixture already lists
           three projects, and a note is assigned to one when it crosses the
           seam. That is a product decision and it is stated here rather than
           hidden in a passing gate. */
        const scope = [...document.querySelectorAll('[data-app="tasks"], [data-app="timeline"]')]
          .map((el) => el.textContent || "").join(" ");
        const out = {};
        for (const [id, phrases] of Object.entries(all)) {
          out[id] = phrases.filter((ph) => scope.includes(ph));
        }
        return out;
      }, MARKERS);

      const strangers = ids.filter((id) => id !== target)
        .flatMap((id) => found[id].map((ph) => `${id}: “${ph}”`));

      check("projects", `${target} @${width} · nothing from another project is left in the document`,
        strangers.length === 0,
        strangers.length ? strangers.slice(0, 3).join(" · ") : "no stranger phrases anywhere");

      check("projects", `${target} @${width} · its own content is actually there`,
        found[target].length > 0,
        found[target].length ? found[target].slice(0, 2).join(" · ") : "none of its own phrases found");

      /* And the three surfaces the brief names all agree about which
         project they are showing. */
      const agree = await page.evaluate(() => ({
        board: (document.querySelector(".projSwitch span") || {}).textContent || "",
        planning: (window.BOARD && window.BOARD.planning && window.BOARD.planning.project) || "",
        /* WORKSPACE, not project. The Orchard's timeline is the wedding
           inside the venue's workspace — `project.name` is "Mara & Finn" —
           so comparing project names would demand the venue rename its
           own plan. The workspace is the thing all three surfaces share. */
        timeline: (window.__TLFIXTURE && window.__TLFIXTURE.workspace && window.__TLFIXTURE.workspace.name) || "",
        world: (window.WORLD && window.WORLD.project) || "",
      }));
      /* Planning's own axis measures the project's period. Its two ends were
         literal strings — "6 Jul" and "10 Oct" — correct for the venue's
         wedding season and wrong for every other project, so the academic
         year got an axis measuring a season that had nothing to do with it
         while the line six pixels above read the right dates. The marker
         scan above cannot see this: "6 Jul" belongs to both projects. */
      const axis = await page.evaluate(async () => {
        const open = document.querySelector('[data-act="planning"]');
        if (open && open.getAttribute("aria-expanded") !== "true") open.click();
        await new Promise((r) => setTimeout(r, 450));
        const ends = [...document.querySelectorAll(".axisEnds span")].map((s) => s.textContent.trim());
        const period = (window.BOARD && window.BOARD.period) || "";
        if (open) { open.click(); await new Promise((r) => setTimeout(r, 300)); }
        return { ends, period };
      });
      check("projects", `${target} @${width} · Planning's axis measures this project's period`,
        axis.ends.length === 2 && axis.period.includes(axis.ends[0]) && axis.period.includes(axis.ends[1]),
        `${axis.ends.join(" – ")} against "${axis.period}"`);

      const names = new Set([agree.board, agree.planning, agree.timeline]);
      check("projects", `${target} @${width} · board, planning and timeline name one project`,
        names.size === 1 && agree.world === target,
        JSON.stringify(agree));
    }
    await page.close();
  }

  /* Returning to where you started returns you to what you had. A switcher
     that cannot go back is a one-way door wearing a menu's clothes. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(750);
    const round = await page.evaluate(async () => {
      const titles = () => [...document.querySelectorAll(".board .card .cardTitle")]
        .map((e) => e.textContent.trim());
      const before = titles();
      const go = async (id) => {
        const open = document.querySelector('[data-act="projects"]');
        if (open.getAttribute("aria-expanded") !== "true") open.click();
        await new Promise((r) => setTimeout(r, 300));
        document.querySelector(`[data-project="${id}"]`).click();
        await new Promise((r) => setTimeout(r, 800));
      };
      await go("school");
      const away = titles();
      await go("orchard");
      return { same: JSON.stringify(before) === JSON.stringify(titles()), moved: JSON.stringify(before) !== JSON.stringify(away) };
    });
    check("projects", "switching away and back restores the board exactly",
      round.same === true && round.moved === true,
      `moved:${round.moved} restored:${round.same}`);
    await page.close();
  }

  /* ── naming, adding, and all of them at once ────────────────────
     A project's name is written in four places that must never disagree —
     the switcher, the board's head, Planning's own title and the
     Timeline's workspace. A rename that reaches three of them is worse
     than one that reaches none, because the fourth then quietly disagrees
     with the other three about which project you are looking at. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(800);

    const openMenu = () => page.evaluate(async () => {
      const b = document.querySelector('[data-act="projects"]');
      if (b.getAttribute("aria-expanded") !== "true") b.click();
      await new Promise((r) => setTimeout(r, 320));
    });

    /* RENAME */
    await openMenu();
    const renamed = await page.evaluate(async () => {
      document.querySelector('.projEdit[data-project="orchard"]').click();
      await new Promise((r) => setTimeout(r, 320));
      const f = document.querySelector(".projField");
      if (!f) return { noField: true };
      f.value = "The Orchard, weddings";
      f.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 800));
      return {
        head: (document.querySelector(".projSwitch span") || {}).textContent || "",
        planning: (window.BOARD.planning || {}).project || "",
        timelineWs: ((window.__TLFIXTURE || {}).workspace || {}).name || "",
        listed: window.PROJECTS.list.map((x) => x.name),
      };
    });
    const four = [renamed.head, renamed.planning, renamed.timelineWs, (renamed.listed || [])[0]];
    check("projects", "a rename reaches all four places the name is written",
      !renamed.noField && new Set(four).size === 1 && four[0] === "The Orchard, weddings",
      JSON.stringify(four));

    /* CREATE */
    await openMenu();
    const made = await page.evaluate(async () => {
      document.querySelector('[data-act="project-new"]').click();
      await new Promise((r) => setTimeout(r, 320));
      const f = document.querySelector(".projField");
      if (!f) return { noField: true };
      f.value = "Kitchen refit";
      f.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 900));
      return {
        head: (document.querySelector(".projSwitch span") || {}).textContent || "",
        cards: document.querySelectorAll(".board .card").length,
        listed: window.PROJECTS.list.length,
        /* And the OTHER projects are untouched by it existing. */
        orchard: window.PROJECTS.list.some((x) => /Orchard/.test(x.name)),
      };
    });
    check("projects", "a new project is made, opened, and genuinely empty",
      !made.noField && made.head === "Kitchen refit" && made.cards === 0 &&
      made.listed === 4 && made.orchard,
      JSON.stringify(made));

    /* ALL PROJECTS — the one view that is SUPPOSED to hold everything, so
       the leak rule is inverted here: it must contain every project's work
       and say which is which. */
    await openMenu();
    const all = await page.evaluate(async () => {
      document.querySelector('[data-project="all"]').click();
      await new Promise((r) => setTimeout(r, 900));
      const scope = document.querySelector('[data-app="tasks"]').textContent || "";
      const tl = document.querySelector('[data-app="timeline"]').textContent || "";
      const dates = [...document.querySelectorAll('[data-app="timeline"] .b-item')]
        .map((el) => el.getAttribute("data-date")).filter(Boolean);
      return {
        head: (document.querySelector(".projSwitch span") || {}).textContent || "",
        cards: document.querySelectorAll(".board .card").length,
        holdsOrchard: /marquee/.test(scope),
        holdsAcademic: /literature review/.test(scope),
        holdsSchool: /lesson plans/.test(scope),
        timelineMerged: /assignment|lesson|tasting|Menu|Semester/.test(tl),
        /* Three plans on one measure have to be in date order or the
           Timeline is drawing them on top of each other. */
        inOrder: dates.every((d, i) => i === 0 || dates[i - 1] <= d),
      };
    });
    check("projects", "All projects holds every project's work at once",
      all.head === "All projects" && all.cards > 30 &&
      all.holdsOrchard && all.holdsAcademic && all.holdsSchool,
      JSON.stringify({ head: all.head, cards: all.cards }));
    check("projects", "All projects puts three plans on one measure in date order",
      all.timelineMerged && all.inOrder === true,
      `merged:${all.timelineMerged} ordered:${all.inOrder}`);
    await page.close();
  }

  /* ── the rail, and the brand dot ────────────────────────────────
     From the founder's own rail-redesign session: the accent lands on the
     tile, the glyph and the label of the active product TOGETHER, and
     nothing else in the rail spends indigo. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(750);
    const rail = await page.evaluate(() => {
      const a = document.querySelector(".railTile[data-active]");
      if (!a) return { none: true };
      const cs = getComputedStyle(a);
      const label = a.querySelector(".railName");
      return {
        tile: cs.backgroundColor,
        glyph: cs.color,
        label: label ? getComputedStyle(label).color : "",
        /* The white pill this replaced. */
        white: /255, 255, 255/.test(cs.backgroundColor),
      };
    });
    /* The accent is #a5b4fc, not the design file's #818cf8, and the reason
       is the LABEL: the design's own rule is that tile, glyph and label take
       the accent together, and a label is text, so it owes 4.5:1 where a
       glyph owes 3:1. #818cf8 measured 4.19:1 on this tile — fine for the
       mark, under the floor for the word. Lifting one step keeps the rule
       whole instead of splitting the accent in two. */
    const indigo = /165, 180, 252/;
    check("projects", "the active product takes indigo on tile, glyph and label together",
      !rail.none && !rail.white && indigo.test(rail.glyph) && indigo.test(rail.label) &&
      indigo.test(rail.tile),
      JSON.stringify(rail));
  await page.close();
  }

  /* One brand dot, three wordmarks: indigo, and round under every radius
     preset the suite offers. */
  for (const [product, state] of [["tasks", "tasks.board"], ["notes", "notes.notebook"], ["timeline", "timeline.owner-flight"]]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url + `?v=paper&state=${state}`);
    await page.waitForTimeout(700);
    const dot = await page.evaluate((pr) => {
      const w = document.querySelector(`[data-app="${pr}"] .word`);
      if (!w) return { none: true };
      const out = [];
      for (const r of ["soft", "round", "sharp"]) {
        document.getElementById("deck").setAttribute("data-radius", r);
        w.closest("[data-app]").setAttribute("data-radius", r);
        const cs = getComputedStyle(w, "::after");
        out.push({ preset: r, radius: cs.borderTopLeftRadius, bg: cs.backgroundColor });
      }
      return { out };
    }, product);
    const ok = !dot.none && dot.out.every((d) =>
      /rgb\(79, 70, 229\)/.test(d.bg) && parseFloat(d.radius) >= 4);
    check("projects", `${product} · the wordmark's dot is indigo and round in every preset`,
      ok, dot.none ? "no wordmark" : dot.out.map((d) => `${d.preset}:${d.radius}/${d.bg}`).join(" "));
    await page.close();
  }
}
