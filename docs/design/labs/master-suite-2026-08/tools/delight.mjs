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
      seen.bursts === 1 && seen.dots === 12 && seen.widest >= 2 && seen.brightest > 0.2 && seen.ringGrew,
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
      /* Below 1100 the board is a list, by decision; the first row is
         the first card's equal in every assertion below. */
      const firstCard = () => {
        const c = document.querySelector(".board .card, .board .lrow");
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
      const filtered = document.querySelectorAll(".board .card, .board .lrow").length;
      const live = document.querySelector('[data-app="tasks"] .dockField').classList.contains("is-live");
      /* Escape twice: clear, then leave. */
      const esc = () => document.querySelector(".dockInput").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      esc();
      await new Promise((r) => setTimeout(r, 300));
      const cleared = document.querySelectorAll(".board .card, .board .lrow").length;
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

  /* ── the drop target ───────────────────────────────────
     THE FIRST TWO VERSIONS BOTH PASSED A GATE AND BOTH FAILED THE EYE, and
     each failure teaches this check something it was not measuring.

     v1 asserted `alpha <= 0.06`. That is a test of RESTRAINT and says
     nothing about whether anything is visible; it passed a 2.8% tint the
     founder could not see at all.

     v2 raised the alpha and the founder called the result "a bit dirty".
     Also correct, and measurable: every wash was a dilution of the DOT
     colour, a dot must be dark to hold its edge on white, and diluting a
     dark colour toward white destroys its chroma. The washes measured
     chroma 7-13 — grey with a cast.

     So this measures the composited result on three axes, because a wash
     can fail on any one of them independently:
       PRESENCE   it is far enough from white to be seen
       RESTRAINT  it is near enough to white that the sheet still reads as paper
       CHROMA     it is actually a colour and not a grey
     and then BALANCE across the five, because one alpha over five hues is
     five different weights, and the lane that shouts is the defect even
     when every lane passes on its own. */
  {
    const page = await open(1440);
    const washes = await page.evaluate(async () => {
      const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const out = [];
      for (const tray of document.querySelectorAll(".board [data-lane]")) {
        if (!tray.querySelector(".pip")) continue;
        tray.setAttribute("data-over", "");
        await new Promise((r) => setTimeout(r, 180));
        const c = parse(getComputedStyle(tray).backgroundColor);
        tray.removeAttribute("data-over");
        if (c.length < 3) continue;
        const a = c.length > 3 ? c[3] : 1;
        /* Composite it over the sheet's white, which is what a person sees. */
        const on = [c[0], c[1], c[2]].map((v) => v * a + 255 * (1 - a));
        out.push({
          lane: tray.dataset.lane,
          drop: (1 - lum(on)) * 100,
          chroma: Math.max(...on) - Math.min(...on),
        });
      }
      return out;
    });

    for (const w of washes) {
      check("delight", `drop tint · ${w.lane} is visible and still reads as paper`,
        w.drop >= 8 && w.drop <= 18,
        `${w.drop.toFixed(1)}% below white`);
      /* To do is neutral BY DESIGN — the absence of a status rather than a
         status of its own — so it is the one lane exempt from chroma. */
      if (w.lane !== "todo") {
        check("delight", `drop tint · ${w.lane} is a colour, not a grey`,
          w.chroma >= 14, `chroma ${Math.round(w.chroma)} (under 14 reads dirty)`);
      }
    }
    const drops = washes.map((w) => w.drop);
    check("delight", "no lane's tint shouts louder than another",
      Math.max(...drops) - Math.min(...drops) <= 4,
      washes.map((w) => `${w.lane} ${w.drop.toFixed(1)}%`).join(" · "));

    /* And the dot: FLAT. One colour, no rim, no halo, no gradient, at rest
       and while a card is over it.

       This assertion is the inverse of the one it replaces, which required
       a rim. The rim was there to give a bright dot an edge on white, and
       at 8px it did not read as an edge — it read as a glow, or as a dot
       painted in two colours with a light centre and a dark outside. The
       founder said exactly that. A gate can hold a shape; it cannot tell
       you the shape is the wrong idea. */
    const dots = await page.evaluate(async () => {
      const read = (pip) => {
        const cs = getComputedStyle(pip);
        return { shadow: cs.boxShadow, image: cs.backgroundImage, fill: cs.backgroundColor };
      };
      const out = [];
      for (const tray of document.querySelectorAll(".board [data-lane]")) {
        const pip = tray.querySelector(".pip");
        if (!pip) continue;
        const rest = read(pip);
        tray.setAttribute("data-over", "");
        await new Promise((r) => setTimeout(r, 180));
        const over = read(tray.querySelector(".pip"));
        tray.removeAttribute("data-over");
        out.push({ lane: tray.dataset.lane, rest, over });
      }
      return out;
    });
    const flat = (d) =>
      d.shadow === "none" && (d.image === "none" || !d.image) &&
      /^rgba?\(/.test(d.fill);
    const notFlat = dots.filter((d) => !flat(d.rest) || !flat(d.over));
    check("delight", "every status dot is flat — no rim, no glow, no gradient",
      notFlat.length === 0,
      notFlat.length
        ? notFlat.map((d) => `${d.lane} rest:${d.rest.shadow} over:${d.over.shadow}`).slice(0, 2).join(" | ")
        : "five flat dots, at rest and under a dragged card");
    /* The lane's colour must not change when a card arrives over it — the
       dot grows, and that is all it does. */
    const shifted = dots.filter((d) => d.rest.fill !== d.over.fill);
    check("delight", "a dot answers by growing, not by changing colour",
      shifted.length === 0,
      shifted.length ? shifted.map((d) => d.lane).join(" ") : "colour holds through the drop state");
    const fills = new Set(dots.map((d) => d.rest.fill));
    check("delight", "all five lanes look different from each other",
      fills.size === dots.length, `${fills.size} distinct fills across ${dots.length} lanes`);
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
      /* SETTLED, not merely opened. The card now MORPHS into this dialog —
         a 220ms view transition — and while it runs the browser paints
         snapshot pseudo-elements over the page. `elementFromPoint` reaches
         those rather than the scrim underneath, so a rule that measured at
         400ms caught the tail of the morph at 1920 and reported a modal
         that was not modal. The dialog is the same either way; what
         changed is that there is now something in front of it for a fifth
         of a second. */
      await new Promise((r) => setTimeout(r, 700));
      const panel = document.querySelector(".taskPanel");
      const scrim = document.querySelector(".tpScrim");
      const out = {
        opened: Boolean(panel),
        focused: document.activeElement === panel,
        /* CENTRED, and modal. It was a right-hand panel until the founder
           asked for the middle of the screen; the assertion moved with the
           design rather than being deleted. A modal must actually be modal —
           the scrim covers the viewport and takes the press, so the board
           behind it cannot be operated by accident. */
        centred: (() => {
          if (!panel) return null;
          const b = panel.getBoundingClientRect();
          return Math.abs((b.left + b.width / 2) - innerWidth / 2) <= 1 &&
                 Math.abs((b.top + b.height / 2) - innerHeight / 2) <= 1;
        })(),
        inViewport: (() => {
          if (!panel) return null;
          const b = panel.getBoundingClientRect();
          return b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1;
        })(),
        scrimCovers: (() => {
          if (!scrim) return false;
          const b = scrim.getBoundingClientRect();
          const card = document.querySelector(".board .card");
          const c = card.getBoundingClientRect();
          const hit = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
          return b.width >= innerWidth && b.height >= innerHeight &&
                 Boolean(hit && hit.classList.contains("tpScrim"));
        })(),
        /* The lane's colour is on the card's own top edge. */
        accent: panel ? getComputedStyle(panel, "::before").backgroundColor : "",
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
    check("delight", `task panel @${width} · opens centred, modal, and inside the viewport`,
      r.opened && r.focused && r.centred && r.inViewport && r.scrimCovers,
      `opened:${r.opened} focus:${r.focused} centred:${r.centred} inView:${r.inViewport} modal:${r.scrimCovers}`);
    check("delight", `task panel @${width} · wears the lane's own colour`,
      /rgb/.test(r.accent) && r.accent !== "rgba(0, 0, 0, 0)", r.accent);
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
     Show and Share. Filter, Sort and Display became one word — Show — on
     2026-09-02, because they were three answers to one question; the
     founder's rule is unchanged: a person must always know what is active
     WITHOUT opening anything, so the load-bearing assertion is not "the
     panel opens" — it is "the word says it is on while the panel is shut". */
  for (const width of [1440, 1920]) {
    const page = await open(width);
    const r = await page.evaluate(async () => {
      const btn = (t) => document.querySelector(`[data-act="tool"][data-tool="${t}"]`);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      /* The word becomes the panel through a view transition, whose
         callback runs a frame late and whose animation takes 220ms on a
         quiet machine and longer on a loaded one. A fixed clock here
         measured the machine, not the product: on 2 September a 240ms
         wait at 1920 read the panel as absent while it was still
         arriving, and the run died on a null. Wait for the STATE. */
      const until = async (f, ms = 2000) => {
        const t0 = performance.now();
        while (!f() && performance.now() - t0 < ms) await wait(30);
        return f();
      };
      const opened = async (t) => { btn(t).click(); await until(() => document.querySelector(".toolPop")); await wait(120); };
      const shut = async () => { document.querySelector(".board").click(); await until(() => !document.querySelector(".toolPop")); await wait(60); };
      const out = { opens: {}, inView: {} };
      for (const t of ["show", "share"]) {
        await opened(t);
        const pop = document.querySelector(".toolPop");
        out.opens[t] = Boolean(pop);
        if (pop) {
          const b = pop.getBoundingClientRect();
          out.inView[t] = b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
        }
        /* Dismissal: a press on the board closes it. */
        await shut();
        out["dismissed_" + t] = !document.querySelector(".toolPop");
      }

      /* A filter changes the board and Show SAYS SO on its own face. */
      const before = document.querySelectorAll(".board .card").length;
      await opened("show");
      document.querySelector('[data-act="filter-set"][data-value="late"]').click();
      await wait(320);
      out.filtered = document.querySelectorAll(".board .card").length;
      await shut();
      /* Panel SHUT, and the word still reports the live filter. */
      out.badgeWhenShut = (btn("show").querySelector(".toolDot") || {}).textContent;
      out.panelShut = !document.querySelector(".toolPop");
      await opened("show");
      document.querySelector('[data-act="filter-clear"]').click();
      await wait(320);
      out.cleared = document.querySelectorAll(".board .card").length;
      await shut();
      out.badgeGone = !btn("show").querySelector(".toolDot");

      /* Sort actually reorders. */
      /* Every lane, not one. The To do lane's manual order happens to be
         alphabetical already — Confirm, Reprint, Send — so asserting "it
         changed" against that one lane failed a sort that was working
         perfectly. The requirement is that EVERY lane comes out ordered,
         and that at least one of them actually had to move to get there. */
      const laneTitles = () => [...document.querySelectorAll(".board [data-lane]")]
        .map((l) => [...l.querySelectorAll(".card .cardTitle")].map((e) => e.textContent.trim()));
      const manual = laneTitles();
      await opened("show");
      document.querySelector('[data-act="sort-set"][data-value="title"]').click();
      await wait(320);
      const az = laneTitles();
      out.sorted = JSON.stringify(manual) !== JSON.stringify(az);
      out.reallyAZ = az.every((lane) =>
        JSON.stringify(lane) === JSON.stringify([...lane].sort((a, b) => a.localeCompare(b))));
      await shut();
      out.sortDot = Boolean(btn("show").querySelector(".toolDot"));

      /* Display actually changes the card. */
      const notesBefore = document.querySelectorAll(".board .cardNote").length;
      await opened("show");
      document.querySelector('[data-act="display-notes"][data-value="off"]').click();
      await wait(320);
      const shown = [...document.querySelectorAll(".board .cardNote")]
        .filter((n) => n.getBoundingClientRect().height > 0).length;
      out.notesHidden = notesBefore > 0 && shown === 0;
      await shut();

      /* Escape closes and hands the word back. */
      await opened("show");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await wait(260);
      out.escClosed = !document.querySelector(".toolPop");
      out.escFocus = document.activeElement === btn("show");
      return out;
    });

    const allOpen = ["show", "share"].every((t) => r.opens[t] && r.inView[t]);
    const allDismiss = ["show", "share"].every((t) => r["dismissed_" + t]);
    check("delight", `controls @${width} · Show and Share open inside the viewport`,
      allOpen, JSON.stringify(r.opens));
    check("delight", `controls @${width} · a press outside closes them`,
      allDismiss, JSON.stringify(["show", "share"].map((t) => r["dismissed_" + t])));
    check("delight", `controls @${width} · a filter filters, and Show says so with the panel SHUT`,
      r.filtered < r.cleared && r.panelShut && r.badgeWhenShut === "1" && r.badgeGone,
      `${r.cleared} → ${r.filtered} · badge "${r.badgeWhenShut}" while shut · cleared:${r.badgeGone}`);
    check("delight", `controls @${width} · Sort really reorders, and marks Show live`,
      r.sorted && r.reallyAZ && r.sortDot, `changed:${r.sorted} a-z:${r.reallyAZ} dot:${r.sortDot}`);
    check("delight", `controls @${width} · Display really changes the card`,
      r.notesHidden === true, String(r.notesHidden));
    check("delight", `controls @${width} · Escape closes and hands the word back`,
      r.escClosed && r.escFocus, `closed:${r.escClosed} focus:${r.escFocus}`);
    await page.close();
  }
}
