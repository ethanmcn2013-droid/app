import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(500);
await p.locator(".topField").click();
const t0=Date.now();
await p.keyboard.press("R");
let seen=null;
for(let i=0;i<40;i++){ if(await p.locator('.top [data-act="keep"]').count()){ seen=Date.now()-t0; break;} await p.waitForTimeout(25); }
console.log("ms until Save it control exists after first keystroke:", seen);
// realistic typing at 70ms/key for 3 seconds
await p.locator(".topField").fill("");
await p.dispatchEvent(".topField","input"); await p.waitForTimeout(600);
const t1=Date.now(); let appeared=null;
await p.keyboard.type("Ring the florist about the aisle foliage and the fireplace", {delay:70});
appeared = await p.locator('.top [data-act="keep"]').count();
console.log("commit visible while typing at 70ms/key:", appeared, "elapsed", Date.now()-t1);
await p.waitForTimeout(500);
console.log("after pause:", await p.locator('.top [data-act="keep"]').count());
// cap
await p.locator(".topField").fill("y".repeat(4500));
await p.dispatchEvent(".topField","input"); await p.waitForTimeout(700);
console.log("counter at 4500:", await p.locator("[data-count]").innerText(), "| maxlength:", await p.locator(".topField").getAttribute("maxlength"));
console.log("counter styles at over-cap:", await p.evaluate(()=>{const e=document.querySelector("[data-count]");const s=getComputedStyle(e);return [s.color,s.fontWeight,e.getAttribute("aria-live")];}));
await b.close();
