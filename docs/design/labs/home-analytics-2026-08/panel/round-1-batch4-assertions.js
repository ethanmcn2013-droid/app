/* ══ round 1, batch 4 ═══════════════════════════════════════════════
   Provenance, the twin, the refusals and the tooltip's anchor.
   Written before the fixes and watched failing. */

/* coverage-strip-sits-outside-every-landmark · the surface's provenance
   apparatus is the thing that makes its honesty checkable, and it was the
   one region landmark navigation could not reach. */
{
  for (const state of config.states) {
    const page = await open({ state, reducedMotion: true });
    const marks = await page.evaluate(() => {
      const strip = document.querySelector(".coverage");
      const orphans = Array.from(document.querySelectorAll("header, main, footer, aside, [role]"))
        .length;
      return {
        tag: strip ? strip.tagName.toLowerCase() : null,
        named: strip ? Boolean(strip.getAttribute("aria-label")) : false,
        inMain: strip ? Boolean(strip.closest("main")) : false,
        landmarks: orphans,
      };
    });
    ok(`the provenance strip is a landmark of its own · ${state}`,
      marks.tag === "footer" && marks.named && !marks.inMain, JSON.stringify(marks));
    await page.close();
  }
}

/* dark-denominator-card-is-a-glare-panel · the twin flips the grounds and
   the marks keep their jobs. The denominator plate inverted to pure white
   and became the brightest object on a near-black page, in the middle of
   the row whose actual status marks are 3px meters. */
{
  const page = await open({ state: "full", variant: "dark", reducedMotion: true });
  const lum = await page.evaluate(() => {
    const rel = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const lead = document.querySelector(".kpi.lead");
    const others = Array.from(document.querySelectorAll(".kpi:not(.lead)"));
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const plate = rel(getComputedStyle(lead).backgroundColor);
    const numeral = rel(getComputedStyle(lead.querySelector(".t-num")).color);
    return {
      plate,
      brightest: Math.max(...others.map((o) => rel(getComputedStyle(o).backgroundColor))),
      contrast: ratio(plate, numeral),
    };
  });
  ok("the denominator plate is not the brightest thing on the dark ground", lum.plate < 0.9, `luminance ${lum.plate.toFixed(3)}`);
  ok("the denominator plate still reads as its own kind of surface", Math.abs(lum.plate - lum.brightest) > 0.05, `${lum.plate.toFixed(3)} vs ${lum.brightest.toFixed(3)}`);
  ok("its figure still clears AA on that plate", lum.contrast >= 4.5, `${lum.contrast.toFixed(2)}:1`);
  await page.close();
}

/* stale-tip-strands-on-scroll · the tip is placed once in viewport
   coordinates and the surface scrolls inside its own container, so a
   pinned label ends up naming a mark it no longer points at. A focused
   mark is hidden and restored; only a touch pin is retired. */
{
  const page = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true });
  await page.locator(".dot").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box = await page.locator(".dot").first().boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => document.getElementById("tip").classList.contains("on"));
  await page.evaluate(() => document.querySelector(".scroll").scrollBy(0, 260));
  await page.waitForTimeout(220);
  const after = await page.evaluate(() => {
    const t = document.getElementById("tip");
    if (!t.classList.contains("on")) return { on: false, drift: 0 };
    const anchor = document.querySelector(".dot");
    const a = anchor.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    return { on: true, drift: Math.round(Math.abs(r.bottom - a.top)) };
  });
  ok("a pinned label is dismissed or follows its mark", before && (!after.on || after.drift <= 24), JSON.stringify(after));
  await page.close();
}

/* august-inside-a-july-reading · a refusal that names a month the reading
   has not reached cannot be resolved either way. Every date on the surface
   resolves against the stated instant. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const dates = await page.evaluate(() => {
      const text = (document.querySelector("main") || document.body).innerText;
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const found = [];
      for (const m of months) {
        const re = new RegExp("(?<!\\d\\s)\\b" + m + "\\b(?!\\s+\\d{4})", "g");
        if (re.test(text)) found.push(m);
      }
      return found;
    });
    ok(`no month is named without its year · ${state}`, dates.length === 0, dates.join(", "));
    await page.close();
  }
}

/* refusals-written-in-the-studio-vocabulary · the movement that is the
   product's signature was written in the vocabulary of the team that built
   it, and is the only place on the surface that says "we". */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const voice = await page.evaluate(() => {
      const text = (document.querySelector("main") || document.body).innerText;
      const banned = ["snapshot writer", "callers", "recorder", "structured", "accrues", "periods", "provider"];
      const hits = banned.filter((w) => new RegExp("\\b" + w + "\\b", "i").test(text));
      const firstPerson = /\bwe\b/i.test(text);
      const lowerStart = Array.from(document.querySelectorAll("main p"))
        .map((p) => p.textContent.trim())
        .filter((t) => /^(and|but|or|so)\b/i.test(t));
      return { hits, firstPerson, lowerStart };
    });
    ok(`the refusals speak the reader's language · ${state}`, voice.hits.length === 0, voice.hits.join(", "));
    ok(`the surface never says "we" · ${state}`, !voice.firstPerson);
    ok(`no sentence begins as the back half of another · ${state}`, voice.lowerStart.length === 0, voice.lowerStart.join(" | "));
    await page.close();
  }
}

/* ghost-plot-orphaned-from-its-refusal · three refusals with separate
   causes sat above one drawn-but-empty plot that named none of them. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const ghost = await page.evaluate(() => {
    const fig = document.querySelector(".ghost");
    const tiles = Array.from(document.querySelectorAll(".limit .t-head")).map((h) => h.textContent.trim());
    const head = fig?.querySelector(".t-head")?.textContent.trim() ?? "";
    const plot = fig?.querySelector(".ghost-plot");
    const baseline = plot ? getComputedStyle(plot, "::after").content !== "none" : false;
    return { tag: fig ? fig.tagName.toLowerCase() : null, head, tiles, baseline };
  });
  ok("the drawn-but-empty plot names the refusal it draws",
    ghost.tiles.some((t) => ghost.head.includes(t)), `"${ghost.head}" against ${ghost.tiles.join(" | ")}`);
  ok("it is marked up as the figure it is", ghost.tag === "figure");
  ok("its columns stand on a baseline", ghost.baseline);
  await page.close();
}

/* rail-glyphs-outside-the-locked-faces · three of the four rail marks were
   painted by whatever the operating system supplied, because Geist carries
   none of them. The audit reads the authored family, never the painted one. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const rail = await page.evaluate(() => {
    const marks = Array.from(document.querySelectorAll(".rail i"));
    return {
      n: marks.length,
      withText: marks.filter((m) => m.textContent.trim().length > 0).length,
      withSvg: marks.filter((m) => m.querySelector("svg")).length,
    };
  });
  ok("no rail mark is set in a face the lock does not own", rail.withText === 0 && rail.withSvg === rail.n, JSON.stringify(rail));
  await page.close();
}

/* openable-is-a-promise-nothing-keeps · nothing on this surface opens a
   finished job, so the line inviting the reader to try was an affordance
   the screen does not carry. */
{
  for (const state of ["full", "partial", "quiet", "loading"]) {
    const page = await open({ state, reducedMotion: true });
    const claim = await page.evaluate(() => (document.querySelector("main") || document.body).innerText);
    ok(`no sentence advertises a move the surface does not carry · ${state}`, !/openable/i.test(claim));
    await page.close();
  }
}

/* no-pressed-state-anywhere · under a coarse pointer there is no hover, so
   a press is the only channel that can confirm a touch landed on a card. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const press = await page.evaluate(() => {
    const read = (sel, pseudo) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo);
      return cs.transform + "|" + cs.backgroundColor + "|" + cs.borderColor;
    };
    const has = (sel) => Array.from(document.styleSheets).some((sh) => {
      let rules; try { rules = sh.cssRules; } catch { return false; }
      return Array.from(rules || []).some((r) => r.selectorText && r.selectorText.includes(sel));
    });
    return {
      kpi: has("a.kpi:active"),
      btn: has(".btn:active"),
      dot: has(".dot:active"),
      cursor: getComputedStyle(document.querySelector(".dot")).cursor,
    };
  });
  ok("the marks invite the pointer", press.cursor === "pointer", press.cursor);
  ok("every control acknowledges a press", press.kpi && press.btn && press.dot, JSON.stringify(press));
  await page.close();
}
