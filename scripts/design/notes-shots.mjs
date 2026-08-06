// Notes design-review screenshot harness.
//
//   node scripts/design/notes-shots.mjs --out docs/design/shots/before --base http://localhost:3510
//
// Drives the running review-mode app and writes one PNG per (scene × viewport).
// Scenes are selected with --only=slug,slug. Every scene is a pure navigation
// plus optional scripted interaction, so a run is reproducible.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const BASE = args.get("base") ?? "http://localhost:3510";
const OUT = args.get("out") ?? "docs/design/shots/scratch";
const ONLY = args.get("only")?.split(",").map((value) => value.trim()).filter(Boolean) ?? null;
const VIEWPORT_FILTER = args.get("viewports")?.split(",").map((v) => v.trim()) ?? null;

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1600x900", width: 1600, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024, isMobile: false },
  { name: "390x844", width: 390, height: 844, isMobile: true },
];

/** @type {{slug: string, url: string, viewports?: string[], act?: (page: import("@playwright/test").Page) => Promise<void>}[]} */
const SCENES = [
  { slug: "notebook", url: "/app/notes" },
  { slug: "notebook-empty", url: "/app/notes?fixture=empty" },
  { slug: "notebook-dense", url: "/app/notes?fixture=dense" },
  { slug: "review", url: "/app/notes?view=review" },
  { slug: "sent", url: "/app/notes?view=sent" },
  { slug: "sent-empty", url: "/app/notes?view=sent&fixture=empty" },
];

async function shoot() {
  const browser = await chromium.launch();
  const scenes = ONLY ? SCENES.filter((scene) => ONLY.includes(scene.slug)) : SCENES;
  const viewports = VIEWPORT_FILTER
    ? VIEWPORTS.filter((viewport) => VIEWPORT_FILTER.includes(viewport.name))
    : VIEWPORTS;
  await mkdir(OUT, { recursive: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      hasTouch: Boolean(viewport.isMobile),
      isMobile: Boolean(viewport.isMobile),
      reducedMotion: "no-preference",
      colorScheme: "light",
    });
    // Dismiss the in-development pill exactly the way a reviewer would: set
    // the same session key the banner's own close button writes. No
    // production bypass, no new flag, and the banner still ships everywhere
    // else.
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("signal-tasks.devbanner_dismissed", "1");
      } catch {
        /* private mode: the pill stays, the shot is still valid */
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    for (const scene of scenes) {
      if (scene.viewports && !scene.viewports.includes(viewport.name)) continue;
      await page.goto(`${BASE}${scene.url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      if (scene.act) await scene.act(page);
      await page.waitForTimeout(250);
      const file = path.join(OUT, `${scene.slug}--${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      process.stdout.write(`${file}\n`);
    }

    if (errors.length) {
      process.stdout.write(`  console errors @${viewport.name}:\n`);
      for (const error of [...new Set(errors)]) process.stdout.write(`   - ${error}\n`);
    }
    await context.close();
  }
  await browser.close();
}

shoot().catch((error) => {
  console.error(error);
  process.exit(1);
});
