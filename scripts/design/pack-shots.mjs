// Pack PNG frames into WebP data URIs for the comparison surface.
//
//   node scripts/design/pack-shots.mjs
//
// A published Artifact must be self-contained — a strict CSP blocks every
// external host — so every frame has to travel inside the HTML. The captures
// are 2× PNGs (19 MB for the reference set alone), which is far past the
// 16 MB page ceiling, so each frame is resampled to its logical width and
// re-encoded as WebP. There is no image dependency in this repo, so the work
// is done by the browser Playwright already provides: canvas draw, then
// canvas.toDataURL("image/webp").
//
// Output: docs/design/labs/tasks-2026-08/frames.json — { key: dataURI }.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REF = path.resolve("docs/design/shots/reference-2026-08");
const LAB = path.resolve("docs/design/labs/tasks-2026-08/shots");
const OUT = path.resolve("docs/design/labs/tasks-2026-08/frames.json");

const VIEWPORTS = ["390x844", "768x1024", "1280x900", "1440x960"];
const STATES = ["board", "dense", "empty", "loading", "planning"];

/* The shipped app's nearest equivalent for each state. Where the shipped
   fixture has no such state, the mapping says so and the surface labels it
   rather than pretending a frame is something it is not. */
const CURRENT_FOR_STATE = {
  board: { file: "tasks-board", note: null },
  dense: { file: "tasks-board", note: "The shipped fixture holds one project, so there is no dense board to photograph. This is the populated board." },
  empty: { file: "tasks-board-empty-search", note: "The shipped app has no empty-workspace fixture in review mode. This is its real no-result state." },
  loading: { file: "tasks-loading", note: null },
  planning: { file: "tasks-board-planning", note: null },
};

const jobs = [];
for (const viewport of VIEWPORTS) {
  for (const state of STATES) {
    jobs.push({
      key: `current-${state}--${viewport}`,
      file: path.join(REF, `${CURRENT_FOR_STATE[state].file}--${viewport}.png`),
      width: Number(viewport.split("x")[0]),
    });
    for (const direction of ["a", "b", "c"]) {
      jobs.push({
        key: `${direction}-${state}--${viewport}`,
        file: path.join(LAB, `${direction}-${state}--${viewport}.png`),
        width: Number(viewport.split("x")[0]),
      });
    }
  }
}

/* A handful of reference frames from the other two products, so the
   comparison surface can show what register Tasks is being measured against. */
for (const slug of ["notes-notebook", "timeline-owner", "home"]) {
  jobs.push({
    key: `ref-${slug}--1440x960`,
    file: path.join(REF, `${slug}--1440x960.png`),
    width: 1440,
  });
}

async function pack() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("about:blank");

  const frames = {};
  const seen = new Map();

  for (const job of jobs) {
    if (seen.has(job.file)) {
      frames[job.key] = frames[seen.get(job.file)];
      continue;
    }
    let buffer;
    try {
      buffer = await readFile(job.file);
    } catch {
      process.stdout.write(`  missing ${path.basename(job.file)}\n`);
      continue;
    }
    const source = `data:image/png;base64,${buffer.toString("base64")}`;
    const encoded = await page.evaluate(
      async ([src, targetWidth]) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const scale = Math.min(1, targetWidth / image.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.82);
      },
      [source, job.width],
    );
    frames[job.key] = encoded;
    seen.set(job.file, job.key);
    process.stdout.write(`${job.key}  ${(encoded.length / 1024).toFixed(0)}kb\n`);
  }

  await browser.close();
  await writeFile(OUT, JSON.stringify(frames), "utf8");
  const total = Object.values(frames).reduce((sum, value) => sum + value.length, 0);
  process.stdout.write(`\n${Object.keys(frames).length} frames · ${(total / 1024 / 1024).toFixed(2)} MB of data URI\n`);
}

pack().catch((error) => {
  console.error(error);
  process.exit(1);
});
