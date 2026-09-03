import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.REFERENCE_BASE ?? "http://localhost:3530";
const OUT = new URL("./shots/reference/", import.meta.url).pathname.slice(1);
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x900", width: 1280, height: 900 },
  { name: "1440x960", width: 1440, height: 960 },
];

async function settle(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 4_000 });
  } catch {
    // The Tasks runtime may hold a live connection.
  }
  await page.waitForTimeout(700);
  const dismiss = page.getByRole("button", {
    name: /dismiss|close.*development/i,
  });
  if (await dismiss.count()) {
    await dismiss.first().click().catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

async function shoot() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const manifest = [];
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        colorScheme: "light",
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();

      await settle(page, `${BASE}/app/settings`);
      const storage = page.getByRole("button", { name: "Storage" });
      if (await storage.count()) {
        await storage.first().click();
        await page.waitForTimeout(350);
      }
      const settingsFile = path.join(
        OUT,
        `settings-storage--${viewport.name}.png`,
      );
      await page.screenshot({ path: settingsFile, fullPage: false });
      manifest.push({
        surface: "settings-storage",
        viewport: viewport.name,
        file: path.basename(settingsFile),
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        base: BASE,
        accessMode: "review",
        frames: manifest,
      },
      null,
      2,
    )}\n`,
  );
}

await shoot();
