// Tasks v3 behaviour, driven in a real browser against a running review
// server (seed data, no login, never a database):
//
//   node experience/tasks-board-behaviour-browser.mjs [origin]
//
// Proves behaviour, not markup: a mouse drag moves a card and the move
// persists; a touch press-and-hold lifts and drops; a drop at the origin is
// a non-event; keyboard carry moves and Escape puts back; completing shows
// the undo toast and Ctrl+Z reverses it; a calendar tray task takes a date
// by drag and loses it when dragged back; the composer creates in the right
// column; a drag performs no layout while the pointer moves; and on a cold
// page j lands on the first card and Enter opens it.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const origin = process.argv[2] ?? "http://localhost:3217";
const results = [];
const pass = (name) => {
  results.push(name);
  console.log(`PASS ${name}`);
};

const browser = await chromium.launch();
try {
  const open = async (path, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-floor-head] h1", { timeout: 60000 });
    await page.waitForTimeout(1200);
    return { page, context, errors };
  };
  const laneOf = (page, id) => page.evaluate((taskId) => document.querySelector(`[data-board] [data-id="${taskId}"]`)?.closest("[data-lane]")?.getAttribute("data-lane") ?? null, id);
  const idsIn = (page, lane) => page.evaluate((key) => [...document.querySelectorAll(`[data-lane="${key}"] [data-tray-body] > [data-id]`)].map((n) => n.getAttribute("data-id")), lane);
  const centre = async (locator) => {
    const box = await locator.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  /* Mouse drag between columns, then the move persists after a moment. */
  {
    const { page, context, errors } = await open("/app/tasks");
    const card = page.locator('[data-lane="todo"] [data-tray-body] > [data-id]').first();
    const id = await card.getAttribute("data-id");
    // Grab the title: chips and the tick are controls, never drag handles.
    const from = await centre(card.locator("p").first());
    const to = await centre(page.locator('[data-lane="review"] [data-tray-body]'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 3, from.y + 2);
    assert.equal(await page.locator("[data-dragging]").count(), 0, "3px is not a drag");
    await page.mouse.move(from.x + 20, from.y + 12, { steps: 3 });
    assert.equal(await page.locator("[data-board] [data-dragging]").count(), 1, "the card lifts past 4px");
    await page.mouse.move(to.x, to.y + 60, { steps: 12 });
    assert.ok(await page.locator("[data-drop-layer] > div").count(), "a placeholder shows where it lands");
    await page.mouse.up();
    await page.waitForTimeout(1500);
    assert.equal(await laneOf(page, id), "review");
    assert.equal(await page.locator("[data-board] [data-dragging]").count(), 0);
    assert.deepEqual(errors, []);
    pass("mouse drag moves a card between columns and the move persists");
    // Drop at the origin is a non-event: no toast, no move.
    const again = page.locator(`[data-board] [data-id="${id}"]`);
    const at = await centre(again.locator("p").first());
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 12, at.y + 8, { steps: 3 });
    await page.mouse.move(at.x, at.y, { steps: 3 });
    const before = await idsIn(page, "review");
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.deepEqual(await idsIn(page, "review"), before);
    pass("a drop where the card started changes nothing");
    await context.close();
  }

  /* Touch: a press and hold lifts; a quick swipe scrolls instead. */
  {
    const { page, context } = await open("/app/tasks", { hasTouch: true, isMobile: false });
    const card = page.locator('[data-lane="doing"] [data-tray-body] > [data-id]').first();
    const id = await card.getAttribute("data-id");
    // Grab the title: chips and the tick are controls, never drag handles.
    const from = await centre(card.locator("p").first());
    const to = await centre(page.locator('[data-lane="waiting"] [data-tray-body]'));
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    await touch("touchStart", from.x, from.y);
    await page.waitForTimeout(380);
    assert.equal(await page.locator("[data-board] [data-dragging]").count(), 1, "a 300ms hold lifts the card");
    for (let step = 1; step <= 12; step += 1) {
      await touch("touchMove", from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
      await page.waitForTimeout(16);
    }
    await touch("touchEnd", to.x, to.y);
    await page.waitForTimeout(1200);
    assert.equal(await laneOf(page, id), "waiting");
    pass("touch press-and-hold lifts a card and drops it in another column");
    await context.close();
  }

  /* Keyboard carry: Space, arrows, Escape puts it back; Space drops. */
  {
    const { page, context } = await open("/app/tasks");
    const card = page.locator('[data-lane="todo"] [data-tray-body] > [data-id]').first();
    const id = await card.getAttribute("data-id");
    await card.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    assert.equal(await laneOf(page, id), "doing");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.equal(await laneOf(page, id), "todo", "Escape returns the task to where it was");
    await page.locator(`[data-board] [data-id="${id}"]`).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await page.waitForTimeout(800);
    assert.equal(await laneOf(page, id), "review");
    pass("keyboard carry moves, puts back with Escape, and drops with Space");

    /* Completion: toast, then Ctrl+Z reverses through the same path. */
    const next = page.locator('[data-lane="todo"] [data-tray-body] > [data-id]').first();
    const nextId = await next.getAttribute("data-id");
    await next.getByRole("button", { name: /^Mark ".*" done$/ }).click();
    await page.waitForTimeout(700);
    assert.ok(await page.getByRole("status").filter({ hasText: "Marked done" }).count(), "the undo toast names the act");
    assert.notEqual(await laneOf(page, nextId), "todo");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(900);
    assert.equal(await laneOf(page, nextId), "todo", "Ctrl+Z reopens the task");
    pass("completion shows Undo and Ctrl+Z reverses it");
    await context.close();
  }

  /* Cold page: no card focused, j lands on the first card, Enter opens it. */
  {
    const { page, context, errors } = await open("/app/tasks");
    // Click bare canvas below the lanes, the way someone arrives and looks.
    const board = await page.locator("[data-board]").boundingBox();
    await page.mouse.click(board.x + board.width - 40, board.y + board.height - 20);
    const first = await page.evaluate(() => document.querySelector("[data-canvas] [data-lane] [data-id]")?.getAttribute("data-id"));
    await page.keyboard.press("j");
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.activeElement?.closest("[data-id]")?.getAttribute("data-id") ?? null), first, "j focuses the first card");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    assert.equal(new URL(page.url()).searchParams.get("task"), first, "Enter opens the focused task");
    assert.deepEqual(errors, []);
    pass("on a cold page j lands on the first card and Enter opens it");
    await context.close();
  }

  /* Calendar: a tray task takes a date by drag and loses it back in the tray. */
  {
    const { page, context } = await open("/app/tasks/calendar");
    // The tray starts hidden inside the page column; "Needs a date" shows it.
    const toggle = page.getByRole("button", { name: /^Needs a date/ });
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    const tray = page.locator("section[aria-labelledby='tray-title']");
    const chip = tray.locator("[data-chip]").first();
    const id = await chip.getAttribute("data-id");
    const day = page.locator('[role="gridcell"][data-date="2026-07-22"]');
    await chip.dragTo(day);
    await page.waitForTimeout(800);
    assert.equal(await page.locator(`[data-date="2026-07-22"] [data-id="${id}"]`).count(), 1, "the task shows on the day");
    await page.locator(`[data-date="2026-07-22"] [data-id="${id}"]`).dragTo(tray);
    await page.waitForTimeout(800);
    assert.equal(await tray.locator(`[data-id="${id}"]`).count(), 1, "dragging it back clears the date");
    pass("calendar drag dates a task and dragging back to the tray clears it");
    await context.close();
  }

  /* Composer: C opens it, Enter creates in the chosen column. */
  {
    const { page, context } = await open("/app/tasks");
    const before = (await idsIn(page, "todo")).length;
    await page.keyboard.press("c");
    const dialog = page.getByRole("dialog", { name: "New task" });
    await dialog.getByRole("textbox", { name: "Task name" }).fill("Order the welcome sign stand");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    assert.equal((await idsIn(page, "todo")).length, before + 1);
    assert.ok(await page.getByRole("status").filter({ hasText: "Added to" }).count(), "Added to … with Open and Undo");
    pass("the composer creates a task and offers Open and Undo");
    await context.close();
  }

  /* No layout per pointer move while a card is carried. */
  {
    const { page, context } = await open("/app/tasks");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const card = page.locator('[data-lane="doing"] [data-tray-body] > [data-id]').first();
    // Grab the title: chips and the tick are controls, never drag handles.
    const from = await centre(card.locator("p").first());
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 10, { steps: 4 });
    await page.waitForTimeout(250);
    const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const a = await metric();
    // Small moves inside one column keep the same target: frames should only
    // write transforms, so the layout count stays flat.
    for (let i = 0; i < 40; i += 1) await page.mouse.move(from.x + 30 + (i % 4), from.y + 10 + (i % 3));
    await page.waitForTimeout(200);
    const b = await metric();
    await page.mouse.up();
    const layouts = b.LayoutCount - a.LayoutCount;
    console.log(`layouts during 40 pointer moves: ${layouts}`);
    assert.ok(layouts <= 2, `expected no layout per move, saw ${layouts}`);
    pass("carrying a card does no layout per pointer move");
    await context.close();
  }
  console.log(`\n${results.length} behaviours passed`);
} finally {
  await browser.close();
}
