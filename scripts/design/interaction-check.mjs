import { chromium } from "@playwright/test";
import path from "node:path";
const url = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:1 });
const errs = [];
p.on("pageerror", e => errs.push(String(e)));
p.on("console", m => m.type()==="error" && errs.push(m.text()));
await p.goto(url); await p.waitForTimeout(400);

const count = async () => p.evaluate(() => {
  const o = {};
  document.querySelectorAll(".tray[data-lane]").forEach(t =>
    o[t.dataset.lane] = t.querySelectorAll(".card").length);
  return o;
});
console.log("start        ", JSON.stringify(await count()));

// 1. tick completes
await p.locator('.tray[data-lane="todo"] .card .tick').first().click();
await p.waitForTimeout(300);
console.log("after tick   ", JSON.stringify(await count()), "| said:", await p.locator("#say").textContent());

// 2. keyboard: focus the first To Do card, pick it up, walk it right, drop
await p.locator('.tray[data-lane="todo"] .card').first().focus();
await p.keyboard.press(" ");
console.log("picked up    ", await p.locator("#say").textContent(), "| carry bar:", await p.locator(".carry").count());
await p.keyboard.press("ArrowRight");
await p.keyboard.press("ArrowRight");
await p.keyboard.press(" ");
await p.waitForTimeout(120);
console.log("after move   ", JSON.stringify(await count()), "| said:", await p.locator("#say").textContent());
console.log("focus kept   ", await p.evaluate(() => document.activeElement.className), "| carry gone:", await p.locator(".carry").count());

// 3. escape puts it back exactly where it was
await p.keyboard.press(" ");
await p.keyboard.press("ArrowLeft");
await p.keyboard.press("ArrowDown");
await p.keyboard.press("Escape");
await p.waitForTimeout(120);
console.log("after cancel ", JSON.stringify(await count()), "| said:", await p.locator("#say").textContent());

// 4. the overdue chip filters
await p.locator(".late").click(); await p.waitForTimeout(150);
console.log("late only    ", JSON.stringify(await count()), "| pressed:", await p.locator(".late").getAttribute("aria-pressed"));
await p.locator(".late").click(); await p.waitForTimeout(150);
console.log("all again    ", JSON.stringify(await count()));

// 5. one tab stop for the whole board
console.log("board stops  ", await p.locator('.board [tabindex="0"]:visible').count(),
            "| of focusables:", await p.locator('.board button, .board .card').count());

// 5b. pointer drag
await p.dragAndDrop('.tray[data-lane="doing"] .card >> nth=0', '.tray[data-lane="waiting"] .trayBody');
await p.waitForTimeout(150);
console.log("after drag   ", JSON.stringify(await count()), "| said:", await p.locator("#say").textContent());

// 6. edge measurement, at the density that broke
await p.goto(url + "?state=dense"); await p.waitForTimeout(400);
console.log("dense fades  ", await p.locator(".trayBody[data-more]").count(), "of", await p.locator(".trayBody").count());
console.log("dense stops  ", await p.locator('.board [tabindex="0"]:visible').count(),
            "| of focusables:", await p.locator('.board button, .board .card').count());

console.log(errs.length ? "ERRORS " + errs.join(" | ") : "no console errors");
await b.close();
