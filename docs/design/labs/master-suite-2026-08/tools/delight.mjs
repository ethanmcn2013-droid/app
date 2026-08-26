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
}
