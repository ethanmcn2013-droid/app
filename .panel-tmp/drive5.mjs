import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:960}});
await p.goto(BASE+"?state=notebook&v=locked"); await p.waitForTimeout(400);
await p.keyboard.press("/"); await p.waitForTimeout(200);
for (const ch of "orchard") { await p.keyboard.press(ch); await p.waitForTimeout(60);
  console.log(ch, "->", await p.evaluate(()=>{const q=document.getElementById('q'); return q.value+"  caret="+q.selectionStart;})); }
console.log("FOUND line:", await p.evaluate(()=>[...document.querySelectorAll('*')].find(e=>/^FOUND/.test(e.innerText||''))?.innerText.replace(/\n/g,' ')));
// phone capture field same bug?
await p.setViewportSize({width:390,height:844}); await p.goto(BASE+"?state=notebook&v=locked"); await p.waitForTimeout(400);
const pf = p.locator(".phoneField, textarea").first(); await pf.click();
for (const ch of "florist") { await p.keyboard.press(ch); await p.waitForTimeout(60); }
console.log("phone capture field value:", await p.evaluate(()=>document.querySelector('.phoneField, textarea')?.value));
await b.close();
