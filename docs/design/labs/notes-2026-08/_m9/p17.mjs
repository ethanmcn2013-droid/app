import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=pressure"); await p.waitForTimeout(600);
const rb = await p.locator(".readBody").boundingBox();
console.log("readBody box", rb);
// drag across the middle of line 3
const y = rb.y + 70;
await p.mouse.move(rb.x + 60, y); await p.mouse.down();
for (let x = 60; x <= 300; x += 20) { await p.mouse.move(rb.x + x, y); await p.waitForTimeout(15); }
await p.mouse.up();
await p.waitForTimeout(400);
console.log("selection:", JSON.stringify(await p.evaluate(()=>String(getSelection()))));
console.log("pickBar:", await p.locator(".pickBar").allInnerTexts());
console.log("live:", await p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(e=>e.textContent.trim().slice(0,120))));
await p.screenshot({path:"docs/design/labs/notes-2026-08/_m9/drag.png"});
await b.close();
