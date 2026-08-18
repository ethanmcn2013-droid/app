import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const F = async () => p.evaluate(()=>{const a=document.activeElement;return (a.tagName+" ["+(a.getAttribute("aria-label")||a.textContent||"").trim().slice(0,70)+"]")});
const LIVE = async () => p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(n=>(n.textContent||'').trim()).filter(Boolean));

await p.goto(base + "?state=review"); await p.waitForTimeout(400);
console.log("REVIEW focus:", await F());
console.log("review visible text:", (await p.evaluate(()=>document.body.innerText)).slice(0,700).replace(/\n/g," | "));
await p.keyboard.press("t"); await p.waitForTimeout(700);
console.log("after T focus:", await F(), "live:", await LIVE());
await p.screenshot({path:out+"r-afterT.png"});
console.log("after T text:", (await p.evaluate(()=>document.body.innerText)).slice(0,900).replace(/\n/g," | "));
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
console.log("after Esc:", (await p.evaluate(()=>document.body.innerText)).slice(0,300).replace(/\n/g," | "), "focus", await F());
await p.keyboard.press("k"); await p.waitForTimeout(900);
console.log("after K live:", await LIVE(), "focus", await F());
await p.screenshot({path:out+"r-afterK.png"});
// undo affordance
console.log("undo strip:", await p.evaluate(()=>{const n=document.querySelector('.undo,[data-undo],.strip');return n?n.innerText:'none'}));
await b.close();
