import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const options = ["a", "b", "c"] as const;
const states = [
  { mode: "empty", view: "board", task: "" },
  { mode: "loading", view: "board", task: "" },
  { mode: "error", view: "board", task: "" },
  { mode: "readonly", view: "list", task: "&task=launch-13" },
] as const;
const root = path.resolve("artifacts/tasks-redesign/states");

test.beforeAll(async () => mkdir(root, { recursive: true }));

for (const option of options) {
  for (const state of states) {
    test(`@states ${option.toUpperCase()} ${state.mode}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/__design-lab/tasks?option=${option}&view=${state.view}&dataset=normal&density=compact&mode=${state.mode}${state.task}`);
      await page.locator(`[data-option="${option}"]`).waitFor({ state: "visible" });
      await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
      if (state.mode === "loading") await expect(page.getByLabel("Loading design-lab state")).toBeVisible();
      if (state.mode === "error") await expect(page.getByRole("alert").filter({ hasText: "Workspace tasks could not be loaded" })).toBeVisible();
      if (state.mode === "empty") await expect(page.locator('[data-task-count="0"]')).toBeVisible();
      if (state.mode === "readonly") await expect(page.getByRole("complementary", { name: /launch-13/ }).getByText("Read-only", { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        animations: "disabled",
        caret: "initial",
        path: path.join(root, `${option}-${state.mode}-1440.png`),
      });
    });
  }
}
