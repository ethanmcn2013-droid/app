import { chromium } from "@playwright/test";
const URL="file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=tasks.board";
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:960}});
await p.goto(URL); await p.waitForTimeout(800);
const out=await p.evaluate(()=>{
  const rows=[]; const seen=new Set();
  document.querySelectorAll('.rail button, .rail [data-rail], [data-app="tasks"] .ghost, [data-app="tasks"] .segItem, [data-app="tasks"] .dockField, [data-app="tasks"] .dockAvatar, [data-app="tasks"] .dockPrimary').forEach(el=>{
    if(seen.has(el))return; seen.add(el);
    const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
    if(r.width===0) return;
    rows.push({cls:String(el.className).slice(0,30), rail:el.dataset.rail||"", txt:(el.textContent||"").trim().slice(0,20),
      dis:el.getAttribute("aria-disabled"), active:el.hasAttribute("data-active"),
      color:cs.color, w:cs.fontWeight, cursor:cs.cursor, bg:cs.backgroundColor, op:cs.opacity,
      svg:(()=>{const s=el.querySelector("svg");return s?getComputedStyle(s).color:null;})(),
      box:[Math.round(r.width),Math.round(r.height)]});
  });
  return rows;
});
console.table(out.map(r=>({t:r.txt||r.rail,cls:r.cls,dis:r.dis,act:r.active,color:r.color,w:r.w,cur:r.cursor,svg:r.svg})));
await b.close();
