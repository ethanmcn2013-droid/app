import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
const LIVE = async () => p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(n=>(n.textContent||'').trim()).filter(Boolean));
const F = async () => p.evaluate(()=>{const a=document.activeElement;return a.tagName+"."+(a.className||"")+" ["+(a.getAttribute("aria-label")||a.value||"").trim().slice(0,50)+"]"});
await p.goto(base + "?state=notebook"); await p.waitForTimeout(500);
console.log("PHONE focus at rest:", await F());
console.log("PHONE text:", (await p.evaluate(()=>document.body.innerText)).slice(0,900).replace(/\n/g," | "));
await p.screenshot({path:out+"p-rest.png"});
// capture from dock
const field = await p.$(".phoneField");
console.log("phoneField present:", !!field);
if(field){ await field.click(); await p.keyboard.type("Order two more cases of tonic"); await p.waitForTimeout(400);
  await p.screenshot({path:out+"p-typed.png", fullPage:false});
  const dockBox = await p.evaluate(()=>{const d=document.querySelector('.dock,.phoneDock');return d?d.getBoundingClientRect():null});
  console.log("dock box", JSON.stringify(dockBox));
  const commit = await p.evaluate(()=>[...document.querySelectorAll('.dock button,.phoneDock button')].map(x=>({t:x.textContent.trim(),l:x.getAttribute('aria-label'),b:x.getBoundingClientRect()})));
  console.log("dock buttons:", JSON.stringify(commit));
  const c = await p.$('[data-act="keep"], .phoneKeep, .dock [data-primary]');
  if(c){ await c.click(); await p.waitForTimeout(1400); console.log("phone keep live:", await LIVE(), "focus", await F()); }
  await p.screenshot({path:out+"p-kept.png"});
}
// review on phone
await p.goto(base + "?state=review"); await p.waitForTimeout(500);
await p.screenshot({path:out+"p-review.png"});
console.log("PHONE review:", (await p.evaluate(()=>document.body.innerText)).slice(0,600).replace(/\n/g," | "));
await p.goto(base + "?state=seam"); await p.waitForTimeout(500);
await p.screenshot({path:out+"p-seam.png"});
console.log("PHONE seam scrollw:", await p.evaluate(()=>[document.documentElement.scrollWidth, innerWidth]));
await b.close();
