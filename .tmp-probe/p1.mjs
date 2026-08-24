import { chromium } from "@playwright/test";
import path from "node:path";
const URL = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 960 } });
page.on("pageerror", e => console.log("PAGEERROR", String(e)));
await page.goto(URL + "?state=planning");
await page.waitForTimeout(400);

// header before
const before = await page.evaluate(() => document.querySelector(".headFacts").innerText.replace(/\n/g," | "));
console.log("HEAD BEFORE:", before);

// open first row day menu
await page.locator(".drawerRow .sched").first().click();
await page.waitForTimeout(150);
console.log("dayMenu open:", await page.locator(".dayMenu").count());
// which task
const t0 = await page.locator(".drawerRow").first().innerText();
console.log("row0:", t0.replace(/\n/g," | "));
// give Today
await page.locator('.dayMenu [data-when="today"]').click();
await page.waitForTimeout(300);
console.log("SAY:", await page.locator("#say").textContent());
console.log("HEAD AFTER:", await page.evaluate(() => document.querySelector(".headFacts").innerText.replace(/\n/g," | ")));
console.log("ACTIVE AFTER SETDAY:", await page.evaluate(() => {
  const a = document.activeElement;
  return a.tagName + "." + a.className + " | inDrawer=" + !!a.closest(".drawer") + " | text=" + (a.innerText||"").slice(0,40);
}));
// find that card's chip
console.log("CHIPS:", await page.evaluate(() => [...document.querySelectorAll(".when")].map(n => n.dataset.t + ":" + n.innerText.trim()).join(", ")));
await b.close();
