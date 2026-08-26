import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b = await chromium.launch();
const p = await b.newPage();
for (const w of [390,768,1280,1440,1920]) {
  for (const st of ["notes.notebook","notes.seam"]) {
    await p.setViewportSize({width:w,height:1000});
    await p.goto(`${base}?v=paper&state=${st}`);
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const g = (s) => { const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return {l:+r.left.toFixed(1), w:+r.width.toFixed(1), pl:cs.paddingLeft, gap:cs.columnGap, tpl:cs.gridTemplateColumns}; };
      return {
        mark: g(".wordmark") || g("[class*=wordmark]"),
        desk: g(".desk"), deskCard: g(".paperTop") || g(".top"),
        topField: g(".topField"), readBody: g(".readBody"),
        deskWrite: g(".deskWrite"),
        index: g(".index"), idxDay: g(".idxDay"), idxRow: g(".idxRow"),
        idxText: g(".idxText"), idxMark: g(".idxMark"),
      };
    });
    console.log(w, st, JSON.stringify(r,null,1));
  }
}
await b.close();
