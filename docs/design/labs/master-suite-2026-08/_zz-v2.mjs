import { chromium } from "@playwright/test";
const base = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });

const read = () => p.evaluate(() => {
  const d = document.querySelector(".b-behindDetails");
  const sh = d.closest(".app.sheet");
  const shr = sh.getBoundingClientRect();
  const rows = [...d.querySelectorAll(".b-behindRow")];
  const vis = rows.filter(r => { const bb = r.getBoundingClientRect(); return bb.top >= shr.top && bb.bottom <= shr.bottom; }).length;
  return {
    open: d.open, scrollTop: Math.round(sh.scrollTop), max: Math.round(sh.scrollHeight - sh.clientHeight),
    sumY: Math.round(d.querySelector("summary").getBoundingClientRect().top),
    sheetBottom: Math.round(shr.bottom),
    rowsVisible: vis, rowBottoms: rows.map(r=>Math.round(r.getBoundingClientRect().bottom)),
    active: document.activeElement.className + "|" + (document.activeElement.innerText||"").replace(/\s+/g," ").slice(0,30),
  };
});

async function go(state, w, h) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(base + state, { waitUntil: "load" });
  await p.waitForTimeout(400);
}

// PATH A: pure Tab until summary focused
await go("timeline.owner-flight", 1440, 960);
let found = false;
for (let i=0;i<160;i++){
  await p.keyboard.press("Tab");
  const isSum = await p.evaluate(()=>document.activeElement.classList.contains("b-behindSummary"));
  if (isSum) { found = true; console.log("TAB reached summary after", i+1, "tabs"); break; }
}
if (!found) console.log("TAB never reached summary in 160");
console.log("A before Enter:", JSON.stringify(await read()));
await p.keyboard.press("Enter");
await p.waitForTimeout(500);
console.log("A after Enter :", JSON.stringify(await read()));

// PATH B: scroll sheet to bottom, then click summary
await go("timeline.owner-flight", 1440, 960);
await p.evaluate(()=>{ const sh=document.querySelector(".b-behindDetails").closest(".app.sheet"); sh.scrollTop = sh.scrollHeight; });
await p.waitForTimeout(200);
console.log("B before click:", JSON.stringify(await read()));
await p.click(".b-behindSummary");
await p.waitForTimeout(500);
console.log("B after click :", JSON.stringify(await read()));

// PATH C: mouse-wheel-ish partial scroll so summary sits just inside bottom, then click
for (const st of [0, 60, 120, 180, 249]) {
  await go("timeline.owner-flight", 1440, 960);
  await p.evaluate((s)=>{ document.querySelector(".b-behindDetails").closest(".app.sheet").scrollTop = s; }, st);
  await p.waitForTimeout(150);
  const pre = await read();
  if (pre.sumY > pre.sheetBottom - 20) { console.log("C scrollTop",st,"summary not clickable (y",pre.sumY,")"); continue; }
  await p.click(".b-behindSummary");
  await p.waitForTimeout(400);
  const post = await read();
  console.log("C scrollTop", st, "-> rowsVisible", post.rowsVisible, "scrollTop", post.scrollTop, "of", post.max, "rowBottoms", post.rowBottoms.join(","), "sheetBottom", post.sheetBottom);
}

// PATH D: same at 1920x1000
for (const st of [0, 100, 209]) {
  await go("timeline.owner-flight", 1920, 1000);
  await p.evaluate((s)=>{ document.querySelector(".b-behindDetails").closest(".app.sheet").scrollTop = s; }, st);
  await p.waitForTimeout(150);
  const pre = await read();
  if (pre.sumY > pre.sheetBottom - 20) { console.log("D scrollTop",st,"summary not clickable (y",pre.sumY,")"); continue; }
  await p.click(".b-behindSummary");
  await p.waitForTimeout(400);
  const post = await read();
  console.log("D 1920 scrollTop", st, "-> rowsVisible", post.rowsVisible, "scrollTop", post.scrollTop, "of", post.max, "rowBottoms", post.rowBottoms.join(","), "sheetBottom", post.sheetBottom);
}
await b.close();
