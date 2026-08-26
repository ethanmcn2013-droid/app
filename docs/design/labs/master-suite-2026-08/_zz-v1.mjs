import { chromium } from "@playwright/test";
const base = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1000 } });

async function probe(state, w, h) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(base + state, { waitUntil: "load" });
  await p.waitForTimeout(400);
  const pre = await p.evaluate(() => {
    const d = document.querySelector(".b-behindDetails");
    if (!d) return { none: true };
    const sh = d.closest(".app.sheet") || d.closest(".sheet");
    const s = d.querySelector("summary");
    return {
      open: d.open,
      summaryY: Math.round(s.getBoundingClientRect().top),
      summaryText: s.innerText.replace(/\s+/g," ").trim(),
      sheetCls: sh ? sh.className : null,
      scrollTop: sh ? sh.scrollTop : null,
      scrollH: sh ? sh.scrollHeight : null,
      clientH: sh ? sh.clientHeight : null,
      maxScroll: sh ? sh.scrollHeight - sh.clientHeight : null,
      sheetRect: sh ? JSON.stringify(sh.getBoundingClientRect()) : null,
    };
  });
  // focus the summary and press Enter
  await p.evaluate(() => { document.querySelector(".b-behindDetails summary").focus(); });
  await p.keyboard.press("Enter");
  await p.waitForTimeout(600);
  const post = await p.evaluate(() => {
    const d = document.querySelector(".b-behindDetails");
    const sh = d.closest(".app.sheet") || d.closest(".sheet");
    const rows = [...d.querySelectorAll(".b-behindRow")];
    const shr = sh.getBoundingClientRect();
    return {
      open: d.open,
      summaryY: Math.round(d.querySelector("summary").getBoundingClientRect().top),
      scrollTop: Math.round(sh.scrollTop),
      maxScroll: Math.round(sh.scrollHeight - sh.clientHeight),
      viewportH: window.innerHeight,
      sheetTop: Math.round(shr.top), sheetBottom: Math.round(shr.bottom),
      rows: rows.map(r => {
        const b = r.getBoundingClientRect();
        return { t: Math.round(b.top), b: Math.round(b.bottom), txt: r.innerText.replace(/\s+/g," ").trim().slice(0,40) };
      }),
      note: (()=>{const n=document.querySelector('.b-behindNote[data-when="open"]'); if(!n) return null; const b=n.getBoundingClientRect(); return {t:Math.round(b.top),b:Math.round(b.bottom),txt:n.innerText}; })(),
      docScroll: Math.round(document.scrollingElement.scrollTop),
    };
  });
  console.log(state, w+"x"+h, JSON.stringify({pre, post}, null, 1));
}
for (const st of ["timeline.desk","timeline.owner-flight","timeline.phone"]) {
  for (const [w,h] of [[1440,960],[1920,1000],[1280,900],[768,1024],[390,844]]) {
    try { await probe(st,w,h); } catch(e){ console.log(st,w,h,"ERR",e.message); }
  }
}
await b.close();
