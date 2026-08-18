import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:2 });
p.on("console", m => { if(m.type()==="error") console.log("CONSOLE ERR", m.text()); });
await p.goto(BASE+"?state=notebook&v=locked");
await p.waitForTimeout(600);

// --- capture latency: time from typing to note on pile
const field = p.locator("textarea, [contenteditable=true]").first();
console.log("field count", await p.locator("textarea").count(), await p.locator("[contenteditable=true]").count());
await field.click();
const t0 = Date.now();
await field.type("Ask the florist to arrive at seven, not eight, on the Saturday", {delay: 12});
console.log("typed in", Date.now()-t0, "ms");
// measure single keystroke cost
const t1 = Date.now();
for (let i=0;i<20;i++) await p.keyboard.press("a");
console.log("20 keystrokes", Date.now()-t1, "ms ->", ((Date.now()-t1)/20).toFixed(1), "ms/key");
for (let i=0;i<20;i++) await p.keyboard.press("Backspace");

const before = await p.evaluate(()=>document.body.innerText.length);
const t2 = Date.now();
await p.keyboard.press("Control+Enter");
// poll for the note appearing in index
let landed=-1;
for (let i=0;i<200;i++){
  const has = await p.evaluate(()=>!!document.querySelector('[class*="index"], [class*="row"]') && document.body.innerText.includes("Ask the florist to arrive at seven"));
  if (has){ landed = Date.now()-t2; break; }
  await p.waitForTimeout(10);
}
console.log("ink-to-safe (text present in DOM after ctrl+enter):", landed, "ms");
await p.waitForTimeout(900);
await p.screenshot({path:"C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/after-save.png"});
// live region content
const live = await p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(n=>({role:n.getAttribute('aria-live'), t:n.innerText.trim()})));
console.log("live regions:", JSON.stringify(live));
// undo strip
console.log("undo strip text:", await p.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(e=>/undo|put .*back|Undo/i.test(e.textContent||'')&&e.children.length<4); return n?n.innerText.trim().slice(0,160):null;}));
await b.close();
