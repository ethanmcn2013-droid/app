import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const options = ["a", "b", "c"] as const;
const views = ["board", "list", "timeline", "calendar"] as const;

test("@targets inventories narrow-desktop interactive target sizes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 1000 });
  const surfaces = [];

  for (const option of options) {
    for (const view of views) {
      await page.goto(`/__design-lab/tasks?option=${option}&view=${view}&dataset=dense&density=compact&mode=default`);
      await page.locator(`[data-option="${option}"]`).waitFor({ state: "visible" });
      await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
      await page.locator(`[data-view="${view}"]`).waitFor({ state: "visible" });
      const audit = await page.evaluate(() => {
        const root = document.querySelector('[data-work-surface="true"]');
        if (!root) return { checked: 0, under24: [], under24WithoutSpacing: [], under20WithoutSpacing: [] };
        const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
        const results = items.flatMap((element, index) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (style.visibility === "hidden" || style.display === "none" || rect.width === 0 || rect.height === 0) return [];
          const labelledControl = element.matches('input[type="checkbox"], input[type="radio"]') ? element.closest("label") : null;
          const targetRect = labelledControl?.getBoundingClientRect() ?? rect;
          const after = getComputedStyle(element, "::after");
          const insetExpansion = after.content !== "none" && after.position === "absolute"
            ? Math.max(0, Number.parseFloat(after.left) * -1) * 2
            : 0;
          const width = Math.round((labelledControl ? targetRect.width : rect.width + insetExpansion) * 10) / 10;
          const height = Math.round((labelledControl ? targetRect.height : rect.height + insetExpansion) * 10) / 10;
          const name = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 90) || `${element.tagName.toLowerCase()}-${index}`;
          return [{ tag: element.tagName.toLowerCase(), name, width, height, centerX: targetRect.left + targetRect.width / 2, centerY: targetRect.top + targetRect.height / 2 }];
        });
        const withSpacing = results.map((item, index) => ({
          ...item,
          nearestTargetCenter: results.reduce((nearest, candidate, candidateIndex) => {
            if (candidateIndex === index) return nearest;
            return Math.min(nearest, Math.hypot(item.centerX - candidate.centerX, item.centerY - candidate.centerY));
          }, Number.POSITIVE_INFINITY),
        }));
        const under24 = withSpacing.filter((item) => item.width < 24 || item.height < 24);
        return {
          checked: results.length,
          under24,
          under24WithoutSpacing: under24.filter((item) => item.nearestTargetCenter < 24),
          under20WithoutSpacing: under24.filter((item) => (item.width < 20 || item.height < 20) && item.nearestTargetCenter < 24),
        };
      });
      expect(audit.under20WithoutSpacing, `${option}/${view} has a sub-20px target without the 24px spacing exception`).toEqual([]);
      surfaces.push({ option, view, viewport: { width: 1024, height: 1000 }, ...audit });
    }
  }

  const directory = path.resolve("artifacts/tasks-redesign/accessibility");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "target-size-audit.json"), JSON.stringify({
    note: "Under-24px entries are recorded. The test blocks sub-20px effective targets whose centre lies within 24px of another pointer target; other entries use the WCAG 2.2 spacing exception and remain available for manual review.",
    surfaces,
  }, null, 2));
});
