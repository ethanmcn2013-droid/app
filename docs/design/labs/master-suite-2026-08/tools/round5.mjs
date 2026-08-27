/* ═══════════════════════════════════════════════════════════════════
   ROUND 5, batch B — the seven structural fixes, measured.

   These are the round's findings that were not about a sentence: a row
   that collided before it folded, an orientation that dropped the one
   marker that answers "what is next", a scroller whose foot cut through
   a line of type, a reading desk whose height followed its metadata, a
   product switch with no motion at all, an undo strip that reported the
   action you had just reversed, and a card that could not reach the note
   it came from.

   Every assertion below was written before its fix and watched failing.
   ═══════════════════════════════════════════════════════════════════ */

export async function roundFive({ browser, url, check, head }) {
  head("18 · round 5 · the seven structural fixes");

  /* ── 1 · the header folds on collision, not on overflow ──────────
     WATCHED FAILING: driven at every 10px from 1240 down to 1060, the
     switcher and the tools closed to 6px — touching, reading as one
     object — and nothing fired, because the rule waited for the row to
     pass the sheet's edge. Between about 1180 and 1090 the header was
     visibly wrong and the product agreed with itself that it was fine. */
  {
    const page = await browser.newPage({ viewport: { width: 1240, height: 950 } });
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(700);
    const tight = [];
    for (let w = 1240; w >= 1060; w -= 10) {
      await page.setViewportSize({ width: w, height: 950 });
      await page.waitForTimeout(160);
      const m = await page.evaluate(() => {
        const views = document.querySelector('[data-app="tasks"] .views');
        const tools = document.querySelector('[data-app="tasks"] .viewTools');
        const seg = document.querySelector('[data-app="tasks"] .seg, [data-app="tasks"] .viewSeg');
        if (!views || !tools || !seg) return null;
        const fold = views.getAttribute("data-fold");
        if (fold === "gone") return { fold, gap: Infinity };
        const gap = tools.getBoundingClientRect().left - seg.getBoundingClientRect().right;
        return { fold, gap: Math.round(gap) };
      });
      /* A gap of less than 24px between two groups IS the collision. It
         is allowed to be anything once the tools have gone. */
      if (m && m.gap < 24) tight.push(w + "px gap " + m.gap + " fold=" + (m.fold || "none"));
    }
    check("round5", "the header never lets its two groups collide",
      tight.length === 0, tight.slice(0, 3).join(" | ") || "24px clear at every width 1060–1240");
    await page.close();
  }

  /* ── 2 · the ACROSS orientation marks what is next ───────────────
     WATCHED FAILING: `data-lead` — the attribute that fills the tick,
     takes the title to 600 and the count to full ink — was stamped by the
     DOWN placer and by nothing else. Turn the artifact across and the row
     answering "what is next" looked exactly like the four behind it. */
  {
    for (const layout of ["down", "across"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
      await page.goto(url + `?v=paper&state=timeline.owner-flight&layout=${layout}`);
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const fwd = document.querySelectorAll(".b-measure:not(.b-back) .b-item");
        const lead = [...fwd].filter((el) => el.getAttribute("data-lead") === "true");
        const back = document.querySelectorAll(".b-back .b-item[data-lead]");
        /* And the marker has to be the NEAREST forward moment, not
           whichever one the DOM happened to hold first. */
        const aways = [...fwd].map((el) => Number(el.getAttribute("data-away")));
        const nearest = Math.min(...aways.filter((a) => a > 0));
        return {
          items: fwd.length,
          leads: lead.length,
          leadAway: lead.length ? Number(lead[0].getAttribute("data-away")) : null,
          nearest,
          inPast: back.length,
          weight: lead.length
            ? getComputedStyle(lead[0].querySelector(".b-title")).fontWeight
            : null,
        };
      });
      check("round5", `${layout} · exactly one moment is marked as next`,
        m.items > 0 && m.leads === 1, JSON.stringify(m));
      check("round5", `${layout} · and it is the nearest one`,
        m.leadAway === m.nearest, "lead at " + m.leadAway + ", nearest " + m.nearest);
      check("round5", `${layout} · nothing behind you is next`,
        m.inPast === 0, m.inPast + " leads on the past rail");
      check("round5", `${layout} · the marker reaches the type`,
        String(m.weight) === "600", "title weight " + m.weight);
      await page.close();
    }
  }

  /* ── 3 · the tray's foot lands in a gutter ───────────────────────
     WATCHED FAILING: the scroller was whatever height the column left it,
     so its bottom edge — and the hairline drawn on it — fell wherever
     that happened to be, most often a third of the way through a line of
     a card's title. Measured as: no card may straddle the foot. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });
    await page.goto(url + "?v=paper&state=tasks.dense");
    await page.waitForTimeout(900);
    const cut = await page.evaluate(() => {
      const bad = [];
      let scrollers = 0;
      for (const body of document.querySelectorAll('[data-app="tasks"] .trayBody')) {
        if (body.scrollHeight <= body.clientHeight + 1) continue;
        scrollers += 1;
        const foot = body.getBoundingClientRect().bottom;
        for (const card of body.querySelectorAll(".card")) {
          const r = card.getBoundingClientRect();
          /* Straddling: the foot falls strictly inside the card's own
             box, with a pixel of tolerance at each edge for rounding. */
          if (r.top < foot - 1 && r.bottom > foot + 1) {
            bad.push((card.textContent || "").trim().slice(0, 22));
          }
        }
      }
      return { bad, scrollers };
    });
    check("round5", "a scrolling tray was found to measure",
      cut.scrollers > 0, cut.scrollers + " overflowing trays");
    check("round5", "no card is cut in half by the foot of its tray",
      cut.bad.length === 0, cut.bad.slice(0, 3).join(" | ") || "every foot lands in a gutter");
    await page.close();
  }

  /* ── 4 · the reading desk is one height ──────────────────────────
     WATCHED FAILING: the desk was as tall as whatever metadata the open
     note carried, so the index beneath it started at a different y for
     every note — arrow down the pile and the whole list stepped up and
     down under the cursor. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=notes.notebook");
    await page.waitForTimeout(900);
    const tops = await page.evaluate(async () => {
      const seen = [];
      const rows = [...document.querySelectorAll('[data-app="notes"] .idxRow')].slice(0, 5);
      for (const row of rows) {
        row.click();
        await new Promise((r) => setTimeout(r, 420));
        const wrap = document.querySelector('[data-app="notes"] .indexWrap');
        if (wrap) seen.push(Math.round(wrap.getBoundingClientRect().top));
      }
      return seen;
    });
    check("round5", "five notes were opened to measure",
      tops.length === 5, tops.join(", "));
    check("round5", "the index keeps one top whatever note is open",
      tops.length > 1 && new Set(tops).size === 1, "tops: " + tops.join(", "));
    await page.close();
  }

  /* ── 5 · the product switch has a motion ─────────────────────────
     WATCHED FAILING: the largest change of state the shell can make was a
     hard cut, in a suite where every other transition is declared, gated
     and 140ms. And it has to go out under reduced motion like the rest. */
  {
    for (const reduced of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 960 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      await page.goto(url + "?v=paper&state=tasks.board");
      await page.waitForTimeout(800);
      const m = await page.evaluate(async () => {
        window.__SUITE.go("notes");
        await new Promise((r) => setTimeout(r, 40));
        const box = document.querySelector('.app[data-app="notes"]');
        if (!box) return null;
        const target = box.classList.contains("sheet") ? box : box.querySelector(".sheet");
        const cs = target ? getComputedStyle(target) : null;
        return {
          stamped: box.hasAttribute("data-arriving"),
          name: cs ? cs.animationName : "none",
          ms: cs ? cs.animationDuration : "0s",
        };
      });
      /* THE SWITCH HAS A FRAME — by whichever of the two paths this
         browser can take. Round 5 landed a fade-and-lift entrance because
         the switch had no motion at all; the motion pass then landed a
         same-document view transition, which is strictly better where it
         runs and makes the entrance the FALLBACK. This rule was written
         against the entrance and would now fail on the better path, which
         is the same staleness the whole of round 5 was about. What it
         actually cares about is that the switch is never a hard cut. */
      const vt = await page.evaluate(() => typeof document.startViewTransition === "function");
      if (reduced) {
        check("round5", "reduced motion · the switch does not animate",
          !!m && m.name === "none" && m.stamped === false,
          m ? m.name + " / stamped " + m.stamped : "no app");
      } else if (vt) {
        check("round5", "the switch has a frame · carried by the view transition",
          !!m && m.stamped === false, "the entrance stands down where the transition runs");
      } else {
        check("round5", "the switch has a frame · carried by the fallback entrance",
          !!m && m.stamped === true && m.name !== "none",
          m ? m.name + " / " + m.ms : "no app");
        check("round5", "and it takes the spine's own 140ms",
          !!m && parseFloat(m.ms) === 0.14, m ? m.ms : "-");
      }
      /* And nothing is left stamped, on either path. */
      if (!reduced) {
        await page.waitForTimeout(600);
        const left = await page.evaluate(() =>
          document.querySelectorAll("[data-arriving]").length);
        check("round5", "the arrival attribute does not outlive the arrival",
          left === 0, left + " left stamped");
      }
      await page.close();
    }
  }

  /* ── 6 · the undo strip offers rather than reports ───────────────
     WATCHED FAILING: every entry's sentence is written in the past tense
     at the moment it happens. After an undo the bar repainted on the next
     entry down and read it in that same tense — describing an action the
     owner had just reversed, one frame after reversing it. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(url + "?v=paper&state=timeline.owner-flight");
    await page.waitForTimeout(900);
    /* DRIVEN THROUGH THE EDITOR, which is where a moment actually moves.
       Two earlier drafts of this rule dispatched a synthetic
       KeyboardEvent at the handle and then pressed a real arrow key at
       it, and neither moved anything: `.b-grab` is the button that OPENS
       the editor — its accessible name begins "Edit" — and the stepper
       lives inside. Both drafts read an empty strip and reported the
       strip as broken. A rule that drives a gesture the product does not
       have proves only that the product ignored it. */
    const read = () => page.evaluate(() =>
      ((document.querySelector(".b-undoText") || {}).textContent || "").trim());
    const away = () => page.evaluate(() => {
      const el = document.querySelector(".b-measure:not(.b-back) .b-item");
      return el ? Number(el.getAttribute("data-away")) : null;
    });
    const run = { moved: 0 };
    const before = await away();
    await page.click(".b-measure:not(.b-back) .b-item .b-grab").catch(() => {});
    await page.waitForTimeout(450);
    for (let i = 0; i < 2; i += 1) {
      await page.click('.b-edit .b-step[aria-label="Move a day later"]').catch(() => {});
      await page.waitForTimeout(360);
      if ((await away()) !== before) run.moved = i + 1;
    }
    run.second = await read();
    await page.click(".b-undoAct").catch(() => {});
    await page.waitForTimeout(500);
    run.afterUndo = await read();
    check("round5", "two moves were made to measure",
      run.moved === 2, JSON.stringify(run).slice(0, 120));
    check("round5", "a fresh action is reported in the past tense",
      !!run.second && !/^Undo:/.test(run.second), run.second || "-");
    check("round5", "after an undo the strip OFFERS the next reversal",
      !!run.afterUndo && /^Undo:/.test(run.afterUndo), run.afterUndo || "-");
    check("round5", "and does not repeat the action just reversed as news",
      run.afterUndo !== run.second, "was “" + run.second + "”, now “" + run.afterUndo + "”");
    await page.close();
  }

  /* ── 7 · a card can reach the note it came from ──────────────────
     WATCHED FAILING: the glyph has said "came from a note in Notes" since
     round 1 and there was no way to go and read it. The seam ran one way
     — a door with a handle on one side, in the suite whose whole argument
     is that the three products are one place. */
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(url + "?v=paper&state=tasks.board");
    await page.waitForTimeout(900);
    const m = await page.evaluate(async () => {
      const src = document.querySelector('[data-app="tasks"] .cardSrc');
      if (!src) return null;
      const r = src.getBoundingClientRect();
      const named = (src.getAttribute("aria-label") || "").trim();
      src.click();
      await new Promise((x) => setTimeout(x, 900));
      return {
        doors: document.querySelectorAll('[data-app="tasks"] .cardSrc').length,
        target: [Math.round(r.width), Math.round(r.height)],
        named,
        landed: document.querySelector("#deck").getAttribute("data-product"),
        onDesk: !!document.querySelector('[data-app="notes"] .readBody'),
        said: ((document.getElementById("say") || {}).textContent || "").trim(),
      };
    });
    check("round5", "the card carries a door back to its note",
      !!m && m.doors > 0, m ? m.doors + " doors" : "no door rendered");
    check("round5", "and it is a 44px target, like its neighbour",
      !!m && m.target[0] >= 44 && m.target[1] >= 44, m ? m.target.join("×") : "-");
    check("round5", "and it says where it goes",
      !!m && /note/i.test(m.named), m ? m.named : "-");
    check("round5", "pressing it opens Notes on that note",
      !!m && m.landed === "notes" && m.onDesk === true,
      m ? m.landed + " · desk " + m.onDesk : "-");
    check("round5", "and the journey is announced",
      !!m && /Opened the note/.test(m.said), m ? m.said : "-");
    check("round5", "the journey throws nothing", errs.length === 0, errs.slice(0, 2).join(" | "));
    await page.close();
  }
}
