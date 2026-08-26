import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
await p.evaluate(() => { window.__a = []; for (const t of document.querySelectorAll("[aria-live],[role=status]")) new MutationObserver(() => window.__a.push((t.textContent || "").trim().slice(0, 160))).observe(t, { childList: true, subtree: true, characterData: true }); });
const dump = async (t) => console.log(t, JSON.stringify(await p.evaluate(() => { const x = window.__a; window.__a = []; return x; })));

// full tab sweep of timeline
const stops = [];
for (let i = 0; i < 40; i++) {
  await p.keyboard.press("Tab");
  const s = await p.evaluate(() => {
    const a = document.activeElement; if (!a || a === document.body) return null;
    const r = a.getBoundingClientRect();
    return String(a.className).split(" ")[0] + " | " + (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 42) + (r.bottom < 0 || r.top > innerHeight ? "  OFFSCREEN" : "");
  });
  if (!s) { stops.push("-- end --"); break; }
  stops.push(s);
}
console.log(stops.join("\n"));

// behind-you summary
const n = await p.locator(".b-behindSummary").count();
console.log("\nbehindSummary:", n, await p.evaluate(() => { const e = document.querySelector(".b-behindSummary"); return e ? { tag: e.tagName, exp: e.getAttribute("aria-expanded"), ctrl: e.getAttribute("aria-controls"), txt: (e.textContent || "").replace(/\s+/g, " ").trim() } : null; }));
if (n) { await p.locator(".b-behindSummary").click(); await p.waitForTimeout(500); await dump("expand"); console.log("after:", await p.evaluate(() => { const e = document.querySelector(".b-behindSummary"); return { exp: e.getAttribute("aria-expanded"), moments: document.querySelectorAll(".b-behind .b-moment, .b-behindList *").length }; })); await p.screenshot({ path: "panel/m3/behind.png" }); }
await p.close();
await b.close();
