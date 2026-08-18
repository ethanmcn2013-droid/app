import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const LIVE = async () => p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(n=>(n.textContent||'').trim()).filter(Boolean));
await p.goto(base + "?state=review"); await p.waitForTimeout(400);
await p.keyboard.press("t"); await p.waitForTimeout(600);
console.log("peel open:", await p.evaluate(()=>document.querySelectorAll('.peel').length));
// press the hand's own Send to Tasks again
await p.evaluate(()=>{const x=[...document.querySelectorAll('.handFoot button')].find(n=>/Send to Tasks/.test(n.textContent)); x.click();});
await p.waitForTimeout(600);
console.log("after pressing hand primary again: peels=", await p.evaluate(()=>document.querySelectorAll('.peel').length), "handOf=", await p.evaluate(()=>document.querySelector('.handOf')?.textContent), "live=", await LIVE());
// press T again
await p.keyboard.press("t"); await p.waitForTimeout(600);
console.log("after T again: peels=", await p.evaluate(()=>document.querySelectorAll('.peel').length), "handOf=", await p.evaluate(()=>document.querySelector('.handOf')?.textContent));
await b.close();
