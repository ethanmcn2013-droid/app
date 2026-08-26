/* ═══════════════════════════════════════════════════════════════════
   DELIGHT — the three moments that have to feel good without being
   noticed, and the ways each of them could quietly stop working.

   Motion is the easiest thing in a product to break silently. It has no
   layout, no text and no error: a keyframe that never runs looks exactly
   like one that runs perfectly and finishes before you looked. So each
   of these is measured while it is happening, not asserted from the
   stylesheet.

   The completion moment nearly shipped invisible. Nine nodes, correct
   colours, all animating — and the particles scaled 0.6 → 0.3 across the
   whole flight, so a 3px dot was never wider than one physical pixel.
   Every structural check passed. Only measuring the painted size caught
   it, which is why this file measures painted sizes.
   ═══════════════════════════════════════════════════════════════════ */

export async function delight({ browser, url, check, head }) {
  head("16 · the moments that have to feel good");

  const open = async (width) => {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 900 },
      hasTouch: width < 500, isMobile: width < 500,
    });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(700);
    return page;
  };

  /* ── the completion moment ──────────────────────────────────────
     Once per completion, from every route, and actually visible. */
  for (const route of ["tick", "keyboard"]) {
    const page = await open(1440);
    const seen = await page.evaluate(async (how) => {
      const fire = () => {
        if (how === "tick") {
          document.querySelector('.board [data-lane="todo"] .card .tick').click();
        } else {
          /* Space picks the card up, ArrowRight walks it to Done, Space
             drops it — the fourth door into a completion. */
          const card = document.querySelector('.board [data-lane="todo"] .card');
          card.focus();
          const key = (k) => document.activeElement.dispatchEvent(
            new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
          key(" ");
          for (let i = 0; i < 4; i++) key("ArrowRight");
          key(" ");
        }
      };
      fire();
      await new Promise((r) => setTimeout(r, 120));
      const dots = [...document.querySelectorAll(".burst i:not(.burstRing)")];
      const widths = dots.map((d) => d.getBoundingClientRect().width);
      const ops = dots.map((d) => Number(getComputedStyle(d).opacity));
      const ring = document.querySelector(".burstRing");
      const out = {
        bursts: document.querySelectorAll(".burst").length,
        dots: dots.length,
        /* PAINTED, not declared. This is the assertion the first build
           would have failed while looking perfect in the stylesheet. */
        widest: Math.max(0, ...widths),
        brightest: Math.max(0, ...ops),
        ringGrew: ring ? ring.getBoundingClientRect().width > 8 : false,
      };
      await new Promise((r) => setTimeout(r, 900));
      out.cleanedUp = document.querySelectorAll(".burst").length;
      return out;
    }, route);

    check("delight", `completion via ${route} · one burst, and it is visible`,
      seen.bursts === 1 && seen.dots === 8 && seen.widest >= 2 && seen.brightest > 0.2 && seen.ringGrew,
      `${seen.bursts} burst · ${seen.dots} dots · widest ${seen.widest.toFixed(1)}px · brightest ${seen.brightest.toFixed(2)}`);
    check("delight", `completion via ${route} · it clears itself away`,
      seen.cleanedUp === 0, `${seen.cleanedUp} left behind`);
    await page.close();
  }

  /* It must not fire on anything that is not a completion, and it must
     not fire twice for one. */
  {
    const page = await open(1440);
    const noise = await page.evaluate(async () => {
      const card = document.querySelector('.board [data-lane="doing"] .card');
      card.click();                                   /* opening a note */
      await new Promise((r) => setTimeout(r, 260));
      const afterOpen = document.querySelectorAll(".burst").length;
      document.querySelector('[data-act="projects"]').click();
      await new Promise((r) => setTimeout(r, 260));
      return { afterOpen, afterMenu: document.querySelectorAll(".burst").length };
    });
    check("delight", "nothing celebrates except a completion",
      noise.afterOpen === 0 && noise.afterMenu === 0, JSON.stringify(noise));
    await page.close();
  }

  /* Reduced motion means none of it, not a shorter version of it. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(700);
    const still = await page.evaluate(async () => {
      document.querySelector('.board [data-lane="todo"] .card .tick').click();
      await new Promise((r) => setTimeout(r, 200));
      return document.querySelectorAll(".burst").length;
    });
    check("delight", "reduced motion gets no burst at all", still === 0, `${still} bursts`);
    await page.close();
  }

  /* ── the search field ───────────────────────────────────────────
     Grows, filters, contracts, and moves nothing on the board. */
  for (const width of [1440, 390]) {
    const page = await open(width);
    const s = await page.evaluate(async () => {
      const field = () => document.querySelector('[data-app="tasks"] .dockField');
      const dock = () => document.querySelector('[data-app="tasks"] .dock');
      const centre = () => { const r = dock().getBoundingClientRect(); return Math.round(r.left + r.width / 2); };
      const firstCard = () => {
        const c = document.querySelector(".board .card");
        const r = c.getBoundingClientRect();
        return Math.round(r.left) + "," + Math.round(r.top);
      };
      const rest = { w: Math.round(field().getBoundingClientRect().width), c: centre(), card: firstCard() };
      document.querySelector(".dockInput").focus();
      await new Promise((r) => setTimeout(r, 420));
      const opened = { w: Math.round(field().getBoundingClientRect().width), c: centre(), card: firstCard() };
      const input = document.querySelector(".dockInput");
      input.value = "marquee";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 420));
      const filtered = document.querySelectorAll(".board .card").length;
      const live = document.querySelector('[data-app="tasks"] .dockField').classList.contains("is-live");
      /* Escape twice: clear, then leave. */
      const esc = () => document.querySelector(".dockInput").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      esc();
      await new Promise((r) => setTimeout(r, 300));
      const cleared = document.querySelectorAll(".board .card").length;
      document.querySelector(".dockInput").blur();
      await new Promise((r) => setTimeout(r, 420));
      const closed = Math.round(field().getBoundingClientRect().width);
      return { rest, opened, filtered, cleared, closed, live };
    });

    /* On a phone the dock is already the width of the sheet, so the field
       expands by ground and ring rather than by width — the assertion is
       "it does not shrink", not "it grows". */
    check("delight", `search @${width} · it opens`,
      width > 720 ? s.opened.w > s.rest.w + 100 : s.opened.w >= s.rest.w,
      `${s.rest.w} → ${s.opened.w}px`);
    check("delight", `search @${width} · the dock stays anchored to its own centre`,
      Math.abs(s.opened.c - s.rest.c) <= 1, `${s.rest.c} → ${s.opened.c}`);
    check("delight", `search @${width} · nothing on the board moves`,
      s.opened.card === s.rest.card, `${s.rest.card} → ${s.opened.card}`);
    check("delight", `search @${width} · it actually filters, and Escape clears it`,
      s.filtered > 0 && s.filtered < s.cleared && s.live === true,
      `${s.cleared} → ${s.filtered} → ${s.cleared}`);
    check("delight", `search @${width} · it contracts when left empty`,
      s.closed === s.rest.w, `${s.closed} vs ${s.rest.w}`);
    await page.close();
  }

  /* ── the drop target ────────────────────────────────────────────
     A tint the canvas still reads as white through, and a dot that
     answers. Measured as composited colour, because "1–3%" is a claim
     about what is painted. */
  {
    const page = await open(1440);
    const drop = await page.evaluate(async () => {
      const tray = document.querySelector('.board [data-lane="done"]');
      const pipBefore = getComputedStyle(tray.querySelector(".pip")).transform;
      tray.setAttribute("data-over", "");
      await new Promise((r) => setTimeout(r, 220));
      const cs = getComputedStyle(tray);
      const pipAfter = getComputedStyle(tray.querySelector(".pip")).transform;
      const m = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
      tray.removeAttribute("data-over");
      return { bg: cs.backgroundColor, alpha: m.length > 3 ? m[3] : 1, pipBefore, pipAfter };
    });
    check("delight", "the drop tint is faint enough that the sheet still reads white",
      drop.alpha > 0 && drop.alpha <= 0.06, `${drop.bg} — alpha ${drop.alpha}`);
    check("delight", "the lane's own dot answers the drop",
      drop.pipAfter !== drop.pipBefore, `${drop.pipBefore} → ${drop.pipAfter}`);
    await page.close();
  }

  /* ── the expanded task ──────────────────────────────────────────
     Four routes reach it — a press, a drop, Enter, and pointerup — and
     repointing three of them at the new panel left the fourth quietly
     toggling an inline note nobody could see. So the assertion drives
     more than one door. */
  for (const width of [1280, 1440, 1920]) {
    const page = await open(width);
    const r = await page.evaluate(async () => {
      const card = document.querySelector('.board [data-lane="doing"] .card');
      const id = card.dataset.id;
      const box = card.querySelector(".cardTitle").getBoundingClientRect();
      const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true };
      card.dispatchEvent(new PointerEvent("pointerdown", at));
      card.querySelector(".cardTitle").dispatchEvent(new PointerEvent("pointerup", at));
      await new Promise((r) => setTimeout(r, 400));
      const panel = document.querySelector(".taskPanel");
      const board = document.querySelector(".board");
      const out = {
        opened: Boolean(panel),
        focused: document.activeElement === panel,
        /* The board must NARROW, not be covered — the round-2 defect. */
        boardScrolls: board.scrollWidth > board.clientWidth,
        covered: (() => {
          if (!panel) return null;
          const p = panel.getBoundingClientRect();
          const max = board.scrollWidth - board.clientWidth;
          return [...board.querySelectorAll("[data-lane]")].filter((t) => {
            const b = t.getBoundingClientRect();
            const clear = b.right - (max - board.scrollLeft) <= p.left + 0.5;
            return !clear && Math.min(b.right, p.right) - Math.max(b.left, p.left) > 1;
          }).length;
        })(),
        /* The panel and the card must agree about the date. */
        panelDue: (document.querySelector(".tpFact dd") || {}).textContent || "",
        cardChip: (card.querySelector(".when, .chip, [class*=when]") || {}).textContent || "",
      };
      /* Escape closes it and gives the card back. */
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 350));
      out.closedByEsc = !document.querySelector(".taskPanel");
      out.backOnCard = document.activeElement && document.activeElement.dataset &&
        document.activeElement.dataset.id === id;
      return out;
    });
    /* `stranded === 0` is the requirement; scrolling is only the MEANS.
       At 1920 all five lanes fit beside the panel and the board has no
       travel at all — demanding a scroller there fails a board that is
       behaving perfectly, which is what the first version of this did. */
    check("delight", `task panel @${width} · opens, takes focus, and never strands a lane`,
      r.opened && r.focused && r.covered === 0,
      `opened:${r.opened} focus:${r.focused} stranded:${r.covered}` +
      (r.boardScrolls ? " (board scrolls)" : " (everything fits)"));
    check("delight", `task panel @${width} · Escape closes it and hands the card back`,
      r.closedByEsc && r.backOnCard, `closed:${r.closedByEsc} card:${r.backOnCard}`);
    check("delight", `task panel @${width} · it does not say "Not set" about a dated task`,
      !/not set/i.test(r.panelDue), `Due = ${r.panelDue}`);
    await page.close();
  }

  /* Enter is the fourth route and must reach the same surface. */
  {
    const page = await open(1440);
    const viaKey = await page.evaluate(async () => {
      const card = document.querySelector('.board [data-lane="todo"] .card');
      card.focus();
      card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 400));
      return Boolean(document.querySelector(".taskPanel"));
    });
    check("delight", "Enter opens the same expanded task a press does", viaKey === true, String(viaKey));
    await page.close();
  }

  /* ── the control surfaces ───────────────────────────────────────
     Filter, Sort, Display and Share. The founder's rule is that a person
     must always know what is active WITHOUT opening anything, so the
     load-bearing assertion here is not "the panel opens" — it is "the
     button says it is on while the panel is shut". */
  for (const width of [1440, 1920]) {
    const page = await open(width);
    const r = await page.evaluate(async () => {
      const btn = (t) => document.querySelector(`[data-act="tool"][data-tool="${t}"]`);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = { opens: {}, inView: {} };
      for (const t of ["filter", "sort", "display", "share"]) {
        btn(t).click();
        await wait(260);
        const pop = document.querySelector(".toolPop");
        out.opens[t] = Boolean(pop);
        if (pop) {
          const b = pop.getBoundingClientRect();
          out.inView[t] = b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
        }
        /* Dismissal: a press on the board closes it. */
        document.querySelector(".board").click();
        await wait(200);
        out["dismissed_" + t] = !document.querySelector(".toolPop");
      }

      /* Filter changes the board and SAYS SO on its own face. */
      const before = document.querySelectorAll(".board .card").length;
      btn("filter").click(); await wait(240);
      document.querySelector('[data-act="filter-set"][data-value="late"]').click();
      await wait(320);
      out.filtered = document.querySelectorAll(".board .card").length;
      document.querySelector(".board").click(); await wait(200);
      /* Panel SHUT, and the button still reports the live filter. */
      out.badgeWhenShut = (btn("filter").querySelector(".toolDot") || {}).textContent;
      out.panelShut = !document.querySelector(".toolPop");
      btn("filter").click(); await wait(240);
      document.querySelector('[data-act="filter-clear"]').click();
      await wait(320);
      out.cleared = document.querySelectorAll(".board .card").length;
      out.badgeGone = !btn("filter").querySelector(".toolDot");

      /* Sort actually reorders. */
      /* Every lane, not one. The To do lane's manual order happens to be
         alphabetical already — Confirm, Reprint, Send — so asserting "it
         changed" against that one lane failed a sort that was working
         perfectly. The requirement is that EVERY lane comes out ordered,
         and that at least one of them actually had to move to get there. */
      const laneTitles = () => [...document.querySelectorAll(".board [data-lane]")]
        .map((l) => [...l.querySelectorAll(".card .cardTitle")].map((e) => e.textContent.trim()));
      const manual = laneTitles();
      btn("sort").click(); await wait(240);
      document.querySelector('[data-act="sort-set"][data-value="title"]').click();
      await wait(320);
      const az = laneTitles();
      out.sorted = JSON.stringify(manual) !== JSON.stringify(az);
      out.reallyAZ = az.every((lane) =>
        JSON.stringify(lane) === JSON.stringify([...lane].sort((a, b) => a.localeCompare(b))));
      out.sortDot = Boolean(btn("sort").querySelector(".toolDot"));
      document.querySelector(".board").click(); await wait(200);

      /* Display actually changes the card. */
      const notesBefore = document.querySelectorAll(".board .cardNote").length;
      btn("display").click(); await wait(240);
      document.querySelector('[data-act="display-notes"][data-value="off"]').click();
      await wait(320);
      const shown = [...document.querySelectorAll(".board .cardNote")]
        .filter((n) => n.getBoundingClientRect().height > 0).length;
      out.notesHidden = notesBefore > 0 && shown === 0;
      document.querySelector(".board").click(); await wait(200);

      /* Escape closes and hands the button back. */
      btn("sort").click(); await wait(240);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await wait(260);
      out.escClosed = !document.querySelector(".toolPop");
      out.escFocus = document.activeElement === btn("sort");
      return out;
    });

    const allOpen = ["filter", "sort", "display", "share"].every((t) => r.opens[t] && r.inView[t]);
    const allDismiss = ["filter", "sort", "display", "share"].every((t) => r["dismissed_" + t]);
    check("delight", `controls @${width} · all four open inside the viewport`,
      allOpen, JSON.stringify(r.opens));
    check("delight", `controls @${width} · a press outside closes them`,
      allDismiss, JSON.stringify(["filter", "sort", "display", "share"].map((t) => r["dismissed_" + t])));
    check("delight", `controls @${width} · Filter filters, and says so with the panel SHUT`,
      r.filtered < r.cleared && r.panelShut && r.badgeWhenShut === "1" && r.badgeGone,
      `${r.cleared} → ${r.filtered} · badge "${r.badgeWhenShut}" while shut · cleared:${r.badgeGone}`);
    check("delight", `controls @${width} · Sort really reorders, and marks itself live`,
      r.sorted && r.reallyAZ && r.sortDot, `changed:${r.sorted} a-z:${r.reallyAZ} dot:${r.sortDot}`);
    check("delight", `controls @${width} · Display really changes the card`,
      r.notesHidden === true, String(r.notesHidden));
    check("delight", `controls @${width} · Escape closes and hands the button back`,
      r.escClosed && r.escFocus, `closed:${r.escClosed} focus:${r.escFocus}`);
    await page.close();
  }
}
