import { expect, test } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

test.use({
  video: "on",
  viewport: { width: 1440, height: 900 },
});

test("@motion records a representative Phase 1 interaction", async ({ page }) => {
  test.setTimeout(60_000);
  const video = page.video();
  await page.goto("/__design-lab/tasks?option=a&view=board&dataset=normal&density=compact&mode=default&task=launch-13");
  await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
  await page.locator('[data-option="a"]').waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /B\s*Editorial Project Room/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /C\s*Signal Spatial/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page.waitForTimeout(500);

  await page.keyboard.press("Control+p");
  await page.getByLabel("Search tasks and commands").fill("QA subscription upgrade flow");
  await page.getByRole("dialog", { name: "Task command palette" }).getByRole("button", { name: /QA subscription upgrade flow/ }).click();
  await page.waitForTimeout(400);
  const inspector = page.getByRole("complementary", { name: /launch-14/ });
  await inspector.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("due");
  await inspector.getByLabel("Due", { exact: true }).fill("2026-07-24");
  await expect(page.locator('[data-scheduled-task-id="launch-14"]').first()).toBeVisible();
  await page.waitForTimeout(700);

  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /A\s*Quiet Command/ }).click();
  await page.waitForTimeout(700);

  await page.close();
  if (!video) throw new Error("Playwright video capture was unavailable");
  const source = await video.path();
  const directory = path.resolve("artifacts/tasks-redesign/video");
  await mkdir(directory, { recursive: true });
  await copyFile(source, path.join(directory, "phase1-interaction.webm"));
});
