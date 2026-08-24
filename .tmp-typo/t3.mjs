import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
async function run(u, tag, w=1440){
const p = await b.newPage({ viewport: { width: w, height: 960 } });
await p.goto(u); await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  function L(el){
    const n = [...el.childNodes].find(x=>x.nodeType===3 && x.textContent.trim());
    if(!n) return null;
    const rng=document.createRange(); rng.selectNodeContents(n);
    const rects=[...rng.getClientRects()].filter(x=>x.width>0);
    const box=el.getBoundingClientRect();
    return rects.map(x=>({w:Math.round(x.width), fill:Math.round(x.width/box.width*100), left:Math.round(x.left-box.left)}));
  }
  const o={};
  const grab=(sel)=>[...document.querySelectorAll(sel)].map(n=>({t:n.textContent.trim().slice(0,70), L:L(n)}));
  o.titles=grab(".cardTitle"); o.notes=grab(".cardNote");
  o.trayNote=grab(".trayNote");
  o.specNote=grab(".specNote"); o.specIntro=grab(".specIntro");
  o.drawerRow=grab(".drawerRow > span"); o.drawerHelp=grab(".drawerHelp"); o.drawerSummary=grab(".drawerSummary");
  o.empty=grab(".emptyBoard p, .emptyLead, .emptyBoard *");
  return o;
});
console.log("### "+tag);
for(const k of Object.keys(r)){
  const rows = r[k].filter(x=>x.L && x.L.length>1);
  for(const row of rows){
    const last = row.L[row.L.length-1];
    if(last.fill < 34) console.log(k, "WIDOW fill%="+last.fill, JSON.stringify(row.t), row.L.map(x=>x.fill).join("/"));
  }
  const all = r[k].filter(x=>x.L);
  if(k==="titles"||k==="notes") for(const row of all) console.log("  ."+k, row.L.map(x=>x.fill).join("/"), JSON.stringify(row.t));
}
await p.close();
}
await run(url,"board");
await run(url+"?state=planning","planning");
await run(url+"?state=empty","empty");
await run(url+"?state=dense","dense");
await b.close();
