import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html?state=dense";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(url);
await p.waitForTimeout(800);
const chips = await p.$$eval(".when", ns => ns.map(n => {
  const s = getComputedStyle(n);
  return { t: n.dataset.t, text: n.textContent.trim(), title: n.title,
    lane: n.closest("[data-lane]")?.getAttribute("data-lane"),
    w: Math.round(n.getBoundingClientRect().width),
    bg: s.backgroundColor, shadow: s.boxShadow, color: s.color, weight: s.fontWeight,
    glyph: !!n.querySelector("svg") };
}));
console.log(JSON.stringify(chips.filter(c => ["waiting","done","soon"].includes(c.t)), null, 1));
console.log("kinds:", JSON.stringify(chips.reduce((a,c)=>{a[c.t]=(a[c.t]||0)+1;return a;},{})));
const fit = await p.evaluate(() => {
  const c = document.querySelector('.when[data-t="waiting"]');
  if (!c) return "no waiting chip";
  const clone = c.cloneNode(true);
  clone.innerHTML = "Held 21 days";
  clone.style.maxWidth = "none"; clone.style.float = "none";
  c.parentNode.appendChild(clone);
  const w = clone.getBoundingClientRect().width;
  const cardW = c.closest(".card").getBoundingClientRect().width;
  clone.remove();
  return { heldWidth: Math.round(w), cardW: Math.round(cardW), budget: Math.round(cardW*0.38) };
});
console.log("FIT", JSON.stringify(fit));
await b.close();
