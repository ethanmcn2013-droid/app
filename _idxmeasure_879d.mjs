import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
async function meas(url, w=1440, h=960) {
  await p.setViewportSize({width:w,height:h});
  await p.goto(url);
  await p.waitForTimeout(700);
  return await p.evaluate(() => {
    const out = [];
    for (const r of document.querySelectorAll(".idxRow")) {
      const tag = r.querySelector(".idxTag"), when = r.querySelector(".idxWhen"), txt = r.querySelector(".idxText");
      const rr = r.getBoundingClientRect();
      out.push({
        row: [Math.round(rr.left), Math.round(rr.right)],
        tag: tag ? {t: tag.textContent, l: Math.round(tag.getBoundingClientRect().left), r: Math.round(tag.getBoundingClientRect().right), w: Math.round(tag.getBoundingClientRect().width)} : null,
        when: when ? {t: when.textContent, l: Math.round(when.getBoundingClientRect().left), r: Math.round(when.getBoundingClientRect().right), w: Math.round(when.getBoundingClientRect().width)} : null,
        txtW: txt ? Math.round(txt.getBoundingClientRect().width) : null,
      });
    }
    return out;
  });
}
for (const u of [base+"?state=notebook", base+"?state=notebook&v=press", base+"?state=pressure"]) {
  const rows = await meas(u);
  console.log("=== " + u + " rows:" + rows.length);
  const tl = [...new Set(rows.filter(r=>r.tag).map(r=>r.tag.l))].sort((a,b)=>a-b);
  const tr = [...new Set(rows.filter(r=>r.tag).map(r=>r.tag.r))].sort((a,b)=>a-b);
  const wl = [...new Set(rows.filter(r=>r.when).map(r=>r.when.l))].sort((a,b)=>a-b);
  const wr = [...new Set(rows.filter(r=>r.when).map(r=>r.when.r))].sort((a,b)=>a-b);
  console.log("tag lefts", tl, "tag rights", tr);
  console.log("when lefts", wl, "when rights", wr);
  console.log("tag labels+widths", [...new Set(rows.filter(r=>r.tag).map(r=>r.tag.t+":"+r.tag.w))]);
  console.log("when labels+widths", [...new Set(rows.filter(r=>r.when).map(r=>r.when.t+":"+r.when.w))]);
  console.log("row right", [...new Set(rows.map(r=>r.row[1]))]);
}
await b.close();
