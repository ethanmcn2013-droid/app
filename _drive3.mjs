import { chromium } from "@playwright/test";
import fs from "fs";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const OUT = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_shots";
fs.mkdirSync(OUT, { recursive: true });
const lines = [];
const log = (...a) => { lines.push(a.join(" ")); fs.writeFileSync(OUT + "/log3.txt", lines.join("\n")); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });

// A. char counter staleness
await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(500);
await p.click(".topField");
await p.type(".topField", "Ring the marquee company back about the side panels before four", { delay: 6 });
log("A counter:", await p.locator(".topMeta").innerText());
await p.screenshot({ path: OUT + "/a-counter.png", clip:{x:150,y:80,width:1290,height:320} });

// B. search: grammar + dead end
await p.goto(BASE + "?state=search"); await p.waitForTimeout(500);
log("B0 count line:", await p.locator(".indexHead .cnt").first().innerText());
await p.fill("#q", ""); await p.type("#q","registrar",{delay:20}); await p.waitForTimeout(300);
log("B1 title:", await p.locator(".indexHead span").first().innerText(), "| cnt:", await p.locator(".indexHead .cnt").first().innerText());
log("B1 rows:", await p.locator(".idxRow").count());
await p.fill("#q",""); await p.type("#q","zebra",{delay:20}); await p.waitForTimeout(300);
log("B2 empty:", (await p.locator(".index").innerText()).replace(/\n/g," | "));
await p.screenshot({ path: OUT + "/b-noresult.png" });
const before = p.url();
await p.click('[data-act="nearest"]');
await p.waitForTimeout(300);
log("B3 after clicking 'Open that one': rows now", await p.locator(".idxRow").count(), "| index text:", (await p.locator(".index").innerText()).slice(0,90).replace(/\n/g," | "));

// C. review: counts + keys + undo of keep-both
await p.goto(BASE + "?state=review"); await p.waitForTimeout(500);
log("C0 deckNote:", (await p.locator(".deckNote").innerText()).replace(/\n/g," "));
log("C0 idxhead:", (await p.locator(".indexHead").first().innerText()).replace(/\n/g," | "));
log("C0 handOf:", await p.locator(".handOf").innerText());
await p.keyboard.press("t"); await p.waitForTimeout(320);
log("C1 SAY:", await p.locator("#say").innerText());
log("C1 deckNote:", (await p.locator(".deckNote").innerText()).replace(/\n/g," "));
log("C1 idxhead:", (await p.locator(".indexHead").first().innerText()).replace(/\n/g," | "));
await p.keyboard.press("k"); await p.waitForTimeout(320);
log("C2 SAY:", await p.locator("#say").innerText());
await p.screenshot({ path: OUT + "/c-review.png" });

// D. readback false undo
await p.goto(BASE + "?state=readback"); await p.waitForTimeout(500);
await p.click('[data-act="keep-both"]'); await p.waitForTimeout(300);
log("D0 SAY:", await p.locator("#say").innerText());
log("D0 total before undo:", await p.locator(".indexHead .cnt").first().innerText());
await p.keyboard.press("Control+z"); await p.waitForTimeout(300);
log("D1 SAY:", await p.locator("#say").innerText());
log("D1 total after undo:", await p.locator(".indexHead .cnt").first().innerText());

// E. seam: crossed ledger tags
await p.goto(BASE + "?state=seam"); await p.waitForTimeout(500);
log("E crossed head:", (await p.locator(".indexHead").first().innerText()).replace(/\n/g," | "));
for (const r of await p.locator(".idxRow").all()) log("E row:", (await r.innerText()).replace(/\n/g," | "));

// F. phone
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(700);
const clipped = await p.evaluate(()=>[...document.querySelectorAll(".idxText")].map(t=>({sw:t.scrollWidth, cw:t.clientWidth, txt:t.textContent.slice(0,30)})).slice(0,6));
log("F clip check:", JSON.stringify(clipped));
await p.screenshot({ path: OUT + "/f-phone.png" });
await p.click(".phoneField");
await p.type(".phoneField","Check the gate sign before Saturday",{delay:8});
log("F dock after typing:", (await p.locator(".dock").innerText()).replace(/\n/g," | "));
await p.keyboard.press("Control+Enter"); await p.waitForTimeout(350);
log("F SAY:", await p.locator("#say").innerText());
log("F undo visible:", await p.locator(".undo").count());
await p.screenshot({ path: OUT + "/f-phone-after.png" });
await b.close();
log("DONE");
