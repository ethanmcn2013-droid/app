/* ══ round 1, batch 3 ═══════════════════════════════════════════════
   Honesty in the headline, the error state and the accessibility tree.
   Written before the fixes and watched failing. */

/* hero-total-folds-the-unfinished-week · the surface quarantines the
   running week everywhere except the one number the whole page is built
   around. Drop the running bucket and the same window reads 19 against
   26 — the printed sign is produced entirely by the unflagged week. */
{
  for (const state of ["full", "partial", "quiet"]) {
    const page = await open({ state, reducedMotion: true });
    const hero = await page.evaluate(() => {
      const f = window.LATELY_FIXTURE;
      const band = document.querySelector('[id^="m1"]')?.closest(".band");
      const label = band?.querySelector(".band-head .t-label")?.textContent ?? "";
      const note = document.querySelector(".hero-note")?.textContent ?? "";
      const last = f.weeks[f.weeks.length - 1];
      return { label, note, partial: Boolean(last.partial), readingShort: f.readingShort, lastStart: last.start };
    });
    if (hero.partial) {
      ok(`the running week is named where the figure is read · ${state}`,
        /still running/.test(hero.note), hero.note.slice(0, 80));
      ok(`the window ends on the reading, not on a week's first day · ${state}`,
        hero.label.includes(hero.readingShort) && !hero.label.trim().endsWith(hero.lastStart), hero.label);
    }
    await page.close();
  }
}

/* error-state-invents-a-last-good-reading · the state built to say the
   reading failed must not stamp a successful one at the instant of the
   failure. The fixture holds no earlier reading, so there is none to print. */
{
  const page = await open({ state: "error", reducedMotion: true });
  const err = await page.evaluate(() => {
    const text = (document.querySelector("main") || document.body).textContent;
    const want = window.LATELY_FIXTURE.readingLong;
    let n = 0, i = 0;
    while ((i = text.indexOf(want, i)) >= 0) { n += 1; i += want.length; }
    return { claimsLastGood: /Last good reading/.test(text), instances: n };
  });
  ok("the error state claims no reading it does not hold", !err.claimsLastGood, `${err.instances} stamps`);
  await page.close();
}

/* mark-hit-theft-at-390 · a stacked mark's expander covered its
   neighbour's centre, so a tap on one mark answered with another job's
   name and another day count. Euclidean distance cannot see occlusion. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      await page.locator(".dot").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      const own = await page.evaluate(() => {
        /* elementFromPoint is viewport-relative, so a strip below the fold
           reports every mark as stolen. Scroll it into view first — the
           first version of this check failed 9 of 9 at every width and was
           measuring the fold, not the occlusion. */
        const dots = Array.from(document.querySelectorAll(".dot"));
        const stolen = [];
        for (const d of dots) {
          const r = d.getBoundingClientRect();
          const at = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          const owner = at ? at.closest(".dot") : null;
          if (owner !== d) stolen.push((d.getAttribute("aria-label") || "").slice(0, 30));
        }
        return { stolen, n: dots.length };
      });
      ok(`every mark owns its own centre · ${state} @ ${vp.name}`, own.stolen.length === 0, `${own.stolen.length} of ${own.n}: ${own.stolen.slice(0, 2).join(" | ")}`);
      await page.close();
    }
  }
}

/* two-capitalisation-rules-in-one-tab-strip · the naming contract names
   the surface the Full Briefing. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll(".tab")).map((t) => t.textContent.trim()));
  ok("the tab strip names every surface the way the contract does",
    JSON.stringify(tabs) === JSON.stringify(["Today’s Signal", "Full Briefing", "Lately"]), tabs.join(" | "));
  await page.close();
}

/* partial-drops-the-best-week-unannounced · a mark may not vanish for a
   reason the screen never gives. Timeline governs due dates; the twelve
   weekly counts and the previous best come from Tasks, which answered. */
{
  const page = await open({ state: "partial", reducedMotion: true });
  const kept = await page.evaluate(() => ({
    record: Boolean(document.querySelector(".record-tag")),
    spoken: /best week/i.test(document.querySelector(".chart .sr")?.textContent ?? ""),
    columns: document.querySelectorAll(".plot .bar").length,
  }));
  ok("a degraded state loses only what its unanswered source fed", kept.record && kept.spoken && kept.columns === 12, JSON.stringify(kept));
  await page.close();
}

/* chart-is-announced-twice · the chart has a written equivalent, and the
   visual furniture beside it is not read out as a second, looser copy —
   including eight x-axis dates that are not on the screen at all. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const heard = await page.evaluate(() => {
      const chart = document.querySelector(".chart");
      if (!chart) return null;
      const leaves = [];
      const walk = (el) => {
        if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return;
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim()) leaves.push(n.textContent.trim());
          else if (n.nodeType === 1) walk(n);
        }
      };
      walk(chart);
      const sr = chart.querySelector(".sr");
      const invisibleText = Array.from(chart.querySelectorAll("*")).filter((el) => {
        const cs = getComputedStyle(el);
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
        return own && parseFloat(cs.opacity) === 0 && cs.visibility !== "hidden" && el.getAttribute("aria-hidden") !== "true";
      }).length;
      return { leaves: leaves.length, spoken: Boolean(sr), invisibleText };
    });
    if (heard) {
      ok(`the chart is announced once · ${state}`, heard.spoken && heard.leaves === 1, `${heard.leaves} text leaves in the tree`);
      ok(`no invisible label carries live text · ${state}`, heard.invisibleText === 0, `${heard.invisibleText}`);
    }
    await page.close();
  }
}

/* terminal-states-lose-their-heading-and-announce-nothing · the two
   states where something has gone wrong are the two a reader navigating
   by heading finds empty, and neither ever announces. */
{
  for (const state of config.states) {
    const page = await open({ state, reducedMotion: true });
    const structure = await page.evaluate(() => {
      const heads = Array.from(document.querySelectorAll("main h1, main h2, main h3"));
      const sections = Array.from(document.querySelectorAll("main section"));
      const unlabelled = sections.filter((s) => {
        const id = s.getAttribute("aria-labelledby");
        return !id || !document.getElementById(id);
      }).length;
      return {
        heads: heads.length,
        unlabelled,
        status: document.querySelectorAll("[role=status]").length,
        alert: document.querySelectorAll("[role=alert]").length,
      };
    });
    ok(`every state offers a heading inside main · ${state}`, structure.heads > 0, `${structure.heads}`);
    ok(`every section names itself · ${state}`, structure.unlabelled === 0, `${structure.unlabelled} unlabelled`);
    if (state === "loading") ok("the loading state announces politely", structure.status === 1 && structure.alert === 0, JSON.stringify(structure));
    if (state === "error") ok("the error state announces assertively", structure.alert === 1 && structure.status === 0, JSON.stringify(structure));
    if (state !== "loading" && state !== "error") {
      ok(`no live region where nothing is happening · ${state}`, structure.status === 0 && structure.alert === 0, JSON.stringify(structure));
    }
    await page.close();
  }
}
