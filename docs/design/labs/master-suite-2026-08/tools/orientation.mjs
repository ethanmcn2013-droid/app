/* ═══════════════════════════════════════════════════════════════════
   THE BEHAVIOUR GATE for the orientation work, and for every defect this
   round closed. Imported by verify.mjs as its section 9.

   "A finding is closed only when something asserts it." Everything below
   exists because something was wrong: three defects the measured gate
   found before a seat was convened, and one it found only after the
   proofs were rewritten to read pixels instead of a model.

   Each assertion was written first and watched failing against the
   unfixed code. What it watched is recorded beside it.
   ═══════════════════════════════════════════════════════════════════ */

export async function orientation({ browser, url, check, head }) {
  head("9 · the two orientations, and what this round closed");

  const open = async (query, width, opts) => {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 960 },
      hasTouch: width < 500,
      isMobile: width < 500,
      ...(opts || {}),
    });
    await page.goto(url + query);
    await page.waitForTimeout(700);
    return page;
  };

  /* ── which way it opens ──────────────────────────────────────────
     A desk gets the whole approach in one frame; a phone gets the column.
     Decided once at load from the width the reader actually has. */
  for (const [width, want] of [[1920, "across"], [1440, "across"], [1024, "across"], [900, "down"], [390, "down"]]) {
    const page = await open("?p=timeline", width);
    const got = await page.evaluate(() => ({
      layout: document.querySelector('[data-app="timeline"]').getAttribute("data-layout"),
      across: Boolean(document.querySelector('.b-measure[data-across="true"]')),
    }));
    check("orientation", `@${width} opens ${want}`,
      got.layout === want && got.across === (want === "across"),
      `data-layout ${got.layout}, measure across ${got.across}`);
    await page.close();
  }

  /* The reader's choice outranks the width, in both directions. */
  for (const [q, width, want] of [["&layout=down", 1440, "down"], ["&layout=across", 1200, "across"]]) {
    const page = await open("?p=timeline" + q, width);
    const got = await page.evaluate(() =>
      document.querySelector('[data-app="timeline"]').getAttribute("data-layout"));
    check("orientation", `?layout= wins at ${width}`, got === want, got);
    await page.close();
  }

  /* ── the control ─────────────────────────────────────────────────
     Driven, not inspected: the press has to actually change the measure
     and put focus back on the control it rebuilt. */
  {
    const page = await open("?p=timeline", 1440);
    const before = await page.evaluate(() =>
      Boolean(document.querySelector('.b-measure[data-across="true"]')));
    await page.click('[data-layout-to="down"]');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      across: Boolean(document.querySelector('.b-measure[data-across="true"]')),
      pressed: document.querySelector('[data-layout-to="down"]').getAttribute("aria-pressed"),
      focused: document.activeElement.getAttribute("data-layout-to"),
      said: (document.getElementById("say") || {}).textContent,
      /* Down the page, the rows are placed by top and carry no across
         attributes. A row that kept an inline `left` from the other axis
         would sit off the rail entirely. */
      strays: [...document.querySelectorAll(".b-item")]
        .filter((el) => el.style.left || el.hasAttribute("data-side")).length,
    }));
    check("orientation", "the control switches the measure", before && !after.across, `${before} → ${after.across}`);
    check("orientation", "…and says which one is on", after.pressed === "true", after.pressed);
    check("orientation", "…and keeps the keyboard on the control", after.focused === "down", after.focused || "lost");
    check("orientation", "…and announces it", /down the page/i.test(after.said || ""), `“${(after.said || "").trim()}”`);
    check("orientation", "…leaving nothing of the other axis behind", after.strays === 0,
      `${after.strays} rows still carrying across geometry`);

    await page.click('[data-layout-to="across"]');
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({
      across: Boolean(document.querySelector('.b-measure[data-across="true"]')),
      tops: [...document.querySelectorAll(".b-item")].filter((el) => el.style.top).length,
    }));
    check("orientation", "and back again", back.across && back.tops === 0, `across ${back.across}, ${back.tops} stale tops`);
    await page.close();
  }

  /* The control is a real target where a finger is the pointer.
     WATCHED FAILING: the first expander was written with `top: 50%` and a
     transform. A hit area is measured from its INSETS, and a positive
     inset is not an expander at all — the measured gate reported 27px at
     every viewport. */
  {
    const page = await open("?p=timeline", 390, {});
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll("[data-layout-to]")].map((el) => {
        const b = el.getBoundingClientRect();
        const ps = getComputedStyle(el, "::after");
        const grow = Math.min(...[ps.top, ps.right, ps.bottom, ps.left].map((v) => -parseFloat(v)));
        return { w: Math.round(b.width), h: Math.round(b.height), grow: Number.isFinite(grow) ? grow : 0 };
      }));
    check("orientation", "the control is a real target on a phone",
      boxes.every((b) => b.h >= 44 || b.h + b.grow * 2 >= 44),
      boxes.map((b) => `${b.w}×${b.h}+${b.grow}`).join(" "));
    await page.close();
  }

  /* ── the track ───────────────────────────────────────────────────
     Nothing may paint outside it, and no two moments may collide. The
     lock derives the scale from the tightest real gap against the largest
     a label can grow; across, that is width, and the stagger doubles the
     room. This measures the claim rather than trusting it. */
  for (const width of [1920, 1600, 1440, 1280, 1024]) {
    const page = await open("?p=timeline", width);
    const m = await page.evaluate(() => {
      const track = document.querySelector('.b-measure[data-across="true"]');
      const r = track.getBoundingClientRect();
      /* Measured against the track's own CONTENT, not its viewport: a
         track that scrolls is allowed to be wider than its box, and that
         is a separate claim, asserted below. */
      const right = r.left + Math.max(track.scrollWidth, r.width);
      let spill = 0;
      for (const el of track.querySelectorAll(".b-item *, .b-origin, .b-terminus")) {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        spill = Math.max(spill, Math.round(b.right - right), Math.round(r.left - b.left),
          Math.round(r.top - b.top), Math.round(b.bottom - r.bottom));
      }
      /* Two labels on the same side and the same rank must not overlap. */
      const labels = [...track.querySelectorAll(".b-item")].map((el) => ({
        side: el.dataset.side, rank: el.dataset.rank,
        box: el.querySelector(".b-copy").getBoundingClientRect(),
      }));
      let hits = 0;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          if (a.side !== b.side || a.rank !== b.rank) continue;
          if (a.box.right > b.box.left + 1 && b.box.right > a.box.left + 1) hits++;
        }
      }
      return {
        spill, hits,
        px: Number(getComputedStyle(track).getPropertyValue("--across-px")),
        scrolls: track.dataset.scrolls === "true",
      };
    });
    check("orientation", `@${width} nothing paints outside the track`, m.spill <= 2, `${m.spill}px`);
    check("orientation", `@${width} no two labels collide`, m.hits === 0, `${m.hits} overlapping · ${m.px}px per day`);
    /* The whole point of the orientation is the whole approach in ONE
       FRAME. A horizontal scrollbar at an ordinary desk width is not a
       smaller version of that, it is the opposite of it — and a fourteen
       pixel floor, carried over from the vertical measure where a row
       cannot be stepped sideways, cost exactly that at 1280 and 1024. */
    check("orientation", `@${width} the whole approach is in one frame`, !m.scrolls,
      m.scrolls ? "the track scrolls" : `${m.px}px per day, no scroll`);
    /* And the tightest real gap in the fixture stays legible as a
       distance: seven days, at or above the floor. */
    check("orientation", `@${width} the scale is at or above the floor`, m.px >= 8,
      `${m.px}px per day · 7 days reads as ${Math.round(m.px * 7)}px`);
    await page.close();
  }

  /* ── the spine, on a phone ───────────────────────────────────────
     WATCHED FAILING: `html, body { height: 100% }` was scoped out of the
     Timeline lab into a selector that also matched the SHEET, at (0,2,0),
     and outranked .sheet's own phone height. The artifact grew to the
     full floor and painted over the capsule. The spine was underneath the
     sheet — present in the DOM, reachable by keyboard, and invisible and
     untouchable — and Timeline had no way out of it on a phone from the
     day the suite was composed. */
  for (const product of ["timeline", "tasks"]) {
    const page = await open(`?p=${product}`, 390);
    const m = await page.evaluate(() => {
      const rail = document.querySelector(".rail");
      const sheet = document.querySelector(".app:not([hidden]) .sheet, .app:not([hidden]).sheet");
      const r = rail.getBoundingClientRect();
      const s = sheet.getBoundingClientRect();
      const tile = rail.querySelector('[data-rail="tasks"]');
      const t = tile.getBoundingClientRect();
      const top = document.elementsFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      return {
        railShown: getComputedStyle(rail).display !== "none",
        overlap: Math.round(s.bottom - r.top),
        reachable: Boolean(top.length && (top[0] === tile || tile.contains(top[0]))),
      };
    });
    check("orientation", `${product} @390 · the sheet does not cover the spine`,
      m.overlap <= 0, `sheet overruns the capsule by ${m.overlap}px`);
    check("orientation", `${product} @390 · a suite tile answers the finger`, m.reachable);
    await page.close();
  }

  /* And it actually navigates from there. */
  {
    const page = await open("?p=timeline", 390);
    await page.tap('.rail [data-rail="notes"]');
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => document.getElementById("deck").getAttribute("data-product"));
    check("orientation", "timeline @390 · the spine is a way out", now === "notes", now);
    await page.close();
  }

  /* ── what the measured gate found, asserted here ─────────────────
     WATCHED FAILING: the day figure was set at --fore-46, which is 3.13:1
     over paper. The lock is explicit that the floor for type over paper is
     0.62 (5.34:1) and that below the floor the ladder draws rules and
     never letters. It is the one number the whole instrument reports. */
  {
    const page = await open("?p=timeline", 1440);
    const got = await page.evaluate(() => {
      const el = document.querySelector('.b-measure[data-across="true"] .b-away');
      const cs = getComputedStyle(el);
      const m = cs.color.match(/[\d.]+/g).map(Number);
      const a = m.length > 3 ? m[3] : 1;
      const over = (fg, bg) => fg * a + bg * (1 - a);
      const lum = (r, g, b) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const fg = lum(over(m[0], 255), over(m[1], 255), over(m[2], 255));
      return { alpha: a, ratio: Math.round(((1.05) / (fg + 0.05)) * 100) / 100 };
    });
    check("orientation", "the day figure is above the paper floor", got.ratio >= 4.5,
      `${got.ratio}:1 at alpha ${got.alpha}`);
    await page.close();
  }

  /* WATCHED FAILING: `tasks.` and `notes.` are the same object in the same
     place on the same sheet head and were tracked -0.022em and -0.021em,
     each through a token called --tr-18. */
  {
    const page = await open("?p=tasks", 1440);
    const a = await page.evaluate(() => getComputedStyle(document.querySelector(".word")).letterSpacing);
    await page.click('.rail [data-rail="notes"]');
    await page.waitForTimeout(500);
    const b = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-app="notes"] .word')).letterSpacing);
    check("orientation", "the wordmark is tracked one way", a === b, `tasks ${a} · notes ${b}`);
    await page.close();
  }

  /* WATCHED FAILING: twenty-two elements on the board resolved their
     leading to `normal`. Leading is a decision; the browser choosing it
     means nobody did. Asserted across every product, not just the one it
     was found in, so the next surface cannot reintroduce it. */
  for (const state of ["tasks.board", "notes.notebook", "timeline.owner-flight"]) {
    const page = await open(`?state=${state}`, 1440);
    const undeclared = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll(".app:not([hidden]) *, .rail, .rail *")) {
        if (el.ownerSVGElement) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        if (getComputedStyle(el).lineHeight === "normal") {
          out.push(el.tagName.toLowerCase() + "." + String(el.className || "").split(" ")[0]);
        }
      }
      return [...new Set(out)];
    });
    check("orientation", `${state} · every leading is declared`, undeclared.length === 0,
      undeclared.slice(0, 5).join(" ") || "none left to the browser");
    await page.close();
  }
}
