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
  ok("the chip states the filter", (await page.locator(".late").textContent()).startsWith("Showing"));
  ok("the header stops asserting a total", (await page.locator(".ratio").count()) === 0);
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
  const named = await page.$$eval(".board .card", (n) => n.filter((c) => !c.getAttribute("aria-labelledby")).length);
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

ok("no console errors anywhere", errors.length === 0, errors.join(" | "));

await browser.close();

for (const r of results) {
  process.stdout.write((r.pass ? "  pass  " : "  FAIL  ") + r.name + (r.detail && !r.pass ? "\n          " + r.detail : "") + "\n");
}
process.stdout.write("\n" + (results.length - failures) + "/" + results.length + " checks pass\n");
process.exit(failures ? 1 : 0);
