/* Does it open, and does it say anything on the way? */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = pathToFileURL(path.join(LAB, "_wrapped.html")).href;
const q = process.argv[2] || "";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const noise = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") noise.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => noise.push("pageerror: " + e.message));

await page.goto(url + q);
await page.waitForTimeout(700);

const shape = await page.evaluate(() => {
  const deck = document.getElementById("deck");
  const app = (k) => document.querySelector(`[data-app="${k}"]`);
  const box = (el) => (el ? el.getBoundingClientRect() : null);
  return {
    product: deck && deck.getAttribute("data-product"),
    rails: document.querySelectorAll(".rail").length,
    railTiles: [...document.querySelectorAll(".rail [data-rail]")].map((b) => b.dataset.rail),
    active: [...document.querySelectorAll(".rail [data-active]")].map((b) => b.dataset.rail),
    sheets: document.querySelectorAll(".sheet").length,
    visibleSheets: [...document.querySelectorAll(".sheet")].filter((s) => s.getBoundingClientRect().width > 0).length,
    tasksChildren: app("tasks") ? app("tasks").children.length : -1,
    notesChildren: app("notes") ? app("notes").children.length : -1,
    tlChildren: document.getElementById("tl") ? document.getElementById("tl").children.length : -1,
    deckBg: getComputedStyle(document.body).backgroundColor,
    sheetBox: box(document.querySelector('[data-app="tasks"] .sheet')),
    railBox: box(document.querySelector(".rail")),
    say: (document.getElementById("say") || {}).textContent,
    sayCount: document.querySelectorAll("#say").length,
    world: window.WORLD && window.WORLD.today,
    notesToday: window.NOTES && window.NOTES.today,
    ledger: window.NOTES ? window.NOTES.crossed.map((c) => c.lane) : null,
  };
});

console.log(JSON.stringify(shape, null, 2));
console.log(noise.length ? "\nCONSOLE:\n" + noise.join("\n") : "\nconsole clean");
await browser.close();
