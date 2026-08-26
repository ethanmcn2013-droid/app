/* ══ round 3, batch 3 ═══════════════════════════════════════════════
   The last seven confirmed findings of the closing round. Every one of
   these was watched failing on the surface before its fix landed. */

/* denominator-plate-keeps-a-portrait-layout-in-a-banner-box · at 1440 the
   lead card is a portrait tile and exactly right. Below 900 the row goes
   two-up and the card spans both columns — a box more than twice as wide
   holding the identical stacked composition. Asserted as a relationship
   between the box and its contents, not as a typed breakpoint. */
{
  for (const width of [1440, 768, 390]) {
    const page = await open({
      state: "full",
      viewport: { width, height: width <= 480 ? 844 : 1024 },
      touch: width <= 480,
      reducedMotion: true,
    });
    const plate = await page.evaluate(() => {
      const lead = document.querySelector(".kpi.lead");
      if (!lead) return null;
      const cs = getComputedStyle(lead);
      const box = lead.getBoundingClientRect();
      const kids = Array.from(lead.children).map((k) => k.getBoundingClientRect());
      const inkRight = kids.length ? Math.max(...kids.map((k) => k.right)) : box.left;
      const inkLeft = kids.length ? Math.min(...kids.map((k) => k.left)) : box.right;
      return {
        direction: cs.flexDirection,
        ratio: Math.round((box.width / box.height) * 100) / 100,
        fill: Math.round(((inkRight - inkLeft) / box.width) * 100),
      };
    });
    /* A tile stacks; a banner lies down. The card must not be a banner in
       shape and a tile in composition — which is measured here as ink that
       fails to reach across a box wide enough to need it. */
    ok(`the denominator plate is composed like the box it is in · ${width}`,
      plate !== null && (plate.ratio < 1.8 ? plate.direction === "column" : plate.direction === "row"),
      JSON.stringify(plate));
    ok(`and its ink reaches across that box · ${width}`,
      plate !== null && plate.fill >= 45, JSON.stringify(plate));
    await page.close();
  }
}

/* nothing-balances-a-last-line · text-wrap computed to wrap on every
   element on the surface, and forty-two line boxes across the seven states
   ended on a single word — identical on both grounds, so not a ground
   artefact. Measured from Ranges over the text, because the element box
   says nothing about where the words landed. */
{
  const lastLine = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = Array.from(r.getClientRects());
    if (rects.length < 2) return { lines: rects.length, w: null };
    return { lines: rects.length, w: Math.round(rects[rects.length - 1].width) };
  };

  for (const width of [1440, 1280, 768]) {
    const page = await open({ state: "full", viewport: { width, height: 1024 }, reducedMotion: true });
    const caption = await page.evaluate(
      new Function(`return (${lastLine.toString()})(".ghost-say .t-head")`),
    );
    ok(`the refusal caption does not end on a lone word · ${width}`,
      caption !== null && (caption.lines === 1 || caption.w > 60), JSON.stringify(caption));
    await page.close();
  }

  /* The first-run note is the pair that must land together: `pretty` on its
     own moved the break INTO the date — "Yours arrive on 10 / August 2026." —
     which is worse than the widow it replaced. The date is bound, so the
     break can only fall between words that are allowed to part. */
  const page = await open({ state: "first-run", reducedMotion: true });
  const note = await page.evaluate(() => {
    const el = document.querySelector(".hero-note");
    if (!el) return null;
    const text = el.textContent || "";
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = Array.from(r.getClientRects());
    return {
      lines: rects.length,
      last: rects.length ? Math.round(rects[rects.length - 1].width) : null,
      dateIsBound: / /.test(text),
      text: text.slice(-40),
    };
  });
  ok("the first-run comparison date cannot be broken across lines",
    note !== null && note.dateIsBound, JSON.stringify(note));
  await page.close();
}

/* the-lab-stamp-repeats-its-own-key · five of the six provenance stamps
   read as key plus value; this one repeated its key inside its value, and
   offered a garden path where the key could be read as the subject of the
   verb that followed. Asserted over every stamp, not the one that had it. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const stamps = await page.evaluate(() => {
    const out = [];
    for (const s of document.querySelectorAll(".coverage span")) {
      const key = s.querySelector("b")?.textContent?.trim() ?? "";
      const value = (s.textContent || "").replace(key, "").trim();
      const stem = key.toLowerCase().split("-")[0];
      out.push({ key, repeats: stem.length > 2 && value.toLowerCase().includes(stem) });
    }
    return out;
  });
  ok("no provenance stamp repeats its own key inside its value",
    stamps.length > 0 && stamps.every((s) => !s.repeats), JSON.stringify(stamps));
  await page.close();
}

/* one-of-four-labels-drops-the-verb-the-others-keep · the plural string was
   doing two jobs — the card's own sentence, which wants a finite verb, and
   the noun phrase inside "Jobs ___: not available", which cannot have one.
   One card carried the noun phrase in both places. Asserted as concord
   across the row, so the next card to lose its verb is caught too. */
{
  for (const state of ["full", "quiet"]) {
    const page = await open({ state, reducedMotion: true });
    const row = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".kpi:not(.lead)"));
      return cards.map((c) => {
        const phrase = c.querySelector(".t-small")?.textContent?.trim() ?? "";
        return { phrase, finite: /^(are|is|have|has|haven|hasn|aren|isn)\b/i.test(phrase) };
      });
    });
    ok(`every status card leads with a finite verb · ${state}`,
      row.length === 4 && row.every((c) => c.finite), JSON.stringify(row.map((c) => c.phrase)));
    await page.close();
  }

  /* And the unavailable card keeps the noun phrase its construction needs:
     "Jobs past the day they were due: not available" — never "Jobs are past
     the day they were due: not available". */
  const page = await open({ state: "partial", reducedMotion: true });
  const na = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".kpi")).find((c) => c.querySelector(".na"));
    return card ? card.getAttribute("aria-label") : null;
  });
  ok("the unavailable card names itself with a noun phrase, not a sentence",
    na !== null && /not available/i.test(na) && !/^Jobs (are|is|have|has)\b/i.test(na), String(na));
  await page.close();
}

/* tab-strip-activates-into-a-dead-history-entry · the current tab is an
   anchor to a bare #, so activating it pushed a history entry and snapped
   the document to the top while aria-current never moved. The two siblings
   are deliberately left alone — they carry real routes after the port. */
{
  const page = await open({ state: "full", reducedMotion: true });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(120);
  const before = await page.evaluate(() => ({ len: history.length, y: Math.round(window.scrollY), hash: location.hash }));
  await page.locator('.tab[aria-current="page"]').click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ len: history.length, y: Math.round(window.scrollY), hash: location.hash }));
  ok("the current tab does not re-navigate to itself",
    after.len === before.len && Math.abs(after.y - before.y) <= 2 && after.hash === before.hash,
    `${JSON.stringify(before)} then ${JSON.stringify(after)}`);
  await page.close();
}

/* tooltip-text-stays-in-the-accessibility-tree · the tip is hidden with
   opacity and never cleared, so after a blur the last mark's title and day
   count stayed in the tree — a second, stale copy of a name the mark
   already carries. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const tip = await page.evaluate(() => {
    const t = document.getElementById("tip");
    if (!t) return null;
    return {
      ariaHidden: t.getAttribute("aria-hidden"),
      described: document.querySelectorAll('[aria-describedby="tip"]').length,
      focusable: t.querySelectorAll("a, button, input, [tabindex]").length,
    };
  });
  ok("the tooltip is a visual echo and stays out of the tree",
    tip !== null && tip.ariaHidden === "true" && tip.described === 0 && tip.focusable === 0,
    JSON.stringify(tip));
  await page.close();
}

/* focused-mark-loses-its-name-to-a-pointer-leave · hide() guarded the touch
   pin and not focus, so a pointer crossing any mark and leaving took the tip
   away from a mark that was still focused and still ringed — and the mark's
   title lives nowhere else on the screen. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const marks = page.locator(".dot");
  await marks.nth(2).scrollIntoViewIfNeeded();
  await marks.nth(2).focus();
  await page.waitForTimeout(150);
  const held = await page.evaluate(() => ({
    on: document.getElementById("tip").classList.contains("on"),
    text: document.getElementById("tip").textContent,
    ring: document.activeElement.matches(":focus-visible"),
  }));

  /* Cross a sibling and leave. This is the exact gesture that took the name
     away: the pointer never touched the focused mark. */
  const other = await marks.nth(5).boundingBox();
  await page.mouse.move(other.x + other.width / 2, other.y + other.height / 2);
  await page.waitForTimeout(120);
  await page.mouse.move(other.x + 500, other.y - 200);
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => ({
    on: document.getElementById("tip").classList.contains("on"),
    text: document.getElementById("tip").textContent,
    stillFocused: document.activeElement.classList.contains("dot"),
  }));
  ok("a focused mark keeps its name when a pointer crosses its neighbours",
    held.on && after.stillFocused && after.on && after.text === held.text,
    `${JSON.stringify(held)} then ${JSON.stringify(after)}`);
  await page.close();
}
