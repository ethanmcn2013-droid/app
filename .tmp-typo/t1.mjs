import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
for (const w of [1440, 1280, 1024]) {
  const p = await b.newPage({ viewport: { width: w, height: 960 } });
  await p.goto(url); await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const out = { };
    const cs = (n) => getComputedStyle(n);
    out.trayNotes = [...document.querySelectorAll(".trayNote")].map(n => ({
      t: n.textContent.trim(), w: Math.round(n.getBoundingClientRect().width),
      h: Math.round(n.getBoundingClientRect().height),
      lines: Math.round(n.getBoundingClientRect().height / (parseFloat(cs(n).lineHeight)))
    }));
    out.card = Math.round((document.querySelector(".card")||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width);
    out.titles = [...document.querySelectorAll(".cardTitle")].slice(0,40).map(n => n.textContent.trim());
    out.notes = [...document.querySelectorAll(".cardNote")].slice(0,40).map(n => n.textContent.trim());
    out.head = document.querySelector(".headFacts") ? document.querySelector(".headFacts").innerText : null;
    return out;
  });
  console.log("=== " + w + " card=" + r.card);
  console.log(JSON.stringify(r.trayNotes, null, 1));
  console.log("HEAD:", JSON.stringify(r.head));
  if (w===1440){ console.log("TITLES", JSON.stringify(r.titles,null,1)); console.log("NOTES", JSON.stringify(r.notes,null,1)); }
  await p.close();
}
await b.close();
