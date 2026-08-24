import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=pressure"); await p.waitForTimeout(600);
console.log("sent count:", await p.locator(".sent").count());
console.log("sent texts:", (await p.locator(".sent").allInnerTexts()).map(t=>t.slice(0,40)));
const boxes = await p.evaluate(()=>[...document.querySelectorAll(".sent")].map(s=>{const r=s.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];}));
console.log("boxes", boxes.slice(0,4));
// drag strictly inside sentence 2, a few words
const s2 = await p.evaluate(()=>{ const s=[...document.querySelectorAll(".sent")][1]; const r=[...s.getClientRects()][1]||s.getBoundingClientRect(); return {x:r.x,y:r.y+r.height/2,w:r.width}; });
console.log("s2 line", s2);
await p.mouse.move(s2.x+40, s2.y); await p.mouse.down();
for(let i=1;i<=10;i++){ await p.mouse.move(s2.x+40+i*14, s2.y); await p.waitForTimeout(20);} 
await p.mouse.up(); await p.waitForTimeout(400);
console.log("pick after in-sentence drag:", await p.locator(".pickBar").allInnerTexts());
await b.close();
