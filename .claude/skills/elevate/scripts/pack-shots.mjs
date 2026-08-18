// Pack PNG frames into WebP data URIs for a self-contained artifact page.
//
//   node pack-shots.mjs --lab=<dir> [--out=frames.json] [--width=1180]
//
// A published artifact allows no external hosts, so every frame travels
// inside the HTML — and 2x PNGs would blow past any sane page weight, so
// each frame is resampled to its logical width and re-encoded as WebP by
// the browser Playwright already provides. No image dependency needed.
//
// Packs the default variant's current frames (every state at the grading
// viewport, plus the first state at each other viewport). Pass
// --files=a.png:key1,b.png:key2 to pack an explicit set instead.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, loadLab, launch } from "./lib.mjs";

const args = parseArgs();
const { lab, config } = await loadLab(args);
const OUT = path.join(lab, args.get("out") ?? "frames.json");
const TARGET = Number(args.get("width") ?? 1180);

const grading = config.viewports[config.viewports.length - 1]?.name ?? "1440x960";
let entries;
if (args.get("files")) {
  entries = args.get("files").split(",").map((pair) => {
    const [file, key] = pair.split(":");
    return { key: key ?? file.replace(/\.png$/, ""), file, width: TARGET };
  });
} else {
  entries = [
    ...config.states.map((state) => ({
      key: state,
      file: `${config.defaultVariant}-${state}--${grading}.png`,
      width: TARGET,
    })),
    ...config.viewports
      .filter((v) => v.name !== grading)
      .map((v) => ({
        key: v.name,
        file: `${config.defaultVariant}-${config.states[0]}--${v.name}.png`,
        width: v.width,
      })),
  ];
}

const browser = await launch(chromium);
const page = await browser.newPage();
await page.goto("about:blank");
const out = {};

for (const { key, file, width } of entries) {
  let buffer;
  try {
    buffer = await readFile(path.join(lab, "shots", file));
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
  process.stdout.write(`  ${key} ← ${file}\n`);
}

await browser.close();
await writeFile(OUT, JSON.stringify(out), "utf8");
const kb = Math.round(Buffer.byteLength(JSON.stringify(out)) / 1024);
process.stdout.write(`${Object.keys(out).length} frames, ${kb} KB → ${OUT}\n`);
