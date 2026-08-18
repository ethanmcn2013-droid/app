import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });

// measure helper: chars per line for a text element
const cpl = async (sel) => p.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  // measure actual line count via Range rects
  const range = document.createRange(); range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter(x=>x.width>2);
  const lines = new Set(rects.map(x=>Math.round(x.top))).size;
  const text = el.innerText.replace(/\s+/g," ").trim();
  return { sel, w: Math.round(r.width), fs: cs.fontSize, lh: cs.lineHeight, ls: cs.letterSpacing,
           maxW: cs.maxWidth, chars: text.length, lines, cpl: lines? Math.round(text.length/lines): null,
           wrap: cs.textWrap || cs.textWrapStyle, hyphens: cs.hyphens };
}, sel);

await p.goto(BASE + "?v=locked&state=notebook");
await p.waitForTimeout(400);
console.log("== notebook: index head vs day label ==");
console.log(await p.evaluate(() => {
  const g = (s)=>{const e=document.querySelector(s); if(!e) return null; const c=getComputedStyle(e);
    return {t:e.innerText.trim().slice(0,30), fs:c.fontSize, fw:c.fontWeight, ls:c.letterSpacing, tt:c.textTransform, col:c.color};};
  return { indexHead:g(".indexHead"), day:g(".idxDay"), cnt:g(".indexHead .cnt") };
}));

console.log("== timestamps column ==");
console.log(await p.evaluate(() => [...document.querySelectorAll(".idxWhen")].map(e=>e.innerText.trim())));
console.log(await p.evaluate(() => { const e=document.querySelector(".idxWhen"); const c=getComputedStyle(e); return {fvn:c.fontVariantNumeric, cls:e.className}; }));
console.log("day labels:", await p.evaluate(()=>[...document.querySelectorAll(".idxDay")].map(e=>e.innerText.trim())));

// type into the writing field
console.log("== writing field measure ==");
const long = "We should probably move the ceremony indoors if the forecast holds because the orchard gets very exposed after four in the afternoon and the chairs take eighteen minutes to reset which is longer than the gap between the drinks and the speeches.";
await p.click(".topField");
await p.type(".topField", long, { delay: 0 });
await p.waitForTimeout(300);
console.log(await p.evaluate(() => {
  const el = document.querySelector(".topField");
  const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  // approximate chars per line by measuring text width of one full line
  const cv = document.createElement("canvas").getContext("2d");
  cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const s = el.value; const avg = cv.measureText(s).width / s.length;
  return { width: Math.round(r.width), maxWidth: cs.maxWidth, fontSize: cs.fontSize, lineHeight: cs.lineHeight,
           avgCharPx: +avg.toFixed(2), charsPerLine: Math.round(r.width/avg), scrollH: el.scrollHeight };
}));
await p.screenshot({ path: "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/typed.png" });

await b.close();
