/* ═══════════════════════════════════════════════════════════════════
   REACH — round 2. Can a person actually get to it?

   Two seats found the same blocking defect independently, which is the
   panel telling you it is real. Tasks' Planning drawer painted a 388px
   opaque panel over the board and reserved no layout, so the DONE lane —
   everything the operator has finished — was 100% covered at 1280, 1440
   and 1920, with no scrollbar, no fade and no sentence. The board's own
   scroller had nothing to give: scrollWidth === clientWidth.

   The cause is the composition, not the drawer. Tasks' lab wrote the
   accommodation as `.floor:has(.drawer) .sheet`, where `.floor` was the
   lab's own root. The scoping transform treated `.floor` as ordinary
   markup and prefixed it — `[data-app="tasks"] .floor` — which asks for
   a floor INSIDE the app. In the suite the floor is `#deck`, the app's
   PARENT. The rule has never once matched. Five rules, dead since the
   day this document was composed, and no gate could see it because a
   selector that matches nothing fails nothing.

   So the first assertion here is not about the drawer. It is about that
   class: no product rule may name a suite-level ancestor as its own
   descendant. That is a static check, it is exact, and it would have
   caught this before a seat had to.

   The rest is reachability by pointer and by key: with the drawer open
   no lane may be stranded, and focus may never land outside the box
   that holds it.
   ═══════════════════════════════════════════════════════════════════ */

import { readFile } from "node:fs/promises";
import path from "node:path";

/* The elements the suite owns. A product's stylesheet may be a
   descendant of these; it may never contain one. */
const SUITE_ANCHORS = ["\\.floor", "#deck", "#spine", "\\.rail\\b", "\\.seam\\b"];

export async function reach({ browser, url, check, head, lab }) {
  head("13 · what the composition stranded");

  /* ── the dead-selector class ────────────────────────────────────
     WATCHED FAILING: five rules in tasks.css, all of the form
     `[data-app="tasks"] .floor:has(.drawer)`. */
  const dead = [];
  for (const sheet of ["tasks.css", "notes.css", "timeline.css", "across.css"]) {
    let css;
    try { css = await readFile(path.join(lab, "src", sheet), "utf8"); }
    catch { continue; }
    /* Comments are prose and this file's own note quotes the dead selector
       verbatim. Scan the rules, not the argument about them. */
    css = css.replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const anchor of SUITE_ANCHORS) {
      /* An app compound, then whitespace or a combinator, then a suite
         anchor: the anchor is being asked for as a descendant. */
      const re = new RegExp('\\[data-app="[a-z]+"\\][^,{]*?[\\s>+~]' + anchor, "g");
      for (const m of css.matchAll(re)) {
        dead.push(sheet + " · " + m[0].trim());
      }
    }
  }
  check("reach", "no product rule asks for a suite ancestor inside itself",
    dead.length === 0,
    dead.length ? dead.slice(0, 4).join(" | ") + (dead.length > 4 ? ` (+${dead.length - 4})` : "")
      : `${SUITE_ANCHORS.length} anchors clear across four sheets`);

  const open = async (query, width) => {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 900 },
      hasTouch: width < 500,
      isMobile: width < 500,
    });
    await page.goto(url + query);
    await page.waitForTimeout(650);
    /* The board's claims are the board's. Below 1100 the list is the
       default view since 2026-09-02, so a drive that means the board says
       so — the list has its own assertions in interaction-check.mjs. */
    if (/tasks/.test(query)) {
      await page.evaluate(() => {
        const tab = document.querySelector('[data-app="tasks"] .segItem[data-view="board"]');
        if (tab && !tab.hasAttribute("data-active")) tab.click();
      });
      await page.waitForTimeout(450);
    }
    return page;
  };

  /* ── the drawer must reserve, not cover ─────────────────────────
     WATCHED FAILING: done 258 of 258px covered at 1440, maxScroll 0. */
  for (const width of [1280, 1440, 1920]) {
    const page = await open("?v=paper&state=tasks.board", width);
    await page.click('.headActions [data-act="planning"], [data-act="planning"]');
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const drawer = document.querySelector(".drawer");
      const board = document.querySelector(".board");
      if (!drawer || !board) return { no: true };
      const d = drawer.getBoundingClientRect();
      const max = board.scrollWidth - board.clientWidth;
      const stranded = [];
      for (const tray of board.querySelectorAll("[data-lane]")) {
        const t = tray.getBoundingClientRect();
        /* How far left could the board's own scroller carry it? */
        const clear = t.right - (max - board.scrollLeft) <= d.left + 0.5;
        const overlap = Math.max(0, Math.min(t.right, d.right) - Math.max(t.left, d.left));
        if (!clear && overlap > 1) {
          stranded.push(tray.getAttribute("data-lane") +
            ` ${Math.round(overlap)}/${Math.round(t.width)}px covered`);
        }
      }
      return { stranded, max: Math.round(max) };
    });

    check("reach", `tasks planning @${width} · no lane is stranded under the drawer`,
      !m.no && m.stranded.length === 0,
      m.no ? "no drawer on the surface"
        : m.stranded.length ? m.stranded.join(" · ") + ` (board has ${m.max}px of travel)`
          : `every lane reachable, ${m.max}px of travel`);
    await page.close();
  }

  /* ── focus may not land off the board ───────────────────────────
     WATCHED FAILING: ArrowRight into Done left the card at x=1161
     against a board right edge of 1262, scrollLeft 0, at every width
     from 390 to 1280. The tick's flight has the same hole. */
  for (const width of [390, 768, 1000, 1280, 1440]) {
    const page = await open("?v=paper&state=tasks.board", width);

    const walk = await page.evaluate(async () => {
      /* Tasks re-renders its markup, so every reference is re-queried.
         A node held across a repaint is detached and measures 0x0 — which
         is how this assertion lied to its author the first time it ran. */
      const first = document.querySelector('.board [data-lane="todo"] .card');
      if (!first) return { no: true };
      first.focus();
      const out = [];
      for (let i = 0; i < 12; i++) {
        const before = document.activeElement;
        const mark = (before.textContent || "").trim();
        before.dispatchEvent(new KeyboardEvent("keydown",
          { key: "ArrowRight", bubbles: true, cancelable: true }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const el = document.activeElement;
        if (!el || el === document.body) break;
        if ((el.textContent || "").trim() === mark) break;
        const b = document.querySelector(".board").getBoundingClientRect();
        const c = el.getBoundingClientRect();
        if (c.left < b.left - 0.5 || c.right > b.right + 0.5) {
          out.push((el.textContent || "").trim().slice(0, 20) +
            ` at ${Math.round(c.left)}..${Math.round(c.right)} against ${Math.round(b.left)}..${Math.round(b.right)}`);
        }
      }
      return { out };
    });
    check("reach", `tasks rover @${width} · the walk never leaves the board`,
      !walk.no && walk.out.length === 0,
      walk.no ? "no cards" : walk.out.length ? walk.out[0] : "every step inside the box");

    /* And the tick's flight lands somewhere a person can see. */
    const tick = await page.evaluate(async () => {
      const t = document.querySelector('.board [data-lane="todo"] .card .tick');
      if (!t) return { no: true };
      t.focus();
      t.click();
      await new Promise((r) => setTimeout(r, 1200));
      const el = document.activeElement;
      if (!el || el === document.body) return { lost: true };
      const b = document.querySelector(".board").getBoundingClientRect();
      const c = el.getBoundingClientRect();
      return {
        ok: c.left >= b.left - 0.5 && c.right <= b.right + 0.5,
        where: `${Math.round(c.left)}..${Math.round(c.right)} against ${Math.round(b.left)}..${Math.round(b.right)}`,
      };
    });
    check("reach", `tasks tick @${width} · the completed card lands on screen`,
      !tick.no && !tick.lost && tick.ok === true,
      tick.no ? "no tick" : tick.lost ? "focus fell to the body" : tick.where);

    await page.close();
  }

  /* ── round 3 · a rect that can be zero ──────────────────────────
     The suite sets `display: contents` on every `.app`, so the app element
     has NO BOX: getBoundingClientRect() on it is all zeros. Tasks anchored
     its card menu to that rect —

         const frame = window.__SUITE.host("tasks").getBoundingClientRect();
         const top = Math.min(box.bottom - frame.top + 6, frame.height - 250);

     — so `top` resolved to `0 - 250` at every card, in every lane, at every
     width, with every pointer. The only route to moving a card that a mouse,
     a finger and a keyboard can all take rendered 250px above the top of the
     screen, under a transparent full-viewport veil that then ate the next
     click. It survived to the final round because no gate ever opened it.

     Two assertions, and the static one is the more valuable: this is the
     same shape as the dead drawer selector — a composition property that
     silently zeroes something a product wrote against its own root. */
  const zeroed = [];
  for (const file of ["tasks.js", "notes.js", "timeline.js", "app.js"]) {
    let js;
    try { js = await readFile(path.join(lab, "src", file), "utf8"); }
    catch { continue; }
    js = js.replace(/\/\*[\s\S]*?\*\//g, " ");
    /* The host measured for geometry, directly or through a variable that
       is assigned nothing else. */
    const direct = /__SUITE\.host\([^)]*\)\s*\.\s*getBoundingClientRect/g;
    for (const m of js.matchAll(direct)) zeroed.push(file + " · " + m[0]);
    const named = /(?:const|let|var)\s+(\w+)\s*=\s*window\.__SUITE\.host\(/g;
    for (const m of js.matchAll(named)) {
      const re = new RegExp("\\b" + m[1] + "\\s*\\.\\s*getBoundingClientRect");
      if (re.test(js)) zeroed.push(file + " · " + m[1] + ".getBoundingClientRect()");
    }
  }
  check("reach", "no geometry is measured from an app element that has no box",
    zeroed.length === 0,
    zeroed.length ? zeroed.slice(0, 3).join(" | ")
      : "display:contents rects are never used as an origin");

  /* And the menu itself, on screen, at every width. */
  for (const width of [390, 768, 1280, 1440, 1920]) {
    const page = await open("?v=paper&state=tasks.board", width);
    const seen = await page.evaluate(async () => {
      const out = [];
      /* Lane names, not lane nodes. Tasks re-renders on every mount, so a
         node captured before the first menu opens is detached by the second
         iteration and its click does nothing — which reads as "no menu". */
      const names = [...document.querySelectorAll(".board [data-lane]")]
        .map((el) => el.dataset.lane).slice(0, 3);
      for (const name of names) {
        const lane = document.querySelector('.board [data-lane="' + name + '"]');
        const dots = lane && lane.querySelector(".card .cardDots, .card [data-act='menu']");
        if (!dots) { out.push(name + " no dots"); continue; }
        dots.click();
        await new Promise((r) => setTimeout(r, 260));
        const menu = document.querySelector(".cardMenu");
        if (!menu) { out.push(name + " no menu"); continue; }
        const r = menu.getBoundingClientRect();
        const inside = r.top >= 0 && r.bottom <= innerHeight &&
          r.left >= 0 && r.right <= innerWidth;
        const hit = document.elementFromPoint(
          Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1),
          Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
        const answers = Boolean(hit && (hit === menu || menu.contains(hit)));
        if (!inside || !answers) {
          out.push(name +
            ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}]` +
            (inside ? " covered" : " off screen"));
        }
        /* A coarse pointer needs 44px, and this menu is the only route to
           moving a card that a finger has: drag wants a pointer that hovers,
           Space-carry wants a keyboard. The seat that found the menu also
           predicted this, because until the fix the markup had never been
           painted for any gate to measure. */
        if (matchMedia("(pointer: coarse)").matches) {
          const small = [...menu.querySelectorAll("button")]
            .filter((el) => el.getBoundingClientRect().height < 44);
          if (small.length) {
            out.push(name + " " + small.length + " items under 44px (" +
              Math.round(small[0].getBoundingClientRect().height) + ")");
          }
        }
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await new Promise((r) => setTimeout(r, 160));
      }
      return out;
    });
    check("reach", `tasks card menu @${width} · opens on screen and answers`,
      seen.length === 0,
      seen.length ? seen.join(" · ") : "inside the viewport in every lane driven");
    await page.close();
  }
}
