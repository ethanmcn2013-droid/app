import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const S="C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:2 });
await p.goto(BASE+"?state=notebook&v=locked"); await p.waitForTimeout(400);
const f = p.locator("textarea").first(); await f.click();
await f.fill("Ask the florist to arrive at seven, not eight, on the Saturday");
await p.evaluate(()=>{ window.__frames=[]; });
await p.keyboard.press("Control+Enter");
for (const t of [40,90,150,210,300]) {
  await p.waitForTimeout(t===40?40:50);
  const st = await p.evaluate(()=>{const top=document.querySelector('.top'); const cs=top?getComputedStyle(top):null;
    return {settling: top?top.hasAttribute('data-settling'):null, opacity: cs?cs.opacity:null, transform: cs?cs.transform:null, fieldValue: (document.querySelector('.topField')||{}).value};});
  console.log(t, JSON.stringify(st));
  await p.screenshot({path:S+`arrive-${t}.png`, clip:{x:150,y:80,width:1250,height:480}});
}
await p.close();

// ---- PHONE ----
const m = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await m.goto(BASE+"?state=notebook&v=locked"); await m.waitForTimeout(500);
// scroll index to bottom
await m.evaluate(()=>{ const sc=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+8); sc.forEach(e=>e.scrollTop=e.scrollHeight); window.scrollTo(0,document.body.scrollHeight); });
await m.waitForTimeout(300);
await m.screenshot({path:S+"phone-bottom.png"});
// does the dock cover the last row?
console.log("phone overlap:", await m.evaluate(()=>{
  const dock=document.querySelector('[class*="dock"]'); const rows=[...document.querySelectorAll('.idxRow')];
  if(!dock||!rows.length) return "no dock/rows";
  const d=dock.getBoundingClientRect(); const last=rows[rows.length-1].getBoundingClientRect();
  const covered = rows.filter(r=>{const b=r.getBoundingClientRect(); return b.bottom>d.top+2 && b.top<d.bottom;}).map(r=>r.innerText.replace(/\n/g,' ').slice(0,44));
  return {dockTop:Math.round(d.top), dockBottom:Math.round(d.bottom), lastRowBottom:Math.round(last.bottom), covered};
}));
// truncation quality on phone
console.log("phone titles:", await m.evaluate(()=>[...document.querySelectorAll('.idxRow')].slice(0,8).map(r=>{
  const t=r.querySelector('[class*="Title"], [class*="title"], b, strong')|| r.querySelector('.idxText');
  const el=t||r; const cs=getComputedStyle(el);
  return {shown:(el.innerText||'').split('\n')[0].slice(0,50), overflowX: el.scrollWidth>el.clientWidth+1 ? `CLIPPED ${el.scrollWidth}>${el.clientWidth}`:'ok', ellipsis: cs.textOverflow};
})));
await m.close();
await b.close();
