import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
for (const w of [768, 900, 860, 820, 800, 780, 760, 740, 730, 721]) {
  const p = await b.newPage({ viewport: { width: w, height: 1024 } });
  await p.goto(url);
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const n = document.querySelector(".headName");
    const f = document.querySelector(".headFacts");
    const u = document.querySelector(".undated");
    const h = document.querySelector(".head");
    const a = document.querySelector(".headActions");
    const cs = getComputedStyle(n);
    return {
      text: n.textContent,
      truncated: n.scrollWidth > n.clientWidth + 0.5,
      scrollW: n.scrollWidth, clientW: n.clientWidth,
      nameRect: n.getBoundingClientRect().width,
      factsW: f ? f.getBoundingClientRect().width : null,
      factsText: f ? f.innerText.replace(/\n/g," | ") : null,
      undatedW: u ? u.getBoundingClientRect().width : null,
      headW: h.getBoundingClientRect().width,
      actionsW: a.getBoundingClientRect().width,
      fs: cs.fontSize,
    };
  });
  console.log(w, JSON.stringify(r));
  await p.close();
}
await b.close();
