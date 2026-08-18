import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(base + "?state=seam");
await p.waitForTimeout(600);
const csfn = `(e) => { const c = getComputedStyle(e); return { fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, color: c.color, ls: c.letterSpacing }; }`;
const r = await p.evaluate(() => {
  const s = document.querySelector(".peelFrom span");
  const f = document.querySelector(".peelField");
  const lab = document.querySelector(".peelFrom b");
  const wl = document.querySelector("#peel-label");
  const bd = document.querySelector(".peelBoundary");
  const cs = (e) => { const c = getComputedStyle(e); return { fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, color: c.color, ls: c.letterSpacing }; };
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    pickedText: s ? s.textContent : null, pickedStyle: s ? cs(s) : null, pickedBox: s ? box(s) : null,
    fieldValue: f ? f.value : null, fieldStyle: f ? cs(f) : null, fieldBox: f ? box(f) : null,
    sourceLabel: lab ? lab.textContent : null, wordingLabel: wl ? wl.textContent : null,
    boundary: bd ? bd.textContent : null,
    identical: s && f ? s.textContent.trim() === f.value.trim() : null,
    peelFromBg: document.querySelector(".peelFrom") ? getComputedStyle(document.querySelector(".peelFrom")).backgroundColor : null,
    markedInNote: !!document.querySelector(".pick"),
    markText: document.querySelector(".pick") ? document.querySelector(".pick").textContent : null,
  };
});
console.log(JSON.stringify(r, null, 2));
await p.screenshot({ path: out + "seam.png" });
const el = await p.$(".peel");
if (el) await el.screenshot({ path: out + "peel.png" });
await b.close();
