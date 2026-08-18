import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch:true, isMobile:true });
await p.goto(BASE + "?v=locked&state=notebook"); await p.waitForTimeout(700);

const clip = async () => p.evaluate(() => [...document.querySelectorAll(".idxText")].map(e => {
  const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { txt: e.innerText.trim(), w: Math.round(r.width), scrollW: e.scrollWidth,
           overflowPx: e.scrollWidth - Math.ceil(r.width), tOverflow: cs.textOverflow, ws: cs.whiteSpace,
           endsEllipsis: /[…]$/.test(e.innerText.trim()) };
}));
console.log("== 390 fresh load ==");
console.table(await clip());

console.log("== after resize 1440 -> 390 ==");
await p.setViewportSize({width:1440,height:960}); await p.waitForTimeout(400);
await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(700);
console.table(await clip());

console.log("phoneField:", await p.evaluate(()=>{const e=document.querySelector(".phoneField"); if(!e) return null;
 const c=getComputedStyle(e); const r=e.getBoundingClientRect();
 const cv=document.createElement("canvas").getContext("2d"); cv.font=`${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
 const s="the quick brown fox jumps over the lazy dog and keeps going"; const avg=cv.measureText(s).width/s.length;
 return {w:Math.round(r.width), fs:c.fontSize, lh:c.lineHeight, cpl:Math.round(r.width/avg), ph:e.placeholder};}));

// capture from the dock on phone
await p.click(".phoneField");
await p.type(".phoneField","Confirm the marquee sides with the hire company before Thursday", {delay:0});
await p.waitForTimeout(200);
await p.screenshot({path:"C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/phone-typed.png"});
await p.keyboard.press("Control+Enter"); await p.waitForTimeout(500);
console.log("undo bar:", await p.evaluate(()=>{const e=document.querySelector(".undo"); if(!e) return null; const r=e.getBoundingClientRect(); const c=getComputedStyle(e); return {txt:e.innerText.replace(/\n/g," | "), w:Math.round(r.width), fs:c.fontSize, bottom:Math.round(r.bottom), vh:innerHeight};}));
await p.screenshot({path:"C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/phone-after.png"});
await b.close();
