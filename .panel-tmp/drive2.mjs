import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const S="C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:2 });
await p.goto(BASE+"?state=notebook&v=locked");
await p.waitForTimeout(500);
const f = p.locator("textarea").first();
await f.click();
await f.fill("Ask the florist to arrive at seven, not eight, on the Saturday");
await p.keyboard.press("Control+Enter");
for (const ms of [120, 400, 1200]) {
  await p.waitForTimeout(ms===120?120:ms-(ms===400?120:400));
  await p.screenshot({path:S+`save-t${ms}.png`});
  const strip = await p.evaluate(()=>{
    const n=[...document.querySelectorAll('*')].filter(e=>/Undo/.test(e.textContent||'')&&e.querySelectorAll('*').length<8);
    return n.length? n[n.length-1].innerText.replace(/\n/g,' | ') : null;});
  const rect = await p.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(e=>/Undo/.test(e.textContent||'')&&e.querySelectorAll('*').length<8); if(!n)return null; const r=n.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};});
  console.log(ms, "strip:", strip, "rect:", JSON.stringify(rect));
}
// what is under the strip
console.log("occluded:", await p.evaluate(()=>{
  const n=[...document.querySelectorAll('*')].find(e=>/Undo/.test(e.textContent||'')&&e.querySelectorAll('*').length<8);
  if(!n) return null; const r=n.getBoundingClientRect();
  const el=document.elementsFromPoint(r.x+r.width/2, r.y+r.height/2);
  return el.slice(0,6).map(e=>e.className&&e.className.baseVal===undefined?String(e.className).slice(0,40):e.tagName);
}));
// which row carries the "current" highlight after capture
console.log("current row:", await p.evaluate(()=>{
  const c=[...document.querySelectorAll('[aria-current], [class*="current"], [class*="-is-"], [data-current]')].map(e=>e.className+" :: "+(e.innerText||'').slice(0,60).replace(/\n/g,' '));
  return c.slice(0,6);}));
// how long the strip lives
let gone=-1; const t=Date.now();
for(let i=0;i<200;i++){ const has=await p.evaluate(()=>[...document.querySelectorAll('*')].some(e=>/Undo/.test(e.textContent||'')&&e.querySelectorAll('*').length<8)); if(!has){gone=Date.now()-t;break;} await p.waitForTimeout(100);}
console.log("strip lifetime after t=1200ms:", gone);
await b.close();
