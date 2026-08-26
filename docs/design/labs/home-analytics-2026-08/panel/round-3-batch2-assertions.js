/* ══ round 3, batch 2 ═══════════════════════════════════════════════
   Six surface findings, each written before its fix and watched failing on
   the surface as it stood: the scale stated twice at the same height, a
   0.0px rung, user-select auto with the fixture's own magnitudes in the
   text, a last line 7.6px wide carrying one digit, a mark inked #111111
   after one tap, and a refusal body running to 716px. */

/* axis-max-and-live-week-print-the-same-number · max is Math.max(D.peak,
   D.bestPrior) and D.peak counts the running week, so on any fixture where
   this week is the best week the top gridline and the live column printed
   the same numeral at the same height. The peak must still be stated —
   by exactly one of them. */
{
  for (const state of ["full", "partial", "quiet"]) {
    const page = await open({ state, reducedMotion: true });
    const scale = await page.evaluate(() => {
      const num = (el) => {
        const m = (el?.textContent || "").match(/\d+/);
        return m ? Number(m[0]) : null;
      };
      const labelled = Array.from(document.querySelectorAll(".gridline")).map(num).filter((n) => n !== null);
      const live = num(document.querySelector(".plot .colw:last-child .bar-val"));
      const drawn = document.querySelectorAll(".gridline").length;
      const peak = Math.max(...Array.from(document.querySelectorAll(".plot .colw .bar"))
        .map((b) => Number(b.style.getPropertyValue("--h")) || 0));
      return { labelled, live, drawn, peakIsLive: peak === 100 };
    });
    ok(`the chart states its peak exactly once · ${state}`,
      !(scale.peakIsLive && scale.live !== null && scale.labelled.includes(scale.live)),
      JSON.stringify(scale));
    ok(`and the rule is still drawn where the numeral stood down · ${state}`,
      scale.drawn >= 2, JSON.stringify(scale));
    await page.close();
  }
}

/* the-age-summary-says-one-days · every other age on this surface goes
   through plural(); this one line hard-coded the plural noun. Asserted as
   a concord rule over the whole spoken tree rather than over the one
   string, so the next hard-coded noun is caught where it is written. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const concord = await page.evaluate(() => {
      const bad = [];
      const nodes = Array.from(document.querySelectorAll("main .sr, main p, main span"));
      for (const el of nodes) {
        const t = el.textContent || "";
        const m = t.match(/\b1 (days|jobs|weeks|hours|marks)\b/);
        if (m) bad.push(`${m[0]} — ${t.slice(0, 50)}`);
      }
      const names = Array.from(document.querySelectorAll("[aria-label]"))
        .map((el) => el.getAttribute("aria-label"))
        .filter((n) => /\b1 (days|jobs|weeks|hours)\b/.test(n));
      return { bad, names };
    });
    ok(`a count of one never takes a plural noun · ${state}`,
      concord.bad.length === 0 && concord.names.length === 0,
      JSON.stringify(concord).slice(0, 160));
    await page.close();
  }
}

/* the-bound-stamp-wraps-and-strands-its-digit · 349px of tracked uppercase
   mono in a 342px content box at 390. Wrapped on a space it left the bare
   digit alone on line two — a number with nothing to say what it counts.
   Measured from a Range over the text, not from the element box: the span
   is a flex item and takes the full row whether its text wraps or not. */
{
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
    const page = await open({ state: "full", viewport: vp, touch: true, reducedMotion: true });
    const stamp = await page.evaluate(() => {
      const out = [];
      for (const s of document.querySelectorAll(".coverage span")) {
        const r = document.createRange();
        r.selectNodeContents(s);
        const rects = Array.from(r.getClientRects());
        if (rects.length < 2) continue;
        const last = rects[rects.length - 1];
        out.push({ w: Math.round(last.width * 10) / 10, text: s.textContent.trim().slice(0, 28) });
      }
      return out;
    });
    ok(`no wrapped stamp strands a lone digit · ${vp.width}`,
      stamp.every((s) => s.w > 40), JSON.stringify(stamp));
    await page.close();
  }
}

/* error-alert-loses-a-rung-the-other-terminal-states-keep · the r1 fix
   wrapped the heading and its sentence in role="alert", which made them
   children of an element with no gap of its own. The three terminal states
   are composed alike and must measure alike. */
{
  for (const variant of config.variants) {
    const gaps = {};
    for (const state of ["empty", "quiet", "error"]) {
      const page = await open({ state, variant, reducedMotion: true });
      gaps[state] = await page.evaluate(() => {
        const c = document.querySelector(".center");
        if (!c) return null;
        const head = c.querySelector("h1, h2, h3");
        if (!head) return null;
        const par = head.parentElement.querySelector("p");
        if (!par) return null;
        return Math.round((par.getBoundingClientRect().top - head.getBoundingClientRect().bottom) * 10) / 10;
      });
      await page.close();
    }
    const measured = Object.values(gaps).filter((n) => n !== null);
    ok(`the terminal states set the same rung under their heading @ ${variant}`,
      measured.length === 3 && new Set(measured).size === 1 && measured[0] >= 15,
      JSON.stringify(gaps));
  }
}

/* loading-hands-over-the-reading-it-says-it-has-not-made · round 2
   neutralised every magnitude that carries geometry and left every fact in
   the DOM as live text, hidden by color: transparent. The existing skeleton
   block reads custom properties, class names and visibility, so it cannot
   fail on a text leak. This one reads what a real selection returns, and
   drives the magnitudes from the fixture rather than typing them. */
{
  const page = await open({ state: "loading", reducedMotion: true });
  const held = await page.evaluate(() => {
    const wrap = document.querySelector(".sk-wrap");
    return {
      userSelect: wrap ? getComputedStyle(wrap).userSelect : null,
      pointerEvents: wrap ? getComputedStyle(wrap).pointerEvents : null,
    };
  });
  ok("the loading frame hands over nothing it says it has not read",
    held.userSelect === "none" && held.pointerEvents === "none", JSON.stringify(held));

  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(120);
  const selected = await page.evaluate(() => {
    const f = window.LATELY_FIXTURE;
    const text = String(window.getSelection() ?? "");
    const magnitudes = [String(f.bound.openCount), String(f.weeks[f.weeks.length - 1].v)];
    return { leaked: magnitudes.filter((n) => new RegExp(`\\b${n}\\b`).test(text)), len: text.length };
  });
  ok("and a real selection returns none of its magnitudes",
    selected.leaked.length === 0, JSON.stringify(selected));
  await page.close();
}

/* tapped-mark-keeps-the-hover-ink-forever · a coarse pointer latches
   :hover onto the last element touched and never releases it. The latch is
   the browser's and cannot be prevented; what can be prevented is a hover
   rule applying to a device that has no hover. One tap, read where it
   lands — a second tap elsewhere moves the latch and hides the defect. */
{
  const page = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true, reducedMotion: true });
  await page.locator(".dot").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box = await page.locator(".dot").first().boundingBox();
  const rest = await page.evaluate(() => getComputedStyle(document.querySelector(".dot")).getPropertyValue("--disc").trim());
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const d = document.querySelector(".dot");
    const tabs = Array.from(document.querySelectorAll(".tab")).map((t) => getComputedStyle(t).color);
    return { latched: d.matches(":hover"), disc: getComputedStyle(d).getPropertyValue("--disc").trim(), tabs };
  });
  ok("a tapped mark keeps the ink it had at rest",
    after.disc === rest, `rest ${rest}, after a tap ${after.disc}, browser latch ${after.latched}`);
  await page.close();

  const strip = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true, reducedMotion: true });
  const tabBox = await strip.locator(".tab").first().boundingBox();
  const tabsRest = await strip.evaluate(() => Array.from(document.querySelectorAll(".tab")).map((t) => getComputedStyle(t).color));
  await strip.touchscreen.tap(tabBox.x + tabBox.width / 2, tabBox.y + tabBox.height / 2);
  await strip.waitForTimeout(200);
  const tabsAfter = await strip.evaluate(() => Array.from(document.querySelectorAll(".tab")).map((t) => getComputedStyle(t).color));
  ok("and a tapped tab does not join the current one at full ink",
    JSON.stringify(tabsRest) === JSON.stringify(tabsAfter),
    `${JSON.stringify(tabsRest)} then ${JSON.stringify(tabsAfter)}`);
  await strip.close();
}

/* refusal-copy-has-no-measure-ceiling · .limits collapses to one column at
   900 and the refusal bodies had no bound at all, so a paragraph that reads
   at 49-55 characters in three columns ran to 121 at 900px. Asserted at the
   widths where the grid has collapsed, which is where the defect lives. */
{
  for (const width of [900, 793, 768]) {
    const page = await open({ state: "full", viewport: { width, height: 1024 }, reducedMotion: true });
    const measure = await page.evaluate(() => {
      const bodies = Array.from(document.querySelectorAll(".limit .t-small"));
      const widths = bodies.map((b) => Math.round(b.getBoundingClientRect().width));
      const chars = bodies.map((b) => {
        const r = document.createRange();
        r.selectNodeContents(b);
        const lines = r.getClientRects().length;
        return lines ? Math.ceil((b.textContent || "").trim().length / lines) : 0;
      });
      return { widths, chars, cap: bodies.length ? getComputedStyle(bodies[0]).maxWidth : "n/a" };
    });
    ok(`the refusal bodies hold a measure · ${width}`,
      measure.cap !== "none" && measure.widths.every((w) => w <= 340) && measure.chars.every((c) => c <= 70),
      JSON.stringify(measure));
    await page.close();
  }
}
