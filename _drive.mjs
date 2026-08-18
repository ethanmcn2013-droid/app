import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const OUT = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/shots";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const log = (...a) => console.log(...a);

// 1. capture flow
await p.goto(BASE + "?state=notebook");
await p.waitForTimeout(400);
await p.click(".topField");
const t0 = Date.now();
await p.type(".topField", "Ring the florist about Saturday delivery", { delay: 12 });
log("typed in ms", Date.now() - t0);
log("foot after typing:", await p.locator(".topFoot").innerText());
await p.keyboard.press("Control+Enter");
await p.waitForTimeout(320);
log("SAY after keep:", await p.locator("#say").innerText());
log("undo strip:", await p.locator(".undo").count() ? await p.locator(".undo").innerText() : "none");
log("head chip:", await p.locator(".chip").innerText().catch(()=>"none"));
log("index head:", await p.locator(".indexHead").first().innerText());
await p.screenshot({ path: OUT + "/after-keep.png" });
await p.keyboard.press("Control+z");
await p.waitForTimeout(200);
log("SAY after undo:", await p.locator("#say").innerText());
log("field after undo:", await p.locator(".topField").inputValue());

// 2. index keyboard
await p.goto(BASE + "?state=notebook");
await p.waitForTimeout(300);
await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
for (let i=0;i<6;i++) { await p.keyboard.press("Tab"); const a = await p.evaluate(()=>document.activeElement.className+" | "+(document.activeElement.getAttribute("aria-label")||document.activeElement.textContent||"").slice(0,70)); log("tab"+i, a); }
