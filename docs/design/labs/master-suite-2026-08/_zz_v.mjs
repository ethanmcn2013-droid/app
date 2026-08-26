import { chromium } from "@playwright/test";
const base = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
for (const s of ["notes.notebook","tasks.board","timeline.owner-flight"]) {
  await p.goto(base + s);
  await p.waitForTimeout(500);
  const t = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('[data-product]')].filter(e=>e.offsetParent!==null);
    return (vis[0]||document.body).innerText.slice(0, 2200);
  });
  console.log("=== " + s + " ===");
  console.log(t.replace(/\n{2,}/g,"\n"));
}
await b.close();
