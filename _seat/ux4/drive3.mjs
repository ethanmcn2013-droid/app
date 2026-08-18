import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const F = async () => p.evaluate(()=>{const a=document.activeElement;return a.tagName+"."+(a.className||"")+" ["+(a.getAttribute("aria-label")||a.value||a.textContent||"").trim().slice(0,60)+"]"});
await p.goto(base + "?state=review"); await p.waitForTimeout(400);
console.log("tab order from review:");
for (let i=0;i<7;i++){ await p.keyboard.press("Tab"); console.log("  ", i, await F()); }
// peel field styling
await p.goto(base + "?state=seam"); await p.waitForTimeout(500);
console.log("SEAM focus at rest:", await F());
const info = await p.evaluate(()=>{
  const ta=[...document.querySelectorAll('textarea')].map(t=>({cls:t.className,label:t.getAttribute('aria-label'),labelledby:t.getAttribute('aria-labelledby'),val:(t.value||'').slice(0,60),
    st:(()=>{const c=getComputedStyle(t);return {border:c.borderBottomWidth+" "+c.borderBottomStyle+" "+c.borderBottomColor,bg:c.backgroundColor,fs:c.fontSize,fw:c.fontWeight};})(),
    box:t.getBoundingClientRect()}));
  return ta;
});
console.log("textareas:", JSON.stringify(info,null,1));
console.log("seam text:", (await p.evaluate(()=>document.body.innerText)).slice(0,1200).replace(/\n/g," | "));
await b.close();
