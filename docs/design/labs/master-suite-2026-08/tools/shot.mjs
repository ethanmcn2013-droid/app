/* A quick look at one surface, while building.
 *   node tools/shot.mjs "?p=notes" 1440 out.png
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = pathToFileURL(path.join(LAB, "_wrapped.html")).href;
const q = process.argv[2] || "";
const w = Number(process.argv[3] || 1440);
const out = process.argv[4] || "_look.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: w <= 430 ? 844 : 900 }, deviceScaleFactor: 2 });
const noise = [];
page.on("console", (m) => { if (m.type() === "error") noise.push(m.text()); });
page.on("pageerror", (e) => noise.push("pageerror: " + e.message));
await page.goto(url + q);
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(LAB, out) });
if (noise.length) console.log("CONSOLE:\n" + noise.join("\n"));
else console.log("console clean · " + out);
await browser.close();
