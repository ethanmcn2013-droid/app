/* ══ round 2, batch 5 ═══════════════════════════════════════════════
   Two of these replace assertions this gate already had and could not
   fail. Written before the fixes and watched failing. */

/* rise-fill-outranks-every-interaction-rule · the retired assertion
   grepped document.styleSheets for the selector text and never rendered
   anything, so it passed on a rule pinned dead by an animation's fill.
   This one holds a real pointer down and measures what paints. */
{
  for (const mode of [null, "play"]) {
    const page = await open({ raw: mode ? { state: "full", v: "light", motion: mode } : { state: "full", v: "light" } });
    await page.waitForTimeout(mode === "play" ? 2000 : 200);
    const card = page.locator("a.kpi, .kpi").first();
    const box = await card.boundingBox();
    const rest = await page.evaluate(() => {
      const el = document.querySelector(".kpi");
      const cs = getComputedStyle(el);
      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };
    });
    await page.mouse.move(box.x - 40, box.y - 40);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await page.waitForTimeout(200);
    const hover = await page.evaluate(() => {
      const el = document.querySelector(".kpi");
      const cs = getComputedStyle(el);
      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };
    });
    await page.mouse.down();
    await page.waitForTimeout(180);
    const press = await page.evaluate(() => {
      const el = document.querySelector(".kpi");
      const cs = getComputedStyle(el);
      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };
    });
    await page.mouse.up();
    const key = (s) => `${s.t}|${s.bg}|${s.bd}`;
    ok(`the entrance releases its elements back to the cascade · motion=${mode ?? "settled"}`,
      await page.evaluate(() => Array.from(document.querySelectorAll(".rise")).every((el) => {
        const f = getComputedStyle(el).animationFillMode;
        return f !== "both" && f !== "forwards";
      })), "a forwards fill outranks every author declaration, permanently");
    ok(`a card acknowledges a press, measured from what paints · motion=${mode ?? "settled"}`,
      key(press) !== key(hover) && key(hover) !== key(rest),
      `rest ${key(rest)} / hover ${key(hover)} / press ${key(press)}`);
    await page.close();
  }
}

/* keyboard-cannot-scroll-the-reading-surface · the primary gesture of a
   reading instrument, on a fresh load, with nothing clicked. */
{
  for (const state of config.states) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const has = await page.evaluate(() => {
        const el = document.scrollingElement;
        return { overflow: el.scrollHeight - el.clientHeight, focus: document.activeElement === document.body };
      });
      if (has.overflow > 8) {
        await page.keyboard.press("PageDown");
        await page.waitForTimeout(160);
        const moved = await page.evaluate(() => document.scrollingElement.scrollTop);
        ok(`page down reads the page · ${state} @ ${vp.name}`, moved > 0, `${moved}px of ${has.overflow}, focus on body ${has.focus}`);
      }
      await page.close();
    }
  }
}

/* skeleton-draws-the-data-it-says-it-is-still-reading · a state that says
   it is still reading may not publish the reading. The retired assertions
   built both DOMs from the same fixture in the same frame and compared
   them to each other, so they could not fail. */
{
  const page = await open({ state: "loading", reducedMotion: true });
  const marks = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll(".sk-wrap .bar"));
    const meters = Array.from(document.querySelectorAll(".sk-wrap .meter i"));
    const dots = Array.from(document.querySelectorAll(".sk-wrap .dot"));
    const val = (el, p) => el.style.getPropertyValue(p);
    const real = window.LATELY_FIXTURE.scopes.full.jobs.map((j) => j.age);
    const skx = dots.map((d) => Number(val(d, "--x")));
    const realx = real.map((a) => (a / 45) * 100);
    return {
      barHeights: new Set(bars.map((b) => val(b, "--h"))).size,
      meterFills: new Set(meters.map((m) => val(m, "--f"))).size,
      part: document.querySelectorAll(".sk-wrap .bar.part").length,
      zero: document.querySelectorAll(".sk-wrap .meter i.zero").length,
      dotsMatchReal: JSON.stringify(skx.map((n) => Math.round(n))) === JSON.stringify(realx.map((n) => Math.round(n))),
      tagVisible: document.querySelector(".sk-wrap .record-tag")
        ? getComputedStyle(document.querySelector(".sk-wrap .record-tag")).visibility !== "hidden"
        : false,
    };
  });
  ok("the skeleton's columns publish no reading", marks.barHeights === 1, `${marks.barHeights} distinct heights`);
  ok("the skeleton's meters publish no reading", marks.meterFills === 1, `${marks.meterFills} distinct fills`);
  ok("the skeleton draws no partial-week treatment of a week nobody read", marks.part === 0);
  ok("the skeleton draws no zero it has not read", marks.zero === 0);
  ok("the skeleton's marks are not the real ages", !marks.dotsMatchReal);
  ok("the skeleton labels no previous best", !marks.tagVisible);
  await page.close();
}

/* The skeleton must also survive the condition it exists for: a client
   that holds no data at all. */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    const strip = () => {
      const f = window.LATELY_FIXTURE;
      if (!f) return;
      f.weeks = [];
      for (const k of Object.keys(f.scopes ?? {})) f.scopes[k].jobs = [];
      f.jobs = [];
    };
    Object.defineProperty(window, "LATELY_FIXTURE", {
      configurable: true,
      set(v) { delete window.LATELY_FIXTURE; window.LATELY_FIXTURE = v; strip(); },
      get() { return undefined; },
    });
  });
  const url = new URL(MASTER);
  url.searchParams.set("state", "loading");
  url.searchParams.set("v", "light");
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const ready = await page.evaluate(() => window.__LATELY_READY === true);
  ok("the loading state renders with no reading to draw from", ready && errs.length === 0, errs.slice(0, 2).join(" | "));
  await page.close();
  await context.close();
}

/* loading-frame-is-a-movement-short · the skeleton is the height of the
   page that follows, not two thirds of it. */
{
  for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const skel = await open({ state: "loading", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
    const real = await open({ state: "full", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
    const h = (p) => p.evaluate(() => ({
      sections: document.querySelectorAll("main section").length,
      height: Math.round(document.querySelector("main").getBoundingClientRect().height),
    }));
    const [a, b] = [await h(skel), await h(real)];
    ok(`the loading frame draws every section that arrives @ ${vp.width}`, a.sections === b.sections, `${a.sections} vs ${b.sections}`);
    ok(`the loading frame is the height of the page that follows @ ${vp.width}`, Math.abs(a.height - b.height) <= 8, `${a.height} vs ${b.height}`);
    await skel.close(); await real.close();
  }
}

/* fortnight-label-escapes-its-card · a label that leaves its strip is
   clipped by an ancestor, so the document reports no overflow and every
   width check passes over a destroyed word. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    for (const w of [320, 360, 390, 414, 560, 768, 1024, 1280, 1440]) {
      const page = await open({ state, reducedMotion: true, viewport: { width: w, height: 900 }, touch: w <= 480 });
      const label = await page.evaluate(() => {
        const rule = document.querySelector(".fortnight");
        if (!rule) return null;
        const span = rule.querySelector("span");
        const strip = document.querySelector(".strip").getBoundingClientRect();
        const r = span.getBoundingClientRect();
        const scroll = document.querySelector(".scroll") || document.scrollingElement;
        return {
          inside: r.left >= strip.left - 0.5 && r.right <= strip.right + 0.5,
          clipped: scroll.scrollWidth - scroll.clientWidth,
          right: Math.round(r.right), stripRight: Math.round(strip.right),
        };
      });
      if (label) {
        ok(`the fortnight label stays inside its strip · ${state} @ ${w}`, label.inside, `${label.right} vs ${label.stripRight}`);
        ok(`nothing is clipped away inside the scroller · ${state} @ ${w}`, label.clipped <= 1, `${label.clipped}px`);
      }
      await page.close();
    }
  }
}

/* kpi-cards-announce-their-fact-twice · the row's authored sentence is
   the whole name, not a prefix to itself. */
{
  for (const state of ["full", "partial", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const heard = await page.evaluate(() => {
      const out = [];
      for (const card of document.querySelectorAll(".kpi:not(.lead)")) {
        const leaves = [];
        const walk = (el) => {
          if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return;
          for (const n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent.trim()) leaves.push(n.textContent.trim());
            else if (n.nodeType === 1) walk(n);
          }
        };
        walk(card);
        out.push(leaves.length);
      }
      return out;
    });
    ok(`each card in the row says its fact once · ${state}`, heard.every((n) => n === 1), heard.join(","));
    await page.close();
  }
}

/* status-indigo-is-the-only-mark-the-dark-twin-forgets · the status marks
   take the ground flip like every other mark. */
{
  for (const variant of config.variants) {
    const page = await open({ state: "full", variant, reducedMotion: true });
    const glyphs = await page.evaluate(() => {
      const rel = (rgb) => {
        const p = (rgb.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
      };
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const out = [];
      for (const g of document.querySelectorAll(".kpi .glyph")) {
        const shape = g.querySelector("svg [stroke]");
        if (!shape) continue;
        const stroke = getComputedStyle(shape).stroke;
        const plate = getComputedStyle(g).backgroundColor;
        const card = getComputedStyle(g.closest(".kpi")).backgroundColor;
        const comp = (fg, bg) => {
          const f = (fg.match(/[\d.]+/g) || []).map(Number);
          const b = (bg.match(/[\d.]+/g) || []).map(Number);
          const a = f.length > 3 ? f[3] : 1;
          return `rgb(${a * f[0] + (1 - a) * b[0]}, ${a * f[1] + (1 - a) * b[1]}, ${a * f[2] + (1 - a) * b[2]})`;
        };
        out.push({ r: ratio(rel(stroke), rel(comp(plate, card))), stroke });
      }
      return out;
    });
    ok(`every status mark clears the non-text floor · ${variant}`,
      glyphs.length > 0 && glyphs.every((g) => g.r >= 3), glyphs.map((g) => g.r.toFixed(2)).join(" "));
    await page.close();
  }
}
