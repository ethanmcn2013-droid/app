import { chromium } from "@playwright/test";
const URL = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const said = () => p.locator("[aria-live]").first().textContent();

await p.goto(URL + "?state=notebook&v=locked");
await p.waitForTimeout(400);
console.log("HEAD:", (await p.locator(".headLine, .head, header").first().innerText()).replace(/\n/g, " | "));
const tags = await p.locator(".idxTag").allTextContents();
console.log("CHIPS:", JSON.stringify(tags));
console.log("rows:", await p.locator(".idxRow").count());
const names = await p.locator(".idxRow").evaluateAll(n => n.slice(0,4).map(x => x.getAttribute("aria-label")));
console.log("NAMES:", names.join("\n  "));

// capture
await p.locator(".topField").click();
await p.keyboard.type("Marquee lining arrives Thursday, confirm with the florist");
await p.waitForTimeout(200);
console.log("COMMIT BTN:", await p.locator('[data-act="keep"]').first().innerText(), "| aria:", await p.locator('[data-act="keep"]').first().getAttribute("aria-label"));
await p.keyboard.press("Control+Enter");
await p.waitForTimeout(700);
console.log("SAY after keep:", await said());
console.log("UNDO STRIP:", (await p.locator(".undo").innerText()).replace(/\n/g," | "));
await p.keyboard.press("Control+z");
await p.waitForTimeout(500);
console.log("SAY after undo:", await said());

// review
await p.goto(URL + "?state=review&v=locked");
await p.waitForTimeout(400);
console.log("HAND FOOT:", (await p.locator(".handFoot").innerText()).replace(/\n/g," | "));
console.log("DECKNOTE:", (await p.locator(".deckNote").innerText()).replace(/\n/g," | "));
await p.keyboard.press("k");
await p.waitForTimeout(500);
console.log("SAY after K:", await said());
console.log("UNDO STRIP:", (await p.locator(".undo").innerText()).replace(/\n/g," | "));
await p.keyboard.press("Control+z");
await p.waitForTimeout(400);
console.log("SAY after undo in hand:", await said());

// back to notebook after a keep decision: chip distribution
await p.goto(URL + "?state=notebook&v=locked");
await p.waitForTimeout(300);
const dist = {};
for (const t of await p.locator(".idxTag").allTextContents()) dist[t] = (dist[t]||0)+1;
console.log("CHIP DIST:", JSON.stringify(dist));
await b.close();
