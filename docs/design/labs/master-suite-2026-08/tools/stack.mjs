/* What is actually on top of a thing, and where every layer sits.
 *   node tools/stack.mjs "<state>" <width> "<selector>"
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [state, widthRaw, selector] = process.argv.slice(2);
const width = Number(widthRaw);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height: width < 500 ? 844 : 960 },
  hasTouch: width < 500,
  isMobile: width < 500,
});
await page.goto(pathToFileURL(path.join(LAB, "_gate-suite.html")).href + `?state=${state}`);
await page.waitForTimeout(800);

const out = await page.evaluate((sel) => {
  const name = (el) => el.tagName.toLowerCase() +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).join(".") : "") +
    (el.id ? "#" + el.id : "");
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      el: name(el),
      at: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
      bg: cs.backgroundColor, color: cs.color, z: cs.zIndex, pos: cs.position,
    };
  };
  const el = document.querySelector(sel);
  if (!el) return { missing: sel };
  const r = el.getBoundingClientRect();
  const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).slice(0, 6).map(box);
  return {
    target: box(el),
    sheet: box(document.querySelector(".app:not([hidden])")),
    rail: box(document.querySelector(".rail")),
    floor: box(document.getElementById("deck")),
    stackAtCentre: stack,
  };
}, selector);

console.log(JSON.stringify(out, null, 1));
await browser.close();
