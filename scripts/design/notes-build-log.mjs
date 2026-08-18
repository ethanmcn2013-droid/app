// Build the Notes elevation log.
//
//   node scripts/design/notes-build-log.mjs
//
// A sibling of scripts/design/build-report.mjs. The log is the panel's public
// record: what each seat scored each round, what the round's worst findings
// were, which of them survived an adversarial refuter, and what was done about
// the survivors — beside the frames of the build being graded.
//
// One self-contained file, because a published Artifact is served under a CSP
// that blocks every external host: the frames travel as WebP data URIs and
// Geist travels as woff2.
import { readFile, writeFile, stat } from "node:fs/promises";
import { chromium } from "@playwright/test";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const SHOTS = path.join(LAB, "shots");

const STATES = [
  ["notebook", "The notebook", "the resting state: the desk, the pile, and the one indigo on the row the keyboard is holding"],
  ["capture", "Capture", "mid-thought, with the sheet awake and the save affordance arrived"],
  ["voice", "Voice", "the floor gone to ink, the disclosure at the foot, the sheet still mounted behind"],
  ["readback", "The read-back", "one run of speech, come back as two notes you can edit"],
  ["review", "The hand", "eight decisions dealt as a hand, the depth behind saying there is more"],
  ["seam", "The seam", "the note never covered, the words that cross marked inside the person's own sentence"],
  ["search", "Search", "a query, its hits, and how a match is marked inside prose"],
  ["pressure", "Pressure", "thirty-six notes and a nine-hundred-word note, in one frame"],
  ["nothing", "Nothing", "every empty in the product, each with exactly one first move"],
  ["not-yet", "Not yet", "loading, saving, held on the device, changed elsewhere, about to be deleted"],
];

const ROOMS = [
  ["locked", "Locked", "stacked pile, airy index, soft corners, subtle indigo, calm type"],
  ["r1", "Quiet Desk", "no pile, tight index, sharp corners — the most instrument-like"],
  ["r2", "Studio", "round corners, airy index, the writing set larger"],
  ["r3", "Press", "deep pile, tight index, the accent forward"],
];

async function packFrames() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("about:blank");
  const frames = {};
  const jobs = [];
  for (const [state] of STATES) {
    jobs.push({ key: `locked-${state}`, file: path.join(SHOTS, `locked-${state}--1440x960.png`), width: 1180 });
  }
  jobs.push({ key: "locked-phone", file: path.join(SHOTS, "locked-notebook--390x844.png"), width: 390 });
  jobs.push({ key: "locked-tablet", file: path.join(SHOTS, "locked-notebook--768x1024.png"), width: 700 });
  for (const [room] of ROOMS) {
    jobs.push({ key: `room-${room}`, file: path.join(SHOTS, `${room}-notebook--1440x960.png`), width: 900 });
  }
  for (const job of jobs) {
    let buffer;
    try {
      buffer = await readFile(job.file);
    } catch {
      process.stdout.write(`  missing ${path.basename(job.file)}\n`);
      continue;
    }
    const source = `data:image/png;base64,${buffer.toString("base64")}`;
    frames[job.key] = await page.evaluate(
      async ([src, targetWidth]) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const scale = Math.min(1, targetWidth / image.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.8);
      },
      [source, job.width],
    );
  }
  await browser.close();
  return frames;
}

async function dataUri(file) {
  const buffer = await readFile(file);
  return `data:font/woff2;base64,${buffer.toString("base64")}`;
}

const shell = await readFile(path.join(LAB, "log.shell.html"), "utf8");
const panel = await readFile(path.join(LAB, "panel.json"), "utf8");
const frames = await packFrames();
const sans = await dataUri(path.join(LAB, "fonts/Geist.woff2"));
const mono = await dataUri(path.join(LAB, "fonts/GeistMono.woff2"));

const page = shell
  .replace("__FONT_SANS__", () => sans)
  .replace("__FONT_MONO__", () => mono)
  .replace("__PANEL__", () => panel)
  .replace("__FRAMES__", () => JSON.stringify(frames))
  .replace("__STATES__", () => JSON.stringify(STATES))
  .replace("__ROOMS__", () => JSON.stringify(ROOMS));

const out = path.join(LAB, "log.html");
await writeFile(out, page, "utf8");
const { size } = await stat(out);
const mb = size / 1024 / 1024;
process.stdout.write(`${out}\n${mb.toFixed(2)} MB · ${Object.keys(frames).length} frames\n`);
if (mb > 15.5) {
  process.stdout.write("over budget\n");
  process.exitCode = 1;
}
