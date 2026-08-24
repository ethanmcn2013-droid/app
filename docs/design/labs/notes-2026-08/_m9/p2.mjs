import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
const desc = async () => p.evaluate(() => {
  const a = document.activeElement;
  return a ? [a.tagName, a.className, (a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,70)] : null;
});
await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(500);
console.log("head chip:", await p.locator(".chip").allInnerTexts());
console.log("idx head:", (await p.locator(".idxHead, .indexHead").first().innerText().catch(()=>"?")).replace(/\n/g,' | '));
// tab order from top
await p.keyboard.press("Tab");
for (let i=0;i<24;i++){ console.log(i, JSON.stringify(await desc())); await p.keyboard.press("Tab"); }
console.log("ERR", errs);
await b.close();
