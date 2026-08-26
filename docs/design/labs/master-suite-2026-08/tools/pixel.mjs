/* What colour is that text ACTUALLY painted on?
 *
 *   node tools/pixel.mjs "<state>" <width> "<selector>" [...]
 *
 * The measured gate computes a composited backdrop by walking ancestors
 * and paint order. When it and the eye disagree, neither argument is worth
 * anything — so this screenshots the element's own box and reads the real
 * pixels out of it: the darkest, the lightest, and the ratio between them.
 * A ratio of 1 in the render is a defect; a ratio of 1 only in the model is
 * a defect in the model.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WS = path.resolve(LAB, "../../../../..");
const { PNG } = await import(pathToFileURL(path.join(WS, "studio/node_modules/pngjs/lib/png.js")).href);

const [state, widthRaw, ...selectors] = process.argv.slice(2);
const width = Number(widthRaw);
const url = pathToFileURL(path.join(LAB, "_gate-suite.html")).href;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height: width < 500 ? 844 : 960 },
  hasTouch: width < 500,
  isMobile: width < 500,
});
await page.goto(`${url}?state=${state}`);
await page.waitForTimeout(800);

const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

for (const sel of selectors) {
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
      color: cs.color, text: (el.textContent || "").trim().slice(0, 34),
      onScreen: b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth,
    };
  }, sel);
  if (!box) { process.stdout.write(`  ${sel}  — not present\n`); continue; }
  if (!box.w || !box.h) { process.stdout.write(`  ${sel}  — no box\n`); continue; }

  const shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  const png = PNG.sync.read(shot);
  let dark = null, light = null;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
    const l = lum(r, g, b);
    if (!dark || l < dark.l) dark = { r, g, b, l };
    if (!light || l > light.l) light = { r, g, b, l };
  }
  const ratio = (light.l + 0.05) / (dark.l + 0.05);
  process.stdout.write(
    `  ${sel}\n` +
    `      “${box.text}”  ${box.w}×${box.h} at ${box.x},${box.y}  ${box.onScreen ? "in frame" : "OUT OF FRAME"}\n` +
    `      declared ${box.color}\n` +
    `      painted  darkest rgb(${dark.r}, ${dark.g}, ${dark.b}) · lightest rgb(${light.r}, ${light.g}, ${light.b})\n` +
    `      rendered contrast ${Math.round(ratio * 100) / 100}:1\n`,
  );
}
await browser.close();
