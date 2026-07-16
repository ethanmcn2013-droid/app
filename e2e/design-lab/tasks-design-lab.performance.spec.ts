import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const options = ["a", "b", "c"] as const;
const views = ["board", "list", "timeline", "calendar"] as const;

test("@performance records dense-surface development observations", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const durations: number[] = [];
    (window as typeof window & { __tasksLongTasks?: number[] }).__tasksLongTasks = durations;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) durations.push(entry.duration);
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Some browser channels do not expose the Long Tasks API.
    }
  });

  for (const option of options) {
    for (const view of views) {
      await page.goto(`/__design-lab/tasks?option=${option}&view=${view}&dataset=dense&density=compact&mode=default`);
      await page.locator(`[data-option="${option}"]`).waitFor({ state: "visible" });
      await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
      await page.locator(`[data-view="${view}"]`).waitFor({ state: "visible" });
    }
  }

  const observations = [];
  for (const option of options) {
    for (const view of views) {
      const started = Date.now();
      await page.goto(`/__design-lab/tasks?option=${option}&view=${view}&dataset=dense&density=compact&mode=default`);
      await page.locator(`[data-option="${option}"]`).waitFor({ state: "visible" });
      await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
      await page.locator(`[data-view="${view}"]`).waitFor({ state: "visible" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      const metrics = await page.evaluate(() => {
        const longTasks = (window as typeof window & { __tasksLongTasks?: number[] }).__tasksLongTasks ?? [];
        return {
          domNodes: document.querySelectorAll("*").length,
          taskNodes: document.querySelectorAll("[data-task-id]").length,
          documentOverflows: document.documentElement.scrollWidth > window.innerWidth + 1,
          longTaskCount: longTasks.length,
          longestLongTaskMs: longTasks.length ? Math.max(...longTasks) : 0,
        };
      });
      observations.push({ option, view, dataset: "dense", settleMs: Date.now() - started, ...metrics });
      expect(metrics.documentOverflows).toBe(false);
      expect(metrics.domNodes).toBeLessThan(7_000);
    }
  }

  const directory = path.resolve("artifacts/tasks-redesign/performance");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "dense-development-observations.json"), JSON.stringify({
    context: "Warm development-only design lab; timings are comparative observations after every surface was compiled once, not production Web Vitals.",
    viewport: { width: 1440, height: 1000 },
    observations,
  }, null, 2));
});
