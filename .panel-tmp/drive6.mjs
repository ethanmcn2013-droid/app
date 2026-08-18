import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:960}});
for (const st of ["notebook","seam","pressure","readback"]) {
  await p.goto(`${BASE}?state=${st}&v=locked`); await p.waitForTimeout(400);
  const m = await p.evaluate(()=>{
    const sheet=document.querySelector('.sheet').getBoundingClientRect();
    const wid = n => n? Math.round(n.getBoundingClientRect().width):null;
    const rightmost = [...document.querySelectorAll('.sheet *')].filter(e=>e.children.length===0&&(e.innerText||'').trim()).reduce((a,e)=>Math.max(a,e.getBoundingClientRect().right),0);
    return {sheetW:Math.round(sheet.width), sheetRight:Math.round(sheet.right), contentRight:Math.round(rightmost), deadRight: Math.round(sheet.right-rightmost)};
  });
  console.log(st, JSON.stringify(m));
}
await p.goto(BASE+"?state=notebook&v=locked"); await p.waitForTimeout(300);
console.log("badge:", await p.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(e=>/^\d+ to decide$/.test((e.innerText||'').trim())); return n?{tag:n.tagName, act:n.getAttribute('data-act'), tab:n.tabIndex, cls:n.className}:null;}));
// rooms
for (const v of ["locked","quiet","studio","press"]) {
  await p.goto(`${BASE}?state=notebook&v=${v}`); await p.waitForTimeout(400);
  await p.screenshot({path:`C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/room-${v}.png`, clip:{x:0,y:0,width:1440,height:520}});
}
await b.close();
