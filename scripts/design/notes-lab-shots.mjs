// Screenshot harness for the Notes design directions.
//
//   node scripts/design/notes-lab-shots.mjs
//   node scripts/design/notes-lab-shots.mjs --only=a --states=notebook,voice
//
// A sibling of scripts/design/lab-shots.mjs, which belongs to the Tasks
// exploration and is not edited by this programme. Same idiom, same four
// viewports as the reference set, so a direction frame and a "before" frame
// drop into the comparison surface at identical size.
//
// The artboards under docs/design/labs/notes-2026-08/ are self-contained and
// run over file://, driven by the real review fixture in data.js.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const OUT = args.get("out") ?? path.join(LAB, "shots");
const ONLY = args.get("only")?.split(",").map((v) => v.trim().toLowerCase()) ?? null;

/* The ten lab states, in the order DIRECTIONS.md argues them. */
export const STATE_LIST = [
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

const STATES = args.get("states")?.split(",").map((v) => v.trim()) ?? STATE_LIST;
const VIEWPORT_FILTER = args.get("viewports")?.split(",").map((v) => v.trim()) ?? null;

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, isMobile: true },
  { name: "768x1024", width: 768, height: 1024, isMobile: false },
  { name: "1280x900", width: 1280, height: 900, isMobile: false },
  { name: "1440x960", width: 1440, height: 960, isMobile: false },
];

const DIRECTIONS = [
  { key: "a", file: "direction-a.html", name: "A · The Desk" },
  { key: "b", file: "direction-b.html", name: "B · The Page" },
  { key: "c", file: "direction-c.html", name: "C · The Stack" },
  /* Phases C and D photograph the master through the same harness. */
  { key: "locked", file: "notebook.html", name: "Locked master", query: "v=locked", optional: true },
  { key: "r1", file: "notebook.html", name: "Room 1", query: "v=a", optional: true },
  { key: "r2", file: "notebook.html", name: "Room 2", query: "v=b", optional: true },
  { key: "r3", file: "notebook.html", name: "Room 3", query: "v=c", optional: true },
];

async function shoot() {
  const { existsSync } = await import("node:fs");
  const browser = await chromium.launch();
  const directions = (ONLY ? DIRECTIONS.filter((d) => ONLY.includes(d.key)) : DIRECTIONS).filter(
    (d) => existsSync(path.join(LAB, d.file)),
  );
  const viewports = VIEWPORT_FILTER
    ? VIEWPORTS.filter((v) => VIEWPORT_FILTER.includes(v.name))
    : VIEWPORTS;
  await mkdir(OUT, { recursive: true });
  const manifest = [];
  const allErrors = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      hasTouch: Boolean(viewport.isMobile),
      isMobile: Boolean(viewport.isMobile),
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`${String(error).split("\n")[0]} @${viewport.name}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${message.text()} @${viewport.name}`);
    });

    for (const direction of directions) {
      for (const state of STATES) {
        const url =
          `${pathToFileURL(path.join(LAB, direction.file)).href}?state=${state}` +
          (direction.query ? `&${direction.query}` : "");
        await page.goto(url, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(320);
        const file = path.join(OUT, `${direction.key}-${state}--${viewport.name}.png`);
        await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
        manifest.push({
          direction: direction.key,
          name: direction.name,
          state,
          viewport: viewport.name,
          file: path.basename(file),
        });
      }
      process.stdout.write(`ok   ${direction.key} @${viewport.name} (${STATES.length} states)\n`);
    }

    if (errors.length) {
      allErrors.push(...new Set(errors));
      process.stdout.write(`  ERRORS @${viewport.name}:\n`);
      for (const error of [...new Set(errors)]) process.stdout.write(`   - ${error}\n`);
    }
    await context.close();
  }
  await browser.close();

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify(
      {
        viewports: viewports.map((v) => v.name),
        states: STATES,
        directions: directions.map((d) => ({ key: d.key, name: d.name })),
        errors: [...new Set(allErrors)],
        shots: manifest,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write(`\n${manifest.length} frames · ${new Set(allErrors).size} console errors\n`);
  if (allErrors.length) process.exitCode = 1;
}

shoot().catch((error) => {
  console.error(error);
  process.exit(1);
});
