/* ══ round 1, batch 1 ═══════════════════════════════════════════════
   Written before the fixes and watched failing. Each one guards a finding
   seven blind seats raised and a fresh refuter confirmed on the problem.
   Appended into interaction-check.mjs by panel/append-assertions.mjs. */

/* ua-margins-set-the-vertical-rhythm · the declared ladder is the only
   thing setting vertical space. The source gate cannot see a UA margin,
   because the number never appears in the stylesheet. */
{
  const LADDER = [0, 4, 8, 12, 16, 24, 32, 48, 72];
  for (const state of config.states) {
    for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
      const page = await open({ state, reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
      const bad = await page.evaluate((ladder) => {
        const out = [];
        for (const el of document.querySelectorAll("header, header *, main, main *, .coverage, .coverage *")) {
          if (el.closest(".sr")) continue;
          const cs = getComputedStyle(el);
          for (const prop of ["marginTop", "marginBottom"]) {
            const v = Math.round(parseFloat(cs[prop]) * 100) / 100;
            if (!Number.isFinite(v) || v === 0) continue;
            if (!ladder.includes(v)) out.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] + " " + prop + " " + v);
          }
        }
        return out;
      }, LADDER);
      ok("every margin is a rung on the declared ladder · " + state + " @ " + vp.width, bad.length === 0, bad.length + ": " + bad.slice(0, 3).join(" | "));
      await page.close();
    }
  }
}

/* bar-val-overprints-axis-max · the chart's right-edge labels each own
   their space, and none of them leaves the card. */
{
  for (const state of ["full", "partial", "quiet"]) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const clash = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll(".plot .gridline b, .plot .record-tag, .plot .bar-val"));
        const hit = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const boxes = labels.map((el) => ({ el: String(el.className), r: el.getBoundingClientRect() }))
          .filter((b) => b.r.width > 0 && b.r.height > 0);
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (hit(boxes[i].r, boxes[j].r)) overlaps.push(boxes[i].el + " x " + boxes[j].el);
          }
        }
        const card = document.querySelector(".card.hero");
        const cr = card ? card.getBoundingClientRect() : null;
        const escaped = cr ? boxes.filter((b) => b.r.right > cr.right + 0.5 || b.r.left < cr.left - 0.5).map((b) => b.el) : [];
        return { overlaps, escaped };
      });
      ok("no two chart labels overprint · " + state + " @ " + vp.name, clash.overlaps.length === 0, clash.overlaps.join(", "));
      ok("no chart label leaves its card · " + state + " @ " + vp.name, clash.escaped.length === 0, clash.escaped.join(", "));
      await page.close();
    }
  }
}

/* record-tag-never-paints · the previous best is named on screen, not only
   in the spoken line. Laid out is not painted: the tag must hit-test as
   itself, with no clipped ancestor, in every motion mode. */
{
  for (const variant of config.variants) {
    for (const vp of config.viewports) {
      const page = await open({ state: "full", variant, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const painted = await page.evaluate(() => {
        const tag = document.querySelector(".record-tag");
        if (!tag) return { ok: false, why: "no tag" };
        const r = tag.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return { ok: false, why: "box " + Math.round(r.width) + "x" + Math.round(r.height) };
        for (let n = tag; n && n !== document.body; n = n.parentElement) {
          const cp = getComputedStyle(n).clipPath;
          if (cp && cp !== "none") return { ok: false, why: String(n.className) + " clip-path " + cp };
        }
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { ok: Boolean(at && (at === tag || tag.contains(at))), why: at ? String(at.className) || at.tagName : "nothing" };
      });
      ok("the previous best names itself on screen · " + variant + " @ " + vp.name, painted.ok, painted.why);
      await page.close();
    }
  }
}

/* partial-column-is-closed-at-the-top · the edge that carries the meaning
   is the top one. The retired assertion measured the bottom edge, which
   sits on the baseline and is invisible, so it certified its own opposite. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const edges = await page.evaluate(() => {
    const bar = document.querySelector(".plot .colw:last-child .bar");
    const cs = getComputedStyle(bar);
    const solid = document.querySelector(".plot .colw:first-child .bar");
    const cs2 = getComputedStyle(solid);
    return {
      topOpen: parseFloat(cs.borderTopWidth) === 0,
      radiusFlat: parseFloat(cs.borderTopLeftRadius) === 0 && parseFloat(cs.borderTopRightRadius) === 0,
      rails: parseFloat(cs.borderLeftWidth) > 0 && parseFloat(cs.borderRightWidth) > 0,
      hatched: cs.backgroundImage.includes("gradient"),
      finishedIsCapped: parseFloat(cs2.borderTopLeftRadius) > 0,
    };
  });
  ok("the unfinished week is open at the edge a reader can see", edges.topOpen && edges.radiusFlat, JSON.stringify(edges));
  ok("the unfinished week keeps its two rails and its hatch", edges.rails && edges.hatched, JSON.stringify(edges));
  ok("a finished week is capped, so the two shapes differ", edges.finishedIsCapped);
  await page.close();
}

/* kpi-row-shares-no-line · the five cards are comparable only if their
   figures and their marks each sit on one line. */
{
  for (const state of ["full", "partial"]) {
    for (const w of [1280, 1440]) {
      const page = await open({ state, reducedMotion: true, viewport: { width: w, height: 960 } });
      const rows = await page.evaluate(() => {
        const nums = Array.from(document.querySelectorAll(".kpi .t-num")).map((e) => Math.round(e.getBoundingClientRect().top));
        const marks = Array.from(document.querySelectorAll(".kpi .meter, .kpi > .t-label.dim")).map((e) => Math.round(e.getBoundingClientRect().top));
        const span = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
        return { numSpan: span(nums), markSpan: span(marks), n: nums.length, m: marks.length };
      });
      ok("every figure in the row shares one line · " + state + " @ " + w, rows.numSpan <= 1, rows.numSpan + "px across " + rows.n);
      ok("every meter in the row shares one line · " + state + " @ " + w, rows.markSpan <= 1, rows.markSpan + "px across " + rows.m);
      await page.close();
    }
  }
}

/* kpi-row-and-ages-card-share-an-edge · a rung, not a doubled hairline. */
{
  const LADDER = [4, 8, 12, 16, 24, 32, 48, 72];
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const gap = await page.evaluate(() => {
      const ages = document.querySelector(".card.ages");
      if (!ages) return null;
      const prev = ages.previousElementSibling;
      if (!prev) return null;
      return Math.round(ages.getBoundingClientRect().top - prev.getBoundingClientRect().bottom);
    });
    ok("the ages card stands off its neighbour by a rung · " + state, gap !== null && LADDER.includes(gap), gap + "px");
    await page.close();
  }
}

/* axis-ticks-go-ragged · the ruler is one line at every width, and every
   tick it still shows lands inside the card. The bands were measured, not
   guessed: 1140-901 and 792 down both wrap; 900-793 does not. */
{
  for (const w of [1440, 1141, 1140, 1000, 901, 900, 793, 792, 768, 560, 390]) {
    const page = await open({ state: "full", reducedMotion: true, viewport: { width: w, height: 960 }, touch: w <= 480 });
    const axis = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll(".xaxis span")).filter((s) => getComputedStyle(s).display !== "none");
      const hs = spans.map((s) => Math.round(s.getBoundingClientRect().height));
      const card = document.querySelector(".card.hero").getBoundingClientRect();
      const out = spans.filter((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && (r.right > card.right + 0.5 || r.left < card.left - 0.5);
      }).length;
      const doc = document.documentElement;
      return { max: Math.max(...hs), min: Math.min(...hs), shown: spans.length, out, overflow: doc.scrollWidth - doc.clientWidth };
    });
    ok("the week ruler stays on one line · " + w, axis.max === axis.min && axis.max <= 16, axis.min + "-" + axis.max + "px over " + axis.shown + " ticks");
    ok("no week tick leaves the card · " + w, axis.out === 0 && axis.overflow <= 1, axis.out + " out, overflow " + axis.overflow);
    await page.close();
  }
}

/* reading-rule-dangles-at-390 · a connector joins two things or it is not
   drawn. No mark is left at the end of a wrapped line. */
{
  for (const w of [390, 480, 560, 570, 600, 768, 1440]) {
    const page = await open({ state: "full", reducedMotion: true, viewport: { width: w, height: 844 }, touch: w <= 480 });
    const reading = await page.evaluate(() => {
      const rule = document.querySelector(".reading .rule");
      const parts = Array.from(document.querySelectorAll(".reading p"));
      const tops = parts.map((p) => Math.round(p.getBoundingClientRect().top));
      return {
        oneLine: new Set(tops).size === 1,
        ruleShown: rule ? getComputedStyle(rule).display !== "none" : false,
      };
    });
    ok("the reading rule is drawn only when it joins something · " + w, reading.oneLine === reading.ruleShown, JSON.stringify(reading));
    await page.close();
  }
}
