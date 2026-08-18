import { chromium } from "@playwright/test";
import path from "node:path";
const FILE = "file:///" + path.resolve("docs/design/labs/notes-2026-08/notebook.html").split("\\").join("/");
const b = await chromium.launch();
async function open(q="", vp={width:1440,height:960}) {
  const p = await b.newPage({viewport:vp});
  await p.goto(FILE+q,{waitUntil:"load"}); await p.waitForTimeout(400);
  try{await p.evaluate(()=>document.fonts.ready);}catch(e){}
  await p.waitForTimeout(200); return p;
}
const log=(...a)=>console.log(...a);

/* T1: cost of the first keystroke (the live threshold repaint) under pressure */
for (const st of ["notebook","pressure"]) {
  const p = await open("?state="+st);
  const t = await p.evaluate(()=>{
    const f=document.querySelector(".topField"); f.focus();
    const times=[];
    for (const ch of ["R","i","n","g"," ","t","h","e"]) {
      const t0=performance.now();
      f.value+=ch;
      f.dispatchEvent(new Event("input",{bubbles:true}));
      times.push(+(performance.now()-t0).toFixed(2));
      // re-find because paint may have replaced it
      const nf=document.querySelector(".topField"); if(nf!==f) { /*replaced*/ }
    }
    return times;
  });
  log("T1", st, "per-keystroke ms (first is the live-threshold repaint):", JSON.stringify(t));
  await p.close();
}
/* T2: search keystroke cost under pressure (full repaint + trimRows per key) */
{
  const p = await open("?state=pressure");
  await p.keyboard.press("/"); await p.waitForTimeout(250);
  const t = await p.evaluate(()=>{
    const times=[];
    for (const ch of ["o","r","c","h","a","r","d"]) {
      const q=document.getElementById("q"); q.focus();
      const t0=performance.now();
      q.value+=ch; q.dispatchEvent(new Event("input",{bubbles:true}));
      times.push(+(performance.now()-t0).toFixed(1));
    }
    return times;
  });
  log("T2 search keystrokes on 36 notes, ms:", JSON.stringify(t));
  await p.close();
}
/* T3: a long draft squeezing the index */
{
  const p = await open();
  const long = Array.from({length:120},(_,i)=>"word"+i).join(" ");
  await p.locator(".topField").fill(long);
  await p.waitForTimeout(300);
  const r = await p.evaluate(()=>{
    const idx=document.getElementById("index");
    const desk=document.querySelector(".desk").getBoundingClientRect();
    const ib=idx.getBoundingClientRect();
    const head=document.querySelector(".indexHead").getBoundingClientRect();
    const dock=document.querySelector(".dock").getBoundingClientRect();
    return { deskH:Math.round(desk.height), indexH:Math.round(ib.height), indexTop:Math.round(ib.top), indexBottom:Math.round(ib.bottom), dockTop:Math.round(dock.top), visibleRows:[...document.querySelectorAll(".idxRow")].filter(r=>{const b=r.getBoundingClientRect(); return b.top>=ib.top-1 && b.bottom<=dock.top;}).length, headVisible: head.bottom<=ib.top+1 };
  });
  log("T3 long draft:", JSON.stringify(r));
  await p.close();
}
/* T4: phone capture */
{
  const p = await open("", {width:390,height:844});
  await p.locator(".phoneField").click();
  await p.locator(".phoneField").type("Ring the marquee company back about the side panels before four.");
  await p.waitForTimeout(300);
  const r = await p.evaluate(()=>{
    const dock=document.querySelector(".dock").getBoundingClientRect();
    const idx=document.getElementById("index");
    const acts=[...document.querySelectorAll(".dock [data-act]")].map(a=>a.dataset.act);
    return { dockTop:Math.round(dock.top), dockH:Math.round(dock.height), vh:innerHeight, dockActs:acts,
      keepControl: document.querySelectorAll('[data-act="keep"]').length,
      indexPadBottom:getComputedStyle(idx).paddingBottom,
      indexBottom:Math.round(idx.getBoundingClientRect().bottom) };
  });
  log("T4 phone with a 64-char draft:", JSON.stringify(r));
  // is there ANY visible way to save on a phone?
  log("T4 visible save affordance count:", await p.locator('[data-act="keep"]').count());
  await p.close();
}
/* T5: the hand's settle — does handTop actually transition? */
{
  const p = await open("?state=review");
  const cs = await p.evaluate(()=>{const c=getComputedStyle(document.querySelector(".handTop"));return {tp:c.transitionProperty,td:c.transitionDuration};});
  log("T5 .handTop transition:", JSON.stringify(cs));
  const s=[];
  await p.keyboard.press("t");
  for(let i=0;i<8;i++){ s.push(await p.evaluate(()=>{const t=document.querySelector(".handTop");return t?{o:getComputedStyle(t).opacity,tr:getComputedStyle(t).transform.slice(0,30)}:null;})); await p.waitForTimeout(30);}
  log("T5 samples:", JSON.stringify(s));
  await p.close();
}
/* T6: the three rooms render without breaking */
for (const v of ["locked","quiet","studio","press"]) {
  const p = await open("?v="+v);
  const r = await p.evaluate(()=>({rows:document.querySelectorAll(".idxRow").length, over:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  log("T6", v, JSON.stringify(r));
  await p.close();
}
await b.close();
