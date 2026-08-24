import { chromium } from "@playwright/test";
import path from "node:path";
const URL = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 960 } });
page.on("pageerror", e => console.log("PAGEERROR", String(e)));
await page.goto(URL + "?state=planning");
await page.waitForTimeout(400);

// --- day menu keyboard model vs card menu
await page.locator(".drawerRow .sched").first().focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
console.log("after Enter, active:", await page.evaluate(() => document.activeElement.className + "|" + document.activeElement.innerText.slice(0,20)));
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
console.log("after ArrowDown, active:", await page.evaluate(() => document.activeElement.className + "|" + document.activeElement.innerText.slice(0,20)));
console.log("dayMenu tabindexes:", await page.evaluate(() => [...document.querySelectorAll(".dayMenu button")].map(n=>n.getAttribute("tabindex")).join(",")));
console.log("cardMenu idiom check: dayMenu role=", await page.evaluate(()=>document.querySelector(".dayMenu").getAttribute("role")));
// tab through
for (let i=0;i<3;i++){ await page.keyboard.press("Tab"); }
console.log("after 3 tabs, active:", await page.evaluate(() => document.activeElement.className + "|" + document.activeElement.innerText.slice(0,20)));
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
console.log("after Esc, dayMenu count:", await page.locator(".dayMenu").count(), "active:", await page.evaluate(()=>document.activeElement.className||document.activeElement.tagName));

// --- last row menu clipping
await page.goto(URL + "?state=planning");
await page.waitForTimeout(400);
const rows = await page.locator(".drawerRow .sched").count();
console.log("rows:", rows);
await page.locator(".drawerRow .sched").nth(rows-1).click();
await page.waitForTimeout(250);
console.log(await page.evaluate(() => {
  const m = document.querySelector(".drawerRow .dayMenu");
  const rowsBox = document.querySelector(".drawerRows").getBoundingClientRect();
  const dr = document.querySelector(".drawer").getBoundingClientRect();
  const mb = m.getBoundingClientRect();
  return JSON.stringify({up: m.hasAttribute("data-up"), menuTop: Math.round(mb.top), menuBottom: Math.round(mb.bottom), rowsTop: Math.round(rowsBox.top), rowsBottom: Math.round(rowsBox.bottom), drawerBottom: Math.round(dr.bottom), rowsOverflow: document.querySelector(".drawerRows").scrollHeight + ">" + document.querySelector(".drawerRows").clientHeight});
}));
await page.screenshot({ path: ".tmp-probe/daymenu-last.png" });

// --- bulk
await page.goto(URL + "?state=planning");
await page.waitForTimeout(400);
await page.locator(".selectAll").click();
await page.waitForTimeout(200);
console.log("bulk button:", await page.locator(".drawerDo").innerText());
console.log("box size coarse-off:", await page.evaluate(()=>{const r=document.querySelector(".box").getBoundingClientRect();return r.width+"x"+r.height;}));
await page.locator(".drawerDo").click();
await page.waitForTimeout(200);
await page.locator('.drawerBulk .dayMenu [data-when="today"]').click();
await page.waitForTimeout(300);
console.log("bulk SAY:", await page.locator("#say").textContent());
console.log("bulk ACTIVE:", await page.evaluate(() => {const a=document.activeElement; return a.tagName+"."+a.className+" inDrawer="+!!a.closest(".drawer");}));
console.log("HEAD:", await page.evaluate(() => document.querySelector(".headFacts").innerText.replace(/\n/g," | ")));
console.log("CHIP kinds:", await page.evaluate(() => [...document.querySelectorAll(".when")].map(n=>n.dataset.t).join(",")));
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
console.log("after undo HEAD:", await page.evaluate(() => document.querySelector(".headFacts").innerText.replace(/\n/g," | ")));
console.log("after undo drawer open:", await page.locator(".drawer").count(), "SAY:", await page.locator("#say").textContent());
await b.close();
