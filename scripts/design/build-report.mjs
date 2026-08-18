// Build the panel report surface.
//
//   node scripts/design/build-report.mjs
//
// Reads panel.json (the scored rounds), the palette inventory straight out of
// the master's stylesheet, and the current frames, and emits one
// self-contained page. The palette table is generated rather than typed, so
// it cannot drift from the file it describes.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const LAB = path.resolve("docs/design/labs/tasks-2026-08");

/* Every colour literal in the master, with its declared alpha and which of
   the three brand colours it derives from. */
async function paletteInventory() {
  const master = await readFile(path.join(LAB, "floor.html"), "utf8");
  const css = master.split("<style>")[1].split("</style>")[0];
  const found = css.match(/#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g) || [];
  const seen = new Map();
  for (const raw of found) {
    const value = raw.toLowerCase().replace(/\s+/g, "");
    seen.set(value, (seen.get(value) || 0) + 1);
  }
  const rows = [];
  for (const [value, count] of seen) {
    const nums = value.match(/[\d.]+/g) || [];
    let base = null;
    let alpha = 1;
    if (value.startsWith("#")) {
      base = value === "#111111" ? "Ink" : value === "#4f46e5" ? "Indigo" : value === "#ffffff" ? "White" : null;
    } else {
      const [r, g, b, a] = nums.map(Number);
      alpha = a === undefined ? 1 : a;
      if (r === 17 && g === 17 && b === 17) base = "Ink";
      else if (r === 79 && g === 70 && b === 229) base = "Indigo";
      else if (r === 255 && g === 255 && b === 255) base = "White";
    }
    rows.push({ value, count, base, alpha });
  }
  rows.sort((a, b) => (a.base || "").localeCompare(b.base || "") || b.alpha - a.alpha);
  return rows;
}

async function dataUri(file, mime) {
  const buffer = await readFile(file);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/* The frames are 2x PNGs, far past what a page should carry, so they are
   resampled and re-encoded in the browser Playwright already provides. */
async function packFrames(names) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("about:blank");
  const out = {};
  for (const [key, file, width] of names) {
    let buffer;
    try {
      buffer = await readFile(path.join(LAB, "shots", file));
    } catch {
      process.stdout.write(`  missing ${file}\n`);
      continue;
    }
    const src = `data:image/png;base64,${buffer.toString("base64")}`;
    out[key] = await page.evaluate(
      async ([source, target]) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const scale = Math.min(1, target / image.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.82);
      },
      [src, width],
    );
  }
  await browser.close();
  return out;
}

const FRAMES = [
  ["board", "locked-board--1440x960.png", 1180],
  ["cards", "locked-cards--1440x960.png", 1180],
  ["dense", "locked-dense--1440x960.png", 1180],
  ["empty", "locked-empty--1440x960.png", 1180],
  ["loading", "locked-loading--1440x960.png", 1180],
  ["planning", "locked-planning--1440x960.png", 1180],
  ["tablet", "locked-board--768x1024.png", 768],
  ["phone", "locked-board--390x844.png", 390],
  ["variant-a", "a-board--1440x960.png", 1180],
  ["variant-b", "b-board--1440x960.png", 1180],
  ["variant-c", "c-board--1440x960.png", 1180],
];

async function build() {
  const shell = await readFile(path.join(LAB, "report.shell.html"), "utf8");
  const panel = JSON.parse(await readFile(path.join(LAB, "panel.json"), "utf8"));
  const palette = await paletteInventory();
  const frames = await packFrames(FRAMES);

  const page = shell
    .replace("/*__PANEL__*/", () => JSON.stringify(panel))
    .replace("/*__PALETTE__*/", () => JSON.stringify(palette))
    .replace("/*__FRAMES__*/", () => JSON.stringify(frames));

  const out = path.join(LAB, "report.html");
  await writeFile(out, page, "utf8");
  const { size } = await stat(out);
  process.stdout.write(`${out}\n${(size / 1024 / 1024).toFixed(2)} MB · ${palette.length} colour literals · ${Object.keys(frames).length} frames\n`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
