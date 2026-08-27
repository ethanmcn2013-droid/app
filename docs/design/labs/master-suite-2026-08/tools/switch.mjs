/* ═══════════════════════════════════════════════════════════════════
   THE PRODUCT SWITCH — the one frame the suite was missing.

   This shell mounts all three products at once and never tears one down.
   `go()` toggled `hidden` and `inert` with nothing interpolating between
   two products already in the same document, so the largest change of
   state the shell can make was the only one with no frame at all.

   Six things are measured here, and the last two are the ones that would
   have made landing this a mistake:

     1. one `startViewTransition` per switch, and none on a reproject
     2. exactly one RENDERED element per transition name
     3. the fade reads THROUGH, not ACROSS — measured on a real frame
     4. zero console or page errors across a full round trip
     5. the switch is never POSTPONED: the DOM mutates on the same frame
        it always did, whatever the transition is doing on top
     6. reduced motion gets no transition at all

   On (3): the browser's default cross-fade runs both snapshots at 50%
   opacity through the middle. Two dense text layouts at half opacity read
   as mud — a board of thirteen cards showing through a notebook of
   fourteen rows. The fix is to fade THROUGH: outgoing gone by 40%,
   incoming from 40% on. That is a claim about a frame, so it is checked
   on a frame: the groups are slowed to 4s and the sheet's ink is counted
   at 35% through. If the two layouts overlap, that count sits near the
   resting count. If they never overlap, it collapses.
   ═══════════════════════════════════════════════════════════════════ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/* EDGE ENERGY, not ink. The first draft of this rule counted dark pixels
   and reported the mid frame as 100% ink — because the frame it caught
   was the whole board dimmed to charcoal against the floor, which is very
   dark and carries no legible text at all. A brightness threshold cannot
   tell "two layouts at half opacity" from "one layout on a dark ground";
   both are dark. It also cannot tell blank paper from blank floor.

   Local contrast can. Type produces edges — a light-to-dark step across
   two pixels — and a blank sheet produces almost none at any brightness.
   Two layouts crossing produce MORE edges than either alone. That is the
   quantity the claim is actually about: not how dark the frame is, but
   how much of it is legible.

   The wrong metric was not a wasted hour. It is what caught the real
   defect: the mid frame should never have been dark at all. */
async function edgeEnergy(page, PNG, clip) {
  const buf = await page.screenshot({ clip });
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  let edges = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x + 2 < width; x += 1) {
      const i = (y * width + x) * 4;
      if (Math.abs(lum(i) - lum(i + 8)) > 40) edges += 1;
    }
  }
  return { edges, total: width * height, buf };
}

export async function switchFrame({ browser, url, check, head, lab }) {
  head("19 · the product switch — the one missing frame");

  const { PNG } = await import(
    (await import("node:url")).pathToFileURL(
      path.resolve(lab, "../../../../../studio/node_modules/pngjs/lib/png.js"),
    ).href
  );

  /* ── 1 · one transition per switch, none on a reproject ──────────── */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      window.__VT = 0;
      window.__HAS = typeof document.startViewTransition === "function";
      if (!window.__HAS) return;
      const real = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => { window.__VT += 1; return real(cb); };
    });
    const has = await page.evaluate(() => window.__HAS);
    check("switch", "this browser has same-document view transitions", has === true,
      has ? "startViewTransition present" : "not supported — the rest measures the fallback");

    const r = await page.evaluate(async () => {
      const seen = [];
      for (const p of ["notes", "timeline", "tasks"]) {
        const before = window.__VT;
        window.__SUITE.go(p);
        await new Promise((x) => setTimeout(x, 700));
        seen.push({ p, calls: window.__VT - before,
          landed: document.querySelector("#deck").getAttribute("data-product") });
      }
      const beforeRefresh = window.__VT;
      window.__SUITE.refresh();
      await new Promise((x) => setTimeout(x, 300));
      /* And going where you already are is not a change of product. */
      window.__SUITE.go("tasks");
      await new Promise((x) => setTimeout(x, 300));
      return { seen, quiet: window.__VT - beforeRefresh };
    });
    check("switch", "one transition per product change",
      r.seen.length === 3 && r.seen.every((s) => s.calls === 1 && s.landed === s.p),
      JSON.stringify(r.seen));
    check("switch", "a reproject and a no-op do not animate",
      r.quiet === 0, r.quiet + " transitions on a rename and a same-product go");
    check("switch", "the round trip throws nothing", errs.length === 0, errs.slice(0, 2).join(" | "));
    await page.close();
  }

  /* ── 2 · exactly one RENDERED element per name ───────────────────
     All three products declare `.sheet`, and a duplicate name makes
     Chromium skip the whole transition. What makes one static name safe
     is that the other two products are `[hidden]` and therefore not
     painted — so the thing to count is RENDERED elements, not matching
     selectors. Counting selectors would have found three and proved
     nothing either way. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    for (const product of ["tasks", "notes", "timeline"]) {
      const m = await page.evaluate(async (p) => {
        window.__SUITE.go(p);
        await new Promise((x) => setTimeout(x, 700));
        const tally = {};
        for (const el of document.querySelectorAll("*")) {
          const name = getComputedStyle(el).viewTransitionName;
          if (!name || name === "none") continue;
          const shown = el.checkVisibility
            ? el.checkVisibility({ checkVisibilityCSS: true })
            : !!el.offsetParent;
          if (!shown) continue;
          tally[name] = (tally[name] || 0) + 1;
        }
        return tally;
      }, product);
      check("switch", `${product} · one rendered element per transition name`,
        m.sheet === 1 && m["rail-active"] === 1,
        JSON.stringify(m));
    }
    await page.close();
  }

  /* ── 3 · the fade reads THROUGH, not ACROSS ──────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);

    /* Slowed 18× so a frame can be caught by hand the way a person would
       catch it. The old/new animations are scaled by the same factor, so
       the SHAPE of the hand-off is what is being looked at, not its
       speed. */
    await page.addStyleTag({ content: `
      ::view-transition-group(sheet),
      ::view-transition-group(rail-active) { animation-duration: 4000ms !important; }
      ::view-transition-old(sheet) { animation-duration: 1600ms !important; }
      ::view-transition-new(sheet) { animation-duration: 2400ms !important; animation-delay: 1600ms !important; }
    ` });

    const clip = await page.evaluate(() => {
      const el = document.querySelector('.app:not([hidden]) .sheet, .app:not([hidden]).sheet');
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y),
        width: Math.round(Math.min(r.width, innerWidth - r.x)),
        height: Math.round(Math.min(r.height, innerHeight - r.y)) };
    });

    const rest = await edgeEnergy(page, PNG, clip);

    /* Start the switch and catch the frame 35% through the 4s group. */
    await page.evaluate(() => { window.__SUITE.go("notes"); });
    await page.waitForTimeout(1400);                    /* 35% of 4000ms */
    const mid = await edgeEnergy(page, PNG, clip);
    await page.waitForTimeout(3200);
    const after = await edgeEnergy(page, PNG, clip);

    const shots = path.join(lab, "shots");
    await mkdir(shots, { recursive: true });
    await writeFile(path.join(shots, "switch-00-before.png"), rest.buf);
    await writeFile(path.join(shots, "switch-35-mid.png"), mid.buf);
    await writeFile(path.join(shots, "switch-100-after.png"), after.buf);

    const pct = (n) => Math.round((n / rest.total) * 1000) / 10;
    const floor = Math.min(rest.edges, after.edges);
    const ratio = floor ? mid.edges / floor : 0;

    check("switch", "both resting layouts carry real type to compare",
      rest.edges > rest.total * 0.01 && after.edges > after.total * 0.01,
      `before ${pct(rest.edges)}% edges · after ${pct(after.edges)}%`);
    /* A default cross-fade at 35% has BOTH layouts near half opacity, so
       it counts MORE edges than either at rest, never fewer. A clean
       hand-off counts almost none: the outgoing is gone, the incoming has
       not begun, and what is on screen is the carried sheet with nothing
       printed on it yet. A quarter of the lighter resting frame is a
       generous line to draw. */
    check("switch", "the two layouts never overlap mid-transition",
      ratio < 0.25,
      `mid ${pct(mid.edges)}% of the sheet in edges against ${pct(rest.edges)}% before ` +
      `and ${pct(after.edges)}% after — ${Math.round(ratio * 100)}% of the lighter one`);
    await page.close();
  }

  /* ── 4 · the switch is never postponed ───────────────────────────
     The old architecture carried a deliberate 120ms delay on this switch
     and it was removed on purpose. A transition that WRAPS the mutation
     costs nothing; one that awaits a snapshot before mutating gives the
     delay back. The difference is invisible in a screenshot and is the
     whole reason mounting all three products is worth doing. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    /* MEASURED, not assumed synchronous. `startViewTransition` calls its
       callback after it has captured the old state — one frame, not zero —
       so a rule demanding the attribute on the very next microtask fails
       against a correct implementation, which is how the first draft of
       this rule failed. The claim that matters is not "instant", it is
       "not POSTPONED": the old architecture deliberately held this switch
       for 120ms and that is the thing that must never come back. One frame
       at 60Hz is 16ms; a budget of 50 leaves room for a slow frame and
       still fails anything that waits on an animation. */
    /* MEASURED AGAINST ITS OWN BASELINE, which is the only way to say
       anything true here. `startViewTransition` calls its callback after
       it has captured the old state — a frame or two, not zero — so a
       rule demanding the attribute on the next microtask fails against a
       correct implementation, which is exactly how the first draft of
       this rule failed. And an absolute budget would be a number pulled
       out of the air: what the founder's rule actually forbids is a
       DESIGNED wait, of the kind the old architecture carried at 120ms.

       So both paths are timed on the same machine in the same run: once
       with the transition, once with `startViewTransition` removed so the
       fallback runs. The difference between them is the whole cost of
       landing this, and it is reported rather than hidden behind a pass. */
    const timeSwitches = () => page.evaluate(async () => {
      const marks = [];
      for (const p of ["notes", "timeline", "tasks"]) {
        const t0 = performance.now();
        window.__SUITE.go(p);
        const landed = await new Promise((done) => {
          const tick = () => {
            if (document.querySelector("#deck").getAttribute("data-product") === p) {
              done(performance.now() - t0);
            } else if (performance.now() - t0 > 400) done(-1);
            else requestAnimationFrame(tick);
          };
          tick();
        });
        marks.push(landed);
        await new Promise((x) => setTimeout(x, 700));
      }
      return marks;
    });

    const withVT = await timeSwitches();
    await page.evaluate(() => { document.startViewTransition = undefined; });
    const without = await timeSwitches();
    const mean = (a) => a.reduce((n, x) => n + x, 0) / a.length;
    const vt = Math.round(mean(withVT));
    const base = Math.round(mean(without));
    const cost = vt - base;

    check("switch", "every switch lands, both paths",
      withVT.every((m) => m >= 0) && without.every((m) => m >= 0),
      `with ${withVT.map(Math.round).join("/")}ms · without ${without.map(Math.round).join("/")}ms`);
    /* THE RULE: wrapping may cost the browser's snapshot and nothing
       more. Three frames at 60Hz is 50ms; the old architecture's designed
       delay was 120ms on top of the work. A ceiling of 60ms over the
       fallback fails anything that waits on the animation itself — which
       is 220ms — while allowing the capture the API cannot avoid. */
    check("switch", "the mutation is wrapped, not postponed",
      cost < 60,
      `${vt}ms with the transition against ${base}ms without — the wrap costs ${cost}ms, ` +
      `and the animation it starts runs 220ms after it`);
  }

  /* ── 5 · reduced motion gets no transition at all ────────────────── */
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      reducedMotion: "reduce",
    });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(800);
    const m = await page.evaluate(async () => {
      let calls = 0;
      const real = document.startViewTransition && document.startViewTransition.bind(document);
      if (real) document.startViewTransition = (cb) => { calls += 1; return real(cb); };
      window.__SUITE.go("notes");
      await new Promise((x) => setTimeout(x, 500));
      const sheet = document.querySelector('.app:not([hidden]) .sheet, .app:not([hidden]).sheet');
      return {
        calls,
        landed: document.querySelector("#deck").getAttribute("data-product"),
        name: sheet ? getComputedStyle(sheet).viewTransitionName : "?",
        /* And the round-5 fallback entrance must not play either. */
        arriving: document.querySelectorAll("[data-arriving]").length,
      };
    });
    check("switch", "reduced motion · no transition is started",
      m.calls === 0, m.calls + " calls");
    check("switch", "reduced motion · the names are off and the switch still lands",
      m.name === "none" && m.landed === "notes", JSON.stringify(m));
    check("switch", "reduced motion · the fallback entrance does not play either",
      m.arriving === 0, m.arriving + " arriving");
    await page.close();
  }

  /* ── 6 · and the two motions never both play ─────────────────────
     Round 5 landed a fade-and-lift on the incoming product because the
     switch had no motion. This transition is strictly better where it
     runs, so the entrance is now the FALLBACK — and a browser that has
     both would otherwise play both. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(800);
    const both = await page.evaluate(async () => {
      window.__SUITE.go("notes");
      await new Promise((x) => setTimeout(x, 60));
      return document.querySelectorAll("[data-arriving]").length;
    });
    check("switch", "where the transition runs, the fallback entrance does not",
      both === 0, both + " products stamped data-arriving");
    await page.close();
  }
}
