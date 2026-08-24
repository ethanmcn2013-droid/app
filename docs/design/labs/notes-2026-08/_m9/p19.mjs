import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=pressure"); await p.waitForTimeout(600);
const pts = await p.evaluate(()=>{
  const s=[...document.querySelectorAll(".sent")];
  const a=s[1].getClientRects(); const c=s[2].getClientRects();
  return {a:{x:a[a.length-1].x+30,y:a[a.length-1].y+8}, c:{x:c[0].x+60,y:c[0].y+8}};
});
await p.mouse.move(pts.a.x, pts.a.y); await p.mouse.down();
await p.mouse.move(pts.c.x, pts.c.y, {steps:10}); await p.waitForTimeout(200);
console.log("mid-drag pick:", await p.locator(".pickBar").allInnerTexts());
await p.mouse.up(); await p.waitForTimeout(400);
console.log("cross-sentence drag pick:", await p.locator(".pickBar").allInnerTexts());
console.log("live:", await p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(e=>e.textContent.trim().slice(0,100))));
await b.close();
