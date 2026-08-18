import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const file = pathToFileURL(path.resolve("docs/design/labs/tasks-2026-08/report.html")).href;
const b = await chromium.launch();
for (const [name, opts] of [
  ["light", { viewport: { width: 1300, height: 1100 } }],
  ["dark", { viewport: { width: 1300, height: 1100 }, colorScheme: "dark" }],
  ["mobile", { viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true }],
]) {
  const c = await b.newContext({ deviceScaleFactor: 2, ...opts });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(file, { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `docs/design/labs/tasks-2026-08/shots/_r-${name}.png` });
  const of = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const missing = await p.$$eval("img", (as) => as.filter((a) => !a.getAttribute("src")).length);
  console.log(name, "| overflow", of, "| no-src", missing, "| errors", errs.length ? errs.slice(0,3) : "none");
  if (name === "light") {
    await p.locator("#rounds").scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: "docs/design/labs/tasks-2026-08/shots/_r-rounds.png" });
  }
  await c.close();
}
await b.close();
