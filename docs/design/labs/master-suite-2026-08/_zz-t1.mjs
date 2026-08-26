import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b = await chromium.launch();
for (const st of ["tasks.board","timeline.owner-flight","notes.notebook"]) {
  const ctx = await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:false, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto(base+"?v=paper&state="+st);
  await p.waitForTimeout(600);
  const out = await p.evaluate(() => {
    const deck = document.querySelector("#deck");
    const rail = document.querySelector(".rail");
    const rr = rail ? rail.getBoundingClientRect() : null;
    const tiles = [...document.querySelectorAll(".rail [data-rail]")].map(e=>{
      const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
      return {k:e.dataset.rail, w:Math.round(r.width), h:Math.round(r.height), disp:cs.display, ti:e.tabIndex, label:e.getAttribute("aria-label"), title:e.getAttribute("title")};
    });
    // dock in notes
    const dock = document.querySelector(".dock");
    const dockBtns = dock ? [...dock.querySelectorAll("button")].map(e=>{const r=e.getBoundingClientRect();return {act:e.dataset.act||e.className, w:Math.round(r.width),h:Math.round(r.height), label:e.getAttribute("aria-label"), title:e.getAttribute("title")};}) : null;
    const dr = dock? dock.getBoundingClientRect():null;
    return {product:deck?.dataset.product, rail: rr&&{w:Math.round(rr.width),h:Math.round(rr.height)}, railDisplay: rail?getComputedStyle(rail).display:null, tiles, dock: dr&&{w:Math.round(dr.width),h:Math.round(dr.height)}, dockBtns};
  });
  console.log("=== "+st);
  console.log(JSON.stringify(out,null,1));
  // tab order
  const seq = await p.evaluate(async () => {
    return null;
  });
  await ctx.close();
}
await b.close();
