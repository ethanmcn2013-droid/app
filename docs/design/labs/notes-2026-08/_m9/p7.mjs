import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=review"); await p.waitForTimeout(500);
await p.keyboard.press("t"); await p.waitForTimeout(400);
await p.locator(".peelField").fill("");
await p.locator(".peelField").type("keep talking");
await p.waitForTimeout(300);
console.log("peelField after typing 'keep talking':", JSON.stringify(await p.locator(".peelField").inputValue()));
console.log("card still 1 of 8?", (await p.locator(".handCount, .deskTag, .desk").first().innerText()).replace(/\n/g," | ").slice(0,80));
console.log("live:", await p.evaluate(()=>[...document.querySelectorAll('[aria-live]')].map(e=>e.className+"::"+e.textContent.trim())));
// Escape from seam
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
console.log("after esc peel count", await p.locator(".peel").count(), "focus", await p.evaluate(()=>document.activeElement.className+"|"+(document.activeElement.getAttribute('aria-label')||'').slice(0,50)));
// does Escape lose the typed wording irreversibly?
await p.keyboard.press("t"); await p.waitForTimeout(350);
console.log("reopened wording:", JSON.stringify(await p.locator(".peelField").inputValue()));
await b.close();
