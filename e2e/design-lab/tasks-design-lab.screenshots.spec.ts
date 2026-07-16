import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const options = ["a", "b", "c"] as const;
const views = ["board", "list", "timeline", "calendar"] as const;
const normalWidths = [1280, 1440, 1728, 1920] as const;
const denseWidths = [1024, 1440] as const;
const screenshotRoot = path.resolve("artifacts/tasks-redesign/screenshots");

async function settle(page: Page) {
  await page.locator('[data-option]').waitFor({ state: "visible" });
  await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function expectResponsivePlanningRail(page: Page, option: (typeof options)[number], width: number) {
  if (option !== "c") return;
  const surface = page.locator('[data-option="c"]');
  if (width <= 1180) await expect(surface).toHaveAttribute("data-planning-collapsed", "true");
  else await expect(surface).not.toHaveAttribute("data-planning-collapsed", "true");
}

test.beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true });
});

for (const option of options) {
  for (const view of views) {
    for (const width of normalWidths) {
      test(`@screenshots ${option.toUpperCase()} ${view} normal ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`/__design-lab/tasks?option=${option}&view=${view}&dataset=normal&density=compact&mode=default`);
        await settle(page);
        await expect(page.locator(`[data-option="${option}"]`)).toBeVisible();
        await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
        await expectResponsivePlanningRail(page, option, width);
        const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(documentOverflows, "document-level horizontal overflow").toBe(false);
        await page.screenshot({
          animations: "disabled",
          caret: "initial",
          path: path.join(screenshotRoot, `${option}-${view}-normal-${width}.png`),
        });
      });
    }

    for (const width of denseWidths) {
      test(`@screenshots ${option.toUpperCase()} ${view} dense ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`/__design-lab/tasks?option=${option}&view=${view}&dataset=dense&density=compact&mode=default`);
        await settle(page);
        await expect(page.locator(`[data-option="${option}"]`)).toBeVisible();
        await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
        await expectResponsivePlanningRail(page, option, width);
        const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(documentOverflows, "document-level horizontal overflow").toBe(false);
        await page.screenshot({
          animations: "disabled",
          caret: "initial",
          path: path.join(screenshotRoot, `${option}-${view}-dense-${width}.png`),
        });
      });
    }
  }
}
