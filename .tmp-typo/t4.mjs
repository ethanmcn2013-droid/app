import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const seen = new Map();
for (const st of ["", "?state=planning", "?state=empty", "?state=dense", "?state=cards", "?state=loading", "?state=filtered"]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
  await p.goto(base + st); await p.waitForTimeout(600);
  const rows = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll("*").forEach(el => {
      if (el.closest(".sr")) return;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") return;
      const fs = parseFloat(s.fontSize), ls = parseFloat(s.letterSpacing) || 0;
      out.push({
        sel: el.tagName.toLowerCase() + "." + (el.className && el.className.baseVal===undefined ? String(el.className).split(" ")[0] : ""),
        fs: fs, fw: s.fontWeight, lh: s.lineHeight, ls: +(ls / fs).toFixed(4),
        mono: /mono|Mono/.test(s.fontFamily),
        tt: s.textTransform,
        txt: el.textContent.trim().slice(0, 34)
      });
    });
    return out;
  });
  for (const r of rows) {
    const k = [r.fs, r.fw, r.lh, r.ls, r.mono, r.tt].join("|");
    if (!seen.has(k)) seen.set(k, { ...r, states: [st || "board"], n: 1 });
    else { const v = seen.get(k); v.n++; if (!v.states.includes(st||"board")) v.states.push(st||"board"); }
  }
  await p.close();
}
const arr = [...seen.values()].sort((a,b)=> b.fs-a.fs || a.fw-b.fw);
console.log("distinct type styles:", arr.length);
console.log("distinct sizes:", [...new Set(arr.map(a=>a.fs))].sort((x,y)=>y-x).join(", "));
for (const a of arr) console.log([a.fs+"px", a.fw, "lh="+a.lh, "tr="+a.ls+"em", a.mono?"MONO":"sans", a.tt==="uppercase"?"UC":"", "n="+a.n, a.sel, JSON.stringify(a.txt)].join("  "));
await b.close();
