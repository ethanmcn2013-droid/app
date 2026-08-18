// Photograph the master: every state × every viewport, per variant.
//
//   node shots.mjs --lab=<dir>
//   node shots.mjs --lab=<dir> --v=b --states=resting,dense --viewports=1440x960
//
// Frames land in <lab>/shots/ as <variant>-<state>--<WxH>.png at 2x, which
// is the exact naming the report builder and the panel BAR both read. The
// same frame names all engagement means a round-3 frame and a round-9 frame
// are directly comparable.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs, loadLab, masterUrl, launch } from "./lib.mjs";

const args = parseArgs();
const { lab, config } = await loadLab(args);

const VARIANTS = (args.get("v") ?? config.defaultVariant).split(",");
const STATES = (args.get("states") ?? config.states.join(",")).split(",");
const FILTER = args.get("viewports")?.split(",") ?? null;
const OUT = path.join(lab, "shots");
await mkdir(OUT, { recursive: true });

const viewports = config.viewports.filter((v) => !FILTER || FILTER.includes(v.name));
const browser = await launch(chromium);
let count = 0;

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.isMobile),
  });
  const page = await context.newPage();
  for (const variant of VARIANTS) {
    for (const state of STATES) {
      await page.goto(masterUrl(lab, config, { state, variant }), { waitUntil: "load" });
      /* Webfonts must have swapped before the frame is truth. */
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(350);
      const file = path.join(OUT, `${variant}-${state}--${viewport.name}.png`);
      await page.screenshot({ path: file });
      count += 1;
      process.stdout.write(`  ${path.basename(file)}\n`);
    }
  }
  await context.close();
}

await browser.close();
process.stdout.write(`${count} frames → ${OUT}\n`);
