import { chromium } from "@playwright/test";
const F = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(F);
await p.waitForTimeout(300);
// inspect the inert controls
const info = await p.evaluate(() => {
  const out = [];
  for (const a of ["privacy","options","photo"]) {
    const el = document.querySelector(`[data-act="${a}"]`);
    if (!el) { out.push([a,"missing"]); continue; }
    const cs = getComputedStyle(el);
    out.push([a, el.getAttribute("aria-disabled"), el.getAttribute("title"), cs.opacity, cs.color, el.textContent.trim().slice(0,40)]);
  }
  return out;
});
console.log("INERT CONTROLS", JSON.stringify(info));
await p.locator('[data-act="privacy"]').click();
await p.waitForTimeout(200);
console.log("SAY after privacy:", await p.locator("#say").textContent());
// type a note and keep, compare announcement register
await p.locator(".topField").fill("Check the marquee sides with the hire company");
await p.keyboard.press("Control+Enter");
await p.waitForTimeout(400);
console.log("SAY after keep:", await p.locator("#say").textContent());
// pressure head
await p.goto(F + "?state=pressure"); await p.waitForTimeout(300);
console.log("PRESSURE head:", await p.locator(".indexHead").innerText());
await p.goto(F + "?state=not-yet"); await p.waitForTimeout(300);
console.log("NOT-YET head:", await p.locator(".indexHead").innerText());
await p.goto(F + "?state=nothing"); await p.waitForTimeout(300);
console.log("NOTHING head:", await p.locator(".indexHead").innerText());
const why = await p.evaluate(() => {
  const w = document.querySelector(".specWhy"), b = document.querySelector(".spec .emptyBody");
  const g = (e) => e ? [getComputedStyle(e).fontSize, getComputedStyle(e).color, getComputedStyle(e).fontStyle] : null;
  return { why: g(w), body: g(b) };
});
console.log("STYLES", JSON.stringify(why));
await b.close();
