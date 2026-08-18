import { chromium } from "@playwright/test";
import path from "node:path";
const URL = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const OUT = process.argv[2];
const b = await chromium.launch();
const q = await b.newPage({ viewport: { width: 1440, height: 960 } });
await q.goto(URL + "?state=empty"); await q.waitForTimeout(400);
await q.screenshot({ path: OUT + "/empty.png" });
await q.goto(URL + "?state=loading"); await q.waitForTimeout(500);
await q.screenshot({ path: OUT + "/loading.png" });
const t = await b.newPage({ viewport: { width: 768, height: 1024 } });
await t.goto(URL); await t.waitForTimeout(400);
console.log("768 head:", await t.evaluate(()=>{
  const n=document.querySelector(".headName"); const r=n.getBoundingClientRect();
  return { text:n.textContent, w:Math.round(r.width), truncated:n.scrollWidth>n.clientWidth+1, actionsW: Math.round(document.querySelector(".headActions").getBoundingClientRect().width) };
}));
// drag feel
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(URL); await p.waitForTimeout(300);
const c = await p.locator('.tray[data-lane="todo"] .card').first().boundingBox();
await p.mouse.move(c.x+100, c.y+20); await p.mouse.down();
await p.mouse.move(c.x+160, c.y+120, {steps:10}); await p.waitForTimeout(200);
await p.screenshot({ path: OUT+"/drag.png" });
console.log("DRAG:", await p.evaluate(()=>{
  const d=document.querySelector(".dropLine"); const g=document.querySelector('.card[data-force="drag"], .card[aria-grabbed="true"]');
  return { dropLine: !!d, dropLineBox: d? [Math.round(d.getBoundingClientRect().x),Math.round(d.getBoundingClientRect().y),Math.round(d.getBoundingClientRect().width)]:null, carry: !!document.querySelector(".carry"), say: document.querySelector("#say").textContent };
}));
await p.mouse.up();
await b.close();
