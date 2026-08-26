/* ══ round 1, batch 2 ═══════════════════════════════════════════════
   The degraded states were assembled from full-state parts and never
   reconciled to their own claims, so two of them stated one thing and drew
   another. Written before the fixes and watched failing. */

/* quiet-state-contradicts-its-own-evidence · no claim may contradict the
   marks beside it. This is asserted for every state that draws a strip,
   not only the one where it was found, because the class is the assembly
   and not the state. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    for (const variant of config.variants) {
      const page = await open({ state, variant, reducedMotion: true });
      const claim = await page.evaluate(() => {
        /* main, not body: body.textContent includes the <script>
           element, so a template literal in the source matched and the
           assertion graded the code rather than the page. */
        const text = (document.querySelector("main") || document.body).textContent;
        const dots = Array.from(document.querySelectorAll(".dot"));
        const ages = dots.map((d) => {
          const m = (d.getAttribute("aria-label") || "").match(/open (\d+) days?/);
          return m ? Number(m[1]) : null;
        });
        const head = document.querySelector(".card.ages .band-head .t-label");
        const oldestLabel = head ? Number((head.textContent.match(/(\d+)/) || [])[1]) : null;
        const sr = document.querySelector(".card.ages .sr");
        const spoken = sr ? Number((sr.textContent.match(/(\d+) (?:job has|jobs have) been open longer/) || [])[1]) : null;
        const card = Array.from(document.querySelectorAll(".kpi")).find((c) => /fortnight/.test(c.textContent));
        const claimed = card ? Number((card.querySelector(".t-num").textContent || "").trim()) : null;
        return {
          reassures: /Nothing is sitting/.test(text),
          old: dots.filter((d) => d.classList.contains("old")).length,
          maxAge: ages.length ? Math.max(...ages) : null,
          oldestLabel,
          spoken,
          claimed,
          fortnight: window.LATELY_FIXTURE.fortnight,
        };
      });
      if (claim.reassures) {
        ok(`nothing is sitting means nothing is drawn sitting · ${state} @ ${variant}`,
          claim.old === 0 && claim.spoken === 0 && claim.maxAge < claim.fortnight,
          JSON.stringify(claim));
      }
      ok(`the oldest label is the oldest mark · ${state} @ ${variant}`,
        claim.oldestLabel === claim.maxAge, `${claim.oldestLabel} vs ${claim.maxAge}`);
      if (claim.claimed !== null) {
        ok(`the fortnight card equals the marks past the line · ${state} @ ${variant}`,
          claim.claimed === claim.old && claim.claimed === claim.spoken,
          `card ${claim.claimed}, marks ${claim.old}, spoken ${claim.spoken}`);
      }
      await page.close();
    }
  }
}

/* first-run-shows-a-41-day-old-job · an account cannot hold work older
   than the account. The bound is the days of record the state itself
   claims, not a number typed into a filter. */
{
  const page = await open({ state: "first-run", reducedMotion: true });
  const age = await page.evaluate(() => {
    const f = window.LATELY_FIXTURE;
    const first = document.querySelector(".xaxis span");
    const ages = Array.from(document.querySelectorAll(".dot")).map((d) => {
      const m = (d.getAttribute("aria-label") || "").match(/open (\d+) days?/);
      return m ? Number(m[1]) : null;
    });
    const start = new Date(f.weeks[f.weeks.length - 1].iso + "T00:00:00Z");
    const read = new Date(f.bound.readingDate + "T00:00:00Z");
    const accountDays = Math.round((read - start) / 86400000);
    return { max: ages.length ? Math.max(...ages) : null, accountDays, dots: ages.length, firstTick: first ? first.textContent : null };
  });
  ok("no job is older than the account that holds it", age.max !== null && age.max <= age.accountDays,
    `oldest ${age.max}, account ${age.accountDays} days`);
  ok("first-run still draws every open job", age.dots === 9, `${age.dots}`);
  await page.close();
}

/* age-axis-labels-are-laid-out-by-flexbox-not-by-value · every tick sits
   where its value sits. The shipped fixture's oldest job rounds the axis
   to exactly 45, which is the only reason the two ever agreed. */
{
  for (const state of ["full", "quiet", "first-run"]) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const ticks = await page.evaluate(() => {
        const strip = document.querySelector(".strip");
        if (!strip) return null;
        const box = strip.getBoundingClientRect();
        const marks = Array.from(document.querySelectorAll(".strip-scale span"));
        const axisMax = Number(strip.dataset.axisMax);
        const worst = marks.map((m) => {
          const days = /today/i.test(m.textContent) ? 0 : Number((m.textContent.match(/(\d+)/) || [])[1]);
          const want = box.left + (days / axisMax) * box.width;
          const r = m.getBoundingClientRect();
          const got = days === 0 ? r.left : (days === axisMax ? r.right : (r.left + r.right) / 2);
          return Math.abs(got - want);
        });
        const inside = marks.every((m) => {
          const r = m.getBoundingClientRect();
          return r.left >= box.left - 1 && r.right <= box.right + 1;
        });
        return { worst: marks.length ? Math.max(...worst) : 0, inside, n: marks.length, axisMax };
      });
      if (ticks) {
        ok(`every age tick stands on its own value · ${state} @ ${vp.name}`, ticks.worst <= 4, `${Math.round(ticks.worst)}px off over ${ticks.n} ticks`);
        ok(`no age tick leaves the strip · ${state} @ ${vp.name}`, ticks.inside);
      }
      await page.close();
    }
  }
}

/* The axis maximum is derived from the data, so a short account gets a
   short axis and a long tail still fits. A floor typed at 45 forced a
   three-day-old account to draw a six-week ruler. */
{
  for (const state of ["full", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const axis = await page.evaluate(() => {
      const strip = document.querySelector(".strip");
      if (!strip) return null;
      const ages = Array.from(document.querySelectorAll(".dot")).map((d) => Number((d.getAttribute("aria-label").match(/open (\d+)/) || [])[1]));
      const max = Number(strip.dataset.axisMax);
      const rule = document.querySelector(".fortnight");
      return { max, oldest: Math.max(...ages), fortnight: window.LATELY_FIXTURE.fortnight, ruleDrawn: Boolean(rule) };
    });
    if (axis) {
      ok(`the age axis is derived from its own data · ${state}`, axis.max >= axis.oldest && axis.max < axis.oldest + 10,
        `max ${axis.max}, oldest ${axis.oldest}`);
      ok(`the fortnight rule is drawn only where it can be crossed · ${state}`,
        axis.ruleDrawn === (axis.fortnight <= axis.max), `rule ${axis.ruleDrawn}, max ${axis.max}`);
    }
    await page.close();
  }
}

/* first-run-plot-has-no-scale · a mark whose height is a typed literal
   encodes nothing. The single week stands at the pitch it will hold when
   the twelve-week chart arrives, and it says in words what it draws. */
{
  const page = await open({ state: "first-run", reducedMotion: true });
  const plot = await page.evaluate(() => {
    const bar = document.querySelector(".plot .bar");
    const sr = document.querySelector(".chart .sr");
    const f = window.LATELY_FIXTURE;
    return {
      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,
      value: f.weeks[f.weeks.length - 1].v,
      spoken: sr ? sr.textContent : "",
      width: bar ? Math.round(bar.getBoundingClientRect().width) : null,
    };
  });
  ok("the first-run mark's height comes from its value, not a literal", plot.h === 100, `--h ${plot.h}`);
  ok("the first-run chart has a spoken equivalent", /finished/.test(plot.spoken) && plot.spoken.length > 20, plot.spoken.slice(0, 60));
  ok("the first-run mark stands at a real column's width", plot.width !== null && plot.width <= 60, `${plot.width}px`);
  await page.close();
}

/* count-of-one-takes-a-plural-verb · every sentence agrees with its own
   numeral, on screen and in the accessibility tree, at 0, 1 and more. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const grammar = await page.evaluate(() => {
      const bad = [];
      const check = (s, where) => {
        if (!s) return;
        if (/\bjobs\s+(has|is|was)\b/.test(s)) bad.push(`${where}: ${s.slice(0, 60)}`);
        if (/\b1 job\s+(have|are|were|haven't|aren't)\b/.test(s)) bad.push(`${where}: ${s.slice(0, 60)}`);
        if (/\bAll 1 open job\b/.test(s)) bad.push(`${where}: ${s.slice(0, 60)}`);
      };
      for (const el of document.querySelectorAll(".kpi")) {
        check(el.textContent, "card");
        check(el.querySelector(".sr")?.textContent, "card name");
      }
      for (const el of document.querySelectorAll("main p, main span, .sr")) check(el.textContent, "copy");
      return bad;
    });
    ok(`every sentence agrees with its own numeral · ${state}`, grammar.length === 0, grammar.slice(0, 3).join(" | "));
    await page.close();
  }
}
