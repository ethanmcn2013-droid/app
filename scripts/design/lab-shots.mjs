// Screenshot harness for the Tasks design directions.
//
//   node scripts/design/lab-shots.mjs
//   node scripts/design/lab-shots.mjs --only=a --states=board,dense
//
// The directions are self-contained HTML artboards under
// docs/design/labs/tasks-2026-08/, driven by the real review-mode fixture in
// data.js. They are loaded over file:// and photographed at the same four
// viewports as the reference set, so a direction frame and a reference frame
// drop into the comparison surface at identical size.
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

const LAB = path.resolve("docs/design/labs/tasks-2026-08");
const OUT = args.get("out") ?? path.join(LAB, "shots");
/* The founder locked one configuration on 2026-08-24, so `locked` is the only
   direction still being worked. The other six stay capturable for the record —
   `--only=arch-a,a,b,c` brings them back — but re-shooting them every round was
   138 of 164 frames spent on work nobody is doing. */
const ONLY = args.get("only")?.split(",").map((v) => v.trim().toLowerCase()) ?? ["locked"];
const STATES = args.get("states")?.split(",").map((v) => v.trim()) ?? [
  "board",
  "cards",
  "dense",
  "empty",
  "filtered",
  "loading",
  "planning",
];
const VIEWPORT_FILTER = args.get("viewports")?.split(",").map((v) => v.trim()) ?? null;

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, isMobile: true },
  { name: "768x1024", width: 768, height: 1024, isMobile: false },
  { name: "1280x900", width: 1280, height: 900, isMobile: false },
  { name: "1440x960", width: 1440, height: 960, isMobile: false },
];

/* The three original directions stay capturable for the record; the three
   Studio Floor variations are the live work. A `query` rides into the URL so
   one master file can serve all three variations. */
const DIRECTIONS = [
  { key: "arch-a", file: "direction-a.html", name: "Ledger" },
  { key: "arch-b", file: "direction-b.html", name: "Atelier" },
  { key: "arch-c", file: "direction-c.html", name: "Studio Floor" },
  { key: "locked", file: "floor.html", name: "Studio Floor · locked palette", query: "v=locked" },
  { key: "a", file: "floor.html", name: "Variant A · Air", query: "v=a" },
  { key: "b", file: "floor.html", name: "Variant B · Frame", query: "v=b" },
  { key: "c", file: "floor.html", name: "Variant C · Signal", query: "v=c" },
];

async function shoot() {
  const browser = await chromium.launch();
  const directions = ONLY ? DIRECTIONS.filter((d) => ONLY.includes(d.key)) : DIRECTIONS;
  const viewports = VIEWPORT_FILTER
    ? VIEWPORTS.filter((v) => VIEWPORT_FILTER.includes(v.name))
    : VIEWPORTS;
  await mkdir(OUT, { recursive: true });
  const manifest = [];

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
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const direction of directions) {
      for (const state of STATES) {
        if (state === "cards" && (viewport.width < 1000 || !direction.query)) continue;
        /* The three archived directions predate both the specimen sheet and
           the filter, so they have no such screen to photograph. */
        if (state === "filtered" && !direction.query) continue;
        const url = `${pathToFileURL(path.join(LAB, direction.file)).href}?state=${state}` +
          (direction.query ? `&${direction.query}` : "");
        await page.goto(url, { waitUntil: "load" });
        await page.waitForTimeout(450);
        const file = path.join(OUT, `${direction.key}-${state}--${viewport.name}.png`);
        await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
        manifest.push({
          direction: direction.key,
          name: direction.name,
          state,
          viewport: viewport.name,
          file: path.basename(file),
        });
        process.stdout.write(`${file}\n`);
      }
    }

    if (errors.length) {
      process.stdout.write(`  errors @${viewport.name}:\n`);
      for (const error of [...new Set(errors)]) process.stdout.write(`   - ${error}\n`);
    }
    await context.close();
  }
  await browser.close();

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ viewports: viewports.map((v) => v.name), states: STATES, shots: manifest }, null, 2)}\n`,
    "utf8",
  );
}

shoot().catch((error) => {
  console.error(error);
  process.exit(1);
});
