import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
async function grab(state) {
  await p.goto(`${base}?state=${state}`);
  await p.waitForTimeout(400);
  return p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, a, [role=button]")) {
      const vis = (el.innerText || "").replace(/\s+/g, " ").trim();
      const an = el.getAttribute("aria-label") || vis;
      if (!vis) continue;
      const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      if (!norm(an).includes(norm(vis))) out.push({ cls: el.className, vis, an });
    }
    return out;
  });
}
for (const s of ["notebook", "review", "search", "seam", "pressure"]) {
  console.log("== " + s);
  console.log(JSON.stringify(await grab(s), null, 1));
}
await b.close();
