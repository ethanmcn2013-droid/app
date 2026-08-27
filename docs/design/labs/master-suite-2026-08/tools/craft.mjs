/* ═══════════════════════════════════════════════════════════════════
   CRAFT — round 1, batch 4. Two defects, and a gate that could not see
   either of them.

   · One modifier, four printings, two platform detections. On one Mac,
     in one document, the notebook printed ⌘ and the Timeline printed
     Ctrl — the application could tell one person she had two different
     keyboards.
   · The person filter's hit target was 16px tall, not the 30px the
     measured gate reported. `overflow: hidden` on the control clips the
     control's own ::before, and that pseudo IS the grower. The gate
     reads DECLARED insets; the browser hit-tests what it painted.

   The second is the more valuable of the two, and not because of the
   control: a target check that reads a stylesheet rather than the
   pointer will pass every clipped grower there will ever be. So the
   assertion below is written the way the browser answers — elementFrom-
   Point down the middle of the control — and it covers every interactive
   thing on the surface, not the one that was caught.
   ═══════════════════════════════════════════════════════════════════ */

export async function craft({ browser, url, check, head }) {
  head("12 · the keycap, and what actually receives the pointer");

  const open = async (query, width, platform) => {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 960 },
      hasTouch: width < 500,
      isMobile: width < 500,
    });
    if (platform) {
      await page.addInitScript((p) => {
        Object.defineProperty(navigator, "platform", { get: () => p });
      }, platform);
    }
    await page.goto(url + query);
    await page.waitForTimeout(700);
    return page;
  };

  /* ── one modifier, one notation, on both platforms ─────────────── */
  for (const [platform, glyph] of [["Win32", "Ctrl "], ["MacIntel", "⌘"]]) {
    const caps = [];
    for (const state of ["tasks.board", "notes.notebook", "notes.voice", "timeline.owner-flight"]) {
      const page = await open(`?state=${state}`, 1440, platform);
      const found = await page.evaluate(() =>
        [...document.querySelectorAll(".app:not([hidden]) kbd")]
          .map((el) => el.textContent.trim())
          .filter(Boolean));
      caps.push(...found);
      await page.close();
    }
    const modifiers = caps.filter((c) => /ctrl|⌘/i.test(c));
    /* Every modifier cap on every surface is joined the same way. */
    const wrong = modifiers.filter((c) => !c.startsWith(glyph));
    check("craft", `${platform} · one modifier, one notation`, wrong.length === 0,
      wrong.length ? `${[...new Set(wrong)].join(" · ")} against “${glyph}”`
        : `${modifiers.length} caps, all “${glyph}…”`);
    /* And the form macOS does not use never appears. */
    const plus = caps.filter((c) => c.includes("+"));
    check("craft", `${platform} · no modifier is joined with a plus`, plus.length === 0,
      plus.length ? [...new Set(plus)].join(" · ") : "none");
    /* Two products in one document may not disagree about the keyboard. */
    const glyphs = new Set(modifiers.map((c) => (c.startsWith("⌘") ? "cmd" : "ctrl")));
    check("craft", `${platform} · all three products read one keyboard`, glyphs.size <= 1,
      [...glyphs].join(" and ") || "no modifier caps");
  }

  /* ── what actually receives the pointer ──────────────────────────
     WATCHED FAILING: `.who` measured 66.7×16 by elementFromPoint while
     the measured gate read 30px from its declared inset. Written against
     the browser's own answer, and run over every interactive element on
     the surface rather than the one that was found. */
  for (const state of ["tasks.board", "notes.notebook", "timeline.owner-flight"]) {
    for (const width of [390, 1440]) {
      const page = await open(`?state=${state}`, width, "Win32");
      const small = await page.evaluate(() => {
        const out = [];
        const sel = "button, a[href], summary, [tabindex]:not([tabindex='-1']), input, textarea, select";
        for (const el of document.querySelectorAll(".app:not([hidden]) " + sel + ", .rail " + sel)) {
          const b = el.getBoundingClientRect();
          if (b.width < 1 || b.height < 1) continue;
          if (el.getAttribute("aria-hidden") === "true") continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.pointerEvents === "none") continue;
          const cx = b.left + b.width / 2;
          if (cx < 0 || cx > innerWidth) continue;
          /* Walk out from the centre until the element (or something
             inside it) stops answering. That is the target a finger
             actually has, whatever the stylesheet declares. */
          const answers = (y) => {
            if (y < 0 || y > innerHeight) return false;
            const hit = document.elementFromPoint(cx, y);
            return Boolean(hit && (hit === el || el.contains(hit)));
          };
          /* Walked from wherever the element currently sits, and then
             AGAIN from the middle of the viewport if the first walk was
             stopped by the fold rather than by another element. A control
             that straddles the bottom edge measured 18px against a 40px
             box and was reported as a failed touch target — but nothing
             was covering it and nothing about it was small: half of it
             was simply below the screen, which is what scrolling is for.
             That is the viewport being measured, not the product, and
             this rule is the one place in the lab that must never report
             its own frame as the product's defect. */
          const walk = () => {
            const r = el.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const hits = (at) => {
              if (at < 0 || at > innerHeight) return false;
              const hit = document.elementFromPoint(x, at);
              return Boolean(hit && (hit === el || el.contains(hit)));
            };
            if (!hits(y)) return null;             /* covered by something else */
            let u = y, d = y;
            while (hits(u - 1) && y - u < 40) u -= 1;
            while (hits(d + 1) && d - y < 40) d += 1;
            return { real: d - u + 1, cut: u <= 0 || d >= innerHeight - 1 };
          };
          let m = walk();
          if (!m) continue;
          /* Re-measured from the middle of the screen whenever the first
             walk came up short, not only when the FOLD was what stopped
             it. The row that failed this rule was cut by the floating
             dock — an overlay the product draws over the foot of a
             scroller on purpose, and which every scroller in this suite
             reserves for at its own end. A row resting under it halfway
             through a scroll is not a small target; it is a row you have
             not scrolled to yet. Centring costs nothing when the target
             really is small: it measures the same. */
          if (m.real < 28) {
            el.scrollIntoView({ block: "center" });
            const again = walk();
            if (again) m = again;
          }
          const real = m.real;
          if (real < 28) {
            out.push({
              el: el.tagName.toLowerCase() + "." + String(el.className || "").trim().split(/\s+/)[0],
              declared: Math.round(b.height),
              real: Math.round(real),
              label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
            });
          }
        }
        return out;
      });
      check("craft", `${state} @${width} · every control answers over 28px`,
        small.length === 0,
        small.length
          ? small.slice(0, 3).map((s) => `${s.el} “${s.label}” declared ${s.declared}, answers ${s.real}`).join(" | ")
          : "measured by pointer, not by stylesheet");
      await page.close();
    }
  }
}
