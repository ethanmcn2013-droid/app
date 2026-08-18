import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(base + "?state=seam");
await p.waitForTimeout(500);
// does the field look editable on focus / hover?
await p.locator(".peelField").click();
await p.waitForTimeout(250);
const focused = await p.evaluate(() => {
  const f = document.querySelector(".peelField");
  const c = getComputedStyle(f);
  return { active: document.activeElement === f, outline: c.outline, boxShadow: c.boxShadow, bg: c.backgroundColor, border: c.border };
});
console.log("FOCUS:", JSON.stringify(focused));
await p.locator(".peel").screenshot({ path: out + "peel-focus.png" });
// edit it and see divergence
await p.keyboard.press("Control+a");
await p.keyboard.type("Switch heaters on before guests arrive");
await p.waitForTimeout(300);
const after = await p.evaluate(() => ({
  picked: document.querySelector(".peelFrom span").textContent,
  wording: document.querySelector(".peelField").value,
}));
console.log("AFTER EDIT:", JSON.stringify(after));
await p.locator(".peel").screenshot({ path: out + "peel-edited.png" });
// weights of other writing surfaces
for (const [st, sel] of [["notebook",".topField"],["readback",".pieceField"],["review",".handBody"]]) {
  const q = await b.newPage({ viewport: { width: 1440, height: 960 } });
  await q.goto(base + "?state=" + st); await q.waitForTimeout(400);
  const s = await q.evaluate((s) => { const e = document.querySelector(s); if(!e) return null; const c = getComputedStyle(e); return { fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight }; }, sel);
  console.log(st, sel, JSON.stringify(s));
  await q.close();
}
await b.close();
