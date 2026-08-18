import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });

const probe = async (sel) => p.evaluate((sel) => {
  const el = document.querySelector(sel); if(!el) return {sel, missing:true};
  const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(el);
  const tops = [...range.getClientRects()].filter(x=>x.width>1).map(x=>Math.round(x.top));
  const lines = new Set(tops).size;
  const txt = el.innerText.replace(/\s+/g," ").trim();
  // last-line word count via measuring
  const cv = document.createElement("canvas").getContext("2d");
  cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const avg = cv.measureText(txt).width / txt.length;
  return { sel, w:Math.round(r.width), maxW:cs.maxWidth, fs:cs.fontSize, lh:cs.lineHeight, ls:cs.letterSpacing,
           chars:txt.length, lines, cplMeasured: Math.round(r.width/avg), textWrap: cs.textWrap, hyphens: cs.hyphens };
}, sel);

// pressure: long read note
await p.goto(BASE + "?v=locked&state=pressure"); await p.waitForTimeout(400);
console.log("PRESSURE readBody:", await probe(".readBody"));
// notebook read state: open a note from the index
await p.goto(BASE + "?v=locked&state=notebook"); await p.waitForTimeout(300);
await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
await p.evaluate(()=>{ const r=document.querySelectorAll(".idxRow")[2]; r.focus(); r.click(); });
await p.waitForTimeout(400);
console.log("READ readBody:", await probe(".readBody"));
console.log("readSrc:", await p.evaluate(()=>document.querySelector(".readSrc")?.innerText.replace(/\n/g," | ")));

// review
await p.goto(BASE + "?v=locked&state=review"); await p.waitForTimeout(400);
console.log("HAND title:", await probe(".handTitle"));
console.log("HAND body:", await probe(".handBody"));

// readback
await p.goto(BASE + "?v=locked&state=readback"); await p.waitForTimeout(400);
console.log("saidWas:", await probe(".saidWas"));
console.log("piece:", await probe(".piece"));

// voice
await p.goto(BASE + "?v=locked&state=voice"); await p.waitForTimeout(400);
console.log("darkSaid:", await probe(".darkSaid"));
console.log("darkNote:", await probe(".darkNote"));

// nothing - widows
await p.goto(BASE + "?v=locked&state=nothing"); await p.waitForTimeout(400);
console.log("emptyBodies:", await p.evaluate(()=>[...document.querySelectorAll(".emptyBody")].map(e=>{
  const cs=getComputedStyle(e); const range=document.createRange(); range.selectNodeContents(e);
  const rects=[...range.getClientRects()].filter(x=>x.width>1);
  const byTop={}; rects.forEach(r=>{const k=Math.round(r.top); byTop[k]=(byTop[k]||0)+r.width;});
  const keys=Object.keys(byTop).map(Number).sort((a,b)=>a-b);
  const last=byTop[keys[keys.length-1]], full=Math.max(...Object.values(byTop));
  return {text:e.innerText.replace(/\s+/g," ").slice(0,70), lines:keys.length, lastLineFrac:+(last/full).toFixed(2), textWrap:cs.textWrap, maxW:cs.maxWidth};
})));
await b.close();
