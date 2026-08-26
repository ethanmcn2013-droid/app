/* ═══════════════════════════════════════════════════════════════════
   RING — round 3. Two things a keyboard user meets first, and neither
   was gated.

   · The spine's focus ring is indigo on the ink rail: 2.56:1, under the
     3:1 floor WCAG 2.2 SC 1.4.11 sets for a focus indicator. The spine
     is the FIRST tab stop in all three products, so this is the first
     focus indication a keyboard user ever gets in this application. The
     palette audit cannot see it — indigo is a legal palette colour and
     outline-color is only checked for membership, never for contrast
     against what it is drawn on.

     The product already solves this correctly twice, and only ever on
     the ink ground: notes.css sets a white ring for the dictation
     overlay and again for the phone dock. The spine is the third place
     with the same problem and was the one nobody wrote the rule for.

   · Undo across the seam dropped focus on the body. Round 1 closed the
     same defect twice on the Tasks side; the Notes seam path was never
     driven, so it kept the behaviour its siblings had lost.

   The ring assertion is measured from real pixels, not from the
   stylesheet: a ring's contrast is a fact about what was painted.
   ═══════════════════════════════════════════════════════════════════ */

const lum = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const parse = (css) => {
  const m = String(css).match(/(\d+(?:\.\d+)?)/g);
  return m ? m.slice(0, 3).map(Number) : null;
};

export async function ring({ browser, url, check, head, PNG }) {
  head("14 · the first focus a keyboard ever gets");

  for (const [product, state] of [["tasks", "tasks.board"], ["timeline", "timeline.phone"]]) {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: width < 500 ? 844 : 900 },
        hasTouch: width < 500, isMobile: width < 500,
      });
      await page.goto(url + `?v=paper&state=${state}`);
      await page.waitForTimeout(700);

      const worst = [];
      const tiles = await page.evaluate(() =>
        [...document.querySelectorAll(".rail button, .rail [tabindex]")]
          .filter((el) => el.offsetParent !== null)
          .map((el, i) => i).length);

      for (let i = 0; i < Math.min(tiles, 4); i++) {
        const info = await page.evaluate((n) => {
          const els = [...document.querySelectorAll(".rail button, .rail [tabindex]")]
            .filter((el) => el.offsetParent !== null);
          const el = els[n];
          if (!el) return null;
          el.focus();
          const cs = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return {
            colour: cs.outlineColor,
            box: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
            what: el.className || el.tagName,
          };
        }, i);
        if (!info) continue;
        const rgb = parse(info.colour);
        if (!rgb) continue;

        /* Crop the tile plus 8px of surround and read the pixels. A ring's
           contrast is a fact about what was painted, not about what the
           stylesheet declared. */
        const pad = 8;
        const clip = {
          x: Math.max(0, info.box.x - pad), y: Math.max(0, info.box.y - pad),
          width: info.box.w + pad * 2, height: info.box.h + pad * 2,
        };
        if (clip.width < 4 || clip.height < 4) continue;
        const buf = await page.screenshot({ clip });
        const png = PNG.sync.read(buf);
        const counts = new Map();
        for (let p = 0; p < png.data.length; p += 4) {
          const key = png.data[p] + "," + png.data[p + 1] + "," + png.data[p + 2];
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        const ringKey = rgb.join(",");
        /* The ground is the commonest colour that is not the ring itself. */
        let ground = null, best = 0;
        for (const [key, n] of counts) {
          if (key === ringKey) continue;
          if (n > best) { best = n; ground = key; }
        }
        if (!ground) continue;
        const r = ratio(rgb, ground.split(",").map(Number));
        if (r < 3.0) {
          worst.push(`${info.what} ring ${info.colour} on rgb(${ground}) = ${r.toFixed(2)}:1`);
        }
      }

      check("ring", `${product} @${width} · the spine's focus ring clears 3:1`,
        worst.length === 0,
        worst.length ? worst[0] : "measured from pixels, every rail stop ≥ 3:1");
      await page.close();
    }
  }

  /* ── undo across the seam keeps the person's place ──────────────
     WATCHED FAILING: activeElement === document.body after Ctrl+Z. */
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 900 },
      hasTouch: width < 500, isMobile: width < 500,
    });
    await page.goto(url + "?v=paper&state=notes.seam");
    await page.waitForTimeout(700);
    const where = await page.evaluate(async () => {
      const send = document.querySelector('[data-act="send"]');
      if (!send) return { no: true };
      send.click();
      await new Promise((r) => setTimeout(r, 700));
      /* On the element that has focus, and on the window, because a handler
         bound to either must see it. Dispatching only on `document` let this
         assertion PASS at 1440 while the undo never fired at all — a check
         that is satisfied by nothing happening is worth less than no check. */
      const ev = () => new KeyboardEvent("keydown",
        { key: "z", code: "KeyZ", ctrlKey: true, metaKey: true, bubbles: true, cancelable: true });
      (document.activeElement || document.body).dispatchEvent(ev());
      window.dispatchEvent(ev());
      document.dispatchEvent(ev());
      await new Promise((r) => setTimeout(r, 800));
      const said = [...document.querySelectorAll("[aria-live], .sr")]
        .map((n) => n.textContent || "").join(" ");
      const el = document.activeElement;
      return {
        /* The undo must actually have happened before focus means anything. */
        undone: /taken back|nothing went to tasks/i.test(said),
        said: said.replace(/\s+/g, " ").trim().slice(-60),
        body: el === document.body || !el,
        /* The seat asked for `.desk`. That is right at a desk width and
           impossible on a phone: after the revert the peel sheet and the
           reading body are both still in the tree and both display:none, so
           there is nothing in `.desk` that can hold focus. The index row
           carrying the cursor IS the note that was taken back, which is the
           same promise — you are put back on the thing you undid — so it
           counts. A text field would NOT: dropping a caret into capture
           after an undo sends the next keystroke into a new note. */
        landed: Boolean(el && el.closest &&
          (el.closest(".desk, .hand") || el.matches(".idxRow"))),
        shown: Boolean(el && el.checkVisibility &&
          el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })),
        what: el ? (el.className || el.tagName) : "none",
      };
    });
    check("ring", `notes seam undo @${width} · keeps the person's place`,
      !where.no && where.undone === true && !where.body &&
        where.landed && where.shown,
      where.no ? "no send control"
        : !where.undone ? `undo never fired — heard “${where.said}”`
          : `focus on ${where.what}`);
    await page.close();
  }

  /* ── two more round-3 defects ───────────────────────────────────
     Both are things a gate could have caught and no gate was looking at:
     a string built by concatenation, and a disclosure that opens content
     nobody can see. */

  /* Notes' index rows doubled their full stop on all fourteen rows, and
     Notes stays mounted under Tasks and Timeline, so it was 98 sightings.
     WATCHED FAILING: "…come back twice.. Spoken. 3 hours ago." */
  for (const state of ["notes.notebook", "tasks.board", "timeline.owner-flight"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + `?v=paper&state=${state}`);
    await page.waitForTimeout(650);
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll(".idxRow")]
        .map((el) => el.getAttribute("aria-label") || "")
        .filter((n) => /[.!?…]\s*\.|\.\./.test(n))
        .slice(0, 2));
    check("ring", `${state} · no index row doubles its full stop`,
      bad.length === 0, bad.length ? bad[0].slice(0, 70) : "every row joins cleanly");
    await page.close();
  }

  /* Timeline's "Behind you" opened three rows that all landed below the
     fold at the two commonest desk sizes: the sheet moved 43 of the 373px
     it had. WATCHED FAILING at 1440 and 1920. */
  for (const width of [1280, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1920 ? 1000 : 960 } });
    await page.goto(url + "?v=paper&state=timeline.owner-flight");
    await page.waitForTimeout(700);
    const seen = await page.evaluate(async () => {
      const d = document.querySelector("details.b-behindDetails");
      if (!d) return { no: true };
      const sum = d.querySelector("summary");
      sum.click();
      await new Promise((r) => setTimeout(r, 600));
      const rows = [...d.querySelectorAll(".b-behindRow")];
      if (!rows.length) return { no: true };
      const hidden = rows.filter((r) => {
        const b = r.getBoundingClientRect();
        return b.bottom > innerHeight + 1 || b.top < -1;
      });
      return { total: rows.length, hidden: hidden.length };
    });
    check("ring", `timeline behind-you @${width} · opening it shows something`,
      !seen.no && seen.hidden === 0,
      seen.no ? "no disclosure" : `${seen.hidden} of ${seen.total} rows below the fold`);
    await page.close();
  }

  /* A closed door may not wear an open door's cursor. Half of
     `closed-doors-are-still-invisible`; the ink-density half is a design
     decision and is recorded open rather than decided by a gate. */
  for (const state of ["tasks.board", "notes.notebook", "timeline.owner-flight"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + `?v=paper&state=${state}`);
    await page.waitForTimeout(650);
    const lying = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-disabled="true"]')]
        .filter((el) => el.getBoundingClientRect().width > 2)
        .filter((el) => getComputedStyle(el).cursor === "pointer")
        .map((el) => (el.className || el.tagName).toString().split(" ")[0])
        .slice(0, 3));
    check("ring", `${state} · no closed door wears an open door's cursor`,
      lying.length === 0, lying.length ? lying.join(" · ") : "every closed control reads default");
    await page.close();
  }
}
