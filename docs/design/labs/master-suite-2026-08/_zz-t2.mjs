import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b = await chromium.launch();
for (const w of [390,380,360]) {
  const ctx = await b.newContext({ viewport:{width:w,height:844}, hasTouch:true });
  const p = await ctx.newPage();
  await p.goto(base+"?v=paper&state=notes.notebook");
  await p.waitForTimeout(500);
  const out = await p.evaluate(() => {
    const dock=document.querySelector(".dock");
    const dr=dock.getBoundingClientRect();
    const kids=[...dock.children].map(e=>{const r=e.getBoundingClientRect();return {c:e.className,x:Math.round(r.x),w:Math.round(r.width),h:Math.round(r.height),disp:getComputedStyle(e).display};});
    const row = dock.querySelector(".dockRow")||dock;
    const btns=[...dock.querySelectorAll("button,.railGroup")].map(e=>{const r=e.getBoundingClientRect();return {c:(e.dataset.act||e.className),x:Math.round(r.x),right:Math.round(r.right),w:Math.round(r.width)};});
    return {dock:{x:Math.round(dr.x),w:Math.round(dr.width),h:Math.round(dr.height)},kids,btns};
  });
  console.log("== width "+w); console.log(JSON.stringify(out,null,1));
  await ctx.close();
}
// tab order at 390 tasks
const ctx = await b.newContext({ viewport:{width:390,height:844}, hasTouch:true });
const p = await ctx.newPage();
await p.goto(base+"?v=paper&state=tasks.board");
await p.waitForTimeout(500);
const seq=[];
for (let i=0;i<60;i++){ await p.keyboard.press("Tab"); const d=await p.evaluate(()=>{const a=document.activeElement;return a?(a.dataset.rail||a.dataset.act||a.getAttribute("aria-label")||a.tagName):"none";}); seq.push(d); }
console.log("TAB@390 tasks:", JSON.stringify(seq));
await b.close();
