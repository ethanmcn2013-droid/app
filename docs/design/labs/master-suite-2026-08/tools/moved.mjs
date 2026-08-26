/* Did that fix move anything?
 *
 *   node tools/moved.mjs <state> <width> [...]
 *
 * Shoots the current build against a snapshot in _before/ and reports the
 * differing pixels. A fix argued as "this moves nothing" has to be able to
 * prove it; a fix that does move something has to be able to say where.
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WS = path.resolve(LAB, "../../../../..");
const { PNG } = await import(pathToFileURL(path.join(WS, "studio/node_modules/pngjs/lib/png.js")).href);
const pixelmatch = (await import(pathToFileURL(path.join(WS, "studio/node_modules/pixelmatch/index.js")).href)).default;

const url = pathToFileURL(path.join(LAB, "_gate-suite.html")).href;
const jobs = process.argv.slice(2);
if (!jobs.length) { process.stdout.write("pass <state>:<width> pairs, e.g. tasks:board:1440\n"); process.exit(2); }

const browser = await chromium.launch();
let worst = 0;
for (const job of jobs) {
  const bits = job.split(":");
  const width = Number(bits.pop());
  const state = bits.join(":");
  const page = await browser.newPage({
    viewport: { width, height: width < 500 ? 844 : 960 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${url}?state=${state}`);
  await page.waitForTimeout(800);
  const now = await page.screenshot();
  await page.close();

  const name = `${state.replace(/:/g, "-")}-${width}.png`;
  let before;
  try { before = await readFile(path.join(LAB, "_before", name)); }
  catch { process.stdout.write(`  ${job.padEnd(26)} no snapshot at _before/${name}\n`); continue; }

  const a = PNG.sync.read(before), b = PNG.sync.read(now);
  if (a.width !== b.width || a.height !== b.height) {
    process.stdout.write(`  ${job.padEnd(26)} frame changed ${a.width}x${a.height} → ${b.width}x${b.height}\n`);
    worst = Infinity;
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  await writeFile(path.join(LAB, "_before", `diff-${name}`), PNG.sync.write(diff));
  worst = Math.max(worst, n);
  const pct = ((n / (a.width * a.height)) * 100).toFixed(3);
  process.stdout.write(`  ${job.padEnd(26)} ${n === 0 ? "identical" : n + " px (" + pct + "%) — see _before/diff-" + name}\n`);
}
await browser.close();
process.stdout.write(worst === 0 ? "\nnothing moved\n" : `\nworst: ${worst} px\n`);
