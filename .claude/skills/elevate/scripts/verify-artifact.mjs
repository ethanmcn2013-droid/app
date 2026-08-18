// Render-check a page before it is published as an artifact.
//
//   node verify-artifact.mjs --file=<page.html> [--shots=<dir>]
//
// Light, dark, and 390px mobile. Fails on horizontal overflow, images with
// no source, or console errors. A report that ships broken in dark mode is
// a poor argument for the standard it reports on. Screenshots land beside
// the page (or in --shots) as _verify-<mode>.png for a human glance.
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, launch } from "./lib.mjs";

const args = parseArgs();
const file = args.get("file");
if (!file) { console.error("Pass --file=<page.html>"); process.exit(2); }
const url = pathToFileURL(path.resolve(file)).href;
const shotDir = path.resolve(args.get("shots") ?? path.dirname(path.resolve(file)));

const browser = await launch(chromium);
let failures = 0;

for (const [name, opts] of [
  ["light", { viewport: { width: 1300, height: 1100 } }],
  ["dark", { viewport: { width: 1300, height: 1100 }, colorScheme: "dark" }],
  ["mobile", { viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true }],
]) {
  const context = await browser.newContext({ deviceScaleFactor: 2, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  /* Network failures to EXTERNAL hosts are the verifying machine's problem
     (offline containers, proxies) — published artifacts allow Google Fonts
     and nothing else anyway. A failing file:// resource IS a page defect. */
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/Failed to load resource/.test(text) && !/ERR_FILE_NOT_FOUND/.test(text)) return;
    errors.push(text);
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith("file://")) errors.push("file resource failed: " + r.url());
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(shotDir, `_verify-${name}.png`) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  /* Only visible images count — a lightbox img legitimately rests empty. */
  const noSrc = await page.$$eval("img", (imgs) => imgs.filter((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !i.getAttribute("src");
  }).length);
  const bad = overflow > 1 || noSrc > 0 || errors.length > 0;
  if (bad) failures += 1;
  process.stdout.write(
    `  ${bad ? "FAIL" : "pass"}  ${name.padEnd(7)} overflow ${overflow}px · no-src imgs ${noSrc} · errors ${errors.length ? errors.slice(0, 2).join(" | ") : "0"}\n`,
  );
  await context.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
