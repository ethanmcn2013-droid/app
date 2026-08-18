import { chromium } from "@playwright/test";
import path from "node:path";
const URL = "file:///" + path.resolve("docs/design/labs/tasks-2026-08/floor.html").split("\\").join("/");
const b = await chromium.launch();
for (const [st,w,h] of [["board",1440,960],["dense",1440,960],["empty",1440,960],["board",768,1024],["board",1440,1200]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(URL+"?state="+st); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const out=[]; let area=0, used=0;
    document.querySelectorAll(".tray[data-lane]").forEach(t=>{
      const tb=t.getBoundingClientRect();
      const kids=[...t.querySelectorAll(".card, .trayAdd, .trayEmpty, .trayHead")];
      const bottom = Math.max(...kids.map(k=>k.getBoundingClientRect().bottom));
      const empty = tb.bottom - bottom;
      out.push({lane:t.dataset.lane, tray:Math.round(tb.height), empty:Math.round(empty), pct:Math.round(100*empty/tb.height)});
      area+=tb.height; used+=(bottom-tb.top);
    });
    return { cols: out, boardEmptyPct: Math.round(100*(area-used)/area) };
  });
  console.log(st, w+"x"+h, JSON.stringify(r));
  await p.close();
}
await b.close();
