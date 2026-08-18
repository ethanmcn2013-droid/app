import { chromium } from "@playwright/test";
import path from "node:path";
const URL = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const OUT = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(URL); await p.waitForTimeout(400);
const c = await p.locator('.tray[data-lane="todo"] .card').first().boundingBox();
await p.mouse.move(c.x+100, c.y+20); await p.mouse.down();
await p.mouse.move(c.x+400, c.y+200, {steps:14}); await p.waitForTimeout(250);
await p.screenshot({ path: OUT+"/drag.png" });
console.log("DRAG:", await p.evaluate(()=>{
  const d=document.querySelector(".dropLine");
  const say=document.querySelector("#say");
  return { dropLine: !!d, box: d?[Math.round(d.getBoundingClientRect().x),Math.round(d.getBoundingClientRect().y),Math.round(d.getBoundingClientRect().width)]:null,
    carry: !!document.querySelector(".carry"), say: say?say.textContent:"(#say missing during drag)",
    over: document.querySelector(".tray[data-over]")?.dataset.lane || null,
    dragged: [...document.querySelectorAll(".card")].filter(x=>getComputedStyle(x).opacity!=="1").length };
}));
await p.mouse.up(); await p.waitForTimeout(300);
await p.screenshot({ path: OUT+"/afterdrop.png" });
// empty + loading + tablet
const q = await b.newPage({ viewport: { width: 1440, height: 960 } });
await q.goto(URL+"?state=empty"); await q.waitForTimeout(300); await q.screenshot({path:OUT+"/empty.png"});
await q.goto(URL+"?state=loading"); await q.waitForTimeout(500); await q.screenshot({path:OUT+"/loading.png"});
const t = await b.newPage({ viewport: { width: 768, height: 1024 } });
await t.goto(URL); await t.waitForTimeout(300); await t.screenshot({path:OUT+"/t768.png"});
await b.close();
