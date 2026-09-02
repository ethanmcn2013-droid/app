/* ═══════════════════════════════════════════════════════════════════
   THE INTERACTION PASS — four techniques, and where each one earns a
   place in this suite.

     morph      a control BECOMING the surface it opens, in six places
     accordion  a height nobody measured, animated, in the task dialog
     stack      the undo strip three deep, so depth is visible as depth
     travel     an active accent moving between two adjacent slots, as
                liquid, on both axes

   Every one of these is a technique this suite adopted rather than
   invented, and every one of them is adapted rather than pasted: the
   references time their work at 250–350ms with a bounce of 0.25, and
   this suite's vocabulary says 140 / 220 and a bounce of 0.15 for
   anything an operator does more than a few times an hour. The whole
   value of settling a vocabulary is that borrowed work has to join it.

   Written before the fixes and watched failing.
   ═══════════════════════════════════════════════════════════════════ */

export async function material({ browser, url, check, head }) {
  head("20 · morph, accordion, stack and the travelling accent");

  /* ── 1 · a control becomes the surface it opens ──────────────────
     WATCHED FAILING: every one of these was a hard cut. The button
     stayed where it was, a second object appeared somewhere else, and
     the person had to work out for themselves that the two were the
     same thing one step apart. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      window.__VT = 0;
      const real = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => { window.__VT += 1; return real(cb); };
    });

    /* Each journey is driven the way a person drives it, and counted. A
       morph that fires on the click path and not the pointer path is the
       four-routes bug this file's own product has had twice. */
    const count = async (label, fn) => {
      const before = await page.evaluate(() => window.__VT);
      await fn();
      await page.waitForTimeout(650);
      const after = await page.evaluate(() => window.__VT);
      return { label, fired: after - before };
    };

    const journeys = [];
    journeys.push(await count("the Add button becomes the composer",
      () => page.click('[data-app="tasks"] .trayAdd')));
    journeys.push(await count("and folds back",
      () => page.keyboard.press("Escape")));
    journeys.push(await count("the card becomes its dialog",
      () => page.click('[data-app="tasks"] .card:not([data-draft]) .cardTitle')));
    journeys.push(await count("and the dialog folds back into the card",
      () => page.keyboard.press("Escape")));
    journeys.push(await count("a tool word becomes its panel",
      () => page.click('[data-app="tasks"] [data-act="tool"][data-tool="show"]')));
    journeys.push(await count("the project name becomes the project menu",
      () => page.click('[data-app="tasks"] [data-act="projects"]')));

    for (const j of journeys) {
      check("material", j.label, j.fired === 1, j.fired + " transitions");
    }
    check("material", "none of the six journeys throws", errs.length === 0,
      errs.slice(0, 2).join(" | "));

    /* And nothing is left carrying the pair name. It is LENT for the
       length of one transition, because five Add buttons are rendered at
       once and the card stays on the board behind its own dialog — a
       duplicate name makes Chromium skip the transition in silence. */
    const stuck = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter((e) => e.style.viewTransitionName).length);
    check("material", "the morph name is lent, never kept", stuck === 0, stuck + " left named");
    await page.close();
  }

  /* ── 2 · the accordion ───────────────────────────────────────────
     WATCHED FAILING: it was a <details>, which cannot animate its own
     opening in any browser without a Chromium-only property. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    await page.click('[data-app="tasks"] .card:not([data-draft]) .cardTitle');
    await page.waitForTimeout(700);

    const read = () => page.evaluate(() => {
      const panel = document.querySelector(".tpMorePanel");
      const inner = document.querySelector(".tpMoreInner");
      const chev = document.querySelector(".tpMoreChevron");
      const head2 = document.querySelector(".tpMoreHead");
      if (!panel || !head2) return null;
      return {
        rows: getComputedStyle(panel).gridTemplateRows,
        h: Math.round(panel.getBoundingClientRect().height),
        opacity: getComputedStyle(inner).opacity,
        turned: getComputedStyle(chev).transform,
        expanded: head2.getAttribute("aria-expanded"),
        controls: head2.getAttribute("aria-controls"),
      };
    });

    const shut = await read();
    check("material", "the dialog opens with its accordion closed",
      !!shut && shut.h === 0 && shut.expanded === "false",
      shut ? JSON.stringify(shut) : "no accordion");
    check("material", "and it is a button that says what it controls",
      !!shut && shut.controls === "tpMorePanel", shut ? shut.controls : "-");

    await page.click(".tpMoreHead");
    await page.waitForTimeout(500);
    const open = await read();
    check("material", "opening animates to a height nobody measured",
      !!open && open.h > 0 && open.rows !== "0px" && open.expanded === "true",
      open ? open.rows + " / " + open.h + "px" : "-");
    check("material", "the words arrive with the room to put them in",
      !!open && open.opacity === "1", open ? open.opacity : "-");
    check("material", "and the chevron turns",
      !!open && open.turned !== shut.turned && open.turned !== "none",
      open ? open.turned : "-");

    await page.click(".tpMoreHead");
    await page.waitForTimeout(500);
    const shutAgain = await read();
    check("material", "and it closes again to nothing",
      !!shutAgain && shutAgain.h === 0 && shutAgain.expanded === "false",
      shutAgain ? shutAgain.h + "px" : "-");
    await page.close();
  }

  /* ── 3 · the undo strip is three deep ────────────────────────────
     WATCHED FAILING: Ctrl+Z has always walked back through the history
     one act at a time and the strip said so in text — "3 more" — while
     showing exactly one pill. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    const tick = () => page.evaluate(async () => {
      const t = [...document.querySelectorAll('[data-app="tasks"] .card:not([data-draft]) .tick')]
        .find((el) => !el.closest('[data-lane="done"]'));
      if (t) t.click();
      await new Promise((r) => setTimeout(r, 420));
    });

    await tick();
    const one = await page.evaluate(() =>
      document.querySelectorAll('[data-app="tasks"] .carry').length);
    check("material", "one act, one pill", one === 1, one + " pills");

    await tick();
    await tick();
    /* SETTLED. The live pill runs its own 140ms entrance, and a first
       draft of this rule read its opacity mid-animation — 0.00 against
       0.55 and 0.28 behind it — and reported a stack that faded the wrong
       way on a stack that fades correctly. */
    await page.waitForTimeout(400);
    const stack = await page.evaluate(() => ({
      pills: [...document.querySelectorAll('[data-app="tasks"] .carry')].map((c) => ({
        depth: c.dataset.depth,
        top: Math.round(c.getBoundingClientRect().top),
        width: Math.round(c.getBoundingClientRect().width),
        opacity: Number(getComputedStyle(c).opacity),
        inert: c.hasAttribute("inert"),
        hidden: c.getAttribute("aria-hidden") === "true",
        controls: c.querySelectorAll("button").length,
      })),
      said: (document.querySelector('[data-app="tasks"] .carry[data-depth="0"]') || {}).textContent || "",
    }));
    const [live, second, third] = stack.pills;
    check("material", "three acts, three deep", stack.pills.length === 3,
      stack.pills.length + " pills");
    check("material", "the two beneath climb and shrink",
      !!third && second.top < live.top && third.top < second.top &&
      second.width < live.width && third.width < second.width,
      stack.pills.map((p) => p.top + "@" + p.width).join(" · "));
    check("material", "and fade back",
      !!third && second.opacity < live.opacity && third.opacity < second.opacity,
      stack.pills.map((p) => p.opacity.toFixed(2)).join(" · "));
    /* Only the top of the stack can be undone by one press, so only the
       top carries a control — and the others are out of the tab order
       and out of the accessibility tree entirely. */
    check("material", "only the live pill is reachable",
      live.controls > 0 && second.controls === 0 && third.controls === 0 &&
      second.inert && third.inert && second.hidden && third.hidden,
      JSON.stringify(stack.pills.map((p) => [p.controls, p.inert, p.hidden])));
    /* The count stays in words for the reader who cannot see the stack. */
    check("material", "the depth is still said in words",
      /\d+ more/.test(stack.said), stack.said.replace(/\s+/g, " ").trim().slice(0, 60));
    await page.close();
  }

  /* ── 4 · the accent travels, as liquid ───────────────────────────
     WATCHED FAILING: the rail's active accent switched off in one place
     and on in another, with nothing between them saying it was the same
     accent. Two blobs on one path, merged by an SVG filter.

     THE CONSTRAINT THAT MAKES OR BREAKS IT: a gooey filter pushes blurred
     ALPHA through the ramp `18a - 7`, so anything under about 39% alpha
     is driven to zero and erased. The rail's accent is 16%. The blobs are
     drawn OPAQUE and the layer carries the transparency — CSS applies
     `filter` before `opacity` — and a version that painted the blobs in
     the accent's own colour rendered nothing at all mid-travel. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    await page.goto(url + "?v=paper&state=notes.notebook");
    await page.waitForTimeout(900);

    check("material", "the goo filter is in the document",
      await page.evaluate(() => !!document.querySelector("#goo")), "#goo");
    /* userSpaceOnUse, not a percentage of the bounding box — the first
       host tried for this effect was a 0x0 anchor, where a percentage
       region is empty and the element is not painted at all. */
    const region = await page.evaluate(() => {
      const f = document.querySelector("#goo");
      return f ? f.getAttribute("filterUnits") : null;
    });
    check("material", "its region does not depend on a bounding box",
      region === "userSpaceOnUse", String(region));

    const slow = `
      .railGoo .gooHead { transition-duration: 1120ms !important; }
      .railGoo .gooTail { transition-duration: 1760ms !important; }
    `;
    await page.addStyleTag({ content: slow });
    await page.evaluate(() => window.__SUITE.go("timeline"));
    await page.waitForTimeout(500);
    const air = await page.evaluate(() => {
      const layer = document.querySelector(".railGoo");
      if (!layer) return null;
      const cs = getComputedStyle(layer);
      const [h, t] = [...layer.children].map((e) => e.getBoundingClientRect());
      const blob = getComputedStyle(layer.children[0]);
      return {
        filter: cs.filter,
        faded: Number(cs.opacity),
        opaqueBlob: !/rgba\([^)]*,\s*0?\.\d+\)/.test(blob.backgroundColor),
        gap: Math.round(h.top - t.top),
        text: layer.textContent.trim().length,
        tileAccent: getComputedStyle(
          document.querySelector(".railTile[data-active]")).backgroundColor,
      };
    });
    check("material", "the accent is in the air", !!air, air ? "layer present" : "no layer");
    if (air) {
      check("material", "and the two blobs are genuinely apart",
        air.gap > 40, air.gap + "px between head and tail");
      check("material", "the shapes are opaque and the LAYER is faded",
        air.opaqueBlob === true && air.faded > 0.05 && air.faded < 0.5,
        "blob opaque " + air.opaqueBlob + " · layer " + air.faded);
      check("material", "the filter is on the layer", /goo/.test(air.filter), air.filter);
      /* No text is ever drawn through this filter. */
      check("material", "nothing with words in it is filtered", air.text === 0,
        air.text + " characters inside the filtered layer");
      /* And the tile does not paint a second accent underneath. */
      check("material", "the accent is in one place at a time",
        /rgba\(0, 0, 0, 0\)|transparent|none/.test(air.tileAccent), air.tileAccent);
    }

    await page.waitForTimeout(2200);
    const landed = await page.evaluate(() => ({
      layer: !!document.querySelector(".railGoo"),
      gooing: document.querySelectorAll("[data-gooing]").length,
      accent: getComputedStyle(document.querySelector(".railTile[data-active]")).backgroundColor,
    }));
    check("material", "at rest there is no layer and no filter anywhere",
      landed.layer === false && landed.gooing === 0, JSON.stringify(landed));
    check("material", "and the tile has its accent back",
      /rgba\(165, 180, 252/.test(landed.accent), landed.accent);
    await page.close();
  }

  /* ── 5 · reduced motion gets none of it ─────────────────────────── */
  {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 950 },
      reducedMotion: "reduce",
    });
    await page.goto(url + "?v=paper&state=notes.notebook");
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__SUITE.go("timeline"));
    await page.waitForTimeout(300);
    const quiet = await page.evaluate(() => ({
      layer: !!document.querySelector(".railGoo"),
      landed: document.querySelector("#deck").getAttribute("data-product"),
    }));
    check("material", "reduced motion · nothing travels",
      quiet.layer === false, quiet.layer ? "a layer was built" : "none");
    check("material", "reduced motion · and the switch still lands",
      quiet.landed === "timeline", quiet.landed);
    await page.close();
  }

  /* ── 6 · the list is the board, read down ─────────────────────────
     STATE.md's first open item: the List view and the switcher's travel
     shipped green on a gate that never looked at either. Each claim
     below is the one the code makes about itself, read off the render:
     the list renders the board's rows in the board's order under the
     same filters, states the lane in type, walks one axis, keeps every
     drag path on `.card`, and the switcher's accent travels as liquid. */
  head("21 · the list, and the switcher's travel");
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    const boardRows = () => page.evaluate(() =>
      [...document.querySelectorAll('[data-app="tasks"] .board:not(.listBoard) .tray[data-lane]')]
        .flatMap((t) => [...t.querySelectorAll(".card[data-id]")]
          .map((c) => ({ id: c.dataset.id, lane: t.querySelector(".trayName").textContent.trim() }))));
    const listRows = () => page.evaluate(() =>
      [...document.querySelectorAll('[data-app="tasks"] .board.listBoard .lrow[data-id]')]
        .map((r) => ({ id: r.dataset.id, lane: (r.querySelector(".lrowLane") || {}).textContent || "" }))
        .map((r) => ({ id: r.id, lane: r.lane.trim() })));
    const same = (a, b) => JSON.stringify(a.map((r) => r.id)) === JSON.stringify(b.map((r) => r.id));

    const onBoard = await boardRows();
    check("material", "the board has rows to compare", onBoard.length > 0, onBoard.length + " cards");

    /* The travel, slowed the way the rail's is, so a frame can be caught. */
    await page.addStyleTag({ content: `
      [data-app="tasks"] .segGoo .gooHead { transition-duration: 1120ms !important; }
      [data-app="tasks"] .segGoo .gooTail { transition-duration: 1760ms !important; }
    ` });
    await page.click('[data-app="tasks"] .segItem[data-view="list"]');
    await page.waitForTimeout(450);
    const air = await page.evaluate(() => {
      const layer = document.querySelector('[data-app="tasks"] .segGoo');
      if (!layer) return null;
      const [h, t] = [...layer.children].map((e) => e.getBoundingClientRect());
      return { gap: Math.round(Math.abs(h.left - t.left)), filter: getComputedStyle(layer).filter,
        gooing: document.querySelector('[data-app="tasks"] .seg').hasAttribute("data-gooing") };
    });
    check("material", "the switcher's accent travels across, as liquid",
      !!air && air.gap > 12 && /goo/.test(air.filter) && air.gooing, air ? JSON.stringify(air) : "no layer");
    await page.waitForTimeout(2300);
    const landed = await page.evaluate(() => ({
      active: (document.querySelector('[data-app="tasks"] .segItem[data-active]') || {}).dataset ? document.querySelector('[data-app="tasks"] .segItem[data-active]').dataset.view : null,
      layer: !!document.querySelector('[data-app="tasks"] .segGoo'),
      list: !!document.querySelector('[data-app="tasks"] .board.listBoard'),
    }));
    check("material", "and lands on List with nothing left in the air",
      landed.active === "list" && !landed.layer && landed.list, JSON.stringify(landed));

    const inList = await listRows();
    check("material", "the list renders the board's rows in the board's order",
      inList.length > 0 && same(inList, onBoard), `${inList.length} rows against ${onBoard.length} cards`);
    const wrongLane = inList.filter((r, i) => !onBoard[i] || r.lane.toLowerCase() !== onBoard[i].lane.toLowerCase());
    check("material", "and each row states its lane in type, by the column's own name",
      inList.length > 0 && wrongLane.length === 0, wrongLane.slice(0, 3).map((r) => r.id + ":" + r.lane).join(", "));

    /* The same filter, both views. */
    await page.click('[data-app="tasks"] .head [data-act="late"]');
    await page.waitForTimeout(450);
    const listLate = await listRows();
    await page.click('[data-app="tasks"] .segItem[data-view="board"]');
    await page.waitForTimeout(800);
    const boardLate = await boardRows();
    check("material", "the same filter shows the same rows in both views",
      listLate.length > 0 && listLate.length < onBoard.length && same(listLate, boardLate),
      `${listLate.length} in the list, ${boardLate.length} on the board`);
    await page.click('[data-app="tasks"] .head [data-act="late"]');
    await page.waitForTimeout(450);

    /* One axis. */
    await page.click('[data-app="tasks"] .segItem[data-view="list"]');
    await page.waitForTimeout(800);
    await page.evaluate(() => { const s = document.querySelector('[data-app="tasks"] .lrow[tabindex="0"]'); if (s) s.focus(); });
    const rowOf = () => page.evaluate(() => { const r = document.activeElement.closest && document.activeElement.closest(".lrow"); return r ? r.dataset.id : null; });
    const start = await rowOf();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const right = await rowOf();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    const down = await rowOf();
    const order = (await listRows()).map((r) => r.id);
    const next = (id) => order[order.indexOf(id) + 1] || null;
    check("material", "the list walks one axis: sideways never jumps a lane",
      !!start && (right === start || right === next(start)), `${start} → ${right}`);
    check("material", "and down is the next row",
      !!down && down === next(right), `${right} → ${down}`);

    /* The drag paths stay on .card. */
    const drag = await page.evaluate(() => ({
      rows: document.querySelectorAll('[data-app="tasks"] .lrow[draggable="true"]').length,
      strays: [...document.querySelectorAll('[data-app="tasks"] [draggable="true"]')].filter((n) => !n.classList.contains("card")).length,
    }));
    check("material", "no list row is draggable — the drag paths stay on .card", drag.rows === 0 && drag.strays === 0, JSON.stringify(drag));
    await page.close();
  }

}
