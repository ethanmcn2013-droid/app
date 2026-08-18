import { chromium } from "@playwright/test";
const FILE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const open = async (q="") => { const p = await ctx.newPage(); await p.goto(FILE + q); await p.waitForTimeout(400); return p; };

const probe = async (p, sels) => p.evaluate((sels) => {
  const out = [];
  for (const sel of sels) {
    for (const n of [...document.querySelectorAll(sel)].slice(0,2)) {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      const fs = parseFloat(cs.fontSize);
      out.push({
        sel, w: Math.round(r.width), h: Math.round(r.height),
        fs: +fs.toFixed(2), lh: cs.lineHeight, weight: cs.fontWeight,
        tr: cs.letterSpacing, tt: cs.textTransform, color: cs.color,
        fvn: cs.fontVariantNumeric, tw: cs.textWrap || cs.textWrapStyle,
        cplBox: Math.round(r.width / (fs * 0.45)),
        text: (n.textContent||"").trim().slice(0,80)
      });
    }
  }
  return out;
}, sels);

console.log("=== NOTEBOOK 1440 ===");
let p = await open("?state=notebook");
console.table(await probe(p, [".word",".headName",".chip",".indexHead",".indexHead .cnt",".idxDay",".groupBtn",".idxText",".idxTag",".idxWhen",".topField",".topMeta",".verb",".dockField"]));

// real rendered line length of the index row prose
console.log("--- index row geometry ---");
console.log(await p.evaluate(() => {
  const rows = [...document.querySelectorAll(".idxRow")].slice(0,4);
  const sheet = document.querySelector(".sheet").getBoundingClientRect();
  return rows.map(r => {
    const t = r.querySelector(".idxText");
    const rng = document.createRange(); rng.selectNodeContents(t);
    const rect = rng.getBoundingClientRect();
    const cs = getComputedStyle(t);
    const chars = t.textContent.trim().length;
    return { sheetW: Math.round(sheet.width), textBoxW: Math.round(t.getBoundingClientRect().width),
             inkW: Math.round(rect.width), chars, fs: cs.fontSize,
             cplRendered: Math.round(chars * (rect.width/Math.max(rect.width,1)) ),
             truncated: rect.width > t.getBoundingClientRect().width + 1 };
  });
}));

console.log("--- time column alignment (right edges) ---");
console.log(await p.evaluate(() => [...document.querySelectorAll(".idxWhen")].slice(0,8).map(n => {
  const rng=document.createRange(); rng.selectNodeContents(n); const r=rng.getBoundingClientRect();
  return { t:n.textContent.trim(), left:Math.round(r.left), right:Math.round(r.right), boxRight: Math.round(n.getBoundingClientRect().right), ta:getComputedStyle(n).textAlign };
})));

console.log("--- tag column ---");
console.log(await p.evaluate(() => [...document.querySelectorAll(".idxTag")].slice(0,8).map(n => {
  const r=n.getBoundingClientRect(); return { t:n.textContent.trim(), left:Math.round(r.left), right:Math.round(r.right), w:Math.round(r.width) };
})));
await p.close();

console.log("=== PRESSURE (read a 900-word note) ===");
p = await open("?state=pressure");
console.table(await probe(p, [".readSrc",".readBody",".readLong",".idxText",".indexHead .cnt"]));
console.log(await p.evaluate(() => {
  const body = document.querySelector(".readBody");
  const sheet = document.querySelector(".sheet").getBoundingClientRect();
  const top = document.querySelector(".top").getBoundingClientRect();
  const r = body.getBoundingClientRect();
  const cs = getComputedStyle(body);
  // count rendered lines
  const rng = document.createRange(); rng.selectNodeContents(body);
  const rects = [...rng.getClientRects()];
  const lh = parseFloat(cs.lineHeight);
  const lines = Math.round(r.height/lh);
  return { sheetW: Math.round(sheet.width), topW: Math.round(top.width), bodyW: Math.round(r.width),
    voidRight: Math.round(top.right - r.right), lines, lh, fs: cs.fontSize,
    charsTotal: body.textContent.trim().length, cplAvg: Math.round(body.textContent.trim().length/lines) };
}));
await p.close();

console.log("=== NOTHING ===");
p = await open("?state=nothing");
console.table(await probe(p, [".emptyTitle",".emptyBody",".specName",".specWhy",".spec .emptyTitle"]));
await p.close();

console.log("=== VOICE ===");
p = await open("?state=voice");
console.table(await probe(p, [".darkTag",".darkTime",".darkSaid",".darkNote",".darkAct"]));
console.log(await p.evaluate(()=>{
  const s=document.querySelector(".darkSaid"); const n=document.querySelector(".darkNote");
  const cs=getComputedStyle(s); const r=s.getBoundingClientRect();
  return { saidW:Math.round(r.width), cpl: Math.round(s.textContent.trim().length / Math.round(r.height/parseFloat(cs.lineHeight))),
           noteW: Math.round(n.getBoundingClientRect().width), noteText: n.textContent.trim() };
}));
await p.close();

console.log("=== READBACK ===");
p = await open("?state=readback");
console.table(await probe(p, [".saidWas",".saidWas b",".piece",".pieceField"]));
await p.close();

console.log("=== REVIEW ===");
p = await open("?state=review");
console.table(await probe(p, [".handTitle",".handOf",".handBody",".deckNote"]));
await p.close();

console.log("=== SEAM ===");
p = await open("?state=seam");
console.table(await probe(p, [".peelLabel",".peelField",".peelWhy",".picker",".readBody"]));
await p.close();

console.log("=== NOT-YET ===");
p = await open("?state=not-yet");
console.table(await probe(p, [".state b",".state p",".skelSay"]));
await p.close();
await b.close();
