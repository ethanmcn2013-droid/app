import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
await p.goto(base + "?state=notebook"); await p.waitForTimeout(400);
await p.evaluate(()=>{[...document.querySelectorAll('.idxRow')][2].click()});
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(()=>{
  const d=document.querySelector('.desk');
  const info=(n)=>{ if(!n) return null; const r=n.getBoundingClientRect(); const c=getComputedStyle(n); return {rect:[r.x|0,r.y|0,r.width|0,r.height|0], display:c.display, vis:c.visibility, op:c.opacity, ovf:c.overflow, pos:c.position, clip:c.clipPath}; };
  const send=[...document.querySelectorAll('button')].find(x=>/Send to Tasks/.test(x.textContent));
  return {desk:info(d), send:info(send), scrollY:scrollY, docH:document.documentElement.scrollHeight, innerH:innerHeight,
    deskParent: d? info(d.parentElement):null, deskParentCls: d?d.parentElement.className:null};
}), null, 1));
// is the send button hit-testable / visible to a user
const send = await p.$('button:has-text("Send to Tasks")');
console.log("send visible per playwright:", send ? await send.isVisible() : "missing");
if(send){ try{ await send.scrollIntoViewIfNeeded(); const bb=await send.boundingBox(); console.log("bbox after scrollIntoView", JSON.stringify(bb), "scrollY", await p.evaluate(()=>scrollY)); await p.screenshot({path:out+"p-read-scrolled.png"});}catch(e){console.log("err",e.message)} }
// tab order on phone from rest: does an invisible desk button receive focus?
await p.goto(base + "?state=notebook"); await p.waitForTimeout(300);
await p.evaluate(()=>{[...document.querySelectorAll('.idxRow')][2].click()});
await p.waitForTimeout(600);
await p.evaluate(()=>document.body.focus());
const seq=[];
for(let i=0;i<10;i++){ await p.keyboard.press("Tab"); seq.push(await p.evaluate(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return (a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,40)+" @"+[r.x|0,r.y|0,r.width|0,r.height|0]})); }
console.log("phone tab seq:", JSON.stringify(seq,null,1));
await b.close();
