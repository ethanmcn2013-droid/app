/* What the across measure actually did, at a given width.
 *   node tools/probe.mjs [width] [query]
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const width = Number(process.argv[2] || 1600);
const query = process.argv[3] || "?p=timeline";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 1000 } });
const noise = [];
page.on("pageerror", (e) => noise.push(e.message));
page.on("console", (m) => { if (m.type() === "error") noise.push(m.text()); });
await page.goto(pathToFileURL(path.join(LAB, "_wrapped.html")).href + query);
await page.waitForTimeout(900);

const out = await page.evaluate(() => {
  const m = document.querySelector('.b-measure[data-across="true"]');
  if (!m) return { across: false };
  const cs = getComputedStyle(m);
  const r = m.getBoundingClientRect();
  const rel = (b) => ({ l: Math.round(b.left - r.left), rt: Math.round(b.right - r.left), t: Math.round(b.top - r.top), b: Math.round(b.bottom - r.top) });
  return {
    across: true,
    measure: { w: Math.round(r.width), h: Math.round(r.height), client: m.clientWidth, scrolls: m.dataset.scrolls },
    vars: {
      ruleY: cs.getPropertyValue("--rule-y").trim(),
      span: cs.getPropertyValue("--across-span").trim(),
      px: cs.getPropertyValue("--across-px").trim(),
      step: cs.getPropertyValue("--step").trim(),
      awayH: cs.getPropertyValue("--away-h").trim(),
    },
    rail: rel(m.querySelector(".b-rail").getBoundingClientRect()),
    items: [...m.querySelectorAll(".b-item")].map((el) => {
      const c = el.querySelector(".b-copy");
      const a = el.querySelector(".b-away");
      return {
        away: el.dataset.away,
        side: el.dataset.side,
        rank: el.dataset.rank,
        edge: el.dataset.edge || null,
        title: (el.querySelector(".b-title") || {}).textContent,
        x: Math.round(el.getBoundingClientRect().left - r.left),
        copy: rel(c.getBoundingClientRect()),
        away_: a ? rel(a.getBoundingClientRect()) : null,
      };
    }),
    /* Anything painting outside the track is the finding. */
    spill: (() => {
      let left = 0, right = 0, top = 0, bottom = 0;
      for (const el of m.querySelectorAll(".b-item *, .b-origin, .b-terminus")) {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        left = Math.min(left, Math.round(b.left - r.left));
        right = Math.max(right, Math.round(b.right - r.right));
        top = Math.min(top, Math.round(b.top - r.top));
        bottom = Math.max(bottom, Math.round(b.bottom - r.bottom));
      }
      return { left, right, top, bottom };
    })(),
  };
});
console.log(JSON.stringify(out, null, 1));
if (noise.length) console.log("CONSOLE:", noise.join(" | "));
await browser.close();
