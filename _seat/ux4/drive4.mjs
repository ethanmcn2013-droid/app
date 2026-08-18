import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const F = async () => p.evaluate(()=>{const a=document.activeElement;return a.tagName+"."+(a.className||"")+" ["+(a.getAttribute("aria-label")||a.value||a.textContent||"").trim().slice(0,70)+"]"});
const LIVE = async () => p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(n=>(n.textContent||'').trim()).filter(Boolean));
await p.goto(base + "?state=notebook"); await p.waitForTimeout(400);
// index walk
await p.keyboard.press("Escape");
for (let i=0;i<3;i++) await p.keyboard.press("Tab");
console.log("tab x3 from field:", await F());
// find the index tab stop
for (let i=0;i<10;i++){ await p.keyboard.press("Tab"); const f=await F(); if(/idxRow|row/i.test(f)) { console.log("index reached at tab",i+4,f); break;} }
console.log("now:", await F());
await p.keyboard.press("ArrowDown"); console.log("after Down:", await F(), await LIVE());
await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown");
console.log("after 3 Down:", await F());
await p.keyboard.press("Enter"); await p.waitForTimeout(700);
console.log("after Enter focus:", await F(), "live:", await LIVE());
console.log("read text:", (await p.evaluate(()=>document.body.innerText)).slice(0,600).replace(/\n/g," | "));
await p.screenshot({path:out+"read.png"});
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
console.log("after Esc focus:", await F());
// search
await p.keyboard.press("/"); await p.waitForTimeout(400);
console.log("after / focus:", await F());
await p.keyboard.type("florist"); await p.waitForTimeout(600);
console.log("search live:", await LIVE());
console.log("search text:", (await p.evaluate(()=>document.body.innerText)).slice(0,800).replace(/\n/g," | "));
await p.screenshot({path:out+"search.png"});
await p.keyboard.type("zzzz"); await p.waitForTimeout(600);
console.log("no-result:", (await p.evaluate(()=>document.body.innerText)).slice(0,600).replace(/\n/g," | "), await LIVE());
await p.screenshot({path:out+"search-none.png"});
await b.close();
