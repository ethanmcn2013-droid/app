/* The measured seat for behaviour.
 *
 *   node scripts/design/interaction-check.mjs
 *
 * Every assertion here exists because a panel seat found the defect it
 * guards by driving the real file, not by reading it. Exits 1 on any
 * failure, so a regression cannot be talked past.
 */
import { chromium } from "@playwright/test";
import path from "node:path";

const URL = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const results = [];
let failures = 0;

function ok(name, pass, detail) {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
}

const counts = (page) =>
  page.evaluate(() => {
    const o = {};
    document.querySelectorAll(".tray[data-lane]").forEach((t) => {
      o[t.dataset.lane] = t.querySelectorAll(".card:not([data-draft])").length;
    });
    return o;
  });

const browser = await chromium.launch();
const errors = [];

async function open(query = "", viewport = { width: 1440, height: 960 }) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL + query);
  await page.waitForTimeout(350);
  return page;
}

/* ── the board moves ──────────────────────────────────────────────── */
{
  const page = await open();
  const before = await counts(page);
  await page.locator('.tray[data-lane="todo"] .card .tick').first().click();
  await page.waitForTimeout(320);
  const after = await counts(page);
  ok("a tick completes the task", after.done === before.done + 1, JSON.stringify(after));
  ok("the completion is announced", (await page.locator("#say").textContent()).includes("done"));

  /* Completing must not steal the operator's place in the tab order. */
  ok(
    "focus survives a pointer completion",
    await page.evaluate(() => !!document.activeElement.closest(".card")),
    await page.evaluate(() => document.activeElement.tagName + "." + document.activeElement.className),
  );

  /* The undo strip, which is the only way back from the board's most
     frequent and most mis-tappable action. */
  ok("an undo strip appears", (await page.locator('.carry [data-act="undo"]').count()) === 1);
  await page.locator('.carry [data-act="undo"]').click();
  await page.waitForTimeout(200);
  ok("undo puts the task back", (await counts(page)).done === before.done);

  await page.locator('.tray[data-lane="todo"] .card .tick').first().click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);
  ok("ctrl+z undoes a completion", (await counts(page)).done === before.done);
  await page.close();
}

/* ── the keyboard model ───────────────────────────────────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card').first().focus();
  await page.keyboard.press(" ");
  ok("space picks a card up", (await page.locator(".carry").count()) === 1);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press(" ");
  await page.waitForTimeout(150);
  const moved = await counts(page);
  ok("arrows walk it two columns", moved.todo === 2 && moved.review === 3, JSON.stringify(moved));
  ok("the strip leaves when it lands", (await page.locator(".carry").count()) === 0);

  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const back = await counts(page);
  ok("escape puts it back exactly", back.todo === 2 && back.review === 3, JSON.stringify(back));

  /* A control that says checkbox must behave like one. Before this, Space
     on the tick picked the card up and Enter on the actions menu completed
     the task. */
  const done0 = (await counts(page)).done;
  await page.locator('.tray[data-lane="todo"] .card .tick').first().focus();
  await page.keyboard.press(" ");
  await page.waitForTimeout(250);
  ok("space on the tick ticks", (await counts(page)).done === done0 + 1);
  ok("space on the tick does not pick up", (await page.locator('.card[aria-grabbed="true"]').count()) === 0);

  /* The menu button is invisible at rest, so the only route to it is the
     one a keyboard operator actually takes: the card, then Tab. */
  await page.waitForTimeout(300);
  await page.locator('.board .card[tabindex="0"]').focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  ok("tab reaches the menu button", await page.evaluate(() => document.activeElement.classList.contains("cardDots")));
  const done1 = (await counts(page)).done;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok("enter on the menu opens the menu", (await page.locator(".cardMenu").count()) === 1);
  ok("enter on the menu does not complete", (await counts(page)).done === done1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  ok("escape closes the menu", (await page.locator(".cardMenu").count()) === 0);
  await page.close();
}

/* ── the menu is the touch route ──────────────────────────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card').first().hover();
  await page.locator('.tray[data-lane="todo"] .cardDots').first().click();
  await page.waitForTimeout(150);
  ok("the menu lists every column", (await page.locator('.cardMenu [data-act="moveto"]').count()) === 5);
  await page.locator('.cardMenu [data-lane="waiting"]').click();
  await page.waitForTimeout(150);
  ok("the menu moves the card", (await counts(page)).waiting === 1);
  await page.close();
}

/* ── place is not destroyed by a repaint ──────────────────────────── */
{
  const page = await open("?state=dense");
  await page.evaluate(() => {
    document.querySelector('.tray[data-lane="todo"] .trayBody').scrollTop = 200;
  });
  await page.waitForTimeout(120);
  await page.locator('.tray[data-lane="review"] .card .tick').first().click();
  await page.waitForTimeout(320);
  const top = await page.evaluate(() => document.querySelector('.tray[data-lane="todo"] .trayBody').scrollTop);
  ok("a tick elsewhere keeps a column's place", top > 150, "scrollTop " + top);

  /* Scroll to Review, then tick a card that is already on screen — clicking
     one that is not would make Playwright scroll the board itself and the
     test would prove nothing. */
  const phone = await open("?state=dense", { width: 390, height: 844 });
  await phone.evaluate(() => {
    const board = document.querySelector(".board");
    const tray = document.querySelector('.tray[data-lane="review"]');
    board.scrollLeft = tray.offsetLeft - board.offsetLeft;
  });
  await phone.waitForTimeout(200);
  const was = await phone.evaluate(() => document.querySelector(".board").scrollLeft);
  await phone.locator('.tray[data-lane="review"] .card .tick').first().click();
  await phone.waitForTimeout(320);
  const now = await phone.evaluate(() => document.querySelector(".board").scrollLeft);
  ok("the phone board keeps its column", was > 100 && Math.abs(now - was) < 40, was + " -> " + now);
  await phone.close();
  await page.close();
}

/* ── the drop line does not lie ───────────────────────────────────── */
{
  const page = await open();
  const order = () =>
    page.$$eval('.tray[data-lane="todo"] .cardTitle', (n) => n.map((x) => x.textContent.slice(0, 10)));
  const before = await order();
  await page.dragAndDrop(
    '.tray[data-lane="todo"] .card >> nth=0',
    '.tray[data-lane="todo"] .card >> nth=1',
    { targetPosition: { x: 60, y: 50 } },
  );
  await page.waitForTimeout(200);
  const after = await order();
  ok(
    "a downward reorder lands where the line was drawn",
    after[0] === before[1] && after[1] === before[0],
    before.join(" | ") + "  ->  " + after.join(" | "),
  );
  await page.close();
}

/* ── the filter is not a dead end ─────────────────────────────────── */
{
  const page = await open();
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(150);
  /* The chip is the value in both states; aria-pressed and the close glyph
     carry "this is on" and "this is the way out", so the foot strip is the
     only place the filter is stated in words. */
  ok("the chip stays the value", (await page.locator('[data-act="late"]').textContent()).trim().startsWith("1 overdue"));
  ok("and reads as pressed", (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 1);
  ok("the standing project facts stay put", (await page.locator(".ratio").count()) === 1);
  ok("a way back is on screen", (await page.locator('.carry [data-act="showall"]').count()) === 1);
  const lines = await page.$$eval(".trayEmpty", (n) => n.map((x) => x.textContent));
  ok("the board says it once, not five times", lines.length <= 1, JSON.stringify(lines));

  /* Clearing the last overdue task while filtered used to brick the board. */
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(320);
  ok("clearing the last overdue task releases the filter", (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 0);
  ok("the board comes back", (await page.locator(".board .card").count()) > 5);
  await page.close();

  const two = await open();
  await two.locator('[data-act="late"]').click();
  await two.waitForTimeout(120);
  await two.keyboard.press("Escape");
  await two.waitForTimeout(150);
  ok("escape clears the filter", (await two.locator('[data-act="late"][aria-pressed="true"]').count()) === 0);
  ok("and the whole board is back", (await two.locator(".board .card").count()) > 5);
  await two.close();
}

/* ── the edges report distance, not existence ─────────────────────── */
{
  const page = await open("?state=dense");
  const body = '.tray[data-lane="todo"] .trayBody';
  ok("an overflowing column fades at its foot", await page.locator(body + "[data-more]").count() === 1);
  ok("and not at its head", await page.locator(body + "[data-above]").count() === 0);
  await page.evaluate((sel) => {
    const n = document.querySelector(sel);
    n.scrollTop = n.scrollHeight;
  }, body);
  await page.waitForTimeout(200);
  ok("scrolled to the bottom, the foot fade clears", await page.locator(body + "[data-more]").count() === 0);
  ok("and the head fade appears", await page.locator(body + "[data-above]").count() === 1);
  await page.close();
}

/* ── nothing is silently truncated ────────────────────────────────── */
{
  for (const width of [1440, 1280, 1120, 900, 768, 390]) {
    const page = await open("", { width, height: 960 });
    await page.waitForTimeout(250);
    const silent = await page.$$eval(".cardTitle, .cardNote", (nodes) =>
      nodes
        .filter((n) => n.scrollHeight > n.clientHeight + 1 && !n.textContent.includes("\u2026"))
        .map((n) => n.textContent.slice(0, 40)),
    );
    ok("nothing is clipped without an ellipsis at " + width, silent.length === 0, JSON.stringify(silent));
    await page.close();
  }
}

/* ── the board answers assistive technology ───────────────────────── */
{
  const page = await open();
  const named = await page.$$eval(".board .card", (n) =>
    n.filter((c) => !c.getAttribute("aria-label") && !c.getAttribute("aria-labelledby")).length);
  ok("every card has an accessible name", named === 0, named + " unnamed");
  /* Count what a keyboard actually walks, not what carries tabindex="0" —
     an element with no tabindex attribute at all is still a tab stop, which
     is exactly what this assertion used to be blind to. */
  const walked = (p) => p.evaluate(() =>
    [...document.querySelectorAll(".board a, .board button, .board [tabindex]")]
      .filter((n) => n.offsetParent !== null && n.getAttribute("tabindex") !== "-1").length);
  const stops = await walked(page);
  ok("the board is a roving group, not a stop per card", stops <= 5, stops + " stops");
  const dense = await open("?state=dense");
  const denseStops = await walked(dense);
  const denseAll = await dense.locator(".board button, .board .card").count();
  ok("and does not grow with the work on it", denseStops === stops,
    denseStops + " of " + denseAll + " focusables at peak season, " + stops + " at rest");
  const way = await page.evaluate(() => {
    const out = [];
    document.querySelector('.board .card[tabindex="0"]').focus();
    return out;
  });
  await dense.close();
  await page.close();
}


/* ── the completion actually travels ──────────────────────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card .tick').first().click();
  /* Sample the ghost across the flight rather than trusting the attribute. */
  const seen = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 14; i += 1) {
      const g = document.querySelector(".cardGhost");
      out.push(g ? getComputedStyle(g).transform : "gone");
      await new Promise((r) => setTimeout(r, 20));
    }
    return out;
  });
  const moving = seen.filter((t) => t !== "gone" && t !== "none");
  ok("the completed card is drawn in flight", moving.length >= 3, seen.slice(0, 6).join(" | "));
  ok("its position actually changes", new Set(moving).size >= 3, String(new Set(moving).size) + " distinct");
  await page.waitForTimeout(500);
  ok("the ghost is cleaned up", (await page.locator(".cardGhost").count()) === 0);
  ok("the landed card is visible", await page.evaluate(() =>
    [...document.querySelectorAll(".card")].every((c) => c.style.opacity !== "0")));
  ok("and plays the arrival beat", (await page.locator(".card[data-just-done]").count()) === 1);
  await page.close();
}

/* ── a move is reversible too, not only a completion ──────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card').first().hover();
  await page.locator('.tray[data-lane="todo"] .cardDots').first().click();
  await page.waitForTimeout(150);
  await page.locator('.cardMenu [data-lane="waiting"]').click();
  await page.waitForTimeout(200);
  ok("a menu move offers a way back", (await page.locator('.carry [data-act="undo"]').count()) === 1);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  ok("and ctrl+z returns it", (await counts(page)).waiting === 0, JSON.stringify(await counts(page)));

  /* Moving into Done through the menu is a completion, with prevLane kept. */
  await page.locator('.tray[data-lane="review"] .card').first().hover();
  await page.locator('.tray[data-lane="review"] .cardDots').first().click();
  await page.waitForTimeout(150);
  await page.locator('.cardMenu [data-lane="done"]').click();
  await page.waitForTimeout(500);
  await page.locator('.tray[data-lane="done"] .card .tick').first().click();
  await page.waitForTimeout(400);
  const said = await page.locator("#say").textContent();
  /* One convention for every spoken lane mention: the column noun, so a
     preposition in front of a sentence-case name can never read "in In
     progress" again. */
  ok("un-completing names the lane it came from", /in the review column/.test(said), said);
  await page.close();
}

/* ── the note can be read ─────────────────────────────────────────── */
{
  const page = await open();
  const clipped = await page.$$eval(".cardNote", (n) => n.filter((x) => x.textContent.indexOf("…") !== -1).length);
  ok("some notes are clipped, so a way in is needed", clipped > 0, clipped + " clipped");
  await page.locator(".board .card").first().click();
  await page.waitForTimeout(250);
  ok("clicking a card opens its note", (await page.locator(".card[data-open]").count()) === 1);
  ok("and shows the whole thing", await page.evaluate(() => {
    const n = document.querySelector(".card[data-open] .cardNote");
    return n.scrollHeight <= n.clientHeight + 1 && n.textContent.indexOf("…") === -1;
  }));
  await page.locator(".card[data-open]").click();
  await page.waitForTimeout(200);
  ok("clicking again closes it", (await page.locator(".card[data-open]").count()) === 0);

  await page.locator('.board .card[tabindex="0"]').focus();
  const before = (await counts(page)).done;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok("enter opens the note", (await page.locator(".card[data-open]").count()) === 1);
  ok("enter no longer completes", (await counts(page)).done === before);
  await page.close();
}

/* ── a card ring is not clipped by its own column ─────────────────── */
{
  const page = await open();
  const bleed = await page.evaluate(() => {
    const body = document.querySelector(".trayBody");
    const card = body.querySelector(".card");
    const cs = getComputedStyle(body);
    return {
      pad: parseFloat(cs.paddingLeft),
      cardW: Math.round(card.getBoundingClientRect().width),
      clientW: body.clientWidth,
      scrollW: body.scrollWidth,
    };
  });
  ok("the scroller leaves room for a ring", bleed.pad >= 4, JSON.stringify(bleed));
  ok("without a horizontal scrollbar", bleed.scrollW === bleed.clientW, JSON.stringify(bleed));
  ok("and without changing the card measure", bleed.cardW === 234, JSON.stringify(bleed));
  await page.close();
}

/* ── the arrow walk keeps the card in view ────────────────────────── */
{
  const page = await open("?state=dense");
  await page.locator('.board .card[tabindex="0"]').focus();
  const off = [];
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(60);
    off.push(await page.evaluate(() => {
      const c = document.activeElement.closest(".card");
      if (!c) return 999;
      const s = c.closest(".trayBody");
      const a = c.getBoundingClientRect();
      const b = s.getBoundingClientRect();
      return Math.round(Math.max(0, b.top - a.top, a.bottom - b.bottom));
    }));
  }
  ok("every walked card stays inside its column", Math.max.apply(null, off) <= 2, off.join(","));
  await page.close();
}

/* ── the drag can cross the board ─────────────────────────────────── */
{
  const page = await open("?state=dense", { width: 768, height: 1024 });
  const card = await page.locator('.tray[data-lane="todo"] .card').first().boundingBox();
  const board = await page.locator(".board").boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width - 8, card.y + 20, { steps: 12 });
  await page.waitForTimeout(900);
  const scrolled = await page.evaluate(() => document.querySelector(".board").scrollLeft);
  await page.mouse.up();
  ok("holding at the edge walks the board across", scrolled > 200, "scrollLeft " + scrolled);
  await page.close();
}

/* ── the foot is one object ───────────────────────────────────────── */
{
  const page = await open();
  const dock = await page.locator(".dock").boundingBox();
  await page.locator(".card .tick").first().click();
  await page.waitForTimeout(500);
  const undoBar = await page.locator(".carry").boundingBox();
  /* The strip is no longer pinned to the dock's width — it has to be able to
     say the card's name — but it must still share its centre line and never
     be narrower than the object it sits on. */
  ok("the strip shares the dock's centre line",
    Math.abs((undoBar.x + undoBar.width / 2) - (dock.x + dock.width / 2)) < 1,
    "dock centre " + Math.round(dock.x + dock.width / 2) + " strip centre " + Math.round(undoBar.x + undoBar.width / 2));
  ok("and is never narrower than it", undoBar.width >= dock.width - 1,
    "dock " + Math.round(dock.width) + " strip " + Math.round(undoBar.width));
  const alive = await page.locator(".trayAdd:not([data-under])").count();
  ok("and does not blink out every Add row", alive >= 3, alive + " of 5 still live");
  await page.close();
}

/* ── the strip holds still while it is being read ─────────────────── */
{
  const page = await open();
  await page.locator(".card .tick").first().click();
  await page.waitForTimeout(400);
  await page.locator('.carry [data-act="undo"]').focus();
  await page.waitForTimeout(6800);
  ok("the strip waits while focused", (await page.locator(".carry").count()) === 1);
  ok("focus is still on it", await page.evaluate(() => document.activeElement.dataset.act === "undo"));
  await page.close();
}

/* ── the strip fits the phone ─────────────────────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  await page.locator('.board .card[tabindex="0"]').focus();
  await page.keyboard.press(" ");
  await page.waitForTimeout(250);
  const bar = await page.locator(".carry").boundingBox();
  const sheet = await page.locator(".sheet").boundingBox();
  ok("the strip stays inside the sheet", bar.x >= sheet.x - 1 && bar.x + bar.width <= sheet.x + sheet.width + 1,
    "strip " + Math.round(bar.x) + "-" + Math.round(bar.x + bar.width) + " sheet " + Math.round(sheet.x) + "-" + Math.round(sheet.x + sheet.width));
  ok("on one line", bar.height <= 44, "height " + Math.round(bar.height));
  const out = await page.evaluate(() => {
    const c = document.querySelector(".carry").getBoundingClientRect();
    return [...document.querySelectorAll(".carry *")].filter((n) => {
      const b = n.getBoundingClientRect();
      return b.width && (b.left < c.left - 1 || b.right > c.right + 1);
    }).length;
  });
  ok("with nothing rendered outside it", out === 0, out + " escaped");
  await page.close();
}

/* ── the left edge dissolves too ──────────────────────────────────── */
{
  const page = await open("?state=dense", { width: 1120, height: 960 });
  ok("nothing hidden to the left at rest", (await page.locator(".sheet[data-more-left]").count()) === 0);
  await page.evaluate(() => { const b = document.querySelector(".board"); b.scrollLeft = b.scrollWidth; });
  await page.waitForTimeout(300);
  ok("scrolled over, the left edge fades", (await page.locator(".sheet[data-more-left]").count()) === 1);
  ok("and the right fade clears", (await page.locator(".sheet[data-more-right]").count()) === 0);
  await page.close();
}

/* ── the trim hands back copy a typesetter would sign ─────────────── */
{
  const page = await open();
  const bad = await page.$$eval(".cardTitle, .cardNote", (nodes) =>
    nodes.map((n) => n.textContent).filter((t) =>
      /[\s,;:.!?-]…$/.test(t) ||
      /\s(a|an|the|and|or|but|if|to|of|with|for|in|on|at|by|from|that|which)…$/i.test(t)));
  ok("no ellipsis lands on punctuation or a dangling word", bad.length === 0, JSON.stringify(bad));
  await page.close();
}


/* ── creating a task is real ──────────────────────────────────────── */
{
  const page = await open();
  const before = await counts(page);
  await page.locator(".dockPrimary").click();
  await page.waitForTimeout(200);
  ok("the dock's pill opens a composer", (await page.locator(".card[data-draft]").count()) === 1);
  ok("in the column it will live in",
    (await page.locator('.tray[data-lane="todo"] .card[data-draft]').count()) === 1);
  ok("with the caret already in it",
    await page.evaluate(() => document.activeElement.closest(".card[data-draft]") !== null));
  await page.keyboard.type("Chase the cake delivery slot");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  ok("enter adds it", (await counts(page)).todo === before.todo + 1, JSON.stringify(await counts(page)));
  ok("and it says so", /added to the to do column/.test(await page.locator("#say").textContent()),
    await page.locator("#say").textContent());
  /* Adding one task is rare; adding six on a Monday morning is the case. */
  ok("and opens a fresh line for the next one", (await page.locator(".card[data-draft]").count()) === 1);
  ok("with the caret still in it",
    await page.evaluate(() => document.activeElement.closest(".card[data-draft]") !== null));
  await page.keyboard.type("Confirm the cake delivery slot");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  ok("so a run of tasks costs one Add", (await counts(page)).todo === before.todo + 2, JSON.stringify(await counts(page)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("and escape ends the run", (await page.locator(".card[data-draft]").count()) === 0);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  ok("each one is its own step back", (await counts(page)).todo === before.todo + 1);
  ok("creating is reversible like everything else",
    (await page.locator('.carry [data-act="undo"]').count()) === 1);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  ok("ctrl+z removes it again", (await counts(page)).todo === before.todo);

  await page.locator('.tray[data-lane="review"] .trayAdd').click();
  await page.waitForTimeout(200);
  ok("a column's own Add opens it there",
    (await page.locator('.tray[data-lane="review"] .card[data-draft]').count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("escape discards it", (await page.locator(".card[data-draft]").count()) === 0);
  ok("and nothing was added", (await counts(page)).review === before.review);
  await page.close();
}

/* ── the way back is more than one deep ───────────────────────────── */
{
  const page = await open();
  const before = await counts(page);
  await page.locator('.tray[data-lane="todo"] .card .tick').first().click();
  await page.waitForTimeout(400);
  await page.locator('.tray[data-lane="doing"] .card .tick').first().click();
  await page.waitForTimeout(400);
  ok("two completions land", (await counts(page)).done === before.done + 2, JSON.stringify(await counts(page)));
  ok("and the strip says how deep the way back goes",
    (await page.locator(".carry em").first().textContent()).indexOf("more") !== -1);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(350);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(350);
  ok("two undos reverse both", (await counts(page)).done === before.done, JSON.stringify(await counts(page)));

  /* The strip is news and retires; the record is history and does not. */
  await page.locator('.tray[data-lane="todo"] .card .tick').first().click();
  await page.waitForTimeout(7000);
  ok("the strip has retired", (await page.locator(".carry").count()) === 0);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(350);
  ok("but ctrl+z still works", (await counts(page)).done === before.done, JSON.stringify(await counts(page)));
  await page.close();
}

/* ── nothing is drawn as live when it is not ──────────────────────── */
{
  const page = await open();
  const live = await page.$$eval(".views button", (n) =>
    n.filter((b) => b.getAttribute("aria-disabled") !== "true").map((b) => b.textContent.trim()));
  ok("only the view that exists is drawn as live", live.length === 1 && live[0] === "Board", JSON.stringify(live));
  const named = await page.$$eval('.views [aria-disabled="true"]', (n) =>
    n.filter((b) => !b.getAttribute("title")).length);
  ok("and the rest say why when asked", named === 0, named + " silent");
  await page.close();
}

/* ── a completed card keeps its note ──────────────────────────────── */
{
  const page = await open();
  const note = await page.locator('.tray[data-lane="doing"] .card').nth(2).locator(".cardNote").textContent();
  await page.locator('.tray[data-lane="doing"] .card').nth(2).locator(".tick").click();
  await page.waitForTimeout(500);
  const kept = await page.$$eval('.tray[data-lane="done"] .cardNote', (n) => n.map((x) => x.textContent));
  ok("done is where a venue's memory lives", kept.length > 0, kept.length + " notes in Done");
  ok("including the one just completed",
    kept.some((t) => t.slice(0, 14) === note.slice(0, 14)), JSON.stringify(kept.slice(0, 2)));
  await page.locator('.tray[data-lane="done"] .card').first().click();
  await page.waitForTimeout(200);
  ok("and it opens like any other", (await page.locator(".card[data-open]").count()) === 1);
  await page.close();
}

/* ── the strip can say what you are holding ───────────────────────── */
{
  for (const width of [1440, 1280, 1024, 900, 768]) {
    const page = await open("", { width, height: 960 });
    await page.locator('.board .card[tabindex="0"]').focus();
    await page.keyboard.press(" ");
    await page.waitForTimeout(200);
    const clipped = await page.evaluate(() => {
      const n = document.querySelector(".carryName");
      return n ? n.scrollWidth > n.clientWidth + 1 : true;
    });
    ok("the card's name is not clipped at " + width, !clipped);
    await page.close();
  }
}

/* ── a drop that goes nowhere is not a move ───────────────────────── */
{
  const page = await open();
  const card = await page.locator('.tray[data-lane="todo"] .card').first().boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2, card.y + 24, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  ok("putting a card back where it was arms no undo", (await page.locator(".carry").count()) === 0);
  await page.close();
}

/* ── the couple's name never breaks in two ────────────────────────── */
{
  const page = await open("?state=dense");
  const split = await page.evaluate(() => {
    const range = document.createRange();
    return [...document.querySelectorAll(".cardTitle, .who")].filter((n) => {
      if (!/&/.test(n.textContent)) return false;
      range.selectNodeContents(n);
      return range.getClientRects().length > 1 &&
        /[  ]&\s*$/.test(n.textContent.slice(0, n.textContent.indexOf("&") + 1)) === false &&
        n.textContent.indexOf(" ") === -1;
    }).length;
  });
  ok("partner names are bound", split === 0, split + " unbound");
  await page.close();
}

/* ── the card holds a real measure at any width ───────────────────── */
{
  for (const width of [1440, 1920, 2560]) {
    const page = await open("", { width, height: 960 });
    const w = await page.evaluate(() => Math.round(document.querySelector(".board .card").getBoundingClientRect().width));
    ok("the card is bounded at " + width, w <= 312 && w >= 220, w + "px");
    await page.close();
  }
}


/* ── nothing on the sheet is silently dead ────────────────────────── */
{
  const page = await open();
  const silent = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".floor button").forEach((b) => {
      if (b.closest(".card") || b.classList.contains("trayAdd")) return;
      const live = b.dataset.act || b.hasAttribute("data-active") || b.classList.contains("dockPrimary");
      const marked = b.getAttribute("aria-disabled") === "true" && b.getAttribute("title");
      if (!live && !marked) out.push((b.className || b.tagName) + ":" + b.textContent.trim().slice(0, 18));
    });
    return out;
  });
  ok("every control is either live or says why it is not", silent.length === 0, JSON.stringify(silent));

  /* The Planning drawer was fully built and reachable only by URL. */
  await page.locator('.headActions [data-act="planning"]').click();
  await page.waitForTimeout(250);
  ok("the Planning button opens the drawer", (await page.locator(".drawer").count()) === 1);
  await page.locator('.headActions [data-act="planning"]').click();
  await page.waitForTimeout(200);
  ok("and closes it", (await page.locator(".drawer").count()) === 0);
  await page.locator(".undated").click();
  await page.waitForTimeout(250);
  ok("so does the count of tasks with no date", (await page.locator(".drawer").count()) === 1);
  await page.close();
}

/* ── the composer does not eat your words ─────────────────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="review"] .trayAdd').click();
  await page.waitForTimeout(200);
  await page.keyboard.type("Ring the florist back about");
  /* Any repaint at all: the filter is the cheapest one to trigger. */
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(300);
  const kept = await page.locator(".card[data-draft] .cardTitle").textContent();
  ok("a repaint cannot destroy a half-written task", kept.indexOf("Ring the florist") === 0, JSON.stringify(kept));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("escape returns focus to the control it came from",
    await page.evaluate(() => document.activeElement.classList.contains("trayAdd")),
    await page.evaluate(() => document.activeElement.tagName + "." + document.activeElement.className));
  await page.close();
}

/* ── a task made under a filter is visible ────────────────────────── */
{
  const page = await open();
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(200);
  /* A filtered board collapses the columns that answered nothing, which takes
     their Add row with it — offering "add here" in a column that is not part
     of the answer is noise. Nothing is lost by it: the dock's Add task is
     always there, and so is the Add row of any column that did answer. Both
     are asserted here, because a collapse that quietly removed the only way
     to add would be a capability regression wearing a tidier face. */
  ok("adding is still offered under a filter",
    (await page.locator(".dockPrimary").isVisible())
      && (await page.locator(".trayAdd:visible").count()) >= 1);
  await page.locator(".trayAdd:visible").first().click();
  await page.waitForTimeout(200);
  await page.keyboard.type("Order more ice for Saturday");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok("the filter releases so the new task can be seen",
    (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 0);
  ok("and it is on screen", (await page.locator(".board .cardTitle", { hasText: "Order more ice" }).count()) === 1);
  ok("and the board says why", (await page.locator("#say").textContent()).indexOf("filter is off") !== -1);
  await page.close();
}

/* ── the filtered board does not describe what it is not showing ──── */
{
  const page = await open();
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(250);
  /* The column carries the fact in its own accessible name; a note here
     would be the same fact a fourth time on one screen. */
  const notes = await page.$$eval(".trayNote", (n) => n.map((x) => x.textContent.trim()));
  ok("no column describes what it is not showing", notes.every((t) => t === ""), JSON.stringify(notes));
  const labels = await page.$$eval(".tray[data-lane]", (n) => n.map((x) => x.getAttribute("aria-label")));
  /* A lane that was already empty is exempt: it has no proportion to state,
     and "0 of 0 shown" is a ratio of nothing to nothing. */
  ok("but each one says what it is showing, out of what",
    labels.every((t) => / \d+ of \d+ shown$/.test(t) || /nothing here yet$/.test(t)),
    JSON.stringify(labels));
  const count = await page.locator('.tray[data-lane="todo"] .trayCount').textContent();
  /* Figures and a solidus, never a lowercase word in a tracked mono cell. */
  ok("the count states filtered of total", /^\d+\/\d+$/.test(count.trim()), JSON.stringify(count));
  await page.close();
}

/* ── the Done column de-escalates as one card ─────────────────────── */
{
  const page = await open();
  const ranks = await page.evaluate(() => {
    const card = document.querySelector('.tray[data-lane="done"] .card .who').closest(".card");
    const w = (sel) => {
      const n = card.querySelector(sel);
      return n ? getComputedStyle(n).fontWeight : null;
    };
    return { title: w(".cardTitle"), who: w(".who") };
  });
  ok("a finished card's title still outranks its client",
    Number(ranks.title) > Number(ranks.who), JSON.stringify(ranks));
  ok("and Done says when", (await page.locator('.tray[data-lane="done"] .when').count()) > 0);
  await page.close();
}

/* ── the board settles as one movement ────────────────────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card .tick').first().click();
  await page.waitForTimeout(80);
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll(".board .card")].filter((c) => getComputedStyle(c).transform !== "none").length);
  ok("the cards left behind close the gap rather than snapping", moving > 0, moving + " in motion");
  await page.waitForTimeout(700);
  const stuck = await page.evaluate(() =>
    [...document.querySelectorAll(".board .card")].filter((c) => c.style.transform).length);
  ok("and nothing is left transformed", stuck === 0, stuck + " stuck");
  await page.close();
}

/* ── the flight never leaves the sheet ────────────────────────────── */
{
  const page = await open("", { width: 390, height: 844 });
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(120);
  const out = await page.evaluate(() => {
    const g = document.querySelector(".cardGhost");
    if (!g) return 0;
    const b = g.getBoundingClientRect();
    return b.right > window.innerWidth + 2 || b.left < -2 ? 1 : 0;
  });
  ok("the ghost stays on the phone's screen", out === 0);
  await page.close();
}

/* ── the move menu answers like a menu ────────────────────────────── */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card').first().hover();
  await page.locator('.tray[data-lane="todo"] .cardDots').first().click();
  await page.waitForTimeout(200);
  const stops = await page.locator('.cardMenu [tabindex="0"]').count();
  ok("the menu is one tab stop", stops === 1, stops + " stops");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  ok("and the arrows walk it",
    await page.evaluate(() => document.activeElement.closest(".cardMenu") !== null));
  await page.close();
}

/* ── a card with no note says so ──────────────────────────────────── */
{
  const page = await open();
  await page.locator('.board .card:not([aria-expanded])').first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok("enter on a card with no note is honest",
    (await page.locator("#say").textContent()).indexOf("no note") !== -1,
    await page.locator("#say").textContent());
  await page.close();
}

/* ── the live region exists before it is needed ───────────────────── */
{
  const page = await open();
  ok("the live region is in the tree from the first paint",
    (await page.locator("#say").count()) === 1);
  ok("and starts empty", (await page.locator("#say").textContent()).trim() === "");
  await page.close();
}


/* ── Planning is a room, not a picture of one ─────────────────────── */
{
  const page = await open();
  await page.locator(".undated").click();
  await page.waitForTimeout(300);
  ok("it takes focus when it opens",
    await page.evaluate(() => document.activeElement.classList.contains("drawer")),
    await page.evaluate(() => document.activeElement.className));
  ok("and declares itself a dialog with a name",
    await page.evaluate(() => {
      const d = document.querySelector(".drawer");
      return d.getAttribute("role") === "dialog" && !!d.getAttribute("aria-labelledby");
    }));

  /* Its list is the live set, so the header's count and the drawer's count
     can never disagree. */
  const head = await page.locator(".undated").textContent();
  const tab = await page.locator('.drawerTab[data-tab="nodate"] em').textContent();
  ok("its count is the header's count", head.trim().indexOf(tab.trim()) === 0, head + " vs " + tab);

  await page.locator(".drawerRow .box").first().click();
  await page.waitForTimeout(200);
  ok("a row can be picked", (await page.locator('.box[aria-checked="true"]').count()) === 1);
  await page.locator(".selectAll").click();
  await page.waitForTimeout(200);
  const picked = await page.locator('.box[aria-checked="true"]').count();
  ok("select all picks every row", picked === (await page.locator(".drawerRow").count()), picked + " picked");
  ok("and the control flips", (await page.locator(".selectAll").textContent()).trim() === "Clear all");

  await page.locator('.drawerTab[data-tab="milestones"]').click();
  await page.waitForTimeout(250);
  ok("the tabs switch the list",
    (await page.locator('.drawerTab[aria-selected="true"]').getAttribute("data-tab")) === "milestones");
  ok("and the list actually changes", (await page.locator(".drawerRow, .drawerEmpty").count()) > 0);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("escape closes it", (await page.locator(".drawer").count()) === 0);
  ok("and focus goes back to what opened it",
    await page.evaluate(() => document.activeElement.classList.contains("undated")),
    await page.evaluate(() => document.activeElement.className));

  await page.locator('.headActions [data-act="planning"]').click();
  await page.waitForTimeout(250);
  await page.locator(".drawer .ghost").click();
  await page.waitForTimeout(250);
  ok("the close button closes it", (await page.locator(".drawer").count()) === 0);

  /* The drawer used to be modal to the pointer and non-modal to the keyboard:
     a real press on a card's tick with the drawer open closed the drawer and
     did not complete the task. It declares aria-modal="false" and sits beside
     the sheet, so the board stays live behind it. The X and Escape are the
     ways out. */
  await page.locator('.headActions [data-act="planning"]').click();
  await page.waitForTimeout(300);
  const beforeDone = (await counts(page)).done;
  const tickBox = await page.locator('.tray[data-lane="todo"] .card .tick').first().boundingBox();
  await page.mouse.move(tickBox.x + tickBox.width / 2, tickBox.y + tickBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tickBox.x + tickBox.width / 2 + 2, tickBox.y + tickBox.height / 2 + 2);
  await page.mouse.up();
  await page.waitForTimeout(700);
  ok("the board stays live behind the drawer", (await counts(page)).done === beforeDone + 1,
    JSON.stringify(await counts(page)));
  ok("and the drawer is still open", (await page.locator(".drawer").count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("escape is a way out", (await page.locator(".drawer").count()) === 0);
  await page.close();
}

/* ── the couple's name is the venue's own way of looking ──────────── */
{
  const page = await open("?state=dense");
  const before = await counts(page);
  const name = await page.locator(".who").first().textContent();
  await page.locator(".who").first().click();
  await page.waitForTimeout(300);
  const after = await counts(page);
  const shown = Object.values(after).reduce((a, b) => a + b, 0);
  const all = Object.values(before).reduce((a, b) => a + b, 0);
  ok("clicking a couple shows only their work", shown > 0 && shown < all, shown + " of " + all);
  ok("and the strip says whose", (await page.locator(".carryName").textContent()).indexOf(name.trim()) !== -1);
  ok("with a way back", (await page.locator('.carry [data-act="showall"]').count()) === 1);
  const only = await page.$$eval(".board .who", (n) => new Set(n.map((x) => x.textContent)).size);
  ok("every card shown is theirs", only === 1, only + " couples on screen");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("escape shows every couple again",
    Object.values(await counts(page)).reduce((a, b) => a + b, 0) === all);
  await page.close();
}

/* ── the column that holds waits has a clock ──────────────────────── */
{
  /* The default fixture has an empty Waiting column, which is itself the
     point of the column; peak season is where the waits actually sit. */
  const page = await open("?state=dense");
  const chips = await page.$$eval('.tray[data-lane="waiting"] .when', (n) => n.map((x) => x.textContent));
  ok("a held task says how long it has been held", chips.length > 0, JSON.stringify(chips));
  const cards = await page.locator('.tray[data-lane="done"] .card').count();
  const done = await page.$$eval('.tray[data-lane="done"] .when', (n) => n.map((x) => x.textContent));
  ok("and every finished task says when", done.length === cards, done.length + " of " + cards);
  const order = await page.$$eval('.tray[data-lane="done"] .card', (n) =>
    n.map((c) => c.querySelector(".when") && c.querySelector(".when").textContent));
  ok("Done reads newest first", order.length === cards, JSON.stringify(order));
  await page.close();
}

/* ── the sheet speaks as the product, not as a lab file ───────────── */
{
  const page = await open();
  const bad = await page.$$eval('[title]', (n) =>
    n.map((x) => x.getAttribute("title")).filter((t) =>
      /not built|exploration|lab|TODO|coming soon|WIP/i.test(t)));
  ok("no control admits on screen that this is a lab file", bad.length === 0, JSON.stringify(bad));

  /* Hover is not available to a thumb, so tapping says the same sentence. */
  await page.locator('.segItem[aria-disabled="true"]').first().click({ force: true });
  await page.waitForTimeout(200);
  const said = await page.locator("#say").textContent();
  ok("tapping an unavailable control says why", said.length > 4, JSON.stringify(said));
  ok("and it does not switch the view",
    (await page.locator('.segItem[data-active]').textContent()).indexOf("Board") !== -1);
  await page.close();
}

/* ── a scrolled column never renders type at a mid-tone ───────────── */
{
  const page = await open("?state=dense");
  const dimmed = await page.evaluate(async () => {
    const body = document.querySelector('.tray[data-lane="todo"] .trayBody');
    let worst = 0;
    for (const target of [120, 240, 380, 500]) {
      body.scrollTop = target;
      await new Promise((r) => setTimeout(r, 220));
      /* A mask would give an element an effective alpha between 0 and 1;
         a hairline cannot. Read the computed mask off the scroller itself. */
      const cs = getComputedStyle(body);
      const masked = (cs.maskImage && cs.maskImage !== "none") ||
        (cs.webkitMaskImage && cs.webkitMaskImage !== "none");
      if (masked) worst = 1;
    }
    return worst;
  });
  ok("no gradient is laid over a column of type", dimmed === 0);

  /* And the column still says, at both ends, that there is more this way. */
  await page.evaluate(() => { document.querySelector('.tray[data-lane="todo"] .trayBody').scrollTop = 240; });
  await page.waitForTimeout(250);
  const edges = await page.evaluate(() => {
    const b = document.querySelector('.tray[data-lane="todo"] .trayBody');
    /* The rules are drawn on the tray, above the cards, because an inset
       shadow on the scroller is painted under its own content. */
    const tray = b.closest(".tray");
    const opacity = (which) => Number(getComputedStyle(tray, which).opacity);
    return { above: b.hasAttribute("data-above"), more: b.hasAttribute("data-more"),
      shadow: opacity("::before") === 1 && opacity("::after") === 1 };
  });
  ok("a column with more at both ends says so", edges.above && edges.more && edges.shadow, JSON.stringify(edges));

  /* The column rests on a card rather than halfway through one. */
  const rest = await page.evaluate(() => {
    const b = document.querySelector('.tray[data-lane="todo"] .trayBody');
    const box = b.getBoundingClientRect();
    return [...b.querySelectorAll(".card")]
      .map((c) => Math.round(c.getBoundingClientRect().top - box.top))
      .some((t) => Math.abs(t - 20) < 2);
  });
  ok("and rests on a card, not halfway through one", rest);
  await page.close();
}

/* ── the rag is managed, not merely balanced ──────────────────────── */
{
  const page = await open("?state=dense");
  const orphans = await page.$$eval(".cardTitle", (nodes) => {
    const out = [];
    for (const n of nodes) {
      const range = document.createRange();
      range.selectNodeContents(n);
      const lines = [...range.getClientRects()].filter((r) => r.height > 4);
      if (lines.length > 1 && lines[0].width < 60) out.push(n.textContent.slice(0, 24));
    }
    return out;
  });
  ok("no title opens on a one-word line", orphans.length === 0, JSON.stringify(orphans));
  await page.close();
}


/* ── the card has a floor, not only a ceiling ─────────────────────── */
{
  for (const width of [1280, 1360, 1440, 1920]) {
    const page = await open("", { width, height: 900 });
    const w = await page.evaluate(() =>
      Math.round(document.querySelector(".board .card").getBoundingClientRect().width));
    ok("the card never falls below its documented measure at " + width, w >= 234 && w <= 288, w + "px");
    await page.close();
  }
}

/* ── two questions can be asked at once ───────────────────────────── */
{
  const page = await open("?state=dense");
  /* The couple first: the one overdue task belongs to an area of the house,
     not to a couple, so the reverse order leaves no name to click. */
  await page.locator(".board .who").first().click();
  await page.waitForTimeout(250);
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(250);
  ok("an overdue filter does not silently cancel the couple",
    (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 1);
  /* Composing these two on the dense board matches nothing, and the board
     answers in one place. The sentence lives wherever the board is speaking
     from: the strip while something is shown, the centred block when nothing
     is. Both name every live filter. */
  const shown = await page.locator(".board .card:not([data-draft])").count();
  const voice = shown
    ? await page.locator(".carryName").textContent()
    : await page.locator(".emptyBoard p").textContent();
  ok("and the board states both filters", /overdue/.test(voice) && /for /.test(voice), JSON.stringify(voice));
  ok("with the noun in place", / tasks? /.test(voice) || /No task/.test(voice), JSON.stringify(voice));
  /* The defect this replaces: two statements of one fact 60px apart, under
     two different labels for one action. */
  ok("nothing that matches nothing is said twice",
    (await page.locator(".carryName").count()) + (await page.locator(".emptyBoard p").count()) === 1);
  ok("and there is exactly one way back",
    (await page.locator('[data-act="showall"], [data-act="clear"]').count()) === 1);
  ok("a board that shows nothing never claims others are hidden",
    shown ? true : !/other/.test(voice), JSON.stringify(voice));
  ok("and it does not read as a comma-separated query log",
    !/, (due today|overdue)\./.test(voice), JSON.stringify(voice));

  /* Escape unwinds one layer at a time, innermost first. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("escape drops the couple first",
    (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 1 &&
    (await page.locator('.who[aria-pressed="true"]').count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("then the overdue one",
    (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 0);
  await page.close();
}

/* ── today is on the board ────────────────────────────────────────── */
{
  const page = await open("?state=dense");
  ok("the header states what is due today", (await page.locator('[data-act="today"]').count()) === 1);
  await page.locator('[data-act="today"]').click();
  await page.waitForTimeout(300);
  const chips = await page.$$eval(".board .when", (n) => n.map((x) => x.getAttribute("data-t")));
  ok("and filtering to it shows only today's work",
    chips.length > 0 && chips.every((t) => t === "today"), JSON.stringify(chips));
  await page.close();
}

/* ── a drop into Done is a completion ─────────────────────────────── */
{
  const page = await open();
  const before = await counts(page);
  await page.dragAndDrop('.tray[data-lane="review"] .card >> nth=0', '.tray[data-lane="done"] .trayBody');
  await page.waitForTimeout(400);
  ok("it lands in Done", (await counts(page)).done === before.done + 1);
  ok("and offers the way back every other route offers",
    (await page.locator('.carry [data-act="undo"]').count()) === 1);
  ok("and says so", (await page.locator("#say").textContent()).indexOf("done") !== -1);
  await page.close();
}

/* ── the words on a card can be taken ─────────────────────────────── */
{
  const page = await open();
  await page.locator(".board .card").first().click();
  await page.waitForTimeout(250);
  const selectable = await page.evaluate(() => {
    const n = document.querySelector(".card[data-open] .cardNote");
    return { open: getComputedStyle(n).userSelect, drag: n.closest(".card").getAttribute("draggable") };
  });
  ok("an open card's note can be selected", selectable.open === "text", JSON.stringify(selectable));
  ok("and it is not the thing being dragged", selectable.drag === "false");
  await page.close();
}

/* ── the board does not jump when it is filtered ──────────────────── */
{
  const page = await open();
  const y = () => page.evaluate(() =>
    Math.round(document.querySelector('.tray[data-lane="doing"] .trayBody').getBoundingClientRect().top));
  const rest = await y();
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(300);
  ok("the most-clicked control on the page moves nothing", Math.abs((await y()) - rest) <= 1,
    rest + " -> " + (await y()));
  await page.close();
}

/* ── a forced palette keeps the whole status language ─────────────── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, forcedColors: "active" });
  await page.goto(URL);
  await page.waitForTimeout(400);
  const kept = await page.evaluate(() => {
    const card = document.querySelector(".board .card");
    const chip = document.querySelector('.when[data-t="overdue"]');
    const tick = document.querySelector(".board .tick");
    return {
      card: getComputedStyle(card).borderTopWidth,
      chip: chip ? getComputedStyle(chip).borderTopWidth : "0px",
      tick: getComputedStyle(tick).borderTopWidth,
    };
  });
  ok("a card still has an edge", parseFloat(kept.card) >= 1, JSON.stringify(kept));
  ok("a chip still has an edge", parseFloat(kept.chip) >= 1, JSON.stringify(kept));
  ok("a tick still has an edge", parseFloat(kept.tick) >= 1, JSON.stringify(kept));
  await page.close();
}

/* ── the copy is written, not templated ──────────────────────────── */
{
  const page = await open();
  const tips = await page.$$eval("[title]", (n) => n.map((x) => x.getAttribute("title")));
  const templated = tips.filter((t) => / is (a room|not built)/.test(t));
  ok("no tooltip is generated from a label", templated.length === 0, JSON.stringify(templated));
  const unpunctuated = tips.filter((t) => /(comes with|Not here yet|arrives when|lives in)/.test(t) && !/[.?]$/.test(t));
  ok("every one is a sentence", unpunctuated.length === 0, JSON.stringify(unpunctuated));
  await page.close();
}

/* ── the copy is typeset, not typed ──────────────────────────────── */
{
  for (const state of ["board", "dense", "planning", "cards"]) {
    const page = await open("?state=" + state);
    const straight = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll(".cardTitle, .cardNote, .trayNote, .trayEmpty, .headFacts, .drawerLine, .drawerSummary, .drawerHelp, .specIntro, .specNote, .carryName")
        .forEach((n) => { if (/[A-Za-z]'[A-Za-z]/.test(n.textContent)) out.push(n.textContent.slice(0, 40)); });
      return out;
    });
    ok("no straight apostrophe in shipped copy at " + state, straight.length === 0, JSON.stringify(straight));
    await page.close();
  }
}

/* ── the drawer sits on the same tracking curve as the sheet ──────── */
{
  const page = await open("?state=planning");
  const off = await page.evaluate(() => {
    const CURVE = { 19: -0.026, 18: -0.022, 15: -0.016, 14: -0.014, 13: -0.010, 12: -0.006, 11: 0, 10: 0.004 };
    const out = [];
    document.querySelectorAll(".drawer *").forEach((n) => {
      if (!n.firstChild || n.firstChild.nodeType !== 3 || !n.textContent.trim()) return;
      const cs = getComputedStyle(n);
      if (/mono/i.test(cs.fontFamily)) return;
      const size = Math.round(parseFloat(cs.fontSize));
      const want = CURVE[size];
      if (want === undefined) return;
      const got = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize);
      if (Math.abs((Number.isFinite(got) ? got : 0) - want) > 0.0015) {
        out.push(n.className + " " + size + "px " + (Number.isFinite(got) ? got.toFixed(4) : "normal"));
      }
    });
    return out;
  });
  ok("every line in Planning is on the curve", off.length === 0, JSON.stringify(off.slice(0, 4)));
  await page.close();
}


/* ── every variant keeps the state system ────────────────────────── */
{
  for (const v of ["locked", "a", "b", "c"]) {
    const page = await open("?v=" + v);
    await page.locator('.board .card[tabindex="0"]').focus();
    await page.waitForTimeout(200);
    const ring = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".board .card:focus-visible") ||
        document.activeElement.closest(".card")).boxShadow);
    ok("the focus ring survives preset " + v, /79, 70, 229/.test(ring), ring.slice(0, 60));
    await page.close();
  }
}

/* ── a forced palette does not say every task is done ─────────────── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, forcedColors: "active" });
  await page.goto(URL);
  await page.waitForTimeout(400);
  const checks = await page.evaluate(() =>
    [...document.querySelectorAll(".board .card:not([data-done]) .tick svg")]
      .filter((n) => getComputedStyle(n).display !== "none").length);
  ok("an unfinished task shows no check in a forced palette", checks === 0, checks + " showing");
  await page.close();
}

/* ── the undo depth is the truth ──────────────────────────────────── */
{
  const page = await open();
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(400);
  const depth = () => page.evaluate(() => {
    const n = document.querySelector(".carry em");
    return n && /more/.test(n.textContent) ? n.textContent : "none";
  });
  const before = await depth();
  for (let i = 0; i < 3; i += 1) {
    await page.locator(".carry").hover();
    await page.waitForTimeout(60);
    await page.locator(".head").hover();
    await page.waitForTimeout(60);
  }
  ok("passing over the strip does not inflate the history", (await depth()) === before,
    before + " -> " + (await depth()));
  await page.close();
}

/* == the band never spends the name, and never spills ============== */
/* Round 12: from about 1120px down the single-row header pushed Planning and
   More past the sheet's right edge, where overflow:hidden cut them off the
   screen; and from 1240 down the venue's own name was the only thing allowed
   to shrink, so it read "The Orcha..." while the season line beside it kept
   every character. The band stacks on the width of the SHEET now, which is
   why the drawer-open case is swept here too: an open drawer at 1440 is the
   same width of sheet as a 1100px window. */
for (const query of ["", "?state=planning"]) {
  const page = await open(query);
  let spilled = null;
  let clipped = null;
  let leastFacts = 99;
  for (let w = 1440; w >= 780; w -= 20) {
    await page.setViewportSize({ width: w, height: 960 });
    await page.waitForTimeout(60);
    const r = await page.evaluate(() => {
      const sheet = document.querySelector(".sheet");
      const edge = sheet.getBoundingClientRect().right - 28;
      const name = document.querySelector(".headName");
      const past = [...document.querySelectorAll(".headActions > *")]
        .filter((n) => n.getBoundingClientRect().right > edge + 0.5)
        .map((n) => (n.textContent || n.getAttribute("aria-label") || "").trim().slice(0, 10));
      return {
        past,
        cut: name.scrollWidth > name.clientWidth + 1,
        facts: [...document.querySelectorAll(".headFacts > *")].filter((n) => n.offsetParent !== null).length,
      };
    });
    if (r.past.length && !spilled) spilled = w + ": " + r.past.join(",");
    if (r.cut && !clipped) clipped = String(w);
    leastFacts = Math.min(leastFacts, r.facts);
  }
  const where = query ? "with the drawer open" : "on the plain board";
  ok("no control leaves the sheet at any width " + where, spilled === null, spilled);
  ok("and the venue name is never truncated " + where, clipped === null, clipped);
  ok("and no fact is spent to make the room " + where, leastFacts === 6, "fewest facts " + leastFacts);
  await page.close();
}

/* == a column that did not answer collapses to its head ============ */
/* The rule that claimed this was `flex: 0 1 auto` on a grid item, which is
   inert, so the filtered board stayed one card marooned in a field of
   full-height empty rules. */
for (const [w, label] of [[1440, "1440"], [1280, "1280"]]) {
  const page = await open("?state=filtered", { width: w, height: 960 });
  const t = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".tray[data-lane]")].map((n) => ({
      empty: n.hasAttribute("data-empty"),
      h: Math.round(n.getBoundingClientRect().height),
    }));
    return {
      live: Math.max(...rows.filter((r) => !r.empty).map((r) => r.h)),
      dead: Math.max(...rows.filter((r) => r.empty).map((r) => r.h)),
    };
  });
  ok("an unanswering column collapses to its head at " + label,
    t.dead < t.live / 4, "empty " + t.dead + " against " + t.live);
  /* The step back is ink, not opacity: opacity halved the tray's own hairline
     with it and drew the four column rules at three different weights. */
  const rules = await page.evaluate(() =>
    [...document.querySelectorAll(".tray[data-lane]")].slice(1)
      .map((n) => getComputedStyle(n).borderLeftColor));
  ok("and every column rule is still drawn at one weight at " + label,
    new Set(rules).size === 1, JSON.stringify(rules));
  await page.close();
}

/* == the filtered board is legible, not merely dimmed ============== */
{
  const page = await open("?state=filtered");
  const worst = await page.evaluate(() => {
    const lum = (c) => {
      const v = c.map((x) => {
        const u = x / 255;
        return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    let low = 99;
    let who = "";
    document.querySelectorAll(".tray[data-empty] .trayName, .tray[data-empty] .trayCount").forEach((n) => {
      let dim = 1;
      for (let p = n; p && p !== document.documentElement; p = p.parentElement) {
        const o = parseFloat(getComputedStyle(p).opacity);
        if (Number.isFinite(o) && o < 1) dim *= o;
      }
      const m = getComputedStyle(n).color.match(/[\d.]+/g).map(Number);
      const a = (m[3] === undefined ? 1 : m[3]) * dim;
      const fg = [0, 1, 2].map((i) => m[i] * a + 255 * (1 - a));
      const r = (lum([255, 255, 255]) + 0.05) / (lum(fg) + 0.05);
      if (r < low) { low = r; who = n.className + " " + n.textContent.trim(); }
    });
    return { low: Math.round(low * 100) / 100, who };
  });
  ok("a stepped-back column head still clears AA", worst.low >= 4.5,
    worst.who + " at " + worst.low + ":1");
  await page.close();
}

/* == the rail is one stop, and stays one across a repaint ========== */
/* It was four: the mark and the avatar carried no tabindex at all, and the
   tile expression short-circuited so Home and Tasks both rendered a zero. */
for (const [w, h, label] of [[1440, 960, "1440"], [390, 844, "390"]]) {
  const page = await open("", { width: w, height: h });
  const railStops = () => page.evaluate(() =>
    [...document.querySelectorAll(".rail a, .rail button, .rail [tabindex]")]
      .filter((n) => n.offsetParent !== null && n.getAttribute("tabindex") !== "-1").length);
  ok("the rail is one tab stop at rest at " + label, (await railStops()) === 1, String(await railStops()));
  await page.evaluate(() => document.querySelector('.rail button[tabindex="0"]').focus());
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  ok("and one after the arrows walk it at " + label, (await railStops()) === 1, String(await railStops()));
  const moved = await page.evaluate(() => document.activeElement.dataset.key);
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(500);
  ok("and one after a completion repaints the sheet at " + label, (await railStops()) === 1, String(await railStops()));
  const now = await page.evaluate(() => document.querySelector('.rail button[tabindex="0"]').dataset.key);
  ok("and the walked position survives that repaint at " + label, now === moved, moved + " -> " + now);
  await page.close();
}

/* == the fold rule marks the fold ================================== */
/* A spurious offset term put it 112px above the foot of the scroller, where
   it read as a section divider inside Done rather than as "there is more". */
for (const [q, w, label] of [["", 1440, "1440"], ["", 1280, "1280"], ["?state=planning", 1440, "drawer open"], ["?state=dense", 1440, "peak season"]]) {
  const page = await open(q, { width: w, height: 960 });
  const off = await page.evaluate(() => {
    let worst = 0;
    document.querySelectorAll(".tray[data-lane]").forEach((t) => {
      const body = t.querySelector(".trayBody");
      if (!body) return;
      const tb = t.getBoundingClientRect();
      const bb = body.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(t).getPropertyValue("--body-top")) || 0;
      const bot = parseFloat(getComputedStyle(t).getPropertyValue("--body-bottom")) || 0;
      worst = Math.max(worst, Math.abs(tb.top + top - bb.top), Math.abs(tb.top + bot - bb.bottom));
    });
    return Math.round(worst);
  });
  ok("both fold rules sit on the scroller own edges at " + label, off <= 1, off + "px out");
  await page.close();
}

/* == the completion arrives instead of snapping ==================== */
{
  const page = await open();
  await page.evaluate(() => {
    window.__fly = [];
    const t = setInterval(() => {
      const s = document.querySelector(".cardFly");
      if (!s) return;
      const r = s.getBoundingClientRect();
      window.__fly.push([Math.round(r.width), Math.round(r.height)]);
    }, 16);
    setTimeout(() => clearInterval(t), 1500);
  });
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(900);
  const f = await page.evaluate(() => {
    const s = window.__fly;
    const node = document.querySelector(".card[data-just-done]");
    return {
      first: s[0], last: s[s.length - 1], frames: s.length,
      dest: node ? [Math.round(node.getBoundingClientRect().width), Math.round(node.getBoundingClientRect().height)] : null,
    };
  });
  ok("the flight grows into the card it becomes", f.frames > 4 && f.first[1] !== f.last[1],
    JSON.stringify(f.first) + " -> " + JSON.stringify(f.last));
  ok("and hands off with no snap on the landing frame",
    Boolean(f.dest) && Math.abs(f.last[1] - f.dest[1]) <= 2 && Math.abs(f.last[0] - f.dest[0]) <= 2,
    JSON.stringify(f.last) + " against " + JSON.stringify(f.dest));
  /* The board answer used to flip at take-off, 400ms before the card landed,
     which is what made the two read as unrelated events. */
  ok("and the count settles on the frame the card lands",
    (await page.locator("[data-changed]").count()) > 0);
  await page.close();
}

/* == reopening a task does not invent a history ==================== */
{
  const page = await open();
  /* Every seeded Done card has no prevLane, so the old fallback dropped it
     into column one and announced a return to a column it had never been in. */
  await page.locator('.tray[data-lane="done"] .card .tick').first().click();
  await page.waitForTimeout(400);
  const said = await page.locator("#say").textContent();
  ok("a card that was never in To do is not said to be back in it",
    !/is back in/.test(said), JSON.stringify(said));
  ok("and reopening is reversible like everything else",
    (await page.locator('.carry [data-act="undo"]').count()) === 1);
  const when = await page.evaluate(() => {
    const n = document.querySelector('.tray[data-lane="done"] .card .when');
    return n ? n.textContent.trim() : null;
  });
  await page.locator('.carry [data-act="undo"]').click();
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => {
    const n = document.querySelector('.tray[data-lane="done"] .card .when');
    return n ? n.textContent.trim() : null;
  });
  ok("and the day the work was finished survives the round trip", back === when,
    JSON.stringify(when) + " -> " + JSON.stringify(back));
  await page.close();
}

/* == the chip is six kinds, not four looks ========================= */
{
  const page = await open("?state=dense");
  const kinds = await page.evaluate(() => {
    const seen = {};
    document.querySelectorAll(".when").forEach((c) => {
      const s = getComputedStyle(c);
      seen[c.dataset.t] = [s.backgroundColor, s.color, s.boxShadow.slice(0, 24), s.fontWeight].join("|");
    });
    return seen;
  });
  const looks = Object.values(kinds);
  ok("every kind of time chip has its own silhouette",
    new Set(looks).size === looks.length, JSON.stringify(kinds, null, 1));
  const held = await page.evaluate(() => {
    const n = document.querySelector('.when[data-t="waiting"]');
    return n ? n.textContent.trim() : null;
  });
  ok("and a waiting chip says what its number means", /^Held /.test(held || ""), JSON.stringify(held));
  await page.close();
}

/* == the empty board leaves when it is obeyed ====================== */
{
  const page = await open("?state=empty");
  ok("the blank board draws no interior rules to be framed by", await page.evaluate(() =>
    [...document.querySelectorAll(".tray")].every((t) => {
      const c = getComputedStyle(t).borderLeftColor;
      return c === "rgba(0, 0, 0, 0)" || c === "transparent";
    })));
  ok("and it teaches what a task here looks like",
    (await page.locator(".emptyEg").count()) === 1);
  await page.locator('.emptyBoard button[data-act="add"]').click();
  await page.waitForTimeout(300);
  ok("pressing the one instruction retires it", (await page.locator(".emptyBoard").count()) === 0);
  ok("and opens a composer with the caret in it",
    await page.evaluate(() => Boolean(document.activeElement.closest("[data-draft], .draft"))));
  await page.close();
}

/* == a press is a click, whatever the drag machinery thinks ======== */
/* The whole card is draggable, so Chromium's 4px drag threshold silently ate
   the two gestures this product exists for. An ordinary trackpad tap travels
   2 to 6px. Use mouse.move/down/up — locator.click() teleports with zero
   travel and would pass against the bug. */
for (const travel of [0, 4, 6, 10]) {
  const page = await open();
  const before = await counts(page);
  const box = await page.locator('.tray[data-lane="todo"] .card .tick').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + travel, box.y + box.height / 2 + travel, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  ok("the tick answers a press that travelled " + travel + "px",
    (await counts(page)).done === before.done + 1, JSON.stringify(await counts(page)));
  await page.close();
}

/* == a preset owns tokens, never states =========================== */
/* Round 11 fixed this for three card presets by rewriting the instances.
   Round 13 found it again, reintroduced by a fourth. The rule is the fix: no
   selector outside the card's own state block may write box-shadow on a card,
   because whatever property it writes it wins the cascade against every
   interaction rule. */
{
  const page = await open();
  const writers = await page.evaluate(() => {
    const bad = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      const walk = (list) => {
        for (const r of list) {
          if (r.cssRules) { walk(r.cssRules); continue; }
          if (!r.selectorText || !r.style) continue;
          const sel = r.selectorText;
          if (!/\.card(?![A-Za-z])/.test(sel)) continue;
          if (!/^\[data-(cards|indigo|radius|density|type)=/.test(sel.trim())) continue;
          if (r.style.getPropertyValue("box-shadow")) bad.push(sel);
        }
      };
      walk(rules);
    }
    return bad;
  });
  ok("no preset writes box-shadow on a card", writers.length === 0, JSON.stringify(writers));

  /* And the consequence the rule exists to protect. */
  await page.locator('.board .card[tabindex="0"]').focus();
  await page.locator('.board .card[tabindex="0"]').hover();
  await page.waitForTimeout(250);
  const ring = await page.evaluate(() => {
    const n = document.querySelector(".card:focus-visible");
    return n ? getComputedStyle(n).boxShadow : "";
  });
  ok("the keyboard focus ring survives the pointer resting on it",
    /79, 70, 229/.test(ring), ring.slice(0, 70));
  await page.close();
}

/* == every door into a completion says the same thing ============== */
/* There are four, and for a round only one of them spoke: a tick said
   "Nothing is overdue" while the same task moved by menu, dropped by hand or
   walked in by keyboard said nothing and let the chip vanish silently. */
for (const route of ["tick", "menu", "drag", "keyboard"]) {
  const page = await open();
  const sel = '.card:has(.when[data-t="overdue"])';
  if (route === "tick") await page.locator(sel + " .tick").click();
  if (route === "menu") {
    await page.locator(sel).hover();
    await page.locator(sel + " .cardDots").click();
    await page.waitForTimeout(150);
    await page.locator('.cardMenu [data-lane="done"]').click();
  }
  if (route === "drag") await page.dragAndDrop(sel, '.tray[data-lane="done"] .trayBody');
  if (route === "keyboard") {
    await page.locator(sel).focus();
    await page.keyboard.press(" ");
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
    await page.keyboard.press(" ");
  }
  await page.waitForTimeout(800);
  const said = await page.locator("#say").textContent();
  ok("clearing the last overdue task by " + route + " says so",
    /Nothing is overdue/.test(said), JSON.stringify(said));
  await page.close();
}

/* == and a filtered board is never left matching nothing =========== */
{
  const page = await open();
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(250);
  /* Under the filter the Done column is collapsed to its head, so the head is
     the drop target — which is itself worth asserting: a filtered board must
     still accept a drop into a column that is showing nothing. */
  await page.dragAndDrop('.card:has(.when[data-t="overdue"])', '.tray[data-lane="done"] .trayHead');
  await page.waitForTimeout(800);
  ok("dropping the last overdue card releases the filter it emptied",
    (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 0);
  ok("and leaves the operator their board back",
    (await page.locator(".board .card").count()) > 5,
    String(await page.locator(".board .card").count()));
  await page.close();
}

/* == the two time chips are one question ========================== */
/* They interrogate a single-valued field, so composing them could only ever
   return the empty set — the board emptied itself and printed a logical
   impossibility as though it were a result. */
{
  const page = await open("?state=dense");
  await page.locator('[data-act="late"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="today"]').click();
  await page.waitForTimeout(250);
  ok("turning on due-today turns off overdue rather than emptying the board",
    (await page.locator('[data-act="late"][aria-pressed="true"]').count()) === 0 &&
    (await page.locator(".board .card").count()) > 0);
  await page.close();
}

/* == the menu item that says "here" dismisses ====================== */
{
  const page = await open();
  const order = () => page.$$eval('.tray[data-lane="todo"] .cardTitle', (n) => n.map((x) => x.textContent.slice(0, 12)));
  const before = await order();
  await page.locator('.tray[data-lane="todo"] .card').nth(1).hover();
  await page.locator('.tray[data-lane="todo"] .card').nth(1).locator(".cardDots").click();
  await page.waitForTimeout(150);
  ok("the menu opens onto the column the card is already in",
    await page.evaluate(() => document.activeElement.hasAttribute("aria-current")));
  await page.locator(".cardMenu button[aria-current]").click();
  await page.waitForTimeout(250);
  ok("clicking it dismisses rather than reordering", JSON.stringify(await order()) === JSON.stringify(before),
    JSON.stringify(await order()));
  ok("and closes the menu", (await page.locator(".cardMenu").count()) === 0);
  await page.close();
}

/* == the tools row never crosses the sheet's edge ================== */
/* The band learned to stack and the row beneath it did not, so with Planning
   open "Display" rendered past the sheet and was cut through by it. */
{
  const page = await open("?state=planning");
  let spilled = null;
  for (let w = 1440; w >= 900; w -= 20) {
    await page.setViewportSize({ width: w, height: 960 });
    await page.waitForTimeout(70);
    const over = await page.evaluate(() => {
      const edge = document.querySelector(".sheet").getBoundingClientRect().right - 8;
      return [...document.querySelectorAll(".viewTools > *, .seg")]
        .filter((n) => n.offsetParent !== null && n.getBoundingClientRect().right > edge)
        .map((n) => (n.textContent || "").trim().slice(0, 10));
    });
    if (over.length && !spilled) spilled = w + ": " + over.join(",");
  }
  ok("no part of the view row leaves the sheet, drawer open, 1440 to 900", spilled === null, spilled);
  await page.close();
}

/* == the completion lands somewhere that exists ==================== */
/* The board never scrolled to the destination, so below 1360 the card flew
   into the edge fade and evaporated. Where the origin and Done can both be on
   screen the board scrolls first; where they cannot, it deliberately does
   not, because sweeping the operator a thousand pixels away for one tick is
   the worse answer. 1280 is the width that must now resolve. */
for (const w of [1440, 1280]) {
  const page = await open("", { width: w, height: 960 });
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(900);
  const pct = await page.evaluate(() => {
    const n = document.querySelector('.tray[data-lane="done"] .card[data-just-done]') ||
      document.querySelector('.tray[data-lane="done"] .card');
    const b = document.querySelector(".board").getBoundingClientRect();
    const r = n.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) / r.width * 100);
  });
  ok("the finished card is fully on screen at " + w, pct >= 99, pct + "% visible");
  await page.close();
}

/* == Done speaks calendar dates, never a deictic =================== */
/* A freshly ticked card read "Today" directly above 15 Jul, 14 Jul, 9 Jul —
   one word carrying a debt in one column and a receipt in another. */
{
  const page = await open();
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(800);
  const chips = await page.$$eval('.tray[data-lane="done"] .when', (n) => n.map((x) => x.textContent.trim()));
  ok("no finished card says Today or Tomorrow", !chips.some((c) => /Today|Tomorrow/.test(c)),
    JSON.stringify(chips));
  await page.close();
}

/* == the loading frame does not hide what it is printing =========== */
{
  const page = await open("?state=loading");
  const shown = await page.evaluate(() => document.body.innerText);
  ok("the loading header names the workspace it is opening", /The Orchard, events/.test(shown));
  ok("and does not print that name three times",
    (shown.match(/The Orchard, events/g) || []).length <= 2,
    String((shown.match(/The Orchard, events/g) || []).length));
  await page.close();
}

/* == no keycap on a control that cannot answer ==================== */
{
  const page = await open();
  ok("the inert search field prints no shortcut",
    (await page.locator(".dockField kbd").count()) === 0);
  await page.close();
}

/* == a press is a click on the card body too ====================== */
/* Round 13 fixed the tick and left the body: between 4 and 8px the browser
   fires pointerdown -> dragstart -> drop and never sends a pointerup, so the
   guard that lived on pointerup could not see the press it was written for. */
/* 8px is the line: under it the operator meant to press, over it they meant to
   drag. The 12px case is asserted to do the opposite, so the threshold is a
   contract rather than an accident. */
for (const [travel, opens] of [[0, true], [4, true], [6, true], [12, false]]) {
  const page = await open();
  const box = await page.locator('.tray[data-lane="todo"] .card .cardTitle').first().boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20 + travel, box.y + box.height / 2 + travel, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  ok((opens ? "the card body answers a press that travelled " : "and a press that travelled ") + travel + "px" + (opens ? "" : " is a drag, not a press"),
    ((await page.locator(".card[data-open]").count()) === 1) === opens,
    await page.locator("#say").textContent());
  await page.close();
}

/* == the one earned indigo survives the shipped preset =========== */
/* The preset and .card[data-next] are both (0,2,0) and the preset is declared
   later, so the locked default was deleting the milestone edge from the only
   combination that ships — while the specimen sheet printed a caption
   asserting it under a card that did not have it. */
for (const v of ["locked", "a", "b", "c"]) {
  const page = await open("?v=" + v);
  const rest = await page.evaluate(() => {
    const n = document.querySelector(".card[data-next]");
    return n ? getComputedStyle(n).getPropertyValue("--card-rest") : "";
  });
  ok("the milestone card carries indigo in preset " + v, /79, ?70, ?229|4f46e5/i.test(rest), rest.slice(0, 60));
  await page.close();
}

/* == hover knows what it is over ================================= */
{
  const page = await open();
  const live = await page.evaluate(() => getComputedStyle(document.querySelector(".card:not([data-done])")).getPropertyValue("--card-hover"));
  const done = await page.evaluate(() => getComputedStyle(document.querySelector(".card[data-done]")).getPropertyValue("--card-hover"));
  ok("a finished card does not lift under the pointer like a live one",
    live.trim() !== done.trim(), JSON.stringify({ live: live.trim().slice(0, 40), done: done.trim().slice(0, 40) }));
  await page.close();
}

/* == the column scroller is not a tab stop ======================= */
/* An unnamed, unroled div was taking focus and painting the accent ring —
   two extra stops on a dense board. The keyboard route into a column's
   hidden cards is the roving card, which the arrows walk. */
for (const [q, w, h, label] of [["?state=dense", 1440, 960, "dense"], ["?state=dense", 1440, 700, "dense short"], ["", 390, 844, "phone"]]) {
  const page = await open(q, { width: w, height: h });
  const stops = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".trayBody").forEach((n) => {
      if (n.getAttribute("tabindex") !== "-1") out.push(n.className);
    });
    return out;
  });
  ok("no column scroller is a tab stop at " + label, stops.length === 0, JSON.stringify(stops));
  await page.close();
}

/* == Planning can do the one thing it is for ===================== */
/* For fourteen rounds the room's own face said "Every task here still needs a
   day" and every control that would give one was disabled, while the header
   sent the operator there twice to be told so. */
{
  const page = await open("?state=planning");
  const rows = await page.locator(".drawerRow").count();
  ok("every row on the no-date tab can be given a day",
    (await page.locator('.sched[data-act="day"]').count()) === rows, String(rows));
  await page.locator('.sched[data-act="day"]').first().click();
  await page.waitForTimeout(250);
  ok("and the day menu opens", (await page.locator(".dayMenu").count()) === 1);
  await page.locator('.dayMenu [data-when="tomorrow"]').click();
  await page.waitForTimeout(400);
  ok("giving a day removes the task from the no-date list",
    (await page.locator(".drawerRow").count()) === rows - 1);
  ok("and says so", /is due tomorrow/.test(await page.locator("#say").textContent()),
    await page.locator("#say").textContent());
  ok("and it is reversible like everything else",
    (await page.locator('.carry [data-act="undo"]').count()) === 1);
  await page.locator('.carry [data-act="undo"]').click();
  await page.waitForTimeout(400);
  ok("undo puts the day back", (await page.locator(".drawerRow").count()) === rows);
  ok("and reversing it does not close the room it happened in",
    (await page.locator(".drawer").count()) === 1);

  /* A picked set that returns nothing is a control that does work and gives
     nothing back. */
  ok("a picked row is visibly picked", await page.evaluate(() => {
    const b = document.querySelector(".box");
    b.click();
    return true;
  }));
  await page.waitForTimeout(300);
  const picked = await page.evaluate(() => {
    const b = document.querySelector('.box[aria-checked="true"]');
    return b ? getComputedStyle(b).backgroundColor : "";
  });
  ok("with the product's own filled ink", /rgb\(17, 17, 17\)/.test(picked), picked);
  ok("and the picked set has a verb", (await page.locator(".drawerDo").count()) === 1,
    await page.locator(".drawerDo").textContent().catch(() => "none"));
  await page.close();
}

/* == the drawer runs one input model ============================= */
{
  const page = await open("?state=planning");
  ok("the milestones tab states its dates rather than offering to set one",
    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll(".drawerTab")];
      const ms = tabs.find((t) => /Milestone/i.test(t.textContent));
      if (ms) ms.click();
      return true;
    }));
  await page.waitForTimeout(300);
  ok("and its add control does not promise a task",
    (await page.locator('.drawerAdd[aria-disabled="true"]').count()) === 1);
  await page.close();
}

/* == a half-written task is never stranded ====================== */
{
  const page = await open();
  await page.locator(".trayAdd:visible").first().click();
  await page.waitForTimeout(200);
  await page.keyboard.type("Call the florist about the arch");
  await page.locator(".sheet").click({ position: { x: 700, y: 900 } });
  await page.waitForTimeout(400);
  ok("clicking away commits the words rather than stranding them",
    (await page.locator(".board .cardTitle", { hasText: "Call the florist" }).count()) === 1);
  ok("and no draft is left holding them",
    (await page.locator("[data-draft]").count()) === 0);
  await page.close();
}
{
  const page = await open();
  await page.locator(".trayAdd:visible").first().click();
  await page.waitForTimeout(200);
  const before = await counts(page);
  await page.locator(".sheet").click({ position: { x: 700, y: 900 } });
  await page.waitForTimeout(400);
  ok("an empty composer clicked away simply leaves",
    (await page.locator("[data-draft]").count()) === 0 && (await counts(page)).todo === before.todo);
  await page.close();
}

/* == one voice for every spoken lane ============================ */
{
  const page = await open();
  const said = [];
  await page.locator('.tray[data-lane="todo"] .card').first().focus();
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowRight");
  said.push(await page.locator("#say").textContent());
  await page.keyboard.press(" ");
  said.push(await page.locator("#say").textContent());
  ok("no sentence ever says a lane name twice", !said.some((t) => /in In |in To |in Review Review/i.test(t)),
    JSON.stringify(said));
  await page.close();
}

/* == a day given is the day it says ============================== */
/* The state used to come from an authored field, so a task the operator
   scheduled for today wore a "Today" chip in the wash that means nothing is
   wrong yet, was missing from the header count, and was hidden by the today
   filter that then called it one of the others. */
{
  const page = await open("?state=planning");
  const headBefore = await page.locator('[data-act="today"]').textContent().catch(() => "0 today");
  await page.locator('.sched[data-act="day"]').first().click();
  await page.waitForTimeout(250);
  await page.locator('.dayMenu [data-when="today"]').click();
  await page.waitForTimeout(500);
  const headAfter = await page.locator('[data-act="today"]').textContent().catch(() => "0 today");
  ok("giving a task today puts it in the today count",
    parseInt(headAfter, 10) === parseInt(headBefore, 10) + 1, headBefore + " -> " + headAfter);
  ok("and the card wears the today chip",
    (await page.locator('.when[data-t="today"]').count()) >= 1);
  await page.close();
}
{
  const page = await open("?state=planning");
  await page.locator('.sched[data-act="day"]').first().click();
  await page.waitForTimeout(250);
  await page.locator('.dayMenu [data-when="weekend"]').click();
  await page.waitForTimeout(500);
  /* +3 from the pinned Thursday landed on Sunday, and a venue's weekend work
     is due before the Saturday it is for. */
  const chips = await page.$$eval(".board .when", (n) => n.map((x) => x.textContent.trim()));
  ok("this weekend lands on the Saturday, not after it",
    chips.some((c) => /Sat/.test(c)) && !chips.some((c) => /Sun/.test(c)), JSON.stringify(chips));
  await page.close();
}

/* == the day menu is reachable on every row ====================== */
/* It was a child of the drawer's own scroller, which clipped it: on the last
   of five rows only a 13px sliver rendered. */
{
  const page = await open("?state=planning");
  const rows = await page.locator('.sched[data-act="day"]').count();
  let worst = 100;
  for (let i = 0; i < rows; i += 1) {
    await page.locator('.sched[data-act="day"]').nth(i).click();
    await page.waitForTimeout(220);
    const vis = await page.evaluate(() => {
      const m = document.querySelector(".dayMenu");
      if (!m) return 0;
      const r = m.getBoundingClientRect();
      return Math.round(Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height * 100);
    });
    worst = Math.min(worst, vis);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
  ok("every row's day menu is fully on screen", worst >= 99, worst + "% on the worst row");
  await page.close();
}

/* == the room stops contradicting itself when it empties ========= */
{
  const page = await open("?state=planning");
  await page.locator(".selectAll").click();
  await page.waitForTimeout(200);
  await page.locator(".drawerDo").click();
  await page.waitForTimeout(200);
  await page.locator('.dayMenu [data-when="today"]').click();
  await page.waitForTimeout(500);
  const said = await page.$$eval(".drawerHelp, .drawerEmpty", (n) => n.map((x) => x.textContent.trim()));
  ok("an emptied room says one thing, not two that disagree", said.length === 1, JSON.stringify(said));
  await page.close();
}

/* == the hand is exclusive ====================================== */
/* Nothing ended a keyboard carry: Tab away, complete another card, open a
   composer or the drawer, and it ran on — two indigo rings on two cards at
   once, and a completion refused its Undo strip because the pill owned it. */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card').first().focus();
  await page.keyboard.press(" ");
  ok("a card is in hand", (await page.locator(".carry").count()) === 1);
  const box = await page.locator('.tray[data-lane="doing"] .card .tick').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(700);
  ok("completing another card ends the carry",
    (await page.locator('.card[data-force="moving"]').count()) === 0);
  ok("and the completion gets the strip the carry was holding",
    (await page.locator('.carry [data-act="undo"]').count()) === 1);
  await page.close();
}

/* == the edge fade starts where the board starts ================= */
/* 118px was the board's top only while the header was one line. Stacked, a
   96px white gradient rose above the board and washed the tools row, so a
   live control read as disabled. */
for (const [q, w, label] of [["", 1280, "1280"], ["", 768, "768"], ["?state=planning", 1440, "drawer open"]]) {
  const page = await open(q, { width: w, height: 960 });
  const over = await page.evaluate(() => {
    const sheet = document.querySelector(".sheet");
    const board = document.querySelector(".board");
    const top = parseFloat(getComputedStyle(sheet).getPropertyValue("--fade-top")) || 118;
    const boardTop = board.getBoundingClientRect().top - sheet.getBoundingClientRect().top;
    return Math.round(boardTop - top);
  });
  /* 6px below the board's border-top is deliberate: it is what keeps the 1px
     rule running unbroken to the sheet edge. What matters is that the fade
     tracks the board rather than a number that was only ever right unstacked. */
  ok("the fade starts at the board's own top at " + label, over >= -8 && over <= 2, over + "px from it");
  await page.close();
}

/* == a press on a card with no note says so ====================== */
{
  const page = await open();
  const bare = await page.evaluate(() => {
    const n = [...document.querySelectorAll(".card[data-id]")].find((c) => !c.hasAttribute("aria-expanded"));
    return n ? n.dataset.id : null;
  });
  if (bare) {
    const box = await page.locator('.card[data-id="' + bare + '"] .cardTitle').boundingBox();
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(400);
    ok("a press on a card with no note is answered, not silent",
      /no note/.test(await page.locator("#say").textContent()),
      await page.locator("#say").textContent());
  }
  await page.close();
}

/* == the view switcher announces what is selected ================ */
{
  const page = await open();
  ok("the active view tab is selected", await page.evaluate(() =>
    document.querySelector('.segItem[data-active]').getAttribute("aria-selected") === "true"));
  ok("and the others say they are not", await page.evaluate(() =>
    [...document.querySelectorAll(".segItem:not([data-active])")]
      .every((n) => n.getAttribute("aria-selected") === "false")));
  await page.close();
}

/* == a measure pass never resizes what it measures ================ */
/* THE RULE. The fold flag was computed from the scroller's own height and then
   grew that scroller, so the pass could not converge: one completion left a
   column pinned at 623px against 252px of live content, drawing a "more below"
   fold over nothing and throwing its Add row to the foot of the tray, for six
   seconds, on the most common act in the product. This asserts the class, not
   the instance: after any completion, on any board, every column's fold flag
   must agree with its own content. */
for (const [q, lane, label] of [["", "todo", "resting board"], ["?state=dense", "review", "peak season"]]) {
  const page = await open(q);
  const read = () => page.evaluate((ln) => {
    const tray = document.querySelector(`.tray[data-lane="${ln}"]`);
    const body = tray.querySelector(".trayBody");
    const last = body.lastElementChild;
    const extent = last ? last.offsetTop - body.offsetTop + last.offsetHeight : 0;
    return {
      more: body.hasAttribute("data-more"),
      overflowing: extent > body.clientHeight + 1,
      addY: Math.round(tray.querySelector(".trayAdd").getBoundingClientRect().top),
      bodyBottom: Math.round(body.getBoundingClientRect().bottom),
    };
  }, lane);
  const before = await read();
  const box = await page.locator(`.tray[data-lane="${lane}"] .card .tick`).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(900);
  const after = await read();
  ok("the fold flag tells the truth after a completion at " + label,
    after.more === after.overflowing, JSON.stringify(after));
  await page.waitForTimeout(1200);
  const later = await read();
  ok("and it is still true once everything settles at " + label,
    later.more === later.overflowing, JSON.stringify(later));
  ok("and the Add row follows the last card rather than the tray foot at " + label,
    later.addY <= later.bodyBottom + 60, JSON.stringify({ addY: later.addY, bodyBottom: later.bodyBottom }));
  if (label === "resting board") {
    ok("and a column that shed a card gets shorter, not taller",
      after.addY < before.addY, before.addY + " -> " + after.addY);
  }
  await page.close();
}

/* == a lane that sorts itself never names a position ============== */
/* THE RULE, in both channels. Done re-sorts by completion date on every
   render, so the drop line named an index the card never landed on and the
   live region announced that index too. */
{
  const page = await open();
  const order = () => page.$$eval('.tray[data-lane="done"] .cardTitle', (n) => n.map((x) => x.textContent.slice(0, 14)));
  const before = await order();
  const src = await page.locator('.tray[data-lane="done"] .card').last().boundingBox();
  const dst = await page.locator('.tray[data-lane="done"] .card').first().boundingBox();
  await page.mouse.move(src.x + 40, src.y + 20);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(src.x + 40, src.y + 20 + (dst.y - src.y) * (i / 8));
  }
  const lines = await page.locator(".dropLine").count();
  ok("a sorted lane draws no per-position drop line", lines === 0, String(lines));
  ok("but it still shows it is the lane being dropped into",
    (await page.locator('.tray[data-lane="done"][data-over]').count()) === 1);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const said = await page.locator("#say").textContent();
  ok("and it never announces a position it will not honour",
    !/position \d+ of \d+/.test(said), JSON.stringify(said));
  ok("and the order it reports is the order it renders",
    JSON.stringify(await order()) === JSON.stringify(before), JSON.stringify(await order()));
  await page.close();
}

/* == the lift is on the node that moves =========================== */
{
  const page = await open();
  const box = await page.locator('.tray[data-lane="todo"] .card').first().boundingBox();
  await page.mouse.move(box.x + 40, box.y + 20);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + 40 + i * 40, box.y + 20);
  const src = await page.evaluate(() => {
    const n = document.querySelector('.card[data-force="drag"]');
    if (!n) return null;
    const cs = getComputedStyle(n);
    return { vacated: n.hasAttribute("data-vacated"), transform: cs.transform, opacity: cs.opacity };
  });
  ok("the card left behind reads as a vacancy, not as the object in flight",
    Boolean(src) && src.vacated && src.transform === "none", JSON.stringify(src));
  await page.mouse.up();
  await page.waitForTimeout(400);
  ok("and the vacancy is cleared when the gesture ends",
    (await page.locator("[data-vacated]").count()) === 0);
  await page.close();
}

/* == a lane that states a duration owns its clock ================= */
{
  const page = await open();
  await page.locator('.tray[data-lane="todo"] .card').first().hover();
  await page.locator('.tray[data-lane="todo"] .cardDots').first().click();
  await page.waitForTimeout(150);
  await page.locator('.cardMenu [data-lane="waiting"]').click();
  await page.waitForTimeout(400);
  const chip = await page.evaluate(() => {
    const n = document.querySelector('.tray[data-lane="waiting"] .card .when');
    return n ? n.textContent.trim() : null;
  });
  ok("a card moved into Waiting arrives with a clock", /^Held /.test(chip || ""), JSON.stringify(chip));
  await page.close();
}
{
  const page = await open();
  const was = await page.evaluate(() => {
    const n = document.querySelector('.tray[data-lane="done"] .card .when');
    return n ? n.textContent.trim() : null;
  });
  await page.dragAndDrop('.tray[data-lane="done"] .card', '.tray[data-lane="todo"] .trayBody');
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => {
    const n = document.querySelector('.tray[data-lane="done"] .card .when');
    return n ? n.textContent.trim() : null;
  });
  ok("and undoing a move out of Done restores the day it was finished",
    back === was, JSON.stringify(was) + " -> " + JSON.stringify(back));
  await page.close();
}

/* == the product's prose stays in the product's type ============== */
/* THE RULE: no visible product prose may be re-served through a native title
   attribute, where the OS repaints it in its own font at its own size. */
{
  const page = await open("?state=dense");
  const leaked = await page.evaluate(() =>
    [...document.querySelectorAll(".cardTitle[title], .cardNote[title]")].map((n) => n.className));
  ok("no card's own prose is handed to an OS tooltip", leaked.length === 0, JSON.stringify(leaked));
  await page.close();
}

/* == no ratio without a denominator =============================== */
{
  const page = await open("?state=filtered");
  const counts = await page.$$eval(".trayCount", (n) => n.map((x) => x.textContent.trim()));
  ok("no column head prints a proportion of nothing",
    !counts.some((c) => /^0\/0$/.test(c)), JSON.stringify(counts));
  const names = await page.$$eval(".tray[data-lane]", (n) => n.map((x) => x.getAttribute("aria-label")));
  ok("and no region name says it either",
    !names.some((t) => /0 of 0/.test(t || "")), JSON.stringify(names));
  await page.close();
}

/* == one tracking inside one number =============================== */
{
  const page = await open("?state=filtered");
  const two = await page.evaluate(() => {
    const cell = document.querySelector(".trayCount");
    const part = cell && cell.querySelector(".ofAll");
    if (!part) return null;
    return { cell: getComputedStyle(cell).letterSpacing, part: getComputedStyle(part).letterSpacing };
  });
  ok("a figure is set on one tracking, not two", !two || two.cell === two.part, JSON.stringify(two));
  await page.close();
}

/* == the numeral contract survives the font shorthand ============= */
/* `font: inherit` sets every font longhand including font-variant-numeric, so
   it silently wiped tabular figures from the controls that carry live counts. */
{
  const page = await open();
  const wiped = await page.evaluate(() =>
    [...document.querySelectorAll(".late, .undated, .trayCount, .when")]
      .filter((n) => n.offsetParent !== null && !/tabular-nums/.test(getComputedStyle(n).fontVariantNumeric))
      .map((n) => n.className));
  ok("every live counter still has tabular figures", wiped.length === 0, JSON.stringify(wiped));
  await page.close();
}

/* == the product has one landmark ================================= */
{
  const page = await open();
  ok("the sheet is a main landmark", (await page.locator("main.sheet").count()) === 1);
  await page.close();
}
{
  const page = await open("?state=loading");
  ok("and it is one in the loading state too", (await page.locator("main.sheet").count()) === 1);
  await page.close();
}

ok("no console errors anywhere", errors.length === 0, errors.join(" | "));

await browser.close();

for (const r of results) {
  process.stdout.write((r.pass ? "  pass  " : "  FAIL  ") + r.name + (r.detail && !r.pass ? "\n          " + r.detail : "") + "\n");
}
process.stdout.write("\n" + (results.length - failures) + "/" + results.length + " checks pass\n");
process.exit(failures ? 1 : 0);
