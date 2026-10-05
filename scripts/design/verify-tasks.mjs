/** Drive every Tasks view in the v3 shell and report what renders.
 *  usage: node scripts/design/verify-tasks.mjs [origin]  (default http://localhost:3510) */
import { chromium } from "@playwright/test";
const origin = process.argv[2] ?? "http://localhost:3510";
const b = await chromium.launch();
const errs = [];
for (const [path, label] of [["/app/tasks", "board"], ["/app/tasks/list", "list"], ["/app/tasks/calendar", "calendar"]]) {
  for (const w of [1440, 1100, 768, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    p.on("pageerror", (e) => errs.push(`${label}@${w}: ${String(e).slice(0, 90)}`));
    await p.goto(origin + path, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3500);
    const r = await p.evaluate(() => ({
      header: !!document.querySelector("[data-floor-head] h1"),
      views: [...document.querySelectorAll('[aria-label="Task views"] a')].map((a) => a.textContent),
      cards: document.querySelectorAll("[data-board] [data-id]").length,
      rows: document.querySelectorAll('[role="grid"] [role="row"][data-id]').length,
      days: document.querySelectorAll('[role="gridcell"][data-date]').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    }));
    console.log(`${label.padEnd(9)} ${String(w).padEnd(5)} header:${r.header ? 1 : 0} views:${r.views.join("/")} cards:${String(r.cards).padEnd(3)} rows:${String(r.rows).padEnd(3)} days:${String(r.days).padEnd(3)} hOverflow:${r.overflow ? "YES" : "no"}`);
    await p.close();
  }
}
// The retired Schedule address lands on the board with its query intact.
const p = await b.newPage();
await p.goto(origin + "/app/tasks/timeline?task=demo-t-05", { waitUntil: "domcontentloaded" });
// Streamed pages redirect on the client; wait for it to land.
await p.waitForURL(/\/app\/tasks\?/, { timeout: 15000 }).catch(() => {});
console.log(`timeline redirect -> ${new URL(p.url()).pathname}${new URL(p.url()).search}`);
await p.close();
console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();
