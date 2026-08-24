import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
for (const [state, vp] of [["pressure",{width:1440,height:960}],["pressure",{width:1440,height:800}],["seam",{width:1440,height:960}],["notebook",{width:1440,height:960}]]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto(BASE + "?state=" + state); await p.waitForTimeout(500);
  if (state === "pressure") { await p.locator(".readBody").focus(); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(150); await p.keyboard.press("Enter"); await p.waitForTimeout(450); }
  const r = await p.evaluate(() => {
    const g = s => { const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return {y:Math.round(b.y),h:Math.round(b.height),bot:Math.round(b.bottom),x:Math.round(b.x),w:Math.round(b.width)}; };
    const idx = document.querySelector("#index");
    const rows = [...document.querySelectorAll(".idxRow")];
    const vh = innerHeight;
    const dock = document.querySelector(".dock");
    const dr = dock ? dock.getBoundingClientRect() : null;
    const visRows = rows.filter(e=>{const b=e.getBoundingClientRect(); return b.top < (dr?dr.top:vh) && b.bottom > 0;}).length;
    return { vh, index:g("#index"), indexScrollH: idx?idx.scrollHeight:null, rows: rows.length, visRows,
      idxPadBottom: idx?getComputedStyle(idx).paddingBottom:null,
      dock: dr?{y:Math.round(dr.y),h:Math.round(dr.height)}:null,
      peel:g(".peel"), desk:g(".desk"), head:g(".idxTop, .indexTop, .idxHead"),
      idxHeadText: (document.querySelector(".idxTop,.indexTop,.idxHead")||{textContent:""}).textContent.replace(/\s+/g,' ').trim().slice(0,80) };
  });
  console.log(state, vp.height, JSON.stringify(r));
  await p.close();
}
await b.close();
