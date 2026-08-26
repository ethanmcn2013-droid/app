import { chromium } from "@playwright/test";
const B="file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:960}});
await p.goto(B+"?v=paper&state=tasks.board"); await p.waitForTimeout(800);

// what would a LIVE segItem look like?
console.log("live-segItem-if-enabled:", await p.evaluate(()=>{
  const s=[...document.querySelectorAll('[data-app="tasks"] .segItem')].find(e=>e.textContent.trim()==="List");
  s.removeAttribute("aria-disabled");
  const cs=getComputedStyle(s); const g=getComputedStyle(s.querySelector("svg"));
  const r={color:cs.color,w:cs.fontWeight,cursor:cs.cursor,svg:g.color};
  s.setAttribute("aria-disabled","true"); return r;
}));

const snap=()=>p.evaluate(()=>{
  const m=new Map();
  document.querySelectorAll("*").forEach((el,i)=>{
    const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    m.set(i,[el.tagName+"."+String(el.className).slice(0,24),Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height),cs.opacity,cs.backgroundColor,cs.color,cs.transform,(el.textContent||"").trim().slice(0,40)].join("|"));
  });
  return [...m.values()];
});
for (const sel of ['.rail [data-rail="home"]','[data-app="tasks"] .segItem[aria-disabled="true"]']) {
  const before=await snap();
  await p.click(sel);
  await p.waitForTimeout(120);
  const mid=await snap();
  await p.waitForTimeout(1500);
  const after=await snap();
  const diff=(a,c)=>{const d=[];const n=Math.max(a.length,c.length);for(let i=0;i<n;i++) if(a[i]!==c[i]) d.push(">"+a[i]+"\n<"+c[i]); return d;};
  console.log("\n=== "+sel+" @120ms ==="); console.log(diff(before,mid).slice(0,12).join("\n")||"NO CHANGE");
  console.log("--- @1.6s ---"); console.log(diff(before,after).slice(0,8).join("\n")||"NO CHANGE");
}
await b.close();
