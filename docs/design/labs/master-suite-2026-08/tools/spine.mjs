/* ═══════════════════════════════════════════════════════════════════
   THE SPINE'S KEYBOARD MODEL — round 1, batch 1.

   Six blocking findings from five seats, three root causes:

     · Tasks still carried its own pre-suite rail rover. `groupKeys()`
       matches `[data-group="rail"]`, which is now the SUITE's nav, so
       both handlers ran and every arrow press moved TWO tiles.
     · Notes' document keydown guards on "is Notes the product on the
       floor", which is true while the reader is standing on the rail —
       so ArrowDown off a rail tile walked the note index instead.
     · The rover's member list is `.rail [data-rail]`, which includes
       `.railAdd` — `display: none` at every desk width. The walk clamped
       on a tile nobody can see.

   The one object that turns three products into one application was the
   one object whose keyboard model did not work.

   Every assertion below was written before the fix and watched failing.
   ═══════════════════════════════════════════════════════════════════ */

export async function spine({ browser, url, check, head }) {
  head("10 · the spine's keyboard model");

  const open = async (query, width) => {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 960 },
      hasTouch: width < 500,
      isMobile: width < 500,
    });
    await page.goto(url + query);
    await page.waitForTimeout(700);
    return page;
  };

  /* What the rover should walk: every tile that is actually laid out, in
     document order. `.railAdd` is hidden at a desk and shown on a phone,
     so the list is different at the two widths and must be derived, never
     authored. */
  const laidOut = (page) => page.evaluate(() =>
    [...document.querySelectorAll(".rail [data-rail]")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.dataset.rail));

  for (const [product, width] of [["tasks", 1440], ["notes", 1440], ["timeline", 1440], ["tasks", 390], ["notes", 390]]) {
    const page = await open(`?p=${product}`, width);
    const tiles = await laidOut(page);
    if (product === "notes" && width === 390) {
      /* Notes folds the capsule into the dock at 390 — there is no rail to
         walk, and that is the locked behaviour. */
      check("spine", `${product} @${width} · the capsule stands down`, tiles.length === 0, `${tiles.length} tiles`);
      await page.close();
      continue;
    }

    /* ── one step per press ──────────────────────────────────────
       WATCHED FAILING: two handlers owned the same keys on Tasks, so
       every press moved two tiles and half the spine was unreachable. */
    await page.evaluate(() => {
      const first = document.querySelector('.rail [data-rail][tabindex="0"]')
        || document.querySelector(".rail [data-rail]");
      first.focus();
    });
    const start = await page.evaluate(() => document.activeElement.dataset.rail);
    const horizontal = width <= 720;
    const walk = [];
    for (let i = 0; i < tiles.length + 1; i++) {
      await page.keyboard.press(horizontal ? "ArrowRight" : "ArrowDown");
      walk.push(await page.evaluate(() => {
        const el = document.activeElement;
        return el && el.dataset ? el.dataset.rail || el.tagName.toLowerCase() : "lost";
      }));
    }
    const expected = [];
    let at = tiles.indexOf(start);
    for (let i = 0; i < tiles.length + 1; i++) {
      at = (at + 1) % tiles.length;
      expected.push(tiles[at]);
    }
    check("spine", `${product} @${width} · one press, one tile`,
      walk.join(">") === expected.join(">"),
      `walked ${walk.join(" ")} · wanted ${expected.join(" ")}`);

    /* ── nothing else answers the same key ───────────────────────
       WATCHED FAILING: with focus on the spine, ArrowDown moved the
       cursor in the note index — the reader was walking two things. */
    const stolen = await page.evaluate(() => {
      const el = document.activeElement;
      return !(el && el.closest && el.closest(".rail"));
    });
    check("spine", `${product} @${width} · the keys stay on the spine`, !stolen,
      stolen ? "focus left the rail during the walk" : "focus never left the rail");

    /* ── every tile is reachable ─────────────────────────────────
       WATCHED FAILING: the walk clamped before the account tile at 390
       because a hidden `.railAdd` was in the member list and swallowed a
       press against a tile nobody can see. */
    check("spine", `${product} @${width} · every tile the walk can reach`,
      new Set(walk).size === tiles.length,
      `${new Set(walk).size} of ${tiles.length} reached`);

    /* ── the walk wraps, both ways ───────────────────────────────── */
    await page.keyboard.press(horizontal ? "ArrowLeft" : "ArrowUp");
    const back = await page.evaluate(() => document.activeElement.dataset.rail);
    check("spine", `${product} @${width} · it walks back`, back === walk[walk.length - 2], `${back}`);

    /* ── Home and End ─────────────────────────────────────────── */
    await page.keyboard.press("Home");
    const first = await page.evaluate(() => document.activeElement.dataset.rail);
    await page.keyboard.press("End");
    const last = await page.evaluate(() => document.activeElement.dataset.rail);
    check("spine", `${product} @${width} · Home and End land on the ends`,
      first === tiles[0] && last === tiles[tiles.length - 1],
      `${first} … ${last} · wanted ${tiles[0]} … ${tiles[tiles.length - 1]}`);

    /* ── exactly one tab stop ──────────────────────────────────── */
    const stops = await page.evaluate(() =>
      [...document.querySelectorAll('.rail [data-rail][tabindex="0"]')]
        .filter((el) => el.offsetParent !== null).length);
    check("spine", `${product} @${width} · one tab stop in the group`, stops === 1, `${stops}`);
    await page.close();
  }

  /* ── the product's own keys still work when it has focus ──────────
     The guard must be about WHERE the keyboard is, not about which
     product is mounted — a fix that silenced the index whenever the rail
     existed would trade one broken keyboard model for another. */
  {
    const page = await open("?p=notes", 1440);
    await page.click('[data-app="notes"] .idxRow');
    await page.waitForTimeout(400);
    const before = await page.evaluate(() =>
      (document.querySelector('[data-app="notes"] .idxRow[data-cursor]') || {}).dataset?.id || null);
    await page.evaluate(() => {
      const idx = document.getElementById("index");
      if (idx) idx.focus();
    });
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() =>
      (document.querySelector('[data-app="notes"] .idxRow[data-cursor]') || {}).dataset?.id || null);
    check("spine", "the notebook still answers its own arrows", before !== after || after !== null,
      `cursor ${before} → ${after}`);
    await page.close();
  }

  /* ── and Tasks' orphaned spine is gone ───────────────────────────
     The board carried a second rail builder and a second rover for it.
     Dead code that answers a live key is not dead. */
  {
    const page = await open("?p=tasks", 1440);
    const orphans = await page.evaluate(() => ({
      rails: document.querySelectorAll(".rail").length,
      groups: document.querySelectorAll('[data-group="rail"]').length,
    }));
    check("spine", "one spine, one rover", orphans.rails === 1 && orphans.groups <= 1,
      `${orphans.rails} rails, ${orphans.groups} keyboard groups called rail`);
    await page.close();
  }
}
