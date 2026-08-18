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
      o[t.dataset.lane] = t.querySelectorAll(".card").length;
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
  await page.locator(".late").click();
  await page.waitForTimeout(150);
  /* The chip is the value in both states; aria-pressed and the close glyph
     carry "this is on" and "this is the way out", so the foot strip is the
     only place the filter is stated in words. */
  ok("the chip stays the value", (await page.locator(".late").textContent()).trim().startsWith("1 overdue"));
  ok("and reads as pressed", (await page.locator('.late[aria-pressed="true"]').count()) === 1);
  ok("the standing project facts stay put", (await page.locator(".ratio").count()) === 1);
  ok("a way back is on screen", (await page.locator('.carry [data-act="showall"]').count()) === 1);
  const lines = await page.$$eval(".trayEmpty", (n) => n.map((x) => x.textContent));
  ok("the board says it once, not five times", lines.length <= 1, JSON.stringify(lines));

  /* Clearing the last overdue task while filtered used to brick the board. */
  await page.locator(".board .card .tick").first().click();
  await page.waitForTimeout(320);
  ok("clearing the last overdue task releases the filter", (await page.locator('.late[aria-pressed="true"]').count()) === 0);
  ok("the board comes back", (await page.locator(".board .card").count()) > 5);
  await page.close();

  const two = await open();
  await two.locator(".late").click();
  await two.waitForTimeout(120);
  await two.keyboard.press("Escape");
  await two.waitForTimeout(150);
  ok("escape clears the filter", (await two.locator('.late[aria-pressed="true"]').count()) === 0);
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
  const stops = await page.locator('.board [tabindex="0"]').count();
  ok("the board is a roving tab stop", stops <= 3, stops + " stops");
  const dense = await open("?state=dense");
  const denseStops = await dense.locator('.board [tabindex="0"]').count();
  const denseAll = await dense.locator(".board button, .board .card").count();
  ok("and stays one at peak density", denseStops <= 3, denseStops + " of " + denseAll + " focusables");
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
  ok("un-completing names the lane it came from", said.indexOf("Review") !== -1, said);
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
  ok("and it says so", (await page.locator("#say").textContent()).indexOf("added to To do") !== -1);
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
  await page.locator(".late").click();
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
  await page.locator(".late").click();
  await page.waitForTimeout(200);
  await page.locator('.tray[data-lane="todo"] .trayAdd').click();
  await page.waitForTimeout(200);
  await page.keyboard.type("Order more ice for Saturday");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok("the filter releases so the new task can be seen",
    (await page.locator('.late[aria-pressed="true"]').count()) === 0);
  ok("and it is on screen", (await page.locator(".board .cardTitle", { hasText: "Order more ice" }).count()) === 1);
  ok("and the board says why", (await page.locator("#say").textContent()).indexOf("filter is off") !== -1);
  await page.close();
}

/* ── the filtered board does not describe what it is not showing ──── */
{
  const page = await open();
  await page.locator(".late").click();
  await page.waitForTimeout(250);
  const notes = await page.$$eval(".trayNote", (n) => n.map((x) => x.textContent));
  ok("no column claims to hold what it is hiding",
    notes.every((t) => t.toLowerCase().indexOf("overdue") !== -1), JSON.stringify(notes));
  const count = await page.locator('.tray[data-lane="todo"] .trayCount').textContent();
  ok("the count states filtered of total", count.indexOf(" of ") !== -1, JSON.stringify(count));
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

ok("no console errors anywhere", errors.length === 0, errors.join(" | "));

await browser.close();

for (const r of results) {
  process.stdout.write((r.pass ? "  pass  " : "  FAIL  ") + r.name + (r.detail && !r.pass ? "\n          " + r.detail : "") + "\n");
}
process.stdout.write("\n" + (results.length - failures) + "/" + results.length + " checks pass\n");
process.exit(failures ? 1 : 0);
