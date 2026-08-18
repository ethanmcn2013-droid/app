import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const OUT = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const log = [];
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") log.push("CONSOLE " + m.type() + ": " + m.text()); });
p.on("pageerror", e => log.push("PAGEERROR: " + e.message));

await p.goto(BASE + "?state=notebook&v=locked");
await p.waitForTimeout(400);

// what is focused at rest
log.push("REST focus: " + await p.evaluate(() => document.activeElement && (document.activeElement.className + " / " + (document.activeElement.tagName))));

// scroll position of the index at rest
log.push("index scrollTop rest: " + await p.evaluate(() => { const e=document.querySelector('.indexScroll, .idxScroll, .indexWrap'); return e ? e.scrollTop+"/"+e.scrollHeight : "no el"; }));

// type into field
const field = p.locator(".topField");
await field.click();
const t0 = Date.now();
await p.keyboard.type("Ring the marquee company back about the side panels.", { delay: 12 });
log.push("typed in ms: " + (Date.now() - t0));
await p.screenshot({ path: OUT + "01-typed.png" });

// commit
await p.keyboard.press("Control+Enter");
await p.waitForTimeout(60);
await p.screenshot({ path: OUT + "02-commit-60ms.png" });
await p.waitForTimeout(180);
await p.screenshot({ path: OUT + "03-commit-240ms.png" });
await p.waitForTimeout(260);
await p.screenshot({ path: OUT + "04-commit-500ms.png" });
await p.waitForTimeout(400);
await p.screenshot({ path: OUT + "05-commit-900ms.png" });
log.push("after keep, focus: " + await p.evaluate(() => document.activeElement && document.activeElement.className));
log.push("live region: " + await p.evaluate(() => document.getElementById("say")?.textContent));
log.push("undo strip: " + await p.evaluate(() => { const e=[...document.querySelectorAll("*")].filter(x=>/Undo|undo/.test(x.textContent||"") && x.children.length===0); return e.map(x=>x.textContent.trim()).slice(0,5).join(" | "); }));

// full frame after keep
await p.screenshot({ path: OUT + "06-after-keep.png" });

// ctrl+z
await p.keyboard.press("Control+z");
await p.waitForTimeout(250);
log.push("after ctrl+z field value: " + JSON.stringify(await p.evaluate(() => document.querySelector(".topField")?.value ?? document.querySelector(".topField")?.textContent)));
log.push("after ctrl+z live: " + await p.evaluate(() => document.getElementById("say")?.textContent));
await p.screenshot({ path: OUT + "07-after-undo.png" });

console.log(log.join("\n"));
await b.close();
