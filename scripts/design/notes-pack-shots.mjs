// Pack the Notes frames into WebP data URIs for the comparison surface.
//
//   node scripts/design/notes-pack-shots.mjs
//
// A sibling of scripts/design/pack-shots.mjs, which belongs to the Tasks
// exploration and is not edited by this programme.
//
// A published Artifact is served under a strict CSP with no external hosts, so
// every frame has to travel inside the HTML. The captures are 2x PNGs — 23 MB
// for the three directions alone, far past the 16 MB page ceiling — so each
// frame is resampled to its logical width and re-encoded as WebP by the
// browser Playwright already provides. There is no image dependency in this
// repo and none is added.
//
// Output: docs/design/labs/notes-2026-08/frames.json — { key: dataURI }.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const REF = path.resolve("docs/design/shots/reference-2026-08");
const SWEEP = path.resolve("docs/design/shots/notes-reference-2026-08");
const LAB = path.resolve("docs/design/labs/notes-2026-08/shots");
const OUT = path.resolve("docs/design/labs/notes-2026-08/frames.json");

const QUALITY = Number(args.get("quality") ?? 0.78);
const VIEWPORTS = ["390x844", "768x1024", "1280x900", "1440x960"];
const STATES = [
  "notebook",
  "capture",
  "voice",
  "readback",
  "review",
  "seam",
  "search",
  "pressure",
  "nothing",
  "not-yet",
];
const DIRECTIONS = (args.get("directions") ?? "a,b,c").split(",");

/* The shipped app's nearest equivalent for each lab state, at the four
   viewports the reference set covers. Where the shipped product has no such
   state at every viewport, the mapping says which frame is standing in and
   the surface prints that sentence rather than passing one state off as
   another. */
const CURRENT_FOR_STATE = {
  notebook: { file: "notes-notebook", note: null },
  capture: { file: "notes-notebook", note: "The shipped composer is only photographed at rest in the four-viewport set. This is the notebook it sits above." },
  voice: { file: "notes-notebook", note: "The shipped voice flow opens on a consent stage, which the four-viewport set does not cover. See the single-viewport sweep frame beside it." },
  readback: { file: "notes-notebook", note: "The shipped read-back is not in the four-viewport set. See the single-viewport sweep frame beside it." },
  review: { file: "notes-review", note: null },
  seam: { file: "notes-review", note: "The shipped hand-off is a centred dialog over this view. See the single-viewport sweep frame beside it." },
  search: { file: "notes-notebook", note: "The shipped search filters this notebook in place." },
  pressure: { file: "notes-dense", note: null },
  nothing: { file: "notes-first-use", note: null },
  "not-yet": { file: "notes-loading", note: null },
};

/* Single-viewport frames from the full 29-state sweep, for the states the
   four-viewport reference set does not reach. These are the honest before
   for voice, the read-back, the seam and the honesty states. */
const SWEEP_FRAMES = [
  "voice-consent",
  "voice-listening",
  "voice-review",
  "review-turn-into-task",
  "task-created",
  "offline",
  "save-failure",
  "search-no-results",
  "sent-view",
  "long-content",
];

const jobs = [];
for (const viewport of VIEWPORTS) {
  const width = Number(viewport.split("x")[0]);
  for (const state of STATES) {
    jobs.push({
      key: `current-${state}--${viewport}`,
      file: path.join(REF, `${CURRENT_FOR_STATE[state].file}--${viewport}.png`),
      width,
    });
    for (const direction of DIRECTIONS) {
      jobs.push({
        key: `${direction}-${state}--${viewport}`,
        file: path.join(LAB, `${direction}-${state}--${viewport}.png`),
        width,
      });
    }
  }
}

for (const slug of SWEEP_FRAMES) {
  jobs.push({ key: `sweep-${slug}`, file: path.join(SWEEP, `${slug}.png`), width: 1120 });
}

async function pack() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("about:blank");

  const frames = {};
  const seen = new Map();
  const missing = [];

  for (const job of jobs) {
    if (seen.has(job.file)) {
      frames[job.key] = frames[seen.get(job.file)];
      continue;
    }
    let buffer;
    try {
      buffer = await readFile(job.file);
    } catch {
      missing.push(path.basename(job.file));
      continue;
    }
    const source = `data:image/png;base64,${buffer.toString("base64")}`;
    const encoded = await page.evaluate(
      async ([src, targetWidth, quality]) => {
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
        return canvas.toDataURL("image/webp", quality);
      },
      [source, job.width, QUALITY],
    );
    frames[job.key] = encoded;
    seen.set(job.file, job.key);
  }

  await browser.close();
  await writeFile(OUT, JSON.stringify(frames), "utf8");
  const total = Object.values(frames).reduce((sum, value) => sum + value.length, 0);
  if (missing.length) {
    process.stdout.write(`missing ${missing.length}:\n${[...new Set(missing)].map((m) => `  ${m}`).join("\n")}\n\n`);
  }
  process.stdout.write(
    `${Object.keys(frames).length} keys · ${seen.size} distinct frames · ${(total / 1024 / 1024).toFixed(2)} MB of data URI (quality ${QUALITY})\n`,
  );
}

pack().catch((error) => {
  console.error(error);
  process.exit(1);
});
