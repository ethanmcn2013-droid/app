/* The three lab masters, at their locked presets, for the fidelity pairs.
 *   node tools/labshot.mjs <width>
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WS = path.resolve(LAB, "../../../../..");
const w = Number(process.argv[2] || 1440);
const h = w <= 430 ? 844 : 900;

const TARGETS = [
  ["tasks", "_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html", "?v=locked"],
  ["notes", "_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html", "?v=locked&nofocus=1"],
  ["timeline", "_wt-timeline-redesign/docs/design/labs/timeline-redesign-2026-08/master.html", "?v=paper"],
];

const browser = await chromium.launch();
for (const [name, rel, q] of TARGETS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const noise = [];
  page.on("pageerror", (e) => noise.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") noise.push(m.text()); });
  await page.goto(pathToFileURL(path.join(WS, rel)).href + q);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(LAB, "shots", `lab-${name}-${w}.png`) });
  console.log(`lab-${name}-${w}.png` + (noise.length ? "  CONSOLE: " + noise.join(" | ") : ""));
  await page.close();
}
await browser.close();
