import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(url);
await p.waitForTimeout(900);

// digit widths at 13/600 and 13/400
const widths = await p.evaluate(() => {
  const mk = (w, tab) => {
    const s = document.createElement("span");
    s.style.cssText = `position:absolute;font-family:var(--font-sans);font-size:13px;font-weight:${w};letter-spacing:normal;font-variant-numeric:${tab?"tabular-nums":"normal"};font-feature-settings:"ss01","cv01";`;
    document.body.appendChild(s);
    const out = {};
    for (let d = 0; d <= 9; d++) { s.textContent = String(d); out[d] = s.getBoundingClientRect().width; }
    s.remove();
    return out;
  };
  return { prop600: mk(600,false), tab600: mk(600,true), prop400: mk(400,false), tab400: mk(400,true) };
});
console.log(JSON.stringify(widths, null, 1));

const snap = async () => await p.evaluate(() => {
  const g = (s) => { const e = document.querySelector(s); return e ? +e.getBoundingClientRect().left.toFixed(2) : null; };
  const r = document.querySelector(".ratio");
  return { ratioText: r && r.textContent, ratioW: r ? +r.getBoundingClientRect().width.toFixed(2) : null,
           late: g(".late"), undated: g(".undated"), season: g(".headFacts > span:last-child") };
});
console.log("standard before", JSON.stringify(await snap()));
// tick a card
await p.evaluate(() => { const c = document.querySelector('[data-act="tick"], .tick, .cardTick'); return c && c.className; }).then(x=>console.log("tickel", x));
await b.close();
