import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const errs = [];
p.on("pageerror", e => errs.push("PAGEERROR " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await p.goto(BASE + "?state=notebook");
await p.waitForTimeout(600);

// 1. capture latency: type into top field and measure time to ink
const f = p.locator(".topField");
await f.click();
const t0 = Date.now();
await p.keyboard.type("Ring the florist about the aisle foliage on Friday");
const t1 = Date.now();
console.log("typing 50 chars ms:", t1 - t0);
await p.waitForTimeout(200);
// commit
const tc0 = Date.now();
await p.keyboard.press("Control+Enter");
await p.waitForTimeout(50);
const inIndex = await p.locator(".idxRow").first().innerText();
console.log("after ctrl+enter first row:", JSON.stringify(inIndex.slice(0,60)), "ms", Date.now()-tc0);
console.log("field value now:", JSON.stringify(await f.inputValue()));
// undo surface
const undo = await p.locator(".undo").count();
console.log("undo surfaces:", undo, undo? JSON.stringify((await p.locator(".undo").first().innerText()).slice(0,120)) : "");
await p.waitForTimeout(100);
console.log("live region text:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[aria-live]')].map(e=>[e.className, e.getAttribute('aria-live'), e.textContent.trim().slice(0,120)]))));
console.log("ERRORS", errs);
await b.close();
