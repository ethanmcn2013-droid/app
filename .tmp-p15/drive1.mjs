import { chromium } from "@playwright/test";
import path from "node:path";
const URL = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const OUT = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/03bab8c7-324b-44bb-83da-00449743ddfe/scratchpad/p15/";
const b = await chromium.launch();
async function open(q="", vp={width:1440,height:960}) {
  const p = await b.newPage({viewport:vp});
  p.on("pageerror", e=>console.log("PAGEERR", String(e)));
  await p.goto(URL+q); await p.waitForTimeout(400); return p;
}
// 1. card in hand
{
  const p = await open();
  await p.locator('.tray[data-lane="todo"] .card').first().focus();
  await p.keyboard.press(" ");
  await p.waitForTimeout(250);
  await p.screenshot({path:OUT+"01-in-hand.png"});
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(300);
  await p.screenshot({path:OUT+"02-in-hand-moved.png"});
  await p.close();
}
// 2. flight mid-frame
{
  const p = await open();
  await p.locator('.tray[data-lane="todo"] .card .tick').first().click();
  await p.waitForTimeout(120);
  await p.screenshot({path:OUT+"03-flight-120.png"});
  await p.waitForTimeout(120);
  await p.screenshot({path:OUT+"04-flight-240.png"});
  await p.waitForTimeout(500);
  await p.screenshot({path:OUT+"05-after-flight.png"});
  await p.close();
}
// 3. open note
{
  const p = await open();
  await p.locator('.tray[data-lane="todo"] .card').first().click();
  await p.waitForTimeout(400);
  await p.screenshot({path:OUT+"06-open-note.png"});
  await p.close();
}
// 4. planning: pick a day
{
  const p = await open("?state=planning");
  await p.screenshot({path:OUT+"07-planning.png"});
  const menu = p.locator('.drawer').locator('text=Pick a day').first();
  await menu.click(); await p.waitForTimeout(300);
  await p.screenshot({path:OUT+"08-planning-daymenu.png"});
  await p.keyboard.press("Escape");
  // pick rows
  const boxes = p.locator('.drawer input[type=checkbox], .drawer [role=checkbox]');
  const n = await boxes.count();
  if (n>1){ await boxes.nth(0).click(); await boxes.nth(1).click(); }
  await p.waitForTimeout(300);
  await p.screenshot({path:OUT+"09-planning-picked.png"});
  await p.close();
}
// 5. composed filters
{
  const p = await open();
  await p.locator('text=1 overdue').first().click(); await p.waitForTimeout(400);
  await p.screenshot({path:OUT+"10-filter-overdue.png"});
  await p.close();
}
// 6. 1280 and 1024 with drawer
{
  const p = await open("", {width:1280,height:900});
  await p.screenshot({path:OUT+"11-1280.png"});
  await p.setViewportSize({width:1024,height:820}); await p.waitForTimeout(400);
  await p.screenshot({path:OUT+"12-1024.png"});
  await p.close();
}
{
  const p = await open("?state=planning", {width:1024,height:820});
  await p.screenshot({path:OUT+"13-planning-1024.png"});
  await p.close();
}
await b.close();
console.log("done");
