/** Drive every Tasks surface in the new shell and report what renders. */
import { chromium } from "@playwright/test";
const b = await chromium.launch();
const errs = [];
for (const [path, label] of [["/app/tasks","board"],["/app/tasks/list","list"],["/app/tasks/timeline","schedule"],["/app/tasks/calendar","calendar"]]) {
  for (const w of [1440, 1100, 768, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    p.on("pageerror", (e) => errs.push(`${label}@${w}: ${String(e).slice(0,90)}`));
    await p.goto("http://localhost:3510" + path, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3500);
    const r = await p.evaluate(() => {
      const has = (f) => !!document.querySelector(`[class*="floor-module"][class*="${f}"]`);
      return {
        spine: has("rail"), sheet: has("sheet"), dock: has("dock"), seg: has("seg"),
        cards: document.querySelectorAll('[class*="floor-module"][class*="card"][data-id]').length,
        interior: document.querySelectorAll('[class*="option-a-module"], [class*="shared-module"]').length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        studioBar: !!document.querySelector('[class*="studio-bar"], header[class*="StudioBar"]'),
      };
    });
    console.log(`${label.padEnd(9)} ${String(w).padEnd(5)} spine:${r.spine?1:0} sheet:${r.sheet?1:0} dock:${r.dock?1:0} tabs:${r.seg?1:0} cards:${String(r.cards).padEnd(3)} interior:${String(r.interior).padEnd(3)} hOverflow:${r.overflow?"YES":"no"} oldBar:${r.studioBar?"YES":"no"}`);
    await p.close();
  }
}
console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();
